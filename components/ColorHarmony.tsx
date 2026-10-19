
'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { HarmonyType, generateHarmony, hexToHsl, hslToHex } from '@/lib/colorUtils';
import { cn } from '@/lib/utils';
import { Plus, Lock, Unlock } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

interface ColorHarmonyProps {
  baseColor: string;
  onAddColor: (color: string) => void;
  onAddAllColors: (colors: string[]) => void;
  onBaseColorChange: (color: string) => void;
  onMouseEnterTooltip?: (label: string, description: string, e: React.MouseEvent) => void;
  onMouseLeaveTooltip?: () => void;
}

export default function ColorHarmony({ 
  baseColor, 
  onAddColor, 
  onAddAllColors, 
  onBaseColorChange,
  onMouseEnterTooltip,
  onMouseLeaveTooltip
}: ColorHarmonyProps) {
  const { t } = useLanguage();
  // ... (rest of the component)
  // Inside the return, add the "Add All" button
  // And update the modal to call onAddColor or onAddAllColors

  const [type, setType] = useState<HarmonyType>('analogous');
  const [harmonyColors, setHarmonyColors] = useState<string[]>([]);
  const wheelRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [lockHue, setLockHue] = useState(false);
  const [lockLightness, setLockLightness] = useState(false);

  // Persistent HSL to avoid loss of hue at black/white extremes
  const [internalHsl, setInternalHsl] = useState(() => hexToHsl(baseColor));

  // Sync internal HSL when baseColor changes from external sources
  useEffect(() => {
    const hsl = hexToHsl(baseColor);
    // Only update hue if the color is not black or white (where hue is undefined/0)
    // or if we're not currently dragging
    setInternalHsl(prev => {
      if (isDragging) return prev;
      return {
        h: (hsl.l > 0 && hsl.l < 100) ? hsl.h : prev.h,
        s: hsl.s,
        l: hsl.l
      };
    });
  }, [baseColor, isDragging]);

  useEffect(() => {
    setHarmonyColors(generateHarmony(baseColor, type));
  }, [baseColor, type]);

  const colorData = useMemo(() => {
    return harmonyColors.map(color => hexToHsl(color));
  }, [harmonyColors]);

  const handleWheelInteraction = useCallback((e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    if (!wheelRef.current) return;

    const rect = wheelRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

    const dx = clientX - centerX;
    const dy = clientY - centerY;

    let newHue = internalHsl.h;
    let newLightness = internalHsl.l;

    if (!lockHue) {
      let angle = Math.atan2(dy, dx) * (180 / Math.PI);
      newHue = (angle + 90 + 360) % 360;
    }

    if (!lockLightness) {
      const distance = Math.sqrt(dx * dx + dy * dy);
      const maxRadius = rect.width / 2;
      // Inverted: 100 at center, 0 at edge
      newLightness = Math.min(100, Math.max(0, 100 - (distance / maxRadius) * 100));
    }

    const newHsl = { h: newHue, s: internalHsl.s, l: newLightness };
    setInternalHsl(newHsl);
    onBaseColorChange(hslToHex(newHue, internalHsl.s, newLightness));
  }, [internalHsl, lockHue, lockLightness, onBaseColorChange]);

  const onMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleWheelInteraction(e);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    handleWheelInteraction(e);
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (isDragging) {
        handleWheelInteraction(e);
      }
    };

    const handleEnd = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', handleMove);
      window.addEventListener('touchend', handleEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, handleWheelInteraction]);

  const harmonyTypes: { id: HarmonyType; label: string }[] = [
    { id: 'monochromatic', label: t('monochromatic') },
    { id: 'analogous', label: t('analogous') },
    { id: 'triad', label: t('triad') },
    { id: 'split-complementary', label: t('splitComplementary') },
    { id: 'tetradic', label: t('tetradic') },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden items-center">
      <div className="p-4 space-y-6 w-full max-w-[260px]">
        {/* Color Wheel Visualization & Locks */}
        <div className="flex items-center justify-center gap-4">
          <div 
            ref={wheelRef}
            onMouseDown={onMouseDown}
            onTouchStart={onTouchStart}
            className="relative aspect-square w-full max-w-[160px] rounded-full border-4 border-white/10 shadow-xl overflow-visible cursor-crosshair select-none touch-none"
          >
            <div 
              className="absolute inset-0 rounded-full overflow-hidden"
              style={{
                background: `
                  radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 50%, rgba(0,0,0,0) 50%, rgba(0,0,0,1) 100%),
                  conic-gradient(red, yellow, lime, cyan, blue, magenta, red)
                `,
              }}
            />
            
            {/* Hue & Lightness Indicators */}
            {(new Set(harmonyColors).size === 1 ? [colorData[0]] : colorData).map((data, idx) => {
              const isBase = new Set(harmonyColors).size === 1 ? true : idx === 2;
              const hue = data.h;
              const lightness = data.l;
              return (
                <div 
                  key={`${hue}-${idx}`}
                  className="absolute inset-0 pointer-events-none transition-transform duration-200"
                  style={{
                    transform: `rotate(${hue}deg)`,
                  }}
                >
                  <div className={cn(
                    "absolute bottom-1/2 left-1/2 -translate-x-1/2 origin-bottom",
                    isBase ? "z-20 w-1" : "z-10 w-0.5"
                  )}
                  style={{ height: '50%' }}
                  >
                    {/* Line */}
                    <div className={cn(
                      "absolute inset-0",
                      isBase ? "bg-white/40" : "bg-white/10"
                    )} />
                    
                    {/* Lightness Marker (Dot) */}
                    <div 
                      className={cn(
                        "absolute left-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 transition-all duration-300",
                        isBase ? "border-white shadow-[0_0_10px_rgba(255,255,255,0.5)] scale-125" : "border-white/60"
                      )}
                      style={{ 
                        top: `${lightness}%`,
                        marginTop: '-6px',
                        backgroundColor: new Set(harmonyColors).size === 1 ? harmonyColors[0] : harmonyColors[idx]
                      }}
                    />

                    {/* Arrow head / Pointer (at the edge) */}
                    <div className={cn(
                      "absolute top-0 left-1/2 w-0 h-0 border-l-[4px] border-r-[4px] border-t-[6px] border-l-transparent border-r-transparent",
                      isBase ? "border-t-white" : "border-t-white/40"
                    )} style={{ 
                        marginLeft: '-4px',
                        marginTop: '-6px'
                    }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Lock Controls */}
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setLockHue(!lockHue)}
              onMouseEnter={(e) => onMouseEnterTooltip?.(lockHue ? t('unlockHue') : t('lockHue'), t('lockHueDesc'), e)}
              onMouseLeave={onMouseLeaveTooltip}
              className={cn(
                "p-2 rounded-lg border transition-all flex flex-col items-center gap-1",
                lockHue ? "bg-blue-600/20 border-blue-500 text-blue-400" : "bg-white/5 border-white/10 text-white/40 hover:text-white/60"
              )}
            >
              {lockHue ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              <span className="text-[8px] font-bold uppercase">{t('hue')}</span>
            </button>
            <button
              onClick={() => setLockLightness(!lockLightness)}
              onMouseEnter={(e) => onMouseEnterTooltip?.(lockLightness ? t('unlockLightness') : t('lockLightness'), t('lockLightnessDesc'), e)}
              onMouseLeave={onMouseLeaveTooltip}
              className={cn(
                "p-2 rounded-lg border transition-all flex flex-col items-center gap-1",
                lockLightness ? "bg-blue-600/20 border-blue-500 text-blue-400" : "bg-white/5 border-white/10 text-white/40 hover:text-white/60"
              )}
            >
              {lockLightness ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              <span className="text-[8px] font-bold uppercase">{t('light')}</span>
            </button>
          </div>
        </div>

        {/* Harmony Type Selector */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest">{t('harmonyType')}</label>
          <select 
            value={type}
            onChange={(e) => setType(e.target.value as HarmonyType)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500 transition-colors"
          >
            {harmonyTypes.map(t => (
              <option key={t.id} value={t.id} className="bg-[#1a1a1a]">{t.label}</option>
            ))}
          </select>
        </div>

        {/* Harmony Slots */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest">{t('generatedVariations')}</label>
            <button 
              onClick={() => onAddAllColors(harmonyColors)}
              onMouseEnter={(e) => onMouseEnterTooltip?.(t('addAll'), t('addAllDesc'), e)}
              onMouseLeave={onMouseLeaveTooltip}
              className="text-[8px] font-bold text-blue-400 hover:text-blue-300 uppercase tracking-widest"
            >
              {t('addAll')}
            </button>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {(new Set(harmonyColors).size === 1 ? [harmonyColors[0]] : harmonyColors).map((color, idx) => {
              const isBase = new Set(harmonyColors).size === 1 ? true : idx === 2;
              return (
                <button
                  key={`${color}-${idx}`}
                  onClick={() => onAddColor(color)}
                  className={cn(
                    "w-8 h-8 shrink-0 rounded-md border-2 transition-all hover:scale-110 hover:shadow-lg",
                    isBase ? "border-white scale-110 shadow-lg shadow-white/20 z-10" : "border-transparent"
                  )}
                  style={{ backgroundColor: color }}
                  title={isBase ? t('primaryColor') : t('clickToAddColor').replace('{color}', color)}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
