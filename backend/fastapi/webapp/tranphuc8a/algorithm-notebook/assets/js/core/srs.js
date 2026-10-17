/* core/srs.js — lặp lại ngắt quãng cho flashcard (biến thể SM-2, cùng cách chấm với Personal Wiki: Lại / Khó / Được / Dễ).
   Thẻ: { id, due (ms), ease, interval (ngày), reps, lapses, updated }. Thẻ chưa từng ôn không có bản ghi (coi như mới). */
(function (root) {
  "use strict";
  var A = root.Algo || (root.Algo = {});
  var DAY = 86400000, GRADES = ["Lại", "Khó", "Được", "Dễ"];

  function fresh(id, now) { return { id: id, due: now, ease: 2.5, interval: 0, reps: 0, lapses: 0, updated: now }; }

  /** grade: 0 Lại · 1 Khó · 2 Được · 3 Dễ → thẻ mới (không sửa thẻ cũ). */
  function schedule(card, grade, now) {
    var c = Object.assign({}, card), ease = c.ease, interval;
    if (grade === 0) { c.lapses++; c.reps = 0; ease = Math.max(1.3, ease - 0.2); interval = 0; c.due = now + 10 * 60000; }
    else {
      c.reps++;
      if (c.reps === 1) interval = grade === 3 ? 4 : grade === 2 ? 1 : 1;
      else if (c.reps === 2) interval = grade === 3 ? 8 : grade === 2 ? 4 : 2;
      else interval = Math.max(c.interval + 1, Math.round(c.interval * (grade === 1 ? 1.2 : ease * (grade === 3 ? 1.3 : 1))));
      if (grade === 1) ease = Math.max(1.3, ease - 0.15); else if (grade === 3) ease = Math.min(3.5, ease + 0.15);
      interval = Math.min(interval, 3650);
      c.due = now + interval * DAY;
    }
    c.ease = Math.round(ease * 100) / 100; c.interval = interval; c.updated = now;
    return c;
  }
  /** Nhãn khoảng ôn kế tiếp cho từng nút ("10 phút", "1 ngày", "3 tháng"). */
  function preview(card, now) {
    return [0, 1, 2, 3].map(function (g) {
      var d = schedule(card, g, now).due - now;
      return d < 3600000 ? Math.max(1, Math.round(d / 60000)) + " phút" : d < DAY * 1.5 ? "1 ngày" : d < DAY * 60 ? Math.round(d / DAY) + " ngày" : d < DAY * 700 ? Math.round(d / DAY / 30) + " tháng" : Math.round(d / DAY / 365) + " năm";
    });
  }

  A.srs = { GRADES: GRADES, fresh: fresh, schedule: schedule, preview: preview, DAY: DAY };
  if (typeof module !== "undefined" && module.exports) module.exports = A.srs;
})(typeof globalThis !== "undefined" ? globalThis : this);
