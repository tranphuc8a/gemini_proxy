/* =====================================================================
   lab-fourier.js — Chuoi Fourier ve bang cac vong tron quay long nhau.

   Bien doi Fourier roi rac cua mot duong khep kin cho ra mot chuoi
   "vong tron quay tren dau vong tron". Cong du nhieu vong lai thi dau
   but ve lai dung hinh ban dau — ke ca hinh co goc nhon.
   ===================================================================== */
(function () {
  "use strict";
  var V = window.VIS;

  var N = 200;                 /* so mau tren duong */

  /* ---------- Hinh mau, chuan hoa trong [-1, 1] --------------------- */

  /** Lay N diem cach deu theo CHU VI cua mot da giac khep kin. Cach deu
      theo chu vi (chu khong theo tham so) giu cho goc nhon khong bi thua mau. */
  function theoChuVi(dinh, soDiem) {
    var doDai = [], tong = 0, i;
    for (i = 0; i < dinh.length; i++) {
      var a = dinh[i], b = dinh[(i + 1) % dinh.length];
      var d = Math.hypot(b[0] - a[0], b[1] - a[1]);
      doDai.push(d); tong += d;
    }
    if (!tong) return dinh.slice();
    var ra = [], buoc = tong / soDiem, doan = 0, daQua = 0;
    for (i = 0; i < soDiem; i++) {
      var muc = i * buoc;
      while (doan < doDai.length - 1 && daQua + doDai[doan] < muc) {
        daQua += doDai[doan]; doan++;
      }
      var t = doDai[doan] ? (muc - daQua) / doDai[doan] : 0;
      var p = dinh[doan], q = dinh[(doan + 1) % dinh.length];
      ra.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
    return ra;
  }

  function hinhVuong() {
    return theoChuVi([[-0.8, -0.8], [0.8, -0.8], [0.8, 0.8], [-0.8, 0.8]], N);
  }

  function hinhSao() {
    var dinh = [];
    for (var i = 0; i < 10; i++) {
      var r = (i % 2 === 0) ? 0.95 : 0.40;
      var a = -Math.PI / 2 + i * Math.PI / 5;
      dinh.push([r * Math.cos(a), r * Math.sin(a)]);
    }
    return theoChuVi(dinh, N);
  }

  function hinhTraiTim() {
    var ra = [];
    for (var i = 0; i < N; i++) {
      var t = 2 * Math.PI * i / N;
      var x = 16 * Math.pow(Math.sin(t), 3);
      var y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      ra.push([x / 17, -y / 17]);       /* truc y man hinh huong xuong */
    }
    return ra;
  }

  function hinhBanhRang() {
    var dinh = [];
    for (var i = 0; i < 96; i++) {
      var t = 2 * Math.PI * i / 96;
      var r = 0.62 + (Math.sin(12 * t) > 0 ? 0.24 : 0);
      dinh.push([r * Math.cos(t), r * Math.sin(t)]);
    }
    return theoChuVi(dinh, N);
  }

  function hinhTron() {
    var ra = [];
    for (var i = 0; i < N; i++) {
      var t = 2 * Math.PI * i / N;
      ra.push([0.8 * Math.cos(t), 0.8 * Math.sin(t)]);
    }
    return ra;
  }

  /* ---------- Bien doi Fourier roi rac ------------------------------ */
  /* Diem (x, y) duoc coi la so phuc x + iy. He so thu k cho biet mot
     vong tron ban kinh |c_k| quay voi tan so k, lech pha arg(c_k). */
  function bienDoi(diem) {
    var n = diem.length, ra = [], k, j;
    for (k = 0; k < n; k++) {
      var re = 0, im = 0;
      for (j = 0; j < n; j++) {
        var phi = -2 * Math.PI * k * j / n;
        var c = Math.cos(phi), s = Math.sin(phi);
        re += diem[j][0] * c - diem[j][1] * s;
        im += diem[j][0] * s + diem[j][1] * c;
      }
      re /= n; im /= n;
      ra.push({
        /* Tan so k > n/2 that ra la tan so am — quay nguoc chieu. */
        tanSo: k <= n / 2 ? k : k - n,
        bien: Math.hypot(re, im),
        pha: Math.atan2(im, re)
      });
    }
    /* Vong to nhat ve truoc: no quyet dinh dang tong the cua hinh. */
    ra.sort(function (a, b) { return b.bien - a.bien; });
    return ra;
  }

  demo({
    id: "fourier",
    nhom: "Toán & số học",
    mon: "L03",
    ten: "Fourier — vẽ mọi hình bằng những vòng tròn quay",
    moTa: "Gắn một vòng tròn lên mép một vòng tròn khác, rồi lại một cái nữa… " +
          "Với đủ số vòng, đầu bút vẽ lại được <b>bất kỳ</b> đường khép kín nào — " +
          "kể cả hình có góc nhọn. Kéo số vòng từ 1 lên và xem hình hiện ra.",

    dung: function (host) {
      var HS = [];                       /* he so Fourier, da sap theo bien do */
      var GOC = [];                      /* diem cua hinh goc */
      var TuVe = null;                   /* duong nguoi dung ve tay */
      var dangVe = false, dangGhiDiem = [];
      var tyLe = 1, tamX = 0, tamY = 0;
      var BTL = null, P = null;

      var TS = V.thamSo([
        { ma: "hinh", ten: "Hình cần vẽ", kieu: "chon", gt: "sao", muc: [
          { v: "sao",        t: "Ngôi sao 5 cánh" },
          { v: "vuong",      t: "Hình vuông (có góc nhọn)" },
          { v: "trai-tim",   t: "Trái tim" },
          { v: "banh-rang",  t: "Bánh răng" },
          { v: "tu-ve",      t: "✏️ Tự vẽ bằng chuột" }
        ] },
        { ma: "soVong", ten: "Số vòng tròn dùng", kieu: "so", min: 1, max: 100, buoc: 1, gt: 40,
          moTa: "Kéo về <b>1</b>: chỉ còn một vòng, vẽ ra hình tròn. Tăng dần để thấy " +
                "hình thật hiện lên. Góc nhọn là thứ tốn vòng nhất." },
        { ma: "hienVong", ten: "Hiện các vòng tròn", kieu: "bat", gt: true },
        { ma: "hienGoc", ten: "Hiện hình gốc (mờ)", kieu: "bat", gt: true },
        { ma: "lap", ten: "Vẽ xong thì vẽ lại", kieu: "bat", gt: true }
      ], {
        doi: function (ma) {
          if (ma === "lap") { P.datLap(G.lap); return; }
          apDung();
        },
        preset: [
          { ten: "Một vòng duy nhất",  gt: { hinh: "sao", soVong: 1, hienVong: true } },
          { ten: "Năm vòng",           gt: { hinh: "sao", soVong: 5, hienVong: true } },
          { ten: "Đủ nét (40 vòng)",   gt: { hinh: "sao", soVong: 40 } },
          { ten: "Góc nhọn khó nhằn",  gt: { hinh: "vuong", soVong: 8, hienGoc: true } },
          { ten: "Trái tim",           gt: { hinh: "trai-tim", soVong: 30, hienVong: false } }
        ]
      });

      var G = TS.gt;

      var cv = V.veBangCo({ rong: 860, tiLe: 0.72, veLai: function () { if (P) apDung(); } });
      var g = cv.g;
      BTL = V.bangTichLuy(cv);

      var S = V.soLieu();
      var ghiChu = V.el("div", { class: "chu-thich" });
      var mach = V.el("div", { class: "gt-box", style: "margin-top:10px" });

      /* ---------- chuyen doi toa do ---------- */
      function datTyLe() {
        tamX = cv.W / 2;
        tamY = cv.H / 2;
        tyLe = Math.min(cv.W, cv.H) * 0.40;
      }
      function mX(x) { return tamX + x * tyLe; }
      function mY(y) { return tamY + y * tyLe; }

      /* ---------- chuan bi ---------- */
      function layHinh() {
        if (G.hinh === "vuong") return hinhVuong();
        if (G.hinh === "trai-tim") return hinhTraiTim();
        if (G.hinh === "banh-rang") return hinhBanhRang();
        if (G.hinh === "tu-ve") {
          /* Chua ve gi thi lay hinh tron lam cho dua — lab khong duoc rong. */
          return TuVe && TuVe.length > 8 ? theoChuVi(TuVe, N) : hinhTron();
        }
        return hinhSao();
      }

      function chuanBi() {
        datTyLe();
        GOC = layHinh();
        HS = bienDoi(GOC);
        BTL.xoa();
      }

      /** Vi tri dau but tai thoi diem t (0..1), kem cac vong tron tren duong. */
      function viTri(t) {
        var x = 0, y = 0, cac = [];
        var n = Math.min(Math.round(G.soVong), HS.length);
        for (var i = 0; i < n; i++) {
          var h = HS[i];
          var goc = 2 * Math.PI * h.tanSo * t + h.pha;
          var nx = x + h.bien * Math.cos(goc);
          var ny = y + h.bien * Math.sin(goc);
          cac.push([x, y, nx, ny, h.bien]);
          x = nx; y = ny;
        }
        return { x: x, y: y, cac: cac };
      }

      /* ---------- ve ---------- */
      function motNet(gd, i) {
        var a = viTri((i - 1) / N), b = viTri(i / N);
        gd.strokeStyle = V.mau("ac");
        gd.lineWidth = 2.2;
        gd.lineCap = "round";
        gd.beginPath();
        gd.moveTo(mX(a.x), mY(a.y));
        gd.lineTo(mX(b.x), mY(b.y));
        gd.stroke();
      }

      function ve(k) {
        BTL.toi(k, motNet);

        g.clearRect(0, 0, cv.W, cv.H);
        g.fillStyle = V.mau("surf");
        g.fillRect(0, 0, cv.W, cv.H);

        /* hinh goc, mo, de doi chieu */
        if (G.hienGoc && GOC.length) {
          g.save();
          g.strokeStyle = V.mau("tx3");
          g.globalAlpha = 0.5;
          g.setLineDash([4, 4]);
          g.lineWidth = 1.2;
          g.beginPath();
          g.moveTo(mX(GOC[0][0]), mY(GOC[0][1]));
          for (var i = 1; i < GOC.length; i++) g.lineTo(mX(GOC[i][0]), mY(GOC[i][1]));
          g.closePath();
          g.stroke();
          g.restore();
        }

        BTL.dan();

        /* cac vong tron tai thoi diem hien tai */
        var vt = viTri(Math.min(k, N) / N);
        if (G.hienVong) {
          g.save();
          g.lineWidth = 1;
          for (var j = 0; j < vt.cac.length; j++) {
            var c = vt.cac[j];
            if (c[4] * tyLe < 0.8) continue;        /* vong be hon 1 diem anh: bo qua */
            g.strokeStyle = V.mau("bd");
            g.globalAlpha = 0.75;
            g.beginPath();
            g.arc(mX(c[0]), mY(c[1]), c[4] * tyLe, 0, 6.2832);
            g.stroke();
            g.strokeStyle = V.mau("ba");
            g.globalAlpha = 0.9;
            g.beginPath();
            g.moveTo(mX(c[0]), mY(c[1]));
            g.lineTo(mX(c[2]), mY(c[3]));
            g.stroke();
          }
          g.restore();
        }

        /* dau but */
        g.fillStyle = V.mau("ac2");
        g.beginPath();
        g.arc(mX(vt.x), mY(vt.y), 4, 0, 6.2832);
        g.fill();

        if (G.hinh === "tu-ve" && !(TuVe && TuVe.length > 8)) {
          g.fillStyle = V.mau("tx3");
          g.font = "13px system-ui,sans-serif";
          g.textAlign = "center"; g.textBaseline = "top";
          g.fillText("Giữ chuột và vẽ một hình khép kín lên khung này", cv.W / 2, 10);
        }

        /* Sai so: khoang cach lon nhat giua hinh dung so vong hien tai
           va hinh goc. Day la con so tra loi "bao nhieu vong la du". */
        var n = Math.min(Math.round(G.soVong), HS.length);
        var tongBien = 0, conLai = 0, q;
        for (q = 0; q < HS.length; q++) {
          tongBien += HS[q].bien;
          if (q >= n) conLai += HS[q].bien;
        }
        S.dat({
          "Số vòng đang dùng": n + " / " + HS.length,
          "Vòng lớn nhất (bán kính)": (HS.length ? HS[0].bien : 0).toFixed(3),
          "Sai số còn lại": (tongBien ? (conLai / tongBien * 100) : 0).toFixed(1) + "%",
          "Tần số vòng lớn nhất": HS.length ? HS[0].tanSo : 0,
          "Điểm lấy mẫu trên hình": GOC.length
        });

        /* Pho bien do: moi vach la mot vong tron. */
        var vach = HS.slice(0, 48).map(function (h, idx) {
          var cao = Math.max(2, Math.round(h.bien / (HS[0].bien || 1) * 34));
          var m = idx < n ? V.mau("ac") : V.mau("bd");
          return '<i style="display:inline-block;width:5px;margin-right:2px;vertical-align:bottom;' +
                 'height:' + cao + 'px;background:' + m + '"></i>';
        }).join("");
        mach.innerHTML = "<b>Phổ biên độ</b> — 48 vòng lớn nhất, cao = bán kính. " +
                         "Cột đậm là những vòng đang được dùng.<br>" +
                         '<div style="margin-top:8px;line-height:0">' + vach + "</div>";
      }

      /* ---------- ve tay bang chuot ---------- */
      function toaDo(e) {
        var r = cv.getBoundingClientRect();
        return [
          ((e.clientX - r.left) * cv.W / r.width - tamX) / tyLe,
          ((e.clientY - r.top) * cv.H / r.height - tamY) / tyLe
        ];
      }
      cv.addEventListener("mousedown", function (e) {
        if (G.hinh !== "tu-ve") return;
        e.preventDefault();
        dangVe = true;
        dangGhiDiem = [toaDo(e)];
        P.dung();
      });
      cv.addEventListener("mousemove", function (e) {
        if (!dangVe) return;
        var p = toaDo(e);
        var cuoi = dangGhiDiem[dangGhiDiem.length - 1];
        if (Math.hypot(p[0] - cuoi[0], p[1] - cuoi[1]) < 0.01) return;
        dangGhiDiem.push(p);
        /* ve tam net dang keo, chua qua bien doi Fourier */
        g.strokeStyle = V.mau("loi");
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(mX(cuoi[0]), mY(cuoi[1]));
        g.lineTo(mX(p[0]), mY(p[1]));
        g.stroke();
      });
      function ketThucVe() {
        if (!dangVe) return;
        dangVe = false;
        if (dangGhiDiem.length > 8) { TuVe = dangGhiDiem.slice(); apDung(); P.chay(); }
      }
      cv.addEventListener("mouseup", ketThucVe);
      cv.addEventListener("mouseleave", ketThucVe);

      /* ---------- dieu phoi ---------- */
      function apDung() {
        if (!cv.W) return;
        chuanBi();
        P.datToiDa(N);
        P.datLap(G.lap);
        ghiChu.innerHTML = "";
        [[V.mau("ac"), "nét vẽ ra"], [V.mau("ba"), "bán kính các vòng"],
         [V.mau("bd"), "vòng tròn"], [V.mau("tx3"), "hình gốc"]].forEach(function (c) {
          ghiChu.appendChild(V.el("span", {}, [
            V.el("i", { class: "o-mau", style: "background:" + c[0] }), c[1]
          ]));
        });
        P.datLai();
      }

      P = V.phat({
        ten: "fourier",
        bang: cv,
        tocDo: 40,
        toiDa: N,
        buoc: function () { return true; },
        datLai: function () { BTL.xoa(); },
        ve: ve,
        nhan: function (k) {
          return "vòng quay " + (k / N * 100).toFixed(0) + "%";
        }
      });

      var r = V.khung(host, {
        ten: "fourier",
        bang: cv,
        ve: [cv, ghiChu],
        dieuKhien: [P.dk(), TS.dk(), S.el],
        giaiThich:
          "<b>Ý tưởng:</b> coi mỗi điểm trên hình là một <b>số phức</b> <code>x + iy</code>. " +
          "Biến đổi Fourier rời rạc tách đường đi đó thành tổng các số hạng " +
          "<code>cₖ·e^(2πikt)</code> — mỗi số hạng đúng là <b>một vòng tròn</b> bán kính " +
          "<code>|cₖ|</code> quay <code>k</code> vòng mỗi chu kỳ." +
          "<ul>" +
          "<li><b>Vặn số vòng về 1:</b> còn đúng một vòng tròn. Thêm vòng thứ hai đã ra hình " +
          "gần đúng. Đây là lý do nén ảnh và nén âm thanh hoạt động được — <b>vài hệ số đầu " +
          "mang gần hết thông tin</b>.</li>" +
          "<li><b>Chọn hình vuông:</b> góc nhọn là thứ đắt nhất. Với ít vòng, cạnh bị gợn sóng " +
          "quanh góc và không chịu biến mất dù thêm bao nhiêu vòng — đó là <b>hiện tượng Gibbs</b>.</li>" +
          "<li><b>Tần số âm:</b> một nửa số vòng quay ngược chiều. Thiếu chúng thì chỉ vẽ được " +
          "hình đối xứng tròn.</li>" +
          "<li><b>Tự vẽ:</b> chọn chế độ ✏️ rồi giữ chuột vẽ một hình khép kín bất kỳ — " +
          "chữ ký của bạn cũng được. Máy sẽ dựng lại nó bằng vòng tròn.</li>" +
          "</ul>" +
          "<b>Sai số còn lại</b> trong bảng số liệu = tổng bán kính các vòng <i>bị bỏ</i> " +
          "chia tổng tất cả. Đó là câu trả lời định lượng cho “bao nhiêu vòng là đủ”."
      });
      r.trai.classList.add("co");
      r.phai.appendChild(mach);

      requestAnimationFrame(function () { cv.doKichThuoc(); apDung(); });
    }
  });
})();
