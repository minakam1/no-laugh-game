// ============================================================
// TutorialOverlay — 引导覆盖层主组件
// 管理引导步骤流转，渲染遮罩+气泡+进度
// 新增：Escape 快捷键跳过 + 全局跳过条
// ============================================================

import { useEffect, useMemo, useCallback, useRef, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import type { TutorialStep } from '@/types';
import { TutorialBackdrop } from './TutorialBackdrop';
import { TutorialBubble } from './TutorialBubble';
import { TutorialProgress } from './TutorialProgress';
import { eventBus } from '@/phaser/bridges/PhaserEventBus';
import { welcomeStep } from './steps/welcomeStep';
import { configStep } from './steps/configStep';
import { menuStep } from './steps/menuStep';
import { gameTourSubSteps } from './steps/gameTourStep';
import { firstRoundSubSteps } from './steps/firstRoundStep';
import { resultStep } from './steps/resultStep';
import { useTutorialFrameRect } from './tutorialFrame';

// ============================================================
// 步骤配置类型
// ============================================================

export interface TutorialStepConfig {
  /** 高亮目标 data-tutorial 值 */
  target?: string;
  /** 是否需要等用户操作后才推进（true=隐藏下一步按钮，等检测到操作自动推进） */
  waitForAction?: boolean;
  /** 气泡内容 */
  bubble: {
    title: string;
    lines: string[];
    nextLabel?: string;
    showSkip?: boolean;
  };
}

// 游戏导览子步骤：game_tour 会在4个子步骤之间切换

/** 首回合子步骤映射 */
// FIRST_ROUND_STEPS 仅用于文档参考，不需要运行时使用

// ============================================================
// 步骤流转逻辑
// ============================================================

/** 根据当前步骤获取配置和导航 */
function getStepConfig(step: TutorialStep): {
  config: TutorialStepConfig;
  /** 下一个步骤 */
  nextStep: TutorialStep;
} | null {
  if (!step) return null;

  switch (step) {
    case 'welcome':
      return { config: welcomeStep, nextStep: 'config' };
    case 'config':
      return { config: configStep, nextStep: 'menu' };
    case 'menu':
      return { config: menuStep, nextStep: 'game_tour' };
    case 'game_tour':
      return { config: gameTourSubSteps[0], nextStep: 'first_round:place' };
    case 'first_round:place':
      return { config: firstRoundSubSteps[0], nextStep: 'first_round:perform' };
    case 'first_round:perform':
      return { config: firstRoundSubSteps[1], nextStep: 'first_round:watch' };
    case 'first_round:watch':
      return { config: firstRoundSubSteps[2], nextStep: 'result_guide' };
    case 'result_guide':
      return { config: resultStep, nextStep: null };
    default:
      return null;
  }
}

// ============================================================
// game_tour 子步骤导航覆盖
// ============================================================

function getGameTourConfig(gameTourIndex: number): { config: TutorialStepConfig; nextIsLastTour: boolean } {
  const idx = Math.min(gameTourIndex, gameTourSubSteps.length - 1);
  const config = gameTourSubSteps[idx];
  const nextIsLastTour = idx >= gameTourSubSteps.length - 1;
  return { config, nextIsLastTour };
}

// ============================================================
// 主组件
// ============================================================

export function TutorialOverlay() {
  const tutorialStep = useGameStore((s) => s.tutorialStep);
  const setTutorialStep = useGameStore((s) => s.setTutorialStep);
  const completeTutorial = useGameStore((s) => s.completeTutorial);
  const skipTutorial = useGameStore((s) => s.skipTutorial);
  const phase = useGameStore((s) => s.phase);
  const meterValue = useGameStore((s) => s.meter.value);
  const [gameTourIndex, setGameTourIndex] = useState(0);
  const frameRect = useTutorialFrameRect();

  // 追踪已放置的道具（用于 first_round:place 步骤）
  const placedPropsRef = useRef<Set<string>>(new Set());
  const stepRef = useRef(tutorialStep);
  stepRef.current = tutorialStep;
  // 记录进入 first_round:watch 时的绷不住值，用于检测上升
  const watchMeterRef = useRef(0);

  // 当 game_tour 步骤进入时，重置子步骤计数
  useEffect(() => {
    if (tutorialStep === 'game_tour') {
      setGameTourIndex(0);
    }
  }, [tutorialStep]);

  // 获取当前步骤的配置
  const stepData = useMemo(() => {
    if (!tutorialStep) return null;

    // game_tour 特殊处理：4个子步骤共享同一个 tutorialStep
    if (tutorialStep === 'game_tour') {
      const { config, nextIsLastTour } = getGameTourConfig(gameTourIndex);
      return {
        config,
        nextStep: nextIsLastTour ? 'first_round:place' : ('game_tour' as TutorialStep),
      };
    }

    return getStepConfig(tutorialStep);
  }, [tutorialStep, gameTourIndex]);

  // ============================================================
  // 自动推进逻辑：监听用户操作事件
  // ============================================================

  // first_round:place — 监听道具放置（香蕉皮 + 主角），放好后自动推进
  useEffect(() => {
    if (tutorialStep !== 'first_round:place') {
      placedPropsRef.current.clear();
      return;
    }
    placedPropsRef.current.clear();

    const unsub = eventBus.on('prop-placed', (data: unknown) => {
      const { prop } = data as { prop: { type?: string; key?: string } };
      const propKey = prop.type ?? prop.key;
      if (!propKey) return;
      placedPropsRef.current.add(propKey);

      // 需要香蕉皮 AND 主角都放好
      if (placedPropsRef.current.has('banana') && placedPropsRef.current.has('clumsyNpc')) {
        if (stepRef.current === 'first_round:place') {
          setTutorialStep('first_round:perform');
        }
      }
    });

    return () => unsub();
  }, [tutorialStep, setTutorialStep]);

  // first_round:perform — 监听 phase 进入 performing（用户点击了开始表演）
  useEffect(() => {
    if (tutorialStep === 'first_round:perform' && phase === 'performing') {
      setTutorialStep('first_round:watch');
    }
  }, [tutorialStep, phase, setTutorialStep]);

  // first_round:watch — 记录初始绷不住值，上升后自动推进
  useEffect(() => {
    if (tutorialStep !== 'first_round:watch') {
      watchMeterRef.current = -1;
      return;
    }
    // 首次进入该步骤：记录初始值
    if (watchMeterRef.current < 0) {
      watchMeterRef.current = meterValue;
      return;
    }
    // 绷不住值上升 → 立即推进
    if (meterValue > watchMeterRef.current) {
      watchMeterRef.current = -1; // 防止重复触发
      setTutorialStep('result_guide');
    }
  }, [tutorialStep, meterValue, setTutorialStep]);

  const handleNext = useCallback(() => {
    if (!stepData) return;

    // waitForAction 步骤不应该通过按钮点击推进
    if (stepData.config.waitForAction) return;

    if (tutorialStep === 'game_tour') {
      const nextIndex = gameTourIndex + 1;
      if (nextIndex >= gameTourSubSteps.length) {
        setGameTourIndex(0);
        setTutorialStep('first_round:place');
      } else {
        setGameTourIndex(nextIndex);
      }
      return;
    }

    if (stepData.nextStep) {
      setTutorialStep(stepData.nextStep);
    } else {
      completeTutorial();
    }
  }, [stepData, tutorialStep, gameTourIndex, setTutorialStep, completeTutorial]);

  const handleSkip = useCallback(() => {
    skipTutorial();
  }, [skipTutorial]);

  // Escape 键跳过引导
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        skipTutorial();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [skipTutorial]);

  if (!tutorialStep || !stepData) return null;

  const { config } = stepData;

  // waitForAction 步骤：不显示遮罩和"下一步"，但保留引导框提示
  const isWaitingForAction = !!config.waitForAction;
  return (
    <>
      {!isWaitingForAction && (
        <TutorialBackdrop
          targetSelector={config.target}
          visible={true}
        />
      )}
      <TutorialBubble
        title={config.bubble.title}
        lines={config.bubble.lines}
        targetSelector={config.target}
        nextLabel={isWaitingForAction ? undefined : config.bubble.nextLabel || '下一步'}
        showSkip={config.bubble.showSkip !== false && !isWaitingForAction}
        passthrough={isWaitingForAction}
        dock={isWaitingForAction ? 'top-left' : undefined}
        avoidPointer={isWaitingForAction}
        onNext={isWaitingForAction ? undefined : handleNext}
        onSkip={handleSkip}
      />
      <TutorialProgress />
      {/* 全局跳过引导条（固定在屏幕外框内部） */}
      {config.bubble.showSkip !== false && (
        <div
          className="fixed z-[210] flex items-center gap-2"
          style={{
            right: frameRect.rightInset + 12,
            bottom: frameRect.bottomInset + 12,
          }}
        >
          <button
            onClick={handleSkip}
            className="px-3 py-1.5 border border-game-border bg-game-surface/90 backdrop-blur-sm
                       text-[11px] font-cyber text-game-text-dim
                       hover:border-accent-secondary hover:text-accent-secondary transition-all tracking-wider"
            title="按 Esc 键跳过"
          >
            ESC · 跳过引导
          </button>
        </div>
      )}
    </>
  );
}
