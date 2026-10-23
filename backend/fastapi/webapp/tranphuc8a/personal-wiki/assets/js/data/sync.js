/* data/sync.js — đồng bộ ghi chú giữa các thiết bị qua máy chủ (/wiki). Máy này luôn là bản gốc: mọi thao tác ghi vào IndexedDB trước, đồng bộ chạy nền,
   lỗi mạng/máy chủ không bao giờ làm mất hay chặn việc đang làm.

   Mô hình: hàng đợi gửi (repo "changes": note/thẻ nào đổi) → PUT từng lô; rồi kéo về mọi bản ghi máy chủ có sau con trỏ (serverTime) → áp vào kho.
   Xung đột: bản có `updatedAt` MỚI HƠN thắng, theo từng bản ghi; hoà thì xoá thắng sửa (giống máy chủ). Xoá = một bản ghi đánh dấu (tombstone).
   Một kho đồng bộ = mã kho + khoá bí mật (không có tài khoản). Mã nối thiết bị: "<backend>.<mã kho>.<khoá>".

   Kéo về áp dụng với cờ remote: không đẩy ngược lên, giữ nguyên thời gian sửa, không viết lại [[liên kết]] (thiết bị kia đã viết và đã gửi rồi).

   "Có máy chủ" = trang nhận được cấu hình (window.__WEBAPP_CONFIG__.apiBase là CHUỖI). Chuỗi rỗng vẫn là có máy chủ: API nằm ở gốc cùng origin
   (API_PREFIX trống, như .env hiện tại) — giống Code Studio (commit 67995d6). Không có cấu hình (mở file://) thì chỉ lưu trên máy. */
