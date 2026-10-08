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
/* Du de doan khoi dong chay qua (ke ca cay, lop to mau, nut hoan tac).
   window KHONG co requestAnimationFrame / matchMedia / ResizeObserver —
   co y, de kiem luon duong du phong khi trinh duyet thieu chung. */
function nutGia() {
  const thuocTinh = {};
  const n = {
    _text: "", className: "", checked: true, value: "", style: {},
    children: [], dataset: {}, hidden: false, disabled: false, tabIndex: -1,
    scrollTop: 0, scrollLeft: 0, clientWidth: 0, clientHeight: 0,
    appendChild(c) { n.children.push(c); return c; },
    insertBefore(c) { n.children.push(c); return c; },
    removeChild(c) { return c; },
    replaceChild(c) { return c; },
    insertAdjacentHTML() {},
    lastElementChild: null,
    querySelector: () => nutGia(),
    querySelectorAll: () => [],
    closest: () => null,
    contains: () => false,
    setAttribute(k, v) { thuocTinh[k] = String(v); },
    getAttribute: (k) => (k in thuocTinh ? thuocTinh[k] : null),
    removeAttribute(k) { delete thuocTinh[k]; },
    hasAttribute: (k) => k in thuocTinh,
    getBoundingClientRect: () => ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 }),
    focus() {}, blur() {}, click() {},
    addEventListener() {}, removeEventListener() {}, onclick: null, onchange: null,
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
    createDocumentFragment: () => nutGia(),
    createRange: () => ({ setStartBefore() {}, setEndAfter() {}, deleteContents() {} }),
    documentElement: { getAttribute: () => null, setAttribute() {} },
    activeElement: null,
    hasFocus: () => false,
    execCommand: () => false,
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

/* Tien ich cho cac muc duoi */
const boMa = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const boThe = (html) => boMa(html.replace(/<[^>]*>/g, ""));
function tachToken(html) {
  const ra = [];
  const re = /<span class="([^"]+)">([^<]*)<\/span>/g;
  let m;
  while ((m = re.exec(html))) ra.push([m[1], boMa(m[2])]);
  return ra;
}
const theoLop = (html, lop) => tachToken(html).filter((t) => t[0] === lop).map((t) => t[1]);
const nemLoi = (f) => { try { f(); return false; } catch (e) { return true; } };
/* Dong bang sau: ham sua nao lo tay ghi vao mo hinh cu se NEM LOI (tep
   chay "use strict"), nen cac phep thu ben duoi kiem luon tinh bat bien. */
const dongBang = (v) => {
  if (v && typeof v === "object") { Object.keys(v).forEach((k) => dongBang(v[k])); Object.freeze(v); }
  return v;
};

