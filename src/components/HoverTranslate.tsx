import { useState, useRef, useEffect } from 'react';

interface HoverTranslateProps {
  text: string;
  hoverText: string;
}

/** 检测是否为触屏设备 */
function isTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

export function HoverTranslate({ text, hoverText }: HoverTranslateProps) {
  const [hovered, setHovered] = useState(false);
  const isTouchRef = useRef(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(isTouchDevice());
  }, []);

  // 触屏：点击切换中英文显示
  const handleClick = () => {
    if (isMobile) {
      setHovered((v) => !v);
    }
  };

  // 防止触屏点击触发 hover 后又立即被 mouseLeave 清除
  const handleMouseEnter = () => {
    if (isMobile) return;
    setHovered(true);
  };
  const handleMouseLeave = () => {
    if (isMobile) return;
    setHovered(false);
  };

  // 触屏端外部点击时关闭
  useEffect(() => {
    if (!isMobile || !hovered) return;
    const handler = (e: MouseEvent) => {
      if (isTouchRef.current && !(e.target as HTMLElement).closest('.hover-translate')) {
        setHovered(false);
      }
    };
    // 短暂延迟以免吃掉当前点击
    const tid = setTimeout(() => document.addEventListener('click', handler), 100);
    return () => {
      clearTimeout(tid);
      document.removeEventListener('click', handler);
    };
  }, [isMobile, hovered]);

  return (
    <span
      className="hover-translate relative inline-grid place-items-center"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={() => { isTouchRef.current = true; }}
      onClick={handleClick}
    >
      <span className={`hover-translate-default col-start-1 row-start-1 transition-opacity duration-150 ${hovered ? 'opacity-0' : 'opacity-100'}`}>
        {text}
      </span>
      <span className={`hover-translate-hover col-start-1 row-start-1 transition-opacity duration-150 ${hovered ? 'opacity-100' : 'opacity-0'}`}>
        {hoverText}
      </span>
    </span>
  );
}
