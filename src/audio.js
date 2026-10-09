// All game audio: chase music, positional "tung" knocks, fluorescent hum, footsteps, jumpscare.
// The published build serves the track under a simpler name (see build.py).
const MUSIC_URL = window.TRIPLE_T_MUSIC || 'sound/' + encodeURIComponent('Doobie Scoot Canoe without rap part.mp3');

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.chasing = false;
  }

  // Must be called from a user gesture.
  init() {
    if (this.ctx) {
      this.ctx.resume();
      return;
    }
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(ctx.destination);

    this.music = new Audio(MUSIC_URL);
    this.music.loop = true;
    this.music.preload = 'auto';
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = 0;
    ctx.createMediaElementSource(this.music).connect(this.musicGain).connect(this.master);

    this.knockBuf = this.makeKnock(1);
    this.knockBufLow = this.makeKnock(0.82);
    this.stepBuf = this.makeStep();
    this.noiseBuf = this.makeNoise(1.5);

    // Tung's positional chain: muffled through walls when he has no line of sight.
    this.tungFilter = ctx.createBiquadFilter();
    this.tungFilter.type = 'lowpass';
    this.tungFilter.frequency.value = 6000;
    this.tungPanner = ctx.createPanner();
    Object.assign(this.tungPanner, {
      panningModel: 'HRTF', distanceModel: 'inverse', refDistance: 2.5, maxDistance: 80, rolloffFactor: 1.25,
    });
    this.tungFilter.connect(this.tungPanner).connect(this.master);

    this.startHum();
  }

  makeKnock(pitch) {
    const sr = this.ctx.sampleRate, len = Math.floor(sr * 0.45);
    const buf = this.ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    const f0 = 205 * pitch;
    let peak = 0;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const body = Math.sin(2 * Math.PI * f0 * t * (1 + 0.18 * Math.exp(-t * 40))) * Math.exp(-t * 16);
      const ring = 0.4 * Math.sin(2 * Math.PI * f0 * 2.76 * t) * Math.exp(-t * 34);
      const hollow = 0.25 * Math.sin(2 * Math.PI * f0 * 0.5 * t) * Math.exp(-t * 9);
      const click = (Math.random() * 2 - 1) * Math.exp(-t * 160) * 0.6;
      d[i] = body + ring + hollow + click;
      peak = Math.max(peak, Math.abs(d[i]));
    }
    for (let i = 0; i < len; i++) d[i] /= peak;
    return buf;
  }

  makeStep() {
    const sr = this.ctx.sampleRate, len = Math.floor(sr * 0.14);
    const buf = this.ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      lp += ((Math.random() * 2 - 1) - lp) * 0.08;
      d[i] = lp * Math.exp(-t * 35) * 3 + Math.sin(2 * Math.PI * 70 * t) * Math.exp(-t * 40) * 0.5;
    }
    return buf;
  }

  makeNoise(seconds) {
    const sr = this.ctx.sampleRate, len = Math.floor(sr * seconds);
    const buf = this.ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  startHum() {
    const ctx = this.ctx;
    this.humGain = ctx.createGain();
    this.humGain.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 520;
    const saw = ctx.createOscillator();
    saw.type = 'sawtooth';
    saw.frequency.value = 120;
    const sawG = ctx.createGain();
    sawG.gain.value = 0.35;
    const sine = ctx.createOscillator();
    sine.frequency.value = 60;
    const whine = ctx.createOscillator();
    whine.frequency.value = 7800;
    const whineG = ctx.createGain();
    whineG.gain.value = 0.015;
    saw.connect(sawG).connect(lp);
    sine.connect(lp);
    lp.connect(this.humGain);
    whine.connect(whineG).connect(this.humGain);
    this.humGain.connect(this.master);
    saw.start();
    sine.start();
    whine.start();
  }

  setHum(level) {
    if (!this.ctx) return;
    this.humGain.gain.setTargetAtTime(0.05 * level, this.ctx.currentTime, 0.03);
  }

  updateListener(camera) {
    if (!this.ctx) return;
    const l = this.ctx.listener, p = camera.position;
    const f = camera.getWorldDirection(this._f || (this._f = camera.position.clone()));
    const t = this.ctx.currentTime;
    if (l.positionX) {
      l.positionX.setValueAtTime(p.x, t);
      l.positionY.setValueAtTime(p.y, t);
      l.positionZ.setValueAtTime(p.z, t);
      l.forwardX.setValueAtTime(f.x, t);
      l.forwardY.setValueAtTime(f.y, t);
      l.forwardZ.setValueAtTime(f.z, t);
      l.upX.setValueAtTime(0, t);
      l.upY.setValueAtTime(1, t);
      l.upZ.setValueAtTime(0, t);
    } else {
      l.setPosition(p.x, p.y, p.z);
      l.setOrientation(f.x, f.y, f.z, 0, 1, 0);
    }
  }

  setTung(pos, visible) {
    if (!this.ctx) return;
    const p = this.tungPanner, t = this.ctx.currentTime;
    if (p.positionX) {
      p.positionX.setValueAtTime(pos.x, t);
      p.positionY.setValueAtTime(2.2, t);
      p.positionZ.setValueAtTime(pos.z, t);
    } else p.setPosition(pos.x, 2.2, pos.z);
    this.tungFilter.frequency.setTargetAtTime(visible ? 6000 : 700, t, 0.15);
  }

  // "tung tung tung" from Tung's position.
  knocks(count, spacing) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < count; i++) {
      const src = this.ctx.createBufferSource();
      src.buffer = i === count - 1 ? this.knockBufLow : this.knockBuf;
      src.playbackRate.value = 1 + (Math.random() - 0.5) * 0.05;
      const g = this.ctx.createGain();
      g.gain.value = 1.4;
      src.connect(g).connect(this.tungFilter);
      src.start(now + i * spacing);
    }
  }

  step(loud) {
    if (!this.ctx) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.stepBuf;
    src.playbackRate.value = 0.9 + Math.random() * 0.2;
    const g = this.ctx.createGain();
    g.gain.value = loud ? 0.22 : 0.12;
    src.connect(g).connect(this.master);
    src.start();
  }

  zap(dist) {
    if (!this.ctx) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2500;
    bp.Q.value = 3;
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(0.08 * Math.max(0, 1 - dist / 10), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t, Math.random(), 0.1);
  }

  startChaseMusic() {
    if (!this.ctx) return;
    this.chasing = true;
    clearTimeout(this.musicStopTimer);
    if (this.music.paused) {
      this.music.currentTime = 0;
      this.music.play().catch(() => {});
    }
    this.musicGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.musicGain.gain.setTargetAtTime(0.85, this.ctx.currentTime, 0.15);
  }

  stopChaseMusic(fade = 1.0) {
    if (!this.ctx) return;
    this.chasing = false;
    this.musicGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.musicGain.gain.setTargetAtTime(0, this.ctx.currentTime, fade);
    clearTimeout(this.musicStopTimer);
    this.musicStopTimer = setTimeout(() => {
      if (!this.chasing) this.music.pause();
    }, fade * 5000);
  }

  jumpscare() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const n = ctx.createBufferSource();
    n.buffer = this.noiseBuf;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.7, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    n.connect(ng).connect(this.master);
    n.start(t);
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(420, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 1.1);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.5, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 1.3);
    o.connect(og).connect(this.master);
    o.start(t);
    o.stop(t + 1.4);
    for (let i = 0; i < 4; i++) {
      const k = ctx.createBufferSource();
      k.buffer = this.knockBufLow;
      k.playbackRate.value = 0.7;
      const kg = ctx.createGain();
      kg.gain.value = 1.6;
      k.connect(kg).connect(this.master);
      k.start(t + i * 0.09);
    }
  }

  // The bat connecting.
  hit() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const k = ctx.createBufferSource();
    k.buffer = this.knockBufLow;
    k.playbackRate.value = 0.55;
    const g = ctx.createGain();
    g.gain.value = 2.2;
    k.connect(g).connect(this.master);
    k.start(t);
  }

  // Tung's actual voice, via the browser's speech synthesis (deep and fast, Indonesian voice if available).
  speak(text, { pitch = 0.1, rate = 1.15, volume = 1, lang = 'id' } = {}) {
    if (!('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    const voices = speechSynthesis.getVoices();
    const voice = voices.find((v) => v.lang.startsWith(lang)) || voices.find((v) => v.lang.startsWith('en'));
    if (voice) u.voice = voice;
    u.pitch = pitch;
    u.rate = rate;
    u.volume = volume;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }

  // Metal Gear style "!" alert blip.
  alert() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    [[880, 0], [1320, 0.07]].forEach(([f, d]) => {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.12, t + d);
      g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.25);
      o.connect(g).connect(this.master);
      o.start(t + d);
      o.stop(t + d + 0.3);
    });
  }

  pauseAll() {
    this.ctx?.suspend();
    if ('speechSynthesis' in window) speechSynthesis.pause();
  }

  resumeAll() {
    this.ctx?.resume();
    if ('speechSynthesis' in window) speechSynthesis.resume();
  }

  silence() {
    if (!this.ctx) return;
    this.stopChaseMusic(0.3);
    this.setHum(0);
  }
}
