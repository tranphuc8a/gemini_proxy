/* kiem/vi-tri.js — assets/vi-tri.js: timViTri doi chieu JSON.parse(lat cat) tren moi duong dan cua 50 JSON
   ngau nhien (khoa co " \ unicode __proto__), khoa trung lay cai cuoi, timNhieuViTri == timViTri, duongTaiViTri,
   quet khoi (dem ngoac, chia lat == quet mot lan, JSON hong khong nem loi), loiNhe, hieu nang 10 MB. */
"use strict";

module.exports = function (C) {
  const kiem = C.kiem, bang = C.bang;
  const MT = C.taoMoiTruong();
  const V = MT.JE && MT.JE.viTri;
  if (!kiem("vi-tri · nap xong, co JE.viTri", !!V && typeof V.timViTri === "function")) return;
  const chung = MT.JE.chung;
  const SLACK = Number(process.env.JE_PERF_SLACK || 3);

  const ds = C.dsScript();
  kiem("index.html · vi-tri.js nap sau je-chung.js, truoc json-editor.js",
    ds.indexOf("assets/vi-tri.js") > ds.indexOf("assets/je-chung.js") && ds.indexOf("assets/vi-tri.js") < ds.indexOf("assets/json-editor.js"), ds.join(", "));

  const hasOwn = Object.prototype.hasOwnProperty;
  const layTai = (goc, duong) => {
    let v = goc;
    for (const k of duong) {
      if (v === null || typeof v !== "object" || !hasOwn.call(v, k)) return undefined;
      v = v[k];
    }
    return v;
  };

  /* ---- du lieu ngau nhien ---- */
  const rnd = C.taoNgauNhien(20261024);
  const chon = (a) => a[Math.floor(rnd() * a.length)];
  const MANH = ["a", "b", "key", "", " ", "x y", 'q"uo', "back\\slash", "tab\t", "new\nline", "é", "日本", "😀", " ", "__proto__", "constructor",
    "toString", "0", "1", "10", "a.b", "a/b", "~", "{", "}", "[", "]", ",", ":", "\\u0041", "A", "'"];
  const khoaNgau = () => { let s = ""; for (let i = Math.floor(rnd() * 3); i > 0; i--) s += chon(MANH); return s; };
  const SO = [0, 1, -1, 42, 3.14, -2.5e-7, 1e21, 123456789];
  function giaTriNgau(sau) {
    const r = rnd();
    if (sau <= 0 || r < 0.4) {
      const k = rnd();
      return k < 0.4 ? khoaNgau() : k < 0.7 ? chon(SO) : k < 0.8 ? true : k < 0.9 ? false : null;
    }
    if (r < 0.7) { const m = []; for (let i = Math.floor(rnd() * 7); i > 0; i--) m.push(giaTriNgau(sau - 1)); return m; }
    const o = {};
    for (let i = Math.floor(rnd() * 7); i > 0; i--) Object.defineProperty(o, khoaNgau(), { value: giaTriNgau(sau - 1), enumerable: true, writable: true, configurable: true });
    return o;
  }
  /** Moi duong dan (mang khoa/chi so) cua `v`, ke ca goc; lap. */
  function moiDuong(v) {
    const ra = [], ngan = [[v, []]];
    while (ngan.length) {
      const [x, d] = ngan.pop();
      ra.push(d);
      if (Array.isArray(x)) for (let i = x.length - 1; i >= 0; i--) ngan.push([x[i], d.concat([i])]);
      else if (x !== null && typeof x === "object") { const ks = Object.keys(x); for (let i = ks.length - 1; i >= 0; i--) ngan.push([x[ks[i]], d.concat([ks[i]])]); }
    }
    return ra;
  }
  const KIEU_THUT = [0, 2, 4, "\t"];
  const bien = (s) => s.replace(/([,:\[{])/g, (m) => (rnd() < 0.15 ? m + " \n\t " : m));   /* them khoang trang le: van la JSON hop le */
  function taoVanBan(v) {
    let s = JSON.stringify(v, null, chon(KIEU_THUT));
    if (rnd() < 0.3) s = "\n  " + s + "  \n";
    return s;
  }

  const docs = [];
  for (let i = 0; i < 50; i++) { const v = giaTriNgau(5); docs.push({ v, s: taoVanBan(v) }); }
  docs.push({ v: [], s: "[]" }, { v: {}, s: " {} " }, { v: "x", s: '"x"' }, { v: 5, s: "5" }, { v: null, s: "null" });

  /* ---------------- chiSoDong / dongCuaViTri ---------------- */
  {
    let dung = true;
    for (const d of docs.slice(0, 20)) {
      const cs = V.chiSoDong(d.s);
      const lines = d.s.split("\n");
      if (cs.length !== lines.length) { dung = false; break; }
      let off = 0;
      for (let i = 0; i < lines.length; i++) { if (cs[i] !== off) dung = false; off += lines[i].length + 1; }
      for (let p = 0; p <= d.s.length; p += 1 + Math.floor(rnd() * 7)) {
        const dem = (d.s.slice(0, p).match(/\n/g) || []).length + 1;
        if (V.dongCuaViTri(cs, p) !== dem) dung = false;
      }
    }
    kiem("chiSoDong / dongCuaViTri · khop cach dem doc lap o moi cach thut le va moi vi tri", dung);
    kiem("chiSoDong · rong → 1 dong; chi xuong dong → 2 dong", V.chiSoDong("").length === 1 && V.chiSoDong("\n").length === 2 && V.dongCuaViTri(V.chiSoDong("a\nb"), 2) === 2);
  }

  /* ---------------- timViTri doi chieu JSON.parse ---------------- */
  {
    let soDuong = 0, sai = [];
    for (const d of docs) {
      for (const duong of moiDuong(d.v)) {
        soDuong++;
        const vt = V.timViTri(d.s, duong);
        if (!vt) { sai.push("khong tim thay " + JSON.stringify(duong)); continue; }
        let ok = false;
        try { ok = chung.bangNhauSau(JSON.parse(d.s.slice(vt.bd, vt.kt)), layTai(d.v, duong)); } catch (e) { /* ok = false */ }
        if (duong.length) {
          const k = duong[duong.length - 1];
          if (typeof k === "string") ok = ok && vt.khoaBd >= 0 && JSON.parse(d.s.slice(vt.khoaBd, vt.khoaKt)) === k;
          else ok = ok && vt.khoaBd === -1;
        }
        if (!ok) sai.push(JSON.stringify(duong) + " @" + vt.bd + "-" + vt.kt);
      }
    }
    kiem("timViTri · JSON.parse(van ban[bd,kt)) == gia tri o duong dan, tren MOI duong dan cua 55 JSON ngau nhien (" + soDuong + " duong, khoa co \" \\ unicode __proto__)",
      sai.length === 0 && soDuong > 500, sai.slice(0, 3).join(" | ") + " (" + soDuong + " duong)");
  }
  {
    const s = '{ "a": [10, {"b": "x"}], "k\\"q": 5, "\\u0061b": 6, "": 7, "__proto__": {"z": 1} }';
    const cat = (d) => { const v = V.timViTri(s, d); return v ? s.slice(v.bd, v.kt) : null; };
    kiem("timViTri · khoa co \\\" va \\uXXXX duoc giai ma khi so khop", cat(['k"q']) === "5" && cat(["ab"]) === "6" && cat(["a", 1, "b"]) === '"x"');
    kiem("timViTri · khoa rong va __proto__ la khoa thuong", cat([""]) === "7" && cat(["__proto__", "z"]) === "1" && cat(["__proto__"]) === '{"z": 1}');
    kiem("timViTri · doan la chuoi so khop chi so mang; khong khop thi null", cat(["a", "0"]) === "10" && cat(["a", "2"]) === null && cat(["a", "x"]) === null && cat(["nope"]) === null);
    kiem("timViTri · duong dan di xuyen gia tri nguyen thuy → null; duong rong = ca van ban",
      cat(["a", 0, "x"]) === null && cat([]) === s.trim());
    const dup = '{"a": 1, "b": {"c": 1}, "a": {"c": 2}, "b": 3}';
    const cd = (d) => { const v = V.timViTri(dup, d); return v ? dup.slice(v.bd, v.kt) : null; };
    kiem("timViTri · khoa TRUNG: lay gia tri CUOI (khop JSON.parse)", cd(["a"]) === '{"c": 2}' && cd(["a", "c"]) === "2" && cd(["b"]) === "3" && cd(["b", "c"]) === null &&
      JSON.parse(dup).a.c === 2);
    const vt = V.timViTri(' {"k": 12 } ', ["k"]);
    kiem("timViTri · khoaBd/khoaKt gom ca dau nhay; bd/kt chi gom gia tri (khong khoang trang)", vt && ' {"k": 12 } '.slice(vt.khoaBd, vt.khoaKt) === '"k"' && ' {"k": 12 } '.slice(vt.bd, vt.kt) === "12");
    kiem("timViTri · van ban rong / chi khoang trang / hong → null, khong nem",
      V.timViTri("", []) === null && V.timViTri("  ", ["a"]) === null && V.timViTri("{", ["a"]) === null && V.timViTri('{"a":', ["a"]) === null && V.timViTri('{"a" 1}', ["a"]) === null);
    /* JSON dang go do (gia tri cuoi chua dong): van tim duoc khoa / phan tu can tim, bd/kt keo toi het van ban (bo khoang trang cuoi) */
    const dd = '{"a": [1, {"b": "xy"}, 3';
    const vd = (d) => { const v = V.timViTri(dd, d); return v ? dd.slice(v.bd, v.kt) : null; };
    kiem("timViTri · JSON chua dong: tim duoc xuyen qua khoi chua dong", vd(["a", 0]) === "1" && vd(["a", 1, "b"]) === '"xy"' && vd(["a", 2]) === "3" && vd(["a"]) === '[1, {"b": "xy"}, 3' && vd([]) === dd);
    kiem("timViTri · JSON chua dong: chuoi chua dong → bd..het van ban; thieu gia tri (sau dau hai cham) → null",
      (function () { const t = '{"k": "chua'; const v = V.timViTri(t, ["k"]); return !!v && t.slice(v.bd, v.kt) === '"chua'; })() && V.timViTri('{"k": }', ["k"]) === null && V.timViTri('{"k": ,"z":1}', ["z"]) === null);
  }

  /* ---------------- timNhieuViTri == timViTri ---------------- */
  {
    let sai = [], tong = 0;
    for (const d of docs) {
      const dsd = moiDuong(d.v);
      const map = V.timNhieuViTri(d.s, dsd);
      for (const duong of dsd) {
        tong++;
        const a = V.timViTri(d.s, duong), b = map.get(JSON.stringify(duong));
        if (!a || !b || a.bd !== b.bd || a.kt !== b.kt || a.khoaBd !== b.khoaBd || a.khoaKt !== b.khoaKt) sai.push(JSON.stringify(duong));
      }
    }
    kiem("timNhieuViTri · cung ket qua voi timViTri tren MOI duong dan (" + tong + "), mot luot quet cho ca tap", sai.length === 0, sai.slice(0, 3).join(" | "));
    const s = '{"a": 1, "a": {"x": 2}, "b": [0, 1]}';
    const m = V.timNhieuViTri(s, [["a", "x"], ["a"], ["b", 1], ["khong", "co"], []]);
    const cat = (d) => { const v = m.get(JSON.stringify(d)); return v ? s.slice(v.bd, v.kt) : null; };
    kiem("timNhieuViTri · khoa trung lay cai cuoi; duong khong co thi vang mat; duong rong = goc",
      cat(["a", "x"]) === "2" && cat(["a"]) === '{"x": 2}' && cat(["b", 1]) === "1" && cat(["khong", "co"]) === null && cat([]) === s);
    const s2 = '{"a": {"p": 1}, "a": {"q": 2}}';
    const m2 = V.timNhieuViTri(s2, [["a", "p"], ["a", "q"]]);
    kiem("timNhieuViTri · khoa trung: dich o ban TRUOC bi xoa khi ban sau thay the", !m2.has(JSON.stringify(["a", "p"])) && m2.has(JSON.stringify(["a", "q"])));
    kiem("timNhieuViTri · tap rong / van ban rong khong nem; duong dai hon TRAN_DUONG bi bo qua",
      V.timNhieuViTri("{}", []).size === 0 && V.timNhieuViTri("", [["a"]]).size === 0 && V.timNhieuViTri('{"a":1}', [new Array(V.TRAN_DUONG + 5).fill("a")]).size === 0);
  }

  /* ---------------- duongTaiViTri ---------------- */
  {
    const s = '{\n  "ten": "Phuc",\n  "ds": [10, {"x": true}],\n  "long": {"sau": null}\n}';
    const tai = (sub, lech) => {
      const i = s.indexOf(sub) + (lech || 0);
      return V.duongTaiViTri(s, i);
    };
    const kq = (r) => r && JSON.stringify(r.duong);
    kiem("duongTaiViTri · con tro trong chuoi gia tri → duong dan cua chuoi", kq(tai("Phuc", 1)) === '["ten"]' && s.slice(tai("Phuc", 1).vungGiaTri.bd, tai("Phuc", 1).vungGiaTri.kt) === '"Phuc"');
    kiem("duongTaiViTri · con tro trong khoa → duong dan toi khoa, trongKhoa = true", kq(tai('"ten"', 2)) === '["ten"]' && tai('"ten"', 2).trongKhoa === true);
    kiem("duongTaiViTri · phan tu mang long nhau", kq(tai("true")) === '["ds",1,"x"]' && kq(tai("10")) === '["ds",0]');
    kiem("duongTaiViTri · khoang trang giua cac khoa → duong dan cua khoi chua", kq(V.duongTaiViTri(s, 1)) === "[]" && kq(V.duongTaiViTri(s, s.indexOf('"ds"') - 2)) === "[]");
    kiem("duongTaiViTri · tren dau { cua object con → duong dan cua object con; ngay sau } → cha",
      kq(tai('{"sau"')) === '["long"]' && kq(V.duongTaiViTri(s, s.indexOf('{"sau"') + '{"sau": null}'.length)) === "[]");
    kiem("duongTaiViTri · van ban rong / con tro truoc token dau → null; hong khong nem",
      V.duongTaiViTri("", 0) === null && V.duongTaiViTri("   {}", 1) === null && V.duongTaiViTri('{"a": [1, ', 8) !== undefined);
    kiem("duongTaiViTri · con tro cuoi so (ngay sau 10) van thuoc so do", kq(V.duongTaiViTri(s, s.indexOf("10") + 2)) === '["ds",0]');
  }

  /* ---------------- quet khoi ---------------- */
  function quetMot(s, ngan) {
    const b = V.taoBoQuetKhoi();
    let xong = false, vong = 0;
    while (!xong && vong++ < 1e7) xong = b.chay(s, ngan);
    return { b, kq: b.ketQua() };
  }
  const tomKq = (kq) => JSON.stringify({
    n: kq.soKhoi, d: kq.soDong, dm: Array.from(kq.dongMo), dd: Array.from(kq.dongDong), vm: Array.from(kq.viTriMo), vd: Array.from(kq.viTriDong),
    l: Array.from(kq.loai), sa: Array.from(kq.sau), ch: Array.from(kq.cha), sc: Array.from(kq.soCon), kb: Array.from(kq.khoaBd), kk: Array.from(kq.khoaKt),
    ci: Array.from(kq.chiSo), cd: Array.from(kq.khoiCuaDong)
  });
  {
    let sai = [], tongKhoi = 0;
    for (const d of docs) {
      const { b, kq } = quetMot(d.s, 0);
      const duongKhoi = moiDuong(d.v).filter((p) => { const x = layTai(d.v, p); return x !== null && typeof x === "object"; });
      tongKhoi += kq.soKhoi;
      if (kq.soKhoi !== duongKhoi.length) { sai.push("so khoi " + kq.soKhoi + " vs " + duongKhoi.length); continue; }
      const cs = V.chiSoDong(d.s);
      for (let k = 0; k < kq.soKhoi; k++) {
        const p = kq.duongCuaKhoi(k), x = layTai(d.v, p);
        const vt = V.timViTri(d.s, p);
        const hopLe = Array.isArray(x) ? kq.loai[k] === 2 : x && typeof x === "object" && kq.loai[k] === 1;
        const soCon = Array.isArray(x) ? x.length : Object.keys(x || {}).length;
        if (!(JSON.stringify(p) === JSON.stringify(duongKhoi[k]) && hopLe && kq.soCon[k] === soCon && vt && kq.viTriMo[k] === vt.bd && kq.viTriDong[k] === vt.kt - 1 &&
          kq.dongMo[k] === V.dongCuaViTri(cs, vt.bd) && kq.dongDong[k] === V.dongCuaViTri(cs, vt.kt - 1) && kq.sau[k] === p.length)) {
          sai.push("khoi " + k + " " + JSON.stringify(p)); break;
        }
        if (kq.cha[k] >= 0 && JSON.stringify(kq.duongCuaKhoi(kq.cha[k])) !== JSON.stringify(p.slice(0, -1)) && !(p.length > 1)) sai.push("cha " + k);
      }
      if (kq.soDong !== cs.length) sai.push("soDong");
    }
    kiem("quet khoi · moi khoi khop mo hinh: duong dan, loai, soCon, vi tri ngoac mo/dong, dong mo/dong, do sau (" + tongKhoi + " khoi / 55 JSON)",
      sai.length === 0 && tongKhoi > 100, sai.slice(0, 3).join(" | "));
  }
  {
    let sai = [];
    for (const d of docs.slice(0, 25)) {
      const toan = tomKq(quetMot(d.s, 0).kq);
      for (const ngan of [1, 2, 7, 33, 1000]) if (tomKq(quetMot(d.s, ngan).kq) !== toan) sai.push(ngan + ":" + d.s.length);
    }
    kiem("quet khoi · chia lat (1, 2, 7, 33, 1000 ky tu / lat) cho ket qua GIONG HET quet mot lan", sai.length === 0, sai.slice(0, 3).join(" | "));
    const b = V.taoBoQuetKhoi();
    const xong1 = b.chay('{"a": [1,2,3]}', 3);
    kiem("quet khoi · lat dau chua het van ban thi tra false; chay tiep den het thi true", xong1 === false && (function () { let x = false; for (let i = 0; i < 50 && !x; i++) x = b.chay('{"a": [1,2,3]}', 3); return x; })());
  }
  {
    const s = '{\n  "a": [\n    1,\n    2\n  ],\n  "b": {"c": []},\n  "d": 5\n}\n';
    const { kq } = quetMot(s, 0);
    kiem("quet khoi · khoiCuaDong: khoi NHIEU dong gan o dong mo; khoi mot dong thi -1",
      kq.soKhoi === 4 && kq.khoiCuaDong[0] === 0 && kq.khoiCuaDong[1] === 1 && kq.khoiCuaDong[5] === -1 && kq.soDong === 9, JSON.stringify(Array.from(kq.khoiCuaDong)));
    kiem("quet khoi · dongMo/dongDong cua khoi mang 'a' = 2..5; soCon = 2", kq.dongMo[1] === 2 && kq.dongDong[1] === 5 && kq.soCon[1] === 2 && kq.soCon[0] === 3 && JSON.stringify(kq.duongCuaKhoi(1)) === '["a"]');
  }
  {
    /* JSON hong: khong nem; ngoac lech bo qua; khoi chua dong = -1 */
    let nem = null;
    const hong = ['{"a": [1, 2', '{"a": 1}}', '[1, 2]]]', '{"a": ]', '[}', '{"a": {"b": [}', '"chua dong', '{"k" "v"}', ']{[}', '{{{{', '}}}}', '{"a":1,,}', '1 2 3'];
    let ketqua = [];
    for (const h of hong) {
      try { ketqua.push(quetMot(h, 0).kq.soKhoi); V.timViTri(h, ["a", "b"]); V.timNhieuViTri(h, [["a"], ["a", 0]]); V.duongTaiViTri(h, 3); V.loiNhe(h); } catch (e) { nem = h + ": " + e.message; }
    }
    kiem("JSON hong · quet khoi / timViTri / timNhieuViTri / duongTaiViTri / loiNhe KHONG nem loi (13 ca)", nem === null, nem || ketqua.join(","));
    const cl = quetMot('{"a": [1, 2', 0).kq;
    kiem("quet khoi · khoi chua dong den cuoi: viTriDong = -1, dongDong = tong so dong, soCon dem duoc",
      cl.soKhoi === 2 && cl.viTriDong[0] === -1 && cl.viTriDong[1] === -1 && cl.dongDong[0] === cl.soDong && cl.soCon[1] === 2 && cl.soCon[0] === 1);
    const th = quetMot('{"a": 1}}', 0).kq;
    kiem("quet khoi · ngoac dong thua bi bo qua, khong dong nham khoi", th.soKhoi === 1 && th.viTriDong[0] === 7);
    const le = quetMot('{"a": [1, }', 0).kq;
    kiem("quet khoi · '}' khi dang trong '[': dong object, mang bo do (-1)", le.soKhoi === 2 && le.viTriDong[0] === 10 && le.viTriDong[1] === -1);
    /* fuzz: bien dang ngau nhien JSON hop le */
    let nem2 = null, soCa = 0;
    for (let i = 0; i < 400 && nem2 === null; i++) {
      let s = chon(docs).s;
      for (let m = 1 + Math.floor(rnd() * 3); m > 0; m--) {
        const p = Math.floor(rnd() * (s.length + 1));
        const kieu = rnd();
        s = kieu < 0.4 ? s.slice(0, p) + s.slice(p + 1 + Math.floor(rnd() * 3)) : kieu < 0.8 ? s.slice(0, p) + chon(['"', "{", "}", "[", "]", ",", ":", "\\", "\n", "x"]) + s.slice(p) : s.slice(0, p);
      }
      soCa++;
      try {
        quetMot(s, 5).kq; V.timViTri(s, ["a", 0, "b"]); V.timNhieuViTri(s, [["a"], [0], ["a", 0, "b"], []]);
        V.duongTaiViTri(s, Math.floor(rnd() * (s.length + 1))); V.loiNhe(s); V.chiSoDong(s);
      } catch (e) { nem2 = JSON.stringify(s.slice(0, 40)) + ": " + e.message; }
    }
    kiem("JSON hong · fuzz " + soCa + " ban bien dang (xoa / chen / cat) khong ham nao nem loi", nem2 === null, nem2);
  }

  /* ---------------- loiNhe ---------------- */
  {
    const dau = (s, ds) => ds.map((x) => s.slice(x.bd, x.kt)).join("|");
    let s = '{"a": 1, "b": {"x": 1, "x": 2}, "a": 3}';
    let r = V.loiNhe(s).filter((x) => x.loai === "khoa-trung");
    kiem("loiNhe · khoa trung o object cha va object con: bao token cua khoa LAP LAI", r.length === 2 && dau(s, r) === '"x"|"a"' && /Khoá trùng/.test(r[0].thongBao), JSON.stringify(r));
    s = '[{"a":1},{"a":2}, {"a":1,"b":2}]';
    kiem("loiNhe · cung ten khoa o cac object KHAC nhau khong phai trung", V.loiNhe(s).length === 0);
    s = '{"a": 1, "\\u0061": 2}';
    kiem("loiNhe · khoa trung sau khi giai ma (\\u0061 = a)", V.loiNhe(s).filter((x) => x.loai === "khoa-trung").length === 1);
    r = V.loiNhe('[12345678901234567890, 9007199254740993, 0.1, 123456789012345, 1.5e300, 3.141592653589793, 1e400, -12345678901234567890]');
    const so = r.filter((x) => x.loai === "so-lam-tron");
    kiem("loiNhe · so > 2^53 / mat chu so / vuot pham vi duoc bao; 0.1, 15 chu so, pi, 1.5e300 thi khong",
      so.length === 4 && so.every((x) => /Số/.test(x.thongBao)), so.map((x) => x.thongBao).join(" ; "));
    kiem("loiNhe · so 1.10 va 100 (mat so 0 cuoi) khong bi coi la lam tron", V.loiNhe("[1.10, 100, 1000000000000000000000, 0.30000000000000004]").filter((x) => x.loai === "so-lam-tron").length === 0 ||
      V.loiNhe("[1.10, 100]").length === 0);
    kiem("loiNhe · tran muc ket qua", V.loiNhe(JSON.stringify(new Array(50).fill(0).map(() => ({ a: 1 }))).replace(/\{"a":1\}/g, '{"a":1,"a":2}'), 10).length === 10);
  }

  /* ---------------- hieu nang 10 MB ---------------- */
  {
    const mau = [];
    for (let i = 0; i < 38000; i++) mau.push({ id: i, name: "Nguoi " + i, tags: ["a", "b", "c"], addr: { city: "Ha Noi", geo: [i, i + 1], note: "x".repeat(40) }, ok: i % 2 === 0 });
    const s = JSON.stringify(mau, null, 2);
    /* Do chuan CUNG may, CUNG luc: thoi gian mot vong charCodeAt tren chinh chuoi nay. May dang ban (nhieu tien trinh kiem song song) thi
       chuan cung cham theo, nen gioi han = max(thiet ke x SLACK, 12 x chuan) — khong flaky, van bat duoc thuat toan O(n²). */
    const chuan = C.hieuChuan(() => { let c = 0; for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) === 10) c++; return c; });
    const gh = (thietKe) => Math.round(Math.max(thietKe * SLACK, 12 * chuan));
    console.log("        · do chuan (1 vong charCodeAt " + (s.length / 1048576).toFixed(1) + " MB) = " + Math.round(chuan) + " ms");
    /* Moi phep do chay 3 lan lay NHO NHAT (tru nhieu do may ban). */
    let kq = null;
    const ms = Math.round(C.hieuChuan(() => { kq = quetMot(s, 2000000).kq; }));
    kiem("hieu nang · quet khoi " + (s.length / 1048576).toFixed(1) + " MB (chia lat 2 M ky tu) " + ms + " ms < " + gh(300) + " ms (" + kq.soKhoi + " khoi)", ms < gh(300) && kq.soKhoi === 38000 * 4 + 1);
    let vt = null;
    const ms1 = Math.round(C.hieuChuan(() => { vt = V.timViTri(s, [37999, "addr", "geo", 1]); }));
    kiem("hieu nang · timViTri o cuoi " + (s.length / 1048576).toFixed(1) + " MB: " + ms1 + " ms < " + gh(150) + " ms", vt && s.slice(vt.bd, vt.kt) === "38000" && ms1 < gh(150));
    let cs = null;
    const ms2 = Math.round(C.hieuChuan(() => { cs = V.chiSoDong(s); }));
    kiem("hieu nang · chiSoDong " + cs.length + " dong: " + ms2 + " ms < " + gh(150) + " ms", cs.length > 600000 && ms2 < gh(150));
    const dsd = [];
    for (let i = 0; i < 3000; i++) dsd.push([i * 12, "addr", "city"]);
    let mp = null;
    const ms3 = Math.round(C.hieuChuan(() => { mp = V.timNhieuViTri(s, dsd); }));
    kiem("hieu nang · timNhieuViTri 3000 dich trong " + (s.length / 1048576).toFixed(1) + " MB: " + ms3 + " ms < " + gh(400) + " ms", mp.size === 3000 && ms3 < gh(400));
  }
};
