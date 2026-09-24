/* =====================================================================
   lab-kien.js — Kien Langton va ho turmite.

   Mot con kien, hai quy tac: o trang thi re phai, o den thi re trai; doi
   mau o roi buoc toi. Chay khoang 10 000 buoc hon don hoan toan, roi dot
   ngot xay mot "duong cao toc" tuan hoan chu ky 104 va di mai mai.
   ===================================================================== */
(function () {
  "use strict";
  var V = window.VIS;

  /* Buoc ma kien Langton chuan bat dau xay duong cao toc — con so nay
     doc lap voi ma o day, dung de doi chieu. */
  var BUOC_CAO_TOC = 9977;

  var LUAT_MAU = {
    "RL":            "Kiến Langton gốc — hỗn loạn rồi xây đường cao tốc",
    "RLR":           "mọc thành hình tam giác lộn xộn",
    "LLRR":          "hoa văn đối xứng, nở dần đều",
    "LRRRRRLLR":     "xây một hình vuông có viền",
    "LLRRRLRLRLLR":  "mọc thành đường tròn xoắn",
    "RRLLLRLLLRRR":  "hoa văn hình vuông đặc"
  };

  demo({
    id: "kien-langton",
    nhom: "Tự động tế bào",
    mon: "L12",
    ten: "Kiến Langton — 10 000 bước hỗn loạn rồi bất ngờ có trật tự",
    moTa: "Một con kiến. Hai quy tắc. Ô trắng thì rẽ phải, ô đen thì rẽ trái, đổi màu ô " +
          "rồi bước tới. Trong khoảng <b>10 000 bước đầu</b> nó bò loạn không ra hình thù gì. " +
          "Rồi <b>đột nhiên</b> nó bắt đầu xây một “đường cao tốc” lặp lại chu kỳ 104 " +
          "và đi thẳng mãi mãi. Chưa ai chứng minh được vì sao.",

    dung: function (host) {
      var N = 160;
      var o = null;                  /* mau tung o, 0..soMau-1 */
      var L = null, P = null;
      var kx = 0, ky = 0, kh = 0;    /* toa do + huong kien (0=len,1=phai,2=xuong,3=trai) */
      var luat = "RL";
      var soDen = 0, raNgoai = false, caoTocTu = -1;
      var lichSuHop = [];            /* hop bao (bounding box) qua thoi gian */

      var TS = V.thamSo([
        { ma: "luat", ten: "Luật rẽ", kieu: "chon", gt: "RL",
          muc: Object.keys(LUAT_MAU).map(function (k) {
            return { v: k, t: k + " — " + LUAT_MAU[k] };
          }),
          moTa: "Chuỗi chữ cái: ô đang ở màu thứ <i>i</i> thì rẽ theo chữ cái thứ <i>i</i> " +
                "(<b>R</b> phải, <b>L</b> trái), rồi chuyển ô sang màu kế tiếp." },
        { ma: "kichThuoc", ten: "Cạnh lưới", kieu: "so", min: 80, max: 400, buoc: 20, gt: 160 },
        { ma: "vongQuanh", ten: "Mép lưới nối vòng quanh", kieu: "bat", gt: true,
          moTa: "Tắt: kiến đi hết lưới là dừng. Bật: lưới thành mặt xuyến, kiến đi mãi." }
      ], {
        doi: function () { apDung(); },
        preset: [
          { ten: "Kiến gốc RL",        gt: { luat: "RL", kichThuoc: 160 } },
          { ten: "Kiến gốc, lưới lớn", gt: { luat: "RL", kichThuoc: 400 } },
          { ten: "LLRR đối xứng",      gt: { luat: "LLRR", kichThuoc: 200 } },
          { ten: "Hình vuông có viền", gt: { luat: "LRRRRRLLR", kichThuoc: 200 } },
          { ten: "Đường tròn xoắn",    gt: { luat: "LLRRRLRLRLLR", kichThuoc: 240 } }
        ]
      });

      var G = TS.gt;

      var cv = V.veBangCo({ rong: 860, tiLe: 0.88, veLai: function () { if (P) apDung(); } });
      var g = cv.g;
      var S = V.soLieu();
      var ghiChu = V.el("div", { class: "chu-thich" });

      /* ============================================================
         Mo phong
         ============================================================ */
      function bangMauTheoLuat(n) {
        /* Mau 0 la nen; cac mau sau lay tu thang mau chuyen de de phan biet. */
        var ds = [V.mau("bg2")];
        for (var i = 1; i < n; i++) ds.push(V.thangMau(i / Math.max(1, n - 1)));
        ds.push(V.mau("loi"));            /* mau cuoi danh cho con kien */
        return ds;
      }

      function chuanBi() {
        N = Math.round(G.kichThuoc);
        luat = (G.luat || "RL").toUpperCase().replace(/[^RL]/g, "") || "RL";
        o = new Uint8Array(N * N);
        kx = (N / 2) | 0; ky = (N / 2) | 0; kh = 0;
        soDen = 0; raNgoai = false; caoTocTu = -1;
        lichSuHop = [];

        L = V.luoiO(cv, { cot: N, hang: N, le: 10, leTren: 24 });
        L.bangMau(bangMauTheoLuat(luat.length));
      }

      function motBuoc(k) {
        if (raNgoai) return false;
        var i = ky * N + kx;
        var mau = o[i];
        /* Re theo chu cai ung voi mau o dang dung. */
        kh = (kh + (luat[mau] === "R" ? 1 : 3)) % 4;
        var moi = (mau + 1) % luat.length;
        if (mau === 0 && moi !== 0) soDen++;
        if (mau !== 0 && moi === 0) soDen--;
        o[i] = moi;

        if (kh === 0) ky--; else if (kh === 1) kx++;
        else if (kh === 2) ky++; else kx--;

        if (G.vongQuanh) {
          kx = (kx + N) % N; ky = (ky + N) % N;
        } else if (kx < 0 || ky < 0 || kx >= N || ky >= N) {
          raNgoai = true;
          return false;
        }

        /* Do "duong cao toc": hop bao lon deu dan theo mot huong duy nhat
           trong khi so o da to tang tuyen tinh. Do o day bang cach theo doi
           hop bao moi 500 buoc — neu no chi gian theo mot phia thi ket luan. */
        if (k % 500 === 0) {
          lichSuHop.push([k, kx, ky]);
          if (caoTocTu < 0 && lichSuHop.length >= 5) {
            var a = lichSuHop[lichSuHop.length - 5];
            var b = lichSuHop[lichSuHop.length - 1];
            var dx = Math.abs(b[1] - a[1]), dy = Math.abs(b[2] - a[2]);
            /* Di thang deu: mot truc gan nhu khong doi, truc kia chay dai. */
            if ((dx > 300 && dy < 60) || (dy > 300 && dx < 60) ||
                (dx > 200 && dy > 200 && Math.abs(dx - dy) < 60)) {
              caoTocTu = a[0];
            }
          }
        }
        return true;
      }

      /* ============================================================
         Ve
         ============================================================ */
      function ve(k) {
        g.clearRect(0, 0, cv.W, cv.H);
        g.fillStyle = V.mau("surf");
        g.fillRect(0, 0, cv.W, cv.H);
        L.tuMang(o);
        /* Con kien: to o dang dung bang mau cuoi bang. */
        L.dat(kx, ky, luat.length);
        L.dan();
        L.vien();

        g.fillStyle = V.mau("tx3");
        g.font = "11px ui-monospace,monospace";
        g.textAlign = "left"; g.textBaseline = "top";
        g.fillText("luật " + luat + "   lưới " + N + "×" + N +
                   (G.vongQuanh ? "   (nối vòng quanh)" : ""), 10, 6);

        var toa = ["lên", "phải", "xuống", "trái"][kh];
        var bang = {
          "Luật": luat + "  (" + luat.length + " màu)",
          "Bước": k.toLocaleString("vi"),
          "Ô đã tô": soDen.toLocaleString("vi"),
          "Kiến đang ở": "(" + kx + ", " + ky + ")  hướng " + toa
        };
        if (luat === "RL") {
          bang["Đường cao tốc bắt đầu"] = caoTocTu >= 0
            ? ("≈ bước " + caoTocTu.toLocaleString("vi"))
            : (k < BUOC_CAO_TOC ? "chưa — vẫn đang hỗn loạn" : "đang dò");
          bang["Giá trị đã biết"] = "bước 9977, chu kỳ 104";
        }
        if (raNgoai) bang["Trạng thái"] = "kiến đã đi ra khỏi lưới";
        S.dat(bang);
      }

      /* ============================================================
         Dieu phoi
         ============================================================ */
      function apDung() {
        if (!cv.W) return;
        chuanBi();
        P.datToiDa(200000);
        P.datTocDo(2000);
        ghiChu.innerHTML = "";
        var ds = bangMauTheoLuat(luat.length);
        ghiChu.appendChild(V.el("span", {}, [
          V.el("i", { class: "o-mau", style: "background:" + ds[0] }), "ô chưa tô"
        ]));
        for (var i = 1; i < luat.length; i++) {
          ghiChu.appendChild(V.el("span", {}, [
            V.el("i", { class: "o-mau", style: "background:" + ds[i] }), "màu " + i
          ]));
        }
        ghiChu.appendChild(V.el("span", {}, [
          V.el("i", { class: "o-mau", style: "background:" + V.mau("loi") }), "con kiến"
        ]));
        P.datLai();
      }

      P = V.phat({
        ten: "kien-langton",
        bang: cv,
        tocDo: 2000,
        buoc: function (k) { return motBuoc(k); },
        datLai: function () { chuanBi(); },
        ve: ve,
        nhan: function (k) {
          if (raNgoai) return "kiến đã ra khỏi lưới";
          if (luat === "RL" && caoTocTu >= 0) return "đang đi trên đường cao tốc";
          return "bước " + k.toLocaleString("vi");
        }
      });

      var r = V.khung(host, {
        ten: "kien-langton",
        bang: cv,
        ve: [cv, ghiChu],
        dieuKhien: [P.dk(), TS.dk(), S.el],
        giaiThich:
          "<b>Luật gốc (RL):</b> kiến đứng trên ô trắng → rẽ <b>phải</b>; đứng trên ô đen → " +
          "rẽ <b>trái</b>. Dù thế nào cũng đổi màu ô đang đứng rồi bước tới một ô. Hết luật." +
          "<ul>" +
          "<li><b>Ba giai đoạn.</b> Khoảng <b>500 bước</b> đầu hình gần như đối xứng và đẹp. " +
          "Từ đó tới khoảng <b>bước 10 000</b> là hỗn loạn hoàn toàn, không có cấu trúc nào. " +
          "Rồi <b>đột ngột</b> kiến bắt đầu lặp một chuỗi 104 bước đẩy nó đi chéo — " +
          "<b>đường cao tốc</b> — và không bao giờ thoát ra nữa.</li>" +
          "<li><b>Chưa ai chứng minh được điều này.</b> Với mọi cấu hình ban đầu hữu hạn từng " +
          "thử, kiến rốt cuộc đều xây đường cao tốc. Nhưng đó vẫn là <b>giả thuyết</b>, không " +
          "phải định lý. Cách duy nhất để biết là chạy — lại là <i>tính bất khả quy về " +
          "tính toán</i>, y như R-pentomino trong Game of Life.</li>" +
          "<li><b>Turmite:</b> đổi luật thành chuỗi dài hơn, mỗi ô có nhiều màu, chữ cái thứ " +
          "<i>i</i> áp cho màu thứ <i>i</i>. <code>LLRR</code> nở thành hoa văn đối xứng tuyệt đẹp; " +
          "<code>LRRRRRLLR</code> xây một hình vuông có viền; <code>LLRRRLRLRLLR</code> vẽ ra " +
          "đường tròn xoắn. Vài chữ cái, những vũ trụ khác hẳn nhau.</li>" +
          "<li><b>Kiến Langton là Turing đầy đủ</b> — nó tính được mọi thứ máy tính tính được. " +
          "Từ hai quy tắc rẽ.</li>" +
          "</ul>"
      });
      r.trai.classList.add("co");

      requestAnimationFrame(function () { cv.doKichThuoc(); apDung(); });
    }
  });
})();
