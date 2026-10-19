"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { PixelProject, Frame } from '@/types';
import { DEFAULT_PALETTE, DEFAULT_BRUSHES } from '@/lib/constants';
import { 
  X, 
  Film, 
  Grid3X3, 
  Sliders, 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Check, 
  Sparkles, 
  Upload,
  Layers,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '@/lib/LanguageContext';

interface SpriteSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (project: PixelProject) => void;
  initialFile?: File | null;
}

interface SlicedFrameData {
  index: number;
  col: number;
  row: number;
  x: number;
  y: number;
  w: number;
  h: number;
  isEmpty: boolean;
  previewUrl: string;
}

export default function SpriteSheetModal({ isOpen, onClose, onImport, initialFile }: SpriteSheetModalProps) {
  const { t } = useLanguage();

  // Image source state
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string>('sprite_sheet');
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);

  // Slicing Mode: 'size' (by frame dimensions) or 'grid' (by columns and rows)
  const [mode, setMode] = useState<'size' | 'grid'>('size');

  // Parameters
  const [frameWidth, setFrameWidth] = useState<number>(32);
  const [frameHeight, setFrameHeight] = useState<number>(32);
  const [columns, setColumns] = useState<number>(4);
  const [rows, setRows] = useState<number>(1);
  const [offsetX, setOffsetX] = useState<number>(0);
  const [offsetY, setOffsetY] = useState<number>(0);
  const [gapX, setGapX] = useState<number>(0);
  const [gapY, setGapY] = useState<number>(0);
  const [sliceOrder, setSliceOrder] = useState<'horizontal' | 'vertical'>('horizontal');
  const [skipEmpty, setSkipEmpty] = useState<boolean>(true);
  const [projectName, setProjectName] = useState<string>('Sprite Animation');
  const [extractPalette, setExtractPalette] = useState<boolean>(true);

  // Visualizer / preview state
  const [zoom, setZoom] = useState<number>(1);
  const [previewFps, setPreviewFps] = useState<number>(8);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentFrameIdx, setCurrentFrameIdx] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'slice' | 'animation'>('slice');
  const [excludedFrameIndices, setExcludedFrameIndices] = useState<Set<number>>(new Set());
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // References
  const sheetCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const animTimerRef = useRef<NodeJS.Timeout | null>(null);

  const loadImageFromSrc = useCallback((src: string) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setLoadedImage(img);
      setImageSrc(src);
      setImageDimensions({ width: img.width, height: img.height });

      // Smart initial defaults based on image size
      let initialFrameSize = 32;
      if (img.height <= 16) initialFrameSize = 16;
      else if (img.height <= 24) initialFrameSize = 24;
      else if (img.height <= 32) initialFrameSize = 32;
      else if (img.height <= 48) initialFrameSize = 48;
      else if (img.height <= 64) initialFrameSize = 64;
      else if (img.height <= 128) initialFrameSize = img.height % 32 === 0 ? 32 : img.height;

      const calculatedCols = Math.max(1, Math.floor(img.width / initialFrameSize));
      const calculatedRows = Math.max(1, Math.floor(img.height / initialFrameSize));

      setFrameWidth(initialFrameSize);
      setFrameHeight(initialFrameSize);
      setColumns(calculatedCols);
      setRows(calculatedRows);
      setOffsetX(0);
      setOffsetY(0);
      setGapX(0);
      setGapY(0);
      setExcludedFrameIndices(new Set());
    };
    img.onerror = () => {
      setErrorMsg(t('invalidSpriteSheet'));
    };
    img.src = src;
  }, [t]);

  const loadImageFromFile = useCallback((file: File) => {
    setErrorMsg(null);
    const cleanName = file.name.replace(/\.[^/.]+$/, "");
    setImageName(cleanName);
    setProjectName(cleanName || 'Sprite Animation');

    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      if (!src) return;
      loadImageFromSrc(src);
    };
    reader.onerror = () => {
      setErrorMsg(t('invalidSpriteSheet'));
    };
    reader.readAsDataURL(file);
  }, [loadImageFromSrc, t]);

  // Load image when initialFile changes or when opened
  useEffect(() => {
    if (initialFile && isOpen) {
      loadImageFromFile(initialFile);
    }
  }, [initialFile, isOpen, loadImageFromFile]);

  // Keep frameWidth/frameHeight and columns/rows in sync when changing mode or inputs
  const handleModeChange = (newMode: 'size' | 'grid') => {
    setMode(newMode);
    if (!loadedImage) return;

    if (newMode === 'grid') {
      // Calculate columns and rows based on current frameWidth/frameHeight
      const availableW = loadedImage.width - offsetX;
      const availableH = loadedImage.height - offsetY;
      const c = Math.max(1, Math.floor((availableW + gapX) / (frameWidth + gapX)));
      const r = Math.max(1, Math.floor((availableH + gapY) / (frameHeight + gapY)));
      setColumns(c);
      setRows(r);
    } else {
      // Calculate frame size based on columns and rows
      const availableW = loadedImage.width - offsetX - Math.max(0, columns - 1) * gapX;
      const availableH = loadedImage.height - offsetY - Math.max(0, rows - 1) * gapY;
      const fw = Math.max(1, Math.floor(availableW / columns));
      const fh = Math.max(1, Math.floor(availableH / rows));
      setFrameWidth(fw);
      setFrameHeight(fh);
    }
  };

  // Effective dimensions calculation
  const effectiveParams = useMemo(() => {
    if (!loadedImage) {
      return { fw: frameWidth, fh: frameHeight, cols: columns, rows: rows };
    }

    if (mode === 'size') {
      const fw = Math.max(1, Math.min(loadedImage.width, frameWidth));
      const fh = Math.max(1, Math.min(loadedImage.height, frameHeight));
      const availableW = loadedImage.width - offsetX;
      const availableH = loadedImage.height - offsetY;
      const calcCols = Math.max(1, Math.floor((availableW + gapX) / (fw + gapX)));
      const calcRows = Math.max(1, Math.floor((availableH + gapY) / (fh + gapY)));
      return { fw, fh, cols: calcCols, rows: calcRows };
    } else {
      const safeCols = Math.max(1, columns);
      const safeRows = Math.max(1, rows);
      const availableW = loadedImage.width - offsetX - Math.max(0, safeCols - 1) * gapX;
      const availableH = loadedImage.height - offsetY - Math.max(0, safeRows - 1) * gapY;
      const fw = Math.max(1, Math.floor(availableW / safeCols));
      const fh = Math.max(1, Math.floor(availableH / safeRows));
      return { fw, fh, cols: safeCols, rows: safeRows };
    }
  }, [loadedImage, mode, frameWidth, frameHeight, columns, rows, offsetX, offsetY, gapX, gapY]);

  // Compute sliced frames with thumbnails and transparency detection
  const [slicedFrames, setSlicedFrames] = useState<SlicedFrameData[]>([]);

  useEffect(() => {
    if (!loadedImage) {
      setSlicedFrames([]);
      return;
    }

    const { fw, fh, cols, rows } = effectiveParams;
    const totalPossible = cols * rows;
    if (totalPossible <= 0 || fw <= 0 || fh <= 0) {
      setSlicedFrames([]);
      return;
    }

    // Temporary canvas for reading pixels and generating small thumbnails
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = fw;
    tempCanvas.height = fh;
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    if (!tempCtx) return;

    // Full image canvas to read from
    const fullCanvas = document.createElement('canvas');
    fullCanvas.width = loadedImage.width;
    fullCanvas.height = loadedImage.height;
    const fullCtx = fullCanvas.getContext('2d', { willReadFrequently: true });
    if (!fullCtx) return;
    fullCtx.drawImage(loadedImage, 0, 0);

    const frames: SlicedFrameData[] = [];
    let frameIndex = 0;

    if (sliceOrder === 'horizontal') {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = offsetX + c * (fw + gapX);
          const y = offsetY + r * (fh + gapY);

          // Check boundary
          if (x + fw > loadedImage.width || y + fh > loadedImage.height) continue;

          tempCtx.clearRect(0, 0, fw, fh);
          tempCtx.drawImage(loadedImage, x, y, fw, fh, 0, 0, fw, fh);
          const imgData = tempCtx.getImageData(0, 0, fw, fh);

          // Check if frame has any visible non-transparent pixels (alpha > 10)
          let hasContent = false;
          for (let i = 3; i < imgData.data.length; i += 4) {
            if (imgData.data[i] > 10) {
              hasContent = true;
              break;
            }
          }

          frames.push({
            index: frameIndex++,
            col: c,
            row: r,
            x,
            y,
            w: fw,
            h: fh,
            isEmpty: !hasContent,
            previewUrl: tempCanvas.toDataURL()
          });
        }
      }
    } else {
      // Vertical order: col by col
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const x = offsetX + c * (fw + gapX);
          const y = offsetY + r * (fh + gapY);

          if (x + fw > loadedImage.width || y + fh > loadedImage.height) continue;

          tempCtx.clearRect(0, 0, fw, fh);
          tempCtx.drawImage(loadedImage, x, y, fw, fh, 0, 0, fw, fh);
          const imgData = tempCtx.getImageData(0, 0, fw, fh);

          let hasContent = false;
          for (let i = 3; i < imgData.data.length; i += 4) {
            if (imgData.data[i] > 10) {
              hasContent = true;
              break;
            }
          }

          frames.push({
            index: frameIndex++,
            col: c,
            row: r,
            x,
            y,
            w: fw,
            h: fh,
            isEmpty: !hasContent,
            previewUrl: tempCanvas.toDataURL()
          });
        }
      }
    }

    setSlicedFrames(frames);
    setCurrentFrameIdx(0);
  }, [loadedImage, effectiveParams, offsetX, offsetY, gapX, gapY, sliceOrder]);

  // Active frames to import (filtering out skipped / excluded)
  const activeFrames = useMemo(() => {
    return slicedFrames.filter(f => {
      if (skipEmpty && f.isEmpty) return false;
      if (excludedFrameIndices.has(f.index)) return false;
      return true;
    });
  }, [slicedFrames, skipEmpty, excludedFrameIndices]);

  // Draw Sprite Sheet with visual Grid Lines on Canvas
  useEffect(() => {
    const canvas = sheetCanvasRef.current;
    if (!canvas || !loadedImage) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const displayW = loadedImage.width * zoom;
    const displayH = loadedImage.height * zoom;
    canvas.width = displayW;
    canvas.height = displayH;

    ctx.imageSmoothingEnabled = false;

    // Draw checkered transparency background
    const checkerSize = 8;
    for (let y = 0; y < displayH; y += checkerSize) {
      for (let x = 0; x < displayW; x += checkerSize) {
        ctx.fillStyle = ((x / checkerSize + y / checkerSize) % 2 === 0) ? '#1f1f1f' : '#292929';
        ctx.fillRect(x, y, checkerSize, checkerSize);
      }
    }

    // Draw sprite sheet image
    ctx.drawImage(loadedImage, 0, 0, displayW, displayH);

    // Draw grid slices overlay
    slicedFrames.forEach((frame) => {
      const isExcluded = excludedFrameIndices.has(frame.index) || (skipEmpty && frame.isEmpty);
      const isSelected = activeFrames[currentFrameIdx]?.index === frame.index;

      const fx = frame.x * zoom;
      const fy = frame.y * zoom;
      const fw = frame.w * zoom;
      const fh = frame.h * zoom;

      // Frame box outline
      if (isSelected) {
        ctx.strokeStyle = '#38bdf8'; // Sky blue highlight
        ctx.lineWidth = 2.5;
        ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
        ctx.fillRect(fx, fy, fw, fh);
      } else if (isExcluded) {
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)'; // Red dimmed
        ctx.lineWidth = 1;
        ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
        ctx.fillRect(fx, fy, fw, fh);
      } else {
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.75)'; // Amber/yellow grid
        ctx.lineWidth = 1;
      }

      ctx.strokeRect(fx + 0.5, fy + 0.5, fw - 1, fh - 1);

      // Frame number badge in corner
      if (fw >= 14 && fh >= 14) {
        const badgeText = `${frame.index + 1}`;
        ctx.font = 'bold 10px monospace';
        const textWidth = ctx.measureText(badgeText).width;
        
        ctx.fillStyle = isSelected ? '#38bdf8' : isExcluded ? 'rgba(239, 68, 68, 0.7)' : 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(fx + 2, fy + 2, textWidth + 6, 13);
        
        ctx.fillStyle = isSelected ? '#000000' : '#ffffff';
        ctx.fillText(badgeText, fx + 5, fy + 12);
      }
    });
  }, [loadedImage, zoom, slicedFrames, activeFrames, currentFrameIdx, excludedFrameIndices, skipEmpty]);

  // Animation Playback loop
  useEffect(() => {
    if (animTimerRef.current) {
      clearInterval(animTimerRef.current);
      animTimerRef.current = null;
    }

    if (!isPlaying || activeFrames.length <= 1) return;

    const intervalMs = Math.max(20, Math.floor(1000 / previewFps));
    animTimerRef.current = setInterval(() => {
      setCurrentFrameIdx((prev) => (prev + 1) % activeFrames.length);
    }, intervalMs);

    return () => {
      if (animTimerRef.current) {
        clearInterval(animTimerRef.current);
      }
    };
  }, [isPlaying, previewFps, activeFrames.length]);

  // Click on sheet canvas to select / jump to that frame
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!sheetCanvasRef.current || !loadedImage) return;
    const rect = sheetCanvasRef.current.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / zoom;
    const clickY = (e.clientY - rect.top) / zoom;

    const clicked = slicedFrames.find(f => 
      clickX >= f.x && clickX < f.x + f.w &&
      clickY >= f.y && clickY < f.y + f.h
    );

    if (clicked) {
      const activeIdx = activeFrames.findIndex(f => f.index === clicked.index);
      if (activeIdx !== -1) {
        setCurrentFrameIdx(activeIdx);
      }
    }
  };

  const toggleFrameExclusion = (frameIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExcludedFrameIndices(prev => {
      const next = new Set(prev);
      if (next.has(frameIndex)) {
        next.delete(frameIndex);
      } else {
        next.add(frameIndex);
      }
      return next;
    });
  };

  // Convert sliced frames into PixelProject
  const handleConfirmImport = async () => {
    if (!loadedImage || activeFrames.length === 0) {
      setErrorMsg(t('noFramesDetected'));
      return;
    }

    const { fw, fh } = effectiveParams;
    if (fw > 1024 || fh > 1024) {
      setErrorMsg(t('frameSizeTooLarge'));
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      // 1. Prepare full image canvas to extract pixel color strings
      const fullCanvas = document.createElement('canvas');
      fullCanvas.width = loadedImage.width;
      fullCanvas.height = loadedImage.height;
      const fullCtx = fullCanvas.getContext('2d', { willReadFrequently: true });
      if (!fullCtx) throw new Error('Could not create canvas context');
      fullCtx.drawImage(loadedImage, 0, 0);

      // Frame canvas
      const frameCanvas = document.createElement('canvas');
      frameCanvas.width = fw;
      frameCanvas.height = fh;
      const frameCtx = frameCanvas.getContext('2d', { willReadFrequently: true });
      if (!frameCtx) throw new Error('Could not create frame canvas context');

      const layerId = Math.random().toString(36).substring(7);
      const generatedFrames: Frame[] = [];
      const extractedColorsSet = new Set<string>();

      // Extract each active frame
      for (const frameInfo of activeFrames) {
        frameCtx.clearRect(0, 0, fw, fh);
        frameCtx.drawImage(loadedImage, frameInfo.x, frameInfo.y, fw, fh, 0, 0, fw, fh);
        const imgData = frameCtx.getImageData(0, 0, fw, fh);

        const cellsData: string[] = [];
        for (let i = 0; i < imgData.data.length; i += 4) {
          const r = imgData.data[i];
          const g = imgData.data[i + 1];
          const b = imgData.data[i + 2];
          const a = imgData.data[i + 3];

          if (a < 128) {
            cellsData.push('transparent');
          } else {
            const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
            cellsData.push(hex);
            if (extractPalette && extractedColorsSet.size < 64) {
              extractedColorsSet.add(hex);
            }
          }
        }

        generatedFrames.push({
          id: Math.random().toString(36).substring(7),
          cells: {
            [layerId]: cellsData
          }
        });
      }

      if (generatedFrames.length === 0) {
        throw new Error(t('noFramesDetected'));
      }

      // Palettes: Add extracted palette alongside DEFAULT_PALETTE
      const projectPalettes = [
        { 
          id: 'default', 
          name: 'Default Palette', 
          colors: DEFAULT_PALETTE, 
          isMinimized: false, 
          lockedPaletteIndices: [] 
        }
      ];

      if (extractPalette && extractedColorsSet.size > 0) {
        projectPalettes.unshift({
          id: 'extracted',
          name: `${projectName} Colors`,
          colors: Array.from(extractedColorsSet),
          isMinimized: false,
          lockedPaletteIndices: []
        });
      }

      // Build complete PixelProject
      const newProject: PixelProject = {
        id: Math.random().toString(36).substring(7),
        name: projectName.trim() || imageName || 'Sprite Animation',
        width: fw,
        height: fh,
        layers: [{
          id: layerId,
          name: 'Layer 1',
          isVisible: true,
          isLocked: false,
          opacity: 1
        }],
        frames: generatedFrames,
        palettes: projectPalettes,
        brushes: DEFAULT_BRUSHES,
        stamps: [],
        folders: [],
        lastModified: Date.now()
      };

      onImport(newProject);
      onClose();
    } catch (err: any) {
      console.error('Failed to import sprite sheet:', err);
      setErrorMsg(err.message || t('invalidSpriteSheet'));
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-black/85 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[#181818] border border-white/10 rounded-3xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-white"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-[#1f1f1f]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-wide flex items-center gap-2">
                {t('spriteSheetSlicer')}
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-medium">
                  {effectiveParams.fw}x{effectiveParams.fh}px
                </span>
              </h2>
              <p className="text-xs text-white/50">{t('spriteSheetDesc')}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title={t('changeImage')}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{t('changeImage')}</span>
            </button>
            <input 
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) loadImageFromFile(file);
                e.target.value = '';
              }}
            />

            <button
              onClick={onClose}
              className="p-2 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        {!imageSrc ? (
          // Upload / Drop zone if no image is loaded yet
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-full max-w-lg aspect-[16/9] border-2 border-dashed border-white/20 hover:border-purple-500 rounded-3xl p-8 flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-purple-500/5 transition-all group"
            >
              <div className="w-16 h-16 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Film className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white mb-1">{t('selectOrDropImage')}</h3>
                <p className="text-xs text-white/40">PNG, JPG, WEBP, GIF</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
            {/* Left/Middle Column: Visual Sheet / Grid Preview */}
            <div className="flex-1 flex flex-col bg-[#121212] border-r border-white/10 overflow-hidden relative">
              {/* Preview Bar Top */}
              <div className="px-4 py-2 border-b border-white/10 bg-[#161616] flex items-center justify-between text-xs text-white/70">
                <div className="flex items-center gap-3">
                  <span className="font-bold uppercase tracking-wider text-white/40 text-[10px]">{t('sheetPreview')}</span>
                  <span className="text-white/60">
                    {imageDimensions.width} × {imageDimensions.height} px
                  </span>
                  <span className="px-2 py-0.5 rounded bg-white/5 text-purple-300 font-mono text-[11px]">
                    {activeFrames.length} {t('framesDetected')}
                  </span>
                </div>

                {/* Zoom Controls */}
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => setZoom(prev => Math.max(0.25, prev - 0.25))}
                    className="p-1.5 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <span className="px-2 font-mono text-[11px] min-w-12 text-center text-white/80">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button 
                    onClick={() => setZoom(prev => Math.min(8, prev + 0.25))}
                    className="p-1.5 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setZoom(1)}
                    className="p-1.5 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors"
                    title="100%"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Canvas Scroll Area */}
              <div className="flex-1 overflow-auto p-6 flex items-center justify-center bg-[#0d0d0d]">
                <div className="relative shadow-2xl rounded-lg overflow-hidden border border-white/10">
                  <canvas 
                    ref={sheetCanvasRef}
                    onClick={handleCanvasClick}
                    className="cursor-pointer block"
                    style={{ imageRendering: 'pixelated' }}
                  />
                </div>
              </div>

              {/* Bottom Mini Frame Strip */}
              <div className="h-20 border-t border-white/10 bg-[#161616] px-4 flex items-center gap-2 overflow-x-auto">
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 shrink-0">
                  {t('frames')} ({activeFrames.length}):
                </span>
                {slicedFrames.map((frame) => {
                  const isExcluded = excludedFrameIndices.has(frame.index) || (skipEmpty && frame.isEmpty);
                  const isSelected = activeFrames[currentFrameIdx]?.index === frame.index;

                  return (
                    <div
                      key={`thumb-${frame.index}`}
                      onClick={() => {
                        const activeIdx = activeFrames.findIndex(f => f.index === frame.index);
                        if (activeIdx !== -1) setCurrentFrameIdx(activeIdx);
                      }}
                      className={`relative group shrink-0 w-14 h-14 rounded-lg border-2 cursor-pointer overflow-hidden p-1 transition-all flex items-center justify-center ${
                        isSelected 
                          ? 'border-sky-400 bg-sky-500/10' 
                          : isExcluded 
                          ? 'border-red-500/30 opacity-40 bg-red-500/5' 
                          : 'border-white/10 hover:border-white/30 bg-black/40'
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={frame.previewUrl} 
                        alt={`Frame ${frame.index + 1}`}
                        className="max-w-full max-h-full object-contain"
                        style={{ imageRendering: 'pixelated' }}
                      />
                      <span className="absolute bottom-0.5 right-1 text-[9px] font-mono text-white/70 bg-black/60 px-1 rounded">
                        {frame.index + 1}
                      </span>

                      {/* Exclude toggle button */}
                      <button
                        onClick={(e) => toggleFrameExclusion(frame.index, e)}
                        className="absolute top-0.5 right-0.5 p-0.5 rounded bg-black/80 text-white/50 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        title={isExcluded ? "Include frame" : "Exclude frame"}
                      >
                        {isExcluded ? <Check className="w-3 h-3 text-green-400" /> : <X className="w-3 h-3" />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Slicing Configuration & Live Animation Preview */}
            <div className="w-full lg:w-96 flex flex-col bg-[#1a1a1a] overflow-y-auto">
              {/* Tabs for Mode */}
              <div className="p-4 border-b border-white/10">
                <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">
                  {t('slicingMode')}
                </label>
                <div className="grid grid-cols-2 p-1 bg-white/5 rounded-xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => handleModeChange('size')}
                    className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                      mode === 'size' 
                        ? 'bg-purple-600 text-white shadow-md' 
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    {t('byFrameSize')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleModeChange('grid')}
                    className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                      mode === 'grid' 
                        ? 'bg-purple-600 text-white shadow-md' 
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    <Grid3X3 className="w-3.5 h-3.5" />
                    {t('byGridCount')}
                  </button>
                </div>
              </div>

              {/* Slicing Controls */}
              <div className="p-4 space-y-4 border-b border-white/10">
                {mode === 'size' ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">
                          {t('frameWidth')} (px)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max={imageDimensions.width || 1024}
                          value={frameWidth}
                          onChange={(e) => setFrameWidth(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:border-purple-500 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">
                          {t('frameHeight')} (px)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max={imageDimensions.height || 1024}
                          value={frameHeight}
                          onChange={(e) => setFrameHeight(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:border-purple-500 transition-colors"
                        />
                      </div>
                    </div>

                    {/* Presets */}
                    <div>
                      <span className="block text-[10px] font-bold text-white/30 uppercase tracking-wider mb-1.5">
                        {t('presets')}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {[16, 24, 32, 48, 64].map((size) => (
                          <button
                            key={size}
                            type="button"
                            onClick={() => {
                              setFrameWidth(size);
                              setFrameHeight(size);
                            }}
                            className={`px-2.5 py-1 text-xs font-mono rounded-lg border transition-all ${
                              frameWidth === size && frameHeight === size
                                ? 'bg-purple-600/30 border-purple-500 text-purple-300 font-bold'
                                : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                            }`}
                          >
                            {size}x{size}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">
                        {t('columns')}
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="64"
                        value={columns}
                        onChange={(e) => setColumns(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:border-purple-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">
                        {t('rows')}
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="64"
                        value={rows}
                        onChange={(e) => setRows(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:border-purple-500 transition-colors"
                      />
                    </div>
                  </div>
                )}

                {/* Slicing Order */}
                <div>
                  <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">
                    {t('sliceOrder')}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSliceOrder('horizontal')}
                      className={`py-1.5 px-2 text-xs rounded-lg border font-medium transition-all ${
                        sliceOrder === 'horizontal'
                          ? 'bg-white/10 border-purple-500 text-purple-300'
                          : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
                      }`}
                    >
                      {t('horizontalOrder')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSliceOrder('vertical')}
                      className={`py-1.5 px-2 text-xs rounded-lg border font-medium transition-all ${
                        sliceOrder === 'vertical'
                          ? 'bg-white/10 border-purple-500 text-purple-300'
                          : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
                      }`}
                    >
                      {t('verticalOrder')}
                    </button>
                  </div>
                </div>

                {/* Offset & Spacing Accordion / Controls */}
                <div className="pt-2 border-t border-white/5">
                  <div className="grid grid-cols-2 gap-3 mb-2">
                    <div>
                      <label className="block text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">
                        {t('offsetX')} (px)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={offsetX}
                        onChange={(e) => setOffsetX(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">
                        {t('offsetY')} (px)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={offsetY}
                        onChange={(e) => setOffsetY(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">
                        {t('gapX')} (px)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={gapX}
                        onChange={(e) => setGapX(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">
                        {t('gapY')} (px)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={gapY}
                        onChange={(e) => setGapY(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Toggles */}
                <div className="space-y-2 pt-2 border-t border-white/5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-white/80 select-none">
                    <input
                      type="checkbox"
                      checked={skipEmpty}
                      onChange={(e) => setSkipEmpty(e.target.checked)}
                      className="rounded bg-white/10 border-white/20 text-purple-600 focus:ring-0 focus:ring-offset-0"
                    />
                    <span>{t('skipEmptyFrames')}</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs text-white/80 select-none">
                    <input
                      type="checkbox"
                      checked={extractPalette}
                      onChange={(e) => setExtractPalette(e.target.checked)}
                      className="rounded bg-white/10 border-white/20 text-purple-600 focus:ring-0 focus:ring-offset-0"
                    />
                    <span>{t('extractColors')}</span>
                  </label>
                </div>
              </div>

              {/* Live Animation Preview Area */}
              <div className="p-4 border-b border-white/10 flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                    {t('animationPreview')}
                  </label>
                  <span className="text-[11px] font-mono text-purple-300">
                    {activeFrames.length > 0 ? `${currentFrameIdx + 1} / ${activeFrames.length}` : '0 frames'}
                  </span>
                </div>

                {/* Animation Viewport */}
                <div className="aspect-square w-full max-w-[200px] mx-auto bg-[#111] rounded-2xl border border-white/10 overflow-hidden relative flex items-center justify-center p-3 shadow-inner">
                  {/* Checkerboard */}
                  <div 
                    className="absolute inset-0 opacity-40"
                    style={{
                      backgroundImage: `conic-gradient(#262626 90deg, #1a1a1a 90deg 180deg, #262626 180deg 270deg, #1a1a1a 270deg)`,
                      backgroundSize: '16px 16px'
                    }}
                  />
                  {activeFrames[currentFrameIdx] ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={activeFrames[currentFrameIdx].previewUrl}
                      alt="Current Frame"
                      className="relative max-w-full max-h-full object-contain"
                      style={{ imageRendering: 'pixelated' }}
                    />
                  ) : (
                    <span className="text-xs text-white/30 relative">{t('noFramesDetected')}</span>
                  )}
                </div>

                {/* Animation Player Controls */}
                <div className="mt-3 flex items-center justify-center gap-2">
                  <button
                    onClick={() => setCurrentFrameIdx(prev => (prev - 1 + activeFrames.length) % Math.max(1, activeFrames.length))}
                    className="p-1.5 hover:bg-white/10 rounded-lg text-white/70 hover:text-white"
                    title="Previous Frame"
                  >
                    <SkipBack className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="p-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl shadow-lg transition-transform hover:scale-105"
                    title={isPlaying ? "Pause" : "Play"}
                  >
                    {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                  </button>
                  <button
                    onClick={() => setCurrentFrameIdx(prev => (prev + 1) % Math.max(1, activeFrames.length))}
                    className="p-1.5 hover:bg-white/10 rounded-lg text-white/70 hover:text-white"
                    title="Next Frame"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>
                </div>

                {/* FPS Speed Slider */}
                <div className="mt-2 flex items-center gap-2 px-2">
                  <span className="text-[10px] font-bold text-white/40 uppercase">{t('fps')}:</span>
                  <input
                    type="range"
                    min="1"
                    max="24"
                    value={previewFps}
                    onChange={(e) => setPreviewFps(parseInt(e.target.value) || 8)}
                    className="flex-1 accent-purple-500 h-1 bg-white/10 rounded-lg cursor-pointer"
                  />
                  <span className="text-xs font-mono font-bold text-purple-300 min-w-6 text-right">
                    {previewFps}
                  </span>
                </div>
              </div>

              {/* Project Name & Actions */}
              <div className="p-4 bg-[#141414] space-y-3">
                {errorMsg && (
                  <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
                    {errorMsg}
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">
                    {t('projectName')}
                  </label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-purple-500 transition-colors"
                    placeholder="Sprite Animation"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-xl text-xs font-bold transition-colors"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="button"
                    disabled={isProcessing || activeFrames.length === 0}
                    onClick={handleConfirmImport}
                    className="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-purple-600/20 flex items-center justify-center gap-1.5"
                  >
                    {isProcessing ? (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>{t('importFramesBtn')}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
