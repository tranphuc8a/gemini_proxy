/* ==========================================================================
   QUẢN LÝ KHOÁ HỌC — tab "Cấu trúc & bài": cây mục lục section → nhóm → bài.

   · Kéo-thả: bài giữa các nhóm (thả lên một bài = chèn trước/sau nó, lên đầu
     nhóm = cuối nhóm), nhóm giữa các section, section với nhau. Bàn phím: ↑ ↓
     và nút ⇄ "chuyển tới…" làm được mọi việc kéo-thả làm.
   · Ô lọc bài, thu gọn / mở từng nhóm (nhớ theo khoá trên máy này).
   · Hộp thoại có kiểm tra ngay (id section, id bài) thay cho prompt().
   · Lưu cả cây một lần, kèm If-Match: người khác vừa lưu thì hỏi, không ghi đè.
   · Vẽ lại chỉ phần cây, giữ vị trí cuộn; không còn 292 ô <select>.
   ========================================================================== */
(function () {
"use strict";
var QL = window.QL, S = QL.S, $ = QL.$, $$ = QL.$$, esc = QL.esc;

var BIEU_TUONG = [["compass", "la bàn (lộ trình)"], ["book", "sách (tài liệu)"], ["layers", "lớp (đồ án)"],
                  ["route", "đường đi"], ["grid", "lưới"], ["note", "ghi chú"], ["star", "ngôi sao"],
                  ["clock", "đồng hồ"], ["link", "liên kết"]];
var SEC_ID = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
var DOC_ID = /^[\p{L}\p{N}_][\p{L}\p{N}_.@+\/-]*$/u;

var loc = "";                          /* chữ trong ô lọc */
var keo = null;                        /* đang kéo: {k, s, g, i, id} */

function thuGon() {
  if (!S._thuGon || S._thuGon.slug !== S.slug) S._thuGon = { slug: S.slug, ds: QL.LS.get("thuGon@" + S.slug, []) };
  return S._thuGon.ds;
}
function luuThuGon() { QL.LS.set("thuGon@" + S.slug, thuGon()); }
function khoaNhom(sec, grp) { return sec.id + "/" + (grp.short || grp.title); }

function trongCay() {
  var co = {};
  S.nav.forEach(function (s) { s.groups.forEach(function (g) { g.items.forEach(function (i) { co[i] = true; }); }); });
  return co;
}
function tenBai(id) { var d = S.manifest.docs[id]; return d ? d.title : id + " (không còn trong khoá)"; }
function khop(id) {
  if (!loc) return true;
  var d = S.manifest.docs[id];
  return QL.norm((d ? d.title + " " + (d.slug || "") : "") + " " + id).indexOf(loc) >= 0;
}

/* ---------- vẽ ------------------------------------------------------- */
function nut(op, nhan, title, data) {
  return '<button type="button" class="btn xs" data-op="' + op + '"' + (data || "") + ' title="' + esc(title) + '" aria-label="' + esc(title) + '">' + nhan + "</button>";
}
function htmlCay() {
  var tg = thuGon(), dsMo = trongCay(), keoDuoc = !loc;
  var cay = S.nav.map(function (s, si) {
    var sd = ' data-s="' + si + '"';
    var nhom = s.groups.map(function (g, gi) {
      var gd = sd + ' data-g="' + gi + '"', key = khoaNhom(s, g);
      var ids = g.items.filter(khop);
      if (loc && !ids.length) return "";
      var gon = !loc && tg.indexOf(key) >= 0;
      return '<div class="grp' + (gon ? " gon" : "") + '"' + gd + '>' +
        '<div class="grp-h" data-k="grp"' + gd + (keoDuoc ? ' draggable="true"' : "") + '>' +
        '<button type="button" class="tg" data-op="tg" data-key="' + esc(key) + '" aria-expanded="' + !gon + '" aria-label="' + (gon ? "Mở" : "Thu gọn") + ' nhóm">' + (gon ? "▸" : "▾") + "</button>" +
        '<span class="short">' + esc(g.short || "—") + '</span><span class="nm">' + esc(g.title) + '</span><span class="muted">(' + g.items.length + ")</span>" +
        '<span class="ctl">' + nut("len", "↑", "Nhóm lên", gd) + nut("xuong", "↓", "Nhóm xuống", gd) + nut("suaNhom", "Sửa", "Sửa nhóm", gd) +
        nut("baiMoi", "＋ Bài", "Thêm bài vào nhóm này", gd) + nut("xoaNhom", "Xoá", "Xoá nhóm", gd) + "</span></div>" +
        (gon ? "" : g.items.map(function (id, ii) {
          if (!khop(id)) return "";
          var dd = gd + ' data-i="' + ii + '"';
          return '<div class="di' + (S.doc && S.doc.id === id ? " on" : "") + (S.manifest.docs[id] ? "" : " mat") + '" data-k="doc"' + dd +
            ' data-id="' + esc(id) + '"' + (keoDuoc ? ' draggable="true"' : "") + '><span class="keo" aria-hidden="true">⠿</span>' +
            '<button type="button" class="t" data-op="mo" title="' + esc(id) + '">' + esc(tenBai(id)) + "</button>" +
            '<span class="ctl">' + nut("len", "↑", "Lên", dd) + nut("xuong", "↓", "Xuống", dd) + nut("chuyen", "⇄", "Chuyển tới nhóm khác…", dd) +
            nut("boRa", "×", "Bỏ khỏi mục lục (bài vẫn còn)", dd) + "</span></div>";
        }).join("")) + "</div>";
    }).join("");
    if (loc && !nhom) return "";
    return '<div class="sec"' + sd + '><div class="sec-h" data-k="sec"' + sd + (keoDuoc ? ' draggable="true"' : "") + '>' +
      '<span class="nm">' + esc(s.title) + '</span><span class="chip" title="id section">' + esc(s.id) + "</span>" +
      '<span class="ctl">' + nut("len", "↑", "Section lên", sd) + nut("xuong", "↓", "Section xuống", sd) + nut("suaSec", "Sửa", "Sửa section", sd) +
      nut("themNhom", "＋ Nhóm", "Thêm nhóm", sd) + nut("xoaSec", "Xoá", "Xoá section", sd) + "</span></div>" + nhom + "</div>";
  }).join("");
  var ngoai = Object.keys(S.manifest.docs).filter(function (id) { return !dsMo[id] && khop(id); });
  var htmlNgoai = ngoai.length ? '<div class="orph"><div class="grp-h"><span class="nm">Ngoài mục lục</span><span class="muted">(' + ngoai.length +
    ") — bài còn trong database nhưng không hiện trên trang; kéo vào một nhóm để hiện</span></div>" + ngoai.map(function (id) {
      return '<div class="di' + (S.doc && S.doc.id === id ? " on" : "") + '" data-k="mo" data-id="' + esc(id) + '"' + (keoDuoc ? ' draggable="true"' : "") +
        '><span class="keo" aria-hidden="true">⠿</span><button type="button" class="t" data-op="mo">' + esc(tenBai(id)) + "</button>" +
        '<span class="ctl">' + nut("dua", "⇄ Đưa vào…", "Đưa vào một nhóm…", ' data-id="' + esc(id) + '"') + "</span></div>";
    }).join("") + "</div>" : "";
  return (cay || (loc ? '<div class="empty">Không bài nào khớp “' + esc(loc) + "”.</div>" :
    '<div class="empty">Chưa có section nào — bấm “＋ Section”. Mục lục gồm section → nhóm → bài.</div>')) + htmlNgoai;
}
function veCay() {
  var t = $("#tree");
  if (!t) return;
  var cuon = t.scrollTop;
  t.innerHTML = htmlCay();
  t.scrollTop = cuon;
  capNhatThanh();
}
function capNhatThanh() {
  var bar = $("#treeBar");
  if (!bar) return;
  bar.classList.toggle("dirty", S.dirty);
  $("#treeTT").textContent = S.dirty ? "Có thay đổi cấu trúc chưa lưu" : "Cấu trúc khớp database";
  $("#bHuy").disabled = !S.dirty; $("#bLuuCay").disabled = !S.dirty;
}
function doiCay() { S.dirty = true; veCay(); }

function ve(host) {
  host.innerHTML = '<div class="st" id="st">' +
    '<div class="cay-cot"><div class="bar' + (S.dirty ? " dirty" : "") + '" id="treeBar">' +
    '<input type="search" id="locBai" placeholder="Lọc bài…" aria-label="Lọc bài theo tên hoặc id" value="' + esc(loc) + '">' +
    '<button type="button" class="btn sm" id="bGon" title="Thu gọn / mở tất cả nhóm">⇕</button>' +
    '<button type="button" class="btn sm" id="bThemSec">＋ Section</button>' +
    '<span class="small" id="treeTT"></span><span class="sp"></span>' +
    '<button type="button" class="btn sm" id="bHuy">Huỷ</button>' +
    '<button type="button" class="btn sm pri" id="bLuuCay">Lưu cấu trúc</button></div>' +
    '<div class="tree" id="tree" role="list" aria-label="Mục lục khoá học"></div></div>' +
    '<div class="ed" id="editor"></div></div>';
  veCay();
  if (QL.soan) QL.soan.ve();

  $("#locBai").addEventListener("input", function () { loc = QL.norm(this.value.trim()); veCay(); });
  $("#bGon").addEventListener("click", function () {
    var tg = thuGon(), tat = [];
    S.nav.forEach(function (s) { s.groups.forEach(function (g) { tat.push(khoaNhom(s, g)); }); });
    S._thuGon.ds = tg.length ? [] : tat;
    luuThuGon(); veCay();
  });
  $("#bThemSec").addEventListener("click", function () { suaSection(null); });
  $("#bHuy").addEventListener("click", function () {
    S.nav = JSON.parse(JSON.stringify(S.course.nav || [])); S.dirty = false; veCay();
  });
  $("#bLuuCay").addEventListener("click", function () { luu(); });
  var tree = $("#tree");
  tree.addEventListener("click", xuLy);
  tree.addEventListener("dragstart", batDauKeo);
  tree.addEventListener("dragover", quaKeo);
  tree.addEventListener("dragleave", function (e) { if (!tree.contains(e.relatedTarget)) xoaDauTha(); });
  tree.addEventListener("drop", tha);
  tree.addEventListener("dragend", function () { keo = null; xoaDauTha(); tree.classList.remove("dang-keo"); });
}

/* ---------- thao tác -------------------------------------------------- */
function doiCho(arr, i, j) { if (j < 0 || j >= arr.length) return false; var t = arr[i]; arr[i] = arr[j]; arr[j] = t; return true; }
function xuLy(e) {
  var el = e.target.closest("[data-op]");
  if (!el) return;
  var op = el.dataset.op, a = +el.dataset.s, b = +el.dataset.g, c = +el.dataset.i;
  var sec = S.nav[a], grp = sec && sec.groups[b];
  if (op === "mo") { var di = el.closest(".di"); if (di) QL.soan.moBai(di.dataset.id); return; }
  if (op === "tg") {
    var tg = thuGon(), key = el.dataset.key, k = tg.indexOf(key);
    if (k >= 0) tg.splice(k, 1); else tg.push(key);
    luuThuGon(); veCay(); return;
  }
  var row = el.closest("[data-k]"), kieu = row ? row.dataset.k : "";
  if (op === "len" || op === "xuong") {
    var d = op === "len" ? -1 : 1;
    var moved = kieu === "sec" ? doiCho(S.nav, a, a + d) : kieu === "grp" ? doiCho(sec.groups, b, b + d) : doiCho(grp.items, c, c + d);
    if (moved) {
      doiCay();
      /* tiêu điểm theo hàng vừa chuyển, để bấm ↑/↓ liên tiếp bằng bàn phím */
      var sel = kieu === "doc" ? '.di[data-s="' + a + '"][data-g="' + b + '"][data-i="' + (c + d) + '"] [data-op="' + op + '"]' :
        kieu === "grp" ? '.grp-h[data-s="' + a + '"][data-g="' + (b + d) + '"] [data-op="' + op + '"]' :
        '.sec-h[data-s="' + (a + d) + '"] [data-op="' + op + '"]';
      var f = $(sel); if (f) f.focus();
    }
  } else if (op === "suaSec") suaSection(sec);
  else if (op === "themNhom") suaNhom(sec, null);
  else if (op === "suaNhom") suaNhom(sec, grp);
  else if (op === "xoaSec") {
    var n = sec.groups.reduce(function (x, g) { return x + g.items.length; }, 0);
    QL.xacNhan("Xoá section “" + sec.title + "”?", n ? "<p>" + n + " bài sẽ ra “Ngoài mục lục” (không bị xoá).</p>" : "",
               { nut: "Xoá section", nguyHiem: true }).then(function (ok) { if (ok) { S.nav.splice(a, 1); doiCay(); } });
  } else if (op === "xoaNhom") {
    QL.xacNhan("Xoá nhóm “" + grp.title + "”?", grp.items.length ? "<p>" + grp.items.length + " bài sẽ ra “Ngoài mục lục” (không bị xoá).</p>" : "",
               { nut: "Xoá nhóm", nguyHiem: true }).then(function (ok) { if (ok) { sec.groups.splice(b, 1); doiCay(); } });
  } else if (op === "boRa") { grp.items.splice(c, 1); doiCay(); }
  else if (op === "chuyen" || op === "dua") {
    menuNhom(el, op === "chuyen").then(function (dich) {
      if (!dich) return;
      var id = op === "chuyen" ? grp.items[c] : el.dataset.id;
      if (op === "chuyen") grp.items.splice(c, 1);
      if (dich !== "ra") S.nav[dich[0]].groups[dich[1]].items.push(id);
      doiCay();
    });
  } else if (op === "baiMoi") baiMoi(sec, grp);
}

/* Một menu nổi cạnh nút: các nhóm (và "bỏ khỏi mục lục"). */
function menuNhom(neo, coBoRa) {
  return new Promise(function (xong) {
    var cu = $(".menu-noi"); if (cu) cu.remove();
    var m = document.createElement("div");
    m.className = "menu-noi"; m.setAttribute("role", "menu");
    var muc = [];
    S.nav.forEach(function (s, si) {
      s.groups.forEach(function (g, gi) { muc.push([si + ":" + gi, s.title + " › " + (g.short || g.title)]); });
    });
    m.innerHTML = (muc.length ? muc.map(function (x) {
      return '<button type="button" role="menuitem" data-v="' + x[0] + '">' + esc(x[1]) + "</button>";
    }).join("") : '<span class="muted small">Chưa có nhóm nào</span>') +
      (coBoRa ? '<button type="button" role="menuitem" data-v="ra" class="ra">Bỏ khỏi mục lục</button>' : "");
    document.body.appendChild(m);
    var r = neo.getBoundingClientRect();
    m.style.top = Math.min(r.bottom + 4, innerHeight - m.offsetHeight - 8) + "px";
    m.style.left = Math.max(8, Math.min(r.right - m.offsetWidth, innerWidth - m.offsetWidth - 8)) + "px";
    function dong(v) {
      document.removeEventListener("mousedown", ngoai, true);
      document.removeEventListener("keydown", phim, true);
      m.remove(); neo.focus(); xong(v);
    }
    function ngoai(e) { if (!m.contains(e.target)) dong(null); }
    function phim(e) {
      var ds = $$("button", m), i = ds.indexOf(document.activeElement);
      if (e.key === "Escape") { e.preventDefault(); dong(null); }
      else if (e.key === "ArrowDown") { e.preventDefault(); (ds[i + 1] || ds[0]).focus(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); (ds[i - 1] || ds[ds.length - 1]).focus(); }
    }
    document.addEventListener("mousedown", ngoai, true);
    document.addEventListener("keydown", phim, true);
    m.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-v]"); if (!b) return;
      dong(b.dataset.v === "ra" ? "ra" : b.dataset.v.split(":").map(Number));
    });
    var dau = $("button", m); if (dau) dau.focus();
  });
}
QL.menuNhom = menuNhom;

