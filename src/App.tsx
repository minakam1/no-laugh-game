// ============================================================
// App — 根组件（游戏入口 + 状态机）
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { useGameStore, loadFromStorageAsync, saveToStorage } from '@/store/gameStore';
import { ApiKeyInput, type ApiConfig } from '@/components/ApiKeyInput';
import { ModeSelector } from '@/components/ModeSelector';
import { LiveStage } from '@/components/LiveStage';
import { Shop } from '@/components/Shop';
import { MonitorFrame } from '@/components/MonitorFrame';
import { TutorialOverlay } from '@/components/tutorial';
import { PrologueDialog } from '@/components/PrologueDialog';
import { DevTools } from '@/components/DevTools';
import { AchievementPopup } from '@/components/AchievementPopup';
import { useBgm } from '@/hooks/useBgm';
import { useGameSfx } from '@/hooks/useGameSfx';
import type { SaveData } from '@/types';

type AppPhase = 'loading' | 'prologue' | 'config' | 'menu' | 'playing' | 'shop';

export default function App() {
  const [appPhase, setAppPhase] = useState<AppPhase>('loading');
  const [apiConfig, setApiConfig] = useState<ApiConfig | null>(null);
  const [saveData, setSaveData] = useState<SaveData | null>(null);

  const setMode = useGameStore((s) => s.setMode);
  const loadSave = useGameStore((s) => s.loadSave);
  const startRound = useGameStore((s) => s.startRound);
  const markGameStart = useGameStore((s) => s.markGameStart);
  const phase = useGameStore((s) => s.phase);
  const tutorialStep = useGameStore((s) => s.tutorialStep);
  const setTutorialStep = useGameStore((s) => s.setTutorialStep);

  // 背景音乐 + 音效（自动播放，首次用户交互后启动）
  const {
    isPlaying: bgmPlaying,
    volume: bgmVolume,
    toggle: toggleBgm,
    setVolume: setBgmVolume,
    playSfx,
    audioManager,
  } = useBgm(true);

  // 游戏状态音效自动触发
  useGameSfx();

  // 启动：检查已有配置和存档
  useEffect(() => {
    const savedKey = sessionStorage.getItem('apiKey') || '';
    const savedUrl = localStorage.getItem('apiBaseUrl') || '';
    const savedModel = localStorage.getItem('apiModel') || '';
    const savedSupportsImages = localStorage.getItem('apiSupportsImages') === 'true';

    if (savedUrl && savedModel) {
      // 只要有 URL 和 Model 就可以恢复（Key 可选）
      setApiConfig({
        apiKey: savedKey,
        baseUrl: savedUrl,
        model: savedModel,
        supportsImages: savedSupportsImages,
      });
    }

    loadFromStorageAsync().then((saved) => {
      if (saved) setSaveData(saved);
      const hasConfig = !!(savedUrl && savedModel);
      // 首次游戏 → 先进序章；老玩家 → 直接进配置/菜单
      const prologueSeen = localStorage.getItem('prologueSeen') === 'true';
      setAppPhase(!prologueSeen ? 'prologue' : hasConfig ? 'menu' : 'config');
    });
  }, []);

  // 自动存档：每当 phase 变为 'result' 时触发
  useEffect(() => {
    if (phase === 'result') {
      void saveToStorage();
    }
  }, [phase]);

  // 确认配置
  const handleConfigConfirm = useCallback((config: ApiConfig) => {
    playSfx('ui_click');
    setApiConfig(config);
    setAppPhase('menu');
    // 引导联动：如果在 config 步骤，自动推进到 menu
    if (tutorialStep === 'config') {
      setTutorialStep('menu');
    }
  }, [playSfx, tutorialStep, setTutorialStep]);

  // 开始新游戏
  const handleStart = useCallback(
    (mode: 'story' | 'endless', level?: number, difficulty?: 'normal' | 'hard') => {
      playSfx('game_start');
      void audioManager.transitionToMainBgm();
      setMode(mode, level, difficulty);
      markGameStart();
      startRound();
      setAppPhase('playing');
      // 引导联动：如果在 menu 步骤，自动推进到 game_tour
      if (tutorialStep === 'menu') {
        setTutorialStep('game_tour');
      }
    },
    [setMode, markGameStart, startRound, playSfx, audioManager, tutorialStep, setTutorialStep],
  );

  // 继续游戏
  const handleContinue = useCallback(() => {
    if (saveData) {
      playSfx('game_start');
      void audioManager.transitionToMainBgm();
      loadSave(saveData);
      markGameStart();
      startRound();
      setAppPhase('playing');
    }
  }, [saveData, loadSave, markGameStart, startRound, playSfx, audioManager]);

  // 返回菜单
  const handleBackToMenu = useCallback(() => {
    playSfx('game_back_to_menu');
    void audioManager.transitionToMainBgm();
    setAppPhase('menu');
  }, [playSfx, audioManager]);

  // 去商店
  const handleGoShop = useCallback(() => {
    playSfx('ui_click');
    void audioManager.transitionToMainBgm();
    setAppPhase('shop');
  }, [playSfx, audioManager]);

  // 从商店返回
  const handleBackFromShop = useCallback(() => {
    playSfx('ui_click');
    void audioManager.transitionToMainBgm();
    setAppPhase('menu');
  }, [playSfx, audioManager]);

  // 开场剧情结束 → 进入配置/菜单，触发完整引导
  const handlePrologueComplete = useCallback(() => {
    localStorage.setItem('prologueSeen', 'true');
    const savedUrl = localStorage.getItem('apiBaseUrl') || '';
    const savedModel = localStorage.getItem('apiModel') || '';
    const hasConfig = !!(savedUrl && savedModel);
    setAppPhase(hasConfig ? 'menu' : 'config');
    setTutorialStep('welcome');
  }, [setTutorialStep]);

  // 回到设置（API 配置页）
  const handleBackToConfig = useCallback(() => {
    playSfx('ui_switch');
    setAppPhase('config');
  }, [playSfx]);

  // 引导步骤 → AppPhase 联动
  useEffect(() => {
    if (!tutorialStep) return;
    // config 步骤时确保在 config 页
    if (tutorialStep === 'config' && appPhase !== 'config') {
      setAppPhase('config');
    }
    // menu 步骤时确保在 menu 页
    if (tutorialStep === 'menu' && appPhase !== 'menu') {
      setAppPhase('menu');
    }
  }, [tutorialStep, appPhase]);

  // 引导步骤与游戏 phase 联动（已迁移到 TutorialOverlay 内部处理）
  // config/menu 步骤的自动推进在 handleConfigConfirm / handleStart 中触发

  // 开发者：回放序章
  const handleReplayPrologue = useCallback(() => {
    localStorage.removeItem('prologueSeen');
    setTutorialStep(null);
    setAppPhase('prologue');
  }, [setTutorialStep]);

  // 开发者：回放引导
  const handleReplayTutorial = useCallback(() => {
    setTutorialStep('welcome');
  }, [setTutorialStep]);

  // 开发者：清理游戏记录后刷新入口态
  const handleClearGameRecords = useCallback(() => {
    setSaveData(null);
    setTutorialStep(null);
    setAppPhase(apiConfig ? 'menu' : 'config');
  }, [apiConfig, setTutorialStep]);

  // BGM props 共用
  const bgmProps = {
    bgmPlaying,
    bgmVolume,
    onBgmToggle: toggleBgm,
    onBgmVolumeChange: setBgmVolume,
  };

  // 渲染当前页面内容
  let content: React.ReactNode;

  switch (appPhase) {
    case 'loading':
      content = (
        <MonitorFrame {...bgmProps}>
          <div className="h-full flex items-center justify-center relative overflow-hidden">
            {/* 背景网格 */}
            <div
              className="absolute inset-0 pointer-events-none opacity-[0.03]"
              style={{
                backgroundImage: `
                  linear-gradient(var(--accent) 1px, transparent 1px),
                  linear-gradient(90deg, var(--accent) 1px, transparent 1px)
                `,
                backgroundSize: '60px 60px',
              }}
            />
            <div className="text-center relative z-10">
              <div className="font-cyber text-2xl text-accent tracking-[8px] mb-4 animate-neon-flicker">
                LOADING
              </div>
              <div className="w-48 h-1 bg-game-border mx-auto relative overflow-hidden">
                <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-accent to-accent-secondary animate-[loadingBar_1.5s_ease-in-out_infinite]" 
                  style={{ width: '40%' }}
                />
              </div>
              <p className="font-data text-xs text-game-text-dim mt-3 tracking-wider">
                INITIALIZING NEURAL NETWORK...
              </p>
            </div>
          </div>
        </MonitorFrame>
      );
      break;

    case 'prologue':
      content = <PrologueDialog onComplete={handlePrologueComplete} />;
      break;

    case 'config':
      content = (
        <MonitorFrame {...bgmProps}>
          <ApiKeyInput
            onConfirm={handleConfigConfirm}
            savedConfig={apiConfig ?? undefined}
          />
        </MonitorFrame>
      );
      break;

    case 'menu':
      content = (
        <MonitorFrame {...bgmProps}>
          <ModeSelector
            hasSave={!!saveData}
            saveData={saveData}
            onContinue={handleContinue}
            onStart={handleStart}
            onEditApi={handleBackToConfig}
            onGoShop={handleGoShop}
          />
        </MonitorFrame>
      );
      break;

    case 'playing':
      content = apiConfig ? (
        <MonitorFrame {...bgmProps}>
          <LiveStage
            apiConfig={apiConfig}
            onBackToMenu={handleBackToMenu}
            onBackToConfig={handleBackToConfig}
            onGoShop={handleGoShop}
          />
        </MonitorFrame>
      ) : (
        <MonitorFrame {...bgmProps}>
          <div className="h-full flex items-center justify-center relative">
            <div className="text-center relative z-10">
              <p className="font-cyber text-lg text-danger tracking-wider mb-2">SIGNAL LOST</p>
              <p className="font-data text-sm text-game-text-dim">配置丢失，请刷新页面</p>
            </div>
          </div>
        </MonitorFrame>
      );
      break;

    case 'shop':
      content = (
        <MonitorFrame {...bgmProps}>
          <Shop onBack={handleBackFromShop} />
        </MonitorFrame>
      );
      break;
  }

  return (
    <>
      {content}
      {/* 新手引导覆盖层（仅在引导进行时渲染） */}
      {tutorialStep && <TutorialOverlay />}
      {/* 成就解锁弹窗 */}
      <AchievementPopup />
      {/* 开发者模式按钮 */}
      <DevTools
        onReplayPrologue={handleReplayPrologue}
        onReplayTutorial={handleReplayTutorial}
        onClearGameRecords={handleClearGameRecords}
      />
    </>
  );
}
