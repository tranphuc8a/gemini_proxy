/* =====================================================================
   kiem-tat.js — chay bo kiem cua moi ung dung tu viet trong thu muc nay.

       node kiem-tat.js

   Tra exit code khac 0 neu bat ky ung dung nao hong, de noi vao CI duoc.

   Chi chay nhung thu muc CO tep kiem.js. Ung dung nhap tu ngoai (ban
   dung React da build) khong co, va deu bi bo qua — khong coi la loi.
   ===================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const GOC = __dirname;
const thuMuc = fs.readdirSync(GOC, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .filter((n) => fs.existsSync(path.join(GOC, n, "kiem.js")))
  .sort();

if (!thuMuc.length) {
  console.log("Khong tim thay ung dung nao co kiem.js.");
  process.exit(0);
}

console.log("\nKiem " + thuMuc.length + " ung dung: " + thuMuc.join(", "));
console.log("=".repeat(62));

let hong = [];
let tongOK = 0;

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
  tongOK += soOK;
  if (!dat || soSai) {
    hong.push(ten);
    console.log("\n[HONG] " + ten + "  (" + soOK + " dat, " + soSai + " sai)");
    ra.split("\n").filter((d) => /\[SAI\]|Error|SyntaxError/.test(d))
      .slice(0, 8).forEach((d) => console.log("    " + d.trim()));
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

console.log("=".repeat(62));
if (hong.length) {
  console.log(hong.length + " cho HONG: " + hong.join(", ") + "\n");
  process.exit(1);
}
console.log("Dat — " + tongOK + " phep kiem tren " + thuMuc.length + " ung dung.\n");
