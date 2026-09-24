/* =====================================================================
   thu-engine.js — tu kiem tra CAC NGUYEN HAM cua engine, khong qua lab nao.

       node engine/thu-engine.js

   Khac voi thu-nhanh.js (chay cac lab) va <trang>/kiem-so.js (doi chieu so
   lieu lab): tep nay kiem tra thang nhung thu de hong am tham trong
   vis-core.js — bam khong gian, thang mau, doi mau, so ngau nhien.
   ===================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

/* --- Nap vis-core.js voi mot bo DOM toi thieu --- */
const ctx = {
  window: { addEventListener() {} },
  document: {
    createElement: () => ({
      width: 0, height: 0, style: {},
      getContext: () => ({
        createImageData: (w, h) => ({
          width: w, height: h, data: new Uint8ClampedArray(w * h * 4)
        }),
        setTransform() {}, putImageData() {}, drawImage() {}, save() {}, restore() {}
      })
    }),
    createElementNS: () => ({ setAttribute() {} }),
    addEventListener() {},
    documentElement: {}
  },
  getComputedStyle: () => ({ getPropertyValue: () => "#000000" }),
  Math, Object, Array, JSON, Number, String, console,
  Float32Array, Uint8Array, Uint8ClampedArray, Int32Array
};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "vis-core.js"), "utf8"), ctx);
const V = ctx.window.VIS;

let hong = 0;
function kiem(ten, dat, chiTiet) {
  console.log("  " + (dat ? "[ok]  " : "[SAI] ") + ten + (chiTiet ? "   " + chiTiet : ""));
  if (!dat) hong++;
}

console.log("\nTu kiem tra nguyen ham engine\n" + "-".repeat(58));

/* ==================================================================
   1. Bam khong gian: phai cho ra DUNG tap lang gieng ma duyet vet can
   cho ra, va khong duoc goi lap mot lang gieng hai lan.
   ================================================================== */
const CAU_HINH = [
  { rong: 100, cao: 80, banKinh: 7,  r: 6,  n: 2500, ghi: "thường" },
  { rong: 100, cao: 80, banKinh: 3,  r: 9,  n: 2000, ghi: "r lớn hơn ô" },
  { rong: 37,  cao: 11, banKinh: 9,  r: 8,  n: 800,  ghi: "miền dẹt" },
  { rong: 50,  cao: 50, banKinh: 60, r: 20, n: 400,  ghi: "ô to hơn cả miền" },
  { rong: 64,  cao: 64, banKinh: 8,  r: 8,  n: 1500, ghi: "ô chia hết miền" }
];

for (const vien of ["vong", "chan"]) {
  for (const c of CAU_HINH) {
    const HT = V.hat({ soToiDa: c.n + 10, rong: c.rong, cao: c.cao,
                       banKinh: c.banKinh, vien });
    const R = V.rng(7);
    for (let i = 0; i < c.n; i++) HT.them(R() * c.rong, R() * c.cao, 0, 0, 0);
    HT.dungBam();

    let lech = 0, lap = 0, tong = 0;
    for (let i = 0; i < c.n; i++) {
      const co = [];
      HT.quanh(i, c.r, (j) => co.push(j));
      const tap = new Set(co);
      if (co.length !== tap.size) lap++;

      const that = new Set();
      for (let j = 0; j < c.n; j++) {
        if (j === i) continue;
        const dx = HT.lech(HT.x[i], HT.x[j], c.rong);
        const dy = HT.lech(HT.y[i], HT.y[j], c.cao);
        if (dx * dx + dy * dy <= c.r * c.r) that.add(j);
      }
      tong += that.size;
      if (tap.size !== that.size) { lech++; continue; }
      for (const j of that) if (!tap.has(j)) { lech++; break; }
    }
    kiem("băm · viền=" + vien + " " + c.rong + "×" + c.cao +
         " ô=" + c.banKinh + " r=" + c.r + " (" + c.ghi + ")",
         lech === 0 && lap === 0,
         tong + " láng giềng · lệch=" + lech + " · gọi lặp=" + lap);
  }
}

