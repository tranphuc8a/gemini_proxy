/* =====================================================================
   kiem.js — kiem cac ham THUAN cua json-editor bang node, khong can
   trinh duyet.

       node kiem.js

   Chi dung mot bo DOM toi thieu du de tep nap duoc, roi goi thang cac ham
   qua `window.JE_THU`. Khong chep lai logic — neu chep lai thi phep thu
   chi kiem ban chep, khong kiem san pham.
   ===================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

/* --- DOM toi thieu --- */
function nutGia() {
  const n = {
    _text: "", className: "", checked: true, value: "", style: {},
    children: [], dataset: {},
    appendChild(c) { n.children.push(c); return c; },
    querySelector: () => nutGia(),
    addEventListener() {}, onclick: null, onchange: null,
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    select() {}
  };
  Object.defineProperty(n, "innerHTML", { get: () => n._text, set(v) { n._text = v; } });
  Object.defineProperty(n, "textContent", { get: () => n._text, set(v) { n._text = v; } });
  return n;
}

const ctx = {
  window: {},
  document: {
    querySelector: () => nutGia(),
    querySelectorAll: () => [],
    createElement: () => nutGia(),
    documentElement: { getAttribute: () => null, setAttribute() {} },
    addEventListener() {}
  },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  navigator: {}, setTimeout, clearTimeout,
  Blob: function () {}, URL: { createObjectURL: () => "", revokeObjectURL() {} },
  FileReader: function () {},
  console, JSON, Math, Object, Array, String, Number, Boolean, RegExp, Error, Date
};
ctx.globalThis = ctx;
ctx.window.document = ctx.document;
ctx.window.localStorage = ctx.localStorage;
vm.createContext(ctx);
vm.runInContext(
  fs.readFileSync(path.join(__dirname, "assets", "json-editor.js"), "utf8"), ctx);

const T = ctx.window.JE_THU;
if (!T) { console.error("Khong phoi duoc JE_THU — tep khong nap duoc."); process.exit(1); }

/* ---------------------------------------------------------------- */
let hong = 0;
function kiem(ten, dat, chiTiet) {
  console.log("  " + (dat ? "[ok]  " : "[SAI] ") + ten + (chiTiet ? "   " + chiTiet : ""));
  if (!dat) hong++;
}
const bang = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log("\nKiem json-editor\n" + "-".repeat(58));

/* ====================== 1. dongCot ====================== */
{
  kiem("dongCot · ky tu dau la dong 1 cot 1",
    bang(T.dongCot("abc", 0), { dong: 1, cot: 1 }));
  kiem("dongCot · dem cot tu 1",
    bang(T.dongCot("abc", 2), { dong: 1, cot: 3 }));
  kiem("dongCot · xuong dong thi reset cot",
    bang(T.dongCot("ab\ncd", 3), { dong: 2, cot: 1 }));
  kiem("dongCot · nhieu dong",
    bang(T.dongCot("a\nb\nc\nd", 6), { dong: 4, cot: 1 }));
  kiem("dongCot · vi tri vuot qua do dai thi khong no",
    T.dongCot("ab", 999).dong === 1);

  /* Bat bien: tong so ky tu di qua = (cot-1) + so xuong dong da gap. */
  let dungHet = true;
  const mau = "mot\nhai\nba\n\nnam";
  for (let i = 0; i <= mau.length; i++) {
    const r = T.dongCot(mau, i);
    const truoc = mau.slice(0, i);
    const soXuong = (truoc.match(/\n/g) || []).length;
    const cotDung = i - (truoc.lastIndexOf("\n") + 1) + 1;
    if (r.dong !== soXuong + 1 || r.cot !== cotDung) dungHet = false;
  }
  kiem("dongCot · khop cach tinh doc lap o moi vi tri", dungHet);
}

