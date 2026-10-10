/* Khởi động: gọi sau khi mọi mô-đun đã nạp. Lỗi bất ngờ được báo ra màn hình thay vì để trang trắng. */
(function (root) {
  "use strict";
  /* PWA: chỉ qua http(s) (file:// không có service worker). Lỗi đăng ký không ảnh hưởng gì tới trang. */
  if ("serviceWorker" in root.navigator && /^https?:$/.test(root.location.protocol)) {
    root.addEventListener("load", function () { root.navigator.serviceWorker.register("sw.js").catch(function () { /* bỏ qua */ }); });
  }
  try { root.TH.ui.khoiDong(); }
  catch (e) {
    if (root.console) console.error(e);
    var m = document.getElementById("main");
    if (m) m.innerHTML = '<div class="wrap"><div class="card"><h2>Không khởi động được trang</h2><p class="mut">' +
      String(e && e.message || e).replace(/[<>&]/g, "") + '</p><button class="btn btn-ac" onclick="location.reload()">Tải lại</button></div></div>';
  }
})(window);
