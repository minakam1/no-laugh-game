// ============================================================
// AudioManager — 统一音频管理器（BGM + 音效）
// 复用单例 AudioContext，BgmGenerator 改为内部组件
// ============================================================

import { BgmGenerator, type BgmVariant } from '@/utils/bgmGenerator';

/** 所有音效事件的类型标识 */
export type SfxEvent =
  // === 游戏状态转换 ===
  | 'game_start'
  | 'game_menu'
  | 'game_back_to_menu'
  | 'game_signal_lost'
  // === UI 交互 ===
  | 'ui_click'
  | 'ui_hover'
  | 'ui_popup_open'
  | 'ui_popup_close'
  | 'ui_switch'
  | 'ui_error'
  | 'ui_save'
  // === 按键/交互增强 ===
  | 'ui_button_press'       // 广播控制台按键按下
  | 'ui_button_hover'       // 按键悬停电子辉光
  | 'ui_toggle_on'          // 开关拨到 ON
  | 'ui_toggle_off'         // 开关拨到 OFF
  | 'ui_purchase'           // 购买成功（赛博朋克收银机）
  | 'ui_purchase_fail'      // 购买失败（错误蜂鸣）
  | 'ui_stage_select'       // 关卡选择确认
  | 'ui_modal_open'         // 弹窗滑入
  | 'ui_modal_close'        // 弹窗滑出
  | 'ui_slider'             // 滑块调节刻度
  | 'ui_difficulty_switch'  // 难度切换特效
  // === 道具操作 ===
  | 'prop_pickup'
  | 'prop_drop'
  | 'prop_undo'
  | 'prop_clear'
  | 'prop_bg_switch'
  // === 表演阶段 ===
  | 'perform_start'
  | 'perform_countdown'
  | 'perform_end'
  // === 20 种道具专属动画音效 ===
  | 'effect_banana'
  | 'effect_portal'
  | 'effect_trampoline'
  | 'effect_bomb'
  | 'effect_barrel'
  | 'effect_clumsyNpc'
  | 'effect_coffeeCup'
  | 'effect_springGlove'
  | 'effect_jetpack'
  | 'effect_magnet'
  | 'effect_smokeMachine'
  | 'effect_mirror'
  | 'effect_bicycle'
  | 'effect_glue'
  | 'effect_skateboard'
  | 'effect_bouncyMushroom'
  | 'effect_hairDryer'
  | 'effect_reverseGravity'
  | 'effect_fakeCeiling'
  | 'effect_rotatingStage'
  | 'effect_wishMachine'
  // === AI 弹幕交互 ===
  | 'danmaku_arrive'
  | 'danmaku_silence'
  | 'danmaku_super_chat'
  | 'judge_scoring'
  | 'judge_high_score'
  | 'judge_low_score'
  // === 绷不住值变化 ===
  | 'meter_increase_small'
  | 'meter_increase_medium'
  | 'meter_increase_large'
  | 'meter_near_pass'
  | 'meter_pass'
  | 'meter_force_settle'
  // === 结算 ===
  | 'result_modal_open'
  | 'result_pass'
  | 'result_fail'
  | 'result_new_judge'
  | 'result_button'
  // === 环境氛围 ===
  | 'ambient_live_room'
  | 'ambient_crt_scan'
  | 'ambient_editing'
  | 'ambient_performing'
  // === 场景环境音效 ===
  | 'ambient_cliff'
  | 'ambient_cliff_fall'
  | 'ambient_rapids'
  | 'ambient_windstorm'
  | 'ambient_darkness';

export type SfxCategory =
  | 'game'
  | 'ui'
  | 'prop'
  | 'perform'
  | 'effect'
  | 'danmaku'
  | 'meter'
  | 'result'
  | 'ambient';

interface SfxDef {
  category: SfxCategory;
  /** 播放音效的具体实现 */
  play: (ctx: AudioContext, dest: AudioNode, volume: number) => void;
}

