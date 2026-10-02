/* ==========================================================================
   KHOÁ LUYỆN THI OPIc — logic thuần, KHÔNG đụng DOM.

   Mọi thứ tính toán được mà không cần trình duyệt nằm ở đây: bỏ dấu tiếng
   Việt, các chế độ che script (gợi ý / chữ cái đầu / ẩn), lặp lại ngắt quãng
   (Leitner), sinh đề thi thử đúng cấu trúc 15 câu, tìm kiếm, thống kê.

   Tệp này nạp được cả trong trình duyệt (window.OPICL) lẫn Node
   (module.exports) — kiem-nhanh.js chạy nó không cần DOM.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OPICL = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";
var L = {};

/* ---------- 1. Chuỗi ------------------------------------------------- */
/* Bỏ dấu bằng bảng tra 1 ký tự → 1 ký tự, GIỮ NGUYÊN độ dài chuỗi, nên vị trí
   khớp trên bản bỏ dấu dùng thẳng được cho bản gốc khi cắt trích đoạn. */
var BANG = (function () {
  var m = {};
  var nhom = [
    ["a", "áàảãạăắằẳẵặâấầẩẫậ"], ["e", "éèẻẽẹêếềểễệ"], ["i", "íìỉĩị"],
    ["o", "óòỏõọôốồổỗộơớờởỡợ"], ["u", "úùủũụưứừửữự"], ["y", "ýỳỷỹỵ"], ["d", "đ"]
  ];
  nhom.forEach(function (n) {
    n[1].split("").forEach(function (c) {
      m[c] = n[0]; m[c.toUpperCase()] = n[0].toUpperCase();
    });
  });
  return m;
})();
L.boDau = function (s) {
  var out = "", i, c;
  s = String(s == null ? "" : s);
  for (i = 0; i < s.length; i++) { c = s[i]; out += BANG[c] || c; }
  return out;
};
L.chuanHoa = function (s) { return L.boDau(s).toLowerCase(); };

L.laChiDan = function (cau) { return /^\(.*\)$/.test(String(cau || "").trim()); };

