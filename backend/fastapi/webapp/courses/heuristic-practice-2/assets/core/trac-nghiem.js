/* Câu hỏi trắc nghiệm: kiểm lược đồ (cho người soạn), xáo đáp án, chấm, tổng kết.
   Ba loại: "mot" (một đáp án đúng), "nhieu" (chọn mọi đáp án đúng), "so" (điền số, có sai số). */
(function (root) {
  "use strict";
  var TH = root.TH || (root.TH = {});
  var TI = TH.tienIch || (typeof require !== "undefined" ? require("./tien-ich.js") : null);

  var CAM = /tất cả (các )?(đáp án|ý|phương án)|cả [a-d] và [a-d]|không có (đáp án|phương án) nào|đều đúng|đều sai/i;

  function laSoNguyen(x) { return typeof x === "number" && isFinite(x) && Math.floor(x) === x; }

  /* Trả về mảng lỗi (rỗng = hợp lệ). */
  function kiemLuoc(cau) {
    var e = [];
    if (!cau || typeof cau !== "object") return ["câu hỏi không phải đối tượng"];
    if (["mot", "nhieu", "so"].indexOf(cau.loai) < 0) e.push("loai phải là mot | nhieu | so");
    if (typeof cau.hoi !== "string" || cau.hoi.trim().length < 8) e.push("thiếu nội dung `hoi`");
    if (typeof cau.giaiThich !== "string" || cau.giaiThich.trim().length < 20) e.push("`giaiThich` phải có (≥ 20 ký tự) — giải thích vì sao đúng VÀ vì sao các lựa chọn khác sai");
    if (cau.loai === "mot" || cau.loai === "nhieu") {
      var c = cau.chon;
      if (!Array.isArray(c) || c.length < (cau.loai === "mot" ? 3 : 4) || c.length > 6) e.push("`chon` cần " + (cau.loai === "mot" ? "3–6" : "4–6") + " lựa chọn");
      else {
        var seen = {};
        c.forEach(function (x, i) {
          if (typeof x !== "string" || !x.trim()) e.push("lựa chọn " + i + " rỗng");
          else {
            if (CAM.test(x)) e.push("lựa chọn " + i + " dạng “tất cả/cả A và B…” — vô nghĩa khi đáp án bị xáo");
            if (seen[x.trim()]) e.push("lựa chọn " + i + " trùng lặp");
            seen[x.trim()] = 1;
          }
        });
        if (cau.loai === "mot") {
          if (!laSoNguyen(cau.dung) || cau.dung < 0 || cau.dung >= c.length) e.push("`dung` phải là chỉ số (số nguyên) hợp lệ");
        } else {
          if (!Array.isArray(cau.dung) || !cau.dung.length || cau.dung.length >= c.length ||
              cau.dung.some(function (k) { return !laSoNguyen(k) || k < 0 || k >= c.length; }) ||
              new Set(cau.dung).size !== cau.dung.length) e.push("`dung` phải là mảng chỉ số khác nhau, ít nhất 1 và ít hơn số lựa chọn");
        }
      }
    }
    if (cau.loai === "so") {
      if (typeof cau.dapAn !== "number" || !isFinite(cau.dapAn)) e.push("`dapAn` phải là số");
      if (cau.saiSo != null && (typeof cau.saiSo !== "number" || cau.saiSo < 0)) e.push("`saiSo` phải ≥ 0");
    }
    return e;
  }

  /* Thứ tự hiển thị các lựa chọn: hoán vị các chỉ số gốc, tất định theo seed. */
  function thuTu(cau, seed) {
    var n = (cau.chon || []).length, idx = [];
    for (var i = 0; i < n; i++) idx.push(i);
    if (cau.giuThuTu || n < 2) return idx;
    return TI.tron(idx, TI.rng(TI.bam(String(cau.id || cau.hoi) + "|" + seed)));
  }

  /* traLoi: mot → chỉ số gốc | nhieu → mảng chỉ số gốc | so → chuỗi hoặc số.
     Trả {dung, daTraLoi}. */
  function cham(cau, traLoi) {
    if (cau.loai === "mot") {
      return { daTraLoi: traLoi != null, dung: traLoi === cau.dung };
    }
    if (cau.loai === "nhieu") {
      var a = Array.isArray(traLoi) ? traLoi.slice().sort() : [], b = cau.dung.slice().sort();
      return { daTraLoi: a.length > 0, dung: a.length === b.length && a.every(function (v, i) { return v === b[i]; }) };
    }
    var x = typeof traLoi === "number" ? traLoi : TI.docSo(traLoi);
    var sai = cau.saiSo || 0, tuongDoi = cau.tuongDoi || 0;
    var cho = Math.max(sai, Math.abs(cau.dapAn) * tuongDoi) + 1e-12;
    return { daTraLoi: isFinite(x), dung: isFinite(x) && Math.abs(x - cau.dapAn) <= cho };
  }

  function dapAnChu(cau) {
    if (cau.loai === "mot") return cau.chon[cau.dung];
    if (cau.loai === "nhieu") return cau.dung.slice().sort().map(function (k) { return cau.chon[k]; }).join(" · ");
    return TI.so(cau.dapAn, cau.saiSo ? undefined : undefined) + (cau.donVi ? " " + cau.donVi : "") + (cau.saiSo ? " (±" + TI.so(cau.saiSo) + ")" : "");
  }

  /* kq: {idCau: true|false} — chỉ tính các câu có trong danh sách. */
  function tongKet(dsCau, kq) {
    var tot = 0, daLam = 0;
    dsCau.forEach(function (c) { if (kq && kq[c.id] !== undefined) { daLam++; if (kq[c.id]) tot++; } });
    var tong = dsCau.length;
    return { tot: tot, daLam: daLam, tong: tong, tyLe: tong ? tot / tong : 0 };
  }
  function xepLoai(tyLe) {
    return tyLe >= 0.9 ? "Xuất sắc" : tyLe >= 0.75 ? "Tốt" : tyLe >= 0.5 ? "Tạm được" : "Cần đọc lại bài";
  }

  TH.tracNghiem = { kiemLuoc: kiemLuoc, thuTu: thuTu, cham: cham, dapAnChu: dapAnChu, tongKet: tongKet, xepLoai: xepLoai };
  if (typeof module !== "undefined" && module.exports) module.exports = TH.tracNghiem;
})(typeof globalThis !== "undefined" ? globalThis : this);
