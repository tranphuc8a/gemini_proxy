var L = require("./lox-nap.js"), T = L.T, R = L.Puz.rng, G = L.Puz.game, lib = T.lib;
[3, 5].forEach(function (k) {
  var rg = R.create("chw" + k);
  for (var s = 0; s < 6; s++) {
    var c = { w: 5, h: 5, rule: "cross", topo: "flat", k: k, holes: [] };
    var b = lib.randomPresses(c, 20, 100 + s), an = lib.analyse(c, b);
    if (an.status === "none" || an.weight === 0) continue;
    var pz = T.fromInput({ w: 5, h: 5, k: k, v: b }).puzzle, st = T.newState(pz), n = 0, log = [], rr = R.create("x" + s);
    while (!T.check(pz, st).solved && n < 300) {
      var h = T.hint(pz, st, 3, { loHint: "chase" });
      if (!h.action) { console.log("không action", k, s, n, JSON.stringify(h).slice(0, 200)); break; }
      G.applyDiff(st, T.moveFor(pz, st, h.action).d, false); n++; log.push(h.action.i);
      if (n % 4 === 0) { var pick = rr.int(25); G.applyDiff(st, T.moveFor(pz, st, { k: "press", i: pick }).d, false); log.push("W" + pick); }
    }
    console.log(k, s, T.check(pz, st).solved, n, log.slice(0, 40).join(" "));
  }
});
