"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { PixelProject, Tool, Frame, LayerMetadata, SelectionArea, Stamp, BrushShape } from '@/types';
import type { Palette } from '@/types';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/LanguageContext';
import { hexToHsl, hslToHex, hexToRgb, rgbToHex, hslToHsv, hsvToHsl } from '@/lib/colorUtils';
import ColorHarmony from './ColorHarmony';
import GlobalTooltip from './GlobalTooltip';
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  defaultDropAnimationSideEffects,
  useDroppable
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  Pencil, 
  Brush,
  Eraser, 
  PaintBucket, 
  Pipette, 
  Undo2, 
  Redo2, 
  Download, 
  Save, 
  Move,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Settings2,
  Grid3X3,
  Grid2X2,
  Layers as LayersIcon,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Plus,
  CopyPlus,
  Film,
  Ghost,
  Play,
  Pause,
  Sun,
  Moon,
  Edit2,
  Palette as PaletteIcon,
  Sparkles,
  MousePointer2,
  Replace,
  FlipHorizontal,
  FlipVertical,
  RotateCw,
  RotateCcw,
  Check,
  X,
  Search,
  Wand2,
  Zap,
  Crop,
  Minus,
  Slash,
  PenTool,
  Paintbrush,
  Square,
  SquareDashed,
  Circle,
  GripVertical,
  Copy,
  GripHorizontal,
  ArrowDownToLine,
  Scaling,
  Stamp as StampIcon,
  Upload,
  Folder,
  FolderPlus,
  FolderOpen
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { Buffer } from 'buffer';

if (typeof window !== 'undefined') {
  window.Buffer = window.Buffer || Buffer;
}

const TiledModeIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="9" y="9" width="6" height="6" rx="1" />
    <rect x="9" y="1" width="6" height="6" rx="1" />
    <rect x="9" y="17" width="6" height="6" rx="1" />
    <rect x="1" y="9" width="6" height="6" rx="1" />
    <rect x="17" y="9" width="6" height="6" rx="1" />
  </svg>
);

interface EditorProps {
  project: PixelProject;
  onSave: (project: PixelProject) => void;
  onBack: () => void;
}

type ToolItem = Tool | 'transparent' | 'transparency-mode' | 'grid' | 'resize' | 'tiled-mode' | 'mirror-mode';

type TransformState = {
  pixels: { x: number, y: number, color: string }[];
  originalW: number;
  originalH: number;
  centerX: number;
  centerY: number;
  w: number;
  h: number;
  rotation: number;
  originalLayerData: string[];
};

