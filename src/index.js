/**
 * Публичное API библиотеки.
 *
 * Пример:
 *   import { writeFileSync } from 'node:fs';
 *   import { poster } from 'prism-svg';
 *   const art = poster({ style: 'mesh', palette: 'neon', seed: 'hero-2026', width: 1600, height: 900 });
 *   writeFileSync('hero.svg', art.svg);
 */

import { createRng, hashSeed } from './rng.js';
import { CURATED, HARMONIES, PALETTE_NAMES, HARMONY_NAMES, getPalette } from './palettes.js';
import { STYLES, STYLE_INFO, STYLE_NAMES, renderArtwork } from './styles.js';

export { STYLE_NAMES, STYLE_INFO, PALETTE_NAMES, HARMONY_NAMES, CURATED, HARMONIES };
export * from './palettes.js';
export { createRng, hashSeed } from './rng.js';

/** Готовые соотношения сторон. */
export const RATIOS = {
  square: { width: 1200, height: 1200 },
  landscape: { width: 1600, height: 900 },
  portrait: { width: 900, height: 1200 },
  story: { width: 1080, height: 1920 },
  og: { width: 1200, height: 630 },
  wallpaper: { width: 1920, height: 1080 },
};

/**
 * Рисует один постер.
 * @param {object} [options]
 * @param {string} [options.style='random'] - mesh|flow|blobs|bauhaus|dots|glass|random
 * @param {string} [options.palette='random'] - имя палитры, имя гармонии или random
 * @param {string|number} [options.seed] - сид; одинаковый сид = одинаковая картинка
 * @param {number} [options.index=0] - смешивается с сидом, чтобы серия была разнообразной
 * @param {number} [options.width=1200]
 * @param {number} [options.height=1200]
 * @param {boolean} [options.animate=false] - добавить CSS-анимацию внутрь SVG
 * @param {string} [options.idPrefix] - префикс id (нужен при инлайне нескольких SVG в одну страницу)
 * @param {string} [options.title] - aria-label
 * @returns {{svg:string, style:string, palette:string, mood:string, seed:number, width:number, height:number, colors:string[], background:string}}
 */
export function poster(options = {}) {
  const {
    style = 'random',
    palette = 'random',
    seed = 'prism',
    index = 0,
    width = 1200,
    height = 1200,
    animate = false,
    idPrefix,
    title,
  } = options;

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('width и height должны быть положительными числами');
  }

  const styleName = String(style).toLowerCase() === 'random' ? undefined : String(style).toLowerCase();
  const stableSeed = hashSeed(`${seed}#${index}`);
  const rng = createRng(stableSeed);

  const resolvedStyle = styleName ?? rng.pick(STYLE_NAMES);
  const resolvedPalette = getPalette(palette, rng);
  const id = `${idPrefix ?? 'p'}${stableSeed.toString(36)}${index}`;

  const svg = renderArtwork(resolvedStyle, {
    rng,
    palette: resolvedPalette,
    width,
    height,
    id,
    animate: Boolean(animate),
    title,
  });

  return {
    svg,
    style: resolvedStyle,
    palette: resolvedPalette.name,
    mood: resolvedPalette.mood,
    background: resolvedPalette.background,
    colors: resolvedPalette.colors,
    seed: stableSeed,
    index,
    width,
    height,
  };
}

/**
 * Рисует серию постеров.
 * @param {object} [options] - те же поля, что у poster(), плюс:
 * @param {number} [options.count=6]
 * @param {string[]} [options.styles] - если задано, стили идут по кругу
 * @param {string[]} [options.palettes] - если задано, палитры идут по кругу
 * @returns {Array} массив результатов poster()
 */
export function series(options = {}) {
  const { count = 6, styles, palettes, style = 'random', palette = 'random', seed = 'prism', ...rest } = options;
  const out = [];

  // Стили: явный список -> как задан; иначе в случайном режиме идём по кругу
  // по детерминированно перемешанному набору. Так серия гарантированно
  // показывает все стили, а не упирается в один удачный.
  let styleList = Array.isArray(styles) && styles.length ? styles : null;
  if (!styleList && String(style).toLowerCase() === 'random') {
    styleList = createRng(hashSeed(`${seed}:style-order`)).shuffle(STYLE_NAMES);
  }

  // Палитры: то же самое — при random берём перемешанный пул курированных палитр.
  let paletteList = Array.isArray(palettes) && palettes.length ? palettes : null;
  if (!paletteList && String(palette).toLowerCase() === 'random') {
    paletteList = createRng(hashSeed(`${seed}:palette-order`)).shuffle(PALETTE_NAMES);
  }

  for (let i = 0; i < count; i += 1) {
    out.push(
      poster({
        ...rest,
        seed,
        style: styleList ? styleList[i % styleList.length] : style,
        palette: paletteList ? paletteList[i % paletteList.length] : palette,
        index: i,
      }),
    );
  }
  return out;
}

/** Имена всех стилей — на случай перебора. */
export const STYLES_MAP = STYLES;
