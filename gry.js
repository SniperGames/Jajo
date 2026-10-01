/* Jajo: strona z grami. Lista gier, ekran gry, rekordy i tablice wyników. */
import {
  connect, isMember, isAdmin, watchUser, ensureProfile, avatarHtml, avatarFor,
} from './jajo-firebase.js';
import { openLogin } from './logowanie.js';
import { isMuted, setMuted, sfx, unlockAudio } from './gry/wspolne.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmt = (n) => Number(n || 0).toLocaleString('pl-PL');
const plural = (n, one, few, many) => {
  if (n === 1) return one;
  const d = n % 10;
  const h = n % 100;
  return d >= 2 && d <= 4 && (h < 12 || h > 14) ? few : many;
};
const BASE_TITLE = document.title;

// Nocne ślady: sekretna gra pojawia się na liście dopiero po rozwiązaniu wszystkich zagadek.
let noc = null;
const PIP_ART = `
  <svg viewBox="0 0 320 200" aria-hidden="true">
    <defs><linearGradient id="thSkyPip" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1C2240"/><stop offset="1" stop-color="#5B3A55"/></linearGradient></defs>
    <rect width="320" height="200" fill="url(#thSkyPip)"/>
    <circle cx="262" cy="40" r="18" fill="#F3F0D7" opacity=".9"/>
    <path d="M0 150q60-30 120-6t110-10 90 4V200H0z" fill="#2A2E45"/>
    <rect y="176" width="320" height="24" fill="#1B1E2E"/>
    <g class="pip-walk" transform="translate(150 150)">
      <ellipse cx="0" cy="8" rx="22" ry="21" fill="#E8C64A"/>
      <path d="M-4 -12c-1-7 4-9 5-2 1-6 7-5 4 3z" fill="#E8C64A"/>
      <ellipse cx="-8" cy="3" rx="3.4" ry="4.2" fill="#050505"/>
      <ellipse cx="8" cy="3" rx="3.4" ry="4.2" fill="#050505"/>
      <path d="M-4 10h8l-4 5z" fill="#C46A1C"/>
      <path d="M-6 28v8M6 28v8" stroke="#C46A1C" stroke-width="2.5" stroke-linecap="round"/>
    </g>
    <rect class="pip-tear" x="0" y="118" width="320" height="10" fill="#E0161B" opacity="0"/>
    <text x="14" y="24" fill="#E0161B" font-family="JetBrains Mono, monospace" font-size="12">● REC</text>
  </svg>`;

function pipCardHtml() {
  const st = noc.get();
  return `
    <article class="game-card game-card-noc" data-game="pip">
      <a class="game-thumb" href="pip.html" tabindex="-1" aria-hidden="true">${PIP_ART}</a>
      <div class="game-card-body">
        <p class="eyebrow">???</p>
        <h2 class="game-card-title"><a href="pip.html">Pip wraca do domu</a></h2>
        <p class="game-card-text">Pomóż pisklęciu wrócić do domu. Pięć etapów. Nie oglądaj się za siebie.</p>
        <dl class="game-facts">
          <div><dt>Etap</dt><dd>${st.etap} / 5</dd></div>
          <div><dt>Godzina</dt><dd>02:37</dd></div>
        </dl>
        <div class="noc-card-actions">
          <a class="btn btn-primary game-card-play" href="pip.html">${st.etap ? 'Graj dalej' : 'Graj'}</a>
          ${st.krok >= 8 && st.klucz ? '<a class="btn btn-ghost noc-cam-btn" href="cam05.html">● Kamera 05</a>' : ''}
        </div>
      </div>
    </article>`;
}

