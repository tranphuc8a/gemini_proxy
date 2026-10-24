/* =====================================================================
   schema-sinh.js — SINH du lieu mau ngau nhien HOP LE theo JSON Schema, co seed
   (cung seed + cung schema + cung tuy chon -> cung ket qua). Module thuan, khuon
   je-chung.js: khong DOM / storage / dong ho / Math.random; co JE_NGUON cho Worker.

   JE.schemaSinh:
     sinhMau(schemaHoacBd, { seed, soLuong:1, tiLeTuyChon:0.5, doSauToiDa:6, mangToiDa:5, dungViDu:0.3, thuLai:20,
                             nganSach:200000, draft, thuVien }) ->
        { giaTri,                  // soLuong > 1 => mang cac mau
          hopLe, loi:[Loi],        // ket qua validator J3 tren dau ra cuoi (format o muc "loi": nghiem hon mac dinh)
          khongDamBao:[{conTroSchema, lyDo, conTro?}],   // CHI co khi hopLe = false: phan khong dam bao duoc, noi ro ly do
          ghiChu:[{conTroSchema, lyDo}],                 // luu y khong chan (vd pattern dung \b xap xi) khi van hop le
          soLanThu, seed, soLuong, loiSchema:[…], catBot,
          soBuocNut, soLanThuNut }   // chan doan: moi nut dung ngay lan thu dau <=> soLanThuNut === soBuocNut (kiem thu dung de bat loi "doan sai roi thu lai")
     sinhFormat(ten, rng) -> chuoi hop le theo schemaFormat (hoac null neu format la)

   Cach lam: moi nut sinh = hop cua mot DANH SACH "xem" (view) schema (cha + nhanh da chon + $ref + allOf…) — KHONG gop
   thanh schema gia, nen luc nao cung kiem lai duoc bang bo kiem J3 tren CHINH cac nut that (kiemNut). Moi nut: sinh -> kiemNut
   -> sai thi thu lai (8 / 4 / 2 lan theo do sau; anyOf / oneOf / if xoay nhanh co he thong, khong chi ngau nhien). Cuoi cung
   kiem TOAN BO; sai thi thu lai ca mau voi seed dan xuat "seed#1…#thuLai"; van sai thi tra lan it loi nhat + hopLe:false.
   Khong bia: pattern khong sinh duoc / schema mau thuan / uniqueItems khong du gia tri -> hopLe:false + khongDamBao.
   Giu thoi gian: ngan sach buoc (nganSach) + do sau toi da; de quy bat buoc khong co diem dung bi cat va bao.
   ===================================================================== */
