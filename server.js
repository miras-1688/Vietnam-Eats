/* 越南食单 · 本地服务（零依赖，Node 18+）
   启动：node server.js   或双击 start.bat
   端口：8787（被占用会自动提示） */
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { exec } = require("child_process");

const ROOT = __dirname;
const IMG_DIR = path.join(ROOT, "images");
const THUMB_DIR = path.join(IMG_DIR, "thumbs");
const COVERS_FILE = path.join(IMG_DIR, "covers.json");
const DATA_DIR = path.join(ROOT, "data");
const STATE_FILE = path.join(DATA_DIR, "state.json");
const PORT = Number(process.env.PORT || 8787);
const MAX_BODY = 25 * 1024 * 1024;

/* 0.0.0.0 = 同一 Wi-Fi 下的手机也能打开；设 HOST=127.0.0.1 就只给本机。 */
const HOST = process.env.HOST || "0.0.0.0";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8"
};

const IMG_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".bmp"]);

if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR, { recursive: true });

function safeName(n) {
  return String(n || "").replace(/[^A-Za-z0-9._-]/g, "").slice(0, 120);
}

function send(res, code, body, type) {
  res.writeHead(code, {
    "Content-Type": type || "text/plain; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function readCovers() {
  try {
    const o = JSON.parse(fs.readFileSync(COVERS_FILE, "utf8"));
    return (o && typeof o === "object") ? o : {};
  } catch (e) { return {}; }
}
function writeCovers(o) {
  try { fs.writeFileSync(COVERS_FILE, JSON.stringify(o, null, 2), "utf8"); }
  catch (e) { console.error("covers.json 写入失败", e.message); }
}

function listPhotos() {
  const out = {};
  let files = [];
  try { files = fs.readdirSync(IMG_DIR); } catch (e) { return out; }
  files.sort();
  for (const f of files) {
    const ext = path.extname(f).toLowerCase();
    if (!IMG_EXT.has(ext)) continue;
    const stem = path.basename(f, ext);
    const id = stem.includes("__") ? stem.split("__")[0] : stem;
    if (!out[id]) out[id] = [];
    out[id].push("/images/" + encodeURIComponent(f));
  }
  /* 指定的封面排到第一位 */
  const covers = readCovers();
  Object.keys(out).forEach((id) => {
    const c = covers[id];
    if (!c) return;
    const url = "/images/" + encodeURIComponent(c);
    const i = out[id].indexOf(url);
    if (i > 0) { out[id].splice(i, 1); out[id].unshift(url); }
  });
  return out;
}

function serveStatic(req, res, pathname) {
  let p = decodeURIComponent(pathname);
  if (p === "/") p = "/index.html";
  const file = path.join(ROOT, path.normalize(p));
  if (!file.startsWith(ROOT)) return send(res, 403, "no");
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, "404 · 没有这个文件");
    const type = MIME[path.extname(file).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": type,
      "Content-Length": st.size,
      "Cache-Control": "no-store"
    });
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://" + (req.headers.host || "localhost"));
  const p = u.pathname;

  /* 打卡状态落盘：/api/state */
  if (p === "/api/state") {
    if (req.method === "GET") {
      try {
        return send(res, 200, fs.readFileSync(STATE_FILE, "utf8"), MIME[".json"]);
      } catch (e) {
        return send(res, 200, "{}", MIME[".json"]);
      }
    }
    if (req.method === "POST") {
      let size = 0;
      const chunks = [];
      let aborted = false;
      req.on("data", (c) => {
        size += c.length;
        if (size > 5 * 1024 * 1024) { aborted = true; req.destroy(); return; }
        chunks.push(c);
      });
      req.on("end", () => {
        if (aborted) return;
        try {
          if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
          const raw = Buffer.concat(chunks).toString("utf8");
          JSON.parse(raw); // 校验一下，坏数据不写盘
          fs.writeFileSync(STATE_FILE, raw, "utf8");
          send(res, 200, JSON.stringify({ ok: true }), MIME[".json"]);
        } catch (e) {
          send(res, 400, JSON.stringify({ error: "bad json" }), MIME[".json"]);
        }
      });
      req.on("error", () => {});
      return;
    }
    return send(res, 405, "method not allowed");
  }

  /* 设定封面：/api/cover?name=<文件名> */
  if (p === "/api/cover") {
    if (req.method !== "POST") return send(res, 405, "method not allowed");
    const name = safeName(u.searchParams.get("name"));
    const file = path.join(IMG_DIR, name);
    if (!name || !fs.existsSync(file) || !file.startsWith(IMG_DIR)) {
      return send(res, 404, JSON.stringify({ error: "photo not found" }), MIME[".json"]);
    }
    const stem = path.basename(name, path.extname(name));
    const id = stem.includes("__") ? stem.split("__")[0] : stem;
    const covers = readCovers();
    covers[id] = name;
    writeCovers(covers);
    console.log("  封面已换 → " + id + " = " + name);
    return send(res, 200, JSON.stringify({ ok: true, id: id, cover: name }), MIME[".json"]);
  }

  /* 相册 / 缩略图接口 */
  if (p === "/api/photos" || p === "/api/thumbs") {
    const isThumb = p === "/api/thumbs";
    const dir = isThumb ? THUMB_DIR : IMG_DIR;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    if (req.method === "GET") {
      if (isThumb) return send(res, 405, "method not allowed");
      return send(res, 200, JSON.stringify({ photos: listPhotos() }), MIME[".json"]);
    }

    const name = safeName(u.searchParams.get("name"));
    if (!name) return send(res, 400, JSON.stringify({ error: "bad name" }), MIME[".json"]);

    if (req.method === "POST") {
      const ext = path.extname(name).toLowerCase();
      if (!IMG_EXT.has(ext)) return send(res, 400, JSON.stringify({ error: "not an image" }), MIME[".json"]);
      const dest = path.join(dir, name);
      if (!dest.startsWith(dir)) return send(res, 403, "no");

      let size = 0;
      const chunks = [];
      let aborted = false;
      req.on("data", (c) => {
        size += c.length;
        if (size > MAX_BODY) { aborted = true; req.destroy(); return; }
        chunks.push(c);
      });
      req.on("end", () => {
        if (aborted) return;
        try {
          fs.writeFileSync(dest, Buffer.concat(chunks));
          console.log("  已存 → " + (isThumb ? "images/thumbs/" : "images/") + name);
          send(res, 200, JSON.stringify({
            ok: true,
            url: (isThumb ? "/images/thumbs/" : "/images/") + encodeURIComponent(name)
          }), MIME[".json"]);
        } catch (e) {
          send(res, 500, JSON.stringify({ error: "write failed" }), MIME[".json"]);
        }
      });
      req.on("error", () => {});
      return;
    }

    if (req.method === "DELETE") {
      const dest = path.join(dir, name);
      if (!dest.startsWith(dir)) return send(res, 403, "no");
      try {
        fs.unlinkSync(dest);
        if (!isThumb) { try { fs.unlinkSync(path.join(THUMB_DIR, name)); } catch (e) {} }
        send(res, 200, JSON.stringify({ ok: true }), MIME[".json"]);
      } catch (e) {
        send(res, 404, JSON.stringify({ error: "not found" }), MIME[".json"]);
      }
      return;
    }
    return send(res, 405, "method not allowed");
  }

  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "method not allowed");
  serveStatic(req, res, p);
});

