/* kiem/jsonpath.js — assets/jsonpath.js: JSONPath tap con RFC 9535 + JSON Pointer.
   Bang >= 60 bieu thuc (vi du RFC 9535 §1.5 + ca bien), loi phan tich, tuong thich cu,
   fuzz doi chieu voi mot bo danh gia THAM CHIEU viet lai rieng (de quy, khong dung chung ma), ca benh ly. */
"use strict";

module.exports = function (C) {
  const kiem = C.kiem, nhom = C.nhom;
  const MT = C.taoMoiTruong();
  const P = MT.JE.jsonpath;
  if (!kiem("jsonpath · nap xong, co JE.jsonpath", !!P && typeof P.chay === "function")) return;

  const vals = (d, q, o) => P.chay(d, q, undefined, o).map((r) => r.v);
  const paths = (d, q, o) => P.chay(d, q, undefined, o).map((r) => r.chuan);
  const J = (x) => JSON.stringify(x);
  const eq = (a, b) => J(a) === J(b);

  /* ---------------------------------------------------------------- bang bieu thuc */
  nhom("jsonpath · RFC 9535 §1.5 (cua hang sach)");
  const sach = {
    store: {
      book: [
        { category: "reference", author: "Nigel Rees", title: "Sayings of the Century", price: 8.95 },
        { category: "fiction", author: "Evelyn Waugh", title: "Sword of Honour", price: 12.99 },
        { category: "fiction", author: "Herman Melville", title: "Moby Dick", isbn: "0-553-21311-3", price: 8.99 },
        { category: "fiction", author: "J. R. R. Tolkien", title: "The Lord of the Rings", isbn: "0-395-19395-8", price: 22.99 }
      ],
      bicycle: { color: "red", price: 399 }
    }
  };
  const tacGia = ["Nigel Rees", "Evelyn Waugh", "Herman Melville", "J. R. R. Tolkien"];
  const rfc = [
    ["$.store.book[*].author", tacGia],
    ["$..author", tacGia],
    ["$.store.*", [sach.store.book, sach.store.bicycle]],
    ["$.store..price", [8.95, 12.99, 8.99, 22.99, 399]],
    ["$..book[2]", [sach.store.book[2]]],
    ["$..book[2].author", ["Herman Melville"]],
    ["$..book[2].publisher", []],
    ["$..book[-1]", [sach.store.book[3]]],
    ["$..book[0,1]", [sach.store.book[0], sach.store.book[1]]],
    ["$..book[:2]", [sach.store.book[0], sach.store.book[1]]],
    ["$..book[?@.isbn]", [sach.store.book[2], sach.store.book[3]]],
    ["$..book[?@.price<10]", [sach.store.book[0], sach.store.book[2]]],
    ["$..book[?(@.price < 10)].title", ["Sayings of the Century", "Moby Dick"]],
    ["$..book[?@.category == 'fiction' && @.price > 10].title", ["Sword of Honour", "The Lord of the Rings"]],
    ["$..book[?@.category=='reference' || @.price>20].author", ["Nigel Rees", "J. R. R. Tolkien"]],
    ["$..book[?!@.isbn].title", ["Sayings of the Century", "Sword of Honour"]],
    ["$..book[?!(@.price<10)].title", ["Sword of Honour", "The Lord of the Rings"]],
    ["$.store.book[?length(@.title) > 15].title", ["Sayings of the Century", "The Lord of the Rings"]],
    ["$.store.book[?match(@.author, 'J\\\\. R\\\\. R\\\\. .*')].title", ["The Lord of the Rings"]],
    ["$.store.book[?search(@.title, 'of')].title", ["Sayings of the Century", "Sword of Honour", "The Lord of the Rings"]],
    ["$.store.book[?@.title =~ /^moby/i].price", [8.99]],
    ["$.store[?count(@.*) > 1]", [sach.store.book, sach.store.bicycle]],   /* loc tren CON cua store: book 4 con, bicycle 2 */
    ["$.store.book[?count(@.*) == 5].title", ["Moby Dick", "The Lord of the Rings"]],
    ["$.store.book[?value(@.price) == 12.99].title", ["Sword of Honour"]],
    ["$..*", null]                                /* chi dem — xem duoi */
  ];
  for (const [q, mong] of rfc) {
    if (mong === null) continue;
    let kq, loi = "";
    try { kq = vals(sach, q); } catch (e) { loi = e.message; }
    kiem("jsonpath · " + q, kq !== undefined && eq(kq, mong), loi || J(kq).slice(0, 120));
  }
  kiem("jsonpath · $..* dem du moi nut con chau (1 + 2 + 4×… = 27)", vals(sach, "$..*").length === 27, String(vals(sach, "$..*").length));

  nhom("jsonpath · chi so, cat lat, hop, ten dac biet");
  const m10 = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const bang = [
    [m10, "$[0]", [0]], [m10, "$[9]", [9]], [m10, "$[10]", []], [m10, "$[-1]", [9]], [m10, "$[-10]", [0]], [m10, "$[-11]", []],
    [m10, "$[1:3]", [1, 2]], [m10, "$[5:]", [5, 6, 7, 8, 9]], [m10, "$[:3]", [0, 1, 2]], [m10, "$[1:5:2]", [1, 3]],
    [m10, "$[5:1:-2]", [5, 3]], [m10, "$[::-1]", [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]], [m10, "$[::3]", [0, 3, 6, 9]],
    [m10, "$[-3:]", [7, 8, 9]], [m10, "$[:-8]", [0, 1]], [m10, "$[3:3]", []], [m10, "$[5:2]", []], [m10, "$[0:100]", m10],
    [m10, "$[-100:2]", [0, 1]], [m10, "$[1:5:0]", []], [m10, "$[::-3]", [9, 6, 3, 0]], [m10, "$[8:-100:-3]", [8, 5, 2]],
    [m10, "$[0,2,-1]", [0, 2, 9]], [m10, "$[1:3,7]", [1, 2, 7]], [m10, "$[*]", m10], [m10, "$.*", m10],
    [{ "a b": 1, "k.k": 2, "'": 3, "@": 4, "": 5, "\n": 6, "é": 7, "💡": 8 }, "$['a b']", [1]],
    [{ "k.k": 2 }, "$['k.k']", [2]], [{ "'": 3 }, "$[\"'\"]", [3]], [{ "'": 3 }, "$['\\'']", [3]], [{ "@": 4 }, "$['@']", [4]],
    [{ "": 5 }, "$['']", [5]], [{ "\n": 6 }, "$['\\n']", [6]], [{ "é": 7 }, "$.é", [7]], [{ "💡": 8 }, "$['💡']", [8]],
    [{ "💡": 8 }, "$['\\ud83d\\udca1']", [8]], [{ "é": 7 }, "$['\\u00e9']", [7]],
    [{ a: { b: [{ c: 1 }, { c: 2 }] } }, "$.a.b[*].c", [1, 2]], [{ a: { b: [{ c: 1 }, { c: 2 }] } }, "$..c", [1, 2]],
    [{ a: [{ a: 1 }] }, "$..a", [[{ a: 1 }], 1]], [{ a: 1, b: 2 }, "$['a','b']", [1, 2]], [{ a: 1, b: 2 }, "$['b','a','b']", [2, 1, 2]],
    [{ a: 1, b: 2 }, "$[*]", [1, 2]], [{ a: [1, 2] }, "$.a[0,1]", [1, 2]], [{ a: [1, 2] }, "$..[0]", [1]],
    [{ a: [[1, 2], [3]] }, "$..[1]", [[3], 2]],
    [{ toString: 1, o: { constructor: 2 }, l: [1, 2] }, "$.toString", [1]], [{ o: {} }, "$.o.constructor", []], [{ l: [1, 2, 3] }, "$.l.length", []],
    [{ l: [1, 2, 3] }, "$.l[length]", []], [JSON.parse('{"__proto__":{"x":1},"y":2}'), "$.__proto__.x", [1]], [{ a: 1 }, "$.__proto__", []],
    [[{ a: 1 }, { a: 2 }, { a: 3 }], "$[?@.a >= 2].a", [2, 3]], [[{ a: 1 }, { a: "x" }, { a: null }, {}], "$[?@.a == null]", [{ a: null }]],
    [[{ a: 1 }, { a: "1" }, { a: true }], "$[?@.a == 1]", [{ a: 1 }]], [[{ a: 1 }, { a: "1" }], "$[?@.a == '1']", [{ a: "1" }]],
    [[{ a: 1.0 }, { a: 1 }], "$[?@.a == 1]", [{ a: 1 }, { a: 1 }]], [[{ a: 1 }, { a: 2 }], "$[?@.a != 1].a", [2]],
    [[{ a: "b" }, { a: "a" }, { a: "c" }], "$[?@.a < 'c'].a", ["b", "a"]], [[{ a: "b" }, { a: 1 }], "$[?@.a < 5]", [{ a: 1 }]],
    [[{ a: "😀" }, { a: "￿" }], "$[?@.a > '\\uffff'].a", ["😀"]],   /* so theo code point: 😀 (U+1F600) > U+FFFF */
    [[{}, { a: 1 }, { b: 1 }], "$[?@.a == @.b]", [{}]], [[{}, { a: 1 }], "$[?@.a <= @.b]", [{}]],
    [[{ a: [1] }, { a: [2] }], "$[?@.a == [1]]", null],
    [[{ a: { x: 1, y: 2 } }, { a: { y: 2, x: 1 } }, { a: { x: 1 } }], "$[?@.a == $[0].a]", [{ a: { x: 1, y: 2 } }, { a: { y: 2, x: 1 } }]],
    [[{ a: 1 }, { a: 2 }], "$[?$[0].a == 1].a", [1, 2]],
    [[{ a: [1, 2] }, { a: [] }, { a: 5 }], "$[?@.a[0]]", [{ a: [1, 2] }]],
    [[{ n: "ab" }, { n: "a😀" }, { n: 3 }], "$[?length(@.n) == 2].n", ["ab", "a😀"]],
    [[{ n: { a: 1, b: 2 } }, { n: [1] }], "$[?length(@.n) == 2].n", [{ a: 1, b: 2 }]],
    [{ a: [1, 2, 3] }, "$[?count(@.*) == 3]", [[1, 2, 3]]], [[[1, 2, 3], [1]], "$[?count(@[*]) == 3]", [[1, 2, 3]]],
    [[{ a: "x" }, { a: "xy" }], "$[?match(@.a, 'x')].a", ["x"]], [[{ a: "x" }, { a: "xy" }], "$[?search(@.a, 'y')].a", ["xy"]],
    [[{ a: 1 }], "$[?match(@.a, 'x')]", []], [[{ a: "x", p: "(" }], "$[?match(@.a, @.p)]", []],
    [{ a: { b: { c: 1 } } }, "$..[?@.c]", [{ c: 1 }]], [{ a: [{ b: 1 }, { b: 2 }] }, "$.a[?@.b > 1]", [{ b: 2 }]],
    [{ a: 1 }, "$", [{ a: 1 }]], [{ a: 1 }, "", [{ a: 1 }]], [{ a: 1 }, "a", [1]], [{ a: { b: 2 } }, "a.b", [2]], [{ a: 1 }, ".a", [1]], [[5], "[0]", [5]],
    [{ a: { b: [10, 20] } }, "/a/b/1", [20]], [{ a: { b: [10, 20] } }, "/a/b/2", []], [{ "a/b": 1, "m~n": 2 }, "/a~1b", [1]],
    [{ "a/b": 1, "m~n": 2 }, "/m~0n", [2]], [{ a: [1] }, "#/a/0", [1]], [{ a: 1 }, "/", []], [{ "": 7 }, "/", [7]],
    [{ a: 1 }, "  $.a  ", [1]], [{ a: [1, 2] }, "$.a[ 0 , 1 ]", [1, 2]], [{ a: [1, 2, 3] }, "$.a[ 0 : 2 ]", [1, 2]],
    [{ a: [1, 2] }, "$.a[?  @ > 1  ]", [2]], [{ a: [1, 2] }, "$ .a [0]", [1]]
  ];
  for (const [d, q, mong] of bang) {
    if (mong === null) continue;
    let kq, loi = "";
    try { kq = vals(d, q); } catch (e) { loi = e.message; }
    kiem("jsonpath · " + q + "  tren " + J(d).slice(0, 40), kq !== undefined && eq(kq, mong), loi || J(kq).slice(0, 120));
  }
  /* toan hang object/mang literal khong ho tro: bao loi ro rang, khong im lang */
  kiem("jsonpath · so sanh voi literal mang [1] -> loi phan tich co cot", (() => { try { P.phanTich("$[?@.a == [1]]"); return false; } catch (e) { return typeof e.cot === "number" && /Không hiểu/.test(e.thongBao); } })());

  nhom("jsonpath · duong dan chuan hoa va kieu ket qua");
  kiem("chuan · $.store.book[0].title", eq(paths(sach, "$.store.book[0].title"), ["$['store']['book'][0]['title']"]));
  kiem("chuan · khoa co dau nhay don va xuong dong duoc thoat", eq(paths({ "a'b": { "\n": 1 } }, "$..*"), ["$['a\\'b']", "$['a\\'b']['\\n']"]));
  kiem("chuan · ky tu dieu khien < 0x20 thanh \\u00xx", eq(paths({ "\u0001": 1 }, "$.*"), ["$['\\u0001']"]));
  kiem("chuan · [-1] tra ve chi so that", eq(paths([1, 2, 3], "$[-1]"), ["$[2]"]));
  kiem("hien · $.a[0][\"b c\"]", eq(P.chay({ a: [{ "b c": 1 }] }, "$.a[0]['b c']").map((r) => r.hien), ['$.a[0]["b c"]']));
  kiem("duong · mang khoa / chi so (so la so, khoa la chuoi)", eq(P.chay({ a: [{ b: 1 }] }, "$.a[0].b")[0].duong, ["a", 0, "b"]));
  kiem("thu tu · $..a theo RFC: khoa o nut cha truoc, roi xuong con",
    eq(paths({ a: { a: 1 }, b: { a: 2 } }, "$..a"), ["$['a']", "$['a']['a']", "$['b']['a']"]));
  kiem("thu tu · hop doan: theo thu tu nut roi theo thu tu selector", eq(vals({ a: 1, b: 2 }, "$['b','a']"), [2, 1]));

  nhom("jsonpath · tuong thich cu (kieuCu) va ngu phap thua ke");
  kiem("cu · $.o[0] tren object co khoa \"0\" khop khi kieuCu", eq(vals({ o: { 0: "khong" } }, "$.o[0]", { kieuCu: true }), ["khong"]));
  kiem("RFC · $.o[0] tren object KHONG khop (mac dinh)", eq(vals({ o: { 0: "khong" } }, "$.o[0]"), []));
  kiem("cu · $.mang.0 khop phan tu khi kieuCu", eq(vals({ mang: [7, 8] }, "$.mang.0", { kieuCu: true }), [7]));
  kiem("cu · [ten] khong nhay la ten", eq(vals({ ten: 5 }, "$[ten]"), [5]));
  kiem("cu · ten co dau gach noi", eq(vals({ "a-b": 1 }, "$.a-b"), [1]));

  nhom("jsonpath · loi phan tich (>= 25 bieu thuc sai, bao co cot)");
  const sai = [
    "$.", "$..", "$.[", "$[", "$[0", "$[0,", "$['a", "$['a'", "$[01]", "$[-0]", "$[1:2:3:4]", "$[?]", "$[?@.a ==]", "$[?@.a == 1",
    "$[?(@.a]", "$[?@.a === 1]", "$[?1]", "$[?'a']", "$[?foo(@.a)]", "$[?length(@.a)]", "$[?length(@.a, 1) == 1]", "$[?match(@.a)]",
    "$[?@.* == 1]", "$[?@..a == 1]", "$[?@[0,1] == 1]", "$[?@.a =~ x]", "$[?@.a =~ /(a+)+$/]", "$[?@.a =~ /(/]", "$[9007199254740992]",
    "$['\\q']", "$['\\u12']", "$['\\ud800']", "@.a", "%", "$%bay", "$.a b", "$[?count(1) == 1]", "$[?match('a','b') == true]",
    "$[?@.a == length(@.b)", "$[?!]", "$['a' 'b']", "$[?@.a && ]", "$[?@.a || || @.b]", "$[?@.a < ]", "$.a..", "$[?@.a == truee]"
  ];
  let soSaiDung = 0;
  for (const q of sai) {
    let loi = null;
    try { P.chay({}, q); } catch (e) { loi = e; }
    const ok = loi && loi.name === "LoiJsonPath" && typeof loi.thongBao === "string" && loi.thongBao.length > 3;
    if (ok) soSaiDung++; else kiem("loi · " + q + " phai bao loi", false, loi ? loi.name + ": " + loi.message : "khong nem");
  }
  kiem("loi · " + sai.length + " bieu thuc sai deu bao LoiJsonPath co thongBao tieng Viet", soSaiDung === sai.length, soSaiDung + "/" + sai.length);
  kiem("loi · cot tro dung cho \"$.a[0,]\" (cot 7)", (() => { try { P.phanTich("$.a[0,]"); } catch (e) { return e.cot === 6; } return false; })());
  kiem("loi · thong bao co cot nguoi doc (dem tu 1)", (() => { try { P.phanTich("$.a[?@.x === 1]"); } catch (e) { return /\(cột \d+\)/.test(e.message); } return false; })());
  kiem("loi · JSON Pointer sai (~ la) bao loi", (() => { try { P.phanTich("/a~2"); return false; } catch (e) { return e.name === "LoiJsonPath"; } })());

  nhom("jsonpath · tran ket qua, ngan sach, ca benh ly");
  const lon = Array.from({ length: 50000 }, (_, i) => i);
  const kt = P.chay(lon, "$[*]", 100);
  kiem("tran · cat o 100 va danh dau catBot", kt.length === 100 && kt.catBot === true);
  kiem("tran · khong cat khi du ro", P.chay(lon, "$[0:10]").catBot === false);
  let nemNang = "";
  const cayNhiPhan = (d) => (d === 0 ? 1 : [cayNhiPhan(d - 1), cayNhiPhan(d - 1)]);
  const tNang = Date.now();
  try { P.chay(cayNhiPhan(12), "$..[?@..[?@..[?@..*]]]"); } catch (e) { nemNang = e.thongBao; }
  const msNang = Date.now() - tNang;
  kiem("ngan sach · bo loc long nhau cubic (cay nhi phan 8 191 nut) bi cat bang loi ro rang, < 6 s (khong treo)", /quá nặng/.test(nemNang) && msNang < 6000, nemNang + " " + msNang + " ms");
  const sau = (n) => { let v = 1; for (let i = 0; i < n; i++) v = { a: v }; return v; };
  let kqS = null, nemS = "";
  const t0 = Date.now();
  try { kqS = P.chay(sau(20000), "$..*"); } catch (e) { nemS = e.message; }
  kiem("sau · $..* tren object long 20 000 cap: lap, khong tran ngan xep", kqS && kqS.length === 20000, nemS || (kqS && kqS.length));
  kiem("sau · duong dan cua nut sau nhat doc duoc lazy (do dai 20 000)", kqS && kqS[19999].duong.length === 20000);
  kiem("sau · mat < 3 s", Date.now() - t0 < 3000, (Date.now() - t0) + " ms");
  const dSau = (n) => { let v = 1; for (let i = 0; i < n; i++) v = [v]; return v; };
  kiem("sau · mang long 20 000 cap voi $..[0]", P.chay(dSau(20000), "$..[0]").length === 20000);
  let nemRe = "";
  try { P.chay([{ a: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!" }], "$[?match(@.a, '(a+)+$')]"); } catch (e) { nemRe = e.thongBao; }
  kiem("ReDoS · match() voi (a+)+$ bi tu choi tuong khi PHAN TICH (khong chay)", /lồng nhau|treo/.test(nemRe), nemRe);
  const t1 = Date.now();
  const kqRe = P.chay([{ a: "a".repeat(40) + "!", p: "(a+)+$" }], "$[?match(@.a, @.p) || @.a]");
  kiem("ReDoS · match() voi mau nguy hiem (dung trong du lieu qua cu phap hop le) tra false chu khong treo",
    Date.now() - t1 < 500 && kqRe.length === 1, (Date.now() - t1) + " ms");
  let nemRe2 = "";
  try { P.chay([{ a: "a" }], "$[?@.a =~ /(x|xx)*y/]"); } catch (e) { nemRe2 = e.thongBao; }
  kiem("ReDoS · =~ voi (x|xx)*y bi tu choi", /nhánh trùng|treo/.test(nemRe2), nemRe2);
  kiem("ReDoS · =~ /(foo|bar)+/ (nhanh khac dau) duoc chay", P.chay([{ a: "foofoo" }, { a: "baz" }], "$[?@.a =~ /^(foo|bar)+$/]").length === 1);
  {
    const lonObj = { a: [] };
    for (let i = 0; i < 60000; i++) lonObj.a.push({ id: i, ten: "muc " + i, gia: i % 97, tag: i % 2 ? "x" : "y" });
    const ts = Date.now();
    const kq = P.chay(lonObj, "$.a[?@.gia > 90 && @.tag == 'x'].id");
    const ms = Date.now() - ts;
    console.log("  [do]  jsonpath: loc 60 000 phan tu (~3 MB) " + ms + " ms, " + kq.length + " ket qua");
    kiem("hieu nang · loc 60 000 phan tu < 1500 ms", ms < 1500, ms + " ms");
  }

  /* ---------------------------------------------------------------- fuzz doi chieu */
  nhom("jsonpath · fuzz doi chieu voi danh gia tham chieu (de quy, viet rieng)");
  {
    const ngauNhien = C.taoNgauNhien(20260524);
    const chon = (a) => a[Math.floor(ngauNhien() * a.length) % a.length];
    const KHOA = ["a", "b", "c", "x", "k k", "é"];
    function sinhGiaTri(s) {
      const r = ngauNhien();
      if (s <= 0 || r < 0.35) return chon([0, 1, 2, -1, 3.5, "a", "b", "xy", "", true, false, null]);
      if (r < 0.65) return Array.from({ length: Math.floor(ngauNhien() * 4) }, () => sinhGiaTri(s - 1));
      const o = {};
      for (const k of KHOA) if (ngauNhien() < 0.5) o[k] = sinhGiaTri(s - 1);
      return o;
    }
    /* THAM CHIEU: moi doan = ham nut -> mang nut; nut = {v, path[]} (duong dan sao chep, khong chung cau truc voi cai dat) */
    const con = (n) => Array.isArray(n.v) ? n.v.map((v, i) => ({ v, p: n.p.concat([i]) }))
      : (n.v && typeof n.v === "object") ? Object.keys(n.v).map((k) => ({ v: n.v[k], p: n.p.concat([k]) })) : [];
    const tatCa = (n) => { const ra = [n]; for (const c of con(n)) ra.push(...tatCa(c)); return ra; };
    function sinhDoan(sauLoc) {
      const r = ngauNhien();
      if (r < 0.2) { const k = chon(KHOA); return { t: /^[a-z]$/.test(k) ? "." + k : "['" + k + "']", f: (n) => (n.v && typeof n.v === "object" && !Array.isArray(n.v) && Object.prototype.hasOwnProperty.call(n.v, k)) ? [{ v: n.v[k], p: n.p.concat([k]) }] : [] }; }
      if (r < 0.32) { const i = Math.floor(ngauNhien() * 7) - 3; return { t: "[" + i + "]", f: (n) => { if (!Array.isArray(n.v)) return []; const j = i < 0 ? n.v.length + i : i; return j >= 0 && j < n.v.length ? [{ v: n.v[j], p: n.p.concat([j]) }] : []; } }; }
      if (r < 0.42) return { t: ".*", f: (n) => con(n) };
      if (r < 0.54) {
        const a = chon([null, 0, 1, 2, -1, -2, 5]), b = chon([null, 0, 1, 3, -1, 4, 9]), st = chon([null, 1, 2, -1, -2, 3]);
        const tx = "[" + (a === null ? "" : a) + ":" + (b === null ? "" : b) + (st === null ? "" : ":" + st) + "]";
        return { t: tx, f: (n) => {
          if (!Array.isArray(n.v)) return [];
          const len = n.v.length, step = st === null ? 1 : st;
          if (step === 0) return [];
          const norm = (x) => (x >= 0 ? x : len + x);
          const ra = [];
          if (step > 0) {
            const s0 = a === null ? 0 : a, e0 = b === null ? len : b;
            const lo = Math.min(Math.max(norm(s0), 0), len), hi = Math.min(Math.max(norm(e0), 0), len);
            for (let i = lo; i < hi; i += step) ra.push({ v: n.v[i], p: n.p.concat([i]) });
          } else {
            const s0 = a === null ? len - 1 : a, e0 = b === null ? -len - 1 : b;
            const hi = Math.min(Math.max(norm(s0), -1), len - 1), lo = Math.min(Math.max(norm(e0), -1), len - 1);
            for (let i = hi; lo < i; i += step) ra.push({ v: n.v[i], p: n.p.concat([i]) });
          }
          return ra;
        } };
      }
      if (r < 0.64) { const k = chon(["a", "b", "c"]); return { t: ".." + k, f: (n) => { const ra = []; for (const d of tatCa(n)) if (d.v && typeof d.v === "object" && !Array.isArray(d.v) && Object.prototype.hasOwnProperty.call(d.v, k)) ra.push({ v: d.v[k], p: d.p.concat([k]) }); return ra; } }; }
      if (r < 0.7) return { t: "..*", f: (n) => { const ra = []; for (const d of tatCa(n)) ra.push(...con(d)); return ra; } };
      if (r < 0.78) { const k1 = chon(KHOA), k2 = chon(KHOA); return { t: "['" + k1 + "','" + k2 + "']", f: (n) => { const ra = []; for (const k of [k1, k2]) if (n.v && typeof n.v === "object" && !Array.isArray(n.v) && Object.prototype.hasOwnProperty.call(n.v, k)) ra.push({ v: n.v[k], p: n.p.concat([k]) }); return ra; } }; }
      /* loc: @.k <op> literal | @.k (ton tai) | !@.k, ghep && || */
      const bt = sinhLoc(2);
      return { t: "[?" + bt.t + "]", f: (n) => con(n).filter((c) => bt.f(c)) };
    }
    const LIT = [[0, "0"], [1, "1"], [2, "2"], ["a", "'a'"], ["xy", "'xy'"], [true, "true"], [null, "null"], [3.5, "3.5"], [-1, "-1"]];
    function giaTriTai(c, k) { return c.v && typeof c.v === "object" && !Array.isArray(c.v) && Object.prototype.hasOwnProperty.call(c.v, k) ? c.v[k] : undefined; }
    function cmp(x, y, op) {
      const bang = x === undefined || y === undefined ? x === undefined && y === undefined : J(x) === J(y) && typeof x === typeof y;
      const be = (p, q) => (typeof p === "number" && typeof q === "number" ? p < q : typeof p === "string" && typeof q === "string" ? p < q : false);
      if (op === "==") return bang;
      if (op === "!=") return !bang;
      if (op === "<") return be(x, y);
      if (op === ">") return be(y, x);
      if (op === "<=") return be(x, y) || bang;
      return be(y, x) || bang;
    }
    function sinhLoc(sau) {
      const r = ngauNhien();
      if (sau > 0 && r < 0.2) { const a = sinhLoc(sau - 1), b = sinhLoc(sau - 1); return { t: "(" + a.t + ") && (" + b.t + ")", f: (c) => a.f(c) && b.f(c) }; }
      if (sau > 0 && r < 0.4) { const a = sinhLoc(sau - 1), b = sinhLoc(sau - 1); return { t: "(" + a.t + ") || (" + b.t + ")", f: (c) => a.f(c) || b.f(c) }; }
      if (sau > 0 && r < 0.5) { const a = sinhLoc(sau - 1); return { t: "!(" + a.t + ")", f: (c) => !a.f(c) }; }
      if (r < 0.65) { const k = chon(["a", "b", "c"]); return { t: "@." + k, f: (c) => giaTriTai(c, k) !== undefined }; }
      if (r < 0.72) { const op = chon(["==", "!=", "<", "<=", ">", ">="]), [lv2, lt2] = chon(LIT); return { t: "@ " + op + " " + lt2, f: (c) => cmp(c.v, lv2, op) }; }
      const k = chon(["a", "b", "c"]), op = chon(["==", "!=", "<", "<=", ">", ">="]), [lv, lt] = chon(LIT);
      return { t: "@." + k + " " + op + " " + lt, f: (c) => cmp(giaTriTai(c, k), lv, op) };
    }
    let soCa = 0, lech = 0, loiCa = "";
    const nutGoc = (v) => ({ v, p: [] });
    for (let i = 0; i < 700; i++) {
      const goc = sinhGiaTri(4);
      let t = "$", cur = [nutGoc(goc)];
      const nDoan = 1 + Math.floor(ngauNhien() * 4);
      const hong = false;
      for (let d = 0; d < nDoan && !hong; d++) {
        const dn = sinhDoan();
        t += dn.t;
        cur = [].concat(...cur.map((n) => dn.f(n)));
      }
      if (hong) continue;
      let kq;
      try { kq = P.chay(goc, t, 100000); } catch (e) { lech++; loiCa = t + " NEM " + e.message; if (lech > 3) break; continue; }
      soCa++;
      const a = J(kq.map((r) => [r.v, r.duong])), b = J(cur.map((r) => [r.v, r.p]));
      if (a !== b) { lech++; if (lech <= 3) loiCa = t + " tren " + J(goc).slice(0, 80) + "\n   cai dat: " + a.slice(0, 120) + "\n   tham chieu: " + b.slice(0, 120); }
    }
    kiem("fuzz · " + soCa + " truy van ngau nhien: ket qua + duong dan KHOP bo danh gia tham chieu", lech === 0 && soCa >= 600, loiCa || (soCa + " ca"));
  }
  kiem("jsonpath · bieu thuc loc 60.000 ve noi || -> LoiJsonPath tieng Viet, khong RangeError tran", (() => {
    const q = "$[?" + Array(60000).fill("@.a==1").join(" || ") + "]";
    try { P.chay([{ a: 1 }], q); return false; } catch (e) { return !(e instanceof RangeError) && /quá dài|lồng|nặng|sâu/.test(String(e.thongBao || e.message)); }
  })());
  /* khong co bieu thuc nao trong bang bi cat vo ly / fuzz khong nem */
  kiem("jsonpath · truyVan cu (bao boc) van tra {d, v}", (() => { const T = MT.T; const r = T.truyVan({ a: [1, 2] }, "$.a[1]"); return r.length === 1 && r[0].d === "$.a[1]" && r[0].v === 2; })());
};
