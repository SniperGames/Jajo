/* Jajo: forum. Wątki z tagami, odpowiedzi na żywo, zamykanie, przypinanie i moderacja. */
import {
  connect, configured, isMember, isAdmin, watchUser, ensureProfile, relTime, avatarHtml, avatarFor,
} from './jajo-firebase.js';
import { openLogin } from './logowanie.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const plural = (n, one, few, many) => {
  if (n === 1) return one;
  const d = n % 10;
  const h = n % 100;
  return d >= 2 && d <= 4 && (h < 12 || h > 14) ? few : many;
};
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');
const millis = (t) => (t && t.toMillis ? t.toMillis() : Date.now());

// Tagi muszą się zgadzać z listą w firestore.rules.
const TAGS = [
  ['pytanie', 'Pytanie'],
  ['gotowanie', 'Gotowanie jajek'],
  ['przepisy', 'Przepisy'],
  ['wypieki', 'Wypieki i desery'],
  ['zdrowie', 'Zdrowie i dieta'],
  ['kury', 'Kury i hodowla'],
  ['zakupy', 'Zakupy i przechowywanie'],
  ['pokaz', 'Pochwal się'],
  ['inne', 'Inne'],
];
const TAG = Object.fromEntries(TAGS);
const LIMIT = 100;
const MAX_TAGS = 3;
const BASE_TITLE = document.title;

const ICON = {
  pin: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l-1 6 4 4H6l4-4zM12 13v8"/></svg>',
  lock: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/></svg>',
  close: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  bubble: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/></svg>',
};

const listEl = $('#forumList');
const threadEl = $('#forumThread');
const listBox = $('#forumThreads');
const stateEl = $('#forumState');
const newBtn = $('[data-new]', listEl);

let fb = null;
let me = null;
let myName = '';
let admin = false;
let threads = new Map();
let loaded = false;
const filter = { tag: '', q: '', sort: 'aktywnosc' };
let listScroll = 0;

let threadId = null;
let thread; // undefined: wczytuję, null: nie istnieje
let replies = [];
let threadSubs = [];
let fromList = false;
let editingReply = null;
let jumpTo = null;

/* ---------- Start ---------- */

(async function start() {
  fb = await connect();
  if (!fb) {
    stateEl.textContent = configured ? 'Nie udało się połączyć z forum. Odśwież stronę za chwilę.' : 'Forum ruszy wkrótce.';
    return;
  }
  const { F, db } = fb;
  try {
    await F.getDocs(F.query(F.collection(db, 'watki'), F.limit(1)));
  } catch (err) {
    console.warn('Forum jest wyłączone: brak reguł w Firestore.', err && err.code);
    stateEl.textContent = 'Forum ruszy wkrótce.';
    return;
  }
  newBtn.disabled = false;
  renderTags();
  subscribeList();
  watchUser(fb, async (u) => {
    me = isMember(u) ? u : null;
    myName = '';
    admin = false;
    if (me) {
      const [profile, adm] = await Promise.all([ensureProfile(fb, me), isAdmin(fb, me.uid)]);
      myName = (profile && profile.name) || '';
      admin = adm;
    }
    if (threadId && thread) renderThread();
  });
  window.addEventListener('hashchange', () => route(true));
  route(false);
})();

function route(viaHash) {
  const id = decodeURIComponent(location.hash.slice(1));
  if (/^[A-Za-z0-9]{10,40}$/.test(id)) {
    fromList = viaHash && !listEl.hidden;
    openThread(id);
  } else {
    showList();
  }
}

function goToList() {
  if (fromList) {
    history.back();
  } else {
    history.replaceState(null, '', location.pathname + location.search);
    showList();
  }
}

/* ---------- Lista wątków ---------- */

function toThread(d) {
  const t = d.data({ serverTimestamps: 'estimate' });
  return {
    id: d.id,
    ...t,
    tags: Array.isArray(t.tags) ? t.tags : [],
    replies: t.replies || 0,
    created: millis(t.createdAt),
    last: millis(t.lastAt),
    edited: t.editedAt ? millis(t.editedAt) : 0,
  };
}

