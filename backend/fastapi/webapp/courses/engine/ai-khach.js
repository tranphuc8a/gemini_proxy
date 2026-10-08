/* ==========================================================================
   AI-KHÁCH — gọi tính năng AI của máy chủ từ một trang tĩnh (khoá học, OPIc).

   ★ NGUỒN THẬT: courses/engine/ai-khach.js — `python engine/sync.py` chép sang
     assets/ của các trang dùng AI (nhóm "ai_khach" trong dong-bo.json).

   AiKhach.tao(gocApi) → khách gắn với MỘT gốc API:
     .trangThai(moi)    GET /ai/status — hỏi một lần; moi=true hỏi lại (vd sau khi
                        nhập mã truy cập)
     .dungDuoc(s)       trang có nên mời dùng AI không: AI bật, và người này được
                        dùng hoặc chỉ thiếu mã truy cập. Chế độ "chỉ quản trị viên"
                        thì khách không thấy gì.
     .goi(duong, body)  GET /ai/<duong>, hoặc POST khi có body; lỗi → Error có .ma
                        (data.code của máy chủ, "mang" khi không tới được) và .status
     .oMa(xong, lopNut) ô nhập mã truy cập AI: POST /ai/session rồi cất token trên
                        máy; xong() khi mở khoá được
     .model() / .datModel(id)  model Gemini người dùng chọn ("" = mặc định của máy
                        chủ) — cất theo gốc API, DÙNG CHUNG cho mọi trang/ứng dụng
                        của máy chủ đó; gửi kèm mọi lời gọi qua header X-AI-Model
     .dsModel(moi)      GET /ai/models — danh sách model (mới nhất trước), mỗi model
                        có allowed (dòng Pro chỉ cho quản trị viên)
     .oModel(lop)       ô chọn model (<label><select>) — đổi là áp dụng ngay
   Người gọi được nhận diện bằng header: X-Admin-Session (token phiên mà trang
   Quản lý cất cho ĐÚNG gốc API này — quản trị viên) và X-AI-Session (token mã
   truy cập AI). Token không bao giờ được gửi sang một gốc API khác.
   Model đã chọn mà máy chủ không còn (400 ai_model_unknown / 403 ai_model_admin_only):
   bỏ lựa chọn đó và gọi lại một lần bằng model mặc định — tính năng vẫn chạy.
   ========================================================================== */
