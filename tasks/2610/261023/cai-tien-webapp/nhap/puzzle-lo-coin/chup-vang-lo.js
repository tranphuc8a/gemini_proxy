// P2/B1 — chụp mẫu vàng Lights Out (chạy với engine TRƯỚC khi sửa): node chup-vang-lo.js > bang.txt — dán vào kiem/lightsout-vang.js (SEEDS, VANG).
"use strict";
var path = require("path");
var ROOT = path.join(__dirname, "..", "..", "..", "..", "..", "..", "backend", "fastapi", "webapp", "tranphuc8a", "logic-puzzle-suite");
["assets/js/core/text.js", "assets/js/core/rng.js", "assets/js/core/util.js", "assets/js/core/csp.js", "assets/js/core/types.js", "assets/js/core/grade.js", "assets/js/core/plan.js", "assets/js/core/game.js"].forEach(function (r) { require(path.join(ROOT, r)); });
require(path.join(ROOT, "assets/js/puzzles/lightsout.js"));
var Puz = globalThis.Puz, T = Puz.types.get("lightsout"), H = Puz.rng.hash32;
var SEEDS = [1, 2, 3, 7, 42, 99, 100, 777, 1234, 2026, 4242, 65535, 99991, 123456, 424242, 1000033, 20261017, 20261023, 87654321, 4294967295];
function hex(v) { var s = ""; for (var i = 0; i < v.length; i += 4) { var n = 0; for (var k = 0; k < 4 && i + k < v.length; k++) n |= v[i + k] << k; s += n.toString(16); } return s; }
var lines = [], n = 0;
T.sizes.forEach(function (sz) {
  sz.tiers.forEach(function (tier) {
    var row = [];
    SEEDS.forEach(function (seed) {
      var p = T.generate(seed, { sizeId: sz.id, tier: tier });
      row.push([p.id.replace(/^lightsout-/, ""), p.score, p.tier, hex(p.initial.v), H(JSON.stringify(p)).toString(36)]);
      n++;
    });
    lines.push('    "' + sz.id + "|" + tier + '": ' + JSON.stringify(row));
  });
});
console.log("  var SEEDS = " + JSON.stringify(SEEDS) + ";");
console.log("  var VANG = {\n" + lines.join(",\n") + "\n  };");
console.error("tổng " + n + " puzzle");
