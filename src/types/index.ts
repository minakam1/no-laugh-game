// ============================================================
// 《不许笑》 - TypeScript 类型体系（README 第十三章）
// ============================================================

import type { PropKey } from '@/phaser/assets/manifest';

// ============ 道具 & 场景 ============

export interface TriggerConfig {
  type: 'collision' | 'click' | 'timer';
  targetId?: string;
  delay?: number;
  conditions?: string[];
}

export interface PlacedProp {
  id: string;
  type: PropKey;
  x: number;
  y: number;
  rotation: number;
  actor?: string;
  positionDesc?: string;
  triggers: TriggerConfig[];
}

export interface EventStep {
  type: 'collision' | 'trigger' | 'reaction';
  subject: string;
  target: string;
  result: string;
}

export interface EventChain {
  id: string;
  steps: EventStep[];
}

export interface SceneSnapshot {
  props: PlacedProp[];
  connections: EventChain[];
  timestamp: number;
}

// ============ 游戏状态 ============

export type ActionType =
  | 'prop:single'
  | 'prop:combo'
  | 'chain:reaction'
  | 'prop:mixed';

export interface RoundRecord {
  funnyScore: number;
  actualGain: number;
  actionType: ActionType;
  decayFactor: number;
  reaction: string;
  reason: string;
}

/**
 * 提交给 submitResult 的数据（来自云函数响应 + snapshot 元数据）
 * actualGain 和 decayFactor 由 store 内部计算，传入值被忽略
 */
export interface RoundResult {
  reaction: string;
  funnyScore: number;
  reason: string;
  props: PlacedProp[];
  chains: EventChain[];
}

export interface BreakdownMeter {
  value: number;
  rounds: RoundRecord[];
  decayMap: Record<string, number>;
}

// 纯数据层：Simulation 状态（不包含 actions）
export interface GameData {
  meter: BreakdownMeter;
  currentLevel: number;
  currentRound: number;
  maxRounds: number;
  mode: 'story' | 'endless';
  phase: 'editing' | 'performing' | 'judging' | 'result';
  unlockedLevels: number;
  bestScores: Record<number, number>;
  endlessHighScore: number;
  endlessBestLevel: number;
}

// Zustand Store 类型 = 纯数据 + actions
export interface GameState extends GameData {
  startRound: () => void;
  submitResult: (result: RoundResult) => void;
  /** 弹幕已显示后，异步更新该回合的裁判评分 */
  updateRoundScore: (roundIndex: number, funnyScore: number, reason: string) => void;
  nextLevel: () => void;
  reset: () => void;
  setMode: (mode: 'story' | 'endless', level?: number) => void;
  loadSave: (data: SaveData) => void;
}

// ============ 存档 ============

export interface SaveData {
  version: number;
  storyProgress: {
    unlockedLevels: number;
    bestScores: Record<number, number>;
  };
  endlessBest: {
    highScore: number;
    bestLevel: number;
  };
  settings: {
    apiKeyHint: string;
  };
  savedAt: number;
}

// ============ API 通讯 ============

export interface PerformRequest {
  sceneDesc: string;
  level: number;
  apiKey: string;
}

export interface PerformResponse {
  reaction: string;
  funnyScore: number;
  reason: string;
  isSilence?: boolean;
}

// ============ 难度配置 ============

export interface DifficultyConfig {
  level: number;
  name: string;
  baselineCoefficient: number;
  targetAvgScore: number;
  maxRounds: number;
}
