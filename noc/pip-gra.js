/* Jajo: gra „Pip wraca do domu”. Rysowanie, dźwięk i sterowanie. Im dalej, tym bardziej obraz i muzyka się psują. */
import { W, H, GROUND, PIP_X, PIP_H, STAGES, Run } from './pip-swiat.js';
import { makeCanvas, loop, isMuted } from '../gry/wspolne.js';
import { corrupt } from './rdzen.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const STEP = 1 / 120;
const MESSAGES = ['NIE IDŹ DALEJ', 'WRÓĆ', 'ONA PATRZY', '02:37', 'NIE OGLĄDAJ SIĘ', 'TO NIE JEST DOM', 'ZOSTAŃ', 'KAMERA 05', 'SŁYSZYSZ?', 'JUŻ BLISKO'];
const DEATH_TEXT = ['Jeszcze raz!', 'Jeszcze raz', 'Znowu?', 'Nie uciekniesz', 'Zostań ze mną'];

/* ---------- Dźwięk ---------- */

function createAudio() {
  let ac = null;
  let master = null;
  let music = null; // { stop() }
  let glitch = 0;

  function ensure() {
    if (!ac) {
      try {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        master = ac.createGain();
        master.gain.value = isMuted() ? 0 : 0.9;
        master.connect(ac.destination);
      } catch {
        ac = null;
      }
    }
    if (ac && ac.state === 'suspended') ac.resume();
    return ac;
  }

  const freq = (m) => 440 * 2 ** ((m - 69) / 12);

  function tone(f, at, len, { type = 'square', vol = 0.05, slide = 0, detune = 0, dest = master } = {}) {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, at);
    o.detune.value = detune;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), at + len);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    o.connect(g).connect(dest);
    o.start(at);
    o.stop(at + len + 0.03);
  }

  function noise(at, len, { vol = 0.1, f = 1800, q = 0.7, type = 'bandpass', dest = master } = {}) {
    const n = Math.max(1, Math.floor(ac.sampleRate * len));
    const buf = ac.createBuffer(1, n, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buf;
    const fl = ac.createBiquadFilter();
    fl.type = type;
    fl.frequency.value = f;
    fl.Q.value = q;
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    src.connect(fl).connect(g).connect(dest);
    src.start(at);
  }

  // Wesoła melodyjka, która na kolejnych etapach zwalnia, fałszuje i w końcu milknie.
  const LEAD = [72, 0, 76, 0, 79, 0, 76, 0, 77, 0, 81, 0, 79, 0, 0, 0, 76, 0, 79, 0, 84, 0, 79, 0, 77, 0, 76, 0, 74, 0, 0, 0];
  const BASS = [48, 43, 41, 48, 48, 43, 43, 43];

  function chiptune({ tempo, shift = 0, sour = 0, dark = false }) {
    const out = ac.createGain();
    out.gain.value = 1;
    let dest = out;
    if (dark) {
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1100;
      out.connect(lp).connect(master);
    } else {
      out.connect(master);
    }
    const stepLen = 60 / tempo / 2;
    let step = 0;
    let next = ac.currentTime + 0.1;
    const timer = setInterval(() => {
      while (next < ac.currentTime + 0.15) {
        const s = step % 32;
        const g = glitch;
        let note = LEAD[s];
        if (note) {
          if (Math.random() < sour * g) note += Math.random() < 0.5 ? 1 : -1;
          if (!(dark && Math.random() < 0.15 * g)) {
            tone(freq(note + shift), next, stepLen * 0.9, { type: 'square', vol: 0.035, detune: rnd(-1, 1) * g * 70, dest });
          }
        }
        if (s % 4 === 0) tone(freq(BASS[s / 4] + shift), next, stepLen * 3.6, { type: 'triangle', vol: 0.07, detune: rnd(-1, 1) * g * 40, dest });
        if (s % 8 === 4 && !dark) noise(next, 0.05, { vol: 0.03, f: 6000, type: 'highpass', dest });
        next += stepLen * (1 + (dark ? rnd(-0.06, 0.12) * g : 0));
        step += 1;
      }
    }, 25);
    return {
      stop() {
        clearInterval(timer);
        try {
          out.gain.setTargetAtTime(0, ac.currentTime, 0.08);
          setTimeout(() => out.disconnect(), 600);
        } catch {
          /* już zatrzymane */
        }
      },
    };
  }

  // Niskie buczenie, brzęk jarzeniówki i czasem metaliczny stuk albo bicie serca.
  function drone({ base, hum = 0, heart = false, clang = false }) {
    const out = ac.createGain();
    out.gain.setValueAtTime(0.0001, ac.currentTime);
    out.gain.exponentialRampToValueAtTime(1, ac.currentTime + 2);
    out.connect(master);
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380;
    lp.connect(out);
    const oscs = [base, base * 1.04, base * 1.5].map((f, i) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = 'sawtooth';
      o.frequency.value = f;
      g.gain.value = i === 2 ? 0.012 : 0.03;
      o.connect(g).connect(lp);
      o.start();
      return o;
    });
    if (hum) {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = 'square';
      o.frequency.value = 100;
      g.gain.value = hum;
      o.connect(g).connect(out);
      o.start();
      oscs.push(o);
    }
    let beat = 0;
    const timer = setInterval(() => {
      const now = ac.currentTime;
      if (heart && now >= beat) {
        const bpm = 62 + glitch * 40;
        tone(55, now + 0.02, 0.16, { type: 'sine', vol: 0.22, slide: -15, dest: out });
        tone(52, now + 0.27, 0.14, { type: 'sine', vol: 0.15, slide: -12, dest: out });
        beat = now + 60 / bpm;
      }
      if (clang && Math.random() < 0.012) noise(now + 0.02, 0.5, { vol: 0.05, f: rnd(2000, 4200), q: 12, dest: out });
      if (Math.random() < 0.004 + glitch * 0.006) noise(now + 0.02, rnd(0.6, 1.4), { vol: 0.025, f: rnd(300, 900), q: 1.5, dest: out });
    }, 60);
    return {
      stop() {
        clearInterval(timer);
        try {
          out.gain.setTargetAtTime(0, ac.currentTime, 0.1);
          oscs.forEach((o) => o.stop(ac.currentTime + 0.6));
        } catch {
          /* już zatrzymane */
        }
      },
    };
  }

  return {
    unlock: ensure,
    setMuted(m) {
      if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ac.currentTime, 0.05);
    },
    setGlitch(g) {
      glitch = g;
    },
    stage(i) {
      if (!ensure()) return;
      this.stopMusic();
      if (i === 0) music = chiptune({ tempo: 132 });
      else if (i === 1) music = chiptune({ tempo: 120, sour: 0.5 });
      else if (i === 2) music = chiptune({ tempo: 84, shift: -13, sour: 1, dark: true });
      else if (i === 3) music = drone({ base: 55, hum: 0.006, clang: true });
      else music = drone({ base: 41, heart: true });
    },
    stopMusic() {
      if (music) music.stop();
      music = null;
    },
    get playing() {
      return Boolean(music);
    },
    sfx(kind) {
      if (!ensure() || isMuted()) return;
      const t = ac.currentTime + 0.01;
      const g = glitch;
      if (kind === 'jump') tone(520 * (1 - g * 0.4), t, 0.1, { type: 'square', vol: 0.05, slide: 300 * (1 - g) });
      else if (kind === 'flap') tone(760 * (1 - g * 0.4), t, 0.07, { type: 'triangle', vol: 0.06, slide: 200 });
      else if (kind === 'grain') tone(g > 0.5 ? rnd(300, 500) : 1320, t, 0.06, { type: 'sine', vol: 0.05, slide: g > 0.5 ? -150 : 0 });
      else if (kind === 'check') [660, 990].forEach((f, k) => tone(f * (1 - g * 0.3), t + k * 0.09, 0.14, { type: 'triangle', vol: 0.07 }));
      else if (kind === 'dead') {
        noise(t, 0.35, { vol: 0.18, f: 900 });
        tone(140, t, 0.4, { type: 'sawtooth', vol: 0.06, slide: -100 });
      } else if (kind === 'done') [523, 659, 784].forEach((f, k) => tone(f * (1 - g * 0.25), t + k * 0.1, 0.18, { type: 'triangle', vol: 0.08 }));
    },
    staticBurst(len = 0.4, vol = 0.12) {
      if (!ensure() || isMuted()) return;
      noise(ac.currentTime + 0.01, len, { vol, f: 2600, q: 0.4 });
    },
    stopAll() {
      this.stopMusic();
    },
    close() {
      this.stopMusic();
      if (ac) ac.close().catch(() => {});
      ac = null;
    },
  };
}

