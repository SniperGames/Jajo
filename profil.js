/* Jajo: profil kucharza (czytelnika, który dodaje przepisy i komentuje). */
import {
  connect, configured, signIn, signInError, isMember, watchUser, ensureProfile, forgetProfile,
  socialReady, relTime, avatarHtml, EGG_PREFS, toRecipe,
} from './jajo-firebase.js';

const $ = (sel, root = document) => root.querySelector(sel);
const NBSP = ' ';
const app = $('#profileApp');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const CAT = { sniadania: 'Śniadanie', obiady: 'Obiad', przekaski: 'Przekąska', desery: 'Deser' };
const DIFF = ['', 'łatwe', 'średnie', 'wymagające'];
const OFFICIAL = Object.fromEntries((window.JAJO_PRZEPISY || []).map((r) => [r.id, r.name]));
const EGG_SVG = '<svg class="ei ei-whole" viewBox="0 0 20 26" aria-hidden="true"><path d="M10 1C15 1 18 9 18 16c0 5.5-3.5 9-8 9s-8-3.5-8-9C2 9 5 1 10 1z"/></svg>';

let fb = null;
let me = null;
let uid = location.hash.slice(1);
let renderToken = 0;

(async function start() {
  fb = await connect();
  if (!fb) {
    app.innerHTML = `<p class="note profile-loading">${configured ? 'Nie udało się połączyć z bazą. Odśwież stronę za chwilę.' : 'Profile ruszą wkrótce.'}</p>`;
    return;
  }
  if (!(await socialReady(fb))) {
    app.innerHTML = '<p class="note profile-loading">Profile ruszą wkrótce.</p>';
    return;
  }
  watchUser(fb, async (u) => {
    me = isMember(u) ? u : null;
    if (me) await ensureProfile(fb, me);
    if (!uid && me) {
      uid = me.uid;
      history.replaceState(null, '', '#' + uid);
    }
    render();
  });
  window.addEventListener('hashchange', () => {
    uid = location.hash.slice(1);
    render();
  });
})();