(function (root) {
  "use strict";
  var W = root.Wiki || (root.Wiki = {});
  var BATCH_ITEMS = 100, BATCH_BYTES = 2500000, PAGE = 200, MAX_BACKOFF = 5 * 60 * 1000;
  var BACKENDS = /^(json|mysql|mongo)$/;
  var NO_API = "Máy chủ ở địa chỉ này không có API đồng bộ (/wiki). Kiểm tra API_PREFIX của máy chủ hoặc tải lại trang.";

  /** Đọc gốc API từ cấu hình máy chủ chèn vào trang. {has, base}: has = có máy chủ; base = tiền tố không có "/" cuối ("" = gốc cùng origin). */
  function readApi(cfg) {
    var b = cfg && typeof cfg === "object" ? cfg.apiBase : undefined;
    var has = typeof b === "string";
    return { has: has, base: has ? b.replace(/\/+$/, "") : "" };
  }

  /** Mã nối "<nơi lưu>.<mã kho>.<khoá>" → {backend ("" = mã cũ "default."), ws, key} | null (sai dạng). */
  function parseCode(text) {
    var p = String(text || "").trim().split("."); if (p.length !== 3 || !/^[A-Za-z0-9_-]{1,64}$/.test(p[1]) || !p[2] || p[2].length > 200 || !(p[0] === "default" || BACKENDS.test(p[0]))) return null;
    return { backend: p[0] === "default" ? "" : p[0], ws: p[1], key: p[2] };
  }
  /** Hai mã nối có trỏ CÙNG một kho không: cùng mã kho + khoá; nơi lưu chỉ phân biệt khi cả hai mã đều ghi rõ (mã cũ "default.…" là nơi lưu
      mặc định của máy chủ — có thể chính là "json."/"mysql." của mã kia). Mã sai dạng → false. */
  function sameStore(a, b) {
    var x = parseCode(a), y = parseCode(b);
    return !!(x && y && x.ws === y.ws && x.key === y.key && (!x.backend || !y.backend || x.backend === y.backend));
  }

  function create(repo, opt) {
    opt = opt || {};
    var doFetch = opt.fetch || function () { return root.fetch.apply(root, arguments); };
    var clock = opt.now || function () { return Date.now(); };
    // apiBase: chuỗi (kể cả "") = có máy chủ; null/undefined = không có máy chủ (không gọi mạng, không hẹn chu kỳ).
    var hasApi = opt.apiBase != null;
    var apiBase = hasApi ? String(opt.apiBase).replace(/\/+$/, "") : "";
    var setT = opt.setTimeout || function (f, ms) { return root.setTimeout(f, ms); }, clearT = opt.clearTimeout || function (t) { root.clearTimeout(t); };
    var creds = null, cursor = 0, running = null, again = false, applying = false, timer = 0, attempts = 0, listeners = [], started = false, stopped = false, known = null;
    // loaded: đã đọc khoá kho từ máy (trước đó giao diện chưa biết máy này đã nối kho hay chưa — đừng hỏi máy chủ, đừng mời "Tạo kho").
    // lost: lỗi dứt khoát vì MẤT KHO thật (401 / 404 + wiki_not_found) — khác wiki_no_api (địa chỉ không có API) và kho đầy.
    var st = { phase: "idle", done: 0, total: 0, last: 0, error: "", errorCode: "", fatal: false, lost: false, pending: 0, skipped: 0, loaded: false };

    function notify() { var s = state(); listeners.slice().forEach(function (f) { try { f(s); } catch (e) { /* người nghe lỗi không làm hỏng đồng bộ */ } }); }
    function state() { return Object.assign({}, st, { configured: !!creds, available: hasApi, backend: creds ? creds.backend : "", online: opt.online ? opt.online() : true }); }
    function set(patch) { Object.assign(st, patch); notify(); }

    // ------------------------------------------------------------------------------------------------ gọi máy chủ
    function SyncError(status, code, message, retryAfter) { var e = new Error(message || "Lỗi đồng bộ"); e.status = status; e.code = code || ""; e.retryAfter = retryAfter || 0; return e; }
    function url(path, backend, qs) {
      var q = []; if (backend) q.push("backend=" + encodeURIComponent(backend));
      Object.keys(qs || {}).forEach(function (k) { q.push(k + "=" + encodeURIComponent(qs[k])); });
      return apiBase + "/wiki" + path + (q.length ? "?" + q.join("&") : "");
    }
    function call(method, path, o) {
      o = o || {};
      if (!hasApi) return Promise.reject(SyncError(0, "no_server", "Không có máy chủ để đồng bộ — mở app qua máy chủ (…/webapp/tranphuc8a/personal-wiki/)."));
      var headers = { Accept: "application/json" }; if (o.key) headers["X-Wiki-Key"] = o.key;
      var body; if (o.body !== undefined) { headers["Content-Type"] = "application/json"; body = JSON.stringify(o.body); }
      return Promise.resolve().then(function () { return doFetch(url(path, o.backend, o.qs), { method: method, headers: headers, body: body, cache: "no-store", credentials: "omit" }); }).then(function (res) {
        return res.text().then(function (txt) {
          var j = null; try { j = txt ? JSON.parse(txt) : null; } catch (e) { j = null; }
          if (res.ok) return j;
          var d = (j && j.data) || {};
          // 404 KHÔNG có mã của /wiki (trang 404 của FastAPI/proxy, sai tiền tố API) ≠ "kho đã mất" (404 + wiki_not_found).
          var noApi = res.status === 404 && !d.code;
          var err = SyncError(res.status, noApi ? "wiki_no_api" : d.code, noApi ? NO_API : (j && j.message) || ("Máy chủ trả lỗi " + res.status), +(res.headers && res.headers.get && res.headers.get("Retry-After")) || d.retryAfter || 0);
          err.itemId = d.itemId || ""; throw err;
        });
      }, function () { throw SyncError(0, "network", "Không kết nối được máy chủ"); });
    }
    /** Mất quyền vào kho: sai/đổi khoá (401) hoặc máy chủ nói rõ kho không tồn tại (404 + wiki_not_found). */
    function lostWorkspace(e) { return e.status === 401 || (e.status === 404 && e.code === "wiki_not_found"); }
    function cred(path, o) { return call(o.method || "GET", "/" + creds.ws + path, Object.assign({ key: creds.key, backend: creds.backend }, o)); }

    // ------------------------------------------------------------------------------------------------ cài đặt kho
    function load() {
      return Promise.all([repo.getMeta("sync"), repo.getMeta("syncCursor"), repo.getMeta("syncLast"), repo.getMeta("syncSkipped")]).then(function (r) {
        creds = r[0] && r[0].ws && r[0].key ? { ws: r[0].ws, key: r[0].key, backend: r[0].backend || "" } : null;
        cursor = +r[1] || 0; st.last = +r[2] || 0; st.skipped = (r[3] && r[3].count) || 0; st.loaded = true;
      });
    }
    function save() { return Promise.all([repo.setMeta("sync", creds), repo.setMeta("syncCursor", cursor), repo.setMeta("syncLast", st.last)]); }
    function forget() {
      creds = null; cursor = 0; st.last = 0; st.error = ""; st.errorCode = ""; st.fatal = false; st.lost = false; st.pending = 0; st.skipped = 0; st.phase = "idle";
      return Promise.all([repo.setMeta("sync", null), repo.setMeta("syncCursor", 0), repo.setMeta("syncLast", 0), repo.setMeta("syncSkipped", null)]).then(notify);
    }
    function connect(c, fresh) {
      creds = c; cursor = 0; st.error = ""; st.errorCode = ""; st.fatal = false; st.lost = false; attempts = 0;
      return save().then(function () { return repo.markAllChanged(); }).then(function () { notify(); schedule(0); return fresh; });
    }
    /** Tạo kho mới trên máy chủ rồi đẩy toàn bộ ghi chú hiện có lên.
        Không chọn nơi lưu ("" = mặc định của máy chủ) thì ghi rõ nơi lưu mặc định đã biết (từ backends()) vào mã nối: máy chủ đổi
        WIKI_STORAGE_BACKEND về sau thì mã cũ vẫn trỏ đúng kho. Chưa hỏi backends() thì giữ "default" như trước. */
    function createWorkspace(backend) {
      var b = backend || (known && BACKENDS.test(known.default || "") ? known.default : "");
      return call("POST", "/workspaces", { backend: b }).then(function (r) { var c = { ws: r.workspaceId, key: r.key, backend: b }; return connect(c, code(c)); });
    }
    function code(c) { c = c || creds; return c ? [c.backend || "default", c.ws, c.key].join(".") : ""; }
    /** Mã nối KHÔNG phụ thuộc "default.": máy đã nối bằng mã cũ "default.<kho>.<khoá>" (kho nằm ở nơi lưu mặc định của máy chủ lúc đó) thì hỏi
        nơi lưu mặc định hiện tại, thử đọc kho ở ĐÚNG nơi đó (?backend=<tên>, limit=1); thấy kho mới ghi hẳn tên nơi lưu vào khoá trên máy.
        Không xác nhận được (mạng, kho không ở đó) thì giữ nguyên mã cũ — vẫn nối được như trước. → Promise<mã nối>. */
    function fullCode() {
      if (!creds || creds.backend || !hasApi) return Promise.resolve(code());
      var c0 = creds;
      return backends().then(function (b) {
        var d = b && BACKENDS.test(b.default || "") ? b.default : "";
        if (!d) return code();
        return call("GET", "/" + c0.ws + "/items", { key: c0.key, backend: d, qs: { since: 0, limit: 1 } }).then(function () {
          if (creds !== c0 || creds.backend) return code();                  // trong lúc chờ đã nối kho khác / đã ghi rồi
          creds = Object.assign({}, c0, { backend: d });
          return repo.setMeta("sync", creds).then(function () { notify(); return code(); });
        });
      }).catch(function () { return code(); });
    }
    /** Nối máy này vào kho có sẵn (mã nối từ thiết bị khác). Kiểm tra khoá trước khi lưu. */
    function join(text) {
      var c = parseCode(text);
      if (!c) return Promise.reject(SyncError(0, "bad_code", "Mã nối không đúng dạng (<nơi lưu>.<mã kho>.<khoá>, vd json.wk_….…)."));
      return call("GET", "/" + c.ws + "/items", { key: c.key, backend: c.backend, qs: { since: 0, limit: 1 } }).then(function () { return connect(c, true); });
    }
    function leave() { if (timer) { clearT(timer); timer = 0; } return forget(); }
    function deleteRemote() {
      if (!creds) return Promise.resolve(false);
      return cred("", { method: "DELETE" }).then(function () { return leave(); }).then(function () { return true; });
    }
    function backends() { return call("GET", "/backends").then(function (b) { known = b && typeof b === "object" ? b : null; return b; }); }

    // ------------------------------------------------------------------------------------------------ gửi
    function record(c) {
      if (c.kind === "card") {
        return repo.getCard(c.rid).then(function (card) { return card ? { id: "card:" + c.rid, kind: "card", updatedAt: card.updated_at, deleted: false, data: card } : null; });
      }
      if (c.del) return Promise.resolve({ id: c.rid, kind: "note", updatedAt: c.ts, deleted: true, data: {} });
      return repo.get(c.rid).then(function (n) { return n ? { id: n.id, kind: "note", updatedAt: n.updated_at, deleted: false, data: n } : { id: c.rid, kind: "note", updatedAt: c.ts, deleted: true, data: {} }; });
    }
    function bytes(rec) { return JSON.stringify(rec).length * 1.1; }
    function skip(change) {
      return repo.ackChanges([{ id: change.id, ts: change.ts }]).then(function () { return repo.getMeta("syncSkipped"); }).then(function (m) {
        var count = ((m && m.count) || 0) + 1; st.skipped = count; return repo.setMeta("syncSkipped", { count: count, last: change.id, at: clock() });
      });
    }
    function push() {
      return repo.pendingChanges(BATCH_ITEMS).then(function (changes) {
        if (!changes.length) return null;
        var recs = [], by = {}, acks = [], used = 0, i = 0;
        function next() {
          if (i >= changes.length || used >= BATCH_BYTES) return Promise.resolve();
          var c = changes[i++];
          return record(c).then(function (r) {
            if (!r) { acks.push({ id: c.id, ts: c.ts }); return next(); }          // thẻ đã biến mất cùng note của nó
            used += bytes(r); recs.push(r); by[r.id] = c; acks.push({ id: c.id, ts: c.ts });
            return next();
          });
        }
        return next().then(function () {
          if (!recs.length) return repo.ackChanges(acks).then(push);
          return cred("/items", { method: "PUT", body: { items: recs } }).then(function () {
            return repo.ackChanges(acks).then(function () { st.done += acks.length; set({ phase: "push" }); return push(); });
          }, function (e) {
            var bad = e.status === 400 && e.code !== "wiki_bad_clock" ? e.itemId : ""; if (bad && by[bad]) return skip(by[bad]).then(push);        // một bản ghi bị từ chối không được chặn cả hàng đợi
            throw e;
          });
        });
      });
    }

    // ------------------------------------------------------------------------------------------------ kéo về
    function applyNotes(records) {
      var fresh = [], update = [], gone = [];
      records.forEach(function (r) {
        var local = repo.head(r.id);
        if (r.deleted) { if (local) gone.push({ r: r, local: local }); return; }
        if (!local) { fresh.push(Object.assign({}, r.data, { id: r.id, updated_at: r.updatedAt })); return; }
        if (r.updatedAt > local.u) update.push(Object.assign({}, r.data, { id: r.id, updated_at: r.updatedAt }));
      });
      var p = Promise.resolve();
      if (fresh.length) p = p.then(function () { return repo.bulkAdd(fresh); });
      update.forEach(function (n) { p = p.then(function () { return repo.save(n, { remote: true, keepTime: true, force: true, noRewrite: true }); }); });
      gone.forEach(function (g) {
        p = p.then(function () {
          if (g.local.u > g.r.updatedAt) return repo.queueChange("note", g.r.id);           // máy này sửa SAU lúc bên kia xoá: bản sửa phải thắng, gửi lại
          return repo.removeForever(g.r.id, { remote: true });
        });
      });
      return p;
    }
    function applyCards(records, deferred) {
      var p = Promise.resolve();
      records.forEach(function (r) {
        p = p.then(function () {
          if (r.deleted) return null;
          return repo.applyCard(Object.assign({}, r.data)).then(function (ok) { if (!ok && !deferred.some(function (d) { return d.id === r.id; })) deferred.push(r); }, function () { /* thẻ hỏng: bỏ qua */ });
        });
      });
      return p;
    }
    function pull() {
      var deferred = [];
      function page() {
        return cred("/items", { qs: { since: cursor, limit: PAGE } }).then(function (res) {
          var items = res.items || [], notes = items.filter(function (x) { return x.kind === "note"; }), cards = items.filter(function (x) { return x.kind === "card"; });
          st.done += notes.length; set({ phase: "pull" });
          return applyNotes(notes).then(function () { return applyCards(cards.map(function (c) { return Object.assign({}, c, { data: Object.assign({}, c.data) }); }), deferred); }).then(function () {
            cursor = Math.max(cursor, +res.serverTime || 0);
            return repo.setMeta("syncCursor", cursor);
          }).then(function () { return res.more ? page() : null; });
        });
      }
      return page().then(function () {
        // thẻ ôn đến trước note của nó (khác trang): thử lại sau khi mọi note đã vào
        return deferred.reduce(function (p, r) { return p.then(function () { return repo.applyCard(Object.assign({}, r.data)).catch(function () {}); }); }, Promise.resolve());
      });
    }

    // ------------------------------------------------------------------------------------------------ vòng đồng bộ
    function backoff(e) {
      attempts++;
      var wait = e && e.retryAfter ? e.retryAfter * 1000 : Math.min(MAX_BACKOFF, 15000 * Math.pow(2, attempts - 1));
      schedule(wait);
    }
    function describe(e) {
      if (e.code === "wiki_bad_clock") return e.message;                                        // "Đồng hồ thiết bị lệch hơn 1 ngày…": sửa giờ máy, không phải lỗi của một ghi chú
      if (e.code === "wiki_workspace_full") return "Kho đồng bộ đã đầy (hết hạn mức số ghi chú của máy chủ). Xoá bớt ghi chú hoặc dùng kho khác.";
      if (e.code === "wiki_too_large") return "Gói dữ liệu gửi lên quá lớn so với giới hạn máy chủ.";
      if (e.code === "wiki_no_api") return NO_API;                                                // không phải mất kho: đừng bảo người dùng nối lại
      if (lostWorkspace(e)) return "Không còn truy cập vào kho đồng bộ (sai khoá hoặc kho đã bị xoá). Hãy nối lại.";
      if (e.code === "network") return "Chưa kết nối được máy chủ — sẽ thử lại.";
      if (e.status === 429) return "Máy chủ đang giới hạn tốc độ — sẽ thử lại sau ít phút.";
      return e.message || "Lỗi đồng bộ";
    }
    function cycle() {
      if (!creds || stopped || !hasApi) return Promise.resolve(false);
      if (opt.online && !opt.online()) { set({ phase: "offline", error: "", errorCode: "" }); return Promise.resolve(false); }
      if (running) { again = true; return running; }
      st.done = 0; st.error = ""; st.errorCode = ""; st.fatal = false; st.lost = false;
      running = repo.pendingCount().then(function (n) { st.total = n; st.pending = n; set({ phase: "push" }); return push(); })
        .then(function () { applying = true; return pull(); }).then(function () { applying = false; return repo.pendingCount(); }).then(function (n) {
          st.last = clock(); st.pending = n; attempts = 0; if (n > 0) again = true;                // người dùng sửa thêm trong lúc đang đồng bộ
          return repo.setMeta("syncLast", st.last).then(function () { set({ phase: "idle", error: "", errorCode: "" }); return true; });
        }).catch(function (e) {
          // dừng hẳn (chờ người dùng): mất kho, kho đầy, hoặc địa chỉ này không có API (thử lại vô ích tới khi sửa cấu hình; "Đồng bộ ngay" vẫn thử lại được)
          var lost = lostWorkspace(e), fatal = lost || e.code === "wiki_no_api" || e.code === "wiki_workspace_full";
          set({ phase: "error", error: describe(e), errorCode: e.code || (e.status ? "http_" + e.status : ""), fatal: fatal, lost: lost });
          if (!fatal) backoff(e);
          return false;
        }).then(function (ok) {
          applying = false; running = null;
          if (again && creds && !st.fatal) { again = false; schedule(500); }
          return ok;
        });
      return running;
    }
    function schedule(ms) {
      if (!creds || stopped || st.fatal || !hasApi) return;
      if (timer) clearT(timer);
      timer = setT(function () { timer = 0; cycle(); }, ms);
    }
    /** Đồng bộ ngay (nút "Đồng bộ ngay"): thử lại cả khi đang chờ lùi lại sau lỗi. */
    function now() { if (timer) { clearT(timer); timer = 0; } if (st.fatal) st.fatal = false; return cycle(); }

    // ------------------------------------------------------------------------------------------------ khởi động
    function onRepo(ev) {
      if (!creds || applying) return;
      if (ev.type === "wipe") { forget().then(function () { if (opt.onDisconnect) opt.onDisconnect("wipe"); }); return; }
      if (ev.type === "bulk") { repo.markAllChanged().then(function () { schedule(1500); }); return; }       // nhập hàng loạt không đi qua hàng đợi từng note
      if ((ev.type === "save" || ev.type === "remove" || ev.type === "card") && !ev.remote) schedule(3000);
    }
    function start() {
      if (started) return Promise.resolve();
      started = true;
      repo.on(onRepo);
      return load().then(function () {
        notify();                                                                   // loaded: giao diện biết máy này đã nối kho hay chưa
        if (creds) schedule(800);
        if (root.addEventListener) {
          root.addEventListener("online", function () { if (creds) schedule(500); });
          root.addEventListener("offline", function () { if (creds) set({ phase: "offline" }); });
          if (root.document) root.document.addEventListener("visibilitychange", function () { if (root.document.visibilityState === "visible" && creds && clock() - st.last > 60000) schedule(300); });
          root.setInterval && root.setInterval(function () { if (creds && root.document && root.document.visibilityState === "visible" && !st.fatal && clock() - st.last > 90000) schedule(0); }, 60000);
        }
      });
    }
    function stop() { stopped = true; if (timer) { clearT(timer); timer = 0; } }

    return {
      start: start, stop: stop, load: load, state: state, on: function (f) { listeners.push(f); return function () { var i = listeners.indexOf(f); if (i !== -1) listeners.splice(i, 1); }; },
      create: createWorkspace, join: join, leave: leave, deleteRemote: deleteRemote, backends: backends, now: now, code: function () { return code(); }, fullCode: fullCode, parseCode: parseCode, cycle: cycle
    };
  }

  // ================================================================================================ hàm thuần cho giao diện (kiem.js kiểm)

  /** Vì sao bảng Đồng bộ chưa dùng được. env {available, online, protocol} → "file" (mở tệp trực tiếp) | "no_config" (http(s) nhưng trang
      không có cấu hình máy chủ) | "offline" (có máy chủ, đang mất mạng) | "" (dùng được). Offline chỉ chặn việc HỎI máy chủ (chưa nối kho);
      kho đã nối thì vẫn hiện trạng thái "ngoại tuyến — sẽ đồng bộ khi có mạng". */
  function blocker(env) {
    env = env || {};
    if (!env.available) return env.protocol === "file:" ? "file" : "no_config";
    return env.online === false ? "offline" : "";
  }

  /** Nơi lưu nên chọn sẵn từ GET /wiki/backends: kho dùng được VÀ bền, ưu tiên mặc định của máy chủ nếu nó bền. Chỉ còn kho tạm
      (JSON ở thư mục tạm, vd /tmp trên Vercel) thì vẫn chọn nhưng ephemeral = true để giao diện cảnh báo. → {id, ephemeral, none}. */
  function chooseBackend(b) {
    var list = (b && Array.isArray(b.backends) ? b.backends : []).filter(function (x) { return x && BACKENDS.test(x.id || ""); });
    var usable = list.filter(function (x) { return x.available; }), durable = usable.filter(function (x) { return x.persistent; });
    function prefer(xs) { return xs.filter(function (x) { return x.id === b.default; })[0] || xs[0]; }
    if (durable.length) return { id: prefer(durable).id, ephemeral: false, none: false };
    if (usable.length) return { id: prefer(usable).id, ephemeral: true, none: false };
    return { id: "", ephemeral: false, none: true };
  }
  /** Nơi lưu `id` có phải kho tạm (dùng được nhưng không bền) không. */
  function isEphemeral(b, id) {
    var x = (b && Array.isArray(b.backends) ? b.backends : []).filter(function (y) { return y && y.id === id; })[0];
    return !!(x && x.available && !x.persistent);
  }

  /** Liên kết nối thiết bị: địa chỉ THƯ MỤC của app (bỏ index.html, ?source=pwa, #…) + "#/join/<mã>". Mã nằm sau "#" nên không bao giờ
      được gửi lên máy chủ trong yêu cầu HTTP. */
  function joinLink(href, codeText) {
    var dir = String(href || "").split("#")[0].split("?")[0].replace(/[^\/]*$/, "");
    return dir + "#/join/" + encodeURIComponent(String(codeText || ""));
  }

  /** Chữ ngắn cho chỉ báo trạng thái (chip ở thanh bên, mục trong menu "Thêm"). s = state(), now = Date.now().
      → {kind: "none" (không có máy chủ: ẩn) | "loading" | "off" (chưa nối kho) | "ok" | "busy" | "offline" | "error" (sẽ tự thử lại) | "fatal" (dừng, cần người dùng), text, title}. */
  function statusView(s, now) {
    s = s || {};
    var T = W.text, fmt = function (n) { return Number(n || 0).toLocaleString("vi-VN"); };
    var rel = function (ms) { return T && T.relTime ? T.relTime(ms, now || Date.now()) : ""; };
    var waiting = s.pending ? " · còn " + fmt(s.pending) + " thay đổi chờ gửi" : "";
    if (!s.available) return { kind: "none", text: "", title: "" };
    if (!s.loaded) return { kind: "loading", text: "Đồng bộ…", title: "Đang đọc cài đặt đồng bộ" };
    if (!s.configured) return { kind: "off", text: "Bật đồng bộ", title: "Chưa đồng bộ giữa các thiết bị — bấm để bật" };
    if (s.fatal) return { kind: "fatal", text: s.lost ? "Mất kho đồng bộ" : "Đồng bộ đã dừng", title: s.error || "Đồng bộ đã dừng" };
    if (s.phase === "push") return { kind: "busy", text: "Đang gửi" + (s.total ? " " + fmt(Math.max(0, s.total - s.done)) : "") + "…", title: "Đang gửi thay đổi lên máy chủ" };
    if (s.phase === "pull") return { kind: "busy", text: "Đang nhận…", title: "Đang kéo thay đổi từ máy chủ về" };
    if (s.phase === "offline" || s.online === false) return { kind: "offline", text: "Ngoại tuyến", title: "Đang ngoại tuyến — sẽ đồng bộ khi có mạng" + waiting };
    if (s.phase === "error") return { kind: "error", text: "Lỗi đồng bộ", title: (s.error || "Lỗi đồng bộ") + " Sẽ tự thử lại." + waiting };
    if (s.last) return { kind: "ok", text: rel(s.last) === "vừa xong" ? "Vừa đồng bộ xong" : "Đã đồng bộ " + rel(s.last), title:"Lần cuối: " + (T && T.fmtDateTime ? T.fmtDateTime(s.last) : "") + waiting };
    return { kind: "busy", text: "Chờ đồng bộ…", title: "Sắp đồng bộ lần đầu" };
  }

  /** Gốc API dùng chung cho mọi phần cần máy chủ (đồng bộ ở đây; AI soạn note — data/ai.js — đọc cùng chỗ này, không tự đọc cấu hình).
      Wiki.api.has: có máy chủ; Wiki.api.base: tiền tố ("" = gốc cùng origin); Wiki.api.url("/wiki/backends") → địa chỉ đầy đủ;
      Wiki.api.refresh(): đọc lại window.__WEBAPP_CONFIG__ (start() gọi); Wiki.api.read(cfg): hàm thuần để kiểm. */
  W.api = { has: false, base: "", read: readApi,
    url: function (path) { return W.api.base + path; },
    refresh: function () { var a = readApi(root.__WEBAPP_CONFIG__); W.api.has = a.has; W.api.base = a.base; return W.api; } };
  W.api.refresh();

  W.sync = { create: create, instance: null, readApi: readApi, blocker: blocker, chooseBackend: chooseBackend, isEphemeral: isEphemeral, joinLink: joinLink, statusView: statusView, NO_API: NO_API,
    parseCode: parseCode, sameStore: sameStore,
    /** Gọi từ app.js sau khi kho mở: dựng bộ đồng bộ với địa chỉ API do máy chủ chèn vào trang (window.__WEBAPP_CONFIG__.apiBase). */
    start: function (ctx) {
      var api = W.api.refresh();
      W.sync.instance = create(ctx.repo, { apiBase: api.has ? api.base : null, online: function () { return !root.navigator || root.navigator.onLine !== false; }, onDisconnect: function () { if (ctx.toast) ctx.toast("Dữ liệu trên máy đã bị xoá nên đã ngắt đồng bộ. Nối lại trong Cài đặt để lấy lại từ kho."); } });
      return W.sync.instance.start();
    } };
  if (typeof module !== "undefined" && module.exports) module.exports = W.sync;
})(typeof globalThis !== "undefined" ? globalThis : this);
