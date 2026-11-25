/* 手机传图页 */
(function () {
  "use strict";
  APP.load();
  APP.initTheme();
  APP.initSky();

  var HN = window.HN;
  var listEl = document.getElementById("list");
  var picker = document.getElementById("picker");
  var query = "";
  var targetId = null;
  var toastEl = document.getElementById("toast");
  var toastT = null;

  var sheet = document.getElementById("sheet");
  var scrim = document.getElementById("sheetScrim");
  var sheetBody = document.getElementById("sheetBody");
  var sheetTitle = document.getElementById("sheetTitle");
  var sheetId = null;

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove("show"); }, 2400);
  }

  function norm(s) {
    return (s || "").toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");
  }

  function fileName(url) {
    return decodeURIComponent(url.split("/").pop());
  }

  /* ── 列表 ── */
  function render() {
    listEl.textContent = "";
    var items = APP.allItems();
    var q = norm(query);
    var byCat = {};
    items.forEach(function (it) {
      if (q && norm(it.vn).indexOf(q) < 0 && norm(it.zh).indexOf(q) < 0 && norm(it.area).indexOf(q) < 0) return;
      var k = it.cat || "mine";
      if (!byCat[k]) byCat[k] = [];
      byCat[k].push(it);
    });

    HN.CATS.forEach(function (c) {
      var group = byCat[c.k];
      if (!group || !group.length) return;
      var head = document.createElement("div");
      head.className = "cat-head";
      head.textContent = c.n;
      listEl.appendChild(head);
      group.forEach(function (it) { listEl.appendChild(row(it)); });
    });

    if (!listEl.children.length) {
      var p = document.createElement("p");
      p.className = "up-foot";
      p.textContent = "没找到。换个词试试。";
      listEl.appendChild(p);
    }
  }

  function row(it) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "row";
    btn.dataset.id = it.id;

    var th = document.createElement("div");
    th.className = "th";
    btn.appendChild(th);

    var nm = document.createElement("div");
    nm.className = "nm";
    var vn = document.createElement("span"); vn.className = "vn"; vn.textContent = it.vn;
    var zh = document.createElement("span"); zh.className = "zh"; zh.textContent = it.zh;
    nm.appendChild(vn); nm.appendChild(zh);
    btn.appendChild(nm);

    var url = APP.photoOf(it.id);
    if (url) {
      var img = document.createElement("img");
      img.src = APP.thumb(url);
      img.alt = "";
      img.loading = "lazy";
      img.onerror = function () { img.onerror = null; img.src = url; };
      th.appendChild(img);
      th.classList.add("has");
      var cnt = document.createElement("span");
      cnt.className = "cnt";
      cnt.textContent = (APP.photos[it.id] || []).length + " 张";
      btn.appendChild(cnt);
    } else {
      th.textContent = "＋";
      var plus = document.createElement("span");
      plus.className = "plus";
      plus.textContent = "＋";
      btn.appendChild(plus);
    }

    btn.addEventListener("click", function () {
      if (APP.photos[it.id] && APP.photos[it.id].length) openSheet(it.id);
      else pickFor(it.id);
    });
    return btn;
  }

  /* ── 照片抽屉 ── */
  function openSheet(id) {
    sheetId = id;
    var it = APP.byId(id);
    sheetTitle.textContent = it ? it.vn : id;
    sheetBody.textContent = "";

    var list = APP.photos[id] || [];
    if (!list.length) {
      var e = document.createElement("p");
      e.className = "sheet-empty";
      e.textContent = "这道菜还没有照片。点下面加一张。";
      sheetBody.appendChild(e);
    }

    list.forEach(function (url, i) {
      sheetBody.appendChild(tile(id, url, i === 0));
    });

    scrim.classList.add("open");
    sheet.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function closeSheet() {
    sheetId = null;
    scrim.classList.remove("open");
    sheet.classList.remove("open");
    document.body.style.overflow = "";
  }

  function tile(id, url, isCover) {
    var box = document.createElement("div");
    box.className = "tile" + (isCover ? " cover" : "");

    var img = document.createElement("img");
    img.src = APP.thumb(url);
    img.alt = "";
    img.onerror = function () { img.onerror = null; img.src = url; };
    box.appendChild(img);

    var ops = document.createElement("div");
    ops.className = "ops";

    var coverBtn = document.createElement("button");
    coverBtn.type = "button";
    coverBtn.className = isCover ? "on" : "";
    coverBtn.textContent = isCover ? "当前封面" : "设为封面";
    coverBtn.disabled = isCover;
    coverBtn.addEventListener("click", function () {
      setCover(id, url);
    });
    ops.appendChild(coverBtn);

    var delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "del";
    delBtn.textContent = "删";
    var armed = false, t = null;
    delBtn.addEventListener("click", function () {
      if (!armed) {
        armed = true;
        delBtn.textContent = "确认";
        t = setTimeout(function () { armed = false; delBtn.textContent = "删"; }, 3500);
        return;
      }
      clearTimeout(t);
      removePhoto(id, url);
    });
    ops.appendChild(delBtn);

    box.appendChild(ops);
    return box;
  }

  function setCover(id, url) {
    APP.coverByUrl(id, url).then(function (ok) {
      if (!ok) throw new Error("cover");
      return APP.loadPhotos();
    }).then(function () {
      render();
      openSheet(id);
      toast("封面换了");
    }).catch(function () { toast("换不了，再试一次"); });
  }

  function removePhoto(id, url) {
    APP.deleteByUrl(url).then(function (ok) {
      if (!ok) throw new Error("del");
      return APP.loadPhotos();
    }).then(function () {
      render();
      if (APP.photos[id] && APP.photos[id].length) openSheet(id);
      else closeSheet();
      toast("删了");
    }).catch(function () { toast("删不掉"); });
  }

  function pickFor(id) {
    targetId = id;
    picker.value = "";
    picker.click();
  }

  /* ── 图像处理：摆正 → 裁切填满 → 白边 ── */
  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("decode")); };
      img.src = url;
    });
  }

  function frame(img, W, H, M) {
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

  function toBlob(canvas, q) {
    return new Promise(function (r) { canvas.toBlob(r, "image/jpeg", q); });
  }

  function post(url, blob) {
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "image/jpeg" },
      body: blob
    }).then(function (r) {
      if (!r.ok) throw new Error("upload " + r.status);
      return r.json();
    });
  }

  picker.addEventListener("change", function () {
    var file = picker.files && picker.files[0];
    if (!file || !targetId) return;
    var id = targetId;
    var btn = listEl.querySelector('.row[data-id="' + id + '"]');
    if (btn) btn.classList.add("busy");
    toast("处理中…");

    loadImage(file).then(function (img) {
      var big = frame(img, 1600, 1200, 72);
      var small = frame(img, 480, 360, 22);
      return Promise.all([toBlob(big, 0.85), toBlob(small, 0.82)]);
    }).then(function (blobs) {
      return APP.addPhoto(id, blobs[0], blobs[1]);
    }).then(function (res) {
      return APP.loadPhotos().then(function () { return res; });
    }).then(function (res) {
      render();
      if (sheetId === id) openSheet(id);
      toast(res.where === "local" ? "存在这台手机里了" : "传好了");
      if (navigator.vibrate) navigator.vibrate(18);
    }).catch(function (e) {
      if (btn) btn.classList.remove("busy");
      toast(e && String(e.message).indexOf("storage") >= 0
        ? "这个浏览器不让存，换个浏览器试试"
        : "这张图读不了，换一张试试");
    });
  });

  /* ── 事件 ── */
  document.getElementById("sheetX").addEventListener("click", closeSheet);
  scrim.addEventListener("click", closeSheet);
  document.getElementById("sheetAdd").addEventListener("click", function () {
    if (sheetId) pickFor(sheetId);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeSheet();
  });

  document.getElementById("q").addEventListener("input", function () {
    var v = this.value.trim();
    clearTimeout(window.__qt);
    window.__qt = setTimeout(function () { query = v; render(); }, 120);
  });

  APP.loadPhotos().then(render);
})();
