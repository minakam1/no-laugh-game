// ============================================================
// Serialization — Phaser 场景 → SceneSnapshot（README 12.5 节）
// ============================================================

import type { PlacedProp, SceneSnapshot, EventChain, EventStep } from '@/types';
import { PROP_MANIFEST } from '../assets/manifest';

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

const CELL_SIZE = 160;
const FLASH_HIT_PADDING = 96;
const MAX_PROPS_PER_CELL = 8;
const MAX_COLLISIONS_PER_PROP = 3;
const MAX_CHAIN_COUNT = 36;

interface SpatialEntry {
  prop: PlacedProp;
  radius: number;
}

function cellKey(cellX: number, cellY: number): string {
  return `${cellX}:${cellY}`;
}

function getPropRadius(prop: PlacedProp): number {
  const [width, height] = PROP_MANIFEST[prop.type].size;
  return Math.max(width, height) / 2;
}

/**
 * 基于道具粗略接近关系自动推导事件链。
 * 这里刻意使用宽松的“命中泡泡”，不做像素级碰撞，保留 Flash 恶搞游戏的近似手感。
 */
export function deriveEventChains(props: PlacedProp[]): EventChain[] {
  const chains: EventChain[] = [];
  const grid = new Map<string, SpatialEntry[]>();
  const collisionCounts = new Map<string, number>();

  for (const prop of props) {
    if (chains.length >= MAX_CHAIN_COUNT) break;

    const cellX = Math.floor(prop.x / CELL_SIZE);
    const cellY = Math.floor(prop.y / CELL_SIZE);
    const radius = getPropRadius(prop);
    const candidates: { other: PlacedProp; distSq: number }[] = [];

    for (let y = cellY - 1; y <= cellY + 1; y++) {
      for (let x = cellX - 1; x <= cellX + 1; x++) {
        const bucket = grid.get(cellKey(x, y));
        if (!bucket) continue;

        for (const entry of bucket) {
          if ((collisionCounts.get(entry.prop.id) ?? 0) >= MAX_COLLISIONS_PER_PROP) {
            continue;
          }

          const dx = prop.x - entry.prop.x;
          const dy = prop.y - entry.prop.y;
          const hitDistance = radius + entry.radius + FLASH_HIT_PADDING;
          const distSq = dx * dx + dy * dy;

          if (distSq <= hitDistance * hitDistance) {
            candidates.push({ other: entry.prop, distSq });
          }
        }
      }
    }

    candidates.sort((a, b) => a.distSq - b.distSq);

    let acceptedForProp = 0;
    for (const candidate of candidates) {
      if (chains.length >= MAX_CHAIN_COUNT) break;
      if (acceptedForProp >= MAX_COLLISIONS_PER_PROP) break;

      const propCount = collisionCounts.get(prop.id) ?? 0;
      const otherCount = collisionCounts.get(candidate.other.id) ?? 0;
      if (propCount >= MAX_COLLISIONS_PER_PROP || otherCount >= MAX_COLLISIONS_PER_PROP) {
        continue;
      }

      const step: EventStep = {
        type: 'collision',
        subject: candidate.other.type,
        target: prop.type,
        result: `${candidate.other.type}与${prop.type}发生互动`,
      };
      chains.push({
        id: `chain-${candidate.other.id}-${prop.id}`,
        steps: [step],
      });
      collisionCounts.set(prop.id, propCount + 1);
      collisionCounts.set(candidate.other.id, otherCount + 1);
      acceptedForProp++;
    }

    const key = cellKey(cellX, cellY);
    const bucket = grid.get(key) ?? [];
    if (bucket.length >= MAX_PROPS_PER_CELL) bucket.shift();
    bucket.push({ prop, radius });
    grid.set(key, bucket);
  }

  return chains;
}