server.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.log("端口 " + PORT + " 已经被占了，服务可能已经在跑。");
    console.log("直接打开 http://localhost:" + PORT + "/ 就行。");
    openBrowser();
    setTimeout(() => process.exit(0), 1200);
  } else {
    console.error(e);
    process.exit(1);
  }
});

function lanAddresses() {
  const out = [];
  const nets = os.networkInterfaces();
  Object.keys(nets).forEach((name) => {
    (nets[name] || []).forEach((ni) => {
      if (ni.family === "IPv4" && !ni.internal) out.push(ni.address);
    });
  });
  return out;
}

server.listen(PORT, HOST, () => {
  const lan = lanAddresses();
  console.log("");
  console.log("  越南食单 · 本地服务已启动");
  console.log("");
  console.log("  这台电脑    http://localhost:" + PORT + "/");
  if (HOST === "0.0.0.0" && lan.length) {
    console.log("  手机传图    http://" + lan[0] + ":" + PORT + "/upload.html");
    console.log("  手机看站    http://" + lan[0] + ":" + PORT + "/");
    if (lan.length > 1) {
      console.log("              其它网卡： " + lan.slice(1).join("  "));
    }
  }
  console.log("");
  console.log("  照片放这里：" + IMG_DIR);
  console.log("  关掉这个窗口就停止服务。");
  console.log("");
  openBrowser();
});

function openBrowser() {
  const url = "http://localhost:" + PORT + "/";
  if (process.platform === "win32") {
    exec('start "" "' + url + '"');
  } else if (process.platform === "darwin") {
    exec('open "' + url + '"');
  } else {
    exec('xdg-open "' + url + '"');
  }
}
