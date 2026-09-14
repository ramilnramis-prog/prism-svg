/**
 * Шесть художественных стилей.
 *
 * Каждый стиль — чистая функция (ctx) => { defs, body, style }.
 * Все id уникальны для картинки (префикс), поэтому SVG можно безопасно
 * инлайнить в HTML десятками штук — они не конфликтуют.
 */

import { alpha, readableOn, tune } from './palettes.js';
import {
  blurFilter,
  buildSvg,
  circle,
  ellipse,
  glowFilter,
  group,
  linearGradient,
  organicBlob,
  path,
  radialGradient,
  rect,
  sheen,
  waveBand,
} from './svg.js';

/* ------------------------------------------------------------------ */
/* 1. MESH — размытые цветовые пятна, как в современных обложках       */
/* ------------------------------------------------------------------ */

function mesh({ rng, palette, width, height, id, animate }) {
  const defs = [];
  const body = [];
  const W = width;
  const H = height;
  const maxR = Math.max(W, H);

  const baseAngle = rng.float(0, Math.PI * 2);
  defs.push(
    linearGradient(`${id}-base`, {
      x1: 0.5 - Math.cos(baseAngle) / 2,
      y1: 0.5 - Math.sin(baseAngle) / 2,
      x2: 0.5 + Math.cos(baseAngle) / 2,
      y2: 0.5 + Math.sin(baseAngle) / 2,
      stops: [
        { offset: 0, color: tune(palette.background, { l: 0.1 }, 0.6) },
        { offset: 0.55, color: palette.background },
        { offset: 1, color: tune(palette.background, { l: -0.04 }, 0.6) },
      ],
    }),
  );
  body.push(rect(0, 0, W, H, { fill: `url(#${id}-base)` }));

  const blobCount = rng.int(5, 8);
  defs.push(blurFilter(`${id}-soft`, maxR * rng.float(0.07, 0.12)));
  const blobs = [];
  for (let i = 0; i < blobCount; i += 1) {
    const color = palette.colors[i % palette.colors.length];
    const cx = rng.float(-0.1, 1.1) * W;
    const cy = rng.float(-0.1, 1.1) * H;
    const r = maxR * rng.float(0.18, 0.36);
    const wobble = Array.from({ length: 9 }, () => rng.float(0.82, 1.2));
    const d = organicBlob({
      cx,
      cy,
      radius: r,
      radiusY: r * rng.float(0.7, 1.25),
      points: 9,
      radiusAt: (idx) => r * wobble[idx],
      tension: rng.float(0.2, 0.42),
    });
    const nodes = [];
    nodes.push(
      path(d, {
        fill: color,
        opacity: rng.float(0.5, 0.85),
        filter: `url(#${id}-soft)`,
      }),
    );
    blobs.push(
      animate
        ? group(nodes, {
            style: `animation: ${id}-drift ${rng.int(14, 26)}s ease-in-out ${rng.int(0, 6)}s infinite alternate`,
          })
        : group(nodes),
    );
  }
  body.push(...blobs);

  // Тонкая вуаль, чтобы пятна не спорили друг с другом.
  body.push(
    rect(0, 0, W, H, {
      fill: `url(#${id}-veil)`,
    }),
  );
  const veilAngle = rng.float(0, 360);
  defs.push(
    linearGradient(`${id}-veil`, {
      x1: 0.5 - Math.cos((veilAngle * Math.PI) / 180) / 2,
      y1: 0.5 - Math.sin((veilAngle * Math.PI) / 180) / 2,
      x2: 0.5 + Math.cos((veilAngle * Math.PI) / 180) / 2,
      y2: 0.5 + Math.sin((veilAngle * Math.PI) / 180) / 2,
      stops: [
        { offset: 0, color: palette.background, opacity: 0.32 },
        { offset: 0.5, color: palette.background, opacity: 0 },
        { offset: 1, color: palette.background, opacity: 0.42 },
      ],
    }),
  );

  const style = animate
    ? `.${id}-x{} @keyframes ${id}-drift { from { transform: translate3d(0,0,0) scale(1); } to { transform: translate3d(${rng.int(-6, 6)}%, ${rng.int(-6, 6)}%, 0) scale(1.08); } }`
    : '';
  return { defs, body, style };
}

