/* =====================================================================
   lab-dongcat.js — Dong cat Abel va tu to chuc toi han (Bak 1987).

   Tha tung hat cat. O nao du 4 hat thi do deu sang 4 huong, co the lam
   hang xom do theo — mot tran lo. Luat het suc tam thuong. Nhung phan bo
   co tran lo lai la LUY THUA: khong co "co tran lo dien hinh".
   ===================================================================== */
(function () {
  "use strict";
  var V = window.VIS;

  var NGUONG = 4;

  demo({
    id: "dong-cat",
    nhom: "Tự động tế bào",
    mon: "L11",
    ten: "Đống cát — hệ tự đẩy mình tới bờ vực",
    moTa: "Thả từng hạt cát. Ô nào đủ 4 hạt thì đổ đều sang 4 hàng xóm, có thể làm hàng " +
          "xóm đổ theo. Đa số lần thả chẳng có gì xảy ra; thỉnh thoảng một hạt gây ra " +
          "trận lở nuốt nửa lưới. <b>Không có cỡ trận lở điển hình</b> — và hệ tự đi tới " +
          "trạng thái đó, không ai chỉnh gì cả.",

    dung: function (host) {
      var N = 101;
      var h = null;                  /* chieu cao tung o */
      var ngan = null;               /* ngan xu ly do, dung thay cho de quy */
      var L = null, B = null, P = null, Rnd = null;
      var soHat = 0, tranLo = [], loLonNhat = 0, soHatRoiRa = 0;
      var oO = new Float64Array(24);  /* to chuc do log2 cua co tran lo */

      var TS = V.thamSo([
        { ma: "kichThuoc", ten: "Cạnh lưới", kieu: "so", min: 41, max: 201, buoc: 20, gt: 101 },
        { ma: "noiTha", ten: "Thả hạt ở đâu", kieu: "chon", gt: "giua", muc: [
          { v: "giua",       t: "Luôn ở chính giữa — mọc ra hoa văn" },
          { v: "ngau-nhien", t: "Ngẫu nhiên khắp lưới — ra trạng thái tới hạn" }
        ] },
        { ma: "hat", ten: "Hạt giống", kieu: "hat", gt: 9,
          hien: function (g) { return g.noiTha === "ngau-nhien"; } }
      ], {
        doi: function () { apDung(); },
        preset: [
          { ten: "Hoa văn từ tâm",    gt: { noiTha: "giua", kichThuoc: 101 } },
          { ten: "Hoa văn lớn",       gt: { noiTha: "giua", kichThuoc: 201 } },
          { ten: "Tới hạn (rải đều)", gt: { noiTha: "ngau-nhien", kichThuoc: 101 } }
        ]
      });

      var G = TS.gt;

      var cv = V.veBangCo({ rong: 860, tiLe: 0.9, veLai: function () { if (P) apDung(); } });
      var g = cv.g;
      var S = V.soLieu();
      var ghiChu = V.el("div", { class: "chu-thich" });

      /* ============================================================
         Mo phong
         ============================================================ */
      function chuanBi() {
        N = Math.round(G.kichThuoc);
        if (N % 2 === 0) N++;                 /* le de co o chinh giua */
        h = new Uint8Array(N * N);
        ngan = new Int32Array(N * N);
        Rnd = V.rng(Math.round(G.hat) || 1);
        soHat = 0; tranLo = []; loLonNhat = 0; soHatRoiRa = 0;
        oO = new Float64Array(24);

        var chiaY = Math.round(cv.H * 0.74);
        L = V.luoiO(cv, { cot: N, hang: N, le: 10, leTren: 24,
                          leDuoi: cv.H - chiaY + 10 });
        /* 0,1,2,3 hat — tren 3 chi ton tai trong luc dang do. */
        L.bangMau([V.mau("bg2"), V.mau("acbg"), V.mau("ac"), V.mau("ac2"), V.mau("loi")]);
        B = V.bieuDo(cv, {
          le: { t: chiaY + 34, r: 18, b: 32, l: 60 },
          x: { min: 0, max: 20, nhan: "cỡ trận lở (thang log₂)", vach: 5,
               dinhDang: function (v) { return "2^" + v.toFixed(0); } },
          y: { min: 0, max: 1, nhan: "số lần (log)", hienSo: false },
          luoi: 2
        });
      }

      /** Tha mot hat roi do cho toi khi moi o deu duoi nguong.
          Tra ve so lan DO (kich co tran lo). */
      function thaMotHat() {
        var i;
        if (G.noiTha === "giua") {
          i = ((N - 1) / 2) * N + (N - 1) / 2;
        } else {
          i = Math.floor(Rnd() * N * N);
        }
        h[i]++;
        soHat++;

        var dinh = 0, co = 0;
        if (h[i] >= NGUONG) ngan[dinh++] = i;
        while (dinh > 0) {
          var j = ngan[--dinh];
          if (h[j] < NGUONG) continue;
          h[j] -= NGUONG;
          co++;
          var c = j % N, r = (j / N) | 0;
          /* Hat ra khoi mep la MAT — chinh cho thoat nay giu he on dinh. */
          if (c > 0)     { if (++h[j - 1] >= NGUONG) ngan[dinh++] = j - 1; } else soHatRoiRa++;
          if (c < N - 1) { if (++h[j + 1] >= NGUONG) ngan[dinh++] = j + 1; } else soHatRoiRa++;
          if (r > 0)     { if (++h[j - N] >= NGUONG) ngan[dinh++] = j - N; } else soHatRoiRa++;
          if (r < N - 1) { if (++h[j + N] >= NGUONG) ngan[dinh++] = j + N; } else soHatRoiRa++;
          if (dinh > ngan.length - 8) dinh = ngan.length - 8;   /* chan an toan */
        }

        if (co > loLonNhat) loLonNhat = co;
        if (co > 0) {
          var b = Math.min(23, Math.floor(Math.log(co) / Math.LN2));
          oO[b]++;
        }
        tranLo.push(co);
        if (tranLo.length > 200000) tranLo.shift();
        return true;
      }

      /* ============================================================
         Ve
         ============================================================ */
      function ve() {
        g.clearRect(0, 0, cv.W, cv.H);
        g.fillStyle = V.mau("surf");
        g.fillRect(0, 0, cv.W, cv.H);
        L.tuMang(h);
        L.dan();
        L.vien();

        g.fillStyle = V.mau("tx3");
        g.font = "11px ui-monospace,monospace";
        g.textAlign = "left"; g.textBaseline = "top";
        g.fillText("màu = số hạt trên ô (0…3)   lưới " + N + "×" + N, 10, 6);

        /* To chuc do co tran lo tren thang log-log. Phan bo luy thua
           hien ra thanh mot DUONG THANG di xuong. */
        var caoMax = 1, i;
        for (i = 0; i < oO.length; i++) if (oO[i] > caoMax) caoMax = oO[i];
        var logMax = Math.log(caoMax + 1);
        var cot = [];
        for (i = 0; i < 20; i++) cot.push(Math.log(oO[i] + 1) / logMax);
        B.dat({
          x: { min: 0, max: 20, nhan: "cỡ trận lở (thang log₂)", vach: 5,
               dinhDang: function (v) { return "2^" + v.toFixed(0); } },
          y: { min: 0, max: 1.1, nhan: "số lần (thang log)", hienSo: false }
        });
        B.truc();
        B.cotDay(cot, 0, 20, V.mau("ba"));

        var tb = 0;
        for (i = 0; i < tranLo.length; i++) tb += tranLo[i];
        tb = tranLo.length ? tb / tranLo.length : 0;
        var soIm = 0;
        for (i = 0; i < tranLo.length; i++) if (tranLo[i] === 0) soIm++;

        /* Bao toan: moi hat da tha thi hoac con tren luoi, hoac da roi khoi
           mep. Hai so nay cong lai phai bang so hat da tha, khong sai mot don vi. */
        var conLai = 0;
        for (i = 0; i < h.length; i++) conLai += h[i];

        S.dat({
          "Hạt đã thả": soHat.toLocaleString("vi"),
          "Hạt còn trên lưới": conLai.toLocaleString("vi"),
          "Hạt rơi khỏi mép": soHatRoiRa.toLocaleString("vi"),
          "Kiểm tra bảo toàn": (conLai + soHatRoiRa === soHat)
            ? "khớp" : ("LỆCH " + (soHat - conLai - soHatRoiRa)),
          "Trận lở lớn nhất": loLonNhat.toLocaleString("vi") + " lần đổ",
          "Trận lở trung bình": tb.toFixed(2) + " lần đổ",
          "Thả mà không lở gì": tranLo.length
            ? (soIm / tranLo.length * 100).toFixed(1) + "%" : "—",
          "Hình tổ chức đồ": "thẳng trên log-log ⇒ luật luỹ thừa"
        });
      }

      /* ============================================================
         Dieu phoi
         ============================================================ */
      function apDung() {
        if (!cv.W) return;
        chuanBi();
        P.datToiDa(200000);
        P.datTocDo(600);
        ghiChu.innerHTML = "";
        [[V.mau("bg2"), "0 hạt"], [V.mau("acbg"), "1 hạt"],
         [V.mau("ac"), "2 hạt"], [V.mau("ac2"), "3 hạt — sát ngưỡng"]].forEach(function (c) {
          ghiChu.appendChild(V.el("span", {}, [
            V.el("i", { class: "o-mau", style: "background:" + c[0] }), c[1]
          ]));
        });
        P.datLai();
      }

      P = V.phat({
        ten: "dong-cat",
        bang: cv,
        tocDo: 600,
        buoc: function () { return thaMotHat(); },
        datLai: function () { chuanBi(); },
        ve: ve,
        nhan: function () {
          return soHat.toLocaleString("vi") + " hạt, lở lớn nhất " +
                 loLonNhat.toLocaleString("vi");
        }
      });

      var r = V.khung(host, {
        ten: "dong-cat",
        bang: cv,
        ve: [cv, ghiChu],
        dieuKhien: [P.dk(), TS.dk(), S.el],
        giaiThich:
          "<b>Luật:</b> ô nào có từ 4 hạt trở lên thì bớt 4 hạt và cho mỗi hàng xóm 1 hạt. " +
          "Lặp cho tới khi mọi ô đều dưới 4. Hạt rơi ra khỏi mép thì mất. Hết." +
          "<ul>" +
          "<li><b>Thả ở giữa</b> — hình mọc ra <b>không hề giống một đống cát</b>: nó là một " +
          "hoa văn fractal có đối xứng bốn cạnh, cấu trúc lặp ở mọi tỉ lệ. Mà luật thì chỉ có " +
          "một dòng. Hình này được gọi là <i>đống cát Abel</i>: thứ tự đổ các ô không ảnh hưởng " +
          "kết quả cuối — muốn đổ ô nào trước cũng ra đúng hình đó.</li>" +
          "<li><b>Thả ngẫu nhiên</b> — sau vài chục nghìn hạt, hệ tự trôi tới một trạng thái " +
          "đặc biệt: <b>tới hạn</b>. Từ đó trở đi, đa số lần thả không gây ra gì, nhưng thỉnh " +
          "thoảng một hạt duy nhất châm ngòi một trận lở nuốt nửa lưới.</li>" +
          "<li><b>Điều bất ngờ nằm ở tổ chức đồ.</b> Trên thang log–log nó là một " +
          "<b>đường thẳng</b>. Đường thẳng trên log–log nghĩa là <i>luật luỹ thừa</i>: " +
          "không có cỡ trận lở điển hình, không có “trung bình” nào đáng tin. Trận lở gấp 10 " +
          "lần thì hiếm hơn một số lần cố định — ở mọi tỉ lệ.</li>" +
          "<li><b>Tự tổ chức tới hạn:</b> ở hầu hết hệ vật lý, muốn tới điểm tới hạn phải " +
          "<i>chỉnh</i> một tham số (nhiệt độ, áp suất) cho thật khéo. Ở đây <b>không có tham số " +
          "nào để chỉnh</b> — hệ tự đẩy mình tới bờ vực rồi ở lại đó. Bak, Tang và Wiesenfeld " +
          "đưa ra ý này năm 1987 để giải thích vì sao động đất, cháy rừng, tuyệt chủng hàng loạt " +
          "và sụp đổ thị trường đều theo luật luỹ thừa.</li>" +
          "</ul>"
      });
      r.trai.classList.add("co");

      requestAnimationFrame(function () { cv.doKichThuoc(); apDung(); });
    }
  });
})();
