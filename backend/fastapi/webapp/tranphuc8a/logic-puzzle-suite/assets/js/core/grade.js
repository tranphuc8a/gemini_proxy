/* core/grade.js — CHẤM ĐIỂM TỐI ƯU (sao) cho loại puzzle có `def.grade` (HUONG-DAN-ENGINE.md mục 11). Thuần, chạy cả trong Web Worker (data-pz).

   Hợp đồng: def.grade(puzzle, state, counters) → { value, best, quality, stars, valueText, bestText, text }
     value, best   số (hoặc null nếu chưa có giá trị) — đơn vị là def.objective.unit
     quality       0..1 (3 chữ số thập phân): 1 = đạt tối ưu
     stars         số nguyên 0..3
     valueText, bestText   số đã định dạng KHÔNG kèm đơn vị ("1 480") — vỏ tự ghép "1 480 / 1 533 km"
     text          một câu tiếng Việt ("Tối ưu!", "Đạt 96 % mức tối ưu")
   Loại tối ưu theo tỉ lệ (lạc đà, xe máy, Bachet) dùng fromRatio(); loại tự đặt sao theo luật riêng (Lights Out theo par, cân xu phạt hoàn tác)
   vẫn trả đủ các trường. Vỏ không tin đầu ra của engine: normalize() kẹp khoảng và điền chữ còn thiếu trước khi hiện hay ghi lịch sử.

   Ngưỡng sao mặc định (starsFor): 3★ khi quality = 1 (sau khi làm tròn 3 chữ số — số thực từ hai đường tính khác nhau vẫn được tính là bằng),
   2★ khi quality ≥ 0,9, 1★ khi quality > 0, 0★ khi chưa đạt gì. */
(function (root) {
  "use strict";
  var P = root.Puz || (root.Puz = {});
  var NBSP = " ";

  function num(x) { return typeof x === "number" && isFinite(x) ? x : null; }
  function str(x) { return typeof x === "string" && x.trim() ? x : ""; }
  function round3(x) { return Math.round(x * 1000) / 1000; }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

  /** Số kiểu Việt Nam: nhóm nghìn bằng khoảng trắng không ngắt, dấu thập phân là phẩy, tối đa `digits` chữ số lẻ (mặc định 2), bỏ số 0 thừa. */
  function fmt(n, digits) {
    if (num(n) == null) return "—";
    var d = digits == null ? 2 : Math.max(0, Math.min(6, digits | 0)), neg = n < 0, s = Math.abs(n).toFixed(d), dot = s.indexOf(".");
    var ip = dot < 0 ? s : s.slice(0, dot), fp = dot < 0 ? "" : s.slice(dot + 1).replace(/0+$/, "");
    ip = ip.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
    return (neg && (ip !== "0" || fp) ? "-" : "") + ip + (fp ? "," + fp : "");
  }

  /** Mức đạt so với tối ưu. sense "max": value/best; "min": best/value. Bằng hoặc vượt tối ưu → 1; chưa có giá trị → 0. */
  function quality(value, best, sense) {
    value = num(value); best = num(best);
    if (value == null || best == null) return 0;
    if (sense === "min") {
      if (value <= best) return 1;
      return value > 0 && best >= 0 ? round3(clamp01(best / value)) : 0;
    }
    if (value >= best) return 1;
    return best > 0 && value > 0 ? round3(clamp01(value / best)) : 0;
  }
  function starsFor(q) { q = round3(clamp01(num(q) || 0)); return q >= 1 ? 3 : q >= 0.9 ? 2 : q > 0 ? 1 : 0; }
  function starsText(n) { n = Math.max(0, Math.min(3, Math.round(num(n) || 0))); return "★★★".slice(0, n) + "☆☆☆".slice(0, 3 - n); }
  function qualityText(q, stars) { return stars >= 3 ? "Tối ưu!" : "Đạt " + Math.floor(round3(q) * 100) + " % mức tối ưu"; }

  /** Kết quả grade đầy đủ từ một giá trị và giá trị tối ưu. opts: { digits, fmt(n) → chữ } */
  function fromRatio(value, best, sense, opts) {
    opts = opts || {};
    var f = typeof opts.fmt === "function" ? opts.fmt : function (n) { return fmt(n, opts.digits); };
    var v = num(value), b = num(best), q = quality(v, b, sense), s = starsFor(q);
    return { value: v, best: b, quality: q, stars: s, valueText: v == null ? "—" : f(v), bestText: b == null ? "—" : f(b), text: v == null ? "Chưa có giá trị để chấm" : qualityText(q, s) };
  }

  /** Kẹp và điền đầu ra của def.grade cho vỏ/lịch sử. Không phải đối tượng → null (vỏ coi như loại không chấm điểm). */
  function normalize(g) {
    if (!g || typeof g !== "object") return null;
    var q = num(g.quality); q = q == null ? 0 : round3(clamp01(q));
    var s = num(g.stars); s = s == null ? starsFor(q) : Math.max(0, Math.min(3, Math.round(s)));
    var v = num(g.value), b = num(g.best);
    return { value: v, best: b, quality: q, stars: s, valueText: str(g.valueText) || fmt(v), bestText: str(g.bestText) || fmt(b), text: str(g.text) || (v == null ? "Chưa có giá trị để chấm" : qualityText(q, s)) };
  }

  /** Lỗi hình dạng của một kết quả grade (rỗng = đạt) — test của từng loại dùng để đòi engine trả ĐỦ trường, không dựa vào normalize. */
  function errors(g) {
    var e = [];
    if (!g || typeof g !== "object") return ["grade phải trả một đối tượng"];
    ["value", "best"].forEach(function (k) { if (!(g[k] === null || num(g[k]) != null)) e.push(k + " phải là số hữu hạn hoặc null"); });
    if (num(g.quality) == null || g.quality < 0 || g.quality > 1) e.push("quality phải là số trong [0, 1]");
    if (num(g.stars) == null || g.stars !== Math.round(g.stars) || g.stars < 0 || g.stars > 3) e.push("stars phải là số nguyên 0..3");
    ["valueText", "bestText", "text"].forEach(function (k) { if (!str(g[k])) e.push(k + " phải là chuỗi khác rỗng"); else if (/\b(?:undefined|null|NaN)\b/.test(g[k])) e.push(k + " lọt chữ rác: " + g[k]); });
    return e;
  }

  /** "1 480 / 1 533 km" — giá trị / tối ưu + đơn vị (đơn vị lấy từ def.objective.unit). */
  function display(g, unit) {
    if (!g) return "";
    var u = str(unit) ? NBSP + unit : "";
    return (str(g.valueText) || fmt(g.value)) + (g.best != null ? " / " + (str(g.bestText) || fmt(g.best)) : "") + u;
  }

  P.grade = { fromRatio: fromRatio, quality: quality, starsFor: starsFor, starsText: starsText, normalize: normalize, errors: errors, display: display, fmt: fmt };
  if (typeof module !== "undefined" && module.exports) module.exports = P.grade;
})(typeof globalThis !== "undefined" ? globalThis : this);
