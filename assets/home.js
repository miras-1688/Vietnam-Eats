/* 首页 */
(function () {
  "use strict";
  APP.load();
  APP.initTheme();
  APP.initSky();

  var HN = window.HN;
  var CATS = HN.CATS;
  var state = APP.state;

  function start() {
    var items = APP.allItems();

    document.getElementById("eCount").textContent = items.length;
    document.getElementById("eRoutes").textContent = HN.ROUTES.length;
    document.getElementById("totalNum").textContent = items.length;

    /* ── 进度环 ── */
    var RING = 2 * Math.PI * 34;
    var done = APP.doneCount();
    var p = items.length ? done / items.length : 0;
    document.getElementById("doneNum").textContent = done;
    var bar = document.getElementById("ringBar");
    bar.setAttribute("stroke-dasharray", RING.toFixed(2));
    bar.setAttribute("stroke-dashoffset", (RING * (1 - p)).toFixed(2));
    APP.setAxis(done, items.length);

    var days = APP.daysLeft();
    var dEl = document.getElementById("daysNum");
    if (days > 0) dEl.textContent = "还有 " + days + " 天";
    else if (days === 0) dEl.textContent = "就是今天走";
    else if (days < 0) dEl.textContent = "已过 " + (-days) + " 天";

    /* ── 分类进度条 ── */
    var bars = document.getElementById("bars");
    CATS.forEach(function (c) {
      if (c.k === "all" || c.k === "mine") return;
      var list = items.filter(function (it) { return it.cat === c.k; });
      if (!list.length) return;
      var d = list.filter(function (it) { return APP.isEaten(it.id); }).length;
      var row = document.createElement("div");
      row.className = "bar-row";
      var n = document.createElement("span"); n.textContent = c.n;
      var v = document.createElement("span"); v.className = "n"; v.textContent = d + "/" + list.length;
      var tr = document.createElement("div"); tr.className = "bar-track";
      var fi = document.createElement("i"); fi.className = "bar-fill";
      fi.style.width = (list.length ? (d / list.length * 100) : 0) + "%";
      tr.appendChild(fi);
      row.appendChild(n); row.appendChild(v); row.appendChild(tr);
      bars.appendChild(row);
    });

    /* ── 三区分布 ── */
    var regNames = { bac: "北部", trung: "中部", nam: "南部" };
    var regBits = [];
    ["bac", "trung", "nam"].forEach(function (k) {
      var n = items.filter(function (it) { return it.region === k; }).length;
      if (n) regBits.push(regNames[k] + " " + n);
    });
    if (regBits.length) {
      var rl = document.createElement("p");
      rl.style.cssText = "font-size:.72rem;color:var(--fg-3);margin-top:.75rem;letter-spacing:.02em";
      rl.textContent = regBits.join(" · ");
      bars.appendChild(rl);
    }
    var recent = document.getElementById("recent");
    var eatenList = Object.keys(state.eaten)
      .map(function (id) { return { id: id, t: state.eaten[id], it: APP.byId(id) }; })
      .filter(function (x) { return x.it; })
      .sort(function (a, b) { return b.t - a.t; })
      .slice(0, 4);
    if (!eatenList.length) {
      var li = document.createElement("li");
      li.className = "none";
      li.textContent = done > 0 ? "有照片的已经算吃过了（共 " + done + " 样）" : "还没打卡。去食单点第一个。";
      recent.appendChild(li);
    } else {
      eatenList.forEach(function (x) {
        var li = document.createElement("li");
        var a = document.createElement("a");
        a.className = "rn";
        a.href = "plan.html?focus=" + encodeURIComponent(x.id);
        a.textContent = x.it.zh;
        var t = document.createElement("span");
        t.className = "rt";
        t.textContent = APP.ago(x.t);
        li.appendChild(a); li.appendChild(t);
        recent.appendChild(li);
      });
    }

    /* ── 今天吃哪样：优先没吃过的 ── */
    var seed = Math.floor(Date.now() / 86400000);
    var pool = items.filter(function (it) { return !APP.isEaten(it.id); });
    if (!pool.length) pool = items.slice();
    pool = pool.slice().sort(function (a, b) {
      var ha = (a.id.charCodeAt(0) * 31 + a.id.length * 7 + seed) % 997;
      var hb = (b.id.charCodeAt(0) * 31 + b.id.length * 7 + seed) % 997;
      return ha - hb;
    }).slice(0, 6);

    var pickRow = document.getElementById("picks");
    pool.forEach(function (it) {
      var b = document.createElement("a");
      b.className = "pick";
      b.href = "plan.html?focus=" + encodeURIComponent(it.id);
      var v = document.createElement("span"); v.className = "pv"; v.textContent = it.vn;
      var z = document.createElement("span"); z.className = "pz"; z.textContent = it.zh + " · " + (it.area || "");
      b.appendChild(v); b.appendChild(z);
      pickRow.appendChild(b);
    });

    document.getElementById("fTarget").textContent = "离越 " + state.target;
  }

  APP.loadPhotos().then(APP.pullState).then(start);

  /* ── 搜索 ── */
  APP.mountSearch(document.getElementById("q"), {
    onPick: function (it) {
      location.href = "plan.html?focus=" + encodeURIComponent(it.id);
    }
  });

  /* 快捷键：/ 聚焦搜索 */
  document.addEventListener("keydown", function (e) {
    if (e.key === "/" && document.activeElement.tagName !== "INPUT") {
      e.preventDefault();
      document.getElementById("q").focus();
    }
  });
})();
