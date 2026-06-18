// ============================================================
// DanmakuStream — 弹幕滚动区（赛博朋克直播聊天面板风格）
// AI 回复弹幕使用 Super Chat 高亮样式，不被刷掉
// ============================================================

import { useEffect, useRef, useState, useCallback } from 'react';
import { getSoundManager } from '@/audio/SoundManager';
import type { BossOpeningLine } from '@/data/bossOpeningLines';

export interface DanmakuItem {
  text: string;
  score: number;
  round: number;
  /** 是否为预设背景弹幕 */
  isPreset?: boolean;
  /** 弹幕列表中的索引（用于移除） */
  _index?: number;
  /** 头肯奖励（Super Chat 收入） */
  pointsReward?: number;
  /** Boss 开场白专属数据 */
  bossOpening?: BossOpeningLine;
  /** 发送者用户名（用户弹幕固定 'Player'） */
  senderName?: string;
  /** 是否为攻击性弹幕（删掉可触发成就） */
  isOffensive?: boolean;
}

interface DanmakuStreamProps {
  list: DanmakuItem[];
  onRemove?: (index: number) => void;
  /** 用户发送快捷弹幕回调 */
  onSendQuick?: (text: string) => void;
}

/** 快捷弹幕模板 */
const QUICK_DANMAKU = [
  '😂 笑死我了',
  '🔥 绷不住了',
  '666666',
  '🤔 就这？',
  '💀 太抽象了',
  '👏 好活当赏',
  '🫡 致敬传奇',
  '🤣 哈哈哈哈',
];

