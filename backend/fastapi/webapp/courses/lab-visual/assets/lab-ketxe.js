/* =====================================================================
   lab-ketxe.js — Ket xe ma va nghich ly Braess.

   Hai cach de giao thong phan boi truc giac:
   (1) Khong co tai nan, khong co den do, khong co gi ca — van ket. Mot
       nguoi phanh nhe, song phanh chay NGUOC chieu xe chay, lon dan.
   (2) Mo them mot con duong moi, mien phi, khong ai bi ep di — va MOI
       NGUOI deu ve nha muon hon truoc.
   ===================================================================== */
(function () {
  "use strict";
  var V = window.VIS;

  demo({
    id: "ket-xe",
    nhom: "Bầy đàn & tác tử",
    mon: "L15",
    ten: "Kẹt xe ma và nghịch lý Braess",
    moTa: "Hai cách giao thông phản bội trực giác. <b>①</b> Không tai nạn, không đèn đỏ, " +
          "đường vòng tròn — vẫn kẹt, và điểm kẹt <b>chạy ngược chiều xe</b>. " +
          "<b>②</b> Mở thêm một con đường mới hoàn toàn miễn phí, và <b>mọi người</b> " +
          "về nhà muộn hơn trước.",

    dung: function (host) {
      var P = null, B = null;
      /* --- che do vong tron --- */
      var vt = null, tocDo = null;      /* vi tri (0..1 tren vong) va toc do */
      var lichSuToc = [], buocDem = 0;
      var CHU_VI = 1000;                /* do dai duong vong, don vi tuy y */
      /* --- che do Braess --- */
      var nTren = 0;                    /* so tai xe di nhanh tren -> A */
      var lichSuTg = [];

      var TS = V.thamSo([
        { ma: "che", ten: "Chế độ", kieu: "chon", gt: "vong-tron", muc: [
          { v: "vong-tron", t: "① Kẹt xe ma trên đường vòng" },
          { v: "braess",    t: "② Nghịch lý Braess — thêm đường, chậm hơn" }
        ] },

        { ten: "① Đường vòng", kieu: "nhom", hien: function (g) { return g.che === "vong-tron"; } },
        { ma: "soXe", ten: "Số xe", kieu: "so", min: 5, max: 90, buoc: 1, gt: 32,
          moTa: "Dưới ~22 xe thì dòng tự giãn ra và chạy đều mãi. Trên ngưỡng đó, " +
                "một nhiễu động bé cũng đủ sinh ra sóng kẹt không bao giờ tan.",
          hien: function (g) { return g.che === "vong-tron"; } },
        { ma: "tocMong", ten: "Tốc độ mong muốn", kieu: "so", min: 0.5, max: 4, buoc: 0.1, gt: 2.2,
          hien: function (g) { return g.che === "vong-tron"; } },
        { ma: "nhayPhanh", ten: "Mức nhạy phanh", kieu: "so", min: 0.2, max: 4, buoc: 0.1, gt: 1.4,
          moTa: "Tài xế phanh gấp bao nhiêu khi thấy xe trước gần. Càng nhạy càng dễ " +
                "sinh sóng — phản ứng thái quá là nguyên nhân, không phải giải pháp.",
          hien: function (g) { return g.che === "vong-tron"; } },
        { ma: "nhieu", ten: "Nhiễu động lái xe", kieu: "so", min: 0, max: 0.3, buoc: 0.01, gt: 0.06,
          moTa: "Đặt về <b>0</b>: dòng xe hoàn hảo chạy mãi không kẹt. Nhích lên " +
                "<b>0,02</b> thôi là đủ châm ngòi.",
          hien: function (g) { return g.che === "vong-tron"; } },
        { ma: "hat", ten: "Hạt giống", kieu: "hat", gt: 3,
          hien: function (g) { return g.che === "vong-tron"; } },

        { ten: "② Mạng Braess", kieu: "nhom", hien: function (g) { return g.che === "braess"; } },
        { ma: "soTaiXe", ten: "Số tài xế", kieu: "so", min: 500, max: 8000, buoc: 500, gt: 4000,
          hien: function (g) { return g.che === "braess"; } },
        { ma: "coCau", ten: "Đã mở cây cầu A→B (miễn phí, siêu nhanh)", kieu: "bat", gt: false,
          moTa: "Bật lên và xem thời gian đi của <b>tất cả mọi người</b> tăng lên. " +
                "Không ai bị ép đi qua cầu — ai cũng tự chọn đường nhanh nhất cho mình.",
          hien: function (g) { return g.che === "braess"; } }
      ], {
        doi: function () { apDung(); },
        preset: [
          { ten: "Kẹt xe ma",            gt: { che: "vong-tron", soXe: 32, nhieu: 0.06 } },
          { ten: "Dưới ngưỡng (18 xe)",  gt: { che: "vong-tron", soXe: 18, nhieu: 0.06 } },
          { ten: "Không nhiễu — không kẹt", gt: { che: "vong-tron", soXe: 32, nhieu: 0 } },
          { ten: "Braess: chưa có cầu",  gt: { che: "braess", coCau: false } },
          { ten: "Braess: đã mở cầu",    gt: { che: "braess", coCau: true } }
        ]
      });

      var G = TS.gt;

      var cv = V.veBangCo({ rong: 880, tiLe: 0.8, veLai: function () { if (P) apDung(); } });
      var g = cv.g;
      var S = V.soLieu();
      var ghiChu = V.el("div", { class: "chu-thich" });
      var Rnd = null;

      /* ============================================================
         ① Duong vong — mo hinh "lai xe thong minh" rut gon
         ============================================================ */
      function vtChuanBi() {
        var n = Math.round(G.soXe);
        Rnd = V.rng(Math.round(G.hat) || 1);
        vt = new Float64Array(n);
        tocDo = new Float64Array(n);
        for (var i = 0; i < n; i++) {
          vt[i] = i / n * CHU_VI;        /* rai deu, khong ai bi kep tu dau */
          tocDo[i] = G.tocMong;
        }
        lichSuToc = []; buocDem = 0;

        var chiaY = Math.round(cv.H * 0.62);
        B = V.bieuDo(cv, {
          le: { t: chiaY + 30, r: 18, b: 30, l: 62 },
          x: { min: 0, max: 100, nhan: "bước", vach: 4, dinhDang: V.soGon },
          y: { min: 0, max: Math.max(1, G.tocMong * 1.1), nhan: "tốc độ",
               dinhDang: function (v) { return v.toFixed(1); } },
          luoi: 2
        });
      }

      function vtMotBuoc() {
        var n = vt.length, i;
        var khoangAnToan = 12;
        for (i = 0; i < n; i++) {
          /* Xe truoc la xe co chi so ke tiep tren vong. */
          var j = (i + 1) % n;
          var cach = vt[j] - vt[i];
          if (cach < 0) cach += CHU_VI;

          /* Muon chay nhanh hon, nhung phanh khi khoang cach nho hon muc an
             toan ti le voi toc do — dung y tuong cua mo hinh IDM. */
          var mucCan = khoangAnToan + tocDo[i] * 6;
          var giaToc;
          if (cach < mucCan) {
            giaToc = -G.nhayPhanh * (mucCan - cach) / mucCan * 1.2;
          } else {
            giaToc = 0.12 * (G.tocMong - tocDo[i]);
          }
          giaToc += (Rnd() - 0.5) * G.nhieu;       /* tay lai khong hoan hao */

          tocDo[i] += giaToc;
          if (tocDo[i] < 0) tocDo[i] = 0;
          if (tocDo[i] > G.tocMong * 1.3) tocDo[i] = G.tocMong * 1.3;
          /* Khong duoc dam vao xe truoc. */
          if (tocDo[i] > cach - 4) tocDo[i] = Math.max(0, cach - 4);
        }
        for (i = 0; i < n; i++) {
          vt[i] = (vt[i] + tocDo[i]) % CHU_VI;
        }
        buocDem++;
        if (buocDem % 2 === 0) {
          var tb = 0, nho = Infinity;
          for (i = 0; i < n; i++) { tb += tocDo[i]; if (tocDo[i] < nho) nho = tocDo[i]; }
          lichSuToc.push([buocDem, tb / n, nho]);
          if (lichSuToc.length > 4000) lichSuToc.shift();
        }
        return true;
      }

      function vtVe() {
        g.clearRect(0, 0, cv.W, cv.H);
        g.fillStyle = V.mau("surf");
        g.fillRect(0, 0, cv.W, cv.H);

        var chiaY = Math.round(cv.H * 0.62);
        var cx = cv.W / 2, cy = chiaY / 2 + 4;
        var bk = Math.min(cv.W * 0.32, chiaY / 2 - 18);

        g.save();
        g.strokeStyle = V.mau("bd2");
        g.lineWidth = Math.max(8, bk * 0.09);
        g.beginPath(); g.arc(cx, cy, bk, 0, 6.2832); g.stroke();
        g.restore();

        var n = vt.length;
        for (var i = 0; i < n; i++) {
          var a = vt[i] / CHU_VI * Math.PI * 2 - Math.PI / 2;
          var t = Math.min(1, tocDo[i] / Math.max(0.001, G.tocMong));
          /* Do = dung, xanh = chay het toc do. */
          g.fillStyle = t < 0.45 ? V.mau("loi") : (t < 0.8 ? V.mau("ba") : V.mau("ac"));
          g.beginPath();
          g.arc(cx + Math.cos(a) * bk, cy + Math.sin(a) * bk,
                Math.max(2.5, bk * 0.035), 0, 6.2832);
          g.fill();
        }
        g.fillStyle = V.mau("tx3");
        g.font = "11px ui-monospace,monospace";
        g.textAlign = "center"; g.textBaseline = "middle";
        g.fillText("xe chạy theo chiều kim đồng hồ", cx, cy);

        var tran = Math.max(80, buocDem);
        B.dat({ x: { min: 0, max: tran, nhan: "bước", vach: 4, dinhDang: V.soGon },
                y: { min: 0, max: Math.max(1, G.tocMong * 1.1), nhan: "tốc độ",
                     dinhDang: function (v) { return v.toFixed(1); } } });
        B.truc();
        B.moc(G.tocMong, V.mau("ok"), "tốc độ mong muốn");
        B.duong(lsCot(1), V.mau("ac"), 1.8);
        B.duong(lsCot(2), V.mau("loi"), 1.6);

        var tb = 0, nho = Infinity, dung = 0;
        for (i = 0; i < n; i++) {
          tb += tocDo[i];
          if (tocDo[i] < nho) nho = tocDo[i];
          if (tocDo[i] < G.tocMong * 0.25) dung++;
        }
        tb /= n;
        S.dat({
          "Số xe": n,
          "Mật độ": (n / CHU_VI * 100).toFixed(1) + " xe / 100 đơn vị đường",
          "Tốc độ trung bình": tb.toFixed(2) + " / " + G.tocMong.toFixed(2),
          "Xe chậm nhất": nho.toFixed(2),
          "Số xe gần như đứng": dung + "  (" + (dung / n * 100).toFixed(0) + "%)",
          "Trạng thái": dung > n * 0.12 ? "đã hình thành sóng kẹt"
                      : (tb > G.tocMong * 0.9 ? "dòng chảy tự do" : "đang nghẽn dần")
        });
      }

      /* Tach mot cot cua lichSuToc thanh mang [x, y] — dung lai mang de
         khong de rac moi khung hinh. */
      var _dem1 = [], _dem2 = [];
      function lsCot(k) {
        var ra = k === 1 ? _dem1 : _dem2;
        ra.length = 0;
        for (var i = 0; i < lichSuToc.length; i++) {
          ra.push([lichSuToc[i][0], lichSuToc[i][k]]);
        }
        return ra;
      }

      /* ============================================================
         ② Nghich ly Braess
         ============================================================ */
      /* Mang: Xuat phat -> A -> Dich, va Xuat phat -> B -> Dich.
         Doan "co the tac" ton n/100 phut; doan co dinh ton 45 phut.
         Cau A->B mien phi noi hai nhanh lai. */
      function thoiGianTuyen(tuyen, nA, nB) {
        /* nA = so nguoi di Xuat->A ; nB = so nguoi di B->Dich
           tuyen 0: Xuat->A->Dich   = nA/100 + 45
           tuyen 1: Xuat->B->Dich   = 45 + nB/100
           tuyen 2: Xuat->A->B->Dich = nA/100 + 0 + nB/100 */
        if (tuyen === 0) return nA / 100 + 45;
        if (tuyen === 1) return 45 + nB / 100;
        return nA / 100 + nB / 100;
      }

      function brChuanBi() {
        nTren = Math.round(G.soTaiXe / 2);
        lichSuTg = [];
        var chiaY = Math.round(cv.H * 0.60);
        B = V.bieuDo(cv, {
          le: { t: chiaY + 30, r: 18, b: 30, l: 66 },
          x: { min: 0, max: 60, nhan: "vòng chọn lại đường", vach: 4, dinhDang: V.soGon },
          y: { min: 40, max: 95, nhan: "thời gian đi (phút)",
               dinhDang: function (v) { return v.toFixed(0); } },
          luoi: 3
        });
      }

      /** Mot vong: moi tai xe chon lai tuyen nhanh nhat theo tinh hinh hien tai.
          Day la dong thai "phan ung tot nhat" — hoi tu ve can bang Nash. */
      var brChia = { t0: 0, t1: 0, t2: 0 };
      function brMotBuoc() {
        var N = Math.round(G.soTaiXe);
        var nA, nB;
        if (G.coCau) {
          /* Ba tuyen. Voi chi phi nay, tuyen qua cau luon hap dan hon ca hai
             tuyen kia, nen can bang la MOI NGUOI di qua cau. */
          brChia.t2 = Math.min(N, brChia.t2 + Math.ceil((N - brChia.t2) * 0.25));
          var conLai = N - brChia.t2;
          brChia.t0 = Math.round(conLai / 2);
          brChia.t1 = conLai - brChia.t0;
        } else {
          brChia.t2 = 0;
          /* Hai tuyen doi xung -> can bang la chia doi. Cho hoi tu dan. */
          var muc = Math.round(N / 2);
          brChia.t0 += Math.round((muc - brChia.t0) * 0.3);
          brChia.t1 = N - brChia.t0;
        }
        nA = brChia.t0 + brChia.t2;     /* ai di qua doan Xuat->A */
        nB = brChia.t1 + brChia.t2;     /* ai di qua doan B->Dich */

        var tg0 = thoiGianTuyen(0, nA, nB);
        var tg1 = thoiGianTuyen(1, nA, nB);
        var tg2 = thoiGianTuyen(2, nA, nB);
        var tb = (brChia.t0 * tg0 + brChia.t1 * tg1 + brChia.t2 * tg2) / N;
        lichSuTg.push([lichSuTg.length, tb]);
        return lichSuTg.length < 60;
      }

      function brVe() {
        g.clearRect(0, 0, cv.W, cv.H);
        g.fillStyle = V.mau("surf");
        g.fillRect(0, 0, cv.W, cv.H);

        var N = Math.round(G.soTaiXe);
        var nA = brChia.t0 + brChia.t2, nB = brChia.t1 + brChia.t2;
        var chiaY = Math.round(cv.H * 0.60);

        /* --- so do mang --- */
        var xX = cv.W * 0.16, xD = cv.W * 0.84;
        var yA = chiaY * 0.3, yB = chiaY * 0.72, yG = chiaY * 0.51;

        function nut(x, y, ten) {
          g.fillStyle = V.mau("acbg");
          g.strokeStyle = V.mau("ac");
          g.lineWidth = 1.6;
          g.beginPath(); g.arc(x, y, 17, 0, 6.2832); g.fill(); g.stroke();
          g.fillStyle = V.mau("ac2");
          g.font = "600 12px system-ui,sans-serif";
          g.textAlign = "center"; g.textBaseline = "middle";
          g.fillText(ten, x, y);
        }
        function canh(x1, y1, x2, y2, luu, nhan, m) {
          g.save();
          g.strokeStyle = m;
          g.lineWidth = Math.max(1.5, Math.min(16, luu / N * 22));
          g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
          g.restore();
          g.fillStyle = V.mau("tx2");
          g.font = "11px ui-monospace,monospace";
          g.textAlign = "center"; g.textBaseline = "bottom";
          g.fillText(nhan, (x1 + x2) / 2, (y1 + y2) / 2 - 7);
        }

        canh(xX, yG, cv.W * 0.42, yA, nA, "n/100 = " + (nA / 100).toFixed(1) + "′", V.mau("ba"));
        canh(cv.W * 0.42, yA, xD, yG, brChia.t0, "45′ cố định", V.mau("tx3"));
        canh(xX, yG, cv.W * 0.42, yB, brChia.t1, "45′ cố định", V.mau("tx3"));
        canh(cv.W * 0.42, yB, xD, yG, nB, "n/100 = " + (nB / 100).toFixed(1) + "′", V.mau("ba"));
        if (G.coCau) {
          canh(cv.W * 0.42, yA, cv.W * 0.42, yB, brChia.t2, "cầu 0′", V.mau("loi"));
        }
        nut(xX, yG, "Xuất");
        nut(cv.W * 0.42, yA, "A");
        nut(cv.W * 0.42, yB, "B");
        nut(xD, yG, "Đích");

        /* --- duong thoi gian --- */
        B.truc();
        B.moc(65, V.mau("ok"), "65′ — khi chưa có cầu");
        B.duong(lichSuTg, V.mau("loi"), 2.2);

        var tb = lichSuTg.length ? lichSuTg[lichSuTg.length - 1][1] : 0;
        S.dat({
          "Số tài xế": N.toLocaleString("vi"),
          "Cây cầu A→B": G.coCau ? "đã mở (miễn phí, 0 phút)" : "chưa mở",
          "Đi Xuất→A→Đích": brChia.t0.toLocaleString("vi"),
          "Đi Xuất→B→Đích": brChia.t1.toLocaleString("vi"),
          "Đi qua cầu": brChia.t2.toLocaleString("vi"),
          "Thời gian đi trung bình": tb.toFixed(1) + " phút",
          "So với khi chưa có cầu": G.coCau
            ? ("chậm hơn " + (tb - 65).toFixed(1) + " phút")
            : "đây là mốc 65 phút"
        });
      }

      /* ============================================================
         Dieu phoi
         ============================================================ */
      function apDung() {
        if (!cv.W) return;
        ghiChu.innerHTML = "";
        if (G.che === "vong-tron") {
          vtChuanBi();
          P.datToiDa(20000);
          P.datTocDo(40);
          [[V.mau("ac"), "chạy đủ tốc độ"], [V.mau("ba"), "đang giảm tốc"],
           [V.mau("loi"), "gần như đứng"], [V.mau("ok"), "tốc độ mong muốn"]].forEach(function (c) {
            ghiChu.appendChild(V.el("span", {}, [
              V.el("i", { class: "o-mau", style: "background:" + c[0] }), c[1]
            ]));
          });
        } else {
          brChia = { t0: Math.round(G.soTaiXe / 2), t1: Math.round(G.soTaiXe / 2), t2: 0 };
          brChuanBi();
          P.datToiDa(60);
          P.datTocDo(6);
          [[V.mau("ba"), "đoạn tắc được (n/100 phút)"],
           [V.mau("tx3"), "đoạn cố định (45 phút)"],
           [V.mau("loi"), "cây cầu miễn phí"]].forEach(function (c) {
            ghiChu.appendChild(V.el("span", {}, [
              V.el("i", { class: "o-mau", style: "background:" + c[0] }), c[1]
            ]));
          });
        }
        P.datLai();
      }

      P = V.phat({
        ten: "ket-xe",
        bang: cv,
        tocDo: 40,
        buoc: function () {
          return G.che === "vong-tron" ? vtMotBuoc() : brMotBuoc();
        },
        datLai: function () {
          if (G.che === "vong-tron") vtChuanBi();
          else {
            brChia = { t0: Math.round(G.soTaiXe / 2), t1: Math.round(G.soTaiXe / 2), t2: 0 };
            lichSuTg = [];
          }
        },
        ve: function () { if (G.che === "vong-tron") vtVe(); else brVe(); },
        nhan: function () {
          if (G.che === "vong-tron") {
            var tb = 0;
            for (var i = 0; i < tocDo.length; i++) tb += tocDo[i];
            return "tốc độ trung bình " + (tb / tocDo.length).toFixed(2);
          }
          var t = lichSuTg.length ? lichSuTg[lichSuTg.length - 1][1] : 0;
          return "thời gian đi " + t.toFixed(1) + " phút";
        }
      });

      var r = V.khung(host, {
        ten: "ket-xe",
        bang: cv,
        ve: [cv, ghiChu],
        dieuKhien: [P.dk(), TS.dk(), S.el],
        giaiThich:
          "<b>① Kẹt xe ma.</b> Đường vòng tròn, không giao lộ, không đèn, không tai nạn. " +
          "Mỗi tài xế chỉ làm hai việc: chạy nhanh lên nếu phía trước trống, phanh nếu xe " +
          "trước gần." +
          "<ul>" +
          "<li>Đặt <b>nhiễu động</b> về <b>0</b>: dòng xe chạy đều tăm tắp mãi mãi. Nhích lên " +
          "<b>0,02</b>: một tài xế phanh vu vơ, người sau phanh mạnh hơn một chút, người sau " +
          "nữa mạnh hơn nữa — và một <b>điểm dừng</b> hình thành. Nó <b>chạy ngược chiều</b> " +
          "với dòng xe, giữ nguyên hình dạng, không bao giờ tan.</li>" +
          "<li>Giảm <b>số xe</b> xuống 18: cùng mức nhiễu, sóng không hình thành. Có một " +
          "<b>mật độ tới hạn</b> — dưới nó dòng tự chữa lành, trên nó mọi nhiễu động đều " +
          "khuếch đại. Lại là một chuyển pha.</li>" +
          "<li>Tăng <b>mức nhạy phanh</b>: kẹt <b>nặng hơn</b>. Phản ứng thái quá là nguyên " +
          "nhân chứ không phải giải pháp — đó là lý do xe tự lái giữ khoảng cách đều có thể " +
          "xoá hẳn loại kẹt này.</li>" +
          "</ul>" +
          "<b>② Nghịch lý Braess.</b> Có hai đường từ Xuất tới Đích, mỗi đường gồm một đoạn " +
          "<b>tắc được</b> (mất <code>n/100</code> phút với n là số xe trên đó) và một đoạn " +
          "<b>cố định 45 phút</b>. 4000 tài xế chia đôi: mỗi người mất <code>20 + 45 = 65</code> phút." +
          "<ul>" +
          "<li>Giờ mở một <b>cây cầu A→B miễn phí, đi mất 0 phút</b>. Không ai bị ép dùng nó. " +
          "Nhưng với mỗi cá nhân, đi <code>Xuất→A→B→Đích</code> luôn nhanh hơn — nên " +
          "<b>tất cả</b> đều chuyển sang. Kết quả: cả 4000 người dồn lên cả hai đoạn tắc được, " +
          "mất <code>40 + 0 + 40 = 80</code> phút.</li>" +
          "<li><b>Thêm đường, ai cũng chậm hơn 15 phút.</b> Không ai chọn sai — mỗi người đều " +
          "chọn đúng tuyến nhanh nhất <i>cho mình</i>. Cân bằng Nash tệ hơn phương án tập thể.</li>" +
          "<li>Đây không phải bài toán trên giấy: Seoul (2005) và New York (1990) đều từng " +
          "<b>đóng</b> một trục giao thông và giao thông <b>tốt lên</b>.</li>" +
          "</ul>"
      });
      r.trai.classList.add("co");

      requestAnimationFrame(function () { cv.doKichThuoc(); apDung(); });
    }
  });
})();