async function render() {
  const token = ++renderToken;
  if (!uid) {
    app.innerHTML = `
      <div class="mod-box profile-login">
        <h1 class="profile-name">Twój profil</h1>
        <p>Zaloguj się kontem Google, żeby zobaczyć swój profil, przepisy i komentarze.</p>
        <button type="button" class="btn btn-primary" data-login>Zaloguj się</button>
        <p class="account-error" role="alert"></p>
      </div>`;
    return;
  }
  if (!/^[A-Za-z0-9]{6,128}$/.test(uid)) {
    app.innerHTML = '<p class="note profile-loading">Nie znaleźliśmy tego profilu.</p>';
    return;
  }
  const { F, db } = fb;
  let data;
  try {
    const [pSnap, recSnap, commCount, commSnap] = await Promise.all([
      F.getDoc(F.doc(db, 'profile', uid)),
      F.getDocs(F.query(F.collection(db, 'przepisy'), F.where('authorUid', '==', uid), F.where('status', '==', 'approved'))),
      F.getCountFromServer(F.query(F.collection(db, 'komentarze'), F.where('authorUid', '==', uid))),
      F.getDocs(F.query(F.collection(db, 'komentarze'), F.where('authorUid', '==', uid), F.limit(60))),
    ]);
    const recipes = recSnap.docs.map((d) => toRecipe(fb, d.id, d.data())).sort((a, b) => b.createdAt - a.createdAt);
    const likes = new Map();
    const keys = recipes.map((r) => r.id);
    for (let i = 0; i < keys.length; i += 30) {
      const snap = await F.getDocs(F.query(F.collection(db, 'reakcje'), F.where(F.documentId(), 'in', keys.slice(i, i + 30))));
      snap.forEach((d) => likes.set(d.id, d.data().likes || 0));
    }
    const comments = commSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .filter((c) => !c.anon)
      .map((c) => ({ ...c, at: c.createdAt && c.createdAt.toMillis ? c.createdAt.toMillis() : Date.now() }))
      .sort((a, b) => b.at - a.at)
      .slice(0, 5);
    const names = { ...OFFICIAL, ...Object.fromEntries(recipes.map((r) => [r.id, r.name])) };
    await Promise.all(comments.filter((c) => !names[c.recipe] && c.recipe.startsWith('c-')).map(async (c) => {
      try {
        const s = await F.getDoc(F.doc(db, 'przepisy', c.recipe.slice(2)));
        if (s.exists()) names[c.recipe] = s.data().name;
      } catch {
        /* przepis niedostępny */
      }
    }));
    data = { profile: pSnap.exists() ? pSnap.data() : null, recipes, likes, commentsTotal: commCount.data().count, comments, names };
  } catch (err) {
    console.error(err);
    if (token === renderToken) app.innerHTML = '<p class="note profile-loading">Nie udało się wczytać profilu. Odśwież stronę za chwilę.</p>';
    return;
  }
  if (token !== renderToken) return;

  const own = Boolean(me && me.uid === uid);
  if (!data.profile) {
    app.innerHTML = `<p class="note profile-loading">Nie znaleźliśmy tego profilu. Mógł zostać usunięty.</p>`;
    return;
  }
  const p = data.profile;
  const totalLikes = data.recipes.reduce((sum, r) => sum + (data.likes.get(r.id) || 0), 0);
  const since = p.joinedAt && p.joinedAt.toDate
    ? p.joinedAt.toDate().toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'dziś';
  document.title = `${p.name} – profil kucharza – Jajo`;

  app.innerHTML = `
    <header class="profile-head">
      ${avatarHtml(p.name, uid, 'xl')}
      <div class="profile-id">
        <p class="eyebrow">${own ? 'Twój profil' : 'Profil kucharza'}</p>
        <h1 class="profile-name">${esc(p.name)}</h1>
        <p class="profile-since">Na Jajo od ${esc(since)}</p>
        ${p.egg && EGG_PREFS[p.egg] ? `<p class="profile-egg">${EGG_SVG}Ulubione jajko: <b>${EGG_PREFS[p.egg]}</b></p>` : ''}
        ${p.bio ? `<p class="profile-bio">${esc(p.bio)}</p>` : own ? '<p class="profile-bio is-empty">Dodaj kilka słów o sobie, na przykład co najchętniej gotujesz z jajek.</p>' : ''}
        ${own ? `
          <div class="profile-actions">
            <button type="button" class="btn btn-ghost" data-edit>Edytuj profil</button>
            <button type="button" class="linklike" data-out>Wyloguj</button>
          </div>` : ''}
      </div>
    </header>

    ${own ? editFormHtml(p) : ''}

    <dl class="profile-stats">
      <div><dt>Przepisy</dt><dd>${data.recipes.length}</dd></div>
      <div><dt>Smakuje innym</dt><dd>${totalLikes}</dd></div>
      <div><dt>Komentarze</dt><dd>${data.commentsTotal}</dd></div>
    </dl>

    <section class="profile-section" aria-labelledby="pRecipes">
      <h2 id="pRecipes">Przepisy</h2>
      ${data.recipes.length
        ? `<div class="rgrid">${data.recipes.map((r) => cardHtml(r, data.likes.get(r.id) || 0)).join('')}</div>`
        : `<p class="note">${own ? 'Nie masz jeszcze opublikowanych przepisów. <a href="przepisy.html#od-czytelnikow">Dodaj pierwszy</a>.' : 'Ten kucharz nie ma jeszcze opublikowanych przepisów.'}</p>`}
    </section>

    <section class="profile-section" aria-labelledby="pComments">
      <h2 id="pComments">Ostatnie komentarze</h2>
      ${data.comments.length
        ? `<ul class="clist">${data.comments.map((c) => `
            <li class="comment profile-comment">
              <div class="c-body">
                <p class="c-meta"><a class="c-name" href="przepisy.html#${esc(c.recipe)}">${esc(data.names[c.recipe] || 'Przepis')}</a><span class="c-time">${relTime(c.at)}</span></p>
                <p class="c-text">${esc(c.text.length > 220 ? c.text.slice(0, 220) + '…' : c.text)}</p>
              </div>
            </li>`).join('')}</ul>`
        : '<p class="note">Brak komentarzy.</p>'}
    </section>`;
}

