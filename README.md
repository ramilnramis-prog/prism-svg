# Prism SVG

Генератор красочных процедурных SVG-постеров. Один и тот же `--seed` всегда даёт одни и те же картинки, поэтому набор можно положить в репозиторий проекта и спокойно пересобирать.

```
6 стилей × 10 палитр + 5 цветовых гармоний × любой размер → SVG (и PNG при желании)
```

Никаких внешних сервисов, нейросетей и интернета: только математика и цвет. Единственная зависимость — опциональная (`sharp`, нужна только для PNG).

---

## Быстрый старт

```bash
cd prism-svg

npm run art                 # 6 картинок в ./art + manifest.json
npm run gallery             # 8 картинок с PNG и галереей index.html
npm run check               # самопроверка: 384 комбинации стиль × палитра × формат
```

Посмотреть результат: открой `art/index.html` двойным кликом — это автономная страница с превью (SVG встроены как data-URI, сервер не нужен).

---

## Что получается

```
prism-svg/
├── art/                        ← результат
│   ├── 01-bauhaus-ocean-d417b9.svg
│   ├── 01-bauhaus-ocean-d417b9.png
│   ├── ...
│   ├── manifest.json           ← список файлов, палитры, сиды, размеры
│   ├── index.html              ← галерея-превью (автономная)
│   ├── og/                     ← набор 1200×630 для соцсетей
│   └── portrait/               ← набор 900×1200
└── src/
    ├── cli.js                  ← интерфейс командной строки
    ├── index.js                ← публичное API (poster / series)
    ├── styles.js               ← 6 художественных стилей
    ├── palettes.js             ← палитры и цветовая математика
    ├── svg.js                  ← сборка SVG-примитивов
    ├── export-png.js           ← растеризация через sharp
    ├── gallery.js              ← сборка index.html
    ├── check.js                ← самопроверка
    └── contact-sheet.js        ← dev-скрипт: один PNG со всеми стилями
```

---

## Стили

| Стиль | Что это | Куда годится |
|---|---|---|
| `mesh` | размытые цветовые пятна | hero-секции, фоны, обложки |
| `flow` | слоистые волны и солнце | баннеры, слайды, футеры |
| `blobs` | органические пятна со свечением | карточки, иконки, аватары |
| `bauhaus` | геометрия, сетка, крупные фигуры | постеры, паттерны, мерч |
| `dots` | точечное поле с градиентом | текстуры, разделители |
| `glass` | стеклянные панели и боке | интерфейсные фоны, «стекло» |

Палитры: `aurora`, `sunset`, `candy`, `mint`, `berry`, `ember`, `ocean`, `paper`, `neon`, `lavender`.
Гармонии (цвета считаются по цветовому кругу на лету): `analogous`, `complementary`, `triadic`, `split-complementary`, `tetradic`.
Плюс `random` — случайная палитра или гармония.

---

## CLI

```bash
node src/cli.js [опции]
```

| Опция | Смысл |
|---|---|
| `--count <n>` | сколько картинок (по умолчанию 6) |
| `--style <имя>` | один стиль на всю серию (по умолчанию `random`) |
| `--styles <a,b,c>` | разные стили по кругу |
| `--palette <имя>` | палитра или гармония (по умолчанию `random`) |
| `--palettes <a,b>` | разные палитры по кругу |
| `--size <имя\|WxH>` | `square`, `landscape`, `portrait`, `story`, `og`, `wallpaper` или `1600x900` |
| `--seed <строка>` | сид серии (по умолчанию `prism`) |
| `--out <папка>` | куда сохранять (по умолчанию `./art`) |
| `--animate` | встроить CSS-анимацию внутрь SVG |
| `--png` | дополнительно сохранить PNG (нужен `sharp`) |
| `--scale <n>` | плотность PNG, `2` = retina |
| `--png-width <px>` | явная ширина PNG (перебивает `--scale`) |
| `--gallery` | собрать `index.html` с превью |
| `--json` | вывести манифест в stdout вместо отчёта |

Примеры:

```bash
# 10 постеров для сайта, с галереей
node src/cli.js --count 10 --seed my-site --size landscape --gallery

# только два стиля и две палитры, retina-PNG для соцсетей
node src/cli.js --styles mesh,blobs --palettes neon,aurora --size og --png --scale 2

# анимированные фоны
node src/cli.js --count 4 --styles mesh,flow --animate --out art/live

# встроить в сборку и получить манифест
node src/cli.js --count 20 --seed release-2026 --json > art/manifest.json
```

