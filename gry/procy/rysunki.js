/* Jajo, „Kury z procy”: rysowanie (tła, proca, kury, zgniłe jajka, klocki, efekty). */
import { VIEW, EGGS, ANCHOR, eggShape } from './swiat.js';

export const W = 1280;
export const H = 720;
// Kamera: lewy dolny róg widoku (metry) i skala (pikseli na metr). Każdy poziom ustawia ją po swojemu.
export const cam = { x0: VIEW.x0, y0: VIEW.y0, s: 40 };
export const px = (x) => (x - cam.x0) * cam.s;
export const py = (y) => H - (y - cam.y0) * cam.s;

export const THEMES = {
  dzien: { sky: ['#8FD3F4', '#E8F7FD'], sun: '#FFD65C', far: '#C9E8B2', near: '#A9D78E', grass: '#7CBF5E', grassDark: '#67A84C', dirt: '#B98B57', dirtDark: '#A2774A', cloud: 'rgba(255,255,255,.92)' },
  zmierzch: { sky: ['#F47C6A', '#FFD3A0'], sun: '#FFB347', far: '#D89AAE', near: '#B97C96', grass: '#6FA552', grassDark: '#5C8F43', dirt: '#9C6E45', dirtDark: '#875E3A', cloud: 'rgba(255,226,214,.85)' },
  noc: { sky: ['#141C38', '#34457A'], moon: '#F3F0D7', far: '#2E3A60', near: '#253050', grass: '#4C7A4A', grassDark: '#3E663D', dirt: '#5E4A35', dirtDark: '#4E3D2B', cloud: 'rgba(160,175,220,.35)' },
};

/* ---------- Tło ---------- */

function hills(ctx, color, base, amp, offset, seed) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, py(0));
  for (let x = 0; x <= W; x += 40) {
    const y = base - amp * (0.55 + 0.45 * Math.sin(x / 210 + seed) * Math.cos(x / 97 + seed * 2)) - offset;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, py(0));
  ctx.closePath();
  ctx.fill();
}

