/* Pięć Koszmarnych Nocy u Magdy Gessler. Gra za kamerą 05: menu jak w FNaF 1, intro, noce 1–6, własna noc, gwiazdki i zapis postępu.
   Obrazki, dźwięki i film są zaszyfrowane tym samym kluczem co nagranie z kamery (odblokowuje go rozwiązanie zagadek). */
import { get, whenSynced, game, setGame, resetGame, advance, onChange, savedOnAccount } from './rdzen.js?v=20261009';
import { Dzwiek } from './gra-dzwiek.js?v=20261009';
import { Night, prepareArt, CAMS, LEVELS, NAMES } from './gra-noc.js?v=20261017';

const V = '20261005';
// Paczki zmienione później dostają własną wersję (reszta, np. 11 MB intra, zostaje w pamięci przeglądarki)
const PV = { m: '20261014', o: '20261010', s: '20261015', t1: '20261010', t2: '20261010', t3: '20261010', t4: '20261015', t5: '20261012' };
const $ = (sel, root = document) => root.querySelector(sel);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const sound = new Dzwiek();
const img = new Map();
const meta = {};
let videoUrl = '';
let key = '';
let art = null;
let night = null;
let mode = 'boot';

const canvas = $('#fnView');
const screen = $('#fnScreen');
const screenIn = $('#fnScreenIn');
const ui = {
  hud: $('#fnHud'),
  time: $('#fnTime'),
  nightLbl: $('#fnNightLbl'),
  power: $('#fnPower'),
  usage: $('#fnUsage'),
  powerBox: $('#fnPowerBox'),
  mute: $('#fnMute'),
  camBar: $('#fnCamBar'),
  camUi: $('#fnCamUi'),
  camName: $('#fnCamName'),
  map: $('#fnMap'),
  doorBtns: $('#fnDoorBtns'),
  doorL: $('#fnDoorL'),
  lightL: $('#fnLightL'),
  doorR: $('#fnDoorR'),
  lightR: $('#fnLightR'),
  win: $('#fnWin'),
};

$('#fnMapBox').insertAdjacentHTML('beforeend', CAMS.map((c) => `
  <button type="button" class="fn-cam" data-cam="${c.id}" aria-pressed="false" aria-label="Kamera ${c.id}: ${esc(c.name)}"
    style="left:${(c.x / 300) * 100}%;top:${(c.y / 250) * 100}%"><span>CAM</span> <span>${c.id}</span></button>`).join(''));

/* ---------- Paczki z plikami ---------- */

const packs = {};
const progress = {};
const hexToBytes = (hex) => Uint8Array.from(hex.match(/../g), (h) => parseInt(h, 16));

function pack(name) {
  if (!packs[name]) {
    packs[name] = loadPack(name).catch((err) => {
      delete packs[name];
      throw err;
    });
  }
  return packs[name];
}

async function loadPack(name) {
  const res = await fetch(`noc/g/${name}.bin?v=${PV[name] || V}`);
  if (!res.ok) throw new Error(`Nie udało się pobrać paczki ${name}.`);
  const total = Number(res.headers.get('content-length')) || 0;
  progress[name] = [0, total || 1];
  let data;
  if (res.body && res.body.getReader && total) {
    const reader = res.body.getReader();
    const chunks = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      got += value.length;
      progress[name] = [Math.min(got, total), total];
    }
    data = new Uint8Array(got);
    let o = 0;
    for (const c of chunks) {
      data.set(c, o);
      o += c.length;
    }
  } else {
    data = new Uint8Array(await res.arrayBuffer());
  }
  progress[name] = [1, 1];
  const k = await crypto.subtle.importKey('raw', hexToBytes(key), 'AES-GCM', false, ['decrypt']);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: data.slice(0, 12) }, k, data.slice(12)));
  const hl = new DataView(plain.buffer, plain.byteOffset).getUint32(0, true);
  const head = JSON.parse(new TextDecoder().decode(plain.subarray(4, 4 + hl)));
  const base = 4 + hl;
  await Promise.all(head.map(async (f) => {
    const bytes = plain.subarray(base + f.off, base + f.off + f.len);
    if (f.meta) meta[f.id] = f.meta;
    if (f.type.startsWith('image/')) {
      const im = new Image();
      im.src = URL.createObjectURL(new Blob([bytes], { type: f.type }));
      await im.decode().catch(() => {});
      img.set(f.id, im);
    } else if (f.type.startsWith('audio/')) {
      sound.add(f.id, bytes);
    } else if (f.type.startsWith('video/')) {
      videoUrl = URL.createObjectURL(new Blob([bytes], { type: f.type }));
    }
  }));
  return head.map((f) => f.id);
}

