// ============================================================
// SceneSnapshot → 自然语言描述（README 5.1 节）
// ============================================================

import type { SceneSnapshot } from '@/types';

export function generateSceneDescription(snapshot: SceneSnapshot): string {
  const setup = snapshot.props.map((p) =>
    `${p.actor || '主播'}在${p.positionDesc || `(${Math.round(p.x)},${Math.round(p.y)})`}`,
  );

  const events = snapshot.connections.map((chain) => {
    const steps = chain.steps.map((e) => {
      if (e.type === 'collision')
        return `${e.subject}撞上了${e.target}，导致${e.result}`;
      if (e.type === 'trigger')
        return `${e.subject}激活了${e.target}，触发了${e.result}`;
      if (e.type === 'reaction')
        return `${e.subject}对${e.target}的反应是${e.result}`;
      return '';
    });
    return steps.filter(Boolean).join('，然后');
  });

  return `直播间现场：${setup.join('，')}。接下来：${events.join('。紧接着，')}。`;
}
