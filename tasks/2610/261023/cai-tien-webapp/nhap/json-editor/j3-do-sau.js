const C = require("C:/Users/tranphuc8a/Desktop/gemini_proxy/backend/fastapi/webapp/tranphuc8a/json-editor/kiem/chung.js");
const MT = C.taoMoiTruong();
const S = MT.JE.schema;
const sc = { $defs: { a: { type: "array", items: { $ref: "#/$defs/a" } } }, $ref: "#/$defs/a" };
const bd = S.bienDich(sc);
const du = C.longSau(20000);
let nem = 0, he = 0;
function sau(n) { if (n > 0) return sau(n - 1) + 0; try { const r = S.kiem(du, bd); if (r.loi[0] && r.loi[0].tuKhoa === "(he-thong)") he++; } catch (e) { nem++; } return 0; }
for (let n = 0; n < 400; n++) { try { sau(n * 7); } catch (e) { nem++; } }
console.log("nem ra ngoai:", nem, " bao loi he thong:", he);
