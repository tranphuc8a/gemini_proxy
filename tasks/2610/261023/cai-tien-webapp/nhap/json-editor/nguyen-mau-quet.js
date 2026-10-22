/* nguyen-mau-quet.js — NGUYEN MAU NHAP (khong vao repo): do toc do cac thuat toan de xuat
   cho JSON 1 MB / 10 MB:
     1. chiSoDong: Uint32Array vi tri dau moi dong
     2. quetKhoi: quet ngoac (biet chuoi) -> voi moi dong mo khoi nhieu dong: dong dong khoi
     3. doDaiByte: do dai UTF-8 cua JSON nen, khong tao chuoi, cache WeakMap
     4. timViTri: tim vi tri van ban cua mot duong dan (quet tu dau toi dich)  */
"use strict";
const fs = require("fs");
const path = require("path");

function chiSoDong(s) {
  let n = 1;
  for (let k = s.indexOf("\n"); k >= 0; k = s.indexOf("\n", k + 1)) n++;
  const a = new Uint32Array(n);
  let i = 1;
  for (let k = s.indexOf("\n"); k >= 0; k = s.indexOf("\n", k + 1)) a[i++] = k + 1;
  return a;
}

function quetKhoi(s, soDong) {
  const ketThuc = new Int32Array(soDong).fill(-1);  // dong mo -> dong dong
  const ngan = [];  // stack dong mo
  let dong = 0;
  const n = s.length;
  for (let i = 0; i < n; i++) {
    const c = s.charCodeAt(i);
    if (c === 10) { dong++; continue; }
    if (c === 34) {               // chuoi
      i++;
      while (i < n) {
        const d = s.charCodeAt(i);
        if (d === 92) { i += 2; continue; }
        if (d === 34 || d === 10) break;
        i++;
      }
      if (i < n && s.charCodeAt(i) === 10) dong++;
      continue;
    }
    if (c === 123 || c === 91) ngan.push(dong);
    else if (c === 125 || c === 93) {
      const mo = ngan.pop();
      if (mo !== undefined && mo < dong && ketThuc[mo] < 0) ketThuc[mo] = dong;
    }
  }
  return ketThuc;
}

const cache = new WeakMap();
function doDaiChuoi(s) {
  let b = 2;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 34 || c === 92) b += 2;
    else if (c < 32) b += (c === 8 || c === 9 || c === 10 || c === 12 || c === 13) ? 2 : 6;
    else if (c < 128) b += 1;
    else if (c < 2048) b += 2;
    else if (c >= 0xd800 && c <= 0xdbff) { b += 4; i++; }
    else b += 3;
  }
  return b;
}
function doDaiByte(v) {
  if (v === null) return 4;
  const t = typeof v;
  if (t === "string") return doDaiChuoi(v);
  if (t === "number") return isFinite(v) ? String(v).length : 4;
  if (t === "boolean") return v ? 4 : 5;
  const c = cache.get(v);
  if (c !== undefined) return c;
  let b;
  if (Array.isArray(v)) {
    b = 2 + Math.max(0, v.length - 1);
    for (let i = 0; i < v.length; i++) b += doDaiByte(v[i]);
  } else {
    const ks = Object.keys(v);
    b = 2 + Math.max(0, ks.length - 1);
    for (const k of ks) b += doDaiChuoi(k) + 1 + doDaiByte(v[k]);
  }
  cache.set(v, b);
  return b;
}

/* tim vi tri gia tri cua duong dan (mang khoa/chi so) trong van ban JSON hop le */
function boQuaKhoangTrang(s, i) { while (i < s.length) { const c = s.charCodeAt(i); if (c === 32 || c === 10 || c === 13 || c === 9) i++; else break; } return i; }
function cuoiChuoi(s, i) { i++; while (i < s.length) { const d = s.charCodeAt(i); if (d === 92) { i += 2; continue; } if (d === 34) return i + 1; i++; } return i; }
function cuoiGiaTri(s, i) {
  const c = s.charCodeAt(i);
  if (c === 34) return cuoiChuoi(s, i);
  if (c === 123 || c === 91) {
    let sau = 0;
    for (; i < s.length; i++) {
      const d = s.charCodeAt(i);
      if (d === 34) { i = cuoiChuoi(s, i) - 1; continue; }
      if (d === 123 || d === 91) sau++;
      else if (d === 125 || d === 93) { sau--; if (!sau) return i + 1; }
    }
    return i;
  }
  while (i < s.length) { const d = s.charCodeAt(i); if (d === 44 || d === 125 || d === 93 || d === 32 || d === 10 || d === 13 || d === 9) break; i++; }
  return i;
}
function timViTri(s, duong) {
  let i = boQuaKhoangTrang(s, 0);
  for (const seg of duong) {
    const c = s.charCodeAt(i);
    if (c === 123) {
      i = boQuaKhoangTrang(s, i + 1);
      for (;;) {
        if (s.charCodeAt(i) !== 34) return null;
        const kt = cuoiChuoi(s, i);
        const khoa = JSON.parse(s.slice(i, kt));
        i = boQuaKhoangTrang(s, kt);
        i = boQuaKhoangTrang(s, i + 1); // ':'
        if (khoa === seg) break;
        i = boQuaKhoangTrang(s, cuoiGiaTri(s, i));
        if (s.charCodeAt(i) === 44) i = boQuaKhoangTrang(s, i + 1); else return null;
      }
    } else if (c === 91) {
      i = boQuaKhoangTrang(s, i + 1);
      for (let k = 0; k < seg; k++) {
        i = boQuaKhoangTrang(s, cuoiGiaTri(s, i));
        if (s.charCodeAt(i) === 44) i = boQuaKhoangTrang(s, i + 1); else return null;
      }
    } else return null;
  }
  return { bd: i, kt: cuoiGiaTri(s, i) };
}

function do_(ten, f, lap) {
  lap = lap || 1; f();
  const t0 = process.hrtime.bigint(); let r;
  for (let i = 0; i < lap; i++) r = f();
  console.log("  " + ten.padEnd(50) + (Number(process.hrtime.bigint() - t0) / 1e6 / lap).toFixed(1).padStart(8) + " ms");
  return r;
}

for (const nhan of ["1MB", "10MB"]) {
  const s = fs.readFileSync(path.join(__dirname, "mau-" + nhan + ".json"), "utf8");
  const v = JSON.parse(s);
  console.log("\n=== " + nhan + " ===");
  const cs = do_("chiSoDong (Uint32Array)", () => chiSoDong(s), 3);
  const kt = do_("quetKhoi (dong mo -> dong dong)", () => quetKhoi(s, cs.length), 3);
  let soKhoi = 0; for (let i = 0; i < kt.length; i++) if (kt[i] >= 0) soKhoi++;
  console.log("    so khoi gap duoc: " + soKhoi + " / " + cs.length + " dong");
  do_("doDaiByte(goc) lan dau (khong cache)", () => { return doDaiByte(JSON.parse(s)); }, 1);
  const b = doDaiByte(v);
  do_("doDaiByte(goc) lan 2 (co cache)", () => doDaiByte(v), 3);
  console.log("    doDaiByte = " + b + " · Buffer.byteLength(JSON.stringify) = " + Buffer.byteLength(JSON.stringify(v)));
  const n = v.items.length;
  const r = do_("timViTri $.items[giua].address.city", () => timViTri(s, ["items", n >> 1, "address", "city"]), 3);
  console.log("    -> " + JSON.stringify(s.slice(r.bd, r.kt)));
  do_("timViTri $.items[cuoi].orders", () => timViTri(s, ["items", n - 1, "orders"]), 3);
}
