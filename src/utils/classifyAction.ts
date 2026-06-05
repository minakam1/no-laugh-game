// ============================================================
// ActionType 分类函数（README 5.1 节）
// ============================================================

import type { PlacedProp, EventChain, ActionType } from '@/types';

export function classifyAction(props: PlacedProp[], chains: EventChain[]): ActionType {
  if (chains.length >= 3) return 'chain:reaction';
  if (props.length >= 3 && chains.length >= 2) return 'prop:combo';
  if (props.length === 1 && chains.length <= 1) return 'prop:single';
  return 'prop:mixed';
}