/* Mep noi vong: hai tac tu o hai dau mien phai nhin thay nhau. */
{
  const HT = V.hat({ soToiDa: 4, rong: 100, cao: 100, banKinh: 9, vien: "vong" });
  HT.them(1, 50, 0, 0, 0);
  HT.them(99, 50, 0, 0, 0);
  HT.dungBam();
  let thay = 0;
  HT.quanh(0, 5, () => thay++);
  kiem("băm · hai tác tử qua mép nối vòng thấy nhau", thay === 1, "thấy " + thay);

  const HT2 = V.hat({ soToiDa: 4, rong: 100, cao: 100, banKinh: 9, vien: "chan" });
  HT2.them(1, 50, 0, 0, 0);
  HT2.them(99, 50, 0, 0, 0);
  HT2.dungBam();
  let thay2 = 0;
  HT2.quanh(0, 5, () => thay2++);
  kiem("băm · viền chặn thì KHÔNG thấy nhau qua mép", thay2 === 0, "thấy " + thay2);
}

/* tien(): noi vong phai dua tac tu ve trong mien; chan phai dap lai. */
{
  const A = V.hat({ soToiDa: 2, rong: 10, cao: 10, vien: "vong" });
  A.them(9.5, 5, 1, 0, 0);
  A.tien(1);
  kiem("tiến · nối vòng đưa về trong miền",
       A.x[0] > 0 && A.x[0] < 1, "x = " + A.x[0].toFixed(2));

  const B = V.hat({ soToiDa: 2, rong: 10, cao: 10, vien: "chan" });
  B.them(9.5, 5, 1, 0, 0);
  B.tien(1);
  kiem("tiến · viền chặn thì dội lại", B.vx[0] < 0, "vx = " + B.vx[0].toFixed(2));
}

/* xoa(): doi cho voi phan tu cuoi, so luong giam dung mot */
{
  const A = V.hat({ soToiDa: 10, rong: 10, cao: 10 });
  for (let i = 0; i < 5; i++) A.them(i, 0, 0, 0, i);
  A.xoa(1);
  kiem("xoá · giảm đúng một và giữ phần tử cuối",
       A.n === 4 && A.loai[1] === 4, "n=" + A.n + " loai[1]=" + A.loai[1]);
}

/* ==================================================================
   2. So ngau nhien phai TAI LAP DUOC — day la nen mong cua moi lab
   ================================================================== */
{
  const a = V.rng(123), b = V.rng(123), c = V.rng(124);
  let giong = true, khac = false;
  for (let i = 0; i < 500; i++) {
    if (a() !== b()) giong = false;
  }
  const a2 = V.rng(123);
  for (let i = 0; i < 50; i++) if (a2() !== c()) khac = true;
  kiem("rng · cùng hạt giống cho cùng dãy", giong);
  kiem("rng · khác hạt giống cho khác dãy", khac);

  const r = V.rng(5);
  let min = 1, max = 0;
  for (let i = 0; i < 20000; i++) { const v = r(); if (v < min) min = v; if (v > max) max = v; }
  kiem("rng · nằm trong [0, 1)", min >= 0 && max < 1,
       "min=" + min.toFixed(4) + " max=" + max.toFixed(4));

  const r2 = V.rng(5);
  let tong = 0, tong2 = 0;
  for (let i = 0; i < 40000; i++) { const z = r2.chuan(); tong += z; tong2 += z * z; }
  const tb = tong / 40000, ps = tong2 / 40000 - tb * tb;
  kiem("rng · chuẩn() có trung bình ≈ 0 và phương sai ≈ 1",
       Math.abs(tb) < 0.03 && Math.abs(ps - 1) < 0.06,
       "μ=" + tb.toFixed(4) + " σ²=" + ps.toFixed(4));
}

/* ==================================================================
   3. Doi mau CSS sang ba so
   ================================================================== */
{
  const b = (c) => V.mauSo(c).join(",");
  kiem("mauSo · #rrggbb", b("#0d7490") === "13,116,144,255", V.mauSo("#0d7490").join(","));
  kiem("mauSo · #rgb", b("#abc") === "170,187,204,255", V.mauSo("#abc").join(","));
  kiem("mauSo · rgb()", b("rgb(1, 2, 3)") === "1,2,3,255", V.mauSo("rgb(1, 2, 3)").join(","));
  kiem("mauSo · rgba()", b("rgba(1,2,3,0.5)") === "1,2,3,128", V.mauSo("rgba(1,2,3,0.5)").join(","));
}