/* ------------------------------------------------------------------ */
/* 2. FLOW — слоистые волны                                            */
/* ------------------------------------------------------------------ */

function flow({ rng, palette, width, height, id, animate }) {
  const defs = [];
  const body = [];
  const W = width;
  const H = height;

  const topAngle = rng.float(0, Math.PI * 2);
  defs.push(
    linearGradient(`${id}-sky`, {
      x1: 0.5 - Math.cos(topAngle) / 2,
      y1: 0.5 - Math.sin(topAngle) / 2,
      x2: 0.5 + Math.cos(topAngle) / 2,
      y2: 0.5 + Math.sin(topAngle) / 2,
      stops: [
        { offset: 0, color: tune(palette.background, { l: 0.14 }, 0.7) },
        { offset: 1, color: palette.background },
      ],
    }),
  );
  body.push(rect(0, 0, W, H, { fill: `url(#${id}-sky)` }));

  const layers = rng.int(5, 7);
  const horizon = H * rng.float(0.18, 0.42);
  const step = (H - horizon + H * 0.22) / layers;
  const direction = rng.chance(0.5);
  const colors = rng.shuffle(palette.colors);

  for (let i = 0; i < layers; i += 1) {
    const color = colors[i % colors.length];
    const yTop = horizon + i * step * rng.float(0.8, 1.15);
    const yBottom = yTop + step * rng.float(1.6, 2.6);
    const band = waveBand({
      width: W,
      height: H,
      yTop,
      yBottom,
      amplitude: H * rng.float(0.03, 0.085) * (1 + i * 0.12),
      phase: rng.float(0, Math.PI * 2),
      steps: rng.int(3, 5),
      reverse: i % 2 === 1,
    });
    const depth = i / Math.max(1, layers - 1);
    const node = path(band, {
      fill: `url(#${id}-g${i})`,
      opacity: (1 - depth * 0.32).toFixed(3),
    });
    const c1 = tune(color, { s: Math.min(1, 0.85), l: 0.22 }, 0.75);
    const c2 = tune(color, { s: Math.min(1, 0.95), l: -0.24 }, 0.85);
    const angle = direction ? rng.float(70, 110) : rng.float(-20, 40);
    defs.push(
      linearGradient(`${id}-g${i}`, {
        x1: 0,
        y1: 0,
        x2: Math.cos((angle * Math.PI) / 180),
        y2: Math.sin((angle * Math.PI) / 180),
        stops: [
          { offset: 0, color: c1 },
          { offset: 1, color: c2 },
        ],
      }),
    );
    body.push(
      animate
        ? group(node, {
            style: `animation: ${id}-sway ${rng.int(9, 18)}s ease-in-out ${rng.int(0, 5)}s infinite alternate`,
          })
        : node,
    );
  }

  // Солнце / луна над волнами.
  if (rng.chance(0.75)) {
    const sunColor = palette.colors[rng.int(0, palette.colors.length - 1)];
    const cx = rng.float(0.2, 0.8) * W;
    const cy = horizon * rng.float(0.35, 0.8);
    const r = W * rng.float(0.06, 0.13);
    defs.push(
      radialGradient(`${id}-sun`, {
        cx: 0.5,
        cy: 0.5,
        r: 0.5,
        stops: [
          { offset: 0, color: tune(sunColor, { l: 0.25 }, 0.8) },
          { offset: 0.6, color: sunColor },
          { offset: 1, color: sunColor, opacity: 0 },
        ],
      }),
    );
    body.push(circle(cx, cy, r * 2.4, { fill: `url(#${id}-sun)`, opacity: 0.85 }));
    body.push(circle(cx, cy, r, { fill: tune(sunColor, { l: 0.12 }, 0.7), opacity: 0.95 }));
  }

  const style = animate
    ? `@keyframes ${id}-sway { from { transform: translate3d(0,0,0); } to { transform: translate3d(${rng.int(-3, 3)}%, ${rng.int(-2, 2)}%, 0); } }`
    : '';
  return { defs, body, style };
}

