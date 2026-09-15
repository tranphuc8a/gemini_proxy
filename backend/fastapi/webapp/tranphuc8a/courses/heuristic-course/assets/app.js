/* ==========================================================================
   Học Heuristic — ứng dụng một trang, không cần build, không cần server.
   Nội dung nằm sẵn trong assets/content.js (sinh bởi build.py).
   ========================================================================== */
(function () {
"use strict";

var D      = window.COURSE;
var DOCS   = D.docs;
var SLUGS  = D.slugs;
var ORDER  = D.order;

var $  = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var esc = function (s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
};
var icon = function (n, cls) { return '<svg class="ic ' + (cls || '') + '"><use href="#i-' + n + '"/></svg>'; };

/* ---------- 1. Lưu trạng thái ---------------------------------------- */
var LS = {
  get: function (k, d) {
    try { var v = localStorage.getItem("hh." + k); return v == null ? d : JSON.parse(v); }
    catch (e) { return d; }
  },
  set: function (k, v) {
    try { localStorage.setItem("hh." + k, JSON.stringify(v)); } catch (e) {}
  }
};
var done  = new Set(LS.get("done", []));
var stars = new Set(LS.get("stars", []));
var notes = LS.get("notes", {});
var open  = LS.get("open", null);

function saveDone()  { LS.set("done", Array.from(done)); }
function saveStars() { LS.set("stars", Array.from(stars)); }

/* ---------- 2. Giao diện sáng/tối ------------------------------------ */
var mq = window.matchMedia("(prefers-color-scheme: dark)");
function applyTheme() {
  /* ?theme=dark trong dia chi ghi de lua chon da luu — tien cho viec chia se
     duong dan va cho viec chup anh kiem thu tu dong. */
  var qs = (location.search.match(/[?&]theme=(light|dark)/) || [])[1];
  if (qs) LS.set("theme", qs);
  var pref = LS.get("theme", "auto");
  var real = pref === "auto" ? (mq.matches ? "dark" : "light") : pref;
  document.documentElement.setAttribute("data-theme", real);
}
mq.addEventListener("change", function () { if (LS.get("theme", "auto") === "auto") applyTheme(); });
applyTheme();
$("#btnTheme").addEventListener("click", function () {
  var real = document.documentElement.getAttribute("data-theme");
  LS.set("theme", real === "dark" ? "light" : "dark");
  applyTheme();
});

/* ---------- 3. Tiện ích ---------------------------------------------- */
var toastT;
function toast(msg) {
  var t = $("#toast");
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(function () { t.hidden = true; }, 1900);
}

/* Bỏ dấu tiếng Việt bằng bảng tra 1 ký tự → 1 ký tự.
   Giữ nguyên độ dài chuỗi, nhờ vậy vị trí tìm được trên bản không dấu
   dùng thẳng được cho bản gốc (để cắt trích đoạn và tô sáng từ khoá).
   Cách này cũng nhanh hơn normalize("NFD") hàng trăm lần trên 770 nghìn ký tự. */
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
  for (i = 0; i < s.length; i++) {
    c = s[i];
    l = c.toLowerCase();
    if (l.length !== 1) l = c;                 /* không để phép hạ chữ đổi độ dài */
    out += VMAP[l] || l;
  }
  return out;
}

/* ---------- 4. Điều hướng tài liệu ------------------------------------ */
function docOf(slug) { return DOCS[SLUGS[slug]] || null; }
function idxOf(id)   { return ORDER.indexOf(id); }
function prevOf(id)  { var i = idxOf(id); return i > 0 ? DOCS[ORDER[i - 1]] : null; }
function nextOf(id)  { var i = idxOf(id); return i >= 0 && i < ORDER.length - 1 ? DOCS[ORDER[i + 1]] : null; }

/* Đổi liên kết tương đối trong markdown thành đường đi của trang. */
function resolveHref(href, fromId) {
  if (/^(https?:|mailto:|#)/.test(href)) return null;
  var hash = "", h = href.split("#");
  href = h[0]; if (h[1]) hash = h[1];
  if (!href) return null;
  var base = fromId.split("/"); base.pop();
  href.split("/").forEach(function (s) {
    if (!s || s === ".") return;
    if (s === "..") base.pop(); else base.push(s);
  });
  var p = base.join("/");
  var d = DOCS[p] || DOCS[p + "/README.md"] || DOCS[p.replace(/\/$/, "") + "/README.md"];
  if (d) return { route: "#/" + d.slug + (hash ? "#" + hash : ""), doc: d };
  return { file: "../" + p };          // file mã nguồn — mở thẳng từ kho
}

/* ---------- 5. Dựng HTML từ markdown --------------------------------- */
marked.setOptions({ gfm: true, breaks: false, headerIds: false, mangle: false });

function slugifyHeading(t) {
  return norm(t).replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "muc";
}

function render(md, docId) {
  /* 5a. giấu mã nguồn để ký hiệu $ trong code không bị hiểu là công thức */
  var codes = [];
  md = md.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]+`/g, function (m) {
    codes.push(m); return "\u0011" + (codes.length - 1) + "\u0011";
  });

  /* 5b. rút công thức ra ngoài trước khi markdown đụng tới dấu \ */
  var maths = [];
  md = md.replace(/\$\$([\s\S]+?)\$\$/g, function (m, t) {
    maths.push([t, true]);
    /* Dùng <span> chứ không phải <div>, và KHÔNG chèn dòng trống: thẻ này còn
       phải nằm đúng chỗ bên trong khối trích dẫn, ô bảng và mục danh sách —
       nơi một thẻ khối hoặc một dòng trống sẽ phá vỡ cấu trúc markdown. */
    return "<span class=\"mjx-b\" data-m=\"" + (maths.length - 1) + "\"></span>";
  });
  md = md.replace(/\$([^\n$]+?)\$/g, function (m, t) {
    if (/^\s|\s$/.test(t)) return m;                 /* "$ 5 và $ 7" không phải công thức */
    maths.push([t, false]);
    return "<span class=\"mjx-i\" data-m=\"" + (maths.length - 1) + "\"></span>";
  });

  /* 5c. trả mã nguồn về đúng vị trí cũ rồi mới dựng HTML */
  md = md.replace(/\u0011(\d+)\u0011/g, function (m, i) { return codes[+i]; });

  var host = document.createElement("div");
  host.className = "prose";
  host.innerHTML = marked.parse(md);

  /* 5d. công thức */
  $$(".mjx-b,.mjx-i", host).forEach(function (el) {
    var it = maths[+el.dataset.m]; if (!it) return;
    try {
      el.innerHTML = katex.renderToString(it[0], {
        displayMode: it[1], throwOnError: false, strict: false, output: "html"
      });
    } catch (e) {
      el.className += " mjx-err"; el.textContent = it[0];
    }
  });

  /* 5e. khối mã: nhãn ngôn ngữ, nút chép, tô màu; khối không có ngôn ngữ
        là hình vẽ ASCII nên giữ nguyên, không tô màu */
  $$("pre", host).forEach(function (pre) {
    var code = pre.querySelector("code");
    var lang = code && (code.className.match(/language-([\w+#-]+)/) || [])[1];
    var wrap = document.createElement("div");
    wrap.className = "cw" + (lang ? "" : " diag");
    pre.parentNode.insertBefore(wrap, pre);
    wrap.appendChild(pre);
    if (lang && window.hljs && hljs.getLanguage(lang)) {
      try { code.innerHTML = hljs.highlight(code.textContent, { language: lang }).value; } catch (e) {}
    }
    if (lang) {
      var lb = document.createElement("span");
      lb.className = "cw-lang"; lb.textContent = lang;
      wrap.appendChild(lb);
    }
    var b = document.createElement("button");
    b.className = "cw-cp"; b.title = "Chép đoạn mã"; b.setAttribute("aria-label", "Chép đoạn mã");
    b.innerHTML = icon("copy");
    b.addEventListener("click", function () {
      var txt = (code || pre).textContent;
      var ok = function () {
        b.innerHTML = icon("check"); b.classList.add("ok");
        setTimeout(function () { b.innerHTML = icon("copy"); b.classList.remove("ok"); }, 1400);
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

  /* 5f. bảng cuộn ngang được trên màn nhỏ */
  $$("table", host).forEach(function (t) {
    var w = document.createElement("div");
    w.className = "tw";
    t.parentNode.insertBefore(w, t); w.appendChild(t);
  });

  /* 5g. trích dẫn → hộp chú ý, phân loại theo biểu tượng mở đầu */
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

  /* 5h. tiêu đề: gắn mã neo */
  var seen = {};
  $$("h2,h3", host).forEach(function (h) {
    var s = slugifyHeading(h.textContent);
    if (seen[s]) { s = s + "-" + (++seen[s]); } else { seen[s] = 1; }
    h.id = s;
    var a = document.createElement("a");
    a.className = "anch"; a.href = "#/" + DOCS[docId].slug + "#" + s;
    a.setAttribute("aria-label", "Liên kết tới mục này"); a.innerHTML = icon("link");
    h.insertBefore(a, h.firstChild);
  });

  /* 5i. liên kết */
  $$("a", host).forEach(function (a) {
    if (a.classList.contains("anch")) return;
    var href = a.getAttribute("href") || "";
    if (/^https?:/.test(href)) {
      a.target = "_blank"; a.rel = "noopener noreferrer";
      a.insertAdjacentHTML("beforeend", icon("ext"));
      return;
    }
    var r = resolveHref(href, docId);
    if (!r) return;
    if (r.route) { a.setAttribute("href", r.route); a.title = r.doc.title; }
    else { a.setAttribute("href", r.file); a.target = "_blank"; a.rel = "noopener"; a.title = "Mở tệp trong kho mã nguồn"; }
  });

  return host;
}

/* ---------- 6. Tiến độ ------------------------------------------------ */
function groupStat(ids) {
  var n = 0;
  ids.forEach(function (i) { if (done.has(i)) n++; });
  return { n: n, t: ids.length, p: ids.length ? n / ids.length : 0 };
}
function sectionIds(sec) {
  var out = [];
  sec.groups.forEach(function (g) { out = out.concat(g.items); });
  return out;
}
function overall() { return groupStat(ORDER); }

function paintProgress() {
  var o = overall(), pct = Math.round(o.p * 100);
  $("#hdrPct").textContent = pct + "%";
  $("#hdrRing").style.strokeDashoffset = (97.4 * (1 - o.p)).toFixed(1);
  $(".hdr-prog").title = "Đã học " + o.n + "/" + o.t + " tài liệu";
}

/* ---------- 7. Mục lục bên trái --------------------------------------- */
function buildNav() {
  var cur = state.doc ? state.doc.id : null;
  var html = D.nav.map(function (sec) {
    var ids = sectionIds(sec), st = groupStat(ids);
    var has = cur && ids.indexOf(cur) >= 0;
    var isOpen = open ? open.indexOf(sec.id) >= 0 : has || sec.id === "khoa-hoc";
    if (has) isOpen = true;

    var body = sec.groups.map(function (g) {
      var gs = groupStat(g.items);
      var items = g.items.map(function (id) {
        var d = DOCS[id];
        var no = d.meta && d.meta.no ? '<b class="no">' + d.meta.no + "</b>" : "";
        return '<a class="nav-i' + (done.has(id) ? " done" : "") + (id === cur ? " on" : "") +
               '" href="#/' + d.slug + '">' +
               '<span class="dot">' + icon("check") + "</span>" +
               "<span>" + no + esc(d.title) +
               (d.tag ? '<i class="tag">' + esc(d.tag) + "</i>" : "") +
               "</span></a>";
      }).join("");
      return '<div class="nav-grp"><div class="nav-grp-h"><span>' + esc(g.title) + "</span>" +
             '<em>' + gs.n + "/" + gs.t + "</em></div>" +
             '<div class="nav-bar"><i style="width:' + (gs.p * 100).toFixed(0) + '%"></i></div>' +
             items + "</div>";
    }).join("");

    return '<div class="nav-sec" data-sec="' + sec.id + '" data-open="' + (isOpen ? 1 : 0) + '">' +
           '<button class="nav-sec-h" type="button">' + icon(sec.icon) +
           "<span><b>" + esc(sec.title) + "</b><i>" + esc(sec.sub) + "</i></span>" +
           icon("chev", "chev") + "</button>" +
           '<div class="nav-sec-body">' + body + "</div></div>";
  }).join("");

  var nav = $("#sideNav");
  nav.innerHTML = html;
  $$(".nav-sec-h", nav).forEach(function (b) {
    b.addEventListener("click", function () {
      var s = b.parentNode;
      s.dataset.open = s.dataset.open === "1" ? "0" : "1";
      open = $$(".nav-sec", nav).filter(function (x) { return x.dataset.open === "1"; })
                                .map(function (x) { return x.dataset.sec; });
      LS.set("open", open);
    });
  });
  /* Cuộn mục lục trái tới bài đang đọc — phải tự tính scrollTop chứ KHÔNG
     dùng scrollIntoView, vì hàm đó cuộn mọi khung cha, kể cả cửa sổ, khiến
     bài vừa mở bị nhảy xuống giữa trang. */
  var on = $(".nav-i.on", nav);
  if (on) {
    var side = $("#side");
    var r = on.getBoundingClientRect(), s = side.getBoundingClientRect();
    if (r.top < s.top + 40 || r.bottom > s.bottom - 40) {
      side.scrollTop += (r.top - s.top) - side.clientHeight / 2 + r.height / 2;
    }
  }
}

/* ---------- 8. Trang chủ ---------------------------------------------- */
function viewHome() {
  var o = overall();
  var last = LS.get("last", null);
  var lastDoc = last && DOCS[last.id] ? DOCS[last.id] : null;
  var s = D.stats;

  var kpis = [
    [s.files, "tài liệu"],
    ["23", "bài giảng"],
    ["~" + Math.round(s.minutes / 60), "giờ đọc"],
    [(s.words / 1000).toFixed(0) + "k", "từ nội dung"]
  ].map(function (k) {
    return '<div class="kpi"><b>' + k[0] + "</b><span>" + k[1] + "</span></div>";
  }).join("");

  var course = D.nav[0];
  var phases = course.groups.map(function (g, i) {
    var gs = groupStat(g.items);
    var lst = g.items.slice(0, 6).map(function (id) {
      var d = DOCS[id];
      return '<a href="#/' + d.slug + '">' +
             (d.meta && d.meta.no ? "Bài " + d.meta.no : esc(chipLabel(d.title))) + "</a>";
    }).join("");
    var first = DOCS[g.items[0]];
    /* Thẻ phải là <div>: bên trong đã có các liên kết bài học, mà <a> lồng
       trong <a> là HTML không hợp lệ — trình duyệt sẽ tự đóng thẻ ngoài và
       làm vỡ bố cục. Liên kết ở tiêu đề được kéo giãn bằng ::after để cả thẻ
       vẫn bấm được. */
    return '<div class="card">' +
      '<div class="card-top"><div class="card-n">' + (i === 0 ? icon("compass") : i === 7 ? icon("note") : i) + "</div>" +
      '<h3><a href="#/' + first.slug + '">' + esc(g.title.replace(/^Phần \d+ — /, "")) + "</a></h3></div>" +
      '<p>' + esc(phaseBlurb(g.short)) + "</p>" +
      '<div class="card-lst">' + lst + "</div>" +
      '<div class="card-foot" style="margin-top:13px"><div class="bar"><i style="width:' +
      (gs.p * 100).toFixed(0) + '%"></i></div><b>' + gs.n + "/" + gs.t + "</b></div></div>";
  }).join("");

  var cases = D.nav.slice(2).map(function (sec) {
    var ids = sectionIds(sec), gs = groupStat(ids), first = DOCS[ids[0]];
    return '<a class="card" href="#/' + first.slug + '">' +
      '<div class="card-top"><div class="card-n">' + icon(sec.icon) + "</div><h3>" + esc(sec.title) + "</h3></div>" +
      "<p>" + esc(sec.sub) + " — nghiên cứu đầy đủ: phát biểu đề, khảo sát giải pháp, thiết kế cải tiến, " +
      "cài đặt C++ và các thí nghiệm <b>thất bại</b> kèm nguyên nhân.</p>" +
      '<div class="card-foot"><div class="bar"><i style="width:' + (gs.p * 100).toFixed(0) +
      '%"></i></div><b>' + gs.n + "/" + gs.t + "</b></div></a>";
  }).join("");

  var refs = D.nav[1].groups[0].items.map(function (id) {
    var d = DOCS[id];
    return '<a href="#/' + d.slug + '">' + esc(d.title) + "</a>";
  }).join("");

  $("#main").innerHTML =
    '<div class="home">' +
      '<div class="hero">' +
        "<h1>Học <u>heuristic</u> từ kiến thức giải thuật cơ bản</h1>" +
        "<p>23 bài giảng tiếng Việt dẫn bạn từ “viết đúng” sang “viết tốt”: mô hình hoá, " +
        "đo lường tử tế, greedy có chỉ số, metaheuristic — rồi áp dụng vào <b>hai đề thi thật</b> " +
        "đã được giải và đo đạc đầy đủ.</p>" +
        '<div class="hero-cta">' +
          '<a class="btn btn-p" href="#/' + DOCS[ORDER[0]].slug + '">' + icon("right") + "Bắt đầu học</a>" +
          '<a class="btn btn-s" href="#/khoa-hoc/00-de-cuong">Xem đề cương</a>' +
          '<a class="btn btn-s" href="#/2605/tong-quan">' + icon("layers") + "Ca nghiên cứu</a>" +
        "</div>" +
      "</div>" +
      '<div class="kpis">' + kpis + "</div>" +
      (lastDoc ?
        '<a class="resume" href="#/' + lastDoc.slug + '">' +
        '<div class="resume-i">' + icon("right") + "</div>" +
        '<div class="resume-t"><span>Học tiếp</span><b>' + esc(lastDoc.title) + "</b></div>" +
        '<div class="chip ac">' + Math.round(o.p * 100) + "% hoàn thành</div></a>" : "") +
      '<div class="sec-h"><h2>Lộ trình khoá học</h2><span>' + o.n + "/" + o.t + " tài liệu đã đọc</span>" +
        (o.n ? '<a href="#" id="lnkReset">Đặt lại tiến độ</a>' : "") + "</div>" +
      '<div class="grid">' + phases + "</div>" +
      '<div class="sec-h"><h2>Ca nghiên cứu đề thi thật</h2><span>áp dụng toàn bộ khoá học</span></div>' +
      '<div class="grid">' + cases + "</div>" +
      '<div class="sec-h"><h2>Tài liệu tra cứu</h2><span>mở khi đang làm bài</span></div>' +
      '<div class="card full"><div class="card-lst">' + refs + "</div></div>" +
    "</div>";

  var rs = $("#lnkReset");
  if (rs) rs.addEventListener("click", function (e) {
    e.preventDefault();
    if (!confirm("Xoá toàn bộ đánh dấu đã học? Ghi chú của bạn vẫn được giữ.")) return;
    done.clear(); saveDone(); paintProgress(); buildNav(); viewHome();
    toast("Đã đặt lại tiến độ");
  });

  document.title = "Học Heuristic — Từ cơ bản đến chuyên sâu";
  $("#readbarFill").style.width = "0%";
}

/* Nhãn ngắn cho chip: cắt ở dấu phân cách rồi ở ranh giới TỪ, không cắt giữa
   chừng một từ (tiếng Việt cắt giữa từ đọc rất khó hiểu). */
function chipLabel(t, max) {
  max = max || 24;
  t = t.split(/[:—–]/)[0].trim();
  if (t.length <= max) return t;
  var cut = t.slice(0, max);
  var sp = cut.lastIndexOf(" ");
  return (sp > 10 ? cut.slice(0, sp) : cut).replace(/[\s&,]+$/, "") + "…";
}

function phaseBlurb(k) {
  return {
    "Bắt đầu":  "Khoá học dành cho ai, học thế nào, bản đồ kiến thức và bài kiểm tra đầu vào.",
    "Phần 1":   "Mô hình hoá bài toán, vì sao không giải chính xác được, biểu diễn nghiệm và — quan trọng nhất — cách đo lường tử tế.",
    "Phần 2":   "Sinh ra nghiệm đầu tiên: greedy và nghệ thuật chọn chỉ số, giá mờ, chèn/gom cụm, ngẫu nhiên hoá GRASP.",
    "Phần 3":   "Cải thiện nghiệm có sẵn: lân cận, leo đồi, đánh giá tăng dần, bộ toán tử kinh điển và cách thoát cực trị cục bộ.",
    "Phần 4":   "Năm khung metaheuristic: Simulated Annealing, Tabu, ILS & VNS, Beam Search, LNS & ALNS.",
    "Phần 5":   "Kỹ năng phòng thi: dựng cận trên/dưới, kỹ thuật C++ khi bị cấm thư viện, quy trình 8 bước tấn công đề mới.",
    "Phần 6":   "Mổ xẻ một đề thi thật, xây solver qua bảy phiên bản có đo đạc, và tự đánh giá năng lực.",
    "Bài tập":  "Bộ bài tập kèm đáp án chi tiết và lab mã nguồn chạy được."
  }[k] || "";
}

/* ---------- 9. Trang bài đọc ------------------------------------------ */
var spy = null;

function viewDoc(doc, anchor) {
  var sec = D.nav.filter(function (s) { return s.id === doc.section; })[0];
  var m = doc.meta || {};
  var chips = [];
  if (m.no) chips.push('<span class="chip ac">Bài ' + m.no + "/23</span>");
  if (m.hours) chips.push('<span class="chip">' + icon("clock") + esc(m.hours) + "</span>");
  if (m.level) chips.push('<span class="chip"><span class="stars">' +
      "★".repeat(m.level) + "☆".repeat(5 - m.level) + "</span></span>");
  chips.push('<span class="chip">' + icon("book") + "~" + doc.minutes + " phút đọc</span>");
  if (doc.tag) chips.push('<span class="chip wa">' + esc(doc.tag) + "</span>");

  var body = render(doc.md, doc.id);
  var h1 = body.querySelector("h1");
  var titleHtml = h1 ? h1.outerHTML : "<h1>" + esc(doc.title) + "</h1>";
  if (h1) h1.remove();

  var pv = prevOf(doc.id), nx = nextOf(doc.id);
  var isDone = done.has(doc.id), isStar = stars.has(doc.id);

  $("#main").innerHTML =
    '<div class="page">' +
      '<article class="doc">' +
        '<div class="crumb"><a href="#/">Trang chủ</a>' + icon("chev") +
          "<span>" + esc(sec ? sec.title : "") + "</span>" + icon("chev") +
          "<span>" + esc(doc.group) + "</span></div>" +
        '<div class="prose prose-head">' + titleHtml + "</div>" +
        '<div class="chips">' + chips.join("") + "</div>" +
        '<div id="body" style="margin-top:30px"></div>' +
        '<div class="done-card' + (isDone ? " is" : "") + '" id="doneCard">' +
          '<button class="done-btn" id="btnDone">' + icon("check") +
            "<span>" + (isDone ? "Đã học xong" : "Đánh dấu đã học") + "</span></button>" +
          '<div class="done-txt"><b id="doneT">' + (isDone ? "Hoàn thành!" : "Bạn đã đọc hết bài này chưa?") + "</b>" +
            '<span id="doneS"></span></div>' +
          '<button class="star-btn' + (isStar ? " on" : "") + '" id="btnStar" title="Đánh dấu để xem lại">' +
            icon("star") + "</button>" +
        "</div>" +
        '<div class="note"><div class="note-h">' + icon("note") +
          "Ghi chú của bạn<em>tự động lưu trên máy này</em></div>" +
          '<textarea id="note" placeholder="Ghi lại điều bạn rút ra, câu hỏi còn vướng, hoặc con số cần nhớ…"></textarea></div>' +
        '<div class="pn">' +
          (pv ? '<a class="pn-c" href="#/' + pv.slug + '"><span>' + icon("left") + "Bài trước</span><b>" + esc(pv.title) + "</b></a>" : "<span></span>") +
          (nx ? '<a class="pn-c nx" href="#/' + nx.slug + '"><span>Bài tiếp' + icon("right") + "</span><b>" + esc(nx.title) + "</b></a>" : "<span></span>") +
        "</div>" +
      "</article>" +
      '<nav class="toc" id="toc" aria-label="Mục trong bài"></nav>' +
    "</div>";

  $("#body").appendChild(body);
  document.title = doc.title + " — Học Heuristic";

  /* ghi chú */
  var ta = $("#note");
  ta.value = notes[doc.id] || "";
  var nT;
  ta.addEventListener("input", function () {
    clearTimeout(nT);
    nT = setTimeout(function () {
      if (ta.value.trim()) notes[doc.id] = ta.value; else delete notes[doc.id];
      LS.set("notes", notes);
    }, 400);
  });

  /* đánh dấu đã học */
  function paintDone() {
    var is = done.has(doc.id), o = overall();
    $("#doneCard").classList.toggle("is", is);
    $("#btnDone").querySelector("span").textContent = is ? "Đã học xong" : "Đánh dấu đã học";
    $("#doneT").textContent = is ? "Hoàn thành!" : "Bạn đã đọc hết bài này chưa?";
    $("#doneS").textContent = "Tiến độ chung: " + o.n + "/" + o.t + " tài liệu (" + Math.round(o.p * 100) + "%)" +
      (nx && is ? " · tiếp theo: " + nx.title : "");
  }
  $("#btnDone").addEventListener("click", function () {
    if (done.has(doc.id)) done.delete(doc.id); else done.add(doc.id);
    saveDone(); paintDone(); paintProgress(); buildNav();
  });
  $("#btnStar").addEventListener("click", function () {
    var b = $("#btnStar");
    if (stars.has(doc.id)) { stars.delete(doc.id); b.classList.remove("on"); toast("Đã bỏ đánh dấu"); }
    else { stars.add(doc.id); b.classList.add("on"); toast("Đã lưu để xem lại"); }
    saveStars();
  });
  paintDone();

  buildToc(body);
  LS.set("last", { id: doc.id, at: Date.now() });

  if (anchor) {
    var el = document.getElementById(anchor);
    if (el) { setTimeout(function () { el.scrollIntoView({ block: "start" }); window.scrollBy(0, -70); }, 30); return; }
  }
  window.scrollTo(0, 0);
}

function buildToc(body) {
  var hs = $$("h2,h3", body);
  var toc = $("#toc");
  if (hs.length < 3) { toc.style.display = "none"; return; }
  toc.innerHTML = '<div class="toc-h">Trong bài này</div>' + hs.map(function (h) {
    var t = h.textContent.replace(/^\s+/, "");
    return '<a class="' + (h.tagName === "H3" ? "d3" : "") + '" href="#' + h.id +
           '" data-h="' + h.id + '">' + esc(t) + "</a>";
  }).join("");

  $$("a", toc).forEach(function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      var el = document.getElementById(a.dataset.h);
      if (el) { el.scrollIntoView({ block: "start" }); window.scrollBy(0, -70); }
    });
  });

  if (spy) spy.disconnect();
  var seen = {};
  spy = new IntersectionObserver(function (ents) {
    ents.forEach(function (e) { seen[e.target.id] = e.isIntersecting ? e.boundingClientRect.top : null; });
    var best = null;
    hs.forEach(function (h) {
      var r = h.getBoundingClientRect();
      if (r.top <= 140) best = h.id;
    });
    if (!best && hs.length) best = hs[0].id;
    $$("a", toc).forEach(function (a) { a.classList.toggle("on", a.dataset.h === best); });
  }, { rootMargin: "-70px 0px -75% 0px", threshold: [0, 1] });
  hs.forEach(function (h) { spy.observe(h); });
}

/* thanh tiến độ đọc */
var rbT;
window.addEventListener("scroll", function () {
  if (rbT) return;
  rbT = requestAnimationFrame(function () {
    rbT = null;
    var h = document.documentElement.scrollHeight - window.innerHeight;
    var p = h > 0 ? Math.min(1, window.scrollY / h) : 0;
    $("#readbarFill").style.width = (p * 100).toFixed(1) + "%";
  });
}, { passive: true });

/* ---------- 10. Tìm kiếm ---------------------------------------------- */
var HAY = null;
function buildIndex() {
  if (HAY) return HAY;
  HAY = ORDER.map(function (id) {
    var d = DOCS[id];
    var heads = d.outline.map(function (o) { return o.t; }).join(" · ");
    return {
      id: id, d: d,
      title: norm(d.title),
      heads: norm(heads),
      body: norm(d.md)
    };
  });
  return HAY;
}
if (window.requestIdleCallback) requestIdleCallback(buildIndex, { timeout: 4000 });
else setTimeout(buildIndex, 1500);

/* Chỉ khớp khi từ khoá bắt đầu ở RANH GIỚI TỪ. Không có điều này thì các từ
   ngắn rất hay gặp trong tiếng Việt ("bộ", "trị", "cực") sẽ khớp vào giữa
   những từ chẳng liên quan (sandbox, bớt, Bốn) và làm nhiễu kết quả. */
function isWordChar(c) { return (c >= "a" && c <= "z") || (c >= "0" && c <= "9"); }
function findWord(hay, t, from) {
  var i = hay.indexOf(t, from || 0);
  while (i >= 0) {
    if (i === 0 || !isWordChar(hay.charAt(i - 1))) return i;
    i = hay.indexOf(t, i + 1);
  }
  return -1;
}
function countWord(hay, t) {
  var n = 0, i = findWord(hay, t, 0);
  while (i >= 0 && n < 60) { n++; i = findWord(hay, t, i + t.length); }
  return n;
}

/* Gỡ cú pháp markdown khỏi trích đoạn: liên kết, bảng, hình vẽ ASCII. */
function cleanSnippet(s) {
  return s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\]\([^)]*\)/g, "")        /* liên kết bị trích đoạn cắt mất dấu [ */
    .replace(/[[\]`*_#>~]/g, "")
    .replace(/[|│┌┐└┘─━├┤┬┴┼╌▲▼►◄●○→←↑↓]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s.,:;)\]]+/, "")
    .trim();
}

