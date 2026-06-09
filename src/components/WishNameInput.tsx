// ============================================================
// WishNameInput — 百变许愿机名字输入浮层（赛博朋克风格）
// ============================================================

import { useState, useRef, useEffect } from 'react';

interface WishNameInputProps {
  propId: string;
  onConfirm: (propId: string, name: string) => void;
  onCancel: () => void;
}

export function WishNameInput({ propId, onConfirm, onCancel }: WishNameInputProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (trimmed) {
      onConfirm(propId, trimmed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center">
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />

      {/* 输入面板 */}
      <div className="relative w-[360px] border-[3px] border-[#e7ff2f] bg-[#070707] shadow-[4px_4px_0_0_#e7ff2f]">
        {/* 顶部装饰条 */}
        <div className="h-[3px] bg-gradient-to-r from-[#e7ff2f] via-[#ff2d95] to-[#00e5ff]" />

        {/* 关闭按钮 */}
        <button
          onClick={onCancel}
          className="absolute top-2 right-2 text-[#9a9a8c] hover:text-[#ff2d95] transition-colors font-cyber text-sm leading-none"
        >
          ✕
        </button>

        <div className="p-6">
          {/* 标题 */}
          <h3 className="font-cyber text-lg text-[#00e5ff] tracking-wider mb-1">
            百变许愿机
          </h3>
          <p className="font-data text-xs text-[#9a9a8c] mb-4">
            输入一个名字，许愿机将变成它
          </p>

          {/* 输入框 */}
          <div className="mb-4">
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="例如：香蕉皮、老板、黑洞..."
              maxLength={20}
              className="w-full bg-[#111] border border-[#333] text-[#f3f3ea] font-data text-sm px-3 py-2.5
                         placeholder:text-[#555] placeholder:font-data
                         focus:border-[#e7ff2f] focus:outline-none focus:shadow-[0_0_8px_rgba(231,255,47,0.3)]
                         transition-all"
            />
          </div>

          {/* 确认按钮 */}
          <button
            onClick={handleSubmit}
            disabled={!value.trim()}
            className="w-full py-2.5 bg-[#e7ff2f] text-black font-cyber text-sm tracking-wider
                       hover:shadow-[0_0_12px_rgba(231,255,47,0.5)] hover:scale-[1.02]
                       active:scale-[0.98]
                       disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none
                       transition-all"
          >
            确认变身
          </button>
        </div>
      </div>
    </div>
  );
}
