/* Jajo: nocne ślady na forum. Po ciemku da się znaleźć włącznik, a po zapaleniu światła widać napis na ścianie. */
import { t, step, advance, whenSynced, savedText, staticNoise } from './rdzen.js';

const $ = (sel, root = document) => root.querySelector(sel);
const root = document.documentElement;
const media = window.matchMedia('(prefers-color-scheme: dark)');
const isDark = () => (root.dataset.theme ? root.dataset.theme === 'dark' : media.matches);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

let wall = null;
let sw = null;
let lit = false;
let checked = false;

function build() {
  const head = $('#forumList .forum-head');
  const footer = $('.footer .footer-grid');
  if (!head || !footer) return false;
  wall = document.createElement('div');
  wall.className = 'noc-wall';
  wall.setAttribute('aria-hidden', 'true');
  wall.innerHTML = `${t('sciana').map((line) => `<p>${esc(line)}</p>`).join('')}<p class="noc-wall-saved"></p>`;
  head.after(wall);
  sw = document.createElement('button');
  sw.type = 'button';
  sw.className = 'noc-switch';
  sw.setAttribute('aria-label', 'Włącznik światła');
  sw.innerHTML = '<svg viewBox="0 0 24 36" aria-hidden="true"><rect x="1" y="1" width="22" height="34" rx="3"/><rect class="noc-switch-key" x="8" y="9" width="8" height="18" rx="2"/></svg>';
  footer.appendChild(sw);
  sw.addEventListener('click', lightOn);
  return true;
}

// Dźwięk jarzeniówki: trzask i krótkie brzęczenie.
function buzz() {
  staticNoise(0.18, 0.1);
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'sawtooth';
    o.frequency.value = 100;
    g.gain.setValueAtTime(0.0001, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.03, ac.currentTime + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 1.4);
    o.connect(g).connect(ac.destination);
    o.start();
    o.stop(ac.currentTime + 1.5);
    setTimeout(() => ac.close(), 1800);
  } catch {
    /* dźwięk niedostępny */
  }
}

async function lightOn() {
  if (lit) return;
  lit = true;
  buzz();
  // Światło zapala się jak jarzeniówka: kilka mrugnięć i jasno. Motyw zmienia się tylko na chwilę (bez zapisu).
  root.classList.add('noc-lit', 'noc-flicker');
  root.dataset.theme = 'light';
  setTimeout(() => root.classList.remove('noc-flicker'), 1300);
  const res = await advance(3);
  if (res && wall) $('.noc-wall-saved', wall).textContent = savedText();
}

async function sync() {
  const dark = isDark();
  if (lit && dark) {
    // Ktoś zgasił światło z powrotem.
    lit = false;
    root.classList.remove('noc-lit');
  }
  if (!dark && !lit) {
    if (sw) sw.hidden = true;
    return;
  }
  if (step() < 2 && !checked) {
    checked = true;
    await whenSynced();
  }
  if (step() < 2) return;
  if (!wall && !build()) return;
  sw.hidden = lit;
}

new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
media.addEventListener('change', sync);
sync();