function search(q) {
  var nq = norm(q.trim());
  if (!nq) return [];
  var terms = nq.split(/\s+/).filter(Boolean);
  return buildIndex().map(function (h) {
    var score = 0, pos = -1, all = true;
    terms.forEach(function (t) {
      var inT = findWord(h.title, t) >= 0, inH = findWord(h.heads, t) >= 0;
      var p = findWord(h.body, t);
      if (!inT && !inH && p < 0) { all = false; return; }
      if (inT) score += 120;
      if (inH) score += 34;
      if (p >= 0) {
        score += 10;
        score += Math.min(28, countWord(h.body, t) * 1.6);
        if (pos < 0) pos = p;
      }
    });
    if (!all) return null;
    if (findWord(h.title, nq) >= 0) score += 90;
    if (h.d.kind === "lesson") score += 6;
    var snip = "";
    if (pos >= 0) {
      var raw = h.d.md.slice(Math.max(0, pos - 85), pos + 165);
      snip = cleanSnippet(raw);
    } else {
      snip = cleanSnippet(h.d.outline.slice(0, 4).map(function (o) { return o.t; }).join(" · "));
    }
    return { d: h.d, s: score, snip: snip };
  }).filter(Boolean).sort(function (a, b) { return b.s - a.s; }).slice(0, 24);
}

