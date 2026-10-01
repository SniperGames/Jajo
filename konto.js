/* Jajo: ikona konta w prawym górnym rogu paska nawigacji (logowanie, profil, wylogowanie). */
import {
  connect, configured, signIn, signInError, isMember, watchUser, ensureProfile, isAdmin, avatarHtml,
} from './jajo-firebase.js';

const PERSON = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.5" r="3.6"/><path d="M4.8 20c.9-3.6 3.8-5.6 7.2-5.6s6.3 2 7.2 5.6"/></svg>';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const row = document.querySelector('.nav-row');

if (configured && row) {
  const box = document.createElement('div');
  box.className = 'nav-account';
  box.innerHTML = `
    <button type="button" class="account-btn" aria-expanded="false" aria-controls="accountMenu" aria-label="Konto: zaloguj się">${PERSON}</button>
    <div class="account-menu" id="accountMenu" hidden></div>`;
  row.appendChild(box);

  const btn = box.querySelector('.account-btn');
  const menu = box.querySelector('.account-menu');
  let fb = null;
  let user = null;
  let name = '';
  let admin = false;
  let loading = null;

  // Firebase wczytujemy dopiero po załadowaniu strony, żeby nie spowalniać jej wyświetlenia.
  const load = () => {
    if (!loading) {
      loading = connect().then((conn) => {
        fb = conn;
        if (!fb) {
          box.hidden = true;
          return;
        }
        watchUser(fb, async (u) => {
          user = isMember(u) ? u : null;
          name = '';
          admin = false;
          if (user) {
            const [profile, adm] = await Promise.all([ensureProfile(fb, user), isAdmin(fb, user.uid)]);
            name = (profile && profile.name) || (user.displayName || '').split(' ')[0] || 'Ty';
            admin = adm;
          }
          paintButton();
          if (!menu.hidden) paintMenu();
        });
      });
    }
    return loading;
  };
  const idle = (fn) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 2500 }) : setTimeout(fn, 400));
  if (document.readyState === 'complete') idle(load);
  else window.addEventListener('load', () => idle(load), { once: true });

  function paintButton() {
    if (user) {
      btn.innerHTML = avatarHtml(name, user.uid, 'nav');
      btn.classList.add('is-member');
      btn.setAttribute('aria-label', `Konto: ${name}. Otwórz menu`);
    } else {
      btn.innerHTML = PERSON;
      btn.classList.remove('is-member');
      btn.setAttribute('aria-label', 'Konto: zaloguj się');
    }
  }

  function paintMenu() {
    if (!fb) {
      menu.innerHTML = '<p class="am-text">Wczytuję…</p>';
      return;
    }
    if (!user) {
      menu.innerHTML = `
        <p class="am-title">Nie jesteś zalogowany</p>
        <p class="am-text">Zaloguj się kontem Google, żeby dodawać przepisy, podpisywać komentarze imieniem i mieć swój profil.</p>
        <button type="button" class="btn btn-primary am-login" data-am="login">Zaloguj się przez Google</button>
        <p class="account-error" role="alert"></p>`;
      return;
    }
    menu.innerHTML = `
      <div class="am-head">
        ${avatarHtml(name, user.uid)}
        <div><b>${esc(name)}</b><small>Konto Google</small></div>
      </div>
      <nav class="am-list" aria-label="Konto">
        <a class="am-item" href="profil.html#${esc(user.uid)}">Mój profil</a>
        <a class="am-item" href="przepisy.html#od-czytelnikow">Dodaj przepis</a>
        ${admin ? '<a class="am-item" href="moderacja.html">Moderacja</a>' : ''}
        <button type="button" class="am-item" data-am="out">Wyloguj</button>
      </nav>`;
  }

  function open() {
    paintMenu();
    menu.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    const first = menu.querySelector('a, button');
    if (first) first.focus({ preventScroll: true });
    if (!fb) load().then(() => { if (!menu.hidden) paintMenu(); });
  }

  function close(focusButton) {
    if (menu.hidden) return;
    menu.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    if (focusButton) btn.focus({ preventScroll: true });
  }

  btn.addEventListener('click', () => (menu.hidden ? open() : close(false)));

  menu.addEventListener('click', async (e) => {
    const act = e.target.closest('[data-am]');
    if (act && act.dataset.am === 'login') {
      try {
        await signIn(fb);
        close(true);
      } catch (err) {
        const msg = signInError(err);
        const out = menu.querySelector('.account-error');
        if (out) out.textContent = msg;
      }
    } else if (act && act.dataset.am === 'out') {
      await fb.A.signOut(fb.auth);
      close(true);
    } else if (e.target.closest('a')) {
      close(false);
    }
  });

  document.addEventListener('click', (e) => {
    if (!box.contains(e.target)) close(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) close(true);
  });
}