function subscribeList() {
  const { F, db } = fb;
  const col = F.collection(db, 'watki');
  const latest = new Map();
  const pinned = new Map();
  const fill = (map, snap) => {
    map.clear();
    snap.forEach((d) => map.set(d.id, toThread(d)));
    threads = new Map([...latest, ...pinned]);
  };
  const fail = (err) => {
    console.error(err);
    stateEl.textContent = 'Nie udało się wczytać wątków. Odśwież stronę za chwilę.';
  };
  // Najnowsza aktywność i osobno przypięte (żeby stare przypięte wątki nie znikały z góry listy).
  F.onSnapshot(F.query(col, F.orderBy('lastAt', 'desc'), F.limit(LIMIT)), (snap) => {
    fill(latest, snap);
    loaded = true;
    renderList();
  }, fail);
  F.onSnapshot(F.query(col, F.where('pinned', '==', true)), (snap) => {
    fill(pinned, snap);
    if (loaded) renderList();
  }, fail);
}

function renderTags() {
  const box = $('#forumTags');
  box.innerHTML = [['', 'Wszystkie'], ...TAGS].map(([k, l]) => `
    <button type="button" class="chip" role="radio" data-filter-tag="${k}" aria-checked="${k === filter.tag}">${esc(l)}<span class="chip-count"></span></button>`).join('');
}

function syncTags() {
  const all = [...threads.values()];
  $$('.chip[data-filter-tag]', $('#forumTags')).forEach((chip) => {
    const k = chip.dataset.filterTag;
    chip.setAttribute('aria-checked', String(k === filter.tag));
    $('.chip-count', chip).textContent = String(k ? all.filter((t) => t.tags.includes(k)).length : all.length);
  });
}

function visibleThreads() {
  const q = norm(filter.q.trim());
  let list = [...threads.values()];
  if (filter.tag) list = list.filter((t) => t.tags.includes(filter.tag));
  if (q) list = list.filter((t) => norm([t.title, t.text, t.authorName, ...t.tags.map((k) => TAG[k])].join(' ')).includes(q));
  const order = {
    aktywnosc: (a, b) => b.last - a.last,
    nowe: (a, b) => b.created - a.created,
    odpowiedzi: (a, b) => b.replies - a.replies || b.last - a.last,
  }[filter.sort];
  return list.sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || order(a, b));
}

function tagsHtml(tags, attr = 'data-filter-tag') {
  return tags.filter((k) => TAG[k]).map((k) => `<button type="button" class="tag" ${attr}="${k}">${esc(TAG[k])}</button>`).join('');
}

function badgesHtml(t) {
  return (t.pinned ? `<span class="badge badge-pin">${ICON.pin}Przypięty</span>` : '')
    + (t.closed ? `<span class="badge badge-closed">${ICON.lock}Zamknięty</span>` : '');
}

function threadItemHtml(t) {
  const n = t.replies;
  const last = n && t.lastName ? ` · ostatnio ${esc(t.lastName)}, ${relTime(t.last)}` : '';
  return `
    <li class="ft-item${t.pinned ? ' is-pinned' : ''}${t.closed ? ' is-closed' : ''}">
      <span class="ft-av" data-av="${esc(t.authorUid)}">${avatarHtml(t.authorName, t.authorUid)}</span>
      <div class="ft-main">
        ${t.pinned || t.closed ? `<p class="ft-badges">${badgesHtml(t)}</p>` : ''}
        <h2 class="ft-title"><a href="#${esc(t.id)}">${esc(t.title)}</a></h2>
        <p class="ft-meta"><a href="profil.html#${esc(t.authorUid)}">${esc(t.authorName)}</a> · ${relTime(t.created)}${last}</p>
        <p class="ft-tags">${tagsHtml(t.tags)}</p>
      </div>
      <a class="ft-count" href="#${esc(t.id)}" tabindex="-1" aria-hidden="true">${ICON.bubble}<b>${n}</b><span>${plural(n, 'odpowiedź', 'odpowiedzi', 'odpowiedzi')}</span></a>
    </li>`;
}

