/* Trình soạn mã gọn, tự viết: <textarea> trong suốt đè lên một <pre> đã tô màu. Không thư viện ngoài.
   Có: số dòng, tô cú pháp, Tab/Shift+Tab (thụt cả đoạn chọn), Enter tự thụt dòng, Ctrl+/ chú thích dòng, Ctrl+Enter chạy,
   hàng phím tắt ký hiệu cho điện thoại (Tab { } ( ) [ ] ; < > = & | ! " ' # / * + − :), đánh dấu dòng lỗi.
   TH.editor.tao(host, {ngon, giaTri, khiDoi(v), khiChay(), chiDoc, nhan}) → {lay, dat, doiNgon, focus, danhDauLoi, nhayToi, chen} */
(function (root) {
  "use strict";
  var TH = root.TH || (root.TH = {});
  var THUT = "  ";
  var PHIM = [["Tab", "\t"], ["{", "{"], ["}", "}"], ["(", "("], [")", ")"], ["[", "["], ["]", "]"], [";", ";"], ["<", "<"], [">", ">"],
              ["=", "="], ["&", "&"], ["|", "|"], ["!", "!"], ["\"", "\""], ["'", "'"], ["#", "#"], ["/", "/"], ["*", "*"], ["+", "+"], ["-", "-"], [":", ":"]];

  function tao(host, o) {
    o = o || {};
    var ngon = o.ngon || "cpp", loiDong = {}, soDong = 0;
    host.classList.add("ed");
    if (o.chiDoc) host.classList.add("ed-doc");
    host.innerHTML = '<div class="ed-main"><div class="ed-gut" aria-hidden="true"></div><div class="ed-body">' +
      '<pre class="ed-hl" aria-hidden="true"><code></code></pre>' +
      '<textarea class="ed-ta" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" wrap="off"' +
      (o.chiDoc ? " readonly" : "") + ' aria-label="' + (o.nhan || "Trình soạn mã") + '"></textarea></div></div>' +
      (o.chiDoc ? "" : '<div class="ed-keys" aria-label="Phím tắt ký hiệu"></div>');
    var gut = host.querySelector(".ed-gut"), pre = host.querySelector(".ed-hl"), code = pre.firstChild,
        ta = host.querySelector(".ed-ta"), keys = host.querySelector(".ed-keys");
    ta.value = o.giaTri || "";

    function ve() {
      code.innerHTML = (TH.tomau ? TH.tomau.html(ta.value, ngon) : TH.tienIch.esc(ta.value)) + "\n";
      var n = ta.value.split("\n").length, dau = "";
      if (n !== soDong || Object.keys(loiDong).length) {
        for (var i = 1; i <= n; i++) dau += (loiDong[i] ? '<i class="ed-err" title="' + TH.tienIch.esc(loiDong[i]) + '">' + i + "</i>" : i) + (i < n ? "\n" : "");
        gut.innerHTML = dau; soDong = n;
      }
    }
    var cho = 0;
    function hen() { if (!cho) cho = requestAnimationFrame(function () { cho = 0; ve(); }); }
    function doi() { hen(); if (o.khiDoi) o.khiDoi(ta.value); }

    function chen(txt) {                               /* chèn tại con trỏ, giữ được hoàn tác (undo) */
      ta.focus();
      var ok = false;
      try { ok = document.execCommand && document.execCommand("insertText", false, txt); } catch (e) { ok = false; }
      if (!ok) { ta.setRangeText(txt, ta.selectionStart, ta.selectionEnd, "end"); doi(); }
    }
    function thayDoan(tu, den, txt, chonTu, chonDen) {
      ta.focus(); ta.setSelectionRange(tu, den);
      var ok = false;
      try { ok = document.execCommand && document.execCommand("insertText", false, txt); } catch (e) { ok = false; }
      if (!ok) { ta.setRangeText(txt, tu, den, "end"); doi(); }
      ta.setSelectionRange(chonTu, chonDen);
    }
    function dauDong(pos) { return ta.value.lastIndexOf("\n", pos - 1) + 1; }

    function thutDoan(giam) {
      var v = ta.value, a = ta.selectionStart, b = ta.selectionEnd, tu = dauDong(a);
      var denDong = v.indexOf("\n", b > a && v.charAt(b - 1) === "\n" ? b - 1 : b);
      if (denDong < 0) denDong = v.length;
      var dong = v.slice(tu, denDong).split("\n");
      var moi = dong.map(function (d) {
        if (!giam) return THUT + d;
        return d.indexOf(THUT) === 0 ? d.slice(THUT.length) : d.replace(/^ ?/, "");
      }), s = moi.join("\n");
      var lech1 = giam ? -(dong[0].length - moi[0].length) : THUT.length;
      thayDoan(tu, denDong, s, Math.max(tu, a + lech1), b + (s.length - (denDong - tu)));
    }
    function chuThich() {
      var v = ta.value, a = ta.selectionStart, b = ta.selectionEnd, tu = dauDong(a);
      var den = v.indexOf("\n", b); if (den < 0) den = v.length;
      var dong = v.slice(tu, den).split("\n");
      var tatCa = dong.every(function (d) { return /^\s*\/\//.test(d) || !d.trim(); });
      var moi = dong.map(function (d) {
        if (!d.trim()) return d;
        return tatCa ? d.replace(/^(\s*)\/\/ ?/, "$1") : d.replace(/^(\s*)/, "$1// ");
      }), s = moi.join("\n");
      thayDoan(tu, den, s, tu, tu + s.length);
    }

    ta.addEventListener("input", doi);
    ta.addEventListener("scroll", function () { pre.scrollTop = ta.scrollTop; pre.scrollLeft = ta.scrollLeft; gut.scrollTop = ta.scrollTop; });
    ta.addEventListener("keydown", function (e) {
      if (o.chiDoc) return;
      var mod = e.ctrlKey || e.metaKey;
      if (e.key === "Enter" && mod) { e.preventDefault(); if (o.khiChay) o.khiChay(); return; }
      if (e.key === "Tab" && !mod && !e.altKey) {
        e.preventDefault();
        if (ta.selectionStart !== ta.selectionEnd && ta.value.slice(ta.selectionStart, ta.selectionEnd).indexOf("\n") >= 0) thutDoan(e.shiftKey);
        else if (e.shiftKey) thutDoan(true);
        else chen(THUT);
        return;
      }
      if (e.key === "/" && mod) { e.preventDefault(); chuThich(); return; }
      if (e.key === "Enter" && !mod && !e.shiftKey && ta.selectionStart === ta.selectionEnd) {
        var pos = ta.selectionStart, v = ta.value, d0 = dauDong(pos), truoc = v.slice(d0, pos);
        var thut = (/^[ \t]*/.exec(truoc) || [""])[0], dau = truoc.replace(/\s+$/, "").slice(-1), sau = v.charAt(pos);
        if (dau === "{" || dau === ":" && ngon === "cpp" && /\b(case|default|public|private|protected)\b/.test(truoc)) {
          e.preventDefault();
          if (dau === "{" && sau === "}") {
            chen("\n" + thut + THUT + "\n" + thut);
            ta.setSelectionRange(pos + 1 + thut.length + THUT.length, pos + 1 + thut.length + THUT.length);
          } else chen("\n" + thut + THUT);
        } else if (thut) { e.preventDefault(); chen("\n" + thut); }
      }
    });

    if (keys) {
      PHIM.forEach(function (p) {
        var b = document.createElement("button");
        b.type = "button"; b.textContent = p[0]; b.setAttribute("aria-label", p[0] === "Tab" ? "Thụt dòng" : "Chèn " + p[0]);
        b.addEventListener("pointerdown", function (e) { e.preventDefault(); });      /* giữ nguyên tiêu điểm ở ô soạn */
        b.addEventListener("click", function () { chen(p[1] === "\t" ? THUT : p[1]); });
        keys.appendChild(b);
      });
    }

    ve();
    return {
      lay: function () { return ta.value; },
      dat: function (v) { ta.value = v == null ? "" : String(v); loiDong = {}; soDong = 0; ve(); ta.scrollTop = 0; },
      doiNgon: function (n) { ngon = n; soDong = 0; ve(); },
      focus: function () { ta.focus(); },
      chen: chen,
      danhDauLoi: function (ds) {
        loiDong = {};
        (ds || []).forEach(function (x) { if (x.dong > 0 && !loiDong[x.dong]) loiDong[x.dong] = x.msg || x.loai || "lỗi"; });
        soDong = 0; ve();
      },
      nhayToi: function (dong, cot) {
        var v = ta.value.split("\n"), pos = 0;
        for (var i = 0; i < Math.min(dong - 1, v.length); i++) pos += v[i].length + 1;
        pos += Math.max(0, Math.min((cot || 1) - 1, (v[dong - 1] || "").length));
        ta.focus(); ta.setSelectionRange(pos, pos);
        var lh = parseFloat(getComputedStyle(ta).lineHeight) || 20;
        ta.scrollTop = Math.max(0, (dong - 4) * lh);
      }
    };
  }

  TH.editor = { tao: tao };
})(window);