const ART = {
  'kury-z-procy': `
    <svg viewBox="0 0 320 200" aria-hidden="true">
      <defs><linearGradient id="thSky0" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8FD3F4"/><stop offset="1" stop-color="#E8F7FD"/></linearGradient></defs>
      <rect width="320" height="200" fill="url(#thSky0)"/>
      <ellipse cx="160" cy="196" rx="220" ry="40" fill="#A9D78E"/>
      <rect y="180" width="320" height="20" fill="#7CBF5E"/>
      <path d="M60 180V140M60 140l-10-26M60 140l12-26" stroke="#8A5A2B" stroke-width="9" stroke-linecap="round" fill="none"/>
      <path d="M78 110c40-40 90-50 128-30" stroke="#fff" stroke-width="3" stroke-dasharray="2 9" stroke-linecap="round" fill="none" opacity=".9"/>
      <g transform="translate(206 84) rotate(18)"><circle r="17" fill="#D7263D" stroke="#93182A" stroke-width="2.5"/><ellipse cx="4" cy="8" rx="10" ry="7" fill="#F7DDBB"/><circle cx="-4" cy="-17" r="5" fill="#FF7B7B"/><circle cx="3" cy="-19" r="6" fill="#FF7B7B"/><circle cx="5" cy="-6" r="4.5" fill="#fff"/><circle cx="7" cy="-6" r="2" fill="#15201C"/><path d="M1-12l9 3" stroke="#2A1206" stroke-width="3" stroke-linecap="round"/><path d="M14-2l11 3-11 4z" fill="#F4A300"/></g>
      <g stroke="#7A4D24" stroke-width="2"><rect x="236" y="120" width="8" height="60" fill="#C98B4A"/><rect x="284" y="120" width="8" height="60" fill="#C98B4A"/><rect x="230" y="112" width="68" height="9" fill="#C98B4A"/></g>
      <rect x="252" y="80" width="26" height="32" fill="rgba(186,228,250,.85)" stroke="#6FAFD3" stroke-width="2"/>
      <path d="M264 150c9 0 14 12 14 20 0 7-6 11-14 11s-14-4-14-11c0-8 5-20 14-20z" fill="#BFD08C" stroke="#5C7434" stroke-width="2"/>
      <circle cx="259" cy="164" r="3" fill="#fff"/><circle cx="269" cy="164" r="3" fill="#fff"/><circle cx="258" cy="164" r="1.4" fill="#1B2414"/><circle cx="268" cy="164" r="1.4" fill="#1B2414"/>
      <path d="M260 174q4-3 8 0" stroke="#3E4F22" stroke-width="2" fill="none"/>
    </svg>`,
  'lap-jajka': `
    <svg viewBox="0 0 320 200" aria-hidden="true">
      <defs><linearGradient id="thSky1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9FD8F2"/><stop offset="1" stop-color="#EAF7FC"/></linearGradient></defs>
      <rect width="320" height="200" fill="url(#thSky1)"/>
      <circle cx="285" cy="28" r="16" fill="#FFD65C"/>
      <rect y="46" width="320" height="8" fill="#8A5A33"/>
      <g><ellipse cx="80" cy="34" rx="20" ry="15" fill="#FFFDF7" stroke="#D9C7A8" stroke-width="2"/><circle cx="95" cy="22" r="9" fill="#FFFDF7" stroke="#D9C7A8" stroke-width="2"/><circle cx="93" cy="12" r="4" fill="#D7263D"/><path d="M103 21l8 3-8 3z" fill="#F4A300"/><circle cx="97" cy="21" r="1.8" fill="#15201C"/></g>
      <g><ellipse cx="220" cy="34" rx="20" ry="15" fill="#C77F45" stroke="#9C5A2A" stroke-width="2"/><circle cx="235" cy="22" r="9" fill="#C77F45" stroke="#9C5A2A" stroke-width="2"/><circle cx="233" cy="12" r="4" fill="#D7263D"/><path d="M243 21l8 3-8 3z" fill="#F4A300"/><circle cx="237" cy="21" r="1.8" fill="#15201C"/></g>
      <path d="M80 72c6 0 10 10 10 17 0 6-4 9-10 9s-10-3-10-9c0-7 4-17 10-17z" fill="#FFF6E8" stroke="#D9B98C" stroke-width="2"/>
      <path d="M220 100c6 0 10 10 10 17 0 6-4 9-10 9s-10-3-10-9c0-7 4-17 10-17z" fill="#FFD54A" stroke="#C99700" stroke-width="2"/>
      <path d="M150 120c6 0 10 10 10 17 0 6-4 9-10 9s-10-3-10-9c0-7 4-17 10-17z" fill="#E9C39B" stroke="#B98A5C" stroke-width="2"/>
      <rect y="178" width="320" height="22" fill="#86C46A"/>
      <path d="M124 150h56l-8 28h-40z" fill="#C98B4A" stroke="#8A5A2B" stroke-width="2"/><rect x="120" y="146" width="64" height="7" fill="#A86C35"/>
    </svg>`,
  'lot-kurczaka': `
    <svg viewBox="0 0 320 200" aria-hidden="true">
      <defs><linearGradient id="thSky2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8FD0F0"/><stop offset="1" stop-color="#F2FAFD"/></linearGradient></defs>
      <rect width="320" height="200" fill="url(#thSky2)"/>
      <ellipse cx="60" cy="182" rx="110" ry="40" fill="#C6E6B3"/><ellipse cx="260" cy="186" rx="120" ry="44" fill="#C6E6B3"/>
      <g fill="#DCCDB0" stroke="#B19D78" stroke-width="2"><rect x="196" y="0" width="48" height="62"/><rect x="192" y="56" width="56" height="9"/><rect x="196" y="128" width="48" height="56"/><rect x="192" y="128" width="56" height="9"/></g>
      <g fill="#C9B793"><circle cx="208" cy="22" r="5"/><circle cx="220" cy="22" r="5"/><circle cx="232" cy="22" r="5"/><circle cx="208" cy="160" r="5"/><circle cx="220" cy="160" r="5"/><circle cx="232" cy="160" r="5"/></g>
      <rect y="184" width="320" height="16" fill="#7CBF5E"/>
      <path d="M58 92h26M50 104h30M60 116h20" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".85"/>
      <g transform="translate(118 100) rotate(-12)"><ellipse rx="22" ry="19" fill="#FFD23F" stroke="#E0A100" stroke-width="2.5"/><ellipse cx="-8" cy="-2" rx="11" ry="7" fill="#FFC300" stroke="#E0A100" stroke-width="2" transform="rotate(-40 -8 -2)"/><circle cx="9" cy="-5" r="3" fill="#15201C"/><path d="M18-4l11 4-11 4z" fill="#F28C00"/></g>
    </svg>`,
  'jajo-2048': `
    <svg viewBox="0 0 320 200" aria-hidden="true">
      <rect width="320" height="200" fill="#E9DFCB"/>
      <rect x="40" y="16" width="240" height="168" rx="14" fill="#CDBF9F"/>
      <g font-family="JetBrains Mono, monospace" font-weight="800" font-size="16" text-anchor="middle">
        <rect x="52" y="28" width="66" height="66" rx="10" fill="#F6EEDF"/><text x="85" y="86" fill="#5C4A2E">2</text>
        <rect x="127" y="28" width="66" height="66" rx="10" fill="#F1D49C"/><text x="160" y="86" fill="#5C4A2E">8</text>
        <rect x="202" y="28" width="66" height="66" rx="10" fill="#EF9A3C"/><text x="235" y="86" fill="#fff">64</text>
        <rect x="52" y="106" width="66" height="66" rx="10" fill="#C9583A"/><text x="85" y="164" fill="#fff">512</text>
        <rect x="127" y="106" width="66" height="66" rx="10" fill="#F3E3C2"/><text x="160" y="164" fill="#5C4A2E">4</text>
        <rect x="202" y="106" width="66" height="66" rx="10" fill="#E5B400"/><text x="235" y="164" fill="#fff">2048</text>
      </g>
      <g stroke-width="2"><path d="M85 38c7 0 11 11 11 19 0 6-5 10-11 10s-11-4-11-10c0-8 4-19 11-19z" fill="#FFF6E8" stroke="#D9B98C"/><path d="M235 116c7 0 11 11 11 19 0 6-5 10-11 10s-11-4-11-10c0-8 4-19 11-19z" fill="#FFD54A" stroke="#A87C00"/></g>
    </svg>`,
  pary: `
    <svg viewBox="0 0 320 200" aria-hidden="true">
      <rect width="320" height="200" fill="#F4ECDC"/>
      <g stroke="#B19D78" stroke-width="2">
        <rect x="28" y="30" width="58" height="140" rx="10" fill="#E2D3B5"/><rect x="100" y="30" width="58" height="140" rx="10" fill="#FFFDF8"/><rect x="172" y="30" width="58" height="140" rx="10" fill="#E2D3B5"/><rect x="244" y="30" width="58" height="140" rx="10" fill="#FFFDF8"/>
      </g>
      <g fill="#CDBB96"><circle cx="57" cy="80" r="11"/><circle cx="57" cy="120" r="11"/><circle cx="201" cy="80" r="11"/><circle cx="201" cy="120" r="11"/></g>
      <path d="M129 62c13 0 21 22 21 37 0 12-9 20-21 20s-21-8-21-20c0-15 8-37 21-37z" fill="#D7263D"/>
      <path d="M273 62c13 0 21 22 21 37 0 12-9 20-21 20s-21-8-21-20c0-15 8-37 21-37z" fill="#D7263D"/>
      <g fill="none" stroke="#FFF6E8" stroke-width="3"><path d="M110 88l5-5 5 5 5-5 5 5 5-5 5 5 5-5"/><path d="M109 102l5-5 5 5 5-5 5 5 5-5 5 5 5-5"/><path d="M254 88l5-5 5 5 5-5 5 5 5-5 5 5 5-5"/><path d="M253 102l5-5 5 5 5-5 5 5 5-5 5 5 5-5"/></g>
      <path d="M150 160l12-10 12 10" fill="none" stroke="#2E9E5B" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
};

const GAMES = [
  {
    id: 'kury-z-procy',
    href: 'procy.html',
    name: 'Kury z procy',
    kind: 'Nowość · 15 poziomów',
    blurb: 'Wystrzel kury z procy i rozbij twierdze zgniłych jajek. Każda kura ma swoją moc, a postęp się zapisuje.',
  },
  {
    id: 'lap-jajka',
    maxw: '440px',
    name: 'Łap jajka',
    kind: 'Zręcznościowa',
    blurb: 'Kury znoszą jajka coraz szybciej. Łap je do koszyka, zanim rozbiją się o ziemię.',
    controls: 'Mysz, strzałki ← → albo palec',
    ratio: '2 / 3',
    howto: `
      <ul class="howto-list">
        <li><b>Zwykłe jajko</b>: 1 punkt. Gdy spadnie na ziemię, tracisz jedno z trzech żyć.</li>
        <li><b>Złote jajko</b>: 5 punktów. Jego upadek nic nie kosztuje.</li>
        <li><b>Zgniłe jajko</b> (zielone, z muchami): nie łap! Kosztuje życie.</li>
        <li>Kura z wykrzyknikiem za chwilę zniesie jajko. Co 12 punktów robi się szybciej.</li>
      </ul>`,
  },
  {
    id: 'lot-kurczaka',
    maxw: '440px',
    name: 'Lot kurczaka',
    kind: 'Jedno stuknięcie',
    blurb: 'Przeprowadź kurczaka między stosami wytłaczanek. Każdy minięty stos to punkt.',
    controls: 'Kliknięcie, spacja albo stuknięcie palcem',
    ratio: '2 / 3',
    howto: `
      <ul class="howto-list">
        <li>Każde kliknięcie, spacja albo stuknięcie to jedno machnięcie skrzydłami.</li>
        <li>Nie dotykaj wytłaczanek ani ziemi.</li>
        <li>Z każdym punktem kurczak leci trochę szybciej, a szczeliny robią się węższe.</li>
      </ul>`,
  },
  {
    id: 'jajo-2048',
    maxw: '540px',
    name: 'Jajo 2048',
    kind: 'Łamigłówka',
    blurb: 'Łącz takie same kafelki. Z jajka zrobisz sadzone, potem pisankę, kurę i w końcu złotą kurę.',
    controls: 'Strzałki, WASD albo przesunięcie palcem',
    ratio: '1 / 1',
  },
  {
    id: 'pary',
    maxw: '500px',
    name: 'Pary pisanek',
    kind: 'Pamięć',
    blurb: 'Odkrywaj karty i znajdź osiem par takich samych pisanek. Liczy się czas i liczba ruchów.',
    controls: 'Kliknięcie albo stuknięcie w kartę',
    ratio: '4 / 5',
  },
];
const byId = Object.fromEntries(GAMES.map((g) => [g.id, g]));

const ICON = {
  pause: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>',
  sound: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h4l5-4v13l-5-4H4z"/><path d="M16.5 9a4.5 4.5 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11"/></svg>',
  mute: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h4l5-4v13l-5-4H4z"/><path d="M17 9.5l5 5M22 9.5l-5 5"/></svg>',
  trophy: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4"/></svg>',
};

/* ---------- Stan ---------- */

const hub = $('#gamesHub');
const view = $('#gameView');

let fb = null;
let me = null;
let myName = '';
let admin = false;
let boards = false; // czy w bazie są reguły dla tablic wyników
const mine = {}; // najlepsze wyniki zalogowanego na tablicy
const leaders = {};

let current = null; // { meta, game, state, score, session, startedAt }
let loadToken = 0;
let fromHub = false;

const store = {
  best(id) {
    try {
      return Number(localStorage.getItem('jajo:gry:rekord:' + id)) || 0;
    } catch {
      return 0;
    }
  },
  setBest(id, v) {
    try {
      localStorage.setItem('jajo:gry:rekord:' + id, String(v));
    } catch {
      /* pamięć przeglądarki niedostępna */
    }
  },
};
const bestOf = (id) => Math.max(store.best(id), mine[id] || 0);
// Gwiazdki z Kur z procy: z przeglądarki albo z konta (większa liczba).
function procyStars() {
  let local = 0;
  try {
    const p = JSON.parse(localStorage.getItem('jajo:procy:postep'));
    if (p && p.levels) local = Object.values(p.levels).reduce((a, l) => a + (Number(l.g) || 0), 0);
  } catch {
    /* pamięć przeglądarki niedostępna */
  }
  return Math.max(local, mine['kury-z-procy'] || 0);
}

/* ---------- Lista gier ---------- */

function renderHub() {
  $('#gamesGrid').innerHTML = (noc && noc.step() >= 7 ? pipCardHtml() : '') + GAMES.map((g) => {
    const best = bestOf(g.id);
    const lead = leaders[g.id];
    const href = g.href || `#${g.id}`;
    const stars = g.href ? procyStars() : 0;
    return `
      <article class="game-card${g.href ? ' game-card-big' : ''}" data-game="${g.id}">
        <a class="game-thumb" href="${href}" tabindex="-1" aria-hidden="true">${ART[g.id]}</a>
        <div class="game-card-body">
          <p class="eyebrow">${esc(g.kind)}</p>
          <h2 class="game-card-title"><a href="${href}">${esc(g.name)}</a></h2>
          <p class="game-card-text">${esc(g.blurb)}</p>
          <dl class="game-facts">
            ${g.href
              ? `<div><dt>Twoje gwiazdki</dt><dd>★ ${stars} / 45</dd></div>`
              : `<div><dt>Twój rekord</dt><dd>${best ? fmt(best) : '–'}</dd></div>`}
            <div><dt>Lider</dt><dd>${lead ? `${esc(lead.name)} · ${fmt(lead.score)}` : boards ? 'Wolne miejsce!' : '–'}</dd></div>
          </dl>
          <a class="btn btn-primary game-card-play" href="${href}">Graj</a>
        </div>
      </article>`;
  }).join('');
}

