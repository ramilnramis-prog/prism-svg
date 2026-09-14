/** Мелкие помощники для сборки SVG-строк. */

/** Округление до 2 знаков — чтобы файл не пух от длинных дробей. */
export function n(value) {
  const v = Math.round(Number(value) * 100) / 100;
  return Object.is(v, -0) ? 0 : v;
}

/** SVG linearGradient. */
export function linearGradient(id, { x1 = 0, y1 = 0, x2 = 1, y2 = 1, stops }) {
  const body = stops
    .map((s) => `<stop offset="${n(s.offset)}" stop-color="${s.color}"${s.opacity != null ? ` stop-opacity="${n(s.opacity)}"` : ''}/>`)
    .join('');
  return (
    `<linearGradient id="${id}" x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}">` +
    `${body}</linearGradient>`
  );
}

/** SVG radialGradient. */
export function radialGradient(id, { cx = 0.5, cy = 0.5, r = 0.5, stops }) {
  const body = stops
    .map((s) => `<stop offset="${n(s.offset)}" stop-color="${s.color}"${s.opacity != null ? ` stop-opacity="${n(s.opacity)}"` : ''}/>`)
    .join('');
  return (
    `<radialGradient id="${id}" cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}">` +
    `${body}</radialGradient>`
  );
}

/** Мягкое размытие (для blob / mesh-стилей). */
export function blurFilter(id, stdDeviation) {
  return (
    `<filter id="${id}" x="-25%" y="-25%" width="150%" height="150%" color-interpolation-filters="sRGB">` +
    `<feGaussianBlur stdDeviation="${n(stdDeviation)}"/></filter>`
  );
}

/** Свечение: размытая цветная копия под фигурой. */
export function glowFilter(id, stdDeviation = 10) {
  return (
    `<filter id="${id}" x="-45%" y="-45%" width="190%" height="190%" color-interpolation-filters="sRGB">` +
    `<feDropShadow dx="0" dy="0" stdDeviation="${n(stdDeviation)}" flood-color="#000" flood-opacity="0.45"/>` +
    `</filter>`
  );
}

/** Полупрозрачная «плёнка» для стиля glass. */
export function sheen(id, angle = 135) {
  const rad = (angle * Math.PI) / 180;
  const dx = Math.cos(rad) / 2;
  const dy = Math.sin(rad) / 2;
  return linearGradient(id, {
    x1: n(0.5 - dx),
    y1: n(0.5 - dy),
    x2: n(0.5 + dx),
    y2: n(0.5 + dy),
    stops: [
      { offset: 0, color: '#ffffff', opacity: 0.55 },
      { offset: 0.45, color: '#ffffff', opacity: 0.12 },
      { offset: 1, color: '#ffffff', opacity: 0.34 },
    ],
  });
}

export function circle(cx, cy, r, attrs = {}) {
  return `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}"${attrString(attrs)}/>`;
}

export function rect(x, y, w, h, attrs = {}) {
  return `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"${attrString(attrs)}/>`;
}

export function path(d, attrs = {}) {
  return `<path d="${d}"${attrString(attrs)}/>`;
}

export function ellipse(cx, cy, rx, ry, attrs = {}) {
  return `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}"${attrString(attrs)}/>`;
}

export function group(children, attrs = {}) {
  const list = Array.isArray(children) ? children.join('') : children;
  return `<g${attrString(attrs)}>${list}</g>`;
}

/** Включает анимацию только если она разрешена (animate=true). */
export function maybeAnimate(animate, styleBlock, node) {
  return animate && styleBlock ? `${node}${styleBlock}` : node;
}

export function attrString(attrs = {}) {
  return Object.entries(attrs)
    .filter(([, v]) => v !== undefined && v !== null && v !== false)
    .map(([k, v]) => ` ${k}="${typeof v === 'number' ? n(v) : v}"`)
    .join('');
}

