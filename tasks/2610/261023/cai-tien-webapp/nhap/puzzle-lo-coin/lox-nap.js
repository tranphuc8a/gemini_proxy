// nạp lõi + engine lightsoutx cho các script đo (node)
var path = require("path");
var ROOT = path.resolve(__dirname, "../../../../../../backend/fastapi/webapp/tranphuc8a/logic-puzzle-suite");
["text", "rng", "util", "csp", "types", "grade", "plan", "game"].forEach(function (n) { require(path.join(ROOT, "assets/js/core", n + ".js")); });
module.exports = { Puz: globalThis.Puz, T: require(path.join(ROOT, "assets/js/puzzles/lightsoutx.js")), ROOT: ROOT };