(function (khai) {
  var g = typeof globalThis !== "undefined" ? globalThis : this;
  khai(g);
  (g.JE_NGUON || (g.JE_NGUON = [])).push(khai);
})(function (root) {
  "use strict";
  var JE = root.JE || (root.JE = {});
  var C = JE.chung, F = JE.schemaFormat, S = JE.schema, R = JE.regexSinh;
  if (!C || !F || !S || !R || !JE.taoRng) throw new Error("schema-sinh.js cần je-chung, schema-format, schema-kiem, regex-sinh nạp trước");
  var coRieng = C.coRieng, khoaChuan = C.khoaChuan, bangNhauSau = C.bangNhauSau, catNgan = C.catNgan;

  function laObj(x) { return x !== null && typeof x === "object" && !Array.isArray(x); }
  function laSoNguyenKhongAm(x) { return typeof x === "number" && x >= 0 && Math.floor(x) === x; }
  function laChuoiDs(a) { return Array.isArray(a) && a.every(function (x) { return typeof x === "string"; }); }
  function kep(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }
  function nguyenTu(x, mac) { return typeof x === "number" && isFinite(x) ? Math.floor(x) : mac; }
  /** Dat khoa an toan (khoa "__proto__" la khoa rieng, khong doi prototype). */
  function datKhoa(o, k, v) {
    if (k === "__proto__") Object.defineProperty(o, k, { value: v, enumerable: true, writable: true, configurable: true });
    else o[k] = v;
  }

  /* ======================================================= bo sinh format */
  function hai(n) { return (n < 10 ? "0" : "") + n; }
  function ngayTrongThang(y, m) { return [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]; }
  var CH_THUONG = "abcdefghijklmnopqrstuvwxyz", CH_HEX = "0123456789abcdef";
  function chuoiTu(r, bang, n) { var s = "", i; for (i = 0; i < n; i++) s += bang.charAt(Math.floor(r.soThuc() * bang.length)); return s; }
  function nhan(r) { return chuoiTu(r, CH_THUONG, r.soNguyen(3, 8)); }
  function tenMien(r) { return nhan(r) + "." + r.chon(["com", "net", "org", "vn", "io"]); }
  function duongTuy(r) { var n = r.soNguyen(1, 3), a = [], i; for (i = 0; i < n; i++) a.push(nhan(r)); return a.join("/"); }
  function hexN(r, n) { return chuoiTu(r, CH_HEX, n); }

  var GEN = {
    "date": function (r) { var y = r.soNguyen(1990, 2035), m = r.soNguyen(1, 12); return y + "-" + hai(m) + "-" + hai(r.soNguyen(1, ngayTrongThang(y, m))); },
    "time": function (r) {
      return hai(r.soNguyen(0, 23)) + ":" + hai(r.soNguyen(0, 59)) + ":" + hai(r.soNguyen(0, 59)) + (r.xacSuat(0.3) ? "." + r.soNguyen(1, 999) : "") +
        (r.xacSuat(0.6) ? "Z" : (r.xacSuat(0.5) ? "+" : "-") + hai(r.soNguyen(0, 12)) + ":" + (r.xacSuat(0.5) ? "00" : "30"));
    },
    "duration": function (r, nho) {
      if (nho) return "P" + r.soNguyen(1, 9) + "D";
      var k = r.soNguyen(0, 3);
      if (k === 0) return "P" + r.soNguyen(1, 30) + "D";
      if (k === 1) return "PT" + r.soNguyen(1, 23) + "H" + r.soNguyen(1, 59) + "M";
      if (k === 2) return "P" + r.soNguyen(1, 3) + "W";
      return "P" + r.soNguyen(1, 5) + "Y" + r.soNguyen(1, 11) + "M" + r.soNguyen(1, 28) + "DT" + r.soNguyen(1, 23) + "H";
    },
    "email": function (r, nho) { if (nho) return chuoiTu(r, CH_THUONG, 1) + "@" + chuoiTu(r, CH_THUONG, 1) + "." + chuoiTu(r, CH_THUONG, 2); return nhan(r) + (r.xacSuat(0.4) ? "." + nhan(r) : "") + "@" + tenMien(r); },
    "hostname": function (r, nho) { if (nho) return chuoiTu(r, CH_THUONG, r.soNguyen(1, 3)); return (r.xacSuat(0.4) ? nhan(r) + "." : "") + tenMien(r); },
    "ipv4": function (r, nho) { if (nho) return r.soNguyen(1, 9) + "." + r.soNguyen(0, 9) + "." + r.soNguyen(0, 9) + "." + r.soNguyen(0, 9); return r.soNguyen(1, 255) + "." + r.soNguyen(0, 255) + "." + r.soNguyen(0, 255) + "." + r.soNguyen(0, 255); },
    "ipv6": function (r, nho) {
      var a = [], i;
      if (nho) return "::" + (r.xacSuat(0.5) ? hexN(r, 1) : "");
      if (r.xacSuat(0.5)) { for (i = 0; i < 8; i++) a.push(hexN(r, r.soNguyen(1, 4))); return a.join(":"); }
      return "2001:db8::" + hexN(r, r.soNguyen(1, 4));
    },
    "uri": function (r, nho) { if (nho) return r.chon(["a", "x", "http"]) + "://" + chuoiTu(r, CH_THUONG, 1); return r.chon(["https", "http"]) + "://" + tenMien(r) + "/" + duongTuy(r) + (r.xacSuat(0.3) ? "?q=" + nhan(r) : ""); },
    "uri-reference": function (r, nho) { if (nho) return "/" + chuoiTu(r, CH_THUONG, r.soNguyen(0, 2)); return r.xacSuat(0.5) ? "/" + duongTuy(r) : "https://" + tenMien(r) + "/" + duongTuy(r); },
    "uuid": function (r) { return hexN(r, 8) + "-" + hexN(r, 4) + "-" + hexN(r, 4) + "-" + hexN(r, 4) + "-" + hexN(r, 12); },
    "regex": function (r, nho) { if (nho) return r.chon(["a", ".", "\d"]); return r.chon(["^[a-z]+$", "\\d{3}-\\d{4}", "(foo|bar)+", "^[A-Z]{2}[0-9]{3}$", "a.*b"]); },
    "json-pointer": function (r, nho) { if (nho) return r.chon(["", "/a", "/0"]); var n = r.soNguyen(0, 3), s = "", i; for (i = 0; i < n; i++) s += "/" + (r.xacSuat(0.3) ? String(r.soNguyen(0, 9)) : nhan(r)); return s; },
    "relative-json-pointer": function (r, nho) { if (nho) return String(r.soNguyen(0, 9)); return String(r.soNguyen(0, 3)) + r.chon(["", "#", "/" + nhan(r)]); },
    "uri-template": function (r, nho) { if (nho) return "{" + chuoiTu(r, CH_THUONG, 1) + "}"; return "https://" + tenMien(r) + "/" + nhan(r) + "/{" + nhan(r) + "}" + (r.xacSuat(0.4) ? "{?" + nhan(r) + "}" : ""); }
  };
  GEN["date-time"] = function (r) { return GEN.date(r) + "T" + GEN.time(r); };
  GEN["idn-email"] = GEN.email;
  GEN["idn-hostname"] = GEN.hostname;
  GEN["iri"] = GEN.uri;
  GEN["iri-reference"] = GEN["uri-reference"];

  var GIAO = "https:" + "//";                              /* tach ra: tep nay khong chua dia chi URL nguyen van (check.py --tinh tim URL ngoai) */
  var MAU_TINH = {
    "date-time": "2024-02-29T12:30:45Z", "date": "2024-02-29", "time": "12:30:45Z", "duration": "P1D", "email": "a@example.com",
    "idn-email": "a@example.com", "hostname": "example.com", "idn-hostname": "example.com", "ipv4": "192.168.1.1", "ipv6": "2001:db8::1",
    "uri": GIAO + "example.com/a", "uri-reference": "/a/b", "iri": GIAO + "example.com/a", "iri-reference": "/a/b",
    "uuid": "123e4567-e89b-12d3-a456-426614174000", "regex": "^[a-z]+$", "json-pointer": "/a/0", "relative-json-pointer": "0",
    "uri-template": GIAO + "example.com/{id}"
  };

  /** Chuoi hop le theo `format` `ten` (da tu kiem bang schemaFormat); null neu format la (bo kiem se bo qua format do). */
  function sinhFormat(ten, rng, mn, mx) {
    var g = GEN[ten], i, s, pha, loc = (typeof mn === "number" && mn > 0) || (typeof mx === "number" && mx < Infinity), lo = mn > 0 ? mn : 0, hi = typeof mx === "number" ? mx : Infinity, dai;
    if (!g || !F.co(ten)) return null;
    for (pha = 0; pha < (loc ? 2 : 1); pha++) {            /* pha 1: bien the NGAN (khi co gioi han do dai) */
      for (i = 0; i < (loc ? 30 : 12); i++) {
        s = g(rng, pha === 1);
        if (F.kiem(ten, s) !== true) continue;
        dai = R.doDaiCP(s);
        if (!loc || (dai >= lo && dai <= hi)) return s;
      }
    }
    return MAU_TINH[ten] || null;                          /* khong thoa do dai: tra chuoi hop le (nguoi goi ghi chu "khong nam trong minLength/maxLength") */
  }

  /* ======================================================= van ban tu nhien */
  var TU_VAN = ["xin", "chào", "hà", "nội", "sài", "gòn", "đà", "nẵng", "mùa", "thu", "cà", "phê", "sữa", "đá", "phở", "bò", "bánh", "mì", "trà", "sen",
    "hoa", "hồng", "biển", "xanh", "núi", "cao", "sông", "dài", "alpha", "beta", "gamma", "delta", "omega", "sigma", "kappa", "lambda", "mẫu", "dữ", "liệu",
    "thử", "nghiệm", "đơn", "hàng", "khách", "sản", "phẩm"];
  var TRAN_CHUOI = 1000000;                                /* tran tuyet doi do dai chuoi tu do */
  function vanBanTu(r, mn, mx) {
    var dich, ra = "", cp;
    if (mx < mn) return "";
    var lo = Math.max(mn, 3), hi = Math.min(mx, lo + 14);
    dich = lo <= hi ? r.soNguyen(lo, hi) : r.soNguyen(mn, mx);
    var dem = 0, tu;                                       /* do dai cong don: KHONG tinh lai ca chuoi moi vong (tranh bac hai) */
    var phan = [];
    while (dem < dich) { tu = r.chon(TU_VAN); dem += (phan.length ? 1 : 0) + Array.from(tu).length; phan.push(tu); }
    ra = phan.join(" ");
    cp = Array.from(ra);
    if (cp.length > dich) cp = cp.slice(0, dich);
    ra = cp.join("");
    if (dich > 1 && ra.charAt(ra.length - 1) === " ") ra = ra.slice(0, -1) + "a";
    return ra;
  }

  /* ======================================================= ngu canh */
  function ghi(ng, cp, ly) {
    var k = cp + "\u0000" + ly;
    if (!ng.ghiChu.has(k)) ng.ghiChu.set(k, { conTroSchema: cp, lyDo: ly });
  }
  function dungSom(ng, ly) { if (!ng.thoat) { ng.thoat = true; ghi(ng, "#", ly); } }

  /** "Xem" mot schema con: { s, nut, co, cp }. `true` -> null (khong rang buoc); `false` -> { s:false }. */
  function xemTu(ng, gt, co) {
    if (gt === true) return null;
    if (gt === false) return { s: false, nut: null, co: co, cp: "#" };
    if (!laObj(gt)) return null;
    var nut = ng.bd.nutDt.get(gt) || null;
    return { s: gt, nut: nut, co: nut ? nut.co : co, cp: nut ? nut.cp : "#" };
  }

  var TC_KIEM = { format: "loi", toiDa: 1, dungSom: true };
  function kiemTatCa(ng, vs, gt) {
    var i;
    if (gt === undefined) gt = null;
    for (i = 0; i < vs.length; i++) {
      if (vs[i].s === false) return false;
      if (!vs[i].nut) continue;
      if (!S.kiemNut(vs[i].nut, gt, ng.bd, TC_KIEM).hopLe) return false;
    }
    return true;
  }

  function idXem(ng, v) {
    if (!v.nut) return v.s === false ? "F" : "x";
    var i = ng.id.get(v.nut);
    if (i === undefined) { i = ng.id.size + 1; ng.id.set(v.nut, i); }
    return i;
  }

  var trongSoCache = typeof WeakMap === "function" ? new WeakMap() : null;
  /** Do "nang" cua mot nhanh (do dai JSON, co cache): che do toi thieu chon nhanh nhe nhat. */
  function trongSo(v) {
    if (!v || v.s === true) return 0;
    if (v.s === false) return 1e9;
    var t = trongSoCache && trongSoCache.get(v.s);
    if (t !== undefined) return t;
    try { t = Math.min(JSON.stringify(v.s).length, 1e6); } catch (e) { t = 1e6; }
    if (trongSoCache) trongSoCache.set(v.s, t);
    return t;
  }

  /* ======================================================= tro len phang (allOf / $ref / nhanh da chon) */
  /**
   * Mo rong danh sach xem `views` thanh danh sach PHANG `ds` cac schema object: theo $ref, allOf, va CHON nhanh anyOf / oneOf / if.
   * Lan thu `lan.t` quyet dinh nhanh (xoay he thong: (diem xuat phat + t·(k+1)) mod n). Tra { ds, kho, khoNhanh, refNut }.
   * kho: bat kha thi do chinh `views` (schema false, $ref hong); khoNhanh: chi do nhanh vua chon (thu lai nhanh khac).
   */
  function phang(ng, views, toiThieu, lan) {
    var ds = [], refNut = [], kho = false, khoNhanh = false, che = ng.bd.che, vong = 0, i = 0;
    var dau = [], tham = new Set(), q;
    for (q = 0; q < views.length; q++) dau.push({ v: views[q], nh: false });
    while (i < dau.length) {
      if (++vong > 600) { ghi(ng, "#", "Quá nhiều lớp allOf / $ref lồng nhau khi sinh"); break; }
      var it = dau[i++], V = it.v;
      if (!V) continue;
      if (V.s === false) {
        if (it.nh) khoNhanh = true;
        else { kho = true; ghi(ng, V.cp || "#", "Schema false — không giá trị nào hợp lệ ở đây"); }
        continue;
      }
      var s = V.s;
      if (V.nut) { if (tham.has(V.nut)) continue; tham.add(V.nut); }
      var cacRef = [];
      if (typeof s.$ref === "string") cacRef.push([s.$ref, "$ref"]);
      if (che.moi) {
        if (typeof s.$dynamicRef === "string") cacRef.push([s.$dynamicRef, "$dynamicRef"]);
        if (typeof s.$recursiveRef === "string") cacRef.push([s.$recursiveRef, "$recursiveRef"]);
      }
      for (q = 0; q < cacRef.length; q++) {
        var r = ng.bd.giaiRefTu(V.co, cacRef[q][0], cacRef[q][1]);
        if (r && r.nut) { dau.push({ v: xemTu(ng, r.nut.s, r.nut.co), nh: it.nh }); refNut.push(r.nut); }
        else { if (it.nh) khoNhanh = true; else kho = true; ghi(ng, V.cp + "/" + cacRef[q][1], (r && r.loi) || "$ref không giải được"); }
      }
      if (!che.moi && typeof s.$ref === "string") continue;       /* draft <= 07: tu khoa anh em cua $ref bi bo qua */
      ds.push(V);
      if (Array.isArray(s.allOf)) for (q = 0; q < s.allOf.length; q++) dau.push({ v: xemTu(ng, s.allOf[q], V.co), nh: it.nh });
      var kw, k2, ma, idx, j;
      for (k2 = 0; k2 < 2; k2++) {
        kw = k2 === 0 ? "anyOf" : "oneOf";
        ma = s[kw];
        if (!Array.isArray(ma) || !ma.length) continue;
        idx = chonNhanh(ng, ma, V, toiThieu, lan);
        for (j = 0; j < idx.length; j++) dau.push({ v: xemTu(ng, ma[idx[j]], V.co), nh: true });
      }
      if ((s.if !== undefined) && (laObj(s.if) || typeof s.if === "boolean") && (s.then !== undefined || s.else !== undefined)) {
        var coin = lan.coin === null || lan.coin === undefined ? (lan.coin = ng.rng.xacSuat(0.5)) : lan.coin;
        if (lan.t % 2 === 1) coin = !coin;
        if (coin) {
          dau.push({ v: xemTu(ng, s.if, V.co), nh: true });
          if (s.then !== undefined) dau.push({ v: xemTu(ng, s.then, V.co), nh: true });
        } else if (s.else !== undefined) dau.push({ v: xemTu(ng, s.else, V.co), nh: true });
      }
    }
    return { ds: ds, kho: kho, khoNhanh: khoNhanh, refNut: refNut };
  }

  /** Chon chi so nhanh cua anyOf / oneOf. Toi thieu -> nhanh nhe nhat; con lai xoay he thong, anyOf doi khi lay them mot nhanh. */
  function chonNhanh(ng, ma, V, toiThieu, lan) {
    var n = ma.length, k = lan.k++, i, tot = 0, tv = Infinity, w;
    if (toiThieu) {
      for (i = 0; i < n; i++) {
        w = trongSo(xemTu(ng, ma[i], V.co)) + ng.rng.soThuc() * 0.01;
        if (w < tv) { tv = w; tot = i; }
      }
      return [tot];
    }
    if (lan.starts[k] === undefined) lan.starts[k] = ng.rng.soNguyen(0, n - 1);
    return [(lan.starts[k] + lan.t) % n];             /* xoay he thong: n lan thu dau phu het n nhanh (thiet ke: "tron nhanh" = thu theo thu tu xao) */
  }

  /* ======================================================= sinh mot nut */
  var KW_OBJ = ["properties", "required", "patternProperties", "additionalProperties", "minProperties", "maxProperties", "propertyNames",
    "dependentRequired", "dependentSchemas", "dependencies"];
  var KW_MANG = ["items", "prefixItems", "minItems", "maxItems", "uniqueItems", "contains", "additionalItems", "minContains", "maxContains"];
  var KW_CHUOI = ["minLength", "maxLength", "pattern", "format"];
  var KW_SO = ["minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf"];
  var TEN_KIEU = { "null": 1, "boolean": 1, "object": 1, "array": 1, "string": 1, "number": 1, "integer": 1 };

  function sinhTuDo(ng, sau) {
    var r = ng.rng, k = r.soNguyen(0, sau >= ng.doSauToiDa ? 4 : 6), n, i, a, o;
    switch (k) {
      case 0: return vanBanTu(r, 3, 12);
      case 1: return r.soNguyen(0, 1000);
      case 2: return Math.round(r.soThuc() * 100000) / 100;
      case 3: return r.xacSuat(0.5);
      case 4: return null;
      case 5: n = r.soNguyen(1, 3); a = []; for (i = 0; i < n; i++) a.push(sinhTuDo(ng, sau + 1)); return a;
      default: n = r.soNguyen(1, 3); o = {}; for (i = 0; i < n; i++) o["khoa_" + (i + 1)] = sinhTuDo(ng, sau + 1); return o;
    }
  }

  function nhieuRef(ng, refNut) {
    var i, j, dem;
    for (i = 0; i < refNut.length; i++) {
      dem = 0;
      for (j = 0; j < ng.nganRef.length; j++) if (ng.nganRef[j] === refNut[i]) dem++;
      if (dem >= 2) return true;
    }
    return false;
  }

  /** Sinh gia tri thoa danh sach xem `views` (hop cua chung). `ep`: ep kieu ("string" cho ten khoa). Co kiem + thu lai + nho that bai. */
  function sinhSpec(ng, views, sau, ep) {
    var vs = [], i;
    for (i = 0; i < views.length; i++) if (views[i]) vs.push(views[i]);
    if (ng.thoat) return null;
    if (!vs.length) return ep === "string" ? vanBanTu(ng.rng, 3, 10) : sinhTuDo(ng, sau);
    if (++ng.buoc > ng.nganSach) { dungSom(ng, "Vượt ngân sách sinh (" + ng.nganSach + " bước) — schema quá phình hoặc quá nhiều phần tử"); return null; }
    if (sau > ng.doSauToiDa + 30) { dungSom(ng, "Schema đệ quy bắt buộc không có điểm dừng (sâu hơn " + (ng.doSauToiDa + 30) + " cấp)"); return null; }
    var khoa = vs.map(function (v) { return idXem(ng, v); }).join(",") + (ep || ""), cu = ng.that.get(khoa);
    if (cu !== undefined) return cu.v;
    var thuMax = sau <= 1 ? 8 : sau <= 3 ? 4 : 2, lan = { t: 0, starts: [], coin: null, k: 0 }, best = null, coBest = false, t, tt, pf, gt, nr, j;
    for (t = 0; t < thuMax && !ng.thoat; t++) {
      lan.t = t; lan.k = 0;
      tt = sau > ng.doSauToiDa;
      pf = phang(ng, vs, tt, lan);
      if (pf.kho) { best = null; coBest = true; break; }
      if (pf.khoNhanh) continue;
      ng.thuNut++;
      nr = pf.refNut.length;
      for (j = 0; j < nr; j++) ng.nganRef.push(pf.refNut[j]);
      if (!tt && nhieuRef(ng, pf.refNut)) tt = true;           /* mot $ref da co >= 2 lan tren ngan xep -> che do toi thieu */
      try { gt = sinhTrong(ng, pf.ds, vs, sau, tt, t, ep); }
      finally { ng.nganRef.length -= nr; }
      best = gt; coBest = true;
      if (kiemTatCa(ng, vs, gt)) return gt;
    }
    if (!ng.thoat) ng.that.set(khoa, { v: coBest ? best : null });
    return coBest ? best : null;
  }

  function xaoTron(ng, ds) { return ng.rng.tron(ds); }

  function sinhTrong(ng, ds, vs, sau, tt, t, ep) {
    var i, j, s, rng = ng.rng, cp = ds.length ? ds[0].cp : "#";
    /* --- const / enum (giao cac enum) --- */
    var hang = null;
    for (i = 0; i < ds.length; i++) {
      s = ds[i].s;
      if (coRieng(s, "const")) { hang = hang ? hang.filter(function (x) { return bangNhauSau(x, s.const); }) : [s.const]; }
      else if (Array.isArray(s.enum)) {
        hang = hang ? hang.filter(function (x) { return s.enum.some(function (y) { return bangNhauSau(x, y); }); }) : s.enum.slice();
      }
    }
    if (hang !== null) {
      var ds2 = xaoTron(ng, hang.slice(0, 200));
      for (j = 0; j < ds2.length && j < 60; j++) if (kiemTatCa(ng, vs, ds2[j])) return ds2[j];
      ghi(ng, cp, hang.length ? "enum / const không có giá trị nào thoả các ràng buộc còn lại" : "enum / const mâu thuẫn nhau (giao rỗng)");
      return ds2.length ? ds2[0] : null;
    }
    /* --- examples / default --- */
    if (ng.dungViDu > 0 && rng.xacSuat(ng.dungViDu)) {
      var vd = [];
      for (i = 0; i < ds.length; i++) {
        s = ds[i].s;
        if (Array.isArray(s.examples)) vd = vd.concat(s.examples);
        if (coRieng(s, "default")) vd.push(s.default);
      }
      if (vd.length) {
        vd = xaoTron(ng, vd.slice(0, 50));
        for (j = 0; j < vd.length; j++) if (kiemTatCa(ng, vs, vd[j])) return vd[j];
      }
    }
    /* --- chon kieu --- */
    var cho = null, loaiTru = null, kw, khoa, a;
    function datTap(ten) { var o = {}; if (ten === "number") { o.number = o.integer = 1; } else if (TEN_KIEU[ten]) o[ten] = 1; return o; }
    for (i = 0; i < ds.length; i++) {
      s = ds[i].s;
      if (s.type !== undefined) {
        var tap = {}, ts = Array.isArray(s.type) ? s.type : [s.type];
        for (j = 0; j < ts.length; j++) { var m1 = datTap(ts[j]); for (a in m1) tap[a] = 1; }
        if (cho === null) cho = tap;
        else { var g2 = {}; for (a in tap) if (cho[a]) g2[a] = 1; cho = g2; }
      }
      if (laObj(s.not) && Object.keys(s.not).length === 1 && s.not.type !== undefined) {   /* not: {type: X} -> loai kieu X */
        var tn = Array.isArray(s.not.type) ? s.not.type : [s.not.type];
        loaiTru = loaiTru || {};
        for (j = 0; j < tn.length; j++) { var m2 = datTap(tn[j]); for (a in m2) loaiTru[a] = 1; }
      }
    }
    var nguyenCu = [];
    if (cho !== null) {
      for (a in cho) if (!(loaiTru && loaiTru[a])) nguyenCu.push(a);
      if (nguyenCu.indexOf("number") >= 0 && nguyenCu.indexOf("integer") >= 0) nguyenCu.splice(nguyenCu.indexOf("integer"), 1);   /* "number" bao ca so nguyen (sinhSo thuc doi khi ra so nguyen) */
      if (!nguyenCu.length) { ghi(ng, cp, "type mâu thuẫn (các schema cùng áp dụng không có kiểu chung)"); return null; }
    } else {
      var goi = {};
      for (i = 0; i < ds.length; i++) {
        s = ds[i].s;
        for (kw = 0; kw < KW_OBJ.length; kw++) if (s[KW_OBJ[kw]] !== undefined) goi.object = 1;
        for (kw = 0; kw < KW_MANG.length; kw++) if (s[KW_MANG[kw]] !== undefined) goi.array = 1;
        for (kw = 0; kw < KW_CHUOI.length; kw++) if (s[KW_CHUOI[kw]] !== undefined) goi.string = 1;
        for (kw = 0; kw < KW_SO.length; kw++) if (s[KW_SO[kw]] !== undefined) { goi.number = 1; }
      }
      for (a in goi) if (!(loaiTru && loaiTru[a])) nguyenCu.push(a);          /* goi y tu tu khoa, bo kieu bi "not: {type}" loai */
      if (!nguyenCu.length) {
        if (ep === "string") nguyenCu.push("string");
        else {
          var t0 = ["string", "integer", "number", "boolean", "null"], kk;
          if (!tt) t0 = t0.concat(["array", "object"]);
          for (kk = 0; kk < t0.length; kk++) if (!(loaiTru && (loaiTru[t0[kk]] || (t0[kk] === "number" && loaiTru.integer)))) nguyenCu.push(t0[kk]);   /* so thuc doi khi ra so nguyen -> bo luon khi cam integer */
        }
      }
    }
    if (ep) {
      if (nguyenCu.indexOf(ep) >= 0) nguyenCu = [ep];
      else { ghi(ng, cp, "Cần chuỗi nhưng schema không cho phép kiểu chuỗi"); return null; }
    }
    var khongNull = nguyenCu.filter(function (x) { return x !== "null"; });
    var kieu = (khongNull.length && rng.xacSuat(0.8)) ? rng.chon(khongNull) : rng.chon(nguyenCu);
    switch (kieu) {
      case "null": return null;
      case "boolean": return rng.xacSuat(0.5);
      case "string": return sinhChuoi(ng, ds, t, cp);
      case "integer": return sinhSo(ng, ds, true, cp);
      case "number": return sinhSo(ng, ds, false, cp);
      case "array": return sinhMang(ng, ds, sau, tt, cp);
      default: return sinhDoiTuong(ng, ds, sau, tt, cp);
    }
  }

  /* ----------------------------------------------------- so */
  function soLe(x) {
    var s = String(x), e = 0, i = s.search(/e/i);
    if (i >= 0) { e = parseInt(s.slice(i + 1), 10); s = s.slice(0, i); }
    var cham = s.indexOf("."), le = cham < 0 ? 0 : s.length - cham - 1;
    return Math.max(0, le - e);
  }
  function ucln(a, b) { var t; while (b) { t = a % b; a = b; b = t; } return a; }

  function sinhSo(ng, ds, nguyen, cp) {
    var lo = -Infinity, loX = false, hi = Infinity, hiX = false, buoc = [], i, s, rng = ng.rng;
    function lo_(v, x) { if (v > lo) { lo = v; loX = x; } else if (v === lo) loX = loX || x; }
    function hi_(v, x) { if (v < hi) { hi = v; hiX = x; } else if (v === hi) hiX = hiX || x; }
    for (i = 0; i < ds.length; i++) {
      s = ds[i].s;
      if (typeof s.minimum === "number") lo_(s.minimum, s.exclusiveMinimum === true);
      if (typeof s.exclusiveMinimum === "number") lo_(s.exclusiveMinimum, true);
      if (typeof s.maximum === "number") hi_(s.maximum, s.exclusiveMaximum === true);
      if (typeof s.exclusiveMaximum === "number") hi_(s.exclusiveMaximum, true);
      if (typeof s.multipleOf === "number" && s.multipleOf > 0) buoc.push(s.multipleOf);
    }
    var coLo = lo > -Infinity, coHi = hi < Infinity;
    if (!coLo && !coHi) { lo = 0; hi = 1000; }
    else if (!coHi) hi = lo + 100;
    else if (!coLo) lo = hi - 100;
    function ok(v) { return (loX ? v > lo : v >= lo) && (hiX ? v < hi : v <= hi); }
    if (lo > hi || (lo === hi && (loX || hiX))) { ghi(ng, cp, "Miền số rỗng: giới hạn dưới " + (loX ? ">" : "≥") + " " + lo + " không thể đi cùng giới hạn trên " + (hiX ? "<" : "≤") + " " + hi); return lo; }
    /* multipleOf: gop thanh mot buoc chung (boi chung nho nhat theo thang thap phan) */
    var cacBoi = buoc.slice(), d = 0, L, step = 0;
    if (nguyen) cacBoi.push(1);
    if (cacBoi.length) {
      for (i = 0; i < cacBoi.length; i++) d = Math.max(d, soLe(cacBoi[i]));
      if (d <= 12) {
        var f = Math.pow(10, d); L = 1;
        for (i = 0; i < cacBoi.length; i++) {
          var ai = Math.round(cacBoi[i] * f);
          L = L / ucln(L, ai) * ai;
          if (L > 1e15) break;
        }
        if (L <= 1e15) step = L / f;
      }
      if (!step) { ghi(ng, cp, "multipleOf quá phức tạp / không tương thích — không đảm bảo được"); step = Math.max.apply(null, cacBoi); }
    }
    if (step) {
      var tinh = function (k) { return d ? Number((k * step).toFixed(d)) : k * step; };
      var kLo = Math.ceil(lo / step), kHi = Math.floor(hi / step), n = 0;
      while (n++ < 4 && !(loX ? tinh(kLo) > lo : tinh(kLo) >= lo)) kLo++;
      n = 0; while (n++ < 4 && (loX ? tinh(kLo - 1) > lo : tinh(kLo - 1) >= lo)) kLo--;
      n = 0; while (n++ < 4 && !(hiX ? tinh(kHi) < hi : tinh(kHi) <= hi)) kHi--;
      n = 0; while (n++ < 4 && (hiX ? tinh(kHi + 1) < hi : tinh(kHi + 1) <= hi)) kHi++;
      if (kLo > kHi) { ghi(ng, cp, "Không có bội của " + step + " nào nằm trong miền [" + lo + ", " + hi + "]"); return tinh(kLo); }
      return tinh(kLo + Math.floor(rng.soThuc() * Math.min(kHi - kLo + 1, 9e15)));
    }
    var a = Math.ceil(lo), b = Math.floor(hi);
    if (loX && a === lo) a++;
    if (hiX && b === hi) b--;
    if (nguyen) {
      if (a > b) { ghi(ng, cp, "Không có số nguyên nào trong miền (" + lo + ", " + hi + ")"); return a; }
      return a + Math.floor(rng.soThuc() * Math.min(b - a + 1, 9e15));
    }
    if (a <= b && rng.xacSuat(0.35)) return a + Math.floor(rng.soThuc() * Math.min(b - a + 1, 9e15));
    if (!(hi > lo)) return lo;
    var x = lo + rng.soThuc() * (hi - lo), r = hi - lo, dec = r >= 100 ? 1 : r >= 1 ? 2 : Math.min(12, Math.ceil(-Math.log(r) / Math.LN10) + 2);
    var fy = Math.pow(10, dec), y = Math.round(x * fy) / fy;
    return ok(y) ? y : lo + r / 2;
  }

  /* ----------------------------------------------------- chuoi */
  function sinhChuoi(ng, ds, t, cp) {
    var mn = 0, mx = Infinity, pats = [], fmts = [], i, s, rng = ng.rng, ra;
    for (i = 0; i < ds.length; i++) {
      s = ds[i].s;
      if (laSoNguyenKhongAm(s.minLength) && s.minLength > mn) mn = s.minLength;
      if (laSoNguyenKhongAm(s.maxLength) && s.maxLength < mx) mx = s.maxLength;
      if (typeof s.pattern === "string") pats.push(s.pattern);
      if (typeof s.format === "string" && F.co(s.format)) fmts.push(s.format);
    }
    if (mn > mx) { ghi(ng, cp, "minLength " + mn + " > maxLength " + mx); return ""; }
    if (pats.length && !(fmts.length && t % 2 === 1)) {
      var p = pats[t % pats.length];
      ra = R.sinhTheoMau(p, rng, { doDaiMin: mn, doDaiMax: mx });
      if (!ra.khop) ghi(ng, cp + "/pattern", "pattern " + catNgan(p, 60) + ": " + (ra.canhBao.length ? ra.canhBao.join("; ") : "không sinh được chuỗi khớp"));
      else if (ra.canhBao.length) ghi(ng, cp + "/pattern", "pattern " + catNgan(p, 60) + ": " + ra.canhBao.join("; "));
      return ra.chuoi;
    }
    if (fmts.length) {
      var fm = sinhFormat(fmts[t % fmts.length], rng, mn, mx);
      if (fm !== null) {
        if (R.doDaiCP(fm) < mn || R.doDaiCP(fm) > mx) ghi(ng, cp + "/format", "format " + fmts[t % fmts.length] + " sinh ra chuỗi không nằm trong minLength/maxLength");
        return fm;
      }
    }
    if (mn > TRAN_CHUOI) { ghi(ng, cp, "minLength " + mn + " quá lớn, chỉ sinh tối đa " + TRAN_CHUOI + " ký tự (không đảm bảo thoả minLength)"); mn = TRAN_CHUOI; }
    if (mx > TRAN_CHUOI) mx = TRAN_CHUOI;
    return vanBanTu(rng, mn, mx);
  }

  /* ----------------------------------------------------- mang */
  function sinhMang(ng, ds, sau, tt, cp) {
    var che = ng.bd.che, rng = ng.rng, mn = 0, mx = Infinity, uniq = false, tuples = [], contains = [], i, s, j, q;
    for (i = 0; i < ds.length; i++) {
      s = ds[i].s;
      var V = ds[i], tuple = null, resto, coResto = false, ptCo;
      if (laSoNguyenKhongAm(s.minItems) && s.minItems > mn) mn = s.minItems;
      if (laSoNguyenKhongAm(s.maxItems) && s.maxItems < mx) mx = s.maxItems;
      if (s.uniqueItems === true) uniq = true;
      if (che.p2020) {
        if (Array.isArray(s.prefixItems)) tuple = s.prefixItems;
        if (s.items !== undefined && !Array.isArray(s.items)) { resto = s.items; coResto = true; }
        else if (Array.isArray(s.items) && !tuple) { tuple = s.items; if (s.additionalItems !== undefined) { resto = s.additionalItems; coResto = true; } }
      } else if (Array.isArray(s.items)) { tuple = s.items; if (s.additionalItems !== undefined) { resto = s.additionalItems; coResto = true; } }
      else if (s.items !== undefined) { resto = s.items; coResto = true; }
      var pre = [];
      if (tuple) {
        for (j = 0; j < tuple.length; j++) {
          ptCo = xemTu(ng, tuple[j], V.co);
          pre.push(ptCo);
          if (ptCo && ptCo.s === false && j < mx) mx = j;           /* phan tu j la schema false -> mang khong duoc dai toi j+1 */
        }
      }
      var rv = coResto ? xemTu(ng, resto, V.co) : null;
      if (rv && rv.s === false) { var cap = tuple ? tuple.length : 0; if (cap < mx) mx = cap; rv = null; }
      tuples.push({ pre: pre, rest: rv });
      if (s.contains !== undefined && (laObj(s.contains) || typeof s.contains === "boolean")) {
        var cmin = che.moi && laSoNguyenKhongAm(s.minContains) ? s.minContains : 1, cmax = che.moi && laSoNguyenKhongAm(s.maxContains) ? s.maxContains : Infinity;
        if (!(cmin === 0 && cmax === Infinity)) contains.push({ v: xemTu(ng, s.contains, V.co), min: cmin });
      }
    }
    var lo = mn;
    for (i = 0; i < contains.length; i++) if (contains[i].min > lo) lo = contains[i].min;
    if (lo > mx) { ghi(ng, cp, "Không đủ chỗ cho mảng: cần ≥ " + lo + " phần tử (minItems / contains) nhưng chỉ được ≤ " + mx); mx = lo; }
    var cao = tt ? lo : Math.min(mx, lo + ng.mangToiDa), lo0 = lo;
    if (lo === 0 && cao >= 1 && !tt && rng.xacSuat(0.85)) lo0 = 1;                /* it khi mang rong: mau doc duoc hon */
    var n = tt ? lo : rng.soNguyen(lo0, Math.max(lo0, cao));
    if (n > ng.nganSach) n = ng.nganSach;
    /* chon vi tri cho cac phan tu "contains" */
    var them = [];
    for (i = 0; i < n; i++) them.push([]);
    var idx = [];
    for (i = 0; i < n; i++) idx.push(i);
    var vt = rng.tron(idx);
    for (i = 0; i < contains.length; i++) {
      var dem = Math.min(contains[i].min, n);
      for (j = 0; j < dem; j++) if (contains[i].v) them[vt[(i + j) % n]].push(contains[i].v);
    }
    var out = [], thay = uniq ? new Set() : null;
    for (i = 0; i < n && !ng.thoat; i++) {
      var thu, el, kh;
      for (thu = 0; thu < (uniq ? 12 : 1); thu++) {
        var vws = [];
        for (q = 0; q < tuples.length; q++) {
          var T = tuples[q], v = i < T.pre.length ? T.pre[i] : T.rest;
          if (v) vws.push(v);
        }
        for (q = 0; q < them[i].length; q++) vws.push(them[i][q]);
        el = vws.length ? sinhSpec(ng, vws, sau + 1) : sinhTuDo(ng, sau + 1);
        if (!uniq) break;
        kh = khoaChuan(el);
        if (!thay.has(kh)) { thay.add(kh); break; }
        el = undefined;
      }
      if (el === undefined) {
        if (out.length >= lo) continue;                       /* du phan tu: bo phan tu trung (mang ngan hon van hop le) */
        ghi(ng, cp + "/uniqueItems", "uniqueItems: không sinh đủ giá trị khác nhau cho phần tử [" + i + "]");
        el = null;
      }
      out.push(el);
    }
    return out;
  }

  /* ----------------------------------------------------- object */
  function sinhDoiTuong(ng, ds0, sau, tt, cp) {
    var che = ng.bd.che, rng = ng.rng, ds = ds0, vong, i, j, q, s;
    var giu = [], daDung = new Set(), keys = [], recs, declared, bat, depReq, depSch, minP, maxP, nameVs, batSet, set;

    function thuThap() {
      recs = []; declared = []; bat = []; depReq = Object.create(null); depSch = Object.create(null); minP = 0; maxP = Infinity; nameVs = [];
      var seen = Object.create(null), seenB = Object.create(null);
      for (i = 0; i < ds.length; i++) {
        var V = ds[i]; s = V.s;
        var rec = { V: V, props: laObj(s.properties) ? s.properties : null, pats: [], addlDef: s.additionalProperties !== undefined, addl: s.additionalProperties };
        if (laObj(s.patternProperties)) {
          Object.keys(s.patternProperties).forEach(function (src) {
            var b = ng.regex.get(src);
            if (b === undefined) { b = R.bienDichRegex(src).re; ng.regex.set(src, b); }
            if (b) rec.pats.push({ re: b, src: src, gt: s.patternProperties[src] });
          });
        }
        recs.push(rec);
        if (rec.props) Object.keys(rec.props).forEach(function (k) { if (!seen[k]) { seen[k] = 1; declared.push(k); } });
        if (laChuoiDs(s.required)) s.required.forEach(function (k) { if (!seenB[k]) { seenB[k] = 1; bat.push(k); } });
        if (laSoNguyenKhongAm(s.minProperties) && s.minProperties > minP) minP = s.minProperties;
        if (laSoNguyenKhongAm(s.maxProperties) && s.maxProperties < maxP) maxP = s.maxProperties;
        if (s.propertyNames !== undefined) { var pv = xemTu(ng, s.propertyNames, V.co); if (pv) nameVs.push(pv); }
        if (che.moi && laObj(s.dependentRequired)) Object.keys(s.dependentRequired).forEach(function (k) { if (laChuoiDs(s.dependentRequired[k])) (depReq[k] || (depReq[k] = [])).push.apply(depReq[k], s.dependentRequired[k]); });
        if (che.moi && laObj(s.dependentSchemas)) Object.keys(s.dependentSchemas).forEach(function (k) { (depSch[k] || (depSch[k] = [])).push({ gt: s.dependentSchemas[k], co: V.co }); });
        if (laObj(s.dependencies)) Object.keys(s.dependencies).forEach(function (k) {
          var x = s.dependencies[k];
          if (laChuoiDs(x)) (depReq[k] || (depReq[k] = [])).push.apply(depReq[k], x);
          else if (laObj(x) || typeof x === "boolean") (depSch[k] || (depSch[k] = [])).push({ gt: x, co: V.co });
        });
      }
    }
    function conCua(k) {
      var vs = [], r, p, khop, v;
      for (r = 0; r < recs.length; r++) {
        var rec = recs[r];
        khop = !!(rec.props && coRieng(rec.props, k));
        if (khop) { v = xemTu(ng, rec.props[k], rec.V.co); if (v) vs.push(v); }
        for (p = 0; p < rec.pats.length; p++) {
          if (rec.pats[p].re.test(k)) { khop = true; v = xemTu(ng, rec.pats[p].gt, rec.V.co); if (v) vs.push(v); }
        }
        if (!khop && rec.addlDef) { v = xemTu(ng, rec.addl, rec.V.co); if (v) vs.push(v); }
      }
      return vs;
    }
    function cam(k) { var vs = conCua(k), r; for (r = 0; r < vs.length; r++) if (vs[r].s === false) return true; return false; }
    function tenHopLe(k) {
      var r;
      for (r = 0; r < nameVs.length; r++) if (nameVs[r].nut && !S.kiemNut(nameVs[r].nut, k, ng.bd, TC_KIEM).hopLe) return false;
      return true;
    }
    function them(k) { if (!set[k]) { set[k] = 1; keys.push(k); } }

    var cacKhoaThem = 0;
    function khoaThem() {                                       /* mot khoa MOI hop le cho object nay, hoac null */
      var thu, k, r, jj, pl = [];
      for (r = 0; r < recs.length; r++) for (jj = 0; jj < recs[r].pats.length; jj++) pl.push(recs[r].pats[jj].src);
      for (thu = 0; thu < 25; thu++) {
        if (pl.length) { var mk = R.sinhTheoMau(rng.chon(pl), rng, {}); k = mk.chuoi; }
        else if (nameVs.length) { k = sinhSpec(ng, nameVs, sau + 1, "string"); if (typeof k !== "string") k = null; }
        else k = "khoa_" + (++cacKhoaThem);
        if (k === null || k === undefined) continue;
        if (set[k]) { if (!pl.length && !nameVs.length) continue; else continue; }
        if (cam(k) || !tenHopLe(k)) continue;
        return k;
      }
      return null;
    }

    for (vong = 0; vong < 4; vong++) {
      thuThap();
      set = Object.create(null); keys = [];
      giu.forEach(them);
      bat.forEach(them);
      if (!tt) for (i = 0; i < declared.length; i++) {
        if (!set[declared[i]] && !cam(declared[i]) && tenHopLe(declared[i]) && rng.xacSuat(ng.tiLe)) them(declared[i]);
      }
      for (i = 0; i < keys.length; i++) { var dp = depReq[keys[i]]; if (dp) dp.forEach(them); }       /* bao dong dependentRequired */
      batSet = Object.create(null);
      keys.forEach(function (k) { batSet[k] = 1; });
      /* khoa them: minProperties / object kieu "map" (khong khai bao gi) */
      var canThem = Math.max(0, minP - keys.length);
      if (!tt && !declared.length && !keys.length) {
        var coMau = false;
        for (q = 0; q < recs.length; q++) { if (recs[q].pats.length) coMau = true; else if (recs[q].addlDef && laObj(recs[q].addl) && Object.keys(recs[q].addl).length) coMau = true; }
        if (coMau) canThem = Math.max(canThem, rng.soNguyen(1, 3));
      }
      for (i = 0; i < canThem && !ng.thoat; i++) {
        var kn = null;
        for (j = 0; j < declared.length && kn === null; j++) if (!set[declared[j]] && !cam(declared[j]) && tenHopLe(declared[j])) kn = declared[j];
        if (kn === null) kn = khoaThem();
        if (kn === null) { ghi(ng, cp, "Không tạo được khoá thêm hợp lệ cho minProperties (additionalProperties / propertyNames / patternProperties không cho phép)"); break; }
        them(kn);
        if (depReq[kn]) depReq[kn].forEach(them);
      }
      /* maxProperties: bo khoa tuy chon thua */
      if (keys.length > maxP) {
        var bo = [], gu = Object.create(null);
        bat.forEach(function (k) { gu[k] = 1; });
        giu.forEach(function (k) { gu[k] = 1; });
        for (i = keys.length - 1; i >= 0 && keys.length - bo.length > maxP; i--) if (!gu[keys[i]]) bo.push(keys[i]);
        if (bo.length) { var boSet = Object.create(null); bo.forEach(function (k) { boSet[k] = 1; }); keys = keys.filter(function (k) { return !boSet[k]; }); set = Object.create(null); keys.forEach(function (k) { set[k] = 1; }); }
        if (keys.length > maxP) ghi(ng, cp, "Cần ≥ " + keys.length + " khoá (required / dependentRequired) nhưng maxProperties = " + maxP);
      }
      /* dependentSchemas cua cac khoa co mat: gop them vao danh sach schema cua object, thu thap lai */
      var moi = [];
      for (i = 0; i < keys.length; i++) {
        var ls = depSch[keys[i]];
        if (!ls) continue;
        for (q = 0; q < ls.length; q++) if (laObj(ls[q].gt) ? !daDung.has(ls[q].gt) : !daDung.has(keys[i] + "\u0000" + q)) {
          daDung.add(laObj(ls[q].gt) ? ls[q].gt : keys[i] + "\u0000" + q);
          var xv = xemTu(ng, ls[q].gt, ls[q].co);
          if (xv) moi.push(xv);
        }
      }
      if (!moi.length) break;
      var pf2 = phang(ng, moi, tt, { t: 0, starts: [], coin: null, k: 0 });
      if (pf2.kho) break;
      ds = ds.concat(pf2.ds);
      giu = keys.slice();
    }
    /* thu tu khoa: theo khai bao truoc, khoa them sau */
    var kq = {}, thuTu = [], daCo = Object.create(null);
    declared.forEach(function (k) { if (set[k]) { thuTu.push(k); daCo[k] = 1; } });
    keys.forEach(function (k) { if (!daCo[k]) { thuTu.push(k); daCo[k] = 1; } });
    for (i = 0; i < thuTu.length && !ng.thoat; i++) {
      var vs = conCua(thuTu[i]);
      datKhoa(kq, thuTu[i], vs.length ? sinhSpec(ng, vs, sau + 1) : sinhTuDo(ng, sau + 1));
    }
    return kq;
  }

  /* ======================================================= API */
  function mauMot(bd, tc, seedMau) {
    var thuLai = tc.thuLai, a, tot = null, ng, gt, kq, soThu = 0;
    for (a = 0; a <= thuLai; a++) {
      ng = {
        bd: bd, rng: JE.taoRng(a ? seedMau + "#" + a : seedMau), doSauToiDa: tc.doSauToiDa, mangToiDa: tc.mangToiDa, tiLe: tc.tiLe, dungViDu: tc.dungViDu,
        nganSach: tc.nganSach, buoc: 0, thuNut: 0, thoat: false, ghiChu: new Map(), id: new Map(), nganRef: [], that: new Map(), regex: new Map()
      };
      var goc = xemTu(ng, bd.goc.s, bd.goc.co);
      try { gt = goc === null ? sinhTuDo(ng, 0) : goc.s === false ? (ghi(ng, "#", "Schema gốc là false — không có dữ liệu nào hợp lệ"), null) : sinhSpec(ng, [goc], 0); }
      catch (e) {
        gt = null;
        if (e instanceof RangeError || (e && (e.name === "RangeError" || /call stack|too much recursion/i.test(String(e.message))))) dungSom(ng, "Schema lồng quá sâu — trình duyệt không sinh nổi");
        else dungSom(ng, "Lỗi khi sinh: " + String(e && e.message || e).slice(0, 160));
      }
      if (gt === undefined) gt = null;
      soThu++;
      try { kq = S.kiem(gt, bd, { format: "loi", toiDa: 30 }); }
      catch (e2) {
        kq = { hopLe: false, catBot: false, loi: [{ conTro: "", duong: [], hien: "$", conTroSchema: "#", tuKhoa: "(he-thong)", muc: "loi", chiTiet: {}, thongBao: "Bộ kiểm báo lỗi: " + String(e2 && e2.message || e2).slice(0, 160) }] };
      }
      var diem = kq.loi.length + (ng.thoat ? 1000 : 0);
      if (!tot || diem < tot.diem) tot = { gt: gt, kq: kq, ng: ng, diem: diem };
      if (kq.hopLe || ng.thoat) break;
    }
    return { gt: tot.gt, kq: tot.kq, ng: tot.ng, soThu: soThu };
  }

  function sinhMau(schemaHoacBd, tuyChon) {
    tuyChon = tuyChon || {};
    var bd = schemaHoacBd && schemaHoacBd.laBd ? schemaHoacBd : S.bienDich(schemaHoacBd, { draft: tuyChon.draft, thuVien: tuyChon.thuVien });
    var seed = tuyChon.seed === undefined || tuyChon.seed === null || tuyChon.seed === "" ? "mau" : String(tuyChon.seed);
    var tc = {
      soLuong: kep(nguyenTu(tuyChon.soLuong, 1), 1, 1000), thuLai: kep(nguyenTu(tuyChon.thuLai, 20), 0, 200),
      doSauToiDa: kep(nguyenTu(tuyChon.doSauToiDa, 6), 1, 40), mangToiDa: kep(nguyenTu(tuyChon.mangToiDa, 5), 0, 1000),
      tiLe: typeof tuyChon.tiLeTuyChon === "number" ? kep(tuyChon.tiLeTuyChon, 0, 1) : 0.5,
      dungViDu: typeof tuyChon.dungViDu === "number" ? kep(tuyChon.dungViDu, 0, 1) : 0.3, nganSach: kep(nguyenTu(tuyChon.nganSach, 200000), 100, 5e6)
    };
    var ra = { giaTri: null, hopLe: false, loi: [], khongDamBao: [], ghiChu: [], soLanThu: 0, soBuocNut: 0, soLanThuNut: 0, seed: seed, soLuong: tc.soLuong, loiSchema: bd.loiSchema, catBot: false };
    if (!bd.goc || bd.goc.kieu === 3) {
      ra.khongDamBao.push({ conTroSchema: "#", lyDo: "Schema không hợp lệ (phải là object hoặc true / false)" });
      return ra;
    }
    var mau = [], hopLe = true, k, daCo = Object.create(null), thatBai = false;
    for (k = 0; k < tc.soLuong; k++) {
      var tck = thatBai ? Object.assign({}, tc, { thuLai: Math.min(tc.thuLai, 3) }) : tc;
      var m = mauMot(bd, tck, seed + "/" + k);
      mau.push(m.gt);
      ra.soLanThu += m.soThu;
      ra.soBuocNut += m.ng.buoc;                           /* chan doan: so nut da sinh vs so lan thu o cap nut — bang nhau = moi nut dung ngay lan dau */
      ra.soLanThuNut += m.ng.thuNut;
      if (!m.kq.hopLe) {
        hopLe = false; thatBai = true;
        if (!ra.loi.length) { ra.loi = m.kq.loi; ra.catBot = m.kq.catBot; }
        m.ng.ghiChu.forEach(function (x) { var kh = x.conTroSchema + "\u0000" + x.lyDo; if (!daCo[kh] && ra.khongDamBao.length < 50) { daCo[kh] = 1; ra.khongDamBao.push(x); } });
        m.kq.loi.forEach(function (e) {
          var kh = e.conTroSchema + "\u0000" + e.thongBao;
          if (!daCo[kh] && ra.khongDamBao.length < 50) { daCo[kh] = 1; ra.khongDamBao.push({ conTroSchema: e.conTroSchema, lyDo: e.thongBao, conTro: e.conTro }); }
        });
      } else {
        m.ng.ghiChu.forEach(function (x) { var kh = x.conTroSchema + "\u0000" + x.lyDo; if (!daCo[kh] && ra.ghiChu.length < 50) { daCo[kh] = 1; ra.ghiChu.push(x); } });
      }
    }
    ra.giaTri = tc.soLuong === 1 ? mau[0] : mau;
    ra.hopLe = hopLe;
    return ra;
  }

  JE.schemaSinh = { sinhMau: sinhMau, sinhFormat: sinhFormat, vanBanTu: vanBanTu };
  if (typeof module !== "undefined" && module.exports) module.exports = JE.schemaSinh;
});
