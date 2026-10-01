/* Jajo: przepisy od czytelników (dodawanie, lista, moje przepisy). */
import {
  connect, configured, signIn, signInError, toRecipe, isAdmin, shrinkImage, isMember, watchUser, ensureProfile, socialReady,
} from './jajo-firebase.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const NBSP = ' ';

const UNIT_OPTIONS = ['szt.', 'g', 'ml', 'łyżka', 'łyżeczka', 'szklanka', 'pęczek', 'ząbek', 'szczypta', 'plaster', 'garść'];
const TEXT_AMOUNTS = ['do smaku', 'do podania'];
const EGG_OPTIONS = [['', 'Nie jajko'], ['whole', 'Całe jajka'], ['yolk', 'Żółtka'], ['white', 'Białka']];
const CATS = [['sniadania', 'Śniadanie'], ['obiady', 'Obiad'], ['przekaski', 'Przekąska'], ['desery', 'Deser']];
const DRAFT_KEY = 'jajo:szkic-przepisu';

const grid = $('#communityGrid');
const state = $('#communityState');
const account = $('#account');
const minePanel = $('#mine');

let api = null;
let fb = null;
let user = null;
let admin = false;
let mine = [];
let profileName = '';
let social = false;

function whenRecipesReady() {
  if (window.JAJO_PRZEPISY_API) return Promise.resolve(window.JAJO_PRZEPISY_API);
  return new Promise((resolve) => {
    document.addEventListener('jajo:przepisy-gotowe', () => resolve(window.JAJO_PRZEPISY_API), { once: true });
  });
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const tidy = (s) => String(s || '').replace(/\s+/g, ' ').trim();

/* ---------- Start ---------- */

(async function start() {
  api = await whenRecipesReady();
  fb = await connect();
  if (!fb) {
    renderAccount();
    state.textContent = configured
      ? 'Nie udało się połączyć z bazą przepisów od czytelników. Odśwież stronę za chwilę.'
      : 'Dodawanie przepisów przez czytelników ruszy wkrótce.';
    return;
  }
  // Gość (konto anonimowe od polubień) nie jest tu traktowany jak zalogowany.
  watchUser(fb, async (u) => {
    user = isMember(u) ? u : null;
    profileName = '';
    admin = false;
    if (user) {
      const [profile, adm] = await Promise.all([ensureProfile(fb, user), isAdmin(fb, user.uid)]);
      profileName = (profile && profile.name) || '';
      admin = adm;
    }
    social = await socialReady(fb);
    renderAccount();
    await loadMine();
  });
  await loadCommunity();
})();

/* ---------- Zatwierdzone przepisy czytelników ---------- */

async function loadCommunity() {
  state.textContent = 'Wczytuję przepisy od czytelników…';
  try {
    const { F, db } = fb;
    const snap = await F.getDocs(F.query(F.collection(db, 'przepisy'), F.where('status', '==', 'approved'), F.limit(120)));
    const list = snap.docs.map((d) => toRecipe(fb, d.id, d.data())).sort((a, b) => b.createdAt - a.createdAt);
    api.setCommunity(list, grid);
    state.textContent = list.length
      ? ''
      : 'Jeszcze nikt nie dodał tu przepisu. Twój może być pierwszy!';
  } catch (err) {
    console.error(err);
    state.textContent = 'Nie udało się wczytać przepisów od czytelników. Odśwież stronę za chwilę.';
  }
}

/* ---------- Konto ---------- */

function renderAccount() {
  if (!fb) {
    account.innerHTML = `
      <button class="btn btn-primary" type="button" disabled>Dodaj swój przepis</button>
      <p class="account-note">${configured ? 'Chwilowo niedostępne.' : 'Wkrótce.'}</p>`;
    return;
  }
  if (!user) {
    account.innerHTML = `
      <button class="btn btn-primary" type="button" data-act="add">Dodaj swój przepis</button>
      <p class="account-note">Zalogujesz się kontem Google. Pod przepisem pokażemy tylko podpis, który wybierzesz.</p>
      <p class="account-error" role="alert"></p>`;
    return;
  }
  const pending = mine.filter((r) => r.status === 'pending').length;
  account.innerHTML = `
    <button class="btn btn-primary" type="button" data-act="add">Dodaj swój przepis</button>
    <p class="account-who">
      <span>Zalogowano: <b>${esc(profileName || user.displayName || 'Ty')}</b></span>
      ${social ? `<a class="linklike" href="profil.html#${esc(user.uid)}">Mój profil</a>` : ''}
      <button type="button" class="linklike" data-act="mine" aria-expanded="${!minePanel.hidden}">Moje przepisy (${mine.length})</button>
      ${admin ? '<a class="linklike" href="moderacja.html">Moderacja</a>' : ''}
      <button type="button" class="linklike" data-act="out">Wyloguj</button>
    </p>
    ${pending ? `<p class="account-note">${pending === 1 ? '1 przepis czeka' : pending + ' przepisy czekają'} na akceptację.</p>` : ''}
    <p class="account-error" role="alert"></p>`;
}

account.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const act = btn.dataset.act;
  if (act === 'add') {
    if (!user) {
      try {
        await signIn(fb);
      } catch (err) {
        const msg = signInError(err);
        const box = $('.account-error', account);
        if (box) box.textContent = msg;
        return;
      }
    }
    openForm();
  } else if (act === 'mine') {
    minePanel.hidden = !minePanel.hidden;
    btn.setAttribute('aria-expanded', String(!minePanel.hidden));
    if (!minePanel.hidden) minePanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } else if (act === 'out') {
    minePanel.hidden = true;
    await fb.A.signOut(fb.auth);
  }
});

