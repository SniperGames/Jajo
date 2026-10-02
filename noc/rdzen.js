/* Jajo: nocne ślady. Wspólny stan zagadek (rozwiązywanych po kolei), zapis w przeglądarce i na koncie, notatki Pipa. */
import { connect, isMember, watchUser } from '../jajo-firebase.js';

const STORE = 'jajo:noc';
export const LAST = 8; // 7 zagadek i ukończona gra
export const STAGES = 5; // etapy sekretnej gry

// Teksty zagadek są zakodowane, żeby nie dało się ich przeczytać w źródle strony jednym rzutem oka.
const SALT = 'jajo-noc-0237';
const BLOB =
/*BLOB*/'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';
// Skróty SHA-256 odpowiedzi (same odpowiedzi nie są nigdzie zapisane).
const HASH = {
  kod: 'bd2bebca54c0a877ccfbe2c1588732a4a2c20e3d95f26351ae21ff4d1b68e3f7',
  pip: 'd754b6f5e87c469cedbc9aa1a577b5e2f985d5471ee210ff58346c7528412bcd',
};

let texts = null;

/** Tekst zagadki po kluczu, np. t('n1') albo t('przepis').steps. */
export function t(key) {
  if (!texts) {
    const bytes = Uint8Array.from(atob(BLOB), (c) => c.charCodeAt(0));
    for (let i = 0; i < bytes.length; i++) bytes[i] ^= SALT.charCodeAt(i % SALT.length) ^ ((i * 37) & 0xff);
    texts = JSON.parse(new TextDecoder().decode(bytes));
  }
  return texts[key];
}

export async function sha(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Normalizuje kod ze skorupki tak samo jak dekoder na stronie głównej. */
export const normCode = (raw) => String(raw || '').toUpperCase().replace(/[\s\-‐–—_./]/g, '');

export async function isCode(raw) {
  return (await sha('jajo:kod:' + normCode(raw))) === HASH.kod;
}

export async function isPip(name) {
  return (await sha('jajo:pip:' + String(name || '').toLowerCase())) === HASH.pip;
}

/** Klucz do nagrania z kamery liczony z kodu ze skorupki. */
export const keyFromCode = (raw) => sha('jajo:noc:' + normCode(raw));

/* ---------- Stan ---------- */

function clean(s) {
  const int = (v, max) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));
  return {
    krok: int(s && s.krok, LAST),
    etap: int(s && s.etap, STAGES),
    klucz: s && /^[0-9a-f]{64}$/.test(s.klucz) ? s.klucz : '',
  };
}

function load() {
  try {
    return clean(JSON.parse(localStorage.getItem(STORE)));
  } catch {
    return clean(null);
  }
}

let state = load();
const listeners = new Set();

function save() {
  try {
    localStorage.setItem(STORE, JSON.stringify(state));
  } catch {
    /* pamięć przeglądarki niedostępna */
  }
}

function emit() {
  listeners.forEach((cb) => {
    try {
      cb({ ...state });
    } catch (err) {
      console.error(err);
    }
  });
}

/** Aktualny stan: { krok, etap, klucz }. */
export const get = () => ({ ...state });
export const step = () => state.krok;

export function onChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// Inna karta tej samej przeglądarki też mogła coś odkryć.
window.addEventListener('storage', (e) => {
  if (e.key !== STORE) return;
  const next = load();
  if (next.krok !== state.krok || next.etap !== state.etap || next.klucz !== state.klucz) {
    state = merge(state, next);
    emit();
  }
});

function merge(a, b) {
  return clean({ krok: Math.max(a.krok, b.krok), etap: Math.max(a.etap, b.etap), klucz: a.klucz || b.klucz });
}

/* ---------- Konto ---------- */

let fb = null;
let me = null;
let ready = false; // czy w bazie są reguły dla nocnych śladów
let remote = null;
let syncing = null;
let tries = 0;
let retry = 0;

