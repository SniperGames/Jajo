/* Jajo, „Kury z procy”: świat gry. Fizyka (Planck.js), obrażenia, moce kur i przebieg poziomu.
   Nic tu nie rysuje, więc tę samą logikę można sprawdzać automatycznie poza przeglądarką. */
import { World, Vec2, Circle, Box, Polygon, Edge } from '../lib/planck.min.mjs';

export const STEP = 1 / 60;
export const ANCHOR = { x: 3.2, y: 2.75 }; // miejsce kury w procy (metry)
export const MAX_PULL = 1.9;
export const POWER = 10; // prędkość startu w m/s na metr naciągnięcia
export const VIEW = { x0: -1, y0: -1.5, w: 32, h: 18 };
const GRAVITY = 10;
const SETTLE = 0.6; // przez pierwsze chwile poziom się „układa” i nic się nie psuje
const MIN_HIT = 1.5; // słabsze popchnięcia (np. leżące na sobie klocki) nie robią szkód

export const MATS = {
  lod: { name: 'Lód', density: 0.5, friction: 0.15, restitution: 0.05, hp: 18, mult: 1.6, points: 300 },
  drewno: { name: 'Drewno', density: 0.65, friction: 0.7, restitution: 0.05, hp: 34, mult: 1, points: 500 },
  kamien: { name: 'Kamień', density: 2.2, friction: 0.85, restitution: 0.02, hp: 90, mult: 0.7, points: 800 },
  tnt: { name: 'TNT', density: 0.7, friction: 0.6, restitution: 0.05, hp: 9, mult: 1, points: 500 },
};

export const EGGS = {
  maly: { r: 0.36, hp: 8, points: 5000 },
  zwykly: { r: 0.46, hp: 12, points: 5000 },
  kask: { r: 0.48, hp: 32, points: 5000 },
  krol: { r: 0.8, hp: 75, points: 10000 },
};

export const HENS = {
  kokoszka: {
    name: 'Kokoszka',
    r: 0.45,
    density: 4,
    power: 1,
    desc: 'Zwykła kura, ale bardzo zawzięta. Dobrze radzi sobie z drewnem.',
    vs: { drewno: 1.2 },
  },
  pisklaki: {
    name: 'Pisklaki',
    r: 0.32,
    density: 4,
    power: 1,
    ability: 'split',
    desc: 'Stuknij w locie, a pisklę podzieli się na trzy. Świetnie rozbija lód.',
    vs: { lod: 2.6, drewno: 0.6, kamien: 0.4 },
  },
  rakieta: {
    name: 'Rakieta',
    r: 0.42,
    density: 4,
    power: 1,
    ability: 'dash',
    desc: 'Stuknij w locie, a wystrzeli do przodu jak strzała. Przebija drewno.',
    vs: { drewno: 2.4, lod: 1.2, kamien: 0.5 },
  },
  bomba: {
    name: 'Bomba',
    r: 0.55,
    density: 5,
    power: 1,
    ability: 'boom',
    desc: 'Stuknij, a wybuchnie. Po uderzeniu wybucha też sama. Kruszy nawet kamień.',
    vs: { kamien: 1.3 },
  },
  nioska: {
    name: 'Nioska',
    r: 0.5,
    density: 4,
    power: 1,
    ability: 'egg',
    desc: 'Stuknij nad celem, a zniesie wybuchowe jajko, a sama odleci w górę.',
    vs: {},
  },
  kogut: {
    name: 'Kogut',
    r: 0.78,
    density: 6,
    power: 1,
    desc: 'Wielki i ciężki. Taranuje wszystko, co stanie mu na drodze.',
    vs: { kamien: 1.15, drewno: 1.2 },
  },
};

/** Wierzchołki jajka (wypukły wielokąt, płaski spód, żeby jajko stało). */
export function eggShape(r, n = 10) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = ((i + 0.5) / n) * Math.PI * 2;
    const c = Math.cos(t);
    pts.push({ x: -0.82 * r * Math.sin(t), y: c >= 0 ? 1.15 * r * c : 0.9 * r * c });
  }
  return pts;
}

/** Progi gwiazdek: 1 za przejście, 2 i 3 za punkty. */
export function starsFor(level, score) {
  const [two, three] = level.stars;
  return score >= three ? 3 : score >= two ? 2 : 1;
}

