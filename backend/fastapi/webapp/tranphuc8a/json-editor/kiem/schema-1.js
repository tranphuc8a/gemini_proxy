/* kiem/schema-1.js — assets/schema-kiem.js phan 1 (viec 22): bienDich ($id/$anchor/$ref cuc bo + thuVien, ref vong, lint + goi y go sai),
   type / enum / const / so / chuoi (code point, pattern) / mang / object, truong conTro / conTroSchema / tuKhoa cua loi, toiDa,
   hieu nang 1 MB. Moi hang [du lieu, hopLe, …] la MOT phep (xem kiem/chung.js chaySchema). */
"use strict";

module.exports = function (C) {
  const kiem = C.kiem, bang = C.bang;
  const MT = C.taoMoiTruong();
  const JE = MT.JE;
  if (!kiem("schema-1 · nap xong, co JE.schema (bienDich, kiem, kiemNut)", !!(JE && JE.schema && typeof JE.schema.kiem === "function" && typeof JE.schema.bienDich === "function"))) return;
  const S = JE.schema;
  const SLACK = Number(process.env.JE_PERF_SLACK || 3);

  const ds = C.dsScript();
  kiem("index.html · schema-format.js, schema-kiem.js nap sau je-chung.js, truoc json-editor.js",
    ds.indexOf("assets/schema-format.js") > ds.indexOf("assets/je-chung.js") && ds.indexOf("assets/schema-kiem.js") > ds.indexOf("assets/schema-format.js") &&
    ds.indexOf("assets/schema-kiem.js") < ds.indexOf("assets/json-editor.js"), ds.join(", "));

  const LAP = 1e4;
  let tong = 0;

  /* ===================== type ===================== */
  tong += C.chaySchema(JE, [
    ["type string", { type: "string" }, [["a", true], [1, false, "type", ""], [null, false, "type"], [["a"], false, "type"], [{}, false, "type"], [true, false, "type"]]],
    ["type integer", { type: "integer" }, [[1, true], [1.0, true], [-7, true], [1.5, false, "type"], ["1", false, "type"], [true, false, "type"], [null, false, "type"]]],
    ["type number", { type: "number" }, [[1.5, true], [0, true], [-1e9, true], ["1", false, "type"], [null, false, "type"], [[], false, "type"]]],
    ["type [string,null]", { type: ["string", "null"] }, [["a", true], [null, true], [1, false, { tuKhoa: "type", tb: "string hoặc null" }], [[], false, "type"]]],
    ["type boolean", { type: "boolean" }, [[true, true], [false, true], [0, false, "type"], ["true", false, "type"]]],
    ["type object", { type: "object" }, [[{}, true], [{ a: 1 }, true], [[], false, "type"], [null, false, "type"], ["x", false, "type"]]],
    ["type array", { type: "array" }, [[[], true], [[1, 2], true], [{}, false, "type"], ["x", false, "type"]]],
    ["type null", { type: "null" }, [[null, true], [0, false, "type"], ["", false, "type"], [false, false, "type"]]],
    ["schema rong {}", {}, [[1, true], [null, true], [{ a: 1 }, true], [[], true], ["x", true]]],
    ["schema true", true, [[1, true], [null, true], [{}, true]]],
    ["schema false", false, [[1, false, { tuKhoa: "false", tb: "Schema false" }], [null, false], [{}, false]]],
    ["type khong biet bi bo qua (lint bao)", { type: "strin" }, [["a", true], [1, true]]]
  ]);

  /* ===================== enum / const ===================== */
  tong += C.chaySchema(JE, [
    ["enum hon hop", { enum: [1, "a", null, { x: 1 }, [1, 2]] },
      [[1, true], ["a", true], [null, true], [{ x: 1 }, true], [[1, 2], true], [2, false, { tuKhoa: "enum", tb: "Chỉ nhận một trong" }], [true, false, "enum"], [{ x: 2 }, false], [[2, 1], false], ["1", false]]],
    ["enum so 1.0 = 1; true != 1; false != 0", { enum: [1, 0] }, [[1.0, true], [true, false], [false, false], [0, true]]],
    ["enum object khong ke thu tu khoa", { enum: [{ a: 1, b: [1, { c: 2 }] }] }, [[{ b: [1, { c: 2 }], a: 1 }, true], [{ a: 1, b: [1, { c: 3 }] }, false]]],
    ["enum rong khong ai hop le", { enum: [] }, [[1, false, "enum"], [null, false]]],
    ["const 5", { const: 5 }, [[5, true], [5.0, true], ["5", false, { tuKhoa: "const", tb: "Phải bằng đúng 5" }], [6, false]]],
    ["const object sau", { const: { a: [1, { b: null }] } }, [[{ a: [1, { b: null }] }, true], [{ a: [1, { b: 0 }] }, false], [{ a: [1, { b: null }], c: 1 }, false]]],
    ["const null / false", { const: null }, [[null, true], [0, false], [false, false], ["", false]]],
    ["const false", { const: false }, [[false, true], [0, false], [null, false]]]
  ]);

  /* ===================== so ===================== */
  tong += C.chaySchema(JE, [
    ["minimum 5", { minimum: 5 }, [[5, true], [100, true], [4.99, false, { tuKhoa: "minimum", tb: "Phải ≥ 5, đang là 4.99" }], [-1, false], ["x", true], [null, true]]],
    ["maximum 10", { maximum: 10 }, [[10, true], [-5, true], [10.1, false, { tuKhoa: "maximum", tb: "Phải ≤ 10" }], [11, false]]],
    ["exclusiveMinimum 0", { exclusiveMinimum: 0 }, [[0.1, true], [0, false, { tuKhoa: "exclusiveMinimum", tb: "Phải > 0" }], [-1, false], [1e-9, true]]],
    ["exclusiveMaximum 1", { exclusiveMaximum: 1 }, [[0.9, true], [1, false, { tuKhoa: "exclusiveMaximum", tb: "Phải < 1" }], [2, false]]],
    ["multipleOf 2", { multipleOf: 2 }, [[4, true], [0, true], [-4, true], [3, false, { tuKhoa: "multipleOf", tb: "Phải là bội của 2" }], [2.5, false]]],
    ["multipleOf 0.01 (thang thap phan)", { multipleOf: 0.01 }, [[0.07, true], [19.99, true], [4.35, true], [0.075, false], [1.005, false], [100, true]]],
    ["multipleOf 0.1 (0.3, 0.7 la boi)", { multipleOf: 0.1 }, [[0.3, true], [0.7, true], [1.1, true], [0.35, false], [0.05, false]]],
    ["multipleOf 0.0001", { multipleOf: 0.0001 }, [[12.3456, true], [0.0003, true], [12.34561, false]]],
    ["multipleOf 1e-7 (dang khoa hoc)", { multipleOf: 1e-7 }, [[3e-7, true], [1.5e-7, false], [0.0000012, true]]],
    ["integer + khoang", { type: "integer", minimum: 1, maximum: 3 }, [[2, true], [0, false, "minimum"], [4, false, "maximum"], [2.5, false, "type"], ["2", false, "type"]]],
    ["draft-04 exclusiveMinimum:true", { $schema: "http://json-schema.org/draft-04/schema#", minimum: 0, exclusiveMinimum: true }, [[1, true], [0, false, { tuKhoa: "minimum", tb: "Phải > 0" }], [-1, false]]],
    ["draft-04 exclusiveMaximum:true", { $schema: "http://json-schema.org/draft-04/schema#", maximum: 10, exclusiveMaximum: true }, [[9, true], [10, false, "maximum"], [11, false]]],
    ["minimum + maximum cung luc", { minimum: 1, maximum: 5 }, [[3, true], [0, false, { n: 1 }], [9, false, { n: 1 }]]]
  ]);

  /* ===================== chuoi ===================== */
  tong += C.chaySchema(JE, [
    ["minLength 3 (code point)", { minLength: 3 }, [["abc", true], ["ab", false, { tuKhoa: "minLength", tb: "Cần ít nhất 3 ký tự, đang có 2" }], ["😀😀😀", true], ["😀😀", false, { tuKhoa: "minLength", tb: "đang có 2" }], ["", false], [5, true]]],
    ["maxLength 2 (code point)", { maxLength: 2 }, [["ab", true], ["abc", false, { tuKhoa: "maxLength", tb: "tối đa 2 ký tự, đang có 3" }], ["😀😀", true], ["😀😀😀", false], ["", true]]],
    ["pattern ^[A-Z]{3}$", { pattern: "^[A-Z]{3}$" }, [["ABC", true], ["abc", false, { tuKhoa: "pattern", tb: "Không khớp mẫu ^[A-Z]{3}$" }], ["ABCD", false], ["AB", false], [1, true]]],
    ["pattern khong neo la tim", { pattern: "an" }, [["banana", true], ["xyz", false, "pattern"], ["an", true]]],
    ["pattern \\d+", { pattern: "^\\d+$" }, [["123", true], ["12a", false, "pattern"], ["", false]]],
    ["pattern Unicode \\p{L}", { pattern: "^\\p{L}+$" }, [["Phúc", true], ["日本", true], ["a1", false, "pattern"], ["", false]]],
    ["pattern chi o che do khong-u (\\-)", { pattern: "^a\\-b$" }, [["a-b", true], ["ab", false]]],
    ["pattern + do dai", { pattern: "^[a-z]+$", minLength: 2, maxLength: 4 }, [["abc", true], ["a", false, { n: 1, tuKhoa: "minLength" }], ["abcde", false, "maxLength"], ["ABC", false, "pattern"]]]
  ]);

  /* ===================== mang ===================== */
  tong += C.chaySchema(JE, [
    ["minItems / maxItems", { minItems: 2, maxItems: 3 }, [[[1, 2], true], [[1], false, { tuKhoa: "minItems", tb: "Cần ít nhất 2 phần tử, đang có 1" }], [[], false, "minItems"], [[1, 2, 3, 4], false, { tuKhoa: "maxItems", tb: "tối đa 3" }], ["x", true]]],
    ["uniqueItems", { uniqueItems: true }, [
      [[1, 2, 3], true], [[1, 2, 1], false, { tuKhoa: "uniqueItems", conTro: "/2", tb: "Phần tử [2] trùng với [0]" }], [[{ a: 1 }, { a: 1 }], false, "uniqueItems"],
      [[{ a: 1, b: 2 }, { b: 2, a: 1 }], false, "uniqueItems"], [[1, "1"], true], [[1, 1.0], false], [[[1], [1]], false], [[true, 1], true], [[0, false], true],
      [[null, null], false], [[], true], [[{ a: 1 }, { a: 2 }], true], [[[1, 2], [2, 1]], true]]],
    ["uniqueItems false = bo qua", { uniqueItems: false }, [[[1, 1], true]]],
    ["items schema", { items: { type: "integer" } }, [[[1, 2], true], [[], true], [[1, "a"], false, { tuKhoa: "type", conTro: "/1", conTroSchema: "#/items/type" }], [[1, 2, 3.5], false, "type", "/2"]]],
    ["prefixItems (tuple 2020-12)", { prefixItems: [{ type: "string" }, { type: "integer" }] }, [[["a", 1], true], [["a"], true], [[], true], [[1, "a"], false, { n: 2 }], [["a", 1, true], true]]],
    ["prefixItems + items:false", { prefixItems: [{ type: "string" }, { type: "integer" }], items: false }, [[["a", 1], true], [["a", 1, 2], false, { tuKhoa: "items", conTro: "/2", tb: "Thừa phần tử [2] (chỉ cho phép 2 phần tử theo prefixItems)" }], [["a"], true]]],
    ["prefixItems + items schema", { prefixItems: [{ type: "string" }], items: { type: "boolean" } }, [[["a", true, false], true], [["a", "x"], false, "type", "/1"], [[1], false, "type", "/0"]]],
    ["contains", { contains: { type: "integer" } }, [[[1, "a"], true], [["a"], false, { tuKhoa: "contains", tb: "Không phần tử nào khớp contains" }], [[], false, "contains"], [["a", 2], true]]],
    ["minContains 2", { contains: { type: "integer" }, minContains: 2 }, [[[1, 2, "a"], true], [[1, "a"], false, { tuKhoa: "minContains", tb: "Cần ≥ 2 phần tử khớp contains, có 1" }], [["a"], false], [[1, 2, 3], true]]],
    ["maxContains 1", { contains: { type: "integer" }, maxContains: 1 }, [[[1, "a"], true], [[1, 2], false, "maxContains"], [["a"], false, "contains"]]],
    ["minContains 0 cho phep khong khop", { contains: { type: "integer" }, minContains: 0 }, [[["a"], true], [[], true], [[1], true]]],
    ["draft-07 items mang + additionalItems:false", { $schema: "http://json-schema.org/draft-07/schema#", items: [{ type: "integer" }, { type: "string" }], additionalItems: false },
      [[[1, "a"], true], [[1, "a", 3], false, { tuKhoa: "additionalItems", conTro: "/2" }], [[1], true], [["x", "a"], false, "type", "/0"]]],
    ["draft-07 items mang + additionalItems schema", { $schema: "http://json-schema.org/draft-07/schema#", items: [{ type: "integer" }], additionalItems: { type: "string" } },
      [[[1, "a", "b"], true], [[1, 2], false, "type", "/1"]]],
    ["draft-07 items schema bo qua additionalItems", { $schema: "http://json-schema.org/draft-07/schema#", items: { type: "integer" }, additionalItems: false }, [[[1, 2, 3], true]]],
    ["draft-07 contains khong co minContains", { $schema: "http://json-schema.org/draft-07/schema#", contains: { type: "integer" }, minContains: 3 }, [[[1], true], [["a"], false, "contains"]]],
    ["items long nhau", { items: { items: { type: "string" } } }, [[[["a"], ["b", "c"]], true], [[["a"], ["b", 1]], false, { conTro: "/1/1", tuKhoa: "type" }]]]
  ]);

  /* ===================== object ===================== */
  tong += C.chaySchema(JE, [
    ["properties", { properties: { a: { type: "integer" } } }, [[{ a: 1 }, true], [{ a: "x" }, false, { tuKhoa: "type", conTro: "/a", hien: "$.a", conTroSchema: "#/properties/a/type" }], [{ b: 1 }, true], [{}, true], [[], true], ["x", true]]],
    ["required", { required: ["a", "b"] }, [[{ a: 1, b: 2 }, true], [{ a: 1 }, false, { tuKhoa: "required", conTro: "", tb: "Thiếu khoá bắt buộc “b”" }], [{}, false, { n: 2 }], [[], true], [{ a: null, b: null }, true]]],
    ["required long nhau + properties", { properties: { u: { required: ["id"] } } }, [[{ u: { id: 1 } }, true], [{ u: {} }, false, { tuKhoa: "required", conTro: "/u", conTroSchema: "#/properties/u/required" }], [{}, true]]],
    ["additionalProperties:false", { properties: { a: {} }, additionalProperties: false }, [[{ a: 1 }, true], [{}, true], [{ a: 1, b: 2 }, false, { tuKhoa: "additionalProperties", conTro: "/b", tb: "Khoá “b” không được phép" }], [{ b: 1, c: 2 }, false, { n: 2 }]]],
    ["additionalProperties schema", { properties: { a: {} }, additionalProperties: { type: "integer" } }, [[{ a: "x", b: 2 }, true], [{ b: "y" }, false, { tuKhoa: "type", conTro: "/b" }]]],
    ["patternProperties", { patternProperties: { "^x-": { type: "string" } } }, [[{ "x-a": "s" }, true], [{ "x-a": 1 }, false, { tuKhoa: "type", conTro: "/x-a" }], [{ y: 1 }, true]]],
    ["patternProperties + additionalProperties:false", { patternProperties: { "^x-": {} }, additionalProperties: false }, [[{ "x-1": 1 }, true], [{ y: 1 }, false, "additionalProperties", "/y"]]],
    ["properties + patternProperties cung khop", { properties: { "x-a": { type: "string" } }, patternProperties: { "^x-": { minLength: 3 } } }, [[{ "x-a": "abc" }, true], [{ "x-a": "ab" }, false, "minLength"], [{ "x-a": 1 }, false, "type"]]],
    ["propertyNames", { propertyNames: { pattern: "^[a-z]+$" } }, [[{ abc: 1 }, true], [{ Abc: 1 }, false, { tuKhoa: "propertyNames", conTro: "/Abc", tb: "Tên khoá “Abc” không hợp lệ", con: true }], [{}, true], [[], true]]],
    ["minProperties / maxProperties", { minProperties: 1, maxProperties: 2 }, [[{ a: 1 }, true], [{}, false, { tuKhoa: "minProperties", tb: "Cần ít nhất 1 khoá, đang có 0" }], [{ a: 1, b: 2, c: 3 }, false, { tuKhoa: "maxProperties", tb: "tối đa 2 khoá" }], [[], true]]],
    ["dependentRequired", { dependentRequired: { a: ["b", "c"] } }, [[{ a: 1, b: 2, c: 3 }, true], [{ b: 1 }, true], [{ a: 1, b: 2 }, false, { tuKhoa: "dependentRequired", conTro: "", tb: "Có “a” thì phải có “c”" }], [{ a: 1 }, false, { n: 2 }]]],
    ["dependentSchemas", { dependentSchemas: { a: { required: ["b"], properties: { b: { type: "integer" } } } } }, [[{ a: 1, b: 2 }, true], [{ x: 1 }, true], [{ a: 1 }, false, "required"], [{ a: 1, b: "s" }, false, "type", "/b"]]],
    ["__proto__ la khoa thuong", JSON.parse('{"properties":{"__proto__":{"type":"integer"}}}'), [['{"__proto__": 1}', true], ['{"__proto__": "x"}', false, { tuKhoa: "type", conTro: "/__proto__" }], ['{"b":1}', true]], { json: true }],
    ["khoa co / ~ trong conTro", { properties: { "a/b": { type: "integer" }, "c~d": { type: "integer" } } }, [[{ "a/b": "x" }, false, { conTro: "/a~1b", hien: '$["a/b"]' }], [{ "c~d": "x" }, false, { conTro: "/c~0d" }]]],
    ["object long 3 cap", { properties: { a: { properties: { b: { properties: { c: { type: "integer" } } } } } } }, [[{ a: { b: { c: 1 } } }, true], [{ a: { b: { c: "x" } } }, false, { conTro: "/a/b/c", hien: "$.a.b.c", conTroSchema: "#/properties/a/properties/b/properties/c/type" }]]]
  ]);

  /* ===================== $ref / $defs / $id / $anchor ===================== */
  tong += C.chaySchema(JE, [
    ["$ref $defs", { $defs: { pos: { type: "integer", minimum: 1 } }, properties: { n: { $ref: "#/$defs/pos" } } },
      [[{ n: 2 }, true], [{ n: 0 }, false, { tuKhoa: "minimum", conTro: "/n", conTroSchema: "#/$defs/pos/minimum" }], [{ n: "x" }, false, { tuKhoa: "type", conTroSchema: "#/$defs/pos/type" }]]],
    ["$ref definitions (draft-07 kieu cu o 2020-12)", { definitions: { s: { type: "string" } }, properties: { a: { $ref: "#/definitions/s" } } }, [[{ a: "x" }, true], [{ a: 1 }, false, "type", "/a"]]],
    ["$ref de quy cay (#)", { type: "object", properties: { v: { type: "integer" }, kids: { type: "array", items: { $ref: "#" } } } },
      [[{ v: 1, kids: [{ v: 2, kids: [] }, { v: 3 }] }, true], [{ v: 1, kids: [{ v: "x" }] }, false, { tuKhoa: "type", conTro: "/kids/0/v" }], [{ kids: [{ kids: [{ v: 1.5 }] }] }, false, "type", "/kids/0/kids/0/v"]]],
    ["$ref vong: {$ref:#} khong treo", { $ref: "#" }, [[1, false, { tuKhoa: "$ref", tb: "Vòng $ref" }], [{ a: 1 }, false, "$ref"]]],
    ["$ref vong hai buoc a<->b", { $defs: { a: { $ref: "#/$defs/b" }, b: { $ref: "#/$defs/a" } }, $ref: "#/$defs/a" }, [[1, false, "$ref"], [null, false]]],
    ["$ref vong qua allOf", { allOf: [{ $ref: "#" }] }, [[1, false, "$ref"]]],
    ["$ref khong tim thay -> sai", { $ref: "#/nope" }, [[1, false, { tuKhoa: "$ref", tb: "Không tìm thấy $ref" }]]],
    ["$anchor", { $defs: { x: { $anchor: "foo", type: "string" } }, $ref: "#foo" }, [["a", true], [1, false, "type"]]],
    ["$id tuyet doi + $id con tuong doi", { $id: "https://ex.com/root.json", $defs: { x: { $id: "x.json", type: "integer" } }, properties: { a: { $ref: "x.json" } } },
      [[{ a: 1 }, true], [{ a: "s" }, false, { tuKhoa: "type", conTro: "/a" }]]],
    ["$ref theo $id tuyet doi", { $id: "https://ex.com/s.json", $defs: { n: { $id: "https://ex.com/n.json", type: "number" } }, properties: { a: { $ref: "https://ex.com/n.json" } } }, [[{ a: 1.5 }, true], [{ a: "x" }, false, "type"]]],
    ["$ref neo # trong schema co $id", { $id: "https://ex.com/r.json", $defs: { s: { type: "string" } }, properties: { a: { $ref: "#/$defs/s" } } }, [[{ a: "x" }, true], [{ a: 1 }, false, "type"]]],
    ["$ref toi dia chi ngoai -> sai + loi schema", { $ref: "https://example.com/a.json" }, [[1, false, { tuKhoa: "$ref", tb: "Không tải được $ref ngoài" }]]],
    ["$ref anh em ($ref + maxLength) o 2020-12", { $defs: { a: { type: "string" } }, $ref: "#/$defs/a", maxLength: 2 }, [["ab", true], ["abc", false, "maxLength"], [1, false, "type"]]],
    ["$ref anh em bi bo qua o draft-07", { $schema: "http://json-schema.org/draft-07/schema#", definitions: { a: { type: "string" } }, $ref: "#/definitions/a", maxLength: 2 }, [["abc", true], [1, false, "type"]]],
    ["$ref %-ma hoa + ~ trong con tro", { $defs: { "a/b": { type: "integer" }, "c d": { type: "string" } }, properties: { x: { $ref: "#/$defs/a~1b" }, y: { $ref: "#/$defs/c%20d" } } },
      [[{ x: 1, y: "s" }, true], [{ x: "s" }, false, "type", "/x"], [{ y: 1 }, false, "type", "/y"]]],
    ["$ref vao schema anh em (#/properties/b)", { properties: { a: { $ref: "#/properties/b" }, b: { type: "integer" } } }, [[{ a: 1 }, true], [{ a: "x" }, false, "type", "/a"]]],
    ["$ref vao phan tu mang (#/allOf/0)", { properties: { a: { $ref: "#/anyOf/0" } }, anyOf: [{ type: "object" }] }, [[{ a: {} }, true], [{ a: 1 }, false, "type", "/a"]]],
    ["$ref toi schema boolean", { $defs: { khong: false }, properties: { a: { $ref: "#/$defs/khong" } } }, [[{}, true], [{ a: 1 }, false, { tuKhoa: "false", conTro: "/a" }]]]
  ]);

  /* thuVien: $ref ngoai giai duoc khi co trong thu vien */
  {
    const tv = { "https://ex.com/a.json": { type: "integer", minimum: 1 }, "https://ex.com/b.json": { $defs: { z: { type: "string" } } } };
    const bd = S.bienDich({ properties: { n: { $ref: "https://ex.com/a.json" }, s: { $ref: "https://ex.com/b.json#/$defs/z" } } }, { thuVien: tv });
    kiem("thuVien · $ref ngoai co trong thu vien: khong loi schema", bd.loiSchema.length === 0, JSON.stringify(bd.loiSchema));
    kiem("thuVien · {n:1, s:'x'} hop le", S.kiem({ n: 1, s: "x" }, bd).hopLe === true);
    kiem("thuVien · {n:0} sai o minimum cua schema trong thu vien (conTroSchema co $id)", (function () {
      const r = S.kiem({ n: 0 }, bd);
      return !r.hopLe && r.loi[0].tuKhoa === "minimum" && /^https:\/\/ex\.com\/a\.json#/.test(r.loi[0].conTroSchema);
    })());
    kiem("thuVien · {s:1} sai o type cua $defs/z", S.kiem({ s: 1 }, bd).loi[0].conTroSchema === "https://ex.com/b.json#/$defs/z/type");
    kiem("thuVien · thieu thu vien thi bao loi schema ngoai (khong tai mang)", S.bienDich({ $ref: "https://ex.com/a.json" }).loiSchema.some((e) => /ngoài/.test(e.thongBao)));
    tong += 5;
  }

  /* ===================== lint schema ===================== */
  {
    const lint = (sc, tc) => S.bienDich(sc, tc);
    let bd = lint({ required: "a" });
    kiem("lint · required khong phai mang -> loi schema co conTroSchema", bd.loiSchema.length === 1 && bd.loiSchema[0].conTroSchema === "#/required" && /mảng chuỗi/.test(bd.loiSchema[0].thongBao), JSON.stringify(bd.loiSchema));
    kiem("lint · type khong biet / minimum chuoi / pattern sai / minLength am", lint({ type: "strin" }).loiSchema.length === 1 && lint({ minimum: "x" }).loiSchema.length === 1 &&
      lint({ pattern: "(" }).loiSchema.length === 1 && lint({ minLength: -1 }).loiSchema.length === 1 && lint({ multipleOf: 0 }).loiSchema.length === 1);
    bd = lint({ requried: ["a"], properties: { a: { tyep: "string" } } });
    kiem("lint · tu khoa go sai -> canh bao + goi y (Levenshtein <= 2)", bd.canhBao.length === 2 && bd.canhBao[0].goiY === "required" && bd.canhBao[1].goiY === "type" && /có phải “required”/.test(bd.canhBao[0].thongBao) &&
      bd.canhBao[1].conTroSchema === "#/properties/a/tyep", JSON.stringify(bd.canhBao));
    kiem("lint · tu khoa la khong co goi y van canh bao; x-… khong canh bao", lint({ banhxe: 1 }).canhBao.length === 1 && lint({ banhxe: 1 }).canhBao[0].goiY === null && lint({ "x-note": 1 }).canhBao.length === 0);
    kiem("lint · schema hop le khong co loi / canh bao", (function () { const b = lint({ type: "object", properties: { a: { type: "string", minLength: 1 } }, required: ["a"] }); return !b.loiSchema.length && !b.canhBao.length; })());
    kiem("lint · format la -> canh bao bo qua; unevaluatedProperties -> canh bao chua ho tro",
      lint({ format: "zzz" }).canhBao.length === 1 && lint({ unevaluatedProperties: false }).canhBao.some((e) => /chưa được hỗ trợ/.test(e.thongBao)));
    kiem("lint · schema goc khong phai object/boolean; schema con sai kieu", lint(5).loiSchema.length === 1 && lint([]).loiSchema.length === 1 && lint({ properties: { a: 5 } }).loiSchema.length === 1 &&
      lint({ properties: [] }).loiSchema.length === 1 && lint({ allOf: [] }).loiSchema.length === 1);
    kiem("lint · $ref khong tim thay -> loi schema ngay luc bienDich (khong cho den luc co du lieu)", lint({ properties: { a: { $ref: "#/khong" } } }).loiSchema.some((e) => e.conTroSchema === "#/properties/a/$ref"));
    kiem("lint · $anchor sai dang, enum rong, required trung -> canh bao", lint({ $anchor: "1x" }).canhBao.length === 1 && lint({ enum: [] }).canhBao.length === 1 && lint({ required: ["a", "a"] }).canhBao.length === 1);
    kiem("lint · $ref anh em o draft-07 -> canh bao bi bo qua", lint({ $schema: "http://json-schema.org/draft-07/schema#", definitions: { a: {} }, $ref: "#/definitions/a", maxLength: 1 }).canhBao.some((e) => /bị bỏ qua/.test(e.thongBao)));
    kiem("lint · patternProperties co khoa regex sai -> loi schema", lint({ patternProperties: { "(": {} } }).loiSchema.length === 1);
    tong += 11;
  }

  /* ===================== truong cua loi, toiDa, dungSom, schema hong ===================== */
  {
    const sc = { properties: { items: { type: "array", items: { properties: { email: { type: "string", format: "email" } } } } } };
    let r = S.kiem({ items: [{ email: "ok@x.vn" }, { email: "abc" }] }, sc, { format: "loi" });
    const e = r.loi[0];
    kiem("loi · format mức “lỗi”: conTro / duong / hien / conTroSchema / tuKhoa / thongBao dung",
      !r.hopLe && r.loi.length === 1 && e.conTro === "/items/1/email" && bang(e.duong, ["items", 1, "email"]) && e.hien === "$.items[1].email" &&
      e.conTroSchema === "#/properties/items/items/properties/email/format" && e.tuKhoa === "format" && e.muc === "loi" && e.thongBao === "Không phải email hợp lệ: “abc”", JSON.stringify(e));
    r = S.kiem({ items: [{ email: "abc" }] }, sc);
    kiem("loi · format mac dinh = canh bao: hopLe van true, canhBao co 1 muc, muc = canh-bao", r.hopLe && r.loi.length === 0 && r.canhBao.length === 1 && r.canhBao[0].muc === "canh-bao" && r.canhBao[0].conTro === "/items/0/email");
    kiem("loi · format bo-qua: khong loi, khong canh bao", (function () { const x = S.kiem({ items: [{ email: "abc" }] }, sc, { format: "bo-qua" }); return x.hopLe && !x.canhBao.length; })());
    const nhieu = { items: { type: "integer" } };
    const mang = new Array(1000).fill("x");
    r = S.kiem(mang, nhieu);
    kiem("toiDa · mac dinh 200 loi, catBot = true", r.loi.length === 200 && r.catBot === true && !r.hopLe);
    r = S.kiem(mang, nhieu, { toiDa: 5 });
    kiem("toiDa · toiDa: 5 -> dung o 5 loi", r.loi.length === 5 && r.catBot === true);
    r = S.kiem(mang, nhieu, { dungSom: true });
    kiem("dungSom · dung o loi dau tien", r.loi.length === 1 && !r.hopLe);
    r = S.kiem([1, 2, 3], nhieu);
    kiem("toiDa · khong vuot thi catBot = false", r.hopLe && r.catBot === false);
    r = S.kiem({ a: 1 }, 5);
    kiem("schema hong (so 5) · kiem khong nem, hopLe true, loiSchema co 1 muc", r.hopLe === true && r.loiSchema.length === 1 && S.kiem(1, null).hopLe === true && S.kiem(1, undefined).hopLe === true);
    r = S.kiem({ a: 1 }, { required: "a", properties: { a: { type: "string" } } });
    kiem("schema hong mot phan · tu khoa hong bi bo qua, phan con lai van kiem (type van bat)", r.hopLe === false && r.loi.length === 1 && r.loi[0].tuKhoa === "type" && r.loiSchema.length === 1);
    r = S.kiem(null, { type: "null" });
    kiem("ket qua · ten truong cua kiem(): hopLe, loi, canhBao, catBot, loiSchema, canhBaoSchema, draft",
      ["hopLe", "loi", "canhBao", "catBot", "loiSchema", "canhBaoSchema", "draft"].every((k) => k in r) && r.draft === "2020-12");
    tong += 10;
  }

  /* du lieu long qua sau: khong nem, bao loi he thong */
  {
    const r = S.kiem(C.longSau(20000), { $defs: { a: { type: "array", items: { $ref: "#/$defs/a" } } }, $ref: "#/$defs/a" });
    kiem("do sau · du lieu long 20 000 cap + schema de quy: khong nem loi (RangeError duoc bat, bao loi he thong)", r && r.hopLe === false && r.loi.length >= 1 && r.loi[0].tuKhoa === "(he-thong)");
    tong++;
  }

  /* Tran ngan xep BEN TRONG nhanh danh gia "im lang" (not / contains / if) hoac nhanh thu (anyOf / oneOf): trang thai ng.loi
     (null / mang tam) phai duoc khoi phuc truoc khi chayDanhGia ghi loi "long qua sau" — truoc day ng.loi con null nen
     catch nem TypeError "Cannot read properties of null (reading 'push')" (giao dien hien "Khong kiem duoc — Cannot read…"). */
  {
    const rec = { $defs: { t: { type: "array", items: { $ref: "#/$defs/t" } } } };
    const ref = { $ref: "#/$defs/t" };
    const sau = C.longSau(20000);
    const CA = [
      ["not", { not: ref }, sau],
      ["contains", { contains: ref }, [sau]],
      ["if", { if: ref, then: true }, sau],
      ["if/else", { if: ref, else: false }, sau],
      ["anyOf", { anyOf: [ref, { type: "string" }] }, sau],
      ["oneOf", { oneOf: [ref, { type: "string" }] }, sau]
    ];
    CA.forEach(([ten, sc, du]) => {
      let r = null, nem = "";
      try { r = S.kiem(du, Object.assign({}, rec, sc)); } catch (e) { nem = String(e && e.message || e); }
      kiem("do sau · tran ngan xep trong nhanh " + ten + ": loi he thong 'long qua sau' than thien, khong nem / khong TypeError",
        !nem && !!r && r.hopLe === false && r.loi.some((e) => e.tuKhoa === "(he-thong)" && /lồng quá sâu/.test(e.thongBao)), nem || (r && JSON.stringify(r.loi.map((e) => e.thongBao.slice(0, 60)))));
      tong++;
    });
    const xl = MT.JE.chayNen && MT.JE.chayNen.xuLy;
    if (xl) {
      const t = xl(MT.JE, { loai: "kiem", du: "[".repeat(20000) + "]".repeat(20000), schema: JSON.stringify(Object.assign({}, rec, { not: ref })) });
      kiem("do sau · qua Worker (xuLy): nhanh not tran ngan xep -> ket qua co loi 'long qua sau', KHONG phai loi he thong 'Cannot read properties of null'",
        !!t.kq && t.kq.loi.some((e) => /lồng quá sâu/.test(e.thongBao)) && !t.loi, JSON.stringify(t).slice(0, 160));
      tong++;
    }
  }

  /* catBot chi bat khi THUC SU co loi bi bo: dung 200 loi (toiDa) -> khong cat; 201 -> cat 1 */
  {
    const nhieu = { items: { type: "integer" } };
    let r = S.kiem(new Array(200).fill("x"), nhieu);
    kiem("toiDa · dung 200 loi (bang toiDa): khong bo loi nao -> catBot = false", r.loi.length === 200 && r.catBot === false);
    r = S.kiem(new Array(201).fill("x"), nhieu);
    kiem("toiDa · 201 loi: giu 200, bo 1 -> catBot = true", r.loi.length === 200 && r.catBot === true);
    r = S.kiem(new Array(5).fill("x"), nhieu, { toiDa: 5 });
    kiem("toiDa · toiDa: 5 va dung 5 loi -> catBot = false; 6 loi -> true",
      r.loi.length === 5 && r.catBot === false && S.kiem(new Array(6).fill("x"), nhieu, { toiDa: 5 }).catBot === true);
    r = S.kiem(new Array(200).fill("x"), { items: { type: "integer" }, minItems: 300 });
    kiem("toiDa · 200 loi o items + 1 loi minItems: loi thu 201 bi bo -> catBot = true", r.loi.length === 200 && r.catBot === true);
    tong += 4;
  }

  /* Goi y go sai (Levenshtein voi ~60 tu khoa) chi cho 200 tu khoa la DAU TIEN cua mot lan bienDich: schema co hang chuc nghin
     tu khoa la khong duoc ton ~2 s chi de goi y (do truoc: 20 000 tu khoa la = 1,9 s). Van du canh bao cho TAT CA tu khoa la. */
  {
    const L = "abcdefghijklmnopqrstuvwxyz", sc = {};
    for (let i = 0; i < 300; i++) sc["type" + L[i % 26] + L[Math.floor(i / 26)]] = 1;
    const bd = S.bienDich(sc);
    const coGoiY = bd.canhBao.filter((c) => c.goiY === "type").length;
    kiem("lint · 300 tu khoa la gan 'type': du 300 canh bao, goi y chi cho 200 cai dau (tran chi phi)", bd.canhBao.length === 300 && coGoiY === 200, bd.canhBao.length + " canh bao, " + coGoiY + " co goi y");
    const lon = {};
    for (let i = 0; i < 20000; i++) lon["khoa_la_" + i] = i;
    const SLACK2 = Number(process.env.JE_PERF_SLACK || 3);
    const chuan = C.hieuChuan(() => JSON.parse(JSON.stringify(lon)));
    const gh = Math.max(300 * SLACK2, 40 * chuan);
    let b2 = null;
    const ms = Math.round(C.hieuChuan(() => { b2 = S.bienDich(lon); }));
    kiem("hieu nang · bienDich schema 20 000 tu khoa la: " + ms + " ms < " + Math.round(gh) + " ms (truoc cap goi y: ~1900 ms)", b2.canhBao.length === 20000 && ms < gh, "do chuan " + Math.round(chuan) + " ms");
    tong += 2;
  }

  /* required / oneOf: cac ca tung la khoang trong phep kiem (dot bien song sot) */
  tong += C.chaySchema(JE, [
    ["required khoa trung ten nguyen mau", { required: ["toString", "constructor", "__proto__", "hasOwnProperty"] },
      [["{}", false, { tuKhoa: "required", n: 4 }], ['{"toString":1,"constructor":2,"__proto__":3,"hasOwnProperty":4}', true],
       ['{"toString":1,"constructor":2,"hasOwnProperty":4}', false, { tuKhoa: "required", n: 1, tb: "__proto__" }]], { json: true }],
    ["required: [\"toString\"] voi {} va voi khoa that", { required: ["toString"] }, [["{}", false, { n: 1 }], ['{"toString":null}', true], ['{"valueOf":1}', false]], { json: true }],
    ["oneOf IM LANG trong not: hai nhanh cung khop -> oneOf sai -> not dat", { not: { oneOf: [{ type: "integer" }, { type: "number", minimum: 0 }] } },
      [[5, true], [-1, false, "not"], [5.5, false, "not"], ["x", true]]],
    ["oneOf IM LANG trong if: hai nhanh khop -> if sai -> khong then", { if: { oneOf: [{ type: "integer" }, { type: "number", minimum: 0 }] }, then: { type: "string" } },
      [[5, true], [-1, false, "type"], [5.5, false, "type"]]],
    ["oneOf IM LANG trong contains: chi dem phan tu khop DUNG MOT nhanh", { contains: { oneOf: [{ type: "integer" }, { type: "number", minimum: 0 }] } },
      [[[5, 5], false, "contains"], [[5, -1], true], [[], false, "contains"]]],
    ["oneOf khong im lang: 0 / 1 / 2 nhanh khop", { oneOf: [{ type: "integer" }, { type: "number", minimum: 0 }] },
      [[5, false, "oneOf"], [-1, true], [5.5, true], ["x", false, "oneOf"]]]
  ]);

  /* kiemNut */
  {
    const bd = S.bienDich({ properties: { a: { type: "integer", minimum: 1 } } });
    const nut = bd.nutTheoConTro("#/properties/a");
    const r1 = nut && S.kiemNut(nut, 5, bd), r2 = nut && S.kiemNut(nut, 0, bd);
    kiem("kiemNut · kiem cuc bo mot nut (cho bo sinh): 5 hop le, 0 sai o minimum", !!nut && r1.hopLe && !r2.hopLe && r2.loi[0].tuKhoa === "minimum" && r2.loi[0].conTro === "");
    tong++;
  }

  /* ===================== hieu nang 1 MB ===================== */
  {
    const sc = {
      type: "array", items: { $ref: "#/$defs/n" },
      $defs: { n: { type: "object", required: ["id", "name"], properties: { id: { type: "integer", minimum: 0 }, name: { type: "string", minLength: 1 }, tags: { type: "array", items: { type: "string" }, uniqueItems: true },
        addr: { type: "object", properties: { city: { type: "string" }, geo: { type: "array", items: { type: "number" }, minItems: 2, maxItems: 2 } } }, ok: { type: "boolean" } }, additionalProperties: false } }
    };
    const mau = [];
    for (let i = 0; i < 10500; i++) mau.push({ id: i, name: "Nguoi " + i, tags: ["a", "b", "c"], addr: { city: "Ha Noi", geo: [i, i + 1] }, ok: i % 2 === 0 });
    const kich = JSON.stringify(mau).length;
    /* Do chuan cung may cung luc (JSON.parse + stringify cua chinh du lieu nay): may ban thi gioi han noi theo — khong flaky. */
    const chuan = C.hieuChuan(() => JSON.parse(JSON.stringify(mau)));
    const gh = Math.max(300 * SLACK, 15 * chuan);
    const bd = S.bienDich(sc);
    S.kiem(mau.slice(0, 50), bd);                              /* lam nong JIT */
    let r = null;
    const ms = Math.round(C.hieuChuan(() => { r = S.kiem(mau, bd); }));       /* nho nhat cua 3 lan (tru nhieu do may ban) */
    console.log("        · kiem " + (kich / 1048576).toFixed(2) + " MB (" + mau.length + " object) = " + ms + " ms");
    kiem("hieu nang · kiem " + (kich / 1048576).toFixed(2) + " MB hop le: " + ms + " ms < " + Math.round(gh) + " ms (thiet ke 300 x " + SLACK + "; do chuan " + Math.round(chuan) + " ms)", r.hopLe && ms < gh);
    mau[9000].addr.geo = [1];
    mau[10].tags = ["a", "a"];
    const t = Date.now();
    const r2 = S.kiem(mau, bd);
    kiem("hieu nang · 2 loi chen vao: tim dung ca hai (/9000/addr/geo, /10/tags/1) trong " + (Date.now() - t) + " ms", r2.loi.length === 2 && r2.loi.some((e) => e.conTro === "/9000/addr/geo" && e.tuKhoa === "minItems") && r2.loi.some((e) => e.conTro === "/10/tags/1" && e.tuKhoa === "uniqueItems"), JSON.stringify(r2.loi.map((e) => e.conTro)));
    tong += 2;
  }

  kiem("schema-1 · tong so phep (ca + kiem tra rieng) >= 150: " + tong, tong >= 150);
};
