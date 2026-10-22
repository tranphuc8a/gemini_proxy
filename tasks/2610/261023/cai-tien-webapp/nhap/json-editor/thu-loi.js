/* do-hieu-nang.js — do cac ham THUAN cua json-editor voi JSON 1 MB va 10 MB.
   Nap json-editor.js bang cung bo DOM gia nhu kiem.js (khong chep logic).
     node do-hieu-nang.js            */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const APP = "C:/Users/tranphuc8a/Desktop/gemini_proxy/backend/fastapi/webapp/tranphuc8a/json-editor/assets/json-editor.js";

function nutGia() {
  const tt = {};
  const n = {
    _text: "", className: "", checked: true, value: "", style: {}, children: [], dataset: {},
    hidden: false, disabled: false, tabIndex: -1, scrollTop: 0, scrollLeft: 0, clientWidth: 0, clientHeight: 0,
    appendChild(c) { return c; }, insertBefore(c) { return c; }, removeChild(c) { return c; }, replaceChild(c) { return c; },
    insertAdjacentHTML() {}, lastElementChild: null, querySelector: () => nutGia(), querySelectorAll: () => [],
    closest: () => null, contains: () => false, setAttribute(k, v) { tt[k] = String(v); },
    getAttribute: (k) => (k in tt ? tt[k] : null), removeAttribute(k) { delete tt[k]; }, hasAttribute: (k) => k in tt,
    getBoundingClientRect: () => ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 }),
    focus() {}, blur() {}, click() {}, addEventListener() {}, removeEventListener() {}, onclick: null, onchange: null,
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, select() {}
  };
  Object.defineProperty(n, "innerHTML", { get: () => n._text, set(v) { n._text = v; } });
  Object.defineProperty(n, "textContent", { get: () => n._text, set(v) { n._text = v; } });
  return n;
}
const ctx = {
  window: {},
  document: {
    querySelector: () => nutGia(), querySelectorAll: () => [], createElement: () => nutGia(),
    createDocumentFragment: () => nutGia(),
    createRange: () => ({ setStartBefore() {}, setEndAfter() {}, deleteContents() {} }),
    documentElement: { getAttribute: () => null, setAttribute() {} }, activeElement: null,
    hasFocus: () => false, execCommand: () => false, addEventListener() {}
  },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  navigator: {}, setTimeout, clearTimeout, Blob: function () {},
  URL: { createObjectURL: () => "", revokeObjectURL() {} }, FileReader: function () {},
  console, JSON, Math, Object, Array, String, Number, Boolean, RegExp, Error, Date
};
ctx.globalThis = ctx; ctx.window.document = ctx.document; ctx.window.localStorage = ctx.localStorage;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(APP, "utf8"), ctx);
const T = ctx.window.JE_THU;
function thu(ten, f) { try { const r = f(); console.log(ten, "=>", JSON.stringify(r)); } catch (e) { console.log(ten, "=> NEM:", e.message); } }
const goc = { a: 1, "a.b": 2, "a]b": 3, mang: [10, 20, 30], o: { ten: "x" } };
thu("$.toString", () => T.truyVan(goc, "$.toString").map(n => [n.d, typeof n.v]));
thu("$.mang.length", () => T.truyVan(goc, "$.mang.length"));
thu("$['a.b']", () => T.truyVan(goc, "$['a.b']"));
thu("$['a]b']", () => T.truyVan(goc, "$['a]b']"));
thu("$.mang[-1]", () => T.truyVan(goc, "$.mang[-1]"));
thu("$.mang[0:2]", () => T.truyVan(goc, "$.mang[0:2]"));
thu("$..*", () => T.truyVan(goc, "$..*"));
thu("$.mang[?(@>15)]", () => T.truyVan(goc, "$.mang[?(@>15)]"));
thu("$.o.constructor", () => T.truyVan(goc, "$.o.constructor").map(n => [n.d, typeof n.v]));
thu("ket qua d cho khoa 'a.b' qua [*]", () => T.truyVan(goc, "$[*]").map(n => n.d));
thu("khacNhau khoa __proto__/constructor", () => T.khacNhau({ constructor: 1 }, {}));
thu("khacNhau {} vs {toString:1}", () => T.khacNhau({}, { toString: 1 }));
thu("sapKhoa __proto__", () => JSON.stringify(T.sapKhoa(JSON.parse('{"b":1,"__proto__":{"x":1}}'))));
thu("xemTruoc obj", () => T.xemTruoc({ id: 7, name: "Phúc", tags: [1, 2], meta: {} }));
thu("xemTruoc mang obj", () => T.xemTruoc([{ id: 1, name: "A" }, { id: 2 }]));
thu("xemTruoc obj khong nguyen thuy", () => T.xemTruoc({ a: {}, b: [], c: {} }));
thu("dem 1e5 sau (de quy)", () => { let v = 1; for (let i = 0; i < 20000; i++) v = [v]; return T.dem(v).sau; });
thu("JSON.parse sau 20000", () => { let s = "[".repeat(20000) + "]".repeat(20000); return typeof JSON.parse(s); });
