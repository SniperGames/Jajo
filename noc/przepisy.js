/* Jajo: nocne ślady na stronie z przepisami. Przy pustej wytłaczance pojawia się przepis, którego nie ma w spisie. */
import { t, step, advance, whenSynced, savedText } from './rdzen.js';

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const count = $('#eggCount');
const grid = $('#recipeGrid');

// Pusta, pęknięta skorupka na talerzu w ciemności.
const ART = `
  <svg class="noc-art" viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <radialGradient id="nocSpot" cx="50%" cy="58%" r="55%">
        <stop offset="0" stop-color="#3A3A33"/>
        <stop offset=".6" stop-color="#15160F"/>
        <stop offset="1" stop-color="#050504"/>
      </radialGradient>
    </defs>
    <rect width="400" height="260" fill="url(#nocSpot)"/>
    <ellipse cx="200" cy="196" rx="132" ry="30" fill="#1E1F19" stroke="#3B3C33" stroke-width="3"/>
    <ellipse cx="200" cy="192" rx="96" ry="18" fill="#262720"/>
    <path d="M150 186c0-38 22-70 50-70s50 32 50 70c-8 4-14-6-22-2s-12 10-20 6-14-8-22-4-14 8-22 4-10-6-14-4z" fill="#D9D0BC"/>
    <path d="M158 182c2-30 20-56 42-56s40 26 42 56" fill="none" stroke="#9E957F" stroke-width="2" opacity=".6"/>
    <ellipse cx="200" cy="178" rx="38" ry="10" fill="#0B0B08"/>
    <circle cx="190" cy="176" r="1.8" fill="#C0392B"/>
    <circle cx="210" cy="176" r="1.8" fill="#C0392B"/>
    <text x="356" y="40" fill="#5B5C52" font-family="JetBrains Mono, monospace" font-size="14" text-anchor="end">CAM 05</text>
  </svg>`;

let card = null;
let dialog = null;

function createCard() {
  const p = t('przepis');
  const el = document.createElement('article');
  el.className = 'rcard rcard-noc';
  el.innerHTML = `
    <div class="rcard-media">${ART}</div>
    <div class="rcard-body">
      <p class="rcard-cat">${esc(p.cat)}</p>
      <h3 class="rcard-title"><button type="button" class="rcard-link noc-open">${esc(p.name)}</button></h3>
      <p class="rcard-intro">${esc(p.intro)}</p>
      <p class="rcard-meta"><span>2:37</span><span>tylko nocą</span></p>
    </div>`;
  return el;
}

function openDialog() {
  const p = t('przepis');
  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.className = 'rdialog noc-recipe';
    dialog.setAttribute('aria-labelledby', 'nocRdTitle');
    document.body.appendChild(dialog);
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog || e.target.closest('[data-noc-close]')) dialog.close();
    });
  }
  dialog.innerHTML = `
    <div class="rd rd-nophoto">
      <div class="rd-bar"><button type="button" class="rd-close" data-noc-close aria-label="Zamknij przepis"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
      <div class="rd-content">
        <header class="rd-head">
          <p class="eyebrow">${esc(p.cat)}</p>
          <h2 class="rd-title" id="nocRdTitle" tabindex="-1">${esc(p.name)}</h2>
          <p class="rd-intro">${esc(p.intro)}</p>
        </header>
        <div class="noc-rd-body">
          <section>
            <h3>Składniki</h3>
            <ul class="noc-ing">${p.ing.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
          </section>
          <section>
            <h3>Przygotowanie</h3>
            <ol class="noc-steps">${p.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
          </section>
        </div>
        <p class="noc-rd-saved"></p>
      </div>
    </div>`;
  dialog.showModal();
  $('#nocRdTitle', dialog).focus({ preventScroll: true });
  advance(2).then((res) => {
    if (res) $('.noc-rd-saved', dialog).textContent = savedText();
  });
}

async function check() {
  const emptyCarton = count.textContent.trim() === '0';
  if (!emptyCarton) {
    if (card) card.remove();
    card = null;
    return;
  }
  if (card) return;
  if (step() < 1) await whenSynced();
  if (step() < 1 || card || count.textContent.trim() !== '0') return;
  card = createCard();
  grid.prepend(card);
}

if (count && grid) {
  new MutationObserver(check).observe(count, { childList: true, characterData: true, subtree: true });
  document.addEventListener('click', (e) => {
    if (e.target.closest('.noc-open') || (e.target.closest('.rcard-noc .rcard-media'))) openDialog();
  });
  check();
}
