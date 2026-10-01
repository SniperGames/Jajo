/* Jajo: nocne ślady na stronie głównej (jajko w nagłówku i kod ze skorupki). */
import { t, step, advance, whenSynced, whisper, isCode, keyFromCode, setKey } from './rdzen.js';

const $ = (sel, root = document) => root.querySelector(sel);
const SVG = 'http://www.w3.org/2000/svg';
const CAMERA = { href: 'cam05.html', text: '▶ Kamera 05' };

/* ---------- Jajko: kto stuka wytrwale, ten zobaczy, że pisklę zniknęło ---------- */
(function egg() {
  const btn = $('#heroEgg');
  const hint = $('#eggHint');
  if (!btn || !hint) return;
  // Ciemne wnętrze pustej skorupki (pod pisklęciem, widać je tylko, gdy skorupka jest pusta).
  const body = $('.egg-body', btn);
  const voidG = document.createElementNS(SVG, 'g');
  voidG.setAttribute('class', 'egg-void');
  voidG.innerHTML = '<ellipse cx="100" cy="150" rx="74" ry="46"/><circle class="egg-void-eye" cx="86" cy="132" r="2.6"/><circle class="egg-void-eye" cx="112" cy="132" r="2.6"/>';
  body.insertBefore(voidG, $('.chick', body));

  let cycles = 0; // ile razy pisklę wyszło i dało się schować
  btn.addEventListener('click', () => {
    // script.js zdążył już zmienić etap jajka (0–4).
    const stage = Number(btn.dataset.stage);
    if (stage === 0) {
      if (btn.classList.contains('is-empty')) {
        btn.classList.remove('is-empty');
        cycles = 0;
      } else {
        cycles += 1;
      }
      return;
    }
    if (stage !== 4) return;
    const lines = t('jajko');
    if (cycles >= 3) {
      btn.classList.add('is-empty');
      btn.setAttribute('aria-label', 'Zamknij pustą skorupkę');
      hint.textContent = lines[2];
      empty();
    } else if (cycles >= 1) {
      hint.textContent = lines[cycles - 1];
    }
  });

  async function empty() {
    await advance(1);
    if (step() >= 8) {
      hint.append(' ');
      const a = document.createElement('a');
      a.className = 'noc-cam-link';
      a.href = CAMERA.href;
      a.textContent = CAMERA.text;
      hint.append(a);
    }
    whisper(t('n1'), { kicker: 'Karteczka w skorupce', link: step() >= 8 ? CAMERA : null });
  }
})();

/* ---------- Kod ze skorupki ---------- */
(function code() {
  const input = $('#codeInput');
  const decoded = $('#decoded');
  if (!input || !decoded) return;
  const dLabel = $('#stDWrap i');
  const farm = dLabel ? dLabel.textContent : '';
  let token = 0;

  async function check() {
    const mine = ++token;
    const val = input.value;
    if (decoded.classList.contains('is-noc')) {
      decoded.classList.remove('is-noc');
      if (dLabel) dLabel.textContent = farm;
    }
    if (!(await isCode(val)) || mine !== token) return;
    if (step() < 4) await whenSynced();
    if (step() < 4 || mine !== token) return;
    show();
    const key = await keyFromCode(val);
    const res = await advance(5);
    if (!res || mine !== token) return;
    setKey(key);
    whisper(t('n5'), { kicker: 'Kod ze skorupki' });
  }

  function show() {
    const k = t('kod');
    const set = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    decoded.classList.remove('is-stale');
    decoded.classList.add('is-noc');
    set('codeError', '');
    set('stA', '5');
    set('stB', 'PL');
    set('stC', k.c);
    set('stCLabel', k.cLabel);
    set('stD', k.d);
    $('#stDWrap').hidden = false;
    if (dLabel) dLabel.textContent = k.dLabel;
    set('decMethod', k.method);
    set('decMethodInfo', k.methodInfo);
    set('decCountry', k.country);
    set('decCountryInfo', k.countryInfo);
    set('decProducer', k.producer);
    set('decProducerInfo', k.producerInfo);
    document.querySelectorAll('.wf.is-current').forEach((li) => li.classList.remove('is-current'));
  }

  input.addEventListener('input', check);
  document.querySelectorAll('[data-code]').forEach((b) => b.addEventListener('click', check));
  if (input.value) check();
})();
