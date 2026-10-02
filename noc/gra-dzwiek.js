/* Pięć Koszmarnych Nocy u Magdy Gessler: dźwięk (WebAudio). Pętle bez przerw, głośność i strona (lewo/prawo) dla każdego dźwięku. */

export class Dzwiek {
  constructor() {
    this.ac = null;
    this.raw = new Map(); // zakodowane MP3, czekają na odkodowanie
    this.buf = new Map();
    this.pending = new Map();
    this.loops = new Map();
    this.active = new Set();
  }

  /** Uruchamia dźwięk (musi być wywołane po kliknięciu albo stuknięciu). */
  init() {
    if (this.ac) {
      if (this.ac.state === 'suspended') this.ac.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ac = new AC();
    if (this.ac.state === 'suspended') this.ac.resume().catch(() => {});
    // Zwykłe dźwięki idą przez lekki kompresor, jumpscare'y osobno (mają być głośne).
    this.out = this.ac.createGain();
    const comp = this.ac.createDynamicsCompressor();
    comp.threshold.value = -8;
    comp.knee.value = 6;
    comp.ratio.value = 4;
    comp.attack.value = 0.005;
    comp.release.value = 0.2;
    this.out.connect(comp).connect(this.ac.destination);
    this.loud = this.ac.createGain();
    this.loud.connect(this.ac.destination);
    for (const id of this.raw.keys()) this.decode(id);
  }

  add(id, bytes) {
    // kopia, bo odkodowanie „zabiera” bufor
    this.raw.set(id, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    if (this.ac) this.decode(id);
  }

  decode(id) {
    if (this.pending.has(id)) return this.pending.get(id);
    const raw = this.raw.get(id);
    if (!raw || !this.ac) return Promise.resolve(this.buf.get(id) || null);
    const p = new Promise((resolve) => {
      const ok = (b) => {
        this.buf.set(id, b);
        this.raw.delete(id);
        resolve(b);
      };
      try {
        const r = this.ac.decodeAudioData(raw, ok, () => resolve(null));
        if (r && r.catch) r.catch(() => resolve(null));
      } catch {
        resolve(null);
      }
    });
    this.pending.set(id, p);
    return p;
  }

  /** Czeka, aż podane dźwięki będą gotowe do grania. */
  ready(ids) {
    return Promise.all(ids.map((id) => this.decode(id)));
  }

  /** Zwalnia pamięć po dźwięku, który już nie będzie potrzebny. */
  drop(id) {
    this.buf.delete(id);
    this.raw.delete(id);
    this.pending.delete(id);
  }

  has(id) {
    return this.buf.has(id);
  }

  duration(id) {
    const b = this.buf.get(id);
    return b ? b.duration : 0;
  }

  get now() {
    return this.ac ? this.ac.currentTime : 0;
  }

  /**
   * Gra dźwięk. Opcje: gain, rate, pan (-1 lewo … 1 prawo), loud (bez kompresora), offset, loop, fadeIn.
   * Zwraca uchwyt z metodami stop(fade) i gain(v, czas).
   */
  play(id, { gain = 1, rate = 1, pan = 0, loud = false, offset = 0, loop = false, fadeIn = 0 } = {}) {
    const b = this.buf.get(id);
    if (!this.ac || !b) return { stopped: true, stop() {}, gain() {}, ended: Promise.resolve() };
    const ac = this.ac;
    const src = ac.createBufferSource();
    src.buffer = b;
    src.playbackRate.value = rate;
    if (loop) {
      // MP3 ma na początku i końcu odrobinę ciszy: pętla ją omija
      src.loop = true;
      src.loopStart = Math.min(0.05, b.duration / 4);
      src.loopEnd = Math.max(src.loopStart + 0.1, b.duration - 0.05);
    }
    const g = ac.createGain();
    const t0 = ac.currentTime;
    if (fadeIn > 0) {
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(gain, t0 + fadeIn);
    } else {
      g.gain.value = gain;
    }
    let node = src.connect(g);
    if (pan && ac.createStereoPanner) {
      const p = ac.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      node = node.connect(p);
    }
    node.connect(loud ? this.loud : this.out);
    src.start(t0, loop ? Math.min(offset, b.duration - 0.1) : offset);
    let done;
    const ended = new Promise((r) => {
      done = r;
    });
    const h = {
      src,
      g,
      stopped: false,
      ended,
      stop: (fade = 0) => {
        if (h.stopped) return;
        h.stopped = true;
        const t = ac.currentTime;
        try {
          g.gain.cancelScheduledValues(t);
          g.gain.setValueAtTime(g.gain.value, t);
          g.gain.linearRampToValueAtTime(0.0001, t + Math.max(0.01, fade));
          src.stop(t + Math.max(0.01, fade) + 0.02);
        } catch {
          /* już zatrzymany */
        }
      },
      gain: (v, time = 0.08) => {
        const t = ac.currentTime;
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(g.gain.value, t);
        g.gain.linearRampToValueAtTime(v, t + time);
      },
    };
    src.onended = () => {
      this.active.delete(h);
      h.stopped = true;
      done();
    };
    this.active.add(h);
    return h;
  }

  /** Pętla pod nazwą (np. 'fan'); drugi raz ta sama nazwa tylko zmienia głośność. */
  loop(key, id = key, { gain = 1, fadeIn = 0.3, pan = 0 } = {}) {
    const cur = this.loops.get(key);
    if (cur && !cur.stopped) {
      cur.gain(gain, fadeIn || 0.08);
      return cur;
    }
    const h = this.play(id, { gain, loop: true, fadeIn, pan, offset: Math.random() * Math.max(0, this.duration(id) - 1) });
    if (!h.stopped) this.loops.set(key, h);
    return h;
  }

  loopGain(key, v, time = 0.15) {
    const h = this.loops.get(key);
    if (h && !h.stopped) h.gain(v, time);
  }

  stopLoop(key, fade = 0.2) {
    const h = this.loops.get(key);
    if (h) h.stop(fade);
    this.loops.delete(key);
  }

  /** Cisza: zatrzymuje wszystko (z krótkim wyciszeniem). */
  stopAll(fade = 0.1, except = null) {
    for (const h of [...this.active]) if (h !== except) h.stop(fade);
    this.loops.clear();
  }

  suspend() {
    if (this.ac && this.ac.state === 'running') this.ac.suspend().catch(() => {});
  }

  resume() {
    if (this.ac && this.ac.state === 'suspended') this.ac.resume().catch(() => {});
  }
}