/** Czeka na paczki i pokazuje, ile już się pobrało. */
async function need(names, show) {
  const all = Promise.all(names.map(pack));
  const tick = () => {
    let got = 0;
    let total = 0;
    for (const n of names) {
      const [a, b] = progress[n] || [0, 1];
      got += a / b;
      total += 1;
    }
    show(Math.floor((got / total) * 100));
  };
  tick();
  const t = setInterval(tick, 200);
  try {
    await all;
  } finally {
    clearInterval(t);
  }
}

// Pobieranie w tle, po kolei, żeby najpierw było to, co potrzebne najwcześniej.
async function preload() {
  const g = game();
  const order = ['o', 's'];
  if (!started()) order.push('i'); // ktoś pierwszy raz: zaraz zobaczy intro
  else if (g.nk <= 1 && g.nb === 0) order.push('i');
  order.push(`t${g.nk}`);
  for (const n of order) await pack(n).catch(() => {});
}

/* ---------- Szum na ekranie ---------- */

const noise = { canvas: $('#fnNoise'), level: 0, menu: false };
(function drawNoise() {
  const c = noise.canvas;
  c.width = 256;
  c.height = 144;
  const x = c.getContext('2d');
  const frame = x.createImageData(256, 144);
  let last = 0;
  const draw = (t) => {
    requestAnimationFrame(draw);
    if (t - last < 50) return;
    last = t;
    let lvl = noise.level;
    if (noise.menu) lvl = 0.14 + Math.random() * 0.14 + (Math.random() < 0.05 ? 0.3 : 0);
    c.style.opacity = String(Math.min(1, lvl));
    if (lvl < 0.01) return;
    for (let i = 0; i < frame.data.length; i += 4) {
      const v = Math.random() * 255;
      frame.data[i] = frame.data[i + 1] = frame.data[i + 2] = v;
      frame.data[i + 3] = 255;
    }
    x.putImageData(frame, 0, 0);
  };
  requestAnimationFrame(draw);
})();
const setNoise = (v) => {
  noise.level = v;
};

/* ---------- Pełny ekran i obracanie ---------- */

function fullscreen() {
  if (document.fullscreenElement || document.webkitFullscreenElement) return;
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!req) return;
  try {
    const p = req.call(el, { navigationUI: 'hide' });
    if (p && p.then) {
      p.then(() => {
        const o = window.screen.orientation;
        if (o && o.lock) o.lock('landscape').catch(() => {});
      }).catch(() => {});
    }
  } catch {
    /* przeglądarka nie pozwoliła */
  }
}

const portrait = window.matchMedia('(orientation: portrait) and (pointer: coarse)');
function updatePause() {
  const rot = portrait.matches;
  $('#fnRotate').hidden = !rot;
  const stop = document.hidden || rot;
  if (night) night.setPaused(stop);
  else if (document.hidden) sound.suspend();
  else sound.resume();
}
document.addEventListener('visibilitychange', updatePause);
if (portrait.addEventListener) portrait.addEventListener('change', updatePause);
updatePause();

/* ---------- Menu ---------- */

const menu = $('#fnMenu');
const face = $('#fnFace');
const items = $('#fnItems');
let faceTimer = 0;
let twitchTimer = 0;
let faces = [];

