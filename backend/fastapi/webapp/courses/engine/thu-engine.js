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
        setTransform() {}, putImageData() {}, drawImage() {}, save() {}, restore() {},
        /* Cac lenh ve that su — cayQuyetDinh.ve() goi den chung. Canvas gia
           chi can KHONG NEM LOI; no khong dung hinh, nen tang nay khong bao
           gio bat duoc loi hinh hoc (xem muc "Rui ro da biet" trong ke hoach). */
        beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {},
        fill() {}, stroke() {}, fillRect() {}, strokeRect() {}, clearRect() {},
        fillText() {}, setLineDash() {}, translate() {}, rotate() {},
        measureText: (t) => ({ width: String(t).length * 6 })
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


/* ==================================================================
   7. Cay quyet dinh + can duoi ly thuyet thong tin
   ================================================================== */
{
  const cvGia = { W: 600, H: 400, g: ctx.document.createElement("canvas").getContext("2d") };
  const C = V.cayQuyetDinh(cvGia, { le: 12, leTren: 26, leDuoi: 30 });

  const goc = C.goc({ nhan: "12" });
  kiem("cayQuyetDinh · chỉ có gốc thì chiều sâu = 0", C.chieuSau() === 0, "sâu = " + C.chieuSau());
  kiem("cayQuyetDinh · gốc đơn độc cũng là lá", C.soLa() === 1);

  /* Cay tam phan day du, sau 3 — dung hinh cua bai can xu. */
  C.goc({ nhan: "r" });
  (function moc(n, sau) {
    if (sau === 0) return;
    for (let i = 0; i < 3; i++) moc(C.them(n, { canh: ["<", "=", ">"][i] }), sau - 1);
  })(C.nuts[0], 3);

  kiem("cayQuyetDinh · cây tam phân sâu 3 đúng chiều sâu", C.chieuSau() === 3);
  kiem("cayQuyetDinh · cây tam phân sâu 3 có 3³ = 27 lá",
       C.soLa() === 27, C.soLa() + " lá");
  kiem("cayQuyetDinh · tổng số nút = (3⁴−1)/2 = 40",
       C.nuts.length === 40, C.nuts.length + " nút");

  C.boCuc();

  /* La phai tang nghiem ngat theo x — chong nhau la bo cuc hong. */
  const la = C.nuts.filter((n) => n.la);
  let tangDan = true;
  for (let i = 1; i < la.length; i++) if (la[i].x <= la[i - 1].x) tangDan = false;
  kiem("cayQuyetDinh · lá xếp tăng nghiêm ngặt, không chồng nhau", tangDan);

  /* Nut cha phai nam giua cac con — neu khong, canh se cat cheo qua cay. */
  let chaGiuaCon = true;
  for (const n of C.nuts) {
    if (n.la) continue;
    const xs = n.con.map((c) => c.x);
    if (n.x < Math.min(...xs) - 1e-9 || n.x > Math.max(...xs) + 1e-9) chaGiuaCon = false;
  }
  kiem("cayQuyetDinh · nút cha luôn nằm giữa các con", chaGiuaCon);

  /* Cung tang thi cung y. */
  const theoTang = {};
  let cungTangCungY = true;
  for (const n of C.nuts) {
    if (theoTang[n.sau] === undefined) theoTang[n.sau] = n.y;
    else if (Math.abs(theoTang[n.sau] - n.y) > 1e-9) cungTangCungY = false;
  }
  kiem("cayQuyetDinh · mọi nút cùng tầng có cùng y", cungTangCungY);

  /* Khong tran ra ngoai le. */
  let trongLe = true;
  for (const n of C.nuts) {
    if (n.x < 12 - 1e-9 || n.x > cvGia.W - 12 + 1e-9) trongLe = false;
    if (n.y < 26 - 1e-9 || n.y > cvGia.H - 30 + 1e-9) trongLe = false;
  }
  kiem("cayQuyetDinh · không nút nào tràn ra ngoài lề", trongLe);

  /* toDuong danh dau DUNG duong goc -> nut, khong thua khong thieu. */
  const sauNhat = C.nuts.filter((n) => n.sau === 3)[5];
  C.toDuong(sauNhat);
  const soDanhDau = C.nuts.filter((n) => n.danhDau).length;
  kiem("cayQuyetDinh · toDuong đánh dấu đúng sâu+1 nút",
       soDanhDau === sauNhat.sau + 1, soDanhDau + " nút được đánh dấu");

  C.toDuong(C.nuts[0]);
  kiem("cayQuyetDinh · toDuong xoá sạch dấu cũ trước khi tô",
       C.nuts.filter((n) => n.danhDau).length === 1);

  kiem("cayQuyetDinh · nutTai tìm thấy nút tại đúng toạ độ của nó",
       C.nutTai(sauNhat.x, sauNhat.y) === sauNhat);
  kiem("cayQuyetDinh · nutTai trả null khi trỏ ra chỗ trống",
       C.nutTai(-500, -500) === null);

  C.ve();
  kiem("cayQuyetDinh · ve() chạy không ném lỗi", true);
}

