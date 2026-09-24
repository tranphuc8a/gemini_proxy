/* =====================================================================
   lab-mangluoi.js — The gioi nho (Watts–Strogatz) va mang vo huong ti le
   (Barabasi–Albert).

   Hai cau hoi:
   (1) Vi sao sau nguoi la du de noi hai nguoi bat ky tren Trai Dat, trong
       khi ai cung chi quen nhung nguoi quanh minh?
   (2) Vi sao mang that luon co vai nut khong lo, con da so thi nho xiu?
   ===================================================================== */
(function () {
  "use strict";
  var V = window.VIS;

  demo({
    id: "mang-luoi",
    nhom: "Mạng lưới & phân tán",
    mon: "L19",
    ten: "Thế giới nhỏ — và vì sao mạng thật luôn có siêu nút",
    moTa: "Bắt đầu từ một vòng tròn ai cũng chỉ quen hàng xóm. Đổi ngẫu nhiên " +
          "<b>một phần trăm</b> số mối quan hệ thành quan hệ xa. Đường đi trung bình " +
          "giữa hai người bất kỳ <b>sụp đổ</b> — trong khi mức “bạn của bạn cũng là bạn” " +
          "gần như không đổi. Đó là thế giới nhỏ.",

    dung: function (host) {
      var DT = null, B = null, P = null;
      var ke = null;
      var duongTB = 0, heSoCum = 0, bacLonNhat = 0;
      var duongTB0 = 0, heSoCum0 = 0;      /* moc khi p = 0, de so sanh */
      var phanBoBac = null;
      var lichSu = [];

      var TS = V.thamSo([
        { ma: "kieu", ten: "Kiểu mạng", kieu: "chon", gt: "the-gioi-nho", muc: [
          { v: "the-gioi-nho", t: "① Thế giới nhỏ (Watts–Strogatz)" },
          { v: "ti-le",        t: "② Vô hướng tỉ lệ (Barabási–Albert)" }
        ] },
        { ma: "soNut", ten: "Số nút", kieu: "so", min: 20, max: 300, buoc: 10, gt: 120 },

        { ten: "① Thế giới nhỏ", kieu: "nhom",
          hien: function (g) { return g.kieu === "the-gioi-nho"; } },
        { ma: "bacK", ten: "Mỗi nút quen bao nhiêu hàng xóm", kieu: "so",
          min: 2, max: 16, buoc: 2, gt: 6,
          hien: function (g) { return g.kieu === "the-gioi-nho"; } },
        { ma: "pDoi", ten: "Tỉ lệ quan hệ bị đổi thành quan hệ xa", kieu: "so",
          min: 0, max: 1, buoc: 0.005, gt: 0.02,
          moTa: "Kéo rất chậm từ <b>0</b>. Chỉ cần <b>1–2%</b> là đường đi trung bình " +
                "đã sụp gần hết, trong khi hệ số cụm còn nguyên. Khoảng đó chính là " +
                "<b>vùng thế giới nhỏ</b>.",
          hien: function (g) { return g.kieu === "the-gioi-nho"; } },

        { ten: "② Vô hướng tỉ lệ", kieu: "nhom",
          hien: function (g) { return g.kieu === "ti-le"; } },
        { ma: "mNoi", ten: "Nút mới nối vào mấy nút cũ", kieu: "so",
          min: 1, max: 6, buoc: 1, gt: 2,
          hien: function (g) { return g.kieu === "ti-le"; } },
        { ma: "uuTien", ten: "Nối theo mức nổi tiếng (thay vì ngẫu nhiên)", kieu: "bat", gt: true,
          moTa: "Tắt đi: nút mới nối ngẫu nhiên, và phân bố bậc thành hình chuông — " +
                "<b>không có siêu nút</b>. Bật lại để thấy “giàu càng giàu” tạo ra hub.",
          hien: function (g) { return g.kieu === "ti-le"; } },

        { ma: "hat", ten: "Hạt giống", kieu: "hat", gt: 8 },
        { ma: "boCuc", ten: "Bố cục", kieu: "chon", gt: "tron", muc: [
          { v: "tron", t: "Vòng tròn — thấy rõ quan hệ xa" },
          { v: "loxo", t: "Lò xo — thấy rõ cụm và hub" }
        ] }
      ], {
        doi: function () { apDung(); },
        preset: [
          { ten: "Vòng thuần (p = 0)",    gt: { kieu: "the-gioi-nho", pDoi: 0 } },
          { ten: "Thế giới nhỏ (p = 2%)", gt: { kieu: "the-gioi-nho", pDoi: 0.02 } },
          { ten: "Ngẫu nhiên (p = 100%)", gt: { kieu: "the-gioi-nho", pDoi: 1 } },
          { ten: "Có siêu nút",           gt: { kieu: "ti-le", uuTien: true, boCuc: "loxo" } },
          { ten: "Không siêu nút",        gt: { kieu: "ti-le", uuTien: false, boCuc: "loxo" } }
        ]
      });

      var G = TS.gt;

      var cv = V.veBangCo({ rong: 880, tiLe: 0.9, veLai: function () { if (P) apDung(); } });
      var g = cv.g;
      var S = V.soLieu();
      var ghiChu = V.el("div", { class: "chu-thich" });

      /* ============================================================
         Dung mang
         ============================================================ */
      function dungVongThuan(n, k, DTx) {
        for (var i = 0; i < n; i++) DTx.themNut();
        for (i = 0; i < n; i++) {
          for (var j = 1; j <= k / 2; j++) DTx.themCanh(i, (i + j) % n);
        }
      }

      function dungTheGioiNho(n, k, p, hat) {
        var D = V.doThi(cv, { soToiDa: n, le: 14, leTren: 26,
                              leDuoi: Math.round(cv.H * 0.34) });
        dungVongThuan(n, k, D);
        var R = V.rng(hat);
        /* Doi tung canh voi xac suat p: giu mot dau, nem dau kia di dau do. */
        for (var c = D.canh.length - 1; c >= 0; c--) {
          if (R() >= p) continue;
          var a = D.canh[c][0];
          for (var thu = 0; thu < 40; thu++) {
            var b = Math.floor(R() * n);
            if (b === a || D.coCanh(a, b) >= 0) continue;
            D.xoaCanh(c);
            D.themCanh(a, b);
            break;
          }
        }
        return D;
      }

      function dungTiLe(n, m, uuTien, hat) {
        var D = V.doThi(cv, { soToiDa: n, le: 14, leTren: 26,
                              leDuoi: Math.round(cv.H * 0.34) });
        var R = V.rng(hat);
        var m0 = Math.max(2, m + 1);
        var i, j;
        for (i = 0; i < m0; i++) D.themNut();
        for (i = 0; i < m0; i++) for (j = i + 1; j < m0; j++) D.themCanh(i, j);

        /* Danh sach "ve so": moi nut xuat hien dung BAC lan, nen boc ngau
           nhien mot ve tuc la chon nut ti le voi bac. Do la "uu tien noi ket". */
        var ve = [];
        for (var c = 0; c < D.canh.length; c++) { ve.push(D.canh[c][0]); ve.push(D.canh[c][1]); }

        for (i = m0; i < n; i++) {
          var moi = D.themNut();
          var daNoi = {};
          for (var t = 0; t < m; t++) {
            for (var thu = 0; thu < 60; thu++) {
              var dich = uuTien
                ? ve[Math.floor(R() * ve.length)]
                : Math.floor(R() * moi);
              if (dich === moi || daNoi[dich]) continue;
              if (D.themCanh(moi, dich)) {
                daNoi[dich] = 1;
                ve.push(moi); ve.push(dich);
                break;
              }
            }
          }
        }
        return D;
      }

      /* ============================================================
         Do dac mang
         ============================================================ */

      /** Duong di trung binh: BFS tu moi nut. O(n·(n+m)) — chi chay mot lan
          khi dung mang, khong chay trong vong ve. */
      function doDuongTB(n, ds) {
        var tong = 0, cap = 0;
        var xa = new Int32Array(n), hang = new Int32Array(n);
        for (var s = 0; s < n; s++) {
          for (var i = 0; i < n; i++) xa[i] = -1;
          var dau = 0, cuoi = 0;
          hang[cuoi++] = s; xa[s] = 0;
          while (dau < cuoi) {
            var u = hang[dau++];
            for (var e = 0; e < ds[u].length; e++) {
              var v = ds[u][e];
              if (xa[v] >= 0) continue;
              xa[v] = xa[u] + 1;
              hang[cuoi++] = v;
            }
          }
          for (i = 0; i < n; i++) {
            if (i === s || xa[i] < 0) continue;      /* bo qua cap khong noi duoc */
            tong += xa[i]; cap++;
          }
        }
        return cap ? tong / cap : 0;
      }

      /** He so cum: trong so cac cap hang xom cua mot nut, bao nhieu cap
          cung la hang xom cua nhau. "Ban cua ban co phai ban khong." */
      function doHeSoCum(n, ds) {
        /* Dung tap ke MOT lan. Neu hoi bang indexOf trong vong lap long thi
           moi nut ton O(k^3) — voi k = 16 la gap 16 lan cong can thiet. */
        var tapKe = [];
        for (var i = 0; i < n; i++) tapKe.push(new Set(ds[i]));

        var tong = 0, dem = 0;
        for (i = 0; i < n; i++) {
          var k = ds[i].length;
          if (k < 2) continue;
          var noi = 0;
          for (var a = 0; a < k; a++) {
            for (var b = a + 1; b < k; b++) {
              if (tapKe[ds[i][a]].has(ds[i][b])) noi++;
            }
          }
          tong += 2 * noi / (k * (k - 1));
          dem++;
        }
        return dem ? tong / dem : 0;
      }

      function chuanBi() {
        var n = Math.round(G.soNut);
        var hat = Math.round(G.hat) || 1;

        if (G.kieu === "the-gioi-nho") {
          DT = dungTheGioiNho(n, Math.round(G.bacK), G.pDoi, hat);
          /* Moc so sanh: cung mang nhung p = 0. */
          var D0 = dungTheGioiNho(n, Math.round(G.bacK), 0, hat);
          var ds0 = D0.danhSachKe();
          duongTB0 = doDuongTB(n, ds0);
          heSoCum0 = doHeSoCum(n, ds0);
        } else {
          DT = dungTiLe(n, Math.round(G.mNoi), G.uuTien, hat);
          duongTB0 = 0; heSoCum0 = 0;
        }

        if (G.boCuc === "loxo") DT.boCucLoXo(260, hat);
        else DT.boCucTron();

        ke = DT.danhSachKe();
        duongTB = doDuongTB(DT.n, ke);
        heSoCum = doHeSoCum(DT.n, ke);

        bacLonNhat = 0;
        for (var i = 0; i < DT.n; i++) if (DT.bac[i] > bacLonNhat) bacLonNhat = DT.bac[i];
        phanBoBac = new Float64Array(bacLonNhat + 2);
        for (i = 0; i < DT.n; i++) phanBoBac[DT.bac[i]]++;

        B = V.bieuDo(cv, {
          le: { t: Math.round(cv.H * 0.68) + 28, r: 18, b: 32, l: 60 },
          x: { min: 0, max: bacLonNhat + 1, nhan: "bậc (số quan hệ của một nút)", vach: 5,
               dinhDang: function (v) { return String(Math.round(v)); } },
          y: { min: 0, max: 1, nhan: "số nút", dinhDang: V.soGon },
          luoi: 2
        });
      }

      /* ============================================================
         Ve
         ============================================================ */
      function ve(k) {
        g.clearRect(0, 0, cv.W, cv.H);
        g.fillStyle = V.mau("surf");
        g.fillRect(0, 0, cv.W, cv.H);

        var n = DT.n;
        var hienCanh = Math.min(k, DT.canh.length);

        /* Canh "gan" (hang xom tren vong) mot mau, canh "xa" mau khac. */
        var mauGan = V.mau("bd"), mauXa = V.mau("loi");
        DT.veCanh(function (c, a, b) {
          if (c >= hienCanh) return null;
          if (G.kieu !== "the-gioi-nho" || G.boCuc !== "tron") return mauGan;
          var cach = Math.abs(a - b);
          cach = Math.min(cach, n - cach);
          return cach <= Math.round(G.bacK) / 2 ? mauGan : mauXa;
        }, 1, 0.75);

        var banKinh = Math.max(2.5, Math.min(9, 140 / Math.sqrt(n)));
        DT.veNut(function (i) {
          /* To dam nut co bac cao — hub hien ra ngay. */
          var t = bacLonNhat > 1 ? DT.bac[i] / bacLonNhat : 0;
          return V.thangMau(0.15 + t * 0.85);
        }, function (i) {
          return banKinh * (1 + (bacLonNhat > 1 ? DT.bac[i] / bacLonNhat : 0) * 1.6);
        });

        g.fillStyle = V.mau("tx3");
        g.font = "11px ui-monospace,monospace";
        g.textAlign = "left"; g.textBaseline = "top";
        g.fillText(n + " nút · " + DT.canh.length + " cạnh · đã vẽ " + hienCanh, 12, 7);

        /* --- phan bo bac --- */
        var caoNhat = 1;
        for (var i = 0; i < phanBoBac.length; i++) if (phanBoBac[i] > caoNhat) caoNhat = phanBoBac[i];
        B.dat({ x: { min: 0, max: bacLonNhat + 1, nhan: "bậc (số quan hệ của một nút)",
                     vach: 5, dinhDang: function (v) { return String(Math.round(v)); } },
                y: { min: 0, max: caoNhat * 1.15, nhan: "số nút", dinhDang: V.soGon } });
        B.truc();
        B.cotDay(phanBoBac, 0, phanBoBac.length, V.mau("ac"));

        var bang = {
          "Số nút / cạnh": n + " / " + DT.canh.length,
          "Đường đi trung bình": duongTB.toFixed(2) + " bước",
          "Hệ số cụm": heSoCum.toFixed(3),
          "Bậc lớn nhất": bacLonNhat,
          "Bậc trung bình": (2 * DT.canh.length / n).toFixed(2)
        };
        if (G.kieu === "the-gioi-nho") {
          bang["So với vòng thuần (p=0)"] =
            "đường " + (duongTB0 ? (duongTB / duongTB0 * 100).toFixed(0) : "—") + "%" +
            " · cụm " + (heSoCum0 ? (heSoCum / heSoCum0 * 100).toFixed(0) : "—") + "%";
          bang["⚑ Kết luận"] =
            (duongTB0 && duongTB < duongTB0 * 0.5 && heSoCum0 && heSoCum > heSoCum0 * 0.6)
              ? "ĐANG Ở VÙNG THẾ GIỚI NHỎ"
              : (G.pDoi === 0 ? "vòng thuần — xa và rất cụm"
                              : (G.pDoi > 0.5 ? "gần như ngẫu nhiên — gần nhưng hết cụm"
                                              : "đang chuyển tiếp"));
        } else {
          bang["Nút to nhất nắm"] =
            (bacLonNhat / (2 * DT.canh.length) * 100).toFixed(1) + "% tổng số đầu cạnh";
          bang["⚑ Kết luận"] = G.uuTien
            ? "có siêu nút — phân bố đuôi dài"
            : "không siêu nút — phân bố hình chuông";
        }
        S.dat(bang);
      }

      /* ============================================================
         Dieu phoi
         ============================================================ */
      function apDung() {
        if (!cv.W) return;
        chuanBi();
        P.datToiDa(DT.canh.length);
        P.datTocDo(120);
        ghiChu.innerHTML = "";
        var cap = [[V.mau("bd"), "quan hệ gần (hàng xóm)"]];
        if (G.kieu === "the-gioi-nho" && G.boCuc === "tron") {
          cap.push([V.mau("loi"), "quan hệ xa (đã đổi)"]);
        }
        cap.push([V.thangMau(0.2), "nút bậc thấp"]);
        cap.push([V.thangMau(1), "nút bậc cao (hub)"]);
        cap.forEach(function (c) {
          ghiChu.appendChild(V.el("span", {}, [
            V.el("i", { class: "o-mau", style: "background:" + c[0] }), c[1]
          ]));
        });
        P.datLai();
      }

      P = V.phat({
        ten: "mang-luoi",
        bang: cv,
        tocDo: 120,
        buoc: function () { return true; },
        ve: ve,
        nhan: function (k) {
          return "đã vẽ " + Math.min(k, DT.canh.length) + " / " + DT.canh.length + " cạnh";
        }
      });

      var r = V.khung(host, {
        ten: "mang-luoi",
        bang: cv,
        ve: [cv, ghiChu],
        dieuKhien: [P.dk(), TS.dk(), S.el],
        giaiThich:
          "<b>Hai số đo</b> quyết định mọi thứ ở đây:" +
          "<ul>" +
          "<li><b>Đường đi trung bình</b> — trung bình phải qua mấy bước để nối hai nút bất kỳ. " +
          "Đây là “sáu độ phân cách”.</li>" +
          "<li><b>Hệ số cụm</b> — trong số các cặp hàng xóm của một nút, bao nhiêu cặp cũng là " +
          "hàng xóm của nhau. Tức là “bạn của bạn tôi có phải bạn tôi không”.</li>" +
          "</ul>" +
          "<b>① Thế giới nhỏ.</b> Bắt đầu với <b>p = 0</b>: một vòng tròn, ai cũng chỉ quen hàng " +
          "xóm. Hệ số cụm rất cao (đúng như xã hội thật) nhưng đường đi cực dài — muốn tới người " +
          "ở bên kia vòng phải đi qua nửa thế giới. Đặt <b>p = 1</b>: mạng ngẫu nhiên, đường đi " +
          "rất ngắn nhưng cụm về gần 0 — không giống xã hội thật chút nào." +
          "<ul>" +
          "<li><b>Điều bất ngờ nằm ở giữa.</b> Kéo p lên chỉ <b>1–2%</b>: đường đi trung bình đã " +
          "sụp gần hết, mà hệ số cụm vẫn gần như nguyên vẹn. Vài mối quan hệ xa — một người bạn " +
          "ở nước ngoài — là đủ để rút ngắn cả thế giới, mà không phá vỡ cộng đồng địa phương. " +
          "Watts và Strogatz công bố năm 1998; bảng số liệu sẽ báo khi bạn <b>đang ở vùng đó</b>.</li>" +
          "<li>Ở bố cục vòng tròn, cạnh <b>đỏ</b> là những quan hệ đã bị đổi thành quan hệ xa. " +
          "Đếm sẽ thấy chúng ít đến mức nào so với hiệu quả chúng tạo ra.</li>" +
          "</ul>" +
          "<b>② Vô hướng tỉ lệ.</b> Mạng lớn dần: mỗi nút mới chọn nút để nối, và xác suất chọn " +
          "một nút <b>tỉ lệ với số quan hệ nó đã có</b> — giàu càng giàu." +
          "<ul>" +
          "<li>Kết quả là <b>phân bố đuôi dài</b>: đa số nút bậc rất thấp, vài nút bậc khổng lồ. " +
          "Không có “nút cỡ trung bình điển hình”, y như trận lở trong lab đống cát.</li>" +
          "<li><b>Tắt “nối theo mức nổi tiếng”</b>: nút mới nối ngẫu nhiên. Phân bố lập tức thành " +
          "hình chuông và <b>siêu nút biến mất</b>. Vậy hub không phải hệ quả của việc mạng lớn " +
          "lên — mà của <i>cách</i> nó lớn lên.</li>" +
          "<li><b>Hệ quả thực tế:</b> mạng có hub thì rất bền trước hỏng hóc ngẫu nhiên (đa số nút " +
          "vô danh, mất cũng không sao) nhưng <b>cực mỏng manh trước tấn công có chủ đích</b> vào " +
          "vài hub. Xem tiếp ở lab <a href=\"#/lan-truyen\">lan truyền trên mạng</a>.</li>" +
          "</ul>"
      });
      r.trai.classList.add("co");

      requestAnimationFrame(function () { cv.doKichThuoc(); apDung(); });
    }
  });
})();
