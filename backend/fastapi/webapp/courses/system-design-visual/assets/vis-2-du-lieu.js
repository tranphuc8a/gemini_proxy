/* =====================================================================
   Nhom 2 — Du lieu, nhat quan va phan tan
   nhan-ban-tre (b.19/26) · sharding-hotspot (b.20) · cap-pacelc (b.27)
   · slo-error-budget (b.41)
   ===================================================================== */
(function () {
  var V = window.VIS;

  /* ================================================================
     Do tre nhan ban va cac bao dam doc
     ================================================================ */
  demo({
    id: "nhan-ban-tre", nhom: "Dữ liệu & nhất quán", mon: "B19",
    ten: "Độ trễ nhân bản — và ba bảo đảm đọc",
    moTa: "Ghi vào primary, đọc từ replica. Xem <b>khi nào người dùng " +
          "không thấy thứ mình vừa ghi</b>, và ba cách chữa.",
    lienKet: '<a href="../web/index.html#/bai/bai-19-replication">B19 — Replication</a>',
    dung: function (host) {
      var W = 560, H = 300, W2 = 560, H2 = 230;
      var cv = V.veBang(W, H), g = cv.g;
      var cv2 = V.veBang(W2, H2), g2 = cv2.g;

      var tt = { tre: 120, doc: 60, chinhSach: "batky" };

      var CS = {
        batky: { t: "Đọc từ replica bất kỳ", mo: "Nhanh nhất, rẻ nhất — và có thể đọc dữ liệu cũ." },
        doclai: { t: "Read-your-writes (dính phiên)", mo: "Người vừa ghi thì đọc từ primary trong N giây." },
        primary: { t: "Luôn đọc từ primary", mo: "Luôn mới nhất — nhưng mất hết lợi ích của replica." }
      };

      function ve() {
        g.clearRect(0, 0, W, H);
        var padL = 96, padT = 40;
        var Tmax = 400;
        var w = W - padL - 20;
        var X = function (t) { return padL + t / Tmax * w; };

        g.fillStyle = V.mau("tx"); g.font = "600 12.5px system-ui"; g.textAlign = "left";
        g.fillText("Dòng thời gian một lần ghi rồi đọc lại", 14, 20);

        var HANG = [
          { t: "Client", y: 64 },
          { t: "Primary", y: 118 },
          { t: "Replica", y: 172 }
        ];
        HANG.forEach(function (h) {
          g.fillStyle = V.mau("tx2"); g.font = "600 11px system-ui"; g.textAlign = "right";
          g.fillText(h.t, padL - 10, h.y + 4);
          g.strokeStyle = V.mau("bd"); g.lineWidth = 1;
          g.beginPath(); g.moveTo(padL, h.y); g.lineTo(padL + w, h.y); g.stroke();
        });

        /* ghi tai t=0 */
        g.fillStyle = "#0f766e";
        g.beginPath(); g.arc(X(0) + 4, HANG[0].y, 5, 0, 6.2832); g.fill();
        g.font = "10px system-ui"; g.textAlign = "left";
        g.fillText("GHI", X(0) + 12, HANG[0].y - 8);

        /* mui ten ghi xuong primary */
        g.strokeStyle = "#0f766e"; g.lineWidth = 1.8;
        g.beginPath(); g.moveTo(X(0) + 4, HANG[0].y + 6); g.lineTo(X(10), HANG[1].y - 6); g.stroke();

        /* nhan ban toi replica */
        g.strokeStyle = "#b45309"; g.lineWidth = 2; g.setLineDash([4, 3]);
        g.beginPath(); g.moveTo(X(10), HANG[1].y + 6); g.lineTo(X(10 + tt.tre), HANG[2].y - 6); g.stroke();
        g.setLineDash([]);
        g.fillStyle = "#b45309"; g.font = "700 10px system-ui";
        g.fillText("độ trễ nhân bản " + tt.tre + " ms", X(10) + 6, (HANG[1].y + HANG[2].y) / 2);

        /* doc tai t = doc */
        var tDoc = tt.doc;
        var dungPrimary = (tt.chinhSach === "primary") ||
                          (tt.chinhSach === "doclai" && tDoc < 500);
        var nguon = dungPrimary ? HANG[1] : HANG[2];
        var moi = dungPrimary || (tDoc >= 10 + tt.tre);

        g.fillStyle = V.mau("ac");
        g.beginPath(); g.arc(X(tDoc), HANG[0].y, 5, 0, 6.2832); g.fill();
        g.font = "10px system-ui";
        g.fillText("ĐỌC", X(tDoc) + 8, HANG[0].y - 8);

        g.strokeStyle = moi ? "#0f766e" : "#b91c1c"; g.lineWidth = 2;
        g.beginPath(); g.moveTo(X(tDoc), HANG[0].y + 6); g.lineTo(X(tDoc), nguon.y - 6); g.stroke();
        g.fillStyle = moi ? "#0f766e" : "#b91c1c";
        g.beginPath(); g.arc(X(tDoc), nguon.y, 5, 0, 6.2832); g.fill();

        /* vung "chua nhan ban xong" */
        g.fillStyle = "rgba(185,28,28,.10)";
        g.fillRect(X(10), HANG[2].y - 16, X(10 + tt.tre) - X(10), 32);

        g.textAlign = "left";
        g.fillStyle = moi ? "#0f766e" : "#b91c1c";
        g.font = "700 13px system-ui";
        g.fillText(moi ? "✓ Đọc được dữ liệu MỚI"
                       : "✗ Đọc phải dữ liệu CŨ — người dùng không thấy thứ mình vừa ghi",
                   14, H - 34);
        g.fillStyle = V.mau("tx2"); g.font = "11.5px system-ui";
        g.fillText(CS[tt.chinhSach].mo, 14, H - 14);
      }

      function ve2() {
        g2.clearRect(0, 0, W2, H2);
        g2.fillStyle = V.mau("tx"); g2.font = "600 12.5px system-ui"; g2.textAlign = "left";
        g2.fillText("Ba bảo đảm đọc — đánh đổi giữa mới và rẻ:", 14, 20);

        var B = [
          { t: "Đọc replica bất kỳ", tai: "thấp nhất", tre: "thấp nhất",
            bd: "Nhất quán cuối cùng", mau: "#0f766e",
            gc: "Hỏng khi: người dùng vừa sửa hồ sơ, tải lại trang, thấy dữ liệu cũ." },
          { t: "Read-your-writes", tai: "trung bình", tre: "trung bình",
            bd: "Thấy được ghi của CHÍNH MÌNH", mau: "#b45309",
            gc: "Cách làm: gắn phiên vào primary trong N giây, hoặc so token phiên bản." },
          { t: "Luôn đọc primary", tai: "cao nhất", tre: "cao nhất",
            bd: "Nhất quán mạnh", mau: "#b91c1c",
            gc: "Mất hết lợi ích mở rộng của replica. Chỉ dùng cho đường đọc quan trọng." }
        ];
        B.forEach(function (b, i) {
          var y = 40 + i * 58;
          var dang = (i === 0 && tt.chinhSach === "batky") ||
                     (i === 1 && tt.chinhSach === "doclai") ||
                     (i === 2 && tt.chinhSach === "primary");
          if (dang) { g2.fillStyle = V.mau("acbg"); g2.fillRect(10, y - 14, W2 - 20, 54); }
          g2.fillStyle = b.mau; g2.font = "700 11.5px system-ui";
          g2.fillText(b.t, 18, y);
          g2.fillStyle = V.mau("tx2"); g2.font = "10.5px system-ui";
          g2.fillText("tải primary: " + b.tai + "  ·  độ trễ đọc: " + b.tre, 18, y + 16);
          g2.fillStyle = V.mau("tx"); g2.font = "600 10.5px system-ui";
          g2.fillText(b.bd, 300, y);
          g2.fillStyle = V.mau("tx3"); g2.font = "10px system-ui";
          g2.fillText(b.gc, 18, y + 32);
        });
      }

      function veHet() { ve(); ve2(); }

      var dk = [
        V.chon({ ten: "Chính sách đọc", giaTri: tt.chinhSach,
                 muc: Object.keys(CS).map(function (k) { return { v: k, t: CS[k].t }; }),
                 doi: function (v) { tt.chinhSach = v; veHet(); } }),
        V.truot({ ten: "Độ trễ nhân bản (ms)", min: 5, max: 350, buoc: 5, giaTri: tt.tre,
                  doi: function (v) { tt.tre = v; veHet(); } }),
        V.truot({ ten: "Đọc lại sau bao lâu (ms)", min: 0, max: 380, buoc: 5, giaTri: tt.doc,
                  doi: function (v) { tt.doc = v; veHet(); } })
      ];

      V.khung(host, {
        ve: [cv, cv2], dieuKhien: dk,
        giaiThich:
          "<b>Nhân bản bất đồng bộ mua cho bạn khả năng mở rộng đọc — và bán đi tính mới " +
          "của dữ liệu.</b> Vấn đề không phải \"dữ liệu sai\", mà là " +
          "<b>người dùng không thấy thứ mình vừa làm</b>, và đó là loại lỗi họ báo ngay.<ul>" +
          "<li><b>Kéo \"đọc lại sau\" xuống dưới độ trễ nhân bản</b> với chính sách " +
          "\"replica bất kỳ\": đọc rơi vào vùng đỏ ⇒ <b>thấy dữ liệu cũ</b>. " +
          "Đây chính xác là kịch bản \"sửa avatar xong tải lại trang thấy ảnh cũ\".</li>" +
          "<li>★ Chú ý: <b>không có lỗi nào được ném ra</b>. Hệ thống hoạt động đúng như " +
          "thiết kế. Nó chỉ không đúng như <b>kỳ vọng của người dùng</b>.</li></ul>" +
          "<b>★ Ba mức bảo đảm, xếp theo giá phải trả:</b><ul>" +
          "<li><b>Nhất quán cuối cùng</b> — rẻ nhất, và <b>đủ tốt cho phần lớn đường đọc</b> " +
          "(bảng tin, danh sách sản phẩm, thống kê).</li>" +
          "<li><b>Read-your-writes</b> — ★ <b>điểm ngọt trong thực tế</b>. Người dùng chỉ " +
          "quan tâm tới <b>ghi của chính họ</b>; ghi của người khác cũ vài trăm ms thì " +
          "không ai nhận ra. Cách làm: gắn phiên vào primary trong N giây sau khi ghi, " +
          "hoặc mang theo <b>token phiên bản</b> và chờ replica bắt kịp.</li>" +
          "<li><b>Nhất quán mạnh</b> — đắt nhất, và <b>đừng bật mặc định cho cả hệ thống</b>. " +
          "Chọn theo <b>từng đường đọc</b>: số dư tài khoản thì mạnh, còn \"ai đã xem hồ sơ bạn\" " +
          "thì không cần.</li></ul>" +
          "<b>⚠️ Chế độ hỏng nguy hiểm nhất của nhân bản: độ trễ KHÔNG ổn định.</b> " +
          "Bình thường 20 ms, nhưng khi replica bận ghi hoặc mạng nghẽn thì vọt lên " +
          "hàng chục giây. Nếu logic read-your-writes của bạn dùng cửa sổ cố định " +
          "(\"5 giây sau khi ghi thì đọc primary\"), nó sẽ <b>âm thầm hỏng</b> đúng lúc " +
          "hệ thống đang căng. ⇒ <b>Giám sát replication lag như một SLI, và đặt cảnh báo " +
          "trên p99 của nó, không phải trung bình.</b>"
      });
      veHet();
    }
  });

  /* ================================================================
     Sharding va hotspot
     ================================================================ */
  demo({
    id: "sharding-hotspot", nhom: "Dữ liệu & nhất quán", mon: "B20",
    ten: "Sharding — và cách tạo ra một hot partition",
    moTa: "Ba chiến lược phân mảnh trên cùng một tải lệch. Xem shard nào " +
          "<b>gánh 60 % traffic</b> trong khi phần còn lại ngồi chơi.",
    lienKet: '<a href="../web/index.html#/bai/bai-20-partitioning-sharding">B20 — Partitioning & sharding</a>',
    dung: function (host) {
      var W = 560, H = 300, W2 = 560, H2 = 230;
      var cv = V.veBang(W, H), g = cv.g;
      var cv2 = V.veBang(W2, H2), g2 = cv2.g;

      var tt = { n: 8, cl: "theoKhoa", lech: 1.6, hat: 5 };

      /* sinh 600 request voi phan bo Zipf theo khoa (mot vai khoa rat nong) */
      function sinh() {
        var r = V.rng(tt.hat), ds = [], i;
        var K = 200;
        for (i = 0; i < 900; i++) {
          /* Zipf tho: hang = floor(K * u^lech) */
          var u = r();
          var k = Math.floor(K * Math.pow(u, tt.lech));
          ds.push({ khoa: k, t: r() });
        }
        return ds;
      }

      function bam(k) {                       /* bam don gian */
        var h = (k * 2654435761) % 4294967296;
        return h >>> 0;
      }

      function phanBo() {
        var ds = sinh(), dem = new Array(tt.n).fill(0), i;
        ds.forEach(function (d) {
          var s;
          if (tt.cl === "theoKhoa") s = d.khoa % tt.n;              /* theo khoa truc tiep */
          else if (tt.cl === "bam") s = bam(d.khoa) % tt.n;          /* bam khoa */
          else s = Math.floor(d.t * tt.n);                           /* theo khoang (range) */
          dem[Math.min(tt.n - 1, Math.max(0, s))]++;
        });
        return { dem: dem, tong: ds.length };
      }

      function ve() {
        g.clearRect(0, 0, W, H);
        var pb = phanBo();
        var padL = 44, padT = 38, padB = 46;
        var w = W - padL - 18, h = H - padT - padB;
        var maxD = Math.max.apply(null, pb.dem);
        var tb = pb.tong / tt.n;

        g.fillStyle = V.mau("tx"); g.font = "600 12.5px system-ui"; g.textAlign = "left";
        g.fillText("Tải trên " + tt.n + " shard  ·  " + pb.tong + " request", 14, 20);

        var bw = w / tt.n;
        pb.dem.forEach(function (d, i) {
          var x = padL + i * bw;
          var hh = d / maxD * h;
          var nong = d > tb * 1.6;
          g.fillStyle = nong ? "#b91c1c" : V.mau("ac");
          g.fillRect(x + 3, padT + h - hh, bw - 6, hh);
          g.fillStyle = V.mau("tx2"); g.font = "10px system-ui"; g.textAlign = "center";
          g.fillText("s" + i, x + bw / 2, padT + h + 14);
          g.fillStyle = nong ? "#b91c1c" : V.mau("tx3"); g.font = "600 10px system-ui";
          g.fillText(String(d), x + bw / 2, padT + h - hh - 5);
        });

        /* duong trung binh */
        g.strokeStyle = "#0f766e"; g.lineWidth = 1.8; g.setLineDash([5, 3]);
        var yTB = padT + h - tb / maxD * h;
        g.beginPath(); g.moveTo(padL, yTB); g.lineTo(padL + w, yTB); g.stroke();
        g.setLineDash([]);
        g.fillStyle = "#0f766e"; g.font = "700 10px system-ui"; g.textAlign = "left";
        g.fillText("trung bình lý tưởng " + tb.toFixed(0), padL + 4, yTB - 5);

        g.fillStyle = V.mau("tx3"); g.font = "10px system-ui"; g.textAlign = "center";
        g.fillText("shard", padL + w / 2, padT + h + 32);
      }

      function ve2() {
        g2.clearRect(0, 0, W2, H2);
        var pb = phanBo();
        var maxD = Math.max.apply(null, pb.dem);
        var tb = pb.tong / tt.n;
        var heSo = maxD / tb;
        var tyLeNong = maxD / pb.tong;

        g2.fillStyle = V.mau("tx"); g2.font = "600 12.5px system-ui"; g2.textAlign = "left";
        g2.fillText("Cân bằng tải giữa các shard:", 14, 20);

        var dong = [
          ["Shard nóng nhất nhận", maxD + " request (" + (tyLeNong * 100).toFixed(0) + " %)"],
          ["Trung bình lý tưởng", tb.toFixed(0) + " request"],
          ["★ Hệ số mất cân bằng", heSo.toFixed(2) + "×"],
          ["Shard nguội nhất", Math.min.apply(null, pb.dem) + " request"]
        ];
        g2.font = "11.5px system-ui";
        dong.forEach(function (d, i) {
          var y = 44 + i * 21;
          g2.fillStyle = V.mau("tx2"); g2.fillText(d[0], 18, y);
          g2.fillStyle = i === 2 ? (heSo > 1.5 ? V.mau("loi") : "#0f766e") : V.mau("tx");
          g2.font = "700 12px ui-monospace, monospace";
          g2.fillText(d[1], 280, y);
          g2.font = "11.5px system-ui";
        });

        var y0 = 142;
        g2.fillStyle = heSo > 1.5 ? V.mau("loi") : "#0f766e";
        g2.font = "700 12px system-ui";
        g2.fillText(heSo > 1.5
          ? "⚠ HOT PARTITION — bạn phải định cỡ TOÀN BỘ cụm theo shard nóng nhất."
          : "✓ Phân bố đều — mỗi shard gánh xấp xỉ như nhau.", 14, y0);
        g2.fillStyle = V.mau("tx2"); g2.font = "11px system-ui";
        g2.fillText("Nghĩa là bạn trả tiền cho " + tt.n + " shard nhưng chỉ dùng được " +
                    (100 / heSo).toFixed(0) + " % công suất của chúng.", 14, y0 + 20);
        g2.fillStyle = V.mau("ac"); g2.font = "700 11.5px system-ui";
        g2.fillText("⇒ Thêm shard KHÔNG chữa được hot partition. Chỉ đổi khoá phân mảnh mới chữa được.",
                    14, y0 + 44);
      }

      function veHet() { ve(); ve2(); }

      var dk = [
        V.chon({ ten: "Chiến lược phân mảnh", giaTri: tt.cl,
                 muc: [{ v: "theoKhoa", t: "Theo khoá trực tiếp (key % N)" },
                       { v: "bam", t: "Theo băm khoá (hash(key) % N)" },
                       { v: "khoang", t: "Theo khoảng (range)" }],
                 doi: function (v) { tt.cl = v; veHet(); } }),
        V.truot({ ten: "Độ lệch của tải (Zipf)", min: 1, max: 4, buoc: 0.1, giaTri: tt.lech,
                  doi: function (v) { tt.lech = v; veHet(); } }),
        V.truot({ ten: "Số shard", min: 2, max: 16, buoc: 1, giaTri: tt.n,
                  doi: function (v) { tt.n = v; veHet(); } }),
        V.truot({ ten: "Hạt giống", min: 1, max: 40, buoc: 1, giaTri: tt.hat,
                  doi: function (v) { tt.hat = v; veHet(); } })
      ];

      V.khung(host, {
        ve: [cv, cv2], dieuKhien: dk,
        giaiThich:
          "<b>Sharding chỉ giúp được khi tải chia ĐỀU.</b> Và tải thật gần như không bao giờ " +
          "chia đều — nó theo phân phối <b>Zipf</b>: một số ít khoá chiếm phần lớn traffic " +
          "(người nổi tiếng, sản phẩm hot, tenant lớn).<ul>" +
          "<li><b>Kéo \"độ lệch\" lên 3–4</b>: tải dồn vào một nhúm khoá. " +
          "Với phân mảnh <b>theo khoá trực tiếp</b>, những khoá nóng đó rơi vào " +
          "vài shard cố định ⇒ <b>hot partition</b> màu đỏ.</li>" +
          "<li>★ <b>Đổi sang \"theo băm khoá\"</b>: các khoá nóng được <b>rải ra</b> khắp cụm, " +
          "hệ số mất cân bằng tụt xuống gần 1. Đây là lý do <b>hash sharding là mặc định</b>.</li>" +
          "<li>⚠️ Nhưng băm <b>không</b> chữa được khi <b>MỘT khoá đơn lẻ</b> quá nóng " +
          "— vì mọi request của khoá đó vẫn về đúng một shard. " +
          "Lúc đó phải <b>tách khoá</b> (thêm hậu tố ngẫu nhiên), hoặc <b>cache riêng</b> " +
          "cho khoá đó, hoặc tách nó ra hạ tầng riêng.</li></ul>" +
          "<b>★ Ba chiến lược, ba đánh đổi:</b><ul>" +
          "<li><b>Theo khoảng (range):</b> truy vấn theo dải rất nhanh " +
          "(<code>WHERE ngày BETWEEN …</code> chỉ chạm 1–2 shard), nhưng " +
          "<b>dữ liệu mới luôn dồn vào shard cuối</b> — hot partition kinh điển của " +
          "khoá theo thời gian.</li>" +
          "<li><b>Theo băm:</b> phân bố đều, nhưng <b>mất hoàn toàn khả năng truy vấn theo dải</b> " +
          "— mọi truy vấn dải thành fan-out tới tất cả shard (và xem demo tail latency " +
          "để biết hậu quả).</li>" +
          "<li><b>Theo khoá trực tiếp:</b> đơn giản, dễ suy luận, và <b>lệch nhất</b>.</li></ul>" +
          "<b>⇒ Bài học tốn kém nhất của bài 20: THÊM SHARD KHÔNG CHỮA ĐƯỢC HOT PARTITION.</b> " +
          "Kéo \"số shard\" từ 4 lên 16 với độ lệch cao mà xem — hệ số mất cân bằng gần như " +
          "không đổi. Bạn trả tiền gấp 4 lần cho cùng một nút thắt. " +
          "Chỉ <b>đổi khoá phân mảnh</b> mới chữa được, và đổi khoá phân mảnh trên hệ thống " +
          "đang chạy là một trong những việc khó nhất trong nghề."
      });
      veHet();
    }
  });

  /* ================================================================
     CAP / PACELC
     ================================================================ */
  demo({
    id: "cap-pacelc", nhom: "Phân tán", mon: "B27",
    ten: "CAP và PACELC — chọn gì khi mạng chia cắt",
    moTa: "Khi <b>đã</b> có chia cắt, bạn chỉ còn hai lựa chọn. " +
          "Và PACELC hỏi tiếp: lúc <b>bình thường</b> thì sao?",
    lienKet: '<a href="../web/index.html#/bai/bai-27-cap-pacelc">B27 — CAP & PACELC</a>',
    dung: function (host) {
      var W = 560, H = 310, W2 = 560, H2 = 220;
      var cv = V.veBang(W, H), g = cv.g;
      var cv2 = V.veBang(W2, H2), g2 = cv2.g;

      var tt = { chia: true, chon: "A", elc: "L" };

      function ve() {
        g.clearRect(0, 0, W, H);
        g.fillStyle = V.mau("tx"); g.font = "600 12.5px system-ui"; g.textAlign = "left";
        g.fillText(tt.chia ? "MẠNG ĐANG CHIA CẮT (P)" : "Mạng bình thường", 14, 20);

        var cx = W / 2, oy = 46;
        /* hai ben */
        var BEN = [
          { x: 120, y: oy + 70, t: "Vùng A", nut: ["N1", "N2"] },
          { x: 440, y: oy + 70, t: "Vùng B", nut: ["N3"] }
        ];
        BEN.forEach(function (b) {
          g.fillStyle = V.mau("surf2");
          g.beginPath(); g.arc(b.x, b.y, 62, 0, 6.2832); g.fill();
          g.strokeStyle = V.mau("bd"); g.lineWidth = 1.5; g.stroke();
          g.fillStyle = V.mau("tx2"); g.font = "600 11px system-ui"; g.textAlign = "center";
          g.fillText(b.t, b.x, b.y - 74);
          b.nut.forEach(function (n, i) {
            var a = -Math.PI / 2 + i * 1.5;
            var x = b.x + Math.cos(a) * 28, y = b.y + Math.sin(a) * 28;
            g.fillStyle = V.mau("ac");
            g.beginPath(); g.arc(x, y, 17, 0, 6.2832); g.fill();
            g.fillStyle = "#fff"; g.font = "700 11px system-ui";
            g.fillText(n, x, y + 4);
          });
        });

        /* duong noi */
        if (tt.chia) {
          g.strokeStyle = "#b91c1c"; g.lineWidth = 3;
          g.beginPath(); g.moveTo(190, oy + 70); g.lineTo(252, oy + 70); g.stroke();
          g.beginPath(); g.moveTo(308, oy + 70); g.lineTo(372, oy + 70); g.stroke();
          /* dau X */
          g.lineWidth = 4;
          g.beginPath();
          g.moveTo(cx - 16, oy + 54); g.lineTo(cx + 16, oy + 86);
          g.moveTo(cx + 16, oy + 54); g.lineTo(cx - 16, oy + 86);
          g.stroke();
          g.fillStyle = "#b91c1c"; g.font = "700 11px system-ui"; g.textAlign = "center";
          g.fillText("mạng đứt", cx, oy + 106);
        } else {
          g.strokeStyle = "#0f766e"; g.lineWidth = 3;
          g.beginPath(); g.moveTo(190, oy + 70); g.lineTo(372, oy + 70); g.stroke();
        }

        /* ket cuc */
        var y0 = oy + 150;
        var kq;
        if (tt.chia) {
          kq = tt.chon === "C"
            ? { t: "Chọn C — Nhất quán", a: "Vùng B TỪ CHỐI phục vụ (lỗi / timeout).",
                b: "Không ai đọc được dữ liệu cũ. Nhưng một phần người dùng MẤT DỊCH VỤ.",
                m: "#b45309" }
            : { t: "Chọn A — Khả dụng", a: "Cả hai vùng VẪN phục vụ.",
                b: "Hai vùng có thể ghi khác nhau ⇒ PHẢI hoà giải xung đột khi mạng nối lại.",
                m: "#0f766e" };
        } else {
          kq = tt.elc === "L"
            ? { t: "PACELC — Else chọn L (Latency)", a: "Trả lời từ bản sao gần nhất.",
                b: "Nhanh, nhưng có thể trả dữ liệu hơi cũ.", m: "#0f766e" }
            : { t: "PACELC — Else chọn C (Consistency)", a: "Chờ đồng thuận trước khi trả lời.",
                b: "Luôn mới nhất, nhưng mỗi lần đọc cõng thêm độ trễ mạng giữa các vùng.",
                m: "#b45309" };
        }
        g.textAlign = "left";
        g.fillStyle = kq.m; g.font = "700 13px system-ui";
        g.fillText(kq.t, 14, y0);
        g.fillStyle = V.mau("tx"); g.font = "11.5px system-ui";
        g.fillText(kq.a, 14, y0 + 20);
        g.fillStyle = V.mau("tx2");
        g.fillText(kq.b, 14, y0 + 38);
      }

      function ve2() {
        g2.clearRect(0, 0, W2, H2);
        g2.fillStyle = V.mau("tx"); g2.font = "600 12.5px system-ui"; g2.textAlign = "left";
        g2.fillText("PACELC: if (P) then A or C, else L or C", 14, 20);

        var HT = [
          ["Cassandra / DynamoDB", "PA", "EL", "khả dụng + độ trễ thấp"],
          ["MongoDB (mặc định)", "PA", "EC", "khả dụng khi chia cắt, nhất quán khi thường"],
          ["HBase / BigTable", "PC", "EC", "luôn ưu tiên nhất quán"],
          ["Spanner", "PC", "EC", "nhất quán mạnh, trả giá bằng độ trễ (TrueTime)"]
        ];
        g2.fillStyle = V.mau("tx3"); g2.font = "600 10.5px system-ui";
        ["Hệ thống", "khi P", "khi thường", "nghĩa là"].forEach(function (t, i) {
          g2.fillText(t, [14, 190, 250, 330][i], 42);
        });
        HT.forEach(function (h, i) {
          var y = 62 + i * 22;
          g2.fillStyle = V.mau("tx"); g2.font = "600 11px system-ui";
          g2.fillText(h[0], 14, y);
          g2.fillStyle = h[1] === "PA" ? "#0f766e" : "#b45309";
          g2.font = "700 11px ui-monospace, monospace";
          g2.fillText(h[1], 190, y);
          g2.fillStyle = h[2] === "EL" ? "#0f766e" : "#b45309";
          g2.fillText(h[2], 250, y);
          g2.fillStyle = V.mau("tx3"); g2.font = "10.5px system-ui";
          g2.fillText(h[3], 330, y);
        });

        var y0 = 168;
        g2.fillStyle = V.mau("loi"); g2.font = "700 11.5px system-ui";
        g2.fillText("⚠ CAP KHÔNG phải \"chọn 2 trong 3\". P không phải lựa chọn — mạng sẽ đứt.",
                    14, y0);
        g2.fillStyle = V.mau("ac"); g2.font = "700 11.5px system-ui";
        g2.fillText("⇒ Câu hỏi thật chỉ là: KHI đứt, bạn hy sinh C hay A?", 14, y0 + 20);
        g2.fillStyle = V.mau("tx2"); g2.font = "11px system-ui";
        g2.fillText("Và PACELC bổ sung phần quan trọng hơn: 99,9 % thời gian mạng KHÔNG đứt.",
                    14, y0 + 38);
      }

      function veHet() { ve(); ve2(); }

      var dk = [
        V.danhDau({ ten: "Mạng đang chia cắt (P)", giaTri: tt.chia,
                    doi: function (v) { tt.chia = v; veHet(); } }),
        V.chon({ ten: "Khi CÓ chia cắt, hy sinh gì?", giaTri: tt.chon,
                 muc: [{ v: "A", t: "Giữ Khả dụng (A) — hy sinh nhất quán" },
                       { v: "C", t: "Giữ Nhất quán (C) — hy sinh khả dụng" }],
                 doi: function (v) { tt.chon = v; veHet(); } }),
        V.chon({ ten: "Khi BÌNH THƯỜNG (Else)", giaTri: tt.elc,
                 muc: [{ v: "L", t: "Ưu tiên độ trễ thấp (L)" },
                       { v: "C", t: "Ưu tiên nhất quán (C)" }],
                 doi: function (v) { tt.elc = v; veHet(); } })
      ];

      V.khung(host, {
        ve: [cv, cv2], dieuKhien: dk,
        giaiThich:
          "<b>Cách CAP thường bị dạy sai:</b> \"chọn 2 trong 3 — C, A, P\". " +
          "Điều đó <b>vô nghĩa</b>, vì <b>P không phải một lựa chọn</b>: mạng <b>sẽ</b> đứt, " +
          "dù bạn có muốn hay không.<ul>" +
          "<li>★ Phát biểu đúng: <b>KHI mạng chia cắt, bạn phải chọn giữa C và A.</b> " +
          "Bật/tắt ô \"mạng đang chia cắt\" và đổi lựa chọn để thấy hai kết cục.</li>" +
          "<li><b>Chọn C</b>: vùng thiểu số <b>từ chối phục vụ</b>. Không ai đọc được dữ liệu " +
          "cũ — nhưng một phần người dùng <b>mất dịch vụ hoàn toàn</b>.</li>" +
          "<li><b>Chọn A</b>: cả hai vùng vẫn chạy. Không ai mất dịch vụ — nhưng hai bên " +
          "có thể ghi <b>mâu thuẫn nhau</b>, và bạn <b>phải có chiến lược hoà giải</b> " +
          "khi mạng nối lại (last-write-wins, CRDT, hoặc để ứng dụng quyết định). " +
          "⚠️ Chọn A mà không có kế hoạch hoà giải là <b>mất dữ liệu có kế hoạch</b>.</li></ul>" +
          "<b>★ Và đây là lý do PACELC quan trọng hơn CAP trong thực tế:</b> " +
          "<code>if (P) then A or C, else L or C</code>.<ul>" +
          "<li>Chia cắt mạng là <b>hiếm</b> — có thể vài lần một năm. Nhưng " +
          "<b>99,9 % thời gian còn lại</b>, bạn vẫn phải chọn giữa " +
          "<b>độ trễ (L)</b> và <b>nhất quán (C)</b>, và lựa chọn đó ảnh hưởng tới " +
          "<b>mọi request</b>.</li>" +
          "<li>Tắt ô chia cắt rồi đổi lựa chọn \"Else\": chọn <b>C</b> nghĩa là mỗi lần đọc " +
          "phải <b>chờ đồng thuận giữa các vùng</b> — cõng thêm độ trễ mạng liên vùng " +
          "(xuyên lục địa là ~150 ms). Chọn <b>L</b> thì trả lời từ bản sao gần nhất, " +
          "nhanh nhưng có thể hơi cũ.</li>" +
          "<li>★ <b>Spanner là ví dụ đắt giá nhất:</b> nó chọn <b>PC/EC</b> — nhất quán mạnh " +
          "cả khi bình thường — và trả giá bằng <b>TrueTime</b>: đồng hồ nguyên tử + GPS " +
          "trong mọi trung tâm dữ liệu, cộng thêm việc <b>cố tình chờ</b> qua khoảng " +
          "bất định của đồng hồ trước khi commit.</li></ul>" +
          "<b>⇒ Câu hỏi để hỏi trong mọi buổi thiết kế: \"đường dữ liệu NÀY cần gì — và " +
          "chúng ta đã đo cái giá của lựa chọn đó chưa?\" Câu trả lời thường khác nhau " +
          "giữa các đường trong CÙNG một hệ thống.</b>"
      });
      veHet();
    }
  });

  /* ================================================================
     SLO va error budget
     ================================================================ */
  demo({
    id: "slo-error-budget", nhom: "Vận hành", mon: "B41",
    ten: "SLO và ngân sách lỗi — toán của những chữ số 9",
    moTa: "99,9 % nghe như hoàn hảo. Nó là <b>43 phút chết mỗi tháng</b>. " +
          "Xem ngân sách cháy nhanh thế nào.",
    lienKet: '<a href="../web/index.html#/bai/bai-41-sli-slo-error-budget">B41 — SLI, SLO, error budget</a>',
    dung: function (host) {
      var W = 560, H = 280, W2 = 560, H2 = 240;
      var cv = V.veBang(W, H), g = cv.g;
      var cv2 = V.veBang(W2, H2), g2 = cv2.g;

      var tt = { slo: 99.9, suCo: 20, soLan: 2 };

      /* Thang TRUNG BINH 30,44 ngay — de khop voi bang cac muc 9 ben duoi
         (99,9 % -> 43 phut 48 giay, khong phai 43 phut 12 giay cua thang 30 ngay). */
      var PHUT_THANG = 43829;

      function nganSach() { return PHUT_THANG * (1 - tt.slo / 100); }

      function ve() {
        g.clearRect(0, 0, W, H);
        var ns = nganSach();
        var daDung = tt.suCo * tt.soLan;
        var tyLe = Math.min(1.35, daDung / ns);

        g.fillStyle = V.mau("tx"); g.font = "600 12.5px system-ui"; g.textAlign = "left";
        g.fillText("Ngân sách lỗi tháng này — SLO " + tt.slo.toFixed(tt.slo >= 99.99 ? 3 : 1) + " %",
                   14, 20);

        /* thanh ngan sach */
        var x0 = 14, bw = W - 28, y0 = 44, hh = 40;
        g.fillStyle = V.mau("surf2"); g.fillRect(x0, y0, bw, hh);
        g.fillStyle = tyLe > 1 ? "#b91c1c" : (tyLe > 0.75 ? "#b45309" : "#0f766e");
        g.fillRect(x0, y0, Math.min(bw, bw * tyLe), hh);
        /* vach 100 % */
        g.strokeStyle = V.mau("tx"); g.lineWidth = 2;
        g.beginPath(); g.moveTo(x0 + bw / 1.35, y0 - 4); g.lineTo(x0 + bw / 1.35, y0 + hh + 4); g.stroke();
        g.fillStyle = V.mau("tx"); g.font = "700 10px system-ui"; g.textAlign = "center";
        g.fillText("100 % ngân sách", x0 + bw / 1.35, y0 - 8);

        g.textAlign = "left";
        g.fillStyle = "#fff"; g.font = "700 13px system-ui";
        g.fillText(daDung.toFixed(0) + " / " + ns.toFixed(0) + " phút  (" +
                   (daDung / ns * 100).toFixed(0) + " %)", x0 + 10, y0 + 25);

        /* bang cac muc 9 */
        var MUC = [
          [99, "3 ngày 15 giờ", "7 giờ 18 phút"],
          [99.9, "8 giờ 45 phút", "43 phút 50 giây"],
          [99.95, "4 giờ 23 phút", "21 phút 55 giây"],
          [99.99, "52 phút 36 giây", "4 phút 23 giây"],
          [99.999, "5 phút 15 giây", "26 giây"]
        ];
        var yy = 112;
        g.fillStyle = V.mau("tx3"); g.font = "600 10.5px system-ui";
        g.fillText("SLO", 20, yy); g.fillText("chết / năm", 130, yy);
        g.fillText("chết / tháng", 300, yy);
        MUC.forEach(function (m, i) {
          var y = yy + 22 + i * 21;
          var dang = Math.abs(m[0] - tt.slo) < 0.001;
          if (dang) { g.fillStyle = V.mau("acbg"); g.fillRect(14, y - 13, W - 28, 19); }
          g.fillStyle = dang ? V.mau("ac") : V.mau("tx2");
          g.font = (dang ? "700 " : "") + "11.5px ui-monospace, monospace";
          g.fillText(m[0].toFixed(m[0] >= 99.99 ? 3 : (m[0] >= 99.9 ? 2 : 0)) + " %", 20, y);
          g.fillStyle = dang ? V.mau("tx") : V.mau("tx3");
          g.font = "11px system-ui";
          g.fillText(m[1], 130, y);
          g.fillStyle = dang ? V.mau("ac") : V.mau("tx3");
          g.font = (dang ? "700 " : "") + "11px system-ui";
          g.fillText(m[2], 300, y);
        });
      }

      function ve2() {
        g2.clearRect(0, 0, W2, H2);
        var ns = nganSach();
        var daDung = tt.suCo * tt.soLan;
        var con = ns - daDung;

        g2.fillStyle = V.mau("tx"); g2.font = "600 12.5px system-ui"; g2.textAlign = "left";
        g2.fillText("Chính sách theo ngân sách lỗi:", 14, 20);

        var dong = [
          ["Ngân sách tháng", ns.toFixed(0) + " phút"],
          ["Đã tiêu (" + tt.soLan + " sự cố × " + tt.suCo + " phút)", daDung.toFixed(0) + " phút"],
          ["★ Còn lại", con.toFixed(0) + " phút"],
          ["Số sự cố " + tt.suCo + " phút còn chịu được",
           Math.max(0, Math.floor(con / tt.suCo)) + " lần"]
        ];
        g2.font = "11.5px system-ui";
        dong.forEach(function (d, i) {
          var y = 44 + i * 21;
          g2.fillStyle = V.mau("tx2"); g2.fillText(d[0], 18, y);
          g2.fillStyle = (i >= 2 && con < 0) ? V.mau("loi") : V.mau("tx");
          g2.font = "700 12px ui-monospace, monospace";
          g2.fillText(d[1], 320, y);
          g2.font = "11.5px system-ui";
        });

        var y0 = 146;
        if (con < 0) {
          g2.fillStyle = V.mau("loi"); g2.font = "700 12.5px system-ui";
          g2.fillText("⚠ ĐÃ CHÁY NGÂN SÁCH — đóng băng phát hành tính năng.", 14, y0);
          g2.fillStyle = V.mau("tx2"); g2.font = "11px system-ui";
          g2.fillText("Toàn bộ năng lực chuyển sang việc độ tin cậy cho tới khi ngân sách hồi.",
                      14, y0 + 20);
        } else if (con < ns * 0.25) {
          g2.fillStyle = "#b45309"; g2.font = "700 12.5px system-ui";
          g2.fillText("⚠ Còn dưới 25 % — siết lại: chỉ phát hành có canary, giảm nhịp.", 14, y0);
        } else {
          g2.fillStyle = "#0f766e"; g2.font = "700 12.5px system-ui";
          g2.fillText("✓ Ngân sách dồi dào — được phép phát hành nhanh, chấp nhận rủi ro.", 14, y0);
          g2.fillStyle = V.mau("tx2"); g2.font = "11px system-ui";
          g2.fillText("★ Ngân sách KHÔNG tiêu hết cũng là lãng phí: bạn đang quá thận trọng.",
                      14, y0 + 20);
        }

        g2.fillStyle = V.mau("ac"); g2.font = "700 11.5px system-ui";
        g2.fillText("⇒ Error budget biến \"độ tin cậy\" từ tranh cãi thành một CON SỐ", 14, H2 - 26);
        g2.fillStyle = V.mau("tx2"); g2.font = "11px system-ui";
        g2.fillText("mà cả product lẫn engineering đều phải tuân theo.", 14, H2 - 10);
      }

      function veHet() { ve(); ve2(); }

      var dk = [
        V.chon({ ten: "SLO khả dụng", giaTri: String(tt.slo),
                 muc: [{ v: "99", t: "99 % (hai số 9)" },
                       { v: "99.9", t: "99,9 % (ba số 9)" },
                       { v: "99.95", t: "99,95 %" },
                       { v: "99.99", t: "99,99 % (bốn số 9)" },
                       { v: "99.999", t: "99,999 % (năm số 9)" }],
                 doi: function (v) { tt.slo = parseFloat(v); veHet(); } }),
        V.truot({ ten: "Độ dài mỗi sự cố (phút)", min: 1, max: 120, buoc: 1, giaTri: tt.suCo,
                  doi: function (v) { tt.suCo = v; veHet(); } }),
        V.truot({ ten: "Số sự cố trong tháng", min: 0, max: 10, buoc: 1, giaTri: tt.soLan,
                  doi: function (v) { tt.soLan = v; veHet(); } })
      ];

      V.khung(host, {
        ve: [cv, cv2], dieuKhien: dk,
        giaiThich:
          "<b>\"Chúng ta muốn hệ thống đáng tin cậy\" là một câu vô nghĩa</b> cho tới khi nó " +
          "thành một con số. Bảng dưới là toàn bộ nội dung của \"toán những chữ số 9\".<ul>" +
          "<li><b>99,9 %</b> nghe như gần hoàn hảo. Nó là <b>43 phút chết mỗi tháng</b> — " +
          "tức là <b>một</b> lần triển khai hỏng cần 45 phút để quay lui đã " +
          "<b>tiêu sạch cả tháng</b>.</li>" +
          "<li><b>99,99 %</b> là <b>4 phút 23 giây một tháng</b>. Ở mức đó, " +
          "<b>con người không kịp phản ứng</b> — mọi thứ phải tự động: tự phát hiện, " +
          "tự quay lui, tự chuyển vùng.</li>" +
          "<li><b>99,999 %</b> là <b>26 giây một tháng</b>. Thực tế điều này nghĩa là " +
          "bạn <b>không được có bất kỳ sự cố nào</b> — và chi phí thường tăng " +
          "theo cấp số nhân cho mỗi số 9 thêm vào.</li></ul>" +
          "<b>★ Ngân sách lỗi biến độ tin cậy thành một cuộc trao đổi có thể thương lượng:</b><ul>" +
          "<li><b>Còn nhiều ngân sách</b> ⇒ <b>được phép phát hành nhanh</b>, thử nghiệm, " +
          "chấp nhận rủi ro. ★ Và điều quan trọng: <b>ngân sách không tiêu hết cũng là " +
          "một dạng lãng phí</b> — nó nghĩa là bạn đã quá thận trọng và đang đi chậm " +
          "hơn mức cần thiết.</li>" +
          "<li><b>Cháy ngân sách</b> ⇒ <b>đóng băng tính năng</b>, toàn đội chuyển sang " +
          "việc độ tin cậy cho tới khi ngân sách hồi. " +
          "★ Đây là điểm mấu chốt: quy tắc được <b>thoả thuận trước</b>, nên khi sự cố xảy ra " +
          "thì <b>không còn gì để tranh cãi</b>.</li></ul>" +
          "<b>⚠️ Ba sai lầm phổ biến:</b><ul>" +
          "<li><b>Đặt SLO bằng 100 %</b>: không đạt được, và nó xoá bỏ mọi ý nghĩa của " +
          "ngân sách lỗi.</li>" +
          "<li><b>Đặt SLO cao hơn nhu cầu thật của người dùng</b>: bạn trả giá bằng tốc độ " +
          "phát triển để mua thứ không ai nhận ra.</li>" +
          "<li><b>Đo SLI sai chỗ</b>: đo ở server thì thấy 99,99 %, nhưng người dùng " +
          "trải nghiệm qua CDN, mạng di động và app — ★ <b>SLI phải đo ở nơi gần " +
          "người dùng nhất có thể</b>.</li></ul>"
      });
      veHet();
    }
  });

})();