async function loadLeaders() {
  if (!fb || !boards) return;
  const { F, db } = fb;
  await Promise.all(GAMES.map(async (g) => {
    try {
      const col = g.href ? F.collection(db, 'procy') : F.collection(db, 'wyniki', g.id, 'gracze');
      const snap = await F.getDocs(F.query(col, F.orderBy('score', 'desc'), F.limit(1)));
      leaders[g.id] = snap.empty ? null : snap.docs[0].data();
    } catch {
      leaders[g.id] = null;
    }
  }));
  if (!hub.hidden) renderHub();
}

async function loadMine() {
  GAMES.forEach((g) => { delete mine[g.id]; });
  if (!fb || !boards || !me) return;
  const { F, db } = fb;
  await Promise.all(GAMES.map(async (g) => {
    try {
      const snap = await F.getDoc(g.href ? F.doc(db, 'procy', me.uid) : F.doc(db, 'wyniki', g.id, 'gracze', me.uid));
      if (snap.exists()) mine[g.id] = g.href ? snap.data().stars : snap.data().score;
    } catch {
      /* brak dostępu */
    }
  }));
}

/* ---------- Ekran gry ---------- */

function showHub() {
  closeGame();
  view.hidden = true;
  view.innerHTML = '';
  hub.hidden = false;
  document.title = BASE_TITLE;
  renderHub();
  loadLeaders();
}