/* ---------- Moje przepisy ---------- */

async function loadMine() {
  mine = [];
  if (user) {
    try {
      const { F, db } = fb;
      const snap = await F.getDocs(F.query(F.collection(db, 'przepisy'), F.where('authorUid', '==', user.uid)));
      mine = snap.docs.map((d) => toRecipe(fb, d.id, d.data())).sort((a, b) => b.createdAt - a.createdAt);
    } catch (err) {
      console.error(err);
    }
  } else {
    minePanel.hidden = true;
  }
  renderMine();
  renderAccount();
}

const STATUS_LABEL = { pending: 'Czeka na akceptację', approved: 'Opublikowany', rejected: 'Odrzucony' };

function renderMine() {
  if (!mine.length) {
    minePanel.innerHTML = `
      <h3>Moje przepisy</h3>
      <p class="note">Nie masz jeszcze żadnych przepisów. Dodaj pierwszy przyciskiem obok.</p>`;
    return;
  }
  minePanel.innerHTML = `
    <h3>Moje przepisy</h3>
    <ul class="mine-list">
      ${mine.map((r) => `
        <li class="mine-item" data-id="${esc(r.docId)}">
          <div class="mine-thumb">${r.photo ? `<img src="${esc(r.photo.file)}" alt="">` : api.eggIcon('whole')}</div>
          <div class="mine-text">
            <b>${esc(r.name)}</b>
            <span class="pill" data-status="${esc(r.status)}">${STATUS_LABEL[r.status] || r.status}</span>
            ${r.status === 'rejected' && r.rejectReason ? `<small>Powód: ${esc(r.rejectReason)}</small>` : ''}
          </div>
          <div class="mine-actions">
            <button type="button" class="chip" data-mine="view">Zobacz</button>
            <button type="button" class="chip" data-mine="del">Usuń</button>
          </div>
        </li>`).join('')}
    </ul>`;
}

minePanel.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-mine]');
  if (!btn) return;
  const item = btn.closest('.mine-item');
  const r = mine.find((m) => m.docId === item.dataset.id);
  if (!r) return;
  if (btn.dataset.mine === 'view') {
    api.preview(r);
    return;
  }
  // Usuwanie w dwóch krokach zamiast okna potwierdzenia.
  if (!btn.classList.contains('is-confirm')) {
    btn.classList.add('is-confirm');
    btn.textContent = 'Na pewno usunąć?';
    return;
  }
  btn.disabled = true;
  btn.textContent = 'Usuwam…';
  try {
    const { F, db } = fb;
    const batch = F.writeBatch(db);
    batch.delete(F.doc(db, 'przepisy', r.docId));
    if (r.hasPhoto) batch.delete(F.doc(db, 'zdjecia', r.docId));
    await batch.commit();
    await Promise.all([loadMine(), loadCommunity()]);
  } catch (err) {
    console.error(err);
    btn.disabled = false;
    btn.textContent = 'Nie udało się. Spróbuj jeszcze raz';
  }
});