function renderList() {
  syncTags();
  const all = [...threads.values()];
  const repliesTotal = all.reduce((sum, t) => sum + t.replies, 0);
  $('#forumStats').textContent = all.length
    ? `${all.length} ${plural(all.length, 'wątek', 'wątki', 'wątków')} · ${repliesTotal} ${plural(repliesTotal, 'odpowiedź', 'odpowiedzi', 'odpowiedzi')}`
    : '';
  const list = visibleThreads();
  listBox.innerHTML = list.map(threadItemHtml).join('');
  if (!all.length) {
    stateEl.innerHTML = 'Na forum jeszcze cisza. <button type="button" class="linklike" data-new>Załóż pierwszy wątek</button>.';
  } else if (!list.length) {
    stateEl.innerHTML = 'Nic tu nie pasuje. <button type="button" class="linklike" data-clear>Pokaż wszystkie wątki</button>';
  } else {
    stateEl.textContent = all.length >= LIMIT ? `Pokazujemy ${LIMIT} ostatnio aktywnych wątków.` : '';
  }
  fillAvatars(listBox);
}

listEl.addEventListener('input', (e) => {
  if (e.target.id === 'forumQ') {
    filter.q = e.target.value;
    renderList();
  }
});

listEl.addEventListener('change', (e) => {
  if (e.target.id === 'forumSort') {
    filter.sort = e.target.value;
    renderList();
  }
});

listEl.addEventListener('click', (e) => {
  const chip = e.target.closest('[data-filter-tag]');
  if (chip) {
    // Kliknięcie aktywnego tagu przy wątku albo w filtrach wraca do wszystkich.
    filter.tag = chip.dataset.filterTag === filter.tag && chip.classList.contains('tag') ? '' : chip.dataset.filterTag;
    renderList();
    if (chip.classList.contains('tag')) $('#forumTags').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    return;
  }
  if (e.target.closest('[data-clear]')) {
    filter.tag = '';
    filter.q = '';
    $('#forumQ').value = '';
    renderList();
    return;
  }
  if (e.target.closest('[data-new]')) newThread();
});

/* ---------- Awatary ---------- */

function fillAvatars(root) {
  const uids = [...new Set($$('[data-av]', root).map((el) => el.dataset.av))];
  uids.forEach(async (uid) => {
    const av = await avatarFor(fb, uid);
    if (!av.src) return;
    $$('[data-av]', root).filter((el) => el.dataset.av === uid).forEach((el) => {
      el.innerHTML = avatarHtml(av.name, uid, el.dataset.avSize || '', av.src);
    });
  });
}

/* ---------- Tekst postów ---------- */

const URL_RE = /https?:\/\/[^\s<>"']+/g;

function linkify(text) {
  let out = '';
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const url = m[0].replace(/[.,;:!?)\]]+$/, '');
    out += esc(text.slice(last, m.index))
      + `<a href="${esc(url)}" target="_blank" rel="nofollow ugc noopener">${esc(url)}</a>`;
    last = m.index + url.length;
  }
  return out + esc(text.slice(last));
}

function formatText(text) {
  return String(text || '').split(/\n{2,}/).map((p) => `<p>${linkify(p).replace(/\n/g, '<br>')}</p>`).join('');
}

/* ---------- Wątek ---------- */

function closeThreadSubs() {
  threadSubs.forEach((stop) => stop());
  threadSubs = [];
}

function showList() {
  closeThreadSubs();
  const wasThread = Boolean(threadId);
  threadId = null;
  thread = undefined;
  editingReply = null;
  threadEl.hidden = true;
  threadEl.innerHTML = '';
  listEl.hidden = false;
  document.title = BASE_TITLE;
  if (wasThread) requestAnimationFrame(() => window.scrollTo(0, listScroll));
}

