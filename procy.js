/* Jajo: strona gry „Kury z procy”. Wybór poziomów, zapis postępu (przeglądarka i konto), tablica wyników i ekrany gry. */
import {
  connect, isMember, isAdmin, watchUser, ensureProfile, avatarHtml, avatarFor,
} from './jajo-firebase.js';
import { openLogin } from './logowanie.js';
import { isMuted, setMuted, unlockAudio, sfx } from './gry/wspolne.js';
import { LEVELS, CHAPTERS } from './gry/procy/poziomy.js';
import { HENS, withStars } from './gry/procy/swiat.js';
import { drawHenPx } from './gry/procy/rysunki.js';
import { createGame } from './gry/procy/gra.js';

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
const KEY = 'jajo:procy:postep';
const SEEN = 'jajo:procy:kury';
const BASE_TITLE = document.title;
const LOCK = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/></svg>';
const HEN_ORDER = ['kokoszka', 'pisklaki', 'rakieta', 'bomba', 'nioska', 'kogut'];

const menu = $('#procyMenu');
const playView = $('#procyPlay');
const stage = $('#procyStage');
const overlay = $('#procyOverlay');

let fb = null;
let me = null;
let myName = '';
let admin = false;
let ready = false; // czy w bazie są reguły dla postępu w tej grze
let remote = null;
let syncTimer = null;
let syncTries = 0;
let game = null;
let current = null; // obecny poziom (z progami gwiazdek)
let fromMenu = false;
let rotateSkipped = false;

/* ---------- Postęp ---------- */

function store(key, value) {
  try {
    if (value === undefined) return JSON.parse(localStorage.getItem(key));
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* pamięć przeglądarki niedostępna */
  }
  return null;
}

function clean(levels) {
  const out = {};
  for (const [k, v] of Object.entries(levels || {})) {
    const id = Number(k);
    if (!LEVELS.some((l) => l.id === id) || !v) continue;
    const s = Math.max(0, Math.floor(Number(v.s) || 0));
    const g = Math.max(1, Math.min(3, Math.floor(Number(v.g) || 1)));
    out[id] = { s, g };
  }
  return out;
}

let progress = { levels: clean((store(KEY) || {}).levels) };
const seen = new Set(Array.isArray(store(SEEN)) ? store(SEEN) : []);

const totals = (levels = progress.levels) => Object.values(levels).reduce(
  (a, l) => ({ stars: a.stars + l.g, score: a.score + l.s }),
  { stars: 0, score: 0 },
);
const unlocked = (id) => id === 1 || Boolean(progress.levels[id - 1]);

function merge(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    const o = out[k];
    out[k] = o ? { s: Math.max(o.s, v.s), g: Math.max(o.g, v.g) } : v;
  }
  return out;
}

function saveLocal() {
  store(KEY, { levels: progress.levels });
}

function setSync(text) {
  $('#procySync').innerHTML = text;
}

function syncNote() {
  if (!ready) setSync('Postęp zapisuje się na tym urządzeniu.');
  else if (!me) setSync('Postęp zapisuje się na tym urządzeniu. <button type="button" class="linklike" data-act="login">Zaloguj się</button>, żeby mieć go na każdym urządzeniu i&nbsp;trafić na tablicę.');
}

async function pullAccount() {
  if (!fb || !ready || !me) return;
  const { F, db } = fb;
  try {
    const snap = await F.getDoc(F.doc(db, 'procy', me.uid));
    remote = snap.exists() ? snap.data() : null;
    if (remote) {
      progress.levels = merge(progress.levels, clean(remote.levels));
      saveLocal();
    }
    const t = totals();
    if (!remote || t.score !== remote.score || t.stars !== remote.stars || Object.keys(progress.levels).length !== Object.keys(remote.levels || {}).length) {
      if (Object.keys(progress.levels).length) scheduleSync(0);
    } else {
      setSync('Postęp zapisany na Twoim koncie.');
    }
    renderMenu();
  } catch (err) {
    console.warn('Nie udało się wczytać postępu z konta.', err && err.code);
  }
}

function scheduleSync(delay = 600) {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(pushAccount, delay);
}

