/* =====================================================================
   lab-canxu.js — Can bao nhieu lan thi chac chan tim ra xu gia?

   Moi lan can cho DUNG BA ket cuc: trai nang, can bang, phai nang. Nen
   sau k lan can khong the phan biet noi hon 3^k truong hop. Do la can
   duoi ly thuyet thong tin, va no cho ra "12 xu can 3 lan".

   Dieu bat ngo nam o cho KHAC: voi 13 xu, can duoi van noi 3 lan la du
   (2 x 13 = 26 < 27), nhung 3 lan la KHONG THE. Lab nay tim so lan can
   toi uu bang VET CAN THAT — khong dung cong thuc — nen no chi thang ra
   duoc rang can duoi khong phai luc nao cung dat toi.

   Va chi can them MOT dong xu ma ban da biet chac la that, 13 xu lai
   giai duoc trong 3 lan. Mot dong xu khong chua thong tin gi ve bai
   toan, nhung no doi duoc dap so — vi no cho phep can le.
   ===================================================================== */
(function () {
  "use strict";
  var V = window.VIS;

  /* ------------------------------------------------------------------
     Trang thai = (nB, nH, nL, nG)

       B — chua biet gi: neu no gia thi co the nang, co the nhe  -> 2 the gioi
       H — neu no gia thi CHAC CHAN nang                         -> 1 the gioi
       L — neu no gia thi CHAC CHAN nhe                          -> 1 the gioi
       G — da biet chac la that                                  -> 0 the gioi

     Nho gom theo LOP thay vi theo tung dong xu, khong gian trang thai tu
     hang ty tut xuong vai nghin — do la phep rut gon doi xung, va no la
     ly do lab nay vet can duoc that su trong trinh duyet.
     ------------------------------------------------------------------ */

  function soTheGioi(t) { return 2 * t.B + t.H + t.L; }

  /** Xong chua? Hai muc do khat khe khac nhau. */
  function daXong(t, phaiNoiHuong) {
    var tg = soTheGioi(t);
    if (tg <= 1) return true;
    /* Chi can chi ra DONG XU, khong can noi nang hay nhe: mot dong xu
       lop B van con hai the gioi, nhung ca hai deu tro vao no. */
    if (!phaiNoiHuong && t.B === 1 && t.H === 0 && t.L === 0) return true;
    return false;
  }

  /** Ba trang thai con sau mot lan can.
      Trai dat (bL, hL, lL, gL), phai dat (bR, hR, lR, gR). */
  function chia(t, w) {
    var N = t.B + t.H + t.L + t.G;
    /* Trai nang: xu gia hoac la mot xu NANG ben trai, hoac mot xu NHE ben
       phai. Moi xu khac deu thanh that. */
    var trai = { B: 0, H: w.bL + w.hL, L: w.bR + w.lR, G: 0 };
    trai.G = N - trai.H - trai.L;
    /* Phai nang: doi xung. */
    var phai = { B: 0, H: w.bR + w.hR, L: w.bL + w.lL, G: 0 };
    phai.G = N - phai.H - phai.L;
    /* Can bang: xu gia nam trong so xu DE NGOAI, va giu nguyen lop. */
    var bang = {
      B: t.B - w.bL - w.bR,
      H: t.H - w.hL - w.hR,
      L: t.L - w.lL - w.lR,
      G: 0
    };
    bang.G = N - bang.B - bang.H - bang.L;
    return [trai, bang, phai];
  }

  /** Liet ke cac lan can dang xet. Khong liet ke het moi cach chia —
      chi liet ke theo SO LUONG moi lop o moi ben, vi cac xu cung lop
      thay the duoc cho nhau. */
  function cacLanCan(t) {
    var ds = [];
    for (var bL = 0; bL <= t.B; bL++)
    for (var bR = 0; bR <= t.B - bL; bR++)
    for (var hL = 0; hL <= t.H; hL++)
    for (var hR = 0; hR <= t.H - hL; hR++)
    for (var lL = 0; lL <= t.L; lL++)
    for (var lR = 0; lR <= t.L - lL; lR++) {
      var tL = bL + hL + lL, tR = bR + hR + lR;
      if (tL === 0 && tR === 0) continue;
      var lech = tL - tR;
      var gL = 0, gR = 0;
      /* Chi dung xu that de ĐỘN cho hai ben bang nhau. Don nhieu hon
         the la lang phi — khong them thong tin nao. */
      if (lech > 0) { gR = lech; if (gR > t.G) continue; }
      else if (lech < 0) { gL = -lech; if (gL > t.G) continue; }
      /* Doi xung trai-phai: chi giu mot nua. */
      if (bL < bR || (bL === bR && hL < hR) ||
          (bL === bR && hL === hR && lL < lR)) continue;
      ds.push({ bL: bL, hL: hL, lL: lL, gL: gL,
                bR: bR, hR: hR, lR: lR, gR: gR });
    }
    return ds;
  }

  /* ------------------------------------------------------------------
     Vet can co ghi nho: k lan can co du khong?
     ------------------------------------------------------------------ */
  function taoBoGiai(phaiNoiHuong) {
    var nho = {};
    var soNut = 0;

    function khoa(t, d) { return t.B + "," + t.H + "," + t.L + "," + t.G + "," + d; }

    /** Tra ve lan can tot nhat neu d lan can la du, nguoc lai tra null. */
    function giai(t, d) {
      if (daXong(t, phaiNoiHuong)) return { du: true, can: null };
      if (d <= 0) return { du: false, can: null };
      /* Chan bang ly thuyet thong tin — cat phan lon cay tim kiem. */
      if (soTheGioi(t) > Math.pow(3, d)) return { du: false, can: null };

      var k = khoa(t, d);
      if (nho[k] !== undefined) return nho[k];
      soNut++;

      var ds = cacLanCan(t);
      var ketQua = { du: false, can: null };
      for (var i = 0; i < ds.length; i++) {
        var con = chia(t, ds[i]);
        /* Cat som: nhanh nao qua day thi khoi de quy. */
        var qua = false;
        for (var j = 0; j < 3; j++) {
          if (soTheGioi(con[j]) > Math.pow(3, d - 1)) { qua = true; break; }
        }
        if (qua) continue;
        var duHet = true;
        for (j = 0; j < 3; j++) {
          if (!giai(con[j], d - 1).du) { duHet = false; break; }
        }
        if (duHet) { ketQua = { du: true, can: ds[i] }; break; }
      }
      nho[k] = ketQua;
      return ketQua;
    }

    return {
      giai: giai,
      soNut: function () { return soNut; },
      /** So lan can TOI THIEU, tim bang cach tang dan. */
      toiThieu: function (t, tran) {
        for (var d = 0; d <= tran; d++) if (giai(t, d).du) return d;
        return -1;
      }
    };
  }

  demo({
    id: "can-xu",
    nhom: "Câu đố quyết định",
    mon: "L29",
    ten: "Cân xu — và chỗ cận dưới nói dối",
    moTa: "Mỗi lần cân cho <b>đúng ba kết cục</b>, nên k lần cân phân biệt được nhiều " +
          "nhất 3<sup>k</sup> trường hợp. Với 13 xu, cận đó nói <b>3 lần là đủ</b>. " +
          "Lab này vét cạn thật và tìm ra <b>3 lần là không thể</b> — rồi cho thêm " +
          "<b>một đồng xu bạn đã biết là thật</b>, và 3 lần lại đủ.",

    dung: function (host) {
      var P = null, C = null, B = null, CT = null;
      var BG = null;                    /* bo giai hien tai */
      var ttDau = null;
      var toiThieu = -1, canDuoi = 0, soNutDaXet = 0, voNghiem = false;
      var lsTheGioi = [];               /* so the gioi con lai sau tung lan can */
      var gan = null;                   /* phan cong cua nguoi choi: 0 ngoai, 1 trai, 2 phai */
      var loiChoi = "";

      var TS = V.thamSo([
        { ma: "soXu", ten: "Số đồng xu", kieu: "so", min: 2, max: 30, buoc: 1, gt: 12,
          moTa: "Đúng <b>một</b> đồng trong số này là giả — nặng hơn hoặc nhẹ hơn, " +
                "bạn chưa biết chiều nào." },
        { ma: "xuThat", ten: "Số đồng đã biết chắc là thật", kieu: "so",
          min: 0, max: 4, buoc: 1, gt: 0,
          moTa: "Đồng xu này <b>không chứa thông tin gì</b> về bài toán — nhưng nó " +
                "cho phép <b>cân lệch</b>, và riêng điều đó đổi được đáp số." },
        { ma: "noiHuong", ten: "Phải nói luôn nặng hay nhẹ", kieu: "bat", gt: true,
          moTa: "Tắt đi thì chỉ cần <b>chỉ ra đồng xu</b>, số trường hợp giảm " +
                "một nửa. <b>Nhưng đáp số không đổi</b> — vét cạn N = 2–40 với 0–4 xu " +
                "thật thì không có trường hợp nào bớt được lần cân nào. Tự bật tắt mà " +
                "kiểm." },
        { ma: "tranCan", ten: "Tìm tới tối đa mấy lần cân", kieu: "so",
          min: 1, max: 5, buoc: 1, gt: 4,
          moTa: "Vét cạn nên tăng số này làm chậm rất nhanh." }
      ], {
        doi: function () { apDung(); },
        preset: [
          { ten: "12 xu — bài kinh điển", gt: { soXu: 12, xuThat: 0, noiHuong: true } },
          { ten: "★ 13 xu — cận nói dối", gt: { soXu: 13, xuThat: 0, noiHuong: true } },
          { ten: "★ 13 xu + 1 xu thật", gt: { soXu: 13, xuThat: 1, noiHuong: true } },
          { ten: "13 xu, khỏi nói chiều", gt: { soXu: 13, xuThat: 0, noiHuong: false } },
          { ten: "★ 4 xu — cận nói dối, bản nhỏ nhất", gt: { soXu: 4, xuThat: 0, noiHuong: true } },
          { ten: "★ 2 xu — vô nghiệm", gt: { soXu: 2, xuThat: 0, noiHuong: true } },
          { ten: "2 xu + 1 xu thật — giải được", gt: { soXu: 2, xuThat: 1, noiHuong: true } },
          { ten: "3 xu — nhỏ nhất", gt: { soXu: 3, xuThat: 0, noiHuong: true } },
          { ten: "27 xu — cần 4 lần", gt: { soXu: 27, xuThat: 0, tranCan: 4 } }
        ]
      });

      var G = TS.gt;

      var cv = V.veBangCo({ rong: 900, tiLe: 0.78, veLai: function () { if (P) apDung(); } });
      var g = cv.g;
      var S = V.soLieu();
      var ghiChu = V.el("div", { class: "chu-thich" });

      /* ============================================================
         Cho nguoi dung tu can
         ============================================================ */
      function lapChoiThu() {
        CT = V.choiThu({
          batDau: function () {
            return { B: Math.round(G.soXu), H: 0, L: 0, G: Math.round(G.xuThat) };
          },
          nuocDi: function (t, w) {
            var tL = w.bL + w.hL + w.lL + w.gL;
            var tR = w.bR + w.hR + w.lR + w.gR;
            if (tL !== tR || tL === 0) return null;
            if (w.bL + w.bR > t.B || w.hL + w.hR > t.H ||
                w.lL + w.lR > t.L || w.gL + w.gR > t.G) return null;
            /* Ket cuc do CHINH BO GIAI chon: no dua ta vao nhanh TE NHAT,
               nen nguoi choi khong the an may. Day la doi thu ac y, va do
               moi la cach do dung mot chien luoc. */
            var con = chia(t, w);
            var te = 0;
            for (var i = 1; i < 3; i++) {
              if (soTheGioi(con[i]) > soTheGioi(con[te])) te = i;
            }
            lsTheGioi.push(soTheGioi(con[te]));
            return con[te];
          },
          xong: function (t) { return daXong(t, G.noiHuong); },
          toiUu: function () { return toiThieu; }
        });
      }

      /** Doc phan cong tren man hinh thanh mot lan can. */
      function canTuGan(t) {
        var w = { bL: 0, hL: 0, lL: 0, gL: 0, bR: 0, hR: 0, lR: 0, gR: 0 };
        for (var i = 0; i < gan.length; i++) {
          if (!gan[i]) continue;
          var ben = gan[i] === 1 ? "L" : "R";
          w[lopCua(t, i) + ben]++;
        }
        return w;
      }

      /** Dong xu thu i thuoc lop nao trong trang thai t.
          Xep theo thu tu B, H, L, G de hien thi on dinh. */
      function lopCua(t, i) {
        if (i < t.B) return "b";
        if (i < t.B + t.H) return "h";
        if (i < t.B + t.H + t.L) return "l";
        return "g";
      }

      /* ============================================================
         Chuan bi
         ============================================================ */
      function apDung() {
        if (!cv.W) return;
        var N = Math.round(G.soXu), NT = Math.round(G.xuThat);
        ttDau = { B: N, H: 0, L: 0, G: NT };

        BG = taoBoGiai(G.noiHuong);
        toiThieu = BG.toiThieu(ttDau, Math.round(G.tranCan));
        /* Khong phai "chua tim thay" ma la VO NGHIEM: khong co xu that thi
           hai dia buoc phai bang nhau, nen voi 2 xu ta chi can duoc 1 choi
           1. Luc do ket cuc "can bang" khong the xay ra (co xu gia that ma),
           nen mot lan can chi cho 2 ket cuc cho 4 truong hop — va khong so
           lan can nao cuu duoc. */
        voNghiem = (toiThieu < 0 && N + NT <= 2);
        soNutDaXet = BG.soNut();
        canDuoi = V.canThongTin(G.noiHuong ? 2 * N : N, 3);

        lsTheGioi = [soTheGioi(ttDau)];
        gan = new Int8Array(N + NT);
        loiChoi = "";
        lapChoiThu();

        /* leTren chua ca nhan truc ngang cua bieu do lan dong chu thich
           cay — xem ghi chu cung loai trong lab-thatrung.js. */
        C = V.cayQuyetDinh(cv, { le: 14, leTren: Math.round(cv.H * 0.46) + 16, leDuoi: 34 });
        /* Le PHAI phai chua cho vung ve xu — xu bat dau o 46 % be ngang.
           Truoc day bieu do an ca be ngang va xu ve DE LEN no; tang DOM gia
           khong thay duoc vi no khong co hinh hoc. */
        B = V.bieuDo(cv, {
          le: { t: 26, r: Math.round(cv.W * 0.56), b: cv.H - Math.round(cv.H * 0.40), l: 64 },
          x: { min: 0, max: Math.max(1, Math.round(G.tranCan)), nhan: "số lần cân",
               vach: Math.max(1, Math.round(G.tranCan)),
               dinhDang: function (v) { return String(Math.round(v)); } },
          y: { min: 1, max: Math.max(9, 2 * N), log: true,
               nhan: "số trường hợp còn lại",
               dinhDang: function (v) { return String(Math.round(v)); } },
          luoi: 4
        });

        ghiChu.innerHTML = "";
        [["bd", "chưa biết gì — có thể nặng, có thể nhẹ"],
         ["loi", "nếu giả thì NẶNG"],
         ["ac", "nếu giả thì NHẸ"],
         ["ok", "đã biết chắc là thật"]].forEach(function (x) {
          ghiChu.appendChild(V.el("span", {}, [
            V.el("i", { class: "o-mau", style: "background:" + V.mau(x[0]) }), x[1]
          ]));
        });
        ghiChu.appendChild(V.el("span", { text: "· bấm vào xu để đặt lên đĩa trái → phải → bỏ ra" }));

        P.datToiDa(Math.round(G.tranCan));
        P.datLai();
      }

      /* ============================================================
         Dung cay chien luoc de ve
         ============================================================ */
      function mocCay(nut, t, d, sauToiDa) {
        if (d <= 0 || sauToiDa <= 0) return;
        var kq = BG.giai(t, d);
        if (!kq.du || !kq.can) return;
        var con = chia(t, kq.can);
        var ten = ["trái nặng", "cân bằng", "phải nặng"];
        for (var i = 0; i < 3; i++) {
          var tg = soTheGioi(con[i]);
          var n = C.them(nut, {
            nhan: String(tg),
            canh: ten[i],
            mau: daXong(con[i], G.noiHuong) ? V.mau("ok") : null
          });
          n.duLieu = con[i];
          if (!daXong(con[i], G.noiHuong)) mocCay(n, con[i], d - 1, sauToiDa - 1);
        }
      }

      /* ============================================================
         Ve
         ============================================================ */
      function veXu(t) {
        var N = t.B + t.H + t.L + t.G;
        var y0 = 14, cao = Math.round(cv.H * 0.40) - 26;
        var cot = Math.min(N, Math.ceil(Math.sqrt(N * 2.6)) + 2);
        var hang = Math.ceil(N / cot);
        var xL = Math.round(cv.W * 0.46) + 20;
        var rongVung = cv.W - xL - 16;
        var r = Math.min(16, Math.max(6, Math.min(rongVung / cot, cao / hang) / 2.4));

        g.save();
        g.font = "600 " + Math.max(8, Math.round(r)) + "px ui-monospace,monospace";
        g.textAlign = "center"; g.textBaseline = "middle";
        for (var i = 0; i < N; i++) {
          var c = i % cot, h = (i / cot) | 0;
          var x = xL + rongVung * (c + 0.5) / cot;
          var y = y0 + cao * (h + 0.5) / hang;
          var lop = lopCua(t, i);
          g.fillStyle = lop === "b" ? V.mau("bd") : lop === "h" ? V.mau("loi")
                      : lop === "l" ? V.mau("ac") : V.mau("ok");
          g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
          /* Dia can nguoi choi dang xep. */
          if (gan[i]) {
            g.strokeStyle = V.mau("tx");
            g.lineWidth = 2.5;
            g.beginPath(); g.arc(x, y, r + 2, 0, 6.2832); g.stroke();
            g.fillStyle = V.mau("tx");
            g.fillText(gan[i] === 1 ? "T" : "P", x, y);
          }
          t._x = t._x || []; t._y = t._y || []; t._r = r;
          t._x[i] = x; t._y[i] = y;
        }
        g.restore();
      }

      function ve() {
        g.clearRect(0, 0, cv.W, cv.H);
        g.fillStyle = V.mau("surf");
        g.fillRect(0, 0, cv.W, cv.H);

        var t = CT.tt();

        /* --- bieu do so truong hop con lai --- */
        B.truc();
        var bTr = [], bDuoi = [];
        for (var i = 0; i < lsTheGioi.length; i++) bTr.push([i, Math.max(1, lsTheGioi[i])]);
        /* Duong "chia ba moi lan" — toc do toi da ma ly thuyet cho phep. */
        var tgDau = soTheGioi(ttDau);
        for (i = 0; i <= Math.round(G.tranCan); i++) {
          bDuoi.push([i, Math.max(1, tgDau / Math.pow(3, i))]);
        }
        B.duong(bDuoi, V.mau("tx3"), 1.2);
        B.duong(bTr, V.mau("ac"), 2.2);
        B.chu(0, tgDau, "chia ba mỗi lần — nhanh nhất có thể", V.mau("tx3"));

        veXu(t);

        /* --- cay chien luoc --- */
        /* Khung hep thi bo cay — xem ghi chu cung loai trong lab-thatrung.js. */
        if (cv.W >= 620) {
        C.goc({ nhan: String(soTheGioi(t)) });
        C.nuts[0].duLieu = t;
        if (!daXong(t, G.noiHuong)) {
          var conLai = toiThieu < 0 ? Math.round(G.tranCan)
                     : Math.max(0, toiThieu - CT.soNuoc());
          mocCay(C.nuts[0], t, Math.max(1, conLai), 2);
        }
        C.boCuc();
        C.ve({ banKinh: 12 });
        }

        g.save();
        g.font = "11px system-ui,sans-serif";
        g.fillStyle = V.mau("tx3");
        g.textAlign = "left"; g.textBaseline = "top";
        g.fillText("Chiến lược tối ưu từ trạng thái hiện tại — số trong nút là "
                   + "số trường hợp còn lại", 14, Math.round(cv.H * 0.46) + 2);
        g.restore();

        /* --- bang so lieu --- */
        var N = Math.round(G.soXu);
        var bang = {
          "Số xu": N + (G.xuThat > 0 ? "  (+" + Math.round(G.xuThat) + " xu thật)" : ""),
          "Số trường hợp ban đầu": soTheGioi(ttDau) +
            (G.noiHuong ? "  (mỗi xu × nặng/nhẹ)" : ""),
          "Cận dưới lý thuyết": canDuoi + " lần cân   (⌈log₃ " + soTheGioi(ttDau) + "⌉)",
          "Tối ưu THỰC TẾ": voNghiem
            ? "VÔ NGHIỆM — không số lần cân nào đủ"
            : toiThieu < 0
            ? ("> " + Math.round(G.tranCan) + " lần — tăng trần để tìm tiếp")
            : (toiThieu + " lần cân")
        };
        if (voNghiem) {
          bang["Vì sao vô nghiệm"] = "không có xu thật để độn, hai đĩa buộc phải " +
            "bằng nhau → chỉ cân được 1–1, và “cân bằng” không bao giờ xảy ra";
        }
        if (toiThieu >= 0) {
          bang["Cận có đạt được không"] = toiThieu === canDuoi
            ? "✔ ĐẠT — cận chặt ở đây"
            : "✘ KHÔNG — thiếu " + (toiThieu - canDuoi) + " lần so với cận";
        }
        bang["Trạng thái đã vét"] = soNutDaXet.toLocaleString("vi");
        var tb = CT.bang();
        Object.keys(tb).forEach(function (k) { bang[k] = tb[k]; });
        bang["Còn lại"] = soTheGioi(t) + " trường hợp";
        if (loiChoi) bang["⚑"] = loiChoi;
        if (CT.xong()) bang["✔"] = "xong — đã xác định được";
        S.dat(bang);
      }

      /* ============================================================
         Chuot: bam xu de xep len dia
         ============================================================ */
      cv.addEventListener("mousedown", function (e) {
        var t = CT.tt();
        if (!t || !t._x) return;
        var r = cv.getBoundingClientRect();
        var mx = (e.clientX - r.left) * cv.W / r.width;
        var my = (e.clientY - r.top) * cv.H / r.height;
        var N = t.B + t.H + t.L + t.G;
        for (var i = 0; i < N; i++) {
          var dx = t._x[i] - mx, dy = t._y[i] - my;
          if (dx * dx + dy * dy <= (t._r + 3) * (t._r + 3)) {
            gan[i] = (gan[i] + 1) % 3;
            loiChoi = "";
            P.veLai();
            return;
          }
        }
      });

      var nutCan = V.el("button", {
        class: "nut chinh", text: "⚖ Cân",
        onclick: function () {
          var t = CT.tt();
          var w = canTuGan(t);
          if (!CT.di(w)) {
            loiChoi = "hai đĩa phải có SỐ XU BẰNG NHAU và không được để trống";
          } else {
            loiChoi = "";
            gan = new Int8Array(gan.length);
          }
          P.veLai();
        }
      });
      var nutLui = V.el("button", {
        class: "nut phu", text: "↶ Hoàn tác",
        onclick: function () {
          if (CT.hoanTac()) { lsTheGioi.pop(); gan = new Int8Array(gan.length); loiChoi = ""; }
          P.veLai();
        }
      });
      var nutMoi = V.el("button", {
        class: "nut phu", text: "⟲ Chơi lại",
        onclick: function () {
          CT.batDauLai();
          lsTheGioi = [soTheGioi(ttDau)];
          gan = new Int8Array(gan.length);
          loiChoi = "";
          P.veLai();
        }
      });

      P = V.phat({
        ten: "can-xu",
        bang: cv,
        tocDo: 1,
        tua: false,
        buoc: function () {
          /* "Chay" = de bo giai tu di nuoc toi uu tiep theo. */
          var t = CT.tt();
          if (daXong(t, G.noiHuong)) return false;
          var conLai = toiThieu < 0 ? Math.round(G.tranCan)
                     : Math.max(1, toiThieu - CT.soNuoc());
          var kq = BG.giai(t, conLai);
          if (!kq.du || !kq.can) return false;
          CT.di(kq.can);
          return !daXong(CT.tt(), G.noiHuong);
        },
        datLai: function () {
          CT.batDauLai();
          lsTheGioi = [soTheGioi(ttDau)];
          gan = new Int8Array(gan.length);
          loiChoi = "";
        },
        ve: ve,
        nhan: function () {
          return CT.xong() ? "đã xác định được"
               : (soTheGioi(CT.tt()) + " trường hợp còn lại");
        }
      });

      var r = V.khung(host, {
        ten: "can-xu",
        bang: cv,
        ve: [cv, ghiChu],
        dieuKhien: [
          V.el("div", { class: "hang-nut" }, [nutCan, nutLui, nutMoi]),
          P.dk(), TS.dk(), S.el
        ],
        giaiThich:
          "<b>Một lần cân cho đúng ba kết cục:</b> trái nặng, cân bằng, phải nặng. " +
          "Nên sau k lần cân bạn không thể phân biệt nổi quá <b>3<sup>k</sup></b> trường " +
          "hợp. Đó là <b>cận dưới lý thuyết thông tin</b>, và nó đúng với <i>mọi</i> " +
          "chiến lược, kể cả chiến lược chưa ai nghĩ ra." +
          "<ul>" +
          "<li>12 xu, chưa biết giả nặng hay nhẹ → <b>24 trường hợp</b>. ⌈log₃ 24⌉ = 3, " +
          "và 3 lần <b>làm được thật</b>. Đây là bài đố kinh điển, và ở đây cận " +
          "<b>chặt</b>.</li>" +
          "<li><b>★ Bấm preset “4 xu”.</b> 8 trường hợp, mà 3² = 9, nên cận nói <b>2 lần " +
          "là đủ</b>. Lab vét cạn thật sự — không dùng công thức nào — và tìm ra <b>3</b>. " +
          "Đây là ví dụ <b>nhỏ nhất</b> mà cận nói dối: nhỏ đến mức bạn soí được " +
          "bằng tay. Cùng chuyện đó lặp lại ở <b>13 xu</b> (cận 3, thật 4) và " +
          "<b>40 xu</b> (cận 4, thật 5).</li>" +
          "<li><b>★ Rồi bấm “2 xu — vô nghiệm”.</b> Không phải “cần nhiều lần cân” " +
          "mà là <b>không số lần cân nào đủ</b>. Bạn chỉ cân được 1 chọi 1, và vì " +
          "chắc chắn có xu giả nên kết cục “cân bằng” <i>không bao giờ xảy ra</i>. " +
          "Một lần cân chỉ còn <b>2</b> kết cục chứ không phải 3 — và cân mãi cũng " +
          "không thêm được gì.</li>" +
          "<li><b>★ Thêm một xu thật vào thì giải được trong 2 lần.</b> Đồng xu đó " +
          "<b>không chứa một chút thông tin nào</b> về bài toán — nó không thể là xu " +
          "giả. Vậy mà nó biến bài vô nghiệm thành bài giải được. Cũng vậy, 13 xu " +
          "tụt từ 4 lần xuống <b>3</b>.</li>" +
          "</ul>" +
          "<b>Vì sao một đồng xu vô dụng lại đổi được đáp số?</b> Vì hai đĩa cân phải " +
          "có <i>số xu bằng nhau</i>. Không có xu độn, với 13 xu bạn chỉ cân được 6–6, " +
          "5–5, 4–4… Có một đồng xu thật, bạn cân được <b>5 xu chọi 4 xu + 1 xu " +
          "thật</b> — tức là hỏi được một câu mà trước đó không hỏi nổi. " +
          "<b>Ràng buộc nằm ở luật chơi, không nằm ở lượng thông tin</b> — và cận dưới " +
          "thông tin không hề biết gì về luật chơi." +
          "<ul>" +
          "<li>Công thức mà vét cạn xác nhận: không có xu thật, w lần cân giải được " +
          "tối đa <b>(3<sup>w</sup>−3)/2</b> xu; có xu thật thì lên " +
          "<b>(3<sup>w</sup>−1)/2</b>. Thử w = 3: 12 và 13 — đúng hai con số ở trên.</li>" +
          "<li><b>Bấm vào từng đồng xu</b> để đặt lên đĩa trái → phải → bỏ ra, rồi bấm " +
          "<i>⚖ Cân</i>. Bảng số liệu chấm điểm bạn so với tối ưu.</li>" +
          "<li><b>Đối thủ chơi ác ý:</b> kết cục mỗi lần cân do máy chọn, và nó luôn đẩy " +
          "bạn vào nhánh <b>còn nhiều trường hợp nhất</b>. Nên bạn không thể ăn may, và " +
          "số lần cân bạn dùng đúng là số lần mà chiến lược của bạn <i>bảo đảm</i> " +
          "được — chứ không phải số lần bạn gặp may.</li>" +
          "<li>Đường xám trên biểu đồ là <b>chia ba mỗi lần</b> — tốc độ nhanh nhất lý " +
          "thuyết cho phép. Đường của bạn không bao giờ xuống dưới nó được.</li>" +
          "<li><b>Tắt “phải nói luôn nặng hay nhẹ”</b>: số trường hợp giảm một nửa, " +
          "nên cận dưới tụt. Nhưng đáp số <b>không đổi</b> — vét cạn N = 2–40 với " +
          "0–4 xu thật không tìm ra trường hợp nào bớt được lần cân. Một kết quả " +
          "<i>âm</i> — nhưng nó cũng là thông tin, và cứ tự bật tắt mà kiểm.</li>" +
          "</ul>" +
          "<b>Lab này vét cạn thật.</b> Ô <i>Trạng thái đã vét</i> đếm số trạng thái " +
          "khác nhau nó đã xét. Mẹo làm cho việc đó khả thi: <b>gom xu theo lớp</b> thay " +
          "vì theo từng đồng. Hai đồng mà ta biết y hệt nhau thì thay thế được cho nhau, " +
          "nên trạng thái chỉ là bốn con số: <i>bao nhiêu đồng chưa biết gì, bao nhiêu " +
          "đồng “nếu giả thì nặng”, bao nhiêu đồng “nếu giả thì nhẹ”, bao nhiêu " +
          "đồng đã biết là thật</i>. Không có phép rút gọn đối xứng đó thì không gian " +
          "trạng thái là hàng tỷ và trình duyệt bó tay."
      });
      r.trai.classList.add("co");

      requestAnimationFrame(function () { cv.doKichThuoc(); apDung(); });
    }
  });
})();