/* ====================== 2. viTriLoi ====================== */
{
  /* Day la cho quan trong: thong bao cua JSON.parse khac nhau giua cac
     trinh duyet, nen phai bat duoc CA BA mau. */
  const s = '{\n  "a": 1,\n  "b": }\n}';
  const v8cu = T.viTriLoi({ message: "Unexpected token } in JSON at position 20" }, s);
  kiem("viTriLoi · doc duoc mau V8 cu (at position N)",
    v8cu && v8cu.dong === 3, v8cu ? "dong " + v8cu.dong : "null");

  const v8moi = T.viTriLoi(
    { message: "Expected double-quoted property name in JSON at position 20 (line 3 column 8)" }, s);
  kiem("viTriLoi · mau V8 moi cung ra dung dong",
    v8moi && v8moi.dong === 3, v8moi ? "dong " + v8moi.dong : "null");

  const sm = T.viTriLoi({ message: "JSON.parse: expected property name at line 3 column 8" }, s);
  kiem("viTriLoi · doc duoc mau SpiderMonkey (line N column M)",
    sm && sm.dong === 3 && sm.cot === 8, JSON.stringify(sm));

  kiem("viTriLoi · thong bao la thi tra null chu khong doan bua",
    T.viTriLoi({ message: "cai gi do khong ro" }, s) === null);

  /* Doi chieu voi loi THAT do V8 nem ra, tren mot bang cac JSON hong ma
     ta biet truoc loi nam o dong nao.

     Day la phep thu quan trong nhat cua tep: V8 co it nhat BON dang thong
     bao, va dang hay gap nhat lai KHONG kem vi tri nao ca — no nhung mot
     doan trich cua chinh nguon:

       Unexpected token '}', ..."1, <xuong dong> "b": }" is not valid JSON

     Ban dau toi chi xu ly hai dang co vi tri, nen tinh nang chinh cua
     trinh soan nay — chi dung dong loi — im lang khong chay tren Chrome
     o phan lon truong hop. Bang duoi day bat duoc dieu do. */
  const D = function () {
    return Array.prototype.slice.call(arguments).join("\n");
  };
  const CA_LOI = [
    [D("{", '  "a": 1,', '  "b": }', "}"), 3],
    [D('{"a":}'), 1],
    [D("[1,2,"), 1],
    [D('{"a" 1}'), 1],
    [D("abc"), 1],
    [D("{", '"a":1,', '"b":2,', '"c":,', '"d":4', "}"), 4],
    [D("[", "1,", "2,", "{bad},", "4", "]"), 4],
    [D("{", '  "x": [1,2,3],', '  "y": tru', "}"), 3],
    [D("{", '"a":1', '"b":2', "}"), 3],
    [D("[", '  {"a":1},', '  {"a":2,},', '  {"a":3}', "]"), 3],
    [D("{", '  "long": {', '    "sau": [1,2,', "  }", "}"), 4]
  ];
  let sai = [];
  CA_LOI.forEach(function (ca) {
    let r = null;
    try { JSON.parse(ca[0]); } catch (e) { r = T.viTriLoi(e, ca[0]); }
    if (!r || r.dong !== ca[1]) {
      sai.push(JSON.stringify(ca[0].slice(0, 20)) + " mong " + ca[1] +
               " duoc " + (r ? r.dong : "null"));
    }
  });
  kiem("viTriLoi \u00b7 chi dung dong loi tren ca " + CA_LOI.length + " JSON hong that",
    sai.length === 0, sai.length ? sai.join(" | ") : CA_LOI.length + "/" + CA_LOI.length);

  kiem("viTriLoi \u00b7 het dau vao giua chung thi tro ve cuoi tep",
    (function () {
      const x = D("{", '"a":1,');
      let r = null;
      try { JSON.parse(x); } catch (e) { r = T.viTriLoi(e, x); }
      return r && r.dong === 2;
    })());
}

