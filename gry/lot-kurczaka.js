/* Jajo: gra „Lot kurczaka”. Kurczak przelatuje między stosami wytłaczanek. */
import { makeCanvas, loop, sfx, rand, clamp } from './wspolne.js';

const W = 360;
const H = 540;
const GROUND = 488;
const X = 104;
const HIT = 12;
const COL_W = 62;
const SPACING = 205;
const CARTON = 34;

export default function create(stage, api) {
  const view = makeCanvas(stage, W, H);
  const { ctx } = view;
  let state = 'idle';
  let y = 250;
  let vy = 0;
  let angle = 0;
  let wing = 0;
  let cols = [];
  let score = 0;
  let speed = 140;
  let t = 0;
  let far = 0;
  let near = 0;
  let parts = [];

  function reset() {
    y = 250;
    vy = 0;
    angle = 0;
    cols = [];
    score = 0;
    speed = 140;
    parts = [];
    api.onScore(0);
  }

  function addColumn(x) {
    const gap = Math.max(132, 168 - score * 1.2);
    const center = rand(110 + gap / 2 - 40, GROUND - 60 - gap / 2);
    cols.push({ x, top: center - gap / 2, bottom: center + gap / 2, passed: false });
  }

  function flap() {
    if (state === 'ready') state = 'play';
    if (state !== 'play') return;
    vy = -385;
    wing = 0.22;
    sfx('flap');
    for (let i = 0; i < 3; i++) parts.push({ x: X - 10, y: y + 6, vx: rand(-90, -40), vy: rand(-20, 40), life: 0.4 });
  }

  function crash() {
    if (state !== 'play') return;
    state = 'falling';
    sfx('bad');
    setTimeout(() => sfx('over'), 250);
  }

  function hits(c) {
    const left = c.x - COL_W / 2;
    const right = c.x + COL_W / 2;
    const nx = clamp(X, left, right);
    const overlapTop = (() => {
      const ny = clamp(y, 0, c.top);
      return (X - nx) ** 2 + (y - ny) ** 2 < HIT * HIT;
    })();
    const overlapBottom = (() => {
      const ny = clamp(y, c.bottom, GROUND);
      return (X - nx) ** 2 + (y - ny) ** 2 < HIT * HIT;
    })();
    return overlapTop || overlapBottom;
  }

  function update(dt) {
    t += dt;
    wing = Math.max(0, wing - dt);
    parts.forEach((p) => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    });
    parts = parts.filter((p) => p.life > 0);
    const moving = state === 'idle' || state === 'ready' || state === 'play';
    if (moving) {
      far = (far + dt * speed * 0.2) % 400;
      near = (near + dt * speed) % 24;
    }
    if (state === 'idle' || state === 'ready') {
      y = 250 + Math.sin(t * 3) * 8;
      angle = 0;
      if (Math.sin(t * 3 + 1) > 0.6) wing = 0.05;
      return;
    }
    if (state === 'play' || state === 'falling') {
      vy = Math.min(vy + 1350 * dt, 580);
      y += vy * dt;
      angle = clamp(vy / 620, -0.45, 1.25);
      if (y - HIT < 0) {
        y = HIT;
        vy = 0;
      }
      if (y + HIT >= GROUND) {
        y = GROUND - HIT;
        if (state === 'play') crash();
        if (state === 'falling') {
          state = 'over';
          setTimeout(() => api.onOver(score), 350);
        }
      }
    }
    if (state !== 'play') return;
    speed = Math.min(205, 140 + score * 2.2);
    cols.forEach((c) => { c.x -= speed * dt; });
    cols = cols.filter((c) => c.x > -COL_W);
    const lastX = cols.length ? cols[cols.length - 1].x : -Infinity;
    if (lastX < W - SPACING) addColumn(Math.max(W + COL_W, lastX + SPACING));
    for (const c of cols) {
      if (!c.passed && c.x + COL_W / 2 < X - HIT) {
        c.passed = true;
        score += 1;
        api.onScore(score);
        sfx('point');
      }
      if (hits(c)) {
        crash();
        break;
      }
    }
  }

  /* ---------- Rysowanie ---------- */

  function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
    sky.addColorStop(0, '#8FD0F0');
    sky.addColorStop(1, '#F2FAFD');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    // daleko: wzgórza
    ctx.fillStyle = '#C6E6B3';
    for (let i = -1; i < 3; i++) {
      const x = i * 200 - (far % 200);
      ctx.beginPath();
      ctx.ellipse(x + 100, GROUND, 140, 70, 0, Math.PI, 0);
      ctx.fill();
    }
    // płot
    ctx.fillStyle = '#E8D3B0';
    for (let x = -(near * 2 % 40); x < W; x += 40) {
      ctx.fillRect(x, GROUND - 34, 6, 34);
    }
    ctx.fillRect(0, GROUND - 26, W, 4);
    ctx.fillRect(0, GROUND - 14, W, 4);
    // ziemia
    ctx.fillStyle = '#7CBF5E';
    ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = '#67A84C';
    for (let x = -near; x < W + 24; x += 24) {
      ctx.fillRect(x, GROUND, 12, 8);
    }
    ctx.fillStyle = '#B98B57';
    ctx.fillRect(0, GROUND + 8, W, H - GROUND - 8);
    ctx.fillStyle = '#A97A47';
    for (let x = -near; x < W + 24; x += 24) {
      ctx.beginPath();
      ctx.arc(x + 6, GROUND + 24, 2, 0, Math.PI * 2);
      ctx.arc(x + 16, GROUND + 36, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Słup ze złożonych wytłaczanek
  function drawStack(x, from, to, capAtEnd) {
    const left = x - COL_W / 2;
    ctx.fillStyle = '#DCCDB0';
    ctx.strokeStyle = '#B19D78';
    ctx.lineWidth = 2;
    ctx.fillRect(left, from, COL_W, to - from);
    ctx.strokeRect(left, from, COL_W, to - from);
    const dir = capAtEnd === 'bottom' ? 1 : -1;
    const start = capAtEnd === 'bottom' ? to : from;
    for (let i = 0; ; i++) {
      const yy = start - dir * (i + 1) * CARTON;
      if ((dir === 1 && yy < from - CARTON) || (dir === -1 && yy > to)) break;
      ctx.strokeStyle = 'rgba(150,128,92,.6)';
      ctx.beginPath();
      ctx.moveTo(left, yy);
      ctx.lineTo(left + COL_W, yy);
      ctx.stroke();
      ctx.fillStyle = '#C9B793';
      for (let k = 0; k < 3; k++) {
        const cy = yy + dir * CARTON / 2;
        if (cy < from || cy > to) continue;
        ctx.beginPath();
        ctx.arc(left + 12 + k * 19, cy, 6.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // kołnierz przy szczelinie
    const capY = capAtEnd === 'bottom' ? to - 10 : from;
    ctx.fillStyle = '#E9DCC2';
    ctx.strokeStyle = '#B19D78';
    ctx.fillRect(left - 5, capY, COL_W + 10, 10);
    ctx.strokeRect(left - 5, capY, COL_W + 10, 10);
  }

  function drawChick() {
    ctx.save();
    ctx.translate(X, y);
    ctx.rotate(angle);
    // nóżki, gdy czeka
    if (state === 'idle' || state === 'ready') {
      ctx.strokeStyle = '#E08A00';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-4, 13);
      ctx.lineTo(-5, 19);
      ctx.moveTo(4, 13);
      ctx.lineTo(5, 19);
      ctx.stroke();
    }
    ctx.fillStyle = '#FFD23F';
    ctx.strokeStyle = '#E0A100';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 17, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // czubek
    ctx.beginPath();
    ctx.moveTo(-3, -14);
    ctx.quadraticCurveTo(-1, -22, 3, -16);
    ctx.quadraticCurveTo(5, -21, 7, -14);
    ctx.fill();
    // skrzydło
    ctx.save();
    ctx.translate(-5, 2);
    ctx.rotate(wing > 0 ? -0.9 : 0.25);
    ctx.fillStyle = '#FFC300';
    ctx.beginPath();
    ctx.ellipse(-2, 0, 9, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // oko, policzek, dziób
    ctx.fillStyle = '#15201C';
    ctx.beginPath();
    ctx.arc(7, -4, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(7.8, -4.8, 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(244,120,90,.55)';
    ctx.beginPath();
    ctx.arc(5, 3, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#F28C00';
    ctx.beginPath();
    ctx.moveTo(14, -3);
    ctx.lineTo(22, 0);
    ctx.lineTo(14, 3);
    ctx.fill();
    if (state === 'over' || state === 'falling') {
      ctx.strokeStyle = '#15201C';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(5, -6);
      ctx.lineTo(9, -2);
      ctx.moveTo(9, -6);
      ctx.lineTo(5, -2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function draw() {
    view.begin();
    drawBackground();
    cols.forEach((c) => {
      drawStack(c.x, 0, c.top, 'bottom');
      drawStack(c.x, c.bottom, GROUND, 'top');
    });
    ctx.fillStyle = 'rgba(255,255,255,.8)';
    parts.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life * 2);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 3, 2, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    drawChick();
    if (state !== 'idle') {
      ctx.textAlign = 'center';
      ctx.font = '800 44px Unbounded, system-ui, sans-serif';
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(21,32,28,.55)';
      ctx.strokeText(String(score), W / 2, 78);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(String(score), W / 2, 78);
    }
    if (state === 'ready') {
      ctx.textAlign = 'center';
      ctx.font = '700 16px Onest, system-ui, sans-serif';
      ctx.fillStyle = 'rgba(21,32,28,.8)';
      ctx.fillText('Stuknij albo naciśnij spację,', W / 2, 330);
      ctx.fillText('żeby machnąć skrzydłami', W / 2, 352);
    }
  }

  const ticker = loop((dt) => {
    update(dt);
    draw();
  });

  /* ---------- Sterowanie ---------- */

  const onPointer = (e) => {
    if (state !== 'ready' && state !== 'play') return;
    e.preventDefault();
    flap();
  };
  const onKey = (e) => {
    if (![' ', 'ArrowUp', 'w', 'W'].includes(e.key)) return;
    if (state !== 'ready' && state !== 'play') return;
    e.preventDefault();
    if (!e.repeat) flap();
  };
  stage.addEventListener('pointerdown', onPointer);
  window.addEventListener('keydown', onKey);

  ticker.start();

  return {
    start() {
      reset();
      state = 'ready';
      ticker.start();
    },
    pause() {
      if (state !== 'play' && state !== 'ready') return;
      state = state === 'play' ? 'paused' : 'paused-ready';
      ticker.stop();
    },
    resume() {
      if (state === 'paused') state = 'play';
      else if (state === 'paused-ready') state = 'ready';
      else return;
      ticker.start();
    },
    destroy() {
      ticker.stop();
      stage.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
      view.destroy();
    },
  };
}
