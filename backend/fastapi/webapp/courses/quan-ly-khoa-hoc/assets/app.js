/* ==========================================================================
   QUẢN LÝ KHOÁ HỌC — trang quản trị nội dung khoá học, chạy trên API /courses.

   Mọi thay đổi đi qua API (không chạm database trực tiếp), nên các quy tắc của
   backend — kiểm tra slug, cây chỉ trỏ tới bài có thật, tăng phiên bản để trang
   khoá học xác thực lại ETag — áp dụng y như khi dùng CLI.

   Đăng nhập: khoá COURSE_ADMIN_KEY được đổi lấy token phiên (POST
   /courses/admin/verify). Trình duyệt chỉ giữ token, không giữ khoá; mở lại
   trang thì token được làm mới (POST /courses/admin/session).
   ========================================================================== */
(function () {
"use strict";

var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var esc = function (s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
};
/* Xem trước markdown: cùng bộ lọc với engine trang khoá học (courses/engine/app.js)
   — phân tích trong <template> (trơ: ảnh không tải nên onerror không chạy), gỡ
   phần tử chạy mã, thuộc tính on*, URL javascript:/vbscript:/data: (trừ ảnh). */
var THE_CAM = /^(script|iframe|frame|frameset|object|embed|applet|style|link|meta|base|form)$/i;
function htmlSach(html) {
  var tpl = document.createElement("template");
  tpl.innerHTML = html;
  $$("*", tpl.content).forEach(function (el) {
    if (THE_CAM.test(el.tagName)) { el.parentNode && el.parentNode.removeChild(el); return; }
    Array.prototype.slice.call(el.attributes).forEach(function (a) {
      var n = a.name.toLowerCase(), v = (a.value || "").replace(/[\u0000- ]+/g, "").toLowerCase();
      if (n.indexOf("on") === 0 || n === "srcdoc") { el.removeAttribute(a.name); return; }
      if (/^(href|src|xlink:href|action|formaction|poster|background)$/.test(n) &&
          (/^(javascript|vbscript):/.test(v) || (/^data:/.test(v) && !(n === "src" && /^data:image\/(png|gif|jpe?g|webp);/.test(v))))) {
        el.removeAttribute(a.name);
      }
    });
  });
  return tpl.content;
}

var qt = (location.search.match(/[?&]theme=(light|dark)/) || [])[1];
if (qt) document.documentElement.setAttribute("data-theme", qt);

var LS = {
  get: function (k, d) { try { var v = localStorage.getItem("qlkh." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set: function (k, v) { try { localStorage.setItem("qlkh." + k, JSON.stringify(v)); } catch (e) {} },
  del: function (k) { try { localStorage.removeItem("qlkh." + k); } catch (e) {} }
};

/* Gốc API. ?api= chỉ được nghe khi API ở máy cục bộ (localhost, 127.0.0.1,
   [::1]) hoặc trang mở từ file://: một đường link "?api=https://may-chu-la"
   sẽ khiến trang gửi token quản trị — và khoá, khi đăng nhập — tới máy chủ đó. */
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
  return cfg && typeof cfg.apiBase === "string" ? cfg.apiBase.replace(/\/+$/, "") : "";
}
var WEBAPP = (window.__WEBAPP_CONFIG__ && window.__WEBAPP_CONFIG__.webappBase) || "";
var API = gocApi();
/* Token phiên được cất theo ĐÚNG máy chủ đã cấp nó (localStorage
   "qlkh.phien@<gốc API tuyệt đối>.token"): đổi gốc API thì token của máy chủ
   này không bao giờ bị gửi sang máy chủ khác. Khoá cũ "qlkh.session" (chưa gắn
   máy chủ) bị xoá — đăng nhập lại một lần. */
var PHIEN = "phien@" + (function () {
  try { return new URL(API || "/", location.href).href.replace(/\/+$/, ""); } catch (e) { return API || location.origin; }
})();
LS.del("session"); LS.del("exp");

var S = {
  api: API, token: LS.get(PHIEN + ".token", null), exp: LS.get(PHIEN + ".exp", 0),
  courses: [], slug: null, course: null, manifest: null, nav: null,
  dirty: false, doc: null, docDirty: false, tab: "info", preview: false
};

/* ---------- 1. Gọi API ------------------------------------------------ */
function api(method, path, body, extraHeaders) {
  var h = { "Accept": "application/json" };
  if (S.token) h["X-Admin-Session"] = S.token;
  Object.keys(extraHeaders || {}).forEach(function (k) { h[k] = extraHeaders[k]; });
  var init = { method: method, headers: h };
  if (body !== undefined) { h["Content-Type"] = "application/json"; init.body = typeof body === "string" ? body : JSON.stringify(body); }
  return fetch(S.api + path, init).then(function (r) {
    return r.text().then(function (t) {
      var j = null;
      try { j = t ? JSON.parse(t) : null; } catch (e) { j = null; }
      if (!r.ok) {
        var err = new Error((j && (j.message || j.detail)) || ("HTTP " + r.status));
        err.status = r.status;
        if (r.status === 403 && S.token && method !== "GET") hetPhien();
        throw err;
      }
      return j;
    });
  }, function () { throw new Error("Không kết nối được tới " + (S.api || location.origin)); });
}
function duongKhoa(p) { return "/courses/" + encodeURIComponent(S.slug) + (p || ""); }
function maHoaId(id) { return id.split("/").map(encodeURIComponent).join("/"); }

var toastT;
function toast(msg, loi) {
  var t = $("#toast");
  t.textContent = msg; t.hidden = false;
  t.style.background = loi ? "var(--ba)" : "";
  clearTimeout(toastT);
  toastT = setTimeout(function () { t.hidden = true; }, loi ? 5000 : 2200);
}
function baoLoi(e) { toast(e && e.message ? e.message : String(e), true); }

/* ---------- 2. Phiên quản trị ---------------------------------------- */
function luuPhien(r) {
  S.token = r.session; S.exp = r.expiresAt;
  LS.set(PHIEN + ".token", S.token); LS.set(PHIEN + ".exp", S.exp);
  hienPhien();
}
function xoaPhien() { S.token = null; LS.del(PHIEN + ".token"); LS.del(PHIEN + ".exp"); }
function hetPhien() {
  xoaPhien();
  $("#app").hidden = true; $("#login").hidden = false; $("#btnLock").hidden = true;
  $("#sessInfo").textContent = "";
  toast("Phiên quản trị đã hết — mở khoá lại", true);
}
function hienPhien() {
  var d = new Date((S.exp || 0) * 1000);
  $("#sessInfo").textContent = S.token ? "phiên tới " + d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) +
    " " + d.toLocaleDateString("vi-VN") : "";
  $("#btnLock").hidden = !S.token;
}
$("#frmLogin").addEventListener("submit", function (e) {
  e.preventDefault();
  var key = $("#inpKey").value;
  $("#loginErr").hidden = true;
  api("POST", "/courses/admin/verify", undefined, { "X-Admin-Key": key }).then(function (r) {
    $("#inpKey").value = "";
    luuPhien(r);
    vaoUngDung();
  }, function (err) {
    /* 403 có hai nghĩa: khoá sai, hoặc máy chủ chưa đặt COURSE_ADMIN_KEY (quản trị tắt). */
    $("#loginErr").textContent = /disabled/i.test(err.message || "") ?
      "Máy chủ chưa bật quản trị khoá học: đặt COURSE_ADMIN_KEY trong môi trường backend rồi khởi động lại." :
      err.status === 403 ? "Khoá không đúng." : err.message;
    $("#loginErr").hidden = false;
  });
});
$("#btnLock").addEventListener("click", function () {
  if ((S.dirty || S.docDirty) && !confirm("Còn thay đổi chưa lưu. Khoá lại vẫn bỏ chúng?")) return;
  xoaPhien();
  location.reload();
});

/* ---------- 3. Danh sách khoá ---------------------------------------- */
function taiDanhSach(chon) {
  return api("GET", "/courses?all=1").then(function (r) {
    S.courses = r.courses || [];
    veDanhSach();
    if (chon) chonKhoa(chon, true);
    else if (!S.slug) veChuaChon();
  }, baoLoi);
}
function veDanhSach() {
  $("#courseList").innerHTML = S.courses.map(function (c) {
    return '<li class="ci' + (c.slug === S.slug ? " on" : "") + '" data-slug="' + esc(c.slug) + '">' +
      '<span class="em">' + esc(c.icon || "📘") + '</span><span class="ci-t"><b>' + esc(c.title) + '</b><span class="ci-m">' + esc(c.slug) +
      " · " + c.docCount + " bài · v" + c.version + "</span>" +
      (c.published ? "" : '<span class="chip wa" style="margin-top:4px">nháp</span>') + "</span></li>";
  }).join("") || '<li class="muted small" style="padding:10px">Chưa có khoá học nào.</li>';
}
$("#courseList").addEventListener("click", function (e) {
  var li = e.target.closest(".ci"); if (li) chonKhoa(li.dataset.slug);
});
$("#btnReload").addEventListener("click", function () { taiDanhSach(S.slug); });

function veChuaChon() {
  $("#main").innerHTML = '<div class="empty">Chọn một khoá học bên trái, tạo khoá mới, hoặc nạp một bundle JSON ' +
    "(định dạng <code>backend/course-content/&lt;slug&gt;.json</code>).<br><br>" +
    "Bundle lớn hơn 4,5 MB (giới hạn thân request của Vercel) hãy nạp bằng CLI:<br>" +
    "<code>python tools/manage_courses.py import ../course-content/&lt;slug&gt;.json --yes</code></div>";
}

/* ---------- 4. Tạo và nạp khoá -------------------------------------- */
$("#btnNew").addEventListener("click", function () {
  if (!boQuaThayDoi()) return;
  S.slug = null; veDanhSach();
  $("#main").innerHTML = '<div class="stack"><h1 style="margin:0">Khoá học mới</h1>' +
    '<div class="grid2"><label class="f">Slug (URL, chữ thường-số-gạch)<input type="text" id="nSlug" placeholder="vd: toan-roi-rac"></label>' +
    '<label class="f">Biểu tượng<input type="text" id="nIcon" value="📘"></label></div>' +
    '<label class="f">Tiêu đề<input type="text" id="nTitle"></label>' +
    '<label class="f">Phụ đề<input type="text" id="nSub"></label>' +
    '<label class="f">Mô tả<textarea id="nDesc" rows="3"></textarea></label>' +
    '<label class="chk"><input type="checkbox" id="nPub"> Xuất bản ngay (bỏ chọn = nháp)</label>' +
    '<div class="row"><button class="btn pri" id="nTao">Tạo khoá</button></div></div>';
  $("#nTao").addEventListener("click", function () {
    api("POST", "/courses", {
      slug: $("#nSlug").value.trim(), title: $("#nTitle").value.trim(), subtitle: $("#nSub").value.trim(),
      icon: $("#nIcon").value.trim(), description: $("#nDesc").value, published: $("#nPub").checked
    }).then(function (c) { toast("Đã tạo " + c.slug); taiDanhSach(c.slug); }, baoLoi);
  });
});

$("#inpImport").addEventListener("change", function (e) {
  var f = e.target.files[0];
  e.target.value = "";
  if (!f) return;
  var rd = new FileReader();
  rd.onload = function () {
    var b;
    try { b = JSON.parse(rd.result); } catch (err) { baoLoi("Tệp không phải JSON: " + err.message); return; }
    if (!b || typeof b.docs !== "object") { baoLoi("Không giống một bundle khoá học (thiếu docs)"); return; }
    var slug = (b.course && b.course.slug) || prompt("Slug cho khoá này:", f.name.replace(/\.json$/i, ""));
    if (!slug) return;
    var co = S.courses.some(function (c) { return c.slug === slug; });
    var mb = f.size / 1048576;
    if (mb > 4.4 && !confirm("Tệp " + mb.toFixed(1) + " MB vượt giới hạn 4,5 MB của Vercel — chỉ nạp được khi backend chạy nơi khác " +
        "(máy cục bộ). Trên Vercel hãy dùng CLI manage_courses.py. Vẫn thử?")) return;
    if (co && !confirm("Khoá “" + slug + "” đã có. Nạp sẽ THAY TOÀN BỘ nội dung và cấu trúc của nó. Tiếp tục?")) return;
    toast("Đang nạp " + Object.keys(b.docs).length + " bài…");
    api("POST", "/courses/import?slug=" + encodeURIComponent(slug), rd.result).then(function (c) {
      toast("Đã nạp " + c.slug + ": " + c.docCount + " bài, v" + c.version);
      S.dirty = S.docDirty = false;
      taiDanhSach(c.slug);
    }, baoLoi);
  };
  rd.readAsText(f);
});

/* ---------- 5. Một khoá ---------------------------------------------- */
function boQuaThayDoi() {
  return !(S.dirty || S.docDirty) || confirm("Còn thay đổi chưa lưu (cấu trúc hoặc bài đang sửa). Bỏ chúng?");
}
function chonKhoa(slug, ep) {
  if (!ep && slug !== S.slug && !boQuaThayDoi()) return;
  return Promise.all([api("GET", "/courses/" + encodeURIComponent(slug)),
                      api("GET", "/courses/" + encodeURIComponent(slug) + "/manifest")]).then(function (r) {
    var giuBai = S.slug === slug && S.doc ? S.doc.id : null;
    S.slug = slug; S.course = r[0]; S.manifest = r[1];
    S.nav = JSON.parse(JSON.stringify(r[0].nav || []));
    S.dirty = false;
    if (!giuBai || !S.manifest.docs[giuBai]) { S.doc = null; S.docDirty = false; }
    veDanhSach(); veKhoa();
  }, baoLoi);
}
function veKhoa() {
  var c = S.course;
  $("#main").innerHTML =
    '<div class="ch"><span class="em">' + esc(c.icon || "📘") + "</span><div><h1>" + esc(c.title) + "</h1>" +
    '<div class="row" style="margin-top:4px"><span class="chip ac">' + esc(c.slug) + '</span><span class="chip">v' + c.version +
    '</span><span class="chip">' + c.docCount + " bài</span>" +
    (c.published ? '<span class="chip ok">đã xuất bản</span>' : '<span class="chip wa">nháp — ẩn khỏi trang công khai</span>') +
    "</div>" +
    '<div class="row" style="margin-top:8px"><a class="btn sm pri" id="lkDoc" href="' + esc(trangDoc(c)) +
    '" target="_blank" rel="noopener" title="Trang đọc chung — dùng được cho mọi khoá, kể cả khoá vừa tạo">' +
    (c.published ? "Mở trang khoá học ↗" : "Xem trước bản nháp ↗") + '</a><span id="lkRieng" class="row"></span></div>' +
    "</div></div>" +
    '<div class="tabs" role="tablist">' + [["info", "Thông tin"], ["tree", "Cấu trúc & bài"], ["search", "Tìm kiếm thử"]].map(function (t) {
      return '<button class="tab' + (S.tab === t[0] ? " on" : "") + '" data-tab="' + t[0] + '" role="tab">' + t[1] + "</button>";
    }).join("") + "</div><div id=\"tabBody\"></div>";
  $$(".tab").forEach(function (b) {
    b.addEventListener("click", function () { S.tab = b.dataset.tab; veKhoa(); });
  });
  if (S.tab === "info") veThongTin();
  else if (S.tab === "tree") veCauTruc();
  else veTimThu();
  veTrangRieng(c);
}

/* ---------- 5a. Trang đọc của khoá ------------------------------------
   Mọi khoá đều đọc được ở trang chung courses/khoa-hoc/?khoa=<slug> — khoá vừa tạo
   ở đây có link ngay, không cần dựng thư mục. Bản nháp thêm &nhap=1: trang đọc gửi
   kèm token phiên của trang này nên quản trị viên xem trước được.
   Khoá có trang riêng dựng sẵn (config.webapp, vd "courses/system-design-course")
   thì thêm nút sang trang đó — chỉ khi trang đó CÓ THẬT (một config.webapp trỏ vào
   thư mục không tồn tại, vd "courses/test", chỉ sinh một dòng nhắc). */
function trangDoc(c) {
  return "../khoa-hoc/?khoa=" + encodeURIComponent(c.slug) + (c.published ? "" : "&nhap=1");
}
function trangRieng(c) {
  var w = String((c.config || {}).webapp || "");
  if (!/^[A-Za-z0-9][A-Za-z0-9._\/-]*$/.test(w) || w.split("/").indexOf("..") >= 0) return null;
  return WEBAPP ? WEBAPP + "/" + w.replace(/\/+$/, "") + "/" : "../" + w.replace(/\/+$/, "").split("/").pop() + "/";
}
/* Trang có thật trong webapp/: hỏi danh sách của portal MỘT lần (/webapp/_api/list)
   thay vì mở thử config.webapp — trượt thì không có dòng 404 nào trong console. */
var TRANG_CO_THAT = null;
function trangCoThat() {
  if (!TRANG_CO_THAT) {
    TRANG_CO_THAT = !WEBAPP ? Promise.resolve(null) :
      fetch(WEBAPP + "/_api/list", { credentials: "same-origin" }).then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          if (!j) return null;
          var co = {};
          (j.apps || []).concat.apply(j.apps || [], (j.collections || []).map(function (x) { return x.apps || []; }))
            .forEach(function (a) { if (a && a.path && a.has_index) co[a.path] = true; });
          return co;
        }, function () { return null; });
  }
  return TRANG_CO_THAT;
}
function veTrangRieng(c) {
  var url = trangRieng(c), w = String((c.config || {}).webapp || "").replace(/\/+$/, "");
  if (!url) return;
  trangCoThat().then(function (ds) {
    if (!ds) return;                                   /* không biết (mở từ file://): im lặng */
    var co = !!ds[w];
    var o = $("#lkRieng");
    if (!o || !S.course || S.course.slug !== c.slug) return;
    o.innerHTML = co ?
      '<a class="btn sm" href="' + esc(url) + (c.published ? "" : "?nhap=1") + '" target="_blank" rel="noopener">Trang riêng ↗</a>' :
      '<span class="muted small">config.webapp “' + esc(w) + "” không có trang trong webapp/ — dùng trang đọc chung.</span>";
  });
}

/* ---------- 5b. Thông tin -------------------------------------------- */
function veThongTin() {
  var c = S.course, s = c.stats || {};
  $("#tabBody").innerHTML = '<div class="stack">' +
    '<div class="grid2"><label class="f">Tiêu đề<input type="text" id="fTitle" value="' + esc(c.title) + '"></label>' +
    '<label class="f">Phụ đề<input type="text" id="fSub" value="' + esc(c.subtitle) + '"></label></div>' +
    '<div class="grid2"><label class="f">Biểu tượng<input type="text" id="fIcon" value="' + esc(c.icon) + '"></label>' +
    '<label class="f">Slug<input type="text" value="' + esc(c.slug) + '" disabled></label></div>' +
    '<label class="f">Mô tả<textarea id="fDesc" rows="3">' + esc(c.description) + "</textarea></label>" +
    '<label class="chk"><input type="checkbox" id="fPub"' + (c.published ? " checked" : "") + "> Đã xuất bản (bỏ chọn = nháp, chỉ quản trị viên thấy)</label>" +
    '<label class="f">Cấu hình (JSON, tuỳ chọn — <code>webapp</code> chỉ cần khi khoá có trang riêng dựng sẵn trong webapp/; ' +
    'không có thì khoá đọc ở trang chung)<textarea id="fCfg" class="mono" rows="5">' +
      esc(JSON.stringify(c.config || {}, null, 2)) + "</textarea></label>" +
    '<div class="kv">' + [["files", "tài liệu"], ["lessons", "bài giảng"], ["words", "từ"], ["minutes", "phút đọc"]].map(function (k) {
      return "<div><b>" + (s[k[0]] || 0).toLocaleString("vi-VN") + "</b><span>" + k[1] + "</span></div>";
    }).join("") + "</div>" +
    '<div class="row"><button class="btn pri" id="bLuu">Lưu thông tin</button>' +
    '<button class="btn" id="bXuat">Xuất bundle JSON</button></div>' +
    '<div class="card danger"><b>Xoá khoá học</b><p class="muted small" style="margin:6px 0 10px">Xoá toàn bộ cấu trúc và bài giảng ' +
    "khỏi database. Không hoàn tác được — hãy xuất bundle trước.</p>" +
    '<button class="btn ba" id="bXoa">Xoá “' + esc(c.slug) + "”…</button></div></div>";

  $("#bLuu").addEventListener("click", function () {
    var cfg;
    try { cfg = JSON.parse($("#fCfg").value || "{}"); } catch (e) { baoLoi("Cấu hình không phải JSON hợp lệ: " + e.message); return; }
    api("PATCH", duongKhoa(), {
      title: $("#fTitle").value.trim(), subtitle: $("#fSub").value.trim(), icon: $("#fIcon").value.trim(),
      description: $("#fDesc").value, published: $("#fPub").checked, config: cfg
    }).then(function (c2) {
      S.course = c2; toast("Đã lưu"); taiDanhSach(); veKhoa();
    }, baoLoi);
  });
  $("#bXuat").addEventListener("click", function () {
    fetch(S.api + duongKhoa("/export"), { headers: { "X-Admin-Session": S.token } }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.blob();
    }).then(function (b) {
      var a = document.createElement("a");
      a.href = URL.createObjectURL(b); a.download = S.slug + ".json"; a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    }, baoLoi);
  });
  $("#bXoa").addEventListener("click", function () {
    if (prompt("Gõ lại slug “" + S.slug + "” để xác nhận xoá:") !== S.slug) { toast("Đã huỷ"); return; }
    api("DELETE", duongKhoa()).then(function () {
      toast("Đã xoá " + S.slug);
      S.slug = null; S.course = null; S.doc = null; S.dirty = S.docDirty = false;
      taiDanhSach();
    }, baoLoi);
  });
}

