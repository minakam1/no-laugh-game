// ============================================================
// Zustand GameStore（README 5.3 节 + 第十三章类型）
// ============================================================

import { create } from 'zustand';
import type {
  GameState,
  RoundResult,
  RoundRecord,
  SaveData,
  DifficultyConfig,
  ActionType,
} from '@/types';
import { classifyAction } from '@/utils/classifyAction';

// 难度配置表（README 5.3 + 4.7 节）
// targetAvgScore: 裁判打分 0-10 的平均线（用于展示参考）
// passThreshold: 通关需要的绷不住值累计值（10 回合内累计达到即过关，默认 30）
export const DIFFICULTY_CONFIG: Record<number, DifficultyConfig> = {
  1: { level: 1, name: '快乐小狗', baselineCoefficient: 1.0, targetAvgScore: 5, maxRounds: 10 },
  2: { level: 2, name: '好奇大学生', baselineCoefficient: 1.1, targetAvgScore: 6, maxRounds: 10 },
  3: { level: 3, name: '淡定上班族', baselineCoefficient: 1.3, targetAvgScore: 7, maxRounds: 10 },
  4: { level: 4, name: '文艺鉴赏家', baselineCoefficient: 1.6, targetAvgScore: 7.5, maxRounds: 10 },
  5: { level: 5, name: '冷面裁判官', baselineCoefficient: 2.5, targetAvgScore: 8, maxRounds: 10 },
};

/** 通关阈值：绷不住值累计达到 30 分即过关 */
export const PASS_THRESHOLD = 30;

const SAVE_VERSION = 1;
const SAVE_KEY = 'no-laugh-save';
const DB_NAME = 'NoLaughDB';
const DB_STORE = 'saves';

export const useGameStore = create<GameState>((set, get) => ({
  meter: { value: 0, rounds: [], decayMap: {} },
  currentLevel: 1,
  currentRound: 1,
  maxRounds: 10,
  mode: 'story',
  phase: 'editing',
  unlockedLevels: 1,
  bestScores: {},
  endlessHighScore: 0,
  endlessBestLevel: 1,

  startRound: () => {
    set({ phase: 'editing' });
  },

  submitResult: (result: RoundResult) => {
    const state = get();
    const { meter, mode, currentLevel, currentRound, maxRounds } = state;
    const actionType: ActionType = classifyAction(result.props, result.chains);
    const useCount = meter.decayMap[actionType] || 0;
    const decayFactor = Math.max(0.1, 1 - useCount * 0.35);
    const baseGain = (result.funnyScore / 10) * 15;
    const actualGain = baseGain * decayFactor;
    const newValue = Math.min(100, meter.value + actualGain);

    const roundRecord: RoundRecord = {
      funnyScore: result.funnyScore,
      actualGain: Math.round(actualGain * 10) / 10,
      actionType,
      decayFactor,
      reaction: result.reaction,
      reason: result.reason,
    };

    const newRounds = [...meter.rounds, roundRecord];
    const newRound = currentRound + 1;
    const isLevelComplete = mode === 'story' && newRound > maxRounds;

    const updates: Partial<GameState> = {
      meter: {
        value: newValue,
        rounds: newRounds,
        decayMap: { ...meter.decayMap, [actionType]: useCount + 1 },
      },
      currentRound: newRound,
      // 如果有有效分数，直接结束；否则进入 judging 等待异步评分
      phase: isLevelComplete ? 'result' : (result.funnyScore > 0 ? 'editing' : 'judging'),
    };

    // 故事模式通关结算：绷不住值累计 >= PASS_THRESHOLD(30) 即过关
    if (isLevelComplete) {
      const passed = newValue >= PASS_THRESHOLD;

      updates.unlockedLevels = passed
        ? Math.max(state.unlockedLevels, currentLevel + 1)
        : state.unlockedLevels;

      updates.bestScores = {
        ...state.bestScores,
        [currentLevel]: Math.max(
          state.bestScores[currentLevel] || 0,
          Math.round(newValue),
        ),
      };
    }

    // 无尽模式最高分
    if (mode === 'endless') {
      const totalScore = newValue + state.currentRound;
      updates.endlessHighScore = Math.max(state.endlessHighScore, totalScore);
      updates.endlessBestLevel = Math.max(state.endlessBestLevel, currentLevel);
    }

    set(updates);
  },

  updateRoundScore: (roundIndex: number, funnyScore: number, reason: string) => {
    const state = get();
    const rounds = [...state.meter.rounds];
    if (roundIndex < 0 || roundIndex >= rounds.length) return;

    const oldRecord = rounds[roundIndex];
    const actionType = oldRecord.actionType;
    const decayFactor = oldRecord.decayFactor;
    const baseGain = (funnyScore / 10) * 15;
    const actualGain = baseGain * decayFactor;

    // 重新计算 meter.value：减去旧的 actualGain，加上新的
    const newValue = Math.min(100,
      Math.max(0, state.meter.value - oldRecord.actualGain + actualGain)
    );

    rounds[roundIndex] = {
      ...oldRecord,
      funnyScore,
      actualGain: Math.round(actualGain * 10) / 10,
      reason,
    };

    // 判断是否是最后一回合（故事模式 currentRound > maxRounds 意味着回合已全部提交）
    const isLastRound = state.mode === 'story' && state.currentRound > state.maxRounds;

    const updates: Partial<GameState> = {
      meter: {
        ...state.meter,
        value: newValue,
        rounds,
      },
      phase: isLastRound ? 'result' : 'editing',
    };

    // 故事模式通关结算（裁判打分回来时才执行，确保分数准确）
    if (isLastRound) {
      const passed = newValue >= PASS_THRESHOLD;
      updates.unlockedLevels = passed
        ? Math.max(state.unlockedLevels, state.currentLevel + 1)
        : state.unlockedLevels;
      updates.bestScores = {
        ...state.bestScores,
        [state.currentLevel]: Math.max(
          state.bestScores[state.currentLevel] || 0,
          Math.round(newValue),
        ),
      };
    }

    set(updates);
  },

  nextLevel: () => {
    set((s) => ({
      currentLevel:
        s.mode === 'story'
          ? Math.min(s.currentLevel + 1, s.unlockedLevels)
          : Math.min(s.currentLevel + 1, 99),
      currentRound: 1,
      meter: { value: 0, rounds: [], decayMap: {} },
      phase: 'editing',
    }));
  },

  reset: () => {
    set({
      meter: { value: 0, rounds: [], decayMap: {} },
      currentRound: 1,
      phase: 'editing',
    });
  },

  setMode: (mode, level) => {
    const lvl = Math.min(level ?? get().currentLevel, 5);
    set({
      mode,
      currentLevel: lvl,
      currentRound: 1,
      maxRounds: mode === 'story' ? 10 : Infinity,
      meter: { value: 0, rounds: [], decayMap: {} },
      phase: 'editing',
    });
  },

  loadSave: (data: SaveData) => {
    set({
      unlockedLevels: data.storyProgress.unlockedLevels,
      bestScores: data.storyProgress.bestScores,
      endlessHighScore: data.endlessBest.highScore,
      endlessBestLevel: data.endlessBest.bestLevel,
    });
  },
}));