const SaturationBrightnessPicker = ({ h, s, v, onChange }: { h: number, s: number, v: number, onChange: (s: number, v: number) => void }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const handlePointer = (e: React.PointerEvent | PointerEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    onChange(x * 100, y * 100);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    handlePointer(e);
    const onPointerMove = (moveEvent: PointerEvent) => handlePointer(moveEvent);
    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  return (
    <div 
      ref={containerRef}
      onPointerDown={onPointerDown}
      className="relative w-full aspect-square rounded-xl cursor-crosshair overflow-hidden shadow-inner border border-white/10"
      style={{ backgroundColor: `hsl(${h}, 100%, 50%)` }}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-white to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
      <div 
        className="absolute w-4 h-4 border-2 border-white rounded-full shadow-lg -translate-x-1/2 translate-y-1/2 pointer-events-none ring-1 ring-black/20"
        style={{ left: `${s}%`, bottom: `${v}%` }}
      />
    </div>
  );
};

const HuePicker = ({ h, onChange }: { h: number, onChange: (h: number) => void }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const handlePointer = (e: React.PointerEvent | PointerEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onChange(x * 360);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    handlePointer(e);
    const onPointerMove = (moveEvent: PointerEvent) => handlePointer(moveEvent);
    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  return (
    <div 
      ref={containerRef}
      onPointerDown={onPointerDown}
      className="relative w-full h-5 rounded-full cursor-pointer shadow-inner border border-white/10"
      style={{ background: 'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)' }}
    >
      <div 
        className="absolute w-5 h-5 bg-white border-2 border-black/20 rounded-full shadow-md -translate-x-1/2 top-0 ring-1 ring-black/10"
        style={{ left: `${(h / 360) * 100}%` }}
      />
    </div>
  );
};

export default function Editor({ project: initialProject, onSave, onBack }: EditorProps) {
  const { t } = useLanguage();
  const [project, setProject] = useState<PixelProject>(initialProject);
  // History for undo/redo (simplified to project snapshots)
  const [history, setHistory] = useState<PixelProject[]>([initialProject]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [currentLayerId, setCurrentLayerId] = useState(initialProject.layers?.[0]?.id || '');
  const [selectedColor, setSelectedColor] = useState('#000000');
  const [secondaryColor, setSecondaryColor] = useState('#ffffff');
  const [activeColorSlot, setActiveColorSlot] = useState<1 | 2>(1);
  const [activePaletteId, setActivePaletteId] = useState<string>(initialProject.palettes?.[0]?.id || '');
  const [tool, setTool] = useState<Tool>('pencil');
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [gridSize, setGridSize] = useState(1);
  const [gridOffsetX, setGridOffsetX] = useState(0);
  const [gridOffsetY, setGridOffsetY] = useState(0);
  const [isMirrorSettingsCollapsed, setIsMirrorSettingsCollapsed] = useState(false);
  const [isGridSettingsCollapsed, setIsGridSettingsCollapsed] = useState(false);
  const [isTiledSettingsCollapsed, setIsTiledSettingsCollapsed] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);

  const [previewSpeed, setPreviewSpeed] = useState(1); // multiplier
  const [isPingPong, setIsPingPong] = useState(false);
  const [isTiledMode, setIsTiledMode] = useState(false);
  const [isMirrorMode, setIsMirrorMode] = useState(false);
  const [mirrorDirection, setMirrorDirection] = useState<'left' | 'right' | 'top' | 'bottom'>('right');
  const [mirrorOpacity, setMirrorOpacity] = useState(0.5);
  const [tiledOpacity, setTiledOpacity] = useState(0.5);
  const [isSeamlessBrush, setIsSeamlessBrush] = useState(true);
  const [visibleTiles, setVisibleTiles] = useState<boolean[]>(Array(9).fill(true));
  const visibleBounds = useMemo(() => {
    if (!isTiledMode) return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 1, height: 1 };
    let minX = 2, maxX = 0, minY = 2, maxY = 0;
    let anyVisible = false;
    visibleTiles.forEach((visible, idx) => {
      if (visible) {
        anyVisible = true;
        const tx = idx % 3;
        const ty = Math.floor(idx / 3);
        minX = Math.min(minX, tx);
        maxX = Math.max(maxX, tx);
        minY = Math.min(minY, ty);
        maxY = Math.max(maxY, ty);
      }
    });
    if (!anyVisible) return { minX: 1, maxX: 1, minY: 1, maxY: 1, width: 1, height: 1 };
    return { minX, maxX, minY, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
  }, [isTiledMode, visibleTiles]);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [showBackConfirm, setShowBackConfirm] = useState(false);
  const [hasUnsavedProjectChanges, setHasUnsavedProjectChanges] = useState(false);
  const [isImportStampModalOpen, setIsImportStampModalOpen] = useState(false);
  const [isColorSettingsOpen, setIsColorSettingsOpen] = useState(false);
  const [magicWandMode, setMagicWandMode] = useState<'connected' | 'all'>('connected');
  const [exportCols, setExportCols] = useState(Math.ceil(Math.sqrt(project.frames.length)));
  const [exportRows, setExportRows] = useState(Math.ceil(project.frames.length / Math.ceil(Math.sqrt(project.frames.length))));
  const [exportPadding, setExportPadding] = useState(0);
  const [exportSpacing, setExportSpacing] = useState(0);
  const [exportFormat, setExportFormat] = useState<'png' | 'jpeg' | 'gif'>('png');
  const [exportSeparateFrames, setExportSeparateFrames] = useState(false);
  const [exportGifSpeed, setExportGifSpeed] = useState(1);
  const [exportGifPreviewFrame, setExportGifPreviewFrame] = useState(0);
  const gifPreviewCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!isExportModalOpen || exportFormat !== 'gif' || project.frames.length <= 1) {
      setExportGifPreviewFrame(0);
      return;
    }
    
    let timeoutId: NodeJS.Timeout;
    let isCancelled = false;
    
    const runAnimation = (frameIndex: number) => {
      if (isCancelled) return;
      setExportGifPreviewFrame(frameIndex);
      
      const nextFrame = (frameIndex + 1) % project.frames.length;
      const currentDuration = (project.frames[frameIndex]?.duration || 200) / exportGifSpeed;
      
      timeoutId = setTimeout(() => {
        runAnimation(nextFrame);
      }, currentDuration);
    };
    
    runAnimation(0);
    
    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [isExportModalOpen, exportFormat, exportGifSpeed, project.frames]);

  // Draw GIF preview to canvas
  useEffect(() => {
    if (!isExportModalOpen || exportFormat !== 'gif') return;
    
    const canvas = gifPreviewCanvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const frame = project.frames[exportGifPreviewFrame] || project.frames[0];
    if (!frame) return;

    canvas.width = project.width + exportPadding * 2;
    canvas.height = project.height + exportPadding * 2;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const reversedLayers = project.layers.slice().reverse();
    reversedLayers.forEach((layer) => {
      if (!layer.isVisible) return;
      
      ctx.save();
      ctx.globalAlpha = layer.opacity;
      const cells = frame.cells[layer.id];
      if (!cells) {
        ctx.restore();
        return;
      }

      for (let i = 0; i < project.width * project.height; i++) {
        const color = cells[i];
        if (!color || color === 'transparent') continue;

        if (layer.clipToBelow) {
          // Simplified clip check for preview
          let hasColorBelow = false;
          const layerIdx = project.layers.findIndex(l => l.id === layer.id);
          for (let j = layerIdx + 1; j < project.layers.length; j++) {
            const belowLayer = project.layers[j];
            if (!belowLayer.isVisible) continue;
            const belowColor = frame.cells[belowLayer.id]?.[i] || 'transparent';
            if (belowColor !== 'transparent') {
              hasColorBelow = true;
              break;
            }
          }
          if (!hasColorBelow) continue;
        }

        const x = exportPadding + (i % project.width);
        const y = exportPadding + Math.floor(i / project.width);
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      }
      ctx.restore();
    });
  }, [isExportModalOpen, exportFormat, exportGifPreviewFrame, project, exportPadding]);

  const [activeRightTab, setActiveRightTab] = useState<'layers' | 'brushes'>('layers');
  const [activeBrushId, setActiveBrushId] = useState<string>('brush-1x1');
  const [activeStampId, setActiveStampId] = useState<string | null>(null);
  const [globalBrushAlignment, setGlobalBrushAlignment] = useState<boolean>(false);
  const [globalAlignmentOffsetX, setGlobalAlignmentOffsetX] = useState<number>(0);
  const [globalAlignmentOffsetY, setGlobalAlignmentOffsetY] = useState<number>(0);
  const [pixelPerfect, setPixelPerfect] = useState<boolean>(false);
  const [tooltip, setTooltip] = useState<{ 
    label: string, 
    description: string, 
    x: number, 
    y: number, 
    align?: 'left' | 'center',
    side?: 'top' | 'bottom' | 'left' | 'right'
  } | null>(null);
  const [isBrushEditorOpen, setIsBrushEditorOpen] = useState(false);
  const [editingBrush, setEditingBrush] = useState<any | null>(null);
  const [paletteSelectionModal, setPaletteSelectionModal] = useState<{ isOpen: boolean, colors: string[], selectedColors?: string[], defaultPaletteName?: string } | null>(null);
  const [importPaletteModal, setImportPaletteModal] = useState(false);
  const [activeBrushFolderId, setActiveBrushFolderId] = useState<string | null>(null);
  const [activeStampFolderId, setActiveStampFolderId] = useState<string | null>(null);
  const [replaceAllFramesAndLayers, setReplaceAllFramesAndLayers] = useState(false);
  const [folderModal, setFolderModal] = useState<{ isOpen: boolean, type: 'brush' | 'stamp', folder?: any } | null>(null);
  const [moveFolderModal, setMoveFolderModal] = useState<{ isOpen: boolean, type: 'brush' | 'stamp', itemId: string } | null>(null);

  useEffect(() => {
    const globalAssets = {
      palettes: project.palettes,
      brushes: project.brushes,
      stamps: project.stamps,
      folders: project.folders,
    };
    localStorage.setItem('pixel_studio_global_assets', JSON.stringify(globalAssets));
  }, [project.palettes, project.brushes, project.stamps, project.folders]);
  const [pasteModal, setPasteModal] = useState<{
    isOpen: boolean;
    image: HTMLImageElement;
    width: number;
    height: number;
  } | null>(null);
  const downloadOfflineVersion = () => {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head><title>ULTRA PIXEL</title></head>
        <body>
          <h1>ULTRA PIXEL</h1>
          <p>This is a simplified offline version of the pixel editor.</p>
          <script>
            console.log("Running offline...");
          </script>
        </body>
      </html>
    `;
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'pixel-editor-offline.html';
    link.click();
  };

  const saveFile = async (blob: Blob, defaultName: string) => {
    const link = document.createElement('a');
    link.download = defaultName;
    link.href = URL.createObjectURL(blob);
    link.click();
    // Clean up object URL
    setTimeout(() => URL.revokeObjectURL(link.href), 100);
  };

  const addStamp = () => {
    if (!selection || !selectionMask) {
      setSaveMessage("Selecione uma área primeiro!");
      setTimeout(() => setSaveMessage(null), 2000);
      return;
    }

    const frame = project.frames[currentFrameIndex] || project.frames[0];
    const currentCells = frame?.cells?.[currentLayerId] || [];
    const stampPixels: string[] = Array(selection.w * selection.h).fill('transparent');

    if (selectedPixels.length > 0) {
      selectedPixels.forEach(p => {
        if (p.x >= 0 && p.x < selection.w && p.y >= 0 && p.y < selection.h) {
          stampPixels[p.y * selection.w + p.x] = p.color;
        }
      });
    } else {
      for (let sy = 0; sy < selection.h; sy++) {
        for (let sx = 0; sx < selection.w; sx++) {
          const canvasX = selection.x + sx;
          const canvasY = selection.y + sy;
          const canvasIdx = canvasY * project.width + canvasX;
          
          if (canvasX >= 0 && canvasX < project.width && canvasY >= 0 && canvasY < project.height) {
            if (selectionMask[canvasIdx]) {
              stampPixels[sy * selection.w + sx] = currentCells[canvasIdx] || 'transparent';
            }
          }
        }
      }
    }

    const newStamp: Stamp = {
      id: Date.now().toString(),
      name: `Estampa ${ (project.stamps?.length || 0) + 1 }`,
      width: selection.w,
      height: selection.h,
      pixels: stampPixels
    };

    const newStamps = [...(project.stamps || []), newStamp];
    const newProject = { ...project, stamps: newStamps };
    setProject(newProject);
    saveToHistory(newProject);
    setActiveStampId(newStamp.id);
    setActiveBrushId('stamp'); // Special ID to indicate we are using a stamp
    setTool('pencil');
    setSaveMessage("Estampa adicionada!");
    setTimeout(() => setSaveMessage(null), 2000);
  };

  const exportStampAsPNG = (stamp: Stamp) => {
    const canvas = document.createElement('canvas');
    canvas.width = stamp.width;
    canvas.height = stamp.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    for (let y = 0; y < stamp.height; y++) {
      for (let x = 0; x < stamp.width; x++) {
        const color = stamp.pixels[y * stamp.width + x];
        if (color !== 'transparent') {
          ctx.fillStyle = color;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }

    const link = document.createElement('a');
    link.download = `${stamp.name}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const importStampFromPNG = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        if (img.width > 256 || img.height > 256) {
          alert(t('imageTooLarge'));
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const pixels: string[] = [];

        for (let i = 0; i < imageData.data.length; i += 4) {
          const r = imageData.data[i];
          const g = imageData.data[i + 1];
          const b = imageData.data[i + 2];
          const a = imageData.data[i + 3];

          if (a === 0) {
            pixels.push('transparent');
          } else {
            pixels.push(`rgba(${r}, ${g}, ${b}, ${a / 255})`);
          }
        }

        const newStamp: Stamp = {
          id: Math.random().toString(36).substring(2, 9),
          name: `Importada ${ (project.stamps?.length || 0) + 1 }`,
          width: img.width,
          height: img.height,
          pixels: pixels
        };

        const newStamps = [...(project.stamps || []), newStamp];
        const newProject = { ...project, stamps: newStamps };
        setProject(newProject);
        saveToHistory(newProject);
        setIsImportStampModalOpen(false);
        setSaveMessage("Estampa importada!");
        setTimeout(() => setSaveMessage(null), 2000);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleExportSpriteSheet = async (cols: number, rows: number) => {
    const canvas = document.createElement('canvas');
    const frameWidth = project.width + exportPadding * 2;
    const frameHeight = project.height + exportPadding * 2;
    
    canvas.width = cols * frameWidth + (cols > 0 ? (cols - 1) * exportSpacing : 0);
    canvas.height = rows * frameHeight + (rows > 0 ? (rows - 1) * exportSpacing : 0);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    project.frames.forEach((frame, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      
      const startX = col * (frameWidth + exportSpacing) + exportPadding;
      const startY = row * (frameHeight + exportSpacing) + exportPadding;
      
      const reversedLayers = project.layers.slice().reverse();
      reversedLayers.forEach((layer, reversedIdx) => {
        ctx.globalAlpha = layer.opacity;
        const cells = frame.cells[layer.id];
        if (!cells || !layer.isVisible) {
          ctx.globalAlpha = 1.0;
          return;
        }
        
        const originalIdx = project.layers.length - 1 - reversedIdx;
        
        cells.forEach((color, i) => {
          if (color === 'transparent') return;
          
          if (layer.clipToBelow) {
            let hasColorBelow = false;
            for (let j = originalIdx + 1; j < project.layers.length; j++) {
              const belowLayer = project.layers[j];
              if (!belowLayer.isVisible) continue;
              const belowColor = frame.cells[belowLayer.id]?.[i] || 'transparent';
              if (belowColor !== 'transparent') {
                hasColorBelow = true;
                break;
              }
            }
            if (!hasColorBelow) return; // Make it transparent
          }

          const x = startX + (i % project.width);
          const y = startY + Math.floor(i / project.width);
          ctx.fillStyle = color;
          ctx.fillRect(x, y, 1, 1);
        });
        ctx.globalAlpha = 1.0;
      });
    });

    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, `image/${exportFormat}`));
    if (blob) {
      await saveFile(blob, `sprite-sheet.${exportFormat}`);
    }
    setIsExportModalOpen(false);
  };

  const handleExport = async () => {
    if (exportSeparateFrames && exportFormat !== 'gif') {
      for (let idx = 0; idx < project.frames.length; idx++) {
        const frame = project.frames[idx];
        const canvas = document.createElement('canvas');
        canvas.width = project.width + exportPadding * 2;
        canvas.height = project.height + exportPadding * 2;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        
        const reversedLayers = project.layers.slice().reverse();
        reversedLayers.forEach((layer, reversedIdx) => {
          ctx.globalAlpha = layer.opacity;
          const cells = frame.cells[layer.id];
          if (!cells || !layer.isVisible) {
            ctx.globalAlpha = 1.0;
            return;
          }
          
          const originalIdx = project.layers.length - 1 - reversedIdx;
          
          cells.forEach((color, i) => {
            if (color === 'transparent') return;
            
            if (layer.clipToBelow) {
              let hasColorBelow = false;
              for (let j = originalIdx + 1; j < project.layers.length; j++) {
                const belowLayer = project.layers[j];
                if (!belowLayer.isVisible) continue;
                const belowColor = frame.cells[belowLayer.id]?.[i] || 'transparent';
                if (belowColor !== 'transparent') {
                  hasColorBelow = true;
                  break;
                }
              }
              if (!hasColorBelow) return; // Make it transparent
            }

            const x = exportPadding + (i % project.width);
            const y = exportPadding + Math.floor(i / project.width);
            ctx.fillStyle = color;
            ctx.fillRect(x, y, 1, 1);
          });
          ctx.globalAlpha = 1.0;
        });
        
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, `image/${exportFormat}`));
        if (blob) {
          await saveFile(blob, `frame_${idx}.${exportFormat}`);
        }
      }
    } else if (exportFormat === 'gif') {
      const gif = GIFEncoder();
      
      for (let idx = 0; idx < project.frames.length; idx++) {
        const frame = project.frames[idx];
        const canvas = document.createElement('canvas');
        canvas.width = project.width + exportPadding * 2;
        canvas.height = project.height + exportPadding * 2;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const reversedLayers = project.layers.slice().reverse();
        reversedLayers.forEach((layer, reversedIdx) => {
          ctx.globalAlpha = layer.opacity;
          const cells = frame.cells[layer.id];
          if (!cells || !layer.isVisible) {
            ctx.globalAlpha = 1.0;
            return;
          }
          
          const originalIdx = project.layers.length - 1 - reversedIdx;
          
          cells.forEach((color, i) => {
            if (color === 'transparent') return;
            
            if (layer.clipToBelow) {
              let hasColorBelow = false;
              for (let j = originalIdx + 1; j < project.layers.length; j++) {
                const belowLayer = project.layers[j];
                if (!belowLayer.isVisible) continue;
                const belowColor = frame.cells[belowLayer.id]?.[i] || 'transparent';
                if (belowColor !== 'transparent') {
                  hasColorBelow = true;
                  break;
                }
              }
              if (!hasColorBelow) return;
            }

            const x = exportPadding + (i % project.width);
            const y = exportPadding + Math.floor(i / project.width);
            ctx.fillStyle = color;
            ctx.fillRect(x, y, 1, 1);
          });
          ctx.globalAlpha = 1.0;
        });
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        const palette = quantize(data, 256, { format: 'rgba4444', clearAlpha: true, clearAlphaThreshold: 0, clearAlphaColor: 0x00 });
        const index = applyPalette(data, palette, 'rgba4444');
        
        let transparentIndex = -1;
        for (let i = 0; i < palette.length; i++) {
          if (palette[i][3] === 0) {
            transparentIndex = i;
            break;
          }
        }
        
        const frameOpts: any = {
          palette,
          delay: (frame.duration || 200) / exportGifSpeed,
        };
        
        if (transparentIndex !== -1) {
          frameOpts.transparent = true;
          frameOpts.transparentIndex = transparentIndex;
        }
        
        gif.writeFrame(index, canvas.width, canvas.height, frameOpts);
      }
      
      gif.finish();
      const buffer = gif.bytes();
      const blob = new Blob([buffer], { type: 'image/gif' });
      await saveFile(blob, `${project.name || 'animation'}.gif`);
    } else {
      await handleExportSpriteSheet(exportCols, exportRows);
    }
    setIsExportModalOpen(false);
  };
  const [hexInput, setHexInput] = useState('#000000');
  const [isResizing, setIsResizing] = useState(false);
  const [resizeWidth, setResizeWidth] = useState(project.width);
  const [resizeHeight, setResizeHeight] = useState(project.height);
  const [activeId, setActiveId] = useState<string | null>(null);
  
  // Panel Resizer States
  const [timelineHeight, setTimelineHeight] = useState(160);
  const [isResizingTimeline, setIsResizingTimeline] = useState(false);

  const [toolsWidth, setToolsWidth] = useState(120);
  const [isResizingTools, setIsResizingTools] = useState(false);

  const [rightPanelWidth, setRightPanelWidth] = useState(600);
  const [isResizingRightPanel, setIsResizingRightPanel] = useState(false);

  const [layersWidth, setLayersWidth] = useState(300);
  const [isResizingLayers, setIsResizingLayers] = useState(false);

  const rotateStamp = (id: string) => {
    const stamp = project.stamps?.find(s => s.id === id);
    if (!stamp) return;
    
    const newWidth = stamp.height;
    const newHeight = stamp.width;
    const newPixels = Array(newWidth * newHeight).fill('transparent');
    
    for (let y = 0; y < stamp.height; y++) {
      for (let x = 0; x < stamp.width; x++) {
        const newX = stamp.height - 1 - y;
        const newY = x;
        newPixels[newY * newWidth + newX] = stamp.pixels[y * stamp.width + x];
      }
    }
    
    const newStamps = project.stamps?.map(s => s.id === id ? { ...s, width: newWidth, height: newHeight, pixels: newPixels } : s) || [];
    const newProject = { ...project, stamps: newStamps };
    setProject(newProject);
    saveToHistory(newProject);
  };

  const flipStamp = (id: string, axis: 'h' | 'v') => {
    const stamp = project.stamps?.find(s => s.id === id);
    if (!stamp) return;
    
    const newPixels = [...stamp.pixels];
    if (axis === 'h') {
      for (let y = 0; y < stamp.height; y++) {
        for (let x = 0; x < Math.floor(stamp.width / 2); x++) {
          const leftIdx = y * stamp.width + x;
          const rightIdx = y * stamp.width + (stamp.width - 1 - x);
          [newPixels[leftIdx], newPixels[rightIdx]] = [newPixels[rightIdx], newPixels[leftIdx]];
        }
      }
    } else {
      for (let y = 0; y < Math.floor(stamp.height / 2); y++) {
        for (let x = 0; x < stamp.width; x++) {
          const topIdx = y * stamp.width + x;
          const bottomIdx = (stamp.height - 1 - y) * stamp.width + x;
          [newPixels[topIdx], newPixels[bottomIdx]] = [newPixels[bottomIdx], newPixels[topIdx]];
        }
      }
    }
    
    const newStamps = project.stamps?.map(s => s.id === id ? { ...s, pixels: newPixels } : s) || [];
    const newProject = { ...project, stamps: newStamps };
    setProject(newProject);
    saveToHistory(newProject);
  };

  const rotateBrush = (id: string) => {
    const brush = project.brushes?.find(b => b.id === id);
    if (!brush) return;
    
    const newWidth = brush.height;
    const newHeight = brush.width;
    const newPixels = Array(newWidth * newHeight).fill(false);
    
    for (let y = 0; y < brush.height; y++) {
      for (let x = 0; x < brush.width; x++) {
        const newX = brush.height - 1 - y;
        const newY = x;
        newPixels[newY * newWidth + newX] = brush.pixels[y * brush.width + x];
      }
    }
    
    const newBrushes = project.brushes?.map(b => b.id === id ? { ...b, width: newWidth, height: newHeight, pixels: newPixels } : b) || [];
    const newProject = { ...project, brushes: newBrushes };
    setProject(newProject);
    saveToHistory(newProject);
  };

  const flipBrush = (id: string, axis: 'h' | 'v') => {
    const brush = project.brushes?.find(b => b.id === id);
    if (!brush) return;
    
    const newPixels = [...brush.pixels];
    if (axis === 'h') {
      for (let y = 0; y < brush.height; y++) {
        for (let x = 0; x < Math.floor(brush.width / 2); x++) {
          const leftIdx = y * brush.width + x;
          const rightIdx = y * brush.width + (brush.width - 1 - x);
          [newPixels[leftIdx], newPixels[rightIdx]] = [newPixels[rightIdx], newPixels[leftIdx]];
        }
      }
    } else {
      for (let y = 0; y < Math.floor(brush.height / 2); y++) {
        for (let x = 0; x < brush.width; x++) {
          const topIdx = y * brush.width + x;
          const bottomIdx = (brush.height - 1 - y) * brush.width + x;
          [newPixels[topIdx], newPixels[bottomIdx]] = [newPixels[bottomIdx], newPixels[topIdx]];
        }
      }
    }
    
    const newBrushes = project.brushes?.map(b => b.id === id ? { ...b, pixels: newPixels } : b) || [];
    const newProject = { ...project, brushes: newBrushes };
    setProject(newProject);
    saveToHistory(newProject);
  };

  const [palettesHeight, setPalettesHeight] = useState(450);
  const [isResizingPalettes, setIsResizingPalettes] = useState(false);
  const [isHarmonyMinimized, setIsHarmonyMinimized] = useState(false);

  // Canvas Resizer States
  const [isResizeMode, setIsResizeMode] = useState(false);
  const [toolsOrder, setToolsOrder] = useState<ToolItem[]>([
    'pencil', 'eraser', 'bucket', 'picker', 'line', 'square', 'circle', 'selection', 'transform', 'magic-wand', 'pixel-outline-pencil', 'conditional-pencil', 'transparent-filler', 'color-replace',
    'transparent'
  ]);
  const [utilityToolsOrder, setUtilityToolsOrder] = useState<ToolItem[]>([
    'transparency-mode', 'grid', 'resize', 'tiled-mode', 'mirror-mode'
  ]);
  const [canvasResizeState, setCanvasResizeState] = useState<{
    edge: 'top' | 'right' | 'bottom' | 'left' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | null;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    currentWidth: number;
    currentHeight: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const handleResizeStart = (e: React.MouseEvent, edge: 'top' | 'right' | 'bottom' | 'left' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right') => {
    e.stopPropagation();
    setCanvasResizeState({
      edge,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: project.width,
      startHeight: project.height,
      currentWidth: project.width,
      currentHeight: project.height,
      offsetX: 0,
      offsetY: 0
    });
  };

  const handleApplyMirror = () => {
    if (['left', 'right'].includes(mirrorDirection) && project.width * 2 > 1024) {
      alert(t('sizeLimitExceeded'));
      return;
    }
    if (['top', 'bottom'].includes(mirrorDirection) && project.height * 2 > 1024) {
      alert(t('sizeLimitExceeded'));
      return;
    }
    setProject(prev => {
      const newWidth = ['left', 'right'].includes(mirrorDirection) ? prev.width * 2 : prev.width;
      const newHeight = ['top', 'bottom'].includes(mirrorDirection) ? prev.height * 2 : prev.height;
      
      const newFrames = prev.frames.map(frame => {
        const newCells: { [layerId: string]: string[] } = {};
        
        Object.keys(frame.cells).forEach(layerId => {
          const originalPixels = frame.cells[layerId];
          const newPixels = new Array(newWidth * newHeight).fill('transparent');
          
          // Copy original pixels
          let offsetX = 0;
          let offsetY = 0;
          if (mirrorDirection === 'left') offsetX = prev.width;
          if (mirrorDirection === 'top') offsetY = prev.height;
          
          for (let y = 0; y < prev.height; y++) {
            for (let x = 0; x < prev.width; x++) {
              const color = originalPixels[y * prev.width + x];
              newPixels[(y + offsetY) * newWidth + (x + offsetX)] = color;
            }
          }
          
          // Copy mirrored pixels
          let mirrorOffsetX = 0;
          let mirrorOffsetY = 0;
          if (mirrorDirection === 'right') mirrorOffsetX = prev.width;
          if (mirrorDirection === 'bottom') mirrorOffsetY = prev.height;
          
          for (let y = 0; y < prev.height; y++) {
            for (let x = 0; x < prev.width; x++) {
              const color = originalPixels[y * prev.width + x];
              
              let targetX = x;
              let targetY = y;
              
              if (['left', 'right'].includes(mirrorDirection)) {
                targetX = prev.width - 1 - x;
              } else {
                targetY = prev.height - 1 - y;
              }
              
              newPixels[(targetY + mirrorOffsetY) * newWidth + (targetX + mirrorOffsetX)] = color;
            }
          }
          
          newCells[layerId] = newPixels;
        });
        
        return { ...frame, cells: newCells };
      });
      
      return {
        ...prev,
        width: newWidth,
        height: newHeight,
        frames: newFrames
      };
    });
    
    setIsMirrorMode(false);
    setHasUnsavedChanges(true);
  };

  const saveToHistory = useCallback((newProject: PixelProject) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newProject);
    if (newHistory.length > 30) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setHasUnsavedProjectChanges(true);
  }, [history, historyIndex]);

  const resizeProject = (newWidth: number, newHeight: number, offsetX: number = 0, offsetY: number = 0) => {
    const newFrames = project.frames.map(frame => {
      const newCells: { [key: string]: string[] } = {};
      Object.entries(frame.cells).forEach(([layerId, data]) => {
        const newData = Array(newWidth * newHeight).fill('transparent');
        for (let y = 0; y < project.height; y++) {
          for (let x = 0; x < project.width; x++) {
            const newX = x + offsetX;
            const newY = y + offsetY;
            if (newX >= 0 && newX < newWidth && newY >= 0 && newY < newHeight) {
              newData[newY * newWidth + newX] = data[y * project.width + x];
            }
          }
        }
        newCells[layerId] = newData;
      });
      return { ...frame, cells: newCells };
    });

    const newProject = {
      ...project,
      width: newWidth,
      height: newHeight,
      frames: newFrames
    };
    setProject(newProject);
    saveToHistory(newProject);
    setIsResizing(false);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingTools) {
        setToolsWidth(Math.max(64, Math.min(300, e.clientX)));
      } else if (isResizingRightPanel) {
        const newWidth = window.innerWidth - e.clientX;
        const clampedNewWidth = Math.max(600, Math.min(window.innerWidth - 100, newWidth));
        setRightPanelWidth(clampedNewWidth);
        setLayersWidth(prev => Math.min(prev, clampedNewWidth - 300));
      } else if (isResizingLayers) {
        // e.clientX is the mouse position. The right panel starts at window.innerWidth - rightPanelWidth.
        // The layers panel width is e.clientX - (window.innerWidth - rightPanelWidth)
        const newWidth = e.clientX - (window.innerWidth - rightPanelWidth);
        setLayersWidth(Math.max(300, Math.min(rightPanelWidth - 300, newWidth)));
      } else if (isResizingPalettes) {
        const newHeight = window.innerHeight - e.clientY - timelineHeight;
        setPalettesHeight(Math.max(150, Math.min(800, newHeight)));
      } else if (isResizingTimeline) {
        const newHeight = window.innerHeight - e.clientY;
        setTimelineHeight(Math.max(160, Math.min(600, newHeight)));
      } else if (canvasResizeState && canvasResizeState.edge) {
        const dx = Math.round((e.clientX - canvasResizeState.startX) / (20 * zoom));
        const dy = Math.round((e.clientY - canvasResizeState.startY) / (20 * zoom));
        
        let newWidth = canvasResizeState.startWidth;
        let newHeight = canvasResizeState.startHeight;
        let offsetX = 0;
        let offsetY = 0;

        if (canvasResizeState.edge.includes('right')) {
          newWidth = Math.min(1024, Math.max(1, canvasResizeState.startWidth + dx));
        }
        if (canvasResizeState.edge.includes('left')) {
          newWidth = Math.min(1024, Math.max(1, canvasResizeState.startWidth - dx));
          offsetX = newWidth - canvasResizeState.startWidth;
        }
        if (canvasResizeState.edge.includes('bottom')) {
          newHeight = Math.min(1024, Math.max(1, canvasResizeState.startHeight + dy));
        }
        if (canvasResizeState.edge.includes('top')) {
          newHeight = Math.min(1024, Math.max(1, canvasResizeState.startHeight - dy));
          offsetY = newHeight - canvasResizeState.startHeight;
        }

        setCanvasResizeState(prev => prev ? { ...prev, currentWidth: newWidth, currentHeight: newHeight, offsetX, offsetY } : null);
      }
    };

    const handleMouseUp = () => {
      setIsResizingTools(false);
      setIsResizingRightPanel(false);
      setIsResizingLayers(false);
      setIsResizingPalettes(false);
      setIsResizingTimeline(false);
      
      if (canvasResizeState) {
        if (canvasResizeState.currentWidth !== canvasResizeState.startWidth || canvasResizeState.currentHeight !== canvasResizeState.startHeight) {
          resizeProject(canvasResizeState.currentWidth, canvasResizeState.currentHeight, canvasResizeState.offsetX, canvasResizeState.offsetY);
        }
        setCanvasResizeState(null);
      }
    };

    if (isResizingTools || isResizingRightPanel || isResizingLayers || isResizingPalettes || isResizingTimeline || canvasResizeState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isResizingTools, isResizingRightPanel, isResizingLayers, isResizingPalettes, isResizingTimeline, canvasResizeState, zoom, rightPanelWidth, timelineHeight]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  const [transparencyMode, setTransparencyMode] = useState<'day' | 'night'>(project.transparencyMode || 'night');
  const [colorOpacity, setColorOpacity] = useState(1);
  const [secondaryColorOpacity, setSecondaryColorOpacity] = useState(1);
  const [opacityInput, setOpacityInput] = useState('100');
  
  const currentHex = activeColorSlot === 1 ? selectedColor : secondaryColor;
  const hsl = useMemo(() => {
    if (currentHex === 'transparent') return { h: 0, s: 0, l: 0 };
    return hexToHsl(currentHex);
  }, [currentHex]);

  const hsv = useMemo(() => {
    return hslToHsv(hsl.h, hsl.s, hsl.l);
  }, [hsl]);

  const handleHslChange = (h: number, s: number, l: number) => {
    const hex = hslToHex(h, s, l);
    if (activeColorSlot === 1) setSelectedColor(hex);
    else setSecondaryColor(hex);
  };

  const rgb = useMemo(() => {
    if (currentHex === 'transparent') return { r: 0, g: 0, b: 0 };
    return hexToRgb(currentHex);
  }, [currentHex]);

  const handleRgbChange = (r: number, g: number, b: number) => {
    const hex = rgbToHex(r, g, b);
    if (activeColorSlot === 1) setSelectedColor(hex);
    else setSecondaryColor(hex);
  };

  const [hoveredPixelIndex, setHoveredPixelIndex] = useState<number | null>(null);
  const [hoveredPixelPos, setHoveredPixelPos] = useState<{ x: number, y: number } | null>(null);
  const [shapeStart, setShapeStart] = useState<{ x: number, y: number } | null>(null);
  const [previewPixels, setPreviewPixels] = useState<number[]>([]);
  const [previewStampCenters, setPreviewStampCenters] = useState<number[]>([]);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setShapeStart(null);
    setPreviewPixels([]);
    setPreviewStampCenters([]);
  }, [tool]);

  const parseColor = (color: string) => {
    if (!color || color === 'transparent') return { hex: '#000000', opacity: 0, isTransparent: true };
    const lowerColor = color.toLowerCase();
    if (lowerColor.startsWith('rgba')) {
      const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/i);
      if (match) {
        const r = parseInt(match[1]).toString(16).padStart(2, '0');
        const g = parseInt(match[2]).toString(16).padStart(2, '0');
        const b = parseInt(match[3]).toString(16).padStart(2, '0');
        const a = match[4] ? parseFloat(match[4]) : 1;
        return { hex: `#${r}${g}${b}`, opacity: a, isTransparent: false };
      }
    }
    return { hex: color, opacity: 1, isTransparent: false };
  };

  const blendColors = (bottomColor: string, topColor: string, bottomLayerOpacity: number, topLayerOpacity: number) => {
    if (topColor === 'transparent' && bottomColor === 'transparent') return 'transparent';
    
    const top = parseColor(topColor);
    const bottom = parseColor(bottomColor);

    const topA = top.isTransparent ? 0 : top.opacity * topLayerOpacity;
    const bottomA = bottom.isTransparent ? 0 : bottom.opacity * bottomLayerOpacity;

    if (topA === 0 && bottomA === 0) return 'transparent';
    if (topA === 0) {
      if (bottomA >= 0.995) return bottom.hex;
      const r = parseInt(bottom.hex.slice(1, 3), 16);
      const g = parseInt(bottom.hex.slice(3, 5), 16);
      const b = parseInt(bottom.hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${Math.round(bottomA * 1000) / 1000})`;
    }
    if (bottomA === 0) {
      if (topA >= 0.995) return top.hex;
      const r = parseInt(top.hex.slice(1, 3), 16);
      const g = parseInt(top.hex.slice(3, 5), 16);
      const b = parseInt(top.hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${Math.round(topA * 1000) / 1000})`;
    }

    const outA = topA + bottomA * (1 - topA);
    if (outA === 0) return 'transparent';

    const topR = parseInt(top.hex.slice(1, 3), 16);
    const topG = parseInt(top.hex.slice(3, 5), 16);
    const topB = parseInt(top.hex.slice(5, 7), 16);

    const bottomR = parseInt(bottom.hex.slice(1, 3), 16);
    const bottomG = parseInt(bottom.hex.slice(3, 5), 16);
    const bottomB = parseInt(bottom.hex.slice(5, 7), 16);

    const outR = Math.round((topR * topA + bottomR * bottomA * (1 - topA)) / outA);
    const outG = Math.round((topG * topA + bottomG * bottomA * (1 - topA)) / outA);
    const outB = Math.round((topB * topA + bottomB * bottomA * (1 - topA)) / outA);

    if (outA >= 0.995) {
      return `#${outR.toString(16).padStart(2, '0')}${outG.toString(16).padStart(2, '0')}${outB.toString(16).padStart(2, '0')}`;
    }
    
    return `rgba(${outR}, ${outG}, ${outB}, ${Math.round(outA * 1000) / 1000})`;
  };

  const getActiveColor = (slot: 1 | 2 = 1) => {
    const color = slot === 1 ? selectedColor : secondaryColor;
    const opacity = slot === 1 ? colorOpacity : secondaryColorOpacity;
    if (color === 'transparent') return 'transparent';
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  const handleSelectColor = (color: string) => {
    if (color === 'transparent') {
      if (activeColorSlot === 1) {
        setSelectedColor('transparent');
        setColorOpacity(0);
      } else {
        setSecondaryColor('transparent');
        setSecondaryColorOpacity(0);
      }
      return;
    }
    const { hex, opacity } = parseColor(color);
    if (activeColorSlot === 1) {
      setSelectedColor(hex);
      setColorOpacity(opacity);
    } else {
      setSecondaryColor(hex);
      setSecondaryColorOpacity(opacity);
    }
  };
  const [isPanning, setIsPanning] = useState(false);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // Selection state
  const [selection, setSelection] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
  const [selectionMask, setSelectionMask] = useState<boolean[] | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ x: number, y: number } | null>(null);
  const [movingSelection, setMovingSelection] = useState(false);
  const moveSelectionDragRef = useRef<{
    startMousePos: { x: number, y: number };
    initialSelection: { x: number, y: number, w: number, h: number };
    initialSelectionMask: boolean[];
  } | null>(null);
  const [selectedPixels, setSelectedPixels] = useState<{ x: number, y: number, color: string }[]>([]);
  const [selectionOrigin, setSelectionOrigin] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
    mask?: boolean[];
  } | null>(null);
  const selectionOriginRef = useRef<{
    x: number;
    y: number;
    w: number;
    h: number;
    mask?: boolean[];
  } | null>(null);
  const [clipboardPixels, setClipboardPixels] = useState<{ pixels: { x: number, y: number, color: string }[], selection: { x: number, y: number, w: number, h: number } } | null>(null);
  const lastCopySource = useRef<'internal' | 'external'>('external');

  // Transform state
  const [transformState, setTransformState] = useState<TransformState | null>(null);
  const [transformDrag, setTransformDrag] = useState<{
    handle: string;
    startX: number;
    startY: number;
    initialState: TransformState;
    initialAngle?: number;
    screenCenterX?: number;
    screenCenterY?: number;
  } | null>(null);

  // Move tool state
  // Removed

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setProject(current => {
        // Keep the current frames list structure, but restore pixel contents for matched frames
        const restoredFrames = current.frames.map(frame => {
          const matchedFrame = prev.frames.find(f => f.id === frame.id);
          if (matchedFrame) {
            return {
              ...frame,
              cells: matchedFrame.cells
            };
          }
          return frame;
        });

        return {
          ...prev,
          frames: restoredFrames,
          brushes: current.brushes,
          stamps: current.stamps,
          folders: current.folders,
          palettes: current.palettes,
          layers: current.layers,
        };
      });
      setHistoryIndex(historyIndex - 1);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setProject(current => {
        // Keep current frames structure, restore pixel contents from 'next' history state
        const restoredFrames = current.frames.map(frame => {
          const matchedFrame = next.frames.find(f => f.id === frame.id);
          if (matchedFrame) {
            return {
              ...frame,
              cells: matchedFrame.cells
            };
          }
          return frame;
        });

        return {
          ...next,
          frames: restoredFrames,
          brushes: current.brushes,
          stamps: current.stamps,
          folders: current.folders,
          palettes: current.palettes,
          layers: current.layers,
        };
      });
      setHistoryIndex(historyIndex + 1);
    }
  }, [history, historyIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (selectedPixels.length > 0 && selection) {
          e.preventDefault();
          setClipboardPixels({ pixels: [...selectedPixels], selection: { ...selection } });
          lastCopySource.current = 'internal';
          
          // Write to system clipboard for external interoperability
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = selection.w;
          tempCanvas.height = selection.h;
          const tempCtx = tempCanvas.getContext('2d');
          if (tempCtx) {
            const imageData = tempCtx.createImageData(selection.w, selection.h);
            // Fill with transparent
            for (let i = 0; i < imageData.data.length; i += 4) {
              imageData.data[i+3] = 0;
            }
            // Draw pixels
            selectedPixels.forEach(p => {
              const { hex, opacity } = parseColor(p.color);
              const r = parseInt(hex.slice(1, 3), 16);
              const g = parseInt(hex.slice(3, 5), 16);
              const b = parseInt(hex.slice(5, 7), 16);
              const idx = (p.y * selection.w + p.x) * 4;
              imageData.data[idx] = r;
              imageData.data[idx+1] = g;
              imageData.data[idx+2] = b;
              imageData.data[idx+3] = Math.round(opacity * 255);
            });
            tempCtx.putImageData(imageData, 0, 0);
            tempCanvas.toBlob(async (blob) => {
              if (blob) {
                try {
                  const data = [new ClipboardItem({ 
                    'image/png': blob,
                    'text/plain': new Blob(['ULTRA_PIXEL_INTERNAL_CLIPBOARD'], { type: 'text/plain' })
                  })];
                  await navigator.clipboard.write(data);
                } catch (err) {
                  // Fallback to just text if writing image fails or is not supported
                  try {
                    await navigator.clipboard.writeText('ULTRA_PIXEL_INTERNAL_CLIPBOARD');
                  } catch (textErr) {
                    console.error('Failed to write to system clipboard:', textErr);
                  }
                }
              }
            });
          }
          
          setSaveMessage('Copiado!');
          setTimeout(() => setSaveMessage(null), 2000);
        } else if (selectionMask && selection) {
          e.preventDefault();
          const pixelsToCopy: { x: number, y: number, color: string }[] = [];
          const frame = project.frames[currentFrameIndex] || project.frames[0];
          const currentCells = frame?.cells?.[currentLayerId] || [];
          for (let sy = selection.y; sy < selection.y + selection.h; sy++) {
            for (let sx = selection.x; sx < selection.x + selection.w; sx++) {
              const idx = sy * project.width + sx;
              if (selectionMask[idx] && currentCells[idx] && currentCells[idx] !== 'transparent') {
                pixelsToCopy.push({ x: sx - selection.x, y: sy - selection.y, color: currentCells[idx] });
              }
            }
          }
          if (pixelsToCopy.length > 0) {
            setClipboardPixels({ pixels: pixelsToCopy, selection: { ...selection } });
            lastCopySource.current = 'internal';
            
            // Write to system clipboard for external interoperability
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = selection.w;
            tempCanvas.height = selection.h;
            const tempCtx = tempCanvas.getContext('2d');
            if (tempCtx) {
              const imageData = tempCtx.createImageData(selection.w, selection.h);
              // Fill with transparent
              for (let i = 0; i < imageData.data.length; i += 4) {
                imageData.data[i+3] = 0;
              }
              // Draw pixels
              pixelsToCopy.forEach(p => {
                const { hex, opacity } = parseColor(p.color);
                const r = parseInt(hex.slice(1, 3), 16);
                const g = parseInt(hex.slice(3, 5), 16);
                const b = parseInt(hex.slice(5, 7), 16);
                const idx = (p.y * selection.w + p.x) * 4;
                imageData.data[idx] = r;
                imageData.data[idx+1] = g;
                imageData.data[idx+2] = b;
                imageData.data[idx+3] = Math.round(opacity * 255);
              });
              tempCtx.putImageData(imageData, 0, 0);
              tempCanvas.toBlob(async (blob) => {
                if (blob) {
                  try {
                    const data = [new ClipboardItem({ 
                      'image/png': blob,
                      'text/plain': new Blob(['ULTRA_PIXEL_INTERNAL_CLIPBOARD'], { type: 'text/plain' })
                    })];
                    await navigator.clipboard.write(data);
                  } catch (err) {
                    // Fallback to just text if writing image fails or is not supported
                    try {
                      await navigator.clipboard.writeText('ULTRA_PIXEL_INTERNAL_CLIPBOARD');
                    } catch (textErr) {
                      console.error('Failed to write to system clipboard:', textErr);
                    }
                  }
                }
              });
            }
            
            setSaveMessage('Copiado!');
            setTimeout(() => setSaveMessage(null), 2000);
          }
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        // We let the browser's 'paste' event handle this to support external pasting.
        // If there's nothing in the system clipboard, handlePaste will fall back to clipboardPixels.
        return;
      }

      if (e.key === 'Escape') {
        if (transformState) {
          cancelTransform();
        } else if (selectionMask || selectedPixels.length > 0 || selection) {
          cancelOrDeselectSelection();
        }
      }

      if (e.key === 'Enter') {
        if (transformState) {
          confirmTransform();
        } else if (selectionMask || selectedPixels.length > 0) {
          if (selectedPixels.length > 0) {
            applySelection();
          }
          setSelection(null);
          setSelectedPixels([]);
          setSelectionMask(null);
          setSelectionOrigin(null);
          selectionOriginRef.current = null;
          setPreviewPixels([]);
          setMovingSelection(false);
          setIsSelecting(false);
          setTooltip(null);
        }
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedPixels.length > 0) {
          setSelection(null);
          setSelectedPixels([]);
          setSelectionMask(null);
          setSelectionOrigin(null);
          selectionOriginRef.current = null;
          setPreviewPixels([]);
          setMovingSelection(false);
          setIsSelecting(false);
          setTooltip(null);
          saveToHistory(project);
        } else if (selectionMask) {
          const newFrames = [...project.frames];
          const newCells = { ...newFrames[currentFrameIndex].cells };
          const newData = [...(newCells[currentLayerId] || Array(project.width * project.height).fill('transparent'))];
          
          let changed = false;
          for (let i = 0; i < newData.length; i++) {
            if (selectionMask[i] && newData[i] !== 'transparent') {
              newData[i] = 'transparent';
              changed = true;
            }
          }
          
          if (changed) {
            newCells[currentLayerId] = newData;
            newFrames[currentFrameIndex] = { ...newFrames[currentFrameIndex], cells: newCells };
            const newProject = { ...project, frames: newFrames };
            setProject(newProject);
            saveToHistory(newProject);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionMask, selectedPixels, project, currentFrameIndex, currentLayerId, saveToHistory, undo, redo, selection, clipboardPixels, transformState]);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (transformDrag) {
        const dx = Math.round((e.clientX - transformDrag.startX) / (20 * zoom) * 2) / 2;
        const dy = Math.round((e.clientY - transformDrag.startY) / (20 * zoom) * 2) / 2;
        
        let { centerX, centerY, w, h, rotation } = transformDrag.initialState;
        
        if (transformDrag.handle === 'move') {
          centerX += dx;
          centerY += dy;
        } else if (transformDrag.handle === 'rotate' && transformDrag.screenCenterX !== undefined && transformDrag.screenCenterY !== undefined && transformDrag.initialAngle !== undefined) {
          const currentAngle = Math.atan2(e.clientY - transformDrag.screenCenterY, e.clientX - transformDrag.screenCenterX) * 180 / Math.PI;
          const deltaAngle = currentAngle - transformDrag.initialAngle;
          rotation = transformDrag.initialState.rotation + deltaAngle;
        } else {
          const rad = rotation * Math.PI / 180;
          const cos = Math.cos(-rad);
          const sin = Math.sin(-rad);
          
          const localDx = dx * cos - dy * sin;
          const localDy = dx * sin + dy * cos;
          
          let deltaW = 0;
          let deltaH = 0;
          let localCenterX = 0;
          let localCenterY = 0;
          
          if (transformDrag.handle.includes('e')) { deltaW = localDx; localCenterX = localDx / 2; }
          if (transformDrag.handle.includes('w')) { deltaW = -localDx; localCenterX = localDx / 2; }
          if (transformDrag.handle.includes('s')) { deltaH = localDy; localCenterY = localDy / 2; }
          if (transformDrag.handle.includes('n')) { deltaH = -localDy; localCenterY = localDy / 2; }
          
          if (w + deltaW < 1) {
            deltaW = 1 - w;
            localCenterX = transformDrag.handle.includes('e') ? deltaW / 2 : -deltaW / 2;
          }
          if (h + deltaH < 1) {
            deltaH = 1 - h;
            localCenterY = transformDrag.handle.includes('s') ? deltaH / 2 : -deltaH / 2;
          }
          
          w += deltaW;
          h += deltaH;
          
          centerX += localCenterX * Math.cos(rad) - localCenterY * Math.sin(rad);
          centerY += localCenterX * Math.sin(rad) + localCenterY * Math.cos(rad);
        }
        
        setTransformState({
          ...transformDrag.initialState,
          centerX, centerY, w, h, rotation
        });
      }
    };

    const handlePointerUp = () => {
      if (transformDrag) {
        setTransformDrag(null);
      }
    };

    if (transformDrag) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [transformDrag, zoom, isTiledMode]);

  const currentFrame = project.frames?.[currentFrameIndex] || project.frames?.[0];
  const currentLayer = project.layers?.find(l => l.id === currentLayerId) || project.layers?.[0];

  useEffect(() => {
    if (!isMouseDown && hasUnsavedChanges) {
      saveToHistory(project);
      setHasUnsavedChanges(false);
    }
  }, [isMouseDown, hasUnsavedChanges, project, saveToHistory]);

  const addToPalette = (paletteId: string, colorsToAdd?: string | string[]) => {
    const colors = Array.isArray(colorsToAdd) ? colorsToAdd : [colorsToAdd || getActiveColor(activeColorSlot)];
    
    setProject(prev => {
      const newPalettes = prev.palettes.map(p => {
        if (p.id === paletteId) {
          // Avoid duplicates if needed? Maybe not.
          return { ...p, colors: [...p.colors, ...colors] };
        }
        return p;
      });
      const newProject = { ...prev, palettes: newPalettes };
      return newProject;
    });
  };

  const removeFromPalette = (paletteId: string, index: number) => {
    const newPalettes = project.palettes.map(p => {
      if (p.id === paletteId) {
        if (p.lockedPaletteIndices?.includes(index)) return p;
        const newColors = [...p.colors];
        newColors.splice(index, 1);
        const newLockedIndices = (p.lockedPaletteIndices || [])
          .filter(i => i !== index)
          .map(i => i > index ? i - 1 : i);
        return { ...p, colors: newColors, lockedPaletteIndices: newLockedIndices };
      }
      return p;
    });
    const newProject = { ...project, palettes: newPalettes };
    setProject(newProject);
  };

  const toggleLockPaletteSlot = (paletteId: string, index: number) => {
    const newPalettes = project.palettes.map(p => {
      if (p.id === paletteId) {
        const lockedIndices = p.lockedPaletteIndices || [];
        const newLockedIndices = lockedIndices.includes(index)
          ? lockedIndices.filter(i => i !== index)
          : [...lockedIndices, index];
        return { ...p, lockedPaletteIndices: newLockedIndices };
      }
      return p;
    });
    const newProject = { ...project, palettes: newPalettes };
    setProject(newProject);
  };

  const renamePalette = (paletteId: string, name: string) => {
    const newPalettes = project.palettes.map(p => {
      if (p.id === paletteId) {
        return { ...p, name };
      }
      return p;
    });
    const newProject = { ...project, palettes: newPalettes };
    setProject(newProject);
  };

  const deletePalette = (paletteId: string) => {
    if (project.palettes.length <= 1) return;
    const newPalettes = project.palettes.filter(p => p.id !== paletteId);
    const newProject = { ...project, palettes: newPalettes };
    setProject(newProject);
  };

  const toggleMinimizePalette = (paletteId: string) => {
    const newPalettes = project.palettes.map(p => {
      if (p.id === paletteId) {
        return { ...p, isMinimized: !p.isMinimized };
      }
      return p;
    });
    const newProject = { ...project, palettes: newPalettes };
    setProject(newProject);
  };

  const createPalette = () => {
    const newPalette: Palette = {
      id: Math.random().toString(36).substring(7),
      name: t('newPalette'),
      colors: [],
      isMinimized: false,
      lockedPaletteIndices: []
    };
    const newProject = { ...project, palettes: [...project.palettes, newPalette] };
    setProject(newProject);
    setActivePaletteId(newPalette.id);
  };

  const extractPaletteFromDrawing = () => {
    const colorSet = new Set<string>();
    project.frames.forEach(frame => {
      Object.values(frame.cells).forEach(pixels => {
        pixels.forEach(color => {
          if (color && color !== 'transparent') {
            const { hex, opacity, isTransparent } = parseColor(color);
            if (!isTransparent) {
              if (opacity === 1) {
                colorSet.add(hex.toLowerCase());
              } else {
                const r = parseInt(hex.slice(1, 3), 16);
                const g = parseInt(hex.slice(3, 5), 16);
                const b = parseInt(hex.slice(5, 7), 16);
                colorSet.add(`rgba(${r}, ${g}, ${b}, ${opacity})`);
              }
            }
          }
        });
      });
    });

    const extractedColors = Array.from(colorSet).slice(0, 255);
    if (extractedColors.length === 0) return;

    const newPalette: Palette = {
      id: `palette-extracted-${Date.now()}`,
      name: t('extractPalette'),
      colors: extractedColors,
      isMinimized: false,
      lockedPaletteIndices: []
    };

    const newProject = { ...project, palettes: [...project.palettes, newPalette] };
    setProject(newProject);
    setActivePaletteId(newPalette.id);
  };

  const replaceColorsByLuminance = (paletteId: string) => {
    const palette = project.palettes.find(p => p.id === paletteId);
    if (!palette || palette.colors.length === 0) return;

    // 1. Get all unique colors in the drawing
    const drawingColorSet = new Set<string>();
    project.frames.forEach(frame => {
      Object.values(frame.cells).forEach(pixels => {
        pixels.forEach(color => {
          if (color && color !== 'transparent') {
            drawingColorSet.add(color);
          }
        });
      });
    });

    const uniqueDrawingColors = Array.from(drawingColorSet);
    if (uniqueDrawingColors.length === 0) return;

    // 2. Helper to get luminance
    const getLuminanceValue = (color: string) => {
      const { hex, opacity, isTransparent } = parseColor(color);
      if (isTransparent) return -1;
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return (0.299 * r + 0.587 * g + 0.114 * b) * opacity;
    };

    // 3. Sort drawing colors by luminance
    const sortedDrawingColors = uniqueDrawingColors.map(color => ({
      color,
      luminance: getLuminanceValue(color)
    })).sort((a, b) => a.luminance - b.luminance);

    // 4. Sort palette colors by luminance
    const sortedPaletteColors = palette.colors.map(color => ({
      color,
      luminance: getLuminanceValue(color)
    })).sort((a, b) => a.luminance - b.luminance);

    // 5. Create mapping
    const colorMap: Record<string, string> = {};
    sortedDrawingColors.forEach((dColor, index) => {
      // Map drawing color to palette color at equivalent percentile
      // This ensures that darker drawing colors map to darker palette colors
      const paletteIndex = Math.round((index / (sortedDrawingColors.length - 1 || 1)) * (sortedPaletteColors.length - 1));
      colorMap[dColor.color] = sortedPaletteColors[paletteIndex].color;
    });

    // 6. Apply mapping to all frames
    const newFrames = project.frames.map(frame => {
      const newCells: Record<string, string[]> = {};
      Object.entries(frame.cells).forEach(([layerId, pixels]) => {
        newCells[layerId] = pixels.map(color => colorMap[color] || color);
      });
      return { ...frame, cells: newCells };
    });

    const newProject = { ...project, frames: newFrames };
    setProject(newProject);
    saveToHistory(newProject);
    setHasUnsavedChanges(true); // Ensure it triggers a save
  };

  const exportPaletteHex = (palette: Palette) => {
    const hexContent = palette.colors.map(c => c.replace(/^#/, '')).join('\n');
    const blob = new Blob([hexContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${palette.name.replace(/\s+/g, '_')}.hex`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importPaletteHex = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.hex';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (!content) return;
        
        // Match hex colors with or without # (e.g., FFFFFF, #FFF, FFFFFFFF)
        const hexRegex = /#?[0-9a-fA-F]{3,8}/g;
        const rawColors = content.match(hexRegex) || [];
        const colors = rawColors.map(c => c.startsWith('#') ? c : `#${c}`);
        
        if (colors.length > 0) {
          const newPaletteName = file.name.replace(/\.hex$/i, '') || 'Paleta Importada';
          setPaletteSelectionModal({
            isOpen: true,
            colors: colors,
            selectedColors: colors,
            defaultPaletteName: newPaletteName
          });
          setImportPaletteModal(false);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const pasteInternal = useCallback(() => {
    if (!clipboardPixels || clipboardPixels.pixels.length === 0) return;
    
    const newLayerId = Math.random().toString(36).substring(7);
    const newLayer: LayerMetadata = {
      id: newLayerId,
      name: `Camada Colada`,
      isVisible: true,
      isLocked: false,
      opacity: 1
    };
    
    // Insert above current layer
    const currentLayerIndex = project.layers.findIndex(l => l.id === currentLayerId);
    const insertIndex = currentLayerIndex >= 0 ? currentLayerIndex : 0;
    const newLayers = [...project.layers];
    newLayers.splice(insertIndex, 0, newLayer);
    
    const newFrames = project.frames.map(frame => {
      const newCells = { ...frame.cells };
      const currentProtoFrame = project.frames[currentFrameIndex] || project.frames[0];
      if (frame.id === currentProtoFrame.id) {
        const newData = Array(project.width * project.height).fill('transparent');
        clipboardPixels.pixels.forEach(p => {
          const targetX = clipboardPixels.selection.x + p.x;
          const targetY = clipboardPixels.selection.y + p.y;
          if (targetX >= 0 && targetX < project.width && targetY >= 0 && targetY < project.height) {
            newData[targetY * project.width + targetX] = p.color;
          }
        });
        newCells[newLayerId] = newData;
      } else {
        newCells[newLayerId] = Array(project.width * project.height).fill('transparent');
      }
      return { ...frame, cells: newCells };
    });
    
    const newProject = { ...project, layers: newLayers, frames: newFrames };
    setProject(newProject);
    setCurrentLayerId(newLayerId);
    saveToHistory(newProject);
    
    setSaveMessage('Colado em nova camada!');
    setTimeout(() => setSaveMessage(null), 2000);
  }, [clipboardPixels, project, currentFrameIndex, currentLayerId, saveToHistory]);

  const pasteImage = useCallback((img: HTMLImageElement, resize: boolean) => {
    const canvas = document.createElement('canvas');
    const w = img.width;
    const h = img.height;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;

    let newWidth = project.width;
    let newHeight = project.height;
    let offsetX = 0;
    let offsetY = 0;

    if (resize) {
      newWidth = Math.min(1024, Math.max(project.width, w));
      newHeight = Math.min(1024, Math.max(project.height, h));
    }

    const id = Math.random().toString(36).substring(7);
    const newLayer: LayerMetadata = {
      id,
      name: `Colagem`,
      isVisible: true,
      opacity: 1,
      isLocked: false
    };

    // Insert above current layer
    const currentIndex = project.layers.findIndex(l => l.id === currentLayerId);
    const newLayers = [...project.layers];
    if (currentIndex !== -1) {
      newLayers.splice(currentIndex, 0, newLayer);
    } else {
      newLayers.unshift(newLayer);
    }

    const newFrames = project.frames.map((frame, fIdx) => {
      const newCells: { [key: string]: string[] } = {};
      
      // Adjust existing layers if resized
      Object.entries(frame.cells).forEach(([layerId, oldData]) => {
        const adjustedData = Array(newWidth * newHeight).fill('transparent');
        for (let y = 0; y < project.height; y++) {
          for (let x = 0; x < project.width; x++) {
            const newX = x + offsetX;
            const newY = y + offsetY;
            if (newX >= 0 && newX < newWidth && newY >= 0 && newY < newHeight) {
              adjustedData[newY * newWidth + newX] = oldData[y * project.width + x];
            }
          }
        }
        newCells[layerId] = adjustedData;
      });

      // Add the new layer with the pasted image
      const layerCells = Array(newWidth * newHeight).fill('transparent');
      if (fIdx === currentFrameIndex) {
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            if (x < newWidth && y < newHeight) {
              const i = (y * w + x) * 4;
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              const a = data[i + 3] / 255;
              if (a > 0) {
                layerCells[y * newWidth + x] = `rgba(${r}, ${g}, ${b}, ${a})`;
              }
            }
          }
        }
      }
      newCells[id] = layerCells;
      return { ...frame, cells: newCells };
    });

    const newProject = {
      ...project,
      width: newWidth,
      height: newHeight,
      layers: newLayers,
      frames: newFrames
    };

    setProject(newProject);
    setCurrentLayerId(id);
    saveToHistory(newProject);
    setPasteModal(null);
  }, [project, currentFrameIndex, currentLayerId, saveToHistory]);

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      const text = e.clipboardData?.getData('text/plain');
      
      let systemImageItem = null;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            systemImageItem = items[i];
            break;
          }
        }
      }

      // Check for internal marker
      const isOurMarker = text === 'ULTRA_PIXEL_INTERNAL_CLIPBOARD';
      
      // If we see a system image that doesn't have our marker, 
      // or if we see new text that isn't our marker, 
      // it means an external copy happened.
      const hasExternalContent = (systemImageItem || (text && text !== '')) && !isOurMarker;
      
      if (hasExternalContent) {
        lastCopySource.current = 'external';
      } else if (isOurMarker) {
        lastCopySource.current = 'internal';
      }

      if (lastCopySource.current === 'internal' && clipboardPixels) {
        pasteInternal();
      } else if (systemImageItem) {
        const blob = systemImageItem.getAsFile();
        if (!blob) return;

        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            if (img.width > 1024 || img.height > 1024) {
              alert(t('sizeLimitExceeded'));
              return;
            }
            if (img.width > project.width || img.height > project.height) {
              setPasteModal({
                isOpen: true,
                image: img,
                width: img.width,
                height: img.height
              });
            } else {
              pasteImage(img, false);
            }
          };
          img.src = event.target?.result as string;
        };
        reader.readAsDataURL(blob);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [project.width, project.height, pasteImage, pasteInternal, clipboardPixels]);

  const handleDragEnd = (event: DragEndEvent, type: 'layers' | 'frames' | 'palette' | 'tools' | 'brushes' | 'stamps') => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    if (type === 'tools') {
      const isUtilityTool = utilityToolsOrder.includes(active.id as ToolItem);
      if (isUtilityTool) {
        setUtilityToolsOrder((items) => {
          const oldIndex = items.indexOf(active.id as ToolItem);
          const newIndex = items.indexOf(over.id as ToolItem);
          if (newIndex === -1) return items;
          const newItems = [...items];
          [newItems[oldIndex], newItems[newIndex]] = [newItems[newIndex], newItems[oldIndex]];
          return newItems;
        });
      } else {
        setToolsOrder((items) => {
          const oldIndex = items.indexOf(active.id as ToolItem);
          const newIndex = items.indexOf(over.id as ToolItem);
          if (newIndex === -1) return items;
          const newItems = [...items];
          [newItems[oldIndex], newItems[newIndex]] = [newItems[newIndex], newItems[oldIndex]];
          return newItems;
        });
      }
      return;
    }

    if (type === 'layers') {
      const oldIndex = project.layers.findIndex(l => l.id === active.id);
      const newIndex = project.layers.findIndex(l => l.id === over.id);
      const newLayers = arrayMove(project.layers, oldIndex, newIndex);
      const newProject = { ...project, layers: newLayers };
      setProject(newProject);
    } else if (type === 'frames') {
      const oldIndex = project.frames.findIndex(f => f.id === active.id);
      const newIndex = project.frames.findIndex(f => f.id === over.id);
      const newFrames = arrayMove(project.frames, oldIndex, newIndex);
      const newProject = { ...project, frames: newFrames };
      setProject(newProject);
      setCurrentFrameIndex(newIndex);
    } else if (type === 'brushes') {
      const brushes = [...(project.brushes || [])];
      const oldIndex = brushes.findIndex(b => b.id === active.id);
      const newIndex = brushes.findIndex(b => b.id === over.id);
      [brushes[oldIndex], brushes[newIndex]] = [brushes[newIndex], brushes[oldIndex]];
      const newProject = { ...project, brushes };
      setProject(newProject);
      saveToHistory(newProject);
    } else if (type === 'stamps') {
      const stamps = [...(project.stamps || [])];
      const oldIndex = stamps.findIndex(s => s.id === active.id);
      const newIndex = stamps.findIndex(s => s.id === over.id);
      [stamps[oldIndex], stamps[newIndex]] = [stamps[newIndex], stamps[oldIndex]];
      const newProject = { ...project, stamps };
      setProject(newProject);
      saveToHistory(newProject);
    } else if (type === 'palette') {
      // Reordering within the same palette only
      const activeId = active.id as string;
      const overId = over.id as string;

      const [activePaletteId, activeIndexStr] = activeId.split(':');
      const [overPaletteId, overIndexStr] = overId.split(':');
      
      if (activePaletteId !== overPaletteId) return; // Only support reordering within the same palette
      
      const activeIndex = parseInt(activeIndexStr);
      const overIndex = parseInt(overIndexStr);
      
      const newPalettes = project.palettes.map(p => {
        if (p.id === activePaletteId) {
          const newColors = [...p.colors];
          [newColors[activeIndex], newColors[overIndex]] = [newColors[overIndex], newColors[activeIndex]];
          
          // Also need to swap locked indices
          let newLockedIndices = (p.lockedPaletteIndices || []).map(idx => {
            if (idx === activeIndex) return overIndex;
            if (idx === overIndex) return activeIndex;
            return idx;
          });
          
          return { ...p, colors: newColors, lockedPaletteIndices: newLockedIndices };
        }
        return p;
      });
      
      const newProject = { ...project, palettes: newPalettes };
      setProject(newProject);
    }
  };

  const brushFolders = project.folders?.filter(f => f.type === 'brush') || [];
  const stampFolders = project.folders?.filter(f => f.type === 'stamp') || [];

  const filteredBrushes = (project.brushes || []).filter(b => activeBrushFolderId === null || b.folderId === activeBrushFolderId);
  const filteredStamps = (project.stamps || []).filter(s => activeStampFolderId === null || s.folderId === activeStampFolderId);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setHexInput(val);
    if (/^#[0-9A-F]{6}$/i.test(val)) {
      if (activeColorSlot === 1) setSelectedColor(val);
      else setSecondaryColor(val);
    }
  };

  useEffect(() => {
    setHexInput(activeColorSlot === 1 ? selectedColor : secondaryColor);
  }, [selectedColor, secondaryColor, activeColorSlot]);

  useEffect(() => {
    setOpacityInput(Math.round((activeColorSlot === 1 ? colorOpacity : secondaryColorOpacity) * 100).toString());
  }, [colorOpacity, secondaryColorOpacity, activeColorSlot]);

  const handleOpacityInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setOpacityInput(val);
    const num = parseFloat(val);
    if (!isNaN(num)) {
      const clamped = Math.max(0, Math.min(100, num));
      if (activeColorSlot === 1) setColorOpacity(clamped / 100);
      else setSecondaryColorOpacity(clamped / 100);
    }
  };

  const getAffectedPixels = (centerIndex: number) => {
    if (activeBrushId === 'brush-1x1') {
      if (selectionMask && !selectionMask[centerIndex]) return [];
      return [centerIndex];
    }
    
    if (activeBrushId === 'stamp') {
      const stamp = project.stamps?.find(s => s.id === activeStampId);
      if (!stamp) {
        if (selectionMask && !selectionMask[centerIndex]) return [];
        return [centerIndex];
      }

      const cx = centerIndex % project.width;
      const cy = Math.floor(centerIndex / project.width);
      const startX = cx - Math.floor(stamp.width / 2);
      const startY = cy - Math.floor(stamp.height / 2);

      const affected: number[] = [];
      for (let sy = 0; sy < stamp.height; sy++) {
        for (let sx = 0; sx < stamp.width; sx++) {
          let px = startX + sx;
          let py = startY + sy;
          
          if (isTiledMode && isSeamlessBrush) {
            px = (px % project.width + project.width) % project.width;
            py = (py % project.height + project.height) % project.height;
          }
          
          if (px >= 0 && px < project.width && py >= 0 && py < project.height) {
            const color = stamp.pixels[sy * stamp.width + sx];
            if (color !== 'transparent') {
              const idx = py * project.width + px;
              if (!selectionMask || selectionMask[idx]) {
                affected.push(idx);
              }
            }
          }
        }
      }
      return affected;
    }

    const brush = project.brushes?.find(b => b.id === activeBrushId);
    if (!brush) {
      if (selectionMask && !selectionMask[centerIndex]) return [];
      return [centerIndex];
    }

    const cx = centerIndex % project.width;
    const cy = Math.floor(centerIndex / project.width);
    const startX = cx - Math.floor(brush.width / 2);
    const startY = cy - Math.floor(brush.height / 2);

    const affected: number[] = [];
    for (let by = 0; by < brush.height; by++) {
      for (let bx = 0; bx < brush.width; bx++) {
        let px = startX + bx;
        let py = startY + by;
        
        if (isTiledMode && isSeamlessBrush) {
          px = (px % project.width + project.width) % project.width;
          py = (py % project.height + project.height) % project.height;
        }
        
        if (px >= 0 && px < project.width && py >= 0 && py < project.height) {
          let isPixelActive = false;
          if (globalBrushAlignment) {
            const globalBx = ((px + globalAlignmentOffsetX) % brush.width + brush.width) % brush.width;
            const globalBy = ((py + globalAlignmentOffsetY) % brush.height + brush.height) % brush.height;
            isPixelActive = brush.pixels[globalBy * brush.width + globalBx];
          } else {
            isPixelActive = brush.pixels[by * brush.width + bx];
          }
          
          if (isPixelActive) {
            const idx = py * project.width + px;
            if (!selectionMask || selectionMask[idx]) {
              affected.push(idx);
            }
          }
        }
      }
    }
    return affected;
  };

  const updatePixel = (index: number) => {
    if (currentLayer.isLocked || !currentLayer.isVisible || currentFrame.isLocked) return;

    const newFrames = [...project.frames];
    const newCells = { ...newFrames[currentFrameIndex].cells };
    const newData = [...(newCells[currentLayerId] || Array(project.width * project.height).fill('transparent'))];
    const activeColor = getActiveColor(activeColorSlot);
    const activeStamp = (activeBrushId === 'stamp' && activeStampId) ? project.stamps?.find(s => s.id === activeStampId) : null;

    if (tool === 'pencil') {
      if (activeStamp) {
        const cx = index % project.width;
        const cy = Math.floor(index / project.width);
        const startX = cx - Math.floor(activeStamp.width / 2);
        const startY = cy - Math.floor(activeStamp.height / 2);
        
        let changed = false;
        for (let sy = 0; sy < activeStamp.height; sy++) {
          for (let sx = 0; sx < activeStamp.width; sx++) {
            let px = startX + sx;
            let py = startY + sy;
            
            if (isTiledMode && isSeamlessBrush) {
              px = (px % project.width + project.width) % project.width;
              py = (py % project.height + project.height) % project.height;
            }
            
            if (px >= 0 && px < project.width && py >= 0 && py < project.height) {
              const idx = py * project.width + px;
              let color;
              if (globalBrushAlignment) {
                const gsx = ((px + globalAlignmentOffsetX) % activeStamp.width + activeStamp.width) % activeStamp.width;
                const gsy = ((py + globalAlignmentOffsetY) % activeStamp.height + activeStamp.height) % activeStamp.height;
                color = activeStamp.pixels[gsy * activeStamp.width + gsx];
              } else {
                color = activeStamp.pixels[sy * activeStamp.width + sx];
              }
              
              if (color !== 'transparent' && newData[idx] !== color && (!selectionMask || selectionMask[idx])) {
                newData[idx] = color;
                changed = true;
              }
            }
          }
        }
        if (!changed) return;
      } else {
        const colorToUse = activeColor;
        const affected = getAffectedPixels(index);
        let changed = false;
        affected.forEach(idx => {
          if (newData[idx] !== colorToUse) {
            newData[idx] = colorToUse;
            changed = true;
          }
        });
        if (!changed) return;
      }
    } else if (tool === 'conditional-pencil') {
      const targetColor = getActiveColor(2);
      let changed = false;
      
      if (activeStamp) {
        const cx = index % project.width;
        const cy = Math.floor(index / project.width);
        const startX = cx - Math.floor(activeStamp.width / 2);
        const startY = cy - Math.floor(activeStamp.height / 2);
        
        for (let sy = 0; sy < activeStamp.height; sy++) {
          for (let sx = 0; sx < activeStamp.width; sx++) {
            let px = startX + sx;
            let py = startY + sy;
            
            if (isTiledMode && isSeamlessBrush) {
              px = (px % project.width + project.width) % project.width;
              py = (py % project.height + project.height) % project.height;
            }
            
            if (px >= 0 && px < project.width && py >= 0 && py < project.height) {
              const idx = py * project.width + px;
              let color;
              if (globalBrushAlignment) {
                const gsx = ((px + globalAlignmentOffsetX) % activeStamp.width + activeStamp.width) % activeStamp.width;
                const gsy = ((py + globalAlignmentOffsetY) % activeStamp.height + activeStamp.height) % activeStamp.height;
                color = activeStamp.pixels[gsy * activeStamp.width + gsx];
              } else {
                color = activeStamp.pixels[sy * activeStamp.width + sx];
              }
              
              if (color !== 'transparent' && newData[idx] === targetColor && newData[idx] !== color && (!selectionMask || selectionMask[idx])) {
                newData[idx] = color;
                changed = true;
              }
            }
          }
        }
      } else {
        const colorToUse = getActiveColor(1);
        const affected = getAffectedPixels(index);
        affected.forEach(idx => {
          if (newData[idx] === targetColor && newData[idx] !== colorToUse) {
            newData[idx] = colorToUse;
            changed = true;
          }
        });
      }
      if (!changed) return;
    } else if (tool === 'pixel-outline-pencil') {
      const secondaryColor = getActiveColor(2);
      const affected = getAffectedPixels(index);
      let changed = false;
      affected.forEach(idx => {
        const currentPixelColor = newData[idx];
        if (currentPixelColor === 'transparent' || currentPixelColor === secondaryColor) {
          // Check neighbors for non-transparency and orthogonal different color
          const cx = idx % project.width;
          const cy = Math.floor(idx / project.width);
          let hasValidOrthogonalNeighbor = false;
          
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              if (Math.abs(dx) + Math.abs(dy) !== 1) continue; // Only horizontal and vertical
              
              const nx = cx + dx;
              const ny = cy + dy;
              if (nx >= 0 && nx < project.width && ny >= 0 && ny < project.height) {
                const neighborColor = newData[ny * project.width + nx];
                // Must be part of the sprite (not transparent) and not the outline color itself
                if (neighborColor !== 'transparent' && neighborColor !== activeColor) {
                  hasValidOrthogonalNeighbor = true;
                  break;
                }
              }
            }
            if (hasValidOrthogonalNeighbor) break;
          }

          if (hasValidOrthogonalNeighbor) {
            if (activeStamp) {
              let color;
              if (globalBrushAlignment) {
                const sx = ((cx + globalAlignmentOffsetX) % activeStamp.width + activeStamp.width) % activeStamp.width;
                const sy = ((cy + globalAlignmentOffsetY) % activeStamp.height + activeStamp.height) % activeStamp.height;
                color = activeStamp.pixels[sy * activeStamp.width + sx];
              } else {
                // For outline tool, "local" alignment is tricky. 
                // We'll use the cursor position as the origin for local alignment.
                const cursorX = index % project.width;
                const cursorY = Math.floor(index / project.width);
                const sx = (cx - cursorX + Math.floor(activeStamp.width / 2)) % activeStamp.width;
                const sy = (cy - cursorY + Math.floor(activeStamp.height / 2)) % activeStamp.height;
                // Handle negative modulo
                const finalSx = sx < 0 ? sx + activeStamp.width : sx;
                const finalSy = sy < 0 ? sy + activeStamp.height : sy;
                color = activeStamp.pixels[finalSy * activeStamp.width + finalSx];
              }
              
              if (color !== 'transparent') {
                newData[idx] = color;
                changed = true;
              }
            } else {
              newData[idx] = activeColor;
              changed = true;
            }
          }
        }
      });
      if (!changed) return;
    } else if (tool === 'eraser') {
      if (activeStamp) {
        const cx = index % project.width;
        const cy = Math.floor(index / project.width);
        const startX = cx - Math.floor(activeStamp.width / 2);
        const startY = cy - Math.floor(activeStamp.height / 2);
        
        let changed = false;
        for (let sy = 0; sy < activeStamp.height; sy++) {
          for (let sx = 0; sx < activeStamp.width; sx++) {
            const px = startX + sx;
            const py = startY + sy;
            if (px >= 0 && px < project.width && py >= 0 && py < project.height) {
              const idx = py * project.width + px;
              let color;
              if (globalBrushAlignment) {
                const gsx = ((px + globalAlignmentOffsetX) % activeStamp.width + activeStamp.width) % activeStamp.width;
                const gsy = ((py + globalAlignmentOffsetY) % activeStamp.height + activeStamp.height) % activeStamp.height;
                color = activeStamp.pixels[gsy * activeStamp.width + gsx];
              } else {
                color = activeStamp.pixels[sy * activeStamp.width + sx];
              }
              
              if (color !== 'transparent' && newData[idx] !== 'transparent' && (!selectionMask || selectionMask[idx])) {
                newData[idx] = 'transparent';
                changed = true;
              }
            }
          }
        }
        if (!changed) return;
      } else {
        const affected = getAffectedPixels(index);
        let changed = false;
        affected.forEach(idx => {
          if (newData[idx] !== 'transparent') {
            newData[idx] = 'transparent';
            changed = true;
          }
        });
        if (!changed) return;
      }
    } else if (tool === 'transparent-filler') {
      let changed = false;
      if (activeStamp) {
        const cx = index % project.width;
        const cy = Math.floor(index / project.width);
        const startX = cx - Math.floor(activeStamp.width / 2);
        const startY = cy - Math.floor(activeStamp.height / 2);
        
        for (let sy = 0; sy < activeStamp.height; sy++) {
          for (let sx = 0; sx < activeStamp.width; sx++) {
            const px = startX + sx;
            const py = startY + sy;
            if (px >= 0 && px < project.width && py >= 0 && py < project.height) {
              const idx = py * project.width + px;
              let color;
              if (globalBrushAlignment) {
                const gsx = ((px + globalAlignmentOffsetX) % activeStamp.width + activeStamp.width) % activeStamp.width;
                const gsy = ((py + globalAlignmentOffsetY) % activeStamp.height + activeStamp.height) % activeStamp.height;
                color = activeStamp.pixels[gsy * activeStamp.width + gsx];
              } else {
                color = activeStamp.pixels[sy * activeStamp.width + sx];
              }
              
              if (color !== 'transparent' && newData[idx] === 'transparent' && (!selectionMask || selectionMask[idx])) {
                newData[idx] = color;
                changed = true;
              }
            }
          }
        }
      } else {
        const affected = getAffectedPixels(index);
        affected.forEach(idx => {
          if (newData[idx] === 'transparent') {
            newData[idx] = activeColor;
            changed = true;
          }
        });
      }
      if (!changed) return;
    } else if (tool === 'bucket') {
      const targetColor = newData[index];
      if (activeStamp) {
        // Tiled fill with stamp
        const fill = (idx: number) => {
          const stack = [idx];
          const visited = new Set();
          const colorToReplace = newData[idx];
          
          while (stack.length > 0) {
            const curr = stack.pop()!;
            if (visited.has(curr)) continue;
            visited.add(curr);
            
            if (newData[curr] === colorToReplace && (!selectionMask || selectionMask[curr])) {
              const x = curr % project.width;
              const y = Math.floor(curr / project.width);
              
              const sx = ((x + globalAlignmentOffsetX) % activeStamp.width + activeStamp.width) % activeStamp.width;
              const sy = ((y + globalAlignmentOffsetY) % activeStamp.height + activeStamp.height) % activeStamp.height;
              const color = activeStamp.pixels[sy * activeStamp.width + sx];
              
              if (color !== 'transparent') {
                newData[curr] = color;
              }
              
              if (x > 0) stack.push(curr - 1);
              if (x < project.width - 1) stack.push(curr + 1);
              if (y > 0) stack.push(curr - project.width);
              if (y < project.height - 1) stack.push(curr + project.width);
            }
          }
        };
        fill(index);
      } else {
        if (targetColor === activeColor) return;
        const brush = project.brushes?.find(b => b.id === activeBrushId);
        
        const fill = (idx: number) => {
          const stack = [idx];
          const visited = new Set();
          const colorToReplace = newData[idx];
          
          while (stack.length > 0) {
            const curr = stack.pop()!;
            if (visited.has(curr)) continue;
            visited.add(curr);
            
            if (newData[curr] === colorToReplace && (!selectionMask || selectionMask[curr])) {
              const x = curr % project.width;
              const y = Math.floor(curr / project.width);
              
              let shouldFill = true;
              if (brush && globalBrushAlignment) {
                const globalBx = ((x + globalAlignmentOffsetX) % brush.width + brush.width) % brush.width;
                const globalBy = ((y + globalAlignmentOffsetY) % brush.height + brush.height) % brush.height;
                shouldFill = brush.pixels[globalBy * brush.width + globalBx];
              }
              
              if (shouldFill) {
                newData[curr] = activeColor;
              }
              
              if (x > 0) stack.push(curr - 1);
              if (x < project.width - 1) stack.push(curr + 1);
              if (y > 0) stack.push(curr - project.width);
              if (y < project.height - 1) stack.push(curr + project.width);
            }
          }
        };
        fill(index);
      }
    } else if (tool === 'picker') {
      if (newData[index] !== 'transparent') {
        handleSelectColor(newData[index]);
        setTool('pencil');
      }
      return;
    } else if (tool === 'color-replace') {
      const targetColor = newData[index];
      
      if (replaceAllFramesAndLayers) {
        const newFrames = project.frames.map(frame => {
          const newCells = { ...frame.cells };
          project.layers.forEach(layer => {
            const cells = newCells[layer.id];
            if (!cells) return;
            const updatedData = cells.map((c, i) => {
              if (c === targetColor) {
                if (activeStamp) {
                  const x = i % project.width;
                  const y = Math.floor(i / project.width);
                  const sx = ((x + globalAlignmentOffsetX) % activeStamp.width + activeStamp.width) % activeStamp.width;
                  const sy = ((y + globalAlignmentOffsetY) % activeStamp.height + activeStamp.height) % activeStamp.height;
                  const color = activeStamp.pixels[sy * activeStamp.width + sx];
                  return color !== 'transparent' ? color : c;
                } else {
                  return activeColor;
                }
              }
              return c;
            });
            newCells[layer.id] = updatedData;
          });
          return { ...frame, cells: newCells };
        });
        const newProject = { ...project, frames: newFrames };
        setProject(newProject);
        saveToHistory(newProject);
        setHasUnsavedChanges(true);
        return;
      }

      if (activeStamp) {
        const updatedData = newData.map((c, i) => {
          if (c === targetColor && (!selectionMask || selectionMask[i])) {
            const x = i % project.width;
            const y = Math.floor(i / project.width);
            const sx = ((x + globalAlignmentOffsetX) % activeStamp.width + activeStamp.width) % activeStamp.width;
            const sy = ((y + globalAlignmentOffsetY) % activeStamp.height + activeStamp.height) % activeStamp.height;
            const color = activeStamp.pixels[sy * activeStamp.width + sx];
            return color !== 'transparent' ? color : c;
          }
          return c;
        });
        newCells[currentLayerId] = updatedData;
      } else {
        if (targetColor === activeColor) return;
        const brush = project.brushes?.find(b => b.id === activeBrushId);
        
        const updatedData = newData.map((c, i) => {
          if (c === targetColor && (!selectionMask || selectionMask[i])) {
            let shouldFill = true;
            if (brush && globalBrushAlignment) {
              const x = i % project.width;
              const y = Math.floor(i / project.width);
              const globalBx = ((x + globalAlignmentOffsetX) % brush.width + brush.width) % brush.width;
              const globalBy = ((y + globalAlignmentOffsetY) % brush.height + brush.height) % brush.height;
              shouldFill = brush.pixels[globalBy * brush.width + globalBx];
            }
            return shouldFill ? activeColor : c;
          }
          return c;
        });
        newCells[currentLayerId] = updatedData;
      }
      newFrames[currentFrameIndex] = { ...newFrames[currentFrameIndex], cells: newCells };
      const newProject = { ...project, frames: newFrames };
      setProject(newProject);
      saveToHistory(newProject);
      setHasUnsavedChanges(true);
      return;
    } else if (tool === 'selection' || tool === 'transform') {
      return;
    }

    newCells[currentLayerId] = newData;
    newFrames[currentFrameIndex] = { ...newFrames[currentFrameIndex], cells: newCells };
    
    const newProject = { ...project, frames: newFrames };
    setProject(newProject);
    setHasUnsavedChanges(true);
  };

  // Layer Management
  const addLayer = () => {
    const id = Math.random().toString(36).substring(7);
    const newLayer: LayerMetadata = {
      id,
      name: `Layer ${project.layers.length + 1}`,
      isVisible: true,
      isLocked: false,
      opacity: 1
    };
    
    const newFrames = project.frames.map(f => ({
      ...f,
      cells: { ...f.cells, [id]: Array(project.width * project.height).fill('transparent') }
    }));

    const newProject = {
      ...project,
      layers: [newLayer, ...project.layers],
      frames: newFrames
    };
    setProject(newProject);
    setCurrentLayerId(id);
  };

  const deleteLayer = (id: string) => {
    if (project.layers.length <= 1) return;
    const newLayers = project.layers.filter(l => l.id !== id);
    const newFrames = project.frames.map(f => {
      const newCells = { ...f.cells };
      delete newCells[id];
      return { ...f, cells: newCells };
    });
    const newProject = { ...project, layers: newLayers, frames: newFrames };
    setProject(newProject);
    if (currentLayerId === id) setCurrentLayerId(newLayers[0].id);
  };

  const updateLayer = (id: string, updates: Partial<LayerMetadata>) => {
    const newLayers = project.layers.map(l => l.id === id ? { ...l, ...updates } : l);
    const newProject = { ...project, layers: newLayers };
    setProject(newProject);
  };

  const moveLayer = (id: string, direction: 'up' | 'down') => {
    const index = project.layers.findIndex(l => l.id === id);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === project.layers.length - 1) return;

    const newLayers = [...project.layers];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newLayers[index], newLayers[targetIndex]] = [newLayers[targetIndex], newLayers[index]];

    const newProject = { ...project, layers: newLayers };
    setProject(newProject);
  };

  const mergeLayerDown = (id: string) => {
    const index = project.layers.findIndex(l => l.id === id);
    if (index === -1 || index === project.layers.length - 1) return;

    const topLayer = project.layers[index];
    const bottomLayer = project.layers[index + 1];

    const newLayers = project.layers.filter(l => l.id !== id);
    const bottomLayerIndex = newLayers.findIndex(l => l.id === bottomLayer.id);
    if (bottomLayerIndex !== -1) {
      newLayers[bottomLayerIndex] = { ...newLayers[bottomLayerIndex], opacity: 1 };
    }

    const newFrames = project.frames.map(f => {
      const topCells = f.cells[topLayer.id];
      const bottomCells = f.cells[bottomLayer.id];
      
      const mergedCells = (bottomCells || Array(project.width * project.height).fill('transparent')).map((bottomColor, i) => {
        const topColor = topCells ? topCells[i] : 'transparent';
        return blendColors(bottomColor, topColor, bottomLayer.opacity, topLayer.opacity);
      });

      const newCells = { ...f.cells };
      newCells[bottomLayer.id] = mergedCells;
      delete newCells[topLayer.id];
      
      return { ...f, cells: newCells };
    });

    const newProject = { ...project, layers: newLayers, frames: newFrames };
    setProject(newProject);
    if (currentLayerId === id) setCurrentLayerId(bottomLayer.id);
    saveToHistory(newProject);
  };

  const mergeAllLayers = () => {
    if (project.layers.length <= 1) return;

    const bottomLayer = project.layers[project.layers.length - 1];
    const newLayers = [{ ...bottomLayer, name: 'Camada Mesclada', opacity: 1 }];

    const newFrames = project.frames.map(f => {
      let mergedCells = (f.cells[bottomLayer.id] || Array(project.width * project.height).fill('transparent')).map(c => blendColors('transparent', c, 1, bottomLayer.opacity));
      
      // Iterate from second to last layer up to the first layer (top layer is index 0)
      for (let i = project.layers.length - 2; i >= 0; i--) {
        const layer = project.layers[i];
        const layerCells = f.cells[layer.id] || Array(project.width * project.height).fill('transparent');
        
        mergedCells = mergedCells.map((bottomColor, j) => {
          const topColor = layerCells[j];
          return blendColors(bottomColor, topColor, 1, layer.opacity);
        });
      }

      return { ...f, cells: { [bottomLayer.id]: mergedCells } };
    });

    const newProject = { ...project, layers: newLayers, frames: newFrames };
    setProject(newProject);
    setCurrentLayerId(bottomLayer.id);
    saveToHistory(newProject);
  };

  const toggleOnionSkin = (index: number) => {
    const newFrames = [...project.frames];
    newFrames[index] = { ...newFrames[index], onionSkin: !newFrames[index].onionSkin };
    const newProject = { ...project, frames: newFrames };
    setProject(newProject);
  };

  const toggleFrameLock = (index: number) => {
    const newFrames = [...project.frames];
    newFrames[index] = { ...newFrames[index], isLocked: !newFrames[index].isLocked };
    const newProject = { ...project, frames: newFrames };
    setProject(newProject);
  };

  // Frame Management
  const addFrame = () => {
    const id = Math.random().toString(36).substring(7);
    const newCells: { [key: string]: string[] } = {};
    project.layers.forEach(l => {
      newCells[l.id] = Array(project.width * project.height).fill('transparent');
    });
    const newFrame: Frame = { id, cells: newCells };
    const newProject = { ...project, frames: [...project.frames, newFrame] };
    setProject(newProject);
    setCurrentFrameIndex(newProject.frames.length - 1);
  };

  const deleteFrame = (index: number) => {
    if (project.frames.length <= 1) return;
    if (project.frames[index].isLocked) return;
    const newFrames = project.frames.filter((_, i) => i !== index);
    const newProject = { ...project, frames: newFrames };
    setProject(newProject);
    setCurrentFrameIndex(Math.min(currentFrameIndex, newFrames.length - 1));
  };

  const duplicateFrame = (index: number) => {
    const frameToDuplicate = project.frames[index];
    const id = Math.random().toString(36).substring(7);
    
    // Deep copy cells to avoid shared state
    const newCells: { [key: string]: string[] } = {};
    Object.keys(frameToDuplicate.cells).forEach(layerId => {
      newCells[layerId] = [...frameToDuplicate.cells[layerId]];
    });

    const newFrame: Frame = { 
      ...frameToDuplicate, 
      id, 
      cells: newCells,
      isLocked: false,
      onionSkin: false
    };
    const newFrames = [...project.frames];
    newFrames.splice(index + 1, 0, newFrame);
    const newProject = { ...project, frames: newFrames };
    setProject(newProject);
    setCurrentFrameIndex(index + 1);
  };

  const updateFrameDuration = (index: number, duration: number) => {
    const newFrames = [...project.frames];
    newFrames[index] = { ...newFrames[index], duration };
    const newProject = { ...project, frames: newFrames };
    setProject(newProject);
  };


  const getMagicSelectionPixels = (index: number) => {
    const currentCells = currentFrame.cells[currentLayerId] || Array(project.width * project.height).fill('transparent');
    const targetColor = currentCells[index];
    const pixels: Set<number> = new Set();
    
    if (magicWandMode === 'all') {
      currentCells.forEach((color: string, idx: number) => {
        if (color === targetColor) {
          pixels.add(idx);
        }
      });
    } else {
      const queue: number[] = [index];
      const visited: Set<number> = new Set();

      while (queue.length > 0) {
        const currentIdx = queue.shift()!;
        if (visited.has(currentIdx)) continue;
        visited.add(currentIdx);

        const cx = currentIdx % project.width;
        const cy = Math.floor(currentIdx / project.width);

        if (currentCells[currentIdx] === targetColor) {
          pixels.add(currentIdx);

          // Neighbors (4-connectivity)
          const neighbors = [
            [cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]
          ];

          for (const [nx, ny] of neighbors) {
            if (nx >= 0 && nx < project.width && ny >= 0 && ny < project.height) {
              const nIdx = ny * project.width + nx;
              if (!visited.has(nIdx)) {
                queue.push(nIdx);
              }
            }
          }
        }
      }
    }
    return Array.from(pixels);
  };

  const getLinePoints = (x0: number, y0: number, x1: number, y1: number) => {
    const points: {x: number, y: number}[] = [];
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = (x0 < x1) ? 1 : -1;
    const sy = (y0 < y1) ? 1 : -1;

    if (pixelPerfect) {
      // Snap to perfect slope (identical blocks)
      // This ensures that every "step" of the line has the exact same number of pixels.
      if (dx >= dy) {
        const numSegments = dy + 1;
        const L = Math.max(1, Math.round((dx + 1) / numSegments));
        for (let j = 0; j < numSegments; j++) {
          for (let i = 0; i < L; i++) {
            points.push({ x: x0 + (j * L + i) * sx, y: y0 + j * sy });
          }
        }
      } else {
        const numSegments = dx + 1;
        const L = Math.max(1, Math.round((dy + 1) / numSegments));
        for (let i = 0; i < numSegments; i++) {
          for (let j = 0; j < L; j++) {
            points.push({ x: x0 + i * sx, y: y0 + (i * L + j) * sy });
          }
        }
      }
      return points;
    }

    // Standard Bresenham
    let x = x0;
    let y = y0;
    let err = dx - dy;
    while (true) {
      points.push({ x, y });
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
    return points;
  };

  const getSquarePoints = (x0: number, y0: number, x1: number, y1: number) => {
    if (pixelPerfect) {
      const dx = Math.abs(x1 - x0);
      const dy = Math.abs(y1 - y0);
      const side = Math.max(dx, dy);
      x1 = x0 + (x1 >= x0 ? side : -side);
      y1 = y0 + (y1 >= y0 ? side : -side);
    }
    const points: {x: number, y: number}[] = [];
    const minX = Math.min(x0, x1);
    const maxX = Math.max(x0, x1);
    const minY = Math.min(y0, y1);
    const maxY = Math.max(y0, y1);

    for (let x = minX; x <= maxX; x++) {
      points.push({ x, y: minY });
      points.push({ x, y: maxY });
    }
    for (let y = minY + 1; y < maxY; y++) {
      points.push({ x: minX, y });
      points.push({ x: maxX, y });
    }
    return points;
  };

  const getCirclePoints = (x0: number, y0: number, x1: number, y1: number) => {
    if (pixelPerfect) {
      const dx = Math.abs(x1 - x0);
      const dy = Math.abs(y1 - y0);
      const side = Math.max(dx, dy);
      x1 = x0 + (x1 >= x0 ? side : -side);
      y1 = y0 + (y1 >= y0 ? side : -side);
    }
    const points: {x: number, y: number}[] = [];
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const rx = Math.abs(x1 - x0) / 2;
    const ry = Math.abs(y1 - y0) / 2;

    let x = 0;
    let y = Math.round(ry);
    let rx2 = rx * rx;
    let ry2 = ry * ry;
    let p = Math.round(ry2 - rx2 * ry + 0.25 * rx2);
    let px = 0;
    let py = 2 * rx2 * y;

    const addPoints = (px: number, py: number) => {
      points.push({ x: Math.round(cx + px), y: Math.round(cy + py) });
      points.push({ x: Math.round(cx - px), y: Math.round(cy + py) });
      points.push({ x: Math.round(cx + px), y: Math.round(cy - py) });
      points.push({ x: Math.round(cx - px), y: Math.round(cy - py) });
    };

    while (px < py) {
      addPoints(x, y);
      x++;
      px += 2 * ry2;
      if (p < 0) p += ry2 + px;
      else {
        y--;
        py -= 2 * rx2;
        p += ry2 + px - py;
      }
    }
    
    p = Math.round(ry2 * (x + 0.5) ** 2 + rx2 * (y - 1) ** 2 - rx2 * ry2);
    while (y >= 0) {
      addPoints(x, y);
      y--;
      py -= 2 * rx2;
      if (p > 0) p += rx2 - py;
      else {
        x++;
        px += 2 * ry2;
        p += rx2 - py + px;
      }
    }
    return points;
  };

  const getLinePixels = (x0: number, y0: number, x1: number, y1: number) => {
    const pixels: Set<number> = new Set();
    const points = getLinePoints(x0, y0, x1, y1);
    points.forEach(p => {
      if (p.x >= 0 && p.x < project.width && p.y >= 0 && p.y < project.height) {
        getAffectedPixels(p.y * project.width + p.x).forEach(idx => pixels.add(idx));
      }
    });
    return Array.from(pixels);
  };

  const getSquarePixels = (x0: number, y0: number, x1: number, y1: number) => {
    const pixels: Set<number> = new Set();
    const points = getSquarePoints(x0, y0, x1, y1);
    points.forEach(p => {
      if (p.x >= 0 && p.x < project.width && p.y >= 0 && p.y < project.height) {
        getAffectedPixels(p.y * project.width + p.x).forEach(idx => pixels.add(idx));
      }
    });
    return Array.from(pixels);
  };

  const getCirclePixels = (x0: number, y0: number, x1: number, y1: number) => {
    const pixels: Set<number> = new Set();
    const points = getCirclePoints(x0, y0, x1, y1);
    points.forEach(p => {
      if (p.x >= 0 && p.x < project.width && p.y >= 0 && p.y < project.height) {
        getAffectedPixels(p.y * project.width + p.x).forEach(idx => pixels.add(idx));
      }
    });
    return Array.from(pixels);
  };

  const handlePixelInteraction = (index: number, isShiftPressed: boolean = false) => {
    const x = index % project.width;
    const y = Math.floor(index / project.width);

    if (tool === 'transform') {
      if (!transformState) {
        setSelectionStart({ x, y });
        setHoveredPixelPos({ x, y });
        setIsSelecting(true);
        setPreviewPixels([y * project.width + x]);
      }
    } else if (tool === 'selection') {
      const isInside = selectionMask && selectionMask[index];
      
      // Check if clicking inside existing selection to move it
      if (isInside) {
        setMovingSelection(true);
        setSelectionStart({ x, y });
        setHoveredPixelPos({ x, y });
        
        // If we haven't captured pixels yet, do it now
        if (selectedPixels.length === 0 && selection) {
          detachSelection();
        }

        if (!selectionOriginRef.current && selection) {
          const originData = {
            ...selection,
            mask: selectionMask ? [...selectionMask] : undefined
          };
          setSelectionOrigin(originData);
          selectionOriginRef.current = originData;
        }

        if (selection && selectionMask) {
          moveSelectionDragRef.current = {
            startMousePos: { x, y },
            initialSelection: { ...selection },
            initialSelectionMask: [...selectionMask]
          };
        }
      } else {
        // Start new selection part
        setSelectionStart({ x, y });
        setHoveredPixelPos({ x, y });
        setIsSelecting(true);
        setPreviewPixels([y * project.width + x]);
        
        if (!selectionMask || !isShiftPressed) {
          // If Shift is not pressed, clear the previous selection
          if (selectedPixels.length > 0) {
            applySelection();
          }
          setSelectionMask(Array(project.width * project.height).fill(false));
          setSelectedPixels([]);
          setSelectionOrigin(null);
          selectionOriginRef.current = null;
        }
      }
    } else if (tool === 'magic-wand') {
      if (selectedPixels.length > 0 && !isShiftPressed) {
        applySelection();
      }
      
      const pixels = getMagicSelectionPixels(index);
      const newMask = (selectionMask && isShiftPressed) ? [...selectionMask] : Array(project.width * project.height).fill(false);
      
      pixels.forEach(idx => {
        newMask[idx] = true;
      });
      
      setSelectionMask(newMask);
      
      // Update bounding box
      let minX = project.width, minY = project.height, maxX = -1, maxY = -1;
      let hasPixels = false;
      for (let i = 0; i < newMask.length; i++) {
        if (newMask[i]) {
          const px = i % project.width;
          const py = Math.floor(i / project.width);
          minX = Math.min(minX, px);
          minY = Math.min(minY, py);
          maxX = Math.max(maxX, px);
          maxY = Math.max(maxY, py);
          hasPixels = true;
        }
      }
      if (hasPixels) {
        const newSel = {
          x: minX,
          y: minY,
          w: maxX - minX + 1,
          h: maxY - minY + 1
        };
        setSelection(newSel);
        const originData = {
          ...newSel,
          mask: [...newMask]
        };
        setSelectionOrigin(originData);
        selectionOriginRef.current = originData;
      }
    } else if (['line', 'square', 'circle'].includes(tool)) {
      setShapeStart({ x, y });
      setPreviewPixels(getAffectedPixels(index));
      if (activeBrushId === 'stamp') {
        setPreviewStampCenters([index]);
      }
    } else {
      updatePixel(index);
      if (['pencil', 'eraser', 'conditional-pencil', 'transparent-filler', 'pixel-outline-pencil', 'color-replace'].includes(tool)) {
        setPreviewPixels(getAffectedPixels(index));
      }
    }
  };

  const handlePixelEnter = (index: number, isShiftPressed: boolean = false) => {
    setHoveredPixelIndex(index);
    const x = index % project.width;
    const y = Math.floor(index / project.width);

    if ((tool === 'selection' || tool === 'transform') && selectionStart) {
      if (isSelecting) {
        // Skip setPreviewPixels for selection creation to improve performance
        // The UI will draw the rectangle based on selectionStart and hoveredPixelIndex
        if (previewPixels.length > 0) setPreviewPixels([]);
      }
    } else if (isMouseDown) {
      if (['line', 'square', 'circle'].includes(tool) && shapeStart) {
        let pixels: number[] = [];
        let points: {x: number, y: number}[] = [];
        if (tool === 'line') {
          pixels = getLinePixels(shapeStart.x, shapeStart.y, x, y);
          points = getLinePoints(shapeStart.x, shapeStart.y, x, y);
        } else if (tool === 'square') {
          pixels = getSquarePixels(shapeStart.x, shapeStart.y, x, y);
          points = getSquarePoints(shapeStart.x, shapeStart.y, x, y);
        } else if (tool === 'circle') {
          pixels = getCirclePixels(shapeStart.x, shapeStart.y, x, y);
          points = getCirclePoints(shapeStart.x, shapeStart.y, x, y);
        }
        setPreviewPixels(pixels);
        if (activeBrushId === 'stamp') {
          setPreviewStampCenters(points.map(p => p.y * project.width + p.x));
        } else {
          setPreviewStampCenters([]);
        }
      } else {
        updatePixel(index);
        if (['pencil', 'eraser', 'conditional-pencil', 'transparent-filler', 'pixel-outline-pencil', 'color-replace'].includes(tool)) {
          setPreviewPixels(getAffectedPixels(index));
        }
      }
    } else {
      if (['pencil', 'eraser', 'conditional-pencil', 'transparent-filler', 'pixel-outline-pencil', 'color-replace'].includes(tool)) {
        setPreviewPixels(getAffectedPixels(index));
      } else {
        setPreviewPixels([]);
      }
    }
  };

  const handleMouseUp = () => {
    setIsMouseDown(false);
    if (isMouseDown && ['line', 'square', 'circle'].includes(tool) && previewPixels.length > 0) {
      const newFrames = [...project.frames];
      const newCells = { ...newFrames[currentFrameIndex].cells };
      const newData = [...(newCells[currentLayerId] || Array(project.width * project.height).fill('transparent'))];
      const activeColor = getActiveColor(activeColorSlot);

      if (activeBrushId === 'stamp' && activeStampId) {
        const stamp = project.stamps?.find(s => s.id === activeStampId);
        if (stamp) {
          const x = hoveredPixelIndex! % project.width;
          const y = Math.floor(hoveredPixelIndex! / project.width);
          let points: {x: number, y: number}[] = [];
          if (tool === 'line') points = getLinePoints(shapeStart!.x, shapeStart!.y, x, y);
          else if (tool === 'square') points = getSquarePoints(shapeStart!.x, shapeStart!.y, x, y);
          else if (tool === 'circle') points = getCirclePoints(shapeStart!.x, shapeStart!.y, x, y);
          
          points.forEach(p => {
            const startX = p.x - Math.floor(stamp.width / 2);
            const startY = p.y - Math.floor(stamp.height / 2);
            for (let sy = 0; sy < stamp.height; sy++) {
              for (let sx = 0; sx < stamp.width; sx++) {
                const px = startX + sx;
                const py = startY + sy;
                if (px >= 0 && px < project.width && py >= 0 && py < project.height) {
                  const idx = py * project.width + px;
                  const color = stamp.pixels[sy * stamp.width + sx];
                  if (color !== 'transparent' && (!selectionMask || selectionMask[idx])) {
                    newData[idx] = tool === 'eraser' ? 'transparent' : color;
                  }
                }
              }
            }
          });
        }
      } else {
        previewPixels.forEach(idx => {
          newData[idx] = activeColor;
        });
      }

      newCells[currentLayerId] = newData;
      newFrames[currentFrameIndex] = { ...newFrames[currentFrameIndex], cells: newCells };
      const newProject = { ...project, frames: newFrames };
      setProject(newProject);
      saveToHistory(newProject);
    }

    if (isSelecting && (tool === 'selection' || tool === 'transform')) {
      let currentPreview: number[] = [];
      
      // Calculate clamped selection rect based on selectionStart and hoveredPixelPos
      if (selectionStart && hoveredPixelPos) {
        const x = Math.max(0, Math.min(project.width - 1, hoveredPixelPos.x));
        const y = Math.max(0, Math.min(project.height - 1, hoveredPixelPos.y));
        const startXClamped = Math.max(0, Math.min(project.width - 1, selectionStart.x));
        const startYClamped = Math.max(0, Math.min(project.height - 1, selectionStart.y));
        const minX = Math.min(x, startXClamped);
        const minY = Math.min(y, startYClamped);
        const maxX = Math.max(x, startXClamped);
        const maxY = Math.max(y, startYClamped);
        
        for (let sy = minY; sy <= maxY; sy++) {
          for (let sx = minX; sx <= maxX; sx++) {
            currentPreview.push(sy * project.width + sx);
          }
        }
      } else if (previewPixels.length > 0) {
        currentPreview = [...previewPixels];
      }

      if (tool === 'transform' && currentPreview.length > 0) {
        const minX = Math.min(...currentPreview.map(p => p % project.width));
        const minY = Math.min(...currentPreview.map(p => Math.floor(p / project.width)));
        const maxX = Math.max(...currentPreview.map(p => p % project.width));
        const maxY = Math.max(...currentPreview.map(p => Math.floor(p / project.width)));
        const w = maxX - minX + 1;
        const h = maxY - minY + 1;
        
        const frame = project.frames[currentFrameIndex] || project.frames[0];
        const currentCells = frame?.cells?.[currentLayerId] || Array(project.width * project.height).fill('transparent');
        const capturedPixels: { x: number, y: number, color: string }[] = [];
        
        for (let sy = minY; sy <= maxY; sy++) {
          for (let sx = minX; sx <= maxX; sx++) {
            const idx = sy * project.width + sx;
            if (currentCells[idx] && currentCells[idx] !== 'transparent') {
              capturedPixels.push({ x: sx - minX, y: sy - minY, color: currentCells[idx] });
            }
          }
        }
        
        if (capturedPixels.length > 0) {
          setTransformState({
            pixels: capturedPixels,
            originalW: w,
            originalH: h,
            centerX: minX + w / 2,
            centerY: minY + h / 2,
            w: w,
            h: h,
            rotation: 0,
            originalLayerData: [...currentCells]
          });
          
          // Remove from current layer
          const newFrames = [...project.frames];
          const newCells = { ...newFrames[currentFrameIndex].cells };
          const newData = [...currentCells];
          for (let sy = minY; sy <= maxY; sy++) {
            for (let sx = minX; sx <= maxX; sx++) {
              newData[sy * project.width + sx] = 'transparent';
            }
          }
          newCells[currentLayerId] = newData;
          newFrames[currentFrameIndex] = { ...newFrames[currentFrameIndex], cells: newCells };
          setProject({ ...project, frames: newFrames });
        }
      } else if (tool === 'selection' && currentPreview.length > 0) {
        // If we already have selected pixels (detached), we should commit them first
        if (selectedPixels.length > 0) {
          applySelection();
        }

        const newMask = selectionMask ? [...selectionMask] : Array(project.width * project.height).fill(false);
        currentPreview.forEach(idx => {
          newMask[idx] = true;
        });
        setSelectionMask(newMask);

        // Update bounding box
        let minX = project.width, minY = project.height, maxX = -1, maxY = -1;
        let hasPixels = false;
        for (let i = 0; i < newMask.length; i++) {
          if (newMask[i]) {
            const x = i % project.width;
            const y = Math.floor(i / project.width);
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
            hasPixels = true;
          }
        }
        if (hasPixels) {
          const newSel = {
            x: minX,
            y: minY,
            w: maxX - minX + 1,
            h: maxY - minY + 1
          };
          setSelection(newSel);
          const originData = {
            ...newSel,
            mask: [...newMask]
          };
          setSelectionOrigin(originData);
          selectionOriginRef.current = originData;
        }
      }
      
      setIsSelecting(false);
      setSelectionStart(null);
      setPreviewPixels([]);
    }

    setIsMouseDown(false);
    setIsSelecting(false);
    setMovingSelection(false);
    moveSelectionDragRef.current = null;
    setIsPanning(false);
    setShapeStart(null);
    setPreviewPixels([]);
    setPreviewStampCenters([]);
  };

  const handleWorkspaceMouseDown = (e: React.MouseEvent) => {
    if (e.button === 2) { // Right click
      e.preventDefault();
      setIsPanning(true);
    }
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isPanning) {
        setPan(prev => ({
          x: prev.x + e.movementX,
          y: prev.y + e.movementY
        }));
      }
    };

    const handleGlobalMouseUp = () => {
      setIsPanning(false);
    };

    if (isPanning) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isPanning]);

  useEffect(() => {
    if (!isSelecting && !movingSelection) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      const canvasEl = canvasContainerRef.current;
      if (!canvasEl) return;
      const rect = canvasEl.getBoundingClientRect();
      const canvasWidth = isTiledMode ? (selection ? selection.w * visibleBounds.width : project.width * visibleBounds.width) : (isMirrorMode && ['left', 'right'].includes(mirrorDirection) ? project.width * 2 : project.width);
      const canvasHeight = isTiledMode ? (selection ? selection.h * visibleBounds.height : project.height * visibleBounds.height) : (isMirrorMode && ['top', 'bottom'].includes(mirrorDirection) ? project.height * 2 : project.height);

      const x = Math.floor((e.clientX - rect.left) / (rect.width / canvasWidth));
      const y = Math.floor((e.clientY - rect.top) / (rect.height / canvasHeight));

      let localX = x;
      let localY = y;
      
      if (isTiledMode) {
        const tileW = selection ? selection.w : project.width;
        const tileH = selection ? selection.h : project.height;
        const absX = x + visibleBounds.minX * tileW;
        const absY = y + visibleBounds.minY * tileH;
        localX = absX - tileW;
        localY = absY - tileH;
      } else if (isMirrorMode) {
        if (mirrorDirection === 'left') localX = x - project.width;
        if (mirrorDirection === 'top') localY = y - project.height;
      }

      setHoveredPixelPos({ x: localX, y: localY });
      if (localX >= 0 && localX < project.width && localY >= 0 && localY < project.height) {
        setHoveredPixelIndex(localY * project.width + localX);
      } else {
        setHoveredPixelIndex(null);
      }

      if (movingSelection) {
        if (!moveSelectionDragRef.current && selection && selectionMask) {
          moveSelectionDragRef.current = {
            startMousePos: { x: localX, y: localY },
            initialSelection: { ...selection },
            initialSelectionMask: [...selectionMask]
          };
        }

        if (moveSelectionDragRef.current) {
          const { startMousePos, initialSelection, initialSelectionMask } = moveSelectionDragRef.current;
          const totalDx = localX - startMousePos.x;
          const totalDy = localY - startMousePos.y;

          setSelection({
            ...initialSelection,
            x: initialSelection.x + totalDx,
            y: initialSelection.y + totalDy
          });

          const newMask = Array(project.width * project.height).fill(false);
          for (let i = 0; i < initialSelectionMask.length; i++) {
            if (initialSelectionMask[i]) {
              const oldX = i % project.width;
              const oldY = Math.floor(i / project.width);
              const newX = oldX + totalDx;
              const newY = oldY + totalDy;
              if (newX >= 0 && newX < project.width && newY >= 0 && newY < project.height) {
                newMask[newY * project.width + newX] = true;
              }
            }
          }
          setSelectionMask(newMask);
        }
      }
    };

    const handleWindowMouseUp = () => {
      handleMouseUp();
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSelecting, movingSelection, isTiledMode, isMirrorMode, mirrorDirection, visibleBounds, project.width, project.height, selection, selectionMask, selectionStart]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.1, Math.min(10, prev * delta)));
  };

  const detachSelection = () => {
    if (!selection || !selectionMask || selectedPixels.length > 0) return;

    if (!selectionOriginRef.current) {
      const originData = {
        ...selection,
        mask: [...selectionMask]
      };
      setSelectionOrigin(originData);
      selectionOriginRef.current = originData;
    }

    const pixels: { x: number, y: number, color: string }[] = [];
    const currentCells = currentFrame.cells[currentLayerId] || Array(project.width * project.height).fill('transparent');
    const newData = [...currentCells];

    for (let sy = selection.y; sy < selection.y + selection.h; sy++) {
      for (let sx = selection.x; sx < selection.x + selection.w; sx++) {
        const idx = sy * project.width + sx;
        if (selectionMask[idx]) {
          pixels.push({ x: sx - selection.x, y: sy - selection.y, color: currentCells[idx] });
          newData[idx] = 'transparent';
        }
      }
    }

    setSelectedPixels(pixels);

    const newFrames = project.frames.map((f, idx) => {
      const newCells = { ...f.cells };
      if (idx === currentFrameIndex) {
        newCells[currentLayerId] = newData;
      }
      return { ...f, cells: newCells };
    });

    const newProject = {
      ...project,
      frames: newFrames
    };

    setProject(newProject);
    saveToHistory(newProject);
  };

  const cancelTransform = () => {
    if (!transformState) return;
    const newFrames = [...project.frames];
    const newCells = { ...newFrames[currentFrameIndex].cells };
    newCells[currentLayerId] = transformState.originalLayerData;
    newFrames[currentFrameIndex] = { ...newFrames[currentFrameIndex], cells: newCells };
    setProject({ ...project, frames: newFrames });
    setTransformState(null);
    setTransformDrag(null);
    setTooltip(null);
  };

  const confirmTransform = () => {
    if (!transformState) return;
    
    const rad = transformState.rotation * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    
    const corners = [
      { x: -transformState.w / 2, y: -transformState.h / 2 },
      { x: transformState.w / 2, y: -transformState.h / 2 },
      { x: transformState.w / 2, y: transformState.h / 2 },
      { x: -transformState.w / 2, y: transformState.h / 2 }
    ];
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    corners.forEach(c => {
      const rx = c.x * cos - c.y * sin;
      const ry = c.x * sin + c.y * cos;
      const tx = rx + transformState.centerX;
      const ty = ry + transformState.centerY;
      minX = Math.min(minX, tx);
      minY = Math.min(minY, ty);
      maxX = Math.max(maxX, tx);
      maxY = Math.max(maxY, ty);
    });
    
    const startX = Math.floor(minX);
    const startY = Math.floor(minY);
    const endX = Math.ceil(maxX);
    const endY = Math.ceil(maxY);
    
    const newFrames = project.frames.map(frame => {
      const newCells = { ...frame.cells };
      const currentProtoFrame = project.frames[currentFrameIndex] || project.frames[0];
      if (frame.id === currentProtoFrame.id) {
        const newData = [...(newCells[currentLayerId] || Array(project.width * project.height).fill('transparent'))];
        
        for (let y = startY; y <= endY; y++) {
          for (let x = startX; x <= endX; x++) {
            if (x >= 0 && x < project.width && y >= 0 && y < project.height) {
              const dx = x - transformState.centerX + 0.5;
              const dy = y - transformState.centerY + 0.5;
              
              const rx = dx * cos + dy * sin;
              const ry = -dx * sin + dy * cos;
              
              const sx = rx / (transformState.w / transformState.originalW);
              const sy = ry / (transformState.h / transformState.originalH);
              
              const ox = Math.floor(sx + transformState.originalW / 2);
              const oy = Math.floor(sy + transformState.originalH / 2);
              
              if (ox >= 0 && ox < transformState.originalW && oy >= 0 && oy < transformState.originalH) {
                const pixel = transformState.pixels.find(p => p.x === ox && p.y === oy);
                if (pixel) {
                  newData[y * project.width + x] = pixel.color;
                }
              }
            }
          }
        }
        newCells[currentLayerId] = newData;
      }
      return { ...frame, cells: newCells };
    });
    
    const newProject = { ...project, frames: newFrames };
    setProject(newProject);
    saveToHistory(newProject);
    setTransformState(null);
    setTransformDrag(null);
    setTooltip(null);
    setSaveMessage('Transformação aplicada!');
    setTimeout(() => setSaveMessage(null), 2000);
  };

  const applySelection = () => {
    if (!selection || selectedPixels.length === 0 || !selectionMask) {
      setSelection(null);
      setSelectedPixels([]);
      setSelectionMask(null);
      setSelectionOrigin(null);
      selectionOriginRef.current = null;
      setTooltip(null);
      return;
    }

    const currentCells = currentFrame.cells[currentLayerId] || Array(project.width * project.height).fill('transparent');
    const newData = [...currentCells];
    
    // Apply selected pixels to their new positions
    selectedPixels.forEach(p => {
      const targetX = selection.x + p.x;
      const targetY = selection.y + p.y;
      if (targetX >= 0 && targetX < project.width && targetY >= 0 && targetY < project.height) {
        const idx = targetY * project.width + targetX;
        if (p.color !== 'transparent') {
          newData[idx] = p.color;
        }
      }
    });

    const newFrames = [...project.frames];
    newFrames[currentFrameIndex] = {
      ...currentFrame,
      cells: { ...currentFrame.cells, [currentLayerId]: newData }
    };
    const newProject = { ...project, frames: newFrames };
    setProject(newProject);
    saveToHistory(newProject);
    
    setSelection(null);
    setSelectedPixels([]);
    setSelectionMask(null);
    setSelectionOrigin(null);
    selectionOriginRef.current = null;
    setPreviewPixels([]);
    setMovingSelection(false);
    setIsSelecting(false);
    setTooltip(null);
  };

  const cancelOrDeselectSelection = () => {
    const origin = selectionOriginRef.current || selectionOrigin;
    const hasMoved = selection && origin && (selection.x !== origin.x || selection.y !== origin.y);

    if (hasMoved && selection && origin) {
      const origX = origin.x;
      const origY = origin.y;

      const restoredSelection = {
        ...selection,
        x: origX,
        y: origY
      };

      setSelection(restoredSelection);

      // Reconstruct mask at the original position
      const newMask = Array(project.width * project.height).fill(false);
      if (selectedPixels.length > 0) {
        selectedPixels.forEach(p => {
          const tx = origX + p.x;
          const ty = origY + p.y;
          if (tx >= 0 && tx < project.width && ty >= 0 && ty < project.height) {
            newMask[ty * project.width + tx] = true;
          }
        });
      } else if (origin.mask) {
        for (let i = 0; i < origin.mask.length; i++) {
          if (origin.mask[i]) newMask[i] = true;
        }
      }
      setSelectionMask(newMask);

      setMovingSelection(false);
      moveSelectionDragRef.current = null;
      setPreviewPixels([]);
      setTooltip(null);
    } else {
      if (selectedPixels.length > 0) {
        applySelection();
      } else {
        setSelection(null);
        setSelectedPixels([]);
        setSelectionMask(null);
        setSelectionOrigin(null);
        selectionOriginRef.current = null;
        setPreviewPixels([]);
        setMovingSelection(false);
        setIsSelecting(false);
        setTooltip(null);
      }
    }
  };

  const cropProject = () => {
    if (!selection) return;

    // If we have floating pixels, apply them first
    let currentProject = project;
    if (selectedPixels.length > 0) {
      const currentCells = currentFrame.cells[currentLayerId] || Array(project.width * project.height).fill('transparent');
      const newData = [...currentCells];
      
      selectedPixels.forEach(p => {
        const targetX = selection.x + p.x;
        const targetY = selection.y + p.y;
        if (targetX >= 0 && targetX < project.width && targetY >= 0 && targetY < project.height && p.color !== 'transparent') {
          newData[targetY * project.width + targetX] = p.color;
        }
      });

      const newFrames = [...project.frames];
      newFrames[currentFrameIndex] = {
        ...currentFrame,
        cells: { ...currentFrame.cells, [currentLayerId]: newData }
      };
      currentProject = { ...project, frames: newFrames };
    }

    const { x, y, w, h } = selection;
    const newFrames = currentProject.frames.map(frame => {
      const newCells: { [key: string]: string[] } = {};
      Object.entries(frame.cells).forEach(([layerId, cells]) => {
        const newLayerCells = new Array(w * h).fill('transparent');
        for (let sy = 0; sy < h; sy++) {
          for (let sx = 0; sx < w; sx++) {
            const oldX = x + sx;
            const oldY = y + sy;
            if (oldX >= 0 && oldX < currentProject.width && oldY >= 0 && oldY < currentProject.height) {
              const oldIdx = oldY * currentProject.width + oldX;
              // Only keep pixels that are in the selection mask
              if (!selectionMask || selectionMask[oldIdx]) {
                newLayerCells[sy * w + sx] = cells[oldIdx];
              }
            }
          }
        }
        newCells[layerId] = newLayerCells;
      });
      return { ...frame, cells: newCells };
    });

    const newProject = {
      ...currentProject,
      width: w,
      height: h,
      frames: newFrames
    };

    setProject(newProject);
    saveToHistory(newProject);
    setSelection(null);
    setSelectedPixels([]);
    setSelectionMask(null);
    setSelectionOrigin(null);
    selectionOriginRef.current = null;
    setPreviewPixels([]);
    setMovingSelection(false);
    setIsSelecting(false);
  };

  const handleExportUltrapixel = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(project));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${project.name || 'projeto'}.ultrapixel`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleSave = () => {
    onSave(project);
    setSaveMessage('Projeto salvo com sucesso!');
    setHasUnsavedProjectChanges(false);
    setTimeout(() => setSaveMessage(null), 3000);
  };

  return (
    <div className={cn("flex flex-col h-[100dvh] overflow-hidden bg-[#1a1a1a] text-white select-none cursor-default")}>
      {saveMessage && (
        <div className="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-[99999999]">
          {saveMessage}
        </div>
      )}
      {/* Header */}
      <header className={cn("relative flex items-center justify-between px-6 py-3 border-b z-[999999] bg-[#1a1a1a] border-white/10")}>
        <div className="flex items-center gap-4">
          <div className="text-lg font-black tracking-tighter text-white mr-4">
            ULTRA<span className="text-yellow-400">PIXEL</span>
          </div>

          <div className="flex flex-col items-start mr-4">
            <h1 className="text-sm font-bold">{project.name}</h1>
            <p className="text-[10px] text-white/40 uppercase tracking-widest">
              {project.width}x{project.height} px
            </p>
          </div>

          <button 
            onClick={() => {
              if (hasUnsavedProjectChanges) {
                setShowBackConfirm(true);
              } else {
                onBack();
              }
            }} 
            onMouseEnter={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setTooltip({ label: t('back'), description: t('backDesc'), x: rect.left + rect.width / 2, y: rect.bottom, side: 'bottom', align: 'center' });
            }}
            onMouseLeave={() => setTooltip(null)}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 border-r border-white/10 pr-2 mr-2">
            <button 
              onClick={handleExportUltrapixel} 
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setTooltip({ label: t('saveProject'), description: t('saveProjectTooltip'), x: rect.left + rect.width / 2, y: rect.bottom, side: 'bottom', align: 'center' });
              }}
              onMouseLeave={() => setTooltip(null)}
              className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-medium transition-all"
            >
              <Download className="w-4 h-4" />
              Salvar .ultrapixel
            </button>
          </div>

          <button 
            onClick={undo} 
            disabled={historyIndex === 0} 
            onMouseEnter={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setTooltip({ label: t('undo'), description: t('undoDesc'), x: rect.left + rect.width / 2, y: rect.bottom, side: 'bottom', align: 'center' });
            }}
            onMouseLeave={() => setTooltip(null)}
            className="p-2 hover:bg-white/5 disabled:opacity-30 rounded-lg"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          
          <button 
            onClick={redo} 
            disabled={historyIndex === history.length - 1} 
            onMouseEnter={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setTooltip({ label: t('redo'), description: t('redoDesc'), x: rect.left + rect.width / 2, y: rect.bottom, side: 'bottom', align: 'center' });
            }}
            onMouseLeave={() => setTooltip(null)}
            className="p-2 hover:bg-white/5 disabled:opacity-30 rounded-lg"
          >
            <Redo2 className="w-4 h-4" />
          </button>
          
          <div className="w-px h-4 bg-white/10 mx-2" />
          
          <button 
            onClick={() => {
              const cols = Math.ceil(Math.sqrt(project.frames.length));
              const rows = Math.ceil(project.frames.length / cols);
              setExportCols(cols);
              setExportRows(rows);
              setIsExportModalOpen(true);
            }} 
            onMouseEnter={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setTooltip({ label: t('export'), description: t('exportDesc'), x: rect.left + rect.width / 2, y: rect.bottom, side: 'bottom', align: 'center' });
            }}
            onMouseLeave={() => setTooltip(null)}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-medium transition-all"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          
          <button 
            onClick={handleSave} 
            onMouseEnter={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setTooltip({ label: t('save'), description: t('saveDesc'), x: rect.left + rect.width / 2, y: rect.bottom, side: 'bottom', align: 'center' });
            }}
            onMouseLeave={() => setTooltip(null)}
            className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-bold transition-all shadow-lg shadow-blue-600/20"
          >
            <Save className="w-4 h-4" />
            Save
          </button>
        </div>
      </header>
      
      {showBackConfirm && (
        <div className="fixed inset-0 z-[9999999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="p-6 rounded-xl w-[400px] border flex flex-col gap-6 bg-[#1a1a1a] border-white/10 shadow-2xl">
            <div className="space-y-2 text-center">
              <h2 className="text-xl font-bold text-white">Salvar alterações?</h2>
              <p className="text-sm text-white/60">
                Você tem alterações não salvas. Deseja salvar antes de sair?
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button 
                onClick={() => {
                  handleSave();
                  setShowBackConfirm(false);
                  onBack();
                }}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium transition-colors"
              >
                Salvar e Sair
              </button>
              <button 
                onClick={() => {
                  setShowBackConfirm(false);
                  onBack();
                }}
                className="w-full py-2 bg-red-600/20 hover:bg-red-600/40 text-red-500 rounded font-medium transition-colors"
              >
                Sair sem Salvar
              </button>
              <button 
                onClick={() => setShowBackConfirm(false)}
                className="w-full py-2 bg-white/5 hover:bg-white/10 text-white rounded font-medium transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {isExportModalOpen && (
        <div className="fixed inset-0 z-[9999999] flex items-center justify-center bg-black/50">
          <div className={cn("p-6 rounded-xl w-[600px] border flex gap-6 bg-[#1a1a1a] border-white/10")}>
            <div className="flex-1 space-y-4">
              <h2 className="text-lg font-bold mb-4">{t('export')}</h2>
              <label className="block text-sm">
                Formato:
                <select value={exportFormat} onChange={e => setExportFormat(e.target.value as any)} className={cn("w-full p-2 rounded mt-1 bg-black/40 border border-white/10 focus:border-blue-500 focus:outline-none transition-colors")}>
                  <option value="png">PNG</option>
                  <option value="jpeg">JPEG</option>
                  <option value="gif">GIF</option>
                </select>
              </label>
              {exportFormat !== 'gif' && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={exportSeparateFrames} onChange={e => setExportSeparateFrames(e.target.checked)} />
                  Exportar frames como arquivos separados
                </label>
              )}
              {exportFormat !== 'gif' && !exportSeparateFrames && (
                <>
                  <label className="block text-sm">
                    Colunas:
                    <input type="number" value={exportCols} onChange={e => setExportCols(Math.max(1, parseInt(e.target.value) || 1))} className={cn("w-full p-2 rounded mt-1 bg-black/40 border border-white/10 focus:border-blue-500 focus:outline-none transition-colors")} />
                  </label>
                  <label className="block text-sm">
                    Rows:
                    <input type="number" value={exportRows} onChange={e => setExportRows(Math.max(1, parseInt(e.target.value) || 1))} className={cn("w-full p-2 rounded mt-1 bg-black/40 border border-white/10 focus:border-blue-500 focus:outline-none transition-colors")} />
                  </label>
                  <label className="block text-sm">
                    Padding (Margem Interna):
                    <input type="number" value={exportPadding} onChange={e => setExportPadding(Math.max(0, parseInt(e.target.value) || 0))} className={cn("w-full p-2 rounded mt-1 bg-black/40 border border-white/10 focus:border-blue-500 focus:outline-none transition-colors")} />
                  </label>
                  <label className="block text-sm">
                    Spacing (Espaçamento):
                    <input type="number" value={exportSpacing} onChange={e => setExportSpacing(Math.max(0, parseInt(e.target.value) || 0))} className={cn("w-full p-2 rounded mt-1 bg-black/40 border border-white/10 focus:border-blue-500 focus:outline-none transition-colors")} />
                  </label>
                </>
              )}
              {exportFormat === 'gif' && (
                <label className="block text-sm">
                  Velocidade da Animação:
                  <div className="flex items-center gap-2 mt-1">
                    <input 
                      type="range" 
                      min="0.1" 
                      max="5" 
                      step="0.1" 
                      value={exportGifSpeed} 
                      onChange={e => setExportGifSpeed(parseFloat(e.target.value))} 
                      className="flex-1"
                    />
                    <span className="text-xs font-mono w-8 text-right">{exportGifSpeed.toFixed(1)}x</span>
                  </div>
                </label>
              )}
              <div className="flex justify-end gap-2 mt-6">
                <button onClick={() => setIsExportModalOpen(false)} className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded">{t('cancel')}</button>
                <button onClick={() => handleExport()} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded">{t('export')}</button>
              </div>
            </div>
            <div className="w-64 bg-black/40 rounded p-2 flex items-center justify-center overflow-hidden">
              {exportFormat === 'gif' ? (
                <div 
                  className="relative border border-white/10 w-full overflow-hidden"
                  style={{ aspectRatio: `${project.width + exportPadding * 2} / ${project.height + exportPadding * 2}` }}
                >
                  <Checkerboard mode={transparencyMode} />
                  <canvas
                    ref={gifPreviewCanvasRef}
                    width={project.width + exportPadding * 2}
                    height={project.height + exportPadding * 2}
                    className="absolute inset-0 w-full h-full z-10"
                    style={{ imageRendering: 'pixelated' }}
                  />
                </div>
              ) : (
                <div 
                  className="grid border border-white/10"
                  style={{ 
                    gridTemplateColumns: `repeat(${exportCols}, 1fr)`,
                    width: '100%',
                    gap: `${exportSpacing}px`,
                    backgroundColor: exportSpacing > 0 ? 'rgba(255,255,255,0.1)' : 'transparent'
                  }}
                >
                  {Array.from({ length: exportCols * exportRows }).map((_, i) => {
                    const frame = project.frames[i];
                    if (!frame) return (
                      <div 
                        key={`export-frame-empty-${i}`} 
                        className="bg-white/5 border border-white/10" 
                        style={{ aspectRatio: `${project.width + exportPadding * 2} / ${project.height + exportPadding * 2}` }} 
                      />
                    );
                    
                    return (
                      <div 
                        key={`export-frame-${i}`} 
                        className="relative border border-white/10 flex items-center justify-center overflow-hidden"
                        style={{ 
                          aspectRatio: `${project.width + exportPadding * 2} / ${project.height + exportPadding * 2}`,
                          padding: `${(exportPadding / (project.width + exportPadding * 2)) * 100}%`
                        }}
                      >
                        <Checkerboard mode={transparencyMode} />
                        <div className="w-full h-full relative z-10">
                          {project.layers.slice().reverse().map((layer, reversedIdx) => {
                            if (!layer.isVisible) return null;
                            const originalIdx = project.layers.length - 1 - reversedIdx;
                            return (
                              <div 
                                key={layer.id}
                                className="absolute inset-0 grid"
                                style={{ 
                                  gridTemplateColumns: `repeat(${project.width}, 1fr)`,
                                  opacity: layer.opacity
                                }}
                              >
                                {Array.from({ length: project.width * project.height }).map((_, cellI) => {
                                  let color = frame.cells[layer.id]?.[cellI] || 'transparent';
                                  
                                  if (color !== 'transparent' && layer.clipToBelow) {
                                    let hasColorBelow = false;
                                    for (let j = originalIdx + 1; j < project.layers.length; j++) {
                                      const belowLayer = project.layers[j];
                                      if (!belowLayer.isVisible) continue;
                                      const belowColor = frame.cells[belowLayer.id]?.[cellI] || 'transparent';
                                      if (belowColor !== 'transparent') {
                                        hasColorBelow = true;
                                        break;
                                      }
                                    }
                                    if (!hasColorBelow) color = 'transparent';
                                  }
                                  
                                  return <div key={cellI} style={{ backgroundColor: color === 'transparent' ? 'transparent' : color }} />;
                                })}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isColorSettingsOpen && (
        <div className="fixed inset-0 z-[9999999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-[750px] flex overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            {/* Left Column: Visual Picker */}
            <div className="w-[350px] p-6 border-r border-white/10 space-y-6 bg-black/20">
              <div className="space-y-4">
                <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
                  <div className="w-1 h-3 bg-blue-500 rounded-full" />
                  Seletor Visual
                </h3>
                <SaturationBrightnessPicker 
                  h={hsl.h} 
                  s={hsv.s} 
                  v={hsv.v} 
                  onChange={(s, v) => {
                    const newHsl = hsvToHsl(hsl.h, s, v);
                    handleHslChange(newHsl.h, newHsl.s, newHsl.l);
                  }} 
                />
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-mono text-white/40">
                    <span>{t('hue')}</span>
                    <span>{Math.round(hsl.h)}°</span>
                  </div>
                  <HuePicker 
                    h={hsl.h} 
                    onChange={(h) => handleHslChange(h, hsl.s, hsl.l)} 
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{t('preview')}</span>
                  <span className="text-[10px] font-mono text-blue-400">{currentHex}</span>
                </div>
                <div className="h-12 rounded-lg border border-white/10 relative overflow-hidden shadow-inner">
                  <Checkerboard mode={transparencyMode} />
                  <div className="absolute inset-0" style={{ backgroundColor: currentHex }} />
                </div>
              </div>
            </div>

            {/* Right Column: Precise Controls */}
            <div className="flex-1 flex flex-col">
              <div className="p-4 border-b border-white/10 flex items-center justify-between bg-[#1a1a1a]">
                <h2 className="text-sm font-bold uppercase tracking-widest text-white/80">{t('colorConfig')}</h2>
              </div>
              
              <div className="p-6 space-y-8 overflow-y-auto max-h-[500px]">
                {/* Hex Input */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{t('hexCode')}</span>
                  <input 
                    type="text"
                    value={hexInput}
                    onChange={handleHexChange}
                    className="w-full bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-sm font-mono focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>

                {/* RGB Sliders */}
                <div className="space-y-4">
                  <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-1 h-3 bg-red-500 rounded-full" />
                    Canais RGB
                  </h3>
                  <div className="space-y-3">
                    {/* Red */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-mono text-white/60">
                        <span>{t('red')}</span>
                        <span>{rgb.r}</span>
                      </div>
                      <input 
                        type="range" min="0" max="255" value={rgb.r}
                        onChange={(e) => handleRgbChange(parseInt(e.target.value), rgb.g, rgb.b)}
                        className="w-full h-1.5 bg-black/40 rounded-full appearance-none cursor-pointer accent-red-500"
                        style={{ background: `linear-gradient(to right, ${rgbToHex(0, rgb.g, rgb.b)}, ${rgbToHex(255, rgb.g, rgb.b)})` }}
                      />
                    </div>
                    {/* Green */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-mono text-white/60">
                        <span>{t('green')}</span>
                        <span>{rgb.g}</span>
                      </div>
                      <input 
                        type="range" min="0" max="255" value={rgb.g}
                        onChange={(e) => handleRgbChange(rgb.r, parseInt(e.target.value), rgb.b)}
                        className="w-full h-1.5 bg-black/40 rounded-full appearance-none cursor-pointer accent-green-500"
                        style={{ background: `linear-gradient(to right, ${rgbToHex(rgb.r, 0, rgb.b)}, ${rgbToHex(rgb.r, 255, rgb.b)})` }}
                      />
                    </div>
                    {/* Blue */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-mono text-white/60">
                        <span>{t('blue')}</span>
                        <span>{rgb.b}</span>
                      </div>
                      <input 
                        type="range" min="0" max="255" value={rgb.b}
                        onChange={(e) => handleRgbChange(rgb.r, rgb.g, parseInt(e.target.value))}
                        className="w-full h-1.5 bg-black/40 rounded-full appearance-none cursor-pointer accent-blue-500"
                        style={{ background: `linear-gradient(to right, ${rgbToHex(rgb.r, rgb.g, 0)}, ${rgbToHex(rgb.r, rgb.g, 255)})` }}
                      />
                    </div>
                  </div>
                </div>

                {/* HSL Sliders (Restored) */}
                <div className="space-y-4">
                  <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-1 h-3 bg-blue-500 rounded-full" />
                    Saturação e Brilho
                  </h3>
                  <div className="space-y-3">
                    {/* Saturation */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-mono text-white/60">
                        <span>{t('saturation')}</span>
                        <span>{Math.round(hsl.s)}%</span>
                      </div>
                      <input 
                        type="range" min="0" max="100" value={hsl.s}
                        onChange={(e) => handleHslChange(hsl.h, parseInt(e.target.value), hsl.l)}
                        className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-black/40"
                        style={{ background: `linear-gradient(to right, ${hslToHex(hsl.h, 0, hsl.l)}, ${hslToHex(hsl.h, 100, hsl.l)})` }}
                      />
                    </div>
                    {/* Luminosity */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-mono text-white/60">
                        <span>{t('lightness')}</span>
                        <span>{Math.round(hsl.l)}%</span>
                      </div>
                      <input 
                        type="range" min="0" max="100" value={hsl.l}
                        onChange={(e) => handleHslChange(hsl.h, hsl.s, parseInt(e.target.value))}
                        className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-black/40"
                        style={{ background: `linear-gradient(to right, #000000, ${hslToHex(hsl.h, hsl.s, 50)}, #ffffff)` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-[#1a1a1a] border-t border-white/10 flex justify-end">
                <button 
                  onClick={() => setIsColorSettingsOpen(false)}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-widest rounded-lg transition-all shadow-lg shadow-blue-600/20"
                >
                  Concluído
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isImportStampModalOpen && (
        <div className="fixed inset-0 z-[9999999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="p-8 rounded-2xl w-[450px] border bg-[#1a1a1a] border-white/10 shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                <Upload className="w-5 h-5 text-green-400" />
                Importar Estampa
              </h2>
              <button 
                onClick={() => setIsImportStampModalOpen(false)}
                className="p-1 hover:bg-white/5 rounded-full text-white/40 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-black/40 rounded-xl border border-white/5 space-y-2">
                <h3 className="text-sm font-semibold text-white/80">{t('importRules')}</h3>
                <ul className="text-xs text-white/60 space-y-2 list-disc list-inside">
                  <li dangerouslySetInnerHTML={{ __html: t('fileFormatNote') }} />
                  <li>{t('transparencyNote')}</li>
                  <li>{t('maxSize')} <span className="text-green-400 font-bold">256x256 {t('pixels')}</span></li>
                  <li dangerouslySetInnerHTML={{ __html: t('sizeLimitNote') }} />
                </ul>
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/png';
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) importStampFromPNG(file);
                    };
                    input.click();
                  }}
                  className="w-full py-4 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-900/20"
                >
                  <Upload className="w-5 h-5" />
                  Selecionar Arquivo PNG
                </button>
                <button 
                  onClick={() => setIsImportStampModalOpen(false)}
                  className="w-full py-3 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-xl text-sm transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}



      {folderModal?.isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[999999999] flex items-center justify-center animate-in fade-in duration-200">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-[#1a1a1a]">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-yellow-400" />
                {folderModal.folder ? 'Editar Pasta' : 'Nova Pasta'}
              </h2>
              <button 
                onClick={() => setFolderModal(null)}
                className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm text-white/60">{t('folderName')}</label>
                <input 
                  type="text" 
                  autoFocus
                  defaultValue={folderModal.folder?.name || ''}
                  placeholder="Ex: Pincéis de Textura"
                  className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/50"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const name = e.currentTarget.value.trim();
                      if (name) {
                        const newFolder = {
                          id: folderModal.folder?.id || Date.now().toString(),
                          name,
                          type: folderModal.type
                        };
                        const newFolders = [...(project.folders || [])];
                        if (folderModal.folder) {
                          const idx = newFolders.findIndex(f => f.id === newFolder.id);
                          if (idx !== -1) newFolders[idx] = newFolder;
                        } else {
                          newFolders.push(newFolder);
                        }
                        const newProject = { ...project, folders: newFolders };
                        setProject(newProject);
                        saveToHistory(newProject);
                        setFolderModal(null);
                      }
                    }
                  }}
                />
              </div>
              <div className="flex gap-2 mt-2">
                <button 
                  onClick={(e) => {
                    const input = e.currentTarget.parentElement?.previousElementSibling?.querySelector('input');
                    const name = input?.value.trim();
                    if (name) {
                      const newFolder = {
                        id: folderModal.folder?.id || Date.now().toString(),
                        name,
                        type: folderModal.type
                      };
                      const newFolders = [...(project.folders || [])];
                      if (folderModal.folder) {
                        const idx = newFolders.findIndex(f => f.id === newFolder.id);
                        if (idx !== -1) newFolders[idx] = newFolder;
                      } else {
                        newFolders.push(newFolder);
                      }
                      const newProject = { ...project, folders: newFolders };
                      setProject(newProject);
                      saveToHistory(newProject);
                      setFolderModal(null);
                    }
                  }}
                  className="flex-1 py-3 bg-yellow-600 hover:bg-yellow-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-yellow-900/20"
                >
                  Salvar
                </button>
                <button 
                  onClick={() => setFolderModal(null)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-xl font-medium transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {moveFolderModal?.isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[999999999] flex items-center justify-center animate-in fade-in duration-200">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-[#1a1a1a]">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-blue-400" />
                Mover para Pasta
              </h2>
              <button 
                onClick={() => setMoveFolderModal(null)}
                className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                <button
                  onClick={() => {
                    if (moveFolderModal.type === 'brush') {
                      const newBrushes = project.brushes?.map(b => b.id === moveFolderModal.itemId ? { ...b, folderId: undefined } : b) || [];
                      const newProject = { ...project, brushes: newBrushes };
                      setProject(newProject);
                      saveToHistory(newProject);
                    } else {
                      const newStamps = project.stamps?.map(s => s.id === moveFolderModal.itemId ? { ...s, folderId: undefined } : s) || [];
                      const newProject = { ...project, stamps: newStamps };
                      setProject(newProject);
                      saveToHistory(newProject);
                    }
                    setMoveFolderModal(null);
                  }}
                  className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-white/5 text-left transition-colors border border-transparent hover:border-white/10"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40">
                    <Grid3X3 className="w-4 h-4" />
                  </div>
                  <span className="text-white font-medium">{t('noFolder')}</span>
                </button>
                
                {(project.folders || []).filter(f => f.type === moveFolderModal.type).map(folder => (
                  <button
                    key={folder.id}
                    onClick={() => {
                      if (moveFolderModal.type === 'brush') {
                        const newBrushes = project.brushes?.map(b => b.id === moveFolderModal.itemId ? { ...b, folderId: folder.id } : b) || [];
                        const newProject = { ...project, brushes: newBrushes };
                        setProject(newProject);
                        saveToHistory(newProject);
                      } else {
                        const newStamps = project.stamps?.map(s => s.id === moveFolderModal.itemId ? { ...s, folderId: folder.id } : s) || [];
                        const newProject = { ...project, stamps: newStamps };
                        setProject(newProject);
                        saveToHistory(newProject);
                      }
                      setMoveFolderModal(null);
                    }}
                    className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-white/5 text-left transition-colors border border-transparent hover:border-white/10"
                  >
                    <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center text-yellow-400">
                      <Folder className="w-4 h-4" />
                    </div>
                    <span className="text-white font-medium">{folder.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {isBrushEditorOpen && editingBrush && (
        <div className="fixed inset-0 z-[9999999] flex items-center justify-center bg-black/50">
          <div className="p-6 rounded-xl w-[400px] border flex flex-col gap-6 bg-[#1a1a1a] border-white/10">
            <h2 className="text-lg font-bold">{t('brushEditor')}</h2>
            
            <div className="space-y-4">
              <label className="block text-sm">
                Nome:
                <input 
                  type="text" 
                  value={editingBrush.name} 
                  onChange={e => setEditingBrush({...editingBrush, name: e.target.value})} 
                  className="w-full p-2 rounded mt-1 bg-[#1a1a1a] border border-white/10" 
                />
              </label>
              
              <div className="flex gap-4">
                <label className="block text-sm flex-1">
                  Largura (1-32):
                  <input 
                    type="number" 
                    min="1" max="32"
                    value={editingBrush.width} 
                    onChange={e => {
                      const w = Math.max(1, Math.min(32, parseInt(e.target.value) || 1));
                      const newPixels = Array(w * editingBrush.height).fill(false);
                      for (let y = 0; y < Math.min(editingBrush.height, editingBrush.height); y++) {
                        for (let x = 0; x < Math.min(w, editingBrush.width); x++) {
                          newPixels[y * w + x] = editingBrush.pixels[y * editingBrush.width + x];
                        }
                      }
                      setEditingBrush({...editingBrush, width: w, pixels: newPixels});
                    }} 
                    className="w-full p-2 rounded mt-1 bg-[#1a1a1a] border border-white/10" 
                  />
                </label>
                <label className="block text-sm flex-1">
                  Altura (1-32):
                  <input 
                    type="number" 
                    min="1" max="32"
                    value={editingBrush.height} 
                    onChange={e => {
                      const h = Math.max(1, Math.min(32, parseInt(e.target.value) || 1));
                      const newPixels = Array(editingBrush.width * h).fill(false);
                      for (let y = 0; y < Math.min(h, editingBrush.height); y++) {
                        for (let x = 0; x < Math.min(editingBrush.width, editingBrush.width); x++) {
                          newPixels[y * editingBrush.width + x] = editingBrush.pixels[y * editingBrush.width + x];
                        }
                      }
                      setEditingBrush({...editingBrush, height: h, pixels: newPixels});
                    }} 
                    className="w-full p-2 rounded mt-1 bg-[#1a1a1a] border border-white/10" 
                  />
                </label>
              </div>

              <div className="flex gap-4 items-start bg-black/40 p-4 rounded border border-white/10">
                <div className="flex flex-col items-center gap-2">
                  <span className="text-[10px] text-white/40 uppercase font-bold">{t('globalAlignment')}</span>
                  <div 
                    className="grid grid-cols-3 bg-black border border-black/20 overflow-hidden"
                    style={{ 
                      width: 120,
                      height: 120,
                    }}
                  >
                    {Array(9).fill(0).map((_, tileIdx) => (
                      <div 
                        key={tileIdx}
                        className="grid"
                        style={{ 
                          gridTemplateColumns: `repeat(${editingBrush.width}, 1fr)`,
                          gridTemplateRows: `repeat(${editingBrush.height}, 1fr)`,
                        }}
                      >
                        {editingBrush.pixels.map((p: boolean, i: number) => (
                          <div 
                            key={`brush-pixel-${i}`} 
                            className={cn("w-full h-full", p ? (transparencyMode === 'day' ? "bg-black" : "bg-white") : (transparencyMode === 'day' ? "bg-white" : "bg-black"))}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center flex-1">
                  <span className="text-[10px] text-white/40 uppercase font-bold mb-1">{t('drawingArea')}</span>
                  <span className="text-[8px] text-white/20 uppercase mb-2">{t('clickDragShape')}</span>
                  <div 
                    className="grid gap-[1px] bg-black border border-black/20"
                    style={{ 
                      gridTemplateColumns: `repeat(${editingBrush.width}, 1fr)`,
                      width: Math.min(200, editingBrush.width * 20),
                      height: Math.min(200, editingBrush.height * 20)
                    }}
                    onMouseLeave={() => setIsMouseDown(false)}
                  >
                  {editingBrush.pixels.map((p: boolean, i: number) => (
                    <div 
                      key={`brush-edit-${i}`} 
                      className={cn("w-full h-full cursor-pointer", p ? (transparencyMode === 'day' ? "bg-black" : "bg-white") : (transparencyMode === 'day' ? "bg-white hover:bg-gray-100" : "bg-black hover:bg-gray-800"))}
                      onMouseDown={() => {
                        const newPixels = [...editingBrush.pixels];
                        newPixels[i] = !newPixels[i];
                        setEditingBrush({...editingBrush, pixels: newPixels});
                      }}
                      onMouseEnter={(e) => {
                        if (e.buttons === 1) {
                          const newPixels = [...editingBrush.pixels];
                          newPixels[i] = true;
                          setEditingBrush({...editingBrush, pixels: newPixels});
                        } else if (e.buttons === 2) {
                          const newPixels = [...editingBrush.pixels];
                          newPixels[i] = false;
                          setEditingBrush({...editingBrush, pixels: newPixels});
                        }
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        const newPixels = [...editingBrush.pixels];
                        newPixels[i] = false;
                        setEditingBrush({...editingBrush, pixels: newPixels});
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
                {project.brushes?.some(b => b.id === editingBrush.id) && editingBrush.id !== 'brush-1x1' && (
                  <button 
                    onClick={() => {
                    const newBrushes = project.brushes?.filter(b => b.id !== editingBrush.id) || [];
                    const newProject = { ...project, brushes: newBrushes };
                    setProject(newProject);
                    saveToHistory(newProject);
                    if (activeBrushId === editingBrush.id) setActiveBrushId('brush-1x1');
                    setIsBrushEditorOpen(false);
                    }} 
                    className="px-4 py-2 bg-red-600/20 text-red-400 hover:bg-red-600/40 rounded mr-auto flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Excluir
                  </button>
                )}
                <button onClick={() => setIsBrushEditorOpen(false)} className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded">{t('cancel')}</button>
                <button 
                  onClick={() => {
                    const newBrushes = [...(project.brushes || [])];
                    const existingIndex = newBrushes.findIndex(b => b.id === editingBrush.id);
                    if (existingIndex >= 0) {
                      newBrushes[existingIndex] = editingBrush;
                    } else {
                      newBrushes.push(editingBrush);
                    }
                    const newProject = { ...project, brushes: newBrushes };
                    setProject(newProject);
                    saveToHistory(newProject);
                    setActiveBrushId(editingBrush.id);
                    setIsBrushEditorOpen(false);
                  }} 
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left Toolbar */}
        <aside 
          style={{ width: `${toolsWidth}px` }}
          className="flex flex-col items-center py-0 gap-0 bg-[#1a1a1a] border-r border-white/10 z-[999999] overflow-y-auto custom-scrollbar shrink-0 relative"
        >
          {/* Resizer Handle */}
          <div 
            className="absolute top-0 bottom-0 right-0 w-1.5 translate-x-1/2 cursor-col-resize hover:bg-blue-500/50 active:bg-blue-500 transition-colors z-[99999]"
            onMouseDown={(e) => {
              e.preventDefault();
              setIsResizingTools(true);
            }}
          />
          
          <div className="w-full px-4 h-[41px] border-b border-white/10 flex items-center gap-2 shrink-0 bg-[#1a1a1a]">
            <Pencil className="w-4 h-4 text-white/40" />
            <h3 className="text-[10px] font-bold text-white/60 uppercase tracking-widest">{t('tools')}</h3>
          </div>

          <div className="flex-1 w-full py-4 px-4">
            <DndContext 
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(e) => handleDragEnd(e, 'tools')}
            >
              <SortableContext 
                items={toolsOrder}
                strategy={rectSortingStrategy}
              >
                <div 
                  className="grid gap-2 w-full justify-items-center justify-center"
                  style={{ 
                    gridTemplateColumns: `repeat(${Math.max(1, Math.floor((toolsWidth - 32) / 44))}, 44px)` 
                  }}
                >
                  {toolsOrder.map(toolId => {
                  let toolContent = null;
                  const getToolProps = (id: string, label: string, desc: string) => ({
                    active: tool === id,
                    onClick: () => setTool(id as Tool),
                    label,
                    description: desc,
                    onMouseEnter: (e: React.MouseEvent) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setTooltip({ label, description: desc, x: rect.right, y: rect.top + rect.height / 2, side: 'right' });
                    },
                    onMouseLeave: () => setTooltip(null)
                  });

                  switch (toolId) {
                    case 'pencil': toolContent = <ToolButton {...getToolProps('pencil', t('pencil'), t('pencilDesc'))} icon={<Pencil className="w-6 h-6" />} />; break;
                    case 'eraser': toolContent = <ToolButton {...getToolProps('eraser', t('eraser'), t('eraserDesc'))} icon={<Eraser className="w-6 h-6" />} />; break;
                    case 'bucket': toolContent = <ToolButton {...getToolProps('bucket', t('bucket'), t('bucketDesc'))} icon={<PaintBucket className="w-6 h-6" />} />; break;
                    case 'picker': toolContent = <ToolButton {...getToolProps('picker', t('picker'), t('pickerDesc'))} icon={<Pipette className="w-6 h-6" />} />; break;
                    case 'line': toolContent = <ToolButton {...getToolProps('line', t('line'), t('lineDesc'))} icon={<Slash className="w-6 h-6" />} />; break;
                    case 'square': toolContent = <ToolButton {...getToolProps('square', t('square'), t('shapeDesc'))} icon={<Square className="w-6 h-6" />} />; break;
                    case 'circle': toolContent = <ToolButton {...getToolProps('circle', t('circle'), t('shapeDesc'))} icon={<Circle className="w-6 h-6" />} />; break;
                    case 'transform': toolContent = (
                      <ToolButton 
                        {...getToolProps('transform', t('transform'), t('moveDesc'))} 
                        icon={
                          <Scaling className="w-6 h-6" />
                        } 
                      />
                    ); break;
                    case 'selection': toolContent = (
                      <ToolButton 
                        {...getToolProps('selection', t('selection'), t('rectSelectionDesc'))} 
                        icon={
                          <SquareDashed className="w-6 h-6" />
                        } 
                      />
                    ); break;
                    case 'magic-wand': toolContent = (
                      <ToolButton 
                        {...getToolProps('magic-wand', t('magicWandTool'), t('magicWandDesc'))} 
                        icon={<Wand2 className="w-6 h-6" />} 
                      />
                    ); break;
                    case 'pixel-outline-pencil': toolContent = (
                      <ToolButton 
                        {...getToolProps('pixel-outline-pencil', t('pixelOutline'), t('pixelOutlineDesc'))} 
                        icon={
                          <PenTool className="w-6 h-6" />
                        } 
                      />
                    ); break;
                    case 'conditional-pencil': toolContent = <ToolButton {...getToolProps('conditional-pencil', t('conditionalPencil'), t('conditionalPencilDesc'))} icon={<Paintbrush className="w-6 h-6" />} />; break;
                    case 'transparent-filler': toolContent = (
                      <ToolButton 
                        {...getToolProps('transparent-filler', t('transparentFiller'), t('transparentFillerDesc'))} 
                        icon={
                          <div className="relative w-6 h-6 flex items-center justify-center">
                            <div className="absolute inset-0 rounded overflow-hidden opacity-40" style={{ backgroundImage: 'conic-gradient(#ccc 90deg, #fff 90deg 180deg, #ccc 180deg 270deg, #fff 270deg)', backgroundSize: '4px 4px' }} />
                            <Brush className="w-5 h-5 relative z-10" />
                          </div>
                        } 
                      />
                    ); break;
                    case 'color-replace': toolContent = <ToolButton {...getToolProps('color-replace', t('colorReplaceTool'), t('colorReplaceDesc'))} icon={<Replace className="w-6 h-6" />} />; break;
                    case 'transparent': toolContent = (
                      <button 
                        onClick={() => handleSelectColor('transparent')}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setTooltip({ label: t('transparent'), description: t('transparentDesc'), x: rect.right, y: rect.top + rect.height / 2, side: 'right' });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                        className={cn(
                          "w-11 h-11 shrink-0 p-2 rounded-xl transition-all relative group flex items-center justify-center cursor-grab active:cursor-grabbing",
                          (activeColorSlot === 1 ? selectedColor : secondaryColor) === 'transparent' ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30" : "text-white/40 hover:bg-white/5 hover:text-white"
                        )}
                      >
                        <div className="w-6 h-6 border border-white/20 rounded overflow-hidden relative">
                          <div className="absolute inset-0 bg-white" />
                          <div className="absolute inset-0" style={{ backgroundImage: 'conic-gradient(#ccc 90deg, #fff 90deg 180deg, #ccc 180deg 270deg, #fff 270deg)', backgroundSize: '6px 6px' }} />
                        </div>
                      </button>
                    ); break;
                  }

                  return (
                    <SortableToolSlot key={toolId} id={toolId}>
                      {toolContent}
                    </SortableToolSlot>
                  );
                })}
              </div>
            </SortableContext>

            <div className="w-full px-4 py-4 mt-2 border-t border-white/10">
              <SortableContext 
                items={utilityToolsOrder} 
                strategy={rectSortingStrategy}
              >
                <div 
                  className="grid gap-2 w-full justify-items-center justify-center"
                  style={{ 
                    gridTemplateColumns: `repeat(${Math.max(1, Math.floor((toolsWidth - 32) / 44))}, 44px)` 
                  }}
                >
                  {utilityToolsOrder.map(toolId => {
                    let toolContent = null;
                    const getToolProps = (id: string, label: string, desc: string) => ({
                      active: tool === id,
                      onClick: () => setTool(id as Tool),
                      label,
                      description: desc,
                      onMouseEnter: (e: React.MouseEvent) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTooltip({ label, description: desc, x: rect.right, y: rect.top + rect.height / 2, side: 'right' });
                      },
                      onMouseLeave: () => setTooltip(null)
                    });

                    switch (toolId) {
                      case 'transparency-mode': toolContent = (
                        <button 
                          onClick={() => {
                            const newMode: 'day' | 'night' = transparencyMode === 'day' ? 'night' : 'day';
                            setTransparencyMode(newMode);
                            const newProject = { ...project, transparencyMode: newMode };
                            setProject(newProject);
                            saveToHistory(newProject);
                          }}
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setTooltip({ label: t('transparencyMode'), description: t('transparencyModeDesc'), x: rect.right, y: rect.top + rect.height / 2, side: 'right' });
                          }}
                          onMouseLeave={() => setTooltip(null)}
                          className="w-11 h-11 shrink-0 p-2 rounded-xl text-white/40 hover:bg-white/5 hover:text-white transition-all relative group flex items-center justify-center cursor-grab active:cursor-grabbing"
                        >
                          <div className="relative w-6 h-6 flex items-center justify-center">
                            {/* White transparent block */}
                            <div className="absolute left-0 w-3 h-4 rounded-sm overflow-hidden border border-white/20" style={{ backgroundImage: 'conic-gradient(#ccc 90deg, #fff 90deg 180deg, #ccc 180deg 270deg, #fff 270deg)', backgroundSize: '3px 3px' }} />
                            {/* Black transparent block */}
                            <div className="absolute right-0 w-3 h-4 rounded-sm overflow-hidden border border-white/20" style={{ backgroundImage: 'conic-gradient(#333 90deg, #111 90deg 180deg, #333 180deg 270deg, #111 270deg)', backgroundSize: '3px 3px' }} />
                            {/* Switch in the middle */}
                            <div className={cn(
                              "absolute w-4 h-2 bg-white rounded-full transition-all z-10 border border-black/50",
                              transparencyMode === 'day' ? "-translate-x-1.5" : "translate-x-1.5"
                            )}>
                              <div className="absolute top-0.5 left-0.5 w-1 h-1 bg-blue-600 rounded-full" />
                            </div>
                          </div>
                        </button>
                      ); break;
                      case 'grid': toolContent = (
                        <ToolButton 
                          active={showGrid} 
                          onClick={() => setShowGrid(!showGrid)} 
                          icon={<Grid2X2 className="w-6 h-6" />} 
                          label="Grade" 
                          description="Alterna a visibilidade da grade de pixels." 
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setTooltip({ label: t('grid'), description: t('gridDescTooltip'), x: rect.right, y: rect.top + rect.height / 2, side: 'right' });
                          }}
                          onMouseLeave={() => setTooltip(null)}
                        />
                      ); break;
                      case 'resize': toolContent = (
                        <ToolButton 
                          active={isResizeMode} 
                          onClick={() => {
                            const next = !isResizeMode;
                            setIsResizeMode(next);
                            if (next) {
                              setIsMirrorMode(false);
                              setIsTiledMode(false);
                            }
                          }} 
                          icon={<Settings2 className="w-6 h-6" />} 
                          label="Redimensionar" 
                          description="Ativa o modo de redimensionamento da tela." 
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setTooltip({ label: t('resize'), description: t('resizeDescTooltip'), x: rect.right, y: rect.top + rect.height / 2, side: 'right' });
                          }}
                          onMouseLeave={() => setTooltip(null)}
                        />
                      ); break;
                      case 'tiled-mode': toolContent = (
                        <ToolButton 
                          active={isTiledMode} 
                          onClick={() => {
                            const next = !isTiledMode;
                            setIsTiledMode(next);
                            if (next) {
                              setIsMirrorMode(false);
                              setIsResizeMode(false);
                            }
                          }} 
                          icon={<TiledModeIcon className="w-6 h-6" />} 
                          label="Tiled Mode" 
                          description="Visualiza o sprite repetido em grade." 
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setTooltip({ label: t('tiledMode'), description: t('tiledModeDesc'), x: rect.right, y: rect.top + rect.height / 2, side: 'right' });
                          }}
                          onMouseLeave={() => setTooltip(null)}
                        />
                      ); break;
                      case 'mirror-mode': toolContent = (
                        <ToolButton 
                          active={isMirrorMode} 
                          onClick={() => {
                            const next = !isMirrorMode;
                            setIsMirrorMode(next);
                            if (next) {
                              setIsTiledMode(false);
                              setIsResizeMode(false);
                            }
                          }} 
                          icon={<FlipHorizontal className="w-6 h-6" />} 
                          label="Modo Espelhamento" 
                          description="Simula uma cópia invertida da pixelart." 
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setTooltip({ label: t('mirrorMode'), description: t('mirrorModeDesc'), x: rect.right, y: rect.top + rect.height / 2, side: 'right' });
                          }}
                          onMouseLeave={() => setTooltip(null)}
                        />
                      ); break;
                    }

                    return (
                      <SortableToolSlot key={toolId} id={toolId}>
                        {toolContent}
                      </SortableToolSlot>
                    );
                  })}
                </div>
              </SortableContext>
            </div>
          </DndContext>
        </div>
      </aside>

        {/* Main Workspace */}
        <div 
          ref={workspaceRef}
          className="flex-1 flex flex-col overflow-hidden relative bg-[#0a0a0a] min-h-0"
          onWheel={handleWheel}
          onMouseDown={handleWorkspaceMouseDown}
          onMouseUp={handleMouseUp}
          onContextMenu={(e) => e.preventDefault()}
        >
          <main className="flex-1 relative flex items-center justify-center p-12 overflow-hidden min-h-0">
            <div 
              ref={canvasContainerRef}
              className="relative shadow-2xl bg-white/5 transition-transform duration-75 flex-shrink-0"
              style={{
                width: `${(isTiledMode ? (selection ? selection.w * visibleBounds.width : project.width * visibleBounds.width) : (isMirrorMode && ['left', 'right'].includes(mirrorDirection) ? project.width * 2 : project.width)) * 20 * zoom}px`,
                height: `${(isTiledMode ? (selection ? selection.h * visibleBounds.height : project.height * visibleBounds.height) : (isMirrorMode && ['top', 'bottom'].includes(mirrorDirection) ? project.height * 2 : project.height)) * 20 * zoom}px`,
                transform: `translate(${pan.x}px, ${pan.y}px)`,
              }}
              onMouseDown={(e) => {
                if (e.button === 0) setIsMouseDown(true);
              }}
              onMouseUp={handleMouseUp}
              onMouseLeave={() => {
                if (!isSelecting && !movingSelection) {
                  handleMouseUp();
                }
              }}
            >
              {isResizeMode && (
                <>
                  {/* Edges */}
                  <div className="absolute top-0 left-0 right-0 h-2 -translate-y-1/2 cursor-ns-resize bg-blue-500/50 hover:bg-blue-500 z-[99999]" onMouseDown={(e) => handleResizeStart(e, 'top')} />
                  <div className="absolute bottom-0 left-0 right-0 h-2 translate-y-1/2 cursor-ns-resize bg-blue-500/50 hover:bg-blue-500 z-[99999]" onMouseDown={(e) => handleResizeStart(e, 'bottom')} />
                  <div className="absolute top-0 bottom-0 left-0 w-2 -translate-x-1/2 cursor-ew-resize bg-blue-500/50 hover:bg-blue-500 z-[99999]" onMouseDown={(e) => handleResizeStart(e, 'left')} />
                  <div className="absolute top-0 bottom-0 right-0 w-2 translate-x-1/2 cursor-ew-resize bg-blue-500/50 hover:bg-blue-500 z-[99999]" onMouseDown={(e) => handleResizeStart(e, 'right')} />
                  
                  {/* Corners */}
                  <div className="absolute top-0 left-0 w-3 h-3 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize bg-blue-500 border-2 border-white rounded-full z-[99999]" onMouseDown={(e) => handleResizeStart(e, 'top-left')} />
                  <div className="absolute top-0 right-0 w-3 h-3 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize bg-blue-500 border-2 border-white rounded-full z-[99999]" onMouseDown={(e) => handleResizeStart(e, 'top-right')} />
                  <div className="absolute bottom-0 left-0 w-3 h-3 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize bg-blue-500 border-2 border-white rounded-full z-[99999]" onMouseDown={(e) => handleResizeStart(e, 'bottom-left')} />
                  <div className="absolute bottom-0 right-0 w-3 h-3 translate-x-1/2 translate-y-1/2 cursor-nwse-resize bg-blue-500 border-2 border-white rounded-full z-[99999]" onMouseDown={(e) => handleResizeStart(e, 'bottom-right')} />
                </>
              )}

              {canvasResizeState && (
                <div 
                  className="absolute border-2 border-blue-500 border-dashed z-[99999] pointer-events-none"
                  style={{
                    left: `${-canvasResizeState.offsetX * 20 * zoom}px`,
                    top: `${-canvasResizeState.offsetY * 20 * zoom}px`,
                    width: `${canvasResizeState.currentWidth * 20 * zoom}px`,
                    height: `${canvasResizeState.currentHeight * 20 * zoom}px`,
                  }}
                >
                  <div className="absolute bottom-full left-0 mb-1 bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap">
                    {canvasResizeState.currentWidth} x {canvasResizeState.currentHeight}
                  </div>
                </div>
              )}

              <Checkerboard mode={transparencyMode} />
              
              {/* Onion Skinning (Adjacent Frames) */}
              {currentFrameIndex > 0 && project.frames[currentFrameIndex - 1].onionSkin && (
                <div 
                  className="absolute pointer-events-none opacity-20 z-0"
                  style={{
                    left: `${(isMirrorMode && mirrorDirection === 'left' ? project.width : 0) * 20 * zoom}px`,
                    top: `${(isMirrorMode && mirrorDirection === 'top' ? project.height : 0) * 20 * zoom}px`,
                    width: `${project.width * 20 * zoom}px`,
                    height: `${project.height * 20 * zoom}px`,
                  }}
                >
                  <CompositeFrame frame={project.frames[currentFrameIndex - 1]} layers={project.layers} width={project.width} height={project.height} transparencyMode={transparencyMode} />
                </div>
              )}
              {currentFrameIndex < project.frames.length - 1 && project.frames[currentFrameIndex + 1].onionSkin && (
                <div 
                  className="absolute pointer-events-none opacity-20 z-0"
                  style={{
                    left: `${(isMirrorMode && mirrorDirection === 'left' ? project.width : 0) * 20 * zoom}px`,
                    top: `${(isMirrorMode && mirrorDirection === 'top' ? project.height : 0) * 20 * zoom}px`,
                    width: `${project.width * 20 * zoom}px`,
                    height: `${project.height * 20 * zoom}px`,
                  }}
                >
                  <CompositeFrame frame={project.frames[currentFrameIndex + 1]} layers={project.layers} width={project.width} height={project.height} transparencyMode={transparencyMode} />
                </div>
              )}

                {/* Main Drawing Canvas */}
                <div className="absolute inset-0 z-10">
                  <MainCanvas
                    project={project}
                    currentFrameIndex={currentFrameIndex}
                    isPlaying={isPlaying}
                    previewSpeed={previewSpeed}
                    isPingPong={isPingPong}
                    setCurrentFrameIndex={setCurrentFrameIndex}
                    currentLayerId={currentLayerId}
                    zoom={zoom}
                    showGrid={showGrid}
                    gridSize={gridSize}
                    gridOffsetX={gridOffsetX}
                    gridOffsetY={gridOffsetY}
                    isSelecting={isSelecting}
                    selectionStart={selectionStart}
                    isTiledMode={isTiledMode}
                    tiledOpacity={tiledOpacity}
                    visibleTiles={visibleTiles}
                    setVisibleTiles={setVisibleTiles}
                    visibleBounds={visibleBounds}
                    hoveredPixelIndex={hoveredPixelIndex}
                    hoveredPixelPos={hoveredPixelPos}
                    previewPixels={previewPixels}
                    handlePixelInteraction={handlePixelInteraction}
                    handlePixelEnter={handlePixelEnter}
                    setHoveredPixelIndex={setHoveredPixelIndex}
                    setHoveredPixelPos={setHoveredPixelPos}
                    setPreviewPixels={setPreviewPixels}
                    isMouseDown={isMouseDown}
                    tool={tool}
                    getActiveColor={getActiveColor}
                    activeColorSlot={activeColorSlot}
                    selection={selection}
                    selectionMask={selectionMask}
                    selectedPixels={selectedPixels}
                    transformState={transformState}
                    activeBrushId={activeBrushId}
                    activeStampId={activeStampId}
                    previewStampCenters={previewStampCenters}
                    globalBrushAlignment={globalBrushAlignment}
                    globalAlignmentOffsetX={globalAlignmentOffsetX}
                    globalAlignmentOffsetY={globalAlignmentOffsetY}
                    transparencyMode={transparencyMode}
                    isMirrorMode={isMirrorMode}
                    mirrorDirection={mirrorDirection}
                    mirrorOpacity={mirrorOpacity}
                  />
                </div>

                {/* Active Selection Drag Marquee Overlay */}
                {isSelecting && (tool === 'selection' || tool === 'transform') && selectionStart && hoveredPixelPos && (() => {
                  const pixelSize = 20 * zoom;
                  let offsetX = 0;
                  let offsetY = 0;
                  if (isTiledMode) {
                    offsetX = (selection ? (selection.w * (1 - visibleBounds.minX)) : (project.width * (1 - visibleBounds.minX))) * pixelSize;
                    offsetY = (selection ? (selection.h * (1 - visibleBounds.minY)) : (project.height * (1 - visibleBounds.minY))) * pixelSize;
                  } else if (isMirrorMode) {
                    if (mirrorDirection === 'left') offsetX = project.width * pixelSize;
                    if (mirrorDirection === 'top') offsetY = project.height * pixelSize;
                  }

                  const minX = Math.min(selectionStart.x, hoveredPixelPos.x);
                  const minY = Math.min(selectionStart.y, hoveredPixelPos.y);
                  const maxX = Math.max(selectionStart.x, hoveredPixelPos.x);
                  const maxY = Math.max(selectionStart.y, hoveredPixelPos.y);

                  const rectLeft = offsetX + minX * pixelSize;
                  const rectTop = offsetY + minY * pixelSize;
                  const rectWidth = (maxX - minX + 1) * pixelSize;
                  const rectHeight = (maxY - minY + 1) * pixelSize;

                  // Clamped bounds to show what will be selected inside drawing area
                  const clampedMinX = Math.max(0, Math.min(project.width - 1, minX));
                  const clampedMinY = Math.max(0, Math.min(project.height - 1, minY));
                  const clampedMaxX = Math.max(0, Math.min(project.width - 1, maxX));
                  const clampedMaxY = Math.max(0, Math.min(project.height - 1, maxY));

                  const isOutsideCanvas = minX < 0 || maxX >= project.width || minY < 0 || maxY >= project.height;
                  const clampedLeft = offsetX + clampedMinX * pixelSize;
                  const clampedTop = offsetY + clampedMinY * pixelSize;
                  const clampedWidth = (clampedMaxX - clampedMinX + 1) * pixelSize;
                  const clampedHeight = (clampedMaxY - clampedMinY + 1) * pixelSize;

                  const clampedW = clampedMaxX - clampedMinX + 1;
                  const clampedH = clampedMaxY - clampedMinY + 1;

                  return (
                    <div className="absolute inset-0 pointer-events-none z-[1000002]">
                      {/* Active selection marquee following the mouse outside the canvas */}
                      <div 
                        className="absolute border border-blue-400 bg-blue-500/15"
                        style={{
                          left: `${rectLeft}px`,
                          top: `${rectTop}px`,
                          width: `${rectWidth}px`,
                          height: `${rectHeight}px`,
                          outline: '1px dashed rgba(255, 255, 255, 0.7)',
                          outlineOffset: '-1px',
                        }}
                      >
                        {/* Size indicator badge */}
                        <div 
                          className="absolute -top-6 left-0 bg-blue-600/90 text-white text-[11px] font-mono px-1.5 py-0.5 rounded shadow pointer-events-none whitespace-nowrap backdrop-blur-xs flex items-center gap-1.5"
                        >
                          <span>{maxX - minX + 1} × {maxY - minY + 1}</span>
                          {isOutsideCanvas && (
                            <span className="text-blue-200 text-[10px]">
                              ({clampedW} × {clampedH})
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Clamped area preview inside canvas when extending outside */}
                      {isOutsideCanvas && clampedW > 0 && clampedH > 0 && (
                        <div 
                          className="absolute border-2 border-dashed border-blue-400 bg-blue-500/25 pointer-events-none"
                          style={{
                            left: `${clampedLeft}px`,
                            top: `${clampedTop}px`,
                            width: `${clampedWidth}px`,
                            height: `${clampedHeight}px`,
                          }}
                        />
                      )}
                    </div>
                  );
                })()}

                {/* Transform Overlay */}
                {transformState && (
                  <div 
                    className="absolute z-[1000003]"
                    style={{
                      left: `${(isTiledMode ? (selection ? (transformState.centerX - selection.x + selection.w) : (transformState.centerX + project.width)) : (transformState.centerX + (isMirrorMode && ['left', 'right'].includes(mirrorDirection) ? project.width : 0))) * 20 * zoom}px`,
                      top: `${(isTiledMode ? (selection ? (transformState.centerY - selection.y + selection.h) : (transformState.centerY + project.height)) : (transformState.centerY + (isMirrorMode && ['top', 'bottom'].includes(mirrorDirection) ? project.height : 0))) * 20 * zoom}px`,
                      width: `${transformState.w * 20 * zoom}px`,
                      height: `${transformState.h * 20 * zoom}px`,
                      transform: `translate(-50%, -50%) rotate(${transformState.rotation}deg)`,
                      transformOrigin: 'center'
                    }}
                  >
                    {/* Bounding Box */}
                    <div className="absolute inset-0 border-2 border-blue-500 bg-blue-500/20 pointer-events-none" />
                    
                    {/* Center Move Area */}
                    <div 
                      className="absolute inset-0 cursor-move"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setTransformDrag({ handle: 'move', startX: e.clientX, startY: e.clientY, initialState: transformState });
                      }}
                    />
                    
                    {/* Resize Handles */}
                    {['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map(handle => {
                      const positions: Record<string, string> = {
                        nw: 'top-0 left-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize',
                        n: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize',
                        ne: 'top-0 right-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize',
                        e: 'top-1/2 right-0 translate-x-1/2 -translate-y-1/2 cursor-ew-resize',
                        se: 'bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize',
                        s: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-ns-resize',
                        sw: 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize',
                        w: 'top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize'
                      };
                      return (
                        <div 
                          key={handle}
                          className={`absolute w-3 h-3 bg-white border border-blue-500 rounded-sm ${positions[handle]}`}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            setTransformDrag({ handle, startX: e.clientX, startY: e.clientY, initialState: transformState });
                          }}
                        />
                      );
                    })}
                    
                    {/* Rotation Handle */}
                    <div className="absolute top-[-30px] left-1/2 w-px h-[30px] bg-blue-500 pointer-events-none" />
                    <div 
                      className="absolute top-[-36px] left-1/2 w-4 h-4 bg-green-500 border-2 border-white rounded-full -translate-x-1/2 cursor-crosshair"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.parentElement?.getBoundingClientRect();
                        if (rect) {
                          const cx = rect.left + rect.width / 2;
                          const cy = rect.top + rect.height / 2;
                          const initialAngle = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
                          setTransformDrag({ 
                            handle: 'rotate', 
                            startX: e.clientX, 
                            startY: e.clientY, 
                            initialState: transformState,
                            screenCenterX: cx,
                            screenCenterY: cy,
                            initialAngle
                          });
                        }
                      }}
                    />
                  </div>
                )}

                {/* Transform Floating Toolbar */}
                {transformState && !isTiledMode && (
                  <div 
                    className="absolute z-[1000004] flex items-center gap-1 p-1 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl"
                    style={{
                      left: `${(isTiledMode ? (selection ? (transformState.centerX - selection.x + selection.w) : (transformState.centerX + project.width)) : (transformState.centerX + (isMirrorMode && ['left', 'right'].includes(mirrorDirection) ? project.width : 0))) * 20 * zoom}px`,
                      top: `${((isTiledMode ? (selection ? (transformState.centerY + transformState.h / 2 - selection.y + selection.h) : (transformState.centerY + transformState.h / 2 + project.height)) : (transformState.centerY + transformState.h / 2 + (isMirrorMode && ['top', 'bottom'].includes(mirrorDirection) ? project.height : 0))) * 20 * zoom) + 25}px`,
                      transform: 'translateX(-50%)'
                    }}
                  >
                    <button 
                      onClick={confirmTransform}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTooltip({ label: t('confirm'), description: t('confirmDesc'), x: rect.left + rect.width / 2, y: rect.top, side: 'top', align: 'center' });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                      className="p-1.5 bg-blue-600 hover:bg-blue-500 rounded text-white transition-colors"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={cancelTransform}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTooltip({ label: t('cancel'), description: t('cancelDesc'), x: rect.left + rect.width / 2, y: rect.top, side: 'top', align: 'center' });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                      className="p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded text-white/60 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Selection Overlay Toolbar */}
                {selection && !isTiledMode && (
                  <>
                    {/* Floating Selection Toolbar */}
                    <div 
                      className="absolute z-[1000002] flex items-center gap-1 p-1 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl"
                      style={{
                        left: `${(isTiledMode ? (selection ? selection.w : project.width) : (selection.x + (isMirrorMode && ['left', 'right'].includes(mirrorDirection) ? project.width : 0))) * 20 * zoom}px`,
                        top: `${((isTiledMode ? (selection ? selection.h : project.height) : (selection.y + (isMirrorMode && ['top', 'bottom'].includes(mirrorDirection) ? project.height : 0))) * 20 * zoom) - 45}px`,
                      }}
                    >
                      <button 
                        onClick={() => {
                          if (selectedPixels.length === 0) {
                            detachSelection();
                          }
                          const pixelsToFlip = selectedPixels.length > 0 ? selectedPixels : [];
                          if (pixelsToFlip.length === 0) return;

                          const flipped = [...pixelsToFlip].map(p => ({
                            ...p,
                            x: selection.w - 1 - p.x
                          }));
                          setSelectedPixels(flipped);
                          const newMask = Array(project.width * project.height).fill(false);
                          flipped.forEach(p => {
                            const tx = selection.x + p.x;
                            const ty = selection.y + p.y;
                            if (tx >= 0 && tx < project.width && ty >= 0 && ty < project.height) {
                              newMask[ty * project.width + tx] = true;
                            }
                          });
                          setSelectionMask(newMask);
                          if (selectionOriginRef.current && selection && selection.x === selectionOriginRef.current.x && selection.y === selectionOriginRef.current.y) {
                            const originData = { ...selection, mask: [...newMask] };
                            setSelectionOrigin(originData);
                            selectionOriginRef.current = originData;
                          }
                        }}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setTooltip({ label: t('flipHorizontal'), description: t('flipHorizontalDesc'), x: rect.left + rect.width / 2, y: rect.top, side: 'top', align: 'center' });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                        className="p-1.5 hover:bg-white/5 rounded text-white/60 hover:text-white transition-colors"
                      >
                        <FlipHorizontal className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => {
                          if (selectedPixels.length === 0) {
                            detachSelection();
                          }
                          const pixelsToFlip = selectedPixels.length > 0 ? selectedPixels : [];
                          if (pixelsToFlip.length === 0) return;

                          const flipped = [...pixelsToFlip].map(p => ({
                            ...p,
                            y: selection.h - 1 - p.y
                          }));
                          setSelectedPixels(flipped);
                          const newMask = Array(project.width * project.height).fill(false);
                          flipped.forEach(p => {
                            const tx = selection.x + p.x;
                            const ty = selection.y + p.y;
                            if (tx >= 0 && tx < project.width && ty >= 0 && ty < project.height) {
                              newMask[ty * project.width + tx] = true;
                            }
                          });
                          setSelectionMask(newMask);
                          if (selectionOriginRef.current && selection && selection.x === selectionOriginRef.current.x && selection.y === selectionOriginRef.current.y) {
                            const originData = { ...selection, mask: [...newMask] };
                            setSelectionOrigin(originData);
                            selectionOriginRef.current = originData;
                          }
                        }}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setTooltip({ label: t('flipVertical'), description: t('flipVerticalDesc'), x: rect.left + rect.width / 2, y: rect.top, side: 'top', align: 'center' });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                        className="p-1.5 hover:bg-white/5 rounded text-white/60 hover:text-white transition-colors"
                      >
                        <FlipVertical className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => {
                          if (selectedPixels.length === 0) {
                            detachSelection();
                          }
                          const pixelsToRotate = selectedPixels.length > 0 ? selectedPixels : [];
                          if (pixelsToRotate.length === 0) return;

                          // Rotate 90 degrees clockwise around the center of the selection
                          const centerX = selection.x + selection.w / 2;
                          const centerY = selection.y + selection.h / 2;

                          const rotated = [...pixelsToRotate].map(p => ({
                            x: selection.h - 1 - p.y,
                            y: p.x,
                            color: p.color
                          }));

                          const newW = selection.h;
                          const newH = selection.w;
                          const newX = Math.round(centerX - newW / 2);
                          const newY = Math.round(centerY - newH / 2);

                          const newSelection = {
                            x: newX,
                            y: newY,
                            w: newW,
                            h: newH
                          };

                          setSelectedPixels(rotated);
                          setSelection(newSelection);

                          const newMask = Array(project.width * project.height).fill(false);
                          rotated.forEach(p => {
                            const tx = newSelection.x + p.x;
                            const ty = newSelection.y + p.y;
                            if (tx >= 0 && tx < project.width && ty >= 0 && ty < project.height) {
                              newMask[ty * project.width + tx] = true;
                            }
                          });
                          setSelectionMask(newMask);
                          if (selectionOriginRef.current && selection && selection.x === selectionOriginRef.current.x && selection.y === selectionOriginRef.current.y) {
                            const originData = { ...newSelection, mask: [...newMask] };
                            setSelectionOrigin(originData);
                            selectionOriginRef.current = originData;
                          }
                        }}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setTooltip({ label: t('rotate90'), description: t('rotate90Desc'), x: rect.left + rect.width / 2, y: rect.top, side: 'top', align: 'center' });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                        className="p-1.5 hover:bg-white/5 rounded text-white/60 hover:text-white transition-colors"
                      >
                        <RotateCw className="w-4 h-4" />
                      </button>

                      <div className="w-px h-4 bg-white/10 mx-1" />

                      <button 
                        onClick={addStamp}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setTooltip({ label: t('createStamp'), description: t('createStampDesc'), x: rect.left + rect.width / 2, y: rect.top, side: 'top', align: 'center' });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                        className="p-1.5 hover:bg-white/5 rounded text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        <StampIcon className="w-4 h-4" />
                      </button>

                      <div className="w-px h-4 bg-white/10 mx-1" />

                      <button 
                        onClick={cropProject}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setTooltip({ label: t('crop'), description: t('cropDesc'), x: rect.left + rect.width / 2, y: rect.top, side: 'top', align: 'center' });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                        className="p-1.5 hover:bg-white/5 rounded text-white/60 hover:text-white transition-colors"
                      >
                        <Crop className="w-4 h-4" />
                      </button>
                      <div className="w-px h-4 bg-white/10 mx-1" />
                      <button 
                        onClick={applySelection}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setTooltip({ label: t('confirm'), description: t('confirmSelectionDesc'), x: rect.left + rect.width / 2, y: rect.top, side: 'top', align: 'center' });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                        className="p-1.5 bg-blue-600 hover:bg-blue-500 rounded text-white transition-colors"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={cancelOrDeselectSelection}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const origin = selectionOriginRef.current || selectionOrigin;
                          const hasMoved = selection && origin && (selection.x !== origin.x || selection.y !== origin.y);
                          setTooltip({
                            label: hasMoved ? t('cancel') : t('deselect'),
                            description: hasMoved ? t('cancelSelectionDesc') : t('deselectDesc'),
                            x: rect.left + rect.width / 2,
                            y: rect.top,
                            side: 'top',
                            align: 'center'
                          });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                        className="p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded text-white/60 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Preview of selected pixels being moved */}
                    {selectedPixels.length > 0 && (
                      <>
                        {isTiledMode ? (
                          Array(9).fill(null).map((_, tileIdx) => {
                            const tx = tileIdx % 3;
                            const ty = Math.floor(tileIdx / 3);
                            if (!visibleTiles[tileIdx]) return null;
                            return (
                              <div 
                                key={`floating-tile-${tileIdx}`}
                                className="absolute z-20 pointer-events-none"
                                style={{
                                  left: `${(tx * selection.w) * 20 * zoom}px`,
                                  top: `${(ty * selection.h) * 20 * zoom}px`,
                                  width: `${selection.w * 20 * zoom}px`,
                                  height: `${selection.h * 20 * zoom}px`,
                                  opacity: (tx === 1 && ty === 1) ? 1 : tiledOpacity
                                }}
                              >
                                {selectedPixels.filter(p => p.color !== 'transparent').map((pixel, i) => (
                                  <div 
                                    key={`selection-pixel-${tileIdx}-${i}`}
                                    className="absolute pointer-events-none"
                                    style={{
                                      left: `${pixel.x * 20 * zoom}px`,
                                      top: `${pixel.y * 20 * zoom}px`,
                                      width: `${20 * zoom}px`,
                                      height: `${20 * zoom}px`,
                                      backgroundColor: pixel.color
                                    }}
                                  />
                                ))}
                              </div>
                            );
                          })
                        ) : (
                          <div 
                            className="absolute z-20 pointer-events-none"
                            style={{
                              left: `${(selection.x + (isMirrorMode && ['left', 'right'].includes(mirrorDirection) ? project.width : 0)) * 20 * zoom}px`,
                              top: `${(selection.y + (isMirrorMode && ['top', 'bottom'].includes(mirrorDirection) ? project.height : 0)) * 20 * zoom}px`,
                              width: `${selection.w * 20 * zoom}px`,
                              height: `${selection.h * 20 * zoom}px`,
                            }}
                          >
                            {selectedPixels.filter(p => p.color !== 'transparent').map((pixel, i) => (
                              <div 
                                key={`selection-pixel-${i}`}
                                className="absolute pointer-events-none"
                                style={{
                                  left: `${pixel.x * 20 * zoom}px`,
                                  top: `${pixel.y * 20 * zoom}px`,
                                  width: `${20 * zoom}px`,
                                  height: `${20 * zoom}px`,
                                  backgroundColor: pixel.color
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}

              {/* Checkerboard background */}
              <div className="absolute inset-0 -z-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20" />
            </div>
            
            {/* Zoom Controls */}
            <div className="absolute bottom-6 right-6 flex items-center gap-4 bg-[#1a1a1a] px-4 py-2 rounded-full border border-white/10 shadow-xl z-30">
              <button onClick={() => setZoom(Math.max(0.5, zoom - 0.1))} className="text-white/40 hover:text-white">-</button>
              <span className="text-[10px] font-mono min-w-[40px] text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(Math.min(3, zoom + 0.1))} className="text-white/40 hover:text-white">+</button>
            </div>
          </main>

          {/* Timeline / Frames */}
          <footer 
            className="bg-[#1a1a1a] border-t border-white/10 flex flex-col relative overflow-visible shrink-0 z-[1000000]"
            style={{ height: `${timelineHeight}px`, minHeight: '160px' }}
          >
            {/* Resizer Handle */}
            <div 
              className="absolute top-0 left-0 right-0 h-1.5 -translate-y-1/2 cursor-row-resize hover:bg-blue-500/50 active:bg-blue-500 transition-colors z-[1000001]"
              onMouseDown={(e) => {
                e.preventDefault();
                setIsResizingTimeline(true);
              }}
            />

            <div className="flex items-center justify-between px-4 h-[41px] border-b border-white/10 shrink-0 relative -top-[1px] bg-[#1a1a1a]">
              <div className="flex items-center gap-2">
                <Film className="w-4 h-4 text-white/40" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">{t('frames')}</span>
              </div>
              
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-white/40 uppercase">{t('speed')}</span>
                  <input 
                    type="range" 
                    min="0.1" 
                    max="5" 
                    step="0.1"
                    value={previewSpeed} 
                    onChange={(e) => setPreviewSpeed(parseFloat(e.target.value))}
                    className="w-20 accent-blue-600 h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
                  />
                  <span className="text-[10px] font-mono text-white/60 w-6">{previewSpeed.toFixed(1)}x</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-white/40 uppercase">Ping-Pong</span>
                  <button 
                    onClick={() => setIsPingPong(!isPingPong)}
                    className={cn(
                      "w-8 h-4 rounded-full relative transition-colors duration-200",
                      isPingPong ? "bg-blue-600" : "bg-white/10"
                    )}
                  >
                    <div className={cn(
                      "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all duration-200",
                      isPingPong ? "left-4.5" : "left-0.5"
                    )} />
                  </button>
                </div>
              </div>
            </div>
            <div className="flex-1 flex items-center px-4 gap-4 overflow-hidden">
              <div className="flex flex-col justify-center shrink-0 min-w-[84px]">
                <div className="flex flex-col items-center gap-2 relative">
                  <button 
                    onClick={() => setIsPlaying(!isPlaying)}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                    setTooltip({
                      label: isPlaying ? t('pauseAnimation') : t('playAnimation'),
                      description: isPlaying ? t('pauseAnimationDesc') : t('playAnimationDesc'),
                      x: rect.left + rect.width / 2,
                      y: rect.top - 8,
                      side: 'top',
                      align: 'center'
                    });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                    className="p-3 rounded-full transition-all shadow-lg bg-blue-600 hover:bg-blue-500"
                  >
                    {isPlaying ? <Square className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
                  </button>
                  <span className="text-[10px] uppercase font-bold text-white/20 tracking-widest">{isPlaying ? 'Stop' : 'Play'}</span>
                </div>
              </div>

              <div className="w-px h-12 bg-white/10 shrink-0" />

              <div className="flex-1 h-full flex gap-2 overflow-x-auto overflow-y-visible custom-scrollbar items-center px-2 relative z-[1000000]">
              <DndContext 
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(e) => handleDragEnd(e, 'frames')}
              >
                <SortableContext 
                  items={project.frames.map(f => f.id)}
                  strategy={horizontalListSortingStrategy}
                >
                      {project.frames.map((frame, idx) => (
                        <SortableFrame 
                          key={frame.id}
                          frame={frame}
                          idx={idx}
                          currentFrameIndex={currentFrameIndex}
                          setCurrentFrameIndex={setCurrentFrameIndex}
                          deleteFrame={deleteFrame}
                          toggleOnionSkin={toggleOnionSkin}
                          toggleFrameLock={toggleFrameLock}
                          duplicateFrame={duplicateFrame}
                          updateFrameDuration={updateFrameDuration}
                          project={project}
                          transparencyMode={transparencyMode}
                          setTooltip={setTooltip}
                        />
                      ))}
                </SortableContext>
              </DndContext>
              <div className="flex flex-col items-center min-w-[84px] shrink-0">
                <div className="relative">
                  <button 
                    onClick={addFrame}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setTooltip({
                        label: t('newFrame'),
                        description: t('newFrameDesc'),
                        x: rect.left + rect.width / 2,
                        y: rect.top - 8,
                        side: 'top',
                        align: 'center'
                      });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                    className="w-20 h-20 rounded-xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-2 hover:border-white/20 hover:bg-white/5 transition-all"
                  >
                    <Plus className="w-4 h-4 text-white/20" />
                    <span className="text-[8px] font-bold text-white/20 uppercase">{t('addFrame')}</span>
                  </button>
                </div>
                {/* Placeholder to match SortableFrame's drag handle for vertical alignment */}
                <div className="mt-2 h-4" />
              </div>
            </div>
          </div>
        </footer>
        </div>

        {/* Right Panel: Layers, Palette & Harmony */}
        <aside 
          style={{ width: `${rightPanelWidth}px` }}
          className="bg-[#1a1a1a] border-l border-white/10 flex flex-col overflow-hidden z-[999999] relative shrink-0"
        >
          {/* Resizer Handle */}
          <div 
            className={cn(
              "absolute top-0 bottom-0 left-0 w-1.5 -translate-x-1/2 cursor-col-resize hover:bg-blue-500/50 transition-colors z-[99999]",
              isResizingRightPanel ? "bg-blue-500" : "bg-transparent"
            )}
            onMouseDown={(e) => {
              e.preventDefault();
              setIsResizingRightPanel(true);
            }}
          />
          <div className="flex-1 flex flex-row overflow-hidden relative">
            {/* Layers & Brushes Section */}
            <div 
              style={{ width: `${layersWidth}px`, minWidth: '300px' }}
              className="border-r border-white/10 flex flex-col overflow-hidden shrink-0"
            >
              {/* Grid Settings Section */}
              {showGrid && (
                <div className="flex flex-col border-b border-white/10 bg-[#1a1a1a]">
                  <div 
                    className="px-4 h-[41px] border-b border-white/10 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors bg-[#1a1a1a] shrink-0"
                    onClick={() => setIsGridSettingsCollapsed(!isGridSettingsCollapsed)}
                  >
                    <div className="flex items-center gap-2">
                      <Grid2X2 className="w-4 h-4 text-white/40" />
                      <h3 className="text-[10px] font-bold text-white/60 uppercase tracking-widest">{t('gridSettings')}</h3>
                    </div>
                    {isGridSettingsCollapsed ? <ChevronDown className="w-4 h-4 text-white/40" /> : <ChevronUp className="w-4 h-4 text-white/40" />}
                  </div>
                  {!isGridSettingsCollapsed && (
                    <div className="p-4 flex flex-col gap-4">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] text-white/40 uppercase font-bold">{t('gridSize')}</label>
                          <span className="text-[10px] text-white/60">{gridSize}px</span>
                        </div>
                        <input 
                          type="range" 
                          min="1" 
                          max="64" 
                          value={gridSize} 
                          onChange={(e) => setGridSize(parseInt(e.target.value))}
                          className="w-full accent-blue-600"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                          <label className="text-[10px] text-white/40 uppercase font-bold">{t('offsetX')}</label>
                          <input 
                            type="number" 
                            value={gridOffsetX} 
                            onChange={(e) => setGridOffsetX(parseInt(e.target.value) || 0)}
                            className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white outline-none focus:border-blue-500"
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <label className="text-[10px] text-white/40 uppercase font-bold">{t('offsetY')}</label>
                          <input 
                            type="number" 
                            value={gridOffsetY} 
                            onChange={(e) => setGridOffsetY(parseInt(e.target.value) || 0)}
                            className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tiled Mode Settings Section */}
              {isTiledMode && (
                <div className="flex flex-col border-b border-white/10 bg-[#1a1a1a]">
                  <div 
                    className="px-4 h-[41px] border-b border-white/10 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors bg-[#1a1a1a] shrink-0"
                    onClick={() => setIsTiledSettingsCollapsed(!isTiledSettingsCollapsed)}
                  >
                    <div className="flex items-center gap-2">
                      <TiledModeIcon className="w-4 h-4 text-white/40" />
                      <h3 className="text-[10px] font-bold text-white/60 uppercase tracking-widest">{t('tiledModeSettings')}</h3>
                    </div>
                    {isTiledSettingsCollapsed ? <ChevronDown className="w-4 h-4 text-white/40" /> : <ChevronUp className="w-4 h-4 text-white/40" />}
                  </div>
                  {!isTiledSettingsCollapsed && (
                    <div className="p-4 flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] text-white/40 uppercase font-bold">{t('seamlessBrush')}</label>
                        <button 
                          onClick={() => setIsSeamlessBrush(!isSeamlessBrush)}
                          className={cn(
                            "px-2 py-1 rounded text-[10px] font-bold transition-colors",
                            isSeamlessBrush ? "bg-blue-600 text-white" : "bg-white/5 text-white/40 hover:bg-white/10"
                          )}
                        >
                          {isSeamlessBrush ? 'ON' : 'OFF'}
                        </button>
                      </div>

                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] text-white/40 uppercase font-bold">{t('opacity')}</label>
                          <span className="text-[10px] text-white/60">{Math.round(tiledOpacity * 100)}%</span>
                        </div>
                        <input 
                          type="range" 
                          min="0.1" 
                          max="1" 
                          step="0.1" 
                          value={tiledOpacity} 
                          onChange={(e) => setTiledOpacity(parseFloat(e.target.value))}
                          className="w-full accent-blue-600"
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] text-white/40 uppercase font-bold text-center">Visible Tiles (3x3)</label>
                        <div className="grid grid-cols-3 gap-1 w-fit mx-auto p-1 bg-black/20 rounded-md border border-white/5">
                          {visibleTiles.map((visible, idx) => (
                            <button
                              key={`tile-toggle-${idx}`}
                              disabled={idx === 4}
                              onClick={() => {
                                if (idx === 4) return;
                                const next = [...visibleTiles];
                                next[idx] = !next[idx];
                                setVisibleTiles(next);
                              }}
                              className={cn(
                                "w-8 h-8 rounded-sm transition-all border flex items-center justify-center",
                                idx === 4 ? "bg-blue-600/40 border-blue-500/50 cursor-default" :
                                visible ? "bg-blue-600 border-blue-500 hover:bg-blue-500 shadow-[0_0_8px_rgba(37,99,235,0.4)]" : "bg-white/5 border-white/10 hover:bg-white/10"
                              )}
                            >
                              {idx === 4 && <div className="w-2 h-2 bg-white rounded-full animate-pulse" />}
                            </button>
                          ))}
                        </div>
                        <p className="text-[8px] text-white/40 text-center mt-1 italic">{t('clickToggleCopies')}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Mirror Mode Settings Section */}
              {isMirrorMode && (
                <div className="flex flex-col border-b border-white/10 bg-[#1a1a1a]">
                  <div 
                    className="px-4 h-[41px] border-b border-white/10 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors bg-[#1a1a1a] shrink-0"
                    onClick={() => setIsMirrorSettingsCollapsed(!isMirrorSettingsCollapsed)}
                  >
                    <div className="flex items-center gap-2">
                      <FlipHorizontal className="w-4 h-4 text-white/40" />
                      <h3 className="text-[10px] font-bold text-white/60 uppercase tracking-widest">{t('mirrorModeSettings')}</h3>
                    </div>
                    {isMirrorSettingsCollapsed ? <ChevronDown className="w-4 h-4 text-white/40" /> : <ChevronUp className="w-4 h-4 text-white/40" />}
                  </div>
                  {!isMirrorSettingsCollapsed && (
                    <div className="p-4 flex flex-col gap-4">
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] text-white/40 uppercase font-bold">{t('direction')}</label>
                        <div className="flex items-center gap-1">
                          {(['left', 'right', 'top', 'bottom'] as const).map(dir => (
                            <button
                              key={dir}
                              onClick={() => setMirrorDirection(dir)}
                              className={cn(
                                "flex-1 h-8 flex items-center justify-center rounded transition-all",
                                mirrorDirection === dir ? "bg-purple-600 text-white" : "bg-white/10 text-white/40 hover:bg-white/20"
                              )}
                            >
                              {dir === 'left' && <ChevronLeft className="w-4 h-4" />}
                              {dir === 'right' && <ChevronRight className="w-4 h-4" />}
                              {dir === 'top' && <ChevronUp className="w-4 h-4" />}
                              {dir === 'bottom' && <ChevronDown className="w-4 h-4" />}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] text-white/40 uppercase font-bold">{t('opacity')}</label>
                          <span className="text-[10px] text-white/60">{Math.round(mirrorOpacity * 100)}%</span>
                        </div>
                        <input 
                          type="range" 
                          min="0.1" 
                          max="1" 
                          step="0.1" 
                          value={mirrorOpacity} 
                          onChange={(e) => setMirrorOpacity(parseFloat(e.target.value))}
                          className="w-full accent-purple-600"
                        />
                      </div>
                      <button
                        onClick={handleApplyMirror}
                        className="w-full py-2 bg-purple-600 hover:bg-purple-500 rounded text-[10px] font-bold text-white transition-colors mt-2"
                      >
                        APPLY REFLECTION
                      </button>
                    </div>
                  )}
                </div>
              )}

              {tool === 'magic-wand' && (
                <div className="flex flex-col border-b border-white/10 bg-[#1a1a1a]">
                  <div className="px-4 h-[41px] border-b border-white/10 flex items-center gap-2 bg-[#1a1a1a] shrink-0">
                    <Settings2 className="w-4 h-4 text-white/40" />
                    <h3 className="text-xs font-bold text-white/60 uppercase tracking-widest">{t('magicWand')}</h3>
                  </div>
                  <div className="p-4 space-y-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setMagicWandMode('connected')}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setTooltip({ label: t('connected'), description: t('connectedDesc'), x: rect.left + rect.width / 2, y: rect.top, side: 'top', align: 'center' });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                        className={cn("flex-1 p-2 rounded text-xs", magicWandMode === 'connected' ? "bg-blue-600" : "bg-white/10")}
                      >
                        Conectado
                      </button>
                      <button
                        onClick={() => setMagicWandMode('all')}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setTooltip({ label: t('all'), description: t('allDesc'), x: rect.left + rect.width / 2, y: rect.top, side: 'top', align: 'center' });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                        className={cn("flex-1 p-2 rounded text-xs", magicWandMode === 'all' ? "bg-blue-600" : "bg-white/10")}
                      >
                        Tudo
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {['line', 'square', 'circle'].includes(tool) && (
                <div className="flex flex-col border-b border-white/10 bg-[#1a1a1a]">
                  <div className="px-4 h-[41px] border-b border-white/10 flex items-center gap-2 bg-[#1a1a1a] shrink-0">
                    <Settings2 className="w-4 h-4 text-white/40" />
                    <h3 className="text-xs font-bold text-white/60 uppercase tracking-widest">{t('toolOptions')}</h3>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <label 
                        className="text-[10px] text-white/40 uppercase font-bold cursor-help"
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setTooltip({ 
                            label: t('pixelPerfect'), 
                            description: t('pixelPerfectDesc'), 
                            x: rect.left + rect.width / 2, 
                            y: rect.top, 
                            side: 'top', 
                            align: 'center' 
                          });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        Modo Pixel Perfect
                      </label>
                      <button 
                        onClick={() => setPixelPerfect(!pixelPerfect)}
                        className={cn(
                          "px-2 py-1 rounded text-[10px] font-bold transition-colors",
                          pixelPerfect ? "bg-blue-600 text-white" : "bg-white/5 text-white/40 hover:bg-white/10"
                        )}
                      >
                        {pixelPerfect ? 'ON' : 'OFF'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {tool === 'color-replace' && (
                <div className="flex flex-col border-b border-white/10 bg-[#1a1a1a]">
                  <div className="px-4 h-[41px] border-b border-white/10 flex items-center gap-2 bg-[#1a1a1a] shrink-0">
                    <Settings2 className="w-4 h-4 text-white/40" />
                    <h3 className="text-xs font-bold text-white/60 uppercase tracking-widest">{t('colorReplace')}</h3>
                  </div>
                  <div className="p-4">
                    <label className="flex items-center gap-2 text-xs text-white/80 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={replaceAllFramesAndLayers}
                        onChange={(e) => setReplaceAllFramesAndLayers(e.target.checked)}
                        className="rounded border-white/10 bg-black/40 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                      />
                      Substituir em todos os frames e camadas
                    </label>
                  </div>
                </div>
              )}

              <div className="flex border-b border-white/10 bg-[#1a1a1a] h-[41px] shrink-0">
                <button
                  onClick={() => setActiveRightTab('layers')}
                  className={cn("flex-1 px-4 h-full flex items-center justify-center gap-2 border-b-2 transition-colors", activeRightTab === 'layers' ? "border-blue-500 text-white" : "border-transparent text-white/60 hover:text-white/80")}
                >
                  <LayersIcon className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">{t('layers')}</span>
                </button>
                <button
                  onClick={() => setActiveRightTab('brushes')}
                  className={cn("flex-1 px-4 h-full flex items-center justify-center gap-2 border-b-2 transition-colors", activeRightTab === 'brushes' ? "border-blue-500 text-white" : "border-transparent text-white/60 hover:text-white/80")}
                >
                  <Brush className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">{t('brushes')}</span>
                </button>
              </div>

              {activeRightTab === 'layers' && (
                <div className="flex flex-col h-full overflow-hidden">
                  <div className="px-4 h-[41px] flex items-center gap-2 bg-[#1a1a1a] shrink-0">
                    <h3 className="text-[10px] font-bold text-white/60 uppercase tracking-widest">{t('layers')}</h3>
                    <div className="relative group ml-auto">
                      <button onClick={addLayer} className="p-1 hover:bg-white/5 rounded text-blue-400">
                        <Plus className="w-4 h-4" />
                      </button>
                      <div className="absolute top-full right-0 mt-2 px-3 py-2 bg-[#1a1a1a] border border-white/10 text-white rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all transform translate-y-[-10px] group-hover:translate-y-0 whitespace-nowrap z-[99999] shadow-xl">
                        <div className="text-xs font-bold mb-0.5">{t('newLayer')}</div>
                        <div className="text-[10px] text-white/60">Adiciona uma nova camada ao projeto.</div>
                      </div>
                    </div>
                    <div className="relative group">
                      <button onClick={mergeAllLayers} className="p-1 hover:bg-white/5 rounded text-blue-400">
                        <ArrowDownToLine className="w-4 h-4" />
                      </button>
                      <div className="absolute top-full right-0 mt-2 px-3 py-2 bg-[#1a1a1a] border border-white/10 text-white rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all transform translate-y-[-10px] group-hover:translate-y-0 whitespace-nowrap z-[99999] shadow-xl">
                        <div className="text-xs font-bold mb-0.5">{t('mergeAll')}</div>
                        <div className="text-[10px] text-white/60">Combina todas as camadas em uma só.</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-2 pt-0 p-4 custom-scrollbar">
                    <DndContext 
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(e) => handleDragEnd(e, 'layers')}
                    >
                      <SortableContext 
                        items={project.layers.map(l => l.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {project.layers.map((layer, index) => (
                          <SortableLayer 
                            key={layer.id}
                            layer={layer}
                            currentLayerId={currentLayerId}
                            setCurrentLayerId={setCurrentLayerId}
                            updateLayer={updateLayer}
                            deleteLayer={deleteLayer}
                            mergeLayerDown={mergeLayerDown}
                            isLastLayer={index === project.layers.length - 1}
                            editingLayerId={editingLayerId}
                            setEditingLayerId={setEditingLayerId}
                            setTooltip={setTooltip}
                            currentFrame={currentFrame}
                            width={project.width}
                            height={project.height}
                            transparencyMode={transparencyMode}
                            canDelete={project.layers.length > 1}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>
                  </div>
                </div>
              )}
              
              {activeRightTab === 'brushes' && (
                <div className="flex flex-col h-full overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/10 flex flex-col gap-3 bg-[#1a1a1a] shrink-0">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <label 
                          className="text-[10px] text-white/40 uppercase font-bold cursor-help"
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setTooltip({ label: t('globalAlign'), description: t('globalAlignDesc'), x: rect.left + rect.width / 2, y: rect.top, side: 'top', align: 'center' });
                          }}
                          onMouseLeave={() => setTooltip(null)}
                        >
                          Alinhamento Global
                        </label>
                        <button 
                          onClick={() => setGlobalBrushAlignment(!globalBrushAlignment)}
                          className={cn(
                            "px-2 py-1 rounded text-[10px] font-bold transition-colors",
                            globalBrushAlignment ? "bg-blue-600 text-white" : "bg-white/5 text-white/40 hover:bg-white/10"
                          )}
                        >
                          {globalBrushAlignment ? 'ON' : 'OFF'}
                        </button>
                      </div>
                      
                      {globalBrushAlignment && (
                        <div className="flex flex-col gap-1.5 pl-6">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-white/40">X</span>
                              <input 
                                type="number" 
                                value={globalAlignmentOffsetX}
                                onChange={(e) => setGlobalAlignmentOffsetX(parseInt(e.target.value) || 0)}
                                onMouseEnter={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setTooltip({ label: t('offsetX'), description: t('offsetXDesc'), x: rect.left + rect.width / 2, y: rect.top, side: 'top', align: 'center' });
                                }}
                                onMouseLeave={() => setTooltip(null)}
                                className="w-10 bg-black/40 border border-white/10 rounded px-1 py-0.5 text-[10px] text-white"
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-white/40">Y</span>
                              <input 
                                type="number" 
                                value={globalAlignmentOffsetY}
                                onChange={(e) => setGlobalAlignmentOffsetY(parseInt(e.target.value) || 0)}
                                onMouseEnter={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setTooltip({ label: t('offsetY'), description: t('offsetYDesc'), x: rect.left + rect.width / 2, y: rect.top, side: 'top', align: 'center' });
                                }}
                                onMouseLeave={() => setTooltip(null)}
                                className="w-10 bg-black/40 border border-white/10 rounded px-1 py-0.5 text-[10px] text-white"
                              />
                            </div>
                            <button 
                              onClick={() => {
                                setGlobalAlignmentOffsetX(0);
                                setGlobalAlignmentOffsetY(0);
                              }}
                              onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setTooltip({ label: t('resetOffset'), description: t('resetOffsetDesc'), x: rect.left + rect.width / 2, y: rect.top, side: 'top', align: 'center' });
                              }}
                              onMouseLeave={() => setTooltip(null)}
                              className="p-1 hover:bg-white/5 rounded text-white/40 hover:text-white transition-colors"
                            >
                              <RotateCcw className="w-3 h-3" />
                            </button>
                          </div>
                          <p className="text-[9px] text-white/30 leading-tight">
                            Ajusta a origem do padrão repetido em relação à grade global.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="px-4 h-[41px] flex items-center gap-2 bg-[#1a1a1a] shrink-0">
                    <h3 className="text-[10px] font-bold text-white/60 uppercase tracking-widest">{t('brushes')}</h3>
                    <div className="flex items-center ml-auto gap-1">
                      <select 
                        value={activeBrushFolderId || ''} 
                        onChange={(e) => setActiveBrushFolderId(e.target.value || null)}
                        className="bg-black/40 border border-white/10 rounded px-2 py-1 text-[10px] text-white/80 focus:outline-none focus:border-white/20"
                      >
                        <option value="">{t('allFolders')}</option>
                        {brushFolders.map(f => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </select>
                      <button 
                        onClick={() => setFolderModal({ isOpen: true, type: 'brush' })}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setTooltip({ label: t('newFolder'), description: t('newFolderDescBrushes'), x: rect.left + rect.width / 2, y: rect.top, side: 'top', align: 'center' });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                        className="p-1 hover:bg-white/5 rounded text-yellow-400"
                      >
                        <FolderPlus className="w-4 h-4" />
                      </button>
                      {activeBrushFolderId && (
                        <>
                          <button 
                            onClick={() => {
                              const folder = brushFolders.find(f => f.id === activeBrushFolderId);
                              if (folder) setFolderModal({ isOpen: true, type: 'brush', folder });
                            }}
                            onMouseEnter={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setTooltip({ label: t('editFolder'), description: t('editFolderDesc'), x: rect.left + rect.width / 2, y: rect.top, side: 'top', align: 'center' });
                            }}
                            onMouseLeave={() => setTooltip(null)}
                            className="p-1 hover:bg-white/5 rounded text-white/60 hover:text-white"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => {
                              if (window.confirm('Excluir esta pasta? Os pincéis dentro dela não serão excluídos.')) {
                                setTooltip(null);
                                const newFolders = project.folders?.filter(f => f.id !== activeBrushFolderId) || [];
                                const newBrushes = project.brushes?.map(b => b.folderId === activeBrushFolderId ? { ...b, folderId: undefined } : b) || [];
                                const newProject = { ...project, folders: newFolders, brushes: newBrushes };
                                setProject(newProject);
                                saveToHistory(newProject);
                                setActiveBrushFolderId(null);
                              }
                            }}
                            onMouseEnter={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setTooltip({ label: t('deleteFolder'), description: t('deleteFolderDesc'), x: rect.left + rect.width / 2, y: rect.top, side: 'top', align: 'center' });
                            }}
                            onMouseLeave={() => setTooltip(null)}
                            className="p-1 hover:bg-white/5 rounded text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      <button 
                        onClick={() => {
                          setEditingBrush({
                            id: Date.now().toString(),
                            name: 'Novo Pincel',
                            width: 3,
                            height: 3,
                            pixels: Array(9).fill(false),
                            folderId: activeBrushFolderId || undefined
                          });
                          setIsBrushEditorOpen(true);
                        }} 
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setTooltip({ label: t('newBrush'), description: t('newBrushDesc'), x: rect.left + rect.width / 2, y: rect.top, side: 'top', align: 'center' });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                        className="p-1 hover:bg-white/5 rounded text-blue-400"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 custom-scrollbar flex flex-col gap-6">
                    <div style={{ containerType: 'inline-size' }} className="w-full shrink-0">
                      <div 
                        style={{ maxHeight: 'calc(100cqw + 4px)' }} 
                        className="overflow-y-auto custom-scrollbar pr-1 -mr-1"
                      >
                        <div className="grid grid-cols-4 gap-2 pb-1">
                          <DndContext 
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragStart={handleDragStart}
                            onDragEnd={(e) => handleDragEnd(e, 'brushes')}
                          >
                            <SortableContext 
                              items={filteredBrushes.map(b => b.id)}
                              strategy={rectSortingStrategy}
                            >
                              {filteredBrushes.map(brush => (
                                <BrushItem 
                                  key={brush.id}
                                  brush={brush}
                                  activeBrushId={activeBrushId}
                                  setActiveBrushId={setActiveBrushId}
                                  setTool={setTool}
                                  setActiveStampId={setActiveStampId}
                                  setProject={setProject}
                                  project={project}
                                  saveToHistory={saveToHistory}
                                  rotateBrush={rotateBrush}
                                  flipBrush={flipBrush}
                                  setEditingBrush={setEditingBrush}
                                  setIsBrushEditorOpen={setIsBrushEditorOpen}
                                  setTooltip={setTooltip}
                                  isDraggingAny={!!activeId}
                                  transparencyMode={transparencyMode}
                                  setMoveFolderModal={setMoveFolderModal}
                                />
                              ))}
                            </SortableContext>
                          </DndContext>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-6 border-t border-white/10 pt-4">
                      <div className="flex items-center gap-2 mb-3">
                        <h3 className="text-[10px] font-bold text-white/60 uppercase tracking-widest">{t('stamps')}</h3>
                        <div className="flex items-center ml-auto gap-1">
                          <select 
                            value={activeStampFolderId || ''} 
                            onChange={(e) => setActiveStampFolderId(e.target.value || null)}
                            className="bg-black/40 border border-white/10 rounded px-2 py-1 text-[10px] text-white/80 focus:outline-none focus:border-white/20"
                          >
                            <option value="">{t('allFolders')}</option>
                            {stampFolders.map(f => (
                              <option key={f.id} value={f.id}>{f.name}</option>
                            ))}
                          </select>
                          <button 
                            onClick={() => setFolderModal({ isOpen: true, type: 'stamp' })}
                            onMouseEnter={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setTooltip({ label: t('newFolder'), description: t('newFolderDescStamps'), x: rect.left + rect.width / 2, y: rect.top, side: 'top', align: 'center' });
                            }}
                            onMouseLeave={() => setTooltip(null)}
                            className="p-1 hover:bg-white/5 rounded text-yellow-400"
                          >
                            <FolderPlus className="w-4 h-4" />
                          </button>
                          {activeStampFolderId && (
                            <>
                              <button 
                                onClick={() => {
                                  const folder = stampFolders.find(f => f.id === activeStampFolderId);
                                  if (folder) setFolderModal({ isOpen: true, type: 'stamp', folder });
                                }}
                                onMouseEnter={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setTooltip({ label: t('editFolder'), description: t('editFolderDesc'), x: rect.left + rect.width / 2, y: rect.top, side: 'top', align: 'center' });
                                }}
                                onMouseLeave={() => setTooltip(null)}
                                className="p-1 hover:bg-white/5 rounded text-white/60 hover:text-white"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => {
                                  if (window.confirm('Excluir esta pasta? As estampas dentro dela não serão excluídas.')) {
                                    setTooltip(null);
                                    const newFolders = project.folders?.filter(f => f.id !== activeStampFolderId) || [];
                                    const newStamps = project.stamps?.map(s => s.folderId === activeStampFolderId ? { ...s, folderId: undefined } : s) || [];
                                    const newProject = { ...project, folders: newFolders, stamps: newStamps };
                                    setProject(newProject);
                                    saveToHistory(newProject);
                                    setActiveStampFolderId(null);
                                  }
                                }}
                                onMouseEnter={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setTooltip({ label: t('deleteFolder'), description: t('deleteFolderDesc'), x: rect.left + rect.width / 2, y: rect.top, side: 'top', align: 'center' });
                                }}
                                onMouseLeave={() => setTooltip(null)}
                                className="p-1 hover:bg-white/5 rounded text-red-400"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          <button 
                            onClick={addStamp}
                            onMouseEnter={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setTooltip({ label: t('addStamp'), description: t('addStampDesc'), x: rect.left + rect.width / 2, y: rect.top, side: 'top', align: 'center' });
                            }}
                            onMouseLeave={() => setTooltip(null)}
                            className="p-1 hover:bg-white/5 rounded text-blue-400"
                          >
                            <StampIcon className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setIsImportStampModalOpen(true)}
                            onMouseEnter={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setTooltip({ label: t('importStamp'), description: t('importStampDesc'), x: rect.left + rect.width / 2, y: rect.top, side: 'top', align: 'center' });
                            }}
                            onMouseLeave={() => setTooltip(null)}
                            className="p-1 hover:bg-white/5 rounded text-green-400"
                          >
                            <Upload className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      <div style={{ containerType: 'inline-size' }} className="w-full shrink-0">
                        <div 
                          style={{ maxHeight: 'calc(100cqw + 4px)' }} 
                          className="overflow-y-auto custom-scrollbar pr-1 -mr-1"
                        >
                          <div className="grid grid-cols-4 gap-2 pb-1">
                            <DndContext 
                              sensors={sensors}
                              collisionDetection={closestCenter}
                              onDragStart={handleDragStart}
                              onDragEnd={(e) => handleDragEnd(e, 'stamps')}
                            >
                              <SortableContext 
                                items={filteredStamps.map(s => s.id)}
                                strategy={rectSortingStrategy}
                              >
                                {filteredStamps.map(stamp => (
                                  <StampItem 
                                    key={stamp.id}
                                    stamp={stamp}
                                    activeBrushId={activeBrushId}
                                    activeStampId={activeStampId}
                                    setActiveStampId={setActiveStampId}
                                    setActiveBrushId={setActiveBrushId}
                                    setTool={setTool}
                                    project={project}
                                    setProject={setProject}
                                    saveToHistory={saveToHistory}
                                    rotateStamp={rotateStamp}
                                    flipStamp={flipStamp}
                                    exportStampAsPNG={exportStampAsPNG}
                                    setTooltip={setTooltip}
                                    isDraggingAny={!!activeId}
                                    setMoveFolderModal={setMoveFolderModal}
                                  />
                                ))}
                              </SortableContext>
                            </DndContext>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}


            </div>

            {/* Combined Harmony & Palette Section */}
            <div 
              style={{ minWidth: '300px' }}
              className="flex-1 flex flex-col overflow-hidden relative"
            >
              {/* Layers Resizer Handle */}
              <div 
                className={cn(
                  "absolute top-0 bottom-0 left-0 w-1.5 -translate-x-1/2 cursor-col-resize hover:bg-blue-500/50 transition-colors z-[99999]",
                  isResizingLayers ? "bg-blue-500" : "bg-transparent"
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setIsResizingLayers(true);
                }}
              />
              <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
              {/* Harmony Section */}
              <div className={cn(
                "flex flex-col overflow-hidden transition-all duration-300",
                isHarmonyMinimized ? "h-[41px] shrink-0" : "flex-1 min-h-[400px]"
              )}>
                <div className="px-4 h-[41px] border-b border-white/10 flex items-center justify-between bg-[#1a1a1a] shrink-0">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-white/40" />
                    <h3 className="text-[10px] font-bold text-white/60 uppercase tracking-widest">{t('harmony')}</h3>
                  </div>
                  <button 
                    onClick={() => setIsHarmonyMinimized(!isHarmonyMinimized)}
                    className="p-1 hover:bg-white/5 rounded text-white/40 hover:text-white transition-colors"
                    title={isHarmonyMinimized ? t('expand') : t('minimize')}
                  >
                    {isHarmonyMinimized ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                  </button>
                </div>
                {!isHarmonyMinimized && (
                  <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <ColorHarmony 
                      baseColor={(activeColorSlot === 1 ? selectedColor : secondaryColor) === 'transparent' ? '#000000' : (activeColorSlot === 1 ? selectedColor : secondaryColor)} 
                      onAddColor={(color) => setPaletteSelectionModal({ isOpen: true, colors: [color], selectedColors: [color] })}
                      onAddAllColors={(colors) => setPaletteSelectionModal({ isOpen: true, colors, selectedColors: colors })}
                      onBaseColorChange={(color) => handleSelectColor(color)}
                      onMouseEnterTooltip={(label, description, e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTooltip({ label, description, x: rect.left + rect.width / 2, y: rect.top, side: 'top', align: 'center' });
                      }}
                      onMouseLeaveTooltip={() => setTooltip(null)}
                    />
                  </div>
                )}
              </div>

              {/* Palette Section */}
              <div 
                style={!isHarmonyMinimized ? { height: `${palettesHeight}px` } : {}}
                className={cn(
                  "border-t border-white/10 flex flex-col overflow-hidden relative transition-all duration-300",
                  isHarmonyMinimized ? "flex-1" : "shrink min-h-[150px]"
                )}
              >
                {/* Palettes Resizer Handle */}
                {!isHarmonyMinimized && (
                  <div 
                    className="absolute top-0 left-0 right-0 h-1.5 -translate-y-1/2 cursor-row-resize hover:bg-blue-500/50 active:bg-blue-500 transition-colors z-[99999]"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setIsResizingPalettes(true);
                    }}
                  />
                )}
                <div className="px-4 h-[41px] border-b border-white/10 flex items-center gap-2 bg-[#1a1a1a] shrink-0">
                  <PaletteIcon className="w-4 h-4 text-white/40" />
                  <h3 className="text-[10px] font-bold text-white/60 uppercase tracking-widest">{t('colorPalettes')}</h3>
                </div>
                <div className="p-4 flex flex-col h-full overflow-hidden">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[10px] font-bold text-white/60 uppercase tracking-widest">{t('palettes')}</h3>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={extractPaletteFromDrawing} 
                        className="p-1 hover:bg-white/5 rounded text-amber-400 hover:text-amber-300 transition-colors"
                        title={t('extractPaletteDesc')}
                      >
                        <Sparkles className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setImportPaletteModal(true)} 
                        className="p-1 hover:bg-white/5 rounded text-white/40 hover:text-white transition-colors"
                        title={t('importPalette')}
                      >
                        <Upload className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={createPalette} 
                        className="p-1 hover:bg-white/5 rounded text-blue-400 hover:text-blue-300 transition-colors"
                        title={t('newPalette')}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                    <DndContext 
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(e) => handleDragEnd(e, 'palette')}
                      onDragStart={handleDragStart}
                    >
                      {project.palettes.map(palette => (
                        <div key={palette.id} className="mb-4">
                          <div className="flex items-center justify-between mb-2">
                            <input 
                              value={palette.name}
                              onChange={(e) => renamePalette(palette.id, e.target.value)}
                              className="bg-transparent text-xs font-bold text-white/80 focus:ring-0 border-none p-0 w-full"
                            />
                            <div className="flex items-center gap-1 shrink-0">
                              {project.palettes.length > 1 && (
                                <button 
                                  onClick={() => { setTooltip(null); deletePalette(palette.id); }} 
                                  onMouseEnter={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setTooltip({
                                      label: t('deletePalette'),
                                      description: t('deletePaletteDesc'),
                                      x: rect.left + rect.width / 2,
                                      y: rect.top,
                                      side: 'top',
                                      align: 'center'
                                    });
                                  }}
                                  onMouseLeave={() => setTooltip(null)}
                                  className="p-1 hover:bg-white/5 rounded text-white/40 hover:text-red-500 transition-colors"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                              <button 
                                onClick={() => exportPaletteHex(palette)} 
                                className="p-1 hover:bg-white/5 rounded text-white/40 hover:text-white transition-colors"
                                title={t('exportPaletteHex')}
                              >
                                <Download className="w-3 h-3" />
                              </button>
                              <button 
                                onClick={() => { setTooltip(null); replaceColorsByLuminance(palette.id); }} 
                                onMouseEnter={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setTooltip({
                                    label: t('replaceByLuminance'),
                                    description: t('replaceByLuminanceDesc'),
                                    x: rect.left + rect.width / 2,
                                    y: rect.top,
                                    side: 'top',
                                    align: 'center'
                                  });
                                }}
                                onMouseLeave={() => setTooltip(null)}
                                className="p-1 hover:bg-white/5 rounded text-white/40 hover:text-blue-400 transition-colors"
                              >
                                <Sparkles className="w-3 h-3" />
                              </button>
                              <button 
                                onClick={() => toggleMinimizePalette(palette.id)}
                                className="p-1 hover:bg-white/5 rounded text-white/40 hover:text-white transition-colors"
                              >
                                {palette.isMinimized ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                              </button>
                            </div>
                          </div>
                          {!palette.isMinimized && (
                            <div className="flex flex-wrap gap-2">
                              <SortableContext 
                                items={palette.colors.map((_, idx) => `${palette.id}:${idx}`)}
                                strategy={rectSortingStrategy}
                              >
                                {palette.colors.map((color, idx) => (
                                  <SortablePaletteSlot 
                                    key={`${palette.id}-${color}-${idx}`}
                                    color={color}
                                    idx={idx}
                                    paletteId={palette.id}
                                    selectedColor={activeColorSlot === 1 ? selectedColor : secondaryColor}
                                    handleSelectColor={handleSelectColor}
                                    toggleLockPaletteSlot={toggleLockPaletteSlot}
                                    removeFromPalette={removeFromPalette}
                                    project={project}
                                    parseColor={parseColor}
                                    setTooltip={setTooltip}
                                    onCopyColor={(color) => setPaletteSelectionModal({ isOpen: true, colors: [color], selectedColors: [color] })}
                                    transparencyMode={transparencyMode}
                                  />
                                ))}
                              </SortableContext>
                              <button 
                                onClick={() => addToPalette(palette.id)}
                                onMouseEnter={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setTooltip({ label: t('addColor'), description: t('addColorDesc'), x: rect.left + rect.width / 2, y: rect.top, side: 'top', align: 'center' });
                                }}
                                onMouseLeave={() => setTooltip(null)}
                                className="w-8 h-8 shrink-0 rounded-md border-2 border-dashed border-white/10 flex items-center justify-center hover:border-white/20 hover:bg-white/5 transition-all group"
                              >
                                <Plus className="w-4 h-4 text-white/20 group-hover:text-blue-400 transition-colors" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </DndContext>
                  </div>

                </div>
              </div>
              </div>

              {/* Active Colors Section */}
              <div className="p-4 border-t border-white/10 shrink-0 bg-[#1a1a1a] z-10">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[10px] font-bold text-white/60 uppercase tracking-widest">{t('active')}</h3>
                  <input 
                    type="text"
                    value={hexInput}
                    onChange={handleHexChange}
                    className="text-[10px] font-mono bg-black/40 border-none rounded px-2 py-0.5 w-16 text-right focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    <button 
                      onClick={() => {
                        setActiveColorSlot(1);
                      }}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTooltip({ label: t('primaryColor'), description: activeBrushId === 'stamp' ? t('primaryColorDescStamp') : t('primaryColorDesc'), x: rect.left + rect.width / 2, y: rect.top, side: 'top', align: 'center' });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                      className={cn("w-8 h-8 rounded border shadow-inner relative overflow-hidden group", activeColorSlot === 1 ? "border-blue-500" : "border-white/10")}
                    >
                      <Checkerboard mode={transparencyMode} />
                      {activeBrushId === 'stamp' && activeStampId ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          {(() => {
                            const stamp = project.stamps?.find(s => s.id === activeStampId);
                            if (!stamp) return null;
                            return (
                              <div 
                                className="grid" 
                                style={{ 
                                  gridTemplateColumns: `repeat(${stamp.width}, 1fr)`,
                                  width: stamp.width >= stamp.height ? '90%' : `${(stamp.width / stamp.height) * 90}%`,
                                  height: stamp.height >= stamp.width ? '90%' : `${(stamp.height / stamp.width) * 90}%`,
                                  aspectRatio: `${stamp.width} / ${stamp.height}`
                                }}
                              >
                                {stamp.pixels.map((color, i) => (
                                  <div key={`stamp-preview-${i}`} style={{ backgroundColor: color === 'transparent' ? 'transparent' : color }} className="w-full h-full" />
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      ) : (
                        <div className="absolute inset-0" style={{ backgroundColor: getActiveColor(1) }} />
                      )}
                    </button>
                    <button 
                      onClick={() => {
                        setActiveColorSlot(2);
                      }}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTooltip({ label: t('secondaryColor'), description: t('secondaryColorDesc'), x: rect.left + rect.width / 2, y: rect.top, side: 'top', align: 'center' });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                      className={cn("w-8 h-8 rounded border shadow-inner relative overflow-hidden group", activeColorSlot === 2 ? "border-blue-500" : "border-white/10")}
                    >
                      <Checkerboard mode={transparencyMode} />
                      <div className="absolute inset-0" style={{ backgroundColor: getActiveColor(2) }} />
                    </button>
                  </div>
                  <button 
                    onClick={() => setIsColorSettingsOpen(true)}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setTooltip({ label: t('colorSettings'), description: t('colorSettingsDesc'), x: rect.left + rect.width / 2, y: rect.top, side: 'top', align: 'center' });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                    className="flex-1 h-8 bg-white/5 hover:bg-white/10 rounded border border-white/10 flex items-center justify-center transition-all group"
                  >
                    <Settings2 className="w-4 h-4 text-white/40 group-hover:text-blue-400 transition-colors" />
                  </button>
                </div>
                {/* Opacity Slider */}
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[8px] font-bold text-white/30 uppercase tracking-widest">{t('opacity')}</span>
                    <div className="flex items-center gap-1">
                      <input 
                        type="text"
                        value={opacityInput}
                        onChange={handleOpacityInputChange}
                        className="text-[10px] font-mono bg-black/40 border-none rounded px-1 py-0.5 w-8 text-right focus:ring-1 focus:ring-blue-500"
                      />
                      <span className="text-[8px] font-mono text-white/40">%</span>
                    </div>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.01" 
                    value={colorOpacity}
                    onChange={(e) => setColorOpacity(parseFloat(e.target.value))}
                    className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </aside>
      <>
      {/* Import Palette Modal */}
      {importPaletteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999999] flex items-center justify-center p-4">
          <div className="bg-[#242424] border border-white/10 rounded-xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
            <h4 className="text-sm font-bold mb-2 text-center">{t('importPalette')}</h4>
            <p className="text-[10px] text-white/40 text-center mb-6">
              O sistema suporta arquivos <strong className="text-white/80">.HEX</strong> contendo uma lista de cores.
            </p>
            
            <div className="flex flex-col gap-3 mb-6">
              <button 
                onClick={() => window.open('https://lospec.com/palette-list', '_blank')}
                className="w-full text-left p-3 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold transition-colors border border-white/5 hover:border-white/20 flex items-center justify-between group"
              >
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-white/40 group-hover:text-white" />
                  <span>{t('searchLospec')}</span>
                </div>
              </button>
              
              <button 
                onClick={importPaletteHex}
                className="w-full text-left p-3 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs font-bold transition-colors border border-blue-500/30 hover:border-blue-500/50 flex items-center justify-between group"
              >
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  <span>Importar Arquivo .HEX</span>
                </div>
              </button>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => setImportPaletteModal(false)}
                className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Palette Selection Modal */}
      {paletteSelectionModal && paletteSelectionModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999999] flex items-center justify-center p-4">
          <div className="bg-[#242424] border border-white/10 rounded-xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
            <h4 className="text-sm font-bold mb-2 text-center">{t('addToPalette')}</h4>
            <p className="text-[10px] text-white/40 text-center mb-4">Selecione as cores e a paleta de destino.</p>
            
            <div className="mb-4">
              <label className="text-[9px] font-bold text-white/30 uppercase tracking-widest mb-2 block">{t('selectedColors')}</label>
              <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto custom-scrollbar p-1">
                {paletteSelectionModal.colors.map((color, idx) => {
                  const isSelected = paletteSelectionModal.selectedColors?.includes(color);
                  return (
                    <button
                      key={`${color}-${idx}`}
                      onClick={() => {
                        setPaletteSelectionModal(prev => {
                          if (!prev) return null;
                          const currentSelected = prev.selectedColors || [];
                          const isSelected = currentSelected.includes(color);
                          const newSelected = isSelected 
                            ? currentSelected.filter(c => c !== color)
                            : [...currentSelected, color];
                          return { ...prev, selectedColors: newSelected };
                        });
                      }}
                      className={cn(
                        "w-8 h-8 shrink-0 rounded border-2 transition-all relative overflow-hidden",
                        isSelected ? "border-blue-500 scale-105" : "border-white/5 opacity-40 grayscale"
                      )}
                      style={{ backgroundColor: color }}
                    >
                      {isSelected && (
                        <div className="absolute inset-0 flex items-center justify-center bg-blue-500/20">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-6">
              <label className="text-[9px] font-bold text-white/30 uppercase tracking-widest mb-2 block">{t('destinationPalette')}</label>
              <div className="space-y-2 max-h-[150px] overflow-y-auto custom-scrollbar pr-1">
                <button
                  disabled={!paletteSelectionModal.selectedColors?.length}
                  onClick={() => {
                    if (paletteSelectionModal.selectedColors?.length) {
                      const newPaletteId = `palette-${Date.now()}`;
                      const newPalette = {
                        id: newPaletteId,
                        name: paletteSelectionModal.defaultPaletteName || 'Nova Paleta',
                        colors: paletteSelectionModal.selectedColors,
                        isMinimized: false,
                        lockedPaletteIndices: []
                      };
                      const newProject = { ...project, palettes: [...project.palettes, newPalette] };
                      setProject(newProject);
                      setPaletteSelectionModal(null);
                    }
                  }}
                  className="w-full text-left p-3 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs font-bold transition-colors border border-blue-500/30 hover:border-blue-500/50 flex items-center justify-between group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>{t('createNewPalette')}</span>
                  <Plus className="w-3 h-3 text-blue-400" />
                </button>
                {project.palettes.map((palette: any) => (
                  <button
                    key={palette.id}
                    disabled={!paletteSelectionModal.selectedColors?.length}
                    onClick={() => {
                      if (paletteSelectionModal.selectedColors?.length) {
                        addToPalette(palette.id, paletteSelectionModal.selectedColors);
                        setPaletteSelectionModal(null);
                      }
                    }}
                    className="w-full text-left p-3 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold transition-colors border border-white/5 hover:border-white/20 flex items-center justify-between group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span>{palette.name}</span>
                    <Plus className="w-3 h-3 text-white/20 group-hover:text-blue-400" />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => setPaletteSelectionModal(null)}
                className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
        )}
        {/* Paste Confirmation Modal */}
        {pasteModal && pasteModal.isOpen && (
          <div className="fixed inset-0 z-[9999999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-blue-600/20 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Redimensionar Projeto?</h2>
                  <p className="text-xs text-white/40">A imagem colada ({pasteModal.width}x{pasteModal.height}) é maior que a área de desenho ({project.width}x{project.height}).</p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => pasteImage(pasteModal.image, true)}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all flex flex-col items-center"
                >
                  <span>Sim, redimensionar</span>
                  <span className="text-[10px] opacity-60 font-normal">Ajusta o projeto para {Math.max(project.width, pasteModal.width)}x{Math.max(project.height, pasteModal.height)}</span>
                </button>
                <button 
                  onClick={() => pasteImage(pasteModal.image, false)}
                  className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold transition-all flex flex-col items-center"
                >
                  <span>Não, recortar</span>
                  <span className="text-[10px] opacity-60 font-normal">{t('pasteKeepSize')}</span>
                </button>
                <button 
                  onClick={() => setPasteModal(null)}
                  className="w-full py-2 rounded-xl text-white/40 hover:text-white text-xs transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Global Tooltip */}
        <GlobalTooltip tooltip={tooltip} />
      </>
    </div>
    </div>
  );
}


function CompositeFrame({ frame, layers, width, height, transparencyMode = 'night' }: { frame: Frame, layers: LayerMetadata[], width: number, height: number, transparencyMode?: 'day' | 'night' }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    const reversedLayers = layers.slice().reverse();
    reversedLayers.forEach((layer, reversedIdx) => {
      if (!layer.isVisible || !frame.cells[layer.id]) return;
      ctx.globalAlpha = layer.opacity;
      const cells = frame.cells[layer.id];
      const originalIdx = layers.length - 1 - reversedIdx;

      cells.forEach((color, i) => {
        if (color === 'transparent') return;

        if (layer.clipToBelow) {
          let hasColorBelow = false;
          for (let j = originalIdx + 1; j < layers.length; j++) {
            const belowLayer = layers[j];
            if (!belowLayer.isVisible) continue;
            const belowColor = frame.cells[belowLayer.id]?.[i] || 'transparent';
            if (belowColor !== 'transparent') {
              hasColorBelow = true;
              break;
            }
          }
          if (!hasColorBelow) return; // Make it transparent
        }

        ctx.fillStyle = color;
        ctx.fillRect(i % width, Math.floor(i / width), 1, 1);
      });
    });
  }, [frame, layers, width, height]);

  return (
    <div className="w-full h-full flex items-center justify-center overflow-hidden">
      <div 
        className="relative"
        style={{
          width: width >= height ? '100%' : 'auto',
          height: height >= width ? '100%' : 'auto',
          aspectRatio: `${width} / ${height}`,
        }}
      >
        <Checkerboard mode={transparencyMode} />
        <canvas 
          ref={canvasRef} 
          width={width} 
          height={height} 
          className="absolute inset-0 w-full h-full"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>
    </div>
  );
}

function LayerPreview({ 
  cells, 
  width, 
  height, 
  opacity,
  transparencyMode
}: { 
  cells: string[] | undefined, 
  width: number, 
  height: number, 
  opacity: number,
  transparencyMode: 'day' | 'night'
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const previewData = useMemo(() => {
    if (!cells) return { width, height, minX: 0, minY: 0, hasPixels: false };
    let minX = width, minY = height, maxX = 0, maxY = 0;
    let hasPixels = false;
    cells.forEach((color, i) => {
      if (color === 'transparent') return;
      hasPixels = true;
      const x = i % width;
      const y = Math.floor(i / width);
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    });
    if (!hasPixels) return { width, height, minX: 0, minY: 0, hasPixels: false };
    return { width: maxX - minX + 1, height: maxY - minY + 1, minX, minY, hasPixels: true };
  }, [cells, width, height]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !cells) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = previewData.width;
    canvas.height = previewData.height;
    ctx.clearRect(0, 0, previewData.width, previewData.height);
    
    if (!previewData.hasPixels) return;

    ctx.globalAlpha = opacity;

    cells.forEach((color, i) => {
      if (color === 'transparent') return;
      const x = i % width;
      const y = Math.floor(i / width);
      ctx.fillStyle = color;
      ctx.fillRect(x - previewData.minX, y - previewData.minY, 1, 1);
    });
  }, [cells, width, height, opacity, previewData]);

  return (
    <div className="w-20 h-20 bg-black/40 rounded border border-white/10 overflow-hidden flex items-center justify-center relative shrink-0">
      <div 
        className="relative"
        style={{
          width: previewData.width >= previewData.height ? '100%' : 'auto',
          height: previewData.height >= previewData.width ? '100%' : 'auto',
          aspectRatio: `${previewData.width} / ${previewData.height}`,
        }}
      >
        <Checkerboard mode={transparencyMode} />
        <canvas 
          ref={canvasRef} 
          className="absolute inset-0 w-full h-full"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>
    </div>
  );
}

function SortableLayer({ 
  layer, 
  currentLayerId, 
  setCurrentLayerId, 
  updateLayer, 
  deleteLayer, 
  mergeLayerDown,
  isLastLayer,
  editingLayerId, 
  setEditingLayerId,
  setTooltip,
  currentFrame,
  width,
  height,
  transparencyMode,
  canDelete
}: { 
  layer: LayerMetadata, 
  currentLayerId: string, 
  setCurrentLayerId: (id: string) => void,
  updateLayer: (id: string, updates: Partial<LayerMetadata>) => void,
  deleteLayer: (id: string) => void,
  mergeLayerDown: (id: string) => void,
  isLastLayer: boolean,
  editingLayerId: string | null,
  setEditingLayerId: (id: string | null) => void,
  setTooltip: (tooltip: { label: string, description: string, x: number, y: number, align?: 'left' | 'center', side?: 'top' | 'bottom' | 'left' | 'right' } | null) => void,
  currentFrame: Frame,
  width: number,
  height: number,
  transparencyMode: 'day' | 'night',
  canDelete: boolean
}) {
  const { t } = useLanguage();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: layer.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setNodeRef}
      style={style}
      onClick={() => setCurrentLayerId(layer.id)}
      className={cn(
        "p-3 rounded-xl border transition-all group relative flex items-center gap-3",
        currentLayerId === layer.id 
          ? "bg-blue-600/10 border-blue-500/50" 
          : "bg-white/5 border-transparent hover:bg-white/10"
      )}
    >
      {/* Drag Handle */}
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-white/20 hover:text-white/60 shrink-0">
        <GripVertical className="w-3.5 h-3.5" />
      </div>

      {/* Thumbnail */}
      <div className="shrink-0">
        <LayerPreview 
          cells={currentFrame.cells[layer.id]} 
          width={width} 
          height={height} 
          opacity={layer.opacity} 
          transparencyMode={transparencyMode}
        />
      </div>

      {/* Right Side: Name (top), Buttons & Opacity (bottom) */}
      <div className="flex flex-col flex-1 min-w-0 gap-2">
        
        {/* Top: Name and Edit Button */}
        <div className="flex items-center gap-2">
          {editingLayerId === layer.id ? (
            <input 
              autoFocus
              className="flex-1 min-w-0 bg-black/40 border-none rounded px-2 py-0.5 text-xs focus:ring-1 focus:ring-blue-500"
              value={layer.name}
              onChange={(e) => updateLayer(layer.id, { name: e.target.value })}
              onBlur={() => setEditingLayerId(null)}
              onKeyDown={(e) => e.key === 'Enter' && setEditingLayerId(null)}
            />
          ) : (
            <span className="flex-1 text-xs font-medium truncate">{layer.name}</span>
          )}

          <div className="relative opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button 
              onClick={(e) => { e.stopPropagation(); setEditingLayerId(layer.id); }}
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setTooltip({
                  label: t('rename'),
                  description: t('renameDesc'),
                  x: rect.left + rect.width / 2,
                  y: rect.top,
                  side: 'top',
                  align: 'center'
                });
              }}
              onMouseLeave={() => setTooltip(null)}
              className="p-1 hover:bg-white/5 rounded hover:text-blue-400 text-white/40 transition-colors"
            >
              <Edit2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Bottom: Buttons and Opacity */}
        <div className="flex flex-col gap-2 w-full mt-1">
          {/* Action Buttons */}
          <div className="flex items-center gap-1 w-full">
            <div className="relative">
              <button 
                onClick={(e) => { e.stopPropagation(); updateLayer(layer.id, { isVisible: !layer.isVisible }); }}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setTooltip({
                    label: layer.isVisible ? t('hide') : t('show'),
                    description: t('layerVisibilityDesc'),
                    x: rect.left + rect.width / 2,
                    y: rect.top,
                    side: 'top',
                    align: 'center'
                  });
                }}
                onMouseLeave={() => setTooltip(null)}
                className={cn("p-1 rounded hover:bg-white/5 transition-colors", layer.isVisible ? "text-white/60 hover:text-white" : "text-red-500 hover:text-red-400")}
              >
                {layer.isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="relative">
              <button 
                onClick={(e) => { e.stopPropagation(); updateLayer(layer.id, { isLocked: !layer.isLocked }); }}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setTooltip({
                    label: layer.isLocked ? t('unlock') : t('lock'),
                    description: t('lockDesc'),
                    x: rect.left + rect.width / 2,
                    y: rect.top,
                    side: 'top',
                    align: 'center'
                  });
                }}
                onMouseLeave={() => setTooltip(null)}
                className="p-1 rounded hover:bg-white/5 transition-colors"
              >
                {layer.isLocked ? <Lock className="w-3.5 h-3.5 text-orange-400" /> : <Unlock className="w-3.5 h-3.5 text-white/20 hover:text-white/60" />}
              </button>
            </div>

            <div className="relative">
              <button 
                onClick={(e) => { e.stopPropagation(); updateLayer(layer.id, { clipToBelow: !layer.clipToBelow }); }}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setTooltip({
                    label: layer.clipToBelow ? t('disableMask') : t('enableMask'),
                    description: t('maskDesc'),
                    x: rect.left + rect.width / 2,
                    y: rect.top,
                    side: 'top',
                    align: 'center'
                  });
                }}
                onMouseLeave={() => setTooltip(null)}
                className="p-1 rounded hover:bg-white/5 transition-colors"
              >
                <Ghost className={cn("w-3.5 h-3.5", layer.clipToBelow ? "text-purple-400" : "text-white/20 hover:text-white/60")} />
              </button>
            </div>

            {!isLastLayer && (
              <div className="relative opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={(e) => { e.stopPropagation(); setTooltip(null); mergeLayerDown(layer.id); }}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setTooltip({
                      label: 'Mesclar para Baixo',
                      description: 'Combina esta camada com a camada inferior.',
                      x: rect.left + rect.width / 2,
                      y: rect.top,
                      side: 'top',
                      align: 'center'
                    });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                  className="p-1 rounded hover:bg-white/5 hover:text-blue-400 text-white/20 transition-colors"
                >
                  <ArrowDownToLine className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {canDelete && (
              <div className="relative opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
                <button 
                  onClick={(e) => { e.stopPropagation(); setTooltip(null); deleteLayer(layer.id); }}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setTooltip({
                      label: 'Excluir',
                      description: 'Remove a camada permanentemente.',
                      x: rect.left + rect.width / 2,
                      y: rect.top,
                      side: 'top',
                      align: 'center'
                    });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                  className="p-1 rounded hover:bg-white/5 hover:text-red-500 text-white/20 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Opacity Bar */}
          <div className="flex items-center gap-2 w-full mt-1">
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.1" 
              value={layer.opacity}
              onChange={(e) => updateLayer(layer.id, { opacity: parseFloat(e.target.value) })}
              className="flex-1 min-w-0 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-blue-500"
            />
            <span className="text-[9px] font-mono text-white/40 w-7 text-right shrink-0">{Math.round(layer.opacity * 100)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function BrushItem({ 
  brush, 
  activeBrushId, 
  setActiveBrushId, 
  setTool, 
  setActiveStampId, 
  setProject, 
  project, 
  saveToHistory,
  rotateBrush, 
  flipBrush, 
  setEditingBrush, 
  setIsBrushEditorOpen,
  setTooltip,
  isDraggingAny,
  transparencyMode,
  setMoveFolderModal
}: {
  brush: BrushShape,
  activeBrushId: string,
  setActiveBrushId: (id: string) => void,
  setTool: (tool: Tool) => void,
  setActiveStampId: (id: string | null) => void,
  setProject: (project: PixelProject) => void,
  project: PixelProject,
  saveToHistory: (project: PixelProject) => void,
  rotateBrush: (id: string) => void,
  flipBrush: (id: string, axis: 'h' | 'v') => void,
  setEditingBrush: (brush: BrushShape) => void,
  setIsBrushEditorOpen: (open: boolean) => void,
  setTooltip: (tooltip: any) => void,
  isDraggingAny: boolean,
  transparencyMode: 'day' | 'night',
  setMoveFolderModal: (modal: { isOpen: boolean, type: 'brush' | 'stamp', itemId: string } | null) => void
}) {
  const { t } = useLanguage();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: brush.id });

  const style = {
    transform: isDragging ? CSS.Transform.toString(transform) : undefined,
    transition,
    zIndex: isDragging ? 100 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  const [isHovered, setIsHovered] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const itemRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const startTimer = () => {
    clearTimer();
    timerRef.current = setTimeout(() => setIsHovered(false), 200);
  };

  useLayoutEffect(() => {
    const updateRect = () => {
      if (itemRef.current) {
        setRect(itemRef.current.getBoundingClientRect());
      }
    };
    if (isHovered) {
      updateRect();
    }
    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);
    
    const observer = new ResizeObserver(updateRect);
    if (itemRef.current) {
      observer.observe(itemRef.current);
    }

    return () => {
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
      observer.disconnect();
      clearTimer();
    };
  }, [isHovered, brush.id, project.brushes]);

  const controls = (
    <div 
      className="fixed z-[99999998] flex items-center gap-1 p-1 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-2xl transition-all"
      style={{
        left: rect ? rect.left + rect.width / 2 : 0,
        top: rect ? rect.top - 4 : 0,
        transform: 'translateX(-50%) translateY(-100%)',
        opacity: (activeBrushId === brush.id && isHovered && rect && !isDraggingAny) ? 1 : 0,
        pointerEvents: (activeBrushId === brush.id && isHovered && !isDraggingAny) ? 'auto' : 'none'
      }}
      onMouseEnter={clearTimer}
      onMouseLeave={startTimer}
    >
      <button
        onClick={(e) => { e.stopPropagation(); rotateBrush(brush.id); }}
        className="p-1.5 rounded-md bg-white/5 text-white/40 hover:bg-white/10 hover:text-white transition-all"
        onMouseEnter={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setTooltip({ label: t('rotate90'), description: t('rotateDescBrush'), x: r.left + r.width / 2, y: r.top, side: 'top', align: 'center' });
        }}
        onMouseLeave={() => setTooltip(null)}
      >
        <RotateCw className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); flipBrush(brush.id, 'h'); }}
        className="p-1.5 rounded-md bg-white/5 text-white/40 hover:bg-white/10 hover:text-white transition-all"
        onMouseEnter={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setTooltip({ label: t('flipHorizontal'), description: t('flipHorizontalDescBrush'), x: r.left + r.width / 2, y: r.top, side: 'top', align: 'center' });
        }}
        onMouseLeave={() => setTooltip(null)}
      >
        <FlipHorizontal className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); flipBrush(brush.id, 'v'); }}
        className="p-1.5 rounded-md bg-white/5 text-white/40 hover:bg-white/10 hover:text-white transition-all"
        onMouseEnter={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setTooltip({ label: t('flipVertical'), description: t('flipVerticalDescBrush'), x: r.left + r.width / 2, y: r.top, side: 'top', align: 'center' });
        }}
        onMouseLeave={() => setTooltip(null)}
      >
        <FlipVertical className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); setEditingBrush(brush); setIsBrushEditorOpen(true); }}
        className="p-1.5 rounded-md bg-white/5 text-white/40 hover:bg-white/10 hover:text-white transition-all"
        onMouseEnter={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setTooltip({ label: t('edit'), description: t('editDesc'), x: r.left + r.width / 2, y: r.top, side: 'top', align: 'center' });
        }}
        onMouseLeave={() => setTooltip(null)}
      >
        <Edit2 className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); setMoveFolderModal({ isOpen: true, type: 'brush', itemId: brush.id }); }}
        className="p-1.5 rounded-md bg-white/5 text-white/40 hover:bg-white/10 hover:text-white transition-all"
        onMouseEnter={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setTooltip({ label: t('moveToFolder'), description: t('moveToFolderDescBrush'), x: r.left + r.width / 2, y: r.top, side: 'top', align: 'center' });
        }}
        onMouseLeave={() => setTooltip(null)}
      >
        <FolderOpen className="w-3.5 h-3.5" />
      </button>
      {brush.id !== 'brush-1x1' && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setTooltip(null);
            const newBrushes = project.brushes?.filter(b => b.id !== brush.id) || [];
            const newProject = { ...project, brushes: newBrushes };
            setProject(newProject);
            saveToHistory(newProject);
            if (activeBrushId === brush.id) {
              setActiveBrushId('brush-1x1');
            }
          }}
          className="p-1.5 rounded-md bg-white/5 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all"
          onMouseEnter={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setTooltip({ label: t('delete'), description: t('deleteDescBrush'), x: r.left + r.width / 2, y: r.top, side: 'top', align: 'center' });
          }}
          onMouseLeave={() => setTooltip(null)}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );

  return (
    <>
      <div
        ref={(node) => {
          setNodeRef(node);
          (itemRef as any).current = node;
        }}
        style={style}
        {...attributes}
        {...listeners}
        role="button"
        tabIndex={0}
        onClick={() => {
          setActiveBrushId(brush.id);
          setTool('pencil');
          setActiveStampId(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setActiveBrushId(brush.id);
            setTool('pencil');
            setActiveStampId(null);
          }
        }}
        className={cn(
          "aspect-square rounded border-2 flex items-center justify-center transition-colors relative group cursor-pointer overflow-hidden",
          activeBrushId === brush.id ? "border-blue-500 bg-blue-500/20" : "border-black/10 hover:border-black/30"
        )}
        onMouseEnter={() => {
          setIsHovered(true);
          clearTimer();
        }}
        onMouseLeave={startTimer}
      >
        <Checkerboard mode={transparencyMode} />
        <div 
          className="grid gap-[1px] relative z-10" 
          style={{ 
            gridTemplateColumns: `repeat(${brush.width}, 1fr)`,
            maxWidth: brush.width * 5,
            maxHeight: brush.height * 5,
            width: '60%',
            height: '60%'
          }}
        >
          {brush.pixels.map((p: boolean, i: number) => (
            <div key={`brush-${i}`} className={p ? (transparencyMode === 'day' ? "bg-black" : "bg-white") : ""} />
          ))}
        </div>
      </div>
      {typeof document !== 'undefined' && createPortal(controls, document.body)}
    </>
  );
}

