/* Jajo, „Kury z procy”: gra w przeglądarce. Łączy świat (fizykę) z rysowaniem i sterowaniem. */
import { makeCanvas, loop, sfx } from '../wspolne.js';
import { Swiat, STEP, ANCHOR, MAX_PULL, HENS, EGGS, preview } from './swiat.js';
import { CHAPTERS } from './poziomy.js';
import {
  W, H, cam, px, py, drawBackground, drawPlatform, drawBlock, drawRottenEgg, drawHen, drawEggBomb,
  drawSlingBack, drawSlingFront, drawParticles, drawPopups,
} from './rysunki.js';

const fmt = (n) => Math.round(n).toLocaleString('pl-PL');
const rnd = (a, b) => a + Math.random() * (b - a);

const PARTS = {
  drewno: ['#C98B4A', '#A86C35', '#E2B07A'],
  lod: ['#BFE6FA', '#E6F6FF', '#8CC8EA'],
  kamien: ['#9AA3A8', '#7D868B', '#B9C0C4'],
  tnt: ['#C0392B', '#7A1E14', '#FFB000'],
};
const HEN_FEATHER = {
  kokoszka: '#D7263D', pisklaki: '#FFD23F', rakieta: '#F4A300', bomba: '#2E3236', nioska: '#FFFDF7', kogut: '#B5532A',
};
const SOUND_GAP = 70; // ms między takimi samymi dźwiękami

