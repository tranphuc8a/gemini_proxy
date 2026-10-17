/* BẢN CHÉP từ personal-wiki bằng sync.py — đừng sửa ở đây. */
/* store.js — lớp lưu trữ: một giao diện giao dịch, hai cách cài.
     openIdb(tên)  IndexedDB thật. Mỗi lần ghi là MỘT giao dịch nguyên tử (durability "strict": chờ ổ đĩa xác nhận) ⇒ tắt máy / hết pin / crash
                   giữa chừng thì hoặc có cả lần ghi, hoặc không có gì — không bao giờ nửa vời.
     memory()      cùng giao diện, trong bộ nhớ: dùng cho test node và làm phương án dự phòng khi trình duyệt chặn IndexedDB (store.volatile = true).

   store.tx(tên_kho[], "r" | "rw" | "bulk", fn) → Promise<kết quả của fn>
     "bulk" = ghi như "rw" nhưng durability "relaxed" (nhập hàng loạt, nhanh hơn).
     fn nhận `t` với:  get(kho, khoá)  put(kho, giá_trị)  del(kho, khoá)  all(kho, {lo, hi, limit})  keys(kho, {lo, hi, limit})
                       byIndex(kho, chỉ_mục, khoá, limit)  count(kho)  clear(kho)
     QUAN TRỌNG: trong fn chỉ được `await` các lời gọi của `t` — await việc khác (fetch, CompressionStream…) làm giao dịch IndexedDB tự đóng.

   Kho (stores): notes{n} heads{c} tokens{t} links{k; from,to,tk} cards{id; note,due} changes{id} drafts{id} meta{k} */