/* ------------------------------------------------------------------ */
/* 3. BLOBS — крупные органические пятна со свечением                  */
/* ------------------------------------------------------------------ */

function blobs({ rng, palette, width, height, id, animate }) {
  const defs = [];
  const body = [];
  const W = width;
  const H = height;
  const maxR = Math.max(W, H);

  const bgAngle = rng.float(0, Math.PI * 2);
  defs.push(
    linearGradient(`${id}-bg`, {
      x1: 0.5 - Math.cos(bgAngle) / 2,
      y1: 0.5 - Math.sin(bgAngle) / 2,
      x2: 0.5 + Math.cos(bgAngle) / 2,
      y2: 0.5 + Math.sin(bgAngle) / 2,
      stops: [
        { offset: 0, color: tune(palette.background, { l: 0.08 }, 0.7) },
        { offset: 1, color: tune(palette.background, { l: -0.03 }, 0.7) },
      ],
    }),
  );
  body.push(rect(0, 0, W, H, { fill: `url(#${id}-bg)` }));

  const count = rng.int(3, 5);
  for (let i = 0; i < count; i += 1) {
    const color = palette.colors[i % palette.colors.length];
    const partner = palette.colors[(i + 2) % palette.colors.length];
    const cx = rng.float(0.18, 0.82) * W;
    const cy = rng.float(0.18, 0.82) * H;
    const r = maxR * rng.float(0.14, 0.3);
    const wobble = Array.from({ length: 11 }, () => rng.float(0.85, 1.18));
    const d = organicBlob({
      cx,
      cy,
      radius: r,
      radiusY: r * rng.float(0.75, 1.3),
      points: 11,
      radiusAt: (idx) => r * wobble[idx],
      tension: rng.float(0.22, 0.4),
    });

    const gradAngle = rng.float(0, 360);
    defs.push(
      linearGradient(`${id}-b${i}`, {
        x1: 0.5 - Math.cos((gradAngle * Math.PI) / 180) / 2,
        y1: 0.5 - Math.sin((gradAngle * Math.PI) / 180) / 2,
        x2: 0.5 + Math.cos((gradAngle * Math.PI) / 180) / 2,
        y2: 0.5 + Math.sin((gradAngle * Math.PI) / 180) / 2,
        stops: [
          { offset: 0, color: tune(color, { l: 0.18 }, 0.8) },
          { offset: 0.55, color },
          { offset: 1, color: partner },
        ],
      }),
    );

    const group_ = [
      path(d, { fill: color, opacity: 0.4, filter: `url(#${id}-glow)` }),
      path(d, { fill: `url(#${id}-b${i})`, opacity: 0.96 }),
    ];
    if (rng.chance(0.7)) {
      group_.push(
        path(d, {
          fill: 'none',
          stroke: '#ffffff',
          'stroke-opacity': rng.float(0.08, 0.22).toFixed(3),
          'stroke-width': rng.float(1, 3).toFixed(2),
        }),
      );
    }
    body.push(
      animate
        ? group(group_, {
            style: `animation: ${id}-breathe ${rng.int(8, 16)}s ease-in-out ${rng.int(0, 4)}s infinite alternate; transform-origin: ${Math.round((cx / W) * 100)}% ${Math.round((cy / H) * 100)}%`,
          })
        : group(group_),
    );
  }

  defs.push(blurFilter(`${id}-glow`, maxR * 0.035));

  // Мелкие искры-сателлиты.
  const sparks = rng.int(6, 16);
  for (let i = 0; i < sparks; i += 1) {
    const color = palette.colors[rng.int(0, palette.colors.length - 1)];
    body.push(
      circle(rng.float(0.05, 0.95) * W, rng.float(0.05, 0.95) * H, rng.float(2, 7), {
        fill: '#ffffff',
        opacity: rng.float(0.15, 0.5).toFixed(2),
      }),
      circle(rng.float(0.05, 0.95) * W, rng.float(0.05, 0.95) * H, rng.float(2, 6), {
        fill: color,
        opacity: rng.float(0.35, 0.8).toFixed(2),
      }),
    );
  }

  const style = animate
    ? `@keyframes ${id}-breathe { from { transform: scale(1) rotate(0deg); } to { transform: scale(1.06) rotate(${rng.int(-4, 4)}deg); } }`
    : '';
  return { defs, body, style };
}