(function () {
  "use strict";
  if (window.AiKhach) return;

  function docLS(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
  function ghiLS(k, v) {
    try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
  }

  function tao(goc) {
    goc = String(goc || "").replace(/\/+$/, "");
    var du = "";
    try { du = new URL(goc || "/", location.href).href.replace(/\/+$/, ""); } catch (e) {}
    var KHOA_QL = "qlkh.phien@" + du + ".token", KHOA_AI = "ai.phien@" + du, KHOA_MODEL = "ai.model@" + du;
    var trangThai = null, dsModel = null;

    function model() { var m = docLS(KHOA_MODEL); return typeof m === "string" && /^[a-z0-9][a-z0-9.\-]{1,62}$/.test(m) ? m : ""; }
    function datModel(id) {
      ghiLS(KHOA_MODEL, id || null);
      try { window.dispatchEvent(new CustomEvent("ai-model", { detail: { model: id || "" } })); } catch (e) {}
    }

    function dau() {
      var h = { "Content-Type": "application/json" };
      var ql = docLS(KHOA_QL);
      if (typeof ql === "string" && ql) h["X-Admin-Session"] = ql;
      var ai = docLS(KHOA_AI);
      if (ai && ai.token) {
        var het = +ai.het || 0;
        if (!het || (het > 1e12 ? het : het * 1000) > Date.now()) h["X-AI-Session"] = ai.token;
        else ghiLS(KHOA_AI, null);
      }
      if (model()) h["X-AI-Model"] = model();
      return h;
    }

    function goi(duong, body, daThuLai) {
      var o = { headers: dau(), credentials: "same-origin" };
      if (body !== undefined) { o.method = "POST"; o.body = JSON.stringify(body); }
      return fetch(goc + "/ai/" + duong, o).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (r.ok) return j;
          var e = new Error((j && (j.message || (typeof j.detail === "string" && j.detail))) || ("HTTP " + r.status));
          e.ma = ((j && j.data) || {}).code || "";
          e.status = r.status;
          throw e;
        });
      }, function () {
        var e = new Error(navigator.onLine === false ? "Đang offline — cần mạng để dùng AI" : "Không kết nối được máy chủ");
        e.ma = "mang";
        throw e;
      }).catch(function (e) {
        /* model đã chọn không còn / không được dùng: về mặc định và thử lại một lần */
        if (!daThuLai && model() && (e.ma === "ai_model_unknown" || e.ma === "ai_model_admin_only" || e.ma === "ai_model_invalid")) {
          datModel("");
          return goi(duong, body, true);
        }
        throw e;
      });
    }

    function layDsModel(moi) {
      if (!dsModel || moi) dsModel = goi("models").catch(function (e) { dsModel = null; throw e; });
      return dsModel;
    }

    /* Ô chọn model: "Mặc định (…)" + các model được dùng; model chỉ cho quản trị viên hiện mờ. */
    function oModel(lop) {
      var nhan = document.createElement("label");
      nhan.className = "ai-model" + (lop ? " " + lop : "");
      nhan.innerHTML = '<span>Model</span><select aria-label="Model AI"><option value="">Mặc định</option></select>';
      var chon = nhan.querySelector("select");
      function ve(kq) {
        var co = model(), ok = false, ds = (kq && kq.models) || [];
        chon.innerHTML = '<option value="">Mặc định' + (kq && kq.default ? " (" + escHtml(kq.default) + ")" : "") + "</option>" +
          ds.map(function (m) {
            if (m.id === co && m.allowed) ok = true;
            var them = (m.preview ? " · xem trước" : "") + (m.adminOnly ? " · Pro" : "") + (!m.allowed ? " — chỉ quản trị viên" : "");
            return '<option value="' + escHtml(m.id) + '"' + (m.allowed ? "" : " disabled") + ">" + escHtml(m.label || m.id) + them + "</option>";
          }).join("");
        if (co && !ok) datModel("");            /* model cũ không còn trong danh sách */
        chon.value = ok ? co : "";
      }
      chon.addEventListener("change", function () { datModel(chon.value); });
      window.addEventListener("ai-model", function (e) { if (chon.value !== e.detail.model) chon.value = e.detail.model; });
      layDsModel().then(ve, function () { nhan.hidden = true; });
      return nhan;
    }

    function layTrangThai(moi) {
      if (!trangThai || moi) trangThai = goi("status").catch(function (e) { trangThai = null; throw e; });
      return trangThai;
    }

    function oMa(xong, lopNut) {
      var f = document.createElement("form");
      f.className = "ai-ma";
      f.innerHTML = '<input type="password" autocomplete="off" maxlength="200" placeholder="Mã truy cập AI" aria-label="Mã truy cập AI">' +
        '<button type="submit" class="' + (lopNut || "") + '">Mở khoá</button>';
      var loi = document.createElement("p");
      loi.className = "ai-ma-loi";
      loi.setAttribute("role", "alert");
      f.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var o = f.querySelector("input");
        loi.textContent = "";
        goi("session", { code: o.value }).then(function (j) {
          ghiLS(KHOA_AI, { token: j.session, het: j.expiresAt });
          return layTrangThai(true);
        }).then(function () { if (xong) xong(); }, function (err) {
          loi.textContent = err.message;
          if (!loi.parentNode) f.parentNode.insertBefore(loi, f.nextSibling);
          o.select();
        });
      });
      return f;
    }

    return {
      goi: function (duong, body) { return goi(duong, body); }, trangThai: layTrangThai, oMa: oMa,
      model: model, datModel: datModel, dsModel: layDsModel, oModel: oModel,
      dungDuoc: function (s) { return !!(s && s.enabled && (s.allowed || s.needs === "code")); }
    };
  }

  function escHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  window.AiKhach = { tao: tao };
})();
