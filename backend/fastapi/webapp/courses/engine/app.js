/* ==========================================================================
   ENGINE KHOÁ HỌC — ứng dụng một trang, không cần build.

   ★ NGUỒN THẬT: courses/engine/app.js. Bản trong <khoá>/assets/ là BẢN SAO do
     `python engine/sync.py` chép ra — sửa ở đó sẽ mất.

   Nội dung KHÔNG còn nằm trong trang. Trước đây mỗi khoá nhúng toàn bộ bài
   giảng vào assets/content.js (8 MB với khoá AI) rồi lập chỉ mục tìm kiếm trên
   trình duyệt. Giờ nội dung ở database, và trang hỏi API ba thứ:
     · GET /courses/<khoá>/manifest       mục lục + siêu dữ liệu, KHÔNG markdown
     · GET /courses/<khoá>/docs/<id>      một bài, khi mở bài đó
     · GET /courses/<khoá>/search?q=      tìm kiếm, xếp hạng phía server
   Trình duyệt tự xác thực lại bằng ETag, nên lần mở sau chỉ tốn một phản hồi 304.

   Mỗi khoá nạp, theo đúng thứ tự:
     ① assets/cau-hinh.js  cấu hình   (window.CAU_HINH — riêng khoá; có `khoaHoc`)
     ② assets/app.js       engine     (file này — dùng chung)
   Có window.COURSE (một content.js xuất bằng `manage_courses.py export --js`)
   thì engine dùng nó thay cho API — cách để trang vẫn chạy offline bằng file://.

   Tính năng thêm (đọc offline, gia sư AI, ôn tập…) là MÔ-ĐUN riêng assets/mo-*.js,
   engine tự nạp sau khi chạy (mục 15) và cho chúng một API nhỏ: window.KhoaHoc.
   ========================================================================== */
