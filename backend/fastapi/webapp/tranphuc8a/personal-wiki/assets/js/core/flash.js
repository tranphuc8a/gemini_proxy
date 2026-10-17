/* flash.js — flashcard: rút thẻ "Q: … / A: …" từ nội dung note và lịch ôn tập (SM-2 rút gọn). Thuần, kiểm bằng node.

   Cú pháp trong note (ngoài khối code):
       Q: Bloom Filter là gì?
       A: Cấu trúc dữ liệu xác suất … (đáp án có thể nhiều dòng, tới dòng trống hoặc Q: kế tiếp)
   Id thẻ = băm(id note + câu hỏi đã chuẩn hoá). Sửa ĐÁP ÁN giữ nguyên lịch ôn; đổi CÂU HỎI là thẻ mới; xoá Q/A thì thẻ biến mất. */
(function (root) {
  "use strict";
  var W = root.Wiki || (root.Wiki = {});
  ["text", "notes"].forEach(function (m) { if (!W[m] && typeof require === "function") require("./" + m + ".js"); });
  var T = W.text, N = W.notes;

  var Q_LINE = /^\s*Q:\s*(.+)$/i, A_LINE = /^\s*A:\s*(.*)$/i;
  var DAY = 86400000, MIN = 60000;
  var LIM = { q: 500, a: 4000, perNote: 200 };

  /** → [{id, q, a}] theo thứ tự xuất hiện. Thẻ thiếu A, hoặc trùng câu hỏi trong cùng note, bị bỏ. */
  function extractCards(noteId, content) {
    var lines = N.maskCode(content).split("\n"), orig = String(content || "").split("\n"), out = [], seen = {}, i = 0;
    while (i < lines.length && out.length < LIM.perNote) {
      var m = Q_LINE.exec(lines[i]);
      if (!m) { i++; continue; }
      var q = [orig[i].replace(/^\s*Q:\s*/i, "")], a = null;
      i++;
      while (i < lines.length && !/^\s*$/.test(lines[i])) {
        if (Q_LINE.test(lines[i])) break;
        if (a === null && A_LINE.test(lines[i])) a = [orig[i].replace(/^\s*A:\s*/i, "")];
        else (a || q).push(orig[i]);
        i++;
      }
      if (a === null) continue;
      var qs = q.join("\n").trim().slice(0, LIM.q), as = a.join("\n").trim().slice(0, LIM.a);
      if (!qs || !as) continue;
      var id = T.hash53(noteId + "\u0000" + T.fold(qs).replace(/\s+/g, " "));
      if (seen[id]) continue;
      seen[id] = 1;
      out.push({ id: id, q: qs, a: as });
    }
    return out;
  }

  function newCard(c, noteId, now) {
    return { id: c.id, note: noteId, q: c.q, a: c.a, due: now, ease: 2.5, interval: 0, reps: 0, lapses: 0, updated_at: now };
  }

  /** Đối chiếu thẻ đang lưu của một note với thẻ vừa rút → {add, update, remove}. update chỉ đổi chữ (q/a), giữ lịch. */
  function reconcile(existing, extracted, noteId, now) {
    var have = {}, want = {}, add = [], update = [], remove = [];
    existing.forEach(function (c) { have[c.id] = c; });
    extracted.forEach(function (c) { want[c.id] = c; });
    extracted.forEach(function (c) {
      var cur = have[c.id];
      if (!cur) add.push(newCard(c, noteId, now));
      else if (cur.q !== c.q || cur.a !== c.a) update.push(Object.assign({}, cur, { q: c.q, a: c.a, updated_at: now }));
    });
    existing.forEach(function (c) { if (!want[c.id]) remove.push(c.id); });
    return { add: add, update: update, remove: remove };
  }

  var GRADES = ["Lại", "Khó", "Được", "Dễ"];
  /** grade 0..3 (Lại, Khó, Được, Dễ) → thẻ mới. Chưa thuộc (Lại) quay lại sau 10 phút trong cùng buổi. */
  function schedule(card, grade, now) {
    var c = Object.assign({}, card), ease = c.ease || 2.5, interval = c.interval || 0, reps = c.reps || 0;
    if (grade <= 0) { c.reps = 0; c.lapses = (c.lapses || 0) + 1; c.interval = 0; c.ease = Math.max(1.3, ease - 0.2); c.due = now + 10 * MIN; }
    else {
      var next;
      if (grade === 1) { next = reps === 0 ? 1 : Math.max(interval + 1, Math.round(interval * 1.2)); ease = Math.max(1.3, ease - 0.15); }
      else if (grade === 2) { next = reps === 0 ? 1 : reps === 1 ? 3 : Math.max(interval + 1, Math.round(interval * ease)); }
      else { next = reps === 0 ? 4 : reps === 1 ? 6 : Math.max(interval + 2, Math.round(interval * ease * 1.3)); ease = ease + 0.15; }
      c.reps = reps + 1; c.interval = Math.min(next, 3650); c.ease = Math.min(3.5, ease); c.due = now + c.interval * DAY;
    }
    c.updated_at = now;
    return c;
  }

  /** Khoảng cách dự kiến nếu chọn từng nút — để ghi trên nút ("1 ngày"). */
  function preview(card, now) { return [0, 1, 2, 3].map(function (g) { return fmtIn(schedule(card, g, now).due - now); }); }
  function fmtIn(ms) {
    if (ms < 60 * MIN) return Math.max(1, Math.round(ms / MIN)) + " phút";
    var d = Math.round(ms / DAY);
    if (d < 30) return d + " ngày";
    if (d < 365) return Math.round(d / 30) + " tháng";
    return (d / 365).toFixed(1).replace(/\.0$/, "") + " năm";
  }

  function normalizeCard(raw, now) {
    if (!raw || typeof raw !== "object" || !/^[0-9a-f]{14}$/.test(String(raw.id)) || !T.UUID_RE.test(String(raw.note))) throw new Error("Thẻ không hợp lệ.");
    var num = function (x, d, lo, hi) { x = +x; return isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d; };
    return {
      id: raw.id, note: raw.note, q: String(raw.q || "").slice(0, LIM.q), a: String(raw.a || "").slice(0, LIM.a), due: num(raw.due, now, 0, 8.64e15),
      ease: num(raw.ease, 2.5, 1.3, 3.5), interval: Math.floor(num(raw.interval, 0, 0, 3650)), reps: Math.floor(num(raw.reps, 0, 0, 1e6)), lapses: Math.floor(num(raw.lapses, 0, 0, 1e6)),
      updated_at: num(raw.updated_at, now, 0, 8.64e15)
    };
  }

  W.flash = { extractCards: extractCards, newCard: newCard, reconcile: reconcile, schedule: schedule, preview: preview, fmtIn: fmtIn, normalizeCard: normalizeCard, GRADES: GRADES, LIM: LIM };
  if (typeof module !== "undefined" && module.exports) module.exports = W.flash;
})(typeof globalThis !== "undefined" ? globalThis : this);