// „Kontynuuj” pojawia się dopiero, gdy ktoś choć raz zaczął nową grę (żeby każdy najpierw zobaczył intro).
// Znacznik pamięta numer resetu, więc reset na innym urządzeniu też go unieważnia.
const STARTED_KEY = 'jajo:magda-start';
function started() {
  const g = game();
  if (g.nk > 1 || g.nb > 0 || g.nc > 0) return true;
  try {
    return localStorage.getItem(STARTED_KEY) === `r${g.nr}`;
  } catch {
    return false;
  }
}
function markStarted() {
  try {
    localStorage.setItem(STARTED_KEY, `r${game().nr}`);
  } catch {
    /* pamięć niedostępna */
  }
}

// Pozycje menu, gwiazdki i napis, gdzie zapisuje się postęp (odświeżane też po wczytaniu postępu z konta).
function updateMenu() {
  const g = game();
  $('#fnContItem').hidden = !started();
  $('#fnResetItem').hidden = !started();
  $('#fnContNight').textContent = `Noc ${g.nk}`;
  $('#fnSixthItem').hidden = g.nb < 5;
  $('#fnCustomItem').hidden = g.nb < 6;
  const stars = (g.nb >= 5 ? 1 : 0) + (g.nb >= 6 ? 1 : 0) + (g.nc ? 1 : 0);
  $('#fnStars').hidden = stars === 0;
  $('#fnStars').textContent = '★'.repeat(stars);
  $('#fnStars').setAttribute('aria-label', `Gwiazdki: ${stars}`);
  $('#fnSaveNote').textContent = savedOnAccount()
    ? 'Postęp zapisuje się na Twoim koncie.'
    : 'Postęp zapisuje się tylko w tej przeglądarce. Zaloguj się na stronie Jajo, żeby grać dalej na innym urządzeniu.';
  const sel = items.querySelector('.fn-item.is-sel');
  if (!sel || sel.closest('li').hidden) select(items.querySelector('.fn-item'));
}

onChange(() => {
  if (mode === 'menu') updateMenu();
});

function showMenu() {
  mode = 'menu';
  hideScreen();
  document.body.classList.add('fn-in-menu');
  updateMenu();
  if (!faces.length) {
    faces = ['menu-0', 'menu-1', 'menu-2'].map((id) => img.get(id).src);
    face.src = faces[0];
  }
  menu.hidden = false;
  noise.menu = true;
  sound.ready(['menu', 'static', 'blip']).then(() => {
    if (mode !== 'menu') return;
    sound.loop('menu', 'menu', { gain: 0.45, fadeIn: 1 });
    sound.loop('mstatic', 'static', { gain: 0.08, fadeIn: 1 });
  });
  // twarz Magdy migocze i co jakiś czas „drga” w inną, straszniejszą
  clearInterval(faceTimer);
  faceTimer = setInterval(() => {
    face.style.opacity = String(Math.random() < 0.85 ? 0.8 + Math.random() * 0.2 : 0.35 + Math.random() * 0.3);
  }, 90);
  const twitch = () => {
    twitchTimer = setTimeout(() => {
      face.src = faces[1 + Math.floor(Math.random() * 2)];
      setTimeout(() => {
        face.src = faces[0];
        twitch();
      }, 70 + Math.random() * 110);
    }, 1800 + Math.random() * 4500);
  };
  clearTimeout(twitchTimer);
  twitch();
  select(items.querySelector('.fn-item'));
}

function hideMenu() {
  menu.hidden = true;
  noise.menu = false;
  noise.level = 0;
  document.body.classList.remove('fn-in-menu');
  clearInterval(faceTimer);
  clearTimeout(twitchTimer);
  sound.stopLoop('menu', 0.4);
  sound.stopLoop('mstatic', 0.4);
}

function select(btn, withSound) {
  if (!btn || btn.classList.contains('is-sel')) return;
  items.querySelectorAll('.fn-item').forEach((b) => b.classList.toggle('is-sel', b === btn));
  if (withSound) sound.play('blip', { gain: 0.5 });
}

