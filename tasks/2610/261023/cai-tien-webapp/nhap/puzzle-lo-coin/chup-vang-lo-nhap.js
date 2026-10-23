// P2/B1 — chụp 40 bàn tự nhập (fromInput) cho mẫu vàng: node chup-vang-lo-nhap.js — dán vào kiem/lightsout-vang.js (NHAP).
"use strict";
var path = require("path");
var ROOT = path.join(__dirname, "..", "..", "..", "..", "..", "..", "backend", "fastapi", "webapp", "tranphuc8a", "logic-puzzle-suite");
["assets/js/core/text.js", "assets/js/core/rng.js", "assets/js/core/util.js", "assets/js/core/csp.js", "assets/js/core/types.js", "assets/js/core/grade.js", "assets/js/core/plan.js", "assets/js/core/game.js"].forEach(function (r) { require(path.join(ROOT, r)); });
require(path.join(ROOT, "assets/js/puzzles/lightsout.js"));
var Puz = globalThis.Puz, T = Puz.types.get("lightsout"), H = Puz.rng.hash32, rr = Puz.rng.create(2310);
var out = [];
for (var k = 0; k < 40; k++) {
  var w = 2 + rr.int(9), h = 2 + rr.int(9), N = w * h, v = [];
  for (var i = 0; i < N; i++) v.push(rr.int(2));
  var o = T.fromInput({ w: w, h: h, v: v });
  out.push([w, h, v.join(""), o.status, H(JSON.stringify(o.puzzle)).toString(36)]);
}
console.log("  var NHAP = " + JSON.stringify(out) + ";");
