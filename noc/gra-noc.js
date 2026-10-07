/* Pięć Koszmarnych Nocy u Magdy Gessler: jedna noc w biurze ochroniarza.
   Biuro z drzwiami i światłami, tablet z kamerami, prąd i czworo kucharzy, którzy ruszają się jak animatroniki z FNaF 1. */

export const HOUR = 89; // tyle sekund trwa jedna godzina (jak w oryginale)
const FLIP = 0.22; // podnoszenie i opuszczanie tabletu (s)
const DOOR_TIME = 0.26;

/* ---------- Biuro (współrzędne w obrazku 1672 × 941) ---------- */

const OW = 1672;
const OH = 941;
const ZOOM = 1.2; // biuro jest szersze niż ekran, więc można się rozglądać
// poly: otwór drzwi (korytarz przy świetle); shut: roleta - górą równo z dolną krawędzią belki framugi
const SIDE = {
  L: { poly: [[158, 95], [352, 148], [355, 795], [158, 880]], shut: [[158, 72], [352, 147], [355, 795], [158, 880]], door: [38, 366, 82, 444], light: [38, 451, 82, 529], corridor: 'kor-l', cx: 0.56, pan: -0.75, foot: 845 },
  R: { poly: [[1390, 150], [1545, 100], [1545, 860], [1392, 795]], shut: [[1390, 146], [1545, 76], [1545, 860], [1392, 795]], door: [1603, 366, 1651, 444], light: [1603, 451, 1651, 529], corridor: 'kor-p', cx: 0.6, pan: 0.75, foot: 835 },
};
const HONK = [[480, 276, 16], [1259, 324, 14]]; // nosy misiów na plakatach
// Okno nad biurkiem: Makłowicz może przybiec też tutaj. Zamyka je czerwony przycisk nad oknem (bez światła).
// Szyba bez wentylatora i monitora, które stoją przed oknem (zostają na wierzchu).
const WIN = {
  btn: [806, 169, 890, 231],
  glass: [[636, 252], [996, 252], [996, 418], [918, 418], [918, 478], [694, 478], [694, 430], [660, 392], [636, 388]],
  run: { x: 816, from: [470, 130], to: [690, 470] }, // [y stóp, wysokość] daleko i tuż przy szybie
};

/* ---------- Kamery (mapa w układzie 300 × 250) ---------- */

export const CAMS = [
  { id: '1A', name: 'Scena', img: 'k-scena', x: 150, y: 21 },
  { id: '1B', name: 'Jadalnia', img: 'k-jadalnia', x: 150, y: 89 },
  { id: '1C', name: 'Scena Makłowicza', img: 'k-maklo', x: 60, y: 118 },
  { id: '5', name: 'Zaplecze', img: 'k-zaplecze', x: 32, y: 64 },
  { id: '7', name: 'Ubikacje', img: 'k-ubikacje', x: 264, y: 66 },
  { id: '6', name: 'Kuchnia', img: 'k-kuchnia', x: 264, y: 126 },
  { id: '2A', name: 'Lewy korytarz', img: 'k-lewy', x: 113, y: 182 },
  { id: '4A', name: 'Prawy korytarz', img: 'k-prawy', x: 187, y: 182 },
];
const CAM = Object.fromEntries(CAMS.map((c) => [c.id, c]));

// Gdzie stoją postacie na kamerach: [x stóp, y stóp, wysokość postaci] jako ułamki obrazu.
const SPOTS = {
  '1A': [[0.355, 0.6, 0.44], [0.5, 0.6, 0.45], [0.645, 0.6, 0.44]],
  '1B': [[0.4, 0.41, 0.22], [0.22, 0.63, 0.36], [0.36, 0.82, 0.52], [0.62, 0.39, 0.2]],
  '2A': [[0.75, 0.44, 0.26], [0.56, 0.68, 0.48]],
  '4A': [[0.24, 0.43, 0.22], [0.42, 0.64, 0.42], [0.56, 0.93, 0.7]],
  5: [[0.33, 0.5, 0.34], [0.47, 0.88, 0.66], [0.8, 0.72, 0.5]],
  6: [[0.34, 0.565, 0.29], [0.2, 0.88, 0.6], [0.82, 0.76, 0.5]],
  7: [[0.53, 0.52, 0.3], [0.63, 0.8, 0.55], [0.3, 0.74, 0.46]],
};
const STAGE_SPOT = { mateusz: 0, magda: 1, michel: 2 };
const RUN_FROM = [0.75, 0.44, 0.26];
const RUN_TO = [0.4, 0.98, 0.8];
// Sprint Makłowicza: lewym korytarzem (najpierw kamera 2A, potem lewe drzwi przy zapalonym świetle) albo do okna.
const RUN_CAM = 3; // tyle sekund widać go na kamerze 2A
const DASH_L = 5.5; // od startu do lewych drzwi
const DASH_W = 3.5; // od startu do okna (widać go przez szybę)
const WINDOW_CHANCE = 0.4; // jak często wybiera okno zamiast korytarza
const RUN_FPS = 12;

/* ---------- Trudność (jak w FNaF 1) ---------- */

export const NAMES = { magda: 'Magda', mateusz: 'Mateusz', michel: 'Michel', robert: 'Robert' };
const STEP = { magda: 3.02, mateusz: 4.97, michel: 4.98, robert: 5.01 }; // co ile sekund kucharz próbuje się ruszyć
export const LEVELS = {
  1: { magda: 0, mateusz: 0, michel: 0, robert: 0 },
  2: { magda: 0, mateusz: 3, michel: 1, robert: 1 },
  3: { magda: 1, mateusz: 0, michel: 5, robert: 2 },
  4: { magda: 1, mateusz: 2, michel: 4, robert: 6 },
  5: { magda: 3, mateusz: 5, michel: 7, robert: 5 },
  6: { magda: 4, mateusz: 10, michel: 12, robert: 16 },
};
// Prąd: każda kreska zużycia zabiera tyle procent na sekundę, a do tego każda noc ma własny stały ubytek
// (PASSIVE, %/s). Liczby dobrane symulacją: dobry gracz kończy 1. noc z ok. 30% prądu, 2. z ok. 22%,
// 3. z ok. 15%, 4. i 5. z ok. 10%, a kto przesiedzi noc za dwojgiem zamkniętych drzwi, zostaje bez prądu przed 4:00.
const DRAIN = 0.068;
const PASSIVE = { 1: 0.04, 2: 0.036, 3: 0.04, 4: 0.012, 5: 0.009, 6: 0.004, 7: 0.008 };
const KNOCK = 2; // walenie Makłowicza w drzwi: 1%, potem o tyle więcej za każdym razem
const BOTH_DOORS = 1.5; // oba drzwi zamknięte naraz zabierają dodatkowo tyle „kresek” (żeby nie dało się przesiedzieć nocy za zamkniętymi drzwiami)

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- Grafika przygotowana raz na całą grę ---------- */

/** Przyciemnia i ociepla zdjęcia postaci, żeby pasowały do ciemnych pomieszczeń. */
export function prepareArt(img) {
  const tint = (im, top, bottom, maxH = 720) => {
    const s = Math.min(1, maxH / im.height);
    const w = Math.round(im.width * s);
    const h = Math.round(im.height * s);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const x = c.getContext('2d');
    x.drawImage(im, 0, 0, w, h);
    x.globalCompositeOperation = 'multiply';
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
    x.globalCompositeOperation = 'destination-in';
    x.drawImage(im, 0, 0, w, h);
    return c;
  };
  const art = { cam: {}, lit: {} };
  for (const n of Object.keys(NAMES)) {
    for (const p of [1, 2]) {
      const im = img.get(`p-${n}${p}`);
      art.cam[n + p] = tint(im, 'rgb(168,143,117)', 'rgb(88,75,60)');
      art.lit[n + p] = tint(im, 'rgb(232,214,186)', 'rgb(150,132,108)');
    }
  }
  // klatki biegu Makłowicza: ciemniejsze na kamerę i w oknie, jaśniejsze w drzwiach przy zapalonym świetle
  const run = img.get('r-robert');
  art.runCam = tint(run, 'rgb(160,138,112)', 'rgb(122,104,84)', run.height);
  art.runLit = tint(run, 'rgb(236,218,190)', 'rgb(206,188,160)', run.height);
  art.shutter = shutterTexture(300, 1100, 42, 96); // drzwi
  art.shutterWin = shutterTexture(720, 330, 30, 40); // okno
  return art;
}

