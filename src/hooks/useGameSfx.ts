// ============================================================
// useGameSfx — 游戏状态音效自动触发 Hook
// 通过 Zustand subscribe 监听状态变化，自动播放对应音效
// ============================================================

import { useEffect, useRef } from 'react';
import { useGameStore, getPassThreshold } from '@/store/gameStore';
import { getSoundManager } from '@/audio/SoundManager';
import { getAudioManager } from '@/audio/AudioManager';

/**
 * 在组件中调用此 Hook，自动根据游戏状态变化播放音效
 * 应放在 App 组件级别，确保全局音效
 */
export function useGameSfx() {
  const soundRef = useRef(getSoundManager());
  const audioRef = useRef(getAudioManager());
  const prevPhaseRef = useRef(useGameStore.getState().phase);
  const prevMeterValueRef = useRef(useGameStore.getState().meter.value);
  const prevRoundsLenRef = useRef(useGameStore.getState().meter.rounds.length);

  useEffect(() => {
    const sound = soundRef.current;
    const audio = audioRef.current;

    // 订阅 Zustand 状态变化
    const unsub = useGameStore.subscribe((state, prevState) => {
      const threshold = getPassThreshold(state.currentLevel, state.difficulty);
      const climaxThreshold = threshold * 0.5;
      const nearThreshold = Math.round(threshold * 0.85);

      // === 新关卡 / 新局：淡回常规 BGM ===
      if (
        state.phase === 'editing'
        && state.currentRound === 1
        && state.meter.value === 0
        && (
          prevState.meter.value > 0
          || prevState.currentRound !== 1
          || prevState.phase === 'result'
          || prevState.currentLevel !== state.currentLevel
          || prevState.mode !== state.mode
          || prevState.difficulty !== state.difficulty
        )
      ) {
        void audio.transitionToMainBgm();
      }

      // === 阶段变化音效 ===
      if (state.phase !== prevState.phase) {
        switch (state.phase) {
          case 'performing':
            sound.play('perform_start');
            break;
          case 'judging':
            break;
          case 'result':
            sound.play('result_modal_open');
            break;
          case 'editing':
            if (prevState.phase === 'performing' || prevState.phase === 'judging') {
              sound.play('perform_end');
            }
            break;
        }
        prevPhaseRef.current = state.phase;
      }

      // === 绷不住值变化音效 ===
      if (state.meter.value !== prevState.meter.value) {
        const gain = state.meter.value - prevState.meter.value;
        const absGain = Math.abs(gain);

        if (gain > 0) {
          if (absGain >= 8) {
            sound.play('meter_increase_large');
          } else if (absGain >= 4) {
            sound.play('meter_increase_medium');
          } else {
            sound.play('meter_increase_small');
          }
        }

        // 接近过关阈值
        if (state.meter.value >= nearThreshold && prevState.meter.value < nearThreshold) {
          sound.play('meter_near_pass');
        }

        // 游戏高潮：达到当前通关线 50% 后切入宣传片式合成 BGM
        if (state.meter.value >= climaxThreshold && prevState.meter.value < climaxThreshold) {
          void audio.transitionToClimaxBgm();
        }

        // 达标
        if (state.meter.value >= threshold && prevState.meter.value < threshold) {
          sound.play('meter_pass');
        }

        prevMeterValueRef.current = state.meter.value;
      }

      // === 新回合（AI 弹幕返回）音效 ===
      if (state.meter.rounds.length > prevState.meter.rounds.length) {
        const newRound = state.meter.rounds[state.meter.rounds.length - 1];
        if (newRound) {
          if (newRound.reaction && !['观众沉默了…', '阿乐笑得说不出话了…'].some(s => newRound.reaction.includes(s))) {
            if (newRound.funnyScore >= 7) {
              sound.play('judge_high_score');
            } else if (newRound.funnyScore <= 2) {
              sound.play('judge_low_score');
            } else {
              sound.play('judge_scoring');
            }
          } else {
            sound.play('danmaku_silence');
          }
        }
        prevRoundsLenRef.current = state.meter.rounds.length;
      }

      // === 强制结算 / 结算结果音效 ===
      if (state.phase === 'result' && prevState.phase !== 'result') {
        if (state.meter.value >= threshold) {
          sound.play('result_pass');
        } else {
          sound.play('result_fail');
        }
      }
    });

    return unsub;
  }, []);
}
