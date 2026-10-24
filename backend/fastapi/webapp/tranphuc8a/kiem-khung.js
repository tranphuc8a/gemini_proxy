/* =====================================================================
   kiem-khung.js — kiem CHINH cac bo kiem: kiem.js thoat som / nhom bat dong
   bo treo phai ra DO, khong duoc xanh gia.

       node kiem-khung.js

   Ba lop duoc thu bang tien trinh con that (tren ban sao trong thu muc tam):
     1. khung-kiem.js (chayCoHan, hanTuMoiTruong) — thu truc tiep.
     2. json-editor/kiem.js voi cac nhom GIA (kiem/a-ok, b-treo, c-sau, d-nem):
        nhom treo -> thoat ma != 0, bao "KHONG CHAY HET" (luoi canhGac) hoac [SAI]
        het han (JE_NHOM_HAN_MS) va cac nhom sau van chay.
     3. kiem-tat.js voi cac ung dung GIA: thoat som (ma 0, khong co dong
        "Dat — …") phai bi coi la [HONG].

   Doi chieu "do tren ban cu": tro vao ban cu bang bien moi truong
       KHUNG_JE_KIEM=<duong dan kiem.js cu>   KHUNG_KIEM_TAT=<duong dan kiem-tat.js cu>
   (vd lay tu `git show 1c4f5c3:…`) — cac phep tuong ung phai ra [SAI].
   ===================================================================== */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const cp = require("child_process");
const KH = require("./khung-kiem.js");

const gac = KH.canhGac("kiem-khung.js");
const GOC = __dirname;
const NODE = process.execPath;
const JE_KIEM = process.env.KHUNG_JE_KIEM || path.join(GOC, "json-editor", "kiem.js");
const KIEM_TAT = process.env.KHUNG_KIEM_TAT || path.join(GOC, "kiem-tat.js");

let dat = 0, sai = 0;
function kiem(ten, ok, chiTiet) {
  console.log("  " + (ok ? "[ok]  " : "[SAI] ") + ten + (!ok && chiTiet ? "   " + chiTiet : ""));
  if (ok) dat++; else sai++;
  return !!ok;
}
const cat = (s) => String(s).replace(/\s+/g, " ").slice(-260);

function ghiTep(p, noiDung) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, noiDung, "utf8");
}

/** Chay `node <args>` trong `cwd`; tra {code, out}. Xoa bien han nhom khoi moi truong tru khi duoc cho. */
function chay(args, cwd, env) {
  const e = Object.assign({}, process.env, env || {});
  if (!env || env.JE_NHOM_HAN_MS === undefined) delete e.JE_NHOM_HAN_MS;
  const r = cp.spawnSync(NODE, args, { cwd, env: e, encoding: "utf8", timeout: 90000 });
  return { code: r.status === null ? -1 : r.status, out: (r.stdout || "") + (r.stderr || "") };
}
const dongCuoi = (out) => out.split("\n").map((d) => d.trim()).filter(Boolean).pop() || "";
const TONG_KET = /^(Dat|Đạt) — /;

function tamThuMuc() { return fs.mkdtempSync(path.join(os.tmpdir(), "kiem-khung-")); }
function xoa(p) { try { fs.rmSync(p, { recursive: true, force: true }); } catch (e) { /* bo qua */ } }

/* ---------------------------------------------------------------- 1. khung-kiem.js */
async function thuKhung() {
  console.log("\n[khung-kiem.js]");
  let r = await KH.chayCoHan(() => 1, 500);
  kiem("chayCoHan · ham dong bo xong -> {ok}", r.ok === true);
  r = await KH.chayCoHan(() => new Promise((x) => setTimeout(x, 5)), 500);
  kiem("chayCoHan · Promise xong -> {ok}", r.ok === true);
  r = await KH.chayCoHan(async () => { await null; throw new Error("hong"); }, 500);
  kiem("chayCoHan · Promise tu choi -> {loi}, khong nem ra ngoai", !!r.loi && r.loi.message === "hong");
  r = await KH.chayCoHan(() => { throw new Error("dong bo"); }, 500);
  kiem("chayCoHan · ham nem dong bo -> {loi}", !!r.loi && r.loi.message === "dong bo");
  const t0 = Date.now();
  r = await KH.chayCoHan(() => new Promise(() => {}), 60);
  kiem("chayCoHan · Promise khong bao gio xong -> {hetGio} sau han, khong treo", r.hetGio === true && Date.now() - t0 < 5000);
  process.env.KHUNG_THU_HAN = "123";
  const a = KH.hanTuMoiTruong("KHUNG_THU_HAN", 9);
  process.env.KHUNG_THU_HAN = "x";
  const b = KH.hanTuMoiTruong("KHUNG_THU_HAN", 9);
  process.env.KHUNG_THU_HAN = "0";
  const c = KH.hanTuMoiTruong("KHUNG_THU_HAN", 9);
  delete process.env.KHUNG_THU_HAN;
  kiem("hanTuMoiTruong · so hop le / rac -> mac dinh / 0 = khong han / khong dat -> mac dinh",
    a === 123 && b === 9 && c === 0 && KH.hanTuMoiTruong("KHUNG_THU_HAN", 9) === 9, [a, b, c].join(","));
}

