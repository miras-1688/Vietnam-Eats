# Ba Miền · 越南食单

**Ba Miền** — 越南语「三地」，指北部、中部、南部。

一份手写的越南吃食清单：**102 样**，按三个地区标注，配 7 条走法、点单提示和一个照片日记。
纯静态页面，没有框架、没有构建步骤、没有后端数据库。

**在线版**：https://miras-1688.github.io/ba-mien/

> Ba Miền means "three regions" in Vietnamese — north, central, south. A hand-written checklist of 102 Vietnamese dishes, with walking routes, ordering tips and a photo journal. Static HTML/CSS/JS — no framework, no build step.

---

## 这是什么

| 层面 | 是什么 |
|---|---|
| 数据 | `assets/data.js` 里 102 条记录，每行一个菜：越南名、中文名、区域、分类、价格、怎么吃 |
| 界面 | 三个静态页：首页（进度总览）、食单（筛选 / 抽屉 / 相册）、传图页 |
| 服务 | **可选**的 60 行 Node 服务，零依赖。没有它照样能打卡、能传图 |
| 状态 | 打卡、笔记、照片都存在浏览器自己的 `localStorage` / `IndexedDB` 里，不上传任何地方 |

## 路人怎么用

不需要注册、不需要装 App、不需要开机：

1. 打开 https://miras-1688.github.io/ba-mien/
2. Safari → 分享 → **添加到主屏幕**
3. 点一道菜 → `＋` → 拍照或从相册挑 → 自动摆正、加白边、缩放，**存进这台手机**
4. 打卡、写笔记，断网也能接着用

照片和进度跟着那台设备走，换手机或清缓存就没了——所以显示「已吃」用的是这台机器自己的记录。

如果你自己在电脑上跑 `node server.js`，传图会直接写进 `images/` 文件夹，和以前一样。

## 内容

- **102 样菜**，五个分类（粉面 / 主菜 / 街头小吃 / 咖啡饮品 / 甜点水果），按区域分：北部 34、中部 19、南部 19，其余全国都有
- 每样都写了：越南语名、中文名、在哪、大概多少钱、怎么吃
- **7 条走法**：老城一条线、西湖一条线、顺化小吃一日、会安岘港一线、西贡一日、学生区、勇气清单
- **点单提示**：不要香菜说 `không rau`、少甜说 `ít đường`、phở 卖完就关门这些
- **照片日记**：把照片丢到卡片上，自动摆正、加白边、缩放；有照片的菜自动算吃过

## 本地运行

只想看：双击 `index.html`。

想在电脑上管理照片（Node 18+，无第三方依赖）：

```bash
node server.js
# → http://localhost:8787/
```

Windows 也可以双击 `start.bat`。启动器会打印一个局域网地址，手机连同一个 Wi-Fi 打开 `/upload.html`，
传的图会写进 `images/`。服务没开的时候，传的图就存在手机浏览器里。

## 部署到 GitHub Pages

1. Fork 或 clone
2. Settings → Pages → Branch 选 `main`，目录 `/`
3. 完成。纯静态，不需要后端，**路人打开就能打卡、能传图**（存在他们自己的设备上）。

## 改内容

全部在 `assets/data.js`：

```js
{ id: "bun-bo-hue", vn: "Bún bò Huế", zh: "顺化牛肉粉",
  cat: "noodle", region: "trung", area: "顺化",
  price: "50–80k", rating: 5,
  tip: "圆米粉、牛腱和猪脚，汤里加了香茅和虾酱，比 phở 辣得多。" }
```

- `cat`：`noodle` `rice` `snack` `drink` `sweet`（`mine` 收自己的发现）
- `region`：`bac` 北部 / `trung` 中部 / `nam` 南部 / `all` 全国
- `id` 决定照片文件名怎么挂（见下）

## 照片

文件名用菜 id 开头：

```
images/pho-bo.jpg          → 挂到 Phở bò
images/pho-bo__street.jpg  → 同一道菜第二张
```

多张时第一张是封面，`images/covers.json` 可以覆盖。传图页里点有照片的菜，能看到全部、换封面、删掉。

想让照片和网站风格一致：

```bash
powershell -ExecutionPolicy Bypass -File tools/frame-photo.ps1 -In IMG_1234.HEIC -Out images/pho-bo__02.jpg
powershell -ExecutionPolicy Bypass -File tools/make-thumbs.ps1
```

按 EXIF 摆正、居中裁进 4:3、加等宽白边、暗图提一点亮，再生成缩略图。

> 仓库里不带照片（见 `.gitignore`）。清单是公共的，照片各拍各的。

## 目录

```
index.html      首页
plan.html       食单
upload.html     手机传图
assets/
  data.js       ← 所有内容都在这里
  app.css       设计令牌 + 组件
  app.js        状态、主题、星野、搜索、照片接口
  home.js  plan.js  upload.js
images/         照片（不进仓库）
server.js       本地服务 + 照片/封面接口，零依赖
tools/          照片摆正、加白边、缩略图（PowerShell）
```

除了 Google Fonts，页面不发起任何外部请求。没有统计、没有账号。

## License

MIT。描述有错就提 PR。

---

## English

A hand-written checklist of **102 Vietnamese dishes** — 34 north, 19 central, 19 south, the rest nationwide — with 7 walking routes, ordering tips and a photo journal. Static HTML/CSS/JS, no framework, no build step, no backend.

**Live:** https://miras-1688.github.io/ba-mien/

### How a stranger uses it

No sign-up, no install, no server:

1. Open the link, then Safari → Share → **Add to Home Screen**
2. Tap a dish → `＋` → shoot or pick a photo → it's straightened, white-framed and resized **on the device**
3. Check dishes off, write notes; works offline

Photos and progress live in that device's browser (`IndexedDB` / `localStorage`). Clearing site data or switching phones starts fresh.

### Run locally

Reading only: open `index.html`.

Photo management on your own machine needs the tiny Node server (Node 18+, zero dependencies):

```bash
node server.js    # → http://localhost:8787/
```

### Deploy

Settings → Pages → branch `main`, folder `/`. That's it — static, and visitors can still check in and add photos, stored on their own device.

### Editing

Everything lives in `assets/data.js`:

```js
{ id: "bun-bo-hue", vn: "Bún bò Huế", zh: "顺化牛肉粉",
  cat: "noodle", region: "trung", area: "顺化",
  price: "50–80k", rating: 5,
  tip: "…" }
```

`cat`: `noodle` `rice` `snack` `drink` `sweet` · `region`: `bac` `trung` `nam` `all`.

### Photos

Name files after the dish id (`images/pho-bo.jpg`, `images/pho-bo__02.jpg`). The first is the cover; `images/covers.json` overrides it. Photos are gitignored — the repo ships the list, not the pictures.

### License

MIT.
