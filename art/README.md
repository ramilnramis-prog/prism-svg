# Prism SVG — галерея

Превью-страница генератора. Открывается двойным кликом, сервер не нужен:
все SVG встроены в HTML как data-URI.

- `index.html` — общая галерея (все стили и палитры)
- `og/` — набор 1200×630 для соцсетей
- `portrait/` — вертикальный набор 900×1200
- `manifest.json` — список файлов, палитры, сиды, размеры

Как пересобрать:

```bash
npm run art -- --count 12 --seed prism-demo --gallery
npm run art -- --count 6 --size og --out art/og --png --gallery
```

Полная документация — в [README.md](../README.md).
