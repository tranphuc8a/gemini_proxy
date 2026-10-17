/* core/progress.js — TIẾN TRIỂN ĐỘ KHÓ (spec #18): đề xuất bậc kế tiếp cho từng loại dựa trên lịch sử ván gần đây. Thuần, không DOM.

   Cách làm (đơn giản, giải thích được):
     • bậc hiện tại = bậc của ván gần nhất thuộc loại đó (chưa chơi → Dễ);
     • xét tối đa 3 ván gần nhất Ở BẬC ĐÓ (bỏ ván chưa đủ dữ liệu: dưới 3 ván thì chỉ "ở lại, chơi thêm");
     • LÊN bậc khi cả 3 ván đều tự giải (không Reveal), không dùng gợi ý, ≤ 2 lỗi, và thời gian trung vị ≤ 70 % mốc tham chiếu của (loại, bậc);
     • XUỐNG bậc khi ≥ 2 trong 3 ván bị Reveal/bỏ dở, hoặc trung vị thời gian ≥ 2 lần mốc kèm ≥ 3 gợi ý ở cả 3 ván;
     • còn lại: giữ nguyên.
   Mốc tham chiếu (phút) là ước lượng heuristic cho một người chơi "bình thường", KHÔNG phải số đo; chỉ dùng để đề xuất, người chơi luôn tự chọn được bậc. */
(function (root) {
  "use strict";
  var P = root.Puz || (root.Puz = {});
  var REF_MIN = {
    sudoku: { easy: 6, medium: 10, hard: 16, expert: 26 }, nqueens: { easy: 2, medium: 4, hard: 7, expert: 12 }, lightsout: { easy: 1.5, medium: 3, hard: 6, expert: 10 },
    nonogram: { easy: 3, medium: 8, hard: 18, expert: 35 }, logicgrid: { easy: 4, medium: 8, hard: 14, expert: 22 }
  };
  var DEFAULT_REF = { easy: 5, medium: 8, hard: 12, expert: 20 };
  var IDS = ["easy", "medium", "hard", "expert"];

  function refMs(type, tier) { return ((REF_MIN[type] || DEFAULT_REF)[tier] || 10) * 60000; }

  function recommend(records, type) {
    var mine = records.filter(function (r) { return r.type === type && r.tier && IDS.indexOf(r.tier) >= 0; }).sort(function (a, b) { return (b.endedAt || 0) - (a.endedAt || 0); });
    var cur = mine.length ? mine[0].tier : "easy", idx = IDS.indexOf(cur);
    var last = mine.filter(function (r) { return r.tier === cur; }).slice(0, 3);
    var out = { type: type, current: cur, recommended: cur, action: "stay", reason: "", evidence: last.length };
    if (!mine.length) { out.reason = "Chưa chơi loại này — bắt đầu ở bậc Dễ."; return out; }
    if (last.length < 3) { out.reason = "Chơi thêm " + (3 - last.length) + " ván ở bậc " + P.util.tier(cur).name + " để có đề xuất."; return out; }
    var ref = refMs(type, cur), solved = last.filter(function (r) { return r.result === "solved"; }), bad = last.filter(function (r) { return r.result !== "solved"; });
    var med = P.stats.median(last.map(function (r) { return r.time; }));
    var clean = solved.length === 3 && last.every(function (r) { return !r.hints && (r.mistakes || 0) <= 2; });
    if (clean && med <= 0.7 * ref && idx < 3) { out.action = "up"; out.recommended = IDS[idx + 1]; out.reason = "3 ván " + P.util.tier(cur).name + " gần nhất giải nhanh (trung vị " + P.util.fmtTime(med) + "), không gợi ý, ít lỗi — thử bậc " + P.util.tier(out.recommended).name + "."; return out; }
    if ((bad.length >= 2 || (med >= 2 * ref && last.every(function (r) { return (r.hints || 0) >= 3; }))) && idx > 0) { out.action = "down"; out.recommended = IDS[idx - 1]; out.reason = "Gần đây bậc " + P.util.tier(cur).name + " còn khó (" + (bad.length >= 2 ? bad.length + "/3 ván chưa tự giải" : "chậm và dùng nhiều gợi ý") + ") — luyện lại bậc " + P.util.tier(out.recommended).name + " cho chắc."; return out; }
    out.reason = "Giữ bậc " + P.util.tier(cur).name + " (trung vị " + P.util.fmtTime(med) + ", mốc tham khảo " + P.util.fmtTime(ref) + ").";
    return out;
  }

  P.progress = { recommend: recommend, refMs: refMs, REF_MIN: REF_MIN };
  if (typeof module !== "undefined" && module.exports) module.exports = P.progress;
})(typeof globalThis !== "undefined" ? globalThis : this);
