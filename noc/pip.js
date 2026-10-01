/* Jajo: strona gry „Pip wraca do domu”. Otwiera się dopiero po rozwiązaniu wszystkich nocnych zagadek. */
import { step, get, whenSynced, setStage, advance, savedText, savedOnAccount, corrupt, onChange } from './rdzen.js';
import { STAGES } from './pip-swiat.js';
import { createPip } from './pip-gra.js';
import { isMuted, setMuted } from '../gry/wspolne.js';

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const BASE_TITLE = 'Pip wraca do domu – Jajo';
const LEDE = [
  'Pip zgubił drogę do domu. Pomóż mu wrócić, zanim zrobi się całkiem ciemno.',
  'Robi się późno. Pip słyszy coś za sobą.',
  'W lesie jest ciemno. Nie patrz między drzewa.',
  'To nie jest dom. To kuchnia. Czyja?',
  'Sala nr 5. Godzina 02:37. Kamera nagrywa.',
];
const INTRO = [
  'Skacz przez płotki i dziury. W powietrzu możesz machnąć skrzydełkami jeszcze raz.',
  'Słońce zachodzi szybciej niż zwykle.',
  'Pod gałęziami, które wiszą nisko, przejdź bez skakania.',
  'Nie dotykaj noży.',
  'Nie oglądaj się.',
];

const stageEl = $('#pipStage');
const overlay = $('#pipOverlay');
const frame = $('#pipFrame');
let game = null;
let current = 0;
let playing = false;

/* ---------- Ekrany na planszy ---------- */

function show(html, kind = '') {
  overlay.dataset.kind = kind;
  overlay.innerHTML = `<div class="pip-card">${html}</div>`;
  overlay.hidden = false;
  const first = $('[data-primary]', overlay) || $('button, a', overlay);
  if (first) first.focus({ preventScroll: true });
}

function hide() {
  overlay.hidden = true;
  overlay.innerHTML = '';
  overlay.dataset.kind = '';
}

const stageName = (i) => (i >= 2 ? corrupt(STAGES[i].name, 0.08 + i * 0.06) : STAGES[i].name);

function showMenu() {
  const st = get();
  if (st.etap >= STAGES.length) {
    show(`
      <p class="pip-kicker">Koniec nagrania</p>
      <h2>Pip wrócił… chyba.</h2>
      <p>Kamera nr 5 coś nagrała o&nbsp;02:37.</p>
      <div class="pip-actions">
        ${st.klucz ? '<a class="btn btn-primary" href="cam05.html" data-primary>● Kamera 05</a>' : ''}
        <button type="button" class="btn btn-ghost" data-act="stage" data-i="0">Zagraj od początku</button>
      </div>`, 'menu');
    return;
  }
  const i = st.etap;
  show(`
    <p class="pip-kicker">Etap ${i + 1} z ${STAGES.length}</p>
    <h2>${esc(stageName(i))}</h2>
    <p>${esc(INTRO[i])}</p>
    <div class="pip-actions">
      <button type="button" class="btn btn-primary" data-act="stage" data-i="${i}" data-primary>${i ? 'Graj dalej' : 'Graj'}</button>
    </div>`, 'menu');
}

function renderStages() {
  const st = get();
  $('#pipStages').innerHTML = STAGES.map((s, i) => {
    const open = i <= st.etap && i < STAGES.length;
    const done = i < st.etap;
    return `<li><button type="button" class="pip-stage-btn${done ? ' is-done' : ''}" data-act="stage" data-i="${i}"${open ? '' : ' disabled'}>
      <span class="pip-stage-n">${i + 1}</span><span>${esc(open ? stageName(i) : '???')}</span>${done ? '<span class="pip-stage-ok" aria-label="ukończony">✓</span>' : ''}
    </button></li>`;
  }).join('');
}

/* ---------- Gra ---------- */

function applyMood(i) {
  document.body.dataset.pipStage = String(i);
  document.title = i ? corrupt(BASE_TITLE, i * 0.1) : BASE_TITLE;
  $('#pipTitle').textContent = i >= 2 ? corrupt('Pip wraca do domu', i * 0.08) : 'Pip wraca do domu';
  $('#pipLede').textContent = LEDE[i];
  $('#pipKicker').textContent = i >= 3 ? '02:37' : '???';
}