/* ---------- 5b. Cấu trúc & bài --------------------------------------- */
function trongCay() {
  var co = {};
  S.nav.forEach(function (s) { s.groups.forEach(function (g) { g.items.forEach(function (i) { co[i] = true; }); }); });
  return co;
}
function tenBai(id) { var d = S.manifest.docs[id]; return d ? d.title : id + " (đã xoá?)"; }
function luaChonNhom(chon) {
  var out = '<option value="">— chuyển tới —</option>';
  S.nav.forEach(function (s, si) {
    s.groups.forEach(function (g, gi) {
      var v = si + ":" + gi;
      out += '<option value="' + v + '"' + (v === chon ? " selected" : "") + ">" + esc(s.title + " › " + (g.short || g.title)) + "</option>";
    });
  });
  return out;
}
function nutDiChuyen(kieu, a, b, c) {
  var data = ' data-k="' + kieu + '" data-a="' + a + '"' + (b != null ? ' data-b="' + b + '"' : "") + (c != null ? ' data-c="' + c + '"' : "");
  return '<span class="ctl"><button class="btn xs" data-op="len"' + data + ' title="Lên">↑</button>' +
    '<button class="btn xs" data-op="xuong"' + data + ' title="Xuống">↓</button></span>';
}
function veCauTruc() {
  var dsMo = trongCay();
  var mo = Object.keys(S.manifest.docs).filter(function (id) { return !dsMo[id]; });
  var cay = S.nav.map(function (s, si) {
    return '<div class="sec"><div class="sec-h"><span>' + esc(s.title) + '</span><span class="chip">' + esc(s.id) + "</span>" +
      '<span class="sp"></span>' + nutDiChuyen("sec", si) +
      '<span class="ctl"><button class="btn xs" data-op="suaSec" data-a="' + si + '">Sửa</button>' +
      '<button class="btn xs" data-op="themNhom" data-a="' + si + '">＋ Nhóm</button>' +
      '<button class="btn xs" data-op="xoaSec" data-a="' + si + '">Xoá</button></span></div>' +
      s.groups.map(function (g, gi) {
        return '<div class="grp"><div class="grp-h"><span class="short">' + esc(g.short || "—") + "</span><span>" + esc(g.title) +
          '</span><span class="muted">(' + g.items.length + ')</span><span class="sp"></span>' + nutDiChuyen("grp", si, gi) +
          '<span class="ctl"><button class="btn xs" data-op="suaNhom" data-a="' + si + '" data-b="' + gi + '">Sửa</button>' +
          '<button class="btn xs" data-op="baiMoi" data-a="' + si + '" data-b="' + gi + '">＋ Bài</button>' +
          '<button class="btn xs" data-op="xoaNhom" data-a="' + si + '" data-b="' + gi + '">Xoá</button></span></div>' +
          g.items.map(function (id, ii) {
            return '<div class="di' + (S.doc && S.doc.id === id ? " on" : "") + '" data-id="' + esc(id) + '"><span class="t" title="' + esc(id) + '">' +
              esc(tenBai(id)) + "</span>" + nutDiChuyen("doc", si, gi, ii) +
              '<span class="ctl"><select data-op="chuyen" data-a="' + si + '" data-b="' + gi + '" data-c="' + ii + '" title="Chuyển nhóm">' +
              luaChonNhom("") + '</select><button class="btn xs" data-op="boRa" data-a="' + si + '" data-b="' + gi + '" data-c="' + ii +
              '" title="Bỏ khỏi mục lục (bài vẫn còn)">×</button></span></div>';
          }).join("") + "</div>";
      }).join("") + "</div>";
  }).join("");
  var ngoai = mo.length ? '<div class="orph"><div class="grp-h"><span>Ngoài mục lục</span><span class="muted">(' + mo.length +
    ") — bài còn trong database nhưng không hiện trên trang</span></div>" + mo.map(function (id) {
      return '<div class="di' + (S.doc && S.doc.id === id ? " on" : "") + '" data-id="' + esc(id) + '"><span class="t">' + esc(tenBai(id)) +
        '</span><span class="ctl"><select data-op="dua" data-id="' + esc(id) + '">' + luaChonNhom("") + "</select></span></div>";
    }).join("") + "</div>" : "";
  $("#tabBody").innerHTML = '<div class="st"><div>' +
    '<div class="bar' + (S.dirty ? " dirty" : "") + '"><span class="small">' + (S.dirty ? "Có thay đổi cấu trúc chưa lưu" : "Cấu trúc khớp database") +
    '</span><span class="sp"></span><button class="btn sm" id="bThemSec">＋ Section</button>' +
    '<button class="btn sm" id="bHuy"' + (S.dirty ? "" : " disabled") + '>Huỷ</button>' +
    '<button class="btn sm pri" id="bLuuCay"' + (S.dirty ? "" : " disabled") + ">Lưu cấu trúc</button></div>" +
    '<div class="tree" id="tree">' + (cay || '<div class="empty">Chưa có section nào — bấm “＋ Section”.</div>') + ngoai + "</div></div>" +
    '<div class="ed" id="editor"></div></div>';
  veEditor();

  $("#bThemSec").addEventListener("click", function () {
    var id = prompt("Id section (chữ thường-số-gạch, vd: khoa-hoc):");
    if (!id) return;
    var title = prompt("Tiêu đề section:", id) || id;
    S.nav.push({ id: id.trim(), title: title.trim(), sub: "", icon: "book", groups: [] });
    doiCay();
  });
  $("#bHuy").addEventListener("click", function () {
    S.nav = JSON.parse(JSON.stringify(S.course.nav || [])); S.dirty = false; veCauTruc();
  });
  $("#bLuuCay").addEventListener("click", function () {
    api("PUT", duongKhoa("/structure"), { nav: S.nav }).then(function () {
      toast("Đã lưu cấu trúc"); S.dirty = false; chonKhoa(S.slug, true);
    }, baoLoi);
  });
  $("#tree").addEventListener("click", xuLyCay);
  $("#tree").addEventListener("change", xuLyCay);
}
function doiCay() { S.dirty = true; veCauTruc(); }
function doiCho(arr, i, j) { if (j < 0 || j >= arr.length) return false; var t = arr[i]; arr[i] = arr[j]; arr[j] = t; return true; }
function xuLyCay(e) {
  var el = e.target.closest("[data-op]");
  if (!el) {
    var di = e.target.closest(".di");
    if (di && e.type === "click") moBai(di.dataset.id);
    return;
  }
  var op = el.dataset.op, a = +el.dataset.a, b = +el.dataset.b, c = +el.dataset.c;
  if ((op === "chuyen" || op === "dua") && e.type !== "change") return;
  if (op !== "chuyen" && op !== "dua" && e.type !== "click") return;
  e.stopPropagation();
  var sec = S.nav[a], grp = sec && sec.groups[b];
  if (op === "len" || op === "xuong") {
    var d = op === "len" ? -1 : 1, k = el.dataset.k;
    var moved = k === "sec" ? doiCho(S.nav, a, a + d) : k === "grp" ? doiCho(sec.groups, b, b + d) : doiCho(grp.items, c, c + d);
    if (moved) doiCay();
  } else if (op === "suaSec") {
    var t = prompt("Tiêu đề section:", sec.title); if (t == null) return;
    var sub = prompt("Mô tả ngắn (dưới tiêu đề):", sec.sub || ""); if (sub == null) return;
    sec.title = t.trim() || sec.title; sec.sub = sub.trim(); doiCay();
  } else if (op === "themNhom") {
    var tn = prompt("Tiêu đề nhóm (vd: M16 — Chủ đề mới):"); if (!tn) return;
    var sn = prompt("Tên ngắn (hiện trên trang, vd: M16):", "") || "";
    sec.groups.push({ title: tn.trim(), short: sn.trim(), meta: {}, items: [] }); doiCay();
  } else if (op === "xoaSec") {
    var n = sec.groups.reduce(function (x, g) { return x + g.items.length; }, 0);
    if (!confirm("Xoá section “" + sec.title + "”" + (n ? "? " + n + " bài sẽ ra “Ngoài mục lục” (không bị xoá)." : "?"))) return;
    S.nav.splice(a, 1); doiCay();
  } else if (op === "suaNhom") {
    var t2 = prompt("Tiêu đề nhóm:", grp.title); if (t2 == null) return;
    var s2 = prompt("Tên ngắn:", grp.short || ""); if (s2 == null) return;
    grp.title = t2.trim() || grp.title; grp.short = s2.trim(); doiCay();
  } else if (op === "xoaNhom") {
    if (!confirm("Xoá nhóm “" + grp.title + "”" + (grp.items.length ? "? " + grp.items.length + " bài sẽ ra “Ngoài mục lục”." : "?"))) return;
    sec.groups.splice(b, 1); doiCay();
  } else if (op === "boRa") {
    grp.items.splice(c, 1); doiCay();
  } else if (op === "chuyen" || op === "dua") {
    if (!el.value) return;
    var dich = el.value.split(":"), gd = S.nav[+dich[0]].groups[+dich[1]];
    var id = op === "chuyen" ? grp.items.splice(c, 1)[0] : el.dataset.id;
    gd.items.push(id); doiCay();
  } else if (op === "baiMoi") {
    if (S.dirty) { toast("Lưu cấu trúc trước khi thêm bài — nhóm mới phải có trong database", true); return; }
    if (!boQuaThayDoi()) return;
    var goiY = ((grp.short || sec.id) + "/bai-moi.md").toLowerCase().replace(/[^a-z0-9/.-]+/g, "-");
    var idMoi = prompt("Id bài mới (đường dẫn, không dấu cách — vd: mon-16/bai-01.md):", goiY);
    if (!idMoi) return;
    if (S.manifest.docs[idMoi]) { toast("Id đã có — mở bài đó để sửa", true); return; }
    S.doc = { id: idMoi.trim(), title: "", slug: "", kind: "lesson", tag: "", meta: {}, md: "# Tiêu đề bài\n\n",
              _moi: true, _section: sec.id, _group: grp.short || grp.title };
    S.docDirty = true; S.preview = false; veCauTruc();
  }
}