items.addEventListener('pointerover', (e) => select(e.target.closest('.fn-item'), true));
items.addEventListener('focusin', (e) => select(e.target.closest('.fn-item'), true));
menu.addEventListener('keydown', (e) => {
  if (mode !== 'menu' || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
  const list = [...items.querySelectorAll('li:not([hidden]) .fn-item')];
  const i = list.indexOf(document.activeElement);
  const next = list[(i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length];
  next.focus();
  e.preventDefault();
});

items.addEventListener('click', async (e) => {
  const b = e.target.closest('.fn-item');
  if (!b || mode !== 'menu') return;
  const act = b.dataset.act;
  if (act === 'exit') {
    // powrót na stronę główną z jajkami
    sound.stopAll(0.2);
    location.href = 'index.html';
    return;
  }
  if (act === 'reset') {
    askReset();
    return;
  }
  sound.init();
  fullscreen();
  if (act === 'new') {
    markStarted();
    setGame({ nk: 1 });
    hideMenu();
    await playIntro();
    startNight(1);
  } else if (act === 'continue') {
    hideMenu();
    startNight(game().nk);
  } else if (act === 'sixth') {
    hideMenu();
    startNight(6);
  } else if (act === 'custom') {
    hideMenu();
    showCustom();
  }
});

/* ---------- Reset postępu ---------- */

const confirmBox = $('#fnConfirm');

function askReset() {
  mode = 'confirm';
  confirmBox.hidden = false;
  sound.play('blip', { gain: 0.5 });
  confirmBox.querySelector('[data-confirm="no"]').focus({ preventScroll: true });
}

function closeConfirm(focusSel) {
  confirmBox.hidden = true;
  mode = 'menu';
  const b = items.querySelector(focusSel) || items.querySelector('.fn-item');
  select(b);
  b.focus({ preventScroll: true });
}

confirmBox.addEventListener('click', (e) => {
  const b = e.target.closest('[data-confirm]');
  if (!b || mode !== 'confirm') return;
  if (b.dataset.confirm === 'yes') {
    resetGame();
    for (const k of [STARTED_KEY, CUSTOM_KEY]) {
      try {
        localStorage.removeItem(k);
      } catch {
        /* pamięć niedostępna */
      }
    }
    customLv = { ...CUSTOM_DEFAULT };
    sound.play('static', { gain: 0.3 }).stop(0.6);
    setNoise(1);
    setTimeout(() => setNoise(0), 350);
    updateMenu();
    closeConfirm('[data-act="new"]');
  } else {
    closeConfirm('[data-act="reset"]');
  }
});

confirmBox.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.preventDefault();
    closeConfirm('[data-act="reset"]');
  }
  // fokus zostaje w okienku
  if (e.key === 'Tab') {
    const btns = [...confirmBox.querySelectorAll('button')];
    const i = btns.indexOf(document.activeElement);
    btns[(i + (e.shiftKey ? -1 : 1) + btns.length) % btns.length].focus();
    e.preventDefault();
  }
});

/* ---------- Ekrany z napisami ---------- */

function showScreen(html, cls = '') {
  screen.className = `fn-screen ${cls}`;
  screenIn.innerHTML = html;
  screen.hidden = false;
}

function hideScreen() {
  screen.hidden = true;
  screenIn.innerHTML = '';
}

// Czeka na kliknięcie, klawisz albo upływ czasu (ms; 0 = bez limitu).
function waitInput(ms = 0, minMs = 600) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    let timer = 0;
    const done = () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', onInput);
      window.removeEventListener('keydown', onInput);
      resolve();
    };
    const onInput = () => {
      if (Date.now() - t0 >= minMs) done();
    };
    window.addEventListener('pointerdown', onInput);
    window.addEventListener('keydown', onInput);
    if (ms) timer = setTimeout(done, ms);
  });
}

/* ---------- Intro ---------- */

