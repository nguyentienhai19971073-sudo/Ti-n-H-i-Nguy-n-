import { GiftSoundEffectType } from '../types/temple';

class TempleSoundSynthesizer {
  private ctx: AudioContext | null = null;
  private unlocked = false;
  private bgEnabled = true;
  private bgBaseVolume = 0.22;
  private isDucked = false;
  private bgMasterGain: GainNode | null = null;
  private zitherTimer: number | null = null;
  private stepIndex = 0;
  private lastWoodenFishAt = 0;

  // Peaceful Vietnamese Đàn Tranh pentatonic scale (D4, F4, G4, A4, C5, D5, F5, G5, A5)
  private static readonly PENTATONIC_HZ = [
    293.66, 349.23, 392.0, 440.0, 523.25, 587.33, 698.46, 783.99, 880.0,
  ];

  // Meditative melodic contour indices
  private static readonly MELODY_PATTERN = [
    0, 2, 3, 5, 3, 2, 1, 0,
    2, 3, 4, 6, 5, 3, 2, 3,
    5, 7, 5, 3, 2, 0, 1, 2,
  ];

  public unlockAudio(): boolean {
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      if (!this.bgMasterGain && this.ctx) {
        this.bgMasterGain = this.ctx.createGain();
        this.bgMasterGain.gain.value = this.bgEnabled ? this.bgBaseVolume : 0;
        this.bgMasterGain.connect(this.ctx.destination);
      }
      this.unlocked = true;
      this.startAmbientZitherLoop();
      this.playOfferingChime(0.4);
      return true;
    } catch {
      return false;
    }
  }

  public isAudioUnlocked(): boolean {
    return this.unlocked && Boolean(this.ctx && this.ctx.state === 'running');
  }

  public setBackgroundMusic(enabled: boolean, volume: number): void {
    this.bgEnabled = enabled;
    this.bgBaseVolume = Math.max(0, Math.min(1, volume));
    this.updateBgGain();
    if (enabled && this.unlocked) {
      this.startAmbientZitherLoop();
    } else if (!enabled && this.zitherTimer !== null) {
      window.clearInterval(this.zitherTimer);
      this.zitherTimer = null;
    }
  }

  public setDucking(ducked: boolean): void {
    this.isDucked = ducked;
    this.updateBgGain();
  }

  private updateBgGain(): void {
    if (!this.ctx || !this.bgMasterGain) return;
    const now = this.ctx.currentTime;
    const target = !this.bgEnabled
      ? 0
      : this.isDucked
        ? this.bgBaseVolume * 0.22
        : this.bgBaseVolume;
    this.bgMasterGain.gain.cancelScheduledValues(now);
    this.bgMasterGain.gain.setTargetAtTime(target, now, 0.25);
  }

  private startAmbientZitherLoop(): void {
    if (this.zitherTimer !== null || !this.bgEnabled || !this.unlocked) return;
    this.zitherTimer = window.setInterval(() => {
      if (!this.bgEnabled || !this.ctx || this.ctx.state !== 'running') return;
      const idx =
        TempleSoundSynthesizer.MELODY_PATTERN[
          this.stepIndex % TempleSoundSynthesizer.MELODY_PATTERN.length
        ];
      const freq = TempleSoundSynthesizer.PENTATONIC_HZ[idx];
      this.pluckZitherNote(freq);
      if (this.stepIndex % 4 === 0) {
        this.pluckZitherNote(146.83, 0.45, 3.6);
      }
      this.stepIndex += 1;
    }, 1350);
  }

  private pluckZitherNote(freq: number, relGain = 0.55, duration = 2.6): void {
    if (!this.ctx || !this.bgMasterGain) return;
    const now = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const noteGain = this.ctx.createGain();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, now);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 4.5, now);
    filter.frequency.exponentialRampToValueAtTime(freq * 1.3, now + duration * 0.8);

    noteGain.gain.setValueAtTime(0.0001, now);
    noteGain.gain.linearRampToValueAtTime(0.14 * relGain, now + 0.025);
    noteGain.gain.exponentialRampToValueAtTime(0.0008, now + duration);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(noteGain);
    noteGain.connect(this.bgMasterGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + duration + 0.05);
    osc2.stop(now + duration + 0.05);
  }

  /**
   * Authentic Vietnamese Temple Wooden Fish (Tiếng Gõ Mõ Chùa Truyền Thống)
   * Synchronized with 1-strike (10 likes), 3-strike (100 likes), and 6-strike (1000 likes) animations.
   */
  public playWoodenFish(volume = 0.68, strikeIndex = 0): void {
    if (!this.ctx || !this.unlocked || this.ctx.state !== 'running') return;
    const wallNow = Date.now();
    if (wallNow - this.lastWoodenFishAt < 95) return;
    this.lastWoodenFishAt = wallNow;

    const now = this.ctx.currentTime;
    const pitchFactor = 1 + ((strikeIndex % 3) - 1) * 0.018;

    // 1. Hollow carved rosewood chamber resonance ("cốc")
    const bodyOsc = this.ctx.createOscillator();
    const overtoneOsc = this.ctx.createOscillator();
    const clickOsc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    const clickGain = this.ctx.createGain();

    bodyOsc.type = 'sine';
    bodyOsc.frequency.setValueAtTime(658 * pitchFactor, now);
    bodyOsc.frequency.exponentialRampToValueAtTime(592 * pitchFactor, now + 0.16);

    overtoneOsc.type = 'triangle';
    overtoneOsc.frequency.setValueAtTime(1316 * pitchFactor, now);
    overtoneOsc.frequency.exponentialRampToValueAtTime(985 * pitchFactor, now + 0.065);

    // 2. Crisp wooden mallet tap transient
    clickOsc.type = 'sine';
    clickOsc.frequency.setValueAtTime(2150 * pitchFactor, now);
    clickOsc.frequency.exponentialRampToValueAtTime(760, now + 0.022);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(715 * pitchFactor, now);
    filter.Q.setValueAtTime(3.6, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.36 * volume, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0006, now + 0.25);

    clickGain.gain.setValueAtTime(0.0001, now);
    clickGain.gain.linearRampToValueAtTime(0.16 * volume, now + 0.002);
    clickGain.gain.exponentialRampToValueAtTime(0.0004, now + 0.028);

    bodyOsc.connect(filter);
    overtoneOsc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    clickOsc.connect(clickGain);
    clickGain.connect(this.ctx.destination);

    bodyOsc.start(now);
    overtoneOsc.start(now);
    clickOsc.start(now);
    bodyOsc.stop(now + 0.27);
    overtoneOsc.stop(now + 0.27);
    clickOsc.stop(now + 0.035);
  }

  /**
   * Soft brass prayer chime (Tiếng Chuông Gia Trì) when lighting incense at the altar
   */
  public playIncenseChime(volume = 0.55): void {
    if (!this.ctx || !this.unlocked || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const partials = [
      { freq: 523.25, amp: 0.15, decay: 2.2 },
      { freq: 1046.5, amp: 0.09, decay: 1.7 },
      { freq: 1567.98, amp: 0.05, decay: 1.2 },
    ];
    for (const p of partials) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(p.freq, now);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(p.amp * volume, now + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0004, now + p.decay);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + p.decay + 0.05);
    }
  }

  /**
   * Gentle pentatonic water-lotus shimmer when releasing a floating Hoa Đăng lantern
   */
  public playWaterLanternChime(volume = 0.58): void {
    if (!this.ctx || !this.unlocked || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const notes = [440.0, 587.33, 698.46, 880.0];
    for (let i = 0; i < notes.length; i++) {
      const t0 = now + i * 0.09;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(notes[i], t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.1 * volume, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0004, t0 + 1.9);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 1.95);
    }
  }

  /**
   * Deep resonant Vietnamese Đại Hồng Chung (Temple Bell) for Bell Ritual & Large Gifts
   */
  public playTempleBell(volume = 0.8): void {
    if (!this.ctx || !this.unlocked || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const partials = [
      { freq: 174.61, amp: 0.42, decay: 5.2 },
      { freq: 349.23, amp: 0.28, decay: 4.3 },
      { freq: 526.0, amp: 0.18, decay: 3.4 },
      { freq: 702.5, amp: 0.12, decay: 2.6 },
      { freq: 1052.0, amp: 0.07, decay: 1.8 },
    ];

    const master = this.ctx.createGain();
    master.gain.setValueAtTime(Math.min(1, volume * 0.65), now);
    master.connect(this.ctx.destination);

    for (const p of partials) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(p.freq, now);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(p.amp, now + 0.018);
      g.gain.exponentialRampToValueAtTime(0.0005, now + p.decay);

      osc.connect(g);
      g.connect(master);
      osc.start(now);
      osc.stop(now + p.decay + 0.05);
    }
  }

  /**
   * Majestic Ceremonial Sound (Đại Hồng Chung + Khánh Đồng) for Grand Ceremony (Đại Lễ)
   */
  public playGrandCeremonyBell(volume = 0.9): void {
    this.playTempleBell(volume);
    if (!this.ctx || !this.unlocked || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const ceremonialChord = [293.66, 440.0, 587.33, 880.0];
    for (let i = 0; i < ceremonialChord.length; i++) {
      const t0 = now + 0.35 + i * 0.12;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(ceremonialChord[i], t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.11 * volume, t0 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0004, t0 + 3.4);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 3.5);
    }
  }

  /**
   * Gentle singing bowl chime for Rose / Flower offerings
   */
  public playOfferingChime(volume = 0.55): void {
    if (!this.ctx || !this.unlocked || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const freqs = [587.33, 880.0, 1174.66];
    for (let i = 0; i < freqs.length; i++) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freqs[i], now + i * 0.06);
      g.gain.setValueAtTime(0.0001, now + i * 0.06);
      g.gain.linearRampToValueAtTime(0.11 * volume, now + i * 0.06 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0005, now + i * 0.06 + 1.8);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(now + i * 0.06);
      osc.stop(now + i * 0.06 + 1.85);
    }
  }

  /**
   * Luminous crystal-brass lotus chime for Đài Sen (Cầu Tài Lộc)
   */
  public playLotusPedestalChime(volume = 0.65): void {
    if (!this.ctx || !this.unlocked || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const freqs = [523.25, 659.25, 783.99, 1046.5];
    for (let i = 0; i < freqs.length; i++) {
      const t0 = now + i * 0.075;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freqs[i], t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.12 * volume, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0004, t0 + 2.4);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 2.45);
    }
  }
  /**
   * Dynamic Gift Sound Effect Dispatcher (Data-driven from GiftMapping.soundEffect)
   */
  public playConfiguredGiftSound(sound: GiftSoundEffectType, volume = 0.78): void {
    switch (sound) {
      case 'none':
        return;
      case 'temple_bell':
        this.playTempleBell(volume);
        return;
      case 'grand_ceremony_bell':
        this.playGrandCeremonyBell(volume);
        return;
      case 'wooden_fish':
        this.playWoodenFish(volume, 0);
        if (typeof window !== 'undefined') {
          window.setTimeout(() => this.playWoodenFish(volume, 1), 360);
          window.setTimeout(() => this.playWoodenFish(volume, 2), 720);
        }
        return;
      case 'incense_chime':
        this.playIncenseChime(volume);
        return;
      case 'lotus_chime':
        this.playLotusPedestalChime(volume);
        return;
      case 'lantern_chime':
        this.playWaterLanternChime(volume);
        return;
      case 'offering_chime':
      default:
        this.playOfferingChime(volume);
        return;
    }
  }
}

export const soundSynthesizer = new TempleSoundSynthesizer();

