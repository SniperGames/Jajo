/* Jajo: gra „Pary pisanek”. Odkrywasz karty i szukasz par takich samych pisanek. */
import { sfx } from './wspolne.js';

const EGG = 'M30 3C45 3 54 27 54 48c0 16.5-10.5 27-24 27S6 64.5 6 48C6 27 15 3 30 3z';

// Osiem wzorów pisanek: kolor tła i wzór (rysowany w obrysie jajka).
const DESIGNS = [
  { name: 'czerwona w zygzaki', base: '#D7263D', art: () => [22, 40, 58].map((y) => `<path d="M2 ${y}l8-7 8 7 8-7 8 7 8-7 8 7 8-7" fill="none" stroke="#FFF6E8" stroke-width="3.5"/>`).join('') },
  { name: 'niebieska w kropki', base: '#2C6FBB', art: () => [[18, 22], [34, 18], [42, 34], [24, 38], [16, 54], [34, 52], [46, 60], [28, 66]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.2" fill="#FFD23F"/>`).join('') },
  { name: 'zielona w fale', base: '#2E9E5B', art: () => [24, 40, 56].map((y) => `<path d="M0 ${y}q7.5-8 15 0t15 0 15 0 15 0" fill="none" stroke="#FFF6E8" stroke-width="3.5"/>`).join('') },
  { name: 'żółta w romby', base: '#F4B400', art: () => `<path d="M0 46h60" stroke="#C0392B" stroke-width="3"/>${[6, 18, 30, 42, 54].map((x) => `<path d="M${x} 38l6 8-6 8-6-8z" fill="#C0392B"/>`).join('')}<path d="M0 26h60M0 66h60" stroke="#C0392B" stroke-width="2.5"/>` },
  { name: 'fioletowa w gwiazdki', base: '#7C4DBE', art: () => [[20, 24], [40, 30], [28, 46], [16, 60], [44, 58]].map(([x, y]) => `<path d="M${x} ${y - 7}l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#FFF6E8"/>`).join('') },
  { name: 'pomarańczowa w kratkę', base: '#F07F2E', art: () => `<g fill="#15201C" opacity=".8">${Array.from({ length: 6 }, (_, i) => `<rect x="${i * 10}" y="${i % 2 ? 40 : 46}" width="10" height="6"/>`).join('')}</g><path d="M0 34h60M0 58h60" stroke="#FFF6E8" stroke-width="3"/>` },
  { name: 'turkusowa w kwiatki', base: '#1BA3A3', art: () => [[22, 26], [38, 44], [22, 60]].map(([x, y]) => `<g fill="#FFF6E8">${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="${x}" cy="${y - 6}" rx="3" ry="5.5" transform="rotate(${a} ${x} ${y})"/>`).join('')}<circle cx="${x}" cy="${y}" r="3" fill="#FFD23F"/></g>`).join('') },
  { name: 'różowa w paski', base: '#E85D9A', art: () => `<path d="M0 22h60M0 34h60M0 46h60M0 58h60M0 70h60" stroke="#FFF6E8" stroke-width="2.5"/><path d="M0 28h60M0 52h60" stroke="#7A1E48" stroke-width="2"/>` },
];

function pisanka(i, uid) {
  const d = DESIGNS[i];
  return `
    <svg viewBox="0 0 60 78" aria-hidden="true">
      <defs><clipPath id="${uid}"><path d="${EGG}"/></clipPath></defs>
      <g clip-path="url(#${uid})"><rect width="60" height="78" fill="${d.base}"/>${d.art()}</g>
      <path d="${EGG}" fill="none" stroke="rgba(21,32,28,.35)" stroke-width="2.5"/>
      <ellipse cx="21" cy="24" rx="4" ry="7" fill="#fff" opacity=".45" transform="rotate(-20 21 24)"/>
    </svg>`;
}

export const howto = `
  <p>Odkrywaj po dwie karty. Gdy pisanki są takie same, para zostaje odkryta. Znajdź wszystkie osiem par.</p>
  <p>Punkty: 1000 za ułożenie, do 900 za szybkość i do 440 za małą liczbę ruchów. Licznik maleje z każdą sekundą, więc się nie ociągaj.</p>`;

export const scoreFor = (seconds, moves) => 1000 + Math.max(0, 90 - Math.floor(seconds)) * 10 + Math.max(0, 30 - moves) * 20;

export default function create(stage, api) {
  const root = document.createElement('div');
  root.className = 'gpary';
  root.innerHTML = `
    <p class="gpary-hud"><span>Czas <b data-time>0:00</b></span><span>Ruchy <b data-moves>0</b></span><span>Pary <b data-pairs>0/8</b></span></p>
    <div class="gpary-grid" role="grid" aria-label="Karty"></div>`;
  stage.prepend(root);
  const gridEl = root.querySelector('.gpary-grid');
  const $ = (sel) => root.querySelector(sel);

  let state = 'idle';
  let cards = [];
  let open = [];
  let moves = 0;
  let pairs = 0;
  let started = 0;
  let elapsed = 0; // sekundy przed pauzą
  let timer = null;
  let lock = false;
  const prefix = 'pk' + Math.random().toString(36).slice(2, 7);

  const seconds = () => elapsed + (started ? (performance.now() - started) / 1000 : 0);

  function hud() {
    const s = Math.floor(seconds());
    $('[data-time]').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    $('[data-moves]').textContent = String(moves);
    $('[data-pairs]').textContent = `${pairs}/8`;
    if (state === 'play') api.onScore(scoreFor(seconds(), moves));
  }

  function deal(faceUp = false) {
    const order = [...Array(8).keys(), ...Array(8).keys()];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    cards = order.map((d, i) => ({ d, i, open: faceUp, done: false }));
    gridEl.innerHTML = cards.map((c) => `
      <button type="button" class="pcard${c.open ? ' is-open' : ''}" data-i="${c.i}" aria-label="Karta ${c.i + 1}, zakryta">
        <span class="pcard-in">
          <span class="pcard-back" aria-hidden="true"></span>
          <span class="pcard-face">${pisanka(c.d, `${prefix}-${c.i}`)}</span>
        </span>
      </button>`).join('');
  }

  function flip(i) {
    if (state !== 'play' || lock) return;
    const c = cards[i];
    if (!c || c.open || c.done) return;
    if (!started && !elapsed) {
      started = performance.now();
      timer = setInterval(hud, 250);
    }
    c.open = true;
    const el = gridEl.querySelector(`[data-i="${i}"]`);
    el.classList.add('is-open');
    el.setAttribute('aria-label', `Karta ${i + 1}: pisanka ${DESIGNS[c.d].name}`);
    sfx('flip');
    open.push(c);
    if (open.length < 2) return;
    moves += 1;
    const [a, b] = open;
    open = [];
    if (a.d === b.d) {
      a.done = b.done = true;
      pairs += 1;
      [a, b].forEach((x) => gridEl.querySelector(`[data-i="${x.i}"]`).classList.add('is-done'));
      sfx('match');
      hud();
      if (pairs === 8) win();
    } else {
      lock = true;
      hud();
      setTimeout(() => {
        [a, b].forEach((x) => {
          x.open = false;
          const e = gridEl.querySelector(`[data-i="${x.i}"]`);
          if (e) {
            e.classList.remove('is-open');
            e.setAttribute('aria-label', `Karta ${x.i + 1}, zakryta`);
          }
        });
        lock = false;
      }, 750);
    }
  }

  function win() {
    const total = scoreFor(seconds(), moves);
    elapsed = seconds();
    started = 0;
    clearInterval(timer);
    state = 'over';
    api.onScore(total);
    sfx('win');
    setTimeout(() => api.onOver(total), 700);
  }

  const onClick = (e) => {
    const btn = e.target.closest('.pcard');
    if (btn) flip(Number(btn.dataset.i));
  };
  gridEl.addEventListener('click', onClick);

  deal(true); // podgląd wzorów za ekranem startowym

  return {
    start() {
      clearInterval(timer);
      moves = 0;
      pairs = 0;
      started = 0;
      elapsed = 0;
      open = [];
      lock = false;
      deal(false);
      state = 'play';
      hud();
      api.onScore(scoreFor(0, 0));
    },
    pause() {
      if (state !== 'play') return;
      state = 'paused';
      elapsed = seconds();
      started = 0;
      clearInterval(timer);
      root.classList.add('is-paused');
    },
    resume() {
      if (state !== 'paused') return;
      state = 'play';
      root.classList.remove('is-paused');
      if (elapsed) {
        started = performance.now();
        timer = setInterval(hud, 250);
      }
    },
    destroy() {
      clearInterval(timer);
      gridEl.removeEventListener('click', onClick);
      root.remove();
    },
  };
}
