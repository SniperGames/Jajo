/* Jajo: logika gry „Pip wraca do domu” (bez rysowania): etapy, przeszkody, skok i zderzenia. Działa też w Node (automat sprawdza, czy każdy etap da się przejść). */

export const W = 960;
export const H = 540;
export const GROUND = 430; // górna krawędź ziemi
export const PIP_X = 230; // stałe miejsce Pipa na ekranie
export const PIP_W = 28;
export const PIP_H = 30;
export const GRAVITY = 2300;
export const JUMP = 790; // prędkość skoku (px/s)
export const FLAP = 640; // drugie machnięcie skrzydełkami w powietrzu
const COYOTE = 0.09; // chwila na skok tuż po zejściu z krawędzi
const BUFFER = 0.13; // skok wciśnięty tuż przed lądowaniem też się liczy

/**
 * Etapy: coraz ciemniej i coraz dziwniej. glitch = [na początku, na końcu] (0–1).
 * kinds: jakie przeszkody mogą się pojawić. len: długość w pikselach.
 */
export const STAGES = [
  { name: 'Podwórko', theme: 'dzien', speed: 300, len: 8600, seed: 11, glitch: [0, 0.06], kinds: { low: 5, pit: 3, double: 1 } },
  { name: 'Łąka o zmierzchu', theme: 'zmierzch', speed: 315, len: 9200, seed: 23, glitch: [0.1, 0.26], kinds: { low: 4, pit: 3, tall: 2, double: 2 } },
  { name: 'Las', theme: 'las', speed: 325, len: 9800, seed: 37, glitch: [0.3, 0.5], kinds: { low: 3, pit: 3, tall: 2, high: 2, highLow: 1, double: 1 } },
  { name: 'Kuchnia', theme: 'kuchnia', speed: 330, len: 9800, seed: 41, glitch: [0.5, 0.72], kinds: { low: 3, pit: 1, tall: 3, high: 3, highLow: 2, double: 1 } },
  { name: 'Sala', theme: 'sala', speed: 290, len: 8400, seed: 5, glitch: [0.74, 1], kinds: { low: 3, tall: 2, high: 3, highLow: 2 } },
];

// Powtarzalny generator liczb losowych (ten sam etap zawsze wygląda tak samo).
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(r, weights) {
  const entries = Object.entries(weights);
  let total = entries.reduce((a, [, w]) => a + w, 0) * r();
  for (const [k, w] of entries) {
    total -= w;
    if (total <= 0) return k;
  }
  return entries[0][0];
}

/**
 * Buduje etap: przeszkody (low, tall, high), dziury w ziemi (pits), ziarenka, punkt kontrolny i metę.
 * Odstępy wynikają z długości skoku, więc każdą przeszkodę da się przeskoczyć albo przejść pod nią.
 */
export function buildStage(i) {
  const st = STAGES[i];
  const r = rng(st.seed * 7919 + i);
  const between = (a, b) => a + r() * (b - a);
  const obstacles = [];
  const pits = [];
  const grains = [];
  const checkpoint = Math.round(st.len / 2);
  const air = (2 * JUMP) / GRAVITY; // czas w powietrzu przy zwykłym skoku
  const reach = air * st.speed; // długość skoku w pikselach
  const hard = i / (STAGES.length - 1); // 0 na pierwszym etapie, 1 na ostatnim
  const gap = () => between(reach * (1.25 - hard * 0.12), reach * (2.1 - hard * 0.35));
  let x = 1000;
  let n = 0;
  const arc = (from, width) => {
    // ziarenka wzdłuż łuku skoku nad przeszkodą
    for (let k = 0; k < 3; k++) grains.push({ x: from + width / 2 + (k - 1) * 34, y: GROUND - 118 + Math.abs(k - 1) * 18 });
  };
  while (x < st.len - 700) {
    if (Math.abs(x - checkpoint) < 260) {
      x = checkpoint + 300;
      continue;
    }
    const kind = pick(r, st.kinds);
    const v = n++;
    if (kind === 'low') {
      const w = Math.round(between(34, 58));
      const h = Math.round(between(28, 48 + hard * 6));
      obstacles.push({ kind, x, w, h, v });
      arc(x, w);
      x += w + gap();
    } else if (kind === 'tall') {
      x += 100; // dłuższy rozbieg przed wysoką przeszkodą
      const w = Math.round(between(34, 42));
      const h = Math.round(between(72, 86));
      obstacles.push({ kind, x, w, h, v });
      x += w + gap() * 1.1;
    } else if (kind === 'pit') {
      const w = Math.round(between(78, Math.min(150, reach * 0.62)));
      pits.push({ x, w, v });
      arc(x, w);
      x += w + gap();
    } else if (kind === 'high') {
      // coś wisi nisko: trzeba przejść pod spodem, a nie skakać
      const w = Math.round(between(46, 72));
      const clear = Math.round(between(56, 64));
      obstacles.push({ kind, x, w, h: clear, v });
      for (let k = 0; k < 2; k++) grains.push({ x: x + w / 2 + (k - 0.5) * 26, y: GROUND - 14 });
      x += w + between(170, 240);
    } else if (kind === 'highLow') {
      const w = Math.round(between(46, 64));
      const clear = Math.round(between(56, 62));
      obstacles.push({ kind: 'high', x, w, h: clear, v });
      const lx = x + w + Math.round(between(150, 190));
      const lw = Math.round(between(32, 44));
      obstacles.push({ kind: 'low', x: lx, w: lw, h: Math.round(between(28, 40)), v: v + 1 });
      x = lx + lw + gap();
    } else if (kind === 'double') {
      // dwie niskie przeszkody w rytmie: skok, lądowanie, skok
      const w1 = Math.round(between(32, 44));
      const w2 = Math.round(between(32, 44));
      obstacles.push({ kind: 'low', x, w: w1, h: Math.round(between(28, 40)), v });
      const x2 = x + w1 + Math.round(reach * between(1.05, 1.25));
      obstacles.push({ kind: 'low', x: x2, w: w2, h: Math.round(between(28, 40)), v: v + 1 });
      x = x2 + w2 + gap();
    }
  }
  // ziarenka na prostych odcinkach
  for (let gx = 600; gx < st.len - 400; gx += 520) {
    const free = !obstacles.some((o) => gx > o.x - 60 && gx < o.x + o.w + 60) && !pits.some((p) => gx > p.x - 60 && gx < p.x + p.w + 60);
    if (free) grains.push({ x: gx, y: GROUND - 16 });
  }
  return { obstacles, pits, grains, checkpoint, end: st.len };
}

