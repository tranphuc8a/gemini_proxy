/* =====================================================================
   lab-life.js — Game of Life cua Conway va ho hang cua no.

   Hai luat, khong nguoi choi: o song co 2 hoac 3 hang xom thi song tiep,
   o chet co dung 3 hang xom thi sinh ra. Tu do moc ra tau luon, sung ban
   dan, va nhung thu chay 1103 the he roi moi chiu dung lai.
   ===================================================================== */
(function () {
  "use strict";
  var V = window.VIS;

  /* Luat viet kieu B/S: B3/S23 = sinh khi co 3 hang xom, song khi co 2 hoac 3. */
  var LUAT = {
    "B3/S23":     "Life của Conway — luật gốc",
    "B36/S23":    "HighLife — có hình tự nhân đôi",
    "B2/S":       "Seeds — bùng nổ rồi tắt",
    "B3678/S34678": "Day & Night — đối xứng sáng/tối",
    "B1357/S1357": "Replicator — cái gì cũng tự nhân bản",
    "B3/S12345":  "Maze — mọc thành mê cung"
  };

  function docLuat(s) {
    var b = new Uint8Array(9), t = new Uint8Array(9);
    var m = /^B([0-8]*)\/S([0-8]*)$/.exec(s) || ["", "3", "23"];
    for (var i = 0; i < m[1].length; i++) b[+m[1][i]] = 1;
    for (var j = 0; j < m[2].length; j++) t[+m[2][j]] = 1;
    return { sinh: b, song: t };
  }

  /* Hinh mau kinh dien, toa do tuong doi so voi diem dat. */
  var HINH = {
    "glider":      [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]],
    "r-pentomino": [[1, 0], [2, 0], [0, 1], [1, 1], [1, 2]],
    "acorn":       [[1, 0], [3, 1], [0, 2], [1, 2], [4, 2], [5, 2], [6, 2]],
    "blinker":     [[0, 0], [1, 0], [2, 0]],
    "sung-gosper": [
      [24, 0], [22, 1], [24, 1], [12, 2], [13, 2], [20, 2], [21, 2], [34, 2], [35, 2],
      [11, 3], [15, 3], [20, 3], [21, 3], [34, 3], [35, 3],
      [0, 4], [1, 4], [10, 4], [16, 4], [20, 4], [21, 4],
      [0, 5], [1, 5], [10, 5], [14, 5], [16, 5], [17, 5], [22, 5], [24, 5],
      [10, 6], [16, 6], [24, 6], [11, 7], [15, 7], [12, 8], [13, 8]
    ]
  };

  demo({
    id: "game-of-life",
    nhom: "Tự động tế bào",
    mon: "L08",
    ten: "Game of Life — hai dòng luật, vô hạn hành vi",
    moTa: "Không có người chơi. Mỗi ô chỉ nhìn 8 hàng xóm rồi quyết định sống hay chết. " +
          "Từ hai dòng luật đó mọc ra tàu lượn biết bay, súng bắn đạn, và " +
          "<b>máy tính Turing đầy đủ</b>. Thử <b>R-pentomino</b>: 5 ô, chạy 1103 thế hệ.",

    dung: function (host) {
      var N = 90;
      var o = null, moi = null;
      var L = null, P = null, Rnd = null;
      var theHe = 0, danSo = 0, sinhRa = 0, chetDi = 0, onDinhTu = -1;
      var lichSuDanSo = [];
      var luat = docLuat("B3/S23");

      var TS = V.thamSo([
        { ma: "luat", ten: "Luật", kieu: "chon", gt: "B3/S23",
          muc: Object.keys(LUAT).map(function (k) { return { v: k, t: k + " — " + LUAT[k] }; }) },
        { ma: "hinhMau", ten: "Khởi đầu", kieu: "chon", gt: "r-pentomino", muc: [
          { v: "r-pentomino", t: "R-pentomino (5 ô, 1103 thế hệ)" },
          { v: "acorn",       t: "Acorn (7 ô, 5206 thế hệ)" },
          { v: "glider",      t: "Tàu lượn (bay chéo mãi)" },
          { v: "blinker",     t: "Đèn nháy (chu kỳ 2)" },
          { v: "sung-gosper", t: "Súng Gosper (bắn tàu lượn vô tận)" },
          { v: "ngau-nhien",  t: "Súp ngẫu nhiên" }
        ] },
        { ma: "kichThuoc", ten: "Cạnh lưới", kieu: "so", min: 40, max: 300, buoc: 10, gt: 90 },
        { ma: "matDo", ten: "Mật độ súp ngẫu nhiên", kieu: "so",
          min: 0.05, max: 0.6, buoc: 0.01, gt: 0.3,
          hien: function (g) { return g.hinhMau === "ngau-nhien"; } },
        { ma: "hat", ten: "Hạt giống", kieu: "hat", gt: 5,
          hien: function (g) { return g.hinhMau === "ngau-nhien"; } },
        { ma: "vongQuanh", ten: "Mép lưới nối vòng quanh", kieu: "bat", gt: false,
          moTa: "Tắt: ra khỏi mép là mất. Bật: lưới thành mặt xuyến, tàu lượn bay vòng lại." }
      ], {
        doi: function () { apDung(); },
        preset: [
          { ten: "R-pentomino",       gt: { hinhMau: "r-pentomino", kichThuoc: 120, luat: "B3/S23" } },
          { ten: "Acorn",             gt: { hinhMau: "acorn", kichThuoc: 200, luat: "B3/S23" } },
          { ten: "Súng Gosper",       gt: { hinhMau: "sung-gosper", kichThuoc: 120, luat: "B3/S23" } },
          { ten: "Súp ngẫu nhiên",    gt: { hinhMau: "ngau-nhien", kichThuoc: 150, matDo: 0.3 } },
          { ten: "Seeds — bùng nổ",   gt: { hinhMau: "ngau-nhien", luat: "B2/S", matDo: 0.08, kichThuoc: 150 } },
          { ten: "Mê cung",           gt: { hinhMau: "ngau-nhien", luat: "B3/S12345", matDo: 0.1, kichThuoc: 150 } }
        ]
      });

      var G = TS.gt;

      var cv = V.veBangCo({ rong: 860, tiLe: 0.82, veLai: function () { if (P) apDung(); } });
      var g = cv.g;
      var S = V.soLieu();
      var ghiChu = V.el("div", { class: "chu-thich" });

      /* ============================================================
         Mo phong
         ============================================================ */
      function datHinh(ten) {
        var d = HINH[ten];
        if (!d) return;
        var rongH = 0, caoH = 0, i;
        for (i = 0; i < d.length; i++) {
          if (d[i][0] > rongH) rongH = d[i][0];
          if (d[i][1] > caoH) caoH = d[i][1];
        }
        var ox = Math.floor((N - rongH) / 2), oy = Math.floor((N - caoH) / 2);
        for (i = 0; i < d.length; i++) {
          var c = ox + d[i][0], r = oy + d[i][1];
          if (c >= 0 && r >= 0 && c < N && r < N) o[r * N + c] = 1;
        }
      }

      function chuanBi() {
        N = Math.round(G.kichThuoc);
        luat = docLuat(G.luat);
        o = new Uint8Array(N * N);
        moi = new Uint8Array(N * N);
        theHe = 0; sinhRa = 0; chetDi = 0; onDinhTu = -1;
        lichSuDanSo = [];

        if (G.hinhMau === "ngau-nhien") {
          Rnd = V.rng(Math.round(G.hat) || 1);
          for (var i = 0; i < N * N; i++) o[i] = Rnd() < G.matDo ? 1 : 0;
        } else {
          datHinh(G.hinhMau);
        }
        danSo = dem();
        lichSuDanSo.push([0, danSo]);

        L = V.luoiO(cv, { cot: N, hang: N, le: 10, leTren: 26 });
        L.bangMau([V.mau("bg2"), V.mau("ac")]);
      }

      function dem() {
        var n = 0;
        for (var i = 0; i < o.length; i++) n += o[i];
        return n;
      }

      function motTheHe() {
        var vong = G.vongQuanh;
        var s = 0, c2 = 0;
        for (var r = 0; r < N; r++) {
          for (var c = 0; c < N; c++) {
            var hx = 0;
            for (var dr = -1; dr <= 1; dr++) {
              for (var dc = -1; dc <= 1; dc++) {
                if (!dc && !dr) continue;
                var nc = c + dc, nr = r + dr;
                if (vong) {
                  nc = (nc + N) % N; nr = (nr + N) % N;
                } else if (nc < 0 || nr < 0 || nc >= N || nr >= N) continue;
                hx += o[nr * N + nc];
              }
            }
            var i = r * N + c;
            var song = o[i]
              ? luat.song[hx]
              : luat.sinh[hx];
            moi[i] = song ? 1 : 0;
            if (song && !o[i]) s++;
            if (!song && o[i]) c2++;
          }
        }
        var tam = o; o = moi; moi = tam;
        sinhRa = s; chetDi = c2;
        theHe++;
        danSo = dem();
        if (lichSuDanSo.length < 4000) lichSuDanSo.push([theHe, danSo]);
        /* Khong sinh khong chet = da dung han (van co the la chu ky 1). */
        if (s === 0 && c2 === 0 && onDinhTu < 0) onDinhTu = theHe;
        return true;
      }

      /* ============================================================
         Ve
         ============================================================ */
      function ve() {
        g.clearRect(0, 0, cv.W, cv.H);
        g.fillStyle = V.mau("surf");
        g.fillRect(0, 0, cv.W, cv.H);
        L.tuMang(o);
        L.dan();
        L.vien();

        g.fillStyle = V.mau("tx3");
        g.font = "11px ui-monospace,monospace";
        g.textAlign = "left"; g.textBaseline = "top";
        g.fillText(G.luat + "   lưới " + N + "×" + N +
                   (G.vongQuanh ? "   (nối vòng quanh)" : "   (mép là vực)"), 10, 7);

        var dinh = 0;
        for (var i = 0; i < lichSuDanSo.length; i++) {
          if (lichSuDanSo[i][1] > dinh) dinh = lichSuDanSo[i][1];
        }
        S.dat({
          "Thế hệ": theHe.toLocaleString("vi"),
          "Dân số": danSo.toLocaleString("vi"),
          "Sinh ra / chết đi": sinhRa + " / " + chetDi,
          "Dân số cao nhất": dinh.toLocaleString("vi"),
          "Trạng thái": onDinhTu >= 0
            ? ("đứng yên từ thế hệ " + onDinhTu.toLocaleString("vi"))
            : (danSo === 0 ? "tuyệt chủng" : "còn biến động")
        });
      }

      /* ============================================================
         Bam chuot: bat/tat mot o khi dang tam dung
         ============================================================ */
      cv.addEventListener("mousedown", function (e) {
        if (P.dangChay()) return;
        var r = cv.getBoundingClientRect();
        var oo = L.oTai((e.clientX - r.left) * cv.W / r.width,
                        (e.clientY - r.top) * cv.H / r.height);
        if (!oo) return;
        o[oo.i] = o[oo.i] ? 0 : 1;
        danSo = dem();
        onDinhTu = -1;
        P.veLai();
      });

      /* ============================================================
         Dieu phoi
         ============================================================ */
      function apDung() {
        if (!cv.W) return;
        chuanBi();
        P.datToiDa(6000);
        P.datTocDo(G.hinhMau === "blinker" || G.hinhMau === "glider" ? 6 : 30);
        ghiChu.innerHTML = "";
        [[V.mau("ac"), "ô sống"], [V.mau("bg2"), "ô chết"]].forEach(function (c) {
          ghiChu.appendChild(V.el("span", {}, [
            V.el("i", { class: "o-mau", style: "background:" + c[0] }), c[1]
          ]));
        });
        ghiChu.appendChild(V.el("span", { html:
          "<b>Tạm dừng rồi bấm vào lưới</b> để bật/tắt từng ô." }));
        P.datLai();
      }

      P = V.phat({
        ten: "game-of-life",
        bang: cv,
        tocDo: 30,
        buoc: function () { return motTheHe(); },
        datLai: function () { chuanBi(); },
        ve: ve,
        nhan: function () {
          return "thế hệ " + theHe.toLocaleString("vi") + ", dân số " + danSo.toLocaleString("vi");
        }
      });

      var r = V.khung(host, {
        ten: "game-of-life",
        bang: cv,
        ve: [cv, ghiChu],
        dieuKhien: [P.dk(), TS.dk(), S.el],
        giaiThich:
          "<b>Luật Conway (B3/S23):</b> ô đang sống mà có <b>2 hoặc 3</b> hàng xóm thì sống tiếp, " +
          "không thì chết. Ô đang chết mà có <b>đúng 3</b> hàng xóm thì sinh ra. Toàn bộ trò chơi " +
          "nằm trong hai câu đó." +
          "<ul>" +
          "<li><b>R-pentomino</b> — chỉ <b>5 ô</b>. Nó quẫy đạp <b>1103 thế hệ</b>, phun ra 6 tàu " +
          "lượn, rồi mới chịu đứng yên với 116 ô còn lại. Không có cách nào biết trước con số 1103 " +
          "ngoài việc… chạy thử. Đó là <b>tính bất khả quy về tính toán</b>.</li>" +
          "<li><b>Súng Gosper</b> — cỗ máy đầu tiên chứng minh Life có thể tăng trưởng vô hạn. " +
          "Nó nhả ra một tàu lượn mỗi 30 thế hệ, mãi mãi. Bật <i>nối vòng quanh</i> rồi xem đạn " +
          "quay lại bắn vào chính khẩu súng.</li>" +
          "<li><b>Đổi luật</b> — <i>Seeds</i> (B2/S) bùng nổ rồi tắt ngóm; <i>Replicator</i> " +
          "biến mọi hình thành bản sao của chính nó; <i>Maze</i> mọc thành mê cung đứng yên. " +
          "Cùng một khung, đổi vài chữ số là ra một vũ trụ khác.</li>" +
          "<li><b>Mép lưới quan trọng.</b> Tắt <i>nối vòng quanh</i> thì mép là vực — tàu lượn bay " +
          "ra là mất, và kết quả khác hẳn. Mọi mô phỏng lưới đều phải trả lời câu hỏi này.</li>" +
          "</ul>" +
          "<b>Life là Turing đầy đủ:</b> người ta đã dựng được cổng logic, bộ nhớ, và cả một " +
          "máy tính chạy Life <i>bên trong</i> Life. Từ hai dòng luật."
      });
      r.trai.classList.add("co");

      requestAnimationFrame(function () { cv.doKichThuoc(); apDung(); });
    }
  });
})();
