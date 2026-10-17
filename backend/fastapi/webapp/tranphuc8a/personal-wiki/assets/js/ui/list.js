/* ui/list.js — danh sách note: cuộn ẢO (chỉ dựng các dòng đang thấy ⇒ 100.000 note vẫn mượt) + khung tìm kiếm + bộ lọc.
   Cột danh sách luôn nằm trên trang (máy tính: cạnh trình soạn; điện thoại: một màn riêng), nhận trạng thái từ địa chỉ: #/notes?status=&tag=&sort=  và  #/search?q= */
(function (root) {
  "use strict";
  var W = root.Wiki, T = W.text, U = W.ui, h = U.h, icon = U.icon, $ = U.$;
  var ROW = 76, OVER = 6;

  /** Cuộn ảo: host là phần tử cuộn; opts {count(), row(i) → Element, empty() → Element|null}. */
  function vlist(host, opts) {
    var space = h("div", { class: "vl-space", role: "list" }), rows = new Map(), raf = 0, empty = null;
    host.replaceChildren(space);
    function render() {
      raf = 0;
      var n = opts.count();
      if (empty) { empty.remove(); empty = null; }
      if (!n) {
        space.style.height = "0px"; rows.forEach(function (el) { el.remove(); }); rows.clear();
        empty = opts.empty ? opts.empty() : null; if (empty) host.append(empty);
        return;
      }
      space.style.height = n * ROW + "px";
      var top = host.scrollTop, first = Math.max(0, Math.floor(top / ROW) - OVER), last = Math.min(n - 1, Math.ceil((top + host.clientHeight) / ROW) + OVER);
      rows.forEach(function (el, i) { if (i < first || i > last) { el.remove(); rows.delete(i); } });
      for (var i = first; i <= last; i++) {
        if (rows.has(i)) continue;
        var el = opts.row(i);
        el.style.top = i * ROW + "px"; el.setAttribute("role", "listitem"); el.setAttribute("aria-posinset", i + 1); el.setAttribute("aria-setsize", n);
        space.append(el); rows.set(i, el);
      }
    }
    function schedule() { if (!raf) raf = root.requestAnimationFrame(render); }
    host.addEventListener("scroll", schedule, { passive: true });
    var ro = root.ResizeObserver ? new root.ResizeObserver(schedule) : null; if (ro) ro.observe(host);
    host.addEventListener("keydown", function (e) {
      if ((e.key !== "ArrowDown" && e.key !== "ArrowUp") || !e.target.closest(".nrow")) return;
      var cur = +e.target.closest(".nrow").getAttribute("aria-posinset") - 1, to = cur + (e.key === "ArrowDown" ? 1 : -1), n = opts.count();
      if (to < 0 || to >= n) return;
      e.preventDefault();
      host.scrollTop = Math.min(Math.max(host.scrollTop, to * ROW + ROW - host.clientHeight + 8), to * ROW);
      render();
      var el = rows.get(to); if (el) el.focus();
    });
    return {
      refresh: function () { rows.forEach(function (el) { el.remove(); }); rows.clear(); render(); },
      scrollToTop: function () { host.scrollTop = 0; },
      scrollToIndex: function (i) { host.scrollTop = Math.max(0, i * ROW - host.clientHeight / 3); render(); },
      destroy: function () { host.removeEventListener("scroll", schedule); if (ro) ro.disconnect(); }
    };
  }

  var STATUS = [["active", "Đang dùng"], ["archived", "Lưu trữ"], ["trashed", "Thùng rác"]];
  var SORTS = [["updated", "Mới sửa"], ["created", "Mới tạo"], ["title", "Tên A→Z"]];

  /** Dòng note. o: {snippet (HTML đã thoát) | null, current (id đang mở), now} */
  function noteRow(head, o) {
    var left = head.s === "trashed" ? Math.max(0, Math.ceil((head.u + W.repo.TRASH_MS - o.now) / 86400000)) : 0;
    var a = h("a", { class: "nrow" + (o.current === head.id ? " cur" : ""), href: "#/n/" + head.id, dataset: { id: head.id } });
    var tags = head.tags.slice(0, 3).map(function (t) { return '<span class="ntag">' + T.esc(t) + "</span>"; }).join("") + (head.tags.length > 3 ? '<span class="ntag more">+' + (head.tags.length - 3) + "</span>" : "");
    a.innerHTML = '<span class="nr-top"><span class="nr-title">' + T.esc(head.title) + "</span>" + (head.f ? '<span class="nr-fav" title="Đã ghim">' + icon("star", "ic-fill") + "</span>" : "") + "</span>" +
      '<span class="nr-sn">' + (o.snippet != null ? o.snippet : T.esc(head.sn)) + "</span>" +
      '<span class="nr-meta"><span class="nr-kind">' + (head.k === "daily" ? "📅" : head.k === "book" ? "📖" : head.k === "chapter" ? "📑" : head.k === "quote" ? "❝" : "") + "</span><time>" + T.esc(head.s === "trashed" ? "còn " + left + " ngày" : T.relTime(head.u, o.now)) + "</time>" + tags + "</span>";
    return a;
  }

  /** Cột danh sách. ctx: {repo, route(query)} → {el, setState(state), refresh(), focusSearch(), setCurrent(id)} */
  function create(ctx) {
    var repo = ctx.repo, state = { mode: "list", q: "", status: "active", tag: "", sort: "updated", fav: false }, current = "", results = null, seq = 0;
    var input = h("input", { type: "search", id: "q", class: "q", placeholder: "Tìm ghi chú…  (tag:, \"cụm từ\")", autocomplete: "off", autocapitalize: "none", spellcheck: "false", enterkeyhint: "search", "aria-label": "Tìm ghi chú", maxlength: "300" });
    var clear = h("button", { type: "button", class: "icon-btn clear", hidden: true, "aria-label": "Xoá ô tìm kiếm", html: icon("x") });
    var head = h("div", { class: "lp-head" },
      h("form", { class: "lp-search", role: "search" }, h("span", { class: "lp-ic", html: icon("search") }), input, clear),
      h("div", { class: "lp-filters" }));
    var count = h("p", { class: "lp-count", role: "status", "aria-live": "polite" }), body = h("div", { class: "lp-body" });
    var el = h("section", { class: "lp", "aria-label": "Danh sách ghi chú" }, head, count, body);
    var vl = vlist(body, {
      count: function () { return results ? results.rows.length : items().length; },
      row: function (i) {
        var now = Date.now();
        if (results) { var r = results.rows[i]; return noteRow(r.head, { snippet: r.snippet, current: current, now: now }); }
        return noteRow(items()[i], { current: current, now: now });
      },
      empty: function () { return emptyState(); }
    });

    function items() { return repo.list({ status: state.status, tag: state.tag, fav: state.fav, sort: state.sort }); }
    function emptyState() {
      var box = h("div", { class: "empty-list" });
      if (results) {
        box.innerHTML = '<p class="big">Không tìm thấy gì cho “' + T.esc(state.q) + "”</p><p>Thử bớt từ khoá, bỏ dấu, hoặc dùng <code>tag:tên</code>. Từ phổ biến như “và”, “the” không được lập chỉ mục.</p>";
        var b = h("button", { type: "button", class: "btn", text: "Tạo ghi chú “" + state.q.slice(0, 40) + "”" }); b.addEventListener("click", function () { ctx.newNote({ title: state.q }); }); box.append(b);
      } else if (state.status === "trashed") box.innerHTML = '<p class="big">Thùng rác trống</p><p>Ghi chú xoá sẽ nằm đây 30 ngày rồi tự dọn.</p>';
      else if (state.status === "archived") box.innerHTML = '<p class="big">Chưa lưu trữ ghi chú nào</p><p>Lưu trữ giúp cất note cũ khỏi tầm mắt mà không mất; khôi phục bất cứ lúc nào.</p>';
      else if (state.tag || state.fav) box.innerHTML = '<p class="big">Không có ghi chú khớp bộ lọc</p>';
      else { box.innerHTML = '<p class="big">Chưa có ghi chú nào</p><p>Bấm <b>+ Ghi chú mới</b> để bắt đầu, hoặc xem thử với dữ liệu mẫu.</p>'; var s = h("button", { type: "button", class: "btn btn-primary", text: "Tạo ghi chú mẫu" }); s.addEventListener("click", function () { ctx.samples(); }); box.append(s); }
      return box;
    }

    function renderFilters() {
      var f = $(".lp-filters", head), st = h("div", { class: "seg", role: "group", "aria-label": "Trạng thái" });
      STATUS.forEach(function (s) {
        var n = repo.stats()[s[0]], b = h("button", { type: "button", "aria-pressed": String(state.status === s[0] && !results), dataset: { status: s[0] } });
        b.innerHTML = "<span>" + s[1] + "</span>" + (n ? ' <small class="n">' + n.toLocaleString("vi-VN") + "</small>" : "");
        st.append(b);
      });
      var sort = h("select", { "aria-label": "Sắp xếp", class: "sort" }, SORTS.map(function (s) { return h("option", { value: s[0], selected: state.sort === s[0] ? true : null, text: s[1] }); }));
      var fav = h("button", { type: "button", class: "icon-btn fav-f", "aria-pressed": String(state.fav), "aria-label": "Chỉ hiện ghi chú đã ghim", title: "Chỉ ghi chú đã ghim", html: icon("star") });
      var chips = state.tag ? h("button", { type: "button", class: "chip on", "aria-label": "Bỏ lọc tag " + state.tag, dataset: { clearTag: "1" } }, h("span", { text: "#" + state.tag }), h("span", { html: icon("x") })) : null;
      f.replaceChildren(st, h("div", { class: "lp-row2" }, sort, fav, chips));
      f.hidden = !!results;
    }

    function setCount() {
      count.dataset.q = results ? state.q : "";                              // check.py chờ đúng kết quả của câu vừa gõ
      if (results) count.textContent = results.total.toLocaleString("vi-VN") + " kết quả · " + results.ms + " ms" + (results.total > results.rows.length ? " (hiện " + results.rows.length + " đầu)" : "");
      else {
        var n = items().length, extra = state.status === "trashed" && n ? "" : "";
        count.textContent = n.toLocaleString("vi-VN") + " ghi chú" + (state.tag ? " với tag #" + state.tag : "") + extra;
      }
      if (!results && state.status === "trashed" && items().length) {
        var b = h("button", { type: "button", class: "link-btn", text: "Dọn thùng rác" }); b.addEventListener("click", ctx.emptyTrash); count.append(" · ", b);
      }
    }

    function runSearch() {
      var q = state.q.trim(), my = ++seq;
      if (!q) { results = null; refresh(); return; }
      repo.search(q, { limit: 80, statuses: ["active"] }).then(function (r) {
        if (my !== seq) return;
        results = { rows: r.results.map(function (x) { return { head: x.head, snippet: x.snippet }; }), total: r.total, ms: r.ms };
        refresh(); vl.scrollToTop();
      }, function (e) { count.textContent = "Lỗi tìm kiếm: " + e.message; });
    }
    function refresh() { renderFilters(); setCount(); vl.refresh(); clear.hidden = !input.value; }

    var typing = U.debounce(function () { state.q = input.value; ctx.route({ q: state.q }, true); runSearch(); }, 130);
    input.addEventListener("input", function () { clear.hidden = !input.value; typing(); });
    clear.addEventListener("click", function () { input.value = ""; state.q = ""; ctx.route({}, true); runSearch(); input.focus(); });
    $("form", head).addEventListener("submit", function (e) { e.preventDefault(); if (results && results.rows[0]) ctx.open(results.rows[0].head.id); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { var first = $(".nrow", body); if (first) { e.preventDefault(); first.focus(); } }
      else if (e.key === "Escape" && input.value) { e.preventDefault(); clear.click(); }
    });
    head.addEventListener("click", function (e) {
      var s = e.target.closest("[data-status]"), t = e.target.closest("[data-clear-tag]"), f = e.target.closest(".fav-f");
      if (s) ctx.route({ status: s.dataset.status, sort: state.sort === "updated" ? "" : state.sort, tag: state.tag, fav: state.fav ? "1" : "" });
      else if (t) ctx.route({ status: state.status === "active" ? "" : state.status, fav: state.fav ? "1" : "" });
      else if (f) ctx.route({ status: state.status === "active" ? "" : state.status, tag: state.tag, fav: state.fav ? "" : "1" });
    });
    head.addEventListener("change", function (e) { if (e.target.classList.contains("sort")) ctx.route({ status: state.status === "active" ? "" : state.status, tag: state.tag, fav: state.fav ? "1" : "", sort: e.target.value === "updated" ? "" : e.target.value }); });
    repo.on(function () { if (el.isConnected) { if (results) runSearch(); else refresh(); } });

    return {
      el: el,
      setState: function (s) {
        var changed = s.q !== state.q;
        state = Object.assign({ mode: "list", q: "", status: "active", tag: "", sort: "updated", fav: false }, s);
        if (input.value !== state.q) input.value = state.q;
        if (state.q) { if (changed || !results) runSearch(); else refresh(); } else { results = null; seq++; refresh(); }
      },
      refresh: refresh, setCurrent: function (id) { if (id !== current) { current = id; vl.refresh(); } }, focusSearch: function () { input.focus(); input.select(); },
      scrollTo: function (id) { if (results) return; var list = items(), i = list.findIndex(function (x) { return x.id === id; }); if (i >= 0) vl.scrollToIndex(i); }
    };
  }

  U.list = { create: create, noteRow: noteRow, vlist: vlist, ROW: ROW };
})(typeof globalThis !== "undefined" ? globalThis : this);
