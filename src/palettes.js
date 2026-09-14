/**
 * Палитры и цветовая математика.
 *
 * Два источника цвета:
 *  1. Курированные палитры (CURATED) — проверенные вручную сочетания.
 *  2. Генеративные гармонии (HARMONIES) — цвета считаются по цветовому кругу (HSL).
 */

/* ------------------------------------------------------------------ */
/* Конвертация цветов                                                  */
/* ------------------------------------------------------------------ */

/** HSL -> HEX. h в градусах, s/l в долях 0..1. */
export function hslToHex(h, s, l) {
  const hue = ((h % 360) + 360) % 360;
  const sat = clamp01(s);
  const lig = clamp01(l);
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const hp = hue / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const m = lig - c / 2;
  let rgb;
  if (hp < 1) rgb = [c, x, 0];
  else if (hp < 2) rgb = [x, c, 0];
  else if (hp < 3) rgb = [0, c, x];
  else if (hp < 4) rgb = [0, x, c];
  else if (hp < 5) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return (
    '#' +
    rgb
      .map((v) => {
        const n = Math.round((v + m) * 255);
        return Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
      })
      .join('')
  );
}

/** HEX -> {r,g,b} (0..255). Поддерживает #rgb и #rrggbb. */
export function hexToRgb(hex) {
  let h = String(hex).trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) throw new Error(`Некорректный цвет: ${hex}`);
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** HEX -> {h,s,l} (h в градусах, s/l в долях). */
export function hexToHsl(hex) {
  const { r, g, b } = hexToRgb(hex);
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h;
  if (max === rn) h = 60 * (((gn - bn) / d) % 6);
  else if (max === gn) h = 60 * ((bn - rn) / d + 2);
  else h = 60 * ((rn - gn) / d + 4);
  return { h: ((h % 360) + 360) % 360, s, l };
}

/** Осветлить/затемнить цвет на delta (в долях l). */
export function shade(hex, delta) {
  const { h, s, l } = hexToHsl(hex);
  return hslToHex(h, s, l + delta);
}

/** Сдвинуть оттенок на deg градусов, сохранив насыщенность и светлоту. */
export function rotateHue(hex, deg) {
  const { h, s, l } = hexToHsl(hex);
  return hslToHex(h + deg, s, l);
}

/** Подтянуть s/l к заданным значениям (частично, на силу amount). */
export function tune(hex, { s, l } = {}, amount = 1) {
  const cur = hexToHsl(hex);
  return hslToHex(
    cur.h,
    s == null ? cur.s : cur.s + (s - cur.s) * amount,
    l == null ? cur.l : cur.l + (l - cur.l) * amount,
  );
}

/** Относительная яркость (WCAG) — чтобы понять, нужен светлый или тёмный текст. */
export function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const lin = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/** Тёмный или светлый текст поверх цвета. */
export function readableOn(hex) {
  return luminance(hex) > 0.42 ? '#101014' : '#ffffff';
}

