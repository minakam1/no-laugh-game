// ============================================================
// App — 根组件（游戏入口 + 状态机）
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { useGameStore, loadFromStorageAsync, saveToStorage } from '@/store/gameStore';
import { ApiKeyInput, type ApiConfig } from '@/components/ApiKeyInput';
import { ModeSelector } from '@/components/ModeSelector';
import { LiveStage } from '@/components/LiveStage';
import { MonitorFrame } from '@/components/MonitorFrame';
import type { SaveData } from '@/types';

type AppPhase = 'loading' | 'config' | 'menu' | 'playing';

export default function App() {
  const [appPhase, setAppPhase] = useState<AppPhase>('loading');
  const [apiConfig, setApiConfig] = useState<ApiConfig | null>(null);
  const [saveData, setSaveData] = useState<SaveData | null>(null);

  const setMode = useGameStore((s) => s.setMode);
  const loadSave = useGameStore((s) => s.loadSave);
  const startRound = useGameStore((s) => s.startRound);
  const phase = useGameStore((s) => s.phase);

  // 启动：检查已有配置和存档
  useEffect(() => {
    const legacyKey = localStorage.getItem('apiKey') || '';
    if (legacyKey) {
      sessionStorage.setItem('apiKey', legacyKey);
      localStorage.removeItem('apiKey');
    }
    const savedKey = sessionStorage.getItem('apiKey') || legacyKey;
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
      // 用局部变量判断，避免 setState 异步问题
      const hasConfig = !!(savedUrl && savedModel);
      setAppPhase(hasConfig ? 'menu' : 'config');
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
    setApiConfig(config);
    setAppPhase('menu');
  }, []);

  // 开始新游戏
  const handleStart = useCallback(
    (mode: 'story' | 'endless', level?: number) => {
      setMode(mode, level);
      startRound();
      setAppPhase('playing');
    },
    [setMode, startRound],
  );

  // 继续游戏
  const handleContinue = useCallback(() => {
    if (saveData) {
      loadSave(saveData);
      startRound();
      setAppPhase('playing');
    }
  }, [saveData, loadSave, startRound]);

  // 返回菜单
  const handleBackToMenu = useCallback(() => {
    setAppPhase('menu');
  }, []);

  // 回到设置（API 配置页）
  const handleBackToConfig = useCallback(() => {
    setAppPhase('config');
  }, []);

  switch (appPhase) {
    case 'loading':
      return (
        <MonitorFrame>
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

    case 'config':
      return (
        <MonitorFrame>
          <ApiKeyInput
            onConfirm={handleConfigConfirm}
            savedConfig={apiConfig ?? undefined}
          />
        </MonitorFrame>
      );

    case 'menu':
      return (
        <MonitorFrame>
          <ModeSelector
            hasSave={!!saveData}
            saveData={saveData}
            onContinue={handleContinue}
            onStart={handleStart}
            onEditApi={handleBackToConfig}
          />
        </MonitorFrame>
      );

    case 'playing':
      return apiConfig ? (
        <MonitorFrame>
          <LiveStage
            apiConfig={apiConfig}
            onBackToMenu={handleBackToMenu}
            onBackToConfig={handleBackToConfig}
          />
        </MonitorFrame>
      ) : (
        <MonitorFrame>
          <div className="h-full flex items-center justify-center relative">
            <div className="text-center relative z-10">
              <p className="font-cyber text-lg text-danger tracking-wider mb-2">SIGNAL LOST</p>
              <p className="font-data text-sm text-game-text-dim">配置丢失，请刷新页面</p>
            </div>
          </div>
        </MonitorFrame>
      );
  }
}
