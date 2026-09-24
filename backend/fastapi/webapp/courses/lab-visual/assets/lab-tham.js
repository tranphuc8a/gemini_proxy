/* =====================================================================
   lab-tham.js — Bai toan tham (percolation) va nguong toi han.

   Mo tung o mot cach ngau nhien. Rat lau khong co gi xay ra. Roi o quanh
   p = 0,5927 mot cum khong lo dot ngot noi tu bo tren xuong bo duoi. Do
   la chuyen pha — va no sac net den muc kho tin.
   ===================================================================== */
(function () {
  "use strict";
  var V = window.VIS;

  /* Nguong tham theo o tren luoi vuong. Khong co cong thuc kin; con so nay
     la ket qua mo phong do chinh xac cao cua nhieu nhom doc lap. */
  var P_C = 0.59274605;

  demo({
    id: "tham",
    nhom: "Tự động tế bào",
    mon: "L10",
    ten: "Thấm — chuyện gì xảy ra đúng tại 59,27%",
    moTa: "Mở ngẫu nhiên từng ô một. Cụm lớn nhất lớn dần, chậm rãi, chẳng có gì thú vị. " +
          "Rồi <b>đột ngột</b>, trong khoảng vài phần trăm, một cụm khổng lồ nối từ bờ trên " +
          "xuống bờ dưới. Ngưỡng đó là <b>0,5927</b> — và chưa ai tìm được công thức cho nó.",

    dung: function (host) {
      var N = 100;
      var mo = null;                 /* Uint8Array: o da mo chua */
      var cha = null, cao = null;    /* union-find */
      var thuTu = null;              /* thu tu mo o */
      var to = null;                 /* mang chi so mau de ve */
      var chamTren = null, chamDuoi = null;   /* co cua tung GOC cum */
      var soMo = 0, cumLonNhat = 0, gocLonNhat = -1, pThau = -1;
      var lichSu = [], ghiTiep = 1;
      var L = null, B = null, P = null;

      var TS = V.thamSo([
        { ma: "kichThuoc", ten: "Cạnh lưới", kieu: "so", min: 40, max: 220, buoc: 10, gt: 100,
          moTa: "Lưới càng lớn, bước nhảy tại ngưỡng càng dốc — đó là dấu hiệu của " +
                "một <b>chuyển pha thật</b> chứ không phải hiệu ứng cỡ mẫu." },
        { ma: "hat", ten: "Hạt giống", kieu: "hat", gt: 4 },
        { ma: "toCum", ten: "Tô riêng cụm lớn nhất", kieu: "bat", gt: true }
      ], {
        doi: function () { apDung(); },
        preset: [
          { ten: "Lưới 60 (nhảy mờ)",   gt: { kichThuoc: 60 } },
          { ten: "Lưới 100",            gt: { kichThuoc: 100 } },
          { ten: "Lưới 220 (nhảy sắc)", gt: { kichThuoc: 220 } }
        ]
      });

      var G = TS.gt;

      var cv = V.veBangCo({ rong: 860, tiLe: 0.9, veLai: function () { if (P) apDung(); } });
      var g = cv.g;
      var S = V.soLieu();
      var ghiChu = V.el("div", { class: "chu-thich" });

      /* ============================================================
         Union-find
         ============================================================ */
      function tim(x) {
        while (cha[x] !== x) {
          cha[x] = cha[cha[x]];       /* nen duong di mot nua */
          x = cha[x];
        }
        return x;
      }
      /* Khong dung nut ao cho bo tren/bo duoi: mot nut ao noi TAT CA cum
         cham bo tren lam mot, nen "cum lon nhat" se bi thoi phong. Thay vao
         do moi goc mang hai co, hop lai khi gop cum. */
      function hop(a, b) {
        a = tim(a); b = tim(b);
        if (a === b) return;
        if (cao[a] < cao[b]) { var t = a; a = b; b = t; }
        cha[b] = a;
        cao[a] += cao[b];             /* cao[] giu luon KICH CO cum */
        chamTren[a] |= chamTren[b];
        chamDuoi[a] |= chamDuoi[b];
      }

      /* ============================================================
         Mo phong
         ============================================================ */
      function chuanBi() {
        N = Math.round(G.kichThuoc);
        var n = N * N;

        mo = new Uint8Array(n);
        to = new Uint8Array(n);
        cha = new Int32Array(n);
        cao = new Int32Array(n);
        chamTren = new Uint8Array(n);
        chamDuoi = new Uint8Array(n);
        for (var i = 0; i < n; i++) { cha[i] = i; cao[i] = 1; }

        var R = V.rng(Math.round(G.hat) || 1);
        thuTu = new Int32Array(n);
        for (i = 0; i < n; i++) thuTu[i] = i;
        for (i = n - 1; i > 0; i--) {        /* xao Fisher-Yates */
          var j = Math.floor(R() * (i + 1));
          var t = thuTu[i]; thuTu[i] = thuTu[j]; thuTu[j] = t;
        }

        soMo = 0; cumLonNhat = 0; gocLonNhat = -1; pThau = -1;
        lichSu = []; ghiTiep = 1;

        var chiaY = Math.round(cv.H * 0.72);
        L = V.luoiO(cv, { cot: N, hang: N, le: 10, leTren: 24,
                          leDuoi: cv.H - chiaY + 10 });
        L.bangMau([V.mau("bg2"), V.mau("bd"), V.mau("ac")]);
        B = V.bieuDo(cv, {
          le: { t: chiaY + 34, r: 18, b: 30, l: 60 },
          x: { min: 0, max: 1, nhan: "p — tỉ lệ ô đã mở", vach: 5,
               dinhDang: function (v) { return v.toFixed(2); } },
          y: { min: 0, max: 1, nhan: "cụm lớn nhất / tổng ô",
               dinhDang: function (v) { return v.toFixed(2); } },
          luoi: 2
        });
      }

      function moMotO(k) {
        if (k >= N * N) return false;
        var i = thuTu[k];
        mo[i] = 1;
        soMo++;
        var c = i % N, r = (i / N) | 0;

        if (r === 0) chamTren[i] = 1;
        if (r === N - 1) chamDuoi[i] = 1;
        if (c > 0 && mo[i - 1]) hop(i, i - 1);
        if (c < N - 1 && mo[i + 1]) hop(i, i + 1);
        if (r > 0 && mo[i - N]) hop(i, i - N);
        if (r < N - 1 && mo[i + N]) hop(i, i + N);

        var g2 = tim(i);
        if (cao[g2] > cumLonNhat) { cumLonNhat = cao[g2]; gocLonNhat = g2; }

        /* Thau khi CUNG mot cum vua cham bo tren vua cham bo duoi. */
        if (pThau < 0 && chamTren[g2] && chamDuoi[g2]) pThau = soMo / (N * N);

        if (soMo >= ghiTiep) {
          lichSu.push([soMo / (N * N), cumLonNhat / (N * N)]);
          ghiTiep = soMo + Math.max(1, Math.round(N * N / 400));
        }
        return true;
      }

      /* ============================================================
         Ve
         ============================================================ */
      function ve() {
        g.clearRect(0, 0, cv.W, cv.H);
        g.fillStyle = V.mau("surf");
        g.fillRect(0, 0, cv.W, cv.H);

        var n = N * N, i;
        if (G.toCum && cumLonNhat > 1 && gocLonNhat >= 0) {
          /* gocLonNhat co the da bi gop vao mot goc khac tu luc ghi lai. */
          var gocTo = tim(gocLonNhat);
          for (i = 0; i < n; i++) {
            to[i] = !mo[i] ? 0 : (tim(i) === gocTo ? 2 : 1);
          }
        } else {
          for (i = 0; i < n; i++) to[i] = mo[i] ? 1 : 0;
        }
        L.tuMang(to);
        L.dan();
        L.vien();

        var p = soMo / n;
        g.fillStyle = V.mau("tx3");
        g.font = "11px ui-monospace,monospace";
        g.textAlign = "left"; g.textBaseline = "top";
        g.fillText("p = " + p.toFixed(4) + "   lưới " + N + "×" + N, 10, 6);

        B.truc();
        /* vach doc tai nguong ly thuyet */
        g.save();
        g.strokeStyle = V.mau("ok"); g.lineWidth = 1.4; g.setLineDash([4, 3]);
        g.beginPath();
        g.moveTo(B.px(P_C), B.y0()); g.lineTo(B.px(P_C), B.y1());
        g.stroke();
        g.setLineDash([]);
        g.fillStyle = V.mau("ok");
        g.font = "11px ui-monospace,monospace";
        g.textAlign = "left"; g.textBaseline = "top";
        g.fillText(" p_c = 0,5927", B.px(P_C), B.y0() + 2);
        g.restore();
        B.duong(lichSu, V.mau("ac"), 2);
        if (lichSu.length) {
          B.diem(p, cumLonNhat / n, V.mau("ac2"), 3.5);
        }

        S.dat({
          "Ô đã mở": soMo.toLocaleString("vi") + " / " + n.toLocaleString("vi"),
          "p hiện tại": p.toFixed(4),
          "Cụm lớn nhất": cumLonNhat.toLocaleString("vi") +
                          "  (" + (cumLonNhat / n * 100).toFixed(1) + "% lưới)",
          "Đã thấu từ trên xuống dưới": pThau >= 0 ? ("có, tại p = " + pThau.toFixed(4)) : "chưa",
          "Ngưỡng lý thuyết p_c": "0,592746",
          "Sai lệch": pThau >= 0 ? (Math.abs(pThau - P_C)).toFixed(4) : "—"
        });
      }

      /* ============================================================
         Dieu phoi
         ============================================================ */
      function apDung() {
        if (!cv.W) return;
        chuanBi();
        P.datToiDa(N * N);
        P.datTocDo(1500);
        ghiChu.innerHTML = "";
        [[V.mau("bg2"), "ô đóng"], [V.mau("bd"), "ô mở"],
         [V.mau("ac"), "cụm lớn nhất"], [V.mau("ok"), "ngưỡng lý thuyết"]].forEach(function (c) {
          ghiChu.appendChild(V.el("span", {}, [
            V.el("i", { class: "o-mau", style: "background:" + c[0] }), c[1]
          ]));
        });
        P.datLai();
      }

      P = V.phat({
        ten: "tham",
        bang: cv,
        tocDo: 1500,
        buoc: function (k) { return moMotO(k); },
        datLai: function () { chuanBi(); },
        ve: ve,
        nhan: function () {
          var p = soMo / (N * N);
          return "p = " + p.toFixed(3) +
                 (pThau >= 0 ? "  · đã thấu" : "  · chưa thấu");
        }
      });

      var r = V.khung(host, {
        ten: "tham",
        bang: cv,
        ve: [cv, ghiChu],
        dieuKhien: [P.dk(), TS.dk(), S.el],
        giaiThich:
          "<b>Bài toán:</b> mỗi ô của lưới độc lập được “mở” với xác suất <code>p</code>. " +
          "Hai ô mở kề nhau thì thông nhau. Câu hỏi: khi nào có một dòng chảy từ <b>bờ trên " +
          "xuống bờ dưới</b>? Ở đây ta mở dần từng ô, nên <code>p</code> tăng đều từ 0 tới 1." +
          "<ul>" +
          "<li><b>Điều bất ngờ là nó SẮC.</b> Với p = 0,55 gần như chắc chắn không thấu; " +
          "với p = 0,63 gần như chắc chắn thấu. Toàn bộ câu chuyện xảy ra trong một khoảng " +
          "vài phần trăm. Tăng cạnh lưới lên 220 rồi so với 60: lưới càng lớn, bước nhảy càng " +
          "<b>dốc đứng</b> — đó chính là định nghĩa của một chuyển pha.</li>" +
          "<li><b>p_c = 0,592746…</b> Không ai có công thức kín cho con số này trên lưới vuông. " +
          "Nó chỉ được biết qua mô phỏng. (Trên lưới tam giác thì lại đúng bằng 1/2, chứng minh " +
          "được — hình dạng lưới quyết định tất cả.)</li>" +
          "<li><b>Cụm lớn nhất</b> trước ngưỡng thì bé và rời rạc; qua ngưỡng nó nuốt gần hết " +
          "phần đã mở. Đường cong dưới hình chính là <i>tham số trật tự</i> của chuyển pha này.</li>" +
          "<li><b>Vì sao quan trọng:</b> cùng một toán học mô tả cháy rừng lan hay tắt, dịch bùng " +
          "hay lụi, dầu chảy qua đá, mạng điện sập dây chuyền, và độ dẫn của vật liệu composite. " +
          "Đâu cũng có một ngưỡng, và quanh ngưỡng thì hệ <b>cực kỳ nhạy</b>.</li>" +
          "</ul>"
      });
      r.trai.classList.add("co");

      requestAnimationFrame(function () { cv.doKichThuoc(); apDung(); });
    }
  });
})();