L.soTu = function (text) {
  var m = String(text || "").match(/[A-Za-zÀ-ỹ0-9'’-]+/g);
  return m ? m.length : 0;
};
/* ~130 từ / phút là tốc độ nói bình thường trong phòng thi */
L.uocGiay = function (tu) { return Math.round(tu / 130 * 60); };
L.dinhDangGiay = function (s) {
  s = Math.max(0, Math.round(s));
  var m = Math.floor(s / 60), r = s % 60;
  return m + ":" + (r < 10 ? "0" : "") + r;
};
L.phutChu = function (phut) {           /* 1 → "1′" · 1.5 → "1′30″" · 2 → "2′" */
  var m = Math.floor(phut), s = Math.round((phut - m) * 60);
  return m + "′" + (s ? s + "″" : "");
};

/* ---------- 2. Bốn chế độ nhìn script ---------------------------------
   Mỗi chế độ nhận MỘT câu và trả về mảng mảnh {t: text, hid: bool}. Giao diện
   chỉ việc bọc <span>. Tách ra như vậy để kiểm thử được bằng Node. */
function tachTu(cau) { return String(cau || "").split(/(\s+)/); }   /* giữ cả khoảng trắng */

/* Gợi ý: n từ đầu hiện, phần còn lại che. */
L.goiY = function (cau, n) {
  n = n || 3;
  var parts = tachTu(cau), out = [], dem = 0;
  parts.forEach(function (p) {
    if (!p) return;
    if (/^\s+$/.test(p)) { out.push({ t: p, hid: false }); return; }
    if (dem < n) { out.push({ t: p, hid: false }); dem++; }
    else out.push({ t: p, hid: true });
  });
  return out;
};
/* Chữ cái đầu: mỗi từ chỉ còn chữ đầu + gạch chân theo độ dài (tối đa 5). */
L.chuCaiDau = function (cau) {
  var parts = tachTu(cau), out = [];
  parts.forEach(function (p) {
    if (!p) return;
    if (/^\s+$/.test(p)) { out.push({ t: p, hid: false }); return; }
    var m = p.match(/^([^A-Za-zÀ-ỹ0-9]*)([A-Za-zÀ-ỹ0-9][A-Za-zÀ-ỹ0-9'’-]*)(.*)$/);
    if (!m) { out.push({ t: p, hid: false }); return; }
    var loi = m[2];
    var gach = loi.length > 1 ? new Array(Math.min(loi.length - 1, 5) + 1).join("_") : "";
    out.push({ t: m[1] + loi[0] + gach + m[3], hid: false, cue: true });
  });
  return out;
};
/* Ẩn hết: chỉ còn số từ. */
L.anHet = function (cau) {
  return [{ t: "▁▁▁▁▁  (" + L.soTu(cau) + " từ)", hid: false, blank: true }];
};
/* Điền khuyết: che mỗi từ thứ k, bắt đầu từ vị trí phụ thuộc hạt giống. */
L.cloze = function (cau, k, hat) {
  k = k || 3;
  var parts = tachTu(cau), out = [], i = (hat || 0) % k, dem = 0;
  parts.forEach(function (p) {
    if (!p) return;
    if (/^\s+$/.test(p)) { out.push({ t: p, hid: false }); return; }
    var hid = (dem % k) === i && /[A-Za-zÀ-ỹ]/.test(p);
    out.push({ t: p, hid: hid }); dem++;
  });
  return out;
};
L.CHE_DO = {
  "day-du":      { ten: "Đầy đủ",       lam: function (c) { return [{ t: c, hid: false }]; } },
  "goi-y":       { ten: "Gợi ý",        lam: function (c) { return L.goiY(c, 3); } },
  "chu-cai-dau": { ten: "Chữ cái đầu",  lam: function (c) { return L.chuCaiDau(c); } },
  "dien-khuyet": { ten: "Điền khuyết",  lam: function (c, i) { return L.cloze(c, 3, i); } },
  "an-het":      { ten: "Ẩn hết",       lam: function (c) { return L.anHet(c); } }
};

/* ---------- 3. Lặp lại ngắt quãng (Leitner) ---------------------------
   Trạng thái một thẻ: {s, hop, den, lan, luc}
     s   0 chưa học · 1 đang học · 2 đã thuộc
     hop hộp Leitner 0..5 — quyết định bao lâu nữa thẻ quay lại
     den mốc thời gian (ms) thẻ đến hạn
     lan số lần đã luyện · luc lần cuối (ms)
   Chấm: 0 chưa thuộc → về hộp 0, mai gặp lại
         1 tạm được   → giữ hộp, mai gặp lại
         2 thuộc      → lên một hộp, gặp lại sau 1·3·7·14·30 ngày           */
L.HOP_NGAY = [0, 1, 3, 7, 14, 30];
var NGAY = 86400000;
L.cham = function (tt, ket, now) {
  now = now || Date.now();
  tt = tt ? JSON.parse(JSON.stringify(tt)) : { s: 0, hop: 0, den: 0, lan: 0, luc: 0 };
  tt.hop = tt.hop || 0;
  if (ket === 0) { tt.hop = 0; tt.den = now + 1 * NGAY; tt.s = 1; }
  else if (ket === 1) { tt.den = now + 1 * NGAY; tt.s = 1; }
  else { tt.hop = Math.min(tt.hop + 1, L.HOP_NGAY.length - 1); tt.den = now + L.HOP_NGAY[tt.hop] * NGAY; tt.s = 2; }
  tt.lan = (tt.lan || 0) + 1;
  tt.luc = now;
  return tt;
};
L.denHan = function (tt, now) {
  now = now || Date.now();
  if (!tt || !tt.s) return false;          /* chưa học thì không "đến hạn" — là thẻ mới */
  return (tt.den || 0) <= now;
};

/* ---------- 4. Ngẫu nhiên tái lập được --------------------------------- */
L.rng = function (hat) {
  var a = (hat >>> 0) || 0x9e3779b9;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
};
function tron(arr, rand) {
  var a = arr.slice(), i, j, t;
  for (i = a.length - 1; i > 0; i--) { j = Math.floor(rand() * (i + 1)); t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
L.tron = tron;

/* ---------- 5. Sinh đề thi thử 15 câu ----------------------------------
   Đúng cấu trúc trong hướng dẫn:
     1        giới thiệu bản thân
     2–4      chủ đề 1: miêu tả/thói quen → so sánh/thói quen → kinh nghiệm
     5–7      chủ đề 2
     8–10     chủ đề 3
     11–12    diễn (role-play)
     13       giải quyết tình huống
     14–15    ý kiến / so sánh — cùng một chủ đề
   opt: {bo: "A"|"B"|"AB", uuTienToiDa: 1|2|3, chuDe: [id...] | null, hat: number} */
L.sinhDe = function (D, opt) {
  opt = opt || {};
  var rand = L.rng(opt.hat != null ? opt.hat : (Date.now() & 0xffffffff));
  var bo = opt.bo || "AB";
  var uuMax = opt.uuTienToiDa || 2;
  var uuTien = {};
  D.chuDe.forEach(function (c) { uuTien[c.id] = c.uuTien; });
  var chon = opt.chuDe && opt.chuDe.length ? opt.chuDe : null;

  function hopBo(q) { return bo === "AB" || q.bo === bo; }
  var tatCa = D.cauHoi;
  var pool = tatCa.filter(function (q) {
    return hopBo(q) && (chon ? chon.indexOf(q.chuDe) >= 0 : (uuTien[q.chuDe] || 3) <= uuMax);
  });
  var dung = {};
  function lay(ds) {                       /* lấy một câu chưa dùng, ngẫu nhiên */
    var ok = ds.filter(function (q) { return !dung[q.id]; });
    if (!ok.length) return null;
    var q = ok[Math.floor(rand() * ok.length)];
    dung[q.id] = true;
    return q;
  }
  function theoDang(ds, dangs) {
    for (var i = 0; i < dangs.length; i++) {
      var q = lay(ds.filter(function (x) { return x.dang === dangs[i]; }));
      if (q) return q;
    }
    return null;
  }
  var de = [];
  /* 1 — giới thiệu: ưu tiên đúng bộ, không có thì lấy bộ nào cũng được */
  var gt = theoDang(pool, ["gioi-thieu"]) || theoDang(tatCa, ["gioi-thieu"]);
  de.push({ q: gt, nhom: "Giới thiệu", so: 1 });

  /* 2–10 — ba chủ đề, mỗi chủ đề ba câu */
  var theoCd = {};
  pool.forEach(function (q) {
    if (q.dang === "gioi-thieu" || q.dang === "dien" || q.dang === "tinh-huong" || q.chuDe === "dien") return;
    (theoCd[q.chuDe] = theoCd[q.chuDe] || []).push(q);
  });
  var cds = Object.keys(theoCd).filter(function (k) { return theoCd[k].length >= 3; });
  cds = tron(cds, rand).slice(0, 3);
  /* thiếu chủ đề thì lấy thêm từ toàn kho */
  if (cds.length < 3) {
    var themCd = {};
    tatCa.forEach(function (q) {
      if (q.dang === "gioi-thieu" || q.dang === "dien" || q.dang === "tinh-huong" || q.chuDe === "dien") return;
      if (cds.indexOf(q.chuDe) >= 0) return;
      (themCd[q.chuDe] = themCd[q.chuDe] || []).push(q);
    });
    tron(Object.keys(themCd).filter(function (k) { return themCd[k].length >= 3; }), rand)
      .slice(0, 3 - cds.length).forEach(function (k) { cds.push(k); theoCd[k] = themCd[k]; });
  }
  var thuTu = [["mieu-ta", "thoi-quen", "y-kien"], ["so-sanh", "thoi-quen", "mieu-ta", "y-kien"], ["kinh-nghiem", "so-sanh", "y-kien", "mieu-ta", "thoi-quen"]];
  cds.forEach(function (cd, ci) {
    var ds = theoCd[cd];
    for (var k = 0; k < 3; k++) {
      var q = theoDang(ds, thuTu[k]) || lay(ds) || lay(pool) || lay(tatCa);
      de.push({ q: q, nhom: "Chủ đề " + (ci + 1), so: 2 + ci * 3 + k, chuDe: cd });
    }
  });
  /* 11–13 — diễn: thiếu trong bộ đã chọn thì lấy ở toàn kho (bộ B chỉ có 2 bài diễn) */
  var rp1 = theoDang(pool, ["dien"]) || theoDang(tatCa, ["dien"]);
  var rp2 = theoDang(pool, ["dien"]) || theoDang(tatCa, ["dien"]) || theoDang(tatCa, ["tinh-huong"]);
  var th  = theoDang(pool, ["tinh-huong"]) || theoDang(tatCa, ["tinh-huong"]) || theoDang(tatCa, ["dien"]);
  de.push({ q: rp1, nhom: "Diễn", so: 11 });
  de.push({ q: rp2, nhom: "Diễn", so: 12 });
  de.push({ q: th,  nhom: "Tình huống", so: 13 });
  /* 14–15 — ý kiến / so sánh, cố gắng cùng chủ đề: tìm trong phạm vi đã chọn
     trước, không có chủ đề nào đủ hai câu thì mới mở ra toàn kho. (Đừng gộp hai
     danh sách rồi đếm — pool nằm trong tatCa, một câu sẽ bị đếm hai lần.) */
  function ykTheoCd(ds) {
    var m = {};
    ds.forEach(function (q) {
      if ((q.dang === "y-kien" || q.dang === "so-sanh") && !dung[q.id]) (m[q.chuDe] = m[q.chuDe] || []).push(q);
    });
    return m;
  }
  var yk = ykTheoCd(pool);
  var cdDu = Object.keys(yk).filter(function (k) { return yk[k].length >= 2; });
  if (!cdDu.length) { yk = ykTheoCd(tatCa); cdDu = Object.keys(yk).filter(function (k) { return yk[k].length >= 2; }); }
  var cdYk = tron(cdDu, rand)[0];
  var ds14 = cdYk ? yk[cdYk] : tatCa;
  var q14 = theoDang(ds14, ["y-kien", "so-sanh"]) || lay(tatCa);
  var q15 = theoDang(ds14, ["so-sanh", "y-kien"]) || theoDang(tatCa, ["y-kien", "so-sanh"]) || lay(tatCa);
  de.push({ q: q14, nhom: "Cảm nghĩ", so: 14, chuDe: cdYk });
  de.push({ q: q15, nhom: "Cảm nghĩ", so: 15, chuDe: cdYk });
  return de.filter(function (d) { return d.q; });
};

/* ---------- 6. Tìm kiếm ------------------------------------------------ */
function diemKhop(text, terms, trong) {
  if (!text) return 0;
  var t = L.chuanHoa(text), tong = 0;
  for (var i = 0; i < terms.length; i++) {
    var at = t.indexOf(terms[i]);
    if (at < 0) return 0;                       /* mọi từ đều phải có */
    var d = trong;
    if (at === 0 || /[\s(]/.test(t[at - 1] || " ")) d *= 1.5;   /* khớp đầu từ */
    tong += d;
  }
  return tong;
}
function trichDoan(text, terms, rong) {
  rong = rong || 70;
  var t = L.chuanHoa(text), at = -1;
  for (var i = 0; i < terms.length && at < 0; i++) at = t.indexOf(terms[i]);
  if (at < 0) return text.slice(0, rong * 2);
  var a = Math.max(0, at - rong), b = Math.min(text.length, at + rong);
  return (a > 0 ? "…" : "") + text.slice(a, b) + (b < text.length ? "…" : "");
}
L.timKiem = function (D, q, toiDa) {
  toiDa = toiDa || 30;
  var terms = L.chuanHoa(q).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  var kq = [];
  D.cauHoi.forEach(function (c) {
    var body = c.cau.join(" ");
    var d = Math.max(diemKhop(c.id, terms, 120), diemKhop(c.so, terms, 0), diemKhop(c.vi, terms, 100),
                     diemKhop(c.en, terms, 70), diemKhop(body, terms, 25));
    if (d) kq.push({ loai: "script", id: c.id, diem: d, ten: c.vi, mo: trichDoan(diemKhop(c.vi, terms, 1) ? c.en : (diemKhop(c.en, terms, 1) ? c.en : body), terms), q: c });
  });
  D.huongDan.forEach(function (h) {
    var ol = h.outline.map(function (o) { return o.t; }).join(" · ");
    var d = Math.max(diemKhop(h.ten, terms, 110), diemKhop(ol, terms, 60), diemKhop(h.md, terms, 15));
    if (d) kq.push({ loai: "huong-dan", id: h.slug, diem: d, ten: h.ten, mo: trichDoan(diemKhop(h.ten, terms, 1) ? h.tomTat : (diemKhop(ol, terms, 1) ? ol : h.md), terms) });
  });
  D.chuDe.forEach(function (c) {
    /* tên chủ đề nặng hơn câu hỏi: gõ "nha cua" thì muốn thấy chủ đề trước 19 script */
    var d = Math.max(diemKhop(c.ten, terms, 130), diemKhop(c.moTa, terms, 30));
    if (d) kq.push({ loai: "chu-de", id: c.id, diem: d, ten: c.icon + " " + c.ten, mo: c.moTa });
  });
  kq.sort(function (a, b) { return b.diem - a.diem; });
  return kq.slice(0, toiDa);
};
L.toSang = function (text, q) {           /* trả về mảng {t, on} để giao diện bọc <mark> */
  var terms = L.chuanHoa(q).split(/\s+/).filter(Boolean);
  if (!terms.length || !text) return [{ t: text || "", on: false }];
  var t = L.chuanHoa(text), marks = [], i;
  terms.forEach(function (term) {
    var at = 0;
    while ((at = t.indexOf(term, at)) >= 0) { marks.push([at, at + term.length]); at += term.length; }
  });
  if (!marks.length) return [{ t: text, on: false }];
  marks.sort(function (a, b) { return a[0] - b[0]; });
  var out = [], pos = 0;
  for (i = 0; i < marks.length; i++) {
    if (marks[i][0] < pos) continue;
    if (marks[i][0] > pos) out.push({ t: text.slice(pos, marks[i][0]), on: false });
    out.push({ t: text.slice(marks[i][0], marks[i][1]), on: true });
    pos = marks[i][1];
  }
  if (pos < text.length) out.push({ t: text.slice(pos), on: false });
  return out;
};

/* ---------- 6b. Bundle chung -> dạng riêng của trang ---------------------
   Nội dung OPIc nằm trong database như mọi khoá khác, ở định dạng chung
   (nav/order/docs). Trang tải GET /courses/opic/bundle rồi đổi về dạng nó vẫn
   dùng — {chuDe, cauHoi, dang, bo, huongDan, thongKe} — để phần còn lại không
   phải biết nội dung đến từ đâu. Nghịch đảo của bundle_tu_payload() trong
   backend/course-content/opic/build.py.                                      */
/* Dữ liệu từ database. app.js ghép thẳng vào HTML những trường ĐỊNH DANH (id,
   mã, slug, icon, số thứ tự); chữ hiển thị thì nó luôn esc(). Vì vậy định danh
   được làm sạch MỘT lần ở đây: một bundle lạ không thể chèn thẻ hay thuộc tính.
   Nội dung thật (A01, gioi-thieu, 🎵, 1.5) đi qua nguyên vẹn. */
L.maSach = function (s) { return String(s == null ? "" : s).replace(/[^A-Za-z0-9._-]/g, ""); };
L.iconSach = function (s) { return String(s == null ? "" : s).replace(/[<>&"'`=\\]/g, "").slice(0, 16); };
L.soSach = function (n, macDinh) { n = Number(n); return isFinite(n) && n > 0 ? n : macDinh; };
/* Object JSON từ MySQL về với khoá đã sắp xếp (theo độ dài): thứ tự hiển thị
   lấy từ mảng `thuTu` đi kèm, khoá lạ (không có trong mảng) đứng sau. */
L.theoThuTu = function (obj, thuTu) {
  obj = obj || {};
  var out = {};
  (thuTu || []).concat(Object.keys(obj)).forEach(function (k) {
    var kk = L.maSach(k);
    if (kk && obj[k] && !out[kk]) out[kk] = obj[k];
  });
  return out;
};

L.tuBundle = function (b) {
  b = b || {};
  var docs = b.docs || {}, nav = b.nav || [];
  var cfg = (b.course && b.course.config) || {};
  var dangs = L.theoThuTu(cfg.dang, cfg.dangThuTu), bos = L.theoThuTu(cfg.bo, cfg.boThuTu);
  var dangDau = Object.keys(dangs)[0] || "mieu-ta";
  function sec(id) { return nav.filter(function (s) { return s.id === id; })[0] || { groups: [] }; }
  var chuDe = [], cauHoi = [], huongDan = [];
  (sec("chu-de").groups || []).forEach(function (g, i) {
    var m = g.meta || {};
    var cdId = L.maSach(g.short || g.title) || "chu-de-" + (i + 1);
    chuDe.push({ id: cdId, ten: g.title, icon: L.iconSach(m.icon), thuTu: L.soSach(m.thuTu, i + 1),
                 uuTien: L.soSach(m.uuTien, 2), moTa: m.moTa || "" });
    (g.items || []).forEach(function (id) {
      var d = docs[id], qid = L.maSach(id);
      if (!d || !qid) return;
      var dm = d.meta || {};
      var cau = String(d.md || "").split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
      var tu = 0;
      cau.forEach(function (c) { if (!L.laChiDan(c)) tu += c.split(/\s+/).filter(Boolean).length; });
      var dang = L.maSach(dm.dang) || "mieu-ta";
      if (!dangs[dang]) dangs[dang] = { ten: dang, phut: 1, moTa: "" };     /* dạng lạ: vẫn hiện, không vỡ trang */
      var bo = L.maSach(dm.bo) || (/^A/.test(qid) ? "A" : "B");
      if (!bos[bo]) bos[bo] = { ten: "Bộ " + bo, nhanVat: "", moTa: "" };
      cauHoi.push({
        id: qid, vi: d.title, en: dm.en || "", dang: dang,
        phut: L.soSach(dm.phut, L.soSach((dangs[dang] || {}).phut, 1)),
        cau: cau, bo: bo, so: L.maSach(dm.so || qid),
        chuDe: cdId, tu: tu, giay: Math.round(tu / 130 * 60)
      });
    });
  });
  (sec("huong-dan").groups || []).forEach(function (g) {
    (g.items || []).forEach(function (id) {
      var d = docs[id], slug = L.maSach(String(id).replace(/^huong-dan\//, ""));
      if (!d || !slug) return;
      var dm = d.meta || {};
      huongDan.push({
        slug: slug, thuTu: L.soSach(dm.thuTu, huongDan.length + 1), ten: d.title,
        md: d.md || "", outline: d.outline || [], tomTat: dm.tomTat || "", tu: d.words || 0,
        phut: Math.max(1, Math.round((d.words || 0) / 200))
      });
    });
  });
  huongDan.sort(function (a, c) { return a.thuTu - c.thuTu; });
  var dem = function (bo) { return cauHoi.filter(function (q) { return q.bo === bo; }).length; };
  if (!Object.keys(dangs).length) dangs[dangDau] = { ten: dangDau, phut: 1, moTa: "" };
  return {
    chuDe: chuDe, cauHoi: cauHoi, dang: dangs, bo: bos, huongDan: huongDan,
    thongKe: {
      chuDe: chuDe.length, cauHoi: cauHoi.length, boA: dem("A"), boB: dem("B"),
      cau: cauHoi.reduce(function (n, q) { return n + q.cau.length; }, 0),
      tu: cauHoi.reduce(function (n, q) { return n + q.tu; }, 0),
      huongDan: huongDan.length,
      phutDoc: huongDan.reduce(function (n, h) { return n + h.phut; }, 0)
    }
  };
};

/* ---------- 7. Thống kê, chuỗi ngày ------------------------------------ */
L.ngayKey = function (d) {
  d = d ? new Date(d) : new Date();
  var m = d.getMonth() + 1, day = d.getDate();
  return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day;
};
/* Chuỗi ngày: đếm ngược từ hôm nay (hoặc hôm qua, nếu hôm nay chưa luyện). */
L.chuoiNgay = function (nhatKy, homNay) {
  var d = homNay ? new Date(homNay) : new Date();
  d.setHours(12, 0, 0, 0);
  if (!nhatKy[L.ngayKey(d)]) d.setDate(d.getDate() - 1);
  var dem = 0;
  while (nhatKy[L.ngayKey(d)]) { dem++; d.setDate(d.getDate() - 1); if (dem > 3650) break; }
  return dem;
};
L.thongKe = function (D, hoc, bo, now) {
  now = now || Date.now();
  var r = { tong: 0, thuoc: 0, dangHoc: 0, chuaHoc: 0, denHan: 0, luyen: 0, theoChuDe: {} };
  D.chuDe.forEach(function (c) { r.theoChuDe[c.id] = { tong: 0, thuoc: 0, dangHoc: 0, denHan: 0 }; });
  D.cauHoi.forEach(function (q) {
    if (bo && bo !== "AB" && q.bo !== bo) return;
    var tt = hoc[q.id], cd = r.theoChuDe[q.chuDe];
    r.tong++; cd.tong++;
    if (tt && tt.s === 2) { r.thuoc++; cd.thuoc++; }
    else if (tt && tt.s === 1) { r.dangHoc++; cd.dangHoc++; }
    else { r.chuaHoc++; }
    if (L.denHan(tt, now)) { r.denHan++; cd.denHan++; }
    r.luyen += (tt && tt.lan) || 0;
  });
  r.pt = r.tong ? r.thuoc / r.tong : 0;
  return r;
};

return L;
});
