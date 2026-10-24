/* kiem/tai-lieu-lon.js — dot J5: tai lieu JSON lon (khong treo, Xem ao, nhap lon).
   Ham THUAN (chia nhom cay, dem co cache, ghep van ban tai cho, dsHien / cuon ti le cua Xem, doThut tuyen tinh) kiem
   bang node, doi chieu voi cai cai dat THAM CHIEU viet rieng (vet can co nho + ngau nhien co hat). Quyet dinh vao
   Xem / luu nhap kiem tren DOM gia. Phan can trinh duyet that (so dong ao khop textarea, IndexedDB, hieu nang)
   o check.py --chuc-nang / --hieu-nang.
   Luu y V8 (Node 24): vong JSON.stringify -> JSON.parse lam hong KHOA MOT KY TU "\" va "\"" — khoa sinh ngau nhien
   o day dai >= 2 ky tu, va moi phep doi chieu di tu mo hinh sinh ra / van ban goc, khong qua vong do. */
"use strict";

module.exports = function (C) {
  const kiem = C.kiem, bang = C.bang;
  const MT = C.taoMoiTruong();
  const T = MT.T, A = MT.APP, JE = MT.JE;
  const X = MT.ctx.JE_XEM_THU;
  if (!kiem("JE_THU co chiaNhom / ghepTaiCho; JE_XEM_THU co dungDsHien", !!(T.chiaNhom && T.ghepTaiCho && X && X.dungDsHien))) return;
  const rnd = C.taoNgauNhien(20261024);
  const ngauNhien = (n) => Math.floor(rnd() * n);

  /* ====================== chiaNhom / chuoiNhom: vet can ====================== */
  {
    let sai = "", soCa = 0;
    for (const co of [2, 3, 4, 7, 10]) {
      for (let n = 0; n <= 260 && !sai; n++) {
        const g = T.chiaNhom(0, n, co);
        soCa++;
        if (n <= co) { if (g !== null) sai = "n=" + n + " co=" + co + ": phai null"; continue; }
        if (!g || g.length < 2 || g.length > co) { sai = "n=" + n + " co=" + co + ": so nhom " + (g && g.length); break; }
        let hh = 0, bdMong = 0;
        for (const x of g) { if (x.bd !== bdMong || x.kt <= x.bd) hh = 1; bdMong = x.kt; }
        if (hh || bdMong !== n) { sai = "n=" + n + " co=" + co + ": khong phan hoach [0,n)"; break; }
        /* nhom con: moi nhom giu <= co phan tu hoac chia tiep thanh <= co nhom; khong khoang nao > co khi ket thuc */
        const kiemNhom = (bd, kt, sau) => {
          const s = T.chiaNhom(bd, kt, co);
          if (s === null) return kt - bd <= co;
          if (sau > 8 || s.length > co) return false;
          return s.every((y) => kiemNhom(y.bd, y.kt, sau + 1));
        };
        if (!g.every((x) => kiemNhom(x.bd, x.kt, 1))) { sai = "n=" + n + " co=" + co + ": nhom con vuot co"; break; }
        /* chuoiNhom(i): moi cap chua i, cap sau long trong cap truoc, cap cuoi la nhom <= co phan tu */
        for (let i = 0; i < n; i += Math.max(1, Math.floor(n / 17))) {
          const ch = T.chuoiNhom(i, n, co);
          if (!ch.length || !ch.every((x, j) => x.bd <= i && i < x.kt && (j === 0 || (x.bd >= ch[j - 1].bd && x.kt <= ch[j - 1].kt)))) { sai = "chuoiNhom i=" + i + " n=" + n + " co=" + co; break; }
          const cuoi = ch[ch.length - 1];
          if (cuoi.kt - cuoi.bd > co) { sai = "nhom cuoi > co o i=" + i + " n=" + n; break; }
        }
      }
    }
    kiem("chiaNhom · " + soCa + " ca (co 2..10, n 0..260): phan hoach [0,n), <= co nhom moi cap, nhom con <= co phan tu; chuoiNhom dung", !sai, sai);
    const g100 = T.chiaNhom(0, 250, 100), g1m = T.chiaNhom(0, 1000000, 100), g10k1 = T.chiaNhom(0, 10001, 100);
    kiem("chiaNhom · 250 con (co 100) → [0,100) [100,200) [200,250); 1 000 000 con → 100 nhom 10 000; 10 001 → nhom 10 000 + nhom 1",
      bang(g100, [{ bd: 0, kt: 100 }, { bd: 100, kt: 200 }, { bd: 200, kt: 250 }]) && g1m.length === 100 && g1m[1].kt - g1m[1].bd === 10000 &&
      bang(g10k1, [{ bd: 0, kt: 10000 }, { bd: 10000, kt: 10001 }]));
    kiem("chiaNhom · 100 con (dung co) khong chia; 101 con chia 2 nhom", T.chiaNhom(0, 100, 100) === null && T.chiaNhom(0, 101, 100).length === 2);
    kiem("chiaNhom · mac dinh co = hangSo.NHOM_CON (100) va doi duoc luc chay",
      A.hangSo.NHOM_CON === 100 && T.chiaNhom(0, 150).length === 2 && (() => { A.hangSo.NHOM_CON = 50; const n = T.chiaNhom(0, 150).length; A.hangSo.NHOM_CON = 100; return n === 3; })());
  }

  /* ====================== khoa nhom + doiTrangThai ====================== */
  {
    const k = T.khoaNhom(["a", 3], 100, 199);
    kiem("khoaNhom · '[\"a\",3]#100:199' va tachKhoaNhom nguoc lai", k === '["a",3]#100:199' && bang(T.tachKhoaNhom(k), { duong: '["a",3]', hau: "#100:199" }));
    kiem("tachKhoaNhom · khoa duong thuong (ke ca khoa chua ']#1:2') khong bi nhan nham la khoa nhom",
      T.tachKhoaNhom('["a"]') === null && T.tachKhoaNhom('[]') === null && T.tachKhoaNhom(JSON.stringify(["a]#1:2"])) === null && T.tachKhoaNhom(JSON.stringify(["x", "]#3:4"])) === null);
    const tt = Object.assign(Object.create(null), { '[]': true, '["m"]': true, '["m"]#0:99': true, '["m"]#100:199': false, '["o"]#0:99': true });
    const xoa = T.doiTrangThai(tt, { loai: "xoa", duong: ["m", 5] });
    kiem("doiTrangThai · xoa phan tu: trang thai nhom cua cha giu nguyen, khong nem loi voi khoa nhom", xoa['["m"]#0:99'] === true && xoa['["m"]#100:199'] === false && xoa['["o"]#0:99'] === true);
    const dt = T.doiTrangThai(tt, { loai: "doi-ten", duong: ["m"], moi: "mm" });
    kiem("doiTrangThai · doi ten khoa cha keo theo khoa nhom (#bd:kt giu nguyen)", dt['["mm"]#0:99'] === true && dt['["mm"]#100:199'] === false && dt['["m"]#0:99'] === undefined && dt['["o"]#0:99'] === true);
    const lenDong = T.doiTrangThai(Object.assign(Object.create(null), { '["m",2]': true, '["m",2]#0:99': true }), { loai: "xoa", duong: ["m", 0] });
    kiem("doiTrangThai · xoa phan tu 0 cua mang cha: nhom cua phan tu 2 doi thanh phan tu 1", lenDong['["m",1]#0:99'] === true && lenDong['["m",1]'] === true);
    const bi = T.doiTrangThai(Object.assign(Object.create(null), { '["m",3]#0:99': true }), { loai: "xoa", duong: ["m", 3] });
    kiem("doiTrangThai · xoa chinh nut cha cua nhom: nhom bien mat", Object.keys(bi).length === 0);
  }

  /* ====================== dem: doi chieu tham chieu de quy + cache ====================== */
  {
    const thamChieu = (v, sau) => {
      const r = { nut: 0, sau: sau, la: 0, mang: 0, obj: 0 };
      const di = (x, d) => {
        r.nut++; if (d > r.sau) r.sau = d;
        if (Array.isArray(x)) { r.mang++; x.forEach((y) => di(y, d + 1)); }
        else if (x !== null && typeof x === "object") { r.obj++; Object.keys(x).forEach((k) => di(x[k], d + 1)); }
        else r.la++;
      };
      di(v, sau);
      return r;
    };
    const sinh = (d) => {
      const kieu = ngauNhien(d > 5 ? 3 : 6);
      if (kieu === 0) return ngauNhien(100);
      if (kieu === 1) return "s" + ngauNhien(9);
      if (kieu === 2) return rnd() < 0.5 ? null : rnd() < 0.5;
      const n = ngauNhien(5);
      if (kieu <= 4) { const a = []; for (let i = 0; i < n; i++) a.push(sinh(d + 1)); return a; }
      const o = {}; for (let i = 0; i < n; i++) o["k" + i + ngauNhien(3)] = sinh(d + 1); return o;
    };
    let sai = "";
    for (let i = 0; i < 400 && !sai; i++) {
      const v = sinh(0), sau0 = ngauNhien(4), mong = thamChieu(v, sau0), got = T.dem(v, sau0), got2 = T.dem(v, sau0);
      const kieu = {}; const dem = (x) => { const k = Array.isArray(x) ? "array" : x === null ? "null" : typeof x; kieu[k] = (kieu[k] || 0) + 1; if (k === "array") x.forEach(dem); else if (k === "object") Object.keys(x).forEach((q) => dem(x[q])); };
      dem(v);
      if (got.nut !== mong.nut || got.sau !== mong.sau || got.la !== mong.la || got.mang !== mong.mang || got.obj !== mong.obj || !bang(got, got2) ||
          JSON.stringify(Object.keys(got.kieu).sort().map((k) => [k, got.kieu[k]])) !== JSON.stringify(Object.keys(kieu).sort().map((k) => [k, kieu[k]]))) sai = JSON.stringify(v).slice(0, 80) + " got " + JSON.stringify(got) + " mong " + JSON.stringify(mong);
    }
    kiem("dem · 400 cay ngau nhien: nut / sau / la / mang / obj / kieu khop tham chieu de quy; goi lai (qua cache) cho cung ket qua", !sai, sai);
    /* cache song qua sua: nhanh khong doi giu danh tinh, ket qua van dung sau khi doi mot la */
    const goc = { a: sinh(1), b: { c: [1, 2, { d: 3 }] }, e: [sinh(1), sinh(1)] };
    T.dem(goc);
    const moi = T.datTai(goc, ["b", "c", 2, "d"], [9, 9, 9]);
    const got = T.dem(moi), mong = thamChieu(moi, 0);
    kiem("dem · sau khi datTai (sao nong), ket qua cua cay moi dung (cache chi cua nhanh khong doi)",
      got.nut === mong.nut && got.sau === mong.sau && got.la === mong.la && moi.a === goc.a && moi.e === goc.e);
    const ta = Date.now();
    const lon = []; for (let i = 0; i < 60000; i++) lon.push({ id: i, t: ["a", "b"], o: { x: i } });
    const d1 = T.dem(lon); const t1 = Date.now() - ta; const t2a = Date.now(); const d2 = T.dem(lon); const t2 = Date.now() - t2a;
    kiem("dem · 60 000 object (300 000 nut): lan dau " + t1 + " ms, lan sau (cache) " + t2 + " ms — dung va nhanh hon", d1.nut === 1 + 60000 * 7 && bang(d1, d2) && t2 <= Math.max(5, t1), t1 + "/" + t2);
  }

  /* ====================== doThut / coXuongDongCuoi: dung + tuyen tinh ====================== */
  {
    const J2 = JSON.stringify({ a: [1, { b: 2 }] }, null, 2), J4 = JSON.stringify({ a: [1, { b: 2 }] }, null, 4), JT = JSON.stringify({ a: [1, { b: 2 }] }, null, "\t");
    kiem("doThut · 2 / 4 / tab / nen / rong / xuong dong cuoi",
      T.doThut(J2) === 2 && T.doThut(J4) === 4 && T.doThut(JT) === "\t" && T.doThut('{"a":1}') === 0 && T.doThut("") === 2 && T.doThut("  \n  ") === 2 && T.doThut(J2 + "\n") === 2 && T.doThut("\n\n" + J4 + "\n\n") === 4);
    kiem("coXuongDongCuoi · '\\n', '\\n  ', '\\n\\t' co; khong co; rong", T.coXuongDongCuoi("x\n") && T.coXuongDongCuoi("x\n  ") && T.coXuongDongCuoi("x\n\t") && !T.coXuongDongCuoi("x") && !T.coXuongDongCuoi("x  ") && !T.coXuongDongCuoi(""));
    const lon = "[\n  " + new Array(2000000).join("1,\n  ") + "1\n]\n";
    const t0 = process.hrtime.bigint();
    const kq = T.doThut(lon), end = T.coXuongDongCuoi(lon);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    kiem("doThut · tai lieu " + (lon.length / 1e6).toFixed(1) + " M ky tu: dung (2) va < 50 ms (chi nhin 64 KB dau): " + ms.toFixed(1) + " ms", kq === 2 && end === true && ms < 50, String(ms));
    /* ca benh ly bac hai: dai khoang trang 70 000 o giua / cuoi khong lam cham */
    const khoangTrang = '{"a":1,' + " ".repeat(70000) + '"b":2}' + " ".repeat(70000) + "x";
    const t1 = process.hrtime.bigint();
    T.doThut(khoangTrang); T.coXuongDongCuoi(khoangTrang); T.vietTheoKieu({ a: 1 }, khoangTrang);
    const ms2 = Number(process.hrtime.bigint() - t1) / 1e6;
    kiem("doThut / coXuongDongCuoi / vietTheoKieu · dai khoang trang 70 000 ky tu: tuyen tinh (" + ms2.toFixed(1) + " ms)", ms2 < 100, String(ms2));
    kiem("vietTheoKieu · giu thut + xuong dong cuoi nhu cu", T.vietTheoKieu({ a: [1] }, J4 + "\n") === JSON.stringify({ a: [1] }, null, 4) + "\n" && T.vietTheoKieu({ a: 1 }, '{"a":0}') === '{"a":1}');
  }

  /* ====================== ghepTaiCho / vietGiaTri: ngau nhien, doi chieu mo hinh + byte ngoai doan ====================== */
  {
    const KHOA = ["ab", "x y", 'q"r', "back\\slash", "tiếng Việt", "😀🙂", "<i>", "__proto__", "n1", "n2", "constructor"];
    const sinhGt = (d) => {
      const k = ngauNhien(d > 3 ? 4 : 7);
      if (k === 0) return ngauNhien(1000) / (rnd() < 0.5 ? 1 : 8);
      if (k === 1) return KHOA[ngauNhien(KHOA.length)] + ngauNhien(5);
      if (k === 2) return rnd() < 0.3 ? null : rnd() < 0.5;
      if (k === 3) return ngauNhien(3) ? "văn bản " + ngauNhien(50) : "";
      const n = ngauNhien(4) + (d === 0 ? 2 : 0);
      if (k <= 5) { const a = []; for (let i = 0; i < n; i++) a.push(sinhGt(d + 1)); return a; }
      const o = {}; for (let i = 0; i < n; i++) Object.defineProperty(o, KHOA[ngauNhien(KHOA.length)] + (rnd() < 0.5 ? "" : i), { value: sinhGt(d + 1), enumerable: true, writable: true, configurable: true });
      return o;
    };
    const cacDuong = (v) => { const ra = []; const di = (x, p) => { ra.push(p); if (Array.isArray(x)) x.forEach((y, i) => di(y, p.concat([i]))); else if (x && typeof x === "object") Object.keys(x).forEach((k) => di(x[k], p.concat([k]))); }; di(v, []); return ra; };
    const giong = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    let sai = "", soCa = 0, soBoQua = 0;
    for (let lan = 0; lan < 300 && !sai; lan++) {
      const goc = sinhGt(0);
      if (goc === null || typeof goc !== "object") continue;
      const thut = [2, 4, "\t", 0][ngauNhien(4)];
      const s = JSON.stringify(goc, null, thut) + (rnd() < 0.5 ? "\n" : "");
      const ds = cacDuong(goc).filter((p) => p.length);
      for (let q = 0; q < 6 && ds.length && !sai; q++) {
        const p = ds[ngauNhien(ds.length)], moi = sinhGt(1 + ngauNhien(2));
        const gocMoi = T.datTai(goc, p, moi);
        const ghep = T.ghepTaiCho(s, gocMoi, { loai: "thay", duong: p });
        soCa++;
        if (ghep === null) { soBoQua++; continue; }
        const vt = MT.JE.viTri.timViTri(s, p);
        const phanDau = s.slice(0, vt.bd), phanCuoi = s.slice(vt.kt);
        if (!ghep.startsWith(phanDau) || !ghep.endsWith(phanCuoi)) { sai = "doan ngoai bi doi: " + JSON.stringify(p); break; }
        const giua = ghep.slice(phanDau.length, ghep.length - phanCuoi.length);
        let parsed;
        try { parsed = JSON.parse(ghep); } catch (e) { sai = "ghep ra JSON hong " + JSON.stringify(p) + " " + e.message; break; }
        /* doi chieu mo hinh: gia tri tai p trong ban ghep == moi (so tu van ban goc cua doan, tranh vong stringify/parse cua khoa 1 ky tu) */
        const tai = T.layTai(parsed, p);
        if (!giong(tai, moi) && !(typeof moi === "number" && tai === moi)) { sai = "gia tri tai " + JSON.stringify(p) + " khong bang moi: " + JSON.stringify(tai) + " vs " + JSON.stringify(moi); break; }
        /* phan con lai cua mo hinh (loai tru nhanh p) khong doi */
        const gocBo = T.datTai(parsed, p, 0), gocBo2 = T.datTai(goc, p, 0);
        if (!giong(gocBo, gocBo2)) { sai = "phan con lai doi khi thay " + JSON.stringify(p); break; }
        /* dinh dang: gia tri nhanh xuong dong dung thut le cua van ban */
        if (typeof moi === "object" && moi !== null && Object.keys(moi).length && thut !== 0) {
          if (giua.indexOf("\n") < 0) { sai = "gia tri nhanh khong xuong dong voi thut " + thut; break; }
        }
        if (thut === 0 && giua.indexOf("\n") >= 0) { sai = "van ban nen ma doan chen xuong dong"; break; }
      }
    }
    kiem("ghepTaiCho · " + soCa + " ca ngau nhien (thut 2 / 4 / tab / nen, khoa co \" \\ emoji __proto__): JSON hop le, doan ngoai KHONG doi byte, gia tri dung, phan con lai cua mo hinh khong doi", !sai && soBoQua < soCa / 4, sai || ("bo qua " + soBoQua));
    /* doi ten */
    const s = '{\n  "a": 1,\n  "b": { "c": 2 },\n  "d": 3\n}\n';
    const g = T.doiTenKhoa(JSON.parse(s), ["b"], "bb");
    const r = T.ghepTaiCho(s, g, { loai: "doi-ten", duong: ["b"], moi: "bb" });
    kiem("ghepTaiCho · doi ten khoa: chi doi token khoa, giu dinh dang (khoang trang trong { \"c\": 2 })", r === '{\n  "a": 1,\n  "bb": { "c": 2 },\n  "d": 3\n}\n', JSON.stringify(r));
    const r2 = T.ghepTaiCho(s, JSON.parse(s), { loai: "doi-ten", duong: ["b"], moi: 'x"y\\z' });
    kiem("ghepTaiCho · doi ten thanh khoa co dau nhay / gach cheo: token thoat dung, van ban van la JSON", JSON.parse(r2) && Object.keys(JSON.parse(r2))[1] === 'x"y\\z', r2);
    kiem("ghepTaiCho · duong khong co / goc / phep la → null (nguoi goi viet lai ca van ban)",
      T.ghepTaiCho(s, JSON.parse(s), { loai: "thay", duong: ["khong"] }) === null && T.ghepTaiCho(s, JSON.parse(s), { loai: "thay", duong: [] }) === null && T.ghepTaiCho(s, JSON.parse(s), { loai: "xoa", duong: ["a"] }) === null);
    {
      const vb = '{\n  "a": {\n    "b": 0\n  }\n}', bd = vb.indexOf("{", 1);
      kiem("vietGiaTri · gia tri nhanh dat sau 'khoa': cac dong sau thut them theo dong chua vi tri",
        T.vietGiaTri({ x: [1] }, vb, bd) === '{\n    "x": [\n      1\n    ]\n  }', JSON.stringify(T.vietGiaTri({ x: [1] }, vb, bd)));
    }
    {
      const lon = JSON.stringify({ items: Array.from({ length: 120000 }, (_, i) => ({ id: i, t: "tiếng " + i, o: { x: i } })), cuoi: 1 }, null, 2);
      const mh = JSON.parse(lon), duong = ["items", 119999, "id"];
      const gm = T.datTai(mh, duong, -1);
      const t = process.hrtime.bigint();
      const kq = T.ghepTaiCho(lon, gm, { loai: "thay", duong: duong });
      const ms = Number(process.hrtime.bigint() - t) / 1e6;
      kiem("ghepTaiCho · van ban " + (lon.length / 1e6).toFixed(1) + " M ky tu, sua o gan cuoi: " + ms.toFixed(0) + " ms < 900 (khong stringify lai ca tai lieu; timViTri phai quet het khoa trung), do dai dung",
        kq && kq.length === lon.length + String(-1).length - String(119999).length && ms < 900, String(kq && kq.length - lon.length));
    }
  }

  /* ====================== Worker "dinh-dang" (xuLy chay nguyen mot tin nhu trong Worker) ====================== */
  {
    const xl = (du, thut) => JE.chayNen.xuLy(JE, { loai: "dinh-dang", du: du, tuyChon: thut === undefined ? {} : { thut: thut } });
    const goc = { b: [1, { c: "tiếng Việt" }], a: null };
    const d2 = JSON.stringify(goc, null, 2), d4 = JSON.stringify(goc, null, 4), dn = JSON.stringify(goc);
    kiem("chay-nen · dinh-dang: thut 2 / 4 / tab / 0 (nen) / mac dinh 2 cho ra dung JSON.stringify",
      xl(dn, 2).kq.vanBan === d2 && xl(d2, 4).kq.vanBan === d4 && xl(d2, 0).kq.vanBan === dn && xl(d2).kq.vanBan === d2 && xl(dn, "	").kq.vanBan === JSON.stringify(goc, null, "	"));
    const hong = xl('{"a": [1, 2', 2);
    kiem("chay-nen · dinh-dang: van ban hong → loi phan 'du' (giao dien roi ve duong dong bo de bao dong / cot)", hong.loi && hong.loi.phan === "du" && !hong.kq, JSON.stringify(hong));
    const lon = JSON.stringify({ x: Array.from({ length: 200000 }, (_, i) => ({ i, s: "a" + i })) });
    const t0 = process.hrtime.bigint();
    const kq = xl(lon, 2);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    kiem("chay-nen · dinh-dang: " + (lon.length / 1e6).toFixed(1) + " M ky tu dung " + ms.toFixed(0) + " ms (trong Worker thi khong chan luong chinh)", kq.kq && kq.kq.vanBan === JSON.stringify(JSON.parse(lon), null, 2), String(ms));
  }

  /* ====================== Xem: dsHien / ti le cuon / khoi chua / gap toi cap ====================== */
  {
    const sinhVb = (d) => {
      const k = ngauNhien(d > 3 ? 3 : 6);
      if (k < 3) return k === 0 ? String(ngauNhien(100)) : k === 1 ? '"v' + ngauNhien(9) + '"' : "true";
      const n = ngauNhien(4);
      return k <= 4 ? "[" + Array.from({ length: n }, () => sinhVb(d + 1)).join(",") + "]" : "{" + Array.from({ length: n }, (_, i) => '"k' + i + '":' + sinhVb(d + 1)).join(",") + "}";
    };
    let sai = "", nKhoi = 0;
    for (let lan = 0; lan < 250 && !sai; lan++) {
      const v = sinhVb(0);
      if (v[0] !== "[" && v[0] !== "{") continue;
      const s = JSON.stringify(JSON.parse(v), null, 2);
      const bq = JE.viTri.taoBoQuetKhoi(); bq.chay(s, 0);
      const quet = bq.ketQua(), nDong = quet.soDong;
      nKhoi += quet.soKhoi;
      const gap = new Uint8Array(quet.soKhoi);
      for (let k = 0; k < quet.soKhoi; k++) gap[k] = rnd() < 0.4 ? 1 : 0;
      const r = X.dungDsHien(quet, gap, nDong);
      /* tham chieu: dong L bi an khi co khoi gap k (nhieu dong) voi dongMo[k]-1 < L <= dongDong[k]-1 */
      const hien = [];
      for (let L = 0; L < nDong; L++) {
        let an = false;
        for (let k = 0; k < quet.soKhoi; k++) if (gap[k] && quet.dongDong[k] > quet.dongMo[k] && quet.dongMo[k] - 1 < L && L <= quet.dongDong[k] - 1) { an = true; break; }
        if (!an) hien.push(L);
      }
      const ds = r.ds ? Array.from(r.ds) : Array.from({ length: nDong }, (_, i) => i);
      if (!bang(ds, hien) || r.n !== hien.length) { sai = "dsHien sai o lan " + lan + ": " + JSON.stringify(ds.slice(0, 12)) + " vs " + JSON.stringify(hien.slice(0, 12)); break; }
      for (let L = 0; L < nDong; L++) {
        const h = X.hangCuaDong(r.ds, L, r.n);
        const ok = hien[h] <= L && (h + 1 >= hien.length || hien[h + 1] > L);
        if (!ok) { sai = "hangCuaDong L=" + L + " → " + h; break; }
        if (X.dongCuaHang(r.ds, h) !== hien[h]) { sai = "dongCuaHang"; break; }
      }
      /* khoiChua + khoiTrongCung: tham chieu bang quet thang */
      for (let L = 0; L < nDong && !sai; L += 1 + ngauNhien(3)) {
        const mong = [];
        for (let k = 0; k < quet.soKhoi; k++) if (quet.dongDong[k] > quet.dongMo[k] && quet.dongMo[k] - 1 <= L && L <= quet.dongDong[k] - 1) mong.push(k);
        if (!bang(X.khoiChua(quet, L), mong) || X.khoiTrongCung(quet, L) !== (mong.length ? mong[mong.length - 1] : -1)) sai = "khoiChua L=" + L;
      }
      /* gapToiCap(cap): gap khi sau >= cap va nhieu dong */
      const cap = ngauNhien(4), gc = X.gapToiCap(quet, cap);
      for (let k = 0; k < quet.soKhoi; k++) if (gc[k] !== (quet.sau[k] >= cap && quet.dongDong[k] > quet.dongMo[k] ? 1 : 0)) { sai = "gapToiCap cap " + cap + " khoi " + k; break; }
    }
    kiem("Xem · dungDsHien / hangCuaDong / khoiChua / gapToiCap khop tham chieu vet can tren 250 tai lieu ngau nhien (" + nKhoi + " khoi, 40% gap ngau nhien)", !sai, sai);
    /* khoi 'dong den cuoi' (JSON thieu ngoac): gap an toi het van ban */
    const hong = '{\n  "a": [\n    1,\n    2\n';
    const bq = JE.viTri.taoBoQuetKhoi(); bq.chay(hong, 0);
    const q = bq.ketQua(), gp = new Uint8Array(q.soKhoi); gp[1] = 1;
    const r = X.dungDsHien(q, gp, q.soDong);
    kiem("Xem · khoi chua dong (thieu ngoac) bi gap: an toi het van ban, dong mo van hien", r.ds && Array.from(r.ds).join(",") === "0,1", r.ds && Array.from(r.ds).join(","));
    /* cuon ti le */
    const kc0 = X.khungCuon(1000, 21, 600, 15000000);
    const kc1 = X.khungCuon(900000, 21, 600, 15000000);
    kiem("khungCuon · 1 000 hang: khong doi ti le; 900 000 hang (18,9 M px): ep ve 15 M, ti le > 1", kc0.tiLe === 1 && kc0.caoPx === 21000 && kc1.caoPx === 15000000 && kc1.tiLe > 1.26 && kc1.tiLe < 1.27, JSON.stringify(kc1));
    let saiCuon = "";
    for (const n of [50, 800, 700000, 900000, 5000000]) {
      const kc = X.khungCuon(n, 21, 600, 15000000), maxSt = kc.caoPx - 600;
      const dau = X.hangTuCuon(0, kc.tiLe, 21), cuoi = X.hangTuCuon(Math.max(0, maxSt), kc.tiLe, 21);
      const hCuoiThay = cuoi.h + Math.ceil(600 / 21);
      if (dau.h !== 0 || dau.lech !== 0) saiCuon = "n=" + n + " hang dau != 0";
      if (n * 21 > 600 && (hCuoiThay < n - 1 || cuoi.h > n)) saiCuon = "n=" + n + " cuon toi cuoi chua thay hang cuoi: h=" + cuoi.h + " + " + Math.ceil(600 / 21) + " < " + (n - 1);
      let truoc = -1;
      for (let st = 0; st <= maxSt; st += Math.max(1, Math.floor(maxSt / 300))) {
        const h = X.hangTuCuon(st, kc.tiLe, 21).h;
        if (h < truoc) saiCuon = "n=" + n + " khong don dieu";
        truoc = h;
      }
      for (const h of [0, 1, Math.floor(n / 3), Math.floor(n / 2), Math.max(0, n - 40)]) {
        const st = X.cuonTuHang(h, kc.tiLe, 21, 600, false), h2 = X.hangTuCuon(st, kc.tiLe, 21).h;
        if (Math.abs(h2 - h) > Math.ceil(kc.tiLe / 21) + 1) saiCuon = "n=" + n + " cuonTuHang(" + h + ") → hang " + h2;
      }
      if (saiCuon) break;
    }
    kiem("khungCuon / hangTuCuon / cuonTuHang · 50 .. 5 000 000 hang: dau = 0, cuon toi cuoi thay hang cuoi, don dieu, vong di-ve lech <= 1 hang", !saiCuon, saiCuon);
    const cd = X.catDong("a".repeat(10) + "😀".repeat(5), 11), cd2 = X.catDong("abc", 10);
    kiem("catDong · khong cat doi cap surrogate; ngan thi giu nguyen", cd.chu === "a".repeat(10) && cd.bo === 10 && cd2.chu === "abc" && cd2.bo === 0, JSON.stringify(cd));
  }

  /* ====================== vao Xem tu dong + luu nhap (DOM gia) ====================== */
  {
    const nhap = MT.dom("#nhap");
    const HS = A.hangSo;
    const truocXem = HS.NGUONG_XEM, truocLon = HS.NGUONG_NHAP_LON, truocGhep = HS.NGUONG_GHEP;
    HS.NGUONG_XEM = 400; HS.NGUONG_NHAP_LON = 600; HS.NGUONG_GHEP = 200;
    const kho = {};
    MT.ctx.localStorage = { getItem: (k) => (k in kho ? kho[k] : null), setItem(k, v) { kho[k] = String(v); }, removeItem(k) { delete kho[k]; } };
    const nho = JSON.stringify(Array.from({ length: 5 }, (_, i) => ({ i })));
    A.datVanBan(nho, { nhan: "Nho" });
    MT.chayHen();
    kiem("tai lieu nho: o Sua, localStorage giu ban nhap, khong co co 'qua lon'", A.cheDoSoan() === "sua" && kho["json-editor:nhap"] === nho && !("json-editor:nhap-qua-lon" in kho));
    const vua = JSON.stringify(Array.from({ length: 60 }, (_, i) => ({ id: i, ten: "người " + i })), null, 2);
    A.datVanBan(vua, { nhan: "Vua" });
    MT.chayHen();
    kiem("tai lieu vua (> NGUONG_XEM): tu vao Xem; van ban nam NGOAI textarea (textarea trong, gan .value 12 MB mat ~1,2 s), layVanBan dung, hop le",
      A.cheDoSoan() === "xem" && A.layVanBan() === vua && nhap.value === "" && A.hopLe() === true, A.cheDoSoan() + " " + vua.length + " " + nhap.value.length);
    kiem("Xem tu dong: hang ve ra (the .xh co so dong), chu thich co so khoi sau khi quet",
      MT.dom("#xem-cua").innerHTML.indexOf('class="xh') >= 0 && MT.dom("#xem-cua").innerHTML.indexOf('class="xs">1<') >= 0 && MT.dom("#xem-tien-do").textContent.indexOf("khối") >= 0, MT.dom("#xem-tien-do").textContent);
    kiem("tai lieu > NGUONG_NHAP_LON: localStorage BI XOA ban cu (khong cho song lai), khong tran luu im lang",
      !("json-editor:nhap" in kho));
    /* moi lan hoan tac ve ban nho: tro lai o Sua */
    A.hoanTac();
    MT.chayHen();
    kiem("hoan tac ve ban nho: Xem do tu chuyen tu tra ve o Sua, van ban ve textarea; ban nhap lai vao localStorage", A.cheDoSoan() === "sua" && kho["json-editor:nhap"] === nho && nhap.value === nho, A.cheDoSoan());
    /* khong co IndexedDB: nhap lon ghi that bai → xoa ban cu, co 'qua lon', bang bao hien */
    A.lamLai();
    MT.chayHen(); MT.chayHen();
    return Promise.resolve().then(() => Promise.resolve()).then(() => new Promise((xong) => setImmediate(xong))).then(() => {
      const bao = MT.dom("#bang-nhap");
      kiem("khong luu duoc nhap lon (khong IndexedDB): co 'nhap-qua-lon' ghi lai, ban cu bi xoa, bang bao hien va co nut Tai ve, noi dung bao co 'khong tu luu duoc'",
        "json-editor:nhap-qua-lon" in kho && !("json-editor:nhap" in kho) && bao.hidden === false && MT.dom("#bang-nhap-tai").hidden === false &&
        MT.dom("#bang-nhap-chu").textContent.indexOf("không tự lưu được") >= 0, JSON.stringify(Object.keys(kho)) + " " + bao.hidden + MT.dom("#bang-nhap-chu").textContent);
      /* ghep tai cho khi sua mot o tai lieu lon: ban nhap khong doi o cho khac */
      HS.NGUONG_XEM = truocXem; HS.NGUONG_NHAP_LON = truocLon;
      A.datVanBan(JSON.stringify({ a: 1, b: { c: [1, 2, 3] }, d: "x" }, null, 4) + "\n", { nhan: "Co dinh dang 4" });
      const s0 = nhap.value;
      const goc = A.layDuLieu();
      A.apDungGoc(T.datTai(goc, ["b", "c", 1], 99), { loai: "thay", duong: ["b", "c", 1] }, ["b", "c", 1], "Sua o");
      kiem("apDungGoc · tai lieu > NGUONG_GHEP: ghep tai cho (giu thut 4, xuong dong cuoi, phan khac byte-cho-byte)",
        nhap.value === s0.replace("2,", "99,") && A.layDuLieu().b.c[1] === 99, JSON.stringify(nhap.value));
      HS.NGUONG_GHEP = truocGhep;
      A.hoanTac();
      kiem("apDungGoc · hoan tac tra ve van ban cu (mot buoc 'Sua o')", nhap.value === s0);
    });
  }
};
