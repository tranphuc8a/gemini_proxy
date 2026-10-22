var src = require("fs").readFileSync("cw1.js", "utf8").split("console.log(\"k | ")[0].replace("\"use strict\";", "");
(0, eval)(src);
function safeFrac(s, k, mode) { var ws = weighings(s), safe = 0; ws.forEach(function (w) { if (outcomes(s, w).every(function (o) { return hyps(o.s, "dir") === 0 || solvable(o.s, k - 1, mode); })) safe++; }); return safe + "/" + ws.length; }
function row(label, mk, from, to, k, mode) { var o = []; for (var n = from; n <= to; n++) { var s = mk(n); o.push(n + ":" + (solvable(s, k, mode) ? safeFrac(s, k, mode) : "x")); } console.log(label, o.join("  ")); }
row("biết nặng k=2:", function (n) { return { u: 0, h: n, l: 0, g: 0 }; }, 3, 9, 2, "dir");
row("biết nặng k=3:", function (n) { return { u: 0, h: n, l: 0, g: 0 }; }, 10, 27, 3, "dir");
row("nặng/nhẹ k=3 :", function (n) { return { u: n, h: 0, l: 0, g: 0 }; }, 3, 12, 3, "dir");
row("+chuẩn k=3   :", function (n) { return { u: n, h: 0, l: 0, g: 1 }; }, 3, 13, 3, "dir");
row("chỉ tìm k=3  :", function (n) { return { u: n, h: 0, l: 0, g: 0 }; }, 3, 13, 3, "id");
row("nặng/nhẹ k=4 :", function (n) { return { u: n, h: 0, l: 0, g: 0 }; }, 30, 39, 4, "dir");
// cây quyết định: số nút của chiến lược tối ưu (chọn phép cân an toàn đầu tiên theo thứ tự cân bằng nhất)
function treeSize(s, k, mode) { if (terminal(s, mode)) return 1; var ws = weighings(s), best = null;
  ws.forEach(function (w) { var os = outcomes(s, w); if (!os.every(function (o) { return hyps(o.s, "dir") === 0 || solvable(o.s, k - 1, mode); })) return; var mx = Math.max.apply(null, os.map(function (o) { return hyps(o.s, "dir"); })); if (!best || mx < best.mx) best = { w: w, os: os, mx: mx }; });
  var n = 1; best.os.forEach(function (o) { if (hyps(o.s, "dir")) n += treeSize(o.s, k - 1, mode); }); return n; }
console.log("số nút cây quyết định: 12/3 =", treeSize({ u: 12, h: 0, l: 0, g: 0 }, 3, "dir"), "; 39/4 =", treeSize({ u: 39, h: 0, l: 0, g: 0 }, 4, "dir"), "; 27 biết nặng/3 =", treeSize({ u: 0, h: 27, l: 0, g: 0 }, 3, "dir"), "; 40+chuẩn/4 =", treeSize({ u: 40, h: 0, l: 0, g: 1 }, 4, "dir"));
