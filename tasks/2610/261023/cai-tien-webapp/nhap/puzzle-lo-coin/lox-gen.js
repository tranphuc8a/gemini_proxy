// tỉ lệ đạt bậc + thời gian sinh theo (luật, mép, k, ô khoá, cỡ, bậc). node lox-gen.js [seeds] [sizes] [filter]
var L = require("./lox-nap.js"), T = L.T;
var seeds = Number(process.argv[2] || 5), sizes = (process.argv[3] || "4,5,7,10").split(","), filt = process.argv[4] || "";
var bad = [], lines = [], totalMs = 0, worst = 0, n = 0;
T.lib.RULE_IDS.forEach(function (rule) { ["flat", "torus"].forEach(function (topo) { [2, 3, 5].forEach(function (k) { ["none", "few", "some"].forEach(function (hm) {
  var key = rule + "|" + topo + "|" + k + "|" + hm; if (filt && key.indexOf(filt) < 0) return;
  var opt = { rule: rule, topo: topo, k: String(k), holes: hm };
  sizes.forEach(function (sid) {
    var sz = T.sizes.filter(function (s) { return s.id === sid; })[0];
    sz.tiers.forEach(function (tier) {
      var hit = 0, ms0 = 0, mx = 0, scores = [];
      for (var s = 0; s < seeds; s++) {
        var t0 = Date.now(), p = T.generate(1000 + s * 7919, { sizeId: sid, tier: tier, options: opt }), dt = Date.now() - t0;
        ms0 += dt; mx = Math.max(mx, dt); if (p.tier === tier) hit++; scores.push(p.score);
      }
      totalMs += ms0; worst = Math.max(worst, mx); n += seeds;
      if (hit / seeds < 0.9) bad.push(key + " " + sid + " " + tier + " " + hit + "/" + seeds + " sc=" + scores.join(","));
    });
  });
}); }); }); });
console.log("sinh " + n + " đề, tổng " + totalMs + " ms, chậm nhất " + worst + " ms; dưới 90%: " + bad.length);
console.log(bad.join("\n"));
