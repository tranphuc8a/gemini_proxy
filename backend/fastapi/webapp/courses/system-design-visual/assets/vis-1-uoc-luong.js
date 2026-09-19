/* =====================================================================
   Nhom 1 — Uoc luong & hang doi
   hang-doi-utilization (b.2) · duoi-tre-fanout (b.44) · cache-hieu-qua (b.10)
   · bao-retry (b.42)
   ===================================================================== */
(function () {
  var V = window.VIS;

  /* ================================================================
     Vi sao he thong sap o 80 % cong suat
     ================================================================ */
  demo({
    id: "hang-doi-utilization", nhom: "Ước lượng & hàng đợi", mon: "B02",
    ten: "Vì sao hệ thống sập ở 80 % công suất",
    moTa: "<code>W ∝ 1/(1−ρ)</code> — đường cong gậy hockey. " +
          "Kéo utilization qua 80 % và xem độ trễ nổ.",
    lienKet: '<a href="../web/index.html#/bai/bai-02-do-tre-thong-luong-capacity">B02 — Độ trễ, thông lượng, capacity</a>',
    dung: function (host) {
      var W = 560, H = 300, W2 = 560, H2 = 240;
      var cv = V.veBang(W, H), g = cv.g;
      var cv2 = V.veBang(W2, H2), g2 = cv2.g;

      var tt = { rho: 0.8, sv: 20, dinh: 1.25 };

      function heSo(r) { return 1 / (1 - Math.min(0.995, r)); }

      function ve() {
        g.clearRect(0, 0, W, H);
        var padL = 54, padT = 30, padB = 42;
        var w = W - padL - 18, h = H - padT - padB;
        var yMax = 22;

        var X = function (r) { return padL + r * w; };
        var Y = function (v) { return padT + h - Math.min(v, yMax) / yMax * h; };

        g.fillStyle = V.mau("tx"); g.font = "600 12.5px system-ui"; g.textAlign = "left";
        g.fillText("Hệ số chờ theo utilization  —  W ∝ 1/(1−ρ)", padL, 18);

        g.strokeStyle = V.mau("bd2"); g.lineWidth = 1;
        g.fillStyle = V.mau("tx3"); g.font = "10px system-ui"; g.textAlign = "right";
        for (var i = 0; i <= 4; i++) {
          var v = yMax * i / 4, yy = Y(v);
          g.beginPath(); g.moveTo(padL, yy); g.lineTo(padL + w, yy); g.stroke();
          g.fillText(v.toFixed(0) + "×", padL - 6, yy + 3);
        }
        g.textAlign = "center";
        for (i = 0; i <= 10; i += 2) {
          g.fillText((i * 10) + "%", X(i / 10), padT + h + 15);
        }
        g.fillText("utilization ρ", padL + w / 2, padT + h + 30);

        /* vung an toan / canh bao / nguy hiem */
        [[0, 0.7, "rgba(15,118,110,.10)"], [0.7, 0.85, "rgba(180,83,9,.12)"],
         [0.85, 1, "rgba(185,28,28,.12)"]].forEach(function (z) {
          g.fillStyle = z[2];
          g.fillRect(X(z[0]), padT, X(z[1]) - X(z[0]), h);
        });

        /* duong cong */
        g.strokeStyle = V.mau("ac"); g.lineWidth = 2.6;
        g.beginPath();
        for (var r = 0; r <= 0.985; r += 0.002) {
          var yy = Y(heSo(r));
          if (r === 0) g.moveTo(X(r), yy); else g.lineTo(X(r), yy);
        }
        g.stroke();

        /* diem hien tai + dinh tai */
        var r2 = Math.min(0.995, tt.rho * tt.dinh);
        g.save(); g.setLineDash([3, 3]); g.strokeStyle = V.mau("tx3"); g.lineWidth = 1.4;
        g.beginPath(); g.moveTo(X(r2), padT); g.lineTo(X(r2), padT + h); g.stroke();
        g.restore();
        g.fillStyle = V.mau("loi");
        g.beginPath(); g.arc(X(r2), Y(heSo(r2)), 5, 0, 6.2832); g.fill();

        g.strokeStyle = V.mau("ac"); g.lineWidth = 1.8;
        g.beginPath(); g.moveTo(X(tt.rho), padT); g.lineTo(X(tt.rho), padT + h); g.stroke();
        g.fillStyle = V.mau("ac");
        g.beginPath(); g.arc(X(tt.rho), Y(heSo(tt.rho)), 5.5, 0, 6.2832); g.fill();

        g.textAlign = "left"; g.font = "700 10.5px system-ui";
        g.fillStyle = V.mau("ac");
        g.fillText("bình thường ρ=" + (tt.rho * 100).toFixed(0) + "% → " +
                   heSo(tt.rho).toFixed(1) + "×", padL + 8, padT + 14);
        g.fillStyle = V.mau("loi");
        g.fillText("khi có đỉnh ×" + tt.dinh.toFixed(2) + " → ρ=" + (r2 * 100).toFixed(0) +
                   "% → " + heSo(r2).toFixed(1) + "×", padL + 8, padT + 29);
      }

      function ve2() {
        g2.clearRect(0, 0, W2, H2);
        g2.fillStyle = V.mau("tx"); g2.font = "600 12.5px system-ui"; g2.textAlign = "left";
        g2.fillText("Bảng phải thuộc (bài 2 §6):", 14, 20);

        var BANG = [[0.5, 2], [0.8, 5], [0.9, 10], [0.95, 20], [0.99, 100]];
        BANG.forEach(function (b, i) {
          var y = 40 + i * 21;
          var gan = Math.abs(tt.rho - b[0]) < 0.03;
          if (gan) { g2.fillStyle = V.mau("acbg"); g2.fillRect(10, y - 13, 250, 19); }
          g2.fillStyle = V.mau("tx2"); g2.font = (gan ? "700 " : "") + "11.5px ui-monospace, monospace";
          g2.fillText("ρ = " + (b[0] * 100).toFixed(0) + " %", 18, y);
          g2.fillStyle = b[1] >= 10 ? V.mau("loi") : (b[1] >= 5 ? "#b45309" : "#0f766e");
          g2.font = "700 11.5px ui-monospace, monospace";
          g2.fillText("hệ số chờ " + b[1] + "×", 110, y);
        });

        /* do tre thuc te */
        var W0 = tt.sv;
        var r2 = Math.min(0.995, tt.rho * tt.dinh);
        var d1 = W0 * heSo(tt.rho), d2 = W0 * heSo(r2);
        g2.fillStyle = V.mau("tx"); g2.font = "600 12px system-ui";
        g2.fillText("Với thời gian phục vụ " + W0 + " ms:", 300, 20);
        [["Bình thường", d1, V.mau("ac")], ["Khi có đỉnh tải", d2, V.mau("loi")]]
          .forEach(function (q, i) {
            var y = 44 + i * 40;
            g2.fillStyle = V.mau("tx2"); g2.font = "11px system-ui";
            g2.fillText(q[0], 300, y);
            g2.fillStyle = q[2]; g2.font = "700 17px ui-monospace, monospace";
            g2.fillText(q[1].toFixed(0) + " ms", 300, y + 21);
          });

        var y0 = 152;
        g2.fillStyle = V.mau("tx"); g2.font = "700 12px system-ui";
        g2.fillText("⇒ Độ trễ nhân " + (d2 / d1).toFixed(1) + " lần chỉ vì tải tăng " +
                    ((tt.dinh - 1) * 100).toFixed(0) + " %.", 14, y0);
        g2.fillStyle = V.mau("tx2"); g2.font = "11.5px system-ui";
        g2.fillText("Chạy ở 50–60 % utilization là BÌNH THƯỜNG, không phải lãng phí.", 14, y0 + 22);
        g2.fillStyle = V.mau("ac"); g2.font = "700 12px system-ui";
        g2.fillText("Headroom là TÍNH NĂNG, không phải dư thừa.", 14, y0 + 44);
        g2.fillStyle = V.mau("tx3"); g2.font = "11px system-ui";
        g2.fillText("Đây là lý do mọi hướng dẫn capacity planning đặt ngưỡng scale ở 60–70 %.",
                    14, y0 + 66);
      }

      function veHet() { ve(); ve2(); }

      var dk = [
        V.truot({ ten: "ρ — utilization bình thường", min: 0.05, max: 0.98, buoc: 0.01,
                  giaTri: tt.rho, doi: function (v) { tt.rho = v; veHet(); } }),
        V.truot({ ten: "Đỉnh tải (× so với bình thường)", min: 1, max: 2, buoc: 0.05,
                  giaTri: tt.dinh, doi: function (v) { tt.dinh = v; veHet(); } }),
        V.truot({ ten: "Thời gian phục vụ (ms)", min: 1, max: 200, buoc: 1, giaTri: tt.sv,
                  doi: function (v) { tt.sv = v; veHet(); } })
      ];

      V.khung(host, {
        ve: [cv, cv2], dieuKhien: dk,
        giaiThich:
          "<b>Đây là kết quả phản trực giác quan trọng nhất của bài 2.</b> " +
          "Với tốc độ đến <b>ngẫu nhiên</b>, thời gian chờ không tăng tuyến tính theo tải — " +
          "nó tăng theo <code>1/(1−ρ)</code>.<ul>" +
          "<li>Ở <b>ρ = 50 %</b>, hệ thống \"rảnh một nửa\" nhưng hệ số chờ đã là <b>2×</b>.</li>" +
          "<li>Ở <b>ρ = 90 %</b> là <b>10×</b>. Ở <b>99 %</b> là <b>100×</b>. " +
          "Đường cong dựng đứng, và nó dựng đứng <b>trước</b> khi bạn hết công suất.</li></ul>" +
          "<b>★ Thí nghiệm quyết định — kéo \"Đỉnh tải\" lên 1,25:</b><ul>" +
          "<li>Đặt ρ = <b>0,60</b> rồi kéo đỉnh tải: ρ lên 0,75, độ trễ chỉ nhân ~1,6 lần. " +
          "<b>Hệ thống chịu được.</b></li>" +
          "<li>Đặt ρ = <b>0,80</b> rồi kéo cùng đỉnh tải đó: ρ lên 1,0 — " +
          "<b>độ trễ nổ</b>, hàng đợi dài vô hạn, timeout dây chuyền. " +
          "★ <b>Cùng một đỉnh tải 25 %, hai kết cục hoàn toàn khác nhau</b> — " +
          "khác biệt duy nhất là điểm xuất phát.</li></ul>" +
          "<b>★ Vì sao \"tiết kiệm\" bằng cách chạy ở 85 % là một cái bẫy:</b> bạn tiết kiệm " +
          "được ~20 % máy chủ, nhưng đổi lại <b>mất toàn bộ khả năng hấp thụ đỉnh tải</b>. " +
          "Và đỉnh tải thì không xin phép.<br><br>" +
          "<b>⇒ Ba hệ quả hành động:</b><br>" +
          "① Ngưỡng cảnh báo đặt ở <b>utilization</b>, không phải ở độ trễ — vì lúc độ trễ " +
          "kêu thì đã muộn ·<br>" +
          "② Tự động mở rộng phải kích hoạt ở <b>60–70 %</b>, và phải tính cả " +
          "<b>thời gian khởi động</b> của instance mới ·<br>" +
          "③ Khi ai đó hỏi \"sao server chỉ chạy 50 % mà không cắt bớt?\", " +
          "câu trả lời là đường cong này."
      });
      veHet();
    }
  });

  /* ================================================================
     Tail latency va fan-out
     ================================================================ */
  demo({
    id: "duoi-tre-fanout", nhom: "Ước lượng & hàng đợi", mon: "B44",
    ten: "Tail latency — vì sao fan-out khuếch đại đuôi",
    moTa: "Mỗi service p99 = 100 ms. Gọi 100 service song song thì " +
          "<b>p99 của một thành phần thành trải nghiệm ĐIỂN HÌNH</b>.",
    lienKet: '<a href="../web/index.html#/bai/bai-44-hieu-nang-tail-latency">B44 — Tail latency</a>',
    dung: function (host) {
      var W = 560, H = 290, W2 = 560, H2 = 250;
      var cv = V.veBang(W, H), g = cv.g;
      var cv2 = V.veBang(W2, H2), g2 = cv2.g;

      var tt = { n: 100, p: 0.99, hedge: false };

      /* xac suat KHONG gap dich vu cham nao */
      function pSach(n, p) { return Math.pow(p, n); }

      function ve() {
        g.clearRect(0, 0, W, H);
        var padL = 50, padT = 32, padB = 42;
        var w = W - padL - 18, h = H - padT - padB;

        g.fillStyle = V.mau("tx"); g.font = "600 12.5px system-ui"; g.textAlign = "left";
        g.fillText("Xác suất một request CHẠM vào đuôi chậm, theo số service gọi song song",
                   14, 18);

        var nMax = 200;
        var X = function (n) { return padL + n / nMax * w; };
        var Y = function (v) { return padT + h - v * h; };

        g.strokeStyle = V.mau("bd2"); g.lineWidth = 1;
        g.fillStyle = V.mau("tx3"); g.font = "10px system-ui"; g.textAlign = "right";
        for (var i = 0; i <= 4; i++) {
          var yy = Y(i / 4);
          g.beginPath(); g.moveTo(padL, yy); g.lineTo(padL + w, yy); g.stroke();
          g.fillText((i * 25) + "%", padL - 6, yy + 3);
        }
        g.textAlign = "center";
        for (i = 0; i <= 200; i += 50) g.fillText(String(i), X(i), padT + h + 15);
        g.fillText("số service gọi song song (fan-out)", padL + w / 2, padT + h + 30);

        /* duong cho nhieu muc p */
        [[0.99, V.mau("ac"), "p99 mỗi service"],
         [0.999, "#0f766e", "p99.9 mỗi service"],
         [0.95, "#b91c1c", "p95 mỗi service"]].forEach(function (q) {
          g.strokeStyle = q[1]; g.lineWidth = q[0] === tt.p ? 2.8 : 1.4;
          g.globalAlpha = q[0] === tt.p ? 1 : 0.45;
          g.beginPath();
          for (var n = 1; n <= nMax; n++) {
            var yy = Y(1 - pSach(n, q[0]));
            if (n === 1) g.moveTo(X(n), yy); else g.lineTo(X(n), yy);
          }
          g.stroke(); g.globalAlpha = 1;
        });

        /* diem hien tai */
        var pr = 1 - pSach(tt.n, tt.p);
        g.save(); g.setLineDash([3, 3]); g.strokeStyle = V.mau("ac"); g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(X(tt.n), padT); g.lineTo(X(tt.n), padT + h); g.stroke();
        g.restore();
        g.fillStyle = V.mau("ac");
        g.beginPath(); g.arc(X(tt.n), Y(pr), 6, 0, 6.2832); g.fill();
        g.strokeStyle = "#fff"; g.lineWidth = 2; g.stroke();

        g.textAlign = "left"; g.font = "600 10.5px system-ui";
        g.fillStyle = "#b91c1c"; g.fillText("── p95 mỗi service", padL + 8, padT + 12);
        g.fillStyle = V.mau("ac"); g.fillText("── p99 mỗi service", padL + 8, padT + 26);
        g.fillStyle = "#0f766e"; g.fillText("── p99.9 mỗi service", padL + 8, padT + 40);
      }

      function ve2() {
        g2.clearRect(0, 0, W2, H2);
        var sach = pSach(tt.n, tt.p);
        var cham = 1 - sach;

        g2.fillStyle = V.mau("tx"); g2.font = "600 12.5px system-ui"; g2.textAlign = "left";
        g2.fillText("Phép tính của bài 44 §2.1:", 14, 20);

        var dong = [
          ["Số service gọi song song", String(tt.n)],
          ["Phân vị mỗi service", "p" + (tt.p * 100).toFixed(tt.p >= 0.999 ? 1 : 0)],
          ["P(không gặp đuôi nào) = p^n", sach.toFixed(4)],
          ["★ P(CHẠM ít nhất một đuôi)", (cham * 100).toFixed(1) + " %"]
        ];
        g2.font = "11.5px system-ui";
        dong.forEach(function (d, i) {
          var y = 44 + i * 21;
          g2.fillStyle = V.mau("tx2"); g2.fillText(d[0], 18, y);
          g2.fillStyle = i === 3 ? (cham > 0.3 ? V.mau("loi") : "#0f766e") : V.mau("tx");
          g2.font = (i === 3 ? "700 13px " : "600 11.5px ") + "ui-monospace, monospace";
          g2.fillText(d[1], 300, y);
          g2.font = "11.5px system-ui";
        });

        /* thanh truc quan */
        var y0 = 140, bw = W2 - 28;
        g2.fillStyle = "#0f766e"; g2.fillRect(14, y0, bw * sach, 24);
        g2.fillStyle = V.mau("loi"); g2.fillRect(14 + bw * sach, y0, bw * cham, 24);
        g2.fillStyle = "#fff"; g2.font = "700 11px system-ui";
        if (sach > 0.12) g2.fillText("nhanh " + (sach * 100).toFixed(0) + "%", 22, y0 + 16);
        if (cham > 0.12) g2.fillText("chậm " + (cham * 100).toFixed(0) + "%",
                                     18 + bw * sach + 4, y0 + 16);

        g2.fillStyle = V.mau("ac"); g2.font = "700 12px system-ui";
        g2.fillText("⇒ p99 của MỘT thành phần trở thành trải nghiệm ĐIỂN HÌNH của người dùng.",
                    14, y0 + 48);
        g2.fillStyle = V.mau("tx2"); g2.font = "11px system-ui";
        g2.fillText("Ví dụ chuẩn: 100 service × p99=100ms ⇒ 0,99¹⁰⁰ = 0,366 ⇒ 63 % request chậm.",
                    14, y0 + 70);
      }

      function veHet() { ve(); ve2(); }

      var dk = [
        V.truot({ ten: "Số service gọi song song", min: 1, max: 200, buoc: 1, giaTri: tt.n,
                  doi: function (v) { tt.n = v; veHet(); } }),
        V.chon({ ten: "Phân vị mỗi service", giaTri: String(tt.p),
                 muc: [{ v: "0.95", t: "p95" }, { v: "0.99", t: "p99" },
                       { v: "0.999", t: "p99.9" }],
                 doi: function (v) { tt.p = parseFloat(v); veHet(); } })
      ];

      V.khung(host, {
        ve: [cv, cv2], dieuKhien: dk,
        giaiThich:
          "<b>Phép tính khiến ai cũng giật mình:</b> một trang gọi <b>100 service song song</b>, " +
          "mỗi cái có p99 = 100 ms. Xác suất <b>không</b> gặp cái chậm nào là " +
          "<code>0,99¹⁰⁰ = 0,366</code>.<ul>" +
          "<li>⇒ <b>63,4 % số request sẽ chạm vào ít nhất một service đang ở đuôi.</b></li>" +
          "<li>★ Nói cách khác: <b>p99 của MỘT thành phần trở thành trải nghiệm ĐIỂN HÌNH " +
          "của người dùng.</b> Đây là lý do tối ưu trung bình gần như vô dụng trong " +
          "kiến trúc microservice.</li></ul>" +
          "<b>★ Thí nghiệm — đổi phân vị sang p99.9 và giữ n = 100:</b> tỷ lệ chạm tụt xuống " +
          "~10 %. ⇒ <b>Trong hệ fan-out rộng, bạn phải tối ưu p99.9 của từng thành phần, " +
          "không phải p99.</b> Mỗi chữ số 9 thêm vào ở thành phần mua lại được một bậc " +
          "ở hệ thống.<br><br>" +
          "<b>★ Bảy nguồn gốc của tail latency</b> (bài 44 §2): " +
          "① tranh chấp tài nguyên · ② <b>GC / STW pause</b> (p99 nhảy vọt định kỳ) · " +
          "③ hàng đợi ở utilization cao (xem demo trước) · ④ cache miss · " +
          "⑤ retry · ⑥ node lỗi/chậm · ★ ⑦ <b>fan-out</b> — demo này.<br><br>" +
          "<b>★ Kỹ thuật chịu đuôi (tail-tolerant), theo hiệu quả:</b><ul>" +
          "<li><b>Hedged request:</b> gửi bản sao thứ hai sau khi chờ quá p95, lấy cái về trước, " +
          "huỷ cái kia. Tốn <b>+5 % tải</b> nhưng <b>giảm p99 rất mạnh</b> — " +
          "đánh đổi tốt nhất trong nhóm.</li>" +
          "<li><b>Bỏ qua node chậm:</b> LB tránh node có p99 cao gần đây. Cần đo liên tục.</li>" +
          "<li><b>Giảm fan-out:</b> gộp nhiều lời gọi thành một, hoặc lấy dữ liệu " +
          "bất đồng bộ. ★ Rẻ nhất và bền nhất — vì nó tấn công <b>n</b> trong công thức, " +
          "không phải <b>p</b>.</li></ul>"
      });
      veHet();
    }
  });

  /* ================================================================
     Cache — ty le trung va do tre hieu dung
     ================================================================ */
  demo({
    id: "cache-hieu-qua", nhom: "Ước lượng & hàng đợi", mon: "B10",
    ten: "Cache — tỷ lệ trúng đổi độ trễ thế nào",
    moTa: "Độ trễ hiệu dụng <b>không tuyến tính</b> theo tỷ lệ trúng. " +
          "Xem vì sao 90 % → 95 % đáng giá hơn 50 % → 60 %.",
    lienKet: '<a href="../web/index.html#/bai/bai-10-caching-can-ban">B10 — Caching căn bản</a>',
    dung: function (host) {
      var W = 560, H = 290, W2 = 560, H2 = 230;
      var cv = V.veBang(W, H), g = cv.g;
      var cv2 = V.veBang(W2, H2), g2 = cv2.g;

      var tt = { h: 0.9, tHit: 1, tMiss: 60 };

      function tre(h) { return h * tt.tHit + (1 - h) * tt.tMiss; }

      function ve() {
        g.clearRect(0, 0, W, H);
        var padL = 54, padT = 30, padB = 42;
        var w = W - padL - 18, h = H - padT - padB;
        var yMax = tt.tMiss;

        g.fillStyle = V.mau("tx"); g.font = "600 12.5px system-ui"; g.textAlign = "left";
        g.fillText("Độ trễ hiệu dụng = h·t_hit + (1−h)·t_miss", padL, 18);

        var X = function (x) { return padL + x * w; };
        var Y = function (v) { return padT + h - v / yMax * h; };

        g.strokeStyle = V.mau("bd2"); g.lineWidth = 1;
        g.fillStyle = V.mau("tx3"); g.font = "10px system-ui"; g.textAlign = "right";
        for (var i = 0; i <= 4; i++) {
          var v = yMax * i / 4, yy = Y(v);
          g.beginPath(); g.moveTo(padL, yy); g.lineTo(padL + w, yy); g.stroke();
          g.fillText(v.toFixed(0) + "ms", padL - 6, yy + 3);
        }
        g.textAlign = "center";
        for (i = 0; i <= 10; i += 2) g.fillText((i * 10) + "%", X(i / 10), padT + h + 15);
        g.fillText("tỷ lệ trúng cache h", padL + w / 2, padT + h + 30);

        g.strokeStyle = V.mau("ac"); g.lineWidth = 2.6;
        g.beginPath();
        for (var x = 0; x <= 1; x += 0.005) {
          var yy = Y(tre(x));
          if (x === 0) g.moveTo(X(x), yy); else g.lineTo(X(x), yy);
        }
        g.stroke();

        /* danh dau hai buoc cai thien 10 diem */
        [[0.5, 0.6, "#b45309"], [0.9, 1.0, "#0f766e"]].forEach(function (q) {
          var a = tre(q[0]), b = tre(q[1]);
          g.strokeStyle = q[2]; g.lineWidth = 2.2;
          g.beginPath(); g.moveTo(X(q[0]), Y(a)); g.lineTo(X(q[1]), Y(b)); g.stroke();
          g.fillStyle = q[2];
          [[q[0], a], [q[1], b]].forEach(function (p) {
            g.beginPath(); g.arc(X(p[0]), Y(p[1]), 4, 0, 6.2832); g.fill();
          });
          g.font = "700 10px system-ui"; g.textAlign = "left";
          g.fillText("−" + (a - b).toFixed(1) + " ms", X(q[1]) + 5, Y(b) - 3);
        });

        g.save(); g.setLineDash([3, 3]); g.strokeStyle = V.mau("ac"); g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(X(tt.h), padT); g.lineTo(X(tt.h), padT + h); g.stroke();
        g.restore();
      }

      function ve2() {
        g2.clearRect(0, 0, W2, H2);
        g2.fillStyle = V.mau("tx"); g2.font = "600 12.5px system-ui"; g2.textAlign = "left";
        g2.fillText("Ở tỷ lệ trúng h = " + (tt.h * 100).toFixed(0) + " %:", 14, 20);

        var d = tre(tt.h);
        var dong = [
          ["Độ trứ hiệu dụng", d.toFixed(2) + " ms"],
          ["Tỷ lệ TRƯỢT", ((1 - tt.h) * 100).toFixed(1) + " %"],
          ["Phần độ trễ do TRƯỢT gây ra",
           (((1 - tt.h) * tt.tMiss) / d * 100).toFixed(1) + " %"],
          ["Tải xuống DB (so với không cache)", ((1 - tt.h) * 100).toFixed(1) + " %"]
        ];
        g2.font = "11.5px system-ui";
        dong.forEach(function (q, i) {
          var y = 44 + i * 21;
          g2.fillStyle = V.mau("tx2"); g2.fillText(q[0], 18, y);
          g2.fillStyle = i === 2 ? V.mau("loi") : V.mau("tx");
          g2.font = "700 12px ui-monospace, monospace";
          g2.fillText(q[1], 300, y);
          g2.font = "11.5px system-ui";
        });

        var y0 = 142;
        g2.fillStyle = V.mau("ac"); g2.font = "700 12px system-ui";
        g2.fillText("★ 50 % → 60 % tiết kiệm " + (tre(0.5) - tre(0.6)).toFixed(1) +
                    " ms.  90 % → 100 % tiết kiệm " + (tre(0.9) - tre(1)).toFixed(1) + " ms.",
                    14, y0);
        g2.fillStyle = V.mau("tx2"); g2.font = "11.5px system-ui";
        g2.fillText("Cùng 10 điểm phần trăm — nhưng giá trị RẤT khác nhau.", 14, y0 + 20);
        g2.fillStyle = V.mau("loi"); g2.font = "700 11.5px system-ui";
        g2.fillText("⚠ Và tải xuống DB giảm từ 50 % xuống 40 % (×0,8) so với 10 % xuống 0 % (×0).",
                    14, y0 + 42);
        g2.fillStyle = V.mau("tx3"); g2.font = "11px system-ui";
        g2.fillText("Nghĩa là ở h cao, mỗi điểm trúng thêm mua được nhiều hơn HẲN ở h thấp.",
                    14, y0 + 62);
      }

      function veHet() { ve(); ve2(); }

      var dk = [
        V.truot({ ten: "h — tỷ lệ trúng cache", min: 0, max: 1, buoc: 0.01, giaTri: tt.h,
                  doi: function (v) { tt.h = v; veHet(); } }),
        V.truot({ ten: "t_hit (ms)", min: 0.1, max: 10, buoc: 0.1, giaTri: tt.tHit,
                  doi: function (v) { tt.tHit = v; veHet(); } }),
        V.truot({ ten: "t_miss (ms)", min: 5, max: 300, buoc: 5, giaTri: tt.tMiss,
                  doi: function (v) { tt.tMiss = v; veHet(); } })
      ];

      V.khung(host, {
        ve: [cv, cv2], dieuKhien: dk,
        giaiThich:
          "<b>Công thức thì tuyến tính, nhưng ý nghĩa thì không.</b> " +
          "<code>t_hiệu_dụng = h·t_hit + (1−h)·t_miss</code> là một đường thẳng — " +
          "cái không tuyến tính là <b>giá trị của việc cải thiện h</b>.<ul>" +
          "<li>Nhìn hai đoạn được đánh dấu trên hình: cả hai đều là <b>10 điểm phần trăm</b>, " +
          "nhưng chúng cắt cùng một lượng ms. Vậy tại sao lại khác nhau?</li>" +
          "<li>★ Vì thứ quan trọng không phải <b>ms tiết kiệm</b> mà là <b>tải còn lại " +
          "đổ xuống DB</b>: từ 50 %→60 % giảm tải DB đi <b>1/5</b>; từ 90 %→100 % " +
          "giảm tải DB đi <b>toàn bộ</b>. Ở h cao, mỗi điểm trúng thêm " +
          "<b>mua được nhiều hơn hẳn</b>.</li></ul>" +
          "<b>★ Và đây là chỗ nguy hiểm — kéo h xuống 0 để mô phỏng cache sập:</b> " +
          "độ trễ nhảy thẳng lên <code>t_miss</code>, và <b>toàn bộ tải đổ xuống DB cùng lúc</b>. " +
          "Nếu DB được định cỡ cho 10 % tải (vì cache vẫn đang trúng 90 %), " +
          "nó sẽ sập ngay lập tức.<ul>" +
          "<li>Đây là <b>thundering herd</b> / <b>cache stampede</b>, và nó là một trong " +
          "những nguyên nhân sự cố phổ biến nhất trong hệ thống thật.</li>" +
          "<li><b>Cách chống:</b> ① <b>request coalescing</b> — nhiều request cùng key " +
          "trượt thì chỉ MỘT cái đi xuống DB · ② <b>TTL ngẫu nhiên hoá</b> (jitter) để " +
          "các key không hết hạn cùng lúc · ③ <b>stale-while-revalidate</b> — trả bản cũ " +
          "trong khi làm mới nền · ④ định cỡ DB cho kịch bản <b>cache trống</b>, " +
          "không phải cache đầy.</li></ul>" +
          "<b>⇒ Câu hỏi phải trả lời trong mọi thiết kế có cache: <i>\"nếu cache trống hoàn toàn " +
          "lúc 9 giờ sáng thứ Hai, hệ thống có sống sót không?\"</i> " +
          "Nếu câu trả lời là không, cache của bạn không phải tối ưu hoá — nó là " +
          "một điểm hỏng đơn.</b>"
      });
      veHet();
    }
  });

  /* ================================================================
     Bao retry va circuit breaker
     ================================================================ */
  demo({
    id: "bao-retry", nhom: "Vận hành", mon: "B42",
    ten: "Bão retry — vì sao thử lại làm sự cố nặng thêm",
    moTa: "Retry là phản xạ đầu tiên, và là <b>cách khuếch đại sự cố nhanh nhất</b>. " +
          "Bật/tắt jitter và circuit breaker để so.",
    lienKet: '<a href="../web/index.html#/bai/bai-42-resilience-patterns">B42 — Resilience patterns</a>',
    dung: function (host) {
      var W = 560, H = 290, W2 = 560, H2 = 230;
      var cv = V.veBang(W, H), g = cv.g;
      var cv2 = V.veBang(W2, H2), g2 = cv2.g;

      var tt = { retry: 3, jitter: false, cb: false, suCo: 40 };

      /* mo phong don gian: cong suat 100 don vi, tai nen 70, su co lam giam cong suat */
      function chay() {
        var T = 120, congSuat = 100, taiNen = 70;
        var ds = [], i;
        var cbMo = false, cbDem = 0;
        for (i = 0; i < T; i++) {
          var giam = (i >= 30 && i < 30 + tt.suCo) ? 0.45 : 1;
          var cs = congSuat * giam;
          var tai = taiNen;
          /* retry: phan bi tu choi se quay lai */
          var truoc = ds.length ? ds[ds.length - 1] : null;
          if (truoc && truoc.hong > 0 && !cbMo) {
            var he = tt.jitter ? 0.55 : 1;             /* jitter trai deu theo thoi gian */
            tai += truoc.hong * tt.retry * he;
          }
          if (cbMo) tai = taiNen * 0.15;               /* mach ngat: chan gan het */
          var phucVu = Math.min(tai, cs);
          var hong = Math.max(0, tai - cs);
          /* circuit breaker: mo khi ty le hong cao */
          if (tt.cb) {
            if (!cbMo && tai > 0 && hong / tai > 0.5) { cbMo = true; cbDem = 12; }
            else if (cbMo) { cbDem--; if (cbDem <= 0) cbMo = false; }
          }
          ds.push({ t: i, tai: tai, cs: cs, phucVu: phucVu, hong: hong, cb: cbMo });
        }
        return ds;
      }

      function ve() {
        g.clearRect(0, 0, W, H);
        var ds = chay();
        var padL = 46, padT = 30, padB = 40;
        var w = W - padL - 18, h = H - padT - padB;
        var yMax = Math.max(320, Math.max.apply(null, ds.map(function (d) { return d.tai; })) * 1.05);

        g.fillStyle = V.mau("tx"); g.font = "600 12.5px system-ui"; g.textAlign = "left";
        g.fillText("Tải đến (tím) vs công suất (xanh) — sự cố bắt đầu ở t = 30", padL, 18);

        var X = function (t) { return padL + t / (ds.length - 1) * w; };
        var Y = function (v) { return padT + h - v / yMax * h; };

        g.strokeStyle = V.mau("bd2"); g.lineWidth = 1;
        g.fillStyle = V.mau("tx3"); g.font = "10px system-ui"; g.textAlign = "right";
        for (var i = 0; i <= 4; i++) {
          var v = yMax * i / 4, yy = Y(v);
          g.beginPath(); g.moveTo(padL, yy); g.lineTo(padL + w, yy); g.stroke();
          g.fillText(v.toFixed(0), padL - 6, yy + 3);
        }

        /* vung su co */
        g.fillStyle = "rgba(185,28,28,.08)";
        g.fillRect(X(30), padT, X(30 + tt.suCo) - X(30), h);

        /* vung mach ngat mo */
        ds.forEach(function (d, k) {
          if (!d.cb) return;
          g.fillStyle = "rgba(14,116,144,.14)";
          g.fillRect(X(k), padT, Math.max(1, w / ds.length + 0.5), h);
        });

        /* cong suat */
        g.strokeStyle = "#0f766e"; g.lineWidth = 2; g.setLineDash([5, 3]);
        g.beginPath();
        ds.forEach(function (d, k) { var yy = Y(d.cs); if (!k) g.moveTo(X(k), yy); else g.lineTo(X(k), yy); });
        g.stroke(); g.setLineDash([]);

        /* tai */
        g.strokeStyle = V.mau("ac"); g.lineWidth = 2.4;
        g.beginPath();
        ds.forEach(function (d, k) { var yy = Y(d.tai); if (!k) g.moveTo(X(k), yy); else g.lineTo(X(k), yy); });
        g.stroke();

        g.textAlign = "left"; g.font = "600 10.5px system-ui";
        g.fillStyle = V.mau("ac"); g.fillText("── tải đến (gồm cả retry)", padL + 8, padT + 12);
        g.fillStyle = "#0f766e"; g.fillText("-- công suất phục vụ", padL + 8, padT + 26);
        g.fillStyle = V.mau("tx3"); g.font = "10px system-ui"; g.textAlign = "center";
        g.fillText("thời gian →", padL + w / 2, padT + h + 26);
      }

      function ve2() {
        g2.clearRect(0, 0, W2, H2);
        var ds = chay();
        var dinh = Math.max.apply(null, ds.map(function (d) { return d.tai; }));
        var tongHong = ds.reduce(function (a, d) { return a + d.hong; }, 0);
        var hoiPhuc = -1, i;
        for (i = 30 + tt.suCo; i < ds.length; i++) {
          if (ds[i].hong < 1) { hoiPhuc = i - (30 + tt.suCo); break; }
        }

        g2.fillStyle = V.mau("tx"); g2.font = "600 12.5px system-ui"; g2.textAlign = "left";
        g2.fillText("Kết cục của sự cố:", 14, 20);

        var dong = [
          ["Tải nền bình thường", "70"],
          ["★ Đỉnh tải khi có retry", dinh.toFixed(0) + (dinh > 200 ? "  ⚠ BÃO" : "")],
          ["Tổng request hỏng", tongHong.toFixed(0)],
          ["Thời gian hồi phục sau khi sự cố hết",
           hoiPhuc < 0 ? "KHÔNG hồi phục" : hoiPhuc + " nhịp"]
        ];
        g2.font = "11.5px system-ui";
        dong.forEach(function (d, k) {
          var y = 44 + k * 21;
          g2.fillStyle = V.mau("tx2"); g2.fillText(d[0], 18, y);
          var xau = (k === 1 && dinh > 200) || (k === 3 && hoiPhuc < 0);
          g2.fillStyle = xau ? V.mau("loi") : (k >= 2 ? V.mau("tx") : V.mau("ac"));
          g2.font = "700 12px ui-monospace, monospace";
          g2.fillText(d[1], 320, y);
          g2.font = "11.5px system-ui";
        });

        var y0 = 142;
        g2.fillStyle = V.mau("tx"); g2.font = "700 12px system-ui";
        g2.fillText("Đang bật: " +
          (tt.jitter ? "jitter ✓  " : "jitter ✗  ") +
          (tt.cb ? "circuit breaker ✓" : "circuit breaker ✗"), 14, y0);
        g2.fillStyle = V.mau("tx2"); g2.font = "11px system-ui";
        g2.fillText("Vùng đỏ = sự cố. Vùng xanh nhạt = mạch ngắt đang MỞ (chặn tải).", 14, y0 + 20);
        g2.fillStyle = V.mau("ac"); g2.font = "700 11.5px system-ui";
        g2.fillText("⇒ Retry KHÔNG làm hệ thống khoẻ hơn. Nó chuyển lỗi thành TẢI.", 14, y0 + 44);
      }

      function veHet() { ve(); ve2(); }

      var dk = [
        V.truot({ ten: "Số lần thử lại", min: 0, max: 5, buoc: 1, giaTri: tt.retry,
                  doi: function (v) { tt.retry = v; veHet(); } }),
        V.danhDau({ ten: "Backoff có jitter (giãn retry theo thời gian)", giaTri: tt.jitter,
                    doi: function (v) { tt.jitter = v; veHet(); } }),
        V.danhDau({ ten: "Circuit breaker (mạch ngắt)", giaTri: tt.cb,
                    doi: function (v) { tt.cb = v; veHet(); } }),
        V.truot({ ten: "Độ dài sự cố (nhịp)", min: 5, max: 60, buoc: 5, giaTri: tt.suCo,
                  doi: function (v) { tt.suCo = v; veHet(); } })
      ];

      V.khung(host, {
        ve: [cv, cv2], dieuKhien: dk,
        giaiThich:
          "⚖️ <b>Mô hình đơn giản hoá</b> (một tầng, thời gian rời rạc) — nhưng động lực " +
          "thì đúng và nó tái hiện được đúng ba bài học của bài 42.<ul>" +
          "<li><b>Kịch bản:</b> công suất 100, tải nền 70. Ở t = 30 một sự cố làm công suất " +
          "tụt còn 45. Phần request bị từ chối sẽ <b>thử lại</b>.</li></ul>" +
          "<b>★ Thí nghiệm 1 — tắt hết, để retry = 3:</b> tải vọt lên hàng trăm và " +
          "<b>ở lại đó</b>. Sự cố gốc chỉ làm giảm 55 % công suất, nhưng retry biến nó thành " +
          "<b>quá tải gấp nhiều lần</b>. ★ Và chú ý dòng \"thời gian hồi phục\": " +
          "ngay cả khi <b>sự cố gốc đã hết</b>, hệ thống <b>không tự hồi phục</b> — " +
          "vì retry tự nuôi chính nó. Đây là <b>metastable failure</b>, và nó là " +
          "lý do nhiều sự cố chỉ dừng khi có người vào tắt traffic.<br><br>" +
          "<b>★ Thí nghiệm 2 — bật jitter:</b> đỉnh tải thấp hẳn. " +
          "Jitter không giảm <b>số lượng</b> retry, nó chỉ <b>trải chúng ra theo thời gian</b> " +
          "— nhưng thế là đủ, vì thứ giết hệ thống là <b>đỉnh đồng bộ</b>. " +
          "⚠️ Exponential backoff <b>không có</b> jitter thì mọi client vẫn thử lại " +
          "<b>cùng một lúc</b> — nên jitter là phần bắt buộc, không phải tuỳ chọn.<br><br>" +
          "<b>★ Thí nghiệm 3 — bật circuit breaker:</b> khi tỷ lệ hỏng vượt ngưỡng, " +
          "mạch <b>mở</b> và <b>chặn gần hết tải</b> (vùng xanh nhạt). " +
          "Nghe có vẻ tệ — ta đang chủ động từ chối người dùng — nhưng nó " +
          "<b>cho service phía dưới cơ hội hồi phục</b>, và tổng số request hỏng " +
          "thường <b>ÍT HƠN</b>.<ul>" +
          "<li>★ Đây là đánh đổi trung tâm của resilience: <b>hỏng nhanh và có kiểm soát " +
          "tốt hơn hỏng chậm và dây chuyền.</b></li></ul>" +
          "<b>⇒ Bốn quy tắc retry dùng được ngay:</b> " +
          "① retry <b>chỉ</b> cho lỗi tạm thời và thao tác <b>idempotent</b> · " +
          "② luôn có <b>exponential backoff + jitter</b> · " +
          "③ giới hạn <b>tổng ngân sách retry</b> (ví dụ ≤ 10 % tổng request), không phải " +
          "giới hạn theo từng request · " +
          "④ <b>không retry ở nhiều tầng</b> — 3 tầng mỗi tầng retry 3 lần là " +
          "<b>27 lần</b> gọi cho một request."
      });
      veHet();
    }
  });

})();