(function (root) {
  "use strict";
  var W = root.Puz || (root.Puz = {});

  // Ứng dụng khác dùng chung mô-đun này (algorithm-notebook, bản chép bằng sync.py) khai báo W.storeSchema trước khi nạp.
  var SCHEMA = W.storeSchema || {
    notes: { key: "n" },
    heads: { key: "c" },
    tokens: { key: "t" },
    links: { key: "k", indexes: { from: "from", to: "to", tk: "tk" } },
    cards: { key: "id", indexes: { note: "note", due: "due" } },
    changes: { key: "id" },
    drafts: { key: "id" },
    meta: { key: "k" }
  };
  var DB_VERSION = 1;

  function fail(msg, code) { var e = new Error(msg); e.code = code || "store"; return e; }

  // ============================================================================================ bộ nhớ
  function memory() {
    var data = {}, idx = {}, sortedKeys = {};
    Object.keys(SCHEMA).forEach(function (name) {
      data[name] = new Map(); sortedKeys[name] = null; idx[name] = {};
      Object.keys(SCHEMA[name].indexes || {}).forEach(function (i) { idx[name][i] = new Map(); });
    });
    var chain = Promise.resolve();

    function indexAdd(name, v) {
      var ix = SCHEMA[name].indexes || {};
      Object.keys(ix).forEach(function (i) {
        var k = v[ix[i]], m = idx[name][i];
        if (k === undefined || k === null) return;
        if (!m.has(k)) m.set(k, new Set());
        m.get(k).add(v[SCHEMA[name].key]);
      });
    }
    function indexDel(name, v) {
      var ix = SCHEMA[name].indexes || {};
      Object.keys(ix).forEach(function (i) {
        var k = v[ix[i]], m = idx[name][i], s = m.get(k);
        if (s) { s.delete(v[SCHEMA[name].key]); if (!s.size) m.delete(k); }
      });
    }
    function keyList(name) {
      if (!sortedKeys[name]) sortedKeys[name] = Array.from(data[name].keys()).sort(function (a, b) { return a < b ? -1 : a > b ? 1 : 0; });
      return sortedKeys[name];
    }
    function clone(v) { return v === undefined ? v : (typeof structuredClone === "function" ? structuredClone(v) : JSON.parse(JSON.stringify(v))); }
    function range(name, o) {
      o = o || {};
      var list = keyList(name), lo = 0, hi = list.length;
      if (o.lo !== undefined) { var a = 0, b = list.length; while (a < b) { var m = (a + b) >>> 1; if (list[m] < o.lo) a = m + 1; else b = m; } lo = a; }
      if (o.hi !== undefined) { var c = lo, d = list.length; while (c < d) { var m2 = (c + d) >>> 1; if (list[m2] <= o.hi) c = m2 + 1; else d = m2; } hi = c; }
      var end = o.limit ? Math.min(hi, lo + o.limit) : hi;
      return list.slice(lo, end);
    }

    return {
      volatile: true, kind: "memory",
      tx: function (names, mode, fn) {
        var staged = null;
        var run = chain.then(function () {
          // giao dịch ghi: làm trên bản ghi chép thay đổi, chỉ áp dụng nếu fn thành công ⇒ lỗi giữa chừng không để lại gì (như abort của IndexedDB)
          var writes = [], t = {
            get: function (n, k) { return Promise.resolve(clone(data[n].get(k))); },
            put: function (n, v) { if (mode === "r") throw fail("Giao dịch chỉ đọc."); writes.push(["put", n, clone(v)]); return Promise.resolve(); },
            del: function (n, k) { if (mode === "r") throw fail("Giao dịch chỉ đọc."); writes.push(["del", n, k]); return Promise.resolve(); },
            clear: function (n) { writes.push(["clear", n]); return Promise.resolve(); },
            all: function (n, o) { return Promise.resolve(range(n, o).map(function (k) { return clone(data[n].get(k)); })); },
            keys: function (n, o) { return Promise.resolve(range(n, o)); },
            byIndex: function (n, i, k, limit) {
              var s = idx[n][i].get(k), out = [];
              if (s) s.forEach(function (pk) { if (!limit || out.length < limit) out.push(clone(data[n].get(pk))); });
              return Promise.resolve(out);
            },
            count: function (n) { return Promise.resolve(data[n].size); }
          };
          // đọc phải thấy các ghi đã ghi trong CÙNG giao dịch: áp dụng ngay, giữ bản sao để hoàn tác nếu lỗi
          var undo = [];
          function apply(op) {
            var n = op[1], store = data[n], key = SCHEMA[n].key;
            if (op[0] === "put") {
              var old = store.get(op[2][key]);
              undo.push(["restore", n, op[2][key], old]);
              if (old) indexDel(n, old);
              store.set(op[2][key], op[2]); indexAdd(n, op[2]); sortedKeys[n] = null;
            } else if (op[0] === "del") {
              var o2 = store.get(op[2]);
              if (o2 !== undefined) { undo.push(["restore", n, op[2], o2]); indexDel(n, o2); store.delete(op[2]); sortedKeys[n] = null; }
            } else {
              store.forEach(function (v, k) { undo.push(["restore", n, k, v]); indexDel(n, v); });
              store.clear(); sortedKeys[n] = null;
            }
          }
          var live = Object.assign({}, t, {
            put: function (n, v) { if (mode === "r") throw fail("Giao dịch chỉ đọc."); var op = ["put", n, clone(v)]; apply(op); return Promise.resolve(); },
            del: function (n, k) { if (mode === "r") throw fail("Giao dịch chỉ đọc."); apply(["del", n, k]); return Promise.resolve(); },
            clear: function (n) { apply(["clear", n]); return Promise.resolve(); }
          });
          return Promise.resolve().then(function () { return fn(live); }).catch(function (e) {
            for (var i = undo.length - 1; i >= 0; i--) {
              var u = undo[i], st = data[u[1]];
              var cur = st.get(u[2]); if (cur) indexDel(u[1], cur);
              if (u[3] === undefined) st.delete(u[2]); else { st.set(u[2], u[3]); indexAdd(u[1], u[3]); }
              sortedKeys[u[1]] = null;
            }
            throw e;
          });
        });
        chain = run.catch(function () { /* một giao dịch lỗi không chặn các giao dịch sau */ });
        return run;
      },
      close: function () {}
    };
  }

  // ============================================================================================ IndexedDB
  function req(r) { return new Promise(function (ok, no) { r.onsuccess = function () { ok(r.result); }; r.onerror = function () { no(r.error || fail("IndexedDB lỗi.")); }; }); }

  function openIdb(name, opts) {
    opts = opts || {};
    var factory = opts.indexedDB || root.indexedDB;
    return new Promise(function (resolve, reject) {
      if (!factory) return reject(fail("Trình duyệt không có IndexedDB.", "idb_missing"));
      var open;
      try { open = factory.open(name, DB_VERSION); } catch (e) { return reject(fail("Không mở được IndexedDB: " + e.message, "idb_open")); }
      open.onupgradeneeded = function () {
        var db = open.result;
        Object.keys(SCHEMA).forEach(function (s) {
          var store = db.objectStoreNames.contains(s) ? open.transaction.objectStore(s) : db.createObjectStore(s, { keyPath: SCHEMA[s].key });
          Object.keys(SCHEMA[s].indexes || {}).forEach(function (i) { if (!store.indexNames.contains(i)) store.createIndex(i, SCHEMA[s].indexes[i]); });
        });
      };
      open.onblocked = function () { reject(fail("IndexedDB bị chặn bởi một thẻ khác đang mở bản cũ — hãy đóng các thẻ khác của ứng dụng.", "idb_blocked")); };
      open.onerror = function () { reject(fail("Không mở được IndexedDB: " + (open.error && open.error.message), "idb_open")); };
      open.onsuccess = function () {
        var db = open.result;
        db.onversionchange = function () { db.close(); };
        resolve({
          volatile: false, kind: "indexeddb", db: db,
          close: function () { db.close(); },
          tx: function (names, mode, fn) {
            return new Promise(function (ok, no) {
              var t, result, failed = false;
              try {
                t = db.transaction(names, mode === "r" ? "readonly" : "readwrite", mode === "r" ? undefined : { durability: mode === "bulk" ? "relaxed" : "strict" });
              } catch (e) { return no(fail("Không mở được giao dịch: " + e.message, "idb_tx")); }
              var api = {
                get: function (n, k) { return req(t.objectStore(n).get(k)); },
                put: function (n, v) { return req(t.objectStore(n).put(v)); },
                del: function (n, k) { return req(t.objectStore(n).delete(k)); },
                clear: function (n) { return req(t.objectStore(n).clear()); },
                count: function (n) { return req(t.objectStore(n).count()); },
                all: function (n, o) { o = o || {}; return req(t.objectStore(n).getAll(rangeOf(o), o.limit || undefined)); },
                keys: function (n, o) { o = o || {}; return req(t.objectStore(n).getAllKeys(rangeOf(o), o.limit || undefined)); },
                byIndex: function (n, i, k, limit) { return req(t.objectStore(n).index(i).getAll(k, limit || undefined)); }
              };
              t.oncomplete = function () { if (!failed) ok(result); };
              t.onabort = function () { if (!failed) { failed = true; no(t.error || fail("Giao dịch bị huỷ.", "idb_abort")); } };
              Promise.resolve().then(function () { return fn(api); }).then(function (r) { result = r; }, function (e) {
                failed = true;
                try { t.abort(); } catch (_) { /* đã đóng */ }
                no(e);
              });
            });
          }
        });
      };
    });
  }
  function rangeOf(o) {
    var K = root.IDBKeyRange;
    if (o.lo !== undefined && o.hi !== undefined) return K.bound(o.lo, o.hi);
    if (o.lo !== undefined) return K.lowerBound(o.lo);
    if (o.hi !== undefined) return K.upperBound(o.hi);
    return undefined;
  }

  /** Thử IndexedDB; không được thì rơi về bộ nhớ (volatile = true) — ứng dụng báo rõ cho người dùng. */
  function openBest(name, opts) {
    return openIdb(name, opts).catch(function (e) { var m = memory(); m.reason = e; return m; });
  }

  W.store = { SCHEMA: SCHEMA, memory: memory, openIdb: openIdb, openBest: openBest, fail: fail };
  if (typeof module !== "undefined" && module.exports) module.exports = W.store;
})(typeof globalThis !== "undefined" ? globalThis : this);
