/* kiem/schema-sinh.js — assets/schema-sinh.js (viec 28, 29): sinh du lieu mau hop le theo JSON Schema.
   (1) nap + thuan; (2) ĐỐI CHIẾU voi kho schema cua J3 (kiem/schema-1.js, schema-2.js: moi schema "thoa duoc" -> mau hop le; moi schema khac -> hop le
   HOAC khongDamBao khong rong); (3) bo schema da dang cua rieng (primitive, format, pattern, mang, object, tổ hợp, $ref/đệ quy, draft cũ) —
   moi mau duoc kiem LAI doc lap bang bienDich moi + mot BO KIEM THAM CHIEU viet rieng (khong dung chung ma voi schema-kiem.js);
   (4) cung seed -> cung ket qua, khac seed -> khac; (5) ca benh ly (mau thuan, de quy bat buoc, oneOf trung, not:{}, pattern la, ngan sach);
   (6) fuzz schema ngau nhien: "hop le hoac khongDamBao"; (7) chay-nen: lenh sinh / suy qua ma Worker trong vm rong; (8) hieu nang. */
"use strict";

const BASE_URI = "https://json-schema.org/draft/2020-12/schema";

/* ---------------------------------------------------------------- bo kiem THAM CHIEU (viet rieng, tap con 2020-12 khong $ref / format / if / contains) */
function tuNghia(v) {           /* chuoi chuan: khoa object sap xep — de so sanh enum / const / unique */
  if (Array.isArray(v)) return "[" + v.map(tuNghia).join(",") + "]";
  if (v !== null && typeof v === "object") return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + tuNghia(v[k])).join(",") + "}";
  return JSON.stringify(v);
}
function laKieu(t, v) {
  switch (t) {
    case "null": return v === null;
    case "boolean": return typeof v === "boolean";
    case "integer": return typeof v === "number" && Number.isInteger(v);
    case "number": return typeof v === "number";
    case "string": return typeof v === "string";
    case "array": return Array.isArray(v);
    case "object": return v !== null && typeof v === "object" && !Array.isArray(v);
    default: return false;
  }
}
function thamChieu(s, v) {
  if (s === true) return true;
  if (s === false) return false;
  if (s.type !== undefined && !(Array.isArray(s.type) ? s.type : [s.type]).some((t) => laKieu(t, v))) return false;
  if (s.enum !== undefined && !s.enum.some((e) => tuNghia(e) === tuNghia(v))) return false;
  if ("const" in s && tuNghia(s.const) !== tuNghia(v)) return false;
  if (typeof v === "number") {
    if (s.minimum !== undefined && !(s.exclusiveMinimum === true ? v > s.minimum : v >= s.minimum)) return false;
    if (s.maximum !== undefined && !(s.exclusiveMaximum === true ? v < s.maximum : v <= s.maximum)) return false;
    if (typeof s.exclusiveMinimum === "number" && !(v > s.exclusiveMinimum)) return false;
    if (typeof s.exclusiveMaximum === "number" && !(v < s.exclusiveMaximum)) return false;
    if (s.multipleOf !== undefined) { const q = v / s.multipleOf; if (Math.abs(q - Math.round(q)) > 1e-9 * Math.max(1, Math.abs(q))) return false; }
  }
  if (typeof v === "string") {
    const n = Array.from(v).length;
    if (s.minLength !== undefined && n < s.minLength) return false;
    if (s.maxLength !== undefined && n > s.maxLength) return false;
    if (s.pattern !== undefined && !new RegExp(s.pattern, "u").test(v)) return false;
  }
  if (Array.isArray(v)) {
    if (s.minItems !== undefined && v.length < s.minItems) return false;
    if (s.maxItems !== undefined && v.length > s.maxItems) return false;
    if (s.uniqueItems === true && new Set(v.map(tuNghia)).size !== v.length) return false;
    const pre = Array.isArray(s.prefixItems) ? s.prefixItems : [];
    for (let i = 0; i < v.length; i++) {
      const sc = i < pre.length ? pre[i] : s.items;
      if (sc !== undefined && !thamChieu(sc, v[i])) return false;
    }
  }
  if (v !== null && typeof v === "object" && !Array.isArray(v)) {
    const ks = Object.keys(v);
    if (s.minProperties !== undefined && ks.length < s.minProperties) return false;
    if (s.maxProperties !== undefined && ks.length > s.maxProperties) return false;
    for (const r of s.required || []) if (!Object.prototype.hasOwnProperty.call(v, r)) return false;
    for (const k of ks) {
      const props = s.properties || {}, pats = Object.keys(s.patternProperties || {});
      let khop = Object.prototype.hasOwnProperty.call(props, k);
      if (khop && !thamChieu(props[k], v[k])) return false;
      for (const p of pats) if (new RegExp(p, "u").test(k)) { khop = true; if (!thamChieu(s.patternProperties[p], v[k])) return false; }
      if (!khop && s.additionalProperties !== undefined && !thamChieu(s.additionalProperties, v[k])) return false;
      if (s.propertyNames !== undefined && !thamChieu(s.propertyNames, k)) return false;
    }
  }
  if (s.allOf && !s.allOf.every((x) => thamChieu(x, v))) return false;
  if (s.anyOf && !s.anyOf.some((x) => thamChieu(x, v))) return false;
  if (s.oneOf && s.oneOf.filter((x) => thamChieu(x, v)).length !== 1) return false;
  if (s.not !== undefined && thamChieu(s.not, v)) return false;
  return true;
}

/* ---------------------------------------------------------------- bo schema cua rieng. Moi muc: [ten, schema, tuyChon?, thamChieu?] */
const FORMATS = ["date-time", "date", "time", "duration", "email", "idn-email", "hostname", "idn-hostname", "ipv4", "ipv6", "uri", "uri-reference", "iri", "iri-reference",
  "uuid", "regex", "json-pointer", "relative-json-pointer", "uri-template"];

