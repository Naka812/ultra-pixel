declare module 'gifenc' {
  export function GIFEncoder(opts?: any): any;
  export function quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number, options?: any): number[][];
  export function applyPalette(rgba: Uint8Array | Uint8ClampedArray, palette: number[][], format?: string): Uint8Array;
}