function hlite(text, q) {
  var terms = norm(q.trim()).split(/\s+/).filter(function (t) { return t.length > 1; });
  if (!terms.length) return esc(text);
  var nm = norm(text), out = "", marks = [];
  terms.forEach(function (t) {
    var i = findWord(nm, t, 0);
    while (i >= 0) { marks.push([i, i + t.length]); i = findWord(nm, t, i + t.length); }
  });
  if (!marks.length) return esc(text);
  marks.sort(function (a, b) { return a[0] - b[0]; });
  var merged = [marks[0]];
  marks.slice(1).forEach(function (m) {
    var last = merged[merged.length - 1];
    if (m[0] <= last[1]) last[1] = Math.max(last[1], m[1]); else merged.push(m);
  });
  var at = 0;
  merged.forEach(function (m) {
    out += esc(text.slice(at, m[0])) + "<mark>" + esc(text.slice(m[0], m[1])) + "</mark>";
    at = m[1];
  });
  return out + esc(text.slice(at));
}

var srchOpen = false, srchSel = 0, srchHits = [];
function openSearch() {
  $("#ovl").hidden = false; srchOpen = true;
  var q = $("#q"); q.value = ""; q.focus();
  runSearch();
}
function closeSearch() { $("#ovl").hidden = true; srchOpen = false; }

