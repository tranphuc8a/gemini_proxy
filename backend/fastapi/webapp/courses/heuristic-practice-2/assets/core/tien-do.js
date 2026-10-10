/* Tiến độ học theo bài — hàm thuần. Mỗi bài có một bản ghi tóm tắt `tdo/<id>` (giao diện cập nhật mỗi khi người học làm gì đó),
   để trang chủ hiện tiến độ mà không phải nạp nội dung 32 bài.
     t: {d, n}  trắc nghiệm: số câu đang đúng / tổng câu
     l: {d, n}  tự luận: số câu đã xem đáp án mẫu và tự chấm / tổng câu
     b: {m, n, soLab, hopLe}  lab: tổng mức đã đạt / tổng mức tối đa (mức 1 = hợp lệ); soLab = số lab, hopLe = số lab đã hợp lệ
   Trọng số: trắc nghiệm 40 %, tự luận 25 %, lab 35 %; bài không có phần nào thì chia lại trọng số cho các phần còn lại. */
(function (root) {
  "use strict";
  var TH = root.TH || (root.TH = {});

  var TRONG_SO = { t: 0.4, l: 0.25, b: 0.35 };

  function phan(x) { return x && x.n > 0 ? Math.max(0, Math.min(1, x.d !== undefined ? x.d / x.n : x.m / x.n)) : null; }

  /* → 0..1 (null nếu bài chưa có dữ liệu nào về cấu trúc) */
  function tinh(r) {
    if (!r) return 0;
    var cac = ["t", "l", "b"], tong = 0, w = 0;
    cac.forEach(function (k) {
      var p = phan(r[k]);
      if (p === null) return;
      tong += p * TRONG_SO[k]; w += TRONG_SO[k];
    });
    return w ? tong / w : 0;
  }

  /* "chua-hoc" | "dang-hoc" | "xong" — xong khi ≥ 85 % VÀ trắc nghiệm ≥ 70 % (nếu có) VÀ mọi lab đã hợp lệ (nếu có). */
  function trangThai(r) {
    if (!r) return "chua-hoc";
    var p = tinh(r);
    if (p <= 0) return "chua-hoc";
    var tracDat = !r.t || r.t.n === 0 || r.t.d / r.t.n >= 0.7;
    var labDat = !r.b || !r.b.soLab || (r.b.hopLe || 0) >= r.b.soLab;
    return p >= 0.85 && tracDat && labDat ? "xong" : "dang-hoc";
  }

  /* Tổng hợp cả khoá: dsId các bài; lay(id) → bản ghi tóm tắt. */
  function tongHop(dsId, lay) {
    var xong = 0, dang = 0, tong = 0, sum = 0;
    dsId.forEach(function (id) {
      var r = lay(id), p = tinh(r), st = trangThai(r);
      sum += p; tong++;
      if (st === "xong") xong++; else if (st === "dang-hoc") dang++;
    });
    return { xong: xong, dang: dang, tong: tong, phanTram: tong ? sum / tong : 0 };
  }

  /* Sao đẹp cho mức lab: ★★☆ */
  function sao(muc, toiDa) {
    var s = "";
    for (var i = 1; i <= toiDa; i++) s += i <= muc ? "★" : "☆";
    return s;
  }

  TH.tienDo = { tinh: tinh, trangThai: trangThai, tongHop: tongHop, sao: sao };
  if (typeof module !== "undefined" && module.exports) module.exports = TH.tienDo;
})(typeof globalThis !== "undefined" ? globalThis : this);