async function pushAccount() {
  if (!fb || !ready || !me) return;
  const { F, db } = fb;
  const t = totals();
  const levels = Object.fromEntries(Object.entries(progress.levels).map(([k, v]) => [k, { s: v.s, g: v.g }]));
  try {
    if (!myName) {
      const p = await ensureProfile(fb, me);
      myName = (p && p.name) || '';
    }
    await F.setDoc(F.doc(db, 'procy', me.uid), {
      name: (myName.length >= 2 ? myName : 'Kucharz').slice(0, 40),
      score: t.score,
      stars: t.stars,
      levels,
      at: F.serverTimestamp(),
    });
    remote = { score: t.score, stars: t.stars, levels };
    syncTries = 0;
    setSync('Postęp zapisany na Twoim koncie.');
    renderBoard();
  } catch (err) {
    // Reguły pozwalają zapisać postęp najwyżej co kilka sekund, więc próbujemy ponownie.
    if (syncTries++ < 6) scheduleSync(6000);
    else setSync('Nie udało się zapisać postępu na koncie. Na tym urządzeniu jest bezpieczny.');
  }
}

/* ---------- Wybór poziomów ---------- */

function levelLink(l) {
  const open = unlocked(l.id);
  const p = progress.levels[l.id];
  const stars = [1, 2, 3].map((i) => `<i class="${p && p.g >= i ? 'on' : ''}">★</i>`).join('');
  const label = `Poziom ${l.id}: ${l.name}${p ? `, ${p.g} z 3 gwiazdek, ${fmt(p.s)} punktów` : open ? '' : ', zablokowany'}`;
  return `
    <li>
      <a class="procy-level${open ? '' : ' is-locked'}${p ? ' is-done' : ''}" ${open ? `href="#poziom-${l.id}"` : 'role="link" aria-disabled="true"'} aria-label="${esc(label)}">
        <span class="pl-num">${open ? l.id : LOCK}</span>
        <span class="pl-name">${esc(l.name)}</span>
        <span class="pl-stars" aria-hidden="true">${stars}</span>
        <span class="pl-best">${p ? fmt(p.s) : open ? 'Nowy!' : ''}</span>
      </a>
    </li>`;
}

function renderMenu() {
  const t = totals();
  $('#procyStars').textContent = t.stars;
  $('#procyScore').textContent = fmt(t.score);
  $('#procyLevels').innerHTML = CHAPTERS.map((ch, ci) => {
    const list = LEVELS.filter((l) => l.chapter === ci);
    const got = list.reduce((a, l) => a + (progress.levels[l.id] ? progress.levels[l.id].g : 0), 0);
    return `
      <section class="procy-chapter theme-${ch.theme}" aria-labelledby="procyCh${ci}">
        <header class="procy-ch-head">
          <h2 id="procyCh${ci}"><span>${ci + 1}</span>${esc(ch.name)}</h2>
          <p>${esc(ch.text)}</p>
          <p class="procy-ch-stars"><span aria-hidden="true">★</span> ${got}/${list.length * 3}</p>
        </header>
        <ol class="procy-levels">${list.map(levelLink).join('')}</ol>
      </section>`;
  }).join('');
  if (fb && !me) syncNote();
}

function renderHens() {
  $('#procyHens').innerHTML = HEN_ORDER.map((type) => {
    const h = HENS[type];
    const from = LEVELS.find((l) => l.hens.includes(type));
    return `
      <li>
        <canvas width="112" height="112" data-hen="${type}" aria-hidden="true"></canvas>
        <div><b>${esc(h.name)}</b><span>${esc(h.desc)}</span>${from ? `<small>Od poziomu ${from.id}</small>` : ''}</div>
      </li>`;
  }).join('');
  $$('canvas[data-hen]').forEach(paintHen);
}

function paintHen(canvas) {
  const type = canvas.dataset.hen;
  const c = canvas.getContext('2d');
  const size = canvas.width;
  c.clearRect(0, 0, size, size);
  const R = size * 0.27 * (HENS[type].r / 0.5) ** 0.45;
  drawHenPx(c, type, size * 0.5, size * 0.56, R, 0, { t: 0.4 });
}

/* ---------- Tablica wyników ---------- */