function StampItem({
  stamp,
  activeBrushId,
  activeStampId,
  setActiveStampId,
  setActiveBrushId,
  setTool,
  project,
  setProject,
  saveToHistory,
  rotateStamp,
  flipStamp,
  exportStampAsPNG,
  setTooltip,
  isDraggingAny,
  setMoveFolderModal
}: {
  stamp: Stamp,
  activeBrushId: string,
  activeStampId: string | null,
  setActiveStampId: (id: string | null) => void,
  setActiveBrushId: (id: string) => void,
  setTool: (tool: Tool) => void,
  project: PixelProject,
  setProject: (project: PixelProject) => void,
  saveToHistory: (project: PixelProject) => void,
  rotateStamp: (id: string) => void,
  flipStamp: (id: string, axis: 'h' | 'v') => void,
  exportStampAsPNG: (stamp: Stamp) => void,
  setTooltip: (tooltip: any) => void,
  isDraggingAny: boolean,
  setMoveFolderModal: (modal: { isOpen: boolean, type: 'brush' | 'stamp', itemId: string } | null) => void
}) {
  const { t } = useLanguage();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: stamp.id });

  const style = {
    transform: isDragging ? CSS.Transform.toString(transform) : undefined,
    transition,
    zIndex: isDragging ? 100 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  const [isHovered, setIsHovered] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const itemRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const startTimer = () => {
    clearTimer();
    timerRef.current = setTimeout(() => setIsHovered(false), 200);
  };

  useLayoutEffect(() => {
    const updateRect = () => {
      if (itemRef.current) {
        setRect(itemRef.current.getBoundingClientRect());
      }
    };
    if (isHovered) {
      updateRect();
    }
    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);
    
    const observer = new ResizeObserver(updateRect);
    if (itemRef.current) {
      observer.observe(itemRef.current);
    }

    return () => {
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
      observer.disconnect();
      clearTimer();
    };
  }, [isHovered, stamp.id, project.stamps]);

  const controls = (
    <div 
      className="fixed z-[99999998] flex items-center gap-1 p-1 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-2xl transition-all"
      style={{
        left: rect ? rect.left + rect.width / 2 : 0,
        top: rect ? rect.top - 4 : 0,
        transform: 'translateX(-50%) translateY(-100%)',
        opacity: (activeStampId === stamp.id && isHovered && rect && !isDraggingAny) ? 1 : 0,
        pointerEvents: (activeStampId === stamp.id && isHovered && !isDraggingAny) ? 'auto' : 'none'
      }}
      onMouseEnter={clearTimer}
      onMouseLeave={startTimer}
    >
      <button
        onClick={(e) => { e.stopPropagation(); rotateStamp(stamp.id); }}
        className="p-1.5 rounded-md bg-white/5 text-white/40 hover:bg-white/10 hover:text-white transition-all"
        onMouseEnter={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setTooltip({ label: t('rotate90'), description: t('rotateDescStamp'), x: r.left + r.width / 2, y: r.top, side: 'top', align: 'center' });
        }}
        onMouseLeave={() => setTooltip(null)}
      >
        <RotateCw className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); flipStamp(stamp.id, 'h'); }}
        className="p-1.5 rounded-md bg-white/5 text-white/40 hover:bg-white/10 hover:text-white transition-all"
        onMouseEnter={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setTooltip({ label: t('flipHorizontal'), description: t('flipHorizontalDescStamp'), x: r.left + r.width / 2, y: r.top, side: 'top', align: 'center' });
        }}
        onMouseLeave={() => setTooltip(null)}
      >
        <FlipHorizontal className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); flipStamp(stamp.id, 'v'); }}
        className="p-1.5 rounded-md bg-white/5 text-white/40 hover:bg-white/10 hover:text-white transition-all"
        onMouseEnter={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setTooltip({ label: t('flipVertical'), description: t('flipVerticalDescStamp'), x: r.left + r.width / 2, y: r.top, side: 'top', align: 'center' });
        }}
        onMouseLeave={() => setTooltip(null)}
      >
        <FlipVertical className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); exportStampAsPNG(stamp); }}
        className="p-1.5 rounded-md bg-white/5 text-white/40 hover:bg-white/10 hover:text-white transition-all"
        onMouseEnter={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setTooltip({ label: t('exportPng'), description: t('exportPngDescStamp'), x: r.left + r.width / 2, y: r.top, side: 'top', align: 'center' });
        }}
        onMouseLeave={() => setTooltip(null)}
      >
        <Download className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); setMoveFolderModal({ isOpen: true, type: 'stamp', itemId: stamp.id }); }}
        className="p-1.5 rounded-md bg-white/5 text-white/40 hover:bg-white/10 hover:text-white transition-all"
        onMouseEnter={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setTooltip({ label: t('moveToFolder'), description: t('moveToFolderDescStamp'), x: r.left + r.width / 2, y: r.top, side: 'top', align: 'center' });
        }}
        onMouseLeave={() => setTooltip(null)}
      >
        <FolderOpen className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setTooltip(null);
          const newStamps = project.stamps?.filter(s => s.id !== stamp.id) || [];
          const newProject = { ...project, stamps: newStamps };
          setProject(newProject);
          saveToHistory(newProject);
          if (activeStampId === stamp.id) {
            setActiveStampId(null);
            setActiveBrushId('brush-1x1');
          }
        }}
        className="p-1.5 rounded-md bg-white/5 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all"
        onMouseEnter={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setTooltip({ label: t('delete'), description: t('deleteDescStamp'), x: r.left + r.width / 2, y: r.top, side: 'top', align: 'center' });
        }}
        onMouseLeave={() => setTooltip(null)}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );

  return (
    <>
      <div
        ref={(node) => {
          setNodeRef(node);
          (itemRef as any).current = node;
        }}
        style={style}
        {...attributes}
        {...listeners}
        role="button"
        tabIndex={0}
        onClick={() => {
          setActiveStampId(stamp.id);
          setActiveBrushId('stamp');
          setTool('pencil');
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setActiveStampId(stamp.id);
            setActiveBrushId('stamp');
            setTool('pencil');
          }
        }}
        className={cn(
          "aspect-square rounded border-2 flex items-center justify-center transition-colors relative group cursor-pointer overflow-hidden",
          (activeBrushId === 'stamp' && activeStampId === stamp.id) ? "border-blue-500 bg-blue-500/20" : "border-white/10 hover:border-white/30 bg-black/40"
        )}
        onMouseEnter={() => {
          setIsHovered(true);
          clearTimer();
        }}
        onMouseLeave={startTimer}
      >
        <div 
          className="grid" 
          style={{ 
            gridTemplateColumns: `repeat(${stamp.width}, 1fr)`,
            width: stamp.width >= stamp.height ? '80%' : `${(stamp.width / stamp.height) * 80}%`,
            height: stamp.height >= stamp.width ? '80%' : `${(stamp.height / stamp.width) * 80}%`,
            aspectRatio: `${stamp.width} / ${stamp.height}`
          }}
        >
          {stamp.pixels.map((color, i) => (
            <div key={`stamp-${i}`} style={{ backgroundColor: color === 'transparent' ? 'transparent' : color }} className="w-full h-full" />
          ))}
        </div>
      </div>
      {typeof document !== 'undefined' && createPortal(controls, document.body)}
    </>
  );
}