/* ---------- Formularz ---------- */

const formDialog = document.createElement('dialog');
formDialog.className = 'rdialog fdialog';
formDialog.id = 'addDialog';
formDialog.setAttribute('aria-labelledby', 'fTitle');
document.body.appendChild(formDialog);

let photo = null; // { thumb, full }
let built = false;

function unitOptions(selected) {
  return UNIT_OPTIONS.map((u) => `<option value="${u}"${u === selected ? ' selected' : ''}>${u}</option>`).join('')
    + TEXT_AMOUNTS.map((t) => `<option value="t:${t}"${'t:' + t === selected ? ' selected' : ''}>${t}</option>`).join('');
}

function ingRow(v = {}) {
  const egg = v.egg || '';
  const unit = egg ? 'szt.' : (v.u || 'g');
  const row = document.createElement('div');
  row.className = 'frow ing-row';
  row.innerHTML = `
    <input class="fi-name" aria-label="Nazwa składnika" placeholder="${egg ? 'Jajka' : 'np. masło'}" maxlength="60" value="${esc(v.n || '')}">
    <input class="fi-q" type="number" min="0" step="any" inputmode="decimal" aria-label="Ilość" placeholder="ilość" value="${v.q ?? ''}">
    <select class="fi-u" aria-label="Jednostka">${unitOptions(unit)}</select>
    <select class="fi-egg" aria-label="Czy to jajko">${EGG_OPTIONS.map(([k, l]) => `<option value="${k}"${k === egg ? ' selected' : ''}>${l}</option>`).join('')}</select>
    <button type="button" class="frow-del" aria-label="Usuń składnik">×</button>`;
  syncIngRow(row);
  return row;
}

function syncIngRow(row) {
  const egg = $('.fi-egg', row).value;
  const unit = $('.fi-u', row);
  const qty = $('.fi-q', row);
  if (egg) unit.value = 'szt.';
  unit.disabled = Boolean(egg);
  const textAmount = unit.value.startsWith('t:');
  qty.disabled = textAmount;
  if (textAmount) qty.value = '';
  qty.step = egg ? '1' : 'any';
  row.classList.toggle('is-egg', Boolean(egg));
}

function stepRow(v = {}) {
  const li = document.createElement('li');
  li.className = 'frow step-row';
  li.innerHTML = `
    <textarea class="fs-text" rows="2" maxlength="400" aria-label="Opis kroku" placeholder="Co trzeba zrobić?">${esc(v.t || '')}</textarea>
    <label class="fs-timer"><span>Minutnik</span><input type="number" min="0" max="600" step="0.5" inputmode="decimal" placeholder="min" value="${v.min ?? ''}"></label>
    <button type="button" class="frow-del" aria-label="Usuń krok">×</button>`;
  return li;
}

