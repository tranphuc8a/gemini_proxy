/* store.js — nơi sổ được lưu và cách nó đồng bộ (FR-50..53).

   Ba chế độ, MỘT động cơ:
     local   — localStorage của trình duyệt (mặc định, chạy cả khi mở bằng file://)
     mysql   — máy chủ FastAPI, kho MySQL     ┐ cùng API /spending, chọn kho bằng ?backend=
     mongo   — máy chủ FastAPI, kho MongoDB   ┘

   Quy tắc bất di bất dịch: GHI CỤC BỘ TRƯỚC, đồng bộ sau. Mất mạng, máy chủ lỗi,
   hay khoá sai đều không làm mất một giao dịch vừa nhập — chúng chỉ làm trạng thái
   chuyển thành "chưa đồng bộ" và thử lại.

   Mọi thứ bên ngoài (storage, fetch, đồng hồ, hẹn giờ) được tiêm vào nên kiểm được
   bằng node với máy chủ giả. Hỏng một chỗ nào cũng không ném lỗi ra giao diện. */
(function (root) {
  "use strict";
  var QL = root.QL || (root.QL = {});

  var DEBOUNCE_MS = 1200;
  var RETRY_MS = 30000;
  var WARN_BYTES = 3000000;   // gần giới hạn 4 MB của máy chủ
  var BACKENDS = ["mysql", "mongo"];

  var K = {
    cfg: "qlct.cfg",
    doc: function (m) { return "qlct.doc." + m; },
    conn: function (m) { return "qlct.conn." + m; },
    undo: function (m) { return "qlct.undo." + m; },
    corrupt: function (m) { return "qlct.corrupt." + m; }
  };

  /** Mã kết nối "id.khoá" — dán sang thiết bị khác để nối vào cùng không gian. */
  function makeCode(id, key) { return id + "." + key; }
  function parseCode(code) {
    var s = String(code || "").trim(), i = s.indexOf(".");
    if (i < 1 || i === s.length - 1) return null;
    return { id: s.slice(0, i), key: s.slice(i + 1) };
  }

  function safeJson(text) { try { return { ok: true, value: JSON.parse(text) }; } catch (e) { return { ok: false }; } }

  /**
   * env: { storage, fetch, now():Date, setTimeout, clearTimeout, apiBase():string,
   *        onStatus(status), onDoc(doc, why) }
   */
  function createEngine(env) {
    var M = QL.model, S = QL.sync;
    var storage = env.storage;
    var now = env.now || function () { return new Date(); };
    var st = {
      cfg: { mode: "local", apiBase: "" },
      doc: null, bytes: null,
      conn: null,           // {id,key,revision,backend,dirty} của chế độ máy chủ đang dùng
      version: 0,           // tăng mỗi lần sửa: biết có sửa thêm trong lúc đang đẩy hay không
      timer: null, retry: null, queue: Promise.resolve(),
      status: { state: "local", at: null, message: "", pending: false, localError: "" }
    };

    /* ------------------------------------------------------------ storage */
    function sGet(k) { try { return storage ? storage.getItem(k) : null; } catch (e) { return null; } }
    function sSet(k, v) {
      try { storage.setItem(k, v); return true; } catch (e) { return false; }
    }
    function sDel(k) { try { storage.removeItem(k); } catch (e) { /* bỏ qua */ } }

    function setStatus(patch) {
      for (var k in patch) st.status[k] = patch[k];
      if (env.onStatus) env.onStatus(snapshot());
    }
    function snapshot() {
      var s = {}; for (var k in st.status) s[k] = st.status[k];
      s.mode = st.cfg.mode; s.connected = !!st.conn; s.usageBytes = usage();
      return s;
    }
    /** Số ký tự JSON của sổ. Tính một lần mỗi lần ghi (saveDoc) thay vì serialize cả sổ ở mỗi lần đổi trạng thái. */
    function usage() {
      if (!st.doc) return 0;
      if (st.bytes === null) st.bytes = JSON.stringify(st.doc).length;
      return st.bytes;
    }

    function saveCfg() { sSet(K.cfg, JSON.stringify(st.cfg)); }
    function saveConn() { if (st.conn) sSet(K.conn(st.conn.backend), JSON.stringify(st.conn)); }
    function saveDoc() {
      var json = JSON.stringify(st.doc);
      st.bytes = json.length;
      var ok = sSet(K.doc(st.cfg.mode), json);
      setStatus({ localError: ok ? "" : "Bộ nhớ trình duyệt đầy hoặc bị chặn — dữ liệu mới CHƯA được lưu trên máy này. Hãy sao lưu JSON ngay." });
      return ok;
    }
    function loadDoc(mode) {
      var raw = sGet(K.doc(mode));
      if (raw === null) return null;
      var p = safeJson(raw);
      if (!p.ok) {
        // Không đọc được: giữ nguyên bản gốc để cứu, và bắt đầu bằng sổ trống thay vì ghi đè lên nó.
        sSet(K.corrupt(mode) + "." + now().getTime(), raw);
        setStatus({ localError: "Dữ liệu đã lưu trên máy bị hỏng và không đọc được. Bản gốc được giữ lại để cứu; đang dùng sổ trống." });
        return null;
      }
      return M.normalize(p.value, M.nowIso(now())).doc;
    }
    function loadConn(backend) {
      var raw = sGet(K.conn(backend));
      var p = raw === null ? { ok: false } : safeJson(raw);
      var c = p.ok && p.value;
      return c && typeof c.id === "string" && typeof c.key === "string" && typeof c.revision === "number" ? c : null;
    }

    /* ---------------------------------------------------------------- API */
    function base() { return (st.cfg.apiBase || (env.apiBase ? env.apiBase() : "") || "").replace(/\/+$/, ""); }

    /** Một lời gọi API. Không bao giờ ném lỗi: trả {status, body} hoặc {network:true}. */
    async function api(method, path, o) {
      o = o || {};
      // Mở bằng file:// mà chưa có địa chỉ máy chủ: không có nơi nào để gọi — đừng bắn một request vô nghĩa (và lỗi CORS) ra console.
      if (env.apiAvailable && !env.apiAvailable()) return { network: true, noServer: true, error: "Chưa có địa chỉ máy chủ" };
      var url = base() + "/spending" + path;
      var q = [];
      if (o.backend) q.push("backend=" + encodeURIComponent(o.backend));
      if (o.since != null) q.push("since=" + o.since);
      if (q.length) url += "?" + q.join("&");
      var headers = { Accept: "application/json" };
      if (o.body !== undefined) headers["Content-Type"] = "application/json";
      if (o.key) headers["X-Workspace-Key"] = o.key;
      var res;
      try {
        res = await env.fetch(url, { method: method, headers: headers, body: o.body === undefined ? undefined : JSON.stringify(o.body) });
      } catch (e) {
        return { network: true, error: String(e && e.message || e) };
      }
      var body = null;
      try { body = await res.json(); } catch (e) { body = null; }
      return { status: res.status, body: body };
    }
    function msgOf(r) { return (r.body && (r.body.message || r.body.detail)) || ("Lỗi máy chủ (" + r.status + ")"); }

    function run(fn) {   // tuần tự hoá push/pull/kết nối: không bao giờ có hai lời gọi đè nhau
      var next = st.queue.then(fn, fn);
      st.queue = next.catch(function () { /* đã xử lý bên trong */ });
      return next;
    }

    /* ----------------------------------------------------------------- khởi động */
    async function init() {
      var raw = sGet(K.cfg), p = raw ? safeJson(raw) : { ok: false };
      if (p.ok && p.value && typeof p.value === "object") {
        st.cfg.mode = p.value.mode === "mysql" || p.value.mode === "mongo" ? p.value.mode : "local";
        st.cfg.apiBase = typeof p.value.apiBase === "string" ? p.value.apiBase : "";
      }
      if (st.cfg.mode !== "local") {
        st.conn = loadConn(st.cfg.mode);
        if (!st.conn) st.cfg.mode = "local";    // mất khoá kết nối → quay về máy này, không bỏ rơi dữ liệu
      }
      st.doc = loadDoc(st.cfg.mode) || M.emptyDoc(M.nowIso(now()));
      st.bytes = null;
      if (st.cfg.mode !== "local") {
        var dirty = !!st.conn.dirty;
        setStatus({ state: dirty ? "pending" : "saved", pending: dirty, message: "" });
        if (env.onDoc) env.onDoc(st.doc, "init");
        await (dirty ? push() : pull());
      } else {
        setStatus({ state: "local", pending: false, message: "" });
        if (env.onDoc) env.onDoc(st.doc, "init");
      }
      return st.doc;
    }

    /* ------------------------------------------------------------------ sửa */
    /** Áp một hàm thuần doc → doc. Ghi cục bộ NGAY; chế độ máy chủ thì hẹn đẩy lên. */
    function mutate(fn) {
      var next = fn(st.doc);
      if (!next || next === st.doc) return st.doc;
      st.doc = next;
      st.version++;
      saveDoc();
      afterChange("mutate");
      return st.doc;
    }
    function afterChange(why) {
      if (st.conn) {
        st.conn.dirty = true; saveConn();
        setStatus({ state: "pending", pending: true });
        schedulePush();
      } else {
        setStatus({ state: "local", pending: false });
      }
      if (env.onDoc) env.onDoc(st.doc, why);
    }
    function schedulePush() {
      if (st.timer) env.clearTimeout(st.timer);
      st.timer = env.setTimeout(function () { st.timer = null; return push(); }, DEBOUNCE_MS);
    }
    function scheduleRetry() {
      if (st.retry) env.clearTimeout(st.retry);
      st.retry = env.setTimeout(function () { st.retry = null; return push(); }, RETRY_MS);
    }

    /* ---------------------------------------------------------------- đẩy lên */
    function push() {
      if (st.timer) { env.clearTimeout(st.timer); st.timer = null; }
      return run(doPush);
    }
    async function doPush() {
      if (!st.conn) return;
      var conn = st.conn;
      for (var attempt = 0; attempt < 4; attempt++) {
        var sent = st.version, doc = st.doc;
        setStatus({ state: "saving", pending: true });
        var r = await api("PUT", "/workspaces/" + encodeURIComponent(conn.id), { backend: conn.backend, key: conn.key, body: { revision: conn.revision, data: doc } });

        if (r.network || (r.status >= 500)) {
          setStatus({ state: "offline", pending: true, message: r.network ? "Không kết nối được máy chủ" : msgOf(r) });
          scheduleRetry(); return;
        }
        if (r.status === 200) {
          conn.revision = r.body.data.revision;
          if (st.version === sent) { conn.dirty = false; setStatus({ state: "saved", pending: false, at: M.nowIso(now()), message: "" }); }
          else { schedulePush(); setStatus({ state: "pending", pending: true }); }
          saveConn();
          return;
        }
        if (r.status === 409) {
          // Thiết bị khác đã lưu trước: lấy bản của họ, gộp với bản của mình, thử lại.
          var cur = r.body && r.body.data && r.body.data.current;
          if (!cur || !cur.data) { setStatus({ state: "error", message: "Máy chủ báo xung đột nhưng không gửi kèm bản hiện tại" }); return; }
          var before = st.doc;
          st.doc = S.merge(st.doc, M.normalize(cur.data, M.nowIso(now())).doc, M.nowIso(now()));
          conn.revision = cur.revision;
          st.version++;
          saveDoc(); saveConn();
          var n = S.countChanges(before, st.doc);
          if (env.onDoc) env.onDoc(st.doc, "merged:" + n);
          continue;
        }
        if (r.status === 401) { setStatus({ state: "auth", pending: true, message: "Khoá truy cập không đúng — hãy kết nối lại" }); return; }
        if (r.status === 404) { setStatus({ state: "missing", pending: true, message: "Không gian dữ liệu này không còn trên máy chủ" }); return; }
        setStatus({ state: "error", pending: true, message: msgOf(r) });   // 400/422: quá lớn, sai kiểu…
        return;
      }
      setStatus({ state: "error", pending: true, message: "Gộp xung đột nhiều lần vẫn chưa xong — thử lại sau" });
      scheduleRetry();
    }

    /* ---------------------------------------------------------------- kéo về */
    function pull() { return run(doPull); }
    async function doPull() {
      if (!st.conn) return;
      var conn = st.conn;
      var r = await api("GET", "/workspaces/" + encodeURIComponent(conn.id), { backend: conn.backend, key: conn.key, since: conn.revision });
      if (r.network || r.status >= 500) { setStatus({ state: conn.dirty ? "offline" : "saved", pending: !!conn.dirty, message: r.network ? "Không kết nối được máy chủ" : msgOf(r) }); return; }
      if (r.status === 401) { setStatus({ state: "auth", message: "Khoá truy cập không đúng — hãy kết nối lại" }); return; }
      if (r.status === 404) { setStatus({ state: "missing", message: "Không gian dữ liệu này không còn trên máy chủ" }); return; }
      if (r.status !== 200) { setStatus({ state: "error", message: msgOf(r) }); return; }
      var view = r.body.data;
      if (view.unchanged) { if (!conn.dirty) setStatus({ state: "saved", pending: false, at: M.nowIso(now()), message: "" }); return; }
      var remote = M.normalize(view.data, M.nowIso(now())).doc;
      if (conn.dirty) {
        var before = st.doc;
        st.doc = S.merge(st.doc, remote, M.nowIso(now()));
        conn.revision = view.revision; st.version++;
        saveDoc(); saveConn();
        if (env.onDoc) env.onDoc(st.doc, "merged:" + S.countChanges(before, st.doc));
        await doPush();
      } else {
        st.doc = remote; conn.revision = view.revision; st.version++;
        saveDoc(); saveConn();
        setStatus({ state: "saved", pending: false, at: M.nowIso(now()), message: "" });
        if (env.onDoc) env.onDoc(st.doc, "pulled");
      }
    }

    /* ------------------------------------------------------ nối / chuyển kho */
    function useConn(backend, conn, doc) {
      st.cfg.mode = backend; st.conn = conn;
      if (doc) st.doc = doc;
      st.version++;
      saveCfg(); saveConn(); saveDoc();
    }

    /**
     * Tạo không gian MỚI ở `backend` và đẩy sổ hiện tại lên. Cũng là cách "sao chép sang kho khác":
     * đang dùng MySQL mà gọi connectNew("mongo") thì Mongo nhận một bản sao độc lập.
     * @returns {Promise<{ok:boolean, code?:string, message?:string}>}
     */
    function connectNew(backend, name) {
      return run(async function () {
        if (BACKENDS.indexOf(backend) === -1) return { ok: false, message: "Kho không hợp lệ" };
        var r = await api("POST", "/workspaces", { backend: backend, body: { name: name || "Sổ chi tiêu", data: st.doc } });
        if (r.network) return { ok: false, message: r.noServer ? "Chưa có địa chỉ máy chủ — điền ở ô “Địa chỉ máy chủ” trong Cài đặt" : "Không kết nối được máy chủ" };
        if (r.status !== 201) return { ok: false, message: msgOf(r) };
        var d = r.body.data;
        useConn(backend, { id: d.id, key: d.access_key, revision: d.revision, backend: backend, dirty: false }, null);
        setStatus({ state: "saved", pending: false, at: M.nowIso(now()), message: "" });
        if (env.onDoc) env.onDoc(st.doc, "connected");
        return { ok: true, code: makeCode(d.id, d.access_key) };
      });
    }

    /**
     * Nối vào không gian đã có bằng mã. strategy: "merge" (gộp dữ liệu máy với máy chủ) hoặc
     * "replace" (bỏ dữ liệu máy, dùng máy chủ — bản cũ được giữ để hoàn tác).
     */
    function connectExisting(backend, code, strategy) {
      return run(async function () {
        var c = parseCode(code);
        if (!c) return { ok: false, message: "Mã kết nối không hợp lệ (dạng id.khoá)" };
        if (BACKENDS.indexOf(backend) === -1) return { ok: false, message: "Kho không hợp lệ" };
        var r = await api("GET", "/workspaces/" + encodeURIComponent(c.id), { backend: backend, key: c.key });
        if (r.network) return { ok: false, message: "Không kết nối được máy chủ" };
        if (r.status === 404) return { ok: false, message: "Không tìm thấy không gian này ở kho " + backend };
        if (r.status === 401) return { ok: false, message: "Khoá truy cập không đúng" };
        if (r.status !== 200) return { ok: false, message: msgOf(r) };
        var view = r.body.data;
        var remote = M.normalize(view.data, M.nowIso(now())).doc;
        var conn = { id: c.id, key: c.key, revision: view.revision, backend: backend, dirty: false };
        var doc, dirty = false;
        if (strategy === "merge") {
          doc = S.merge(st.doc, remote, M.nowIso(now()));
          dirty = S.countChanges(remote, doc) > 0;
        } else {
          sSet(K.undo(backend), JSON.stringify(st.doc));
          doc = remote;
        }
        conn.dirty = dirty;
        useConn(backend, conn, doc);
        if (env.onDoc) env.onDoc(st.doc, "connected");
        if (dirty) { await doPush(); } else setStatus({ state: "saved", pending: false, at: M.nowIso(now()), message: "" });
        return { ok: true };
      });
    }

    /**
     * Về chế độ "Máy này". keep="current" (mặc định): dữ liệu đang làm việc được chép về máy, bản
     * cũ trên máy giữ lại để hoàn tác một bước. keep="cached": dùng lại bản đã lưu trên máy từ trước.
     */
    function useLocal(keep) {
      if (st.timer) { env.clearTimeout(st.timer); st.timer = null; }
      var cached = loadDoc("local");
      if (keep === "cached" && cached) st.doc = cached;
      else if (cached) sSet(K.undo("local"), JSON.stringify(cached));
      st.cfg.mode = "local"; st.conn = null;
      st.version++;
      saveCfg(); saveDoc();
      setStatus({ state: "local", pending: false, message: "" });
      if (env.onDoc) env.onDoc(st.doc, "local");
    }

    /** Xoá không gian trên máy chủ (cần khoá) rồi về chế độ Máy này, giữ nguyên dữ liệu trên máy. */
    function deleteWorkspace() {
      return run(async function () {
        if (!st.conn) return { ok: false, message: "Chưa kết nối máy chủ" };
        var c = st.conn;
        var r = await api("DELETE", "/workspaces/" + encodeURIComponent(c.id), { backend: c.backend, key: c.key });
        if (r.network) return { ok: false, message: "Không kết nối được máy chủ" };
        if (r.status !== 200 && r.status !== 404) return { ok: false, message: msgOf(r) };
        sDel(K.conn(c.backend)); sDel(K.doc(c.backend));
        useLocal();
        return { ok: true };
      });
    }

    /** Quên khoá đã lưu của một kho (không xoá dữ liệu trên máy chủ). */
    function forget(backend) { sDel(K.conn(backend)); if (st.conn && st.conn.backend === backend) useLocal(); }

    /* ---------------------------------------------------- thay cả sổ / sao lưu */
    /** Thay toàn bộ sổ (khôi phục, nhập). Giữ bản cũ để hoàn tác MỘT bước. */
    function replaceDoc(next, why) {
      sSet(K.undo(st.cfg.mode), JSON.stringify(st.doc));
      st.doc = next; st.version++;
      saveDoc(); afterChange(why || "replace");
    }
    function canUndoReplace() { return sGet(K.undo(st.cfg.mode)) !== null; }
    function undoReplace() {
      var raw = sGet(K.undo(st.cfg.mode)), p = raw === null ? { ok: false } : safeJson(raw);
      if (!p.ok) return false;
      st.doc = M.normalize(p.value, M.nowIso(now())).doc; st.version++;
      sDel(K.undo(st.cfg.mode));
      saveDoc(); afterChange("undo-replace");
      return true;
    }

    function exportJson() { return JSON.stringify(st.doc, null, 2); }

    /**
     * Đọc file sao lưu. Trả {ok, doc, fixes} để giao diện cho xem trước; chưa đụng vào sổ.
     * Dùng replaceDoc(...) hoặc mergeDoc(...) sau khi người dùng xác nhận.
     */
    function parseBackup(text) {
      var p = safeJson(String(text == null ? "" : text).replace(/^﻿/, ""));
      if (!p.ok) return { ok: false, message: "File không phải JSON hợp lệ" };
      if (!p.value || typeof p.value !== "object" || Array.isArray(p.value) || !Array.isArray(p.value.transactions)) {
        return { ok: false, message: "File này không phải bản sao lưu của ứng dụng (thiếu danh sách giao dịch)" };
      }
      var n = M.normalize(p.value, M.nowIso(now()));
      return { ok: true, doc: n.doc, fixes: n.fixes };
    }
    function mergeDoc(other) { replaceDoc(S.merge(st.doc, other, M.nowIso(now())), "merge-import"); }
    function markBackedUp() { mutate(function (d) { return M.setSettings(d, { lastBackupAt: M.nowIso(now()) }, M.nowIso(now())); }); }

    function backends() { return api("GET", "/backends", {}); }
    function setApiBase(url) { st.cfg.apiBase = String(url || "").trim(); saveCfg(); }

    return {
      init: init, mutate: mutate, push: push, pull: pull,
      connectNew: connectNew, connectExisting: connectExisting, useLocal: useLocal, deleteWorkspace: deleteWorkspace, forget: forget,
      replaceDoc: replaceDoc, undoReplace: undoReplace, canUndoReplace: canUndoReplace, mergeDoc: mergeDoc,
      exportJson: exportJson, parseBackup: parseBackup, markBackedUp: markBackedUp,
      backends: backends, setApiBase: setApiBase,
      getDoc: function () { return st.doc; }, getMode: function () { return st.cfg.mode; }, getStatus: snapshot,
      getConn: function () { return st.conn ? { id: st.conn.id, backend: st.conn.backend, revision: st.conn.revision, code: makeCode(st.conn.id, st.conn.key) } : null; },
      getApiBase: function () { return st.cfg.apiBase; },
      hasStoredConn: function (b) { return loadConn(b) !== null; },
      getStoredCode: function (b) { var c = loadConn(b); return c ? makeCode(c.id, c.key) : ""; },
      usageBytes: usage, WARN_BYTES: WARN_BYTES
    };
  }

  QL.store = { createEngine: createEngine, makeCode: makeCode, parseCode: parseCode, BACKENDS: BACKENDS, WARN_BYTES: WARN_BYTES, DEBOUNCE_MS: DEBOUNCE_MS, RETRY_MS: RETRY_MS };
  if (typeof module !== "undefined" && module.exports) module.exports = QL.store;
})(typeof globalThis !== "undefined" ? globalThis : this);
