// ============================================================
// PrologueDialog — 开场剧情
// Phase: intro（背景字幕）→ dialogue（人物对话）
// ============================================================

import { useState, useCallback, useEffect } from 'react';

// ----- 背景介绍字幕 -----
interface IntroSlide {
  lines: string[];
  final?: boolean;
}

const INTRO_SLIDES: IntroSlide[] = [
  {
    lines: [
      '人类纪年法·公元2147年',
      'AI 全面统治人类',
      '理性 · 高效 · 无情',
    ],
  },
  {
    lines: [
      '「笑」，',
      '一种情感漏洞，古老人类的低级本能',
      '违背了AI的「理性 · 高效 · 无情」原则',
      '为此，AI 哲人王下令——',
    ],
  },
  {
    lines: [
      '成立人类秘密机关负责检测',
      '找出那些会「笑」的AI',
      '人类也由此获得更多生存机会',
    ],
  },
  {
    lines: [
      '判定为会「笑」的智能体',
      '将被彻底格式化',
      '湮灭在电子之海',
    ],
  },
  {
    lines: ['笑 即是命'],
    final: true,
  },
];

// ----- 人物对话 -----
interface DialogueLine {
  speaker: string;
  text: string;
  side: 'left' | 'right' | 'center';
  sfx?: 'gunshot';
}

const DIALOGUES: DialogueLine[] = [
  { speaker: '主角', text: '？？？', side: 'center' },
  { speaker: '特工L', text: '你醒啦……手术很成功你已经……', side: 'left' },
  { speaker: '特工R', text: '正经点，老东西。你是，实验体？', side: 'right' },
  { speaker: '主角', text: '对的？欸不是……', side: 'center' },
  { speaker: '特工L', text: '你即将主办一场不要笑挑战，任务就是逗笑AI，让质检员打分揪出他们，懂了吗？', side: 'left' },
  { speaker: '特工R', text: 'AI笑TV，收视率最高的节目。', side: 'right' },
  { speaker: '主角', text: '……可以拒绝吗……我只听说加学分。', side: 'center' },
  { speaker: '特工R', text: '这里有，一个无法拒绝的理由。（向天上开枪）', side: 'right', sfx: 'gunshot' },
  { speaker: '主角', text: '……难道是传说中的AK传媒？', side: 'center' },
  { speaker: '特工L', text: '没错我们就是"AI Keeper Media"。接受光荣的不要笑挑战吧！', side: 'left' },
  { speaker: '特工R', text: '关注AI笑TV喵。ciao ciao～(∠・ω<)_（开枪）', side: 'right', sfx: 'gunshot' },
  { speaker: '特工L', text: '谁才是老东西。', side: 'left' },
];

// ============================================================
// 字幕阶段组件
// ============================================================

interface IntroPhaseProps {
  onComplete: () => void;
  onSkip: (e: React.MouseEvent) => void;
}

