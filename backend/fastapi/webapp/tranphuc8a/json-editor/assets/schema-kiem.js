/* =====================================================================
   schema-kiem.js — bien dich + kiem JSON Schema (module thuan, khuon
   je-chung.js: khong DOM / storage / dong ho; co JE_NGUON cho Worker).

   Chuan chinh 2020-12; tuong thich 2019-09 va draft-07/06/04 (chon theo
   $schema cua schema goc, hoac ep qua tuyChon.draft). Khong tai $ref tu
   mang: $ref toi dia chi ngoai chi giai duoc khi co trong tuyChon.thuVien
   ({ "<$id>": schema }) — con lai bao loi schema ro rang.

   JE.schema:
     bienDich(schema, {draft, thuVien}) -> BD  (loiSchema, canhBao, draft, goc…)
     kiem(duLieu, bdHoacSchema, {format, toiDa, dungSom, draft, thuVien})
        -> { hopLe, loi:[Loi], canhBao:[Loi], catBot, loiSchema, canhBaoSchema, draft }
     kiemNut(nut, giaTri, bd, tuyChon) -> { hopLe, loi }          (cho bo sinh du lieu — dot sau)
     tuKhoaHoTro, trongNhuSchema(v), giaiUri(base, ref)
   Loi = { conTro:"/items/3/email", duong:["items",3,"email"], hien:"$.items[3].email",
           conTroSchema:"#/properties/items/items/properties/email/format", tuKhoa:"format",
           thongBao:"Không phải email hợp lệ: “abc”", muc:"loi"|"canh-bao", chiTiet:{…}, con:[Loi]? }
   chiTiet.laKhoa = true: loi thuoc TEN KHOA (conTro tro toi khoa do);
   chiTiet.khoa: required/dependentRequired — khoa con thieu.

   Chua lam (hoan theo quyet dinh Q8): unevaluatedProperties / unevaluatedItems
   (bao canh bao schema, bi bo qua) — $dynamicRef / $recursiveRef chi xap xi nhu $ref tinh.
   ===================================================================== */
