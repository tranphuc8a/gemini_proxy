var src = require("fs").readFileSync("cw1.js", "utf8").split("console.log(\"k | ")[0].replace("\"use strict\";", "");
(0, eval)(src);
function T(label, f) { var t = Date.now(); var r = f(); console.log(label, r, (Date.now() - t) + " ms"); }
T("39 xu,4 lần, hướng", function () { return solvable({ u: 39, h: 0, l: 0, g: 0 }, 4, "dir"); });
T("40 xu+chuẩn,4 lần", function () { return solvable({ u: 40, h: 0, l: 0, g: 1 }, 4, "dir"); });
T("40 xu,4 lần (không được)", function () { return solvable({ u: 40, h: 0, l: 0, g: 0 }, 4, "dir"); });
T("81 xu biết nặng, 4 lần", function () { return solvable({ u: 0, h: 81, l: 0, g: 0 }, 4, "dir"); });
T("memo", function () { return memo.size; });