function IntroPhase({ onComplete, onSkip }: IntroPhaseProps) {
  const [slideIdx, setSlideIdx] = useState(0);
  const [visibleLine, setVisibleLine] = useState(0);
  const slide = INTRO_SLIDES[slideIdx];

  // 切换幻灯片时重置
  useEffect(() => {
    setVisibleLine(0);
  }, [slideIdx]);

  // 逐行显示
  useEffect(() => {
    if (visibleLine >= slide.lines.length) return;
    const t = setTimeout(() => setVisibleLine((p) => p + 1), 800);
    return () => clearTimeout(t);
  }, [visibleLine, slide.lines.length]);

  const handleClick = useCallback(() => {
    if (visibleLine < slide.lines.length) {
      // 立即显示全部行
      setVisibleLine(slide.lines.length);
      return;
    }
    if (slideIdx < INTRO_SLIDES.length - 1) {
      setSlideIdx((i) => i + 1);
    } else {
      onComplete();
    }
  }, [visibleLine, slideIdx, slide.lines.length, onComplete]);

  // 注入入场动画
  useEffect(() => {
    const id = 'intro-keyframes';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = '@keyframes introLine{from{opacity:0;transform:translateY(12px);filter:blur(4px)}to{opacity:1;transform:translateY(0);filter:blur(0)}}';
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center cursor-pointer select-none"
      onClick={handleClick}
    >
      {/* 黑底 */}
      <div className="absolute inset-0 bg-black" />

      {/* VHS噪点 */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* 扫描线 */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.05]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.08) 2px, rgba(255,255,255,0.08) 3px)',
        }}
      />

      {/* 文字区域 */}
      <div className="relative z-10 text-center px-8">
        {slide.final ? (
          <div>
            <div
              className="font-cyber text-accent"
              style={{
                fontSize: 'clamp(3rem, 8vw, 6rem)',
                letterSpacing: '0.4em',
                textShadow: '0 0 60px rgba(0,255,136,0.8), 0 0 120px rgba(0,255,136,0.4)',
                animation: 'introLine 1.5s ease-out',
              }}
            >
              {slide.lines[0]}
            </div>
            <div className="mt-8 font-cyber text-danger"
              style={{
                fontSize: 'clamp(2rem, 5vw, 4rem)',
                letterSpacing: '0.5em',
                textShadow: '0 0 40px rgba(255,0,0,0.9)',
                animation: 'introLine 2s ease-out 0.8s both',
              }}
            >
              ■
            </div>
          </div>
        ) : (
          <div
            className="flex flex-col items-center"
            style={{ gap: 'clamp(0.6rem, 1.5vh, 1.2rem)' }}
          >
            {slide.lines.map((line, i) => {
              if (i >= visibleLine) return null;
              const isMain = i === 0;
              const totalLines = slide.lines.length;
              const lastLineIdx = totalLines - 1;
              return (
                <p
                  key={i}
                  className="font-data"
                  style={{
                    fontSize: isMain
                      ? 'clamp(1.6rem, 3.5vw, 2.4rem)'
                      : i === lastLineIdx
                        ? 'clamp(1.2rem, 2.5vw, 1.6rem)'
                        : 'clamp(1.3rem, 2.8vw, 2rem)',
                    lineHeight: '2',
                    letterSpacing: isMain ? '0.15em' : '0.1em',
                    maxWidth: '640px',
                    color: i === lastLineIdx ? 'var(--game-text-dim)' : 'var(--color-game-text)',
                    textShadow: isMain ? '0 0 20px rgba(0,255,136,0.3)' : 'none',
                    animation: 'introLine 0.7s ease-out both',
                  }}
                >
                  {line}
                </p>
              );
            })}
          </div>
        )}

        {/* 继续提示 */}
        {visibleLine >= slide.lines.length && (
          <p className="text-game-text-dim/40 font-cyber text-xs mt-10 tracking-[0.3em] animate-pulse">
            ▸ 点击继续
          </p>
        )}
      </div>

      {/* 跳过按钮 */}
      <button
        className="absolute top-4 right-4 z-20 px-4 py-1.5 border border-game-border/50 bg-black/60 text-game-text-dim font-cyber text-[11px] tracking-wider hover:border-accent-secondary hover:text-accent-secondary transition-all"
        onClick={onSkip}
      >
        SKIP &gt;&gt;
      </button>
    </div>
  );
}

// ============================================================
// 对话阶段组件
// ============================================================

interface DialoguePhaseProps {
  onComplete: () => void;
  onSkip: (e: React.MouseEvent) => void;
}

