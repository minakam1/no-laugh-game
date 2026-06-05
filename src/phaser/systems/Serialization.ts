// ============================================================
// Serialization — Phaser 场景 → SceneSnapshot（README 12.5 节）
// ============================================================

import type { PlacedProp, SceneSnapshot, EventChain, EventStep } from '@/types';

/**
 * 从编辑器场景状态构造 SceneSnapshot
 * 在 EditorScene 的"开始表演"时调用
 */
export function toSnapshot(
  props: PlacedProp[],
  connections: EventChain[],
): SceneSnapshot {
  return {
    props: [...props],
    connections: [...connections],
    timestamp: Date.now(),
  };
}

/**
 * 基于道具碰撞关系自动推导事件链
 * 简化版：检测空间上接近的道具并生成 collision 事件
 */
export function deriveEventChains(props: PlacedProp[]): EventChain[] {
  const chains: EventChain[] = [];
  const DISTANCE_THRESHOLD = 160;

  for (let i = 0; i < props.length; i++) {
    for (let j = i + 1; j < props.length; j++) {
      const dx = props[i].x - props[j].x;
      const dy = props[i].y - props[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < DISTANCE_THRESHOLD) {
        const step: EventStep = {
          type: 'collision',
          subject: props[i].type,
          target: props[j].type,
          result: `${props[i].type}与${props[j].type}发生互动`,
        };
        chains.push({
          id: `chain-${i}-${j}-${Date.now()}`,
          steps: [step],
        });
      }
    }
  }

  return chains;
}