function openThread(id) {
  if (threadId === id) return;
  if (!listEl.hidden) listScroll = window.scrollY;
  closeThreadSubs();
  threadId = id;
  thread = undefined;
  replies = [];
  editingReply = null;
  listEl.hidden = true;
  threadEl.hidden = false;
  threadEl.innerHTML = `${backHtml()}<p class="note">Wczytuję wątek…</p>`;
  window.scrollTo(0, 0);
  if (!fb) return;
  const { F, db } = fb;
  const ref = F.doc(db, 'watki', id);
  const fail = (err) => {
    console.error(err);
    if (threadId === id) threadEl.innerHTML = `${backHtml()}<p class="note">Nie udało się wczytać wątku. Odśwież stronę za chwilę.</p>`;
  };
  threadSubs.push(F.onSnapshot(ref, (snap) => {
    if (threadId !== id) return;
    thread = snap.exists() ? toThread(snap) : null;
    renderThread();
  }, fail));
  threadSubs.push(F.onSnapshot(F.query(F.collection(ref, 'odpowiedzi'), F.orderBy('createdAt'), F.limit(500)), (snap) => {
    if (threadId !== id) return;
    replies = snap.docs.map((d) => {
      const r = d.data({ serverTimestamps: 'estimate' });
      return { id: d.id, ...r, at: millis(r.createdAt), edited: r.editedAt ? millis(r.editedAt) : 0 };
    });
    renderReplies();
  }, fail));
}

const backHtml = () => '<a class="ft-back" href="forum.html" data-back>← Wszystkie wątki</a>';

const isAuthor = () => Boolean(me && thread && thread.authorUid === me.uid);

function renderThread() {
  if (thread === null) {
    document.title = BASE_TITLE;
    threadEl.innerHTML = `${backHtml()}<div class="mod-box"><p>Ten wątek nie istnieje albo został usunięty.</p></div>`;
    return;
  }
  if (!$('#fthHead', threadEl)) {
    threadEl.innerHTML = `
      ${backHtml()}
      <article class="fthread" aria-labelledby="fthTitle">
        <header class="fth-head" id="fthHead"></header>
        <div class="fpost fpost-op" id="fthOp"></div>
        <div class="fth-actions" id="fthActions"></div>
      </article>
      <section class="freplies" aria-labelledby="fthRepliesTitle">
        <h2 class="freplies-title" id="fthRepliesTitle">Odpowiedzi <span id="fthCount"></span></h2>
        <ol class="fposts" id="fthReplies"></ol>
        <div class="freply" id="fthReply"></div>
      </section>`;
  }
  const t = thread;
  document.title = `${t.title} – Forum – Jajo`;
  $('#fthHead', threadEl).innerHTML = `
    ${t.pinned || t.closed ? `<p class="ft-badges">${badgesHtml(t)}</p>` : ''}
    <h1 class="fth-title" id="fthTitle">${esc(t.title)}</h1>
    <p class="ft-tags">${tagsHtml(t.tags, 'data-go-tag')}</p>`;
  $('#fthOp', threadEl).innerHTML = postInner({
    uid: t.authorUid, name: t.authorName, at: t.created, edited: t.edited, text: t.text, op: false,
  });
  renderActions();
  renderReplies();
  renderReplyBox();
  fillAvatars($('#fthOp', threadEl));
}

function postInner({ uid, name, at, edited, text, op, actions = '' }) {
  return `
    <span class="fpost-av" data-av="${esc(uid)}">${avatarHtml(name, uid)}</span>
    <div class="fpost-body">
      <p class="fpost-meta">
        <a class="fpost-name" href="profil.html#${esc(uid)}">${esc(name)}</a>
        ${op ? '<span class="badge badge-op">Autor wątku</span>' : ''}
        <span class="fpost-time">${relTime(at)}</span>
        ${edited ? '<span class="fpost-edited">(edytowane)</span>' : ''}
      </p>
      <div class="fpost-text">${formatText(text)}</div>
      ${actions}
    </div>`;
}