async function openGame(id) {
  const meta = byId[id];
  if (current && current.meta.id === id) return;
  closeGame();
  const token = ++loadToken;
  hub.hidden = true;
  view.hidden = false;
  document.title = `${meta.name} – Gry z jajem – Jajo`;
  view.innerHTML = `
    <a class="ft-back" href="gry.html" data-back>← Wszystkie gry</a>
    <div class="game-layout">
      <div class="game-main">
        <div class="game-play" style="--ratio: ${meta.ratio}; --maxw: ${meta.maxw}">
          <header class="game-head">
            <p class="eyebrow">${esc(meta.kind)}</p>
            <h1 class="game-title">${esc(meta.name)}</h1>
          </header>
          <div class="game-hud">
            <p class="hud-box"><span>Punkty</span><b data-hud-score>0</b></p>
            <p class="hud-box"><span>Rekord</span><b data-hud-best>${fmt(bestOf(id))}</b></p>
            <div class="hud-btns">
              <button type="button" class="hud-btn" data-pause aria-label="Pauza" disabled>${ICON.pause}</button>
              <button type="button" class="hud-btn" data-sound aria-pressed="${!isMuted()}" aria-label="Dźwięk">${isMuted() ? ICON.mute : ICON.sound}</button>
            </div>
          </div>
          <div class="game-stage" data-game="${id}" tabindex="-1">
            <div class="game-overlay" aria-live="polite"></div>
          </div>
        </div>
      </div>
      <aside class="game-side">
        <section class="board" aria-labelledby="boardTitle">
          <h2 id="boardTitle">${ICON.trophy}Tablica wyników</h2>
          <div class="board-body"><p class="note">Wczytuję…</p></div>
        </section>
        <section class="howto" aria-labelledby="howtoTitle">
          <h2 id="howtoTitle">Jak grać</h2>
          <div class="howto-body"><p class="note">Wczytuję…</p></div>
        </section>
      </aside>
    </div>`;
  window.scrollTo(0, 0);
  const stage = $('.game-stage', view);
  let mod;
  try {
    mod = await import(`./gry/${id}.js`);
  } catch (err) {
    console.error(err);
    if (token === loadToken) $('.game-overlay', view).innerHTML = '<div class="ov-card"><p class="ov-text">Nie udało się wczytać gry. Odśwież stronę.</p></div>';
    return;
  }
  if (token !== loadToken) return;
  $('.howto-body', view).innerHTML = meta.howto || mod.howto || '';
  current = { meta, state: 'start', score: 0, session: null, startedAt: 0 };
  current.game = mod.default(stage, {
    onScore(n) {
      if (!current) return;
      current.score = n;
      const el = $('[data-hud-score]', view);
      if (el) el.textContent = fmt(n);
    },
    onOver(n) {
      // Także gdy ktoś zapauzował w chwili porażki (np. kurczak już spadał).
      if (current && (current.state === 'play' || current.state === 'paused')) gameOver(n);
    },
    // Nocne ślady: trzy złapane zgniłe jajka w jednej grze (o ile poprzednia zagadka jest rozwiązana).
    onRotten(n) {
      if (n !== 3 || !noc || !current || current.meta.id !== 'lap-jajka' || noc.step() < 6) return;
      current.nocWin = true;
      if (current.game.glitch) current.game.glitch();
      noc.staticNoise(0.7, 0.16);
    },
  });
  overlay('start');
  renderBoard();
}