function suaSection(sec) {
  var co = BIEU_TUONG.slice();
  if (sec && sec.icon && !co.some(function (x) { return x[0] === sec.icon; })) co.push([sec.icon, sec.icon]);
  QL.hoi({
    tieuDe: sec ? "Sửa section" : "Thêm section",
    truong: [
      { ten: "title", nhan: "Tiêu đề", batBuoc: true, giaTri: sec ? sec.title : "", goiYNhap: "vd: Khoá học, Đồ án, Tài liệu" },
      { ten: "id", nhan: "Id", batBuoc: true, mono: true, giaTri: sec ? sec.id : "", mau: SEC_ID,
        loiMau: "Chỉ chữ không dấu, số, '_' và '-' (vd: khoa-hoc)",
        tuDong: sec ? null : function (v) { return QL.slugHoa(v.title); },
        goiY: "Tự sinh từ tiêu đề. Trang đọc dùng nó để nhớ section nào đang mở." },
      { ten: "sub", nhan: "Mô tả ngắn (dưới tiêu đề, tuỳ chọn)", giaTri: sec ? sec.sub : "" },
      { ten: "icon", nhan: "Biểu tượng", kieu: "select", luaChon: co, giaTri: sec ? sec.icon || "book" : "book" }
    ],
    kiem: function (v) {
      return S.nav.some(function (s) { return s !== sec && s.id === v.id.trim(); }) ? "Đã có section mang id này" : "";
    },
    nut: sec ? "Lưu vào cây" : "Thêm"
  }).then(function (v) {
    if (!v) return;
    if (sec) { sec.title = v.title.trim(); sec.id = v.id.trim(); sec.sub = v.sub.trim(); sec.icon = v.icon; }
    else S.nav.push({ id: v.id.trim(), title: v.title.trim(), sub: v.sub.trim(), icon: v.icon, groups: [] });
    doiCay();
  });
}
function suaNhom(sec, grp) {
  QL.hoi({
    tieuDe: grp ? "Sửa nhóm" : "Thêm nhóm vào “" + sec.title + "”",
    truong: [
      { ten: "title", nhan: "Tiêu đề nhóm", batBuoc: true, giaTri: grp ? grp.title : "", goiYNhap: "vd: Phần 2 — Thực hành" },
      { ten: "short", nhan: "Tên ngắn (hiện trên trang, tuỳ chọn)", giaTri: grp ? grp.short : "", goiYNhap: "vd: Phần 2" }
    ],
    nut: grp ? "Lưu vào cây" : "Thêm"
  }).then(function (v) {
    if (!v) return;
    if (grp) { grp.title = v.title.trim(); grp.short = v.short.trim(); }
    else sec.groups.push({ title: v.title.trim(), short: v.short.trim(), meta: {}, items: [] });
    doiCay();
  });
}

