/**
 * Собирает автономную HTML-галерею: SVG встроены как data-URI,
 * поэтому файл открывается двойным кликом без сервера.
 */

import { STYLE_INFO } from './styles.js';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toDataUri(svg) {
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}

function sizeLabel(bytes) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

/**
 * @param {Array} artworks - результаты poster() с полями svg, style, palette, mood, seed, width, height + fileName/bytes
 * @param {object} [meta] - { seed, generatedAt, title }
 * @returns {string} HTML
 */
export function buildGallery(artworks, meta = {}) {
  const title = meta.title ?? 'Prism SVG — галерея';
  const cards = artworks
    .map((art) => {
      const swatches = [art.background, ...art.colors]
        .map((c) => `<i style="background:${escapeHtml(c)}"></i>`)
        .join('');
      return `
    <article class="card">
      <div class="thumb" style="aspect-ratio:${art.width} / ${art.height}">
        <img src="${toDataUri(art.svg)}" alt="${escapeHtml(art.style)} / ${escapeHtml(art.palette)}" loading="lazy">
      </div>
      <div class="meta">
        <h2>${escapeHtml(art.style)}<span>${escapeHtml(STYLE_INFO[art.style] ?? '')}</span></h2>
        <div class="swatches">${swatches}</div>
        <dl>
          <div><dt>палитра</dt><dd>${escapeHtml(art.palette)}</dd></div>
          <div><dt>настроение</dt><dd>${escapeHtml(art.mood ?? '—')}</dd></div>
          <div><dt>размер</dt><dd>${art.width}×${art.height}</dd></div>
          <div><dt>файл</dt><dd><code>${escapeHtml(art.fileName ?? '—')}</code>${art.bytes ? ` · ${sizeLabel(art.bytes)}` : ''}</dd></div>
        </dl>
      </div>
    </article>`;
    })
    .join('');

  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  :root {
    color-scheme: dark;
    --bg: #0a0b10;
    --panel: #14161f;
    --line: #242838;
    --text: #eef1f8;
    --muted: #9aa3b8;
    --accent: #7c5cff;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: clamp(16px, 4vw, 48px);
    background:
      radial-gradient(1100px 600px at 12% -8%, rgba(124,92,255,.22), transparent 60%),
      radial-gradient(900px 500px at 100% 0%, rgba(0,229,255,.14), transparent 55%),
      var(--bg);
    color: var(--text);
    font: 16px/1.55 ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  header { max-width: 1180px; margin: 0 auto clamp(20px, 4vw, 40px); }
  h1 { font-size: clamp(26px, 4vw, 44px); margin: 0 0 8px; letter-spacing: -0.02em; }
  h1 span { background: linear-gradient(92deg, #7c5cff, #00e5ff 45%, #ff5bd1); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .sub { color: var(--muted); margin: 0; }
  .sub code { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 1px 6px; color: #cfd6ea; }
  .grid {
    max-width: 1180px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: clamp(16px, 2vw, 26px);
  }
  .card {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 18px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transition: transform .22s ease, border-color .22s ease, box-shadow .22s ease;
  }
  .card:hover { transform: translateY(-4px); border-color: #3a4060; box-shadow: 0 18px 44px rgba(0,0,0,.45); }
  .thumb { background: #05060a; }
  .thumb img { display: block; width: 100%; height: 100%; object-fit: cover; }
  .meta { padding: 16px 18px 18px; }
  .meta h2 { margin: 0 0 10px; font-size: 19px; display: flex; flex-direction: column; gap: 3px; }
  .meta h2 span { font-size: 12.5px; font-weight: 400; color: var(--muted); }
  .swatches { display: flex; gap: 6px; margin-bottom: 12px; }
  .swatches i { width: 22px; height: 22px; border-radius: 7px; border: 1px solid rgba(255,255,255,.14); }
  dl { margin: 0; display: grid; gap: 5px; font-size: 13.5px; }
  dl div { display: flex; gap: 8px; }
  dt { color: var(--muted); min-width: 96px; }
  dd { margin: 0; }
  dd code { font-size: 12.5px; color: #cfd6ea; }
  footer { max-width: 1180px; margin: clamp(28px, 5vw, 56px) auto 0; color: var(--muted); font-size: 14px; border-top: 1px solid var(--line); padding-top: 18px; }
  footer code { color: #cfd6ea; }
</style>
</head>
<body>
<header>
  <h1>Галерея <span>Prism SVG</span></h1>
  <p class="sub">${artworks.length} постеров · сид <code>${escapeHtml(String(meta.seed ?? '—'))}</code> · собрано ${escapeHtml(meta.generatedAt ?? new Date().toISOString())}<br>
  Тот же сид даёт те же картинки: <code>npm run art -- --seed ${escapeHtml(String(meta.seed ?? 'prism'))}</code></p>
</header>
<main class="grid">${cards}
</main>
<footer>
  Файлы лежат рядом с этой страницей в папке <code>art/</code>. Встраивание в проект: <code>&lt;img src="art/имя.svg"&gt;</code> или инлайн разметкой.
</footer>
</body>
</html>`;
}
