/* =====================================================================
   schema-suy.js — SUY RA JSON Schema tu du lieu mau (module thuan, khuon je-chung.js:
   khong DOM / storage / dong ho; co JE_NGUON cho Worker).

   JE.schemaSuy:
     suySchema(duLieu, tuyChon) -> schema          (mot tai lieu)
     suyTuNhieuMau([d1, d2, …], tuyChon) -> schema  (GOP nhieu mau: required = khoa co mat o MOI mau)
     tuyChon { draft:"2020-12"|"07" ("2020-12"), chat:false, batBuoc:"moi-lan-xuat-hien"|"khong", enumToiDa:8, dinhDang:true,
               mauToiDa:1000, dongKhoaThem:false }
       chat: them minimum/maximum, minLength/maxLength, minItems/maxItems va `enum` khi <= enumToiDa gia tri khac nhau LAP LAI (>= 2 lan moi gia tri)
       dinhDang: gan `format` (date-time, date, time, email, uuid, ipv4, ipv6, uri co "://") CHI KHI MOI chuoi o vi tri do khop
       dongKhoaThem: object them additionalProperties:false

   Hai buoc: (1) TOM TAT gop theo vi tri (duyet bang ngan xep tu quan ly — du lieu long rat sau van chay) dem kieu, khoa (so lan co mat),
   do dai, min / max, tap gia tri; (2) PHAT schema: nhieu kieu nguyen thuy -> type:[…]; object / mang lan voi kieu khac -> anyOf;
   mang -> items la schema gop cua MOI phan tu; required = khoa co mat o moi object cung vi tri.
   Bat bien (kiem.js): kiem(duLieu, suySchema(duLieu)).hopLe === true (ca khi format 'loi'). Do sau > 400: nhanh sau do phat `{}` (nhan moi thu).
   ===================================================================== */