// Z kontem łączymy się dopiero, gdy jakaś zagadka tego potrzebuje (oszczędza odczyty z bazy).
function sync() {
  if (!syncing) {
    syncing = (async () => {
      fb = await connect();
      if (!fb) return;
      await new Promise((resolve) => {
        let first = true;
        watchUser(fb, async (u) => {
          me = isMember(u) ? u : null;
          remote = null;
          if (me) await pull();
          if (first) {
            first = false;
            resolve();
          }
        });
      });
    })();
  }
  return syncing;
}

/** Czeka (najwyżej ms) na wczytanie postępu z konta, żeby na nowym urządzeniu nie zaczynać od zera. */
export function whenSynced(ms = 5000) {
  return Promise.race([sync(), new Promise((r) => setTimeout(r, ms))]);
}

async function pull() {
  const { F, db } = fb;
  try {
    const snap = await F.getDoc(F.doc(db, 'noc', me.uid));
    ready = true;
    remote = snap.exists() ? clean(snap.data()) : null;
    const before = { ...state };
    if (remote) state = merge(state, remote);
    if (state.krok !== before.krok || state.etap !== before.etap || state.klucz !== before.klucz) {
      save();
      emit();
    }
    if (!remote || remote.krok < state.krok || remote.etap < state.etap || remote.klucz !== state.klucz) {
      if (state.krok > 0) push();
    }
  } catch (err) {
    ready = false;
    console.warn('Nocne ślady zapisują się tylko w przeglądarce: brak reguł w Firestore.', err && err.code);
  }
}

async function push() {
  if (!fb || !me || !ready) return;
  const { F, db } = fb;
  clearTimeout(retry);
  try {
    await F.setDoc(F.doc(db, 'noc', me.uid), { krok: state.krok, etap: state.etap, klucz: state.klucz, at: F.serverTimestamp() });
    remote = { ...state };
    tries = 0;
  } catch (err) {
    console.warn('Nie udało się zapisać śladu na koncie.', err && err.code);
    if (++tries <= 5) retry = setTimeout(push, 3000 * tries);
  }
}

/** Czy postęp trafia na konto (do napisu pod notatką). */
export const savedOnAccount = () => Boolean(me && ready);
export const loggedIn = () => Boolean(me);

/**
 * Zalicza zagadkę n, ale tylko wtedy, gdy poprzednia jest już rozwiązana.
 * Zwraca 'new' (nowy ślad), 'again' (już rozwiązana) albo false (za wcześnie).
 */
export async function advance(n) {
  await whenSynced();
  if (state.krok >= n) return 'again';
  if (state.krok !== n - 1) return false;
  state.krok = n;
  save();
  emit();
  push();
  return 'new';
}

/** Zapamiętuje klucz do nagrania (po rozwiązaniu zagadki z kodem). */
export function setKey(hex) {
  if (!/^[0-9a-f]{64}$/.test(hex) || state.klucz === hex) return;
  state.klucz = hex;
  save();
  emit();
  push();
}

/** Zapisuje ukończony etap sekretnej gry. */
export function setStage(n) {
  if (n <= state.etap) return;
  state.etap = Math.min(STAGES, n);
  save();
  emit();
  push();
}

/* ---------- Notatki Pipa ---------- */

let audio = null;

/** Krótki szum jak z zepsutego głośnika. */
export function staticNoise(length = 0.35, volume = 0.12) {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    const n = Math.floor(audio.sampleRate * length);
    const buf = audio.createBuffer(1, n, audio.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (Math.random() < 0.08 ? 1 : 0.45);
    const src = audio.createBufferSource();
    src.buffer = buf;
    const f = audio.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 2200;
    f.Q.value = 0.6;
    const g = audio.createGain();
    const t0 = audio.currentTime;
    g.gain.setValueAtTime(volume, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + length);
    src.connect(f).connect(g).connect(audio.destination);
    src.start(t0);
  } catch {
    /* dźwięk niedostępny */
  }
}

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** To samo bez przycisku logowania (zwykły tekst). */
export function savedText() {
  if (savedOnAccount()) return 'Ślad zapisany na Twoim koncie.';
  if (ready || (fb && !me)) return 'Ślad zapisany w tej przeglądarce. Zaloguj się, żeby go nie zgubić.';
  return 'Ślad zapisany w tej przeglądarce.';
}

