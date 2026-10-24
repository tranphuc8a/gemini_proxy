/* ui/rich.js — "hydrate" công thức (KaTeX) và sơ đồ (mermaid) trên HTML đã dựng sẵn bởi markdown.js.

   Hợp đồng (md-render việc 18):
   · markdown.js dựng `span.math` / `div.math.math-d` với TeX nguyên văn trong `data-tex` (và cùng chữ đó làm nội dung dự phòng),
     ```mermaid → `pre.code.mmd` (nguồn nằm trong <code>). Ở đây: đọc `getAttribute("data-tex")` — KHÔNG đọc innerHTML —, displayMode =
     classList.contains("math-d"), thay NỘI DUNG nút, giữ `data-tex`, đánh `data-hydrated`; chạy lại không đổi gì.
   · KaTeX chép CỤC BỘ ở assets/vendor/katex/, nạp lười (chỉ khi có công thức). Chưa tải được (offline lần đầu, bị chặn) → giữ nguyên
     TeX nguyên văn có định dạng (kiểu code), KHÔNG đánh dấu để lần hydrate sau thử lại. Cài: throwOnError:false, trust:false, strict:"ignore".
   · mermaid nạp lười từ cdnjs có SRI, securityLevel "strict"; không tải được → giữ khối mã nguyên văn.
   · Hook của editor: U.rich.hydrate(phầnTửKhốiMới[]) — chỉ nhận khối MỚI. Việc nặng chia lát ~8 ms để gõ không bị khựng khi mở note dài.
   · Mọi chuỗi từ người dùng vào DOM qua textContent / setAttribute (không innerHTML), trừ SVG do mermaid (strict) dựng, được lọc thêm. */
