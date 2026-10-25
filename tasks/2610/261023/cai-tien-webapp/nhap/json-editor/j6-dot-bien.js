/* j6-dot-bien.js — kiem DOT BIEN cho J6 (jsonpath, tim-kiem, sua-json, dinh-dang, regex an toan).
   Chay: node j6-dot-bien.js [chi-so … | k/n]
   Sao json-editor sang thu muc tam, ap MOT dot bien len mot tep, chay nhom kiem tuong ung (node kiem.js <nhom>);
   dot bien "bi bat" khi kiem.js do (exit != 0 hoac het gio). Khong sua repo. Dot bien song sot = lo hong cua bo kiem
   (hoac dot bien tuong duong — ghi ro trong dot/J6.md). Anchor khong chua dau \ de khoi nhan doi dau thoat. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const cp = require("child_process");

const GOC = path.resolve(__dirname, "../../../../../../backend/fastapi/webapp/tranphuc8a");

const DB = [
  /* [ten, tep, tu, thanh, nhom-kiem] */
  ["jsonpath: lat cat buoc duong khong chan len", "jsonpath.js", "lo = Math.min(Math.max(nb, 0), len); hi = Math.min(Math.max(nk, 0), len);", "lo = Math.max(nb, 0); hi = Math.max(nk, 0);", "jsonpath"],
  ["jsonpath: chi so am khong tinh tu cuoi", "jsonpath.js", "i = c.i < 0 ? v.length + c.i : c.i;", "i = c.i;", "jsonpath"],
  ["jsonpath: ten khoa dung 'in' (ro nguyen mau)", "jsonpath.js", "} else if (laNhanh(v) && coRieng(v, c.ten)) them(", "} else if (laNhanh(v) && c.ten in v) them(", "jsonpath"],
  ["jsonpath: Nothing == Nothing = false", "jsonpath.js", "if (x === NOTHING || y === NOTHING) bang = x === NOTHING && y === NOTHING;", "if (x === NOTHING || y === NOTHING) bang = false;", "jsonpath"],
  ["jsonpath: so chuoi theo code unit khong theo code point", "jsonpath.js", "var x = a.codePointAt(i), y = b.codePointAt(j);", "var x = a.charCodeAt(i), y = b.charCodeAt(j);", "jsonpath"],
  ["jsonpath: ..  duyet con theo thu tu nguoc", "jsonpath.js", "for (var a = xv.length - 1; a >= 0; a--) ngan.push(", "for (var a = 0; a < xv.length; a++) ngan.push(", "jsonpath"],
  ["jsonpath: length() dem don vi UTF-16", "jsonpath.js", "if (typeof x === \"string\") return demCodePoint(x);", "if (typeof x === \"string\") return x.length;", "jsonpath"],
  ["jsonpath: match() khong neo toan chuoi", "jsonpath.js", "layRe(e.ten === \"match\" ? \"^(?:\" + y + \")$\" : y, \"\")", "layRe(y, \"\")", "jsonpath"],
  ["jsonpath: khong tieu ngan sach", "jsonpath.js", "sach.con -= x || 1;", "sach.con -= 0;", "jsonpath"],
  ["jsonpath: khong chan regex nguy hiem khi phan tich", "jsonpath.js", "var lyDo = JE.chung.kiemRegexAnToan(ra);\n      if (lyDo) throw loi(lyDo, bd);", "", "jsonpath"],
  ["jsonpath: && thanh ||", "jsonpath.js", "a = { t: \"va\", a: a, b: docKhong() };", "a = { t: \"hoac\", a: a, b: docKhong() };", "jsonpath"],
  ["jsonpath: ! khong dao", "jsonpath.js", "case \"khong\": return !danhGia(e.a, nutHT);", "case \"khong\": return danhGia(e.a, nutHT);", "jsonpath"],
  ["jsonpath: <= bo phan bang", "jsonpath.js", "return tr || bang;", "return tr;", "jsonpath"],
  ["jsonpath: khong cat o tran", "jsonpath.js", "if (ra.length >= han) { catBot = true; break; }", "", "jsonpath"],
  ["jsonpath: [01] khong bao loi", "jsonpath.js", "if (s.charAt(b0) === \"0\" && p - b0 > 1) throw loi(\"Số nguyên không được có số 0 đứng đầu\", bd);", "", "jsonpath"],
  ["jsonpath: -0 duoc phep lam chi so", "jsonpath.js", "if (chu === \"-0\") throw loi(\"“-0” không hợp lệ làm chỉ số\", bd);", "", "jsonpath"],
  ["jsonpath: cat lat buoc 0 khong rong", "jsonpath.js", "if (st === 0) break;", "if (st === 0) st = 1;", "jsonpath"],
  ["jsonpath: ham ValueType nhan truy van khong don", "jsonpath.js", "if (!nut.don) throw loi(viTri +", "if (false) throw loi(viTri +", "jsonpath"],
  ["tim-kiem: cau tu khong chan chu", "tim-kiem.js", "if (tc.caTu) mau = BIEN_TU + \"(?:\" + mau + \")\" + CUOI_TU;", "", "tim-kiem"],
  ["tim-kiem: van ban thuan van mo rong $1", "tim-kiem.js", "if (!tc.regex) re = null;                                  /* van ban thuan: thay dung nghia den */", "", "tim-kiem"],
  ["tim-kiem: $$ khong thanh $", "tim-kiem.js", "if (d === \"$\") { ra += \"$\"; i++; }", "if (d === \"$\") { ra += \"\"; i++; }", "tim-kiem"],
  ["tim-kiem: doi ten trung khoa khong bi chan", "tim-kiem.js", "if (dem.get(x.moi) > 1) {", "if (false) {", "tim-kiem"],
  ["tim-kiem: pham vi luon ca hai", "tim-kiem.js", "var tuKhoa = phamVi !== \"gia-tri\", tuGiaTri = phamVi !== \"khoa\";", "var tuKhoa = true, tuGiaTri = true;", "tim-kiem"],
  ["tim-kiem: duyet cay theo thu tu nguoc (mang)", "tim-kiem.js", "for (var a = v.length - 1; a >= 0; a--) ngan.push({ v: v[a], p: n, k: a });", "for (var a = 0; a < v.length; a++) ngan.push({ v: v[a], p: n, k: a });", "tim-kiem"],
  ["tim-kiem: khoa __proto__ gan truc tiep", "tim-kiem.js", "if (k === \"__proto__\") Object.defineProperty(o, k, { value: v, writable: true, enumerable: true, configurable: true });", "if (false) {}", "tim-kiem"],
  ["tim-kiem: so khop trong cay duoc thay (khong bo qua)", "tim-kiem.js", "if (noi === \"gia-tri\" && typeof nut.v !== \"string\") {", "if (false) {", "tim-kiem"],
  ["tim-kiem: khong cat o tran", "tim-kiem.js", "ra.catBot = ra.length > han;\n    if (ra.catBot) ra.length = han;", "ra.catBot = false;", "tim-kiem"],
  ["tim-kiem: khong chan regex nguy hiem", "tim-kiem.js", "var lyDo = JE.chung.kiemRegexAnToan(q);\n      if (lyDo) return { loi: lyDo };", "", "tim-kiem"],
  ["tim-kiem: thay mot khong dung thuTu", "tim-kiem.js", "ds = ds.slice(chi.thuTu, chi.thuTu + 1);", "ds = ds.slice(0, 1);", "tim-kiem"],
  ["sua-json: khong bo phay thua cuoi", "sua-json.js", "if (f && (tiep === T_RB || tiep === T_RS || tiep === T_EOF)) {", "if (false) {", "sua-json"],
  ["sua-json: khong them dau hai cham thieu", "sua-json.js", "e(lastEnd, lastEnd, \":\", \"Thêm dấu hai chấm còn thiếu sau khoá\");", "", "sua-json"],
  ["sua-json: khong them dau phay thieu", "sua-json.js", "e(lastEnd, lastEnd, \",\", \"Thêm dấu phẩy còn thiếu\");", "", "sua-json"],
  ["sua-json: dong ngoac thieu theo thu tu xuoi", "sua-json.js", "for (var k = ngan.length - 1; k >= tuTang; k--) {", "for (var k = tuTang; k < ngan.length; k++) {", "sua-json"],
  ["sua-json: khong thoat nhay kep tho trong chuoi nhay don", "sua-json.js", "if (c === 34) { bo(j + 1,", "if (false) { bo(j + 1,", "sua-json"],
  ["sua-json: khong bo so 0 dung dau", "sua-json.js", "while (z < ngDigits.length - 1 && ngDigits.charCodeAt(z) === 48) z++;", "", "sua-json"],
  ["sua-json: hex doi bang Number (mat chinh xac)", "sua-json.js", "try { return dau + BigInt(w.slice(i)).toString(); }", "try { return dau + String(Number(w.slice(i))); }", "sua-json"],
  ["sua-json: None khong thanh null", "sua-json.js", "if (l === \"none\")", "if (l === \"nonex\")", "sua-json"],
  ["sua-json: bo gop nhieu gia tri goc", "sua-json.js", "if (!loiNgu && soGoc > 1 && tc.gopNhieuGiaTri) {", "if (false) {", "sua-json"],
  ["sua-json: gia tri khong nhay duoc doan la loi chung", "sua-json.js", "if (lw.k === \"dinh-danh\") { loi(", "if (false) { loi(", "sua-json"],
  ["sua-json: ky tu dieu khien tho khong thoat", "sua-json.js", "if (c < 32) {", "if (c < 0) {", "sua-json"],
  ["sua-json: dong sai", "sua-json.js", "x.dong = dong;", "x.dong = 1;", "sua-json"],
  ["sua-json: chen cung vi tri bi dao thu tu", "sua-json.js", "return a.bd - b.bd || a.kt - b.kt || a.s - b.s;", "return a.bd - b.bd || a.kt - b.kt || b.s - a.s;", "sua-json"],
  ["sua-json: khong nhan JSONP", "sua-json.js", "if (tt[1] === T_LP && loaiTu(w).k === \"dinh-danh\")", "if (false)", "sua-json"],
  ["sua-json: khong nhan rao Markdown", "sua-json.js", "if (s.substr(a0, 3) === \"```\") {", "if (false) {", "sua-json"],
  ["sua-json: JSON hop le van bi sua (bo duong nhanh)", "sua-json.js", "try { JSON.parse(s); return { vanBan: s, sua: [], conLoi: null, soCanhBao: 0 }; } catch (e0) { /* hong: sua tiep */ }", "", "sua-json"],
  ["sua-json: khong nhan chu thich #", "sua-json.js", "if (c === 35) {", "if (c === -35) {", "sua-json"],
  ["dinh-dang: goChuoi thu boc nhay ca khi co nhay tho", "dinh-dang.js", "if (!coNhayTho(t)) {", "if (true) {", "dinh-dang"],
  ["dinh-dang: giaiChuoiLong nhan ca so / null", "dinh-dang.js", "return v !== null && typeof v === \"object\" ? v : undefined;", "return v;", "dinh-dang"],
  ["dinh-dang: thutTu luon 2", "dinh-dang.js", "return n === 4 ? 4 : 2;", "return 2;", "dinh-dang"],
  ["regex-an-toan: cho phep lap long nhau", "je-chung.js", "if (truocLaNhom.luong) return", "if (false) return", "tim-kiem"],
  ["regex-an-toan: cho phep nhanh luan phien trung dau", "je-chung.js", "if (!ok) return \"Mẫu regex lặp một nhóm", "if (false) return \"Mẫu regex lặp một nhóm", "tim-kiem"],
  ["regex-an-toan: cho phep tham chieu nguoc", "je-chung.js", "if (/[1-9]/.test(d)) return", "if (false) return", "tim-kiem"]
];

