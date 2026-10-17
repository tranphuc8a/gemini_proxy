/* ui/views.js — các màn: Trang chủ, Ôn tập (flashcard), Sách (reading notes), Tag, và dữ liệu mẫu. Mỗi màn: open(ctx, host, …) → {destroy()}. */
(function (root) {
  "use strict";
  var W = root.Wiki, T = W.text, N = W.notes, F = W.flash, M = W.markdown, U = W.ui, h = U.h, icon = U.icon, $ = U.$;
  var DAY = 86400000;

  function pageHead(title, sub, actions) { return h("header", { class: "ph" }, h("div", null, h("h1", { text: title }), sub ? h("p", { class: "ph-sub", text: sub }) : null), actions ? h("div", { class: "ph-act" }, actions) : null); }
  function noteLink(head, extra) {
    var a = h("a", { class: "mini", href: "#/n/" + head.id });
    a.innerHTML = '<span class="mt">' + T.esc(head.title) + "</span>" + (extra ? '<small>' + T.esc(extra) + "</small>" : "");
    return a;
  }
  function section(title, nodes, hint) { return h("section", { class: "hs" }, h("h2", { text: title }), nodes && nodes.length ? h("div", { class: "mini-grid" }, nodes) : h("p", { class: "faint", text: hint || "Chưa có." })); }
  function mdInline(src, repo) { return M.render(src, { highlight: W.highlight, resolve: function (t) { var hd = repo.resolve(t); return hd ? { id: hd.id, status: hd.s } : null; } }); }

  // ================================================================================================= dữ liệu mẫu
  function samples(ctx) {
    var repo = ctx.repo, now = repo.now();
    var list = [
      { title: "Chào mừng đến Personal Wiki", tags: ["huong-dan"], fav: true, content: "# Chào mừng 👋\n\nĐây là **hệ tri thức cá nhân** của bạn — mọi thứ lưu ngay trên máy này, dùng được khi không có mạng.\n\n## Thử ngay\n\n- Nối ghi chú bằng `[[Tên note]]`: ví dụ [[Bloom Filter]] dùng [[Hash Function]].\n- Xem **Được tham chiếu bởi** ở khung bên phải của từng note (backlink).\n- Mở **Đồ thị** để thấy mạng lưới kiến thức.\n- Gõ `Q: câu hỏi` rồi `A: đáp án` để tạo **thẻ ôn** (xem mục Ôn tập).\n- Tìm nhanh bằng `/`, lọc bằng `tag:algorithm`, hoặc tìm cụm từ chính xác: `\"false positive\"`.\n\n## Quan hệ có kiểu\n\n[[depends_on::Java]] và [[related_to::Spring]] cho thấy cách ghi quan hệ ngay trong nội dung.\n\nQ: Làm sao nối hai ghi chú với nhau?\nA: Gõ `[[Tên ghi chú kia]]` trong nội dung.\n" },
      { title: "Bloom Filter", tags: ["algorithm", "database"], content: "# Bloom Filter\n\nCấu trúc dữ liệu **xác suất** cho biết một phần tử *chắc chắn không có* hoặc *có thể có* trong tập hợp.\n\n- Dùng nhiều [[Hash Function]] để đặt các bit.\n- Có thể sai **false positive**, không bao giờ sai false negative.\n- Không xoá được phần tử (trừ Counting Bloom Filter).\n\n```cpp\nbool maybe_contains(const string& s) {\n  for (auto h : hashes) if (!bits[h(s) % m]) return false;\n  return true;\n}\n```\n\nQ: Bloom Filter là gì?\nA: Tập hợp xấp xỉ, tiết kiệm bộ nhớ, có false positive.\n\nQ: Bloom Filter có false negative không?\nA: Không.\n" },
      { title: "Hash Function", tags: ["algorithm"], content: "# Hash Function\n\nHàm ánh xạ dữ liệu bất kỳ thành số nguyên cỡ cố định.\n\n| Tính chất | Ý nghĩa |\n|---|---|\n| Xác định | cùng vào → cùng ra |\n| Phân tán đều | ít va chạm |\n| Nhanh | O(độ dài dữ liệu) |\n\nĐược dùng bởi [[Bloom Filter]], bảng băm, chữ ký số.\n" },
      { title: "Java", tags: ["lap-trinh"], content: "# Java\n\nNgôn ngữ lập trình hướng đối tượng chạy trên JVM.\n\n- Framework phổ biến: [[Spring]].\n" },
      { title: "Spring", tags: ["lap-trinh", "java"], content: "# Spring\n\nFramework ứng dụng doanh nghiệp trên Java.\n\n- [[depends_on::Java]]\n- Có Spring Security, Spring Data.\n" }
    ];
    return list.reduce(function (p, n, i) { return p.then(function () { return repo.save(Object.assign({ created_at: now - (list.length - i) * 3600000 }, n)); }); }, Promise.resolve()).then(function () { ctx.toast("Đã tạo " + list.length + " ghi chú mẫu"); });
  }

  // ================================================================================================= trang chủ
  function appendToDaily(ctx, text) {
    var repo = ctx.repo, key = T.dateKey(repo.now()), d = new Date(repo.now()), hh = ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
    return repo.daily(key).then(function (r) {
      var c = r.note.content, bullet = "- " + hh + " " + text, at = c.indexOf("## Ghi chú\n");
      var content = at !== -1 ? c.slice(0, at + 11) + "\n" + bullet + c.slice(at + 11).replace(/^\n+/, "\n") : c.replace(/\s+$/, "") + "\n\n" + bullet + "\n";
      return repo.save(Object.assign({}, r.note, { content: content }));
    });
  }

  function home(ctx, host) {
    var repo = ctx.repo, st = { destroyed: false }, now = repo.now(), key = T.dateKey(now);
    var wk = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"][new Date(now).getDay()];
    var el = h("div", { class: "page home" });
    host.replaceChildren(el);

    function draw() {
      if (st.destroyed) return;
      var s = repo.stats(), favs = repo.list({ fav: true }).slice(0, 8), recent = repo.list({}).slice(0, 8), all = repo.list({});
      Promise.all([repo.daily(key), repo.cardStats(now)]).then(function (r) {
        if (st.destroyed) return;
        var daily = r[0], cs = r[1], excerpt = daily.virtual ? "" : N.plainSnippet(daily.note.content.replace(/^##[^\n]*\n/gm, ""), 140);
        el.replaceChildren.apply(el, [
          pageHead(wk + ", " + T.fmtDate(now),s.active ? s.active.toLocaleString("vi-VN") + " ghi chú · " + s.tags + " tag" : "Bắt đầu xây hệ tri thức của bạn"),
          h("div", { class: "cards3" },
            h("a", { class: "bigcard today", href: "#/daily" }, h("span", { class: "bc-ic", html: icon("calendar") }), h("b", { text: "Ghi chú hôm nay" }), h("small", { text: key }), h("p", { text: excerpt || "Chưa có gì. Bấm để mở ghi chú ngày." })),
            h("a", { class: "bigcard review" + (cs.due ? " due" : ""), href: "#/review" }, h("span", { class: "bc-ic", html: icon("card") }), h("b", { text: "Ôn tập" }), h("small", { text: cs.total ? cs.total + " thẻ" : "Chưa có thẻ" }), h("p", { text: cs.due ? cs.due + " thẻ đến hạn hôm nay" : cs.total ? "Hôm nay không còn thẻ cần ôn ✓" : "Gõ Q: / A: trong ghi chú để tạo thẻ." })),
            h("a", { class: "bigcard graph", href: "#/graph" }, h("span", { class: "bc-ic", html: icon("graph") }), h("b", { text: "Đồ thị" }), h("small", { text: "mạng lưới tri thức" }), h("p", { text: "Xem các ghi chú nối với nhau." }))),
          quick(),
          s.total ? null : h("div", { class: "welcome" }, h("p", { text: "Chưa có ghi chú nào." }), h("button", { type: "button", class: "btn btn-primary", text: "Tạo ghi chú mẫu để khám phá", on: { click: function () { samples(ctx); } } }), h("button", { type: "button", class: "btn", text: "Ghi chú mới", on: { click: function () { ctx.newNote({}); } } })),
          favs.length ? section("Đã ghim", favs.map(function (x) { return noteLink(x, x.tags.slice(0, 2).join(" · ")); })) : null,
          recent.length ? section("Mới sửa gần đây", recent.map(function (x) { return noteLink(x, T.relTime(x.u, now)); })) : null,
          all.length > 5 ? rediscover(all) : null].filter(Boolean));          // replaceChildren(null) sẽ chèn chữ "null"
      });
    }
    function quick() {
      var input = h("input", { type: "text", class: "q2", placeholder: "Ghi nhanh vào hôm nay…", "aria-label": "Ghi nhanh vào ghi chú hôm nay", maxlength: "500", enterkeyhint: "send" }), form = h("form", { class: "quick" }, input, h("button", { type: "submit", class: "btn btn-primary", html: icon("plus") + "<span>Thêm</span>" }));
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var v = input.value.trim(); if (!v) return;
        input.disabled = true;
        appendToDaily(ctx, v).then(function () { input.value = ""; input.disabled = false; ctx.toast("Đã thêm vào ghi chú hôm nay", { action: { label: "Mở", run: function () { ctx.route({}, false, "daily"); } } }); draw(); }, function (er) { input.disabled = false; ctx.toast("Không lưu được: " + er.message); });
      });
      return form;
    }
    function rediscover(all) {
      var old = all.filter(function (x) { return now - x.u > 14 * DAY; }), pool = old.length ? old : all, box = h("section", { class: "hs" }), pick = function () { return pool[Math.floor(Math.random() * pool.length)]; };
      function render() {
        var n = pick(), a = h("a", { class: "redis", href: "#/n/" + n.id }), more = h("button", { type: "button", class: "btn btn-ghost", html: icon("shuffle") + "<span>Khác</span>" });
        a.innerHTML = "<b>" + T.esc(n.title) + "</b><span>" + T.esc(n.sn) + "</span><small>" + T.esc(T.relTime(n.u, now)) + "</small>";
        more.addEventListener("click", render);
        box.replaceChildren(h("div", { class: "hs-head" }, h("h2", { text: "Gặp lại một ghi chú cũ" }), more), a);
      }
      render();
      return box;
    }
    draw();
    var off = repo.on(function () { if (!st.destroyed) draw(); });
    return { destroy: function () { st.destroyed = true; if (off) off(); } };
  }

  // ================================================================================================= ôn tập
  function review(ctx, host) {
    var repo = ctx.repo, st = { queue: [], i: 0, shown: false, done: 0, again: 0, total: 0, destroyed: false, early: false };
    var el = h("div", { class: "page review-page" });
    host.replaceChildren(el);
    function load(early) {
      st.early = !!early;
      return repo.dueCards(early ? { all: true, limit: 30 } : { limit: 200 }).then(function (cs) {
        st.queue = early ? cs.filter(function (c) { return c.due > repo.now(); }) : cs; st.i = 0; st.shown = false; st.done = 0; st.again = 0; st.total = st.queue.length; draw();
      });
    }
    function draw() {
      if (st.destroyed) return;
      if (st.i >= st.queue.length) return finish();
      var c = st.queue[st.i], head = repo.head(c.note), pct = Math.round(st.done / Math.max(1, st.total + st.again) * 100);
      var q = h("div", { class: "md fc-face" }), a = h("div", { class: "md fc-face fc-back", hidden: !st.shown });
      q.innerHTML = mdInline(c.q, repo); a.innerHTML = mdInline(c.a, repo);
      var actions = h("div", { class: "fc-actions" });
      if (!st.shown) actions.append(h("button", { type: "button", class: "btn btn-primary big", html: "<span>Hiện đáp án</span> <kbd>Space</kbd>", on: { click: reveal } }));
      else {
        var pv = F.preview(c, repo.now());
        F.GRADES.forEach(function (g, k) { actions.append(h("button", { type: "button", class: "btn grade g" + k, dataset: { g: k }, on: { click: function () { rate(k); } } }, h("b", { text: g }), h("small", { text: pv[k] }), h("kbd", { text: String(k + 1) }))); });
      }
      el.replaceChildren(
        pageHead("Ôn tập", (st.early ? "Ôn sớm · " : "") + (st.queue.length - st.i) + " thẻ còn lại", h("a", { class: "btn btn-ghost", href: "#/", text: "Thoát" })),
        h("div", { class: "prog", role: "progressbar", "aria-valuenow": String(pct), "aria-valuemin": "0", "aria-valuemax": "100", "aria-label": "Tiến độ" }, h("span", { style: "width:" + pct + "%" })),
        h("article", { class: "fcard" }, h("p", { class: "fc-src" }, "Từ: ", head ? h("a", { href: "#/n/" + head.id, text: head.title }) : "(note đã xoá)"), q, a), actions,
        h("p", { class: "faint kb", text: "Phím tắt: Space hiện đáp án · 1 Lại · 2 Khó · 3 Được · 4 Dễ" }));
    }
    function reveal() { st.shown = true; draw(); var b = $(".fc-actions .g2", el); if (b) b.focus(); }
    function rate(g) {
      var c = st.queue[st.i];
      repo.review(c.id, g).then(function (next) {
        st.done++;
        if (g === 0) { st.again++; st.queue.push(next); }
        st.i++; st.shown = false; draw();
      }, function (e) { ctx.toast(e.message); st.i++; st.shown = false; draw(); });
    }
    function finish() {
      repo.cardStats(repo.now()).then(function (cs) {
        if (st.destroyed) return;
        var none = st.total === 0 && !st.done;
        el.replaceChildren(pageHead("Ôn tập", cs.total + " thẻ trong hệ thống"),
          h("div", { class: "done" }, h("p", { class: "big", text: none ? (cs.total ? "Hôm nay không còn thẻ nào cần ôn ✓" : "Chưa có thẻ ôn nào") : "Xong buổi ôn! 🎉" }),
            none ? h("p", { text: cs.total ? "Quay lại ngày mai, hoặc ôn sớm các thẻ chưa đến hạn." : "Trong ghi chú, gõ 'Q: câu hỏi' rồi dòng sau 'A: đáp án' — thẻ tự xuất hiện ở đây." }) : h("p", { text: "Đã ôn " + st.done + " lượt (" + st.again + " lần phải ôn lại)." }),
            h("div", { class: "btn-row" }, cs.total ? h("button", { type: "button", class: "btn", text: "Ôn sớm 30 thẻ", on: { click: function () { load(true); } } }) : null, h("a", { class: "btn btn-primary", href: "#/", text: "Về trang chủ" }))));
      });
    }
    function key(e) {
      if (U.isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey || st.i >= st.queue.length) return;
      if (!st.shown && (e.key === " " || e.key === "Enter")) { e.preventDefault(); reveal(); }
      else if (st.shown && /^[1-4]$/.test(e.key)) { e.preventDefault(); rate(+e.key - 1); }
    }
    root.document.addEventListener("keydown", key);
    load(false);
    return { destroy: function () { st.destroyed = true; root.document.removeEventListener("keydown", key); } };
  }

  // ================================================================================================= sách
  function children(repo, id) { return repo.relations(id).then(function (r) { return r.items.filter(function (x) { return (x.dir === "out" && x.type === "parent_of") || (x.dir === "in" && x.type === "child_of"); }); }); }

  function books(ctx, host) {
    var repo = ctx.repo, st = { destroyed: false }, el = h("div", { class: "page" });
    host.replaceChildren(el);
    function draw() {
      var list = repo.list({ kind: "book" });
      Promise.all(list.map(function (b) { return children(repo, b.id); })).then(function (kids) {
        if (st.destroyed) return;
        var add = h("button", { type: "button", class: "btn btn-primary", html: icon("plus") + "<span>Thêm sách</span>", on: { click: addBook } });
        el.replaceChildren(pageHead("Sách đang đọc", "Mỗi sách có chương và trích dẫn, tất cả nối ngược về sách", add),
          list.length ? h("div", { class: "book-grid" }, list.map(function (b, i) {
            var ch = kids[i].filter(function (x) { return x.head.k === "chapter"; }).length, qu = kids[i].filter(function (x) { return x.head.k === "quote"; }).length;
            var a = h("a", { class: "book", href: "#/book/" + b.id }); a.innerHTML = '<span class="bk-ic">📖</span><b>' + T.esc(b.title) + "</b><small>" + T.esc(b.sn.replace(/^Tác giả:\s*/, "").slice(0, 60)) + "</small><span class=\"bk-n\">" + ch + " chương · " + qu + " trích dẫn</span>";
            return a;
          })) : h("div", { class: "empty-list" }, h("p", { class: "big", text: "Chưa có sách nào" }), h("p", { text: "Thêm sách để ghi lại chương và những câu đáng nhớ." }), add.cloneNode(true)));
        var again = $(".empty-list .btn", el); if (again) again.addEventListener("click", addBook);
      });
    }
    function addBook() {
      U.formBox("Thêm sách", [{ name: "title", label: "Tên sách", required: true, placeholder: "Clean Code", max: 160 }, { name: "author", label: "Tác giả", placeholder: "Robert C. Martin", max: 120 }, { name: "pages", label: "Số trang (tuỳ chọn)", type: "number", max: 6 }], "Thêm").then(function (v) {
        if (!v) return;
        var content = "Tác giả: " + (v.author || "—") + "\n\n## Tóm tắt\n\n\n## Ý chính\n\n- ";
        repo.save({ title: v.title, kind: "book", content: content, tags: ["sach"], meta: { author: v.author, pages: +v.pages || 0 } }).then(function (r) { ctx.toast("Đã thêm sách"); ctx.route({}, false, "book/" + r.note.id); });
      });
    }
    draw();
    var off = repo.on(function () { if (!st.destroyed) draw(); });
    return { destroy: function () { st.destroyed = true; if (off) off(); } };
  }

  function book(ctx, host, id) {
    var repo = ctx.repo, st = { destroyed: false }, el = h("div", { class: "page" }), b = repo.head(id);
    host.replaceChildren(el);
    if (!b || b.k !== "book") { el.append(pageHead("Không thấy sách này"), h("p", { class: "faint" }, h("a", { href: "#/books", text: "← Về danh sách sách" }))); return { destroy: function () {} }; }
    function draw() {
      children(repo, id).then(function (kids) {
        if (st.destroyed) return;
        var chapters = kids.filter(function (x) { return x.head.k === "chapter"; }), quotes = kids.filter(function (x) { return x.head.k === "quote"; });
        Promise.all(chapters.map(function (c) { return children(repo, c.head.id); })).then(function (sub) {
          var all = quotes.slice(); sub.forEach(function (s) { s.forEach(function (x) { if (x.head.k === "quote" && !all.some(function (y) { return y.head.id === x.head.id; })) all.push(x); }); });
          el.replaceChildren(pageHead("📖 " + b.title, "Sách", h("div", { class: "btn-row" },
            h("button", { type: "button", class: "btn", html: icon("plus") + "<span>Chương</span>", on: { click: function () { addChapter(chapters); } } }),
            h("button", { type: "button", class: "btn", html: icon("plus") + "<span>Trích dẫn</span>", on: { click: function () { addQuote(chapters); } } }),
            h("a", { class: "btn btn-primary", href: "#/n/" + id, text: "Mở ghi chú sách" }))),
            h("a", { class: "back-link", href: "#/books", text: "← Tất cả sách" }),
            section("Chương (" + chapters.length + ")", chapters.map(function (x, i) { return noteLink(x.head, x.head.sn); }), "Chưa có chương nào."),
            h("section", { class: "hs" }, h("h2", { text: "Trích dẫn (" + all.length + ")" }), all.length ? h("div", { class: "quotes" }, all.map(function (x) { var a = h("a", { class: "quote", href: "#/n/" + x.head.id }); a.innerHTML = "<p>" + T.esc(x.head.sn.slice(0, 220)) + "</p>"; return a; })) : h("p", { class: "faint", text: "Chưa có trích dẫn nào." })));
        });
      });
    }
    function addChapter() {
      U.formBox("Thêm chương", [{ name: "name", label: "Tên chương", required: true, placeholder: "Functions", max: 140 }], "Thêm").then(function (v) {
        if (!v) return;
        repo.save({ title: b.title + " — " + v.name, kind: "chapter", tags: b.tags, content: "# " + v.name + "\n\nSách: [[" + b.title + "]]\n\n## Ghi chú\n\n- ", rel: [{ t: "child_of", id: id }] }).then(function (r) { ctx.route({}, false, "n/" + r.note.id); });
      });
    }
    function addQuote(chapters) {
      var opts = chapters.map(function (c) { return c.head.title.replace(b.title + " — ", ""); });
      U.formBox("Thêm trích dẫn", [{ name: "text", label: "Trích dẫn", type: "textarea", required: true, max: 1500 }, { name: "chapter", label: "Chương (tuỳ chọn" + (opts.length ? ": " + opts.join(", ").slice(0, 80) : "") + ")", max: 140 }, { name: "page", label: "Trang (tuỳ chọn)", max: 12 }], "Thêm").then(function (v) {
        if (!v) return;
        var ch = v.chapter && chapters.filter(function (c) { return T.titleKey(c.head.title.replace(b.title + " — ", "")) === T.titleKey(v.chapter); })[0], words = v.text.split(/\s+/);
        var content = "> " + v.text.replace(/\n/g, "\n> ") + "\n\n— *" + b.title + "*" + (v.chapter ? ", " + v.chapter : "") + (v.page ? ", tr. " + v.page : "") + "\n";
        repo.save({ title: "❝ " + words.slice(0, 8).join(" ") + (words.length > 8 ? "…" : ""), kind: "quote", tags: b.tags.concat("trich-dan"), content: content, rel: [{ t: "child_of", id: ch ? ch.head.id : id }] }).then(function (r) {
          ctx.toast("Đã thêm trích dẫn", { ms: 7000, action: words.length >= 8 ? { label: "Tạo thẻ ôn", run: function () {
            var head6 = words.slice(0, 6).join(" "), tail = words.slice(6).join(" ");
            repo.get(r.note.id).then(function (n) { repo.save({ id: n.id, content: n.content + "\nQ: Hoàn thành câu trích dẫn trong “" + b.title + "”: “" + head6 + " …”\nA: " + tail + "\n" }).then(function () { ctx.toast("Đã tạo thẻ ôn từ trích dẫn"); }); });
          } } : null });
        });
      });
    }
    draw();
    var off = repo.on(function () { if (!st.destroyed) draw(); });
    return { destroy: function () { st.destroyed = true; if (off) off(); } };
  }

  // ================================================================================================= tag
  function tags(ctx, host) {
    var repo = ctx.repo, st = { q: "", destroyed: false }, el = h("div", { class: "page" }), list = h("div", { class: "taglist" }), inp = h("input", { type: "search", class: "q2", placeholder: "Lọc tag…", "aria-label": "Lọc tag", autocomplete: "off" });
    host.replaceChildren(el);
    function draw() {
      var all = repo.tags(), q = T.fold(st.q), shown = all.filter(function (t) { return !q || T.fold(t.tag).indexOf(q) !== -1; });
      list.replaceChildren.apply(list, shown.map(function (t) {
        var row = h("div", { class: "tagrow" }), a = h("a", { class: "tg", href: "#/notes?tag=" + U.enc(t.tag) }), more = h("button", { type: "button", class: "icon-btn", "aria-label": "Thao tác với tag " + t.tag, "aria-haspopup": "menu", html: icon("more") });
        a.innerHTML = "<span>#" + T.esc(t.tag) + "</span><b>" + t.count.toLocaleString("vi-VN") + "</b>";
        more.addEventListener("click", function () {
          U.menu(more, [
            { label: "Đổi tên", icon: "edit", run: function () { U.formBox("Đổi tên tag", [{ name: "to", label: "Tên mới", value: t.tag, required: true, max: 40 }], "Đổi tên").then(function (v) { if (v && v.to) repo.renameTag(t.tag, v.to).then(function (n) { ctx.toast("Đã đổi tag trên " + n + " ghi chú"); }, function (e) { ctx.toast(e.message); }); }); } },
            { label: "Gộp vào tag khác…", icon: "merge", run: function () { U.formBox("Gộp tag “" + t.tag + "”", [{ name: "to", label: "Gộp vào tag", required: true, max: 40, hint: "Mọi ghi chú có tag này sẽ đổi sang tag đích; tag cũ biến mất." }], "Gộp").then(function (v) { if (v && v.to) repo.renameTag(t.tag, v.to).then(function (n) { ctx.toast("Đã gộp " + n + " ghi chú"); }, function (e) { ctx.toast(e.message); }); }); } },
            { sep: true },
            { label: "Xoá tag khỏi mọi ghi chú", icon: "trash", danger: true, run: function () { ctx.confirm("Xoá tag #" + t.tag + "?", "Chỉ gỡ tag khỏi " + t.count + " ghi chú; ghi chú vẫn còn.", "Xoá tag", true).then(function (ok) { if (ok) repo.deleteTag(t.tag).then(function (n) { ctx.toast("Đã gỡ tag khỏi " + n + " ghi chú"); }); }); } }
          ]);
        });
        row.append(a, more); return row;
      }));
      if (!shown.length) list.append(h("p", { class: "faint", text: all.length ? "Không có tag nào khớp." : "Chưa có tag nào. Thêm tag khi soạn ghi chú." }));
    }
    inp.addEventListener("input", function () { st.q = inp.value; draw(); });
    el.append(pageHead("Tag", "Nhãn phân loại — một ghi chú có nhiều tag"), inp, list);
    draw();
    var off = repo.on(function () { if (!st.destroyed) draw(); });
    return { destroy: function () { st.destroyed = true; if (off) off(); } };
  }

  U.views = { home: home, review: review, books: books, book: book, tags: tags, samples: samples, appendToDaily: appendToDaily, pageHead: pageHead };
})(typeof globalThis !== "undefined" ? globalThis : this);
