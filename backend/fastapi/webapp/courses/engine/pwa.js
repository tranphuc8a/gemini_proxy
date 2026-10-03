/* ==========================================================================
   PWA — cài trang thành ứng dụng, đọc được khi mất mạng.

   ★ NGUỒN THẬT: courses/engine/pwa.js — `python engine/sync.py` chép sang từng
     trang (nhóm "pwa"). Trang khoá học nạp tệp này qua engine (app.js, danh sách
     mô-đun); OPIc và lab nạp bằng thẻ <script>.

   Cần cạnh trang: sw.js (cùng thư mục) và manifest.webmanifest. Làm ba việc:
     1. đăng ký service worker (phạm vi = thư mục trang) và gửi cho nó danh sách
        tệp trang vừa nạp — lần mở đầu tiên cũng có bản lưu;
     2. nút "Cài ứng dụng" khi trình duyệt cho cài;
     3. báo nhỏ "Đang offline" khi mất mạng.
   Không phụ thuộc engine nào; trang mở bằng file:// thì không làm gì; trong khung
   nhúng (lab trong bài giảng) vẫn lưu offline nhưng không hiện nhãn nổi.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__PWA__) return;
  window.__PWA__ = true;
  if (!/^https?:$/.test(location.protocol)) return;           /* file:// — và DOM giả của bộ kiểm lab */
  var trongKhung = window.self !== window.top;                 /* lab nhúng trong bài giảng */

  /* manifest + màu thanh trạng thái (trang chưa khai báo thì thêm) */
  function them(tag, thuocTinh) {
    var e = document.createElement(tag);
    Object.keys(thuocTinh).forEach(function (k) { e.setAttribute(k, thuocTinh[k]); });
    document.head.appendChild(e);
  }
  if (!document.querySelector('link[rel="manifest"]')) them("link", { rel: "manifest", href: "manifest.webmanifest" });
  if (!document.querySelector('meta[name="theme-color"]')) {
    var mau = getComputedStyle(document.documentElement).getPropertyValue("--ac").trim();
    if (mau) them("meta", { name: "theme-color", content: mau });
  }

  /* 1. service worker */
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").then(function () {
      return navigator.serviceWorker.ready;
    }).then(function (reg) {
      var urls = [location.href];
      try {
        performance.getEntriesByType("resource").forEach(function (r) { urls.push(r.name); });
      } catch (e) {}
      if (reg.active) reg.active.postMessage({ loai: "luu", urls: urls });
    }).catch(function (e) {
      if (window.console) console.warn("Không đăng ký được service worker:", e && e.message);
    });
  }

  /* nhãn nổi góc dưới: dùng màu của trang nếu có */
  var CSS = ".pwa-nhan{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:60;" +
    "display:flex;align-items:center;gap:10px;padding:9px 14px;border-radius:999px;" +
    "background:var(--surf,#fff);color:var(--tx,#222);border:1px solid var(--bd,#ddd);" +
    "box-shadow:0 6px 24px rgba(0,0,0,.18);font-family:inherit;font-size:14px;font-weight:500;line-height:1.3;" +
    "max-width:calc(100vw - 24px)}" +
    ".pwa-nhan button{border:0;border-radius:999px;padding:6px 12px;font:inherit;font-weight:600;cursor:pointer;" +
    "background:var(--ac,#3b5bdb);color:var(--actx,#fff)}" +
    ".pwa-nhan button.phu{background:transparent;color:var(--tx3,#777);padding:6px 8px}" +
    ".pwa-nhan.offline{border-color:var(--wabd,#f0c36d)}";
  var css = document.createElement("style");
  css.textContent = CSS;
  document.head.appendChild(css);

  /* 2. cài ứng dụng — trình duyệt báo được phép cài thì mời một lần (bỏ qua thì nhớ) */
  var BO_QUA = "pwa:bo-qua-cai";
  var moiCai = null;
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    moiCai = e;
    var daBo = false;
    try { daBo = localStorage.getItem(BO_QUA) === "1"; } catch (err) {}
    if (daBo || document.querySelector(".pwa-nhan.cai")) return;
    var n = document.createElement("div");
    n.className = "pwa-nhan cai";
    n.setAttribute("role", "status");
    n.innerHTML = "<span>Cài trang này thành ứng dụng — mở nhanh, đọc được khi mất mạng</span>" +
      '<button type="button" data-cai>Cài</button><button type="button" class="phu" data-bo aria-label="Để sau">✕</button>';
    n.addEventListener("click", function (ev) {
      if (ev.target.closest("[data-cai]") && moiCai) {
        moiCai.prompt();
        moiCai = null;
        n.remove();
      } else if (ev.target.closest("[data-bo]")) {
        try { localStorage.setItem(BO_QUA, "1"); } catch (err) {}
        n.remove();
      }
    });
    document.body.appendChild(n);
  });
  window.addEventListener("appinstalled", function () {
    var n = document.querySelector(".pwa-nhan.cai");
    if (n) n.remove();
  });

  /* 3. mất mạng */
  function veMang() {
    var n = document.querySelector(".pwa-nhan.offline");
    if (navigator.onLine) { if (n) n.remove(); return; }
    if (n) return;
    n = document.createElement("div");
    n.className = "pwa-nhan offline";
    n.setAttribute("role", "status");
    n.textContent = "Đang offline — chỉ đọc được những gì đã lưu trên máy này";
    document.body.appendChild(n);
  }
  if (!trongKhung) {                                            /* trang chứa khung đã báo rồi */
    window.addEventListener("online", veMang);
    window.addEventListener("offline", veMang);
    if (document.body) veMang(); else document.addEventListener("DOMContentLoaded", veMang);
  }
})();