/** Liczy progi gwiazdek dla poziomu z jego zawartości (chyba że poziom ma własne). */
export function withStars(level) {
  if (level.stars) return level;
  let eggs = 0;
  let blocks = 0;
  level.pieces.forEach((p) => {
    if (p.t === 'e') eggs += EGGS[p.k].points;
    else if (p.t === 'b') blocks += MATS[p.m].points;
  });
  const spare = level.hens.length > 1 ? 10000 : 0;
  const two = Math.round((eggs + blocks * 0.25) / 1000) * 1000;
  const three = Math.round((eggs + blocks * 0.5 + spare) / 1000) * 1000;
  return { ...level, stars: [two, Math.max(three, two + 5000)] };
}

const vec = (x, y) => new Vec2(x, y);
const len = (x, y) => Math.sqrt(x * x + y * y);

export class Swiat {
  constructor(level, { onEvent } = {}) {
    this.level = withStars(level);
    this.emit = onEvent || (() => {});
    this.world = new World({ gravity: vec(0, -GRAVITY) });
    this.time = 0;
    this.score = 0;
    this.queue = [...this.level.hens];
    this.state = 'aim'; // aim, fly, wait, won, lost
    this.current = this.queue.shift(); // kura w procy
    this.flying = []; // ciała kur (i jajek-bomb) w locie
    this.main = null; // główna kura w locie
    this.explosions = [];
    this.timer = 0;
    this.calm = 0;
    this.nextId = 1;
    this.trail = [];
    this.lastTrail = [];
    this.build();
    this.world.on('post-solve', (c, imp) => this.onImpulse(c, imp));
    this.world.on('begin-contact', (c) => this.onBegin(c));
  }

  /* ---------- Budowa poziomu ---------- */

  build() {
    const ground = this.world.createBody();
    ground.createFixture(new Edge(vec(-30, 0), vec(80, 0)), { friction: 0.9 });
    ground.setUserData({ kind: 'ground' });
    for (const p of this.level.pieces) {
      if (p.t === 'p') {
        const b = this.world.createBody({ position: vec(p.x, p.y) });
        b.createFixture(new Box(p.w / 2, p.h / 2), { friction: 0.9 });
        b.setUserData({ kind: 'platform', w: p.w, h: p.h, id: this.nextId++ });
      } else if (p.t === 'b') {
        const m = MATS[p.m];
        const b = this.world.createBody({ type: 'dynamic', position: vec(p.x, p.y), angle: p.a || 0, awake: false });
        b.createFixture(new Box(p.w / 2, p.h / 2), { density: m.density, friction: m.friction, restitution: m.restitution });
        b.setUserData({ kind: 'block', mat: p.m, w: p.w, h: p.h, hp: m.hp * Math.max(0.6, Math.min(2, (p.w * p.h) / 0.5)), pending: 0, id: this.nextId++ });
        b.getUserData().max = b.getUserData().hp;
      } else if (p.t === 'e') {
        const e = EGGS[p.k];
        const b = this.world.createBody({ type: 'dynamic', position: vec(p.x, p.y + 0.9 * e.r + 0.01), awake: false });
        b.createFixture(new Polygon(eggShape(e.r).map((q) => vec(q.x, q.y))), { density: 1, friction: 0.6, restitution: 0.1 });
        b.setUserData({ kind: 'egg', egg: p.k, r: e.r, hp: e.hp, max: e.hp, pending: 0, id: this.nextId++ });
      }
    }
    this.eggsTotal = this.eggsLeft();
  }

  /* ---------- Zapytania ---------- */

  bodies() {
    const out = [];
    for (let b = this.world.getBodyList(); b; b = b.getNext()) out.push(b);
    return out;
  }

  eggsLeft() {
    let n = 0;
    for (let b = this.world.getBodyList(); b; b = b.getNext()) {
      const u = b.getUserData();
      if (u && u.kind === 'egg' && !u.dead) n++;
    }
    return n;
  }

  /* ---------- Strzał i moce ---------- */

  /** Wystrzał kury z naciągnięcia (pull: wektor od procy do kury, w metrach). */
  launch(pull) {
    if (this.state !== 'aim' || !this.current) return false;
    const l = len(pull.x, pull.y);
    if (l < 0.3) return false;
    const k = Math.min(1, MAX_PULL / l);
    const px = pull.x * k;
    const py = pull.y * k;
    const type = this.current;
    const h = HENS[type];
    const body = this.spawnHen(type, ANCHOR.x + px, ANCHOR.y + py, -px * POWER, -py * POWER, h.r);
    this.main = body;
    this.current = null;
    this.state = 'fly';
    this.timer = 0;
    this.lastTrail = this.trail;
    this.trail = [];
    this.emit('launch', { type });
    return true;
  }

