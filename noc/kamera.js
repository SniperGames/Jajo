/* Jajo: kamera 05. Odszyfrowuje nagranie (zdjęcia i dźwięk) kluczem z zagadek i pokazuje je na cały ekran jak monitoring.
   Co jakiś czas obraz zalewa szum, a postać stoi bliżej. Gdy dojdzie do samej kamery, atakuje (jumpscare). */
import { get, step, whenSynced, staticNoise } from './rdzen.js';

const $ = (sel, root = document) => root.querySelector(sel);
const PERIOD = 114.6146; // dźwięk w nagraniu powtarza się co tyle sekund
const FADE = 2; // płynne przejście między kolejnymi pętlami
const VOLUME = 1.2;
// Kamery na mapie budynku: [numer, pomieszczenie, x, y] (współrzędne mapy 300 × 250).
const CAMS = [
  ['01', 'KURNIK', 150, 34],
  ['02', 'PODWÓRKO', 32, 88],
  ['03', 'KUCHNIA', 268, 181],
  ['04', 'MAGAZYN', 32, 182],
  ['05', 'SALA', 112, 104],
  ['06', 'ZAPLECZE', 268, 88],
];
// Kolejne kadry: postać coraz bliżej kamery.
const FRAMES = ['noc/05.bin', 'noc/05b.bin', 'noc/05c.bin', 'noc/05d.bin'];
const WAIT = [[45, 60], [35, 50], [28, 40]]; // ile sekund stoi w miejscu, zanim podejdzie bliżej
const HOLD = 8; // tyle stoi tuż przy kamerze, zanim zaatakuje
// Jumpscare: 10 klatek 412 × 308 w arkuszu 5 × 2.
const JUMP = { url: 'noc/05j.bin', w: 412, h: 308, cols: 5, frames: 10 };
const SCREAM = 'noc/05s.bin';
const NEXT_PAGE = 'zmiana.html';
const ALT = [
  'Kadr z kamery monitoringu: postać z nożem stoi na środku pustej sali restauracji.',
  'Kadr z kamery monitoringu: postać z nożem podeszła bliżej.',
  'Kadr z kamery monitoringu: postać z nożem jest już blisko kamery.',
  'Kadr z kamery monitoringu: twarz postaci tuż przy kamerze.',
];

const img = $('#camImg');
const gate = $('#camGate');
const gateTitle = $('#camGateTitle');
const gateText = $('#camGateText');
const connect = $('#camConnect');
const map = $('#camMap');
const rec = $('#camRec');
const noiseCanvas = $('#camNoise');
let noiseLevel = 0.85;
let flash = 0;
let ac = null;
let master = null;
let audioP = null;
let audioBuf = null;
let nextAt = 0;
let current = '';
let key = '';
const urls = []; // odszyfrowane kadry (adresy blob:)
let stage = 0; // który kadr widać
let elapsed = 0;
let due = 0;
let moving = false;
let jumping = false;
let started = false;
let sheet = null; // arkusz klatek jumpscare'u
let screamRaw = null;
let screamBuf = null;

/* ---------- Szum na ekranie i zegar ---------- */

(function noise() {
  const c = noiseCanvas.getContext('2d');
  noiseCanvas.width = 240;
  noiseCanvas.height = 135;
  const frame = c.createImageData(240, 135);
  let last = 0;
  const draw = (t) => {
    if (t - last > 45) {
      last = t;
      for (let i = 0; i < frame.data.length; i += 4) {
        const v = Math.random() * 255;
        frame.data[i] = frame.data[i + 1] = frame.data[i + 2] = v;
        frame.data[i + 3] = 255;
      }
      c.putImageData(frame, 0, 0);
      flash = Math.max(0, flash - 0.09);
      noiseCanvas.style.opacity = String(Math.min(1, noiseLevel + flash));
    }
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
})();

(function clock() {
  const startReal = Date.now();
  const start = 2 * 3600 + 37 * 60 + 21;
  const tick = () => {
    const s = start + Math.floor((Date.now() - startReal) / 1000);
    const hh = String(Math.floor(s / 3600) % 24).padStart(2, '0');
    const mm = String(Math.floor(s / 60) % 60).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    $('#camClock').textContent = `${hh}:${mm}:${ss}`;
  };
  tick();
  setInterval(tick, 1000);
})();

/* ---------- Odszyfrowanie nagrania ---------- */

const hexToBytes = (hex) => Uint8Array.from(hex.match(/../g), (h) => parseInt(h, 16));

async function decrypt(url, keyHex) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Nie udało się pobrać nagrania.');
  const data = new Uint8Array(await res.arrayBuffer());
  const key = await crypto.subtle.importKey('raw', hexToBytes(keyHex), 'AES-GCM', false, ['decrypt']);
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: data.slice(0, 12) }, key, data.slice(12));
}

/* ---------- Dźwięk: pętla bez przerwy, z płynnym przejściem ---------- */

