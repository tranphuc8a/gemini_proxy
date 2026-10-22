/* do-hieu-nang.js — do cac ham THUAN cua json-editor voi JSON 1 MB va 10 MB.
   Nap json-editor.js bang cung bo DOM gia nhu kiem.js (khong chep logic).
     node do-hieu-nang.js            */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const APP = "C:/Users/tranphuc8a/Desktop/gemini_proxy/backend/fastapi/webapp/tranphuc8a/json-editor/assets/json-editor.js";
const OUT = __dirname;

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

/* --- sinh du lieu that-ish theo seed --- */
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function sinh(targetBytes, seed) {
  const r = rng(seed), ds = [];
  const ten = ["Phúc", "An", "Bình", "Chi", "Dũng", "Giang", "Hà", "Khánh", "Linh", "Minh"];
  let i = 0, size = 2;
  while (size < targetBytes) {
    const o = {
      id: i, uuid: "a" + Math.floor(r() * 1e12).toString(16) + "-4b2c-8d1e-" + i,
      name: ten[Math.floor(r() * ten.length)] + " " + i,
      email: "user" + i + "@example.com", active: r() > 0.5, score: Math.round(r() * 10000) / 100,
      created: "2026-10-" + String(1 + Math.floor(r() * 28)).padStart(2, "0") + "T08:00:00Z",
      tags: ["a", "b", "c"].slice(0, 1 + Math.floor(r() * 3)),
      address: { city: "Hà Nội", street: "Số " + Math.floor(r() * 500), geo: { lat: r() * 90, lng: r() * 180 } },
      orders: Array.from({ length: Math.floor(r() * 4) }, (_, k) => ({ sku: "SKU-" + k, qty: 1 + k, price: Math.round(r() * 1e6) }))
    };
    ds.push(o);
    size += JSON.stringify(o, null, 2).length + 4;
    i++;
  }
  return { meta: { version: 1, count: ds.length }, items: ds };
}

function do_(ten, f, lap) {
  lap = lap || 1;
  f(); // khoi dong JIT
  const t0 = process.hrtime.bigint();
  let r;
  for (let i = 0; i < lap; i++) r = f();
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / lap;
  console.log("  " + ten.padEnd(52) + ms.toFixed(1).padStart(9) + " ms");
  return r;
}

const ketQua = {};
for (const [nhan, byte] of [["1MB", 1 << 20], ["10MB", 10 << 20]]) {
  const v = sinh(byte, 42);
  const s2 = JSON.stringify(v, null, 2);
  fs.writeFileSync(path.join(OUT, "mau-" + nhan + ".json"), s2);
  const dong = s2.split("\n").length;
  console.log("\n=== " + nhan + ": " + (s2.length / 1048576).toFixed(2) + " MB ky tu, " + dong + " dong, " + v.items.length + " phan tu ===");
  do_("JSON.parse", () => JSON.parse(s2), 3);
  const p = JSON.parse(s2);
  do_("JSON.stringify(v,null,2)  [Dinh dang]", () => JSON.stringify(p, null, 2), 3);
  do_("JSON.stringify(v)         [Nen]", () => JSON.stringify(p), 3);
  do_("doThut (doan kieu thut)", () => T.doThut(s2), 3);
  do_("dem (so nut/do sau)", () => T.dem(p), 3);
  do_("sapKhoa", () => T.sapKhoa(p), 1);
  do_("xemTruoc(goc)", () => T.xemTruoc(p), 3);
  do_("truyVan $..name", () => T.truyVan(p, "$..name").length, 1);
  do_("truyVan $.items[*].address.city", () => T.truyVan(p, "$.items[*].address.city").length, 1);
  const p2 = JSON.parse(s2); p2.items[5].name = "khac";
  do_("khacNhau (ban sao doi 1 cho)", () => T.khacNhau(p, p2).length, 1);
  do_("haiChamSau(s.split)", () => T.haiChamSau(s2.split("\n")), 1);
  if (byte <= (1 << 20) * 2) do_("toMau (to mau toan van ban)", () => T.toMau(s2).length, 1);
  do_("dongCot(cuoi van ban)", () => T.dongCot(s2, s2.length - 1), 1);
  do_("dem dau xuong dong (indexOf loop, moi phim)", () => { let n = 1; for (let k = s2.indexOf("\n"); k >= 0; k = s2.indexOf("\n", k + 1)) n++; return n; }, 5);
  /* sua mot gia tri tren cay -> datTai + vietTheoKieu (ghi lai CA tai lieu) */
  do_("datTai + vietTheoKieu (1 lan sua tren cay)", () => T.vietTheoKieu(T.datTai(p, ["items", 3, "name"], "X"), s2).length, 1);
  ketQua[nhan] = { mb: s2.length / 1048576, dong };
}
console.log("\nDa ghi mau-1MB.json, mau-10MB.json o " + OUT);
