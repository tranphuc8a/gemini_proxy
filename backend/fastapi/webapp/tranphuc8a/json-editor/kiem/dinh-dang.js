/* kiem/dinh-dang.js — assets/dinh-dang.js: thut le, dong / go chuoi, giai chuoi long. */
"use strict";

module.exports = function (C) {
  const kiem = C.kiem, nhom = C.nhom;
  const MT = C.taoMoiTruong();
  const D = MT.JE.dinhDang;
  if (!kiem("dinh-dang · nap xong, co JE.dinhDang", !!D && typeof D.dongChuoi === "function")) return;
  const BS = String.fromCharCode(92);
  const J = (x) => JSON.stringify(x);

  nhom("dinh-dang · thut le");
  kiem("thutTu · 2 / 4 / tab / mac dinh", D.thutTu("2") === 2 && D.thutTu("4") === 4 && D.thutTu("tab") === "\t" && D.thutTu("\t") === "\t" && D.thutTu(undefined) === 2 && D.thutTu("x") === 2 && D.thutTu(4) === 4);
  const v = { a: [1, { b: 2 }], c: "d" };
  kiem("thut 2/4/tab · JSON.stringify theo thutTu doc lai bang parse cho dung gia tri", [2, 4, "\t"].every((t) => J(JSON.parse(JSON.stringify(v, null, D.thutTu(t === "\t" ? "tab" : t)))) === J(v)));
  kiem("thut tab · moi cap thut dung mot ky tu tab", JSON.stringify(v, null, D.thutTu("tab")).split("\n")[1].startsWith("\t\"a\""));
  kiem("donViThut · nhan lai kieu thut do thutTu tao ra (4 / tab / 2)", [["4", "    "], ["tab", "\t"], ["2", "  "]].every(([k, u]) => MT.T.donViThut(JSON.stringify(v, null, D.thutTu(k))) === u));

  nhom("dinh-dang · dong chuoi / go chuoi");
  kiem("dongChuoi · thoat nhay, \\ , xuong dong, tab, dieu khien, emoji, tieng Viet", D.dongChuoi('a"b' + BS + "c\nd\te\u0001é💡") === '"a' + BS + '"b' + BS + BS + "c" + BS + "nd" + BS + "te" + BS + 'u0001é💡"');
  kiem("goChuoi · lop ngoai cung cua chuoi JSON", J(D.goChuoi('"{' + BS + '"a' + BS + '":1}"')) === J({ ok: true, ketQua: '{"a":1}' }));
  kiem("goChuoi · noi dung thieu nhay ngoai (chep tu log): {\\\"a\\\":1}", J(D.goChuoi("{" + BS + '"a' + BS + '":1}')) === J({ ok: true, ketQua: '{"a":1}' }));
  kiem("goChuoi · JSON object that (khong phai chuoi) -> bao, khong doi", (() => { const r = D.goChuoi('{"a":1}'); return !r.ok && /không phải một chuỗi|không gỡ/i.test(r.loi); })());
  kiem("goChuoi · so / null -> bao khong co lop de go", !D.goChuoi("5").ok && !D.goChuoi("null").ok);
  kiem("goChuoi · rong -> bao", !D.goChuoi("   ").ok);
  kiem("goChuoi · nhay kep tho chua thoat o giua: khong doan (bao)", !D.goChuoi('a"b').ok);
  kiem("goChuoi · \\u thoat hop le", D.goChuoi('"' + BS + 'u00e9"').ketQua === "é");
  kiem("goChuoi · noi dung chuoi sai thoat (\\x) -> bao", !D.goChuoi('"' + BS + 'x41"').ok);
  /* doi chieu: dong roi go = ban goc, tren 800 chuoi ngau nhien tu bang ky tu kho */
  {
    const ngau = C.taoNgauNhien(9191);
    const BANG = ['"', BS, "\n", "\t", "\r", "a", "b", " ", "é", "💡", " ", "\u0000", "\u001f", "/", "{", "}", "[", "]", ":", ","];
    let lech = 0, mau = "", lech2 = 0;
    for (let i = 0; i < 800; i++) {
      let s = "";
      const n = Math.floor(ngau() * 14);
      for (let k = 0; k < n; k++) s += BANG[Math.floor(ngau() * BANG.length) % BANG.length];
      const d = D.dongChuoi(s);
      let vong = null;
      try { vong = JSON.parse(d); } catch (e) { vong = undefined; }
      const r = D.goChuoi(d);
      /* chuoi MOT KY TU duy nhat la \ hoac " dung tranh loi V8 Node v24: doi chieu tu van ban goc, khong qua vong stringify→parse cua chinh no */
      const mong = s;
      if (!r.ok || r.ketQua !== mong) { lech++; if (!mau) mau = J(s) + " → " + J(d) + " → " + J(r); }
      if (vong !== undefined && vong !== mong && s.length !== 1) lech2++;
      /* dong hai lop roi go hai lan */
      const r2 = D.goChuoi(D.dongChuoi(d));
      if (!r2.ok || r2.ketQua !== d) { lech++; if (!mau) mau = "2 lop: " + J(s); }
      const r3 = r2.ok ? D.goChuoi(r2.ketQua) : r2;
      if (!r3.ok || r3.ketQua !== mong) { lech++; if (!mau) mau = "go 2 lan: " + J(s); }
    }
    kiem("fuzz · 800 chuoi kho: dong roi go = goc; dong hai lop roi go hai lan = goc", lech === 0, mau);
    kiem("fuzz · JSON.parse(dongChuoi(s)) === s (tru chuoi 1 ky tu: loi V8)", lech2 === 0, String(lech2));
  }

  nhom("dinh-dang · chuoi long");
  kiem("giaiChuoiLong · object / mang trong chuoi", J(D.giaiChuoiLong('{"a":[1,2]}')) === '{"a":[1,2]}' && J(D.giaiChuoiLong(' [1, 2] ')) === "[1,2]");
  kiem("giaiChuoiLong · chuoi thuong / so / null / JSON hong / khong phai chuoi -> undefined", [D.giaiChuoiLong("abc"), D.giaiChuoiLong("5"), D.giaiChuoiLong("null"), D.giaiChuoiLong("{a:1}"), D.giaiChuoiLong(5), D.giaiChuoiLong("{")].every((x) => x === undefined));
  kiem("dongGoiLong · nen mac dinh, thut khi yeu cau", D.dongGoiLong({ a: [1] }) === '{"a":[1]}' && D.dongGoiLong({ a: 1 }, 2) === '{\n  "a": 1\n}');
  kiem("dong goi long roi giai = goc (800 gia tri)", (() => { const ngau = C.taoNgauNhien(55); let lech = 0; for (let i = 0; i < 800; i++) { const g = ngau() < 0.5 ? [Math.floor(ngau() * 9), "x" + i, { k: i % 2 === 0 }] : { a: i, b: [null, "q\"w" + BS], c: {} }; const r = D.giaiChuoiLong(D.dongGoiLong(g)); if (J(r) !== J(g)) lech++; } return lech === 0; })());
};