  spawnHen(type, x, y, vx, vy, r, part = false) {
    const h = HENS[type];
    const body = this.world.createBody({ type: 'dynamic', position: vec(x, y), bullet: true });
    body.createFixture(new Circle(r), { density: h.density, friction: 0.5, restitution: 0.3 });
    body.setLinearVelocity(vec(vx, vy));
    body.setAngularDamping(0.6);
    body.setUserData({ kind: 'hen', type, r, part, born: this.time, hitAt: 0, used: part, slow: 0, done: false, id: this.nextId++ });
    this.flying.push(body);
    return body;
  }

  /** Moc kury (stuknięcie w locie). */
  ability() {
    if (this.state !== 'fly' || !this.main) return false;
    const b = this.main;
    const u = b.getUserData();
    if (!u || u.used || u.done) return false;
    const h = HENS[u.type];
    const p = b.getPosition();
    const v = b.getLinearVelocity();
    if (!h.ability) {
      u.used = true;
      this.emit('cluck', { x: p.x, y: p.y, type: u.type });
      return true;
    }
    // Pisklaki, Rakieta i Nioska działają tylko przed pierwszym uderzeniem, Bomba zawsze.
    if (h.ability !== 'boom' && u.hitAt) return false;
    u.used = true;
    if (h.ability === 'split') {
      const speed = len(v.x, v.y);
      const ang = Math.atan2(v.y, v.x);
      for (const d of [-0.2, 0.2]) {
        const a = ang + d;
        this.spawnHen(u.type, p.x - Math.sin(d) * 0.4, p.y + Math.sin(d) * 0.4, Math.cos(a) * speed, Math.sin(a) * speed, h.r, true);
      }
    } else if (h.ability === 'dash') {
      const speed = Math.max(len(v.x, v.y) * 2.1, 24);
      const l = len(v.x, v.y) || 1;
      b.setLinearVelocity(vec((v.x / l) * speed, (v.y / l) * speed));
      u.dash = this.time;
    } else if (h.ability === 'boom') {
      this.boom(b, 3.4, 32, 64);
    } else if (h.ability === 'egg') {
      const bomb = this.world.createBody({ type: 'dynamic', position: vec(p.x, p.y - h.r - 0.45), bullet: true });
      bomb.createFixture(new Polygon(eggShape(0.3, 8).map((q) => vec(q.x, q.y))), { density: 3, friction: 0.5 });
      bomb.setLinearVelocity(vec(v.x * 0.2, -16));
      bomb.setUserData({ kind: 'bomb', born: this.time, id: this.nextId++, done: false });
      this.flying.push(bomb);
      b.setLinearVelocity(vec(Math.max(v.x, 4) + 3, 15));
      b.setAngularVelocity(6);
    }
    this.emit('ability', { type: u.type, x: p.x, y: p.y, ability: h.ability });
    return true;
  }

  /** Wybuch kury lub jajka-bomby: ciało znika, a wszystko wokół dostaje pchnięcie i obrażenia. */
  boom(body, r, power, dmg) {
    const u = body.getUserData();
    if (!u || u.exploded) return;
    u.exploded = true;
    u.done = true;
    const p = body.getPosition();
    this.explosions.push({ x: p.x, y: p.y, r, power, dmg, stone: u.type === 'bomba' ? 1.6 : 1 });
    this.remove(body);
  }

  /* ---------- Zderzenia i obrażenia ---------- */

  onBegin(contact) {
    const a = contact.getFixtureA().getBody();
    const b = contact.getFixtureB().getBody();
    for (const [x, y] of [[a, b], [b, a]]) {
      const u = x.getUserData();
      if (!u) continue;
      if (u.kind === 'hen' && !u.hitAt) {
        const o = y.getUserData();
        if (o && o.kind === 'hen') continue;
        u.hitAt = this.time;
        this.emit('hit', { type: u.type, x: x.getPosition().x, y: x.getPosition().y });
      } else if (u.kind === 'bomb' && !u.exploded && this.time - u.born > 0.05) {
        u.trigger = true;
      }
    }
  }

  onImpulse(contact, impulse) {
    if (this.time < SETTLE) return;
    const n = contact.getManifold().pointCount;
    let imp = 0;
    for (let i = 0; i < n; i++) imp += impulse.normalImpulses[i] || 0;
    if (imp < MIN_HIT) return;
    const a = contact.getFixtureA().getBody();
    const b = contact.getFixtureB().getBody();
    this.hurt(a, b, imp);
    this.hurt(b, a, imp);
  }

