/* sync.js — gộp hai bản của cùng một sổ (D4).

   Dùng khi máy chủ báo 409 (có thiết bị khác đã lưu trước), khi mở lại sau lúc
   offline, và khi nối vào một không gian đã có dữ liệu. Quy tắc theo từng bản ghi:

     · cùng id ở hai bên  → giữ bản có `updatedAt` MUỘN hơn (bằng nhau: so chuỗi
       chuẩn hoá để hai phía luôn chọn cùng một bản);
     · bản ghi bị xoá     → để lại "bia mộ" {id: thời điểm xoá}; bản ghi mất nếu bia mộ
       muộn hơn hoặc bằng lần sửa cuối, nhưng sửa MUỚI hơn lần xoá thì sống lại;
     · cài đặt            → bản có settings.updatedAt muộn hơn.

   Hàm thuần và có ba tính chất được kiểm bằng dữ liệu ngẫu nhiên: giao hoán
   (merge(a,b) = merge(b,a)), kết hợp, và lặp lại không đổi (merge(a,a) = a). */
(function (root) {
  "use strict";
  var QL = root.QL || (root.QL = {});

  /** JSON với khoá sắp xếp — để hai bản "giống nhau" cho cùng một chuỗi bất kể thứ tự khoá. */
  function canon(v) {
    if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
    if (v && typeof v === "object") {
      return "{" + Object.keys(v).sort().map(function (k) { return JSON.stringify(k) + ":" + canon(v[k]); }).join(",") + "}";
    }
    return JSON.stringify(v === undefined ? null : v);
  }

  function newer(x, y) {
    var ux = x.updatedAt || "", uy = y.updatedAt || "";
    if (ux !== uy) return ux > uy ? x : y;
    return canon(x) >= canon(y) ? x : y;
  }

  function maxIso(a, b) { return a === undefined ? b : (b === undefined ? a : (a >= b ? a : b)); }

  /**
   * @param {object} a  tài liệu (đã chuẩn hoá)
   * @param {object} b  tài liệu (đã chuẩn hoá)
   * @param {string} [now] ISO — mốc để dọn bia mộ quá hạn (mặc định: đồng hồ hiện tại)
   */
  function merge(a, b, now) {
    var M = QL.model;
    var nowMs = Date.parse(now || M.nowIso());
    var cutoff = nowMs - M.TOMBSTONE_DAYS * 86400000;
    var out = { schema: M.SCHEMA };

    out.settings = newer(a.settings, b.settings);

    var tomb = M.emptyTombstones();
    M.COLLECTIONS.forEach(function (coll) {
      var ta = a.tombstones[coll] || {}, tb = b.tombstones[coll] || {};
      var ids = {};
      Object.keys(ta).forEach(function (id) { ids[id] = true; });
      Object.keys(tb).forEach(function (id) { ids[id] = true; });
      Object.keys(ids).forEach(function (id) { tomb[coll][id] = maxIso(ta[id], tb[id]); });

      var byId = {};
      (a[coll] || []).concat(b[coll] || []).forEach(function (r) {
        byId[r.id] = byId[r.id] ? newer(byId[r.id], r) : r;
      });
      var list = [];
      Object.keys(byId).forEach(function (id) {
        var r = byId[id], t = tomb[coll][id];
        if (t !== undefined && t >= (r.updatedAt || "")) return;   // đã bị xoá (hoặc sửa không muộn hơn lần xoá)
        if (t !== undefined) delete tomb[coll][id];                 // sửa muộn hơn lần xoá → sống lại
        list.push(r);
      });
      // Thứ tự ổn định: không có nó, merge(a,b) và merge(b,a) cùng nội dung nhưng khác thứ tự.
      list.sort(function (x, y) {
        var ox = x.order === undefined ? 0 : x.order, oy = y.order === undefined ? 0 : y.order;
        if (ox !== oy) return ox - oy;
        var cx = x.createdAt || x.updatedAt || "", cy = y.createdAt || y.updatedAt || "";
        if (cx !== cy) return cx < cy ? -1 : 1;
        return x.id < y.id ? -1 : (x.id > y.id ? 1 : 0);
      });
      out[coll] = list;

      // Dọn bia mộ quá hạn (cả hai phía dùng cùng mốc `now` nên kết quả vẫn giao hoán).
      Object.keys(tomb[coll]).forEach(function (id) {
        if (Date.parse(tomb[coll][id]) < cutoff) delete tomb[coll][id];
      });
    });
    out.tombstones = tomb;
    return out;
  }

  /** Số bản ghi khác nhau giữa hai tài liệu (thêm / đổi / xoá) — để báo "đã gộp N thay đổi". */
  function countChanges(before, after) {
    var n = 0;
    QL.model.COLLECTIONS.forEach(function (coll) {
      var m = {};
      (before[coll] || []).forEach(function (r) { m[r.id] = canon(r); });
      (after[coll] || []).forEach(function (r) {
        if (m[r.id] === undefined) n++; else { if (m[r.id] !== canon(r)) n++; delete m[r.id]; }
      });
      n += Object.keys(m).length;
    });
    return n;
  }

  QL.sync = { merge: merge, countChanges: countChanges, canon: canon };
  if (typeof module !== "undefined" && module.exports) module.exports = QL.sync;
})(typeof globalThis !== "undefined" ? globalThis : this);
