// thống kê: cấu hình nào của lưới quảng cáo có par chỉ là cận trên (exact:false)
var L = require("./lox-nap.js"), T = L.T, out = {}, tot = 0, inex = 0;
T.lib.RULE_IDS.forEach(function (r) { ["flat", "torus"].forEach(function (tp) { ["2", "3", "5"].forEach(function (k) { ["none", "few", "some"].forEach(function (h) { T.sizes.forEach(function (z) {
  var p = T.generate(7, { sizeId: z.id, tier: z.tiers[z.tiers.length - 1], options: { rule: r, topo: tp, k: k, holes: h } }); tot++;
  if (p.data.exact === false) { inex++; var key = r + "|" + tp + "|" + k; (out[key] = out[key] || []).push(z.id + (h === "none" ? "" : "/" + h)); }
}); }); }); }); });
console.log("cỡ × cấu hình có par ước lượng:", inex, "/", tot);
Object.keys(out).forEach(function (k) { console.log(k, out[k].join(" ")); });