/* --- Can duoi ly thuyet thong tin ---
   BAY: ceil(log_b N) tinh thang bang so thuc SAI o dung luy thua chan.
   Math.log(27)/Math.log(3) = 3.0000000000000004 -> ceil = 4, trong khi
   dap so dung la 3. Sai mot don vi o dung cho de bi tin nhat. */
{
  kiem("canThongTin · 12 xu, cân 3 kết cục → 3 lần (bài kinh điển)",
       V.canThongTin(24, 3) === 3, "được " + V.canThongTin(24, 3));
  kiem("canThongTin · luỹ thừa chẵn 3³ = 27 vẫn ra 3, không phải 4 (bẫy dấu chấm động)",
       V.canThongTin(27, 3) === 3, "được " + V.canThongTin(27, 3));
  kiem("canThongTin · 3⁴ = 81 ra 4, không phải 5",
       V.canThongTin(81, 3) === 4, "được " + V.canThongTin(81, 3));
  kiem("canThongTin · 5³ = 125 ra 3, không phải 4",
       V.canThongTin(125, 5) === 3, "được " + V.canThongTin(125, 5));
  kiem("canThongTin · 28 trường hợp thì phải thêm một lần nữa",
       V.canThongTin(28, 3) === 4, "được " + V.canThongTin(28, 3));
  kiem("canThongTin · 100 trường hợp nhị phân → 7",
       V.canThongTin(100, 2) === 7);
  kiem("canThongTin · 1 trường hợp thì không cần hỏi", V.canThongTin(1, 2) === 0);
  kiem("canThongTin · 2 trường hợp nhị phân → 1", V.canThongTin(2, 2) === 1);

  /* Bat bien tong quat: b^k >= N > b^(k-1) voi moi N, b thu duoc. */
  let dungHet = true, viPham = "";
  for (let b = 2; b <= 6; b++) {
    for (let n = 2; n <= 400; n++) {
      const k = V.canThongTin(n, b);
      if (!(Math.pow(b, k) >= n && Math.pow(b, k - 1) < n)) {
        dungHet = false; viPham = "N=" + n + " b=" + b + " k=" + k;
      }
    }
  }
  kiem("canThongTin · b^k ≥ N > b^(k−1) đúng với mọi N ≤ 400, b ≤ 6",
       dungHet, viPham || "1 995 trường hợp");
}

/* ==================================================================
   8. Che do nguoi dung tu choi
   ================================================================== */
{
  /* Tro choi thu: dem tu 0 len 5, moi nuoc cong 1 hoac 2. Toi uu = 3. */
  const CT = V.choiThu({
    batDau: () => 0,
    nuocDi: (tt, n) => (n === 1 || n === 2) && tt + n <= 5 ? tt + n : null,
    xong: (tt) => tt === 5,
    diem: (tt, soNuoc) => tt * 100 - soNuoc,
    toiUu: () => 3
  });

  kiem("choiThu · bắt đầu ở trạng thái đầu, chưa đi nước nào",
       CT.tt() === 0 && CT.soNuoc() === 0 && !CT.xong());
  kiem("choiThu · toiUu được tính ngay lúc bắt đầu", CT.toiUu() === 3);

  kiem("choiThu · nước hợp lệ được nhận", CT.di(2) === true && CT.tt() === 2);
  kiem("choiThu · nước sai luật bị từ chối, trạng thái không đổi",
       CT.di(7) === false && CT.tt() === 2 && CT.soNuoc() === 1);

  CT.di(2); CT.di(1);
  kiem("choiThu · tới đích thì xong()", CT.tt() === 5 && CT.xong());
  kiem("choiThu · xong rồi thì không đi thêm được", CT.di(1) === false);
  kiem("choiThu · đi đúng 3 nước", CT.soNuoc() === 3);

  const b = CT.bang();
  kiem("choiThu · bảng báo đúng bằng tối ưu",
       String(b["Kết quả"]).indexOf("ĐÚNG BẰNG") >= 0, JSON.stringify(b["Kết quả"]));
  kiem("choiThu · bảng tính điểm theo hàm của lab", b["Điểm"] === 5 * 100 - 3);

  /* Hoan tac phai khoi phuc CHINH XAC trang thai truoc do. */
  CT.hoanTac();
  kiem("choiThu · hoàn tác lùi đúng một nước", CT.tt() === 4 && CT.soNuoc() === 2);
  CT.hoanTac(); CT.hoanTac();
  kiem("choiThu · hoàn tác hết thì về đúng trạng thái đầu",
       CT.tt() === 0 && CT.soNuoc() === 0);
  kiem("choiThu · hoàn tác khi chưa đi nước nào trả false", CT.hoanTac() === false);

  /* Di thua roi hoan tac ve — phai giong het luc dau. */
  CT.di(1); CT.di(1); CT.di(1); CT.di(1); CT.di(1);
  kiem("choiThu · đi 5 nước một cũng tới đích, nhưng thừa 2 nước",
       CT.xong() && CT.soNuoc() === 5 &&
       String(CT.bang()["Kết quả"]).indexOf("thừa 2") >= 0,
       JSON.stringify(CT.bang()["Kết quả"]));

  CT.batDauLai();
  kiem("choiThu · batDauLai xoá sạch lịch sử",
       CT.tt() === 0 && CT.soNuoc() === 0 && !CT.xong());
}

/* ================================================================== */
console.log("-".repeat(58));
if (hong) {
  console.log(hong + " mục SAI.\n");
  process.exit(1);
}
console.log("Đạt — mọi nguyên hàm engine hoạt động đúng.\n");
