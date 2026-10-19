
export interface HSL {
  h: number;
  s: number;
  l: number;
}

export function hexToHsl(hex: string): HSL {
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.substring(1, 3), 16);
    g = parseInt(hex.substring(3, 5), 16);
    b = parseInt(hex.substring(5, 7), 16);
  }

  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

export function hslToHex(h: number, s: number, l: number): string {
  h /= 360;
  s /= 100;
  l /= 100;
  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export type HarmonyType = 'monochromatic' | 'analogous' | 'triad' | 'split-complementary' | 'tetradic';

export function generateHarmony(hex: string, type: HarmonyType): string[] {
  const { h, s, l } = hexToHsl(hex);
  const colors: string[] = [];

  switch (type) {
    case 'monochromatic':
      colors.push(hslToHex(h, Math.max(0, s - 20), Math.max(0, l - 20)));
      colors.push(hslToHex(h, Math.max(0, s - 10), Math.max(0, l - 10)));
      colors.push(hslToHex(h, s, l)); // Base
      colors.push(hslToHex(h, Math.min(100, s + 10), Math.min(100, l + 10)));
      colors.push(hslToHex(h, Math.min(100, s + 20), Math.min(100, l + 20)));
      break;

    case 'analogous':
      colors.push(hslToHex((h - 60 + 360) % 360, s, l));
      colors.push(hslToHex((h - 30 + 360) % 360, s, l));
      colors.push(hslToHex(h, s, l)); // Base
      colors.push(hslToHex((h + 30) % 360, s, l));
      colors.push(hslToHex((h + 60) % 360, s, l));
      break;

    case 'triad':
      colors.push(hslToHex((h + 120) % 360, s, 50));
      colors.push(hslToHex((h + 120) % 360, s, l));
      colors.push(hslToHex(h, s, l)); // Base
      colors.push(hslToHex((h + 240) % 360, s, l));
      colors.push(hslToHex((h + 240) % 360, s, 50));
      break;

    case 'split-complementary':
      colors.push(hslToHex((h + 150) % 360, s, l));
      colors.push(hslToHex((h + 180) % 360, s, l));
      colors.push(hslToHex(h, s, l)); // Base
      colors.push(hslToHex((h + 210) % 360, s, l));
      colors.push(hslToHex(h, s, Math.max(0, l - 30))); // 5th variation: darker base
      break;

    case 'tetradic':
      colors.push(hslToHex((h + 90) % 360, s, l));
      colors.push(hslToHex((h + 180) % 360, s, l));
      colors.push(hslToHex(h, s, l)); // Base
      colors.push(hslToHex((h + 270) % 360, s, l));
      colors.push(hslToHex(h, s, Math.max(0, l - 30))); // 5th variation: darker base
      break;
  }

  return colors;
}

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface HSV {
  h: number;
  s: number;
  v: number;
}

export function hslToHsv(h: number, s: number, l: number): HSV {
  s /= 100;
  l /= 100;
  const v = l + s * Math.min(l, 1 - l);
  const s_v = v === 0 ? 0 : 2 * (1 - l / v);
  return { h, s: s_v * 100, v: v * 100 };
}

export function hsvToHsl(h: number, s: number, v: number): HSL {
  s /= 100;
  v /= 100;
  const l = v * (1 - s / 2);
  const s_l = l === 0 || l === 1 ? 0 : (v - l) / Math.min(l, 1 - l);
  return { h, s: s_l * 100, l: l * 100 };
}

export function hexToRgb(hex: string): RGB {
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.substring(1, 3), 16);
    g = parseInt(hex.substring(3, 5), 16);
    b = parseInt(hex.substring(5, 7), 16);
  }
  return { r, g, b };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (x: number) => {
    const hex = Math.round(x).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}
