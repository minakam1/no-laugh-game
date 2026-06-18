// ============================================================
// 赛博朋克风格背景音乐生成器 (Web Audio API)
// 生成 3 分钟可无缝循环的电子音乐
// ============================================================

export class BgmGenerator {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private started = false;
  private starting = false;  // 防止并发调用 start()
  private timerId: ReturnType<typeof setInterval> | null = null;
  private externalCtx: AudioContext | null = null;
  private externalDest: AudioNode | null = null;

  // BPM
  private readonly bpm = 110;
  private get beatDuration(): number { return 60 / this.bpm; }
  private get barDuration(): number { return this.beatDuration * 4; } // 4/4 拍

  // 音阶 (C 小调五声音阶 + 布鲁斯音)
  private readonly scale = [
    261.63, // C4
    293.66, // D4
    311.13, // Eb4
    349.23, // F4
    392.00, // G4
    415.30, // Ab4
    466.16, // Bb4
    523.25, // C5
  ];

  // 低音音阶
  private readonly bassScale = [
    130.81, // C3
    146.83, // D3
    155.56, // Eb3
    174.61, // F3
    196.00, // G3
    207.65, // Ab3
    233.08, // Bb3
  ];

  // ---- 主控 ----

  /**
   * 设置外部 AudioContext 和输出目标节点
   * 调用后 BGM 将输出到指定节点而非 destination
   */
  setOutput(ctx: AudioContext, dest: AudioNode): void {
    this.externalCtx = ctx;
    this.externalDest = dest;
  }

  async init(): Promise<void> {
    // ctx 存在但 masterGain 被 disconnect 了（上一次 stop 所致）
    if (this.ctx && !this.masterGain) {
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.5;
      const dest = this.externalDest ?? this.ctx.destination;
      this.masterGain.connect(dest);
      return;
    }
    if (this.ctx) return;
    // 优先使用外部 AudioContext
    if (this.externalCtx && this.externalDest) {
      this.ctx = this.externalCtx;
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.5;
      this.masterGain.connect(this.externalDest);
    } else {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.5;
      this.masterGain.connect(this.ctx.destination);
    }
  }

