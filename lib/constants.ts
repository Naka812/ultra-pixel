import { BrushShape } from '@/types';

export const DEFAULT_PALETTE = [
  '#000000', '#ffffff', '#7f7f7f', '#c3c3c3', '#880015', '#ed1c24', '#ff7f27', '#fff200',
  '#22b14c', '#00a2e8', '#3f48cc', '#a349a4', '#b97a57', '#ffaec9', '#ffca18', '#efe4b0',
  '#b5e61d', '#99d9ea', '#7092be', '#c8bfe7', '#1a1c2c', '#5d275d', '#b13e53', '#ef7d57',
  '#ffcd75', '#a7f070', '#38b764', '#257179', '#29366f', '#3b5dc9', '#41a6f6', '#73eff7',
  '#f4f4f4', '#94b0c2', '#566c86', '#333c57'
];

export const DEFAULT_BRUSHES: BrushShape[] = [
  {
    id: 'brush-1x1',
    name: '1x1',
    width: 1,
    height: 1,
    pixels: [true]
  },
  {
    id: 'brush-dither-25',
    name: 'Dither 25%',
    width: 2,
    height: 2,
    pixels: [
      true, false,
      false, false
    ]
  },
  {
    id: 'brush-dither-50',
    name: 'Dither 50%',
    width: 2,
    height: 2,
    pixels: [
      true, false,
      false, true
    ]
  },
  {
    id: 'brush-dither-75',
    name: 'Dither 75%',
    width: 2,
    height: 2,
    pixels: [
      true, true,
      false, true
    ]
  },
  {
    id: 'brush-dither-diag-1',
    name: 'Diag Dither 1',
    width: 4,
    height: 4,
    pixels: [
      true, false, false, false,
      false, true, false, false,
      false, false, true, false,
      false, false, false, true
    ]
  },
  {
    id: 'brush-dither-diag-2',
    name: 'Diag Dither 2',
    width: 4,
    height: 4,
    pixels: [
      false, false, false, true,
      false, false, true, false,
      false, true, false, false,
      true, false, false, false
    ]
  },
  {
    id: 'brush-h-lines',
    name: 'H-Lines',
    width: 2,
    height: 2,
    pixels: [
      true, true,
      false, false
    ]
  },
  {
    id: 'brush-v-lines',
    name: 'V-Lines',
    width: 2,
    height: 2,
    pixels: [
      true, false,
      true, false
    ]
  },
  {
    id: 'brush-2x2',
    name: '2x2',
    width: 2,
    height: 2,
    pixels: [true, true, true, true]
  },
  {
    id: 'brush-3x3-circle',
    name: '3x3 Circle',
    width: 3,
    height: 3,
    pixels: [
      false, true, false,
      true, true, true,
      false, true, false
    ]
  },
  {
    id: 'brush-3x3-square',
    name: '3x3 Square',
    width: 3,
    height: 3,
    pixels: [
      true, true, true,
      true, true, true,
      true, true, true
    ]
  },
  {
    id: 'brush-4x4-circle',
    name: '4x4 Circle',
    width: 4,
    height: 4,
    pixels: [
      false, true, true, false,
      true, true, true, true,
      true, true, true, true,
      false, true, true, false
    ]
  }
];
