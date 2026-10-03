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
   Người gọi được nhận diện bằng header: X-Admin-Session (token phiên mà trang
   Quản lý cất cho ĐÚNG gốc API này — quản trị viên) và X-AI-Session (token mã
   truy cập AI). Token không bao giờ được gửi sang một gốc API khác.
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
    var KHOA_QL = "qlkh.phien@" + du + ".token", KHOA_AI = "ai.phien@" + du;
    var trangThai = null;

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
      return h;
    }

    function goi(duong, body) {
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
      });
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
      goi: goi, trangThai: layTrangThai, oMa: oMa,
      dungDuoc: function (s) { return !!(s && s.enabled && (s.allowed || s.needs === "code")); }
    };
  }

  window.AiKhach = { tao: tao };
})();