function moBai(id) {
  if (S.doc && S.doc.id === id) return;
  if (S.docDirty && !confirm("Bài đang sửa chưa lưu. Bỏ thay đổi?")) return;
  api("GET", duongKhoa("/docs/" + maHoaId(id))).then(function (d) {
    S.doc = d; S.docDirty = false; S.preview = false;
    $$(".di").forEach(function (x) { x.classList.toggle("on", x.dataset.id === id); });
    veEditor();
  }, baoLoi);
}

function veEditor() {
  var host = $("#editor"); if (!host) return;
  var d = S.doc;
  if (!d) {
    host.innerHTML = '<div class="empty">Bấm một bài trong cây để sửa. “＋ Bài” trên một nhóm để thêm bài mới; ↑ ↓ để sắp xếp; ' +
      "ô “chuyển tới” để đổi nhóm. Thay đổi cấu trúc chỉ có hiệu lực khi bấm <b>Lưu cấu trúc</b>; bài thì lưu riêng từng bài.</div>";
    return;
  }
  var kinds = {}; Object.keys(S.manifest.docs).forEach(function (k) { kinds[S.manifest.docs[k].kind] = 1; });
  host.innerHTML = '<div class="card">' +
    '<div class="row"><b>' + (d._moi ? "Bài mới trong " + esc(d._section + " › " + d._group) : "Sửa bài") + "</b>" +
    '<span class="sp"></span><span class="chip">' + (d.words || 0) + " từ · " + (d.minutes || 0) + " phút</span></div>" +
    '<label class="f">Id<input type="text" id="eId" value="' + esc(d.id) + '"' + (d._moi ? "" : " disabled") + "></label>" +
    '<div class="grid2"><label class="f">Tiêu đề (để trống = lấy từ dòng # đầu)<input type="text" id="eTitle" value="' + esc(d.title) + '"></label>' +
    '<label class="f">Slug (đường dẫn trên trang)<input type="text" id="eSlug" value="' + esc(d.slug) + '" placeholder="tự sinh từ id"></label></div>' +
    '<div class="grid2"><label class="f">Loại<input type="text" id="eKind" list="dsKind" value="' + esc(d.kind) + '"></label>' +
    '<label class="f">Nhãn (tag)<input type="text" id="eTag" value="' + esc(d.tag || "") + '"></label></div>' +
    '<datalist id="dsKind">' + Object.keys(kinds).map(function (k) { return '<option value="' + esc(k) + '">'; }).join("") + "</datalist>" +
    '<label class="f">Meta (JSON)<textarea id="eMeta" class="mono" rows="3">' + esc(JSON.stringify(d.meta || {})) + "</textarea></label>" +
    '<div class="row"><b class="small">Markdown</b><span class="sp"></span><button class="btn xs" id="eXem">' +
    (S.preview ? "Sửa" : "Xem trước") + "</button></div>" +
    (S.preview ? '<div class="prev" id="ePrev"></div>' : '<textarea id="eMd" class="mono md" spellcheck="false">' + esc(d.md || "") + "</textarea>") +
    '<div class="row"><button class="btn pri" id="eLuu">' + (d._moi ? "Tạo bài" : "Lưu bài") + "</button>" +
    (d._moi ? '<button class="btn" id="eBo">Bỏ</button>' : '<button class="btn ba" id="eXoa">Xoá bài</button>') + "</div></div>";

  if (S.preview) {
    var md = d.md || "";
    var prev = $("#ePrev");
    if (window.marked) prev.appendChild(htmlSach(marked.parse(md)));
    else prev.innerHTML = "<pre>" + esc(md) + "</pre>";
  } else {
    $("#eMd").addEventListener("input", function () { d.md = this.value; S.docDirty = true; });
  }
  ["eTitle", "eSlug", "eKind", "eTag", "eMeta", "eId"].forEach(function (id) {
    var el = $("#" + id); if (el) el.addEventListener("input", function () { S.docDirty = true; });
  });
  $("#eXem").addEventListener("click", function () {
    if (!S.preview && $("#eMd")) d.md = $("#eMd").value;
    thuThapForm(d); S.preview = !S.preview; veEditor();
  });
  $("#eLuu").addEventListener("click", luuBai);
  if ($("#eXoa")) $("#eXoa").addEventListener("click", xoaBai);
  if ($("#eBo")) $("#eBo").addEventListener("click", function () { S.doc = null; S.docDirty = false; veCauTruc(); });
}
function thuThapForm(d) {
  if ($("#eId") && d._moi) d.id = $("#eId").value.trim();
  d.title = $("#eTitle").value; d.slug = $("#eSlug").value; d.kind = $("#eKind").value; d.tag = $("#eTag").value;
  d._metaText = $("#eMeta").value;
  if ($("#eMd")) d.md = $("#eMd").value;
}
function luuBai() {
  var d = S.doc;
  thuThapForm(d);
  var meta;
  try { meta = JSON.parse(d._metaText || "{}"); } catch (e) { baoLoi("Meta không phải JSON hợp lệ: " + e.message); return; }
  var body = { md: d.md, meta: meta, kind: d.kind.trim() || "lesson", tag: d.tag.trim() || null };
  if (d.title.trim()) body.title = d.title.trim();
  if (d.slug.trim()) body.slug = d.slug.trim();
  if (d._moi) { body.section = d._section; body.group = d._group; }
  api("PUT", duongKhoa("/docs/" + maHoaId(d.id)), body).then(function (saved) {
    toast(d._moi ? "Đã tạo bài" : "Đã lưu bài");
    S.doc = saved; S.docDirty = false;
    if (d._moi || !S.dirty) chonKhoa(S.slug, true);               /* cây trong database đã đổi */
    else { S.manifest.docs[saved.id] = saved; veCauTruc(); }      /* giữ thay đổi cấu trúc chưa lưu */
  }, baoLoi);
}
function xoaBai() {
  var d = S.doc;
  if (!confirm("Xoá hẳn bài “" + (d.title || d.id) + "” khỏi database?")) return;
  api("DELETE", duongKhoa("/docs/" + maHoaId(d.id))).then(function () {
    toast("Đã xoá bài");
    S.nav.forEach(function (s) { s.groups.forEach(function (g) { g.items = g.items.filter(function (i) { return i !== d.id; }); }); });
    delete S.manifest.docs[d.id];
    S.doc = null; S.docDirty = false;
    if (!S.dirty) chonKhoa(S.slug, true); else veCauTruc();
  }, baoLoi);
}

