/* Jajo: polubienia („Smakuje mi”) i komentarze pod przepisami. */
import {
  connect, signIn, signInError, ensureGuest, ensureProfile, isMember, isAdmin,
  watchUser, socialReady, relTime, avatarHtml, avatarFor,
} from './jajo-firebase.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const NBSP = ' ';
const GUEST = 'Niezalogowany użytkownik';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const plural = (n, one, few, many) => {
  if (n === 1) return one;
  const d = n % 10;
  const h = n % 100;
  return d >= 2 && d <= 4 && (h < 12 || h > 14) ? few : many;
};
const EGG = '<svg class="like-egg" viewBox="0 0 20 26" aria-hidden="true"><path d="M10 1C15 1 18 9 18 16c0 5.5-3.5 9-8 9s-8-3.5-8-9C2 9 5 1 10 1z"/></svg>';

let fb = null;
let user = null;
let admin = false;
let myName = '';
const counts = new Map();
const liked = new Set();
const busy = new Set();
const commentCounts = new Map();

(async function start() {
  fb = await connect();
  if (!fb || !(await socialReady(fb))) return;
  document.documentElement.classList.add('has-social');
  await loadCounts();
  paintLikes();
  document.addEventListener('jajo:karty', paintLikes);
  document.addEventListener('jajo:okno', (e) => openComments(e.detail.id));
  const open = $('#recipeDialog[open] .rd-comments');
  if (open) openComments(open.dataset.commentsKey);

  watchUser(fb, async (u) => {
    user = u;
    liked.clear();
    admin = false;
    myName = '';
    if (u) {
      const { F, db } = fb;
      try {
        const snap = await F.getDocs(F.query(F.collection(db, 'polubienia'), F.where('uid', '==', u.uid)));
        snap.forEach((d) => liked.add(d.data().key));
      } catch (err) {
        console.error(err);
      }
      if (isMember(u)) {
        const [profile, adm] = await Promise.all([ensureProfile(fb, u), isAdmin(fb, u.uid)]);
        myName = (profile && profile.name) || (u.displayName || '').split(' ')[0] || '';
        admin = adm;
      }
    }
    paintLikes();
    const dialogComments = $('#recipeDialog[open] .rd-comments');
    if (dialogComments) renderForm(dialogComments);
    $$('.comment').forEach(syncDeleteButton);
  });
})();

/* ---------- Polubienia ---------- */

async function loadCounts() {
  const { F, db } = fb;
  try {
    const snap = await F.getDocs(F.collection(db, 'reakcje'));
    snap.forEach((d) => counts.set(d.id, d.data().likes || 0));
  } catch (err) {
    console.error(err);
  }
}

function likeLabel(n) {
  return n + NBSP + plural(n, 'osobie smakuje', 'osobom smakuje', 'osobom smakuje');
}

function paintLikes() {
  $$('[data-like-key]').forEach((slot) => {
    const key = slot.dataset.likeKey;
    const n = Math.max(0, counts.get(key) || 0);
    const on = liked.has(key);
    const big = slot.dataset.big === '1';
    const comments = commentCounts.get(key);
    slot.innerHTML = `
      <button type="button" class="like-btn${on ? ' is-liked' : ''}${big ? ' like-big' : ''}" data-like="${esc(key)}" aria-pressed="${on}"
        aria-label="${on ? 'Cofnij: smakuje mi' : 'Smakuje mi'}. ${esc(likeLabel(n))}"${busy.has(key) ? ' disabled' : ''}>
        ${EGG}<span class="like-n">${big ? (on ? 'Smakuje Ci' : 'Smakuje mi') + ' · ' : ''}${n}</span>
      </button>
      ${big ? `<a class="comments-link" href="#rdComments" data-scroll-comments>Komentarze${comments === undefined ? '' : ' (' + comments + ')'}</a>` : ''}`;
  });
}

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-like]');
  if (btn) {
    e.preventDefault();
    e.stopPropagation();
    toggleLike(btn.dataset.like);
    return;
  }
  const jump = e.target.closest('[data-scroll-comments]');
  if (jump) {
    e.preventDefault();
    e.stopPropagation();
    const target = $('#recipeDialog .rd-comments');
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}, true);

