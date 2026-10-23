/* data/ai.js — gọi AI của máy chủ cho "Soạn bằng AI": GET /ai/status, POST /ai/session (mã truy cập), POST /ai/wiki. Kết quả chỉ là ĐỀ XUẤT:
   màn Soạn bằng AI cho xem trước, sửa, bỏ chọn rồi mới tạo ghi chú (ui/aicompose.js + core/compose.js).

   Gốc API đọc từ Wiki.api (data/sync.js — MỘT chỗ cho cả đồng bộ lẫn AI), không tự đọc window.__WEBAPP_CONFIG__. Không có máy chủ (mở file://)
   → mọi lời gọi từ chối ngay với code "no_server", không gửi gì ra mạng.
   Cùng giao thức và cùng chỗ cất token với courses/engine/ai-khach.js và quan-ly-chi-tieu/assets/ai.js: localStorage
   "ai.phien@<địa chỉ tuyệt đối của gốc API>" (token mã truy cập), "qlkh.phien@<…>.token" (phiên quản trị), "ai.model@<…>" (model đã chọn) —
   mở khoá AI ở trang khác của cùng máy chủ là dùng được ở đây. Không nạp ai-khach.js: nó nằm ngoài thư mục app (service worker không lưu được).

   Wiki.ai.status(force) → Promise<{enabled, allowed, needs: null|"code"|"admin", …}> (nhớ 30 s)
   Wiki.ai.unlock(code)  → Promise<status>: đổi mã truy cập lấy token, cất trên máy
   Wiki.ai.compose(body) → Promise<câu trả lời /ai/wiki> (máy chủ đã kiểm liên kết; compose.plan kiểm lại lúc áp dụng)
   Wiki.ai.blocker(s)    → null (dùng được) | "code" (cần nhập mã) | câu giải thích
   Wiki.ai.create({fetch, storage, href, online, api}) → một bộ gọi riêng (kiem.js dùng fetch giả)
   Lỗi là Error có .code (data.code của máy chủ; "network" khi không tới được; "no_server"), .status, .retryAfter. */
