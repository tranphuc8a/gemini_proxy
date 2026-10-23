/* core/plan.js — TRẠNG THÁI = KẾ HOẠCH cho puzzle tương tác / tối ưu (HUONG-DAN-ENGINE.md mục 11). Thuần, chạy cả trong Web Worker (data-pz).

   Puzzle kiểu "nộp một kế hoạch" (lạc đà, xe máy), "dãy lần cân rồi kết luận" (cân xu) không có lưới ô cố định, nhưng game.js chỉ biết
   state.v là mảng số nguyên ĐỘ DÀI CỐ ĐỊNH + diff [trường, i, cũ, mới]. Vì vậy kế hoạch được mã hoá thành:

     state.v = [ nộp, len, p_0 … p_{extra−1}, rec_0 (W số), rec_1 (W số), …, rec_{cap−1} ]      độ dài = 2 + extra + cap·W
       nộp    0 = đang soạn, 1 = đã nộp / đã kết luận (cờ NẰM TRONG state ⇒ solution.v chứa cờ ⇒ Reveal và check(solution) chạy đúng)
       len    số bản ghi đang dùng; mọi ô sau bản ghi cuối LUÔN = 0 (trạng thái chuẩn: cùng kế hoạch ⇒ cùng mảng ⇒ so bằng ===)
       p_*    tham số đi kèm lần nộp ("kết luận = nộp kèm tham số": xu giả, nặng/nhẹ…); 0 khi chưa nộp
   Mỗi thao tác là MỘT diff (thêm bản ghi, quay về sau bước n, nộp) nên hoàn tác/làm lại, tự lưu, khôi phục sau sập, replay dùng y nguyên game.js.

   L = layout(cap, W, extra) mô tả hình dạng; mọi hàm nhận L. Các hàm *Diff trả null khi không hợp lệ (tràn dung lượng, đã nộp…) — moveFor
   trả thẳng null đó, game.act coi là "noop" (không ném lỗi). */
