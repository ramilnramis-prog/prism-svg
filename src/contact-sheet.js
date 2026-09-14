#!/usr/bin/env node
/**
 * Dev-скрипт: собирает контактный лист со всеми стилями.
 * Нужен только для визуальной проверки: node src/contact-sheet.js
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

import { STYLE_NAMES, poster } from './index.js';

const CELL_W = 480;
const CELL_H = 300;
const COLS = 3;
const PAD = 14;

/** Первые 6 — по одному на каждый стиль; дальше — точечные проверки. */
const CELLS = [
  ...STYLE_NAMES.map((style, i) => ({
    style,
    palette: ['aurora', 'sunset', 'candy', 'berry', 'mint', 'ocean'][i],
  })),
  { style: 'bauhaus', palette: 'mint' },
  { style: 'bauhaus', palette: 'neon' },
  { style: 'bauhaus', palette: 'paper' },
  { style: 'flow', palette: 'ocean' },
  { style: 'mesh', palette: 'candy' },
  { style: 'glass', palette: 'sunset' },
];
const ROWS = Math.ceil(CELLS.length / COLS);

const outDir = path.resolve(process.cwd(), 'dev-out');
await mkdir(outDir, { recursive: true });

const cells = [];
for (let i = 0; i < CELLS.length; i += 1) {
  const { style, palette } = CELLS[i];
  const art = poster({ style, palette, seed: `sheet-${style}-${palette}`, width: CELL_W, height: CELL_H });
  const png = await sharp(Buffer.from(art.svg), { density: 144 })
    .resize(CELL_W, CELL_H, { fit: 'fill' })
    .png()
    .toBuffer();
  cells.push({
    input: png,
    left: PAD + (i % COLS) * (CELL_W + PAD),
    top: PAD + Math.floor(i / COLS) * (CELL_H + PAD),
  });
  await writeFile(path.join(outDir, `style-${style}-${palette}.png`), png);
  process.stdout.write(`· ${style}/${palette} -> ${png.length} Б\n`);
}

const sheetW = COLS * CELL_W + (COLS + 1) * PAD;
const sheetH = ROWS * CELL_H + (ROWS + 1) * PAD;

const sheet = await sharp({
  create: { width: sheetW, height: sheetH, channels: 3, background: '#0b0c12' },
})
  .composite(cells)
  .png()
  .toBuffer();

const sheetPath = path.join(outDir, 'contact-sheet.png');
await writeFile(sheetPath, sheet);
process.stdout.write(`Контактный лист: ${sheetPath} (${sheetW}×${sheetH}, ${(sheet.length / 1024).toFixed(0)} КБ)\n`);
