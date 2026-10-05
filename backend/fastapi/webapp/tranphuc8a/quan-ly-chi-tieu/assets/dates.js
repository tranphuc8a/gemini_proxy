/* dates.js — ngày tháng: chuỗi "YYYY-MM-DD" theo giờ địa phương.

   Mọi phép tính đi qua SỐ NGÀY kể từ 1970-01-01 (UTC) nên không dính múi giờ
   hay giờ mùa hè. Tuần bắt đầu thứ Hai; thứ: 0=T2 … 6=CN.
   Thuần: chỉ `today()` đọc đồng hồ, và nhận được ngày giả khi kiểm thử. */
(function (root) {
  "use strict";
  var QL = root.QL || (root.QL = {});

  var WD = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
  var WD_LONG = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ nhật"];

  function pad(n, w) { n = String(n); while (n.length < (w || 2)) n = "0" + n; return n; }
  function make(y, m, d) { return pad(y, 4) + "-" + pad(m) + "-" + pad(d); }

  function daysInMonth(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }

  /** "2026-02-28" → {y,m,d}; ngày không có thật ("2026-02-30") → null. */
  function parse(iso) {
    var r = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
    if (!r) return null;
    var y = +r[1], m = +r[2], d = +r[3];
    if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
    return { y: y, m: m, d: d };
  }
  function isValid(iso) { return parse(iso) !== null; }

  function toDays(iso) {
    var p = parse(iso);
    if (!p) throw new Error("Ngày không hợp lệ: " + iso);
    return Math.round(Date.UTC(p.y, p.m - 1, p.d) / 86400000);
  }
  function fromDays(n) {
    var t = new Date(n * 86400000);
    return make(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
  }
  function addDays(iso, n) { return fromDays(toDays(iso) + n); }
  function diffDays(a, b) { return toDays(b) - toDays(a); } // b − a

  /** Cộng tháng, kẹp về ngày cuối tháng: 31/1 + 1 tháng = 28/2 (hoặc 29/2). */
  function addMonths(iso, n) {
    var p = parse(iso);
    var idx = p.y * 12 + (p.m - 1) + n;
    var y = Math.floor(idx / 12), m = idx - y * 12 + 1;
    return make(y, m, Math.min(p.d, daysInMonth(y, m)));
  }

  /** 0=T2 … 6=CN. */
  function weekday(iso) { return (new Date(toDays(iso) * 86400000).getUTCDay() + 6) % 7; }

  function today(now) {
    var t = now || new Date();
    return make(t.getFullYear(), t.getMonth() + 1, t.getDate());
  }

  function startOfWeek(iso) { return addDays(iso, -weekday(iso)); }
  function endOfWeek(iso) { return addDays(startOfWeek(iso), 6); }
  function startOfMonth(iso) { var p = parse(iso); return make(p.y, p.m, 1); }
  function endOfMonth(iso) { var p = parse(iso); return make(p.y, p.m, daysInMonth(p.y, p.m)); }
  function monthKey(iso) { return String(iso).slice(0, 7); }

  /** Tuần ISO-8601 (T2 là đầu tuần; tuần 1 chứa thứ Năm đầu tiên của năm). */
  function isoWeek(iso) {
    var thursday = addDays(iso, 3 - weekday(iso));
    var y = parse(thursday).y;
    var jan1 = make(y, 1, 1);
    return { year: y, week: Math.floor(diffDays(jan1, thursday) / 7) + 1 };
  }

  function dm(iso) { var p = parse(iso); return pad(p.d) + "/" + pad(p.m); }

  /** "T2 05/10" */
  function dayLabel(iso) { return WD[weekday(iso)] + " " + dm(iso); }

  /** "Hôm nay" / "Hôm qua" / "Hôm kia" / "T2 05/10". */
  function relativeLabel(iso, todayIso) {
    var d = diffDays(iso, todayIso);
    if (d === 0) return "Hôm nay";
    if (d === 1) return "Hôm qua";
    if (d === 2) return "Hôm kia";
    return dayLabel(iso);
  }

  /** Ngày gần nhất không muộn hơn `todayIso` rơi vào thứ `wd` (0=T2). Hôm nay tính. */
  function lastWeekday(wd, todayIso) {
    var back = (weekday(todayIso) - wd + 7) % 7;
    return addDays(todayIso, -back);
  }

  /** Nhóm của một thứ, theo cách nhật ký cũ chia: T2–T6 / T7 / CN. */
  function weekdayGroup(wd) { return wd <= 4 ? "weekdays" : (wd === 5 ? "saturday" : "sunday"); }

  /**
   * Kỳ báo cáo. kind: "week" | "month" | "year" | "all" | "custom".
   * `anchor` là một ngày bất kỳ trong kỳ. Với "custom" truyền {from,to}.
   */
  function period(kind, anchor, custom) {
    var from, to, label;
    if (kind === "week") {
      from = startOfWeek(anchor); to = addDays(from, 6);
      var w = isoWeek(from);
      label = "Tuần " + w.week + " · " + dm(from) + " – " + dm(to);
    } else if (kind === "month") {
      var p = parse(anchor);
      from = make(p.y, p.m, 1); to = endOfMonth(anchor);
      label = "Tháng " + p.m + "/" + p.y;
    } else if (kind === "year") {
      var y = parse(anchor).y;
      from = make(y, 1, 1); to = make(y, 12, 31);
      label = "Năm " + y;
    } else if (kind === "custom" && custom) {
      from = custom.from; to = custom.to;
      label = dm(from) + "/" + parse(from).y + " – " + dm(to) + "/" + parse(to).y;
    } else {
      return { kind: "all", from: "0000-01-01", to: "9999-12-31", label: "Tất cả", anchor: anchor };
    }
    return { kind: kind, from: from, to: to, label: label, anchor: anchor };
  }

  /** Kỳ liền trước (dir=-1) hoặc liền sau (dir=+1) có cùng độ dài. */
  function shift(per, dir) {
    if (per.kind === "week") return period("week", addDays(per.from, 7 * dir));
    if (per.kind === "month") return period("month", addMonths(per.from, dir));
    if (per.kind === "year") return period("year", addMonths(per.from, 12 * dir));
    if (per.kind === "custom") {
      var span = diffDays(per.from, per.to) + 1;
      return period("custom", per.from, { from: addDays(per.from, span * dir), to: addDays(per.to, span * dir) });
    }
    return per;
  }

  function inPeriod(iso, per) { return iso >= per.from && iso <= per.to; }

  /**
   * Đọc ngày người dùng gõ: "5/10", "05/10/2026", "5-10", "2026-10-05".
   * Không có năm thì lấy năm của `todayIso`; nếu ngày đó rơi quá 60 ngày về
   * TƯƠNG LAI thì hiểu là năm trước ("28/12" gõ vào đầu tháng 1).
   */
  function parseUser(text, todayIso) {
    var s = String(text || "").trim();
    var iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
    if (iso) { var c = make(+iso[1], +iso[2], +iso[3]); return isValid(c) ? c : null; }
    var r = /^(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2}|\d{4}))?$/.exec(s);
    if (!r) return null;
    var d = +r[1], m = +r[2];
    var ty = parse(todayIso).y;
    var y = r[3] ? (r[3].length === 2 ? 2000 + +r[3] : +r[3]) : ty;
    var out = make(y, m, d);
    if (!isValid(out)) return null;
    if (!r[3] && diffDays(todayIso, out) > 60) {
      var prev = make(y - 1, m, d);
      if (isValid(prev)) return prev;
    }
    return out;
  }

  QL.dates = {
    WD: WD, WD_LONG: WD_LONG, pad: pad, make: make, parse: parse, isValid: isValid,
    toDays: toDays, fromDays: fromDays, addDays: addDays, diffDays: diffDays, addMonths: addMonths,
    daysInMonth: daysInMonth, weekday: weekday, today: today,
    startOfWeek: startOfWeek, endOfWeek: endOfWeek, startOfMonth: startOfMonth, endOfMonth: endOfMonth,
    monthKey: monthKey, isoWeek: isoWeek, dm: dm, dayLabel: dayLabel, relativeLabel: relativeLabel,
    lastWeekday: lastWeekday, weekdayGroup: weekdayGroup,
    period: period, shift: shift, inPeriod: inPeriod, parseUser: parseUser
  };
  if (typeof module !== "undefined" && module.exports) module.exports = QL.dates;
})(typeof globalThis !== "undefined" ? globalThis : this);
