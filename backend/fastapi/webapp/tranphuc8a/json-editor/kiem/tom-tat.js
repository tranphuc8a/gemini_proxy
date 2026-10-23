/* kiem/tom-tat.js — tom tat nhanh gap (assets/tom-tat.js): do dai byte KHOP
   Buffer.byteLength(JSON.stringify(v)), dem lap chiu 20 000 cap, ngan sach +
   cache, dinh dang so / byte, tomTatNut, tooltip va ten truy cap. */
"use strict";
const path = require("path");
const vm = require("vm");
const { execFileSync } = require("child_process");

module.exports = function (C) {
  const kiem = C.kiem, bang = C.bang, longSau = C.longSau;
  const MT = C.taoMoiTruong();
  const TT = MT.JE && MT.JE.tomTat;
  if (!kiem("tom-tat · nap xong, co JE.tomTat va JE_THU re-export", !!TT && typeof MT.T.tomTatNut === "function" &&
    MT.T.xemTruoc === TT.xemTruoc && MT.T.truongNoiBat === TT.truongNoiBat && MT.T.doDaiByte === TT.doDaiByte)) return;

  /* --- thu tu nap: je-chung → tom-tat → json-editor --- */
  const ds = C.dsScript();
  kiem("index.html · tom-tat.js nap SAU je-chung.js, TRUOC json-editor.js",
    ds.indexOf("assets/je-chung.js") < ds.indexOf("assets/tom-tat.js") && ds.indexOf("assets/tom-tat.js") < ds.indexOf("assets/json-editor.js"), ds.join(", "));

  const byteThat = (v) => Buffer.byteLength(JSON.stringify(v), "utf8");

  /* ---------------- byteChuoi: MOI don vi ma 0..0xFFFF va cap thay the ---------------- */
  {
    let sai = null;
    for (let c = 0; c <= 0xffff && sai === null; c++) {
      const s = String.fromCharCode(c);
      if (TT.byteChuoi(s) !== byteThat(s)) sai = "U+" + c.toString(16) + " " + TT.byteChuoi(s) + " vs " + byteThat(s);
    }
    kiem("byteChuoi · khop Buffer.byteLength(JSON.stringify) o MOI don vi ma 0x0000–0xFFFF (ke ca thay the le)", sai === null, sai);
    const cap = ["😀", "a😀b", "\ud83d", "\ud83dx", "x\ude00", "\ud83d😀", "\ude00\ud83d", "𝔘𝔫𝔦"];
    kiem("byteChuoi · cap thay the dung, thay the le thanh \\udXXX 6 byte, o dau / giua / cuoi chuoi",
      cap.every((s) => TT.byteChuoi(s) === byteThat(s)), cap.filter((s) => TT.byteChuoi(s) !== byteThat(s)).map((s) => JSON.stringify(s)).join(" "));
    const dai = ["abc ".repeat(50), 'abc"def '.repeat(20), "a\\b".repeat(30), "é".repeat(40) + "z".repeat(30), "ab\ncd".repeat(10),
      "x".repeat(25), "x".repeat(24), "x".repeat(23) + '"', "ABC~ !#[]".repeat(10), "\u007f".repeat(30)];
    kiem("byteChuoi · duong nhanh (ASCII in duoc > 24 ky tu) va duong cham cho cung ket qua that",
      dai.every((s) => TT.byteChuoi(s) === byteThat(s)), dai.filter((s) => TT.byteChuoi(s) !== byteThat(s)).map((s) => s.length).join(","));
  }

  /* ---------------- doDaiByte: 200 gia tri ngau nhien (qua JSON.parse nhu app) ---------------- */
  const rnd = C.taoNgauNhien(20261023);
  const chon = (a) => a[Math.floor(rnd() * a.length)];
  const MANH = ["a", "Z", "0", " ", "é", "ñ", "日本", "😀", "\u0000", "\u001f", "\n", "\t", "\r", "\b", "\f", '"', "\\", "/",
    "\u007f", " ", " ", "\ud800", "\udc00", "﻿", "ࠀ", "߿", "x".repeat(40), "Việt Nam", "<img src=x>"];
  const chuoiNgau = () => { let s = ""; for (let i = Math.floor(rnd() * 6); i > 0; i--) s += chon(MANH); return s; };
  const SO = [0, -0, 1, -1, 42, 3.14, -2.5e-7, 1e21, 1e-7, 123456789012345680000, 0.1 + 0.2, 5e-324, 1.7976931348623157e308];
  function giaTriNgau(sau) {
    const r = rnd();
    if (sau <= 0 || r < 0.45) {
      const k = rnd();
      return k < 0.35 ? chuoiNgau() : k < 0.7 ? chon(SO) : k < 0.8 ? true : k < 0.9 ? false : null;
    }
    if (r < 0.72) { const m = []; for (let i = Math.floor(rnd() * 5); i > 0; i--) m.push(giaTriNgau(sau - 1)); return m; }
    const o = {};
    for (let i = Math.floor(rnd() * 5); i > 0; i--) o[chuoiNgau()] = giaTriNgau(sau - 1);
    return o;
  }
  {
    let sai = null, soNhanh = 0, khopDem = true, sauDem = null;
    for (let i = 0; i < 200 && sai === null; i++) {
      const goc = JSON.parse(JSON.stringify(giaTriNgau(4)));      /* nhu app: gia tri den tu JSON.parse */
      const got = TT.doDaiByte(goc), that = byteThat(goc);
      if (got !== that) sai = "ca " + i + ": " + got + " vs " + that + "  " + JSON.stringify(goc).slice(0, 80);
      const d = MT.T.dem(goc), r = TT.thongKeNhanh(goc);
      if (d.nut !== r.nut || d.sau !== r.sau) { khopDem = false; sauDem = "ca " + i; }
      if (goc !== null && typeof goc === "object") soNhanh++;
    }
    kiem("doDaiByte · === Buffer.byteLength(JSON.stringify(v)) tren 200 gia tri ngau nhien (emoji, ky tu dieu khien, U+2028, thay the le, khoa dac biet)",
      sai === null, sai);
    kiem("thongKeNhanh · so nut va do sau KHOP JE_THU.dem tren cung 200 gia tri", khopDem, sauDem);
    kiem("doDaiByte · bo ngau nhien co du nhanh (khong toan nguyen thuy)", soNhanh > 100, soNhanh + "/200");
  }
  kiem("doDaiByte · nguyen thuy va rong: null 4, true 4, false 5, [] 2, {} 2, \"\" 2, so 1e999 (Infinity) -> null 4",
    TT.doDaiByte(null) === 4 && TT.doDaiByte(true) === 4 && TT.doDaiByte(false) === 5 && TT.doDaiByte([]) === 2 &&
    TT.doDaiByte({}) === 2 && TT.doDaiByte("") === 2 && TT.doDaiByte(JSON.parse("[1e999,-1e999]")) === byteThat(JSON.parse("[1e999,-1e999]")) &&
    TT.doDaiByte(JSON.parse("1e999")) === 4);
  {
    const q = JSON.parse('{"__proto__":{"a":[1,2]},"constructor":1}');
    kiem("doDaiByte · khoa __proto__ / constructor la khoa thuong", TT.doDaiByte(q) === byteThat(q), TT.doDaiByte(q) + " vs " + byteThat(q));
    const v = { a: { b: [1, 2, { c: "é" }] } };
    kiem("doDaiByte · khong dem dau cach / thut (nen)", TT.doDaiByte(v) === Buffer.byteLength('{"a":{"b":[1,2,{"c":"é"}]}}'));
  }

  /* ---------------- long rat sau: lap, khong tran ngan xep ---------------- */
  {
    const n = 20000, mang = longSau(n), obj = longSau(n, "object");
    let loi = null, rm = null, ro = null;
    try { rm = TT.thongKeNhanh(mang); ro = TT.thongKeNhanh(obj); } catch (e) { loi = e.message; }
    kiem("thongKeNhanh · mang long 20 000 cap: khong nem loi, byte / nut / sau dung",
      !loi && rm.byte === 2 * n + 1 && rm.nut === n + 1 && rm.sau === n, loi || JSON.stringify(rm));
    kiem("thongKeNhanh · object long 20 000 cap: byte (6n + 1) / nut / sau dung",
      !loi && ro && ro.byte === 6 * n + 1 && ro.nut === n + 1 && ro.sau === n, loi || JSON.stringify(ro));
    let ngoai = null;
    try { ngoai = TT.tomTatNut(mang, { byte: true }); } catch (e) { loi = e.message; }
    kiem("tomTatNut · mang long 20 000 cap: khong nem loi, xemTruoc <= 60 ky tu", !loi && ngoai.xemTruoc.length <= 60 && ngoai.sau === n, loi || "");
    kiem("doDaiByte · bang JSON.stringify khi long 2 000 cap (so voi that)", TT.doDaiByte(longSau(2000)) === byteThat(longSau(2000)) &&
      TT.doDaiByte(longSau(2000, "object")) === byteThat(longSau(2000, "object")));
  }

  /* ---------------- ngan sach + cache ---------------- */
  {
    const to = []; for (let i = 0; i < 5000; i++) to.push({ i: i, ten: "x" + i });
    const cuaTo = { to: to };
    const ngan = { con: 100 };
    kiem("thongKeNhanh · het ngan sach -> null (khong ket qua rieng le)", TT.thongKeNhanh(to, ngan) === null && ngan.con < 0);
    const day = TT.thongKeNhanh(to);
    kiem("thongKeNhanh · ket qua do dang KHONG bi luu cache: lan sau day du va dung",
      day && day.byte === byteThat(to) && day.nut === 1 + 5000 * 3);
    kiem("thongKeNhanh · day du thi luu cache (cung doi tuong tra ve) va khong ton ngan sach",
      TT.thongKeNhanh(to) === day && TT.thongKeNhanh(to, { con: 0 }) === day);
    const moi = { con: 100000 };
    const r = TT.thongKeNhanh(cuaTo, moi);
    kiem("thongKeNhanh · ngan sach tru theo so nut da duyet (nut + chuoi dai)", !!r && moi.con === 100000 - r.nut, moi.con + " / " + (r && r.nut));
    const to2 = to.map((x) => ({ i: x.i, ten: x.ten }));           /* ban sao: chua co trong cache */
    const t1 = TT.tomTatNut(to2, { byte: true, ngan: { con: 10 } });
    kiem("tomTatNut · het ngan sach: byte / nut / sau = null, daTinh false, phan khong can duyet van co",
      t1.byte === null && t1.nut === null && t1.sau === null && t1.daTinh === false && t1.so === 5000 &&
      t1.kieuCon === "≈ object×5.000" && t1.xemTruoc === MT.T.xemTruoc(to2), JSON.stringify(t1).slice(0, 160));
  }

  /* ---------------- dinhDangByte / soCoDau ---------------- */
  kiem("dinhDangByte · 0 B, 740 B, 1023 B", TT.dinhDangByte(0) === "0 B" && TT.dinhDangByte(740) === "740 B" && TT.dinhDangByte(1023) === "1023 B");
  kiem("dinhDangByte · KB mot so le, dau phay: 1024 → 1,0 KB; 3482 → 3,4 KB; 1.2 MB-ish 1258291 → 1,20 MB",
    TT.dinhDangByte(1024) === "1,0 KB" && TT.dinhDangByte(3482) === "3,4 KB" && TT.dinhDangByte(1258291) === "1,20 MB",
    [TT.dinhDangByte(1024), TT.dinhDangByte(3482), TT.dinhDangByte(1258291)].join(" | "));
  kiem("dinhDangByte · 7421747 → 7,08 MB; sat 1 MB (1048575) khong ra “1024,0 KB”",
    TT.dinhDangByte(7421747) === "7,08 MB" && TT.dinhDangByte(1048575) === "1,00 MB", TT.dinhDangByte(1048575));
  kiem("dinhDangByte · gia tri xau (NaN, am, undefined) -> chuoi rong",
    TT.dinhDangByte(NaN) === "" && TT.dinhDangByte(-5) === "" && TT.dinhDangByte(undefined) === "");
  kiem("soCoDau · 0, 999, 1000 → 1.000, 1234567 → 1.234.567 (khong phu thuoc locale)",
    TT.soCoDau(0) === "0" && TT.soCoDau(999) === "999" && TT.soCoDau(1000) === "1.000" && TT.soCoDau(1234567) === "1.234.567" && TT.soCoDau(12345) === "12.345");

  /* ---------------- tomTatNut ---------------- */
  {
    const o = { id: 7, name: "Phúc", email: "p@x.vn", tags: [1, 2], them: 1 };
    const t = TT.tomTatNut(o);
    kiem("tomTatNut · object: kieu, so khoa, 3 khoa dau, con khoa, noi bat",
      t.kieu === "object" && t.so === 5 && bang(t.khoaDau, ["id", "name", "email"]) && t.conKhoa === true && t.noiBat === 'name: "Phúc"', JSON.stringify(t));
    kiem("tomTatNut · dong hien: noi bat + vai khoa con lai (khong lap khoa noi bat)",
      t.dong === 'name: "Phúc" · id, email, tags, …', t.dong);
    kiem("tomTatNut · xemTruoc giu NGUYEN nhu ham cu (phep xemTruoc cu van dat)", t.xemTruoc === MT.T.xemTruoc(o) && t.xemTruoc === 'name: "Phúc"');
    kiem("tomTatNut · khong yeu cau byte thi KHONG duyet cay con: byte / nut / sau = null",
      t.byte === null && t.nut === null && t.sau === null && t.daTinh === false);
    const tb = TT.tomTatNut(o, { byte: true });
    kiem("tomTatNut · yeu cau byte: byte, nut, sau dung va daTinh", tb.byte === byteThat(o) && tb.nut === MT.T.dem(o).nut && tb.sau === MT.T.dem(o).sau && tb.daTinh, JSON.stringify(tb));
    kiem("tomTatNut · object 1 khoa: chi hien noi bat, khong co dau “·”", TT.tomTatNut({ name: "A" }).dong === 'name: "A"');
    kiem("tomTatNut · object khong co truong nguyen thuy: dong = ten khoa (nhu xemTruoc)",
      TT.tomTatNut({ a: {}, b: [], c: {} }).dong === "a, b, c" && TT.tomTatNut({ a: {} }).noiBat === "");
    kiem("tomTatNut · object rong / mang rong: dong rong, so 0", TT.tomTatNut({}).dong === "" && TT.tomTatNut([]).so === 0 && TT.tomTatNut([]).kieuCon === "");
    kiem("tomTatNut · chuoi 10 000 ky tu o truong noi bat bi cat, dong <= 90",
      TT.tomTatNut({ name: "x".repeat(10000), a: 1 }).dong.length <= 90 && TT.tomTatNut({ name: "x".repeat(10000), a: 1 }).dong.indexOf("…") > 0);

    const m = [{ a: 1 }, { a: 2 }, null, "s", [1], { b: 2 }];
    const tm = TT.tomTatNut(m);
    kiem("tomTatNut · mang: kieu, so phan tu, kieu phan tu giam dan (object×3, array×1, null×1, …)",
      tm.kieu === "array" && tm.so === 6 && tm.kieuCon === "object×3, array×1, null×1, …", tm.kieuCon);
    kiem("tomTatNut · mang lay mau: > 1 000 phan tu thi ghi “≈” va nhan theo ti le",
      TT.tomTatNut(new Array(2500).fill(1)).kieuCon === "≈ number×2.500" && TT.tomTatNut(new Array(1000).fill(1)).kieuCon === "number×1.000",
      TT.tomTatNut(new Array(2500).fill(1)).kieuCon);
    kiem("tomTatNut · mang object: dong = xem truoc “[0] …” cua phan tu dau", TT.tomTatNut([{ name: "A" }, { name: "B" }]).dong === '[0] name: "A" …');
    const tp = TT.tomTatNut("chuoi", { byte: true });
    kiem("tomTatNut · nguyen thuy: khong co nhanh nao de tom tat, byte van dung",
      tp.kieu === "string" && tp.so === 0 && tp.dong === "" && tp.byte === 7);
  }

  /* ---------------- moTaNut / moTaAria ---------------- */
  {
    const o = { id: 1, name: "A", email: "e", tags: ["x", "y"] };
    const t = TT.tomTatNut(o, { byte: true });
    const mong = "$.nguoi[3] · object · 4 khoá · " + TT.dinhDangByte(byteThat(o)) + " (" + TT.soCoDau(byteThat(o)) + " byte khi nén) · sâu 2 cấp · 7 nút · khoá: id, name, email, …";
    kiem("moTaNut · duong dan · kieu · so khoa · kich thuoc · sau · nut · khoa dau", TT.moTaNut(t, "$.nguoi[3]") === mong, TT.moTaNut(t, "$.nguoi[3]"));
    kiem("moTaAria · kich thuoc, sau, nut (khong lap lai so khoa / phan tu da co trong ten)",
      TT.moTaAria(t) === TT.dinhDangByte(byteThat(o)) + " khi nén, sâu 2 cấp, 7 nút", TT.moTaAria(t));
    const a = TT.tomTatNut([{ x: 1 }, { x: 2 }, null], { byte: true });
    const ma = TT.moTaNut(a, "$.mang");
    kiem("moTaNut · mang: “mảng”, so phan tu, kieu phan tu, dau",
      /^\$\.mang · mảng · 3 phần tử · .* · kiểu phần tử: object×2, null×1 · đầu: \[0\] x: 1 …$/.test(ma), ma);
    kiem("moTaNut · chua tinh kich thuoc thi bo qua kich thuoc / sau / nut", TT.moTaNut(TT.tomTatNut(o), "$") === "$ · object · 4 khoá · khoá: id, name, email, …" && TT.moTaAria(TT.tomTatNut(o)) === "");
    const doc = { '"><img src=x onerror=alert(1)>': 1, "b": 2 };
    kiem("moTaNut · khoa chua dau nhay / the HTML di nguyen trong chuoi (UI gan bang thuoc tinh DOM, khong noi vao HTML)",
      TT.moTaNut(TT.tomTatNut(doc), "$").indexOf('"><img src=x onerror=alert(1)>') > 0);
  }

  /* ---------------- Worker (JE_NGUON) va require() ---------------- */
  {
    const nguon = MT.ctx.JE_NGUON;
    const self = {};
    const ctxW = vm.createContext({ self, JSON, Object, Array, String, Math, Number, RegExp, Error, decodeURIComponent, isFinite });
    let loi = null;
    try { vm.runInContext(nguon.map((f) => "(" + f + ")(self);").join("\n"), ctxW); } catch (e) { loi = e.message; }
    kiem("tom-tat · chay lai tu MA NGUON (JE_NGUON) trong ngu canh trong gia lap Worker, khong DOM",
      !loi && self.JE && self.JE.tomTat && self.JE.tomTat.doDaiByte({ a: "é" }) === Buffer.byteLength('{"a":"é"}') &&
      self.JE.tomTat.tomTatNut({ name: "A", b: 1 }).dong === 'name: "A" · b', loi || "");
    const duongTT = path.join(C.GOC, "assets", "tom-tat.js").replace(/\\/g, "/");
    let kq = "";
    try {
      kq = execFileSync(process.execPath, ["-e", "const T=require(" + JSON.stringify(duongTT) + ");process.stdout.write(String(T.doDaiByte([1,\"é\"])) + ',' + T.dinhDangByte(3482));"],
        { encoding: "utf8" });
    } catch (e) { kq = "loi: " + String(e.message).split("\n")[0]; }
    kiem("tom-tat · require() trong node tu mot tien trinh moi (tu keo je-chung.js vao)", kq === "8,3,4 KB", kq);
  }
};
