/* =====================================================================
   lab-raft.js — Dong thuan Raft.

   Bai toan: N may phai thong nhat voi nhau ve mot day lenh, trong khi
   may co the chet bat ky luc nao va mang co the dut bat ky luc nao.

   Raft (Ongaro & Ousterhout, 2014) giai bang ba y: nhiem ky, bau cu co
   qua ban, va mot day nhat ky chi noi them. Lab nay chay dung ba y do —
   giet may va cat mang duoc bang chuot.
   ===================================================================== */
(function () {
  "use strict";
  var V = window.VIS;

  var THEO = 0, UNG_VIEN = 1, LANH_DAO = 2, CHET = 3;
  var TEN_VAI = ["đi theo", "ứng viên", "lãnh đạo", "đã chết"];

  demo({
    id: "raft",
    nhom: "Mạng lưới & phân tán",
    mon: "L21",
    ten: "Raft — làm sao để một đám máy thống nhất khi máy cứ chết",
    moTa: "N máy phải thống nhất về một dãy lệnh, trong khi máy có thể chết bất kỳ lúc " +
          "nào và mạng có thể đứt bất kỳ lúc nào. <b>Bấm vào một máy để giết nó</b>, " +
          "bấm lại để hồi sinh. Xem cụm bầu lãnh đạo mới, và xem chuyện gì xảy ra khi " +
          "bạn giết quá nửa.",

    dung: function (host) {
      var N = 5;
      var vai = null, nhiemKy = null, boPhieuCho = null, dongHo = null;
      var nhatKy = null;            /* mang cac mang lenh cua tung may */
      var daGhi = null;             /* so lenh da duoc qua ban xac nhan */
      var soPhieu = null;
      var Rnd = null;
      var DT = null, P = null;
      var nhatKyHeThong = 0;        /* so lenh khach da gui */
      var soLanBau = 0, buocDem = 0;
      var tinNhan = [];
      /* Dem so lan VI PHAM tinh an toan cot loi cua Raft: hai lanh dao
         cung mot nhiem ky. Con so nay phai la 0 mai mai, du giet may hay
         cat mang the nao. Do moi la thu dang kiem — chu khong phai
         "lab co chay khong". */
      var viPhamAnToan = 0;
      var canhDut = {};             /* "a,b" -> true neu duong noi bi cat */

      var TS = V.thamSo([
        { ma: "soMay", ten: "Số máy trong cụm", kieu: "so", min: 3, max: 9, buoc: 2, gt: 5,
          moTa: "Luôn để số lẻ. Quá bán của 5 là 3, của 4 cũng là 3 — thêm máy chẵn " +
                "không tăng khả năng chịu lỗi mà chỉ thêm chỗ hỏng." },
        { ma: "hetGio", ten: "Thời gian chờ trước khi đòi bầu lại", kieu: "so",
          min: 8, max: 60, buoc: 2, gt: 20,
          moTa: "Mỗi máy chờ một khoảng <b>ngẫu nhiên</b> quanh mức này. Ngẫu nhiên là " +
                "phần cốt lõi: nếu mọi máy chờ bằng nhau, chúng sẽ cùng ứng cử mãi và " +
                "<b>không bao giờ</b> bầu xong." },
        { ma: "nhipTim", ten: "Nhịp tim của lãnh đạo", kieu: "so", min: 2, max: 20, buoc: 1, gt: 6 },
        { ma: "tyLeMat", ten: "Tỉ lệ tin nhắn bị mất", kieu: "so",
          min: 0, max: 0.6, buoc: 0.02, gt: 0.04 },
        { ma: "tanSuatLenh", ten: "Khách gửi lệnh mỗi bao nhiêu bước", kieu: "so",
          min: 5, max: 60, buoc: 5, gt: 20 },
        { ma: "hat", ten: "Hạt giống", kieu: "hat", gt: 2 }
      ], {
        doi: function () { apDung(); },
        preset: [
          { ten: "Cụm 5 máy bình thường", gt: { soMay: 5, tyLeMat: 0.04 } },
          { ten: "Mạng tệ (30% mất tin)", gt: { soMay: 5, tyLeMat: 0.3 } },
          { ten: "Mạng rất tệ (55%)",     gt: { soMay: 5, tyLeMat: 0.55 } },
          { ten: "Cụm 9 máy",             gt: { soMay: 9, tyLeMat: 0.04 } },
          { ten: "Chờ ngắn — hay bầu lại", gt: { soMay: 5, hetGio: 9 } }
        ]
      });

      var G = TS.gt;

      var cv = V.veBangCo({ rong: 880, tiLe: 0.78, veLai: function () { if (P) apDung(); } });
      var g = cv.g;
      var S = V.soLieu();
      var ghiChu = V.el("div", { class: "chu-thich" });

      function quaBan() { return Math.floor(N / 2) + 1; }

      /* ============================================================
         Khoi tao
         ============================================================ */
      function chuanBi() {
        N = Math.round(G.soMay);
        Rnd = V.rng(Math.round(G.hat) || 1);
        vai = new Uint8Array(N);
        nhiemKy = new Int32Array(N);
        boPhieuCho = new Int32Array(N);
        dongHo = new Int32Array(N);
        soPhieu = new Int32Array(N);
        daGhi = new Int32Array(N);
        nhatKy = [];
        for (var i = 0; i < N; i++) {
          vai[i] = THEO;
          boPhieuCho[i] = -1;
          dongHo[i] = hetGioMoi();
          nhatKy.push([]);
        }
        nhatKyHeThong = 0; soLanBau = 0; buocDem = 0; viPhamAnToan = 0;
        tinNhan = []; canhDut = {};

        DT = V.doThi(cv, { soToiDa: N, le: 30, leTren: 30, leDuoi: 30 });
        for (i = 0; i < N; i++) DT.themNut();
        for (i = 0; i < N; i++) for (var j = i + 1; j < N; j++) DT.themCanh(i, j);
        DT.boCucTron();
      }

      function hetGioMoi() {
        /* Khoang cho NGAU NHIEN — day la thu ngan cac may cung ung cu mai mai. */
        return Math.round(G.hetGio * (1 + Rnd()));
      }

      function noiDuoc(a, b) {
        if (vai[a] === CHET || vai[b] === CHET) return false;
        var kh = a < b ? a + "," + b : b + "," + a;
        if (canhDut[kh]) return false;
        return Rnd() >= G.tyLeMat;
      }

      /* ============================================================
         Mot buoc cua cum
         ============================================================ */
      function motBuoc() {
        var i, j;
        tinNhan = [];

        /* --- khach gui lenh cho lanh dao --- */
        if (buocDem > 0 && buocDem % Math.round(G.tanSuatLenh) === 0) {
          for (i = 0; i < N; i++) {
            if (vai[i] === LANH_DAO) {
              nhatKyHeThong++;
              nhatKy[i].push({ ky: nhiemKy[i], so: nhatKyHeThong });
              break;
            }
          }
        }

        /* --- dong ho tung may --- */
        for (i = 0; i < N; i++) {
          if (vai[i] === CHET) continue;
          dongHo[i]--;

          if (vai[i] === LANH_DAO) {
            /* Lanh dao gui nhip tim + sao chep nhat ky. */
            if (dongHo[i] <= 0) {
              dongHo[i] = Math.round(G.nhipTim);
              var xacNhan = 1;                 /* tinh ca chinh minh */
              for (j = 0; j < N; j++) {
                if (j === i || vai[j] === CHET) continue;
                if (!noiDuoc(i, j)) continue;
                tinNhan.push([i, j, "tim"]);
                /* Nguoi nhan chap nhan lanh dao neu nhiem ky khong cu hon. */
                if (nhiemKy[j] <= nhiemKy[i]) {
                  nhiemKy[j] = nhiemKy[i];
                  vai[j] = THEO;
                  boPhieuCho[j] = i;
                  dongHo[j] = hetGioMoi();
                  /* Sao chep nhat ky: chi noi them, khong bao gio sua cu. */
                  nhatKy[j] = nhatKy[i].slice();
                  xacNhan++;
                }
              }
              /* Lenh chi duoc GHI khi qua ban da nhan duoc. */
              if (xacNhan >= quaBan()) {
                daGhi[i] = nhatKy[i].length;
                for (j = 0; j < N; j++) if (vai[j] === THEO) daGhi[j] = Math.min(daGhi[i], nhatKy[j].length);
              }
            }
          } else if (dongHo[i] <= 0) {
            /* Het gio cho mà khong nghe thay lanh dao -> tu ung cu. */
            vai[i] = UNG_VIEN;
            nhiemKy[i]++;
            boPhieuCho[i] = i;
            soPhieu[i] = 1;
            dongHo[i] = hetGioMoi();
            soLanBau++;

            for (j = 0; j < N; j++) {
              if (j === i || vai[j] === CHET) continue;
              if (!noiDuoc(i, j)) continue;
              tinNhan.push([i, j, "phieu"]);
              /* Bo phieu neu nhiem ky cua ung vien moi hon va minh chua bo
                 phieu trong nhiem ky do, VA nhat ky cua ung vien khong cu hon. */
              var duMoi = nhiemKy[i] > nhiemKy[j];
              var nhatKyDu = nhatKy[i].length >= nhatKy[j].length;
              if (duMoi && nhatKyDu) {
                nhiemKy[j] = nhiemKy[i];
                boPhieuCho[j] = i;
                vai[j] = THEO;
                dongHo[j] = hetGioMoi();
                soPhieu[i]++;
              }
            }
            if (soPhieu[i] >= quaBan()) {
              vai[i] = LANH_DAO;
              dongHo[i] = 0;                  /* gui nhip tim ngay */
            }
          }
        }

        /* Kiem tinh an toan sau MOI buoc: moi nhiem ky nhieu nhat mot lanh dao. */
        var ldTheoKy = {};
        for (i = 0; i < N; i++) {
          if (vai[i] !== LANH_DAO) continue;
          if (ldTheoKy[nhiemKy[i]]) viPhamAnToan++;
          ldTheoKy[nhiemKy[i]] = 1;
        }

        buocDem++;
        return true;
      }

      /* ============================================================
         Ve
         ============================================================ */
      function ve() {
        g.clearRect(0, 0, cv.W, cv.H);
        g.fillStyle = V.mau("surf");
        g.fillRect(0, 0, cv.W, cv.H);

        /* --- duong noi, duong bi cat ve nhat va dut --- */
        DT.veCanh(function (k, a, b) {
          var kh = a < b ? a + "," + b : b + "," + a;
          return canhDut[kh] ? null : V.mau("bd2");
        }, 1.4, 0.8);
        g.save();
        g.strokeStyle = V.mau("loi"); g.lineWidth = 1.4; g.setLineDash([3, 4]);
        for (var k = 0; k < DT.canh.length; k++) {
          var a = DT.canh[k][0], b = DT.canh[k][1];
          var kh = a < b ? a + "," + b : b + "," + a;
          if (!canhDut[kh]) continue;
          g.beginPath();
          g.moveTo(DT.px(a), DT.py(a)); g.lineTo(DT.px(b), DT.py(b));
          g.stroke();
        }
        g.setLineDash([]);
        g.restore();

        /* --- tin nhan dang bay --- */
        g.save();
        g.lineWidth = 2.2;
        for (k = 0; k < tinNhan.length; k++) {
          var t = tinNhan[k];
          g.strokeStyle = t[2] === "tim" ? V.mau("ok") : V.mau("ba");
          g.globalAlpha = 0.85;
          var x1 = DT.px(t[0]), y1 = DT.py(t[0]);
          var x2 = DT.px(t[1]), y2 = DT.py(t[1]);
          g.beginPath();
          g.moveTo(x1, y1);
          g.lineTo(x1 + (x2 - x1) * 0.62, y1 + (y2 - y1) * 0.62);
          g.stroke();
        }
        g.restore();

        /* --- may --- */
        var mauVai = [V.mau("ac"), V.mau("ba"), V.mau("ok"), V.mau("bd")];
        var bk = Math.max(16, Math.min(30, 260 / N));
        for (var i = 0; i < N; i++) {
          var x = DT.px(i), y = DT.py(i);
          g.fillStyle = mauVai[vai[i]];
          g.beginPath(); g.arc(x, y, bk, 0, 6.2832); g.fill();
          if (vai[i] === LANH_DAO) {
            g.strokeStyle = V.mau("tx"); g.lineWidth = 2.5;
            g.beginPath(); g.arc(x, y, bk + 4, 0, 6.2832); g.stroke();
          }
          if (vai[i] === CHET) {
            g.strokeStyle = V.mau("loi"); g.lineWidth = 2.5;
            g.beginPath();
            g.moveTo(x - bk * 0.5, y - bk * 0.5); g.lineTo(x + bk * 0.5, y + bk * 0.5);
            g.moveTo(x + bk * 0.5, y - bk * 0.5); g.lineTo(x - bk * 0.5, y + bk * 0.5);
            g.stroke();
          }
          g.fillStyle = vai[i] === CHET ? V.mau("tx3") : "#fff";
          g.font = "600 " + Math.round(bk * 0.5) + "px system-ui,sans-serif";
          g.textAlign = "center"; g.textBaseline = "middle";
          g.fillText("S" + i, x, y - bk * 0.22);
          g.font = Math.round(bk * 0.38) + "px ui-monospace,monospace";
          g.fillText("T" + nhiemKy[i] + " · " + nhatKy[i].length, x, y + bk * 0.32);
        }

        g.fillStyle = V.mau("tx3");
        g.font = "11px ui-monospace,monospace";
        g.textAlign = "left"; g.textBaseline = "top";
        g.fillText("T = nhiệm kỳ · số sau = độ dài nhật ký · bấm vào máy để giết/hồi sinh · " +
                   "bấm vào đường nối để cắt", 12, 8);

        /* --- so lieu --- */
        var lanhDao = -1, soSong = 0, kyCaoNhat = 0, dongY = 0;
        for (i = 0; i < N; i++) {
          if (vai[i] === LANH_DAO) lanhDao = i;
          if (vai[i] !== CHET) soSong++;
          if (nhiemKy[i] > kyCaoNhat) kyCaoNhat = nhiemKy[i];
        }
        var doDaiChung = lanhDao >= 0 ? nhatKy[lanhDao].length : 0;
        for (i = 0; i < N; i++) {
          if (vai[i] !== CHET && nhatKy[i].length === doDaiChung) dongY++;
        }
        S.dat({
          "Máy sống / tổng": soSong + " / " + N,
          "Quá bán cần có": quaBan() + " máy",
          "Lãnh đạo hiện tại": lanhDao >= 0 ? ("S" + lanhDao + " (nhiệm kỳ " + nhiemKy[lanhDao] + ")")
                                            : "KHÔNG CÓ — đang bầu",
          "Nhiệm kỳ cao nhất": kyCaoNhat,
          "Số lần phải bầu lại": soLanBau,
          "Lệnh khách đã gửi": nhatKyHeThong,
          "Máy có nhật ký khớp lãnh đạo": lanhDao >= 0 ? (dongY + " / " + soSong) : "—",
          "⚑ Hai lãnh đạo cùng nhiệm kỳ": viPhamAnToan === 0
            ? "chưa bao giờ — an toàn"
            : ("VI PHẠM " + viPhamAnToan + " lần"),
          "Trạng thái cụm": soSong < quaBan()
            ? "MẤT QUÁ BÁN — cụm không ghi được gì nữa"
            : (lanhDao >= 0 ? "khoẻ, đang nhận lệnh" : "đang bầu lại")
        });
      }

      /* ============================================================
         Chuot: giet may, cat duong noi
         ============================================================ */
      cv.addEventListener("mousedown", function (e) {
        var r = cv.getBoundingClientRect();
        var mx = (e.clientX - r.left) * cv.W / r.width;
        var my = (e.clientY - r.top) * cv.H / r.height;

        var bk = Math.max(16, Math.min(30, 260 / N));
        var i = DT.nutTai(mx, my, bk + 4);
        if (i >= 0) {
          if (vai[i] === CHET) {
            /* Hoi sinh: quay ve vai di theo, nhat ky giu nguyen (dia con do). */
            vai[i] = THEO;
            dongHo[i] = hetGioMoi();
          } else {
            vai[i] = CHET;
          }
          P.veLai();
          return;
        }

        /* Bam gan mot duong noi -> cat / noi lai. */
        var tot = -1, gan = 14 * 14;
        for (var k = 0; k < DT.canh.length; k++) {
          var a = DT.canh[k][0], b = DT.canh[k][1];
          var x1 = DT.px(a), y1 = DT.py(a), x2 = DT.px(b), y2 = DT.py(b);
          var vx = x2 - x1, vy = y2 - y1;
          var L2 = vx * vx + vy * vy;
          var t = L2 ? ((mx - x1) * vx + (my - y1) * vy) / L2 : 0;
          t = Math.max(0, Math.min(1, t));
          var ex = x1 + vx * t - mx, ey = y1 + vy * t - my;
          var d2 = ex * ex + ey * ey;
          if (d2 < gan) { gan = d2; tot = k; }
        }
        if (tot >= 0) {
          var aa = DT.canh[tot][0], bb = DT.canh[tot][1];
          var kh = aa < bb ? aa + "," + bb : bb + "," + aa;
          if (canhDut[kh]) delete canhDut[kh]; else canhDut[kh] = true;
          P.veLai();
        }
      });

      /* ============================================================
         Dieu phoi
         ============================================================ */
      function apDung() {
        if (!cv.W) return;
        chuanBi();
        P.datToiDa(20000);
        P.datTocDo(8);
        ghiChu.innerHTML = "";
        [[V.mau("ac"), "đi theo"], [V.mau("ba"), "ứng viên"],
         [V.mau("ok"), "lãnh đạo"], [V.mau("bd"), "đã chết"],
         [V.mau("loi"), "đường nối bị cắt"]].forEach(function (c) {
          ghiChu.appendChild(V.el("span", {}, [
            V.el("i", { class: "o-mau", style: "background:" + c[0] }), c[1]
          ]));
        });
        P.datLai();
      }

      P = V.phat({
        ten: "raft",
        bang: cv,
        tocDo: 8,
        buoc: function () { return motBuoc(); },
        datLai: function () { chuanBi(); },
        ve: ve,
        nhan: function () {
          for (var i = 0; i < N; i++) if (vai[i] === LANH_DAO) {
            return "lãnh đạo S" + i + ", nhiệm kỳ " + nhiemKy[i];
          }
          return "không có lãnh đạo — đang bầu";
        }
      });

      var r = V.khung(host, {
        ten: "raft",
        bang: cv,
        ve: [cv, ghiChu],
        dieuKhien: [P.dk(), TS.dk(), S.el],
        giaiThich:
          "<b>Bài toán:</b> N máy phải thống nhất về <i>cùng một dãy lệnh, cùng thứ tự</i>, " +
          "trong khi máy chết bất kỳ lúc nào và mạng đứt bất kỳ lúc nào. Đây là nền móng của " +
          "etcd (tức Kubernetes), Consul, TiDB, CockroachDB." +
          "<ul>" +
          "<li><b>Nhiệm kỳ</b> — thời gian chia thành các nhiệm kỳ đánh số tăng dần. Mỗi nhiệm " +
          "kỳ có nhiều nhất một lãnh đạo. Số nhiệm kỳ lớn hơn <b>luôn thắng</b>: nghe thấy ai " +
          "có nhiệm kỳ mới hơn thì lập tức lùi về làm người đi theo.</li>" +
          "<li><b>Quá bán</b> — muốn thành lãnh đạo phải được quá nửa số máy bầu; muốn ghi một " +
          "lệnh phải được quá nửa xác nhận. Hai tập quá bán bất kỳ <b>luôn giao nhau ở ít nhất " +
          "một máy</b> — và chính điều đó khiến hai lãnh đạo cùng nhiệm kỳ là bất khả.</li>" +
          "<li><b>Thời gian chờ ngẫu nhiên</b> — mỗi máy chờ một khoảng khác nhau trước khi ứng " +
          "cử. Nếu mọi máy chờ bằng nhau, chúng sẽ cùng ứng cử, cùng chia phiếu, cùng thất bại, " +
          "mãi mãi. Ngẫu nhiên phá thế bế tắc đó — đơn giản đến bất ngờ.</li>" +
          "</ul>" +
          "<b>Hãy thử phá nó:</b>" +
          "<ul>" +
          "<li><b>Giết lãnh đạo</b> (bấm vào máy có viền). Nhịp tim ngừng, một máy hết giờ chờ, " +
          "tự ứng cử, nhiệm kỳ tăng, và cụm có lãnh đạo mới trong vài bước. Dịch vụ gián đoạn " +
          "đúng bằng thời gian chờ — đó là lý do người ta chỉnh nó xuống hàng trăm mili giây.</li>" +
          "<li><b>Giết 2 trong 5 máy</b> — cụm vẫn chạy: còn 3, đúng bằng quá bán. " +
          "<b>Giết máy thứ 3</b> — cụm <b>đứng hình</b>. Còn 2 máy, không bao giờ đủ quá bán, " +
          "không bầu được ai, không ghi được gì. Raft chọn <b>thà dừng còn hơn sai</b>.</li>" +
          "<li><b>Cắt đường nối</b> (bấm vào một cạnh) để chia cụm thành hai phe. Phe có quá bán " +
          "vẫn làm việc; phe thiểu số có thể bầu ứng viên nhưng <b>không bao giờ đủ phiếu</b>. " +
          "Khi nối lại, phe thiểu số thấy nhiệm kỳ cao hơn và lùi về — nhật ký của nó bị ghi đè. " +
          "<b>Không có hai lịch sử song song.</b></li>" +
          "<li><b>Kéo tỉ lệ mất tin lên 55%</b>: cụm bầu đi bầu lại liên tục, số lần bầu vọt lên " +
          "mà lệnh gần như không ghi được. Mạng đủ tệ thì không thuật toán đồng thuận nào cứu " +
          "được — đây chính là cái giá của chữ <b>P</b> trong định lý CAP.</li>" +
          "</ul>" +
          "<i>Lưu ý:</i> đây là bản rút gọn cho dễ nhìn — đủ ba ý cốt lõi (nhiệm kỳ, quá bán, " +
          "nhật ký chỉ nối thêm), nhưng lược bỏ chỉ số nhật ký chi tiết, ảnh chụp trạng thái " +
          "và thay đổi thành viên cụm."
      });
      r.trai.classList.add("co");

      requestAnimationFrame(function () { cv.doKichThuoc(); apDung(); });
    }
  });
})();
