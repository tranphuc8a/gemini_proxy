/* =====================================================================
   lab-bamnhatquan.js — Bam nhat quan (consistent hashing).

   Cau hoi: ban co N may chu va hang trieu khoa. Them mot may thu N+1.
   BAO NHIEU KHOA PHAI CHUYEN CHO?

   Voi `bam % N` thi cau tra loi la: gan het. Voi bam nhat quan: khoang
   1/N. Do la toan bo ly do thu nay ton tai — va no la nen mong cua
   memcached, Cassandra, DynamoDB, CDN.
   ===================================================================== */
(function () {
  "use strict";
  var V = window.VIS;

  /* Bam so nguyen 32 bit (splitmix32). Tat dinh, trai deu — hai tinh chat
     duy nhat ma so do vong nay can. */
  function bam32(x) {
    x = (x + 0x9e3779b9) | 0;
    x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
    x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
    return (x ^ (x >>> 15)) >>> 0;
  }
  var HAI_MU_32 = 4294967296;

  demo({
    id: "bam-nhat-quan",
    nhom: "Mạng lưới & phân tán",
    mon: "L18",
    ten: "Băm nhất quán — thêm một máy chủ, bao nhiêu khoá phải chuyển?",
    moTa: "Bạn có N máy chủ và hàng triệu khoá. Thêm một máy nữa. Với cách làm hiển " +
          "nhiên <code>băm % N</code>, <b>gần như toàn bộ</b> khoá phải chuyển chỗ — " +
          "cache trống rỗng, cơ sở dữ liệu sập. Băm nhất quán hạ con số đó xuống " +
          "khoảng <b>1/N</b>. Đổi chế độ và xem hai con số cạnh nhau.",

    dung: function (host) {
      var soNode = 6, soAo = 40, soKhoa = 3000;
      var viTriAo = null;       /* vi tri tren vong cua tung nut ao, da sap */
      var chuAo = null;         /* nut ao thu i thuoc may chu nao */
      var chuCua = null;        /* khoa i thuoc may chu nao (N may) */
      var chuCuaBot = null;     /* ... khi da bo mot may */
      var tai = null, soChuyen = 0;
      var DT = null, B = null, P = null;

      var TS = V.thamSo([
        { ma: "che", ten: "Cách phân khoá", kieu: "chon", gt: "nhat-quan", muc: [
          { v: "nhat-quan", t: "① Băm nhất quán (vòng tròn)" },
          { v: "chia-du",   t: "② băm % N — cách hiển nhiên" }
        ] },
        { ma: "soMay", ten: "Số máy chủ", kieu: "so", min: 2, max: 16, buoc: 1, gt: 6 },
        { ma: "soAo", ten: "Số bản sao ảo mỗi máy", kieu: "so", min: 1, max: 300, buoc: 1, gt: 40,
          moTa: "Đây là mẹo quyết định. Với <b>1</b> bản sao, tải lệch kinh khủng. " +
                "Kéo lên <b>100+</b> để thấy tải đều dần ra — mà số khoá phải chuyển " +
                "thì <i>không</i> tăng theo.",
          hien: function (g) { return g.che === "nhat-quan"; } },
        { ma: "soKhoa", ten: "Số khoá", kieu: "so", min: 300, max: 20000, buoc: 100, gt: 3000 },
        { ma: "veKhoa", ten: "Vẽ từng khoá trên vòng", kieu: "bat", gt: true,
          hien: function (g) { return g.che === "nhat-quan"; } }
      ], {
        doi: function () { apDung(); },
        preset: [
          { ten: "Nhất quán, 40 bản ảo", gt: { che: "nhat-quan", soMay: 6, soAo: 40 } },
          { ten: "Chỉ 1 bản ảo — tải lệch", gt: { che: "nhat-quan", soMay: 6, soAo: 1 } },
          { ten: "200 bản ảo — tải đều",  gt: { che: "nhat-quan", soMay: 6, soAo: 200 } },
          { ten: "băm % N — thảm hoạ",    gt: { che: "chia-du", soMay: 6 } },
          { ten: "16 máy, nhất quán",     gt: { che: "nhat-quan", soMay: 16, soAo: 100 } }
        ]
      });

      var G = TS.gt;

      var cv = V.veBangCo({ rong: 880, tiLe: 0.88, veLai: function () { if (P) apDung(); } });
      var g = cv.g;
      var S = V.soLieu();
      var ghiChu = V.el("div", { class: "chu-thich" });

      /* ============================================================
         Phan khoa
         ============================================================ */
      function dungVongAo(soMay) {
        var ds = [];
        for (var m = 0; m < soMay; m++) {
          for (var v = 0; v < Math.round(G.soAo); v++) {
            /* Tron chi so may voi chi so ban sao de moi ban sao roi mot cho. */
            ds.push([bam32(m * 100003 + v * 7919) / HAI_MU_32, m]);
          }
        }
        ds.sort(function (a, b) { return a[0] - b[0]; });
        viTriAo = new Float64Array(ds.length);
        chuAo = new Int32Array(ds.length);
        for (var i = 0; i < ds.length; i++) { viTriAo[i] = ds[i][0]; chuAo[i] = ds[i][1]; }
      }

      /** Khoa thuoc ve ban sao ao DAU TIEN nam sau no tren vong. */
      function timChu(vt) {
        var lo = 0, hi = viTriAo.length - 1;
        if (vt > viTriAo[hi]) return chuAo[0];        /* vong lai dau */
        while (lo < hi) {
          var giua = (lo + hi) >> 1;
          if (viTriAo[giua] < vt) lo = giua + 1; else hi = giua;
        }
        return chuAo[lo];
      }

      function chuCuaKhoa(k, soMay) {
        if (G.che === "chia-du") return bam32(k) % soMay;
        return timChu(bam32(k) / HAI_MU_32);
      }

      function chuanBi() {
        soNode = Math.round(G.soMay);
        soKhoa = Math.round(G.soKhoa);
        chuCua = new Int32Array(soKhoa);
        chuCuaBot = new Int32Array(soKhoa);
        tai = new Int32Array(soNode);
        soChuyen = 0;

        /* Hai the gioi song song: N may, va N-1 may (da bo may cuoi).
           So sanh hai the gioi do cho ra con so duy nhat dang quan tam. */
        if (G.che === "nhat-quan") dungVongAo(soNode);
        for (var i = 0; i < soKhoa; i++) chuCua[i] = chuCuaKhoa(i, soNode);

        if (G.che === "nhat-quan") dungVongAo(soNode - 1);
        for (i = 0; i < soKhoa; i++) chuCuaBot[i] = chuCuaKhoa(i, soNode - 1);
        if (G.che === "nhat-quan") dungVongAo(soNode);   /* tra lai vong that */

        for (i = 0; i < soKhoa; i++) if (chuCua[i] !== chuCuaBot[i]) soChuyen++;

        DT = V.doThi(cv, { soToiDa: 1, le: 14, leTren: 26,
                           leDuoi: Math.round(cv.H * 0.32) });
        B = V.bieuDo(cv, {
          le: { t: Math.round(cv.H * 0.70) + 28, r: 18, b: 30, l: 60 },
          x: { min: 0, max: soNode, nhan: "máy chủ", vach: Math.min(8, soNode),
               dinhDang: function (v) { return "#" + Math.round(v); } },
          y: { min: 0, max: 1, nhan: "số khoá", dinhDang: V.soGon },
          luoi: 2
        });
      }

      function datKhoa(k) {
        if (k >= soKhoa) return false;
        tai[chuCua[k]]++;
        return true;
      }

      /* ============================================================
         Ve
         ============================================================ */
      function mauMay(m) {
        return V.thangMau(soNode > 1 ? (m / (soNode - 1)) * 0.85 + 0.1 : 0.5);
      }

      function ve(k) {
        g.clearRect(0, 0, cv.W, cv.H);
        g.fillStyle = V.mau("surf");
        g.fillRect(0, 0, cv.W, cv.H);

        var f = DT.khung();
        var cx = f.x0 + f.canh / 2, cy = f.y0 + f.canh / 2;
        var bk = f.canh * 0.40;

        if (G.che === "nhat-quan") {
          /* --- vong bam --- */
          g.save();
          g.strokeStyle = V.mau("bd2");
          g.lineWidth = Math.max(10, bk * 0.10);
          g.beginPath(); g.arc(cx, cy, bk, 0, 6.2832); g.stroke();
          g.restore();

          /* cung ma moi may so huu: to mau tung doan giua hai ban sao ao */
          g.save();
          g.lineWidth = Math.max(10, bk * 0.10);
          for (var i = 0; i < viTriAo.length; i++) {
            var a0 = (i === 0 ? viTriAo[viTriAo.length - 1] - 1 : viTriAo[i - 1]);
            var a1 = viTriAo[i];
            g.strokeStyle = mauMay(chuAo[i]);
            g.beginPath();
            g.arc(cx, cy, bk, a0 * 6.2832 - Math.PI / 2, a1 * 6.2832 - Math.PI / 2);
            g.stroke();
          }
          g.restore();

          /* khoa da dat */
          if (G.veKhoa) {
            g.save();
            g.globalAlpha = 0.75;
            for (i = 0; i < k && i < soKhoa; i++) {
              var t = bam32(i) / HAI_MU_32 * 6.2832 - Math.PI / 2;
              var rr = bk * 0.80;
              g.fillStyle = mauMay(chuCua[i]);
              g.fillRect(cx + Math.cos(t) * rr - 1, cy + Math.sin(t) * rr - 1, 2.2, 2.2);
            }
            g.restore();
          }

          /* danh dau may bi bo, de thay khoa cua no di dau */
          var aCuoi = 0;
          for (i = 0; i < viTriAo.length; i++) if (chuAo[i] === soNode - 1) { aCuoi = viTriAo[i]; break; }
          g.save();
          g.strokeStyle = V.mau("loi"); g.lineWidth = 2; g.setLineDash([4, 3]);
          g.beginPath();
          g.moveTo(cx, cy);
          g.lineTo(cx + Math.cos(aCuoi * 6.2832 - Math.PI / 2) * bk * 1.12,
                   cy + Math.sin(aCuoi * 6.2832 - Math.PI / 2) * bk * 1.12);
          g.stroke();
          g.setLineDash([]);
          g.restore();
        } else {
          /* --- che do chia du: ve bang khoa -> may --- */
          g.fillStyle = V.mau("tx3");
          g.font = "12px system-ui,sans-serif";
          g.textAlign = "center"; g.textBaseline = "middle";
          g.fillText("băm(khoá) % " + soNode + " — không có vòng, chỉ có phép chia dư",
                     cx, f.y0 + 16);
          var cot = Math.min(120, Math.ceil(Math.sqrt(Math.min(k, 3000) * 1.6)));
          var oCanh = Math.min(f.canh / cot, (f.canh - 40) / Math.ceil(Math.min(k, 3000) / cot));
          for (i = 0; i < k && i < 3000; i++) {
            var c = i % cot, r2 = (i / cot) | 0;
            g.fillStyle = mauMay(chuCua[i]);
            g.fillRect(f.x0 + c * oCanh, f.y0 + 34 + r2 * oCanh,
                       Math.max(1, oCanh - 1), Math.max(1, oCanh - 1));
          }
        }

        /* --- bieu do tai --- */
        var caoNhat = 1;
        for (i = 0; i < soNode; i++) if (tai[i] > caoNhat) caoNhat = tai[i];
        B.dat({ x: { min: 0, max: soNode, nhan: "máy chủ", vach: Math.min(8, soNode),
                     dinhDang: function (v) { return "#" + Math.round(v); } },
                y: { min: 0, max: caoNhat * 1.15, nhan: "số khoá", dinhDang: V.soGon } });
        B.truc();
        for (i = 0; i < soNode; i++) B.cot(i + 0.5, tai[i], 1, mauMay(i));
        if (k > 0) B.moc(k / soNode, V.mau("ok"), "chia đều tuyệt đối");

        /* --- so lieu --- */
        var nho = Infinity, lon = 0;
        for (i = 0; i < soNode; i++) { if (tai[i] < nho) nho = tai[i]; if (tai[i] > lon) lon = tai[i]; }
        var lyThuyet = G.che === "nhat-quan" ? (1 / soNode) : ((soNode - 1) / soNode);
        S.dat({
          "Cách phân khoá": G.che === "nhat-quan" ? "băm nhất quán" : "băm % N",
          "Số máy chủ": soNode,
          "Khoá đã đặt": k.toLocaleString("vi") + " / " + soKhoa.toLocaleString("vi"),
          "Tải thấp nhất / cao nhất": nho === Infinity ? "—" : (nho + " / " + lon),
          "Lệch tải": lon > 0 ? ((lon - nho) / (k / soNode || 1) * 100).toFixed(0) + "%" : "—",
          "⚑ Bỏ 1 máy → phải chuyển": soChuyen.toLocaleString("vi") + " khoá  (" +
            (soChuyen / soKhoa * 100).toFixed(1) + "%)",
          "Lý thuyết": (lyThuyet * 100).toFixed(1) + "%" +
            (G.che === "nhat-quan" ? "  (= 1/N)" : "  (= (N−1)/N)")
        });
      }

      /* ============================================================
         Dieu phoi
         ============================================================ */
      function apDung() {
        if (!cv.W) return;
        chuanBi();
        P.datToiDa(soKhoa);
        P.datTocDo(2000);
        ghiChu.innerHTML = "";
        for (var m = 0; m < Math.min(soNode, 8); m++) {
          ghiChu.appendChild(V.el("span", {}, [
            V.el("i", { class: "o-mau", style: "background:" + mauMay(m) }), "máy #" + m
          ]));
        }
        if (G.che === "nhat-quan") {
          ghiChu.appendChild(V.el("span", {}, [
            V.el("i", { class: "o-mau", style: "background:" + V.mau("loi") }),
            "một bản sao của máy sắp bị bỏ"
          ]));
        }
        P.datLai();
      }

      P = V.phat({
        ten: "bam-nhat-quan",
        bang: cv,
        tocDo: 2000,
        buoc: function (k) { return datKhoa(k); },
        datLai: function () {
          if (tai) for (var i = 0; i < tai.length; i++) tai[i] = 0;
        },
        ve: ve,
        nhan: function (k) {
          return k.toLocaleString("vi") + " khoá · bỏ 1 máy phải chuyển " +
                 (soChuyen / soKhoa * 100).toFixed(1) + "%";
        }
      });

      var r = V.khung(host, {
        ten: "bam-nhat-quan",
        bang: cv,
        ve: [cv, ghiChu],
        dieuKhien: [P.dk(), TS.dk(), S.el],
        giaiThich:
          "<b>Bài toán:</b> phân hàng triệu khoá lên N máy chủ, sao cho ai cũng tính được " +
          "khoá nào ở máy nào mà không cần hỏi ai." +
          "<ul>" +
          "<li><b>Cách hiển nhiên:</b> <code>máy = băm(khoá) % N</code>. Chia tải rất đều. " +
          "Nhưng đổi N thì <b>mọi số dư đều đổi</b>: đi từ 6 máy xuống 5, khoảng " +
          "<b>(N−1)/N ≈ 83%</b> số khoá đổi chủ. Với cache nghĩa là gần như toàn bộ cache " +
          "hỏng cùng lúc, và toàn bộ lưu lượng đổ thẳng vào cơ sở dữ liệu. Đây là cách " +
          "người ta làm sập hệ thống của chính mình khi thêm máy để... chống quá tải.</li>" +
          "<li><b>Băm nhất quán:</b> xếp cả khoá lẫn máy lên <b>một vòng tròn</b>. Khoá thuộc " +
          "về máy đầu tiên gặp khi đi theo chiều kim đồng hồ. Bỏ một máy thì chỉ khoá của " +
          "<i>riêng cung đó</i> phải chuyển sang máy kế tiếp — khoảng <b>1/N</b>. Đổi chế độ " +
          "qua lại và so hai con số ⚑ trong bảng.</li>" +
          "<li><b>Bản sao ảo là mẹo bắt buộc.</b> Đặt <b>1 bản ảo</b>: mỗi máy chiếm đúng một " +
          "cung, mà các cung thì dài ngắn ngẫu nhiên — tải lệch tới vài trăm phần trăm. Kéo " +
          "lên <b>100–200</b>: mỗi máy rải thành hàng trăm cung nhỏ khắp vòng, luật số lớn " +
          "làm phần việc còn lại và tải đều ra. <b>Số khoá phải chuyển không tăng theo</b> — " +
          "đó là chỗ mẹo này ăn tiền.</li>" +
          "<li><b>Dùng ở đâu:</b> memcached (nơi ý tưởng ra đời năm 1997), Amazon Dynamo và " +
          "DynamoDB, Cassandra, Riak, và gần như mọi CDN khi chọn máy chủ biên.</li>" +
          "</ul>"
      });
      r.trai.classList.add("co");

      requestAnimationFrame(function () { cv.doKichThuoc(); apDung(); });
    }
  });
})();