  setVolume(v: number): void {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, v));
    }
  }

  // ---- 通用音符播放 ----
  private playNote(
    freq: number,
    startTime: number,
    duration: number,
    type: OscillatorType = 'sawtooth',
    volume = 0.15,
    filterFreq?: number,
    detune = 0,
  ): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.01);
    gain.gain.setValueAtTime(volume, startTime + duration * 0.8);
    gain.gain.linearRampToValueAtTime(0, startTime + duration);

    osc.connect(gain);

    if (filterFreq !== undefined) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq;
      filter.Q.value = 2;
      gain.connect(filter);
      filter.connect(this.masterGain!);
      osc.start(startTime);
      osc.stop(startTime + duration + 0.05);
      return;
    }

    gain.connect(this.masterGain!);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }

  // ---- 贝斯线 ----
  private bassPattern = [
    { idx: 0, dur: 0.5 },
    { idx: 0, dur: 0.25 },
    { idx: 2, dur: 0.25 },
    { idx: 3, dur: 0.5 },
    { idx: 0, dur: 0.25 },
    { idx: 2, dur: 0.25 },
    { idx: 4, dur: 0.5 },
    { idx: 5, dur: 0.25 },
    { idx: 4, dur: 0.25 },
    { idx: 3, dur: 0.5 },
    { idx: 0, dur: 0.25 },
    { idx: 2, dur: 0.25 },
    { idx: 3, dur: 0.5 },
    { idx: 2, dur: 0.25 },
    { idx: 0, dur: 0.25 },
    { idx: 6, dur: 0.5 },
  ];

  private scheduleBass(startTime: number, lengthInBeats: number): void {
    const bd = this.beatDuration;
    let t = startTime;
    let pi = 0;
    while (t < startTime + lengthInBeats * bd) {
      const p = this.bassPattern[pi % this.bassPattern.length];
      const freq = this.bassScale[p.idx];
      const dur = p.dur * bd;
      this.playNote(freq, t, dur * 0.85, 'sawtooth', 0.18, 300 + Math.random() * 100);
      t += dur;
      pi++;
    }
  }

  // ---- 琶音 ----
  private arpPatterns = [
    [0, 2, 4, 6, 4, 2],       // 上行再下行
    [4, 2, 0, 2, 3, 4],       // 小调下行
    [6, 4, 3, 2, 0, 2],       // 变体
    [0, 3, 5, 7, 5, 3],       // 带跳跃
  ];

  private scheduleArpeggio(startTime: number, lengthInBeats: number): void {
    const bd = this.beatDuration;
    const step = bd / 4; // 16分音符
    let t = startTime;
    let barIndex = 0;

    while (t < startTime + lengthInBeats * bd) {
      const pattern = this.arpPatterns[barIndex % this.arpPatterns.length];
      for (let i = 0; i < pattern.length; i++) {
        const freq = this.scale[pattern[i]] * 2; // 高八度
        const dur = step * 0.7;
        const vol = 0.04 + (i / pattern.length) * 0.03;
        this.playNote(freq, t, dur, 'square', vol, 1500 + i * 200, -5);
        t += step;
      }
      barIndex++;
    }
  }

  // ---- Pad 氛围音 ----
  private schedulePad(startTime: number, lengthInBeats: number): void {
    const bd = this.beatDuration;
    const bar = this.barDuration;

    // 每 2 个小节换一个和弦
    const chordProgression = [
      [0, 3, 7],    // Cm7 (C, Eb, Bb)
      [3, 5, 0],    // Fm7 转位
      [5, 0, 3],    // AbM7 转位
      [4, 7, 3],    // Gm7
    ];

    let t = startTime;
    let ci = 0;
    while (t < startTime + lengthInBeats * bd) {
      const chord = chordProgression[ci % chordProgression.length];
      for (const idx of chord) {
        const freq = this.scale[idx] * 0.5; // 低八度
        this.playNote(freq, t, bar * 2, 'sine', 0.06, 400 + Math.random() * 200, 3 + Math.random() * 5);
      }
      t += bar * 2;
      ci++;
    }
  }

  // ---- 鼓点 ----
  private scheduleKick(startTime: number, lengthInBeats: number): void {
    const bd = this.beatDuration;
    let t = startTime;
    const ctx = this.ctx!;

    while (t < startTime + lengthInBeats * bd) {
      // 4/4 kick pattern: 1, 2.5, 3.5
      for (const beatOffset of [0, 1.5, 2.5]) {
        const kickTime = t + beatOffset * bd;
        if (kickTime >= startTime + lengthInBeats * bd) break;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, kickTime);
        osc.frequency.exponentialRampToValueAtTime(40, kickTime + 0.15);

        gain.gain.setValueAtTime(0.35, kickTime);
        gain.gain.exponentialRampToValueAtTime(0.001, kickTime + 0.2);

        osc.connect(gain);
        gain.connect(this.masterGain!);
        osc.start(kickTime);
        osc.stop(kickTime + 0.25);
      }
      t += this.barDuration;
    }
  }

  private scheduleHihat(startTime: number, lengthInBeats: number): void {
    const bd = this.beatDuration;
    let t = startTime;
    const ctx = this.ctx!;

    while (t < startTime + lengthInBeats * bd) {
      // 8分音符 hi-hat
      for (let i = 0; i < 8; i++) {
        const hhTime = t + i * (bd / 2);
        if (hhTime >= startTime + lengthInBeats * bd) break;

        // 使用噪声模拟 hi-hat
        const bufferSize = ctx.sampleRate * 0.05;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let j = 0; j < bufferSize; j++) {
          data[j] = (Math.random() * 2 - 1) * Math.exp(-j / (ctx.sampleRate * 0.02));
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 8000;

        const gain = ctx.createGain();
        // 重音在第 2 和 4 拍
        const isAccent = i % 2 === 1;
        gain.gain.setValueAtTime(isAccent ? 0.08 : 0.04, hhTime);
        gain.gain.exponentialRampToValueAtTime(0.001, hhTime + 0.06);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain!);
        source.start(hhTime);
      }
      t += this.barDuration;
    }
  }

  // ---- 打击乐（clap/snare） ----
  private scheduleSnare(startTime: number, lengthInBeats: number): void {
    const bd = this.beatDuration;
    let t = startTime;
    const ctx = this.ctx!;

    while (t < startTime + lengthInBeats * bd) {
      // Snare on beat 2 and 4
      for (const beatOffset of [1, 3]) {
        const snareTime = t + beatOffset * bd;
        if (snareTime >= startTime + lengthInBeats * bd) break;

        // 噪声 + 振荡器混合
        const bufferSize = ctx.sampleRate * 0.15;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let j = 0; j < bufferSize; j++) {
          data[j] = (Math.random() * 2 - 1) * Math.exp(-j / (ctx.sampleRate * 0.05));
        }

        const noiseSource = ctx.createBufferSource();
        noiseSource.buffer = buffer;

        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.value = 1500;
        noiseFilter.Q.value = 0.8;

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.15, snareTime);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, snareTime + 0.12);

        // 加一点 tone
        const toneOsc = ctx.createOscillator();
        const toneGain = ctx.createGain();
        toneOsc.type = 'triangle';
        toneOsc.frequency.value = 200;
        toneGain.gain.setValueAtTime(0.1, snareTime);
        toneGain.gain.exponentialRampToValueAtTime(0.001, snareTime + 0.08);

        noiseSource.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.masterGain!);
        toneOsc.connect(toneGain);
        toneGain.connect(this.masterGain!);

        noiseSource.start(snareTime);
        toneOsc.start(snareTime);
        toneOsc.stop(snareTime + 0.1);
      }
      t += this.barDuration;
    }
  }

  // ---- 主调度 ----
  private scheduleChunk(startTime: number, durationBeats: number): void {
    this.schedulePad(startTime, durationBeats);
    this.scheduleBass(startTime, durationBeats);
    this.scheduleArpeggio(startTime, durationBeats);
    this.scheduleKick(startTime, durationBeats);
    this.scheduleHihat(startTime, durationBeats);
    this.scheduleSnare(startTime, durationBeats);
  }

  // ---- 播放控制 ----
  async start(): Promise<void> {
    if (this.started || this.starting) return;
    this.starting = true;

    try {
      await this.init();

      if (this.ctx!.state === 'suspended') {
        await this.ctx!.resume();
      }

      this.started = true;
      const chunkBeats = 32; // 每 32 拍（8 小节）调度一次
      const chunkDuration = chunkBeats * this.beatDuration;
      const totalDuration = 180; // 3 分钟
      let elapsed = 0;

      // 初始调度
      const now = this.ctx!.currentTime;
      this.scheduleChunk(now, chunkBeats);

      // 清掉可能残留的旧定时器（多重点击场景）
      if (this.timerId) {
        clearInterval(this.timerId);
        this.timerId = null;
      }

      // 定时调度后续块
      this.timerId = setInterval(() => {
        if (!this.started || !this.ctx) {
          if (this.timerId) {
            clearInterval(this.timerId);
            this.timerId = null;
          }
          return;
        }
        elapsed += chunkDuration;
        if (elapsed >= totalDuration) {
          // 到达 3 分钟，循环回到开头
          elapsed = 0;
        }
        const t = this.ctx.currentTime + 0.1;
        this.scheduleChunk(t, chunkBeats);
      }, chunkDuration * 1000 * 0.9); // 提前一点调度，防止空隙
    } finally {
      this.starting = false;
    }
  }

  stop(): void {
    this.started = false;
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    // 先静音再断开：gain=0 会立即静音所有已连接音符（包括已调度但尚未播放的）
    // 不关闭 AudioContext，由 AudioManager 统一管理生命周期
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(0, this.ctx?.currentTime ?? 0);
      this.masterGain.disconnect();
      this.masterGain = null;
    }
  }
}

// 单例
let instance: BgmGenerator | null = null;

export function getBgmGenerator(): BgmGenerator {
  if (!instance) {
    instance = new BgmGenerator();
  }
  return instance;
}
