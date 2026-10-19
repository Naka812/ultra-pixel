"use client";

import React, { useState } from 'react';
import { PixelProject } from '@/types';
import { DEFAULT_PALETTE } from '@/lib/constants';
import { Plus, Grid2X2, Clock, Trash2, Play, Upload, Info, X, Film } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';
import { useLanguage } from '@/lib/LanguageContext';
import SpriteSheetModal from '@/components/SpriteSheetModal';

interface GalleryProps {
  projects: PixelProject[];
  onSelect: (project: PixelProject) => void;
  onCreate: (name: string, width: number, height: number) => void;
  onDelete: (project: PixelProject) => void;
  onImport: (project: PixelProject) => void;
}

export default function Gallery({ projects, onSelect, onCreate, onDelete, onImport }: GalleryProps) {
  const { t, language, setLanguage } = useLanguage();
  const [isCreating, setIsCreating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isSpriteSheetModalOpen, setIsSpriteSheetModalOpen] = useState(false);
  const [spriteSheetInitialFile, setSpriteSheetInitialFile] = useState<File | null>(null);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newWidth, setNewWidth] = useState(16);
  const [newHeight, setNewHeight] = useState(16);
  const [importUrl, setImportUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSpriteSheetFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSpriteSheetInitialFile(file);
    setIsSpriteSheetModalOpen(true);
    e.target.value = '';
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      setError(t('pleaseEnterName'));
      return;
    }
    if (newWidth > 1024 || newHeight > 1024) {
      setError(t('sizeLimitExceeded'));
      return;
    }
    onCreate(newName, newWidth, newHeight);
    setNewName('');
    setError(null);
    setIsCreating(false);
  };

  const handleImportUltrapixel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const importedProject = JSON.parse(content) as PixelProject;
        
        if (importedProject && importedProject.id && importedProject.frames && importedProject.layers) {
          if (importedProject.width > 1024 || importedProject.height > 1024) {
            alert(t('sizeLimitExceeded'));
            return;
          }
          onImport(importedProject);
        } else {
          alert(t('invalidProjectFile'));
        }
      } catch (err) {
        console.error('Error parsing project file:', err);
        alert(t('errorReadingFile'));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importUrl.trim()) return;

    setIsProcessing(true);
    try {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.src = importUrl;
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      // We'll limit the import size to 1024x1024 to keep it "pixel art"
      if (img.width > 1024 || img.height > 1024) {
        alert(t('sizeLimitExceeded'));
        setIsProcessing(false);
        return;
      }
      const width = img.width;
      const height = img.height;
      
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      
      const imageData = ctx.getImageData(0, 0, width, height);
      const data: string[] = [];
      
      for (let i = 0; i < imageData.data.length; i += 4) {
        const r = imageData.data[i];
        const g = imageData.data[i + 1];
        const b = imageData.data[i + 2];
        const a = imageData.data[i + 3];
        
        if (a < 128) {
          data.push('transparent');
        } else {
          const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
          data.push(hex);
        }
      }

      const layerId = Math.random().toString(36).substring(7);
      const frameId = Math.random().toString(36).substring(7);

      const newProject: PixelProject = {
        id: Math.random().toString(36).substring(7),
        name: `Imported ${new Date().toLocaleTimeString()}`,
        width,
        height,
        layers: [{
          id: layerId,
          name: 'Layer 1',
          isVisible: true,
          isLocked: false,
          opacity: 1
        }],
        frames: [{
          id: frameId,
          cells: {
            [layerId]: data
          }
        }],
        palettes: [{
          id: 'default',
          name: 'Default Palette',
          colors: DEFAULT_PALETTE,
          isMinimized: false,
          lockedPaletteIndices: []
        }],
        lastModified: Date.now()
      };
      
      onSelect(newProject);
      setImportUrl('');
      setIsImporting(false);
    } catch (err) {
      alert(t('failedToImportUrl'));
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#121212] text-white p-8 md:p-12">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col items-center gap-6 mb-16 relative">
          <div className="absolute right-0 top-0 flex items-center gap-2">
            <button
              onClick={() => setLanguage(language === 'en' ? 'pt' : 'en')}
              className="p-3 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-full transition-all flex items-center gap-2"
              title={t('language')}
            >
              <span className="text-sm font-bold uppercase">{language}</span>
            </button>
            <button
              onClick={() => setIsInfoOpen(true)}
              className="p-3 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-full transition-all flex items-center gap-2"
              title={t('editorFeatures')}
            >
              <Info className="w-5 h-5" />
              <span className="text-sm font-medium hidden sm:block">{t('features')}</span>
            </button>
          </div>
          <div className="relative group">
            <div className="absolute -inset-4 bg-yellow-500/20 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <h1 className="text-6xl font-black tracking-tighter text-white relative drop-shadow-[0_0_20px_rgba(255,215,0,0.2)]">
              ULTRA<span className="text-yellow-400">PIXEL</span>
            </h1>
          </div>
          <p className="text-white/40 text-lg font-medium tracking-wide">{t('yourPixelArtLab')}</p>
          
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {/* Create New Card */}
          <button 
            onClick={() => {
              setError(null);
              setIsCreating(true);
            }}
            className="group relative aspect-[4/5] flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-2xl hover:border-blue-500/50 hover:bg-blue-500/5 transition-all"
          >
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Plus className="w-8 h-8 text-white/20 group-hover:text-blue-400" />
            </div>
            <span className="mt-4 text-sm font-bold text-white/20 group-hover:text-blue-400">{t('createNew')}</span>
          </button>

          {/* Import Sprite Sheet Card */}
          <label className="group relative aspect-[4/5] flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-2xl hover:border-purple-500/50 hover:bg-purple-500/5 transition-all cursor-pointer">
            <input 
              type="file" 
              accept="image/png,image/jpeg,image/webp,image/gif" 
              className="hidden" 
              onChange={handleSpriteSheetFileSelected} 
            />
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Film className="w-8 h-8 text-white/20 group-hover:text-purple-400" />
            </div>
            <span className="mt-4 text-sm font-bold text-white/20 group-hover:text-purple-400 text-center px-2">{t('importSpriteSheet')}</span>
          </label>

          {/* Import .ultrapixel Card */}
          <label className="group relative aspect-[4/5] flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-2xl hover:border-green-500/50 hover:bg-green-500/5 transition-all cursor-pointer">
            <input 
              type="file" 
              accept=".ultrapixel" 
              className="hidden" 
              onChange={handleImportUltrapixel} 
            />
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Upload className="w-8 h-8 text-white/20 group-hover:text-green-400" />
            </div>
            <span className="mt-4 text-sm font-bold text-white/20 group-hover:text-green-400">{t('importUltrapixel')}</span>
          </label>

          {projects.map((project) => (
            <motion.div 
              layout
              key={project.dbId ? `db-${project.dbId}` : project.id}
              className="group bg-[#1a1a1a] border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition-all"
            >
              <div className="relative aspect-square bg-[#242424] p-6 flex items-center justify-center">
                <div 
                  className="shadow-inner relative overflow-hidden"
                  style={{
                    width: project.width >= project.height ? '100%' : undefined,
                    height: project.height > project.width ? '100%' : undefined,
                    aspectRatio: `${project.width} / ${project.height}`,
                    display: 'grid',
                    gridTemplateColumns: `repeat(${project.width}, 1fr)`,
                    gridTemplateRows: `repeat(${project.height}, 1fr)`,
                    imageRendering: 'pixelated',
                    backgroundImage: (project.transparencyMode || 'night') === 'day' 
                      ? `conic-gradient(#f0f0f0 90deg, #ffffff 90deg 180deg, #f0f0f0 180deg 270deg, #ffffff 270deg)`
                      : `conic-gradient(#262626 90deg, #1a1a1a 90deg 180deg, #262626 180deg 270deg, #1a1a1a 270deg)`,
                    backgroundSize: '16px 16px'
                  }}
                >
                  {/* Render first frame, all visible layers */}
                  {project.layers?.slice().reverse().filter(l => l.isVisible).map((layer) => (
                    <div 
                      key={layer.id}
                      className="absolute inset-0 grid"
                      style={{ 
                        gridTemplateColumns: `repeat(${project.width}, 1fr)`,
                        gridTemplateRows: `repeat(${project.height}, 1fr)`,
                        opacity: layer.opacity 
                      }}
                    >
                      {project.frames?.[0]?.cells[layer.id]?.map((color, i) => {
                        if (color === 'transparent') return <div key={`layer-${layer.id}-pixel-${i}`} />;
                        
                        if (layer.clipToBelow) {
                          let hasColorBelow = false;
                          // Find the actual index of this layer in the full layers array
                          const originalIdx = project.layers.findIndex(l => l.id === layer.id);
                          for (let j = originalIdx + 1; j < project.layers.length; j++) {
                            const belowLayer = project.layers[j];
                            if (!belowLayer.isVisible) continue;
                            const belowColor = project.frames[0].cells[belowLayer.id]?.[i] || 'transparent';
                            if (belowColor !== 'transparent') {
                              hasColorBelow = true;
                              break;
                            }
                          }
                          if (!hasColorBelow) return <div key={`layer-${layer.id}-pixel-${i}`} />;
                        }
                        
                        return <div key={`layer-${layer.id}-pixel-${i}`} style={{ backgroundColor: color }} />;
                      })}
                    </div>
                  ))}
                </div>
                
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <button 
                    onClick={() => onSelect(project)}
                    className="p-3 bg-white text-black rounded-full hover:scale-110 transition-transform"
                  >
                    <Play className="w-5 h-5 fill-current" />
                  </button>
                  <button 
                    onClick={() => onDelete(project)}
                    className="p-3 bg-red-500 text-white rounded-full hover:scale-110 transition-transform"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="p-5">
                <h3 className="font-bold text-sm mb-1 truncate">{project.name}</h3>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[10px] text-white/40 uppercase tracking-widest">
                    <Grid2X2 className="w-3 h-3" />
                    {project.width}x{project.height}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-white/40 uppercase tracking-widest">
                    <Clock className="w-3 h-3" />
                    {new Date(project.lastModified).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        <footer className="mt-16 text-center text-white/20 text-xs pb-8">
          Desenvolvido por Anderson Nakanome
        </footer>
      </div>

      {/* Import Modal */}
      {isImporting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#1a1a1a] border border-white/10 rounded-3xl p-8 w-full max-w-md shadow-2xl"
          >
            <h2 className="text-2xl font-black mb-2">{t('importFromUrl')}</h2>
            <p className="text-white/40 text-xs mb-6">Enter a direct link to an image (PNG, JPG) to convert it to pixels.</p>
            <form onSubmit={handleImport} className="space-y-6">
              <div>
                <label className="block text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">{t('imageUrl')}</label>
                <input 
                  autoFocus
                  type="url" 
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="https://example.com/image.png"
                  required
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  disabled={isProcessing}
                  onClick={() => setIsImporting(false)}
                  className="flex-1 px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold transition-all disabled:opacity-50"
                >
                  {t('cancel')}
                </button>
                <button 
                  type="submit"
                  disabled={isProcessing}
                  className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : t('import')}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#1a1a1a] border border-white/10 rounded-3xl p-8 w-full max-w-md shadow-2xl"
          >
            <h2 className="text-2xl font-black mb-6">{t('newProject')}</h2>
            <form onSubmit={handleCreate} className="space-y-6">
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs font-bold">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">{t('projectName')}</label>
                <input 
                  autoFocus
                  type="text" 
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    if (error) setError(null);
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="My Masterpiece"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">{t('width')} (px)</label>
                  <input 
                    type="number"
                    min="1"
                    max="256"
                    value={newWidth}
                    onChange={(e) => setNewWidth(Math.max(1, Math.min(256, parseInt(e.target.value) || 1)))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">Height (px)</label>
                  <input 
                    type="number"
                    min="1"
                    max="256"
                    value={newHeight}
                    onChange={(e) => setNewHeight(Math.max(1, Math.min(256, parseInt(e.target.value) || 1)))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="flex-1 px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold transition-all"
                >
                  {t('cancel')}
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-all shadow-lg shadow-blue-600/20"
                >
                  {t('create')}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Info Modal */}
      {isInfoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#1a1a1a] border border-white/10 rounded-3xl p-8 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto flex flex-col"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-white">{t('editorFeatures')}</h2>
              <button 
                onClick={() => setIsInfoOpen(false)}
                className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-white/60 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-6 text-sm text-white/80 pr-2">
              <section>
                <h3 className="text-lg font-bold text-blue-400 mb-2">{t('drawingTools')}</h3>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li dangerouslySetInnerHTML={{ __html: t('pencilDesc') }} />
                  <li dangerouslySetInnerHTML={{ __html: t('eraserDesc') }} />
                  <li dangerouslySetInnerHTML={{ __html: t('bucketDesc') }} />
                  <li dangerouslySetInnerHTML={{ __html: t('lineDesc') }} />
                  <li dangerouslySetInnerHTML={{ __html: t('shapeDesc') }} />
                  <li dangerouslySetInnerHTML={{ __html: t('pickerDesc') }} />
                </ul>
              </section>

              <section>
                <h3 className="text-lg font-bold text-green-400 mb-2">{t('selectionTransform')}</h3>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li dangerouslySetInnerHTML={{ __html: t('rectSelectionDesc') }} />
                  <li dangerouslySetInnerHTML={{ __html: t('magicWandDesc') }} />
                  <li dangerouslySetInnerHTML={{ __html: t('moveDesc') }} />
                  <li dangerouslySetInnerHTML={{ __html: t('mirrorDesc') }} />
                  <li dangerouslySetInnerHTML={{ __html: t('rotateDesc') }} />
                  <li dangerouslySetInnerHTML={{ __html: t('resizeDesc') }} />
                </ul>
              </section>

              <section>
                <h3 className="text-lg font-bold text-purple-400 mb-2">{t('layersSection')}</h3>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li dangerouslySetInnerHTML={{ __html: t('multipleLayersDesc') }} />
                  <li dangerouslySetInnerHTML={{ __html: t('opacityDesc') }} />
                  <li dangerouslySetInnerHTML={{ __html: t('visibilityLockDesc') }} />
                  <li dangerouslySetInnerHTML={{ __html: t('clippingMaskDesc') }} />
                  <li dangerouslySetInnerHTML={{ __html: t('mergeDesc') }} />
                </ul>
              </section>

              <section>
                <h3 className="text-lg font-bold text-yellow-400 mb-2">{t('animationFrames')}</h3>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li dangerouslySetInnerHTML={{ __html: t('timelineDesc') }} />
                  <li dangerouslySetInnerHTML={{ __html: t('onionSkinDesc') }} />
                  <li dangerouslySetInnerHTML={{ __html: t('fpsControlDesc') }} />
                  <li dangerouslySetInnerHTML={{ __html: t('duplicateFramesDesc') }} />
                </ul>
              </section>

              <section>
                <h3 className="text-lg font-bold text-pink-400 mb-2">{t('importExport')}</h3>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li dangerouslySetInnerHTML={{ __html: t('saveProjectDesc') }} />
                  <li dangerouslySetInnerHTML={{ __html: t('exportPngDesc') }} />
                  <li dangerouslySetInnerHTML={{ __html: t('exportGifDesc') }} />
                  <li dangerouslySetInnerHTML={{ __html: t('exportSpriteSheetDesc') }} />
                  <li dangerouslySetInnerHTML={{ __html: t('importImageDesc') }} />
                </ul>
              </section>

              <section>
                <h3 className="text-lg font-bold text-orange-400 mb-2">{t('otherFeatures')}</h3>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li dangerouslySetInnerHTML={{ __html: t('colorPalettesDesc') }} />
                  <li dangerouslySetInnerHTML={{ __html: t('customBrushesDesc') }} />
                  <li dangerouslySetInnerHTML={{ __html: t('stampsDesc') }} />
                  <li dangerouslySetInnerHTML={{ __html: t('gridDesc') }} />
                  <li dangerouslySetInnerHTML={{ __html: t('undoRedoDesc') }} />
                  <li dangerouslySetInnerHTML={{ __html: t('symmetryDesc') }} />
                </ul>
              </section>
            </div>
          </motion.div>
        </div>
      )}

      {/* Sprite Sheet Slicer Modal */}
      <SpriteSheetModal
        isOpen={isSpriteSheetModalOpen}
        onClose={() => {
          setIsSpriteSheetModalOpen(false);
          setSpriteSheetInitialFile(null);
        }}
        onImport={(importedProject) => {
          onImport(importedProject);
        }}
        initialFile={spriteSheetInitialFile}
      />
    </div>
  );
}
