/* =====================================================================
   Nhom 3 — Cai thien nghiem
   leo-doi (b.9) · toan-tu-2opt (b.11) · delta-evaluation (b.10)
   ===================================================================== */
(function () {
  var V = window.VIS;

  function sinhDiem(n, hat) {
    var r = V.rng(hat), ds = [], i;
    for (i = 0; i < n; i++) ds.push({ x: r.khoang(0.05, 0.95), y: r.khoang(0.05, 0.95) });
    return ds;
  }
  function dE(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }
  function daiChuTrinh(q, ds) {
    var s = 0, n = q.length, i;
    for (i = 0; i < n; i++) s += dE(ds[q[i]], ds[q[(i + 1) % n]]);
    return s;
  }
  function veTour(g, ds, q, ox, oy, S, mau, dam) {
    g.strokeStyle = mau; g.lineWidth = dam || 1.7; g.globalAlpha = 0.9;
    g.beginPath();
    q.forEach(function (i, k) {
      var p = ds[i], X = ox + p.x * S, Y = oy + p.y * S;
      if (!k) g.moveTo(X, Y); else g.lineTo(X, Y);
    });
    g.closePath(); g.stroke(); g.globalAlpha = 1;
    q.forEach(function (i) {
      var p = ds[i];
      g.fillStyle = mau;
      g.beginPath(); g.arc(ox + p.x * S, oy + p.y * S, 3.4, 0, 6.2832); g.fill();
    });
  }

  /* ================================================================
     8. Leo doi — first improvement vs best improvement
     ================================================================ */
  demo({
    id: "leo-doi", nhom: "Cải thiện nghiệm", mon: "B09",
    ten: "Leo đồi — nước đi đầu tiên hay nước đi tốt nhất?",
    moTa: "2-opt trên TSP, chạy thật từng bước. Hai biến thể leo đồi cho " +
          "<b>cùng chất lượng nhưng khác hẳn số lần đánh giá</b>.",
    lienKet: '<a href="../web/index.html#/khoa-hoc/bai-09-lan-can-leo-doi">B09 — Lân cận & leo đồi</a>',
    dung: function (host) {
      var W = 560, H = 330, W2 = 560, H2 = 200;
      var cv = V.veBang(W, H), g = cv.g;
      var cv2 = V.veBang(W2, H2), g2 = cv2.g;

      var tt = { n: 26, bien: "first", hat: 6 };
      var ds, q, dauTien, lichSu, demDanhGia, xong;

      function datLai() {
        ds = sinhDiem(tt.n, tt.hat);
        q = ds.map(function (_, i) { return i; });
        /* xao tron de co nghiem xuat phat te */
        var r = V.rng(tt.hat * 7 + 1), i, j, t;
        for (i = q.length - 1; i > 0; i--) {
          j = Math.floor(r() * (i + 1)); t = q[i]; q[i] = q[j]; q[j] = t;
        }
        dauTien = q.slice();
        lichSu = [daiChuTrinh(q, ds)];
        demDanhGia = 0; xong = false;
      }

      /* mot buoc leo doi: quet lan can 2-opt */
      function motBuoc() {
        var n = q.length, i, j, tot = null;
        for (i = 0; i < n - 1; i++) {
          for (j = i + 1; j < n; j++) {
            if (i === 0 && j === n - 1) continue;
            var a = q[(i - 1 + n) % n], b = q[i], c = q[j], d = q[(j + 1) % n];
            demDanhGia++;
            var delta = dE(ds[a], ds[c]) + dE(ds[b], ds[d])
                      - dE(ds[a], ds[b]) - dE(ds[c], ds[d]);
            if (delta < -1e-12) {
              if (tt.bien === "first") { ap(i, j); return true; }
              if (!tot || delta < tot.delta) tot = { i: i, j: j, delta: delta };
            }
          }
        }
        if (tot) { ap(tot.i, tot.j); return true; }
        return false;
      }
      function ap(i, j) {
        var seg = q.slice(i, j + 1).reverse();
        Array.prototype.splice.apply(q, [i, j - i + 1].concat(seg));
        lichSu.push(daiChuTrinh(q, ds));
      }

      function ve() {
        g.clearRect(0, 0, W, H);
        /* chua cho duong cong tien do o duoi: 16 + 64 + 12 = 92px */
        var S = Math.min(W / 2 - 24, H - 32 - 92);
        var oy = 32;
        /* trai: nghiem xuat phat */
        veTour(g, ds, dauTien, 14, oy, S, V.mau("tx3"), 1.2);
        g.fillStyle = V.mau("tx2"); g.font = "600 11.5px system-ui"; g.textAlign = "left";
        g.fillText("Xuất phát — dài " + daiChuTrinh(dauTien, ds).toFixed(3), 14, oy - 8);
        /* phai: hien tai */
        veTour(g, ds, q, W / 2 + 10, oy, S, V.mau("ac"), 1.9);
        g.fillStyle = V.mau("ac"); g.font = "600 11.5px system-ui";
        g.fillText((xong ? "Cực trị cục bộ" : "Đang leo") + " — dài " +
                   daiChuTrinh(q, ds).toFixed(3), W / 2 + 10, oy - 8);

        /* duong cong tien do */
        var hy = 64;
        var y0 = oy + S + 16;
        var lo = Math.min.apply(null, lichSu), hi = Math.max.apply(null, lichSu);
        if (hi - lo < 1e-9) hi = lo + 1;
        g.strokeStyle = V.mau("bd"); g.lineWidth = 1;
        g.strokeRect(14, y0, W - 28, hy);
        g.strokeStyle = V.mau("ac"); g.lineWidth = 1.8;
        g.beginPath();
        lichSu.forEach(function (v, k) {
          var X = 14 + (lichSu.length === 1 ? 0 : k / (lichSu.length - 1)) * (W - 28);
          var Y = y0 + hy - (v - lo) / (hi - lo) * (hy - 6) - 3;
          if (!k) g.moveTo(X, Y); else g.lineTo(X, Y);
        });
        g.stroke();
        g.fillStyle = V.mau("tx3"); g.font = "10px system-ui";
        g.fillText("độ dài tuyến theo số nước đi cải thiện (" + (lichSu.length - 1) + " nước)",
                   18, y0 + 12);
      }

      function ve2() {
        g2.clearRect(0, 0, W2, H2);
        var d0 = daiChuTrinh(dauTien, ds), d1 = daiChuTrinh(q, ds);
        g2.fillStyle = V.mau("tx"); g2.font = "600 12.5px system-ui"; g2.textAlign = "left";
        g2.fillText(tt.bien === "first" ? "Nước đi ĐẦU TIÊN cải thiện (first improvement)"
                                        : "Nước đi TỐT NHẤT trong lân cận (best improvement)", 14, 20);
        var dong = [
          ["Độ dài xuất phát", d0.toFixed(4)],
          ["Độ dài hiện tại", d1.toFixed(4)],
          ["Đã cải thiện", ((1 - d1 / d0) * 100).toFixed(2) + " %"],
          ["Số nước đi đã nhận", String(lichSu.length - 1)],
          ["★ Số lần ĐÁNH GIÁ delta", demDanhGia.toLocaleString("vi")],
          ["Trạng thái", xong ? "đã kẹt ở cực trị cục bộ" : "đang chạy"]
        ];
        g2.font = "11.5px system-ui";
        dong.forEach(function (d, i) {
          var y = 42 + i * 19;
          g2.fillStyle = V.mau("tx2"); g2.fillText(d[0], 18, y);
          g2.fillStyle = i === 4 ? V.mau("ac") : V.mau("tx");
          g2.font = (i === 4 ? "700 " : "600 ") + "11.5px ui-monospace, monospace";
          g2.fillText(d[1], 230, y);
          g2.font = "11.5px system-ui";
        });
        g2.fillStyle = V.mau("tx3"); g2.font = "11px system-ui";
        g2.fillText("Lân cận 2-opt có n(n−3)/2 = " +
                    Math.round(tt.n * (tt.n - 3) / 2) + " nước đi, quét lại mỗi vòng.",
                    14, H2 - 10);
      }

      function veHet() { ve(); ve2(); }

      var P = V.phat({
        toiDa: 4000, tocDo: 6,
        datLai: datLai,
        buoc: function () { var ok = motBuoc(); if (!ok) xong = true; return ok; },
        ve: veHet,
        nhan: function () {
          return xong ? "đã kẹt ở cực trị cục bộ"
                      : ("dài " + lichSu[lichSu.length - 1].toFixed(3));
        }
      });
      function batDau() { P.datLai(); }

      var dk = [
        P.dk(),
        V.chon({ ten: "Biến thể leo đồi", giaTri: tt.bien,
                 muc: [{ v: "first", t: "Nước đi đầu tiên cải thiện" },
                       { v: "best", t: "Nước đi tốt nhất trong lân cận" }],
                 doi: function (v) { tt.bien = v; batDau(); } }),
        V.truot({ ten: "Số điểm", min: 8, max: 60, buoc: 1, giaTri: tt.n,
                  doi: function (v) { tt.n = v; batDau(); } }),
        V.truot({ ten: "Hạt giống", min: 1, max: 40, buoc: 1, giaTri: tt.hat,
                  doi: function (v) { tt.hat = v; batDau(); } })
      ];

      V.khung(host, {
        ve: [cv, cv2], dieuKhien: dk,
        giaiThich:
          "<b>Leo đồi thật với lân cận 2-opt</b>, chạy từng nước ngay trong trình duyệt. " +
          "Trái là nghiệm xuất phát (xáo ngẫu nhiên), phải là nghiệm hiện tại.<ul>" +
          "<li>Nhìn tuyến bên phải: các <b>đường cắt chéo nhau biến mất dần</b>. " +
          "Đó chính là việc 2-opt làm — <b>gỡ nút thắt</b>. Khi không còn cặp cạnh nào " +
          "cắt nhau thì gần như đã hết nước cải thiện.</li>" +
          "<li><b>Đường cong tiến độ</b> dưới hình: dốc đứng lúc đầu rồi <b>phẳng dần</b>. " +
          "★ Hình dạng này là <b>chỉ dấu thứ hai của \"tôi đang kẹt\"</b> (bài 12 §3): " +
          "số nước cải thiện về 0 rất sớm so với ngân sách thời gian.</li></ul>" +
          "<b>★ Thí nghiệm chính — đổi giữa hai biến thể và đọc dòng \"Số lần ĐÁNH GIÁ delta\":</b><ul>" +
          "<li><b>Nước đi đầu tiên:</b> nhận ngay nước cải thiện đầu gặp được, rồi " +
          "<b>quét lại từ đầu</b>. Tổng số lần đánh giá thường <b>thấp hơn</b>.</li>" +
          "<li><b>Nước đi tốt nhất:</b> quét <b>toàn bộ</b> lân cận rồi mới chọn cái tốt nhất. " +
          "Mỗi nước đi tốn <code>n(n−3)/2</code> lần đánh giá — <b>đắt hơn nhiều</b>.</li>" +
          "<li>⚠️ <b>Và chất lượng cuối cùng thường gần như nhau.</b> Chạy vài hạt giống mà xem. " +
          "Đây là kết quả phản trực giác quan trọng: <b>tham lam hơn ở mức nước đi " +
          "không mua được nghiệm tốt hơn</b>, chỉ tốn thêm thời gian.</li></ul>" +
          "<b>⇒ Kết luận dùng được: trong phòng thi, dùng \"nước đi đầu tiên\" — cùng chất lượng, " +
          "nhiều lượt lặp hơn trong cùng ngân sách. Số lượt lặp mới là thứ mua được điểm.</b>"
      });
      batDau();
    }
  });

  /* ================================================================
     9. Nam toan tu kinh dien
     ================================================================ */
  demo({
    id: "toan-tu-2opt", nhom: "Cải thiện nghiệm", mon: "B11",
    ten: "Năm toán tử kinh điển — mỗi cái sửa một lỗi khác nhau",
    moTa: "2-opt · Or-opt · swap · relocate · đảo đoạn. Xem <b>từng toán tử " +
          "sửa được loại lỗi nào</b>, và cái nào gỡ được nút thắt.",
    lienKet: '<a href="../web/index.html#/khoa-hoc/bai-11-toan-tu-kinh-dien">B11 — Toán tử kinh điển</a>',
    dung: function (host) {
      var W = 560, H = 340, W2 = 560, H2 = 210;
      var cv = V.veBang(W, H), g = cv.g;
      var cv2 = V.veBang(W2, H2), g2 = cv2.g;

      var tt = { n: 14, tt_op: "2opt", hat: 3, i: 3, j: 8 };
      var ds = sinhDiem(tt.n, tt.hat);
      var q0 = ds.map(function (_, i) { return i; });

      function xao() {
        ds = sinhDiem(tt.n, tt.hat);
        q0 = ds.map(function (_, i) { return i; });
        var r = V.rng(tt.hat * 13 + 5), i, j, t;
        for (i = q0.length - 1; i > 0; i--) {
          j = Math.floor(r() * (i + 1)); t = q0[i]; q0[i] = q0[j]; q0[j] = t;
        }
      }
      xao();

      function apDung(op, q, i, j) {
        var a = q.slice(), seg;
        i = Math.min(i, a.length - 1); j = Math.min(j, a.length - 1);
        if (i > j) { var t = i; i = j; j = t; }
        if (op === "2opt") {
          seg = a.slice(i, j + 1).reverse();
          Array.prototype.splice.apply(a, [i, j - i + 1].concat(seg));
        } else if (op === "swap") {
          var x = a[i]; a[i] = a[j]; a[j] = x;
        } else if (op === "relocate") {
          var v = a.splice(i, 1)[0]; a.splice(j, 0, v);
        } else if (op === "oropt") {
          var L = Math.min(3, j - i);
          if (L <= 0) return a;
          var s2 = a.splice(i, L);
          var k = Math.min(j, a.length);
          Array.prototype.splice.apply(a, [k, 0].concat(s2));
        } else if (op === "daodoan") {
          seg = a.slice(i, j + 1).reverse();
          Array.prototype.splice.apply(a, [i, j - i + 1].concat(seg));
        }
        return a;
      }

      var OP = {
        "2opt": { t: "2-opt — đảo đoạn giữa hai cạnh",
                  sua: "gỡ hai cạnh CẮT NHAU", do: "O(1) với công thức delta" },
        "oropt": { t: "Or-opt — chuyển đoạn 1–3 điểm đi chỗ khác",
                   sua: "điểm nằm SAI CỤM", do: "O(1)" },
        "swap": { t: "Swap — đổi chỗ hai điểm",
                  sua: "hai điểm bị HOÁN VỊ nhầm", do: "O(1)" },
        "relocate": { t: "Relocate — nhấc một điểm chèn vào chỗ khác",
                      sua: "một điểm LẠC LOÀI", do: "O(1)" },
        "daodoan": { t: "Đảo đoạn — reverse một khúc",
                     sua: "cả một khúc đi NGƯỢC CHIỀU", do: "O(độ dài đoạn)" }
      };

      function ve() {
        g.clearRect(0, 0, W, H);
        var S = Math.min(W / 2 - 24, H - 100);
        var oy = 34;
        var q1 = apDung(tt.tt_op, q0, tt.i, tt.j);
        var d0 = daiChuTrinh(q0, ds), d1 = daiChuTrinh(q1, ds);

        veTour(g, ds, q0, 14, oy, S, V.mau("tx3"), 1.5);
        g.fillStyle = V.mau("tx2"); g.font = "600 11.5px system-ui"; g.textAlign = "left";
        g.fillText("TRƯỚC — dài " + d0.toFixed(3), 14, oy - 8);

        veTour(g, ds, q1, W / 2 + 10, oy, S, d1 < d0 ? "#0f766e" : "#b91c1c", 1.9);
        g.fillStyle = d1 < d0 ? "#0f766e" : "#b91c1c"; g.font = "600 11.5px system-ui";
        g.fillText("SAU — dài " + d1.toFixed(3) +
                   "  (" + (d1 < d0 ? "" : "+") + (d1 - d0).toFixed(3) + ")", W / 2 + 10, oy - 8);

        /* danh dau hai diem bi cham */
        [[tt.i, "i"], [tt.j, "j"]].forEach(function (p) {
          var idx = Math.min(p[0], q0.length - 1);
          var pt = ds[q0[idx]];
          g.strokeStyle = V.mau("ac"); g.lineWidth = 2;
          g.beginPath(); g.arc(14 + pt.x * S, oy + pt.y * S, 7.5, 0, 6.2832); g.stroke();
          g.fillStyle = V.mau("ac"); g.font = "700 10px system-ui"; g.textAlign = "center";
          g.fillText(p[1], 14 + pt.x * S, oy + pt.y * S - 11);
        });

        /* mo ta toan tu */
        var y = oy + S + 22;
        g.textAlign = "left";
        g.fillStyle = V.mau("tx"); g.font = "700 12.5px system-ui";
        g.fillText(OP[tt.tt_op].t, 14, y);
        g.fillStyle = V.mau("tx2"); g.font = "11.5px system-ui";
        g.fillText("Sửa được lỗi: " + OP[tt.tt_op].sua, 14, y + 19);
        g.fillText("Chi phí đánh giá: " + OP[tt.tt_op].do, 14, y + 36);
      }

      /* bang 2: quet ca lan can cua TUNG toan tu, xem cai nao tim duoc cai thien */
      function ve2() {
        g2.clearRect(0, 0, W2, H2);
        g2.fillStyle = V.mau("tx"); g2.font = "600 12.5px system-ui"; g2.textAlign = "left";
        g2.fillText("Quét TOÀN BỘ lân cận của từng toán tử trên nghiệm hiện tại:", 14, 20);

        var d0 = daiChuTrinh(q0, ds);
        var kq = Object.keys(OP).map(function (op) {
          var best = 0, dem = 0, i, j;
          for (i = 0; i < q0.length; i++) {
            for (j = i + 1; j < q0.length; j++) {
              var d = daiChuTrinh(apDung(op, q0, i, j), ds) - d0;
              dem++;
              if (d < best) best = d;
            }
          }
          return { op: op, best: best, dem: dem };
        });
        var tot = Math.min.apply(null, kq.map(function (k) { return k.best; }));

        kq.forEach(function (k, i) {
          var y = 40 + i * 30;
          var tyLe = tot < 0 ? k.best / tot : 0;
          g2.fillStyle = V.mau("surf2"); g2.fillRect(210, y, 250, 18);
          g2.fillStyle = k.best < -1e-9 ? "#0f766e" : V.mau("bd");
          g2.fillRect(210, y, Math.max(2, 250 * tyLe), 18);
          g2.fillStyle = k.op === tt.tt_op ? V.mau("ac") : V.mau("tx2");
          g2.font = (k.op === tt.tt_op ? "700 " : "") + "11.5px system-ui";
          g2.fillText(OP[k.op].t.split(" — ")[0], 14, y + 13);
          g2.fillStyle = V.mau("tx"); g2.font = "600 11px ui-monospace, monospace";
          g2.fillText(k.best < -1e-9 ? k.best.toFixed(4) : "không có", 468, y + 13);
          g2.fillStyle = V.mau("tx3"); g2.font = "10px system-ui";
          g2.fillText(k.dem + " nước", 120, y + 13);
        });
        g2.fillStyle = V.mau("tx3"); g2.font = "10.5px system-ui";
        g2.fillText("Cột phải = nước đi TỐT NHẤT mà toán tử đó tìm được (âm là cải thiện).",
                    14, H2 - 8);
      }

      function veHet() { ve(); ve2(); }

      var dkI = V.truot({ ten: "Vị trí i", min: 0, max: 13, buoc: 1, giaTri: tt.i,
                          doi: function (v) { tt.i = v; veHet(); } });
      var dkJ = V.truot({ ten: "Vị trí j", min: 1, max: 13, buoc: 1, giaTri: tt.j,
                          doi: function (v) { tt.j = v; veHet(); } });

      var dk = [
        V.chon({ ten: "Toán tử", giaTri: tt.tt_op,
                 muc: Object.keys(OP).map(function (k) {
                   return { v: k, t: OP[k].t.split(" — ")[0] };
                 }),
                 doi: function (v) { tt.tt_op = v; veHet(); } }),
        dkI, dkJ,
        V.truot({ ten: "Số điểm", min: 8, max: 20, buoc: 1, giaTri: tt.n,
                  doi: function (v) {
                    tt.n = v; xao();
                    tt.i = Math.min(tt.i, v - 1); tt.j = Math.min(tt.j, v - 1);
                    dkI.datGiaTri(tt.i); dkJ.datGiaTri(tt.j);
                    veHet();
                  } }),
        V.truot({ ten: "Hạt giống", min: 1, max: 40, buoc: 1, giaTri: tt.hat,
                  doi: function (v) { tt.hat = v; xao(); veHet(); } })
      ];

      V.khung(host, {
        ve: [cv, cv2], dieuKhien: dk,
        giaiThich:
          "<b>Kéo i và j để tự tay áp một nước đi</b>, rồi so hai hình. Xanh = tuyến ngắn đi; " +
          "đỏ = dài ra. Hai vòng tròn trên hình trái là hai vị trí bị chạm.<ul>" +
          "<li><b>2-opt</b> đảo ngược cả đoạn giữa hai vị trí. Đây là toán tử <b>mạnh nhất " +
          "cho TSP thuần</b> vì nó là cách duy nhất gỡ được <b>hai cạnh cắt nhau</b>. " +
          "Tìm một cặp cạnh chéo nhau trên hình trái rồi đặt i, j vào đúng đó mà xem.</li>" +
          "<li><b>Or-opt</b> nhấc một đoạn ngắn (1–3 điểm) sang chỗ khác <b>mà không đảo chiều</b>. " +
          "Nó sửa loại lỗi khác hẳn: một nhóm điểm bị xếp nhầm cụm.</li>" +
          "<li><b>Swap</b> chỉ đổi chỗ hai điểm. Yếu nhất, nhưng rẻ và đôi khi thoát được " +
          "chỗ mà 2-opt bó tay.</li>" +
          "<li><b>Relocate</b> nhấc <b>một</b> điểm đi chỗ khác — sửa điểm lạc loài.</li></ul>" +
          "<b>★ Bảng dưới là phần quan trọng nhất:</b> nó quét <b>toàn bộ</b> lân cận của " +
          "từng toán tử trên nghiệm hiện tại và báo nước đi tốt nhất mỗi loại tìm được.<ul>" +
          "<li>Đổi hạt giống vài lần: bạn sẽ thấy <b>không toán tử nào luôn thắng</b>. " +
          "Có nghiệm mà 2-opt hết nước nhưng Or-opt vẫn còn — và ngược lại.</li>" +
          "<li>★ <b>Đây chính là lý do tồn tại của VND</b> (bài 15): khi lân cận thứ nhất " +
          "hết nước, <b>đổi sang lân cận khác</b> thay vì bỏ cuộc. " +
          "Một nghiệm là cực trị cục bộ <b>đối với một lân cận cụ thể</b>, không phải nói chung.</li></ul>" +
          "<b>⚠️ Kết quả phản trực giác của bài 11 §4:</b> trong bài toán có <b>thời gian phục vụ " +
          "và cửa sổ thời gian</b>, rút ngắn quãng đường có thể <b>làm giảm điểm</b> — vì tuyến " +
          "ngắn hơn lại tới sớm quá và phải chờ. <b>Luôn đo bằng hàm mục tiêu thật, " +
          "đừng đo bằng quãng đường.</b>"
      });
      veHet();
    }
  });

  /* ================================================================
     10. Delta evaluation — O(1) vs tinh lai O(n), va loi troi delta
     ================================================================ */
  demo({
    id: "delta-evaluation", nhom: "Cải thiện nghiệm", mon: "B10",
    ten: "Đánh giá delta — vì sao đừng đếm lại cả siêu thị",
    moTa: "Cùng một thuật toán, hai cách tính điểm: <code>O(n)</code> tính lại toàn bộ " +
          "hay <code>O(1)</code> tính delta. Chênh lệch <b>nước đi/giây</b> là bao nhiêu lần?",
    lienKet: '<a href="../web/index.html#/khoa-hoc/bai-10-delta-evaluation">B10 — Đánh giá delta</a>',
    dung: function (host) {
      var W = 560, H = 270, W2 = 560, H2 = 230;
      var cv = V.veBang(W, H), g = cv.g;
      var cv2 = V.veBang(W2, H2), g2 = cv2.g;

      var tt = { n: 200, nganSach: 1e8, troi: false };

      function ve() {
        g.clearRect(0, 0, W, H);
        var padL = 54, padR = 16, padT = 30, padB = 34;
        var w = W - padL - padR, h = H - padT - padB;
        var nMax = 1000;

        g.fillStyle = V.mau("tx"); g.font = "600 12.5px system-ui"; g.textAlign = "left";
        g.fillText("Số nước đi đánh giá được trong cùng một ngân sách", padL, 18);

        /* nuoc/giay ~ nganSach / chi phi moi nuoc */
        var Y = function (v) {                       /* thang log */
          var L = Math.log10(Math.max(1, v));
          return padT + h - L / 9 * h;
        };
        var X = function (n) { return padL + n / nMax * w; };

        g.strokeStyle = V.mau("bd2"); g.lineWidth = 1;
        g.fillStyle = V.mau("tx3"); g.font = "10px system-ui"; g.textAlign = "right";
        for (var L = 0; L <= 9; L += 1) {
          var yy = padT + h - L / 9 * h;
          g.beginPath(); g.moveTo(padL, yy); g.lineTo(padL + w, yy); g.stroke();
          g.fillText("10^" + L, padL - 6, yy + 3);
        }
        g.textAlign = "center";
        for (var n = 0; n <= nMax; n += 200) g.fillText(String(n), X(n), padT + h + 15);
        g.fillText("n — số điểm trong tuyến", padL + w / 2, padT + h + 29);

        /* hai duong */
        [{ f: function (n) { return tt.nganSach / n; }, mau: "#b91c1c", t: "Tính lại toàn bộ O(n)" },
         { f: function () { return tt.nganSach / 4; }, mau: "#0f766e", t: "Đánh giá delta O(1)" }
        ].forEach(function (d) {
          g.strokeStyle = d.mau; g.lineWidth = 2.4;
          g.beginPath();
          for (var n = 5; n <= nMax; n += 5) {
            var yy = Y(d.f(n));
            if (n === 5) g.moveTo(X(n), yy); else g.lineTo(X(n), yy);
          }
          g.stroke();
        });

        /* vach n hien tai */
        g.save(); g.setLineDash([3, 3]); g.strokeStyle = V.mau("ac"); g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(X(tt.n), padT); g.lineTo(X(tt.n), padT + h); g.stroke();
        g.restore();

        g.textAlign = "left"; g.font = "600 10.5px system-ui";
        g.fillStyle = "#0f766e"; g.fillText("── delta O(1)", padL + 8, padT + 12);
        g.fillStyle = "#b91c1c"; g.fillText("── tính lại O(n)", padL + 8, padT + 26);
      }

      function ve2() {
        g2.clearRect(0, 0, W2, H2);
        var full = tt.nganSach / tt.n, del = tt.nganSach / 4;
        var lan = del / full;

        g2.fillStyle = V.mau("tx"); g2.font = "600 12.5px system-ui"; g2.textAlign = "left";
        g2.fillText("Với n = " + tt.n + " điểm, trong cùng ngân sách tính toán:", 14, 20);

        var hang = [
          { t: "Tính lại toàn bộ  O(n)", v: full, mau: "#b91c1c" },
          { t: "Đánh giá delta  O(1)", v: del, mau: "#0f766e" }
        ];
        var maxV = del;
        hang.forEach(function (r, i) {
          var y = 38 + i * 44;
          g2.fillStyle = V.mau("surf2"); g2.fillRect(14, y, W2 - 28, 24);
          g2.fillStyle = r.mau; g2.fillRect(14, y, Math.max(3, (W2 - 28) * (r.v / maxV)), 24);
          g2.fillStyle = "#fff"; g2.font = "600 11.5px system-ui";
          g2.fillText(r.t, 22, y + 16);
          g2.fillStyle = V.mau("tx2"); g2.font = "11.5px ui-monospace, monospace";
          g2.fillText(docSo(r.v) + " nước đi", 16, y + 38);
        });

        g2.fillStyle = V.mau("ac"); g2.font = "700 13px system-ui";
        g2.fillText("⇒ Nhanh hơn " + lan.toFixed(0) + " lần — cùng thuật toán, " +
                    "chỉ khác cách tính điểm.", 14, 150);

        /* loi troi delta */
        if (tt.troi) {
          g2.fillStyle = V.mau("loi"); g2.font = "700 12px system-ui";
          g2.fillText("⚠ LỖI TRÔI DELTA đang bật", 14, 176);
          g2.fillStyle = V.mau("tx2"); g2.font = "11px system-ui";
          g2.fillText("Sau 10⁶ nước, sai số cộng dồn làm điểm nội bộ lệch khỏi điểm thật.", 14, 193);
          g2.fillText("Triệu chứng: solver báo điểm cao, grader chấm thấp. Không crash.", 14, 208);
        } else {
          g2.fillStyle = V.mau("tx2"); g2.font = "11px system-ui";
          g2.fillText("Bật ô \"lỗi trôi delta\" để xem chế độ hỏng nguy hiểm nhất của kỹ thuật này.",
                      14, 176);
          g2.fillText("Cách chống: cứ mỗi 10 000 nước, tính lại toàn bộ và so — phải khớp.", 14, 193);
        }
      }

      function docSo(v) {
        if (v >= 1e9) return (v / 1e9).toFixed(1) + " tỷ";
        if (v >= 1e6) return (v / 1e6).toFixed(1) + " triệu";
        if (v >= 1e3) return (v / 1e3).toFixed(1) + " nghìn";
        return v.toFixed(0);
      }

      function veHet() { ve(); ve2(); }

      var dk = [
        V.truot({ ten: "n — số điểm trong tuyến", min: 10, max: 1000, buoc: 10, giaTri: tt.n,
                  doi: function (v) { tt.n = v; veHet(); } }),
        V.danhDau({ ten: "Mô phỏng lỗi trôi delta", giaTri: tt.troi,
                    doi: function (v) { tt.troi = v; veHet(); } })
      ];

      V.khung(host, {
        ve: [cv, cv2], dieuKhien: dk,
        giaiThich:
          "<b>Ý tưởng một câu:</b> khi bạn đổi chỗ hai điểm trong tuyến, <b>chỉ 4 cạnh thay đổi</b>. " +
          "Tính lại toàn bộ độ dài là đếm lại cả <code>n</code> cạnh — lãng phí <code>n/4</code> lần.<ul>" +
          "<li>Công thức delta của 2-opt (bài 10 §3.1): " +
          "<code>Δ = d(q[i−1],q[j]) + d(q[i],q[j+1]) − d(q[i−1],q[i]) − d(q[j],q[j+1])</code>. " +
          "<b>Bốn phép tính khoảng cách — không phụ thuộc n.</b></li>" +
          "<li>Kéo n lên 1000: chênh lệch thành <b>250 lần</b>. " +
          "★ Và vì chất lượng nghiệm phụ thuộc <b>số nước đi thử được</b>, " +
          "delta evaluation không phải tối ưu hoá vi mô — nó là <b>thứ quyết định bạn " +
          "ở hạng nào</b>.</li></ul>" +
          "<b>★ Chế độ hỏng nguy hiểm nhất — lỗi \"trôi delta\":</b><ul>" +
          "<li>Bạn cộng dồn <code>diem += delta</code> qua hàng triệu nước đi. Nếu công thức " +
          "delta <b>sai ở một trường hợp biên</b> (ví dụ j là phần tử cuối, hoặc đoạn vắt qua " +
          "dấu phân cách), sai số <b>cộng dồn im lặng</b>.</li>" +
          "<li>⚠️ <b>Triệu chứng đặc trưng:</b> solver tự báo điểm rất cao, nhưng grader chấm " +
          "thấp hơn hẳn. <b>Không có crash, không có cảnh báo</b> — và đó là lý do nó tốn " +
          "hàng giờ để tìm ra.</li>" +
          "<li><b>Cách chống, bắt buộc:</b> mỗi 10 000 nước, tính lại toàn bộ và " +
          "<code>assert(|điểm_cộng_dồn − điểm_tính_lại| &lt; 1e-6)</code>. " +
          "Tốn 0,01 % thời gian, cứu cả một kỳ thi.</li></ul>" +
          "<b>⇒ Thứ tự đúng khi cài đặt: ① viết hàm tính điểm TOÀN BỘ trước (chậm nhưng chắc chắn đúng) · " +
          "② viết delta · ③ kiểm delta bằng cách so với hàm ① trên 10 000 nước ngẫu nhiên · " +
          "④ mới bật delta trong vòng nóng.</b>"
      });
      veHet();
    }
  });

})();
