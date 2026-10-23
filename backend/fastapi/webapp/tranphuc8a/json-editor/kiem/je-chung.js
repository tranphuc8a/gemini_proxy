/* kiem/je-chung.js — tien ich dung chung (assets/je-chung.js): khong gian JE,
   so nguon JE_NGUON cho Worker, con tro JSON, so sanh sau, khoa chuan. */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

module.exports = function (C) {
  const kiem = C.kiem, bang = C.bang, nemLoi = C.nemLoi;
  const MT = C.taoMoiTruong();
  const J = MT.JE && MT.JE.chung;
  if (!kiem("je-chung · nap xong, co JE.chung", !!J)) return;

  /* --- thu tu nap --- */
  const ds = C.dsScript();
  kiem("index.html · je-chung.js nap TRUOC json-editor.js",
    ds.indexOf("assets/je-chung.js") === 0 && ds.indexOf("assets/json-editor.js") > 0, ds.join(", "));
  kiem("json-editor.js · phoi JE_THU va JE_APP sau khi nap", !!MT.T && !!MT.APP);

  /* --- module node truc tiep --- */
  const R = require(path.join(C.GOC, "assets", "je-chung.js"));
  kiem("je-chung · require() trong node tra ve cung bo ham",
    typeof R.khoaChuan === "function" && typeof R.conTroSangDuong === "function");

  /* --- JE_NGUON: Worker se ghep "(" + f + ")(self);" thanh Blob --- */
  const nguon = MT.ctx.JE_NGUON;
  kiem("JE_NGUON · moi module thuan dang ky ham khai cua no",
    Array.isArray(nguon) && nguon.length >= 1 && nguon.every((f) => typeof f === "function"));
  const self = {};
  const ctxW = vm.createContext({ self, JSON, Object, Array, String, Math, Number, RegExp, Error, decodeURIComponent });
  vm.runInContext(nguon.map((f) => "(" + f + ")(self);").join("\n"), ctxW);
  kiem("JE_NGUON · chay lai tu MA NGUON trong ngu canh moi (gia lap Worker) dung lai JE.chung",
    self.JE && self.JE.chung && self.JE.chung.khoaChuan({ b: 1, a: 2 }) === '{"a":2,"b":1}');

  /* --- coRieng / kieuCua / catNgan --- */
  kiem("coRieng · chi khoa rieng, khong tinh nguyen mau",
    J.coRieng({ a: 1 }, "a") && !J.coRieng({}, "toString") && !J.coRieng({}, "constructor") &&
    J.coRieng(JSON.parse('{"__proto__":1}'), "__proto__") && !J.coRieng({}, "__proto__") &&
    J.coRieng(Object.create(null, { k: { value: 1, enumerable: true } }), "k") &&
    !J.coRieng(null, "a") && !J.coRieng(undefined, "a"));
  kiem("kieuCua · 6 kieu JSON", J.kieuCua(null) === "null" && J.kieuCua([]) === "array" && J.kieuCua({}) === "object" &&
    J.kieuCua(1) === "number" && J.kieuCua("") === "string" && J.kieuCua(false) === "boolean");
  kiem("catNgan · ngan thi giu nguyen, dai thi n ky tu ket thuc …",
    J.catNgan("abc", 5) === "abc" && J.catNgan("abcdefgh", 5) === "abcd…" && J.catNgan("abcdefgh", 5).length === 5);
  const em = J.catNgan("ab😀cdef", 4);
  kiem("catNgan · khong cat doi cap surrogate (emoji)", em === "ab…", JSON.stringify(em));

  /* --- moTaDuong --- */
  kiem("moTaDuong · $ / .khoa / [chi so] / [\"khoa la\"]",
    J.moTaDuong([]) === "$" &&
    J.moTaDuong(["a", 0, "b c", "a.b", "$x", "_y", "-z", "k-1"]) === '$.a[0]["b c"]["a.b"].$x._y["-z"].k-1',
    J.moTaDuong(["a", 0, "b c", "a.b", "$x", "_y", "-z", "k-1"]));

  /* --- JSON Pointer --- */
  kiem("duongSangConTro · RFC 6901: ~ -> ~0, / -> ~1, goc = \"\"",
    J.duongSangConTro([]) === "" && J.duongSangConTro(["a/b", "m~n", 0, ""]) === "/a~1b/m~0n/0/");
  kiem("conTroSangDuong · giai ma ~1 truoc ~0 (\"~01\" la \"~1\", khong phai \"/\")",
    bang(J.conTroSangDuong("/a~1b/m~0n/~01"), ["a/b", "m~n", "~1"]));
  kiem("conTroSangDuong · \"\" = goc, \"/\" = khoa rong",
    bang(J.conTroSangDuong(""), []) && bang(J.conTroSangDuong("/"), [""]));
  const goc = { a: [{ b: 1 }, 2], "0": { "1": "x" } };
  kiem("conTroSangDuong · co goc: doan roi vao MANG thanh so, object giu chuoi",
    bang(J.conTroSangDuong("/a/0/b", goc), ["a", 0, "b"]) && bang(J.conTroSangDuong("/0/1", goc), ["0", "1"]) &&
    bang(J.conTroSangDuong("/a/01", goc), ["a", "01"]) && bang(J.conTroSangDuong("/a/-", goc), ["a", "-"]));
  kiem("conTroSangDuong · dang manh URI #/… co ma phan tram",
    bang(J.conTroSangDuong("#/a%20b/c%25d"), ["a b", "c%d"]) && bang(J.conTroSangDuong("#"), []));
  kiem("conTroSangDuong · sai dang thi nem loi (thieu /, ~ le, % sai)",
    nemLoi(() => J.conTroSangDuong("a/b")) && nemLoi(() => J.conTroSangDuong("/a~2")) &&
    nemLoi(() => J.conTroSangDuong("/a~")) && nemLoi(() => J.conTroSangDuong("#/%zz")));
  const NN = C.taoNgauNhien(7);
  const KT = ["a", "/", "~", "~1", "~0", "é", "😀", " ", "", "0", "__proto__"];
  let khuHoi = true, mau = "";
  for (let i = 0; i < 200; i++) {
    const d = [];
    const n = Math.floor(NN() * 5);
    for (let j = 0; j < n; j++) {
      let k = "";
      const m = Math.floor(NN() * 4);
      for (let t = 0; t < m; t++) k += KT[Math.floor(NN() * KT.length)];
      d.push(k);
    }
    if (!bang(J.conTroSangDuong(J.duongSangConTro(d)), d)) { khuHoi = false; mau = JSON.stringify(d); }
  }
  kiem("con tro · khu hoi duong -> con tro -> duong tren 200 duong ngau nhien", khuHoi, mau);

  /* --- bangNhauSau --- */
  const bn = J.bangNhauSau;
  kiem("bangNhauSau · khong ke thu tu khoa; ke thu tu mang",
    bn({ a: 1, b: [1, 2] }, { b: [1, 2], a: 1 }) && !bn([1, 2], [2, 1]));
  kiem("bangNhauSau · kieu khac la khac: 1/\"1\", null/{}, []/{}, 0/false",
    !bn(1, "1") && !bn(null, {}) && !bn([], {}) && !bn(0, false) && !bn({ a: undefined }, {}));
  kiem("bangNhauSau · 1 va 1.0 bang nhau; 0 va -0 bang nhau",
    bn(1, JSON.parse("1.0")) && bn(0, -0) && bn({ x: [0] }, { x: [-0] }));
  kiem("bangNhauSau · so khoa khac / khoa khac ten la khac",
    !bn({ a: 1 }, { a: 1, b: 2 }) && !bn({ a: 1 }, { b: 1 }));
  kiem("bangNhauSau · chi khoa rieng: {} khac {\"__proto__\":{}}",
    !bn({}, JSON.parse('{"__proto__":{}}')) && bn(JSON.parse('{"__proto__":[1]}'), JSON.parse('{"__proto__":[1]}')));
  const s1 = C.longSau(20000), s2 = C.longSau(20000);
  let s3 = 2;
  for (let i = 0; i < 20000; i++) s3 = [s3];
  kiem("bangNhauSau · lap: 20 000 cap khong tran ngan xep (bang va khac o tan day)",
    !nemLoi(() => bn(s1, s2)) && bn(s1, s2) && !bn(s1, s3));

  /* --- khoaChuan --- */
  const kc = J.khoaChuan;
  kiem("khoaChuan · khoa object sap theo bang chu cai, mang giu thu tu",
    kc({ b: 1, a: [1, { d: 2, c: 3 }] }) === '{"a":[1,{"c":3,"d":2}],"b":1}');
  kiem("khoaChuan · nguyen thuy, rong, chuoi co ky tu dac biet",
    kc(null) === "null" && kc(true) === "true" && kc(-0) === "0" && kc([]) === "[]" && kc({}) === "{}" &&
    kc("a\"b\\\n😀") === JSON.stringify("a\"b\\\n😀"));
  kiem("khoaChuan · khoa \"__proto__\" duoc giu", kc(JSON.parse('{"__proto__":1,"a":2}')) === '{"__proto__":1,"a":2}');
  kiem("khoaChuan · lap: 20 000 cap khong tran ngan xep",
    !nemLoi(() => kc(C.longSau(20000, "object"))) && kc(C.longSau(3)) === "[[[1]]]");
  /* Doi chieu: khoaChuan(v) === JSON.stringify(sapKhoa(v)) va bangNhauSau <=> cung khoaChuan */
  const NN2 = C.taoNgauNhien(99);
  const sinh = (sau) => {
    const r = NN2();
    if (sau > 3 || r < 0.35) {
      const p = NN2();
      return p < 0.25 ? Math.floor(NN2() * 5) : p < 0.5 ? ["a", "b", "é", ""][Math.floor(NN2() * 4)] : p < 0.75 ? NN2() < 0.5 : null;
    }
    if (r < 0.65) { const a = []; for (let i = 0, n = Math.floor(NN2() * 4); i < n; i++) a.push(sinh(sau + 1)); return a; }
    const o = {};
    for (let i = 0, n = Math.floor(NN2() * 4); i < n; i++) o[["x", "y", "z", "w"][Math.floor(NN2() * 4)]] = sinh(sau + 1);
    return o;
  };
  let lech = 0, lechMau = "";
  for (let i = 0; i < 300; i++) {
    const a = sinh(0), b = sinh(0);
    if (kc(a) !== JSON.stringify(MT.T.sapKhoa(a))) { lech++; lechMau = JSON.stringify(a); }
    if ((kc(a) === kc(b)) !== bn(a, b)) { lech++; lechMau = JSON.stringify([a, b]); }
    const tron = JSON.parse(JSON.stringify(a), function (k, v) {
      if (v && typeof v === "object" && !Array.isArray(v)) {
        const o = {};
        Object.keys(v).reverse().forEach((x) => { o[x] = v[x]; });
        return o;
      }
      return v;
    });
    if (!bn(a, tron) || kc(a) !== kc(tron)) { lech++; lechMau = "dao khoa " + JSON.stringify(a); }
  }
  kiem("khoaChuan/bangNhauSau · 300 cap ngau nhien: khop sapKhoa, khop nhau, dao thu tu khoa van bang",
    lech === 0, lechMau);

  /* Khong module nao dung eval / new Function (kiem tinh nhanh; check.py --tinh kiem ky hon) */
  const ma = fs.readFileSync(path.join(C.GOC, "assets", "je-chung.js"), "utf8");
  kiem("je-chung · khong eval / new Function", !/\beval\s*\(|new\s+Function\b/.test(ma));
};
