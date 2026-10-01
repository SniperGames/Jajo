/* Jajo: panel moderacji przepisów od czytelników. */
import {
  connect, configured, signIn, signInError, toRecipe, isAdmin, isMember, watchUser, socialReady, relTime, avatarHtml,
} from './jajo-firebase.js';

const app = document.getElementById('modApp');
const NBSP = ' ';
const CAT = { sniadania: 'Śniadanie', obiady: 'Obiad', przekaski: 'Przekąska', desery: 'Deser' };
const DIFF = ['', 'łatwe', 'średnie', 'wymagające'];
const EGG = { whole: 'jajko', yolk: 'żółtko', white: 'białko' };
const RECIPE_TABS = [['pending', 'Oczekujące'], ['approved', 'Opublikowane'], ['rejected', 'Odrzucone']];
let TABS = RECIPE_TABS;
const OFFICIAL = Object.fromEntries((window.JAJO_PRZEPISY || []).map((r) => [r.id, r.name]));
const recipeNames = { ...OFFICIAL };
let comments = [];
const REASONS = [
  'To nie jest przepis z jajkami.',
  'Przepis jest niepełny: brakuje składników albo kroków.',
  'Zdjęcie nie pasuje do przepisu.',
  'Treść jest nie na temat albo niestosowna.',
];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const when = (ms) => new Date(ms).toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'short' });

let fb = null;
let user = null;
let admin = false;
let tab = 'pending';
let items = [];
const counts = {};

(async function start() {
  fb = await connect();
  if (!fb) {
    app.innerHTML = configured
      ? '<p class="note">Nie udało się połączyć z Firebase. Sprawdź internet i odśwież stronę.</p>'
      : '<p class="note">Firebase nie jest jeszcze podłączony. Instrukcja jest w pliku FIREBASE.md w repozytorium.</p>';
    return;
  }
  if (await socialReady(fb)) TABS = [...RECIPE_TABS, ['komentarze', 'Komentarze']];
  watchUser(fb, async (u) => {
    user = isMember(u) ? u : null;
    admin = user ? await isAdmin(fb, user.uid) : false;
    if (admin) await load();
    render();
  });
})();

async function load() {
  const { F, db } = fb;
  const col = F.collection(db, 'przepisy');
  const countQuery = (key) => (key === 'komentarze'
    ? F.getCountFromServer(F.collection(db, 'komentarze'))
    : F.getCountFromServer(F.query(col, F.where('status', '==', key))));
  try {
    const sizes = await Promise.all(TABS.map(([key]) => countQuery(key)));
    TABS.forEach(([key], i) => { counts[key] = sizes[i].data().count; });
    if (tab === 'komentarze') {
      const snap = await F.getDocs(F.query(F.collection(db, 'komentarze'), F.orderBy('createdAt', 'desc'), F.limit(60)));
      comments = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        .map((c) => ({ ...c, at: c.createdAt && c.createdAt.toMillis ? c.createdAt.toMillis() : Date.now() }));
      await Promise.all([...new Set(comments.map((c) => c.recipe))].filter((k) => !recipeNames[k] && k.startsWith('c-')).map(async (k) => {
        try {
          const d = await F.getDoc(F.doc(db, 'przepisy', k.slice(2)));
          recipeNames[k] = d.exists() ? d.data().name : 'Usunięty przepis';
        } catch {
          recipeNames[k] = 'Przepis';
        }
      }));
      items = [];
      return;
    }
    const snap = await F.getDocs(F.query(col, F.where('status', '==', tab)));
    items = snap.docs.map((d) => toRecipe(fb, d.id, d.data())).sort((a, b) => b.createdAt - a.createdAt);
  } catch (err) {
    console.error(err);
    items = [];
    app.dataset.error = 'Nie udało się wczytać przepisów. Odśwież stronę.';
  }
}

