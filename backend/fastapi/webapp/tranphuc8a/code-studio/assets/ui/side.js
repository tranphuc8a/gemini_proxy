/* side.js — thanh bên của Code Studio: Tệp (cây thư mục của dự án), Thư viện (mọi đoạn mã & dự án), Tìm trong dự án.
   Thao tác cấu trúc dự án đi qua CS.project (thuần, có kiểm tên tệp theo luật của máy chủ). Gắn vào CS.app.side. */
(function (root) {
  "use strict";
  var CS = root.CS, U = CS.dom, h = U.h, A = CS.app;
  var expanded = {}, libFilter = { q: "", kind: "all", lang: "" }, searchState = { q: "", cs: false, re: false };
  var els = {};

  function S() { return A.S; }
  function init() {
    els.side = A.els.side; els.head = U.$(".cs-shead .t", els.side); els.acts = U.$(".cs-shead .acts", els.side);
    els.body = U.$(".cs-sbody", els.side); els.foot = U.$(".cs-sfoot", els.side);
    els.body.addEventListener("contextmenu", function (e) { if (S().settings.side === "explorer") rootMenu(e); });   /* một lần; chỉ ở thẻ Tệp */
    els.body.addEventListener("dragover", function (e) { if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], "Files") >= 0 && S().settings.side === "explorer") { e.preventDefault(); } });
    els.body.addEventListener("drop", function (e) {
      if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length || S().settings.side !== "explorer") return;
      e.preventDefault();
      var dirEl = e.target.closest("[data-dir]");
      uploadFiles(Array.prototype.slice.call(e.dataTransfer.files), dirEl ? dirEl.getAttribute("data-dir") : "");
    });
  }
  function render() {
    if (!els.side) return;
    var which = S().settings.side;
    els.acts.innerHTML = ""; els.body.innerHTML = ""; els.foot.hidden = true; els.foot.innerHTML = "";
    if (which === "library") return renderLibrary();
    if (which === "search") return renderSearch();
    renderExplorer();
  }
  function act(icon, title, fn) { var b = h("button", { type: "button", class: "ic", title: title, "aria-label": title, html: A.ic(icon) }); b.addEventListener("click", fn); els.acts.appendChild(b); return b; }

  /* ================================================================ Tệp */
  function treeOf(item) {
    if (CS.project && CS.project.tree) return CS.project.tree(item);
    var rootN = { children: [] };
    item.files.forEach(function (f) {
      var parts = f.path.split("/"), cur = rootN, path = "";
      parts.forEach(function (p, i) {
        path = path ? path + "/" + p : p;
        var last = i === parts.length - 1, kid = cur.children.filter(function (c) { return c.name === p; })[0];
        if (!kid) { kid = { name: p, path: path, type: last ? "file" : "dir", children: last ? undefined : [] }; cur.children.push(kid); }
        cur = kid;
      });
    });
    return rootN.children;
  }
  function renderExplorer() {
    var it = S().item;
    els.head.textContent = it ? it.name : "Tệp";
    if (!it) { els.body.appendChild(h("p", { class: "cs-note", style: { padding: "10px 12px" }, text: "Chưa mở đoạn mã/dự án nào. Mở thư viện (Ctrl+O) hoặc tạo mới." })); return; }
    act("plus", "Tệp mới (Ctrl+Alt+N)", function () { newFile(""); });
    act("folderPlus", "Thư mục mới", function () { newFolder(""); });
    act("upload", "Tải tệp lên dự án", function () { U.pickFiles("", true).then(function (fs) { uploadFiles(fs, ""); }); });
    act("collapse", "Thu gọn tất cả", function () { expanded = {}; render(); });
    var ul = h("ul", { class: "cs-tree", role: "tree", "aria-label": "Tệp của dự án" });
    var key = it.id;
    expanded[key] = expanded[key] || {};
    var main = A.mainFile(), errs = {};
    (S().diags || []).forEach(function (d) { if (d.severity !== "error") return; var p = it.files.filter(function (f) { return A.sameFile(d.file, f.path); }).map(function (f) { return f.path; })[0] || main; errs[p] = (errs[p] || 0) + 1; });
    function add(nodes, parent, depth) {
      nodes.forEach(function (n) {
        var li = h("li", { role: "treeitem", "aria-expanded": n.type === "dir" ? String(!!expanded[key][n.path] || depth === 0 && n.children && n.children.length <= 8 && expanded[key][n.path] !== false) : null });
        var isOpen = n.type === "dir" && (expanded[key][n.path] === true || (expanded[key][n.path] === undefined && depth < 2));
        var lang = n.type === "file" ? CS.langs.byFilename(n.path) : "";
        var btn = h("button", { type: "button", class: "cs-node", draggable: "true", "data-path": n.path, "data-dir": n.type === "dir" ? n.path : (n.path.indexOf("/") >= 0 ? n.path.slice(0, n.path.lastIndexOf("/")) : ""),
          "aria-current": n.path === S().active ? "true" : null, style: { paddingLeft: (8 + depth * 14) + "px" }, title: n.path }, [
          h("span", { class: "tw", text: n.type === "dir" ? (isOpen ? "▾" : "▸") : "" }),
          n.type === "dir" ? h("span", { class: "fi d", text: isOpen ? "📂" : "📁" }) : h("span", { class: "fi " + lang, text: (CS.langs.get(lang).exts[0] || "").slice(0, 3).toUpperCase() }),
          h("span", { class: "nm", text: n.name }),
          errs[n.path] ? h("span", { class: "err", text: String(errs[n.path]), title: errs[n.path] + " lỗi" }) : (n.path === main && it.files.length > 1 ? h("span", { class: "badge", text: "CHÍNH", title: "Tệp chính khi chạy" }) : null)
        ]);
        btn.addEventListener("click", function () {
          if (n.type === "dir") { expanded[key][n.path] = !isOpen; render(); }
          else { A.showFile(n.path); if (root.innerWidth <= 760) A.closeDrawer(); }
        });
        btn.addEventListener("contextmenu", function (e) { e.preventDefault(); nodeMenu(n, { x: e.clientX, y: e.clientY }); });
        btn.addEventListener("keydown", function (e) {
          if (e.key === "F2") { e.preventDefault(); renamePath(n); }
          else if (e.key === "Delete") { e.preventDefault(); deletePath(n); }
          else if ((e.shiftKey && e.key === "F10") || e.key === "ContextMenu") { e.preventDefault(); nodeMenu(n, btn); }
        });
        btn.addEventListener("dragstart", function (e) { e.dataTransfer.setData("text/x-cs-path", n.path); e.dataTransfer.effectAllowed = "move"; });
        if (n.type === "dir") {
          btn.addEventListener("dragover", function (e) { if (Array.prototype.indexOf.call(e.dataTransfer.types || [], "text/x-cs-path") >= 0) { e.preventDefault(); btn.classList.add("drop"); } });
          btn.addEventListener("dragleave", function () { btn.classList.remove("drop"); });
          btn.addEventListener("drop", function (e) {
            var from = e.dataTransfer.getData("text/x-cs-path"); btn.classList.remove("drop");
            if (!from) return;
            e.preventDefault(); e.stopPropagation();
            movePath(from, n.path + "/" + from.split("/").pop());
          });
        }
        li.appendChild(btn);
        if (n.type === "dir" && isOpen && n.children && n.children.length) { var sub = h("ul", { role: "group" }); add(n.children, sub, depth + 1); li.appendChild(sub); }
        parent.appendChild(li);
      });
    }
    add(treeOf(it), ul, 0);
    els.body.appendChild(ul);
    /* chân: tóm tắt */
    var total = it.files.reduce(function (a, f) { return a + new Blob([f.content]).size; }, 0);
    els.foot.hidden = false;
    els.foot.appendChild(h("div", { text: it.files.length + " tệp · " + U.fmtBytes(total) + (main && it.files.length > 1 ? " · chạy: " + main : "") }));
  }
  function rootMenu(e) {
    if (e.target.closest(".cs-node")) return;
    e.preventDefault();
    U.menu({ x: e.clientX, y: e.clientY }, [{ label: "Tệp mới…", onclick: function () { newFile(""); } }, { label: "Thư mục mới…", onclick: function () { newFolder(""); } }, { label: "Tải tệp lên…", onclick: function () { U.pickFiles("", true).then(function (fs) { uploadFiles(fs, ""); }); } }]);
  }
  function nodeMenu(n, at) {
    var items = [];
    if (n.type === "file") {
      items.push({ label: "Mở", onclick: function () { A.showFile(n.path); } });
      items.push({ label: "Đặt làm tệp chính (chạy tệp này)", disabled: n.path === A.mainFile(), onclick: function () { S().item.meta.mainFile = n.path; A.markDirty(); A.renderTabs(); A.renderTargets(); A.renderStatus(); render(); } });
      items.push("-");
      items.push({ label: "Đổi tên…", kbd: "F2", onclick: function () { renamePath(n); } });
      items.push({ label: "Nhân đôi", onclick: function () { duplicateFile(n.path); } });
      items.push({ label: "Tải xuống", onclick: function () { var f = A.fileOf(n.path); U.download(n.name, f.content); } });
      items.push({ label: "Chép đường dẫn", onclick: function () { U.copy(n.path); } });
      items.push("-");
      items.push({ label: "Xoá", kbd: "Delete", danger: true, onclick: function () { deletePath(n); } });
    } else {
      items.push({ label: "Tệp mới trong thư mục…", onclick: function () { newFile(n.path); } });
      items.push({ label: "Thư mục con mới…", onclick: function () { newFolder(n.path); } });
      items.push({ label: "Tải tệp lên vào đây…", onclick: function () { U.pickFiles("", true).then(function (fs) { uploadFiles(fs, n.path); }); } });
      items.push("-");
      items.push({ label: "Đổi tên…", kbd: "F2", onclick: function () { renamePath(n); } });
      items.push({ label: "Xoá thư mục", danger: true, onclick: function () { deletePath(n); } });
    }
    U.menu(at, items);
  }
  function validPath(p) { try { return CS.project && CS.project.normPath ? (CS.project.normPath(p), "") : (/^[A-Za-z0-9_.\-/]+$/.test(p) && p.indexOf("..") < 0 ? "" : "Tên chỉ gồm chữ không dấu, số, _ . - và / cho thư mục"); } catch (e) { return e.message; } }
  function exists(p) { var low = p.toLowerCase(); return S().item.files.some(function (f) { return f.path.toLowerCase() === low; }); }
  function apply(fn) {
    try { var res = fn(S().item); if (res) S().item = res; } catch (e) { U.toast(e.message || String(e), "bad"); return false; }
    if (S().item.files.length > 1 && S().item.kind === "snippet") S().item.kind = "project";
    A.markDirty(); A.renderAll();
    return true;
  }
  function defaultExt() { var l = A.runLang() || "plaintext"; return (CS.langs.get(l).exts[0] || "txt"); }
  function newFile(dir) {
    if (!S().item) return A.cmd("new-snippet");
    var sug = (dir ? dir + "/" : "") + "moi." + defaultExt();
    U.prompt("Tệp mới", "Đường dẫn (vd src/util.cpp, include/util.h)", sug, function (v) { return !v ? "Hãy nhập tên tệp" : validPath(v) || (exists(v) ? "Đã có tệp này" : ""); }, "Tạo").then(function (p) {
      if (!p) return;
      var content = templateFor(p);
      if (apply(function (it) { return CS.project && CS.project.addFile ? CS.project.addFile(it, p, content) : (it.files.push({ path: p, content: content }), it); })) A.showFile(CS.project && CS.project.normPath ? CS.project.normPath(p) : p);
    });
  }
  function templateFor(p) {
    var name = p.split("/").pop(), base = name.replace(/\.[^.]+$/, ""), lang = CS.langs.byFilename(p);
    if (/\.(h|hpp|hh)$/i.test(name)) { var g = base.toUpperCase().replace(/[^A-Z0-9]/g, "_") + "_H"; return "#ifndef " + g + "\n#define " + g + "\n\n\n\n#endif\n"; }
    if (lang === "java") { var dir = p.indexOf("/") >= 0 ? p.slice(0, p.lastIndexOf("/")) : "", pk = dir.replace(/^src\/(main\/java\/)?/, "").replace(/\//g, "."); return (pk && pk !== dir.replace(/\//g, ".") || /^src\//.test(dir) ? (pk ? "package " + pk + ";\n\n" : "") : "") + "public class " + base + " {\n\n}\n"; }
    return "";
  }
  function newFolder(dir) {
    if (!S().item) return;
    U.prompt("Thư mục mới", "Đường dẫn thư mục", (dir ? dir + "/" : ""), function (v) { return !v ? "Hãy nhập tên thư mục" : validPath(v); }, "Tạo").then(function (p) {
      if (!p) return;
      p = p.replace(/\/+$/, "");
      expanded[S().item.id] = expanded[S().item.id] || {}; expanded[S().item.id][p] = true;
      apply(function (it) { if (CS.project && CS.project.addFolder) return CS.project.addFolder(it, p); it.meta.folders = (it.meta.folders || []).concat([p]); return it; });
    });
  }
  function renamePath(n) {
    U.prompt(n.type === "dir" ? "Đổi tên thư mục" : "Đổi tên tệp", "Đường dẫn mới", n.path, function (v) { return !v ? "Không được để trống" : validPath(v) || (v.toLowerCase() !== n.path.toLowerCase() && exists(v) ? "Đã có tệp này" : ""); }, "Đổi").then(function (p) {
      if (!p || p === n.path) return;
      movePath(n.path, p);
    });
  }
  function movePath(from, to) {
    if (from === to || to.indexOf(from + "/") === 0) return;
    var st = S(), tabs = st.tabs.slice(), active = st.active, main = st.item.meta.mainFile;
    var ok = apply(function (it) {
      if (CS.project && CS.project.rename) return CS.project.rename(it, from, to);
      it.files.forEach(function (f) { if (f.path === from) f.path = to; else if (f.path.indexOf(from + "/") === 0) f.path = to + f.path.slice(from.length); });
      return it;
    });
    if (!ok) return;
    function mv(p) { return p === from ? to : (p && p.indexOf(from + "/") === 0 ? to + p.slice(from.length) : p); }
    st.tabs = tabs.map(mv); st.active = mv(active);
    if (main) st.item.meta.mainFile = mv(main);
    A.renderAll();
    if (st.active) A.showFile(st.active);
  }
  function duplicateFile(path) {
    var f = A.fileOf(path), dot = path.lastIndexOf("."), base = dot > path.lastIndexOf("/") ? path.slice(0, dot) : path, ext = dot > path.lastIndexOf("/") ? path.slice(dot) : "", k = 1, p;
    do { p = base + "_" + (++k) + ext; } while (exists(p));
    if (apply(function (it) { return CS.project && CS.project.addFile ? CS.project.addFile(it, p, f.content) : (it.files.push({ path: p, content: f.content }), it); })) A.showFile(p);
  }
  function deletePath(n) {
    var it = S().item, count = n.type === "dir" ? it.files.filter(function (f) { return f.path.indexOf(n.path + "/") === 0; }).length : 1;
    if (n.type === "file" && it.files.length === 1) { U.toast("Không xoá được tệp duy nhất — hãy xoá cả đoạn mã ở Thư viện", "bad"); return; }
    U.confirm("Xoá “" + n.path + "”?", n.type === "dir" ? "Thư mục và " + count + " tệp bên trong sẽ bị xoá." : "Tệp sẽ bị xoá khỏi dự án.", "Xoá", true).then(function (ok) {
      if (!ok) return;
      var st = S();
      if (!apply(function (x) {
        if (CS.project && CS.project.remove) return CS.project.remove(x, n.path);
        x.files = x.files.filter(function (f) { return f.path !== n.path && f.path.indexOf(n.path + "/") !== 0; }); return x;
      })) return;
      st.tabs = st.tabs.filter(function (p) { return A.fileOf(p); });
      if (!A.fileOf(st.active)) { st.active = null; if (st.tabs[0]) A.showFile(st.tabs[0]); else if (st.item.files[0]) A.showFile(st.item.files[0].path); }
      A.renderAll();
    });
  }
  function uploadFiles(files, dir) {
    if (!files || !files.length || !S().item) return;
    var zip = files.filter(function (f) { return /\.zip$/i.test(f.name); });
    if (zip.length && A.dialogs) { A.dialogs.importZip(zip[0]); return; }
    Promise.all(files.map(function (f) { return f.size > 512 * 1024 ? Promise.resolve(null) : U.readText(f).then(function (t) { return { name: (f.webkitRelativePath || f.name), text: t }; }); })).then(function (list) {
      var added = 0, skipped = 0, last = null;
      list.forEach(function (x) {
        if (!x) { skipped++; return; }
        var p = (dir ? dir + "/" : "") + x.name.replace(/\\/g, "/");
        if (validPath(p)) { skipped++; return; }
        if (exists(p)) { apply(function (it) { return CS.project && CS.project.setContent ? CS.project.setContent(it, p, x.text) : (A.fileOf(p).content = x.text, it); }); }
        else apply(function (it) { return CS.project && CS.project.addFile ? CS.project.addFile(it, p, x.text) : (it.files.push({ path: p, content: x.text }), it); });
        added++; last = p;
      });
      if (last) A.showFile(CS.project && CS.project.normPath ? CS.project.normPath(last) : last);
      U.toast("Đã thêm " + added + " tệp" + (skipped ? ", bỏ qua " + skipped + " tệp (quá 512 KB hoặc tên không hợp lệ)" : ""), skipped ? "" : "ok");
    });
  }
  function markActive() { if (S().settings.side === "explorer") U.$$(".cs-node", els.body).forEach(function (b) { b.setAttribute("aria-current", String(b.getAttribute("data-path") === S().active)); }); }

  /* ================================================================ Thư viện */
  var libCache = [];
  function renderLibrary() {
    els.head.textContent = "Thư viện";
    act("plus", "Đoạn mã mới (Ctrl+N)", function () { A.cmd("new-snippet"); });
    act("folderPlus", "Dự án mới", function () { A.cmd("new-project"); });
    act("upload", "Nhập .zip / tệp / bản sao lưu", function () { A.cmd("import"); });
    act("more", "Thêm", function (e) {
      U.menu(e.currentTarget || els.acts.lastChild, [
        { label: "Xuất bản sao lưu toàn bộ (.json)", onclick: function () { A.cmd("export-all"); } },
        { label: "Khôi phục từ bản sao lưu…", onclick: function () { A.cmd("import"); } },
        "-",
        { label: "Nơi lưu & đồng bộ…", onclick: function () { A.cmd("storage"); } }
      ]);
    });
    var q = h("input", { type: "search", class: "inp", placeholder: "Tìm theo tên, ngôn ngữ, nội dung…", "aria-label": "Tìm trong thư viện", value: libFilter.q });
    var chips = h("div", { class: "cs-chips", role: "group", "aria-label": "Lọc" });
    [["all", "Tất cả"], ["snippet", "Đoạn mã"], ["project", "Dự án"], ["pinned", "📌 Ghim"]].forEach(function (c) {
      chips.appendChild(h("button", { type: "button", class: "chip", "aria-pressed": String(libFilter.kind === c[0]), text: c[1], onclick: function () { libFilter.kind = c[0]; render(); } }));
    });
    var lsel = h("select", { class: "sel", "aria-label": "Lọc theo ngôn ngữ", style: { maxWidth: "100%" } }, [h("option", { value: "", text: "Mọi ngôn ngữ" })].concat(CS.langs.list().map(function (l) { return h("option", { value: l.id, text: l.name }); })));
    lsel.value = libFilter.lang;
    lsel.addEventListener("change", function () { libFilter.lang = lsel.value; drawList(); });
    els.body.appendChild(h("div", { class: "cs-lib-tools" }, [q, chips, lsel]));
    var list = h("ul", { class: "cs-items", "aria-label": "Đoạn mã và dự án" });
    els.body.appendChild(list);
    var veLai = U.debounce(function () { drawList(); }, 120);
    q.addEventListener("input", function () { libFilter.q = q.value; veLai(); });          /* trạng thái lọc cập nhật ngay; chỉ việc vẽ lại mới gom */
    function drawList() {
      var words = libFilter.q.toLowerCase().split(/\s+/).filter(Boolean);
      var items = libCache.filter(function (x) {
        if (libFilter.kind === "pinned" && !(x.meta && x.meta.pinned)) return false;
        if ((libFilter.kind === "snippet" || libFilter.kind === "project") && x.kind !== libFilter.kind) return false;
        if (libFilter.lang && x.language !== libFilter.lang) return false;
        if (!words.length) return true;
        var hay = (x.name + " " + x.language + " " + ((x.meta && x.meta.tags) || []).join(" ")).toLowerCase(), body = null;
        return words.every(function (w) { if (hay.indexOf(w) >= 0) return true; if (body === null) body = x.files.map(function (f) { return f.path + "\n" + f.content.slice(0, 20000); }).join("\n").toLowerCase(); return body.indexOf(w) >= 0; });
      });
      list.innerHTML = "";
      if (!items.length) { list.appendChild(h("li", { class: "cs-note", style: { padding: "8px" }, text: libCache.length ? "Không có mục nào khớp." : "Thư viện trống — tạo đoạn mã hay dự án đầu tiên." })); return; }
      items.forEach(function (x) {
        var lang = x.language || "plaintext";
        var b = h("button", { type: "button", class: "cs-item", "aria-current": S().item && S().item.id === x.id ? "true" : null, title: x.name }, [
          h("span", { class: "fi " + lang, text: (CS.langs.get(lang).exts[0] || "").slice(0, 3).toUpperCase() }),
          h("span", { class: "t", text: x.name }),
          h("span", {}, [x.meta && x.meta.pinned ? h("span", { class: "pin", text: "📌", title: "Đã ghim" }) : null]),
          h("span", { class: "m", text: (x.kind === "project" ? "Dự án · " + x.files.length + " tệp" : "Đoạn mã") + " · " + CS.langs.get(lang).name + " · " + U.fmtTime(x.updatedAt) })
        ]);
        b.addEventListener("click", function () { A.openItem(x); });
        b.addEventListener("contextmenu", function (e) { e.preventDefault(); itemMenu(x, { x: e.clientX, y: e.clientY }); });
        b.addEventListener("keydown", function (e) { if (e.key === "Delete") { e.preventDefault(); deleteItem(x); } else if (e.key === "F2") { e.preventDefault(); renameItem(x); } else if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) { e.preventDefault(); itemMenu(x, b); } });
        var li = h("li", {}, [b]);
        list.appendChild(li);
      });
    }
    A.Store.list().then(function (items) { libCache = items || []; drawList(); });
    refreshLibraryFoot();
  }
  function refreshLibraryFoot() {
    if (S().settings.side !== "library" || !els.foot) return;
    els.foot.hidden = false; els.foot.innerHTML = "";
    var sy = A.Store.syncStatus(), mode = S().settings.storage.mode;
    var dot = h("span", { class: "dotst " + (sy ? (sy.status === "error" || sy.status === "offline" ? "bad" : sy.status === "syncing" ? "busy" : "ok") : "") });
    var txt = !sy ? "Lưu trên máy này (" + (mode === "server" ? "chưa kết nối máy chủ" : "chưa đồng bộ") + ")" : sy.status === "error" ? "Lỗi đồng bộ: " + sy.error : sy.status === "offline" ? "Mất mạng — sẽ đồng bộ lại sau" : sy.status === "syncing" ? "Đang đồng bộ…" : "Đã đồng bộ (" + S().settings.storage.backend + ")";
    els.foot.appendChild(h("div", { class: "cs-sync" }, [dot, h("span", { text: txt })]));
    els.foot.appendChild(h("div", { style: { display: "flex", gap: "6px", flexWrap: "wrap" } }, [
      sy ? h("button", { type: "button", class: "btn sm", text: "Đồng bộ ngay", onclick: function () { A.cmd("sync"); } }) : null,
      h("button", { type: "button", class: "btn sm", text: "Nơi lưu & đồng bộ…", onclick: function () { A.cmd("storage"); } })
    ]));
  }
  function itemMenu(x, at) {
    var pinned = !!(x.meta && x.meta.pinned);
    U.menu(at, [
      { label: "Mở", onclick: function () { A.openItem(x); } },
      { label: "Đổi tên…", kbd: "F2", onclick: function () { renameItem(x); } },
      { label: pinned ? "Bỏ ghim" : "Ghim lên đầu", onclick: function () { updateItem(x, function (y) { y.meta = y.meta || {}; y.meta.pinned = !pinned; }); } },
      { label: "Nhân đôi", onclick: function () { duplicateItem(x); } },
      { label: "Xuất .zip", onclick: function () { if (A.dialogs) A.dialogs.exportZip(x); } },
      "-",
      { label: "Xoá", kbd: "Delete", danger: true, onclick: function () { deleteItem(x); } }
    ]);
  }
  function updateItem(x, fn) {
    var cur = S().item && S().item.id === x.id;
    var y = JSON.parse(JSON.stringify(cur ? S().item : x));
    fn(y);
    if (cur) { fn(S().item); A.markDirty(); A.saveNow().then(render); A.renderAll(); return; }
    A.Store.put(y).then(render);
  }
  function renameItem(x) {
    U.prompt("Đổi tên", "Tên mới", x.name, function (v) { return v ? "" : "Không được để trống"; }, "Đổi").then(function (v) { if (v) updateItem(x, function (y) { y.name = v.slice(0, 200); }); });
  }
  function duplicateItem(x) {
    var y = JSON.parse(JSON.stringify(S().item && S().item.id === x.id ? S().item : x));
    y.id = CS.project && CS.project.newId ? CS.project.newId() : "i" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    y.name = x.name + " (bản sao)"; y.updatedAt = 0; y.meta = y.meta || {}; y.meta.pinned = false;
    A.Store.put(y).then(function (saved) { U.toast("Đã nhân đôi", "ok"); A.openItem(saved || y); });
  }
  function deleteItem(x) {
    U.confirm("Xoá “" + x.name + "”?", x.kind === "project" ? "Cả dự án (" + x.files.length + " tệp) sẽ bị xoá" + (A.Store.connected() ? " — trên mọi thiết bị đã đồng bộ." : " khỏi máy này.") : "Đoạn mã sẽ bị xoá" + (A.Store.connected() ? " trên mọi thiết bị đã đồng bộ." : " khỏi máy này."), "Xoá", true).then(function (ok) {
      if (!ok) return;
      var wasOpen = S().item && S().item.id === x.id;
      if (wasOpen) { S().dirty = false; S().item = null; }
      A.Store.remove(x.id).then(function () { U.toast("Đã xoá “" + x.name + "”"); if (wasOpen) A.openItem(null); render(); });
    });
  }

  /* ================================================================ Tìm trong dự án */
  function renderSearch() {
    els.head.textContent = "Tìm trong dự án";
    var it = S().item;
    var q = h("input", { type: "search", class: "inp", placeholder: "Tìm…", "aria-label": "Tìm trong mọi tệp của dự án", value: searchState.q });
    var cs = h("button", { type: "button", class: "chip", "aria-pressed": String(searchState.cs), text: "Aa", title: "Phân biệt hoa/thường" });
    var re = h("button", { type: "button", class: "chip", "aria-pressed": String(searchState.re), text: ".*", title: "Biểu thức chính quy" });
    var res = h("div", { "aria-live": "polite" });
    els.body.appendChild(h("div", { class: "cs-lib-tools" }, [q, h("div", { class: "cs-chips" }, [cs, re])]));
    els.body.appendChild(res);
    cs.addEventListener("click", function () { searchState.cs = !searchState.cs; cs.setAttribute("aria-pressed", String(searchState.cs)); run(); });
    re.addEventListener("click", function () { searchState.re = !searchState.re; re.setAttribute("aria-pressed", String(searchState.re)); run(); });
    q.addEventListener("input", U.debounce(function () { searchState.q = q.value; run(); }, 160));
    function run() {
      res.innerHTML = "";
      if (!it || !searchState.q) { res.appendChild(h("p", { class: "cs-note", style: { padding: "0 12px" }, text: it ? "Gõ để tìm trong mọi tệp của dự án." : "Mở một dự án trước." })); return; }
      var rx;
      try { rx = new RegExp(searchState.re ? searchState.q : searchState.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g" + (searchState.cs ? "" : "i")); }
      catch (e) { res.appendChild(h("p", { class: "cs-err", style: { padding: "0 12px" }, text: "Biểu thức sai: " + e.message })); return; }
      var total = 0;
      it.files.forEach(function (f) {
        var lines = f.content.split("\n"), hits = [];
        lines.forEach(function (ln, i) { rx.lastIndex = 0; var m = rx.exec(ln); if (m && hits.length < 200) hits.push({ line: i + 1, col: m.index + 1, text: ln.trim().slice(0, 160) }); });
        if (!hits.length) return;
        total += hits.length;
        var grp = h("div", {}, [h("div", { class: "cs-shead", style: { textTransform: "none", letterSpacing: 0, fontSize: "12px" }, text: f.path + " (" + hits.length + ")" })]);
        hits.forEach(function (hh) {
          var b = h("button", { type: "button", class: "cs-node", style: { paddingLeft: "18px", whiteSpace: "nowrap" } }, [h("span", { class: "tw", text: String(hh.line), style: { width: "auto", minWidth: "26px" } }), h("span", { class: "nm", text: hh.text })]);
          b.addEventListener("click", function () { A.showFile(f.path, hh.line, hh.col); if (root.innerWidth <= 760) A.closeDrawer(); });
          grp.appendChild(b);
        });
        res.appendChild(grp);
      });
      if (!total) res.appendChild(h("p", { class: "cs-note", style: { padding: "0 12px" }, text: "Không thấy." }));
    }
    run();
    setTimeout(function () { q.focus(); }, 0);
  }

  var CMDS = { "new-file": function () { newFile(""); }, "new-folder": function () { newFolder(""); } };
  A.side = {
    init: init, render: render, markActive: markActive, refreshLibraryFoot: refreshLibraryFoot,
    onSaved: function () { if (S().settings.side === "library") { A.Store.list().then(function (items) { libCache = items || []; }); } },
    has: function (n) { return !!CMDS[n]; }, run: function (n) { return CMDS[n](); },
    uploadFiles: uploadFiles, reloadLibrary: function () { return A.Store.list().then(function (items) { libCache = items || []; render(); }); }
  };
})(window);