function closeGame() {
  loadToken++;
  if (current && current.game) current.game.destroy();
  current = null;
}

function overlay(kind, info = {}) {
  const box = $('.game-overlay', view);
  if (!box || !current) return;
  const m = current.meta;
  const pauseBtn = $('[data-pause]', view);
  if (pauseBtn) pauseBtn.disabled = kind !== 'none';
  if (kind === 'none') {
    box.hidden = true;
    box.innerHTML = '';
    return;
  }
  box.hidden = false;
  const loginHint = boards && !me
    ? '<p class="ov-small">Zaloguj się, a Twój najlepszy wynik trafi na tablicę. <button type="button" class="linklike" data-login>Zaloguj się</button></p>'
    : '';
  if (kind === 'start') {
    box.innerHTML = `
      <div class="ov-card">
        <p class="ov-kicker">${esc(m.kind)}</p>
        <h2 class="ov-title">${esc(m.name)}</h2>
        <p class="ov-text">${esc(m.controls)}</p>
        <button type="button" class="btn btn-primary ov-play" data-play>Graj</button>
        ${loginHint}
      </div>`;
  } else if (kind === 'paused') {
    box.innerHTML = `
      <div class="ov-card">
        <h2 class="ov-title">Pauza</h2>
        <div class="ov-actions">
          <button type="button" class="btn btn-primary" data-resume>Wznów</button>
          <button type="button" class="btn btn-ghost" data-play>Od nowa</button>
        </div>
      </div>`;
  } else if (kind === 'over') {
    box.innerHTML = `
      <div class="ov-card">
        <p class="ov-kicker">${info.record ? 'Nowy rekord!' : 'Koniec gry'}</p>
        <p class="ov-score"><b>${fmt(info.score)}</b> ${plural(info.score, 'punkt', 'punkty', 'punktów')}</p>
        <p class="ov-text">Twój rekord: ${fmt(bestOf(m.id))}</p>
        <p class="ov-status">${info.status || ''}</p>
        <div class="ov-actions">
          <button type="button" class="btn btn-primary" data-play>Jeszcze raz</button>
          <a class="btn btn-ghost" href="gry.html" data-back>Inne gry</a>
        </div>
        ${info.status ? '' : loginHint}
      </div>`;
  }
  const first = $('[data-play], [data-resume]', box);
  if (first) first.focus({ preventScroll: true });
}

