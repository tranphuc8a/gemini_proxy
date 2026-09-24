/* =====================================================================
   lab-montecarlo.js — Uoc luong pi bang ngau nhien.

   Hai cach: nem diem vao hinh vuong, va tha kim Buffon. Ca hai deu hoi
   tu ve pi voi sai so co 1/sqrt(n) — nhanh luc dau, cham den phat buc
   ve sau. Do la gia cua moi phuong phap Monte Carlo.
   ===================================================================== */
(function () {
  "use strict";
  var V = window.VIS;

  var D_DAY = 1;                 /* khoang cach giua hai vach, chuan hoa = 1 */

  demo({
    id: "monte-carlo",
    nhom: "Xác suất & ngẫu nhiên",
    mon: "L04",
    ten: "Monte Carlo — lấy ngẫu nhiên để ra một hằng số",
    moTa: "Ném điểm bừa vào hình vuông, đếm xem bao nhiêu rơi vào hình tròn — " +
          "ra <b>π</b>. Không có hình học nào được dùng cả. Nhưng hãy xem <b>sai số " +
          "giảm chậm đến mức nào</b>: muốn thêm một chữ số đúng phải thử gấp <b>100 lần</b>.",

    dung: function (host) {
      /* Ket qua tung lan thu, luu san de ve lai duoc sau khi doi kich thuoc. */
      var px = null, py = null, co = null;      /* nem diem: toa do + trung/truot */
      var kx = null, ky = null, kg = null;      /* kim: tam + goc */
      var tong = 0, dat = 0;                    /* so lan thu, so lan "trung" */
      var lichSu = [], ghiTiep = 1;
      var BTL = null, B = null, P = null;
      var Rnd = null;
      var chiaY = 0, oX = 0, oY = 0, oCanh = 0;

      var TS = V.thamSo([
        { ma: "che", ten: "Phương pháp", kieu: "chon", gt: "nem-diem", muc: [
          { v: "nem-diem",  t: "① Ném điểm vào hình vuông" },
          { v: "kim-buffon",t: "② Thả kim Buffon" }
        ] },
        { ma: "soLan", ten: "Số lần thử", kieu: "so", min: 1000, max: 200000, buoc: 1000, gt: 40000 },
        { ma: "hat", ten: "Hạt giống", kieu: "hat", gt: 42,
          moTa: "Cùng hạt giống thì ra đúng cùng một dãy. Đổi hạt để xem ước lượng " +
                "nhảy quanh giá trị thật thế nào." },
        { ma: "tyLeKim", ten: "Chiều dài kim / khoảng cách vạch", kieu: "so",
          min: 0.2, max: 1, buoc: 0.05, gt: 0.8,
          moTa: "Kim càng dài càng hay cắt vạch, ước lượng càng ổn định.",
          hien: function (g) { return g.che === "kim-buffon"; } },
        { ma: "hienBao", ten: "Hiện dải sai số 95%", kieu: "bat", gt: true,
          moTa: "Cái phễu này co lại theo <b>1/√n</b> — đó là toàn bộ câu chuyện." }
      ], {
        doi: function () { apDung(); },
        preset: [
          { ten: "Ném điểm 40k",      gt: { che: "nem-diem", soLan: 40000 } },
          { ten: "Ném điểm 200k",     gt: { che: "nem-diem", soLan: 200000 } },
          { ten: "Kim Buffon",        gt: { che: "kim-buffon", soLan: 40000, tyLeKim: 0.8 } },
          { ten: "Kim ngắn (kém ổn định)", gt: { che: "kim-buffon", soLan: 40000, tyLeKim: 0.2 } }
        ]
      });

      var G = TS.gt;

      var cv = V.veBangCo({ rong: 860, tiLe: 0.78, veLai: function () { if (P) apDung(); } });
      var g = cv.g;
      BTL = V.bangTichLuy(cv);

      var S = V.soLieu();
      var ghiChu = V.el("div", { class: "chu-thich" });

      /* ============================================================
         Mo phong — chi sinh so, khong ve
         ============================================================ */
      function chuanBi() {
        var n = Math.round(G.soLan);
        Rnd = V.rng(Math.round(G.hat) || 1);
        tong = 0; dat = 0;
        lichSu = []; ghiTiep = 1;
        if (G.che === "nem-diem") {
          px = new Float32Array(n); py = new Float32Array(n); co = new Uint8Array(n);
        } else {
          kx = new Float32Array(n); ky = new Float32Array(n); kg = new Float32Array(n);
          co = new Uint8Array(n);
        }

        chiaY = Math.round(cv.H * 0.56);
        oCanh = Math.min(cv.W * 0.86, chiaY - 26);
        oX = (cv.W - oCanh) / 2;
        oY = 14;

        B = V.bieuDo(cv, {
          le: { t: chiaY + 10, r: 18, b: 34, l: 64 },
          x: { min: 0, max: n, nhan: "số lần thử", dinhDang: V.soGon, vach: 4 },
          y: { min: 2.7, max: 3.6, nhan: "ước lượng π",
               dinhDang: function (v) { return v.toFixed(2); } },
          luoi: 3
        });
        BTL.xoa();
      }

      function uocLuong() {
        if (!tong) return 0;
        if (G.che === "nem-diem") return 4 * dat / tong;
        /* Buffon: P(cat vach) = 2L/(pi·d)  =>  pi = 2L·n/(d·c) */
        if (!dat) return 0;
        return 2 * G.tyLeKim * tong / (D_DAY * dat);
      }

      function motLan() {
        var i = tong;
        if (i >= (G.che === "nem-diem" ? px.length : kx.length)) return false;
        if (G.che === "nem-diem") {
          var x = Rnd() * 2 - 1, y = Rnd() * 2 - 1;
          var trong = (x * x + y * y) <= 1 ? 1 : 0;
          px[i] = x; py[i] = y; co[i] = trong;
          dat += trong;
        } else {
          /* Tam kim cach vach gan nhat mot khoang u in [0, d/2), goc t in [0, pi).
             Kim cat vach khi u <= (L/2)·sin t. */
          var u = Rnd() * D_DAY / 2;
          var t = Rnd() * Math.PI;
          var cat = (u <= (G.tyLeKim / 2) * Math.sin(t)) ? 1 : 0;
          kx[i] = Rnd();               /* vi tri ngang, chi de ve */
          ky[i] = u;
          kg[i] = t;
          co[i] = cat;
          dat += cat;
        }
        tong++;
        /* Ghi lich su theo cap so nhan: day la truc hoanh cua duong hoi tu,
           va ta chi can do phan giai cao o doan dau. */
        if (tong >= ghiTiep) {
          lichSu.push([tong, uocLuong()]);
          ghiTiep = Math.ceil(ghiTiep * 1.06) + 1;
        }
        return true;
      }

      /* ============================================================
         Ve
         ============================================================ */
      function veMotKetQua(gd, i) {
        var j = i - 1;
        if (G.che === "nem-diem") {
          var x = oX + (px[j] + 1) / 2 * oCanh;
          var y = oY + (py[j] + 1) / 2 * oCanh;
          gd.fillStyle = co[j] ? V.mau("ac") : V.mau("ba");
          gd.globalAlpha = 0.5;
          gd.fillRect(x, y, 1.6, 1.6);
          gd.globalAlpha = 1;
        } else {
          /* Ve kim trong mot dai co soDay vach ngang. */
          var soDay = 6;
          var buocDay = oCanh / soDay;
          var day = j % soDay;
          var cxx = oX + kx[j] * oCanh;
          var cyy = oY + day * buocDay + buocDay / 2 +
                    (ky[j] * 2 - D_DAY / 2) * buocDay;   /* lech quanh tam o */
          var nua = G.tyLeKim / 2 * buocDay;
          var dx = Math.cos(kg[j]) * nua, dy = Math.sin(kg[j]) * nua;
          gd.strokeStyle = co[j] ? V.mau("loi") : V.mau("tx3");
          gd.globalAlpha = 0.45;
          gd.lineWidth = 1;
          gd.beginPath();
          gd.moveTo(cxx - dx, cyy - dy);
          gd.lineTo(cxx + dx, cyy + dy);
          gd.stroke();
          gd.globalAlpha = 1;
        }
      }

      function veKhungTren() {
        if (G.che === "nem-diem") {
          g.save();
          g.strokeStyle = V.mau("bd");
          g.lineWidth = 1.4;
          g.strokeRect(oX, oY, oCanh, oCanh);
          g.beginPath();
          g.arc(oX + oCanh / 2, oY + oCanh / 2, oCanh / 2, 0, 6.2832);
          g.stroke();
          g.restore();
        } else {
          var soDay = 6, buocDay = oCanh / soDay;
          g.save();
          g.strokeStyle = V.mau("bd");
          g.lineWidth = 1.2;
          for (var i = 0; i <= soDay; i++) {
            var y = oY + i * buocDay;
            g.beginPath(); g.moveTo(oX, y); g.lineTo(oX + oCanh, y); g.stroke();
          }
          g.restore();
        }
      }

      function ve(k) {
        BTL.toi(Math.min(k, tong), veMotKetQua);

        g.clearRect(0, 0, cv.W, cv.H);
        g.fillStyle = V.mau("surf");
        g.fillRect(0, 0, cv.W, cv.H);
        veKhungTren();
        BTL.dan();

        /* Khong goi B.nen(): nen da to o tren, va bieu do chi chiem nua duoi. */
        B.truc();

        /* dai sai so 95%: uoc luong +- 1,96·sigma/sqrt(n) */
        if (G.hienBao) {
          var tren = [], duoi = [], i;
          var p = G.che === "nem-diem" ? Math.PI / 4 : 2 * G.tyLeKim / (Math.PI * D_DAY);
          var heSo = G.che === "nem-diem" ? 4 : (Math.PI * Math.PI * D_DAY) / (2 * G.tyLeKim);
          for (i = 1; i <= 60; i++) {
            var n = Math.max(30, G.soLan * i / 60);
            var bien = 1.96 * heSo * Math.sqrt(p * (1 - p) / n);
            tren.push([n, Math.PI + bien]);
            duoi.push([n, Math.PI - bien]);
          }
          B.duong(tren, V.mau("bd"), 1.2);
          B.duong(duoi, V.mau("bd"), 1.2);
        }

        B.moc(Math.PI, V.mau("ok"), "π = 3,14159…");
        B.duong(lichSu, V.mau("ac"), 1.8);

        var ul = uocLuong();
        var saiSo = ul ? Math.abs(ul - Math.PI) : 0;
        var noiDung = {
          "Số lần thử": tong.toLocaleString("vi") + " / " + Math.round(G.soLan).toLocaleString("vi"),
          "Ước lượng π": ul ? ul.toFixed(5) : "—",
          "Sai số tuyệt đối": ul ? saiSo.toFixed(5) : "—",
          "Số chữ số đúng": ul && saiSo > 0
            ? Math.max(0, Math.floor(-Math.log(saiSo / Math.PI) / Math.LN10)) : "—"
        };
        if (G.che === "nem-diem") {
          noiDung["Rơi trong hình tròn"] = dat.toLocaleString("vi") +
            " (" + (tong ? (dat / tong * 100).toFixed(2) : 0) + "%)";
          noiDung["Tỉ lệ lý thuyết"] = "π/4 = 78,54%";
        } else {
          noiDung["Kim cắt vạch"] = dat.toLocaleString("vi") +
            " (" + (tong ? (dat / tong * 100).toFixed(2) : 0) + "%)";
          noiDung["Tỉ lệ lý thuyết"] = "2L/(πd) = " +
            (2 * G.tyLeKim / (Math.PI * D_DAY) * 100).toFixed(2) + "%";
        }
        noiDung["Muốn thêm 1 chữ số đúng"] = "cần thử gấp 100 lần";
        S.dat(noiDung);
      }

      /* ============================================================
         Dieu phoi
         ============================================================ */
      function apDung() {
        if (!cv.W) return;
        chuanBi();
        P.datToiDa(Math.round(G.soLan));
        P.datTocDo(3000);
        ghiChu.innerHTML = "";
        var cap = G.che === "nem-diem"
          ? [[V.mau("ac"), "rơi trong hình tròn"], [V.mau("ba"), "rơi ngoài"],
             [V.mau("ok"), "π thật"], [V.mau("bd"), "dải sai số 95%"]]
          : [[V.mau("loi"), "kim cắt vạch"], [V.mau("tx3"), "kim không cắt"],
             [V.mau("ok"), "π thật"], [V.mau("bd"), "dải sai số 95%"]];
        cap.forEach(function (c) {
          ghiChu.appendChild(V.el("span", {}, [
            V.el("i", { class: "o-mau", style: "background:" + c[0] }), c[1]
          ]));
        });
        P.datLai();
      }

      P = V.phat({
        ten: "monte-carlo",
        bang: cv,
        tocDo: 3000,
        buoc: function () { return motLan(); },
        datLai: function () {
          BTL.xoa();
          tong = 0; dat = 0; lichSu = []; ghiTiep = 1;
          Rnd = V.rng(Math.round(G.hat) || 1);
        },
        ve: ve,
        nhan: function () {
          var u = uocLuong();
          return u ? ("π ≈ " + u.toFixed(4)) : "chưa có số liệu";
        }
      });

      var r = V.khung(host, {
        ten: "monte-carlo",
        bang: cv,
        ve: [cv, ghiChu],
        dieuKhien: [P.dk(), TS.dk(), S.el],
        giaiThich:
          "<b>① Ném điểm:</b> hình vuông cạnh 2 có diện tích 4, hình tròn nội tiếp có diện " +
          "tích π. Ném điểm đều khắp hình vuông thì tỉ lệ rơi vào tròn là <code>π/4</code>. " +
          "Nhân 4 lên là xong — <b>không dùng một công thức hình học nào</b>." +
          "<br><br>" +
          "<b>② Kim Buffon (1777):</b> thả một cây kim dài <code>L</code> lên sàn kẻ vạch cách " +
          "nhau <code>d</code>. Xác suất kim cắt một vạch là <code>2L/(πd)</code>. Đếm số lần " +
          "cắt là suy ngược ra π. Đây là thí nghiệm Monte Carlo <b>đầu tiên trong lịch sử</b>, " +
          "có trước máy tính gần hai thế kỷ." +
          "<ul>" +
          "<li><b>Điều bất ngờ — và là bài học thật:</b> nhìn dải sai số 95%. Nó co theo " +
          "<code>1/√n</code>, nghĩa là muốn <b>thêm một chữ số thập phân đúng</b> phải thử " +
          "<b>gấp 100 lần</b>. Với 40 000 lần bạn chỉ chắc chắn được 2 chữ số.</li>" +
          "<li>Đó là lý do Monte Carlo <i>không</i> dùng để tính π trong thực tế — nhưng lại " +
          "là công cụ duy nhất khả thi khi bài toán có hàng trăm chiều, nơi mọi phương pháp " +
          "lưới đều chết vì <b>lời nguyền số chiều</b>. Sai số <code>1/√n</code> " +
          "<b>không phụ thuộc số chiều</b> — đó mới là điểm mạnh thật sự.</li>" +
          "<li>Đổi <b>hạt giống</b> vài lần: đường ước lượng nhảy sang chỗ khác nhưng luôn " +
          "nằm trong phễu. Phễu đúng, từng lần chạy thì không.</li>" +
          "</ul>"
      });
      r.trai.classList.add("co");

      requestAnimationFrame(function () { cv.doKichThuoc(); apDung(); });
    }
  });
})();
