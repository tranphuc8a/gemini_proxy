/* ai.js — "Giải thích lỗi bằng AI" của Code Studio: dựng yêu cầu POST /ai/code/explain, gọi máy chủ, kiểm lại kết quả và áp đề xuất sửa.
   LÕI THUẦN (fetch, kho cất token và địa chỉ gốc do người gọi đưa vào) nên kiểm được bằng node: kiem-ai.js. Giao diện ở ui/ai.js.

   Giao thức và chỗ cất token GIỐNG HỆT courses/engine/ai-khach.js và quan-ly-chi-tieu/assets/ai.js (GET /ai/status, POST /ai/session,
   header X-Admin-Session / X-AI-Session / X-AI-Model, khoá localStorage theo gốc API) — mở khoá AI ở một trang khác của cùng máy chủ là
   dùng được ở đây. Token không bao giờ gửi sang gốc API khác. Không nạp thẳng ai-khach.js vì nó nằm ngoài thư mục app
   (service worker không lưu được → hỏng offline; mở bằng file:// thì không có).

   Hợp đồng /ai/code/explain (xem docs/code-studio-api.md & ai_code_usecase.py):
     yêu cầu  {language, filename, kind:"compile"|"runtime", code ≤ 30 000 ký tự, diagnostics[≤20]:{line,col,severity,message ≤ 500}, stderr ≤ 4 000}
     trả về   {summary, items:[{line|null,title,why,fix}], patch: null | {line,endLine,replacement}, cached}
   `patch` thay các dòng line..endLine (1-based, gồm hai đầu); replacement "" nghĩa là XOÁ các dòng đó.
   Kết quả của AI chỉ là ĐỀ XUẤT: luôn hiển thị bằng textContent, cho người dùng xem trước rồi mới áp, và chỉ áp khi mã chưa đổi từ lúc hỏi. */