/* ====================== 3. truyVan ====================== */
{
  const d = {
    ten: "goc",
    mang: [{ ten: "a", so: 1 }, { ten: "b", so: 2 }, { ten: "c", so: 3 }],
    long: { sau: { ten: "day", so: 9 } }
  };
  const gt = (q) => T.truyVan(d, q).map((n) => n.v);
  const duong = (q) => T.truyVan(d, q).map((n) => n.d);

  kiem("truyVan · $ tra ve chinh goc", T.truyVan(d, "$")[0].v === d);
  kiem("truyVan · rong cung tra ve goc", T.truyVan(d, "")[0].v === d);
  kiem("truyVan · $.ten", bang(gt("$.ten"), ["goc"]));
  kiem("truyVan · $.mang[1].ten", bang(gt("$.mang[1].ten"), ["b"]));
  kiem("truyVan · $.mang[*].so", bang(gt("$.mang[*].so"), [1, 2, 3]));
  kiem("truyVan · $.long.sau.so", bang(gt("$.long.sau.so"), [9]));

  /* Tim sau: phai gom CA khoa o moi cap — KE CA khoa `ten` ngay o goc.
     (Phep thu dau tien cua toi quen mat "goc" va bao SAI oan cho code.) */
  const sau = gt("$..ten").sort();
  kiem("truyVan · $..ten tim het moi cap, ke ca khoa o goc",
    bang(sau, ["a", "b", "c", "day", "goc"].sort()), JSON.stringify(sau));

  kiem("truyVan · duong dan tra ve dung dinh dang",
    bang(duong("$.mang[*].ten"), ["$.mang[0].ten", "$.mang[1].ten", "$.mang[2].ten"]));

  kiem("truyVan · khoa khong ton tai thi tra mang rong",
    T.truyVan(d, "$.khong-co").length === 0);
  kiem("truyVan · di xuyen qua gia tri nguyen thuy thi khong no",
    T.truyVan(d, "$.ten.them").length === 0);

  let nem = false;
  try { T.truyVan(d, "$.mang[0"); } catch (e) { nem = true; }
  kiem("truyVan · thieu dau ] thi bao loi chu khong im lang", nem);

  nem = false;
  try { T.truyVan(d, "$%bay"); } catch (e) { nem = true; }
  kiem("truyVan · ky tu la thi bao loi", nem);

  /* [*] tren object phai duyet gia tri, khong chi tren mang. */
  kiem("truyVan · [*] tren object duyet moi gia tri",
    bang(gt("$.long[*]").length, 1));
}

/* ====================== 4. khacNhau ====================== */
{
  const kn = (a, b) => T.khacNhau(a, b);

  kiem("khacNhau · hai vat giong het thi khong co khac biet",
    kn({ a: 1, b: [1, 2] }, { a: 1, b: [1, 2] }).length === 0);

  /* DAY LA DIEM CHINH: thu tu khoa trong object KHONG phai khac biet. */
  kiem("khacNhau · doi thu tu khoa KHONG tinh la khac",
    kn({ a: 1, b: 2 }, { b: 2, a: 1 }).length === 0);

  /* Nhung thu tu MANG thi co y nghia. */
  kiem("khacNhau · doi thu tu mang CO tinh la khac",
    kn([1, 2], [2, 1]).length === 2);

  let r = kn({ a: 1 }, { a: 1, b: 2 });
  kiem("khacNhau · khoa moi la 'them'",
    r.length === 1 && r[0].loai === "them" && r[0].d === "$.b", JSON.stringify(r));

  r = kn({ a: 1, b: 2 }, { a: 1 });
  kiem("khacNhau · khoa mat la 'bot'",
    r.length === 1 && r[0].loai === "bot" && r[0].d === "$.b");

  r = kn({ a: 1 }, { a: 2 });
  kiem("khacNhau · gia tri doi la 'doi'",
    r.length === 1 && r[0].loai === "doi" && r[0].a === 1 && r[0].b === 2);

  r = kn({ a: 1 }, { a: "1" });
  kiem("khacNhau · so 1 va chuoi \"1\" la KHAC nhau",
    r.length === 1 && r[0].loai === "doi");

  r = kn({ a: { b: { c: 1 } } }, { a: { b: { c: 2 } } });
  kiem("khacNhau · duong dan long nhau dung",
    r.length === 1 && r[0].d === "$.a.b.c", r[0] && r[0].d);

  r = kn([1, 2, 3], [1, 2]);
  kiem("khacNhau · mang ngan di thi phan tu cuoi la 'bot'",
    r.length === 1 && r[0].loai === "bot" && r[0].d === "$[2]");

  kiem("khacNhau · null va 0 la khac nhau", kn({ a: null }, { a: 0 }).length === 1);
  kiem("khacNhau · null va null la giong nhau", kn({ a: null }, { a: null }).length === 0);

  /* Bat bien: so mot vat voi CHINH NO luon ra rong, voi moi hinh dang. */
  const mau = [
    42, "chu", null, true, [], {}, [1, [2, [3, [4]]]],
    { a: [{ b: null }, { c: [1, 2, { d: "x" }] }] }
  ];
  let tuSoOK = true;
  mau.forEach((m) => { if (kn(m, JSON.parse(JSON.stringify(m))).length) tuSoOK = false; });
  kiem("khacNhau · moi vat so voi ban sao cua chinh no deu rong", tuSoOK);
}

