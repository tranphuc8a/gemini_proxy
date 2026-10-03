/* ==========================================================================
   HIỂN THỊ BÀI — markdown → DOM, MỘT bản cho cả hai nơi:
     · trang đọc khoá học (engine/app.js gọi HienThi.render)
     · khung xem trước của trang Quản lý khoá học
   nên người soạn thấy đúng thứ người học sẽ thấy: công thức KaTeX, khối mã tô
   màu, sơ đồ mermaid, hộp chú ý, bảng cuộn ngang, liên kết giữa các bài, ảnh
   tải lên khoá (assets/…).

   ★ NGUỒN THẬT: courses/engine/hien-thi.js. Bản trong <trang>/assets/ do
     `python engine/sync.py` chép ra — sửa ở đó sẽ mất.

   Cần (nếu có thì dùng, thiếu thì bỏ qua phần đó): window.marked (bắt buộc),
   window.katex, window.hljs. mermaid được nạp từ CDN khi bài có sơ đồ.

     HienThi.render(md, {
       docId,            id bài đang dựng — gốc cho liên kết tương đối
       docs,             id → {slug, title}: để biến "../bai-02.md" thành "#/slug"
       icon(name),       chuỗi SVG cho nút chép / mũi tên liên kết ngoài (tuỳ chọn)
       toast(msg),       báo "không chép được" (tuỳ chọn)
       assetUrl(name),   địa chỉ thật của tệp "assets/<name>" (tuỳ chọn)
       taiAnh(url)       → Promise<url dùng được>: tải ảnh có kèm token (bản nháp)
       labUrl,           trang lab trực quan (mặc định "../lab-visual/")
       labCho            true: khối lab chỉ hiện nút "Chạy" (khung xem trước khi soạn,
                         vẽ lại theo từng phím — không nạp lại lab mỗi lần gõ)
     }) → <div class="prose">
     HienThi.veMermaid(root)   vẽ sơ đồ SAU KHI root đã nằm trong DOM
   ========================================================================== */
