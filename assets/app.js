/* 越南食单 · 公共逻辑：状态、主题、星野、搜索、相册接口 */
window.APP = (function () {
  "use strict";

  var KEY = "hn-food-v2";
  var OLD = "hanoi-food-v1";
  var MEDIA = window.matchMedia("(prefers-color-scheme: dark)");

  /* 云同步：默认用公共 Worker；uid = sha256(密码)，每人一个命名空间 */
  var DEFAULT_API = "https://vietnam-eats-api.saobi203086.workers.dev";
  function getCfg(k) {
    try { return localStorage.getItem(k) || ""; } catch (e) { return ""; }
  }
  var apiBase = (getCfg("hn-api") || DEFAULT_API).replace(/\/+$/, "");
  var uid = getCfg("hn-uid");

  /* 带 ?u=<同步码> 打开就直接登录，登录后把参数从地址栏抹掉 */
  (function () {
    try {
      var m = /(?:^|[?&#])u=([a-f0-9]{16,64})/i.exec(location.search + location.hash);
      if (m) {
        uid = m[1].toLowerCase();
        localStorage.setItem("hn-uid", uid);
        if (history.replaceState) {
          history.replaceState(null, "", location.pathname + location.hash.replace(/[?&#]?u=[a-f0-9]{16,64}/i, ""));
        }
      }
    } catch (e) {}
  })();
  function api(path) { return apiBase + path; }
  function apiHeaders(extra) {
    var h = extra || {};
    if (uid) h["X-User"] = uid;
    return h;
  }
  function hasCloud() { return !!uid; }
  function setApi(base) {
    try { localStorage.setItem("hn-api", (base || DEFAULT_API).replace(/\/+$/, "")); } catch (e) {}
    apiBase = (base || DEFAULT_API).replace(/\/+$/, "");
  }
  /* 把密码变成一串固定长度的 id，密码本身不落盘 */
  function setPassword(pw) {
    var enc = new TextEncoder().encode("vn-eats|" + pw);
    return crypto.subtle.digest("SHA-256", enc).then(function (buf) {
      var hex = Array.prototype.map.call(new Uint8Array(buf), function (b) {
        return ("0" + b.toString(16)).slice(-2);
      }).join("");
      uid = hex.slice(0, 40);
      try { localStorage.setItem("hn-uid", uid); } catch (e) {}
      serverOk = false;
      return uid;
    });
  }
  function signOut() {
    uid = "";
    try { localStorage.removeItem("hn-uid"); } catch (e) {}
    serverOk = false;
  }
  /* 直接粘贴同步码（就是 uid），不需要密码 */
  function setUid(code) {
    var c = String(code || "").trim().toLowerCase();
    if (!/^[a-f0-9]{16,64}$/.test(c)) return Promise.reject(new Error("bad code"));
    uid = c;
    try { localStorage.setItem("hn-uid", c); } catch (e) {}
    serverOk = false;
    return Promise.resolve(c);
  }

  var state = {
    eaten: {},
    uneaten: {},
    notes: {},
    custom: [],
    filter: "all",
    region: "all",
    sort: "default",
    target: "2026-12-15"
  };
  var photos = {};          // id -> [url]
  var photosReady = false;

  /* ── 存储 ── */
  function readStore(k) {
    try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; }
  }
  function load() {
    var o = readStore(KEY);
    if (!o) o = readStore(OLD);
    if (o && typeof o === "object") {
      if (o.eaten && typeof o.eaten === "object") state.eaten = o.eaten;
      if (o.uneaten && typeof o.uneaten === "object") state.uneaten = o.uneaten;
      if (o.notes && typeof o.notes === "object") state.notes = o.notes;
      if (Array.isArray(o.custom)) state.custom = o.custom;
      if (typeof o.filter === "string") state.filter = o.filter;
      if (typeof o.region === "string") state.region = o.region;
      if (typeof o.sort === "string") state.sort = o.sort;
      if (typeof o.target === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.target)) state.target = o.target;
    }
  }
  var t = null;
  function pushState() {
    if (!serverOk) return;
    try {
      fetch(api("/api/state"), {
        method: "POST",
        headers: apiHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(state)
      }).catch(function () {});
    } catch (e) {}
  }
  function save() {
    state.updatedAt = Date.now();
    clearTimeout(t);
    t = setTimeout(function () {
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
      pushState();
    }, 180);
  }
  function saveNow() {
    state.updatedAt = Date.now();
    clearTimeout(t);
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    pushState();
  }

  /* 有服务端时，用磁盘上的 state.json 和浏览器里的对一下，新的赢 */
  function pullState() {
    if (!serverOk) return Promise.resolve();
    return fetch(api("/api/state"), { cache: "no-store", headers: apiHeaders() })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (remote) {
        if (!remote || !remote.eaten) return;
        var lt = state.updatedAt || 0, rt = remote.updatedAt || 0;
        if (rt > lt) {
          state.eaten = remote.eaten || {};
          state.uneaten = remote.uneaten || {};
          state.notes = remote.notes || {};
          state.custom = remote.custom || [];
          if (remote.target) state.target = remote.target;
          state.updatedAt = rt;
          try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
        } else if (lt > rt) {
          pushState();
        }
      })
      .catch(function () {});
  }

  /* ── 数据 ── */
  function allItems() { return window.HN.ITEMS.concat(state.custom); }
  function byId(id) {
    var a = allItems();
    for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i];
    return null;
  }
  function catName(k) {
    var c = window.HN.CATS;
    for (var i = 0; i < c.length; i++) if (c[i].k === k) return c[i].n;
    return "我的发现";
  }
  /* 已吃判定：手动勾过就听手动的；没动过的，有照片就算吃过 */
  function isEaten(id) {
    if (state.eaten[id]) return true;
    if (state.uneaten[id]) return false;
    return !!photoOf(id);
  }
  function setEaten(id, on) {
    if (on) {
      delete state.uneaten[id];
      state.eaten[id] = Date.now();
    } else {
      delete state.eaten[id];
      state.uneaten[id] = true;
    }
  }
  function doneCount() {
    var n = 0, a = allItems();
    for (var i = 0; i < a.length; i++) if (isEaten(a[i].id)) n++;
    return n;
  }

  /* 侧栏进度轴：填充和游标一起走 */
  function setAxis(done, total) {
    var pct = total ? (done / total * 100) : 0;
    var s = pct.toFixed(1) + "%";
    var fill = document.getElementById("axisFill");
    var dot = document.getElementById("axisDot");
    var dn = document.getElementById("axisDone");
    var tt = document.getElementById("axisTotal");
    if (fill) fill.style.width = s;
    if (dot) dot.style.left = s;
    if (dn) dn.textContent = done;
    if (tt) tt.textContent = "共 " + total + " 样";
  }

  /* ── 主题 ── */
  function applyTheme(mode) {
    document.documentElement.setAttribute("data-theme", mode);
    var b = document.getElementById("themeBtn");
    if (b) b.setAttribute("aria-label", mode === "dark" ? "切换到浅色" : "切换到深色");
    if (b) b.dataset.mode = mode;
  }
  function initTheme() {
    var saved = null;
    try { saved = localStorage.getItem("hn-theme"); } catch (e) {}
    applyTheme(saved || (MEDIA.matches ? "dark" : "light"));
    if (MEDIA.addEventListener) {
      MEDIA.addEventListener("change", function (e) {
        var s = null;
        try { s = localStorage.getItem("hn-theme"); } catch (err) {}
        if (!s) applyTheme(e.matches ? "dark" : "light");
      });
    }
    var btn = document.getElementById("themeBtn");
    if (btn) btn.addEventListener("click", function () {
      var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(next);
      try { localStorage.setItem("hn-theme", next); } catch (e) {}
    });
  }

  /* ── 星野 ── */
  function initSky() {
    var cv = document.getElementById("sky");
    if (!cv || !cv.getContext) return;
    var ctx = cv.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var stars = [], w = 0, h = 0, raf = null;
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function resize() {
      w = cv.clientWidth; h = cv.clientHeight;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.round(Math.min(170, (w * h) / 11000));
      stars = [];
      for (var i = 0; i < n; i++) {
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: Math.random() * 1.3 + 0.25,
          a: Math.random() * 0.55 + 0.15,
          vx: (Math.random() - 0.5) * 0.045,
          vy: (Math.random() - 0.5) * 0.045,
          tw: Math.random() * Math.PI * 2
        });
      }
      draw();
    }

    function isDark() { return document.documentElement.getAttribute("data-theme") !== "light"; }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      var dark = isDark();
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        var alpha = s.a * (dark ? 1 : 0.55);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = dark
          ? "rgba(255,248,230," + alpha + ")"
          : "rgba(26,23,18," + alpha * 0.5 + ")";
        ctx.fill();
      }
    }

    function loop() {
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        s.x += s.vx; s.y += s.vy; s.tw += 0.006;
        if (s.x < -5) s.x = w + 5; if (s.x > w + 5) s.x = -5;
        if (s.y < -5) s.y = h + 5; if (s.y > h + 5) s.y = -5;
      }
      draw();
      raf = requestAnimationFrame(loop);
    }

    resize();
    window.addEventListener("resize", resize);
    if (!reduce) {
      raf = requestAnimationFrame(loop);
      document.addEventListener("visibilitychange", function () {
        if (document.hidden) { cancelAnimationFrame(raf); raf = null; }
        else if (!raf) raf = requestAnimationFrame(loop);
      });
    }
    document.getElementById("themeBtn") && document.getElementById("themeBtn")
      .addEventListener("click", function () { setTimeout(draw, 30); });
  }

  /* ── 提示 ── */
  var toastEl = null, toastT = null;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "toast";
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove("show"); }, 2200);
  }

  /* ── 灯箱 ── */
  function openLightbox(src, alt) {
    var lb = document.getElementById("lightbox");
    if (!lb) {
      lb = document.createElement("div");
      lb.id = "lightbox";
      lb.className = "lightbox";
      lb.innerHTML = '<button class="lb-x" aria-label="关闭">×</button><img alt="">';
      document.body.appendChild(lb);
      lb.addEventListener("click", function (e) {
        if (e.target === lb || e.target.classList.contains("lb-x")) closeLightbox();
      });
    }
    lb.querySelector("img").src = src;
    lb.querySelector("img").alt = alt || "";
    lb.classList.add("open");
  }
  function closeLightbox() {
    var lb = document.getElementById("lightbox");
    if (lb) lb.classList.remove("open");
  }

  /* ── 相册接口 ── */
  /* ── 照片：本地优先（IndexedDB），有服务端时也读服务端 ── */
  var DB_NAME = "vnfood", DB_VER = 1, dbP = null;
  var urlCache = {};   // key -> {url, thumbUrl}
  var thumbMap = {};   // url -> thumbUrl
  var entries = {};    // id -> [{url, thumb, source, key, name, ts}]
  var serverOk = false; // 上次探测：本地服务在不在

  function openDB() {
    if (dbP) return dbP;
    dbP = new Promise(function (resolve) {
      if (!window.indexedDB) return resolve(null);
      var req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains("photos")) {
          var s = db.createObjectStore("photos", { keyPath: "key" });
          s.createIndex("id", "id", { unique: false });
        }
        if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta", { keyPath: "k" });
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { resolve(null); };
    });
    return dbP;
  }
  function dbAll(store) {
    return openDB().then(function (db) {
      if (!db) return [];
      return new Promise(function (resolve) {
        try {
          var r = db.transaction(store, "readonly").objectStore(store).getAll();
          r.onsuccess = function () { resolve(r.result || []); };
          r.onerror = function () { resolve([]); };
        } catch (e) { resolve([]); }
      });
    });
  }
  function dbPut(store, rec) {
    return openDB().then(function (db) {
      if (!db) return false;
      return new Promise(function (resolve) {
        try {
          var r = db.transaction(store, "readwrite").objectStore(store).put(rec);
          r.onsuccess = function () { resolve(true); };
          r.onerror = function () { resolve(false); };
        } catch (e) { resolve(false); }
      });
    });
  }
  function dbDel(store, key) {
    return openDB().then(function (db) {
      if (!db) return false;
      return new Promise(function (resolve) {
        try {
          var r = db.transaction(store, "readwrite").objectStore(store).delete(key);
          r.onsuccess = function () { resolve(true); };
          r.onerror = function () { resolve(false); };
        } catch (e) { resolve(false); }
      });
    });
  }

  /* 浏览器存储不可靠时也别把页面卡死 */
  function withTimeout(p, ms, fallback) {
    return new Promise(function (resolve) {
      var done = false;
      var t = setTimeout(function () { if (!done) { done = true; resolve(fallback); } }, ms);
      p.then(function (v) { if (!done) { done = true; clearTimeout(t); resolve(v); } },
             function () { if (!done) { done = true; clearTimeout(t); resolve(fallback); } });
    });
  }

  function loadLocal() {
    return Promise.all([
      withTimeout(dbAll("photos"), 1800, []),
      withTimeout(dbAll("meta"), 1800, [])
    ]).then(function (r) {
      var recs = r[0], metas = r[1], covers = {};
      metas.forEach(function (m) {
        if (m && typeof m.k === "string" && m.k.indexOf("cover:") === 0) covers[m.k.slice(6)] = m.v;
      });
      var byId = {};
      recs.forEach(function (rec) {
        if (!rec || !rec.blob) return;
        if (!byId[rec.id]) byId[rec.id] = [];
        byId[rec.id].push(rec);
      });
      var out = {};
      Object.keys(byId).forEach(function (id) {
        var list = byId[id].slice().sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); });
        var cv = covers[id];
        if (cv) {
          for (var k = 0; k < list.length; k++) {
            if (list[k].key === cv && k > 0) { list.unshift(list.splice(k, 1)[0]); break; }
          }
        }
        out[id] = list.map(function (rec) {
          var c = urlCache[rec.key];
          if (!c) {
            var t = null;
            try { t = rec.thumb ? URL.createObjectURL(rec.thumb) : null; } catch (e) {}
            c = { url: URL.createObjectURL(rec.blob), thumbUrl: t };
            urlCache[rec.key] = c;
          }
          return {
            url: c.url, thumb: c.thumbUrl || c.url,
            source: "local", key: rec.key, name: rec.key, ts: rec.ts
          };
        });
      });
      return out;
    });
  }

  function loadServer() {
    if (!hasCloud()) { serverOk = false; return Promise.resolve({}); }
    return fetch(api("/api/photos"), { cache: "no-store", headers: apiHeaders() })
      .then(function (r) {
        serverOk = r.ok;
        return r.ok ? r.json() : null;
      })
      .then(function (j) {
        var out = {};
        if (!j || !j.photos) return out;
        Object.keys(j.photos).forEach(function (id) {
          out[id] = (j.photos[id] || []).map(function (u) {
            var name = u.split("/").pop();
            try { name = decodeURIComponent(name); } catch (e) {}
            return {
              url: u, thumb: u.replace("/images/", "/images/thumbs/"),
              source: "server", name: name
            };
          });
        });
        return out;
      })
      .catch(function () { serverOk = false; return {}; });
  }

  function loadPhotos() {
    return Promise.all([loadServer(), loadLocal()]).then(function (r) {
      var server = r[0], local = r[1];
      entries = {};
      photos = {};
      thumbMap = {};
      Object.keys(server).forEach(function (id) { entries[id] = server[id].slice(); });
      Object.keys(local).forEach(function (id) {
        entries[id] = (entries[id] || []).concat(local[id]);
      });
      Object.keys(entries).forEach(function (id) {
        photos[id] = entries[id].map(function (e) {
          thumbMap[e.url] = e.thumb;
          return e.url;
        });
      });
      photosReady = true;
      return photos;
    });
  }

  function photoOf(id) {
    var a = entries[id];
    return (a && a.length) ? a[0].url : null;
  }
  function photoEntries(id) { return entries[id] || []; }

  /* 卡片和相册走缩略图，抽屉和灯箱才加载原图 */
  function thumb(url) {
    if (!url) return url;
    return thumbMap[url] || url.replace("/images/", "/images/thumbs/");
  }

  function postBlob(url, blob) {
    var ctrl = null, timer = null;
    var opts = {
      method: "POST",
      headers: apiHeaders({ "Content-Type": "image/jpeg" }),
      body: blob
    };
    if (window.AbortController) {
      ctrl = new AbortController();
      opts.signal = ctrl.signal;
      timer = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, 8000);
    }
    return fetch(url, opts).then(function (r) {
      clearTimeout(timer);
      return r.ok;
    }).catch(function () {
      clearTimeout(timer);
      return false;
    });
  }

  function saveLocal(id, big, small) {
    var name = id + "__" + Date.now().toString(36) + ".jpg";
    return withTimeout(dbPut("photos", { key: name, id: id, ts: Date.now(), blob: big, thumb: small }), 3000, false)
      .then(function (ok) {
        if (!ok) throw new Error("storage");
        return { where: "local", name: name };
      });
  }

  /* 图片加工：等比裁切填满 + 白边，出大图和缩略图 */
  function frameCanvas(img, W, H, M) {
    var c = document.createElement("canvas");
    c.width = W; c.height = H;
    var g = c.getContext("2d");
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, W, H);
    var aw = W - 2 * M, ah = H - 2 * M;
    var s = Math.max(aw / img.width, ah / img.height);
    var dw = img.width * s, dh = img.height * s;
    g.save();
    g.beginPath(); g.rect(M, M, aw, ah); g.clip();
    g.drawImage(img, M + (aw - dw) / 2, M + (ah - dh) / 2, dw, dh);
    g.restore();
    return c;
  }
  function toBlobP(canvas, q) {
    return new Promise(function (r) { canvas.toBlob(r, "image/jpeg", q); });
  }
  function processImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        try {
          var big = frameCanvas(img, 1600, 1200, 72);
          var small = frameCanvas(img, 480, 360, 22);
          Promise.all([toBlobP(big, 0.85), toBlobP(small, 0.82)])
            .then(function (b) {
              if (!b[0] || !b[1]) return reject(new Error("转换失败"));
              resolve({ big: b[0], small: b[1] });
            })
            .catch(reject);
        } catch (e) { reject(e); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("这张图读不了")); };
      img.src = url;
    });
  }

  /* 有服务端就写进 images/，没有就存进这台设备的浏览器 */
  function addPhoto(id, big, small) {
    if (!serverOk) return saveLocal(id, big, small);
    var name = id + "__" + Date.now().toString(36) + ".jpg";
    return postBlob(api("/api/photos?name=" + encodeURIComponent(name)), big).then(function (ok) {
      if (!ok) return saveLocal(id, big, small);
      return postBlob(api("/api/thumbs?name=" + encodeURIComponent(name)), small)
        .catch(function () {})
        .then(function () { return { where: "server", name: name }; });
    });
  }

  function deleteByUrl(url) {
    var hit = null;
    Object.keys(entries).forEach(function (id) {
      entries[id].forEach(function (e) { if (e.url === url) hit = { id: id, e: e }; });
    });
    if (!hit) return Promise.resolve(false);
    var e = hit.e;
    if (e.source === "server") {
      return fetch(api("/api/photos?name=" + encodeURIComponent(e.name)), { method: "DELETE", headers: apiHeaders() })
        .then(function (r) { return r.ok; }).catch(function () { return false; });
    }
    return withTimeout(dbDel("photos", e.key), 3000, false).then(function (ok) {
      var c = urlCache[e.key];
      if (c) {
        try { URL.revokeObjectURL(c.url); } catch (err) {}
        if (c.thumbUrl) { try { URL.revokeObjectURL(c.thumbUrl); } catch (err) {} }
        delete urlCache[e.key];
      }
      return ok;
    });
  }

  function coverByUrl(id, url) {
    var e = (entries[id] || []).filter(function (x) { return x.url === url; })[0];
    if (!e) return Promise.resolve(false);
    if (e.source === "server") {
      return fetch(api("/api/cover?name=" + encodeURIComponent(e.name)), { method: "POST", headers: apiHeaders() })
        .then(function (r) { return r.ok; }).catch(function () { return false; });
    }
    return withTimeout(dbPut("meta", { k: "cover:" + id, v: e.key }), 3000, false);
  }

  function allPhotos() {
    var out = [];
    Object.keys(entries).forEach(function (id) {
      entries[id].forEach(function (e) { out.push({ id: id, url: e.url }); });
    });
    return out;
  }

  /* ── 搜索 ── */
  function searchItems(q) {
    q = (q || "").trim().toLowerCase();
    if (!q) return [];
    var norm = function (s) {
      return (s || "").toLowerCase()
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/đ/g, "d");
    };
    var nq = norm(q);
    return allItems().filter(function (it) {
      return norm(it.vn).indexOf(nq) > -1
        || norm(it.zh).indexOf(nq) > -1
        || norm(it.area).indexOf(nq) > -1
        || norm(it.vn).replace(/\s+/g, "").indexOf(nq.replace(/\s+/g, "")) > -1;
    }).slice(0, 7);
  }

  function mountSearch(input, opts) {
    opts = opts || {};
    var box = document.createElement("div");
    box.className = "suggest hidden";
    input.parentNode.appendChild(box);
    var active = -1, results = [];

    function render(list) {
      results = list;
      active = -1;
      box.textContent = "";
      if (!list.length) {
        var e = document.createElement("div");
        e.className = "empty";
        e.textContent = "没找到。换个词试试，或直接翻食单。";
        box.appendChild(e);
      } else {
        list.forEach(function (it, i) {
          var b = document.createElement("button");
          b.type = "button";
          b.dataset.i = i;
          var v = document.createElement("span"); v.className = "sv"; v.textContent = it.vn;
          var z = document.createElement("span"); z.className = "sz"; z.textContent = it.zh;
          b.appendChild(v); b.appendChild(z);
          b.addEventListener("click", function () { pick(it); });
          box.appendChild(b);
        });
      }
      box.classList.remove("hidden");
    }
    function hide() { box.classList.add("hidden"); active = -1; }
    function pick(it) {
      hide(); input.value = "";
      if (opts.onPick) opts.onPick(it);
    }
    function move(d) {
      if (!results.length) return;
      active = (active + d + results.length) % results.length;
      Array.prototype.forEach.call(box.children, function (c, i) {
        if (c.dataset) c.setAttribute("aria-selected", i === active ? "true" : "false");
      });
    }
    input.addEventListener("input", function () {
      var q = input.value.trim();
      if (!q) { hide(); return; }
      render(searchItems(q));
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
      else if (e.key === "Enter") {
        e.preventDefault();
        if (active > -1 && results[active]) pick(results[active]);
        else if (results.length) pick(results[0]);
      } else if (e.key === "Escape") { hide(); input.blur(); }
    });
    document.addEventListener("click", function (e) {
      if (!box.contains(e.target) && e.target !== input) hide();
    });
    return { hide: hide };
  }

  /* ── 杂项 ── */
  function daysLeft() {
    var d = new Date(state.target + "T00:00:00");
    if (isNaN(d.getTime())) return null;
    var n = new Date(); n.setHours(0, 0, 0, 0);
    return Math.round((d - n) / 86400000);
  }
  function ago(ts) {
    var s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return "刚刚";
    if (s < 3600) return Math.floor(s / 60) + " 分钟前";
    if (s < 86400) return Math.floor(s / 3600) + " 小时前";
    var d = Math.floor(s / 86400);
    return d === 1 ? "昨天" : d + " 天前";
  }
  function safeName(s) { return (s || "").replace(/[<>&"]/g, ""); }

  /* ── 登录入口：顶栏下方一条通栏 + 密码弹窗 ── */
  function mountAuth() {
    var bar = document.querySelector(".topbar");
    if (!bar) return;

    var strip = document.createElement("div");
    strip.className = "authbar" + (uid ? " on" : "");
    strip.innerHTML =
      '<span class="msg"></span>' +
      '<button type="button" class="act"></button>';
    bar.parentNode.insertBefore(strip, bar.nextSibling);

    var msg = strip.querySelector(".msg");
    var act = strip.querySelector(".act");

    function paint() {
      if (uid) {
        strip.classList.add("on");
        msg.textContent = "已登录 · 同步码 " + uid.slice(0, 8) + "…";
        act.textContent = "退出";
      } else {
        strip.classList.remove("on");
        msg.textContent = "还没登录，现在只存在这台设备";
        act.textContent = "登录同步";
      }
    }
    paint();

    var wrap = document.createElement("div");
    wrap.className = "authwrap";
    wrap.innerHTML =
      '<div class="authbox">' +
      '<button class="x" type="button" aria-label="关闭">×</button>' +
      '<h2>进入你的食单</h2>' +
      '<p>输入你设过的密码，回到自己的照片和打卡。<br>没设过就现在设一个，别人看不到你的内容。</p>' +
      '<input type="password" id="authPw" placeholder="密码（至少 4 位）" autocomplete="current-password">' +
      '<button class="go" type="button">进入</button>' +
      '<p class="err"></p>' +
      '</div>';
    document.body.appendChild(wrap);

    var input = wrap.querySelector("#authPw");
    var err = wrap.querySelector(".err");

    function open() {
      wrap.classList.add("open");
      setTimeout(function () { input.focus(); }, 50);
    }
    function close() {
      wrap.classList.remove("open");
      err.textContent = "";
      input.value = "";
    }
    function submit() {
      var pw = input.value.trim();
      if (pw.length < 4) { err.textContent = "至少 4 位"; return; }
      if (!window.crypto || !crypto.subtle) { err.textContent = "这个浏览器不支持加密"; return; }
      err.textContent = "正在进入…";
      setPassword(pw).then(function () { location.reload(); })
        .catch(function (e) { err.textContent = "失败：" + (e && e.message); });
    }

    act.addEventListener("click", function () {
      if (uid) { signOut(); location.reload(); }
      else open();
    });
    wrap.querySelector(".x").addEventListener("click", close);
    wrap.querySelector(".go").addEventListener("click", submit);
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });
    wrap.addEventListener("click", function (e) { if (e.target === wrap) close(); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountAuth);
  } else {
    mountAuth();
  }

  return {
    get state() { return state; },
    allItems: allItems, byId: byId, catName: catName, doneCount: doneCount,
    isEaten: isEaten, setEaten: setEaten, setAxis: setAxis,
    load: load, save: save, saveNow: saveNow, pullState: pullState,
    setApi: setApi, setPassword: setPassword, setUid: setUid, signOut: signOut, hasCloud: hasCloud,
    get uid() { return uid; },
    get apiBase() { return apiBase; },
    initTheme: initTheme, initSky: initSky,
    toast: toast, openLightbox: openLightbox, closeLightbox: closeLightbox,
    loadPhotos: loadPhotos, photoOf: photoOf, photoEntries: photoEntries, thumb: thumb,
    addPhoto: addPhoto, deleteByUrl: deleteByUrl, coverByUrl: coverByUrl, allPhotos: allPhotos,
    processImage: processImage,
    get photos() { return photos; },
    get photosReady() { return photosReady; },
    searchItems: searchItems, mountSearch: mountSearch,
    daysLeft: daysLeft, ago: ago, safeName: safeName
  };
})();