(function (khai) {
  var g = typeof globalThis !== "undefined" ? globalThis : this;
  khai(g);
  (g.JE_NGUON || (g.JE_NGUON = [])).push(khai);
})(function (root) {
  "use strict";
  var JE = root.JE || (root.JE = {});
  var C = JE.chung, F = JE.schemaFormat;
  if (!C || !F) throw new Error("schema-kiem.js cần je-chung.js và schema-format.js nạp trước");
  var coRieng = C.coRieng, kieuCua = C.kieuCua, catNgan = C.catNgan, moTaDuong = C.moTaDuong;
  var duongSangConTro = C.duongSangConTro, bangNhauSau = C.bangNhauSau, khoaChuan = C.khoaChuan;

  var TYPES = ["null", "boolean", "object", "array", "number", "string", "integer"];
  var MAX_SAU_SCHEMA = 200;

  function laObj(x) { return x !== null && typeof x === "object" && !Array.isArray(x); }
  function esc(seg) { return String(seg).replace(/~/g, "~0").replace(/\//g, "~1"); }

  /** Gia tri dua vao thong bao (cat ngan, khong tran). */
  function hien(v) {
    if (v === null) return "null";
    if (Array.isArray(v)) return "mảng " + v.length + " phần tử";
    if (typeof v === "object") return "object " + Object.keys(v).length + " khoá";
    if (typeof v === "string") return "“" + catNgan(v, 40) + "”";
    return catNgan(String(v), 40);
  }
  function json(v, n) {
    var s;
    try { s = JSON.stringify(v); } catch (e) { s = String(v); }
    return catNgan(s === undefined ? "undefined" : s, n || 40);
  }

  function khoangCach(a, b) {
    var m = a.length, n = b.length, i, j, cu, moi, t;
    if (Math.abs(m - n) > 2) return 3;
    cu = []; for (j = 0; j <= n; j++) cu.push(j);
    for (i = 1; i <= m; i++) {
      moi = [i];
      for (j = 1; j <= n; j++) {
        t = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
        moi.push(Math.min(cu[j] + 1, moi[j - 1] + 1, cu[j - 1] + t));
      }
      cu = moi;
    }
    return cu[n];
  }

  /* ----------------------------------------------------- URI (RFC 3986 §5.2) */
  function tachUri(u) {
    var m = /^(?:([^:/?#]+):)?(?:\/\/([^/?#]*))?([^?#]*)(?:\?([^#]*))?(?:#([\s\S]*))?$/.exec(u);
    return { scheme: m[1], auth: m[2], path: m[3] || "", query: m[4], frag: m[5] };
  }
  function boDauCham(p) {
    var ra = [], doan = p.split("/"), i;
    for (i = 0; i < doan.length; i++) {
      if (doan[i] === ".") { if (i === doan.length - 1) ra.push(""); }
      else if (doan[i] === "..") { if (ra.length > 1 || (ra.length === 1 && ra[0] !== "")) ra.pop(); if (i === doan.length - 1) ra.push(""); }
      else ra.push(doan[i]);
    }
    return ra.join("/");
  }
  function dungUri(T) {
    var s = "";
    if (T.scheme !== undefined) s += T.scheme + ":";
    if (T.auth !== undefined) s += "//" + T.auth;
    s += T.path || "";
    if (T.query !== undefined) s += "?" + T.query;
    if (T.frag !== undefined) s += "#" + T.frag;
    return s;
  }
  function giaiUri(base, ref) {
    var R = tachUri(String(ref)), B = tachUri(String(base || "")), T = {};
    if (R.scheme !== undefined) {
      T = { scheme: R.scheme, auth: R.auth, path: boDauCham(R.path), query: R.query };
    } else {
      if (R.auth !== undefined) {
        T = { auth: R.auth, path: boDauCham(R.path), query: R.query };
      } else {
        if (R.path === "") { T.path = B.path; T.query = R.query !== undefined ? R.query : B.query; }
        else {
          if (R.path.charAt(0) === "/") T.path = boDauCham(R.path);
          else {
            var hop = B.auth !== undefined && B.path === "" ? "/" + R.path
              : (B.path.lastIndexOf("/") >= 0 ? B.path.slice(0, B.path.lastIndexOf("/") + 1) : "") + R.path;
            T.path = boDauCham(hop);
          }
          T.query = R.query;
        }
        T.auth = B.auth;
      }
      T.scheme = B.scheme;
    }
    T.frag = R.frag;
    return dungUri(T);
  }
  function boFrag(u) {
    var i = u.indexOf("#");
    return i < 0 ? [u, ""] : [u.slice(0, i), u.slice(i + 1)];
  }

  /* ----------------------------------------------------- draft */
  function xacDinhDraft(goc, tuyChon) {
    var t = tuyChon && tuyChon.draft;
    if (t === "2020-12" || t === "2019-09" || t === "07") return { ten: t };
    if (t === "draft-07" || t === "7" || t === "06" || t === "04") return { ten: "07" };
    if (laObj(goc)) {
      if (typeof goc.$schema === "string") {
        var u = goc.$schema;
        if (/draft-0[3467]/.test(u)) return { ten: "07" };
        if (/2019-09/.test(u)) return { ten: "2019-09" };
        if (/2020-12/.test(u)) return { ten: "2020-12" };
      } else if (Array.isArray(goc.items)) {
        return { ten: "07", canhBao: "Không có $schema mà “items” là mảng — hiểu theo draft-07 (tuple); dùng “prefixItems” nếu muốn 2020-12" };
      }
    }
    return { ten: "2020-12" };
  }

  /* ----------------------------------------------------- nut schema */
  function Nut(s, co, cp) {
    this.s = s; this.co = co; this.cp = cp;
    this.kieu = s === true ? 1 : s === false ? 2 : laObj(s) ? 0 : 3;     /* 0 object · 1 true · 2 false · 3 khong hop le (bo qua) */
    this.buoc = null;
  }

  function nutCua(bd, gt, co, cp) {
    var n;
    if (laObj(gt)) {
      n = bd.nutDt.get(gt);
      if (!n) { n = new Nut(gt, co, cp); bd.nutDt.set(gt, n); }
      return n;
    }
    n = bd.nutCp.get(cp);
    if (!n || n.s !== gt) { n = new Nut(gt, co, cp); bd.nutCp.set(cp, n); }
    return n;
  }

  function loiS(bd, cp, tuKhoa, thongBao, goiY) {
    bd.loiSchema.push({ conTroSchema: tuKhoa ? cp + "/" + esc(tuKhoa) : cp, thongBao: thongBao, goiY: goiY || null, muc: "loi" });
  }
  function canhS(bd, cp, tuKhoa, thongBao, goiY) {
    bd.canhBao.push({ conTroSchema: tuKhoa ? cp + "/" + esc(tuKhoa) : cp, thongBao: thongBao, goiY: goiY || null, muc: "canh-bao" });
  }

  /* ----------------------------------------------------- tu khoa biet */
  var KIEU_CON = {
    properties: "o", patternProperties: "o", dependentSchemas: "o", $defs: "o", definitions: "o",
    allOf: "m", anyOf: "m", oneOf: "m", prefixItems: "m",
    items: "sm", additionalItems: "s", additionalProperties: "s", contains: "s", propertyNames: "s",
    not: "s", "if": "s", then: "s", "else": "s", unevaluatedItems: "s", unevaluatedProperties: "s", contentSchema: "s",
    dependencies: "dep"
  };
  var KHAC_BIET = ["$schema", "$id", "id", "$ref", "$anchor", "$dynamicRef", "$dynamicAnchor", "$comment", "$vocabulary", "$recursiveRef", "$recursiveAnchor",
    "type", "enum", "const", "multipleOf", "maximum", "exclusiveMaximum", "minimum", "exclusiveMinimum", "maxLength", "minLength", "pattern",
    "maxItems", "minItems", "uniqueItems", "maxContains", "minContains", "maxProperties", "minProperties", "required", "dependentRequired",
    "format", "contentEncoding", "contentMediaType", "title", "description", "default", "deprecated", "readOnly", "writeOnly", "examples"];
  var TU_KHOA_BIET = Object.create(null);
  KHAC_BIET.concat(Object.keys(KIEU_CON)).forEach(function (k) { TU_KHOA_BIET[k] = true; });
  var DS_TU_KHOA_BIET = Object.keys(TU_KHOA_BIET);

  var BANG_HO_TRO = [
    ["true / false (schema boolean)", "mọi draft", "co", ""],
    ["type", "mọi draft", "co", "integer: số không có phần lẻ (1.0 là integer)"],
    ["enum, const", "mọi draft", "co", "so sánh sâu, không kể thứ tự khoá"],
    ["properties, patternProperties, additionalProperties", "mọi draft", "co", "khoá lạ báo ở chính tên khoá"],
    ["required, propertyNames, minProperties, maxProperties", "mọi draft", "co", ""],
    ["prefixItems + items", "2020-12", "co", ""],
    ["items (mảng) + additionalItems", "07 / 2019-09", "co", "tuple kiểu cũ; vẫn hiểu khi không có $schema"],
    ["minItems, maxItems, uniqueItems", "mọi draft", "co", ""],
    ["contains, minContains, maxContains", "2019-09+", "co", "draft-07 chỉ có contains"],
    ["minimum, maximum, exclusiveMinimum, exclusiveMaximum", "mọi draft", "co", "dạng số (06+) và dạng boolean (draft-04)"],
    ["multipleOf", "mọi draft", "co", "tính theo thang thập phân (0.1 là bội của 0.01)"],
    ["minLength, maxLength", "mọi draft", "co", "đếm ký tự Unicode (emoji = 1)"],
    ["pattern", "mọi draft", "co", "RegExp của trình duyệt (cờ u); mẫu quay lui thảm hoạ → báo hết giờ"],
    ["format", "mọi draft", "co", "date-time, date, time, duration, email, idn-email, hostname, idn-hostname, ipv4, ipv6, uri, uri-reference, iri, iri-reference, uuid, regex, json-pointer, relative-json-pointer, uri-template; mặc định mức cảnh báo"],
    ["allOf, anyOf, oneOf, not", "mọi draft", "co", "anyOf / oneOf sai hết: nhánh gần đúng nhất kèm theo"],
    ["if / then / else", "07+", "co", ""],
    ["dependentRequired, dependentSchemas", "2019-09+", "co", ""],
    ["dependencies", "07", "co", "vẫn hiểu ở 2019-09+ (kèm cảnh báo lỗi thời)"],
    ["$ref, $defs, definitions, $anchor, $id", "mọi draft", "co", "$ref cục bộ (kể cả vòng); $ref anh em: 2019-09+ vẫn áp dụng, ≤ 07 bị bỏ qua"],
    ["$ref tới địa chỉ ngoài (http…)", "—", "khong", "không tải mạng (ứng dụng chạy offline) — hãy dán schema đó vào $defs"],
    ["$dynamicRef, $recursiveRef", "2019-09+", "mot-phan", "xấp xỉ: giải như $ref tĩnh"],
    ["unevaluatedProperties, unevaluatedItems", "2019-09+", "khong", "chưa hỗ trợ (hoãn) — bị bỏ qua, kèm cảnh báo"],
    ["title, description, default, examples, deprecated, readOnly, writeOnly, $comment, content*", "mọi draft", "co", "chú thích, không kiểm"]
  ].map(function (r) { return { tu: r[0], draft: r[1], muc: r[2], ghiChu: r[3] }; });

  /* ----------------------------------------------------- bien dich */
  function layRegex(bd, src) {
    if (bd.regex.has(src)) return bd.regex.get(src);
    var re = null, canh = null;
    try { re = new RegExp(src, "u"); }
    catch (e) {
      try { re = new RegExp(src); canh = "chỉ hợp lệ khi không dùng cờ Unicode (u)"; }
      catch (e2) { re = null; canh = String(e2.message || e2); }
    }
    bd.regex.set(src, re);
    if (!re) bd.regexLoi.set(src, canh); else if (canh) bd.regexCanh.set(src, canh);
    return re;
  }

  function laSoNguyenKhongAm(x) { return typeof x === "number" && x >= 0 && Math.floor(x) === x; }
  function laChuoiDs(a) { return Array.isArray(a) && a.every(function (x) { return typeof x === "string"; }); }

  /** Lint gia tri cua MOT tu khoa (khong de quy vao schema con — quet() lo). */
  function lintTuKhoa(bd, gt, kw, cp) {
    var v = gt[kw], che = bd.che;
    var sai = function (msg) { loiS(bd, cp, kw, msg); };
    switch (kw) {
      case "type":
        if (typeof v === "string") { if (TYPES.indexOf(v) < 0) sai("“type” không biết kiểu “" + v + "” (chỉ nhận " + TYPES.join(", ") + ")"); }
        else if (Array.isArray(v)) {
          if (!v.length) sai("“type” là mảng rỗng");
          v.forEach(function (t) { if (TYPES.indexOf(t) < 0) sai("“type” không biết kiểu " + json(t)); });
          if (new Set(v).size !== v.length) sai("“type” có kiểu trùng nhau");
        } else sai("“type” phải là chuỗi hoặc mảng chuỗi");
        break;
      case "enum":
        if (!Array.isArray(v)) sai("“enum” phải là mảng");
        else if (!v.length) canhS(bd, cp, kw, "“enum” rỗng — không giá trị nào hợp lệ");
        break;
      case "required":
        if (typeof v === "boolean") canhS(bd, cp, kw, "“required: " + v + "” là cú pháp draft-03 — bị bỏ qua (dùng mảng tên khoá)");
        else if (!laChuoiDs(v)) sai("“required” phải là mảng chuỗi");
        else if (new Set(v).size !== v.length) canhS(bd, cp, kw, "“required” có khoá trùng nhau");
        break;
      case "minimum": case "maximum": case "multipleOf":
        if (typeof v !== "number") sai("“" + kw + "” phải là số");
        else if (kw === "multipleOf" && !(v > 0)) sai("“multipleOf” phải lớn hơn 0");
        break;
      case "exclusiveMinimum": case "exclusiveMaximum":
        if (typeof v === "boolean") { if (che.moi) canhS(bd, cp, kw, "“" + kw + "” dạng boolean là cú pháp draft-04 — vẫn hiểu theo draft-04"); }
        else if (typeof v !== "number") sai("“" + kw + "” phải là số");
        break;
      case "minLength": case "maxLength": case "minItems": case "maxItems": case "minProperties": case "maxProperties":
      case "minContains": case "maxContains":
        if (!laSoNguyenKhongAm(v)) sai("“" + kw + "” phải là số nguyên không âm");
        break;
      case "uniqueItems":
        if (typeof v !== "boolean") sai("“uniqueItems” phải là true hoặc false");
        break;
      case "pattern":
        if (typeof v !== "string") sai("“pattern” phải là chuỗi");
        else {
          layRegex(bd, v);
          if (bd.regexLoi.has(v)) sai("“pattern” không phải biểu thức chính quy hợp lệ: " + bd.regexLoi.get(v));
          else if (bd.regexCanh.has(v)) canhS(bd, cp, kw, "“pattern” " + bd.regexCanh.get(v));
        }
        break;
      case "format":
        if (typeof v !== "string") sai("“format” phải là chuỗi");
        else if (!F.co(v)) canhS(bd, cp, kw, "Format lạ “" + v + "” — bỏ qua (không kiểm)");
        break;
      case "$ref": case "$id": case "id": case "$anchor": case "$dynamicRef": case "$dynamicAnchor": case "$recursiveRef":
        if (typeof v !== "string") sai("“" + kw + "” phải là chuỗi");
        else if ((kw === "$anchor" || kw === "$dynamicAnchor") && !/^[A-Za-z_][-A-Za-z0-9._]*$/.test(v)) canhS(bd, cp, kw, "Tên neo “" + v + "” không đúng dạng [A-Za-z_][-A-Za-z0-9._]*");
        break;
      case "properties": case "patternProperties": case "dependentSchemas": case "$defs": case "definitions":
        if (!laObj(v)) sai("“" + kw + "” phải là object");
        else if (kw === "patternProperties") {
          Object.keys(v).forEach(function (src) {
            layRegex(bd, src);
            if (bd.regexLoi.has(src)) loiS(bd, cp + "/patternProperties", src, "Khoá “" + catNgan(src, 40) + "” của patternProperties không phải biểu thức chính quy hợp lệ");
          });
        }
        break;
      case "allOf": case "anyOf": case "oneOf": case "prefixItems":
        if (!Array.isArray(v) || (!v.length && kw !== "prefixItems")) sai("“" + kw + "” phải là mảng không rỗng các schema");
        break;
      case "items":
        if (!(Array.isArray(v) || laObj(v) || typeof v === "boolean")) sai("“items” phải là schema hoặc mảng schema");
        else if (Array.isArray(v) && che.p2020 && typeof gt.$schema === "string") canhS(bd, cp, kw, "Ở 2020-12 “items” phải là schema — dùng “prefixItems” cho tuple (vẫn hiểu như tuple)");
        break;
      case "additionalItems": case "additionalProperties": case "contains": case "propertyNames": case "not": case "if": case "then": case "else":
      case "unevaluatedItems": case "unevaluatedProperties": case "contentSchema":
        if (!(laObj(v) || typeof v === "boolean")) sai("“" + kw + "” phải là schema (object hoặc true/false)");
        if (kw === "unevaluatedProperties" || kw === "unevaluatedItems") {
          canhS(bd, cp, kw, "“" + kw + "” chưa được hỗ trợ — bị bỏ qua (kết quả có thể lỏng hơn thực tế)");
        }
        break;
      case "dependentRequired":
        if (!laObj(v)) sai("“dependentRequired” phải là object");
        else Object.keys(v).forEach(function (k) { if (!laChuoiDs(v[k])) loiS(bd, cp + "/dependentRequired", k, "Giá trị phải là mảng chuỗi"); });
        break;
      case "dependencies":
        if (!laObj(v)) sai("“dependencies” phải là object");
        else if (che.moi) canhS(bd, cp, kw, "“dependencies” đã lỗi thời từ 2019-09 — dùng “dependentRequired” / “dependentSchemas” (vẫn kiểm)");
        break;
      case "$schema":
        if (typeof v !== "string") sai("“$schema” phải là chuỗi");
        break;
      default:
        break;
    }
    if (kw === "$dynamicRef" || kw === "$recursiveRef") canhS(bd, cp, kw, "“" + kw + "” chỉ hỗ trợ xấp xỉ (giải như $ref tĩnh)");
    if ((kw === "prefixItems" && !che.p2020) || (!che.moi && (kw === "dependentRequired" || kw === "dependentSchemas" || kw === "minContains" || kw === "maxContains"))) {
      canhS(bd, cp, kw, "“" + kw + "” là từ khoá của " + (kw === "prefixItems" ? "2020-12" : "2019-09 / 2020-12") + " — bị bỏ qua ở draft " + che.ten);
    }
  }

  function layId(gt, che) {
    if (typeof gt.$id === "string") return gt.$id;
    if (!che.moi && typeof gt.id === "string") return gt.id;
    return undefined;
  }

  function dangKyTaiNguyen(bd, uri, gt, cp) {
    var tn = { uri: uri, goc: gt, cp: cp, neo: new Map() };
    if (bd.taiNguyen.has(uri)) { canhS(bd, cp, "$id", "$id “" + uri + "” trùng với một schema khác — dùng cái đầu tiên"); return tn; }
    bd.taiNguyen.set(uri, tn);
    return tn;
  }

  /** Di khap schema: dang ky $id / $anchor, lint tu khoa, tao nut cho moi schema con. */
  function quet(bd, gt, co, cp, tai, sau) {
    var che = bd.che;
    if (sau > MAX_SAU_SCHEMA) { loiS(bd, cp, "", "Schema lồng quá sâu (> " + MAX_SAU_SCHEMA + " cấp)"); return nutCua(bd, gt, co, cp); }
    if (typeof gt === "boolean") return nutCua(bd, gt, co, cp);
    if (!laObj(gt)) {
      loiS(bd, cp, "", "Schema phải là object hoặc true/false, đang là " + kieuCua(gt));
      return nutCua(bd, gt, co, cp);
    }
    var coMoi = co, taiMoi = tai, id = layId(gt, che);
    if (typeof id === "string") {
      if (id.charAt(0) === "#") {
        if (!che.moi) { if (id.length > 1) tai.neo.set(id.slice(1), gt); }
        else canhS(bd, cp, "$id", "$id “" + id + "” là cú pháp neo của draft-07 — dùng “$anchor”");
      } else {
        coMoi = boFrag(giaiUri(co, id))[0];
        if (sau > 0 || coMoi !== co) taiMoi = dangKyTaiNguyen(bd, coMoi, gt, cp);
        else if (sau === 0) taiMoi = tai;
      }
    }
    if (che.moi) {
      if (typeof gt.$anchor === "string") taiMoi.neo.set(gt.$anchor, gt);
      if (typeof gt.$dynamicAnchor === "string") taiMoi.neo.set(gt.$dynamicAnchor, gt);
    }
    var n = nutCua(bd, gt, coMoi, cp), ks = Object.keys(gt), i, j, kw, v, ccp;
    n.co = coMoi;
    for (i = 0; i < ks.length; i++) {
      kw = ks[i];
      if (!TU_KHOA_BIET[kw]) {
        if (/^(x-|\$)/.test(kw) && kw.charAt(0) !== "$") continue;           /* x-… la mo rong rieng */
        var gan = null, kc = 3;
        /* Goi y go sai (~60 phep Levenshtein / tu khoa) chi cho 200 tu khoa la DAU TIEN moi lan bienDich: schema co hang chuc
           nghin tu khoa la khong duoc ton hang giay chi de goi y (do: 20 000 tu khoa = 1,9 s). Canh bao van co cho moi tu khoa. */
        if ((bd.soGoiY = (bd.soGoiY || 0) + 1) <= 200) {
          for (j = 0; j < DS_TU_KHOA_BIET.length; j++) {
            var d = khoangCach(kw.toLowerCase(), DS_TU_KHOA_BIET[j].toLowerCase());
            if (d < kc) { kc = d; gan = DS_TU_KHOA_BIET[j]; }
          }
        }
        canhS(bd, cp, kw, "Từ khoá lạ “" + catNgan(kw, 40) + "” — bị bỏ qua" + (gan && kc <= 2 ? " (có phải “" + gan + "”?)" : ""), gan && kc <= 2 ? gan : null);
        continue;
      }
      lintTuKhoa(bd, gt, kw, cp);
      v = gt[kw];
      ccp = cp + "/" + esc(kw);
      var loai = KIEU_CON[kw];
      if (loai === "s") quet(bd, v, coMoi, ccp, taiMoi, sau + 1);
      else if (loai === "m" && Array.isArray(v)) { for (j = 0; j < v.length; j++) quet(bd, v[j], coMoi, ccp + "/" + j, taiMoi, sau + 1); }
      else if (loai === "o" && laObj(v)) { Object.keys(v).forEach(function (k) { quet(bd, v[k], coMoi, ccp + "/" + esc(k), taiMoi, sau + 1); }); }
      else if (loai === "sm") {
        if (Array.isArray(v)) { for (j = 0; j < v.length; j++) quet(bd, v[j], coMoi, ccp + "/" + j, taiMoi, sau + 1); }
        else quet(bd, v, coMoi, ccp, taiMoi, sau + 1);
      } else if (loai === "dep" && laObj(v)) {
        Object.keys(v).forEach(function (k) {
          if (!Array.isArray(v[k])) quet(bd, v[k], coMoi, ccp + "/" + esc(k), taiMoi, sau + 1);
          else if (!laChuoiDs(v[k])) loiS(bd, ccp, k, "Phụ thuộc phải là mảng chuỗi hoặc schema");
        });
      }
    }
    if (typeof gt.$ref === "string") {
      bd.refs.push({ nut: n, ref: gt.$ref, kw: "$ref", cp: cp });
      if (!che.moi && ks.length > 1) {
        var anhEm = ks.filter(function (k) { return k !== "$ref" && TU_KHOA_BIET[k] && ["title", "description", "$comment", "$schema", "$id", "id", "definitions", "$defs", "default", "examples"].indexOf(k) < 0; });
        if (anhEm.length) canhS(bd, cp, "$ref", "Draft-07: các từ khoá cạnh “$ref” (" + anhEm.slice(0, 3).join(", ") + ") bị bỏ qua");
      }
    }
    if (che.moi && typeof gt.$dynamicRef === "string") bd.refs.push({ nut: n, ref: gt.$dynamicRef, kw: "$dynamicRef", cp: cp });
    if (che.moi && typeof gt.$recursiveRef === "string") bd.refs.push({ nut: n, ref: gt.$recursiveRef, kw: "$recursiveRef", cp: cp });
    return n;
  }

  /* ----------------------------------------------------- giai $ref */
  function giaiConTroTrongTaiNguyen(tn, frag) {
    var s = frag;
    try { s = decodeURIComponent(frag); } catch (e) { return null; }
    var doan = s.split("/").slice(1), cur = tn.goc, co = tn.uri, cp = tn.cp, i;
    for (i = 0; i < doan.length; i++) {
      if (/~(?![01])/.test(doan[i])) return null;
      var k = doan[i].replace(/~1/g, "/").replace(/~0/g, "~");
      if (Array.isArray(cur)) {
        if (!/^(0|[1-9]\d*)$/.test(k) || +k >= cur.length) return null;
        cur = cur[+k];
      } else if (laObj(cur) && coRieng(cur, k)) cur = cur[k];
      else return null;
      cp += "/" + esc(k);
      if (laObj(cur) && typeof cur.$id === "string" && cur.$id.charAt(0) !== "#") co = boFrag(giaiUri(co, cur.$id))[0];
    }
    return { gt: cur, co: co, cp: cp };
  }

  function giaiRef(bd, nut, ref, kw) {
    var key = nut.co + "\u0000" + ref + "\u0000" + kw;
    if (bd.refCache.has(key)) return bd.refCache.get(key);
    var kq = giaiRefThat(bd, nut, ref, kw);
    bd.refCache.set(key, kq);
    return kq;
  }

  function giaiRefThat(bd, nut, ref, kw) {
    var abs = giaiUri(nut.co, ref), ph = boFrag(abs), docUri = ph[0], frag = ph[1];
    var tn = bd.taiNguyen.get(docUri), dich = null;
    if (!tn) {
      if (docUri === "") return { loi: "Không tìm thấy $ref “" + catNgan(ref, 60) + "”" };
      return { loi: "Không tải được $ref ngoài (ứng dụng chạy offline): " + catNgan(abs, 80), ngoai: true };
    }
    if (frag === "") dich = { gt: tn.goc, co: tn.uri, cp: tn.cp };
    else if (frag.charAt(0) === "/") dich = giaiConTroTrongTaiNguyen(tn, frag);
    else {
      var ten = frag;
      try { ten = decodeURIComponent(frag); } catch (e) { /* giu nguyen */ }
      var g = tn.neo.get(ten);
      if (g !== undefined) dich = { gt: g, co: tn.uri, cp: bd.cpCua.get(g) || tn.cp };
      else if (kw === "$recursiveRef" || kw === "$dynamicRef") dich = null;
    }
    if (!dich) return { loi: "Không tìm thấy $ref “" + catNgan(ref, 60) + "”" };
    var n = nutCua(bd, dich.gt, dich.co, dich.cp);
    return { nut: n };
  }

  /** bd.cpCua: schema object -> con tro goc cua no (cho neo). Dung sau khi quet. */
  function ghiCpCua(bd) {
    bd.nutDt.forEach(function (n, gt) { bd.cpCua.set(gt, n.cp); });
  }

  function bienDich(schema, tuyChon) {
    tuyChon = tuyChon || {};
    var dr = xacDinhDraft(schema, tuyChon);
    var che = { ten: dr.ten, moi: dr.ten !== "07", p2020: dr.ten === "2020-12" };
    var bd = {
      laBd: true, goc: null, che: che, draft: dr.ten, loiSchema: [], canhBao: [],
      nutDt: new Map(), nutCp: new Map(), cpCua: new Map(), taiNguyen: new Map(), thuVien: tuyChon.thuVien || null,
      regex: new Map(), regexLoi: new Map(), regexCanh: new Map(), refCache: new Map(), refs: []
    };
    if (dr.canhBao) canhS(bd, "#", "", dr.canhBao);
    var thuVien = tuyChon.thuVien;
    if (thuVien && laObj(thuVien)) {
      Object.keys(thuVien).forEach(function (id) {
        var s = thuVien[id], uri = boFrag(id)[0];
        var tn = dangKyTaiNguyen(bd, uri, s, uri + "#");
        quet(bd, s, uri, uri + "#", tn, 1);
      });
    }
    var uriGoc = "";
    var id = laObj(schema) ? layId(schema, che) : undefined;
    if (typeof id === "string" && id.charAt(0) !== "#") uriGoc = boFrag(giaiUri("", id))[0];
    var tnGoc = dangKyTaiNguyen(bd, uriGoc, schema, "#");
    bd.goc = quet(bd, schema, uriGoc, "#", tnGoc, 0);
    ghiCpCua(bd);
    /* kiem moi $ref co giai duoc khong (de bao loi schema ngay, khong cho den khi gap du lieu) */
    bd.refs.forEach(function (r) {
      var kq = giaiRef(bd, r.nut, r.ref, r.kw);
      if (kq.loi) loiS(bd, r.cp, r.kw, kq.loi);
    });
    bd.nutTheoConTro = function (conTro) {
      var tn = bd.taiNguyen.get(uriGoc), d = tn ? giaiConTroTrongTaiNguyen(tn, String(conTro).replace(/^#/, "")) : null;
      return d ? nutCua(bd, d.gt, d.co, d.cp) : null;
    };
    /** Cho bo sinh du lieu (schema-sinh.js): giai `ref` tuong doi voi URI co so `co` -> { nut } | { loi, ngoai? } (co cache nhu luc kiem). */
    bd.giaiRefTu = function (co, ref, kw) { return giaiRef(bd, { co: co }, ref, kw || "$ref"); };
    return bd;
  }

  /* ----------------------------------------------------- danh gia */
  function them(ng, nut, tuKhoa, thongBao, chiTiet, duongPhu, muc) {
    var canh = muc === "canh-bao", sink = canh ? ng.cb : ng.loi;
    if (!sink) return false;
    if (canh) {
      if (ng.demCb >= ng.toiDa) { ng.catCb = true; return false; }
      ng.demCb++;
    } else if (ng.dem >= ng.toiDa) {                     /* loi thu toiDa+1: bo no va moi bao "cat bot" (dung toiDa loi thi KHONG cat) */
      ng.cat = true;
      return false;
    }
    var d = ng.d.slice();
    if (duongPhu !== undefined) d.push(duongPhu);
    var e = {
      conTro: duongSangConTro(d), duong: d, hien: moTaDuong(d),
      conTroSchema: tuKhoa === "" ? nut.cp : nut.cp + "/" + esc(tuKhoa), tuKhoa: tuKhoa === "" ? "false" : tuKhoa,
      thongBao: thongBao, muc: canh ? "canh-bao" : "loi", chiTiet: chiTiet || {}
    };
    sink.push(e);
    if (!canh) ng.dem++;
    return false;
  }

  function dungLai(ng) { return ng.dungSom || ng.cat; }

  function danhGia(nut, v, ng) {
    var k = nut.kieu;
    if (k === 1 || k === 3) return true;
    if (k === 2) { if (ng.loi) them(ng, nut, "", "Schema false: không giá trị nào hợp lệ ở đây"); return false; }
    var B = nut.buoc || bienDichBuoc(ng.bd, nut), ok = true, ds = B.chung, i, t = typeof v;
    for (i = 0; i < ds.length; i++) {
      if (!ds[i](v, ng)) { ok = false; if (ng.dungSom || ng.cat) return false; }
    }
    if (t === "number") ds = B.so;
    else if (t === "string") ds = B.chuoi;
    else if (t === "object" && v !== null) ds = Array.isArray(v) ? B.mang : B.dt;
    else return ok;
    for (i = 0; i < ds.length; i++) {
      if (!ds[i](v, ng)) { ok = false; if (ng.dungSom || ng.cat) return false; }
    }
    return ok;
  }

  /** Danh gia KHONG ghi loi (not / if / contains…): dung som o loi dau tien. */
  function danhGiaIm(nut, v, ng) {
    var l = ng.loi, c = ng.cb, ds = ng.dungSom, dem = ng.dem, demCb = ng.demCb, cat = ng.cat;
    ng.loi = null; ng.cb = null; ng.dungSom = true;
    try {
      return danhGia(nut, v, ng);
    } finally {
      /* Khoi phuc CA KHI nem loi (tran ngan xep): chayDanhGia ghi loi "long qua sau" vao ng.loi — neu con null thi TypeError. */
      ng.loi = l; ng.cb = c; ng.dungSom = ds; ng.dem = dem; ng.demCb = demCb; ng.cat = cat;
    }
  }

  /** Thu mot nhanh voi sink rieng; loi cua nhanh khong tinh vao tong cho den khi duoc chon. */
  function thuNhanh(nut, v, ng) {
    var l = ng.loi, c = ng.cb, dem = ng.dem, demCb = ng.demCb, cat = ng.cat, catCb = ng.catCb;
    var nl = l ? [] : null, nc = c ? [] : null;
    ng.loi = nl; ng.cb = nc;
    var r;
    try {
      r = danhGia(nut, v, ng);
    } finally {
      ng.loi = l; ng.cb = c; ng.dem = dem; ng.demCb = demCb; ng.cat = cat; ng.catCb = catCb;      /* ca khi nem loi (xem danhGiaIm) */
    }
    return { ok: r, loi: nl, cb: nc };
  }

  function gopCanhBao(ng, cb) {
    if (!cb || !ng.cb) return;
    for (var i = 0; i < cb.length; i++) {
      if (ng.demCb >= ng.toiDa) { ng.catCb = true; return; }
      ng.demCb++; ng.cb.push(cb[i]);
    }
  }

  function doSauLoi(ds) {
    var m = 0;
    for (var i = 0; i < ds.length; i++) if (ds[i].duong.length > m) m = ds[i].duong.length;
    return m;
  }
  function nhanhGanDung(kq) {
    var tot = -1, i;
    for (i = 0; i < kq.length; i++) {
      if (tot < 0) { tot = i; continue; }
      var a = kq[i].loi.length, b = kq[tot].loi.length;
      if (a < b || (a === b && doSauLoi(kq[i].loi) > doSauLoi(kq[tot].loi))) tot = i;
    }
    return tot;
  }

  function con(bd, nut, kw, k) {
    var gt = k === undefined ? nut.s[kw] : nut.s[kw][k];
    var cp = nut.cp + "/" + esc(kw) + (k === undefined ? "" : "/" + esc(k));
    return nutCua(bd, gt, nut.co, cp);
  }

  /* --- cac buoc --- */
  function buocRef(bd, nut, ref, kw) {
    var dich;
    return function (v, ng) {
      if (dich === undefined) dich = giaiRef(bd, nut, ref, kw);
      if (!dich.nut) { if (ng.loi) them(ng, nut, kw, dich.loi, { ref: ref }); return false; }
      var d = dich.nut, sau = ng.d.length, cu = ng.dang.get(d);
      if (cu === sau) {
        if (ng.loi) them(ng, nut, kw, "Vòng $ref không tiến vào dữ liệu: “" + catNgan(ref, 40) + "” tự dẫn về chính nó", { ref: ref });
        return false;
      }
      ng.dang.set(d, sau);
      var r = danhGia(d, v, ng);
      if (cu === undefined) ng.dang.delete(d); else ng.dang.set(d, cu);
      return r;
    };
  }

  function buocType(nut, t) {
    var ds = (Array.isArray(t) ? t : [t]).filter(function (x) { return TYPES.indexOf(x) >= 0; });
    if (!ds.length) return null;
    var tenCan = ds.join(" hoặc ");
    return function (v, ng) {
      var k = kieuCua(v), i;
      for (i = 0; i < ds.length; i++) {
        if (k === ds[i] || (ds[i] === "integer" && k === "number" && Number.isInteger(v))) return true;
      }
      if (ng.loi) them(ng, nut, "type", "Sai kiểu: cần " + tenCan + ", đang là " + k +
        (k === "object" || k === "array" ? "" : " (" + json(v) + ")"), { can: ds, co: k });
      return false;
    };
  }

  function buocEnum(nut, ds) {
    var mau = ds.slice(0, 6).map(function (x) { return json(x, 24); }).join(", ") + (ds.length > 6 ? ", … (+" + (ds.length - 6) + ")" : "");
    return function (v, ng) {
      for (var i = 0; i < ds.length; i++) if (bangNhauSau(v, ds[i])) return true;
      if (ng.loi) them(ng, nut, "enum", "Chỉ nhận một trong: " + mau, { cho: ds.length });
      return false;
    };
  }

  function buocConst(nut, c) {
    return function (v, ng) {
      if (bangNhauSau(v, c)) return true;
      if (ng.loi) them(ng, nut, "const", "Phải bằng đúng " + json(c, 40), {});
      return false;
    };
  }

  function buocAllOf(bd, nut, n) {
    var ds = [], i;
    for (i = 0; i < n; i++) ds.push(con(bd, nut, "allOf", i));
    return function (v, ng) {
      var ok = true;
      for (var j = 0; j < ds.length; j++) {
        if (!danhGia(ds[j], v, ng)) { ok = false; if (dungLai(ng)) return false; }
      }
      return ok;
    };
  }

  function buocAnyOf(bd, nut, n) {
    var ds = [], i;
    for (i = 0; i < n; i++) ds.push(con(bd, nut, "anyOf", i));
    return function (v, ng) {
      var kq = [], j;
      if (!ng.loi) {                                                  /* im lang: dung o nhanh dau tien dung */
        for (j = 0; j < ds.length; j++) if (danhGia(ds[j], v, ng)) return true;
        return false;
      }
      for (j = 0; j < ds.length; j++) {
        var r = thuNhanh(ds[j], v, ng);
        if (r.ok) { gopCanhBao(ng, r.cb); return true; }
        kq.push(r);
      }
      var tot = nhanhGanDung(kq);
      them(ng, nut, "anyOf", "Không khớp lựa chọn nào trong anyOf (" + ds.length + ")" + (tot >= 0 ? " — gần đúng nhất là lựa chọn #" + tot : ""),
        { soNhanh: ds.length, nhanhGanNhat: tot });
      if (tot >= 0) ng.loi[ng.loi.length - 1].con = kq[tot].loi;
      return false;
    };
  }

  function buocOneOf(bd, nut, n) {
    var ds = [], i;
    for (i = 0; i < n; i++) ds.push(con(bd, nut, "oneOf", i));
    return function (v, ng) {
      var khop = [], kq = [], j, r;
      if (!ng.loi) {
        for (j = 0; j < ds.length; j++) if (danhGia(ds[j], v, ng) && ++khop.length > 1) return false;
        return khop.length === 1;
      }
      for (j = 0; j < ds.length; j++) {
        r = thuNhanh(ds[j], v, ng);
        kq.push(r);
        if (r.ok) khop.push(j);
      }
      if (khop.length === 1) { gopCanhBao(ng, kq[khop[0]].cb); return true; }
      if (khop.length > 1) {
        them(ng, nut, "oneOf", "Khớp " + khop.length + " lựa chọn (" + khop.map(function (x) { return "#" + x; }).join(", ") + ") trong oneOf — chỉ được đúng một", { khop: khop });
        return false;
      }
      var tot = nhanhGanDung(kq);
      them(ng, nut, "oneOf", "Không khớp lựa chọn nào trong oneOf (" + ds.length + ")" + (tot >= 0 ? " — gần đúng nhất là lựa chọn #" + tot : ""), { soNhanh: ds.length, nhanhGanNhat: tot, khop: [] });
      if (tot >= 0) ng.loi[ng.loi.length - 1].con = kq[tot].loi;
      return false;
    };
  }

  function buocNot(bd, nut) {
    var n = con(bd, nut, "not");
    return function (v, ng) {
      if (!danhGiaIm(n, v, ng)) return true;
      if (ng.loi) them(ng, nut, "not", "Không được khớp schema trong “not”", {});
      return false;
    };
  }

  function buocIf(bd, nut, S) {
    var nIf = con(bd, nut, "if");
    var nThen = S.then !== undefined ? con(bd, nut, "then") : null, nElse = S.else !== undefined ? con(bd, nut, "else") : null;
    if (!nThen && !nElse) return null;
    return function (v, ng) {
      var dung = danhGiaIm(nIf, v, ng), nhanh = dung ? nThen : nElse;
      if (!nhanh) return true;
      var l = ng.loi, tam = l ? [] : null, r;
      ng.loi = tam;
      try { r = danhGia(nhanh, v, ng); }
      finally { ng.loi = l; }                                      /* ca khi nem loi (xem danhGiaIm) */
      if (tam) {
        for (var i = 0; i < tam.length; i++) {
          tam[i].thongBao = (dung ? "Vì khớp điều kiện “if”: " : "Vì không khớp điều kiện “if”: ") + tam[i].thongBao;
          l.push(tam[i]);
        }
      }
      return r;
    };
  }

  function buocSo(nut, S, che) {
    var ra = [], min = S.minimum, max = S.maximum, exMin = S.exclusiveMinimum, exMax = S.exclusiveMaximum;
    var typeNum = function (x) { return typeof x === "number"; };
    if (typeNum(min)) {
      var loaiTru = exMin === true;
      ra.push(function (v, ng) {
        if (loaiTru ? v > min : v >= min) return true;
        if (ng.loi) them(ng, nut, "minimum", "Phải " + (loaiTru ? "> " : "≥ ") + min + ", đang là " + v, { gioiHan: min, loaiTru: loaiTru });
        return false;
      });
    }
    if (typeNum(max)) {
      var loaiTruMax = exMax === true;
      ra.push(function (v, ng) {
        if (loaiTruMax ? v < max : v <= max) return true;
        if (ng.loi) them(ng, nut, "maximum", "Phải " + (loaiTruMax ? "< " : "≤ ") + max + ", đang là " + v, { gioiHan: max, loaiTru: loaiTruMax });
        return false;
      });
    }
    if (typeNum(exMin)) {
      ra.push(function (v, ng) {
        if (v > exMin) return true;
        if (ng.loi) them(ng, nut, "exclusiveMinimum", "Phải > " + exMin + ", đang là " + v, { gioiHan: exMin });
        return false;
      });
    }
    if (typeNum(exMax)) {
      ra.push(function (v, ng) {
        if (v < exMax) return true;
        if (ng.loi) them(ng, nut, "exclusiveMaximum", "Phải < " + exMax + ", đang là " + v, { gioiHan: exMax });
        return false;
      });
    }
    if (typeNum(S.multipleOf) && S.multipleOf > 0) {
      var m = S.multipleOf;
      ra.push(function (v, ng) {
        if (laBoi(v, m)) return true;
        if (ng.loi) them(ng, nut, "multipleOf", "Phải là bội của " + m + ", đang là " + v, { boi: m });
        return false;
      });
    }
    return ra;
  }

  /** So chu so thap phan cua x (xu ly dang khoa hoc 1e-7, 1.5e+21). */
  function soLe(x) {
    var s = String(x), e = 0, i = s.search(/e/i);
    if (i >= 0) { e = parseInt(s.slice(i + 1), 10); s = s.slice(0, i); }
    var cham = s.indexOf("."), le = cham < 0 ? 0 : s.length - cham - 1;
    return Math.max(0, le - e);
  }

  /** v la boi cua m? Nhan len theo thang thap phan roi so nguyen; qua 15 chu so thi sai so tuong doi 1e-12. */
  function laBoi(v, m) {
    if (!isFinite(v)) return false;
    if (Number.isInteger(v) && Number.isInteger(m)) return v % m === 0;
    var d = Math.max(soLe(v), soLe(m));
    if (d <= 15) {
      var f = Math.pow(10, d), a = Math.round(v * f), b = Math.round(m * f);
      if (Math.abs(a) <= 9007199254740991 && b > 0) return a % b === 0;
    }
    var q = v / m;
    return Math.abs(q - Math.round(q)) <= 1e-12 * Math.max(1, Math.abs(q));
  }

  function soKyTu(s) {
    var n = 0, i, c, L = s.length;
    for (i = 0; i < L; i++, n++) {
      c = s.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdbff && i + 1 < L && (s.charCodeAt(i + 1) & 0xfc00) === 0xdc00) i++;
    }
    return n;
  }

  function buocChuoi(bd, nut, S) {
    var ra = [];
    if (laSoNguyenKhongAm(S.minLength)) {
      var mn = S.minLength;
      ra.push(function (v, ng) {
        if (v.length >= 2 * mn || soKyTu(v) >= mn) return true;
        if (ng.loi) them(ng, nut, "minLength", "Cần ít nhất " + mn + " ký tự, đang có " + soKyTu(v), { gioiHan: mn });
        return false;
      });
    }
    if (laSoNguyenKhongAm(S.maxLength)) {
      var mx = S.maxLength;
      ra.push(function (v, ng) {
        if (v.length <= mx || soKyTu(v) <= mx) return true;
        if (ng.loi) them(ng, nut, "maxLength", "Chỉ được tối đa " + mx + " ký tự, đang có " + soKyTu(v), { gioiHan: mx });
        return false;
      });
    }
    if (typeof S.pattern === "string") {
      var re = layRegex(bd, S.pattern), src = S.pattern;
      if (re) {
        ra.push(function (v, ng) {
          if (re.test(v)) return true;
          if (ng.loi) them(ng, nut, "pattern", "Không khớp mẫu " + catNgan(src, 50) + ": " + hien(v), { mau: src });
          return false;
        });
      }
    }
    if (typeof S.format === "string" && F.co(S.format)) {
      var ten = S.format, mo = F.moTa[ten];
      ra.push(function (v, ng) {
        if (ng.fmt === "bo-qua" || F.kiem(ten, v)) return true;
        if (ng.fmt === "loi") { if (ng.loi) them(ng, nut, "format", "Không phải " + mo + ": " + hien(v), { format: ten }); return false; }
        them(ng, nut, "format", "Không phải " + mo + ": " + hien(v), { format: ten }, undefined, "canh-bao");
        return true;
      });
    }
    return ra;
  }

  function khoaPhanTu(x) {
    var t = typeof x;
    return t === "number" ? "n" + x : t === "string" ? "s" + x : x === null ? "z" : x === true ? "t" : x === false ? "f" : "j" + khoaChuan(x);
  }

  function buocMang(bd, nut, S, che) {
    var ra = [], tuple = null, resto = null, kwResto = "items";
    if (che.p2020) {
      if (Array.isArray(S.prefixItems)) tuple = S.prefixItems.map(function (x, i) { return con(bd, nut, "prefixItems", i); });
      if (S.items !== undefined && !Array.isArray(S.items)) resto = con(bd, nut, "items");
      else if (Array.isArray(S.items) && !tuple) {
        tuple = S.items.map(function (x, i) { return con(bd, nut, "items", i); });
        if (S.additionalItems !== undefined) { resto = con(bd, nut, "additionalItems"); kwResto = "additionalItems"; }
      }
    } else if (Array.isArray(S.items)) {
      tuple = S.items.map(function (x, i) { return con(bd, nut, "items", i); });
      if (S.additionalItems !== undefined) { resto = con(bd, nut, "additionalItems"); kwResto = "additionalItems"; }
    } else if (S.items !== undefined) resto = con(bd, nut, "items");
    var kwTuple = che.p2020 && Array.isArray(S.prefixItems) ? "prefixItems" : "items";

    if (laSoNguyenKhongAm(S.minItems)) {
      var mn = S.minItems;
      ra.push(function (v, ng) {
        if (v.length >= mn) return true;
        if (ng.loi) them(ng, nut, "minItems", "Cần ít nhất " + mn + " phần tử, đang có " + v.length, { gioiHan: mn });
        return false;
      });
    }
    if (laSoNguyenKhongAm(S.maxItems)) {
      var mx = S.maxItems;
      ra.push(function (v, ng) {
        if (v.length <= mx) return true;
        if (ng.loi) them(ng, nut, "maxItems", "Chỉ được tối đa " + mx + " phần tử, đang có " + v.length, { gioiHan: mx });
        return false;
      });
    }
    if (S.uniqueItems === true) {
      ra.push(function (v, ng) {
        var thay = new Map(), ok = true;
        for (var i = 0; i < v.length; i++) {
          var k = khoaPhanTu(v[i]);
          if (thay.has(k)) {
            ok = false;
            if (ng.loi) them(ng, nut, "uniqueItems", "Phần tử [" + i + "] trùng với [" + thay.get(k) + "]", { trungVoi: thay.get(k) }, i);
            if (dungLai(ng)) return false;
          } else thay.set(k, i);
        }
        return ok;
      });
    }
    if (tuple || resto) {
      ra.push(function (v, ng) {
        var ok = true, i, n = v.length, r;
        for (i = 0; i < n; i++) {
          var nutPt = tuple && i < tuple.length ? tuple[i] : resto;
          if (!nutPt) break;
          if (!(tuple && i < tuple.length) && nutPt.kieu === 2) {
            ok = false;
            if (ng.loi) them(ng, nut, kwResto, "Thừa phần tử [" + i + "] (chỉ cho phép " + (tuple ? tuple.length : 0) + " phần tử theo " + kwTuple + ")", { chiSo: i }, i);
            if (dungLai(ng)) return false;
            continue;
          }
          ng.d.push(i);
          r = danhGia(nutPt, v[i], ng);
          ng.d.pop();
          if (!r) { ok = false; if (dungLai(ng)) return false; }
        }
        return ok;
      });
    }
    if (S.contains !== undefined) {
      var nC = con(bd, nut, "contains");
      var min = che.moi && laSoNguyenKhongAm(S.minContains) ? S.minContains : 1;
      var max = che.moi && laSoNguyenKhongAm(S.maxContains) ? S.maxContains : Infinity;
      if (!(min === 0 && max === Infinity)) {
        ra.push(function (v, ng) {
          var dem = 0, i;
          for (i = 0; i < v.length; i++) {
            ng.d.push(i);
            var r = danhGiaIm(nC, v[i], ng);
            ng.d.pop();
            if (r) { dem++; if (dem > max || (max === Infinity && dem >= min)) break; }
          }
          if (dem > max) {
            if (ng.loi) them(ng, nut, "maxContains", "Chỉ được tối đa " + max + " phần tử khớp contains, có nhiều hơn", { gioiHan: max });
            return false;
          }
          if (dem < min) {
            if (ng.loi) {
              if (min === 1 && !che.moi) them(ng, nut, "contains", "Không phần tử nào khớp contains", {});
              else if (min === 1 && dem === 0) them(ng, nut, "contains", "Không phần tử nào khớp contains", {});
              else them(ng, nut, "minContains", "Cần ≥ " + min + " phần tử khớp contains, có " + dem, { gioiHan: min, co: dem });
            }
            return false;
          }
          return true;
        });
      }
    }
    return ra;
  }

  function buocDoiTuong(bd, nut, S, che) {
    var ra = [];
    if (Array.isArray(S.required) && S.required.length && laChuoiDs(S.required)) {
      var bat = S.required;
      ra.push(function (v, ng) {
        var ok = true;
        for (var i = 0; i < bat.length; i++) {
          if (!coRieng(v, bat[i])) {
            ok = false;
            if (ng.loi) them(ng, nut, "required", "Thiếu khoá bắt buộc “" + catNgan(bat[i], 40) + "”", { khoa: bat[i] });
            if (dungLai(ng)) return false;
          }
        }
        return ok;
      });
    }
    if (laSoNguyenKhongAm(S.minProperties)) {
      var mn = S.minProperties;
      ra.push(function (v, ng) {
        var n = Object.keys(v).length;
        if (n >= mn) return true;
        if (ng.loi) them(ng, nut, "minProperties", "Cần ít nhất " + mn + " khoá, đang có " + n, { gioiHan: mn });
        return false;
      });
    }
    if (laSoNguyenKhongAm(S.maxProperties)) {
      var mx = S.maxProperties;
      ra.push(function (v, ng) {
        var n = Object.keys(v).length;
        if (n <= mx) return true;
        if (ng.loi) them(ng, nut, "maxProperties", "Chỉ được tối đa " + mx + " khoá, đang có " + n, { gioiHan: mx });
        return false;
      });
    }
    var tt = buocThuocTinh(bd, nut, S);
    if (tt) ra.push(tt);
    if (S.propertyNames !== undefined) {
      var nP = con(bd, nut, "propertyNames");
      ra.push(function (v, ng) {
        var ok = true, ks = Object.keys(v);
        for (var i = 0; i < ks.length; i++) {
          var r = thuNhanh(nP, ks[i], ng);
          if (!r.ok) {
            ok = false;
            if (ng.loi) {
              them(ng, nut, "propertyNames", "Tên khoá “" + catNgan(ks[i], 40) + "” không hợp lệ" + (r.loi && r.loi.length ? ": " + r.loi[0].thongBao : ""), { khoa: ks[i], laKhoa: true }, ks[i]);
              if (r.loi && r.loi.length) ng.loi[ng.loi.length - 1].con = r.loi;
            }
            if (dungLai(ng)) return false;
          }
        }
        return ok;
      });
    }
    var phuThuocBat = [], phuThuocSchema = [];
    if (che.moi && laObj(S.dependentRequired)) {
      Object.keys(S.dependentRequired).forEach(function (k) { if (laChuoiDs(S.dependentRequired[k])) phuThuocBat.push([k, S.dependentRequired[k]]); });
    }
    if (che.moi && laObj(S.dependentSchemas)) {
      Object.keys(S.dependentSchemas).forEach(function (k) { phuThuocSchema.push([k, con(bd, nut, "dependentSchemas", k)]); });
    }
    if (laObj(S.dependencies)) {
      Object.keys(S.dependencies).forEach(function (k) {
        var x = S.dependencies[k];
        if (laChuoiDs(x)) phuThuocBat.push([k, x]);
        else if (laObj(x) || typeof x === "boolean") phuThuocSchema.push([k, con(bd, nut, "dependencies", k)]);
      });
    }
    if (phuThuocBat.length || phuThuocSchema.length) {
      ra.push(function (v, ng) {
        var ok = true, i, j;
        for (i = 0; i < phuThuocBat.length; i++) {
          if (!coRieng(v, phuThuocBat[i][0])) continue;
          for (j = 0; j < phuThuocBat[i][1].length; j++) {
            var can = phuThuocBat[i][1][j];
            if (!coRieng(v, can)) {
              ok = false;
              if (ng.loi) them(ng, nut, che.moi && laObj(S.dependentRequired) && coRieng(S.dependentRequired, phuThuocBat[i][0]) ? "dependentRequired" : "dependencies",
                "Có “" + catNgan(phuThuocBat[i][0], 40) + "” thì phải có “" + catNgan(can, 40) + "”", { khoa: can, dieuKien: phuThuocBat[i][0] });
              if (dungLai(ng)) return false;
            }
          }
        }
        for (i = 0; i < phuThuocSchema.length; i++) {
          if (!coRieng(v, phuThuocSchema[i][0])) continue;
          if (!danhGia(phuThuocSchema[i][1], v, ng)) { ok = false; if (dungLai(ng)) return false; }
        }
        return ok;
      });
    }
    return ra;
  }

  function buocThuocTinh(bd, nut, S) {
    var props = laObj(S.properties) ? S.properties : null, pats = laObj(S.patternProperties) ? S.patternProperties : null;
    var addNut = S.additionalProperties !== undefined ? con(bd, nut, "additionalProperties") : null;
    if (!props && !pats && !addNut) return null;
    var dsProp = [], dsPat = [];
    if (props) Object.keys(props).forEach(function (k) { dsProp.push([k, con(bd, nut, "properties", k)]); });
    if (pats) Object.keys(pats).forEach(function (src) {
      var re = layRegex(bd, src);
      if (re) dsPat.push([re, con(bd, nut, "patternProperties", src)]);
    });
    return function (v, ng) {
      var ok = true, i, k, r;
      for (i = 0; i < dsProp.length; i++) {
        k = dsProp[i][0];
        if (coRieng(v, k)) {
          ng.d.push(k);
          r = danhGia(dsProp[i][1], v[k], ng);
          ng.d.pop();
          if (!r) { ok = false; if (dungLai(ng)) return false; }
        }
      }
      if (dsPat.length || addNut) {
        var keys = Object.keys(v);
        for (var q = 0; q < keys.length; q++) {
          k = keys[q];
          var khop = props !== null && coRieng(props, k);
          for (var p = 0; p < dsPat.length; p++) {
            if (dsPat[p][0].test(k)) {
              khop = true;
              ng.d.push(k);
              r = danhGia(dsPat[p][1], v[k], ng);
              ng.d.pop();
              if (!r) { ok = false; if (dungLai(ng)) return false; }
            }
          }
          if (!khop && addNut) {
            if (addNut.kieu === 2) {
              ok = false;
              if (ng.loi) them(ng, nut, "additionalProperties", "Khoá “" + catNgan(k, 40) + "” không được phép (additionalProperties: false)", { khoa: k, laKhoa: true }, k);
              if (dungLai(ng)) return false;
            } else {
              ng.d.push(k);
              r = danhGia(addNut, v[k], ng);
              ng.d.pop();
              if (!r) { ok = false; if (dungLai(ng)) return false; }
            }
          }
        }
      }
      return ok;
    };
  }

  function bienDichBuoc(bd, nut) {
    var S = nut.s, che = bd.che, B = { chung: [], so: [], chuoi: [], mang: [], dt: [] };
    nut.buoc = B;
    var coRef = typeof S.$ref === "string";
    if (coRef) B.chung.push(buocRef(bd, nut, S.$ref, "$ref"));
    if (che.moi) {
      if (typeof S.$dynamicRef === "string") B.chung.push(buocRef(bd, nut, S.$dynamicRef, "$dynamicRef"));
      if (typeof S.$recursiveRef === "string") B.chung.push(buocRef(bd, nut, S.$recursiveRef, "$recursiveRef"));
    }
    if (!che.moi && coRef) return B;                         /* draft <= 07: tu khoa anh em cua $ref bi bo qua */
    var st, i;
    if (S.type !== undefined && (typeof S.type === "string" || Array.isArray(S.type))) { st = buocType(nut, S.type); if (st) B.chung.push(st); }
    if (Array.isArray(S.enum)) B.chung.push(buocEnum(nut, S.enum));
    if (coRieng(S, "const")) B.chung.push(buocConst(nut, S.const));
    if (Array.isArray(S.allOf) && S.allOf.length) B.chung.push(buocAllOf(bd, nut, S.allOf.length));
    if (Array.isArray(S.anyOf) && S.anyOf.length) B.chung.push(buocAnyOf(bd, nut, S.anyOf.length));
    if (Array.isArray(S.oneOf) && S.oneOf.length) B.chung.push(buocOneOf(bd, nut, S.oneOf.length));
    if (S.not !== undefined && (laObj(S.not) || typeof S.not === "boolean")) B.chung.push(buocNot(bd, nut));
    if (S.if !== undefined && (laObj(S.if) || typeof S.if === "boolean") ) { st = buocIf(bd, nut, S); if (st) B.chung.push(st); }
    var so = buocSo(nut, S, che);
    for (i = 0; i < so.length; i++) B.so.push(so[i]);
    var ch = buocChuoi(bd, nut, S);
    for (i = 0; i < ch.length; i++) B.chuoi.push(ch[i]);
    var ma = buocMang(bd, nut, S, che);
    for (i = 0; i < ma.length; i++) B.mang.push(ma[i]);
    var dt = buocDoiTuong(bd, nut, S, che);
    for (i = 0; i < dt.length; i++) B.dt.push(dt[i]);
    return B;
  }

  /* ----------------------------------------------------- API */
  function taoNgucanh(bd, tuyChon) {
    var fmt = tuyChon && tuyChon.format;
    return {
      bd: bd, d: [], loi: [], cb: [], fmt: fmt === "loi" || fmt === "bo-qua" ? fmt : "canh-bao",
      toiDa: tuyChon && tuyChon.toiDa > 0 ? tuyChon.toiDa : 200, dem: 0, demCb: 0, cat: false, catCb: false,
      dungSom: !!(tuyChon && tuyChon.dungSom), dang: new Map()
    };
  }

  function chayDanhGia(nut, duLieu, ng) {
    ng.dang.set(nut, 0);
    try {
      danhGia(nut, duLieu, ng);
    } catch (e) {
      /* Nhan theo ten / thong bao, khong chi instanceof: tran ngan xep xay ra BEN TRONG ham dung san cua realm khac
         (vm cua kiem thu, iframe) thi RangeError do khong phai RangeError cua realm nay. */
      if (e instanceof RangeError || (e && (e.name === "RangeError" || /call stack|too much recursion/i.test(String(e.message))))) {
        ng.d = [];
        ng.loi.push({
          conTro: "", duong: [], hien: "$", conTroSchema: "#", tuKhoa: "(he-thong)", muc: "loi", chiTiet: { catBot: true },
          thongBao: "Dữ liệu hoặc schema lồng quá sâu — trình duyệt không kiểm nổi (" + e.message + ")"
        });
      } else throw e;
    }
  }

  function kiem(duLieu, bdHoacSchema, tuyChon) {
    tuyChon = tuyChon || {};
    var bd = bdHoacSchema && bdHoacSchema.laBd ? bdHoacSchema : bienDich(bdHoacSchema, tuyChon);
    var ng = taoNgucanh(bd, tuyChon);
    chayDanhGia(bd.goc, duLieu, ng);
    return {
      hopLe: ng.loi.length === 0, loi: ng.loi, canhBao: ng.cb, catBot: ng.cat || ng.catCb,
      loiSchema: bd.loiSchema, canhBaoSchema: bd.canhBao, draft: bd.draft
    };
  }

  function kiemNut(nut, giaTri, bd, tuyChon) {
    var ng = taoNgucanh(bd, tuyChon);
    chayDanhGia(nut, giaTri, ng);
    return { hopLe: ng.loi.length === 0, loi: ng.loi };
  }

  /** Gia tri nay trong nhu mot JSON Schema (de goi y "Mo lam schema" khi mo tep). */
  function trongNhuSchema(v) {
    if (!laObj(v)) return false;
    if (typeof v.$schema === "string" && /json-schema\.org/.test(v.$schema)) return true;
    var ks = Object.keys(v);
    if (!ks.length) return false;
    var dauHieu = (laObj(v.properties) && ks.length >= 1) || laObj(v.$defs) || laObj(v.definitions);
    if (!dauHieu) return false;
    return ks.every(function (k) { return TU_KHOA_BIET[k] === true || /^x-/.test(k); });
  }

  JE.schema = {
    bienDich: bienDich, kiem: kiem, kiemNut: kiemNut, tuKhoaHoTro: BANG_HO_TRO,
    trongNhuSchema: trongNhuSchema, giaiUri: giaiUri, xacDinhDraft: xacDinhDraft, laBoi: laBoi,
    DS_TU_KHOA: DS_TU_KHOA_BIET
  };
  if (typeof module !== "undefined" && module.exports) module.exports = JE.schema;
});
