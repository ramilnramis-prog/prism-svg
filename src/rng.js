/**
 * Детерминированный генератор случайных чисел.
 * Один и тот же seed всегда даёт одну и ту же картинку.
 */

/** Превращает произвольную строку в 32-битное число (xfnv1a). */
export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  const s = String(str);
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — быстрый PRNG с хорошим распределением. */
export function mulberry32(a) {
  let t = a >>> 0;
  return function next() {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seed) {
  const numeric = typeof seed === 'number' && Number.isFinite(seed) ? seed >>> 0 : hashSeed(seed);
  const next = mulberry32(numeric);

  const rng = () => next();
  /** Вещественное число в [min, max). */
  rng.float = (min, max) => min + next() * (max - min);
  /** Целое в [min, max]. */
  rng.int = (min, max) => Math.floor(min + next() * (max - min + 1));
  /** Случайный элемент массива. */
  rng.pick = (arr) => arr[Math.floor(next() * arr.length)];
  /** true с вероятностью p. */
  rng.chance = (p) => next() < p;
  /** Перемешанная копия массива (Fisher–Yates). */
  rng.shuffle = (arr) => {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  /** n уникальных элементов массива. */
  rng.sample = (arr, n) => rng.shuffle(arr).slice(0, Math.min(n, arr.length));
  /** Нормальное распределение (Box–Muller), по умолчанию mean 0 / sd 1. */
  rng.gaussian = (mean = 0, sd = 1) => {
    let u = 0;
    let v = 0;
    while (u === 0) u = next();
    while (v === 0) v = next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  /** Округление до n знаков — чтобы SVG не пух от длинных дробей. */
  rng.round = (value, digits = 2) => {
    const k = 10 ** digits;
    return Math.round(value * k) / k;
  };
  rng.seed = numeric;
  return rng;
}
