/* ==========================================================================
   QUẢN LÝ KHOÁ HỌC — lõi: phiên, gọi API, hộp thoại, điều hướng, danh sách
   khoá, thông tin khoá, tìm kiếm thử, thùng rác, tạo / nhân bản / nạp khoá.

   Bốn tệp chung một không gian tên window.QL, nạp theo thứ tự:
     app.js   (tệp này)   lõi — tạo QL, khởi động khi DOM sẵn sàng
     cay.js               tab "Cấu trúc & bài": cây mục lục kéo-thả
     soan.js              trình soạn bài: chia đôi xem trước, lịch sử, xung đột
     tep.js               tab "Tệp" và "Kiểm tra liên kết"
   Xem trước dùng hien-thi.js / hien-thi.css — CÙNG bộ dựng bài với trang đọc.

   Mọi thay đổi đi qua API /courses (không chạm database trực tiếp), nên các quy
   tắc của backend — kiểm tra slug, cây chỉ trỏ tới bài có thật, chống ghi đè
   (If-Match), lịch sử và thùng rác — áp dụng y như khi dùng CLI.
   ========================================================================== */
(function () {
"use strict";

var QL = window.QL = {};
var $ = QL.$ = function (s, r) { return (r || document).querySelector(s); };
var $$ = QL.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var esc = QL.esc = function (s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
};
var norm = QL.norm = window.HienThi ? HienThi.norm : function (s) { return String(s || "").toLowerCase(); };
/* "Phần 1 — Nhập môn" → "phan-1-nhap-mon" */
QL.slugHoa = function (s) {
  return norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
};
QL.maHoaId = function (id) { return String(id).split("/").map(encodeURIComponent).join("/"); };
QL.kichThuoc = function (n) {
  return n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : n >= 1024 ? Math.round(n / 1024) + " KB" : n + " B";
};
QL.luc = function (giay) {
  if (!giay) return "";
  var d = new Date(giay * 1000), s = Math.round((Date.now() - d) / 1000);
  if (s < 60) return "vừa xong";
  if (s < 3600) return Math.round(s / 60) + " phút trước";
  if (s < 86400) return Math.round(s / 3600) + " giờ trước";
  return d.toLocaleDateString("vi-VN") + " " + d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
};

/* ---------- 0. Nơi cất trên máy, giao diện sáng/tối ------------------- */
var LS = QL.LS = {
  get: function (k, d) { try { var v = localStorage.getItem("qlkh." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set: function (k, v) { try { localStorage.setItem("qlkh." + k, JSON.stringify(v)); } catch (e) {} },
  del: function (k) { try { localStorage.removeItem("qlkh." + k); } catch (e) {} }
};
var qsTheme = (location.search.match(/[?&]theme=(light|dark|auto)/) || [])[1];
if (qsTheme) LS.set("theme", qsTheme);         /* ?theme= đặt lựa chọn MỘT lần; nút đổi vẫn dùng được */
function apTheme() {
  var t = LS.get("theme", "auto");
  if (t === "auto") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", t);
  var b = $("#btnTheme");
  if (b) {
    b.textContent = t === "dark" ? "☾" : t === "light" ? "☀" : "◐";
    b.title = "Giao diện: " + (t === "dark" ? "tối" : t === "light" ? "sáng" : "theo hệ điều hành") + " — bấm để đổi";
  }
}
apTheme();

/* ---------- 1. Gốc API, phiên ----------------------------------------- */
/* ?api= chỉ được nghe khi API ở máy cục bộ (localhost, 127.0.0.1, [::1]) hoặc
   trang mở từ file://: một đường link "?api=https://may-chu-la" sẽ khiến trang
   gửi token quản trị — và khoá, khi đăng nhập — tới máy chủ đó. */
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
var WEBAPP = QL.WEBAPP = (window.__WEBAPP_CONFIG__ && window.__WEBAPP_CONFIG__.webappBase) || "";
var API = gocApi();
/* Token phiên được cất theo ĐÚNG máy chủ đã cấp nó: đổi gốc API thì token của
   máy chủ này không bao giờ bị gửi sang máy chủ khác. */
var PHIEN = "phien@" + (function () {
  try { return new URL(API || "/", location.href).href.replace(/\/+$/, ""); } catch (e) { return API || location.origin; }
})();
LS.del("session"); LS.del("exp");

var S = QL.S = {
  api: API, token: LS.get(PHIEN + ".token", null), exp: LS.get(PHIEN + ".exp", 0),
  courses: [], slug: null, course: null, manifest: null, nav: null, view: null,
  dirty: false, doc: null, docDirty: false, infoDraft: null, infoDirty: false, tab: "info"
};

/* ---------- 2. Gọi API ------------------------------------------------ */
/* Lỗi 422 của FastAPI có `detail` là MẢNG — trước đây hiện "[object Object]". */
var LOAI_LOI = {
  dict_type: "phải là một object JSON {…}", missing: "còn thiếu", string_type: "phải là chuỗi",
  bool_type: "phải là true/false", bool_parsing: "phải là true/false", int_type: "phải là số nguyên",
  int_parsing: "phải là số nguyên", list_type: "phải là danh sách […]", json_invalid: "JSON không hợp lệ",
  string_too_long: "dài quá", value_error: "giá trị không hợp lệ"
};
QL.thongDiep = function (j, status) {
  if (j && typeof j.message === "string" && j.message) return j.message;
  if (j && Array.isArray(j.detail)) {
    return j.detail.map(function (d) {
      var cho = (d.loc || []).filter(function (x) { return x !== "body"; }).join(".");
      return (cho ? "“" + cho + "” " : "") + (LOAI_LOI[d.type] || d.msg || d.type);
    }).join("; ");
  }
  if (j && typeof j.detail === "string") return j.detail;
  return status === 413 ? "Dữ liệu quá lớn" : "Lỗi HTTP " + status;
};
var api = QL.api = function (method, path, body, opt) {
  opt = opt || {};
  var h = { "Accept": "application/json" };
  if (S.token) h["X-Admin-Session"] = S.token;
  Object.keys(opt.headers || {}).forEach(function (k) { if (opt.headers[k] != null) h[k] = opt.headers[k]; });
  var init = { method: method, headers: h };
  if (body !== undefined) {
    if (typeof Blob !== "undefined" && body instanceof Blob) { init.body = body; }
    else { h["Content-Type"] = "application/json"; init.body = typeof body === "string" ? body : JSON.stringify(body); }
  }
  return fetch(S.api + path, init).then(function (r) {
    return r.text().then(function (t) {
      var j = null;
      try { j = t ? JSON.parse(t) : null; } catch (e) { j = null; }
      if (!r.ok) {
        var err = new Error(QL.thongDiep(j, r.status));
        err.status = r.status; err.data = j && j.data; err.code = j && j.data && j.data.code;
        if (r.status === 403 && S.token && /^(session_|admin_required)/.test(err.code || "")) hetPhien(err.message);
        throw err;
      }
      return j;
    });
  }, function () {
    var e = new Error("Không kết nối được tới máy chủ " + (S.api || location.origin));
    e.status = 0; throw e;
  });
};
QL.duongKhoa = function (p) { return "/courses/" + encodeURIComponent(S.slug) + (p || ""); };

/* ---------- 3. Thông báo ---------------------------------------------- */
var toastT;
var toast = QL.toast = function (msg, loi) {
  var t = $("#toast");
  t.className = "toast" + (loi ? " loi" : "");
  t.setAttribute("role", loi ? "alert" : "status");
  t.innerHTML = "<span>" + esc(msg) + "</span>" + (loi ? '<button type="button" aria-label="Đóng thông báo">✕</button>' : "");
  t.hidden = false;
  clearTimeout(toastT);
  if (loi) $("button", t).addEventListener("click", function () { t.hidden = true; });
  toastT = setTimeout(function () { t.hidden = true; }, loi ? 9000 : 2400);
};
var baoLoi = QL.baoLoi = function (e) { toast(e && e.message ? e.message : String(e), true); };

/* ---------- 4. Hộp thoại (thay prompt/confirm của trình duyệt) -------- */
/* QL.hoi({tieuDe, moTa (HTML đã esc), truong: [{ten, nhan, giaTri, kieu, luaChon,
   mau, loiMau, goiY, tuDong(giaTri), batBuoc}], nut, nguyHiem, kiem(giaTri),
   lua: [{nhan, giaTri, kieu}]})
   → Promise: giá trị các trường (hoặc {chon} khi bấm một nút trong `lua`), null khi huỷ. */
QL.hoi = function (o) {
  return new Promise(function (xong) {
    var truong = o.truong || [];
    var lop = document.createElement("div");
    lop.className = "dlg-lop";
    lop.innerHTML = '<div class="dlg' + (o.rong ? " rong" : "") + '" role="dialog" aria-modal="true" aria-labelledby="dlgT">' +
      '<form novalidate><h2 id="dlgT">' + esc(o.tieuDe) + "</h2>" +
      (o.moTa ? '<div class="dlg-mo">' + o.moTa + "</div>" : "") +
      truong.map(function (f, i) {
        var id = "dlgF" + i, val = f.giaTri == null ? "" : f.giaTri;
        var o2 = '<label class="f' + (f.kieu === "checkbox" ? " chk" : "") + '" for="' + id + '">';
        if (f.kieu === "checkbox") {
          return o2 + '<input type="checkbox" id="' + id + '" data-ten="' + esc(f.ten) + '"' + (val ? " checked" : "") + "> " + esc(f.nhan) + "</label>";
        }
        var input = f.kieu === "select" ?
          '<select id="' + id + '" data-ten="' + esc(f.ten) + '">' + (f.luaChon || []).map(function (c) {
            return '<option value="' + esc(c[0]) + '"' + (String(c[0]) === String(val) ? " selected" : "") + ">" + esc(c[1]) + "</option>";
          }).join("") + "</select>" :
          f.kieu === "textarea" ?
          '<textarea id="' + id + '" data-ten="' + esc(f.ten) + '" rows="' + (f.dong || 4) + '"' + (f.mono ? ' class="mono"' : "") + ">" + esc(val) + "</textarea>" :
          '<input type="text" id="' + id + '" data-ten="' + esc(f.ten) + '" value="' + esc(val) + '"' +
          (f.goiYNhap ? ' placeholder="' + esc(f.goiYNhap) + '"' : "") + (f.mono ? ' class="mono"' : "") + ' autocomplete="off" spellcheck="false">';
        return o2 + esc(f.nhan) + input + (f.goiY ? '<span class="goi-y">' + f.goiY + "</span>" : "") +
          '<span class="loi-f" data-loi="' + esc(f.ten) + '" hidden></span></label>';
      }).join("") +
      '<p class="err" id="dlgLoi" hidden></p>' +
      '<div class="dlg-nut">' +
      (o.lua || []).map(function (l, i) {
        return '<button type="button" class="btn ' + (l.kieu || "") + '" data-lua="' + i + '">' + esc(l.nhan) + "</button>";
      }).join("") +
      '<span class="sp"></span><button type="button" class="btn" data-huy>' + esc(o.huy || "Huỷ") + "</button>" +
      (o.nut === false ? "" : '<button type="submit" class="btn ' + (o.nguyHiem ? "ba" : "pri") + '">' + esc(o.nut || "OK") + "</button>") +
      "</div></form></div>";
    document.body.appendChild(lop);
    var truocDo = document.activeElement;
    var form = $("form", lop);
    var daSua = {};
    function giaTri() {
      var v = {};
      $$("[data-ten]", form).forEach(function (el) { v[el.dataset.ten] = el.type === "checkbox" ? el.checked : el.value; });
      return v;
    }
    function dong(kq) {
      document.removeEventListener("keydown", phim, true);
      lop.remove();
      if (truocDo && truocDo.focus) try { truocDo.focus(); } catch (e) {}
      xong(kq);
    }
    function loi(ten, msg) {
      var el = $('[data-loi="' + ten + '"]', form);
      if (el) { el.textContent = msg || ""; el.hidden = !msg; }
    }
    function kiemTra() {
      var v = giaTri(), tot = true;
      truong.forEach(function (f) {
        var x = String(v[f.ten] == null ? "" : v[f.ten]).trim(), m = "";
        if (f.batBuoc && !x && f.kieu !== "checkbox") m = "Không được để trống";
        else if (f.mau && x && !f.mau.test(x)) m = f.loiMau || "Không hợp lệ";
        loi(f.ten, m);
        if (m) tot = false;
      });
      var chung = tot && o.kiem ? o.kiem(v) : "";
      $("#dlgLoi").textContent = chung || ""; $("#dlgLoi").hidden = !chung;
      return tot && !chung ? v : null;
    }
    function phim(e) {
      if (e.key === "Escape") { e.preventDefault(); dong(null); }
      else if (e.key === "Tab") {           /* giữ tiêu điểm trong hộp thoại */
        var ds = $$("input,select,textarea,button", lop).filter(function (x) { return !x.disabled && x.offsetParent; });
        if (!ds.length) return;
        var dau = ds[0], cuoi = ds[ds.length - 1];
        if (e.shiftKey && document.activeElement === dau) { e.preventDefault(); cuoi.focus(); }
        else if (!e.shiftKey && document.activeElement === cuoi) { e.preventDefault(); dau.focus(); }
      }
    }
    document.addEventListener("keydown", phim, true);
    truong.forEach(function (f) {
      var el = $('[data-ten="' + f.ten + '"]', form);
      if (!el) return;
      el.addEventListener("input", function () { daSua[f.ten] = true; loi(f.ten, ""); capNhatTuDong(); });
    });
    function capNhatTuDong() {
      var v = giaTri();
      truong.forEach(function (f) {
        if (!f.tuDong || daSua[f.ten]) return;
        var el = $('[data-ten="' + f.ten + '"]', form);
        if (el) el.value = f.tuDong(v);
      });
    }
    form.addEventListener("submit", function (e) { e.preventDefault(); var v = kiemTra(); if (v) dong(v); });
    $("[data-huy]", form).addEventListener("click", function () { dong(null); });
    $$("[data-lua]", form).forEach(function (b) {
      b.addEventListener("click", function () { dong({ chon: o.lua[+b.dataset.lua].giaTri }); });
    });
    lop.addEventListener("mousedown", function (e) { if (e.target === lop) dong(null); });
    var dau = $("input:not([type=checkbox]),select,textarea", form) || $('[type="submit"]', form) || $("[data-huy]", form);
    setTimeout(function () { dau.focus(); if (dau.select && dau.tagName === "INPUT") dau.select(); }, 20);
  });
};
QL.xacNhan = function (tieuDe, moTa, o) {
  o = o || {};
  return QL.hoi({ tieuDe: tieuDe, moTa: moTa, nut: o.nut || "Đồng ý", nguyHiem: o.nguyHiem, huy: o.huy })
    .then(function (v) { return !!v; });
};

/* ---------- 5. Thay đổi chưa lưu: MỘT chốt cho mọi lối thoát ---------- */
QL.chuaLuu = function () {
  var ds = [];
  if (S.infoDirty) ds.push("thông tin khoá");
  if (S.dirty) ds.push("cấu trúc mục lục");
  if (S.docDirty) ds.push("bài “" + ((S.doc && (S.doc.title || S.doc.id)) || "đang soạn") + "”");
  return ds;
};
/* → Promise<bool>: true = được đi tiếp (không có gì chưa lưu, hoặc người dùng bỏ). */
QL.boQua = function (chiCo) {
  var ds = QL.chuaLuu().filter(function (x) { return !chiCo || chiCo(x); });
  if (!ds.length) return Promise.resolve(true);
  return QL.xacNhan("Còn thay đổi chưa lưu",
    "<p>Chưa lưu: <b>" + ds.map(esc).join("</b>, <b>") + "</b>.</p><p class=\"muted small\">Bài đang soạn vẫn còn bản nháp trên máy này — mở lại bài là khôi phục được.</p>",
    { nut: "Bỏ thay đổi", nguyHiem: true });
};
window.addEventListener("beforeunload", function (e) {
  if (QL.chuaLuu().length) { e.preventDefault(); e.returnValue = ""; }
});

/* ---------- 6. Phiên quản trị ----------------------------------------- */
function luuPhien(r) {
  S.token = r.session; S.exp = r.expiresAt;
  LS.set(PHIEN + ".token", S.token); LS.set(PHIEN + ".exp", S.exp);
  hienPhien();
}
function xoaPhien() { S.token = null; LS.del(PHIEN + ".token"); LS.del(PHIEN + ".exp"); }
var daVao = false;
function hetPhien(msg) {
  xoaPhien();
  $("#btnLock").hidden = true; $("#sessInfo").textContent = "";
  /* Ứng dụng KHÔNG bị gỡ: bài đang sửa vẫn nằm đó; đăng nhập lại rồi bấm Lưu tiếp. */
  $("#login").hidden = false;
  $("#login").classList.toggle("phu", daVao);
  $("#loginErr").textContent = (msg || "Phiên quản trị đã hết") + (daVao ? " — nhập lại khoá, thay đổi chưa lưu vẫn còn." : "");
  $("#loginErr").hidden = false;
  setTimeout(function () { $("#inpKey").focus(); }, 30);
}
function hienPhien() {
  var d = new Date((S.exp || 0) * 1000);
  $("#sessInfo").textContent = S.token ? "phiên tới " + d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) +
    " " + d.toLocaleDateString("vi-VN") : "";
  $("#btnLock").hidden = !S.token;
}
/* Làm mới token khi còn dưới 30 phút — trang để mở lâu không bị đăng xuất giữa chừng. */
setInterval(function () {
  if (!S.token || !S.exp || S.exp - Date.now() / 1000 > 1800) return;
  api("POST", "/courses/admin/session").then(luuPhien, function () {});
}, 5 * 60 * 1000);

$("#frmLogin").addEventListener("submit", function (e) {
  e.preventDefault();
  var key = $("#inpKey").value;
  $("#loginErr").hidden = true;
  api("POST", "/courses/admin/verify", undefined, { headers: { "X-Admin-Key": key } }).then(function (r) {
    $("#inpKey").value = "";
    luuPhien(r);
    $("#login").hidden = true;
    if (daVao) toast("Đã mở khoá lại — bấm Lưu lần nữa nếu vừa lưu dở");
    else vaoUngDung();
  }, function (err) {
    $("#loginErr").textContent = err.code === "invalid_key" ? "Khoá không đúng." :
      err.code === "admin_disabled" ? "Máy chủ chưa bật quản trị khoá học: đặt COURSE_ADMIN_KEY trong môi trường backend rồi khởi động lại." :
      err.message;
    $("#loginErr").hidden = false;
  });
});
$("#btnLock").addEventListener("click", function () {
  QL.boQua().then(function (ok) {
    if (!ok) return;
    S.infoDirty = S.dirty = S.docDirty = false;
    xoaPhien(); location.reload();
  });
});
$("#btnTheme").addEventListener("click", function () {
  var t = LS.get("theme", "auto");
  LS.set("theme", t === "auto" ? "dark" : t === "dark" ? "light" : "auto");
  apTheme();
});

/* ---------- 7. Điều hướng: #/<khoá>/<tab>/<id bài> --------------------- */
var TABS = [["info", "Thông tin"], ["tree", "Cấu trúc & bài"], ["files", "Tệp"], ["links", "Kiểm tra liên kết"], ["search", "Tìm kiếm thử"]];
function docURL() {
  var h = location.hash.replace(/^#\/?/, "");
  if (h === "~thung-rac") return { thungRac: true };
  var p = h.split("/");
  return {
    slug: p[0] ? decodeURIComponent(p[0]) : null,
    tab: TABS.some(function (t) { return t[0] === p[1]; }) ? p[1] : null,
    doc: p.length > 2 ? p.slice(2).map(decodeURIComponent).join("/") : null
  };
}
var datURL = QL.datURL = function () {
  var h = S.view === "trash" ? "#/~thung-rac" :
    S.slug ? "#/" + encodeURIComponent(S.slug) + "/" + S.tab +
      (S.tab === "tree" && S.doc && !S.doc._moi ? "/" + QL.maHoaId(S.doc.id) : "") : "#/";
  if (location.hash !== h) history.replaceState(null, "", h + "");
};
window.addEventListener("hashchange", function () {
  var u = docURL();
  if (u.thungRac) { moThungRac(); return; }
  if (!u.slug) return;
  if (u.slug !== S.slug) { chonKhoa(u.slug, { tab: u.tab, doc: u.doc }); return; }
  if (u.tab && u.tab !== S.tab) { doiTab(u.tab); }
  if (u.doc && (!S.doc || S.doc.id !== u.doc) && QL.soan) QL.soan.moBai(u.doc);
});

/* ---------- 8. Danh sách khoá ----------------------------------------- */
function taiDanhSach(chon, o) {
  return api("GET", "/courses?all=1").then(function (r) {
    S.courses = r.courses || [];
    veDanhSach();
    if (chon) return chonKhoa(chon, Object.assign({ epBuoc: true }, o || {}));
    if (!S.slug && S.view !== "trash") veChuaChon();
  }, baoLoi);
}
QL.taiDanhSach = taiDanhSach;
function veDanhSach() {
  var loc = norm(($("#locKhoa") || {}).value || "").trim();
  var ds = S.courses.filter(function (c) {
    return !loc || norm(c.title + " " + c.slug).indexOf(loc) >= 0;
  });
  $("#locKhoaBox").hidden = S.courses.length < 5;
  $("#courseList").innerHTML = ds.map(function (c) {
    return '<li><button type="button" class="ci' + (c.slug === S.slug ? " on" : "") + '" data-slug="' + esc(c.slug) + '"' +
      (c.slug === S.slug ? ' aria-current="true"' : "") + '>' +
      '<span class="em" aria-hidden="true">' + esc(c.icon || "📘") + '</span><span class="ci-t"><b>' + esc(c.title) +
      '</b><span class="ci-m">' + esc(c.slug) + " · " + c.docCount + " bài · v" + c.version + "</span>" +
      (c.published ? "" : '<span class="chip wa">nháp</span>') + "</span></button></li>";
  }).join("") || '<li class="muted small" style="padding:10px">' +
    (S.courses.length ? "Không khoá nào khớp bộ lọc." : "Chưa có khoá học nào — bấm “＋ Khoá mới”.") + "</li>";
}
QL.veDanhSach = veDanhSach;
$("#courseList").addEventListener("click", function (e) {
  var b = e.target.closest(".ci"); if (!b) return;
  /* khoá đang mở: không tải lại (sẽ mất cây / thông tin đang sửa) — chỉ đóng ngăn kéo */
  if (b.dataset.slug === S.slug && S.view !== "trash") { document.body.classList.remove("ds-mo"); return; }
  chonKhoa(b.dataset.slug);
});
$("#locKhoa").addEventListener("input", veDanhSach);
$("#btnReload").addEventListener("click", function () {
  QL.boQua().then(function (ok) {
    if (!ok) return;
    S.infoDirty = S.dirty = false;
    taiDanhSach(S.view === "trash" ? null : S.slug, { tab: S.tab, giuBai: true });
    if (S.view === "trash") moThungRac();
  });
});

function veChuaChon() {
  S.view = null;
  $("#main").onclick = null;
  $("#main").innerHTML = '<div class="empty">Chọn một khoá học bên trái, tạo khoá mới, hoặc nạp một bundle JSON ' +
    "(định dạng <code>backend/course-content/&lt;slug&gt;.json</code>).<br><br>" +
    "Bundle lớn hơn 4,5 MB (giới hạn thân request của Vercel) hãy nạp bằng CLI:<br>" +
    "<code>python tools/manage_courses.py import ../course-content/&lt;slug&gt;.json --yes</code></div>";
  datURL();
}

/* ---------- 9. Một khoá ---------------------------------------------- */
/* o: {tab, doc, epBuoc (bỏ qua hỏi "chưa lưu"), giuBai (giữ bài đang mở)} */
var chonKhoa = QL.chonKhoa = function (slug, o) {
  o = o || {};
  var doiKhoa = slug !== S.slug;
  var hoi = o.epBuoc || !doiKhoa ? Promise.resolve(true) : QL.boQua();
  return hoi.then(function (ok) {
    if (!ok) { datURL(); return false; }
    return Promise.all([api("GET", "/courses/" + encodeURIComponent(slug)),
                        api("GET", "/courses/" + encodeURIComponent(slug) + "/manifest")]).then(function (r) {
      var giuBai = !doiKhoa && (o.giuBai || o.epBuoc) && S.doc ? S.doc : null;
      S.view = null; S.slug = slug; S.course = r[0]; S.manifest = r[1];
      S.nav = JSON.parse(JSON.stringify(r[0].nav || []));
      S.dirty = false; S.infoDraft = null; S.infoDirty = false;
      if (!giuBai || (!giuBai._moi && !S.manifest.docs[giuBai.id])) { S.doc = null; S.docDirty = false; }
      if (o.tab) S.tab = o.tab;
      veDanhSach(); veKhoa();
      document.body.classList.remove("ds-mo");
      if (o.doc && QL.soan) QL.soan.moBai(o.doc);
      return true;
    }, function (e) {
      baoLoi(e);
      if (e.status === 404 && doiKhoa) { S.slug = null; veDanhSach(); veChuaChon(); }
      return false;
    });
  });
};

function trangDoc(c) {
  return "../khoa-hoc/?khoa=" + encodeURIComponent(c.slug) + (c.published ? "" : "&nhap=1");
}
function trangRieng(c) {
  var w = String((c.config || {}).webapp || "").replace(/\/+$/, "");
  if (!/^[A-Za-z0-9][A-Za-z0-9._\/-]*$/.test(w) || w.split("/").indexOf("..") >= 0) return null;
  return WEBAPP ? WEBAPP + "/" + w + "/" : "../" + w.split("/").pop() + "/";
}
/* Trang có thật trong webapp/: hỏi danh sách của portal MỘT lần, thay vì mở thử
   config.webapp — trượt thì không có dòng 404 nào trong console. */
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
    var o = $("#lkRieng");
    if (!ds || !o || !S.course || S.course.slug !== c.slug) return;
    o.innerHTML = ds[w] ?
      '<a class="btn sm" href="' + esc(url) + (c.published ? "" : "?nhap=1") + '" target="_blank" rel="noopener">Trang riêng ↗</a>' :
      '<span class="muted small">config.webapp “' + esc(w) + "” không có trang trong webapp/ — dùng trang đọc chung.</span>";
  });
}

var veKhoa = QL.veKhoa = function () {
  var c = S.course;
  $("#main").onclick = null;
  $("#main").innerHTML =
    '<div class="ch"><span class="em" aria-hidden="true">' + esc(c.icon || "📘") + '</span><div class="ch-t"><h1>' + esc(c.title) + "</h1>" +
    '<div class="row"><span class="chip ac">' + esc(c.slug) + '</span><span class="chip">v' + c.version +
    '</span><span class="chip">' + c.docCount + " bài</span>" +
    (c.published ? '<span class="chip ok">đã xuất bản</span>' : '<span class="chip wa">nháp — ẩn khỏi trang công khai</span>') +
    "</div>" +
    '<div class="row ch-lk"><a class="btn sm pri" id="lkDoc" href="' + esc(trangDoc(c)) +
    '" target="_blank" rel="noopener" title="Trang đọc chung — dùng được cho mọi khoá, kể cả khoá vừa tạo">' +
    (c.published ? "Mở trang khoá học ↗" : "Xem trước bản nháp ↗") + '</a><span id="lkRieng" class="row"></span>' +
    '<button type="button" class="btn sm" id="bNhanBan">Nhân bản…</button></div>' +
    "</div></div>" +
    '<div class="tabs" role="tablist" aria-label="Phần của khoá">' + TABS.map(function (t) {
      return '<button type="button" class="tab' + (S.tab === t[0] ? " on" : "") + '" id="tab-' + t[0] + '" data-tab="' + t[0] +
        '" role="tab" aria-selected="' + (S.tab === t[0]) + '" aria-controls="tabBody">' + t[1] + "</button>";
    }).join("") + '</div><div id="tabBody" role="tabpanel" aria-labelledby="tab-' + S.tab + '"></div>';
  $$(".tab").forEach(function (b) { b.addEventListener("click", function () { doiTab(b.dataset.tab); }); });
  $("#bNhanBan").addEventListener("click", nhanBanKhoa);
  veTrangRieng(c);
  veTab();
};
function doiTab(tab) {
  S.tab = tab;
  $$(".tab").forEach(function (b) {
    var on = b.dataset.tab === tab;
    b.classList.toggle("on", on); b.setAttribute("aria-selected", on);
  });
  $("#tabBody").setAttribute("aria-labelledby", "tab-" + tab);
  veTab();
}
QL.doiTab = doiTab;
function veTab() {
  var host = $("#tabBody");
  if (S.tab === "info") veThongTin(host);
  else if (S.tab === "tree" && QL.cay) QL.cay.ve(host);
  else if (S.tab === "files" && QL.tep) QL.tep.veTep(host);
  else if (S.tab === "links" && QL.tep) QL.tep.veLienKet(host);
  else veTimThu(host);
  datURL();
}

/* ---------- 9a. Thông tin -------------------------------------------- */
var BIEU_TUONG = ["📘", "🧠", "🧩", "🏗️", "🎙️", "🧪", "📊", "💻", "🌐", "🔐", "📐", "🧮", "🎨", "🗣️", "📚"];
function nhapThongTin() {
  if (!S.infoDraft) {
    var c = S.course, cfg = c.config || {};
    S.infoDraft = { title: c.title, subtitle: c.subtitle, icon: c.icon, description: c.description,
                    published: c.published, cfgText: JSON.stringify(cfg, null, 2) };
  }
  return S.infoDraft;
}
function veThongTin(host) {
  var c = S.course, s = c.stats || {}, d = nhapThongTin();
  host.innerHTML = '<div class="stack">' +
    '<div class="bar' + (S.infoDirty ? " dirty" : "") + '" id="infoBar"><span class="small">' +
    (S.infoDirty ? "Có thay đổi chưa lưu" : "Thông tin khớp database") + '</span><span class="sp"></span>' +
    '<button type="button" class="btn sm" id="bHuyTT"' + (S.infoDirty ? "" : " disabled") + '>Huỷ</button>' +
    '<button type="button" class="btn sm pri" id="bLuu">Lưu thông tin</button></div>' +
    '<div class="grid2"><label class="f">Tiêu đề<input type="text" id="fTitle" value="' + esc(d.title) + '"></label>' +
    '<label class="f">Phụ đề<input type="text" id="fSub" value="' + esc(d.subtitle) + '"></label></div>' +
    '<div class="grid2"><label class="f">Biểu tượng<span class="row"><input type="text" id="fIcon" value="' + esc(d.icon) +
    '" style="max-width:90px"><span class="emo">' + BIEU_TUONG.map(function (x) {
      return '<button type="button" class="btn xs" data-emo="' + x + '" aria-label="Dùng biểu tượng ' + x + '">' + x + "</button>";
    }).join("") + '</span></span></label>' +
    '<label class="f">Slug (không đổi được — là địa chỉ của khoá)<input type="text" value="' + esc(c.slug) + '" disabled></label></div>' +
    '<label class="f">Mô tả (hiện ở trang chủ khoá học)<textarea id="fDesc" rows="3">' + esc(d.description) + "</textarea></label>" +
    '<label class="chk"><input type="checkbox" id="fPub"' + (d.published ? " checked" : "") + "> Đã xuất bản (bỏ chọn = nháp, chỉ quản trị viên thấy)</label>" +
    '<label class="f">Cấu hình (JSON, tuỳ chọn)<textarea id="fCfg" class="mono" rows="5" spellcheck="false">' +
      esc(d.cfgText) + '</textarea><span class="goi-y">“webapp” chỉ cần khi khoá có trang riêng dựng sẵn trong webapp/; ' +
      'không có thì khoá đọc ở trang chung.</span><span class="loi-f" id="cfgLoi" hidden></span></label>' +
    '<div class="kv">' + [["files", "tài liệu"], ["lessons", "bài giảng"], ["words", "từ"], ["minutes", "phút đọc"]].map(function (k) {
      return "<div><b>" + (s[k[0]] || 0).toLocaleString("vi-VN") + "</b><span>" + k[1] + "</span></div>";
    }).join("") + "</div>" +
    '<div class="row"><button type="button" class="btn" id="bXuat">Xuất bundle JSON (kèm tệp)</button></div>' +
    '<div class="card danger"><b>Xoá khoá học</b><p class="muted small" style="margin:6px 0 10px">Khoá vào <b>thùng rác</b> ' +
    "(giữ 30 ngày, khôi phục được cả bài lẫn tệp). Sau 30 ngày mới mất hẳn.</p>" +
    '<button type="button" class="btn ba" id="bXoa">Xoá “' + esc(c.slug) + "”…</button></div></div>";

  function doi() {
    d.title = $("#fTitle").value; d.subtitle = $("#fSub").value; d.icon = $("#fIcon").value;
    d.description = $("#fDesc").value; d.published = $("#fPub").checked; d.cfgText = $("#fCfg").value;
    var cu = S.course;
    S.infoDirty = d.title !== cu.title || d.subtitle !== cu.subtitle || d.icon !== cu.icon ||
      d.description !== cu.description || d.published !== cu.published ||
      d.cfgText.replace(/\s+/g, "") !== JSON.stringify(cu.config || {}).replace(/\s+/g, "");
    var ok = true;
    try { var j = JSON.parse(d.cfgText || "{}"); if (!j || typeof j !== "object" || Array.isArray(j)) ok = false; } catch (e) { ok = false; }
    $("#cfgLoi").textContent = ok ? "" : "Cấu hình phải là một object JSON {…} hợp lệ";
    $("#cfgLoi").hidden = ok;
    $("#infoBar").classList.toggle("dirty", S.infoDirty);
    $("#infoBar .small").textContent = S.infoDirty ? "Có thay đổi chưa lưu" : "Thông tin khớp database";
    $("#bHuyTT").disabled = !S.infoDirty;
  }
  ["fTitle", "fSub", "fIcon", "fDesc", "fCfg"].forEach(function (id) { $("#" + id).addEventListener("input", doi); });
  $("#fPub").addEventListener("change", doi);
  $$("[data-emo]", host).forEach(function (b) {
    b.addEventListener("click", function () { $("#fIcon").value = b.dataset.emo; doi(); });
  });
  $("#bHuyTT").addEventListener("click", function () { S.infoDraft = null; S.infoDirty = false; veThongTin(host); });
  $("#bLuu").addEventListener("click", function () { luuThongTin(); });
  $("#bXuat").addEventListener("click", xuatBundle);
  $("#bXoa").addEventListener("click", xoaKhoa);
}
function luuThongTin(ghiDe) {
  var d = nhapThongTin(), cfg;
  try { cfg = JSON.parse(d.cfgText || "{}"); } catch (e) { baoLoi("Cấu hình không phải JSON hợp lệ: " + e.message); return Promise.resolve(false); }
  if (!cfg || typeof cfg !== "object" || Array.isArray(cfg)) { baoLoi("Cấu hình phải là một object JSON {…}"); return Promise.resolve(false); }
  if (!String(d.title).trim()) { baoLoi("Tiêu đề khoá học không được để trống"); return Promise.resolve(false); }
  return api("PATCH", QL.duongKhoa(), {
    title: d.title.trim(), subtitle: d.subtitle.trim(), icon: d.icon.trim(), description: d.description,
    published: d.published, config: cfg
  }, { headers: ghiDe ? {} : { "If-Match": S.course.infoRev } }).then(function (c2) {
    S.course = Object.assign(S.course, c2); S.infoDraft = null; S.infoDirty = false;
    toast("Đã lưu thông tin");
    var cur = S.courses.filter(function (x) { return x.slug === c2.slug; })[0];
    if (cur) Object.assign(cur, c2);
    veDanhSach(); veKhoa();
    return true;
  }, function (e) {
    if (e.status !== 409) { baoLoi(e); return false; }
    var moi = (e.data || {}).current || {};
    return QL.hoi({
      tieuDe: "Thông tin khoá vừa được sửa ở nơi khác",
      moTa: "<p>Người khác (hoặc tab khác) đã lưu thông tin khoá này sau khi bạn mở nó.</p>" +
        '<p class="small">Bản trên server: <b>' + esc(moi.title || "") + "</b> — " + esc(moi.subtitle || "") + "</p>",
      nut: false, huy: "Để tôi xem lại",
      lua: [{ nhan: "Tải bản trên server (bỏ sửa của tôi)", giaTri: "tai" }, { nhan: "Ghi đè bằng bản của tôi", giaTri: "ghi", kieu: "ba" }]
    }).then(function (v) {
      if (!v) return false;
      if (v.chon === "ghi") return luuThongTin(true);
      S.infoDraft = null; S.infoDirty = false;
      return chonKhoa(S.slug, { epBuoc: true, tab: "info" });
    });
  });
}
QL.luuThongTin = luuThongTin;
function xuatBundle() {
  fetch(S.api + QL.duongKhoa("/export"), { headers: { "X-Admin-Session": S.token } }).then(function (r) {
    if (!r.ok) throw new Error("Lỗi HTTP " + r.status);
    return r.blob();
  }).then(function (b) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(b); a.download = S.slug + ".json"; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }, baoLoi);
}
function xoaKhoa() {
  var slug = S.slug;
  QL.hoi({
    tieuDe: "Xoá khoá “" + S.course.title + "”?",
    moTa: "<p>Khoá, " + S.course.docCount + " bài và mọi tệp sẽ vào <b>thùng rác</b> 30 ngày — khôi phục được trong thời gian đó.</p>",
    truong: [{ ten: "slug", nhan: "Gõ lại slug “" + slug + "” để xác nhận", giaTri: "", mono: true }],
    kiem: function (v) { return v.slug.trim() === slug ? "" : "Slug chưa khớp"; },
    nut: "Xoá — vào thùng rác", nguyHiem: true
  }).then(function (v) {
    if (!v) return;
    api("DELETE", QL.duongKhoa()).then(function () {
      toast("Đã chuyển “" + slug + "” vào thùng rác");
      S.slug = null; S.course = null; S.doc = null; S.dirty = S.docDirty = S.infoDirty = false;
      taiDanhSach();
    }, baoLoi);
  });
}

/* ---------- 9b. Tìm kiếm thử ----------------------------------------- */
function toSang(text, q) {
  var terms = norm(q).split(/\s+/).filter(function (t) { return t.length > 1; });
  var nm = norm(text), out = "", i = 0, marks = [];
  terms.forEach(function (t) {
    var p = nm.indexOf(t);
    while (p >= 0) {
      if (p === 0 || !/[a-z0-9]/.test(nm[p - 1])) marks.push([p, p + t.length]);
      p = nm.indexOf(t, p + t.length);
    }
  });
  marks.sort(function (a, b) { return a[0] - b[0]; });
  marks.forEach(function (m) {
    if (m[0] < i) return;
    out += esc(text.slice(i, m[0])) + "<mark>" + esc(text.slice(m[0], m[1])) + "</mark>";
    i = m[1];
  });
  return out + esc(text.slice(i));
}
QL.toSang = toSang;
function veTimThu(host) {
  host.innerHTML = '<form class="row" style="max-width:640px" id="fTim"><input type="search" id="tQ" placeholder="Từ khoá (gõ không dấu cũng được)…" aria-label="Từ khoá tìm">' +
    '<button type="submit" class="btn pri" id="tTim">Tìm</button></form>' +
    '<p class="muted small">Chính API mà trang khoá học dùng: xếp hạng phía server, tiêu đề &gt; đầu mục &gt; nội dung, khớp đầu từ, ' +
    "từ khoá ≥ 2 ký tự. Bấm một kết quả để mở bài trong tab Cấu trúc.</p>" +
    '<ul class="hits" id="tKq"></ul>';
  $("#fTim").addEventListener("submit", function (e) {
    e.preventDefault();
    var q = $("#tQ").value.trim(); if (!q) return;
    api("GET", QL.duongKhoa("/search?limit=50&q=" + encodeURIComponent(q))).then(function (r) {
      $("#tKq").innerHTML = (r.hits || []).map(function (h) {
        return '<li><button type="button" class="hit" data-id="' + esc(h.id) + '" title="điểm xếp hạng ' + h.score + '"><span class="row"><b>' +
          toSang(h.title, q) + '</b><span class="sp"></span><span class="chip">' + esc(h.group || "ngoài mục lục") +
          '</span></span><span class="sn">' + toSang(h.snippet || "", q) + "</span></button></li>";
      }).join("") || '<li class="muted">Không có kết quả' + (q.replace(/\s/g, "").length < 2 ? " — từ khoá phải dài ít nhất 2 ký tự" : "") + ".</li>";
    }, baoLoi);
  });
  $("#tKq").addEventListener("click", function (e) {
    var b = e.target.closest(".hit[data-id]"); if (!b) return;
    var id = b.dataset.id;
    doiTab("tree");
    if (QL.soan) QL.soan.moBai(id, { cuonToi: true });
  });
  $("#tQ").focus();
}

/* ---------- 10. Tạo, nhân bản, nạp khoá -------------------------------- */
var MAU = [["trong", "Trống — chỉ có khoá, tự dựng mục lục"],
           ["co-ban", "Khoá học cơ bản — Giới thiệu, 3 phần, Tài liệu tra cứu"],
           ["chu-de", "Theo chủ đề — mỗi chủ đề một nhóm bài, có bài tổng kết"]];
var SLUG_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;
function khoaMoi() {
  QL.boQua().then(function (ok) {
    if (!ok) return;
    return QL.hoi({
      tieuDe: "Khoá học mới",
      truong: [
        { ten: "title", nhan: "Tiêu đề", batBuoc: true, goiYNhap: "vd: Toán rời rạc cho lập trình viên" },
        { ten: "slug", nhan: "Slug (địa chỉ của khoá)", batBuoc: true, mono: true, mau: SLUG_RE,
          loiMau: "Chữ thường không dấu, số và '-', tối đa 63 ký tự",
          tuDong: function (v) { return QL.slugHoa(v.title); },
          goiY: "Tự sinh từ tiêu đề; trang đọc sẽ là …/khoa-hoc/?khoa=&lt;slug&gt;" },
        { ten: "subtitle", nhan: "Phụ đề (tuỳ chọn)" },
        { ten: "icon", nhan: "Biểu tượng", giaTri: "📘" },
        { ten: "template", nhan: "Bắt đầu từ", kieu: "select", luaChon: MAU, giaTri: "co-ban" },
        { ten: "published", nhan: "Xuất bản ngay (bỏ chọn = nháp, chỉ quản trị viên thấy)", kieu: "checkbox", giaTri: false }
      ],
      kiem: function (v) {
        return S.courses.some(function (c) { return c.slug === v.slug.trim(); }) ? "Đã có khoá mang slug này" :
          ["admin", "import", "export", "search", "trash"].indexOf(v.slug.trim()) >= 0 ? "Slug này là từ dành riêng" : "";
      },
      nut: "Tạo khoá"
    }).then(function (v) {
      if (!v) return;
      return api("POST", "/courses", {
        slug: v.slug.trim(), title: v.title.trim(), subtitle: v.subtitle.trim(), icon: v.icon.trim(),
        template: v.template, published: v.published
      }).then(function (c) {
        toast("Đã tạo " + c.slug + (c.docCount ? " với " + c.docCount + " bài mẫu" : ""));
        S.infoDirty = S.dirty = S.docDirty = false;
        return taiDanhSach(c.slug, { tab: "tree" });
      }, baoLoi);
    });
  });
}
function nhanBanKhoa() {
  var c = S.course;
  QL.boQua().then(function (ok) {
    if (!ok) return;
    return QL.hoi({
      tieuDe: "Nhân bản “" + c.title + "”",
      moTa: "<p>Bản sao gồm mục lục, mọi bài và tệp; là <b>bản nháp</b> cho tới khi bạn xuất bản.</p>",
      truong: [
        { ten: "slug", nhan: "Slug của bản sao", giaTri: (c.slug + "-ban-sao").slice(0, 63), batBuoc: true, mono: true,
          mau: SLUG_RE, loiMau: "Chữ thường không dấu, số và '-'" },
        { ten: "title", nhan: "Tiêu đề", giaTri: c.title + " (bản sao)" }
      ],
      kiem: function (v) { return S.courses.some(function (x) { return x.slug === v.slug.trim(); }) ? "Đã có khoá mang slug này" : ""; },
      nut: "Nhân bản"
    }).then(function (v) {
      if (!v) return;
      toast("Đang nhân bản…");
      return api("POST", QL.duongKhoa("/duplicate"), { slug: v.slug.trim(), title: v.title.trim() }).then(function (n) {
        toast("Đã tạo bản sao " + n.slug);
        S.infoDirty = S.dirty = S.docDirty = false;
        return taiDanhSach(n.slug, { tab: "info" });
      }, baoLoi);
    });
  });
}
$("#btnNew").addEventListener("click", khoaMoi);

$("#inpImport").addEventListener("change", function (e) {
  var f = e.target.files[0];
  e.target.value = "";
  if (!f) return;
  var rd = new FileReader();
  rd.onload = function () {
    var b;
    try { b = JSON.parse(rd.result); } catch (err) { baoLoi("Tệp không phải JSON: " + err.message); return; }
    if (!b || typeof b.docs !== "object") { baoLoi("Không giống một bundle khoá học (thiếu docs)"); return; }
    var slugCo = b.course && b.course.slug;
    var mb = f.size / 1048576;
    QL.hoi({
      tieuDe: "Nạp bundle “" + f.name + "”",
      moTa: "<p>" + Object.keys(b.docs).length + " bài" + (b.assets ? ", " + Object.keys(b.assets).length + " tệp" : "") +
        ", " + mb.toFixed(1) + " MB.</p>" +
        (mb > 4.4 ? '<p class="err">Vượt giới hạn 4,5 MB của Vercel — chỉ nạp được khi backend chạy nơi khác (máy cục bộ). Trên Vercel hãy dùng CLI manage_courses.py.</p>' : ""),
      truong: [{ ten: "slug", nhan: "Slug khoá", giaTri: slugCo || f.name.replace(/\.json$/i, ""), batBuoc: true, mono: true,
                 mau: SLUG_RE, loiMau: "Chữ thường không dấu, số và '-'",
                 goiY: "Trùng một khoá đã có thì khoá đó bị THAY TOÀN BỘ — bản cũ vào thùng rác." }],
      nut: "Nạp"
    }).then(function (v) {
      if (!v) return;
      var slug = v.slug.trim();
      var co = S.courses.some(function (c) { return c.slug === slug; });
      var hoiTiep = co ? QL.xacNhan("Thay khoá “" + slug + "”?", "<p>Toàn bộ nội dung và cấu trúc của khoá này sẽ bị thay. Bản cũ vào thùng rác (30 ngày).</p>",
                                    { nut: "Thay", nguyHiem: true }) : Promise.resolve(true);
      hoiTiep.then(function (ok) {
        if (!ok) return;
        toast("Đang nạp " + Object.keys(b.docs).length + " bài…");
        api("POST", "/courses/import?slug=" + encodeURIComponent(slug), rd.result).then(function (c) {
          toast("Đã nạp " + c.slug + ": " + c.docCount + " bài, v" + c.version);
          S.dirty = S.docDirty = S.infoDirty = false;
          taiDanhSach(c.slug);
        }, baoLoi);
      });
    });
  };
  rd.readAsText(f);
});

/* ---------- 11. Thùng rác ---------------------------------------------- */
function moThungRac() {
  return QL.boQua().then(function (ok) {
    if (!ok) return;
    S.view = "trash"; S.slug = null; S.course = null; S.doc = null; S.dirty = S.docDirty = S.infoDirty = false;
    veDanhSach();
    document.body.classList.remove("ds-mo");
    $("#main").innerHTML = '<div class="boot">Đang tải thùng rác…</div>';
    datURL();
    return api("GET", "/courses/trash").then(veThungRac, baoLoi);
  });
}
function veThungRac(r) {
  var kh = r.courses || [], bai = r.docs || [];
  $("#main").innerHTML = '<div class="stack rong"><h1 style="margin:0">Thùng rác</h1>' +
    '<p class="muted small">Khoá và bài đã xoá được giữ 30 ngày. Khôi phục đưa khoá về nguyên vẹn (bài, mục lục, tệp); ' +
    "bài về đúng nhóm cũ nếu nhóm còn.</p>" +
    "<h2>Khoá học (" + kh.length + ")</h2>" +
    (kh.length ? '<ul class="tr-ds">' + kh.map(function (c) {
      return '<li><span class="ci-t"><b>' + esc(c.title) + '</b><span class="ci-m">' + esc(c.slug) + " · " + c.docCount + " bài · xoá " +
        esc(QL.luc(c.deletedAt)) + '</span></span><span class="sp"></span><button type="button" class="btn sm pri" data-kp-khoa="' + c.id +
        '" data-slug="' + esc(c.slug) + '">Khôi phục</button><button type="button" class="btn sm ba" data-xoa-han="' + c.id + '">Xoá hẳn</button></li>';
    }).join("") + "</ul>" : '<p class="muted">Không có khoá nào.</p>') +
    "<h2>Bài (" + bai.length + ")</h2>" +
    (bai.length ? '<ul class="tr-ds">' + bai.map(function (d) {
      return '<li><span class="ci-t"><b>' + esc(d.title || d.docId) + '</b><span class="ci-m">' + esc(d.courseTitle) + " · " + esc(d.docId) +
        " · xoá " + esc(QL.luc(d.savedAt)) + (d.placement && d.placement.group ? " · từ nhóm " + esc(d.placement.group) : "") +
        '</span></span><span class="sp"></span>' +
        (d.idInUse ? '<span class="chip wa" title="Khoá đã có bài khác mang id này">id đã bị dùng lại</span>' :
          '<button type="button" class="btn sm pri" data-kp-bai="' + d.id + '" data-khoa="' + esc(d.courseSlug) + '">Khôi phục</button>') +
        "</li>";
    }).join("") + "</ul>" : '<p class="muted">Không có bài nào.</p>') + "</div>";
  $("#main").onclick = function (e) {
    var b = e.target.closest("button"); if (!b) return;
    if (b.dataset.kpKhoa) khoiPhucKhoa(+b.dataset.kpKhoa, b.dataset.slug);
    else if (b.dataset.xoaHan) {
      QL.xacNhan("Xoá hẳn khoá này?", "<p>Không khôi phục được nữa.</p>", { nut: "Xoá hẳn", nguyHiem: true }).then(function (ok) {
        if (ok) api("DELETE", "/courses/trash/courses/" + b.dataset.xoaHan).then(function () { toast("Đã xoá hẳn"); moThungRac(); }, baoLoi);
      });
    } else if (b.dataset.kpBai) {
      api("POST", "/courses/" + encodeURIComponent(b.dataset.khoa) + "/trash/" + b.dataset.kpBai + "/restore").then(function (d) {
        toast("Đã khôi phục bài “" + (d.title || d.id) + "”" + (d.group ? " vào nhóm " + d.group : " (ngoài mục lục)"));
        taiDanhSach(b.dataset.khoa, { tab: "tree", doc: d.id });
      }, baoLoi);
    }
  };
}
function khoiPhucKhoa(id, slug) {
  api("POST", "/courses/trash/courses/" + id + "/restore", {}).then(function (c) {
    toast("Đã khôi phục " + c.slug);
    taiDanhSach(c.slug);
  }, function (e) {
    if (e.status !== 409) { baoLoi(e); return; }
    QL.hoi({
      tieuDe: "Slug “" + slug + "” đang được dùng",
      moTa: "<p>Đã có khoá mang slug này. Khôi phục dưới slug khác:</p>",
      truong: [{ ten: "slug", nhan: "Slug mới", giaTri: slug + "-khoi-phuc", batBuoc: true, mono: true, mau: SLUG_RE,
                 loiMau: "Chữ thường không dấu, số và '-'" }],
      nut: "Khôi phục"
    }).then(function (v) {
      if (!v) return;
      api("POST", "/courses/trash/courses/" + id + "/restore", { slug: v.slug.trim() }).then(function (c) {
        toast("Đã khôi phục thành " + c.slug); taiDanhSach(c.slug);
      }, baoLoi);
    });
  });
}
$("#btnTrash").addEventListener("click", moThungRac);

/* ---------- 12. Phím tắt, ngăn kéo trên màn nhỏ ------------------------- */
document.addEventListener("keydown", function (e) {
  if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === "s" || e.key === "S")) {
    if ($(".dlg-lop")) return;
    e.preventDefault();
    if (S.docDirty && QL.soan) QL.soan.luu();
    else if (S.dirty && QL.cay) QL.cay.luu();
    else if (S.infoDirty) luuThongTin();
    else toast("Không có gì cần lưu");
  }
});
$("#btnDs").addEventListener("click", function () { document.body.classList.toggle("ds-mo"); });
$("#scrim").addEventListener("click", function () { document.body.classList.remove("ds-mo"); });

/* ---------- 13. Khởi động -------------------------------------------- */
function vaoUngDung() {
  daVao = true;
  $("#login").hidden = true; $("#login").classList.remove("phu"); $("#app").hidden = false;
  hienPhien();
  var u = docURL();
  if (u.thungRac) { taiDanhSach(); moThungRac(); return; }
  taiDanhSach(u.slug, { tab: u.tab || "info", doc: u.doc });
}
document.addEventListener("DOMContentLoaded", function () {
  $("#apiInfo").textContent = (S.api || location.origin) + "/courses";
  if (S.token) {
    api("POST", "/courses/admin/session").then(function (r) { luuPhien(r); vaoUngDung(); }, function () {
      xoaPhien(); $("#login").hidden = false; $("#loginErr").hidden = true;
    });
  } else {
    $("#login").hidden = false;
  }
});
})();
