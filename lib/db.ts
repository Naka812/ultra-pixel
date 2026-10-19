import Dexie, { Table } from 'dexie';

export interface Project {
  id?: number;
  name: string;
  data: any; // Or a more specific type if known
  createdAt: number;
  lastModified?: number;
}

export interface Brush {
  id?: number;
  name: string;
  settings: any;
}

export interface Pattern {
  id?: number;
  name: string;
  data: string; // Base64 or URL
}

export interface Color {
  id?: number;
  hex: string;
}

export interface Palette {
  id?: number;
  name: string;
  colors: string[]; // Array of hex codes
}

export class AppDatabase extends Dexie {
  projects!: Table<Project>;
  brushes!: Table<Brush>;
  patterns!: Table<Pattern>;
  colors!: Table<Color>;
  palettes!: Table<Palette>;

  constructor() {
    super('UltraPixelDB');
    this.version(2).stores({
      projects: '++id, name, createdAt, data.id',
      brushes: '++id, name',
      patterns: '++id, name',
      colors: '++id, hex',
      palettes: '++id, name',
    });
  }
}

export const db = new AppDatabase();
