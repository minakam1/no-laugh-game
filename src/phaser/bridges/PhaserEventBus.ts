// ============================================================
// PhaserEventBus — React ↔ Phaser 通信总线（README 12.4 节）
// ============================================================

import type { PlacedProp, SceneSnapshot } from '@/types';

export interface PerformRequestedData {
  snapshot: SceneSnapshot;
  beforeScreenshot: string;
  afterScreenshot: string;
  effectDescriptions: string[];
}

export type EventBusEvent =
  | { type: 'prop-placed'; prop: PlacedProp }
  | { type: 'prop-removed'; propId: string }
  | { type: 'perform-requested'; data: PerformRequestedData }
  | { type: 'scene-ready' }
  | { type: 'scene-error'; error: Error };

type EventHandler = (data: unknown) => void;

class PhaserEventBus {
  private listeners = new Map<string, Set<EventHandler>>();

  on(event: string, fn: EventHandler): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn);
    return () => this.listeners.get(event)?.delete(fn);
  }

  emit(event: string, data?: unknown): void {
    this.listeners.get(event)?.forEach((fn) => fn(data));
  }

  clear(): void {
    this.listeners.clear();
  }
}

export const eventBus = new PhaserEventBus();