class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgm: BgmGenerator | null = null;
  private climaxBgm: BgmGenerator | null = null;
  private sfxGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private mainBgmGain: GainNode | null = null;
  private climaxBgmGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;

  private bgmVolume = 0.5;
  private sfxVolume = 0.6;
  private ambientVolume = 0.15;
  private bgmPlaying = false;
  private bgmStarting = false;  // 防止并发 bgmStart()
  private activeBgmVariant: BgmVariant = 'main';
  private bgmFadeStopTimerId: ReturnType<typeof setTimeout> | null = null;

  // 环境氛围定时器
  private ambientTimerId: ReturnType<typeof setInterval> | null = null;
  // 道具持续音效的振荡器引用（用于停止）
  private activeEffectOscs: Map<string, OscillatorNode[]> = new Map();
  // 音频文件缓存
  private audioBufferCache: Map<string, AudioBuffer> = new Map();

  async init(): Promise<AudioContext> {
    if (this.ctx) return this.ctx;

    this.ctx = new AudioContext();

    // 主输出
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 1;
    this.masterGain.connect(this.ctx.destination);

    // BGM 通道
    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.value = this.bgmVolume;
    this.bgmGain.connect(this.masterGain);

    this.mainBgmGain = this.ctx.createGain();
    this.mainBgmGain.gain.value = this.activeBgmVariant === 'main' ? 1 : 0;
    this.mainBgmGain.connect(this.bgmGain);

    this.climaxBgmGain = this.ctx.createGain();
    this.climaxBgmGain.gain.value = this.activeBgmVariant === 'climax' ? 1 : 0;
    this.climaxBgmGain.connect(this.bgmGain);

    // 音效通道
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.sfxVolume;
    this.sfxGain.connect(this.masterGain);

    // 氛围通道
    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = this.ambientVolume;
    this.ambientGain.connect(this.masterGain);

    return this.ctx;
  }

  // ============ BGM 控制 ============

  getBgmGenerator(variant: BgmVariant = 'main'): BgmGenerator {
    if (variant === 'climax') {
      if (!this.climaxBgm) {
        this.climaxBgm = new BgmGenerator('climax');
      }
      return this.climaxBgm;
    }
    if (!this.bgm) {
      this.bgm = new BgmGenerator('main');
    }
    return this.bgm;
  }

  private getExistingBgmGenerator(variant: BgmVariant): BgmGenerator | null {
    return variant === 'climax' ? this.climaxBgm : this.bgm;
  }

  private getBgmVariantGain(variant: BgmVariant): GainNode {
    const gain = variant === 'climax' ? this.climaxBgmGain : this.mainBgmGain;
    if (!gain) {
      throw new Error(`BGM gain is not initialized: ${variant}`);
    }
    return gain;
  }

  private async ensureBgmVariant(variant: BgmVariant): Promise<void> {
    const ctx = await this.init();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    const bgm = this.getBgmGenerator(variant);
    bgm.setOutput(ctx, this.getBgmVariantGain(variant));
    await bgm.start();
    bgm.setVolume(1);
  }

  private setVariantMix(variant: BgmVariant): void {
    if (this.mainBgmGain) {
      this.mainBgmGain.gain.value = variant === 'main' ? 1 : 0;
    }
    if (this.climaxBgmGain) {
      this.climaxBgmGain.gain.value = variant === 'climax' ? 1 : 0;
    }
  }

  private rampGain(gain: GainNode, target: number, fadeMs: number): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const fadeSeconds = Math.max(0.01, fadeMs / 1000);
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(target, now + fadeSeconds);
  }

  private async transitionBgm(variant: BgmVariant, fadeMs: number): Promise<void> {
    if (this.activeBgmVariant === variant) return;
    this.activeBgmVariant = variant;

    if (!this.bgmPlaying) {
      this.setVariantMix(variant);
      return;
    }

    if (this.bgmFadeStopTimerId) {
      clearTimeout(this.bgmFadeStopTimerId);
      this.bgmFadeStopTimerId = null;
    }

    const previousVariant: BgmVariant = variant === 'main' ? 'climax' : 'main';
    await this.ensureBgmVariant(variant);
    this.rampGain(this.getBgmVariantGain(variant), 1, fadeMs);
    this.rampGain(this.getBgmVariantGain(previousVariant), 0, fadeMs);

    this.bgmFadeStopTimerId = setTimeout(() => {
      this.getExistingBgmGenerator(previousVariant)?.stop();
      this.bgmFadeStopTimerId = null;
    }, fadeMs + 120);
  }

  async bgmStart(): Promise<void> {
    if (this.bgmPlaying || this.bgmStarting) return;
    this.bgmStarting = true;
    try {
      await this.ensureBgmVariant(this.activeBgmVariant);
      this.bgmPlaying = true;
      this.setVariantMix(this.activeBgmVariant);
      if (this.bgmGain) {
        this.bgmGain.gain.value = this.bgmVolume;
      }
    } finally {
      this.bgmStarting = false;
    }
  }

  bgmStop(): void {
    if (this.bgm) {
      this.bgm.stop();
    }
    if (this.climaxBgm) {
      this.climaxBgm.stop();
    }
    if (this.bgmFadeStopTimerId) {
      clearTimeout(this.bgmFadeStopTimerId);
      this.bgmFadeStopTimerId = null;
    }
    this.bgmPlaying = false;
    this.activeBgmVariant = 'main';
    this.setVariantMix('main');
  }

  bgmToggle(): boolean {
    if (this.bgmPlaying) {
      this.bgmStop();
    } else {
      this.bgmStart();
    }
    return this.bgmPlaying;
  }

  setBgmVolume(v: number): void {
    this.bgmVolume = Math.max(0, Math.min(1, v));
    if (this.bgmGain) {
      this.bgmGain.gain.value = this.bgmVolume;
    }
  }

  transitionToClimaxBgm(fadeMs = 1800): Promise<void> {
    return this.transitionBgm('climax', fadeMs);
  }

  transitionToMainBgm(fadeMs = 1400): Promise<void> {
    return this.transitionBgm('main', fadeMs);
  }

  setSfxVolume(v: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, v));
    if (this.sfxGain) {
      this.sfxGain.gain.value = this.sfxVolume;
    }
  }

  setAmbientVolume(v: number): void {
    this.ambientVolume = Math.max(0, Math.min(1, v));
    if (this.ambientGain) {
      this.ambientGain.gain.value = this.ambientVolume;
    }
  }

  get isBgmPlaying(): boolean {
    return this.bgmPlaying;
  }

  // ============ 音效播放 ============

  play(event: SfxEvent): void {
    if (!this.ctx || !this.sfxGain) return;
    // 自动恢复被浏览器挂起的音频上下文
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    const def = SFX_REGISTRY[event];
    if (!def) return;
    def.play(this.ctx, this.sfxGain, this.sfxVolume);
  }

  /** 预加载音频文件到缓存 */
  async loadAudioFile(url: string): Promise<AudioBuffer> {
    const cached = this.audioBufferCache.get(url);
    if (cached) return cached;

    const ctx = await this.init();
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    this.audioBufferCache.set(url, audioBuffer);
    return audioBuffer;
  }

  /** 播放缓存的音频文件（通过 sfxGain 输出） */
  playBuffer(url: string, offset = 0): void {
    if (!this.ctx || !this.sfxGain) return;
    const buffer = this.audioBufferCache.get(url);
    if (!buffer) return;

    // 如果 AudioContext 被挂起，先恢复
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    try {
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      const gain = this.ctx.createGain();
      gain.gain.value = 1;
      source.connect(gain);
      gain.connect(this.sfxGain);
      source.start(this.ctx.currentTime + offset);
    } catch {
      // AudioBuffer 可能属于已关闭的旧 Context，静默忽略
    }
  }

  /** 检查音频文件是否已缓存 */
  hasBuffer(url: string): boolean {
    return this.audioBufferCache.has(url);
  }

  /** 获取缓存的音频文件 */
  getBuffer(url: string): AudioBuffer | undefined {
    return this.audioBufferCache.get(url);
  }

  /** 设置缓存的音频文件 */
  setBuffer(url: string, buffer: AudioBuffer): void {
    this.audioBufferCache.set(url, buffer);
  }

  /** 播放道具持续音效（返回停止函数） */
  playEffect(
    event: SfxEvent,
    propId: string,
  ): (() => void) | undefined {
    if (!this.ctx || !this.sfxGain) return;
    const def = SFX_REGISTRY[event];
    if (!def) return;

    // 先停止该道具之前的音效
    this.stopEffect(propId);

    // 记录该道具的音效（用于后续停止）
    // 这里我们使用持续合成的方式
    const oscs = this.createContinuousEffect(event, propId);
    if (!oscs) return;

    this.activeEffectOscs.set(propId, oscs);
    return () => this.stopEffect(propId);
  }

  private createContinuousEffect(
    _event: SfxEvent,
    _propId: string,
  ): OscillatorNode[] | null {
    if (!this.ctx || !this.sfxGain) return null;
    // 持续效果通过定时调度实现，这里返回空数组标记
    return [];
  }

  stopEffect(propId: string): void {
    const oscs = this.activeEffectOscs.get(propId);
    if (oscs) {
      for (const osc of oscs) {
        try { osc.stop(); } catch { /* already stopped */ }
      }
      this.activeEffectOscs.delete(propId);
    }
  }

  stopAllEffects(): void {
    for (const [propId] of this.activeEffectOscs) {
      this.stopEffect(propId);
    }
  }

  // ============ 环境氛围 ============

  startAmbient(): void {
    if (this.ambientTimerId) return;
    this.play('ambient_live_room');

    // 每 8 秒循环播放 CRTV 扫描线噪音
    this.ambientTimerId = setInterval(() => {
      if (!this.ctx || !this.ambientGain) return;
      this.playAmbientNoise(0.05, 500, 0.03);
    }, 8000);
  }

  stopAmbient(): void {
    if (this.ambientTimerId) {
      clearInterval(this.ambientTimerId);
      this.ambientTimerId = null;
    }
  }

  private playAmbientNoise(duration: number, sampleRate: number, _vol: number): void {
    if (!this.ctx || !this.ambientGain) return;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.03));
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = sampleRate;
    filter.Q.value = 0.5;
    source.connect(filter);
    filter.connect(this.ambientGain);
    source.start();
  }

  // ============ 销毁 ============

  destroy(): void {
    this.bgmStop();
    this.stopAmbient();
    this.stopAllEffects();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
      this.masterGain = null;
      this.sfxGain = null;
      this.bgmGain = null;
      this.mainBgmGain = null;
      this.climaxBgmGain = null;
      this.ambientGain = null;
      this.bgm = null;
      this.climaxBgm = null;
      // AudioContext 关闭后，所有关联的 AudioBuffer 失效，清空缓存
      this.audioBufferCache.clear();
    }
  }
}

// ============================================================
// 音效注册表 — 全部用 Web Audio API 程序化合成
// ============================================================

/** 辅助：播放短促音符 */
function playTone(
  ctx: AudioContext,
  dest: AudioNode,
  freq: number,
  startFreq: number | null,
  duration: number,
  type: OscillatorType = 'sine',
  volume = 0.2,
  filterFreq?: number,
): void {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  if (startFreq !== null) {
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(freq, now + duration * 0.3);
  } else {
    osc.frequency.value = freq;
  }

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.005);
  gain.gain.setValueAtTime(volume, now + duration * 0.7);
  gain.gain.linearRampToValueAtTime(0, now + duration);

  osc.connect(gain);

  if (filterFreq !== undefined) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    filter.Q.value = 2;
    gain.connect(filter);
    filter.connect(dest);
  } else {
    gain.connect(dest);
  }

  osc.start(now);
  osc.stop(now + duration + 0.05);
}

/** 辅助：播放噪声 */
function playNoise(
  ctx: AudioContext,
  dest: AudioNode,
  duration: number,
  volume = 0.1,
  filterType: BiquadFilterType = 'bandpass',
  filterFreq = 2000,
  decay = 0.05,
): void {
  const now = ctx.currentTime;
  const bufferSize = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * decay));
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = filterFreq;
  filter.Q.value = 0.6;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  source.start(now);
}

/** 辅助：播放短促打击音 */
function playPerc(
  ctx: AudioContext,
  dest: AudioNode,
  freq: number,
  duration: number,
  volume = 0.2,
): void {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, now);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.3, now + duration);
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  osc.connect(gain);
  gain.connect(dest);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