function schedule() {
  while (nextAt < ac.currentTime + 4) {
    const src = ac.createBufferSource();
    src.buffer = audioBuf;
    const g = ac.createGain();
    const t0 = nextAt;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(1, t0 + FADE);
    g.gain.setValueAtTime(1, t0 + PERIOD);
    g.gain.linearRampToValueAtTime(0, t0 + PERIOD + FADE);
    src.connect(g).connect(master);
    src.start(t0);
    src.stop(t0 + PERIOD + FADE + 0.1);
    nextAt = t0 + PERIOD;
  }
}

async function startAudio() {
  ac = new (window.AudioContext || window.webkitAudioContext)();
  if (ac.state === 'suspended') await ac.resume();
  master = ac.createGain();
  master.gain.value = VOLUME;
  const comp = ac.createDynamicsCompressor(); // głośniej, ale bez przesterowania
  comp.threshold.value = -6;
  comp.ratio.value = 8;
  master.connect(comp).connect(ac.destination);
  const decode = (raw) => new Promise((resolve, reject) => ac.decodeAudioData(raw.slice(0), resolve, reject));
  if (screamRaw) decode(screamRaw).then((b) => { screamBuf = b; }).catch(() => {});
  const raw = await audioP;
  audioBuf = await decode(raw);
  nextAt = ac.currentTime + 0.05;
  schedule();
  setInterval(schedule, 1000);
  // Telefon mógł uśpić dźwięk, gdy karta była w tle.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && ac.state === 'suspended') ac.resume();
  });
}

/* ---------- Mapa i przełączanie kamer ---------- */

function renderMap() {
  map.insertAdjacentHTML('beforeend', CAMS.map(([id, name, x, y]) => `
    <button type="button" class="cam-cam" data-cam="${id}" aria-pressed="false" aria-label="Kamera ${id}: ${name.toLowerCase()}"
      style="left:${(x / 300) * 100}%;top:${(y / 250) * 100}%"><span>CAM</span><span>${id}</span></button>`).join(''));
}