function renderActions() {
  const t = thread;
  const own = isAuthor();
  const btns = [];
  if (own) btns.push('<button type="button" class="chip" data-act="edit">Edytuj wątek</button>');
  if (own || admin) btns.push(`<button type="button" class="chip" data-act="close">${t.closed ? 'Otwórz wątek ponownie' : 'Zamknij wątek'}</button>`);
  if (admin) btns.push(`<button type="button" class="chip" data-act="pin">${t.pinned ? 'Odepnij' : 'Przypnij na górze'}</button>`);
  if ((own && t.replies === 0) || admin) btns.push('<button type="button" class="chip chip-danger" data-act="delete">Usuń wątek</button>');
  const box = $('#fthActions', threadEl);
  box.innerHTML = btns.join('');
  box.hidden = !btns.length;
}

function renderReplies() {
  const list = $('#fthReplies', threadEl);
  if (!list || !thread) return;
  const draft = editingReply && $(`#o-${editingReply} textarea`, list);
  const draftText = draft ? draft.value : null;
  $('#fthCount', threadEl).textContent = String(replies.length);
  list.innerHTML = replies.length
    ? replies.map(replyHtml).join('')
    : '<li class="fposts-empty">Nikt jeszcze nie odpisał. Napisz pierwszą odpowiedź.</li>';
  if (draftText !== null) {
    const area = $(`#o-${editingReply} textarea`, list);
    if (area) area.value = draftText;
  }
  fillAvatars(list);
  if (jumpTo) {
    const el = $(`#o-${jumpTo}`, list);
    if (el) {
      el.classList.add('is-new');
      el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      jumpTo = null;
    }
  }
}

function replyHtml(r) {
  if (r.deleted) {
    return `<li class="fpost is-deleted" id="o-${esc(r.id)}"><p class="fpost-gone">Odpowiedź usunięta.</p></li>`;
  }
  const own = Boolean(me && r.authorUid === me.uid);
  if (own && editingReply === r.id) {
    return `
      <li class="fpost is-editing" id="o-${esc(r.id)}">
        <span class="fpost-av" data-av="${esc(r.authorUid)}">${avatarHtml(r.authorName, r.authorUid)}</span>
        <form class="fpost-body rform fedit" data-edit-reply="${esc(r.id)}" novalidate>
          <label class="sr-only" for="fe-${esc(r.id)}">Popraw odpowiedź</label>
          <textarea id="fe-${esc(r.id)}" rows="4" maxlength="3000">${esc(r.text)}</textarea>
          <p class="account-error" role="alert"></p>
          <div class="factions">
            <button type="submit" class="btn btn-primary">Zapisz</button>
            <button type="button" class="btn btn-ghost" data-reply-act="cancel">Anuluj</button>
          </div>
        </form>
      </li>`;
  }
  const acts = [];
  if (own && !thread.closed) acts.push('<button type="button" class="linklike" data-reply-act="edit">Edytuj</button>');
  if (own || admin) acts.push('<button type="button" class="linklike" data-reply-act="delete">Usuń</button>');
  return `
    <li class="fpost" id="o-${esc(r.id)}" data-reply="${esc(r.id)}">
      ${postInner({
        uid: r.authorUid,
        name: r.authorName,
        at: r.at,
        edited: r.edited,
        text: r.text,
        op: r.authorUid === thread.authorUid,
        actions: acts.length ? `<p class="fpost-actions">${acts.join('')}</p>` : '',
      })}
    </li>`;
}

function renderReplyBox() {
  const box = $('#fthReply', threadEl);
  if (!box) return;
  const mode = thread.closed ? 'closed' : me ? 'form' : 'login';
  if (box.dataset.mode === mode && mode !== 'form') return;
  if (mode === 'form' && box.dataset.mode === 'form') {
    $('.fhint b', box).textContent = myName || 'Ty';
    return;
  }
  box.dataset.mode = mode;
  if (mode === 'closed') {
    box.innerHTML = `<p class="freply-note">${ICON.lock}Wątek jest zamknięty. Nie można już w nim odpisywać.</p>`;
  } else if (mode === 'login') {
    box.innerHTML = `
      <div class="freply-note freply-login">
        <p>Zaloguj się, żeby odpowiedzieć w tym wątku.</p>
        <button type="button" class="btn btn-primary" data-login>Zaloguj się</button>
      </div>`;
  } else {
    box.innerHTML = `
      <form class="rform freply-form" novalidate>
        <label class="ffield"><span>Twoja odpowiedź</span>
          <textarea id="fReply" rows="4" maxlength="3000" placeholder="Napisz, co myślisz. Bądź miły dla innych."></textarea>
        </label>
        <p class="account-error" role="alert"></p>
        <div class="freply-foot">
          <p class="fhint">Piszesz jako <b>${esc(myName || 'Ty')}</b>.</p>
          <button type="submit" class="btn btn-primary">Odpowiedz</button>
        </div>
      </form>`;
  }
}