---

## API в коде проекта

```js
import { writeFileSync } from 'node:fs';
import { poster, series, RATIOS } from './prism-svg/src/index.js';

// одна картинка
const hero = poster({
  style: 'mesh',
  palette: 'neon',
  seed: 'hero-2026',
  width: 1600,
  height: 900,
  animate: true,
});
writeFileSync('public/hero.svg', hero.svg);

// серия: стили и палитры идут по кругу, все разные
const covers = series({ count: 12, seed: 'blog', ...RATIOS.og });
for (const art of covers) {
  writeFileSync(`public/covers/${art.fileName ?? art.seed}.svg`, art.svg);
  console.log(art.style, art.palette, art.mood);
}
```

`poster()` возвращает:

```js
{
  svg,          // готовая разметка
  style,        // 'mesh' | 'flow' | 'blobs' | 'bauhaus' | 'dots' | 'glass'
  palette,      // имя палитры или 'generated:triadic'
  mood,         // человеческое описание: 'полярное сияние', 'закат над морем'
  background,   // hex фона
  colors,       // массив hex — удобно забрать в CSS-переменные
  seed, width, height
}
```

Полезно: `colors` можно сразу превратить в тему интерфейса, чтобы картинка и сайт были в одной гамме.

---

## Как встроить в проект

**1. Просто картинкой** (самый лёгкий путь, SVG масштабируется без потерь):

```html
<img src="/art/01-bauhaus-ocean-d417b9.svg" alt="" width="1200" height="1200">
```

**2. Фоном секции:**

```css
.hero {
  background-image: url('/art/10-mesh-sunset-f1yf62.svg');
  background-size: cover;
  background-position: center;
}
```

**3. Инлайном** — если нужен доступ из CSS страницы:

```html
<!-- вставить содержимое .svg прямо в разметку -->
```

Каждая картинка получает уникальный префикс `id`, поэтому десятки инлайн-SVG на одной странице не конфликтуют. Если вставляешь вручную и хочешь подстраховаться — передай свой префикс: `poster({ idPrefix: 'hero' })`.

**4. Для соцсетей** — сгенерируй PNG 1200×630 и подключи как `og:image` (соцсети не любят SVG):

```bash
node src/cli.js --styles mesh,dots --size og --png --png-width 1200 --out public/og
```

**5. Favicon** — возьми `blobs` или `bauhaus` квадратом 512×512:

```html
<link rel="icon" href="/art/favicon.svg" type="image/svg+xml">
```

---

## Детерминированность и анимация

- Сид — это `hash(seed + '#' + index)`. Одинаковый сид и индекс → байт-в-байт одинаковый SVG. Удобно для ревью в git: пересборка не даёт диффов.
- `--animate` добавляет внутрь SVG CSS-анимацию (`<style>` + `@keyframes`). Она работает и в `<img>`, и в CSS-фоне. Уважай `prefers-reduced-motion`, если страница публичная:

```css
@media (prefers-reduced-motion: reduce) {
  .hero { background-image: url('/art/static-mesh.svg'); }
}
```

- Внешние `<img>`-SVG нельзя перекрасить из CSS страницы. Нужны свои цвета — генерируй другим `palette`/`seed`, либо вставляй SVG инлайном.

---

## PNG-экспорт

Требует `sharp` (уже установлен в этой папке):

```bash
npm install sharp --cache .\.npm-cache   # локальный кэш — обходит ограничения песочницы
```

PNG пишется с квантованием палитры (256 цветов + дизеринг). Реальный вес при 1600×1600: `bauhaus` — ~20 КБ, `flow` — ~110 КБ, `blobs`/`dots` — 220–280 КБ, `mesh`/`glass` — 500 КБ (много размытия, палитра сжимает хуже). Если вес критичен — уменьшай `--png-width` или бери SVG: он в 5–50 раз легче при лучшем качестве.

---

## Самопроверка

```bash
npm run check
```

Проверяет на 384 комбинациях: баланс тегов и кавычек XML, отсутствие `undefined`/`NaN` в разметке, дубли `id`, «ссылки в никуда» в `url(#...)`, наличие `viewBox`, детерминированность и разнообразие палитр. Прогоняй после правок в `styles.js`.

---

## Лицензия

MIT — бери, меняй, встраивай в свои проекты.