function runSearch() {
  var q = $("#q").value, box = $("#res");
  if (!q.trim()) {
    var picks = [];
    var last = LS.get("last", null);
    if (last && DOCS[last.id]) picks.push(DOCS[last.id]);
    Array.from(stars).slice(0, 4).forEach(function (i) { if (DOCS[i]) picks.push(DOCS[i]); });
    ["khoa-hoc/bai-05-greedy", "khoa-hoc/bai-18-can-tren-can-duoi", "tai-lieu/cheatsheet", "2605/06-lien-he-khoa-hoc"]
      .forEach(function (s) { var d = docOf(s); if (d && picks.indexOf(d) < 0) picks.push(d); });
    srchHits = picks.slice(0, 7).map(function (d) { return { d: d, snip: d.outline.slice(0, 3).map(function (o) { return o.t; }).join(" · ") }; });
  } else {
    srchHits = search(q);
  }
  srchSel = 0;
  if (!srchHits.length) {
    box.innerHTML = '<div class="srch-empty">Không tìm thấy “' + esc(q) + '”.<br>Thử từ khoá ngắn hơn — gõ không dấu cũng được.</div>';
    return;
  }
  box.innerHTML = srchHits.map(function (h, i) {
    return '<a class="r-i' + (i === 0 ? " on" : "") + '" href="#/' + h.d.slug + '" data-i="' + i + '">' +
      '<div class="r-i-t"><span>' + hlite(h.d.title, q) + '</span><em>' + esc(h.d.group) + "</em></div>" +
      '<div class="r-i-s">' + hlite(h.snip, q) + "</div></a>";
  }).join("");
  $$(".r-i", box).forEach(function (a) {
    a.addEventListener("click", closeSearch);
    a.addEventListener("mousemove", function () { setSel(+a.dataset.i); });
  });
}
function setSel(i) {
  var items = $$(".r-i");
  if (!items.length) return;
  srchSel = (i + items.length) % items.length;
  items.forEach(function (a, k) { a.classList.toggle("on", k === srchSel); });
  items[srchSel].scrollIntoView({ block: "nearest" });
}