/** HEX -> rgba(...) строка с заданной альфой. */
export function alpha(hex, a) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${round(a, 3)})`;
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function round(v, digits) {
  const k = 10 ** digits;
  return Math.round(v * k) / k;
}

/* ------------------------------------------------------------------ */
/* Курированные палитры                                                */
/* ------------------------------------------------------------------ */

export const CURATED = {
  aurora: {
    mood: 'полярное сияние',
    background: '#0b1020',
    colors: ['#00e5ff', '#3ddc97', '#a06bff', '#ff5bd1', '#ffd166'],
  },
  sunset: {
    mood: 'закат над морем',
    background: '#1b0d1f',
    colors: ['#ff6b35', '#ff9f1c', '#ffd166', '#f45b69', '#7b2cbf'],
  },
  candy: {
    mood: 'кислотная карамель',
    background: '#12071c',
    colors: ['#ff2e88', '#ff8ac4', '#7c4dff', '#00d9c0', '#fff35c'],
  },
  mint: {
    mood: 'свежая мята',
    background: '#f2fbf8',
    colors: ['#00997a', '#3ddc97', '#7bdff2', '#2d6a4f', '#a7f3d0'],
  },
  berry: {
    mood: 'ягодный сорбет',
    background: '#150818',
    colors: ['#e0218a', '#8338ec', '#3a86ff', '#ffbe0b', '#fb5607'],
  },
  ember: {
    mood: 'раскалённый металл',
    background: '#120a06',
    colors: ['#ff4d00', '#ff9100', '#ffd000', '#e02f00', '#8a1c00'],
  },
  ocean: {
    mood: 'глубина океана',
    background: '#04121f',
    colors: ['#00b4d8', '#48cae4', '#90e0ef', '#0077b6', '#5eead4'],
  },
  paper: {
    mood: 'бумага и краска',
    background: '#fdf6ec',
    colors: ['#e63946', '#1d3557', '#2a9d8f', '#f4a261', '#111111'],
  },
  neon: {
    mood: 'ночной неон',
    background: '#08080f',
    colors: ['#39ff14', '#ff073a', '#00f0ff', '#f5f500', '#bf00ff'],
  },
  lavender: {
    mood: 'лавандовое поле',
    background: '#f6f2ff',
    colors: ['#7c3aed', '#c084fc', '#f0abfc', '#4c1d95', '#38bdf8'],
  },
};

/* ------------------------------------------------------------------ */
/* Генеративные гармонии                                               */
/* ------------------------------------------------------------------ */

export const HARMONIES = {
  analogous: (base) => [0, 18, -18, 36, -36].map((d) => rotateHue(base, d)),
  complementary: (base) => [0, 12, 180, 192, -14].map((d) => rotateHue(base, d)),
  triadic: (base) => [0, 120, 240, 60, 300].map((d) => rotateHue(base, d)),
  'split-complementary': (base) => [0, 150, 210, 30, 180].map((d) => rotateHue(base, d)),
  tetradic: (base) => [0, 90, 180, 270, 45].map((d) => rotateHue(base, d)),
};

export const PALETTE_NAMES = Object.keys(CURATED);
export const HARMONY_NAMES = Object.keys(HARMONIES);

/**
 * Собирает палитру.
 * @param {string} name - имя из CURATED, имя гармонии или 'random'/'any'
 * @param {object} rng - генератор из createRng
 * @returns {{name:string, mood:string, background:string, colors:string[], generated:boolean}}
 */
export function getPalette(name, rng) {
  const requested = String(name ?? 'random').toLowerCase();

  if (requested === 'random' || requested === 'any' || requested === '') {
    const fromCurated = rng.chance(0.65);
    if (fromCurated) {
      const key = rng.pick(PALETTE_NAMES);
      return { ...CURATED[key], name: key, generated: false };
    }
    const harmony = rng.pick(HARMONY_NAMES);
    return buildGenerated(harmony, rng);
  }

  if (CURATED[requested]) return { ...CURATED[requested], name: requested, generated: false };
  if (HARMONIES[requested]) return buildGenerated(requested, rng);

  const available = [...PALETTE_NAMES, ...HARMONY_NAMES].join(', ');
  throw new Error(`Неизвестная палитра «${name}». Доступно: ${available}, random`);
}

function buildGenerated(harmony, rng) {
  const baseHue = rng.float(0, 360);
  const sat = rng.float(0.6, 0.95);
  const light = rng.float(0.5, 0.68);
  const base = hslToHex(baseHue, sat, light);
  const colors = HARMONIES[harmony](base).map((c, i) =>
    tune(c, { s: sat + (i % 2 ? 0.05 : -0.05), l: light + (i % 3 ? 0.06 : -0.07) }, 0.7),
  );
  const dark = rng.chance(0.5);
  const background = dark
    ? hslToHex(baseHue + 180, rng.float(0.25, 0.5), rng.float(0.05, 0.11))
    : hslToHex(baseHue + 180, rng.float(0.15, 0.35), rng.float(0.93, 0.97));
  return { name: `generated:${harmony}`, mood: harmony, background, colors, generated: true };
}
