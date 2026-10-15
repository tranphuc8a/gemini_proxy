/* store.js — lưu trữ cục bộ + đồng bộ máy chủ cho Code Studio (không DOM; kiểm bằng node: kiem-luu.js, kiem-tich-hop.js).

   CS.store.kv       lớp khoá–giá trị thay được, mọi hàm trả Promise: memory() · local(prefix) · idb(dbName) · auto({idb, local})
                     giao diện: get(key) → giá trị|undefined · set(key, value JSON-able) · del(key) · keys(prefix) → [key]
   CS.store.library  thư viện đoạn mã/dự án trên một kv: mỗi item một khoá `item:<id>`, chỉ mục nhẹ `index`, tập dirty `dirty`.
                     Bản sao đầy đủ của mọi item nằm trong bộ nhớ sau `ready`. list()/get(id)/put/remove/importJson/markClean/applyRemote…
                     trả Promise và cùng xếp hàng (không mất bản ghi khi gọi dồn; đọc thấy ngay thứ vừa ghi). Đồng bộ (không đợi hàng):
                     listSync()/getSync(id)/exportJson()/stats()/dirty() — chỉ dùng sau `await ready`.
   CS.store.sync     đồng bộ với /codestore (không gian làm việc = workspaceId + khoá X-Codestore-Key): đẩy item dirty theo lô,
                     kéo bản mới theo con trỏ serverTime, gộp last-writer-wins (bia mộ thắng khi hoà). Không có không gian →
                     "chỉ máy này": mọi thứ cục bộ vẫn chạy. Hợp đồng máy chủ: docs/code-studio-api.md.
   Item = item của CS.project / /codestore: {id, kind, name, language, files:[{path, content}], meta, updatedAt, deleted}. */