$("#btnSearch").addEventListener("click", openSearch);
$("#btnCloseSrch").addEventListener("click", closeSearch);
$("#ovl").addEventListener("mousedown", function (e) { if (e.target === $("#ovl")) closeSearch(); });
var qT;
$("#q").addEventListener("input", function () { clearTimeout(qT); qT = setTimeout(runSearch, 90); });
$("#q").addEventListener("keydown", function (e) {
  if (e.key === "ArrowDown") { e.preventDefault(); setSel(srchSel + 1); }
  else if (e.key === "ArrowUp") { e.preventDefault(); setSel(srchSel - 1); }
  else if (e.key === "Enter") {
    e.preventDefault();
    var a = $$(".r-i")[srchSel];
    if (a) { location.hash = a.getAttribute("href").slice(1); closeSearch(); }
  }
});

/* ---------- 11. Phím tắt ---------------------------------------------- */
document.addEventListener("keydown", function (e) {
  var tag = (e.target.tagName || "").toLowerCase();
  var typing = tag === "input" || tag === "textarea" || e.target.isContentEditable;
  if (e.key === "Escape") { if (srchOpen) closeSearch(); else document.body.classList.remove("nav-open"); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openSearch(); return; }
  if (typing || srchOpen) return;
  if (e.key === "/") { e.preventDefault(); openSearch(); return; }
  if (!state.doc) return;
  if (e.key === "[" || (e.key === "ArrowLeft" && e.altKey)) {
    var p = prevOf(state.doc.id); if (p) location.hash = "#/" + p.slug;
  } else if (e.key === "]" || (e.key === "ArrowRight" && e.altKey)) {
    var n = nextOf(state.doc.id); if (n) location.hash = "#/" + n.slug;
  }
});

