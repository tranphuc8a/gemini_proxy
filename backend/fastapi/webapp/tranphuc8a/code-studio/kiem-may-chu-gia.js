/* kiem-may-chu-gia.js — máy chủ /codestore GIẢ (trong bộ nhớ) cho kiem-luu.js, mô phỏng đúng hợp đồng ở docs/code-studio-api.md:
   không gian = workspaceId + khoá X-Codestore-Key, mỗi kho (?backend=) một nơi riêng, PUT gộp LWW theo từng bản ghi (bia mộ thắng khi
   hoà), GET ?since= so với serverUpdatedAt, serverTime lùi 2 giây / là con trỏ khi more:true, giới hạn, mã lỗi trong data.code.
   Không phải bộ test: chỉ là công cụ. Dùng: const srv = require("./kiem-may-chu-gia.js")(CS, {clock, pageItems}); srv.fetch(url, init). */
"use strict";
module.exports = function makeServer(CS, o) {
  o = o || {};
  const P = CS.project;
  const clock = o.clock || { t: 1790000000000 };         // đồng hồ máy chủ; test tự nhích
  const DAY = 24 * 3600 * 1000;
  const srv = {
    clock, pageItems: o.pageItems || 200, maxItems: o.maxItems || 2000, backends: ["json", "mysql", "mongo"],
    workspaces: new Map(),            // `${backend}/${id}` → {id, backend, key, items: Map(id → item + serverUpdatedAt)}
    log: [], calls: 0, hooks: [], offline: false, rejectIds: new Set(), seq: 0
  };

  function res(status, body, headers) {
    const h = {}; Object.keys(headers || {}).forEach((k) => { h[k.toLowerCase()] = String(headers[k]); });
    const text = body === undefined ? "" : JSON.stringify(body);
    return { status, ok: status >= 200 && status < 300, headers: { get: (k) => (h[String(k).toLowerCase()] !== undefined ? h[String(k).toLowerCase()] : null) }, text: async () => text, json: async () => JSON.parse(text) };
  }
  function err(status, code, message, extra, headers) { return res(status, { status_code: status, message, data: Object.assign({ code }, extra || {}) }, headers); }
  srv.err = err; srv.res = res;

  /** Lỗi chèn trước: srv.failNext(n, spec) · spec: "network" | {status, code, message, headers, data} | (req) → res */
  srv.failNext = function (n, spec) { srv.hooks.push({ left: n, spec, pred: null }); };
  srv.failWhen = function (pred, spec, times) { srv.hooks.push({ left: times === undefined ? Infinity : times, spec, pred }); };
  srv.clearFaults = function () { srv.hooks.length = 0; };
  srv.requests = (method, path) => srv.log.filter((r) => (!method || r.method === method) && (!path || r.path === path));

  function wins(newU, newDel, oldU, oldDel) { return newU !== oldU ? newU > oldU : !!(newDel && !oldDel); }
  function wsOf(id, backend) { return srv.workspaces.get(backend + "/" + id); }
  srv.snapshot = function (id, backend) {
    const w = wsOf(id, backend || "json");
    return w ? Array.from(w.items.values()).map((x) => JSON.parse(JSON.stringify(x))) : null;
  };
  srv.live = function (id, backend) { return (srv.snapshot(id, backend) || []).filter((x) => !x.deleted); };

  function checkItem(it, now) {
    const bad = (m) => err(400, "codestore_bad_item", m, { itemId: it && it.id });
    if (!it || typeof it !== "object" || typeof it.id !== "string" || !/^[A-Za-z0-9_.:-]{1,80}$/.test(it.id)) return err(422, "http_422", "id sai");
    if (it.kind !== "snippet" && it.kind !== "project") return err(422, "http_422", "kind sai");
    if (typeof it.updatedAt !== "number" || it.updatedAt < 0) return err(422, "http_422", "updatedAt sai");
    if (it.updatedAt > now + DAY) return err(400, "codestore_bad_clock", "Đồng hồ thiết bị lệch hơn 1 ngày", { itemId: it.id });
    if (srv.rejectIds.has(it.id)) return bad("Từ chối theo yêu cầu của bài kiểm");
    if (it.deleted) return null;
    if (!Array.isArray(it.files) || !it.files.length) return bad("Bản ghi cần ít nhất một tệp");
    if (it.kind === "snippet" && it.files.length !== 1) return bad("Đoạn mã chỉ gồm đúng một tệp");
    const paths = [];
    for (const f of it.files) { try { paths.push(P.normPath(f.path, { store: true })); } catch (e) { return bad(e.message); } }
    const c = P.findConflict(paths);
    if (c) return bad(c);
    if (P.itemBytes(it) > 512 * 1024) return bad("Bản ghi quá lớn (tối đa 524288 byte)");
    return null;
  }

  function handle(method, url, headers, body) {
    const u = new URL(url);
    const m = /^\/api\/v1\/codestore(\/.*)?$/.exec(u.pathname);
    if (!m) return err(404, "http_404", "Không có đường dẫn này");
    const rest = m[1] || "", q = Object.fromEntries(u.searchParams.entries()), backend = q.backend || "json";
    const rec = { method, path: /^\/[^/]+\/items$/.test(rest) ? "/items" : (rest === "/backends" || rest === "/workspaces" ? rest : "/ws"), query: q, key: headers["X-Codestore-Key"] || "", ws: "", ids: [] };
    srv.log.push(rec);
    if (rest === "/backends" && method === "GET")
      return res(200, { default: "json", backends: srv.backends.map((id) => ({ id, label: id, available: id !== "mongo", reason: id === "mongo" ? "Máy chủ chưa cấu hình MongoDB" : "", persistent: id !== "json" })) });
    if (rest === "/workspaces" && method === "POST") {
      if (srv.backends.indexOf(backend) < 0) return err(400, "codestore_bad_backend", "Kho lưu trữ phải là một trong: json, mysql, mongo");
      if (backend === "mongo") return err(503, "codestore_backend_unavailable", "Kho MongoDB chưa được cấu hình trên máy chủ này");
      const id = "cs_t" + (++srv.seq), key = "key" + srv.seq + "_" + Math.floor(srv.clock.t % 100000);
      srv.workspaces.set(backend + "/" + id, { id, backend, key, items: new Map() });
      return res(201, { workspaceId: id, key });
    }
    const mm = /^\/([A-Za-z0-9_-]{1,64})(\/items)?$/.exec(rest);
    if (!mm) return err(404, "http_404", "Không có đường dẫn này");
    const id = mm[1], isItems = !!mm[2];
    rec.ws = id;
    const w = wsOf(id, backend);
    if (!w) return err(404, "codestore_not_found", "Không gian làm việc không tồn tại");
    const key = headers["X-Codestore-Key"] || (/^bearer /i.test(headers.Authorization || "") ? headers.Authorization.slice(7) : "");
    if (!key) return err(401, "codestore_key_required", "Thiếu header X-Codestore-Key");
    if (key !== w.key) return err(401, "codestore_bad_key", "Khoá không đúng");
    if (!isItems) {
      if (method !== "DELETE") return err(405, "http_405", "Sai phương thức");
      srv.workspaces.delete(backend + "/" + id);
      return res(200, { deleted: true });
    }
    if (method === "GET") {
      const since = Number(q.since || 0), limit = q.limit ? Number(q.limit) : undefined;
      if (!(since >= 0) || since > 4102444800000) return err(422, "http_422", "since sai");
      if (limit !== undefined && !(limit >= 1 && limit <= 500)) return err(422, "http_422", "limit sai");
      const size = Math.min(limit || srv.pageItems, srv.pageItems);
      const found = Array.from(w.items.values()).filter((x) => x.serverUpdatedAt > since).sort((a, b) => a.serverUpdatedAt - b.serverUpdatedAt || (a.id < b.id ? -1 : 1)).slice(0, size + 1);
      const more = found.length > size, page = found.slice(0, size);
      rec.ids = page.map((x) => x.id);
      return res(200, { items: JSON.parse(JSON.stringify(page)), serverTime: more && page.length ? page[page.length - 1].serverUpdatedAt : Math.max(since, srv.clock.t - 2000), more });
    }
    if (method === "PUT") {
      const items = body && body.items;
      if (!Array.isArray(items) || items.length > 100) return err(422, "http_422", "quá 100 bản ghi");
      rec.ids = items.map((x) => x && x.id);
      const now = srv.clock.t, winners = new Map(), order = [];
      let total = 0;
      for (const it of items) {
        const bad = checkItem(it, now);
        if (bad) return bad;
        total += P.itemBytes(it);
        if (total > 2 * 1024 * 1024) return err(400, "codestore_too_large", "Yêu cầu quá lớn (tối đa 2097152 byte)");
        const held = winners.get(it.id);
        if (!held) { order.push(it.id); winners.set(it.id, it); } else if (wins(it.updatedAt, !!it.deleted, held.updatedAt, !!held.deleted)) winners.set(it.id, it);
      }
      const fresh = order.filter((i) => !w.items.has(i)).length;
      if (w.items.size + fresh > srv.maxItems) return err(400, "codestore_workspace_full", "Không gian làm việc đã đầy", { limit: srv.maxItems });
      order.forEach((iid, index) => {
        const it = winners.get(iid), old = w.items.get(iid);
        if (old && !wins(it.updatedAt, !!it.deleted, old.updatedAt, !!old.deleted)) return;
        const clean = it.deleted ? { id: it.id, kind: it.kind, name: it.name || "", language: it.language || "", files: [], meta: {}, updatedAt: it.updatedAt, deleted: true }
          : { id: it.id, kind: it.kind, name: (it.name || "").trim(), language: it.language || "", files: it.files.map((f) => ({ path: P.normPath(f.path, { store: true }), content: f.content })), meta: it.meta || {}, updatedAt: it.updatedAt, deleted: false };
        clean.serverUpdatedAt = now + index;
        w.items.set(iid, clean);
      });
      srv.clock.t += order.length + 1;                  // thời gian trôi: các lần ghi sau có serverUpdatedAt lớn hơn
      return res(200, { items: order.map((iid) => JSON.parse(JSON.stringify(w.items.get(iid)))), serverTime: srv.clock.t - 2000 });
    }
    return err(405, "http_405", "Sai phương thức");
  }

  srv.fetch = async function (url, init) {
    init = init || {};
    srv.calls++; srv.lastUrl = url;
    if (srv.offline) throw new TypeError("Failed to fetch");
    const method = (init.method || "GET").toUpperCase(), headers = init.headers || {};
    let body; try { body = init.body ? JSON.parse(init.body) : undefined; } catch (e) { return err(422, "http_422", "JSON sai"); }
    srv.clock.t += 1;
    const info = { method, url, headers, body, n: srv.log.length + 1 };
    for (const h of srv.hooks) {
      if (h.left <= 0) continue;
      if (h.pred && !h.pred(info)) continue;
      h.left--;
      if (h.spec === "network") throw new TypeError("Failed to fetch");
      if (typeof h.spec === "function") { const r = h.spec(info); if (r) return r; continue; }
      return err(h.spec.status || 500, h.spec.code || "http_" + (h.spec.status || 500), h.spec.message || "Lỗi giả lập", h.spec.data, h.spec.headers);
    }
    return handle(method, url, headers, body);
  };
  return srv;
};