/**
 * Скруглённый органический контур вокруг центра.
 * @param {object} opts
 * @param {number} opts.cx
 * @param {number} opts.cy
 * @param {number} opts.radius - базовый радиус
 * @param {number} opts.radiusY - вертикальный радиус (по умолчанию = radius)
 * @param {number} opts.points - сколько опорных точек (8..14 выглядит органично)
 * @param {function} opts.radiusAt - (angleIndex, baseRadius) => radius
 * @param {number} opts.tension - 0..1, насколько выпуклые сегменты
 */
export function organicBlob({ cx, cy, radius, radiusY = radius, points = 10, radiusAt, tension = 0.28 }) {
  const pts = [];
  for (let i = 0; i < points; i += 1) {
    const a = (i / points) * Math.PI * 2;
    const r = radiusAt(i, radius);
    const ry = radiusY === radius ? r : (r / radius) * radiusY;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * ry });
  }
  // Замкнутая Catmull-Rom -> кубические Безье.
  const k = tension * 3;
  let d = `M ${n(pts[0].x)} ${n(pts[0].y)}`;
  for (let i = 0; i < pts.length; i += 1) {
    const p0 = pts[(i - 1 + pts.length) % pts.length];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % pts.length];
    const p3 = pts[(i + 2) % pts.length];
    const c1x = p1.x + ((p2.x - p0.x) / 6) * k;
    const c1y = p1.y + ((p2.y - p0.y) / 6) * k;
    const c2x = p2.x - ((p3.x - p1.x) / 6) * k;
    const c2y = p2.y - ((p3.y - p1.y) / 6) * k;
    d += ` C ${n(c1x)} ${n(c1y)}, ${n(c2x)} ${n(c2y)}, ${n(p2.x)} ${n(p2.y)}`;
  }
  return `${d} Z`;
}

/**
 * Полоса с волнами от yTop до yBottom — строится двумя горизонталями,
 * соединёнными двумя синусоидальными кривыми.
 */
export function waveBand({ width, height, yTop, yBottom, amplitude, phase, steps = 4, reverse = false }) {
  const seg = width / steps;
  const top = [];
  const bottom = [];
  for (let i = 0; i <= steps; i += 1) {
    const x = i * seg;
    const t = i / steps;
    const phaseShift = reverse ? -phase : phase;
    const aTop = amplitude * Math.sin(t * Math.PI * 2 + phaseShift);
    const aBottom = amplitude * 0.55 * Math.sin(t * Math.PI * 2 + phaseShift + 1.1);
    top.push({ x, y: yTop + aTop });
    bottom.push({ x, y: yBottom + aBottom });
  }
  const smooth = (pts) => {
    let d = `L ${n(pts[0].x)} ${n(pts[0].y)}`;
    for (let i = 1; i < pts.length; i += 1) {
      const prev = pts[i - 1];
      const cur = pts[i];
      const cx1 = prev.x + (cur.x - prev.x) * 0.45;
      const cx2 = prev.x + (cur.x - prev.x) * 0.55;
      d += ` C ${n(cx1)} ${n(prev.y)}, ${n(cx2)} ${n(cur.y)}, ${n(cur.x)} ${n(cur.y)}`;
    }
    return d;
  };
  const right = smooth(top);
  const back = smooth(bottom.slice().reverse());
  return `M ${n(top[0].x)} ${n(top[0].y)} ${right} L ${n(width)} ${n(height)} L 0 ${n(height)} ${back} Z`;
}

/** Собирает финальный документ SVG. */
export function buildSvg({ width, height, background, defs = [], body = [], style = '', extraAttrs = {} }) {
  const head =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(width)} ${n(height)}" ` +
    `width="${n(width)}" height="${n(height)}" preserveAspectRatio="xMidYMid slice" ` +
    `role="img"${attrString({ ...extraAttrs, 'aria-label': extraAttrs['aria-label'] })}>`;
  const defsBlock = defs.length ? `<defs>${defs.join('')}</defs>` : '';
  const bg = background ? rect(0, 0, width, height, { fill: background }) : '';
  const styleBlock = style ? `<style>${style}</style>` : '';
  return `${head}${defsBlock}${styleBlock}${bg}${body.join('')}</svg>`;
}