(function (khai) {
  var g = typeof globalThis !== "undefined" ? globalThis : this;
  khai(g);
  (g.JE_NGUON || (g.JE_NGUON = [])).push(khai);
})(function (root) {
  "use strict";
  var JE = root.JE || (root.JE = {});
  var F = JE.schemaFormat;
  if (!F) throw new Error("schema-suy.js cần schema-format.js nạp trước");

  var MAX_SAU = 400;
  /* Chi doan nhung format co CU PHAP DAC TRUNG (khong doan hostname / regex: chuoi bat ky cung khop). Thu tu = do uu tien khi nhieu format cung khop. */
  var DS_FMT = ["date-time", "date", "time", "uuid", "email", "ipv4", "ipv6", "uri"];
  function khopFmt(ten, s) {
    if (ten === "uri" && !/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(s)) return false;
    return F.kiem(ten, s) === true;
  }

  function datKhoa(o, k, v) {
    if (k === "__proto__") Object.defineProperty(o, k, { value: v, enumerable: true, writable: true, configurable: true });
    else o[k] = v;
  }
  function doDaiCP(s) { var n = 0, i, c; for (i = 0; i < s.length; i++) { c = s.charCodeAt(i); if (c >= 0xD800 && c <= 0xDBFF && i + 1 < s.length && (s.charCodeAt(i + 1) & 0xFC00) === 0xDC00) i++; n++; } return n; }

  function nut() {
    return { n: 0, nul: 0, boo: 0, nguyen: 0, so: 0, chu: 0, mang: 0, dt: 0, sauQua: false, lo: Infinity, hi: -Infinity,
      dmin: Infinity, dmax: -Infinity, vals: null, quaVals: false, fmt: null, mn: Infinity, mx: -Infinity, pt: null, khoa: null };
  }

  /** Duyet `v` (ngan xep) cong don vao nut goc `goc`. */
  function tomTat(goc, v, tc) {
    var ngan = [goc, v, 0], e, T, x, sau, i, ks, k, ent, t, cap = tc.mauToiDa;
    while (ngan.length) {
      sau = ngan.pop(); x = ngan.pop(); T = ngan.pop();
      T.n++;
      if (sau > MAX_SAU) { T.sauQua = true; continue; }
      if (x === null) T.nul++;
      else if (typeof x === "boolean") T.boo++;
      else if (typeof x === "number") {
        if (Number.isInteger(x)) T.nguyen++; else T.so++;
        if (x < T.lo) T.lo = x;
        if (x > T.hi) T.hi = x;
      } else if (typeof x === "string") {
        T.chu++;
        if (tc.chat) {
          t = doDaiCP(x);
          if (t < T.dmin) T.dmin = t;
          if (t > T.dmax) T.dmax = t;
          if (!T.vals) T.vals = new Map();
          if (!T.quaVals) {
            if (T.vals.has(x)) T.vals.set(x, T.vals.get(x) + 1);
            else if (T.vals.size >= cap) T.quaVals = true;
            else T.vals.set(x, 1);
          }
        }
        if (tc.dinhDang) {
          if (T.fmt === null) { T.fmt = []; for (i = 0; i < DS_FMT.length; i++) if (khopFmt(DS_FMT[i], x)) T.fmt.push(DS_FMT[i]); }
          else if (T.fmt.length) { T.fmt = T.fmt.filter(function (f) { return khopFmt(f, x); }); }
        }
      } else if (Array.isArray(x)) {
        T.mang++;
        if (x.length < T.mn) T.mn = x.length;
        if (x.length > T.mx) T.mx = x.length;
        if (x.length) {
          if (!T.pt) T.pt = nut();
          for (i = x.length - 1; i >= 0; i--) ngan.push(T.pt, x[i], sau + 1);
        }
      } else if (typeof x === "object") {
        T.dt++;
        if (!T.khoa) T.khoa = new Map();
        ks = Object.keys(x);
        for (i = 0; i < ks.length; i++) {                      /* tao muc theo THU TU khoa (Map giu thu tu chen) ... */
          k = ks[i]; ent = T.khoa.get(k);
          if (!ent) { ent = { dem: 0, t: nut() }; T.khoa.set(k, ent); }
          ent.dem++;
        }
        for (i = ks.length - 1; i >= 0; i--) ngan.push(T.khoa.get(ks[i]).t, x[ks[i]], sau + 1);   /* ... roi day nguoc de pop ra dung thu tu */
      }
    }
  }

  function phat(T, tc, sau) {
    if (T.sauQua || sau > MAX_SAU) return {};
    var prim = [], sc = {}, cac = [], i;
    if (T.nul) prim.push("null");
    if (T.boo) prim.push("boolean");
    if (T.nguyen || T.so) prim.push(T.so ? "number" : "integer");
    if (T.chu) prim.push("string");
    if (prim.length) {
      sc.type = prim.length === 1 ? prim[0] : prim;
      if (T.chu) {
        if (tc.dinhDang && T.fmt && T.fmt.length) sc.format = T.fmt[0];
        if (tc.chat) {
          if (T.dmin > 0) sc.minLength = T.dmin;
          if (isFinite(T.dmax)) sc.maxLength = T.dmax;
          if (T.n === T.chu && T.vals && !T.quaVals && T.vals.size >= 1 && T.vals.size <= tc.enumToiDa && T.chu >= 2 * T.vals.size) {
            var en = [];
            T.vals.forEach(function (c, s) { en.push(s); });
            sc.enum = en;
          }
        }
      }
      if ((T.nguyen || T.so) && tc.chat) { sc.minimum = T.lo; sc.maximum = T.hi; }
      cac.push(sc);
    }
    var nhanh = [];
    if (T.dt) {
      var o = { type: "object" }, props = {}, req = [];
      if (T.khoa) T.khoa.forEach(function (ent, k) {
        datKhoa(props, k, phat(ent.t, tc, sau + 1));
        if (tc.batBuoc !== "khong" && ent.dem === T.dt) req.push(k);
      });
      if (T.khoa && T.khoa.size) o.properties = props;
      if (req.length) o.required = req;
      if (tc.dongKhoaThem) o.additionalProperties = false;
      nhanh.push(o);
    }
    if (T.mang) {
      var a = { type: "array" };
      if (T.pt) a.items = phat(T.pt, tc, sau + 1);
      if (tc.chat) { if (T.mn > 0) a.minItems = T.mn; if (isFinite(T.mx)) a.maxItems = T.mx; }
      nhanh.push(a);
    }
    if (!nhanh.length) return cac.length ? cac[0] : {};
    if (!prim.length && nhanh.length === 1) return nhanh[0];
    var ra = [];
    for (i = 0; i < cac.length; i++) ra.push(cac[i]);
    for (i = 0; i < nhanh.length; i++) ra.push(nhanh[i]);
    return { anyOf: ra };
  }

  function tuyChonMacDinh(tuyChon) {
    tuyChon = tuyChon || {};
    return {
      draft: tuyChon.draft === "07" ? "07" : "2020-12", chat: tuyChon.chat === true, batBuoc: tuyChon.batBuoc === "khong" ? "khong" : "moi-lan-xuat-hien",
      enumToiDa: typeof tuyChon.enumToiDa === "number" && tuyChon.enumToiDa >= 0 ? Math.floor(tuyChon.enumToiDa) : 8, dinhDang: tuyChon.dinhDang !== false,
      mauToiDa: typeof tuyChon.mauToiDa === "number" && tuyChon.mauToiDa > 0 ? Math.floor(tuyChon.mauToiDa) : 1000, dongKhoaThem: tuyChon.dongKhoaThem === true
    };
  }

  function dungRa(goc, tc) {
    var s = phat(goc, tc, 0), ra = { $schema: tc.draft === "07" ? "http://json-schema.org/draft-07/schema#" : "https://json-schema.org/draft/2020-12/schema" }, k;
    for (k in s) ra[k] = s[k];
    return ra;
  }

  function suyTuNhieuMau(dsMau, tuyChon) {
    var tc = tuyChonMacDinh(tuyChon), goc = nut(), i;
    for (i = 0; i < dsMau.length; i++) tomTat(goc, dsMau[i], tc);
    return dungRa(goc, tc);
  }
  function suySchema(duLieu, tuyChon) { return suyTuNhieuMau([duLieu], tuyChon); }

  JE.schemaSuy = { suySchema: suySchema, suyTuNhieuMau: suyTuNhieuMau, tuyChonMacDinh: tuyChonMacDinh };
  if (typeof module !== "undefined" && module.exports) module.exports = JE.schemaSuy;
});
