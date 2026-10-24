/* =====================================================================
   khung-kiem.js — luoi an toan DUNG CHUNG cho cac kiem.js co phan bat dong bo.

   Van de: kiem.js chay cac nhom trong mot ham async (`await nhom()`). Neu mot
   Promise khong bao gio xong (Worker gia khong tra loi, hen gio khong ban…)
   thi Node thay vong lap su kien rong va THOAT VOI MA 0, khong in dong tong
   ket, va moi nhom dung SAU no bi bo qua im lang — bo kiem bao XANH dung luc
   can DO nhat. Hai lop chan:

     canhGac(ten)          dang ky process.on("exit"): neu thoat ma 0 ma chua goi
                           .xong() (tuc chua toi dong tong ket) thi in
                           "[SAI] … KHONG CHAY HET" va dat exitCode = 1.
     chayCoHan(f, ms)      chay f() (dong bo hoac Promise) voi han gio; KHONG BAO GIO
                           tu choi: tra {ok} | {loi} | {hetGio}. Nhom treo bi bao SAI
                           va cac nhom sau van chay tiep. ms = 0 -> khong han (de
                           thu rieng nhanh canhGac).
     hanTuMoiTruong(bien, macDinh)   doc han (ms) tu bien moi truong.

   Bo gop (kiem-tat.js, check.py) con doi dong cuoi cua kiem.js la
   "Dat — …" / "Đạt — …" nen kiem.js nao khong dung khung nay van khong the
   xanh gia khi thoat som. Phep thu cua chinh tep nay: kiem-khung.js.
   ===================================================================== */
"use strict";
const fs = require("fs");

/** Ghi dong bo (trong 'exit' khong con vong lap, process.stdout.write co the khong kip xuong ong). */
function ghi(chu) {
  try { fs.writeSync(1, chu); }
  catch (e) { try { process.stdout.write(chu); } catch (e2) { /* khong con cho de ghi */ } }
}

function canhGac(ten) {
  let xong = false;
  process.on("exit", (ma) => {
    if (xong || ma !== 0) return;            /* da toi tong ket, hoac da thoat voi ma loi (da co thong bao rieng) */
    ghi("\n  [SAI] " + ten + ": KHONG CHAY HET — tien trinh thoat khi chua toi dong tong ket " +
        "(co Promise khong bao gio xong? Worker / hen gio treo?); cac nhom dung sau cho treo bi bo qua.\n");
    process.exitCode = 1;
  });
  return { xong() { xong = true; } };
}

function chayCoHan(f, ms) {
  return new Promise((ra) => {
    let hen = null, da = false;
    const xong = (kq) => { if (da) return; da = true; if (hen) clearTimeout(hen); ra(kq); };
    if (ms > 0) hen = setTimeout(() => xong({ hetGio: true }), ms);
    let p;
    try { p = Promise.resolve(f()); }
    catch (e) { xong({ loi: e }); return; }
    p.then(() => xong({ ok: true }), (e) => xong({ loi: e }));
  });
}

function hanTuMoiTruong(bien, macDinh) {
  const t = process.env[bien];
  if (t === undefined || t === "") return macDinh;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : macDinh;
}

module.exports = { canhGac, chayCoHan, hanTuMoiTruong };