/* ====================== 5. sapKhoa ====================== */
{
  const v = T.sapKhoa({ z: 1, a: { y: 2, b: 3 }, m: [3, 1, 2] });
  kiem("sapKhoa · khoa cap ngoai duoc sap",
    bang(Object.keys(v), ["a", "m", "z"]));
  kiem("sapKhoa · sap ca cap trong",
    bang(Object.keys(v.a), ["b", "y"]));
  /* Mang KHONG duoc sap — thu tu phan tu mang la du lieu. */
  kiem("sapKhoa · mang GIU NGUYEN thu tu", bang(v.m, [3, 1, 2]));
  kiem("sapKhoa · khong lam doi noi dung",
    T.khacNhau({ z: 1, a: 2 }, T.sapKhoa({ z: 1, a: 2 })).length === 0);
}

/* ====================== 6. dem ====================== */
{
  let d = T.dem({ a: 1, b: 2 });
  kiem("dem · object 2 khoa = 3 nut (1 object + 2 la)", d.nut === 3, "nut = " + d.nut);
  kiem("dem · dem dung so la", d.la === 2);
  kiem("dem · do sau cua object phang la 1", d.sau === 1, "sau = " + d.sau);

  d = T.dem(5);
  kiem("dem · gia tri don le la 1 nut, sau 0", d.nut === 1 && d.sau === 0 && d.la === 1);

  d = T.dem({ a: { b: { c: 1 } } });
  kiem("dem · long 3 cap thi sau = 3", d.sau === 3, "sau = " + d.sau);
  kiem("dem · dem dung so object", d.obj === 3, "obj = " + d.obj);

  d = T.dem([1, [2, [3]]]);
  kiem("dem · dem dung so mang", d.mang === 3, "mang = " + d.mang);
  kiem("dem · mang rong van la mot nut", T.dem([]).nut === 1);
}

/* ====================== 7. kieuCua / coChu ====================== */
{
  kiem("kieuCua · null khong bi goi la object", T.kieuCua(null) === "null");
  kiem("kieuCua · mang khong bi goi la object", T.kieuCua([]) === "array");
  kiem("kieuCua · object la object", T.kieuCua({}) === "object");
  kiem("kieuCua · so la number", T.kieuCua(1) === "number");
  kiem("kieuCua · chuoi la string", T.kieuCua("a") === "string");
  kiem("kieuCua · bool la boolean", T.kieuCua(false) === "boolean");

  kiem("coChu · duoi 1 KB thi tinh theo byte", T.coChu(512) === "512 B");
  kiem("coChu · 2048 B = 2.0 KB", T.coChu(2048) === "2.0 KB");
  kiem("coChu · vai MB doc duoc", /MB$/.test(T.coChu(5 * 1024 * 1024)));
}

/* ---------------------------------------------------------------- */
console.log("-".repeat(58));
if (hong) {
  console.log(hong + " muc SAI.\n");
  process.exit(1);
}
console.log("Dat — moi ham thuan cua json-editor hoat dong dung.\n");