/* ---------------------------------------------------------------- 2. json-editor/kiem.js */
function dungJe() {
  const goc = tamThuMuc();
  const ung = path.join(goc, "tranphuc8a");
  const je = path.join(ung, "json-editor");
  fs.mkdirSync(path.join(je, "kiem"), { recursive: true });
  fs.copyFileSync(path.join(GOC, "khung-kiem.js"), path.join(ung, "khung-kiem.js"));
  fs.copyFileSync(JE_KIEM, path.join(je, "kiem.js"));
  fs.copyFileSync(path.join(GOC, "json-editor", "kiem", "chung.js"), path.join(je, "kiem", "chung.js"));
  /* Ten nhom KHONG chua "goc" (nhom goc nap ca ung dung, o day khong can). */
  ghiTep(path.join(je, "kiem", "a-ok.js"), 'module.exports = (C) => { C.kiem("a-ok · phep mau dau tien", true); };\n');
  ghiTep(path.join(je, "kiem", "b-treo.js"), "module.exports = () => new Promise(() => {});   /* khong bao gio xong, khong hen gio */\n");
  ghiTep(path.join(je, "kiem", "c-sau.js"), 'module.exports = (C) => { C.kiem("c-sau · nhom dung sau nhom treo van duoc chay", true); };\n');
  ghiTep(path.join(je, "kiem", "d-nem.js"), 'module.exports = async () => { await null; throw new Error("nem sau await"); };\n');
  return { goc, je };
}

function thuJe() {
  console.log("\n[json-editor/kiem.js — nhom gia]");
  const { goc, je } = dungJe();
  try {
    let r = chay(["kiem.js", "a-ok", "c-sau"], je);
    kiem("kiem.js · cac nhom deu xong -> exit 0, dong cuoi la \"Dat — …\"", r.code === 0 && TONG_KET.test(dongCuoi(r.out)), "code " + r.code + " | " + cat(r.out));

    r = chay(["kiem.js", "a-ok", "b-treo", "c-sau"], je, { JE_NHOM_HAN_MS: "0" });
    kiem("kiem.js · nhom treo KHONG han (JE_NHOM_HAN_MS=0): luoi canhGac -> exit != 0, in \"KHONG CHAY HET\", khong co \"Dat —\"",
      r.code !== 0 && /KHONG CHAY HET/.test(r.out) && /\[SAI\]/.test(r.out) && !/Dat — /.test(r.out), "code " + r.code + " | " + cat(r.out));

    r = chay(["kiem.js", "a-ok", "b-treo", "c-sau"], je, { JE_NHOM_HAN_MS: "300" });
    kiem("kiem.js · nhom treo co han (300 ms): [SAI] nhom b-treo, exit != 0, khong co \"Dat —\"",
      r.code !== 0 && /\[SAI\][^\n]*b-treo/.test(r.out) && !/Dat — /.test(r.out), "code " + r.code + " | " + cat(r.out));
    kiem("kiem.js · nhom treo het han: nhom DUNG SAU van chay (khong bi bo qua im lang) va ket qua [ok]",
      /\[ok\]\s+c-sau · nhom dung sau/.test(r.out), cat(r.out));
    kiem("kiem.js · nhom treo het han: dong cuoi la tong ket SAI, khong phai \"Dat —\"", /muc SAI/.test(dongCuoi(r.out)), dongCuoi(r.out));

    r = chay(["kiem.js", "a-ok", "d-nem", "c-sau"], je);
    kiem("kiem.js · nhom nem sau await: [SAI] d-nem, exit != 0, nhom sau van chay",
      r.code !== 0 && /\[SAI\][^\n]*d-nem/.test(r.out) && /\[ok\]\s+c-sau/.test(r.out), "code " + r.code + " | " + cat(r.out));

    r = chay(["kiem.js", "khong-co-nhom-nay"], je);
    kiem("kiem.js · bo loc khong khop nhom nao -> exit != 0 (khong xanh gia)", r.code !== 0, "code " + r.code + " | " + cat(r.out));
  } finally { xoa(goc); }
}