function render() {
  if (!user) {
    app.innerHTML = `
      <div class="mod-box">
        <p>Zaloguj się kontem Google, żeby moderować przepisy.</p>
        <button type="button" class="btn btn-primary" data-act="in">Zaloguj się</button>
        <p class="account-error" role="alert"></p>
      </div>`;
    return;
  }
  if (!admin) {
    app.innerHTML = `
      <div class="mod-box">
        <p>Zalogowano jako <b>${esc(user.displayName || user.email || 'Ty')}</b>, ale to konto nie jest jeszcze moderatorem.</p>
        <p>Twój identyfikator:</p>
        <p class="mod-uid"><code id="uid">${esc(user.uid)}</code> <button type="button" class="chip" data-act="copy">Kopiuj</button></p>
        <ol class="mod-steps">
          <li>Otwórz <b>console.firebase.google.com</b> i${NBSP}swój projekt.</li>
          <li>Wejdź w${NBSP}<b>Firestore Database → Dane</b> i${NBSP}kliknij <b>Rozpocznij kolekcję</b>.</li>
          <li>Jako ID kolekcji wpisz <code>admins</code>.</li>
          <li>Jako ID dokumentu wklej identyfikator z${NBSP}góry. Dodaj pole <code>rola</code> o${NBSP}wartości <code>admin</code> i${NBSP}zapisz.</li>
          <li>Odśwież tę stronę.</li>
        </ol>
        <button type="button" class="btn btn-ghost" data-act="out">Wyloguj</button>
      </div>`;
    return;
  }
  app.innerHTML = `
    <div class="mod-bar">
      <div class="rfilter-chips" role="tablist" aria-label="Stan przepisów">
        ${TABS.map(([key, label]) => `<button type="button" class="chip" role="tab" aria-selected="${key === tab}" data-tab="${key}">${label}<span class="chip-count">${counts[key] ?? 0}</span></button>`).join('')}
      </div>
      <p class="account-who"><span>Moderator: <b>${esc(user.displayName || 'Ty')}</b></span><button type="button" class="linklike" data-act="out">Wyloguj</button></p>
    </div>
    ${app.dataset.error ? `<p class="account-error">${esc(app.dataset.error)}</p>` : ''}
    ${tab === 'komentarze' ? commentsHtml() : items.length ? items.map(itemHtml).join('') : `<p class="note mod-empty">${{ pending: 'Nic nie czeka na moderację.', approved: 'Nie ma jeszcze opublikowanych przepisów od czytelników.', rejected: 'Nie ma odrzuconych przepisów.' }[tab]}</p>`}`;
  delete app.dataset.error;
  items.filter((r) => r.loadPhoto).forEach((r) => {
    r.loadPhoto().then((src) => {
      const img = app.querySelector(`.mod-item[data-id="${r.docId}"] .mod-photo img`);
      if (img && src) img.src = src;
    }).catch(() => {});
  });
}

function commentsHtml() {
  if (!comments.length) return '<p class="note mod-empty">Nie ma jeszcze komentarzy.</p>';
  return `
    <p class="fhint">Najnowsze komentarze ze wszystkich przepisów. Komentarze pojawiają się od razu, a${NBSP}tutaj możesz usunąć niestosowne.</p>
    <ul class="clist mod-comments">${comments.map((c) => `
      <li class="comment" data-cid="${esc(c.id)}">
        ${avatarHtml(c.anon ? '?' : c.authorName, c.anon ? '' : c.authorUid)}
        <div class="c-body">
          <p class="c-meta">
            ${c.anon ? '<span class="c-name is-guest">Niezalogowany użytkownik</span>' : `<a class="c-name" href="profil.html#${esc(c.authorUid)}">${esc(c.authorName)}</a>`}
            <span class="c-time">${relTime(c.at)}</span>
            <a class="c-time" href="przepisy.html#${esc(c.recipe)}">${esc(recipeNames[c.recipe] || c.recipe)}</a>
          </p>
          <p class="c-text">${esc(c.text)}</p>
        </div>
        <button type="button" class="c-del" data-cdel>Usuń</button>
      </li>`).join('')}</ul>`;
}

