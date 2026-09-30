/* Jajo: interakcje strony */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const NBSP = ' ';

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
        /* pamięć przeglądarki niedostępna: strona działa dalej bez niej */
      }
    },
  };

  const num = (value, digits = 0) =>
    value.toLocaleString('pl-PL', { minimumFractionDigits: digits, maximumFractionDigits: digits });

  // WebKit nie ma ::range-progress, więc wypełnienie toru liczymy sami.
  const paintRange = (input) => {
    const p = ((input.value - input.min) / (input.max - input.min)) * 100;
    input.style.setProperty('--p', p + '%');
  };
  $$('input[type="range"]').forEach((input) => {
    paintRange(input);
    input.addEventListener('input', () => paintRange(input));
  });

  /* ---------- Motyw ---------- */
  (function theme() {
    const btn = $('#themeBtn');
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const saved = store.get('theme', null);
    if (saved === 'light' || saved === 'dark') root.dataset.theme = saved;

    const isDark = () => (root.dataset.theme ? root.dataset.theme === 'dark' : media.matches);
    const sync = () => {
      const dark = isDark();
      btn.dataset.mode = dark ? 'dark' : 'light';
      btn.setAttribute('aria-label', dark ? 'Włącz jasny motyw' : 'Włącz ciemny motyw');
    };

    btn.addEventListener('click', () => {
      const next = isDark() ? 'light' : 'dark';
      root.dataset.theme = next;
      store.set('theme', next);
      sync();
    });
    media.addEventListener('change', sync);
    new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    sync();
  })();

  /* ---------- Jajko w nagłówku ---------- */
  (function heroEgg() {
    const egg = $('#heroEgg');
    const hint = $('#eggHint');
    const HINTS = [
      'Stuknij w' + NBSP + '„o”. Coś tam siedzi.',
      'Puk, puk. Coś się poruszyło.',
      'Pęka!',
      'Jeszcze jedno stuknięcie…',
      'Cip, cip! Stuknij, żeby schować pisklę.',
    ];
    let stage = 0;

    egg.addEventListener('click', () => {
      stage = (stage + 1) % HINTS.length;
      egg.dataset.stage = String(stage);
      hint.textContent = HINTS[stage];
      egg.setAttribute('aria-label', stage === 4 ? 'Schowaj pisklę' : 'Stuknij jajko');
      if (stage !== 0 && !reduceMotion.matches) {
        egg.classList.remove('is-wobbling');
        void egg.offsetWidth; // restart animacji
        egg.classList.add('is-wobbling');
      }
    });
    egg.addEventListener('animationend', (e) => {
      if (e.animationName === 'egg-wobble') egg.classList.remove('is-wobbling');
    });
  })();

  /* ---------- Minutnik ---------- */
  (function timer() {
    const form = $('#timerForm');
    const fields = $('#timerFields');
    const altitude = $('#altitude');
    const yolk = $('#yolk');
    const altOut = $('#altOut');
    const boilOut = $('#boilOut');
    const yolkOut = $('#yolkOut');
    const doneness = $('#doneness');
    const core = $('#xsCore');
    const gloss = $('#xsGloss');
    const card = $('#timerCard');
    const clock = $('#clock');
    const bar = $('#progressBar');
    const msg = $('#timerMsg');
    const startBtn = $('#startBtn');
    const resetBtn = $('#resetBtn');
    const presets = $$('[data-yolk]');

    // Typowa masa jajka w każdej klasie wagowej UE (g).
    const MASS_G = { S: 50, M: 58, L: 68, XL: 76 };
    const PLACES = [
      [0, 'Gdańsk'], [100, 'Warszawa'], [219, 'Kraków'], [838, 'Zakopane'],
      [1603, 'Śnieżka'], [1987, 'Kasprowy Wierch'], [2499, 'Rysy'],
    ];
    // Stałe z modelu Williamsa: ciepło właściwe (J/g·K), gęstość (g/cm³), przewodność (W/cm·K).
    const C = 3.7;
    const RHO = 1.038;
    const K = 5.4e-3;
    const MSG_IDLE = 'Włóż jajko do wrzącej wody i' + NBSP + 'naciśnij Start.';

    let total = 0;
    let remaining = 0;
    let endAt = 0;
    let interval = null;
    let audio = null;
    let wakeLock = null;

    const boilingPoint = (h) => 100 - h / 300; // ok. 1 °C mniej na każde 300 m

    const read = () => ({
      size: form.elements.size.value,
      start: Number(form.elements.start.value),
      h: Number(altitude.value),
      ty: Number(yolk.value),
    });

    function cookSeconds(s) {
      const m = MASS_G[s.size] || MASS_G.M;
      const tw = boilingPoint(s.h);
      const factor = (Math.pow(m, 2 / 3) * C * Math.pow(RHO, 1 / 3)) /
        (K * Math.PI * Math.PI * Math.pow((4 * Math.PI) / 3, 2 / 3));
      return factor * Math.log((0.76 * (s.start - tw)) / (s.ty - tw));
    }

    function describe(ty) {
      if (ty < 66) return ['płynne', 'Płynne żółtko, delikatne białko'];
      if (ty < 72) return ['kremowe', 'Kremowe żółtko, ścięte białko'];
      if (ty < 78) return ['prawie ścięte', 'Żółtko prawie ścięte, wilgotne w' + NBSP + 'środku'];
      return ['twarde', 'Twarde żółtko, jak do sałatki'];
    }

    const clockText = (ms) => {
      const s = Math.max(0, Math.ceil(ms / 1000));
      return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    };

    function render() {
      clock.textContent = clockText(remaining);
      bar.style.width = total ? ((1 - remaining / total) * 100).toFixed(2) + '%' : '0%';
    }

    function setState(state, label, text) {
      card.dataset.state = state;
      startBtn.textContent = label;
      msg.textContent = text;
    }

    function reset() {
      clearInterval(interval);
      interval = null;
      fields.disabled = false;
      total = remaining = Math.round(cookSeconds(read())) * 1000;
      render();
      setState('idle', 'Start', MSG_IDLE);
      releaseWake();
    }

    function refresh() {
      const s = read();
      paintRange(altitude);
      paintRange(yolk);

      const near = PLACES.reduce((a, b) => (Math.abs(b[0] - s.h) < Math.abs(a[0] - s.h) ? b : a));
      altOut.textContent = num(s.h) + NBSP + 'm' + (Math.abs(near[0] - s.h) <= 60 ? ' · ' + near[1] : '');
      boilOut.textContent = 'Woda wrze tu w' + NBSP + num(boilingPoint(s.h), 1) + NBSP + '°C';

      const [short, long] = describe(s.ty);
      yolkOut.textContent = s.ty + NBSP + '°C · ' + short;
      doneness.textContent = long;

      const runny = Math.min(1, Math.max(0, (82 - s.ty) / 18));
      core.style.transform = 'scale(' + runny.toFixed(3) + ')';
      gloss.style.opacity = runny > 0.35 ? '0.55' : '0';
      presets.forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.yolk) === s.ty)));

      store.set('timer', s);
      reset();
    }

    function tick() {
      remaining = Math.max(0, endAt - Date.now());
      render();
      if (remaining === 0) finish();
    }

    function start() {
      if (remaining <= 0) reset();
      endAt = Date.now() + remaining;
      fields.disabled = true;
      interval = setInterval(tick, 200);
      setState('running', 'Pauza', 'Gotuje się. Pilnuj, żeby woda cały czas wrzała.');
      unlockAudio();
      requestWake();
    }

    function pause() {
      clearInterval(interval);
      interval = null;
      remaining = Math.max(0, endAt - Date.now());
      render();
      setState('paused', 'Wznów', 'Pauza. Jajko w' + NBSP + 'gorącej wodzie gotuje się dalej.');
      releaseWake();
    }

    function finish() {
      clearInterval(interval);
      interval = null;
      fields.disabled = false;
      setState('done', 'Od nowa', 'Gotowe! Przełóż jajko na minutę do zimnej wody.');
      chime();
      releaseWake();
    }

    // Dźwięk wolno odtworzyć dopiero po geście użytkownika, więc kontekst budzimy przy Start.
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

    async function requestWake() {
      try {
        wakeLock = navigator.wakeLock ? await navigator.wakeLock.request('screen') : null;
      } catch {
        wakeLock = null;
      }
    }

    function releaseWake() {
      if (wakeLock) wakeLock.release().catch(() => {});
      wakeLock = null;
    }

    const saved = store.get('timer', null);
    if (saved && typeof saved === 'object') {
      if (Object.prototype.hasOwnProperty.call(MASS_G, saved.size)) form.elements.size.value = saved.size;
      if (saved.start === 4 || saved.start === 20) form.elements.start.value = String(saved.start);
      if (Number.isFinite(saved.h)) altitude.value = saved.h;
      if (Number.isFinite(saved.ty)) yolk.value = saved.ty;
    }

    form.addEventListener('input', refresh);
    form.addEventListener('submit', (e) => e.preventDefault());
    presets.forEach((b) => b.addEventListener('click', () => {
      yolk.value = b.dataset.yolk;
      refresh();
    }));
    startBtn.addEventListener('click', () => (interval ? pause() : start()));
    resetBtn.addEventListener('click', reset);

    refresh();
  })();

  /* ---------- Przekrój jajka ---------- */
  (function anatomy() {
    const svg = $('#anatomySvg');
    const list = $('#parts');
    const buttons = $$('button[data-part]', list);
    const groups = $$('[data-part]', svg);
    const badges = $$('.badge', svg);
    let pinned = null;

    function highlight(part) {
      svg.classList.toggle('has-active', Boolean(part));
      groups.forEach((g) => g.classList.toggle('is-active', g.dataset.part === part));
      badges.forEach((g) => g.classList.toggle('is-active', g.dataset.for === part));
      buttons.forEach((b) => {
        b.classList.toggle('is-active', b.dataset.part === part);
        b.setAttribute('aria-pressed', String(b.dataset.part === pinned));
      });
    }

    buttons.forEach((b) => {
      b.addEventListener('mouseenter', () => highlight(b.dataset.part));
      b.addEventListener('focus', () => highlight(b.dataset.part));
      b.addEventListener('click', () => {
        pinned = pinned === b.dataset.part ? null : b.dataset.part;
        highlight(pinned || b.dataset.part);
      });
    });
    list.addEventListener('mouseleave', () => highlight(pinned));
    list.addEventListener('focusout', (e) => {
      if (!list.contains(e.relatedTarget)) highlight(pinned);
    });

    svg.addEventListener('pointerover', (e) => {
      const g = e.target.closest('[data-part]');
      if (g) highlight(g.dataset.part);
    });
    svg.addEventListener('pointerleave', () => highlight(pinned));
    svg.addEventListener('click', (e) => {
      const g = e.target.closest('[data-part]');
      pinned = g && pinned !== g.dataset.part ? g.dataset.part : null;
      highlight(pinned);
    });
  })();

  /* ---------- Porównanie jaj w skali ---------- */
  (function scaleChart() {
    const svg = $('#scaleSvg');
    const toggle = $('#elephantToggle');
    const NS = 'http://www.w3.org/2000/svg';
    // Jajo stojące na czubku, dół w (0,0), szerokość 1, wysokość 1.
    const UNIT = 'M0,-1 C0.3125,-1 0.5,-0.667 0.5,-0.375 C0.5,-0.146 0.28,0 0,0 C-0.28,0 -0.5,-0.146 -0.5,-0.375 C-0.5,-0.667 -0.3125,-1 0,-1 Z';
    const BASE = 288;
    const TOP = 34;
    const X0 = 80;
    const XR = 944;
    const CHICKEN_G = 58;

    const EGGS = [
      { name: 'Koliber', l: 1.3, w: 0.9, g: 0.5, fill: '#F6F3EC' },
      { name: 'Przepiórka', l: 3.4, w: 2.6, g: 10, fill: '#E8D8BA', speckle: '#4E3B28' },
      { name: 'Kura', l: 5.8, w: 4.3, g: 58, fill: '#E2BE92', ref: true },
      { name: 'Kaczka', l: 6.3, w: 4.5, g: 70, fill: '#D6E8DF' },
      { name: 'Gęś', l: 8.4, w: 5.7, g: 160, fill: '#F2EEE4' },
      { name: 'Emu', l: 13, w: 9, g: 600, fill: '#2F4B3C' },
      { name: 'Struś', l: 15, w: 13, g: 1400, fill: '#F0E5CD' },
      { name: 'Mamutak †', l: 31, w: 22, g: 10000, fill: '#E2CFAA', extinct: true },
    ];

    const el = (tag, attrs, parent) => {
      const node = document.createElementNS(NS, tag);
      Object.entries(attrs || {}).forEach(([k, v]) => node.setAttribute(k, v));
      if (parent) parent.appendChild(node);
      return node;
    };
    const oneDecimal = (x) => num(x, Number.isInteger(x) ? 0 : 1);
    const dims = (e) => oneDecimal(e.l) + ' × ' + oneDecimal(e.w) + ' cm';
    const mass = (g) => (g < 1000 ? oneDecimal(g) + ' g' : num(g / 1000, g % 1000 ? 1 : 0) + ' kg');
    const compare = (e) => {
      if (e.ref) return 'wzorzec';
      const r = e.g / CHICKEN_G;
      if (r >= 1) return (r < 10 ? num(r, 1) : num(Math.round(r))) + '× kurze';
      return '1/' + Math.round(1 / r) + ' kurzego';
    };

    const defs = el('defs', {}, svg);
    const shade = el('radialGradient', { id: 'scShade', cx: '0.36', cy: '0.3', r: '0.85' }, defs);
    el('stop', { offset: '0', 'stop-color': '#fff', 'stop-opacity': '0.6' }, shade);
    el('stop', { offset: '0.45', 'stop-color': '#fff', 'stop-opacity': '0' }, shade);
    el('stop', { offset: '1', 'stop-color': '#000', 'stop-opacity': '0.25' }, shade);

    const grid = el('g', {}, svg);
    el('line', { class: 'sc-base', x1: X0 - 34, x2: XR, y1: BASE, y2: BASE }, svg);
    const eggsLayer = el('g', {}, svg);
    const labelsLayer = el('g', {}, svg);

    let seed = 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

    EGGS.forEach((e) => {
      e.node = el('g', { class: 'sc-egg' }, eggsLayer);
      el('title', {}, e.node).textContent = e.name.replace(' †', '') + ': ' + dims(e) + ', ' + mass(e.g);
      el('path', { d: UNIT, fill: e.fill, class: 'sc-shell' }, e.node);
      if (e.speckle) {
        for (let i = 0; i < 40; i++) {
          const x = (rnd() - 0.5) * 0.9;
          const y = -0.06 - rnd() * 0.88;
          if ((x / 0.44) ** 2 + ((y + 0.42) / 0.5) ** 2 < 1) {
            el('circle', { cx: x.toFixed(3), cy: y.toFixed(3), r: (0.015 + rnd() * 0.035).toFixed(3), fill: e.speckle }, e.node);
          }
        }
      }
      el('path', { d: UNIT, fill: 'url(#scShade)' }, e.node);

      e.label = el('g', { class: 'sc-label' }, labelsLayer);
      el('text', { class: 'sc-name', y: BASE + 28 }, e.label).textContent = e.name;
      el('text', { class: 'sc-meta', y: BASE + 46 }, e.label).textContent = dims(e);
      el('text', { class: 'sc-meta', y: BASE + 62 }, e.label).textContent = mass(e.g);
      el('text', { class: 'sc-cmp', y: BASE + 80 }, e.label).textContent = compare(e);
    });

    function drawRuler(maxCm, s) {
      grid.replaceChildren();
      const minor = maxCm > 20 ? 2 : 1;
      const major = maxCm > 20 ? 10 : 5;
      const ax = X0 - 34;
      el('line', { class: 'sc-axis', x1: ax, x2: ax, y1: BASE, y2: BASE - maxCm * s }, grid);
      for (let c = 0; c <= maxCm; c += minor) {
        const y = BASE - c * s;
        const isMajor = c % major === 0;
        el('line', { class: 'sc-tick', x1: ax, x2: ax + (isMajor ? 10 : 5), y1: y, y2: y }, grid);
        if (isMajor) {
          el('text', { class: 'sc-tick-label', x: ax - 6, y }, grid).textContent = c === 0 ? '0' : String(c);
          if (c > 0) el('line', { class: 'sc-gridline', x1: ax + 12, x2: XR, y1: y, y2: y }, grid);
        }
      }
      el('text', { class: 'sc-tick-label', x: ax + 22, y: BASE - maxCm * s - 14 }, grid).textContent = 'cm';
    }

    function layout() {
      const withGiant = toggle.checked;
      const shown = EGGS.filter((e) => withGiant || !e.extinct);
      const maxCm = withGiant ? 32 : 16;
      const s = (BASE - TOP) / maxCm;
      const cols = shown.map((e) => Math.max(e.w * s, 84));
      const sum = cols.reduce((a, b) => a + b, 0);
      const gap = Math.min(40, (XR - X0 - sum) / (shown.length - 1));
      let x = X0 + (XR - X0 - sum - gap * (shown.length - 1)) / 2;

      shown.forEach((e, i) => {
        const cx = x + cols[i] / 2;
        x += cols[i] + gap;
        e.node.style.transform = `translate(${cx}px, ${BASE}px) scale(${e.w * s}, ${e.l * s})`;
        e.label.style.transform = `translate(${cx}px, 0px)`;
        e.node.style.opacity = '1';
        e.label.style.opacity = '1';
      });
      EGGS.filter((e) => !shown.includes(e)).forEach((e) => {
        e.node.style.transform = `translate(${XR - 60}px, ${BASE}px) scale(0.01, 0.01)`;
        e.label.style.transform = `translate(${XR - 60}px, 0px)`;
        e.node.style.opacity = '0';
        e.label.style.opacity = '0';
      });
      drawRuler(maxCm, s);

      svg.setAttribute('aria-label', 'Porównanie długości jaj: ' +
        shown.map((e) => e.name.replace(' †', '').toLowerCase() + ' ' + oneDecimal(e.l) + ' cm').join(', ') + '.');
    }

    svg.classList.add('sc-still');
    layout();
    requestAnimationFrame(() => requestAnimationFrame(() => svg.classList.remove('sc-still')));
    toggle.addEventListener('change', layout);
  })();

  /* ---------- Dekoder kodu ze skorupki ---------- */
  (function decoder() {
    const input = $('#codeInput');
    const error = $('#codeError');
    const decoded = $('#decoded');
    const out = {
      a: $('#stA'), b: $('#stB'), c: $('#stC'), cLabel: $('#stCLabel'), d: $('#stD'), dWrap: $('#stDWrap'),
      method: $('#decMethod'), methodInfo: $('#decMethodInfo'),
      country: $('#decCountry'), countryInfo: $('#decCountryInfo'),
      producer: $('#decProducer'), producerInfo: $('#decProducerInfo'),
    };
    const welfare = $$('.wf');

    const METHODS = [
      ['Chów ekologiczny', 'Kury mają wybieg na zewnątrz i' + NBSP + 'jedzą paszę ekologiczną. W' + NBSP + 'kurniku najwyżej 6 kur na metr kwadratowy.'],
      ['Chów na wolnym wybiegu', 'Kury w' + NBSP + 'ciągu dnia wychodzą na zewnątrz. Na każdą przypadają co najmniej 4' + NBSP + 'm² wybiegu.'],
      ['Chów ściółkowy', 'Kury chodzą po ściółce w' + NBSP + 'zamkniętym kurniku, bez klatek. Do 9 kur na metr kwadratowy.'],
      ['Chów klatkowy', 'Kury żyją w' + NBSP + 'klatkach. Na jedną przypada ok. 750' + NBSP + 'cm², niewiele więcej niż kartka A4.'],
    ];
    const COUNTRIES = {
      PL: 'Polska', DE: 'Niemcy', NL: 'Holandia', FR: 'Francja', ES: 'Hiszpania', IT: 'Włochy',
      CZ: 'Czechy', SK: 'Słowacja', LT: 'Litwa', LV: 'Łotwa', EE: 'Estonia', AT: 'Austria',
      BE: 'Belgia', DK: 'Dania', HU: 'Węgry', RO: 'Rumunia', BG: 'Bułgaria', PT: 'Portugalia',
      SE: 'Szwecja', FI: 'Finlandia', IE: 'Irlandia', GR: 'Grecja', HR: 'Chorwacja', SI: 'Słowenia',
      LU: 'Luksemburg', CY: 'Cypr', MT: 'Malta', UK: 'Wielka Brytania', UA: 'Ukraina',
    };
    // Kody województw według TERYT, tak jak w weterynaryjnym numerze identyfikacyjnym.
    const VOIVODESHIPS = {
      '02': 'dolnośląskie', '04': 'kujawsko-pomorskie', '06': 'lubelskie', '08': 'lubuskie',
      10: 'łódzkie', 12: 'małopolskie', 14: 'mazowieckie', 16: 'opolskie',
      18: 'podkarpackie', 20: 'podlaskie', 22: 'pomorskie', 24: 'śląskie',
      26: 'świętokrzyskie', 28: 'warmińsko-mazurskie', 30: 'wielkopolskie', 32: 'zachodniopomorskie',
    };

    function parse(raw) {
      const code = raw.toUpperCase().replace(/[\s\-‐–—_.\/]/g, '');
      if (!code) return { error: 'Wpisz kod z' + NBSP + 'jajka, np. 1-PL-30241301.' };
      if (!/^[0-3]/.test(code)) return { error: 'Kod zaczyna się cyfrą od 0 do 3. To ona mówi, jak żyła kura.' };
      const cc = code.slice(1, 3);
      if (!/^[A-Z]{2}$/.test(cc)) return { error: 'Po pierwszej cyfrze są dwie litery kraju, np. PL.' };
      const rest = code.slice(3);
      if (!rest) return { error: 'Brakuje numeru producenta po kodzie kraju.' };
      if (!/^[0-9A-Z]+$/.test(rest)) return { error: 'Numer producenta składa się tylko z' + NBSP + 'cyfr i' + NBSP + 'liter.' };
      const res = { method: Number(code[0]), cc, rest };
      if (cc === 'PL' && !/^\d{8}$/.test(rest)) {
        res.warning = 'Polski numer producenta ma 8 cyfr. Sprawdź, czy żadnej nie brakuje.';
      }
      return res;
    }

    function show() {
      const res = parse(input.value);
      if (res.error) {
        error.textContent = res.error;
        decoded.classList.add('is-stale');
        return;
      }
      error.textContent = res.warning || '';
      decoded.classList.remove('is-stale');

      const [methodName, methodInfo] = METHODS[res.method];
      out.a.textContent = String(res.method);
      out.b.textContent = res.cc;
      out.method.textContent = methodName;
      out.methodInfo.textContent = methodInfo;

      const country = COUNTRIES[res.cc];
      out.country.textContent = country || res.cc;
      out.countryInfo.textContent = country
        ? 'Kraj, w' + NBSP + 'którym jajo zostało zniesione.'
        : 'Nie znam tego kodu kraju. Sprawdź, czy nie ma literówki.';

      if (res.cc === 'PL' && /^\d{8}$/.test(res.rest)) {
        const woj = res.rest.slice(0, 2);
        const pow = res.rest.slice(2, 4);
        const act = res.rest.slice(4, 6);
        const farm = res.rest.slice(6, 8);
        out.c.textContent = woj + pow;
        out.cLabel.textContent = 'woj. i' + NBSP + 'powiat';
        out.d.textContent = act + farm;
        out.dWrap.hidden = false;
        out.producer.textContent = VOIVODESHIPS[woj] ? 'woj. ' + VOIVODESHIPS[woj] : 'Nieznane województwo';
        const actText = act === '13'
          ? 'Kod działalności 13 oznacza fermę kur niosek'
          : 'Kod działalności to ' + act;
        out.producerInfo.textContent = (VOIVODESHIPS[woj] ? '' : 'Kod ' + woj + ' nie pasuje do żadnego województwa. ') +
          'Powiat o' + NBSP + 'kodzie ' + pow + '. ' + actText + ', a' + NBSP + farm + ' to numer fermy.';
      } else {
        out.c.textContent = res.rest;
        out.cLabel.textContent = 'producent';
        out.dWrap.hidden = true;
        out.producer.textContent = 'Nr ' + res.rest;
        out.producerInfo.textContent = 'Numer fermy nadany przez służby weterynaryjne w' + NBSP + 'kraju pochodzenia.';
      }

      welfare.forEach((li) => li.classList.toggle('is-current', Number(li.dataset.method) === res.method));
    }

    input.addEventListener('input', show);
    $$('[data-code]').forEach((b) => b.addEventListener('click', () => {
      input.value = b.dataset.code;
      show();
    }));
    show();
  })();

  /* ---------- Test świeżości ---------- */
  (function freshness() {
    const age = $('#age');
    const out = $('#ageOut');
    const verdict = $('#freshVerdict');
    const egg = $('#freshEgg');
    const air = $('#airCell');
    const A = 44; // połowa długości jajka po skalowaniu
    const B = 32; // połowa szerokości
    const FLOOR = 263;
    const SURFACE = 72;
    const LEVELS = [
      [6, 'ok', 'Świeże. Leży płasko na dnie.'],
      [13, 'mid', 'Ma tydzień lub dwa. Unosi tępy koniec, ale nadal jest dobre.'],
      [24, 'old', 'Starsze. Staje pionowo. Zjedz szybko, najlepiej na twardo.'],
      [Infinity, 'bad', 'Wypływa. Komora powietrzna jest już bardzo duża. Lepiej go nie jeść.'],
    ];

    function update() {
      const d = Number(age.value);
      paintRange(age);
      out.textContent = d === 1 ? '1 dzień' : d + ' dni';

      const theta = Math.min(1, Math.max(0, (d - 3) / 14)) * 85;
      const r = (theta * Math.PI) / 180;
      const halfHeight = Math.sqrt((A * Math.sin(r)) ** 2 + (B * Math.cos(r)) ** 2);
      const floating = d >= 25;
      const cy = floating ? SURFACE + halfHeight * 0.55 : FLOOR - halfHeight - 1;
      egg.style.transform = `translate(110px, ${cy.toFixed(1)}px) rotate(${theta.toFixed(1)}deg)`;
      egg.classList.toggle('is-floating', floating && !reduceMotion.matches);

      air.setAttribute('rx', (3 + d * 0.45).toFixed(1));
      air.setAttribute('ry', (10 + d * 0.4).toFixed(1));

      const [, level, text] = LEVELS.find(([max]) => d <= max);
      verdict.dataset.level = level;
      verdict.textContent = text;
    }

    age.addEventListener('input', update);
    update();
  })();

  /* ---------- Aktywny link w nawigacji ---------- */
  (function navSpy() {
    if (!('IntersectionObserver' in window)) return;
    const links = $$('.nav-links a');
    const byId = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((a) => a.removeAttribute('aria-current'));
        byId.get(entry.target.id)?.setAttribute('aria-current', 'true');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    byId.forEach((_, id) => {
      const section = document.getElementById(id);
      if (section) io.observe(section);
    });
  })();
})();
