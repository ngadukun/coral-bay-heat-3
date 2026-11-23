// sound.js — every sound is synthesised live with WebAudio; no audio files.
// Engine hum, sirens, gunshots, horns, chimes, rain, gulls and a menu groove.
export class Sound {
  constructor() {
    this.ctx = null; this.master = null; this.started = false;
    this.engineOsc = null; this.engineGain = null; this.sirenOsc = null; this.sirenGain = null;
    this.musicTimer = null; this.step = 0; this.duck = 1;
  }
  init() {
    if (this.started) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.started = true;
      this._engine(); this._siren(); this._music();
    } catch { /* audio unavailable — game stays silent */ }
  }
  _osc(type, freq, gainVal) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq; g.gain.value = gainVal;
    o.connect(g); g.connect(this.master); o.start();
    return { o, g };
  }
  _engine() {
    const e = this._osc('sawtooth', 55, 0.0);
    this.engineOsc = e.o; this.engineGain = e.g;
    const sub = this._osc('square', 28, 0.0); this.engineSub = sub.g;
  }
  setEngine(on, speedRatio, driving) {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    const target = driving ? 0.05 + speedRatio * 0.05 : 0.0;
    this.engineGain.gain.setTargetAtTime(target, t, 0.08);
    this.engineSub.gain.setTargetAtTime(driving ? 0.03 : 0, t, 0.08);
    this.engineOsc.frequency.setTargetAtTime(50 + speedRatio * 165, t, 0.05);
  }
  _siren() {
    const s = this._osc('triangle', 700, 0.0);
    this.sirenOsc = s.o; this.sirenGain = s.g; this.sirenT = 0;
  }
  setSiren(level, dt) {
    if (!this.started) return;
    this.sirenT += dt;
    const f = 660 + Math.sin(this.sirenT * 6.2) * 190;
    this.sirenOsc.frequency.value = f;
    this.sirenGain.gain.setTargetAtTime(level * 0.045, this.ctx.currentTime, 0.1);
    this.duck = level > 0.05 ? 0.45 : 1;
  }
  blip(freq, dur, type = 'sine', vol = 0.12, slide = 0) {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }
  noise(dur, vol, freq = 1200, q = 0.7) {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master); src.start(t);
  }
  shot() { this.noise(0.14, 0.5, 900, 0.4); this.blip(160, 0.08, 'square', 0.2, -120); }
  punch() { this.noise(0.07, 0.3, 300, 0.6); }
  crash(v = 0.3) { this.noise(0.25, v, 240, 0.3); this.blip(70, 0.2, 'sine', v, -30); }
  horn() { this.blip(370, 0.28, 'square', 0.06); this.blip(466, 0.28, 'square', 0.05); }
  squeal(on) { if (on && Math.random() < 0.3) this.noise(0.1, 0.05, 2600, 4); }
  chime() { [880, 1174, 1568].forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'sine', 0.12), i * 70)); }
  pickup() { this.blip(1320, 0.12, 'sine', 0.12, 500); }
  fail() { this.blip(220, 0.4, 'sawtooth', 0.1, -140); }
  click() { this.blip(660, 0.05, 'sine', 0.07); }
  gull() { this.blip(1400 + Math.random() * 300, 0.18, 'sine', 0.03, -600); }
  thunderlessRain(on) { if (on) this.noise(0.5, 0.03, 3000, 0.2); }
  _music() {
    // Laid-back synth loop: roots, soft chords, hats — scheduled step by step.
    const roots = [110, 87.3, 130.8, 98];
    this.musicTimer = setInterval(() => {
      if (!this.started || document.hidden) return;
      const s = this.step++;
      const bar = Math.floor(s / 8) % 4, beat = s % 8;
      const vol = 0.05 * this.duck;
      if (beat === 0) this.blip(roots[bar], 0.5, 'triangle', vol * 1.6);
      if (beat === 4) this.blip(roots[bar] * 1.5, 0.3, 'triangle', vol);
      if (beat % 2 === 0) this.noise(0.03, vol * 0.5, 6000, 1);
      if (beat === 2 || beat === 6) this.blip(roots[bar] * 2, 0.4, 'sine', vol * 0.8);
      if (beat === 7) this.blip(roots[bar] * 3, 0.2, 'sine', vol * 0.5);
    }, 240);
  }
}