function amount(it) {
  if (it.t) return it.t;
  if (typeof it.q !== 'number') return '';
  return String(it.q).replace('.', ',') + NBSP + (it.u || '');
}

function itemHtml(r) {
  const actions = {
    pending: `
      <button type="button" class="btn btn-primary" data-do="approve">Zatwierdź</button>
      <button type="button" class="btn btn-ghost" data-do="reject-open">Odrzuć…</button>`,
    approved: `
      <a class="btn btn-ghost" href="przepisy.html#${esc(r.id)}">Zobacz na stronie</a>
      <button type="button" class="btn btn-ghost" data-do="reject-open">Cofnij publikację…</button>
      <button type="button" class="btn btn-ghost mod-del" data-do="delete">Usuń</button>`,
    rejected: `
      <button type="button" class="btn btn-ghost" data-do="approve">Zatwierdź mimo to</button>
      <button type="button" class="btn btn-ghost mod-del" data-do="delete">Usuń</button>`,
  }[r.status] || '';
  return `
    <article class="mod-item" data-id="${esc(r.docId)}">
      <div class="mod-photo">${r.photo ? `<img src="${esc(r.photo.file)}" alt="Zdjęcie przepisu ${esc(r.name)}">` : '<span>Bez zdjęcia</span>'}</div>
      <div class="mod-body">
        <p class="eyebrow">${CAT[r.category] || ''} · od ${esc(r.authorName)} · ${when(r.createdAt)}</p>
        <h2>${esc(r.name)}</h2>
        <p class="mod-intro">${esc(r.intro)}</p>
        <p class="mod-meta">
          <span>Czas: ${r.time}${NBSP}min</span>
          ${r.wait ? `<span>Czekanie: ${esc(r.wait)}</span>` : ''}
          <span>Porcje: ${r.servings}</span>
          <span>Trudność: ${DIFF[r.difficulty] || ''}</span>
        </p>
        ${r.status === 'rejected' && r.rejectReason ? `<p class="rd-status" data-status="rejected">Powód odrzucenia: ${esc(r.rejectReason)}</p>` : ''}
        <div class="mod-cols">
          <div>
            <h3>Składniki</h3>
            <ul>${r.ingredients.map((it) => `<li><span>${esc(it.n)}${it.egg ? ` <span class="pill" data-status="pending">${EGG[it.egg]}</span>` : ''}</span><b>${esc(amount(it))}</b></li>`).join('')}</ul>
          </div>
          <div>
            <h3>Przygotowanie</h3>
            <ol>${r.steps.map((s) => typeof s === 'string' ? `<li>${esc(s)}</li>` : `<li>${esc(s.t)} <span class="pill">minutnik ${Math.round(s.timer / 6) / 10}${NBSP}min</span></li>`).join('')}</ol>
          </div>
        </div>
        ${r.tip ? `<p class="mod-tip"><b>Wskazówka:</b> ${esc(r.tip)}</p>` : ''}
        <div class="mod-actions">${actions}</div>
        <div class="mod-reject" hidden>
          <p class="fhint">Powód zobaczy autor w${NBSP}„Moje przepisy”.</p>
          <div class="fadd">${REASONS.map((t) => `<button type="button" class="chip" data-reason="${esc(t)}">${esc(t)}</button>`).join('')}</div>
          <textarea class="mod-reason" rows="2" maxlength="300" aria-label="Powód odrzucenia">${r.status === 'approved' ? 'Ukryte przez moderatora.' : ''}</textarea>
          <div class="mod-actions">
            <button type="button" class="btn btn-primary" data-do="reject">${r.status === 'approved' ? 'Cofnij publikację' : 'Odrzuć przepis'}</button>
            <button type="button" class="btn btn-ghost" data-do="reject-close">Anuluj</button>
          </div>
        </div>
        <p class="account-error" role="alert"></p>
      </div>
    </article>`;
}