function SortableFrame({ 
  frame, 
  idx, 
  currentFrameIndex, 
  setCurrentFrameIndex, 
  deleteFrame, 
  toggleOnionSkin, 
  toggleFrameLock,
  duplicateFrame,
  updateFrameDuration,
  project, 
  transparencyMode,
  setTooltip
}: { 
  frame: Frame, 
  idx: number, 
  currentFrameIndex: number, 
  setCurrentFrameIndex: (idx: number) => void,
  deleteFrame: (idx: number) => void,
  toggleOnionSkin: (idx: number) => void,
  toggleFrameLock: (idx: number) => void,
  duplicateFrame: (idx: number) => void,
  updateFrameDuration: (idx: number, duration: number) => void,
  project: any,
  transparencyMode: 'day' | 'night',
  setTooltip: (tooltip: { label: string, description: string, x: number, y: number, align?: 'left' | 'center', side?: 'top' | 'bottom' | 'left' | 'right' } | null) => void
}) {
  const { t } = useLanguage();
  const [isHovered, setIsHovered] = useState(false);
  const [frameRect, setFrameRect] = useState<DOMRect | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: frame.id });

  const combinedRef = (node: HTMLDivElement | null) => {
    setNodeRef(node);
    frameRef.current = node;
  };

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const startTimer = () => {
    clearTimer();
    timerRef.current = setTimeout(() => setIsHovered(false), 200);
  };

  useLayoutEffect(() => {
    const updateRect = () => {
      if (frameRef.current) {
        setFrameRect(frameRef.current.getBoundingClientRect());
      }
    };
    if (isHovered) {
      updateRect();
    }
    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);
    
    // Update rect when frames change or reorder
    const observer = new ResizeObserver(updateRect);
    if (frameRef.current) {
      observer.observe(frameRef.current);
    }

    return () => {
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
      observer.disconnect();
      clearTimer();
    };
  }, [frame, isDragging, isHovered, idx, project.frames.length]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  const buttons = (
    <div 
      className="fixed z-[99999998] flex items-center gap-1 p-1 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-2xl transition-all"
      style={{
        left: frameRect ? frameRect.left + frameRect.width / 2 : 0,
        top: frameRect ? frameRect.top - 8 : 0,
        transform: 'translateX(-50%) translateY(-100%)',
        opacity: (currentFrameIndex === idx && isHovered && !isDragging && frameRect) ? 1 : 0,
        pointerEvents: currentFrameIndex === idx && isHovered && !isDragging ? 'auto' : 'none'
      }}
      onMouseEnter={clearTimer}
      onMouseLeave={startTimer}
    >
        <div className="relative">
          <button 
            onClick={(e) => { e.stopPropagation(); toggleFrameLock(idx); }}
            onMouseEnter={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setTooltip({
                label: frame.isLocked ? t('unlockFrame') : t('lockFrame'),
                description: t('lockFrameDesc'),
                x: rect.left + rect.width / 2,
                y: rect.top,
                side: 'top',
                align: 'center'
              });
            }}
            onMouseLeave={() => setTooltip(null)}
            className={cn(
              "p-1.5 rounded-md transition-all", 
              frame.isLocked ? "bg-orange-500 text-white" : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white"
            )}
          >
            {frame.isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          </button>
        </div>
        <div className="relative">
          <button 
            onClick={(e) => { e.stopPropagation(); toggleOnionSkin(idx); }}
            onMouseEnter={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setTooltip({
                label: frame.onionSkin ? t('disableOnionSkin') : t('enableOnionSkin'),
                description: t('onionSkinDesc'),
                x: rect.left + rect.width / 2,
                y: rect.top,
                side: 'top',
                align: 'center'
              });
            }}
            onMouseLeave={() => setTooltip(null)}
            className={cn(
              "p-1.5 rounded-md transition-all",
              frame.onionSkin ? "bg-purple-500 text-white" : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white"
            )}
          >
            <Ghost className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="relative">
          <button 
            onClick={(e) => { e.stopPropagation(); duplicateFrame(idx); }}
            onMouseEnter={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setTooltip({
                label: t('duplicate'),
                description: t('duplicateDesc'),
                x: rect.left + rect.width / 2,
                y: rect.top,
                side: 'top',
                align: 'center'
              });
            }}
            onMouseLeave={() => setTooltip(null)}
            className="p-1.5 rounded-md bg-white/5 text-white/40 hover:bg-white/10 hover:text-white transition-all"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>
        {project.frames.length > 1 && (
          <div className="relative">
            <button 
              onClick={(e) => { e.stopPropagation(); setTooltip(null); deleteFrame(idx); }}
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setTooltip({
                  label: t('delete'),
                  description: t('deleteFrameDesc'),
                  x: rect.left + rect.width / 2,
                  y: rect.top,
                  side: 'top',
                  align: 'center'
                });
              }}
              onMouseLeave={() => setTooltip(null)}
              className="p-1.5 rounded-md bg-white/5 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <div className="w-px h-6 bg-white/10 mx-1" />
        <div className="flex flex-col gap-0.5 px-1">
          <label className="text-[7px] uppercase font-bold text-white/30 tracking-tighter">Duração (ms)</label>
          <input 
            type="number" 
            value={frame.duration || 200} 
            step={50}
            min={50}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              e.stopPropagation();
              updateFrameDuration(idx, Math.max(50, parseInt(e.target.value) || 200));
            }}
            className="w-14 bg-black/40 border border-white/10 rounded px-1 py-0.5 text-[10px] text-white outline-none focus:border-blue-500"
          />
        </div>
    </div>
  );

  return (
    <div 
      ref={combinedRef}
      style={style}
      className="flex flex-col items-center group relative min-w-[84px] overflow-visible"
      onMouseEnter={() => { clearTimer(); setIsHovered(true); }}
      onMouseLeave={startTimer}
    >
      {createPortal(buttons, document.body)}

      {/* Frame Preview Slot */}
      <div 
        id={`frame-preview-${idx}`}
        onClick={() => setCurrentFrameIndex(idx)}
        className={cn(
          "relative w-20 h-20 rounded-xl border-2 cursor-pointer transition-all overflow-hidden bg-[#0a0a0a]",
          currentFrameIndex === idx ? "border-blue-500 scale-105 shadow-lg shadow-blue-500/20" : "border-white/5 hover:border-white/20"
        )}
      >
        <CompositeFrame frame={frame} layers={project.layers} width={project.width} height={project.height} transparencyMode={transparencyMode} />
        <div className="absolute bottom-1 right-1 text-[8px] font-mono text-white/40 bg-black/60 px-1.5 py-0.5 rounded">
          {idx + 1}
        </div>
      </div>
      
      {/* Drag Handle below the slot */}
      <div 
        className="mt-2 w-10 h-4 bg-white/5 flex items-center justify-center rounded cursor-grab active:cursor-grabbing hover:bg-white/10 transition-colors"
        {...attributes}
        {...listeners}
      >
        <GripHorizontal className="w-3 h-3 text-white/20" />
      </div>
    </div>
  );
}

