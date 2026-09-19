/* =====================================================================
   Bo sung 3 — Doc bai bao, AI ky hieu, van hanh
   thi-nghiem-gay-hieu-nham (M10) · suy-dien-tien-lui (M11) · troi-du-lieu (M13)
   ===================================================================== */
(function () {
  var V = window.VIS;

  /* ================================================================
     M10 — cac kieu thi nghiem gay hieu nham
     ================================================================ */
  demo({
    id: "thi-nghiem-gay-hieu-nham", nhom: "Hệ thống & đánh giá", mon: "M10",
    ten: "Cùng một dữ liệu, năm cách vẽ khác nhau",
    moTa: "Không ai bịa số. Người ta chỉ <b>chọn cách trình bày</b>. " +
          "Xem cùng một kết quả trông thuyết phục hay tầm thường.",
    lienKet: '<a href="../web/index.html#/bai/m10-bai-03-doc-phan-thi-nghiem-va-ablation">M10 b.3</a>',
    dung: function (host) {
      var W = 560, H = 300, W2 = 560, H2 = 250;
      var cv = V.veBang(W, H), g = cv.g;
      var cv2 = V.veBang(W2, H2), g2 = cv2.g;

      var tt = { kieu: "trungthuc" };

      /* du lieu THAT: baseline 71.2, phuong phap moi 72.0, sigma 0.9, n=5 seed */
      var THAT = { a: 71.2, b: 72.0, sd: 0.9, n: 5 };

      var KIEU = {
        trungthuc: {
          t: "① Trình bày trung thực",
          mo: "Trục từ 0, có thanh sai số ±1 SE trên 5 hạt giống.",
          y0: 0, y1: 100, saiSo: true, nhan: "+0,8 điểm (SE ±0,40) — nằm trong nhiễu"
        },
        cattruc: {
          t: "② Cắt trục y",
          mo: "Vẫn đúng số liệu — nhưng trục bắt đầu ở 70,5 thay vì 0.",
          y0: 70.5, y1: 72.5, saiSo: true, nhan: "Cùng dữ liệu. Cột cao gấp đôi. Không sai một chữ số nào."
        },
        khongsaiso: {
          t: "③ Bỏ thanh sai số",
          mo: "Chỉ hiện giá trị trung bình. Không ai nói dối, chỉ là không nói.",
          y0: 70.5, y1: 72.5, saiSo: false, nhan: "Người đọc không có cách nào biết 0,8 có ý nghĩa hay không."
        },
        chonhat: {
          t: "④ Báo cáo hạt giống tốt nhất",
          mo: "Chạy 5 hạt giống, báo cáo cái cao nhất — cho phương pháp mới.",
          y0: 70.5, y1: 73.5, saiSo: false, chon: true,
          nhan: "E[max] của 5 lần rút ≈ +1,16 SD ⇒ tự do thêm ~1,0 điểm."
        },
        baseyeu: {
          t: "⑤ Đường cơ sở bị điều chỉnh kém",
          mo: "Phương pháp mới được quét 200 cấu hình; baseline lấy mặc định.",
          y0: 70.5, y1: 73.5, saiSo: false, yeu: true,
          nhan: "So sánh không công bằng — và gần như không bao giờ được ghi lại."
        }
      };

      function ve() {
        g.clearRect(0, 0, W, H);
        var K = KIEU[tt.kieu];
        var padL = 60, padT = 42, padB = 46;
        var w = W - padL - 20, h = H - padT - padB;

        g.fillStyle = V.mau("ac"); g.font = "700 13px system-ui"; g.textAlign = "left";
        g.fillText(K.t, 14, 20);
        g.fillStyle = V.mau("tx2"); g.font = "11px system-ui";
        g.fillText(K.mo, 14, 36);

        var a = THAT.a, b = THAT.b;
        if (K.chon) b = THAT.b + 1.0;              /* chon hat giong tot nhat */
        if (K.yeu) a = THAT.a - 0.9;               /* baseline bi bo doi */

        var Y = function (v) {
          return padT + h - (v - K.y0) / (K.y1 - K.y0) * h;
        };

        /* truc */
        g.strokeStyle = V.mau("bd2"); g.lineWidth = 1;
        g.fillStyle = V.mau("tx3"); g.font = "10px system-ui"; g.textAlign = "right";
        var i;
        for (i = 0; i <= 4; i++) {
          var v = K.y0 + (K.y1 - K.y0) * i / 4, yy = Y(v);
          g.beginPath(); g.moveTo(padL, yy); g.lineTo(padL + w, yy); g.stroke();
          g.fillText(v.toFixed(K.y1 - K.y0 < 10 ? 1 : 0), padL - 6, yy + 3);
        }

        /* cot */
        var bw = 90, gap = 70;
        [{ v: a, t: "Đường cơ sở", mau: V.mau("tx3") },
         { v: b, t: "Phương pháp mới", mau: V.mau("ac") }
        ].forEach(function (q, k) {
          var x = padL + 60 + k * (bw + gap);
          var yy = Y(q.v);
          g.fillStyle = q.mau;
          g.fillRect(x, yy, bw, padT + h - yy);
          g.fillStyle = V.mau("tx"); g.font = "700 12px ui-monospace, monospace";
          g.textAlign = "center";
          g.fillText(q.v.toFixed(1), x + bw / 2, yy - 8);
          g.fillStyle = V.mau("tx2"); g.font = "11px system-ui";
          g.fillText(q.t, x + bw / 2, padT + h + 16);

          if (K.saiSo) {
            var se = THAT.sd / Math.sqrt(THAT.n);
            var y1 = Y(q.v + se), y2 = Y(q.v - se);
            g.strokeStyle = V.mau("tx"); g.lineWidth = 1.6;
            g.beginPath();
            g.moveTo(x + bw / 2, y1); g.lineTo(x + bw / 2, y2);
            g.moveTo(x + bw / 2 - 10, y1); g.lineTo(x + bw / 2 + 10, y1);
            g.moveTo(x + bw / 2 - 10, y2); g.lineTo(x + bw / 2 + 10, y2);
            g.stroke();
          }
        });

        g.textAlign = "left";
        g.fillStyle = tt.kieu === "trungthuc" ? "#0f766e" : V.mau("loi");
        g.font = "700 11.5px system-ui";
        g.fillText(K.nhan, 14, H - 12);
      }

      function ve2() {
        g2.clearRect(0, 0, W2, H2);
        var se = THAT.sd / Math.sqrt(THAT.n);
        g2.fillStyle = V.mau("tx"); g2.font = "600 12.5px system-ui"; g2.textAlign = "left";
        g2.fillText("Sự thật của bộ dữ liệu này (không đổi ở mọi cách vẽ):", 14, 20);

        var dong = [
          ["Đường cơ sở", THAT.a.toFixed(1)],
          ["Phương pháp mới", THAT.b.toFixed(1)],
          ["Chênh lệch", "+" + (THAT.b - THAT.a).toFixed(1)],
          ["σ giữa các hạt giống", THAT.sd.toFixed(1)],
          ["Số hạt giống", String(THAT.n)],
          ["SE của mỗi trung bình", se.toFixed(2)],
          ["★ Ngưỡng có ý nghĩa (2·√2·SE)", (2 * Math.sqrt(2) * se).toFixed(2)]
        ];
        g2.font = "11.5px system-ui";
        dong.forEach(function (d, i) {
          var y = 42 + i * 19;
          g2.fillStyle = V.mau("tx2"); g2.fillText(d[0], 18, y);
          g2.fillStyle = i === 6 ? V.mau("ac") : V.mau("tx");
          g2.font = (i === 6 ? "700 " : "600 ") + "11.5px ui-monospace, monospace";
          g2.fillText(d[1], 280, y);
          g2.font = "11.5px system-ui";
        });

        var nguong = 2 * Math.sqrt(2) * se;
        g2.fillStyle = V.mau("loi"); g2.font = "700 12px system-ui";
        g2.fillText("⇒ +0,8 < " + nguong.toFixed(2) +
                    "  ⇒  KHÔNG phân biệt được với nhiễu.", 14, 188);
        g2.fillStyle = V.mau("tx2"); g2.font = "11px system-ui";
        g2.fillText("Cả năm cách vẽ đều dùng ĐÚNG bộ số này. Không ai bịa.", 14, 210);
        g2.fillStyle = V.mau("ac"); g2.font = "700 11.5px system-ui";
        g2.fillText("Câu hỏi đúng khi đọc một hình: \"trục y bắt đầu ở đâu, và sai số đâu?\"",
                    14, 232);
      }

      function veHet() { ve(); ve2(); }

      var dk = [
        V.chon({ ten: "Cách trình bày", giaTri: tt.kieu,
                 muc: Object.keys(KIEU).map(function (k) { return { v: k, t: KIEU[k].t }; }),
                 doi: function (v) { tt.kieu = v; veHet(); } })
      ];

      V.khung(host, {
        ve: [cv, cv2], dieuKhien: dk,
        giaiThich:
          "<b>Đổi hộp chọn qua cả năm mục.</b> Bộ số ở bảng dưới <b>không hề thay đổi</b> — " +
          "chỉ cách vẽ đổi. Đây là lý do M10 b.3 dạy đọc phần thí nghiệm " +
          "<b>trước</b> phần kết luận.<ul>" +
          "<li><b>① Trung thực:</b> trục từ 0, có thanh sai số. Chênh lệch +0,8 trông " +
          "<b>đúng như bản chất của nó</b>: nhỏ, và nằm trong nhiễu.</li>" +
          "<li><b>② Cắt trục y:</b> thủ thuật phổ biến nhất, và <b>không sai một chữ số nào</b>. " +
          "Cột phương pháp mới bỗng cao gấp đôi. ★ Vì thế câu hỏi đầu tiên khi nhìn một " +
          "biểu đồ cột luôn là <b>\"trục y bắt đầu ở đâu?\"</b></li>" +
          "<li><b>③ Bỏ thanh sai số:</b> không ai nói dối — chỉ là <b>không nói</b>. " +
          "Người đọc mất hoàn toàn khả năng tự đánh giá. " +
          "★ <b>Một con số không có phương sai không phải một phép đo.</b></li>" +
          "<li><b>④ Báo cáo hạt giống tốt nhất:</b> chạy 5 hạt giống, báo cái cao nhất. " +
          "<code>E[max]</code> của 5 lần rút ≈ <b>+1,16 SD</b> ⇒ tự do thêm khoảng 1,0 điểm " +
          "<b>mà không cần ý tưởng nào đúng</b>.</li>" +
          "<li><b>⑤ Đường cơ sở bị điều chỉnh kém:</b> phương pháp mới được quét 200 cấu hình, " +
          "baseline lấy tham số mặc định trong repo. Đây là dạng <b>khó phát hiện nhất</b> " +
          "vì nó gần như không bao giờ được ghi lại trong bài báo.</li></ul>" +
          "<b>★ Ba câu hỏi đọc bất kỳ bảng kết quả nào</b> (M10 b.3):<ol>" +
          "<li><b>Bao nhiêu hạt giống, và phương sai bao nhiêu?</b> Không có ⇒ coi như chưa đo.</li>" +
          "<li><b>Đường cơ sở được điều chỉnh bằng ngân sách nào</b> so với phương pháp mới?</li>" +
          "<li><b>Bao nhiêu cấu hình đã được thử</b> trước khi ra con số này?</li></ol>" +
          "<b>⇒ Và câu kết của M10 b.2: một bài báo có thể hoàn toàn trung thực về từng con số " +
          "mà vẫn dẫn người đọc tới kết luận sai. Thẩm định là việc của người ĐỌC.</b>"
      });
      veHet();
    }
  });

  /* ================================================================
     M11 — suy dien tien vs lui
     ================================================================ */
  demo({
    id: "suy-dien-tien-lui", nhom: "AI hiện đại", mon: "M11",
    ten: "Suy diễn tiến và suy diễn lùi — cùng luật, khác chi phí",
    moTa: "Cùng một cơ sở luật. Đi <b>xuôi từ sự kiện</b> hay <b>ngược từ mục tiêu</b>? " +
          "Đếm số luật phải kích hoạt.",
    lienKet: '<a href="../web/index.html#/bai/m11-bai-04-he-luat-suy-dien-tien-va-lui">M11 b.4</a>',
    dung: function (host) {
      var W = 560, H = 340, W2 = 560, H2 = 210;
      var cv = V.veBang(W, H), g = cv.g;
      var cv2 = V.veBang(W2, H2), g2 = cv2.g;

      /* co so luat nho ve chan doan may */
      var LUAT = [
        { id: "R1", neu: ["tiếng_kêu_lạ"], thi: "vòng_bi_mòn" },
        { id: "R2", neu: ["rung_mạnh"], thi: "mất_cân_bằng" },
        { id: "R3", neu: ["vòng_bi_mòn", "nhiệt_độ_cao"], thi: "sắp_hỏng_trục" },
        { id: "R4", neu: ["mất_cân_bằng", "rung_mạnh"], thi: "lệch_tâm" },
        { id: "R5", neu: ["sắp_hỏng_trục"], thi: "DỪNG_MÁY" },
        { id: "R6", neu: ["lệch_tâm", "tải_nặng"], thi: "DỪNG_MÁY" },
        { id: "R7", neu: ["dầu_bẩn"], thi: "thay_dầu" },
        { id: "R8", neu: ["áp_suất_thấp"], thi: "rò_rỉ" },
        { id: "R9", neu: ["rò_rỉ", "dầu_bẩn"], thi: "bảo_trì_gấp" }
      ];
      var SUKIEN = ["tiếng_kêu_lạ", "nhiệt_độ_cao", "dầu_bẩn", "áp_suất_thấp"];

      var tt = { huong: "tien", muc: "DỪNG_MÁY" };

      /* suy dien tien: lap cho den khi khong them duoc gi */
      function tien() {
        var biet = SUKIEN.slice(), kich = [], vet = [];
        var doi = true;
        while (doi) {
          doi = false;
          LUAT.forEach(function (r) {
            if (kich.indexOf(r.id) >= 0) return;
            var du = r.neu.every(function (x) { return biet.indexOf(x) >= 0; });
            vet.push({ id: r.id, thu: true, dat: du });
            if (du) {
              kich.push(r.id);
              if (biet.indexOf(r.thi) < 0) biet.push(r.thi);
              doi = true;
            }
          });
        }
        return { biet: biet, kich: kich, thu: vet.length, dat: biet.indexOf(tt.muc) >= 0 };
      }

      /* suy dien lui: chung minh muc tieu */
      function lui() {
        var thu = 0, kich = [], biet = SUKIEN.slice();
        function cm(g2t, sau) {
          if (biet.indexOf(g2t) >= 0) return true;
          if (sau > 8) return false;
          var ok = false;
          LUAT.forEach(function (r) {
            if (ok || r.thi !== g2t) return;
            thu++;
            var het = r.neu.every(function (x) { return cm(x, sau + 1); });
            if (het) { ok = true; if (kich.indexOf(r.id) < 0) kich.push(r.id); }
          });
          return ok;
        }
        var dat = cm(tt.muc, 0);
        return { biet: biet, kich: kich, thu: thu, dat: dat };
      }

      function ve() {
        g.clearRect(0, 0, W, H);
        var kq = tt.huong === "tien" ? tien() : lui();

        g.fillStyle = V.mau("tx"); g.font = "600 12.5px system-ui"; g.textAlign = "left";
        g.fillText(tt.huong === "tien"
          ? "Suy diễn TIẾN — từ sự kiện, suy ra mọi thứ suy được"
          : "Suy diễn LÙI — từ mục tiêu «" + tt.muc + "», tìm cách chứng minh", 14, 20);

        /* cot su kien */
        g.fillStyle = V.mau("tx3"); g.font = "600 10.5px system-ui";
        g.fillText("SỰ KIỆN ĐÃ BIẾT", 14, 42);
        SUKIEN.forEach(function (s, i) {
          var y = 52 + i * 24;
          g.fillStyle = "#0f766e";
          g.fillRect(14, y, 150, 19);
          g.fillStyle = "#fff"; g.font = "10.5px system-ui";
          g.fillText(s, 20, y + 13);
        });

        /* cot luat */
        g.fillStyle = V.mau("tx3"); g.font = "600 10.5px system-ui";
        g.fillText("LUẬT", 200, 42);
        LUAT.forEach(function (r, i) {
          var y = 52 + i * 30;
          var da = kq.kich.indexOf(r.id) >= 0;
          g.fillStyle = da ? V.mau("ac") : V.mau("surf2");
          g.fillRect(200, y, 210, 25);
          g.strokeStyle = V.mau("bd"); g.lineWidth = 1; g.strokeRect(200, y, 210, 25);
          g.fillStyle = da ? "#fff" : V.mau("tx3");
          g.font = "700 10px ui-monospace, monospace";
          g.fillText(r.id, 206, y + 11);
          g.font = "9.5px system-ui";
          g.fillText(r.neu.join(" ∧ "), 230, y + 11);
          g.fillText("→ " + r.thi, 230, y + 21);
        });

        /* cot ket luan */
        g.fillStyle = V.mau("tx3"); g.font = "600 10.5px system-ui";
        g.fillText("SUY RA ĐƯỢC", 430, 42);
        var moi = kq.biet.filter(function (b) { return SUKIEN.indexOf(b) < 0; });
        if (tt.huong === "lui") {
          moi = kq.dat ? [tt.muc] : [];
        }
        moi.forEach(function (b, i) {
          var y = 52 + i * 24;
          var la = b === tt.muc;
          g.fillStyle = la ? "#b91c1c" : V.mau("acbd");
          g.fillRect(430, y, 116, 19);
          g.fillStyle = la ? "#fff" : V.mau("tx");
          g.font = (la ? "700 " : "") + "10px system-ui";
          g.fillText(b, 435, y + 13);
        });
        if (!moi.length) {
          g.fillStyle = V.mau("tx3"); g.font = "italic 10.5px system-ui";
          g.fillText("(không suy ra được)", 430, 65);
        }
      }

      function ve2() {
        g2.clearRect(0, 0, W2, H2);
        var kt = tien(), kl = lui();

        g2.fillStyle = V.mau("tx"); g2.font = "600 12.5px system-ui"; g2.textAlign = "left";
        g2.fillText("So sánh hai hướng trên CÙNG cơ sở luật:", 14, 20);

        var hang = [
          { t: "Suy diễn TIẾN", k: kt, mau: "#0f766e" },
          { t: "Suy diễn LÙI", k: kl, mau: "#5b4bd6" }
        ];
        var maxThu = Math.max(kt.thu, kl.thu);
        hang.forEach(function (h, i) {
          var y = 40 + i * 54;
          g2.fillStyle = h.mau; g2.font = "700 11.5px system-ui";
          g2.fillText(h.t, 14, y + 12);
          g2.fillStyle = V.mau("surf2"); g2.fillRect(140, y, 280, 18);
          g2.fillStyle = h.mau; g2.fillRect(140, y, Math.max(3, 280 * h.k.thu / maxThu), 18);
          g2.fillStyle = V.mau("tx"); g2.font = "600 11px ui-monospace, monospace";
          g2.fillText(h.k.thu + " lần thử luật", 428, y + 13);
          g2.fillStyle = V.mau("tx3"); g2.font = "10.5px system-ui";
          g2.fillText("kích hoạt " + h.k.kich.length + " luật · suy ra " +
                      (h.k.biet.length - 4) + " sự kiện mới · mục tiêu: " +
                      (h.k.dat ? "ĐẠT" : "không đạt"), 140, y + 34);
        });

        g2.fillStyle = V.mau("ac"); g2.font = "700 11.5px system-ui";
        g2.fillText("⇒ Tiến: ít sự kiện, nhiều kết luận. Lùi: một mục tiêu cụ thể cần kiểm.",
                    14, H2 - 14);
      }

      function veHet() { ve(); ve2(); }

      var dk = [
        V.chon({ ten: "Hướng suy diễn", giaTri: tt.huong,
                 muc: [{ v: "tien", t: "Tiến (dữ liệu → kết luận)" },
                       { v: "lui", t: "Lùi (mục tiêu → dữ liệu)" }],
                 doi: function (v) { tt.huong = v; veHet(); } }),
        V.chon({ ten: "Mục tiêu cần chứng minh", giaTri: tt.muc,
                 muc: [{ v: "DỪNG_MÁY", t: "DỪNG_MÁY" },
                       { v: "bảo_trì_gấp", t: "bảo_trì_gấp" },
                       { v: "lệch_tâm", t: "lệch_tâm" },
                       { v: "thay_dầu", t: "thay_dầu" }],
                 doi: function (v) { tt.muc = v; veHet(); } })
      ];

      V.khung(host, {
        ve: [cv, cv2], dieuKhien: dk,
        giaiThich:
          "<b>Cùng một cơ sở luật, cùng một tập sự kiện — hai cách chạy hoàn toàn khác nhau.</b><ul>" +
          "<li><b>Suy diễn tiến</b> (dữ liệu → kết luận): lặp qua toàn bộ luật, luật nào " +
          "đủ điều kiện thì kích hoạt, thêm kết luận vào bộ nhớ làm việc, lặp lại " +
          "cho tới khi <b>không suy thêm được gì</b>. Nó suy ra <b>mọi thứ suy được</b>, " +
          "kể cả những thứ bạn không hỏi.</li>" +
          "<li><b>Suy diễn lùi</b> (mục tiêu → dữ liệu): bắt đầu từ điều cần chứng minh, " +
          "tìm luật nào <b>kết luận ra nó</b>, rồi đệ quy chứng minh từng tiền đề. " +
          "Nó chỉ chạm vào <b>phần cơ sở luật có liên quan</b>.</li></ul>" +
          "<b>★ Quy tắc chọn (M11 b.4 §1):</b><ul>" +
          "<li><b>Ít sự kiện, nhiều kết luận có thể</b> ⇒ dùng <b>tiến</b>. " +
          "Ví dụ: hệ giám sát nhận vài cảm biến rồi phải báo mọi cảnh báo liên quan.</li>" +
          "<li><b>Nhiều sự kiện, một câu hỏi cụ thể</b> ⇒ dùng <b>lùi</b>. " +
          "Ví dụ: \"bệnh nhân này có bị X không?\" — đừng suy diễn cả nghìn kết luận vô can.</li>" +
          "<li>Đổi mục tiêu sang <b>thay_dầu</b> rồi so hai cột: suy diễn lùi chỉ cần " +
          "<b>một luật</b>, còn suy diễn tiến vẫn chạy hết cả cơ sở luật.</li></ul>" +
          "<b>★ Vì sao suy diễn tiến chạy được trong thực tế — thuật toán Rete:</b> " +
          "cách ngây thơ là mỗi vòng kiểm lại <b>mọi</b> luật với <b>mọi</b> sự kiện — " +
          "chi phí nhân lên rất nhanh. Rete <b>ghi nhớ kết quả khớp từng phần</b> giữa các vòng, " +
          "nên chỉ xử lý phần <b>thay đổi</b>. Đây là lý do hệ chuyên gia thương mại " +
          "chạy được với hàng chục nghìn luật.<br><br>" +
          "<b>⚠️ Ba chế độ hỏng đặc trưng của hệ luật:</b><ul>" +
          "<li><b>Phủ định như thất bại</b>: \"không chứng minh được X\" bị coi là \"X sai\". " +
          "Kết quả <b>phụ thuộc thứ tự luật</b> — cùng cơ sở tri thức, đổi thứ tự thì đổi kết luận.</li>" +
          "<li><b>Vòng lặp</b>: luật A suy ra B, B suy ra A. Suy diễn tiến quay mãi nếu " +
          "không kiểm trùng; suy diễn lùi đệ quy vô hạn nếu không giới hạn độ sâu.</li>" +
          "<li><b>Giải xung đột</b>: khi nhiều luật cùng đủ điều kiện, <b>chọn cái nào</b> " +
          "là một quyết định <b>ngữ nghĩa</b>, không phải chi tiết kỹ thuật — " +
          "và nó thường bị chôn trong cấu hình engine.</li></ul>"
      });
      veHet();
    }
  });

  /* ================================================================
     M13 — troi du lieu
     ================================================================ */
  demo({
    id: "troi-du-lieu", nhom: "Hệ thống & đánh giá", mon: "M13",
    ten: "Trôi dữ liệu — mô hình không hỏng, thế giới đổi",
    moTa: "Ba kiểu trôi, ba cách phát hiện. Xem vì sao " +
          "<b>giám sát độ chính xác luôn phát hiện muộn</b>.",
    lienKet: '<a href="../web/index.html#/bai/m13-bai-10-phat-hien-troi-du-lieu">M13 b.10</a>',
    dung: function (host) {
      var W = 560, H = 300, W2 = 560, H2 = 240;
      var cv = V.veBang(W, H), g = cv.g;
      var cv2 = V.veBang(W2, H2), g2 = cv2.g;

      var tt = { kieu: "dacTrung", muc: 1.2, treNhan: 30 };

      function phi(x, mu, sd) {
        return Math.exp(-0.5 * Math.pow((x - mu) / sd, 2)) / (sd * Math.sqrt(2 * Math.PI));
      }

      /* PSI giua hai phan phoi chuan, tinh tren 10 thung */
      function psi(mu1, sd1, mu2, sd2) {
        var lo = Math.min(mu1 - 4 * sd1, mu2 - 4 * sd2);
        var hi = Math.max(mu1 + 4 * sd1, mu2 + 4 * sd2);
        var n = 10, s = 0, i;
        for (i = 0; i < n; i++) {
          var a = lo + (hi - lo) * i / n, b = lo + (hi - lo) * (i + 1) / n;
          var m = (a + b) / 2, w = b - a;
          var p = Math.max(1e-6, phi(m, mu1, sd1) * w);
          var q = Math.max(1e-6, phi(m, mu2, sd2) * w);
          s += (q - p) * Math.log(q / p);
        }
        return s;
      }

      function thamSo() {
        var mu2 = 0, sd2 = 1;
        if (tt.kieu === "dacTrung") { mu2 = tt.muc; sd2 = 1; }
        else if (tt.kieu === "phuongSai") { mu2 = 0; sd2 = 1 + tt.muc * 0.8; }
        else { mu2 = tt.muc * 0.35; sd2 = 1; }        /* troi khai niem: x it doi, y|x doi */
        return { mu2: mu2, sd2: sd2 };
      }

      function ve() {
        g.clearRect(0, 0, W, H);
        var ts = thamSo();
        var padL = 44, padT = 34, padB = 40;
        var w = W - padL - 16, h = H - padT - padB;
        var lo = -4.5, hi = 6;
        var X = function (x) { return padL + (x - lo) / (hi - lo) * w; };

        g.fillStyle = V.mau("tx"); g.font = "600 12.5px system-ui"; g.textAlign = "left";
        g.fillText("Phân phối đặc trưng: lúc huấn luyện vs hôm nay", 14, 20);

        var yMax = 0.42;
        var Y = function (v) { return padT + h - v / yMax * h; };

        [{ mu: 0, sd: 1, mau: V.mau("tx3"), t: "lúc huấn luyện" },
         { mu: ts.mu2, sd: ts.sd2, mau: V.mau("ac"), t: "hôm nay" }
        ].forEach(function (d) {
          g.strokeStyle = d.mau; g.lineWidth = 2.2;
          g.beginPath();
          for (var x = lo; x <= hi; x += 0.04) {
            var yy = Y(phi(x, d.mu, d.sd));
            if (x === lo) g.moveTo(X(x), yy); else g.lineTo(X(x), yy);
          }
          g.stroke();
          g.globalAlpha = 0.16; g.fillStyle = d.mau;
          g.lineTo(X(hi), padT + h); g.lineTo(X(lo), padT + h); g.closePath(); g.fill();
          g.globalAlpha = 1;
        });

        g.strokeStyle = V.mau("bd"); g.lineWidth = 1;
        g.beginPath(); g.moveTo(padL, padT + h); g.lineTo(padL + w, padT + h); g.stroke();

        g.font = "600 10.5px system-ui";
        g.fillStyle = V.mau("tx3"); g.fillText("── lúc huấn luyện", padL + 8, padT + 12);
        g.fillStyle = V.mau("ac"); g.fillText("── hôm nay", padL + 8, padT + 26);

        if (tt.kieu === "khaiNiem") {
          g.fillStyle = V.mau("loi"); g.font = "700 11.5px system-ui";
          g.fillText("⚠ Trôi KHÁI NIỆM: đặc trưng gần như không đổi — " +
                     "nhưng P(y|x) đã đổi.", 14, H - 12);
        }
      }

      function ve2() {
        g2.clearRect(0, 0, W2, H2);
        var ts = thamSo();
        var p = psi(0, 1, ts.mu2, ts.sd2);

        g2.fillStyle = V.mau("tx"); g2.font = "600 12.5px system-ui"; g2.textAlign = "left";
        g2.fillText("Ba tín hiệu giám sát — cái nào kêu trước?", 14, 20);

        /* PSI */
        var muc = p < 0.1 ? ["ổn định", "#0f766e"]
                : (p < 0.25 ? ["cần theo dõi", "#b45309"] : ["TRÔI RÕ RỆT", "#b91c1c"]);
        var dong = [
          ["PSI (chỉ số ổn định)", p.toFixed(3) + "  — " + muc[0], muc[1],
           "Chỉ cần ĐẦU VÀO. Kêu ngay hôm nay."],
          ["Độ tin cậy trung bình", (tt.kieu === "khaiNiem" ? "gần như không đổi"
                                                            : "giảm nhẹ"),
           tt.kieu === "khaiNiem" ? "#b45309" : V.mau("tx"),
           "Chỉ cần ĐẦU VÀO + dự đoán. Kêu sớm, nhưng mơ hồ."],
          ["Độ chính xác thật", "chưa biết — chờ nhãn", V.mau("loi"),
           "Cần NHÃN. Trễ " + tt.treNhan + " ngày. Chính xác nhất, muộn nhất."]
        ];
        dong.forEach(function (d, i) {
          var y = 44 + i * 54;
          g2.fillStyle = V.mau("tx2"); g2.font = "600 11.5px system-ui";
          g2.fillText(d[0], 18, y);
          g2.fillStyle = d[2]; g2.font = "700 12px ui-monospace, monospace";
          g2.fillText(d[1], 230, y);
          g2.fillStyle = V.mau("tx3"); g2.font = "10.5px system-ui";
          g2.fillText(d[3], 18, y + 17);
          /* thanh thoi gian phat hien */
          var tre = [0, 3, tt.treNhan][i];
          var bw = 200;
          g2.fillStyle = V.mau("surf2"); g2.fillRect(300, y + 8, bw, 11);
          g2.fillStyle = d[2];
          g2.fillRect(300, y + 8, Math.max(3, bw * Math.min(1, tre / 45)), 11);
          g2.fillStyle = V.mau("tx3"); g2.font = "9.5px system-ui";
          g2.fillText(tre === 0 ? "ngay" : "+" + tre + " ngày", 508, y + 17);
        });

        g2.fillStyle = V.mau("ac"); g2.font = "700 11.5px system-ui";
        g2.fillText("⇒ Ngưỡng thực dụng: PSI < 0,1 ổn · 0,1–0,25 theo dõi · > 0,25 điều tra.",
                    14, H2 - 26);
        g2.fillStyle = V.mau("tx2"); g2.font = "11px system-ui";
        g2.fillText("Thanh phải = độ trễ phát hiện. Càng chính xác thì càng muộn.", 14, H2 - 10);
      }

      function veHet() { ve(); ve2(); }

      var dk = [
        V.chon({ ten: "Kiểu trôi", giaTri: tt.kieu,
                 muc: [{ v: "dacTrung", t: "Trôi đặc trưng — P(x) dịch" },
                       { v: "phuongSai", t: "Trôi phương sai — P(x) giãn" },
                       { v: "khaiNiem", t: "Trôi khái niệm — P(y|x) đổi" }],
                 doi: function (v) { tt.kieu = v; veHet(); } }),
        V.truot({ ten: "Mức độ trôi", min: 0, max: 3, buoc: 0.1, giaTri: tt.muc,
                  doi: function (v) { tt.muc = v; veHet(); } }),
        V.truot({ ten: "Độ trễ có nhãn (ngày)", min: 1, max: 90, buoc: 1, giaTri: tt.treNhan,
                  doi: function (v) { tt.treNhan = v; veHet(); } })
      ];

      V.khung(host, {
        ve: [cv, cv2], dieuKhien: dk,
        giaiThich:
          "<b>Mô hình không hỏng. Thế giới đổi.</b> Đó là lý do một mô hình đạt 0,93 AUC " +
          "trong notebook có thể tụt dần suốt sáu tháng mà không có dòng log lỗi nào.<ul>" +
          "<li><b>Trôi đặc trưng</b> <code>P(x)</code> dịch: khách hàng mới đến từ một kênh " +
          "khác, cảm biến được hiệu chuẩn lại, một đối thủ rời thị trường.</li>" +
          "<li><b>Trôi phương sai</b>: trung bình giữ nguyên nhưng phân phối <b>giãn ra</b> — " +
          "mô hình gặp nhiều trường hợp biên hơn hẳn lúc huấn luyện.</li>" +
          "<li>★ <b>Trôi khái niệm</b> <code>P(y|x)</code> đổi — <b>nguy hiểm nhất</b>: " +
          "chọn mục này và nhìn hình, hai phân phối gần như <b>trùng nhau</b>. " +
          "Đầu vào trông y hệt, nhưng <b>quan hệ giữa đầu vào và nhãn</b> đã đổi. " +
          "Mọi giám sát dựa trên đầu vào <b>hoàn toàn mù</b> với kiểu trôi này.</li></ul>" +
          "<b>★ Đọc bảng dưới theo cột \"độ trễ phát hiện\" — đây là bài học vận hành chính:</b><ul>" +
          "<li><b>PSI</b> chỉ cần <b>đầu vào</b>, nên kêu được <b>ngay hôm nay</b>. " +
          "Ngưỡng thực dụng: <code>&lt; 0,1</code> ổn định · <code>0,1–0,25</code> theo dõi · " +
          "<code>&gt; 0,25</code> phải điều tra.</li>" +
          "<li><b>Độ tin cậy trung bình</b> cần đầu vào + dự đoán — vẫn sớm, nhưng mơ hồ " +
          "(mô hình bị hiệu chỉnh kém sẽ vẫn tự tin trong khi đã sai).</li>" +
          "<li>★ <b>Độ chính xác thật</b> cần <b>NHÃN</b>. Kéo thanh \"độ trễ có nhãn\" lên 90 ngày: " +
          "đó là tình huống có thật ở bài toán tín dụng hay churn. " +
          "<b>Nếu bạn chỉ giám sát độ chính xác, bạn sẽ biết mình sai sau ba tháng.</b></li></ul>" +
          "<b>⇒ Kiến trúc giám sát đúng là ba tầng, không phải một: ① PSI/KS trên từng đặc trưng " +
          "(tức thì, nhiều báo động giả) · ② phân phối dự đoán và độ tin cậy (sớm, mơ hồ) · " +
          "③ độ chính xác thật khi nhãn về (chậm, đáng tin). " +
          "Tầng ① không thay thế tầng ③ — nó mua cho bạn thời gian để điều tra trước khi ③ kêu.</b>"
      });
      veHet();
    }
  });

})();