const BO = [
  /* ---- so + kieu nguyen thuy */
  ["so nguyen min/max", { type: "integer", minimum: 3, maximum: 9 }, null, true],
  ["so thuc exclusive hai dau (2020)", { type: "number", exclusiveMinimum: 1, exclusiveMaximum: 2 }, null, true],
  ["draft-04: minimum + exclusiveMinimum:true", { $schema: "http://json-schema.org/draft-04/schema#", type: "number", minimum: 1, exclusiveMinimum: true, maximum: 2, exclusiveMaximum: true }],
  ["multipleOf 0.01 trong [0, 10]", { type: "number", minimum: 0, maximum: 10, multipleOf: 0.01 }, null, true],
  ["multipleOf 0.1 + 0.25 (boi chung 0.5)", { type: "number", minimum: 0, maximum: 50, allOf: [{ multipleOf: 0.1 }, { multipleOf: 0.25 }] }, null, true],
  ["integer + multipleOf 7 + multipleOf 3 (boi 21)", { type: "integer", minimum: 1, maximum: 500, allOf: [{ multipleOf: 7 }, { multipleOf: 3 }] }, null, true],
  ["integer + multipleOf 0.5 (chi con boi cua 1)", { type: "integer", minimum: 0, maximum: 30, multipleOf: 0.5 }, null, true],
  ["mien hep [0.1, 0.2]", { type: "number", minimum: 0.1, maximum: 0.2 }, null, true],
  ["mien am [-1e6, -1e5]", { type: "integer", minimum: -1000000, maximum: -100000 }, null, true],
  ["so lon: minimum 2^40", { type: "integer", minimum: 1099511627776 }, null, true],
  ["chi co minimum (khong max)", { type: "number", minimum: 500 }, null, true],
  ["chi co maximum (khong min)", { type: "integer", maximum: -50 }, null, true],
  ["enum hon hop kieu", { enum: [1, "a", null, { x: 1 }, [1, 2], true] }, null, true],
  ["const object long", { const: { a: [1, { b: null }], c: "x" } }, null, true],
  ["type [string, null] + minLength", { type: ["string", "null"], minLength: 4 }, null, true],
  ["boolean", { type: "boolean" }, null, true],
  ["null", { type: "null" }, null, true],
  /* ---- chuoi */
  ["minLength = maxLength = 10", { type: "string", minLength: 10, maxLength: 10 }, null, true],
  ["maxLength 0 -> chuoi rong", { type: "string", maxLength: 0 }, null, true],
  ["pattern Unicode (khoang cp > BMP)", { type: "string", pattern: "^[\u{1F600}-\u{1F60F}]{2}$", minLength: 2, maxLength: 2 }, null, true],
  ["pattern + maxLength", { type: "string", pattern: "^[a-z]+$", maxLength: 6 }, null, true],
  ["pattern + minLength", { type: "string", pattern: "^[a-z]+$", minLength: 12 }, null, true],
  ["pattern ngay + format date (dung ca hai)", { type: "string", pattern: "^20[0-9]{2}-(0[1-9]|1[0-2])-(0[1-9]|1[0-9]|2[0-8])$", format: "date" }],
  ["hai pattern cung ap dung (allOf)", { type: "string", allOf: [{ pattern: "^[a-z]+$" }, { pattern: "^.{5}$" }] }, null, true],
  ["enum chuoi + minLength", { type: "string", enum: ["a", "bbb", "cccc"], minLength: 3 }, null, true],
  ...FORMATS.map((f) => ["format " + f, { type: "string", format: f }]),
  ["format email + maxLength 20", { type: "string", format: "email", maxLength: 20 }],
  /* ---- mang */
  ["items + min/maxItems", { type: "array", items: { type: "integer", minimum: 0 }, minItems: 3, maxItems: 6 }, null, true],
  ["tuple prefixItems + items:false", { type: "array", prefixItems: [{ type: "string" }, { type: "integer" }, { type: "boolean" }], items: false }, null, true],
  ["draft-07: items mang + additionalItems schema", { $schema: "http://json-schema.org/draft-07/schema#", type: "array", items: [{ type: "string" }, { type: "number" }], additionalItems: { type: "boolean" }, minItems: 3 }],
  ["uniqueItems so nguyen [1,10] minItems 8", { type: "array", items: { type: "integer", minimum: 1, maximum: 10 }, uniqueItems: true, minItems: 8 }, null, true],
  ["uniqueItems enum 3 gia tri minItems 3", { type: "array", items: { enum: ["a", "b", "c"] }, uniqueItems: true, minItems: 3 }, null, true],
  ["contains + minContains/maxContains", { type: "array", items: { type: "integer" }, contains: { minimum: 100 }, minContains: 2, maxContains: 3 }],
  ["contains const", { type: "array", items: { type: "string" }, contains: { const: "can-co" } }],
  ["ma tran 2 chieu", { type: "array", minItems: 2, items: { type: "array", minItems: 2, maxItems: 2, items: { type: "number" } } }, null, true],
  ["mang cac mang duy nhat", { type: "array", uniqueItems: true, minItems: 3, items: { type: "array", items: { type: "integer", minimum: 0, maximum: 9 }, minItems: 1, maxItems: 3 } }, null, true],
  ["items:true / true", { type: "array", items: true, minItems: 2 }, null, true],
  ["prefixItems co false o vi tri 2 (toi da 2 phan tu)", { type: "array", prefixItems: [{ type: "integer" }, { type: "string" }, false], minItems: 1 }, null, true],
  /* ---- object */
  ["required + properties", { type: "object", required: ["a", "b"], properties: { a: { type: "integer" }, b: { type: "string" }, c: { type: "boolean" } } }, null, true],
  ["additionalProperties false", { type: "object", properties: { a: { type: "integer" }, b: { type: "string" } }, additionalProperties: false }, null, true],
  ["additionalProperties schema + minProperties 3", { type: "object", properties: { a: { type: "integer" } }, additionalProperties: { type: "string" }, minProperties: 3 }, null, true],
  ["patternProperties don thuan (map)", { type: "object", patternProperties: { "^x-[a-z]+$": { type: "integer" } } }, null, true],
  ["patternProperties + additionalProperties false", { type: "object", patternProperties: { "^id[0-9]$": { type: "string" } }, additionalProperties: false, minProperties: 2 }, null, true],
  ["propertyNames pattern + minProperties 2", { type: "object", propertyNames: { pattern: "^[a-z]{3}$" }, minProperties: 2, additionalProperties: { type: "integer" } }, null, true],
  ["propertyNames enum + minProperties 2", { type: "object", propertyNames: { enum: ["x", "y", "z"] }, minProperties: 2 }, null, true],
  ["dependentRequired", { type: "object", properties: { a: { type: "integer" }, b: { type: "string" }, c: { type: "string" } }, required: ["a"], dependentRequired: { a: ["b", "c"] } }],
  ["dependentSchemas", { type: "object", properties: { loai: { enum: ["x", "y"] } }, required: ["loai"], dependentSchemas: { loai: { required: ["them"], properties: { them: { type: "integer", minimum: 5 } } } } }],
  ["draft-07 dependencies (mang + schema)", { $schema: "http://json-schema.org/draft-07/schema#", type: "object", required: ["a", "b"], properties: { a: { type: "integer" }, b: { type: "integer" } },
    dependencies: { a: ["c"], b: { required: ["d"], properties: { d: { type: "string" } } } } }],
  ["maxProperties thap hon so khoa khai bao", { type: "object", properties: { a: {}, b: {}, c: {}, d: {}, e: {} }, required: ["a"], maxProperties: 2 }, null, true],
  ["object long 5 cap", { type: "object", required: ["a"], properties: { a: { type: "object", required: ["b"], properties: { b: { type: "object", required: ["c"], properties: { c: { type: "object", required: ["d"], properties: { d: { type: "array", items: { type: "integer" }, minItems: 1 } } } } } } } } }, null, true],
  ["khoa __proto__ bat buoc", JSON.parse('{"type":"object","required":["__proto__","constructor"],"properties":{"__proto__":{"type":"integer"},"constructor":{"type":"string"}}}')],
  ["chi co required (khong properties)", { required: ["a", "b"] }],
  ["maxProperties 0", { type: "object", properties: { a: { type: "integer" } }, maxProperties: 0 }, null, true],
  /* ---- to hop */
  ["allOf gop object (properties + required hop)", { allOf: [{ type: "object", required: ["a"], properties: { a: { type: "integer" } } }, { required: ["b"], properties: { b: { type: "string" } } }] }, null, true],
  ["allOf so: min tu mot, max tu mot", { allOf: [{ type: "integer", minimum: 10 }, { maximum: 20 }] }, null, true],
  ["allOf chuoi: minLength va maxLength rieng", { allOf: [{ type: "string", minLength: 5 }, { maxLength: 7 }] }, null, true],
  ["allOf giao enum", { allOf: [{ enum: [1, 2, 3, 4] }, { enum: [3, 4, 5, 6] }] }, null, true],
  ["anyOf kieu khac nhau", { anyOf: [{ type: "integer", minimum: 100 }, { type: "string", pattern: "^[A-Z]{3}$" }, { type: "null" }] }, null, true],
  ["oneOf kieu roi nhau", { oneOf: [{ type: "integer" }, { type: "string" }, { type: "array", items: { type: "integer" } }] }, null, true],
  ["oneOf chong lan: [0,10] va [5,15]", { oneOf: [{ type: "integer", minimum: 0, maximum: 10 }, { type: "integer", minimum: 5, maximum: 15 }] }, null, true],
  ["oneOf object phan biet bang const", { oneOf: [{ type: "object", required: ["k"], properties: { k: { const: "a" }, x: { type: "integer" } } }, { type: "object", required: ["k"], properties: { k: { const: "b" }, y: { type: "string" } } }] }, null, true],
  ["oneOf 20 nhanh [i*10, i*10+15] (chong lan)", { oneOf: Array.from({ length: 20 }, (_, i) => ({ type: "integer", minimum: i * 10, maximum: i * 10 + 15 })) }, null, true],
  ["oneOf 20 const", { oneOf: Array.from({ length: 20 }, (_, i) => ({ const: i })) }, null, true],
  ["not type", { not: { type: "string" }, minLength: 1 }, null, true],
  ["not enum", { type: "integer", minimum: 1, maximum: 5, not: { enum: [1, 2, 3, 4] } }, null, true],
  ["not + allOf", { allOf: [{ type: "integer", minimum: 0, maximum: 10 }, { not: { type: "integer", minimum: 3, maximum: 10 } }] }, null, true],
  ["if / then / else", { type: "object", required: ["loai"], properties: { loai: { enum: ["tron", "vuong"] } }, if: { properties: { loai: { const: "tron" } } },
    then: { required: ["banKinh"], properties: { banKinh: { type: "number", exclusiveMinimum: 0 } } }, else: { required: ["canh"], properties: { canh: { type: "number", minimum: 1 } } } }],
  ["if long trong allOf", { type: "object", properties: { n: { type: "integer", minimum: 0, maximum: 100 } }, required: ["n"],
    allOf: [{ if: { properties: { n: { minimum: 50 } } }, then: { required: ["lon"] }, else: { required: ["be"] } }] }],
  ["anyOf trong items cua mang", { type: "array", minItems: 4, items: { anyOf: [{ type: "integer", maximum: 0 }, { type: "string", maxLength: 2 }, { type: "object", required: ["z"] }] } }],
  /* ---- $ref / de quy / draft cu */
  ["$defs + $ref co ban", { type: "object", required: ["a", "b"], properties: { a: { $ref: "#/$defs/s" }, b: { $ref: "#/$defs/n" } }, $defs: { s: { type: "string", minLength: 2 }, n: { type: "integer", minimum: 7 } } }],
  ["cay: con la mang $ref #", { type: "object", required: ["ten"], properties: { ten: { type: "string" }, con: { type: "array", items: { $ref: "#" } } } }],
  ["danh sach lien ket (oneOf null | $ref)", { $ref: "#/$defs/nut", $defs: { nut: { type: "object", required: ["v", "tiep"], properties: { v: { type: "integer" }, tiep: { oneOf: [{ type: "null" }, { $ref: "#/$defs/nut" }] } } } } }],
  ["cay nhi phan (left / right tuy chon)", { type: "object", required: ["v"], properties: { v: { type: "integer" }, left: { $ref: "#" }, right: { $ref: "#" } } }],
  ["de quy tuong ho a <-> b", { $ref: "#/$defs/a", $defs: { a: { type: "object", required: ["ten"], properties: { ten: { type: "string" }, b: { $ref: "#/$defs/b" } } },
    b: { type: "object", required: ["ten"], properties: { ten: { type: "string" }, a: { $ref: "#/$defs/a" } } } } }],
  ["$anchor", { type: "object", required: ["x"], properties: { x: { $ref: "#chu" } }, $defs: { c: { $anchor: "chu", type: "string", minLength: 3 } } }],
  ["$id tuong doi + $ref", { $id: "https://vd.com/goc.json", type: "object", required: ["x"], properties: { x: { $ref: "con.json" } }, $defs: { c: { $id: "con.json", type: "integer", minimum: 5 } } }],
  ["draft-07 definitions + $ref", { $schema: "http://json-schema.org/draft-07/schema#", type: "object", required: ["a"], properties: { a: { $ref: "#/definitions/n" } }, definitions: { n: { type: "integer", minimum: 100 } } }],
  ["2020-12: $ref co tu khoa anh em", { $defs: { s: { type: "string" } }, type: "object", properties: { a: { $ref: "#/$defs/s", minLength: 4, maxLength: 4 } }, required: ["a"] }],
  ["draft-07: tu khoa anh em cua $ref bi bo qua", { $schema: "http://json-schema.org/draft-07/schema#", definitions: { s: { type: "string" } }, type: "object", properties: { a: { $ref: "#/definitions/s", minLength: 40 } }, required: ["a"] }],
  ["$ref chuoi dai 50 cap", (() => { const d = {}; for (let i = 0; i < 50; i++) d["s" + i] = i === 49 ? { type: "string", minLength: 3 } : { $ref: "#/$defs/s" + (i + 1) }; return { $defs: d, $ref: "#/$defs/s0" }; })()],
  ["de quy: anyOf co nhanh dung (nguyen thuy)", { $ref: "#/$defs/v", $defs: { v: { anyOf: [{ type: "integer" }, { type: "array", items: { $ref: "#/$defs/v" } }, { type: "object", additionalProperties: { $ref: "#/$defs/v" } }] } } }],
  ["2019-09 dependentRequired + $recursiveRef xap xi", { $schema: "https://json-schema.org/draft/2019-09/schema", type: "object", required: ["a"], properties: { a: { type: "integer" }, b: { type: "string" } }, dependentRequired: { a: ["b"] } }],
  /* ---- khac */
  ["examples duoc dung", { type: "string", examples: ["vi-du-1", "vi-du-2"] }, { dungViDu: 1 }, true],
  ["default duoc dung", { type: "integer", default: 42 }, { dungViDu: 1 }, true],
  ["examples khong hop le bi bo qua", { type: "integer", minimum: 10, examples: [1, 2, 3] }, { dungViDu: 1 }, true],
  ["schema true", true],
  ["schema rong {}", {}],
  ["gia lap ho so nguoi dung (nhieu tinh nang)", { type: "object", required: ["id", "ten", "email", "vaiTro"], additionalProperties: false, properties: {
    id: { type: "integer", minimum: 1 }, ten: { type: "string", minLength: 2, maxLength: 40 }, email: { type: "string", format: "email" }, vaiTro: { enum: ["admin", "editor", "viewer"] },
    tuoi: { type: "integer", minimum: 0, maximum: 150 }, ngaySinh: { type: "string", format: "date" }, sdt: { type: "string", pattern: "^0[0-9]{9}$" },
    diaChi: { type: "object", required: ["thanhPho"], properties: { thanhPho: { type: "string" }, quan: { type: "string" }, toaDo: { type: "array", prefixItems: [{ type: "number", minimum: -90, maximum: 90 }, { type: "number", minimum: -180, maximum: 180 }], items: false } } },
    tags: { type: "array", items: { type: "string", maxLength: 12 }, uniqueItems: true, maxItems: 5 }, diem: { type: "number", minimum: 0, maximum: 10, multipleOf: 0.5 },
    ghiChu: { type: ["string", "null"] }, hoatDong: { type: "boolean" }, taoLuc: { type: "string", format: "date-time" }, web: { type: "string", format: "uri" } } }]
];