function play() {
  if (!current) return;
  const m = current.meta;
  current.state = 'play';
  current.score = 0;
  current.startedAt = Date.now();
  current.session = null;
  // Zalogowany: serwer zapisuje godzinę startu, żeby wynik dało się wpisać na tablicę.
  if (fb && boards && me) {
    const { F, db } = fb;
    current.session = F.setDoc(F.doc(db, 'sesje_gier', me.uid), { game: m.id, startedAt: F.serverTimestamp() })
      .then(() => true)
      .catch((err) => {
        console.warn('Nie udało się zacząć sesji gry.', err && err.code);
        return false;
      });
  }
  unlockAudio();
  overlay('none');
  current.game.start();
  $('.game-stage', view).focus({ preventScroll: true });
}

function pause() {
  if (!current || current.state !== 'play') return;
  current.state = 'paused';
  current.game.pause();
  overlay('paused');
}

function resume() {
  if (!current || current.state !== 'paused') return;
  current.state = 'play';
  overlay('none');
  current.game.resume();
  $('.game-stage', view).focus({ preventScroll: true });
}

async function gameOver(score) {
  const c = current;
  const m = c.meta;
  c.state = 'over';
  const localBefore = bestOf(m.id);
  if (score > store.best(m.id)) store.setBest(m.id, score);
  const record = score > 0 && score > localBefore;
  $('[data-hud-best]', view).textContent = fmt(bestOf(m.id));
  let status = '';
  const boardBefore = mine[m.id] || 0;
  if (boards && me && c.session) {
    if (score > boardBefore) {
      status = 'Zapisuję wynik na tablicy…';
    } else if (boardBefore) {
      status = `Twój wynik na tablicy: ${fmt(boardBefore)}.`;
    }
  }
  overlay('over', { score, record, status });
  if (c.nocWin) {
    setTimeout(async () => {
      const res = await noc.advance(7);
      if (res && current === c) noc.whisper(noc.t('n7'), { kicker: 'Łap jajka', link: { href: 'gry.html', text: 'Lista gier' } });
    }, 1700);
  }
  if (!(boards && me && c.session && score > boardBefore)) return;
  const saved = await submit(c, score);
  if (current !== c) return;
  const statusEl = $('.ov-status', view);
  if (saved) {
    const rank = await rankOf(m.id, score);
    if (statusEl && current === c) statusEl.textContent = rank ? `Jesteś na ${rank}. miejscu na tablicy!` : 'Wynik zapisany na tablicy.';
    renderBoard();
  } else if (statusEl) {
    statusEl.textContent = 'Nie udało się zapisać wyniku na tablicy. Spróbuj zagrać jeszcze raz.';
  }
}