/* ---------- Gra ---------- */

/**
 * createPip(stage, cb): cb.onStageDone(i), cb.onFinale(), cb.onDeath(i, deaths), cb.onStage(i, glitch).
 * Zwraca { start(i, fromCheckpoint), pause(), resume(), setMuted(m), destroy(), state }.
 */
export function createPip(stage, cb = {}) {
  const view = makeCanvas(stage, W, H);
  const { ctx, canvas } = view;
  const audio = createAudio();
  let run = null;
  let state = 'idle'; // idle, play, dead, done, finale, paused
  let pausedFrom = '';
  let t = 0;
  let acc = 0;
  let deaths = 0;
  let deadT = 0;
  let doneT = 0;
  let finT = 0;
  let shake = 0;
  let flapAnim = 0;
  let parts = [];
  let msgs = [];
  let slices = [];
  let sliceT = 0;
  let rgbT = 0;
  let invT = 0;
  let staticT = 0;
  let eyesT = 0;
  let figure = null; // postać w tle (ostatni etap)
  let figureShown = new Set();
  let hud = { name: '', at: 0 };
  let musicStage = -1;

  // Gotowe kawałki szumu i linii (rysowane raz, potem tylko przesuwane).
  const noiseTiles = Array.from({ length: 3 }, () => {
    const c = document.createElement('canvas');
    c.width = c.height = 160;
    const x = c.getContext('2d');
    const img = x.createImageData(160, 160);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    return ctx.createPattern(c, 'repeat');
  });
  const scan = (() => {
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 4;
    const x = c.getContext('2d');
    x.fillStyle = 'rgba(0,0,0,.55)';
    x.fillRect(0, 0, 4, 1);
    return ctx.createPattern(c, 'repeat');
  })();
  const buf = document.createElement('canvas');
  const bctx = buf.getContext('2d');

  const glitch = () => (run ? run.glitch : 0);
  const cam = () => (run ? run.x - PIP_X : 0);

  function start(i, fromCheckpoint = false) {
    run = new Run(i, fromCheckpoint);
    state = 'play';
    deadT = 0;
    doneT = 0;
    finT = 0;
    parts = [];
    msgs = [];
    figure = null;
    if (!fromCheckpoint) figureShown = new Set();
    acc = 0;
    // po porażce muzyka gra dalej, zaczyna się od nowa tylko na nowym etapie
    if (!audio.playing || musicStage !== i) audio.stage(i);
    musicStage = i;
    audio.setGlitch(run.glitch);
    hud.name = `Etap ${i + 1}/5 · ${run.stage.name}`;
    if (cb.onStage) cb.onStage(i, run.glitch);
    ticker.start();
  }

  function press() {
    if (state === 'play' && run) run.press();
  }

  /* ---------- Logika klatki ---------- */

  function update(dt) {
    t += dt;
    const g = glitch();
    shake = Math.max(0, shake - dt);
    flapAnim = Math.max(0, flapAnim - dt);
    sliceT = Math.max(0, sliceT - dt);
    rgbT = Math.max(0, rgbT - dt);
    invT = Math.max(0, invT - dt);
    staticT = Math.max(0, staticT - dt);
    eyesT = Math.max(0, eyesT - dt);
    if (state === 'play') {
      acc = Math.min(acc + dt, 0.1);
      while (acc >= STEP && state === 'play') {
        acc -= STEP;
        for (const e of run.step(STEP)) onEvent(e);
      }
      audio.setGlitch(run.glitch);
      randomGlitches(dt, g);
    } else if (state === 'dead') {
      deadT += dt;
      if (deadT > 1.15) start(run.i, run.checkpointHit);
    } else if (state === 'done') {
      doneT += dt;
      run.x += run.stage.speed * dt * Math.max(0, 1 - doneT * 1.4);
      if (doneT > 1.1 && doneT - dt <= 1.1) {
        audio.stopMusic();
        if (cb.onStageDone) cb.onStageDone(run.i);
      }
    } else if (state === 'finale') {
      finale(dt);
    }
    parts.forEach((p) => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 900 * dt;
      p.life -= dt;
    });
    parts = parts.filter((p) => p.life > 0);
    msgs.forEach((m) => { m.life -= dt; });
    msgs = msgs.filter((m) => m.life > 0);
  }

  function onEvent(e) {
    if (e === 'jump') audio.sfx('jump');
    else if (e === 'flap') {
      audio.sfx('flap');
      flapAnim = 0.25;
      feathers(PIP_X, run.y - 14, 3);
    } else if (e === 'grain') audio.sfx('grain');
    else if (e === 'checkpoint') {
      audio.sfx('check');
      msgs.push({ text: run.i < 3 ? 'Punkt kontrolny' : corrupt('Punkt kontrolny', run.glitch * 0.5), x: W / 2, y: 130, life: 1.4, size: 26, color: run.i < 3 ? '#FFFFFF' : '#E0161B', fixed: true });
    } else if (e === 'dead') {
      state = 'dead';
      deadT = 0;
      deaths += 1;
      shake = 0.45;
      audio.sfx('dead');
      if (run.i >= 2) {
        audio.staticBurst(0.5, 0.08 + run.glitch * 0.12);
        staticT = 0.25 + run.glitch * 0.4;
        sliceT = 0.3;
        makeSlices(6);
      }
      feathers(PIP_X, run.y - 14, 14);
      if (cb.onDeath) cb.onDeath(run.i, deaths);
    } else if (e === 'done') {
      if (run.i === STAGES.length - 1) {
        state = 'finale';
        finT = 0;
        audio.stopMusic();
      } else {
        state = 'done';
        doneT = 0;
        audio.sfx('done');
      }
    }
  }

  function feathers(x, y, n) {
    for (let i = 0; i < n; i++) {
      parts.push({ x, y, vx: rnd(-160, 160), vy: rnd(-380, -80), life: rnd(0.5, 0.9), size: rnd(3, 6), color: Math.random() < 0.5 ? '#FFD23F' : '#FFF1B0' });
    }
  }

  function makeSlices(n) {
    slices = Array.from({ length: n }, () => ({ y: Math.random(), h: rnd(0.01, 0.07), dx: rnd(-0.12, 0.12) }));
  }

  // Losowe usterki obrazu: częstsze i mocniejsze z każdym etapem.
  function randomGlitches(dt, g) {
    if (g > 0.04 && Math.random() < dt * g * 1.6) {
      sliceT = rnd(0.05, 0.12 + g * 0.2);
      makeSlices(1 + Math.floor(g * 6));
    }
    if (g > 0.2 && Math.random() < dt * g * 0.45) rgbT = rnd(0.06, 0.12 + g * 0.15);
    if (g > 0.45 && Math.random() < dt * (g - 0.4) * 0.5) invT = rnd(0.04, 0.09);
    if (g > 0.3 && Math.random() < dt * g * 0.45) {
      msgs.push({ text: MESSAGES[Math.floor(Math.random() * MESSAGES.length)], x: rnd(120, W - 120), y: rnd(70, 250), life: rnd(0.12, 0.35), size: rnd(18, 34), color: 'rgba(224,22,27,.75)' });
    }
    if (g > 0.33 && Math.random() < dt * g * 0.6) eyesT = rnd(0.1, 0.5);
    if (g > 0.55 && Math.random() < dt * (g - 0.5) * 0.4) {
      staticT = rnd(0.08, 0.2);
      audio.staticBurst(staticT, 0.05);
    }
    // Ostatni etap: postać w tle pojawia się coraz bliżej.
    if (run.i === STAGES.length - 1) {
      [0.25, 0.5, 0.72, 0.9].forEach((p, k) => {
        if (run.progress > p && !figureShown.has(k)) {
          figureShown.add(k);
          figure = { k, life: 0.35 + k * 0.1, x: W * rnd(0.55, 0.85) - k * 40 };
          audio.staticBurst(0.3, 0.06 + k * 0.03);
        }
      });
      if (figure) {
        figure.life -= dt;
        if (figure.life <= 0) figure = null;
      }
    }
    if (hud.at <= t) {
      hud.at = t + rnd(0.2, 1.2);
      const base = `Etap ${run.i + 1}/5 · ${run.stage.name}`;
      hud.name = g > 0.12 ? corrupt(base, g * 0.45) : base;
    }
  }

  // Zakończenie: Pip staje na środku sali, ktoś za nim stoi, obraz się urywa.
  function finale(dt) {
    finT += dt;
    if (finT < 1.2) run.x += run.stage.speed * dt * Math.max(0, 1 - finT);
    if (finT > 1.6 && finT - dt <= 1.6) {
      figure = { k: 9, life: 99, x: PIP_X + 90 };
      audio.staticBurst(0.4, 0.1);
    }
    if (finT > 2.6 && finT - dt <= 2.6) {
      staticT = 1.6;
      audio.staticBurst(1.6, 0.22);
    }
    if (finT > 4.3 && finT - dt <= 4.3) {
      state = 'over';
      if (cb.onFinale) cb.onFinale();
    }
  }

  /* ---------- Rysowanie: tła ---------- */

  function sky(c1, c2) {
    const gr = ctx.createLinearGradient(0, 0, 0, GROUND);
    gr.addColorStop(0, c1);
    gr.addColorStop(1, c2);
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, W, H);
  }

  function hills(color, base, amp, par, seed) {
    const off = cam() * par;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, GROUND);
    for (let x = 0; x <= W; x += 24) {
      const wx = x + off;
      ctx.lineTo(x, base - amp * (0.55 + 0.45 * Math.sin(wx / 230 + seed) * Math.cos(wx / 110 + seed * 2)));
    }
    ctx.lineTo(W, GROUND);
    ctx.fill();
  }

  // Powtarzające się dekoracje: f(x ekranu, indeks) dla każdej kopii co `every` pikseli.
  function repeat(par, every, f) {
    const off = cam() * par;
    const first = Math.floor((off - 200) / every);
    for (let k = first; k * every - off < W + 200; k++) f(k * every - off, k);
  }

  function ground(top, body, line) {
    ctx.fillStyle = body;
    ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = top;
    ctx.fillRect(0, GROUND, W, 9);
    if (line) {
      ctx.fillStyle = line;
      repeat(1, 26, (x, k) => {
        ctx.fillRect(x, GROUND + 22 + ((k * 7) % 3) * 22, 10, 3);
      });
    }
  }

  function clouds(color, par) {
    ctx.fillStyle = color;
    repeat(par, 380, (x, k) => {
      const y = 60 + ((k * 53) % 90);
      const s = 0.7 + ((k * 31) % 5) / 10;
      ctx.beginPath();
      ctx.ellipse(x, y, 60 * s, 18 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 34 * s, y - 12 * s, 36 * s, 18 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function trees(color, par, base, hgt, every) {
    ctx.fillStyle = color;
    repeat(par, every, (x, k) => {
      const h = hgt * (0.7 + ((k * 37) % 6) / 10);
      ctx.fillRect(x - 6, base - h * 0.4, 12, h * 0.4);
      ctx.beginPath();
      ctx.moveTo(x - h * 0.28, base - h * 0.3);
      ctx.lineTo(x, base - h);
      ctx.lineTo(x + h * 0.28, base - h * 0.3);
      ctx.fill();
    });
  }

  function drawWorld() {
    const th = run.stage.theme;
    const g = glitch();
    if (th === 'dzien') {
      sky('#8FD3F4', '#E8F7FD');
      ctx.fillStyle = '#FFD65C';
      ctx.beginPath();
      ctx.arc(790, 92, 42, 0, Math.PI * 2);
      ctx.fill();
      clouds('rgba(255,255,255,.92)', 0.08);
      hills('#C9E8B2', GROUND - 40, 90, 0.15, 1);
      repeat(0.4, 1100, (x) => barn(x, GROUND - 4, '#C0563D'));
      hills('#A9D78E', GROUND, 40, 0.3, 4);
      repeat(0.7, 60, (x) => fence(x, GROUND, '#FFFFFF'));
      ground('#7CBF5E', '#B98B57', '#A2774A');
    } else if (th === 'zmierzch') {
      sky('#F0705F', '#FFD3A0');
      ctx.fillStyle = '#FFB347';
      ctx.beginPath();
      ctx.arc(720, 300 + run.progress * 80, 70, 0, Math.PI * 2);
      ctx.fill();
      // słońce czasem mruga jak oko
      if (g > 0.15 && Math.sin(t * 1.3) > 0.985) eye(720, 300 + run.progress * 80, 34);
      clouds('rgba(255,226,214,.8)', 0.08);
      hills('#D89AAE', GROUND - 30, 100, 0.15, 2);
      trees('#8A5E78', 0.35, GROUND - 10, 120, 210);
      hills('#B97C96', GROUND, 46, 0.3, 5);
      ground('#6FA552', '#9C6E45', '#875E3A');
    } else if (th === 'las') {
      sky('#0B1124', '#28325A');
      stars(0.03);
      ctx.fillStyle = '#E8E4C9';
      ctx.beginPath();
      ctx.arc(800, 86, 34, 0, Math.PI * 2);
      ctx.fill();
      trees('#1B2540', 0.2, GROUND - 20, 210, 120);
      trees('#121A2E', 0.45, GROUND, 260, 150);
      if (g > 0.32) forestEyes(g);
      ctx.fillStyle = 'rgba(160,175,220,.08)';
      ctx.fillRect(0, GROUND - 60, W, 60);
      ground('#2F4A30', '#2A2119', '#3A2E22');
    } else if (th === 'kuchnia') {
      kitchen(g);
    } else {
      dining(g);
    }
    // meta i punkt kontrolny
    const lv = run.level;
    const ex = lv.end - cam();
    if (ex < W + 200) door(ex, th);
    const cx = lv.checkpoint - cam();
    if (cx > -60 && cx < W + 60) flag(cx, run.checkpointHit);
  }

  function stars(par) {
    ctx.fillStyle = 'rgba(255,255,255,.8)';
    const off = cam() * par;
    for (let i = 0; i < 70; i++) {
      const x = ((i * 157 - off) % W + W) % W;
      const y = (i * 61) % 300;
      const s = (i % 3) * 0.6 + 0.8;
      ctx.fillRect(x, y, s, s);
    }
  }

  function forestEyes(g) {
    repeat(0.45, 330, (x, k) => {
      if ((k * 7) % 3 !== 0) return;
      const open = Math.sin(t * 0.8 + k) > 0.2 - g * 0.6;
      if (!open) return;
      ctx.fillStyle = `rgba(255,${g > 0.45 ? 40 : 200},40,.85)`;
      const y = GROUND - 120 - ((k * 13) % 80);
      ctx.fillRect(x - 8, y, 5, 3);
      ctx.fillRect(x + 4, y, 5, 3);
    });
  }

  function kitchen(g) {
    ctx.fillStyle = '#B7C6BE';
    ctx.fillRect(0, 0, W, GROUND);
    // kafelki
    ctx.strokeStyle = 'rgba(70,90,80,.35)';
    ctx.lineWidth = 1;
    const off = (cam() * 0.6) % 40;
    ctx.beginPath();
    for (let x = -off; x < W; x += 40) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, GROUND - 120);
    }
    for (let y = 0; y < GROUND - 120; y += 40) {
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    ctx.stroke();
    // blaty i szafki
    repeat(0.8, 300, (x, k) => {
      ctx.fillStyle = '#5E4630';
      ctx.fillRect(x, GROUND - 120, 280, 120);
      ctx.fillStyle = '#7A5A3A';
      ctx.fillRect(x, GROUND - 126, 290, 10);
      ctx.strokeStyle = '#3E2E1E';
      ctx.strokeRect(x + 12, GROUND - 106, 120, 96);
      ctx.strokeRect(x + 148, GROUND - 106, 120, 96);
      if (k % 2 === 0) {
        // wiszące noże na listwie
        ctx.fillStyle = '#4A4A4A';
        ctx.fillRect(x + 60, 150, 160, 8);
        for (let n = 0; n < 5; n++) {
          ctx.fillStyle = '#C9CED1';
          ctx.fillRect(x + 72 + n * 30, 158, 6, 38 + (n % 2) * 10);
          ctx.fillStyle = '#2B2B2B';
          ctx.fillRect(x + 71 + n * 30, 140, 8, 18);
        }
      }
    });
    // jarzeniówki
    repeat(1, 420, (x) => {
      ctx.fillStyle = '#E9F2EE';
      ctx.fillRect(x, 18, 140, 10);
    });
    ctx.fillStyle = '#D4D4CF';
    ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = '#9E9E98';
    const fo = cam() % 60;
    for (let x = -fo; x < W; x += 60) {
      ctx.fillRect(x, GROUND, 30, 55);
      ctx.fillRect(x + 30, GROUND + 55, 30, 55);
    }
    // migające światło
    const flick = Math.sin(t * 23) > 0.6 - g * 0.5 || Math.random() < g * 0.05 ? 0.55 + g * 0.25 : 0.25 + g * 0.2;
    ctx.fillStyle = `rgba(8,12,10,${flick})`;
    ctx.fillRect(0, 0, W, H);
  }

  function dining(g) {
    ctx.fillStyle = '#4A3F31';
    ctx.fillRect(0, 0, W, GROUND);
    // pas szachownicy na ścianie, jak w prawdziwej sali
    const off = (cam() * 0.6) % 24;
    for (let x = -off, k = Math.floor(cam() * 0.6 / 24); x < W; x += 24, k++) {
      ctx.fillStyle = k % 2 ? '#1C1A16' : '#D9D2C2';
      ctx.fillRect(x, 300, 24, 12);
      ctx.fillStyle = k % 2 ? '#D9D2C2' : '#1C1A16';
      ctx.fillRect(x, 312, 24, 12);
    }
    ctx.fillStyle = '#2E271E';
    ctx.fillRect(0, 324, W, GROUND - 324);
    // obrazy i kinkiety
    repeat(0.6, 360, (x, k) => {
      ctx.fillStyle = '#2B2116';
      ctx.fillRect(x, 140, 70, 88);
      ctx.fillStyle = '#6E5B44';
      ctx.fillRect(x + 8, 148, 54, 72);
      if (k % 2) {
        ctx.fillStyle = '#C9A15B';
        ctx.fillRect(x + 200, 180, 8, 26);
        const gl = ctx.createRadialGradient(x + 204, 178, 2, x + 204, 178, 60);
        gl.addColorStop(0, 'rgba(255,200,120,.55)');
        gl.addColorStop(1, 'rgba(255,200,120,0)');
        ctx.fillStyle = gl;
        ctx.fillRect(x + 144, 118, 120, 120);
      }
    });
    // czerwone zasłony
    repeat(0.6, 900, (x) => {
      ctx.fillStyle = '#5A1414';
      ctx.fillRect(x + 500, 40, 110, 284);
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      for (let k = 0; k < 4; k++) ctx.fillRect(x + 512 + k * 26, 40, 8, 284);
    });
    // stoły w tle: obrusy w kropki i czapeczki (blade, żeby nie udawały przeszkód)
    ctx.save();
    ctx.globalAlpha = 0.32;
    repeat(0.8, 420, (x) => {
      ctx.fillStyle = '#CFC6B4';
      ctx.fillRect(x, GROUND - 58, 150, 40);
      ctx.fillStyle = '#7A3A3A';
      for (let d = 0; d < 9; d++) ctx.fillRect(x + 8 + d * 16, GROUND - 50 + (d % 2) * 14, 4, 4);
      ctx.fillStyle = '#8E2B3A';
      ctx.beginPath();
      ctx.moveTo(x + 30, GROUND - 58);
      ctx.lineTo(x + 38, GROUND - 82);
      ctx.lineTo(x + 46, GROUND - 58);
      ctx.fill();
      ctx.fillStyle = '#6B5A3D';
      ctx.fillRect(x + 100, GROUND - 72, 12, 14);
    });
    ctx.restore();
    if (figure && figure.k !== 9) drawFigure(figure);
    // podłoga w szachownicę
    const fo = cam() % 120;
    for (let x = -fo, k = Math.floor(cam() / 60); x < W; x += 60, k++) {
      for (let r = 0; r < 2; r++) {
        ctx.fillStyle = (k + r) % 2 ? '#141311' : '#CFC8B8';
        ctx.fillRect(x, GROUND + r * 55, 60, 55);
      }
    }
    ctx.fillStyle = 'rgba(255,255,255,.05)';
    ctx.fillRect(0, GROUND, W, 4);
  }

  function drawFigure(f) {
    // ciemna sylwetka z burzą loków
    const s = f.k === 9 ? 2.3 : 0.9 + f.k * 0.3;
    const x = f.x;
    const base = GROUND;
    ctx.save();
    ctx.fillStyle = f.k === 9 ? 'rgba(10,8,6,.96)' : 'rgba(12,10,8,.85)';
    ctx.beginPath();
    ctx.ellipse(x, base - 70 * s, 26 * s, 60 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let k = 0; k < 9; k++) {
      ctx.beginPath();
      ctx.arc(x + Math.cos(k * 0.8) * 22 * s, base - 150 * s + Math.sin(k * 1.7) * 10 * s, 13 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(x, base - 140 * s, 18 * s, 0, Math.PI * 2);
    ctx.fill();
    // dłoń z błyskiem ostrza
    ctx.fillStyle = 'rgba(200,205,210,.75)';
    ctx.beginPath();
    ctx.moveTo(x - 30 * s, base - 70 * s);
    ctx.lineTo(x - 44 * s, base - 34 * s);
    ctx.lineTo(x - 36 * s, base - 70 * s);
    ctx.fill();
    ctx.restore();
  }

  function barn(x, base, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, base - 90, 120, 90);
    ctx.beginPath();
    ctx.moveTo(x - 10, base - 88);
    ctx.lineTo(x + 60, base - 140);
    ctx.lineTo(x + 130, base - 88);
    ctx.fill();
    ctx.fillStyle = '#F3E3C8';
    ctx.fillRect(x + 42, base - 54, 36, 54);
  }

  function fence(x, base, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, base - 34, 8, 34);
    ctx.fillRect(x - 26, base - 26, 60, 5);
    ctx.fillRect(x - 26, base - 14, 60, 5);
  }

  function eye(x, y, r) {
    ctx.fillStyle = '#FFF8E6';
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7A1010';
    ctx.beginPath();
    ctx.arc(x - r * 0.35, y + 2, r * 0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(x - r * 0.38, y + 2, r * 0.17, 0, Math.PI * 2);
    ctx.fill();
  }

  function door(x, th) {
    const dark = th === 'las' || th === 'kuchnia' || th === 'sala';
    ctx.fillStyle = dark ? '#2A1E14' : '#8A5A33';
    ctx.fillRect(x - 10, GROUND - 130, 90, 130);
    ctx.fillStyle = dark ? '#000' : '#3B2412';
    ctx.fillRect(x + 4, GROUND - 116, 62, 116);
    ctx.fillStyle = dark ? '#E0161B' : '#FFD23F';
    ctx.font = '700 14px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(th === 'sala' ? 'WYJŚCIE?' : 'DOM', x + 35, GROUND - 140);
  }

  function flag(x, hit) {
    ctx.fillStyle = '#6B5436';
    ctx.fillRect(x, GROUND - 70, 4, 70);
    ctx.fillStyle = hit ? '#FFD23F' : '#EFD7B3';
    ctx.beginPath();
    ctx.moveTo(x + 4, GROUND - 70);
    ctx.lineTo(x + 34, GROUND - 60);
    ctx.lineTo(x + 4, GROUND - 50);
    ctx.fill();
  }

  /* ---------- Rysowanie: przeszkody ---------- */

  function drawObstacles() {
    const th = run.stage.theme;
    const c = cam();
    for (const p of run.level.pits) {
      const x = p.x - c;
      if (x > W + 20 || x + p.w < -20) continue;
      ctx.fillStyle = th === 'kuchnia' ? '#050505' : th === 'las' ? '#05070A' : '#2A1C10';
      ctx.fillRect(x, GROUND, p.w, H - GROUND);
      ctx.fillStyle = th === 'dzien' ? '#4A90B8' : 'rgba(0,0,0,.6)';
      ctx.fillRect(x, H - 40, p.w, 40);
    }
    for (const o of run.level.obstacles) {
      const x = o.x - c;
      if (x > W + 40 || x + o.w < -40) continue;
      if (o.kind === 'high') drawHigh(o, x, th);
      else drawBlock(o, x, th);
    }
  }

  function drawBlock(o, x, th) {
    const y = GROUND - o.h;
    const alt = o.v % 2;
    if (th === 'dzien') {
      if (o.kind === 'tall') crates(x, y, o.w, o.h, '#C98B4A', '#7A4D24');
      else if (alt) {
        ctx.fillStyle = '#E8C35A';
        ctx.fillRect(x, y, o.w, o.h);
        ctx.strokeStyle = '#B8902E';
        ctx.lineWidth = 2;
        for (let k = 6; k < o.h; k += 8) {
          ctx.beginPath();
          ctx.moveTo(x, y + k);
          ctx.lineTo(x + o.w, y + k);
          ctx.stroke();
        }
      } else {
        ctx.fillStyle = '#FFFFFF';
        for (let k = 0; k < o.w; k += 12) ctx.fillRect(x + k, y, 8, o.h);
        ctx.fillRect(x, y + o.h * 0.3, o.w, 5);
      }
    } else if (th === 'zmierzch') {
      if (o.kind === 'tall') {
        ctx.fillStyle = '#5C3D27';
        ctx.fillRect(x, y, o.w, o.h);
        ctx.fillStyle = '#7A5236';
        ctx.fillRect(x - 4, y, o.w + 8, 8);
      } else {
        ctx.fillStyle = alt ? '#8A8A8A' : '#6E4A2E';
        ctx.beginPath();
        ctx.ellipse(x + o.w / 2, y + o.h * 0.55, o.w / 2 + 2, o.h * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (th === 'las') {
      if (o.kind === 'tall') {
        ctx.fillStyle = '#2E2219';
        ctx.fillRect(x, y, o.w, o.h);
        ctx.strokeStyle = '#1A130D';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x + o.w / 2, y);
        ctx.lineTo(x + o.w / 2 + 14, y - 18);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#16251A';
        ctx.beginPath();
        ctx.ellipse(x + o.w / 2, y + o.h * 0.6, o.w / 2 + 3, o.h * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#3B5A3F';
        ctx.lineWidth = 2;
        for (let k = 0; k < 6; k++) {
          const a = -Math.PI * (0.1 + k * 0.16);
          ctx.beginPath();
          ctx.moveTo(x + o.w / 2, y + o.h * 0.6);
          ctx.lineTo(x + o.w / 2 + Math.cos(a) * (o.w / 2 + 8), y + o.h * 0.6 + Math.sin(a) * (o.h * 0.8));
          ctx.stroke();
        }
      }
    } else if (th === 'kuchnia') {
      if (o.kind === 'tall') crates(x, y, o.w, o.h, '#6B6F72', '#3A3D40');
      else if (alt) {
        // garnek
        ctx.fillStyle = '#3F4448';
        ctx.fillRect(x, y + 6, o.w, o.h - 6);
        ctx.fillStyle = '#5B6166';
        ctx.fillRect(x - 4, y + 2, o.w + 8, 6);
        ctx.fillRect(x - 8, y + 12, 6, 4);
        ctx.fillRect(x + o.w + 2, y + 12, 6, 4);
      } else {
        // stos talerzy
        for (let k = 0; k < o.h; k += 6) {
          ctx.fillStyle = k % 12 ? '#E7E3DA' : '#C9C4B8';
          ctx.fillRect(x, GROUND - k - 6, o.w, 5);
        }
      }
    } else {
      if (o.kind === 'tall') {
        // krzesła ustawione jedno na drugim
        for (let k = 0; k < o.h; k += 30) chair(x, GROUND - k, o.w, Math.min(30, o.h - k));
      } else chair(x, GROUND, o.w, o.h);
    }
  }

  function crates(x, y, w, h, fill, edge) {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = edge;
    ctx.lineWidth = 2;
    for (let k = 0; k < h; k += w) {
      ctx.strokeRect(x + 1, y + k + 1, w - 2, Math.min(w, h - k) - 2);
      ctx.beginPath();
      ctx.moveTo(x + 2, y + k + 2);
      ctx.lineTo(x + w - 2, y + Math.min(k + w, h) - 2);
      ctx.stroke();
    }
  }

  function chair(x, base, w, h) {
    ctx.strokeStyle = '#0E0D0B';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x + 3, base);
    ctx.lineTo(x + 3, base - h);
    ctx.moveTo(x + w - 3, base);
    ctx.lineTo(x + w - 3, base - h * 0.55);
    ctx.moveTo(x + 3, base - h * 0.55);
    ctx.lineTo(x + w - 3, base - h * 0.55);
    ctx.stroke();
    ctx.fillStyle = '#26221C';
    ctx.fillRect(x, base - h * 0.6, w, 5);
  }

  function drawHigh(o, x, th) {
    const bottom = GROUND - o.h;
    if (th === 'las') {
      // gałąź z gęstymi liśćmi zwisa nisko nad ścieżką
      ctx.strokeStyle = '#2A1E14';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(x - 60, 0);
      ctx.quadraticCurveTo(x + o.w * 0.2, bottom - 70, x + o.w / 2, bottom - 26);
      ctx.stroke();
      ctx.fillStyle = '#1E3322';
      for (let k = 0; k < 5; k++) {
        ctx.beginPath();
        ctx.ellipse(x + (k / 4) * o.w, bottom - 16 - (k % 2) * 8, 16, 14, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#2C4A31';
      ctx.fillRect(x + 4, bottom - 6, o.w - 8, 4);
    } else if (th === 'kuchnia') {
      ctx.strokeStyle = '#2B2B2B';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + o.w / 2, 0);
      ctx.lineTo(x + o.w / 2, bottom - 30);
      ctx.stroke();
      // wiszący tasak
      ctx.fillStyle = '#C9CED1';
      ctx.fillRect(x, bottom - 30, o.w, 30);
      ctx.fillStyle = '#2B2B2B';
      ctx.fillRect(x + o.w / 2 - 5, bottom - 42, 10, 14);
      ctx.fillStyle = 'rgba(140,20,20,.6)';
      ctx.fillRect(x + 3, bottom - 6, o.w - 6, 4);
    } else {
      // lampa na kablu
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + o.w / 2, 0);
      ctx.lineTo(x + o.w / 2, bottom - 26);
      ctx.stroke();
      ctx.fillStyle = '#2A2A26';
      ctx.beginPath();
      ctx.moveTo(x, bottom);
      ctx.lineTo(x + o.w * 0.3, bottom - 26);
      ctx.lineTo(x + o.w * 0.7, bottom - 26);
      ctx.lineTo(x + o.w, bottom);
      ctx.fill();
      const on = Math.sin(t * 17 + o.v) > -0.6;
      if (on) {
        const gl = ctx.createRadialGradient(x + o.w / 2, bottom, 2, x + o.w / 2, bottom + 40, 90);
        gl.addColorStop(0, 'rgba(255,214,140,.5)');
        gl.addColorStop(1, 'rgba(255,214,140,0)');
        ctx.fillStyle = gl;
        ctx.fillRect(x - 60, bottom, o.w + 120, 140);
      }
    }
  }

  function drawGrains() {
    const c = cam();
    const g = glitch();
    run.level.grains.forEach((gr, k) => {
      if (run.got.has(k)) return;
      const x = gr.x - c;
      if (x < -20 || x > W + 20) return;
      const bob = Math.sin(t * 4 + k) * 3;
      ctx.fillStyle = g > 0.6 && (k + Math.floor(t * 3)) % 7 === 0 ? '#E0161B' : '#F4C542';
      ctx.beginPath();
      ctx.ellipse(x, gr.y + bob, 5, 7, 0.4, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  /* ---------- Rysowanie: Pip ---------- */

  function drawPip() {
    const g = glitch();
    let x = PIP_X;
    let y = run.y;
    if (state === 'dead') {
      const k = Math.min(1, deadT * 3);
      ctx.save();
      ctx.globalAlpha = 1 - k * 0.8;
      ctx.translate(x, y - 6);
      ctx.scale(1 + k * 0.4, 1 - k * 0.6);
      ctx.fillStyle = '#FFD23F';
      ctx.beginPath();
      ctx.arc(0, -8, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    if (g > 0.5 && Math.random() < g * 0.08) x += rnd(-4, 4);
    const airborne = !run.onGround;
    const turned = state === 'finale' && finT > 2.0;
    ctx.save();
    ctx.translate(x, y);
    if (turned) ctx.scale(-1, 1);
    // nogi
    ctx.strokeStyle = '#E07B00';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    const moving = state === 'play' || (state === 'done' && doneT < 0.8) || (state === 'finale' && finT < 1);
    const ph = moving ? Math.sin(t * 22) : 0;
    ctx.beginPath();
    if (airborne) {
      ctx.moveTo(-4, -6);
      ctx.lineTo(-8, -1);
      ctx.moveTo(4, -6);
      ctx.lineTo(1, -1);
    } else {
      ctx.moveTo(-4, -6);
      ctx.lineTo(-4 + ph * 5, 0);
      ctx.moveTo(4, -6);
      ctx.lineTo(4 - ph * 5, 0);
    }
    ctx.stroke();
    // ciało
    const bodyY = -PIP_H / 2 - 2 + (moving && !airborne ? Math.abs(ph) * -2 : 0);
    ctx.fillStyle = '#FFD23F';
    ctx.beginPath();
    ctx.ellipse(0, bodyY, 16, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-3, bodyY - 13);
    ctx.quadraticCurveTo(-2, bodyY - 22, 2, bodyY - 15);
    ctx.quadraticCurveTo(5, bodyY - 21, 4, bodyY - 12);
    ctx.fill();
    // skrzydełko
    ctx.fillStyle = '#F2B90F';
    ctx.beginPath();
    const wing = flapAnim > 0 ? Math.sin(flapAnim * 40) * 0.9 - 0.6 : 0.2;
    ctx.ellipse(-5, bodyY + 3, 8, 5, wing, 0, Math.PI * 2);
    ctx.fill();
    // dziób
    ctx.fillStyle = '#F08A00';
    ctx.beginPath();
    ctx.moveTo(13, bodyY - 2);
    ctx.lineTo(21, bodyY + 1);
    ctx.lineTo(13, bodyY + 4);
    ctx.fill();
    // oko: zwykłe, a potem coraz częściej puste i czarne
    const hollow = turned || g > 0.82 || eyesT > 0;
    if (hollow) {
      ctx.fillStyle = '#050505';
      ctx.beginPath();
      ctx.ellipse(7, bodyY - 4, 4.2, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();
      if (g > 0.6 || turned) {
        ctx.fillStyle = '#E0161B';
        ctx.fillRect(6.5, bodyY - 4, 1.6, 1.6);
      }
    } else {
      ctx.fillStyle = '#2A2118';
      ctx.beginPath();
      ctx.arc(7, bodyY - 4, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillRect(7.5, bodyY - 5.5, 1.2, 1.2);
    }
    ctx.restore();
  }

  /* ---------- Rysowanie: HUD i efekty ---------- */

  function drawHud() {
    const g = glitch();
    const dark = run.i >= 2;
    ctx.save();
    ctx.font = '700 15px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = dark ? 'rgba(235,230,215,.85)' : 'rgba(21,32,28,.8)';
    if (run.i < STAGES.length - 1) ctx.fillText(hud.name, 22, 32);
    // ziarenka
    ctx.fillStyle = '#F4C542';
    ctx.beginPath();
    ctx.ellipse(28, 54, 5, 7, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = dark ? 'rgba(235,230,215,.85)' : 'rgba(21,32,28,.8)';
    const got = run.got.size;
    ctx.fillText(g > 0.6 && Math.random() < 0.1 ? '237' : String(got), 42, 59);
    // pasek drogi do domu
    const bw = 220;
    const bx = W / 2 - bw / 2;
    ctx.fillStyle = dark ? 'rgba(255,255,255,.18)' : 'rgba(21,32,28,.18)';
    ctx.fillRect(bx, 24, bw, 6);
    ctx.fillStyle = run.i >= 3 ? '#E0161B' : '#FFD23F';
    ctx.fillRect(bx, 24, bw * run.progress, 6);
    ctx.restore();
  }

  // Napisy z nagrania z kamery (ostatni etap): narożniki, REC i zegar zbliżający się do 02:37:21.
  function drawCamera() {
    const p = state === 'play' ? run.progress : 1;
    const total = 36 * 60 + 41 + Math.floor(p * 40); // od 02:36:41 do 02:37:21
    const s = total + Math.floor(Math.max(0, finT));
    const hh = '02';
    const mm = String(Math.floor(s / 60) % 60).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    ctx.save();
    ctx.strokeStyle = 'rgba(235,230,215,.75)';
    ctx.lineWidth = 2;
    const m = 18;
    const L = 34;
    [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]].forEach(([x, y, dx, dy]) => {
      ctx.beginPath();
      ctx.moveTo(x, y + dy * L);
      ctx.lineTo(x, y);
      ctx.lineTo(x + dx * L, y);
      ctx.stroke();
    });
    ctx.font = '500 22px "JetBrains Mono", ui-monospace, monospace';
    ctx.fillStyle = 'rgba(235,230,215,.85)';
    ctx.textAlign = 'left';
    ctx.fillText('CAM 05', 40, 52);
    ctx.fillText('SALA', 40, 80);
    ctx.textAlign = 'right';
    ctx.fillText(`28-10-2023  ${hh}:${mm}:${ss}`, W - 40, 104);
    if (Math.floor(t * 1.4) % 2 === 0) {
      ctx.fillStyle = '#E0161B';
      ctx.fillText('● REC', W - 40, 132);
    }
    ctx.restore();
  }

  function postFx() {
    const g = glitch();
    const cw = canvas.width;
    const ch = canvas.height;
    const sc = cw / W;
    // ciemniejsze i odbarwione etapy
    if (run.i >= 3) {
      ctx.save();
      ctx.globalCompositeOperation = 'saturation';
      ctx.globalAlpha = Math.min(0.95, 0.3 + g * 0.65);
      ctx.fillStyle = 'hsl(0, 0%, 50%)';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    if (run.i >= 4) {
      // światło tylko wokół Pipa
      const v = ctx.createRadialGradient(PIP_X + 60, run.y - 20, 30, PIP_X + 60, run.y - 20, 560);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(0.5, 'rgba(0,0,0,.35)');
      v.addColorStop(1, 'rgba(0,0,0,.82)');
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(60,40,15,.12)';
      ctx.fillRect(0, 0, W, H);
    }
    // przesunięte paski obrazu
    if (sliceT > 0) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      for (const s of slices) {
        const y = Math.floor(s.y * ch);
        const h = Math.max(2, Math.floor(s.h * ch));
        ctx.drawImage(canvas, 0, y, cw, h, Math.floor(s.dx * cw), y, cw, h);
      }
      ctx.restore();
    }
    // rozjechane kolory (czerwony kanał przesunięty)
    if (rgbT > 0) {
      if (buf.width !== cw || buf.height !== ch) {
        buf.width = cw;
        buf.height = ch;
      }
      bctx.globalCompositeOperation = 'copy';
      bctx.drawImage(canvas, 0, 0);
      bctx.globalCompositeOperation = 'multiply';
      bctx.fillStyle = '#FF0000';
      bctx.fillRect(0, 0, cw, ch);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = '#00FFFF';
      ctx.fillRect(0, 0, cw, ch);
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(buf, Math.round((6 + g * 14) * sc), 0);
      ctx.restore();
    }
    // linie jak na starym monitorze i szum
    if (g > 0.2) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.6, g * 0.55);
      ctx.fillStyle = scan;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    const noiseA = staticT > 0 ? 0.85 : g > 0.25 ? g * 0.14 : 0;
    if (noiseA > 0) {
      ctx.save();
      ctx.globalAlpha = noiseA;
      ctx.fillStyle = noiseTiles[Math.floor(Math.random() * noiseTiles.length)];
      ctx.translate(rnd(-80, 0), rnd(-80, 0));
      ctx.fillRect(0, 0, W + 80, H + 80);
      ctx.restore();
    }
    if (invT > 0) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'difference';
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, cw, ch);
      ctx.restore();
    }
  }

  function drawMessages() {
    for (const m of msgs) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, m.life * 4);
      ctx.font = `900 ${m.size}px Unbounded, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = m.color;
      const jx = m.fixed ? 0 : rnd(-2, 2);
      ctx.fillText(m.text, m.x + jx, m.y);
      ctx.restore();
    }
    if (state === 'dead' && deadT > 0.25) {
      ctx.save();
      ctx.font = '900 34px Unbounded, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = run.i >= 2 ? '#E0161B' : '#FFFFFF';
      ctx.strokeStyle = 'rgba(0,0,0,.4)';
      ctx.lineWidth = 6;
      const text = run.i >= 2 ? corrupt(DEATH_TEXT[run.i], 0.2 + run.glitch * 0.3) : DEATH_TEXT[run.i];
      ctx.strokeText(text, W / 2, H / 2 - 40);
      ctx.fillText(text, W / 2, H / 2 - 40);
      ctx.restore();
    }
  }

  function draw() {
    view.begin();
    ctx.save();
    if (shake > 0) ctx.translate(rnd(-8, 8) * shake, rnd(-6, 6) * shake);
    drawWorld();
    drawObstacles();
    drawGrains();
    if (run.i === STAGES.length - 1 && figure && figure.k === 9) drawFigure(figure);
    drawPip();
    parts.forEach((p) => {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2));
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size * 0.6);
    });
    ctx.globalAlpha = 1;
    ctx.restore();
    postFx();
    if (run.i === STAGES.length - 1) drawCamera();
    else drawHud();
    drawMessages();
    if (state === 'over' || (state === 'finale' && finT > 4.1)) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
    }
  }

  const ticker = loop((dt) => {
    if (state === 'paused') return;
    update(dt);
    if (run) draw();
  });

  /* ---------- Sterowanie ---------- */

  const onPointer = (e) => {
    if (e.target.closest('button, a')) return;
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    press();
  };
  const onKey = (e) => {
    if (e.target.closest && e.target.closest('input, textarea, select, dialog')) return;
    if ([' ', 'ArrowUp', 'w', 'W'].includes(e.key)) {
      if (state === 'play') {
        e.preventDefault();
        if (!e.repeat) press();
      }
    }
  };
  stage.addEventListener('pointerdown', onPointer);
  window.addEventListener('keydown', onKey);

  return {
    start(i, fromCheckpoint) {
      audio.unlock();
      start(i, fromCheckpoint);
    },
    pause() {
      if (state === 'paused' || state === 'idle') return;
      pausedFrom = state;
      state = 'paused';
      audio.stopMusic();
    },
    resume() {
      if (state !== 'paused') return;
      state = pausedFrom || 'play';
      if (state === 'play' && run) {
        audio.stage(run.i);
        musicStage = run.i;
      }
    },
    setMuted(m) {
      audio.setMuted(m);
    },
    get state() {
      return state;
    },
    get run() {
      return run;
    },
    destroy() {
      ticker.stop();
      audio.close();
      stage.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
      view.destroy();
    },
  };
}
