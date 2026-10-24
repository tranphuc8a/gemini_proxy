/* j4-dot-bien.js — kiem DOT BIEN cho J4 (sinh du lieu mau + suy schema). Chay: node j4-dot-bien.js [chi-so … | k/n]   (k/n: chay song song, vd 0/3 1/3 2/3)
   Sao json-editor sang thu muc tam, ap MOT dot bien len mot tep, chay nhom kiem tuong ung (node kiem.js <nhom>); dot bien "bi bat" khi kiem.js do (exit != 0).
   Khong sua repo. Dot bien song sot = lo hong cua bo kiem (hoac dot bien tuong duong — ghi ro trong dot/J4.md). */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const cp = require("child_process");

const GOC = path.resolve(__dirname, "../../../../../../backend/fastapi/webapp/tranphuc8a");

const DB = [
  /* [ten, tep, tu, thanh, nhom-kiem] */
  ["sinh: bo kiem tung nut (kiemTatCa luon true)", "schema-sinh.js", "if (!S.kiemNut(vs[i].nut, gt, ng.bd, TC_KIEM).hopLe) return false;", "", "schema-sinh"],
  ["sinh: oneOf/anyOf khong xoay nhanh theo lan thu", "schema-sinh.js", "return [(lan.starts[k] + lan.t) % n];", "return [lan.starts[k] % n];", "schema-sinh"],
  ["sinh: uniqueItems khong loai phan tu trung", "schema-sinh.js", "if (!thay.has(kh)) { thay.add(kh); break; }", "if (true) { break; }", "schema-sinh"],
  ["sinh: contains khong dat phan tu khop", "schema-sinh.js", "if (contains[i].v) them[vt[(i + j) % n]].push(contains[i].v);", "", "schema-sinh"],
  ["sinh: dependentRequired khong bao dong", "schema-sinh.js", "for (i = 0; i < keys.length; i++) { var dp = depReq[keys[i]]; if (dp) dp.forEach(them); }", "", "schema-sinh"],
  ["sinh: mau thu k dung chung seed (khong +'/k')", "schema-sinh.js", 'var m = mauMot(bd, tck, seed + "/" + k);', "var m = mauMot(bd, tck, seed);", "schema-sinh"],
  ["sinh: khoa __proto__ gan truc tiep", "schema-sinh.js", 'if (k === "__proto__") Object.defineProperty(o, k, { value: v, enumerable: true, writable: true, configurable: true });\n    else o[k] = v;', "o[k] = v;", "schema-sinh"],
  ["sinh: multipleOf bo qua boi chung (L = ai)", "schema-sinh.js", "L = L / ucln(L, ai) * ai;", "L = ai;", "schema-sinh"],
  ["sinh: not {type} khong loai kieu", "schema-sinh.js", "if (!(loaiTru && loaiTru[a])) nguyenCu.push(a);\n      if (nguyenCu.indexOf", "nguyenCu.push(a);\n      if (nguyenCu.indexOf", "schema-sinh"],
  ["sinh: exclusiveMinimum khong tinh chat", "schema-sinh.js", "if (v > lo) { lo = v; loX = x; } else if (v === lo) loX = loX || x;", "if (v > lo) { lo = v; loX = false; } else if (v === lo) loX = false;", "schema-sinh"],
  ["sinh: luon bao hopLe:true", "schema-sinh.js", "ra.hopLe = hopLe;", "ra.hopLe = true;", "schema-sinh"],
  ["sinh: khongDamBao khong bao gio co ly do tu bo kiem", "schema-sinh.js", "m.kq.loi.forEach(function (e) {", "[].forEach(function (e) {", "schema-sinh"],
  ["sinh: che do toi thieu khong bao gio bat (de quy vo han)", "schema-sinh.js", "tt = sau > ng.doSauToiDa;\n      pf = phang", "tt = false;\n      pf = phang", "schema-sinh"],
  ["sinh: seed nhieu mau trung (seed + '#a' khong doi)", "schema-sinh.js", "rng: JE.taoRng(a ? seedMau + \"#\" + a : seedMau)", "rng: JE.taoRng(seedMau)", "schema-sinh"],
  ["sinh: format bien the ngan khong thu", "schema-sinh.js", "for (pha = 0; pha < (loc ? 2 : 1); pha++) {", "for (pha = 0; pha < 1; pha++) {", "schema-sinh"],
  ["sinh: $ref khong giai (bo qua)", "schema-sinh.js", "var r = ng.bd.giaiRefTu(V.co, cacRef[q][0], cacRef[q][1]);", "var r = null;", "schema-sinh"],
  ["sinh: dung Math.random lam rng", "regex-sinh.js", "a = (a + 0x6D2B79F5) | 0;\n      var t = Math.imul(a ^ (a >>> 15), 1 | a);\n      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;\n      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;", "return Math.random();", "regex-sinh"],
  ["regex: thuKhop luon true (bao khop gia)", "regex-sinh.js", "try { return re.test(s); } catch (e) { return false; }", "return true;", "regex-sinh"],
  ["regex: lop phu dinh [^…] bi bo qua", "regex-sinh.js", "return { k: \"lop\", ds: phu ? phanBu(ds) : ds };", "return { k: \"lop\", ds: ds };", "regex-sinh"],
  ["regex: \\d gom ca ':'", "regex-sinh.js", "var LOP_D = [[48, 57]];", "var LOP_D = [[48, 58]];", "regex-sinh"],
  ["regex: luong tu {n,m} bo qua max", "regex-sinh.js", "var hi = Math.min(x.max, x.min + L), lo = x.min, n;", "var hi = x.min + L, lo = x.min, n;", "regex-sinh"],
  ["regex: tham chieu nguoc luon rong", "regex-sinh.js", "if (s) { ra.push(s); dai += s.length; }", "", "regex-sinh"],
  ["regex: khong dem them ky tu khi thieu do dai (pattern khong neo)", "regex-sinh.js", "if (!ph.neoCuoi) { s += demChuoi(rng, dmin - d); d = dmin; }", "", "regex-sinh"],
  ["suy: moi khoa deu required", "schema-suy.js", "if (tc.batBuoc !== \"khong\" && ent.dem === T.dt) req.push(k);", "if (tc.batBuoc !== \"khong\") req.push(k);", "schema-suy"],
  ["suy: format khong giao (chi xet chuoi dau)", "schema-suy.js", "else if (T.fmt.length) { T.fmt = T.fmt.filter(function (f) { return khopFmt(f, x); }); }", "", "schema-suy"],
  ["suy: enum khong can gia tri lap lai", "schema-suy.js", "&& T.chu >= 2 * T.vals.size) {", "&& true) {", "schema-suy"],
  ["suy: so thuc thanh integer", "schema-suy.js", "prim.push(T.so ? \"number\" : \"integer\");", "prim.push(\"integer\");", "schema-suy"],
  ["suy: uri khong can '://'", "schema-suy.js", "if (ten === \"uri\" && !/^[A-Za-z][A-Za-z0-9+.-]*:\\/\\//.test(s)) return false;", "", "schema-suy"],
  ["suy: khoa __proto__ gan truc tiep", "schema-suy.js", "if (k === \"__proto__\") Object.defineProperty(o, k, { value: v, enumerable: true, writable: true, configurable: true });\n    else o[k] = v;", "o[k] = v;", "schema-suy"],
  ["suy: anyOf thanh kieu gop (object + mang -> type [..])", "schema-suy.js", "return { anyOf: ra };", "return ra[0];", "schema-suy"],
  ["suy: chat khong tinh code point", "schema-suy.js", "var n = 0, i, c; for (i = 0; i < s.length; i++) { c = s.charCodeAt(i); if (c >= 0xD800 && c <= 0xDBFF && i + 1 < s.length && (s.charCodeAt(i + 1) & 0xFC00) === 0xDC00) i++; n++; } return n;", "return s.length;", "schema-suy"],
  ["sinh: not {type} khong loai kieu o nhanh goi y tu tu khoa", "schema-sinh.js", "for (a in goi) if (!(loaiTru && loaiTru[a])) nguyenCu.push(a);", "for (a in goi) nguyenCu.push(a);", "schema-sinh"],
  ["sinh: not {type} khong loai kieu o nhanh tu do", "schema-sinh.js", 'for (kk = 0; kk < t0.length; kk++) if (!(loaiTru && (loaiTru[t0[kk]] || (t0[kk] === "number" && loaiTru.integer)))) nguyenCu.push(t0[kk]);', "for (kk = 0; kk < t0.length; kk++) nguyenCu.push(t0[kk]);", "schema-sinh"],
  ["chay-nen: 'suy' tra schema rong", "chay-nen.js", "var ss = JEg.schemaSuy.suySchema(du, tin.tuyChon || {});", "var ss = {};", "schema-sinh"]
];