async function playIntro() {
  mode = 'intro';
  // Intro trzeba obejrzeć w całości (nie da się go pominąć). Najpierw musi się pobrać.
  while (!videoUrl) {
    showScreen('<p class="fn-load" id="fnLoadText">Ładowanie… 0%</p>');
    try {
      await need(['i'], (p) => {
        const el = $('#fnLoadText');
        if (el) el.textContent = `Ładowanie… ${p}%`;
      });
    } catch {
      showScreen('<p class="fn-load">Nie udało się wczytać intro.</p><p class="fn-small">Sprawdź internet.</p><button type="button" class="fn-btn fn-load-retry" id="fnLoadRetry">Spróbuj jeszcze raz</button>');
      await new Promise((resolve) => $('#fnLoadRetry').addEventListener('click', resolve, { once: true }));
    }
  }
  hideScreen();
  const box = $('#fnIntro');
  const video = $('#fnVideo');
  box.hidden = false;
  video.src = videoUrl;
  video.currentTime = 0;
  return new Promise((resolve) => {
    let ended = false;
    const finish = () => {
      if (ended) return;
      ended = true;
      video.pause();
      video.removeAttribute('src');
      video.load();
      box.hidden = true;
      resolve();
    };
    video.onended = finish;
    video.onerror = finish; // przeglądarka nie umie odtworzyć filmu: nie ma na co czekać
    video.play().catch(() => {
      // przeglądarka nie pozwoliła odtworzyć z dźwiękiem: wystarczy kliknąć
      box.classList.add('needs-tap');
      box.addEventListener('click', () => {
        box.classList.remove('needs-tap');
        video.play().catch(finish);
      }, { once: true });
    });
  });
}

/* ---------- Noc ---------- */

const nightName = (n) => (n === 7 ? 'Własna noc' : `${n}. noc`);

async function startNight(n, levels = null) {
  mode = 'card';
  // telefon z tej nocy wczyta się w tle, a nagrania z innych nocy nie zajmują pamięci
  for (let k = 1; k <= 5; k++) {
    if (k !== n && packs[`t${k}`]) {
      sound.drop(`call${k}`);
      delete packs[`t${k}`];
    }
  }
  if (n <= 5) pack(`t${n}`).catch(() => {});
  showScreen(`<p class="fn-card-time">12:00 AM</p><p class="fn-card-night">${nightName(n)}</p><p class="fn-card-load" id="fnCardLoad"></p>`, 'fn-card');
  sound.play('blip', { gain: 0.6 });
  setNoise(0.5);
  setTimeout(() => setNoise(0), 400);
  const t0 = Date.now();
  try {
    await need(['o', 's'], (p) => {
      const el = $('#fnCardLoad');
      if (el && p < 100) el.textContent = `Ładowanie… ${p}%`;
    });
  } catch (err) {
    console.error(err);
    showScreen('<p class="fn-load">Nie udało się wczytać gry.</p><p class="fn-small">Sprawdź internet i odśwież stronę.</p>');
    return;
  }
  const el = $('#fnCardLoad');
  if (el) el.textContent = '';
  if (!art) art = prepareArt(img);
  await sound.ready(['amb', 'fan', 'blip', 'door', 'camup', 'camdown', 'camloop', 'hum', 'js-magda', 'js-mateusz', 'js-michel', 'js-robert']);
  sound.ready(['eerie', 'cold', 'musicbox', 'powerdown', 'chimes', 'crowd', 'static2']);
  const left = 3000 - (Date.now() - t0);
  if (left > 0) await wait(left);
  const custom = n === 7;
  const lv = levels || (n === 4 ? { ...LEVELS[4], magda: Math.random() < 0.5 ? 1 : 2 } : { ...LEVELS[n] });
  hideScreen();
  mode = 'night';
  night = new Night({
    canvas,
    ui,
    img,
    art,
    meta,
    sound,
    night: n,
    levels: lv,
    custom,
    setNoise,
    onEnd: (res, who) => endNight(n, res, who, lv),
  });
  night.start();
  updatePause();
}