export function drawBackground(ctx, theme, t) {
  const th = THEMES[theme];
  const sky = ctx.createLinearGradient(0, 0, 0, py(0));
  sky.addColorStop(0, th.sky[0]);
  sky.addColorStop(1, th.sky[1]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  if (th.moon) {
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    for (let i = 0; i < 60; i++) {
      const x = (i * 211) % W;
      const y = (i * 97) % 380;
      const s = (i % 3) * 0.6 + 0.8 + Math.sin(t * 2 + i) * 0.3;
      ctx.fillRect(x, y, s, s);
    }
    ctx.fillStyle = th.moon;
    ctx.beginPath();
    ctx.arc(1080, 110, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(200,196,170,.6)';
    ctx.beginPath();
    ctx.arc(1066, 98, 9, 0, Math.PI * 2);
    ctx.arc(1096, 126, 6, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const glow = ctx.createRadialGradient(1060, 120, 10, 1060, 120, 120);
    glow.addColorStop(0, th.sun);
    glow.addColorStop(0.45, th.sun);
    glow.addColorStop(1, 'rgba(255,214,92,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(1060, 120, 120, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = th.cloud;
  for (let i = 0; i < 4; i++) {
    const x = ((i * 337 + t * (8 + i * 3)) % (W + 300)) - 150;
    const y = 70 + i * 48;
    const s = 1 - i * 0.12;
    ctx.beginPath();
    ctx.ellipse(x, y, 70 * s, 22 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 40 * s, y - 14 * s, 42 * s, 22 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 36 * s, y - 6 * s, 30 * s, 16 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  hills(ctx, th.far, py(0) - 40, 150, 0, 1.3);
  if (theme === 'dzien') drawBarn(ctx, 430, py(0) - 60);
  if (theme === 'zmierzch') drawWindmill(ctx, 480, py(0) - 70, t);
  if (theme === 'noc') drawCastle(ctx, 330, py(0) - 40);
  hills(ctx, th.near, py(0) - 4, 70, 0, 4.1);
  // trawa i ziemia
  ctx.fillStyle = th.dirt;
  ctx.fillRect(0, py(0) + 8, W, H - py(0));
  ctx.fillStyle = th.dirtDark;
  for (let i = 0; i < 40; i++) {
    ctx.beginPath();
    ctx.ellipse((i * 137) % W, py(0) + 22 + ((i * 53) % 34), 5 + (i % 3) * 2, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = th.grass;
  ctx.fillRect(0, py(0) - 2, W, 12);
  ctx.fillStyle = th.grassDark;
  for (let x = 0; x < W; x += 16) {
    ctx.beginPath();
    ctx.moveTo(x, py(0) + 2);
    ctx.lineTo(x + 4, py(0) - 8);
    ctx.lineTo(x + 8, py(0) + 2);
    ctx.fill();
  }
}

function drawBarn(ctx, x, y) {
  ctx.fillStyle = 'rgba(192,86,61,.75)';
  ctx.fillRect(x, y - 70, 110, 70);
  ctx.beginPath();
  ctx.moveTo(x - 10, y - 66);
  ctx.lineTo(x + 55, y - 110);
  ctx.lineTo(x + 120, y - 66);
  ctx.fill();
  ctx.fillStyle = 'rgba(243,227,200,.8)';
  ctx.fillRect(x + 40, y - 46, 30, 46);
  ctx.strokeStyle = 'rgba(192,86,61,.75)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 40, y - 46);
  ctx.lineTo(x + 70, y);
  ctx.moveTo(x + 70, y - 46);
  ctx.lineTo(x + 40, y);
  ctx.stroke();
}

function drawWindmill(ctx, x, y, t) {
  ctx.fillStyle = 'rgba(120,70,95,.7)';
  ctx.beginPath();
  ctx.moveTo(x - 26, y);
  ctx.lineTo(x - 14, y - 120);
  ctx.lineTo(x + 14, y - 120);
  ctx.lineTo(x + 26, y);
  ctx.fill();
  ctx.save();
  ctx.translate(x, y - 118);
  ctx.rotate(t * 0.6);
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 2);
    ctx.fillRect(-5, 0, 10, 70);
  }
  ctx.restore();
}

function drawCastle(ctx, x, y) {
  ctx.fillStyle = 'rgba(28,36,62,.9)';
  ctx.fillRect(x, y - 120, 220, 120);
  [[x - 20, 170], [x + 200, 170], [x + 90, 200]].forEach(([tx, h]) => {
    ctx.fillRect(tx, y - h, 44, h);
    for (let i = 0; i < 4; i++) ctx.fillRect(tx + i * 12, y - h - 12, 8, 12);
  });
  for (let i = 0; i < 18; i++) ctx.fillRect(x + i * 12, y - 132, 8, 12);
  ctx.fillStyle = 'rgba(140,190,90,.85)';
  [[x + 112, 200], [x + 2, 170], [x + 222, 170]].forEach(([fx, h]) => {
    ctx.fillRect(fx, y - h - 52, 3, 40);
    ctx.beginPath();
    ctx.moveTo(fx + 3, y - h - 52);
    ctx.lineTo(fx + 28, y - h - 44);
    ctx.lineTo(fx + 3, y - h - 36);
    ctx.fill();
  });
  ctx.fillStyle = 'rgba(255,214,120,.55)';
  [[x + 30, 60], [x + 150, 60], [x + 104, 150]].forEach(([wx, h]) => ctx.fillRect(wx, y - h, 12, 18));
}

export function drawPlatform(ctx, x, y, w, h, theme) {
  const th = THEMES[theme];
  const l = px(x - w / 2);
  const t = py(y + h / 2);
  ctx.fillStyle = th.dirt;
  ctx.strokeStyle = th.dirtDark;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(l, t, w * cam.s, h * cam.s + 8, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = th.dirtDark;
  for (let i = 0; i < w * 2; i++) {
    ctx.beginPath();
    ctx.ellipse(l + 12 + ((i * 41) % (w * cam.s - 24)), t + 18 + ((i * 29) % Math.max(10, h * cam.s - 24)), 6, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = th.grass;
  ctx.beginPath();
  ctx.roundRect(l - 2, t - 4, w * cam.s + 4, 12, 6);
  ctx.fill();
}

/* ---------- Klocki ---------- */

function seeded(id) {
  let s = id * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function cracks(ctx, w, h, ratio, id) {
  if (ratio > 0.66) return;
  const r = seeded(id);
  ctx.strokeStyle = 'rgba(30,20,10,.55)';
  ctx.lineWidth = 2;
  const n = ratio > 0.33 ? 1 : 3;
  for (let k = 0; k < n; k++) {
    let x = (r() - 0.5) * w * 0.6;
    let y = (r() - 0.5) * h * 0.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let i = 0; i < 4; i++) {
      x += (r() - 0.5) * w * 0.35;
      y += (r() - 0.5) * h * 0.35;
      ctx.lineTo(Math.max(-w / 2, Math.min(w / 2, x)), Math.max(-h / 2, Math.min(h / 2, y)));
    }
    ctx.stroke();
  }
}

export function drawBlock(ctx, u, x, y, angle) {
  const w = u.w * cam.s;
  const h = u.h * cam.s;
  ctx.save();
  ctx.translate(px(x), py(y));
  ctx.rotate(-angle);
  const ratio = u.hp / u.max;
  if (u.mat === 'drewno') {
    ctx.fillStyle = '#C98B4A';
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.strokeStyle = 'rgba(122,77,36,.55)';
    ctx.lineWidth = 1.5;
    const along = w >= h;
    for (let i = 1; i < 3; i++) {
      ctx.beginPath();
      if (along) {
        ctx.moveTo(-w / 2 + 4, -h / 2 + (h * i) / 3);
        ctx.lineTo(w / 2 - 4, -h / 2 + (h * i) / 3);
      } else {
        ctx.moveTo(-w / 2 + (w * i) / 3, -h / 2 + 4);
        ctx.lineTo(-w / 2 + (w * i) / 3, h / 2 - 4);
      }
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    ctx.fillRect(-w / 2, -h / 2, w, Math.min(4, h / 3));
    ctx.strokeStyle = '#7A4D24';
    ctx.lineWidth = 2;
    ctx.strokeRect(-w / 2, -h / 2, w, h);
  } else if (u.mat === 'lod') {
    ctx.fillStyle = 'rgba(186,228,250,.82)';
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 4, h / 2 - 6);
    ctx.lineTo(-w / 2 + Math.min(w, h) * 0.5, -h / 2 + 4);
    ctx.stroke();
    ctx.strokeStyle = '#6FAFD3';
    ctx.strokeRect(-w / 2, -h / 2, w, h);
  } else if (u.mat === 'kamien') {
    ctx.fillStyle = '#9AA3A8';
    ctx.fillRect(-w / 2, -h / 2, w, h);
    const r = seeded(u.id + 7);
    ctx.fillStyle = 'rgba(80,88,94,.45)';
    for (let i = 0; i < Math.max(3, (w * h) / 300); i++) {
      ctx.beginPath();
      ctx.arc((r() - 0.5) * (w - 8), (r() - 0.5) * (h - 8), 1.5 + r() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,.2)';
    ctx.fillRect(-w / 2, -h / 2, w, Math.min(5, h / 3));
    ctx.strokeStyle = '#626B70';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(-w / 2, -h / 2, w, h);
  } else if (u.mat === 'tnt') {
    ctx.fillStyle = '#C0392B';
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.strokeStyle = '#7A1E14';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    ctx.strokeRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8);
    ctx.fillStyle = '#FFF6E8';
    ctx.font = `900 ${Math.round(h * 0.34)}px Unbounded, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TNT', 0, 1);
  }
  cracks(ctx, w, h, ratio, u.id);
  ctx.restore();
}

/* ---------- Zgniłe jajka ---------- */

function eggOutline(ctx, r) {
  const pts = eggShape(r * cam.s, 28);
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, -p.y) : ctx.moveTo(p.x, -p.y)));
  ctx.closePath();
}

export function drawRottenEgg(ctx, u, x, y, angle, look, t) {
  const r = u.r;
  const R = r * cam.s;
  ctx.save();
  ctx.translate(px(x), py(y));
  ctx.rotate(-angle);
  eggOutline(ctx, r);
  const g = ctx.createLinearGradient(-R, -R, R, R);
  g.addColorStop(0, u.egg === 'krol' ? '#C9D88F' : '#BFD08C');
  g.addColorStop(1, u.egg === 'krol' ? '#7E9A4C' : '#86A057');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = Math.max(2, R * 0.08);
  ctx.strokeStyle = '#5C7434';
  ctx.stroke();
  // plamy zgnilizny
  ctx.fillStyle = 'rgba(92,116,52,.45)';
  ctx.beginPath();
  ctx.ellipse(-R * 0.45, R * 0.35, R * 0.16, R * 0.11, 0.4, 0, Math.PI * 2);
  ctx.ellipse(R * 0.5, -R * 0.1, R * 0.1, R * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  // oczy patrzą w stronę kury
  const lx = look ? Math.max(-1, Math.min(1, (look.x - x) / 6)) : -1;
  const ly = look ? Math.max(-1, Math.min(1, (look.y - y) / 6)) : 0;
  const blink = Math.sin(t * 1.3 + u.id * 1.7) > 0.985;
  [-0.32, 0.32].forEach((ex) => {
    const cx = ex * R;
    const cy = -R * 0.22;
    ctx.fillStyle = '#FFFDF2';
    ctx.beginPath();
    ctx.ellipse(cx, cy, R * 0.22, blink ? R * 0.04 : R * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    if (!blink) {
      ctx.fillStyle = '#1B2414';
      ctx.beginPath();
      ctx.arc(cx + lx * R * 0.09, cy - ly * R * 0.08, R * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
    // brew
    ctx.strokeStyle = '#3E4F22';
    ctx.lineWidth = Math.max(2, R * 0.09);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - ex * R * 0.55, cy - R * 0.38);
    ctx.lineTo(cx + ex * R * 0.15, cy - R * 0.26);
    ctx.stroke();
  });
  // grymas
  ctx.strokeStyle = '#3E4F22';
  ctx.lineWidth = Math.max(2, R * 0.07);
  ctx.beginPath();
  ctx.arc(0, R * 0.42, R * 0.22, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();
  const ratio = u.hp / u.max;
  if (ratio < 0.66) {
    ctx.strokeStyle = 'rgba(40,52,20,.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-R * 0.1, -R * 1.05);
    ctx.lineTo(R * 0.08, -R * 0.75);
    ctx.lineTo(-R * 0.06, -R * 0.55);
    if (ratio < 0.33) {
      ctx.moveTo(R * 0.6, R * 0.2);
      ctx.lineTo(R * 0.35, R * 0.35);
      ctx.lineTo(R * 0.45, R * 0.6);
    }
    ctx.stroke();
  }
  if (u.egg === 'kask') {
    ctx.fillStyle = '#8E979C';
    ctx.strokeStyle = '#5F676B';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, -R * 0.82, R * 0.72, R * 0.42, 0, Math.PI, 0);
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(-R * 0.8, -R * 0.84, R * 1.6, R * 0.14);
    ctx.strokeRect(-R * 0.8, -R * 0.84, R * 1.6, R * 0.14);
  } else if (u.egg === 'krol') {
    ctx.fillStyle = '#FFD23F';
    ctx.strokeStyle = '#B88A00';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-R * 0.55, -R * 0.95);
    ctx.lineTo(-R * 0.6, -R * 1.5);
    ctx.lineTo(-R * 0.28, -R * 1.22);
    ctx.lineTo(0, -R * 1.62);
    ctx.lineTo(R * 0.28, -R * 1.22);
    ctx.lineTo(R * 0.6, -R * 1.5);
    ctx.lineTo(R * 0.55, -R * 0.95);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#E04F7A';
    ctx.beginPath();
    ctx.arc(0, -R * 1.18, R * 0.08, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/* ---------- Kury ---------- */

export const HEN_LOOK = {
  kokoszka: { body: '#D7263D', belly: '#F7DDBB', edge: '#93182A', comb: '#FF7B7B', beak: '#F4A300' },
  pisklaki: { body: '#FFD23F', belly: '#FFF0A8', edge: '#D9A400', comb: null, beak: '#F28C00' },
  rakieta: { body: '#F4A300', belly: '#FFE3A1', edge: '#B87400', comb: '#D7263D', beak: '#E85D04' },
  bomba: { body: '#2E3236', belly: '#4B5157', edge: '#0E1113', comb: '#D7263D', beak: '#F4A300' },
  nioska: { body: '#FFFDF7', belly: '#F1E7D3', edge: '#BFAE90', comb: '#D7263D', beak: '#F4A300' },
  kogut: { body: '#B5532A', belly: '#E8B07A', edge: '#73300F', comb: '#E3263B', beak: '#F4A300' },
};

/** Kura w środku (cx, cy) w pikselach, promień R w pikselach. */
export function drawHenPx(ctx, type, cx, cy, R, angle = 0, { t = 0, tired = false, fuse = true } = {}) {
  const c = HEN_LOOK[type];
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-angle);
  ctx.lineWidth = Math.max(1.5, R * 0.08);
  // ogon
  if (type === 'kogut') {
    [['#2E9E5B', -0.5], ['#2C6FBB', -0.15], ['#1E7A46', 0.2]].forEach(([col, a]) => {
      ctx.strokeStyle = col;
      ctx.lineWidth = R * 0.22;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-R * 0.7, -R * 0.1);
      ctx.quadraticCurveTo(-R * 1.4, -R * (0.8 + a), -R * 1.25, R * (0.1 + a));
      ctx.stroke();
    });
    ctx.lineWidth = Math.max(1.5, R * 0.08);
  } else if (type !== 'pisklaki') {
    ctx.fillStyle = c.edge;
    ctx.beginPath();
    ctx.moveTo(-R * 0.75, -R * 0.15);
    ctx.lineTo(-R * 1.25, -R * 0.55);
    ctx.lineTo(-R * 1.05, -R * 0.05);
    ctx.lineTo(-R * 1.3, R * 0.15);
    ctx.lineTo(-R * 0.8, R * 0.25);
    ctx.fill();
  }
  // grzebień
  if (c.comb && type !== 'rakieta') {
    ctx.fillStyle = c.comb;
    const k = type === 'kogut' ? 1.35 : 1;
    ctx.beginPath();
    ctx.arc(-R * 0.15, -R * 0.95, R * 0.2 * k, 0, Math.PI * 2);
    ctx.arc(R * 0.12, -R * 1.02 * (k > 1 ? 1.08 : 1), R * 0.24 * k, 0, Math.PI * 2);
    ctx.arc(R * 0.38, -R * 0.9, R * 0.18 * k, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'rakieta') {
    ctx.fillStyle = c.comb;
    ctx.beginPath();
    ctx.moveTo(R * 0.3, -R * 0.85);
    ctx.lineTo(-R * 0.9, -R * 1.25);
    ctx.lineTo(-R * 0.3, -R * 0.75);
    ctx.lineTo(-R * 1.0, -R * 0.85);
    ctx.lineTo(-R * 0.1, -R * 0.6);
    ctx.fill();
  } else if (type === 'pisklaki') {
    ctx.strokeStyle = c.edge;
    ctx.lineWidth = Math.max(1.5, R * 0.12);
    ctx.beginPath();
    ctx.moveTo(-R * 0.1, -R * 0.95);
    ctx.quadraticCurveTo(-R * 0.05, -R * 1.35, R * 0.25, -R * 1.2);
    ctx.stroke();
    ctx.lineWidth = Math.max(1.5, R * 0.08);
  }
  // tułów
  const g = ctx.createRadialGradient(-R * 0.35, -R * 0.4, R * 0.1, 0, 0, R);
  g.addColorStop(0, shade(c.body, 30));
  g.addColorStop(1, c.body);
  ctx.fillStyle = g;
  ctx.strokeStyle = c.edge;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = c.belly;
  ctx.beginPath();
  ctx.ellipse(R * 0.18, R * 0.42, R * 0.58, R * 0.42, -0.2, 0, Math.PI * 2);
  ctx.fill();
  // skrzydło
  ctx.fillStyle = shade(c.body, -18);
  ctx.beginPath();
  ctx.ellipse(-R * 0.3, R * 0.15, R * 0.42, R * 0.26, 0.5, 0, Math.PI * 2);
  ctx.fill();
  // oczy i groźne brwi
  [[R * 0.22, -R * 0.28], [R * 0.58, -R * 0.24]].forEach(([ex, ey], i) => {
    ctx.fillStyle = type === 'bomba' ? '#F2F2F2' : '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(ex, ey, R * 0.2, tired ? R * 0.05 : R * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    if (!tired) {
      ctx.fillStyle = '#15201C';
      ctx.beginPath();
      ctx.arc(ex + R * 0.07, ey + R * 0.02, R * 0.09, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = type === 'bomba' ? '#7C1414' : '#2A1206';
    ctx.lineWidth = Math.max(2, R * 0.12);
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (i === 0) {
      ctx.moveTo(ex - R * 0.2, ey - R * 0.3);
      ctx.lineTo(ex + R * 0.18, ey - R * 0.18);
    } else {
      ctx.moveTo(ex - R * 0.16, ey - R * 0.18);
      ctx.lineTo(ex + R * 0.2, ey - R * 0.32);
    }
    ctx.stroke();
  });
  // dziób i korale
  ctx.fillStyle = c.beak;
  ctx.beginPath();
  ctx.moveTo(R * 0.72, -R * 0.08);
  ctx.lineTo(R * 1.22, R * 0.04);
  ctx.lineTo(R * 0.72, R * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = shade(c.beak, -40);
  ctx.lineWidth = Math.max(1, R * 0.05);
  ctx.beginPath();
  ctx.moveTo(R * 0.74, R * 0.06);
  ctx.lineTo(R * 1.15, R * 0.05);
  ctx.stroke();
  if (type !== 'pisklaki') {
    ctx.fillStyle = '#E3263B';
    ctx.beginPath();
    ctx.ellipse(R * 0.8, R * 0.34, R * 0.1, R * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (type === 'bomba' && fuse) {
    ctx.strokeStyle = '#6B4B2A';
    ctx.lineWidth = Math.max(2, R * 0.1);
    ctx.beginPath();
    ctx.moveTo(-R * 0.45, -R * 0.82);
    ctx.quadraticCurveTo(-R * 0.75, -R * 1.25, -R * 0.55, -R * 1.45);
    ctx.stroke();
    const f = 0.7 + Math.sin(t * 30) * 0.3;
    ctx.fillStyle = '#FFB000';
    ctx.beginPath();
    ctx.arc(-R * 0.55, -R * 1.48, R * 0.16 * f, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFF3B0';
    ctx.beginPath();
    ctx.arc(-R * 0.55, -R * 1.48, R * 0.07 * f, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawHen(ctx, type, x, y, r, angle, opts) {
  drawHenPx(ctx, type, px(x), py(y), r * cam.s, angle, opts);
}

/** Wybuchowe jajko Nioski. */
export function drawEggBomb(ctx, x, y, angle, t) {
  ctx.save();
  ctx.translate(px(x), py(y));
  ctx.rotate(-angle);
  eggOutline(ctx, 0.3);
  ctx.fillStyle = '#FFFDF7';
  ctx.fill();
  ctx.strokeStyle = '#C9B89A';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#D7263D';
  ctx.fillRect(-0.24 * cam.s, -0.06 * cam.s, 0.48 * cam.s, 0.12 * cam.s);
  ctx.fillStyle = Math.sin(t * 40) > 0 ? '#FFB000' : '#FFF3B0';
  ctx.beginPath();
  ctx.arc(0, -0.42 * cam.s, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}

/* ---------- Proca ---------- */

const FORK_L = { x: 2.93, y: 2.88 };
const FORK_R = { x: 3.48, y: 2.88 };

export function drawSlingBack(ctx, hen) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#7A4D24';
  ctx.lineWidth = 0.26 * cam.s;
  ctx.beginPath();
  ctx.moveTo(px(3.2), py(1.6));
  ctx.lineTo(px(FORK_R.x), py(FORK_R.y));
  ctx.stroke();
  ctx.strokeStyle = '#8A5A2B';
  ctx.lineWidth = 0.34 * cam.s;
  ctx.beginPath();
  ctx.moveTo(px(3.2), py(0));
  ctx.lineTo(px(3.2), py(1.7));
  ctx.stroke();
  if (hen) band(ctx, FORK_R, hen);
}

export function drawSlingFront(ctx, hen) {
  if (hen) band(ctx, FORK_L, hen);
  else {
    ctx.strokeStyle = '#3D2410';
    ctx.lineWidth = 0.1 * cam.s;
    ctx.beginPath();
    ctx.moveTo(px(FORK_L.x), py(FORK_L.y - 0.05));
    ctx.quadraticCurveTo(px(3.2), py(2.7), px(FORK_R.x), py(FORK_R.y - 0.05));
    ctx.stroke();
  }
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#8A5A2B';
  ctx.lineWidth = 0.26 * cam.s;
  ctx.beginPath();
  ctx.moveTo(px(3.2), py(1.6));
  ctx.lineTo(px(FORK_L.x), py(FORK_L.y));
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.18)';
  ctx.lineWidth = 0.08 * cam.s;
  ctx.beginPath();
  ctx.moveTo(px(3.14), py(0.1));
  ctx.lineTo(px(3.14), py(1.6));
  ctx.stroke();
}

function band(ctx, fork, hen) {
  ctx.strokeStyle = '#3D2410';
  ctx.lineWidth = 0.13 * cam.s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(px(fork.x), py(fork.y - 0.05));
  const back = 0.6 * hen.r;
  const dx = hen.x - ANCHOR.x;
  const dy = hen.y - ANCHOR.y;
  const l = Math.hypot(dx, dy) || 1;
  ctx.lineTo(px(hen.x + (dx / l) * back), py(hen.y + (dy / l) * back));
  ctx.stroke();
}

/* ---------- Efekty ---------- */

export function drawParticles(ctx, parts) {
  for (const p of parts) {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.max)) * (p.alpha ?? 1);
    ctx.fillStyle = p.color;
    if (p.shape === 'ring') {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 6 * (p.life / p.max);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.stroke();
    } else if (p.shape === 'rect') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillRect(-p.size, -p.size * 0.4, p.size * 2, p.size * 0.8);
      ctx.restore();
    } else if (p.shape === 'feather') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.38, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

export function drawPopups(ctx, pops) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const p of pops) {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.5));
    ctx.font = `800 ${p.size || 26}px Unbounded, system-ui, sans-serif`;
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(21,32,28,.75)';
    ctx.strokeText(p.text, p.x, p.y);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, p.x, p.y);
  }
  ctx.globalAlpha = 1;
}
