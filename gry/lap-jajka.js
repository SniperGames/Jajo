/* Jajo: gra „Łap jajka”. Kury na grzędzie znoszą jajka, a gracz łapie je do koszyka. */
import { makeCanvas, loop, sfx, drawEgg, rand, clamp } from './wspolne.js';

const W = 360;
const H = 540;
const HENS = [54, 138, 222, 306];
const BEAM_Y = 104;
const GROUND = 494;
const RIM = 448;
const BW = 80;
const EGG_W = 22;
const EGG_H = 29;
const LIVES = 3;

export default function create(stage, api) {
  const view = makeCanvas(stage, W, H);
  const { ctx } = view;
  let state = 'idle';
  let score = 0;
  let lives = LIVES;
  let eggs = [];
  let parts = [];
  let popups = [];
  let splats = [];
  let time = 0;
  let nextLay = 1;
  let shake = 0;
  let basketX = W / 2;
  let targetX = W / 2;
  let caughtShow = 0;
  const hens = HENS.map((x, i) => ({ x, lay: 0, bob: i * 1.3, brown: i % 2 === 1 }));
  const clouds = [{ x: 40, y: 40, s: 1 }, { x: 230, y: 28, s: 0.8 }, { x: 330, y: 62, s: 0.6 }];
  const keys = { left: false, right: false };

  const level = () => Math.floor(score / 12);

  function reset() {
    score = 0;
    lives = LIVES;
    eggs = [];
    parts = [];
    popups = [];
    splats = [];
    time = 0;
    nextLay = 0.8;
    shake = 0;
    caughtShow = 0;
    basketX = targetX = W / 2;
    hens.forEach((h) => { h.lay = 0; });
    api.onScore(0);
  }

  /* ---------- Logika ---------- */

  function layEgg() {
    const free = hens.filter((h) => h.lay <= 0);
    if (!free.length) return;
    const hen = free[Math.floor(Math.random() * free.length)];
    hen.lay = Math.max(0.28, 0.5 - level() * 0.02); // kura „przykuca”, zanim zniesie jajko
  }

  function release(hen) {
    const lvl = level();
    const r = Math.random();
    const rottenChance = score < 8 ? 0 : Math.min(0.2, 0.1 + lvl * 0.01);
    const type = r < 0.07 ? 'gold' : r < 0.07 + rottenChance ? 'rotten' : 'egg';
    eggs.push({
      x: hen.x,
      y: BEAM_Y + 6,
      vy: Math.min(390, 120 + lvl * 15) * rand(0.92, 1.08),
      type,
      brown: Math.random() < 0.4,
      rot: rand(-0.2, 0.2),
      vr: rand(-1.5, 1.5),
    });
  }

  function burst(x, y, color, n = 8, speed = 120) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const v = rand(speed * 0.4, speed);
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: rand(0.35, 0.7), color, r: rand(2, 4) });
    }
  }

  function popup(x, y, text, color) {
    popups.push({ x, y, text, color, life: 0.9 });
  }

  function loseLife() {
    lives -= 1;
    shake = 0.3;
    if (lives <= 0) {
      state = 'over';
      sfx('over');
      setTimeout(() => api.onOver(score), 450);
    }
  }

  function update(dt) {
    time += dt;
    clouds.forEach((c) => {
      c.x += dt * 8 * c.s;
      if (c.x > W + 60) c.x = -60;
    });
    hens.forEach((h) => { h.bob += dt; });
    if (state !== 'play') {
      updateEffects(dt);
      return;
    }
    // Koszyk: myszą lub palcem wskazujemy cel, strzałkami przesuwamy.
    const speed = 470;
    if (keys.left) targetX = basketX - speed * 0.12;
    if (keys.right) targetX = basketX + speed * 0.12;
    targetX = clamp(targetX, BW / 2 + 4, W - BW / 2 - 4);
    basketX += (targetX - basketX) * Math.min(1, dt * (keys.left || keys.right ? 9 : 18));

    nextLay -= dt;
    if (nextLay <= 0) {
      layEgg();
      nextLay = Math.max(0.42, 1.12 - level() * 0.055) * rand(0.85, 1.15);
    }
    hens.forEach((h) => {
      if (h.lay > 0) {
        h.lay -= dt;
        if (h.lay <= 0) release(h);
      }
    });

    for (const e of eggs) {
      const before = e.y + EGG_H / 2;
      e.vy += 70 * dt;
      e.y += e.vy * dt;
      e.rot += e.vr * dt;
      const bottom = e.y + EGG_H / 2;
      if (!e.done && before <= RIM + 4 && bottom > RIM + 4 && Math.abs(e.x - basketX) < BW / 2 + 2) {
        e.done = true;
        if (e.type === 'rotten') {
          sfx('bad');
          burst(e.x, RIM, '#9DAA74', 10);
          popup(e.x, RIM - 20, 'Fuj!', '#6E7F3A');
          loseLife();
        } else {
          const pts = e.type === 'gold' ? 5 : 1;
          score += pts;
          api.onScore(score);
          sfx(e.type === 'gold' ? 'gold' : 'catch');
          burst(e.x, RIM, e.type === 'gold' ? '#FFD54A' : '#FFFFFF', e.type === 'gold' ? 14 : 6, 110);
          popup(e.x, RIM - 22, '+' + pts, e.type === 'gold' ? '#B07A00' : '#1F6E43');
          caughtShow = Math.min(3, caughtShow + 1);
        }
      } else if (!e.done && bottom >= GROUND + 4) {
        e.done = true;
        splats.push({ x: e.x, y: GROUND + 6, type: e.type, life: 2.2, seed: Math.random() * 10 });
        if (e.type === 'egg') {
          sfx('splat');
          burst(e.x, GROUND, '#F4B400', 8, 90);
          popup(e.x, GROUND - 26, 'Ups!', '#B42318');
          loseLife();
        } else if (e.type === 'gold') {
          burst(e.x, GROUND, '#FFD54A', 8, 90);
        }
      }
    }
    eggs = eggs.filter((e) => !e.done);
    updateEffects(dt);
  }

  function updateEffects(dt) {
    shake = Math.max(0, shake - dt);
    parts.forEach((p) => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 420 * dt;
      p.life -= dt;
    });
    parts = parts.filter((p) => p.life > 0);
    popups.forEach((p) => {
      p.y -= 40 * dt;
      p.life -= dt;
    });
    popups = popups.filter((p) => p.life > 0);
    splats.forEach((s) => { s.life -= dt; });
    splats = splats.filter((s) => s.life > 0);
  }

  /* ---------- Rysowanie ---------- */

  function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
    sky.addColorStop(0, '#9FD8F2');
    sky.addColorStop(1, '#EAF7FC');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255, 214, 92, .9)';
    ctx.beginPath();
    ctx.arc(318, 30, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    clouds.forEach((c) => {
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, 26 * c.s, 10 * c.s, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x + 16 * c.s, c.y - 6 * c.s, 16 * c.s, 10 * c.s, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    // Wzgórza i stodoła w tle
    ctx.fillStyle = '#B9E0A5';
    ctx.beginPath();
    ctx.moveTo(0, GROUND);
    ctx.quadraticCurveTo(80, 410, 170, 440);
    ctx.quadraticCurveTo(270, 400, W, 430);
    ctx.lineTo(W, GROUND);
    ctx.fill();
    ctx.fillStyle = '#C0563D';
    ctx.fillRect(250, 410, 52, 40);
    ctx.beginPath();
    ctx.moveTo(244, 412);
    ctx.lineTo(276, 390);
    ctx.lineTo(308, 412);
    ctx.fill();
    ctx.fillStyle = '#F3E3C8';
    ctx.fillRect(268, 428, 16, 22);
    // Ziemia
    ctx.fillStyle = '#86C46A';
    ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = '#6FB058';
    for (let x = 4; x < W; x += 14) {
      ctx.beginPath();
      ctx.moveTo(x, GROUND + 2);
      ctx.lineTo(x + 3, GROUND - 7);
      ctx.lineTo(x + 6, GROUND + 2);
      ctx.fill();
    }
  }

  function drawBeam() {
    ctx.fillStyle = '#8A5A33';
    ctx.fillRect(0, BEAM_Y, W, 12);
    ctx.fillStyle = '#A8723F';
    ctx.fillRect(0, BEAM_Y, W, 4);
    ctx.fillStyle = '#7A4D2A';
    [20, W - 26].forEach((x) => ctx.fillRect(x, BEAM_Y + 10, 6, 18));
  }

  function drawHen(h) {
    const laying = h.lay > 0;
    const squat = laying ? Math.sin((0.5 - h.lay) * 40) * 1.5 + 3 : 0;
    const y = BEAM_Y - 22 + Math.sin(h.bob * 2) * 1.2 + squat;
    // gniazdo
    ctx.fillStyle = '#E2B65C';
    ctx.beginPath();
    ctx.ellipse(h.x, BEAM_Y + 1, 27, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#C08F36';
    ctx.lineWidth = 1.5;
    for (let i = -20; i <= 20; i += 8) {
      ctx.beginPath();
      ctx.moveTo(h.x + i - 4, BEAM_Y - 2);
      ctx.lineTo(h.x + i + 4, BEAM_Y + 4);
      ctx.stroke();
    }
    if (laying) drawEgg(ctx, h.x, BEAM_Y + 6, EGG_W * 0.8, EGG_H * 0.8, { shine: false });
    const body = h.brown ? '#C77F45' : '#FFFDF7';
    const edge = h.brown ? '#9C5A2A' : '#D9C7A8';
    // ogon
    ctx.fillStyle = h.brown ? '#8E4F24' : '#EDE3D0';
    ctx.beginPath();
    ctx.moveTo(h.x - 18, y - 4);
    ctx.lineTo(h.x - 32, y - 16);
    ctx.lineTo(h.x - 26, y + 4);
    ctx.fill();
    // tułów
    ctx.fillStyle = body;
    ctx.strokeStyle = edge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(h.x - 2, y + 2, 23, 17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // skrzydło
    ctx.beginPath();
    ctx.ellipse(h.x - 6, y + 4, 11, 7, -0.3, 0, Math.PI * 2);
    ctx.fillStyle = h.brown ? '#B06C36' : '#F2EBDD';
    ctx.fill();
    // głowa
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(h.x + 15, y - 12, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // grzebień, korale, dziób, oko
    ctx.fillStyle = '#D7263D';
    ctx.beginPath();
    ctx.arc(h.x + 11, y - 23, 4, 0, Math.PI * 2);
    ctx.arc(h.x + 17, y - 24, 4.5, 0, Math.PI * 2);
    ctx.arc(h.x + 22, y - 21, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(h.x + 24, y - 4, 3, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#F4A300';
    ctx.beginPath();
    ctx.moveTo(h.x + 25, y - 14);
    ctx.lineTo(h.x + 34, y - 11);
    ctx.lineTo(h.x + 25, y - 8);
    ctx.fill();
    ctx.fillStyle = '#15201C';
    ctx.beginPath();
    ctx.arc(h.x + 18, y - 14, 2.2, 0, Math.PI * 2);
    ctx.fill();
    if (laying) {
      ctx.fillStyle = '#B42318';
      ctx.font = '800 16px Unbounded, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', h.x + 2, y - 30);
    }
  }

  function drawFallingEgg(e) {
    if (e.type === 'gold') {
      drawEgg(ctx, e.x, e.y, EGG_W, EGG_H, { fill: '#FFD54A', stroke: '#C99700', angle: e.rot });
      ctx.fillStyle = 'rgba(255,255,255,.95)';
      const s = Math.sin(time * 10) * 2 + 3;
      ctx.fillRect(e.x + 10, e.y - 16, s, 1.6);
      ctx.fillRect(e.x + 10 + s / 2 - 0.8, e.y - 16 - s / 2 + 0.8, 1.6, s);
    } else if (e.type === 'rotten') {
      drawEgg(ctx, e.x, e.y, EGG_W, EGG_H, { fill: '#B5C38E', stroke: '#6E7F3A', angle: e.rot, shine: false });
      ctx.fillStyle = '#7C8C47';
      ctx.beginPath();
      ctx.arc(e.x - 4, e.y - 2, 3, 0, Math.PI * 2);
      ctx.arc(e.x + 5, e.y + 6, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#15201C';
      for (let i = 0; i < 2; i++) {
        const a = time * 7 + i * Math.PI;
        ctx.beginPath();
        ctx.arc(e.x + Math.cos(a) * 18, e.y - 10 + Math.sin(a * 1.3) * 6, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      drawEgg(ctx, e.x, e.y, EGG_W, EGG_H, {
        fill: e.brown ? '#E9C39B' : '#FFF6E8',
        stroke: e.brown ? '#B98A5C' : '#D9B98C',
        angle: e.rot,
      });
    }
  }

  function drawSplat(s) {
    ctx.globalAlpha = Math.min(1, s.life);
    if (s.type === 'rotten') {
      ctx.fillStyle = '#A3B06E';
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, 18, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const r = 14 + Math.sin(s.seed + i * 2.1) * 5;
        ctx.lineTo(s.x + Math.cos(a) * r * 1.4, s.y + Math.sin(a) * r * 0.4);
      }
      ctx.fill();
      ctx.fillStyle = s.type === 'gold' ? '#FFC21A' : '#F7A400';
      ctx.beginPath();
      ctx.ellipse(s.x + 2, s.y - 1, 7, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawBasket() {
    const x = basketX;
    const top = RIM;
    const bottom = RIM + 36;
    // jajka w koszyku
    for (let i = 0; i < caughtShow; i++) {
      drawEgg(ctx, x - 18 + i * 18, top + 2, 18, 22, { fill: i === 1 ? '#E9C39B' : '#FFF6E8', stroke: '#C9A578', shine: false });
    }
    ctx.fillStyle = '#C98B4A';
    ctx.strokeStyle = '#8A5A2B';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - BW / 2, top);
    ctx.lineTo(x + BW / 2, top);
    ctx.lineTo(x + BW / 2 - 9, bottom);
    ctx.lineTo(x - BW / 2 + 9, bottom);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(138,90,43,.55)';
    ctx.lineWidth = 1.5;
    for (let yy = top + 9; yy < bottom; yy += 9) {
      ctx.beginPath();
      ctx.moveTo(x - BW / 2 + 4, yy);
      ctx.lineTo(x + BW / 2 - 4, yy);
      ctx.stroke();
    }
    for (let xx = -BW / 2 + 12; xx < BW / 2 - 6; xx += 12) {
      ctx.beginPath();
      ctx.moveTo(x + xx, top + 2);
      ctx.lineTo(x + xx * 0.85, bottom - 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#A86C35';
    ctx.fillRect(x - BW / 2 - 3, top - 4, BW + 6, 7);
  }

  function drawHud() {
    for (let i = 0; i < LIVES; i++) {
      const on = i < lives;
      drawEgg(ctx, 18 + i * 22, 22, 15, 20, {
        fill: on ? '#FFF6E8' : 'rgba(255,255,255,.35)',
        stroke: on ? '#C9A578' : 'rgba(120,120,120,.4)',
        shine: on,
      });
    }
    ctx.font = '700 12px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(21,32,28,.7)';
    if (state === 'play' || state === 'over' || state === 'paused') ctx.fillText('Poziom ' + (level() + 1), 18 + LIVES * 22, 27);
  }

  function draw() {
    view.begin();
    ctx.save();
    if (shake > 0) ctx.translate(rand(-4, 4) * shake * 3, rand(-3, 3) * shake * 3);
    drawBackground();
    splats.forEach(drawSplat);
    drawBeam();
    hens.forEach(drawHen);
    eggs.forEach(drawFallingEgg);
    drawBasket();
    parts.forEach((p) => {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2));
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.font = '800 18px Unbounded, system-ui, sans-serif';
    popups.forEach((p) => {
      ctx.globalAlpha = Math.min(1, p.life * 1.6);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    });
    ctx.globalAlpha = 1;
    ctx.restore();
    drawHud();
  }

  const ticker = loop((dt) => {
    update(dt);
    draw();
  });

  /* ---------- Sterowanie ---------- */

  let dragging = false;
  const onPointer = (e) => {
    if (state !== 'play') return;
    if (e.type === 'pointerdown') {
      dragging = true;
      stage.setPointerCapture?.(e.pointerId);
    }
    if (e.pointerType === 'mouse' || dragging) targetX = view.toLocal(e.clientX, e.clientY).x;
  };
  const onUp = () => { dragging = false; };
  const onKey = (e) => {
    const down = e.type === 'keydown';
    if (['ArrowLeft', 'a', 'A'].includes(e.key)) keys.left = down;
    else if (['ArrowRight', 'd', 'D'].includes(e.key)) keys.right = down;
    else return;
    if (state === 'play') e.preventDefault();
  };
  stage.addEventListener('pointerdown', onPointer);
  stage.addEventListener('pointermove', onPointer);
  stage.addEventListener('pointerup', onUp);
  stage.addEventListener('pointercancel', onUp);
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);

  ticker.start(); // spokojna scena za ekranem startowym

  return {
    start() {
      reset();
      state = 'play';
      ticker.start();
    },
    pause() {
      if (state !== 'play') return;
      state = 'paused';
      ticker.stop();
      keys.left = keys.right = false;
    },
    resume() {
      if (state !== 'paused') return;
      state = 'play';
      ticker.start();
    },
    destroy() {
      ticker.stop();
      stage.removeEventListener('pointerdown', onPointer);
      stage.removeEventListener('pointermove', onPointer);
      stage.removeEventListener('pointerup', onUp);
      stage.removeEventListener('pointercancel', onUp);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      view.destroy();
    },
  };
}