function play(i) {
  current = i;
  hide();
  applyMood(i);
  if (!game) {
    game = createPip(stageEl, {
      onStage(n) {
        applyMood(n);
      },
      onStageDone,
      onFinale,
    });
    game.setMuted(isMuted());
  }
  playing = true;
  game.start(i, false);
  stageEl.focus({ preventScroll: true });
}

function onStageDone(i) {
  setStage(i + 1);
  renderStages();
  playing = false;
  const next = i + 1;
  show(`
    <p class="pip-kicker">Etap ${i + 1} ukończony</p>
    <h2>${esc(next >= 3 ? corrupt('Dalej?', 0.3) : 'Dalej!')}</h2>
    <p>Następny etap: <b>${esc(stageName(next))}</b>. ${esc(INTRO[next])}</p>
    <div class="pip-actions">
      <button type="button" class="btn btn-primary" data-act="stage" data-i="${next}" data-primary>Dalej</button>
      <button type="button" class="btn btn-ghost" data-act="stage" data-i="${i}">Jeszcze raz ten etap</button>
    </div>
    <p class="pip-small">${esc(savedText().replace('Ślad', 'Postęp'))}</p>`, 'done');
}

async function onFinale() {
  playing = false;
  setStage(STAGES.length);
  renderStages();
  await advance(8);
  document.body.dataset.pipStage = 'koniec';
  document.title = 'KAMERA 05';
  const st = get();
  show(`
    <p class="pip-kicker pip-red">● Sygnał odzyskany</p>
    <h2>KAMERA 05 · SALA</h2>
    <p>Coś nagrało się 28.10.2023 o&nbsp;02:37:21.</p>
    <div class="pip-actions">
      ${st.klucz ? '<a class="btn btn-primary" href="cam05.html" data-primary>Połącz z kamerą</a>' : '<p>Brakuje klucza do nagrania. Rozwiąż jeszcze raz zagadkę z&nbsp;kodem ze skorupki.</p>'}
    </div>
    <p class="pip-small">${savedOnAccount() ? 'Nagranie zapisane na Twoim koncie.' : 'Nagranie zapisane w tej przeglądarce. Zaloguj się, żeby go nie zgubić.'}</p>`, 'final');
}

function pause() {
  if (!game || !playing || overlay.dataset.kind) return;
  game.pause();
  show(`
    <h2>Pauza</h2>
    <p>Etap ${current + 1}: ${esc(stageName(current))}</p>
    <div class="pip-actions">
      <button type="button" class="btn btn-primary" data-act="resume" data-primary>Wznów</button>
      <button type="button" class="btn btn-ghost" data-act="stage" data-i="${current}">Od początku etapu</button>
    </div>`, 'pause');
}

/* ---------- Zdarzenia ---------- */

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  if (act === 'stage') {
    const i = Number(el.dataset.i);
    if (i <= get().etap) play(i);
  } else if (act === 'resume') {
    hide();
    game.resume();
  } else if (act === 'pause') {
    pause();
  } else if (act === 'sound') {
    setMuted(!isMuted());
    if (game) game.setMuted(isMuted());
    el.setAttribute('aria-pressed', String(!isMuted()));
    el.classList.toggle('is-muted', isMuted());
  } else if (act === 'full') {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else frame.requestFullscreen().catch(() => {});
  }
});

window.addEventListener('keydown', (e) => {
  if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && playing && !overlay.dataset.kind) {
    e.preventDefault();
    pause();
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause();
});

(async function init() {
  if (step() < 7) await whenSynced();
  if (step() < 7) {
    $('#pipLocked').hidden = false;
    $('.pip-head').hidden = true;
    document.title = 'Jajo';
    return;
  }
  $('#pipGame').hidden = false;
  const sound = $('[data-act="sound"]');
  sound.setAttribute('aria-pressed', String(!isMuted()));
  sound.classList.toggle('is-muted', isMuted());
  if (document.fullscreenEnabled && frame.requestFullscreen) $('[data-act="full"]').hidden = false;
  applyMood(Math.min(get().etap, STAGES.length - 1));
  renderStages();
  showMenu();
  // Postęp z konta mógł dojść później (inne urządzenie).
  onChange(() => {
    renderStages();
    if (!playing && overlay.dataset.kind === 'menu') showMenu();
  });
})();
