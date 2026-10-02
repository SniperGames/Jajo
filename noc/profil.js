/* Jajo: nocne ślady w profilach. Profil, którego nie ma w bazie, z zamazaną notatką (widać ją dopiero po zaznaczeniu). */
import { t, step, advance, whenSynced, isPip, savedText, staticNoise, whisper } from './rdzen.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Pisklę z pustymi, czarnymi oczami.
const AVATAR = 'data:image/svg+xml,' + encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
    <rect width="120" height="120" fill="#141412"/>
    <ellipse cx="60" cy="74" rx="38" ry="36" fill="#E8C64A"/>
    <path d="M54 40c-2-10 6-13 7-3 2-9 10-7 6 4z" fill="#E8C64A"/>
    <ellipse cx="46" cy="66" rx="7" ry="9" fill="#050505"/>
    <ellipse cx="74" cy="66" rx="7" ry="9" fill="#050505"/>
    <path d="M52 80h16l-8 9z" fill="#C46A1C"/>
    <path d="M44 76c-1 8-2 14-4 20M77 76c1 6 1 12 3 18" stroke="#3B2A10" stroke-width="1.5" opacity=".5"/>
  </svg>`);

let listening = false;

/** Pokazuje profil, jeśli to ten właściwy i poprzednia zagadka jest rozwiązana. Zwraca true, gdy go pokazał. */
export async function show(uid, app) {
  if (!uid || uid.length > 12 || !(await isPip(uid))) return false;
  if (step() < 5) await whenSynced();
  if (step() < 5) return false;
  if (app.querySelector('.noc-redact')) return true; // już widać ten profil
  const p = t('pip');
  document.title = `${p.name} – profil kucharza – Jajo`;
  app.innerHTML = `
    <div class="profile-banner noc-banner" aria-hidden="true">
      <span class="noc-banner-cam">CAM 05 · SALA</span>
      <span class="noc-banner-rec">● REC</span>
      <span class="noc-banner-time">28.10.2023 02:37:21</span>
    </div>
    <header class="profile-head">
      <span class="avatar avatar-xl avatar-photo noc-avatar" aria-hidden="true"><img src="${AVATAR}" alt=""></span>
      <div class="profile-id">
        <p class="eyebrow">Profil kucharza</p>
        <h1 class="profile-name">${esc(p.name)}</h1>
        <p class="profile-since">${esc(p.meta)}</p>
        <p class="profile-bio">${esc(p.about)}</p>
      </div>
    </header>
    <dl class="profile-stats">
      <div><dt>Przepisy</dt><dd>1</dd></div>
      <div><dt>Smakuje innym</dt><dd>0</dd></div>
      <div><dt>Komentarze</dt><dd>0</dd></div>
    </dl>
    <section class="profile-section" aria-labelledby="nocNote">
      <h2 id="nocNote">Notatka</h2>
      <p class="noc-redact${step() >= 6 ? ' is-revealed' : ''}">${esc(p.secret)}</p>
      <div class="noc-rd-next noc-profile-next"${step() >= 6 ? '' : ' hidden'}>
        <p class="noc-note-next-label">Co dalej?</p>
        <p>${esc(t('n6next'))}</p>
      </div>
      <p class="noc-redact-saved note" aria-live="polite"></p>
    </section>`;
  if (!listening) {
    listening = true;
    document.addEventListener('selectionchange', () => onSelect(app));
  }
  return true;
}

async function onSelect(app) {
  const el = app.querySelector('.noc-redact');
  if (!el || el.classList.contains('is-revealed')) return;
  const sel = document.getSelection();
  if (!sel || sel.isCollapsed || !sel.containsNode(el, true) || sel.toString().trim().length < 2) return;
  el.classList.add('is-revealed');
  staticNoise(0.25, 0.1);
  const res = await advance(6);
  if (!res) return;
  const saved = app.querySelector('.noc-redact-saved');
  if (saved) saved.textContent = savedText();
  const next = app.querySelector('.noc-profile-next');
  if (next) next.hidden = false;
  setTimeout(() => {
    document.getSelection().removeAllRanges();
    whisper(t('n6'), { kicker: 'Notatka Pipa', next: t('n6next') });
  }, 900);
}