/* ---------------------------------------------------------------- ca benh ly: hopLe PHAI la false + khongDamBao khong rong (khong treo, khong bia) */
const BENH = [
  ["minimum > maximum", { type: "integer", minimum: 5, maximum: 1 }, /Miền số rỗng|≤ 1/],
  ["exclusive: minimum = maximum", { type: "number", exclusiveMinimum: 3, maximum: 3 }, /Miền số rỗng|3/],
  ["not: {}", { not: {} }, /not/],
  ["schema false", false, /false/],
  ["type string va integer cung luc (allOf)", { allOf: [{ type: "string" }, { type: "integer" }] }, /type/],
  ["enum rong", { enum: [] }, /enum/],
  ["const khac enum", { const: 5, enum: [1, 2, 3] }, /enum|const/],
  ["minLength > maxLength", { type: "string", minLength: 5, maxLength: 2 }, /minLength/],
  ["oneOf hai nhanh giong het (luon khop ca hai)", { oneOf: [{ type: "integer" }, { type: "integer" }] }, /oneOf|Khớp/],
  ["oneOf hai schema rong", { oneOf: [{}, {}] }, /oneOf|Khớp/],
  ["uniqueItems + enum 2 gia tri + minItems 5", { type: "array", items: { enum: ["a", "b"] }, uniqueItems: true, minItems: 5 }, /uniqueItems|trùng|Phần tử/],
  ["minProperties 3 + additionalProperties false + 1 khoa", { type: "object", properties: { a: {} }, additionalProperties: false, minProperties: 3 }, /minProperties|Cần ít nhất/],
  ["pattern nhin truoc khong the thoa", { type: "string", pattern: "^(?=a)b$" }, /pattern/],
  ["items:false + minItems 1", { type: "array", items: false, minItems: 1 }, /minItems|items|chỗ/],
  ["contains + maxItems 1 + minContains 3", { type: "array", contains: { type: "integer" }, minContains: 3, maxItems: 1 }, /minContains|chỗ|contains|phần tử/],
  ["propertyNames ^$ + required a", { type: "object", required: ["a"], propertyNames: { pattern: "^$" } }, /propertyNames|Tên khoá/],
  ["$ref ngoai (offline)", { $ref: "https://vd.com/x.json" }, /ref/],
  ["multipleOf khong tuong thich voi mien", { type: "number", minimum: 1, maximum: 2, multipleOf: 3 }, /bội|multipleOf/],
  ["required de quy khong diem dung", { $ref: "#/$defs/a", $defs: { a: { type: "object", required: ["x"], properties: { x: { $ref: "#/$defs/a" } } } } }, /đệ quy/],
  ["dependentRequired vong + additionalProperties false", { type: "object", properties: { a: {} }, required: ["a"], additionalProperties: false, dependentRequired: { a: ["b"] } }, /Thiếu|additionalProperties|required/],
  ["maxProperties < so khoa required", { type: "object", required: ["a", "b", "c"], maxProperties: 2 }, /maxProperties/],
  ["allOf minimum > maximum rieng re", { allOf: [{ type: "integer", minimum: 10 }, { maximum: 5 }] }, /Miền số rỗng|Phải/]
];

