/* ai.js — gọi AI của máy chủ để tách văn bản thường thành giao dịch (POST /ai/spending).
   Chỉ chạy trong trình duyệt. Kết quả chỉ là ĐỀ XUẤT: hộp "Nhập từ văn bản" cho xem, chọn, rồi mới lưu.

   Cùng giao thức và cùng chỗ cất token với courses/engine/ai-khach.js (GET /ai/status, POST /ai/session,
   header X-Admin-Session / X-AI-Session, khoá localStorage theo gốc API) — mở khoá AI ở trang khác của
   cùng máy chủ là dùng được ở đây. Không nạp thẳng tệp đó: nó nằm ngoài thư mục app nên service worker
   không lưu được (offline hỏng) và mở bằng file:// thì không có.

   QL.ai.status(force)   → Promise<{enabled, allowed, needs: null|"code"|"admin", …}> (nhớ 30 giây; force = hỏi lại)
   QL.ai.unlock(code)    → Promise: đổi mã truy cập AI lấy token, cất trên máy
   QL.ai.parse(text, doc, today) → Promise<{transactions, ignored}> (máy chủ đã kiểm id)
   Lỗi là Error có .code (data.code của máy chủ; "network" khi không tới được) và .status. */
(function (root) {
  "use strict";
  var QL = root.QL || (root.QL = {});
  var TEXT_CHARS = 6000;          // = TEXT_CHARS của ai_spending_usecase.py
  var STATUS_MS = 30000;          // quyền có thể đổi ở trang khác (đăng nhập quản trị) — đừng nhớ lâu
  var statusOf = {};              // gốc API → {at, promise}

  /** Gốc API: "Địa chỉ máy chủ" người dùng điền (khi mở file trực tiếp), hoặc cái máy chủ chèn vào trang. */
  function base() {
    var eng = QL.app && QL.app.engine, own = eng ? eng.getApiBase() : "", cfg = root.__WEBAPP_CONFIG__ || {};
    return String(own || (typeof cfg.apiBase === "string" ? cfg.apiBase : "") || "").replace(/\/+$/, "");
  }
  function hasServer() { return /^https?:$/.test(root.location.protocol) || !!base(); }

  function readLS(k) { try { return JSON.parse(root.localStorage.getItem(k) || "null"); } catch (e) { return null; } }
  function writeLS(k, v) { try { if (v == null) root.localStorage.removeItem(k); else root.localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* trình duyệt chặn lưu trữ */ } }
  /** Khoá cất token — đúng cách ai-khach.js tính, để hai bên dùng chung. */
  function keys(goc) {
    var du = goc;
    try { du = new URL(goc || "/", root.location.href).href.replace(/\/+$/, ""); } catch (e) { /* giữ nguyên */ }
    return { admin: "qlkh.phien@" + du + ".token", ai: "ai.phien@" + du, model: "ai.model@" + du };
  }
  function headers(goc) {
    var k = keys(goc), h = { "Content-Type": "application/json" };
    var admin = readLS(k.admin);
    if (typeof admin === "string" && admin) h["X-Admin-Session"] = admin;
    var ai = readLS(k.ai);
    if (ai && ai.token) {
      var het = +ai.het || 0;
      if (!het || (het > 1e12 ? het : het * 1000) > Date.now()) h["X-AI-Session"] = ai.token;
      else writeLS(k.ai, null);
    }
    // Model chọn ở trang khác (khoá học, Quản lý khoá học…) của cùng máy chủ — xem ai-khach.js.
    var model = readLS(k.model);
    if (typeof model === "string" && /^[a-z0-9][a-z0-9.\-]{1,62}$/.test(model)) h["X-AI-Model"] = model;
    return h;
  }

  function call(path, body, retried) {
    var goc = base();
    if (!hasServer()) {
      var e0 = new Error("Bạn đang mở file trực tiếp — hãy điền “Địa chỉ máy chủ” ở Cài đặt để dùng AI.");
      e0.code = "no_server"; return Promise.reject(e0);
    }
    var o = { headers: headers(goc), credentials: "same-origin" };
    if (body !== undefined) { o.method = "POST"; o.body = JSON.stringify(body); }
    return root.fetch(goc + "/ai/" + path, o).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.ok) return j;
        var e = new Error((j && (j.message || (typeof j.detail === "string" && j.detail))) || (r.status === 422 ? "Máy chủ không nhận dữ liệu gửi lên (văn bản quá dài?)" : "Máy chủ trả lỗi " + r.status));
        e.code = ((j && j.data) || {}).code || "";
        e.status = r.status;
        throw e;
      });
    }, function () {
      var e = new Error(root.navigator.onLine === false ? "Đang offline — cần mạng để dùng AI" : "Không kết nối được máy chủ");
      e.code = "network";
      throw e;
    }).catch(function (e) {
      // Model đã chọn không còn / không được dùng: về model mặc định và thử lại một lần.
      if (!retried && /^ai_model_(unknown|admin_only|invalid)$/.test(e.code || "") && readLS(keys(goc).model)) {
        writeLS(keys(goc).model, null);
        return call(path, body, true);
      }
      throw e;
    });
  }

  function status(force) {
    var goc = base(), hit = statusOf[goc];
    if (!hit || force || Date.now() - hit.at > STATUS_MS) {
      hit = statusOf[goc] = { at: Date.now(), promise: call("status").catch(function (e) { delete statusOf[goc]; throw e; }) };
    }
    return hit.promise;
  }

  function unlock(code) {
    return call("session", { code: String(code || "") }).then(function (j) {
      writeLS(keys(base()).ai, { token: j.session, het: j.expiresAt });
      return status(true);
    });
  }

  function parse(text, doc, today) {
    var body = Object.assign({ text: String(text || "").slice(0, TEXT_CHARS), today: today }, QL.parser.aiContext(doc));
    return call("spending", body);
  }

  /** Câu giải thích cho người dùng từ trạng thái (null = dùng được ngay). */
  function blocker(s) {
    if (!s.enabled) return "AI đang tắt hoặc chưa cấu hình trên máy chủ này.";
    if (s.allowed) return null;
    if (s.needs === "code") return "code";
    return "AI của máy chủ này chỉ dành cho quản trị viên — đăng nhập ở trang Quản lý khoá học trên cùng máy chủ rồi thử lại (hoặc nhờ quản trị đặt AI_ACCESS=code).";
  }

  QL.ai = { TEXT_CHARS: TEXT_CHARS, status: status, unlock: unlock, parse: parse, blocker: blocker, hasServer: hasServer };
})(typeof globalThis !== "undefined" ? globalThis : this);
