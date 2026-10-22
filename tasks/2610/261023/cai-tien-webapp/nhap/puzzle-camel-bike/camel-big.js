// camel-big.js — LB trên trạng thái đạt được của các bộ lớn hơn (vét cạn có ghi nhớ).
"use strict";
var src = require("fs").readFileSync(__dirname + "/camel.js", "utf8");
src = src.slice(0, src.indexOf("// ---------------------------------------------------------------- chạy"));
var m = { exports: {} }; new Function("module", "require", src + "\nmodule.exports={brute:brute,LB:LB,UB:UB,farCont:farCont,farDisc:farDisc,deliverDisc:deliverDisc,floorF:floorF,fs:fs};")(m, require);
var K = m.exports;
[[18, 6, "far"], [20, 5, "far"], [16, 8, "far"], [21, 7, "far"], [24, 6, "far"], [20, 10, "far"], [18, 6, "deliver", 5], [24, 6, "deliver", 6], [21, 7, "deliver", 5], [20, 5, "deliver", 4]].forEach(function (c) {
  var B = c[0], C = c[1], goal = c[2], D = c[3];
  var M = goal === "far" ? K.floorF(K.farCont(B, C).far) + 2 : D;
  var t0 = Date.now(), br = K.brute(B, C, M, goal, D), miss = 0, ex = null;
  br.memo.forEach(function (val, k) { var parts = k.split("|"), p = +parts[0], d = parts[1].split(",").map(Number); var lb = K.LB(p, d, C, M, goal, D); if (lb !== val) { miss++; if (!ex) ex = [k, lb, val]; } });
  var dp = goal === "far" ? K.farDisc(B, C).far : K.deliverDisc(B, C, D);
  console.log("B=" + B + " C=" + C + " " + goal + (D ? " D=" + D : "") + ": vét cạn " + br.value + " QHĐ " + dp + (br.value === dp ? " ✓" : " ✗") + ", " + br.states + " trạng thái, LB lệch " + miss + (ex ? " vd " + JSON.stringify(ex) : "") + " (" + (Date.now() - t0) + " ms)");
});