function switchTo(id) {
  if (id === current) return;
  current = id;
  flash = 1;
  staticNoise(0.28, 0.09);
  const name = CAMS.find(([c]) => c === id)[1];
  $('#camName').textContent = `CAM ${id}`;
  $('#camRoom').textContent = name;
  map.querySelectorAll('[data-cam]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cam === id)));
  refresh();
}

// Co widać na ekranie: kamera 05 (albo sam szum, gdy postać właśnie się przemieszcza) lub brak sygnału.
function refresh() {
  if (current === '05') {
    img.hidden = moving;
    img.alt = ALT[stage];
    gate.hidden = true;
    rec.hidden = false;
    noiseLevel = moving ? 1 : 0.07;
  } else {
    img.hidden = true;
    gate.hidden = false;
    gateTitle.textContent = 'BRAK SYGNAŁU';
    gateText.textContent = '';
    connect.hidden = true;
    rec.hidden = true;
    noiseLevel = 0.85;
  }
}

/* ---------- Postać podchodzi coraz bliżej ---------- */

const randIn = ([a, b]) => a + Math.random() * (b - a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function loadFrame(i) {
  if (urls[i]) return urls[i];
  const buf = await decrypt(FRAMES[i], key);
  const url = URL.createObjectURL(new Blob([buf], { type: 'image/jpeg' }));
  const pre = new Image();
  pre.src = url;
  await pre.decode().catch(() => {});
  urls[i] = url;
  return url;
}

// Kadry, klatki jumpscare'u i krzyk wczytują się w tle, zanim będą potrzebne.
function preload() {
  for (let i = 1; i < FRAMES.length; i++) loadFrame(i).catch(() => {});
  decrypt(JUMP.url, key).then(async (buf) => {
    const im = new Image();
    im.src = URL.createObjectURL(new Blob([buf], { type: 'image/jpeg' }));
    await im.decode().catch(() => {});
    sheet = im;
  }).catch(() => {});
  decrypt(SCREAM, key).then((raw) => {
    screamRaw = raw;
    if (ac && !screamBuf) ac.decodeAudioData(raw.slice(0), (b) => { screamBuf = b; }, () => {});
  }).catch(() => {});
}

// Licznik stoi, gdy karta jest w tle: postać nie zaatakuje, kiedy nikt nie patrzy na ekran.
setInterval(() => {
  if (!started || moving || jumping || document.hidden) return;
  elapsed += 0.25;
  if (elapsed < due) return;
  elapsed = 0;
  if (stage < FRAMES.length - 1) move();
  else jumpscare();
}, 250);

async function move() {
  if (!urls[stage + 1]) {
    // następny kadr jeszcze się nie wczytał: spróbuj za chwilę
    due = 3;
    loadFrame(stage + 1).catch(() => {});
    return;
  }
  moving = true;
  const dur = 1700 + Math.random() * 900;
  if (current === '05') {
    staticNoise(dur / 1000, 0.16);
    flash = 1;
  }
  refresh();
  await wait(dur / 2);
  stage += 1;
  img.src = urls[stage];
  await wait(dur / 2);
  moving = false;
  if (current === '05') flash = 1;
  refresh();
  due = stage < FRAMES.length - 1 ? randIn(WAIT[stage]) : HOLD;
}

/* ---------- Jumpscare ---------- */

function jumpscare() {
  jumping = true;
  const cv = document.createElement('canvas');
  cv.className = 'cam-jump';
  document.body.appendChild(cv);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(innerWidth * dpr);
  cv.height = Math.round(innerHeight * dpr);
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  if (ac) {
    master.gain.setTargetAtTime(0, ac.currentTime, 0.03); // szum kamery cichnie
    if (screamBuf) {
      const src = ac.createBufferSource();
      src.buffer = screamBuf;
      const g = ac.createGain();
      g.gain.value = 1.4;
      src.connect(g).connect(ac.destination);
      src.start();
    }
  }
  const t0 = performance.now();
  const END = 1.75;
  const draw = (now) => {
    const t = (now - t0) / 1000;
    const W = cv.width;
    const H = cv.height;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    if (t < END && sheet) {
      // najpierw po kolei wszystkie klatki, potem ostatnie cztery w kółko
      const k = t < 0.9 ? Math.min(JUMP.frames - 1, Math.floor(t / 0.09)) : 6 + (Math.floor((t - 0.9) / 0.06) % 4);
      const sx = (k % JUMP.cols) * JUMP.w;
      const sy = Math.floor(k / JUMP.cols) * JUMP.h;
      const shake = t < 0.3 ? 0.012 : 0.035;
      const scale = Math.max(W / JUMP.w, H / JUMP.h) * (1.06 + Math.min(0.12, t * 0.08) + Math.random() * 0.03);
      const dw = JUMP.w * scale;
      const dh = JUMP.h * scale;
      const dx = (W - dw) / 2 + (Math.random() - 0.5) * W * shake * 2;
      const dy = (H - dh) / 2 + (Math.random() - 0.5) * H * shake * 2;
      ctx.drawImage(sheet, sx, sy, JUMP.w, JUMP.h, dx, dy, dw, dh);
      if (Math.random() < 0.18) {
        ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.22)' : 'rgba(160,0,0,.25)';
        ctx.fillRect(0, 0, W, H);
      }
    }
    if (t < END + 0.45) {
      requestAnimationFrame(draw);
    } else {
      location.href = NEXT_PAGE;
    }
  };
  requestAnimationFrame(draw);
}

/* ---------- Pełny ekran ---------- */

function fullscreen() {
  if (document.fullscreenElement || document.webkitFullscreenElement) return;
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!req) return; // np. iPhone: strona i tak zajmuje cały ekran
  try {
    const p = req.call(el, { navigationUI: 'hide' });
    if (p && p.catch) p.catch(() => {});
  } catch {
    /* przeglądarka nie pozwoliła */
  }
}

// Po wyjściu z pełnego ekranu (np. Esc) wraca on przy następnym kliknięciu albo stuknięciu.
document.addEventListener('pointerdown', () => {
  if (started) fullscreen();
});

/* ---------- Start ---------- */

function locked(text) {
  gateTitle.textContent = 'BRAK SYGNAŁU';
  gateText.textContent = text;
  connect.hidden = true;
}

(async function init() {
  if (step() < 8) await whenSynced();
  const st = get();
  if (st.krok < 8 || !st.klucz) {
    locked('Ta kamera jest wyłączona.');
    return;
  }
  key = st.klucz;
  try {
    img.src = await loadFrame(0);
    await img.decode().catch(() => {});
  } catch (err) {
    console.error(err);
    locked('Nagranie jest uszkodzone.');
    return;
  }
  audioP = decrypt('noc/05a.bin', st.klucz);
  audioP.catch(() => {});
  preload();
  gateTitle.textContent = 'KAMERA 05 · SALA';
  gateText.textContent = 'Nagranie z 28.10.2023, godz. 02:37:21.';
  connect.hidden = false;
  connect.focus({ preventScroll: true });
})();

connect.addEventListener('click', async () => {
  connect.disabled = true;
  fullscreen();
  renderMap();
  map.hidden = false;
  switchTo('05');
  started = true;
  due = randIn(WAIT[0]);
  try {
    await startAudio();
  } catch (err) {
    console.error(err);
  }
});

map.addEventListener('click', (e) => {
  const b = e.target.closest('[data-cam]');
  if (b) switchTo(b.dataset.cam);
});

window.addEventListener('keydown', (e) => {
  if (map.hidden) return;
  const n = Number(e.key);
  if (n >= 1 && n <= CAMS.length) switchTo(String(n).padStart(2, '0'));
});
