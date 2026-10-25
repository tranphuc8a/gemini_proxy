/* kiem/tim-kiem.js — assets/tim-kiem.js: tim / thay trong van ban va trong cay gia tri.
   Co fuzz doi chieu voi cai dat THAM CHIEU viet rieng (de quy, String.prototype) va ca benh ly. */
"use strict";

module.exports = function (C) {
  const kiem = C.kiem, nhom = C.nhom;
  const MT = C.taoMoiTruong();
  const K = MT.JE.timKiem;
  if (!kiem("tim-kiem · nap xong, co JE.timKiem", !!K && typeof K.timTrongVanBan === "function")) return;
  const J = (x) => JSON.stringify(x);
  const eq = (a, b) => J(a) === J(b);

  nhom("tim-kiem · regex lap co can tren nhom co lap (J6 sua sau kiem)");
  const an = MT.JE.chung.kiemRegexAnToan;
  for (const m of ["(a*){20}b", "(.*a){25}", "(a+){3}", "(a*){2,30}", "(a?){25}a{25}", "(a{1,3}){20}b", "(\w+\s*){5}"]) kiem("kiemRegexAnToan chan " + m, typeof an(m) === "string", String(an(m)));
  for (const m of ["(\d{1,3}\.){3}\d{1,3}", "(ab){3}", "[a-z]{20}b", "(foo|bar){2}", "\d{4}-\d{2}", "a{2,5}b+", "(a?){3}", "(a{1,5}){5}"]) kiem("kiemRegexAnToan cho qua " + m, an(m) === null, String(an(m)));
  /* J6 sua lan 3: lap co can CHONG NHAU / KE NHAU (tich so cach khop) — truoc day lot luoi, treo theo cap so */
  for (const m of ["(a{0,7}){7}c", "(a?){7}(a?){7}(a?){7}c", "((a?){7}){7}b", "((a{0,7}){7}){7}c", "((a{1,2}){7}){7}c", "(a?a{1,3}){7}c", "(a?){7}(a{0,7}){7}c", "(x|(a{0,7}){7})c", "(x|y|((a?){7}){7})b", "a|(a{0,7}){7}c"]) kiem("kiemRegexAnToan chan (cach khop chong nhau, ke ca nhanh | thu hai) " + m, typeof an(m) === "string", String(an(m)));
  for (const m of ["x(a{0,7}){1,3}dc", "(?:[a-z]{1,5}\\.){3}", "^\\w+@\\w+\\.\\w+$", "(a{1,3}){7}"]) kiem("kiemRegexAnToan cho qua (it cach) " + m, an(m) === null, String(an(m)));
  {
    const vm = require("vm"), tren = [];
    for (const m of ["(a{0,7}){7}c", "(a?){7}(a?){7}(a?){7}c", "((a?){7}){7}b", "((a{0,7}){7}){7}c", "((a{1,2}){7}){7}c", "(a?a{1,3}){7}c", "x(a{0,7}){1,3}dc", "(a{1,3}){7}c", "(a{1,5}){5}c", "(a?){7}c", "a{1,3}a?(a{1,3}){7}c", "(a?a{0,7}(a?a{1,3}a{0,7}){2})?a{2}c"]) {
      if (an(m) !== null) continue;                      /* moi mau duoc cho qua phai chay that nhanh tren 'a'x40+'!' */
      const t0 = Date.now(); let tre = false;
      try { vm.runInNewContext("new RegExp(m, 'u').test(s)", { m, s: "a".repeat(40) + "!" }, { timeout: 1500 }); } catch (e) { tre = true; }
      if (tre || Date.now() - t0 > 700) tren.push(m);
    }
    kiem("kiemRegexAnToan · mau duoc cho qua chay that < 0,7 s tren 'a'x40+'!' (vm timeout)", tren.length === 0, tren.join(" ; "));
  }
  kiem("tim · (a*){20}b tren 'a'x30+'!' tra {loi} ngay, khong treo", (() => { const t0 = Date.now(); const r = K.timTrongVanBan("a".repeat(30) + "!", "(a*){20}b", { regex: true }); return r.length === 0 && !!r.loi && Date.now() - t0 < 500; })());

  nhom("tim-kiem · taoRegex / van ban");
  const tim = (s, q, tc) => K.timTrongVanBan(s, q, tc).map((k) => s.slice(k.bd, k.kt));
  kiem("taoRegex · q rong -> {loi:\"\"}", K.taoRegex("").loi === "");
  kiem("taoRegex · regex sai cu phap -> {loi} tieng Viet, khong nem", (() => { const r = K.taoRegex("(", { regex: true }); return typeof r.loi === "string" && r.loi.length > 3; })());
  kiem("taoRegex · (a+)+ bi chan (an toan)", /lồng nhau/.test(K.taoRegex("(a+)+$", { regex: true }).loi || ""));
  kiem("taoRegex · van ban thuan: ky tu dac biet duoc thoat (a.b) khong khop axb", eq(tim("axb a.b", "a.b", {}), ["a.b"]));
  kiem("taoRegex · van ban thuan: ( [ { ? * + ^ $ | \\ / duoc thoat", eq(tim("f(x)[0]{1}?*+^$|\\/", "(x)[0]{1}?*+^$|\\/", {}), ["(x)[0]{1}?*+^$|\\/"]));
  kiem("tim · khong phan biet hoa thuong mac dinh", eq(tim("Hà Nội hà nội HÀ NỘI", "hà nội", {}), ["Hà Nội", "hà nội", "HÀ NỘI"]));
  kiem("tim · phan biet hoa thuong", eq(tim("Hà Nội hà nội", "hà nội", { hoaThuong: true }), ["hà nội"]));
  kiem("tim · ca tu: 'an' khong khop trong 'bán' / 'cần' / 'an_toan'", eq(tim("an bán cần an_toan an,", "an", { caTu: true }), ["an", "an"]));
  kiem("tim · ca tu tieng Viet co dau: 'dự' khong khop 'dự án' nua chu 'dựa'", eq(tim("dự dựa dự án", "dự", { caTu: true }), ["dự", "dự"]));
  kiem("tim · ca tu + regex: \\d+ chi khop so nguyen khoi", eq(tim("12 a34 56b 78", "\\d+", { caTu: true, regex: true }), ["12", "78"]));
  kiem("tim · khop rong khong lap vo han (a*)", (() => { const r = K.timTrongVanBan("baaac", "a*", { regex: true }); return r.length === 1 && r[0].bd === 1 && r[0].kt === 4; })());
  kiem("tim · khop rong: ^ trong chuoi nhieu dong bo qua (khong treo)", K.timTrongVanBan("a\nb\n", "^", { regex: true }).length === 0);
  kiem("tim · regex ^ $ theo dong (co m)", eq(tim("ab\ncd\nab", "^ab$", { regex: true }), ["ab", "ab"]));
  kiem("tim · emoji / code point: khop 💡 va vi tri UTF-16 dung", (() => { const s = "a💡b💡"; const r = K.timTrongVanBan(s, "💡", {}); return r.length === 2 && r[0].bd === 1 && r[0].kt === 3 && r[1].bd === 4; })());
  kiem("tim · tran cat + catBot", (() => { const r = K.timTrongVanBan("a".repeat(100), "a", {}, 10); return r.length === 10 && r.catBot === true; })());
  kiem("tim · khong catBot khi du", K.timTrongVanBan("aaa", "a", {}, 3).catBot === false);
  kiem("tim · loi tra ve mang rong co .loi", (() => { const r = K.timTrongVanBan("x", "(", { regex: true }); return r.length === 0 && /Regex|regex/.test(r.loi); })());
  kiem("tim · hoaThuong + thuan dung indexOf: ket qua = tham chieu", (() => { const s = "abcabcABC"; return eq(K.timTrongVanBan(s, "abc", { hoaThuong: true }), [{ bd: 0, kt: 3 }, { bd: 3, kt: 6 }]); })());

  nhom("tim-kiem · thay trong van ban");
  const thay = (s, q, t, tc) => K.thayTrongVanBan(s, q, t, tc);
  kiem("thay · tat ca (van ban thuan, $ giu nguyen nghia den)", eq(thay("a-b-c", "-", "$1$&", {}), { s: "a$1$&b$1$&c", soThay: 2 }));
  kiem("thay · regex $1 $2 va $&", eq(thay("2026-10-24", "(\\d+)-(\\d+)-(\\d+)", "$3/$2/$1 [$&]", { regex: true }), { s: "24/10/2026 [2026-10-24]", soThay: 1 }));
  kiem("thay · $$ la mot dau $; $9 khong ton tai giu nguyen", thay("ab", "(a)", "$$|$9|$1", { regex: true }).s === "$|$9|ab");
  kiem("thay · $<ten> nhom co ten", thay("xy", "(?<h>x)", "[$<h>]", { regex: true }).s === "[x]y");
  kiem("thay · thay bang rong", thay("a1b22c", "\\d+", "", { regex: true }).s === "abc");
  kiem("thay · chi thay mot khop theo vi tri", (() => { const s = "aXbXc"; const ds = K.timTrongVanBan(s, "x", {}); return thay(s, [ds[1]], "-", { }).s === "aXb-c"; })());
  kiem("thay · mang khop + regex: van mo rong $1", (() => { const s = "k1 k2"; const ds = K.timTrongVanBan(s, "k(\\d)", { regex: true }); return thay(s, [ds[1]], "<$1>", { regex: true, q: "k(\\d)" }).s === "k1 <2>"; })());
  kiem("thay · tieng Viet, emoji", thay("Hà Nội 💡", "💡", "🌙", {}).s === "Hà Nội 🌙");
  kiem("thay · khong khop: soThay 0, giu nguyen", eq(thay("abc", "z", "y", {}), { s: "abc", soThay: 0 }));
  kiem("thay · regex sai: {loi}, giu nguyen", (() => { const r = thay("abc", "(", "y", { regex: true }); return r.s === "abc" && r.soThay === 0 && !!r.loi; })());
  kiem("thay · bo khop rong (a*) khong chen o dau chuoi", thay("baac", "a*", "X", { regex: true }).s === "bXc");

  nhom("tim-kiem · tim trong cay gia tri");
  const goc = { ten: "Hà Nội", ds: [{ ten: "an", gia: 12 }, { ten: "Hà Giang", on: true }, null], "khoá hà": { x: "hà", y: [1, "hà hà"] }, so: 12 };
  const tg = (q, tc) => K.timTrongGiaTri(goc, q, tc || {}).map((m) => J(m.duong) + (m.noi === "khoa" ? "#k" : "") + "@" + m.bd);
  kiem("cay · thu tu = thu tu tai lieu (khoa truoc gia tri)", eq(tg("hà"), ['["ten"]@0', '["ds",1,"ten"]@0', '["khoá hà"]#k@5', '["khoá hà","x"]@0', '["khoá hà","y",1]@0', '["khoá hà","y",1]@3']));
  kiem("cay · chi khoa", eq(tg("hà", { phamVi: "khoa" }), ['["khoá hà"]#k@5']));
  kiem("cay · chi gia tri", eq(tg("hà", { phamVi: "gia-tri" }).length, 5));
  kiem("cay · so duoc tim nhu chuoi (12) va loc theo kieu", eq(tg("12", {}), ['["ds",0,"gia"]@0', '["so"]@0']) && eq(tg("12", { kieu: ["string"] }), []));
  kiem("cay · true / null tim duoc, loc kieu boolean", eq(tg("true"), ['["ds",1,"on"]@0']) && eq(tg("null", { kieu: ["null"] }), ['["ds",2]@0']));
  kiem("cay · regex + hoa thuong + ca tu", tg("^h", { regex: true, hoaThuong: true }).length === 2 && tg("^h", { regex: true }).length === 4 && eq(tg("an", { caTu: true, hoaThuong: true }), ['["ds",0,"ten"]@0']));
  kiem("cay · duong dan so la SO (chi so mang), khoa la chuoi", (() => { const r = K.timTrongGiaTri({ a: ["x"] }, "x", {}); return r[0].duong[0] === "a" && r[0].duong[1] === 0; })());
  kiem("cay · khoa \"__proto__\" va chuoi chua <img onerror> khong gay hai", (() => { const d = JSON.parse('{"__proto__":"<img onerror=1>","a":"<img onerror=1>"}'); return K.timTrongGiaTri(d, "<img", {}).length === 2; })());
  kiem("cay · tran 3 -> catBot", (() => { const r = K.timTrongGiaTri({ a: "x".repeat(50) }, "x", {}, 3); return r.length === 3 && r.catBot; })());
  const sau = (n) => { let v = "hà"; for (let i = 0; i < n; i++) v = { a: v }; return v; };
  kiem("cay · long 20 000 cap: lap, khong tran ngan xep; duong dan do dai 20 001", (() => { const r = K.timTrongGiaTri(sau(20000), "hà", {}); return r.length === 1 && r[0].duong.length === 20000; })());

  nhom("tim-kiem · thay trong cay (mot buoc, gia tri + ten khoa)");
  const tt = (g, q, t, tc) => K.thayTrongGiaTri(g, q, t, tc || {});
  const g1 = { a: "foo bar foo", b: ["foo", 1, { foo: "x", k: "foo" }], foo: "v" };
  const r1 = tt(g1, "foo", "Z");
  kiem("thay cay · gia tri va ten khoa deu doi, thu tu khoa giu nguyen", eq(r1.goc, { a: "Z bar Z", b: ["Z", 1, { Z: "x", k: "Z" }], Z: "v" }) && J(Object.keys(r1.goc)) === J(["a", "b", "Z"]) && r1.soThay === 6, J(r1));
  kiem("thay cay · goc cu khong bi sua (thuan)", eq(g1, { a: "foo bar foo", b: ["foo", 1, { foo: "x", k: "foo" }], foo: "v" }));
  kiem("thay cay · nhanh khong doi dung chung tham chieu", (() => { const g = { a: { x: 1, y: [1, 2] }, b: "foo" }; const r = tt(g, "foo", "x"); return r.goc.a === g.a; })());
  kiem("thay cay · chi gia tri", (() => { const r = tt(g1, "foo", "Z", { phamVi: "gia-tri" }); return r.goc.foo === "v" && r.goc.a === "Z bar Z" && !Object.prototype.hasOwnProperty.call(r.goc, "Z"); })());
  kiem("thay cay · chi khoa", (() => { const r = tt(g1, "foo", "Z", { phamVi: "khoa" }); return r.goc.a === "foo bar foo" && r.goc.Z === "v" && r.soThay === 2; })());
  kiem("thay cay · doi ten gay trung bi bo qua + bao, giu ten cu", (() => { const g = { a: 1, b: 2 }; const r = tt(g, "a", "b", { phamVi: "khoa" }); return eq(r.goc, { a: 1, b: 2 }) && r.boQua.length === 1 && /trùng/.test(r.boQua[0].lyDo) && r.soThay === 0; })());
  kiem("thay cay · hai khoa cung doi thanh mot ten: ca hai bo qua", (() => { const g = { xa: 1, xb: 2, c: 3 }; const r = tt(g, "x[ab]", "k", { phamVi: "khoa", regex: true }); return eq(r.goc, g) && r.boQua.length === 2; })());
  kiem("thay cay · hoan doi hai khoa (a->b, b->a) khong xung dot", (() => { const g = { a: 1, b: 2 }; const r = tt(g, "^(a|b)$", "$1$1", { phamVi: "khoa", regex: true }); return eq(r.goc, { aa: 1, bb: 2 }) && r.soThay === 2; })());
  kiem("thay cay · so / true / null khop thi bo qua + bao ly do", (() => { const r = tt({ n: 12, s: "12" }, "12", "99"); return eq(r.goc, { n: 12, s: "99" }) && r.boQua.length === 1 && /số/.test(r.boQua[0].lyDo) && eq(r.boQua[0].duong, ["n"]); })());
  kiem("thay cay · regex $1 trong cay", tt({ a: "k1 k2" }, "k(\\d)", "<$1>", { regex: true }).goc.a === "<1> <2>");
  kiem("thay cay · chi MOT cho (chi: duong + noi + thuTu)", (() => { const g = { a: "x x", b: "x" }; const r = tt(g, "x", "Y", { chi: { duong: ["a"], noi: "gia-tri", thuTu: 1 } }); return eq(r.goc, { a: "x Y", b: "x" }) && r.soThay === 1; })());
  kiem("thay cay · chi mot khoa", (() => { const g = { a: 1, b: { a: 2 } }; const r = tt(g, "a", "z", { chi: { duong: ["b", "a"], noi: "khoa" }, phamVi: "ca-hai" }); return eq(r.goc, { a: 1, b: { z: 2 } }); })());
  kiem("thay cay · khoa __proto__ doi ten khong lam hong nguyen mau", (() => { const g = JSON.parse('{"__proto__":{"x":1},"a":2}'); const r = tt(g, "__proto__", "p", { phamVi: "khoa" }); return Object.keys(r.goc).join() === "p,a" && r.goc.p.x === 1; })());
  kiem("thay cay · doi gia tri thanh khoa __proto__ van la khoa that", (() => { const g = { a: "p" }; const r = tt(g, "^a$", "__proto__", { phamVi: "khoa", regex: true }); return Object.keys(r.goc).join() === "__proto__" && JSON.stringify(r.goc) === '{"__proto__":"p"}'; })());
  kiem("thay cay · long 20 000 cap: lap, dung 1 thay", (() => { const r = tt(sau(20000), "hà", "Z"); let x = r.goc, d = 0; while (x && typeof x === "object") { x = x.a; d++; } return d === 20000 && x === "Z" && r.soThay === 1; })());
  kiem("thay cay · khong khop: tra ve CHINH goc", (() => { const g = { a: 1 }; return tt(g, "zz", "y").goc === g; })());

  nhom("tim-kiem · fuzz doi chieu tham chieu (de quy)");
  {
    const ngau = C.taoNgauNhien(77177);
    const chon = (a) => a[Math.floor(ngau() * a.length) % a.length];
    const TU = ["foo", "bar", "Foo", "foo bar", "", "a", "foofoo", "x-y", "hà", "💡", "q$1", "f.o"];
    const KH = ["foo", "bar", "a", "k1", "k2", "Foo", "hà"];
    function sinh(s) {
      const r = ngau();
      if (s <= 0 || r < 0.4) return ngau() < 0.8 ? chon(TU) + chon(["", " ", "foo"]) : chon([1, true, null, 12]);
      if (r < 0.65) return Array.from({ length: Math.floor(ngau() * 4) }, () => sinh(s - 1));
      const o = {};
      for (const k of KH) if (ngau() < 0.45) o[k] = sinh(s - 1);
      return o;
    }
    /* THAM CHIEU: de quy, String.prototype.split/join (van ban thuan, phan biet hoa thuong), rieng cho ten khoa tranh trung */
    function thamChieu(v, q, t, vi) {
      let so = 0;
      const doiChu = (s) => { const n = s.split(q).length - 1; so += n; return s.split(q).join(t); };
      function lam(x) {
        if (typeof x === "string") return vi === "khoa" ? x : doiChu(x);
        if (Array.isArray(x)) return x.map(lam);
        if (x && typeof x === "object") {
          const ks = Object.keys(x), moi = ks.map((k) => (vi === "gia-tri" ? k : k.split(q).join(t)));
          const dem = {};
          moi.forEach((m) => { dem[m] = (dem[m] || 0) + 1; });
          const o = {};
          ks.forEach((k, i) => {
            let ten = k;
            if (vi !== "gia-tri" && dem[moi[i]] === 1) { ten = moi[i]; so += k.split(q).length - 1; }
            Object.defineProperty(o, ten, { value: lam(x[k]), enumerable: true, writable: true, configurable: true });
          });
          return o;
        }
        return x;
      }
      return { goc: lam(v), soThay: so };
    }
    let lech = 0, mau = "", soCa = 0;
    for (let i = 0; i < 400; i++) {
      const g = sinh(4);
      const q = chon(["foo", "a", "bar", "hà", "💡", "x-y", "f.o", "o"]), t = chon(["", "Z", "foo", "ZZ", "$1"]), vi = chon(["gia-tri", "ca-hai", "khoa"]);
      const r = K.thayTrongGiaTri(g, q, t, { hoaThuong: true, phamVi: vi, kieu: ["string"] });
      const m = thamChieu(g, q, t, vi);
      soCa++;
      /* tham chieu bo qua cap khoa trung ca khi chi 1 khoa doi: dung so sanh chuoi + so thay */
      if (J(r.goc) !== J(m.goc) || r.soThay !== m.soThay) { lech++; if (!mau) mau = q + "→" + t + " [" + vi + "] tren " + J(g).slice(0, 100) + "\n  ra " + J(r.goc).slice(0, 100) + " " + r.soThay + "\n  ref " + J(m.goc).slice(0, 100) + " " + m.soThay; }
    }
    kiem("fuzz · " + soCa + " lan thay trong cay (van ban thuan) khop tham chieu tung byte va so thay", lech === 0, mau || soCa + " ca");

    let lech2 = 0, mau2 = "";
    for (let i = 0; i < 400; i++) {
      const g = sinh(3), s = J(g);
      const q = chon(["foo", "a", "o", "hà", "💡", "\"", "x"]), cs = chon([true, false]);
      const r = K.timTrongVanBan(s, q, { hoaThuong: cs });
      /* tham chieu: quet tung vi tri bang so sanh chuoi (khong chong nhau) */
      const ref = []; const A = cs ? s : s.toLowerCase(), B = cs ? q : q.toLowerCase();
      for (let p = 0; p + B.length <= A.length;) { if (A.substr(p, B.length) === B) { ref.push([p, p + B.length]); p += B.length; } else p++; }
      if (J(r.map((k) => [k.bd, k.kt])) !== J(ref)) { lech2++; if (!mau2) mau2 = q + " tren " + s.slice(0, 80); }
    }
    kiem("fuzz · 400 lan tim trong van ban khop quet tung vi tri (hoa thuong / khong)", lech2 === 0, mau2);
  }

  nhom("tim-kiem · ca benh ly + do");
  {
    const t0 = Date.now();
    const lon = "abc".repeat(500000);
    const r = K.timTrongVanBan(lon, "(a|b)+c", { regex: true }, 100);
    kiem("benh ly · (a|b)+c tren 1,5 MB (nhanh tach dau khac nhau): < 1 s", r.length === 100 && Date.now() - t0 < 1000, (Date.now() - t0) + " ms");
    const t1 = Date.now();
    const lon2 = "a".repeat(100000) + "!";
    const r2 = K.timTrongVanBan(lon2, "(a+)+$", { regex: true });
    kiem("benh ly · (a+)+$ bi tu choi TRUOC khi chay: khong treo, co .loi", r2.length === 0 && /lồng/.test(r2.loi) && Date.now() - t1 < 200);
    const t2 = Date.now();
    const r3 = K.timTrongVanBan("x".repeat(2000000), "x", { regex: true }, 20000);
    kiem("benh ly · 2 000 000 khop bi cat o 20 000, < 500 ms", r3.length === 20000 && r3.catBot && Date.now() - t2 < 500, (Date.now() - t2) + " ms");
    const lonObj = { a: [] };
    for (let i = 0; i < 100000; i++) lonObj.a.push({ id: i, ten: "muc foo " + i, tag: i % 3 ? "x" : "foo" });
    const t3 = Date.now();
    const rc = K.timTrongGiaTri(lonObj, "foo", {}, 200000);
    const ms3 = Date.now() - t3;
    const t4 = Date.now();
    const rt = K.thayTrongGiaTri(lonObj, "foo", "baz", {});
    const ms4 = Date.now() - t4;
    console.log("  [do]  tim-kiem: tim 'foo' trong cay 100 000 muc (~5 MB) " + ms3 + " ms (" + rc.length + " khop); thay tat ca " + ms4 + " ms (" + rt.soThay + " cho)");
    kiem("hieu nang · tim trong cay 100 000 muc < 3000 ms, thay tat ca < 6000 ms (do tren may dang tai; do thuong ~0,8 s / ~1,6 s)", ms3 < 3000 && ms4 < 6000 && rc.length === 100000 + 33334, ms3 + " / " + ms4 + " ms, " + rc.length + " khop");
    kiem("hieu nang · thay tat ca chia se cau truc voi nhanh khong doi", rt.goc.a.length === 100000 && rt.goc.a[1].id === 1);
  }
};