async function authorName() {
  if (!myName && me) {
    const p = await ensureProfile(fb, me);
    myName = (p && p.name) || '';
  }
  return (myName.length >= 2 ? myName : 'Kucharz').slice(0, 40);
}

threadEl.addEventListener('click', async (e) => {
  const back = e.target.closest('[data-back]');
  if (back) {
    e.preventDefault();
    goToList();
    return;
  }
  const goTag = e.target.closest('[data-go-tag]');
  if (goTag) {
    filter.tag = goTag.dataset.goTag;
    renderList();
    goToList();
    return;
  }
  if (e.target.closest('[data-login]')) {
    openLogin(fb, { lede: 'Żeby odpowiedzieć w wątku, zaloguj się. Czytać możesz bez logowania.' });
    return;
  }
  const act = e.target.closest('[data-act]');
  if (act && thread) {
    await threadAction(act);
    return;
  }
  const replyAct = e.target.closest('[data-reply-act]');
  if (replyAct) {
    const li = replyAct.closest('.fpost');
    await replyAction(replyAct, li.id.slice(2));
  }
});

async function threadAction(btn) {
  const { F, db } = fb;
  const ref = F.doc(db, 'watki', thread.id);
  const kind = btn.dataset.act;
  if (kind === 'edit') {
    openThreadForm(thread);
    return;
  }
  if (kind === 'delete' && !btn.classList.contains('is-confirm')) {
    btn.classList.add('is-confirm');
    btn.textContent = thread.replies ? `Na pewno? Zniknie też ${thread.replies} ${plural(thread.replies, 'odpowiedź', 'odpowiedzi', 'odpowiedzi')}` : 'Na pewno usunąć?';
    return;
  }
  btn.disabled = true;
  try {
    if (kind === 'close') {
      const wasClosed = thread.closed;
      await F.updateDoc(ref, { closed: !wasClosed });
      toast(wasClosed ? 'Wątek otwarty ponownie.' : 'Wątek zamknięty. Nikt już w nim nie odpisze.');
    } else if (kind === 'pin') {
      await F.updateDoc(ref, { pinned: !thread.pinned });
    } else if (kind === 'delete') {
      // Moderator usuwa najpierw odpowiedzi, potem sam wątek.
      const snap = await F.getDocs(F.collection(ref, 'odpowiedzi'));
      for (let i = 0; i < snap.docs.length; i += 400) {
        const batch = F.writeBatch(db);
        snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
      closeThreadSubs();
      await F.deleteDoc(ref);
      toast('Wątek usunięty.');
      goToList();
    }
  } catch (err) {
    console.error(err);
    toast('Nie udało się. Sprawdź połączenie i spróbuj jeszcze raz.');
    btn.disabled = false;
  }
}

async function replyAction(btn, rid) {
  const { F, db } = fb;
  const ref = F.doc(db, 'watki', thread.id, 'odpowiedzi', rid);
  const kind = btn.dataset.replyAct;
  if (kind === 'edit') {
    editingReply = rid;
    renderReplies();
    const area = $(`#o-${rid} textarea`, threadEl);
    if (area) area.focus();
  } else if (kind === 'cancel') {
    editingReply = null;
    renderReplies();
  } else if (kind === 'delete') {
    if (!btn.classList.contains('is-confirm')) {
      btn.classList.add('is-confirm');
      btn.textContent = 'Na pewno usunąć?';
      return;
    }
    btn.disabled = true;
    try {
      await F.updateDoc(ref, { text: '', deleted: true });
    } catch (err) {
      console.error(err);
      btn.disabled = false;
      btn.textContent = 'Nie udało się';
    }
  }
}

threadEl.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const error = $('.account-error', form);
  const btn = $('button[type="submit"]', form);
  const area = $('textarea', form);
  const text = area.value.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  error.textContent = '';
  if (text.length < 2) {
    error.textContent = 'Napisz coś więcej niż jedną literę.';
    area.focus();
    return;
  }
  const { F, db } = fb;
  btn.disabled = true;
  try {
    if (form.dataset.editReply) {
      await F.updateDoc(F.doc(db, 'watki', thread.id, 'odpowiedzi', form.dataset.editReply), { text, editedAt: F.serverTimestamp() });
      editingReply = null;
      renderReplies();
      return;
    }
    const name = await authorName();
    const tRef = F.doc(db, 'watki', thread.id);
    const rRef = F.doc(F.collection(tRef, 'odpowiedzi'));
    const batch = F.writeBatch(db);
    batch.set(F.doc(db, 'uzytkownicy', me.uid), { odpowiedz: F.serverTimestamp() }, { merge: true });
    batch.set(rRef, { text, authorUid: me.uid, authorName: name, createdAt: F.serverTimestamp() });
    batch.update(tRef, { replies: F.increment(1), lastAt: F.serverTimestamp(), lastName: name, lastReply: rRef.id });
    jumpTo = rRef.id;
    await batch.commit();
    area.value = '';
  } catch (err) {
    console.error(err);
    jumpTo = null;
    error.textContent = err && err.code === 'permission-denied'
      ? (thread.closed ? 'Wątek został zamknięty.' : 'Kolejną odpowiedź możesz dodać za kilka sekund.')
      : 'Nie udało się wysłać. Sprawdź połączenie i spróbuj jeszcze raz.';
  } finally {
    if (btn.isConnected) btn.disabled = false;
  }
});

