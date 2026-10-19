export interface LayerMetadata {
  id: string;
  name: string;
  isVisible: boolean;
  isLocked: boolean;
  opacity: number;
  clipToBelow?: boolean;
}

export type SelectionArea = { x: number, y: number, w: number, h: number };

export interface Frame {
  id: string;
  cells: { [layerId: string]: string[] }; // layerId -> pixel data
  onionSkin?: boolean;
  isLocked?: boolean;
  duration?: number; // duration in ms
}

export interface AssetFolder {
  id: string;
  name: string;
  type: 'brush' | 'stamp';
}

export interface BrushShape {
  id: string;
  name: string;
  width: number;
  height: number;
  pixels: boolean[]; // 1D array representing the 2D brush shape
  folderId?: string;
}

export interface Stamp {
  id: string;
  name: string;
  width: number;
  height: number;
  pixels: string[]; // 1D array of colors (including 'transparent')
  folderId?: string;
}

export interface Palette {
  id: string;
  name: string;
  colors: string[];
  isMinimized: boolean;
  lockedPaletteIndices?: number[];
}

export interface PixelProject {
  id: string;
  dbId?: number;
  name: string;
  width: number;
  height: number;
  layers: LayerMetadata[];
  frames: Frame[];
  palettes: Palette[];
  brushes?: BrushShape[];
  stamps?: Stamp[];
  folders?: AssetFolder[];
  lastModified: number;
  thumbnail?: string;
  transparencyMode?: 'day' | 'night';
}

export type Tool = 'pencil' | 'eraser' | 'bucket' | 'picker' | 'selection' | 'magic-wand' | 'pixel-outline-pencil' | 'color-replace' | 'line' | 'square' | 'circle' | 'transparent-filler' | 'conditional-pencil' | 'transform';