function buildForm() {
  formDialog.innerHTML = `
    <form class="rform" id="rform" novalidate>
      <div class="rd-bar"><button type="button" class="rd-close" data-fclose aria-label="Zamknij formularz">
        <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
      <div class="rform-body">
        <header class="rform-head">
          <p class="eyebrow">Twój przepis</p>
          <h2 id="fTitle" tabindex="-1">Dodaj przepis z${NBSP}jajkami</h2>
          <p class="rd-intro">Przepis trafi do moderatora. Po akceptacji pojawi się na stronie z${NBSP}Twoim podpisem.</p>
        </header>

        <fieldset class="fgroup">
          <legend>Podstawy</legend>
          <div class="fgrid">
            <label class="ffield fwide"><span>Nazwa przepisu</span><input id="fName" maxlength="80" placeholder="np. Jajka po turecku"></label>
            <div class="ffield fwide">
              <span id="fCatLabel">Rodzaj dania</span>
              <div class="seg seg-4" role="radiogroup" aria-labelledby="fCatLabel">
                ${CATS.map(([k, l], i) => `<input type="radio" name="fCat" id="fCat-${k}" value="${k}"${i === 0 ? ' checked' : ''}><label for="fCat-${k}"><b>${l}</b></label>`).join('')}
              </div>
            </div>
            <label class="ffield fwide"><span>Krótki opis</span><textarea id="fIntro" rows="2" maxlength="220" placeholder="Jedno, dwa zdania, które zachęcą do gotowania."></textarea></label>
            <label class="ffield"><span>Czas pracy (min)</span><input id="fTime" type="number" min="1" max="720" inputmode="numeric" value="20"></label>
            <label class="ffield"><span>Liczba porcji</span><input id="fServings" type="number" min="1" max="24" inputmode="numeric" value="2"></label>
            <label class="ffield"><span>Trudność</span><select id="fDiff"><option value="1">łatwe</option><option value="2">średnie</option><option value="3">wymagające</option></select></label>
            <label class="ffield"><span>Czekanie <small>(opcjonalnie)</small></span><input id="fWait" maxlength="40" placeholder="np. 2 h w lodówce"></label>
          </div>
        </fieldset>

        <fieldset class="fgroup">
          <legend>Składniki</legend>
          <p class="fhint">Jajka, żółtka i${NBSP}białka oznacz w${NBSP}ostatniej kolumnie, żeby wytłaczanka mogła je policzyć.</p>
          <div class="frows" id="fIng"></div>
          <div class="fadd">
            <button type="button" class="chip" data-add="egg">+ Jajka</button>
            <button type="button" class="chip" data-add="ing">+ Składnik</button>
          </div>
          <p class="fegg" id="fEggs" aria-live="polite"></p>
        </fieldset>

        <fieldset class="fgroup">
          <legend>Przygotowanie</legend>
          <p class="fhint">Jeden krok to jedna czynność. Jeśli coś trwa określony czas, wpisz minuty, a${NBSP}w${NBSP}przepisie pojawi się minutnik.</p>
          <ol class="frows" id="fSteps"></ol>
          <div class="fadd"><button type="button" class="chip" data-add="step">+ Krok</button></div>
        </fieldset>

        <fieldset class="fgroup">
          <legend>Na koniec</legend>
          <div class="fgrid">
            <label class="ffield fwide"><span>Wskazówka <small>(opcjonalnie)</small></span><textarea id="fTip" rows="2" maxlength="400" placeholder="Twój sekret, który robi różnicę."></textarea></label>
            <div class="ffield fwide">
              <span>Zdjęcie <small>(opcjonalnie, ale z${NBSP}nim przepis wygląda lepiej)</small></span>
              <label class="fphoto">
                <input type="file" id="fPhoto" accept="image/*">
                <img id="fPhotoPreview" alt="" hidden>
                <span class="fphoto-empty" id="fPhotoEmpty">Wybierz zdjęcie z${NBSP}telefonu albo komputera</span>
              </label>
              <div class="fphoto-bar"><span class="fhint" id="fPhotoInfo"></span><button type="button" class="chip" id="fPhotoClear" hidden>Usuń zdjęcie</button></div>
            </div>
            <label class="ffield"><span>Podpis pod przepisem</span><input id="fAuthor" maxlength="40" placeholder="np. Ania z Poznania"></label>
          </div>
          <label class="fcheck">
            <input type="checkbox" class="ing-check" id="fConsent">
            <span class="box" aria-hidden="true"><svg class="ico" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>
            <span>Przepis i${NBSP}zdjęcie są moje albo mam prawo je udostępnić. Zgadzam się na ich publikację na stronie Jajo z${NBSP}moim podpisem.</span>
          </label>
          <p class="note">Zapisujemy podpis, przepis i${NBSP}zdjęcie. Adresu e-mail z${NBSP}konta Google nie pokazujemy. Swój przepis usuniesz w${NBSP}każdej chwili w${NBSP}„Moje przepisy”.</p>
        </fieldset>

        <div class="ferrors" id="fErrors" role="alert" hidden></div>
        <div class="factions">
          <button type="submit" class="btn btn-primary" id="fSubmit">Wyślij do moderacji</button>
          <button type="button" class="btn btn-ghost" data-fclose>Anuluj</button>
        </div>
      </div>
    </form>`;

  const form = $('#rform', formDialog);
  form.addEventListener('submit', submit);
  form.addEventListener('input', onFormInput);
  form.addEventListener('change', onFormChange);
  formDialog.addEventListener('click', (e) => {
    if (e.target === formDialog || e.target.closest('[data-fclose]')) formDialog.close();
    const add = e.target.closest('[data-add]');
    if (add) {
      if (add.dataset.add === 'step') {
        $('#fSteps', formDialog).appendChild(stepRow());
        $('#fSteps .step-row:last-child textarea', formDialog).focus();
      } else {
        const row = ingRow(add.dataset.add === 'egg' ? { n: 'Jajka', egg: 'whole', q: 2 } : {});
        $('#fIng', formDialog).appendChild(row);
        $('.fi-name', row).focus();
      }
      updateEggs();
      saveDraft();
    }
    const del = e.target.closest('.frow-del');
    if (del) {
      del.closest('.frow').remove();
      updateEggs();
      recheck();
      saveDraft();
    }
    if (e.target.closest('#fPhotoClear')) setPhoto(null);
  });
  built = true;
}