/* ---------- Nowy wątek i edycja ---------- */

let formDialog = null;
let editing = null; // wątek, który poprawiamy, albo null dla nowego

async function newThread() {
  if (!fb) return;
  if (!me) {
    const u = await openLogin(fb, { lede: 'Żeby założyć wątek, zaloguj się. Czytać możesz bez logowania.' });
    if (!u) return;
    me = u;
  }
  openThreadForm(null);
}

function buildForm() {
  formDialog = document.createElement('dialog');
  formDialog.className = 'rdialog fdialog tdialog';
  formDialog.setAttribute('aria-labelledby', 'tdTitle');
  formDialog.innerHTML = `
    <form class="rform" novalidate>
      <div class="rd-bar"><button type="button" class="rd-close" data-td-close aria-label="Zamknij">${ICON.close}</button></div>
      <div class="rform-body">
        <header class="rform-head">
          <p class="eyebrow">Forum</p>
          <h2 id="tdTitle">Nowy wątek</h2>
        </header>
        <label class="ffield"><span>Tytuł</span>
          <input id="tTitle" maxlength="120" placeholder="Np. Ile gotować jajko na miękko?" autocomplete="off">
        </label>
        <label class="ffield"><span>Treść</span>
          <textarea id="tText" rows="8" maxlength="5000" placeholder="Opisz pytanie albo temat. Im więcej szczegółów, tym łatwiej o dobrą odpowiedź."></textarea>
        </label>
        <fieldset class="fgroup tform-tags">
          <legend>Tagi <small>(od 1 do ${MAX_TAGS})</small></legend>
          <p class="fhint">Tagi pomagają innym znaleźć Twój wątek.</p>
          <div class="tag-picks">
            ${TAGS.map(([k, l]) => `<label class="tag-pick"><input type="checkbox" name="tag" value="${k}"><span>${esc(l)}</span></label>`).join('')}
          </div>
        </fieldset>
        <p class="account-error" role="alert"></p>
        <div class="factions">
          <button type="submit" class="btn btn-primary">Opublikuj wątek</button>
          <button type="button" class="btn btn-ghost" data-td-close>Anuluj</button>
        </div>
      </div>
    </form>`;
  document.body.appendChild(formDialog);
  formDialog.addEventListener('click', (e) => {
    if (e.target === formDialog || e.target.closest('[data-td-close]')) formDialog.close();
  });
  formDialog.addEventListener('change', (e) => {
    if (e.target.name === 'tag') syncTagPicks();
  });
  formDialog.addEventListener('input', () => {
    $('.account-error', formDialog).textContent = '';
  });
  formDialog.addEventListener('submit', submitThread);
}

