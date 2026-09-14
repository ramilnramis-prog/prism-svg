/**
 * Экспорт SVG в PNG через sharp (опциональная зависимость).
 * Если sharp не установлен — вернём понятную ошибку, а не стектрейс.
 */

import { writeFile } from 'node:fs/promises';

let sharpModule;

async function loadSharp() {
  if (sharpModule !== undefined) return sharpModule;
  try {
    const mod = await import('sharp');
    sharpModule = mod.default ?? mod;
  } catch {
    sharpModule = null;
  }
  return sharpModule;
}

export async function hasPngSupport() {
  return (await loadSharp()) !== null;
}

/**
 * Сохраняет SVG-строку как PNG.
 * @param {string} svg
 * @param {string} filePath
 * @param {object} [options]
 * @param {number} [options.scale=1] - множитель плотности (2 = retina)
 * @param {number} [options.width] - явная ширина PNG
 * @param {number} [options.quality=92]
 */
export async function exportPng(svg, filePath, options = {}) {
  const sharp = await loadSharp();
  if (!sharp) {
    throw new Error(
      'PNG-экспорт требует sharp. Установите его: npm install sharp (в папке prism-svg)',
    );
  }
  const { scale = 1, width, quality = 90, palette = true } = options;
  let pipeline = sharp(Buffer.from(svg), { density: Math.max(72, 72 * scale) });
  if (width) pipeline = pipeline.resize({ width });
  // Плоские градиенты отлично сжимаются квантованием: PNG выходит в разы меньше.
  const buf = await pipeline
    .png({
      quality,
      compressionLevel: 9,
      palette,
      colours: palette ? 256 : undefined,
      dither: palette ? 0.6 : undefined,
      effort: 8,
    })
    .toBuffer();
  await writeFile(filePath, buf);
  return buf.length;
}