async function renderBoard() {
  const body = $('#procyBoard');
  if (!fb || !ready) {
    body.innerHTML = '<p class="note">Tablica wyników ruszy wkrótce. Postęp zapisujemy na tym urządzeniu.</p>';
    return;
  }
  const { F, db } = fb;
  const col = F.collection(db, 'procy');
  try {
    const [snap, total] = await Promise.all([
      F.getDocs(F.query(col, F.orderBy('score', 'desc'), F.limit(10))),
      F.getCountFromServer(col),
    ]);
    const rows = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
    const count = total.data().count;
    let foot = '';
    if (!me) {
      foot = '<p class="board-me">Zaloguj się, żeby trafić na tablicę. <button type="button" class="linklike" data-act="login">Zaloguj się</button></p>';
    } else if (remote && !rows.some((r) => r.uid === me.uid)) {
      const higher = await F.getCountFromServer(F.query(col, F.where('score', '>', remote.score)));
      foot = `<p class="board-me">Ty: <b>${higher.data().count + 1}. miejsce</b> z ${fmt(count)} · ★ ${remote.stars} · ${fmt(remote.score)} pkt</p>`;
    } else if (!remote) {
      foot = '<p class="board-me">Ukończ poziom, a pojawisz się na tablicy.</p>';
    }
    body.innerHTML = `
      ${rows.length ? `<ol class="board-list">${rows.map((r) => {
        const rank = 1 + rows.filter((x) => x.score > r.score).length;
        return `
          <li class="brow procy-brow${me && r.uid === me.uid ? ' is-me' : ''}">
            <span class="brank${rank <= 3 ? ' medal-' + rank : ''}">${rank}</span>
            <span class="bav" data-av="${esc(r.uid)}">${avatarHtml(r.name, r.uid)}</span>
            <a class="bname" href="profil.html#${esc(r.uid)}">${esc(r.name)}</a>
            <span class="bstars">★ ${Number(r.stars) || 0}</span>
            <b class="bscore">${fmt(r.score)}</b>
            ${admin ? `<button type="button" class="bdel" data-del="${esc(r.uid)}" aria-label="Usuń wynik: ${esc(r.name)}">×</button>` : ''}
          </li>`;
      }).join('')}</ol>` : '<p class="note">Jeszcze nikt nie ukończył poziomu. Pierwsze miejsce czeka!</p>'}
      ${count ? `<p class="board-count">${fmt(count)} ${plural(count, 'gracz', 'graczy', 'graczy')} · ranking według sumy punktów ze wszystkich poziomów</p>` : ''}
      ${foot}`;
    [...new Set(rows.map((r) => r.uid))].forEach(async (uid) => {
      const av = await avatarFor(fb, uid);
      $$('[data-av]', body).filter((el) => el.dataset.av === uid).forEach((el) => {
        if (av.src) el.innerHTML = avatarHtml(av.name, uid, '', av.src);
        if (av.name && el.nextElementSibling) el.nextElementSibling.textContent = av.name;
      });
    });
  } catch (err) {
    console.error(err);
    body.innerHTML = '<p class="note">Nie udało się wczytać tablicy wyników.</p>';
  }
}

/* ---------- Gra ---------- */

const phoneLike = () => matchMedia('(pointer: coarse)').matches && (innerWidth < 960 || innerHeight < 540);

function enterImmersive() {
  if (!phoneLike()) return;
  document.documentElement.classList.add('procy-full');
  const el = document.documentElement;
  if (el.requestFullscreen && !document.fullscreenElement) {
    el.requestFullscreen({ navigationUI: 'hide' })
      .then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'))
      .catch(() => {});
  }
  checkRotate();
}

function exitImmersive() {
  document.documentElement.classList.remove('procy-full');
  if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
  stage.classList.remove('needs-rotate');
}

function checkRotate() {
  const portrait = matchMedia('(orientation: portrait)').matches;
  stage.classList.toggle('needs-rotate', document.documentElement.classList.contains('procy-full') && portrait && !rotateSkipped);
}
matchMedia('(orientation: portrait)').addEventListener('change', checkRotate);

function showMenu() {
  if (game) game.pause();
  hideOverlay();
  exitImmersive();
  playView.hidden = true;
  menu.hidden = false;
  document.title = BASE_TITLE;
  renderMenu();
  renderBoard();
}

function startLevel(id) {
  const lvl = LEVELS.find((l) => l.id === id);
  if (!lvl || !unlocked(id)) {
    history.replaceState(null, '', location.pathname);
    showMenu();
    return;
  }
  menu.hidden = true;
  playView.hidden = false;
  document.title = `Poziom ${lvl.id}: ${lvl.name} – Kury z procy – Jajo`;
  if (!game) game = createGame(stage, { onEnd, sunActive: () => Boolean(noc && noc.step() >= 3), onSun });
  loadNoc();
  current = withStars(lvl);
  unlockAudio();
  game.load(lvl);
  hideOverlay();
  enterImmersive();
  if (!document.documentElement.classList.contains('procy-full')) {
    stage.scrollIntoView({ block: 'center', behavior: 'instant' });
  }
  const fresh = [...new Set(lvl.hens)].filter((h) => !seen.has(h));
  if (fresh.length) showIntro(fresh);
}

