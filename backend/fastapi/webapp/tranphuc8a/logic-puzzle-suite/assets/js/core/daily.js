/* core/daily.js — Daily Puzzle: mỗi ngày MỘT puzzle đặc biệt, TẤT ĐỊNH theo ngày (mọi thiết bị cùng ngày ra cùng puzzle, không cần máy chủ).
   Đầu vào duy nhất là khoá ngày địa phương "YYYY-MM-DD" → loại, bậc, cỡ, seed. Loại xoay vòng theo số ngày; bậc theo thứ trong tuần
   (đầu tuần nhẹ, cuối tuần khó).

   Danh sách xoay vòng CÓ PHIÊN BẢN theo ngày bắt đầu (SCHEDULE): ngày d dùng phiên bản cuối cùng có `tu` ≤ d, xoay vòng tính từ chính `tu`
   (phiên bản đầu bắt đầu 1970-01-01 = ngày số 0, nên công thức trùng hệt bản cũ "số ngày mod 5"). Vì sao: thêm id vào một danh sách
   duy nhất làm đổi "số ngày mod độ dài" ⇒ đổi loại của CHÍNH ngày triển khai (người chơi đang giải dở Daily thấy puzzle khác) và mọi ngày sau.
   Có phiên bản thì ngày đã qua và hôm nay giữ nguyên; loại mới chỉ vào lịch từ ngày `tu` đã chọn.

   THÊM LOẠI VÀO DAILY: thêm MỘT phần tử mới ở CUỐI SCHEDULE — `tu` là một ngày TRONG TƯƠNG LAI (≥ ngày mai theo giờ máy người chơi, tốt nhất
   vài ngày sau ngày triển khai để mọi múi giờ đều qua), `ids` = ids của phiên bản trước + id mới ở cuối (không xoá, không đảo).
   kiem/personal.js kiểm hình dạng này và kiểm lịch quá khứ không đổi. */
(function (root) {
  "use strict";
  var P = root.Puz || (root.Puz = {});
  var SCHEDULE = [
    { tu: "1970-01-01", ids: ["sudoku", "nqueens", "lightsout", "nonogram", "logicgrid"] }
  ];
  var WEEKDAY_TIER = ["hard", "easy", "medium", "medium", "hard", "hard", "expert"];     // 0 = Chủ nhật … 6 = Thứ bảy
  var TIER_RANK = ["easy", "medium", "hard", "expert"];

  function weekday(day) { return ((P.util.dayNumber(day) % 7) + 11) % 7; }                // 1970-01-01 là thứ Năm (4) → 0 = Chủ nhật
  /** Bậc gần nhất không vượt quá mong muốn mà cỡ này sinh được. */
  function tierFor(sizeDef, want) {
    var avail = sizeDef.tiers || TIER_RANK, i = TIER_RANK.indexOf(want);
    for (; i >= 0; i--) if (avail.indexOf(TIER_RANK[i]) >= 0) return TIER_RANK[i];
    return avail[0];
  }
  /** Phiên bản danh sách xoay vòng áp cho ngày `day` (phần tử cuối có tu ≤ day; trước mọi phiên bản thì phiên bản đầu). */
  function versionFor(day, schedule) {
    var s = schedule || SCHEDULE, n = P.util.dayNumber(day), pick = s[0];
    for (var i = 1; i < s.length; i++) if (P.util.dayNumber(s[i].tu) <= n) pick = s[i];
    return pick;
  }

  /** → { day, type, sizeId, tier, seed } hoặc null nếu chưa có loại nào đăng ký. opt.schedule: lịch khác (chỉ để kiểm). */
  function forDay(day, availableIds, opt) {
    var ids = availableIds || P.types.all().map(function (d) { return d.id; });
    var n = P.util.dayNumber(day);
    if (!isFinite(n)) return null;
    var ver = versionFor(day, opt && opt.schedule), ORDER = ver.ids, k = n - P.util.dayNumber(ver.tu);
    var pool = ORDER.filter(function (id) { return ids.indexOf(id) >= 0; });
    ids.forEach(function (id) { if (pool.indexOf(id) < 0) pool.push(id); });                 // loại chưa vào lịch đứng sau, không đảo thứ tự cũ
    if (!pool.length) return null;
    var start = ((k % ORDER.length) + ORDER.length) % ORDER.length, type = null, i;
    for (i = 0; i < ORDER.length && !type; i++) { var cand = ORDER[(start + i) % ORDER.length]; if (pool.indexOf(cand) >= 0) type = cand; }
    if (!type) type = pool[0];
    var def = P.types.get(type);
    var size = def ? P.types.sizeOf(def, null) : { id: "", tiers: null };
    var tier = tierFor(size, WEEKDAY_TIER[weekday(day)]);
    var seed = 10000000 + (P.rng.hash32("daily:" + day + ":" + type) % 90000000);
    return { day: day, type: type, sizeId: size.id, tier: tier, seed: seed };
  }

  /** ORDER = danh sách của phiên bản MỚI NHẤT — vỏ dùng làm thứ tự hiển thị các loại (ui/common.js types()). */
  P.daily = { forDay: forDay, weekday: weekday, tierFor: tierFor, versionFor: versionFor, SCHEDULE: SCHEDULE, ORDER: SCHEDULE[SCHEDULE.length - 1].ids, WEEKDAY_TIER: WEEKDAY_TIER };
  if (typeof module !== "undefined" && module.exports) module.exports = P.daily;
})(typeof globalThis !== "undefined" ? globalThis : this);
