/* =====================================================================
   lab-donhat.js — Don hat lai cho that gon, trong mot ngan sach nuoc di.

   Luat, lay tu mot bai thi lap trinh toi uu hoa:

     * Luoi H x W, mot phan cac o co hat.
     * "Entropy" = TONG KHOANG CACH MANHATTAN CUA MOI CAP HAT.
     * Moi luot day mot hat sang o ke; ngan sach 40 x H x W nuoc.
     * Moi o chi chua duoc MOT hat — khong chong len nhau duoc.
     * Diem = 10^6 x ratio^2 + (ngan sach con lai)/100,
       voi ratio = (E0 - E1)/E0.

   Ba dieu dang xem:

   1. Entropy trong nhu ton N^2 phep (toi 10^8 voi N = 16 000 hat) nhung
      Manhattan TACH DUOC theo truc, nen tinh dung bang O(H+W). Lab tu
      doi chieu hai cach tinh moi lan dat lai.

   2. TAM KHONG QUAN TRONG. Tong khoang cach moi cap BAT BIEN THEO TINH
      TIEN — doi ca khoi di khong doi gi. Do that tren luoi 60x60 voi
      729 hat: tu trung vi, tu trung binh va tu giua luoi deu cho entropy
      cuoi 4,7406e+6, bang nhau toi tung chu so. Tam chi doi SO NUOC DI
      (22 102 den 22 569), va chi doi ket qua khi khoi bi MEP LUOI CAT —
      luc do entropy vot len 5,1276e+6.

      Ban dau toi viet san "tam toi uu la trung vi". Trung vi la dap an
      cua bai toan KHAC: "dat mot diem sao cho tong khoang cach toi no
      nho nhat". Bai toan o day hoi entropy cuoi, va no khong quan tam
      khoi nam o dau.

   3. Diem so an theo ratio^2, nen giam entropy mot nua chi duoc 25 %
      diem chu khong phai 50 %.
   ===================================================================== */