export function createGame(stage, cb = {}) {
  const view = makeCanvas(stage, W, H);
  const { ctx, canvas } = view;
  let world = null;
  let level = null;
  let parts = [];
  let pops = [];
  let shake = 0;
  let flash = 0;
  let t = 0;
  let acc = 0;
  let drag = null;
  let kb = null; // celowanie klawiaturą: { a: kąt, p: siła }
  let hop = null; // kura wskakująca do procy
  let shots = 0;
  let paused = false;
  let ended = false;
  let sunEye = -1; // >= 0: słońce ma oko (czas od trafienia)
  const lastSound = {};

  const play = (name) => {
    const now = performance.now();
    if (now - (lastSound[name] || 0) < SOUND_GAP) return;
    lastSound[name] = now;
    sfx(name);
  };

  /* ---------- Zdarzenia świata → efekty ---------- */

  function burst(x, y, colors, n, { speed = 260, size = [3, 7], shape = 'rect', life = [0.5, 1], up = 120, gravity = 900 } = {}) {
    for (let i = 0; i < n; i++) {
      const a = rnd(0, Math.PI * 2);
      const v = rnd(speed * 0.3, speed);
      const l = rnd(life[0], life[1]);
      parts.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - up, g: gravity,
        color: colors[i % colors.length], size: rnd(size[0], size[1]), rot: rnd(0, 6), vr: rnd(-8, 8),
        life: l, max: l, shape,
      });
    }
  }

  function feathers(x, y, type, n = 6) {
    burst(x, y, [HEN_FEATHER[type] || '#fff', '#FFFFFF'], n, { speed: 160, size: [5, 9], shape: 'feather', life: [0.8, 1.4], up: 60, gravity: 120 });
  }

  function onEvent(name, e) {
    const X = e && e.x !== undefined ? px(e.x) : 0;
    const Y = e && e.y !== undefined ? py(e.y) : 0;
    switch (name) {
      case 'launch':
        play('launch');
        feathers(px(ANCHOR.x), py(ANCHOR.y), e.type, 4);
        break;
      case 'break':
        burst(X, Y, PARTS[e.mat], e.mat === 'lod' ? 14 : 10, { size: e.mat === 'kamien' ? [4, 9] : [3, 7] });
        play(e.mat === 'lod' ? 'glass' : e.mat === 'kamien' ? 'stone' : 'wood');
        break;
      case 'egg':
        burst(X, Y, ['#B9C98A', '#86A057', '#FFFDF2'], 14, { size: [3, 8], shape: 'rect' });
        burst(X, Y, ['rgba(160,190,90,.55)'], 6, { speed: 70, size: [10, 18], shape: 'dot', life: [0.6, 1], up: 30, gravity: -40 });
        play('shell');
        break;
      case 'points':
        pops.push({ x: X, y: Y, text: fmt(e.points), color: e.kind === 'egg' ? '#C6F27A' : '#FFFFFF', life: 1.2, size: e.kind === 'egg' ? 30 : 22 });
        cb.onScore && cb.onScore(world.score);
        break;
      case 'boom':
        flash = 0.25;
        shake = Math.max(shake, 0.45);
        parts.push({ x: X, y: Y, size: e.r * cam.s * 0.9, color: 'rgba(255,190,80,.9)', shape: 'ring', life: 0.35, max: 0.35, vx: 0, vy: 0, g: 0 });
        burst(X, Y, ['#FFB000', '#FF6A00', '#FFE08A'], 18, { speed: 420, size: [4, 9], shape: 'dot', life: [0.3, 0.6], up: 40, gravity: 300 });
        burst(X, Y, ['rgba(80,80,80,.55)', 'rgba(120,120,120,.5)'], 10, { speed: 90, size: [16, 28], shape: 'dot', life: [0.8, 1.3], up: 40, gravity: -60 });
        play('boom');
        break;
      case 'hit':
        feathers(X, Y, e.type, 5);
        play('cluck');
        break;
      case 'ability':
        if (e.ability === 'split') { feathers(X, Y, e.type, 6); play('flap'); }
        else if (e.ability === 'dash') { burst(X, Y, ['#FFE08A', '#FFFFFF'], 10, { speed: 200, size: [3, 6], shape: 'dot', life: [0.3, 0.5] }); play('launch'); }
        else if (e.ability === 'egg') { feathers(X, Y, e.type, 8); play('cluck'); }
        break;
      case 'cluck':
        play('cluck');
        feathers(X, Y, e.type, 3);
        break;
      case 'poof':
        burst(X, Y, ['rgba(255,255,255,.85)'], 8, { speed: 80, size: [8, 14], shape: 'dot', life: [0.4, 0.7], up: 20, gravity: -30 });
        feathers(X, Y, e.type, 4);
        play('poof');
        break;
      case 'next':
        hop = { type: e.type, start: t };
        break;
      case 'bonus': {
        const q = queuePos(e.index, e.type, Math.max(world.queue.length, e.index + 1));
        setTimeout(() => {
          pops.push({ x: px(q.x), y: py(q.y + 1.2), text: fmt(e.points), color: '#FFD23F', life: 1.4, size: 30 });
          feathers(px(q.x), py(q.y), e.type, 5);
          play('star');
          cb.onScore && cb.onScore(world.score);
        }, 250 + e.index * 330);
        break;
      }
      case 'won':
      case 'lost':
        if (!ended) {
          ended = true;
          setTimeout(() => cb.onEnd && cb.onEnd({ won: name === 'won', score: world.score, stars: e.stars || 0, level }), name === 'won' ? 300 + (e.spare || 0) * 330 : 300);
        }
        break;
      default:
    }
  }

  /* ---------- Rysowanie ---------- */

  // przy długiej kolejce kury stoją ciaśniej, żeby żadna nie wyszła poza ekran
  function queuePos(i, type, n = world.queue.length) {
    const r = HENS[type].r;
    const gap = Math.min(1.0, (2.05 - (cam.x0 + 0.55)) / Math.max(1, n - 1));
    return { x: 2.05 - i * gap - (r - 0.45), y: r };
  }

  function slingHen() {
    if (!world || world.state !== 'aim' || !world.current) return null;
    const type = world.current;
    const r = HENS[type].r;
    if (hop) {
      const k = Math.min(1, (t - hop.start) / 0.45);
      const from = queuePos(0, type);
      if (k < 1) {
        return { type, r, x: from.x + (ANCHOR.x - from.x) * k, y: from.y + (ANCHOR.y - from.y) * k + Math.sin(k * Math.PI) * 1.2, hopping: true };
      }
      hop = null;
    }
    const pull = currentPull();
    return { type, r, x: ANCHOR.x + pull.x, y: ANCHOR.y + pull.y + (pull.x || pull.y ? 0 : Math.sin(t * 3) * 0.03) };
  }

  function currentPull() {
    let p = { x: 0, y: 0 };
    if (drag) p = drag.pull;
    else if (kb) p = { x: -Math.cos(kb.a) * MAX_PULL * kb.p, y: -Math.sin(kb.a) * MAX_PULL * kb.p };
    const l = Math.hypot(p.x, p.y);
    if (l > MAX_PULL) p = { x: (p.x / l) * MAX_PULL, y: (p.y / l) * MAX_PULL };
    return p;
  }

  function look() {
    const b = world.main;
    if (b) return b.getPosition();
    return ANCHOR;
  }

  function draw() {
    view.begin();
    ctx.save();
    if (shake > 0) ctx.translate(rnd(-8, 8) * shake, rnd(-6, 6) * shake);
    const theme = CHAPTERS[level.chapter].theme;
    drawBackground(ctx, theme, t);
    if (sunEye >= 0) drawSunEye();
    // ślad poprzedniego i obecnego strzału
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    for (const tr of [world.lastTrail, world.trail]) {
      tr.forEach((p, i) => {
        ctx.beginPath();
        ctx.arc(px(p.x), py(p.y), i % 3 === 0 ? 4 : 2.5, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    const hen = slingHen();
    drawSlingBack(ctx, hen && !hen.hopping ? hen : null);
    const target = look();
    for (const b of world.bodies()) {
      const u = b.getUserData();
      if (!u || u.dead) continue;
      const p = b.getPosition();
      const a = b.getAngle();
      if (u.kind === 'platform') drawPlatform(ctx, p.x, p.y, u.w, u.h, theme);
      else if (u.kind === 'block') drawBlock(ctx, u, p.x, p.y, a);
      else if (u.kind === 'egg') drawRottenEgg(ctx, u, p.x, p.y, a, target, t);
      else if (u.kind === 'bomb') drawEggBomb(ctx, p.x, p.y, a, t);
      else if (u.kind === 'hen') {
        ctx.globalAlpha = u.fade ? Math.max(0, 1 - u.fade / 1.4) : 1;
        drawHen(ctx, u.type, p.x, p.y, u.r, a, { t, tired: u.done });
        ctx.globalAlpha = 1;
      }
    }
    if (hen) drawHen(ctx, hen.type, hen.x, hen.y, hen.r, 0, { t });
    drawSlingFront(ctx, hen && !hen.hopping ? hen : null);
    // kolejka kur obok procy
    const queue = world.state === 'won' || world.state === 'winning' ? [] : world.queue;
    queue.forEach((type, i) => {
      const q = queuePos(i, type);
      const jump = Math.abs(Math.sin(t * 2.2 + i * 1.3)) * 0.12;
      drawHen(ctx, type, q.x, q.y + jump, HENS[type].r, 0, { t });
    });
    // podgląd toru przy celowaniu
    if (hen && (drag || kb) && !hen.hopping) {
      const dots = preview(currentPull());
      dots.forEach((d, i) => {
        ctx.fillStyle = `rgba(255,255,255,${0.9 - i * 0.07})`;
        ctx.beginPath();
        ctx.arc(px(d.x), py(d.y), 5 - i * 0.25, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    drawParticles(ctx, parts);
    drawPopups(ctx, pops);
    ctx.restore();
    if (flash > 0) {
      ctx.fillStyle = `rgba(255,240,200,${flash})`;
      ctx.fillRect(0, 0, W, H);
    }
    drawHud(hen);
  }

  function drawHud(hen) {
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'right';
    ctx.font = '800 40px Unbounded, system-ui, sans-serif';
    ctx.lineWidth = 7;
    ctx.strokeStyle = 'rgba(21,32,28,.6)';
    ctx.strokeText(fmt(world.score), W - 28, 58);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(fmt(world.score), W - 28, 58);
    ctx.font = '700 17px Onest, system-ui, sans-serif';
    ctx.lineWidth = 4;
    const sub = `Poziom ${level.id}: ${level.name}`;
    ctx.strokeText(sub, W - 28, 88);
    ctx.fillText(sub, W - 28, 88);
    // podpowiedzi
    ctx.textAlign = 'center';
    ctx.font = '700 22px Onest, system-ui, sans-serif';
    let hint = '';
    if (hen && !drag && !kb && shots === 0 && level.id === 1) hint = 'Złap kurę, odciągnij do tyłu i puść';
    if (world.state === 'fly' && world.main) {
      const u = world.main.getUserData();
      const ab = HENS[u.type].ability;
      if (ab && !u.used && (ab === 'boom' || !u.hitAt)) hint = 'Stuknij, żeby użyć mocy!';
    }
    if (hint) {
      ctx.globalAlpha = 0.65 + Math.sin(t * 6) * 0.35;
      ctx.lineWidth = 5;
      ctx.strokeText(hint, W / 2, H - 26);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(hint, W / 2, H - 26);
      ctx.globalAlpha = 1;
    }
  }

  function updateEffects(dt) {
    shake = Math.max(0, shake - dt);
    flash = Math.max(0, flash - dt);
    for (const p of parts) {
      p.vy += (p.g ?? 900) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += (p.vr || 0) * dt;
      p.life -= dt;
      if (p.shape === 'ring') p.size += 260 * dt;
    }
    parts = parts.filter((p) => p.life > 0);
    for (const p of pops) {
      p.y -= 45 * dt;
      p.life -= dt;
    }
    pops = pops.filter((p) => p.life > 0);
  }

  // Słońce w dzień i o zmierzchu (współrzędne ekranu, jak w drawBackground).
  const SUN = { x: 1060, y: 120, r: 78 };

  function checkSun() {
    if (sunEye >= 0 || !cb.sunActive || CHAPTERS[level.chapter].theme === 'noc' || !cb.sunActive()) return;
    for (const b of world.flying) {
      const p = b.getPosition();
      if (Math.hypot(px(p.x) - SUN.x, py(p.y) - SUN.y) < SUN.r) {
        sunEye = 0;
        shake = 0.4;
        cb.onSun && cb.onSun();
        return;
      }
    }
  }

  function drawSunEye() {
    const open = 1 - Math.max(0, Math.sin(sunEye * 2.2) ** 40); // co jakiś czas mruga
    const target = slingHen() || ANCHOR;
    const dx = px(target.x) - SUN.x;
    const dy = py(target.y) - SUN.y;
    const d = Math.hypot(dx, dy) || 1;
    ctx.save();
    ctx.fillStyle = '#FFF8E6';
    ctx.beginPath();
    ctx.ellipse(SUN.x, SUN.y, 38, 26 * open + 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    if (open > 0.2) {
      ctx.fillStyle = '#7A1010';
      ctx.beginPath();
      ctx.arc(SUN.x + (dx / d) * 14, SUN.y + (dy / d) * 8, 15 * open, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0A0A0A';
      ctx.beginPath();
      ctx.arc(SUN.x + (dx / d) * 16, SUN.y + (dy / d) * 9, 7 * open, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(90,30,10,.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(SUN.x, SUN.y, 38, 26 * open + 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  const ticker = loop((dt) => {
    t += dt;
    if (world && !paused) {
      acc = Math.min(acc + dt, STEP * 4);
      while (acc >= STEP) {
        world.step();
        acc -= STEP;
      }
      checkSun();
      updateEffects(dt);
    }
    if (sunEye >= 0) sunEye += dt;
    if (world) draw();
  });

  /* ---------- Sterowanie ---------- */

  function toWorld(e) {
    const l = view.toLocal(e.clientX, e.clientY);
    return { x: l.x / cam.s + cam.x0, y: (H - l.y) / cam.s + cam.y0 };
  }

  // Kamera obejmuje procę i całą budowlę, z zapasem nieba nad nią (im mniejszy poziom, tym bliżej).
  function fitCamera(lvl) {
    let maxX = 20;
    let maxY = 4;
    for (const p of lvl.pieces) {
      const r = p.t === 'e' ? EGGS[p.k].r : 0;
      maxX = Math.max(maxX, p.x + (p.t === 'e' ? r : p.w / 2));
      maxY = Math.max(maxY, p.t === 'e' ? p.y + 2.2 * r : p.y + p.h / 2);
    }
    const ground = 0.085;
    let w = Math.max(maxX + 2.6 + 1, 24);
    let h = (w * 9) / 16;
    if (h * (1 - ground) < maxY + 3.5) {
      h = (maxY + 3.5) / (1 - ground);
      w = (h * 16) / 9;
    }
    cam.x0 = -1;
    cam.s = W / w;
    cam.y0 = -h * ground;
  }

  const onDown = (e) => {
    if (!world || paused || e.target !== canvas) return;
    if (world.state === 'aim' && !hop) {
      const p = toWorld(e);
      drag = { sx: p.x, sy: p.y, pull: { x: 0, y: 0 }, id: e.pointerId };
      kb = null;
      canvas.setPointerCapture?.(e.pointerId);
      play('stretch');
      e.preventDefault();
    } else if (world.state === 'fly') {
      world.ability();
      e.preventDefault();
    }
  };
  const onMove = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const p = toWorld(e);
    drag.pull = { x: p.x - drag.sx, y: p.y - drag.sy };
  };
  const onUp = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const pull = currentPull();
    drag = null;
    if (world.launch(pull)) shots++;
  };
  const onCancel = () => { drag = null; };

  const onKey = (e) => {
    if (!world || paused) return;
    const k = e.key;
    if (world.state === 'aim' && !hop && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) {
      e.preventDefault();
      kb = kb || { a: (35 * Math.PI) / 180, p: 0.8 };
      if (k === 'ArrowUp') kb.a = Math.min(1.45, kb.a + 0.035);
      if (k === 'ArrowDown') kb.a = Math.max(-0.3, kb.a - 0.035);
      if (k === 'ArrowRight') kb.p = Math.min(1, kb.p + 0.03);
      if (k === 'ArrowLeft') kb.p = Math.max(0.2, kb.p - 0.03);
    } else if (k === ' ' || k === 'Enter') {
      if (e.target.closest && e.target.closest('button, a, input')) return;
      e.preventDefault();
      if (world.state === 'aim' && kb && !hop) {
        if (world.launch(currentPull())) shots++;
        kb = null;
      } else if (world.state === 'aim' && !hop) {
        kb = { a: (35 * Math.PI) / 180, p: 0.8 };
      } else if (world.state === 'fly') {
        world.ability();
      }
    }
  };

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onCancel);
  window.addEventListener('keydown', onKey);

  return {
    load(lvl) {
      level = lvl;
      fitCamera(lvl);
      world = new Swiat(lvl, { onEvent });
      parts = [];
      pops = [];
      drag = null;
      kb = null;
      hop = null;
      shots = 0;
      ended = false;
      paused = false;
      sunEye = -1;
      acc = 0;
      cb.onScore && cb.onScore(0);
      ticker.start();
    },
    get level() {
      return level;
    },
    get world() {
      return world;
    },
    pause() {
      paused = true;
      drag = null;
    },
    resume() {
      paused = false;
    },
    get paused() {
      return paused;
    },
    destroy() {
      ticker.stop();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKey);
      view.destroy();
    },
  };
}
