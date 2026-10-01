/* Jajo: strona z przepisami */
(() => {
  'use strict';

  const RECIPES = window.JAJO_PRZEPISY || [];
  const byId = Object.fromEntries(RECIPES.map((r) => [r.id, r]));
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const NBSP = ' ';
  const SITE = 'https://snipergames.github.io/Jajo/';
  const MAX_SERVINGS = 24;
  const BASE_TITLE = document.title;

  const CATEGORIES = [
    ['wszystkie', 'Wszystkie'],
    ['sniadania', 'Śniadania'],
    ['obiady', 'Obiady'],
    ['przekaski', 'Przekąski'],
    ['desery', 'Desery'],
  ];
  const CATEGORY_ONE = { sniadania: 'Śniadanie', obiady: 'Obiad', przekaski: 'Przekąska', desery: 'Deser' };
  const DIFFICULTY = ['', 'łatwe', 'średnie', 'wymagające'];
  // Formy jednostek: 1, 2–4, 5+, ułamek (np. „½ łyżki”).
  const UNITS = {
    'łyżka': ['łyżka', 'łyżki', 'łyżek', 'łyżki'],
    'łyżeczka': ['łyżeczka', 'łyżeczki', 'łyżeczek', 'łyżeczki'],
    'szklanka': ['szklanka', 'szklanki', 'szklanek', 'szklanki'],
    'pęczek': ['pęczek', 'pęczki', 'pęczków', 'pęczka'],
    'ząbek': ['ząbek', 'ząbki', 'ząbków', 'ząbka'],
    'szczypta': ['szczypta', 'szczypty', 'szczypt', 'szczypty'],
    'plaster': ['plaster', 'plastry', 'plastrów', 'plastra'],
    'garść': ['garść', 'garście', 'garści', 'garści'],
  };

  const EGG_PATH = 'M10 1C15 1 18 9 18 16c0 5.5-3.5 9-8 9s-8-3.5-8-9C2 9 5 1 10 1z';
  const ICONS = {
    clock: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9.5 2.5h5"/></svg>',
    play: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10-6.5z"/></svg>',
    pause: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>',
    check: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    close: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  };

  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem('jajo:' + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem('jajo:' + key, JSON.stringify(value));
      } catch {
        /* pamięć przeglądarki niedostępna */
      }
    },
  };

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const num = (x) => x.toLocaleString('pl-PL', { maximumFractionDigits: 2 });

  function plural(n, one, few, many) {
    if (n === 1) return one;
    const d = n % 10;
    const h = n % 100;
    return d >= 2 && d <= 4 && (h < 12 || h > 14) ? few : many;
  }
  // Dopełniacz: „z 1 jajka”, „brakuje 5 jajek”.
  const eggsGen = (n) => (n === 1 ? 'jajka' : 'jajek');
  const servingsAcc = (n) => n + NBSP + plural(n, 'porcję', 'porcje', 'porcji');
  const servingsNom = (n) => n + NBSP + plural(n, 'porcja', 'porcje', 'porcji');

  const fmtTime = (min) => (min < 60
    ? min + NBSP + 'min'
    : Math.floor(min / 60) + NBSP + 'h' + (min % 60 ? ' ' + (min % 60) + NBSP + 'min' : ''));

  const clockText = (ms) => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = String(s % 60).padStart(2, '0');
    return h ? h + ':' + String(m).padStart(2, '0') + ':' + sec : m + ':' + sec;
  };

  /* ---------- Ilości i jajka ---------- */

  function scaleQty(item, k) {
    const x = item.q * k;
    if (item.egg) return Math.max(1, Math.ceil(x - 1e-9));
    if (item.u === 'g' || item.u === 'ml') {
      if (x >= 100) return Math.round(x / 10) * 10;
      if (x >= 20) return Math.round(x / 5) * 5;
      return Math.max(1, Math.round(x));
    }
    if (item.u === 'szczypta') return Math.max(1, Math.round(x));
    if (item.u === 'łyżka' || item.u === 'łyżeczka') return Math.max(0.25, Math.round(x * 4) / 4);
    return Math.max(0.5, Math.round(x * 2) / 2);
  }

  function fmtQty(x) {
    const whole = Math.floor(x + 1e-9);
    const frac = Math.round((x - whole) * 4) / 4;
    const glyph = { 0.25: '¼', 0.5: '½', 0.75: '¾' }[frac];
    if (!glyph) return String(whole + (frac === 1 ? 1 : 0));
    return (whole ? String(whole) : '') + glyph;
  }

  function fmtAmount(item, k) {
    if (item.t) return item.t;
    const q = scaleQty(item, k);
    if (item.u === 'ml' && q >= 1000) return num(q / 1000) + NBSP + 'l';
    if (item.u === 'g' && q >= 1000) return num(q / 1000) + NBSP + 'kg';
    const forms = UNITS[item.u];
    let unit = item.u;
    if (forms) unit = Number.isInteger(q) ? plural(q, forms[0], forms[1], forms[2]) : forms[3];
    return fmtQty(q) + NBSP + unit;
  }

  function eggParts(r, servings) {
    const k = servings / r.servings;
    const parts = { whole: 0, yolk: 0, white: 0 };
    r.ingredients.forEach((it) => {
      if (it.egg) parts[it.egg] += scaleQty(it, k);
    });
    // Żółtka i białka z tych samych jajek liczymy raz.
    parts.total = parts.whole + Math.max(parts.yolk, parts.white);
    return parts;
  }

  function servingOptions(r) {
    const step = r.step || 1;
    const out = [];
    for (let s = r.minServings || 1; s <= MAX_SERVINGS; s += step) out.push(s);
    return out;
  }

  function fit(r, eggs) {
    const opts = servingOptions(r);
    let best = null;
    opts.forEach((s) => {
      if (eggParts(r, s).total <= eggs) best = s;
    });
    return { best, need: eggParts(r, opts[0]).total };
  }

  const eggIcon = (type) => (type === 'yolk'
    ? '<svg class="ei ei-yolk" viewBox="0 0 20 26" aria-hidden="true"><circle cx="10" cy="15" r="7"/></svg>'
    : `<svg class="ei ei-${type}" viewBox="0 0 20 26" aria-hidden="true"><path d="${EGG_PATH}"/></svg>`);

  function eggIcons(p, max = 12) {
    const list = [
      ...Array(p.whole).fill('whole'),
      ...Array(p.yolk).fill('yolk'),
      ...Array(p.white).fill('white'),
    ];
    const more = list.length > max ? `<span class="ei-more">+${list.length - max}</span>` : '';
    return list.slice(0, max).map(eggIcon).join('') + more;
  }

  function eggLabel(p) {
    const bits = [];
    if (p.whole) bits.push(p.whole + ' ' + plural(p.whole, 'całe jajko', 'całe jajka', 'całych jajek'));
    if (p.yolk) bits.push(p.yolk + ' ' + plural(p.yolk, 'żółtko', 'żółtka', 'żółtek'));
    if (p.white) bits.push(p.white + ' ' + plural(p.white, 'białko', 'białka', 'białek'));
    return bits.join(', ').replace(/, ([^,]*)$/, ' i $1');
  }

  /* ---------- Stan ---------- */

  let eggs = Number(store.get('eggs', 10));
  if (!Number.isInteger(eggs) || eggs < 0 || eggs > 10) eggs = 10;
  let category = 'wszystkie';
  const progress = new Map(); // id → { servings, have: Set, done: Set }
  const timers = new Map(); // "id:krok" → { total, remaining, endAt, running, done }

  function progressFor(r) {
    if (!progress.has(r.id)) {
      let servings = r.servings;
      const f = fit(r, eggs);
      if (eggParts(r, servings).total > eggs && f.best) servings = f.best;
      progress.set(r.id, { servings, have: new Set(), done: new Set() });
    }
    return progress.get(r.id);
  }

  /* ---------- Wytłaczanka ---------- */

  const carton = $('#carton');
  const cartonFill = $('#cartonFill');
  for (let n = 1; n <= 10; n++) {
    const cup = document.createElement('button');
    cup.type = 'button';
    cup.className = 'cup';
    cup.dataset.n = String(n);
    cup.innerHTML = '<span class="cup-egg" aria-hidden="true"></span>';
    cup.addEventListener('click', () => setEggs(eggs === n ? n - 1 : n));
    carton.appendChild(cup);
  }
  cartonFill.addEventListener('click', () => setEggs(10));

  function setEggs(n) {
    eggs = n;
    store.set('eggs', n);
    renderCarton();
    renderGrid();
    if (dialog.open && currentId) renderIngredients(byId[currentId]);
  }

  function renderCarton() {
    $$('.cup', carton).forEach((cup) => {
      const n = Number(cup.dataset.n);
      cup.classList.toggle('is-full', n <= eggs);
      cup.setAttribute('aria-pressed', String(n <= eggs));
      cup.setAttribute('aria-label', n + ' ' + plural(n, 'jajko', 'jajka', 'jajek'));
    });
    $('#eggCount').textContent = String(eggs);
    $('#eggWord').textContent = plural(eggs, 'jajko', 'jajka', 'jajek');
    cartonFill.disabled = eggs === 10;
  }

  /* ---------- Filtry i karty ---------- */

  const catFilter = $('#catFilter');
  CATEGORIES.forEach(([key, label]) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.setAttribute('role', 'radio');
    chip.dataset.cat = key;
    chip.innerHTML = `${label}<span class="chip-count"></span>`;
    chip.addEventListener('click', () => {
      category = key;
      syncChips();
      renderGrid();
    });
    catFilter.appendChild(chip);
  });

  function syncChips() {
    const listed = $$('.rcard').map((card) => byId[card.dataset.id]);
    $$('.chip', catFilter).forEach((c) => {
      c.setAttribute('aria-checked', String(c.dataset.cat === category));
      const count = c.dataset.cat === 'wszystkie' ? listed.length : listed.filter((r) => r.category === c.dataset.cat).length;
      $('.chip-count', c).textContent = String(count);
    });
  }

  const grid = $('#recipeGrid');

  function mediaHtml(r) {
    if (!r.photo || !r.photo.file) return `<div class="rcard-noimg">${eggIcon('whole')}</div>`;
    return `<img src="${esc(r.photo.file)}" alt="${esc(r.name)}" width="${r.photo.w}" height="${r.photo.h}" loading="lazy" decoding="async" style="object-position:${esc(r.photo.focus || '50% 50%')}">`;
  }

  function createCard(r) {
    const p = eggParts(r, r.servings);
    const card = document.createElement('article');
    card.className = 'rcard' + (r.community ? ' rcard-community' : '');
    card.dataset.id = r.id;
    card.innerHTML = `
      <div class="rcard-media">
        ${mediaHtml(r)}
        <span class="rcard-timer" hidden></span>
        <span class="like-slot" data-like-key="${r.id}"></span>
      </div>
      <div class="rcard-body">
        <p class="rcard-cat">${CATEGORY_ONE[r.category]}${r.community ? ` · od <a class="rcard-author" href="profil.html#${esc(r.authorUid)}">${esc(r.authorName)}</a>` : ''}</p>
        <h3 class="rcard-title"><a class="rcard-link" href="#${r.id}">${esc(r.name)}</a></h3>
        <p class="rcard-intro">${esc(r.intro)}</p>
        <p class="rcard-meta">
          <span>${ICONS.clock}${fmtTime(r.time)}${r.wait ? ' + czekanie' : ''}</span>
          <span>${DIFFICULTY[r.difficulty]}</span>
        </p>
        <div class="rcard-eggs">
          <span class="ei-row" role="img" aria-label="${esc('Na ' + servingsAcc(r.servings) + ': ' + eggLabel(p))}">${eggIcons(p)}</span>
          <span class="rcard-servings">na ${servingsAcc(r.servings)}</span>
        </div>
        <p class="rcard-fit"></p>
      </div>`;
    return card;
  }

  RECIPES.forEach((r) => grid.appendChild(createCard(r)));

  function renderGrid() {
    let ok = 0;
    const cards = $$('.rcard');
    cards.forEach((card) => {
      const r = byId[card.dataset.id];
      const { best, need } = fit(r, eggs);
      const fits = best !== null;
      if (fits) ok++;
      card.hidden = category !== 'wszystkie' && r.category !== category;
      card.classList.toggle('is-short', !fits);
      $('.rcard-fit', card).textContent = fits
        ? `Z ${eggs} ${eggsGen(eggs)}: do ${best} porcji`
        : `Brakuje ${need - eggs} ${eggsGen(need - eggs)} (potrzeba ${need})`;
    });
    $('#recipeStatus').textContent = eggs === 0
      ? 'Pusta wytłaczanka. Dodaj jajka, żeby zobaczyć, co możesz ugotować.'
      : `Z ${eggs} ${eggsGen(eggs)} zrobisz ${ok} z ${cards.length} przepisów.`;
  }

  /* ---------- Okno przepisu ---------- */

  const dialog = $('#recipeDialog');
  let currentId = null;
  let pushed = false;

  function stepHtml(r, step, i) {
    const text = typeof step === 'string' ? step : step.t;
    const seconds = typeof step === 'object' && step.timer ? step.timer : 0;
    return `
      <li class="step" data-step="${i}">
        <button type="button" class="step-toggle" data-step-toggle="${i}" aria-pressed="false">
          <span class="step-num" aria-hidden="true">${i + 1}</span>
          <span class="step-text">${esc(text)}</span>
        </button>
        ${seconds ? `<button type="button" class="step-timer" data-timer="${r.id}:${i}" data-seconds="${seconds}"></button>` : ''}
      </li>`;
  }

  function renderDialog(r) {
    const photo = r.photo;
    const tip = r.tip ? `
      <aside class="rd-tip">
        <p class="rd-tip-label">${eggIcon('whole')}Wskazówka</p>
        <p>${esc(r.tip)}</p>
        ${r.link ? `<p><a href="${esc(r.link.href)}">${esc(r.link.label)} →</a></p>` : ''}
      </aside>` : '';
    let figure = '';
    if (photo && photo.file) {
      const credit = photo.source
        ? `Fot. <a href="${esc(photo.source)}" target="_blank" rel="noopener">${esc(photo.author)}</a>, <a href="${esc(photo.licenseUrl)}" target="_blank" rel="noopener license">${esc(photo.license)}</a>`
        : `Fot. ${esc(photo.author)}`;
      figure = `
        <figure class="rd-photo">
          <img src="${esc(photo.file)}" alt="${esc(r.name)}" width="${photo.w}" height="${photo.h}" style="object-position:${esc(photo.focus || '50% 50%')}">
          <figcaption>${credit}</figcaption>
        </figure>`;
    }
    const status = r.status && r.status !== 'approved'
      ? `<p class="rd-status" data-status="${esc(r.status)}">${r.status === 'pending' ? 'Czeka na akceptację moderatora. Widzisz go tylko Ty.' : 'Odrzucony' + (r.rejectReason ? ': ' + esc(r.rejectReason) : '.')}</p>`
      : '';
    dialog.innerHTML = `
      <div class="rd${figure ? '' : ' rd-nophoto'}">
        <div class="rd-bar"><button type="button" class="rd-close" data-close aria-label="Zamknij przepis">${ICONS.close}</button></div>
        ${figure}
        <div class="rd-content">
          <header class="rd-head">
            ${status}
            <p class="eyebrow">${CATEGORY_ONE[r.category]}${r.community ? ` · przepis od <a class="rd-author" href="profil.html#${esc(r.authorUid)}">${esc(r.authorName)}</a>` : ''}</p>
            <h2 class="rd-title" id="rdTitle" tabindex="-1">${esc(r.name)}</h2>
            <p class="rd-intro">${esc(r.intro)}</p>
            <dl class="rd-facts">
              <div><dt>Czas pracy</dt><dd>${fmtTime(r.time)}</dd></div>
              ${r.wait ? `<div><dt>Czekanie</dt><dd>${esc(r.wait)}</dd></div>` : ''}
              <div><dt>Trudność</dt><dd>${DIFFICULTY[r.difficulty]}</dd></div>
            </dl>
            <div class="rd-social" data-like-key="${r.id}" data-big="1"></div>
          </header>
          <div class="rd-body">
            <section class="rd-ing" aria-labelledby="rdIngTitle">
              <div class="rd-ing-head">
                <h3 id="rdIngTitle">Składniki</h3>
                <div class="stepper" role="group" aria-label="Liczba porcji">
                  <button type="button" data-serv="-1" aria-label="Mniej porcji">−</button>
                  <output id="rdServ" aria-live="polite"></output>
                  <button type="button" data-serv="1" aria-label="Więcej porcji">+</button>
                </div>
              </div>
              <div class="rd-eggs" id="rdEggs"></div>
              <ul class="ing-list" id="rdIng"></ul>
            </section>
            <section class="rd-steps" aria-labelledby="rdStepsTitle">
              <h3 id="rdStepsTitle">Przygotowanie</h3>
              <p class="rd-steps-hint">Stuknij krok, żeby go odhaczyć.</p>
              <ol class="steps">${r.steps.map((s, i) => stepHtml(r, s, i)).join('')}</ol>
              ${tip}
            </section>
          </div>
          <section class="rd-comments" id="rdComments" data-comments-key="${r.id}" aria-labelledby="rdCommentsTitle"></section>
        </div>
      </div>`;
    renderIngredients(r);
    syncSteps(r);
    syncTimers();
    document.dispatchEvent(new CustomEvent('jajo:okno', { detail: { id: r.id } }));
    if (r.loadPhoto) {
      r.loadPhoto().then((src) => {
        const img = currentId === r.id && $('.rd-photo img', dialog);
        if (img && src) img.src = src;
      }).catch(() => {});
    }
  }

  function renderIngredients(r) {
    const st = progressFor(r);
    const k = st.servings / r.servings;
    const opts = servingOptions(r);
    $('#rdServ', dialog).textContent = servingsNom(st.servings);
    $('[data-serv="-1"]', dialog).disabled = st.servings <= opts[0];
    $('[data-serv="1"]', dialog).disabled = st.servings >= opts[opts.length - 1];

    const p = eggParts(r, st.servings);
    const have = p.total > eggs
      ? `<span class="rd-eggs-warn">Masz ${eggs}, brakuje ${p.total - eggs}.</span>`
      : `<span>Masz ${eggs}, wystarczy.</span>`;
    let extra = '';
    if (p.yolk && p.white) {
      extra = 'Oddziel żółtka od białek do dwóch czystych misek.';
    } else if (p.yolk) {
      extra = `Zostaną Ci ${p.yolk} ${plural(p.yolk, 'białko', 'białka', 'białek')}. Wykorzystaj je w <a href="#pavlova">torcie Pavlova</a>.`;
    } else if (p.white) {
      extra = `Zostaną Ci ${p.white} ${plural(p.white, 'żółtko', 'żółtka', 'żółtek')}. Wykorzystaj je w <a href="#carbonara">carbonarze</a>.`;
    }
    $('#rdEggs', dialog).innerHTML = `
      <div class="ei-row ei-row-lg" role="img" aria-label="${esc(eggLabel(p))}">${eggIcons(p, 16)}</div>
      <p><b>Potrzebujesz ${p.total} ${eggsGen(p.total)}.</b> ${have}</p>
      ${extra ? `<p class="rd-eggs-extra">${extra}</p>` : ''}`;

    $('#rdIng', dialog).innerHTML = r.ingredients.map((it, i) => {
      if (it.h) return `<li class="ing-h">${esc(it.h)}</li>`;
      const on = st.have.has(i);
      return `
        <li class="ing${on ? ' is-have' : ''}">
          <label>
            <input class="ing-check" type="checkbox" data-ing="${i}"${on ? ' checked' : ''}>
            <span class="box" aria-hidden="true">${ICONS.check}</span>
            <span class="ing-name">${esc(it.n)}${it.opt ? ' <small>(opcjonalnie)</small>' : ''}</span>
            <span class="ing-q">${esc(fmtAmount(it, k))}</span>
          </label>
        </li>`;
    }).join('');
  }

  function syncSteps(r) {
    const st = progressFor(r);
    let nextMarked = false;
    $$('.step', dialog).forEach((li) => {
      const i = Number(li.dataset.step);
      const done = st.done.has(i);
      li.classList.toggle('is-done', done);
      const isNext = !done && !nextMarked;
      if (isNext) nextMarked = true;
      li.classList.toggle('is-next', isNext);
      const btn = $('.step-toggle', li);
      btn.setAttribute('aria-pressed', String(done));
      $('.step-num', li).innerHTML = done ? ICONS.check : String(i + 1);
    });
  }

  function openRecipe(id) {
    const r = byId[id];
    if (!r) return;
    currentId = id;
    renderDialog(r);
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    document.title = r.name + ' – przepisy z jajkiem – Jajo';
    $('#rdTitle', dialog).focus({ preventScroll: true });
  }

  function closeRecipe() {
    if (!dialog.open) return;
    const id = currentId;
    dialog.close();
    currentId = null;
    document.title = BASE_TITLE;
    const link = id && $(`.rcard[data-id="${id}"] .rcard-link`);
    if (link) link.focus({ preventScroll: true });
  }

  function requestClose() {
    if (pushed) {
      pushed = false;
      history.back(); // popstate zamknie okno
    } else {
      history.replaceState(null, '', location.pathname + location.search);
      closeRecipe();
    }
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const id = a.getAttribute('href').slice(1);
    if (!byId[id]) return;
    e.preventDefault();
    if (dialog.open) {
      history.replaceState(null, '', '#' + id);
    } else {
      history.pushState(null, '', '#' + id);
      pushed = true;
    }
    openRecipe(id);
  });

  window.addEventListener('popstate', () => {
    const id = location.hash.slice(1);
    pushed = false;
    if (byId[id]) openRecipe(id);
    else closeRecipe();
  });

  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    requestClose();
  });

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog || e.target.closest('[data-close]')) {
      requestClose();
      return;
    }
    const r = byId[currentId];
    if (!r) return;
    const st = progressFor(r);

    const serv = e.target.closest('[data-serv]');
    if (serv) {
      const opts = servingOptions(r);
      const idx = opts.indexOf(st.servings) + Number(serv.dataset.serv);
      st.servings = opts[Math.min(opts.length - 1, Math.max(0, idx))];
      renderIngredients(r);
      return;
    }

    const toggle = e.target.closest('[data-step-toggle]');
    if (toggle) {
      const i = Number(toggle.dataset.stepToggle);
      if (st.done.has(i)) st.done.delete(i);
      else st.done.add(i);
      syncSteps(r);
      return;
    }

    const timerBtn = e.target.closest('[data-timer]');
    if (timerBtn) {
      const t = timerFor(timerBtn.dataset.timer, Number(timerBtn.dataset.seconds));
      if (t.done) {
        t.done = false;
        t.remaining = t.total;
      } else if (t.running) {
        t.running = false;
        t.remaining = Math.max(0, t.endAt - Date.now());
      } else {
        unlockAudio();
        t.running = true;
        t.endAt = Date.now() + t.remaining;
        startTicker();
      }
      syncTimers();
    }
  });

  dialog.addEventListener('change', (e) => {
    const box = e.target.closest('[data-ing]');
    const r = byId[currentId];
    if (!box || !r) return;
    const st = progressFor(r);
    const i = Number(box.dataset.ing);
    if (box.checked) st.have.add(i);
    else st.have.delete(i);
    box.closest('.ing').classList.toggle('is-have', box.checked);
  });

  /* ---------- Minutniki w krokach ---------- */

  let ticker = null;
  let audio = null;

  function timerFor(key, seconds) {
    if (!timers.has(key)) {
      timers.set(key, { total: seconds * 1000, remaining: seconds * 1000, endAt: 0, running: false, done: false });
    }
    return timers.get(key);
  }

  function startTicker() {
    if (!ticker) ticker = setInterval(tick, 250);
  }

  function tick() {
    const now = Date.now();
    let anyRunning = false;
    timers.forEach((t, key) => {
      if (!t.running) return;
      t.remaining = Math.max(0, t.endAt - now);
      if (t.remaining === 0) {
        t.running = false;
        t.done = true;
        const [id, step] = key.split(':');
        chime();
        toast(`${byId[id].name}: krok ${Number(step) + 1} gotowy. Czas minął!`);
      } else {
        anyRunning = true;
      }
    });
    syncTimers();
    if (!anyRunning) {
      clearInterval(ticker);
      ticker = null;
    }
  }

  function syncTimers() {
    $$('[data-timer]', dialog).forEach((btn) => {
      const t = timers.get(btn.dataset.timer);
      const total = Number(btn.dataset.seconds) * 1000;
      btn.classList.remove('is-running', 'is-paused', 'is-done');
      if (!t || (!t.running && !t.done && t.remaining === t.total)) {
        btn.innerHTML = `${ICONS.clock}Minutnik ${clockText(total)}`;
        btn.setAttribute('aria-label', 'Włącz minutnik na ' + clockText(total));
      } else if (t.done) {
        btn.classList.add('is-done');
        btn.innerHTML = `${ICONS.check}Gotowe`;
        btn.setAttribute('aria-label', 'Czas minął. Stuknij, żeby wyzerować minutnik.');
      } else if (t.running) {
        btn.classList.add('is-running');
        btn.innerHTML = `${ICONS.pause}${clockText(t.remaining)}`;
        btn.setAttribute('aria-label', 'Zatrzymaj minutnik, zostało ' + clockText(t.remaining));
      } else {
        btn.classList.add('is-paused');
        btn.innerHTML = `${ICONS.play}${clockText(t.remaining)}`;
        btn.setAttribute('aria-label', 'Wznów minutnik, zostało ' + clockText(t.remaining));
      }
    });

    // Odliczanie widać też na karcie, gdy okno jest zamknięte.
    $$('.rcard').forEach((card) => {
      const badge = $('.rcard-timer', card);
      let soonest = null;
      timers.forEach((t, key) => {
        if (t.running && key.startsWith(card.dataset.id + ':') && (soonest === null || t.remaining < soonest)) soonest = t.remaining;
      });
      badge.hidden = soonest === null;
      if (soonest !== null) badge.innerHTML = `${ICONS.clock}${clockText(soonest)}`;
    });
  }

  function unlockAudio() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!audio && Ctx) audio = new Ctx();
      if (audio && audio.state === 'suspended') audio.resume();
    } catch {
      audio = null;
    }
  }

  function chime() {
    if (!audio) return;
    try {
      const t0 = audio.currentTime + 0.05;
      [0, 0.32, 0.64].forEach((dt, i) => {
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.type = 'sine';
        osc.frequency.value = i === 2 ? 1320 : 880;
        gain.gain.setValueAtTime(0.0001, t0 + dt);
        gain.gain.exponentialRampToValueAtTime(0.3, t0 + dt + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.28);
        osc.connect(gain).connect(audio.destination);
        osc.start(t0 + dt);
        osc.stop(t0 + dt + 0.3);
      });
    } catch {
      /* bez dźwięku */
    }
  }

  /* ---------- Komunikat ---------- */

  const toastEl = $('#toast');
  const popoverOk = typeof toastEl.showPopover === 'function';
  if (popoverOk) {
    toastEl.setAttribute('popover', 'manual');
    toastEl.hidden = false;
  }
  let toastTimer = null;

  function toast(text) {
    toastEl.textContent = text;
    if (popoverOk) {
      // Ponowne otwarcie stawia komunikat nad oknem przepisu.
      if (toastEl.matches(':popover-open')) toastEl.hidePopover();
      toastEl.showPopover();
    } else {
      toastEl.hidden = false;
    }
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      if (popoverOk) toastEl.hidePopover();
      else toastEl.hidden = true;
    }, 7000);
  }

  /* ---------- Autorzy zdjęć ---------- */

  $('#credits').innerHTML = RECIPES.map((r) => `
    <li>
      <a class="credit-recipe" href="#${r.id}">${esc(r.name)}</a>
      <span>Fot. <a href="${esc(r.photo.source)}" target="_blank" rel="noopener">${esc(r.photo.author)}</a>, <a href="${esc(r.photo.licenseUrl)}" target="_blank" rel="noopener license">${esc(r.photo.license)}</a></span>
    </li>`).join('');

  /* ---------- Dane strukturalne dla wyszukiwarek ---------- */

  const ld = document.createElement('script');
  ld.type = 'application/ld+json';
  ld.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': RECIPES.map((r) => ({
      '@type': 'Recipe',
      name: r.name,
      description: r.intro,
      image: [SITE + r.photo.file],
      author: { '@type': 'Organization', name: 'Jajo' },
      recipeCategory: CATEGORY_ONE[r.category],
      recipeYield: servingsNom(r.servings).replace(NBSP, ' '),
      totalTime: 'PT' + r.time + 'M',
      keywords: 'jajka, przepis z jajkiem',
      url: SITE + 'przepisy.html#' + r.id,
      recipeIngredient: r.ingredients.filter((it) => !it.h).map((it) => (it.n + ': ' + fmtAmount(it, 1)).replace(/ /g, ' ')),
      recipeInstructions: r.steps.map((s) => ({ '@type': 'HowToStep', text: typeof s === 'string' ? s : s.t })),
    })),
  });
  document.head.appendChild(ld);

  /* ---------- Start ---------- */

  $$('.ei-slot').forEach((slot) => {
    slot.outerHTML = eggIcon(slot.dataset.egg);
  });
  syncChips();
  renderCarton();
  renderGrid();
  if (byId[location.hash.slice(1)]) openRecipe(location.hash.slice(1));

  // Interfejs dla spolecznosc.js: przepisy czytelników używają tych samych kart i okna.
  window.JAJO_PRZEPISY_API = {
    setCommunity(list, container) {
      $$('.rcard-community').forEach((card) => {
        delete byId[card.dataset.id];
        card.remove();
      });
      list.forEach((r) => {
        byId[r.id] = r;
        container.appendChild(createCard(r));
      });
      syncChips();
      renderGrid();
      document.dispatchEvent(new CustomEvent('jajo:karty'));
      const id = location.hash.slice(1);
      if (byId[id] && !dialog.open) openRecipe(id);
    },
    preview(r) {
      byId[r.id] = r;
      progress.delete(r.id);
      if (!dialog.open) {
        history.pushState(null, '', '#' + r.id);
        pushed = true;
      } else {
        history.replaceState(null, '', '#' + r.id);
      }
      openRecipe(r.id);
    },
    eggParts,
    eggIcon,
    eggIcons,
    eggLabel,
    plural,
    esc,
    CATEGORY_ONE,
  };
  document.dispatchEvent(new CustomEvent('jajo:przepisy-gotowe'));
})();