  hurt(body, other, imp) {
    const u = body.getUserData();
    if (!u || (u.kind !== 'block' && u.kind !== 'egg') || u.dead) return;
    let mult = u.kind === 'egg' ? 2.5 : MATS[u.mat].mult;
    const o = other.getUserData();
    if (o && o.kind === 'hen' && u.kind === 'block') mult *= HENS[o.type].vs[u.mat] || 1;
    if (o && o.kind === 'hen' && o.dash && this.time - o.dash < 1.2 && u.kind === 'block') mult *= 1.3;
    u.pending += (imp - MIN_HIT) * mult;
  }

  applyDamage() {
    let guard = 0;
    do {
      for (const b of this.bodies()) {
        const u = b.getUserData();
        if (!u || !u.pending) continue;
        u.hp -= u.pending;
        if (u.pending > 1.5) this.emit('damage', { id: u.id, kind: u.kind, x: b.getPosition().x, y: b.getPosition().y, amount: u.pending });
        u.pending = 0;
        if (u.hp <= 0) this.kill(b);
      }
      const list = this.explosions;
      this.explosions = [];
      list.forEach((e) => this.blast(e));
      guard++;
    } while (this.explosions.length && guard < 10);
  }

  blast({ x, y, r, power, dmg, stone }) {
    this.emit('boom', { x, y, r });
    for (const b of this.bodies()) {
      if (b.isStatic()) continue;
      const u = b.getUserData();
      if (!u || u.dead) continue;
      const c = b.getWorldCenter();
      const dx = c.x - x;
      const dy = c.y - y;
      const d = len(dx, dy);
      const reach = r + (u.r || Math.max(u.w || 0, u.h || 0) / 2 || 0.4);
      if (d > reach) continue;
      const f = Math.max(0, Math.min(1, 1 - d / reach));
      const nx = d > 0.01 ? dx / d : 0;
      const ny = d > 0.01 ? dy / d : 1;
      const push = power * f * (u.kind === 'hen' ? 0.4 : 1);
      b.applyLinearImpulse(vec(nx * push, ny * push + push * 0.25), c, true);
      if (u.kind === 'block' || u.kind === 'egg') {
        const mult = u.kind === 'egg' ? 1.6 : MATS[u.mat].mult * (u.mat === 'kamien' ? stone : 1);
        u.pending += dmg * f * mult;
      }
    }
  }

  /** Zniszczenie klocka lub jajka: punkty, zdarzenie dla grafiki i ewentualny wybuch TNT. */
  kill(body, quiet = false) {
    const u = body.getUserData();
    if (!u || u.dead) return;
    u.dead = true;
    const p = body.getPosition();
    let points = 0;
    if (u.kind === 'egg') {
      points = EGGS[u.egg].points;
      this.emit('egg', { x: p.x, y: p.y, egg: u.egg, angle: body.getAngle() });
    } else if (u.kind === 'block') {
      points = MATS[u.mat].points;
      this.emit('break', { x: p.x, y: p.y, mat: u.mat, w: u.w, h: u.h, angle: body.getAngle() });
      if (u.mat === 'tnt') this.explosions.push({ x: p.x, y: p.y, r: 2.8, power: 26, dmg: 55, stone: 1.1 });
    }
    if (points && !quiet) {
      this.score += points;
      this.emit('points', { x: p.x, y: p.y + 0.4, points, kind: u.kind });
    } else if (points) {
      this.score += points;
    }
    this.remove(body);
  }

  /** Usuwa ciało i budzi wszystko, co na nim leżało (inaczej klocki wisiałyby w powietrzu). */
  remove(body) {
    for (let e = body.getContactList(); e; e = e.next) {
      if (e.other) e.other.setAwake(true);
    }
    const u = body.getUserData();
    if (u) u.dead = true;
    this.flying = this.flying.filter((f) => f !== body);
    if (this.main === body) this.main = null;
    this.world.destroyBody(body);
  }

  /* ---------- Krok gry ---------- */

  step() {
    this.time += STEP;
    this.world.step(STEP, 8, 3);
    // jajka-bomby i opóźniony wybuch Bomby
    for (const b of [...this.flying]) {
      const u = b.getUserData();
      if (!u || u.dead) continue;
      if (u.kind === 'bomb' && u.trigger) this.boom(b, 2.6, 26, 70);
      else if (u.kind === 'hen' && u.type === 'bomba' && u.hitAt && !u.exploded && this.time - u.hitAt > 1.6) this.boom(b, 3.4, 32, 64);
    }
    this.applyDamage();
    this.checkBounds();
    this.updateFlight();
    this.updateState();
  }