function onFormInput(e) {
  if (e.target.closest('.ing-row') || e.target.id === 'fServings') updateEggs();
  recheck();
  saveDraft();
}

// Gdy lista błędów jest już widoczna, odświeżaj ją na bieżąco przy poprawianiu.
function recheck() {
  if (!$('#fErrors', formDialog).hidden) showErrors(validate(collect()));
}

function onFormChange(e) {
  const row = e.target.closest('.ing-row');
  if (row) {
    syncIngRow(row);
    if (e.target.classList.contains('fi-egg') && e.target.value && !$('.fi-name', row).value.trim()) {
      $('.fi-name', row).value = { whole: 'Jajka', yolk: 'Żółtka', white: 'Białka' }[e.target.value];
    }
    updateEggs();
    saveDraft();
  }
  recheck();
  if (e.target.id === 'fPhoto' && e.target.files[0]) readPhoto(e.target.files[0]);
}

async function readPhoto(file) {
  const info = $('#fPhotoInfo', formDialog);
  info.textContent = 'Przygotowuję zdjęcie…';
  try {
    const [thumb, full] = await Promise.all([
      shrinkImage(file, { width: 480, crop: 4 / 3, maxChars: 58000 }),
      shrinkImage(file, { width: 1200, maxChars: 440000 }),
    ]);
    setPhoto({ thumb, full });
    info.textContent = '';
  } catch {
    setPhoto(null);
    info.textContent = 'Nie udało się odczytać zdjęcia. Wybierz plik JPG albo PNG.';
  }
}

function setPhoto(p) {
  photo = p;
  const img = $('#fPhotoPreview', formDialog);
  img.hidden = !p;
  if (p) img.src = p.full;
  else img.removeAttribute('src');
  $('#fPhotoEmpty', formDialog).hidden = Boolean(p);
  $('#fPhotoClear', formDialog).hidden = !p;
  if (!p) $('#fPhoto', formDialog).value = '';
}

/* Zbiera formularz do postaci przepisu (jak na stronie) i do zapisu w bazie. */
function collect() {
  const f = formDialog;
  const servings = Math.round(Number($('#fServings', f).value));
  const ingredients = $$('.ing-row', f).map((row) => {
    const n = tidy($('.fi-name', row).value);
    const u = $('.fi-u', row).value;
    const egg = $('.fi-egg', row).value;
    const raw = $('.fi-q', row).value;
    const q = raw === '' ? null : Number(raw);
    if (u.startsWith('t:')) return { n, q: null, u: '', egg: '', opt: false, t: u.slice(2) };
    return { n, q, u, egg, opt: false, t: '' };
  }).filter((it) => it.n || it.q !== null);
  const steps = $$('.step-row', f).map((li) => {
    const t = tidy($('.fs-text', li).value);
    const min = Number($('.fs-timer input', li).value);
    return { t, timer: min > 0 ? Math.round(min * 60) : 0 };
  }).filter((s) => s.t);
  return {
    name: tidy($('#fName', f).value),
    category: ($('input[name="fCat"]:checked', f) || {}).value || 'sniadania',
    intro: tidy($('#fIntro', f).value),
    time: Math.round(Number($('#fTime', f).value)),
    wait: tidy($('#fWait', f).value),
    difficulty: Number($('#fDiff', f).value),
    servings,
    minServings: 1,
    ingredients,
    steps,
    tip: tidy($('#fTip', f).value),
    authorName: tidy($('#fAuthor', f).value),
  };
}

