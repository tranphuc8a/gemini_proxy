/* =====================================================================
   lab-grayscott.js — Phan ung khuech tan Gray-Scott.

   Hai chat U va V. V an U de tu nhan ban. Ca hai deu lan ra. U duoc bom
   vao, V bi rut di. Hai phuong trinh, hai con so — va tu do moc ra van
   da bao, van vo so, dau van tay, soc ngua van, cham con bo ruu.

   Alan Turing de xuat co che nay nam 1952, trong bai bao cuoi cung cua
   ong. Phai doi may tinh du manh, nguoi ta moi thay duoc ong dung.
   ===================================================================== */
(function () {
  "use strict";
  var V = window.VIS;

  var W = 220, H = 150;

  /* Nhung cap (f, k) noi tieng — moi cap mot the gioi khac han. */
  var MAU = {
    "phan-bao":   { f: 0.0367, k: 0.0649, ten: "Phân bào — chấm tự tách đôi mãi" },
    "san-ho":     { f: 0.0545, k: 0.0620, ten: "San hô — nhánh mọc và chia" },
    "van-tay":    { f: 0.0370, k: 0.0600, ten: "Vân tay — sọc uốn lượn" },
    "cham-tron":  { f: 0.0300, k: 0.0620, ten: "Chấm tròn — như da báo" },
    "song":       { f: 0.0140, k: 0.0450, ten: "Sóng — gợn lan ra rồi va nhau" },
    "hon-loan":   { f: 0.0260, k: 0.0510, ten: "Hỗn loạn — không bao giờ ổn định" },
    "giun":       { f: 0.0580, k: 0.0650, ten: "Giun — sợi dài bò quanh" },
    "bong-bong":  { f: 0.0980, k: 0.0570, ten: "Bong bóng" }
  };

  demo({
    id: "gray-scott",
    nhom: "Hệ động lực & hỗn loạn",
    mon: "L23",
    ten: "Phản ứng–khuếch tán — vân da báo mọc ra từ hai phương trình",
    moTa: "Hai chất khuếch tán và phản ứng với nhau. Không có bản thiết kế, không ai " +
          "bảo vết nào nằm ở đâu. Vậy mà ra vân da báo, vân vỏ sò, sọc ngựa vằn. " +
          "Alan Turing đề xuất cơ chế này năm <b>1952</b>, trong bài báo cuối đời.",

    dung: function (host) {
      var u = null, v = null, u2 = null, v2 = null;
      var oMau = null, L = null, P = null, Rnd = null;

      var TS = V.thamSo([
        { ma: "mau", ten: "Hình mẫu", kieu: "chon", gt: "phan-bao",
          muc: Object.keys(MAU).map(function (k) { return { v: k, t: MAU[k].ten }; }),
          moTa: "Mỗi lựa chọn chỉ đặt lại <b>hai con số</b> f và k bên dưới. " +
                "Tất cả khác biệt bạn thấy đều từ hai con số đó." },
        { ma: "f", ten: "f — tốc độ bơm U vào", kieu: "so",
          min: 0.005, max: 0.11, buoc: 0.0005, gt: 0.0367,
          moTa: "Kéo <b>rất chậm</b>. Đổi ở chữ số thứ ba là hình đã khác hẳn — " +
                "không gian tham số này chia thành từng ô nhỏ, ranh giới rất sắc." },
        { ma: "k", ten: "k — tốc độ rút V đi", kieu: "so",
          min: 0.03, max: 0.075, buoc: 0.0005, gt: 0.0649 },
        { ma: "du", ten: "Hệ số lan của U", kieu: "so", min: 0.1, max: 0.4, buoc: 0.01, gt: 0.21 },
        { ma: "dv", ten: "Hệ số lan của V", kieu: "so", min: 0.02, max: 0.2, buoc: 0.005, gt: 0.105,
          moTa: "Cốt lõi của cơ chế Turing: chất <b>ức chế lan nhanh hơn</b> chất kích " +
                "hoạt. Kéo hai hệ số này bằng nhau và xem hoa văn biến mất sạch." },
        { ma: "gieo", ten: "Kiểu gieo mầm", kieu: "chon", gt: "vai-cham", muc: [
          { v: "vai-cham",   t: "Vài chấm ở giữa" },
          { v: "ngau-nhien", t: "Nhiễu ngẫu nhiên khắp nơi" },
          { v: "mot-cham",   t: "Đúng một chấm" }
        ] },
        { ma: "hat", ten: "Hạt giống", kieu: "hat", gt: 4 }
      ], {
        doi: function (ma) {
          if (ma === "mau") {
            var m = MAU[G.mau];
            if (m) { TS.dat("f", m.f, true); TS.dat("k", m.k, true); }
          }
          apDung();
        },
        preset: Object.keys(MAU).slice(0, 6).map(function (k) {
          return { ten: MAU[k].ten.split(" — ")[0], gt: { mau: k, f: MAU[k].f, k: MAU[k].k } };
        })
      });

      var G = TS.gt;

      var cv = V.veBangCo({ rong: 880, tiLe: H / W, veLai: function () { if (P) apDung(); } });
      var g = cv.g;
      var S = V.soLieu();
      var ghiChu = V.el("div", { class: "chu-thich" });

      /* ============================================================
         Mo phong
         ============================================================ */
      function chuanBi() {
        u = new Float32Array(W * H);
        v = new Float32Array(W * H);
        u2 = new Float32Array(W * H);
        v2 = new Float32Array(W * H);
        oMau = new Uint8Array(W * H);
        Rnd = V.rng(Math.round(G.hat) || 1);

        for (var i = 0; i < W * H; i++) { u[i] = 1; v[i] = 0; }

        function chamTai(cx, cy, r) {
          for (var y = cy - r; y <= cy + r; y++) {
            for (var x = cx - r; x <= cx + r; x++) {
              if (x < 0 || y < 0 || x >= W || y >= H) continue;
              if ((x - cx) * (x - cx) + (y - cy) * (y - cy) > r * r) continue;
              u[y * W + x] = 0.5; v[y * W + x] = 0.25;
            }
          }
        }

        if (G.gieo === "mot-cham") {
          chamTai(W >> 1, H >> 1, 6);
        } else if (G.gieo === "ngau-nhien") {
          for (i = 0; i < W * H; i++) {
            if (Rnd() < 0.02) { u[i] = 0.5; v[i] = 0.25; }
          }
        } else {
          for (var n = 0; n < 5; n++) {
            chamTai((W >> 1) + Math.round((Rnd() - 0.5) * W * 0.4),
                    (H >> 1) + Math.round((Rnd() - 0.5) * H * 0.4),
                    4 + Math.round(Rnd() * 4));
          }
        }

        L = V.luoiO(cv, { cot: W, hang: H, le: 6, leTren: 22 });
        var bang = [];
        for (var c = 0; c < 64; c++) bang.push(V.thangMau(c / 63));
        L.bangMau(bang);
      }

      function motBuoc() {
        var f = G.f, k = G.k, dU = G.du, dV = G.dv;
        var i, x, y;
        for (y = 0; y < H; y++) {
          var tren = ((y - 1 + H) % H) * W, giua = y * W, duoi = ((y + 1) % H) * W;
          for (x = 0; x < W; x++) {
            /* Cot 0 va cot cuoi phai lay modulo de noi vong; phan giua thi
               khong — vong nay chay qua ca luoi moi buoc. */
            var t, p;
            if (x === 0) { t = W - 1; p = 1; }
            else if (x === W - 1) { t = W - 2; p = 0; }
            else { t = x - 1; p = x + 1; }

            i = giua + x;
            /* Laplace 9 diem (cac o cheo co trong so nho hon). */
            var lapU = u[tren + t] * 0.05 + u[tren + x] * 0.2 + u[tren + p] * 0.05 +
                       u[giua + t] * 0.2 + u[giua + x] * (-1) + u[giua + p] * 0.2 +
                       u[duoi + t] * 0.05 + u[duoi + x] * 0.2 + u[duoi + p] * 0.05;
            var lapV = v[tren + t] * 0.05 + v[tren + x] * 0.2 + v[tren + p] * 0.05 +
                       v[giua + t] * 0.2 + v[giua + x] * (-1) + v[giua + p] * 0.2 +
                       v[duoi + t] * 0.05 + v[duoi + x] * 0.2 + v[duoi + p] * 0.05;

            var uu = u[i], vv = v[i];
            var pu = uu * vv * vv;          /* U + 2V -> 3V */
            u2[i] = uu + (dU * lapU - pu + f * (1 - uu));
            v2[i] = vv + (dV * lapV + pu - (f + k) * vv);
            if (u2[i] < 0) u2[i] = 0; else if (u2[i] > 1) u2[i] = 1;
            if (v2[i] < 0) v2[i] = 0; else if (v2[i] > 1) v2[i] = 1;
          }
        }
        var tam;
        tam = u; u = u2; u2 = tam;
        tam = v; v = v2; v2 = tam;
        return true;
      }

      /* ============================================================
         Ve
         ============================================================ */
      function ve(kb) {
        g.clearRect(0, 0, cv.W, cv.H);
        g.fillStyle = V.mau("surf");
        g.fillRect(0, 0, cv.W, cv.H);

        var dinh = 0, i;
        for (i = 0; i < v.length; i += 5) if (v[i] > dinh) dinh = v[i];
        var chia = Math.max(0.05, dinh);
        var tongV = 0;
        for (i = 0; i < v.length; i++) {
          var t = v[i] / chia;
          if (t > 1) t = 1;
          tongV += v[i];
          oMau[i] = (t * 63) | 0;
        }
        L.tuMang(oMau);
        L.dan();
        L.vien();

        g.fillStyle = V.mau("tx3");
        g.font = "11px ui-monospace,monospace";
        g.textAlign = "left"; g.textBaseline = "top";
        g.fillText("f = " + G.f.toFixed(4) + "   k = " + G.k.toFixed(4) +
                   "   ·   lưới " + W + "×" + H, 8, 5);

        var m = MAU[G.mau];
        var khopMau = m && Math.abs(m.f - G.f) < 1e-6 && Math.abs(m.k - G.k) < 1e-6;
        S.dat({
          "Hình mẫu": khopMau ? m.ten : "tự chỉnh (f, k)",
          "f (bơm U)": G.f.toFixed(4),
          "k (rút V)": G.k.toFixed(4),
          "Lan U / lan V": G.du.toFixed(2) + " / " + G.dv.toFixed(3) +
            "  (tỉ lệ " + (G.du / G.dv).toFixed(2) + "×)",
          "Bước": kb.toLocaleString("vi"),
          "Lượng V trung bình": (tongV / v.length).toFixed(4),
          "Trạng thái": tongV / v.length < 0.002
            ? "V đã tắt hẳn — không có hoa văn"
            : (G.du / G.dv < 1.2 ? "hai chất lan gần bằng nhau — cơ chế Turing yếu"
                                 : "đang tạo hoa văn")
        });
      }

      /* ============================================================
         Dieu phoi
         ============================================================ */
      function apDung() {
        if (!cv.W) return;
        chuanBi();
        P.datToiDa(30000);
        P.datTocDo(40);
        ghiChu.innerHTML = "";
        [[V.thangMau(0), "không có V"], [V.thangMau(0.5), "V vừa"],
         [V.thangMau(1), "V đậm"]].forEach(function (c) {
          ghiChu.appendChild(V.el("span", {}, [
            V.el("i", { class: "o-mau", style: "background:" + c[0] }), c[1]
          ]));
        });
        P.datLai();
      }

      P = V.phat({
        ten: "gray-scott",
        bang: cv,
        tocDo: 40,
        buoc: function () { return motBuoc(); },
        datLai: function () { chuanBi(); },
        ve: ve,
        nhan: function (k) { return "bước " + k.toLocaleString("vi"); }
      });

      var r = V.khung(host, {
        ten: "gray-scott",
        bang: cv,
        ve: [cv, ghiChu],
        dieuKhien: [P.dk(), TS.dk(), S.el],
        giaiThich:
          "<b>Hai chất, hai phương trình:</b>" +
          "<ul>" +
          "<li><code>U + 2V → 3V</code> — chất V “ăn” U để tự nhân bản. Càng nhiều V thì " +
          "càng sinh nhanh: đây là vòng <b>tự xúc tác</b>.</li>" +
          "<li>U được <b>bơm vào</b> với tốc độ <code>f</code>; V bị <b>rút đi</b> với tốc " +
          "độ <code>f + k</code>. Cả hai cùng <b>khuếch tán</b>.</li>" +
          "</ul>" +
          "Hết. Không có bản thiết kế, không ai bảo vết nào nằm ở đâu, không có chỗ nào " +
          "trong mã nói “vẽ hình chấm tròn”." +
          "<ul>" +
          "<li><b>Điều Turing nhận ra năm 1952:</b> hoa văn xuất hiện được là nhờ chất ức " +
          "chế <b>lan nhanh hơn</b> chất kích hoạt. Kích hoạt tự nhân lên tại chỗ, ức chế " +
          "lan ra xa chặn không cho vết lan tiếp — và ta được một <i>vết</i> có kích thước " +
          "xác định. Kéo <b>hệ số lan của V</b> lên bằng U và xem hoa văn tan hết.</li>" +
          "<li><b>Đổi hình mẫu</b> chỉ là đặt lại <b>hai con số</b> f và k. Vậy mà một cái " +
          "cho chấm tự tách đôi mãi mãi, một cái cho sợi giun bò quanh, một cái cho sóng lan. " +
          "Kéo f hoặc k thật chậm ở chữ số thứ ba: ranh giới giữa các thế giới <b>sắc</b> " +
          "chứ không mờ dần.</li>" +
          "<li><b>Chọn “Hỗn loạn”</b> rồi để chạy thật lâu: nó không bao giờ đứng yên và " +
          "cũng không lặp lại. Vừa có cấu trúc, vừa không đoán trước được.</li>" +
          "<li><b>Turing không sống để thấy điều này.</b> Bài báo <i>The Chemical Basis of " +
          "Morphogenesis</i> ra năm 1952, ông mất năm 1954. Phải tới thập niên 1990 người " +
          "ta mới quan sát được vân Turing trong phản ứng hoá học thật, và tới 2012 mới " +
          "chứng minh được cơ chế này quyết định khoảng cách giữa các nếp trên vòm miệng chuột.</li>" +
          "</ul>"
      });
      r.trai.classList.add("co");

      requestAnimationFrame(function () { cv.doKichThuoc(); apDung(); });
    }
  });
})();
