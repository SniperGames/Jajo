/* Jajo: wspólne narzędzia gier (płótno, pętla, dźwięki, rysowanie jajek). */

/**
 * Płótno o stałej logicznej wielkości (w × h), przeskalowane do kontenera i ostre na ekranach Retina.
 * Kontener ma proporcje w:h (CSS aspect-ratio), więc skala jest jedna dla obu osi.
 */
export function makeCanvas(stage, w, h) {
  const canvas = document.createElement('canvas');
  canvas.className = 'game-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  stage.prepend(canvas);
  const ctx = canvas.getContext('2d');
  let scale = 1;
  const resize = () => {
    const r = stage.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    scale = canvas.width / w;
  };
  const ro = new ResizeObserver(resize);
  ro.observe(stage);
  resize();
  return {
    canvas,
    ctx,
    /** Ustawia skalę przed rysowaniem klatki. */
    begin() {
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
    },
    /** Zamienia współrzędne ekranu na współrzędne gry. */
    toLocal(clientX, clientY) {
      const r = canvas.getBoundingClientRect();
      return { x: ((clientX - r.left) / r.width) * w, y: ((clientY - r.top) / r.height) * h };
    },
    destroy() {
      ro.disconnect();
      canvas.remove();
    },
  };
}

/** Pętla gry: step(dt) co klatkę. dt w sekundach, najwyżej 1/20 s (gra zwalnia zamiast przeskakiwać). */
export function loop(step) {
  let raf = 0;
  let last = 0;
  let running = false;
  const frame = (t) => {
    if (!running) return;
    const dt = Math.min(0.05, Math.max(0, (t - last) / 1000));
    last = t;
    step(dt);
    raf = requestAnimationFrame(frame);
  };
  return {
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    get running() {
      return running;
    },
  };
}

/* ---------- Dźwięki ---------- */

let audio = null;
let muted = false;
try {
  muted = localStorage.getItem('jajo:gry:cisza') === '1';
} catch {
  /* pamięć przeglądarki niedostępna */
}

export const isMuted = () => muted;

export function setMuted(value) {
  muted = value;
  try {
    localStorage.setItem('jajo:gry:cisza', value ? '1' : '0');
  } catch {
    /* pamięć przeglądarki niedostępna */
  }
}

function tone(freq, start, length, { type = 'sine', volume = 0.12, slide = 0 } = {}) {
  const o = audio.createOscillator();
  const g = audio.createGain();
  const t = audio.currentTime + start;
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + length);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(volume, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + length);
  o.connect(g).connect(audio.destination);
  o.start(t);
  o.stop(t + length + 0.02);
}

const SOUNDS = {
  catch: () => tone(880, 0, 0.09, { type: 'triangle', slide: 300 }),
  gold: () => [988, 1319, 1760].forEach((f, i) => tone(f, i * 0.06, 0.12, { type: 'triangle', volume: 0.1 })),
  splat: () => tone(160, 0, 0.22, { type: 'sawtooth', volume: 0.07, slide: -100 }),
  bad: () => tone(220, 0, 0.3, { type: 'square', volume: 0.06, slide: -120 }),
  flap: () => tone(520, 0, 0.07, { type: 'triangle', volume: 0.07, slide: 260 }),
  point: () => tone(1046, 0, 0.08, { type: 'sine', volume: 0.09 }),
  flip: () => tone(640, 0, 0.05, { type: 'triangle', volume: 0.06 }),
  match: () => [784, 1046].forEach((f, i) => tone(f, i * 0.07, 0.12, { type: 'triangle', volume: 0.09 })),
  merge: () => tone(440, 0, 0.1, { type: 'triangle', volume: 0.08, slide: 220 }),
  over: () => [523, 392, 262].forEach((f, i) => tone(f, i * 0.14, 0.2, { type: 'triangle', volume: 0.09 })),
  win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.09, 0.18, { type: 'triangle', volume: 0.1 })),
};

/** Włącza dźwięk w chwili dotknięcia „Graj” (iPhone pozwala na to tylko po geście). */
export function unlockAudio() {
  if (muted) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
  } catch {
    /* dźwięk niedostępny */
  }
}

/** Krótki efekt dźwiękowy z syntezatora przeglądarki (bez plików). */
export function sfx(kind) {
  if (muted || !SOUNDS[kind]) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    SOUNDS[kind]();
  } catch {
    /* dźwięk niedostępny */
  }
}

/* ---------- Rysowanie ---------- */

/** Ścieżka jajka o środku (x, y), szerokości w i wysokości h (węższe u góry). */
export function eggPath(ctx, x, y, w, h) {
  const rx = w / 2;
  const top = y - h / 2;
  const bottom = y + h / 2;
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.bezierCurveTo(x + rx * 1.05, top, x + rx * 1.05, y + h * 0.18, x + rx, y + h * 0.2);
  ctx.bezierCurveTo(x + rx * 0.95, bottom, x - rx * 0.95, bottom, x - rx, y + h * 0.2);
  ctx.bezierCurveTo(x - rx * 1.05, y + h * 0.18, x - rx * 1.05, top, x, top);
  ctx.closePath();
}

/** Jajko z cieniem i odblaskiem. */
export function drawEgg(ctx, x, y, w, h, { fill = '#FFF4E2', stroke = '#D9B98C', shine = true, angle = 0 } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  eggPath(ctx, 0, 0, w, h);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, w * 0.06);
  ctx.strokeStyle = stroke;
  ctx.stroke();
  if (shine) {
    ctx.beginPath();
    ctx.ellipse(-w * 0.18, -h * 0.16, w * 0.1, h * 0.17, -0.35, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.fill();
  }
  ctx.restore();
}

export const rand = (a, b) => a + Math.random() * (b - a);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
