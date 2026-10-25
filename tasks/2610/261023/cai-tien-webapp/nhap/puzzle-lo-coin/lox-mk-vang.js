var fs = require("fs"), s = fs.readFileSync("lox-vang-bang.txt", "utf8");
var head = `/* kiem/lightsoutx-vang.js — MẪU VÀNG của Lights Out biến thể (chụp 24/10/2026 khi hoàn thành đợt P7, bằng tasks/…/nhap/puzzle-lo-coin/lox-chup-vang.js):
   cùng (seed, cỡ, bậc, tuỳ chọn) PHẢI ra cùng puzzle từng bit — id, điểm, bậc và băm của CẢ đối tượng puzzle (bắt cả việc thêm/bớt trường trong data) — và các bàn tự nhập cho cùng kết quả.
   Việc thêm lightsoutx vào Daily (P8) hay đổi luật/điểm khó phải KHÔNG làm vỡ bảng này (đổi có chủ ý thì chụp lại và ghi vào bàn giao). Lights Out cổ điển có mẫu vàng riêng (lightsout-vang.js). */
"use strict";
module.exports = function (t) {
  var Puz = t.Puz, T = Puz.types.get("lightsoutx"), R = Puz.rng;
`;
var tail = `
  t.group("Lights Out biến thể — MẪU VÀNG (seed cũ → đúng puzzle cũ)");
  var bad = [];
  GEN.forEach(function (r) {
    var p = T.generate(r[3], { sizeId: r[1], tier: r[2], options: CONF[r[0]] });
    if (p.id !== r[4] || p.score !== r[5] || p.tier !== r[6] || R.hash32(JSON.stringify(p)) !== r[7]) bad.push([r[0], r[1], r[2], r[3], p.id, r[4]]);
  });
  t.ok(GEN.length + " puzzle sinh (10 cấu hình × 4 cỡ/bậc × 2 seed): id, điểm, bậc, băm toàn puzzle khớp mẫu vàng", bad.length === 0, bad.slice(0, 4));
  var badI = [];
  INP.forEach(function (x, i) {
    var r = T.fromInput(x), o = INP_OUT[i], got = [r.ok, r.status, r.puzzle ? r.puzzle.id : null, r.puzzle ? r.puzzle.score : null, r.puzzle ? R.hash32(JSON.stringify(r.puzzle)) : null];
    if (JSON.stringify(got) !== JSON.stringify(o)) badI.push([i, got, o]);
  });
  t.ok(INP.length + " bàn tự nhập (xuyến, vua, mã mod 5, ô khoá, vô nghiệm): trạng thái, id, điểm, băm khớp mẫu vàng", badI.length === 0, badI.slice(0, 3));
  t.ok("mặc định tường minh = không truyền (mọi cấu hình của bảng)", CONF.every(function (o, ci) { var full = Puz.types.optionsOf(T, o); return JSON.stringify(T.generate(5 + ci, { sizeId: "5", tier: "easy", options: o })) === JSON.stringify(T.generate(5 + ci, { sizeId: "5", tier: "easy", options: full })); }));
};
`;
fs.writeFileSync(process.argv[2], head + "  " + s.split("\n").filter(Boolean).join("\n  ") + "\n" + tail);