/* ==================================================================
   4. Thang mau: don dieu, kep dung hai dau
   ================================================================== */
{
  const dau = V.thangMau(0), cuoi = V.thangMau(1);
  kiem("thangMau · kẹp dưới 0 và trên 1",
       V.thangMau(-5) === dau && V.thangMau(5) === cuoi);
  let hopLe = true;
  for (let i = 0; i <= 20; i++) {
    if (!/^rgb\(\d+,\d+,\d+\)$/.test(V.thangMau(i / 20))) hopLe = false;
  }
  kiem("thangMau · luôn trả chuỗi rgb() hợp lệ", hopLe);
}

/* ==================================================================
   5. Do thi: luu tru, bac, bo cuc
   ================================================================== */
{
  const cvGia = { W: 400, H: 400, g: ctx.document.createElement("canvas").getContext("2d") };
  const D = V.doThi(cvGia, { soToiDa: 100, le: 20 });

  for (let i = 0; i < 6; i++) D.themNut();
  kiem("doThi · thêm nút", D.n === 6, "n = " + D.n);

  D.themCanh(0, 1); D.themCanh(1, 2); D.themCanh(0, 2);
  kiem("doThi · thêm cạnh", D.canh.length === 3, D.canh.length + " cạnh");
  kiem("doThi · cạnh trùng bị bỏ qua", D.themCanh(1, 0) === false);
  kiem("doThi · cạnh tự nối bị bỏ qua", D.themCanh(3, 3) === false);
  kiem("doThi · cạnh ra ngoài phạm vi bị bỏ qua", D.themCanh(0, 99) === false);
  kiem("doThi · bậc đúng", D.bac[0] === 2 && D.bac[1] === 2 && D.bac[2] === 2 && D.bac[3] === 0,
       "bậc = " + [D.bac[0], D.bac[1], D.bac[2], D.bac[3]].join(","));
  kiem("doThi · coCanh tìm được cả hai chiều",
       D.coCanh(0, 1) >= 0 && D.coCanh(1, 0) >= 0 && D.coCanh(0, 3) === -1);

  /* Tong bac phai bang hai lan so canh — bat bien co ban cua do thi vo huong. */
  let tongBac = 0;
  for (let i = 0; i < D.n; i++) tongBac += D.bac[i];
  kiem("doThi · tổng bậc = 2 × số cạnh", tongBac === 2 * D.canh.length,
       tongBac + " vs " + (2 * D.canh.length));

  /* Xoa canh: bac giam, va bang khoa phai duoc danh so lai dung. */
  D.xoaCanh(D.coCanh(0, 1));
  kiem("doThi · xoá cạnh giảm bậc", D.bac[0] === 1 && D.bac[1] === 1);
  kiem("doThi · sau khi xoá, coCanh vẫn đúng",
       D.coCanh(0, 1) === -1 && D.coCanh(1, 2) >= 0 && D.coCanh(0, 2) >= 0);

  const ds = D.danhSachKe();
  kiem("doThi · danh sách kề khớp danh sách cạnh",
       ds[0].length === D.bac[0] && ds[2].length === D.bac[2]);

  /* Bo cuc tron: moi nut phai cach tam mot khoang nhu nhau. */
  D.boCucTron();
  let nhoNhat = 9, lonNhat = 0;
  for (let i = 0; i < D.n; i++) {
    const r = Math.hypot(D.x[i] - 0.5, D.y[i] - 0.5);
    if (r < nhoNhat) nhoNhat = r;
    if (r > lonNhat) lonNhat = r;
  }
  kiem("doThi · bố cục tròn đặt mọi nút cùng bán kính", lonNhat - nhoNhat < 1e-5,
       "r ∈ [" + nhoNhat.toFixed(4) + ", " + lonNhat.toFixed(4) + "]");

  /* Bo cuc lo xo: phai nam trong khung va tai lap duoc voi cung hat giong. */
  const E1 = V.doThi(cvGia, { soToiDa: 60 });
  const E2 = V.doThi(cvGia, { soToiDa: 60 });
  for (const G of [E1, E2]) {
    for (let i = 0; i < 40; i++) G.themNut();
    for (let i = 1; i < 40; i++) G.themCanh(i, (i * 7) % i);
    G.boCucLoXo(60, 5);
  }
  let trongKhung = true, giongNhau = true;
  for (let i = 0; i < 40; i++) {
    if (E1.x[i] < 0 || E1.x[i] > 1 || E1.y[i] < 0 || E1.y[i] > 1) trongKhung = false;
    if (Math.abs(E1.x[i] - E2.x[i]) > 1e-9) giongNhau = false;
  }
  kiem("doThi · bố cục lò xo giữ nút trong [0,1]²", trongKhung);
  kiem("doThi · bố cục lò xo tái lập được với cùng hạt giống", giongNhau);

  /* nutTai: bam trung tam mot nut phai tra ve dung nut do. */
  D.boCucTron();
  const f = D.khung();
  const mx = f.x0 + D.x[3] * f.canh, my = f.y0 + D.y[3] * f.canh;
  kiem("doThi · nutTai tìm đúng nút dưới con trỏ", D.nutTai(mx, my) === 3,
       "trả về " + D.nutTai(mx, my));
  kiem("doThi · nutTai trả -1 khi trỏ ra chỗ trống", D.nutTai(-500, -500) === -1);
}

