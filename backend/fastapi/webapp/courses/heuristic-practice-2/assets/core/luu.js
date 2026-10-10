/* Kho lưu tiến độ/ghi chú/mã của người học — localStorage có thể bị chặn (cửa sổ riêng tư),
   nên mọi lần đọc/ghi đều bọc try/catch và có bản sao trong bộ nhớ: app chạy tiếp được, chỉ không nhớ qua lần mở sau.
   Mỗi bản ghi là {t: thời điểm sửa, v: giá trị}; gộp khi nhập sao lưu theo "bản mới hơn thắng" (cùng cách của các app khác). */
(function (root) {
  "use strict";
  var TH = root.TH || (root.TH = {});

  function tao(kho, tuyChon) {
    tuyChon = tuyChon || {};
    var tienTo = tuyChon.tienTo || "th2:";
    var dongHo = tuyChon.dongHo || function () { return Date.now(); };
    var bo = {};                                   /* bản sao trong bộ nhớ: khoá → {t, v} */
    var luuDuoc = true;

    try {
      if (!kho) throw new Error("no storage");
      kho.setItem(tienTo + "__thu", "1"); kho.removeItem(tienTo + "__thu");
      for (var i = 0; i < kho.length; i++) {
        var k = kho.key(i);
        if (k && k.indexOf(tienTo) === 0 && k !== tienTo + "__thu") {
          try { var b = JSON.parse(kho.getItem(k)); if (b && typeof b.t === "number") bo[k.slice(tienTo.length)] = b; } catch (e) { /* bản ghi hỏng: bỏ qua */ }
        }
      }
    } catch (e) { luuDuoc = false; }

    function cat(khoa) {
      if (!luuDuoc) return;
      try { kho.setItem(tienTo + khoa, JSON.stringify(bo[khoa])); }
      catch (e) { luuDuoc = false; }               /* đầy bộ nhớ / bị chặn giữa chừng */
    }

    return {
      luuDuoc: function () { return luuDuoc; },
      doc: function (khoa, macDinh) { return bo[khoa] !== undefined ? bo[khoa].v : macDinh; },
      thoiDiem: function (khoa) { return bo[khoa] ? bo[khoa].t : 0; },
      ghi: function (khoa, v) { bo[khoa] = { t: dongHo(), v: v }; cat(khoa); return v; },
      xoa: function (khoa) {
        delete bo[khoa];
        if (luuDuoc) { try { kho.removeItem(tienTo + khoa); } catch (e) { /* bỏ qua */ } }
      },
      khoa: function (tienToCon) {
        return Object.keys(bo).filter(function (k) { return !tienToCon || k.indexOf(tienToCon) === 0; }).sort();
      },
      xuat: function () {
        var du = {}; Object.keys(bo).forEach(function (k) { du[k] = bo[k]; });
        return { loai: "heuristic-thuc-hanh-2", phienBan: 1, taoLuc: new Date(dongHo()).toISOString(), du: du };
      },
      /* Trả về {them, capNhat, giu}: bản ghi mới hơn thắng; không bao giờ xoá gì. */
      nhap: function (goi) {
        if (!goi || goi.loai !== "heuristic-thuc-hanh-2" || !goi.du || typeof goi.du !== "object") throw new Error("Tệp sao lưu không đúng định dạng");
        var kq = { them: 0, capNhat: 0, giu: 0 };
        Object.keys(goi.du).forEach(function (k) {
          var b = goi.du[k];
          if (!b || typeof b.t !== "number" || !/^[\w./:-]{1,120}$/.test(k)) return;
          if (!bo[k]) { bo[k] = { t: b.t, v: b.v }; cat(k); kq.them++; }
          else if (b.t > bo[k].t) { bo[k] = { t: b.t, v: b.v }; cat(k); kq.capNhat++; }
          else kq.giu++;
        });
        return kq;
      }
    };
  }

  TH.luu = { tao: tao };
  if (typeof module !== "undefined" && module.exports) module.exports = TH.luu;
})(typeof globalThis !== "undefined" ? globalThis : this);
