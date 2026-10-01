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
 * opcje: { kicker, link: { href, text } }
 */
export function whisper(text, { kicker = 'Notatka', link = null } = {}) {
  document.querySelectorAll('dialog.noc-note').forEach((d) => d.remove());
  const dlg = document.createElement('dialog');
  dlg.className = 'noc-note';
  dlg.setAttribute('aria-label', kicker);
  dlg.innerHTML = `
    <p class="noc-note-kicker">${esc(kicker)}</p>
    <p class="noc-note-text" aria-live="polite"></p>
    ${link ? `<p class="noc-note-link"><a href="${esc(link.href)}">${esc(link.text)}</a></p>` : ''}
    <p class="noc-note-saved">${savedLine()}</p>
    <button type="button" class="noc-note-close" data-noc-close>Zamknij</button>`;
  document.body.appendChild(dlg);
  const box = dlg.querySelector('.noc-note-text');
  staticNoise();
  let timer = 0;
  if (reduceMotion()) {
    box.textContent = text;
  } else {
    // Tekst pojawia się znak po znaku, a czytnik ekranu dostaje go od razu w całości.
    box.setAttribute('aria-label', text);
    let i = 0;
    const tick = () => {
      i = Math.min(text.length, i + 1 + (Math.random() < 0.2 ? 1 : 0));
      box.textContent = text.slice(0, i);
      if (i < text.length) timer = setTimeout(tick, text[i - 1] === '\n' ? 200 : 16 + Math.random() * 22);
    };
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