/** Napis pod notatką: gdzie zapisał się ślad. */
export function savedLine() {
  if (savedOnAccount()) return 'Ślad zapisany na Twoim koncie.';
  if (ready || (fb && !me)) return 'Ślad zapisany w tej przeglądarce. <button type="button" class="linklike" data-noc-login>Zaloguj się</button>, żeby go nie zgubić.';
  return 'Ślad zapisany w tej przeglądarce.';
}

/**
 * Notatka Pipa: ciemna kartka z tekstem pisanym na maszynie. Zwraca Promise, który kończy się po zamknięciu.
 * opcje: { kicker, next (jasna wskazówka, co zrobić dalej), link: { href, text } }
 */
export function whisper(text, { kicker = 'Notatka', next = '', link = null } = {}) {
  document.querySelectorAll('dialog.noc-note').forEach((d) => d.remove());
  const dlg = document.createElement('dialog');
  dlg.className = 'noc-note';
  dlg.setAttribute('aria-label', kicker);
  dlg.innerHTML = `
    <p class="noc-note-kicker">${esc(kicker)}</p>
    <p class="noc-note-text" aria-live="polite"></p>
    ${next ? `<div class="noc-note-next" hidden><p class="noc-note-next-label">Co dalej?</p><p>${esc(next)}</p></div>` : ''}
    ${link ? `<p class="noc-note-link"><a href="${esc(link.href)}">${esc(link.text)}</a></p>` : ''}
    <p class="noc-note-saved">${savedLine()}</p>
    <button type="button" class="noc-note-close" data-noc-close>Zamknij</button>`;
  document.body.appendChild(dlg);
  const box = dlg.querySelector('.noc-note-text');
  const nextBox = dlg.querySelector('.noc-note-next');
  const showNext = () => {
    if (nextBox) nextBox.hidden = false;
  };
  staticNoise();
  let timer = 0;
  if (reduceMotion()) {
    box.textContent = text;
    showNext();
  } else {
    // Tekst pojawia się znak po znaku, a czytnik ekranu dostaje go od razu w całości.
    box.setAttribute('aria-label', text);
    let i = 0;
    const tick = () => {
      i = Math.min(text.length, i + 1 + (Math.random() < 0.2 ? 1 : 0));
      box.textContent = text.slice(0, i);
      if (i < text.length) timer = setTimeout(tick, text[i - 1] === '\n' ? 200 : 16 + Math.random() * 22);
      else showNext();
    };
    // kliknięcie w tekst pokazuje go od razu w całości
    box.addEventListener('click', () => {
      clearTimeout(timer);
      box.textContent = text;
      showNext();
    });
    tick();
  }
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      dlg.remove();
      resolve();
    };
    dlg.addEventListener('click', async (e) => {
      if (e.target.closest('[data-noc-close]') || e.target === dlg) {
        dlg.close();
        return;
      }
      if (e.target.closest('[data-noc-login]') && fb) {
        const { openLogin } = await import('../logowanie.js');
        dlg.close();
        await openLogin(fb, { lede: 'Zaloguj się, a odkryte ślady zapiszą się na Twoim koncie.' });
      }
    });
    dlg.addEventListener('close', finish);
    dlg.showModal();
    dlg.querySelector('[data-noc-close]').focus({ preventScroll: true });
  });
}

/** Zniekształca tekst (do glitchy): zamienia część liter na podobne znaki i dokleja „zalgo”. */
export function corrupt(str, amount = 0.15) {
  const SWAP = { a: 'ą', e: 'ę', o: '0', i: '1', s: '$', z: 'ż', l: 'ł', c: 'ć', n: 'ń', A: '4', E: '3', O: 'Ø', I: '|', S: '5' };
  const MARKS = ['̀', '́', '̶', '̷', '̸', '̴', '̵', '̿', '͆', '͊'];
  return Array.from(String(str)).map((ch) => {
    if (ch === ' ' || Math.random() > amount) return ch;
    const base = Math.random() < 0.5 && SWAP[ch] ? SWAP[ch] : ch;
    return base + MARKS[Math.floor(Math.random() * MARKS.length)];
  }).join('');
}
