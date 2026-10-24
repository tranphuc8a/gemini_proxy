/* kiem/schema-suy.js — assets/schema-suy.js (viec 31): SUY schema tu du lieu.
   Bat bien: kiem(duLieu, suySchema(duLieu)).hopLe === true (format o muc 'loi') cho 150 JSON ngau nhien (moi hinh dang: long sau, mang hon hop,
   khoa la, rong, Unicode, so lon…), moi tuy chon (draft 07 / 2020-12, chat, batBuoc 'khong', dongKhoaThem, dinhDang), ca mau 1 MB; gop nhieu mau;
   format CHI gan khi MOI chuoi khop; enum chi khi gia tri lap lai; cung dau vao -> cung dau ra; suy -> sinh -> kiem (vong tron); benh ly (long 20 000 cap). */
"use strict";

/** JSON ngau nhien (tat dinh theo `rd`): moi kieu, long toi `sau`, khoa la, chuoi Unicode / dinh dang. */
function jsonNgauNhien(rd, sau) {
  const chon = (a) => a[Math.floor(rd() * a.length)];
  const so = (a, b) => a + Math.floor(rd() * (b - a + 1));
  const KHOA = ["a", "b", "ten", "id", "x y", "", "__proto__", "constructor", "é", "k\"q", "a/b", "a~b", "0", "toString", "😀"];
  const CHUOI = ["", "a", "xin chào", "😀😀", "2024-02-29", "2024-02-29T10:00:00Z", "12:30:45Z", "a@b.co", "123e4567-e89b-12d3-a456-426614174000", "192.168.0.1", "::1",
    "https://vd.com/x", "mailto:a@b.c", "dòng\nmới", "tab\t", "\\", "\"", "1", "true", "null", "{}"];
  const loai = so(0, sau >= 4 ? 5 : 7);
  switch (loai) {
    case 0: return null;
    case 1: return rd() < 0.5;
    case 2: return so(-50, 1000);
    case 3: return Math.round((rd() - 0.5) * 1e6) / 100;
    case 4: return chon(CHUOI);
    case 5: return chon([0, 1, -1, 1e21, 1.5e-7, 9007199254740991, -0.5, 100]);
    case 6: { const n = so(0, 5), a = []; for (let i = 0; i < n; i++) a.push(jsonNgauNhien(rd, sau + 1)); return a; }
    default: {
      const n = so(0, 5), o = {};
      for (let i = 0; i < n; i++) { const k = chon(KHOA); Object.defineProperty(o, k, { value: jsonNgauNhien(rd, sau + 1), enumerable: true, writable: true, configurable: true }); }
      return o;
    }
  }
}

