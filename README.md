# Vietnam Food List · 越南食单

A hand-written checklist of **102 Vietnamese dishes** — north, central and south — plus walking routes, ordering tips and a photo journal. Static HTML/CSS/JS, no framework, no build step. Works offline on a laptop and deploys to GitHub Pages as-is.

**Live:** https://miras-1688.github.io/vietnam-food-list/

![three pages](https://img.shields.io/badge/pages-home%20%2F%20list%20%2F%20upload-2b2b2b) ![no dependencies](https://img.shields.io/badge/dependencies-none-2b2b2b) ![license](https://img.shields.io/badge/license-MIT-2b2b2b)

---

## What's inside

- **102 dishes** across 5 categories (noodles, mains, street food, drinks, sweets), tagged by region — 41 north, 22 central, 24 south, the rest nationwide
- Each entry: Vietnamese name, Chinese name, region, rough price, how to eat it, and where it's from
- **9 walking routes** — Old Quarter, West Lake, a day of Huế small plates, Hội An–Đà Nẵng, Saigon in a day, the courage list
- **Ordering tips** — how to say no coriander (`không rau`), less sugar (`ít đường`), why phở runs out by noon
- **Photo journal** — drop a photo on a card, it gets straightened, white-framed and resized automatically; dishes with a photo are marked as eaten

## Run it locally

The reading part is plain static files — open `index.html` and you're done. Photo upload needs the tiny Node server (no dependencies, Node 18+):

```bash
node server.js
# → http://localhost:8787/
```

On Windows you can also double-click `start.bat`. The launcher prints a LAN address; open that on your phone (same Wi-Fi) and use `/upload.html` to add photos straight from the camera roll. Photos are framed in the browser, so nothing is uploaded to any third party.

## Deploy to GitHub Pages

1. Fork or clone this repo
2. Settings → Pages → Source: `Deploy from a branch`, branch `main`, folder `/`
3. Done. The site is static and needs no backend.

On Pages the upload page won't work — there's no server to write files to. Upload locally, commit, push.

## Adding dishes

Everything lives in `assets/data.js`.

```js
{ id: "bun-bo-hue", vn: "Bún bò Huế", zh: "顺化牛肉粉",
  cat: "noodle", region: "trung", area: "顺化",
  price: "50–80k", rating: 5,
  tip: "圆米粉、牛腱和猪脚，汤里加了香茅和虾酱，比 phở 辣得多。" }
```

- `cat`: `noodle` `rice` `snack` `drink` `sweet` (`mine` for your own finds)
- `region`: `bac` `trung` `nam` `all`
- `id` is what photo filenames attach to (see below)

## Photos

Name the file after the dish id:

```
images/pho-bo.jpg          → the Phở bò card
images/pho-bo__street.jpg  → a second photo of it
```

Multiple photos are fine; the first one is the cover, and `images/covers.json` overrides which one that is. On the upload page, tap a dish with photos to see them all, set a cover, or delete one.

To match the site's look, run:

```bash
powershell -ExecutionPolicy Bypass -File tools/frame-photo.ps1 -In IMG_1234.HEIC -Out images/pho-bo__02.jpg
powershell -ExecutionPolicy Bypass -File tools/make-thumbs.ps1
```

It straightens by EXIF orientation, center-crops into 4:3, adds an even white border, and lifts dark photos a little.

## Layout

```
index.html      home — progress ring, category bars, daily picks
plan.html       the list — filters, cards, drawer, album, routes
upload.html     phone upload page
assets/
  data.js       ← all content lives here
  app.css       design tokens + components
  app.js        state, theme, starfield, search, photo API
  home.js  plan.js  upload.js
images/         your photos (gitignored)
server.js       local static server + photo/cover API, zero deps
tools/          photo framing + thumbnail scripts (PowerShell)
```

Progress, notes and eaten state live in `localStorage` under `hn-food-v2`. There is no account, no analytics, no network calls except Google Fonts.

---

## 中文说明

一份手写的越南吃食清单，**102 样**，按北部 / 中部 / 南部标注，配 9 条走法、点单提示和照片记录。纯静态页面，没有框架、没有构建步骤。

- 本地看：双击 `index.html`
- 本地传图：`node server.js`（或双击 `start.bat`），手机连同一个 Wi-Fi 打开启动器打印的 `/upload.html`
- 改内容：只动 `assets/data.js`
- 部署：推到 GitHub，开 Pages 就行；静态版没有服务端，传图要在本地做

照片不进仓库（见 `.gitignore`），别人用的是清单本身，照片各拍各的。

## License

MIT. Use it, fork it, fix the descriptions if you find them wrong — pull requests welcome.