// Metalowa roleta: lamele z połyskiem na górnej krawędzi, ziarno i rysy stali, brud, rdza i zacieki,
// na dole stalowa listwa w żółto-czarne pasy z uchwytem. Kolory ciepłe jak światło w biurze.
function shutterTexture(W, H, slat, bar) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d');
  const body = H - bar;
  for (let y = 0; y < body; y += slat) {
    const g = x.createLinearGradient(0, y, 0, y + slat);
    g.addColorStop(0, '#120e0a');
    g.addColorStop(0.07, '#77624a');
    g.addColorStop(0.2, '#5b4a38');
    g.addColorStop(0.55, '#41352a');
    g.addColorStop(0.86, '#2a221b');
    g.addColorStop(0.95, '#18130f');
    g.addColorStop(1, '#0b0907');
    x.fillStyle = g;
    x.fillRect(0, y, W, Math.min(slat, body - y));
  }
  // szczotkowana stal: krótkie poziome rysy
  for (let i = 0; i < (W * body) / 70; i++) {
    x.fillStyle = Math.random() < 0.6 ? `rgba(255,236,200,${Math.random() * 0.05})` : `rgba(0,0,0,${Math.random() * 0.12})`;
    x.fillRect(Math.random() * W, Math.random() * body, 8 + Math.random() * 70, 1);
  }
  // ziarno
  const id = x.getImageData(0, 0, W, body);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 16;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  x.putImageData(id, 0, 0);
  // rdza i plamy, więcej przy dole
  for (let i = 0; i < (W * body) / 2600; i++) {
    const px = Math.random() * W;
    const py = body * Math.sqrt(Math.random());
    const r = 4 + Math.random() * (W / 9);
    const g = x.createRadialGradient(px, py, 0, px, py, r);
    const a = 0.08 + Math.random() * 0.22;
    g.addColorStop(0, `rgba(${110 + Math.random() * 40},${52 + Math.random() * 20},${18 + Math.random() * 10},${a})`);
    g.addColorStop(1, 'rgba(90,45,15,0)');
    x.fillStyle = g;
    x.fillRect(px - r, py - r, r * 2, r * 2);
  }
  // zacieki spod szczelin
  for (let i = 0; i < W / 6; i++) {
    const px = Math.random() * W;
    const py = Math.floor((Math.random() * body) / slat) * slat + slat * 0.9;
    const len = slat * (0.4 + Math.random() * 2.5);
    const g = x.createLinearGradient(0, py, 0, py + len);
    g.addColorStop(0, `rgba(55,32,14,${0.25 + Math.random() * 0.3})`);
    g.addColorStop(1, 'rgba(55,32,14,0)');
    x.fillStyle = g;
    x.fillRect(px, py, 1 + Math.random() * 3, len);
  }
  // brud: ciemniej u góry (cień futryny) i przy samym dole
  const dirt = x.createLinearGradient(0, 0, 0, body);
  dirt.addColorStop(0, 'rgba(0,0,0,.72)');
  dirt.addColorStop(0.06, 'rgba(0,0,0,.45)');
  dirt.addColorStop(0.22, 'rgba(0,0,0,.12)');
  dirt.addColorStop(0.6, 'rgba(0,0,0,0)');
  dirt.addColorStop(1, 'rgba(30,18,8,.45)');
  x.fillStyle = dirt;
  x.fillRect(0, 0, W, body);
  // boczne prowadnice
  const rw = Math.max(4, W * 0.035);
  for (const [rx, dir] of [[0, 1], [W - rw, -1]]) {
    const rg = x.createLinearGradient(rx, 0, rx + rw, 0);
    rg.addColorStop(0, dir > 0 ? '#060504' : '#2b241d');
    rg.addColorStop(0.5, '#3a3027');
    rg.addColorStop(1, dir > 0 ? '#2b241d' : '#060504');
    x.fillStyle = rg;
    x.fillRect(rx, 0, rw, body);
  }
  // dolna listwa: stal, pasy ostrzegawcze, uchwyt, gumowa uszczelka
  const sg = x.createLinearGradient(0, body, 0, H);
  sg.addColorStop(0, '#0b0a09');
  sg.addColorStop(0.08, '#806b52');
  sg.addColorStop(0.25, '#51432f');
  sg.addColorStop(1, '#241d16');
  x.fillStyle = sg;
  x.fillRect(0, body, W, bar);
  const sy = body + bar * 0.18;
  const sh = bar * 0.5;
  x.save();
  x.beginPath();
  x.rect(0, sy, W, sh);
  x.clip();
  x.fillStyle = '#b8901c';
  x.fillRect(0, sy, W, sh);
  x.fillStyle = '#121110';
  const step = sh * 1.6;
  for (let i = -sh * 2; i < W + sh * 2; i += step) {
    x.beginPath();
    x.moveTo(i, sy + sh);
    x.lineTo(i + step / 2, sy + sh);
    x.lineTo(i + step / 2 + sh, sy);
    x.lineTo(i + sh, sy);
    x.fill();
  }
  const wear = x.createLinearGradient(0, sy, 0, sy + sh);
  wear.addColorStop(0, 'rgba(255,240,200,.18)');
  wear.addColorStop(0.5, 'rgba(0,0,0,0)');
  wear.addColorStop(1, 'rgba(0,0,0,.35)');
  x.fillStyle = wear;
  x.fillRect(0, sy, W, sh);
  for (let i = 0; i < W / 3; i++) {
    x.fillStyle = `rgba(20,16,12,${Math.random() * 0.5})`;
    x.fillRect(Math.random() * W, sy + Math.random() * sh, 1 + Math.random() * 6, 1 + Math.random() * 2);
  }
  x.restore();
  // uchwyt na środku
  const hw = Math.min(W * 0.22, bar * 2.2);
  const hx = (W - hw) / 2;
  const hy = sy + sh + bar * 0.06;
  const hh = bar * 0.16;
  x.fillStyle = '#0e0d0b';
  x.fillRect(hx - 2, hy - 1, hw + 4, hh + 3);
  const hg = x.createLinearGradient(0, hy, 0, hy + hh);
  hg.addColorStop(0, '#9a8f7c');
  hg.addColorStop(1, '#3a342c');
  x.fillStyle = hg;
  x.fillRect(hx, hy, hw, hh);
  x.fillStyle = '#080807';
  x.fillRect(0, H - bar * 0.1, W, bar * 0.1);
  return c;
}

/* ---------- Noc ---------- */

export class Night {
  /**
   * opts: canvas, ui (elementy HUD), img (Map obrazków), art, meta, sound, night (1–7, 7 = własna),
   *       levels { magda, mateusz, michel, robert }, custom, setNoise(v), onEnd(wynik, kto)
   */
  constructor(opts) {
    Object.assign(this, opts);
    this.ctx = this.canvas.getContext('2d');
    this.time = 0;
    this.hour = 0;
    this.power = 99.9;
    this.door = { L: false, R: false };
    this.light = { L: false, R: false };
    this.doorAnim = { L: 0, R: 0 };
    this.broken = { L: false, R: false };
    this.cam = false;
    this.camAnim = 0;
    this.camId = '1A';
    this.camStatic = 0;
    this.camT = 0;
    this.pan = 0.5;
    this.mouseX = -1;
    this.keys = new Set();
    this.lvl = { ...this.levels };
    this.timers = { magda: 0, mateusz: 0, michel: 0, robert: 0 };
    this.ch = {
      magda: { loc: '1A', spot: 1, pose: 1 },
      mateusz: { loc: '1A', spot: 0, pose: 1 },
      michel: { loc: '1A', spot: 2, pose: 1 },
      robert: { stage: 0, lock: 0, wait: -1, route: 'L', dash: -1, knocks: 0 },
    };
    this.out = null; // brak prądu
    this.jump = null;
    this.over = false;
    this.paused = false;
    this.flicker = 0;
    this.okno = false; // okno zamknięte
    this.oknoAnim = 0;
    this.next = { breath: 2, oven: 3, garble: 4, smiech: 6, halluc: 30 };
    this.hud = { time: '', power: -1, usage: -1, night: '' };
    this.frame = this.frame.bind(this);
    this.bind();
    this.resize();
  }

