const TT = require("../../../../../../backend/fastapi/webapp/tranphuc8a/json-editor/assets/tom-tat.js");
let h = 42; const r = () => (h = (h * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const tu = ['Hà Nội', 'Phúc', 'An', 'Bình', 'alpha', 'beta', 'gamma', 'x'.repeat(30)];
const bg = []; let len = 0, i = 0;
while (len < 5 * 1048576) {
  const b = { id: i, name: tu[Math.floor(r() * tu.length)] + ' ' + i, email: 'u' + i + '@vi-du.vn', active: r() < .5, score: Math.round(r() * 1e4) / 100,
    tags: Array.from({ length: Math.floor(r() * 5) }, () => tu[Math.floor(r() * tu.length)]),
    address: { city: tu[Math.floor(r() * tu.length)], zip: String(10000 + Math.floor(r() * 89999)), geo: { lat: r(), lng: r() } },
    notes: r() < .3 ? null : 'ghi chú ' + 'lorem ipsum '.repeat(Math.floor(r() * 6)) };
  bg.push(b); len += 220 + b.tags.length * 8; i++;
}
const nh = []; for (const b of bg) for (const k in b) if (b[k] !== null && typeof b[k] === "object") nh.push(b[k]);
function chay(ten, f) { const t = process.hrtime.bigint(); let x = 0; for (const v of nh) x += f(v); console.log(ten.padEnd(34), (Number(process.hrtime.bigint() - t) / 1e6).toFixed(1), "ms /", nh.length, "nhanh"); return x; }
for (let lan = 0; lan < 2; lan++) {
  console.log("-- lan", lan);
  chay("xemTruoc (da co truoc J2)", (v) => TT.xemTruoc(v).length);
  chay("tomTatNut khong byte", (v) => TT.tomTatNut(v).dong.length);
  chay("tomTatNut + byte (cache lanh/nong)", (v) => TT.tomTatNut(v, { byte: true }).byte);
  chay("tomTatNut + byte + moTaNut + moTaAria", (v) => { const t = TT.tomTatNut(v, { byte: true }); return TT.moTaNut(t, "$[1].k").length + TT.moTaAria(t).length; });
}