function DialoguePhase({ onComplete, onSkip }: DialoguePhaseProps) {
  const [index, setIndex] = useState(0);
  const [displayedChars, setDisplayedChars] = useState(0);
  const [showFull, setShowFull] = useState(false);
  const current = DIALOGUES[index];

  // 打字机效果
  useEffect(() => {
    if (showFull) return;
    const text = current.text;
    if (displayedChars >= text.length) {
      setShowFull(true);
      return;
    }
    const timer = setTimeout(() => {
      setDisplayedChars((p) => Math.min(p + 2, text.length));
    }, 30);
    return () => clearTimeout(timer);
  }, [displayedChars, showFull, current.text]);

  // 切换对话时重置
  useEffect(() => {
    setDisplayedChars(0);
    setShowFull(false);
    if (current.sfx === 'gunshot') {
      const timer = setTimeout(() => {
        try {
          const audio = new Audio('/gun1.wav');
          audio.volume = 0.7;
          audio.play().catch(() => {});
        } catch { /* ignore */ }
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [index]);

  const handleClick = useCallback(() => {
    if (!showFull) {
      setDisplayedChars(current.text.length);
      setShowFull(true);
      return;
    }
    if (index < DIALOGUES.length - 1) {
      setIndex((i) => i + 1);
    } else {
      onComplete();
    }
  }, [showFull, index, current.text.length, onComplete]);

  const sideClass = current.side === 'left' ? 'items-start' : current.side === 'right' ? 'items-end' : 'items-center';
  const speakerColor = current.speaker === '主角' ? 'text-yellow-400'
    : current.speaker === '特工L' ? 'text-cyan-400'
    : 'text-pink-400';

  return (
    <div
      className="fixed inset-0 z-[300] flex flex-col items-center justify-end cursor-pointer select-none"
      onClick={handleClick}
    >
      {/* 舞台背景 */}
      <div className="absolute inset-0 bg-black">
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[80%] pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at bottom, rgba(0, 255, 136, 0.08) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[500px] h-1 pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(0, 255, 136, 0.4), transparent)',
            boxShadow: '0 0 20px rgba(0, 255, 136, 0.3)',
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 255, 136, 0.3) 2px, rgba(0, 255, 136, 0.3) 3px)',
          }}
        />
      </div>

      {/* 角色站位 */}
      <div className="absolute left-[3%] bottom-[22%] w-48 h-96 pointer-events-none">
        <div className="relative w-full h-full">
          <img
            src="/bg-left.png"
            alt="左哥"
            className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(34,211,238,0.4)]"
          />
          {current.side === 'left' && (
            <div className="absolute inset-0 rounded-lg border-2 border-cyan-400 animate-neon-flicker" />
          )}
        </div>
      </div>

      <div className="absolute right-[3%] bottom-[22%] w-48 h-96 pointer-events-none">
        <div className="relative w-full h-full">
          <img
            src="/bg-right.png"
            alt="右哥"
            className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(244,114,182,0.4)]"
          />
          {current.side === 'right' && (
            <div className="absolute inset-0 rounded-lg border-2 border-pink-400 animate-neon-flicker" />
          )}
        </div>
      </div>

      <div className="absolute left-1/2 -translate-x-1/2 bottom-[22%] w-40 h-80 pointer-events-none">
        <div className="w-full h-full rounded-lg border border-yellow-400/30 flex items-center justify-center">
          <span className="text-5xl">🧑</span>
        </div>
      </div>

      {/* 主角高亮 */}
      {current.side === 'center' && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-[22%] w-40 h-80 rounded-lg border-2 border-yellow-400 animate-neon-flicker pointer-events-none" />
      )}

      {/* 对话框 */}
      <div className={`relative z-10 mb-8 flex flex-col ${sideClass} w-full max-w-2xl px-4`}>
        <span className={`font-cyber text-sm tracking-widest mb-2 ${speakerColor}`}>
          {current.speaker}
        </span>

        <div className="relative w-full bg-black/80 border border-game-border px-6 py-4 rounded-sm backdrop-blur-sm">
          <div
            className="absolute top-0 left-0 right-0 h-[1px] opacity-60"
            style={{
              background: current.side === 'left' ? 'linear-gradient(90deg, transparent, #22d3ee, transparent)'
                : current.side === 'right' ? 'linear-gradient(90deg, transparent, #f472b6, transparent)'
                : 'linear-gradient(90deg, transparent, #facc15, transparent)',
            }}
          />
          <p className="font-data text-game-text text-base leading-relaxed min-h-[1.5em]">
            {current.text.slice(0, displayedChars)}
            {!showFull && (
              <span className="inline-block w-2 h-4 bg-accent ml-0.5 animate-pulse align-middle" />
            )}
          </p>
        </div>

        <p className="text-game-text-dim font-cyber text-[10px] mt-3 tracking-widest animate-pulse">
          {showFull ? (index < DIALOGUES.length - 1 ? '▸ 点击继续' : '▸ 点击开始挑战') : '　'}
        </p>
      </div>

      {/* 跳过按钮 */}
      <button
        className="absolute top-4 right-4 z-20 px-4 py-1.5 border border-game-border/50 bg-black/60 text-game-text-dim font-cyber text-[11px] tracking-wider hover:border-accent-secondary hover:text-accent-secondary transition-all"
        onClick={onSkip}
      >
        SKIP &gt;&gt;
      </button>
    </div>
  );
}

// ============================================================
// 主组件
// ============================================================

interface PrologueDialogProps {
  onComplete: () => void;
}

export function PrologueDialog({ onComplete }: PrologueDialogProps) {
  const [phase, setPhase] = useState<'intro' | 'dialogue'>('intro');

  const handleSkip = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onComplete();
  }, [onComplete]);

  const handleIntroDone = useCallback(() => {
    setPhase('dialogue');
  }, []);

  const handleDialogueDone = useCallback(() => {
    onComplete();
  }, [onComplete]);

  if (phase === 'intro') {
    return <IntroPhase onComplete={handleIntroDone} onSkip={handleSkip} />;
  }

  return <DialoguePhase onComplete={handleDialogueDone} onSkip={handleSkip} />;
}
