/* =====================================================================
   lab-clt.js — Dinh ly gioi han trung tam.

   Lay n mau tu MOT phan phoi bat ky, tinh trung binh, lap lai that nhieu
   lan: to chuc do cua cac trung binh luon ngay ve hinh chuong. Tru mot
   truong hop — va truong hop do moi la phan dang hoc.
   ===================================================================== */
(function () {
  "use strict";
  var V = window.VIS;

  var SO_O = 70;                 /* so o cua to chuc do */

  /* ---------- Cac nguon ngau nhien ---------------------------------- */
  var NGUON = {
    "dong-deu": {
      ten: "Đều trên [0, 1]",
      lay: function (R) { return R(); }
    },
    "hai-dinh": {
      ten: "Hai đỉnh (không hề giống chuông)",
      lay: function (R) {
        var tam = R() < 0.5 ? 0.2 : 0.8;
        return tam + R.chuan() * 0.05;
      }
    },
    "mu": {
      ten: "Mũ — lệch mạnh sang phải",
      lay: function (R) { return -Math.log(Math.max(R(), 1e-12)); }
    },
    "xuc-xac": {
      ten: "Xúc xắc 6 mặt (rời rạc)",
      lay: function (R) { return Math.floor(R() * 6) + 1; }
    },
    "duoi-nang": {
      ten: "⚠ Đuôi nặng Pareto α=1,2 — CLT gãy",
      lay: function (R) { return Math.pow(Math.max(R(), 1e-12), -1 / 1.2); }
    }
  };

  function phanVi(mang, p) {
    var b = mang.slice().sort(function (x, y) { return x - y; });
    return b[Math.min(b.length - 1, Math.max(0, Math.floor(p * b.length)))];
  }

  demo({
    id: "gioi-han-trung-tam",
    nhom: "Xác suất & ngẫu nhiên",
    mon: "L05",
    ten: "Giới hạn trung tâm — vì sao cái gì cũng hoá hình chuông",
    moTa: "Lấy <b>n</b> mẫu từ một phân phối bất kỳ — méo mó thế nào cũng được — rồi " +
          "tính trung bình. Lặp lại thật nhiều lần. Tổ chức đồ của các trung bình " +
          "<b>luôn</b> ngả về hình chuông. Trừ một trường hợp, và đó mới là chỗ đáng xem.",

    dung: function (host) {
      var Rnd = null;
      var oTB = null, tongTB = 0;              /* to chuc do cua cac trung binh */
      var oNguon = null;                       /* to chuc do cua nguon */
      var tbMin = 0, tbMax = 1, ngMin = 0, ngMax = 1;
      var muNguon = 0, sdNguon = 0;
      var caoNhat = 1;
      var Bn = null, Bt = null, P = null;

      var TS = V.thamSo([
        { ma: "nguon", ten: "Phân phối nguồn", kieu: "chon", gt: "hai-dinh", muc:
          Object.keys(NGUON).map(function (k) { return { v: k, t: NGUON[k].ten }; }) },
        { ma: "soMau", ten: "Lấy bao nhiêu mẫu mỗi lần (n)", kieu: "so",
          min: 1, max: 40, buoc: 1, gt: 1,
          moTa: "Kéo từ <b>1</b> lên. Ở n = 1 bạn thấy đúng phân phối gốc. " +
                "Chỉ tới <b>n = 5</b> là gần như đã thành chuông rồi." },
        { ma: "soLan", ten: "Số lần lặp", kieu: "so", min: 2000, max: 200000, buoc: 2000, gt: 40000 },
        { ma: "hat", ten: "Hạt giống", kieu: "hat", gt: 7 },
        { ma: "hienChuan", ten: "Vẽ chồng đường chuông lý thuyết", kieu: "bat", gt: true,
          moTa: "Chuông có trung bình μ và độ lệch <b>σ/√n</b> — hẹp lại theo căn bậc hai của n." }
      ], {
        doi: function () { apDung(); },
        preset: [
          { ten: "n = 1 (thấy phân phối gốc)", gt: { nguon: "hai-dinh", soMau: 1 } },
          { ten: "n = 2",                      gt: { nguon: "hai-dinh", soMau: 2 } },
          { ten: "n = 5 — đã thành chuông",    gt: { nguon: "hai-dinh", soMau: 5 } },
          { ten: "Phân phối mũ, n = 10",       gt: { nguon: "mu", soMau: 10 } },
          { ten: "Xúc xắc, n = 3",             gt: { nguon: "xuc-xac", soMau: 3 } },
          { ten: "⚠ Đuôi nặng — CLT gãy",      gt: { nguon: "duoi-nang", soMau: 30 } }
        ]
      });

      var G = TS.gt;

      var cv = V.veBangCo({ rong: 860, tiLe: 0.8, veLai: function () { if (P) apDung(); } });
      var g = cv.g;
      var S = V.soLieu();
      var ghiChu = V.el("div", { class: "chu-thich" });

      /* ============================================================
         Chuan bi — do truoc khoang gia tri de cac cot khong nhay
         ============================================================ */
      function chuanBi() {
        var ng = NGUON[G.nguon] || NGUON["dong-deu"];
        var n = Math.max(1, Math.round(G.soMau));

        /* Do thu bang mot mau rieng: lay khoang theo PHAN VI chu khong theo
           min/max, vi phan phoi duoi nang co the nem ra mot gia tri khong lo
           lam bep toan bo to chuc do. */
        var Rdo = V.rng(12345);
        var i, j, mauNguon = [], mauTB = [];
        for (i = 0; i < 4000; i++) mauNguon.push(ng.lay(Rdo));
        for (i = 0; i < 3000; i++) {
          var t = 0;
          for (j = 0; j < n; j++) t += ng.lay(Rdo);
          mauTB.push(t / n);
        }
        muNguon = mauNguon.reduce(function (a, b) { return a + b; }, 0) / mauNguon.length;
        var v = mauNguon.reduce(function (a, b) { return a + (b - muNguon) * (b - muNguon); }, 0)
                / mauNguon.length;
        sdNguon = Math.sqrt(v);

        ngMin = phanVi(mauNguon, 0.005); ngMax = phanVi(mauNguon, 0.995);
        tbMin = phanVi(mauTB, 0.005);    tbMax = phanVi(mauTB, 0.995);
        var damNg = (ngMax - ngMin) * 0.06 || 0.5;
        var damTb = (tbMax - tbMin) * 0.06 || 0.5;
        ngMin -= damNg; ngMax += damNg;
        tbMin -= damTb; tbMax += damTb;

        /* To chuc do cua nguon — tinh mot lan, khong doi theo thoi gian. */
        oNguon = new Float64Array(SO_O);
        for (i = 0; i < mauNguon.length; i++) {
          var o = Math.floor((mauNguon[i] - ngMin) / (ngMax - ngMin) * SO_O);
          if (o >= 0 && o < SO_O) oNguon[o]++;
        }

        oTB = new Float64Array(SO_O);
        tongTB = 0; caoNhat = 1;
        Rnd = V.rng(Math.round(G.hat) || 1);

        var chiaY = Math.round(cv.H * 0.34);
        Bn = V.bieuDo(cv, {
          le: { t: 14, r: 18, b: cv.H - chiaY, l: 60 },
          x: { min: ngMin, max: ngMax, nhan: "giá trị một mẫu đơn lẻ", vach: 4 },
          /* So dem cua to chuc do nguon khong co y nghia rieng — chi hinh dang
             moi dang nhin, nen bo nhan truc doc cho do roi mat. */
          y: { min: 0, max: Math.max.apply(null, Array.prototype.slice.call(oNguon)) * 1.15 || 1,
               nhan: "phân phối nguồn", hienSo: false },
          luoi: 2
        });
        Bt = V.bieuDo(cv, {
          le: { t: chiaY + 46, r: 18, b: 34, l: 60 },
          x: { min: tbMin, max: tbMax, nhan: "trung bình của n mẫu", vach: 4 },
          y: { min: 0, max: 1, nhan: "số lần rơi vào ô", dinhDang: V.soGon },
          luoi: 3
        });
      }

      function motLan() {
        var ng = NGUON[G.nguon] || NGUON["dong-deu"];
        var n = Math.max(1, Math.round(G.soMau));
        var t = 0;
        for (var j = 0; j < n; j++) t += ng.lay(Rnd);
        var tb = t / n;
        var o = Math.floor((tb - tbMin) / (tbMax - tbMin) * SO_O);
        if (o >= 0 && o < SO_O) {
          oTB[o]++;
          if (oTB[o] > caoNhat) caoNhat = oTB[o];
        }
        tongTB++;
        return true;
      }

      /* ============================================================
         Ve
         ============================================================ */
      function ve() {
        g.clearRect(0, 0, cv.W, cv.H);
        g.fillStyle = V.mau("surf");
        g.fillRect(0, 0, cv.W, cv.H);

        /* --- tren: phan phoi nguon --- */
        Bn.truc();
        Bn.cotDay(oNguon, ngMin, ngMax, V.mau("ba"));

        /* --- duoi: to chuc do cua cac trung binh --- */
        Bt.dat({ y: { min: 0, max: caoNhat * 1.18, nhan: "số lần rơi vào ô", dinhDang: V.soGon } });
        Bt.truc();
        Bt.cotDay(oTB, tbMin, tbMax, V.mau("ac"));

        /* --- duong chuong ly thuyet: trung binh mu, do lech sd/sqrt(n) --- */
        var n = Math.max(1, Math.round(G.soMau));
        var sdTB = sdNguon / Math.sqrt(n);
        if (G.hienChuan && sdTB > 0 && tongTB > 0) {
          var rongO = (tbMax - tbMin) / SO_O;
          var diem = [], i;
          for (i = 0; i <= 160; i++) {
            var x = tbMin + (tbMax - tbMin) * i / 160;
            var z = (x - muNguon) / sdTB;
            var mat = Math.exp(-0.5 * z * z) / (sdTB * Math.sqrt(2 * Math.PI));
            diem.push([x, mat * rongO * tongTB]);
          }
          Bt.duong(diem, V.mau("loi"), 2);
        }

        var ng = NGUON[G.nguon] || NGUON["dong-deu"];
        var gay = G.nguon === "duoi-nang";
        S.dat({
          "Phân phối nguồn": ng.ten.replace("⚠ ", ""),
          "n mẫu mỗi lần": n,
          "Đã lặp": tongTB.toLocaleString("vi") + " / " + Math.round(G.soLan).toLocaleString("vi"),
          "μ của nguồn (đo được)": muNguon.toFixed(4),
          "σ của nguồn (đo được)": gay ? sdNguon.toFixed(2) + "  ⚠ không hội tụ" : sdNguon.toFixed(4),
          "σ/√n — độ rộng dự đoán": gay ? "vô nghĩa ở đây" : sdTB.toFixed(4),
          "Kết luận": gay
            ? "phương sai vô hạn → chuông KHÔNG hình thành"
            : (n >= 5 ? "đã ra chuông" : "tăng n lên 5 để thấy rõ")
        });
      }

      /* ============================================================
         Dieu phoi
         ============================================================ */
      function apDung() {
        if (!cv.W) return;
        chuanBi();
        P.datToiDa(Math.round(G.soLan));
        P.datTocDo(2000);
        ghiChu.innerHTML = "";
        [[V.mau("ba"), "phân phối nguồn (trên)"],
         [V.mau("ac"), "tổ chức đồ của các trung bình (dưới)"],
         [V.mau("loi"), "chuông lý thuyết μ, σ/√n"]].forEach(function (c) {
          ghiChu.appendChild(V.el("span", {}, [
            V.el("i", { class: "o-mau", style: "background:" + c[0] }), c[1]
          ]));
        });
        P.datLai();
      }

      P = V.phat({
        ten: "gioi-han-trung-tam",
        bang: cv,
        tocDo: 2000,
        buoc: function () { return motLan(); },
        datLai: function () {
          if (oTB) oTB.fill(0);
          tongTB = 0; caoNhat = 1;
          Rnd = V.rng(Math.round(G.hat) || 1);
        },
        ve: ve,
        nhan: function () { return "đã lấy " + tongTB.toLocaleString("vi") + " trung bình"; }
      });

      var r = V.khung(host, {
        ten: "gioi-han-trung-tam",
        bang: cv,
        ve: [cv, ghiChu],
        dieuKhien: [P.dk(), TS.dk(), S.el],
        giaiThich:
          "<b>Định lý:</b> lấy n mẫu độc lập từ một phân phối có trung bình μ và phương sai " +
          "<b>hữu hạn</b> σ². Khi n lớn, trung bình mẫu có phân phối xấp xỉ chuẩn " +
          "<code>N(μ, σ²/n)</code> — <i>bất kể</i> phân phối gốc trông như thế nào." +
          "<ul>" +
          "<li><b>Thử phân phối hai đỉnh:</b> nó không có gì giống chuông — hai cục tách hẳn " +
          "nhau. Đặt n = 1 để xác nhận. Rồi kéo n lên <b>2</b>, <b>3</b>, <b>5</b>. " +
          "Tới n = 5 đã là chuông. Đây là lý do hình chuông có mặt ở khắp nơi trong tự nhiên: " +
          "cái gì là <b>tổng của nhiều thứ nhỏ độc lập</b> thì đều ra chuông.</li>" +
          "<li><b>Chuông hẹp lại theo σ/√n</b>, không phải σ/n. Lại là căn bậc hai — cùng lý do " +
          "khiến Monte Carlo chậm.</li>" +
          "<li><b>⚠ Điều bất ngờ:</b> chọn <b>Đuôi nặng Pareto α=1,2</b>. Định lý đòi phương sai " +
          "<b>hữu hạn</b>, và phân phối này không có. Kết quả: dù n = 40, tổ chức đồ vẫn lệch, " +
          "vẫn có đuôi dài, <b>không</b> thành chuông — và ước lượng σ trong bảng số liệu cứ nhảy " +
          "loạn mỗi lần đổi hạt giống vì nó không hội tụ về đâu cả.</li>" +
          "<li>Đó không phải chuyện học thuật: thu nhập, quy mô thành phố, thiệt hại bảo hiểm, " +
          "biến động thị trường đều có đuôi nặng. Dùng “trung bình ± σ” cho chúng là <b>sai</b>, " +
          "và đây là chỗ nhìn thấy nó sai.</li>" +
          "</ul>"
      });
      r.trai.classList.add("co");

      requestAnimationFrame(function () { cv.doKichThuoc(); apDung(); });
    }
  });
})();
