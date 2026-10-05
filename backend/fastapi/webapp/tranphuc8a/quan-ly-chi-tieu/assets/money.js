/* money.js — tiền: đọc cách người Việt viết, in ra, chia không lệch đồng.

   Đơn vị lưu là ĐỒNG, luôn là SỐ NGUYÊN. Không bao giờ cộng tiền bằng số thực:
   sau vài trăm giao dịch, tổng sẽ lệch vài đồng mà không ai biết lệch ở đâu.
   Thuần: không DOM, không storage. */
(function (root) {
  "use strict";
  var QL = root.QL || (root.QL = {});

  var MAX = 1e13; // 10 nghìn tỷ — quá mức này gần như chắc chắn là gõ nhầm

  /* Bảng đơn vị đã bỏ dấu. "k" là nghìn; "m" là triệu (người Việt viết 12M = 12 triệu). */
  var UNIT = {
    k: 1e3, nghin: 1e3, ngan: 1e3,
    tr: 1e6, trieu: 1e6, m: 1e6,
    ty: 1e9, ti: 1e9
  };

  /** a * b / c, làm tròn nửa lên, không mất chính xác khi tích vượt 2^53. */
  function mulDiv(a, b, c) {
    var A = BigInt(a), B = BigInt(b), C = BigInt(c);
    var neg = (A < 0n) !== (B < 0n);
    var n = (A < 0n ? -A : A) * (B < 0n ? -B : B);
    var q = (n * 2n + C) / (2n * C);
    return Number(neg ? -q : q);
  }

  /** Đọc phần số (chưa nhân đơn vị) của một số hạng. `hasUnit`: sau số có k/tr/…
      `unitMult`: bội số của đơn vị đó. Trả số thực (chưa làm tròn). */
  function readNumber(num, hasUnit, unitMult) {
    var seps = num.match(/[.,]/g) || [];
    if (!seps.length) return parseInt(num, 10);

    var lastDot = Math.max(num.lastIndexOf("."), num.lastIndexOf(","));
    var after = num.length - lastDot - 1;

    if (seps.length >= 2) {
      var mixed = num.indexOf(".") !== -1 && num.indexOf(",") !== -1;
      if (mixed) {
        // "1.234,5": dấu cuối là thập phân, các dấu trước là ngăn nghìn.
        var head = num.slice(0, lastDot).replace(/[.,]/g, "");
        return parseFloat(head + "." + num.slice(lastDot + 1));
      }
      // Cùng một loại dấu lặp lại: "19.485.250" — toàn bộ là ngăn nghìn.
      return parseInt(num.replace(/[.,]/g, ""), 10);
    }

    // Đúng một dấu.
    if (after === 3) {
      // "50.000" / "3.520K": ba chữ số sau dấu là ngăn nghìn — trừ khi đơn vị là
      // triệu trở lên ("1.250tr" là 1,25 triệu chứ không phải 1250 triệu).
      if (!hasUnit || unitMult === 1e3) return parseInt(num.replace(/[.,]/g, ""), 10);
    }
    return parseFloat(num.replace(",", "."));
  }

  var TERM = /([+\-]?)\s*(\d[\d.,]*)\s*(nghin|ngan|trieu|tr|ty|ti|k|m)?(?![a-z0-9])/g;

  /**
   * Đọc một chuỗi người dùng gõ thành số đồng nguyên.
   * Chấp nhận: 50000 · 50.000 · 50,000 · 50k · 61.5k · 1,5tr · 2 triệu · 19.485.250 · 3.520K
   *            87k - 50k · 60+57+68+55,5 · "… = 37k" (lấy vế sau dấu = cuối).
   * Số trần < 1.000 hiểu là NGHÌN khi `smallAsThousand` (mặc định bật): "57" → 57.000.
   * @returns {{ok:boolean, value:number}} value = 0 khi không đọc được.
   */
  function parse(input, opts) {
    var small = !(opts && opts.smallAsThousand === false);
    if (typeof input === "number") {
      return isFinite(input) && Math.abs(input) <= MAX
        ? { ok: true, value: Math.round(input) } : { ok: false, value: 0 };
    }
    var s = QL.text.fold(input)
      .replace(/₫|vnd|vnđ/g, " ")
      .replace(/(\d)\s*d(?![a-z0-9])/g, "$1 ")   // "50000d" / "50.000 đ"
      .replace(/−|–/g, "-")             // dấu trừ thật và gạch ngang
      .trim();
    var eq = s.lastIndexOf("=");
    if (eq !== -1) s = s.slice(eq + 1).trim();
    if (!s) return { ok: false, value: 0 };

    TERM.lastIndex = 0;
    var total = 0, consumed = 0, count = 0, m;
    var lead = true;
    while ((m = TERM.exec(s)) !== null) {
      // Giữa hai số hạng chỉ được có khoảng trắng; ký tự lạ nghĩa là không phải một khoản tiền.
      if (s.slice(consumed, m.index).trim() !== "") return { ok: false, value: 0 };
      consumed = m.index + m[0].length;
      count++;

      var unit = m[3] || "";
      var mult = unit ? UNIT[unit] : 1;
      // "57." (dấu chấm câu cuối) được bỏ; "1..2" thì không phải số.
      var num = m[2].replace(/[.,]+$/, "");
      if (/[.,]{2}/.test(num)) return { ok: false, value: 0 };
      var base = readNumber(num, !!unit, mult);
      if (isNaN(base)) return { ok: false, value: 0 };
      var v = Math.round(base * mult);
      if (!unit && small && Math.abs(base) < 1000 && base !== 0) v = Math.round(base * 1000);

      // Số hạng sau số hạng đầu mà không có dấu thì không hợp lệ ("57 58").
      if (!lead && !m[1]) return { ok: false, value: 0 };
      lead = false;
      total += m[1] === "-" ? -v : v;
    }
    if (!count || s.slice(consumed).trim() !== "") return { ok: false, value: 0 };
    if (Math.abs(total) > MAX) return { ok: false, value: 0 };
    return { ok: true, value: total };
  }

  var MINUS = "−";

  /** 1234567 → "1.234.567 ₫"; âm dùng dấu trừ thật (U+2212). */
  function format(n, withUnit) {
    n = Math.round(Number(n) || 0);
    var s = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return (n < 0 ? MINUS : "") + s + (withUnit === false ? "" : " ₫");
  }

  /** Dạng gọn cho nhãn trục: 50000 → "50k", 1500000 → "1,5tr". */
  function compact(n) {
    n = Math.round(Number(n) || 0);
    var a = Math.abs(n), sign = n < 0 ? MINUS : "";
    function one(x, suffix) {
      var t = (Math.round(x * 10) / 10).toString().replace(".", ",");
      return sign + t + suffix;
    }
    if (a >= 1e9) return one(a / 1e9, "tỷ");
    if (a >= 1e6) return one(a / 1e6, "tr");
    if (a >= 1e3) return one(a / 1e3, "k");
    return sign + a;
  }

  /**
   * Chia `total` đồng theo `weights` (số nguyên dương) mà tổng các phần LUÔN bằng
   * `total`. Phần dư phân cho các chỉ số có phần lẻ lớn nhất; hoà thì chỉ số nhỏ trước.
   * Chia đều: allocate(100001, [1,1]) → [50001, 50000].
   */
  function allocate(total, weights) {
    var n = weights.length;
    if (!n) return [];
    total = Math.round(total);
    var neg = total < 0;
    var T = BigInt(Math.abs(total));
    var w = weights.map(function (x) { return BigInt(Math.max(0, Math.round(x))); });
    var W = w.reduce(function (a, b) { return a + b; }, 0n);
    if (W === 0n) { w = w.map(function () { return 1n; }); W = BigInt(n); }

    var base = [], rems = [], used = 0n;
    for (var i = 0; i < n; i++) {
      var part = (T * w[i]) / W;
      base.push(part);
      rems.push({ i: i, r: (T * w[i]) % W });
      used += part;
    }
    var left = Number(T - used);
    rems.sort(function (a, b) { return a.r === b.r ? a.i - b.i : (a.r > b.r ? -1 : 1); });
    for (var k = 0; k < left; k++) base[rems[k].i] += 1n;
    return base.map(function (x) { var v = Number(x); return neg ? -v : v; });
  }

  QL.money = { parse: parse, format: format, compact: compact, allocate: allocate, mulDiv: mulDiv, MAX: MAX };
  if (typeof module !== "undefined" && module.exports) module.exports = QL.money;
})(typeof globalThis !== "undefined" ? globalThis : this);