(function (root) {
  "use strict";
  var P = root.Puz || (root.Puz = {});
  var SUB = 0, LEN = 1, HEAD = 2;

  function isInt(x) { return typeof x === "number" && x === Math.floor(x) && isFinite(x); }
  function layout(cap, W, extra) {
    cap = cap | 0; W = W | 0; extra = extra | 0;
    if (cap < 1 || W < 1 || extra < 0) throw new Error("plan.layout: cần cap ≥ 1, W ≥ 1, extra ≥ 0");
    return { cap: cap, W: W, extra: extra, head: HEAD + extra, size: HEAD + extra + cap * W };
  }
  function empty(L) { var v = new Array(L.size); for (var i = 0; i < v.length; i++) v[i] = 0; return v; }
  function count(state) { return state.v[LEN] | 0; }
  function isSubmitted(state) { return state.v[SUB] !== 0; }
  function params(state, L) { return state.v.slice(HEAD, HEAD + L.extra); }
  function record(state, L, i) { var o = L.head + i * L.W; return state.v.slice(o, o + L.W); }
  function read(state, L) { var out = [], n = count(state); for (var i = 0; i < n; i++) out.push(record(state, L, i)); return out; }

  /** Một bản ghi [a, b, …] hoặc nhiều bản ghi [[…], […]] → mảng bản ghi (null nếu sai hình dạng). */
  function asRecords(recs, W) {
    if (!Array.isArray(recs) || !recs.length) return null;
    var list = typeof recs[0] === "number" ? [recs] : recs;
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      if (!Array.isArray(r) || r.length !== W) return null;
      for (var k = 0; k < W; k++) if (!isInt(r[k])) return null;
    }
    return list;
  }

  /** Thêm một hoặc nhiều bản ghi vào cuối kế hoạch. null nếu đã nộp, sai hình dạng hoặc vượt dung lượng cap. */
  function appendDiff(state, L, recs, label) {
    if (isSubmitted(state)) return null;
    var list = asRecords(recs, L.W), n = count(state);
    if (!list || n + list.length > L.cap) return null;
    var d = [];
    for (var j = 0; j < list.length; j++) for (var k = 0; k < L.W; k++) {
      var i = L.head + (n + j) * L.W + k;
      if (state.v[i] !== list[j][k]) d.push(["v", i, state.v[i], list[j][k]]);
    }
    d.push(["v", LEN, n, n + list.length]);
    return { d: d, label: label || (list.length > 1 ? "Thêm " + list.length + " bước" : "Thêm bước " + (n + 1)) };
  }

  /** Quay kế hoạch về n bước đầu (xoá phần sau về 0). Đang ở trạng thái đã nộp thì đồng thời MỞ LẠI (xoá cờ + tham số) — n = len chỉ mở lại.
      null nếu n ngoài [0, len] hoặc không có gì đổi. */
  function truncateDiff(state, L, n, label) {
    var len = count(state), sub = state.v[SUB], d = [], i;
    if (!isInt(n) || n < 0 || n > len) return null;
    if (n === len && !sub) return null;
    if (sub) { d.push(["v", SUB, sub, 0]); for (i = HEAD; i < HEAD + L.extra; i++) if (state.v[i] !== 0) d.push(["v", i, state.v[i], 0]); }
    for (i = L.head + n * L.W; i < L.head + len * L.W; i++) if (state.v[i] !== 0) d.push(["v", i, state.v[i], 0]);
    if (n !== len) d.push(["v", LEN, len, n]);
    return { d: d, label: label || (n === len ? "Mở lại kế hoạch" : n === 0 ? "Xoá cả kế hoạch" : "Quay về sau bước " + n) };
  }

  /** Nộp (hoặc kết luận, kèm tham số ps — tối đa L.extra số nguyên). null nếu đã nộp hay tham số sai. */
  function submitDiff(state, L, ps, label) {
    if (isSubmitted(state)) return null;
    ps = ps || [];
    if (!Array.isArray(ps) || ps.length > L.extra || !ps.every(isInt)) return null;
    var d = [["v", SUB, state.v[SUB], 1]];
    for (var k = 0; k < ps.length; k++) if (state.v[HEAD + k] !== ps[k]) d.push(["v", HEAD + k, state.v[HEAD + k], ps[k]]);
    return { d: d, label: label || "Nộp kế hoạch" };
  }

  /** Dựng state.v từ danh sách bản ghi (cho initial / solution). submitted mặc định 0; ps = tham số khi nộp. null nếu không vừa. */
  function build(L, recs, submitted, ps) {
    var v = empty(L), list = recs && recs.length ? asRecords(recs, L.W) : [];
    if (!list || list.length > L.cap) return null;
    list.forEach(function (r, j) { for (var k = 0; k < L.W; k++) v[L.head + j * L.W + k] = r[k]; });
    v[LEN] = list.length; v[SUB] = submitted ? 1 : 0;
    (ps || []).forEach(function (x, k) { if (k < L.extra) v[HEAD + k] = x; });
    return v;
  }

  /** state.v đúng hình dạng L và ở dạng chuẩn (ô thừa = 0, chưa nộp thì tham số = 0)? Dùng cho fromFile/khôi phục và test. */
  function valid(state, L) {
    var v = state && state.v;
    if (!Array.isArray(v) || v.length !== L.size || !v.every(isInt)) return false;
    var n = v[LEN];
    if (n < 0 || n > L.cap || (v[SUB] !== 0 && v[SUB] !== 1)) return false;
    for (var i = L.head + n * L.W; i < L.size; i++) if (v[i] !== 0) return false;
    if (!v[SUB]) for (i = HEAD; i < HEAD + L.extra; i++) if (v[i] !== 0) return false;
    return true;
  }

  P.plan = { layout: layout, empty: empty, count: count, isSubmitted: isSubmitted, params: params, record: record, read: read,
    appendDiff: appendDiff, truncateDiff: truncateDiff, submitDiff: submitDiff, build: build, valid: valid, SUB: SUB, LEN: LEN, HEAD: HEAD };
  if (typeof module !== "undefined" && module.exports) module.exports = P.plan;
})(typeof globalThis !== "undefined" ? globalThis : this);
