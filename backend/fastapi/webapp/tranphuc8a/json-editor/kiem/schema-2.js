/* kiem/schema-2.js — assets/schema-kiem.js phan 2 (viec 23): allOf / anyOf / oneOf / not (best-match + `con`), if / then / else,
   dependentRequired / dependentSchemas / dependencies, format 3 muc, tuong thich draft-07 / 2019-09 / draft-04 voi 2020-12,
   $dynamicRef / $recursiveRef xap xi, giaiUri (RFC 3986), trongNhuSchema. Moi hang la MOT phep. */
"use strict";

module.exports = function (C) {
  const kiem = C.kiem, bang = C.bang;
  const MT = C.taoMoiTruong();
  const JE = MT.JE;
  if (!kiem("schema-2 · nap xong, co JE.schema", !!(JE && JE.schema))) return;
  const S = JE.schema;
  let tong = 0;

  /* ===================== allOf ===================== */
  tong += C.chaySchema(JE, [
    ["allOf 2 nhanh", { allOf: [{ type: "integer" }, { minimum: 3 }] }, [[5, true], [2, false, { tuKhoa: "minimum", n: 1 }], ["a", false, { tuKhoa: "type", n: 1 }], [3.5, false, { tuKhoa: "type", n: 1 }], [2.5, false, { n: 2 }]]],
    ["allOf gop properties + required", { allOf: [{ properties: { a: { type: "integer" } } }, { required: ["a"] }] },
      [[{ a: 1 }, true], [{}, false, { tuKhoa: "required", conTro: "", conTroSchema: "#/allOf/1/required" }], [{ a: "x" }, false, { tuKhoa: "type", conTro: "/a", conTroSchema: "#/allOf/0/properties/a/type" }]]],
    ["allOf rong-sai: allOf chua true/false", { allOf: [true, { type: "string" }] }, [["a", true], [1, false, "type"]]],
    ["allOf co false", { allOf: [{ type: "string" }, false] }, [["a", false, "false"], [1, false, { n: 2 }]]],
    ["allOf long trong anyOf", { anyOf: [{ allOf: [{ type: "integer" }, { minimum: 10 }] }, { type: "string" }] }, [[10, true], ["s", true], [5, false, "anyOf"], [null, false, "anyOf"]]]
  ]);

  /* ===================== anyOf ===================== */
  tong += C.chaySchema(JE, [
    ["anyOf", { anyOf: [{ type: "string" }, { type: "integer" }] }, [["a", true], [1, true], [null, false, { tuKhoa: "anyOf", tb: "Không khớp lựa chọn nào trong anyOf (2)", con: true }], [1.5, false, "anyOf"], [[], false, "anyOf"]]],
    ["anyOf nhanh gan dung nhat (it loi nhat) xep dau", { anyOf: [{ type: "object", required: ["a", "b", "c"] }, { type: "object", required: ["a"], properties: { a: { type: "integer" } } }] },
      [[{ a: 1 }, true], [{ a: 1, b: 1, c: 1 }, true], [{ a: "x" }, false, { tuKhoa: "anyOf", tb: "gần đúng nhất là lựa chọn #1" }]]],
    ["anyOf nhanh nguyen thuy / null", { anyOf: [{ type: "string", minLength: 2 }, { type: "null" }] }, [["ab", true], [null, true], ["a", false, "anyOf"], [1, false, "anyOf"]]],
    ["anyOf trong properties giu conTro", { properties: { x: { anyOf: [{ type: "string" }, { type: "integer" }] } } }, [[{ x: "a" }, true], [{ x: null }, false, { tuKhoa: "anyOf", conTro: "/x", conTroSchema: "#/properties/x/anyOf" }], [{}, true]]],
    ["anyOf lop lang: loi con co conTro day du", { properties: { x: { anyOf: [{ properties: { y: { type: "integer" } } }, { type: "string" }] } } }, [[{ x: { y: "s" } }, false, "anyOf"], [{ x: { y: 1 } }, true]]],
    ["anyOf voi $ref", { $defs: { a: { type: "string" }, b: { type: "integer" } }, anyOf: [{ $ref: "#/$defs/a" }, { $ref: "#/$defs/b" }] }, [["s", true], [1, true], [true, false, "anyOf"]]]
  ]);

  /* ===================== oneOf ===================== */
  tong += C.chaySchema(JE, [
    ["oneOf trung hai nhanh", { oneOf: [{ type: "integer" }, { minimum: 3 }] }, [[5, false, { tuKhoa: "oneOf", tb: "Khớp 2 lựa chọn (#0, #1) trong oneOf — chỉ được đúng một" }], [2, true], [3.5, true], ["a", true]]],
    ["oneOf khong nhanh nao", { oneOf: [{ type: "string" }, { type: "integer" }] }, [[null, false, { tuKhoa: "oneOf", tb: "Không khớp lựa chọn nào trong oneOf (2)", con: true }], ["a", true], [1, true], [1.5, false, "oneOf"]]],
    ["oneOf phan biet bang const (union)", { oneOf: [{ properties: { t: { const: "a" }, x: { type: "integer" } }, required: ["t"] }, { properties: { t: { const: "b" }, y: { type: "string" } }, required: ["t"] }] },
      [[{ t: "a", x: 1 }, true], [{ t: "b", y: "s" }, true], [{ t: "a", x: "s" }, false, "oneOf"], [{ t: "c" }, false, "oneOf"], [{}, false, "oneOf"]]],
    ["oneOf ba nhanh khop hai", { oneOf: [{ type: "number" }, { type: "integer" }, { type: "string" }] }, [[1, false, { tuKhoa: "oneOf", tb: "(#0, #1)" }], [1.5, true], ["s", true]]],
    ["oneOf co true / false", { oneOf: [true, false] }, [[1, true], [null, true]]],
    ["oneOf co hai true", { oneOf: [true, true] }, [[1, false, "oneOf"]]]
  ]);

  /* ===================== not ===================== */
  tong += C.chaySchema(JE, [
    ["not type", { not: { type: "string" } }, [[1, true], [null, true], ["a", false, { tuKhoa: "not", tb: "Không được khớp schema trong “not”" }]]],
    ["not enum", { not: { enum: [1, 2] } }, [[3, true], [1, false, "not"], [2, false, "not"], ["1", true]]],
    ["not + properties", { properties: { a: { not: { const: 0 } } } }, [[{ a: 1 }, true], [{ a: 0 }, false, { tuKhoa: "not", conTro: "/a" }], [{}, true]]],
    ["not {} (khong gi hop le)", { not: {} }, [[1, false, "not"], [null, false]]],
    ["not false (moi thu hop le)", { not: false }, [[1, true], [{}, true]]],
    ["not oneOf (am: nhanh im lang)", { not: { oneOf: [{ type: "string" }, { minLength: 1 }] } }, [[1, false, "not"], ["a", true], ["", false, "not"]]]
  ]);

  /* ===================== if / then / else ===================== */
  const IF = { if: { properties: { a: { const: 1 } }, required: ["a"] }, then: { required: ["b"] }, else: { required: ["c"] } };
  tong += C.chaySchema(JE, [
    ["if/then/else", IF, [
      [{ a: 1, b: 2 }, true], [{ a: 1 }, false, { tuKhoa: "required", tb: "Vì khớp điều kiện “if”: Thiếu khoá bắt buộc “b”", conTroSchema: "#/then/required" }],
      [{ a: 2, c: 3 }, true], [{ a: 2 }, false, { tuKhoa: "required", tb: "Vì không khớp điều kiện “if”: Thiếu khoá bắt buộc “c”", conTroSchema: "#/else/required" }], [{}, false, { tb: "Vì không khớp" }]]],
    ["if + then (khong else)", { if: { type: "string" }, then: { minLength: 3 } }, [["abc", true], ["ab", false, "minLength"], [5, true], [null, true]]],
    ["if + else (khong then)", { if: { type: "string" }, else: { type: "integer" } }, [["x", true], [5, true], [null, false, "type"], [1.5, false, "type"]]],
    ["if khong co then / else = khong lam gi", { if: { type: "string" } }, [["x", true], [5, true]]],
    ["then khong co if bi bo qua", { then: { type: "string" } }, [[5, true]]],
    ["if long: then chua $ref", { $defs: { dai: { minLength: 5 } }, if: { type: "string" }, then: { $ref: "#/$defs/dai" } }, [["abcde", true], ["ab", false, { tuKhoa: "minLength", conTroSchema: "#/$defs/dai/minLength" }], [1, true]]],
    ["if true / false", { if: true, then: { type: "integer" }, else: { type: "string" } }, [[1, true], ["s", false, "type"]]],
    ["if/then trong properties giu conTro", { properties: { p: { if: { const: 1 }, then: { minimum: 5 } } } }, [[{ p: 1 }, false, { tuKhoa: "minimum", conTro: "/p" }], [{ p: 2 }, true]]]
  ]);

  /* ===================== dependencies / dependent* ===================== */
  tong += C.chaySchema(JE, [
    ["dependencies (draft-07) mang + schema", { $schema: "http://json-schema.org/draft-07/schema#", dependencies: { a: ["b"], c: { required: ["d"] } } },
      [[{ a: 1, b: 2 }, true], [{ a: 1 }, false, { tuKhoa: "dependencies", tb: "Có “a” thì phải có “b”" }], [{ c: 1, d: 2 }, true], [{ c: 1 }, false, "required"], [{ x: 1 }, true]]],
    ["dependencies van duoc hieu o 2020-12", { dependencies: { a: ["b"] } }, [[{ a: 1 }, false, "dependencies"], [{ a: 1, b: 1 }, true]]],
    ["dependentRequired (2019-09)", { $schema: "https://json-schema.org/draft/2019-09/schema", dependentRequired: { credit: ["billing"] } }, [[{ credit: 1, billing: 1 }, true], [{ credit: 1 }, false, { tuKhoa: "dependentRequired", tb: "Có “credit” thì phải có “billing”" }], [{}, true]]],
    ["dependentRequired o draft-07 bi bo qua", { $schema: "http://json-schema.org/draft-07/schema#", dependentRequired: { a: ["b"] } }, [[{ a: 1 }, true]]],
    ["dependentSchemas khoa dac biet", { dependentSchemas: { "a b": { properties: { n: { type: "integer" } } } } }, [[{ "a b": 1, n: 2 }, true], [{ "a b": 1, n: "x" }, false, "type", "/n"], [{ n: "x" }, true]]]
  ]);

  /* ===================== format: 3 muc ===================== */
  tong += C.chaySchema(JE, [
    ["format email: canh-bao (mac dinh) -> hopLe nhung co canh bao", { type: "string", format: "email" }, [["a@b.co", true, { canh: true, n: 0 }], ["abc", true, { canh: true, n: 1, tuKhoa: "format", tb: "Không phải email hợp lệ: “abc”" }]]],
    ["format email muc loi", { type: "string", format: "email" }, [["a@b.co", true], ["abc", false, { tuKhoa: "format", conTro: "", tb: "Không phải email hợp lệ" }]], { format: "loi" }],
    ["format email bo-qua", { type: "string", format: "email" }, [["abc", true, { canh: true, n: 0 }]], { format: "bo-qua" }],
    ["format date muc loi (29/02, thang 13)", { format: "date" }, [["2024-02-29", true], ["2023-02-29", false, "format"], ["2024-13-01", false, "format"], ["2024-05-01", true]], { format: "loi" }],
    ["format ipv4 / ipv6 / uuid / uri muc loi", { properties: { a: { format: "ipv4" }, b: { format: "ipv6" }, c: { format: "uuid" }, d: { format: "uri" } } },
      [[{ a: "1.2.3.4", b: "::1", c: "2eb8aa08-aa98-11ea-b4aa-73b441d16380", d: "https://x.vn/a" }, true], [{ a: "256.1.1.1" }, false, { tuKhoa: "format", conTro: "/a" }],
        [{ b: "1:2" }, false, "format", "/b"], [{ c: "xyz" }, false, "format", "/c"], [{ d: "/abc" }, false, "format", "/d"]], { format: "loi" }],
    ["format date-time muc loi", { format: "date-time" }, [["2024-05-01T10:30:00Z", true], ["1998-12-31T23:59:60Z", true], ["2024-05-01", false, "format"], ["2024-05-01T10:30:00", false, "format"]], { format: "loi" }],
    ["format voi gia tri khong phai chuoi: bo qua", { format: "email" }, [[5, true, { canh: true, n: 0 }], [null, true], [{}, true], [[], true]], { format: "loi" }],
    ["format la: bo qua", { format: "khong-co-format-nay" }, [["x", true, { canh: true, n: 0 }]], { format: "loi" }],
    ["format trong anyOf nhanh dung: canh bao van duoc giu", { anyOf: [{ type: "string", format: "email" }, { type: "null" }] }, [["abc", true, { canh: true, n: 1, tuKhoa: "format" }], [null, true, { canh: true, n: 0 }]]],
    ["format trong oneOf nhanh dung: canh bao van duoc giu", { oneOf: [{ type: "string", format: "date" }, { type: "integer" }] }, [["xxx", true, { canh: true, n: 1 }], [5, true, { canh: true, n: 0 }]]],
    ["format trong items: canh bao dung conTro tung phan tu", { items: { format: "email" } }, [[["a@b.co", "x", "y"], true, { canh: true, n: 2 }]]],
    ["format muc loi trong anyOf: nhanh sai thi chon nhanh khac", { anyOf: [{ format: "email" }, { format: "uuid" }] }, [["a@b.co", true], ["2eb8aa08-aa98-11ea-b4aa-73b441d16380", true], ["xyz", false, "anyOf"]], { format: "loi" }]
  ]);

  /* ===================== tuong thich draft ===================== */
  tong += C.chaySchema(JE, [
    ["khong $schema + items mang = tuple kieu draft-07", { items: [{ type: "integer" }, { type: "string" }], additionalItems: false }, [[[1, "a"], true], [[1, "a", 3], false, "additionalItems"], [["x"], false, "type", "/0"]]],
    ["ep draft 2020-12 voi items mang: van hieu nhu tuple", { items: [{ type: "integer" }] }, [[[1], true], [["x"], false, "type"]], { draft: "2020-12" }],
    ["$schema 2019-09 + items mang", { $schema: "https://json-schema.org/draft/2019-09/schema", items: [{ type: "string" }], additionalItems: { type: "integer" } }, [[["a", 1], true], [["a", "b"], false, "type", "/1"]]],
    ["prefixItems bi bo qua o draft-07", { $schema: "http://json-schema.org/draft-07/schema#", prefixItems: [{ type: "string" }] }, [[[1], true]]],
    ["draft-04 id thay $id", { $schema: "http://json-schema.org/draft-04/schema#", id: "http://ex.com/s", definitions: { n: { type: "integer" } }, properties: { a: { $ref: "#/definitions/n" } } }, [[{ a: 1 }, true], [{ a: "x" }, false, "type"]]],
    ["draft-06 const / propertyNames / contains", { $schema: "http://json-schema.org/draft-06/schema#", properties: { a: { const: 1 } }, propertyNames: { maxLength: 3 }, contains: {} }, [[[], false, "contains"], [{ a: 1 }, true], [{ a: 2 }, false, "const"], [{ abcd: 1 }, false, "propertyNames"]]],
    ["$dynamicRef xap xi (cay)", { $dynamicAnchor: "node", type: "object", properties: { kids: { type: "array", items: { $dynamicRef: "#node" } } } }, [[{ kids: [{ kids: [] }] }, true], [{ kids: [1] }, false, { tuKhoa: "type", conTro: "/kids/0" }]]],
    ["$recursiveRef xap xi (2019-09)", { $schema: "https://json-schema.org/draft/2019-09/schema", $recursiveAnchor: true, type: "object", properties: { kids: { type: "array", items: { $recursiveRef: "#" } } } },
      [[{ kids: [{ kids: [] }] }, true], [{ kids: [1] }, false, { tuKhoa: "type", conTro: "/kids/0" }]]],
    ["unevaluatedProperties bi bo qua (hoan) — khong lam sai ket qua", { properties: { a: {} }, unevaluatedProperties: false }, [[{ a: 1, b: 2 }, true]]]
  ]);

  /* draft duoc nhan ra */
  {
    const d = (sc, tc) => S.bienDich(sc, tc).draft;
    kiem("draft · $schema draft-04/06/07 -> 07; 2019-09 -> 2019-09; 2020-12 hoac khong co -> 2020-12",
      d({ $schema: "http://json-schema.org/draft-04/schema#" }) === "07" && d({ $schema: "http://json-schema.org/draft-06/schema#" }) === "07" && d({ $schema: "http://json-schema.org/draft-07/schema#" }) === "07" &&
      d({ $schema: "https://json-schema.org/draft/2019-09/schema" }) === "2019-09" && d({ $schema: "https://json-schema.org/draft/2020-12/schema" }) === "2020-12" && d({}) === "2020-12" && d(true) === "2020-12");
    kiem("draft · ep qua tuyChon.draft thang $schema; khong $schema + items mang -> 07 + canh bao",
      d({ $schema: "http://json-schema.org/draft-07/schema#" }, { draft: "2020-12" }) === "2020-12" && d({}, { draft: "07" }) === "07" && d({}, { draft: "2019-09" }) === "2019-09" &&
      d({ items: [{}] }) === "07" && S.bienDich({ items: [{}] }).canhBao.some((e) => /draft-07/.test(e.thongBao)));
    kiem("lint · tu khoa cua draft moi o draft-07 -> canh bao bi bo qua", S.bienDich({ $schema: "http://json-schema.org/draft-07/schema#", prefixItems: [{}], dependentRequired: { a: ["b"] }, minContains: 1 }).canhBao.length === 3);
    tong += 3;
  }

  /* ===================== giaiUri (RFC 3986 §5.4) ===================== */
  {
    const base = "http://a/b/c/d;p?q";
    const bangUri = [["g:h", "g:h"], ["g", "http://a/b/c/g"], ["./g", "http://a/b/c/g"], ["g/", "http://a/b/c/g/"], ["/g", "http://a/g"], ["//g", "http://g"],
      ["?y", "http://a/b/c/d;p?y"], ["g?y", "http://a/b/c/g?y"], ["#s", "http://a/b/c/d;p?q#s"], ["g#s", "http://a/b/c/g#s"], ["", "http://a/b/c/d;p?q"], [".", "http://a/b/c/"],
      ["..", "http://a/b/"], ["../g", "http://a/b/g"], ["../..", "http://a/"], ["../../g", "http://a/g"], ["../../../g", "http://a/g"], ["g;x=1/./y", "http://a/b/c/g;x=1/y"]];
    const sai = bangUri.filter(([ref, mong]) => S.giaiUri(base, ref) !== mong).map(([ref, mong]) => ref + " -> " + S.giaiUri(base, ref) + " (mong " + mong + ")");
    kiem("giaiUri · " + bangUri.length + " vi du RFC 3986 §5.4 (tuong doi, dau cham, truy van, manh)", sai.length === 0, sai.join(" | "));
    kiem("giaiUri · base rong: tham chieu tuong doi giu nguyen; chi manh -> '#frag'; $id tuong doi theo base co thu muc",
      S.giaiUri("", "x.json") === "x.json" && S.giaiUri("", "#/a") === "#/a" && S.giaiUri("https://ex.com/s/root.json", "sub/x.json#/d") === "https://ex.com/s/sub/x.json#/d");
    tong += 2;
  }

  /* ===================== trongNhuSchema ===================== */
  {
    const t = S.trongNhuSchema;
    kiem("trongNhuSchema · co $schema cua json-schema.org -> dung", t({ $schema: "https://json-schema.org/draft/2020-12/schema", x: 1 }) && t({ $schema: "http://json-schema.org/draft-07/schema#" }));
    kiem("trongNhuSchema · goc co properties / $defs / definitions va chi toan tu khoa schema -> dung",
      t({ type: "object", properties: { a: { type: "string" } }, required: ["a"] }) && t({ $defs: { a: {} } }) && t({ definitions: { a: {} }, $ref: "#/definitions/a" }));
    kiem("trongNhuSchema · du lieu thuong (co khoa la, mang, so, null) -> sai",
      !t({ ten: "x", properties: { a: 1 } }) && !t([]) && !t(5) && !t(null) && !t({}) && !t({ name: "x", age: 3 }) && !t({ type: "object" }) && !t("x"));
    kiem("trongNhuSchema · properties khong phai object (du lieu) -> sai", !t({ properties: [1, 2], type: "x" }) && !t({ properties: "abc" }));
    tong += 4;
  }

  /* ===================== bang tu khoa ho tro ===================== */
  {
    const b = S.tuKhoaHoTro;
    kiem("tuKhoaHoTro · danh sach co tu, draft, muc, ghiChu; co muc 'khong' cho $ref ngoai va unevaluated*",
      Array.isArray(b) && b.length > 10 && b.every((x) => x.tu && x.draft && ["co", "mot-phan", "khong"].includes(x.muc) && typeof x.ghiChu === "string") &&
      b.some((x) => /unevaluated/.test(x.tu) && x.muc === "khong") && b.some((x) => /ngoài/.test(x.tu) && x.muc === "khong") && b.some((x) => /dynamicRef/.test(x.tu) && x.muc === "mot-phan"));
    tong++;
  }

  /* ===================== bao toan: nhieu loi + thu tu ===================== */
  {
    const r = S.kiem({ a: "x", b: 5, c: [1, "y"] }, { properties: { a: { type: "integer" }, b: { type: "string" }, c: { items: { type: "integer" } } }, required: ["d"] });
    kiem("nhieu loi · 4 loi: a, b, c/1, thieu d — moi loi co conTro rieng", r.loi.length === 4 && ["/a", "/b", "/c/1", ""].every((p) => r.loi.some((e) => e.conTro === p)), JSON.stringify(r.loi.map((e) => e.conTro)));
    const r2 = S.kiem([[1, "a"], [2, 3]], { items: { items: { type: "integer" } } });
    kiem("nhieu loi · mang long: chi so doi dung /0/1", r2.loi.length === 1 && r2.loi[0].conTro === "/0/1" && r2.loi[0].hien === "$[0][1]");
    const r3 = S.kiem(JSON.parse('{"__proto__":"x","a":1}'), { properties: { a: { type: "string" } }, additionalProperties: false });
    kiem("nhieu loi · khoa __proto__ la khoa that: additionalProperties:false bat duoc", r3.loi.some((e) => e.tuKhoa === "additionalProperties" && e.conTro === "/__proto__"));
    tong += 3;
  }

  kiem("schema-2 · tong so phep (ca + kiem tra rieng) >= 150: " + tong, tong >= 150);
};
