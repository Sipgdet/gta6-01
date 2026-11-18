// Synthesised sound only — no audio files. Every effect is built from
// oscillators and filtered noise through one WebAudio graph, created lazily
// on the first user gesture (browsers block audio before that).
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenTimer = 0;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.35;
    this.master.connect(this.ctx.destination);
    // Engine hum: two detuned saws through a low-pass, gain follows speed.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const engineFilter = this.ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(engineFilter);
    engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.35;
  }

  setEngine(speed01, on) {
    if (!this.ctx || !this.engineOsc) return;
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, t, 0.08);
    this.engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.06 : 0, t, 0.1);
  }

  blip(freq, dur, type, vol) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type || 'square';
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  noise(dur, filterFreq, vol) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  }

  shot() { this.noise(0.14, 1800, 0.5); this.blip(160, 0.08, 'square', 0.25); }
  punch() { this.noise(0.08, 500, 0.35); }
  crash() { this.noise(0.25, 300, 0.5); }
  pickup() { this.blip(660, 0.09, 'sine', 0.25); this.blip(990, 0.12, 'sine', 0.2); }
  chime() { this.blip(523, 0.12, 'sine', 0.25); this.blip(784, 0.2, 'sine', 0.25); }
  denied() { this.blip(140, 0.18, 'sawtooth', 0.25); }
  sirenTick(wanted) {
    // Two-tone siren while wanted; called once per second from the loop.
    if (!this.ctx || this.muted || wanted < 1) return;
    this.blip(740, 0.22, 'sine', 0.12);
    setTimeout(() => this.blip(560, 0.22, 'sine', 0.12), 240);
  }
}