function cardHtml(r, likes) {
  const media = r.photo
    ? `<img src="${esc(r.photo.file)}" alt="${esc(r.name)}" width="480" height="360" loading="lazy" decoding="async">`
    : `<div class="rcard-noimg">${EGG_SVG}</div>`;
  return `
    <article class="rcard">
      <div class="rcard-media">
        ${media}
        <span class="like-slot"><span class="like-btn is-static">${EGG_SVG.replace('ei ei-whole', 'like-egg')}<span class="like-n">${likes}</span></span></span>
      </div>
      <div class="rcard-body">
        <p class="rcard-cat">${CAT[r.category] || ''}</p>
        <h3 class="rcard-title"><a class="rcard-link" href="przepisy.html#${esc(r.id)}">${esc(r.name)}</a></h3>
        <p class="rcard-intro">${esc(r.intro)}</p>
        <p class="rcard-meta"><span>${r.time}${NBSP}min</span><span>${DIFF[r.difficulty] || ''}</span></p>
      </div>
    </article>`;
}

function editFormHtml(p) {
  return `
    <form class="profile-edit rform" id="profileEdit" hidden novalidate>
      <h2>Edytuj profil</h2>
      <div class="fgrid">
        <label class="ffield"><span>Imię lub pseudonim</span><input id="pName" maxlength="40" value="${esc(p.name)}"></label>
        <label class="ffield"><span>Ulubione jajko</span>
          <select id="pEgg">
            <option value="">Bez ulubionego</option>
            ${Object.entries(EGG_PREFS).map(([k, l]) => `<option value="${k}"${k === p.egg ? ' selected' : ''}>${l}</option>`).join('')}
          </select>
        </label>
        <label class="ffield fwide"><span>O mnie <small>(najwyżej 300 znaków)</small></span><textarea id="pBio" rows="3" maxlength="300">${esc(p.bio)}</textarea></label>
      </div>
      <p class="note">Profil jest publiczny. Imię widać też przy Twoich komentarzach i przepisach.</p>
      <p class="account-error" role="alert"></p>
      <div class="factions">
        <button type="submit" class="btn btn-primary">Zapisz</button>
        <button type="button" class="btn btn-ghost" data-edit-cancel>Anuluj</button>
      </div>
    </form>`;
}

app.addEventListener('click', async (e) => {
  if (e.target.closest('[data-login]')) {
    try {
      await signIn(fb);
    } catch (err) {
      const box = $('.account-error', app);
      if (box) box.textContent = signInError(err);
    }
  } else if (e.target.closest('[data-out]')) {
    await fb.A.signOut(fb.auth);
    location.href = 'przepisy.html';
  } else if (e.target.closest('[data-edit]')) {
    const form = $('#profileEdit', app);
    form.hidden = false;
    $('#pName', form).focus();
  } else if (e.target.closest('[data-edit-cancel]')) {
    $('#profileEdit', app).hidden = true;
  }
});

app.addEventListener('submit', async (e) => {
  const form = e.target.closest('#profileEdit');
  if (!form) return;
  e.preventDefault();
  const error = $('.account-error', form);
  const name = $('#pName', form).value.replace(/\s+/g, ' ').trim();
  const bio = $('#pBio', form).value.replace(/[ \t]+/g, ' ').trim();
  const egg = $('#pEgg', form).value;
  if (name.length < 2) {
    error.textContent = 'Imię musi mieć co najmniej 2 znaki.';
    return;
  }
  const btn = $('button[type="submit"]', form);
  btn.disabled = true;
  try {
    const { F, db } = fb;
    await F.updateDoc(F.doc(db, 'profile', uid), { name: name.slice(0, 40), bio: bio.slice(0, 300), egg });
    forgetProfile(uid);
    await render();
  } catch (err) {
    console.error(err);
    error.textContent = 'Nie udało się zapisać profilu. Spróbuj jeszcze raz.';
    btn.disabled = false;
  }
});