async function toggleLike(key) {
  if (busy.has(key)) return;
  busy.add(key);
  const was = liked.has(key);
  // Od razu pokazujemy zmianę, a potem zapisujemy ją w bazie.
  if (was) liked.delete(key); else liked.add(key);
  counts.set(key, (counts.get(key) || 0) + (was ? -1 : 1));
  paintLikes();
  try {
    const u = user || (await ensureGuest(fb));
    const { F, db } = fb;
    const cRef = F.doc(db, 'reakcje', key);
    const lRef = F.doc(db, 'polubienia', u.uid + '_' + key);
    const result = await F.runTransaction(db, async (tx) => {
      const [c, l] = [await tx.get(cRef), await tx.get(lRef)];
      const cur = c.exists() ? c.data().likes : 0;
      if (l.exists()) {
        tx.delete(lRef);
        tx.set(cRef, { likes: cur - 1 });
        return { liked: false, likes: cur - 1 };
      }
      tx.set(lRef, { uid: u.uid, key, at: F.serverTimestamp() });
      tx.set(cRef, { likes: cur + 1 });
      return { liked: true, likes: cur + 1 };
    });
    if (result.liked) liked.add(key); else liked.delete(key);
    counts.set(key, result.likes);
  } catch (err) {
    console.error(err);
    if (was) liked.add(key); else liked.delete(key);
    counts.set(key, (counts.get(key) || 0) + (was ? 1 : -1));
    note(err && err.code === 'auth/operation-not-allowed'
      ? 'Polubienia bez logowania są chwilowo wyłączone. Zaloguj się kontem Google, żeby polubić przepis.'
      : 'Nie udało się zapisać polubienia. Sprawdź połączenie i spróbuj jeszcze raz.');
  } finally {
    busy.delete(key);
    paintLikes();
  }
}

/* Krótki komunikat w rogu ekranu (ten sam, którego używa minutnik). */
function note(text) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = text;
  if (typeof el.showPopover === 'function') {
    if (el.matches(':popover-open')) el.hidePopover();
    el.showPopover();
    setTimeout(() => el.matches(':popover-open') && el.hidePopover(), 6000);
  } else {
    el.hidden = false;
    setTimeout(() => { el.hidden = true; }, 6000);
  }
}

/* ---------- Komentarze ---------- */

async function openComments(key) {
  const box = $(`#recipeDialog .rd-comments[data-comments-key="${CSS.escape(key)}"]`);
  if (!box) return;
  box.innerHTML = `
    <div class="rd-comments-head">
      <h3 id="rdCommentsTitle">Komentarze</h3>
    </div>
    <form class="cform" novalidate></form>
    <ul class="clist" aria-live="polite"><li class="clist-empty">Wczytuję komentarze…</li></ul>`;
  renderForm(box);
  await loadComments(box);
}

function renderForm(box) {
  const form = $('.cform', box);
  if (!form) return;
  const member = isMember(user);
  const draft = $('textarea', form) ? $('textarea', form).value : '';
  form.innerHTML = `
    <label class="sr-only" for="cText">Twój komentarz</label>
    <textarea id="cText" rows="3" maxlength="600" placeholder="Jak wyszło? Co zmieniłeś albo zmieniłaś? Podziel się wrażeniami.">${esc(draft)}</textarea>
    <div class="cform-foot">
      <p class="fhint">${member
        ? `Piszesz jako <b>${esc(myName || 'Ty')}</b>.`
        : `Piszesz jako <b>${GUEST}</b>. <button type="button" class="linklike" data-c-login>Zaloguj się</button>, żeby podpisać komentarz imieniem.`}</p>
      <button type="submit" class="btn btn-primary">Dodaj komentarz</button>
    </div>
    <p class="account-error" role="alert"></p>`;
}

async function loadComments(box) {
  const key = box.dataset.commentsKey;
  const { F, db } = fb;
  const list = $('.clist', box);
  try {
    const snap = await F.getDocs(F.query(F.collection(db, 'komentarze'), F.where('recipe', '==', key), F.limit(300)));
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .map((c) => ({ ...c, at: c.createdAt && c.createdAt.toMillis ? c.createdAt.toMillis() : Date.now() }))
      .sort((a, b) => b.at - a.at);
    commentCounts.set(key, items.length);
    paintLikes();
    $('h3', box).innerHTML = `Komentarze <span class="count">${items.length}</span>`;
    list.innerHTML = items.length
      ? items.map(commentHtml).join('')
      : '<li class="clist-empty">Jeszcze nikt nie skomentował. Napisz pierwszy komentarz!</li>';
    $$('.comment', list).forEach(syncDeleteButton);
    // Zdjęcia profilowe autorów dociągamy po wyświetleniu listy.
    [...new Set(items.filter((c) => !c.anon).map((c) => c.authorUid))].forEach(async (author) => {
      const av = await avatarFor(fb, author);
      if (!av.src) return;
      $$('.comment', list).filter((li) => li.dataset.author === author).forEach((li) => {
        const el = $('.avatar', li);
        if (el) el.outerHTML = avatarHtml(av.name, author, '', av.src);
      });
    });
  } catch (err) {
    console.error(err);
    list.innerHTML = '<li class="clist-empty">Nie udało się wczytać komentarzy. Odśwież stronę za chwilę.</li>';
  }
}

