/* =====================================================================
   lab-schelling.js — Mo hinh phan ly cua Thomas Schelling (1971).

   Moi o la mot ho gia dinh thuoc mot trong hai nhom. Ho chi doi hoi mot
   dieu rat nhe: trong so hang xom, phai co it nhat X% cung nhom. Khong ai
   doi hoi da so. Khong ai ky thi ai. Vay ma ban do van tu phan ly.
   ===================================================================== */
(function () {
  "use strict";
  var V = window.VIS;

  var TRONG = 0, NHOM_A = 1, NHOM_B = 2;

  demo({
    id: "schelling",
    nhom: "Xã hội & trò chơi",
    mon: "L07",
    ten: "Schelling — thiên kiến rất nhẹ, phân ly hoàn toàn",
    moTa: "Mỗi hộ chỉ muốn <b>một phần ba</b> hàng xóm cùng nhóm với mình — tức là " +
          "vui vẻ sống giữa đa số khác nhóm. Nghe rất dễ tính. Bấm Chạy và xem " +
          "bản đồ tự tách đôi. <b>Không ai trong mô hình này muốn phân ly cả.</b>",

    dung: function (host) {
      var N = 60;
      var o = null;                  /* Uint8Array trang thai tung o */
      var trong = [];                /* chi so cac o dang trong */
      var Rnd = null;
      var L = null, B = null, P = null;
      var soHaiLong = 0, soChuyen = 0, lichSu = [], ghiTiep = 1;

      var TS = V.thamSo([
        { ma: "nguong", ten: "Cần bao nhiêu hàng xóm cùng nhóm", kieu: "so",
          min: 0, max: 8, buoc: 1, gt: 3, donVi: "/8",
          moTa: "<b>3/8</b> nghĩa là: tôi chỉ cần một phần ba hàng xóm giống mình — " +
                "hoàn toàn chấp nhận làm thiểu số. Thử <b>2/8</b> rồi <b>5/8</b> " +
                "để thấy ngưỡng nào là chỗ mô hình gãy." },
        { ma: "kichThuoc", ten: "Cạnh lưới", kieu: "so", min: 20, max: 140, buoc: 10, gt: 60 },
        { ma: "tyLeTrong", ten: "Tỉ lệ ô để trống", kieu: "so",
          min: 0.02, max: 0.35, buoc: 0.01, gt: 0.1,
          moTa: "Không còn ô trống thì không ai chuyển đi đâu được." },
        { ma: "tyLeA", ten: "Tỉ lệ nhóm xanh", kieu: "so", min: 0.2, max: 0.8, buoc: 0.05, gt: 0.5 },
        { ma: "hat", ten: "Hạt giống", kieu: "hat", gt: 11 }
      ], {
        doi: function () { apDung(); },
        preset: [
          { ten: "Rất dễ tính (3/8)",     gt: { nguong: 3, kichThuoc: 60, tyLeTrong: 0.1 } },
          { ten: "Cực dễ tính (2/8)",     gt: { nguong: 2, kichThuoc: 60, tyLeTrong: 0.1 } },
          { ten: "Dửng dưng (0/8)",       gt: { nguong: 0, kichThuoc: 60, tyLeTrong: 0.1 } },
          { ten: "Đòi đa số (5/8)",       gt: { nguong: 5, kichThuoc: 60, tyLeTrong: 0.1 } },
          { ten: "Thiểu số 25%",          gt: { nguong: 3, tyLeA: 0.25, kichThuoc: 60 } },
          { ten: "Gần kín chỗ (3% trống)", gt: { nguong: 3, tyLeTrong: 0.03, kichThuoc: 60 } }
        ]
      });

      var G = TS.gt;

      var cv = V.veBangCo({ rong: 860, tiLe: 0.86, veLai: function () { if (P) apDung(); } });
      var g = cv.g;
      var S = V.soLieu();
      var ghiChu = V.el("div", { class: "chu-thich" });

      /* ============================================================
         Mo phong
         ============================================================ */
      function chiSo(c, r) { return r * N + c; }

      /** Dem hang xom cung nhom / tong hang xom co nguoi (8 huong). */
      function demHangXom(c, r) {
        var minh = o[chiSo(c, r)], cung = 0, tong = 0;
        for (var dr = -1; dr <= 1; dr++) {
          for (var dc = -1; dc <= 1; dc++) {
            if (!dc && !dr) continue;
            var nc = c + dc, nr = r + dr;
            if (nc < 0 || nr < 0 || nc >= N || nr >= N) continue;
            var v = o[chiSo(nc, nr)];
            if (v === TRONG) continue;
            tong++;
            if (v === minh) cung++;
          }
        }
        return { cung: cung, tong: tong };
      }

      /** Mot ho hai long khi so hang xom cung nhom dat nguong.
          Ho khong co hang xom nao thi coi nhu hai long — khong co gi de phan nan. */
      function haiLong(c, r) {
        if (o[chiSo(c, r)] === TRONG) return true;
        var d = demHangXom(c, r);
        if (d.tong === 0) return true;
        return d.cung >= Math.round(G.nguong) * d.tong / 8;
      }

      /** Mot luot quet cho CA HAI so do. Hai ham rieng se duyet luoi hai
          lan moi khung hinh — o luoi 140x140 la 300 000 phep thua. */
      function doDac() {
        var hl = 0, coNguoi = 0, tongTyLe = 0, demTyLe = 0;
        var nguong = Math.round(G.nguong);
        for (var r = 0; r < N; r++) {
          for (var c = 0; c < N; c++) {
            if (o[chiSo(c, r)] === TRONG) continue;
            coNguoi++;
            var d = demHangXom(c, r);
            if (d.tong === 0) { hl++; continue; }   /* khong hang xom = khong phan nan */
            if (d.cung >= nguong * d.tong / 8) hl++;
            tongTyLe += d.cung / d.tong;
            demTyLe++;
          }
        }
        return {
          hl: hl, tong: coNguoi,
          phanLy: demTyLe ? tongTyLe / demTyLe : 0
        };
      }

      function chuanBi() {
        N = Math.round(G.kichThuoc);
        Rnd = V.rng(Math.round(G.hat) || 1);
        o = new Uint8Array(N * N);
        trong = [];
        for (var i = 0; i < N * N; i++) {
          if (Rnd() < G.tyLeTrong) { o[i] = TRONG; trong.push(i); }
          else o[i] = Rnd() < G.tyLeA ? NHOM_A : NHOM_B;
        }
        soChuyen = 0;
        lichSu = []; ghiTiep = 1;

        var chiaY = Math.round(cv.H * 0.76);
        L = V.luoiO(cv, { cot: N, hang: N, le: 10, leTren: 26,
                          leDuoi: cv.H - chiaY + 10 });
        L.bangMau([V.mau("bg2"), V.mau("ac"), V.mau("ba")]);
        B = V.bieuDo(cv, {
          le: { t: chiaY + 34, r: 18, b: 30, l: 58 },
          x: { min: 0, max: 1, nhan: "số lần chuyển nhà (chuẩn hoá)", vach: 4,
               dinhDang: function (v) { return (v * 100).toFixed(0) + "%"; } },
          y: { min: 0.4, max: 1, nhan: "chỉ số phân ly",
               dinhDang: function (v) { return v.toFixed(2); } },
          luoi: 2
        });
        var d = doDac();
        soHaiLong = d.hl;
        ghiLichSu(0, d.phanLy);
      }

      function ghiLichSu(k, pl) {
        lichSu.push([k, pl === undefined ? doDac().phanLy : pl]);
      }

      /** Mot buoc: chon NGAU NHIEN mot ho chua hai long va cho chuyen di.
          Chon ngau nhien (khong quet tuan tu) de ket qua khong phu thuoc
          thu tu duyet — thu tu duyet co the tu no tao ra hoa van gia. */
      function motBuoc(k) {
        if (!trong.length) return false;
        /* Boc thu toi da 400 lan; het thi coi nhu moi nguoi da hai long. */
        for (var lan = 0; lan < 400; lan++) {
          var c = Math.floor(Rnd() * N), r = Math.floor(Rnd() * N);
          var i = chiSo(c, r);
          if (o[i] === TRONG) continue;
          if (haiLong(c, r)) continue;

          var j = Math.floor(Rnd() * trong.length);
          var dich = trong[j];
          o[dich] = o[i];
          o[i] = TRONG;
          trong[j] = i;
          soChuyen++;
          if (k >= ghiTiep) { ghiLichSu(k); ghiTiep = Math.ceil(ghiTiep * 1.08) + 1; }
          return true;
        }
        return false;              /* khong tim ra ai muon chuyen -> dung */
      }

      /* ============================================================
         Ve
         ============================================================ */
      function ve(k) {
        g.clearRect(0, 0, cv.W, cv.H);
        g.fillStyle = V.mau("surf");
        g.fillRect(0, 0, cv.W, cv.H);

        L.tuMang(o);
        L.dan();
        L.vien();

        g.fillStyle = V.mau("tx3");
        g.font = "11px ui-monospace,monospace";
        g.textAlign = "left"; g.textBaseline = "top";
        g.fillText("lưới " + N + "×" + N + " — mỗi ô là một hộ gia đình", 10, 7);

        /* duong phan ly theo thoi gian */
        var tran = Math.max(1, k);
        B.dat({ x: { min: 0, max: tran, nhan: "số lần chuyển nhà", vach: 4,
                     dinhDang: V.soGon },
                y: { min: 0.4, max: 1, nhan: "chỉ số phân ly",
                     dinhDang: function (v) { return v.toFixed(2); } } });
        B.truc();
        B.moc(0.5, V.mau("ok"), "0,50 = trộn đều hoàn toàn");
        B.duong(lichSu, V.mau("loi"), 2);

        var d = doDac();
        soHaiLong = d.hl;
        var pl = d.phanLy;
        S.dat({
          "Ngưỡng đòi hỏi": Math.round(G.nguong) + "/8 hàng xóm cùng nhóm",
          "Lần chuyển nhà": soChuyen.toLocaleString("vi"),
          "Hộ hài lòng": d.tong ? (d.hl / d.tong * 100).toFixed(1) + "%" : "—",
          "Chỉ số phân ly": pl.toFixed(3),
          "Nếu trộn đều thì là": "0,500",
          "Kết luận": pl > 0.8 ? "đã phân ly gần như hoàn toàn"
                    : pl > 0.65 ? "đang tách khối" : "còn trộn"
        });
      }

      /* ============================================================
         Dieu phoi
         ============================================================ */
      function apDung() {
        if (!cv.W) return;
        chuanBi();
        P.datToiDa(60000);
        P.datTocDo(400);
        ghiChu.innerHTML = "";
        [[V.mau("ac"), "nhóm xanh"], [V.mau("ba"), "nhóm vàng"],
         [V.mau("bg2"), "ô trống"], [V.mau("loi"), "chỉ số phân ly"]].forEach(function (c) {
          ghiChu.appendChild(V.el("span", {}, [
            V.el("i", { class: "o-mau", style: "background:" + c[0] }), c[1]
          ]));
        });
        P.datLai();
      }

      P = V.phat({
        ten: "schelling",
        bang: cv,
        tocDo: 400,
        buoc: function (k) { return motBuoc(k); },
        datLai: function () { chuanBi(); },
        ve: ve,
        nhan: function (k, xong) {
          if (xong) return "không còn ai muốn chuyển — đã ổn định";
          return soChuyen.toLocaleString("vi") + " lần chuyển nhà";
        }
      });

      var r = V.khung(host, {
        ten: "schelling",
        bang: cv,
        ve: [cv, ghiChu],
        dieuKhien: [P.dk(), TS.dk(), S.el],
        giaiThich:
          "<b>Luật chơi:</b> mỗi hộ nhìn 8 ô quanh mình. Nếu tỉ lệ hàng xóm cùng nhóm " +
          "thấp hơn ngưỡng, hộ đó chuyển tới một ô trống bất kỳ. Hết. Không có ai ghét ai, " +
          "không có chính sách, không có giá nhà." +
          "<ul>" +
          "<li><b>Điều bất ngờ:</b> để ngưỡng ở <b>3/8</b> — nghĩa là mỗi hộ sẵn sàng làm " +
          "<b>thiểu số</b>, chỉ cần một phần ba hàng xóm giống mình. Chạy đi: bản đồ vẫn " +
          "tách thành hai khối lớn, chỉ số phân ly leo từ 0,50 lên trên 0,80. " +
          "<b>Sở thích cá nhân rất nhẹ cộng lại thành một kết quả tập thể mà không ai muốn.</b></li>" +
          "<li>Hạ xuống <b>2/8</b>: vẫn phân ly, chỉ chậm hơn. Xuống <b>0/8</b> (ai cũng dửng dưng): " +
          "không ai chuyển đi đâu, bản đồ giữ nguyên trạng thái trộn ngẫu nhiên. Ngưỡng gãy " +
          "nằm đâu đó rất thấp — đó mới là điều đáng sợ.</li>" +
          "<li>Lên <b>5/8</b> (đòi đa số): phân ly nhanh và triệt để, nhưng cũng dễ <b>kẹt</b> — " +
          "nhiều hộ không bao giờ hài lòng vì không còn ô nào thoả mãn.</li>" +
          "<li>Giảm <b>tỉ lệ ô trống</b> xuống 3%: mô hình gần như đứng hình. Không có chỗ trống " +
          "thì không có dịch chuyển — thanh khoản của thị trường nhà ở chính là thứ cho phép " +
          "phân ly diễn ra.</li>" +
          "</ul>" +
          "<b>Vì sao quan trọng:</b> Schelling chỉ ra rằng nhìn thấy một thành phố bị phân ly " +
          "<b>không</b> cho phép kết luận rằng dân ở đó phân biệt đối xử. Cơ chế vi mô và kết quả " +
          "vĩ mô có thể khác hẳn nhau. Ông nhận Nobel Kinh tế 2005."
      });
      r.trai.classList.add("co");

      requestAnimationFrame(function () { cv.doKichThuoc(); apDung(); });
    }
  });
})();
