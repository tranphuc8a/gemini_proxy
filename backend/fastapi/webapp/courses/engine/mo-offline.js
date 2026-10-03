/* ==========================================================================
   MÔ-ĐUN ĐỌC OFFLINE — "Lưu cả khoá" để đọc khi mất mạng.

   ★ NGUỒN THẬT: courses/engine/mo-offline.js (engine/sync.py chép). Engine nạp
     tệp này sau app.js và cho nó API window.KhoaHoc.

   Service worker (sw.js) đã tự lưu mỗi bài người học MỞ. Mô-đun này thêm một ô
   trên trang chủ để lưu NỐT mọi bài còn lại — tải từng bài qua worker (4 bài
   một lúc) — và báo đã lưu bao nhiêu, chiếm bao nhiêu bộ nhớ. Bản nháp (xem
   trước với token quản trị) không được lưu, nên ô này không hiện khi ?nhap=1.
   ========================================================================== */
(function () {
  "use strict";
  var K = window.KhoaHoc;
  if (!K) return;
  var CUNG_LUC = 4;
  var dangLuu = false;

  function hoTro() {
    return "serviceWorker" in navigator && /^https?:$/.test(location.protocol) &&
      K.nguon().kieu === "api" && !/[?&]nhap=1(&|$)/.test(location.search);
  }

  /* Worker phải ĐIỀU KHIỂN trang thì request mới đi qua nó (và được lưu). */
  function choWorker() {
    if (navigator.serviceWorker.controller) return Promise.resolve(true);
    return new Promise(function (ok) {
      var xong = false;
      function het(v) { if (!xong) { xong = true; ok(v); } }
      navigator.serviceWorker.addEventListener("controllerchange", function () { het(true); });
      navigator.serviceWorker.ready.then(function () { if (navigator.serviceWorker.controller) het(true); });
      setTimeout(function () { het(!!navigator.serviceWorker.controller); }, 8000);
    });
  }

  function dungLuong() {
    if (!navigator.storage || !navigator.storage.estimate) return Promise.resolve("");
    return navigator.storage.estimate().then(function (u) {
      return u && u.usage ? " · máy đang dùng ~" + Math.max(1, Math.round(u.usage / 1048576)) + " MB" : "";
    }, function () { return ""; });
  }

  function chu(tt) {
    if (!tt) return "Các bài bạn đã mở được lưu tự động. Lưu nốt cả khoá để đọc khi không có mạng.";
    var d = new Date(tt.at);
    return "Đã lưu " + tt.n + "/" + tt.tong + " bài lúc " +
      d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) + " " + d.toLocaleDateString("vi-VN") +
      (tt.n < tt.tong ? " — còn bài chưa lưu được, bấm lưu lại." : ".");
  }

  function luuCaKhoa(nut, dong) {
    if (dangLuu) return;
    dangLuu = true;
    nut.disabled = true;
    var ng = K.nguon(), ids = K.thuTu().slice(), tong = ids.length, xong = 0, hong = 0, i = 0;
    var dau = ng.dauRequest || {};
    dong.textContent = "Đang chuẩn bị bộ nhớ offline…";
    choWorker().then(function (coWorker) {
      if (!coWorker) throw new Error("trình duyệt chưa bật service worker cho trang này — tải lại trang rồi thử lại");
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
      return fetch(ng.manifestUrl(), { credentials: "same-origin", headers: dau });
    }).then(function () {
      return new Promise(function (hetViec) {
        var dangChay = 0;
        function tiep() {
          if (i >= tong && !dangChay) { hetViec(); return; }
          while (dangChay < CUNG_LUC && i < tong) {
            var id = ids[i++];
            dangChay++;
            fetch(ng.docUrl(id), { credentials: "same-origin", headers: dau }).then(function (r) {
              if (r.ok) xong++; else hong++;
            }, function () { hong++; }).then(function () {
              dangChay--;
              dong.textContent = "Đang lưu " + (xong + hong) + "/" + tong + " bài…";
              tiep();
            });
          }
        }
        tiep();
      });
    }).then(function () {
      var tt = { n: xong, tong: tong, at: Date.now() };
      K.LS.set("offline", tt);
      return dungLuong().then(function (mb) {
        dong.textContent = chu(tt) + mb;
        K.toast(hong ? "Đã lưu " + xong + " bài, " + hong + " bài lỗi" : "Đã lưu cả khoá — đọc được khi mất mạng");
      });
    }).catch(function (e) {
      dong.textContent = "Không lưu được: " + (e && e.message || e);
    }).then(function () {
      dangLuu = false;
      nut.disabled = false;
      nut.textContent = "Lưu lại";
    });
  }

  K.themBieuTuong("tai-ve", '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 20h14"/>');

  K.nghe("trang-chu", function (main) {
    if (!hoTro() || !K.thuTu().length) return;
    var home = main.querySelector(".home");
    if (!home) return;
    var tt = K.LS.get("offline", null);
    var the = document.createElement("div");
    the.className = "card full offline-the";
    the.id = "offlineThe";
    the.innerHTML = '<div class="offline-dau">' + K.icon("tai-ve") + "<b>Đọc offline</b></div>" +
      '<p id="offlineDong"></p><button type="button" class="btn btn-s" id="btnLuuKhoa"></button>';
    home.appendChild(the);
    var dong = the.querySelector("#offlineDong"), nut = the.querySelector("#btnLuuKhoa");
    dong.textContent = chu(tt);
    nut.textContent = tt ? "Lưu lại" : "Lưu cả khoá (" + K.thuTu().length + " bài)";
    nut.addEventListener("click", function () { luuCaKhoa(nut, dong); });
  });
})();