/* ---------------------------------------------------------------- sinh schema ngau nhien (fuzz): tap con co the mau thuan */
function schemaNgauNhien(rd, sau, goc) {
  const chon = (a) => a[Math.floor(rd() * a.length)];
  const so = (a, b) => a + Math.floor(rd() * (b - a + 1));
  const s = {};
  const dang = rd();
  if (dang < 0.18 && sau < 3) return { anyOf: [schemaNgauNhien(rd, sau + 1, goc), schemaNgauNhien(rd, sau + 1, goc)] };
  if (dang < 0.28 && sau < 3) return { oneOf: [schemaNgauNhien(rd, sau + 1, goc), schemaNgauNhien(rd, sau + 1, goc), schemaNgauNhien(rd, sau + 1, goc)] };
  if (dang < 0.36 && sau < 3) return { allOf: [schemaNgauNhien(rd, sau + 1, goc), schemaNgauNhien(rd, sau + 1, goc)] };
  if (dang < 0.40) return { not: { type: chon(["string", "integer", "null"]) } };
  if (dang < 0.46) return { if: { type: "integer" }, then: { minimum: so(0, 50) }, else: { type: chon(["string", "boolean"]) } };
  if (dang < 0.50 && goc) return { $ref: "#/$defs/d" };
  if (dang < 0.54) return { enum: [so(0, 5), "x" + so(0, 3), null].slice(0, so(1, 3)) };
  const t = chon(["string", "integer", "number", "boolean", "null", "array", "object", "object", "array", ["string", "null"]]);
  s.type = t;
  const tt = Array.isArray(t) ? t[0] : t;
  if (tt === "string") {
    if (rd() < 0.5) s.minLength = so(0, 6);
    if (rd() < 0.5) s.maxLength = (s.minLength || 0) + so(0, 8);
    if (rd() < 0.25) s.format = chon(["email", "date", "uuid", "ipv4", "uri"]);
    else if (rd() < 0.2) s.pattern = chon(["^[a-z]{2,5}$", "^[A-Z][a-z]+$", "^\\d{3}$", "^(ab|cd)+$"]);
  } else if (tt === "integer" || tt === "number") {
    if (rd() < 0.6) s.minimum = so(-20, 20);
    if (rd() < 0.6) s.maximum = (s.minimum === undefined ? 0 : s.minimum) + so(-3, 30);
    if (rd() < 0.2) s.multipleOf = chon([2, 3, 0.5, 0.25, 5]);
  } else if (tt === "array") {
    if (rd() < 0.7 && sau < 3) s.items = schemaNgauNhien(rd, sau + 1, goc);
    if (rd() < 0.4) s.minItems = so(0, 4);
    if (rd() < 0.4) s.maxItems = (s.minItems || 0) + so(0, 4);
    if (rd() < 0.2) s.uniqueItems = true;
    if (rd() < 0.1 && sau < 3) s.contains = schemaNgauNhien(rd, sau + 1, goc);
  } else if (tt === "object") {
    const n = so(0, 4);
    if (n && sau < 3) {
      s.properties = {};
      for (let i = 0; i < n; i++) s.properties["p" + i] = schemaNgauNhien(rd, sau + 1, goc);
      if (rd() < 0.6) s.required = Object.keys(s.properties).filter(() => rd() < 0.5);
    }
    if (rd() < 0.15) s.additionalProperties = false;
    if (rd() < 0.15) s.minProperties = so(0, 3);
    if (rd() < 0.1) s.propertyNames = { pattern: "^[a-z]{1,3}[0-9]?$" };
  }
  return s;
}

