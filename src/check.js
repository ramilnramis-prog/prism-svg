#!/usr/bin/env node
/**
 * Самопроверка: генерирует все стили × все палитры и валидирует SVG.
 * Запуск: npm run check
 */

import { STYLE_NAMES, PALETTE_NAMES, HARMONY_NAMES, poster } from './index.js';

let failed = 0;
let checked = 0;

function fail(msg) {
  failed += 1;
  process.stderr.write(`  ✗ ${msg}\n`);
}

/** Очень простой XML-парсер: проверяет баланс тегов и корректность кавычек. */
function validateXml(svg) {
  const errors = [];
  if (!svg.startsWith('<svg')) errors.push('нет открывающего <svg');
  if (!svg.endsWith('</svg>')) errors.push('нет закрывающего </svg>');

  const stack = [];
  const tagRe = /<(\/?)([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;
  let m;
  let lastIndex = 0;
  while ((m = tagRe.exec(svg)) !== null) {
    const text = svg.slice(lastIndex, m.index);
    if (text.includes('<')) errors.push(`незакрытый «<» перед <${m[2]}>`);
    lastIndex = tagRe.lastIndex;
    const [, closing, name, attrs, selfClose] = m;
    if (selfClose === '/') continue;
    if (closing === '/') {
      const open = stack.pop();
      if (open !== name) errors.push(`ожидался </${open ?? '?'}>, получен </${name}>`);
    } else {
      stack.push(name);
    }
    // Незакрытые или непарные кавычки в атрибутах.
    const quotes = (attrs.match(/"/g) ?? []).length;
    if (quotes % 2 !== 0) errors.push(`непарные кавычки в <${name}>`);
    if (/undefined|NaN|\[object/.test(attrs)) errors.push(`мусор в атрибутах <${name}>: ${attrs.slice(0, 90)}`);
  }
  if (lastIndex !== svg.length) {
    const tail = svg.slice(lastIndex);
    if (tail.trim() && !tail.includes('</svg>')) errors.push('хвост после разметки не распознан');
  }
  if (stack.length) errors.push(`не закрыты теги: ${stack.join(', ')}`);

  // Дубли id в одном документе.
  const ids = [...svg.matchAll(/\sid="([^"]+)"/g)].map((x) => x[1]);
  const dupes = ids.filter((v, i) => ids.indexOf(v) !== i);
  if (dupes.length) errors.push(`дубли id: ${[...new Set(dupes)].join(', ')}`);

  // Ссылки url(#...) должны существовать.
  const refs = [...svg.matchAll(/url\(#([^)]+)\)/g)].map((x) => x[1]);
  const missing = [...new Set(refs)].filter((r) => !ids.includes(r) && !svg.includes(`.${r}`));
  if (missing.length) errors.push(`ссылки в никуда: ${missing.join(', ')}`);
  if (/url\(#undefined\)|fill="undefined"|NaN/.test(svg)) errors.push('undefined/NaN в разметке');

  return errors;
}

const palettes = [...PALETTE_NAMES, ...HARMONY_NAMES, 'random'];
const sizes = [
  [1200, 1200],
  [1600, 900],
  [900, 1600],
  [1200, 630],
];

console.log(`Проверяю ${STYLE_NAMES.length} стилей × ${palettes.length} палитр × ${sizes.length} форматов...`);
const t0 = Date.now();

for (const style of STYLE_NAMES) {
  for (const palette of palettes) {
    for (const [width, height] of sizes) {
      checked += 1;
      const art = poster({ style, palette, seed: `check-${style}-${palette}`, width, height, animate: checked % 2 === 0 });
      const errors = validateXml(art.svg);
      if (errors.length) {
        fail(`${style}/${palette}/${width}x${height}: ${errors.join('; ')}`);
      }
      if (!art.svg.includes('viewBox="0 0 ')) fail(`${style}/${palette}: нет viewBox`);
      if (art.svg.length < 400) fail(`${style}/${palette}: подозрительно короткий SVG`);
    }
  }
}

// Детерминированность: одинаковый сид => байт-в-байт одинаковый SVG.
const a = poster({ style: 'mesh', palette: 'neon', seed: 'det', index: 3, width: 800, height: 600 }).svg;
const b = poster({ style: 'mesh', palette: 'neon', seed: 'det', index: 3, width: 800, height: 600 }).svg;
if (a !== b) fail('детерминированность нарушена: одинаковый сид дал разный SVG');

// Разные индексы одного сида должны различаться.
const c = poster({ style: 'mesh', palette: 'neon', seed: 'det', index: 4, width: 800, height: 600 }).svg;
if (a === c) fail('разные index дали одинаковый SVG');

// Палитра random не должна падать и должна давать разнообразие.
const seen = new Set();
for (let i = 0; i < 40; i += 1) seen.add(poster({ seed: 'variety', index: i }).palette);
if (seen.size < 8) fail(`палитра random даёт мало разнообразия: ${seen.size}`);

const secs = ((Date.now() - t0) / 1000).toFixed(2);
if (failed) {
  process.stderr.write(`\nПровалено ${failed} проверок из ${checked}. (${secs}s)\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`\n✓ Все ${checked} проверок прошли · детерминированность ок · уникальных палитр ${seen.size} · ${secs}s\n`);
}