(function (root) {
  "use strict";
  var W = root.Wiki || (root.Wiki = {}), U = W.ui = W.ui || {}, doc = root.document;

  // ----------------------------------------------------------------------------------------------- địa chỉ vendor
  var BASE = (function () {
    try { var s = doc.currentScript && doc.currentScript.src; if (s) return new root.URL("../../vendor/katex/", s).href; } catch (e) { /* rơi xuống đường tương đối */ }
    return "./assets/vendor/katex/";
  })();
  var MERMAID_URL = "https://cdnjs.cloudflare.com/ajax/libs/mermaid/10.9.1/mermaid.min.js";
  var MERMAID_SRI = "sha512-6a80OTZVmEJhqYJUmYd5z8yHUCDlYnj6q9XwB/gKOEyNQV/Q8u+XeSG59a2ZKFEHGTYzgfOQKYEBtrZV7vBr+Q==";
  var RETRY_MS = 15000;                                        // sau một lần nạp hỏng, chưa thử lại trước thời hạn này (tránh gõ phím nào cũng bắn mạng)

  // ----------------------------------------------------------------------------------------------- nạp lười
  var lib = { katex: null, mermaid: null };                    // {p: Promise|null, t: lần hỏng gần nhất}
  function loadOnce(key, start) {
    var s = lib[key];
    if (s && s.p) return s.p;
    if (s && s.t && Date.now() - s.t < RETRY_MS) return Promise.reject(new Error(key + ": vừa nạp hỏng"));
    var rec = lib[key] = { p: null, t: 0 };
    rec.p = start().then(function (v) { return v; }, function (e) { rec.p = null; rec.t = Date.now(); throw e; });
    return rec.p;
  }
  function addScript(src, integrity) {
    return new Promise(function (ok, bad) {
      var s = doc.createElement("script");
      s.src = src; s.async = true;
      if (integrity) { s.integrity = integrity; s.crossOrigin = "anonymous"; s.referrerPolicy = "no-referrer"; }
      s.onload = ok; s.onerror = function () { s.remove(); bad(new Error("không tải được " + src)); };
      doc.head.appendChild(s);
    });
  }
  function loadKatex() {
    if (root.katex && typeof root.katex.render === "function") return Promise.resolve(root.katex);
    return loadOnce("katex", function () {
      if (!doc.getElementById("katexCss")) {
        var l = doc.createElement("link"); l.rel = "stylesheet"; l.id = "katexCss"; l.href = BASE + "katex.min.css"; doc.head.appendChild(l);
      }
      return addScript(BASE + "katex.min.js").then(function () {
        if (!root.katex || typeof root.katex.render !== "function") throw new Error("KaTeX không có katex.render");
        return root.katex;
      });
    });
  }
  function loadMermaid() {
    if (root.mermaid && typeof root.mermaid.render === "function") return Promise.resolve(root.mermaid);
    return loadOnce("mermaid", function () {
      return addScript(MERMAID_URL, MERMAID_SRI).then(function () {
        if (!root.mermaid || typeof root.mermaid.render !== "function") throw new Error("mermaid không có render");
        return root.mermaid;
      });
    });
  }

  // ----------------------------------------------------------------------------------------------- KaTeX
  var MAX_TEX = 2000;                                          // ký tự TeX tối đa cho một công thức được hydrate (8k ký tự đã treo 1,35 s; 4k vẫn chặn ~1 s)
  var MAX_DEPTH = 10;                                          // độ sâu lồng tối đa ({ }, \left/\right, \begin/\end): lồng sâu hơn làm sập tab (\sqrt{ x200 = 1.4k ký tự đã sập Edge; trong trang ôn tập \sqrt{ x17 đã sập, x12 vẫn vẽ)
  var MAX_CMD = 40;                                            // số lệnh nhận đối số (\frac, \sqrt, \binom…) tối đa: chuỗi \frac\frac\frac… không cần ngoặc cũng lồng sâu
  /** Công thức có an toàn để đưa cho KaTeX không? Một lượt quét tuyến tính, không regex. */
  function texTooDeep(tex) {
    var d = 0, cmds = 0, n = tex.length;
    for (var i = 0; i < n; i++) {
      var c = tex.charCodeAt(i);
      if (c === 92) {                                          // "\"
        var j = i + 1;
        while (j < n) { var k = tex.charCodeAt(j); if ((k >= 65 && k <= 90) || (k >= 97 && k <= 122)) j++; else break; }
        var w = tex.slice(i + 1, j);
        if (w === "left" || w === "begin") { if (++d > MAX_DEPTH) return true; }
        else if (w === "right" || w === "end") { if (d > 0) d--; }
        else if (w === "frac" || w === "dfrac" || w === "tfrac" || w === "sqrt" || w === "binom" || w === "overset" || w === "underset" || w === "stackrel") { if (++cmds > MAX_CMD) return true; }
        i = j > i + 1 ? j - 1 : i + 1;                         // bỏ qua tên lệnh, hoặc ký tự bị thoát (\{ \} không tính là ngoặc)
      } else if (c === 123) { if (++d > MAX_DEPTH) return true; }
      else if (c === 125) { if (d > 0) d--; }
    }
    return false;
  }
  function macros() { return { "\\label": "\\mathrlap{\\phantom{\\text{#1}}}", "\\eqref": "\\text{(#1)}", "\\ref": "\\text{#1}" }; }   // bản mới mỗi lần: \gdef ghi vào đối tượng được đưa vào
  function mathOne(katex, el) {
    if (!el.isConnected || el.hasAttribute("data-hydrated")) return;
    var tex = el.getAttribute("data-tex");
    if (tex == null) { el.setAttribute("data-hydrated", "loi"); return; }              // không có TeX để vẽ: đánh "loi" để vòng chờ không thăm dò mãi
    if (tex.length > MAX_TEX || texTooDeep(tex)) { el.setAttribute("data-hydrated", "dai"); return; }    // KaTeX chạy đồng bộ, chia lát không cắt được một công thức: quá dài thì giữ TeX nguyên văn
    try {
      katex.render(tex, el, { displayMode: el.classList.contains("math-d"), throwOnError: false, trust: false, strict: "ignore", maxSize: 50, macros: macros(), output: "htmlAndMathml" });
    } catch (e) { el.setAttribute("data-hydrated", "loi"); return; }   // KaTeX ném (hiếm với throwOnError:false): giữ TeX nguyên văn, đánh "loi" để không lặp vô hạn
    el.setAttribute("role", "math");
    el.setAttribute("aria-label", tex.length > 600 ? tex.slice(0, 600) + "…" : tex);
    el.setAttribute("data-hydrated", "1");
  }

  // ----------------------------------------------------------------------------------------------- mermaid
  var mmSeq = 0;
  function isDark() {
    var de = doc.documentElement, t = de.getAttribute("data-theme");
    return t === "dark" || (t !== "light" && root.matchMedia && root.matchMedia("(prefers-color-scheme: dark)").matches);
  }
  function cleanSvg(box) {                                      // mermaid strict đã lọc; lọc thêm một lớp (script, on*, javascript:)
    Array.prototype.slice.call(box.querySelectorAll("script")).forEach(function (n) { n.remove(); });
    Array.prototype.slice.call(box.querySelectorAll("*")).forEach(function (n) {
      Array.prototype.slice.call(n.attributes).forEach(function (a) {
        var nm = a.name.toLowerCase();
        if (nm.indexOf("on") === 0 || ((nm === "href" || nm === "xlink:href") && /^\s*javascript:/i.test(a.value))) n.removeAttribute(a.name);
      });
    });
  }
  function mermaidOne(mm, el) {
    if (!el.isConnected || el.hasAttribute("data-hydrated")) return Promise.resolve();
    var code = el.querySelector("code"), src = (code || el).textContent;
    el.setAttribute("data-hydrated", "pending");                // chặn chạy trùng trong lúc mermaid đang vẽ
    try {
      mm.initialize({ startOnLoad: false, securityLevel: "strict", theme: isDark() ? "dark" : "default", fontFamily: "inherit" });
    } catch (e) { /* đã khởi tạo */ }
    return Promise.resolve(mm.render("pwmm" + (++mmSeq), src)).then(function (res) {
      if (!el.isConnected) return;
      var box = doc.createElement("div");
      box.className = "mmd-fig";
      box.innerHTML = res && res.svg ? res.svg : "";
      cleanSvg(box);
      if (!box.querySelector("svg")) throw new Error("mermaid không trả svg");
      el.setAttribute("data-src", src);
      el.replaceChildren(box);
      el.classList.add("mmd-done");
      el.setAttribute("role", "img");
      el.setAttribute("aria-label", "Sơ đồ mermaid");
      el.setAttribute("data-hydrated", "1");
      var junk = doc.getElementById("dpwmm" + mmSeq); if (junk) junk.remove();
    }).catch(function () {
      el.removeAttribute("data-hydrated");                       // sơ đồ lỗi cú pháp: giữ khối mã nguyên văn (lần sau thử lại khi nội dung đổi)
      el.setAttribute("data-mmd-loi", "1");
      Array.prototype.slice.call(doc.querySelectorAll("[id^=dpwmm]")).forEach(function (n) { if (!n.closest(".md")) n.remove(); });
    });
  }

  // ----------------------------------------------------------------------------------------------- hàng đợi chia lát
  var qMath = [], running = false;
  function slice() {
    running = false;
    var t0 = root.performance.now();
    while (qMath.length && root.performance.now() - t0 < 8) mathOne(root.katex, qMath.shift());
    if (qMath.length) schedule();
  }
  function schedule() { if (!running) { running = true; root.setTimeout(slice, 0); } }

  function collect(els) {
    var m = [], d = [];
    (els || []).forEach(function (e) {
      if (!e || e.nodeType !== 1) return;
      if (e.matches(".math:not([data-hydrated])")) m.push(e);
      Array.prototype.push.apply(m, e.querySelectorAll(".math:not([data-hydrated])"));
      if (e.matches("pre.mmd:not([data-hydrated]):not([data-mmd-loi])")) d.push(e);
      Array.prototype.push.apply(d, e.querySelectorAll("pre.mmd:not([data-hydrated]):not([data-mmd-loi])"));
    });
    return { math: m, mmd: d };
  }

  /** hydrate(elOrArray) → Promise<số nút đã xử lý>. Nhận một phần tử hoặc mảng phần tử (khối MỚI). Chạy lại trên phần tử đã xong không đổi gì. */
  function hydrate(els) {
    if (els && els.nodeType === 1) els = [els];
    var c = collect(Array.prototype.slice.call(els || []));
    var jobs = [];
    if (c.math.length) {
      jobs.push(loadKatex().then(function () {
        return new Promise(function (ok) {
          c.math.forEach(function (e) { qMath.push(e); });
          schedule();
          (function wait() { if (c.math.every(function (e) { return e.hasAttribute("data-hydrated") || !e.isConnected; })) ok(c.math.length); else root.setTimeout(wait, 16); })();
        });
      }, function () { return 0; }));
    }
    if (c.mmd.length) {
      jobs.push(loadMermaid().then(function (mm) {
        return c.mmd.reduce(function (p, e) { return p.then(function () { return mermaidOne(mm, e); }); }, Promise.resolve()).then(function () { return c.mmd.length; });
      }, function () { return 0; }));
    }
    return Promise.all(jobs).then(function (r) { return r.reduce(function (a, b) { return a + b; }, 0); });
  }

  /** observe(rootEl) → hàm ngắt. Cho app dựng HTML ở nhiều chỗ (Notebook): mỗi đợt thay đổi DOM trong rootEl, gộp theo khung hình rồi hydrate phần chưa xong. */
  function observe(rootEl) {
    if (!root.MutationObserver) return function () {};
    var pending = false;
    var mo = new root.MutationObserver(function () {
      if (pending) return;
      pending = true;
      root.requestAnimationFrame(function () { pending = false; if (rootEl.querySelector(".math:not([data-hydrated]), pre.mmd:not([data-hydrated]):not([data-mmd-loi])")) hydrate([rootEl]); });
    });
    mo.observe(rootEl, { childList: true, subtree: true });
    return function () { mo.disconnect(); };
  }

  U.rich = { hydrate: hydrate, observe: observe, _lib: lib, BASE: BASE };
})(window);
