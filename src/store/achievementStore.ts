// ============================================================
// achievementStore — 成就追踪 + 条件检测
// ============================================================

import { create } from 'zustand';
import { eventBus } from '@/phaser/bridges/PhaserEventBus';
import { type AchievementId } from '@/data/achievements';
import type { RoundRecord, SceneType } from '@/types';
import type { PropKey } from '@/phaser/assets/manifest';

interface AchievementState {
  /** 已解锁成就集合 */
  unlocked: Set<AchievementId>;
  /** 跨回合追踪数据 */
  track: {
    usedPropTypes: Set<PropKey>;
    totalKentouEarned: number;
    totalAiDanmaku: number;
    consecutiveZeros: number;
    prevScore: number;
    roundSpent: number;  // 当前回合花费
    bananaOnlyLevel: boolean;
    explosiveOnlyLevel: boolean;
    levelTotalRounds: number;
    usedScenes: Set<SceneType>;
    /** 各关卡首次通关记录 (1-5) */
    bossCleared: Set<number>;
    /** 各关卡首次失败记录 (1-5) */
    bossFailed: Set<number>;
    /** 各关卡困难模式首次通关 (1-5) */
    hardBossCleared: Set<number>;
    /** 各关卡困难模式首次失败 (1-5) */
    hardBossFailed: Set<number>;
    /** 困难模式是否已通关过（任意关卡首次） */
    hardCleared: boolean;
    /** 困难模式是否已失败过（任意关卡首次） */
    hardFailed: boolean;
    /** 是否已进入过困难模式 */
    hardModeEntered: boolean;
    /** 是否已达成影流之主 */
    shadowDone: boolean;
  };
}

interface AchievementActions {
  unlock: (id: AchievementId) => void;
  /** 回合提交后检测成就 */
  checkOnSubmit: (record: RoundRecord, usedProps: PropKey[], chainsCount: number) => void;
  /** 通关结算时检测成就 */
  checkOnClear: (level: number, totalRounds: number, sceneType: SceneType, passed: boolean, difficulty: 'normal' | 'hard') => void;
  /** 追踪头肯积累 */
  trackKentou: (amount: number) => void;
  /** 追踪弹幕数 */
  trackDanmaku: () => void;
  /** 追踪单回合花费 */
  trackSpend: (amount: number) => void;
  /** 商店全买 */
  markCollector: () => void;
  /** 加载存档中的成就 */
  loadFromSave: (ids: AchievementId[]) => void;
  /** 导出可存档的成就列表 */
  getSaveData: () => AchievementId[];
  /** 开发者：重置成就与跨回合追踪 */
  resetAchievements: () => void;
}

function createInitialTrack(): AchievementState['track'] {
  return {
    usedPropTypes: new Set(),
    totalKentouEarned: 0,
    totalAiDanmaku: 0,
    consecutiveZeros: 0,
    prevScore: -1,
    roundSpent: 0,
    bananaOnlyLevel: true,
    explosiveOnlyLevel: true,
    levelTotalRounds: 0,
    usedScenes: new Set(),
    bossCleared: new Set(),
    bossFailed: new Set(),
    hardBossCleared: new Set(),
    hardBossFailed: new Set(),
    hardCleared: false,
    hardFailed: false,
    hardModeEntered: false,
    shadowDone: false,
  };
}

