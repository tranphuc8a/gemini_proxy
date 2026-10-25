// chụp MẪU VÀNG của lightsoutx: (cấu hình × cỡ × bậc × seed) → id, score, tier, hash32 của cả puzzle; + vài bàn tự nhập. In ra bảng để dán vào kiem/lightsoutx-vang.js
var L = require("./lox-nap.js"), T = L.T, R = L.Puz.rng;
var CONF = [{}, { rule: "x" }, { rule: "king", topo: "torus" }, { rule: "knight", k: "3" }, { rule: "plus2", k: "5", holes: "few" }, { topo: "torus", k: "3" }, { k: "5" }, { rule: "king", holes: "some" }, { rule: "cross", topo: "torus", holes: "few" }, { rule: "knight", topo: "torus", k: "5", holes: "some" }];
var SZ = [["4", "easy"], ["5", "medium"], ["7", "hard"], ["10", "expert"]], rows = [], i = 0;
CONF.forEach(function (o, ci) { SZ.forEach(function (z, zi) { [11, 2026102].forEach(function (seed, si) {
  var p = T.generate(seed + ci, { sizeId: z[0], tier: z[1], options: o });
  rows.push([ci, z[0], z[1], seed + ci, p.id, p.score, p.tier, R.hash32(JSON.stringify(p))]);
}); }); });
var INP = [{ w: 3, h: 3, rule: "cross", topo: "torus", k: 2, v: "110010001" }, { w: 4, h: 3, rule: "king", topo: "flat", k: 3, holes: [5], v: "100200121000" }, { w: 5, h: 5, rule: "knight", topo: "torus", k: 5, v: "1000000020000003000000400" },
  { w: 3, h: 3, rule: "cross", topo: "flat", k: 2, v: [1, 0, 0, 0, 0, 0, 0, 0, 0] }, { w: 6, h: 6, rule: "plus2", topo: "flat", k: 2, holes: [0, 35], v: [0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0] }];
var inps = INP.map(function (x) { var r = T.fromInput(x); return [r.ok, r.status, r.puzzle ? r.puzzle.id : null, r.puzzle ? r.puzzle.score : null, r.puzzle ? R.hash32(JSON.stringify(r.puzzle)) : null]; });
console.log("var CONF = " + JSON.stringify(CONF) + ";");
console.log("var GEN = " + JSON.stringify(rows) + ";");
console.log("var INP = " + JSON.stringify(INP) + ";");
console.log("var INP_OUT = " + JSON.stringify(inps) + ";");
