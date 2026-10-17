/* ui/palette.js — Ctrl+K: tìm MỌI THỨ, không chỉ app.
     * Lệnh       — đổi giao diện, tới tab, ngẫu nhiên, cài đặt… (có khi ô trống: danh sách việc hay làm)
     * Ứng dụng   — cùng cách chấm điểm với ô tìm của cổng (hiểu cả #tag, @thư-mục)
     * Khoá học   — GET /courses (đã xuất bản); Bài học — GET /courses/search (chỉ mục từng khoá); Lab — danh-sach.json
     * Hỏi AI     — POST /ai/ask, chỉ khi máy chủ cho người này dùng AI (courses/engine/ai-khach.js giữ quyền và token)
   Cần Portal.palette.init(api) từ app.js. API gốc lấy từ /webapp/_api/config vì trang cổng là tệp tĩnh (không được chèn cấu hình). */
(function (root) {
  "use strict";
  var P = root.Portal || (root.Portal = {});
  var T = P.text, S = P.search, D = P.dom, icon = D.icon, $ = D.$;
  var api = null, doc = root.document;
  var pal = { open: false, items: [], index: 0, apiBase: null, courses: null, labs: null, ai: null, aiStatus: null, lessons: { query: "", hits: [] }, seq: 0, timer: 0, opener: null };

  var webapp = function () { return new root.URL("../", root.location.href).href.replace(/\/$/, ""); };

  function setup() {
    if (pal.apiBase !== null) return;
    pal.apiBase = "";
    fetch(webapp() + "/_api/config").then(function (r) { return r.json(); }).then(function (c) {
      pal.apiBase = String(c.apiBase || "").replace(/\/+$/, "");
    }, function () { /* cùng origin */ }).then(function () {
      pal.ai = root.AiKhach ? root.AiKhach.tao(pal.apiBase) : null;
      if (pal.ai) pal.ai.trangThai().then(function (s) { pal.aiStatus = s; render(); }, function () { /* AI tắt */ });
      fetch(pal.apiBase + "/courses").then(function (r) { return r.ok ? r.json() : { courses: [] }; }).then(function (d) { pal.courses = d.courses || []; render(); }, function () { pal.courses = []; });
      fetch(webapp() + "/courses/lab-visual/danh-sach.json").then(function (r) { return r.ok ? r.json() : []; }).then(function (l) { pal.labs = Array.isArray(l) ? l : []; render(); }, function () { pal.labs = []; });
    });
  }

  function courseHref(slug, web) {
    var own = web && api.apps().some(function (a) { return a.path === web; });
    return own ? webapp() + "/" + web + "/" : webapp() + "/courses/khoa-hoc/?khoa=" + encodeURIComponent(slug);
  }
  function canAsk() { return !!(pal.ai && pal.ai.dungDuoc(pal.aiStatus)); }

  function textScore(fields, terms) {
    if (!terms.length) return 1;
    var total = 0;
    for (var i = 0; i < terms.length; i++) {
      var best = 0;
      for (var j = 0; j < fields.length; j++) {
        var at = T.fold(fields[j][0]).indexOf(terms[i]);
        if (at >= 0) best = Math.max(best, at === 0 ? fields[j][1] * 1.6 : fields[j][1]);
      }
      if (!best) return 0;
      total += best;
    }
    return total;
  }

  function searchLessons(query) {
    clearTimeout(pal.timer);
    if (T.fold(query).trim().length < 2) { pal.lessons = { query: "", hits: [] }; return; }
    pal.timer = setTimeout(function () {
      var seq = ++pal.seq;
      fetch(pal.apiBase + "/courses/search?limit=8&q=" + encodeURIComponent(query)).then(function (r) { return r.ok ? r.json() : { hits: [] }; }).then(function (d) {
        if (seq !== pal.seq) return;                                                  // đã có câu gõ mới hơn
        pal.lessons = { query: query, hits: d.hits || [] };
        render();
      }, function () { /* offline: các nhóm khác vẫn dùng được */ });
    }, 180);
  }

  function commands() {
    var v = api.view();
    var list = [
      { id: "home", title: "Về Trang chủ", icon: "🏠", run: function () { api.go({ tab: "home" }); } },
      { id: "all", title: "Xem tất cả ứng dụng", icon: "🗂️", run: function () { api.go({ tab: "all" }); } },
      { id: "fav", title: "Xem app yêu thích", icon: "⭐", run: function () { api.go({ tab: "favorites" }); } },
      { id: "random", title: "Mở một app ngẫu nhiên", icon: "🎲", run: function () { api.randomApp(); } },
      { id: "theme", title: "Đổi giao diện sáng / tối", icon: "🌓", run: function () { api.cycleTheme(); } },
      { id: "view", title: "Đổi lưới ⇄ danh sách", icon: "▦", run: function () { api.toggleView(); } },
      { id: "qr", title: "Mở cổng trên điện thoại (mã QR)", icon: "📱", run: function () { P.dialogs.qr(api.portalUrl(), "Mở cổng trên điện thoại"); } },
      { id: "settings", title: "Cài đặt và tiện ích", icon: "⚙️", run: function () { P.dialogs.menu(); } },
      { id: "help", title: "Phím tắt", icon: "⌨️", run: function () { P.dialogs.help(); } }
    ];
    if (api.installState() === "ready") list.unshift({ id: "install", title: "Cài đặt ứng dụng về máy", icon: "⬇️", run: function () { api.promptInstall(); } });
    if (v.q || v.collections.length || v.categories.length || v.tags.length || v.pwa) list.unshift({ id: "clear", title: "Xoá toàn bộ bộ lọc", icon: "🧹", run: function () { api.clearFilters(); } });
    return list.map(function (c) { c.kind = "Lệnh"; c.sub = ""; return c; });
  }

  function buildItems(query) {
    var parsed = S.parseQuery(query), terms = parsed.terms, groups = [], prefs = api.prefs(), hidden = {};
    prefs.hidden.forEach(function (p) { hidden[p] = 1; });
    var apps = api.apps().filter(function (a) { return !hidden[a.path]; });

    if (S.isEmpty(parsed)) {                                                           // ô trống: việc hay làm
      var recent = apps.filter(function (a) { return prefs.usage[a.path]; }).sort(function (x, y) { return prefs.usage[y.path].last - prefs.usage[x.path].last; }).slice(0, 5);
      groups.push(recent.map(function (a) { return { kind: "Gần đây", icon: a.icon, title: a.title, sub: a.label, href: D.appUrl(a), path: a.path }; }));
      groups.push(commands().slice(0, 8));
      return groups.reduce(function (x, y) { return x.concat(y); }, []);
    }

    var hits = apps.map(function (a) { return { a: a, points: S.matchesTokens(a, parsed) ? S.score(a, terms) : 0 }; }).filter(function (e) { return e.points > 0; })
      .sort(function (x, y) { return y.points - x.points || ((prefs.usage[y.a.path] || {}).last || 0) - ((prefs.usage[x.a.path] || {}).last || 0); }).slice(0, terms.length ? 6 : 8);
    groups.push(hits.map(function (e) { return { kind: "Ứng dụng", icon: e.a.icon, title: e.a.title, sub: e.a.desc && !e.a.generic ? e.a.desc : e.a.label, href: D.appUrl(e.a), path: e.a.path }; }));

    var n = T.fold(query).trim();
    groups.push(commands().filter(function (c) { return T.fold(c.title).indexOf(n) !== -1; }).slice(0, 3));

    if (terms.length) {
      groups.push((pal.courses || []).map(function (c) { return { c: c, points: textScore([[c.title, 100], [c.subtitle, 40], [c.description, 15]], terms) }; })
        .filter(function (e) { return e.points > 0; }).sort(function (x, y) { return y.points - x.points; }).slice(0, 4)
        .map(function (e) { return { kind: "Khoá học", icon: e.c.icon || "📘", title: e.c.title, sub: e.c.subtitle || (e.c.docCount || 0) + " bài", href: courseHref(e.c.slug, (e.c.config || {}).webapp) }; }));
      if (pal.lessons.query === query) {
        groups.push(pal.lessons.hits.map(function (x) {
          return { kind: "Bài học", icon: x.courseIcon || "📄", title: x.title, sub: x.courseTitle + " · " + (x.snippet || x.group || ""), href: courseHref(x.course, x.webapp) + "#/" + x.slug };
        }));
      }
      groups.push((pal.labs || []).map(function (l) { return { l: l, points: textScore([[l.ten, 100], [l.id, 60], [l.nhom, 30]], terms) }; })
        .filter(function (e) { return e.points > 0; }).sort(function (x, y) { return y.points - x.points; }).slice(0, 5)
        .map(function (e) { return { kind: "Lab", icon: "🧪", title: e.l.ten, sub: e.l.nhom, href: webapp() + "/courses/lab-visual/#/" + encodeURIComponent(e.l.id) }; }));
    }
    var items = groups.reduce(function (x, y) { return x.concat(y); }, []);
    if (canAsk() && query.trim().split(/\s+/).length >= 2) items.push({ kind: "AI", icon: "✨", title: "Hỏi AI: “" + query.trim() + "”", sub: "Trả lời từ các bài học, kèm nguồn", ask: true });
    return items;
  }

  function render() {
    if (!pal.open || $("#paletteAnswer").hidden === false) return;
    var query = $("#paletteInput").value;
    pal.items = buildItems(query);
    pal.index = Math.min(pal.index, Math.max(0, pal.items.length - 1));
    var terms = S.parseQuery(query).terms, last = "";
    $("#paletteList").innerHTML = pal.items.length ? pal.items.map(function (it, i) {
      var headHtml = it.kind !== last ? '<div class="palette-group" role="presentation">' + T.esc(it.kind) + "</div>" : "";
      last = it.kind;
      return headHtml + '<a class="palette-item' + (i === pal.index ? " is-active" : "") + '" role="option" aria-selected="' + (i === pal.index) + '" data-i="' + i + '" href="' + T.esc(it.href || "#") + '">' +
        '<span class="palette-icon" aria-hidden="true">' + T.esc(it.icon) + '</span><span class="palette-text"><b>' + T.highlight(it.title, terms) + "</b><span>" + T.esc(it.sub || "") + "</span></span></a>";
    }).join("") : '<p class="palette-empty">' + (query.trim() ? "Không tìm thấy gì khớp." : "Gõ để tìm…") + "</p>";
    var active = $("#paletteList .is-active");
    if (active) active.scrollIntoView({ block: "nearest" });
  }

  function miniMarkdown(md) {
    var inline = function (s) { return s.replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/\[(\d+)\]/g, '<sup class="palette-cite">[$1]</sup>'); };
    var html = "", list = false;
    T.esc(md).split("\n").forEach(function (raw) {
      var m = /^\s*[-*]\s+(.*)$/.exec(raw);
      if (m) { if (!list) html += "<ul>"; list = true; html += "<li>" + inline(m[1]) + "</li>"; return; }
      if (list) html += "</ul>";
      list = false;
      if (raw.trim()) html += "<p>" + inline(raw.trim()) + "</p>";
    });
    return html + (list ? "</ul>" : "");
  }

  function askAi(question) {
    var box = $("#paletteAnswer");
    $("#paletteList").hidden = true;
    box.hidden = false;
    box.innerHTML = '<p class="muted">AI đang đọc các bài liên quan…</p>';
    function back() {
      box.insertAdjacentHTML("afterbegin", '<button type="button" class="btn btn-ghost" id="paletteBack" style="margin-bottom:8px">← Kết quả tìm</button>');
      $("#paletteBack").addEventListener("click", function () { box.hidden = true; $("#paletteList").hidden = false; $("#paletteInput").focus(); render(); });
    }
    pal.ai.goi("ask", { q: question }).then(function (out) {
      if (!out.found) box.innerHTML = "<p>Không có bài nào trong các khoá học nói về điều này.</p>";
      else {
        box.innerHTML = '<div class="palette-answer-body">' + miniMarkdown(out.answer) + "</div>" +
          (out.sources.length ? '<div class="palette-sources"><b>Nguồn</b>' + out.sources.map(function (s, i) {
            return '<a href="' + T.esc(courseHref(s.course, s.webapp)) + "#/" + T.esc(s.slug) + '">[' + (i + 1) + "] " + T.esc(s.title) + " <span>· " + T.esc(s.courseTitle) + "</span></a>";
          }).join("") + "</div>" : "") +
          (out.cached ? '<p class="faint">Câu trả lời có sẵn từ lần hỏi trước — không tốn lượt.</p>' : "");
      }
      back();
    }, function (error) {
      box.innerHTML = '<p class="palette-error">' + T.esc(error.message || String(error)) + "</p>";
      if (error.ma === "ai_code_required") box.append(pal.ai.oMa(function () { askAi(question); }, "btn"));
      back();
    });
  }

  function activate(item) {
    if (!item) return;
    if (item.ask) { askAi($("#paletteInput").value.trim()); return; }
    if (item.run) { close(true); item.run(); return; }
    if (item.path) api.recordOpen(item.path);
    root.location.href = item.href;
  }

  function open() {
    if (pal.open) return;
    pal.open = true; pal.index = 0; pal.opener = doc.activeElement;
    $("#palette").hidden = false;
    doc.body.classList.add("modal-open");
    $("#paletteAnswer").hidden = true; $("#paletteList").hidden = false;
    var input = $("#paletteInput");
    input.value = arguments[0] || "";
    setup();
    render();
    input.focus();
    if (input.value) searchLessons(input.value.trim());
  }

  function close(skipFocus) {
    if (!pal.open) return;
    pal.open = false;
    $("#palette").hidden = true;
    if (!doc.querySelector("dialog[open]")) doc.body.classList.remove("modal-open");
    if (!skipFocus && pal.opener && pal.opener.focus && doc.contains(pal.opener)) pal.opener.focus();
  }

  function bind() {
    $("#btnPalette").addEventListener("click", function () { open(); });
    $("#paletteClose").addEventListener("click", function () { close(); });
    $("#palette").addEventListener("click", function (e) {
      if (e.target === $("#palette")) { close(); return; }
      var link = e.target.closest(".palette-item");
      if (link) { e.preventDefault(); activate(pal.items[Number(link.dataset.i)]); }
    });
    var input = $("#paletteInput");
    input.addEventListener("input", function (e) {
      pal.index = 0; $("#paletteAnswer").hidden = true; $("#paletteList").hidden = false;
      searchLessons(e.target.value.trim());
      render();
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        var n = pal.items.length;
        if (!n) return;
        pal.index = (pal.index + (e.key === "ArrowDown" ? 1 : n - 1)) % n;
        render();
      } else if (e.key === "Enter") {
        e.preventDefault();
        var it = pal.items[pal.index];
        if (it && e.shiftKey && it.href && !it.ask) root.open(it.href, "_blank", "noopener"); else activate(it);
      }
    });
    // Tab chỉ xoay giữa ô nhập và nút đóng — kết quả đi bằng mũi tên.
    $("#palette").addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.stopPropagation(); close(); }
      else if (e.key === "Tab" && $("#paletteAnswer").hidden) {
        e.preventDefault();
        (doc.activeElement === input ? $("#paletteClose") : input).focus();
      }
    });
  }

  P.palette = { init: function (a) { api = a; bind(); }, open: open, close: close, isOpen: function () { return pal.open; } };
})(typeof globalThis !== "undefined" ? globalThis : this);