(function (root) {
"use strict";

var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var esc = function (s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
};

/* Bỏ dấu tiếng Việt bằng bảng tra 1 ký tự → 1 ký tự: giữ nguyên độ dài chuỗi,
   nên vị trí tìm được trên bản không dấu dùng thẳng cho bản gốc. */
var VMAP = (function () {
  var m = {};
  [["a", "àáạảãâầấậẩẫăằắặẳẵ"], ["e", "èéẹẻẽêềếệểễ"], ["i", "ìíịỉĩ"],
   ["o", "òóọỏõôồốộổỗơờớợởỡ"], ["u", "ùúụủũưừứựửữ"], ["y", "ỳýỵỷỹ"], ["d", "đ"]
  ].forEach(function (g) {
    for (var i = 0; i < g[1].length; i++) m[g[1][i]] = g[0];
  });
  return m;
})();
function norm(s) {
  var out = "", i, c, l;
  s = String(s == null ? "" : s);
  for (i = 0; i < s.length; i++) {
    c = s[i];
    l = c.toLowerCase();
    if (l.length !== 1) l = c;                 /* không để phép hạ chữ đổi độ dài */
    out += VMAP[l] || l;
  }
  return out;
}

function slugifyHeading(t) {
  return norm(t).replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "muc";
}

/* HTML do markdown sinh ra, đã gỡ phần chạy được. Nội dung sửa được qua API,
   không còn là tệp tin cậy trong repo — một khoá quản trị bị lộ không được
   thành XSS trên mọi trang khoá học (cùng origin với token phiên của trang
   quản lý). Markdown vẫn được dùng HTML vô hại (<details>, <b>, <br>…); chỉ phần
   tử chạy mã, thuộc tính on* và URL javascript:/vbscript:/data: (trừ ảnh) bị gỡ.
   Phân tích trong <template> chứ KHÔNG gán innerHTML cho một div: nội dung
   template "trơ" — <img src=x onerror=…> không tải, nên onerror không kịp chạy. */
var THE_CAM = /^(script|iframe|frame|frameset|object|embed|applet|style|link|meta|base|form)$/i;
function lamSach(goc) {
  $$("*", goc).forEach(function (el) {
    if (THE_CAM.test(el.tagName)) { el.parentNode && el.parentNode.removeChild(el); return; }
    Array.prototype.slice.call(el.attributes).forEach(function (a) {
      var n = a.name.toLowerCase();
      var v = (a.value || "").replace(/[\u0000- ]+/g, "").toLowerCase();
      if (n.indexOf("on") === 0 || n === "srcdoc") { el.removeAttribute(a.name); return; }
      if (/^(href|src|xlink:href|action|formaction|poster|background)$/.test(n) &&
          (/^(javascript|vbscript):/.test(v) || (/^data:/.test(v) && !(n === "src" && /^data:image\/(png|gif|jpe?g|webp);/.test(v))))) {
        el.removeAttribute(a.name);
      }
    });
  });
}
function htmlSach(html) {
  var tpl = document.createElement("template");
  tpl.innerHTML = html;
  lamSach(tpl.content);
  return tpl.content;
}

/* Liên kết tương đối trong markdown → bài trong khoá (route) hay tệp nguồn. */
function resolveHref(href, fromId, docs) {
  if (/^(https?:|mailto:|#)/.test(href)) return null;
  var hash = "", h = href.split("#");
  href = h[0]; if (h[1]) hash = h[1];
  if (!href) return null;
  var base = String(fromId || "").split("/"); base.pop();
  href.split("/").forEach(function (s) {
    if (!s || s === ".") return;
    if (s === "..") base.pop(); else base.push(s);
  });
  var p = base.join("/");
  docs = docs || {};
  var id = docs[p] ? p : docs[p + "/README.md"] ? p + "/README.md" :
           docs[p.replace(/\/$/, "") + "/README.md"] ? p.replace(/\/$/, "") + "/README.md" : null;
  if (id) return { route: "#/" + docs[id].slug + (hash ? "#" + hash : ""), doc: docs[id], id: id };
  return { file: "../" + p };          // tệp mã nguồn — mở thẳng từ kho
}

/* "assets/hinh.png" hoặc "./assets/hinh.png" → "hinh.png" */
function tenTep(href) {
  var m = /^(?:\.\/)?assets\/([^?#]+)$/.exec(href || "");
  return m ? decodeURIComponent(m[1]) : null;
}

/* ---- lab trực quan nhúng trong bài -----------------------------------------
   ```lab
   raft?nut=5&mat=1          ← id lab + tham số (đúng dạng "Chép liên kết" của trang lab;
                               dán cả địa chỉ đầy đủ cũng được)
   Chú thích (tuỳ chọn, các dòng sau)
   ```
   → khung mô phỏng chạy ngay trong bài. Trang lab cùng origin, nên khung tự cao
   theo nội dung. Bộ lọc HTML gỡ mọi <iframe> của markdown; khung này do CHÍNH bộ
   dựng tạo, với địa chỉ ghép từ id + tham số đã lọc — markdown không chọn được src. */
var LAB_ID = /^[a-z0-9][a-z0-9-]{0,40}$/;
var LAB_THAM_SO = /^[A-Za-z0-9_-]{1,32}=[A-Za-z0-9_.%+-]{0,64}$/;
function phanTichLab(text) {
  var dong = String(text || "").trim().split(/\r?\n/);
  var dau = (dong.shift() || "").trim();
  var m = /#\/(.*)$/.exec(dau);
  if (m) dau = m[1];
  var i = dau.indexOf("?");
  var id = i >= 0 ? dau.slice(0, i) : dau;
  if (!LAB_ID.test(id)) return null;
  var q = (i >= 0 ? dau.slice(i + 1) : "").split("&").filter(function (p) { return LAB_THAM_SO.test(p); }).join("&");
  return { id: id, q: q, chu: dong.join(" ").replace(/\s+/g, " ").trim() };
}
function tuCao(ifr) {
  var doc;
  try { doc = ifr.contentDocument; } catch (e) { return; }
  if (!doc || !doc.body) return;
  function dat() {
    var h = Math.ceil(doc.body.getBoundingClientRect().height);
    if (h > 60) ifr.style.height = Math.min(h + 4, 1600) + "px";
  }
  dat();
  if (root.ResizeObserver) new root.ResizeObserver(dat).observe(doc.body);
}
function taoLab(text, o) {
  var L = phanTichLab(text);
  if (!L) return null;
  var goc = o.labUrl || "../lab-visual/";
  var duoi = "#/" + L.id + (L.q ? "?" + L.q : "");
  var theme = document.documentElement.getAttribute("data-theme") || "";
  var fig = document.createElement("figure");
  fig.className = "lab-nhung";
  fig.setAttribute("data-lab", L.id);
  function chay() {
    var ifr = document.createElement("iframe");
    ifr.src = goc + "?nhung=1" + (theme === "dark" || theme === "light" ? "&theme=" + theme : "") + duoi;
    ifr.title = "Mô phỏng: " + (L.chu || L.id);
    ifr.setAttribute("loading", "lazy");
    ifr.setAttribute("allow", "fullscreen");
    ifr.addEventListener("load", function () { tuCao(ifr); });
    return ifr;
  }
  if (o.labCho) {
    var nut = document.createElement("button");
    nut.type = "button";
    nut.className = "lab-cho";
    nut.innerHTML = "▶ Chạy mô phỏng <code>" + esc(L.id) + "</code>";
    nut.addEventListener("click", function () { fig.replaceChild(chay(), nut); });
    fig.appendChild(nut);
  } else {
    fig.appendChild(chay());
  }
  var cap = document.createElement("figcaption");
  cap.innerHTML = (L.chu ? esc(L.chu) + " · " : "") + '<a href="' + esc(goc + duoi) + '" target="_blank" rel="noopener">' +
    "Mở trang mô phỏng ↗</a>";
  fig.appendChild(cap);
  return fig;
}

/* ---- mã chạy được trong bài ------------------------------------------------
   ```py-chay / ```js-chay        ô mã sửa được + nút Chạy, in kết quả bên dưới
   ```py-bai-tap / ```js-bai-tap  bài tập tự chấm: phần TRƯỚC dòng `---kiem---` là
                                  mã người học sửa, phần SAU là kiểm tra ẩn (Python:
                                  `assert`; JS: `kiem(dieuKien, "thông báo")`)
   Mã chạy trong Web Worker: không chạm được trang, cookie phiên hay token trong
   localStorage, và bị dừng hẳn khi quá giờ (vòng lặp vô hạn). Python là Pyodide
   (CPython biên dịch sang WebAssembly) tải từ CDN ở lần chạy đầu (~10 MB, trình
   duyệt giữ lại). Mã người học sửa và trạng thái "đã đạt" cất trên máy này. */
var PYODIDE = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";
var HAN_JS = 5000, HAN_PY = 15000, HAN_NAP_PY = 90000;
var MA_THO = {
  js: "self.onmessage = function (e) {\n" +
      "  var d = e.data, daChayMa = false;\n" +
      "  function gui(loai, chu) { self.postMessage({ loai: loai, chu: String(chu) }); }\n" +
      "  function noi(a) { return Array.prototype.map.call(a, function (x) {\n" +
      "    if (typeof x === 'string') return x; try { return JSON.stringify(x); } catch (er) { return String(x); } }).join(' '); }\n" +
      "  self.console = { log: function () { gui('in', noi(arguments)); }, info: function () { gui('in', noi(arguments)); },\n" +
      "    warn: function () { gui('in', noi(arguments)); }, error: function () { gui('loi-in', noi(arguments)); } };\n" +
      "  function kiem(dk, tb) { if (!dk) throw new Error(tb || 'một kiểm tra không qua'); }\n" +
      "  try {\n" +
      "    (new Function('kiem', '__xongMa', d.ma + '\\n;__xongMa();\\n' + (d.kiem || '')))(kiem, function () { daChayMa = true; });\n" +
      "    self.postMessage({ loai: 'xong', ok: true });\n" +
      "  } catch (er) {\n" +
      "    self.postMessage({ loai: 'xong', ok: false, loi: (er && er.name ? er.name + ': ' : '') + (er && er.message || er),\n" +
      "                       oKiem: daChayMa && !!d.kiem });\n" +
      "  }\n" +
      "};\n",
  py: "var san = null;\n" +
      "self.onmessage = function (e) {\n" +
      "  var d = e.data, buoc = 'nap';\n" +
      "  function gui(loai, chu) { self.postMessage({ loai: loai, chu: chu }); }\n" +
      "  if (!san) {\n" +
      "    gui('nap', '');\n" +
      "    try { importScripts(d.goc + 'pyodide.js'); san = loadPyodide({ indexURL: d.goc }); }\n" +
      "    catch (er) { self.postMessage({ loai: 'xong', ok: false, loi: String(er && er.message || er), oNap: true }); return; }\n" +
      "  }\n" +
      "  san.then(function (p) {\n" +
      "    p.setStdout({ batched: function (s) { gui('in', s); } });\n" +
      "    p.setStderr({ batched: function (s) { gui('loi-in', s); } });\n" +
      "    buoc = 'ma';\n" +
      "    return p.loadPackagesFromImports(d.ma + '\\n' + (d.kiem || '')).then(function () {\n" +
      "      var ns = p.globals.get('dict')();\n" +
      "      p.runPython(d.ma, { globals: ns });\n" +
      "      buoc = 'kiem';\n" +
      "      if (d.kiem) p.runPython(d.kiem, { globals: ns });\n" +
      "      ns.destroy();\n" +
      "      self.postMessage({ loai: 'xong', ok: true });\n" +
      "    });\n" +
      "  }).catch(function (er) {\n" +
      "    self.postMessage({ loai: 'xong', ok: false, loi: String(er && er.message || er), oKiem: buoc === 'kiem',\n" +
      "                       oNap: buoc === 'nap' });\n" +
      "  });\n" +
      "};\n"
};
var THO = {};
function layTho(ngon) {
  if (!THO[ngon]) {
    var url = URL.createObjectURL(new Blob([MA_THO[ngon]], { type: "text/javascript" }));
    THO[ngon] = { w: new Worker(url), daNap: ngon === "js", ban: false };
  }
  return THO[ngon];
}
/* Một lần chạy: xong(ok, loi, oKiem); dòng in ra đi qua inRa(chu, laLoi). */
function chayTrongTho(ngon, ma, kiem, inRa, nap, xong) {
  var t = layTho(ngon);
  if (t.ban) { xong(false, "Đang chạy một ô mã khác — đợi nó xong.", false); return; }
  t.ban = true;
  var han = ngon === "js" ? HAN_JS : t.daNap ? HAN_PY : HAN_NAP_PY;
  var hen = setTimeout(function () {
    t.w.terminate();
    delete THO[ngon];
    xong(false, "Dừng sau " + Math.round(han / 1000) + " giây — có thể là vòng lặp vô hạn.", false);
  }, han);
  t.w.onmessage = function (e) {
    var d = e.data || {};
    if (d.loai === "nap") nap();
    else if (d.loai === "in" || d.loai === "loi-in") inRa(d.chu, d.loai === "loi-in");
    else if (d.loai === "xong") {
      clearTimeout(hen);
      t.ban = false;
      if (d.ok || !d.oNap) t.daNap = true;
      if (d.oNap) { t.w.terminate(); delete THO[ngon]; }
      xong(!!d.ok, d.loi || "", !!d.oKiem, !!d.oNap);
    }
  };
  /* lỗi không ai bắt trong worker (cú pháp lạ, hết bộ nhớ…): báo ngay, không treo tới hết giờ */
  t.w.onerror = function (ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    clearTimeout(hen);
    t.w.terminate();
    delete THO[ngon];
    xong(false, (ev && ev.message) || "Trình chạy mã gặp lỗi", false, !t.daNap);
  };
  t.w.postMessage({ ma: ma, kiem: kiem, goc: PYODIDE });
}
/* Lỗi Python: dòng cuối của traceback; assert không lời nhắn thì chỉ ra dòng kiểm tra hỏng. */
function tomTatLoi(ngon, loi, kiem, oKiem) {
  var s = String(loi || "").replace(/\s+$/, "");
  if (ngon !== "py") return oKiem ? s.replace(/^Error:\s*/, "") : s;
  var dong = s.split("\n"), cuoi = dong[dong.length - 1];
  if (oKiem && /^AssertionError\s*$/.test(cuoi)) {
    var so = (s.match(/line (\d+)/g) || []).pop();
    var dk = so ? kiem.split("\n")[+so.replace(/\D/g, "") - 1] : "";
    return dk ? dk.trim() : "một kiểm tra không qua";
  }
  if (oKiem) return cuoi.replace(/^AssertionError:\s*/, "");
  var tu = dong.length;
  for (var i = dong.length - 1; i >= 0; i--) if (/File "<exec>"/.test(dong[i])) { tu = i; break; }
  return dong.slice(Math.min(tu, dong.length - 1)).join("\n");
}

var demChay = 0;
function taoChay(text, ngon, baiTap, o) {
  ngon = /^py/.test(ngon) ? "py" : "js";
  var phan = baiTap ? String(text).split(/^[ \t]*(?:#|\/\/)?[ \t]*---[ \t]*kiem[ \t]*---[ \t]*$/m) : [text];
  var goc = phan[0].replace(/\s+$/, ""), kiem = baiTap ? (phan[1] || "").replace(/^\s*\n|\s+$/g, "") : "";
  var khoa = "hien-thi.chay@" + location.pathname + location.search.replace(/[?&]t=\d+/, "") + "|" + (o.docId || "") + "|" + (demChay++);
  function doc(k, d) { try { var v = localStorage.getItem(khoa + k); return v == null ? d : v; } catch (e) { return d; } }
  function ghi(k, v) { try { if (v == null) localStorage.removeItem(khoa + k); else localStorage.setItem(khoa + k, v); } catch (e) {} }

  var hop = document.createElement("div");
  hop.className = "chay" + (baiTap ? " bai-tap" : "");
  var ten = ngon === "py" ? "Python" : "JavaScript";
  hop.innerHTML = '<div class="chay-dau"><span class="chay-nhan">' + (baiTap ? "✍️ Bài tập · " : "▶ ") + ten +
    (baiTap ? "" : " · chạy được") + '</span><span class="chay-dat"' + (doc(".dat", "") ? "" : " hidden") + ">✓ Đã đạt</span>" +
    '<button type="button" class="chay-nut" data-viec="chay">▶ Chạy</button>' +
    (baiTap && kiem ? '<button type="button" class="chay-nut chinh" data-viec="nop">✓ Nộp bài</button>' : "") +
    '<button type="button" class="chay-nut phu" data-viec="lai" title="Khôi phục mã ban đầu" aria-label="Khôi phục mã ban đầu">↺</button></div>' +
    '<textarea class="chay-ma" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="Mã ' + ten + '"></textarea>' +
    '<pre class="chay-ra" aria-live="polite" hidden></pre>';
  var ta = hop.querySelector(".chay-ma"), ra = hop.querySelector(".chay-ra"), dat = hop.querySelector(".chay-dat");
  ta.value = doc("", goc);
  function cao() { ta.style.height = "auto"; ta.style.height = Math.min(560, ta.scrollHeight + 2) + "px"; }
  ta.addEventListener("input", function () { cao(); ghi("", ta.value === goc ? null : ta.value); });
  ta.addEventListener("keydown", function (e) {
    if (e.key === "Tab" && !e.shiftKey) {                 /* Tab thụt lề, không nhảy ô */
      e.preventDefault();
      var a = ta.selectionStart;
      ta.setRangeText("    ", a, ta.selectionEnd, "end");
      ta.dispatchEvent(new Event("input"));
    } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      chay(baiTap && kiem ? "nop" : "chay");
    }
  });
  function inRa(chu, laLoi) {
    ra.hidden = false;
    var s = document.createElement("span");
    if (laLoi) s.className = "loi";
    s.textContent = chu.slice(-4000) + "\n";
    ra.appendChild(s);
    if (ra.childNodes.length > 400) ra.removeChild(ra.firstChild);
  }
  function chay(viec) {
    var nut = hop.querySelectorAll(".chay-nut");
    Array.prototype.forEach.call(nut, function (b) { b.disabled = true; });
    ra.innerHTML = ""; ra.hidden = false; ra.className = "chay-ra";
    var cho = document.createElement("span");
    cho.className = "cho"; cho.textContent = "Đang chạy…";
    ra.appendChild(cho);
    chayTrongTho(ngon, ta.value, viec === "nop" ? kiem : "", function (chu, laLoi) {
      if (cho.parentNode) cho.remove();
      inRa(chu, laLoi);
    }, function () {
      cho.textContent = "Đang tải Python (Pyodide, ~10 MB — chỉ lần đầu)…";
    }, function (ok, loi, oKiem, oNap) {
      if (cho.parentNode) cho.remove();
      Array.prototype.forEach.call(nut, function (b) { b.disabled = false; });
      if (!ok) {
        inRa(oNap ? "Không tải được Python: " + loi + " — cần mạng ở lần chạy đầu." :
             oKiem ? "✗ Chưa đạt — " + tomTatLoi(ngon, loi, kiem, true) : tomTatLoi(ngon, loi, kiem, false), true);
        if (viec === "nop") ra.classList.add("chua-dat");
        return;
      }
      if (viec === "nop") {
        inRa("✓ Đạt — mọi kiểm tra đều qua.", false);
        ra.classList.add("dat");
        dat.hidden = false;
        ghi(".dat", "1");
      } else if (!ra.textContent.trim()) {
        inRa("(chạy xong, không in gì)", false);
      }
    });
  }
  hop.addEventListener("click", function (e) {
    var b = e.target.closest(".chay-nut");
    if (!b) return;
    var v = b.getAttribute("data-viec");
    if (v === "lai") { ta.value = goc; ghi("", null); cao(); ta.focus(); return; }
    chay(v);
  });
  setTimeout(cao, 0);
  return hop;
}

if (root.marked) root.marked.setOptions({ gfm: true, breaks: false, headerIds: false, mangle: false });

function render(md, o) {
  o = o || {};
  demChay = 0;                  /* khoá cất mã người học sửa: theo thứ tự ô trong MỘT bài */
  var docs = o.docs || {}, docId = o.docId || "";
  var icon = o.icon || function () { return ""; };
  var toast = o.toast || function () {};
  md = String(md || "");

  /* a. giấu mã nguồn để ký hiệu $ trong code không bị hiểu là công thức */
  var codes = [];
  md = md.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]+`/g, function (m) {
    codes.push(m); return "\u0011" + (codes.length - 1) + "\u0011";
  });

  /* b. rút công thức ra ngoài trước khi markdown đụng tới dấu \ */
  var maths = [];
  md = md.replace(/\$\$([\s\S]+?)\$\$/g, function (m, t) {
    maths.push([t, true]);
    /* <span> chứ không phải <div>, và KHÔNG chèn dòng trống: thẻ này còn phải
       nằm đúng chỗ trong trích dẫn, ô bảng và mục danh sách. */
    return "<span class=\"mjx-b\" data-m=\"" + (maths.length - 1) + "\"></span>";
  });
  md = md.replace(/\$([^\n$]+?)\$/g, function (m, t) {
    if (/^\s|\s$/.test(t)) return m;                 /* "$ 5 và $ 7" không phải công thức */
    maths.push([t, false]);
    return "<span class=\"mjx-i\" data-m=\"" + (maths.length - 1) + "\"></span>";
  });

  /* c. trả mã nguồn về đúng vị trí cũ rồi mới dựng HTML */
  md = md.replace(/\u0011(\d+)\u0011/g, function (m, i) { return codes[+i]; });

  var host = document.createElement("div");
  host.className = "prose";
  host.appendChild(htmlSach(root.marked ? root.marked.parse(md) : "<pre>" + esc(md) + "</pre>"));

  /* d. công thức */
  $$(".mjx-b,.mjx-i", host).forEach(function (el) {
    var it = maths[+el.dataset.m]; if (!it) return;
    if (!root.katex) { el.className += " mjx-err"; el.textContent = it[0]; return; }
    try {
      el.innerHTML = root.katex.renderToString(it[0], {
        displayMode: it[1], throwOnError: false, strict: false, output: "html"
      });
    } catch (e) {
      el.className += " mjx-err"; el.textContent = it[0];
    }
  });

  /* e. khối mã: nhãn ngôn ngữ, nút chép, tô màu; khối không ngôn ngữ là hình
        vẽ ASCII nên giữ nguyên; khối mermaid thành sơ đồ (vẽ sau, trong DOM) */
  $$("pre", host).forEach(function (pre) {
    var code = pre.querySelector("code");
    var lang = code && (code.className.match(/language-([\w+#-]+)/) || [])[1];
    var chayDuoc = /^(py|python|js|javascript)-(chay|bai-tap)$/.exec(lang || "");
    if (chayDuoc && root.Worker && root.Blob) {
      pre.parentNode.replaceChild(taoChay(code.textContent, chayDuoc[1], chayDuoc[2] === "bai-tap", o), pre);
      return;
    }
    if (lang === "lab") {
      var lab = taoLab(code.textContent, o);
      if (lab) { pre.parentNode.replaceChild(lab, pre); return; }
    }
    if (lang === "mermaid") {
      var mm = document.createElement("div");
      mm.className = "mermaid";
      mm.textContent = code.textContent;
      pre.parentNode.replaceChild(mm, pre);
      return;
    }
    var wrap = document.createElement("div");
    wrap.className = "cw" + (lang ? "" : " diag");
    pre.parentNode.insertBefore(wrap, pre);
    wrap.appendChild(pre);
    if (lang && root.hljs && root.hljs.getLanguage(lang)) {
      try { code.innerHTML = root.hljs.highlight(code.textContent, { language: lang }).value; } catch (e) {}
    }
    if (lang) {
      var lb = document.createElement("span");
      lb.className = "cw-lang"; lb.textContent = lang;
      wrap.appendChild(lb);
    }
    var b = document.createElement("button");
    b.type = "button";
    b.className = "cw-cp"; b.title = "Chép đoạn mã"; b.setAttribute("aria-label", "Chép đoạn mã");
    b.innerHTML = icon("copy") || "⧉";
    b.addEventListener("click", function () {
      var txt = (code || pre).textContent;
      var ok = function () {
        b.innerHTML = icon("check") || "✓"; b.classList.add("ok");
        setTimeout(function () { b.innerHTML = icon("copy") || "⧉"; b.classList.remove("ok"); }, 1400);
      };
      if (navigator.clipboard) navigator.clipboard.writeText(txt).then(ok, function () { toast("Không chép được"); });
      else {
        var ta = document.createElement("textarea");
        ta.value = txt; document.body.appendChild(ta); ta.select();
        try { document.execCommand("copy"); ok(); } catch (e) { toast("Không chép được"); }
        document.body.removeChild(ta);
      }
    });
    wrap.appendChild(b);
  });

  /* f. bảng cuộn ngang được trên màn nhỏ */
  $$("table", host).forEach(function (t) {
    var w = document.createElement("div");
    w.className = "tw";
    t.parentNode.insertBefore(w, t); w.appendChild(t);
  });

  /* g. trích dẫn → hộp chú ý, phân loại theo biểu tượng mở đầu */
  var CAL = [
    [/^(📖|🔗)/, "cal-ref"], [/^(📌|⭐|💡|★)/, "cal-key"],
    [/^(⚠️|⚠)/, "cal-warn"], [/^(❌|🚫)/, "cal-bad"], [/^(✅|✔)/, "cal-ok"]
  ];
  $$("blockquote", host).forEach(function (q) {
    var t = (q.textContent || "").trim();
    for (var i = 0; i < CAL.length; i++) {
      if (CAL[i][0].test(t)) { q.classList.add(CAL[i][1]); return; }
    }
  });

  /* h. tiêu đề: gắn mã neo */
  var seen = {}, slugBai = docs[docId] ? docs[docId].slug : "";
  $$("h2,h3", host).forEach(function (h) {
    var s = slugifyHeading(h.textContent);
    if (seen[s]) { s = s + "-" + (++seen[s]); } else { seen[s] = 1; }
    h.id = s;
    var a = document.createElement("a");
    a.className = "anch"; a.href = slugBai ? "#/" + slugBai + "#" + s : "#" + s;
    a.setAttribute("aria-label", "Liên kết tới mục này"); a.innerHTML = icon("link") || "#";
    h.insertBefore(a, h.firstChild);
  });

  /* i. tệp tải lên khoá: assets/<tên> → địa chỉ thật */
  $$("img[src]", host).forEach(function (img) {
    var ten = tenTep(img.getAttribute("src"));
    if (!ten || !o.assetUrl) return;
    var url = o.assetUrl(ten);
    img.setAttribute("loading", "lazy");
    if (o.taiAnh) {
      img.removeAttribute("src");
      img.setAttribute("data-tep", ten);
      o.taiAnh(url).then(function (u) { img.src = u; }, function () { img.alt = (img.alt || "") + " [không tải được " + ten + "]"; });
    } else {
      img.src = url;
    }
  });

  /* j. liên kết */
  $$("a", host).forEach(function (a) {
    if (a.classList.contains("anch")) return;
    var href = a.getAttribute("href") || "";
    var ten = tenTep(href);
    if (ten) {
      if (o.assetUrl) { a.href = o.assetUrl(ten); a.target = "_blank"; a.rel = "noopener"; a.title = "Tệp " + ten; }
      return;
    }
    if (/^https?:/.test(href)) {
      a.target = "_blank"; a.rel = "noopener noreferrer";
      a.insertAdjacentHTML("beforeend", icon("ext"));
      return;
    }
    var r = resolveHref(href, docId, docs);
    if (!r) return;
    if (r.route) { a.setAttribute("href", r.route); a.title = r.doc.title || ""; a.setAttribute("data-bai", r.id); }
    else { a.setAttribute("href", r.file); a.target = "_blank"; a.rel = "noopener"; a.title = "Mở tệp trong kho mã nguồn"; }
  });

  return host;
}

/* ---- sơ đồ mermaid: nạp thư viện khi cần, vẽ khi đã ở trong DOM ---- */
var MERMAID_URL = "https://cdnjs.cloudflare.com/ajax/libs/mermaid/10.9.1/mermaid.min.js";
var dangNap = null;
function napMermaid() {
  if (root.mermaid) return Promise.resolve(root.mermaid);
  if (dangNap) return dangNap;
  dangNap = new Promise(function (ok, loi) {
    var s = document.createElement("script");
    s.src = MERMAID_URL; s.async = true;
    s.onload = function () { root.mermaid ? ok(root.mermaid) : loi(new Error("mermaid")); };
    s.onerror = function () { dangNap = null; loi(new Error("không tải được mermaid")); };
    document.head.appendChild(s);
  });
  return dangNap;
}
function veMermaid(goc) {
  var els = $$(".mermaid:not([data-da-ve])", goc || document);
  if (!els.length) return Promise.resolve(0);
  return napMermaid().then(function (mermaid) {
    els = els.filter(function (e) { return e.isConnected && !e.hasAttribute("data-da-ve"); });
    if (!els.length) return 0;
    els.forEach(function (e) { e.setAttribute("data-da-ve", "1"); });
    var de = document.documentElement;
    var toi = de.getAttribute("data-theme") === "dark" ||
              (de.getAttribute("data-theme") !== "light" && root.matchMedia && root.matchMedia("(prefers-color-scheme: dark)").matches);
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "base",
      fontFamily: "inherit",
      themeVariables: toi ? {
        fontSize: "15px",
        primaryColor: "#2a1420", primaryTextColor: "#ece8e2", primaryBorderColor: "#4d2137",
        lineColor: "#8b847a", secondaryColor: "#241f26", tertiaryColor: "#1c1a18",
        clusterBkg: "#1c1a18", clusterBorder: "#3a3530", background: "#151412"
      } : {
        fontSize: "15px",
        primaryColor: "#fdf2f6", primaryTextColor: "#1a1816", primaryBorderColor: "#f3c6d8",
        lineColor: "#8b847a", secondaryColor: "#f7f5f2", tertiaryColor: "#faf9f7",
        clusterBkg: "#f7f5f2", clusterBorder: "#e4e0d9", background: "#ffffff"
      }
    });
    return Promise.resolve(mermaid.run({ nodes: els })).then(function () { return els.length; });
  }).catch(function () {
    /* Sơ đồ hỏng (hay không tải được thư viện) không được làm hỏng cả trang: hiện lại mã nguồn. */
    els.forEach(function (el) {
      if (el.querySelector("svg")) return;
      el.classList.remove("mermaid");
      el.classList.add("cw", "diag");
      el.innerHTML = "<pre><code>" + esc(el.textContent) + "</code></pre>";
    });
    return 0;
  });
}

root.HienThi = {
  norm: norm, slugifyHeading: slugifyHeading, lamSach: lamSach, htmlSach: htmlSach,
  resolveHref: resolveHref, render: render, veMermaid: veMermaid, tenTep: tenTep, phanTichLab: phanTichLab
};
})(window);