const THAM_SO = process.argv.slice(2);
const mm = THAM_SO.map((x) => /^(\d+)\/(\d+)$/.exec(x)).find(Boolean);
const chi = THAM_SO.filter((x) => /^\d+$/.test(x)).map(Number);
const goc = fs.mkdtempSync(path.join(os.tmpdir(), "j6db-"));
let bat = 0, tong = 0;
const song = [];
DB.forEach((m, i) => {
  if (chi.length && chi.indexOf(i) < 0) return;
  if (mm && i % Number(mm[2]) !== Number(mm[1])) return;
  tong++;
  const dir = path.join(goc, "b" + i);
  fs.cpSync(path.join(GOC, "json-editor"), path.join(dir, "json-editor"), { recursive: true, filter: (p) => !/__pycache__/.test(p) });
  fs.copyFileSync(path.join(GOC, "khung-kiem.js"), path.join(dir, "khung-kiem.js"));
  const tep = path.join(dir, "json-editor", "assets", m[1]);
  const s = fs.readFileSync(tep, "utf8");
  if (s.indexOf(m[2]) < 0) { console.log("  [LOI] #" + i + " " + m[0] + " — khong thay doan can doi"); song.push(i + " (khong ap duoc)"); return; }
  fs.writeFileSync(tep, s.replace(m[2], () => m[3]));
  const r = cp.spawnSync("node", ["kiem.js", m[4]], { cwd: path.join(dir, "json-editor"), encoding: "utf8", timeout: 150000, env: Object.assign({}, process.env, { JE_NHOM_HAN_MS: "60000" }) });
  const bi = r.status !== 0 || r.error;
  if (bi) bat++; else song.push(i + " " + m[0]);
  console.log((bi ? "  [bat]   " : "  [SONG]  ") + "#" + i + " " + m[0]);
});
console.log("\nBat " + bat + "/" + tong + " dot bien." + (song.length ? " SONG SOT: " + song.join(" | ") : ""));
try { fs.rmSync(goc, { recursive: true, force: true }); } catch (e) { /* khong don duoc thu muc tam */ }
process.exit(0);
