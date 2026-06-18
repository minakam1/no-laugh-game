// ============================================================
// TutorialProgress — 引导步骤进度条
// ============================================================

import { useGameStore } from '@/store/gameStore';
import type { TutorialStep } from '@/types';
import { useTutorialFrameRect } from './tutorialFrame';

/** 引导步骤顺序定义 */
const TUTORIAL_STEPS: TutorialStep[] = [
  'welcome',
  'config',
  'menu',
  'game_tour',
  'first_round:place',
  'first_round:perform',
  'first_round:watch',
  'result_guide',
];

const STEP_LABELS: Record<string, string> = {
  welcome: '欢迎',
  config: '信号配置',
  menu: '选择模式',
  game_tour: '导览',
  'first_round:place': '放道具',
  'first_round:perform': '表演',
  'first_round:watch': 'AI反应',
  result_guide: '结算',
};

export function TutorialProgress() {
  const tutorialStep = useGameStore((s) => s.tutorialStep);
  const frameRect = useTutorialFrameRect();

  if (!tutorialStep) return null;

  const currentIndex = TUTORIAL_STEPS.indexOf(tutorialStep);
  const total = TUTORIAL_STEPS.length;

  return (
    <div
      className="fixed z-[203] h-1 bg-game-border/30 pointer-events-none"
      style={{
        top: frameRect.top + 8,
        left: frameRect.left + 8,
        width: Math.max(0, frameRect.width - 16),
      }}
    >
      <div
        className="h-full bg-gradient-to-r from-accent via-accent-secondary to-accent-tertiary transition-all duration-500 ease-out"
        style={{ width: `${((currentIndex + 1) / total) * 100}%` }}
      />
      {/* 步骤指示器 */}
      <div className="absolute top-2 right-0 flex items-center gap-2">
        <span className="font-cyber text-[9px] text-accent tracking-wider">
          TUTORIAL
        </span>
        <span className="font-data text-[10px] text-game-text-dim">
          {STEP_LABELS[tutorialStep] || ''} ({currentIndex + 1}/{total})
        </span>
      </div>
    </div>
  );
}