/* Id gợi ý: <thư mục của nhóm>/<tiêu đề bỏ dấu>.md — không trùng bài nào. */
function goiYId(sec, grp, title) {
  var thuMuc = QL.slugHoa(grp.short || grp.title) || sec.id;
  var ten = QL.slugHoa(title) || "bai-" + String(grp.items.length + 1).padStart(2, "0");
  var id = thuMuc + "/" + ten + ".md", n = 2;
  while (S.manifest.docs[id]) id = thuMuc + "/" + ten + "-" + (n++) + ".md";
  return id;
}
QL.goiYId = goiYId;
function baiMoi(sec, grp) {
  var truoc = S.dirty ?
    QL.xacNhan("Lưu cấu trúc trước?", "<p>Bài mới được đặt vào nhóm trong database, nên cây đang sửa phải được lưu trước.</p>",
               { nut: "Lưu cấu trúc rồi thêm bài" }).then(function (ok) { return ok && luu(); }) :
    Promise.resolve(true);
  truoc.then(function (ok) {
    if (!ok) return;
    return QL.boQua(function (x) { return x.indexOf("bài") === 0; }).then(function (ok2) {
      if (!ok2) return;
      /* sau khi lưu cây, S.nav là bản mới: tìm lại nhóm theo id section + nhãn */
      var s2 = S.nav.filter(function (s) { return s.id === sec.id; })[0] || sec;
      var g2 = s2.groups.filter(function (g) { return (g.short || g.title) === (grp.short || grp.title); })[0] || grp;
      var kinds = {};
      Object.keys(S.manifest.docs).forEach(function (k) { kinds[S.manifest.docs[k].kind] = 1; });
      kinds.lesson = 1;
      return QL.hoi({
        tieuDe: "Bài mới trong “" + s2.title + " › " + (g2.short || g2.title) + "”",
        truong: [
          { ten: "title", nhan: "Tiêu đề bài", batBuoc: true, goiYNhap: "vd: Bài 3 — Đạo hàm và gradient" },
          { ten: "id", nhan: "Id (đường dẫn của bài)", batBuoc: true, mono: true, mau: DOC_ID,
            loiMau: "Chữ, số và . _ @ + - / — không dấu cách",
            tuDong: function (v) { return goiYId(s2, g2, v.title); },
            goiY: "Tự sinh từ tiêu đề. Đổi về sau được bằng “Đổi id” (tiến độ người học đi theo)." },
          { ten: "kind", nhan: "Loại", kieu: "select", giaTri: "lesson",
            luaChon: Object.keys(kinds).sort().map(function (k) { return [k, k]; }) }
        ],
        kiem: function (v) { return S.manifest.docs[v.id.trim()] ? "Đã có bài mang id này" : ""; },
        nut: "Tạo bài"
      }).then(function (v) {
        if (!v) return;
        var id = v.id.trim();
        return QL.api("PUT", QL.duongKhoa("/docs/" + QL.maHoaId(id)), {
          title: v.title.trim(), md: "# " + v.title.trim() + "\n\n", kind: v.kind,
          section: s2.id, group: g2.short || g2.title
        }, { headers: { "If-None-Match": "*" } }).then(function () {
          QL.toast("Đã tạo bài — viết nội dung rồi Lưu (Ctrl+S)");
          return QL.chonKhoa(S.slug, { epBuoc: true, tab: "tree", doc: id });
        }, QL.baoLoi);
      });
    });
  });
}