const THAM_SO = process.argv.slice(2);
const mm = THAM_SO.map((x) => /^(\d+)\/(\d+)$/.exec(x)).find(Boolean);      /* "k/n": chi chay dot bien co chi so % n == k (de chay song song) */
const chi = THAM_SO.filter((x) => /^\d+$/.test(x)).map(Number);
const goc = fs.mkdtempSync(path.join(os.tmpdir(), "j4db-"));
let bat = 0, tong = 0;
DB.forEach((m, i) => {
  if (chi.length && chi.indexOf(i) < 0) return;
  if (mm && i % Number(mm[2]) !== Number(mm[1])) return;
  tong++;
  const dir = path.join(goc, "b" + i);
  fs.cpSync(path.join(GOC, "json-editor"), path.join(dir, "json-editor"), { recursive: true, filter: (p) => !/__pycache__/.test(p) });
  fs.copyFileSync(path.join(GOC, "khung-kiem.js"), path.join(dir, "khung-kiem.js"));
  const tep = path.join(dir, "json-editor", "assets", m[1]);
  const s = fs.readFileSync(tep, "utf8");
  if (s.indexOf(m[2]) < 0) { console.log("[?? " + i + "] KHONG TIM THAY doan can doi: " + m[0]); return; }
  fs.writeFileSync(tep, s.replace(m[2], () => m[3]));
  const r = cp.spawnSync("node", [path.join(dir, "json-editor", "kiem.js"), m[4]], { encoding: "utf8", timeout: 240000, env: Object.assign({}, process.env, { JE_NHOM_HAN_MS: "150000" }) });
  const sai = (r.stdout || "").split("\n").filter((l) => l.indexOf("[SAI]") >= 0);
  const doDo = r.status !== 0;
  if (doDo) bat++;
  console.log((doDo ? "[BAT] " : "[SONG] ") + i + " " + m[0] + (doDo ? "   (" + sai.length + " phep SAI; vd: " + (sai[0] || (r.stderr || "").slice(0, 80)).trim().slice(0, 110) + ")" : ""));
  fs.rmSync(dir, { recursive: true, force: true });
});
console.log("\nBat " + bat + " / " + tong + " dot bien.");
fs.rmSync(goc, { recursive: true, force: true });
