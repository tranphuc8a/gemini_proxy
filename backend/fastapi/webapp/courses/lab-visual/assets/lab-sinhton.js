/* =====================================================================
   lab-sinhton.js — Thi nghiem sinh ton xa hoi (Sugarscape).

   Epstein & Axtell, "Growing Artificial Societies" (1996).

   CANH BAO THIET KE: lab kieu nay rat de thanh "mot dam cham chay loan,
   dep ma khong hieu gi". Nen phan DOC DUOC KET QUA duoc thiet ke TRUOC
   phan mo phong: he so Gini theo thoi gian, phan bo cua cai, tuoi tho.
   Khong co ba thu do thi khong co lab, chi co man hinh nen.

   Cau hoi ma lab tra loi: bat binh dang co can ai boc lot ai khong?
   ===================================================================== */
(function () {
  "use strict";
  var V = window.VIS;

  var TRONG = 0;

  demo({
    id: "sinh-ton-xa-hoi",
    nhom: "Xã hội & trò chơi",
    mon: "L17",
    ten: "Sinh tồn xã hội — bất bình đẳng mọc ra từ hư không",
    moTa: "Không ai bóc lột ai. Không buôn bán, không thừa kế, không lãi suất, không " +
          "quyền lực. Mỗi cá thể chỉ đi tìm thức ăn và ăn. Vậy mà <b>hệ số Gini leo từ " +
          "0,2 lên quá 0,5</b> — mức bất bình đẳng của một quốc gia thật. Chỉ vì người " +
          "ta sinh ra khác nhau một chút, và tài nguyên thì không rải đều.",

    dung: function (host) {
      var N = 50;
      var duong = null, sucChua = null;     /* duong hien co / suc chua toi da */
      var oCua = null;                      /* o -> chi so tac tu, -1 la trong */
      var oMau = null;
      /* Tac tu: mang song song, khong dung V.hat vi chung di theo O LUOI. */
      var ax = null, ay = null, cuaCai = null, tamNhin = null, tieuThu = null;
      var tuoi = null, thoToiDa = null;
      var soTacTu = 0;
      var L = null, BG = null, BH = null, P = null, Rnd = null;
      var buocDem = 0, soChet = 0, tongTuoiChet = 0;
      var lichSuGini = [], lichSuDan = [];
      var oCai = new Float64Array(28);      /* to chuc do cua cai */

      var TS = V.thamSo([
        { ma: "soBanDau", ten: "Số cá thể ban đầu", kieu: "so",
          min: 50, max: 1200, buoc: 50, gt: 400 },
        { ma: "kichThuoc", ten: "Cạnh lưới", kieu: "so", min: 30, max: 90, buoc: 5, gt: 50 },
        { ma: "tamNhinToiDa", ten: "Tầm nhìn tối đa", kieu: "so", min: 1, max: 10, buoc: 1, gt: 6,
          moTa: "Mỗi cá thể bốc ngẫu nhiên một tầm nhìn từ 1 tới mức này. " +
                "Đặt về <b>1</b> để xoá gần hết chênh lệch bẩm sinh — rồi xem Gini." },
        { ma: "tieuToiDa", ten: "Mức tiêu thụ tối đa", kieu: "so", min: 1, max: 6, buoc: 1, gt: 4,
          moTa: "Ăn nhiều hay ít cũng là bẩm sinh, bốc ngẫu nhiên từ 1 tới mức này." },
        { ma: "mocLai", ten: "Tốc độ mọc lại của thức ăn", kieu: "so",
          min: 0.05, max: 4, buoc: 0.05, gt: 1 },
        { ma: "deuTaiNguyen", ten: "Rải thức ăn đều khắp lưới", kieu: "bat", gt: false,
          moTa: "Mặc định thức ăn dồn vào hai vùng núi. Bật lên để rải đều — " +
                "và xem <b>địa lý tài nguyên</b> đóng góp bao nhiêu vào bất bình đẳng." },
        { ma: "thayThe", ten: "Thay thế cá thể chết (giữ dân số)", kieu: "bat", gt: true,
          moTa: "Tắt đi để xem dân số tự tìm mức chống chịu của môi trường." },
        { ma: "hat", ten: "Hạt giống", kieu: "hat", gt: 31 }
      ], {
        doi: function () { apDung(); },
        preset: [
          { ten: "Mặc định",                 gt: { tamNhinToiDa: 6, tieuToiDa: 4, deuTaiNguyen: false } },
          { ten: "Sinh ra như nhau",         gt: { tamNhinToiDa: 1, tieuToiDa: 1, deuTaiNguyen: false } },
          { ten: "Tài nguyên rải đều",       gt: { tamNhinToiDa: 6, tieuToiDa: 4, deuTaiNguyen: true } },
          { ten: "Như nhau + rải đều",       gt: { tamNhinToiDa: 1, tieuToiDa: 1, deuTaiNguyen: true } },
          { ten: "Khan hiếm (mọc lại chậm)", gt: { mocLai: 0.15, soBanDau: 400 } },
          { ten: "Không thay thế người chết", gt: { thayThe: false, soBanDau: 800 } }
        ]
      });

      var G = TS.gt;

      var cv = V.veBangCo({ rong: 880, tiLe: 0.92, veLai: function () { if (P) apDung(); } });
      var g = cv.g;
      var S = V.soLieu();
      var ghiChu = V.el("div", { class: "chu-thich" });

      /* ============================================================
         PHAN DOC KET QUA — viet truoc phan mo phong
         ============================================================ */

      /** He so Gini tren mang cua cai. 0 = ai cung nhu ai, 1 = mot nguoi
          giu tat ca. Cong thuc tren day da sap xep. */
      function gini(mang, n) {
        if (!n) return 0;
        var b = Array.prototype.slice.call(mang, 0, n);
        b.sort(function (p, q) { return p - q; });
        var tong = 0, congDon = 0;
        for (var i = 0; i < n; i++) { tong += b[i]; congDon += (i + 1) * b[i]; }
        if (tong <= 0) return 0;
        return (2 * congDon) / (n * tong) - (n + 1) / n;
      }

      /** To chuc do cua cai, chia theo thang log de duoi dai khong bi bep. */
      function dungToChucDo() {
        for (var k = 0; k < oCai.length; k++) oCai[k] = 0;
        for (var i = 0; i < soTacTu; i++) {
          var b = Math.floor(Math.log(Math.max(1, cuaCai[i])) / Math.LN2 * 3);
          if (b < 0) b = 0;
          if (b >= oCai.length) b = oCai.length - 1;
          oCai[b]++;
        }
      }

      /* ============================================================
         Mo phong
         ============================================================ */
      function chuanBi() {
        N = Math.round(G.kichThuoc);
        Rnd = V.rng(Math.round(G.hat) || 1);
        sucChua = new Uint8Array(N * N);
        duong = new Float32Array(N * N);
        oCua = new Int32Array(N * N);

        /* Dia ly tai nguyen: hai vung nui doi xung, nhu ban goc cua
           Epstein & Axtell. Day la thu tao ra "noi tot" va "noi xau". */
        var r, c;
        for (r = 0; r < N; r++) {
          for (c = 0; c < N; c++) {
            var v;
            if (G.deuTaiNguyen) {
              v = 2;
            } else {
              var d1 = Math.hypot(c - N * 0.3, r - N * 0.3);
              var d2 = Math.hypot(c - N * 0.7, r - N * 0.7);
              var d = Math.min(d1, d2);
              v = Math.max(0, 4 - Math.floor(d / (N * 0.11)));
            }
            sucChua[r * N + c] = v;
            duong[r * N + c] = v;
            oCua[r * N + c] = -1;
          }
        }

        var n = Math.round(G.soBanDau);
        ax = new Int32Array(n * 2); ay = new Int32Array(n * 2);
        cuaCai = new Float32Array(n * 2);
        tamNhin = new Uint8Array(n * 2);
        tieuThu = new Uint8Array(n * 2);
        tuoi = new Int32Array(n * 2);
        thoToiDa = new Int32Array(n * 2);
        soTacTu = 0;
        for (var i = 0; i < n; i++) sinhMoi();

        buocDem = 0; soChet = 0; tongTuoiChet = 0;
        lichSuGini = []; lichSuDan = [];
        dungToChucDo();

        var chiaY = Math.round(cv.H * 0.58);
        L = V.luoiO(cv, { cot: N, hang: N, le: 10, leTren: 22,
                          leDuoi: cv.H - chiaY + 8 });
        /* 0..4 = muc thuc an, 5 = co nguoi dung */
        L.bangMau([V.mau("bg2"), V.thangMau(0.12), V.thangMau(0.3),
                   V.thangMau(0.5), V.thangMau(0.7), V.mau("loi")]);

        var giua = Math.round(cv.W * 0.52);
        BG = V.bieuDo(cv, {
          le: { t: chiaY + 30, r: cv.W - giua + 18, b: 30, l: 56 },
          x: { min: 0, max: 100, nhan: "bước", vach: 3, dinhDang: V.soGon },
          y: { min: 0, max: 0.8, nhan: "hệ số Gini",
               dinhDang: function (v) { return v.toFixed(2); } },
          luoi: 3
        });
        BH = V.bieuDo(cv, {
          le: { t: chiaY + 30, r: 18, b: 30, l: giua + 46 },
          x: { min: 0, max: oCai.length, nhan: "của cải (thang log)", hienSo: false },
          y: { min: 0, max: 1, nhan: "số cá thể", dinhDang: V.soGon },
          luoi: 2
        });
      }

      /** Dat mot ca the moi vao o trong bat ky, voi bam sinh boc ngau nhien. */
      function sinhMoi() {
        for (var thu = 0; thu < 600; thu++) {
          var o = Math.floor(Rnd() * N * N);
          if (oCua[o] !== -1) continue;
          var i = soTacTu++;
          ax[i] = o % N; ay[i] = (o / N) | 0;
          oCua[o] = i;
          tamNhin[i] = 1 + Math.floor(Rnd() * Math.round(G.tamNhinToiDa));
          tieuThu[i] = 1 + Math.floor(Rnd() * Math.round(G.tieuToiDa));
          /* Von ban dau cung ngau nhien — nhung day KHONG phai nguyen nhan
             chinh cua bat binh dang, xem phan giai thich. */
          cuaCai[i] = 5 + Rnd() * 20;
          tuoi[i] = 0;
          thoToiDa[i] = 60 + Math.floor(Rnd() * 40);
          return i;
        }
        return -1;
      }

      function xoaTacTu(i) {
        oCua[ay[i] * N + ax[i]] = -1;
        var c = --soTacTu;
        if (i !== c) {
          ax[i] = ax[c]; ay[i] = ay[c];
          cuaCai[i] = cuaCai[c]; tamNhin[i] = tamNhin[c]; tieuThu[i] = tieuThu[c];
          tuoi[i] = tuoi[c]; thoToiDa[i] = thoToiDa[c];
          oCua[ay[i] * N + ax[i]] = i;
        }
      }

      var HUONG = [[1, 0], [-1, 0], [0, 1], [0, -1]];

      /** Mot buoc: moi ca the nhin bon huong trong tam nhin, chon o trong
          nhieu thuc an nhat (gan hon thang hoa), di toi, an het, tra phi
          trao doi chat, gia di. */
      function motBuoc() {
        var i;
        for (i = 0; i < soTacTu; i++) {
          var tot = -1, oTot = -1, xaTot = 1e9;
          var x0 = ax[i], y0 = ay[i];
          var oHienTai = y0 * N + x0;
          tot = duong[oHienTai]; oTot = oHienTai; xaTot = 0;

          for (var h = 0; h < 4; h++) {
            for (var b = 1; b <= tamNhin[i]; b++) {
              var nx = ((x0 + HUONG[h][0] * b) % N + N) % N;
              var ny = ((y0 + HUONG[h][1] * b) % N + N) % N;
              var o = ny * N + nx;
              if (oCua[o] !== -1) continue;
              if (duong[o] > tot || (duong[o] === tot && b < xaTot)) {
                tot = duong[o]; oTot = o; xaTot = b;
              }
            }
          }

          if (oTot !== oHienTai) {
            oCua[oHienTai] = -1;
            ax[i] = oTot % N; ay[i] = (oTot / N) | 0;
            oCua[oTot] = i;
          }
          cuaCai[i] += duong[oTot];
          duong[oTot] = 0;
          cuaCai[i] -= tieuThu[i];
          tuoi[i]++;
        }

        /* Chet: het cua cai hoac qua tuoi. Duyet nguoc vi xoaTacTu doi cho. */
        for (i = soTacTu - 1; i >= 0; i--) {
          if (cuaCai[i] < 0 || tuoi[i] > thoToiDa[i]) {
            soChet++; tongTuoiChet += tuoi[i];
            xoaTacTu(i);
            if (G.thayThe) sinhMoi();
          }
        }

        /* Thuc an moc lai. */
        var moc = G.mocLai;
        for (i = 0; i < duong.length; i++) {
          if (duong[i] < sucChua[i]) {
            duong[i] = Math.min(sucChua[i], duong[i] + moc);
          }
        }

        buocDem++;
        if (buocDem % 2 === 0) {
          lichSuGini.push([buocDem, gini(cuaCai, soTacTu)]);
          lichSuDan.push([buocDem, soTacTu]);
          if (lichSuGini.length > 4000) { lichSuGini.shift(); lichSuDan.shift(); }
        }
        return soTacTu > 0;
      }

      /* ============================================================
         Ve
         ============================================================ */
      function ve() {
        g.clearRect(0, 0, cv.W, cv.H);
        g.fillStyle = V.mau("surf");
        g.fillRect(0, 0, cv.W, cv.H);

        if (!oMau || oMau.length !== N * N) oMau = new Uint8Array(N * N);
        var i;
        for (i = 0; i < N * N; i++) {
          oMau[i] = oCua[i] !== -1 ? 5 : Math.min(4, Math.round(duong[i]));
        }
        L.tuMang(oMau);
        L.dan();
        L.vien();

        g.fillStyle = V.mau("tx3");
        g.font = "11px ui-monospace,monospace";
        g.textAlign = "left"; g.textBaseline = "top";
        g.fillText("lưới " + N + "×" + N + " · " + soTacTu.toLocaleString("vi") +
                   " cá thể · đỏ = có người", 10, 5);

        /* --- Gini theo thoi gian --- */
        var tran = Math.max(60, buocDem);
        BG.dat({ x: { min: 0, max: tran, nhan: "bước", vach: 3, dinhDang: V.soGon },
                 y: { min: 0, max: 0.8, nhan: "hệ số Gini",
                      dinhDang: function (v) { return v.toFixed(2); } } });
        BG.truc();
        BG.moc(0.35, V.mau("ok"), "0,35 — mức của Bắc Âu");
        BG.moc(0.63, V.mau("ba"), "0,63 — Nam Phi");
        BG.duong(lichSuGini, V.mau("loi"), 2.2);

        /* --- Phan bo cua cai --- */
        dungToChucDo();
        var caoNhat = 1;
        for (i = 0; i < oCai.length; i++) if (oCai[i] > caoNhat) caoNhat = oCai[i];
        BH.dat({ x: { min: 0, max: oCai.length, nhan: "của cải (thang log)", hienSo: false },
                 y: { min: 0, max: caoNhat * 1.15, nhan: "số cá thể", dinhDang: V.soGon } });
        BH.truc();
        BH.cotDay(oCai, 0, oCai.length, V.mau("ac"));

        var gn = gini(cuaCai, soTacTu);
        var tbTuoi = soChet ? tongTuoiChet / soChet : 0;
        var giau = 0, ngheo = 0;
        var sx = Array.prototype.slice.call(cuaCai, 0, soTacTu)
                 .sort(function (p, q) { return q - p; });
        var tongCua = 0;
        for (i = 0; i < sx.length; i++) tongCua += sx[i];
        for (i = 0; i < Math.ceil(sx.length * 0.1); i++) giau += sx[i];
        for (i = Math.floor(sx.length * 0.5); i < sx.length; i++) ngheo += sx[i];

        S.dat({
          "Dân số": soTacTu.toLocaleString("vi"),
          "Bước": buocDem.toLocaleString("vi"),
          "Hệ số Gini": gn.toFixed(3),
          "10% giàu nhất nắm": tongCua > 0 ? (giau / tongCua * 100).toFixed(1) + "% của cải" : "—",
          "50% nghèo nhất nắm": tongCua > 0 ? (ngheo / tongCua * 100).toFixed(1) + "% của cải" : "—",
          "Đã chết": soChet.toLocaleString("vi"),
          "Tuổi thọ trung bình": tbTuoi.toFixed(1) + " bước",
          "So sánh": gn < 0.3 ? "khá đều" : gn < 0.45 ? "như Tây Âu"
                   : gn < 0.6 ? "như Mỹ / Trung Quốc" : "như Nam Phi / Brazil"
        });
      }

      /* ============================================================
         Dieu phoi
         ============================================================ */
      function apDung() {
        if (!cv.W) return;
        chuanBi();
        P.datToiDa(2500);
        P.datTocDo(20);
        ghiChu.innerHTML = "";
        [[V.mau("bg2"), "hết thức ăn"], [V.thangMau(0.3), "ít"],
         [V.thangMau(0.7), "nhiều"], [V.mau("loi"), "có người đứng"],
         [V.mau("ac"), "phân bố của cải"]].forEach(function (c) {
          ghiChu.appendChild(V.el("span", {}, [
            V.el("i", { class: "o-mau", style: "background:" + c[0] }), c[1]
          ]));
        });
        P.datLai();
      }

      P = V.phat({
        ten: "sinh-ton-xa-hoi",
        bang: cv,
        tocDo: 20,
        buoc: function () { return motBuoc(); },
        datLai: function () { chuanBi(); },
        ve: ve,
        nhan: function (k, xong) {
          if (xong) return "không còn ai sống sót";
          return "Gini " + gini(cuaCai, soTacTu).toFixed(3) +
                 " · dân số " + soTacTu.toLocaleString("vi");
        }
      });

      var r = V.khung(host, {
        ten: "sinh-ton-xa-hoi",
        bang: cv,
        ve: [cv, ghiChu],
        dieuKhien: [P.dk(), TS.dk(), S.el],
        giaiThich:
          "<b>Luật, đầy đủ:</b> mỗi cá thể nhìn bốn hướng trong tầm nhìn của mình, đi tới ô " +
          "trống nhiều thức ăn nhất, ăn sạch ô đó, rồi trả một khoản <i>tiêu thụ</i> cố định. " +
          "Hết thức ăn hoặc quá tuổi thì chết. Thức ăn mọc lại dần." +
          "<ul>" +
          "<li><b>Không có gì trong luật tạo ra bất bình đẳng.</b> Không buôn bán, không cho " +
          "vay, không thừa kế, không liên minh, không ai lấy được gì của ai. Mỗi cá thể chỉ " +
          "kiếm ăn cho mình.</li>" +
          "<li><b>Vậy mà Gini leo lên quá 0,5</b> và trụ ở đó — mức bất bình đẳng của một " +
          "quốc gia thật. Tổ chức đồ của cải bên phải lệch hẳn sang trái với một cái đuôi dài: " +
          "rất nhiều người nghèo, vài người rất giàu.</li>" +
          "</ul>" +
          "<b>Vậy nó đến từ đâu? Hai nguồn — và lab này tách được chúng ra:</b>" +
          "<ul>" +
          "<li><b>Chênh lệch bẩm sinh.</b> Bấm <i>Sinh ra như nhau</i>: mọi người cùng tầm nhìn 1, " +
          "cùng mức tiêu thụ 1. Gini tụt từ <b>0,48</b> xuống <b>0,41</b> — nhưng " +
          "<b>không về 0</b>.</li>" +
          "<li><b>Địa lý tài nguyên.</b> Bấm <i>Tài nguyên rải đều</i>: xoá hai vùng núi, " +
          "Gini xuống <b>0,44</b>. Sinh ra cạnh vùng trù phú là một lợi thế mà không ai " +
          "chọn được.</li>" +
          "<li><b>Bỏ cả hai</b> — bấm <i>Như nhau + rải đều</i>: Gini xuống <b>0,26</b>. " +
          "Hai nguồn này <b>không cộng tuyến tính</b>: bỏ riêng từng cái thì mỗi cái chỉ " +
          "bớt vài phần trăm, bỏ cả hai mới sụp hẳn. Chúng khuếch đại lẫn nhau.</li>" +
          "<li>Phần <b>0,26</b> còn lại là <b>may rủi tích luỹ</b> thuần tuý — vài bước đi may " +
          "mắn đầu đời được cộng dồn mãi, cộng với việc người già đã kịp tích nhiều " +
          "hơn người trẻ.</li>" +
          "</ul>" +
          "<b>Vì sao đáng nghĩ:</b> Epstein và Axtell dựng mô hình này năm 1996 để chỉ ra rằng " +
          "một phân phối của cải rất lệch <b>không chứng minh</b> có bóc lột, cũng " +
          "<b>không chứng minh</b> người giàu tài giỏi hơn tương xứng. Chênh lệch nhỏ cộng với " +
          "may rủi tích luỹ là đã đủ. Đây là cùng một bài học với " +
          "<a href=\"#/schelling\">mô hình phân ly Schelling</a>: " +
          "<b>cơ chế vi mô và kết quả vĩ mô có thể chẳng liên quan gì tới nhau.</b>" +
          "<br><br>" +
          "Và cũng đừng đọc ngược: mô hình này <i>không</i> nói rằng bất bình đẳng ngoài đời " +
          "là tự nhiên hay không sửa được. Nó chỉ nói rằng <b>nhìn thấy kết quả không cho phép " +
          "suy ra nguyên nhân</b> — muốn biết nguyên nhân thì phải đi đo, như ba nút bấm ở trên."
      });
      r.trai.classList.add("co");

      requestAnimationFrame(function () { cv.doKichThuoc(); apDung(); });
    }
  });
})();
