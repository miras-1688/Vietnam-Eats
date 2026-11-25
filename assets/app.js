/* 越南食单 · 公共逻辑：状态、主题、星野、搜索、相册接口 */
window.APP = (function () {
  "use strict";

  var KEY = "hn-food-v2";
  var OLD = "hanoi-food-v1";
  var MEDIA = window.matchMedia("(prefers-color-scheme: dark)");

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
  function save() {
    clearTimeout(t);
    t = setTimeout(function () {
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    }, 180);
  }
  function saveNow() {
    clearTimeout(t);
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
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
  function loadPhotos() {
    return fetch("api/photos", { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : { photos: {} }; })
      .then(function (j) {
        photos = (j && j.photos) || {};
        photosReady = true;
        return photos;
      })
      .catch(function () { photos = {}; photosReady = true; return photos; });
  }
  function photoOf(id) {
    var a = photos[id];
    return (a && a.length) ? a[0] : null;
  }
  /* 卡片和相册走缩略图，抽屉和灯箱才加载原图 */
  function thumb(url) {
    if (!url) return url;
    return url.replace("/images/", "/images/thumbs/");
  }
  function uploadPhoto(id, file) {
    var ext = (file.name.match(/\.[a-zA-Z0-9]+$/) || [".jpg"])[0].toLowerCase();
    var name = id + "__" + Date.now().toString(36) + ext;
    return fetch("api/photos?name=" + encodeURIComponent(name), {
      method: "POST",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file
    }).then(function (r) {
      if (!r.ok) throw new Error("upload failed");
      return r.json();
    }).then(function (j) {
      if (!photos[id]) photos[id] = [];
      photos[id].unshift(j.url);
      return j.url;
    });
  }
  function deletePhoto(url) {
    var name = url.split("/").pop();
    return fetch("api/photos?name=" + encodeURIComponent(name), { method: "DELETE" })
      .then(function (r) { if (!r.ok) throw new Error("delete failed"); return true; });
  }
  function allPhotos() {
    var out = [];
    Object.keys(photos).forEach(function (id) {
      photos[id].forEach(function (u) { out.push({ id: id, url: u }); });
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

  return {
    get state() { return state; },
    allItems: allItems, byId: byId, catName: catName, doneCount: doneCount,
    isEaten: isEaten, setEaten: setEaten, setAxis: setAxis,
    load: load, save: save, saveNow: saveNow,
    initTheme: initTheme, initSky: initSky,
    toast: toast, openLightbox: openLightbox, closeLightbox: closeLightbox,
    loadPhotos: loadPhotos, photoOf: photoOf, thumb: thumb, uploadPhoto: uploadPhoto,
    deletePhoto: deletePhoto, allPhotos: allPhotos,
    get photos() { return photos; },
    get photosReady() { return photosReady; },
    searchItems: searchItems, mountSearch: mountSearch,
    daysLeft: daysLeft, ago: ago, safeName: safeName
  };
})();
