// đo Kmean (số bấm tối thiểu trung bình của bàn ngẫu nhiên) và thời gian phân tích theo (luật, mép, k, cỡ)
var L = require("./lox-nap.js"), T = L.T;
var sizes = (process.argv[2] || "5,7,10").split(",").map(Number);
var out = [];
T.lib.RULE_IDS.forEach(function (rule) { ["flat", "torus"].forEach(function (topo) { [2, 3, 5].forEach(function (k) {
  var row = [];
  sizes.forEach(function (n) {
    var spec = { w: n, h: n, rule: rule, topo: topo, k: k, holes: [] }, t0 = Date.now();
    var an = T.lib.analyse(spec, T.lib.randomPresses(spec, n * n * k, 77)), t1 = Date.now() - t0;
    var sc = T.lib.scoreOf(spec, 5);
    row.push(n + ": nul=" + an.nullity + (an.minimal ? "" : "!") + " K=" + an.weight + " " + t1 + "ms");
  });
  out.push(rule + "|" + topo + "|" + k + "  " + row.join("  |  "));
}); }); });
console.log(out.join("\n"));