/* ---------- 5c. Tìm kiếm thử ----------------------------------------- */
function veTimThu() {
  $("#tabBody").innerHTML = '<div class="row" style="max-width:640px"><input type="search" id="tQ" placeholder="Từ khoá (gõ không dấu cũng được)…">' +
    '<button class="btn pri" id="tTim">Tìm</button></div>' +
    '<p class="muted small">Chính API mà trang khoá học dùng: xếp hạng phía server, tiêu đề &gt; đầu mục &gt; nội dung, khớp đầu từ.</p>' +
    '<ul class="hits" id="tKq"></ul>';
  function tim() {
    var q = $("#tQ").value.trim(); if (!q) return;
    api("GET", duongKhoa("/search?limit=50&q=" + encodeURIComponent(q))).then(function (r) {
      $("#tKq").innerHTML = (r.hits || []).map(function (h) {
        return '<li data-id="' + esc(h.id) + '"><div class="row"><b>' + esc(h.title) + '</b><span class="sp"></span><span class="chip">' +
          esc(h.group) + '</span><span class="chip">' + h.score + '</span></div><div class="sn">' + esc(h.snippet) + "</div></li>";
      }).join("") || '<li class="muted">Không có kết quả.</li>';
    }, baoLoi);
  }
  $("#tTim").addEventListener("click", tim);
  $("#tQ").addEventListener("keydown", function (e) { if (e.key === "Enter") tim(); });
  $("#tKq").addEventListener("click", function (e) {
    var li = e.target.closest("li[data-id]"); if (!li) return;
    S.tab = "tree"; veKhoa(); moBai(li.dataset.id);
  });
  $("#tQ").focus();
}

/* ---------- 6. Khởi động --------------------------------------------- */
window.addEventListener("beforeunload", function (e) {
  if (S.dirty || S.docDirty) { e.preventDefault(); e.returnValue = ""; }
});
function vaoUngDung() {
  $("#login").hidden = true; $("#app").hidden = false;
  hienPhien();
  var chon = (location.hash.match(/^#\/?([a-z0-9-]+)/) || [])[1] || null;
  taiDanhSach(chon);
}
$("#apiInfo").textContent = (S.api || location.origin) + "/courses";
if (S.token) {
  api("POST", "/courses/admin/session").then(function (r) { luuPhien(r); vaoUngDung(); }, function () {
    xoaPhien(); $("#login").hidden = false;
  });
} else {
  $("#login").hidden = false;
}
})();
