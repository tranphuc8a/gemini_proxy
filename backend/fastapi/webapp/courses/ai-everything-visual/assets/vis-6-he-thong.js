/* =====================================================================
   vis-6-he-thong.js — Ky nghe he thong AI (M12, M13)
     1. do-tin-cay-chuoi   Do tin cay cua mot chuoi nhieu buoc  (M12 b.8)
     2. rag-tran-truy-hoi  Recall la tran cung cua RAG          (M12 b.9)
     3. dem-kv             Dem KV, PagedAttention, thong luong  (M13 b.8)
   ===================================================================== */

(function () {
  "use strict";
  var V = window.VIS;

  /* =================================================================
     1. DO TIN CAY CUA MOT CHUOI NHIEU BUOC
     ================================================================= */
  demo({
    id: "do-tin-cay-chuoi", nhom: "Hệ thống & đánh giá", mon: "M12",
    ten: "Độ tin cậy của một chuỗi nhiều bước",
    moTa: "Vì sao demo 5 bước chạy tốt còn sản phẩm 30 bước thì không. " +
          "Kéo <b>p</b> và <b>số bước</b>, rồi thử bật kiểm định mỗi bước.",
    lienKet: '<a href="../web/index.html#/bai/m12-bai-08-tac-tu-va-vong-lap">M12 b.8</a>',
    dung: function (host) {
      var W = 560, H = 320;
      var cv = V.veBang(W, H), g = cv.g;
      var tt = { p: 0.95, k: 30, kiemDinh: false, pKiem: 0.99, gopBuoc: 1 };
      var oSo = V.el("div", { class: "so-lieu" });

      function pHieuDung() { return tt.kiemDinh ? tt.pKiem : tt.p; }
      function kHieuDung() { return Math.max(1, Math.round(tt.k / tt.gopBuoc)); }

      function ve() {
        g.clearRect(0, 0, W, H);
        var padL = 52, padR = 18, padT = 26, padB = 46;
        var w = W - padL - padR, h = H - padT - padB;
        var kMax = 40;

        /* luoi */
        g.strokeStyle = V.mau("bd2"); g.lineWidth = 1;
        for (var i = 0; i <= 10; i++) {
          var y = padT + h - i / 10 * h;
          g.beginPath(); g.moveTo(padL, y); g.lineTo(padL + w, y); g.stroke();
        }
        g.fillStyle = V.mau("tx3"); g.font = "11px system-ui"; g.textAlign = "right";
        for (i = 0; i <= 10; i += 2) {
          g.fillText((i * 10) + "%", padL - 8, padT + h - i / 10 * h + 4);
        }
        g.textAlign = "center";
        for (i = 0; i <= kMax; i += 5) {
          g.fillText(String(i), padL + i / kMax * w, padT + h + 18);
        }
        g.textAlign = "left";
        g.fillStyle = V.mau("tx3");
        g.fillText("số bước trong chuỗi →", padL + w / 2 - 54, H - 10);

        /* cac duong p^k */
        var DUONG = [
          { p: 0.99, mau: "#0f766e", nhan: "p = 0,99" },
          { p: 0.97, mau: "#b45309", nhan: "p = 0,97" },
          { p: 0.95, mau: "#9d174d", nhan: "p = 0,95" },
          { p: 0.90, mau: "#6b21a8", nhan: "p = 0,90" }
        ];
        DUONG.forEach(function (d) {
          var noiBat = Math.abs(d.p - pHieuDung()) < 0.005;
          g.strokeStyle = d.mau;
          g.globalAlpha = noiBat ? 1 : 0.28;
          g.lineWidth = noiBat ? 2.6 : 1.6;
          g.beginPath();
          for (var kk = 0; kk <= kMax; kk++) {
            var vv = Math.pow(d.p, kk);
            var X = padL + kk / kMax * w, Y = padT + h - vv * h;
            if (kk === 0) g.moveTo(X, Y); else g.lineTo(X, Y);
          }
          g.stroke();
          g.globalAlpha = 1;
        });

        /* duong cua nguoi dung */
        var p = pHieuDung(), k = kHieuDung();
        var val = Math.pow(p, k);
        var X0 = padL + Math.min(k, kMax) / kMax * w;
        var Y0 = padT + h - val * h;
        g.strokeStyle = V.mau("ac"); g.lineWidth = 1.4; g.setLineDash([4, 4]);
        g.beginPath(); g.moveTo(X0, padT); g.lineTo(X0, padT + h); g.stroke();
        g.beginPath(); g.moveTo(padL, Y0); g.lineTo(padL + w, Y0); g.stroke();
        g.setLineDash([]);
        g.fillStyle = V.mau("ac");
        g.beginPath(); g.arc(X0, Y0, 6, 0, 7); g.fill();

        /* nhan */
        g.font = "600 12px system-ui";
        DUONG.forEach(function (d, i) {
          g.fillStyle = d.mau;
          g.globalAlpha = Math.abs(d.p - p) < 0.005 ? 1 : 0.5;
          g.fillText(d.nhan, padL + w - 66, padT + 14 + i * 15);
          g.globalAlpha = 1;
        });
        g.fillStyle = V.mau("tx2"); g.font = "12px system-ui";
        g.fillText("Xác suất chuỗi đúng HOÀN TOÀN", padL, 16);

        /* so lieu */
        var demo5 = Math.pow(p, 5);
        var sp = val;
        var canBase = Math.pow(tt.p, tt.k);
        var loi = tt.kiemDinh || tt.gopBuoc > 1 ? sp / canBase : 1;
        oSo.innerHTML =
          '<div class="d"><span>p hiệu dụng</span><b>' + p.toFixed(3) + "</b></div>" +
          '<div class="d"><span>Số bước hiệu dụng</span><b>' + k + "</b></div>" +
          '<div class="d"><span>Demo 5 bước</span><b>' + (demo5 * 100).toFixed(1) + "%</b></div>" +
          '<div class="d"><span>Sản phẩm ' + k + " bước</span><b>" + (sp * 100).toFixed(1) + "%</b></div>" +
          '<div class="d"><span>Số ca hỏng / 1.000</span><b>' +
            Math.round((1 - sp) * 1000) + "</b></div>" +
          (loi > 1.01
            ? '<div class="d"><span>★ Cải thiện so với gốc</span><b>' + loi.toFixed(2) + " lần</b></div>"
            : "");
      }

      var dkGop = V.truot({
        ten: "Gộp bước (chia số bước cho)", min: 1, max: 5, buoc: 1, donVi: "×",
        giaTri: tt.gopBuoc, doi: function (v) { tt.gopBuoc = v; ve(); }
      });

      var dk = [
        V.el("h4", { text: "ĐIỀU KHIỂN" }),
        V.truot({ ten: "p — độ tin cậy mỗi bước", min: 0.80, max: 0.999, buoc: 0.001,
          giaTri: tt.p, doi: function (v) { tt.p = v; ve(); } }),
        V.truot({ ten: "Số bước trong chuỗi", min: 1, max: 40, buoc: 1, giaTri: tt.k,
          doi: function (v) { tt.k = v; ve(); } }),
        V.el("h4", { text: "HAI ĐÒN BẨY" }),
        V.danhDau({ ten: "① Kiểm định mỗi bước (nâng p lên 0,99)", giaTri: tt.kiemDinh,
          doi: function (v) { tt.kiemDinh = v; ve(); } }),
        dkGop,
        oSo
      ];

      V.khung(host, {
        ve: [cv], dieuKhien: dk,
        giaiThich:
          "<b>Một tác tử LLM là một chuỗi nhiều bước, và mỗi bước có thể sai.</b> " +
          "Nếu mỗi bước đúng với xác suất <code>p</code>, xác suất cả chuỗi <code>k</code> bước " +
          "đúng hoàn toàn là <code>p^k</code>.<ul>" +
          "<li><b>Đặt p = 0,95 và kéo số bước từ 5 lên 30.</b> Bạn thấy <code>0,774 → 0,215</code>. " +
          "Cùng một hệ thống, cùng một mô hình, cùng một prompt — nhưng demo 5 bước trông ổn " +
          "và sản phẩm 30 bước thì hỏng 4 trên 5 lần.</li>" +
          "<li><b>★ Khoảng cách demo–sản phẩm là một SỐ MŨ, không phải một hằng số.</b> " +
          "Đó là lý do một hệ thống \"gần xong\" có thể còn rất xa.</li></ul>" +
          "<b>Chỉ có HAI đòn bẩy, vì chỉ có hai đại lượng trong công thức:</b><ul>" +
          "<li><b>① Nâng CƠ SỐ p</b> — kiểm định sau mỗi bước. Bật ô ① để thấy " +
          "<code>0,99³⁰ = 0,740</code> so với <code>0,215</code>: <b>cải thiện 3,4 lần</b>. " +
          "Cái giá: mỗi kiểm định là thêm chi phí và độ trễ.</li>" +
          "<li><b>② Hạ SỐ MŨ k</b> — gộp nhiều thao tác vào một công cụ tất định. " +
          "Kéo \"gộp bước\" lên 2–3× để thấy hiệu quả. " +
          "Cái giá: mã cứng hơn, ít linh hoạt hơn.</li></ul>" +
          "<b>★ Và chúng KẾT HỢP ĐƯỢC.</b> Bật ① và gộp 2,5× cùng lúc: " +
          "<code>0,99¹² = 0,886</code> — gấp <b>4,1 lần</b> so với điểm xuất phát, " +
          "và đó là khác biệt giữa \"không dùng được\" và \"dùng được có giám sát\".<br><br>" +
          "<b>⚠️ Điều đồ thị này KHÔNG cho thấy:</b> nó giả định các bước <b>độc lập</b>. " +
          "Trong thực tế chúng không độc lập — một sai sót sớm làm các bước sau " +
          "<i>có khả năng sai cao hơn</i>, vì tác tử tiếp tục suy luận trên một tiền đề hỏng. " +
          "Nghĩa là <b>đường cong thật còn dốc hơn đường cong ở đây.</b>"
      });
      ve();
    }
  });

  /* =================================================================
     2. RAG: RECALL LA TRAN CUNG
     ================================================================= */
  demo({
    id: "rag-tran-truy-hoi", nhom: "Hệ thống & đánh giá", mon: "M12",
    ten: "RAG: recall của truy hồi là một trần cứng",
    moTa: "Hai tầng, hai tỷ lệ, một tích. Thử cải thiện từng tầng và xem " +
          "<b>tầng nào đáng đầu tư</b>.",
    lienKet: '<a href="../web/index.html#/bai/m12-bai-09-rag-nen-tang">M12 b.9</a>',
    dung: function (host) {
      var W = 560, H = 290, W2 = 560, H2 = 210;
      var cv = V.veBang(W, H), g = cv.g;
      var cv2 = V.veBang(W2, H2), g2 = cv2.g;
      var tt = { recall: 0.70, sinh: 0.90, dRecall: 0.15, dSinh: 0.05 };
      var oSo = V.el("div", { class: "so-lieu" });

      function ve() {
        /* ---------- so do hai tang ---------- */
        g.clearRect(0, 0, W, H);
        var e2e = tt.recall * tt.sinh;
        var padL = 40, boxW = 150, boxH = 62, y1 = 42, y2 = 150;

        function hop(x, y, w, h, nhan, phu, tyLe, mauNen) {
          g.fillStyle = mauNen; g.strokeStyle = V.mau("bd"); g.lineWidth = 1.5;
          g.beginPath();
          if (g.roundRect) { g.roundRect(x, y, w, h, 8); } else { g.rect(x, y, w, h); }
          g.fill(); g.stroke();
          g.fillStyle = "#fff"; g.font = "600 13px system-ui"; g.textAlign = "center";
          g.fillText(nhan, x + w / 2, y + 24);
          g.font = "700 18px system-ui";
          g.fillText((tyLe * 100).toFixed(1) + "%", x + w / 2, y + 47);
          g.textAlign = "left";
          if (phu) {
            g.fillStyle = V.mau("tx3"); g.font = "11px system-ui"; g.textAlign = "center";
            g.fillText(phu, x + w / 2, y + h + 15);
            g.textAlign = "left";
          }
        }
        function muiTen(x1, y1b, x2, y2b) {
          g.strokeStyle = V.mau("bd"); g.lineWidth = 2;
          g.beginPath(); g.moveTo(x1, y1b); g.lineTo(x2, y2b); g.stroke();
          g.beginPath();
          g.moveTo(x2, y2b); g.lineTo(x2 - 7, y2b - 5); g.lineTo(x2 - 7, y2b + 5);
          g.closePath(); g.fillStyle = V.mau("bd"); g.fill();
        }

        hop(padL, y1, boxW, boxH, "TRUY HỒI", "recall@k", tt.recall, "#9d174d");
        muiTen(padL + boxW, y1 + boxH / 2, padL + boxW + 46, y1 + boxH / 2);
        hop(padL + boxW + 50, y1, boxW, boxH, "SINH", "khi có đoạn đúng", tt.sinh, "#b45309");
        muiTen(padL + boxW * 2 + 50, y1 + boxH / 2, padL + boxW * 2 + 96, y1 + boxH / 2);
        hop(padL + boxW * 2 + 100, y1, boxW + 10, boxH, "ĐẦU–CUỐI", "= tích", e2e, "#0f766e");

        /* thanh tran */
        var bx = padL, bw = W - padL * 2, by = y2 + 18, bh = 30;
        g.fillStyle = V.mau("bd2");
        g.fillRect(bx, by, bw, bh);
        g.fillStyle = "#9d174d"; g.globalAlpha = 0.22;
        g.fillRect(bx, by, bw * tt.recall, bh);
        g.globalAlpha = 1;
        g.fillStyle = "#0f766e";
        g.fillRect(bx, by, bw * e2e, bh);
        g.strokeStyle = "#9d174d"; g.lineWidth = 2.5;
        g.beginPath(); g.moveTo(bx + bw * tt.recall, by - 8); g.lineTo(bx + bw * tt.recall, by + bh + 8); g.stroke();
        g.fillStyle = V.mau("tx2"); g.font = "600 12px system-ui";
        g.fillText("★ TRẦN CỨNG = recall (" + (tt.recall * 100).toFixed(0) + "%)",
                   bx + bw * tt.recall + 8, by - 12);
        g.fillStyle = "#fff"; g.font = "600 12px system-ui";
        if (e2e > 0.13) g.fillText("đầu–cuối " + (e2e * 100).toFixed(1) + "%", bx + 10, by + 20);
        g.fillStyle = V.mau("tx3"); g.font = "11px system-ui";
        g.fillText("0%", bx, by + bh + 20);
        g.fillText("100%", bx + bw - 26, by + bh + 20);
        g.fillStyle = V.mau("tx2"); g.font = "12px system-ui";
        g.fillText("Không đoạn nào được truy hồi ⇒ không mô hình nào trả lời đúng được.",
                   bx, y2 + 8);

        /* ---------- so sanh hai phuong an ---------- */
        g2.clearRect(0, 0, W2, H2);
        var goc = e2e;
        var pa = (tt.recall + tt.dRecall) * tt.sinh;
        var pb = tt.recall * Math.min(1, tt.sinh + tt.dSinh);
        var loiA = pa - goc, loiB = pb - goc;
        var maxV = Math.max(pa, pb, goc) * 1.12;
        var p3 = 120, w3 = W2 - p3 - 30, hRow = 40, yTop = 34;

        [["Hiện tại", goc, V.mau("bd"), ""],
         ["A · truy hồi +" + (tt.dRecall * 100).toFixed(0), pa, "#9d174d",
          "+" + (loiA * 100).toFixed(1) + " điểm"],
         ["B · sinh +" + (tt.dSinh * 100).toFixed(0), pb, "#b45309",
          "+" + (loiB * 100).toFixed(1) + " điểm"]
        ].forEach(function (r, i) {
          var y = yTop + i * hRow;
          g2.fillStyle = V.mau("tx2"); g2.font = "12px system-ui"; g2.textAlign = "right";
          g2.fillText(r[0], p3 - 10, y + 16);
          g2.textAlign = "left";
          g2.fillStyle = r[2];
          g2.fillRect(p3, y, r[1] / maxV * w3, 22);
          g2.fillStyle = V.mau("tx"); g2.font = "600 12px system-ui";
          g2.fillText((r[1] * 100).toFixed(1) + "%  " + r[3], p3 + r[1] / maxV * w3 + 8, y + 16);
        });

        var tySo = loiB > 1e-9 ? loiA / loiB : 99;
        g2.fillStyle = V.mau("tx2"); g2.font = "600 13px system-ui";
        g2.fillText("★ Cải thiện truy hồi đáng giá gấp " + tySo.toFixed(2) + " lần cải thiện sinh",
                    p3 - 110, H2 - 22);
        g2.fillStyle = V.mau("tx3"); g2.font = "11px system-ui";
        g2.fillText("(với cùng số điểm cải thiện danh nghĩa)", p3 - 110, H2 - 6);

        oSo.innerHTML =
          '<div class="d"><span>Đầu–cuối hiện tại</span><b>' + (goc * 100).toFixed(1) + "%</b></div>" +
          '<div class="d"><span>Trần cứng (= recall)</span><b>' + (tt.recall * 100).toFixed(0) + "%</b></div>" +
          '<div class="d"><span>Đã đi được bao nhiêu tới trần</span><b>' +
            (goc / tt.recall * 100).toFixed(1) + "%</b></div>" +
          '<div class="d"><span>Phương án A (truy hồi)</span><b>+' + (loiA * 100).toFixed(1) + " điểm</b></div>" +
          '<div class="d"><span>Phương án B (sinh)</span><b>+' + (loiB * 100).toFixed(1) + " điểm</b></div>" +
          '<div class="d"><span>★ Tỷ số A/B</span><b>' + tySo.toFixed(2) + " lần</b></div>";
      }

      var dk = [
        V.el("h4", { text: "HỆ THỐNG HIỆN TẠI" }),
        V.truot({ ten: "recall@k của truy hồi", min: 0.2, max: 1, buoc: 0.01, giaTri: tt.recall,
          doi: function (v) { tt.recall = v; ve(); } }),
        V.truot({ ten: "Độ chính xác sinh (khi có đoạn đúng)", min: 0.3, max: 1, buoc: 0.01,
          giaTri: tt.sinh, doi: function (v) { tt.sinh = v; ve(); } }),
        V.el("h4", { text: "HAI PHƯƠNG ÁN ĐẦU TƯ" }),
        V.truot({ ten: "A · cải thiện recall thêm", min: 0, max: 0.3, buoc: 0.01, giaTri: tt.dRecall,
          doi: function (v) { tt.dRecall = v; ve(); } }),
        V.truot({ ten: "B · cải thiện sinh thêm", min: 0, max: 0.3, buoc: 0.01, giaTri: tt.dSinh,
          doi: function (v) { tt.dSinh = v; ve(); } }),
        oSo
      ];

      V.khung(host, {
        ve: [cv, cv2], dieuKhien: dk,
        giaiThich:
          "<b>RAG là hai tầng nối tiếp, nên độ chính xác đầu–cuối là một TÍCH:</b> " +
          "<code>recall@k × độ_chính_xác_sinh</code>. Với 0,70 × 0,90 bạn được <b>0,63</b> — " +
          "thấp hơn cả hai tầng.<ul>" +
          "<li><b>★ Recall là một TRẦN CỨNG.</b> Nếu đoạn chứa câu trả lời không được truy hồi, " +
          "<b>không mô hình nào</b> trả lời đúng được — dù nó hoàn hảo. Vạch đỏ trên thanh " +
          "là mức bạn <i>không thể vượt qua</i> mà không sửa tầng truy hồi.</li>" +
          "<li><b>Ở cấu hình mặc định bạn đã đi 90% quãng đường tới trần</b> (0,63/0,70). " +
          "Mọi nỗ lực vào tầng sinh đang tranh giành 10% còn lại.</li></ul>" +
          "<b>Vì sao +15 điểm recall đánh bại +5 điểm sinh gấp ~4 lần:</b> " +
          "một điểm recall được nhân với 0,90; một điểm sinh được nhân với 0,70. " +
          "Nhưng độ lớn khả dĩ mới là điều quyết định — <b>tầng nào còn xa mức bão hoà hơn " +
          "thì tầng đó có nhiều chỗ để cải thiện hơn</b>.<ul>" +
          "<li><b>Thử đặt recall = 0,95 và sinh = 0,60.</b> Tỷ số đảo chiều: giờ đầu tư vào " +
          "tầng sinh mới đáng. ⇒ <b>Không có câu trả lời chung — chỉ có một phép tính.</b></li></ul>" +
          "<b>⚠️ Hai cách chẩn đoán xem bạn đang bị chặn ở tầng nào:</b><ul>" +
          "<li><b>Đo recall@k riêng</b> — cần một tập đánh giá có nhãn \"đoạn nào chứa câu trả lời\". " +
          "Nếu biết recall và biết đầu–cuối, bạn suy ra được độ chính xác sinh mà không cần đo nó.</li>" +
          "<li><b>Phép thử \"cho sẵn ngữ cảnh đúng\"</b> — lấy 100 câu trả lời sai, đưa thủ công " +
          "đoạn đúng vào, chạy lại. Trả lời đúng ⇒ lỗi ở <b>truy hồi</b>. Vẫn sai ⇒ lỗi ở <b>sinh</b>. " +
          "Tốn một buổi, và nó quyết định bạn đầu tư vào đâu trong ba tháng tới.</li></ul>" +
          "<b>★ Và phép thử ít ai chạy nhất:</b> <b>tắt truy hồi hoàn toàn</b> rồi chạy lại bộ đánh giá. " +
          "Tỷ lệ vẫn trả lời đúng chính là phần hệ thống đang lấy từ <i>trí nhớ mô hình</i>, " +
          "không phải từ tài liệu của bạn — và nó sẽ sụp ngay khi gặp dữ liệu nội bộ hoặc dữ liệu mới."
      });
      ve();
    }
  });

  /* =================================================================
     3. DEM KV VA THONG LUONG PHUC VU
     ================================================================= */
  demo({
    id: "dem-kv", nhom: "Hệ thống & đánh giá", mon: "M13",
    ten: "Đệm KV: vì sao PagedAttention là tối ưu thông lượng",
    moTa: "Cấp phát trước theo độ dài <i>tối đa</i> so với cấp phát theo nhu cầu <i>thật</i>. " +
          "Bộ nhớ tiết kiệm được chuyển thẳng thành số chuỗi phục vụ song song.",
    lienKet: '<a href="../web/index.html#/bai/m13-bai-08-phuc-vu-llm-chuyen-sau">M13 b.8</a>',
    dung: function (host) {
      var W = 560, H = 300, W2 = 560, H2 = 180;
      var cv = V.veBang(W, H), g = cv.g;
      var cv2 = V.veBang(W2, H2), g2 = cv2.g;
      var tt = {
        L: 80, nkv: 8, dHead: 128, byte: 2,
        gpu: 53, maxTok: 4096, tbTok: 300, hat: 7, tienTo: 0
      };
      var oSo = V.el("div", { class: "so-lieu" });

      function kbMoiToken() {
        /* 2 (K va V) * L * n_kv * d_head * byte, doi ra KiB */
        return 2 * tt.L * tt.nkv * tt.dHead * tt.byte / 1024;
      }
      function gibMoiChuoi(nTok) { return kbMoiToken() * nTok / (1024 * 1024); }

      function ve() {
        var kb = kbMoiToken();
        var gibMax = gibMoiChuoi(tt.maxTok);
        var gibTb = gibMoiChuoi(tt.tbTok);
        var conLai = Math.max(0.1, tt.gpu - gibMoiChuoi(tt.tienTo));
        var nCapTruoc = Math.floor(conLai / gibMax);
        var nTheoNhuCau = Math.floor(conLai / gibTb);

        /* ---------- so do o nho ---------- */
        g.clearRect(0, 0, W, H);
        var R = V.rng(tt.hat);
        var padL = 16, colW = W - padL * 2;
        var soO = 24, oW = colW / soO;

        function veHang(y, nhan, capTruoc) {
          g.fillStyle = V.mau("tx2"); g.font = "600 12px system-ui";
          g.fillText(nhan, padL, y - 8);
          var dung = 0, phi = 0;
          for (var i = 0; i < soO; i++) {
            var x = padL + i * oW;
            var nhuCau = Math.max(40, Math.min(tt.maxTok, tt.tbTok * (0.4 + R() * 1.6)));
            var tyLe = capTruoc ? nhuCau / tt.maxTok : 1;
            /* khung cap phat */
            g.fillStyle = V.mau("bd2");
            g.fillRect(x + 1, y, oW - 2, 44);
            /* phan thuc su dung */
            g.fillStyle = capTruoc ? "#9d174d" : "#0f766e";
            g.fillRect(x + 1, y + 44 - 44 * tyLe, oW - 2, 44 * tyLe);
            dung += tyLe; phi += 1 - tyLe;
          }
          g.strokeStyle = V.mau("bd"); g.lineWidth = 1;
          g.strokeRect(padL, y, colW, 44);
          g.fillStyle = V.mau("tx3"); g.font = "11px system-ui";
          var pct = dung / soO * 100;
          g.fillText(capTruoc
            ? "mức sử dụng " + pct.toFixed(0) + "% — phần xám là bộ nhớ đã cấp mà KHÔNG dùng"
            : "mức sử dụng ~100% — cấp theo nhu cầu thật, trả lại ngay khi chuỗi kết thúc",
            padL, y + 60);
        }

        g.fillStyle = V.mau("tx2"); g.font = "12px system-ui";
        g.fillText("Mỗi ô = một chuỗi đang phục vụ. Chiều cao = bộ nhớ đệm KV đã cấp phát.", padL, 16);
        veHang(34, "① CẤP PHÁT TRƯỚC theo độ dài tối đa (" + tt.maxTok + " token)", true);
        veHang(144, "② CẤP PHÁT THEO NHU CẦU THẬT (PagedAttention)", false);

        /* ket qua */
        var yK = 246;
        g.fillStyle = V.mau("surf2"); g.strokeStyle = V.mau("bd");
        g.fillRect(padL, yK, colW, 44); g.strokeRect(padL, yK, colW, 44);
        g.fillStyle = V.mau("tx"); g.font = "600 14px system-ui";
        g.fillText("① " + nCapTruoc + " chuỗi đồng thời", padL + 14, yK + 20);
        g.fillText("② " + nTheoNhuCau + " chuỗi đồng thời", padL + 14, yK + 38);
        g.fillStyle = "#0f766e"; g.font = "700 20px system-ui";
        var boi = nCapTruoc > 0 ? nTheoNhuCau / nCapTruoc : 0;
        g.fillText("★ " + boi.toFixed(1) + "× thông lượng", padL + colW - 190, yK + 30);

        /* ---------- so sanh GQA vs MHA ---------- */
        g2.clearRect(0, 0, W2, H2);
        var p4 = 110, w4 = W2 - p4 - 120;
        var CAU = [
          { ten: "MHA (n_kv = 64)", nkv: 64, mau: "#9d174d" },
          { ten: "GQA (n_kv = 8)", nkv: 8, mau: "#b45309" },
          { ten: "MQA (n_kv = 1)", nkv: 1, mau: "#0f766e" }
        ];
        var kbMax = 2 * tt.L * 64 * tt.dHead * tt.byte / 1024;
        g2.fillStyle = V.mau("tx2"); g2.font = "12px system-ui";
        g2.fillText("Đệm KV trên mỗi token, theo số đầu K/V (cùng " + tt.L + " tầng):", 12, 18);
        CAU.forEach(function (c, i) {
          var kbc = 2 * tt.L * c.nkv * tt.dHead * tt.byte / 1024;
          var y = 38 + i * 38;
          g2.fillStyle = V.mau("tx2"); g2.font = "12px system-ui"; g2.textAlign = "right";
          g2.fillText(c.ten, p4 - 10, y + 15);
          g2.textAlign = "left";
          g2.fillStyle = c.mau;
          g2.fillRect(p4, y, Math.max(3, kbc / kbMax * w4), 22);
          g2.fillStyle = V.mau("tx"); g2.font = "600 12px system-ui";
          g2.fillText(kbc >= 1024 ? (kbc / 1024).toFixed(2) + " MiB/token"
                                  : kbc.toFixed(0) + " KiB/token",
                      p4 + Math.max(3, kbc / kbMax * w4) + 8, y + 16);
        });
        g2.fillStyle = V.mau("tx3"); g2.font = "11px system-ui";
        g2.fillText("★ GQA giảm đệm KV đúng bằng tỷ số số đầu — 64/8 = 8 lần, gần như không mất chất lượng.",
                    12, H2 - 12);

        /* so lieu */
        var tietKiemTienTo = tt.tienTo > 0
          ? gibMoiChuoi(tt.tienTo) * (nTheoNhuCau - 1)
          : 0;
        oSo.innerHTML =
          '<div class="d"><span>Đệm KV / token</span><b>' + kb.toFixed(0) + " KiB</b></div>" +
          '<div class="d"><span>Cấp trước ' + tt.maxTok + " token</span><b>" +
            gibMax.toFixed(3) + " GiB/chuỗi</b></div>" +
          '<div class="d"><span>Theo nhu cầu (' + tt.tbTok + " token)</span><b>" +
            gibTb.toFixed(3) + " GiB/chuỗi</b></div>" +
          '<div class="d"><span>① Số chuỗi đồng thời</span><b>' + nCapTruoc + "</b></div>" +
          '<div class="d"><span>② Số chuỗi đồng thời</span><b>' + nTheoNhuCau + "</b></div>" +
          '<div class="d"><span>★ Bội số thông lượng</span><b>' + boi.toFixed(1) + "×</b></div>" +
          (tt.tienTo > 0
            ? '<div class="d"><span>Chia sẻ tiền tố tiết kiệm</span><b>' +
              tietKiemTienTo.toFixed(1) + " GiB</b></div>"
            : "");
      }

      var dk = [
        V.el("h4", { text: "MÔ HÌNH" }),
        V.truot({ ten: "Số tầng L", min: 12, max: 120, buoc: 4, giaTri: tt.L,
          doi: function (v) { tt.L = v; ve(); } }),
        V.chon({ ten: "Số đầu K/V (GQA)", giaTri: String(tt.nkv),
          muc: [{ v: "64", t: "64 — MHA đầy đủ" }, { v: "16", t: "16" },
                { v: "8", t: "8 — GQA điển hình" }, { v: "1", t: "1 — MQA" }],
          doi: function (v) { tt.nkv = +v; ve(); } }),
        V.chon({ ten: "Độ chính xác đệm KV", giaTri: String(tt.byte),
          muc: [{ v: "4", t: "fp32 (4 byte)" }, { v: "2", t: "fp16/bf16 (2 byte)" },
                { v: "1", t: "int8 (1 byte)" }],
          doi: function (v) { tt.byte = +v; ve(); } }),
        V.el("h4", { text: "PHỤC VỤ" }),
        V.truot({ ten: "Bộ nhớ còn cho đệm KV", min: 8, max: 140, buoc: 1, donVi: " GiB",
          giaTri: tt.gpu, doi: function (v) { tt.gpu = v; ve(); } }),
        V.truot({ ten: "Độ dài TỐI ĐA hỗ trợ", min: 512, max: 32768, buoc: 512,
          giaTri: tt.maxTok, doi: function (v) { tt.maxTok = v; ve(); } }),
        V.truot({ ten: "Độ dài THỰC TẾ trung bình", min: 50, max: 4000, buoc: 50,
          giaTri: tt.tbTok, doi: function (v) { tt.tbTok = v; ve(); } }),
        V.truot({ ten: "Prompt hệ thống dùng chung", min: 0, max: 4000, buoc: 100,
          donVi: " token", giaTri: tt.tienTo,
          doi: function (v) { tt.tienTo = v; ve(); } }),
        V.truot({ ten: "Hạt giống (phân bố độ dài)", min: 1, max: 30, buoc: 1, giaTri: tt.hat,
          doi: function (v) { tt.hat = v; ve(); } }),
        oSo
      ];

      V.khung(host, {
        ve: [cv, cv2], dieuKhien: dk,
        giaiThich:
          "<b>Khi phục vụ LLM, nút thắt thật thường KHÔNG phải trọng số — mà là đệm KV.</b> " +
          "Mỗi token đã sinh phải giữ lại vectơ K và V ở <i>mọi tầng</i>:<br>" +
          "<code>đệm/token = 2 × L × n_kv × d_head × byte</code><ul>" +
          "<li><b>Cách ngây thơ (①)</b> cấp phát trước cho <b>độ dài tối đa</b> mà hệ hỗ trợ, " +
          "vì không ai biết chuỗi sẽ dài bao nhiêu. Với độ dài thực tế trung bình 300 token " +
          "trên một hệ hỗ trợ 4.096, <b>hơn 90% bộ nhớ đã cấp không bao giờ được dùng</b> " +
          "(phần xám trong hàng ①).</li>" +
          "<li><b>PagedAttention (②)</b> cấp phát theo <b>trang</b>, đúng lượng đang cần, " +
          "và trả lại ngay khi chuỗi kết thúc.</li></ul>" +
          "<b>★ Và đây là điểm dễ hiểu sai nhất:</b> đây <b>không phải một tối ưu bộ nhớ</b>. " +
          "Bộ nhớ tiết kiệm được <b>không dùng để làm gì khác</b> — nó được chuyển <b>trực tiếp</b> " +
          "thành số chuỗi phục vụ song song, tức là <b>thông lượng</b>, tức là <b>chi phí trên " +
          "mỗi yêu cầu</b>. Ở cấu hình mặc định, 17 chuỗi thành 231 chuỗi: <b>~14 lần</b>, " +
          "mà không đổi một tham số mô hình nào và không mất một điểm chất lượng nào.<br><br>" +
          "<b>Ba núm khác đáng thử:</b><ul>" +
          "<li><b>GQA</b> (biểu đồ dưới): giảm số đầu K/V từ 64 xuống 8 giảm đệm <b>đúng 8 lần</b>. " +
          "Đây là lý do gần như mọi mô hình phục vụ hiện đại dùng GQA.</li>" +
          "<li><b>Độ dài tối đa hỗ trợ</b>: kéo nó lên 32.768 và xem số chuỗi ở hàng ① sụp xuống. " +
          "\"Hỗ trợ ngữ cảnh dài\" <b>không miễn phí</b> — nó là một khoản trả bằng thông lượng.</li>" +
          "<li><b>Prompt hệ thống dùng chung</b>: với 2.000 token × hàng trăm chuỗi, " +
          "lưu riêng cho từng chuỗi là <b>bất khả thi</b>. Chia sẻ tiền tố không phải " +
          "một tối ưu — nó là <b>điều kiện để hệ tồn tại</b>.</li></ul>" +
          "<b>⚠️ Chẩn đoán liên quan:</b> nếu <code>p99 TPOT ≫ p50 TPOT</code> trong khi GPU " +
          "chưa đầy tải, vấn đề thường là <b>nhiễu do prefill</b> — một yêu cầu prompt dài chen vào " +
          "và làm dừng việc giải mã của mọi chuỗi khác — <i>không phải</i> thiếu công suất."
      });
      ve();
    }
  });
})();