function SortableToolSlot({ id, children }: { id: string, children: React.ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: isDragging ? CSS.Transform.toString(transform) : undefined,
    transition,
    zIndex: isDragging ? 100 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="relative group w-11 h-11 shrink-0"
    >
      {children}
    </div>
  );
}

function SortablePaletteSlot({ 
  color, 
  idx, 
  paletteId,
  selectedColor, 
  handleSelectColor, 
  toggleLockPaletteSlot, 
  removeFromPalette, 
  project, 
  parseColor,
  setTooltip,
  onCopyColor,
  transparencyMode
}: { 
  color: string, 
  idx: number, 
  paletteId: string,
  selectedColor: string, 
  handleSelectColor: (color: string) => void,
  toggleLockPaletteSlot: (paletteId: string, idx: number) => void,
  removeFromPalette: (paletteId: string, idx: number) => void,
  project: any,
  parseColor: (color: string) => any,
  setTooltip: (tooltip: { label: string, description: string, x: number, y: number, align?: 'left' | 'center', side?: 'top' | 'bottom' | 'left' | 'right' } | null) => void,
  onCopyColor: (color: string) => void,
  transparencyMode: 'day' | 'night'
}) {
  const { t } = useLanguage();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: `${paletteId}:${idx}` });

  const [isHovered, setIsHovered] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const itemRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const startTimer = () => {
    clearTimer();
    timerRef.current = setTimeout(() => setIsHovered(false), 200);
  };

  const isSelected = selectedColor === color;

  useLayoutEffect(() => {
    const updateRect = () => {
      if (itemRef.current) {
        setRect(itemRef.current.getBoundingClientRect());
      }
    };
    if (isSelected || isHovered) {
      updateRect();
    }
    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);
    
    const observer = new ResizeObserver(updateRect);
    if (itemRef.current) {
      observer.observe(itemRef.current);
    }

    return () => {
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
      observer.disconnect();
      clearTimer();
    };
  }, [isSelected, isHovered, isDragging, color, idx, paletteId, project.palettes]);

  const style = {
    transform: isDragging ? CSS.Transform.toString(transform) : undefined,
    transition,
    zIndex: isDragging ? 100 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  const palette = project.palettes.find((p: any) => p.id === paletteId);
  const isLocked = palette?.lockedPaletteIndices?.includes(idx);
  const { opacity } = parseColor(color);

  const showControls = isSelected && isHovered && !isDragging;

  const controls = (
    <div 
      className="fixed z-[99999998] flex items-center gap-1 p-1 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-2xl transition-all"
      style={{
        left: rect ? rect.left + rect.width / 2 : 0,
        top: rect ? rect.top - 4 : 0,
        transform: 'translateX(-50%) translateY(-100%)',
        opacity: (showControls && rect) ? 1 : 0,
        pointerEvents: showControls ? 'auto' : 'none'
      }}
      onMouseEnter={clearTimer}
      onMouseLeave={startTimer}
    >
      <button 
        onClick={(e) => { e.stopPropagation(); toggleLockPaletteSlot(paletteId, idx); }}
        onMouseEnter={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setTooltip({
            label: isLocked ? t('unlockColor') : t('lockColor'),
            description: t('lockColorDesc'),
            x: r.left + r.width / 2,
            y: r.top,
            side: 'top',
            align: 'center'
          });
        }}
        onMouseLeave={() => setTooltip(null)}
        className={cn(
          "p-1.5 rounded-md transition-all", 
          isLocked ? "bg-orange-500 text-white" : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white"
        )}
      >
        {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
      </button>
      <button 
        onClick={(e) => { e.stopPropagation(); onCopyColor(color); }}
        onMouseEnter={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setTooltip({
            label: t('copyColor'),
            description: t('copyColorDesc'),
            x: r.left + r.width / 2,
            y: r.top,
            side: 'top',
            align: 'center'
          });
        }}
        onMouseLeave={() => setTooltip(null)}
        className="p-1.5 rounded-md bg-white/5 text-white/40 hover:bg-white/10 hover:text-white transition-all"
      >
        <CopyPlus className="w-3.5 h-3.5" />
      </button>
      {!isLocked && (
        <button 
          onClick={(e) => { e.stopPropagation(); removeFromPalette(paletteId, idx); }}
          onMouseEnter={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setTooltip({
              label: t('removeColor'),
              description: t('removeColorDesc'),
              x: r.left + r.width / 2,
              y: r.top,
              side: 'top',
              align: 'center'
            });
          }}
          onMouseLeave={() => setTooltip(null)}
          className="p-1.5 rounded-md bg-white/5 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );

  return (
    <div 
      ref={(node) => {
        setNodeRef(node);
        // @ts-ignore
        itemRef.current = node;
      }}
      style={style}
      className="relative group w-8 h-8 shrink-0"
      onMouseEnter={() => {
        setIsHovered(true);
        clearTimer();
      }}
      onMouseLeave={startTimer}
    >
      <button
        {...attributes}
        {...listeners}
        onClick={() => handleSelectColor(color)}
        onMouseEnter={(e) => {
          if (isSelected) {
            const r = e.currentTarget.getBoundingClientRect();
            setTooltip({
              label: color === 'transparent' ? t('transparent') : color.toUpperCase(),
              description: '',
              x: r.left,
              y: r.top + r.height / 2,
              side: 'left',
              align: 'center'
            });
          }
        }}
        onMouseLeave={() => setTooltip(null)}
        className={cn(
          "w-full h-full rounded-md border-2 transition-transform hover:scale-110 relative overflow-hidden cursor-grab active:cursor-grabbing",
          selectedColor.toLowerCase() === color.toLowerCase() ? "border-white" : "border-transparent"
        )}
        style={{ backgroundColor: color === 'transparent' ? 'transparent' : color }}
      >
        {color === 'transparent' ? (
          <Checkerboard mode={transparencyMode} className="rounded-sm" />
        ) : (
          <div className="absolute inset-0 flex items-end justify-end p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-[7px] font-bold text-white drop-shadow-[0_1px_1px_rgba(0,0,0,1)]">{Math.round(opacity * 100)}%</span>
          </div>
        )}
      </button>
      {typeof document !== 'undefined' && createPortal(controls, document.body)}
    </div>
  );
}

function MainCanvas({ 
  project, 
  currentFrameIndex, 
  isPlaying,
  previewSpeed,
  isPingPong,
  setCurrentFrameIndex,
  currentLayerId, 
  zoom, 
  showGrid, 
  gridSize, 
  gridOffsetX, 
  gridOffsetY, 
  isSelecting,
  selectionStart,
  isTiledMode, 
  tiledOpacity,
  visibleTiles,
  setVisibleTiles,
  visibleBounds,
  hoveredPixelIndex,
  hoveredPixelPos,
  previewPixels,
  handlePixelInteraction,
  handlePixelEnter,
  setHoveredPixelIndex,
  setHoveredPixelPos,
  setPreviewPixels,
  isMouseDown,
  tool,
  getActiveColor,
  activeColorSlot,
  selection,
  selectionMask,
  selectedPixels,
  transformState,
  activeBrushId,
  activeStampId,
  previewStampCenters,
  globalBrushAlignment,
  globalAlignmentOffsetX,
  globalAlignmentOffsetY,
  transparencyMode,
  isMirrorMode,
  mirrorDirection,
  mirrorOpacity
}: {
  project: PixelProject,
  currentFrameIndex: number,
  isPlaying: boolean,
  previewSpeed: number,
  isPingPong: boolean,
  setCurrentFrameIndex: (index: number) => void,
  currentLayerId: string,
  zoom: number,
  showGrid: boolean,
  gridSize: number,
  gridOffsetX: number,
  gridOffsetY: number,
  isSelecting: boolean,
  selectionStart: { x: number, y: number } | null,
  isTiledMode: boolean,
  tiledOpacity: number,
  visibleTiles: boolean[],
  setVisibleTiles: React.Dispatch<React.SetStateAction<boolean[]>>,
  visibleBounds: { minX: number; maxX: number; minY: number; maxY: number; width: number; height: number },
  hoveredPixelIndex: number | null,
  hoveredPixelPos: { x: number, y: number } | null,
  previewPixels: number[],
  handlePixelInteraction: (index: number, isShiftPressed?: boolean) => void,
  handlePixelEnter: (index: number, isShiftPressed?: boolean) => void,
  setHoveredPixelIndex: (index: number | null) => void,
  setHoveredPixelPos: (pos: { x: number, y: number } | null) => void,
  setPreviewPixels: (pixels: number[]) => void,
  isMouseDown: boolean,
  tool: Tool,
  getActiveColor: (slot: 1 | 2) => string,
  activeColorSlot: 1 | 2,
  selection: SelectionArea | null,
  selectionMask: boolean[] | null,
  selectedPixels: { x: number, y: number, color: string }[],
  transformState: TransformState | null,
  activeBrushId: string,
  activeStampId: string | null,
  previewStampCenters: number[],
  globalBrushAlignment: boolean,
  globalAlignmentOffsetX: number,
  globalAlignmentOffsetY: number,
  transparencyMode: 'day' | 'night',
  isMirrorMode: boolean,
  mirrorDirection: 'left' | 'right' | 'top' | 'bottom',
  mirrorOpacity: number
}) {
  const artCanvasRef = useRef<HTMLCanvasElement>(null);
  const uiCanvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const [playbackFrameIndex, setPlaybackFrameIndex] = useState<number | null>(null);
  const [playDirection, setPlayDirection] = useState(1);

  useEffect(() => {
    if (!isPlaying || project.frames.length <= 1) {
      if (playbackFrameIndex !== null) {
        setCurrentFrameIndex(playbackFrameIndex);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPlaybackFrameIndex(null);
      }
      return;
    }

    if (playbackFrameIndex === null) {
      setPlaybackFrameIndex(currentFrameIndex);
      return;
    }

    const currentFrame = project.frames[playbackFrameIndex] || project.frames[0];
    const frameDuration = (currentFrame?.duration || 200) / previewSpeed;

    const timeout = setTimeout(() => {
      if (isPingPong) {
        if (playDirection === 1) {
          if (playbackFrameIndex === project.frames.length - 1) {
            setPlayDirection(-1);
            setPlaybackFrameIndex(prev => prev! - 1);
          } else {
            setPlaybackFrameIndex(prev => prev! + 1);
          }
        } else {
          if (playbackFrameIndex === 0) {
            setPlayDirection(1);
            setPlaybackFrameIndex(prev => prev! + 1);
          } else {
            setPlaybackFrameIndex(prev => prev! - 1);
          }
        }
      } else {
        setPlaybackFrameIndex(prev => (prev! + 1) % project.frames.length);
      }
    }, frameDuration);

    return () => clearTimeout(timeout);
  }, [isPlaying, project.frames, currentFrameIndex, previewSpeed, isPingPong, playDirection, playbackFrameIndex, setCurrentFrameIndex]);

  // Ensure currentFrameIndex is always in bounds
  useEffect(() => {
    if (currentFrameIndex >= project.frames.length) {
      setCurrentFrameIndex(Math.max(0, project.frames.length - 1));
    }
  }, [project.frames.length, currentFrameIndex]);

  const activeFrameIndex = Math.max(0, Math.min(project.frames.length - 1, isPlaying && playbackFrameIndex !== null ? playbackFrameIndex : currentFrameIndex));
  const currentFrame = project.frames[activeFrameIndex] || project.frames[0];

  // Update timeline highlight directly to avoid re-rendering Editor
  useEffect(() => {
    project.frames.forEach((_, idx) => {
      const el = document.getElementById(`frame-preview-${idx}`);
      if (el) {
        if (idx === activeFrameIndex) {
          el.className = "relative w-20 h-20 rounded-xl border-2 cursor-pointer transition-all overflow-hidden bg-[#0a0a0a] border-blue-500 scale-105 shadow-lg shadow-blue-500/20";
        } else {
          el.className = "relative w-20 h-20 rounded-xl border-2 cursor-pointer transition-all overflow-hidden bg-[#0a0a0a] border-white/5 hover:border-white/20";
        }
      }
    });
  }, [activeFrameIndex, project.frames]);

  const prevBaseFrameDeps = useRef<{ width: number, height: number, layers: any, cells: any } | null>(null);

  // Art Rendering
  useEffect(() => {
    const canvas = artCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const canvasWidth = isTiledMode ? (selection ? selection.w * visibleBounds.width : project.width * visibleBounds.width) : (isMirrorMode && ['left', 'right'].includes(mirrorDirection) ? project.width * 2 : project.width);
    const canvasHeight = isTiledMode ? (selection ? selection.h * visibleBounds.height : project.height * visibleBounds.height) : (isMirrorMode && ['top', 'bottom'].includes(mirrorDirection) ? project.height * 2 : project.height);

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement('canvas');
    }
    const offscreenCanvas = offscreenCanvasRef.current;
    
    // Check if base frame needs redrawing
    const currentDeps = { width: project.width, height: project.height, layers: project.layers, cells: currentFrame.cells };
    const prevDeps = prevBaseFrameDeps.current;
    let needsRedraw = false;
    
    if (!prevDeps || 
        prevDeps.width !== currentDeps.width || 
        prevDeps.height !== currentDeps.height || 
        prevDeps.layers !== currentDeps.layers || 
        prevDeps.cells !== currentDeps.cells) {
      needsRedraw = true;
      prevBaseFrameDeps.current = currentDeps;
    }

    if (needsRedraw) {
      offscreenCanvas.width = project.width;
      offscreenCanvas.height = project.height;
      const offscreenCtx = offscreenCanvas.getContext('2d');
      
      if (offscreenCtx) {
        offscreenCtx.clearRect(0, 0, project.width, project.height);
        const reversedLayers = project.layers.slice().reverse();
        reversedLayers.forEach((layer, reversedIdx) => {
          if (!layer.isVisible || !currentFrame.cells[layer.id]) return;
          offscreenCtx.globalAlpha = layer.opacity;
          const cells = currentFrame.cells[layer.id];
          const originalIdx = project.layers.length - 1 - reversedIdx;

          cells.forEach((color, i) => {
            if (color === 'transparent') return;

            if (layer.clipToBelow) {
              let hasColorBelow = false;
              for (let j = originalIdx + 1; j < project.layers.length; j++) {
                const belowLayer = project.layers[j];
                if (!belowLayer.isVisible) continue;
                const belowColor = currentFrame.cells[belowLayer.id]?.[i] || 'transparent';
                if (belowColor !== 'transparent') {
                  hasColorBelow = true;
                  break;
                }
              }
              if (!hasColorBelow) return; // Make it transparent
            }

            offscreenCtx.fillStyle = color;
            offscreenCtx.fillRect((i % project.width), Math.floor(i / project.width), 1, 1);
          });
        });
      }
    }
    
    if (isTiledMode) {
      const tileW = selection ? selection.w : project.width;
      const tileH = selection ? selection.h : project.height;
      
      for (let ty = visibleBounds.minY; ty <= visibleBounds.maxY; ty++) {
        for (let tx = visibleBounds.minX; tx <= visibleBounds.maxX; tx++) {
          const tileIndex = ty * 3 + tx;
          if (!visibleTiles[tileIndex]) continue;
          
          ctx.globalAlpha = (tx === 1 && ty === 1) ? 1 : tiledOpacity;
          
          const destX = (tx - visibleBounds.minX) * tileW;
          const destY = (ty - visibleBounds.minY) * tileH;
          
          if (selection) {
            // Draw ONLY the selection area, packed adjacent to each other
            ctx.drawImage(
              offscreenCanvas,
              selection.x, selection.y, selection.w, selection.h,
              destX,
              destY,
              selection.w, selection.h
            );
          } else {
            ctx.drawImage(offscreenCanvas, destX, destY);
          }
        }
      }
    } else if (isMirrorMode) {
      let originalOffsetX = 0;
      let originalOffsetY = 0;
      if (mirrorDirection === 'left') originalOffsetX = project.width;
      if (mirrorDirection === 'top') originalOffsetY = project.height;
      
      ctx.globalAlpha = 1;
      ctx.drawImage(offscreenCanvas, originalOffsetX, originalOffsetY);
      
      ctx.save();
      if (mirrorDirection === 'right') {
        ctx.translate(project.width * 2, 0);
        ctx.scale(-1, 1);
      } else if (mirrorDirection === 'left') {
        ctx.translate(project.width, 0);
        ctx.scale(-1, 1);
      } else if (mirrorDirection === 'bottom') {
        ctx.translate(0, project.height * 2);
        ctx.scale(1, -1);
      } else if (mirrorDirection === 'top') {
        ctx.translate(0, project.height);
        ctx.scale(1, -1);
      }
      
      ctx.globalAlpha = mirrorOpacity;
      ctx.drawImage(offscreenCanvas, 0, 0);
      ctx.restore();
    } else {
      ctx.globalAlpha = 1;
      ctx.drawImage(offscreenCanvas, 0, 0);
    }
    ctx.globalAlpha = 1;

    let mirrorOffsetX = 0;
    let mirrorOffsetY = 0;
    if (isMirrorMode && !isTiledMode) {
      if (mirrorDirection === 'left') mirrorOffsetX = project.width;
      if (mirrorDirection === 'top') mirrorOffsetY = project.height;
    }
    
    // Draw selected pixels (if moving)
    if (selectedPixels.length > 0 && selection) {
      ctx.globalAlpha = 1;
      selectedPixels.forEach(p => {
        const x = p.x + selection.x + (isTiledMode ? project.width : mirrorOffsetX);
        const y = p.y + selection.y + (isTiledMode ? project.height : mirrorOffsetY);
        if (p.color !== 'transparent') {
          ctx.fillStyle = p.color;
          ctx.fillRect(x, y, 1, 1);
        }
      });
    }

    // Draw transform state
    if (transformState) {
      ctx.save();
      ctx.globalAlpha = 1;
      
      const rad = transformState.rotation * Math.PI / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      
      const corners = [
        { x: -transformState.w / 2, y: -transformState.h / 2 },
        { x: transformState.w / 2, y: -transformState.h / 2 },
        { x: transformState.w / 2, y: transformState.h / 2 },
        { x: -transformState.w / 2, y: transformState.h / 2 }
      ];
      
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      corners.forEach(c => {
        const rx = c.x * cos - c.y * sin;
        const ry = c.x * sin + c.y * cos;
        const tx = rx + transformState.centerX;
        const ty = ry + transformState.centerY;
        minX = Math.min(minX, tx);
        minY = Math.min(minY, ty);
        maxX = Math.max(maxX, tx);
        maxY = Math.max(maxY, ty);
      });
      
      const startX = Math.floor(minX);
      const startY = Math.floor(minY);
      const endX = Math.ceil(maxX);
      const endY = Math.ceil(maxY);
      
      for (let y = startY; y <= endY; y++) {
        for (let x = startX; x <= endX; x++) {
          const dx = x - transformState.centerX + 0.5;
          const dy = y - transformState.centerY + 0.5;
          
          const rx = dx * cos + dy * sin;
          const ry = -dx * sin + dy * cos;
          
          const sx = rx / (transformState.w / transformState.originalW);
          const sy = ry / (transformState.h / transformState.originalH);
          
          const ox = Math.floor(sx + transformState.originalW / 2);
          const oy = Math.floor(sy + transformState.originalH / 2);
          
          if (ox >= 0 && ox < transformState.originalW && oy >= 0 && oy < transformState.originalH) {
            const pixel = transformState.pixels.find(p => p.x === ox && p.y === oy);
            if (pixel && pixel.color !== 'transparent') {
              ctx.fillStyle = pixel.color;
              ctx.fillRect(x + (isTiledMode ? project.width : mirrorOffsetX), y + (isTiledMode ? project.height : mirrorOffsetY), 1, 1);
            }
          }
        }
      }
      ctx.restore();
    }

    // Draw preview pixels
    if ((previewPixels.length > 0 || previewStampCenters.length > 0) && !['selection', 'transform', 'magic-wand'].includes(tool)) {
      if (activeBrushId === 'stamp' && activeStampId) {
        const stamp = project.stamps?.find(s => s.id === activeStampId);
        if (stamp) {
          ctx.globalAlpha = 0.8;
          
          // For tools that tile the stamp (pixel-outline-pencil, color-replace) OR when global alignment is ON
          if ((['pixel-outline-pencil', 'color-replace'].includes(tool) || globalBrushAlignment) && previewPixels.length > 0) {
            previewPixels.forEach(idx => {
              const x = idx % project.width;
              const y = Math.floor(idx / project.width);
              const sx = ((x + globalAlignmentOffsetX) % stamp.width + stamp.width) % stamp.width;
              const sy = ((y + globalAlignmentOffsetY) % stamp.height + stamp.height) % stamp.height;
              const color = stamp.pixels[sy * stamp.width + sx];
              if (color !== 'transparent') {
                ctx.fillStyle = color;
                ctx.fillRect(x + (isTiledMode ? project.width : 0), y + (isTiledMode ? project.height : 0), 1, 1);
              }
            });
          } else {
            // For tools that center the stamp (pencil, eraser, conditional-pencil, transparent-filler, shapes)
            const centers = previewStampCenters.length > 0 ? previewStampCenters : (hoveredPixelIndex !== null ? [hoveredPixelIndex] : []);
            
            centers.forEach(centerIdx => {
              const cx = centerIdx % project.width;
              const cy = Math.floor(centerIdx / project.width);
              const startX = cx - Math.floor(stamp.width / 2);
              const startY = cy - Math.floor(stamp.height / 2);
              
              for (let sy = 0; sy < stamp.height; sy++) {
                for (let sx = 0; sx < stamp.width; sx++) {
                  const px = startX + sx;
                  const py = startY + sy;
                  if (px >= 0 && px < project.width && py >= 0 && py < project.height) {
                    const color = stamp.pixels[sy * stamp.width + sx];
                    if (color !== 'transparent') {
                      const drawX = px + (isTiledMode ? (1 - visibleBounds.minX) * project.width : mirrorOffsetX);
                      const drawY = py + (isTiledMode ? (1 - visibleBounds.minY) * project.height : mirrorOffsetY);
                      ctx.fillStyle = tool === 'eraser' ? 'white' : color;
                      ctx.fillRect(drawX, drawY, 1, 1);
                    }
                  }
                }
              }
            });
          }
        }
      } else {
        ctx.globalAlpha = tool === 'eraser' ? 0.5 : 0.8;
        ctx.fillStyle = tool === 'eraser' ? 'rgba(255, 255, 255, 0.5)' : getActiveColor(activeColorSlot);
        previewPixels.forEach(i => {
          const x = i % project.width + (isTiledMode ? (1 - visibleBounds.minX) * project.width : mirrorOffsetX);
          const y = Math.floor(i / project.width) + (isTiledMode ? (1 - visibleBounds.minY) * project.height : mirrorOffsetY);
          ctx.fillRect(x, y, 1, 1);
        });
      }
    }
  }, [project.width, project.height, project.layers, currentFrame.cells, isTiledMode, tiledOpacity, previewPixels, previewStampCenters, tool, getActiveColor, activeColorSlot, selection, selectionMask, selectedPixels, visibleTiles, visibleBounds, transformState, activeBrushId, activeStampId, hoveredPixelIndex, globalBrushAlignment, globalAlignmentOffsetX, globalAlignmentOffsetY, isMirrorMode, mirrorDirection, mirrorOpacity]);

  // UI Rendering (Grid, Hover)
  useEffect(() => {
    const canvas = uiCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    ctx.clearRect(0, 0, rect.width, rect.height);

    const canvasWidth = isTiledMode ? (selection ? selection.w * visibleBounds.width : project.width * visibleBounds.width) : (isMirrorMode && ['left', 'right'].includes(mirrorDirection) ? project.width * 2 : project.width);
    const canvasHeight = isTiledMode ? (selection ? selection.h * visibleBounds.height : project.height * visibleBounds.height) : (isMirrorMode && ['top', 'bottom'].includes(mirrorDirection) ? project.height * 2 : project.height);

    const scale = rect.width / canvasWidth;
    
    let startX = 0;
    let startY = 0;
    if (isTiledMode) {
      startX = (selection ? (selection.w * (1 - visibleBounds.minX)) : (project.width * (1 - visibleBounds.minX))) * scale;
      startY = (selection ? (selection.h * (1 - visibleBounds.minY)) : (project.height * (1 - visibleBounds.minY))) * scale;
    } else if (isMirrorMode) {
      if (mirrorDirection === 'left') startX = project.width * scale;
      if (mirrorDirection === 'top') startY = project.height * scale;
    }

    const gStartX = (isTiledMode && selection) ? selection.x : 0;
    const gStartY = (isTiledMode && selection) ? selection.y : 0;
    const gEndX = (isTiledMode && selection) ? (selection.x + selection.w) : project.width;
    const gEndY = (isTiledMode && selection) ? (selection.y + selection.h) : project.height;

    // Draw grid
    if (showGrid) {
      ctx.beginPath();
      ctx.strokeStyle = transparencyMode === 'day' 
        ? (gridSize === 1 ? 'rgba(0, 0, 0, 0.1)' : 'rgba(0, 0, 0, 0.2)')
        : (gridSize === 1 ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.2)');
      ctx.lineWidth = 1;

      if (gridSize === 1) {
        for (let x = gStartX; x <= gEndX; x++) {
          const px = startX + x * scale;
          ctx.moveTo(px, startY + gStartY * scale);
          ctx.lineTo(px, startY + gEndY * scale);
        }
        for (let y = gStartY; y <= gEndY; y++) {
          const py = startY + y * scale;
          ctx.moveTo(startX + gStartX * scale, py);
          ctx.lineTo(startX + gEndX * scale, py);
        }
      } else {
        const gridOffsetX_adj = gridOffsetX;
        const gridOffsetY_adj = gridOffsetY;
        for (let x = gStartX + (gridOffsetX_adj % gridSize); x <= gEndX; x += gridSize) {
          const px = startX + x * scale;
          ctx.moveTo(px, startY + gStartY * scale);
          ctx.lineTo(px, startY + gEndY * scale);
        }
        for (let y = gStartY + (gridOffsetY_adj % gridSize); y <= gEndY; y += gridSize) {
          const py = startY + y * scale;
          ctx.moveTo(startX + gStartX * scale, py);
          ctx.lineTo(startX + gEndX * scale, py);
        }
      }
      ctx.stroke();
    }
    
    // Draw hovered pixel
    if (hoveredPixelIndex !== null) {
      const x = hoveredPixelIndex % project.width;
      const y = Math.floor(hoveredPixelIndex / project.width);
      ctx.strokeStyle = transparencyMode === 'day' ? 'black' : 'white';
      ctx.lineWidth = 2;
      ctx.strokeRect(startX + x * scale, startY + y * scale, scale, scale);
    }

    // Draw selection borders following pixels
    if (selectionMask || ((tool === 'selection' || tool === 'transform') && !isSelecting && previewPixels.length > 0)) {
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;

      const previewSet = new Set(previewPixels);
      const isPixelSelected = (x: number, y: number) => {
        if (x < 0 || x >= project.width || y < 0 || y >= project.height) return false;
        const idx = y * project.width + x;
        if (selectionMask && selectionMask[idx]) return true;
        
        if (!isSelecting && (tool === 'selection' || tool === 'transform') && previewSet.has(idx)) return true;
        return false;
      };

      // We can limit the search to the bounding box plus a small margin
      const minX = selection ? Math.max(0, selection.x - 1) : 0;
      const minY = selection ? Math.max(0, selection.y - 1) : 0;
      const maxX = selection ? Math.min(project.width - 1, selection.x + selection.w) : project.width - 1;
      const maxY = selection ? Math.min(project.height - 1, selection.y + selection.h) : project.height - 1;
      
      const drawBorders = (offsetX: number, offsetY: number) => {
        for (let y = 0; y < project.height; y++) {
          for (let x = 0; x < project.width; x++) {
            if (isPixelSelected(x, y)) {
              const px = offsetX + x * scale;
              const py = offsetY + y * scale;
              
              // Top edge
              if (!isPixelSelected(x, y - 1)) {
                ctx.moveTo(px, py);
                ctx.lineTo(px + scale, py);
              }
              // Bottom edge
              if (!isPixelSelected(x, y + 1)) {
                ctx.moveTo(px, py + scale);
                ctx.lineTo(px + scale, py + scale);
              }
              // Left edge
              if (!isPixelSelected(x - 1, y)) {
                ctx.moveTo(px, py);
                ctx.lineTo(px, py + scale);
              }
              // Right edge
              if (!isPixelSelected(x + 1, y)) {
                ctx.moveTo(px + scale, py);
                ctx.lineTo(px + scale, py + scale);
              }
            }
          }
        }
      };

      if (!isTiledMode && (selection || (!isSelecting && previewPixels.length > 0))) {
        drawBorders(startX, startY);
      }
      
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw selection mask and preview
    if (selectionMask || ((tool === 'selection' || tool === 'transform') && !isSelecting && previewPixels.length > 0)) {
      ctx.fillStyle = 'rgba(59, 130, 246, 0.2)'; // blue-500 with low opacity
      
      const drawMask = (offsetX: number, offsetY: number) => {
        if (selectionMask) {
          for (let i = 0; i < selectionMask.length; i++) {
            if (selectionMask[i]) {
              const x = i % project.width;
              const y = Math.floor(i / project.width);
              ctx.fillRect(offsetX + x * scale, offsetY + y * scale, scale, scale);
            }
          }
        }
        
        if ((tool === 'selection' || tool === 'transform') && !isSelecting && previewPixels.length > 0) {
          previewPixels.forEach(idx => {
            const x = idx % project.width;
            const y = Math.floor(idx / project.width);
            ctx.fillRect(offsetX + x * scale, offsetY + y * scale, scale, scale);
          });
        }
      };

      if (!isTiledMode && (selection || (!isSelecting && previewPixels.length > 0))) {
        drawMask(startX, startY);
      }
    }
  }, [project.width, project.height, isTiledMode, showGrid, gridSize, gridOffsetX, gridOffsetY, hoveredPixelIndex, selection, selectionMask, previewPixels, tool, zoom, transparencyMode, isMirrorMode, mirrorDirection, isSelecting, selectionStart, visibleTiles, visibleBounds]);

  const handleInteraction = (e: React.MouseEvent, interactionType: 'move' | 'down') => {
    const canvas = uiCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const canvasWidth = isTiledMode ? (selection ? selection.w * visibleBounds.width : project.width * visibleBounds.width) : (isMirrorMode && ['left', 'right'].includes(mirrorDirection) ? project.width * 2 : project.width);
    const canvasHeight = isTiledMode ? (selection ? selection.h * visibleBounds.height : project.height * visibleBounds.height) : (isMirrorMode && ['top', 'bottom'].includes(mirrorDirection) ? project.height * 2 : project.height);

    const x = Math.floor((e.clientX - rect.left) / (rect.width / canvasWidth));
    const y = Math.floor((e.clientY - rect.top) / (rect.height / canvasHeight));
    
    if (isTiledMode && interactionType === 'down' && e.shiftKey) {
      const tileX = Math.floor(x / (selection ? selection.w : project.width)) + visibleBounds.minX;
      const tileY = Math.floor(y / (selection ? selection.h : project.height)) + visibleBounds.minY;
      if (tileX >= 0 && tileX < 3 && tileY >= 0 && tileY < 3) {
        const tileIndex = tileY * 3 + tileX;
        if (tileIndex === 4) return; // Don't toggle middle tile
        setVisibleTiles(prev => {
          const next = [...prev];
          next[tileIndex] = !next[tileIndex];
          return next;
        });
        return;
      }
    }

    let localX = x;
    let localY = y;
    
    if (isTiledMode) {
      const tileW = selection ? selection.w : project.width;
      const tileH = selection ? selection.h : project.height;
      
      const absX = x + visibleBounds.minX * tileW;
      const absY = y + visibleBounds.minY * tileH;
      
      if (selection && tool !== 'selection' && tool !== 'transform') {
        const relX = absX % selection.w;
        const relY = absY % selection.h;
        localX = selection.x + (relX < 0 ? relX + selection.w : relX);
        localY = selection.y + (relY < 0 ? relY + selection.h : relY);
      } else {
        localX = absX - tileW;
        localY = absY - tileH;
      }
    } else if (isMirrorMode) {
      if (mirrorDirection === 'left') localX = x - project.width;
      if (mirrorDirection === 'top') localY = y - project.height;
      
      // Map mirror side to original side
      if (mirrorDirection === 'right' && x >= project.width) localX = project.width - 1 - (x - project.width);
      if (mirrorDirection === 'left' && x < project.width) localX = project.width - 1 - x;
      if (mirrorDirection === 'bottom' && y >= project.height) localY = project.height - 1 - (y - project.height);
      if (mirrorDirection === 'top' && y < project.height) localY = project.height - 1 - y;
    }
    
    if (localX >= 0 && localX < project.width && localY >= 0 && localY < project.height) {
      const index = localY * project.width + localX;
      if (interactionType === 'move') {
        setHoveredPixelPos({ x: localX, y: localY });
        handlePixelEnter(index, e.shiftKey);
        if (isMouseDown && !['line', 'square', 'circle', 'selection', 'transform'].includes(tool)) handlePixelInteraction(index, e.shiftKey);
      } else {
        handlePixelInteraction(index, e.shiftKey);
      }
    } else if (interactionType === 'move') {
      setHoveredPixelIndex(null);
      setHoveredPixelPos({ x: localX, y: localY });
    }
  };

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={artCanvasRef}
        className="absolute inset-0 w-full h-full block"
        style={{ imageRendering: 'pixelated' }}
      />
      <canvas
        ref={uiCanvasRef}
        onMouseMove={(e) => handleInteraction(e, 'move')}
        onMouseDown={(e) => e.button === 0 && handleInteraction(e, 'down')}
        onMouseLeave={() => {
          setHoveredPixelIndex(null);
          if (!isMouseDown) setPreviewPixels([]);
        }}
        className="absolute inset-0 w-full h-full block cursor-crosshair"
      />
    </div>
  );
}

function Checkerboard({ mode = 'day', className }: { mode?: 'day' | 'night', className?: string }) {
  const color1 = mode === 'day' ? '#ffffff' : '#1a1a1a';
  const color2 = mode === 'day' ? '#f0f0f0' : '#262626';
  
  return (
    <div 
      className={cn("absolute inset-0 pointer-events-none", className)}
      style={{
        backgroundImage: `conic-gradient(${color2} 90deg, ${color1} 90deg 180deg, ${color2} 180deg 270deg, ${color1} 270deg)`,
        backgroundSize: '16px 16px'
      }}
    />
  );
}

function ToolButton({ active, onClick, icon, label, description, onMouseEnter, onMouseLeave }: { 
  active: boolean, 
  onClick: () => void, 
  icon: React.ReactNode, 
  label: string, 
  description: string,
  onMouseEnter?: (e: React.MouseEvent) => void,
  onMouseLeave?: () => void
}) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(
        "w-11 h-11 shrink-0 p-2 rounded-xl transition-all relative group flex items-center justify-center cursor-grab active:cursor-grabbing",
        active ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30" : "text-white/40 hover:bg-white/5 hover:text-white"
      )}
    >
      {icon}
    </button>
  );
}