function asRecipe(d) {
  return {
    servings: d.servings > 0 ? d.servings : 1,
    ingredients: d.ingredients.filter((it) => it.egg && it.q > 0).map((it) => ({ egg: it.egg, q: it.q, u: 'szt.' })),
  };
}

function updateEggs() {
  if (!built) return;
  const d = collect();
  const p = api.eggParts(asRecipe(d), asRecipe(d).servings);
  const out = $('#fEggs', formDialog);
  out.classList.toggle('is-missing', p.total < 1);
  out.innerHTML = p.total
    ? `<span class="ei-row">${api.eggIcons(p, 16)}</span> W${NBSP}przepisie: ${esc(api.eggLabel(p))}.`
    : `Dodaj co najmniej jedno jajko, żółtko albo białko. To strona o${NBSP}jajkach!`;
}

function validate(d) {
  const errors = [];
  if (d.name.length < 3) errors.push(['fName', 'Wpisz nazwę przepisu (co najmniej 3 znaki).']);
  if (d.intro.length < 10) errors.push(['fIntro', 'Dodaj krótki opis (co najmniej 10 znaków).']);
  if (!(d.time >= 1 && d.time <= 720)) errors.push(['fTime', 'Czas pracy wpisz w minutach, od 1 do 720.']);
  if (!(d.servings >= 1 && d.servings <= 24)) errors.push(['fServings', 'Liczba porcji musi być od 1 do 24.']);
  const named = d.ingredients.filter((it) => it.n);
  if (named.length < 2) errors.push(['fIng', 'Dodaj co najmniej dwa składniki.']);
  if (d.ingredients.some((it) => !it.n)) errors.push(['fIng', 'Każdy składnik musi mieć nazwę.']);
  if (d.ingredients.some((it) => !it.t && !(it.q > 0))) errors.push(['fIng', 'Każdy składnik potrzebuje ilości albo opcji „do smaku”.']);
  if (d.ingredients.some((it) => it.egg && !Number.isInteger(it.q))) errors.push(['fIng', 'Liczbę jajek, żółtek i białek wpisz jako liczbę całkowitą.']);
  if (api.eggParts(asRecipe(d), asRecipe(d).servings).total < 1) errors.push(['fIng', 'Przepis musi zawierać jajka. Oznacz je w kolumnie „Nie jajko / Całe jajka”.']);
  if (d.ingredients.length > 40) errors.push(['fIng', 'Przepis może mieć najwyżej 40 składników.']);
  if (d.steps.length < 1) errors.push(['fSteps', 'Opisz co najmniej jeden krok przygotowania.']);
  if (d.steps.length > 30) errors.push(['fSteps', 'Przepis może mieć najwyżej 30 kroków.']);
  if (d.authorName.length < 2) errors.push(['fAuthor', 'Wpisz podpis, który pojawi się pod przepisem.']);
  if (!$('#fConsent', formDialog).checked) errors.push(['fConsent', 'Potwierdź, że możesz udostępnić ten przepis.']);
  return errors;
}

function showErrors(errors) {
  const box = $('#fErrors', formDialog);
  $$('.has-error', formDialog).forEach((el) => el.classList.remove('has-error'));
  if (!errors.length) {
    box.hidden = true;
    box.innerHTML = '';
    return;
  }
  const unique = [...new Map(errors.map(([id, msg]) => [msg, id])).entries()];
  box.innerHTML = `<p><b>Popraw jeszcze:</b></p><ul>${unique.map(([msg]) => `<li>${esc(msg)}</li>`).join('')}</ul>`;
  box.hidden = false;
  unique.forEach(([, id]) => {
    const el = $('#' + id, formDialog);
    const field = el && (el.closest('.ffield, .fcheck') || el.closest('.fgroup') || el);
    if (field) field.classList.add('has-error');
  });
}

