import { useState } from 'react';

interface HoverTranslateProps {
  text: string;
  hoverText: string;
}

export function HoverTranslate({ text, hoverText }: HoverTranslateProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <span
      className="hover-translate relative inline-grid place-items-center"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
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
