/**
 * Vietnam Eats · Cloudflare Worker
 * KV 绑定的名字：FOOD
 * 环境变量：SHARED_KEY（可选，设了就要带 X-Key 头）
 *
 * 接口和本地 server.js 一致，前端换 base URL 即可。
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Key",
  "Access-Control-Max-Age": "86400"
};

const IMG_RE = /\.(jpe?g|png|webp|gif|avif|bmp)$/i;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}

function safeName(n) {
  return String(n || "").replace(/[^A-Za-z0-9._-]/g, "").slice(0, 120);
}

function idOf(name) {
  const stem = name.replace(/\.[^.]+$/, "");
  return stem.includes("__") ? stem.split("__")[0] : stem;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

    if (env.SHARED_KEY) {
      const key = request.headers.get("X-Key") || url.searchParams.get("key");
      if (key !== env.SHARED_KEY) return json({ error: "unauthorized" }, 401);
    }

    try {
      /* ── 图片 ── */
      if (path.startsWith("/images/thumbs/")) {
        const name = safeName(decodeURIComponent(path.slice("/images/thumbs/".length)));
        const v = await env.FOOD.get("t:" + name, "arrayBuffer");
        if (!v) return new Response("404", { status: 404, headers: CORS });
        return new Response(v, {
          headers: { ...CORS, "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400" }
        });
      }
      if (path.startsWith("/images/")) {
        const name = safeName(decodeURIComponent(path.slice("/images/".length)));
        const v = await env.FOOD.get("p:" + name, "arrayBuffer");
        if (!v) return new Response("404", { status: 404, headers: CORS });
        return new Response(v, {
          headers: { ...CORS, "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400" }
        });
      }

      /* ── 状态 ── */
      if (path === "/api/state") {
        if (request.method === "GET") {
          const s = await env.FOOD.get("state");
          return new Response(s || "{}", {
            headers: { ...CORS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
          });
        }
        if (request.method === "POST") {
          const body = await request.text();
          JSON.parse(body);
          await env.FOOD.put("state", body);
          return json({ ok: true });
        }
        return json({ error: "method" }, 405);
      }

      /* ── 照片列表 ── */
      if (path === "/api/photos" && request.method === "GET") {
        const out = {};
        let cursor;
        const covers = {};
        do {
          const page = await env.FOOD.list({ prefix: "p:", cursor, limit: 1000 });
          for (const k of page.keys) {
            const name = k.name.slice(2);
            const id = idOf(name);
            (out[id] = out[id] || []).push(name);
          }
          cursor = page.list_complete ? undefined : page.cursor;
        } while (cursor);

        const coverKeys = await env.FOOD.list({ prefix: "cover:" });
        for (const k of coverKeys.keys) covers[k.name.slice(6)] = await env.FOOD.get(k.name);

        const origin = url.origin;
        const photos = {};
        for (const id of Object.keys(out)) {
          out[id].sort();
          const c = covers[id];
          if (c) {
            const i = out[id].indexOf(c);
            if (i > 0) out[id].unshift(out[id].splice(i, 1)[0]);
          }
          photos[id] = out[id].map((n) => origin + "/images/" + encodeURIComponent(n));
        }
        return new Response(JSON.stringify({ photos }), {
          headers: { ...CORS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
        });
      }

      /* ── 上传 / 删除 / 封面 ── */
      const isPhoto = path === "/api/photos";
      const isThumb = path === "/api/thumbs";
      if (isPhoto || isThumb) {
        const name = safeName(url.searchParams.get("name"));
        if (!name || !IMG_RE.test(name)) return json({ error: "bad name" }, 400);

        if (request.method === "POST") {
          const buf = await request.arrayBuffer();
          if (buf.byteLength > 25 * 1024 * 1024) return json({ error: "too large" }, 413);
          await env.FOOD.put((isThumb ? "t:" : "p:") + name, buf);
          return json({ ok: true, url: url.origin + (isThumb ? "/images/thumbs/" : "/images/") + encodeURIComponent(name) });
        }
        if (request.method === "DELETE") {
          if (isThumb) {
            await env.FOOD.delete("t:" + name);
          } else {
            await env.FOOD.delete("p:" + name);
            await env.FOOD.delete("t:" + name);
          }
          return json({ ok: true });
        }
        return json({ error: "method" }, 405);
      }

      if (path === "/api/cover" && request.method === "POST") {
        const name = safeName(url.searchParams.get("name"));
        if (!name) return json({ error: "bad name" }, 400);
        const exists = await env.FOOD.get("p:" + name);
        if (!exists) return json({ error: "not found" }, 404);
        const id = idOf(name);
        await env.FOOD.put("cover:" + id, name);
        return json({ ok: true, id, cover: name });
      }

      return json({ error: "not found" }, 404);
    } catch (e) {
      return json({ error: String(e && e.message || e) }, 500);
    }
  }
};
