/* Jajo: gra „Jajo 2048”. Łączysz takie same kafelki: z jajka w końcu wyrasta złota kura. */
import { sfx } from './wspolne.js';

const N = 4;
const SLIDE_MS = 110;

const egg = (fill, stroke, extra = '') => `
  <svg viewBox="0 0 60 78" aria-hidden="true">
    <path d="M30 3C45 3 54 27 54 48c0 16.5-10.5 27-24 27S6 64.5 6 48C6 27 15 3 30 3z" fill="${fill}" stroke="${stroke}" stroke-width="3"/>
    ${extra}
    <ellipse cx="21" cy="26" rx="4.5" ry="8" fill="#fff" opacity=".7" transform="rotate(-20 21 26)"/>
  </svg>`;
const img = (name) => `<img src="img/awatary/${name}.svg" alt="" draggable="false">`;
const CROWN = '<path d="M14 18l6 10 10-14 10 14 6-10 2 20H12z" fill="#FFE27A" stroke="#B88A00" stroke-width="2.5" stroke-linejoin="round" transform="translate(0 -14)"/>';
const GEMS = '<circle cx="30" cy="34" r="5" fill="#E04F7A"/><circle cx="20" cy="50" r="4" fill="#3FA8E0"/><circle cx="40" cy="50" r="4" fill="#3FC28A"/><path d="M10 42h40M8 58h44" stroke="#FFE27A" stroke-width="3"/>';

// Poziom i → wartość 2^(i+1)
export const LEVELS = [
  { name: 'Jajko', art: egg('#FFF6E8', '#D9B98C') },
  { name: 'Sadzone', art: img('sadzone') },
  { name: 'W kieliszku', art: img('kieliszek') },
  { name: 'Na pół', art: img('przekroj') },
  { name: 'Na patelni', art: img('patelnia') },
  { name: 'Pisanka', art: img('pisanka') },
  { name: 'Wytłaczanka', art: img('wytlaczanka') },
  { name: 'Pisklę', art: img('pisklak') },
  { name: 'Kura', art: img('kura') },
  { name: 'Złote jajo', art: egg('#FFD54A', '#B88A00') },
  { name: 'Złota kura', art: egg('#FFC93C', '#A87C00', CROWN) },
  { name: 'Jajo Fabergé', art: egg('#7C5CC4', '#4B3486', GEMS) },
];
const WIN = 10; // złota kura = 2048

const levelOf = (i) => LEVELS[Math.min(i, LEVELS.length - 1)];

export const howto = `
  <p>Przesuwaj strzałkami, klawiszami WASD albo palcem. Dwa takie same kafelki łączą się w kolejny, a Ty dostajesz tyle punktów, ile wart jest nowy kafelek.</p>
  <ol class="chain">${LEVELS.slice(0, 11).map((l, i) => `<li><span class="chain-art">${l.art}</span><span>${2 ** (i + 1)}</span></li>`).join('')}</ol>
  <p>Cel: złota kura (2048). Potem możesz grać dalej.</p>`;

