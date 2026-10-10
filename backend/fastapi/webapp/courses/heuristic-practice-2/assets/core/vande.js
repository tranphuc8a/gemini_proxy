/* Thư viện "bài toán": bộ sinh dữ liệu tất định + bộ chấm trung thực + lời giải tham chiếu.
   Mọi lab dùng chung một giao thức kiểu judge: dữ liệu vào (stdin) là văn bản do `viet(inst)` tạo ra,
   lời giải in kết quả (stdout) và `cham(inst, văn bản)` chấm. Nhờ vậy một lab giải được bằng JS lẫn C++.

   Một bài toán là đối tượng:
     sinh(seed, tham) → inst          tất định theo seed
     viet(inst)       → string        nội dung stdin
     cham(inst, text) → {ok, diem, loi?, chiTiet?}   ok=false: kết quả không hợp lệ (diem bị bỏ)
     tot: "cao" | "thap"              diem càng cao / càng thấp càng tốt
     thamChieu: {ten: fn(inst) → text}   lời giải tham chiếu, dùng làm mốc so sánh
     dinhDang: {vao, ra}              markup mô tả định dạng cho người học
     ve(ctx, rong, cao, inst, text)   (chỉ trình duyệt) vẽ lời giải lên canvas
   Bài toán lấy từ khoá học: P0 cái túi "tui", P1 ship hàng một ngày "ship1", chu trình "tsp". */