function luu(ghiDe) {
  return QL.api("PUT", QL.duongKhoa("/structure"), { nav: S.nav },
                { headers: ghiDe ? {} : { "If-Match": S.course.treeRev } }).then(function () {
    QL.toast("Đã lưu cấu trúc");
    S.dirty = false;
    return QL.chonKhoa(S.slug, { epBuoc: true, tab: S.tab });
  }, function (e) {
    if (e.status !== 409) { QL.baoLoi(e); return false; }
    return QL.hoi({
      tieuDe: "Mục lục vừa được sửa ở nơi khác",
      moTa: "<p>Người khác (hoặc tab khác) đã lưu mục lục khoá này sau khi bạn mở nó. Lưu bây giờ sẽ xoá thay đổi của họ.</p>",
      nut: false, huy: "Để tôi xem lại",
      lua: [{ nhan: "Tải mục lục mới (bỏ thay đổi của tôi)", giaTri: "tai" }, { nhan: "Ghi đè bằng mục lục của tôi", giaTri: "ghi", kieu: "ba" }]
    }).then(function (v) {
      if (!v) return false;
      if (v.chon === "ghi") return luu(true);
      S.dirty = false;
      return QL.chonKhoa(S.slug, { epBuoc: true, tab: "tree" });
    });
  });
}