/** 辅助：播放枪声音频文件（gun1.wav + gun2.mp3），使用传入的 ctx/dest */
function playGunshotAudio(ctx: AudioContext, dest: AudioNode): void {
  // 优先从 AudioManager 缓存取 AudioBuffer（预加载好的），用传入的 ctx 播放
  const audio = getAudioManager();

  const playBufferWithCtx = (url: string, offsetSec: number) => {
    // 如果 AudioContext 被挂起，先恢复
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const buffer = audio.getBuffer(url);
    if (buffer) {
      // 缓存命中，直接用传入的 ctx 播放
      try {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        const gain = ctx.createGain();
        gain.gain.value = 1;
        source.connect(gain);
        gain.connect(dest);
        source.start(ctx.currentTime + offsetSec);
      } catch {
        // buffer 可能来自已关闭的旧 Context，静默忽略
      }
      return;
    }

    // 缓存未命中，用传入的 ctx 实时 fetch + decode + 播放
    fetch(url)
      .then((r) => r.arrayBuffer())
      .then((ab) => ctx.decodeAudioData(ab))
      .then((buf) => {
        const source = ctx.createBufferSource();
        source.buffer = buf;
        const gain = ctx.createGain();
        gain.gain.value = 1;
        source.connect(gain);
        gain.connect(dest);
        source.start(ctx.currentTime + offsetSec);
        // 同时缓存到 AudioManager 供后续使用
        audio.setBuffer(url, buf);
      })
      .catch(() => {});
  };

  // 第一枪
  playBufferWithCtx('/gun1.wav', 0);
  // 第二枪（间隔0.6秒）
  playBufferWithCtx('/gun2.mp3', 0.6);
}

// ---- 注册表 ----