module.exports = function (C) {
  const kiem = C.kiem, nhom = C.nhom, bang = C.bang;
  const MT = C.taoMoiTruong();
  const JE = MT.JE;
  if (!kiem("schema-sinh · nap xong, co JE.schemaSinh (sinhMau, sinhFormat)", !!(JE.schemaSinh && typeof JE.schemaSinh.sinhMau === "function" && typeof JE.schemaSinh.sinhFormat === "function"))) return;
  const SG = JE.schemaSinh, S = JE.schema;
  const SLACK = Number(process.env.JE_PERF_SLACK || 3);
  const ds = C.dsScript();
  kiem("index.html · schema-sinh.js nap sau regex-sinh.js, schema-kiem.js, truoc chay-nen.js",
    ds.indexOf("assets/schema-sinh.js") > ds.indexOf("assets/regex-sinh.js") && ds.indexOf("assets/regex-sinh.js") > ds.indexOf("assets/schema-kiem.js") && ds.indexOf("assets/schema-sinh.js") < ds.indexOf("assets/chay-nen.js"), ds.join(", "));
  const nguon = require("fs").readFileSync(require("path").join(C.GOC, "assets", "schema-sinh.js"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  kiem("schema-sinh · module thuan: khong Math.random / Date / performance / document / window / eval", !/Math\.random|\bDate\b|performance|\bdocument\b|\bwindow\b|\beval\s*\(|new\s+Function/.test(nguon));

  /** Kiem LAI doc lap: bienDich moi (khong dung bd cua bo sinh) voi format o muc "loi" — nghiem hon mac dinh. */
  const kiemLai = (schema, gt, tc) => S.kiem(gt, S.bienDich(schema, { draft: tc && tc.draft, thuVien: tc && tc.thuVien }), { format: "loi", toiDa: 5 });
  const ngan = (v) => { let t; try { t = JSON.stringify(v); } catch (e) { t = String(v); } t = t === undefined ? "undefined" : t; return t.length > 90 ? t.slice(0, 88) + "…" : t; };

  /* =========================================================== (2) kho schema cua J3 */
  nhom("schema-sinh · doi chieu voi KHO schema cua J3 (kiem/schema-1.js, schema-2.js)");
  if (!C.kho.length) {                                          /* chay loc mot nhom: nap im lang de co kho */
    C.datIm(true);
    try { require("./schema-1.js")(C); require("./schema-2.js")(C); } finally { C.datIm(false); }
  }
  const kho = C.kho.filter((k) => !k.tc.json || true);
  const thoa = kho.filter((k) => k.thoaDuoc), khac = kho.filter((k) => !k.thoaDuoc);
  kiem("kho J3 · co du schema (>= 140 schema thoa duoc)", thoa.length >= 140, thoa.length + " thoa duoc, " + khac.length + " khac");
  { const hong = [];
    for (const k of thoa) for (const seed of ["k1", "k2", "k3"]) {
      const tc = Object.assign({ seed }, k.tc), r = SG.sinhMau(k.schema, tc);
      const lai = r.hopLe ? kiemLai(k.schema, r.giaTri, k.tc) : null;
      if (!r.hopLe || !lai.hopLe) hong.push(k.ten + " [" + seed + "] -> " + ngan(r.giaTri) + " " + r.khongDamBao.map((x) => x.lyDo).join("/").slice(0, 80));
    }
    kiem("kho J3 · MOI schema thoa duoc (" + thoa.length + ") x 3 seed -> mau hop le (kiem lai doc lap, format 'loi')", hong.length === 0, hong.slice(0, 4).join(" | ")); }
  { const hong = [];
    for (const k of khac) {
      const r = SG.sinhMau(k.schema, Object.assign({ seed: "k1" }, k.tc));
      const lai = kiemLai(k.schema, r.giaTri, k.tc);
      if (r.hopLe !== lai.hopLe) hong.push(k.ten + ": hopLe bao " + r.hopLe + " nhung kiem lai " + lai.hopLe);
      else if (!r.hopLe && !r.khongDamBao.length) hong.push(k.ten + ": khong hop le ma khongDamBao rong");
    }
    kiem("kho J3 · schema khac (" + khac.length + "): hopLe khop kiem lai, va khong hop le thi khongDamBao KHONG rong", hong.length === 0, hong.slice(0, 4).join(" | ")); }

  /* =========================================================== (3) bo schema rieng */
  nhom("schema-sinh · " + BO.length + " schema da dang x 4 seed x 3 mau: hop le (kiem lai doc lap" + " + bo tham chieu)");
  let tongMau = 0;
  for (const [ten, schema, opt, tham] of BO) {
    const tc = Object.assign({}, opt || {});
    const hong = [];
    for (const seed of ["a", "b", "c", "d"]) {
      const r = SG.sinhMau(schema, Object.assign({ seed, soLuong: 3 }, tc));
      tongMau += 3;
      if (!r.hopLe || !Array.isArray(r.giaTri) || r.giaTri.length !== 3) { hong.push("[" + seed + "] hopLe=" + r.hopLe + " " + ngan(r.giaTri) + " " + r.khongDamBao.map((x) => x.lyDo).join("/").slice(0, 90)); continue; }
      r.giaTri.forEach((m, i) => {
        const lai = kiemLai(schema, m, tc);
        if (!lai.hopLe) hong.push("[" + seed + "#" + i + "] kiem lai SAI: " + ngan(m) + " " + lai.loi.map((e) => e.thongBao).join("/").slice(0, 70));
        else if (tham === true && !thamChieu(schema, m)) hong.push("[" + seed + "#" + i + "] bo tham chieu SAI: " + ngan(m));
      });
    }
    kiem("bo · " + ten, hong.length === 0, hong.slice(0, 2).join(" | "));
  }
  kiem("bo · tong " + tongMau + " mau da kiem lai", tongMau >= 1000, String(tongMau));

  /* tinh chat bo sung */
  nhom("schema-sinh · tinh chat cu the cua dau ra");
  const sinh1 = (schema, seed, tc) => SG.sinhMau(schema, Object.assign({ seed: seed || "t" }, tc || {})).giaTri;
  { const dem = {}; for (let i = 0; i < 200; i++) { const x = sinh1({ oneOf: [{ type: "integer", minimum: 0, maximum: 10 }, { type: "integer", minimum: 5, maximum: 15 }] }, "o" + i); dem[x < 5 ? "0-4" : x > 10 ? "11-15" : "chong lan"] = (dem[x < 5 ? "0-4" : x > 10 ? "11-15" : "chong lan"] || 0) + 1; }
    kiem("oneOf chong lan: 200 mau chi roi vao [0,4] hoac [11,15], khong BAO GIO vao vung chong lan [5,10]", !dem["chong lan"] && dem["0-4"] > 20 && dem["11-15"] > 20, JSON.stringify(dem)); }
  { const KHONG = { type: "string", minLength: 5, maxLength: 2 };               /* nhanh khong the thoa */
    for (const kw of ["oneOf", "anyOf"]) {
      let ok = 0;
      for (let vi = 0; vi < 8; vi++) {
        const nh = Array.from({ length: 8 }, (_, i) => (i === vi ? { type: "integer", minimum: 100 } : KHONG));
        for (let i = 0; i < 6; i++) { const r = SG.sinhMau({ [kw]: nh }, { seed: kw + vi + "_" + i, thuLai: 0 }); if (r.hopLe && r.giaTri >= 100) ok++; }
      }
      kiem(kw + " 8 nhanh, 7 nhanh mau thuan, thuLai 0 (khong thu lai ca mau): nhanh dung o BAT KY vi tri nao deu tim thay trong 8 lan thu xoay he thong (48/48)", ok === 48, ok + "/48");
    } }
  { let ok = 0; for (let i = 0; i < 100; i++) { const a = sinh1({ type: "array", items: { type: "integer", minimum: 1, maximum: 10 }, uniqueItems: true, minItems: 8 }, "u" + i); if (new Set(a).size === a.length && a.length >= 8) ok++; }
    kiem("uniqueItems: 100 mang khong co phan tu trung, du minItems", ok === 100, ok + "/100"); }
  { let ok = 0; for (let i = 0; i < 100; i++) { const a = sinh1({ type: "array", items: { type: "integer" }, contains: { minimum: 100 }, minContains: 2, maxContains: 3 }, "c" + i); const n = a.filter((x) => x >= 100).length; if (n >= 2 && n <= 3) ok++; }
    kiem("contains + minContains 2 + maxContains 3: 100 mang co 2–3 phan tu khop", ok === 100, ok + "/100"); }
  { let ok = 0, co = 0; for (let i = 0; i < 100; i++) { const o = sinh1({ type: "object", properties: { a: { type: "integer" }, b: { type: "string" }, c: { type: "boolean" } }, required: ["a"], dependentRequired: { a: ["b"] } }, "d" + i); if ("a" in o && "b" in o) ok++; if ("c" in o) co++; }
    kiem("dependentRequired: a luon co b (100/100); khoa tuy chon c xuat hien khoang nua", ok === 100 && co > 25 && co < 75, ok + "/100, c: " + co); }
  { const dem = [0, 0]; for (let i = 0; i < 300; i++) { const o = sinh1({ type: "object", properties: { x: { type: "integer" } } }, "t" + i, { tiLeTuyChon: 0.5 }); dem["x" in o ? 1 : 0]++; }
    kiem("tiLeTuyChon 0.5: khoa tuy chon co mat khoang nua (300 mau: 100–200 co)", dem[1] > 100 && dem[1] < 200, dem.join("/"));
    const khong = sinh1({ type: "object", properties: { x: { type: "integer" } } }, "t", { tiLeTuyChon: 0 }), du = sinh1({ type: "object", properties: { x: { type: "integer" } } }, "t", { tiLeTuyChon: 1 });
    kiem("tiLeTuyChon 0 -> chi khoa bat buoc ({}); 1 -> moi khoa", bang(khong, {}) && "x" in du, ngan(khong) + ngan(du)); }
  { const ng = sinh1({ type: "array", items: { type: "integer" } }, "m", { mangToiDa: 2, soLuong: 40 });
    kiem("mangToiDa 2: moi mang <= 2 phan tu (minItems 0)", ng.every((a) => a.length <= 2), ngan(ng.map((a) => a.length))); }
  { const r = sinh1({ type: "integer", minimum: 5, maximum: 9 }, "x", { soLuong: 300 });
    kiem("so nguyen [5, 9]: du 5 gia tri, deu (moi gia tri >= 30 / 300)", [5, 6, 7, 8, 9].every((v) => r.filter((x) => x === v).length >= 30), ngan([5, 6, 7, 8, 9].map((v) => r.filter((x) => x === v).length))); }
  { const r = sinh1({ type: "string", minLength: 3, maxLength: 3 }, "x", { soLuong: 100 });
    kiem("minLength = maxLength = 3: dem theo CODE POINT, 100 mau", r.every((s) => Array.from(s).length === 3), ngan(r.slice(0, 3))); }
  { const r = sinh1({ type: "string", pattern: "^[\u{1F600}-\u{1F60F}]{3}$" }, "x", { soLuong: 20 });
    kiem("pattern emoji: moi mau 3 code point (6 UTF-16), khop RegExp u", r.every((s) => Array.from(s).length === 3 && s.length === 6 && /^[\u{1F600}-\u{1F60F}]{3}$/u.test(s)), ngan(r[0])); }
  { const o = SG.sinhMau(JSON.parse('{"type":"object","required":["__proto__"],"properties":{"__proto__":{"type":"integer"}}}'), { seed: "p" }).giaTri;
    kiem("khoa __proto__: la khoa RIENG, khong doi prototype", Object.prototype.hasOwnProperty.call(o, "__proto__") && Object.getPrototypeOf(o) !== null && Object.getPrototypeOf(Object.getPrototypeOf(o)) === null && typeof Object.getOwnPropertyDescriptor(o, "__proto__").value === "number", ngan(o)); }
  { const vd = sinh1({ type: "string", examples: ["vi-du-1", "vi-du-2"] }, "e", { dungViDu: 1, soLuong: 20 }), kh = sinh1({ type: "string", examples: ["vi-du-1"] }, "e", { dungViDu: 0, soLuong: 40 });
    kiem("dungViDu 1: moi mau lay tu examples; dungViDu 0: khong bao gio", vd.every((x) => /^vi-du-[12]$/.test(x)) && kh.every((x) => x !== "vi-du-1"), ngan(vd.slice(0, 3))); }
  { const kq = SG.sinhMau({ type: "object", required: ["a"], properties: { a: { type: "integer" } } }, { seed: "z", soLuong: 5 });
    kiem("soLuong 5 -> mang 5 mau; soLanThu >= 5; seed + soLuong duoc tra lai", Array.isArray(kq.giaTri) && kq.giaTri.length === 5 && kq.soLanThu >= 5 && kq.seed === "z" && kq.soLuong === 5); }
  { const r1 = SG.sinhMau({ type: "integer" }, { seed: "", soLuong: 1 }), r2 = SG.sinhMau({ type: "integer" }, {});
    kiem("seed rong / thieu -> seed mac dinh 'mau' (van tat dinh)", r1.seed === "mau" && r2.seed === "mau" && r1.giaTri === r2.giaTri); }
  { const d = SG.sinhMau({ type: "string", pattern: "\\bword\\b" }, { seed: "w" });
    kiem("pattern dung \\b (xap xi): van hop le, co ghiChu ro (khong chan)", d.hopLe && d.khongDamBao.length === 0 && d.ghiChu.length >= 1 && /\\b/.test(d.ghiChu[0].lyDo), JSON.stringify(d.ghiChu)); }
  { const r = SG.sinhMau({ type: "string", format: "unknown-fmt" }, { seed: "w" });
    kiem("format la (khong co trong schemaFormat): bo qua, sinh van ban thuong, hop le", r.hopLe && typeof r.giaTri === "string" && r.giaTri.length > 0, ngan(r.giaTri)); }
  { const n = JE.schemaFormat.danhSach.length;
    const hong = [];
    for (const f of JE.schemaFormat.danhSach) {
      const dem = new Set();
      for (let i = 0; i < 300; i++) { const s = SG.sinhFormat(f, JE.taoRng(f + i)); if (s === null || JE.schemaFormat.kiem(f, s) !== true) hong.push(f + ":" + ngan(s)); else dem.add(s); }
      if (dem.size < 30 && f !== "relative-json-pointer" && f !== "regex" && f !== "json-pointer" && f !== "duration") hong.push(f + " chi " + dem.size + " gia tri khac nhau / 300");
    }
    kiem("sinhFormat · " + n + " format x 300 seed: moi chuoi qua schemaFormat.kiem; da dang (>= 30 gia tri khac nhau)", hong.length === 0, hong.slice(0, 4).join(" | ")); }
  { const CAP = [["ipv6", 3, 3], ["ipv6", 3, 4], ["ipv4", 7, 7], ["email", 6, 6], ["email", 6, 9], ["uuid", 36, 36], ["date", 10, 10], ["date-time", 20, 20], ["time", 9, 9], ["hostname", 1, 3],
      ["duration", 3, 3], ["uri", 5, 8], ["uri-reference", 1, 2], ["json-pointer", 0, 2], ["relative-json-pointer", 1, 1], ["regex", 1, 1], ["idn-email", 6, 8], ["uri-template", 3, 5]];
    const hong = [];
    for (const [f, mn, mx] of CAP) for (let i = 0; i < 10; i++) {
      const r = SG.sinhMau({ type: "string", format: f, minLength: mn, maxLength: mx }, { seed: f + i });
      if (!r.hopLe) hong.push(f + "[" + mn + "," + mx + "] " + ngan(r.giaTri) + " " + r.khongDamBao.map((x) => x.lyDo).join("/").slice(0, 60));
    }
    kiem("format + do dai chat (" + CAP.length + " cap x 10 seed): chon bien the NGAN cua format khi can, hop le", hong.length === 0, hong.slice(0, 3).join(" | ")); }
  { const r = SG.sinhMau({ type: "string", format: "uuid", maxLength: 10 }, { seed: "u" });
    kiem("format uuid + maxLength 10 (khong the): hopLe:false, khongDamBao noi ro", r.hopLe === false && r.khongDamBao.some((x) => /maxLength|tối đa/.test(x.lyDo))); }
  kiem("sinhFormat · format la -> null", SG.sinhFormat("khong-co", JE.taoRng("a")) === null);

  /* ---- "dung ngay lan dau": nut sinh ra khong can thu lai (bat loi doan sai roi cuu bang buoc kiem lai) */
  nhom("schema-sinh · moi nut dung NGAY LAN THU DAU (soLanThuNut === soBuocNut) tren schema don gian x 20 seed");
  { const DON = [
      ["so nguyen [3, 9]", { type: "integer", minimum: 3, maximum: 9 }],
      ["so thuc (1, 2) exclusive", { type: "number", exclusiveMinimum: 1, exclusiveMaximum: 2 }],
      ["so nguyen (0, 2) exclusive: chi con 1", { type: "integer", exclusiveMinimum: 0, exclusiveMaximum: 2 }],
      ["draft-04 minimum 1 exclusive:true max 3 exclusive:true (so nguyen)", { $schema: "http://json-schema.org/draft-04/schema#", type: "integer", minimum: 1, exclusiveMinimum: true, maximum: 3, exclusiveMaximum: true }],
      ["multipleOf 0.01 trong [0, 10]", { type: "number", minimum: 0, maximum: 10, multipleOf: 0.01 }],
      ["boi chung 2, 3, 5, 7 (=210) trong [1, 100000]", { type: "integer", minimum: 1, maximum: 100000, allOf: [{ multipleOf: 2 }, { multipleOf: 3 }, { multipleOf: 5 }, { multipleOf: 7 }] }],
      ["boi chung 0.1 va 0.25 (=0.5)", { type: "number", minimum: 0, maximum: 50, allOf: [{ multipleOf: 0.1 }, { multipleOf: 0.25 }] }],
      ["chuoi minLength 3 maxLength 6", { type: "string", minLength: 3, maxLength: 6 }],
      ["pattern don gian", { type: "string", pattern: "^[a-z]{3}[0-9]{2}$" }],
      ["enum so", { enum: [1, 2, 3] }],
      ["type [string, integer, null, boolean] + not {type: string} (loai kieu da liet ke)", { type: ["string", "integer", "null", "boolean"], not: { type: "string" } }],
      ["not {type: string} + minLength (kieu goi y tu tu khoa)", { not: { type: "string" }, minLength: 1 }],
      ["chi co not {type: integer} (khong type, khong goi y)", { not: { type: "integer" } }],
      ["mang so nguyen minItems 2 maxItems 4", { type: "array", items: { type: "integer", minimum: 0, maximum: 5 }, minItems: 2, maxItems: 4 }],
      ["tuple prefixItems + items:false", { type: "array", prefixItems: [{ type: "string" }, { type: "integer" }], items: false }],
      ["object required + additionalProperties false", { type: "object", required: ["a"], properties: { a: { type: "integer" }, b: { type: "string" } }, additionalProperties: false }],
      ["object long 3 cap", { type: "object", required: ["a"], properties: { a: { type: "object", required: ["b"], properties: { b: { type: "object", required: ["c"], properties: { c: { type: "string", format: "date" } } } } } } }],
      ["format date / email / uuid / ipv4 trong object", { type: "object", required: ["d", "e", "u", "i"], properties: { d: { type: "string", format: "date" }, e: { type: "string", format: "email" }, u: { type: "string", format: "uuid" }, i: { type: "string", format: "ipv4" } } }]
    ];
    const hong = [];
    for (const [ten, sc] of DON) {
      let loi = 0;
      for (let i = 0; i < 20; i++) { const r = SG.sinhMau(sc, { seed: "ln" + i, thuLai: 0 }); if (!r.hopLe || r.soLanThuNut !== r.soBuocNut) loi++; }
      if (loi) hong.push(ten + ": " + loi + "/20 lan phai thu lai hoac sai");
    }
    kiem("dung ngay lan dau · " + DON.length + " schema don gian x 20 seed: khong nut nao phai thu lai (thuLai 0)", hong.length === 0, hong.slice(0, 3).join(" | ")); }
  { /* do sau toi da: tuy chon tuy chon KHONG duoc di qua doSauToiDa (che do toi thieu) */
    let sc = { type: "object", required: ["v"], properties: { v: { type: "integer" } } };
    for (let i = 0; i < 12; i++) sc = { type: "object", required: ["v"], properties: { v: { type: "integer" }, next: sc } };
    const dosau = (v) => { let d = 0; while (v && typeof v === "object" && v.next) { d++; v = v.next; } return d + 1; };
    const sau3 = SG.sinhMau(sc, { seed: "s", tiLeTuyChon: 1, doSauToiDa: 3 }), sau8 = SG.sinhMau(sc, { seed: "s", tiLeTuyChon: 1, doSauToiDa: 8 });
    kiem("doSauToiDa 3: chuoi 12 cap 'next' tuy chon (100 % khoa tuy chon) bi cat o <= 5 cap; doSauToiDa 8 sau hon; ca hai hop le",
      sau3.hopLe && sau8.hopLe && dosau(sau3.giaTri) <= 5 && dosau(sau8.giaTri) <= 10 && dosau(sau8.giaTri) > dosau(sau3.giaTri), dosau(sau3.giaTri) + " vs " + dosau(sau8.giaTri)); }

  /* =========================================================== (4) tat dinh */
  nhom("schema-sinh · cung seed + schema + tuy chon -> cung ket qua");
  { const sc = BO[BO.length - 1][1], a = SG.sinhMau(sc, { seed: "S", soLuong: 4 }), b = SG.sinhMau(sc, { seed: "S", soLuong: 4 }), c = SG.sinhMau(sc, { seed: "S2", soLuong: 4 });
    kiem("cung seed -> JSON giong het (4 mau ho so nguoi dung)", JSON.stringify(a.giaTri) === JSON.stringify(b.giaTri) && a.soLanThu === b.soLanThu, "");
    kiem("seed khac -> khac (ho so nguoi dung)", JSON.stringify(a.giaTri) !== JSON.stringify(c.giaTri));
    const m1 = SG.sinhMau(sc, { seed: "S", soLuong: 1 }).giaTri;
    kiem("mau thu 0 cua soLuong=4 giong het soLuong=1 (cung seed)", JSON.stringify(a.giaTri[0]) === JSON.stringify(m1));
    kiem("4 mau trong cung mot lan sinh doi mot khac nhau", new Set(a.giaTri.map((x) => JSON.stringify(x))).size === 4); }
  { let ok = 0; for (const [, schema, opt] of BO) { const tc = Object.assign({ seed: "dd", soLuong: 2 }, opt || {}); if (JSON.stringify(SG.sinhMau(schema, tc).giaTri) === JSON.stringify(SG.sinhMau(schema, tc).giaTri)) ok++; }
    kiem("tat dinh tren TOAN BO bo schema (" + BO.length + "): chay hai lan cho cung ket qua", ok === BO.length, ok + "/" + BO.length); }
  { const sc = { type: "object", properties: { x: { type: "integer" }, y: { type: "string" } } };
    const a = SG.sinhMau(sc, { seed: 7 }), b = SG.sinhMau(sc, { seed: "7" });
    kiem("seed so 7 va chuoi '7' cho cung ket qua", JSON.stringify(a.giaTri) === JSON.stringify(b.giaTri) && a.seed === "7"); }
  { const sc = { oneOf: [{ type: "integer", minimum: 0, maximum: 10 }, { type: "integer", minimum: 5, maximum: 15 }] }, mo = JE.schema.bienDich(sc);
    const a = SG.sinhMau(mo, { seed: "bd" }), b = SG.sinhMau(mo, { seed: "bd" });
    kiem("nhan thang BD da bien dich (bd.laBd) thay vi schema: dung duoc, tat dinh, tai dung bd nhieu lan", a.hopLe && a.giaTri === b.giaTri); }

  /* =========================================================== (5) benh ly */
  nhom("schema-sinh · ca benh ly: khong treo, KHONG bia — bao khongDamBao ro ly do");
  for (const [ten, schema, re] of BENH) {
    const t0 = Date.now(); let r, loiNem = null;
    try { r = SG.sinhMau(schema, { seed: "b" }); } catch (e) { loiNem = e; }
    const ms = Date.now() - t0;
    const lai = r ? kiemLai(schema, r.giaTri, {}) : null;
    kiem("benh ly · " + ten + " -> khong nem, hopLe:false, khongDamBao nhac dung ly do, < 5 s", !loiNem && r.hopLe === false && lai.hopLe === false && r.khongDamBao.length > 0 && r.khongDamBao.some((x) => re.test(x.lyDo)) && ms < 5000,
      loiNem ? String(loiNem.stack).slice(0, 150) : ms + " ms; " + JSON.stringify(r.khongDamBao.map((x) => x.lyDo).slice(0, 3)));
  }
  { const r = SG.sinhMau({ type: "string", pattern: "(" }, { seed: "n" });
    kiem("pattern la bieu thuc sai: bo kiem bo qua pattern (hop le) NHUNG loiSchema co 1 loi de giao dien canh bao; khong nem", r.hopLe === true && r.loiSchema.length === 1 && /pattern/.test(r.loiSchema[0].thongBao), JSON.stringify(r.loiSchema)); }
  { const r = SG.sinhMau(null, { seed: "n" });
    kiem("schema khong hop le o goc (null) -> hopLe:false + khongDamBao, khong nem", r.hopLe === false && r.khongDamBao.length > 0 && r.giaTri === null); }
  { const r = SG.sinhMau(42, { seed: "n" });
    kiem("schema la so 42 -> bao 'Schema không hợp lệ'", r.hopLe === false && /Schema không hợp lệ/.test(r.khongDamBao[0].lyDo)); }
  { const s = { type: "object", required: ["a"], properties: { a: { type: "integer" } } };
    const r = SG.sinhMau(s, { seed: "n", soLuong: 0 }), r2 = SG.sinhMau(s, { seed: "n", soLuong: 99999 }), r3 = SG.sinhMau(s, { seed: "n", soLuong: "abc", doSauToiDa: -5, thuLai: 1e9, tiLeTuyChon: 5 });
    kiem("tuy chon vo ly duoc kep an toan (soLuong 0 -> 1, 99999 -> 1000, chu -> 1; thuLai <= 200; tiLe <= 1)", !Array.isArray(r.giaTri) && r2.giaTri.length === 1000 && !Array.isArray(r3.giaTri) && r3.hopLe, ngan(r3.giaTri)); }
  { const t0 = Date.now(), r = SG.sinhMau({ $ref: "#/$defs/a", $defs: { a: { type: "object", required: ["x", "y"], properties: { x: { $ref: "#/$defs/a" }, y: { $ref: "#/$defs/a" } } } } }, { seed: "n" });
    kiem("de quy bat buoc 2 nhanh (2^36 nut neu khong cat): cat o do sau, bao, khong treo (< 5 s)", r.hopLe === false && /đệ quy/.test(r.khongDamBao.map((x) => x.lyDo).join(" ")) && Date.now() - t0 < 5000, (Date.now() - t0) + " ms"); }
  { const t0 = Date.now(), r = SG.sinhMau({ type: "array", minItems: 100000, items: { type: "integer" } }, { seed: "n", nganSach: 5000 });
    kiem("minItems 100 000 voi ngan sach 5 000: dung som, bao vuot ngan sach, nhanh", r.hopLe === false && /ngân sách/i.test(r.khongDamBao.map((x) => x.lyDo).join(" ")) && Date.now() - t0 < 3000, (Date.now() - t0) + " ms; " + JSON.stringify(r.khongDamBao.map((x) => x.lyDo))); }
  { let s = { type: "integer" }; for (let i = 0; i < 14; i++) s = { anyOf: [s, JSON.parse(JSON.stringify(s))] };
    const t0 = Date.now(), r = SG.sinhMau(s, { seed: "n" });
    kiem("anyOf long 14 cap (2^14 nhanh): sinh duoc nhanh, hop le", r.hopLe && Date.now() - t0 < 3000, (Date.now() - t0) + " ms"); }
  { let s = { type: "string" }; for (let i = 0; i < 300; i++) s = { allOf: [s] };
    const t0 = Date.now(), r = SG.sinhMau(s, { seed: "n" });
    kiem("allOf long 300 cap: khong tran ngan xep, hop le", r.hopLe && typeof r.giaTri === "string" && Date.now() - t0 < 3000, (Date.now() - t0) + " ms"); }
  { let s = { type: "string" }; for (let i = 0; i < 150; i++) s = { type: "object", required: ["a"], properties: { a: s } };
    const t0 = Date.now(), r = SG.sinhMau(s, { seed: "n", doSauToiDa: 6 });
    kiem("object long 150 cap (moi cap bat buoc): sinh het (bat buoc khong bi cat), hop le hoac bao ro, khong nem", (r.hopLe || r.khongDamBao.length > 0) && Date.now() - t0 < 5000, r.hopLe + " " + (Date.now() - t0) + " ms"); }
  { const r = SG.sinhMau({ type: "object", properties: { a: { type: "string", pattern: "(a+)+$" } }, required: ["a"] }, { seed: "n" });
    kiem("pattern ReDoS (a+)+$: sinh chuoi khop ngay, kiem nhanh (sinh khong quay lui)", r.hopLe, JSON.stringify(r.khongDamBao)); }
  { const r = SG.sinhMau({ type: "string", pattern: "^(?=.*\\d)(?=.*[a-z])[a-z0-9]{8}$" }, { seed: "n" });
    kiem("pattern nhin truoc (mat khau 8 ky tu): hoac hop le (da kiem lai), hoac bao khongDamBao co 'nhìn trước' — khong bia", r.hopLe ? /\d/.test(r.giaTri) && /[a-z]/.test(r.giaTri) : r.khongDamBao.some((x) => /nhìn trước|pattern/.test(x.lyDo)), ngan(r.giaTri) + JSON.stringify(r.khongDamBao).slice(0, 120)); }
  { const r = SG.sinhMau({ type: "object", properties: { a: { $ref: "https://vd.com/x.json" } }, required: ["a"] }, { seed: "n", thuVien: { "https://vd.com/x.json": { type: "integer", minimum: 3 } } });
    kiem("$ref ngoai co trong thuVien: giai duoc (offline), sinh hop le", r.hopLe && r.giaTri.a >= 3, ngan(r.giaTri)); }

  /* =========================================================== (6) fuzz schema ngau nhien */
  nhom("schema-sinh · fuzz 400 schema ngau nhien: hopLe (kiem lai doc lap) HOAC khongDamBao khong rong");
  { const rd = C.taoNgauNhien(20241024); let hopLe = 0, bao = 0; const hong = [], loiTong = []; let maxMs = 0, maxSc = "";
    for (let i = 0; i < 400; i++) {
      const sc = schemaNgauNhien(rd, 0, i % 5 === 0);
      if (i % 5 === 0) sc.$defs = { d: schemaNgauNhien(rd, 2, false) };
      const t0 = Date.now(); let r;
      try { r = SG.sinhMau(sc, { seed: "f" + i, thuLai: 6 }); } catch (e) { hong.push("NEM " + ngan(sc) + " " + e.message); continue; }
      const ms = Date.now() - t0; if (ms > maxMs) { maxMs = ms; maxSc = ngan(sc); }
      const lai = kiemLai(sc, r.giaTri, {});
      if (r.hopLe !== lai.hopLe) hong.push("hopLe bao " + r.hopLe + " kiem lai " + lai.hopLe + " " + ngan(sc) + " -> " + ngan(r.giaTri));
      else if (r.hopLe) hopLe++;
      else if (!r.khongDamBao.length) hong.push("khong hop le ma khongDamBao rong " + ngan(sc));
      else { bao++; loiTong.push(ngan(sc) + " => " + (r.khongDamBao[0] && r.khongDamBao[0].lyDo).slice(0, 60)); }
    }
    kiem("fuzz · 400 schema: moi ket qua nhat quan voi kiem lai doc lap; khong hop le thi co khongDamBao; khong nem", hong.length === 0, hong.slice(0, 3).join(" | "));
    console.log("        · fuzz: " + hopLe + " hop le, " + bao + " bao khongDamBao (schema mau thuan co chu y / kho); lau nhat " + maxMs + " ms");
    kiem("fuzz · phan lon schema ngau nhien sinh duoc (>= 85 % hop le); moi cai con lai duoc bao", hopLe >= 340, hopLe + "/400; vi du khong sinh: " + loiTong.slice(0, 3).join(" | "));
    kiem("fuzz · moi lan sinh < 3 s (khong treo)", maxMs < 3000 * SLACK, maxMs + " ms: " + maxSc); }

  /* =========================================================== (7) chay-nen: lenh sinh / suy qua ma Worker */
  nhom("schema-sinh · chay-nen: lenh 'sinh' / 'suy' qua ma Worker ghep tu JE_NGUON (vm rong)");
  { const vm = require("vm"), CN = JE.chayNen, guiDen = [];
    const sandbox = { console, JSON, Math, Object, Array, String, Number, Boolean, RegExp, Error, Date, Map, Set, WeakMap, Uint32Array, Int32Array, Uint8Array, RangeError };
    sandbox.self = sandbox;
    sandbox.postMessage = (d) => guiDen.push(d);
    vm.createContext(sandbox);
    let loiNap = null;
    try { vm.runInContext(CN.taoMa(), sandbox); } catch (e) { loiNap = e.message; }
    kiem("chay-nen · ma Worker (co regex-sinh, schema-sinh, schema-suy) nap duoc trong vm rong", !loiNap && typeof sandbox.JE.schemaSinh.sinhMau === "function" && typeof sandbox.JE.schemaSuy.suySchema === "function" && typeof sandbox.JE.taoRng === "function", loiNap);
    const sc = { type: "object", required: ["id", "ten"], properties: { id: { type: "integer", minimum: 1 }, ten: { type: "string", minLength: 2 }, email: { type: "string", format: "email" } } };
    sandbox.onmessage({ data: { id: 1, loai: "sinh", schema: JSON.stringify(sc), tuyChon: { seed: "w", soLuong: 3 } } });
    const tl = guiDen.pop(), truc = SG.sinhMau(sc, { seed: "w", soLuong: 3 });
    kiem("chay-nen · 'sinh' trong Worker = goi truc tiep (cung seed -> cung giaTri, hopLe, soLanThu), co thoiGianMs",
      tl && tl.id === 1 && tl.kq && tl.kq.hopLe === true && JSON.stringify(tl.kq.giaTri) === JSON.stringify(truc.giaTri) && tl.kq.soLanThu === truc.soLanThu && typeof tl.kq.thoiGianMs === "number", ngan(tl && tl.kq && tl.kq.giaTri));
    sandbox.onmessage({ data: { id: 2, loai: "sinh", schema: "{bad", tuyChon: {} } });
    const t2 = guiDen.pop();
    kiem("chay-nen · 'sinh' voi schema JSON hong -> {loi:{phan:'schema'}}", t2.loi && t2.loi.phan === "schema");
    sandbox.onmessage({ data: { id: 3, loai: "suy", du: JSON.stringify({ a: 1, b: ["x"] }), tuyChon: { chat: true } } });
    const t3 = guiDen.pop(), truc3 = JE.schemaSuy.suySchema({ a: 1, b: ["x"] }, { chat: true });
    kiem("chay-nen · 'suy' trong Worker = goi truc tiep", t3.kq && JSON.stringify(t3.kq.schema) === JSON.stringify(truc3) && typeof t3.kq.thoiGianMs === "number", ngan(t3.kq && t3.kq.schema));
    sandbox.onmessage({ data: { id: 4, loai: "suy", du: "{bad" } });
    const t4 = guiDen.pop();
    kiem("chay-nen · 'suy' voi du lieu JSON hong -> {loi:{phan:'du'}}", t4.loi && t4.loi.phan === "du");
    sandbox.onmessage({ data: { id: 5, loai: "sinh", schema: JSON.stringify({ type: "integer", minimum: 5, maximum: 1 }), tuyChon: { seed: "w" } } });
    const t5 = guiDen.pop();
    kiem("chay-nen · 'sinh' schema mau thuan: tra hopLe:false + khongDamBao (khong phai loi he thong)", t5.kq && t5.kq.hopLe === false && t5.kq.khongDamBao.length > 0 && !t5.loi);
    kiem("chay-nen · ket qua sinh la JSON thuan (structured clone an toan)", (function () { try { return JSON.parse(JSON.stringify(tl.kq)).hopLe === true; } catch (e) { return false; } })());
    sandbox.onmessage({ data: { id: 6, loai: "sinh", schema: JSON.stringify(sc), tuyChon: { seed: "w", soLuong: 2 } } });
    const t6 = guiDen.pop();
    kiem("chay-nen · lenh nen la van chay sau khi dung 'sinh' (Worker tai dung)", t6.kq && t6.kq.hopLe === true);
    /* qua CN.chay voi Worker gia tren luong chinh khong ton tai -> xuLy luong chinh */
    const kq = CN.xuLy(JE, { loai: "sinh", schema: JSON.stringify(sc), tuyChon: { seed: "w" } });
    kiem("chay-nen · xuLy luong chinh 'sinh' (khi khong co Worker) cung ra ket qua", kq.kq && kq.kq.hopLe === true); }

  /* =========================================================== (8) hieu nang */
  nhom("schema-sinh · hieu nang (min cua 3 lan, max(moc x SLACK, k x do chuan))");
  { const props = {}; for (let i = 0; i < 30; i++) props["p" + i] = i % 3 === 0 ? { type: "integer", minimum: 0, maximum: 100 } : i % 3 === 1 ? { type: "string", minLength: 2, maxLength: 12 } : { type: "boolean" };
    const sc = { type: "object", properties: props, required: Object.keys(props) };
    const chuan = C.hieuChuan(() => { JSON.parse(JSON.stringify(sc)); }, 5);
    const t = C.hieuChuan(() => SG.sinhMau(sc, { seed: "p" }), 3);
    console.log("        · sinh 1 mau 30 thuoc tinh bat buoc: " + t.toFixed(1) + " ms (do chuan " + chuan.toFixed(2) + " ms)");
    kiem("sinh 1 mau schema 30 thuoc tinh < max(200 ms x SLACK, 400 x do chuan)", t < Math.max(200 * SLACK, 400 * chuan), t.toFixed(1) + " ms"); }
  { const sc = BO[BO.length - 1][1];
    const t = C.hieuChuan(() => SG.sinhMau(sc, { seed: "p", soLuong: 100 }), 2);
    console.log("        · sinh 100 mau ho so nguoi dung (nhieu tinh nang): " + t.toFixed(0) + " ms");
    kiem("100 mau ho so nguoi dung < max(2 500 ms x SLACK, ...) — tuyen tinh theo so mau", t < 2500 * SLACK, t.toFixed(0) + " ms"); }
  { const sc = { type: "object", properties: { a: { type: "string" } } };
    const t1 = C.hieuChuan(() => SG.sinhMau(sc, { seed: "p", soLuong: 50 }), 3), t2 = C.hieuChuan(() => SG.sinhMau(sc, { seed: "p", soLuong: 500 }), 3);
    kiem("tuyen tinh theo soLuong: 500 mau khong cham hon 25 x 50 mau (+ nen)", t2 < Math.max(25 * t1, 50 * SLACK), t1.toFixed(1) + " -> " + t2.toFixed(1) + " ms"); }
  { const mau = (n) => SG.sinhMau({ type: "string", minLength: n }, { seed: "p" });
    const t1 = C.hieuChuan(() => mau(20000), 2), t2 = C.hieuChuan(() => mau(160000), 2), r = mau(100000);
    kiem("minLength 100000: sinh ra mau hop le (>= 100000 ky tu), khong bao het gio", r && r.hopLe !== false && Array.from(String(r.giaTri)).length >= 100000, JSON.stringify(Object.keys(r || {})));
    kiem("sinh chuoi minLength tuyen tinh: 160K khong cham hon 20 x 20K (+ nen)", t2 < Math.max(20 * t1, 300 * SLACK), t1.toFixed(0) + " -> " + t2.toFixed(0) + " ms");
    const q = SG.sinhMau({ type: "string", minLength: 5e6 }, { seed: "p" });
    kiem("minLength 5e6: bi tran, bao khong dam bao (khong treo)", JSON.stringify(q).indexOf("quá lớn") >= 0, JSON.stringify(q).slice(0, 80)); }
};
