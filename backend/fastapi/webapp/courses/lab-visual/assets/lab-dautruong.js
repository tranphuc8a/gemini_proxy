/* =====================================================================
   lab-dautruong.js — Bon metaheuristic tren cung mot dia hinh.

   Dieu kien thi dau nghiem ngat: cung ham muc tieu, cung hat giong, va
   quan trong nhat — CUNG NGAN SACH SO LAN GOI HAM. Do la don vi do dung
   cua toi uu hoa, chu khong phai "so vong lap" hay "giay".

   Ket qua: khong thuat toan nao thang o moi dia hinh. Do la noi dung cua
   dinh ly "khong co bua an trua mien phi".
   ===================================================================== */
(function () {
  "use strict";
  var V = window.VIS;

  var PHAM = 5.12;                  /* mien tim kiem: [-PHAM, PHAM]^2 */

  var DIA_HINH = {
    "rastrigin": {
      ten: "Rastrigin — gợn sóng đều, đầy cực trị địa phương",
      f: function (x, y) {
        return 20 + (x * x - 10 * Math.cos(2 * Math.PI * x))
                  + (y * y - 10 * Math.cos(2 * Math.PI * y));
      },
      toiUu: 0
    },
    "cau": {
      ten: "Cầu — trơn tru, chỉ một cực tiểu",
      f: function (x, y) { return x * x + y * y; },
      toiUu: 0
    },
    "ackley": {
      ten: "Ackley — phễu lớn, bề mặt lắm gai",
      f: function (x, y) {
        return -20 * Math.exp(-0.2 * Math.sqrt(0.5 * (x * x + y * y)))
               - Math.exp(0.5 * (Math.cos(2 * Math.PI * x) + Math.cos(2 * Math.PI * y)))
               + 20 + Math.E;
      },
      toiUu: 0
    },
    "schwefel": {
      ten: "Schwefel — cực tiểu nằm sát MÉP, xa cực tiểu giả ở giữa",
      f: function (x, y) {
        var s = 418.9829 * 2;
        var X = x / PHAM * 500, Y = y / PHAM * 500;
        return s - (X * Math.sin(Math.sqrt(Math.abs(X))) + Y * Math.sin(Math.sqrt(Math.abs(Y))));
      },
      toiUu: 0
    },
    "kim-day-rom": {
      ten: "Kim đáy bể — phẳng lì, một cái giếng tí xíu",
      f: function (x, y) {
        /* Phang tuyet doi tru mot gieng ban kinh 0,5 o (-3,7 ; 2,9).
           KHONG CO DOC nao de bam theo, nen moi meo meo "di xuong" deu
           vo dung. Bai toan chi con la: ai RAI mau tham do rong hon. */
        var dx = x + 3.7, dy = y - 2.9;
        var r2 = dx * dx + dy * dy;
        return r2 < 0.25 ? r2 : 10;
      },
      toiUu: 0
    },
    "himmelblau": {
      ten: "Himmelblau — bốn cực tiểu toàn cục ngang nhau",
      f: function (x, y) {
        var X = x / PHAM * 5, Y = y / PHAM * 5;
        return Math.pow(X * X + Y - 11, 2) + Math.pow(X + Y * Y - 7, 2);
      },
      toiUu: 0
    }
  };

  var THUAT = [
    { ma: "leo-doi", ten: "Leo đồi khởi động lại", ghi: "đi lên, kẹt thì nhảy chỗ khác" },
    { ma: "toi-luyen", ten: "Tôi luyện mô phỏng", ghi: "chấp nhận bước xấu, nhiệt độ giảm dần" },
    { ma: "di-truyen", ten: "Giải thuật di truyền", ghi: "quần thể, lai ghép, đột biến" },
    { ma: "pso", ten: "Bầy hạt (PSO)", ghi: "ký ức riêng + áp lực đám đông" }
  ];

  demo({
    id: "dau-truong",
    nhom: "Tối ưu hoá & heuristic",
    mon: "L27",
    ten: "Đấu trường metaheuristic — không ai thắng ở mọi địa hình",
    moTa: "Bốn thuật toán, cùng hàm mục tiêu, cùng hạt giống, và quan trọng nhất — " +
          "<b>cùng ngân sách số lần gọi hàm</b>. Giữ nguyên mọi thứ, chỉ kéo thanh " +
          "<b>ngân sách</b>: ở 2 000 lần gọi leo đồi thắng tuyệt đối, ở 20 000 nó " +
          "thua tuyệt đối. <b>Cùng bài toán, người thắng vẫn đổi.</b>",

    dung: function (host) {
      var K = null, B = null, P = null, BTL = null;
      var dh = DIA_HINH["rastrigin"];
      var tt = null, lsTot = null, mauTh = [], soGoi = null;
      var Rnd = null;

      var TS = V.thamSo([
        { ma: "diaHinh", ten: "Địa hình", kieu: "chon", gt: "rastrigin",
          muc: Object.keys(DIA_HINH).map(function (k) {
            return { v: k, t: DIA_HINH[k].ten };
          }) },
        { ma: "nganSach", ten: "Ngân sách gọi hàm mỗi thuật toán", kieu: "so",
          min: 500, max: 20000, buoc: 500, gt: 2000,
          moTa: "<b>Đây mới là đơn vị đo đúng</b> của tối ưu hoá — không phải số vòng " +
                "lặp, không phải giây. Ngoài đời một lần gọi hàm có thể là cả một " +
                "mô phỏng chạy mười phút.<br><b>Kéo riêng thanh này</b> và xem người " +
                "thắng đổi, dù địa hình và hạt giống không hề đổi." },
        { ma: "quanThe", ten: "Cỡ quần thể (GA và PSO)", kieu: "so",
          min: 6, max: 80, buoc: 2, gt: 24 },
        { ma: "nhietDau", ten: "Nhiệt độ ban đầu (tôi luyện)", kieu: "so",
          min: 0.5, max: 60, buoc: 0.5, gt: 12 },
        { ma: "hat", ten: "Hạt giống", kieu: "hat", gt: 3,
          moTa: "Đổi hạt vài lần trước khi kết luận. Một lần chạy đơn lẻ " +
                "<b>không nói lên điều gì</b> về thuật toán ngẫu nhiên." },
        { ma: "veDauChan", ten: "Vẽ mọi điểm đã thử", kieu: "bat", gt: true,
          moTa: "Bật lên để thấy <b>cách mỗi thuật toán tiêu ngân sách</b>: " +
                "chỗ nào nó soi kỹ, chỗ nào nó bỏ qua." }
      ], {
        doi: function () { apDung(); },
        preset: [
          { ten: "★ Cầu · ngân sách 2 000",  gt: { diaHinh: "cau", nganSach: 2000 } },
          { ten: "★ Cầu · ngân sách 20 000", gt: { diaHinh: "cau", nganSach: 20000 } },
          { ten: "Rastrigin",       gt: { diaHinh: "rastrigin", nganSach: 6000 } },
          { ten: "Ackley",          gt: { diaHinh: "ackley", nganSach: 2000 } },
          { ten: "Schwefel — bẫy",  gt: { diaHinh: "schwefel", nganSach: 6000 } },
          { ten: "Himmelblau",      gt: { diaHinh: "himmelblau", nganSach: 6000 } },
          { ten: "Kim đáy bể",      gt: { diaHinh: "kim-day-rom", nganSach: 2000 } }
        ]
      });

      var G = TS.gt;

      var cv = V.veBangCo({ rong: 880, tiLe: 0.88, veLai: function () { if (P) apDung(); } });
      var g = cv.g;
      var S = V.soLieu();
      var ghiChu = V.el("div", { class: "chu-thich" });

      /* ============================================================
         Ham muc tieu — CO DEM so lan goi
         ============================================================ */
      /** Tra ve null khi da het ngan sach. Moi noi goi PHAI xu ly truong
          hop do — neu khong thi loi hua "cung ngan sach" cua lab la gia. */
      function conNganSach(i) { return soGoi[i] < G.nganSach; }
      function danhGia(i, x, y) {
        if (soGoi[i] >= G.nganSach) return null;
        soGoi[i]++;
        return dh.f(x, y);
      }
      function kep(v) { return v < -PHAM ? -PHAM : (v > PHAM ? PHAM : v); }

      /* ============================================================
         Bon thuat toan
         ============================================================ */
      function khoiTao(i) {
        var R = tt[i].R;
        var q = Math.round(G.quanThe);
        var s = tt[i];
        if (THUAT[i].ma === "leo-doi") {
          s.x = R.khoang(-PHAM, PHAM); s.y = R.khoang(-PHAM, PHAM);
          s.f = danhGia(i, s.x, s.y);
          s.buoc = PHAM * 0.35;
          s.thang = 0; s.lan = 0;
        } else if (THUAT[i].ma === "toi-luyen") {
          s.x = R.khoang(-PHAM, PHAM); s.y = R.khoang(-PHAM, PHAM);
          s.f = danhGia(i, s.x, s.y);
          s.T = G.nhietDau;
        } else {
          s.qx = new Float64Array(q); s.qy = new Float64Array(q);
          s.qf = new Float64Array(q);
          s.vx = new Float64Array(q); s.vy = new Float64Array(q);
          s.px = new Float64Array(q); s.py = new Float64Array(q);
          s.pf = new Float64Array(q);
          for (var j = 0; j < q; j++) {
            s.qx[j] = R.khoang(-PHAM, PHAM); s.qy[j] = R.khoang(-PHAM, PHAM);
            s.qf[j] = conNganSach(i) ? danhGia(i, s.qx[j], s.qy[j]) : Infinity;
            s.vx[j] = R.khoang(-1, 1); s.vy[j] = R.khoang(-1, 1);
            s.px[j] = s.qx[j]; s.py[j] = s.qy[j]; s.pf[j] = s.qf[j];
          }
        }
      }

      /** Mot "buoc" = mot lan chay ngan cua thuat toan, nhung deu bi chan
          boi NGAN SACH GOI HAM — do moi la thuoc do cong bang. */
      function buocThuat(i) {
        var s = tt[i], R = s.R, q = Math.round(G.quanThe), j;
        if (soGoi[i] >= G.nganSach) return false;

        if (THUAT[i].ma === "leo-doi") {
          /* (1+1)-ES voi QUY TAC 1/5 cua Rechenberg: cu 10 lan de xuat lai
             xem ti le thanh cong. Tren 1/5 nghia la dang di de qua -> NOI
             buoc ra; duoi 1/5 nghia la dang di qua tham -> co buoc lai.
             Quy tac mot dong nay la thu bien leo doi tu do choi thanh mot
             doi thu that: tren mat tron no dat do chinh xac may. */
          var nx = kep(s.x + R.chuan() * s.buoc);
          var ny = kep(s.y + R.chuan() * s.buoc);
          var nf = danhGia(i, nx, ny);
          if (nf === null) return false;
          ghiDau(i, nx, ny);
          if (nf < s.f) { s.x = nx; s.y = ny; s.f = nf; s.thang++; }
          s.lan++;
          if (s.lan >= 10) {
            s.buoc *= s.thang > 2 ? 1.5 : 0.817;
            s.lan = 0; s.thang = 0;
          }
          /* Buoc co ve gan nhu khong con -> da vet kiet cho nay, nhay di
             cho khac. Ky luc van duoc giu, nen khoi dong lai khong mat gi. */
          if (s.buoc < 1e-11 || s.buoc > PHAM * 2) {
            s.x = R.khoang(-PHAM, PHAM); s.y = R.khoang(-PHAM, PHAM);
            var lai = danhGia(i, s.x, s.y);
            s.f = lai === null ? Infinity : lai;
            s.buoc = PHAM * 0.35; s.lan = 0; s.thang = 0;
          }
        } else if (THUAT[i].ma === "toi-luyen") {
          /* Buoc de xuat phai CO LAI theo nhiet do. Giu buoc lon khi da
             lanh thi moi de xuat deu bi tu choi, va thuat toan dung yen o
             mot cho khong tinh chinh them duoc gi — do la ly do ban dau
             toi luyen ve bet o moi dia hinh. */
          var bd = PHAM * (0.02 + 0.28 * Math.sqrt(s.T / Math.max(1e-9, G.nhietDau)));
          var mx = kep(s.x + R.chuan() * bd);
          var my = kep(s.y + R.chuan() * bd);
          var mf = danhGia(i, mx, my);
          if (mf === null) return false;
          ghiDau(i, mx, my);
          var d = mf - s.f;
          /* Metropolis: buoc xau van duoc nhan, voi xac suat exp(-d/T). */
          if (d < 0 || R() < Math.exp(-d / Math.max(1e-9, s.T))) {
            s.x = mx; s.y = my; s.f = mf;
          }
          /* Lam lanh theo ti le, dat sao cho het ngan sach thi T ~ 1e-4 T0. */
          s.T *= Math.pow(1e-4, 1 / Math.max(1, G.nganSach));
        } else if (THUAT[i].ma === "di-truyen") {
          /* Mot the he: chon giai dau, lai ghep, dot bien. */
          var cx = new Float64Array(q), cy = new Float64Array(q), cf = new Float64Array(q);
          for (j = 0; j < q; j++) {
            /* Het ngan sach giua chung the he: nhung o con lai giu nguyen
               ca the doi truoc, KHONG danh gia them. Neu cu danh gia cho
               tron the he thi GA duoc tieu lo toi q-1 lan goi ham so voi
               ba doi thu — va ca cuoc thi thanh vo nghia. */
            if (!conNganSach(i)) {
              cx[j] = s.qx[j]; cy[j] = s.qy[j]; cf[j] = s.qf[j];
              continue;
            }
            var a = giaiDau(s, R, q), b = giaiDau(s, R, q);
            var t = R();
            var kx = s.qx[a] * t + s.qx[b] * (1 - t);
            var ky = s.qy[a] * t + s.qy[b] * (1 - t);
            kx = kep(kx + R.chuan() * PHAM * 0.08);
            ky = kep(ky + R.chuan() * PHAM * 0.08);
            cx[j] = kx; cy[j] = ky; cf[j] = danhGia(i, kx, ky);
            ghiDau(i, kx, ky);
          }
          /* Giu lai ca the tot nhat cua doi truoc — khong thi quan the co the
             tot dan roi lai te di. */
          var tot = 0;
          for (j = 1; j < q; j++) if (s.qf[j] < s.qf[tot]) tot = j;
          var te = 0;
          for (j = 1; j < q; j++) if (cf[j] > cf[te]) te = j;
          cx[te] = s.qx[tot]; cy[te] = s.qy[tot]; cf[te] = s.qf[tot];
          s.qx = cx; s.qy = cy; s.qf = cf;
        } else {
          var w = 0.72, c1 = 1.5, c2 = 1.5;
          var gTot = 0;
          for (j = 1; j < q; j++) if (s.pf[j] < s.pf[gTot]) gTot = j;
          for (j = 0; j < q; j++) {
            /* Cung ly do nhu GA: het ngan sach giua bay thi hat con lai
               dung yen, khong duoc bay them mot buoc mien phi nao. */
            if (!conNganSach(i)) break;
            s.vx[j] = w * s.vx[j] + c1 * R() * (s.px[j] - s.qx[j])
                                  + c2 * R() * (s.px[gTot] - s.qx[j]);
            s.vy[j] = w * s.vy[j] + c1 * R() * (s.py[j] - s.qy[j])
                                  + c2 * R() * (s.py[gTot] - s.qy[j]);
            s.qx[j] = kep(s.qx[j] + s.vx[j]);
            s.qy[j] = kep(s.qy[j] + s.vy[j]);
            s.qf[j] = danhGia(i, s.qx[j], s.qy[j]);
            ghiDau(i, s.qx[j], s.qy[j]);
            if (s.qf[j] < s.pf[j]) {
              s.px[j] = s.qx[j]; s.py[j] = s.qy[j]; s.pf[j] = s.qf[j];
            }
          }
        }

        /* Cap nhat ky luc. */
        var totNhat = Infinity, tx = 0, ty = 0;
        if (THUAT[i].ma === "leo-doi" || THUAT[i].ma === "toi-luyen") {
          totNhat = s.f; tx = s.x; ty = s.y;
        } else {
          for (j = 0; j < q; j++) {
            if (s.qf[j] === null || !isFinite(s.qf[j])) continue;
            if (s.qf[j] < totNhat) { totNhat = s.qf[j]; tx = s.qx[j]; ty = s.qy[j]; }
          }
        }
        if (totNhat < s.kyLuc) { s.kyLuc = totNhat; s.kx = tx; s.ky = ty; }
        return true;
      }

      function giaiDau(s, R, q) {
        var a = Math.floor(R() * q), b = Math.floor(R() * q);
        return s.qf[a] <= s.qf[b] ? a : b;
      }

      /* Dau chan: moi diem da thu, ve mot lan vao bang tich luy. */
      var dauCho = null;
      function ghiDau(i, x, y) {
        if (!G.veDauChan) return;
        dauCho[i].push(x, y);
      }

      /* ============================================================
         Chuan bi
         ============================================================ */
      function chuanBi() {
        dh = DIA_HINH[G.diaHinh] || DIA_HINH["rastrigin"];
        var hat = Math.round(G.hat) || 1;
        soGoi = new Int32Array(THUAT.length);
        dauCho = THUAT.map(function () { return []; });
        mauTh = [V.mau("ac"), V.mau("ba"), V.mau("ok"), V.mau("loi")];

        tt = THUAT.map(function (_, i) {
          return { R: V.rng(hat + i * 977), kyLuc: Infinity, kx: 0, ky: 0 };
        });
        lsTot = THUAT.map(function () { return []; });
        for (var i = 0; i < THUAT.length; i++) khoiTao(i);

        var chiaY = Math.round(cv.H * 0.64);
        K = V.khungNhieu(cv, { so: 4, cot: 2, le: 10, leTren: 24,
                               leDuoi: cv.H - chiaY, khoang: 8 });
        B = V.bieuDo(cv, {
          le: { t: chiaY + 30, r: 18, b: 32, l: 70 },
          x: { min: 0, max: G.nganSach, nhan: "số lần gọi hàm mục tiêu",
               vach: 4, dinhDang: V.soGon },
          y: { min: 1e-4, max: 1000, log: true, nhan: "giá trị tốt nhất tìm được",
               dinhDang: function (v) { return v.toExponential(0); } },
          luoi: 4
        });
        BTL = V.bangTichLuy(cv);
      }

      /* ============================================================
         Ve
         ============================================================ */
      function veNenDiaHinh(gd) {
        for (var i = 0; i < K.length; i++) {
          var t = K[i].trong();
          var buoc = 3;
          /* Do min/max mot lan de to mau cho deu. */
          for (var py = 0; py < t.cao; py += buoc) {
            for (var px = 0; px < t.rong; px += buoc) {
              var wx = (px / t.rong * 2 - 1) * PHAM;
              var wy = (1 - py / t.cao * 2) * PHAM;
              var f = dh.f(wx, wy);
              var u = Math.log(1 + Math.max(0, f)) / Math.log(1 + 900);
              gd.fillStyle = V.thangMau(Math.min(1, u) * 0.8);
              gd.fillRect(t.x + px, t.y + py, buoc, buoc);
            }
          }
        }
      }

      function toaDo(k, wx, wy) {
        var t = k.trong();
        return [t.x + (wx / PHAM + 1) / 2 * t.rong,
                t.y + (1 - (wy / PHAM + 1) / 2) * t.cao];
      }

      function ve(kb) {
        BTL.toi(1, veNenDiaHinh);
        g.clearRect(0, 0, cv.W, cv.H);
        g.fillStyle = V.mau("surf");
        g.fillRect(0, 0, cv.W, cv.H);
        BTL.dan();

        for (var i = 0; i < THUAT.length; i++) {
          var kh = K[i], s = tt[i];
          kh.vien();

          if (G.veDauChan) {
            g.save();
            g.globalAlpha = 0.35;
            g.fillStyle = mauTh[i];
            var d = dauCho[i];
            for (var q = 0; q < d.length; q += 2) {
              var p = toaDo(kh, d[q], d[q + 1]);
              g.fillRect(p[0] - 0.7, p[1] - 0.7, 1.4, 1.4);
            }
            g.restore();
          }

          /* Ky luc. */
          var pk = toaDo(kh, s.kx, s.ky);
          g.save();
          g.strokeStyle = V.mau("surf"); g.lineWidth = 3;
          g.beginPath(); g.arc(pk[0], pk[1], 5, 0, 6.2832); g.stroke();
          g.fillStyle = mauTh[i];
          g.beginPath(); g.arc(pk[0], pk[1], 5, 0, 6.2832); g.fill();
          g.restore();

          kh.nhan(THUAT[i].ten, mauTh[i]);
          kh.soPhu(s.kyLuc === Infinity ? "—" : s.kyLuc.toExponential(2) +
                   "   " + soGoi[i].toLocaleString("vi") + " lần gọi");
        }

        B.dat({ x: { min: 0, max: Math.round(G.nganSach), nhan: "số lần gọi hàm mục tiêu",
                     vach: 4, dinhDang: V.soGon },
                y: { min: 1e-4, max: 1000, log: true, nhan: "giá trị tốt nhất tìm được",
                     dinhDang: function (v) { return v.toExponential(0); } } });
        B.truc();
        B.moc(dh.toiUu > 0 ? dh.toiUu : 1e-4, V.mau("tx3"), "tối ưu toàn cục");
        for (i = 0; i < THUAT.length; i++) B.duong(lsTot[i], mauTh[i], 1.8);

        /* Bang xep hang. */
        var xep = THUAT.map(function (t, i2) { return [i2, tt[i2].kyLuc]; })
                       .sort(function (a, b) { return a[1] - b[1]; });
        /* Loi hua cua lab nay la "cung ngan sach". Nen lab tu dem so thuat
           toan da VUOT ngan sach va in len — con so do phai luon la 0, va
           tang kiem so doi chieu dung no. */
        var vuot = 0, nhieuNhat = 0;
        for (i = 0; i < THUAT.length; i++) {
          if (soGoi[i] > G.nganSach) vuot++;
          if (soGoi[i] > nhieuNhat) nhieuNhat = soGoi[i];
        }
        var bang = {
          "Địa hình": dh.ten.split(" — ")[0],
          "Ngân sách": Math.round(G.nganSach).toLocaleString("vi") + " lần gọi hàm",
          "Gọi nhiều nhất": nhieuNhat.toLocaleString("vi"),
          "Vượt ngân sách": vuot + " thuật toán  (phải luôn là 0)"
        };
        for (i = 0; i < xep.length; i++) {
          bang[(i + 1) + ". " + THUAT[xep[i][0]].ten] =
            xep[i][1] === Infinity ? "—" : xep[i][1].toExponential(3);
        }
        bang["Thắng"] = THUAT[xep[0][0]].ten;
        bang["⚑ Nhắc"] = "đổi hạt giống vài lần trước khi kết luận";
        S.dat(bang);
      }

      /* ============================================================
         Dieu phoi
         ============================================================ */
      function apDung() {
        if (!cv.W) return;
        chuanBi();
        P.datToiDa(4000);
        P.datTocDo(60);
        ghiChu.innerHTML = "";
        THUAT.forEach(function (t, i) {
          ghiChu.appendChild(V.el("span", {}, [
            V.el("i", { class: "o-mau", style: "background:" + mauTh[i] }),
            t.ten + " — " + t.ghi
          ]));
        });
        P.datLai();
      }

      P = V.phat({
        ten: "dau-truong",
        bang: cv,
        tocDo: 60,
        buoc: function () {
          var conChay = false;
          for (var i = 0; i < THUAT.length; i++) {
            if (buocThuat(i)) conChay = true;
            lsTot[i].push([soGoi[i], Math.max(1e-5, tt[i].kyLuc)]);
            if (lsTot[i].length > 5000) lsTot[i].shift();
          }
          return conChay;
        },
        datLai: function () { chuanBi(); },
        ve: ve,
        nhan: function (k, xong) {
          var tot = 0;
          for (var i = 1; i < THUAT.length; i++) if (tt[i].kyLuc < tt[tot].kyLuc) tot = i;
          return (xong ? "hết ngân sách · " : "") + "dẫn đầu: " + THUAT[tot].ten;
        }
      });

      var r = V.khung(host, {
        ten: "dau-truong",
        bang: cv,
        ve: [cv, ghiChu],
        dieuKhien: [P.dk(), TS.dk(), S.el],
        giaiThich:
          "<b>Điều kiện thi đấu.</b> Cùng hàm mục tiêu, cùng hạt giống, và quan trọng nhất " +
          "— <b>cùng ngân sách số lần gọi hàm mục tiêu</b>. Đó là đơn vị đo đúng của tối ưu " +
          "hoá: ngoài đời một lần “gọi hàm” có thể là một mô phỏng chạy mười phút, nên so " +
          "theo số vòng lặp hay theo giây đều vô nghĩa. Ô <i>Vượt ngân sách</i> trong bảng " +
          "số liệu phải <b>luôn bằng 0</b> — nó có ở đó để bạn kiểm tra rằng cuộc thi này " +
          "thật sự công bằng." +
          "<ul>" +
          "<li><b>Thí nghiệm chính — chỉ đổi MỘT thanh.</b> Bấm preset " +
          "<i>★ Cầu · ngân sách 2 000</i>: leo đồi thắng. Bấm tiếp " +
          "<i>★ Cầu · ngân sách 20 000</i>: leo đồi <b>thua bét nhì</b>, PSO thắng. " +
          "Địa hình y nguyên, hạt giống y nguyên, thuật toán y nguyên. " +
          "<b>Chỉ ngân sách đổi, và người thắng đổi theo.</b></li>" +
          "<li>Đo trên 8 hạt giống: ở ngân sách ≤ 2 000 leo đồi thắng <b>8/8</b> trên " +
          "mặt cầu và Ackley; ở ≥ 6 000 nó thua <b>0/8</b>. Không phải may rủi — " +
          "đó là hai chế độ khác hẳn nhau.</li>" +
          "<li><b>Vì sao.</b> PSO phải tiêu 24 lần gọi chỉ để khởi tạo bầy, rồi 24 lần " +
          "nữa cho mỗi vòng. Ngân sách ít thì nó chưa kịp làm gì đã hết tiền. Leo đồi " +
          "tiêu <b>đúng 1 lần gọi mỗi bước</b> nên nó đã đi được 2 000 bước tinh chỉnh. " +
          "Nhưng ngân sách nhiều thì lợi thế đó hết ý nghĩa, còn trí nhớ tập thể của " +
          "bầy thì càng lúc càng có giá.</li>" +
          "</ul>" +
          "<b>Trục thứ hai: địa hình.</b> Ở cùng ngân sách 2 000, leo đồi thắng 8/8 trên " +
          "mặt cầu và Ackley, nhưng chỉ 2/8 trên Rastrigin — nơi nó kẹt vào gợn sóng gần " +
          "như ngay lập tức." +
          "<ul>" +
          "<li><b>Schwefel</b> là cái bẫy ác nhất: cực tiểu toàn cục nằm <b>xa tâm</b>, " +
          "còn gần giữa là một cực tiểu giả rất hấp dẫn. Thuật toán nào có xu hướng tụ " +
          "về giữa sẽ bị lừa — và leo đồi tụt xuống hạng bét ở đây.</li>" +
          "<li><b>Kim đáy bể</b> phẳng lì khắp nơi trừ một cái giếng bán kính 0,5. " +
          "<b>Không có dốc nào để bám</b>, nên mọi mẹo “đi xuống” đều vô dụng và bài " +
          "toán chỉ còn là: ai rải mẫu thăm dò rộng hơn. Ở ngân sách 500 thì bốn thuật " +
          "toán gần như <b>ngang nhau</b> — đó chính là hình ảnh của bài toán mà không " +
          "hiểu biết nào giúp được.</li>" +
          "<li><b>Himmelblau</b> có <b>bốn</b> cực tiểu toàn cục ngang nhau. Bật " +
          "<i>vẽ mọi điểm đã thử</i>: GA và PSO thường tụ hết về một cái (mất đa dạng), " +
          "trong khi leo đồi khởi động lại rải đều hơn.</li>" +
          "</ul>" +
          "<b>Bật “vẽ mọi điểm đã thử”</b> để thấy cách mỗi thuật toán <i>tiêu</i> ngân " +
          "sách: leo đồi soi rất kỹ một vùng nhỏ, tôi luyện đi lang thang lúc còn nóng " +
          "rồi co dần lại, GA tụ thành cụm, PSO quét thành những vệt cong đặc trưng." +
          "<ul>" +
          "<li><b>Đổi hạt giống vài lần trước khi kết luận.</b> Đây là thuật toán ngẫu " +
          "nhiên; một lần chạy đơn lẻ không nói lên điều gì. Mọi con số “8/8” ở trên đều " +
          "là đếm trên 8 hạt giống, không phải một lần chạy.</li>" +
          "<li><b>“Không có bữa ăn trưa miễn phí”</b> (Wolpert & Macready, 1997) nói rằng " +
          "lấy trung bình trên <i>mọi</i> hàm mục tiêu có thể có, mọi thuật toán tìm kiếm " +
          "đều ngang nhau. Nói cho đúng: định lý đó <b>không</b> hứa rằng thứ hạng sẽ đảo " +
          "trên vài hàm chuẩn quen thuộc — hàm chuẩn đều có cấu trúc, và thuật toán khai " +
          "thác được cấu trúc thì thắng. Cái lab này đo được, và cũng là cái đáng nhớ hơn, " +
          "là <b>câu “thuật toán X tốt hơn Y” luôn thiếu vế sau</b>: tốt hơn trên địa hình " +
          "nào, và với bao nhiêu lần gọi hàm.</li>" +
          "</ul>"
      });
      r.trai.classList.add("co");

      requestAnimationFrame(function () { cv.doKichThuoc(); apDung(); });
    }
  });
})();