async function endNight(n, res, who, lv) {
  const custom = n === 7;
  if (res === 'win') {
    night.destroy();
    night = null;
    if (n <= 4) setGame({ nk: n + 1, nb: n });
    else if (n === 5) setGame({ nk: 5, nb: 5 });
    else if (n === 6) setGame({ nb: 6 });
    const hard = custom && Object.values(lv).every((v) => v >= 20);
    if (hard) setGame({ nc: 1 });
    await sixAm();
    if (n <= 4) return startNight(n + 1);
    await ending(n, hard);
    showMenu();
    return;
  }
  // jumpscare się skończył: szum, potem koniec gry
  mode = 'over';
  setNoise(1);
  const st = sound.play('static2', { gain: 0.7, offset: Math.random() * 4 });
  await wait(2600);
  night.destroy();
  night = null;
  st.stop(0.3);
  setNoise(0);
  const he = { magda: 'Dopadła cię Magda.', mateusz: 'Dopadł cię Mateusz.', michel: 'Dopadł cię Michel.', robert: 'Dopadł cię Robert.' }[who] || '';
  showScreen(`<p class="fn-over">Koniec gry</p><p class="fn-small">${esc(he)}</p>`, 'fn-over-screen');
  await waitInput(7000, 1200);
  showMenu();
}

async function sixAm() {
  mode = 'six';
  showScreen('<p class="fn-six"><span class="fn-six-roll"><span>5</span><span>6</span></span>&nbsp;AM</p>', 'fn-six-screen');
  sound.play('chimes', { gain: 1 });
  setTimeout(() => sound.play('crowd', { gain: 0.9 }), 2600);
  await wait(7500);
}

async function ending(n, hard) {
  mode = 'end';
  let html;
  if (n === 5) {
    html = `<div class="fn-paper"><p class="fn-paper-head">Restauracja u&nbsp;Magdy Gessler</p><h2>Wypłata</h2>
      <p>Za: pięć nocnych zmian w&nbsp;biurze ochrony</p><p class="fn-paper-sum">120,50&nbsp;zł</p>
      <p class="fn-paper-note">Gratulacje, przetrwałeś pięć nocy! Odblokowano 6. noc.</p></div>`;
  } else if (n === 6) {
    html = `<div class="fn-paper"><p class="fn-paper-head">Restauracja u&nbsp;Magdy Gessler</p><h2>Nadgodziny</h2>
      <p>Za: dodatkową, szóstą noc</p><p class="fn-paper-sum">0,50&nbsp;zł</p>
      <p class="fn-paper-note">Odblokowano własną noc.</p></div>`;
  } else {
    html = `<div class="fn-paper fn-paper-pink"><p class="fn-paper-head">Restauracja u&nbsp;Magdy Gessler</p><h2>Wypowiedzenie</h2>
      <p>Pracownik: nocny ochroniarz</p><p>Powód: grzebanie przy kucharzach, brak profesjonalizmu, zapach.</p>
      <p class="fn-paper-note">${hard ? 'Tryb 4/20 zaliczony! Masz trzecią gwiazdkę.' : 'Ustaw wszystkich na 20 i przetrwaj, żeby zdobyć trzecią gwiazdkę.'}</p></div>`;
  }
  showScreen(`${html}<p class="fn-small fn-continue">Kliknij, aby wrócić do menu</p>`, 'fn-end-screen');
  sound.loop('mstatic', 'static', { gain: 0.08, fadeIn: 1 });
  await waitInput(0, 1500);
  sound.stopLoop('mstatic', 0.3);
}

/* ---------- Własna noc ---------- */

const CUSTOM_KEY = 'jajo:magda-wlasna';
const CUSTOM_DEFAULT = { magda: 1, mateusz: 3, michel: 3, robert: 1 };
let customLv = { ...CUSTOM_DEFAULT };
try {
  const saved = JSON.parse(localStorage.getItem(CUSTOM_KEY));
  if (saved) for (const k of Object.keys(customLv)) customLv[k] = Math.max(0, Math.min(20, Math.floor(Number(saved[k]) || 0)));
} catch {
  /* brak zapisu */
}

