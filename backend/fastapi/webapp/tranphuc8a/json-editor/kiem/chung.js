/* =====================================================================
   kiem/chung.js — do nghe chung cho moi tep kiem cua json-editor.

   - taoMoiTruong(): nap MOI tep script theo DUNG thu tu index.html vao mot
     vm voi bo DOM gia toi thieu (du de doan khoi dong chay qua), tra ve
     { ctx, T: JE_THU, JE, APP: JE_APP, dom(selector), chayHen() }.
     Khong chep lai logic — goi thang ham cua san pham.
   - kiem(ten, dat, chiTiet) / nhom(ten) / bang(a, b): dem dat/sai chung cho
     ca lan chay; kiem.js in tong ket va tra exit code.

   window === globalThis trong vm (nhu trinh duyet), nen je-chung.js dang
   ky JE len globalThis va json-editor.js doc duoc qua window.JE.
   window KHONG co requestAnimationFrame / matchMedia / ResizeObserver —
   co y, de kiem luon duong du phong khi trinh duyet thieu chung.
   setTimeout la GIA: chi xep hang, chayHen() moi chay — kiem tat dinh va
   khong de tien trinh node treo cho hen 8 giay cua thong bao cay.
   ===================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const GOC = path.join(__dirname, "..");

/** Cac tep script cua index.html, dung thu tu nap. */
function dsScript() {
  const html = fs.readFileSync(path.join(GOC, "index.html"), "utf8");
  const ra = [];
  const re = /<script\s+src="([^"]+)"\s*><\/script>/g;
  let m;
  while ((m = re.exec(html))) ra.push(m[1].replace(/^\.\//, ""));
  return ra;
}

/** Goi cac ham nghe `loai` da dang ky tren `noi` voi mot su kien gia; tra
    ve su kien (xem defaultPrevented). Khong noi bot len cha. */
function phatGia(noi, loai, them) {
  const e = Object.assign({
    type: loai, target: noi, defaultPrevented: false, cancelable: true,
    key: "", ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, isComposing: false, keyCode: 0,
    preventDefault() { e.defaultPrevented = true; }, stopPropagation() {}
  }, them || {});
  (noi._nghe[loai] || []).slice().forEach((f) => f.call(noi, e));
  return e;
}

function nutGia() {
  const thuocTinh = {};
  const n = {
    _nghe: {},
    _text: "", className: "", checked: true, value: "", style: {},
    children: [], dataset: {}, hidden: false, disabled: false, tabIndex: -1,
    scrollTop: 0, scrollLeft: 0, clientWidth: 0, clientHeight: 0,
    selectionStart: 0, selectionEnd: 0, title: "",
    appendChild(c) { n.children.push(c); return c; },
    insertBefore(c) { n.children.push(c); return c; },
    removeChild(c) { return c; },
    replaceChild(c) { return c; },
    insertAdjacentHTML() {},
    lastElementChild: null,
    querySelector: () => nutGia(),
    querySelectorAll: () => [],
    closest: () => null,
    contains: () => false,
    setAttribute(k, v) { thuocTinh[k] = String(v); },
    getAttribute: (k) => (k in thuocTinh ? thuocTinh[k] : null),
    removeAttribute(k) { delete thuocTinh[k]; },
    hasAttribute: (k) => k in thuocTinh,
    getBoundingClientRect: () => ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 }),
    focus() {}, blur() {}, click() {},
    setSelectionRange(a, b) { n.selectionStart = a; n.selectionEnd = b; },
    addEventListener(t, f) { (n._nghe[t] || (n._nghe[t] = [])).push(f); },
    removeEventListener() {}, onclick: null, onchange: null,
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    select() {}
  };
  Object.defineProperty(n, "innerHTML", { get: () => n._text, set(v) { n._text = v; } });
  Object.defineProperty(n, "textContent", { get: () => n._text, set(v) { n._text = v; } });
  return n;
}

function taoMoiTruong() {
  const bangChon = new Map();            /* selector -> nut (cung selector, cung nut) */
  const hang = [];                       /* hen gio gia */
  let soHen = 0;
  const dom = (s) => {
    if (!bangChon.has(s)) bangChon.set(s, nutGia());
    return bangChon.get(s);
  };
  const ctx = {
    document: {
      querySelector: dom,
      querySelectorAll: () => [],
      createElement: () => nutGia(),
      createDocumentFragment: () => nutGia(),
      createRange: () => ({ setStartBefore() {}, setEndAfter() {}, deleteContents() {} }),
      documentElement: { getAttribute: () => null, setAttribute() {} },
      activeElement: null,
      hasFocus: () => false,
      execCommand: () => false,
      addEventListener() {}
    },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    navigator: {},
    setTimeout(f) { hang.push({ id: ++soHen, f }); return soHen; },
    clearTimeout(id) { const i = hang.findIndex((h) => h.id === id); if (i >= 0) hang.splice(i, 1); },
    Blob: function () {}, URL: { createObjectURL: () => "", revokeObjectURL() {} },
    FileReader: function () {},
    console, JSON, Math, Object, Array, String, Number, Boolean, RegExp, Error, Date
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of dsScript()) {
    vm.runInContext(fs.readFileSync(path.join(GOC, f), "utf8"), ctx, { filename: f });
  }
  return {
    ctx, dom,
    T: ctx.JE_THU, JE: ctx.JE, APP: ctx.JE_APP,
    /** Phat su kien gia tren nut cua `selector` (vd "#nhap", "keydown", {key:"z", ctrlKey:true}). */
    phat: (selector, loai, them) => phatGia(dom(selector), loai, them),
    /** Chay cac hen gio dang cho (va hen sinh ra trong luc chay), toi da `n` vong. */
    chayHen(n) {
      for (let i = 0; i < (n || 50) && hang.length; i++) {
        const ds = hang.splice(0, hang.length);
        ds.forEach((h) => h.f());
      }
    },
    soHenCho: () => hang.length
  };
}

/* ---------------------------------------------------------------- dem */
let dat = 0, hong = 0;
function kiem(ten, ok, chiTiet) {
  console.log("  " + (ok ? "[ok]  " : "[SAI] ") + ten + (chiTiet ? "   " + chiTiet : ""));
  if (ok) dat++; else hong++;
  return !!ok;
}
function nhom(ten) { console.log("\n  — " + ten + " —"); }
const bang = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const nemLoi = (f) => { try { f(); return false; } catch (e) { return true; } };

/** Gia tri long `n` cap: [[[ … 1 … ]]] hoac {"a":{"a":…}}. */
function longSau(n, kieu) {
  let v = 1;
  for (let i = 0; i < n; i++) v = kieu === "object" ? { a: v } : [v];
  return v;
}

/** Bo sinh so gia ngau nhien co hat (LCG) — lan nao chay cung ra cung bo. */
function taoNgauNhien(hat) {
  let h = hat >>> 0 || 1;
  return () => (h = (h * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
}

module.exports = {
  GOC, dsScript, taoMoiTruong, kiem, nhom, bang, nemLoi, longSau, taoNgauNhien,
  soDat: () => dat, soSai: () => hong
};
