/* Jajo: kamera 05. Odszyfrowuje nagranie (zdjęcie i dźwięk) kluczem z zagadek i pokazuje je na cały ekran jak monitoring. */
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
const ZOOM = [1, 1.1, 1.22, 1.36, 1.55]; // za każdym powrotem na kamerę 05 postać jest bliżej
const ALT = 'Kadr z kamery monitoringu: postać z nożem stoi na środku pustej sali restauracji.';

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
let visits = 0;

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
  const raw = await audioP;
  audioBuf = await new Promise((resolve, reject) => ac.decodeAudioData(raw.slice(0), resolve, reject));
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
  if (id === '05') {
    visits += 1;
    img.style.setProperty('--zoom', String(ZOOM[Math.min(visits - 1, ZOOM.length - 1)]));
    img.hidden = false;
    img.alt = ALT;
    gate.hidden = true;
    rec.hidden = false;
    noiseLevel = 0.07;
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
  try {
    const buf = await decrypt('noc/05.bin', st.klucz);
    img.src = URL.createObjectURL(new Blob([buf], { type: 'image/jpeg' }));
    await img.decode().catch(() => {});
  } catch (err) {
    console.error(err);
    locked('Nagranie jest uszkodzone.');
    return;
  }
  audioP = decrypt('noc/05a.bin', st.klucz);
  audioP.catch(() => {});
  gateTitle.textContent = 'KAMERA 05 · SALA';
  gateText.textContent = 'Nagranie z 28.10.2023, godz. 02:37:21.';
  connect.hidden = false;
  connect.focus({ preventScroll: true });
})();

connect.addEventListener('click', async () => {
  connect.disabled = true;
  renderMap();
  map.hidden = false;
  switchTo('05');
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
