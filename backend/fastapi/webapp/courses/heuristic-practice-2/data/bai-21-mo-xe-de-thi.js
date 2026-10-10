/* Thực hành — Bài 21: Mổ xẻ đề thi thật (P3 — thợ vệ sinh điều hoà). */
(function () {
  "use strict";

  var GIA = [0, 80000, 140000, 180000, 240000, 250000, 300000];     /* PRICE[m], m = 1..6 */
  var SPH = [0, 60, 90, 120, 150, 180, 210];                         /* s_m = 30·m + 30 */

  /* ================= Bộ chấm P3 thu nhỏ: bản tham chiếu của "mã chấm" (move / nextDay, §3) ================= */
  function TT(nha, y0, x0, chung) {
    this.map = {};
    for (var i = 0; i < nha.length; i++) this.map[nha[i][0] * 100 + nha[i][1]] = nha[i][2];   /* ghi sau đè ghi trước */
    this.Y = y0; this.X = x0; this.cur = 0; this.ngay = 0; this.vp = false; this.chung = chung;
  }
  TT.prototype.loai = function (y, x) { return this.map[y * 100 + x] || 0; };
  TT.prototype.thu = function (y, x) {                    /* không thay đổi trạng thái: có vượt 720 không? */
    var d = Math.abs(y - this.Y) + Math.abs(x - this.X), m = this.loai(y, x);
    var phi = d + (m ? SPH[m] : 0);
    return { ok: this.cur + d <= 720 && this.cur + phi <= 720, d: d, phi: phi };
  };
  TT.prototype.di = function (y, x) {                     /* move(y, x) */
    var C = this.chung;
    if (y < 0 || x < 0 || y >= 100 || x >= 100) { C.score = 0; this.vp = true; return; }
    var startMin = this.cur;
    this.cur += Math.abs(y - this.Y) + Math.abs(x - this.X);
    if (this.cur > 720) { C.score = 0; this.vp = true; return; }
    this.Y = y; this.X = x;
    var m = this.loai(y, x);
    if (m === 0) return;
    this.cur += m * 30 + 30;
    if (this.cur > 720) { C.score = 0; this.vp = true; return; }
    C.score += GIA[m];
    if (this.cur > 480) C.score += (this.cur - Math.max(480, startMin)) * 200;
    this.map[y * 100 + x] = 0;
  };
  TT.prototype.sangNgay = function () {                   /* nextDay() */
    if (this.ngay >= 30) { this.chung.score = 0; this.vp = true; return; }
    this.ngay++; this.cur = 0;
  };

  function moPhong(inst) {
    var chung = { score: 0 }, out = [], soVP = 0;
    inst.tests.forEach(function (tc) {
      var tt = new TT(tc.nha, tc.y0, tc.x0, chung);
      for (var k = 0; k < tc.act.length && !tt.vp; k++) {
        var a = tc.act[k];
        if (a[0] === "D") tt.sangNgay(); else tt.di(a[1], a[2]);
      }
      if (tt.vp) soVP++;
      out.push(chung.score);
    });
    out.push(soVP);
    return out;
  }

  /* ---- bộ sinh kịch bản: mỗi test case là một "ngày làm việc" có chủ đích (thường / qua ngày / vi phạm) ---- */
  function nhaKhaThi(tt, nha) {                           /* các nhà chưa dọn mà còn vừa 720 phút, gần nhất trước */
    var ds = [], seen = {};
    nha.forEach(function (h) {
      var k = h[0] * 100 + h[1];
      if (seen[k]) return;
      seen[k] = 1;
      if (tt.loai(h[0], h[1]) > 0 && tt.thu(h[0], h[1]).ok) ds.push([h[0], h[1], tt.thu(h[0], h[1]).d]);
    });
    ds.sort(function (a, b) { return a[2] - b[2] || a[0] - b[0] || a[1] - b[1]; });
    return ds;
  }
  function oTrong(tt, r, daDon) {                         /* một ô trống (hoặc nhà đã dọn) gần vị trí hiện tại, tới được trong ngày */
    if (daDon.length && r.int(2)) {                       /* quay lại một nhà ĐÃ dọn: bây giờ nó là ô trống */
      var q = daDon[r.int(daDon.length)];
      if (tt.cur + Math.abs(q[0] - tt.Y) + Math.abs(q[1] - tt.X) <= 720) return q;
    }
    for (var lan = 0; lan < 40; lan++) {
      var y = tt.Y + r.khoang(-12, 12), x = tt.X + r.khoang(-12, 12);
      if (y < 0 || x < 0 || y > 99 || x > 99 || (y === tt.Y && x === tt.X)) continue;
      if (tt.loai(y, x) === 0 && tt.cur + Math.abs(y - tt.Y) + Math.abs(x - tt.X) <= 720) return [y, x];
    }
    return null;
  }
  function sinhMotTest(r, loai, chung, ep) {              /* ep ≥ 0: ép kiểu vi phạm (0–3 ra ngoài bản đồ theo 4 cách, 4 đi quá xa, 5 dọn không kịp) để mọi kiểu đều có mặt */
    var cy = r.khoang(2, 97), cx = r.khoang(2, 97), n = loai === "qua-ngay" ? r.khoang(34, 46) : r.khoang(24, 38), nha = [], act = [], daDon = [], i;
    function kep(v) { return Math.max(0, Math.min(99, v)); }                                  /* cụm nhà có thể sát mép bản đồ */
    for (i = 0; i < n; i++) nha.push([kep(cy + r.khoang(-10, 10)), kep(cx + r.khoang(-10, 10)), r.khoang(1, 6)]);
    if (r.int(2)) { var q = nha[r.int(n)]; nha.push([q[0], q[1], r.khoang(1, 6)]); }          /* ô trùng: ghi sau đè ghi trước */
    var y0 = kep(cy + r.khoang(-10, 10)), x0 = kep(cx + r.khoang(-10, 10));
    if (r.int(4) === 0) { var h0 = nha[r.int(nha.length)]; y0 = h0[0]; x0 = h0[1]; }          /* xuất phát trúng nhà */
    var tt = new TT(nha, y0, x0, chung);
    function di(y, x) { var truoc = tt.loai(y, x); act.push(["M", y, x]); tt.di(y, x); if (truoc > 0 && !tt.vp) daDon.push([y, x]); }
    function ngay() { act.push(["D"]); tt.sangNgay(); }
    function lamNgay(choPhepRong) {
      if (tt.loai(tt.Y, tt.X) > 0 && r.int(2)) di(tt.Y, tt.X);                               /* nhà ngay chỗ đang đứng: tốn 0 phút đi */
      for (var b = 0; b < 14; b++) {
        var ds = nhaKhaThi(tt, nha);
        if (!ds.length) break;
        if (choPhepRong && tt.cur > 350 && r.int(100) < 22) { var o = oTrong(tt, r, daDon); if (o) { di(o[0], o[1]); continue; } }   /* đi rỗng giữa ngày */
        var c = ds[r.int(Math.min(3, ds.length))]; di(c[0], c[1]);
      }
    }

    if (loai === "thuong") {
      var soNgay = r.khoang(1, 3);
      for (var d = 0; d < soNgay; d++) {
        lamNgay(true);
        if (d < soNgay - 1) ngay();
        else if (r.int(2)) { var o2 = oTrong(tt, r, daDon); if (o2) di(o2[0], o2[1]); }               /* đi rỗng SAU lần dọn cuối: miễn phí */
      }
    } else if (loai === "qua-ngay") {
      var soD = ep >= 0 ? [30, 31, 29, 30][ep] : [28, 29, 30, 30, 30, 31, 32][r.int(7)];   /* ép: gặp đủ cả 30 lần (hợp lệ) lẫn 31 lần (vi phạm) */
      for (var k = 0; k < soD; k++) {
        var sm = r.int(3);
        for (var b2 = 0; b2 < sm; b2++) { var ds2 = nhaKhaThi(tt, nha); if (!ds2.length) break; var c2 = ds2[r.int(Math.min(3, ds2.length))]; di(c2[0], c2[1]); }
        ngay();
      }
    } else {                                                                                  /* vi-pham */
      var soN = r.khoang(1, 2);
      for (var e = 0; e < soN; e++) { lamNgay(true); if (e < soN - 1) ngay(); }
      var kieu = ep >= 0 ? [0, 0, 0, 0, 2, 3][ep] : r.int(5), xong = false, y, x;               /* 0–1: ra ngoài bản đồ; 2: đi quá xa; 3–4: dọn không kịp */
      if (kieu >= 3) {                                                                       /* đáp xuống nhà: đi tới được nhưng dọn không kịp */
        var ts = [];
        nha.forEach(function (h) { var th = tt.thu(h[0], h[1]); if (tt.loai(h[0], h[1]) > 0 && tt.cur + th.d <= 720 && !th.ok) ts.push(h); });
        if (ts.length) { var hh = ts[r.int(ts.length)]; act.push(["M", hh[0], hh[1]]); xong = true; }
      }
      if (!xong && kieu >= 2) {                                                               /* đi quá xa: vượt 720 ngay khi di chuyển */
        var xa = [[0, 0], [0, 99], [99, 0], [99, 99]][r.int(4)];
        if (tt.cur + Math.abs(xa[0] - tt.Y) + Math.abs(xa[1] - tt.X) > 720) { act.push(["M", xa[0], xa[1]]); xong = true; }
      }
      if (!xong) {                                                                            /* ra ngoài bản đồ */
        var ob = ep >= 0 && ep < 4 ? ep : r.int(4);
        if (ep >= 0 || r.int(2)) ngay();                                                      /* đầu ngày mới đồng hồ = 0: chỉ luật "ngoài bản đồ" mới gây vi phạm, không phải vượt 720 */
        y = tt.Y; x = tt.X;
        act.push(ob === 0 ? ["M", -1, x] : ob === 1 ? ["M", y, 100] : ob === 2 ? ["M", 100, x] : ["M", y, -1]);
      }
      var them = r.int(4);                                                                    /* lệnh sau vi phạm (sang ngày rồi dọn nhà): phải bị bỏ qua */
      if (them) {
        act.push(["D"]);
        var con = nha.filter(function (h) { return tt.loai(h[0], h[1]) > 0; });
        for (var z = 0; z < them && con.length; z++) { var hc = con[r.int(con.length)]; act.push(["M", hc[0], hc[1]]); }
      }
    }
    return { nha: nha, y0: y0, x0: x0, act: act };
  }

  TH.vande.dangKy("b21-bo-cham-p3", TH.vande.tuDapAn({
    sinh: function (seed, tham) {
      tham = tham || {};
      var r = TH.tienIch.rng(seed), kinds = tham.kinds || ["thuong", "thuong", "qua-ngay", "vi-pham"], T = tham.T || 4, tests = [], chung = { score: 0 };
      var iVP = kinds.indexOf("vi-pham") >= 0 ? seed % T : -1, iQN = kinds.indexOf("qua-ngay") >= 0 ? (seed + 1) % T : -1;   /* luôn có một test vi phạm và một test qua ngày, đủ mọi kiểu qua các seed */
      for (var i = 0; i < T; i++) {
        if (i === iVP) tests.push(sinhMotTest(r, "vi-pham", chung, seed % 6));
        else if (i === iQN) tests.push(sinhMotTest(r, "qua-ngay", chung, seed % 4));
        else tests.push(sinhMotTest(r, kinds[r.int(kinds.length)], chung, -1));
      }
      return { tests: tests };
    },
    viet: function (inst) {
      var o = inst.tests.length + "\n";
      inst.tests.forEach(function (tc) {
        o += tc.nha.length + " " + tc.y0 + " " + tc.x0 + " " + tc.act.length + "\n";
        tc.nha.forEach(function (h) { o += h[0] + " " + h[1] + " " + h[2] + "\n"; });
        tc.act.forEach(function (a) { o += (a[0] === "D" ? "D" : "M " + a[1] + " " + a[2]) + "\n"; });
      });
      return o;
    },
    giai: moPhong,
    saiSo: 0,
    dinhDang: {
      vao: "Dòng 1: `T` — số test case. Mỗi test case: dòng `N y0 x0 A` (số nhà, vị trí xuất phát, số lệnh); `N` dòng `y x m` (nhà loại `m` ở ô `(y, x)`; trùng ô thì dòng sau đè dòng trước); `A` dòng lệnh, mỗi dòng là `M y x` (gọi `move(y, x)`) hoặc `D` (gọi `nextDay()`).",
      ra: "Một dòng gồm `T + 1` số nguyên: `SCORE` tích luỹ **sau mỗi test case**, rồi số test case vi phạm."
    }
  }));

  /* ================= Định cỡ và cận trên P3 (§6.1, §7.2, §7.3) ================= */
  function canTren(cnt, tau) {
    var ord = [1, 2, 3, 4, 5, 6].sort(function (a, b) { return GIA[b] / (SPH[b] + tau) - GIA[a] / (SPH[a] + tau) || a - b; });
    var cap = 22320, v = 0;
    for (var k = 0; k < ord.length && cap > 0; k++) {
      var m = ord[k], chiPhi = SPH[m] + tau, lay = Math.min(cnt[m - 1], cap / chiPhi);
      v += lay * GIA[m]; cap -= lay * chiPhi;
    }
    return v + 31 * 48000;
  }
  function dinhCo(inst) {
    var tong = 0;
    for (var m = 1; m <= 6; m++) tong += inst.cnt[m - 1] * SPH[m];
    var ub = canTren(inst.cnt, inst.tau);
    return [tong, tong / 22320, ub, (ub / inst.B - 1) * 100];
  }
  TH.vande.dangKy("b21-can-tren-p3", TH.vande.tuDapAn({
    sinh: function (seed, tham) {
      tham = tham || {};
      var r = TH.tienIch.rng(seed), dsTau = tham.tau || [0, 7, 9.5, 25, 40];
      var n = r.khoang(tham.nMin || 60, tham.nMax || 393), cnt = [0, 0, 0, 0, 0, 0], i;
      for (i = 0; i < n; i++) cnt[r.int(6)]++;
      var tau = dsTau[r.int(dsTau.length)];
      var inst = { tau: tau, cnt: cnt, B: 1 };
      inst.B = Math.round(canTren(cnt, tau) * (0.9 + 0.08 * r()));              /* nghiệm cơ sở: thấp hơn cận trên 2–10 % */
      return inst;
    },
    viet: function (inst) { return inst.tau + "\n" + inst.cnt.join(" ") + "\n" + inst.B + "\n"; },
    giai: dinhCo,
    saiSo: 0.0051,
    dinhDang: {
      vao: "Dòng 1: `τ` (số thực, phút di chuyển phân bổ cho mỗi nhà). Dòng 2: sáu số nguyên `c₁ … c₆` — số ngôi nhà phân biệt của từng loại máy. Dòng 3: `B` — điểm của nghiệm cơ sở.",
      ra: "Bốn số: `tong` (số nguyên), `baoHoa` (≥ 3 chữ số thập phân), `canTren` (≥ 2 chữ số thập phân), `duDia` (độ hở, %, ≥ 2 chữ số thập phân)."
    }
  }));

  TH.dangKy({
    id: "bai-21-mo-xe-de-thi",

    tomTat: [
      "Quan hệ giữa **đề bài** và **mã chấm** là quan hệ giữa thư mời và file tính lương: đề là lời giới thiệu, **mã chấm là luật**. Bước ① của quy trình là đọc mã chấm bằng giấy bút trước khi gõ code; “khai thác cấu trúc” là chơi đúng luật, không gian lận.",
      "Ngày **nối tiếp nhau**: `nextDay()` chỉ reset đồng hồ, giữ nguyên vị trí ⇒ không phải 30 tuyến từ một kho mà là **một đường đi mở** bị cắt thành các đoạn ≤ 720 phút, không có chi phí quay về kho.",
      "Thưởng OT **co rút**: các khoảng [start, end] lát kín trục thời gian nên tổng thưởng cả ngày = 200 × max(0, T_end − 480) (khi mọi bước đều đáp xuống ô có nhà); trần 240 × 200 = 48 000 điểm/ngày.",
      "Đi vào ô **trống** thì `move()` trả về trước khi cộng thưởng OT: đi rỗng giữa ngày sau phút 480 mất 200 điểm/phút, còn đi rỗng **sau lần dọn cuối** thì miễn phí (ô đích phải trống và vẫn ≤ 720 phút). Đáp xuống ô **có nhà** là bắt buộc dọn — vượt 720 là `SCORE = 0`.",
      "`gCurrentDay` khởi tạo 0 và `nextDay()` chặn ở `>= 30` ⇒ gọi được **30 lần = 31 ngày làm việc**, ngân sách 31 × 720 = 22 320 phút chứ không phải 21 600 (+3,3 % quỹ thời gian, đo được +3,27 % điểm).",
      "`SCORE` **không reset** giữa các test case, nên một test vi phạm xoá sạch điểm mọi test trước đó: an toàn quan trọng hơn vài phần trăm điểm. Nhà có thể trùng ô, vị trí xuất phát có thể trúng nhà (27/1 000 test).",
      "Định cỡ: dọn hết mọi nhà ≈ 293 × 135 = 39 555 ≈ 39 600 phút, gấp ~1,8 lần ngân sách ⇒ chỉ phục vụ ~155–160 nhà; một phút thừa đáng giá mờ λ ≈ 1 420 điểm, **không phải 200** (gấp 7 lần). Nghiệm cơ sở v2 (greedy 31 ngày) 31 718 184 so với cận tham chiếu (τ = 7) 33 943 173, độ hở ~7,0 % (so với v1 = 30 714 270 là 10,5 %)."
    ],

    trac: [
      {
        id: "q1", loai: "mot", doKho: 1, ref: "§1.1, §4.5",
        hoi: "Mã chấm khởi tạo `gCurrentDay = 0` và `nextDay()` bắt đầu bằng `if (gCurrentDay >= 30) { SCORE = 0; return; }`. Bạn gọi được `nextDay()` tối đa bao nhiêu lần mà SCORE không bị xoá, và nhờ đó có bao nhiêu ngày làm việc?",
        chon: [
          "29 lần, 30 ngày làm việc",
          "30 lần, 30 ngày làm việc",
          "30 lần, 31 ngày làm việc",
          "31 lần, 32 ngày làm việc"
        ],
        dung: 2,
        giaiThich: "Lần gọi thứ k kiểm gCurrentDay = k − 1 rồi tăng lên k. Lần thứ 30 kiểm “29 >= 30?” — không, vẫn qua; lần thứ 31 kiểm “30 >= 30?” — có, SCORE = 0. Cộng ngày đang làm lúc chưa gọi lần nào: 1 + 30 = 31 ngày, vì move() không hề kiểm tra gCurrentDay. Đây là lỗi lệch một (off-by-one) và nó cho ngân sách 31 × 720 = 22 320 phút."
      },
      {
        id: "q2", loai: "so", doKho: 2, ref: "§1.2, §4.2", donVi: "(điểm)",
        hoi: "Đầu một ngày bạn đã làm tới phút 450. Bạn dọn nhà A (đi 30 phút, dọn 90 phút) rồi nhà B (đi 20 phút, dọn 120 phút); cả hai ô đều có nhà chưa dọn. Tổng thưởng làm thêm giờ (OT) của ngày đó là bao nhiêu điểm?",
        dapAn: 46000, saiSo: 0,
        giaiThich: "Nhà A kết thúc lúc 450 + 30 + 90 = 570; thưởng 200 × (570 − max(480, 450)) = 200 × 90 = 18 000. Nhà B bắt đầu từ 570, kết thúc 570 + 20 + 120 = 710 ≤ 720; thưởng 200 × (710 − 570) = 28 000. Tổng 46 000 = 200 × (710 − 480): hai đoạn lát kín nhau nên chỉ cần nhớ giờ kết thúc nhà cuối cùng."
      },
      {
        id: "q3", loai: "mot", doKho: 2, ref: "§4.3 (a)",
        hoi: "Giữa ngày, lúc phút 520, bạn buộc phải đi 15 phút qua một ô TRỐNG rồi mới tới nhà kế tiếp (đi thẳng cũng mất đúng ngần ấy phút di chuyển). So với đi thẳng, bước đi qua ô trống này làm bạn mất bao nhiêu điểm thưởng OT?",
        chon: [
          "0 điểm: di chuyển luôn miễn phí",
          "3 000 điểm: 15 phút đó không nằm trong khoảng nào được tính thưởng, mỗi phút 200 điểm",
          "21 300 điểm: 15 phút nhân giá mờ 1 420",
          "15 điểm: mỗi phút trừ 1 điểm"
        ],
        dung: 1,
        giaiThich: "Đi vào ô trống thì move() trả về trước dòng cộng thưởng OT. Khoảng [520, 535] không thuộc [start, end] của nhà nào (nhà kế tiếp có startMin = 535) nên mất 15 × 200 = 3 000 điểm thưởng. Giá mờ 1 420 là chi phí cơ hội của phút CHẾT (lẽ ra dọn thêm được), không phải thiệt hại trực tiếp của một bước đi cần thiết."
      },
      {
        id: "q4", loai: "mot", doKho: 2, ref: "§4.3 (b), §4.4",
        hoi: "Bạn vừa dọn xong nhà cuối của ngày lúc phút 650 và còn 70 phút. Muốn dùng khoảng này để tiến trước về nhà đầu tiên của ngày mai, điều nào đúng?",
        chon: [
          "Đi “ngang qua” chính nhà đầu tiên của ngày mai mà không dọn nó",
          "Đi tới một ô trống cách 90 phút: phần vượt 720 sẽ bị hệ thống bỏ qua",
          "Mọi di chuyển sau phút 650 đều bị trừ 200 điểm mỗi phút nên không nên đi",
          "Đi tới một ô TRỐNG trong tối đa 70 phút: không mất điểm và vị trí được giữ sang ngày mai"
        ],
        dung: 3,
        giaiThich: "Sau lần dọn cuối, di chuyển rỗng không sinh thưởng nhưng cũng không bị trừ gì, và vị trí không reset khi sang ngày — nên đi trước là cải tiến trội. Hai điều kiện sống còn: ô đích phải TRỐNG (đáp xuống ô có nhà là bắt buộc dọn, 650 + 70 + thời gian dọn sẽ vượt 720) và tổng vẫn ≤ 720 (đi 90 phút là vượt, SCORE = 0 chứ không “bỏ phần thừa”). Không có khoản trừ 200 điểm/phút cho đi rỗng sau lần dọn cuối."
      },
      {
        id: "q5", loai: "mot", doKho: 2, ref: "§4.4, §8 (bẫy ①)",
        hoi: "Lúc phút 650 bạn gọi `move()` tới một ô có nhà loại 3 chưa dọn, cách 10 phút. Chuyện gì xảy ra?",
        chon: [
          "Nhà không được dọn và SCORE giữ nguyên",
          "SCORE = 0 — kể cả điểm của các test case trước đó",
          "Bạn được trả tiền theo số phút kịp làm trước phút 720",
          "Hệ thống tự gọi nextDay() rồi dọn nốt vào ngày mai"
        ],
        dung: 1,
        giaiThich: "Đáp xuống ô có nhà là bắt buộc vệ sinh. Máy loại 3 cần 30 × 3 + 30 = 120 phút: 650 + 10 = 660 (còn ≤ 720) nhưng 660 + 120 = 780 > 720 ⇒ SCORE = 0. Không có “dọn một phần”, không có tự sang ngày, và vì SCORE tích luỹ xuyên test case nên điểm các test trước cũng mất."
      },
      {
        id: "q6", loai: "so", doKho: 2, ref: "§6.1", donVi: "(lần)",
        hoi: "Một test có 293 ngôi nhà phân biệt, loại máy phân bố đều trên 1…6 (trung bình mỗi nhà dọn 30 × 3,5 + 30 phút). Tổng thời gian dọn HẾT mọi nhà gấp bao nhiêu lần quỹ thời gian thật 22 320 phút? Làm tròn hai chữ số thập phân.",
        dapAn: 1.77, saiSo: 0.01,
        giaiThich: "Trung bình 30 × 3,5 + 30 = 135 phút/nhà ⇒ 293 × 135 = 39 555 phút; chia cho 22 320 ≈ 1,77 (bài làm tròn thành “gấp 1,8 lần”). Ràng buộc thời gian bão hoà hoàn toàn: chỉ phục vụ được khoảng 155–160 nhà nên bài toán là “chọn bỏ ai”, không phải “sắp xếp cho khéo”."
      },
      {
        id: "q7", loai: "mot", doKho: 3, ref: "§6.3",
        hoi: "Bài toán bão hoà. Một phút thời gian CHẾT cuối ngày (không dọn, cũng không dùng để đi tới chỗ dọn) đáng bao nhiêu điểm?",
        chon: [
          "Khoảng 1 420 điểm — chi phí cơ hội (giá mờ λ), gấp ~7 lần thưởng OT",
          "200 điểm — đúng bằng thưởng OT mỗi phút",
          "0 điểm — phút thừa không ảnh hưởng điểm",
          "Khoảng 1 600 điểm — giá/phút của máy loại 4"
        ],
        dung: 0,
        giaiThich: "Vì tổng nhu cầu gấp ~1,8 lần quỹ thời gian, phút nào bỏ trống cũng có thể lấp bằng việc dọn thêm, nên mất cả tiền công lẫn thưởng: giá mờ λ ≈ 1 420, gấp 1 420 / 200 = 7,1 lần trực giác “chỉ mất 200”. 200 là phần thưởng OT riêng lẻ; 1 600 là p/s tốt nhất của một loại máy chứ không phải giá trị của một phút trung bình đã trừ di chuyển."
      },
      {
        id: "q8", loai: "mot", doKho: 2, ref: "§4.7, §8 (bẫy ③)",
        hoi: "Bạn có hai bản nộp. Bản A có điểm trung bình cao hơn 0,5 % nhưng gặp một kiểu dữ liệu hiếm thì có thể vượt 720 phút. Bản B thấp hơn 0,5 % và chạy 1 000 test thử đều không vi phạm. Bạn chọn bản nào?",
        chon: [
          "Bản A: chênh 0,5 % là chắc chắn, còn dữ liệu hiếm thì hiếm",
          "Bản A, vì chấm tối đa 1 000 test nên xác suất gặp dữ liệu xấu rất thấp",
          "Bản B vì hai bản bằng nhau về kỳ vọng",
          "Bản B: SCORE tích luỹ xuyên test case nên một test vi phạm xoá sạch điểm mọi test trước, thiệt hại lớn hơn nhiều so với 0,5 %"
        ],
        dung: 3,
        giaiThich: "SCORE không reset giữa các test case: một vi phạm đưa SCORE về 0 và xoá điểm của mọi test trước đó (cỡ vài chục triệu điểm), nên kỳ vọng thiệt hại của dù chỉ một xác suất nhỏ cũng vượt xa 0,5 %. Hai bản không bằng nhau về kỳ vọng, và “chỉ 1 000 test” vẫn đủ để dữ liệu hiếm xuất hiện. An toàn quan trọng hơn vài phần trăm điểm."
      },
      {
        id: "q9", loai: "nhieu", doKho: 2, ref: "§4",
        hoi: "Những phát biểu nào về mã chấm của đề P3 là ĐÚNG?",
        chon: [
          "Khi sang ngày mới, vị trí người thợ được giữ nguyên nên không có chi phí quay về kho",
          "Đi qua ô trống giữa ngày sau phút 480 vẫn được cộng thưởng OT",
          "Gọi `nextDay()` đúng 30 lần vẫn không làm SCORE về 0",
          "Đáp xuống ô có nhà chưa dọn thì có thể chọn không dọn nếu hết giờ",
          "Số nhà phân biệt có thể ít hơn số nhà được sinh ra vì các ô có thể trùng nhau"
        ],
        dung: [0, 2, 4],
        giaiThich: "Đúng: nextDay() chỉ reset đồng hồ (Quan sát 1); 30 lần gọi vẫn hợp lệ (Quan sát 5); init() sinh toạ độ có lặp nên số nhà phân biệt nằm trong [196, 393] (Quan sát 6). Sai: đi vào ô trống thì move() trả về trước khi cộng OT (Quan sát 3), và đáp xuống ô có nhà là bắt buộc dọn — vượt 720 phút là SCORE = 0 (Quan sát 4), không có tuỳ chọn bỏ qua."
      },
      {
        id: "q10", loai: "mot", doKho: 2, ref: "§2",
        hoi: "Bạn tìm ra “31 ngày làm việc” từ mã chấm mà đề bài chỉ nói 30 ngày. Dùng nó có phải gian lận không?",
        chon: [
          "Là gian lận vì đề bài nói 30 ngày",
          "Chỉ hợp lệ nếu bạn sửa mã chấm cho khớp với đề",
          "Chỉ hợp lệ nếu bạn không nhắc tới nó trong báo cáo",
          "Không: bạn chỉ đọc kỹ luật rồi chơi đúng luật, không sửa mã chấm, không dùng lỗ hổng bảo mật, không đọc dữ liệu test; nên đặt sau một cờ biên dịch và ghi rõ trong báo cáo"
        ],
        dung: 3,
        giaiThich: "“Khai thác cấu trúc” là chơi đúng luật, kể cả những phần luật người viết đề có thể đã viết nhầm: mã chấm mới là luật. Gian lận mới là sửa mã chấm, dùng lỗ hổng bảo mật hay đọc dữ liệu test. Cách xử lý tử tế (Bài 20 §10.3, cờ USE_31_DAYS ở Bài 22): đặt sau một cờ biên dịch để tắt được, và ghi rõ trong báo cáo — chứ không giấu."
      }
    ],

    luan: [
      {
        id: "l1", doKho: 2, ref: "Bài tập 21.1, §3",
        hoi: "Đọc lại hàm `move` và `nextDay` ở §3. Hãy tìm **ít nhất một** quan sát cấu trúc không có trong danh sách bảy quan sát của §4, chỉ rõ dòng mã dẫn tới nó và nêu hệ quả thiết kế.",
        goiY: ["Chú ý dòng cuối của `move()`: `gMapInfo[gPosY][gPosX] = 0;` làm gì với một ngôi nhà đã dọn?", "Hai chốt `> 720` nằm ở đâu, và mỗi chốt kiểm điều gì?"],
        mau: "Có thể chọn một trong các quan sát sau:\n\n- **Nhà đã dọn trở thành ô trống.** Dòng `gMapInfo[gPosY][gPosX] = 0;` ở cuối `move()` xoá nhà sau khi dọn: đáp xuống lại ô đó không dọn gì và không thưởng OT, nên nó là điểm đáp *an toàn* cho di chuyển rỗng cuối ngày (Quan sát 3b). Bản v5 ở Bài 22 còn bảo thủ hơn mức cần: bỏ qua mọi ô từng có nhà.\n- **`move()` không hề kiểm tra `gCurrentDay`** — xác nhận Quan sát 5: chỉ `nextDay()` canh số ngày.\n- **Có hai chốt cứng `gCurMin > 720`**: một sau khi đi, một sau khi dọn. Thời gian đi cộng chung vào `gCurMin`, không có khoản nào riêng cho nó.\n- Theo đáp án, đọc `judge.cpp` đầy đủ còn thấy: `pseudo_rand()` là LCG hằng số Java nên đoán được nhưng **không được dùng** vì trái tinh thần đề; `gMapInfoBak` là bản sao đầy đủ ⇒ **thông tin hoàn hảo** ngay từ đầu (bài toán offline, tất định); `scoreSum` được khai báo mà không dùng trong `main`.",
        tieuChi: ["Nêu ít nhất một quan sát mới, không trùng với bảy quan sát của §4", "Chỉ rõ dòng hoặc đoạn mã làm nảy ra quan sát đó", "Nêu một hệ quả thiết kế hoặc một rủi ro cụ thể rút ra từ nó"]
      },
      {
        id: "l2", doKho: 2, ref: "M2, §5",
        hoi: "Hãy mô hình hoá P3 thành bộ ba (S, C, f) và chọn một cách biểu diễn lời giải. Giải thích vì sao ranh giới giữa các ngày có thể **suy ra** thay vì lưu.",
        goiY: ["Quan sát 1 (ngày nối tiếp) cho biết ràng buộc của một ngày bắt đầu từ đâu.", "Quan sát 2 cho biết thưởng OT của một ngày chỉ cần một con số nào."],
        mau: "- **S** (không gian lời giải): dãy có thứ tự các ngôi nhà phân biệt π = (h₁, …, h_k), cắt thành ≤ 31 đoạn liên tiếp, mỗi đoạn là một ngày.\n- **C** (ràng buộc cứng): mỗi nhà dọn tối đa một lần; mỗi ngày phục vụ các nhà h_a, …, h_b thì d(vị trí cuối ngày trước, h_a) + s_{h_a} + Σ_{i=a+1..b} (d(h_{i−1}, h_i) + s_{h_i}) ≤ 720, với vị trí **không** về kho; tối đa 31 ngày. Vi phạm bất kỳ ràng buộc nào ⇒ SCORE = 0.\n- **f** (mục tiêu, cực đại): Σ p_i + 200 · Σ_d max(0, T_end,d − 480), với T_end,d là giờ kết thúc lần dọn cuối của ngày d.\n- **Biểu diễn**: chuỗi phẳng — một dãy duy nhất `seq[]`, việc mô phỏng tự cắt dãy thành ngày (gặp nhà không còn vừa 720 phút thì sang ngày mới). Ranh giới ngày suy ra được vì các ngày nối tiếp nhau và không có chi phí quay về kho, nên lưu sẵn 31 danh sách riêng là thừa và dễ sinh nghiệm không hợp lệ.",
        tieuChi: ["Nêu đủ ba thành phần S, C, f; f gồm cả Σ p và thưởng OT", "Ràng buộc đúng: 720 phút/ngày, vị trí mang sang ngày sau, mỗi nhà một lần, tối đa 31 ngày", "Thưởng OT viết theo giờ kết thúc nhà cuối của từng ngày (dạng co rút)", "Giải thích chuỗi phẳng: ranh giới ngày suy ra khi mô phỏng"]
      },
      {
        id: "l3", doKho: 3, ref: "§6.3",
        hoi: "Trực giác nói mỗi phút thừa cuối ngày chỉ mất 200 điểm thưởng OT. Hãy giải thích vì sao thật ra nó đáng cỡ 1 420 điểm và hệ quả của điều đó với thuật toán.",
        goiY: ["Phút thừa ấy lẽ ra có thể dùng làm gì?", "Điều kiện nào của bài toán bảo đảm phút nào bỏ trống cũng lấp được?"],
        mau: "Phút thừa cuối ngày không dọn và cũng không dùng để tiến tới chỗ dọn nên **không sinh điểm**: mất cả tiền công mà phút đó lẽ ra kiếm được chứ không chỉ 200 điểm thưởng OT.\n\nĐiều kiện để nói vậy là bài toán **bão hoà**: dọn hết mọi nhà cần ≈ 39 600 phút so với ngân sách 22 320 (gấp ~1,8 lần), nên mọi phút bỏ trống đều có thể lấp bằng việc dọn thêm. Chi phí cơ hội ấy là **giá mờ λ ≈ 1 420 điểm/phút** (cùng bậc với giá/phút trung bình ≈ 1 520 của việc dọn nhà), gấp 1 420 / 200 ≈ **7,1 lần** trực giác.\n\nHệ quả: triệt tiêu thời gian chết được *ước tính* là đòn bẩy số 1 (+4…6 %), lớn hơn chọn loại máy hay rút ngắn quãng đường, và thuật toán phải được xây quanh λ (Bài 6, Bài 22). Lưu ý con số +4…6 % là dự đoán trước khi đo, không phải kết quả đo: ablation ở Bài 22 §8.1 cho bỏ khung ngày thứ 31 mất 3,08 %, bỏ số hạng phạt thời gian chết mất 2,43 %; phát hiện “một phút chết đáng λ, không phải 200” vẫn đúng.",
        tieuChi: ["Giải thích phút thừa lẽ ra dùng để dọn nhà nên mất tiền công, không chỉ 200", "Nhắc bài toán bão hoà (gấp ~1,8 lần ngân sách) là điều kiện để phút nào bỏ trống cũng lấp được", "Nêu λ ≈ 1 420 và tỉ lệ ≈ 7 lần so với trực giác", "Nêu hệ quả: thời gian chết là đòn bẩy số 1 theo ước tính trước khi đo (không phải kết quả đo), thuật toán xây quanh λ"]
      },
      {
        id: "l4", doKho: 2, ref: "Bài tập 21.2, §6.1, §7",
        hoi: "Tính hệ số bão hoà cho một test điển hình (293 nhà, mỗi nhà dọn trung bình 135 phút) và độ hở của nghiệm cơ sở v2 (greedy 31 ngày) 31 718 184 so với cận tham chiếu (τ = 7) 33 943 173. Từ đó kết luận nên đầu tư vào đâu.",
        goiY: ["Hệ số bão hoà = tổng thời gian dọn hết / 22 320.", "Độ hở = cận trên / nghiệm − 1; bảng Bài 18 gắn mỗi khoảng độ hở với một kết luận."],
        mau: "- Tổng thời gian dọn hết ≈ 293 × 135 = 39 555 phút ⇒ 39 555 / 22 320 ≈ **1,77** lần ngân sách ⇒ chỉ phục vụ được ~155–160 nhà (~54 %). Ràng buộc thời gian bão hoà hoàn toàn.\n- Độ hở = 33 943 173 / 31 718 184 − 1 ≈ **7,0 %** (so với v1 = 30 714 270 là 10,5 %; cả hai cùng nằm trong khoảng 5–15 %).\n- Theo bảng Bài 18, độ hở 5–15 % nghĩa là *thiếu tìm kiếm* chứ chưa chạm trần ⇒ đầu tư vào Phần 3–4 (beam search, local search) **và** vào đòn bẩy số 1 (triệt tiêu thời gian chết). Lưu ý chỉ cận τ = 0 (35 571 464, bỏ hẳn di chuyển) là cận trên chứng minh được, lỏng hơn nhiều và cho độ hở ~12 %; τ = 7 (di chuyển cỡ TSP-Manhattan) chặt hơn nhưng chỉ là cận tham chiếu (Bài 18 §3.3), đúng nếu τ thật sự là cận dưới của số phút di chuyển trung bình mỗi nhà.",
        tieuChi: ["Tính đúng hệ số bão hoà ≈ 1,77 và nêu ý nghĩa: ràng buộc thời gian chi phối", "Tính đúng độ hở ≈ 7,0 % (cận trên / nghiệm − 1)", "Kết luận độ hở 5–15 % là thiếu tìm kiếm và nêu hướng đầu tư cụ thể"]
      }
    ],

    lab: [
      {
        id: "bo-cham-p3",
        ten: "Viết lại bộ chấm P3 — cờ vi phạm phải bằng 0",
        doKho: 2,
        ref: "§3, §4, §8, §9",
        de: "Bước ① là **đọc mã chấm**; lab này bắt bạn làm nốt: **viết lại bộ chấm** để mỗi quan sát ở §4 thành thứ bạn chạy được — đúng “bộ chấm cục bộ có cờ vi phạm” ở §9.\n\n" +
            "Mã chấm của đề (rút gọn từ §3):\n\n" +
            "```cpp\nvoid move(int mY, int mX) {\n  if (mY < 0 || mX < 0 || mY >= 100 || mX >= 100) { SCORE = 0; return; }\n  int startMin = gCurMin;\n  gCurMin += ABS(mY - gPosY) + ABS(mX - gPosX);\n  if (gCurMin > 720) { SCORE = 0; return; }\n  gPosY = mY; gPosX = mX;\n  if (gMapInfo[gPosY][gPosX] == 0) return;\n  gCurMin += gMapInfo[gPosY][gPosX] * 30 + 30;\n  if (gCurMin > 720) { SCORE = 0; return; }\n  SCORE += gPrice[gMapInfo[gPosY][gPosX]];\n  if (gCurMin > 480) SCORE += (gCurMin - MAX(480, startMin)) * 200;\n  gMapInfo[gPosY][gPosX] = 0;\n}\nvoid nextDay() {\n  if (gCurrentDay >= 30) { SCORE = 0; return; }\n  gCurrentDay++;  gCurMin = 0;\n}\n```\n\n" +
            "`gPrice[1..6]` = 80 000, 140 000, 180 000, 240 000, 250 000, 300 000. `gMapInfo[y][x]` là loại máy ở ô (0 = trống); các nhà được ghi lần lượt vào bản đồ nên **dòng sau đè dòng trước** khi trùng ô. Đầu mỗi test case `gCurrentDay = 0`, `gCurMin = 0`, vị trí là vị trí xuất phát; **`SCORE` không bị reset giữa các test case**.\n\n" +
            "Nhiệm vụ: đọc `T` test case, mỗi cái là danh sách nhà, vị trí xuất phát và một dãy lệnh (`M y x` = gọi `move(y, x)`, `D` = gọi `nextDay()`); chạy đúng như mã chấm, in `SCORE` tích luỹ **sau mỗi test case**, rồi số test case vi phạm.\n\n" +
            "*Quy ước của lab* (mã thật không nói gì thêm): ngay khi một lệnh làm `SCORE = 0`, test case đó là **vi phạm** và các lệnh còn lại của nó bị bỏ qua; SCORE đã về 0 (điểm các test trước bị xoá sạch) và các test case sau vẫn chạy tiếp, cộng dồn từ 0.\n\n" +
            "**Mức đạt:** đúng trên mọi test. Hãy thử các biến thể: *chỉ ngày thường* để kiểm thưởng OT và đi rỗng; *qua ngày* để kiểm 30 hay 31 lần `nextDay()`; *vi phạm* để thấy một test xoá điểm các test trước. Suy ngẫm: nếu bộ chấm của bạn cho cùng kết quả với mã thật trên mọi lệnh, bạn có thể thay đổi giải pháp mà không sợ `violations ≠ 0`?",
        vanDe: "b21-bo-cham-p3",
        bienThe: [
          { ten: "Tổng hợp: thường + qua ngày + vi phạm", tham: { T: 5, kinds: ["thuong", "thuong", "thuong", "thuong", "qua-ngay", "vi-pham"] } },
          { ten: "Chỉ ngày thường (thưởng OT, đi rỗng)", tham: { T: 3, kinds: ["thuong"] } },
          { ten: "Qua ngày: 30 hay 31 lần nextDay()?", tham: { T: 3, kinds: ["qua-ngay"] } },
          { ten: "Vi phạm xoá sạch điểm các test trước", tham: { T: 4, kinds: ["thuong", "thuong", "vi-pham"] } }
        ],
        soTest: 8,
        gioiHanMs: 1500,
        muc: [],
        khoiDau: {
          js: String.raw`// Đầu vào: T; rồi T test case. Mỗi test case: "N y0 x0 A"; N dòng "y x m"; A dòng lệnh "M y x" hoặc "D".
// Đầu ra : T số (SCORE tích luỹ sau mỗi test case) rồi 1 số (số test case vi phạm), trên một dòng.
const tok = readInput().split(/\s+/).filter(Boolean);
let p = 0;
const T = +tok[p++];
const GIA = [0, 80000, 140000, 180000, 240000, 250000, 300000];
let SCORE = 0, soViPham = 0;
const ketQua = [];
for (let tc = 0; tc < T; tc++) {
  const N = +tok[p++], y0 = +tok[p++], x0 = +tok[p++], A = +tok[p++];
  const mapInfo = Array.from({ length: 100 }, () => new Array(100).fill(0));
  for (let i = 0; i < N; i++) { const y = +tok[p++], x = +tok[p++], m = +tok[p++]; mapInfo[y][x] = m; }   // dòng sau đè dòng trước
  let posY = y0, posX = x0, curMin = 0, curDay = 0, viPham = false;
  for (let k = 0; k < A; k++) {
    const lenh = tok[p++];
    const y = lenh === "M" ? +tok[p++] : 0, x = lenh === "M" ? +tok[p++] : 0;
    if (viPham) continue;                      // bỏ qua phần còn lại của test case đã vi phạm
    // TODO: lenh === "D" → mô phỏng nextDay();   lenh === "M" → mô phỏng move(y, x).
    //       Khi mã chấm đặt SCORE = 0: đặt viPham = true (và SCORE = 0).
  }
  if (viPham) soViPham++;
  ketQua.push(SCORE);
}
print(ketQua.join(" ") + " " + soViPham);
`,
          cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int main() {
    int T;
    scanf("%d", &T);
    const long long GIA[7] = {0, 80000, 140000, 180000, 240000, 250000, 300000};
    long long SCORE = 0;
    int soViPham = 0;
    vector<long long> ketQua;
    for (int tc = 0; tc < T; tc++) {
        int N, y0, x0, A;
        scanf("%d %d %d %d", &N, &y0, &x0, &A);
        static int mapInfo[100][100];
        memset(mapInfo, 0, sizeof(mapInfo));
        for (int i = 0; i < N; i++) { int y, x, m; scanf("%d %d %d", &y, &x, &m); mapInfo[y][x] = m; }   // dòng sau đè dòng trước
        int posY = y0, posX = x0, curMin = 0, curDay = 0;
        bool viPham = false;
        for (int k = 0; k < A; k++) {
            char lenh[4];
            int y = 0, x = 0;
            scanf("%s", lenh);
            if (lenh[0] == 'M') scanf("%d %d", &y, &x);
            if (viPham) continue;                    // bỏ qua phần còn lại của test case đã vi phạm
            // TODO: lenh[0] == 'D' → mô phỏng nextDay();   lenh[0] == 'M' → mô phỏng move(y, x).
            //       Khi mã chấm đặt SCORE = 0: đặt viPham = true (và SCORE = 0).
        }
        if (viPham) soViPham++;
        ketQua.push_back(SCORE);
    }
    for (size_t i = 0; i < ketQua.size(); i++) printf("%lld ", ketQua[i]);
    printf("%d\n", soViPham);
    return 0;
}
`
        },
        loiGiai: {
          js: String.raw`const tok = readInput().split(/\s+/).filter(Boolean);
let p = 0;
const T = +tok[p++];
const GIA = [0, 80000, 140000, 180000, 240000, 250000, 300000];
let SCORE = 0, soViPham = 0;
const ketQua = [];
for (let tc = 0; tc < T; tc++) {
  const N = +tok[p++], y0 = +tok[p++], x0 = +tok[p++], A = +tok[p++];
  const mapInfo = Array.from({ length: 100 }, () => new Array(100).fill(0));
  for (let i = 0; i < N; i++) { const y = +tok[p++], x = +tok[p++], m = +tok[p++]; mapInfo[y][x] = m; }
  let posY = y0, posX = x0, curMin = 0, curDay = 0, viPham = false;
  for (let k = 0; k < A; k++) {
    const lenh = tok[p++];
    const y = lenh === "M" ? +tok[p++] : 0, x = lenh === "M" ? +tok[p++] : 0;
    if (viPham) continue;
    if (lenh === "D") {                                           // nextDay(): chỉ reset ĐỒNG HỒ, giữ nguyên vị trí
      if (curDay >= 30) { SCORE = 0; viPham = true; continue; }   // 30 lần gọi đầu vẫn hợp lệ ⇒ 31 ngày
      curDay++; curMin = 0;
      continue;
    }
    if (y < 0 || x < 0 || y >= 100 || x >= 100) { SCORE = 0; viPham = true; continue; }
    const startMin = curMin;
    curMin += Math.abs(y - posY) + Math.abs(x - posX);
    if (curMin > 720) { SCORE = 0; viPham = true; continue; }
    posY = y; posX = x;
    const m = mapInfo[y][x];
    if (m === 0) continue;                                        // ô trống: về TRƯỚC khi cộng thưởng OT
    curMin += m * 30 + 30;                                        // ô có nhà: bắt buộc dọn
    if (curMin > 720) { SCORE = 0; viPham = true; continue; }
    SCORE += GIA[m];
    if (curMin > 480) SCORE += (curMin - Math.max(480, startMin)) * 200;
    mapInfo[y][x] = 0;                                            // nhà đã dọn trở thành ô trống
  }
  if (viPham) soViPham++;
  ketQua.push(SCORE);
}
print(ketQua.join(" ") + " " + soViPham);
`,
          cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int main() {
    int T;
    scanf("%d", &T);
    const long long GIA[7] = {0, 80000, 140000, 180000, 240000, 250000, 300000};
    long long SCORE = 0;
    int soViPham = 0;
    vector<long long> ketQua;
    for (int tc = 0; tc < T; tc++) {
        int N, y0, x0, A;
        scanf("%d %d %d %d", &N, &y0, &x0, &A);
        static int mapInfo[100][100];
        memset(mapInfo, 0, sizeof(mapInfo));
        for (int i = 0; i < N; i++) { int y, x, m; scanf("%d %d %d", &y, &x, &m); mapInfo[y][x] = m; }
        int posY = y0, posX = x0, curMin = 0, curDay = 0;
        bool viPham = false;
        for (int k = 0; k < A; k++) {
            char lenh[4];
            int y = 0, x = 0;
            scanf("%s", lenh);
            if (lenh[0] == 'M') scanf("%d %d", &y, &x);
            if (viPham) continue;
            if (lenh[0] == 'D') {                                  // nextDay(): chỉ reset đồng hồ, giữ vị trí
                if (curDay >= 30) { SCORE = 0; viPham = true; continue; }
                curDay++; curMin = 0;
                continue;
            }
            if (y < 0 || x < 0 || y >= 100 || x >= 100) { SCORE = 0; viPham = true; continue; }
            int startMin = curMin;
            curMin += abs(y - posY) + abs(x - posX);
            if (curMin > 720) { SCORE = 0; viPham = true; continue; }
            posY = y; posX = x;
            int m = mapInfo[y][x];
            if (m == 0) continue;                                  // ô trống: về trước khi cộng thưởng OT
            curMin += m * 30 + 30;
            if (curMin > 720) { SCORE = 0; viPham = true; continue; }
            SCORE += GIA[m];
            if (curMin > 480) SCORE += (long long)(curMin - max(480, startMin)) * 200;
            mapInfo[y][x] = 0;
        }
        if (viPham) soViPham++;
        ketQua.push_back(SCORE);
    }
    for (size_t i = 0; i < ketQua.size(); i++) printf("%lld ", ketQua[i]);
    printf("%d\n", soViPham);
    return 0;
}
`
        },
        goiY: [
          "Dùng mảng 100 × 100 `mapInfo`; khi đọc nhà cứ gán `mapInfo[y][x] = m` — gán sau tự đè gán trước.",
          "`D` chỉ reset `curMin` và tăng `curDay`; **không** đụng tới `posY`, `posX`. Lệnh `D` thứ 31 là lệnh làm SCORE = 0 (kiểm `curDay >= 30` TRƯỚC khi tăng).",
          "Trong `move`, nhớ `startMin` trước khi cộng thời gian đi; ô trống thì return ngay sau khi cập nhật vị trí; chỉ sau khi dọn xong mới cộng giá và thưởng, rồi đặt ô về 0.",
          "Khi có vi phạm: SCORE = 0, đánh dấu test case vi phạm và bỏ qua mọi lệnh còn lại của nó — nhưng vẫn phải **đọc hết** các lệnh đó khỏi dữ liệu vào."
        ]
      },
      {
        id: "can-tren-p3",
        ten: "Định cỡ và cận trên P3 theo §6.1, §7.2",
        doKho: 2,
        ref: "Bài tập 21.2, §6.1, §7.2–7.3",
        de: "Bài tập 21.2: viết bộ tính **cận trên** cho P3. Kèm theo là hai con số định cỡ của §6.1 và §7.3.\n\n" +
            "Đầu vào: dòng 1 là `τ`; dòng 2 là sáu số `c₁ … c₆` — số ngôi nhà (phân biệt) của từng loại máy; dòng 3 là `B` — điểm của nghiệm cơ sở của bạn. Giá `p_m` = 80 000, 140 000, 180 000, 240 000, 250 000, 300 000 và thời gian dọn `s_m = 30·m + 30`; ngân sách thật là 31 × 720 = 22 320 phút.\n\n" +
            "In bốn số theo thứ tự:\n\n" +
            "1. `tong` = Σ c_m · s_m — số phút nếu dọn **hết** mọi nhà (số nguyên).\n" +
            "2. `baoHoa` = `tong` / 22 320 — bao nhiêu lần ngân sách (§6.1).\n" +
            "3. `canTren` — nới lỏng thành **cái túi phân số** (Dantzig): mỗi nhà loại m tốn `s_m + τ` phút của ngân sách 22 320 (τ là số phút di chuyển phân bổ cho mỗi nhà); xếp loại máy theo `p_m / (s_m + τ)` giảm dần, lấy trọn từng loại rồi **lấy một phần** loại cuối cho vừa; sau cùng cộng trần thưởng OT 31 × 48 000 = 1 488 000. Nếu mọi nhà đều lọt trong ngân sách thì lấy hết.\n" +
            "4. `duDia` = (`canTren` / `B` − 1) × 100 (%) — **độ hở** của nghiệm cơ sở (§7.3); tên biến vẫn là `duDia`.\n\n" +
            "**Mức đạt:** đúng trên mọi test. Hãy chạy ở τ = 0, 7, 9,5 (số liệu của §7.2) và để ý cận trên giảm ra sao; rồi thử *τ lớn*: thứ tự `p/(s+τ)` có còn giống thứ tự `p/s` không (Nhận xét 2 của đề: máy càng lớn càng chịu được chi phí di chuyển)? Với *ít nhà*, bài toán còn bão hoà không và `canTren` là gì?",
        vanDe: "b21-can-tren-p3",
        bienThe: [
          { ten: "Tổng hợp: τ ∈ {0; 7; 9,5; 25; 40}, 60–393 nhà", tham: {} },
          { ten: "Đề thật: τ ∈ {0; 7; 9,5}, 196–393 nhà", tham: { tau: [0, 7, 9.5], nMin: 196, nMax: 393 } },
          { ten: "τ lớn: thứ tự p/(s+τ) đổi", tham: { tau: [25, 40], nMin: 196, nMax: 393 } },
          { ten: "Ít nhà: chưa bão hoà", tham: { nMin: 40, nMax: 110 } }
        ],
        soTest: 8,
        gioiHanMs: 1000,
        muc: [],
        khoiDau: {
          js: String.raw`// Đầu vào: dòng 1 "tau"; dòng 2 sáu số c1..c6 (số nhà mỗi loại); dòng 3 "B" (điểm nghiệm cơ sở).
// Đầu ra : tong  baoHoa  canTren  duDia   (bốn số, cách nhau khoảng trắng)
const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const tau = t[0], c = t.slice(1, 7), B = t[7];
const gia = [80000, 140000, 180000, 240000, 250000, 300000];
const sph = [60, 90, 120, 150, 180, 210];          // s_m = 30·m + 30

// TODO 1: tong = Σ c[m] · sph[m]; baoHoa = tong / 22320
// TODO 2: canTren — cái túi phân số: sắp loại máy theo gia / (sph + tau) giảm dần,
//         lấy trọn từng loại (mỗi nhà tốn sph + tau phút của 22320), lấy MỘT PHẦN loại cuối; cộng 31 · 48000
// TODO 3: duDia = (canTren / B − 1) · 100

print("TODO");
`,
          cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int main() {
    double tau;
    long long c[6], B;
    scanf("%lf", &tau);
    for (int i = 0; i < 6; i++) scanf("%lld", &c[i]);
    scanf("%lld", &B);
    const double gia[6] = {80000, 140000, 180000, 240000, 250000, 300000};
    const double sph[6] = {60, 90, 120, 150, 180, 210};      // s_m = 30·m + 30

    // TODO 1: tong = tổng c[m] * sph[m]; baoHoa = tong / 22320
    // TODO 2: canTren — cái túi phân số: sắp loại máy theo gia / (sph + tau) giảm dần,
    //         lấy trọn từng loại (mỗi nhà tốn sph + tau phút của 22320), lấy MỘT PHẦN loại cuối; cộng 31 * 48000
    // TODO 3: duDia = (canTren / B - 1) * 100

    printf("TODO\n");
    return 0;
}
`
        },
        loiGiai: {
          js: String.raw`const t = readInput().split(/\s+/).filter(Boolean).map(Number);
const tau = t[0], c = t.slice(1, 7), B = t[7];
const gia = [80000, 140000, 180000, 240000, 250000, 300000];
const sph = [60, 90, 120, 150, 180, 210];

let tong = 0;
for (let m = 0; m < 6; m++) tong += c[m] * sph[m];
const baoHoa = tong / 22320;

// cái túi phân số: xếp theo p / (s + τ) giảm dần
const thuTu = [0, 1, 2, 3, 4, 5].sort((a, b) => gia[b] / (sph[b] + tau) - gia[a] / (sph[a] + tau) || a - b);
let con = 22320, canTren = 0;
for (const m of thuTu) {
  if (con <= 0) break;
  const chiPhi = sph[m] + tau;
  const lay = Math.min(c[m], con / chiPhi);        // lấy trọn, hoặc MỘT PHẦN nếu không đủ chỗ
  canTren += lay * gia[m];
  con -= lay * chiPhi;
}
canTren += 31 * 48000;                              // trần thưởng OT: 31 ngày × 240 phút × 200 điểm
const duDia = (canTren / B - 1) * 100;

print([tong, baoHoa.toFixed(4), canTren.toFixed(3), duDia.toFixed(4)].join(" "));
`,
          cpp: String.raw`#include <bits/stdc++.h>
using namespace std;

int main() {
    double tau;
    long long c[6], B;
    scanf("%lf", &tau);
    for (int i = 0; i < 6; i++) scanf("%lld", &c[i]);
    scanf("%lld", &B);
    const double gia[6] = {80000, 140000, 180000, 240000, 250000, 300000};
    const double sph[6] = {60, 90, 120, 150, 180, 210};

    long long tong = 0;
    for (int m = 0; m < 6; m++) tong += c[m] * (long long)sph[m];
    double baoHoa = tong / 22320.0;

    int thuTu[6] = {0, 1, 2, 3, 4, 5};
    sort(thuTu, thuTu + 6, [&](int a, int b) {
        double ra = gia[a] / (sph[a] + tau), rb = gia[b] / (sph[b] + tau);
        if (ra != rb) return ra > rb;
        return a < b;
    });
    double con = 22320, canTren = 0;
    for (int k = 0; k < 6; k++) {
        int m = thuTu[k];
        if (con <= 0) break;
        double chiPhi = sph[m] + tau;
        double lay = min((double)c[m], con / chiPhi);        // lấy trọn, hoặc một phần
        canTren += lay * gia[m];
        con -= lay * chiPhi;
    }
    canTren += 31 * 48000.0;
    double duDia = (canTren / B - 1) * 100;

    printf("%lld %.4f %.3f %.4f\n", tong, baoHoa, canTren, duDia);
    return 0;
}
`
        },
        goiY: [
          "Ba chuyện nhỏ: `tong` dùng `s_m` (không cộng τ); ngân sách dùng `s_m + τ`; thứ tự xếp dùng `p_m / (s_m + τ)`.",
          "Lấy `lay = min(c[m], con / chiPhi)` rồi trừ `lay · chiPhi` khỏi `con` — một công thức xử lý cả lấy trọn lẫn lấy một phần.",
          "Cận trên luôn cộng 31 × 48 000 = 1 488 000, kể cả khi mọi nhà đều lọt trong ngân sách."
        ]
      }
    ]
  });
})();