async function submit(e) {
  e.preventDefault();
  const d = collect();
  const errors = validate(d);
  showErrors(errors);
  if (errors.length) {
    $('#fErrors', formDialog).scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  const btn = $('#fSubmit', formDialog);
  btn.disabled = true;
  btn.textContent = 'Wysyłam…';
  const { F, db } = fb;
  try {
    const ref = F.doc(F.collection(db, 'przepisy'));
    const data = {
      ...d,
      eggs: api.eggParts(asRecipe(d), d.servings).total,
      thumb: photo ? photo.thumb : '',
      hasPhoto: Boolean(photo),
      authorUid: user.uid,
      status: 'pending',
      rejectReason: '',
      createdAt: F.serverTimestamp(),
    };
    const batch = F.writeBatch(db);
    batch.set(F.doc(db, 'uzytkownicy', user.uid), { ostatni: F.serverTimestamp() }, { merge: true });
    batch.set(ref, data);
    if (photo) batch.set(F.doc(db, 'zdjecia', ref.id), { data: photo.full, authorUid: user.uid });
    await batch.commit();
    clearDraft();
    showSuccess(d.name);
    await loadMine();
  } catch (err) {
    console.error(err);
    const denied = err && err.code === 'permission-denied';
    showErrors([['fSubmit', denied
      ? 'Nowy przepis możesz wysłać najwcześniej 2 minuty po poprzednim. Odczekaj chwilę i spróbuj jeszcze raz.'
      : 'Nie udało się wysłać przepisu. Sprawdź połączenie z internetem i spróbuj jeszcze raz.']]);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Wyślij do moderacji';
  }
}

function showSuccess(name) {
  built = false;
  photo = null;
  formDialog.innerHTML = `
    <div class="rform-done">
      <div class="done-egg" aria-hidden="true">${api.eggIcon('whole')}</div>
      <h2 id="fTitle" tabindex="-1">Dziękujemy!</h2>
      <p>Przepis „${esc(name)}” czeka na akceptację moderatora. Jego stan sprawdzisz w${NBSP}„Moje przepisy”.</p>
      <button type="button" class="btn btn-primary" data-fclose>Zamknij</button>
    </div>`;
  $('#fTitle', formDialog).focus();
}

function openForm() {
  if (!built) {
    buildForm();
    restoreDraft();
  }
  const author = $('#fAuthor', formDialog);
  if (author && !author.value && user) author.value = profileName || (user.displayName || '').split(' ')[0];
  updateEggs();
  formDialog.showModal();
  formDialog.scrollTop = 0;
  const title = $('#fTitle', formDialog);
  if (title) title.focus({ preventScroll: true });
}

/* ---------- Szkic (bez zdjęcia), żeby nic nie przepadło po zamknięciu ---------- */

function saveDraft() {
  if (!built) return;
  try {
    const d = collect();
    d.ingredientsRaw = $$('.ing-row', formDialog).map((row) => ({
      n: $('.fi-name', row).value, q: $('.fi-q', row).value, u: $('.fi-u', row).value, egg: $('.fi-egg', row).value,
    }));
    d.stepsRaw = $$('.step-row', formDialog).map((li) => ({ t: $('.fs-text', li).value, min: $('.fs-timer input', li).value }));
    localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    /* bez szkicu */
  }
}

function restoreDraft() {
  let d = null;
  try {
    d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
  } catch {
    d = null;
  }
  const f = formDialog;
  const ingBox = $('#fIng', f);
  const stepBox = $('#fSteps', f);
  if (d) {
    $('#fName', f).value = d.name || '';
    const cat = $(`#fCat-${d.category}`, f);
    if (cat) cat.checked = true;
    $('#fIntro', f).value = d.intro || '';
    if (d.time) $('#fTime', f).value = d.time;
    if (d.servings) $('#fServings', f).value = d.servings;
    $('#fDiff', f).value = String(d.difficulty || 1);
    $('#fWait', f).value = d.wait || '';
    $('#fTip', f).value = d.tip || '';
    $('#fAuthor', f).value = d.authorName || '';
    (d.ingredientsRaw || []).forEach((it) => {
      const row = ingRow({ n: it.n, q: it.q, egg: it.egg, u: it.u });
      ingBox.appendChild(row);
    });
    (d.stepsRaw || []).forEach((s) => stepBox.appendChild(stepRow(s)));
  }
  if (!$$('.ing-row', f).length) {
    ingBox.appendChild(ingRow({ n: 'Jajka', egg: 'whole', q: 2 }));
    ingBox.appendChild(ingRow({}));
  }
  if (!$$('.step-row', f).length) stepBox.appendChild(stepRow());
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* bez szkicu */
  }
}