  checkBounds() {
    for (const b of this.bodies()) {
      if (b.isStatic()) continue;
      const p = b.getPosition();
      if (p.y > -4 && p.x > -8 && p.x < 42) continue;
      const u = b.getUserData();
      if (u && (u.kind === 'egg' || u.kind === 'block')) this.kill(b);
      else if (u && (u.kind === 'hen' || u.kind === 'bomb')) {
        u.done = true;
        this.remove(b);
      }
    }
  }

  updateFlight() {
    if (this.main && !this.main.getUserData().done) {
      const p = this.main.getPosition();
      if (!this.trail.length || len(p.x - this.trail[this.trail.length - 1].x, p.y - this.trail[this.trail.length - 1].y) > 0.45) {
        this.trail.push({ x: p.x, y: p.y, big: this.time - this.main.getUserData().born < 0.05 });
      }
    }
    for (const b of this.flying) {
      const u = b.getUserData();
      if (!u || u.done) continue;
      const v = b.getLinearVelocity();
      const speed = len(v.x, v.y);
      u.slow = speed < 0.6 ? u.slow + STEP : 0;
      if (u.slow > 0.8 || this.time - u.born > 9) {
        u.done = true;
        if (u.kind === 'bomb') this.boom(b, 2.6, 26, 70);
        else if (u.type === 'bomba' && !u.exploded) this.boom(b, 3.4, 32, 64);
        else this.emit('rest', { x: b.getPosition().x, y: b.getPosition().y, type: u.type });
      }
    }
    // kury, które skończyły lot, po chwili znikają w obłoczku piór
    for (const b of [...this.flying]) {
      const u = b.getUserData();
      if (u && u.done && !u.dead) {
        u.fade = (u.fade || 0) + STEP;
        if (u.fade > 1.4) {
          this.emit('poof', { x: b.getPosition().x, y: b.getPosition().y, type: u.type });
          this.remove(b);
        }
      }
    }
  }

  quiet() {
    for (let b = this.world.getBodyList(); b; b = b.getNext()) {
      if (b.isStatic() || !b.isAwake()) continue;
      const v = b.getLinearVelocity();
      if (len(v.x, v.y) > 0.25 || Math.abs(b.getAngularVelocity()) > 0.4) return false;
    }
    return true;
  }

  updateState() {
    if (this.state === 'won' || this.state === 'lost') return;
    if (this.state === 'winning') {
      this.timer += STEP;
      if (this.timer > 1.4) {
        this.state = 'won';
        const spare = this.queue.length + (this.current ? 1 : 0);
        this.emit('won', { score: this.score, spare, stars: starsFor(this.level, this.score) });
      }
      return;
    }
    if (this.eggsLeft() === 0) {
      // nagroda za każdą niewykorzystaną kurę
      const spare = [...(this.current ? [this.current] : []), ...this.queue];
      spare.forEach((type, i) => {
        this.score += 10000;
        this.emit('bonus', { index: i, type, points: 10000 });
      });
      this.state = 'winning';
      this.timer = 0;
      return;
    }
    if (this.state === 'fly') {
      const active = this.flying.some((b) => {
        const u = b.getUserData();
        return u && !u.done;
      });
      if (!active) {
        this.state = 'wait';
        this.timer = 0;
        this.calm = 0;
      }
    } else if (this.state === 'wait') {
      this.timer += STEP;
      this.calm = this.quiet() ? this.calm + STEP : 0;
      if (this.calm > 0.5 || this.timer > 4) {
        if (this.queue.length) {
          this.current = this.queue.shift();
          this.state = 'aim';
          this.emit('next', { type: this.current });
        } else if (this.timer > 1.5) {
          this.state = 'lost';
          this.emit('lost', { score: this.score, eggs: this.eggsLeft() });
        }
      }
    }
  }
}

/** Punkty toru lotu dla podglądu celowania (bez zderzeń). */
export function preview(pull, steps = 11, dt = 0.055) {
  const l = len(pull.x, pull.y);
  if (l < 0.3) return [];
  const k = Math.min(1, MAX_PULL / l);
  const x0 = ANCHOR.x + pull.x * k;
  const y0 = ANCHOR.y + pull.y * k;
  const vx = -pull.x * k * POWER;
  const vy = -pull.y * k * POWER;
  const out = [];
  for (let i = 1; i <= steps; i++) {
    const t = i * dt * 1.6;
    out.push({ x: x0 + vx * t, y: y0 + vy * t - (GRAVITY / 2) * t * t });
  }
  return out;
}