async function submit(c, score) {
  const { F, db } = fb;
  if (!(await c.session)) return false;
  try {
    if (!myName) {
      const p = await ensureProfile(fb, me);
      myName = (p && p.name) || '';
    }
    const batch = F.writeBatch(db);
    batch.set(F.doc(db, 'wyniki', c.meta.id, 'gracze', me.uid), {
      score,
      name: (myName.length >= 2 ? myName : 'Kucharz').slice(0, 40),
      at: F.serverTimestamp(),
    });
    batch.delete(F.doc(db, 'sesje_gier', me.uid));
    await batch.commit();
    mine[c.meta.id] = score;
    sfx('win');
    return true;
  } catch (err) {
    console.error(err);
    return false;
  }
}

async function rankOf(id, score) {
  try {
    const { F, db } = fb;
    const higher = await F.getCountFromServer(F.query(F.collection(db, 'wyniki', id, 'gracze'), F.where('score', '>', score)));
    return higher.data().count + 1;
  } catch {
    return 0;
  }
}

/* ---------- Tablica wyników ---------- */

async function renderBoard() {
  const body = $('.board-body', view);
  if (!body || !current) return;
  const id = current.meta.id;
  if (!fb || !boards) {
    body.innerHTML = '<p class="note">Tablice wyników ruszą wkrótce. Twój rekord zapisujemy na tym urządzeniu.</p>';
    return;
  }
  const { F, db } = fb;
  const col = F.collection(db, 'wyniki', id, 'gracze');
  try {
    const [snap, total] = await Promise.all([
      F.getDocs(F.query(col, F.orderBy('score', 'desc'), F.limit(10))),
      F.getCountFromServer(col),
    ]);
    if (!current || current.meta.id !== id) return;
    const rows = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
    const count = total.data().count;
    const myScore = me ? mine[id] || 0 : 0;
    const inTop = me && rows.some((r) => r.uid === me.uid);
    let footer = '';
    if (!me) {
      footer = '<p class="board-me">Zaloguj się, żeby trafić na tablicę. <button type="button" class="linklike" data-login>Zaloguj się</button></p>';
    } else if (!myScore) {
      footer = '<p class="board-me">Zagraj, a Twój wynik pojawi się na tablicy.</p>';
    } else if (!inTop) {
      const rank = await rankOf(id, myScore);
      footer = `<p class="board-me">Ty: <b>${rank}. miejsce</b> z ${fmt(count)} · ${fmt(myScore)} pkt</p>`;
    }
    body.innerHTML = `
      ${rows.length ? `<ol class="board-list">${rows.map((r) => {
        const rank = 1 + rows.filter((x) => x.score > r.score).length;
        return `
          <li class="brow${me && r.uid === me.uid ? ' is-me' : ''}">
            <span class="brank${rank <= 3 ? ' medal-' + rank : ''}">${rank}</span>
            <span class="bav" data-av="${esc(r.uid)}">${avatarHtml(r.name, r.uid)}</span>
            <a class="bname" href="profil.html#${esc(r.uid)}">${esc(r.name)}</a>
            <b class="bscore">${fmt(r.score)}</b>
            ${admin ? `<button type="button" class="bdel" data-del="${esc(r.uid)}" aria-label="Usuń wynik: ${esc(r.name)}">×</button>` : ''}
          </li>`;
      }).join('')}</ol>` : '<p class="note">Jeszcze nikt tu nie zagrał. Pierwsze miejsce czeka!</p>'}
      ${count > 0 ? `<p class="board-count">${fmt(count)} ${plural(count, 'gracz', 'graczy', 'graczy')} na tablicy</p>` : ''}
      ${footer}`;
    // Zdjęcia profilowe i aktualne imiona
    [...new Set(rows.map((r) => r.uid))].forEach(async (uid) => {
      const av = await avatarFor(fb, uid);
      $$('[data-av]', body).filter((el) => el.dataset.av === uid).forEach((el) => {
        if (av.src) el.innerHTML = avatarHtml(av.name, uid, '', av.src);
        const name = el.nextElementSibling;
        if (av.name && name) name.textContent = av.name;
      });
    });
  } catch (err) {
    console.error(err);
    body.innerHTML = '<p class="note">Nie udało się wczytać tablicy wyników.</p>';
  }
}