// Nocne ślady: słońce w Kurach z procy jest jedną z ukrytych zagadek.
let noc = null;
let nocLoading = null;

function loadNoc() {
  if (!nocLoading) {
    nocLoading = import('./noc/rdzen.js').then(async (m) => {
      noc = m;
      if (m.step() < 3) await m.whenSynced();
    }).catch(() => {});
  }
}

async function onSun() {
  if (!noc) return;
  game.pause();
  const res = await noc.advance(4);
  if (res) await noc.whisper(noc.t('n4'), { kicker: 'Słońce' });
  if (!overlay.dataset.kind && !playView.hidden) game.resume();
}

function hideOverlay() {
  overlay.hidden = true;
  overlay.innerHTML = '';
  overlay.dataset.kind = '';
}

function showOverlay(kind, html) {
  overlay.dataset.kind = kind;
  overlay.innerHTML = `<div class="procy-card">${html}</div>`;
  overlay.hidden = false;
  const first = $('[data-primary]', overlay) || $('button, a', overlay);
  if (first) first.focus({ preventScroll: true });
}

function showIntro(types) {
  game.pause();
  const type = types[0];
  const h = HENS[type];
  showOverlay('intro', `
    <p class="procy-kicker">Nowa kura!</p>
    <canvas class="procy-intro-hen" width="160" height="160" data-hen="${type}" aria-hidden="true"></canvas>
    <h2>${esc(h.name)}</h2>
    <p>${esc(h.desc)}</p>
    <button type="button" class="btn btn-primary" data-act="intro" data-type="${type}" data-rest="${types.slice(1).join(',')}" data-primary>Do dzieła!</button>`);
  paintHen($('canvas', overlay));
}

function pauseGame() {
  if (!game || overlay.dataset.kind || playView.hidden) return;
  game.pause();
  showOverlay('pause', `
    <h2>Pauza</h2>
    <p>Poziom ${current.id}: ${esc(current.name)}</p>
    <div class="procy-actions">
      <button type="button" class="btn btn-primary" data-act="resume" data-primary>Wznów</button>
      <button type="button" class="btn btn-ghost" data-act="restart">Od nowa</button>
      <button type="button" class="btn btn-ghost" data-act="menu">Wybór poziomu</button>
    </div>
    <button type="button" class="linklike" data-act="sound">${isMuted() ? 'Włącz dźwięk' : 'Wyłącz dźwięk'}</button>`);
}

function onEnd({ won, score, stars }) {
  const id = current.id;
  const next = LEVELS.find((l) => l.id === id + 1);
  if (!won) {
    sfx('over');
    showOverlay('lost', `
      <p class="procy-kicker">Poziom ${id}</p>
      <h2>Jajka się obroniły</h2>
      <p>Zostało ${game.world.eggsLeft()} ${plural(game.world.eggsLeft(), 'zgniłe jajko', 'zgniłe jajka', 'zgniłych jajek')}. Spróbuj innego kąta albo użyj mocy kury w&nbsp;locie.</p>
      <div class="procy-actions">
        <button type="button" class="btn btn-primary" data-act="restart" data-primary>Spróbuj jeszcze raz</button>
        <button type="button" class="btn btn-ghost" data-act="menu">Wybór poziomu</button>
      </div>`);
    return;
  }
  const prev = progress.levels[id];
  const record = !prev || score > prev.s;
  progress.levels[id] = { s: Math.max(score, prev ? prev.s : 0), g: Math.max(stars, prev ? prev.g : 0) };
  saveLocal();
  if (me && ready) scheduleSync(300);
  const last = !next;
  showOverlay('won', `
    <p class="procy-kicker">${last ? 'Król Zgniłków pokonany!' : `Poziom ${id} ukończony`}</p>
    <div class="procy-stars" aria-label="${stars} z 3 gwiazdek">${[1, 2, 3].map((i) => `<span class="${i <= stars ? 'on' : ''}" style="--d:${i * 0.35}s">★</span>`).join('')}</div>
    <p class="procy-final"><b>${fmt(score)}</b> punktów</p>
    <p class="procy-note">${record && prev ? 'Nowy rekord tego poziomu!' : prev ? `Rekord: ${fmt(prev.s)}` : ''}${stars < 3 ? ` Na ${stars + 1}. gwiazdkę potrzeba ${fmt(current.stars[stars - 1])} punktów.` : ''}</p>
    ${last ? '<p class="procy-note">Wszystkie poziomy za Tobą. Spróbuj zdobyć wszędzie po trzy gwiazdki!</p>' : ''}
    <div class="procy-actions">
      ${next ? '<button type="button" class="btn btn-primary" data-act="next" data-primary>Dalej</button>' : ''}
      <button type="button" class="btn ${next ? 'btn-ghost' : 'btn-primary'}" data-act="restart" ${next ? '' : 'data-primary'}>Jeszcze raz</button>
      <button type="button" class="btn btn-ghost" data-act="menu">Wybór poziomu</button>
    </div>
    ${fb && ready && !me ? '<p class="procy-note">Zaloguj się, żeby zapisać postęp na koncie i&nbsp;trafić na tablicę. <button type="button" class="linklike" data-act="login">Zaloguj się</button></p>' : ''}`);
  [1, 2, 3].slice(0, stars).forEach((i) => setTimeout(() => sfx('star'), i * 350 + 150));
}

