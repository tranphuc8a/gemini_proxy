"use strict";
var src = require("fs").readFileSync(__dirname + "/camelN.js", "utf8");
src = src.slice(0, src.indexOf("var rows ="));
var m = { exports: {} }; new Function("module", "require", src + "\nmodule.exports={brute:brute,H:H,ODD:ODD};")(m, require);
var K = m.exports, N = +process.argv[2], C = +process.argv[3], ret = process.argv[4] === "ret";
var M = Math.floor(C * (ret ? K.ODD(N) : K.H(N))) + 1;
var r = K.brute(N, C, M, ret);
console.log((ret ? "V2b" : "V2a") + " N=" + N + " C=" + C + ": vét cạn " + r.v + " | công thức " + (C * (ret ? K.ODD(N) : K.H(N))).toFixed(3) + " | " + r.states + " tt, " + r.ms + " ms");