export const useAchievementStore = create<AchievementState & AchievementActions>((set, get) => ({
  unlocked: new Set(),
  track: createInitialTrack(),

  unlock: (id) => {
    const { unlocked } = get();
    if (unlocked.has(id)) return;
    const next = new Set(unlocked);
    next.add(id);
    set({ unlocked: next });
    eventBus.emit('achievement-unlocked', { id });
  },

  checkOnSubmit: (record, usedProps, chainsCount) => {
    const s = get();
    const { unlock, track } = s;

    // 更新追踪
    const newUsed = new Set(track.usedPropTypes);
    usedProps.forEach((p) => newUsed.add(p));
    const explosiveTypes: PropKey[] = ['bomb', 'barrel'];
    const isExplosive = usedProps.every((p) => explosiveTypes.includes(p));
    const newDanmaku = track.totalAiDanmaku + 1;
    const newConsecutiveZeros = record.actualGain <= 0 ? track.consecutiveZeros + 1 : 0;

    set({
      track: {
        ...track,
        usedPropTypes: newUsed,
        totalAiDanmaku: newDanmaku,
        consecutiveZeros: newConsecutiveZeros,
        prevScore: record.funnyScore,
        roundSpent: 0,
        bananaOnlyLevel: track.bananaOnlyLevel && (usedProps.length > 0 && usedProps.every((p) => p === 'banana')),
        explosiveOnlyLevel: track.explosiveOnlyLevel && (usedProps.length > 0 && isExplosive),
        levelTotalRounds: track.levelTotalRounds + 1,
      },
    });

    // --- 条件检测 ---
    unlock('first_blood');
    if (record.funnyScore >= 5) unlock('first_laugh');
    if (record.funnyScore === 10) unlock('perfect_10');
    if (newUsed.size >= 10) unlock('prop_master');
    if (chainsCount >= 3) unlock('chain_3');
    if (usedProps.length === 1 && usedProps[0] === 'clumsyNpc') unlock('npc_solo');
    if (track.roundSpent >= 20) unlock('big_spender');
    if (newDanmaku >= 20) unlock('danmaku_king');
    if (record.actualGain <= 0) unlock('silent_all');
    if (newConsecutiveZeros >= 3) unlock('triple_0');
    if (track.prevScore === 0 && record.funnyScore >= 8) unlock('comeback');

    // 影流之主：3+ 相同道具
    if (!track.shadowDone) {
      const counts = new Map<string, number>();
      for (const p of usedProps) counts.set(p, (counts.get(p) ?? 0) + 1);
      if ([...counts.values()].some((c) => c >= 3)) {
        set({ track: { ...track, shadowDone: true } });
        unlock('shadow_stream');
      }
    }
  },

  checkOnClear: (_level, totalRounds, sceneType, passed, difficulty) => {
    const s = get();
    const { unlock, track } = s;

    unlock('first_laugh');

    if (totalRounds <= 3) unlock('speedrun_god');
    if (track.bananaOnlyLevel) unlock('banana_only');
    if (track.explosiveOnlyLevel) unlock('all_explosive');
    if (!track.usedPropTypes.has('banana')) unlock('no_banana');

    const newScenes = new Set(track.usedScenes);
    newScenes.add(sceneType);
    set({ track: { ...track, usedScenes: newScenes } });

    if (sceneType === 'cliff') unlock('cliff_hanger');
    if (sceneType === 'rapids') unlock('rapids_survivor');
    if (sceneType === 'windstorm') unlock('wind_rider');
    if (sceneType === 'darkness') unlock('dark_clear');

    // === BOSS 挑战成就检测 ===
    const level = _level;
    const bossClearIds: Record<number, AchievementId> = {
      1: 'boss1_clear', 2: 'boss2_clear', 3: 'boss3_clear', 4: 'boss4_clear', 5: 'boss5_clear',
    };
    const bossFailIds: Record<number, AchievementId> = {
      1: 'boss1_fail', 2: 'boss2_fail', 3: 'boss3_fail', 4: 'boss4_fail', 5: 'boss5_fail',
    };

    if (difficulty === 'normal') {
      if (passed && !track.bossCleared.has(level)) {
        const newCleared = new Set(track.bossCleared);
        newCleared.add(level);
        set({ track: { ...track, bossCleared: newCleared } });
        unlock(bossClearIds[level]);
        // 检测全通关
        if (newCleared.size >= 5) unlock('story_all_clear');
      }
      if (!passed && !track.bossFailed.has(level)) {
        const newFailed = new Set(track.bossFailed);
        newFailed.add(level);
        set({ track: { ...track, bossFailed: newFailed } });
        unlock(bossFailIds[level]);
      }
    }

    // 困难模式
    if (difficulty === 'hard') {
      // 全局首次困难通关/失败
      if (passed && !track.hardCleared) {
        set({ track: { ...track, hardCleared: true } });
        unlock('hard_clear');
      }
      if (!passed && !track.hardFailed) {
        set({ track: { ...track, hardFailed: true } });
        unlock('hard_fail');
      }

      // 困难模式各Boss首次通关/失败
      const hardClearIds: Record<number, AchievementId> = {
        1: 'hard_boss1_clear', 2: 'hard_boss2_clear', 3: 'hard_boss3_clear', 4: 'hard_boss4_clear', 5: 'hard_boss5_clear',
      };
      const hardFailIds: Record<number, AchievementId> = {
        1: 'hard_boss1_fail', 2: 'hard_boss2_fail', 3: 'hard_boss3_fail', 4: 'hard_boss4_fail', 5: 'hard_boss5_fail',
      };

      if (passed && !track.hardBossCleared.has(level)) {
        const newCleared = new Set(track.hardBossCleared);
        newCleared.add(level);
        set({ track: { ...track, hardBossCleared: newCleared } });
        unlock(hardClearIds[level]);
        // 困难模式全通关检测
        if (newCleared.size >= 5) unlock('hard_all_clear');
      }
      if (!passed && !track.hardBossFailed.has(level)) {
        const newFailed = new Set(track.hardBossFailed);
        newFailed.add(level);
        set({ track: { ...track, hardBossFailed: newFailed } });
        unlock(hardFailIds[level]);
      }
    }
  },

  trackKentou: (amount) => {
    const t = get().track;
    const total = t.totalKentouEarned + amount;
    set({ track: { ...t, totalKentouEarned: total } });
    if (total >= 1000) get().unlock('kentou_million');
  },

  trackDanmaku: () => {
    const t = get().track;
    const count = t.totalAiDanmaku + 1;
    set({ track: { ...t, totalAiDanmaku: count } });
    if (count >= 20) get().unlock('danmaku_king');
  },

  trackSpend: (amount) => {
    const t = get().track;
    set({ track: { ...t, roundSpent: t.roundSpent + amount } });
  },

  markCollector: () => get().unlock('collector'),

  loadFromSave: (ids) => set({ unlocked: new Set(ids) }),

  getSaveData: () => Array.from(get().unlocked),

  resetAchievements: () => set({ unlocked: new Set(), track: createInitialTrack() }),
}));