(function (root) {
  "use strict";
  var W = root.Wiki || (root.Wiki = {});
  var STATUS_MS = 30000, MODEL_RE = /^[a-z0-9][a-z0-9.\-]{1,62}$/;

  function create(opt) {
    opt = opt || {};
    var api = opt.api || function () { return W.api || { has: false, base: "" }; };
    var doFetch = opt.fetch || function (u, o) { return root.fetch(u, o); };
    var store = "storage" in opt ? function () { return opt.storage; } : function () { try { return root.localStorage; } catch (e) { return null; } };   // đọc lúc gọi (có thể bị chặn)
    var href = opt.href || function () { return root.location ? root.location.href : "http://localhost/"; };
    var online = opt.online || function () { return !root.navigator || root.navigator.onLine !== false; };
    var statusMemo = null;

    function readLS(k) { try { return JSON.parse(store().getItem(k) || "null"); } catch (e) { return null; } }
    function writeLS(k, v) { try { if (v == null) store().removeItem(k); else store().setItem(k, JSON.stringify(v)); } catch (e) { /* trình duyệt chặn lưu trữ */ } }
    /** Khoá cất token — đúng cách ai-khach.js tính (địa chỉ tuyệt đối của gốc API, bỏ "/" cuối), để mọi trang cùng máy chủ dùng chung. */
    function keys() {
      var a = api(), du = a.base;
      try { du = new URL(a.base || "/", href()).href.replace(/\/+$/, ""); } catch (e) { /* giữ nguyên */ }
      return { admin: "qlkh.phien@" + du + ".token", ai: "ai.phien@" + du, model: "ai.model@" + du };
    }
    function headers() {
      var k = keys(), h = { "Content-Type": "application/json" };
      var admin = readLS(k.admin);
      if (typeof admin === "string" && admin) h["X-Admin-Session"] = admin;
      var ai = readLS(k.ai);
      if (ai && ai.token) {
        var het = +ai.het || 0;
        if (!het || (het > 1e12 ? het : het * 1000) > Date.now()) h["X-AI-Session"] = ai.token;
        else writeLS(k.ai, null);
      }
      var model = readLS(k.model);
      if (typeof model === "string" && MODEL_RE.test(model)) h["X-AI-Model"] = model;
      return h;
    }
    function fail(code, message, status, extra) { var e = new Error(message); e.code = code; e.status = status || 0; if (extra) Object.assign(e, extra); return e; }

    function call(path, body, retried) {
      var a = api();
      if (!a.has) return Promise.reject(fail("no_server", "Soạn bằng AI cần mở app qua máy chủ (…/webapp/tranphuc8a/personal-wiki/)."));
      var o = { method: body === undefined ? "GET" : "POST", headers: headers(), credentials: "same-origin", cache: "no-store" };
      if (body !== undefined) o.body = JSON.stringify(body);
      return Promise.resolve().then(function () { return doFetch(a.base + "/ai/" + path, o); }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (r.ok) return j;
          var d = (j && j.data) || {}, noRoute = r.status === 404 && !d.code;      // máy chủ cũ (chưa có /ai/wiki) hoặc sai tiền tố API
          var msg = noRoute ? "Máy chủ này chưa có tính năng Soạn bằng AI (/ai/wiki) — cập nhật máy chủ hoặc tải lại trang." :
            (j && (j.message || (typeof j.detail === "string" && j.detail))) || (r.status === 422 ? "Máy chủ không nhận dữ liệu gửi lên (văn bản quá dài?)" : "Máy chủ trả lỗi " + r.status);
          throw fail(noRoute ? "ai_no_route" : d.code || "", msg, r.status, d.retryAfter ? { retryAfter: +d.retryAfter } : null);
        });
      }, function () {
        throw fail("network", online() ? "Không kết nối được máy chủ — thử lại sau." : "Đang ngoại tuyến — cần mạng để dùng AI.");
      }).catch(function (e) {
        // Model đã chọn ở trang khác không còn / không được dùng: về model mặc định và gọi lại một lần.
        if (!retried && /^ai_model_(unknown|admin_only|invalid)$/.test(e.code || "") && readLS(keys().model)) { writeLS(keys().model, null); return call(path, body, true); }
        throw e;
      });
    }

    function status(force) {
      var base = api().base;
      if (!statusMemo || force || statusMemo.base !== base || Date.now() - statusMemo.at > STATUS_MS) {
        var memo = statusMemo = { at: Date.now(), base: base, promise: null };
        memo.promise = call("status").catch(function (e) { if (statusMemo === memo) statusMemo = null; throw e; });
      }
      return statusMemo.promise;
    }
    function unlock(code) {
      return call("session", { code: String(code || "").trim() }).then(function (j) {
        writeLS(keys().ai, { token: j.session, het: j.expiresAt });
        return status(true);
      });
    }
    function compose(body) { return call("wiki", body); }

    return { status: status, unlock: unlock, compose: compose, blocker: blocker, keys: keys, headers: headers };
  }

  /** Câu giải thích từ GET /ai/status (null = dùng được ngay; "code" = cần ô nhập mã). */
  function blocker(s) {
    s = s || {};
    if (!s.enabled) return "AI đang tắt hoặc chưa cấu hình trên máy chủ này.";
    if (s.allowed) return null;
    if (s.needs === "code") return "code";
    return "AI của máy chủ này chỉ dành cho quản trị viên — đăng nhập ở trang Quản lý khoá học trên cùng máy chủ rồi thử lại (hoặc nhờ quản trị đặt AI_ACCESS=code).";
  }

  W.ai = Object.assign(create(), { create: create, blocker: blocker });
  if (typeof module !== "undefined" && module.exports) module.exports = W.ai;
})(typeof globalThis !== "undefined" ? globalThis : this);