(function (root) {
  "use strict";
  var TH = root.TH || (root.TH = {});
  var TI = TH.tienIch || (typeof require !== "undefined" ? require("./tien-ich.js") : null);

  var kho = {};
  var VD = {};
  VD.dangKy = function (ten, vd) {
    if (kho[ten]) throw new Error("Bài toán “" + ten + "” đã được đăng ký — đặt tên khác (tiền tố là mã bài, ví dụ b10-delta-2opt)");
    vd.ten = ten; if (!vd.tot) vd.tot = "cao"; kho[ten] = vd; return vd;
  };
  /* Bài toán mới = bài toán có sẵn + ghi đè (thường để thêm lời giải tham chiếu vào `thamChieu`). */
  VD.keThua = function (goc, tenMoi, ghiDe) {
    var g = kho[goc];
    if (!g) throw new Error("Không có bài toán gốc “" + goc + "”");
    ghiDe = ghiDe || {};
    var m = Object.assign({}, g, ghiDe);
    m.thamChieu = Object.assign({}, g.thamChieu, ghiDe.thamChieu || {});
    delete m.ten;
    return VD.dangKy(tenMoi, m);
  };
  VD.lay = function (ten) { return kho[ten] || null; };
  VD.ds = function () { return Object.keys(kho); };

  /* Đọc dãy số nguyên từ văn bản; báo lỗi tiếng Việt nếu có chữ lạ. */
  VD.docNguyen = function (text) {
    var t = String(text == null ? "" : text).split(/\s+/).filter(Boolean), so = [];
    for (var i = 0; i < t.length; i++) {
      if (!/^-?\d+$/.test(t[i])) return { ok: false, loi: "Kết quả chứa “" + t[i].slice(0, 20) + "” — không phải số nguyên" };
      so.push(parseInt(t[i], 10));
    }
    return { ok: true, so: so };
  };

  function tong(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s; }
  function xuatChon(ds) { return ds.length + "\n" + ds.join(" ") + "\n"; }
  function khongHopLe(loi) { return { ok: false, diem: 0, loi: loi }; }

  /* "tuDapAn": bài toán chỉ có một đáp án đúng cho mỗi bộ dữ liệu (không tối ưu hoá).
     o = {sinh, viet, giai(inst) → số | chuỗi | mảng (lồng nhau được), saiSo?, dinhDang?, ve?}
     Điểm mỗi test là 1 nếu khớp từng token (số so với sai số), ngược lại ok=false và nói rõ chỗ lệch. */
  function dep(x, out) {
    if (Array.isArray(x)) x.forEach(function (y) { dep(y, out); }); else out.push(x);
    return out;
  }
  function inSo(x) {
    if (typeof x !== "number") return String(x);
    if (Math.floor(x) === x) return String(x);
    return String(parseFloat(x.toFixed(9)));
  }
  VD.tuDapAn = function (o) {
    function mong(inst) { return dep(o.giai(inst), []); }
    var vd = {
      sinh: o.sinh, viet: o.viet, tot: "cao", dinhDang: o.dinhDang || null, ve: o.ve || null,
      cham: function (inst, text) {
        var cho = mong(inst), nhan = String(text == null ? "" : text).split(/\s+/).filter(Boolean);
        if (nhan.length !== cho.length) {
          return khongHopLe("Cần in đúng " + cho.length + " giá trị, chương trình in " + nhan.length +
            (nhan.length ? " (bắt đầu bằng “" + nhan.slice(0, 3).join(" ") + "”)" : "") + ".");
        }
        for (var i = 0; i < cho.length; i++) {
          var kv = cho[i], nv = nhan[i];
          var khop = typeof kv === "number" ? (isFinite(TI.docSo(nv)) && Math.abs(TI.docSo(nv) - kv) <= (o.saiSo || 0) + 1e-12) : String(kv) === nv;
          if (!khop) return khongHopLe("Giá trị thứ " + (i + 1) + ": mong đợi " + inSo(kv) + ", chương trình in " + nv.slice(0, 30) + ".");
        }
        return { ok: true, diem: 1 };
      },
      thamChieu: { dapAn: function (inst) { return mong(inst).map(inSo).join("\n") + "\n"; } }
    };
    return vd;
  };

  /* ===================================================================================
     P0 — Cái túi 0/1  ("tui")
     stdin : n B / n dòng "w p"      stdout: k / k chỉ số (đánh số từ 1)
     =================================================================================== */
  function sinhTui(seed, tham) {
    tham = tham || {};
    var r = TI.rng(seed), n = tham.n || 30, kieu = tham.kieu || "ngau-nhien", w = [], p = [];
    for (var i = 0; i < n; i++) {
      var wi = r.khoang(5, 60);
      w.push(wi);
      p.push(kieu === "tuong-quan" ? wi + r.khoang(0, 20) : kieu === "deu" ? wi : r.khoang(5, 100));
    }
    var maxW = Math.max.apply(null, w);
    return { n: n, B: tham.B || Math.max(maxW, Math.floor(tong(w) * (tham.tyLe || 0.4))), w: w, p: p };
  }
  function vietTui(inst) {
    var s = inst.n + " " + inst.B + "\n";
    for (var i = 0; i < inst.n; i++) s += inst.w[i] + " " + inst.p[i] + "\n";
    return s;
  }
  function chamTui(inst, text) {
    var d = VD.docNguyen(text);
    if (!d.ok) return khongHopLe(d.loi);
    var t = d.so;
    if (!t.length) return khongHopLe("Chưa in gì. Dòng đầu là k (số món chọn), tiếp theo là k chỉ số.");
    var k = t[0];
    if (k < 0 || k > inst.n) return khongHopLe("k = " + k + " không nằm trong [0, " + inst.n + "].");
    if (t.length !== k + 1) return khongHopLe("Sau k = " + k + " phải có đúng " + k + " chỉ số, nhưng có " + (t.length - 1) + ".");
    var seen = {}, W = 0, P = 0;
    for (var i = 1; i <= k; i++) {
      var id = t[i];
      if (id < 1 || id > inst.n) return khongHopLe("Chỉ số " + id + " ngoài khoảng [1, " + inst.n + "].");
      if (seen[id]) return khongHopLe("Món " + id + " được chọn hai lần.");
      seen[id] = 1; W += inst.w[id - 1]; P += inst.p[id - 1];
    }
    if (W > inst.B) return khongHopLe("Tổng khối lượng " + W + " vượt sức chứa " + inst.B + ".");
    return { ok: true, diem: P, chiTiet: { k: k, khoiLuong: W, sucChua: inst.B } };
  }
  function chonTheo(inst, thuTu) {
    var W = 0, ds = [];
    thuTu.forEach(function (i) { if (W + inst.w[i] <= inst.B) { W += inst.w[i]; ds.push(i + 1); } });
    return xuatChon(ds);
  }
  function chiSo(n) { var a = []; for (var i = 0; i < n; i++) a.push(i); return a; }
  function toiUuTui(inst) {          /* quy hoạch động; null nếu bảng quá lớn */
    var n = inst.n, B = inst.B;
    if ((n + 1) * (B + 1) > 6e6) return null;
    var f = new Int32Array(B + 1), giu = new Uint8Array(n * (B + 1));
    for (var i = 0; i < n; i++) {
      for (var c = B; c >= inst.w[i]; c--) {
        var v = f[c - inst.w[i]] + inst.p[i];
        if (v > f[c]) { f[c] = v; giu[i * (B + 1) + c] = 1; }
      }
    }
    var c2 = B, ds = [];
    for (var j = n - 1; j >= 0; j--) if (giu[j * (B + 1) + c2]) { ds.push(j + 1); c2 -= inst.w[j]; }
    ds.reverse();
    return { diem: f[B], text: xuatChon(ds) };
  }
  function canTrenPhanSo(inst) {     /* cái túi phân số = cận trên của 0/1 (Bài 5, Bài 18) */
    var ord = chiSo(inst.n).sort(function (a, b) { return inst.p[b] * inst.w[a] - inst.p[a] * inst.w[b] || a - b; });
    var con = inst.B, v = 0;
    for (var k = 0; k < ord.length; k++) {
      var i = ord[k];
      if (inst.w[i] <= con) { con -= inst.w[i]; v += inst.p[i]; }
      else { v += inst.p[i] * con / inst.w[i]; break; }
    }
    return v;
  }
  VD.tui = VD.dangKy("tui", {
    sinh: sinhTui, viet: vietTui, cham: chamTui, tot: "cao",
    dinhDang: {
      vao: "Dòng 1: `n B` — số món và sức chứa. Tiếp theo `n` dòng, dòng `i` là `w p` — khối lượng và giá trị của món `i` (đánh số từ 1).",
      ra: "Dòng 1: `k` — số món chọn. Dòng 2: `k` chỉ số (từ 1), cách nhau bằng khoảng trắng. Tổng khối lượng không được vượt `B`."
    },
    thamChieu: {
      giaTri: function (inst) { return chonTheo(inst, chiSo(inst.n).sort(function (a, b) { return inst.p[b] - inst.p[a] || a - b; })); },
      tiSo: function (inst) { return chonTheo(inst, chiSo(inst.n).sort(function (a, b) { return inst.p[b] * inst.w[a] - inst.p[a] * inst.w[b] || a - b; })); },
      toiUu: function (inst) { var t = toiUuTui(inst); return t ? t.text : VD.tui.thamChieu.tiSo(inst); }
    },
    diemToiUu: function (inst) { var t = toiUuTui(inst); return t ? t.diem : null; },
    canTrenPhanSo: canTrenPhanSo,
    ve: function (ctx, W, H, inst, text) {
      var d = VD.docNguyen(text), chon = {};
      if (d.ok && d.so.length) d.so.slice(1).forEach(function (i) { chon[i - 1] = 1; });
      var tongW = tong(inst.w), x = 8, maxH = H - 16;
      for (var i = 0; i < inst.n; i++) {
        var rong = Math.max(2, (W - 16) * inst.w[i] / tongW - 1), cao = Math.max(3, maxH * inst.p[i] / 100);
        ctx.fillStyle = chon[i] ? "#5b4bd6" : "#b9b4cf";
        ctx.fillRect(x, H - 8 - cao, rong, cao);
        x += rong + 1;
      }
    }
  });

  /* ===================================================================================
     P1 — Ship hàng một ngày  ("ship1")   (đúng đề ở Bài 1 §7)
     Lưới 100×100, kho ở (50,50). Đi u→v mất |Δy|+|Δx| phút. Đơn i trả p_i đồng, giao mất s_i phút.
     Ngày 480 phút, xuất phát từ kho, KHÔNG cần quay về. Bộ chấm này nghiêm: tuyến vượt giờ là không hợp lệ.
     stdin : n T / "50 50" / n dòng "x y p s"      stdout: k / k chỉ số theo thứ tự ghé
     =================================================================================== */
  function sinhShip1(seed, tham) {
    tham = tham || {};
    var r = TI.rng(seed), n = tham.n || 60, T = tham.T || 480, x = [], y = [], p = [], s = [];
    var tam = [];
    if (tham.cum) for (var c = 0; c < (tham.soCum || 4); c++) tam.push([r.khoang(10, 89), r.khoang(10, 89)]);
    for (var i = 0; i < n; i++) {
      var xi, yi;
      if (tam.length) {
        var t = tam[r.int(tam.length)];
        xi = Math.min(99, Math.max(0, t[0] + r.khoang(-10, 10))); yi = Math.min(99, Math.max(0, t[1] + r.khoang(-10, 10)));
      } else { xi = r.khoang(0, 99); yi = r.khoang(0, 99); }
      x.push(xi); y.push(yi); p.push(r.khoang(100, 1000)); s.push(r.khoang(5, 30));
    }
    return { n: n, T: T, kx: 50, ky: 50, x: x, y: y, p: p, s: s };
  }
  function vietShip1(inst) {
    var o = inst.n + " " + inst.T + "\n" + inst.kx + " " + inst.ky + "\n";
    for (var i = 0; i < inst.n; i++) o += inst.x[i] + " " + inst.y[i] + " " + inst.p[i] + " " + inst.s[i] + "\n";
    return o;
  }
  function dKho(inst, i) { return Math.abs(inst.x[i] - inst.kx) + Math.abs(inst.y[i] - inst.ky); }
  function dOrder(inst, a, b) { return Math.abs(inst.x[a] - inst.x[b]) + Math.abs(inst.y[a] - inst.y[b]); }
  function chamShip1(inst, text) {
    var d = VD.docNguyen(text);
    if (!d.ok) return khongHopLe(d.loi);
    var t = d.so;
    if (!t.length) return khongHopLe("Chưa in gì. Dòng đầu là k (số đơn ghé), tiếp theo là k chỉ số theo thứ tự ghé.");
    var k = t[0];
    if (k < 0 || k > inst.n) return khongHopLe("k = " + k + " không nằm trong [0, " + inst.n + "].");
    if (t.length !== k + 1) return khongHopLe("Sau k = " + k + " phải có đúng " + k + " chỉ số, nhưng có " + (t.length - 1) + ".");
    var seen = {}, tg = 0, tien = 0, cur = -1;
    for (var j = 1; j <= k; j++) {
      var id = t[j] - 1;
      if (id < 0 || id >= inst.n) return khongHopLe("Chỉ số " + t[j] + " ngoài khoảng [1, " + inst.n + "].");
      if (seen[id]) return khongHopLe("Đơn " + t[j] + " bị ghé hai lần.");
      seen[id] = 1;
      tg += (cur < 0 ? dKho(inst, id) : dOrder(inst, cur, id)) + inst.s[id];
      if (tg > inst.T) return khongHopLe("Hết giờ ở đơn thứ " + j + " (đơn " + t[j] + "): đã dùng " + tg + " phút > " + inst.T + ".");
      tien += inst.p[id]; cur = id;
    }
    return { ok: true, diem: tien, chiTiet: { k: k, thoiGian: tg, ngan: inst.T } };
  }
  /* Thời gian & tiền của một dãy chỉ số 0-based (dãy phải hợp lệ). */
  function thoiGianTuyen(inst, seq) {
    var tg = 0, cur = -1;
    for (var i = 0; i < seq.length; i++) { tg += (cur < 0 ? dKho(inst, seq[i]) : dOrder(inst, cur, seq[i])) + inst.s[seq[i]]; cur = seq[i]; }
    return tg;
  }
  function tienTuyen(inst, seq) { var s = 0; for (var i = 0; i < seq.length; i++) s += inst.p[seq[i]]; return s; }
  function xuatTuyen(seq) { return xuatChon(seq.map(function (i) { return i + 1; })); }

  /* Greedy "ghép nối cuối tuyến" theo hàm điểm: cho mỗi ứng viên còn vừa giờ, chọn điểm cao nhất. */
  function greedyCuoi(inst, diemFn) {
    var dung = {}, seq = [], tg = 0, cur = -1;
    for (;;) {
      var tot = -1, bi = -Infinity, cost = 0;
      for (var i = 0; i < inst.n; i++) {
        if (dung[i]) continue;
        var di = cur < 0 ? dKho(inst, i) : dOrder(inst, cur, i), c = di + inst.s[i];
        if (tg + c > inst.T) continue;
        var sc = diemFn(inst, i, di, c);
        if (sc > bi) { bi = sc; tot = i; cost = c; }
      }
      if (tot < 0) break;
      dung[tot] = 1; seq.push(tot); tg += cost; cur = tot;
    }
    return seq;
  }
  /* Chèn rẻ nhất: thêm mọi đơn vào vị trí bất kỳ (không chỉ cuối) khi còn vừa giờ, theo p / thời gian tăng thêm. */
  function chenRe(inst, seq0, rnd, soPha) {
    var seq = seq0.slice(), tg = thoiGianTuyen(inst, seq), dung = {};
    seq.forEach(function (i) { dung[i] = 1; });
    for (;;) {
      var tot = null, bi = -Infinity;
      for (var i = 0; i < inst.n; i++) {
        if (dung[i]) continue;
        for (var pos = 0; pos <= seq.length; pos++) {
          var a = pos === 0 ? -1 : seq[pos - 1], b = pos === seq.length ? -2 : seq[pos];
          var them = (a < 0 ? dKho(inst, i) : dOrder(inst, a, i)) + inst.s[i] +
                     (b === -2 ? 0 : (dOrder(inst, i, b) - (a < 0 ? dKho(inst, b) : dOrder(inst, a, b))));
          if (tg + them > inst.T) continue;
          var sc = inst.p[i] / (them + 1) * (rnd ? 0.8 + 0.4 * rnd() : 1);
          if (sc > bi) { bi = sc; tot = [i, pos, them]; }
        }
      }
      if (!tot) break;
      seq.splice(tot[1], 0, tot[0]); dung[tot[0]] = 1; tg += tot[2];
    }
    return seq;
  }
  /* Tham chiếu mạnh: LNS nhỏ (phá 1–3 đơn rồi chèn lại), cố định số vòng và seed nên tất định. */
  function shipTot(inst) {
    var rnd = TI.rng(TI.bam(vietShip1(inst))), vong = 250;
    var cur = chenRe(inst, greedyCuoi(inst, function (it, i, d, c) { return it.p[i] / (c + 1); }), null),
        best = cur, bestTien = tienTuyen(inst, cur), curTien = bestTien;
    for (var it = 0; it < vong; it++) {
      var cand = cur.slice(), bo = 1 + rnd.int(3);
      for (var k = 0; k < bo && cand.length; k++) cand.splice(rnd.int(cand.length), 1);
      cand = chenRe(inst, cand, rnd);
      var ct = tienTuyen(inst, cand);
      if (ct >= curTien) { cur = cand; curTien = ct; if (ct > bestTien) { best = cand; bestTien = ct; } }
    }
    return best;
  }
  VD.ship1 = VD.dangKy("ship1", {
    sinh: sinhShip1, viet: vietShip1, cham: chamShip1, tot: "cao",
    dinhDang: {
      vao: "Dòng 1: `n T` — số đơn và số phút trong ngày (480). Dòng 2: `50 50` — toạ độ kho. Tiếp theo `n` dòng, dòng `i` là `x y p s` — toạ độ, tiền và số phút giao của đơn `i` (đánh số từ 1). Đi từ `u` sang `v` mất `|Δx| + |Δy|` phút.",
      ra: "Dòng 1: `k` — số đơn giao. Dòng 2: `k` chỉ số theo đúng thứ tự ghé. Xuất phát từ kho lúc 0, **không cần quay về**; tổng thời gian đi + giao không được vượt `T`. Vượt giờ là kết quả không hợp lệ."
    },
    thamChieu: {
      giaTri: function (inst) { return xuatTuyen(greedyCuoi(inst, function (it, i) { return it.p[i]; })); },
      ganNhat: function (inst) { return xuatTuyen(greedyCuoi(inst, function (it, i, d) { return -d; })); },
      tiSo: function (inst) { return xuatTuyen(greedyCuoi(inst, function (it, i, d, c) { return it.p[i] / (c + 1); })); },
      tot: function (inst) { return xuatTuyen(shipTot(inst)); }
    },
    thoiGianTuyen: thoiGianTuyen, tienTuyen: tienTuyen,
    ve: function (ctx, W, H, inst, text) {
      var d = VD.docNguyen(text), sx = (W - 16) / 100, sy = (H - 16) / 100;
      function px(x) { return 8 + x * sx; } function py(y) { return 8 + y * sy; }
      var dung = {};
      if (d.ok && d.so.length) d.so.slice(1).forEach(function (i) { dung[i - 1] = 1; });
      for (var i = 0; i < inst.n; i++) {
        ctx.beginPath(); ctx.arc(px(inst.x[i]), py(inst.y[i]), dung[i] ? 4 : 2.5, 0, 6.283);
        ctx.fillStyle = dung[i] ? "#5b4bd6" : "#b9b4cf"; ctx.fill();
      }
      ctx.fillStyle = "#d9534f"; ctx.fillRect(px(inst.kx) - 4, py(inst.ky) - 4, 8, 8);
      if (d.ok && d.so.length > 1) {
        ctx.beginPath(); ctx.moveTo(px(inst.kx), py(inst.ky));
        d.so.slice(1).forEach(function (i) { if (i >= 1 && i <= inst.n) ctx.lineTo(px(inst.x[i - 1]), py(inst.y[i - 1])); });
        ctx.strokeStyle = "#5b4bd6"; ctx.lineWidth = 1.5; ctx.stroke();
      }
    }
  });

  /* ===================================================================================
     Chu trình ngắn nhất ("tsp") — dùng cho 2-opt, Or-opt, SA, Tabu, ILS, LNS…
     stdin : n / n dòng "x y"        stdout: n chỉ số (hoán vị 1..n) theo thứ tự đi; chu trình khép kín
     =================================================================================== */
  function sinhTsp(seed, tham) {
    tham = tham || {};
    var r = TI.rng(seed), n = tham.n || 40, x = [], y = [], tam = [];
    if (tham.cum) for (var c = 0; c < (tham.soCum || 4); c++) tam.push([r.khoang(100, 900), r.khoang(100, 900)]);
    for (var i = 0; i < n; i++) {
      if (tam.length) {
        var t = tam[r.int(tam.length)];
        x.push(Math.min(999, Math.max(0, t[0] + r.khoang(-80, 80)))); y.push(Math.min(999, Math.max(0, t[1] + r.khoang(-80, 80))));
      } else { x.push(r.khoang(0, 999)); y.push(r.khoang(0, 999)); }
    }
    return { n: n, x: x, y: y };
  }
  function vietTsp(inst) {
    var o = inst.n + "\n";
    for (var i = 0; i < inst.n; i++) o += inst.x[i] + " " + inst.y[i] + "\n";
    return o;
  }
  function dTsp(inst, a, b) { var dx = inst.x[a] - inst.x[b], dy = inst.y[a] - inst.y[b]; return Math.sqrt(dx * dx + dy * dy); }
  function daiTsp(inst, perm) {
    var s = 0;
    for (var i = 0; i < perm.length; i++) s += dTsp(inst, perm[i], perm[(i + 1) % perm.length]);
    return s;
  }
  function chamTsp(inst, text) {
    var d = VD.docNguyen(text);
    if (!d.ok) return khongHopLe(d.loi);
    if (d.so.length !== inst.n) return khongHopLe("Cần in đúng " + inst.n + " chỉ số, chương trình in " + d.so.length + ".");
    var seen = {}, perm = [];
    for (var i = 0; i < d.so.length; i++) {
      var id = d.so[i];
      if (id < 1 || id > inst.n) return khongHopLe("Chỉ số " + id + " ngoài khoảng [1, " + inst.n + "].");
      if (seen[id]) return khongHopLe("Điểm " + id + " xuất hiện hai lần — đầu ra phải là một hoán vị của 1.." + inst.n + ".");
      seen[id] = 1; perm.push(id - 1);
    }
    return { ok: true, diem: daiTsp(inst, perm), chiTiet: { n: inst.n } };
  }
  function ganNhatTsp(inst) {
    var dung = {}, perm = [0], cur = 0; dung[0] = 1;
    for (var k = 1; k < inst.n; k++) {
      var bi = -1, bd = Infinity;
      for (var i = 0; i < inst.n; i++) if (!dung[i]) { var dd = dTsp(inst, cur, i); if (dd < bd) { bd = dd; bi = i; } }
      dung[bi] = 1; perm.push(bi); cur = bi;
    }
    return perm;
  }
  function haiOptTsp(inst, perm0) {
    var p = perm0.slice(), n = p.length, cai = true;
    while (cai) {
      cai = false;
      for (var i = 0; i < n - 1; i++) {
        for (var j = i + 2; j < n; j++) {
          if (i === 0 && j === n - 1) continue;
          var a = p[i], b = p[i + 1], c = p[j], d = p[(j + 1) % n];
          if (dTsp(inst, a, c) + dTsp(inst, b, d) < dTsp(inst, a, b) + dTsp(inst, c, d) - 1e-9) {
            for (var l = i + 1, h = j; l < h; l++, h--) { var t = p[l]; p[l] = p[h]; p[h] = t; }
            cai = true;
          }
        }
      }
    }
    return p;
  }
  function toiUuTsp(inst) {            /* Held–Karp, chỉ cho n ≤ 13 */
    var n = inst.n;
    if (n > 13) return null;
    var N = 1 << (n - 1), f = [], cha = [];
    for (var m = 0; m < N; m++) { f.push(new Float64Array(n - 1).fill(Infinity)); cha.push(new Int8Array(n - 1).fill(-1)); }
    for (var j = 0; j < n - 1; j++) f[1 << j][j] = dTsp(inst, 0, j + 1);
    for (var mask = 1; mask < N; mask++) for (var last = 0; last < n - 1; last++) {
      if (!(mask & (1 << last)) || f[mask][last] === Infinity) continue;
      for (var nx = 0; nx < n - 1; nx++) {
        if (mask & (1 << nx)) continue;
        var v = f[mask][last] + dTsp(inst, last + 1, nx + 1), m2 = mask | (1 << nx);
        if (v < f[m2][nx]) { f[m2][nx] = v; cha[m2][nx] = last; }
      }
    }
    var full = N - 1, bi = -1, bv = Infinity;
    for (var e = 0; e < n - 1; e++) { var vv = f[full][e] + dTsp(inst, e + 1, 0); if (vv < bv) { bv = vv; bi = e; } }
    var perm = [], mk = full, cu = bi;
    while (cu >= 0) { perm.push(cu + 1); var pr = cha[mk][cu]; mk ^= (1 << cu); cu = pr; }
    perm.push(0); perm.reverse();
    return { diem: bv, perm: perm };
  }
  VD.tsp = VD.dangKy("tsp", {
    sinh: sinhTsp, viet: vietTsp, cham: chamTsp, tot: "thap",
    dinhDang: {
      vao: "Dòng 1: `n` — số điểm. Tiếp theo `n` dòng, dòng `i` là `x y` — toạ độ nguyên của điểm `i` (đánh số từ 1).",
      ra: "Một dòng gồm `n` chỉ số: hoán vị của `1..n` theo thứ tự đi. Chu trình khép kín (điểm cuối nối về điểm đầu). Độ dài là tổng khoảng cách Euclid, càng **ngắn** càng tốt."
    },
    thamChieu: {
      ganNhat: function (inst) { return ganNhatTsp(inst).map(function (i) { return i + 1; }).join(" ") + "\n"; },
      haiOpt: function (inst) { return haiOptTsp(inst, ganNhatTsp(inst)).map(function (i) { return i + 1; }).join(" ") + "\n"; },
      toiUu: function (inst) {
        var t = toiUuTsp(inst);
        return (t ? t.perm : haiOptTsp(inst, ganNhatTsp(inst))).map(function (i) { return i + 1; }).join(" ") + "\n";
      }
    },
    dai: daiTsp, haiOpt: haiOptTsp, ganNhat: ganNhatTsp,
    ve: function (ctx, W, H, inst, text) {
      var d = VD.docNguyen(text), sx = (W - 16) / 1000, sy = (H - 16) / 1000;
      function px(x) { return 8 + x * sx; } function py(y) { return 8 + y * sy; }
      if (d.ok && d.so.length === inst.n) {
        ctx.beginPath();
        d.so.forEach(function (i, k) { var X = px(inst.x[i - 1]), Y = py(inst.y[i - 1]); if (k) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); });
        ctx.closePath(); ctx.strokeStyle = "#5b4bd6"; ctx.lineWidth = 1.4; ctx.stroke();
      }
      ctx.fillStyle = "#3d2fa8";
      for (var i = 0; i < inst.n; i++) { ctx.beginPath(); ctx.arc(px(inst.x[i]), py(inst.y[i]), 2.6, 0, 6.283); ctx.fill(); }
    }
  });

  TH.vande = VD;
  if (typeof module !== "undefined" && module.exports) module.exports = VD;
})(typeof globalThis !== "undefined" ? globalThis : this);
