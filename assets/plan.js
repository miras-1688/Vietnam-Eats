/* 食单页 */
(function () {
  "use strict";
  APP.load();
  APP.initTheme();
  APP.initSky();

  var HN = window.HN;
  var state = APP.state;
  var cards = {};
  var view = "all";
  var query = "";
  var openId = null;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function norm(s) {
    return (s || "").toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");
  }

  /* ── 筛选条 ── */
  var chipsWrap = document.getElementById("chips");
  function buildChips() {
    chipsWrap.textContent = "";
    HN.CATS.forEach(function (c) {
      var b = el("button", "chip", c.n);
      b.type = "button";
      b.dataset.f = c.k;
      b.setAttribute("aria-pressed", state.filter === c.k ? "true" : "false");
      var cnt = el("span", "cnt", "0/0");
      b.appendChild(cnt);
      b.addEventListener("click", function () {
        state.filter = c.k;
        APP.save();
        syncChips();
        applyFilter();
      });
      chipsWrap.appendChild(b);
    });
  }
  function syncChips() {
    Array.prototype.forEach.call(chipsWrap.children, function (b) {
      b.setAttribute("aria-pressed", b.dataset.f === state.filter ? "true" : "false");
    });
  }

  /* ── 卡片 ── */
  function makeCard(it, idx) {
    var c = el("article", "card no-photo");
    c.dataset.id = it.id;
    c.dataset.cat = it.cat || "mine";
    c.style.animationDelay = Math.min(idx, 14) * 28 + "ms";

    var ph = el("div", "photo hidden");
    ph.addEventListener("click", function (e) {
      e.stopPropagation();
      openDrawer(it.id);
    });
    c.appendChild(ph);

    var body = el("div", "card-body");

    var top = el("div", "card-top");
    top.appendChild(el("span", null, APP.catName(it.cat)));
    if (it.area) { top.appendChild(el("span", null, "·")); top.appendChild(el("span", null, it.area)); }
    if (it.badge) {
      var bd = el("span", "badge" + (it.badge === "当季" ? " season" : ""), it.badge);
      top.appendChild(bd);
    }
    if (it.price && it.price !== "—") top.appendChild(el("span", "price", it.price));
    body.appendChild(top);

    var names = el("div", "card-names");
    names.appendChild(el("span", "vn", it.vn));
    names.appendChild(el("span", "zh", it.zh));
    body.appendChild(names);

    if (it.rating) {
      var st = el("div", "stars");
      for (var i = 1; i <= 5; i++) {
        var s = el("i", i <= it.rating ? "on" : null, "★");
        st.appendChild(s);
      }
      body.appendChild(st);
    }

    if (it.tip) body.appendChild(el("p", "card-tip", it.tip));

    var foot = el("div", "card-foot");
    var tick = el("button", "tickbtn");
    tick.type = "button";
    var box = el("span", "box");
    tick.appendChild(box);
    tick.appendChild(document.createTextNode("打卡"));
    tick.addEventListener("click", function (e) {
      e.stopPropagation();
      toggleEaten(it.id, true);
      tick.classList.add("stamp");
      setTimeout(function () { tick.classList.remove("stamp"); }, 360);
    });
    foot.appendChild(tick);

    var mini = el("div", "mini");
    var pbtn = el("button", null, "＋");
    pbtn.type = "button";
    pbtn.title = "加照片";
    pbtn.setAttribute("aria-label", "给 " + it.zh + " 加照片");
    pbtn.addEventListener("click", function (e) {
      e.stopPropagation();
      pickPhoto(it.id);
    });
    mini.appendChild(pbtn);

    var nbtn = el("button", null, "✎");
    nbtn.type = "button";
    nbtn.title = "记一笔";
    nbtn.setAttribute("aria-label", "给 " + it.zh + " 记一笔");
    nbtn.appendChild(el("span", "ndot"));
    if (state.notes[it.id]) nbtn.classList.add("has-note");
    nbtn.addEventListener("click", function (e) {
      e.stopPropagation();
      openDrawer(it.id, true);
    });
    mini.appendChild(nbtn);
    foot.appendChild(mini);

    body.appendChild(foot);
    c.appendChild(body);

    c.addEventListener("click", function () { openDrawer(it.id); });

    /* 拖照片进来 */
    c.addEventListener("dragover", function (e) {
      e.preventDefault();
      c.style.borderColor = "var(--gold)";
    });
    c.addEventListener("dragleave", function () { c.style.borderColor = ""; });
    c.addEventListener("drop", function (e) {
      e.preventDefault();
      c.style.borderColor = "";
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) uploadFor(it.id, f);
    });

    return c;
  }

  function renderGrid() {
    var grid = document.getElementById("grid");
    grid.textContent = "";
    cards = {};
    APP.allItems().forEach(function (it, i) {
      var c = makeCard(it, i);
      cards[it.id] = c;
      grid.appendChild(c);
      paintCardState(it.id);
    });
    APP.allItems().forEach(function (it) { paintPhoto(it.id); });
    renderAlbum();
    applyFilter();
    deepLink();
  }

  function paintCardState(id) {
    var c = cards[id];
    if (!c) return;
    var done = APP.isEaten(id);
    c.classList.toggle("done", done);
    var tick = c.querySelector(".tickbtn");
    tick.setAttribute("aria-pressed", done ? "true" : "false");
    tick.lastChild.textContent = done ? "已吃" : "打卡";
    var nb = c.querySelector(".mini button[title='记一笔']");
    if (nb) nb.classList.toggle("has-note", !!state.notes[id]);
  }

  function paintPhoto(id) {
    var c = cards[id];
    if (!c) return;
    var it = APP.byId(id);
    var url = APP.photoOf(id);
    var ph = c.querySelector(".photo");
    if (!url) {
      c.classList.add("no-photo");
      ph.classList.add("hidden");
      return;
    }
    c.classList.remove("no-photo");
    ph.classList.remove("hidden");
    var img = ph.querySelector("img");
    if (!img) {
      img = el("img");
      img.loading = "lazy";
      img.decoding = "async";
      ph.appendChild(img);
    }
    img.src = APP.thumb(url);
    img.alt = it ? it.zh : "";
    img.onerror = function () { img.onerror = null; img.src = url; };
  }

  /* ── 筛选/排序 ── */
  function matches(it) {
    if (state.filter !== "all" && (it.cat || "mine") !== state.filter) return false;
    if (state.region && state.region !== "all" && (it.region || "all") !== state.region) return false;
    if (view === "left" && APP.isEaten(it.id)) return false;
    if (view === "done" && !APP.isEaten(it.id)) return false;
    if (query) {
      var q = norm(query);
      if (norm(it.vn).indexOf(q) < 0 && norm(it.zh).indexOf(q) < 0 && norm(it.area).indexOf(q) < 0) return false;
    }
    return true;
  }

  function applyFilter() {
    var shown = 0, total = 0;
    var list = APP.allItems().slice();
    if (state.sort === "rating") {
      list.sort(function (a, b) { return (b.rating || 0) - (a.rating || 0); });
    } else {
      // 原序：先 ITEMS 后自定义，保持稳定
      var order = {};
      APP.allItems().forEach(function (it, i) { order[it.id] = i; });
      list.sort(function (a, b) { return order[a.id] - order[b.id]; });
    }
    var grid = document.getElementById("grid");
    list.forEach(function (it) { grid.appendChild(cards[it.id]); });
    list.forEach(function (it) {
      total++;
      var ok = matches(it);
      cards[it.id].classList.toggle("hidden", !ok);
      if (ok) shown++;
    });
    document.getElementById("shown").textContent = "显示 " + shown + " / " + total;
    document.getElementById("gridEmpty").classList.toggle("hidden", shown > 0);
    syncChips();
    refreshStats();
  }

  /* ── 统计 ── */
  var RING = 2 * Math.PI * 34;
  var barEls = {};

  /* 分类条只建一次，之后原地改宽度，这样才有过渡动画 */
  function buildBars() {
    var bars = document.getElementById("bars");
    bars.textContent = "";
    barEls = {};
    HN.CATS.forEach(function (c) {
      if (c.k === "all" || c.k === "mine") return;
      var row = el("div", "bar-row");
      var n = el("span", null, c.n);
      var v = el("span", "n", "—");
      var tr = el("div", "bar-track");
      var fi = el("i", "bar-fill");
      fi.style.width = "0%";
      tr.appendChild(fi);
      row.appendChild(n); row.appendChild(v); row.appendChild(tr);
      bars.appendChild(row);
      barEls[c.k] = { v: v, fill: fi };
    });
  }

  function updateBars(counts) {
    HN.CATS.forEach(function (c) {
      var e = barEls[c.k];
      if (!e) return;
      var t = counts[c.k] || { d: 0, t: 0 };
      if (!t.t) { e.v.textContent = "—"; e.fill.style.width = "0%"; return; }
      e.v.textContent = t.d + "/" + t.t;
      e.fill.style.width = (t.d / t.t * 100).toFixed(1) + "%";
    });
  }

  function refreshStats() {
    var items = APP.allItems();
    var done = APP.doneCount();
    var p = items.length ? done / items.length : 0;
    document.getElementById("doneNum").textContent = done;
    document.getElementById("totalNum").textContent = items.length;
    var bar = document.getElementById("ringBar");
    bar.setAttribute("stroke-dasharray", RING.toFixed(2));
    bar.setAttribute("stroke-dashoffset", (RING * (1 - p)).toFixed(2));
    APP.setAxis(done, items.length);

    var counts = {};
    HN.CATS.forEach(function (c) { counts[c.k] = { d: 0, t: 0 }; });
    items.forEach(function (it) {
      var k = (it.cat && counts[it.cat]) ? it.cat : "mine";
      counts[k].t++;
      counts.all.t++;
      if (APP.isEaten(it.id)) { counts[k].d++; counts.all.d++; }
    });
    Array.prototype.forEach.call(chipsWrap.children, function (b) {
      var c = counts[b.dataset.f] || { d: 0, t: 0 };
      b.querySelector(".cnt").textContent = c.d + "/" + c.t;
    });

    var days = APP.daysLeft();
    var dEl = document.getElementById("daysNum");
    var left = items.length - done;
    if (days > 0) {
      var per = left / days;
      dEl.textContent = per >= 1
        ? "还剩 " + left + " 样 · 每天 " + Math.ceil(per) + " 样"
        : "还剩 " + left + " 样 · 还有 " + days + " 天";
    } else if (days === 0) {
      dEl.textContent = "还剩 " + left + " 样 · 今天走";
    } else if (days < 0) {
      dEl.textContent = "还剩 " + left + " 样";
    } else {
      dEl.textContent = "还剩 " + left + " 样";
    }

    var bars = document.getElementById("bars");
    if (!bars.children.length) buildBars();
    updateBars(counts);

    document.getElementById("fCount").textContent = done + " / " + items.length + " 已吃";
    document.getElementById("phSub").textContent =
      "共 " + items.length + " 样 · 已吃 " + done + " 样 · 点卡片看细节，加照片";
  }

  /* ── 打卡 ── */
  function toggleEaten(id, fromCard) {
    var it = APP.byId(id);
    if (!it) return;
    var was = APP.isEaten(id);
    APP.setEaten(id, !was);
    APP.toast(was ? "取消打卡：" + it.zh : "打卡：" + it.zh + (fromCard ? " · 吃掉一样" : ""));
    APP.saveNow();
    paintCardState(id);
    refreshStats();
    if (openId === id) paintDrawerState();
  }

  /* ── 上传 ── */
  var filePick = document.createElement("input");
  filePick.type = "file";
  filePick.accept = "image/*";
  filePick.className = "hidden";
  document.body.appendChild(filePick);
  var pickTarget = null;
  filePick.addEventListener("change", function () {
    if (pickTarget && filePick.files && filePick.files[0]) uploadFor(pickTarget, filePick.files[0]);
    filePick.value = "";
  });
  function pickPhoto(id) { pickTarget = id; filePick.click(); }

  function uploadFor(id, file) {
    if (!/^image\//.test(file.type || "")) { APP.toast("只能放图片"); return; }
    if (file.size > 20 * 1024 * 1024) { APP.toast("太大了，20MB 以内"); return; }
    APP.toast("上传中…");
    APP.uploadPhoto(id, file).then(function () {
      paintPhoto(id);
      renderAlbum();
      if (openId === id) paintDrawerPhoto();
      APP.toast("照片已存进 images/");
    }).catch(function () {
      APP.toast("存不进去。确认是用 start.bat 启动的，不是直接双击 html。");
    });
  }

  /* ── 抽屉 ── */
  var drawer = document.getElementById("drawer");
  var scrim = document.getElementById("scrim");

  function openDrawer(id, focusNote) {
    var it = APP.byId(id);
    if (!it) return;
    openId = id;
    drawer.textContent = "";

    var head = el("div", "drawer-head");
    head.appendChild(el("span", "dt", "食单 · " + APP.catName(it.cat)));
    var x = el("button", "x", "×");
    x.type = "button";
    x.setAttribute("aria-label", "关闭");
    x.addEventListener("click", closeDrawer);
    head.appendChild(x);
    drawer.appendChild(head);

    var body = el("div", "drawer-body");

    var img = el("div", "drawer-img");
    img.id = "dImg";
    img.addEventListener("click", function () {
      var shown = img.querySelector("img");
      if (shown) APP.openLightbox(shown.src, it.zh);
      else pickPhoto(id);
    });
    body.appendChild(img);

    var thumbs = el("div", "drawer-thumbs hidden");
    thumbs.id = "dThumbs";
    body.appendChild(thumbs);

    var title = el("h2", null, it.vn);
    title.id = "drawerTitle";
    body.appendChild(title);
    body.appendChild(el("p", "dz", it.zh));

    var kv = el("dl", "kv");
    [["在哪", it.area || "—"], ["大概价", it.price || "—"],
     ["评分", it.rating ? "★".repeat(it.rating) + "☆".repeat(5 - it.rating) : "—"]]
      .forEach(function (row) {
        kv.appendChild(el("dt", null, row[0]));
        kv.appendChild(el("dd", null, row[1]));
      });
    body.appendChild(kv);

    if (it.tip) body.appendChild(el("p", null, it.tip));
    if (it.shop) {
      var sp = el("p", null, "参考：" + it.shop);
      sp.style.cssText = "font-size:.82rem;color:var(--fg-3);border-left:2px solid var(--line-2);padding-left:.6rem";
      body.appendChild(sp);
    }

    var nb = el("div", "note-block");
    nb.appendChild(el("label", null, "记一笔"));
    var ta = el("textarea");
    ta.placeholder = "吃完了什么感觉，多少钱，下次还来吗";
    ta.value = state.notes[id] || "";
    ta.id = "dNote";
    ta.addEventListener("input", function () {
      var v = ta.value.trim();
      if (v) state.notes[id] = ta.value; else delete state.notes[id];
      APP.save();
      paintCardState(id);
    });
    nb.appendChild(ta);
    body.appendChild(nb);

    var acts = el("div", "drawer-actions");
    var dTick = el("button", "btn gold", "打卡");
    dTick.type = "button";
    dTick.id = "dTick";
    dTick.addEventListener("click", function () { toggleEaten(id); });
    acts.appendChild(dTick);

    var dPhoto = el("button", "btn", "换照片");
    dPhoto.type = "button";
    dPhoto.addEventListener("click", function () { pickPhoto(id); });
    acts.appendChild(dPhoto);

    var dDel = el("button", "btn", "删除照片");
    dDel.type = "button";
    dDel.id = "dDel";
    var armed = false, armT = null;
    dDel.addEventListener("click", function () {
      if (!armed) {
        armed = true;
        dDel.textContent = "再点一次确认";
        armT = setTimeout(function () { armed = false; dDel.textContent = "删除照片"; }, 4000);
        return;
      }
      clearTimeout(armT);
      var url = APP.photoOf(id);
      if (!url) return;
      APP.deletePhoto(url).then(function () {
        APP.photos[id] = (APP.photos[id] || []).filter(function (u) { return u !== url; });
        paintPhoto(id);
        paintDrawerPhoto();
        renderAlbum();
        APP.toast("照片已删");
      }).catch(function () { APP.toast("删不掉"); });
      armed = false;
      dDel.textContent = "删除照片";
    });
    acts.appendChild(dDel);

    body.appendChild(acts);
    drawer.appendChild(body);

    scrim.classList.add("open");
    drawer.classList.add("open");
    document.body.style.overflow = "hidden";
    paintDrawerState();
    paintDrawerPhoto();
    if (focusNote) setTimeout(function () { ta.focus(); }, 320);
  }

  function paintDrawerState() {
    if (!openId) return;
    var it = APP.byId(openId);
    var dTick = document.getElementById("dTick");
    if (!dTick) return;
    var done = APP.isEaten(openId);
    dTick.textContent = done ? "已吃 · 点一下取消" : "打卡吃掉";
    dTick.className = "btn " + (done ? "jade" : "gold");
  }

  function paintDrawerPhoto() {
    if (!openId) return;
    var box = document.getElementById("dImg");
    if (!box) return;
    var it = APP.byId(openId);
    var list = (APP.photos[openId] || []);
    box.textContent = "";
    if (list.length) {
      var im = el("img");
      im.src = list[0];
      im.alt = it ? it.zh : "";
      box.appendChild(im);
      document.getElementById("dDel").classList.remove("hidden");
    } else {
      box.appendChild(document.createTextNode("点这里选照片，或把图片拖进来"));
      document.getElementById("dDel").classList.add("hidden");
    }

    var thumbs = document.getElementById("dThumbs");
    if (!thumbs) return;
    thumbs.textContent = "";
    if (list.length < 2) { thumbs.classList.add("hidden"); return; }
    thumbs.classList.remove("hidden");
    list.forEach(function (u, i) {
      var b = el("button");
      b.type = "button";
      b.setAttribute("aria-pressed", i === 0 ? "true" : "false");
      b.setAttribute("aria-label", "第 " + (i + 1) + " 张");
      var tim = el("img");
      tim.src = u;
      tim.alt = "";
      b.appendChild(tim);
      b.addEventListener("click", function () {
        var main = box.querySelector("img");
        if (main) main.src = u;
        Array.prototype.forEach.call(thumbs.children, function (x) {
          x.setAttribute("aria-pressed", x === b ? "true" : "false");
        });
      });
      thumbs.appendChild(b);
    });
  }

  function closeDrawer() {
    openId = null;
    drawer.classList.remove("open");
    scrim.classList.remove("open");
    document.body.style.overflow = "";
  }
  scrim.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { closeDrawer(); APP.closeLightbox(); }
  });

  /* 抽屉里也能拖照片 */
  drawer.addEventListener("dragover", function (e) { e.preventDefault(); });
  drawer.addEventListener("drop", function (e) {
    e.preventDefault();
    if (!openId) return;
    var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) uploadFor(openId, f);
  });

  /* ── 相册 ── */
  function renderAlbum() {
    var g = document.getElementById("albumGrid");
    var empty = document.getElementById("albumEmpty");
    if (!g) return;
    var list = APP.allPhotos();
    g.textContent = "";
    empty.classList.toggle("hidden", list.length > 0);
    list.forEach(function (p) {
      var fig = el("figure");
      var im = el("img");
      im.src = APP.thumb(p.url);
      im.loading = "lazy";
      im.decoding = "async";
      im.onerror = function () { im.onerror = null; im.src = p.url; };
      var it = APP.byId(p.id);
      im.alt = it ? it.zh : "";
      var cap = el("figcaption", null, it ? it.vn + " · " + it.zh : p.id);
      fig.appendChild(im);
      fig.appendChild(cap);
      fig.addEventListener("click", function () { openDrawer(p.id); });
      g.appendChild(fig);
    });
  }

  /* ── 走法 ── */
  function renderRoutes() {
    var wrap = document.getElementById("routesWrap");
    HN.ROUTES.forEach(function (r) {
      var d = el("div", "route");
      d.appendChild(el("h3", null, r.n));
      d.appendChild(el("p", "rm", r.meta));
      d.appendChild(el("p", "rd", r.d));
      var ids = el("div", "rids");
      (r.ids || []).forEach(function (id) {
        var it = APP.byId(id);
        if (!it) return;
        var b = el("button", null, it.vn);
        b.type = "button";
        b.addEventListener("click", function () {
          var c = cards[id];
          if (c) {
            c.classList.remove("hidden");
            c.scrollIntoView({ behavior: "smooth", block: "center" });
          }
          setTimeout(function () { openDrawer(id); }, 420);
        });
        ids.appendChild(b);
      });
      d.appendChild(ids);
      wrap.appendChild(d);
    });
  }

  /* ── 吃之前 ── */
  function renderKnow() {
    var ul = document.getElementById("know");
    HN.TIPS.forEach(function (t) {
      var li = el("li");
      li.appendChild(el("span", "kk", t.k));
      li.appendChild(el("span", null, t.v));
      ul.appendChild(li);
    });
  }

  /* ── 备份 ── */
  function initBackup() {
    var box = document.getElementById("backupBox");
    document.getElementById("btnCopy").addEventListener("click", function () {
      var text = JSON.stringify(state);
      box.value = text;
      box.select();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
          .then(function () { APP.toast("已复制"); })
          .catch(function () { APP.toast("已选中，按 Ctrl+C"); });
      } else {
        APP.toast("已选中，按 Ctrl+C");
      }
    });
    document.getElementById("btnRestore").addEventListener("click", function () {
      var raw = box.value.trim();
      if (!raw) { APP.toast("先把备份粘进来"); return; }
      var o;
      try { o = JSON.parse(raw); } catch (e) { APP.toast("这段读不出来"); return; }
      if (!o || typeof o !== "object" || !o.eaten) { APP.toast("格式不对"); return; }
      state.eaten = o.eaten;
      state.notes = o.notes || {};
      if (Array.isArray(o.custom)) {
        var have = {};
        state.custom.forEach(function (c) { have[c.id] = true; });
        o.custom.forEach(function (c) { if (!have[c.id]) state.custom.push(c); });
      }
      if (typeof o.target === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.target)) {
        state.target = o.target;
        document.getElementById("target").value = o.target;
      }
      APP.saveNow();
      renderGrid();
      APP.toast("已恢复");
    });
    var armed = false, t = null;
    document.getElementById("btnClear").addEventListener("click", function () {
      var b = this;
      if (!armed) {
        armed = true;
        b.textContent = "再点一次清空";
        t = setTimeout(function () { armed = false; b.textContent = "清空"; }, 4000);
        return;
      }
      clearTimeout(t); armed = false; b.textContent = "清空";
      state.eaten = {}; state.notes = {}; state.custom = [];
      APP.saveNow();
      renderGrid();
      APP.toast("已清空");
    });
  }

  /* ── 顶部工具 ── */
  function initTools() {
    document.getElementById("regionSeg").addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      state.region = b.dataset.r;
      APP.save();
      Array.prototype.forEach.call(this.children, function (x) {
        x.setAttribute("aria-pressed", x === b ? "true" : "false");
      });
      applyFilter();
    });
    document.getElementById("viewSeg").addEventListener("click", function (e) {      var b = e.target.closest("button");
      if (!b) return;
      view = b.dataset.v;
      Array.prototype.forEach.call(this.children, function (x) {
        x.setAttribute("aria-pressed", x === b ? "true" : "false");
      });
      applyFilter();
    });
    document.getElementById("sortSeg").addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      state.sort = b.dataset.s;
      APP.save();
      Array.prototype.forEach.call(this.children, function (x) {
        x.setAttribute("aria-pressed", x === b ? "true" : "false");
      });
      applyFilter();
    });

    var q = document.getElementById("q");
    var t = null;
    q.addEventListener("input", function () {
      clearTimeout(t);
      t = setTimeout(function () {
        query = q.value.trim();
        applyFilter();
      }, 120);
    });
    q.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { q.value = ""; query = ""; applyFilter(); q.blur(); }
    });

    var tgt = document.getElementById("target");
    tgt.value = state.target;
    tgt.addEventListener("change", function () {
      if (/^\d{4}-\d{2}-\d{2}$/.test(tgt.value)) {
        state.target = tgt.value;
        APP.saveNow();
        refreshStats();
      }
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "/" && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
        e.preventDefault();
        q.focus();
      }
    });
  }

  /* ── 深链 ── */
  function deepLink() {
    var m = /[?&]focus=([^&]+)/.exec(location.search);
    if (!m) return;
    var id = decodeURIComponent(m[1]);
    if (!APP.byId(id)) return;
    var c = cards[id];
    if (c) {
      c.classList.remove("hidden");
      c.scrollIntoView({ block: "center" });
    }
    openDrawer(id);
  }

  /* ── 加一条 ── */
  function renderAddCard() {
    var wrap = document.getElementById("addWrap");
    wrap.textContent = "";
    var box = el("div", "addcard");
    box.appendChild(el("h3", null, "吃到单子外的东西？加进来"));
    box.appendChild(el("p", "hint", "会归到「我的发现」，照样能打卡、加照片。"));
    var row = el("div", "row");
    var i1 = el("input"); i1.placeholder = "越南语名 / 店名"; i1.autocomplete = "off";
    var i2 = el("input"); i2.placeholder = "中文叫什么"; i2.autocomplete = "off";
    var i3 = el("input"); i3.placeholder = "在哪、怎么吃、多少钱"; i3.autocomplete = "off";
    row.appendChild(i1); row.appendChild(i2); row.appendChild(i3);
    box.appendChild(row);
    var acts = el("div", "acts");
    var btn = el("button", "btn gold", "加进食单");
    btn.type = "button";
    acts.appendChild(btn);
    box.appendChild(acts);
    wrap.appendChild(box);

    btn.addEventListener("click", function () {
      var vn = i1.value.trim(), zh = i2.value.trim(), tip = i3.value.trim();
      if (!vn && !zh) { i1.focus(); APP.toast("至少写个名字"); return; }
      var it = { id: "c" + Date.now().toString(36), vn: vn || zh, zh: zh || vn,
                 cat: "mine", area: "", tip: tip, rating: 0 };
      state.custom.push(it);
      APP.saveNow();
      var c = makeCard(it, 0);
      cards[it.id] = c;
      document.getElementById("grid").appendChild(c);
      paintCardState(it.id);
      i1.value = ""; i2.value = ""; i3.value = "";
      state.filter = "mine";
      APP.save();
      applyFilter();
      APP.toast("加好了");
      c.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }

  /* ── 启动 ── */
  if (HN.CATS.every(function (c) { return c.k !== state.filter; })) state.filter = "all";
  buildChips();
  renderRoutes();
  renderKnow();
  renderAddCard();
  initBackup();
  initTools();
  APP.loadPhotos().then(renderGrid);
  Array.prototype.forEach.call(document.getElementById("sortSeg").children, function (x) {
    x.setAttribute("aria-pressed", x.dataset.s === state.sort ? "true" : "false");
  });
  Array.prototype.forEach.call(document.getElementById("regionSeg").children, function (x) {
    x.setAttribute("aria-pressed", x.dataset.r === (state.region || "all") ? "true" : "false");
  });
  /* 锚点滚到区块 */
  if (location.hash) {
    var target = document.querySelector(location.hash);
    if (target) setTimeout(function () { target.scrollIntoView({ block: "start" }); }, 60);
  }
})();