export default function create(stage, api) {
  const root = document.createElement('div');
  root.className = 'g2048';
  root.innerHTML = `
    <div class="g2048-board">
      <div class="g2048-cells">${'<span></span>'.repeat(N * N)}</div>
      <div class="g2048-tiles"></div>
    </div>
    <p class="g2048-banner" hidden></p>`;
  stage.prepend(root);
  const layer = root.querySelector('.g2048-tiles');
  const banner = root.querySelector('.g2048-banner');

  let state = 'idle';
  let grid = [];
  let score = 0;
  let won = false;
  let nextId = 1;
  let pending = null; // dokończenie animacji ruchu
  let bannerTimer = null;

  function empty() {
    grid = Array.from({ length: N }, () => Array(N).fill(null));
    layer.innerHTML = '';
  }

  function tileEl(t) {
    const el = document.createElement('div');
    el.className = `t2048 lv-${Math.min(t.v, 11)}`;
    paint(el, t);
    place(el, t);
    layer.appendChild(el);
    return el;
  }

  function paint(el, t) {
    const l = levelOf(t.v);
    el.className = `t2048 lv-${Math.min(t.v, 11)}`;
    el.innerHTML = `<span class="t2048-art">${l.art}</span><b>${2 ** (t.v + 1)}</b>`;
    el.setAttribute('aria-label', `${l.name}, ${2 ** (t.v + 1)}`);
  }

  function place(el, t) {
    el.style.setProperty('--x', t.x);
    el.style.setProperty('--y', t.y);
  }

  function add(v, x, y, appear = true) {
    const t = { id: nextId++, v, x, y };
    grid[y][x] = t;
    t.el = tileEl(t);
    if (appear) t.el.classList.add('is-new');
    return t;
  }

  function spawn() {
    const free = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!grid[y][x]) free.push([x, y]);
    if (!free.length) return;
    const [x, y] = free[Math.floor(Math.random() * free.length)];
    add(Math.random() < 0.9 ? 0 : 1, x, y);
  }

  function canMove() {
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const t = grid[y][x];
        if (!t) return true;
        if (x + 1 < N && grid[y][x + 1] && grid[y][x + 1].v === t.v) return true;
        if (y + 1 < N && grid[y + 1][x] && grid[y + 1][x].v === t.v) return true;
      }
    }
    return false;
  }

  function showBanner(text) {
    banner.textContent = text;
    banner.hidden = false;
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => { banner.hidden = true; }, 2600);
  }

  function finish() {
    if (!pending) return;
    const p = pending;
    pending = null;
    clearTimeout(p.timer);
    p.dying.forEach((t) => t.el.remove());
    p.merged.forEach((t) => {
      paint(t.el, t);
      t.el.classList.remove('is-merged');
      void t.el.offsetWidth;
      t.el.classList.add('is-merged');
    });
    spawn();
    if (!won && p.merged.some((t) => t.v >= WIN)) {
      won = true;
      sfx('win');
      showBanner('Złota kura! Grasz dalej.');
    }
    if (!canMove()) {
      state = 'over';
      sfx('over');
      setTimeout(() => api.onOver(score), 500);
    }
  }

  function move(dir) {
    if (state !== 'play') return;
    finish();
    const [vx, vy] = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[dir];
    const xs = [0, 1, 2, 3];
    const ys = [0, 1, 2, 3];
    if (vx === 1) xs.reverse();
    if (vy === 1) ys.reverse();
    const merged = [];
    const dying = [];
    let moved = false;
    let gained = 0;
    const inside = (x, y) => x >= 0 && x < N && y >= 0 && y < N;
    for (const y of ys) {
      for (const x of xs) {
        const t = grid[y][x];
        if (!t) continue;
        let nx = x;
        let ny = y;
        while (inside(nx + vx, ny + vy) && !grid[ny + vy][nx + vx]) {
          nx += vx;
          ny += vy;
        }
        const next = inside(nx + vx, ny + vy) ? grid[ny + vy][nx + vx] : null;
        if (next && next.v === t.v && !merged.includes(next)) {
          grid[y][x] = null;
          t.x = next.x;
          t.y = next.y;
          next.v += 1;
          gained += 2 ** (next.v + 1);
          merged.push(next);
          dying.push(t);
          t.el.style.zIndex = '1';
          place(t.el, t);
          moved = true;
        } else if (nx !== x || ny !== y) {
          grid[y][x] = null;
          grid[ny][nx] = t;
          t.x = nx;
          t.y = ny;
          place(t.el, t);
          moved = true;
        }
      }
    }
    if (!moved) return;
    if (gained) {
      score += gained;
      api.onScore(score);
      sfx('merge');
    }
    pending = { merged, dying, timer: setTimeout(finish, SLIDE_MS) };
  }

  function demo() {
    empty();
    [[0, 0, 0], [1, 1, 0], [2, 2, 1], [3, 1, 2], [5, 3, 3], [8, 0, 3]].forEach(([v, x, y]) => add(v, x, y, false));
  }

  /* ---------- Sterowanie ---------- */

  const KEYS = {
    ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
    a: 'left', d: 'right', w: 'up', s: 'down', A: 'left', D: 'right', W: 'up', S: 'down',
  };
  const onKey = (e) => {
    const dir = KEYS[e.key];
    if (!dir || state !== 'play') return;
    e.preventDefault();
    move(dir);
  };
  let start = null;
  const onDown = (e) => {
    if (state !== 'play') return;
    start = { x: e.clientX, y: e.clientY };
    stage.setPointerCapture?.(e.pointerId);
  };
  const onUp = (e) => {
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    start = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
    move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  };
  const onCancel = () => { start = null; };
  window.addEventListener('keydown', onKey);
  stage.addEventListener('pointerdown', onDown);
  stage.addEventListener('pointerup', onUp);
  stage.addEventListener('pointercancel', onCancel);

  demo();

  return {
    start() {
      finish();
      empty();
      score = 0;
      won = false;
      banner.hidden = true;
      api.onScore(0);
      spawn();
      spawn();
      state = 'play';
    },
    pause() {
      if (state === 'play') state = 'paused';
    },
    resume() {
      if (state === 'paused') state = 'play';
    },
    destroy() {
      clearTimeout(bannerTimer);
      if (pending) clearTimeout(pending.timer);
      window.removeEventListener('keydown', onKey);
      stage.removeEventListener('pointerdown', onDown);
      stage.removeEventListener('pointerup', onUp);
      stage.removeEventListener('pointercancel', onCancel);
      root.remove();
    },
  };
}