/* ---------- kéo-thả --------------------------------------------------- */
function batDauKeo(e) {
  var el = e.target.closest("[draggable=true]");
  if (!el) return;
  keo = { k: el.dataset.k, s: +el.dataset.s, g: +el.dataset.g, i: +el.dataset.i, id: el.dataset.id };
  e.dataTransfer.effectAllowed = "move";
  try { e.dataTransfer.setData("text/plain", keo.id || keo.k); } catch (err) {}
  $("#tree").classList.add("dang-keo");
  el.classList.add("dang-bi-keo");
}
function xoaDauTha() {
  $$(".tha-tren,.tha-duoi,.tha-vao,.dang-bi-keo").forEach(function (x) {
    x.classList.remove("tha-tren", "tha-duoi", "tha-vao", "dang-bi-keo");
  });
}
/* Đích thả cho thứ đang kéo: {el, kieu: "tren"|"duoi"|"vao", s, g, i} */
function dichTha(e) {
  if (!keo) return null;
  var t = e.target;
  if (keo.k === "doc" || keo.k === "mo") {
    var di = t.closest('.di[data-k="doc"]');
    if (di) {
      var r = di.getBoundingClientRect(), duoi = e.clientY > r.top + r.height / 2;
      return { el: di, kieu: duoi ? "duoi" : "tren", s: +di.dataset.s, g: +di.dataset.g, i: +di.dataset.i + (duoi ? 1 : 0) };
    }
    var gh = t.closest(".grp-h[data-k=grp]") || (t.closest(".grp") && $(".grp-h", t.closest(".grp")));
    if (gh) return { el: gh, kieu: "vao", s: +gh.dataset.s, g: +gh.dataset.g, i: S.nav[+gh.dataset.s].groups[+gh.dataset.g].items.length };
    return null;
  }
  if (keo.k === "grp") {
    var g = t.closest(".grp-h[data-k=grp]");
    if (g) {
      var r2 = g.getBoundingClientRect(), d2 = e.clientY > r2.top + r2.height / 2;
      return { el: g, kieu: d2 ? "duoi" : "tren", s: +g.dataset.s, g: +g.dataset.g + (d2 ? 1 : 0) };
    }
    var sh = t.closest(".sec-h");
    if (sh) return { el: sh, kieu: "vao", s: +sh.dataset.s, g: S.nav[+sh.dataset.s].groups.length };
    return null;
  }
  if (keo.k === "sec") {
    var s = t.closest(".sec-h");
    if (!s) return null;
    var r3 = s.getBoundingClientRect(), d3 = e.clientY > r3.top + r3.height / 2;
    return { el: s, kieu: d3 ? "duoi" : "tren", s: +s.dataset.s + (d3 ? 1 : 0) };
  }
  return null;
}
function quaKeo(e) {
  var d = dichTha(e);
  xoaDauTha();
  if (!d) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  d.el.classList.add("tha-" + d.kieu);
}
function tha(e) {
  var d = dichTha(e);
  xoaDauTha();
  $("#tree").classList.remove("dang-keo");
  if (!d || !keo) return;
  e.preventDefault();
  var k = keo; keo = null;
  if (k.k === "doc" || k.k === "mo") {
    var dich = S.nav[d.s].groups[d.g].items, i = d.i, id;
    if (k.k === "doc") {
      var nguon = S.nav[k.s].groups[k.g].items;
      id = nguon[k.i];
      if (nguon === dich && (i === k.i || i === k.i + 1)) return;      /* thả về đúng chỗ cũ */
      nguon.splice(k.i, 1);
      if (nguon === dich && k.i < i) i--;
    } else id = k.id;
    dich.splice(i, 0, id);
  } else if (k.k === "grp") {
    var nhomNguon = S.nav[k.s].groups, nhomDich = S.nav[d.s].groups, j = d.g;
    if (nhomNguon === nhomDich && (j === k.g || j === k.g + 1)) return;
    var grp = nhomNguon.splice(k.g, 1)[0];
    if (nhomNguon === nhomDich && k.g < j) j--;
    nhomDich.splice(j, 0, grp);
  } else if (k.k === "sec") {
    var to = d.s;
    if (to === k.s || to === k.s + 1) return;
    var sec = S.nav.splice(k.s, 1)[0];
    if (k.s < to) to--;
    S.nav.splice(to, 0, sec);
  }
  doiCay();
}

QL.cay = { ve: ve, veCay: veCay, luu: luu, doiCay: doiCay };
})();