function syncTagPicks() {
  const boxes = $$('input[name="tag"]', formDialog);
  const count = boxes.filter((b) => b.checked).length;
  boxes.forEach((b) => {
    b.disabled = !b.checked && count >= MAX_TAGS;
  });
}

function openThreadForm(t) {
  if (!formDialog) buildForm();
  editing = t;
  $('#tdTitle', formDialog).textContent = t ? 'Edytuj wątek' : 'Nowy wątek';
  $('button[type="submit"]', formDialog).textContent = t ? 'Zapisz zmiany' : 'Opublikuj wątek';
  $('#tTitle', formDialog).value = t ? t.title : '';
  $('#tText', formDialog).value = t ? t.text : '';
  $$('input[name="tag"]', formDialog).forEach((b) => {
    b.checked = Boolean(t && t.tags.includes(b.value));
  });
  // Przy nowym wątku z wybranym filtrem podpowiadamy ten tag.
  if (!t && filter.tag) $(`input[name="tag"][value="${filter.tag}"]`, formDialog).checked = true;
  syncTagPicks();
  $('.account-error', formDialog).textContent = '';
  formDialog.showModal();
  $('#tTitle', formDialog).focus();
}

async function submitThread(e) {
  e.preventDefault();
  const error = $('.account-error', formDialog);
  const btn = $('button[type="submit"]', formDialog);
  const title = $('#tTitle', formDialog).value.replace(/\s+/g, ' ').trim();
  const text = $('#tText', formDialog).value.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  const tags = $$('input[name="tag"]:checked', formDialog).map((b) => b.value).slice(0, MAX_TAGS);
  if (title.length < 5) {
    error.textContent = 'Tytuł musi mieć co najmniej 5 znaków.';
    $('#tTitle', formDialog).focus();
    return;
  }
  if (text.length < 10) {
    error.textContent = 'Treść musi mieć co najmniej 10 znaków.';
    $('#tText', formDialog).focus();
    return;
  }
  if (!tags.length) {
    error.textContent = 'Wybierz co najmniej jeden tag.';
    return;
  }
  if (!me) {
    error.textContent = 'Zaloguj się, żeby założyć wątek.';
    return;
  }
  const { F, db } = fb;
  btn.disabled = true;
  try {
    if (editing) {
      await F.updateDoc(F.doc(db, 'watki', editing.id), { title, text, tags, editedAt: F.serverTimestamp() });
      formDialog.close();
      toast('Zapisano zmiany.');
      return;
    }
    const name = await authorName();
    const ref = F.doc(F.collection(db, 'watki'));
    const batch = F.writeBatch(db);
    batch.set(F.doc(db, 'uzytkownicy', me.uid), { watek: F.serverTimestamp() }, { merge: true });
    batch.set(ref, {
      title,
      text,
      tags,
      authorUid: me.uid,
      authorName: name,
      createdAt: F.serverTimestamp(),
      lastAt: F.serverTimestamp(),
      lastName: '',
      lastReply: '',
      replies: 0,
      closed: false,
      pinned: false,
    });
    await batch.commit();
    formDialog.close();
    location.hash = ref.id;
  } catch (err) {
    console.error(err);
    error.textContent = err && err.code === 'permission-denied' && !editing
      ? 'Nowy wątek możesz założyć raz na 2 minuty. Spróbuj za chwilę.'
      : 'Nie udało się zapisać. Sprawdź połączenie i spróbuj jeszcze raz.';
  } finally {
    btn.disabled = false;
  }
}

/* ---------- Komunikaty ---------- */

const toastEl = $('#toast');
let toastTimer = null;

function toast(text) {
  toastEl.textContent = text;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.hidden = true;
  }, 5000);
}