(function () {
"use strict";

/* Đổ vào khi manifest về — xem khoiDong(). */
var D = null;

/* ---------- 0. Cấu hình của khoá -------------------------------------
   Mọi thứ RIÊNG của một khoá nằm ở đây, không nằm rải trong engine.
   Thiếu cau-hinh.js thì trang vẫn chạy bằng giá trị mặc định dưới đây —
   xấu nhưng không trắng trang. */
var CH = window.CAU_HINH || {};
function ch(k, macDinh) { return CH[k] === undefined ? macDinh : CH[k]; }

var TEN_NGAN  = ch("tenNgan", "Khoá học");
var TIEU_DE   = ch("tieuDe", TEN_NGAN);
var KHOA_LUU  = ch("khoaLuu", "kh");      /* tiền tố localStorage — PHẢI khác nhau
                                             giữa các khoá, nếu không tiến độ khoá
                                             này ghi đè tiến độ khoá kia khi cùng
                                             phục vụ từ một host. */
var DOCS   = {};
var BIET_DANH = {};      /* slug cũ → id bài: bài đã đổi slug vẫn mở được bằng link cũ */
var SLUGS  = {};
var ORDER  = [];

var $  = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var esc = function (s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
};
/* Tên icon nằm trong một thuộc tính; tên đến từ database (icon của section)
   nên chỉ giữ chữ, số và "-" — không thể thoát khỏi thuộc tính. */
var icon = function (n, cls) {
  return '<svg class="ic ' + esc(cls || "") + '"><use href="#i-' + String(n || "").replace(/[^a-z0-9-]/gi, "") + '"/></svg>';
};

/* ---------- 1. Lưu trạng thái ---------------------------------------- */
var LS = {
  get: function (k, d) {
    try { var v = localStorage.getItem(KHOA_LUU + "." + k); return v == null ? d : JSON.parse(v); }
    catch (e) { return d; }
  },
  set: function (k, v) {
    try { localStorage.setItem(KHOA_LUU + "." + k, JSON.stringify(v)); } catch (e) {}
  }
};
var done  = new Set(LS.get("done", []));
var stars = new Set(LS.get("stars", []));
var notes = LS.get("notes", {});
var open  = LS.get("open", null);

function saveDone()  { LS.set("done", Array.from(done)); }
function saveStars() { LS.set("stars", Array.from(stars)); }

/* ---------- 1b. Nguồn nội dung ----------------------------------------
   Hai nguồn cùng một giao diện: manifest() · doc(id) · search(q) · prefetch(id).
   Engine không cần biết nội dung đến từ API hay từ một content.js offline. */

/* Gốc API: ?api=… trên địa chỉ (trang mở từ máy chủ tĩnh, API ở chỗ khác)
   > cấu hình FastAPI chèn vào trang (window.__WEBAPP_CONFIG__.apiBase)
   > cau-hinh.js > cùng origin. Chuỗi RỖNG là câu trả lời hợp lệ ("cùng origin,
   không tiền tố"), nên phân biệt bằng typeof chứ không bằng truthy.

   ?api= chỉ được nghe khi không thể là một cái bẫy: API ở máy cục bộ
   (localhost, 127.0.0.1, [::1]) hoặc trang mở từ file://. Một đường link
   "?api=https://may-chu-la" gửi cho người khác bị bỏ qua — nghe theo thì trang
   sẽ lấy bài (rồi dựng HTML) từ máy chủ lạ, ngay trên origin của trang này. */
function apiTuDiaChi() {
  var q = (location.search.match(/[?&]api=([^&]+)/) || [])[1];
  if (!q) return null;
  var u;
  try { u = new URL(decodeURIComponent(q)); } catch (e) { return null; }
  var cucBo = /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(u.hostname);
  if ((u.protocol === "http:" || u.protocol === "https:") && (cucBo || location.protocol === "file:")) {
    return (u.origin + u.pathname).replace(/\/+$/, "");
  }
  if (window.console) console.warn("Bỏ qua ?api=" + u.origin + ": chỉ nhận API ở máy cục bộ hoặc khi trang mở từ file://");
  return null;
}
function gocApi() {
  var q = apiTuDiaChi();
  if (q !== null) return q;
  var cfg = window.__WEBAPP_CONFIG__;
  if (cfg && typeof cfg.apiBase === "string") return cfg.apiBase.replace(/\/+$/, "");
  return String(ch("apiBase", "")).replace(/\/+$/, "");
}

function LoiTai(msg, status) { this.message = msg; this.status = status || 0; }

/* ?nhap=1 — link "Xem trước" của trang Quản lý khoá học: gửi kèm token phiên mà
   trang quản lý đã cất cho ĐÚNG gốc API này ("qlkh.phien@<gốc API>.token"), để xem
   được khoá chưa xuất bản. Không có ?nhap=1 thì trang đọc như mọi khách. */
function tokenXemNhap(goc) {
  if (!/[?&]nhap=1(&|$)/.test(location.search)) return null;
  try {
    var khoa = "qlkh.phien@" + new URL(goc || "/", location.href).href.replace(/\/+$/, "") + ".token";
    return JSON.parse(localStorage.getItem(khoa) || "null");
  } catch (e) { return null; }
}

function nguonApi(goc, khoa) {
  var BO_NHO = 40, cache = {}, thuTu = [], dangTai = {};
  var dau = {}, tk = tokenXemNhap(goc);
  if (tk) dau["X-Admin-Session"] = tk;
  function url(p) { return goc + "/courses/" + encodeURIComponent(khoa) + p; }
  function lay(p, signal) {
    return fetch(url(p), { signal: signal, credentials: "same-origin", headers: dau }).then(function (r) {
      if (r.ok) return r.json();
      return r.json().then(function (j) { throw new LoiTai((j && (j.message || j.detail)) || ("HTTP " + r.status), r.status); },
                          function () { throw new LoiTai("HTTP " + r.status, r.status); });
    }, function (e) {
      if (e && e.name === "AbortError") throw e;
      throw new LoiTai("Không kết nối được tới máy chủ (" + (goc || location.origin) + ")", 0);
    });
  }
  function nho(id, d) {
    cache[id] = d; thuTu.push(id);
    while (thuTu.length > BO_NHO) delete cache[thuTu.shift()];
    return d;
  }
  /* id bài là đường dẫn ("mon-05/bai-giang/bai-04.md"): mã hoá từng đoạn,
     GIỮ dấu "/" để API nhận đúng tham số {doc_id:path}. */
  function maHoa(id) { return id.split("/").map(encodeURIComponent).join("/"); }
  var api = {
    kieu: "api",
    moTa: url(""),
    manifest: function () { return lay("/manifest"); },
    doc: function (id) {
      if (cache[id]) return Promise.resolve(cache[id]);
      if (dangTai[id]) return dangTai[id];
      var p = lay("/docs/" + maHoa(id)).then(function (d) { delete dangTai[id]; return nho(id, d); },
                                              function (e) { delete dangTai[id]; throw e; });
      dangTai[id] = p;
      return p;
    },
    search: function (q, signal) {
      return lay("/search?limit=24&q=" + encodeURIComponent(q), signal).then(function (r) { return r.hits || []; });
    },
    prefetch: function (id) { if (id && !cache[id]) api.doc(id).catch(function () {}); },
    /* Địa chỉ thật của mục lục / một bài — mô-đun đọc offline tải thẳng qua service
       worker (bỏ qua bộ nhớ đệm trong trang) để bản lưu nằm ở bộ nhớ đệm của worker. */
    manifestUrl: function () { return url("/manifest"); },
    docUrl: function (id) { return url("/docs/" + maHoa(id)); },
    dauRequest: dau,
    /* Tệp tải lên khoá ("assets/hinh.png" trong markdown). */
    asset: function (ten) { return url("/assets/" + encodeURIComponent(ten)); },
    /* Bản nháp: ảnh của khoá chưa xuất bản chỉ trả cho quản trị viên, mà <img>
       không gửi được header — tải bằng fetch kèm token rồi dùng blob. */
    taiAnh: tk ? function (u) {
      return fetch(u, { headers: dau, credentials: "same-origin" }).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.blob();
      }).then(function (b) { return URL.createObjectURL(b); });
    } : null
  };
  return api;
}

function nguonCucBo(C) {
  return {
    kieu: "cuc-bo",
    moTa: "window.COURSE",
    manifest: function () { return Promise.resolve(C); },
    doc: function (id) { return C.docs[id] ? Promise.resolve(C.docs[id]) : Promise.reject(new LoiTai("Không có bài " + id, 404)); },
    search: function (q) { return Promise.resolve(searchLocal(q)); },
    prefetch: function () {},
    asset: function (ten) { return "assets/" + ten; },
    taiAnh: null
  };
}