/* ---------------------------------------------------------------- 3. kiem-tat.js */
const META = JSON.stringify({ title: "T", description: "d", tags: ["x"], icon: "i" });
function dungTat(ungDung) {
  const goc = tamThuMuc();
  fs.copyFileSync(KIEM_TAT, path.join(goc, "kiem-tat.js"));
  for (const [ten, ma] of Object.entries(ungDung)) {
    ghiTep(path.join(goc, ten, "kiem.js"), ma);
    ghiTep(path.join(goc, ten, "metadata.json"), META);
  }
  return goc;
}
const UNG = {
  tot: 'console.log("  [ok]   mot phep");\nconsole.log("-".repeat(10));\nconsole.log("Dat — 1 phep.\\n");\n',
  totDau: 'console.log("  [ok]   mot phep");\nconsole.log("Đạt — 2 phép kiểm.");\n',
  /* Thoat som: in vai dong [ok] roi ket thuc ma 0 ma khong toi dong tong ket (Promise treo -> Node thoat 0). */
  im: 'console.log("  [ok]   mot phep");\n(async () => { await new Promise(() => {}); console.log("Dat — khong toi day"); })();\n',
  sai: 'console.log("  [SAI] mot phep");\nprocess.exit(1);\n'
};

function thuTat() {
  console.log("\n[kiem-tat.js — ung dung gia]");
  let goc = dungTat({ "ung-tot": UNG.tot, "ung-tot-dau": UNG.totDau });
  try {
    const r = chay(["kiem-tat.js"], goc);
    kiem("kiem-tat · moi ung dung co dong \"Dat — / Đạt —\" -> exit 0, [ok] ca hai",
      r.code === 0 && /\[ok\]\s+ung-tot\b/.test(r.out) && /\[ok\]\s+ung-tot-dau/.test(r.out) && !/\[HONG\]/.test(r.out), "code " + r.code + " | " + cat(r.out));
  } finally { xoa(goc); }

  goc = dungTat({ "ung-tot": UNG.tot, "ung-im": UNG.im });
  try {
    const r = chay(["kiem-tat.js"], goc);
    kiem("kiem-tat · ung dung thoat som (ma 0, KHONG co \"Dat —\"): [HONG] ung-im + \"KHONG CHAY HET\", exit != 0",
      r.code !== 0 && /\[HONG\] ung-im/.test(r.out) && /KHONG CHAY HET/.test(r.out), "code " + r.code + " | " + cat(r.out));
    kiem("kiem-tat · ung dung dung van [ok] canh ung dung thoat som", /\[ok\]\s+ung-tot\b/.test(r.out) && !/\[HONG\] ung-tot\b/.test(r.out), cat(r.out));
  } finally { xoa(goc); }

  goc = dungTat({ "ung-tot": UNG.tot, "ung-im": UNG.im });
  try {
    let r = chay(["kiem-tat.js", "ung-tot"], goc);
    kiem("kiem-tat · bo loc theo ten: chi chay ung dung khop (bo qua ung-im) -> exit 0", r.code === 0 && /\[ok\]\s+ung-tot\b/.test(r.out) && !/ung-im/.test(r.out), "code " + r.code + " | " + cat(r.out));
    r = chay(["kiem-tat.js", "khong-co-ung-dung-nay"], goc);
    kiem("kiem-tat · bo loc khong khop ung dung nao -> exit != 0 (khong xanh gia)", r.code !== 0, "code " + r.code + " | " + cat(r.out));
  } finally { xoa(goc); }

  goc = dungTat({ "ung-sai": UNG.sai });
  try {
    const r = chay(["kiem-tat.js"], goc);
    kiem("kiem-tat · ung dung co [SAI] / exit 1 -> [HONG], exit != 0", r.code !== 0 && /\[HONG\] ung-sai/.test(r.out), "code " + r.code + " | " + cat(r.out));
  } finally { xoa(goc); }
}

(async function () {
  console.log("\nKiem khung kiem (kiem.js / kiem-tat.js khong duoc xanh gia)\n" + "-".repeat(58));
  await thuKhung();
  thuJe();
  thuTat();
  gac.xong();
  console.log("-".repeat(58));
  if (sai) { console.log(sai + " muc SAI (" + dat + " dat).\n"); process.exit(1); }
  console.log("Dat — " + dat + " phep, khung kiem khong cho xanh gia.\n");
})().catch((e) => {
  gac.xong();
  console.log("  [SAI] kiem-khung.js nem loi: " + (e && e.stack ? e.stack.split("\n").slice(0, 3).join(" | ") : e));
  process.exit(1);
});
