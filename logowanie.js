/* Jajo: okno logowania (Google albo e-mail i hasło), zakładanie konta, nowe hasło i potwierdzanie adresu. */
import {
  signIn, signInError, isMember, isUnverified, watchUser, registerWithEmail, signInWithEmail,
  sendVerification, sendPasswordReset, checkVerified,
} from './jajo-firebase.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const MIN_PASSWORD = 8;
const CLOSE = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const GOOGLE = `<svg class="ld-g" viewBox="0 0 48 48" aria-hidden="true">
  <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
  <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
  <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
  <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/>
</svg>`;
const MAIL = '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="5" y="11" width="38" height="27" rx="5"/><path d="M7 14l17 13 17-13"/></svg>';

let fb = null;
let dialog = null;
let body = null;
let tab = 'login';
let finish = null;
let unwatch = null;
let resendAt = 0;

/**
 * Otwiera okno logowania. Zwraca zalogowanego użytkownika (pełne konto) albo null,
 * gdy ktoś zamknął okno albo czeka jeszcze na potwierdzenie adresu e-mail.
 */
export function openLogin(conn, { lede = '' } = {}) {
  fb = conn;
  if (isMember(fb.auth.currentUser)) return Promise.resolve(fb.auth.currentUser);
  build();
  dialog.dataset.lede = lede;
  show(isUnverified(fb.auth.currentUser) ? 'verify' : 'start');
  if (!dialog.open) dialog.showModal();
  if (unwatch) unwatch();
  unwatch = watchUser(fb, (u) => {
    if (isMember(u)) done(u);
    else if (isUnverified(u) && body.dataset.view !== 'verify') show('verify');
  });
  return new Promise((resolve) => { finish = resolve; });
}

function done(user) {
  // Kto ma już konto, przy następnym otwarciu zobaczy logowanie, a nie zakładanie konta.
  if (user) tab = 'login';
  const resolve = finish;
  finish = null;
  if (unwatch) unwatch();
  unwatch = null;
  if (dialog.open) dialog.close();
  if (resolve) resolve(user);
}

