export class AudioManager {
  constructor() {
    this.context = null;
    this.master = null;
    this.muted = false;
    this.musicTimer = null;
    this.noteIndex = 0;
    this.musicStarted = false;
    this.notes = [55, 55, 82.41, 55, 73.42, 55, 98, 82.41, 55, 73.42, 55, 110];
  }

  async unlock() {
    if (!this.context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      this.context = new AudioContextClass();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : 0.23;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') await this.context.resume();
    if (!this.musicStarted && !this.muted) this.startMusic();
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    if (this.master && this.context) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.23, this.context.currentTime, 0.04);
    if (!this.muted && this.context && !this.musicStarted) this.startMusic();
    if (this.muted) this.stopMusic();
  }

  startMusic() {
    if (!this.context || this.muted || this.musicTimer) return;
    this.musicStarted = true;
    const tick = () => {
      if (!this.context || this.muted) return;
      const frequency = this.notes[this.noteIndex % this.notes.length];
      this.noteIndex += 1;
      this._tone(frequency, 0.12, 'square', 0.026, -0.22);
      if (this.noteIndex % 4 === 0) this._tone(frequency * 2, 0.08, 'triangle', 0.016, 0.18);
      this.musicTimer = window.setTimeout(tick, 210);
    };
    tick();
  }

  stopMusic() {
    if (this.musicTimer) window.clearTimeout(this.musicTimer);
    this.musicTimer = null;
    this.musicStarted = false;
  }

  play(name) {
    if (!this.context || this.muted) return;
    if (name === 'slash') {
      this._tone(320, 0.08, 'sawtooth', 0.065, 0.1);
      this._tone(120, 0.14, 'triangle', 0.08, -0.1);
      return;
    }
    if (name === 'lightning') {
      this._tone(1120, 0.075, 'sawtooth', 0.055, (Math.random() - 0.5) * 0.4);
      this._tone(230, 0.14, 'triangle', 0.06, (Math.random() - 0.5) * 0.3);
      return;
    }
    if (name === 'thunder') {
      this._tone(510, 0.2, 'sawtooth', 0.085, (Math.random() - 0.5) * 0.3);
      this._tone(88, 0.42, 'triangle', 0.12, 0);
      return;
    }
    if (name === 'map_pin') {
      this._tone(920, 0.055, 'triangle', 0.035, -0.1);
      return;
    }
    if (name === 'map_fold') {
      this._tone(340, 0.13, 'triangle', 0.045, 0.12);
      this._tone(610, 0.08, 'sine', 0.025, -0.12);
      return;
    }
    if (name === 'biosphere') {
      this._tone(392, 0.28, 'sine', 0.065, -0.15);
      this._tone(587, 0.36, 'triangle', 0.045, 0.15);
      return;
    }
    const bellNotes = {
      bell_leaf: [560, 0.14, 'sine', 0.045, -0.12],
      bell_dew: [740, 0.16, 'triangle', 0.04, 0],
      bell_gust: [920, 0.12, 'sine', 0.04, 0.12],
    };
    if (bellNotes[name]) {
      const [frequency, duration, wave, volume, pan] = bellNotes[name];
      this._tone(frequency, duration, wave, volume, pan);
      return;
    }
    if (name === 'stasis_start') {
      // Time freeze: dramatic bass sub-drop + high crystal resonance
      this._tone(480, 0.45, 'sine', 0.09, -0.15);
      this._tone(90, 0.7, 'triangle', 0.12, 0);
      this._tone(960, 0.35, 'sawtooth', 0.04, 0.2);
      return;
    }
    if (name === 'stasis_slash') {
      // Crisp metallic dimensional cut
      this._tone(680, 0.065, 'sawtooth', 0.085, (Math.random() - 0.5) * 0.4);
      this._tone(1150, 0.045, 'triangle', 0.06, (Math.random() - 0.5) * 0.4);
      return;
    }
    if (name === 'stasis_shatter') {
      // Glass/space shatter: explosive crystalline burst
      this._tone(240, 0.38, 'triangle', 0.11, 0);
      this._tone(840, 0.25, 'sawtooth', 0.08, -0.2);
      this._tone(1480, 0.28, 'sine', 0.07, 0.2);
      return;
    }

    const presets = {
      arrow: [720, 0.055, 'triangle', 0.04, 0.2],
      impact: [105, 0.12, 'square', 0.07, 0],
      ultimate: [440, 0.42, 'sawtooth', 0.08, 0],
      win: [660, 0.24, 'triangle', 0.085, 0],
    };
    const [frequency, duration, wave, volume, pan] = presets[name] ?? presets.impact;
    this._tone(frequency, duration, wave, volume, pan);
    if (name === 'ultimate') {
      this._tone(frequency * 1.5, duration * 0.78, 'square', volume * 0.55, -pan);
      this._tone(frequency * 2, duration * 0.55, 'triangle', volume * 0.35, pan);
    }
  }

  _tone(frequency, duration, wave, volume, pan = 0) {
    if (!this.context || !this.master || this.muted) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const panner = this.context.createStereoPanner ? this.context.createStereoPanner() : null;
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(35, frequency * 0.55), now + duration);
    gain.gain.setValueAtTime(Math.max(0.0001, volume), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    if (panner) {
      panner.pan.value = pan;
      gain.connect(panner);
      panner.connect(this.master);
    } else gain.connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.01);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
      panner?.disconnect();
    };
  }
}