/* ---------- 12. Ngăn kéo trên màn nhỏ --------------------------------- */
$("#btnMenu").addEventListener("click", function () { document.body.classList.toggle("nav-open"); });
$("#scrim").addEventListener("click", function () { document.body.classList.remove("nav-open"); });

/* ---------- 13. Bộ định tuyến ----------------------------------------- */
var state = { doc: null };

function route() {
  var h = location.hash.replace(/^#/, "");
  document.body.classList.remove("nav-open");

  if (!h || h === "/" ) { state.doc = null; viewHome(); buildNav(); paintProgress(); return; }
  if (h[0] !== "/") {                       /* neo thuần trong trang hiện tại */
    var el = document.getElementById(h);
    if (el) { el.scrollIntoView({ block: "start" }); window.scrollBy(0, -70); }
    return;
  }
  var rest = h.slice(1);
  var hi = rest.indexOf("#");
  var slug = hi >= 0 ? rest.slice(0, hi) : rest;
  var anchor = hi >= 0 ? rest.slice(hi + 1) : "";
  var doc = docOf(slug);
  if (!doc) {
    state.doc = null;
    $("#main").innerHTML = '<div class="home"><div class="hero"><h1>Không tìm thấy trang</h1>' +
      "<p>Đường dẫn <code>" + esc(slug) + "</code> không tồn tại.</p>" +
      '<div class="hero-cta"><a class="btn btn-p" href="#/">Về trang chủ</a></div></div></div>';
    buildNav(); return;
  }
  state.doc = doc;
  viewDoc(doc, anchor);
  buildNav();
  paintProgress();
}

window.addEventListener("hashchange", route);
paintProgress();
route();

/* ?q=... mở sẵn ô tìm kiếm với từ khoá — tiện để chia sẻ một đường dẫn
   "tra cứu nhanh", và cũng là cách kiểm thử tự động chức năng tìm kiếm. */
(function () {
  var m = location.search.match(/[?&]q=([^&]*)/);
  if (!m) return;
  var q = decodeURIComponent(m[1].replace(/\+/g, " "));
  if (!q) return;
  openSearch();
  $("#q").value = q;
  runSearch();
})();

})();