/* ==================================================================
   6. Nhieu khung so sanh: khong chong len nhau, khong tran ra ngoai
   ================================================================== */
{
  const cvGia = { W: 800, H: 600, g: ctx.document.createElement("canvas").getContext("2d") };

  for (const [so, cot] of [[2, 2], [4, 2], [3, 3], [6, 3], [1, 1]]) {
    const K = V.khungNhieu(cvGia, { so, cot, le: 10, leTren: 24, leDuoi: 150, khoang: 8 });
    kiem("khungNhieu · so=" + so + " tra ve dung so khung", K.length === so);

    let trongCanvas = true, chongNhau = false;
    for (const k of K) {
      if (k.x0 < 0 || k.y0 < 0 ||
          k.x0 + k.rong > cvGia.W + 0.01 || k.y0 + k.cao > cvGia.H - 150 + 0.01) {
        trongCanvas = false;
      }
    }
    /* Hai khung bat ky khong duoc giao nhau. */
    for (let a = 0; a < K.length; a++) {
      for (let b = a + 1; b < K.length; b++) {
        const A = K[a], B = K[b];
        const giaoX = A.x0 < B.x0 + B.rong - 0.01 && B.x0 < A.x0 + A.rong - 0.01;
        const giaoY = A.y0 < B.y0 + B.cao - 0.01 && B.y0 < A.y0 + A.cao - 0.01;
        if (giaoX && giaoY) chongNhau = true;
      }
    }
    kiem("khungNhieu · so=" + so + "/" + cot + " cot: khung nam trong canvas", trongCanvas);
    kiem("khungNhieu · so=" + so + "/" + cot + " cot: khung khong chong nhau", !chongNhau);
  }

  /* `le` giao cho bieuDo phai dung ra dung o cua khung do. */
  const K = V.khungNhieu(cvGia, { so: 4, cot: 2, le: 10, leTren: 24, leDuoi: 150 });
  const B = V.bieuDo(cvGia, { le: K[3].le, x: { min: 0, max: 1 }, y: { min: 0, max: 1 } });
  const lechTrai = Math.abs(B.x0() - (K[3].x0 + 46));
  const lechPhai = Math.abs(B.x1() - (K[3].x0 + K[3].rong));
  const lechDuoi = Math.abs(B.y1() - (K[3].y0 + K[3].cao));
  kiem("khungNhieu · le giao cho bieuDo khop o cua khung",
       lechTrai < 0.01 && lechPhai < 0.01 && lechDuoi < 0.01,
       "lech = " + lechTrai.toFixed(2) + " / " + lechPhai.toFixed(2) + " / " + lechDuoi.toFixed(2));

  /* leLuoi giao cho luoiO cung phai nam gon trong khung. */
  const L = V.luoiO(cvGia, Object.assign({ cot: 10, hang: 10 }, K[1].leLuoi));
  L.bangMau(["#000"]);
  L.dan();
  kiem("khungNhieu · luoiO nhan leLuoi ma khong nem loi", true);

  kiem("khungNhieu · chua() nhan dung diem trong khung",
       K[0].chua(K[0].x0 + 2, K[0].y0 + 2) && !K[0].chua(K[0].x0 - 5, K[0].y0 - 5));
}

/* ================================================================== */
console.log("-".repeat(58));
if (hong) {
  console.log(hong + " mục SAI.\n");
  process.exit(1);
}
console.log("Đạt — mọi nguyên hàm engine hoạt động đúng.\n");
