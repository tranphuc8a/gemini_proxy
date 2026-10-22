var src = require("fs").readFileSync("cw3.js", "utf8"); src = src.replace('"use strict";', '');
var a = src.indexOf("// ---------- thích nghi"), b = src.indexOf('console.log("Thích nghi');
(0, eval)(src.slice(0, src.indexOf("console.log(\"Không thích nghi")) + src.slice(a, b));
var t = Date.now(); console.log("A(6) =", adaptiveMin(6, 5), (Date.now() - t) + " ms");
