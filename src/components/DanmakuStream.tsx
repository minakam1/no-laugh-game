// ============================================================
// DanmakuStream — 弹幕滚动区（赛博朋克直播聊天面板风格）
// AI 回复弹幕使用 Super Chat 高亮样式，不被刷掉
// ============================================================

import { useEffect, useRef } from 'react';

export interface DanmakuItem {
  text: string;
  score: number;
  round: number;
  /** 是否为预设背景弹幕 */
  isPreset?: boolean;
}

interface DanmakuStreamProps {
  list: DanmakuItem[];
}

// 生成随机观众名
const viewerNames = [
  'CyberGhost', 'NeonDrifter', 'GlitchHunter', 'DataRunner',
  'PixelPunk', 'VoidWalker', 'NetRunner_77', 'ChromeHeart',
  'SynthWave', 'ByteBandit', 'QuantumLeap', 'NeonNinja',
  'CodeBreaker', 'DigitalSoul', 'MatrixMage', 'FluxCapacitor',
];

const getViewerName = (round: number) => {
  return viewerNames[round % viewerNames.length];
};

// 随机头像色
const avatarColors = [
  'bg-accent', 'bg-accent-secondary', 'bg-accent-tertiary',
  'bg-success', 'bg-warning', 'bg-danger',
];

const getAvatarColor = (round: number) => {
  return avatarColors[round % avatarColors.length];
};

export function DanmakuStream({ list }: DanmakuStreamProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [list.length]);

  const getScoreColor = (score: number): string => {
    if (score >= 8) return 'text-accent';
    if (score >= 6) return 'text-warning';
    if (score >= 4) return 'text-game-text-dim';
    return 'text-game-text-dim opacity-50';
  };

  const getScoreLabel = (score: number): string => {
    if (score >= 9) return 'LEGENDARY';
    if (score >= 7) return 'EPIC';
    if (score >= 5) return 'RARE';
    if (score >= 3) return 'COMMON';
    return 'WEAK';
  };

  return (
    <div className="flex flex-col h-full bg-game-surface/50">
      {/* 聊天面板头部 */}
      <div className="px-3 py-2 border-b border-game-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
          <span className="font-cyber text-[10px] text-accent tracking-wider">LIVE CHAT</span>
        </div>
        <span className="font-data text-[10px] text-game-text-dim">
          {list.length} MESSAGES
        </span>
      </div>

      {/* 聊天消息区 */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {list.length === 0 && (
          <div className="text-center py-8">
            <p className="font-data text-sm text-game-text-dim">
              [ 聊天室为空 ]
            </p>
            <p className="font-data text-xs text-game-text-dim/50 mt-1">
              开始表演，弹幕马上来！
            </p>
          </div>
        )}
        {list.map((item, i) => {
          const viewerName = getViewerName(item.round + i);
          const avatarColor = getAvatarColor(item.round + i);

          // 预设弹幕：淡化、无头像、无分数
          if (item.isPreset) {
            return (
              <div
                key={i}
                className="opacity-30 hover:opacity-60 transition-opacity py-1"
              >
                <p className="text-xs text-game-text-dim/60 leading-relaxed break-words font-data">
                  <span className="text-game-text-dim/40 mr-1">{viewerName}:</span>
                  {item.text || '(观众沉默)'}
                </p>
              </div>
            );
          }

          // AI 回复弹幕：Super Chat 高亮样式，不褪色不被刷
          return (
            <div
              key={i}
              className="animate-danmaku-scroll group"
            >
              {/* Super Chat 卡片：金色渐变边框 + 发光背景 + 入场动画 */}
              <div className="relative rounded-md overflow-hidden animate-super-chat-enter animate-super-chat-glow">
                {/* 外发光 */}
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/15 via-amber-400/10 to-yellow-500/15 rounded-md" />
                {/* 金色边框 */}
                <div className="absolute inset-0 rounded-md border border-yellow-500/40" />
                {/* 四角装饰 */}
                <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-yellow-400/60 rounded-tl" />
                <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-yellow-400/60 rounded-tr" />
                <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-yellow-400/60 rounded-bl" />
                <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-yellow-400/60 rounded-br" />

                <div className="relative px-3 py-2.5">
                  {/* 顶栏：Super Chat 标签 + 金额装饰 */}
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-yellow-500/20 border border-yellow-500/30 rounded-sm">
                        <span className="text-[8px] text-yellow-300">◆</span>
                        <span className="font-cyber text-[8px] text-yellow-300 tracking-widest">SUPER CHAT</span>
                      </span>
                      <span className="font-data text-[9px] text-yellow-400/70 tracking-wider">
                        ¥{Math.floor(30 + Math.random() * 970).toLocaleString()}
                      </span>
                    </div>
                    <span className="font-data text-[9px] text-game-text-dim/50">
                      #{String(item.round).padStart(3, '0')}
                    </span>
                  </div>

                  {/* 用户信息行 */}
                  <div className="flex items-start gap-2">
                    {/* 头像 — 金色边框 */}
                    <div className="relative shrink-0 mt-0.5">
                      <div className="absolute inset-0 rounded-sm ring-1 ring-yellow-500/50" />
                      <div className={`w-7 h-7 ${avatarColor} rounded-sm flex items-center justify-center`}>
                        <span className="font-cyber text-[9px] text-game-bg font-bold">
                          {viewerName.charAt(0)}
                        </span>
                      </div>
                    </div>

                    {/* 消息内容 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-data text-[12px] text-yellow-300 font-bold truncate">
                          {viewerName}
                        </span>
                        {/* 高分数徽章 */}
                        {item.score >= 7 && (
                          <span className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-yellow-500/20 rounded-sm">
                            <span className="text-[8px]">⚡</span>
                            <span className="font-cyber text-[7px] text-yellow-300 tracking-wider">HOT</span>
                          </span>
                        )}
                      </div>

                      {/* 弹幕正文 — 大字号 + 强调色 */}
                      <p className="text-[15px] text-yellow-100 leading-relaxed break-words font-data font-medium">
                        {item.text || '(观众沉默)'}
                      </p>

                      {/* 底栏：分数 + 评价 */}
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex items-center gap-1">
                          <span className={`font-data text-[11px] font-bold ${getScoreColor(item.score)}`}>
                            ★ {item.score}
                          </span>
                          <span className="font-cyber text-[8px] text-game-text-dim/40 tracking-wider">
                            {getScoreLabel(item.score)}
                          </span>
                        </div>
                        {/* 分隔 */}
                        <div className="flex-1 h-px bg-yellow-500/15" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 间距替代分隔线 */}
              <div className="mt-2" />
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* 输入框装饰（不可输入，纯装饰） */}
      <div className="px-3 py-2 border-t border-game-border shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-accent/20 border border-accent/30 rounded-sm flex items-center justify-center">
            <span className="font-cyber text-[8px] text-accent">YOU</span>
          </div>
          <div className="flex-1 h-7 bg-game-bg border border-game-border flex items-center px-2">
            <span className="font-data text-xs text-game-text-dim/40">
              发送弹幕...
            </span>
          </div>
          <button className="px-3 h-7 bg-accent/10 border border-accent/30 text-accent font-cyber text-[10px] hover:bg-accent/20 transition-colors">
            SEND
          </button>
        </div>
      </div>
    </div>
  );
}