var NGUON = window.COURSE ? nguonCucBo(window.COURSE) : nguonApi(gocApi(), ch("khoaHoc", ""));

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

/* Bỏ dấu tiếng Việt (1 ký tự → 1 ký tự, giữ độ dài): dùng chung với hien-thi.js. */
var norm = HienThi.norm;

/* ---------- 4. Điều hướng tài liệu ------------------------------------ */
function docOf(slug) { return DOCS[SLUGS[slug]] || DOCS[BIET_DANH[slug]] || null; }
function idxOf(id)   { return ORDER.indexOf(id); }
function prevOf(id)  { var i = idxOf(id); return i > 0 ? DOCS[ORDER[i - 1]] : null; }
function nextOf(id)  { var i = idxOf(id); return i >= 0 && i < ORDER.length - 1 ? DOCS[ORDER[i + 1]] : null; }

/* ---------- 5. Dựng HTML từ markdown ---------------------------------
   Phần dựng bài nằm ở hien-thi.js (dùng chung với khung xem trước của trang
   Quản lý khoá học): bộ lọc HTML, công thức, khối mã, hộp chú ý, neo tiêu đề,
   liên kết giữa các bài, tệp tải lên khoá (assets/…). */
function render(md, docId) {
  return HienThi.render(md, {
    docId: docId, docs: DOCS, icon: icon, toast: toast,
    assetUrl: NGUON.asset, taiAnh: NGUON.taiAnh
  });
}

/* ---------- 6. Tiến độ ------------------------------------------------ */
/* Bài có thật trong DOCS — cây có thể nhắc tới id không còn (bản offline cũ). */
function coThat(ids) { return (ids || []).filter(function (id) { return !!DOCS[id]; }); }
/* href="#/slug" — slug đến từ database, nên luôn qua esc(). */
function denBai(d) { return 'href="#/' + esc(d.slug) + '"'; }

