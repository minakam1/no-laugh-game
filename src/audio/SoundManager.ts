// ============================================================
// SoundManager — 音效调度器
// 负责道具持续音效的 tick 驱动循环播放、一次性音效触发
// 通过 AudioManager 单例播放所有音效
// ============================================================

import { getAudioManager, type SfxEvent } from './AudioManager';

/** 持续音效调度：按固定间隔循环播放，模拟持续的动画音效 */
interface ContinuousEffectSchedule {
  propId: string;
  event: SfxEvent;
  interval: number; // ms
  timerId: ReturnType<typeof setInterval> | null;
}

class SoundManager {
  private audio = getAudioManager();
  private continuousEffects: Map<string, ContinuousEffectSchedule> = new Map();

  /** 播放一次性音效 */
  play(event: SfxEvent): void {
    this.audio.play(event);
  }

  /**
   * 启动道具持续音效（按 interval 毫秒循环播放）
   * 用于表演阶段的道具动画音效
   */
  startContinuousEffect(
    propId: string,
    event: SfxEvent,
    interval: number,
  ): void {
    // 如果已有该道具的音效，先停止
    this.stopContinuousEffect(propId);

    const schedule: ContinuousEffectSchedule = {
      propId,
      event,
      interval,
      timerId: null,
    };

    // 立即播放一次
    this.audio.play(event);

    // 按间隔循环播放
    schedule.timerId = setInterval(() => {
      this.audio.play(event);
    }, interval);

    this.continuousEffects.set(propId, schedule);
  }

  /** 停止某个道具的持续音效 */
  stopContinuousEffect(propId: string): void {
    const schedule = this.continuousEffects.get(propId);
    if (schedule?.timerId) {
      clearInterval(schedule.timerId);
    }
    this.continuousEffects.delete(propId);
  }

  /** 停止所有持续音效 */
  stopAllContinuousEffects(): void {
    for (const [, schedule] of this.continuousEffects) {
      if (schedule.timerId) {
        clearInterval(schedule.timerId);
      }
    }
    this.continuousEffects.clear();
  }

  /** 初始化（首次用户交互时调用） */
  async init(): Promise<void> {
    await this.audio.init();
  }

  /** 销毁 */
  destroy(): void {
    this.stopAllContinuousEffects();
  }
}

// ============ 单例 ============

let instance: SoundManager | null = null;

export function getSoundManager(): SoundManager {
  if (!instance) {
    instance = new SoundManager();
  }
  return instance;
}

// ============ 道具效果音效映射表 ============
// 每个道具对应的持续音效事件和循环间隔

import type { PropKey } from '@/phaser/assets/manifest';

export interface PropEffectSfxConfig {
  /** 音效事件 */
  event: SfxEvent;
  /** 循环间隔 (ms)，0 表示只播放一次 */
  interval: number;
}

export const PROP_EFFECT_SFX: Record<PropKey, PropEffectSfxConfig> = {
  banana: { event: 'effect_banana', interval: 400 },
  portal: { event: 'effect_portal', interval: 0 },
  trampoline: { event: 'effect_trampoline', interval: 500 },
  bomb: { event: 'effect_bomb', interval: 0 },
  barrel: { event: 'effect_barrel', interval: 0 },
  clumsyNpc: { event: 'effect_clumsyNpc', interval: 800 },
  coffeeCup: { event: 'effect_coffeeCup', interval: 600 },
  springGlove: { event: 'effect_springGlove', interval: 500 },
  jetpack: { event: 'effect_jetpack', interval: 400 },
  magnet: { event: 'effect_magnet', interval: 0 },
  smokeMachine: { event: 'effect_smokeMachine', interval: 600 },
  mirror: { event: 'effect_mirror', interval: 500 },
  bicycle: { event: 'effect_bicycle', interval: 0 },
  glue: { event: 'effect_glue', interval: 1000 },
  skateboard: { event: 'effect_skateboard', interval: 500 },
  bouncyMushroom: { event: 'effect_bouncyMushroom', interval: 500 },
  hairDryer: { event: 'effect_hairDryer', interval: 0 },
  reverseGravity: { event: 'effect_reverseGravity', interval: 0 },
  fakeCeiling: { event: 'effect_fakeCeiling', interval: 0 },
  rotatingStage: { event: 'effect_rotatingStage', interval: 0 },
  wishMachine: { event: 'effect_wishMachine', interval: 0 },
};