// 生成随机观众名
const viewerNames = [
  'CyberGhost', 'NeonDrifter', 'GlitchHunter', 'DataRunner',
  'PixelPunk', 'VoidWalker', 'NetRunner_77', 'ChromeHeart',
  'SynthWave', 'ByteBandit', 'QuantumLeap', 'NeonNinja',
  'CodeBreaker', 'DigitalSoul', 'MatrixMage', 'FluxCapacitor',
  'SteinsGater_048', 'ChiralWalker_21', 'NERV_Operator_01',
  'SpaceCowboy_Bebop', 'LaughingMan_001', 'Vash_Stampede_$60B',
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

const getSuperChatAmount = (item: DanmakuItem): number => {
  let hash = item.round;
  for (let i = 0; i < item.text.length; i++) {
    hash = (hash * 31 + item.text.charCodeAt(i)) | 0;
  }
  return 30 + Math.abs(hash % 970);
};

/** 为弹幕项生成稳定的唯一 key */
function getDanmakuKey(item: DanmakuItem): string {
  // 使用 round + 文本哈希作为稳定标识，避免纯索引在删除后错位
  let hash = item.round;
  for (let i = 0; i < (item.text || '').length; i++) {
    hash = (hash * 31 + (item.text || '').charCodeAt(i)) | 0;
  }
  return `${item.round}-${Math.abs(hash)}-${item.isPreset ? 'p' : 'a'}`;
}

export function DanmakuStream({ list, onRemove, onSendQuick }: DanmakuStreamProps) {
  const sound = getSoundManager();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [list.length]);

  const [quickOpen, setQuickOpen] = useState(false);
  const [customText, setCustomText] = useState('');

  const handleDoubleClick = useCallback(
    (index: number) => {
      onRemove?.(index);
    },
    [onRemove],
  );

  const handleSend = useCallback((text: string) => {
    if (!text.trim()) return;
    sound.play('ui_button_press');
    onSendQuick?.(text.trim());
    setCustomText('');
    setQuickOpen(false);
  }, [onSendQuick, sound]);

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
    <div className="flex flex-col h-full bg-game-surface/50 relative overflow-hidden">
      <div className="panel-pattern" aria-hidden="true" />
      {/* 聊天面板头部 */}
      <div className="px-3 py-2 border-b border-game-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
          <span className="font-cyber text-[10px] text-accent tracking-wider">LIVE CHAT</span>
          <span className="status-icon hidden xl:inline-flex text-accent-tertiary" aria-hidden="true">MSG</span>
        </div>
        <span className="font-data text-[10px] text-game-text-dim">
          {list.length} MESSAGES
        </span>
      </div>

      {/* 聊天消息区 */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-2">
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
            // 用户自己发的弹幕：突出显示，固定 Player 名
            const isPlayer = item.senderName === 'Player';
            return (
              <div
                key={getDanmakuKey(item)}
                className={`transition-opacity py-1 cursor-pointer ${
                  isPlayer
                    ? 'opacity-90 bg-accent/5 border-l-2 border-accent/40 pl-2 rounded-r'
                    : 'opacity-30 hover:opacity-60'
                }`}
                onDoubleClick={() => handleDoubleClick(i)}
                title="双击移除"
              >
                <p className={`text-xs leading-relaxed break-words font-data ${
                  isPlayer ? 'text-accent' : 'text-game-text-dim/60'
                }`}>
                  <span className={isPlayer ? 'text-accent font-bold mr-1' : 'text-game-text-dim/40 mr-1'}>
                    {isPlayer ? 'Player' : viewerName}:
                  </span>
                  {item.text || '(观众沉默)'}
                </p>
              </div>
            );
          }

          // Boss 开场白：精简卡片，质检员用户名固定
          if (item.bossOpening) {
            const bo = item.bossOpening;
            return (
              <div
                key={getDanmakuKey(item)}
                className="animate-danmaku-scroll group cursor-pointer"
                onDoubleClick={() => handleDoubleClick(i)}
                title="双击移除"
              >
                <div className="relative rounded-md overflow-hidden animate-super-chat-enter animate-boss-glow">
                  <div className="absolute inset-0 bg-gradient-to-r from-rose-600/15 via-purple-500/10 to-rose-600/15 rounded-md" />
                  <div className="absolute inset-0 rounded-md border border-rose-500/35" />

                  <div className="relative px-3 py-2.5">
                    {/* 顶栏 */}
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-rose-600/20 border border-rose-500/30 rounded-sm">
                          <span className="text-[9px]">👑</span>
                          <span className="font-cyber text-[8px] text-rose-300 tracking-widest">SUPER CHAT</span>
                        </span>
                        <span className="font-data text-[9px] text-rose-400/70 tracking-wider">
                          ¥{bo.amount.toLocaleString()}
                        </span>
                      </div>
                      <span className="font-cyber text-[8px] text-purple-300/50 tracking-wider">📌 PINNED</span>
                    </div>

                    {/* 用户名行 */}
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-6 h-6 bg-gradient-to-br from-rose-700 to-purple-800 rounded-sm flex items-center justify-center shrink-0">
                        <span className="font-cyber text-[10px] text-rose-100 font-bold">
                          {bo.judgeName.charAt(0)}
                        </span>
                      </div>
                      <span className="font-data text-[12px] text-rose-200 font-bold">
                        {bo.judgeName}
                      </span>
                    </div>

                    {/* 正文 */}
                    <p className="text-[14px] text-rose-100 leading-relaxed break-words font-data font-medium">
                      {item.text}
                    </p>
                  </div>
                </div>
                <div className="mt-2" />
              </div>
            );
          }

          // AI 回复弹幕：Super Chat 高亮样式，不褪色不被刷
          return (
            <div
              key={getDanmakuKey(item)}
              className="animate-danmaku-scroll group cursor-pointer"
              onDoubleClick={() => handleDoubleClick(i)}
              title="双击移除"
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
                        ¥{getSuperChatAmount(item).toLocaleString()}
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

                      {/* 底栏：分数 + 评价 + 头肯奖励 */}
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex items-center gap-1">
                          <span className={`font-data text-[11px] font-bold ${getScoreColor(item.score)}`}>
                            ★ {item.score}
                          </span>
                          <span className="font-cyber text-[8px] text-game-text-dim/40 tracking-wider">
                            {getScoreLabel(item.score)}
                          </span>
                        </div>
                        {/* 头肯奖励标签 */}
                        {item.pointsReward !== undefined && item.pointsReward > 0 && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-yellow-500/15 border border-yellow-500/25 rounded-sm">
                            <span className="text-[9px]">💰</span>
                            <span className="font-data text-[9px] text-yellow-400 font-bold">+{item.pointsReward}</span>
                          </span>
                        )}
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
      </div>

      {/* 弹幕发送栏 */}
      <div className="px-2 py-2 border-t border-game-border shrink-0 relative">
        <div className="flex items-center gap-1.5">
          {/* 快捷弹幕按钮 */}
          <button
            onClick={() => { sound.play('ui_button_press'); setQuickOpen(!quickOpen); }}
            onMouseEnter={() => sound.play('ui_button_hover')}
            className={`w-7 h-7 flex items-center justify-center border rounded-sm shrink-0 transition-colors font-cyber text-[9px] tracking-wider
                       ${quickOpen ? 'bg-accent/15 border-accent/50 text-accent' : 'bg-accent/5 border-accent/20 text-accent/60 hover:border-accent/40'}`}
          >
            QCK
          </button>

          {/* 输入框 */}
          <input
            type="text"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSend(customText); }}
            placeholder="发送弹幕..."
            maxLength={50}
            className="flex-1 h-7 px-2 bg-game-bg border border-game-border text-game-text font-data text-[11px]
                       placeholder:text-game-text-dim/30 focus:outline-none focus:border-accent/50 rounded-sm"
          />

          {/* 发送按钮 */}
          <button
            onClick={() => handleSend(customText)}
            disabled={!customText.trim()}
            className="px-3 h-7 bg-accent/10 border border-accent/30 text-accent font-cyber text-[10px]
                       hover:bg-accent/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded-sm shrink-0"
          >
            SEND
          </button>
        </div>

        {/* 快捷弹幕弹出菜单 */}
        {quickOpen && (
          <div className="absolute bottom-full left-2 right-2 mb-1 bg-game-surface border border-game-border rounded-sm shadow-lg z-10 p-2 animate-fade-in">
            <div className="grid grid-cols-2 gap-1">
              {QUICK_DANMAKU.map((msg) => (
                <button
                  key={msg}
                  onClick={() => handleSend(msg)}
                  onMouseEnter={() => sound.play('ui_button_hover')}
                  className="text-left px-2 py-1.5 bg-game-bg border border-game-border hover:border-accent/40
                             hover:bg-accent/5 text-game-text-dim hover:text-accent font-data text-[10px]
                             transition-all rounded-sm truncate"
                >
                  {msg}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
