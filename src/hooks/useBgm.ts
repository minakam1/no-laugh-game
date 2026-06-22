// ============================================================
// useBgm — 背景音乐 + 音效控制 Hook
// 封装播放/暂停/音量控制，自动管理 AudioContext 生命周期
// ============================================================

import { useEffect, useCallback, useRef, useState } from 'react';
import { getAudioManager, type SfxEvent } from '@/audio/AudioManager';
import { getSoundManager } from '@/audio/SoundManager';

export function useBgm(autoPlay = true) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(0.5);
  const [sfxVolume, setSfxVolumeState] = useState(0.6);
  const audioRef = useRef(getAudioManager());
  const soundRef = useRef(getSoundManager());
  const initializedRef = useRef(false);

  // 初始化 AudioContext
  const ensureInit = useCallback(async () => {
    if (initializedRef.current) return;
    await audioRef.current.init();
    await soundRef.current.init();
    // 预加载处决枪声音效
    try {
      await audioRef.current.loadAudioFile('/gun1.wav');
      await audioRef.current.loadAudioFile('/gun2.mp3');
    } catch (e) {
      console.warn('枪声音效预加载失败:', e);
    }
    initializedRef.current = true;
  }, []);

  // BGM 播放（同时确保 AudioContext 恢复运行）
  const play = useCallback(async () => {
    try {
      await ensureInit();
      // 用户交互后必须恢复 AudioContext（浏览器自动播放策略）
      const mgr = audioRef.current;
      await mgr.bgmStart();
      setIsPlaying(true);
    } catch (e) {
      console.warn('BGM play failed:', e);
    }
  }, [ensureInit]);

  // BGM 暂停
  const pause = useCallback(() => {
    audioRef.current.bgmStop();
    setIsPlaying(false);
  }, []);

  // BGM 切换
  const toggle = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  // BGM 音量
  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    audioRef.current.setBgmVolume(v);
  }, []);

  // 音效音量
  const setSfxVolume = useCallback((v: number) => {
    setSfxVolumeState(v);
    audioRef.current.setSfxVolume(v);
  }, []);

  // 播放一次性音效
  const playSfx = useCallback((event: SfxEvent) => {
    soundRef.current.play(event);
  }, []);

  // 首次用户交互后自动播放（仅触发一次，不受 isPlaying 变化影响）
  useEffect(() => {
    if (!autoPlay) return;

    const handleInteraction = () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
      // 无论 BGM 是否已标记为播放，都调用 play() 以恢复被浏览器挂起的 AudioContext
      play();
    };

    document.addEventListener('click', handleInteraction);
    document.addEventListener('keydown', handleInteraction);

    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
    };
    // 注意：只在 autoPlay 变化时重新注册，不依赖 isPlaying
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay]);

  // 组件卸载时停止
  useEffect(() => {
    const audioManager = audioRef.current;
    return () => {
      audioManager.destroy();
    };
  }, []);

  return {
    isPlaying,
    volume,
    sfxVolume,
    play,
    pause,
    toggle,
    setVolume,
    setSfxVolume,
    playSfx,
    soundManager: soundRef.current,
    audioManager: audioRef.current,
  };
}