app.addEventListener('click', async (e) => {
  const act = e.target.closest('[data-act]');
  if (act) {
    if (act.dataset.act === 'in') {
      try {
        await signIn(fb);
      } catch (err) {
        const box = app.querySelector('.account-error');
        if (box) box.textContent = signInError(err);
      }
    } else if (act.dataset.act === 'out') {
      await fb.A.signOut(fb.auth);
    } else if (act.dataset.act === 'copy') {
      const text = user.uid;
      try {
        await navigator.clipboard.writeText(text);
        act.textContent = 'Skopiowano';
      } catch {
        const range = document.createRange();
        range.selectNodeContents(document.getElementById('uid'));
        getSelection().removeAllRanges();
        getSelection().addRange(range);
        act.textContent = 'Zaznaczono, skopiuj';
      }
    }
    return;
  }

  const tabBtn = e.target.closest('[data-tab]');
  if (tabBtn) {
    tab = tabBtn.dataset.tab;
    await load();
    render();
    return;
  }

  const reason = e.target.closest('[data-reason]');
  if (reason) {
    reason.closest('.mod-reject').querySelector('.mod-reason').value = reason.dataset.reason;
    return;
  }

  const cdel = e.target.closest('[data-cdel]');
  if (cdel) {
    if (!cdel.classList.contains('is-confirm')) {
      cdel.classList.add('is-confirm');
      cdel.textContent = 'Na pewno?';
      return;
    }
    cdel.disabled = true;
    try {
      await fb.F.deleteDoc(fb.F.doc(fb.db, 'komentarze', cdel.closest('.comment').dataset.cid));
      await load();
      render();
    } catch (err) {
      console.error(err);
      cdel.disabled = false;
      cdel.textContent = 'Nie udało się';
    }
    return;
  }

  const btn = e.target.closest('[data-do]');
  if (!btn) return;
  const article = btn.closest('.mod-item');
  const r = items.find((it) => it.docId === article.dataset.id);
  const rejectBox = article.querySelector('.mod-reject');
  const error = article.querySelector('.account-error');
  const { F, db } = fb;
  const ref = F.doc(db, 'przepisy', r.docId);

  if (btn.dataset.do === 'reject-open') {
    rejectBox.hidden = false;
    rejectBox.querySelector('textarea').focus();
    return;
  }
  if (btn.dataset.do === 'reject-close') {
    rejectBox.hidden = true;
    return;
  }
  if (btn.dataset.do === 'delete' && !btn.classList.contains('is-confirm')) {
    btn.classList.add('is-confirm');
    btn.textContent = 'Na pewno usunąć na zawsze?';
    return;
  }

  btn.disabled = true;
  error.textContent = '';
  try {
    if (btn.dataset.do === 'approve') {
      await F.updateDoc(ref, { status: 'approved', rejectReason: '', reviewedAt: F.serverTimestamp() });
    } else if (btn.dataset.do === 'reject') {
      const text = rejectBox.querySelector('textarea').value.replace(/\s+/g, ' ').trim().slice(0, 300);
      if (!text) {
        error.textContent = 'Wpisz albo wybierz powód.';
        btn.disabled = false;
        return;
      }
      await F.updateDoc(ref, { status: 'rejected', rejectReason: text, reviewedAt: F.serverTimestamp() });
    } else if (btn.dataset.do === 'delete') {
      const batch = F.writeBatch(db);
      batch.delete(ref);
      if (r.hasPhoto) batch.delete(F.doc(db, 'zdjecia', r.docId));
      await batch.commit();
    }
    await load();
    render();
  } catch (err) {
    console.error(err);
    btn.disabled = false;
    error.textContent = 'Nie udało się zapisać zmiany. Sprawdź połączenie i spróbuj jeszcze raz.';
  }
});
