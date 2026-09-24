/* =====================================================================
   lab-ulam.js — Xoan oc Ulam va xoan oc Sacks.

   Xep so tu nhien theo hinh xoan oc roi to dam cac so nguyen to. Neu so
   nguyen to rai ngau nhien, hinh phai la nhieu trang. No khong.
   ===================================================================== */
(function () {
  "use strict";
  var V = window.VIS;

  /** Sang Eratosthenes toi N. Tra ve Uint8Array: 1 la so nguyen to. */
  function sang(N) {
    var la = new Uint8Array(N + 1);
    la.fill(1);
    la[0] = 0; if (N >= 1) la[1] = 0;
    for (var i = 2; i * i <= N; i++) {
      if (!la[i]) continue;
      for (var j = i * i; j <= N; j += i) la[j] = 0;
    }
    return la;
  }

  demo({
    id: "xoan-oc-ulam",
    nhom: "Toán & số học",
    mon: "L06",
    ten: "Xoắn ốc Ulam — trật tự trong số nguyên tố",
    moTa: "Năm 1963 Stanisław Ulam ngồi chán trong một buổi hội thảo, viết số tự nhiên " +
          "theo hình xoắn ốc rồi khoanh các số nguyên tố. Đáng lẽ phải ra một đám lấm tấm " +
          "vô nghĩa. Thứ hiện ra là <b>những đường chéo rõ rệt</b> — và tới nay vẫn " +
          "chưa ai giải thích được trọn vẹn.",

    dung: function (host) {
      var LA = null;                 /* la[n] = 1 neu n nguyen to */
      var X = null, Y = null;        /* toa do da tinh san cho tung n */
      var tam = 1, demNT = 0;
      var euler = null;              /* tap gia tri n^2+n+41 */
      var tyLe = 1, cx = 0, cy = 0;
      var BTL = null, P = null;
      var chuot = null;

      var TS = V.thamSo([
        { ma: "kieu", ten: "Kiểu xoắn ốc", kieu: "chon", gt: "ulam", muc: [
          { v: "ulam",  t: "① Ulam — xoắn ốc vuông" },
          { v: "sacks", t: "② Sacks — xoắn ốc tròn (số chính phương thẳng hàng)" }
        ] },
        { ma: "soN", ten: "Xét tới số", kieu: "so", min: 2000, max: 250000, buoc: 2000, gt: 60000 },
        { ma: "coDiem", ten: "Cỡ chấm", kieu: "so", min: 1, max: 4, buoc: 0.5, gt: 1.5 },
        { ma: "hienHop", ten: "Hiện cả hợp số (rất mờ)", kieu: "bat", gt: false,
          moTa: "Bật lên để thấy các đường chéo là <b>chỗ trống</b> giữa hợp số, " +
                "chứ không phải nét vẽ thêm." },
        { ma: "hienEuler", ten: "Tô đường n²+n+41 của Euler", kieu: "bat", gt: false,
          moTa: "Đa thức này cho ra số nguyên tố với <b>mọi</b> n từ 0 đến 39. " +
                "Trên xoắn ốc Ulam nó nằm gọn trên một đường chéo." }
      ], {
        doi: function () { apDung(); },
        preset: [
          { ten: "Ulam 60k",            gt: { kieu: "ulam", soN: 60000 } },
          { ten: "Ulam 250k",           gt: { kieu: "ulam", soN: 250000, coDiem: 1 } },
          { ten: "Thấy chỗ trống",      gt: { kieu: "ulam", soN: 60000, hienHop: true } },
          { ten: "Đa thức Euler",       gt: { kieu: "ulam", soN: 60000, hienEuler: true } },
          { ten: "Xoắn ốc Sacks",       gt: { kieu: "sacks", soN: 60000, coDiem: 1.5 } }
        ]
      });

      var G = TS.gt;

      var cv = V.veBangCo({ rong: 860, tiLe: 0.86, veLai: function () { if (P) apDung(); } });
      var g = cv.g;
      BTL = V.bangTichLuy(cv);

      var S = V.soLieu();
      var ghiChu = V.el("div", { class: "chu-thich" });

      /* ============================================================
         Chuan bi — tinh san toa do de ve lai duoc sau khi doi kich thuoc
         ============================================================ */
      function chuanBi() {
        var N = Math.round(G.soN);
        LA = sang(N);
        X = new Float32Array(N + 1);
        Y = new Float32Array(N + 1);
        demNT = 0;

        var bienDo = 1, n;
        if (G.kieu === "ulam") {
          /* Xoan oc vuong: phai 1, len 1, trai 2, xuong 2, phai 3, len 3, ...
             Do dai doan tang len sau moi HAI lan re. */
          var x = 0, y = 0, dx = 1, dy = 0, doDai = 1, daDi = 0, soLanRe = 0;
          for (n = 1; n <= N; n++) {
            X[n] = x; Y[n] = y;
            if (Math.abs(x) > bienDo) bienDo = Math.abs(x);
            if (Math.abs(y) > bienDo) bienDo = Math.abs(y);
            x += dx; y += dy;
            if (++daDi === doDai) {
              daDi = 0;
              var t = dx; dx = -dy; dy = t;      /* quay 90 do */
              if (++soLanRe % 2 === 0) doDai++;
            }
          }
        } else {
          /* Xoan oc Sacks: so n dat o ban kinh sqrt(n), goc 2·pi·sqrt(n).
             Nho vay moi so chinh phuong roi dung tren cung mot tia. */
          for (n = 1; n <= N; n++) {
            var r = Math.sqrt(n);
            var a = 2 * Math.PI * r;
            X[n] = r * Math.cos(a);
            Y[n] = r * Math.sin(a);
          }
          bienDo = Math.sqrt(N);
        }

        tam = bienDo;
        cx = cv.W / 2;
        cy = cv.H / 2;
        tyLe = Math.min(cv.W, cv.H) * 0.47 / (bienDo || 1);

        euler = null;
        if (G.hienEuler) {
          euler = new Uint8Array(N + 1);
          for (var m = 0; ; m++) {
            var v = m * m + m + 41;
            if (v > N) break;
            euler[v] = 1;
          }
        }
        BTL.xoa();
      }

      /* ============================================================
         Ve
         ============================================================ */
      function veMotSo(gd, n) {
        var x = cx + X[n] * tyLe, y = cy + Y[n] * tyLe;
        var d = G.coDiem;
        if (LA[n]) {
          if (euler && euler[n]) {
            gd.fillStyle = V.mau("loi");
            gd.fillRect(x - d, y - d, d * 2, d * 2);
          } else {
            gd.fillStyle = V.mau("ac");
            gd.fillRect(x - d / 2, y - d / 2, d, d);
          }
        } else if (G.hienHop) {
          gd.fillStyle = V.mau("tx3");
          gd.globalAlpha = 0.14;
          gd.fillRect(x - d / 2, y - d / 2, d, d);
          gd.globalAlpha = 1;
        } else if (euler && euler[n]) {
          /* Gia tri Euler khong con nguyen to (m >= 40) — van danh dau, mo hon,
             de thay dung cho da thuc "gay". */
          gd.fillStyle = V.mau("ba");
          gd.globalAlpha = 0.8;
          gd.fillRect(x - d / 2, y - d / 2, d, d);
          gd.globalAlpha = 1;
        }
      }

      function ve(k) {
        BTL.toi(k, veMotSo);
        g.clearRect(0, 0, cv.W, cv.H);
        g.fillStyle = V.mau("surf");
        g.fillRect(0, 0, cv.W, cv.H);
        BTL.dan();

        g.fillStyle = V.mau("tx3");
        g.font = "11px ui-monospace,monospace";
        g.textAlign = "left"; g.textBaseline = "top";
        g.fillText(G.kieu === "ulam"
          ? "số 1 ở giữa, xoắn dần ra ngoài"
          : "số n ở bán kính √n, góc 2π√n — mọi số chính phương nằm trên một tia", 6, 6);

        var matDo = k > 1 ? demNT / k : 0;
        var duDoan = k > 2 ? 1 / Math.log(k) : 0;
        /* 1/ln(n) la dang thuong duoc trich, nhung no luon thap hon thuc te.
           1/(ln n - 1) sat hon nhieu, va cung la he qua cua dinh ly so nguyen to. */
        var duDoanTot = k > 3 ? 1 / (Math.log(k) - 1) : 0;
        var bang = {
          "Đã xếp": k.toLocaleString("vi") + " / " + Math.round(G.soN).toLocaleString("vi"),
          "Số nguyên tố": demNT.toLocaleString("vi"),
          "Mật độ thực tế": (matDo * 100).toFixed(2) + "%",
          "Xấp xỉ thô 1/ln(n)": (duDoan * 100).toFixed(2) + "%",
          "Xấp xỉ tốt 1/(ln n − 1)": (duDoanTot * 100).toFixed(2) + "%",
          "Đường chéo nghĩa là": "một đa thức bậc hai cho ra nhiều số nguyên tố bất thường"
        };

        /* Rê chuột: doc so duoi con tro. Voi xoan oc vuong co the tinh nguoc
           ra o luoi; voi Sacks thi khong, nen chi lam cho Ulam. */
        if (chuot && G.kieu === "ulam") {
          var gx = Math.round((chuot.x - cx) / tyLe);
          var gy = Math.round((chuot.y - cy) / tyLe);
          var soO = timSo(gx, gy, Math.min(k, Math.round(G.soN)));
          if (soO) {
            bang["Ô đang trỏ"] = soO.toLocaleString("vi");
            bang["→ là"] = LA[soO] ? "số nguyên tố" : "hợp số";
          }
        }
        S.dat(bang);
      }

      /** Tim so n co toa do luoi (gx, gy) trong xoan oc vuong. Duyet nguoc
          tu ngoai vao vi vung nguoi dung tro thuong o ria. */
      function timSo(gx, gy, tran) {
        for (var n = Math.min(tran, X.length - 1); n >= 1; n--) {
          if (X[n] === gx && Y[n] === gy) return n;
        }
        return 0;
      }

      cv.addEventListener("mousemove", function (e) {
        if (G.kieu !== "ulam") return;
        var r = cv.getBoundingClientRect();
        chuot = {
          x: (e.clientX - r.left) * cv.W / r.width,
          y: (e.clientY - r.top) * cv.H / r.height
        };
        /* Chi doc o khi luoi con du thua — duyet nguoc O(n) se giat o N lon. */
        if (!P.dangChay() && G.soN <= 20000) P.veLai();
      });
      cv.addEventListener("mouseleave", function () {
        chuot = null;
        if (!P.dangChay()) P.veLai();
      });

      /* ============================================================
         Dieu phoi
         ============================================================ */
      function apDung() {
        if (!cv.W) return;
        chuot = null;
        chuanBi();
        P.datToiDa(Math.round(G.soN));
        P.datTocDo(6000);
        ghiChu.innerHTML = "";
        var cap = [[V.mau("ac"), "số nguyên tố"]];
        if (G.hienHop) cap.push([V.mau("tx3"), "hợp số"]);
        if (G.hienEuler) {
          cap.push([V.mau("loi"), "n²+n+41 còn nguyên tố"]);
          cap.push([V.mau("ba"), "n²+n+41 đã hỏng (n ≥ 40)"]);
        }
        cap.forEach(function (c) {
          ghiChu.appendChild(V.el("span", {}, [
            V.el("i", { class: "o-mau", style: "background:" + c[0] }), c[1]
          ]));
        });
        P.datLai();
      }

      P = V.phat({
        ten: "xoan-oc-ulam",
        bang: cv,
        tocDo: 6000,
        /* Dem don so nguyen to ngay o day. Dem lai ca day moi khung hinh
           la O(k) tren 250 000 so — du de lam tut khung hinh. */
        buoc: function (k) {
          var n = k + 1;
          if (n < LA.length && LA[n]) demNT++;
          return true;
        },
        datLai: function () { BTL.xoa(); demNT = 0; },
        ve: ve,
        nhan: function (k) { return "đã xếp tới n = " + k.toLocaleString("vi"); }
      });

      var r = V.khung(host, {
        ten: "xoan-oc-ulam",
        bang: cv,
        ve: [cv, ghiChu],
        dieuKhien: [P.dk(), TS.dk(), S.el],
        giaiThich:
          "<b>Cách xếp:</b> viết 1 ở giữa rồi xoắn ốc ra ngoài — 2 bên phải, 3 lên trên, " +
          "4 sang trái… Tô đậm mọi số nguyên tố. Nếu số nguyên tố xuất hiện ngẫu nhiên, " +
          "kết quả phải là nhiễu trắng." +
          "<ul>" +
          "<li><b>Nó không phải nhiễu.</b> Có những <b>đường chéo</b> rõ ràng chạy khắp hình. " +
          "Mỗi đường chéo ứng với một đa thức bậc hai dạng <code>4x² + bx + c</code>, và một " +
          "số đa thức như thế cho ra số nguyên tố đậm đặc bất thường.</li>" +
          "<li><b>Bật “Hiện cả hợp số”:</b> sẽ thấy đường chéo không phải là nét ai vẽ thêm — " +
          "nó là <b>chỗ trống</b> mà hợp số chừa lại. Các đường chéo khác bị bội của 3, của 5 " +
          "quét sạch, những đường còn lại thì không.</li>" +
          "<li><b>Đa thức Euler n²+n+41</b> cho ra số nguyên tố với <i>mọi</i> n từ 0 tới 39 — " +
          "40 lần liên tiếp. Bật lên để thấy nó nằm gọn trên một đường chéo. Tới n = 40 thì " +
          "hỏng: 40²+40+41 = 41² chia hết cho 41. Những ô vàng là chỗ nó đã hỏng.</li>" +
          "<li><b>Xoắn ốc Sacks</b> đặt n ở bán kính √n — nhờ vậy mọi <b>số chính phương</b> " +
          "rơi đúng trên một tia, và các đường cong khác hiện ra rõ hơn cả kiểu vuông.</li>" +
          "<li>Bảng số liệu so <b>mật độ thực tế</b> với hai xấp xỉ của định lý số nguyên tố. " +
          "<code>1/ln(n)</code> là dạng hay được trích nhưng luôn <i>thấp hơn</i> thực tế " +
          "khoảng một điểm phần trăm ở đây; <code>1/(ln n − 1)</code> bám sát hơn hẳn. " +
          "Dù sao thì thông điệp vẫn thế: <b>mật độ</b> đoán được khá chính xác, còn " +
          "<b>vị trí</b> từng số nguyên tố thì không — và đó là lý do các đường chéo trên " +
          "hình vẫn là một câu hỏi mở.</li>" +
          "</ul>"
      });
      r.trai.classList.add("co");

      requestAnimationFrame(function () { cv.doKichThuoc(); apDung(); });
    }
  });
})();