  start() {
    const s = this.sound;
    s.loop('amb', 'amb', { gain: 0.55, fadeIn: 1.5 });
    s.loop('fan', 'fan', { gain: 0.1, fadeIn: 1.5 }); // wentylator: cicho w tle (był 0.3, przeszkadzał)
    this.ui.hud.hidden = false;
    this.ui.nightLbl.textContent = `Noc ${this.night}`;
    this.updateHud(true);
    this.setNoise(0);
    this.last = 0;
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy() {
    this.dead = true;
    cancelAnimationFrame(this.raf);
    this.unbind();
    this.ui.hud.hidden = true;
    this.ui.camUi.hidden = true;
  }

  setPaused(p) {
    this.paused = p;
    if (p) this.sound.suspend();
    else this.sound.resume();
  }

  /* ---------- Sterowanie ---------- */

  bind() {
    const ui = this.ui;
    const on = (el, type, fn, opt) => {
      el.addEventListener(type, fn, opt);
      (this.off = this.off || []).push(() => el.removeEventListener(type, fn, opt));
    };
    on(window, 'resize', () => this.resize());
    on(window, 'pointermove', (e) => {
      if (e.pointerType === 'mouse') this.mouseX = e.clientX / this.W;
      if (this.drag && e.pointerId === this.drag.id) {
        const dx = e.clientX - this.drag.x;
        if (Math.abs(dx) > 6) this.drag.moved = true;
        if (!this.cam && this.panRange > 0) this.pan = clamp(this.drag.pan - dx / this.panRange, 0, 1);
      }
    });
    on(document, 'pointerleave', () => {
      this.mouseX = -1;
    });
    on(window, 'blur', () => {
      this.mouseX = -1;
      this.keys.clear();
    });
    on(this.canvas, 'pointerdown', (e) => {
      this.drag = { id: e.pointerId, x: e.clientX, pan: this.pan, moved: false };
    });
    on(window, 'pointerup', (e) => {
      if (this.drag && e.pointerId === this.drag.id) {
        if (!this.drag.moved) this.tap(e.clientX, e.clientY);
        this.drag = null;
      }
    });
    on(window, 'pointercancel', () => {
      this.drag = null;
    });
    // Przyciski: dotyk i mysz działają od razu przy naciśnięciu, klawiatura przez „click”.
    const press = (el, fn) => {
      on(el, 'pointerdown', (e) => {
        e.preventDefault();
        fn();
      });
      on(el, 'click', (e) => {
        if (e.detail === 0) fn();
      });
    };
    press(ui.doorL, () => this.toggleDoor('L'));
    press(ui.doorR, () => this.toggleDoor('R'));
    press(ui.lightL, () => this.toggleLight('L'));
    press(ui.lightR, () => this.toggleLight('R'));
    press(ui.win, () => this.toggleWindow());
    // Tablet: myszką wystarczy najechać na pasek (jak w oryginale), palcem trzeba stuknąć.
    on(ui.camBar, 'pointerenter', (e) => {
      if (e.pointerType === 'mouse') this.toggleCam();
    });
    on(ui.camBar, 'pointerdown', (e) => {
      e.preventDefault();
      if (e.pointerType !== 'mouse') this.toggleCam();
    });
    on(ui.camBar, 'click', (e) => {
      if (e.detail === 0) this.toggleCam();
    });
    on(ui.map, 'pointerdown', (e) => {
      const b = e.target.closest('[data-cam]');
      if (!b) return;
      e.preventDefault();
      this.switchCam(b.dataset.cam);
    });
    on(ui.map, 'click', (e) => {
      const b = e.target.closest('[data-cam]');
      if (b && e.detail === 0) this.switchCam(b.dataset.cam);
    });
    on(ui.mute, 'click', () => this.muteCall());
    on(window, 'keydown', (e) => {
      if (e.repeat && !e.key.startsWith('Arrow')) return;
      const k = e.key.toLowerCase();
      const onButton = e.target.closest && e.target.closest('button');
      if ((k === ' ' || k === 'enter') && onButton) return; // przycisk sam to obsłuży
      if (k === 'arrowleft' || k === 'arrowright') this.keys.add(k);
      else if (k === ' ' || k === 's') this.toggleCam();
      else if (k === 'q') this.toggleDoor('L');
      else if (k === 'a') this.toggleLight('L');
      else if (k === 'e') this.toggleDoor('R');
      else if (k === 'd') this.toggleLight('R');
      else if (k === 'w') this.toggleWindow();
      else if (this.cam && /^[1-8]$/.test(k)) this.switchCam(CAMS[Number(k) - 1].id);
      else return;
      e.preventDefault();
    });
    on(window, 'keyup', (e) => this.keys.delete(e.key.toLowerCase()));
  }

  unbind() {
    (this.off || []).forEach((f) => f());
    this.off = [];
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.canvas.width = Math.round(this.W * dpr);
    this.canvas.height = Math.round(this.H * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingQuality = 'high';
    this.S = Math.max(this.H / OH, this.W / OW) * ZOOM;
    this.panRange = Math.max(0, OW * this.S - this.W);
    this.vignette = null;
  }

  // Stuknięcie w biuro: nos misia na plakacie trąbi.
  tap(x, y) {
    if (this.cam || this.over || this.camAnim > 0) return;
    const { S, ox, oy } = this.view();
    const ix = (x - ox) / S;
    const iy = (y - oy) / S;
    if (HONK.some(([hx, hy, r]) => Math.hypot(ix - hx, iy - hy) < r * 1.6)) this.sound.play('honk', { gain: 0.8 });
  }

  view() {
    const S = this.S;
    return { S, ox: -this.pan * this.panRange, oy: (this.H - OH * S) / 2 };
  }

  toggleCam() {
    if (this.over || this.out || this.jump) return;
    if (this.camAnim > 0 && this.camAnim < 1) return; // tablet właśnie się podnosi albo opada
    this.cam = !this.cam;
    const s = this.sound;
    if (this.cam) {
      s.play('camup', { gain: 0.55 });
      s.loop('camloop', 'camloop', { gain: 0.3, fadeIn: 0.4 });
      this.light.L = this.light.R = false;
      s.stopLoop('hum', 0.05);
      this.camStatic = Math.max(this.camStatic, 0.5);
    } else {
      s.play('camdown', { gain: 0.6 });
      s.stopLoop('camloop', 0.15);
      this.ui.camUi.hidden = true;
      // Makłowicz nie rusza się zaraz po opuszczeniu tabletu
      this.ch.robert.lock = rand(0.83, 16.67);
      // Ktoś wszedł do biura, gdy patrzyłeś w kamery
      for (const n of ['mateusz', 'michel', 'magda']) {
        if (this.ch[n].loc === 'IN') {
          setTimeout(() => this.attack(n), FLIP * 1000 + 60);
          break;
        }
      }
    }
  }

  switchCam(id) {
    if (!this.cam || id === this.camId || !CAM[id]) return;
    this.camId = id;
    this.sound.play('blip', { gain: 0.6 });
    this.camStatic = Math.max(this.camStatic, 0.45);
    this.updateCamUi();
  }

  updateCamUi() {
    const c = CAM[this.camId];
    this.ui.camName.textContent = c.name;
    this.ui.map.querySelectorAll('[data-cam]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cam === this.camId)));
  }

  toggleDoor(side) {
    if (this.over || this.cam || this.camAnim > 0) return;
    if (this.broken[side] || this.out) {
      this.sound.play('error', { gain: 0.7, pan: SIDE[side].pan });
      return;
    }
    this.door[side] = !this.door[side];
    this.sound.play('door', { gain: 0.9, pan: SIDE[side].pan });
  }

  toggleWindow() {
    if (this.over || this.cam || this.camAnim > 0) return;
    if (this.out) {
      this.sound.play('error', { gain: 0.7 });
      return;
    }
    this.okno = !this.okno;
    this.sound.play('door', { gain: 0.9 });
  }

  toggleLight(side) {
    if (this.over || this.cam || this.camAnim > 0) return;
    if (this.broken[side] || this.out) {
      this.sound.play('error', { gain: 0.7, pan: SIDE[side].pan });
      return;
    }
    const on = !this.light[side];
    this.light.L = this.light.R = false;
    this.light[side] = on;
    if (on) {
      this.sound.loop('hum', 'hum', { gain: 2.4, fadeIn: 0.05, pan: SIDE[side].pan * 0.6 });
      this.checkWindow(side);
    } else {
      this.sound.stopLoop('hum', 0.05);
    }
  }

  // Światło pokazało kogoś w drzwiach: ostry dźwięk tylko za pierwszym razem.
  checkWindow(side) {
    const n = side === 'L' ? 'mateusz' : 'michel';
    const c = this.ch[n];
    if (c.loc === (side === 'L' ? 'DL' : 'DR') && !c.seen) {
      c.seen = true;
      this.sound.play('window', { gain: 1, pan: SIDE[side].pan * 0.5 });
    }
  }

  muteCall() {
    if (this.call) this.call.stop(0.3);
    this.call = null;
    this.ui.mute.hidden = true;
  }

  /* ---------- Pętla gry ---------- */

  frame(now) {
    if (this.dead) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0;
    this.last = now;
    if (!this.paused) this.update(dt);
    this.render();
  }

  update(dt) {
    if (this.jump) {
      this.jump.t += dt;
      if (this.jump.t >= this.jump.dur && !this.jump.done) {
        this.jump.done = true;
        this.finish('dead', this.jump.name);
      }
      return;
    }
    if (this.over) return;
    this.time += dt;
    const h = Math.floor(this.time / HOUR);
    if (h > this.hour) {
      this.hour = h;
      if (h >= 6) {
        this.win();
        return;
      }
      this.onHour(h);
    }
    // drzwi i tablet
    for (const s of ['L', 'R']) {
      const target = this.door[s] ? 1 : 0;
      const d = this.doorAnim[s];
      this.doorAnim[s] = d < target ? Math.min(target, d + dt / DOOR_TIME) : Math.max(target, d - dt / DOOR_TIME);
    }
    this.oknoAnim = this.okno ? Math.min(1, this.oknoAnim + dt / DOOR_TIME) : Math.max(0, this.oknoAnim - dt / DOOR_TIME);
    const camWas = this.camAnim;
    this.camAnim = this.cam ? Math.min(1, this.camAnim + dt / FLIP) : Math.max(0, this.camAnim - dt / FLIP);
    if (this.camAnim === 1 && camWas < 1) {
      this.ui.camUi.hidden = false;
      this.updateCamUi();
    }
    this.updatePan(dt);
    this.camT += dt;
    this.camStatic = Math.max(0, this.camStatic - dt * 1.4);
    this.flicker = Math.random() < 0.02 ? rand(0.1, 0.3) : this.flicker * 0.85;

    if (this.out) {
      this.updateOut(dt);
    } else {
      // prąd
      this.power -= dt * this.drain();
      if (this.power <= 0) {
        this.power = 0;
        this.powerOut();
      } else {
        for (const n of Object.keys(STEP)) {
          this.timers[n] += dt;
          if (this.timers[n] >= STEP[n]) {
            this.timers[n] -= STEP[n];
            this.opportunity(n);
          }
        }
        this.updateMagda(dt);
        this.updateRobert(dt);
        this.updateInside(dt);
        this.ambience(dt);
      }
    }
    this.updateCall();
    this.updateHud();
  }

  // Prąd na sekundę: każda „kreska” zużycia plus stały ubytek danej nocy.
  drain() {
    return DRAIN * this.usage() + PASSIVE[this.night];
  }

  // Kreski zużycia: podstawa, drzwi, światło i kamery. Oba drzwi naraz kosztują dodatkowo.
  usage() {
    if (this.out) return 0;
    const doors = (this.door.L ? 1 : 0) + (this.door.R ? 1 : 0);
    return 1 + doors + (doors === 2 ? BOTH_DOORS : 0) + (this.okno ? 1 : 0) + (this.light.L || this.light.R ? 1 : 0) + (this.cam ? 1 : 0);
  }

  updatePan(dt) {
    if (this.cam || this.camAnim > 0 || this.panRange <= 0) return;
    let v = 0;
    const m = this.mouseX;
    if (m >= 0 && !this.drag) {
      if (m < 0.3) v = -(0.3 - m) / 0.3;
      else if (m > 0.7) v = (m - 0.7) / 0.3;
    }
    if (this.keys.has('arrowleft')) v = -1;
    if (this.keys.has('arrowright')) v = 1;
    // stała prędkość w pikselach, żeby na każdym ekranie rozglądanie trwało podobnie
    if (v) this.pan = clamp(this.pan + (v * dt * 1250 * this.S) / this.panRange, 0, 1);
  }

  onHour(h) {
    if (this.custom) return;
    // co godzinę kucharze robią się odrobinę śmielsi (jak w oryginale)
    if (h === 2) this.lvl.mateusz += 1;
    if (h === 3 || h === 4) {
      this.lvl.mateusz += 1;
      this.lvl.michel += 1;
      this.lvl.robert += 1;
    }
    if (h === 2 && this.night >= 2) this.sound.loop('eerie', 'eerie', { gain: 0.22, fadeIn: 6 });
    if (h === 3 && this.night >= 4) this.sound.play('cold', { gain: 0.3, fadeIn: 4 });
  }

  updateCall() {
    if (this.callDone || this.night > 5 || this.custom) return;
    if (this.time < 2.5) return;
    const id = `call${this.night}`;
    if (!this.sound.has(id)) {
      if (this.time > 20) this.callDone = true; // nagranie nie zdążyło się wczytać
      return;
    }
    this.callDone = true;
    this.call = this.sound.play(id, { gain: 1.1 });
    this.ui.mute.hidden = false;
    this.call.ended.then(() => {
      if (this.dead) return;
      this.ui.mute.hidden = true;
      this.call = null;
    });
  }

  /* ---------- Ruchy kucharzy ---------- */

  opportunity(n) {
    if (n === 'robert') return this.robertStep();
    const lvl = this.lvl[n];
    const c = this.ch[n];
    const watching = this.cam && this.camAnim === 1;
    if (n === 'magda') {
      // Magda rusza się tylko wtedy, gdy nikt na nią nie patrzy. Jak Freddy w oryginale:
      // po udanym rzucie odczekuje chwilę (im niższy poziom, tym dłużej), dopiero potem idzie.
      if (c.delay > 0) return;
      if (!c.ready) {
        if (lvl <= 0 || 1 + Math.floor(Math.random() * 20) > lvl) return;
        c.ready = true;
        c.delay = Math.max(0, (1000 - 100 * lvl) / 60);
        if (c.delay > 0) return;
      }
      if (watching && this.camId === c.loc) return;
    } else if (lvl <= 0 || 1 + Math.floor(Math.random() * 20) > lvl) {
      return;
    }
    let to = null;
    if (n === 'mateusz') {
      to = {
        '1A': () => pick(['1B', '5']),
        '1B': () => pick(['5', '2A']),
        5: () => pick(['1B', '2A']),
        '2A': () => (Math.random() < 0.75 ? 'DL' : '5'),
        DL: () => (this.door.L ? '1B' : 'IN'),
      }[c.loc];
    } else if (n === 'michel') {
      to = {
        '1A': () => '1B',
        '1B': () => pick(['7', '6']),
        7: () => pick(['6', '4A']),
        6: () => pick(['7', '4A']),
        '4A': () => (Math.random() < 0.75 ? 'DR' : '6'),
        DR: () => (this.door.R ? '6' : 'IN'),
      }[c.loc];
    } else if (n === 'magda') {
      // schodzi ze sceny dopiero, gdy Mateusz i Michel już poszli
      to = {
        '1A': () => (this.ch.mateusz.loc !== '1A' && this.ch.michel.loc !== '1A' ? '1B' : null),
        '1B': () => '7',
        7: () => '6',
        6: () => '4A',
        '4A': () => {
          if (this.door.R) return '6';
          return watching && this.camId !== '4A' ? 'IN' : null;
        },
      }[c.loc];
    }
    const dest = to ? to() : null;
    if (dest) {
      if (n === 'magda') c.ready = false;
      this.relocate(n, dest);
    }
  }

  relocate(n, to) {
    const c = this.ch[n];
    const from = c.loc;
    if (this.cam && this.camAnim === 1 && (this.camId === from || this.camId === to)) {
      // obraz z kamery się rwie, gdy ktoś przechodzi
      this.camStatic = 1.5;
      this.sound.play(pick(['garble1', 'garble2', 'garble3']), { gain: 0.45 });
    }
    c.loc = to;
    c.seen = false;
    if (to === '1A') {
      c.spot = STAGE_SPOT[n];
      c.pose = 1;
    } else if (SPOTS[to]) {
      const taken = new Set(['magda', 'mateusz', 'michel'].filter((o) => o !== n && this.ch[o].loc === to).map((o) => this.ch[o].spot));
      const free = SPOTS[to].map((_, i) => i).filter((i) => !taken.has(i));
      c.spot = n === 'magda' && free.includes(0) ? 0 : pick(free.length ? free : [0]);
      c.pose = Math.random() < 0.5 ? 1 : 2;
    }
    const side = n === 'mateusz' ? 'L' : 'R';
    if (n === 'magda') this.sound.play('smiech-magda', { gain: 0.32, rate: rand(0.94, 1.06) });
    if (to === 'DL' || to === 'DR') {
      this.steps(side, 0.55);
      if (this.light[side]) this.checkWindow(side);
    }
    if ((from === 'DL' || from === 'DR') && to !== 'IN') this.steps(side, 0.3);
    if (to === 'IN') {
      // wszedł do biura: przyciski po tej stronie przestają działać
      const s = n === 'mateusz' ? 'L' : 'R';
      this.broken[s] = true;
      this.light[s] = false;
      if (!this.light.L && !this.light.R) this.sound.stopLoop('hum', 0.05);
      c.inT = 0;
      c.wait = n === 'magda' ? 0 : rand(3, 9);
    }
  }

  // Odliczanie Magdy po udanym rzucie: gdy minie, rusza przy najbliższej okazji (o ile nikt nie patrzy).
  updateMagda(dt) {
    const c = this.ch.magda;
    if (!(c.delay > 0)) return;
    c.delay -= dt;
    if (c.delay <= 0) {
      c.delay = 0;
      this.timers.magda = STEP.magda;
    }
  }

  steps(side, gain) {
    const h = this.sound.play('steps', { gain, pan: SIDE[side].pan, offset: rand(0, 4) });
    setTimeout(() => h.stop(0.4), 1800);
  }

  robertStep() {
    const r = this.ch.robert;
    if (r.stage >= 3 || this.cam || this.camAnim > 0 || r.lock > 0) return;
    const lvl = this.lvl.robert;
    if (lvl <= 0 || 1 + Math.floor(Math.random() * 20) > lvl) return;
    r.stage += 1;
    if (r.stage === 3) {
      // wybiegł zza kurtyny: za chwilę będzie przy lewych drzwiach albo przy oknie
      r.wait = 25;
      r.route = Math.random() < WINDOW_CHANCE ? 'W' : 'L';
      r.dash = -1;
    }
  }

  updateRobert(dt) {
    const r = this.ch.robert;
    if (r.lock > 0) r.lock -= dt;
    if (r.stage < 3) return;
    if (r.dash < 0) {
      // czeka poza sceną; gdy patrzysz na lewy korytarz, a on biegnie tamtędy, rusza od razu
      const watching2A = this.cam && this.camAnim === 1 && this.camId === '2A';
      r.wait -= watching2A && r.route === 'L' ? r.wait : dt;
      if (r.wait > 0) return;
      r.dash = 0;
      r.atDoor = false;
      this.sound.play('runfast', { gain: 0.95, pan: r.route === 'L' ? -0.6 : 0 });
      return;
    }
    r.dash += dt;
    if (r.route === 'L' && r.dash >= RUN_CAM && !r.atDoor) {
      r.atDoor = true; // już przy lewych drzwiach: tupot tuż obok
      this.sound.play('run', { gain: 0.9, pan: -0.8 });
    }
    if (r.dash < (r.route === 'L' ? DASH_L : DASH_W)) return;
    if (r.route === 'L' ? this.door.L : this.okno) {
      // walenie w drzwi albo w roletę okna zabiera prąd (za każdym razem więcej)
      const pan = r.route === 'L' ? -0.7 : 0;
      this.sound.play('knock', { gain: 1, pan });
      this.sound.play('pound', { gain: 0.6, pan });
      this.power = Math.max(0.01, this.power - (1 + KNOCK * r.knocks));
      r.knocks += 1;
      r.stage = Math.random() < 0.5 ? 0 : 1;
      r.wait = -1;
      r.dash = -1;
    } else {
      this.attack('robert');
    }
  }

  // Klatka biegu Makłowicza: [arkusz, x, y, szer., wys., wysokość względem całej postaci]
  runFrame(t, lit) {
    const m = this.meta['r-robert'];
    const fr = m.frames[1 + (Math.floor(t * RUN_FPS) % (m.frames.length - 1))]; // pierwsza klatka to start w miejscu
    return [lit ? this.art.runLit : this.art.runCam, fr[0], fr[1], fr[2], fr[3], fr[3] / m.ref];
  }

  // Rysuje biegnącego Makłowicza: stopy w (x, y), h = wysokość całej postaci.
  drawRun(t, lit, x, y, h, alpha = 1) {
    const [sheet, sx, sy, sw, sh, k] = this.runFrame(t, lit);
    const fh = h * k;
    const fw = (sw * fh) / sh;
    const ctx = this.ctx;
    ctx.globalAlpha = alpha;
    ctx.drawImage(sheet, sx, sy, sw, sh, x - fw / 2, y - fh, fw, fh);
    ctx.globalAlpha = 1;
  }

  // Ktoś jest w biurze: atakuje po opuszczeniu tabletu (albo po chwili, gdy tablet jest opuszczony).
  updateInside(dt) {
    for (const n of ['mateusz', 'michel', 'magda']) {
      const c = this.ch[n];
      if (c.loc !== 'IN') continue;
      c.inT += dt;
      if (this.cam) {
        if (c.inT > 25 && this.camAnim === 1) this.toggleCam(); // tablet sam opada
        continue;
      }
      if (this.camAnim > 0) continue;
      if (n === 'magda') {
        if (Math.random() < 0.25 * dt) return this.attack(n);
      } else {
        c.wait -= dt;
        if (c.wait <= 0) return this.attack(n);
      }
    }
  }

  ambience(dt) {
    const s = this.sound;
    const n = this.next;
    const view = this.cam && this.camAnim === 1 ? this.camId : '';
    for (const k of Object.keys(n)) n[k] -= dt;
    // oddech, gdy ktoś stoi w biurze, a Ty patrzysz w kamery
    if (n.breath <= 0) {
      n.breath = rand(3, 6);
      if (this.cam && ['mateusz', 'michel', 'magda'].some((m) => this.ch[m].loc === 'IN')) s.play(pick(['breath1', 'breath2', 'breath3', 'breath4']), { gain: 0.8 });
    }
    // Michel w kuchni hałasuje garnkami
    if (n.oven <= 0) {
      n.oven = rand(4, 9);
      if (this.ch.michel.loc === '6') s.play(pick(['oven1', 'oven2', 'oven3', 'oven4']), { gain: view === '6' ? 0.9 : 0.22, pan: 0.4 });
    }
    // Magda w kuchni: muzyczka
    if (this.ch.magda.loc === '6') s.loop('circus', 'circus', { gain: view === '6' ? 0.6 : 0.1, fadeIn: 0.3 });
    else if (s.loops.has('circus')) s.stopLoop('circus', 0.8);
    // roboty mamroczą na kamerach
    if (n.garble <= 0) {
      n.garble = rand(5, 12);
      if (view && ['mateusz', 'michel'].some((m) => this.ch[m].loc === view) && Math.random() < 0.35) s.play(pick(['garble1', 'garble2', 'garble3']), { gain: 0.35 });
    }
    // Makłowicz nuci za kurtyną
    if (n.smiech <= 0) {
      n.smiech = rand(8, 16);
      if (view === '1C' && this.ch.robert.stage < 3 && Math.random() < 0.3) s.play('smiech-robert', { gain: 0.8 });
    }
    // rzadka halucynacja (od 3. nocy)
    if (n.halluc <= 0) {
      n.halluc = rand(40, 90);
      if (this.night >= 3 && Math.random() < 0.12) this.hallucinate();
    }
    if (this.halluc > 0) this.halluc -= dt;
  }

  hallucinate() {
    this.halluc = 0.7;
    const h = this.sound.play('robot', { gain: 0.6, offset: rand(0, 12) });
    setTimeout(() => h.stop(0.2), 900);
  }

  /* ---------- Brak prądu ---------- */

  powerOut() {
    this.out = { phase: 0, t: 0, tick: 0, music: null };
    const s = this.sound;
    if (this.cam) {
      this.cam = false;
      this.ui.camUi.hidden = true;
    }
    this.camAnim = 0;
    if (this.door.L || this.door.R || this.okno) s.play('door', { gain: 0.8 });
    this.door.L = this.door.R = false;
    this.okno = false;
    this.light.L = this.light.R = false;
    ['amb', 'fan', 'hum', 'camloop', 'eerie', 'circus'].forEach((k) => s.stopLoop(k, 0.1));
    if (this.call) this.muteCall();
    s.play('powerdown', { gain: 0.9 });
  }

  updateOut(dt) {
    const o = this.out;
    o.t += dt;
    o.tick += dt;
    if (o.phase === 0) {
      // ciemność i cisza, potem w lewych drzwiach pojawia się Magda z pozytywką
      if ((o.tick >= 5 && ((o.tick = 0), Math.random() < 0.2)) || o.t >= 20) {
        o.phase = 1;
        o.t = 0;
        o.tick = 0;
        o.music = this.sound.play('musicbox', { gain: 0.75 });
      }
    } else if (o.phase === 1) {
      if ((o.tick >= 5 && ((o.tick = 0), Math.random() < 0.2)) || o.t >= 20) {
        o.phase = 2;
        o.t = 0;
        o.tick = 0;
        if (o.music) o.music.stop(0.2);
      }
    } else if (o.phase === 2) {
      if (o.tick >= 2) {
        o.tick = 0;
        if (Math.random() < 0.2) this.attack('magda');
      }
    }
  }

  /* ---------- Koniec nocy ---------- */

  attack(n) {
    if (this.over || this.jump || this.dead) return;
    this.over = true;
    this.cam = false;
    this.camAnim = 0;
    this.ui.camUi.hidden = true;
    this.ui.mute.hidden = true;
    this.ui.hud.hidden = true;
    const s = this.sound;
    s.stopAll(0.05);
    // jumpscare trwa tyle, ile dźwięk danej postaci (cały, bez ucinania)
    const clip = `js-${n}`;
    const dur = Math.max(2.2, (s.duration(clip) || 3) + 0.15);
    this.jumpClip = s.play(clip, { loud: true, gain: 0.92 });
    const meta = this.meta[`j-${n}`];
    const frames = meta.frames;
    const figs = frames.filter((f) => f[4] === 'f').length;
    this.jump = { name: n, t: 0, dur, frames, figs, sheet: this.img.get(`j-${n}`) };
    this.setNoise(0);
  }

  win() {
    this.over = true;
    this.cam = false;
    this.ui.camUi.hidden = true;
    this.ui.mute.hidden = true;
    this.sound.stopAll(0.3);
    this.finish('win');
  }

  finish(result, who) {
    if (this.ended) return;
    this.ended = true;
    if (this.jumpClip) this.jumpClip.stop(0.6);
    this.onEnd(result, who);
  }

  /* ---------- HUD ---------- */

  updateHud(force) {
    const ui = this.ui;
    const t = this.hour === 0 ? '12 AM' : `${this.hour} AM`;
    if (t !== this.hud.time || force) ui.time.textContent = this.hud.time = t;
    const p = Math.max(0, Math.floor(this.power));
    if (p !== this.hud.power || force) ui.power.textContent = this.hud.power = p;
    const u = this.usage();
    if (u !== this.hud.usage || force) {
      this.hud.usage = u;
      ui.usage.querySelectorAll('i').forEach((el, i) => el.classList.toggle('on', i < u));
    }
    const playing = !this.over && !this.out;
    ui.powerBox.hidden = Boolean(this.out); // bez prądu nie ma też wskaźnika
    const showButtons = playing && this.camAnim === 0;
    ui.camBar.hidden = !playing;
    ui.doorBtns.hidden = !showButtons;
    if (showButtons) this.placeButtons();
    const pressed = `${this.door.L}${this.door.R}${this.light.L}${this.light.R}${this.okno}`;
    if (pressed !== this.hud.pressed || force) {
      this.hud.pressed = pressed;
      ui.doorL.setAttribute('aria-pressed', String(this.door.L));
      ui.doorR.setAttribute('aria-pressed', String(this.door.R));
      ui.lightL.setAttribute('aria-pressed', String(this.light.L));
      ui.lightR.setAttribute('aria-pressed', String(this.light.R));
      ui.win.setAttribute('aria-pressed', String(this.okno));
    }
  }

  // Przezroczyste przyciski leżą dokładnie na przyciskach narysowanych w biurze.
  placeButtons() {
    const { S, ox, oy } = this.view();
    const put = (el, [x0, y0, x1, y1]) => {
      const w = Math.max(40, (x1 - x0) * S);
      const h = Math.max(40, (y1 - y0) * S);
      const cx = ox + ((x0 + x1) / 2) * S;
      const cy = oy + ((y0 + y1) / 2) * S;
      el.style.transform = `translate(${Math.round(cx - w / 2)}px, ${Math.round(cy - h / 2)}px)`;
      el.style.width = `${Math.round(w)}px`;
      el.style.height = `${Math.round(h)}px`;
    };
    put(this.ui.doorL, SIDE.L.door);
    put(this.ui.lightL, SIDE.L.light);
    put(this.ui.doorR, SIDE.R.door);
    put(this.ui.lightR, SIDE.R.light);
    put(this.ui.win, WIN.btn);
  }

  /* ---------- Rysowanie ---------- */

  render() {
    const ctx = this.ctx;
    const { W, H } = this;
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (this.jump) {
      this.renderJump();
      return;
    }
    if (this.camAnim === 1 && this.cam) {
      this.renderCam();
      this.setNoise(Math.min(1, 0.08 + this.camStatic));
    } else {
      this.renderOffice();
      this.setNoise(0);
      if (this.camAnim > 0) {
        // tablet podnosi się z dołu ekranu
        const k = this.camAnim;
        const top = H * (1 - k);
        ctx.fillStyle = '#0d0f0e';
        ctx.fillRect(W * 0.03 * (1 - k), top, W * (1 - 0.06 * (1 - k)), H - top + 2);
        ctx.strokeStyle = 'rgba(160,170,160,.35)';
        ctx.lineWidth = 3;
        ctx.strokeRect(W * 0.03 * (1 - k) + 6, top + 6, W * (1 - 0.06 * (1 - k)) - 12, H - top);
      }
    }
    if (this.halluc > 0) this.renderHalluc();
  }

  renderOffice() {
    const ctx = this.ctx;
    const { W, H } = this;
    const { S, ox, oy } = this.view();
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(this.img.get('biuro'), ox, oy, OW * S, OH * S);
    this.renderWindow(S, ox, oy);
    for (const side of ['L', 'R']) {
      this.renderDoorway(side, S, ox, oy);
      this.renderShutter(side, S, ox, oy);
      if (!this.out) this.renderButtons(side, S, ox, oy);
    }
    if (this.out) {
      ctx.fillStyle = 'rgba(0,0,0,.9)';
      ctx.fillRect(0, 0, W, H);
      if (this.out.phase === 1 && Math.random() < 0.6) this.renderOutFace(S, ox, oy);
    } else if (this.flicker > 0.01) {
      ctx.fillStyle = `rgba(0,0,0,${this.flicker})`;
      ctx.fillRect(0, 0, W, H);
    }
    this.renderVignette();
  }

  polyPath(poly, S, ox, oy) {
    const ctx = this.ctx;
    ctx.beginPath();
    poly.forEach(([x, y], i) => (i ? ctx.lineTo(ox + x * S, oy + y * S) : ctx.moveTo(ox + x * S, oy + y * S)));
    ctx.closePath();
  }

  bbox(poly) {
    const xs = poly.map((p) => p[0]);
    const ys = poly.map((p) => p[1]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  }

  // Zapalone światło: w drzwiach widać korytarz (i tego, kto w nim stoi).
  renderDoorway(side, S, ox, oy) {
    if (!this.light[side]) return;
    const ctx = this.ctx;
    const d = SIDE[side];
    const [x0, y0, x1, y1] = this.bbox(d.poly);
    const bx = ox + x0 * S;
    const by = oy + y0 * S;
    const bw = (x1 - x0) * S;
    const bh = (y1 - y0) * S;
    ctx.save();
    this.polyPath(d.poly, S, ox, oy);
    ctx.clip();
    const img = this.img.get(d.corridor);
    const s = (bh * 1.02) / img.height;
    const iw = img.width * s;
    ctx.globalAlpha = 0.86 + Math.random() * 0.14;
    ctx.drawImage(img, bx + bw / 2 - d.cx * iw, by - bh * 0.01, iw, img.height * s);
    ctx.globalAlpha = 1;
    const who = side === 'L' ? 'mateusz' : 'michel';
    const c = this.ch[who];
    if (c.loc === (side === 'L' ? 'DL' : 'DR')) {
      const fig = this.art.lit[who + (c.pose || 1)];
      const fh = bh * 0.86;
      const fw = (fig.width * fh) / fig.height;
      const footY = oy + d.foot * S;
      ctx.drawImage(fig, bx + bw / 2 - fw / 2, footY - fh, fw, fh);
    }
    // Makłowicz biegnie korytarzem prosto na lewe drzwi
    const r = this.ch.robert;
    if (side === 'L' && r.stage === 3 && r.route === 'L' && r.dash >= RUN_CAM) {
      const t = clamp((r.dash - RUN_CAM) / (DASH_L - RUN_CAM), 0, 1);
      const e = t * t;
      const footY = oy + d.foot * S;
      const farY = by + bh * 0.6;
      this.drawRun(r.dash, true, bx + bw / 2, farY + (footY - farY) * e, bh * (0.32 + 0.62 * e));
    }
    // brzegi drzwi giną w cieniu
    const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    g.addColorStop(0, 'rgba(0,0,0,.55)');
    g.addColorStop(0.25, 'rgba(0,0,0,0)');
    g.addColorStop(0.75, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,.55)');
    ctx.fillStyle = g;
    ctx.fillRect(bx, by, bw, bh);
    ctx.restore();
  }

  // Okno: przez szybę widać biegnącego Makłowicza; zamknięte zasłania roleta, a przycisk nad nim świeci na czerwono.
  renderWindow(S, ox, oy) {
    const ctx = this.ctx;
    const r = this.ch.robert;
    const [x0, y0, x1, y1] = this.bbox(WIN.glass);
    if (r.stage === 3 && r.route === 'W' && r.dash >= 0 && !this.out) {
      const t = clamp(r.dash / DASH_W, 0, 1);
      const e = t * t;
      const [fy0, h0] = WIN.run.from;
      const [fy1, h1] = WIN.run.to;
      ctx.save();
      this.polyPath(WIN.glass, S, ox, oy);
      ctx.clip();
      this.drawRun(r.dash, false, ox + WIN.run.x * S, oy + (fy0 + (fy1 - fy0) * e) * S, (h0 + (h1 - h0) * e) * S, 0.92);
      ctx.restore();
    }
    const k = this.oknoAnim;
    if (k > 0) {
      const tex = this.art.shutterWin;
      const vis = tex.height * k;
      ctx.save();
      this.polyPath(WIN.glass, S, ox, oy);
      ctx.clip();
      ctx.drawImage(tex, 0, tex.height - vis, tex.width, vis, ox + x0 * S, oy + y0 * S, (x1 - x0) * S, (y1 - y0) * S * k);
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ctx.fillRect(ox + x0 * S, oy + y0 * S, (x1 - x0) * S, (y1 - y0) * S * k);
      ctx.restore();
    }
    if (this.okno && !this.out) {
      const b = WIN.btn;
      const cx = ox + ((b[0] + b[2]) / 2) * S;
      const cy = oy + ((b[1] + b[3]) / 2) * S;
      const rad = (b[3] - b[1]) * S * 1.1;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      g.addColorStop(0, 'rgba(255,40,30,.8)');
      g.addColorStop(1, 'rgba(255,40,30,0)');
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = g;
      ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
      ctx.restore();
    }
  }

  // Roleta w drzwiach: rysowana pionowymi paskami z perspektywą (bliższa krawędź otworu jest wyższa),
  // zjeżdża z góry; dalsza krawędź i góra są ciemniejsze.
  renderShutter(side, S, ox, oy) {
    const k = this.doorAnim[side];
    if (k <= 0) return;
    const ctx = this.ctx;
    const [TL, TR, BR, BL] = SIDE[side].shut;
    const hL = BL[1] - TL[1];
    const hR = BR[1] - TR[1];
    const at = (t) => {
      const a = (1 - t) / hL;
      const b = t / hR;
      const w = a + b;
      return [(TL[0] * a + TR[0] * b) / w, (TL[1] * a + TR[1] * b) / w, (BL[1] * a + BR[1] * b) / w];
    };
    const tex = this.art.shutter;
    const n = Math.max(24, Math.ceil((Math.abs(TR[0] - TL[0]) * S) / 3));
    const near = hL > hR ? 0 : 1; // bliższa krawędź jest wyższa
    ctx.save();
    this.polyPath(SIDE[side].shut, S, ox, oy);
    ctx.clip();
    let prev = at(0);
    for (let i = 0; i < n; i++) {
      const t0 = i / n;
      const t1 = (i + 1) / n;
      const cur = at(t1);
      // pasek jako równoległobok: góra pochylona dokładnie jak lamele, więc linie są gładkie, bez schodków
      const x0 = ox + prev[0] * S;
      const x1 = ox + cur[0] * S;
      const y0 = oy + prev[1] * S;
      const y1 = oy + cur[1] * S;
      const h = ((prev[2] - prev[1] + cur[2] - cur[1]) / 2) * S * k;
      const sx = t0 * tex.width;
      const sw = (t1 - t0) * tex.width;
      const sh = tex.height * k;
      ctx.save();
      ctx.transform((x1 - x0 + (x1 > x0 ? 0.6 : -0.6)) / sw, (y1 - y0) / sw, 0, h / sh, x0, y0);
      ctx.drawImage(tex, sx, tex.height - sh, sw, sh, 0, 0, sw, sh);
      const far = Math.abs(t0 - near);
      ctx.fillStyle = `rgba(0,0,0,${0.18 + 0.42 * far})`;
      ctx.fillRect(0, 0, sw, sh);
      ctx.restore();
      prev = cur;
    }
    // ciepłe światło lampy z sufitu (cień u góry jest w samej teksturze, więc idzie z perspektywą)
    const P = (p) => [ox + p[0] * S, oy + p[1] * S];
    const q = [P(TL), P(TR), P([BR[0], TR[1] + (BR[1] - TR[1]) * k]), P([BL[0], TL[1] + (BL[1] - TL[1]) * k])];
    ctx.beginPath();
    q.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.closePath();
    ctx.clip();
    const yTop = Math.min(q[0][1], q[1][1]);
    const yBot = Math.max(q[2][1], q[3][1]);
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = 'rgba(255,160,80,.28)';
    ctx.fillRect(Math.min(q[0][0], q[3][0]) - 2, yTop, Math.abs(q[1][0] - q[0][0]) + 4, yBot - yTop);
    ctx.restore();
  }

  renderButtons(side, S, ox, oy) {
    const ctx = this.ctx;
    const d = SIDE[side];
    const glow = (r, color, a) => {
      const cx = ox + ((r[0] + r[2]) / 2) * S;
      const cy = oy + ((r[1] + r[3]) / 2) * S;
      const rad = (r[3] - r[1]) * S * 0.9;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      g.addColorStop(0, `rgba(${color},${a})`);
      g.addColorStop(1, `rgba(${color},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
      ctx.fillStyle = `rgba(${color},${a * 0.45})`;
      ctx.fillRect(ox + r[0] * S + 4 * S, oy + r[1] * S + 4 * S, (r[2] - r[0] - 8) * S, (r[3] - r[1] - 8) * S);
    };
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (this.door[side]) glow(d.door, '255,40,30', 0.75);
    if (this.light[side]) glow(d.light, '255,250,235', 0.7);
    ctx.restore();
    if (this.broken[side]) {
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      ctx.fillRect(ox + d.door[0] * S, oy + d.door[1] * S, (d.door[2] - d.door[0]) * S, (d.light[3] - d.door[1]) * S);
    }
  }

  // Bez prądu: w lewych drzwiach miga twarz Magdy.
  renderOutFace(S, ox, oy) {
    const ctx = this.ctx;
    const d = SIDE.L;
    const [x0, y0, x1, y1] = this.bbox(d.poly);
    const bx = ox + x0 * S;
    const bw = (x1 - x0) * S;
    const bh = (y1 - y0) * S;
    const fig = this.art.lit.magda1;
    const fh = bh * 0.9;
    const fw = (fig.width * fh) / fig.height;
    ctx.save();
    this.polyPath(d.poly, S, ox, oy);
    ctx.clip();
    ctx.globalAlpha = 0.5 + Math.random() * 0.35;
    ctx.drawImage(fig, bx + bw / 2 - fw / 2, oy + d.foot * S - fh, fw, fh);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  renderVignette() {
    const { W, H } = this;
    if (!this.vignette) {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 144;
      const x = c.getContext('2d');
      const g = x.createRadialGradient(128, 72, 30, 128, 72, 150);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,.6)');
      x.fillStyle = g;
      x.fillRect(0, 0, 256, 144);
      this.vignette = c;
    }
    this.ctx.drawImage(this.vignette, 0, 0, W, H);
  }

  /* ----- kamery ----- */

  renderCam() {
    const ctx = this.ctx;
    const { W, H } = this;
    const cam = CAM[this.camId];
    const img = this.img.get(cam.img);
    // Widać prawie całą wysokość pokoju (żeby postacie miały głowy), a obraz lekko się przesuwa.
    const cover = Math.max(W / img.width, H / img.height);
    const s = Math.min(cover, H / (img.height * 0.86)) * 1.04;
    const dw = img.width * s;
    const dh = img.height * s;
    // obraz powoli przesuwa się w lewo i w prawo, z przerwami na końcach (jak w oryginale)
    const p = this.camT % 20;
    const ease = (u) => 0.5 - Math.cos(Math.PI * u) / 2;
    const k = p < 2 ? 0 : p < 10 ? ease((p - 2) / 8) : p < 12 ? 1 : 1 - ease((p - 12) / 8);
    const x0 = dw > W ? -(dw - W) * k : (W - dw) / 2;
    const y0 = (H - dh) / 2;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    if (this.camStatic > 0.9) return; // sam szum
    if (dw < W) {
      // po bokach przyciemniony, rozciągnięty obraz zamiast czarnych pasów
      const cw = img.width * cover;
      const ch = img.height * cover;
      ctx.drawImage(img, (W - cw) / 2, (H - ch) / 2, cw, ch);
      ctx.fillStyle = 'rgba(0,0,0,.72)';
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(img, x0, y0, dw, dh);
      const fade = (from, to) => {
        const gr = ctx.createLinearGradient(from, 0, to, 0);
        gr.addColorStop(0, 'rgba(0,0,0,.72)');
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gr;
        ctx.fillRect(Math.min(from, to), 0, Math.abs(to - from), H);
      };
      fade(x0, x0 + 40);
      fade(x0 + dw, x0 + dw - 40);
    } else {
      ctx.drawImage(img, x0, y0, dw, dh);
    }
    this.renderRoom(cam.id, x0, y0, dw, dh);
    // zielonkawy, przygaszony obraz z monitoringu
    ctx.fillStyle = 'rgba(10,30,22,.18)';
    ctx.fillRect(0, 0, W, H);
    this.renderVignette();
  }

  fig(canvas, x, y, h, alpha = 1) {
    const ctx = this.ctx;
    const w = (canvas.width * h) / canvas.height;
    ctx.fillStyle = `rgba(0,0,0,${0.35 * alpha})`;
    ctx.beginPath();
    ctx.ellipse(x, y, w * 0.32, h * 0.025, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = alpha;
    ctx.drawImage(canvas, x - w / 2, y - h, w, h);
    ctx.globalAlpha = 1;
  }

  renderRoom(id, x0, y0, dw, dh) {
    const ctx = this.ctx;
    if (id === '1C') return this.renderMaklo(x0, y0, dw, dh);
    const here = ['magda', 'mateusz', 'michel']
      .filter((n) => this.ch[n].loc === id && SPOTS[id])
      .map((n) => ({ n, c: this.ch[n], sp: SPOTS[id][this.ch[n].spot] || SPOTS[id][0] }))
      .sort((a, b) => a.sp[1] - b.sp[1]);
    for (const { n, c, sp } of here) this.fig(this.art.cam[n + (c.pose || 1)], x0 + sp[0] * dw, y0 + sp[1] * dh, sp[2] * dh);
    // Makłowicz biegnie korytarzem
    const r = this.ch.robert;
    if (id === '2A' && r.stage === 3 && r.route === 'L' && r.dash >= 0 && r.dash < RUN_CAM) {
      const t = clamp(r.dash / RUN_CAM, 0, 1);
      const e = t * t;
      const sp = RUN_FROM.map((v, i) => v + (RUN_TO[i] - v) * e);
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ctx.beginPath();
      ctx.ellipse(x0 + sp[0] * dw, y0 + sp[1] * dh, sp[2] * dh * 0.14, sp[2] * dh * 0.025, 0, 0, Math.PI * 2);
      ctx.fill();
      this.drawRun(r.dash, false, x0 + sp[0] * dw, y0 + sp[1] * dh, sp[2] * dh);
    }
  }

  renderMaklo(x0, y0, dw, dh) {
    const ctx = this.ctx;
    const r = this.ch.robert;
    if (r.stage === 1) {
      // wygląda przez szparę w kurtynie
      ctx.save();
      ctx.beginPath();
      ctx.rect(x0 + 0.598 * dw, y0, 0.05 * dw, 0.485 * dh);
      ctx.clip();
      ctx.fillStyle = 'rgba(0,0,0,.4)';
      ctx.fillRect(x0 + 0.598 * dw, y0, 0.05 * dw, 0.485 * dh);
      this.fig(this.art.cam.robert1, x0 + 0.623 * dw, y0 + 0.52 * dh, 0.39 * dh, 0.8);
      ctx.restore();
    } else if (r.stage === 2) {
      this.fig(this.art.cam.robert2, x0 + 0.62 * dw, y0 + 0.535 * dh, 0.4 * dh);
    } else if (r.stage === 3) {
      // pusta scena i kartka
      const w = 0.13 * dw;
      const h = 0.085 * dh;
      const cx = x0 + 0.62 * dw;
      const top = y0 + 0.43 * dh;
      ctx.fillStyle = '#2a1d10';
      ctx.fillRect(cx - w * 0.3, top + h, w * 0.05, 0.07 * dh);
      ctx.fillRect(cx + w * 0.25, top + h, w * 0.05, 0.07 * dh);
      ctx.fillStyle = '#9c8f74';
      ctx.fillRect(cx - w / 2, top, w, h);
      ctx.fillStyle = '#2b1a12';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `800 ${Math.round(h * 0.28)}px "JetBrains Mono", monospace`;
      ctx.fillText('PRZEPRASZAMY!', cx, top + h * 0.33);
      ctx.fillText('NIECZYNNE', cx, top + h * 0.7);
      ctx.fillStyle = 'rgba(30,18,8,.35)';
      ctx.fillRect(cx - w / 2, top, w, h);
    }
  }

  /* ----- jumpscare ----- */

  renderJump() {
    const ctx = this.ctx;
    const { W, H } = this;
    const j = this.jump;
    const { S, ox, oy } = this.view();
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(this.img.get('biuro'), ox, oy, OW * S, OH * S);
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.fillRect(0, 0, W, H);
    const fr = j.frames;
    // najpierw po kolei wszystkie klatki, potem ostatnie zbliżenia w kółko
    const durOf = (f) => (f[4] === 'f' ? 0.07 : 0.085);
    let t = j.t;
    let k = -1;
    let looping = false;
    for (let i = 0; i < fr.length; i++) {
      if (t < durOf(fr[i])) {
        k = i;
        break;
      }
      t -= durOf(fr[i]);
    }
    if (k < 0) {
      looping = true;
      const tail = Math.min(3, fr.length);
      const step = Math.floor((j.t - fr.reduce((a, f) => a + durOf(f), 0)) / 0.06);
      k = fr.length - tail + (step % tail);
    }
    const [sx, sy, sw, sh, kind] = fr[k];
    const shake = looping ? 0.035 : 0.02;
    const jx = (Math.random() - 0.5) * W * shake;
    const jy = (Math.random() - 0.5) * H * shake;
    if (kind === 'f') {
      const idx = fr.slice(0, k + 1).filter((f) => f[4] === 'f').length - 1;
      const grow = j.figs > 1 ? idx / (j.figs - 1) : 1;
      const h = H * (0.9 + 0.4 * grow);
      const w = (sw * h) / sh;
      ctx.drawImage(j.sheet, sx, sy, sw, sh, W / 2 - w / 2 + jx, H * 1.04 - h + jy, w, h);
    } else {
      const s = Math.max(W / sw, H / sh) * (1.04 + Math.random() * 0.03);
      const w = sw * s;
      const h = sh * s;
      ctx.drawImage(j.sheet, sx, sy, sw, sh, (W - w) / 2 + jx, (H - h) / 2 + jy, w, h);
    }
    if (Math.random() < 0.15) {
      ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.2)' : 'rgba(150,0,0,.25)';
      ctx.fillRect(0, 0, W, H);
    }
  }

  renderHalluc() {
    const ctx = this.ctx;
    const { W, H } = this;
    const im = this.img.get(Math.random() < 0.5 ? 'menu-1' : 'menu-2');
    if (im && Math.random() < 0.7) {
      const s = Math.max(W / im.width, H / im.height);
      ctx.globalAlpha = 0.55;
      ctx.drawImage(im, (W - im.width * s) / 2, (H - im.height * s) / 2, im.width * s, im.height * s);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.font = `800 ${Math.round(H * 0.12)}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TO JA', W / 2 + (Math.random() - 0.5) * 20, H / 2 + (Math.random() - 0.5) * 20);
  }
}