// ============ 存档序列化（README 3.4 节）============

export function serializeSave(): SaveData {
  const state = useGameStore.getState();
  return {
    version: SAVE_VERSION,
    storyProgress: {
      unlockedLevels: state.unlockedLevels,
      bestScores: state.bestScores,
    },
    endlessBest: {
      highScore: state.endlessHighScore,
      bestLevel: state.endlessBestLevel,
    },
    settings: {
      apiKeyHint: sessionStorage.getItem('apiKey')?.slice(-4) || '',
    },
    savedAt: Date.now(),
  };
}

// IndexedDB Promise 包装
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(DB_STORE)) {
        req.result.createObjectStore(DB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function writeIndexedDB(data: SaveData): Promise<void> {
  return openDB().then((db) => {
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).put(data, 'current');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  });
}

function readIndexedDB(): Promise<SaveData | null> {
  return openDB().then((db) => {
    return new Promise<SaveData | null>((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readonly');
      const req = tx.objectStore(DB_STORE).get('current');
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  });
}

export function saveToStorage(): boolean {
  const data = serializeSave();
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    console.warn('localStorage full, falling back to IndexedDB');
    return writeIndexedDB(data)
      .then(() => true)
      .catch(() => false) as unknown as boolean;
  }
}

export function loadFromStorage(): SaveData | null {
  // 优先 localStorage
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const data = JSON.parse(raw) as SaveData;
      if (data.version === SAVE_VERSION) return data;
    }
  } catch {
    // ignore
  }

  // 降级 IndexedDB（同步返回 null，异步可读）
  return null;
}

// 异步加载（支持 IndexedDB 回退）
export function loadFromStorageAsync(): Promise<SaveData | null> {
  // 先尝试 localStorage
  const local = loadFromStorage();
  if (local) return Promise.resolve(local);

  // 再尝试 IndexedDB
  return readIndexedDB()
    .then((data) => {
      if (data && data.version === SAVE_VERSION) return data;
      return null;
    })
    .catch(() => null);
}
