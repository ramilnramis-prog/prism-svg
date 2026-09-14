#!/usr/bin/env node
/**
 * CLI генератора.
 *
 *   node src/cli.js --count 8 --style random --palette random --seed demo
 *   node src/cli.js --styles mesh,glass --palettes neon,aurora --size og --png --gallery
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { RATIOS, STYLE_NAMES, PALETTE_NAMES, HARMONY_NAMES, series } from './index.js';
import { STYLE_INFO } from './styles.js';
import { buildGallery } from './gallery.js';
import { exportPng, hasPngSupport } from './export-png.js';

const HELP = `
Prism SVG — генератор красочных процедурных SVG-постеров.

Использование:
  node src/cli.js [опции]

Опции:
  --count <n>        сколько картинок (по умолчанию 6)
  --style <имя>      стиль для всех: ${STYLE_NAMES.join(' | ')} (по умолчанию random)
  --styles <a,b,c>   разные стили по кругу (перебивает --style)
  --palette <имя>    палитра или гармония (по умолчанию random)
  --palettes <a,b>   разные палитры по кругу
  --size <имя|WxH>   ${Object.keys(RATIOS).join(' | ')} | 1600x900 (по умолчанию square)
  --seed <строка>    сид серии (по умолчанию "prism")
  --out <папка>      куда сохранять (по умолчанию ./art)
  --animate          встроить CSS-анимацию в SVG
  --png              дополнительно сохранить PNG (нужен sharp)
  --scale <n>        плотность PNG (2 = retina, по умолчанию 1)
  --png-width <px>   явная ширина PNG (перебивает --scale)
  --gallery          собрать index.html с превью
  --json             вывести манифест в stdout
  --help             эта справка

Стили:
${Object.entries(STYLE_INFO)
  .map(([k, v]) => `  ${k.padEnd(9)} ${v}`)
  .join('\n')}

Палитры:
  ${PALETTE_NAMES.join(', ')}
Гармонии (генерируются на лету):
  ${HARMONY_NAMES.join(', ')}

Примеры:
  node src/cli.js --count 10 --seed launch --gallery
  node src/cli.js --styles mesh,dots --palettes neon,ocean --size og --png --scale 2
`;

function parseArgs(argv) {
  const flags = new Map();
  const bools = new Set(['animate', 'png', 'gallery', 'json', 'help']);
  for (let i = 0; i < argv.length; i += 1) {
    const raw = argv[i];
    if (!raw.startsWith('--')) continue;
    const key = raw.slice(2);
    if (bools.has(key)) {
      flags.set(key, true);
      continue;
    }
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      throw new Error(`Опция --${key} требует значение`);
    }
    flags.set(key, next);
    i += 1;
  }
  return flags;
}

function parseSize(value) {
  if (!value) return { label: 'square', ...RATIOS.square };
  const named = RATIOS[String(value).toLowerCase()];
  if (named) return { label: String(value).toLowerCase(), ...named };
  const m = /^(\d+)x(\d+)$/i.exec(String(value).trim());
  if (!m) {
    throw new Error(`Не понял размер «${value}». Используй имя (${Object.keys(RATIOS).join(', ')}) или формат 1600x900`);
  }
  return { label: `${m[1]}x${m[2]}`, width: Number(m[1]), height: Number(m[2]) };
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24) || 'art';
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.has('help')) {
    process.stdout.write(HELP);
    return;
  }

  const count = Number(flags.get('count') ?? 6);
  if (!Number.isInteger(count) || count < 1 || count > 200) {
    throw new Error('--count должен быть целым числом от 1 до 200');
  }

  const size = parseSize(flags.get('size'));
  const seed = String(flags.get('seed') ?? 'prism');
  const outDir = path.resolve(process.cwd(), String(flags.get('out') ?? 'art'));
  const animate = Boolean(flags.get('animate'));
  const wantPng = Boolean(flags.get('png'));
  const scale = Number(flags.get('scale') ?? 1);
  const pngWidthRaw = flags.get('png-width');
  const pngWidth = pngWidthRaw === undefined ? undefined : Number(pngWidthRaw);
  if (pngWidthRaw !== undefined && (!Number.isFinite(pngWidth) || pngWidth <= 0)) {
    throw new Error('--png-width должен быть положительным числом');
  }
  const styleArg = flags.get('style') ?? 'random';
  const paletteArg = flags.get('palette') ?? 'random';
  const styles = flags.get('styles')?.split(',').map((s) => s.trim()).filter(Boolean);
  const palettes = flags.get('palettes')?.split(',').map((s) => s.trim()).filter(Boolean);

  if (styles) {
    for (const s of styles) {
      if (!STYLE_NAMES.includes(s)) throw new Error(`Неизвестный стиль «${s}». Доступно: ${STYLE_NAMES.join(', ')}`);
    }
  }
  const knownPalettes = [...PALETTE_NAMES, ...HARMONY_NAMES, 'random'];
  for (const p of palettes ?? []) {
    if (!knownPalettes.includes(p)) throw new Error(`Неизвестная палитра «${p}». Доступно: ${knownPalettes.join(', ')}`);
  }

  if (wantPng && !(await hasPngSupport())) {
    process.stderr.write('· sharp не найден — PNG пропущен. Установи: npm install sharp\n');
  }

  const artworks = series({
    count,
    seed,
    width: size.width,
    height: size.height,
    animate,
    style: styleArg,
    palette: paletteArg,
    styles,
    palettes,
    idPrefix: 'prism',
  });

  await mkdir(outDir, { recursive: true });

  const manifest = {
    seed,
    size: { name: size.label, width: size.width, height: size.height },
    animate,
    generatedAt: new Date().toISOString(),
    items: [],
  };

  let totalBytes = 0;
  for (const art of artworks) {
    const base = `${String(art.index + 1).padStart(2, '0')}-${slug(art.style)}-${slug(art.palette)}-${art.seed.toString(36)}`;
    const svgName = `${base}.svg`;
    const bytes = Buffer.byteLength(art.svg, 'utf8');
    await writeFile(path.join(outDir, svgName), art.svg, 'utf8');
    totalBytes += bytes;
    art.fileName = svgName;
    art.bytes = bytes;

    if (wantPng) {
      try {
        const pngName = `${base}.png`;
        const pngBytes = await exportPng(art.svg, path.join(outDir, pngName), {
          scale: Number.isFinite(scale) && scale > 0 ? scale : 1,
          width: pngWidth,
        });
        art.pngName = pngName;
        art.pngBytes = pngBytes;
        totalBytes += pngBytes;
      } catch (err) {
        process.stderr.write(`· PNG для ${svgName} не сделан: ${err.message}\n`);
      }
    }

    manifest.items.push({
      file: svgName,
      png: art.pngName ?? null,
      style: art.style,
      palette: art.palette,
      mood: art.mood,
      seed: art.seed,
      width: art.width,
      height: art.height,
      colors: art.colors,
      background: art.background,
      bytes,
    });
  }

  await writeFile(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  let galleryPath = null;
  if (flags.get('gallery')) {
    galleryPath = path.join(outDir, 'index.html');
    const html = buildGallery(artworks, { seed, title: 'Prism SVG — галерея', generatedAt: manifest.generatedAt });
    await writeFile(galleryPath, html, 'utf8');
  }

  if (flags.get('json')) {
    process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
    return;
  }

  const kb = (totalBytes / 1024).toFixed(1);
  process.stdout.write(
    [
      `Готово: ${artworks.length} шт · ${size.width}×${size.height} · сид «${seed}»`,
      `Папка: ${outDir}`,
      ...artworks.map((a) => `  ${a.fileName.padEnd(42)} ${a.style.padEnd(8)} ${a.palette.padEnd(22)} ${(a.bytes / 1024).toFixed(1)} КБ`),
      `Всего: ${kb} КБ${galleryPath ? ` · галерея: ${path.relative(process.cwd(), galleryPath) || 'index.html'}` : ''}`,
      existsSync(path.join(outDir, 'index.html')) && !flags.get('gallery')
        ? '· index.html уже есть в папке (пересобрать: --gallery)'
        : '',
    ]
      .filter(Boolean)
      .join('\n') + '\n',
  );
}

main().catch((err) => {
  process.stderr.write(`Ошибка: ${err.message}\n`);
  process.exitCode = 1;
});