/** Jeden przebieg etapu: Pip biegnie sam, gracz tylko skacze. */
export class Run {
  constructor(i, fromCheckpoint = false) {
    this.i = i;
    this.stage = STAGES[i];
    this.level = buildStage(i);
    this.x = fromCheckpoint ? this.level.checkpoint : 0; // pozycja Pipa w świecie
    this.y = GROUND; // stopy Pipa
    this.vy = 0;
    this.onGround = true;
    this.flapped = false;
    this.jumped = false;
    this.offGround = 0; // ile sekund od zejścia z ziemi
    this.buffer = 0;
    this.falling = false;
    this.dead = false;
    this.done = false;
    this.t = 0;
    this.got = new Set();
    this.checkpointHit = fromCheckpoint;
    this.level.grains.forEach((g, k) => {
      if (fromCheckpoint && g.x < this.x) this.got.add(k);
    });
  }

  /** Stuknięcie: skok z ziemi albo machnięcie skrzydłami w powietrzu. */
  press() {
    this.buffer = BUFFER;
  }

  get progress() {
    return Math.min(1, this.x / this.level.end);
  }

  get glitch() {
    const [a, b] = this.stage.glitch;
    return a + (b - a) * this.progress;
  }

  overPit(x = this.x) {
    return this.level.pits.some((p) => x > p.x + 6 && x < p.x + p.w - 6);
  }

  hit() {
    const left = this.x - PIP_W / 2 + 3;
    const right = this.x + PIP_W / 2 - 3;
    const top = this.y - PIP_H + 4;
    const bottom = this.y - 2;
    for (const o of this.level.obstacles) {
      if (o.x > right + 2 || o.x + o.w < left - 2) continue;
      const oTop = o.kind === 'high' ? -1000 : GROUND - o.h + 3;
      const oBottom = o.kind === 'high' ? GROUND - o.h : GROUND;
      if (right > o.x + 3 && left < o.x + o.w - 3 && bottom > oTop && top < oBottom) return o;
    }
    return null;
  }

  /** Krok fizyki. Zwraca listę zdarzeń: jump, flap, land, grain, checkpoint, dead, done. */
  step(dt) {
    const ev = [];
    if (this.dead || this.done) return ev;
    this.t += dt;
    this.x += this.stage.speed * dt;
    if (this.buffer > 0) {
      const coyote = !this.onGround && !this.jumped && this.offGround < COYOTE && this.y <= GROUND + 4;
      if (this.onGround || coyote) {
        this.vy = -JUMP;
        this.onGround = false;
        this.jumped = true;
        this.buffer = 0;
        ev.push('jump');
      } else if (!this.flapped && this.y < GROUND) {
        this.vy = -FLAP;
        this.flapped = true;
        this.jumped = true;
        this.buffer = 0;
        ev.push('flap');
      } else {
        this.buffer -= dt;
      }
    }
    const pit = this.overPit();
    if (this.onGround && pit) {
      // zszedł z krawędzi prosto nad dziurę
      this.onGround = false;
      this.offGround = 0;
      this.vy = 0;
    }
    if (this.onGround) {
      this.y = GROUND;
      this.vy = 0;
    } else {
      const prevY = this.y;
      this.offGround += dt;
      this.vy += GRAVITY * dt;
      this.y += this.vy * dt;
      if (this.y >= GROUND) {
        if (pit) {
          this.falling = this.y > GROUND + 4;
        } else if (prevY <= GROUND + 1) {
          this.y = GROUND;
          this.vy = 0;
          this.onGround = true;
          this.flapped = false;
          this.jumped = false;
          this.falling = false;
          ev.push('land');
        } else {
          this.falling = true; // uderzył w ścianę dziury
          this.dead = true;
        }
      }
    }
    // ziarenka
    this.level.grains.forEach((g, k) => {
      if (this.got.has(k)) return;
      if (Math.abs(g.x - this.x) < 22 && Math.abs(g.y - (this.y - PIP_H / 2)) < 26) {
        this.got.add(k);
        ev.push('grain');
      }
    });
    if (!this.checkpointHit && this.x >= this.level.checkpoint) {
      this.checkpointHit = true;
      ev.push('checkpoint');
    }
    if (this.dead || this.hit() || this.y > GROUND + 90) {
      this.dead = true;
      ev.push('dead');
    } else if (this.x >= this.level.end) {
      this.done = true;
      ev.push('done');
    }
    return ev;
  }

  /** Kopia stanu (dla automatu, który sprawdza przejście). */
  clone() {
    const c = Object.create(Run.prototype);
    Object.assign(c, this);
    c.got = new Set(this.got);
    return c;
  }
}