function goMenu() {
  if (fromMenu) {
    history.back();
  } else {
    history.replaceState(null, '', location.pathname);
    showMenu();
  }
}

function route(viaHash) {
  const m = /^#poziom-(\d+)$/.exec(location.hash);
  if (m) {
    fromMenu = viaHash && !menu.hidden;
    startLevel(Number(m[1]));
  } else {
    showMenu();
  }
}

/* ---------- Zdarzenia ---------- */

document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act], [data-del], .procy-level.is-locked');
  if (!el) return;
  if (el.classList.contains('is-locked')) {
    e.preventDefault();
    return;
  }
  if (el.dataset.del && admin) {
    if (!el.classList.contains('is-confirm')) {
      el.classList.add('is-confirm');
      el.textContent = 'Usunąć?';
      return;
    }
    try {
      await fb.F.deleteDoc(fb.F.doc(fb.db, 'procy', el.dataset.del));
      renderBoard();
    } catch (err) {
      console.error(err);
    }
    return;
  }
  const act = el.dataset.act;
  if (act === 'pause') pauseGame();
  else if (act === 'resume') {
    hideOverlay();
    game.resume();
  } else if (act === 'restart') {
    hideOverlay();
    game.load(current);
  } else if (act === 'menu') goMenu();
  else if (act === 'next') {
    const next = current.id + 1;
    history.replaceState(null, '', `#poziom-${next}`);
    startLevel(next);
  } else if (act === 'sound') {
    setMuted(!isMuted());
    if (!isMuted()) unlockAudio();
    el.textContent = isMuted() ? 'Włącz dźwięk' : 'Wyłącz dźwięk';
  } else if (act === 'intro') {
    seen.add(el.dataset.type);
    store(SEEN, [...seen]);
    const rest = el.dataset.rest ? el.dataset.rest.split(',') : [];
    hideOverlay();
    if (rest.length) showIntro(rest);
    else game.resume();
  } else if (act === 'rotate') {
    rotateSkipped = true;
    checkRotate();
  } else if (act === 'login' && fb) {
    openLogin(fb, { lede: 'Zaloguj się, żeby zapisać postęp na koncie i trafić na tablicę wyników.' });
  }
});

window.addEventListener('keydown', (e) => {
  if (playView.hidden || !game) return;
  if (e.target.closest && e.target.closest('input, textarea, dialog')) return;
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
    e.preventDefault();
    if (overlay.dataset.kind === 'pause') {
      hideOverlay();
      game.resume();
    } else {
      pauseGame();
    }
  } else if ((e.key === 'r' || e.key === 'R') && !overlay.dataset.kind) {
    game.load(current);
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') pauseGame();
});
window.addEventListener('hashchange', () => route(true));

/* ---------- Start ---------- */

renderHens();
renderMenu();
route(false);

(async function start() {
  fb = await connect();
  if (!fb) {
    setSync('Postęp zapisuje się na tym urządzeniu.');
    renderBoard();
    return;
  }
  const { F, db } = fb;
  try {
    await F.getDocs(F.query(F.collection(db, 'procy'), F.limit(1)));
    ready = true;
  } catch (err) {
    console.warn('Zapis postępu na koncie jest wyłączony: brak reguł w Firestore.', err && err.code);
  }
  syncNote();
  renderBoard();
  watchUser(fb, async (u) => {
    me = isMember(u) ? u : null;
    myName = '';
    admin = false;
    remote = null;
    if (me) {
      const [p, adm] = await Promise.all([ensureProfile(fb, me), isAdmin(fb, me.uid)]);
      myName = (p && p.name) || '';
      admin = adm;
      await pullAccount();
    } else {
      syncNote();
    }
    renderBoard();
  });
})();