(function (root) {
  "use strict";
  var CS = root.CS || (root.CS = {});

  var LIMITS = { code: 30000, diagnostics: 20, message: 500, stderr: 4000, filename: 200, language: 32, items: 8, summary: 400, title: 120, why: 600, fix: 600, patchLines: 40, replacement: 4000 };
  var CTRL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩﻿]/g;
  var MODEL_RE = /^[a-z0-9][a-z0-9.\-]{1,62}$/;
  var SEVERITIES = { error: 1, warning: 1, note: 1 };

  function isObj(v) { return !!v && typeof v === "object" && !Array.isArray(v); }
  function str(v) { return typeof v === "string" ? v : (v == null ? "" : String(v)); }
  function lf(s) { return str(s).replace(/\r\n?/g, "\n"); }
  function cut(s, max) {
    s = str(s);
    if (s.length <= max) return s;
    var c = s.slice(0, max);
    return /[\ud800-\udbff]$/.test(c) ? c.slice(0, -1) : c;
  }
  function oneLine(s, max) { return cut(str(s).replace(CTRL, "").replace(/\s+/g, " ").trim(), max); }
  function block(s, max) { return cut(str(s).replace(CTRL, ""), max).replace(/[ \t]+$/gm, "").trim(); }
  function toInt(v, lo, hi) { return typeof v === "number" && isFinite(v) && Math.floor(v) === v && v >= lo && v <= hi ? v : null; }
  function fail(msg, code, extra) { var e = new Error(msg); e.code = code; if (extra) Object.keys(extra).forEach(function (k) { e[k] = extra[k]; }); return e; }

  /* ------------------------------------------------------------------ dựng yêu cầu */
  /**
   * o = {language, filename, kind, code, diagnostics:[{line,col,severity,message}], stderr}
   * → {req, sentLines, totalLines, truncated}. Tệp dài hơn 30 000 ký tự: chỉ gửi PHẦN ĐẦU (cắt ở ranh giới dòng) để số dòng vẫn đúng;
   * chẩn đoán nằm ngoài phần gửi bị bỏ. Lỗi `code_too_long` khi mọi lỗi đều nằm ngoài phần gửi (AI không có gì để xem).
   */
  function buildExplainRequest(o) {
    o = o || {};
    var kind = o.kind === "runtime" ? "runtime" : "compile";
    var text = lf(o.code), lines = text.split("\n"), total = lines.length, sent = text, truncated = false;
    if (text.length > LIMITS.code) {
      var keep = [], used = 0;
      for (var i = 0; i < lines.length; i++) {
        var add = lines[i].length + (keep.length ? 1 : 0);
        if (used + add > LIMITS.code) break;
        keep.push(lines[i]); used += add;
      }
      sent = keep.join("\n"); truncated = true;
    }
    var sentLines = sent.split("\n").length;
    var diags = (Array.isArray(o.diagnostics) ? o.diagnostics : []).filter(isObj).map(function (d) {
      return { line: toInt(d.line, 0, 10000000) || 0, col: toInt(d.col, 0, 10000000) || 0, severity: SEVERITIES[d.severity] ? d.severity : "error", message: oneLine(d.message, LIMITS.message) };
    }).filter(function (d) { return d.message; });
    var all = diags.length;
    if (truncated) diags = diags.filter(function (d) { return d.line <= sentLines; });
    var stderr = block(o.stderr, LIMITS.stderr);
    if (truncated && all && !diags.length && !stderr) throw fail("Tệp dài quá " + LIMITS.code + " ký tự và lỗi nằm ở phần cuối — chưa hỏi AI được. Hãy tách tệp hoặc thu gọn trước.", "code_too_long");
    diags = diags.slice(0, LIMITS.diagnostics);
    if (!diags.length && !stderr) throw fail("Chưa có thông báo lỗi nào để hỏi AI — hãy chạy chương trình trước.", "code_error_missing");
    var req = { language: oneLine(o.language, LIMITS.language) || "plaintext", filename: oneLine(o.filename, LIMITS.filename), kind: kind, code: sent, diagnostics: diags, stderr: stderr };
    return { req: req, sentLines: sentLines, totalLines: total, truncated: truncated };
  }

  /* ------------------------------------------------------------------ kiểm lại kết quả */
  /** Đầu ra của máy chủ → dạng sạch cho giao diện, kiểm lại theo đúng đoạn mã đã gửi (phòng thủ nhiều lớp: không tin dữ liệu từ xa). */
  function normalizeResult(json, code) {
    if (!isObj(json)) throw fail("Máy chủ trả về dữ liệu AI không đúng định dạng.", "bad_response");
    var nLines = lf(code).split("\n").length;
    var items = (Array.isArray(json.items) ? json.items : []).filter(isObj).slice(0, LIMITS.items).map(function (it) {
      return { line: toInt(it.line, 1, nLines), title: oneLine(it.title, LIMITS.title), why: block(it.why, LIMITS.why), fix: block(it.fix, LIMITS.fix) };
    }).filter(function (it) { return it.title || it.why || it.fix; });
    var summary = oneLine(json.summary, LIMITS.summary);
    if (!summary && !items.length) throw fail("AI không trả về nội dung nào — thử lại.", "bad_response");
    return { summary: summary, items: items, patch: normalizePatch(json.patch, code, nLines), cached: json.cached === true };
  }
  function normalizePatch(p, code, nLines) {
    if (!isObj(p)) return null;
    var line = toInt(p.line, 1, nLines), end = toInt(p.endLine, 1, nLines);
    if (line == null || end == null || end < line || end - line + 1 > LIMITS.patchLines) return null;
    if (typeof p.replacement !== "string" || p.replacement.length > LIMITS.replacement) return null;
    var rep = lf(p.replacement).replace(CTRL, "");
    var old = lf(code).split("\n").slice(line - 1, end).join("\n");
    if (rep === old) return null;
    return { line: line, endLine: end, replacement: rep };
  }
  /** Xem trước đề xuất: {line, endLine, before:[dòng cũ], after:[dòng mới]} (after rỗng = chỉ xoá). */
  function previewPatch(code, patch) {
    var lines = lf(code).split("\n");
    if (!patch || patch.line < 1 || patch.endLine < patch.line || patch.endLine > lines.length) return null;
    return { line: patch.line, endLine: patch.endLine, before: lines.slice(patch.line - 1, patch.endLine), after: patch.replacement === "" ? [] : patch.replacement.split("\n") };
  }
  /** Áp đề xuất vào văn bản. Ném Error "bad_patch" nếu ngoài tệp. Xuống dòng của kết quả luôn là LF. */
  function applyPatch(code, patch) {
    var pv = previewPatch(code, patch);
    if (!pv) throw fail("Đề xuất sửa không khớp tệp hiện tại.", "bad_patch");
    var lines = lf(code).split("\n");
    Array.prototype.splice.apply(lines, [pv.line - 1, pv.endLine - pv.line + 1].concat(pv.after));
    return lines.join("\n");
  }

  /* ------------------------------------------------------------------ máy khách HTTP */
  /**
   * o = {apiBase, fetch, storage (getItem/setItem/removeItem, mặc định localStorage), href (để chuẩn hoá gốc API), now}
   * → {status(force), unlock(code), explain(built, code), keys, headers}
   */
  function client(o) {
    o = o || {};
    var goc = str(o.apiBase).replace(/\/+$/, "");
    var storage = o.storage !== undefined ? o.storage : (function () { try { return root.localStorage; } catch (e) { return null; } })();
    var now = o.now || function () { return Date.now(); };
    var doFetch = "fetch" in o ? o.fetch : (root.fetch ? root.fetch.bind(root) : null);       /* fetch: null có chủ ý = "không có" (kiểm thử) */
    var du = goc;
    try { du = new URL(goc || "/", o.href || (root.location && root.location.href) || "http://localhost/").href.replace(/\/+$/, ""); } catch (e) { /* giữ nguyên */ }
    var K = { admin: "qlkh.phien@" + du + ".token", ai: "ai.phien@" + du, model: "ai.model@" + du };
    var cache = null, cacheAt = 0, memo = Object.create(null), memoKeys = [];

    function read(k) { try { return storage ? JSON.parse(storage.getItem(k) || "null") : null; } catch (e) { return null; } }
    function write(k, v) { try { if (!storage) return; if (v == null) storage.removeItem(k); else storage.setItem(k, JSON.stringify(v)); } catch (e) { /* trình duyệt chặn lưu trữ */ } }
    function model() { var m = read(K.model); return typeof m === "string" && MODEL_RE.test(m) ? m : ""; }
    function headers() {
      var h = { "Content-Type": "application/json" }, admin = read(K.admin), ai = read(K.ai);
      if (typeof admin === "string" && admin) h["X-Admin-Session"] = admin;
      if (ai && ai.token) {
        var het = +ai.het || 0;
        if (!het || (het > 1e12 ? het : het * 1000) > now()) h["X-AI-Session"] = ai.token; else write(K.ai, null);
      }
      if (model()) h["X-AI-Model"] = model();
      return h;
    }
    function call(path, body, retried) {
      if (!doFetch) return Promise.reject(fail("Trình duyệt này không có fetch.", "no_fetch"));
      var init = { headers: headers(), credentials: "same-origin" };
      if (body !== undefined) { init.method = "POST"; init.body = JSON.stringify(body); }
      return Promise.resolve().then(function () { return doFetch(goc + "/ai/" + path, init); }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (r.ok) return j;
          var d = isObj(j && j.data) ? j.data : {};
          var msg = (j && (j.message || (typeof j.detail === "string" && j.detail))) || (r.status === 422 ? "Máy chủ không nhận dữ liệu gửi lên (tệp quá dài?)" : "Máy chủ trả lỗi " + r.status);
          var ra = d.retryAfter != null ? d.retryAfter : (r.headers && r.headers.get ? r.headers.get("Retry-After") : null);
          throw fail(msg, d.code || "", { status: r.status, retryAfter: ra != null && isFinite(Number(ra)) ? Number(ra) : null });
        });
      }, function () {
        throw fail(root.navigator && root.navigator.onLine === false ? "Đang offline — cần mạng để dùng AI" : "Không kết nối được máy chủ", "network");
      }).catch(function (e) {
        /* model đã chọn mà máy chủ không còn / không cho dùng: bỏ lựa chọn rồi thử lại một lần bằng model mặc định */
        if (!retried && /^ai_model_(unknown|admin_only|invalid)$/.test(e.code || "") && model()) { write(K.model, null); return call(path, body, true); }
        throw e;
      });
    }
    /** GET /ai/status → {enabled, allowed, needs: null|"code"|"admin", …}; nhớ 30 giây (quyền có thể đổi ở trang khác). */
    function status(force) {
      if (!cache || force || now() - cacheAt > 30000) { cacheAt = now(); cache = call("status").catch(function (e) { cache = null; throw e; }); }
      return cache;
    }
    function unlock(code) {
      return call("session", { code: str(code) }).then(function (j) { write(K.ai, { token: j.session, het: j.expiresAt }); return status(true); });
    }
    /** Có nên mời dùng AI không: AI bật, và người này được dùng hoặc chỉ thiếu mã truy cập. Chế độ "chỉ quản trị" thì khách không thấy gì. */
    function usable(s) { return !!(s && s.enabled && (s.allowed || s.needs === "code")); }
    /** built = kết quả buildExplainRequest; code = nội dung đã gửi (để kiểm lại kết quả). Cùng yêu cầu thì dùng lại kết quả trong phiên. */
    function explain(built) {
      var key = JSON.stringify(built.req) + "|" + model();
      if (memo[key]) return Promise.resolve(memo[key]);
      return call("code/explain", built.req).then(function (j) {
        var res = normalizeResult(j, built.req.code);
        memo[key] = res; memoKeys.push(key);
        if (memoKeys.length > 20) delete memo[memoKeys.shift()];
        return res;
      });
    }
    return { status: status, unlock: unlock, explain: explain, usable: usable, keys: K, headers: headers, model: model };
  }

  CS.ai = { limits: LIMITS, buildExplainRequest: buildExplainRequest, normalizeResult: normalizeResult, previewPatch: previewPatch, applyPatch: applyPatch, client: client };
  if (typeof module !== "undefined" && module.exports) module.exports = CS.ai;
})(typeof globalThis !== "undefined" ? globalThis : this);
