/* Sổ đăng ký các bài thực hành + kiểm lược đồ nội dung.
   Mỗi tệp data/<id>.js gọi TH.dangKy({...}) đúng một lần. Lược đồ một bài:
     id        khớp một mục trong data/khoa.js
     tomTat    4–8 ý "nhớ trong một phút"
     trac      ≥ 5 câu trắc nghiệm (xem tracNghiem.kiemLuoc), mỗi câu có id duy nhất
     luan      ≥ 2 câu tự luận {id, hoi, mau, tieuChi[2..6], goiY?[], ref?}
     lab       0–3 lab {id, ten, de, vanDe, tham, bienThe?[{ten, tham}], soTest?, gioiHanMs?, muc?[{ten, so, heSo}],
                        khoiDau:{js, cpp?}, loiGiai:{js, cpp?}, goiY[]}; bài không có lab đặt khongLab: "lý do"
     ghiChuGoiY  (tuỳ chọn) các gợi ý đầu mục cho ô ghi chú */
(function (root) {
  "use strict";
  var TH = root.TH || (root.TH = {});
  var TN = TH.tracNghiem || (typeof require !== "undefined" ? require("./trac-nghiem.js") : null);

  var kho = {};

  function dangKy(bai) {
    if (!bai || typeof bai.id !== "string") throw new Error("TH.dangKy: thiếu id");
    kho[bai.id] = bai;
    if (TH.khiDangKy) { try { TH.khiDangKy(bai); } catch (e) { /* UI tự lo */ } }
    return bai;
  }

  function kiemLuocBai(b, tuyChon) {
    tuyChon = tuyChon || {};
    var e = [], VD = TH.vande;
    function loi(s) { e.push(s); }
    if (!Array.isArray(b.tomTat) || b.tomTat.length < 4 || b.tomTat.length > 8 || b.tomTat.some(function (x) { return typeof x !== "string" || x.length < 12; }))
      loi("tomTat: cần 4–8 ý, mỗi ý ≥ 12 ký tự");
    var ids = {};
    if (!Array.isArray(b.trac) || b.trac.length < (tuyChon.toiThieuTrac || 5)) loi("trac: cần ≥ " + (tuyChon.toiThieuTrac || 5) + " câu");
    (b.trac || []).forEach(function (c, i) {
      if (typeof c.id !== "string" || !/^[a-z0-9-]+$/i.test(c.id)) loi("trac[" + i + "]: thiếu id");
      else if (ids["t:" + c.id]) loi("trac[" + i + "]: id trùng " + c.id); else ids["t:" + c.id] = 1;
      TN.kiemLuoc(c).forEach(function (m) { loi("trac[" + i + "] (" + c.id + "): " + m); });
    });
    if (!Array.isArray(b.luan) || b.luan.length < (tuyChon.toiThieuLuan || 2)) loi("luan: cần ≥ " + (tuyChon.toiThieuLuan || 2) + " câu");
    (b.luan || []).forEach(function (c, i) {
      var p = "luan[" + i + "]";
      if (typeof c.id !== "string" || !/^[a-z0-9-]+$/i.test(c.id)) loi(p + ": thiếu id");
      else if (ids["l:" + c.id]) loi(p + ": id trùng " + c.id); else ids["l:" + c.id] = 1;
      if (typeof c.hoi !== "string" || c.hoi.length < 15) loi(p + ": thiếu `hoi`");
      if (typeof c.mau !== "string" || c.mau.length < 40) loi(p + ": `mau` (đáp án mẫu) quá ngắn");
      if (!Array.isArray(c.tieuChi) || c.tieuChi.length < 2 || c.tieuChi.length > 6) loi(p + ": `tieuChi` cần 2–6 ý để người học tự chấm");
    });
    if (b.khongLab) { if (typeof b.khongLab !== "string" || b.khongLab.length < 10) loi("khongLab: cần nêu lý do"); }
    else if (!Array.isArray(b.lab) || b.lab.length < 1 || b.lab.length > 3) loi("lab: cần 1–3 lab (hoặc khongLab: \"lý do\")");
    (b.lab || []).forEach(function (l, i) {
      var p = "lab[" + i + "]";
      if (typeof l.id !== "string" || !/^[a-z0-9-]+$/i.test(l.id)) loi(p + ": thiếu id");
      else if (ids["b:" + l.id]) loi(p + ": id trùng " + l.id); else ids["b:" + l.id] = 1;
      if (typeof l.ten !== "string" || l.ten.length < 5) loi(p + ": thiếu `ten`");
      if (typeof l.de !== "string" || l.de.length < 60) loi(p + ": `de` (đề bài) quá ngắn");
      if (typeof l.vanDe !== "string") loi(p + ": `vanDe` phải là tên bài toán đã đăng ký");
      else if (VD && !VD.lay(l.vanDe)) loi(p + ": bài toán “" + l.vanDe + "” chưa được đăng ký");
      if (!l.khoiDau || typeof l.khoiDau.js !== "string" || l.khoiDau.js.length < 20) loi(p + ": thiếu khoiDau.js");
      if (!l.loiGiai || typeof l.loiGiai.js !== "string" || l.loiGiai.js.length < 20) loi(p + ": thiếu loiGiai.js (lời giải tham chiếu, được kiểm tự động)");
      if (l.khoiDau && l.khoiDau.cpp != null && (typeof l.khoiDau.cpp !== "string" || l.khoiDau.cpp.length < 20)) loi(p + ": khoiDau.cpp không hợp lệ");
      if (l.loiGiai && l.loiGiai.cpp != null && (typeof l.loiGiai.cpp !== "string" || l.loiGiai.cpp.length < 20)) loi(p + ": loiGiai.cpp không hợp lệ");
      if (l.khoiDau && l.khoiDau.cpp && !(l.loiGiai && l.loiGiai.cpp)) loi(p + ": có khoiDau.cpp thì phải có loiGiai.cpp");
      if (l.soTest != null && (l.soTest < 3 || l.soTest > 20)) loi(p + ": soTest ngoài [3, 20]");
      if (l.gioiHanMs != null && (l.gioiHanMs < 100 || l.gioiHanMs > 10000)) loi(p + ": gioiHanMs ngoài [100, 10000]");
      if (!Array.isArray(l.goiY) || !l.goiY.length) loi(p + ": cần ≥ 1 gợi ý");
      if (l.bienThe != null && (!Array.isArray(l.bienThe) || l.bienThe.length < 2 || l.bienThe.some(function (v) { return !v || typeof v.ten !== "string" || !v.tham || typeof v.tham !== "object"; })))
        loi(p + ": bienThe phải là mảng ≥ 2 phần tử {ten, tham}");
      if (l.tham == null && !(l.bienThe && l.bienThe.length)) loi(p + ": thiếu `tham` (tham số sinh dữ liệu)");
      var vd = VD && typeof l.vanDe === "string" ? VD.lay(l.vanDe) : null;
      (l.muc || []).forEach(function (m, k) {
        if (typeof m.ten !== "string") loi(p + ".muc[" + k + "]: thiếu ten");
        if (vd && (!vd.thamChieu || !vd.thamChieu[m.so])) loi(p + ".muc[" + k + "]: lời giải tham chiếu “" + m.so + "” không có trong bài toán " + l.vanDe);
        if (m.heSo != null && !(m.heSo > 0)) loi(p + ".muc[" + k + "]: heSo phải > 0");
      });
    });
    return e;
  }

  TH.bai = { kiemLuocBai: kiemLuocBai, kho: function () { return kho; }, lay: function (id) { return kho[id] || null; } };
  TH.dangKy = dangKy;
  if (typeof module !== "undefined" && module.exports) module.exports = TH.bai;
})(typeof globalThis !== "undefined" ? globalThis : this);