/* ------------------------------------------------------------------ */
/* 4. BAUHAUS — геометрия, постерная композиция                        */
/* ------------------------------------------------------------------ */

function bauhaus({ rng, palette, width, height, id, animate }) {
  const defs = [];
  const body = [];
  const W = width;
  const H = height;
  const accent = palette.colors[rng.int(0, palette.colors.length - 1)];
  const ink = readableOn(palette.background);
  const cols = rng.int(4, 6);
  const cellW = W / cols;
  const cellH = cellW;
  const rows = Math.max(4, Math.ceil(H / cellH));
  const realCellH = H / rows;

  body.push(rect(0, 0, W, H, { fill: palette.background }));

  // Точки-сетка как фактура.
  if (rng.chance(0.7)) {
    const step = Math.min(cellW, realCellH) * 0.5;
    for (let y = step / 2; y < H; y += step) {
      for (let x = step / 2; x < W; x += step) {
        body.push(circle(x, y, Math.max(0.6, step * 0.045), { fill: ink, opacity: 0.1 }));
      }
    }
  }

  const cells = rng.int(7, 11);
  const shapes = [];

  // Небольшой наклон ломает «сеточную» одинаковость композиций.
  const tilt = rng.chance(0.6) ? rng.float(-6, 6) : 0;

  // 1. Несколько крупных цветных плит как основа композиции.
  const blocks = rng.int(2, 4);
  const usedBlocks = new Set();
  for (let i = 0; i < blocks; i += 1) {
    const cw = rng.int(1, Math.max(1, cols - 1));
    const ch = rng.int(1, 3);
    const col = rng.int(0, Math.max(0, cols - cw));
    const row = rng.int(0, Math.max(0, rows - ch));
    const key = `${col}:${row}:${cw}:${ch}`;
    if (usedBlocks.has(key)) continue;
    usedBlocks.add(key);
    shapes.push(
      rect(col * cellW, row * realCellH, cw * cellW, ch * realCellH, {
        fill: palette.colors[(i + 1) % palette.colors.length],
      }),
    );
  }

  // 2. Крупные фигуры: круг, кольцо, полукруг, четверть, линия.
  for (let i = 0; i < cells; i += 1) {
    const col = rng.int(0, cols - 1);
    const row = rng.int(0, rows - 1);
    const x = col * cellW;
    const y = row * realCellH;
    const color = palette.colors[(i + rng.int(0, 2)) % palette.colors.length];
    const base = Math.min(cellW, realCellH);
    const kind = rng.pick(['circle', 'half', 'quarter', 'ring', 'line', 'circle', 'quarter']);

    if (kind === 'circle') {
      shapes.push(
        circle(x + cellW / 2, y + realCellH / 2, base * rng.float(0.38, 0.56), {
          fill: color,
          opacity: rng.chance(0.25) ? 0.92 : 1,
        }),
      );
    } else if (kind === 'ring') {
      shapes.push(
        circle(x + cellW / 2, y + realCellH / 2, base * rng.float(0.34, 0.46), {
          fill: 'none',
          stroke: color,
          'stroke-width': base * rng.float(0.14, 0.26),
        }),
      );
    } else if (kind === 'half') {
      // Полукруг: диаметр пересекает клетку, дуга смотрит в случайную сторону.
      const r = base * rng.float(0.5, 0.62);
      const dir = rng.int(0, 3);
      const cx = x + cellW / 2;
      const cy = y + realCellH / 2;
      let d;
      if (dir === 0) d = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy} Z`;
      else if (dir === 1) d = `M ${cx - r} ${cy} A ${r} ${r} 0 0 0 ${cx + r} ${cy} Z`;
      else if (dir === 2) d = `M ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${cx} ${cy + r} Z`;
      else d = `M ${cx} ${cy - r} A ${r} ${r} 0 0 0 ${cx} ${cy + r} Z`;
      shapes.push(path(d, { fill: color }));
    } else if (kind === 'quarter') {
      // Четверть круга всегда прижата к своему углу клетки.
      const r = base * rng.float(0.72, 0.98);
      const corner = rng.int(0, 3);
      const isLeft = corner % 2 === 0;
      const isTop = corner < 2;
      const cornerX = isLeft ? x : x + cellW;
      const cornerY = isTop ? y : y + realCellH;
      const arcEndX = isLeft ? x + r : x + cellW - r;
      const arcEndY = isTop ? y + r : y + realCellH - r;
      const sweep = (isLeft && isTop) || (!isLeft && !isTop) ? 1 : 0;
      shapes.push(
        path(`M ${cornerX} ${cornerY} L ${arcEndX} ${cornerY} A ${r} ${r} 0 0 ${sweep} ${cornerX} ${arcEndY} Z`, {
          fill: color,
        }),
      );
    } else {
      const horizontal = rng.chance(0.5);
      const thick = base * rng.float(0.14, 0.3);
      shapes.push(
        rect(
          horizontal ? x : x + cellW / 2 - thick / 2,
          horizontal ? y + realCellH / 2 - thick / 2 : y,
          horizontal ? cellW : thick,
          horizontal ? thick : realCellH,
          { fill: color },
        ),
      );
    }
  }

  const tiltAttr = tilt === 0 ? {} : { transform: `rotate(${tilt.toFixed(2)} ${(W / 2).toFixed(1)} ${(H / 2).toFixed(1)})` };
  body.push(
    animate
      ? group(shapes, {
          ...tiltAttr,
          style: `animation: ${id}-slide 12s ease-in-out infinite alternate`,
        })
      : group(shapes, tiltAttr),
  );

  // 3. Финальный акцент поверх композиции.
  if (rng.chance(0.6)) {
    const r = Math.min(W, H) * rng.float(0.1, 0.17);
    body.push(
      circle(rng.float(0.25, 0.75) * W, rng.float(0.25, 0.75) * H, r, {
        fill: accent,
        stroke: ink,
        'stroke-opacity': 0.25,
        'stroke-width': Math.max(1, r * 0.06),
      }),
    );
  }

  // Тонкая рамка-паспарту.
  const m = Math.min(W, H) * 0.04;
  body.push(
    rect(m, m, W - m * 2, H - m * 2, {
      fill: 'none',
      stroke: ink,
      'stroke-opacity': 0.3,
      'stroke-width': Math.max(1, Math.min(W, H) * 0.005),
    }),
  );

  const style = animate
    ? `@keyframes ${id}-slide { from { transform: translate3d(0,0,0); } to { transform: translate3d(${rng.int(-2, 2)}%, ${rng.int(-3, 3)}%, 0); } }`
    : '';
  return { defs, body, style };
}

/* ------------------------------------------------------------------ */
/* 5. DOTS — точечное поле с цветовым градиентом                       */
/* ------------------------------------------------------------------ */

function dots({ rng, palette, width, height, id, animate }) {
  const defs = [];
  const body = [];
  const W = width;
  const H = height;

  const bgAngle = rng.float(0, Math.PI * 2);
  defs.push(
    linearGradient(`${id}-bg`, {
      x1: 0.5 - Math.cos(bgAngle) / 2,
      y1: 0.5 - Math.sin(bgAngle) / 2,
      x2: 0.5 + Math.cos(bgAngle) / 2,
      y2: 0.5 + Math.sin(bgAngle) / 2,
      stops: [
        { offset: 0, color: tune(palette.background, { l: 0.05 }, 0.6) },
        { offset: 1, color: tune(palette.background, { l: -0.03 }, 0.6) },
      ],
    }),
  );
  body.push(rect(0, 0, W, H, { fill: `url(#${id}-bg)` }));

  const cols = rng.int(16, 30);
  const rows = Math.max(4, Math.round((cols * H) / W));
  const cellW = W / cols;
  const cellH = H / rows;
  const fx = rng.float(0.2, 0.8);
  const fy = rng.float(0.25, 0.75);
  const softness = rng.float(0.7, 1.9);
  const maxR = Math.min(cellW, cellH) * rng.float(0.4, 0.52);
  const colorA = palette.colors[rng.int(0, palette.colors.length - 1)];

  // Второй источник цвета для «двухполюсного» градиента.
  const gx = 1 - fx;
  const gy = 1 - fy;
  const colorB = palette.colors[(palette.colors.indexOf(colorA) + 2) % palette.colors.length];

  const dotNodes = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const u = (c + 0.5) / cols;
      const v = (r + 0.5) / rows;
      const dA = Math.hypot(u - fx, v - fy);
      const dB = Math.hypot(u - gx, v - gy);
      const influence = Math.min(1, Math.max(0, 1 - Math.min(dA, dB) * softness));
      const eased = influence ** rng.float(0.75, 1.35);
      const radius = maxR * (0.12 + eased * 0.88);
      if (radius < 0.35) continue;
      const color = dA <= dB ? colorA : colorB;
      const light = tune(color, { s: Math.min(1, 0.9), l: 0.16 + eased * 0.24 }, 0.85);
      dotNodes.push(
        circle(c * cellW + cellW / 2, r * cellH + cellH / 2, radius, {
          fill: eased > 0.5 ? light : color,
          opacity: (0.25 + eased * 0.75).toFixed(3),
        }),
      );
    }
  }

  // Радиальное «дыхание» свечения.
  defs.push(
    radialGradient(`${id}-halo`, {
      cx: fx,
      cy: fy,
      r: 0.55,
      stops: [
        { offset: 0, color: colorA, opacity: 0.6 },
        { offset: 1, color: colorA, opacity: 0 },
      ],
    }),
  );
  body.push(rect(0, 0, W, H, { fill: `url(#${id}-halo)` }));
  body.push(
    animate
      ? group(dotNodes, {
          style: `animation: ${id}-pulse ${rng.int(6, 12)}s ease-in-out infinite alternate; transform-origin: ${Math.round(fx * 100)}% ${Math.round(fy * 100)}%`,
        })
      : group(dotNodes),
  );

  const style = animate
    ? `@keyframes ${id}-pulse { from { transform: scale(1); } to { transform: scale(1.07); } }`
    : '';
  return { defs, body, style };
}

