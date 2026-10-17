/* core/daily.js — Daily Puzzle: mỗi ngày MỘT puzzle đặc biệt, TẤT ĐỊNH theo ngày (mọi thiết bị cùng ngày ra cùng puzzle, không cần máy chủ).
   Đầu vào duy nhất là khoá ngày địa phương "YYYY-MM-DD" → loại, bậc, cỡ, seed. Loại xoay vòng theo số ngày; bậc theo thứ trong tuần
   (đầu tuần nhẹ, cuối tuần khó). Danh sách xoay vòng CỐ ĐỊNH (ORDER) để thêm loại mới không làm đảo lịch cũ. */
(function (root) {
  "use strict";
  var P = root.Puz || (root.Puz = {});
  var ORDER = ["sudoku", "nqueens", "lightsout", "nonogram", "logicgrid"];
  var WEEKDAY_TIER = ["hard", "easy", "medium", "medium", "hard", "hard", "expert"];     // 0 = Chủ nhật … 6 = Thứ bảy
  var TIER_RANK = ["easy", "medium", "hard", "expert"];

  function weekday(day) { return ((P.util.dayNumber(day) % 7) + 11) % 7; }                // 1970-01-01 là thứ Năm (4) → 0 = Chủ nhật
  /** Bậc gần nhất không vượt quá mong muốn mà cỡ này sinh được. */
  function tierFor(sizeDef, want) {
    var avail = sizeDef.tiers || TIER_RANK, i = TIER_RANK.indexOf(want);
    for (; i >= 0; i--) if (avail.indexOf(TIER_RANK[i]) >= 0) return TIER_RANK[i];
    return avail[0];
  }

  /** → { day, type, sizeId, tier, seed } hoặc null nếu chưa có loại nào đăng ký. */
  function forDay(day, availableIds) {
    var ids = availableIds || P.types.all().map(function (d) { return d.id; });
    var n = P.util.dayNumber(day);
    if (!isFinite(n)) return null;
    var pool = ORDER.filter(function (id) { return ids.indexOf(id) >= 0; });
    ids.forEach(function (id) { if (pool.indexOf(id) < 0) pool.push(id); });                 // loại mới (V2) đứng sau, không đảo thứ tự cũ
    if (!pool.length) return null;
    var start = ((n % ORDER.length) + ORDER.length) % ORDER.length, type = null, i;
    for (i = 0; i < ORDER.length && !type; i++) { var cand = ORDER[(start + i) % ORDER.length]; if (pool.indexOf(cand) >= 0) type = cand; }
    if (!type) type = pool[0];
    var def = P.types.get(type);
    var size = def ? P.types.sizeOf(def, null) : { id: "", tiers: null };
    var tier = tierFor(size, WEEKDAY_TIER[weekday(day)]);
    var seed = 10000000 + (P.rng.hash32("daily:" + day + ":" + type) % 90000000);
    return { day: day, type: type, sizeId: size.id, tier: tier, seed: seed };
  }

  P.daily = { forDay: forDay, weekday: weekday, tierFor: tierFor, ORDER: ORDER, WEEKDAY_TIER: WEEKDAY_TIER };
  if (typeof module !== "undefined" && module.exports) module.exports = P.daily;
})(typeof globalThis !== "undefined" ? globalThis : this);
