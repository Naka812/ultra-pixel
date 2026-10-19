"use client";

import React, { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export interface TooltipData {
  label: string;
  description: string;
  x: number;
  y: number;
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'left' | 'center';
}

function TooltipContent({ tooltip }: { tooltip: TooltipData }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = tooltip.x;
    let top = tooltip.y;

    // Apply side and align logic
    if (tooltip.side === 'top') {
      top -= height + 8;
      if (tooltip.align === 'center') left -= width / 2;
    } else if (tooltip.side === 'bottom') {
      top += 8;
      if (tooltip.align === 'center') left -= width / 2;
    } else if (tooltip.side === 'left') {
      left -= width + 8;
      if (tooltip.align === 'center') top -= height / 2;
    } else if (tooltip.side === 'right') {
      left += 8;
      if (tooltip.align === 'center') top -= height / 2;
    } else {
      // Default to bottom center
      top += 8;
      left -= width / 2;
    }

    // Viewport boundaries check
    const PADDING = 8;

    if (left < PADDING) {
      left = PADDING;
    } else if (left + width > vw - PADDING) {
      left = vw - width - PADDING;
    }

    if (top < PADDING) {
      top = PADDING;
    } else if (top + height > vh - PADDING) {
      top = vh - height - PADDING;
    }

    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.visibility = 'visible';
  }, [tooltip]);

  return createPortal(
    <div 
      ref={ref}
      className="fixed z-[99999999] px-3 py-2 bg-[#1a1a1a] border border-white/10 text-white rounded-lg pointer-events-none shadow-xl whitespace-nowrap"
      style={{
        left: 0, 
        top: 0,
        visibility: 'hidden'
      }}
    >
      <div className="text-xs font-bold mb-0.5">{tooltip.label}</div>
      {tooltip.description && <div className="text-[10px] text-white/60 tooltip-description" dangerouslySetInnerHTML={{ __html: tooltip.description }} />}
    </div>,
    document.body
  );
}

export default function GlobalTooltip({ tooltip }: { tooltip: TooltipData | null }) {
  if (!tooltip) return null;
  
  // Usar uma key força o React a desmontar e montar um novo elemento DOM do zero
  // sempre que o tooltip muda. Isso garante que nenhuma transição CSS antiga
  // seja aplicada e que o tooltip nasça invisível e seja posicionado antes de aparecer.
  const key = `${tooltip.label}-${tooltip.x}-${tooltip.y}`;
  
  return <TooltipContent key={key} tooltip={tooltip} />;
}
