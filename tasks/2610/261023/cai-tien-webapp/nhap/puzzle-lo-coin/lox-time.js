var L = require("./lox-nap.js"), T = L.T;
var p = T.generate(5, { sizeId: "10", tier: "hard", options: { topo: "torus" } });
T.hint(p, T.newState(p), 3, {});
var t0 = Date.now(); for (var i = 0; i < 5; i++) T.hint(p, T.newState(p), 3, {}); console.log("hint 10x10 torus mod2 nul16:", (Date.now() - t0) / 5, "ms");
var q = T.generate(5, { sizeId: "10", tier: "hard", options: { rule: "king", k: "3" } }); T.hint(q, T.newState(q), 3, {});
t0 = Date.now(); for (i = 0; i < 20; i++) T.hint(q, T.newState(q), 3, {}); console.log("hint 10x10 king mod3:", (Date.now() - t0) / 20, "ms");