module.exports = function (C) {
  const kiem = C.kiem, nhom = C.nhom, bang = C.bang;
  const MT = C.taoMoiTruong();
  const JE = MT.JE;
  if (!kiem("schema-suy · nap xong, co JE.schemaSuy (suySchema, suyTuNhieuMau)", !!(JE.schemaSuy && typeof JE.schemaSuy.suySchema === "function" && typeof JE.schemaSuy.suyTuNhieuMau === "function"))) return;
  const SU = JE.schemaSuy, S = JE.schema, SG = JE.schemaSinh, F = JE.schemaFormat;
  const SLACK = Number(process.env.JE_PERF_SLACK || 3);
  const ds = C.dsScript();
  kiem("index.html · schema-suy.js nap sau schema-format.js, schema-sinh.js, truoc chay-nen.js", ds.indexOf("assets/schema-suy.js") > ds.indexOf("assets/schema-format.js") && ds.indexOf("assets/schema-suy.js") < ds.indexOf("assets/chay-nen.js"), ds.join(", "));
  const nguon = require("fs").readFileSync(require("path").join(C.GOC, "assets", "schema-suy.js"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  kiem("schema-suy · module thuan: khong Math.random / Date / performance / document / window / eval", !/Math\.random|\bDate\b|performance|\bdocument\b|\bwindow\b|\beval\s*\(|new\s+Function/.test(nguon));
  const kiemHop = (schema, du, draft) => S.kiem(du, S.bienDich(schema, draft ? { draft } : {}), { format: "loi", toiDa: 5 });
  const ngan = (v) => { let t; try { t = JSON.stringify(v); } catch (e) { t = String(v); } t = t === undefined ? "undefined" : t; return t.length > 100 ? t.slice(0, 98) + "…" : t; };

  /* =========================================================== ca tay: dang schema suy ra */
  nhom("schema-suy · dang schema suy ra (ca tay)");
  const suy = (d, tc) => SU.suySchema(d, tc);
  const bo$ = (s) => { const r = Object.assign({}, s); delete r.$schema; return r; };
  kiem("goc co $schema 2020-12 mac dinh; draft '07' -> $schema draft-07", suy(1).$schema === "https://json-schema.org/draft/2020-12/schema" && suy(1, { draft: "07" }).$schema === "http://json-schema.org/draft-07/schema#");
  kiem("kieu nguyen thuy: null / boolean / integer / number / string", bang([null, true, 3, 1.5, "a"].map((d) => bo$(suy(d))), [{ type: "null" }, { type: "boolean" }, { type: "integer" }, { type: "number" }, { type: "string" }]));
  kiem("object: type + properties (kieu tung khoa) + required = khoa co mat", bang(bo$(suy({ a: 1, b: "x" })), { type: "object", properties: { a: { type: "integer" }, b: { type: "string" } }, required: ["a", "b"] }), ngan(suy({ a: 1, b: "x" })));
  kiem("object rong / mang rong", bang(bo$(suy({})), { type: "object" }) && bang(bo$(suy([])), { type: "array" }));
  kiem("mang dong nhat: items = schema cua phan tu", bang(bo$(suy([1, 2, 3])), { type: "array", items: { type: "integer" } }));
  kiem("mang so lan nguyen + thuc -> number (khong integer)", bang(bo$(suy([1, 2.5])), { type: "array", items: { type: "number" } }));
  kiem("mang object: GOP phan tu — required chi giu khoa co mat o MOI phan tu", bang(bo$(suy([{ a: 1, b: 2 }, { a: 3 }])), { type: "array", items: { type: "object", properties: { a: { type: "integer" }, b: { type: "integer" } }, required: ["a"] } }), ngan(suy([{ a: 1, b: 2 }, { a: 3 }])));
  kiem("mang hon hop kieu nguyen thuy -> items.type la mang kieu", bang(bo$(suy(["a", 1, null])).items, { type: ["null", "integer", "string"] }), ngan(suy(["a", 1, null])));
  kiem("object lan mang o cung vi tri -> anyOf (mang + object)", bang(bo$(suy([{ x: 1 }, [1]])).items, { anyOf: [{ type: "object", properties: { x: { type: "integer" } }, required: ["x"] }, { type: "array", items: { type: "integer" } }] }), ngan(suy([{ x: 1 }, [1]])));
  kiem("nguyen thuy lan object -> anyOf [kieu nguyen thuy, object]", bang(bo$(suy([null, { a: 1 }])).items, { anyOf: [{ type: "null" }, { type: "object", properties: { a: { type: "integer" } }, required: ["a"] }] }), ngan(suy([null, { a: 1 }])));
  kiem("khoa 'null' co mat o object nay khong o object kia -> khong required, kieu giu nguyen", (() => { const s = suy([{ a: 1 }, { a: null }, { b: 2 }]); return bang(s.items.required, undefined) && bang(s.items.properties.a, { type: ["null", "integer"] }); })(), ngan(suy([{ a: 1 }, { a: null }, { b: 2 }])));
  kiem("batBuoc 'khong': khong sinh required", suy({ a: 1 }, { batBuoc: "khong" }).required === undefined);
  kiem("dongKhoaThem: additionalProperties:false o MOI object", (() => { const s = suy({ a: { b: 1 } }, { dongKhoaThem: true }); return s.additionalProperties === false && s.properties.a.additionalProperties === false; })());
  kiem("khoa __proto__ la khoa RIENG cua properties (khong doi prototype) va nam trong required", (() => {
    const d = JSON.parse('{"__proto__": 1, "a": 2}'), s = suy(d), p = s.properties;
    return Object.prototype.hasOwnProperty.call(p, "__proto__") && p["__proto__"].type === "integer" && s.required.indexOf("__proto__") >= 0 && kiemHop(s, d).hopLe; })());

  /* format */
  nhom("schema-suy · format: chi gan khi MOI chuoi o vi tri do khop");
  const fmt = (vals, tc) => suy(vals, tc).items && suy(vals, tc).items.format;
  kiem("moi chuoi la ngay -> format date", fmt(["2024-01-31", "2023-12-01"]) === "date");
  kiem("date-time / time / email / uuid / ipv4 / ipv6 / uri", fmt(["2024-01-01T10:00:00Z"]) === "date-time" && fmt(["10:00:00Z"]) === "time" && fmt(["a@b.co", "x@y.vn"]) === "email" &&
    fmt(["123e4567-e89b-12d3-a456-426614174000"]) === "uuid" && fmt(["10.0.0.1", "8.8.8.8"]) === "ipv4" && fmt(["::1"]) === "ipv6" && fmt(["https://a.b/c", "http://d.e"]) === "uri");
  kiem("MOT chuoi khong khop -> KHONG gan format (ngay + 'hom nay')", fmt(["2024-01-31", "hom nay"]) === undefined);
  kiem("29/02 nam khong nhuan khong phai date -> khong gan", fmt(["2023-02-29"]) === undefined && fmt(["2024-02-29"]) === "date");
  kiem("'key:value' khong phai uri (can '://'): khong gan; chuoi tu do khong gan hostname", fmt(["a:b"]) === undefined && fmt(["abc", "def"]) === undefined);
  kiem("dinhDang:false -> khong bao gio gan format", fmt(["a@b.co"], { dinhDang: false }) === undefined);
  kiem("format chi gan cho vi tri co CHUOI (so / null cung vi tri van giu format cho phan chuoi: kieu ['null','string'] + email)", (() => { const s = suy(["a@b.co", null]); return s.items.format === "email" && bang(s.items.type, ["null", "string"]); })(), ngan(suy(["a@b.co", null])));
  { const d = { ngay: ["2024-01-01", "2024-05-05"], mail: ["a@b.co", "x"], ten: ["a", "b"] }, s = suy(d);
    kiem("moi khoa mot format rieng: ngay -> date, mail (co 'x') -> khong, ten -> khong", s.properties.ngay.items.format === "date" && s.properties.mail.items.format === undefined && s.properties.ten.items.format === undefined, ngan(s)); }
  { const hong = [];
    for (const f of ["date-time", "date", "time", "email", "uuid", "ipv4", "ipv6", "uri"]) for (let i = 0; i < 50; i++) {
      const v = SG.sinhFormat(f, JE.taoRng(f + "x" + i));
      const s = suy([v, SG.sinhFormat(f, JE.taoRng(f + "y" + i))]);
      if (s.items.format && F.kiem(s.items.format, v) !== true) hong.push(f + ":" + v + " -> " + s.items.format);
      if (s.items.format !== f && !(f === "uri" && v.indexOf("://") < 0)) { /* co the nhan nham sang format khac cung khop (vd time) — chi bao khi KHONG co format nao */ if (!s.items.format && f !== "ipv6") hong.push("khong nhan duoc " + f + ": " + v); }
    }
    kiem("suy <-> sinhFormat: 400 chuoi sinh ra theo 8 format deu khop format duoc gan; khong bo sot (tru ipv6 thuan 'xx::')", hong.length === 0, hong.slice(0, 3).join(" | ")); }

  /* chat */
  nhom("schema-suy · chat: min / max, minLength / maxLength, minItems / maxItems, enum nho (chi khi gia tri lap lai)");
  { const s = suy({ n: [3, 7, 5], t: ["ab", "abcd"], a: [[1], [1, 2, 3]] }, { chat: true });
    kiem("chat: minimum / maximum cua so, minLength / maxLength (code point), minItems / maxItems",
      s.properties.n.items.minimum === 3 && s.properties.n.items.maximum === 7 && s.properties.t.items.minLength === 2 && s.properties.t.items.maxLength === 4 &&
      s.properties.n.minItems === 3 && s.properties.n.maxItems === 3 && s.properties.a.minItems === 2 && s.properties.a.maxItems === 2 && s.properties.a.items.minItems === 1 && s.properties.a.items.maxItems === 3, ngan(s)); }
  kiem("chat khong bat: khong co min / max", (() => { const s = suy({ n: [3, 7] }); return s.properties.n.items.minimum === undefined && s.properties.n.minItems === undefined; })());
  kiem("chat: do dai chuoi dem code point (emoji = 1)", suy(["😀😀"], { chat: true }).items.minLength === 2);
  kiem("enum nho: 3 gia tri lap lai (>= 2 lan moi gia tri) -> enum", bang(suy(["a", "b", "c", "a", "b", "c"], { chat: true }).items.enum, ["a", "b", "c"]), ngan(suy(["a", "b", "c", "a", "b", "c"], { chat: true })));
  kiem("enum: gia tri DUY NHAT (moi gia tri 1 lan — nhu id) -> khong enum", suy(["a", "b", "c"], { chat: true }).items.enum === undefined);
  kiem("enum: qua enumToiDa gia tri khac nhau -> khong enum", suy(Array.from({ length: 40 }, (_, i) => "v" + (i % 20)), { chat: true }).items.enum === undefined && suy(Array.from({ length: 40 }, (_, i) => "v" + (i % 20)), { chat: true, enumToiDa: 30 }).items.enum.length === 20);
  kiem("enum: khong enum khi vi tri con kieu khac (chuoi + null)", suy(["a", "a", "b", "b", null], { chat: true }).items.enum === undefined);
  kiem("enumToiDa 0 -> tat enum", suy(["a", "a", "b", "b"], { chat: true, enumToiDa: 0 }).items.enum === undefined);
  kiem("mauToiDa nho: qua gioi han gia tri khac nhau -> khong enum (khong ton bo nho)", suy(["a", "a", "b", "b", "c", "c"], { chat: true, mauToiDa: 2 }).items.enum === undefined);

  /* gop nhieu mau */
  nhom("schema-suy · gop nhieu mau (suyTuNhieuMau)");
  { const m = [{ id: 1, ten: "a", the: ["x"] }, { id: 2, ten: "b" }, { id: 3, ten: null, ghi: "g" }], s = SU.suyTuNhieuMau(m);
    kiem("gop 3 mau: required = id, ten (moi mau co); the / ghi tuy chon; ten: [null, string]", bang(s.required, ["id", "ten"]) && bang(s.properties.ten.type, ["null", "string"]) && s.properties.the && s.properties.ghi, ngan(s));
    kiem("moi mau goc deu hop le voi schema gop", m.every((d) => kiemHop(s, d).hopLe)); }
  kiem("suyTuNhieuMau([]) -> {$schema} (khong co mau: nhan moi thu), khong nem", bang(SU.suyTuNhieuMau([]), { $schema: "https://json-schema.org/draft/2020-12/schema" }));
  kiem("suyTuNhieuMau([x]) = suySchema(x)", bang(SU.suyTuNhieuMau([{ a: [1, "x"] }]), suy({ a: [1, "x"] })));
  kiem("gop mau kieu khac nhau (object + so + mang): anyOf, moi mau hop le", (() => { const m = [{ a: 1 }, 5, [1, 2]], s = SU.suyTuNhieuMau(m); return Array.isArray(s.anyOf) && m.every((d) => kiemHop(s, d).hopLe); })());

  /* =========================================================== bat bien tren JSON ngau nhien */
  nhom("schema-suy · bat bien: kiem(d, suy(d)).hopLe === true tren 150 JSON ngau nhien x moi tuy chon");
  const TUY_CHON = [{}, { draft: "07" }, { chat: true }, { chat: true, enumToiDa: 3 }, { batBuoc: "khong" }, { dongKhoaThem: true }, { dinhDang: false }, { chat: true, dongKhoaThem: true, draft: "07" }];
  { const rd = C.taoNgauNhien(424242), hong = []; let n = 0;
    const mau = [];
    for (let i = 0; i < 150; i++) mau.push(jsonNgauNhien(rd, 0));
    for (const tc of TUY_CHON) for (const d of mau) {
      n++;
      let s, r;
      try { s = SU.suySchema(d, tc); r = kiemHop(s, d, tc.draft); } catch (e) { hong.push("NEM " + ngan(d) + " " + e.message); continue; }
      if (!r.hopLe) hong.push(JSON.stringify(tc) + " " + ngan(d) + " -> " + ngan(s) + " : " + r.loi.map((e) => e.thongBao).join("/").slice(0, 80));
    }
    kiem("bat bien · " + n + " cap (150 JSON x " + TUY_CHON.length + " tuy chon): du lieu goc LUON hop le voi schema suy ra (format 'loi')", hong.length === 0, hong.slice(0, 3).join(" | "));
    /* nhieu mau gop */
    const hong2 = [];
    for (let i = 0; i < 40; i++) {
      const g = [mau[i], mau[i + 1], mau[i + 2], mau[i + 3]];
      const s = SU.suyTuNhieuMau(g, i % 2 ? { chat: true } : {});
      g.forEach((d, j) => { const r = kiemHop(s, d); if (!r.hopLe) hong2.push(i + "." + j + " " + ngan(d) + " : " + r.loi[0].thongBao); });
    }
    kiem("bat bien · 40 bo 4 mau gop: moi mau goc hop le voi schema gop", hong2.length === 0, hong2.slice(0, 3).join(" | "));
    /* tat dinh */
    kiem("tat dinh: cung dau vao + tuy chon -> cung schema (150 JSON x 8 tuy chon chay hai lan)", TUY_CHON.every((tc) => mau.every((d) => JSON.stringify(SU.suySchema(d, tc)) === JSON.stringify(SU.suySchema(d, tc)))));
    /* schema suy ra la schema HOP LE: khong loi schema / canh bao */
    const xau = [];
    for (const tc of TUY_CHON) for (const d of mau.slice(0, 60)) { const bd = S.bienDich(SU.suySchema(d, tc), tc.draft ? { draft: tc.draft } : {}); if (bd.loiSchema.length || bd.canhBao.length) xau.push(ngan(d) + " -> " + (bd.loiSchema[0] || bd.canhBao[0]).thongBao); }
    kiem("schema suy ra khong co loi schema va khong co canh bao (lint J3 sach)", xau.length === 0, xau.slice(0, 2).join(" | "));
    /* suy -> sinh -> kiem (vong tron) */
    const hong3 = []; let ds3 = 0, cham = 0;
    for (const tc of [{}, { chat: true }, { draft: "07" }]) for (let i = 0; i < 60; i++) {
      const d = mau[i]; ds3++;
      const s = SU.suySchema(d, tc), r = SG.sinhMau(s, { seed: "v" + i, soLuong: 2 });
      if (!r.hopLe) { hong3.push(JSON.stringify(tc) + " " + ngan(d) + " -> " + ngan(s) + " : " + r.khongDamBao.map((x) => x.lyDo).join("/").slice(0, 80)); continue; }
      r.giaTri.forEach((m) => { if (!kiemHop(s, m, tc.draft).hopLe) hong3.push("mau sinh sai " + ngan(m)); });
    }
    kiem("vong tron suy -> sinh -> kiem: " + ds3 + " lan, moi schema suy ra deu sinh duoc mau hop le (khong chi nhan ra du lieu goc)", hong3.length === 0, hong3.slice(0, 3).join(" | ")); }

  /* =========================================================== dang du lieu thuc te */
  nhom("schema-suy · du lieu thuc te + ca khac");
  { const du = { nguoiDung: [{ id: 1, ten: "An", email: "an@vd.vn", tuoi: 30, tags: ["a", "b"], diaChi: { quan: "1", gps: [10.7, 106.6] }, ngay: "2024-01-05", hoatDong: true },
      { id: 2, ten: "Bình", email: "binh@vd.vn", tuoi: null, tags: [], diaChi: { quan: "3" }, ngay: "2024-02-29", hoatDong: false }], tong: 2, phienBan: "1.0" }, s = suy(du, { chat: true });
    kiem("ho so nguoi dung: suy ra, du lieu goc hop le (chat)", kiemHop(s, du).hopLe);
    const u = s.properties.nguoiDung.items;
    kiem("ho so: email -> format email, ngay -> date, tuoi: [null, integer], diaChi.gps tuy chon, id/ten/email bat buoc", u.properties.email.format === "email" && u.properties.ngay.format === "date" && bang(u.properties.tuoi.type, ["null", "integer"]) &&
      u.required.indexOf("gps") < 0 && u.properties.diaChi.required.indexOf("gps") < 0 && u.required.indexOf("id") >= 0 && u.required.indexOf("ten") >= 0, ngan(u)); }
  kiem("bo schema suy ra tu chinh no hop le doi voi MAU SAI? (schema chat tu choi gia tri ngoai khoang)", (() => { const s = suy({ n: [1, 2, 3], t: ["a", "b"] }, { chat: true }); return !kiemHop(s, { n: [1, 99], t: ["a"] }).hopLe && !kiemHop(s, { n: [1], t: [3] }).hopLe && !kiemHop(s, { n: [1, 2, 3, 4], t: ["a"] }).hopLe; })());
  kiem("dataset lon dong deu: 5 000 object cung hinh dang -> schema nho (khong phinh theo so phan tu)", (() => { const d = Array.from({ length: 5000 }, (_, i) => ({ id: i, ten: "n" + i, ok: i % 2 === 0 })); const s = suy(d); return JSON.stringify(s).length < 400 && kiemHop(s, d).hopLe; })());
  kiem("long 300 cap object: khong tran ngan xep, du lieu goc hop le (nhanh qua 400 cap phat {})", (() => { let d = { v: 1 }; for (let i = 0; i < 300; i++) d = { x: d }; return kiemHop(suy(d), d).hopLe; })());
  kiem("long 1 500 cap mang: tom tat bang ngan xep, nhanh sau 400 cap phat {} — du lieu goc van hop le, khong nem", (() => { let d = [1]; for (let i = 0; i < 1500; i++) d = [d]; const s = suy(d); return typeof s === "object" && kiemHop(s, d).hopLe; })());
  kiem("long 20 000 cap: suy KHONG nem (bo kiem bao 'long qua sau' chu khong treo)", (() => { let d = [1]; for (let i = 0; i < 20000; i++) d = [d]; let ok = true; try { const s = suy(d); ok = typeof s === "object"; } catch (e) { ok = false; } return ok; })());
  kiem("khoa la: '', 'k\"q', 'a/b', '😀', '__proto__', 'constructor' — suy + du lieu goc hop le", (() => { const d = JSON.parse('{"":1,"k\\"q":2,"a/b":3,"😀":4,"__proto__":5,"constructor":6,"toString":7}'); const s = suy(d); return kiemHop(s, d).hopLe && s.required.length === 7; })());
  kiem("so cuc doan: 1e21, 5e-324, -0, MAX_SAFE_INTEGER — schema hop le", (() => { const d = [1e21, 5e-324, -0, 9007199254740991, 0.1 + 0.2]; return kiemHop(suy(d, { chat: true }), d).hopLe; })());
  kiem("chuoi Unicode (emoji, tieng Viet, \\u0000) khong lam hong chat (minLength theo code point)", (() => { const d = ["😀", "xin chào", "\u0000", "a😀b"]; return kiemHop(suy(d, { chat: true }), d).hopLe; })());
  kiem("mang 100 000 so: suy nhanh va dung", (() => { const d = Array.from({ length: 100000 }, (_, i) => i); const s = suy(d, { chat: true }); return s.items.minimum === 0 && s.items.maximum === 99999 && kiemHop(s, d).hopLe; })());

  /* =========================================================== mau 1 MB + hieu nang */
  nhom("schema-suy · mau 1 MB + hieu nang");
  { const rd = C.taoNgauNhien(7), d = [];
    let tong = 0;
    while (tong < 1.1 * 1024 * 1024) { const dt = {}; for (let i = 0; i < 12; i++) dt["k" + i] = jsonNgauNhien(rd, 3); dt.id = d.length; tong += JSON.stringify(dt).length + 1; d.push(dt); }
    const kich = JSON.stringify(d).length;
    let s; const t = C.hieuChuan(() => { s = suy(d, { chat: true }); }, 3);
    const chuan = C.hieuChuan(() => { JSON.stringify(d); }, 3);
    console.log("        · suy " + (kich / 1048576).toFixed(2) + " MB (" + d.length + " object): " + t.toFixed(0) + " ms (do chuan stringify " + chuan.toFixed(0) + " ms)");
    kiem("mau 1 MB: suy ra, du lieu goc hop le (chat), < max(1 500 ms x SLACK, 30 x do chuan)", kiemHop(s, d).hopLe && t < Math.max(1500 * SLACK, 30 * chuan), t.toFixed(0) + " ms"); }
  { const d = Array.from({ length: 20000 }, (_, i) => ({ id: i, ten: "t" + i, mail: "u" + i + "@vd.vn", ngay: "2024-01-" + String(1 + i % 28).padStart(2, "0"), ok: !!(i % 2) }));
    const t = C.hieuChuan(() => suy(d), 3), t2 = C.hieuChuan(() => suy(d.slice(0, 2000)), 3);
    kiem("tuyen tinh theo kich thuoc: 20 000 object khong cham hon 25 x 2 000 object (+ nen)", t < Math.max(25 * t2, 100 * SLACK), t2.toFixed(1) + " -> " + t.toFixed(1) + " ms"); }
};
