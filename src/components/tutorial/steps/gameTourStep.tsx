// ============================================================
// gameTourStep — 游戏界面导览（4个子步骤依次高亮）
// ============================================================

import type { TutorialStepConfig } from '../TutorialOverlay';

/** 导览子步骤定义 */
export const gameTourSubSteps: TutorialStepConfig[] = [
  {
    target: 'game-prop-panel',
    bubble: {
      title: '1/4 EQUIPMENT // 道具区',
      lines: [
        '🔧 左边是道具仓库，拖拽到画布上即可部署。',
        '不同道具组合让 AI 质检员绷不住值涨得不一样。',
        '主角是免费道具，建议每回合都用上。',
      ],
      nextLabel: '继续',
      showSkip: true,
    },
  },
  {
    target: 'game-canvas',
    bubble: {
      title: '2/4 STAGE // 直播舞台',
      lines: [
        '🎬 中间是直播舞台，搭建的场景在这里表演。',
        '主角会滑倒、被弹飞、被炸……够好笑，AI 质检员就绷不住。',
        '拖拽道具到任意位置搭建场景。',
      ],
      nextLabel: '继续',
      showSkip: true,
    },
  },
  {
    target: 'game-danmaku',
    bubble: {
      title: '3/4 DANMAKU // 弹幕监控',
      lines: [
        '💬 右边弹幕区：AI 观众实时发言、吐槽、破防。',
        '表演结束后质检员给出评分和评语。',
        '评分越高 = AI 质检员笑得越厉害。',
      ],
      nextLabel: '继续',
      showSkip: true,
    },
  },
  {
    target: 'game-breakdown-bar',
    bubble: {
      title: '4/4 METER // 绷不住值',
      lines: [
        '📊 顶部绷不住值（得分进度）。',
        '每次表演后根据评分上涨。',
        '达到通关线（/后面的数字）= 通关！',
      ],
      nextLabel: '开始第一次挑战',
      showSkip: true,
    },
  },
];