const SFX_REGISTRY: Partial<Record<SfxEvent, SfxDef>> = {
  // ==================== 游戏状态转换 ====================

  game_start: {
    category: 'game',
    play: (ctx, dest) => {
      // 上升琶音 + 低频撞击
      [523, 659, 784, 1047].forEach((f) => {
        playTone(ctx, dest, f, null, 0.3, 'sine', 0.08, 3000);
      });
      // 低频撞击
      playPerc(ctx, dest, 60, 0.4, 0.3);
    },
  },

  game_menu: {
    category: 'game',
    play: (ctx, dest) => {
      playTone(ctx, dest, 440, null, 0.15, 'sine', 0.06, 2000);
      setTimeout(() => playTone(ctx, dest, 523, null, 0.2, 'sine', 0.06, 2000), 80);
    },
  },

  game_back_to_menu: {
    category: 'game',
    play: (ctx, dest) => {
      playTone(ctx, dest, 523, null, 0.15, 'sine', 0.06, 2000);
      setTimeout(() => playTone(ctx, dest, 440, null, 0.2, 'sine', 0.06, 2000), 80);
    },
  },

  game_signal_lost: {
    category: 'game',
    play: (ctx, dest) => {
      playNoise(ctx, dest, 0.8, 0.08, 'bandpass', 800, 0.1);
      playTone(ctx, dest, 120, 300, 0.5, 'sawtooth', 0.1, 500);
    },
  },

  // ==================== UI 交互 ====================

  ui_click: {
    category: 'ui',
    play: (ctx, dest) => {
      playTone(ctx, dest, 800, null, 0.04, 'square', 0.04, 6000);
    },
  },

  ui_hover: {
    category: 'ui',
    play: (ctx, dest) => {
      playTone(ctx, dest, 1200, null, 0.03, 'sine', 0.02, 8000);
    },
  },

  ui_popup_open: {
    category: 'ui',
    play: (ctx, dest) => {
      playTone(ctx, dest, 600, null, 0.08, 'triangle', 0.06, 3000);
      setTimeout(() => playTone(ctx, dest, 800, null, 0.1, 'triangle', 0.06, 3000), 60);
    },
  },

  ui_popup_close: {
    category: 'ui',
    play: (ctx, dest) => {
      playTone(ctx, dest, 800, null, 0.06, 'triangle', 0.05, 3000);
      setTimeout(() => playTone(ctx, dest, 600, null, 0.08, 'triangle', 0.05, 3000), 50);
    },
  },

  ui_switch: {
    category: 'ui',
    play: (ctx, dest) => {
      playTone(ctx, dest, 1000, null, 0.05, 'square', 0.03, 5000);
    },
  },

  ui_error: {
    category: 'ui',
    play: (ctx, dest) => {
      playNoise(ctx, dest, 0.3, 0.06, 'bandpass', 400, 0.04);
      playTone(ctx, dest, 200, null, 0.2, 'sawtooth', 0.08, 300);
    },
  },

  ui_save: {
    category: 'ui',
    play: (ctx, dest) => {
      playTone(ctx, dest, 660, null, 0.1, 'sine', 0.04, 4000);
      setTimeout(() => playTone(ctx, dest, 880, null, 0.15, 'sine', 0.05, 4000), 100);
    },
  },

  // ==================== 按键/交互增强音效 ====================

  ui_button_press: {
    category: 'ui',
    play: (ctx, dest) => {
      // 广播控制台机械按键：厚重下沉 + 清脆回弹 + 电子确认音
      const now = ctx.currentTime;
      // 1. 按键下沉 — 低频撞击
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(180, now);
      osc1.frequency.exponentialRampToValueAtTime(60, now + 0.03);
      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc1.connect(gain1);
      gain1.connect(dest);
      osc1.start(now);
      osc1.stop(now + 0.06);
      // 2. 按键回弹 — 清脆高频 click
      setTimeout(() => {
        playTone(ctx, dest, 2400, null, 0.025, 'square', 0.04, 10000);
      }, 30);
      // 3. 电子确认 — 短促 sine ping
      setTimeout(() => {
        playTone(ctx, dest, 900, null, 0.06, 'sine', 0.05, 5000);
      }, 50);
      // 4. 微弱噪声模拟机械触感
      setTimeout(() => {
        playNoise(ctx, dest, 0.02, 0.01, 'highpass', 6000, 0.005);
      }, 10);
    },
  },

  ui_button_hover: {
    category: 'ui',
    play: (ctx, dest) => {
      // 悬停电子辉光：微弱的上升 sine + 细微电噪
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(1800, now);
      osc1.frequency.linearRampToValueAtTime(2200, now + 0.08);
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.025, now + 0.02);
      gain1.gain.linearRampToValueAtTime(0, now + 0.1);
      const filter1 = ctx.createBiquadFilter();
      filter1.type = 'highpass';
      filter1.frequency.value = 1500;
      osc1.connect(gain1);
      gain1.connect(filter1);
      filter1.connect(dest);
      osc1.start(now);
      osc1.stop(now + 0.12);
      // 细微静电
      playNoise(ctx, dest, 0.04, 0.008, 'highpass', 8000, 0.01);
    },
  },

  ui_toggle_on: {
    category: 'ui',
    play: (ctx, dest) => {
      // 开关拨到 ON：机械卡扣声 + 通电嗡声 + LED 亮起音
      const now = ctx.currentTime;
      // 1. 机械卡扣 — 清脆 snap
      playTone(ctx, dest, 3000, null, 0.02, 'square', 0.06, 12000);
      // 2. 开关滑动 — 短暂摩擦噪声
      setTimeout(() => {
        playNoise(ctx, dest, 0.03, 0.015, 'bandpass', 3000, 0.01);
      }, 10);
      // 3. 通电嗡声 — 短暂上升
      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(400, now + 0.04);
        osc2.frequency.linearRampToValueAtTime(800, now + 0.12);
        gain2.gain.setValueAtTime(0.04, now + 0.04);
        gain2.gain.linearRampToValueAtTime(0, now + 0.15);
        osc2.connect(gain2);
        gain2.connect(dest);
        osc2.start(now + 0.04);
        osc2.stop(now + 0.16);
      }, 0);
      // 4. LED 亮起 — 高频叮
      setTimeout(() => {
        playTone(ctx, dest, 5000, null, 0.04, 'sine', 0.03, 15000);
      }, 60);
    },
  },

  ui_toggle_off: {
    category: 'ui',
    play: (ctx, dest) => {
      // 开关拨到 OFF：断电下降音 + 机械复位
      const now = ctx.currentTime;
      // 1. 断电下降
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(800, now);
      osc1.frequency.exponentialRampToValueAtTime(200, now + 0.1);
      gain1.gain.setValueAtTime(0.04, now);
      gain1.gain.linearRampToValueAtTime(0, now + 0.12);
      osc1.connect(gain1);
      gain1.connect(dest);
      osc1.start(now);
      osc1.stop(now + 0.14);
      // 2. 机械复位 click
      setTimeout(() => {
        playTone(ctx, dest, 1500, null, 0.015, 'square', 0.04, 10000);
      }, 60);
      // 3. 残余放电 noise
      setTimeout(() => {
        playNoise(ctx, dest, 0.05, 0.01, 'highpass', 5000, 0.01);
      }, 80);
    },
  },

  ui_purchase: {
    category: 'ui',
    play: (ctx, dest) => {
      // 赛博朋克收银机：金属硬币碰撞 + 电子确认琶音
      // 1. 硬币落下 — 金属碰撞
      playTone(ctx, dest, 2600, null, 0.04, 'square', 0.06, 12000);
      setTimeout(() => playTone(ctx, dest, 3200, null, 0.03, 'square', 0.05, 15000), 60);
      setTimeout(() => playTone(ctx, dest, 2100, null, 0.05, 'square', 0.05, 10000), 120);
      // 2. 电子确认上升琶音
      setTimeout(() => {
        [523, 659, 784].forEach((f, i) => {
          setTimeout(() => {
            playTone(ctx, dest, f, null, 0.1, 'sine', 0.06, 4000);
          }, i * 60);
        });
      }, 150);
      // 3. 收银机抽屉声 — 短暂低频
      setTimeout(() => {
        playPerc(ctx, dest, 200, 0.06, 0.08);
      }, 180);
    },
  },

  ui_purchase_fail: {
    category: 'ui',
    play: (ctx, dest) => {
      // 购买失败：低频错误嗡 + 两次短蜂鸣
      const now = ctx.currentTime;
      // 1. 低频嗡
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(180, now);
      osc1.frequency.linearRampToValueAtTime(140, now + 0.2);
      gain1.gain.setValueAtTime(0.05, now);
      gain1.gain.linearRampToValueAtTime(0, now + 0.25);
      const filter1 = ctx.createBiquadFilter();
      filter1.type = 'lowpass';
      filter1.frequency.value = 300;
      osc1.connect(gain1);
      gain1.connect(filter1);
      filter1.connect(dest);
      osc1.start(now);
      osc1.stop(now + 0.3);
      // 2. 两次错误蜂鸣
      playTone(ctx, dest, 400, null, 0.08, 'square', 0.06, 2000);
      setTimeout(() => playTone(ctx, dest, 350, null, 0.08, 'square', 0.06, 2000), 120);
    },
  },

  ui_stage_select: {
    category: 'ui',
    play: (ctx, dest) => {
      // 关卡选择确认：赛博朋克扫描线锁定音
      const now = ctx.currentTime;
      // 1. 扫描线 sweep
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(300, now);
      osc1.frequency.exponentialRampToValueAtTime(1200, now + 0.15);
      gain1.gain.setValueAtTime(0.05, now);
      gain1.gain.linearRampToValueAtTime(0, now + 0.2);
      osc1.connect(gain1);
      gain1.connect(dest);
      osc1.start(now);
      osc1.stop(now + 0.22);
      // 2. 锁定确认 — 双重 click
      setTimeout(() => playTone(ctx, dest, 800, null, 0.04, 'square', 0.04, 6000), 100);
      setTimeout(() => playTone(ctx, dest, 1200, null, 0.06, 'square', 0.05, 8000), 140);
      // 3. 数据流 noise
      setTimeout(() => {
        playNoise(ctx, dest, 0.06, 0.015, 'highpass', 4000, 0.015);
      }, 120);
    },
  },

  ui_modal_open: {
    category: 'ui',
    play: (ctx, dest) => {
      // 弹窗滑入：机械面板展开 + 液压声
      const now = ctx.currentTime;
      // 1. 液压/气动 — 低频 whoosh
      playNoise(ctx, dest, 0.3, 0.04, 'bandpass', 400, 0.06);
      // 2. 面板展开 — 上升音
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(200, now);
      osc1.frequency.linearRampToValueAtTime(500, now + 0.2);
      gain1.gain.setValueAtTime(0.06, now);
      gain1.gain.linearRampToValueAtTime(0, now + 0.25);
      osc1.connect(gain1);
      gain1.connect(dest);
      osc1.start(now);
      osc1.stop(now + 0.28);
      // 3. 锁定 click
      setTimeout(() => {
        playTone(ctx, dest, 1000, null, 0.04, 'square', 0.04, 6000);
      }, 180);
    },
  },

  ui_modal_close: {
    category: 'ui',
    play: (ctx, dest) => {
      // 弹窗滑出：机械面板收回 + 下降音
      const now = ctx.currentTime;
      // 1. 解锁 click
      playTone(ctx, dest, 1000, null, 0.04, 'square', 0.04, 6000);
      // 2. 面板收回 — 下降音
      setTimeout(() => {
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(500, now + 0.05);
        osc1.frequency.linearRampToValueAtTime(200, now + 0.25);
        gain1.gain.setValueAtTime(0.06, now + 0.05);
        gain1.gain.linearRampToValueAtTime(0, now + 0.3);
        osc1.connect(gain1);
        gain1.connect(dest);
        osc1.start(now + 0.05);
        osc1.stop(now + 0.32);
      }, 0);
      // 3. 气动释放
      setTimeout(() => {
        playNoise(ctx, dest, 0.2, 0.03, 'highpass', 2000, 0.04);
      }, 80);
    },
  },

  ui_slider: {
    category: 'ui',
    play: (ctx, dest) => {
      // 滑块调节：细微摩擦声 + 电子刻度 tick
      // 1. 摩擦噪声
      playNoise(ctx, dest, 0.02, 0.006, 'bandpass', 3000, 0.005);
      // 2. 电子 tick
      playTone(ctx, dest, 2500, null, 0.015, 'sine', 0.02, 12000);
    },
  },

  ui_difficulty_switch: {
    category: 'ui',
    play: (ctx, dest) => {
      // 难度切换：系统警告/确认音，hard模式有额外红色警报感
      const now = ctx.currentTime;
      // 1. 系统扫描音
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(200, now);
      osc1.frequency.linearRampToValueAtTime(600, now + 0.08);
      osc1.frequency.linearRampToValueAtTime(300, now + 0.15);
      gain1.gain.setValueAtTime(0.06, now);
      gain1.gain.linearRampToValueAtTime(0, now + 0.2);
      const filter1 = ctx.createBiquadFilter();
      filter1.type = 'bandpass';
      filter1.frequency.setValueAtTime(300, now);
      filter1.frequency.linearRampToValueAtTime(800, now + 0.1);
      osc1.connect(gain1);
      gain1.connect(filter1);
      filter1.connect(dest);
      osc1.start(now);
      osc1.stop(now + 0.22);
      // 2. 确认/警告 click
      setTimeout(() => {
        playTone(ctx, dest, 1200, null, 0.05, 'square', 0.05, 8000);
      }, 120);
      // 3. 系统噪音
      setTimeout(() => {
        playNoise(ctx, dest, 0.04, 0.015, 'highpass', 5000, 0.01);
      }, 140);
    },
  },

  // ==================== 道具操作 ====================

  prop_pickup: {
    category: 'prop',
    play: (ctx, dest) => {
      playTone(ctx, dest, 500, 700, 0.08, 'sine', 0.06, 3000);
    },
  },

  prop_drop: {
    category: 'prop',
    play: (ctx, dest) => {
      playPerc(ctx, dest, 150, 0.12, 0.15);
    },
  },

  prop_undo: {
    category: 'prop',
    play: (ctx, dest) => {
      playTone(ctx, dest, 400, 600, 0.08, 'square', 0.05, 2000);
    },
  },

  prop_clear: {
    category: 'prop',
    play: (ctx, dest) => {
      playNoise(ctx, dest, 0.4, 0.08, 'highpass', 3000, 0.06);
      playTone(ctx, dest, 200, 500, 0.3, 'sawtooth', 0.08, 400);
    },
  },

  prop_bg_switch: {
    category: 'prop',
    play: (ctx, dest) => {
      playTone(ctx, dest, 700, null, 0.06, 'triangle', 0.04, 4000);
    },
  },

  // ==================== 表演阶段 ====================

  perform_start: {
    category: 'perform',
    play: (ctx, dest) => {
      // 大幕拉开效果：低频上升 + 高频闪亮
      playTone(ctx, dest, 80, 200, 0.6, 'sawtooth', 0.12, 200);
      setTimeout(() => playTone(ctx, dest, 1047, null, 0.4, 'sine', 0.06, 6000), 100);
      playNoise(ctx, dest, 0.5, 0.06, 'highpass', 5000, 0.04);
    },
  },

  perform_countdown: {
    category: 'perform',
    play: (ctx, dest) => {
      playTone(ctx, dest, 1000, null, 0.06, 'square', 0.05, 8000);
    },
  },

  perform_end: {
    category: 'perform',
    play: (ctx, dest) => {
      playTone(ctx, dest, 600, 300, 0.3, 'triangle', 0.08, 2000);
    },
  },

  // ==================== 20 种道具动画音效 ====================

  effect_banana: {
    category: 'effect',
    play: (ctx, dest) => {
      // 香蕉皮滑倒：滑稽的滑音 + 跌倒声
      const now = ctx.currentTime;
      // 滑倒前的高频滑音
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(800, now);
      osc1.frequency.linearRampToValueAtTime(300, now + 0.2);
      gain1.gain.setValueAtTime(0.06, now);
      gain1.gain.linearRampToValueAtTime(0, now + 0.25);
      osc1.connect(gain1);
      gain1.connect(dest);
      osc1.start(now);
      osc1.stop(now + 0.3);
      // 落地闷响
      playPerc(ctx, dest, 120, 0.15, 0.1);
    },
  },

  effect_portal: {
    category: 'effect',
    play: (ctx, dest) => {
      // 传送门：神秘漩涡声 + 高频闪烁
      const now = ctx.currentTime;
      // 旋转低频漩涡
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(120, now);
      osc1.frequency.linearRampToValueAtTime(300, now + 1.5);
      osc1.frequency.linearRampToValueAtTime(120, now + 3);
      gain1.gain.setValueAtTime(0.05, now);
      gain1.gain.linearRampToValueAtTime(0, now + 3);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(200, now);
      filter.frequency.linearRampToValueAtTime(800, now + 1.5);
      filter.frequency.linearRampToValueAtTime(200, now + 3);
      osc1.connect(gain1);
      gain1.connect(filter);
      filter.connect(dest);
      osc1.start(now);
      osc1.stop(now + 3.1);
      // 高频闪烁"叮叮"
      for (let i = 0; i < 4; i++) {
        setTimeout(() => {
          playTone(ctx, dest, 3000 + Math.random() * 2000, null, 0.06, 'sine', 0.03, 10000);
        }, i * 600);
      }
    },
  },

  effect_trampoline: {
    category: 'effect',
    play: (ctx, dest) => {
      // 弹射板：清脆金属弹簧 "boing~" + 弹射冲击
      const now = ctx.currentTime;
      // 弹簧拉伸声
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(200, now);
      osc1.frequency.linearRampToValueAtTime(800, now + 0.1);
      gain1.gain.setValueAtTime(0.1, now);
      gain1.gain.linearRampToValueAtTime(0, now + 0.3);
      osc1.connect(gain1);
      gain1.connect(dest);
      osc1.start(now);
      osc1.stop(now + 0.35);
      // 弹射冲击 "砰"
      setTimeout(() => playPerc(ctx, dest, 300, 0.1, 0.08), 50);
    },
  },

  effect_bomb: {
    category: 'effect',
    play: (ctx, dest) => {
      // 定时炸弹：急促滴答声 + 最后爆炸
      // 越来越快的滴答
      for (let i = 0; i < 8; i++) {
        const delay = i * 0.15 * (1 - i * 0.08);
        setTimeout(() => {
          playTone(ctx, dest, 1200, null, 0.03, 'square', 0.06, 15000);
        }, delay * 1000);
      }
      // 最终爆炸
      setTimeout(() => {
        playNoise(ctx, dest, 0.5, 0.15, 'lowpass', 300, 0.12);
        playTone(ctx, dest, 60, 200, 0.4, 'sawtooth', 0.15, 100);
      }, 800);
    },
  },

  effect_barrel: {
    category: 'effect',
    play: (ctx, dest) => {
      // 爆炸桶：闷胀鼓动 + 突然爆发
      const now = ctx.currentTime;
      // 闷胀低频
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(50, now);
      osc1.frequency.linearRampToValueAtTime(80, now + 1.0);
      osc1.frequency.linearRampToValueAtTime(40, now + 1.5);
      osc1.frequency.linearRampToValueAtTime(100, now + 2.0);
      gain1.gain.setValueAtTime(0.08, now);
      gain1.gain.linearRampToValueAtTime(0, now + 2.5);
      const filter1 = ctx.createBiquadFilter();
      filter1.type = 'lowpass';
      filter1.frequency.setValueAtTime(100, now);
      filter1.frequency.linearRampToValueAtTime(200, now + 1.0);
      osc1.connect(gain1);
      gain1.connect(filter1);
      filter1.connect(dest);
      osc1.start(now);
      osc1.stop(now + 2.6);
      // 突然爆炸
      setTimeout(() => {
        playNoise(ctx, dest, 0.4, 0.12, 'lowpass', 400, 0.1);
        playTone(ctx, dest, 80, 150, 0.3, 'sawtooth', 0.12, 150);
      }, 1200);
    },
  },

  effect_clumsyNpc: {
    category: 'effect',
    play: (ctx, dest) => {
      // 主角：卡通搞笑摇晃 + 撞到东西的"哎哟"
      const now = ctx.currentTime;
      // 摇晃 wobble 音
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(350, now);
      osc1.frequency.linearRampToValueAtTime(450, now + 0.15);
      osc1.frequency.linearRampToValueAtTime(320, now + 0.3);
      osc1.frequency.linearRampToValueAtTime(400, now + 0.45);
      gain1.gain.setValueAtTime(0.08, now);
      gain1.gain.linearRampToValueAtTime(0, now + 0.5);
      osc1.connect(gain1);
      gain1.connect(dest);
      osc1.start(now);
      osc1.stop(now + 0.55);
    },
  },

  effect_coffeeCup: {
    category: 'effect',
    play: (ctx, dest) => {
      // 咖啡杯：瓷器碰撞"叮叮" + 液体溅射
      // 瓷器清脆碰撞
      playTone(ctx, dest, 2600, null, 0.04, 'sine', 0.04, 12000);
      setTimeout(() => playTone(ctx, dest, 3200, null, 0.03, 'sine', 0.03, 15000), 80);
      setTimeout(() => playTone(ctx, dest, 2000, null, 0.05, 'sine', 0.035, 10000), 160);
      // 液体溅射声
      setTimeout(() => playNoise(ctx, dest, 0.2, 0.04, 'bandpass', 2000, 0.04), 120);
    },
  },

  effect_springGlove: {
    category: 'effect',
    play: (ctx, dest) => {
      // 弹簧拳套：弹簧拉紧 + 出拳 "砰"
      const now = ctx.currentTime;
      // 弹簧蓄力声
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(600, now);
      osc1.frequency.linearRampToValueAtTime(200, now + 0.15);
      gain1.gain.setValueAtTime(0.06, now);
      gain1.gain.linearRampToValueAtTime(0, now + 0.2);
      const filter1 = ctx.createBiquadFilter();
      filter1.type = 'bandpass';
      filter1.frequency.value = 800;
      osc1.connect(gain1);
      gain1.connect(filter1);
      filter1.connect(dest);
      osc1.start(now);
      osc1.stop(now + 0.25);
      // 出拳冲击
      setTimeout(() => {
        playTone(ctx, dest, 150, 400, 0.1, 'square', 0.08, 2000);
        playPerc(ctx, dest, 200, 0.08, 0.1);
      }, 120);
    },
  },

  effect_jetpack: {
    category: 'effect',
    play: (ctx, dest) => {
      // 喷气背包：猛烈火焰喷射 + 上升呼啸
      const now = ctx.currentTime;
      // 火焰喷发声
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(150, now);
      osc1.frequency.linearRampToValueAtTime(400, now + 0.3);
      osc1.frequency.linearRampToValueAtTime(200, now + 0.6);
      gain1.gain.setValueAtTime(0.08, now);
      gain1.gain.linearRampToValueAtTime(0, now + 1.5);
      const filter1 = ctx.createBiquadFilter();
      filter1.type = 'bandpass';
      filter1.frequency.setValueAtTime(300, now);
      filter1.frequency.linearRampToValueAtTime(600, now + 0.5);
      osc1.connect(gain1);
      gain1.connect(filter1);
      filter1.connect(dest);
      osc1.start(now);
      osc1.stop(now + 1.6);
      // 喷射噪声
      playNoise(ctx, dest, 0.8, 0.06, 'bandpass', 500, 0.08);
      // 上升呼啸
      setTimeout(() => {
        playTone(ctx, dest, 300, 800, 0.3, 'sine', 0.04, 4000);
      }, 200);
    },
  },

  effect_magnet: {
    category: 'effect',
    play: (ctx, dest) => {
      // 磁铁地板：强烈电磁场嗡鸣 + 电火花
      const now = ctx.currentTime;
      // 磁场嗡鸣
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(120, now);
      osc1.frequency.linearRampToValueAtTime(200, now + 0.8);
      osc1.frequency.linearRampToValueAtTime(120, now + 1.6);
      gain1.gain.setValueAtTime(0.06, now);
      gain1.gain.linearRampToValueAtTime(0, now + 3);
      osc1.connect(gain1);
      gain1.connect(dest);
      osc1.start(now);
      osc1.stop(now + 3.1);
      // 电火花"滋啦"
      for (let i = 0; i < 5; i++) {
        setTimeout(() => {
          playNoise(ctx, dest, 0.05, 0.03, 'highpass', 6000, 0.02);
        }, 200 + i * 400 + Math.random() * 200);
      }
    },
  },

  effect_smokeMachine: {
    category: 'effect',
    play: (ctx, dest) => {
      // 烟雾机：厚重喷气 + 弥漫扩散
      const now = ctx.currentTime;
      // 气体喷射
      playNoise(ctx, dest, 0.6, 0.06, 'bandpass', 1500, 0.1);
      // 低频闷响
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(100, now);
      osc1.frequency.linearRampToValueAtTime(60, now + 1.0);
      gain1.gain.setValueAtTime(0.05, now);
      gain1.gain.linearRampToValueAtTime(0, now + 1.2);
      const filter1 = ctx.createBiquadFilter();
      filter1.type = 'lowpass';
      filter1.frequency.value = 200;
      osc1.connect(gain1);
      gain1.connect(filter1);
      filter1.connect(dest);
      osc1.start(now);
      osc1.stop(now + 1.3);
    },
  },

  effect_mirror: {
    category: 'effect',
    play: (ctx, dest) => {
      // 镜子：耀眼闪光 + 镜面反射
      const now = ctx.currentTime;
      // 高亮闪光 "叮~"
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(4000, now);
      osc1.frequency.linearRampToValueAtTime(6000, now + 0.1);
      osc1.frequency.linearRampToValueAtTime(2000, now + 0.3);
      gain1.gain.setValueAtTime(0.05, now);
      gain1.gain.linearRampToValueAtTime(0, now + 0.5);
      osc1.connect(gain1);
      gain1.connect(dest);
      osc1.start(now);
      osc1.stop(now + 0.55);
      // 延迟回响
      setTimeout(() => playTone(ctx, dest, 3000, null, 0.1, 'sine', 0.03, 12000), 150);
    },
  },

  effect_bicycle: {
    category: 'effect',
    play: (ctx, dest) => {
      // 自行车：链条转动 + 车铃叮当 + 快速经过
      // 链条/轮子快速转动
      for (let i = 0; i < 10; i++) {
        setTimeout(() => {
          playNoise(ctx, dest, 0.03, 0.015, 'bandpass', 2500 + Math.random() * 1000, 0.02);
        }, i * 60);
      }
      // 车铃 "叮铃~"
      setTimeout(() => {
        playTone(ctx, dest, 1800, 2200, 0.08, 'sine', 0.04, 8000);
        setTimeout(() => playTone(ctx, dest, 1800, 2200, 0.06, 'sine', 0.03, 8000), 100);
      }, 200);
      // 快速经过的风声
      setTimeout(() => playNoise(ctx, dest, 0.3, 0.04, 'highpass', 4000, 0.05), 300);
    },
  },

  effect_glue: {
    category: 'effect',
    play: (ctx, dest) => {
      // 胶水地毯：黏稠"咕嘟咕嘟" + 粘住拉扯
      const now = ctx.currentTime;
      // 黏稠气泡声
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          const osc1 = ctx.createOscillator();
          const gain1 = ctx.createGain();
          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(100, now + i * 0.5);
          osc1.frequency.linearRampToValueAtTime(200, now + i * 0.5 + 0.15);
          osc1.frequency.linearRampToValueAtTime(80, now + i * 0.5 + 0.25);
          gain1.gain.setValueAtTime(0.06, now + i * 0.5);
          gain1.gain.linearRampToValueAtTime(0, now + i * 0.5 + 0.3);
          const filter1 = ctx.createBiquadFilter();
          filter1.type = 'lowpass';
          filter1.frequency.value = 300;
          osc1.connect(gain1);
          gain1.connect(filter1);
          filter1.connect(dest);
          osc1.start(now + i * 0.5);
          osc1.stop(now + i * 0.5 + 0.35);
        }, 0);
      }
    },
  },

  effect_skateboard: {
    category: 'effect',
    play: (ctx, dest) => {
      // 滑板：轮子高速摩擦 + 漂移
      // 轮子摩擦声
      playNoise(ctx, dest, 0.5, 0.04, 'bandpass', 1200, 0.04);
      // 高速滑动
      setTimeout(() => playNoise(ctx, dest, 0.3, 0.03, 'highpass', 3000, 0.04), 150);
      setTimeout(() => playNoise(ctx, dest, 0.3, 0.03, 'highpass', 3000, 0.04), 300);
      // 滑板落地/碰撞
      setTimeout(() => playPerc(ctx, dest, 250, 0.06, 0.06), 400);
    },
  },

  effect_bouncyMushroom: {
    category: 'effect',
    play: (ctx, dest) => {
      // 弹跳蘑菇：Q弹软萌 "啵哟~" + 弹飞音
      const now = ctx.currentTime;
      // 蘑菇Q弹压缩声
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(350, now);
      osc1.frequency.linearRampToValueAtTime(600, now + 0.08);
      osc1.frequency.linearRampToValueAtTime(250, now + 0.2);
      osc1.frequency.linearRampToValueAtTime(500, now + 0.3);
      gain1.gain.setValueAtTime(0.08, now);
      gain1.gain.linearRampToValueAtTime(0, now + 0.4);
      const filter1 = ctx.createBiquadFilter();
      filter1.type = 'lowpass';
      filter1.frequency.value = 800;
      osc1.connect(gain1);
      gain1.connect(filter1);
      filter1.connect(dest);
      osc1.start(now);
      osc1.stop(now + 0.45);
      // 弹飞"嗖~"
      setTimeout(() => {
        playTone(ctx, dest, 400, 800, 0.15, 'sine', 0.05, 3000);
      }, 100);
    },
  },

  effect_hairDryer: {
    category: 'effect',
    play: (ctx, dest) => {
      // 吹风机：强风呼啸 + 电机轰鸣
      const now = ctx.currentTime;
      // 电机声
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(180, now);
      osc1.frequency.linearRampToValueAtTime(250, now + 0.3);
      osc1.frequency.linearRampToValueAtTime(200, now + 0.8);
      gain1.gain.setValueAtTime(0.06, now);
      gain1.gain.linearRampToValueAtTime(0, now + 2);
      const filter1 = ctx.createBiquadFilter();
      filter1.type = 'bandpass';
      filter1.frequency.value = 400;
      osc1.connect(gain1);
      gain1.connect(filter1);
      filter1.connect(dest);
      osc1.start(now);
      osc1.stop(now + 2.1);
      // 强风噪声
      playNoise(ctx, dest, 1.2, 0.08, 'bandpass', 600, 0.12);
      // 二次风噪
      setTimeout(() => playNoise(ctx, dest, 0.8, 0.06, 'highpass', 2000, 0.1), 500);
    },
  },

  effect_reverseGravity: {
    category: 'effect',
    play: (ctx, dest) => {
      // 反向重力区：失重上升 + 空间扭曲
      const now = ctx.currentTime;
      // 上升电子音
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(200, now);
      osc1.frequency.exponentialRampToValueAtTime(800, now + 1.5);
      osc1.frequency.exponentialRampToValueAtTime(200, now + 3);
      gain1.gain.setValueAtTime(0.06, now);
      gain1.gain.linearRampToValueAtTime(0, now + 3);
      const filter1 = ctx.createBiquadFilter();
      filter1.type = 'lowpass';
      filter1.frequency.setValueAtTime(300, now);
      filter1.frequency.linearRampToValueAtTime(2000, now + 1.5);
      osc1.connect(gain1);
      gain1.connect(filter1);
      filter1.connect(dest);
      osc1.start(now);
      osc1.stop(now + 3.1);
      // 空间扭曲杂音
      setTimeout(() => playNoise(ctx, dest, 0.3, 0.03, 'bandpass', 1000, 0.03), 500);
      setTimeout(() => playNoise(ctx, dest, 0.3, 0.03, 'bandpass', 1500, 0.03), 1200);
    },
  },

  effect_fakeCeiling: {
    category: 'effect',
    play: (ctx, dest) => {
      // 假天花板：沉重的压碎感 + 结构崩塌
      // 建筑嘎吱声
      playNoise(ctx, dest, 0.4, 0.06, 'bandpass', 150, 0.06);
      playTone(ctx, dest, 60, 100, 0.4, 'sawtooth', 0.08, 120);
      // 崩塌冲击
      setTimeout(() => {
        playNoise(ctx, dest, 0.5, 0.1, 'lowpass', 200, 0.1);
        playTone(ctx, dest, 40, 80, 0.5, 'square', 0.12, 100);
      }, 300);
    },
  },

  effect_rotatingStage: {
    category: 'effect',
    play: (ctx, dest) => {
      // 旋转舞台：机械马达 + 舞台旋转
      const now = ctx.currentTime;
      // 马达启动嗡鸣
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(80, now);
      osc1.frequency.linearRampToValueAtTime(140, now + 0.5);
      osc1.frequency.linearRampToValueAtTime(110, now + 1.0);
      osc1.frequency.linearRampToValueAtTime(130, now + 1.5);
      gain1.gain.setValueAtTime(0.06, now);
      gain1.gain.linearRampToValueAtTime(0, now + 3);
      const filter1 = ctx.createBiquadFilter();
      filter1.type = 'lowpass';
      filter1.frequency.setValueAtTime(150, now);
      filter1.frequency.linearRampToValueAtTime(300, now + 1);
      osc1.connect(gain1);
      gain1.connect(filter1);
      filter1.connect(dest);
      osc1.start(now);
      osc1.stop(now + 3.1);
      // 齿轮/轴承声
      for (let i = 0; i < 6; i++) {
        setTimeout(() => {
          playNoise(ctx, dest, 0.03, 0.015, 'bandpass', 3000, 0.01);
        }, 200 + i * 400);
      }
    },
  },

  effect_wishMachine: {
    category: 'effect',
    play: (ctx, dest) => {
      // 百变许愿机：魔法变身 + 彩虹闪烁 + 华丽收尾
      const now = ctx.currentTime;
      // 魔法蓄力上升音
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(300, now);
      osc1.frequency.exponentialRampToValueAtTime(1200, now + 0.8);
      gain1.gain.setValueAtTime(0.06, now);
      gain1.gain.linearRampToValueAtTime(0.08, now + 0.4);
      gain1.gain.linearRampToValueAtTime(0, now + 1.0);
      osc1.connect(gain1);
      gain1.connect(dest);
      osc1.start(now);
      osc1.stop(now + 1.1);
      // 彩虹琶音 "叮叮叮叮~"
      [523, 659, 784, 1047, 1319].forEach((f, i) => {
        setTimeout(() => {
          playTone(ctx, dest, f, null, 0.12, 'sine', 0.05, 6000);
        }, 200 + i * 80);
      });
      // 变身闪光 "唰~"
      setTimeout(() => {
        playNoise(ctx, dest, 0.2, 0.04, 'highpass', 8000, 0.06);
        playTone(ctx, dest, 2000, 3000, 0.15, 'triangle', 0.04, 10000);
      }, 600);
      // 华丽收尾
      setTimeout(() => {
        playTone(ctx, dest, 1047, 1568, 0.3, 'sine', 0.06, 8000);
        playPerc(ctx, dest, 800, 0.1, 0.06);
      }, 800);
    },
  },

  // ==================== AI 弹幕交互 ====================

  danmaku_arrive: {
    category: 'danmaku',
    play: (ctx, dest) => {
      // 弹幕到达 — 轻巧 "噗"
      playTone(ctx, dest, 600, 800, 0.06, 'sine', 0.04, 4000);
    },
  },

  danmaku_silence: {
    category: 'danmaku',
    play: (ctx, dest) => {
      // 沉默 — 微弱的低频
      playTone(ctx, dest, 100, null, 0.3, 'sine', 0.03, 200);
    },
  },

  danmaku_super_chat: {
    category: 'danmaku',
    play: (ctx, dest) => {
      // Super Chat — 金币/闪光
      playTone(ctx, dest, 1200, null, 0.1, 'sine', 0.06, 8000);
      setTimeout(() => playTone(ctx, dest, 1600, null, 0.15, 'sine', 0.06, 10000), 80);
      setTimeout(() => playTone(ctx, dest, 2000, null, 0.2, 'sine', 0.05, 12000), 160);
    },
  },

  judge_scoring: {
    category: 'danmaku',
    play: (ctx, dest) => {
      // 裁判打分 — 打字机/计算音
      playTone(ctx, dest, 500, null, 0.06, 'square', 0.04, 5000);
      setTimeout(() => playTone(ctx, dest, 600, null, 0.06, 'square', 0.04, 5000), 100);
      setTimeout(() => playTone(ctx, dest, 700, null, 0.08, 'square', 0.05, 5000), 200);
    },
  },

  judge_high_score: {
    category: 'danmaku',
    play: (ctx, dest) => {
      // 高分 — 上升琶音
      [523, 659, 784, 1047].forEach((f, i) => {
        setTimeout(() => playTone(ctx, dest, f, null, 0.2, 'sine', 0.08, 4000), i * 80);
      });
    },
  },

  judge_low_score: {
    category: 'danmaku',
    play: (ctx, dest) => {
      // 低分 — 下降音
      playTone(ctx, dest, 300, 400, 0.25, 'triangle', 0.06, 1000);
    },
  },

  // ==================== 绷不住值变化 ====================

  meter_increase_small: {
    category: 'meter',
    play: (ctx, dest) => {
      playTone(ctx, dest, 800, null, 0.04, 'sine', 0.03, 6000);
    },
  },

  meter_increase_medium: {
    category: 'meter',
    play: (ctx, dest) => {
      playTone(ctx, dest, 600, null, 0.06, 'triangle', 0.05, 4000);
    },
  },

  meter_increase_large: {
    category: 'meter',
    play: (ctx, dest) => {
      playTone(ctx, dest, 400, 600, 0.12, 'sawtooth', 0.08, 2000);
    },
  },

  meter_near_pass: {
    category: 'meter',
    play: (ctx, dest) => {
      // 接近过关 — 紧张脉冲
      for (let i = 0; i < 4; i++) {
        playTone(ctx, dest, 1000, null, 0.08, 'square', 0.05, 8000);
      }
    },
  },

  meter_pass: {
    category: 'meter',
    play: (ctx, dest) => {
      // 达标 — 胜利号角
      [523, 659, 784, 1047, 784, 1047].forEach((f, i) => {
        setTimeout(() => playTone(ctx, dest, f, null, 0.25, 'sine', 0.1, 4000), i * 100);
      });
    },
  },

  meter_force_settle: {
    category: 'meter',
    play: (ctx, dest) => {
      // "立即执行" — 冲击音
      playPerc(ctx, dest, 80, 0.3, 0.25);
      playNoise(ctx, dest, 0.3, 0.06, 'highpass', 4000, 0.04);
    },
  },

  // ==================== 结算 ====================

  result_modal_open: {
    category: 'result',
    play: (ctx, dest) => {
      // 弹窗出现 — 开门音
      playTone(ctx, dest, 300, 500, 0.3, 'triangle', 0.08, 2000);
    },
  },

  result_pass: {
    category: 'result',
    play: (ctx, dest) => {
      // 通关 — 枪声 + 胜利旋律
      // 先用枪声宣告（复用 result_fail 的枪声播放逻辑）
      playGunshotAudio(ctx, dest);
      // 枪声后接胜利旋律
      const notes = [523, 659, 784, 659, 784, 1047];
      notes.forEach((f, i) => {
        setTimeout(() => playTone(ctx, dest, f, null, 0.3, 'sine', 0.1, 4000), 1000 + i * 120);
      });
    },
  },

  result_fail: {
    category: 'result',
    play: (ctx, dest) => {
      // 处决 — 枪声 + 倒地音效
      playGunshotAudio(ctx, dest);

      // 倒地音效
      setTimeout(() => {
        playNoise(ctx, dest, 0.5, 0.3, 'lowpass', 200, 0.15);
        playPerc(ctx, dest, 40, 0.5, 0.4);
      }, 750);

      // 低沉余韵
      setTimeout(() => {
        playTone(ctx, dest, 50, null, 1.0, 'sine', 0.15, 80);
      }, 900);
    },
  },

  result_new_judge: {
    category: 'result',
    play: (ctx, dest) => {
      // 新裁判 — 惊喜音
      playTone(ctx, dest, 600, 900, 0.2, 'sine', 0.06, 4000);
      setTimeout(() => playTone(ctx, dest, 900, null, 0.3, 'sine', 0.06, 4000), 150);
    },
  },

  result_button: {
    category: 'result',
    play: (ctx, dest) => {
      playTone(ctx, dest, 700, null, 0.05, 'square', 0.04, 5000);
    },
  },

  // ==================== 环境氛围 ====================

  ambient_live_room: {
    category: 'ambient',
    play: (ctx, dest) => {
      // 直播间底噪 — 极微弱的持续噪声
      playNoise(ctx, dest, 3.0, 0.02, 'bandpass', 1000, 0.5);
    },
  },

  ambient_crt_scan: {
    category: 'ambient',
    play: (ctx, dest) => {
      // CRT 扫描线 — 高频微弱噪声
      playNoise(ctx, dest, 0.3, 0.015, 'highpass', 8000, 0.02);
    },
  },

  ambient_editing: {
    category: 'ambient',
    play: (ctx, dest) => {
      // 编辑阶段 — 低频嗡嗡
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 55;
      gain.gain.setValueAtTime(0.02, now);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 5);
    },
  },

  ambient_performing: {
    category: 'ambient',
    play: (ctx, dest) => {
      // 表演阶段 — 稍强低频 + 高频
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = 70;
      gain.gain.setValueAtTime(0.03, now);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 120;
      osc.connect(gain);
      gain.connect(filter);
      filter.connect(dest);
      osc.start(now);
      osc.stop(now + 5);
    },
  },

  // ==================== 场景环境音效 ====================

  ambient_cliff: {
    category: 'ambient',
    play: (ctx, dest) => {
      // 悬崖高空 — 呼啸风声 + 碎石掉落
      const now = ctx.currentTime;
      // 持续风声
      playNoise(ctx, dest, 1.5, 0.04, 'bandpass', 600, 0.3);
      // 低沉悬崖回响
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(55, now);
      osc.frequency.linearRampToValueAtTime(45, now + 1.2);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.linearRampToValueAtTime(0, now + 1.3);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 100;
      osc.connect(gain);
      gain.connect(filter);
      filter.connect(dest);
      osc.start(now);
      osc.stop(now + 1.4);
      // 碎石滚落
      setTimeout(() => playNoise(ctx, dest, 0.15, 0.02, 'highpass', 4000, 0.02), 600);
    },
  },

  ambient_cliff_fall: {
    category: 'ambient',
    play: (ctx, dest) => {
      // 道具坠崖 — 急速下坠"嗖~" + 撞击
      const now = ctx.currentTime;
      // 下坠呼声
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(600, now);
      osc1.frequency.exponentialRampToValueAtTime(100, now + 0.4);
      gain1.gain.setValueAtTime(0.08, now);
      gain1.gain.linearRampToValueAtTime(0, now + 0.5);
      osc1.connect(gain1);
      gain1.connect(dest);
      osc1.start(now);
      osc1.stop(now + 0.55);
      // 坠落风声
      playNoise(ctx, dest, 0.4, 0.04, 'highpass', 2000, 0.06);
    },
  },

  ambient_rapids: {
    category: 'ambient',
    play: (ctx, dest) => {
      // 猛龙过江 — 流水声 + 水花飞溅
      const now = ctx.currentTime;
      // 持续水流噪声（模拟溪流）
      playNoise(ctx, dest, 1.8, 0.04, 'bandpass', 500, 0.3);
      // 水面搅动低频
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(90, now);
      osc.frequency.linearRampToValueAtTime(110, now + 0.8);
      osc.frequency.linearRampToValueAtTime(80, now + 1.6);
      gain.gain.setValueAtTime(0.03, now);
      gain.gain.linearRampToValueAtTime(0, now + 1.8);
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 300;
      osc.connect(gain);
      gain.connect(filter);
      filter.connect(dest);
      osc.start(now);
      osc.stop(now + 1.9);
      // 水花
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          playNoise(ctx, dest, 0.06, 0.015, 'highpass', 5000 + Math.random() * 3000, 0.02);
        }, 300 + i * 400);
      }
    },
  },

  ambient_windstorm: {
    category: 'ambient',
    play: (ctx, dest) => {
      // 暴风席卷 — 狂风呼啸 + 物体飞旋
      const now = ctx.currentTime;
      // 强风持续噪声
      playNoise(ctx, dest, 1.8, 0.08, 'bandpass', 400, 0.25);
      // 阵风高低变化
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.linearRampToValueAtTime(300, now + 0.6);
      osc.frequency.linearRampToValueAtTime(150, now + 1.2);
      osc.frequency.linearRampToValueAtTime(250, now + 1.8);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.linearRampToValueAtTime(0, now + 2);
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 500;
      filter.Q.value = 1.5;
      osc.connect(gain);
      gain.connect(filter);
      filter.connect(dest);
      osc.start(now);
      osc.stop(now + 2.1);
    },
  },

  ambient_darkness: {
    category: 'ambient',
    play: (ctx, dest) => {
      // 至暗时刻 — 低沉压迫感 + 心悸脉冲
      const now = ctx.currentTime;
      // 深沉低频持续
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(30, now);
      osc.frequency.linearRampToValueAtTime(25, now + 1.5);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.linearRampToValueAtTime(0.03, now + 1);
      gain.gain.linearRampToValueAtTime(0, now + 2);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 80;
      osc.connect(gain);
      gain.connect(filter);
      filter.connect(dest);
      osc.start(now);
      osc.stop(now + 2.1);
      // 心悸般的不规则脉冲
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          playPerc(ctx, dest, 35, 0.3, 0.06);
        }, 400 + i * 600 + Math.random() * 200);
      }
    },
  },
};

// ============ 单例 ============

let instance: AudioManager | null = null;

export function getAudioManager(): AudioManager {
  if (!instance) {
    instance = new AudioManager();
  }
  return instance;
}