async function showCustom() {
  mode = 'custom';
  if (!img.has('p-magda1')) {
    showScreen('<p class="fn-load" id="fnLoadText">Ładowanie…</p>');
    try {
      await need(['o'], (p) => {
        const el = $('#fnLoadText');
        if (el) el.textContent = `Ładowanie… ${p}%`;
      });
    } catch {
      showMenu();
      return;
    }
    hideScreen();
  }
  const grid = $('#fnCustomGrid');
  grid.innerHTML = Object.keys(NAMES).map((n) => `
    <div class="fn-cn" data-who="${n}">
      <canvas class="fn-cn-face" width="200" height="200" aria-hidden="true"></canvas>
      <p class="fn-cn-name">${NAMES[n]}</p>
      <div class="fn-cn-row">
        <button type="button" class="fn-cn-btn" data-d="-1" aria-label="${NAMES[n]}: mniej">◂</button>
        <output class="fn-cn-lvl" aria-live="polite">${customLv[n]}</output>
        <button type="button" class="fn-cn-btn" data-d="1" aria-label="${NAMES[n]}: więcej">▸</button>
      </div>
    </div>`).join('');
  grid.querySelectorAll('.fn-cn').forEach((el) => {
    const n = el.dataset.who;
    const c = el.querySelector('canvas');
    const x = c.getContext('2d');
    const im = img.get(`p-${n}1`);
    // portret: górna część zdjęcia (głowa i ramiona), przyciemniony
    const sw = im.width * 0.62;
    x.fillStyle = '#000';
    x.fillRect(0, 0, 200, 200);
    x.drawImage(im, (im.width - sw) / 2, 0, sw, sw, 0, 0, 200, 200);
    x.fillStyle = 'rgba(0,0,0,.25)';
    x.fillRect(0, 0, 200, 200);
  });
  $('#fnCustom').hidden = false;
  noise.menu = true;
  document.body.classList.add('fn-in-menu');
  sound.loop('menu', 'menu', { gain: 0.32, fadeIn: 0.6 });
  grid.querySelector('.fn-cn-btn').focus({ preventScroll: true });
}

function hideCustom() {
  $('#fnCustom').hidden = true;
  noise.menu = false;
  noise.level = 0;
  document.body.classList.remove('fn-in-menu');
  sound.stopLoop('menu', 0.4);
}

$('#fnCustomGrid').addEventListener('click', (e) => {
  const b = e.target.closest('[data-d]');
  if (!b) return;
  const card = b.closest('.fn-cn');
  const n = card.dataset.who;
  customLv[n] = Math.max(0, Math.min(20, customLv[n] + Number(b.dataset.d)));
  card.querySelector('.fn-cn-lvl').textContent = customLv[n];
  sound.play('blip', { gain: 0.4 });
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(customLv));
  } catch {
    /* pamięć niedostępna */
  }
});
$('#fnCustomBack').addEventListener('click', () => {
  if (mode !== 'custom') return;
  hideCustom();
  showMenu();
});
$('#fnCustomGo').addEventListener('click', () => {
  if (mode !== 'custom') return;
  fullscreen();
  hideCustom();
  startNight(7, { ...customLv });
});

/* ---------- Start ---------- */

const boot = $('#fnBoot');
const bootTitle = $('#fnBootTitle');
const bootText = $('#fnBootText');
const startBtn = $('#fnStart');

(async function init() {
  // Zawsze łączymy się z kontem (najwyżej kilka sekund), żeby noce przechodziły między urządzeniami.
  await whenSynced();
  const st = get();
  if (st.krok < 8 || !st.klucz) {
    bootTitle.textContent = 'Tu nic nie ma.';
    return;
  }
  key = st.klucz;
  advance(9); // gra pojawi się na liście w „Grach”, żeby nie trzeba było wchodzić przez kamerę
  try {
    await pack('m');
  } catch (err) {
    console.error(err);
    bootTitle.textContent = 'Nie udało się wczytać gry.';
    bootText.textContent = 'Sprawdź internet i odśwież stronę.';
    return;
  }
  bootTitle.textContent = 'UWAGA!';
  bootText.textContent = 'Ta gra zawiera migające światła, głośne dźwięki i mnóstwo nagłych strachów.';
  startBtn.hidden = false;
  startBtn.focus({ preventScroll: true });
})();

startBtn.addEventListener('click', () => {
  sound.init();
  fullscreen();
  boot.hidden = true;
  showMenu();
  preload();
});