/* ------------------------------------------------------------------ */
/* 6. GLASS — стеклянные слои и мягкий свет                            */
/* ------------------------------------------------------------------ */

function glass({ rng, palette, width, height, id, animate }) {
  const defs = [];
  const body = [];
  const W = width;
  const H = height;
  const maxR = Math.max(W, H);

  const bgAngle = rng.float(0, Math.PI * 2);
  defs.push(
    linearGradient(`${id}-bg`, {
      x1: 0.5 - Math.cos(bgAngle) / 2,
      y1: 0.5 - Math.sin(bgAngle) / 2,
      x2: 0.5 + Math.cos(bgAngle) / 2,
      y2: 0.5 + Math.sin(bgAngle) / 2,
      stops: [
        { offset: 0, color: tune(palette.background, { l: 0.16 }, 0.8) },
        { offset: 1, color: tune(palette.background, { l: -0.04 }, 0.8) },
      ],
    }),
  );
  body.push(rect(0, 0, W, H, { fill: `url(#${id}-bg)` }));

  // Цветные блики на фоне.
  defs.push(blurFilter(`${id}-bokeh`, maxR * 0.05));
  const bokeh = rng.int(4, 7);
  for (let i = 0; i < bokeh; i += 1) {
    const color = palette.colors[rng.int(0, palette.colors.length - 1)];
    body.push(
      circle(rng.float(0, 1) * W, rng.float(0, 1) * H, maxR * rng.float(0.1, 0.28), {
        fill: alpha(color, rng.float(0.5, 0.9)),
        filter: `url(#${id}-bokeh)`,
      }),
    );
  }

  defs.push(glowFilter(`${id}-shadow`, maxR * 0.02));
  const panes = rng.int(3, 5);
  const shapes = [];
  for (let i = 0; i < panes; i += 1) {
    const pw = W * rng.float(0.32, 0.62);
    const ph = H * rng.float(0.2, 0.55);
    const px = rng.float(-0.05, 0.95) * (W - pw * 0.5);
    const py = rng.float(-0.05, 0.95) * (H - ph * 0.5);
    const radius = Math.min(pw, ph) * rng.float(0.12, 0.4);
    const rot = rng.float(-24, 24);
    const color = palette.colors[i % palette.colors.length];
    const paneId = `${id}-pane${i}`;
    const paneAngle = rng.float(0, 360);
    defs.push(
      linearGradient(paneId, {
        x1: 0.5 - Math.cos((paneAngle * Math.PI) / 180) / 2,
        y1: 0.5 - Math.sin((paneAngle * Math.PI) / 180) / 2,
        x2: 0.5 + Math.cos((paneAngle * Math.PI) / 180) / 2,
        y2: 0.5 + Math.sin((paneAngle * Math.PI) / 180) / 2,
        stops: [
          { offset: 0, color: alpha(tune(color, { l: 0.25 }, 0.9), 0.62) },
          { offset: 1, color: alpha(tune(color, { l: -0.1 }, 0.9), 0.34) },
        ],
      }),
    );
    const inner = [
      rect(px, py, pw, ph, {
        rx: radius,
        fill: `url(#${paneId})`,
        stroke: '#ffffff',
        'stroke-opacity': 0.5,
        'stroke-width': Math.max(1, Math.min(W, H) * 0.0025),
        filter: `url(#${id}-shadow)`,
      }),
      // Блик по верхней кромке.
      rect(px + pw * 0.06, py + ph * 0.06, pw * 0.88, ph * 0.2, {
        rx: radius * 0.8,
        fill: '#ffffff',
        opacity: 0.16,
      }),
    ];
    shapes.push(
      animate
        ? group(inner, {
            style: `animation: ${id}-float ${rng.int(9, 17)}s ease-in-out ${rng.int(0, 5)}s infinite alternate; transform: translate(${Math.round(px + pw / 2)}px, ${Math.round(py + ph / 2)}px) rotate(${rot.toFixed(2)}deg) translate(${Math.round(-(px + pw / 2))}px, ${Math.round(-(py + ph / 2))}px)`,
          })
        : group(inner, {
            transform: `rotate(${rot.toFixed(2)} ${(px + pw / 2).toFixed(1)} ${(py + ph / 2).toFixed(1)})`,
          }),
    );
  }
  body.push(...shapes);

  defs.push(sheen(`${id}-sheen`, rng.float(100, 160)));
  body.push(rect(0, 0, W, H, { fill: `url(#${id}-sheen)`, opacity: 0.35 }));

  const style = animate
    ? `@keyframes ${id}-float { from { translate: 0 0; rotate: 0deg; } to { translate: 0 ${rng.int(-14, 14)}px; rotate: ${rng.int(-3, 3)}deg; } }`
    : '';
  return { defs, body, style };
}