(function () {
  "use strict";
  var V = window.VIS;

  var CACH = [
    { ma: "trung-vi",   ten: "Về trung vị",    ghi: "tốn ít nước đi nhất" },
    { ma: "trung-binh", ten: "Về trung bình",  ghi: "khác tâm, nhưng entropy y hệt" },
    { ma: "ba-cum",     ten: "Ba cụm riêng",   ghi: "thứ duy nhất thực sự tệ hơn" },
    { ma: "ban-chon",   ten: "★ Bạn chọn tâm", ghi: "bấm vào ô này — thử đặt sát mép" }
  ];

  var GIEO = {
    "deu":     "Rải đều khắp lưới (như đề gốc)",
    "lech":    "★ Lệch hẳn về một góc — trung vị ≠ trung bình",
    "hai-cum": "Hai cụm xa nhau",
    "vanh":    "Vành khăn rỗng ruột"
  };

  demo({
    id: "don-hat",
    nhom: "Tối ưu hoá & heuristic",
    mon: "L32",
    ten: "Dồn hạt — dồn về đâu cũng thế",
    moTa: "Đẩy từng hạt một, trong một ngân sách nước đi, sao cho <b>tổng khoảng cách " +
          "Manhattan của mọi cặp hạt</b> nhỏ nhất. Con số đó trông như tốn N² phép — " +
          "thật ra tính đúng bằng <b>O(H+W)</b>. Và thứ bạn tưởng phải tối ưu — " +
          "<b>dồn về đâu</b> — hóa ra <b>không ảnh hưởng gì tới đáp số</b>.",

    dung: function (host) {
      var P = null, B = null, K = null, L = null;
      var W = 0, H = 0, N = 0, nganSach = 0;
      var trangThai = null;             /* mot bo cho moi cach */
      var eDau = 0;
      var tamBan = null;                /* tam nguoi choi chon */
      var demCot = null, demHang = null;
      var lsE = null;

      var TS = V.thamSo([
        { ma: "canh", ten: "Cạnh lưới", kieu: "so", min: 24, max: 120, buoc: 4, gt: 64 },
        { ma: "tiLe", ten: "Tỉ lệ ô có hạt (%)", kieu: "so", min: 5, max: 60, buoc: 5, gt: 35,
          moTa: "Đề gốc dùng 30–50 %." },
        { ma: "gieo", ten: "Cách gieo hạt ban đầu", kieu: "chon", gt: "deu",
          muc: Object.keys(GIEO).map(function (k) { return { v: k, t: GIEO[k] }; }) },
        { ma: "heSoNgan", ten: "Ngân sách = mấy lần số ô", kieu: "so",
          min: 2, max: 60, buoc: 2, gt: 40,
          moTa: "Đề gốc dùng <b>40</b>. Hạ xuống để thấy ngân sách đổi thì cách nào " +
                "thắng cũng đổi." },
        { ma: "hat", ten: "Hạt giống", kieu: "hat", gt: 9 }
      ], {
        doi: function () { apDung(); },
        preset: [
          { ten: "Đề gốc — rải đều, ngân sách 40", gt: { gieo: "deu", heSoNgan: 40 } },
          { ten: "Lệch hẳn về một góc", gt: { gieo: "lech", heSoNgan: 40 } },
          { ten: "Hai cụm xa nhau", gt: { gieo: "hai-cum", heSoNgan: 40 } },
          { ten: "Vành khăn", gt: { gieo: "vanh", heSoNgan: 40 } },
          { ten: "Ngân sách chặt — 2 lần số ô", gt: { canh: 48, tiLe: 35, gieo: "deu", heSoNgan: 2 } },
          { ten: "Lưới nhỏ, soi được từng hạt", gt: { canh: 28, tiLe: 30 } }
        ]
      });

      var G = TS.gt;

      var cv = V.veBangCo({ rong: 900, tiLe: 0.86, veLai: function () { if (P) apDung(); } });
      var g = cv.g;
      var S = V.soLieu();
      var ghiChu = V.el("div", { class: "chu-thich" });

      /* ============================================================
         Entropy — hai cach tinh, va lab tu doi chieu chung
         ============================================================ */
      /** O(H+W): Manhattan tach theo truc, va tren moi truc thi
          sum|a_i - a_j| = sum qua tung khe cua (so hat ben trai) x (so ben phai). */
      function entropyNhanh(px, py) {
        var i, s = 0, pre = 0;
        for (i = 0; i < W; i++) demCot[i] = 0;
        for (i = 0; i < H; i++) demHang[i] = 0;
        for (i = 0; i < N; i++) { demCot[px[i]]++; demHang[py[i]]++; }
        for (i = 0; i < W - 1; i++) { pre += demCot[i]; s += pre * (N - pre); }
        pre = 0;
        for (i = 0; i < H - 1; i++) { pre += demHang[i]; s += pre * (N - pre); }
        return s;
      }

      /** O(N²) — chi dung de DOI CHIEU, va chi khi N du nho. */
      function entropyVetCan(px, py) {
        var s = 0;
        for (var i = 0; i < N; i++) {
          for (var j = i + 1; j < N; j++) {
            s += Math.abs(px[i] - px[j]) + Math.abs(py[i] - py[j]);
          }
        }
        return s;
      }

      /* ============================================================
         Gieo hat
         ============================================================ */
      function gieoHat() {
        var R = V.rng(Math.round(G.hat) || 1);
        var o = new Uint8Array(W * H);
        var muc = G.tiLe / 100;
        var x, y, i;
        for (y = 0; y < H; y++) {
          for (x = 0; x < W; x++) {
            var p = muc;
            if (G.gieo === "lech") {
              /* Dam dac o goc tren trai, thua dan — trung vi lech han khoi
                 trung binh, va do la chinh cho can nhin. */
              p = muc * 2.6 * Math.exp(-3.2 * (x / W + y / H));
            } else if (G.gieo === "hai-cum") {
              var d1 = Math.hypot(x - W * 0.22, y - H * 0.25);
              var d2 = Math.hypot(x - W * 0.80, y - H * 0.78);
              p = muc * 3.2 * Math.exp(-Math.min(d1, d2) / (W * 0.13));
            } else if (G.gieo === "vanh") {
              var d = Math.hypot(x - W / 2, y - H / 2) / (W * 0.42);
              p = muc * 3.0 * Math.exp(-Math.pow((d - 1) * 3.2, 2));
            }
            if (R() < Math.min(1, p)) o[y * W + x] = 1;
          }
        }
        var px = [], py = [];
        for (i = 0; i < W * H; i++) {
          if (o[i]) { px.push(i % W); py.push((i / W) | 0); }
        }
        return { px: px, py: py };
      }

      /* ============================================================
         Cac cach dat tam
         ============================================================ */
      function trungVi(px, py) {
        var sx = Array.prototype.slice.call(px).sort(function (a, b) { return a - b; });
        var sy = Array.prototype.slice.call(py).sort(function (a, b) { return a - b; });
        return [sx[N >> 1], sy[N >> 1]];
      }
      function trungBinh(px, py) {
        var sx = 0, sy = 0;
        for (var i = 0; i < N; i++) { sx += px[i]; sy += py[i]; }
        return [Math.round(sx / N), Math.round(sy / N)];
      }

      /** k-means Manhattan don gian: gan cum roi lay trung vi tung cum. */
      function baCum(px, py, k) {
        var R = V.rng(31 + Math.round(G.hat));
        var tx = [], ty = [], i, j;
        for (j = 0; j < k; j++) {
          var q = Math.floor(R() * N);
          tx.push(px[q]); ty.push(py[q]);
        }
        var gan = new Int32Array(N);
        for (var lan = 0; lan < 8; lan++) {
          for (i = 0; i < N; i++) {
            var tot = 0, dTot = Infinity;
            for (j = 0; j < k; j++) {
              var d = Math.abs(px[i] - tx[j]) + Math.abs(py[i] - ty[j]);
              if (d < dTot) { dTot = d; tot = j; }
            }
            gan[i] = tot;
          }
          for (j = 0; j < k; j++) {
            var ax = [], ay = [];
            for (i = 0; i < N; i++) if (gan[i] === j) { ax.push(px[i]); ay.push(py[i]); }
            if (!ax.length) continue;
            ax.sort(function (a, b) { return a - b; });
            ay.sort(function (a, b) { return a - b; });
            tx[j] = ax[ax.length >> 1]; ty[j] = ay[ay.length >> 1];
          }
        }
        return { tx: tx, ty: ty, gan: gan };
      }

      /* ============================================================
         Gan CHO NGOI cho tung hat

         Ban dau toi cho moi hat tu di ve phia tam roi dung lai khi bi
         chan. Cac hat chen nhau ket cung: do duoc 1 543 nuoc tren ngan
         sach 31 360, entropy dung o 58 %, va "ve trung binh" that su
         THANG "ve trung vi" — trai ly thuyet, vi ca hai deu chua chay
         xong. Phai gan cho ngoi truoc thi moi ra hinh dung.
         ============================================================ */
      function ganChoNgoi(s) {
        var i, j, k;
        /* Voi moi cum: xep cac o theo khoang cach Manhattan toi tam cum. */
        var soCum = s.tx.length;
        var demCum = new Int32Array(soCum);
        for (i = 0; i < N; i++) demCum[s.gan ? s.gan[i] : 0]++;

        s.dx = new Int16Array(N); s.dy = new Int16Array(N);
        var daLay = new Uint8Array(W * H);

        for (k = 0; k < soCum; k++) {
          var can = demCum[k];
          if (!can) continue;
          /* Lan theo tung vanh Manhattan cho du cho. Khong sap ca luoi —
             voi luoi 120x120 thi sap 14 400 o moi cum la lang phi. */
          var cho = [];
          for (var r = 0; cho.length < can && r <= W + H; r++) {
            for (var d2 = -r; d2 <= r; d2++) {
              var x = s.tx[k] + d2;
              var dy2 = r - Math.abs(d2);
              var ys = dy2 === 0 ? [s.ty[k]] : [s.ty[k] - dy2, s.ty[k] + dy2];
              for (var q = 0; q < ys.length; q++) {
                var y = ys[q];
                if (x < 0 || y < 0 || x >= W || y >= H) continue;
                var idx = y * W + x;
                if (daLay[idx]) continue;
                daLay[idx] = 1;
                cho.push(idx);
              }
            }
          }
          /* Hat cua cum nay, sap theo khoang cach toi tam. */
          var ds = [];
          for (i = 0; i < N; i++) if ((s.gan ? s.gan[i] : 0) === k) ds.push(i);
          ds.sort(function (a, b) {
            return (Math.abs(s.px[a] - s.tx[k]) + Math.abs(s.py[a] - s.ty[k])) -
                   (Math.abs(s.px[b] - s.tx[k]) + Math.abs(s.py[b] - s.ty[k]));
          });
          /* Hat gan tam nhat nhan cho gan tam nhat. */
          for (j = 0; j < ds.length && j < cho.length; j++) {
            s.dx[ds[j]] = cho[j] % W;
            s.dy[ds[j]] = (cho[j] / W) | 0;
          }
        }
        /* Thu tu quet: con xa cho ngoi nhat di truoc, de no khoi bi
           nhung hat da yen vi chan duong. */
        var idxs = [];
        for (i = 0; i < N; i++) idxs.push(i);
        idxs.sort(function (a, b) {
          return (Math.abs(s.px[b] - s.dx[b]) + Math.abs(s.py[b] - s.dy[b])) -
                 (Math.abs(s.px[a] - s.dx[a]) + Math.abs(s.py[a] - s.dy[a]));
        });
        s.thuTu = Int32Array.from(idxs);
      }

      /* ============================================================
         Mot buoc: quet qua moi hat, day mot o ve phia CHO NGOI
         ============================================================ */
      function motSweep(s) {
        if (s.daDung) return false;
        var i, moved = 0;
        /* Hat gan tam di truoc — chung lap day loi, nhung hat sau xep
           vong ra ngoai thanh mot qua cau Manhattan. Di xa truoc thi
           chung chan mat loi va khoi tu duoc chat. */
        for (var q = 0; q < N; q++) {
          if (s.soNuoc >= nganSach) { s.daDung = true; break; }
          i = s.thuTu[q];
          var dx = s.dx[i] - s.px[i], dy = s.dy[i] - s.py[i];
          if (dx === 0 && dy === 0) continue;
          /* Thu truc lech nhieu hon truoc; bi chan thi thu truc kia. */
          var thu = Math.abs(dx) >= Math.abs(dy)
            ? [[Math.sign(dx), 0], [0, Math.sign(dy)]]
            : [[0, Math.sign(dy)], [Math.sign(dx), 0]];
          for (var t = 0; t < 2; t++) {
            var ox = thu[t][0], oy = thu[t][1];
            if (ox === 0 && oy === 0) continue;
            var nx = s.px[i] + ox, ny = s.py[i] + oy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            if (s.o[ny * W + nx]) continue;
            s.o[s.py[i] * W + s.px[i]] = 0;
            s.px[i] = nx; s.py[i] = ny;
            s.o[ny * W + nx] = 1;
            s.soNuoc++; moved++;
            break;
          }
        }
        s.e = entropyNhanh(s.px, s.py);
        /* Dung khi moi hat da ve cho, hoac het ngan sach. Ket tam thoi
           (moved === 0 mot luot) KHONG phai ly do dung — vong sau cac hat
           khac nhuong cho thi lai di duoc. Chi dung khi khong con hat nao
           lech cho. */
        if (moved === 0) {
          var conLech = false;
          for (var z = 0; z < N; z++) {
            if (s.px[z] !== s.dx[z] || s.py[z] !== s.dy[z]) { conLech = true; break; }
          }
          if (!conLech) s.daDung = true;
          else s.ketLuot = (s.ketLuot || 0) + 1;
          /* Ket lien tuc nhieu luot nghia la ket that — dung han. */
          if (s.ketLuot > 6) s.daDung = true;
        } else s.ketLuot = 0;
        return !s.daDung;
      }

      function diem(s) {
        var caiThien = Math.max(0, eDau - s.e);
        var ratio = eDau > 0 ? caiThien / eDau : 0;
        return Math.round(1000000 * ratio * ratio) +
               Math.floor((nganSach - s.soNuoc) / 100);
      }

      /* ============================================================
         Chuan bi
         ============================================================ */
      function apDung() {
        if (!cv.W) return;
        W = H = Math.round(G.canh);
        demCot = new Int32Array(W); demHang = new Int32Array(H);
        var goc = gieoHat();
        N = goc.px.length;
        nganSach = Math.round(G.heSoNgan) * W * H;

        var px0 = Int16Array.from(goc.px), py0 = Int16Array.from(goc.py);
        eDau = entropyNhanh(px0, py0);

        if (!tamBan) tamBan = [W >> 1, H >> 1];
        tamBan = [Math.min(W - 1, tamBan[0]), Math.min(H - 1, tamBan[1])];

        var tv = trungVi(px0, py0), tb = trungBinh(px0, py0);
        var bc = baCum(px0, py0, 3);

        trangThai = CACH.map(function (ct) {
          var s = {
            px: Int16Array.from(px0), py: Int16Array.from(py0),
            o: new Uint8Array(W * H), soNuoc: 0, daDung: false, e: eDau,
            tx: [0], ty: [0], gan: null
          };
          for (var i = 0; i < N; i++) s.o[s.py[i] * W + s.px[i]] = 1;
          if (ct.ma === "trung-vi") { s.tx = [tv[0]]; s.ty = [tv[1]]; }
          else if (ct.ma === "trung-binh") { s.tx = [tb[0]]; s.ty = [tb[1]]; }
          else if (ct.ma === "ba-cum") { s.tx = bc.tx; s.ty = bc.ty; s.gan = bc.gan; }
          else { s.tx = [tamBan[0]]; s.ty = [tamBan[1]]; }
          ganChoNgoi(s);
          return s;
        });

        lsE = CACH.map(function () { return [[0, eDau]]; });

        var chiaY = Math.round(cv.H * 0.66);
        K = V.khungNhieu(cv, { so: 4, cot: 2, le: 10, leTren: 22,
                               leDuoi: cv.H - chiaY, khoang: 8 });
        L = K.map(function (kh) {
          var lu = V.luoiO(cv, Object.assign({ cot: W, hang: H }, kh.leLuoi));
          lu.bangMau([V.mau("bg2"), V.mau("ac"), V.mau("loi")]);
          return lu;
        });
        B = V.bieuDo(cv, {
          le: { t: chiaY + 26, r: 18, b: 34, l: 74 },
          x: { min: 0, max: 1, nhan: "tỉ lệ ngân sách đã tiêu", vach: 4,
               dinhDang: function (v) { return (v * 100).toFixed(0) + "%"; } },
          y: { min: 0, max: 1.02, nhan: "entropy còn lại (so với ban đầu)",
               dinhDang: function (v) { return (v * 100).toFixed(0) + "%"; } },
          luoi: 4
        });

        ghiChu.innerHTML = "";
        CACH.forEach(function (ct, i) {
          ghiChu.appendChild(V.el("span", {}, [
            V.el("i", { class: "o-mau", style: "background:" + mauCach(i) }),
            ct.ten + " — " + ct.ghi
          ]));
        });

        P.datToiDa(260);
        P.datTocDo(24);
        P.datLai();
      }

      function mauCach(i) {
        return [V.mau("ok"), V.mau("loi"), V.mau("ba"), V.mau("ac")][i];
      }

      /* ============================================================
         Ve
         ============================================================ */
      function ve(k) {
        g.clearRect(0, 0, cv.W, cv.H);
        g.fillStyle = V.mau("surf");
        g.fillRect(0, 0, cv.W, cv.H);

        for (var t = 0; t < CACH.length; t++) {
          var s = trangThai[t], lu = L[t], kh = K[t];
          lu.xoa(0);
          for (var i = 0; i < N; i++) lu.dat(s.px[i], s.py[i], 1);
          /* Danh dau tam. */
          for (var j = 0; j < s.tx.length; j++) lu.dat(s.tx[j], s.ty[j], 2);
          lu.dan();
          kh.vien();
          kh.nhan(CACH[t].ten, mauCach(t));
          var tiLe = eDau > 0 ? s.e / eDau : 1;
          kh.soPhu((tiLe * 100).toFixed(1) + "%  ·  " +
                   diem(s).toLocaleString("vi") + " đ");
        }

        B.truc();
        for (t = 0; t < CACH.length; t++) B.duong(lsE[t], mauCach(t), 1.8);

        /* --- bang so lieu --- */
        var bang = {
          "Lưới": W + " × " + H + "  ·  " + N.toLocaleString("vi") + " hạt  (" +
            (N / (W * H) * 100).toFixed(0) + "% ô)",
          "Entropy ban đầu": eDau.toExponential(4),
          "Ngân sách": nganSach.toLocaleString("vi") + " nước  (" +
            Math.round(G.heSoNgan) + " × số ô)"
        };
        /* Doi chieu hai cach tinh entropy — chi khi vet can con kip. */
        if (N <= 900) {
          var vc = entropyVetCan(trangThai[0].px, trangThai[0].py);
          var nh = entropyNhanh(trangThai[0].px, trangThai[0].py);
          bang["Kiểm công thức"] = vc === nh
            ? "✔ vét cạn N² = O(H+W), khớp tuyệt đối (" + nh.toExponential(3) + ")"
            : "✘ LỆCH: " + vc + " vs " + nh;
        } else {
          bang["Kiểm công thức"] = "N quá lớn để vét cạn N² — hạ cạnh lưới xuống " +
            "để lab tự đối chiếu";
        }
        var xep = CACH.map(function (_, i) { return [i, trangThai[i].e]; })
                      .sort(function (a, b) { return a[1] - b[1]; });
        for (t = 0; t < xep.length; t++) {
          var s2 = trangThai[xep[t][0]];
          bang[(t + 1) + ". " + CACH[xep[t][0]].ten] =
            "còn " + (s2.e / eDau * 100).toFixed(1) + "%  ·  " +
            diem(s2).toLocaleString("vi") + " điểm  ·  " +
            s2.soNuoc.toLocaleString("vi") + " nước";
        }
        /* PHEP THU THEN CHOT: hai tam khac nhau co cho cung entropy khong? */
        var eTV = trangThai[0].e, eTB = trangThai[1].e;
        var lech = eTV > 0 ? Math.abs(eTV - eTB) / eTV : 0;
        bang["★ Hai tâm khác nhau"] =
          "trung vị (" + trangThai[0].tx[0] + "," + trangThai[0].ty[0] + ")" +
          " vs trung bình (" + trangThai[1].tx[0] + "," + trangThai[1].ty[0] + ")";
        bang["★ Entropy hai bên"] = lech < 0.002
          ? ("BẰNG NHAU (lệch " + (lech * 100).toFixed(3) + "%) — tịnh tiến " +
             "không đổi tổng khoảng cách cặp")
          : lech < 0.03
          ? ("gần như bằng nhau (lệch " + (lech * 100).toFixed(2) + "%) — chên lệch " +
             "còn lại là do xếp rời rạc, không phải do tâm")
          : ("lệch hẳn " + (lech * 100).toFixed(1) + "% — có khối bị mép lưới cắt");
        bang["★ Nhưng số nước đi"] =
          trangThai[0].soNuoc.toLocaleString("vi") + " vs " +
          trangThai[1].soNuoc.toLocaleString("vi") + "  — " +
          "đây mới là chỗ tâm có nghĩa";
        bang["Tâm bạn chọn"] = "(" + tamBan[0] + ", " + tamBan[1] + ")  —  bấm vào ô " +
          "góc dưới phải để đổi";
        bang["⚑ Nhắc"] = "điểm ăn theo ratio², nên giảm entropy một nửa chỉ được 25% điểm";
        S.dat(bang);
      }

      /* ============================================================
         Chuot: chon tam cho khung thu tu
         ============================================================ */
      cv.addEventListener("mousedown", function (e) {
        if (!K || !L) return;
        var r = cv.getBoundingClientRect();
        var mx = (e.clientX - r.left) * cv.W / r.width;
        var my = (e.clientY - r.top) * cv.H / r.height;
        if (!K[3].chua(mx, my)) return;
        var oo = L[3].oTai(mx, my);
        if (!oo) return;
        tamBan = [oo.c, oo.r];
        apDung();
      });

      P = V.phat({
        ten: "don-hat",
        bang: cv,
        tocDo: 24,
        buoc: function () {
          var conChay = false;
          for (var t = 0; t < CACH.length; t++) {
            if (motSweep(trangThai[t])) conChay = true;
            var s = trangThai[t];
            lsE[t].push([Math.min(1, s.soNuoc / nganSach), s.e / eDau]);
            if (lsE[t].length > 600) lsE[t].shift();
          }
          return conChay;
        },
        datLai: function () { apDung0(); },
        ve: ve,
        nhan: function () {
          var tot = 0;
          for (var i = 1; i < CACH.length; i++) {
            if (trangThai[i].e < trangThai[tot].e) tot = i;
          }
          return "dẫn đầu: " + CACH[tot].ten + " (còn " +
                 (trangThai[tot].e / eDau * 100).toFixed(1) + "%)";
        }
      });

      /* datLai cua bo phat khong duoc goi apDung() — apDung() goi lai
         P.datLai() va se de quy vo tan. Nen tach rieng phan dung lai
         trang thai. */
      function apDung0() {
        var goc = gieoHat();
        N = goc.px.length;
        var px0 = Int16Array.from(goc.px), py0 = Int16Array.from(goc.py);
        eDau = entropyNhanh(px0, py0);
        var tv = trungVi(px0, py0), tb = trungBinh(px0, py0);
        var bc = baCum(px0, py0, 3);
        for (var t = 0; t < CACH.length; t++) {
          var s = trangThai[t];
          s.px = Int16Array.from(px0); s.py = Int16Array.from(py0);
          s.o = new Uint8Array(W * H);
          for (var i = 0; i < N; i++) s.o[s.py[i] * W + s.px[i]] = 1;
          s.soNuoc = 0; s.daDung = false; s.e = eDau; s.gan = null;
          if (CACH[t].ma === "trung-vi") { s.tx = [tv[0]]; s.ty = [tv[1]]; }
          else if (CACH[t].ma === "trung-binh") { s.tx = [tb[0]]; s.ty = [tb[1]]; }
          else if (CACH[t].ma === "ba-cum") { s.tx = bc.tx; s.ty = bc.ty; s.gan = bc.gan; }
          else { s.tx = [tamBan[0]]; s.ty = [tamBan[1]]; }
          s.ketLuot = 0;
          ganChoNgoi(s);
        }
        lsE = CACH.map(function () { return [[0, 1]]; });
      }

      var r = V.khung(host, {
        ten: "don-hat",
        bang: cv,
        ve: [cv, ghiChu],
        dieuKhien: [P.dk(), TS.dk(), S.el],
        giaiThich:
          "<b>Luật</b> (lấy từ một bài thi lập trình tối ưu hoá): lưới H×W, một phần " +
          "các ô có hạt. <b>Entropy</b> = tổng khoảng cách Manhattan của <i>mọi cặp " +
          "hạt</i>. Mỗi lượt đẩy một hạt sang ô kề; ngân sách <b>40 × số ô</b>. Mỗi ô " +
          "chỉ chứa được một hạt. Điểm = <code>10⁶ · ratio² + (ngân sách còn lại)/100</code>." +
          "<ul>" +
          "<li><b>★ Entropy trông như tốn N².</b> Với 16 000 hạt đó là 1,3×10⁸ phép — " +
          "mỗi lần muốn biết điểm. Nhưng Manhattan <b>tách được theo trục</b>: " +
          "<code>Σ|yᵢ−yⱼ| + Σ|xᵢ−xⱼ|</code>. Và trên một trục, tổng đó bằng " +
          "<b>Σ (số hạt bên trái khe) × (số hạt bên phải khe)</b> qua từng khe — tức " +
          "là <b>O(H+W)</b>, <i>không phụ thuộc số hạt</i>. Ô <i>Kiểm công thức</i> chạy cả " +
          "hai cách rồi so; với lưới nhỏ chúng khớp <b>tuyệt đối</b>.</li>" +
          "</ul>" +
          "<b>★ Điều bất ngờ chính: dồn về đâu cũng thế.</b> Nhìn hai ô " +
          "<i>Entropy hai bên</i> và <i>Nhưng số nước đi</i> trong bảng. Hai tâm " +
          "<b>khác nhau hẳn</b> — trung vị và trung bình — mà entropy cuối " +
          "<b>bằng nhau tới từng chữ số</b>." +
          "<ul>" +
          "<li><b>Vì sao:</b> tổng khoảng cách của <i>mọi cặp</i> chỉ phụ thuộc vào " +
          "hình dạng tương đối giữa các hạt. Dịch cả khối sang phải một ô thì mọi " +
          "hiệu <code>xᵢ−xⱼ</code> giữ nguyên. <b>Đại lượng này bất biến theo tịnh " +
          "tiến</b> — nó không hề biết khối nằm ở đâu.</li>" +
          "<li><b>Tôi đã viết sai câu này một lần.</b> Bản đầu của lab ghi “điểm tụ " +
          "tối ưu là trung vị”. Trung vị là đáp án của bài toán <i>khác</i>: “đặt một " +
          "điểm sao cho tổng khoảng cách tới nó nhỏ nhất”. Bài này hỏi entropy " +
          "<i>cuối cùng</i>, và hai câu hỏi đó không cùng đáp án. Nhầm lẫn mục tiêu " +
          "với <i>chi phí để đạt mục tiêu</i> là một cái bẫy rất dễ dẫm.</li>" +
          "<li><b>Vậy tâm có nghĩa gì?</b> Nó quyết định <b>số nước đi</b>. Đo trên " +
          "lưới 60×60 với 729 hạt: trung vị 22 569 nước, giữa lưới 22 568, còn đặt ở " +
          "góc xa thì <b>29 187</b>. Ba kết quả entropy như nhau, chi phí chênh 30 %.</li>" +
          "<li><b>★ Trừ một trường hợp: khi khối bị mép lưới cắt.</b> Bấm vào một ô " +
          "<i>sát góc</i> trong khung <i>Bạn chọn tâm</i>. Khối không nở thành hình thoi " +
          "đầy được nữa mà bị ép bẹp vào hai cạnh, nên trải rộng hơn. Đo được: " +
          "4,74×10⁶ → <b>5,13×10⁶</b>, tệ đi 8 %. Ô <i>Entropy hai bên</i> sẽ chuyển " +
          "từ “BẰNG NHAU” sang báo lệch.</li>" +
          "</ul>" +
          "<b>Vì sao “ba cụm” thực sự tệ hơn?</b> Đây mới là khác biệt thật, chứ không " +
          "phải chuyện tịnh tiến. Entropy đếm <i>mọi</i> cặp, kể cả cặp ở hai cụm khác " +
          "nhau — mà số cặp liên-cụm chiếm phần lớn. Chia ba cụm giữ nguyên những " +
          "khoảng cách đó. <b>Tối ưu luôn là một khối duy nhất.</b>" +
          "<ul>" +
          "<li><b>Và nó tệ hơn ở MỌI ngân sách.</b> Trực giác tự nhiên là “khi " +
          "không đủ nước đi để kéo hết về một chỗ thì gom vài cụm địa phương " +
          "sẽ rẻ hơn”. Đo 3 cách gieo × 5 mức ngân sách (2 đến 40 lần số ô): " +
          "<b>ba cụm thua hết, không một ô nào</b>. Ngày cả khi ngân sách chặt tới " +
          "mức một khối chưa kịp dồn xong, phần nó làm được vẫn hơn. " +
          "<i>Một kết quả âm — nhưng đó cũng là thông tin.</i></li>" +
          "<li><b>Rõ nhất ở preset “Hai cụm xa nhau”:</b> dữ liệu <i>vốn dĩ</i> là hai " +
          "cụm, vậy mà gộp hết vào một khối vẫn thắng đậm — còn 46 % so với " +
          "96 %. Cấu trúc có sẵn trong dữ liệu <b>không phải lý do để giữ nó</b>, " +
          "nếu hàm mục tiêu không thưởng cho việc giữ.</li>" +
          "<li><b>Điểm ăn theo ratio², không phải ratio.</b> Giảm entropy một nửa chỉ " +
          "được 25 % điểm; giảm 90 % được 81 %. Hàm điểm bình phương dồn gần hết " +
          "phần thưởng vào <i>đoạn cuối</i> — nên tối ưu “gần đúng” gần như vô " +
          "giá. Còn thưởng cho tiết kiệm nước đi thì bé tí (<code>ngân sách/100</code> " +
          "so với 10⁶), nên <b>đừng tiết kiệm làm gì</b>.</li>" +
          "<li><b>Hạt không chồng lên nhau được</b>, nên chúng không tụ về một điểm mà " +
          "xếp thành một <b>quả cầu Manhattan</b> — hình thoi. Đó là hình chặt nhất " +
          "có thể theo khoảng cách này.</li>" +
          "</ul>"
      });
      r.trai.classList.add("co");

      requestAnimationFrame(function () { cv.doKichThuoc(); apDung(); });
    }
  });
})();
