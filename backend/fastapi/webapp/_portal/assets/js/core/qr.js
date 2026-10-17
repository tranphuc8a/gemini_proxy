/* qr.js — bộ tạo mã QR (chế độ byte, sửa lỗi M rồi L, phiên bản 1–10) không dùng thư viện ngoài.
   Dùng để mở nhanh một app (hoặc cả cổng) trên điện thoại: quét mã thay vì gõ địa chỉ.
   Thuật toán theo ISO/IEC 18004; kiểm trong kiem.js bằng một bộ giải mã viết riêng (đọc lại đúng chuỗi, đa thức sửa lỗi triệt tiêu).
   Sức chứa byte-mode: M v1…v10 = 14, 26, 42, 62, 84, 106, 122, 152, 180, 213; L tới 271 byte — đủ cho mọi địa chỉ của cổng. */
(function (root) {
  "use strict";
  var P = root.Portal || (root.Portal = {});

  var FORMAT_BITS = { L: 1, M: 0 };                                   // mã hoá mức sửa lỗi trong thông tin định dạng
  // Đã đối chiếu với tổng số codeword (26, 44, 70, 100, 134, 172, 196, 242, 292, 346) và sức chứa dữ liệu đã công bố.
  var ECC_PER_BLOCK = { L: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18], M: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26] };
  var NUM_BLOCKS = { L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4], M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5] };
  var MAX_VERSION = 10;

  function utf8(text) {
    var out = [], enc = unescape(encodeURIComponent(String(text)));
    for (var i = 0; i < enc.length; i++) out.push(enc.charCodeAt(i));
    return out;
  }

  function numRawDataModules(ver) {
    var r = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      var n = Math.floor(ver / 7) + 2;
      r -= (25 * n - 10) * n - 55;
      if (ver >= 7) r -= 36;
    }
    return r;
  }

  function numDataCodewords(ver, ecl) {
    return Math.floor(numRawDataModules(ver) / 8) - ECC_PER_BLOCK[ecl][ver] * NUM_BLOCKS[ecl][ver];
  }

  // ---- Reed–Solomon trên GF(256), đa thức sinh x^8+x^4+x^3+x^2+1
  function gfMul(x, y) {
    var z = 0;
    for (var i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; }
    return z;
  }

  function rsDivisor(degree) {
    var result = [], i, j;
    for (i = 0; i < degree - 1; i++) result.push(0);
    result.push(1);
    var rootv = 1;
    for (i = 0; i < degree; i++) {
      for (j = 0; j < result.length; j++) {
        result[j] = gfMul(result[j], rootv);
        if (j + 1 < result.length) result[j] ^= result[j + 1];
      }
      rootv = gfMul(rootv, 0x02);
    }
    return result;
  }

  function rsRemainder(data, divisor) {
    var result = divisor.map(function () { return 0; });
    data.forEach(function (b) {
      var factor = b ^ result.shift();
      result.push(0);
      divisor.forEach(function (coef, i) { result[i] ^= gfMul(coef, factor); });
    });
    return result;
  }

  function addEccAndInterleave(data, ver, ecl) {
    var numBlocks = NUM_BLOCKS[ecl][ver], blockEccLen = ECC_PER_BLOCK[ecl][ver];
    var rawCodewords = Math.floor(numRawDataModules(ver) / 8);
    var numShort = numBlocks - rawCodewords % numBlocks, shortLen = Math.floor(rawCodewords / numBlocks);
    var blocks = [], div = rsDivisor(blockEccLen);
    for (var i = 0, k = 0; i < numBlocks; i++) {
      var dat = data.slice(k, k + shortLen - blockEccLen + (i < numShort ? 0 : 1));
      k += dat.length;
      var ecc = rsRemainder(dat, div);
      if (i < numShort) dat.push(0);
      blocks.push(dat.concat(ecc));
    }
    var result = [];
    for (var c = 0; c < blocks[0].length; c++) {
      for (var b = 0; b < blocks.length; b++) {
        if (c !== shortLen - blockEccLen || b >= numShort) result.push(blocks[b][c]);
      }
    }
    return result;
  }

  function alignmentPositions(ver) {
    if (ver === 1) return [];
    var n = Math.floor(ver / 7) + 2, size = ver * 4 + 17;
    var step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
    var out = [6];
    for (var pos = size - 7; out.length < n; pos -= step) out.splice(1, 0, pos);
    return out;
  }

  function bit(x, i) { return ((x >>> i) & 1) !== 0; }

  var MASKS = [
    function (x, y) { return (x + y) % 2 === 0; },
    function (x, y) { return y % 2 === 0; },
    function (x, y) { return x % 3 === 0; },
    function (x, y) { return (x + y) % 3 === 0; },
    function (x, y) { return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; },
    function (x, y) { return x * y % 2 + x * y % 3 === 0; },
    function (x, y) { return (x * y % 2 + x * y % 3) % 2 === 0; },
    function (x, y) { return ((x + y) % 2 + x * y % 3) % 2 === 0; }
  ];

  function penalty(m, size) {
    var result = 0, x, y, i, j, dark = 0, line, s, run, color;
    for (var dir = 0; dir < 2; dir++) {
      for (i = 0; i < size; i++) {
        line = [];
        for (j = 0; j < size; j++) line.push(dir === 0 ? m[i][j] : m[j][i]);
        color = -1; run = 0;
        for (j = 0; j < size; j++) {
          if (line[j] === color) { run++; if (run === 5) result += 3; else if (run > 5) result++; } else { color = line[j]; run = 1; }
        }
        s = line.join("");
        ["10111010000", "00001011101"].forEach(function (pat) {
          for (var at = s.indexOf(pat); at !== -1; at = s.indexOf(pat, at + 1)) result += 40;
        });
      }
    }
    for (y = 0; y < size; y++) {
      for (x = 0; x < size; x++) {
        if (m[y][x]) dark++;
        if (y < size - 1 && x < size - 1 && m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) result += 3;
      }
    }
    var total = size * size;
    return result + (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
  }

  function buildMatrix(ver, codewords, ecl) {
    var size = ver * 4 + 17, m = [], isFn = [], i, j;
    for (i = 0; i < size; i++) { m.push(new Array(size).fill(0)); isFn.push(new Array(size).fill(false)); }
    function setFn(x, y, dark) { m[y][x] = dark ? 1 : 0; isFn[y][x] = true; }

    function drawFinder(cx, cy) {
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
        var dist = Math.max(Math.abs(dx), Math.abs(dy)), xx = cx + dx, yy = cy + dy;
        if (xx >= 0 && xx < size && yy >= 0 && yy < size) setFn(xx, yy, dist !== 2 && dist !== 4);
      }
    }
    function drawAlign(cx, cy) {
      for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) setFn(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
    function drawFormat(mask) {
      var data = FORMAT_BITS[ecl] << 3 | mask, rem = data, k;
      for (k = 0; k < 10; k++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      var bits = (data << 10 | rem) ^ 0x5412;
      for (k = 0; k <= 5; k++) setFn(8, k, bit(bits, k));
      setFn(8, 7, bit(bits, 6)); setFn(8, 8, bit(bits, 7)); setFn(7, 8, bit(bits, 8));
      for (k = 9; k < 15; k++) setFn(14 - k, 8, bit(bits, k));
      for (k = 0; k < 8; k++) setFn(size - 1 - k, 8, bit(bits, k));
      for (k = 8; k < 15; k++) setFn(8, size - 15 + k, bit(bits, k));
      setFn(8, size - 8, true);
    }
    function drawVersion() {
      if (ver < 7) return;
      var rem = ver, k;
      for (k = 0; k < 12; k++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
      var bits = ver << 12 | rem;
      for (k = 0; k < 18; k++) {
        var a = size - 11 + k % 3, b = Math.floor(k / 3);
        setFn(a, b, bit(bits, k)); setFn(b, a, bit(bits, k));
      }
    }

    for (i = 0; i < size; i++) { setFn(6, i, i % 2 === 0); setFn(i, 6, i % 2 === 0); }
    drawFinder(3, 3); drawFinder(size - 4, 3); drawFinder(3, size - 4);
    var ap = alignmentPositions(ver), n = ap.length;
    for (i = 0; i < n; i++) for (j = 0; j < n; j++) {
      if (!((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0))) drawAlign(ap[i], ap[j]);
    }
    drawFormat(0); drawVersion();

    var idx = 0;                                                       // chỉ số bit, đi zigzag từ góc dưới phải
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) {
        for (j = 0; j < 2; j++) {
          var x = right - j, upward = ((right + 1) & 2) === 0, y = upward ? size - 1 - vert : vert;
          if (!isFn[y][x] && idx < codewords.length * 8) { m[y][x] = bit(codewords[idx >>> 3], 7 - (idx & 7)) ? 1 : 0; idx++; }
        }
      }
    }

    function applyMask(mask) {
      for (var y2 = 0; y2 < size; y2++) for (var x2 = 0; x2 < size; x2++) if (!isFn[y2][x2] && MASKS[mask](x2, y2)) m[y2][x2] ^= 1;
    }
    var best = 0, bestScore = Infinity;
    for (var mask = 0; mask < 8; mask++) {
      applyMask(mask); drawFormat(mask);
      var sc = penalty(m, size);
      if (sc < bestScore) { bestScore = sc; best = mask; }
      applyMask(mask);
    }
    applyMask(best); drawFormat(best);
    return { size: size, version: ver, ecl: ecl, mask: best, modules: m, get: function (x, y) { return x >= 0 && y >= 0 && x < size && y < size && m[y][x] === 1; } };
  }

  /** Chuỗi → mã QR. Ném Error tiếng Việt nếu quá dài (> 271 byte). */
  function encode(text) {
    var bytes = utf8(text), ecls = ["M", "L"];
    for (var e = 0; e < ecls.length; e++) {
      var ecl = ecls[e];
      for (var ver = 1; ver <= MAX_VERSION; ver++) {
        var cc = ver < 10 ? 8 : 16, cap = numDataCodewords(ver, ecl) * 8;
        if (4 + cc + bytes.length * 8 > cap) continue;
        var bits = [];
        var push = function (val, len) { for (var i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
        push(4, 4); push(bytes.length, cc);
        bytes.forEach(function (b) { push(b, 8); });
        push(0, Math.min(4, cap - bits.length));
        push(0, (8 - bits.length % 8) % 8);
        for (var pad = 0xEC; bits.length < cap; pad ^= 0xEC ^ 0x11) push(pad, 8);
        var data = [];
        for (var k = 0; k < bits.length; k += 8) data.push(parseInt(bits.slice(k, k + 8).join(""), 2));
        return buildMatrix(ver, addEccAndInterleave(data, ver, ecl), ecl);
      }
    }
    throw new Error("Địa chỉ quá dài để tạo mã QR.");
  }

  /** SVG một đường (path) — nét đứt gộp theo hàng cho gọn; `border` = viền trắng (mô-đun), chuẩn là 4. */
  function toSvg(qr, border) {
    var b = border == null ? 4 : border, d = "", x, y;
    for (y = 0; y < qr.size; y++) {
      for (x = 0; x < qr.size; x++) {
        if (!qr.get(x, y)) continue;
        var start = x;
        while (x + 1 < qr.size && qr.get(x + 1, y)) x++;
        d += "M" + (start + b) + "," + (y + b) + "h" + (x - start + 1) + "v1h-" + (x - start + 1) + "z";
      }
    }
    var n = qr.size + b * 2;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + n + " " + n + '" shape-rendering="crispEdges" role="img">' +
      '<rect width="' + n + '" height="' + n + '" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
  }

  P.qr = { encode: encode, toSvg: toSvg, utf8: utf8, _t: { numDataCodewords: numDataCodewords, numRawDataModules: numRawDataModules, alignmentPositions: alignmentPositions, ECC_PER_BLOCK: ECC_PER_BLOCK, NUM_BLOCKS: NUM_BLOCKS, MAX_VERSION: MAX_VERSION } };
  if (typeof module !== "undefined" && module.exports) module.exports = P.qr;
})(typeof globalThis !== "undefined" ? globalThis : this);
