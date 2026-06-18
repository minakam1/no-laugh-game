// ============================================================
// firstRoundStep — 首回合交互引导（3个子步骤）
// ============================================================

import type { TutorialStepConfig } from '../TutorialOverlay';

export const firstRoundSubSteps: TutorialStepConfig[] = [
  {
    target: 'game-prop-banana',
    waitForAction: true,  // 等用户拖入香蕉皮和主角后自动推进
    bubble: {
      title: '1/3 TRAP // 部署陷阱',
      lines: [
        '🍌 在左边道具栏找到「香蕉皮」（3头肯），拖到舞台中央。',
        '再拖一个「主角」（免费）到香蕉皮附近。',
        '主角踩到香蕉皮滑倒——最经典的滑稽场景！',
      ],
      nextLabel: '放好了',
      showSkip: true,
    },
  },
  {
    target: 'game-perform-btn',
    waitForAction: true,  // 等用户点击开始表演后自动推进
    bubble: {
      title: '2/3 ACTION // 开始表演',
      lines: [
        '▶️ 道具放好了？点击画布底部的「开始表演」按钮。',
        '主角踩上香蕉皮——哧溜——滑倒了！',
        'AI 质检员们要开始面对这个场景了……',
      ],
      nextLabel: '表演中……',
      showSkip: true,
    },
  },
  {
    target: 'game-danmaku',
    waitForAction: true,  // 等表演结束出结果后自动推进
    bubble: {
      title: '3/3 REACTION // 观察反应',
      lines: [
        '👀 AI 质检员正在反应——弹幕会刷出实时感受。',
        '质检员会给出评分，分越高 = 笑得越厉害。',
        '分数转化为绷不住值，顶部的绷不住值会上涨。',
      ],
      nextLabel: '查看评分',
      showSkip: true,
    },
  },
];