(function (root) {
  "use strict";
  var CS = root.CS || (root.CS = {});

  /* ------------------------------------------------------------------ tiện ích */
  function noop() { /* bỏ qua */ }
  function fail(msg, code) { var e = new Error(msg); e.code = code || "store"; return e; }
  function isObj(v) { return !!v && typeof v === "object" && !Array.isArray(v); }
  function cloneJson(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
  function run(fn) { return new Promise(function (resolve) { resolve(fn()); }); }   // ném đồng bộ → từ chối Promise
  function P() { if (!CS.project) throw fail("Thiếu mô-đun dự án (project.js) — nạp project.js trước store.js", "no_project"); return CS.project; }
  function startsWith(s, p) { return s.slice(0, p.length) === p; }
  /** JSON với khoá sắp xếp: so sánh nội dung không phụ thuộc thứ tự khoá (MySQL JSON có thể xáo khoá). */
  function stable(v) {
    if (Array.isArray(v)) return "[" + v.map(stable).join(",") + "]";
    if (v && typeof v === "object") return "{" + Object.keys(v).sort().filter(function (k) { return v[k] !== undefined; }).map(function (k) { return JSON.stringify(k) + ":" + stable(v[k]); }).join(",") + "}";
    return JSON.stringify(v === undefined ? null : v);
  }
  var ID_RE = /^[A-Za-z0-9_.:-]{1,80}$/;
  var DAY = 24 * 3600 * 1000;
  var FUTURE_MS = 20 * 3600 * 1000;       // bản chưa đồng bộ ở xa tương lai hơn mức này coi như do đồng hồ lệch

  /* ================================================================== kv */
  function memory() {
    var m = Object.create(null);
    return {
      kind: "memory", persistent: false,
      get: function (key) { return run(function () { return key in m ? JSON.parse(m[key]) : undefined; }); },
      set: function (key, value) { return run(function () { if (value === undefined) delete m[key]; else m[key] = JSON.stringify(value); }); },
      del: function (key) { return run(function () { delete m[key]; }); },
      keys: function (prefix) { return run(function () { var p = prefix || ""; return Object.keys(m).filter(function (k) { return startsWith(k, p); }).sort(); }); }
    };
  }

  /**
   * localStorage (khoá = prefix + key). localStorage bị chặn (cửa sổ riêng tư…) → chạy bằng bộ nhớ, `persistent` = false.
   * Ghi lỗi (đầy bộ nhớ) → giá trị vẫn đọc lại được trong phiên (lớp phủ trong bộ nhớ), `persistent` = false và `error` có thông báo
   * cho tới khi mọi thứ ghi lại được. opts.storage: thay localStorage (để test).
   */
  function local(prefix, opts) {
    prefix = prefix == null ? "" : String(prefix);
    var store = null, overlay = Object.create(null), error = "";   // overlay[key] = chuỗi JSON | null (đã xoá)
    try {
      var s = (opts && opts.storage) || root.localStorage;
      if (s) { s.setItem(prefix + "__probe__", "1"); s.removeItem(prefix + "__probe__"); store = s; }
    } catch (e) { store = null; }
    if (!store) error = "Trình duyệt chặn lưu trữ cục bộ — dữ liệu chỉ giữ trong phiên này";
    function degrade(e) { error = "Không ghi được vào bộ nhớ của trình duyệt (" + ((e && (e.name || e.message)) || "lỗi") + ") — dữ liệu chỉ giữ trong phiên này"; }
    var self = {
      kind: "local",
      get persistent() { return !!store && !Object.keys(overlay).length; },
      get error() { return Object.keys(overlay).length || !store ? error : ""; },
      get: function (key) {
        return run(function () {
          if (key in overlay) return overlay[key] === null ? undefined : JSON.parse(overlay[key]);
          if (!store) return undefined;
          var raw;
          try { raw = store.getItem(prefix + key); } catch (e) { degrade(e); return undefined; }
          if (raw == null) return undefined;
          try { return JSON.parse(raw); } catch (e) { return undefined; }     // mục hỏng coi như không có
        });
      },
      set: function (key, value) {
        return run(function () {
          if (value === undefined) return self.del(key);
          var text = JSON.stringify(value);
          if (store) {
            try { store.setItem(prefix + key, text); delete overlay[key]; return; } catch (e) { degrade(e); }
          }
          overlay[key] = text;
        });
      },
      del: function (key) {
        return run(function () {
          var stored = false;
          if (store) { try { store.removeItem(prefix + key); stored = true; } catch (e) { degrade(e); } }
          if (stored) delete overlay[key]; else overlay[key] = null;
        });
      },
      keys: function (p) {
        return run(function () {
          var want = p || "", out = Object.create(null);
          if (store) {
            try {
              for (var i = 0; i < store.length; i++) {
                var k = store.key(i);
                if (k && startsWith(k, prefix + want)) out[k.slice(prefix.length)] = 1;
              }
            } catch (e) { degrade(e); }
          }
          Object.keys(overlay).forEach(function (k) { if (!startsWith(k, want)) return; if (overlay[k] === null) delete out[k]; else out[k] = 1; });
          return Object.keys(out).filter(function (k) { return k !== "__probe__"; }).sort();
        });
      }
    };
    return self;
  }

  /**
   * IndexedDB (một object store "kv", giá trị lưu dạng chuỗi JSON). Không có IndexedDB → NÉM LỖI ĐỒNG BỘ; mở/ghi hỏng →
   * `ready` từ chối và mọi lời gọi từ chối (code "idb_open") để app rơi về local(). opts.indexedDB: thay root.indexedDB (test).
   */
  function idb(dbName, opts) {
    var factory = (opts && opts.indexedDB) || root.indexedDB;
    if (!factory) throw fail("Trình duyệt không có IndexedDB", "no_idb");
    var STORE = "kv", dbp = null;
    function open() {
      if (dbp) return dbp;
      var p = new Promise(function (resolve, reject) {
        var req;
        try { req = factory.open(String(dbName || "code-studio"), 1); } catch (e) { reject(openError(e)); return; }
        req.onupgradeneeded = function () { var db = req.result; if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE); };
        req.onsuccess = function () {
          var db = req.result;
          db.onversionchange = function () { try { db.close(); } catch (e) { /* đã đóng */ } dbp = null; };
          resolve(db);
        };
        req.onerror = function () { reject(openError(req.error)); };
        req.onblocked = noop;
      });
      p.catch(function () { if (dbp === p) dbp = null; });
      dbp = p;
      return p;
    }
    function openError(e) { var x = fail("Không mở được IndexedDB" + (e && e.message ? ": " + e.message : ""), "idb_open"); x.cause = e; return x; }
    function tx(mode, fn) {
      return open().then(function (db) {
        return new Promise(function (resolve, reject) {
          var t, out;
          try { t = db.transaction(STORE, mode); } catch (e) { reject(openError(e)); return; }
          t.oncomplete = function () { resolve(out); };
          t.onerror = function () { reject(t.error || fail("IndexedDB lỗi", "idb_tx")); };
          t.onabort = function () { reject(t.error || fail("IndexedDB huỷ giao dịch", "idb_tx")); };
          try { fn(t.objectStore(STORE), function (v) { out = v; }); } catch (e) { reject(e); try { t.abort(); } catch (e2) { /* bỏ qua */ } }
        });
      });
    }
    var self = {
      kind: "idb", persistent: true,
      get: function (key) {
        return tx("readonly", function (st, ret) { var r = st.get(key); r.onsuccess = function () { ret(typeof r.result === "string" ? safeParse(r.result) : undefined); }; });
      },
      set: function (key, value) {
        if (value === undefined) return self.del(key);
        return run(function () { return JSON.stringify(value); }).then(function (text) { return tx("readwrite", function (st) { st.put(text, key); }); });
      },
      del: function (key) { return tx("readwrite", function (st) { st.delete(key); }); },
      keys: function (prefix) {
        var p = prefix || "";
        return tx("readonly", function (st, ret) {
          var range = p ? root.IDBKeyRange.bound(p, p + "￿") : null, r = st.getAllKeys(range);
          r.onsuccess = function () { ret((r.result || []).map(String).sort()); };
        });
      }
    };
    self.ready = open().then(function () { return self; });
    self.ready.catch(noop);
    return self;
  }
  function safeParse(text) { try { return JSON.parse(text); } catch (e) { return undefined; } }

  /** Thử IndexedDB (mở + ghi thử) → localStorage → bộ nhớ. opts: {idb: "tên", local: "tiền tố", indexedDB, storage}. → Promise<kv> */
  function auto(opts) {
    opts = opts || {};
    function fallback() { return local(opts.local == null ? "cs:data:" : opts.local, { storage: opts.storage }); }
    var kv;
    try { kv = idb(opts.idb || "code-studio", { indexedDB: opts.indexedDB }); } catch (e) { return Promise.resolve(fallback()); }
    return kv.ready.then(function () { return kv.set("__probe__", 1); }).then(function () { return kv.del("__probe__"); }).then(function () { return kv; }, function () { return fallback(); });
  }

  /* ================================================================== library */
  /**
   * Thư viện trên một kv. opts: {kv (mặc định memory()), now: () → ms (mặc định Date.now)}.
   * Khoá kv: `index` ({v:1, items:{id:[updatedAt, deleted, byte]}}), `dirty` ([id…]), `item:<id>`.
   * Thứ tự ghi khi đổi một item: dirty → item → index — mất điện giữa chừng chỉ để lại cờ dirty thừa (vô hại) hoặc item chưa vào
   * chỉ mục (ready quét `item:*` nên vẫn nhặt lại).
   */
  function library(opts) {
    opts = opts || {};
    var kv = opts.kv || memory();
    var clockOpt = opts.now;
    function clock() { var t = typeof clockOpt === "function" ? clockOpt() : typeof clockOpt === "number" ? clockOpt : Date.now(); return Math.floor(+t) || 0; }
    var items = Object.create(null);          // id → item (kể cả bia mộ)
    var idx = Object.create(null);            // id → [updatedAt, deleted, byte]
    var dirtySet = Object.create(null);       // id → 1
    var listeners = [];
    var tail = Promise.resolve();

    function emit(ev) { listeners.slice().forEach(function (cb) { try { cb(ev); } catch (e) { /* người nghe lỗi không làm hỏng thư viện */ } }); }
    function bytesOf(q) { try { return P().itemBytes(q); } catch (e) { return 0; } }
    function dirtyKeys(set) { return Object.keys(set).sort(); }

    /* nạp: chỉ mục + quét khoá item (nhặt item mồ côi), nạp song song theo nhóm */
    var ready = (function () {
      return run(function () { return kv.get("index"); }).then(function (rawIdx) {
        var ids = Object.create(null);
        if (isObj(rawIdx) && isObj(rawIdx.items)) Object.keys(rawIdx.items).forEach(function (id) { ids[id] = 1; });
        return kv.keys("item:").then(function (found) {
          found.forEach(function (k) { ids[k.slice(5)] = 1; });
          return { rawIdx: rawIdx, ids: Object.keys(ids) };
        });
      }).then(function (st) {
        var chunks = [], ids = st.ids, i;
        for (i = 0; i < ids.length; i += 25) chunks.push(ids.slice(i, i + 25));
        return chunks.reduce(function (chain, group) {
          return chain.then(function () {
            return Promise.all(group.map(function (id) { return kv.get("item:" + id).then(function (raw) { return { id: id, raw: raw }; }, function () { return { id: id, raw: undefined }; }); })).then(function (got) {
              got.forEach(function (g) {
                if (!isObj(g.raw) || g.raw.id !== g.id) return;
                var q;
                try { q = P().normalize(g.raw); } catch (e) { return; }
                if (q.id !== g.id) return;
                items[q.id] = q;
                idx[q.id] = [q.updatedAt, q.deleted ? 1 : 0, bytesOf(q)];
              });
            });
          });
        }, Promise.resolve()).then(function () { return st; });
      }).then(function (st) {
        return kv.get("dirty").then(function (d) {
          if (Array.isArray(d)) d.forEach(function (id) { if (typeof id === "string" && items[id]) dirtySet[id] = 1; });
          return st;
        });
      }).then(function (st) {
        /* bia mộ cũ đã đồng bộ (quá 120 ngày) không còn tác dụng: dọn */
        var cutoff = clock() - 120 * DAY, drop = Object.keys(items).filter(function (id) { return items[id].deleted && !dirtySet[id] && items[id].updatedAt < cutoff; });
        drop.forEach(function (id) { delete items[id]; delete idx[id]; });
        var same = isObj(st.rawIdx) && isObj(st.rawIdx.items) && stable(st.rawIdx.items) === stable(idx);
        return Promise.all(drop.map(function (id) { return kv.del("item:" + id); })).then(function () { return same ? null : kv.set("index", { v: 1, items: idx }); });
      }).then(function () { return api; });
    })();
    ready.catch(noop);

    /** Xếp hàng: mỗi việc chạy sau khi việc trước xong và sau `ready`; lỗi của một việc không chặn việc sau. */
    function enqueue(fn) {
      var job = tail.then(function () { return ready; }).then(fn);
      tail = job.then(noop, noop);
      return job;
    }
    /** Ghi một lô: [{q, dirty: true|false|undefined}] → dirty, từng item, rồi chỉ mục; chỉ đổi bộ nhớ khi ghi xong. */
    function commitMany(list) {
      var nd = Object.assign(Object.create(null), dirtySet), ni = Object.assign(Object.create(null), idx);
      list.forEach(function (u) {
        if (u.dirty === true) nd[u.q.id] = 1; else if (u.dirty === false) delete nd[u.q.id];
        ni[u.q.id] = [u.q.updatedAt, u.q.deleted ? 1 : 0, bytesOf(u.q)];
      });
      return kv.set("dirty", dirtyKeys(nd)).then(function () {
        return list.reduce(function (chain, u) { return chain.then(function () { return kv.set("item:" + u.q.id, u.q); }); }, Promise.resolve());
      }).then(function () { return kv.set("index", { v: 1, items: ni }); }).then(function () {
        list.forEach(function (u) { items[u.q.id] = u.q; });
        idx = ni; dirtySet = nd;
      });
    }
    function copy(q) { return P().clone(q); }

    /** Đọc đồng bộ từ bộ nhớ (chỉ đúng sau `ready` và sau khi các put đang chờ đã xong): bỏ bia mộ, ghim lên đầu rồi mới → cũ. */
    function listSync() {
      var arr = Object.keys(items).map(function (id) { return items[id]; }).filter(function (x) { return !x.deleted; });
      arr.sort(function (a, b) {
        var pa = a.meta && a.meta.pinned ? 1 : 0, pb = b.meta && b.meta.pinned ? 1 : 0;
        if (pa !== pb) return pb - pa;
        if (a.updatedAt !== b.updatedAt) return b.updatedAt - a.updatedAt;
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      });
      return arr.map(copy);
    }
    /** Bản ghi theo id (kể cả bia mộ, deleted:true), hoặc null. Đồng bộ. */
    function getSync(id) { var q = items[id]; return q ? copy(q) : null; }
    /** Promise<danh sách>: đợi `ready` và mọi put/remove/… đã gọi trước đó (đọc thấy ngay thứ vừa ghi, kể cả khi chưa await put). */
    function list() { return enqueue(function () { return listSync(); }); }
    /** Promise<bản ghi | null> (bia mộ trả về với deleted:true). */
    function get(id) { return enqueue(function () { return getSync(id); }); }

    /**
     * Thời điểm sửa mới: max(đồng hồ, cũ + 1) để sửa sau luôn thắng sửa trước. Ngoại lệ: bản cũ CHƯA đồng bộ mà đã ở tương lai xa
     * (đồng hồ máy từng lệch — máy chủ từ chối cả bản đó) thì lấy giờ máy, kẻo mục kẹt mãi sau khi đã chỉnh lại giờ.
     */
    function stamp(old) {
      var now = clock();
      if (!old) return Math.max(now, 1);
      if (dirtySet[old.id] && old.updatedAt - now > FUTURE_MS) return Math.max(now, 1);
      return Math.max(now, old.updatedAt + 1);
    }
    function put(item) {
      return enqueue(function () {
        var q = P().normalize(item), old = items[q.id];
        q.updatedAt = stamp(old);
        return commitMany([{ q: q, dirty: true }]).then(function () { emit({ type: "put", ids: [q.id] }); return copy(q); });
      });
    }
    function remove(id) {
      return enqueue(function () {
        var old = items[id];
        if (!old) return null;
        if (old.deleted) return copy(old);
        var t = { id: old.id, kind: old.kind, name: old.name, language: old.language, files: [], meta: {}, updatedAt: stamp(old), deleted: true };
        return commitMany([{ q: t, dirty: true }]).then(function () { emit({ type: "remove", ids: [id] }); return copy(t); });
      });
    }

    function exportJson() { return JSON.stringify({ app: "code-studio", version: 1, items: listSync() }); }

    /** Một item trong tệp sao lưu → item chuẩn, hoặc null nếu sai (id, tệp, đường dẫn, trùng tên). Không xét kích thước. */
    function prepareImport(raw) {
      if (!isObj(raw) || typeof raw.id !== "string" || !ID_RE.test(raw.id) || raw.deleted === true) return null;
      if (!Array.isArray(raw.files) || !raw.files.length || raw.files.length > P().limits.store.files) return null;
      if (!raw.files.every(function (f) { return isObj(f) && typeof f.path === "string" && (f.content === undefined || typeof f.content === "string"); })) return null;
      var q;
      try { q = P().normalize(raw); } catch (e) { return null; }
      var paths = [];
      try { q.files.forEach(function (f) { paths.push(P().normPath(f.path, { store: true })); }); } catch (e) { return null; }
      if (P().findConflict(paths)) return null;
      q.files = q.files.map(function (f, i) { return { path: paths[i], content: f.content }; });
      if (q.kind === "snippet" && q.files.length !== 1) q.kind = "project";
      q = P().normalize(q);
      if (!(q.updatedAt > 0)) q.updatedAt = clock();
      return q;
    }
    /** Nhập bản sao lưu {app:"code-studio", version:1, items:[…]} (hoặc mảng trần). LWW theo updatedAt: bản cục bộ mới hơn/bằng được giữ. */
    function importJson(text, o) {
      return enqueue(function () {
        var data;
        try { data = JSON.parse(String(text == null ? "" : text).replace(/^﻿/, "")); }
        catch (e) { throw fail("Tệp sao lưu không phải JSON hợp lệ: " + e.message, "bad_backup"); }
        var arr = Array.isArray(data) ? data : (isObj(data) && Array.isArray(data.items) ? data.items : null);
        if (!arr) throw fail("Không phải bản sao lưu của Code Studio (thiếu danh sách items)", "bad_backup");
        if (isObj(data) && data.app !== undefined && data.app !== "code-studio") throw fail("Đây không phải bản sao lưu của Code Studio (app = '" + String(data.app).slice(0, 40) + "')", "bad_backup");
        if (isObj(data) && Number(data.version) > 1) throw fail("Bản sao lưu từ phiên bản mới hơn (" + data.version + ") — hãy cập nhật Code Studio", "bad_backup");
        var skipped = 0, kept = 0, batch = [], seen = Object.create(null);
        arr.forEach(function (raw) {
          var q = prepareImport(raw);
          if (!q) { skipped++; return; }
          var old = seen[q.id] || items[q.id];
          if (old && !(q.updatedAt > old.updatedAt)) { kept++; return; }
          seen[q.id] = q;
          batch = batch.filter(function (u) { return u.q.id !== q.id; });
          batch.push({ q: q, dirty: true });
        });
        if (!batch.length) return { imported: 0, skipped: skipped, kept: kept };
        return commitMany(batch).then(function () {
          emit({ type: "import", ids: batch.map(function (u) { return u.q.id; }) });
          return { imported: batch.length, skipped: skipped, kept: kept };
        });
      });
    }
    function stats() {
      var ids = Object.keys(idx), live = 0, bytes = 0;
      ids.forEach(function (id) { if (!idx[id][1]) live++; bytes += idx[id][2] || 0; });
      return { count: live, tombstones: ids.length - live, dirty: Object.keys(dirtySet).length, bytes: bytes };
    }

    /* ---- cho đồng bộ ---- */
    function dirty() {
      return Object.keys(dirtySet).filter(function (id) { return items[id]; }).map(function (id) { return items[id]; })
        .sort(function (a, b) { return a.updatedAt - b.updatedAt || (a.id < b.id ? -1 : 1); }).map(copy);
    }
    function setDirty(nd) { return kv.set("dirty", dirtyKeys(nd)).then(function () { dirtySet = nd; }); }
    /** Bỏ cờ dirty nếu bản cục bộ chưa đổi kể từ lúc đẩy (updatedAt còn bằng `updatedAt`). → Promise<boolean> */
    function markClean(id, updatedAt) {
      return enqueue(function () {
        if (!dirtySet[id]) return false;
        var cur = items[id];
        if (cur && updatedAt !== undefined && cur.updatedAt !== updatedAt) return false;
        var nd = Object.assign(Object.create(null), dirtySet); delete nd[id];
        return setDirty(nd).then(function () { return true; });
      });
    }
    /** Đánh dấu mọi item (cả bia mộ) cần đẩy — khi nối vào một không gian mới. → Promise<số item> */
    function markAllDirty() {
      return enqueue(function () {
        var nd = Object.create(null);
        Object.keys(items).forEach(function (id) { nd[id] = 1; });
        return setDirty(nd).then(function () { return Object.keys(nd).length; });
      });
    }
    function sameRecord(a, b) {
      if (a.deleted !== b.deleted || a.updatedAt !== b.updatedAt) return false;
      if (a.deleted) return true;
      return stable({ k: a.kind, n: a.name, l: a.language, f: a.files, m: a.meta }) === stable({ k: b.kind, n: b.name, l: b.language, f: b.files, m: b.meta });
    }
    /**
     * Gộp một bản ghi do MÁY CHỦ trả về (GET hoặc "bản đang giữ" của PUT). → Promise<"applied"|"kept-local"|"same">
     *  • chưa có cục bộ, hoặc updatedAt lớn hơn → nhận (xoá cờ dirty: bản cục bộ giờ bằng máy chủ)
     *  • nhỏ hơn → giữ bản cục bộ (nếu nó chưa dirty thì đánh dấu dirty để đẩy lại — máy chủ đang cũ hơn)
     *  • hoà: giống hệt → "same" (xoá dirty); bản cục bộ là bia mộ còn máy chủ là bản sống → giữ bia mộ (cần đẩy); còn lại nhận bản
     *    máy chủ (máy chủ đã phân xử hoà, nhận để mọi thiết bị hội tụ)
     */
    function applyRemote(remote) {
      return enqueue(function () {
        if (!isObj(remote) || typeof remote.id !== "string" || !remote.id) return "kept-local";
        var r;
        try { r = P().normalize(remote); } catch (e) { return "kept-local"; }
        var local = items[r.id];
        function adopt() { return commitMany([{ q: r, dirty: false }]).then(function () { emit({ type: "remote", ids: [r.id] }); return "applied"; }); }
        function markDirty(res) { if (dirtySet[r.id]) return Promise.resolve(res); var nd = Object.assign(Object.create(null), dirtySet); nd[r.id] = 1; return setDirty(nd).then(function () { return res; }); }
        if (!local) return adopt();
        if (r.updatedAt > local.updatedAt) return adopt();
        if (r.updatedAt < local.updatedAt) return markDirty("kept-local");
        if (sameRecord(local, r)) {
          if (!dirtySet[r.id]) return "same";
          var nd = Object.assign(Object.create(null), dirtySet); delete nd[r.id];
          return setDirty(nd).then(function () { return "same"; });
        }
        if (local.deleted && !r.deleted) return markDirty("kept-local");
        return adopt();
      });
    }

    function onChange(cb) {
      if (typeof cb !== "function") return noop;
      listeners.push(cb);
      return function () { var i = listeners.indexOf(cb); if (i >= 0) listeners.splice(i, 1); };
    }

    var api = { kv: kv, ready: ready, list: list, get: get, listSync: listSync, getSync: getSync, put: put, remove: remove, onChange: onChange, exportJson: exportJson, importJson: importJson,
      stats: stats, dirty: dirty, markClean: markClean, markAllDirty: markAllDirty, applyRemote: applyRemote };
    return api;
  }

  /* ================================================================== sync */
  var BATCH_ITEMS = 100, BATCH_BYTES = 1800000, PAGE_LIMIT = 200, MAX_PASSES = 3, MAX_PAGES = 5000;

  function syncError(msg, code, extra) {
    var e = new Error(msg); e.code = code;
    if (extra) Object.keys(extra).forEach(function (k) { e[k] = extra[k]; });
    return e;
  }
  /** Phản hồi lỗi HTTP → Error tiếng Việt (e.code = data.code, e.status, e.retryAfter giây, e.itemId). */
  function httpError(res, body) {
    var status = res.status, d = isObj(body) && isObj(body.data) ? body.data : {}, code = d.code || "http_" + status, server = isObj(body) && typeof body.message === "string" ? body.message : "";
    var ra = 0;
    try { ra = Number(res.headers && res.headers.get && res.headers.get("Retry-After")) || 0; } catch (e) { ra = 0; }
    if (!ra && Number(d.retryAfter) > 0) ra = Number(d.retryAfter);
    var msg;
    if (code === "codestore_rate_limited" || status === 429) msg = ra > 0 ? "Gửi quá nhanh, thử lại sau " + Math.ceil(ra) + " giây" : "Gửi quá nhanh, hãy thử lại sau ít phút";
    else if (code === "codestore_key_required") msg = "Thiếu khoá của không gian";
    else if (code === "codestore_bad_key" || status === 401) msg = "Khoá không đúng";
    else if (code === "codestore_not_found" || status === 404) msg = "Không tìm thấy không gian";
    else if (code === "codestore_bad_clock") msg = "Đồng hồ máy lệch quá 1 ngày so với máy chủ — hãy chỉnh lại giờ máy rồi đồng bộ lại";
    else if (code === "codestore_too_large" || status === 413) msg = "Dữ liệu gửi lên quá lớn";
    else if (code === "codestore_workspace_full") msg = "Không gian đã đầy (tối đa 2000 mục kể cả bia mộ) — hãy xoá bớt đoạn mã/dự án cũ";
    else if (code === "codestore_bad_item") msg = "Máy chủ từ chối một mục" + (d.itemId ? " (" + d.itemId + ")" : "") + (server ? ": " + server : "");
    else if (code === "codestore_bad_backend") msg = "Kho lưu trữ đã chọn không hợp lệ";
    else if (code === "codestore_backend_unavailable" || status === 503) msg = "Kho lưu trữ này chưa dùng được trên máy chủ" + (server ? " (" + server + ")" : "");
    else if (status === 422) msg = "Máy chủ từ chối dữ liệu (sai định dạng)";
    else if (status >= 500) msg = "Máy chủ đang gặp sự cố (HTTP " + status + ")";
    else msg = server || "Lỗi HTTP " + status;
    return syncError(msg, code, { status: status, retryAfter: ra, itemId: d.itemId, serverMessage: server });
  }

  /**
   * Đồng bộ. opts: {library, kv (mặc định library.kv), fetch, apiBase ("/api/v1"), backend ("json"|"mysql"|"mongo"), now,
   * isOnline: () → bool (mặc định navigator.onLine)}. Khoá kv: `sync:state` = {workspaceId, key, backend, cursor}.
   * Lỗi mạng → status "offline"; lỗi HTTP → "error" (+ lastError tiếng Việt); syncNow từ chối với Error có .code/.status.
   * Không bao giờ làm mất sửa đổi cục bộ: item chỉ hết dirty khi máy chủ xác nhận.
   */
  function sync(opts) {
    opts = opts || {};
    var lib = opts.library;
    if (!lib) throw fail("sync cần library", "no_library");
    var kv = opts.kv || lib.kv;
    var apiBase = String(opts.apiBase || "").replace(/\/+$/, "");
    var fetchFn = opts.fetch || (root.fetch ? root.fetch.bind(root) : null);
    function clock() { var t = typeof opts.now === "function" ? opts.now() : typeof opts.now === "number" ? opts.now : Date.now(); return Math.floor(+t) || 0; }
    var state = { workspaceId: "", key: "", backend: opts.backend || "", cursor: 0 };
    var status = "idle", lastError = "", retryUntil = 0, epoch = 0, disposed = false, running = null;
    var listeners = [];

    function setStatus(s, err) {
      var e = err || "";
      if (s === status && e === lastError) return;
      status = s; lastError = e;
      listeners.slice().forEach(function (cb) { try { cb(status, lastError); } catch (x) { /* bỏ qua */ } });
    }
    function persist() { return state.workspaceId ? kv.set("sync:state", { workspaceId: state.workspaceId, key: state.key, backend: state.backend, cursor: state.cursor }) : kv.del("sync:state"); }
    var ready = run(function () { return kv.get("sync:state"); }).then(function (s) {
      if (isObj(s) && typeof s.workspaceId === "string" && s.workspaceId && typeof s.key === "string" && s.key) {
        state.workspaceId = s.workspaceId; state.key = s.key;
        if (typeof s.backend === "string") state.backend = s.backend;
        state.cursor = Number(s.cursor) >= 0 ? Number(s.cursor) : 0;
      }
      return api;
    });
    ready.catch(noop);

    function offline() {
      if (typeof opts.isOnline === "function") return !opts.isOnline();
      var nav = root.navigator;
      return !!nav && nav.onLine === false;
    }
    function connected() { return !!(state.workspaceId && state.key); }

    /** Một lời gọi HTTP → JSON đã phân tích. Ném Error tiếng Việt: "offline" (mạng) hoặc theo data.code. */
    function http(method, path, o) {
      o = o || {};
      if (offline()) return Promise.reject(syncError("Không có kết nối mạng — sẽ đồng bộ lại khi có mạng", "offline"));
      if (typeof fetchFn !== "function") return Promise.reject(syncError("Trình duyệt không có fetch", "no_fetch"));
      var q = [], b = o.backend !== undefined ? o.backend : state.backend;
      if (b) q.push("backend=" + encodeURIComponent(b));
      Object.keys(o.query || {}).forEach(function (k) { q.push(k + "=" + encodeURIComponent(o.query[k])); });
      var url = apiBase + "/codestore" + path + (q.length ? "?" + q.join("&") : "");
      var headers = { Accept: "application/json" };
      var key = o.key !== undefined ? o.key : state.key;
      if (!o.noKey && key) headers["X-Codestore-Key"] = key;
      var init = { method: method, headers: headers };
      if (o.body !== undefined) { headers["Content-Type"] = "application/json"; init.body = JSON.stringify(o.body); }
      return new Promise(function (resolve) { resolve(fetchFn(url, init)); }).then(function (res) {
        return Promise.resolve(res.text ? res.text() : res.json().then(JSON.stringify)).catch(function () { return ""; }).then(function (text) {
          var body = null;
          try { body = text ? JSON.parse(text) : null; } catch (e) { body = null; }
          if (res.status >= 200 && res.status < 300) return body;
          throw httpError(res, body);
        });
      }, function () { throw syncError("Không có kết nối mạng — sẽ đồng bộ lại khi có mạng", "offline"); });
    }
    function wsPath() { return "/" + encodeURIComponent(state.workspaceId) + "/items"; }

    /* ---- đẩy ---- */
    function describe(it) { return '"' + (it.name || it.id) + '"'; }
    function kbOf(n) { return Math.round(n / 102.4) / 10 + " KB"; }
    /** Chia dirty thành lô hợp lệ + danh sách bị loại (quá lớn / không hợp lệ). */
    function plan(dirty) {
      var P_ = P(), batches = [], cur = [], curBytes = 0, skipped = [], maxItem = P_.limits.store.itemBytes;
      dirty.forEach(function (it) {
        var size = P_.itemBytes(it);
        if (!it.deleted && size > maxItem) { skipped.push({ id: it.id, name: it.name, reason: "item " + describe(it) + " quá lớn (" + kbOf(size) + ", tối đa 512 KB) nên chưa đồng bộ được" }); return; }
        if (it.updatedAt > clock() + DAY) { skipped.push({ id: it.id, name: it.name, reason: "item " + describe(it) + " mang thời điểm sửa ở tương lai (đồng hồ máy từng lệch) — hãy sửa lại mục này rồi đồng bộ" }); return; }
        var errs = P_.validate(it, { target: "store" });
        if (errs.length) { skipped.push({ id: it.id, name: it.name, reason: "item " + describe(it) + " không hợp lệ: " + errs[0] }); return; }
        if (cur.length && (cur.length >= BATCH_ITEMS || curBytes + size > BATCH_BYTES)) { batches.push(cur); cur = []; curBytes = 0; }
        cur.push(it); curBytes += size;
      });
      if (cur.length) batches.push(cur);
      return { batches: batches, skipped: skipped };
    }
    /** Gửi một lô; máy chủ từ chối cả lô vì một item → loại item đó rồi gửi lại; "quá lớn" → chia đôi. ctx: {total, my, skippedIds} */
    function sendBatch(batch, ctx) {
      if (!batch.length) return Promise.resolve();
      var total = ctx.total;
      function skip(it, reason) { total.skipped.push({ id: it.id, name: it.name, reason: reason }); ctx.skippedIds[it.id] = 1; }
      return http("PUT", wsPath(), { body: { items: batch } }).then(function (resp) {
        if (ctx.my !== epoch) throw syncError("Đã đổi không gian trong lúc đồng bộ", "aborted");
        var held = resp && Array.isArray(resp.items) ? resp.items : [], byId = Object.create(null);
        batch.forEach(function (it) { byId[it.id] = it; });
        return held.reduce(function (chain, h) {
          return chain.then(function () {
            return lib.applyRemote(h).then(function (r) {
              if (r === "applied") total.pulled++;
              var sent = h && byId[h.id];
              return sent ? lib.markClean(sent.id, sent.updatedAt) : null;
            });
          });
        }, Promise.resolve()).then(function () { total.pushed += batch.length; });
      }, function (e) {
        if (e.code === "codestore_bad_item" && e.itemId) {
          var bad = batch.filter(function (it) { return it.id === e.itemId; })[0];
          if (bad) {
            skip(bad, "máy chủ từ chối item " + describe(bad) + (e.serverMessage ? ": " + e.serverMessage : ""));
            return sendBatch(batch.filter(function (it) { return it !== bad; }), ctx);
          }
        }
        if (e.code === "codestore_too_large") {
          if (batch.length > 1) { var h = Math.ceil(batch.length / 2); return sendBatch(batch.slice(0, h), ctx).then(function () { return sendBatch(batch.slice(h), ctx); }); }
          skip(batch[0], "item " + describe(batch[0]) + " quá lớn so với giới hạn của máy chủ");
          return null;
        }
        throw e;
      });
    }
    function push(ctx) {
      var pending = lib.dirty().filter(function (it) { return !ctx.skippedIds[it.id]; });
      var pl = plan(pending);
      pl.skipped.forEach(function (s) { ctx.skippedIds[s.id] = 1; ctx.total.skipped.push(s); });
      return pl.batches.reduce(function (chain, b) { return chain.then(function () { return sendBatch(b, ctx); }); }, Promise.resolve());
    }
    /* ---- kéo ---- */
    function pull(ctx) {
      var total = ctx.total, my = ctx.my, since = state.cursor, pages = 0;
      function page() {
        return http("GET", wsPath(), { query: { since: since, limit: PAGE_LIMIT } }).then(function (resp) {
          if (my !== epoch) throw syncError("Đã đổi không gian trong lúc đồng bộ", "aborted");
          var got = resp && Array.isArray(resp.items) ? resp.items : [], st = resp ? Number(resp.serverTime) : NaN;
          if (!isFinite(st) || st < 0) throw syncError("Máy chủ trả lời sai định dạng (thiếu serverTime)", "bad_response");
          return got.reduce(function (chain, r) { return chain.then(function () { return lib.applyRemote(r).then(function (res) { if (res === "applied") total.pulled++; }); }); }, Promise.resolve()).then(function () {
            state.cursor = Math.max(state.cursor, st);
            return persist();
          }).then(function () {
            if (!resp.more) return;
            if (st <= since || ++pages > MAX_PAGES) throw syncError("Máy chủ trả con trỏ phân trang không tiến — dừng để tránh vòng lặp", "bad_response");
            since = st;
            return page();
          });
        });
      }
      return page();
    }

    function pass(ctx) { return push(ctx).then(function () { return pull(ctx); }); }
    function doSync() {
      return ready.then(function () { return lib.ready; }).then(function () {
        if (disposed) throw syncError("Bộ đồng bộ đã đóng", "disposed");
        if (!connected()) throw syncError("Chưa nối với không gian nào — dữ liệu chỉ lưu trên máy này", "not_connected");
        if (retryUntil > clock()) {
          var wait = Math.ceil((retryUntil - clock()) / 1000), e = syncError("Gửi quá nhanh, thử lại sau " + wait + " giây", "codestore_rate_limited", { status: 429, retryAfter: wait });
          setStatus("error", e.message);
          throw e;
        }
        var my = epoch, total = { pushed: 0, pulled: 0, skipped: [] }, skippedIds = Object.create(null), n = 0, ctx = { total: total, my: my, skippedIds: skippedIds };
        setStatus("syncing");
        function again() {
          return pass(ctx).then(function () {
            n++;
            var more = lib.dirty().filter(function (it) { return !skippedIds[it.id]; });
            if (more.length && n < MAX_PASSES && !disposed && my === epoch) return again();   // có sửa đổi mới trong lúc đồng bộ
          });
        }
        return again().then(function () {
          if (total.skipped.length) {
            var msgs = total.skipped.slice(0, 3).map(function (s) { return s.reason; });
            if (total.skipped.length > 3) msgs.push("(và " + (total.skipped.length - 3) + " mục khác)");
            setStatus("error", msgs.join("; "));
          } else setStatus("idle");
          retryUntil = 0;                                        // đồng bộ được tức là không còn bị chặn tốc độ
          return total;
        }, function (e) {
          if (e && e.code === "aborted") { setStatus("idle"); throw e; }
          if (e && e.code === "codestore_rate_limited" && e.retryAfter > 0) retryUntil = clock() + Math.min(e.retryAfter, 3600) * 1000;   // tối đa 1 giờ
          setStatus(e && e.code === "offline" ? "offline" : "error", e && e.message ? e.message : "Lỗi đồng bộ");
          throw e;
        });
      });
    }
    function syncNow() {
      if (running) return running;
      var p = doSync().then(function (r) { running = null; return r; }, function (e) { running = null; throw e; });
      running = p;
      return p;
    }

    /* ---- không gian ---- */
    function backends() { return http("GET", "/backends", { noKey: true, backend: "" }); }
    function joined(ws, key, backend) {
      epoch++;
      state = { workspaceId: ws, key: key, backend: backend, cursor: 0 };
      retryUntil = 0;
      return persist().then(function () { return lib.ready; }).then(function () { return lib.markAllDirty(); }).then(function () { setStatus("idle"); });
    }
    /** Tạo không gian mới ở kho đã chọn, lưu mã + khoá + kho vào kv, đánh dấu mọi item cục bộ cần đẩy. → {workspaceId, key, backend} */
    function createWorkspace() {
      return ready.then(function () {
        var b = state.backend;
        return http("POST", "/workspaces", { noKey: true, backend: b }).then(function (res) {
          if (!isObj(res) || typeof res.workspaceId !== "string" || typeof res.key !== "string" || !res.workspaceId || !res.key) throw syncError("Máy chủ trả lời sai định dạng khi tạo không gian", "bad_response");
          return joined(res.workspaceId, res.key, b).then(function () { return { workspaceId: res.workspaceId, key: res.key, backend: b }; });
        });
      });
    }
    /** Nối vào không gian đã có (thiết bị khác tạo). Kiểm bằng một GET; sai khoá/mã → ném lỗi và KHÔNG lưu gì. */
    function connect(workspaceId, key) {
      return ready.then(function () {
        var ws = String(workspaceId == null ? "" : workspaceId).trim(), k = String(key == null ? "" : key).trim(), b = state.backend;
        if (!/^[A-Za-z0-9_-]{1,64}$/.test(ws)) throw syncError("Mã không gian không hợp lệ (chỉ chữ, số, '_' và '-', tối đa 64 ký tự)", "bad_workspace");
        if (!k) throw syncError("Chưa nhập khoá của không gian", "codestore_key_required");
        return http("GET", "/" + encodeURIComponent(ws) + "/items", { key: k, query: { since: 0, limit: 1 } }).then(function () {
          return joined(ws, k, b).then(function () { return { workspaceId: ws, backend: b }; });
        });
      });
    }
    /** Ngắt: xoá mã + khoá khỏi kv; GIỮ nguyên dữ liệu cục bộ. */
    function disconnect() {
      return ready.then(function () {
        epoch++;
        state = { workspaceId: "", key: "", backend: opts.backend || "", cursor: 0 };
        retryUntil = 0;
        return persist().then(function () { setStatus("idle"); return true; });
      });
    }
    function onStatus(cb) {
      if (typeof cb !== "function") return noop;
      listeners.push(cb);
      return function () { var i = listeners.indexOf(cb); if (i >= 0) listeners.splice(i, 1); };
    }
    function dispose() { disposed = true; listeners = []; }

    var api = {
      ready: ready,
      get workspaceId() { return state.workspaceId; },
      get backend() { return state.backend; },
      get status() { return status; },
      get lastError() { return lastError; },
      isConnected: connected, onStatus: onStatus, dispose: dispose,
      backends: backends, createWorkspace: createWorkspace, connect: connect, disconnect: disconnect, syncNow: syncNow
    };
    return api;
  }

  CS.store = { kv: { memory: memory, local: local, idb: idb, auto: auto }, library: library, sync: sync, stable: stable, describeHttpError: httpError };
  if (typeof module !== "undefined" && module.exports) module.exports = CS.store;
})(typeof globalThis !== "undefined" ? globalThis : this);