function build() {
  if (dialog) return;
  dialog = document.createElement('dialog');
  dialog.className = 'rdialog ldialog';
  dialog.setAttribute('aria-labelledby', 'ldTitle');
  dialog.innerHTML = `
    <div class="rd-bar"><button type="button" class="rd-close" data-ld-close aria-label="Zamknij">${CLOSE}</button></div>
    <div class="ld" aria-live="polite"></div>`;
  document.body.appendChild(dialog);
  body = dialog.querySelector('.ld');
  dialog.addEventListener('click', onClick);
  dialog.addEventListener('submit', onSubmit);
  dialog.addEventListener('keydown', onTabKeys);
  // Poprawianie pola chowa stary komunikat o błędzie.
  dialog.addEventListener('input', (e) => {
    const form = e.target.closest('[data-ld-form]');
    if (form) error(form.querySelector('.account-error'), '');
  });
  // Kliknięcie w tło zamyka okno.
  dialog.addEventListener('mousedown', (e) => {
    if (e.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => done(null));
}

function show(view, extra = {}) {
  body.dataset.view = view;
  const user = fb.auth.currentUser;
  if (view === 'start') {
    const lede = dialog.dataset.lede || 'Konto pozwala dodawać przepisy, podpisywać komentarze imieniem i mieć własny profil.';
    body.innerHTML = `
      <p class="eyebrow">Konto na Jajo</p>
      <h2 class="ld-title" id="ldTitle">Zaloguj się</h2>
      <p class="ld-lede">${esc(lede)}</p>
      <button type="button" class="btn btn-ghost ld-google" data-ld="google">${GOOGLE}Zaloguj się przez Google</button>
      <p class="account-error" data-ld-error="google" role="alert"></p>
      <p class="ld-or"><span>albo e-mailem</span></p>
      <div class="ld-tabs" role="tablist" aria-label="Logowanie e-mailem">
        <button type="button" role="tab" id="ldTabLogin" aria-controls="ldLogin" data-ld-tab="login">Mam konto</button>
        <button type="button" role="tab" id="ldTabRegister" aria-controls="ldRegister" data-ld-tab="register">Nowe konto</button>
      </div>
      <form class="rform ld-form" id="ldLogin" role="tabpanel" aria-labelledby="ldTabLogin" data-ld-form="login" novalidate>
        <div class="ffield"><label for="ldEmail">E-mail</label><input id="ldEmail" name="email" type="email" autocomplete="username" inputmode="email" required></div>
        ${passwordField('ldPass', 'current-password')}
        <p class="account-error" role="alert"></p>
        <button type="submit" class="btn btn-primary">Zaloguj się</button>
        <button type="button" class="linklike ld-forgot" data-ld-view="reset">Nie pamiętam hasła</button>
      </form>
      <form class="rform ld-form" id="ldRegister" role="tabpanel" aria-labelledby="ldTabRegister" data-ld-form="register" novalidate>
        <div class="ffield"><label for="ldName">Imię lub pseudonim</label><input id="ldName" name="name" maxlength="40" autocomplete="nickname" required></div>
        <div class="ffield"><label for="ldNewEmail">E-mail</label><input id="ldNewEmail" name="email" type="email" autocomplete="email" inputmode="email" required></div>
        ${passwordField('ldNewPass', 'new-password', `Co najmniej ${MIN_PASSWORD} znaków.`)}
        <p class="account-error" role="alert"></p>
        <button type="submit" class="btn btn-primary">Załóż konto</button>
        <p class="fhint">Wyślemy Ci e-mail z linkiem, który potwierdzi adres. Adresu nie pokazujemy na stronie.</p>
      </form>`;
    setTab(tab, false);
  } else if (view === 'reset') {
    body.innerHTML = `
      <button type="button" class="linklike ld-back" data-ld-view="start">← Wróć do logowania</button>
      <h2 class="ld-title" id="ldTitle">Nowe hasło</h2>
      ${extra.sentTo
        ? `<p class="ld-lede">Gotowe. Jeśli konto z adresem <b>${esc(extra.sentTo)}</b> istnieje, za chwilę dostaniesz e-mail z linkiem do ustawienia nowego hasła.</p>
           <p class="fhint">Nie widzisz wiadomości? Zajrzyj do folderu Spam albo Oferty.</p>
           <button type="button" class="btn btn-primary" data-ld-view="start">Wróć do logowania</button>`
        : `<p class="ld-lede">Podaj adres e-mail swojego konta. Wyślemy na niego link do ustawienia nowego hasła.</p>
           <form class="rform ld-form" data-ld-form="reset" novalidate>
             <div class="ffield"><label for="ldResetEmail">E-mail</label><input id="ldResetEmail" name="email" type="email" autocomplete="email" inputmode="email" value="${esc(extra.email || '')}" required></div>
             <p class="account-error" role="alert"></p>
             <button type="submit" class="btn btn-primary">Wyślij link</button>
           </form>`}`;
    const input = body.querySelector('input');
    if (input) input.focus();
  } else if (view === 'verify') {
    body.innerHTML = `
      <div class="ld-mail">${MAIL}</div>
      <h2 class="ld-title" id="ldTitle">Potwierdź adres e-mail</h2>
      <p class="ld-lede">Wysłaliśmy link na <b>${esc(user && user.email)}</b>. Kliknij go, a potem wróć na tę stronę.</p>
      <p class="fhint">Nie widzisz wiadomości? Zajrzyj do folderu Spam albo Oferty. Do czasu potwierdzenia możesz polubić przepis i komentować jako Niezalogowany użytkownik.</p>
      <button type="button" class="btn btn-primary" data-ld="check">Sprawdź potwierdzenie</button>
      <p class="account-error" data-ld-error="verify" role="alert"></p>
      <p class="ld-links">
        <button type="button" class="linklike" data-ld="resend">Wyślij link jeszcze raz</button>
        <button type="button" class="linklike" data-ld="out">Wyloguj</button>
      </p>`;
  }
}

function passwordField(id, autocomplete, hint = '') {
  return `
    <div class="ffield">
      <label for="${id}">Hasło</label>
      <span class="ld-pass">
        <input id="${id}" name="password" type="password" autocomplete="${autocomplete}" required${autocomplete === 'new-password' ? ` minlength="${MIN_PASSWORD}"` : ''}>
        <button type="button" class="ld-show" data-ld-show aria-controls="${id}" aria-pressed="false">Pokaż</button>
      </span>
      ${hint ? `<p class="fhint">${hint}</p>` : ''}
    </div>`;
}

function setTab(name, focus = true) {
  tab = name;
  body.querySelector('#ldTitle').textContent = name === 'register' ? 'Załóż konto' : 'Zaloguj się';
  body.querySelectorAll('[data-ld-tab]').forEach((b) => {
    const on = b.dataset.ldTab === name;
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
  });
  body.querySelectorAll('[data-ld-form="login"], [data-ld-form="register"]').forEach((f) => {
    f.hidden = f.dataset.ldForm !== name;
  });
  if (focus) body.querySelector(`[data-ld-tab="${name}"]`).focus();
}

function onTabKeys(e) {
  const btn = e.target.closest('[data-ld-tab]');
  if (!btn || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
  e.preventDefault();
  setTab(btn.dataset.ldTab === 'login' ? 'register' : 'login');
}

function error(el, text) {
  if (el) el.textContent = text;
}

async function onClick(e) {
  if (e.target.closest('[data-ld-close]')) {
    dialog.close();
    return;
  }
  const tabBtn = e.target.closest('[data-ld-tab]');
  if (tabBtn) {
    setTab(tabBtn.dataset.ldTab);
    return;
  }
  const viewBtn = e.target.closest('[data-ld-view]');
  if (viewBtn) {
    const typed = body.querySelector('#ldEmail');
    show(viewBtn.dataset.ldView, { email: typed ? typed.value.trim() : '' });
    return;
  }
  const showBtn = e.target.closest('[data-ld-show]');
  if (showBtn) {
    const input = dialog.querySelector('#' + showBtn.getAttribute('aria-controls'));
    const visible = input.type === 'password';
    input.type = visible ? 'text' : 'password';
    showBtn.textContent = visible ? 'Ukryj' : 'Pokaż';
    showBtn.setAttribute('aria-pressed', String(visible));
    return;
  }
  const act = e.target.closest('[data-ld]');
  if (!act || act.disabled) return;
  const kind = act.dataset.ld;
  if (kind === 'google') {
    const box = body.querySelector('[data-ld-error="google"]');
    error(box, '');
    try {
      await signIn(fb);
    } catch (err) {
      error(box, signInError(err));
    }
  } else if (kind === 'check') {
    const box = body.querySelector('[data-ld-error="verify"]');
    act.disabled = true;
    error(box, '');
    try {
      if (!(await checkVerified(fb))) error(box, 'Adres nie jest jeszcze potwierdzony. Kliknij link w wiadomości od Jajo i wróć tutaj.');
    } catch (err) {
      error(box, signInError(err));
    }
    act.disabled = false;
  } else if (kind === 'resend') {
    const box = body.querySelector('[data-ld-error="verify"]');
    if (Date.now() < resendAt) {
      error(box, 'Link już poszedł. Kolejny możesz wysłać za minutę.');
      return;
    }
    act.disabled = true;
    try {
      await sendVerification(fb);
      resendAt = Date.now() + 60000;
      act.textContent = 'Wysłane';
    } catch (err) {
      error(box, signInError(err));
      act.disabled = false;
    }
  } else if (kind === 'out') {
    await fb.A.signOut(fb.auth);
    show('start');
  }
}

async function onSubmit(e) {
  const form = e.target.closest('[data-ld-form]');
  if (!form) return;
  e.preventDefault();
  const box = form.querySelector('.account-error');
  const btn = form.querySelector('button[type="submit"]');
  const value = (name) => (form.elements[name] ? form.elements[name].value : '');
  const email = value('email').trim();
  const password = value('password');
  error(box, '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    error(box, email ? 'To nie wygląda na adres e-mail.' : 'Wpisz adres e-mail.');
    form.elements.email.focus();
    return;
  }
  const mode = form.dataset.ldForm;
  const name = value('name').replace(/\s+/g, ' ').trim();
  if (mode === 'register' && name.length < 2) {
    error(box, 'Imię lub pseudonim musi mieć co najmniej 2 znaki.');
    form.elements.name.focus();
    return;
  }
  if (mode !== 'reset' && !password) {
    error(box, 'Wpisz hasło.');
    form.elements.password.focus();
    return;
  }
  if (mode === 'register' && password.length < MIN_PASSWORD) {
    error(box, `Hasło musi mieć co najmniej ${MIN_PASSWORD} znaków.`);
    form.elements.password.focus();
    return;
  }
  btn.disabled = true;
  try {
    if (mode === 'login') {
      await signInWithEmail(fb, email, password);
      // Konto niepotwierdzone: okno przełączy się na prośbę o potwierdzenie (watchUser).
    } else if (mode === 'register') {
      await registerWithEmail(fb, { name: name.slice(0, 40), email, password });
      tab = 'login';
      resendAt = Date.now() + 60000;
      show('verify');
    } else {
      await sendPasswordReset(fb, email);
      show('reset', { sentTo: email });
    }
  } catch (err) {
    console.error(err);
    // Przy resecie nie zdradzamy, czy konto istnieje.
    if (mode === 'reset' && err && err.code === 'auth/user-not-found') show('reset', { sentTo: email });
    // Konto mogło już powstać, a nie wyszedł tylko e-mail: wtedy okno pokazuje prośbę o potwierdzenie.
    else error(box.isConnected ? box : body.querySelector('.account-error'), signInError(err));
  } finally {
    if (btn.isConnected) btn.disabled = false;
  }
}
