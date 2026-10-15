/* panel.js — bảng dưới của Code Studio: Kết quả (biên dịch + chạy), Vấn đề (chẩn đoán, bấm để nhảy tới), Dữ liệu vào (stdin, tham số),
   Cấu hình chạy (nơi chạy, tệp chính, chuẩn, tối ưu, giới hạn thời gian). Gắn vào CS.app.panel. */
(function (root) {
  "use strict";
  var CS = root.CS, U = CS.dom, h = U.h, A = CS.app;
  var outBox = null, runSt = null, state = { lines: [], status: null, startedAt: 0, tick: 0 };

  function body() { return A.els.pbody; }
  function S() { return A.S; }

  function init() { render(); }

  function render() {
    var tab = S().settings.panelTab;
    U.$$(".cs-ptab").forEach(function (b) { b.setAttribute("aria-selected", String(b.getAttribute("data-ptab") === tab)); });
    var n = (S().diags || []).filter(function (d) { return d.severity === "error"; }).length, badge = U.$('.cs-ptab[data-ptab="problems"] .n');
    if (badge) { badge.hidden = !n; badge.textContent = String(n); }
    var b = body(); b.innerHTML = "";
    if (tab === "problems") return renderProblems(b);
    if (tab === "input") return renderInput(b);
    if (tab === "config") return renderConfig(b);
    renderOutput(b);
  }

  /* ---------------- Kết quả ---------------- */
  function renderOutput(b) {
    runSt = h("div", { class: "cs-runst", "aria-live": "polite" });
    outBox = h("pre", { class: "cs-out", tabindex: "0", "aria-label": "Kết quả chạy" });
    b.appendChild(runSt); b.appendChild(outBox);
    paintStatus(); paintLines();
  }
  function paintStatus() {
    if (!runSt) return;
    runSt.innerHTML = "";
    var st = state.status;
    if (!st) { runSt.appendChild(h("span", { text: S().item ? "Bấm ▶ Chạy (Ctrl+Enter) để biên dịch và chạy. Dữ liệu vào đặt ở thẻ “Dữ liệu vào”." : "Chưa mở đoạn mã/dự án nào." })); return; }
    runSt.appendChild(h("span", { class: "pill " + st.cls, text: st.label }));
    if (st.msg) runSt.appendChild(h("span", { text: st.msg }));
    if (st.pct != null) { var bar = h("span", { class: "cs-bar" }, [h("i", { style: { width: Math.round(st.pct) + "%" } })]); runSt.appendChild(bar); }
    if (st.extra) runSt.appendChild(h("span", { text: st.extra }));
  }
  function paintLines() {
    if (!outBox) return;
    outBox.innerHTML = "";
    state.lines.forEach(function (l) { outBox.appendChild(l.cls ? h("span", { class: l.cls, text: l.text }) : root.document.createTextNode(l.text)); });
    outBox.scrollTop = outBox.scrollHeight;
  }
  function push(text, cls) {
    if (!text) return;
    var total = state.lines.reduce(function (a, l) { return a + l.text.length; }, 0);
    if (total > 600000) { if (!state.cut) { state.lines.push({ text: "\n… (đã cắt bớt — đầu ra quá dài)\n", cls: "s" }); state.cut = true; } return; }
    state.lines.push({ text: text, cls: cls });
  }
  function setStatus(cls, label, msg, extra, pct) { state.status = { cls: cls, label: label, msg: msg || "", extra: extra || "", pct: pct }; paintStatus(); }

  function startRun(tgt) {
    if (S().settings.run.clearOnRun) { state.lines = []; state.cut = false; }
    else push("\n────────\n", "s");
    state.startedAt = Date.now();
    setStatus("busy", "Đang chạy", "Nơi chạy: " + (tgt.label || tgt.id));
    if (S().settings.panelTab !== "output") A.showPanel("output"); else { S().settings.panelOpen = true; render(); }
    clearInterval(state.tick);
    state.tick = setInterval(function () { if (state.status && state.status.cls === "busy" && state.status.pct == null) { state.status.extra = Math.round((Date.now() - state.startedAt) / 1000) + " giây"; paintStatus(); } }, 1000);
    paintLines();
  }
  function progress(ev) {
    if (!ev) return;
    var t = ev.type || ev.loai || ev.phase || "";
    if (t === "download" || t === "tai") setStatus("busy", "Đang tải", ev.label || "Tải bộ chạy lần đầu (sau đó dùng được cả khi không mạng)…", ev.total ? U.fmtBytes(ev.loaded || ev.da || 0) + " / " + U.fmtBytes(ev.total || ev.tong) : "", ev.pct != null ? ev.pct : (ev.total ? 100 * (ev.loaded || 0) / ev.total : null));
    else if (t === "compile" || t === "bat-dau") setStatus("busy", "Đang biên dịch", ev.message || "");
    else if (t === "run") setStatus("busy", "Đang chạy", ev.message || "");
    else if (t === "stdout" || t === "out") { push(ev.text || ev.s || ev.data || ""); paintLines(); }
    else if (t === "stderr" || t === "err") { push(ev.text || ev.s || ev.data || "", "e"); paintLines(); }
    else if (ev.message) setStatus("busy", "Đang chạy", ev.message);
  }
  function showResult(r) {
    clearInterval(state.tick);
    var c = r.compile, x = r.run || {}, streamed = state.lines.length > 0 && !S().settings.run.clearOnRun ? false : false;
    if (S().settings.run.clearOnRun) { state.lines = []; state.cut = false; }
    if (c && c.ran && (c.stderr || c.stdout) && (!c.ok || /warning/i.test(c.stderr))) {
      push((c.ok ? "⚠ Biên dịch có cảnh báo:\n" : "✖ Biên dịch thất bại:\n"), c.ok ? "s" : "e");
      push((c.stdout || "") + (c.stderr || "") + "\n", c.ok ? "s" : "e");
    }
    if (x.ran !== false) {
      push(x.stdout || "");
      if (x.stderr) push((x.stdout && !/\n$/.test(x.stdout) ? "\n" : "") + x.stderr, "e");
      if (!x.stdout && !x.stderr && (x.ok || x.code === 0)) push("(chương trình không in gì)\n", "s");
      if (x.truncated) push("\n… (đầu ra đã bị cắt ở 1 MiB)\n", "s");
    }
    (r.warnings || []).forEach(function (w) { push("ℹ " + w + "\n", "s"); });
    var ms = x.ms != null ? Math.round(x.ms) + " ms" : "", parts = [];
    if (c && c.ran && c.ms) parts.push("biên dịch " + (c.ms >= 1000 ? (c.ms / 1000).toFixed(1).replace(".", ",") + " s" : Math.round(c.ms) + " ms"));
    if (ms) parts.push("chạy " + ms);
    if (x.code != null && x.ran !== false) parts.push("mã thoát " + x.code);
    if (r.version) parts.push((r.provider || r.target || "") + " " + r.version);
    if (r.ok) setStatus("ok", "Thành công", parts.join(" · "));
    else {
      var e = r.error || {}, label = { compile_error: "Lỗi biên dịch", compile_timeout: "Biên dịch quá giờ", run_timeout: "Quá giờ", runtime_error: "Lỗi khi chạy" }[e.code] || "Lỗi";
      setStatus("bad", label, e.message || parts.join(" · "), e.message ? parts.join(" · ") : "");
      if (e.code === "compile_error" && (S().diags || []).length) push("\n→ Xem thẻ “Vấn đề” (" + S().diags.length + ") hoặc bấm vào số dòng đỏ trong trình soạn.\n", "s");
    }
    paintLines();
  }
  function failRun(e) {
    clearInterval(state.tick);
    var msg = e && e.message ? e.message : String(e);
    setStatus("bad", "Không chạy được", msg);
    if (e && e.code === "admin_required") push("Nơi chạy “máy chủ cục bộ” cần khoá quản trị — đặt ở Cài đặt › Chạy mã.\n", "s");
    paintLines();
  }
  function cancelled() { clearInterval(state.tick); setStatus("bad", "Đã dừng", "Bạn đã dừng chương trình."); }
  function clear() { state.lines = []; state.status = null; state.cut = false; render(); }
  function note(msg) { setStatus("ok", "Xem trước", msg); }

  /* ---------------- Vấn đề ---------------- */
  function renderProblems(b) {
    var list = S().diags || [];
    if (!list.length) { b.appendChild(h("p", { class: "cs-runst", text: "Không có vấn đề nào từ lần chạy gần nhất." })); return; }
    var ul = h("ul", { class: "cs-probs" });
    list.forEach(function (d) {
      var li = h("li", { tabindex: "0", role: "button" }, [
        h("span", { class: "sv " + d.severity, text: d.severity === "error" ? "lỗi" : d.severity === "warning" ? "cảnh báo" : "ghi chú" }),
        h("span", { class: "lc", text: (d.file ? d.file.split("/").pop() : "") + (d.line ? ":" + d.line + (d.col ? ":" + d.col : "") : "") }),
        h("span", { class: "ms", text: d.message })
      ]);
      function go() {
        var it = S().item; if (!it) return;
        var path = it.files.filter(function (f) { return A.sameFile(d.file, f.path); }).map(function (f) { return f.path; })[0] || A.mainFile();
        if (path) A.showFile(path, d.line || 1, d.col || 1);
      }
      li.addEventListener("click", go);
      li.addEventListener("keydown", function (e) { if (e.key === "Enter") go(); });
      ul.appendChild(li);
    });
    b.appendChild(ul);
  }

  /* ---------------- Dữ liệu vào ---------------- */
  function renderInput(b) {
    var it = S().item;
    if (!it) { b.appendChild(h("p", { class: "cs-runst", text: "Mở một đoạn mã/dự án trước." })); return; }
    var meta = it.meta = it.meta || {};
    var stdin = h("textarea", { class: "inp", spellcheck: "false", placeholder: "Dữ liệu cấp cho chương trình qua stdin…", "aria-label": "Dữ liệu vào (stdin)" });
    stdin.value = meta.stdin || "";
    var args = h("input", { class: "inp", type: "text", spellcheck: "false", placeholder: "vd: 10 input.txt --verbose", "aria-label": "Tham số dòng lệnh" });
    args.value = (meta.args || []).join(" ");
    /* ghi vào meta NGAY (bấm Chạy liền sau khi gõ vẫn thấy dữ liệu mới); markDirty đã tự gom việc lưu */
    stdin.addEventListener("input", function () { meta.stdin = stdin.value.slice(0, 65536); A.markDirty(); });
    args.addEventListener("input", function () { meta.args = splitArgs(args.value).slice(0, 16); A.markDirty(); });
    b.appendChild(h("div", { class: "cs-io" }, [
      h("label", { class: "fld" }, [h("span", { text: "Dữ liệu vào (stdin) — lưu cùng đoạn mã/dự án" }), stdin]),
      h("div", { style: { display: "grid", gap: "10px", alignContent: "start" } }, [
        h("label", { class: "fld" }, [h("span", { text: "Tham số dòng lệnh (argv)" }), args]),
        h("p", { class: "cs-note", text: "Đặt trong nháy để giữ dấu cách: \"hai từ\". Tối đa 64 KB stdin, 16 tham số. Tham số không qua shell nên an toàn." }),
        h("div", { class: "row", style: { display: "flex", gap: "6px", flexWrap: "wrap" } }, [
          h("button", { type: "button", class: "btn sm", text: "Nạp từ tệp…", onclick: function () { U.pickFiles(".txt,.in,text/plain", false).then(function (fs) { if (fs[0]) U.readText(fs[0]).then(function (t) { stdin.value = t.slice(0, 65536); meta.stdin = stdin.value; A.markDirty(); }); }); } }),
          h("button", { type: "button", class: "btn sm", text: "Xoá", onclick: function () { stdin.value = ""; meta.stdin = ""; A.markDirty(); } })
        ])
      ])
    ]));
  }
  function splitArgs(s) {
    var out = [], re = /"((?:[^"\\]|\\.)*)"|'([^']*)'|(\S+)/g, m;
    while ((m = re.exec(s))) out.push(m[1] != null ? m[1].replace(/\\(.)/g, "$1") : m[2] != null ? m[2] : m[3]);
    return out;
  }

  /* ---------------- Cấu hình chạy ---------------- */
  function renderConfig(b) {
    var it = S().item;
    if (!it) { b.appendChild(h("p", { class: "cs-runst", text: "Mở một đoạn mã/dự án trước." })); return; }
    var meta = it.meta = it.meta || {}, lang = A.runLang(), st = S().settings.run;
    var grid = h("div", { class: "cs-cfg" });
    /* nơi chạy */
    var tsel = h("select", { class: "sel", "aria-label": "Nơi chạy" });
    A.targetsFor(lang).forEach(function (t) { tsel.appendChild(h("option", { value: t.id, text: (t.label || t.id) + (t.available === false ? " — không dùng được" : ""), disabled: t.available === false ? true : null })); });
    var cur = A.currentTarget(lang); if (cur) tsel.value = cur.id;
    tsel.addEventListener("change", function () { st.target[lang] = tsel.value; U.lsSet("cs:settings", S().settings); A.renderTargets(); A.renderStatus(); render(); });
    grid.appendChild(h("label", { class: "fld" }, [h("span", { text: "Nơi chạy (" + CS.langs.get(lang).name + ")" }), tsel]));
    /* tệp chính */
    var msel = h("select", { class: "sel", "aria-label": "Tệp chính" });
    it.files.forEach(function (f) { if (CS.langs.byFilename(f.path) !== "plaintext") msel.appendChild(h("option", { value: f.path, text: f.path })); });
    msel.value = A.mainFile() || "";
    msel.addEventListener("change", function () { meta.mainFile = msel.value; A.markDirty(); A.renderTabs(); A.renderTargets(); A.renderStatus(); render(); });
    grid.appendChild(h("label", { class: "fld" }, [h("span", { text: "Tệp chính (điểm vào)" }), msel]));
    /* chuẩn + tối ưu (C/C++) */
    if (lang === "c" || lang === "cpp") {
      var stds = lang === "c" ? ["c11", "c17", "c2x"] : ["c++11", "c++14", "c++17", "c++20", "c++23"];
      var ssel = h("select", { class: "sel", "aria-label": "Chuẩn ngôn ngữ" });
      stds.forEach(function (s) { ssel.appendChild(h("option", { value: s, text: s.toUpperCase() })); });
      ssel.value = meta.std || st.std[lang];
      ssel.addEventListener("change", function () { meta.std = ssel.value; A.markDirty(); });
      grid.appendChild(h("label", { class: "fld" }, [h("span", { text: "Chuẩn" }), ssel]));
      var osel = h("select", { class: "sel", "aria-label": "Mức tối ưu hoá" });
      ["O0", "O1", "O2", "O3"].forEach(function (x) { osel.appendChild(h("option", { value: x, text: "-" + x })); });
      osel.value = meta.opt || st.opt;
      osel.addEventListener("change", function () { meta.opt = osel.value; A.markDirty(); });
      grid.appendChild(h("label", { class: "fld" }, [h("span", { text: "Tối ưu" }), osel]));
    }
    /* giới hạn thời gian */
    var tl = h("select", { class: "sel", "aria-label": "Giới hạn thời gian chạy" });
    [[2000, "2 giây"], [5000, "5 giây"], [10000, "10 giây"], [15000, "15 giây (trần máy chủ)"], [30000, "30 giây (chỉ trình duyệt)"]].forEach(function (x) { tl.appendChild(h("option", { value: String(x[0]), text: x[1] })); });
    tl.value = String(meta.runTimeoutMs || st.runTimeoutMs);
    tl.addEventListener("change", function () { meta.runTimeoutMs = +tl.value; A.markDirty(); });
    grid.appendChild(h("label", { class: "fld" }, [h("span", { text: "Giới hạn thời gian chạy" }), tl]));
    var clr = h("input", { type: "checkbox" }); clr.checked = !!st.clearOnRun;
    clr.addEventListener("change", function () { st.clearOnRun = clr.checked; U.lsSet("cs:settings", S().settings); });
    grid.appendChild(h("label", { class: "cs-chk" }, [clr, h("span", { text: "Xoá kết quả cũ mỗi lần chạy" })]));
    b.appendChild(grid);
    var t = A.currentTarget(lang);
    b.appendChild(h("p", { class: "cs-note", style: { padding: "0 12px 12px" }, text: explain(t ? t.id : "") }));
  }
  function explain(id) {
    if (id === "browser") return "Trong trình duyệt: mã không rời máy bạn. C/C++ dùng Clang→WebAssembly (tải ≈ 25 MB lần đầu), Python dùng Pyodide (≈ 10 MB lần đầu), JavaScript chạy ngay. Không ngoại lệ C++ / không luồng / không tệp.";
    if (id === "piston-custom") return "Gửi thẳng từ trình duyệt tới máy Piston bạn tự dựng (đặt URL ở Cài đặt › Chạy mã). Máy đó phải cho phép CORS.";
    if (/^server:local/.test(id)) return "Máy chủ cục bộ: biên dịch bằng g++/javac/python… cài trên máy chạy backend. Cần khoá quản trị. KHÔNG phải sandbox — chỉ dùng trên máy của chính bạn.";
    if (/^server:/.test(id)) return "Máy chủ: backend chuyển mã tới dịch vụ chạy mã đã cấu hình (" + id.slice(7) + "). Mã nguồn của bạn được gửi tới dịch vụ đó; giới hạn 20 lượt/phút.";
    if (id === "preview") return "HTML được xem trước trong khung cách ly (sandbox); CSS/JS của dự án được nhúng vào.";
    return "";
  }

  A.panel = { init: init, render: render, startRun: startRun, progress: progress, showResult: showResult, failRun: failRun, cancelled: cancelled, clear: clear, note: note, splitArgs: splitArgs };
  A.renderPanel = render;
})(window);