/* ------------------------------------------------------------------ */

export const STYLES = {
  mesh,
  flow,
  blobs,
  bauhaus,
  dots,
  glass,
};

export const STYLE_NAMES = Object.keys(STYLES);

/** Описания для CLI и README. */
export const STYLE_INFO = {
  mesh: 'размытые цветовые пятна — обложки, hero-секции',
  flow: 'слоистые волны и закат — фоны, слайды',
  blobs: 'органические пятна со свечением — иконки, карточки',
  bauhaus: 'геометрия и сетка — постеры, паттерны',
  dots: 'точечное поле с градиентом — текстуры, заголовки',
  glass: 'стеклянные панели и боке — интерфейсные фоны',
};

export function renderStyle(styleName, ctx) {
  const fn = STYLES[styleName];
  if (!fn) {
    throw new Error(`Неизвестный стиль «${styleName}». Доступно: ${STYLE_NAMES.join(', ')}`);
  }
  return fn(ctx);
}

/** Полный SVG для одного постера. */
export function renderArtwork(styleName, ctx) {
  const { defs, body, style } = renderStyle(styleName, ctx);
  return buildSvg({
    width: ctx.width,
    height: ctx.height,
    background: null,
    defs,
    body,
    style,
    extraAttrs: { 'aria-label': ctx.title ?? `${styleName} artwork` },
  });
}