/* ---------- Zdarzenia ---------- */

function goHub() {
  if (fromHub) {
    history.back();
  } else {
    history.replaceState(null, '', location.pathname + location.search);
    showHub();
  }
}

function route(viaHash) {
  const id = location.hash.slice(1);
  if (byId[id] && byId[id].href) {
    location.replace(byId[id].href);
    return;
  }
  if (byId[id]) {
    fromHub = viaHash && !hub.hidden;
    openGame(id);
  } else {
    showHub();
  }
}

document.addEventListener('click', async (e) => {
  if (e.target.closest('[data-back]')) {
    e.preventDefault();
    goHub();
    return;
  }
  if (e.target.closest('[data-play]')) {
    play();
    return;
  }
  if (e.target.closest('[data-resume]')) {
    resume();
    return;
  }
  if (e.target.closest('[data-pause]')) {
    pause();
    return;
  }
  const sound = e.target.closest('[data-sound]');
  if (sound) {
    setMuted(!isMuted());
    if (!isMuted()) unlockAudio();
    sound.setAttribute('aria-pressed', String(!isMuted()));
    sound.innerHTML = isMuted() ? ICON.mute : ICON.sound;
    return;
  }
  if (e.target.closest('[data-login]') && fb) {
    if (current && current.state === 'play') pause();
    openLogin(fb, { lede: 'Zaloguj się, a Twój najlepszy wynik trafi na tablicę. Grać możesz też bez logowania.' });
    return;
  }
  const del = e.target.closest('[data-del]');
  if (del && admin && current) {
    if (!del.classList.contains('is-confirm')) {
      del.classList.add('is-confirm');
      del.textContent = 'Usunąć?';
      return;
    }
    try {
      await fb.F.deleteDoc(fb.F.doc(fb.db, 'wyniki', current.meta.id, 'gracze', del.dataset.del));
      renderBoard();
    } catch (err) {
      console.error(err);
      del.textContent = 'Błąd';
    }
  }
});

window.addEventListener('keydown', (e) => {
  if (!current || view.hidden) return;
  if (e.target.closest && e.target.closest('input, textarea, select, dialog')) return;
  const onControl = e.target.closest && e.target.closest('button, a');
  if ((e.key === 'Enter' || e.key === ' ') && !onControl && (current.state === 'start' || current.state === 'over')) {
    e.preventDefault();
    e.stopImmediatePropagation();
    play();
  } else if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && current.state === 'play') {
    e.preventDefault();
    pause();
  } else if ((e.key === 'p' || e.key === 'P') && current.state === 'paused') {
    e.preventDefault();
    resume();
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') pause();
});
window.addEventListener('blur', () => pause());
window.addEventListener('hashchange', () => route(true));

/* ---------- Start ---------- */

renderHub();
route(false);

import('./noc/rdzen.js').then(async (m) => {
  noc = m;
  if (m.step() < 8) await m.whenSynced();
  if (!hub.hidden) renderHub();
  m.onChange(() => {
    if (!hub.hidden) renderHub();
  });
}).catch(() => {});

(async function start() {
  fb = await connect();
  if (!fb) return;
  const { F, db } = fb;
  try {
    await F.getDocs(F.query(F.collection(db, 'wyniki', 'lap-jajka', 'gracze'), F.limit(1)));
    boards = true;
  } catch (err) {
    console.warn('Tablice wyników są wyłączone: brak reguł w Firestore.', err && err.code);
  }
  loadLeaders();
  watchUser(fb, async (u) => {
    me = isMember(u) ? u : null;
    myName = '';
    admin = false;
    if (me) {
      const [p, adm] = await Promise.all([ensureProfile(fb, me), isAdmin(fb, me.uid)]);
      myName = (p && p.name) || '';
      admin = adm;
    }
    await loadMine();
    if (!hub.hidden) renderHub();
    if (current) {
      const best = $('[data-hud-best]', view);
      if (best) best.textContent = fmt(bestOf(current.meta.id));
      if (current.state === 'start') overlay('start');
      renderBoard();
    }
  });
})();