function groupStat(ids) {
  var n = 0;
  ids.forEach(function (i) { if (done.has(i)) n++; });
  return { n: n, t: ids.length, p: ids.length ? n / ids.length : 0 };
}
function sectionIds(sec) {
  var out = [];
  (sec.groups || []).forEach(function (g) { out = out.concat(coThat(g.items)); });
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
  var html = (D.nav || []).map(function (sec, si) {
    var ids = sectionIds(sec), st = groupStat(ids);
    var has = cur && ids.indexOf(cur) >= 0;
    /* Mặc định mở section ĐẦU — trước đây là section có id "khoa-hoc" (quy ước của
       các khoá dựng tay), nên khoá tạo ở trang Quản lý với id khác hiện mục lục đóng kín. */
    var isOpen = open ? open.indexOf(sec.id) >= 0 : has || si === 0;
    if (has) isOpen = true;

    var body = (sec.groups || []).map(function (g) {
      var ids = coThat(g.items), gs = groupStat(ids);
      var items = ids.map(function (id) {
        var d = DOCS[id];
        var no = d.meta && d.meta.no ? '<b class="no">' + esc(d.meta.no) + "</b>" : "";
        return '<a class="nav-i' + (done.has(id) ? " done" : "") + (id === cur ? " on" : "") +
               '" ' + denBai(d) + ">" +
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

    return '<div class="nav-sec" data-sec="' + esc(sec.id) + '" data-open="' + (isOpen ? 1 : 0) + '">' +
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

/* Ve so do mermaid sau khi noi dung da nam trong DOM.
   Goi lai duoc nhieu lan; moi khoi chi ve mot lan (danh dau data-da-ve). */
function veMermaid() { HienThi.veMermaid($("#body")); }

/* ---------- 8. Trang chủ ---------------------------------------------- */
function viewHome() {
  var o = overall();
  var last = LS.get("last", null);
  var lastDoc = last && DOCS[last.id] ? DOCS[last.id] : null;
  var s = D.stats || {};

  var kpis = (CH.kpi ? CH.kpi(s) : [
    [s.lessons || 0, "bài giảng"],
    ["~" + Math.round((s.minutes || 0) / 60), "giờ đọc"],
    [((s.words || 0) / 1000).toFixed(0) + "k", "từ nội dung"]
  ]).map(function (k) {
    return '<div class="kpi"><b>' + esc(k[0]) + "</b><span>" + esc(k[1]) + "</span></div>";
  }).join("");

  /* Khoá vừa tạo có thể chưa có section, nhóm có thể chưa có bài (người quản
     trị lưu cây trước rồi mới thêm bài): trang chủ phải dựng được cả lúc đó. */
  var course = (D.nav || [])[0] || { groups: [] };
  var phases = (course.groups || []).map(function (g, i) {
    var ids = coThat(g.items), gs = groupStat(ids);
    var lst = ids.slice(0, 6).map(function (id) {
      var d = DOCS[id];
      return "<a " + denBai(d) + ">" +
             (d.meta && d.meta.no ? "Bài " + esc(d.meta.no) : esc(chipLabel(d.title))) + "</a>";
    }).join("");
    if (ids.length > 6) {                           /* báo rõ còn bao nhiêu, đừng cắt im lặng */
      lst += "<a " + denBai(DOCS[ids[6]]) + ">+" + (ids.length - 6) + " nữa</a>";
    }
    if (!ids.length) lst = "<span>Chưa có bài</span>";
    var first = DOCS[ids[0]];
    /* Thẻ phải là <div>: bên trong đã có các liên kết bài học, mà <a> lồng
       trong <a> là HTML không hợp lệ — trình duyệt sẽ tự đóng thẻ ngoài và
       làm vỡ bố cục. Liên kết ở tiêu đề được kéo giãn bằng ::after để cả thẻ
       vẫn bấm được. */
    return '<div class="card">' +
      '<div class="card-top"><div class="card-n">' + soThe(i) + "</div>" +
      "<h3>" + (first ? "<a " + denBai(first) + ">" + esc(boTienTo(g.title)) + "</a>" : esc(boTienTo(g.title))) +
      "</h3></div>" +
      '<p>' + esc(phaseBlurb(g.short)) + "</p>" +
      '<div class="card-lst">' + lst + "</div>" +
      '<div class="card-foot" style="margin-top:13px"><div class="bar"><i style="width:' +
      (gs.p * 100).toFixed(0) + '%"></i></div><b>' + gs.n + "/" + gs.t + "</b></div></div>";
  }).join("");

  var latDoAn = ch("doAnLat", [1, 2]);
  var cases = D.nav.slice(latDoAn[0], latDoAn[1]).filter(function (sec) {
    return sectionIds(sec).length > 0;          /* mục rỗng -> bỏ qua, đừng làm vỡ trang */
  }).map(function (sec) {
    var ids = sectionIds(sec), gs = groupStat(ids), first = DOCS[ids[0]];
    return '<a class="card" ' + denBai(first) + ">" +
      '<div class="card-top"><div class="card-n">' + icon(sec.icon) + "</div><h3>" + esc(sec.title) + "</h3></div>" +
      "<p>" + esc(sec.sub) + (ch("doAnMoTa", "") ? (sec.sub ? " — " : "") + ch("doAnMoTa", "") : "") + "</p>" +
      '<div class="card-foot"><div class="bar"><i style="width:' + (gs.p * 100).toFixed(0) +
      '%"></i></div><b>' + gs.n + "/" + gs.t + "</b></div></a>";
  }).join("");

  var refSec = D.nav[ch("traCuuChiSo", 2)];
  var refIds = refSec ? sectionIds(refSec) : [];
  var refs = refIds.map(function (id) {
    var d = DOCS[id];
    return "<a " + denBai(d) + ">" + esc(d.title) + "</a>";
  }).join("");

  $("#main").innerHTML =
    '<div class="home">' +
      '<div class="hero">' +
        "<h1>" + ch("heroTieuDe", esc(CH.tieuDe !== undefined ? TIEU_DE : TEN_NGAN)) + "</h1>" +
        "<p>" + (CH.heroMoTa !== undefined ? CH.heroMoTa : esc((D.course || {}).description || (D.course || {}).subtitle || "")) + "</p>" +
        '<div class="hero-cta">' +
          (DOCS[ORDER[0]] ? '<a class="btn btn-p" ' + denBai(DOCS[ORDER[0]]) + ">" + icon("right") + "Bắt đầu học</a>" : "") +
          ch("heroNut", []).map(function (n) {
            /* Nút trỏ tới tài liệu KHÔNG CÓ THẬT thì bỏ hẳn, đừng in ra liên kết chết. */
            if (n.href.indexOf("#/") === 0 && !docOf(n.href.slice(2))) return "";
            return '<a class="btn btn-s" href="' + n.href + '">' +
                   (n.icon ? icon(n.icon) : "") + esc(n.text) + "</a>";
          }).join("") +
        "</div>" +
      "</div>" +
      '<div class="kpis">' + kpis + "</div>" +
      (lastDoc ?
        '<a class="resume" ' + denBai(lastDoc) + ">" +
        '<div class="resume-i">' + icon("right") + "</div>" +
        '<div class="resume-t"><span>Học tiếp</span><b>' + esc(lastDoc.title) + "</b></div>" +
        '<div class="chip ac">' + Math.round(o.p * 100) + "% hoàn thành</div></a>" : "") +
      '<div class="sec-h"><h2>' + esc(ch("loTrinhTieuDe", "Lộ trình khoá học")) + "</h2><span>" +
        o.n + "/" + o.t + " tài liệu đã đọc</span>" +
        (o.n ? '<a href="#" id="lnkReset">Đặt lại tiến độ</a>' : "") + "</div>" +
      '<div class="grid">' + phases + "</div>" +
      (cases ? '<div class="sec-h"><h2>' + esc(ch("doAnTieuDe", "Đồ án")) + "</h2><span>" +
               esc(ch("doAnPhu", "")) + "</span></div>" +
               '<div class="grid">' + cases + "</div>" : "") +
      (refs ? '<div class="sec-h"><h2>' + esc(ch("traCuuTieuDe", "Tài liệu tra cứu")) + "</h2><span>" +
              esc(ch("traCuuPhu", "mở khi đang làm bài")) + "</span></div>" +
              '<div class="card full"><div class="card-lst">' + refs + "</div></div>" : "") +
    "</div>";

  var rs = $("#lnkReset");
  if (rs) rs.addEventListener("click", function (e) {
    e.preventDefault();
    if (!confirm("Xoá toàn bộ đánh dấu đã học? Ghi chú của bạn vẫn được giữ.")) return;
    done.clear(); saveDone(); paintProgress(); buildNav(); viewHome();
    toast("Đã đặt lại tiến độ");
  });

  document.title = TIEU_DE;
  $("#readbarFill").style.width = "0%";
  phat("trang-chu", $("#main"));
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
  return (CH.moTaNhom || {})[k] || "";
}

/* Số hiển thị trên thẻ nhóm ở trang chủ. Mặc định: thẻ đầu là icon la bàn
   (nhóm "bắt đầu"), còn lại đánh số hai chữ số. */
function soThe(i) {
  if (CH.soThe) return CH.soThe(i, icon);
  return i === 0 ? icon("compass") : String(i).padStart(2, "0");
}

/* Bỏ tiền tố đánh số khỏi tiêu đề nhóm ("M03 — Học máy" -> "Học máy"). */
function boTienTo(t) {
  var re = CH.boTienTo;
  return re ? t.replace(re, "") : t;
}


/* ---------- 9. Trang bài đọc ------------------------------------------ */
var spy = null;

/* Mở một bài: markdown đến từ nguồn nội dung (API: một request; cục bộ: có sẵn).
   `luotXem` chặn trường hợp người dùng đã sang bài khác trong lúc bài này đang
   tải — phản hồi về muộn không được đè lên trang mới. */
var luotXem = 0;
function viewDoc(doc, anchor) {
  var luot = ++luotXem;
  var tre = setTimeout(function () {             /* chỉ hiện khung chờ khi mạng chậm thật */
    if (luot !== luotXem) return;
    $("#main").innerHTML = '<div class="page"><article class="doc"><div class="crumb"><a href="#/">Trang chủ</a>' +
      icon("chev") + "<span>" + esc(doc.group || "") + '</span></div><div class="prose prose-head"><h1>' +
      esc(doc.title) + '</h1></div><div class="sk">' + '<i></i><i></i><i class="w6"></i><i></i><i class="w8"></i>' +
      "</div></article></div>";
  }, 120);
  NGUON.doc(doc.id).then(function (day) {
    clearTimeout(tre);
    if (luot !== luotXem) return;
    /* Siêu dữ liệu đã có trong manifest; bản đầy đủ mang thêm md và outline. */
    var d = {};
    Object.keys(doc).forEach(function (k) { d[k] = doc[k]; });
    Object.keys(day).forEach(function (k) { if (day[k] !== undefined) d[k] = day[k]; });
    veDoc(d, anchor);
    var nx = nextOf(doc.id);
    if (nx) setTimeout(function () { NGUON.prefetch(nx.id); }, 600);     /* "Bài tiếp" mở tức thì */
  }, function (err) {
    clearTimeout(tre);
    if (luot !== luotXem) return;
    veLoi("Không tải được bài “" + doc.title + "”", err, function () { viewDoc(doc, anchor); });
  });
}

/* Trang báo lỗi có nút thử lại — dùng cho cả manifest lẫn từng bài. */
function veLoi(tieuDe, err, thuLai) {
  var msg = err && err.message ? err.message : String(err || "");
  var meo = NGUON.kieu === "api" && location.protocol === "file:" ?
    "Trang đang mở bằng file:// nên không gọi được API cùng origin. Mở qua FastAPI " +
    "(<code>/webapp/courses/…</code>) hoặc thêm <code>?api=http://127.0.0.1:6789</code> vào địa chỉ." :
    (err && err.status === 404 ?
      "Khoá học không có trong database, hoặc còn là bản nháp — bản nháp chỉ xem được qua nút " +
      "“Mở trang” của trang Quản lý khoá học khi đã đăng nhập.<br>" : "") +
    "Nguồn: <code>" + esc(NGUON.moTa) + "</code>";
  $("#main").innerHTML = '<div class="home"><div class="hero"><h1>' + esc(tieuDe) + "</h1>" +
    "<p>" + esc(msg) + "</p><p>" + meo + "</p>" +
    '<div class="hero-cta"><button class="btn btn-p" id="btnThuLai">' + icon("reset") + "Thử lại</button>" +
    '<a class="btn btn-s" href="#/">Về trang chủ</a></div></div></div>';
  var b = $("#btnThuLai");
  if (b && thuLai) b.addEventListener("click", thuLai);
}

function veDoc(doc, anchor) {
  var sec = D.nav.filter(function (s) { return s.id === doc.section; })[0];
  var m = doc.meta || {};
  var chips = [];
  if (m.no) chips.push('<span class="chip ac">Bài ' + esc(m.no) + "/" + esc(m.of || (D.stats || {}).lessons || "?") + "</span>");
  if (m.truc) chips.push('<span class="chip">Trục ' + esc(m.truc) + "</span>");
  if (m.hours) chips.push('<span class="chip">' + icon("clock") + esc(m.hours) + "</span>");
  var lv = Math.max(0, Math.min(5, parseInt(m.level, 10) || 0));   /* số từ database: kẹp 0..5 */
  if (lv) chips.push('<span class="chip"><span class="stars">' + "★".repeat(lv) + "☆".repeat(5 - lv) + "</span></span>");
  chips.push('<span class="chip">' + icon("book") + "~" + esc(doc.minutes || 0) + " phút đọc</span>");
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
          (pv ? '<a class="pn-c" ' + denBai(pv) + "><span>" + icon("left") + "Bài trước</span><b>" + esc(pv.title) + "</b></a>" : "<span></span>") +
          (nx ? '<a class="pn-c nx" ' + denBai(nx) + "><span>Bài tiếp" + icon("right") + "</span><b>" + esc(nx.title) + "</b></a>" : "<span></span>") +
        "</div>" +
      "</article>" +
      '<nav class="toc" id="toc" aria-label="Mục trong bài"></nav>' +
    "</div>";

  $("#body").appendChild(body);
  document.title = doc.title + " — " + TEN_NGAN;

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
  veMermaid();                    /* so do chi ve duoc khi da nam trong DOM */
  LS.set("last", { id: doc.id, at: Date.now() });
  phat("bai", doc, $("#body"));

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

/* ---------- 10. Tìm kiếm ----------------------------------------------
   Nguồn API: server xếp hạng (cùng quy tắc như dưới đây, viết lại bằng Python
   trong src/domain/utils/course_text.py) — trình duyệt không cần giữ nội dung.
   Nguồn cục bộ (window.COURSE): lập chỉ mục ngay trên trình duyệt như trước. */
var HAY = null;
function buildIndex() {
  if (HAY) return HAY;
  HAY = ORDER.map(function (id) {
    var d = DOCS[id];
    var heads = (d.outline || []).map(function (o) { return o.t; }).join(" · ");
    return {
      id: id, d: d,
      title: norm(d.title),
      heads: norm(heads),
      body: norm(d.md || "")
    };
  });
  return HAY;
}

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

function searchLocal(q) {
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

/* Mỗi lần gõ huỷ request trước (AbortController) và đánh số lượt tìm: một
   phản hồi về muộn của từ khoá cũ không được đè lên kết quả của từ khoá mới. */
var luotTim = 0, huyTim = null;
function runSearch() {
  var q = $("#q").value, box = $("#res");
  var luot = ++luotTim;
  if (huyTim) { huyTim.abort(); huyTim = null; }
  if (!q.trim()) {
    var picks = [];
    var last = LS.get("last", null);
    if (last && DOCS[last.id]) picks.push(DOCS[last.id]);
    Array.from(stars).slice(0, 4).forEach(function (i) { if (DOCS[i]) picks.push(DOCS[i]); });
    ch("goiYTimKiem", [])
      .forEach(function (s) { var d = docOf(s); if (d && picks.indexOf(d) < 0) picks.push(d); });
    srchHits = picks.slice(0, 7).map(function (d) {
      return { d: d, snip: d.outline ? d.outline.slice(0, 3).map(function (o) { return o.t; }).join(" · ") : (d.group || "") };
    });
    veKetQua(q, box);
    return;
  }
  if (window.AbortController) huyTim = new AbortController();
  if (!box.querySelector(".r-i")) box.innerHTML = '<div class="srch-empty">Đang tìm…</div>';
  NGUON.search(q, huyTim ? huyTim.signal : undefined).then(function (hits) {
    if (luot !== luotTim) return;
    srchHits = hits.map(function (h) {
      if (h.d) return h;                                      /* nguồn cục bộ: đã đúng dạng */
      var d = DOCS[h.id];
      return d ? { d: d, s: h.score, snip: h.snippet } : null;
    }).filter(Boolean);
    veKetQua(q, box);
  }, function (err) {
    if (luot !== luotTim || (err && err.name === "AbortError")) return;
    box.innerHTML = '<div class="srch-empty">Không tìm được: ' + esc(err && err.message || err) + "</div>";
  });
}
function veKetQua(q, box) {
  srchSel = 0;
  if (!srchHits.length) {
    box.innerHTML = '<div class="srch-empty">Không tìm thấy “' + esc(q) + '”.<br>Thử từ khoá ngắn hơn — gõ không dấu cũng được.</div>';
    return;
  }
  box.innerHTML = srchHits.map(function (h, i) {
    return '<a class="r-i' + (i === 0 ? " on" : "") + '" ' + denBai(h.d) + ' data-i="' + i + '">' +
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
$("#q").addEventListener("input", function () {
  clearTimeout(qT);
  qT = setTimeout(runSearch, NGUON.kieu === "api" ? 180 : 90);     /* gom phím trước khi gọi mạng */
});
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
  if (!D) return;                           /* manifest chưa về — khoiDong() sẽ gọi lại */
  var h = location.hash.replace(/^#/, "");
  document.body.classList.remove("nav-open");

  if (!h || h === "/" ) { state.doc = null; viewHome(); buildNav(); paintProgress(); return; }
  if (h[0] !== "/") {                       /* neo thuần trong trang hiện tại */
    var el = document.getElementById(h);
    if (el) { el.scrollIntoView({ block: "start" }); window.scrollBy(0, -70); }
    return;
  }
  if (h.indexOf("/~") === 0) {             /* trang của một mô-đun: #/~on-tap, #/~so-tay… */
    var ten = h.slice(2).split(/[?#/]/)[0];
    state.doc = null;
    if (MO.trang[ten]) MO.trang[ten]($("#main"), h.slice(2 + ten.length));
    else $("#main").innerHTML = '<div class="home"><div class="boot">' + icon("book") + "Đang tải…</div></div>";
    buildNav(); paintProgress();
    return;
  }
  var rest = h.slice(1);
  var hi = rest.indexOf("#");
  var slug = hi >= 0 ? rest.slice(0, hi) : rest;
  var anchor = hi >= 0 ? rest.slice(hi + 1) : "";
  var doc = docOf(slug);
  if (doc && doc.slug !== slug) {                   /* slug cũ: chuyển sang địa chỉ hiện tại */
    history.replaceState(null, "", "#/" + doc.slug + (anchor ? "#" + anchor : ""));
  }
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

/* Bài đổi id (trang Quản lý → "Đổi id"): tiến độ, đánh dấu và ghi chú của người học
   cất theo id cũ — chuyển sang id mới một lần, rồi cất lại. */
function chuyenTienDo(doi) {
  var ids = Object.keys(doi || {});
  if (!ids.length) return;
  var doiDone = false, doiStar = false, doiNote = false;
  ids.forEach(function (cu) {
    var moi = doi[cu];
    if (!moi || cu === moi) return;
    if (done.has(cu)) { done.delete(cu); done.add(moi); doiDone = true; }
    if (stars.has(cu)) { stars.delete(cu); stars.add(moi); doiStar = true; }
    if (notes[cu] !== undefined) { if (notes[moi] === undefined) notes[moi] = notes[cu]; delete notes[cu]; doiNote = true; }
  });
  if (doiDone) saveDone();
  if (doiStar) saveStars();
  if (doiNote) LS.set("notes", notes);
  var last = LS.get("last", null);
  if (last && doi[last.id]) { last.id = doi[last.id]; LS.set("last", last); }
}

/* Trang đọc chung (courses/khoa-hoc/?khoa=…) không có cau-hinh.js riêng cho từng
   khoá: tên, phụ đề, biểu tượng lấy từ chính khoá học trong database — khoá vừa tạo
   ở trang Quản lý có ngay trang đọc. Trang có cấu hình riêng (tenNgan…) giữ nguyên
   chữ của nó; chỉ số tài liệu trên ô tìm kiếm luôn lấy theo thực tế. */
function apDungThongTinKhoa(c) {
  if (CH.tenNgan === undefined && c.title) {
    TEN_NGAN = c.title;
    var b = $(".brand-txt b"), i = $(".brand-txt i"), mk = $("#brandMark");
    if (b) b.textContent = c.title;
    if (i) i.textContent = c.subtitle || "";
    if (mk && c.icon) mk.textContent = c.icon;
  }
  if (CH.tieuDe === undefined && c.title) {
    /* "Học X — từ số 0 đến Y" + phụ đề "từ số 0 đến Y" không được thành tiêu đề lặp. */
    var lap = c.subtitle && norm(c.title).indexOf(norm(c.subtitle).trim()) >= 0;
    TIEU_DE = c.title + (c.subtitle && !lap ? " — " + c.subtitle : "");
  }
  var o = $("#btnSearch span");
  if (o) o.textContent = ORDER.length ? "Tìm trong " + ORDER.length + " tài liệu…" : "Tìm trong khoá học…";
  document.title = TIEU_DE;
}

/* ---------- 15. Mô-đun: window.KhoaHoc --------------------------------
   Mô-đun (assets/mo-*.js) dùng engine qua API này thay vì đọc biến nội bộ:
     KhoaHoc.nghe("san-sang" | "trang-chu" | "bai" | "tien-do", fn)
       san-sang  manifest đã về (gọi ngay nếu đã về rồi)
       trang-chu fn(mainEl) — trang chủ vừa dựng
       bai       fn(doc, bodyEl) — một bài vừa dựng xong (công thức, sơ đồ đã vẽ)
       tien-do   fn(id, daXong) — người học đánh dấu một bài
     KhoaHoc.dangKyTrang(ten, fn(mainEl, phanSau))   → trang "#/~ten"
     KhoaHoc.themNut({ma, nhan, title, khi})           → nút trên header
   Lỗi trong một mô-đun không được làm hỏng engine: mọi lời gọi đều có try. */
var MO = { trang: {}, nghe: {} };
function phat(su) {
  var thamSo = Array.prototype.slice.call(arguments, 1);
  (MO.nghe[su] || []).forEach(function (fn) {
    try { fn.apply(null, thamSo); } catch (e) { if (window.console) console.error(e); }
  });
}
window.KhoaHoc = {
  khoa: ch("khoaHoc", ""),
  cauHinh: ch,
  gocApi: gocApi,
  nguon: function () { return NGUON; },
  manifest: function () { return D; },
  docs: function () { return DOCS; },
  thuTu: function () { return ORDER; },
  docOf: docOf,
  baiDangDoc: function () { return state.doc; },
  daXong: function (id) { return done.has(id); },
  danhDau: function (id, xong) {
    if (!DOCS[id]) return;
    if (xong) done.add(id); else done.delete(id);
    saveDone(); paintProgress(); buildNav();
    phat("tien-do", id, !!xong);
  },
  coSao: function (id) { return stars.has(id); },
  ghiChu: function () { return notes; },
  LS: LS, esc: esc, icon: icon, toast: toast, norm: norm, render: render, denBai: denBai,
  veMermaid: function (goc) { HienThi.veMermaid(goc || $("#body")); },
  nghe: function (su, fn) {
    (MO.nghe[su] = MO.nghe[su] || []).push(fn);
    if (su === "san-sang" && D) { try { fn(); } catch (e) { if (window.console) console.error(e); } }
  },
  dangKyTrang: function (ten, fn) {
    MO.trang[ten] = fn;
    if (D && location.hash.indexOf("#/~" + ten) === 0) route();   /* mở thẳng bằng địa chỉ */
  },
  themNut: function (o) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "ic-btn" + (o.chu ? " ic-chu" : "");
    if (o.ma) b.id = o.ma;
    b.title = o.title || "";
    b.setAttribute("aria-label", o.title || o.chu || "");
    b.innerHTML = o.icon ? icon(o.icon) : esc(o.chu || "");
    b.addEventListener("click", o.khi);
    var phai = $(".hdr-right"), theme = $("#btnTheme");
    if (phai) phai.insertBefore(b, theme && theme.parentNode === phai ? theme : null);
    return b;
  },
  /* Thêm một biểu tượng vào sprite của trang (<symbol id="i-ten">, nét 24×24 như
     các biểu tượng sẵn có) — mô-đun không phải sửa index.html của từng khoá. */
  themBieuTuong: function (ten, net) {
    if (document.getElementById("i-" + ten)) return;
    var co = document.querySelector("symbol"), sprite = co && co.parentNode;
    if (!sprite) return;
    var s = document.createElementNS("http://www.w3.org/2000/svg", "symbol");
    s.setAttribute("id", "i-" + ten);
    s.setAttribute("viewBox", "0 0 24 24");
    s.innerHTML = net;
    sprite.appendChild(s);
  },
  dieuHuong: function () { route(); }
};

/* Nạp mô-đun cạnh engine (cùng thư mục assets/). cau-hinh.js có thể đổi danh sách:
   moDun: [] tắt hết. pwa.js không phải mô-đun engine (dùng chung với OPIc, lab):
   đăng ký service worker và nút cài ứng dụng. mo-offline: "Lưu cả khoá";
   mo-on-tap: thẻ ghi nhớ + lặp lại ngắt quãng; mo-ai: trợ giảng AI cạnh mỗi bài —
   dùng ai-khach.js (khách gọi /ai/*, chung với OPIc) nên ai-khach đứng trước
   (nạp sau mo-on-tap để đưa thẻ AI soạn vào bộ ôn tập). */
var GOC_JS = ((document.currentScript && document.currentScript.src) || "").replace(/[^/]*$/, "");
ch("moDun", ["pwa", "ai-khach", "mo-offline", "mo-on-tap", "mo-ai"]).forEach(function (ten) {
  if (!/^[a-z0-9-]+$/.test(ten)) return;
  var s = document.createElement("script");
  s.src = GOC_JS + ten + ".js";
  s.async = false;
  document.head.appendChild(s);
});

/* ---------- 14. Khởi động ---------------------------------------------
   Nạp manifest (mục lục + siêu dữ liệu, không có markdown), rồi mới dựng
   trang. Trong lúc chờ: một dòng trạng thái; lỗi: trang báo lỗi có nút thử lại. */
function khoiDong() {
  if (NGUON.kieu === "api" && !ch("khoaHoc", "")) {
    veLoi("Khoá học chưa khai báo `khoaHoc`", "assets/cau-hinh.js thiếu khoá khoaHoc (slug của khoá trong database).");
    return;
  }
  $("#main").innerHTML = '<div class="home"><div class="boot">' + icon("book") + "Đang tải mục lục khoá học…</div></div>";
  NGUON.manifest().then(function (m) {
    D = m;
    DOCS = m.docs || {};
    SLUGS = m.slugs || {};
    ORDER = coThat(m.order);
    D.nav = m.nav || [];
    BIET_DANH = m.aliases || {};
    chuyenTienDo(m.idAliases || {});
    apDungThongTinKhoa(m.course || {});
    if (NGUON.kieu === "cuc-bo") {
      if (window.requestIdleCallback) requestIdleCallback(buildIndex, { timeout: 4000 });
      else setTimeout(buildIndex, 1500);
    }
    /* Lỗi khi DỰNG trang (dữ liệu lạ) cũng phải ra trang báo lỗi có nút thử
       lại — để nó lọt ra ngoài thì người đọc kẹt mãi ở "Đang tải mục lục…". */
    try {
      paintProgress();
      route();
      phat("san-sang");
    } catch (e) {
      if (window.console) console.error(e);
      veLoi("Không dựng được trang khoá học", e, khoiDong);
      return;
    }
    /* ?q=... mở sẵn ô tìm kiếm với từ khoá — tiện để chia sẻ một đường dẫn
       "tra cứu nhanh", và cũng là cách kiểm thử tự động chức năng tìm kiếm. */
    var mq = location.search.match(/[?&]q=([^&]*)/);
    var q = mq ? decodeURIComponent(mq[1].replace(/\+/g, " ")) : "";
    if (q) { openSearch(); $("#q").value = q; runSearch(); }
  }, function (err) {
    veLoi("Không tải được khoá học", err, khoiDong);
  });
}
khoiDong();

})();
