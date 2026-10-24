/* =====================================================================
   kiem-tat.js — chay bo kiem cua moi ung dung tu viet trong thu muc nay.

       node kiem-tat.js

   Tra exit code khac 0 neu bat ky ung dung nao hong, de noi vao CI duoc.

   Mot ung dung chi tinh la DAT khi: thoat ma 0, khong co dong "[SAI]", VA dong
   cuoi cua stdout bat dau bang "Dat — " / "Đạt — " (dong tong ket). Thieu dong
   do nghia la kiem.js thoat som (vd mot Promise khong bao gio xong lam Node
   thoat ma 0 va bo qua im lang cac nhom sau) — truoc day bi coi la xanh.
   Phep thu cua chinh quy tac nay: kiem-khung.js (chay kem o cuoi tep nay).

   Chi chay nhung thu muc CO tep kiem.js. Ung dung nhap tu ngoai (ban
   dung React da build) khong co, va deu bi bo qua — khong coi la loi.
   ===================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const GOC = __dirname;
/* Bo loc (tuy chon): `node kiem-tat.js json-editor khung` chi chay ung dung co ten chua chuoi do (+ "khung" = kiem-khung.js). */
const LOC = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const thuMuc = fs.readdirSync(GOC, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .filter((n) => fs.existsSync(path.join(GOC, n, "kiem.js")))
  .filter((n) => !LOC.length || LOC.some((l) => n.indexOf(l) >= 0))
  .sort();

if (!thuMuc.length && !(LOC.indexOf("khung") >= 0)) {
  console.log("Khong tim thay ung dung nao co kiem.js" + (LOC.length ? " khop bo loc: " + LOC.join(", ") : "") + ".");
  process.exit(LOC.length ? 1 : 0);
}

console.log("\nKiem " + thuMuc.length + " ung dung: " + thuMuc.join(", "));
console.log("=".repeat(62));

let hong = [];
let tongOK = 0;

/* Dong tong ket bat buoc o cuoi stdout cua moi kiem.js dat: "Dat — N phep…" (khong dau hoac co dau). */
const DONG_TONG_KET = /^(Dat|Đạt) — /;

for (const ten of thuMuc) {
  let ra = "";
  let dat = true;
  try {
    ra = execFileSync(process.execPath, ["kiem.js"], {
      cwd: path.join(GOC, ten), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"]
    });
  } catch (e) {
    dat = false;
    ra = (e.stdout || "") + (e.stderr || "");
  }
  const soOK = (ra.match(/\[ok\]/g) || []).length;
  const soSai = (ra.match(/\[SAI\]/g) || []).length;
  const dongCuoi = (ra.split("\n").map((d) => d.trim()).filter(Boolean).pop() || "");
  const thieuTongKet = dat && !soSai && !DONG_TONG_KET.test(dongCuoi);
  tongOK += soOK;
  if (!dat || soSai || thieuTongKet) {
    hong.push(ten);
    console.log("\n[HONG] " + ten + "  (" + soOK + " dat, " + soSai + " sai)");
    ra.split("\n").filter((d) => /\[SAI\]|Error|SyntaxError/.test(d))
      .slice(0, 8).forEach((d) => console.log("    " + d.trim()));
    if (thieuTongKet) {
      console.log("    KHONG CHAY HET: thoat ma 0 nhung dong cuoi khong phai \"Dat — …\" (thoat som? mot nhom bat dong bo treo?): \"" + dongCuoi.slice(0, 100) + "\"");
    }
  } else {
    console.log("  [ok]   " + ten.padEnd(18) + soOK + " phep kiem");
  }

  /* metadata.json phai doc duoc — cong portal dua vao no de liet ke app. */
  const mp = path.join(GOC, ten, "metadata.json");
  if (!fs.existsSync(mp)) {
    hong.push(ten + "/metadata");
    console.log("  [HONG] " + ten + ": thieu metadata.json");
  } else {
    try {
      const m = JSON.parse(fs.readFileSync(mp, "utf8"));
      const thieu = ["title", "description", "tags", "icon"].filter((k) => !m[k]);
      if (thieu.length) {
        hong.push(ten + "/metadata");
        console.log("  [HONG] " + ten + ": metadata thieu " + thieu.join(", "));
      }
    } catch (e) {
      hong.push(ten + "/metadata");
      console.log("  [HONG] " + ten + ": metadata.json khong doc duoc — " + e.message);
    }
  }
}

/* Khung kiem chinh no (kiem-khung.js): kiem.js thoat som / nhom treo phai ra DO, tep kiem-tat nay phai bat duoc.
   Chi chay khi tep nam canh kiem-tat.js (ban sao trong thu muc tam cua kiem-khung.js thi khong co -> khong de quy). */
const khung = path.join(GOC, "kiem-khung.js");
if (fs.existsSync(khung) && (!LOC.length || LOC.indexOf("khung") >= 0)) {
  let ra = "", dat = true;
  try { ra = execFileSync(process.execPath, [khung], { cwd: GOC, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); }
  catch (e) { dat = false; ra = (e.stdout || "") + (e.stderr || ""); }
  /* Ten phep cua kiem-khung.js tu nhac toi "[SAI]" (mo ta ca can thu) nen KHONG dem chuoi do — dung ma thoat + dong tong ket. */
  const dongCuoi = (ra.split("\n").map((d) => d.trim()).filter(Boolean).pop() || "");
  if (!dat || !DONG_TONG_KET.test(dongCuoi)) {
    hong.push("kiem-khung");
    console.log("\n[HONG] kiem-khung.js  (khung kiem co the cho xanh gia)");
    ra.split("\n").filter((d) => /^\s*\[SAI\]|Error/.test(d)).slice(0, 8).forEach((d) => console.log("    " + d.trim()));
  } else {
    console.log("  [ok]   " + "kiem-khung".padEnd(18) + ((dongCuoi.match(/(\d+) phep/) || [])[1] || "?") + " phep kiem");
  }
}

console.log("=".repeat(62));
if (hong.length) {
  console.log(hong.length + " cho HONG: " + hong.join(", ") + "\n");
  process.exit(1);
}
console.log("Dat — " + tongOK + " phep kiem tren " + thuMuc.length + " ung dung.\n");
