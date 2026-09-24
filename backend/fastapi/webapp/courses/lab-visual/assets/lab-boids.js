/* =====================================================================
   lab-boids.js — Dan chim cua Craig Reynolds (1986).

   Khong co con chim dau dan. Khong con nao nhin thay ca dan. Moi con chi
   nhin vai con quanh minh va lam ba viec: tranh dam, di cung huong, lai
   gan. Ba luat do du de sinh ra dan chim.
   ===================================================================== */
(function () {
  "use strict";
  var V = window.VIS;

  var RONG = 200, CAO = 140;      /* he toa do mo phong, doc lap voi canvas */

  demo({
    id: "boids",
    nhom: "Bầy đàn & tác tử",
    mon: "L13",
    ten: "Đàn chim — ba luật, không ai chỉ huy",
    moTa: "Không có con đầu đàn. Không con nào nhìn thấy cả đàn. Mỗi con chỉ nhìn " +
          "vài con quanh mình và làm ba việc: <b>tránh đâm</b>, <b>đi cùng hướng</b>, " +
          "<b>lại gần</b>. Tắt từng luật một để xem luật nào giữ đàn lại.",

    dung: function (host) {
      var HT = null, P = null, B = null;
      var lichSu = [], buocDem = 0;
      var trungBinhLangGieng = 0;
      /* Dem van toc cua buoc ke tiep. Cap phat mot lan trong chuanBi() —
         cap phat trong vong lap la 60 mang moi giay cho rac don dep. */
      var vxM = null, vyM = null;
      /* Bien tich luy cua mot con, dung chung cho ham goi lai ben duoi:
         tao closure moi cho tung con tung buoc la 180 000 closure moi giay. */
      var _sx = 0, _sy = 0, _ax = 0, _ay = 0, _cx = 0, _cy = 0, _dem = 0, _rTach2 = 0;

      function gomLangGieng(j, dx, dy, d2) {
        _dem++;
        _ax += HT.vx[j]; _ay += HT.vy[j];
        _cx += dx; _cy += dy;
        if (d2 < _rTach2 && d2 > 1e-9) {
          /* Day ra, manh hon khi gan hon. */
          _sx -= dx / d2; _sy -= dy / d2;
        }
      }

      var TS = V.thamSo([
        { ma: "soCon", ten: "Số con", kieu: "so", min: 50, max: 3000, buoc: 50, gt: 600 },
        { ma: "banKinh", ten: "Tầm nhìn", kieu: "so", min: 2, max: 20, buoc: 0.5, gt: 7,
          moTa: "Bán kính mà một con “thấy” hàng xóm. Đây là thứ duy nhất nối các con " +
                "với nhau — không con nào biết gì về phần còn lại của đàn." },
        { ma: "tach", ten: "Lực tránh đâm", kieu: "so", min: 0, max: 3, buoc: 0.05, gt: 1.2 },
        { ma: "canBang", ten: "Lực đi cùng hướng", kieu: "so", min: 0, max: 3, buoc: 0.05, gt: 1 },
        { ma: "tuHop", ten: "Lực lại gần nhau", kieu: "so", min: 0, max: 3, buoc: 0.05, gt: 0.6,
          moTa: "Tắt <b>đi cùng hướng</b> mà giữ hai lực kia: đàn tụ thành cục nhưng " +
                "quay loạn. Tắt <b>lại gần</b>: đàn trôi ra thành khí." },
        { ma: "tocToiDa", ten: "Tốc độ tối đa", kieu: "so", min: 0.3, max: 3, buoc: 0.1, gt: 1.2 },
        { ma: "hat", ten: "Hạt giống", kieu: "hat", gt: 13 },
        { ma: "veHuong", ten: "Vẽ thành hình nêm (thấy hướng)", kieu: "bat", gt: true }
      ], {
        doi: function () { apDung(); },
        preset: [
          { ten: "Đàn chim đầy đủ",     gt: { tach: 1.2, canBang: 1, tuHop: 0.6, soCon: 600 } },
          { ten: "Chỉ tránh đâm",       gt: { tach: 1.2, canBang: 0, tuHop: 0, soCon: 600 } },
          { ten: "Chỉ đi cùng hướng",   gt: { tach: 0, canBang: 1.5, tuHop: 0, soCon: 600 } },
          { ten: "Chỉ lại gần",         gt: { tach: 0, canBang: 0, tuHop: 1.5, soCon: 600 } },
          { ten: "Tầm nhìn rất hẹp",    gt: { banKinh: 3, soCon: 1200 } },
          { ten: "Đàn lớn 3000 con",    gt: { soCon: 3000, banKinh: 6 } }
        ]
      });

      var G = TS.gt;

      var cv = V.veBangCo({ rong: 880, tiLe: 0.86, veLai: function () { if (P) apDung(); } });
      var g = cv.g;
      var S = V.soLieu();
      var ghiChu = V.el("div", { class: "chu-thich" });

      /* ============================================================
         Mo phong
         ============================================================ */
      function chuanBi() {
        var n = Math.round(G.soCon);
        HT = V.hat({
          soToiDa: n, rong: RONG, cao: CAO,
          banKinh: Math.max(2, G.banKinh), vien: "vong"
        });
        var R = V.rng(Math.round(G.hat) || 1);
        for (var i = 0; i < n; i++) {
          var goc = R() * Math.PI * 2;
          HT.them(R() * RONG, R() * CAO,
                  Math.cos(goc) * G.tocToiDa, Math.sin(goc) * G.tocToiDa, 0);
        }
        vxM = new Float32Array(n);
        vyM = new Float32Array(n);
        lichSu = []; buocDem = 0; trungBinhLangGieng = 0;

        var chiaY = Math.round(cv.H * 0.76);
        B = V.bieuDo(cv, {
          le: { t: chiaY + 30, r: 18, b: 30, l: 58 },
          x: { min: 0, max: 1, nhan: "bước", vach: 4, dinhDang: V.soGon },
          y: { min: 0, max: 1, nhan: "độ đồng hướng",
               dinhDang: function (v) { return v.toFixed(2); } },
          luoi: 2
        });
      }

      /** Mot buoc: ba luat cua Reynolds, tinh tren lang gieng trong tam nhin. */
      function motBuoc() {
        var n = HT.n, r = G.banKinh;
        var rTach = r * 0.45;                /* tranh dam chi xet rat gan */
        _rTach2 = rTach * rTach;
        HT.dungBam();

        var tongLangGieng = 0;

        for (var i = 0; i < n; i++) {
          _sx = 0; _sy = 0; _ax = 0; _ay = 0; _cx = 0; _cy = 0; _dem = 0;
          HT.quanh(i, r, gomLangGieng);
          tongLangGieng += _dem;

          var vx = HT.vx[i], vy = HT.vy[i];
          if (_dem > 0) {
            vx += (_ax / _dem - HT.vx[i]) * 0.06 * G.canBang;
            vy += (_ay / _dem - HT.vy[i]) * 0.06 * G.canBang;
            vx += (_cx / _dem) * 0.004 * G.tuHop;
            vy += (_cy / _dem) * 0.004 * G.tuHop;
          }
          vx += _sx * 0.05 * G.tach;
          vy += _sy * 0.05 * G.tach;

          vxM[i] = vx; vyM[i] = vy;
        }

        for (i = 0; i < n; i++) {
          HT.vx[i] = vxM[i]; HT.vy[i] = vyM[i];
          /* Giu toc do khong ve 0: chim luon bay.
             sqrt thay cho Math.hypot — nhanh hon nhieu lan trong vong nong. */
          var v = Math.sqrt(HT.vx[i] * HT.vx[i] + HT.vy[i] * HT.vy[i]);
          var toi = G.tocToiDa, san = toi * 0.5;
          if (v < 1e-6) { HT.vx[i] = san; HT.vy[i] = 0; }
          else if (v > toi) { HT.vx[i] *= toi / v; HT.vy[i] *= toi / v; }
          else if (v < san) { HT.vx[i] *= san / v; HT.vy[i] *= san / v; }
        }
        HT.tien(1);

        trungBinhLangGieng = n ? tongLangGieng / n : 0;
        buocDem++;
        if (buocDem % 4 === 0) lichSu.push([buocDem, doDongHuong()]);
        if (lichSu.length > 3000) lichSu.shift();
        return true;
      }

      /** Do dong huong (polarization): do dai trung binh cua cac vector don vi.
          1 = ca dan bay cung mot huong; 0 = huong rai deu moi phia. */
      function doDongHuong() {
        var sx = 0, sy = 0;
        for (var i = 0; i < HT.n; i++) {
          var v = Math.sqrt(HT.vx[i] * HT.vx[i] + HT.vy[i] * HT.vy[i]);
          if (v < 1e-9) continue;
          sx += HT.vx[i] / v; sy += HT.vy[i] / v;
        }
        return HT.n ? Math.hypot(sx, sy) / HT.n : 0;
      }

      /* ============================================================
         Ve
         ============================================================ */
      function ve() {
        g.clearRect(0, 0, cv.W, cv.H);
        g.fillStyle = V.mau("surf");
        g.fillRect(0, 0, cv.W, cv.H);

        var chiaY = Math.round(cv.H * 0.76);
        var tl = Math.min(cv.W / RONG, (chiaY - 16) / CAO);
        var ox = (cv.W - RONG * tl) / 2, oy = 8;

        g.save();
        g.strokeStyle = V.mau("bd");
        g.lineWidth = 1;
        g.strokeRect(ox, oy, RONG * tl, CAO * tl);
        g.restore();

        var m = V.mau("ac");
        g.fillStyle = m;
        g.strokeStyle = m;
        var co = Math.max(1.1, tl * 0.55);
        for (var i = 0; i < HT.n; i++) {
          var x = ox + HT.x[i] * tl, y = oy + HT.y[i] * tl;
          if (G.veHuong) {
            var v = Math.sqrt(HT.vx[i] * HT.vx[i] + HT.vy[i] * HT.vy[i]) || 1;
            var ux = HT.vx[i] / v, uy = HT.vy[i] / v;
            g.beginPath();
            g.moveTo(x + ux * co * 1.8, y + uy * co * 1.8);
            g.lineTo(x - ux * co - uy * co * 0.7, y - uy * co + ux * co * 0.7);
            g.lineTo(x - ux * co + uy * co * 0.7, y - uy * co - ux * co * 0.7);
            g.closePath();
            g.fill();
          } else {
            g.fillRect(x - co / 2, y - co / 2, co, co);
          }
        }

        var dh = doDongHuong();
        var tran = Math.max(40, buocDem);
        B.dat({ x: { min: 0, max: tran, nhan: "bước", vach: 4, dinhDang: V.soGon },
                y: { min: 0, max: 1, nhan: "độ đồng hướng",
                     dinhDang: function (v2) { return v2.toFixed(2); } } });
        B.truc();
        B.moc(1, V.mau("ok"), "1,00 = cả đàn cùng một hướng");
        B.duong(lichSu, V.mau("ba"), 1.8);

        S.dat({
          "Số con": HT.n.toLocaleString("vi"),
          "Láng giềng trung bình": trungBinhLangGieng.toFixed(1) + " con",
          "Độ đồng hướng": dh.toFixed(3),
          "Ba lực (tách / hướng / gần)":
            G.tach.toFixed(2) + " / " + G.canBang.toFixed(2) + " / " + G.tuHop.toFixed(2),
          "Trạng thái": dh > 0.9 ? "cả đàn bay như một"
                      : dh > 0.5 ? "có đàn, nhưng còn tách nhóm"
                      : "chưa thành đàn"
        });
      }

      /* ============================================================
         Dieu phoi
         ============================================================ */
      function apDung() {
        if (!cv.W) return;
        chuanBi();
        P.datToiDa(4000);
        P.datTocDo(60);
        ghiChu.innerHTML = "";
        [[V.mau("ac"), "một con chim"], [V.mau("ba"), "độ đồng hướng theo thời gian"],
         [V.mau("ok"), "mức đồng hướng tuyệt đối"]].forEach(function (c) {
          ghiChu.appendChild(V.el("span", {}, [
            V.el("i", { class: "o-mau", style: "background:" + c[0] }), c[1]
          ]));
        });
        P.datLai();
      }

      P = V.phat({
        ten: "boids",
        bang: cv,
        tocDo: 60,
        buoc: function () { return motBuoc(); },
        datLai: function () { chuanBi(); },
        ve: ve,
        nhan: function () { return "độ đồng hướng " + doDongHuong().toFixed(3); }
      });

      var r = V.khung(host, {
        ten: "boids",
        bang: cv,
        ve: [cv, ghiChu],
        dieuKhien: [P.dk(), TS.dk(), S.el],
        giaiThich:
          "<b>Ba luật</b>, mỗi con chỉ áp cho những con trong tầm nhìn của nó:" +
          "<ul>" +
          "<li><b>Tránh đâm</b> — đẩy ra khỏi con ở quá sát.</li>" +
          "<li><b>Đi cùng hướng</b> — lái vận tốc của mình về vận tốc trung bình của hàng xóm.</li>" +
          "<li><b>Lại gần</b> — hướng về tâm của nhóm hàng xóm.</li>" +
          "</ul>" +
          "<b>Không có gì khác.</b> Không con đầu đàn, không kế hoạch, không con nào biết " +
          "đàn đang bay đâu. Reynolds gọi đây là <i>hành vi nổi lên</i>." +
          "<ul>" +
          "<li><b>Tắt từng luật:</b> chỉ <b>tránh đâm</b> → khí lý tưởng, tản đều. " +
          "Chỉ <b>lại gần</b> → một cục đặc quay loạn, chồng chất lên nhau. " +
          "Chỉ <b>đi cùng hướng</b> → cả đàn song song nhưng loãng dần ra và không giữ được " +
          "nhau. Phải có cả ba.</li>" +
          "<li><b>Đường cong dưới hình</b> là <i>độ đồng hướng</i>: độ dài trung bình của các " +
          "vector hướng. Nó bắt đầu quanh <b>0</b> (hướng ngẫu nhiên, triệt tiêu nhau) và leo " +
          "lên gần <b>1</b>. Đó là một <b>chuyển pha</b> — cùng loại toán với nam châm được " +
          "làm lạnh, nơi các spin tự sắp cùng chiều.</li>" +
          "<li><b>Thu tầm nhìn</b> xuống 3: đàn vỡ thành nhiều đàn nhỏ bay khác hướng, " +
          "độ đồng hướng tụt. Tăng số con lên để bù — <b>mật độ</b>, chứ không phải số lượng, " +
          "mới là thứ quyết định.</li>" +
          "<li>Mô hình này là thứ Hollywood dùng thật: đàn dơi trong <i>Batman Returns</i> " +
          "(1992) chạy đúng ba luật trên.</li>" +
          "</ul>"
      });
      r.trai.classList.add("co");

      requestAnimationFrame(function () { cv.doKichThuoc(); apDung(); });
    }
  });
})();