/* ====================== 8. toMau (to mau cu phap) ====================== */
{
  /* Bat bien quan trong nhat: lop mau nam DUOI textarea, nen moi ky tu
     phai xuat hien DUNG MOT LAN, dung thu tu — thieu hay thua mot ky tu
     la lech het phan sau. */
  const MAU = [
    "", " ", "\n\n", '{"a": 1}',
    JSON.stringify({ ten: "Phúc", so: [1, 2.5e-3, -7], co: true, khong: null,
                     long: { a: { b: 'x"y\\z' } } }, null, 2),
    '{"a": tru', '{"a": "chua dong', '"\\', '"abc\\', "}}}]]],,::",
    "<script>alert('x')</script>", "&amp; &lt; <b>", '{"k"\n  : 1}',
    '😀 {"🔑": "😀"}', '\t{"a":[1,2,{"b":null}]}\t\n', "NaN Infinity undefined -",
    "1.2.3e+-5", "{'a': 1}", '\r\n{\r\n"a": 1\r\n}'
  ];
  const sai = [];
  MAU.forEach((s) => {
    let h;
    try { h = T.toMau(s); } catch (e) { sai.push("nem loi: " + JSON.stringify(s)); return; }
    if (boThe(h) !== s) sai.push(JSON.stringify(s));
  });
  kiem("toMau · moi ky tu xuat hien dung mot lan (bo the + giai ma = dau vao)",
    !sai.length, sai.length ? sai.join(" | ") : MAU.length + " mau");

  /* Go do / dan nham: chuoi ngau nhien tu bang ky tu "kho" (ca nua cap
     surrogate le). Hat co dinh nen lan nao chay cung ra cung bo. */
  const BANG = '{}[]:,"\\ \n\t\rabtrufelsn0123456789.-+eE<>&\'/xyz é😀';
  let hat = 12345;
  const ngauNhien = () => (hat = (hat * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  let fuzzSai = 0, mauSai = "";
  for (let i = 0; i < 400; i++) {
    let s = "";
    const dai = Math.floor(ngauNhien() * 60);
    for (let j = 0; j < dai; j++) s += BANG[Math.floor(ngauNhien() * BANG.length)];
    const loi = Math.floor(ngauNhien() * (s.length + 2)) - 1;
    try {
      if (boThe(T.toMau(s)) !== s) { fuzzSai++; mauSai = JSON.stringify(s); }
      if (boThe(T.toMau(s, loi)) !== s) { fuzzSai++; mauSai = "loiTai=" + loi + " " + JSON.stringify(s); }
    } catch (e) { fuzzSai++; mauSai = "nem loi " + JSON.stringify(s); }
  }
  kiem("toMau · 400 chuoi ngau nhien: khong nem loi, khong mat / them ky tu",
    fuzzSai === 0, mauSai);

  const h = T.toMau('{"a": "b", "c": {"d": "e\\"f"}, "g": ["h", 1, -2.5e3, true, false, null]}');
  kiem("toMau · khoa (ca khoa long nhau) to la khoa",
    bang(theoLop(h, "m-k"), ['"a"', '"c"', '"d"', '"g"']), JSON.stringify(theoLop(h, "m-k")));
  kiem("toMau · chuoi gia tri (ca chuoi co dau nhay thoat) to la chuoi",
    bang(theoLop(h, "m-s"), ['"b"', '"e\\"f"', '"h"']), JSON.stringify(theoLop(h, "m-s")));
  kiem("toMau · so, true/false, null, dau cau dung lop",
    bang(theoLop(h, "m-n"), ["1", "-2.5e3"]) && bang(theoLop(h, "m-b"), ["true", "false"]) &&
    bang(theoLop(h, "m-z"), ["null"]) && theoLop(h, "m-p").join("") === "{:,:{:},:[,,,,,]}");

  const h2 = T.toMau('{"a\\\\": "b"}');
  kiem("toMau · \\\\ ngay truoc dau nhay: chuoi dong dung cho, van la khoa",
    bang(theoLop(h2, "m-k"), ['"a\\\\"']) && bang(theoLop(h2, "m-s"), ['"b"']), JSON.stringify(tachToken(h2)));
  kiem("toMau · dau hai cham o dong sau van nhan ra khoa",
    bang(theoLop(T.toMau('{"k"\n  : 1}'), "m-k"), ['"k"']));
  kiem("haiChamSau · bo qua dong trang, chi xet ky tu that dau tien phia sau",
    bang(T.haiChamSau(['"k"', "", "   ", "  : 1", '"v"']), [true, true, true, false, false]));
  kiem("toMauDong · to tung dong ghep lai = to ca van ban (cung bat bien)",
    (function () {
      const s = JSON.stringify({ a: [1, { b: "x" }], c: null }, null, 2);
      const d = s.split("\n"), co = T.haiChamSau(d);
      return d.map((x, i) => T.toMauDong(x, co[i], -1)).join("\n") === T.toMau(s);
    })());
  const h3 = T.toMau('{"a": "xyz\n"b": 1}');
  kiem("toMau · chuoi chua dong dung o cuoi dong, khong nuot phan sau",
    bang(theoLop(h3, "m-k"), ['"a"', '"b"']) && bang(theoLop(h3, "m-s"), ['"xyz']), JSON.stringify(tachToken(h3)));
  const h4 = T.toMau('{"<b>": "&"} <i>');
  kiem("toMau · thoat HTML: khong bao gio de lot the cua nguoi dung",
    h4.indexOf("<b>") < 0 && h4.indexOf("<i>") < 0 && h4.indexOf("&lt;b&gt;") >= 0 && h4.indexOf("&amp;") >= 0);
  kiem("toMau · to dung ky tu loi, va to tron ca emoji (khong tach doi cap surrogate)",
    T.toMau('{"a":}', 5).indexOf('<span class="m-loi">}</span>') >= 0 &&
    T.toMau("x😀", 1).indexOf('<span class="m-loi">😀</span>') >= 0);
  kiem("toMau · null / undefined thanh chuoi rong, khong no",
    T.toMau(null) === "" && T.toMau(undefined) === "");
  kiem("chiSoTu · nguoc lai dongCot o moi vi tri", (function () {
    const s = "ab\ncd\n\nef";
    for (let i = 0; i <= s.length; i++) {
      const v = T.dongCot(s, i);
      if (T.chiSoTu(s, v.dong, v.cot) !== i) return false;
    }
    return true;
  })());
  kiem("viTriDanhDau · loi 'het dau vao' thi to ky tu that cuoi cung",
    T.viTriDanhDau("[1,2,\n  ", 8) === 4 && T.viTriDanhDau("[1, }", 3) === 4 && T.viTriDanhDau("  ", 1) === -1);
}

/* ====================== 9. doThut / vietTheoKieu ====================== */
{
  const x = { a: 1, b: [1, { c: "d" }], e: {} };
  kiem("doThut · 2 dau cach", T.doThut(JSON.stringify(x, null, 2)) === 2);
  kiem("doThut · 4 dau cach", T.doThut(JSON.stringify(x, null, 4)) === 4);
  kiem("doThut · 3 dau cach (kieu la cung nhan ra)", T.doThut(JSON.stringify(x, null, 3)) === 3);
  kiem("doThut · tab", T.doThut(JSON.stringify(x, null, "\t")) === "\t");
  kiem("doThut · nen tren mot dong -> 0", T.doThut(JSON.stringify(x)) === 0 && T.doThut(' {"a": 1} \n') === 0);
  kiem("doThut · rong / co xuong dong ma khong thut -> mac dinh 2",
    T.doThut("") === 2 && T.doThut('{\n"a": 1\n}') === 2);

  /* Phep thu manh nhat: van ban DA dung kieu thi viet lai phai y nguyen. */
  const kieu = [JSON.stringify(x, null, 2), JSON.stringify(x, null, 4) + "\n",
                JSON.stringify(x, null, "\t"), JSON.stringify(x), JSON.stringify(x) + "\n"];
  const lech = kieu.filter((s) => T.vietTheoKieu(JSON.parse(s), s) !== s);
  kiem("vietTheoKieu · viet lai y nguyen kieu cu (2 / 4 / tab / nen, giu dau xuong dong cuoi)",
    lech.length === 0, lech.map((s) => JSON.stringify(s.slice(0, 16))).join(" | "));
  kiem("vietTheoKieu · gia tri moi theo kieu 4 dau cach cua van ban cu",
    T.vietTheoKieu({ z: [true] }, JSON.stringify(x, null, 4)) === JSON.stringify({ z: [true] }, null, 4));
}

/* ====================== 10. xemTruoc (nhanh dang gap) ====================== */
{
  const xt = T.xemTruoc;
  kiem("xemTruoc · uu tien khoa name du dung sau id", xt({ id: 7, name: "Phúc" }) === 'name: "Phúc"', xt({ id: 7, name: "Phúc" }));
  kiem("xemTruoc · khong phan biet hoa thuong (Title)", xt({ x: 1, Title: "Báo cáo" }) === 'Title: "Báo cáo"');
  kiem("xemTruoc · nhan tieu_de, tieuDe va khoa co dau (tên, Mã)",
    xt({ a: 1, tieu_de: "T" }) === 'tieu_de: "T"' && xt({ a: 1, tieuDe: "T" }) === 'tieuDe: "T"' &&
    xt({ a: 1, "tên": "P" }) === 'tên: "P"' && xt({ a: 1, "Mã": "M1" }) === 'Mã: "M1"');
  kiem("xemTruoc · thu tu uu tien: title truoc id va type", xt({ type: "t", id: 1, title: "x" }) === 'title: "x"');
  kiem("xemTruoc · bo qua khoa uu tien rong / null", xt({ name: null, ten: "", id: 5 }) === "id: 5", xt({ name: null, ten: "", id: 5 }));
  kiem("xemTruoc · khong co khoa uu tien: truong nguyen thuy dau tien",
    xt({ cfg: { a: 1 }, port: 8080, host: "x" }) === "port: 8080");
  kiem("xemTruoc · khong co truong nguyen thuy: vai ten khoa dau",
    xt({ a: {}, b: [], c: {} }) === "a, b, c" && xt({ a: {}, b: {}, c: {}, d: {}, e: {} }) === "a, b, c, d, …");
  kiem("xemTruoc · mang object: [0] + truong noi bat cua phan tu dau",
    xt([{ name: "A" }, { name: "B" }]) === '[0] name: "A" …' && xt([{ name: "A" }]) === '[0] name: "A"');
  kiem("xemTruoc · mang nguyen thuy: toi da 3 gia tri",
    xt([1, 2, 3, 4]) === "1, 2, 3 …" && xt(["a", true]) === '"a", true' && xt([[1, 2]]) === "[0] 1, 2");
  const dai = xt({ name: "x".repeat(200) });
  kiem("xemTruoc · cat con ~60 ky tu, ket thuc bang …", dai.length <= 60 && /…$/.test(dai), dai.length + " ky tu");
  kiem("xemTruoc · nhanh rong khong co xem truoc", xt({}) === "" && xt([]) === "");
  kiem("truongNoiBat · tra TEN khoa; null khi khong co truong nguyen thuy",
    T.truongNoiBat({ b: 1, email: "e@x" }) === "email" && T.truongNoiBat({ a: {} }) === null);
}

/* ====================== 11. Sua theo duong dan ====================== */
{
  const goc = dongBang({ a: 1, b: { c: [10, 20, 30], d: "x" }, e: { f: 1 } });

  let r = T.datTai(goc, ["b", "c", 1], 99);
  kiem("datTai · sua gia tri long nhau, ban goc (dong bang) khong doi",
    r.b.c[1] === 99 && goc.b.c[1] === 20 && bang(r.b.c, [10, 99, 30]));
  kiem("datTai · nhanh khong dung toi thi dung chung, khong sao sau", r.e === goc.e && r.b !== goc.b);
  kiem("datTai · duong dan [] thay ca goc", T.datTai(goc, [], 5) === 5);
  kiem("datTai · duong dan khong ton tai thi bao loi", nemLoi(() => T.datTai(goc, ["khong-co", "x"], 1)));
  kiem("layTai · doc theo duong dan, khong co thi undefined",
    T.layTai(goc, ["b", "c", 2]) === 30 && T.layTai(goc, ["b", "z"]) === undefined && T.layTai(goc, ["a", "x"]) === undefined);

  r = T.doiTenKhoa(dongBang({ a: 1, b: 2, c: 3 }), ["b"], "x");
  kiem("doiTenKhoa · doi ten va GIU vi tri khoa", bang(Object.keys(r), ["a", "x", "c"]) && r.x === 2);
  let msg = "";
  try { T.doiTenKhoa({ a: 1, b: 2 }, ["b"], "a"); } catch (e) { msg = e.message; }
  kiem("doiTenKhoa · trung khoa trong cung object thi tu choi kem loi nhan", /đã có/.test(msg) && msg.indexOf("“a”") >= 0, msg);
  kiem("doiTenKhoa · doi ten khoa long nhau", bang(T.doiTenKhoa({ p: { q: 1 } }, ["p", "q"], "r"), { p: { r: 1 } }));
  kiem("doiTenKhoa · phan tu mang / goc khong co ten de doi",
    nemLoi(() => T.doiTenKhoa({ m: [1] }, ["m", 0], "x")) && nemLoi(() => T.doiTenKhoa({}, [], "x")));
  kiem("doiTenKhoa · doi sang \"__proto__\" van la khoa that",
    JSON.stringify(T.doiTenKhoa({ a: 1 }, ["a"], "__proto__")) === '{"__proto__":1}');

  kiem("khoaMoiDuyNhat · khoa_moi, khoa_moi_2, khoa_moi_3…",
    T.khoaMoiDuyNhat({}) === "khoa_moi" && T.khoaMoiDuyNhat({ khoa_moi: 1 }) === "khoa_moi_2" &&
    T.khoaMoiDuyNhat({ khoa_moi: 1, khoa_moi_2: 1 }) === "khoa_moi_3");
  r = T.themVao(dongBang({ a: 1, khoa_moi: 2 }), [], "");
  kiem("themVao · object: tu dat khoa khong trung, tra duong dan toi nut moi",
    bang(Object.keys(r.goc), ["a", "khoa_moi", "khoa_moi_2"]) && bang(r.duong, ["khoa_moi_2"]) && r.goc.khoa_moi_2 === "");
  r = T.themVao(dongBang({ m: [1, 2] }), ["m"], 3);
  kiem("themVao · mang: them vao cuoi", bang(r.goc, { m: [1, 2, 3] }) && bang(r.duong, ["m", 2]));
  kiem("themVao · khoa chi dinh bi trung thi bao loi", nemLoi(() => T.themVao({ a: 1 }, [], 0, "a")));
  kiem("themVao · khong them duoc vao gia tri nguyen thuy", nemLoi(() => T.themVao({ a: 1 }, ["a"], 0)));
  kiem("themVao · khoa \"__proto__\" thanh khoa that, khong doi nguyen mau",
    JSON.stringify(T.themVao({}, [], 1, "__proto__").goc) === '{"__proto__":1}');
  kiem("giaTriRongTheo · phan tu moi cung kieu phan tu cuoi",
    T.giaTriRongTheo(5) === 0 && T.giaTriRongTheo("s") === "" && T.giaTriRongTheo(true) === false &&
    T.giaTriRongTheo(null) === null && bang(T.giaTriRongTheo({ a: 1 }), {}) && T.giaTriRongTheo(undefined) === "");

  r = T.xoaTai(dongBang({ a: 1, b: 2, c: 3 }), ["b"]);
  kiem("xoaTai · xoa khoa, cac khoa con lai giu thu tu", bang(Object.keys(r), ["a", "c"]));
  kiem("xoaTai · xoa phan tu mang, phan tu sau don len", bang(T.xoaTai(dongBang({ m: [1, 2, 3] }), ["m", 0]), { m: [2, 3] }));
  kiem("xoaTai · khong xoa duoc goc / duong dan sai",
    nemLoi(() => T.xoaTai({ a: 1 }, [])) && nemLoi(() => T.xoaTai({ a: 1 }, ["b"])));

  r = T.diChuyen(dongBang([1, 2, 3]), [0], 1);
  kiem("diChuyen · doi cho voi hang xom, tra duong dan moi", bang(r.goc, [2, 1, 3]) && bang(r.duong, [1]));
  kiem("diChuyen · o dau / cuoi mang hoac khong phai mang thi bao loi",
    nemLoi(() => T.diChuyen([1, 2], [0], -1)) && nemLoi(() => T.diChuyen([1, 2], [1], 1)) &&
    nemLoi(() => T.diChuyen({ a: 1 }, ["a"], 1)));
}

/* ====================== 12. doiKieu / docGiaTri ====================== */
{
  const dk = T.doiKieu, dg = T.docGiaTri;
  kiem("doiKieu · sang string",
    dk(5, "string") === "5" && dk(true, "string") === "true" && dk(null, "string") === "" &&
    dk({ a: 1 }, "string") === '{"a":1}');
  kiem("doiKieu · sang number",
    dk("42", "number") === 42 && dk(" -1.5 ", "number") === -1.5 && dk("abc", "number") === 0 &&
    dk(true, "number") === 1 && dk(null, "number") === 0);
  kiem("doiKieu · sang boolean",
    dk("true", "boolean") === true && dk("có", "boolean") === true && dk("0", "boolean") === false &&
    dk(0, "boolean") === false && dk([1], "boolean") === true && dk({}, "boolean") === false);
  kiem("doiKieu · sang null", dk("x", "null") === null && dk([1], "null") === null);
  kiem("doiKieu · mang <-> object", bang(dk([7, 8], "object"), { 0: 7, 1: 8 }) && bang(dk({ a: 1, b: 2 }, "array"), [1, 2]));
  kiem("doiKieu · chuoi chua JSON thi giai ra, con lai thanh nhanh rong",
    bang(dk('{"a":1}', "object"), { a: 1 }) && bang(dk("[1]", "array"), [1]) &&
    bang(dk("x", "object"), {}) && bang(dk(5, "array"), []));
  kiem("doiKieu · cung kieu thi tra lai CHINH no", (function () { const o = { a: 1 }; return dk(o, "object") === o && dk("s", "string") === "s"; })());

  kiem("docGiaTri · so hop le", dg("42", "number") === 42 && dg(" -1.5e3 ", "number") === -1500 && dg("+7", "number") === 7);
  const soSai = ["abc", "", "  ", "1e999", "-1e999", "NaN", "Infinity", "0x10", "1,5", "1 2"];
  kiem("docGiaTri · so sai / vo cuc / rong thi bao loi (so phai huu han)",
    soSai.every((s) => nemLoi(() => dg(s, "number"))), soSai.filter((s) => !nemLoi(() => dg(s, "number"))).join(","));
  kiem("docGiaTri · boolean chi nhan true / false",
    dg("TRUE", "boolean") === true && dg(" false ", "boolean") === false && nemLoi(() => dg("yes", "boolean")));
  kiem("docGiaTri · chuoi giu nguyen ca khoang trang", dg("  x  ", "string") === "  x  ");
  kiem("docGiaTri · null bo qua chu", dg("gi cung duoc", "null") === null);
  kiem("docGiaTri · object / mang doc bang JSON va kiem dung kieu",
    bang(dg('{"a": [1]}', "object"), { a: [1] }) && bang(dg("[1, 2]", "array"), [1, 2]) &&
    nemLoi(() => dg("[1]", "object")) && nemLoi(() => dg("{", "array")));
}

/* ====================== 13. anhXaDuong (trang thai gap/mo) ====================== */
{
  const ax = T.anhXaDuong;
  kiem("anhXaDuong · doi ten: ca nhanh con di theo ten moi, khoa gan giong khong bi dung",
    bang(ax(["a", "b", "c"], { loai: "doi-ten", duong: ["a", "b"], moi: "x" }), ["a", "x", "c"]) &&
    bang(ax(["a", "bb"], { loai: "doi-ten", duong: ["a", "b"], moi: "x" }), ["a", "bb"]));
  kiem("anhXaDuong · xoa phan tu mang: nut bi xoa mat, nut sau lui mot chi so",
    ax(["m", 1, "k"], { loai: "xoa", duong: ["m", 1] }) === null &&
    bang(ax(["m", 3, "k"], { loai: "xoa", duong: ["m", 1] }), ["m", 2, "k"]) &&
    bang(ax(["m", 0], { loai: "xoa", duong: ["m", 1] }), ["m", 0]));
  kiem("anhXaDuong · xoa khoa object khong dich nut nao khac",
    bang(ax(["a", "z"], { loai: "xoa", duong: ["a", "k"] }), ["a", "z"]) &&
    ax(["a", "k", 0], { loai: "xoa", duong: ["a", "k"] }) === null);
  kiem("anhXaDuong · doi cho: hai nhanh doi duong dan cho nhau",
    bang(ax(["m", 0, "x"], { loai: "chuyen", duong: ["m", 0], moi: 1 }), ["m", 1, "x"]) &&
    bang(ax(["m", 1], { loai: "chuyen", duong: ["m", 0], moi: 1 }), ["m", 0]) &&
    bang(ax(["m", 2], { loai: "chuyen", duong: ["m", 0], moi: 1 }), ["m", 2]));
  kiem("anhXaDuong · thay gia tri: bo trang thai cua con chau, giu chinh no",
    ax(["a", "b"], { loai: "thay", duong: ["a"] }) === null && bang(ax(["a"], { loai: "thay", duong: ["a"] }), ["a"]) &&
    ax(["a"], { loai: "thay", duong: [] }) === null && bang(ax([], { loai: "thay", duong: [] }), []));
}

/* ---------------------------------------------------------------- */
console.log("-".repeat(58));
if (hong) {
  console.log(hong + " muc SAI.\n");
  process.exit(1);
}
console.log("Dat — moi ham thuan cua json-editor hoat dong dung.\n");