function commentHtml(c) {
  const name = c.anon ? GUEST : c.authorName;
  const who = c.anon
    ? `<span class="c-name is-guest">${GUEST}</span>`
    : `<a class="c-name" href="profil.html#${esc(c.authorUid)}">${esc(name)}</a>`;
  return `
    <li class="comment" data-id="${esc(c.id)}" data-author="${esc(c.authorUid)}">
      ${avatarHtml(c.anon ? '?' : name, c.anon ? '' : c.authorUid)}
      <div class="c-body">
        <p class="c-meta">${who}<span class="c-time">${relTime(c.at)}</span></p>
        <p class="c-text">${esc(c.text)}</p>
      </div>
      <button type="button" class="c-del" data-c-del hidden>Usuń</button>
    </li>`;
}

function syncDeleteButton(li) {
  const btn = $('[data-c-del]', li);
  if (btn) btn.hidden = !(user && (li.dataset.author === user.uid || admin));
}

document.addEventListener('submit', async (e) => {
  const form = e.target.closest('.cform');
  if (!form) return;
  e.preventDefault();
  const box = form.closest('.rd-comments');
  const area = $('textarea', form);
  const error = $('.account-error', form);
  const btn = $('button[type="submit"]', form);
  const text = area.value.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  error.textContent = '';
  if (text.length < 2) {
    error.textContent = 'Napisz coś więcej niż jedną literę.';
    return;
  }
  if (!isMember(user) && /https?:|www\./i.test(text)) {
    error.textContent = 'Niezalogowani nie mogą wstawiać linków. Usuń link albo zaloguj się.';
    return;
  }
  btn.disabled = true;
  btn.textContent = 'Wysyłam…';
  try {
    const u = user || (await ensureGuest(fb));
    const member = isMember(u);
    const { F, db } = fb;
    const batch = F.writeBatch(db);
    batch.set(F.doc(db, 'uzytkownicy', u.uid), { komentarz: F.serverTimestamp() }, { merge: true });
    batch.set(F.doc(F.collection(db, 'komentarze')), {
      recipe: box.dataset.commentsKey,
      text,
      authorUid: u.uid,
      authorName: member ? (myName || 'Kucharz').slice(0, 40) : '',
      anon: !member,
      createdAt: F.serverTimestamp(),
    });
    await batch.commit();
    area.value = '';
    await loadComments(box);
  } catch (err) {
    console.error(err);
    error.textContent = err && err.code === 'permission-denied'
      ? 'Kolejny komentarz możesz dodać za chwilę. Jedna osoba może pisać najwyżej raz na 30 sekund.'
      : err && err.code === 'auth/operation-not-allowed'
        ? 'Komentarze bez logowania są chwilowo wyłączone. Zaloguj się, żeby skomentować.'
        : 'Nie udało się dodać komentarza. Sprawdź połączenie i spróbuj jeszcze raz.';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Dodaj komentarz';
  }
});

document.addEventListener('click', async (e) => {
  const login = e.target.closest('[data-c-login]');
  if (login) {
    try {
      await signIn(fb);
    } catch (err) {
      const box = login.closest('.cform');
      const msg = signInError(err);
      if (box && msg) $('.account-error', box).textContent = msg;
    }
    return;
  }
  const del = e.target.closest('[data-c-del]');
  if (!del) return;
  if (!del.classList.contains('is-confirm')) {
    del.classList.add('is-confirm');
    del.textContent = 'Na pewno?';
    return;
  }
  const li = del.closest('.comment');
  del.disabled = true;
  try {
    const { F, db } = fb;
    await F.deleteDoc(F.doc(db, 'komentarze', li.dataset.id));
    const box = li.closest('.rd-comments');
    await loadComments(box);
  } catch (err) {
    console.error(err);
    del.disabled = false;
    del.textContent = 'Nie udało się';
  }
});
