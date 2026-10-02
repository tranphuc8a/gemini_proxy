/* ==========================================================================
   QUẢN LÝ KHOÁ HỌC — trình soạn bài.

   · Ba chế độ: Soạn | Chia đôi | Xem. Bản xem trước dựng bằng hien-thi.js —
     CÙNG bộ dựng với trang đọc (công thức, khối mã tô màu, mermaid, hộp chú ý,
     liên kết giữa các bài, ảnh tải lên khoá).
   · Thanh công cụ, Ctrl+S, dán / kéo ảnh vào là tải lên khoá và chèn sẵn.
   · Bản nháp tự lưu trên máy (mất mạng, đóng tab, hết phiên vẫn còn).
   · Lưu kèm If-Match: người khác vừa lưu thì hiện khác biệt và hỏi giữ bản nào.
   · Lịch sử từng bài (30 bản), nhân bản, đổi id (giữ tiến độ người học), xoá
     vào thùng rác — có báo bài nào đang link tới.
   ========================================================================== */
(function () {
"use strict";
var QL = window.QL, S = QL.S, $ = QL.$, $$ = QL.$$, esc = QL.esc;

var KIND = /^[a-z0-9][a-z0-9-]*$/;
var SLUG = /^[A-Za-z0-9][A-Za-z0-9._\/-]*$/;
var DOC_ID = /^[\p{L}\p{N}_][\p{L}\p{N}_.@+\/-]*$/u;
var cheDo = QL.LS.get("cheDo", "chia");          /* soan | chia | xem */

function docPath(id) { return QL.duongKhoa("/docs/" + QL.maHoaId(id)); }
function khoaNhap(id) { return "nhap@" + S.slug + "/" + id; }

/* ---------- mở một bài ------------------------------------------------ */
function moBai(id, o) {
  o = o || {};
  if (S.doc && S.doc.id === id) { danhDau(id, o.cuonToi); hienBai(); return Promise.resolve(true); }
  return QL.boQua(function (x) { return x.indexOf("bài") === 0; }).then(function (ok) {
    if (!ok) return false;
    return QL.api("GET", docPath(id)).then(function (d) {
      d._metaText = JSON.stringify(d.meta || {});
      S.doc = d; S.docDirty = false;
      danhDau(id, o.cuonToi !== false);
      ve();
      hienBai();
      QL.datURL();
      return true;
    }, function (e) { QL.baoLoi(e); return false; });
  });
}
function danhDau(id, cuon) {
  $$(".di").forEach(function (x) { x.classList.toggle("on", x.dataset.id === id); });
  if (cuon) {
    var row = $('.di[data-id="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
    if (row) row.scrollIntoView({ block: "nearest" });
  }
}
/* Màn nhỏ: cây và trình soạn là hai màn; mở bài là sang màn soạn. */
function hienBai() { var st = $("#st"); if (st) st.classList.toggle("mo-bai", !!S.doc); }

/* ---------- vẽ ------------------------------------------------------- */
function ve() {
  var host = $("#editor");
  if (!host) return;
  var d = S.doc;
  if (!d) {
    host.innerHTML = '<div class="empty">Bấm một bài trong cây để soạn. “＋ Bài” trên một nhóm để thêm bài mới; kéo-thả hoặc ↑ ↓ ⇄ để sắp xếp. ' +
      "Thay đổi cấu trúc có hiệu lực khi bấm <b>Lưu cấu trúc</b>; bài thì lưu riêng từng bài (<kbd>Ctrl</kbd>+<kbd>S</kbd>).</div>";
    return;
  }
  var kinds = {};
  Object.keys(S.manifest.docs).forEach(function (k) { kinds[S.manifest.docs[k].kind] = 1; });
  ["lesson", "intro", "ref", "exercise", "project"].forEach(function (k) { kinds[k] = 1; });
  host.innerHTML = '<div class="card soan">' +
    '<div class="soan-h"><button type="button" class="btn sm ve-cay" id="eVe">← Mục lục</button>' +
    '<b class="soan-t" id="eTen">' + esc(d.title || d.id) + '</b><span class="chip" id="eTT"></span>' +
    '<span class="sp"></span><button type="button" class="btn sm pri" id="eLuu" title="Lưu bài (Ctrl+S)">Lưu bài</button>' +
    '<button type="button" class="btn sm" id="eThem" aria-haspopup="menu" title="Thêm thao tác">⋯</button></div>' +
    '<div id="eBanner"></div>' +
    '<details class="tt"' + (QL.LS.get("moTT", false) ? " open" : "") + '><summary>Thuộc tính — id, tiêu đề, slug, loại, nhãn, meta</summary>' +
    '<label class="f">Id<span class="row"><input type="text" id="eId" class="mono" value="' + esc(d.id) + '" disabled style="flex:1">' +
    '<button type="button" class="btn sm" id="eDoiId">Đổi id…</button></span></label>' +
    '<div class="grid2"><label class="f">Tiêu đề (trống = lấy từ dòng # đầu)<input type="text" id="eTitle" value="' + esc(d.title) + '"></label>' +
    '<label class="f">Slug (đường dẫn trên trang)<input type="text" id="eSlug" class="mono" value="' + esc(d.slug) + '" placeholder="tự sinh từ id">' +
    '<span class="goi-y">Đổi slug: link cũ vẫn mở được bài.</span><span class="loi-f" id="eSlugLoi" hidden></span></label></div>' +
    '<div class="grid2"><label class="f">Loại<input type="text" id="eKind" class="mono" list="dsKind" value="' + esc(d.kind) + '">' +
    '<span class="loi-f" id="eKindLoi" hidden></span></label>' +
    '<label class="f">Nhãn (tag, tuỳ chọn)<input type="text" id="eTag" value="' + esc(d.tag || "") + '" placeholder="vd: ★ trọng tâm"></label></div>' +
    '<datalist id="dsKind">' + Object.keys(kinds).sort().map(function (k) { return '<option value="' + esc(k) + '">'; }).join("") + "</datalist>" +
    '<label class="f">Meta (JSON)<textarea id="eMeta" class="mono" rows="2" spellcheck="false">' + esc(d._metaText) + "</textarea>" +
    '<span class="loi-f" id="eMetaLoi" hidden></span></label></details>' +
    '<div class="cong-cu" role="toolbar" aria-label="Định dạng markdown">' +
    nutCC("dam", "<b>B</b>", "Đậm (Ctrl+B)") + nutCC("nghieng", "<i>I</i>", "Nghiêng (Ctrl+I)") + nutCC("h2", "H2", "Tiêu đề mục") +
    nutCC("h3", "H3", "Tiêu đề mục con") + '<span class="vach"></span>' + nutCC("lienKet", "🔗", "Liên kết tới bài khác") +
    nutCC("anh", "🖼", "Chèn ảnh (tải lên khoá)") + nutCC("ma", "&lt;/&gt;", "Khối mã") + nutCC("cong", "∑", "Công thức") +
    nutCC("hop", "📌", "Hộp chú ý") + nutCC("bang", "▦", "Bảng") +
    '<span class="sp"></span><span class="seg" role="group" aria-label="Chế độ xem">' +
    ["soan", "chia", "xem"].map(function (m) {
      return '<button type="button" class="btn xs' + (cheDo === m ? " on" : "") + '" data-che-do="' + m + '"' + (m === "xem" ? ' id="eXem"' : "") +
        ' aria-pressed="' + (cheDo === m) + '">' + { soan: "Soạn", chia: "Chia đôi", xem: "Xem" }[m] + "</button>";
    }).join("") + "</span></div>" +
    '<input type="file" id="eTep" accept="image/*" multiple hidden>' +
    '<div class="vung ' + cheDo + '" id="eVung"><textarea id="eMd" class="mono md" spellcheck="false" aria-label="Nội dung markdown">' +
    esc(d.md || "") + '</textarea><div class="prev" id="ePrev" aria-label="Xem trước"></div></div>' +
    '<div class="row muted small" id="eDem"></div></div>';

  trangThai();
  kiemNhap();
  if (cheDo !== "soan") vePrev();
  demTu();

  $("#eVe").addEventListener("click", function () { var st = $("#st"); if (st) st.classList.remove("mo-bai"); });
  $("#eLuu").addEventListener("click", function () { luu(); });
  $("#eThem").addEventListener("click", menuThem);
  $("#eDoiId").addEventListener("click", doiId);
  $("details.tt").addEventListener("toggle", function () { QL.LS.set("moTT", this.open); });
  ["eTitle", "eSlug", "eKind", "eTag", "eMeta"].forEach(function (id) { $("#" + id).addEventListener("input", suaThuocTinh); });
  var ta = $("#eMd");
  /* S.doc chứ không phải `d`: lưu xong S.doc là object MỚI mà ô soạn không vẽ lại —
     gõ tiếp phải vào bản mới, nếu không bản nháp / xem trước / đếm từ đứng yên. */
  ta.addEventListener("input", function () {
    if (!S.doc) return;
    S.doc.md = ta.value; daSua(); hen(vePrev, ta.value.length > 60000 ? 700 : 250); hen(demTu, 400, "dem");
  });
  ta.addEventListener("keydown", phimSoan);
  ta.addEventListener("paste", danAnh);
  ta.addEventListener("dragover", function (e) { if (coTep(e)) { e.preventDefault(); ta.classList.add("tha-tep"); } });
  ta.addEventListener("dragleave", function () { ta.classList.remove("tha-tep"); });
  ta.addEventListener("drop", thaAnh);
  ta.addEventListener("scroll", dongBoCuon);
  $$(".cong-cu [data-cc]").forEach(function (b) { b.addEventListener("click", function () { congCu(b.dataset.cc); }); });
  $$("[data-che-do]").forEach(function (b) {
    b.addEventListener("click", function () {
      cheDo = b.dataset.cheDo; QL.LS.set("cheDo", cheDo);
      $$("[data-che-do]").forEach(function (x) { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", x === b); });
      $("#eVung").className = "vung " + cheDo;
      if (cheDo !== "soan") vePrev();
    });
  });
  $("#eTep").addEventListener("change", function () { taiAnhVao(Array.prototype.slice.call(this.files)); this.value = ""; });
  $("#ePrev").addEventListener("click", bamTrongPrev);
}
function nutCC(id, nhan, title) {
  return '<button type="button" class="btn xs" data-cc="' + id + '" title="' + esc(title) + '" aria-label="' + esc(title) + '">' + nhan + "</button>";
}
function trangThai() {
  var t = $("#eTT"); if (!t || !S.doc) return;
  t.className = "chip " + (S.docDirty ? "wa" : "ok");
  t.textContent = S.docDirty ? "● chưa lưu" : "✓ đã lưu";
  var ten = $("#eTen"); if (ten) ten.textContent = (S.doc.title || S.doc.id);
}
function demTu() {
  var o = $("#eDem"); if (!o || !S.doc) return;
  var md = S.doc.md || "";
  var tu = (md.replace(/```[\s\S]*?```/g, "").match(/\S+/g) || []).length;
  o.textContent = tu.toLocaleString("vi-VN") + " từ · ~" + Math.max(1, Math.round(tu / 170)) + " phút đọc · " +
    QL.kichThuoc(new Blob([md]).size) + (S.doc.updatedAt ? " · lưu lần cuối " + QL.luc(S.doc.updatedAt) : "");
}
var hens = {};
function hen(fn, ms, ten) {
  ten = ten || fn.name || "x";
  clearTimeout(hens[ten]); hens[ten] = setTimeout(fn, ms);
}

/* ---------- sửa ------------------------------------------------------- */
function daSua() {
  if (!S.docDirty) { S.docDirty = true; trangThai(); }
  hen(luuNhap, 800, "nhap");
}
function suaThuocTinh() {
  var d = S.doc;
  d.title = $("#eTitle").value; d.slug = $("#eSlug").value; d.kind = $("#eKind").value; d.tag = $("#eTag").value;
  d._metaText = $("#eMeta").value;
  hopLe();
  daSua();
}
/* Kiểm tra tại chỗ, cạnh ô — không đợi server trả 400 rồi hiện toast. */
function hopLe() {
  var d = S.doc, tot = true;
  function loi(id, msg) { var el = $("#" + id); if (el) { el.textContent = msg || ""; el.hidden = !msg; } if (msg) tot = false; }
  loi("eSlugLoi", d.slug.trim() && !SLUG.test(d.slug.trim()) ? "Chỉ chữ không dấu, số và . _ - /" : "");
  loi("eKindLoi", d.kind.trim() && !KIND.test(d.kind.trim()) ? "Chữ thường không dấu, số và '-' (vd: lesson, ref)" : "");
  var meta = null;
  try { meta = JSON.parse(d._metaText || "{}"); } catch (e) { meta = null; }
  loi("eMetaLoi", !meta || typeof meta !== "object" || Array.isArray(meta) ? "Meta phải là một object JSON {…}" : "");
  return tot ? meta : null;
}

/* ---------- bản nháp trên máy ---------------------------------------- */
function luuNhap() {
  var d = S.doc; if (!d || !S.docDirty) return;
  QL.LS.set(khoaNhap(d.id), { md: d.md, title: d.title, slug: d.slug, kind: d.kind, tag: d.tag || "",
                               metaText: d._metaText, baseRev: d.rev, at: Date.now() });
}
function kiemNhap() {
  var d = S.doc, n = QL.LS.get(khoaNhap(d.id), null), b = $("#eBanner");
  if (!n || !b) return;
  var giong = n.md === d.md && n.title === d.title && n.slug === d.slug && n.kind === d.kind &&
              (n.tag || "") === (d.tag || "") && n.metaText === d._metaText;
  if (giong) { QL.LS.del(khoaNhap(d.id)); return; }
  var cu = n.baseRev !== d.rev;
  b.innerHTML = '<div class="banner' + (cu ? " wa" : "") + '"><span>Có bản nháp chưa lưu trên máy này (' + esc(QL.luc(Math.round(n.at / 1000))) + ")" +
    (cu ? " — bài trên server đã đổi từ lúc đó; xem khác biệt trước khi khôi phục." : ".") + '</span><span class="sp"></span>' +
    '<button type="button" class="btn sm" id="nKhac">Xem khác biệt</button>' +
    '<button type="button" class="btn sm pri" id="nKhoiPhuc">Khôi phục</button>' +
    '<button type="button" class="btn sm" id="nBo">Bỏ bản nháp</button></div>';
  $("#nKhoiPhuc").addEventListener("click", function () {
    var x = S.doc; if (!x || x.id !== d.id) return;
    x.md = n.md; x.title = n.title; x.slug = n.slug; x.kind = n.kind; x.tag = n.tag; x._metaText = n.metaText;
    S.docDirty = true; ve(); toast("Đã khôi phục bản nháp — kiểm tra rồi Lưu");
  });
  $("#nBo").addEventListener("click", function () { QL.LS.del(khoaNhap(d.id)); b.innerHTML = ""; });
  $("#nKhac").addEventListener("click", function () {
    khung("Bản nháp trên máy so với bài trên server", '<p class="muted small">Dòng <span class="d-xoa-m">đỏ</span> chỉ có trên server, ' +
      'dòng <span class="d-them-m">xanh</span> chỉ có trong bản nháp.</p>' + htmlKhac(d.md, n.md), []);
  });
}
var toast = QL.toast;

/* ---------- xem trước --------------------------------------------------- */
var blobAnh = {};
function urlTep(ten) { return S.api + QL.duongKhoa("/assets/" + encodeURIComponent(ten)); }
function taiAnhNhap(url) {
  if (blobAnh[url]) return Promise.resolve(blobAnh[url]);
  return fetch(url, { headers: { "X-Admin-Session": S.token } }).then(function (r) {
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.blob();
  }).then(function (b) { return (blobAnh[url] = URL.createObjectURL(b)); });
}
QL.quenAnh = function (ten) { var u = urlTep(ten); if (blobAnh[u]) { URL.revokeObjectURL(blobAnh[u]); delete blobAnh[u]; } };
function vePrev() {
  var host = $("#ePrev"); if (!host || !S.doc || cheDo === "soan" || !window.HienThi) return;
  var cuon = host.scrollTop;
  var node = HienThi.render(S.doc.md || "", {
    docId: S.doc.id, docs: S.manifest.docs,
    icon: function (n) { return n === "link" ? "#" : n === "ext" ? " ↗" : ""; },
    toast: QL.toast, assetUrl: urlTep, taiAnh: S.course.published ? null : taiAnhNhap
  });
  host.innerHTML = "";
  host.appendChild(node);
  host.scrollTop = cuon;
  HienThi.veMermaid(host);
}
/* Trong bản xem trước: link tới bài khác mở bài đó ở đây; neo "#muc" cuộn trong khung. */
function bamTrongPrev(e) {
  var a = e.target.closest("a"); if (!a) return;
  var bai = a.getAttribute("data-bai"), href = a.getAttribute("href") || "";
  if (bai) { e.preventDefault(); moBai(bai); return; }
  if (href.charAt(0) === "#") {
    e.preventDefault();
    var id = href.split("#").pop(), dich = id && $("#ePrev [id='" + id.replace(/'/g, "") + "']");
    if (dich) dich.scrollIntoView({ block: "start" });
  }
}
function dongBoCuon() {
  if (cheDo !== "chia") return;
  var ta = $("#eMd"), p = $("#ePrev");
  var tl = ta.scrollTop / Math.max(1, ta.scrollHeight - ta.clientHeight);
  p.scrollTop = tl * (p.scrollHeight - p.clientHeight);
}

/* ---------- thanh công cụ --------------------------------------------- */
function chen(truoc, sau, mau) {
  var ta = $("#eMd"), a = ta.selectionStart, b = ta.selectionEnd, chon = ta.value.slice(a, b) || mau || "";
  ta.setRangeText(truoc + chon + (sau || ""), a, b, "end");
  if (!ta.value.slice(a, b).length && mau) { ta.selectionStart = a + truoc.length; ta.selectionEnd = a + truoc.length + chon.length; }
  ta.focus();
  ta.dispatchEvent(new Event("input"));
}
function dauDong(tienTo) {
  var ta = $("#eMd"), a = ta.selectionStart, dau = ta.value.lastIndexOf("\n", a - 1) + 1;
  ta.setRangeText(tienTo, dau, dau, "end");
  ta.focus(); ta.dispatchEvent(new Event("input"));
}
function congCu(id) {
  if (id === "dam") chen("**", "**", "chữ đậm");
  else if (id === "nghieng") chen("*", "*", "chữ nghiêng");
  else if (id === "h2") dauDong("## ");
  else if (id === "h3") dauDong("### ");
  else if (id === "ma") chen("\n```python\n", "\n```\n", "print('xin chào')");
  else if (id === "cong") chen("$$", "$$", "\\frac{a}{b}");
  else if (id === "hop") chen("\n> 📌 ", "\n", "Điều cần nhớ");
  else if (id === "bang") chen("\n| Cột 1 | Cột 2 |\n|---|---|\n| ", " | |\n", "ô");
  else if (id === "anh") $("#eTep").click();
  else if (id === "lienKet") chonBaiLienKet();
}
function duongTuongDoi(tu, den) {
  var a = tu.split("/"); a.pop();
  var b = den.split("/"), ten = b.pop(), i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  var len = a.slice(i).map(function () { return ".."; });
  return len.concat(b.slice(i)).concat([ten]).join("/") || ten;
}
function chonBaiLienKet() {
  var ds = S.manifest.order.filter(function (id) { return id !== S.doc.id; });
  QL.hoi({
    tieuDe: "Liên kết tới bài khác",
    truong: [{ ten: "id", nhan: "Bài", kieu: "select", luaChon: ds.map(function (id) { return [id, S.manifest.docs[id].title + "  —  " + id]; }) },
             { ten: "chu", nhan: "Chữ hiển thị (trống = tiêu đề bài)" }],
    nut: "Chèn"
  }).then(function (v) {
    if (!v) return;
    var dich = S.manifest.docs[v.id];
    chen("[" + (v.chu.trim() || dich.title) + "](" + duongTuongDoi(S.doc.id, v.id) + ")", "", "");
  });
}
function phimSoan(e) {
  if ((e.ctrlKey || e.metaKey) && !e.altKey) {
    if (e.key === "b" || e.key === "B") { e.preventDefault(); congCu("dam"); }
    else if (e.key === "i" || e.key === "I") { e.preventDefault(); congCu("nghieng"); }
  } else if (e.key === "Tab" && !e.shiftKey && !e.ctrlKey) {
    /* Tab trong ô soạn là thụt lề, không phải nhảy ra khỏi ô (Esc rồi Tab để thoát). */
    if (this._thoat) { this._thoat = false; return; }
    e.preventDefault(); chen("  ", "", "");
  } else if (e.key === "Escape") { this._thoat = true; }
}

/* ---------- ảnh: chọn, dán, kéo vào ----------------------------------- */
function coTep(e) { return e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], "Files") >= 0; }
function danAnh(e) {
  var tep = Array.prototype.slice.call((e.clipboardData && e.clipboardData.files) || []).filter(function (f) { return /^image\//.test(f.type); });
  if (!tep.length) return;
  e.preventDefault();
  taiAnhVao(tep);
}
function thaAnh(e) {
  this.classList.remove("tha-tep");
  if (!coTep(e)) return;
  e.preventDefault();
  taiAnhVao(Array.prototype.slice.call(e.dataTransfer.files));
}
function taiAnhVao(tep) {
  if (!tep.length || !QL.tep) return;
  QL.tep.taiLen(tep).then(function (ds) {
    ds.forEach(function (a) { chen(a.markdown + "\n", "", ""); });
    if (ds.length) toast("Đã tải lên " + ds.length + " tệp và chèn vào bài");
  });
}

/* ---------- lưu -------------------------------------------------------- */
function luu(ghiDe) {
  var d = S.doc;
  if (!d) return Promise.resolve(false);
  var ta = $("#eMd"); if (ta) d.md = ta.value;
  var meta = hopLe();
  if (!meta) { var tt = $("details.tt"); if (tt) tt.open = true; QL.baoLoi("Sửa các ô báo lỗi trong “Thuộc tính” trước khi lưu"); return Promise.resolve(false); }
  var body = { md: d.md, meta: meta, kind: (d.kind || "").trim() || "lesson", tag: (d.tag || "").trim() || null };
  if ((d.title || "").trim()) body.title = d.title.trim();
  if ((d.slug || "").trim()) body.slug = d.slug.trim();
  var nut = $("#eLuu"); if (nut) nut.disabled = true;
  var daGui = body.md;
  return QL.api("PUT", docPath(d.id), body, { headers: ghiDe ? {} : { "If-Match": d.rev } }).then(function (saved) {
    saved._metaText = JSON.stringify(saved.meta || {});
    /* Gõ tiếp trong lúc đang lưu: phần gõ thêm vẫn là "chưa lưu", nhưng tính
       trên bản vừa lưu (rev mới) — không bị bản trả về ghi đè. */
    var dangGo = $("#eMd") && S.doc && S.doc.id === saved.id ? $("#eMd").value : daGui;
    if (dangGo !== daGui) { saved.md = dangGo; S.doc = saved; S.docDirty = true; luuNhap(); }
    else { S.doc = saved; S.docDirty = false; QL.LS.del(khoaNhap(saved.id)); }
    /* cập nhật tại chỗ: không vẽ lại ô soạn (giữ con trỏ, vị trí cuộn) */
    S.manifest.docs[saved.id] = Object.assign(S.manifest.docs[saved.id] || {}, {
      title: saved.title, slug: saved.slug, kind: saved.kind, tag: saved.tag, meta: saved.meta, words: saved.words, minutes: saved.minutes });
    trangThai(); demTu();
    var row = $('.di[data-id="' + (window.CSS && CSS.escape ? CSS.escape(saved.id) : saved.id) + '"] .t');
    if (row) row.textContent = saved.title;
    toast("Đã lưu bài");
    return true;
  }, function (e) {
    if (e.status === 409 && e.data && "current" in e.data) return xungDot(e.data.current);
    QL.baoLoi(e);
    return false;
  }).then(function (kq) { var n2 = $("#eLuu"); if (n2) n2.disabled = false; return kq; });
}
function xungDot(hienTai) {
  var d = S.doc;
  luuNhap();             /* bản của tôi luôn còn trên máy, dù chọn gì */
  if (!hienTai) {
    return QL.hoi({
      tieuDe: "Bài này vừa bị xoá hoặc đổi id ở nơi khác",
      moTa: "<p>Bản của bạn vẫn được giữ làm nháp trên máy này. Lưu lại sẽ tạo lại bài với id <code>" + esc(d.id) + "</code>.</p>",
      nut: "Tạo lại bài với bản của tôi"
    }).then(function (v) { return v ? luu(true) : false; });
  }
  return QL.hoi({
    tieuDe: "Bài vừa được lưu ở nơi khác",
    rong: true,
    moTa: "<p>Người khác (hoặc tab khác) đã lưu bài này sau khi bạn mở. Bản của bạn vẫn giữ làm nháp trên máy.</p>" +
      '<p class="muted small">Dòng <span class="d-xoa-m">đỏ</span> chỉ có trên server, dòng <span class="d-them-m">xanh</span> chỉ có trong bản của bạn.</p>' +
      htmlKhac(hienTai.md || "", d.md || ""),
    nut: false, huy: "Để tôi xem lại",
    lua: [{ nhan: "Dùng bản trên server", giaTri: "server" }, { nhan: "Ghi đè bằng bản của tôi", giaTri: "ghi", kieu: "ba" }]
  }).then(function (v) {
    if (!v) return false;
    if (v.chon === "ghi") return luu(true);
    hienTai._metaText = JSON.stringify(hienTai.meta || {});
    S.doc = hienTai; S.docDirty = false; ve();
    toast("Đã tải bản trên server — bản của bạn còn trong “Có bản nháp chưa lưu”");
    return false;
  });
}

/* ---------- thao tác thêm (⋯) ----------------------------------------- */
function menuThem() {
  var neo = $("#eThem");
  var cu = $(".menu-noi"); if (cu) { cu.remove(); return; }
  var m = document.createElement("div");
  m.className = "menu-noi"; m.setAttribute("role", "menu");
  var trang = "../khoa-hoc/?khoa=" + encodeURIComponent(S.slug) + (S.course.published ? "" : "&nhap=1") + "#/" + encodeURIComponent(S.doc.slug).replace(/%2F/g, "/");
  m.innerHTML = '<a role="menuitem" href="' + esc(trang) + '" target="_blank" rel="noopener">Mở bài trên trang đọc ↗</a>' +
    '<button type="button" role="menuitem" data-m="lichSu">Lịch sử bài…</button>' +
    '<button type="button" role="menuitem" data-m="nhanBan">Nhân bản bài…</button>' +
    '<button type="button" role="menuitem" data-m="doiId">Đổi id…</button>' +
    '<button type="button" role="menuitem" data-m="xoa" class="ra">Xoá bài…</button>';
  document.body.appendChild(m);
  var r = neo.getBoundingClientRect();
  m.style.top = (r.bottom + 4) + "px";
  m.style.left = Math.max(8, Math.min(r.right - m.offsetWidth, innerWidth - m.offsetWidth - 8)) + "px";
  function dong() { document.removeEventListener("mousedown", ngoai, true); document.removeEventListener("keydown", phim, true); m.remove(); }
  function ngoai(e) { if (!m.contains(e.target) && e.target !== neo) dong(); }
  function phim(e) { if (e.key === "Escape") { dong(); neo.focus(); } }
  document.addEventListener("mousedown", ngoai, true);
  document.addEventListener("keydown", phim, true);
  m.addEventListener("click", function (e) {
    var b = e.target.closest("[data-m]"); if (!b) { if (e.target.closest("a")) dong(); return; }
    dong();
    ({ lichSu: lichSu, nhanBan: nhanBan, doiId: doiId, xoa: xoa })[b.dataset.m]();
  });
  var dau = $("[role=menuitem]", m); if (dau) dau.focus();
}
/* Thao tác làm đổi cây trong database: cây đang sửa phải được lưu trước. */
function canCayDaLuu() {
  if (!S.dirty) return Promise.resolve(true);
  return QL.xacNhan("Lưu cấu trúc trước?", "<p>Thao tác này làm mới mục lục từ database, nên cây đang sửa phải được lưu trước.</p>",
                    { nut: "Lưu cấu trúc rồi tiếp tục" }).then(function (ok) { return ok && QL.cay.luu(); });
}
function nhanBan() {
  var d = S.doc;
  canCayDaLuu().then(function (ok) {
    if (!ok) return;
    var goc = d.id.replace(/\.md$/i, "");
    var id = goc + "-ban-sao.md", n = 2;
    while (S.manifest.docs[id]) id = goc + "-ban-sao-" + (n++) + ".md";
    return QL.hoi({
      tieuDe: "Nhân bản “" + (d.title || d.id) + "”",
      truong: [{ ten: "id", nhan: "Id bài mới", giaTri: id, batBuoc: true, mono: true, mau: DOC_ID, loiMau: "Chữ, số và . _ @ + - /" },
               { ten: "title", nhan: "Tiêu đề", giaTri: (d.title || "") + " (bản sao)", batBuoc: true }],
      kiem: function (v) { return S.manifest.docs[v.id.trim()] ? "Đã có bài mang id này" : ""; },
      nut: "Nhân bản"
    }).then(function (v) {
      if (!v) return;
      var meta = hopLe() || {};
      var body = { md: $("#eMd") ? $("#eMd").value : d.md, title: v.title.trim(), kind: d.kind || "lesson", tag: d.tag || null, meta: meta };
      if (d.section && d.group) { body.section = d.section; body.group = d.group; }
      return QL.api("PUT", docPath(v.id.trim()), body, { headers: { "If-None-Match": "*" } }).then(function () {
        toast("Đã nhân bản bài");
        S.docDirty = false;
        return QL.chonKhoa(S.slug, { epBuoc: true, tab: "tree", doc: v.id.trim() });
      }, QL.baoLoi);
    });
  });
}
function doiId() {
  var d = S.doc;
  Promise.resolve(S.docDirty ? QL.xacNhan("Lưu bài trước?", "<p>Bài còn thay đổi chưa lưu.</p>", { nut: "Lưu rồi đổi id" })
    .then(function (ok) { return ok && luu(); }) : true).then(function (ok) {
    if (!ok) return;
    return canCayDaLuu();
  }).then(function (ok) {
    if (!ok) return;
    return QL.hoi({
      tieuDe: "Đổi id “" + d.id + "”",
      moTa: "<p>Id là đường dẫn của bài trong khoá. Đổi id thì <b>tiến độ, đánh dấu, ghi chú</b> của người học, lịch sử bài và link " +
        "cũ (theo slug) vẫn đi theo — chỉ các link dạng đường dẫn tệp trong bài khác cần sửa (xem tab Kiểm tra liên kết).</p>",
      truong: [{ ten: "id", nhan: "Id mới", giaTri: d.id, batBuoc: true, mono: true, mau: DOC_ID, loiMau: "Chữ, số và . _ @ + - /" }],
      kiem: function (v) { var x = v.id.trim(); return x === d.id ? "Id mới trùng id cũ" : S.manifest.docs[x] ? "Đã có bài mang id này" : ""; },
      nut: "Đổi id"
    }).then(function (v) {
      if (!v) return;
      return QL.api("POST", QL.duongKhoa("/rename"), { from: d.id, to: v.id.trim() }).then(function (moi) {
        QL.LS.del(khoaNhap(d.id));
        toast("Đã đổi id thành " + moi.id);
        S.doc = null;
        return QL.chonKhoa(S.slug, { epBuoc: true, tab: "tree", doc: moi.id });
      }, QL.baoLoi);
    });
  });
}
function xoa() {
  var d = S.doc;
  QL.api("GET", QL.duongKhoa("/links")).then(function (r) { return (r.inbound || {})[d.id] || []; }, function () { return []; })
    .then(function (vao) {
      return QL.xacNhan("Xoá bài “" + (d.title || d.id) + "”?",
        "<p>Bài vào <b>thùng rác</b> (giữ 30 ngày, khôi phục về đúng nhóm cũ).</p>" +
        (vao.length ? '<div class="banner wa"><span><b>' + vao.length + " bài đang link tới bài này</b> — link sẽ hỏng:<br>" +
          vao.slice(0, 8).map(function (id) { return "· " + esc((S.manifest.docs[id] || {}).title || id); }).join("<br>") +
          (vao.length > 8 ? "<br>· …" : "") + "</span></div>" : '<p class="muted small">Không bài nào khác link tới bài này.</p>'),
        { nut: "Xoá — vào thùng rác", nguyHiem: true });
    }).then(function (ok) {
      if (!ok) return;
      return QL.api("DELETE", docPath(d.id)).then(function () {
        QL.LS.del(khoaNhap(d.id));
        toast("Đã chuyển bài vào thùng rác");
        S.nav.forEach(function (s) { s.groups.forEach(function (g) { g.items = g.items.filter(function (i) { return i !== d.id; }); }); });
        delete S.manifest.docs[d.id];
        S.manifest.order = S.manifest.order.filter(function (i) { return i !== d.id; });
        S.doc = null; S.docDirty = false;
        if (!S.dirty) return QL.chonKhoa(S.slug, { epBuoc: true, tab: "tree" });
        QL.cay.veCay(); ve(); QL.datURL();
      }, QL.baoLoi);
    });
}

/* ---------- lịch sử ---------------------------------------------------- */
function lichSu() {
  var d = S.doc;
  QL.api("GET", QL.duongKhoa("/history?doc=" + encodeURIComponent(d.id))).then(function (r) {
    var ds = r.revisions || [];
    var k = khung("Lịch sử “" + (d.title || d.id) + "”",
      (ds.length ? '<div class="ls"><ul class="ls-ds">' + ds.map(function (x, i) {
        return '<li><button type="button" class="ls-i' + (i === 0 ? " on" : "") + '" data-rev="' + x.id + '"><b>' + esc(QL.luc(x.savedAt)) +
          "</b><span>" + (x.action === "xoa" ? "bản trước khi xoá" : "bản trước một lần lưu") + " · " + x.words + " từ</span></button></li>";
      }).join("") + '</ul><div class="ls-xem" id="lsXem"><div class="boot">Đang tải…</div></div></div>' :
        '<p class="muted">Bài chưa có bản cũ nào — mỗi lần lưu, bản bị thay sẽ được giữ ở đây (30 bản gần nhất).</p>'),
      ds.length ? [{ nhan: "Đưa bản này vào trình soạn", id: "lsDua", kieu: "pri" }] : []);
    if (!ds.length) return;
    var chon = null;
    function xem(revId) {
      $$(".ls-i", k.lop).forEach(function (b) { b.classList.toggle("on", +b.dataset.rev === revId); });
      $("#lsXem").innerHTML = '<div class="boot">Đang tải…</div>';
      QL.api("GET", QL.duongKhoa("/history/" + revId)).then(function (rev) {
        chon = rev;
        $("#lsXem").innerHTML = '<p class="muted small">So với nội dung đang soạn: dòng <span class="d-xoa-m">đỏ</span> chỉ có trong bản đang soạn, ' +
          'dòng <span class="d-them-m">xanh</span> chỉ có trong bản cũ.</p>' + htmlKhac(S.doc.md || "", rev.md || "");
      }, QL.baoLoi);
    }
    $(".ls-ds", k.lop).addEventListener("click", function (e) { var b = e.target.closest(".ls-i"); if (b) xem(+b.dataset.rev); });
    $("#lsDua").addEventListener("click", function () {
      if (!chon) return;
      var dd = S.doc;
      dd.md = chon.md; dd.title = chon.title || dd.title; dd.kind = chon.kind || dd.kind; dd.tag = chon.tag;
      dd._metaText = JSON.stringify(chon.meta || {});
      S.docDirty = true;
      k.dong(); ve(); luuNhap();
      toast("Đã đưa bản cũ vào trình soạn — bấm Lưu để giữ");
    });
    xem(ds[0].id);
  }, QL.baoLoi);
}

/* Khung lớn tự dựng (lịch sử, khác biệt) — cùng kiểu với hộp thoại. */
function khung(tieuDe, noiDung, nut) {
  var lop = document.createElement("div");
  lop.className = "dlg-lop";
  lop.innerHTML = '<div class="dlg rong" role="dialog" aria-modal="true" aria-label="' + esc(tieuDe) + '"><h2>' + esc(tieuDe) + "</h2>" +
    '<div class="dlg-than">' + noiDung + '</div><div class="dlg-nut"><span class="sp"></span>' +
    (nut || []).map(function (n) { return '<button type="button" class="btn ' + (n.kieu || "") + '" id="' + n.id + '">' + esc(n.nhan) + "</button>"; }).join("") +
    '<button type="button" class="btn" data-dong>Đóng</button></div></div>';
  document.body.appendChild(lop);
  function dong() { document.removeEventListener("keydown", phim, true); lop.remove(); }
  function phim(e) { if (e.key === "Escape") { e.preventDefault(); dong(); } }
  document.addEventListener("keydown", phim, true);
  $("[data-dong]", lop).addEventListener("click", dong);
  lop.addEventListener("mousedown", function (e) { if (e.target === lop) dong(); });
  setTimeout(function () { var b = $("[data-dong]", lop); if (b) b.focus(); }, 20);
  return { lop: lop, dong: dong };
}
QL.khung = khung;

/* ---------- khác biệt theo dòng (Myers) -------------------------------- */
function diffDong(a, b) {
  var dau = 0, cuoi = 0;
  while (dau < a.length && dau < b.length && a[dau] === b[dau]) dau++;
  while (cuoi < a.length - dau && cuoi < b.length - dau && a[a.length - 1 - cuoi] === b[b.length - 1 - cuoi]) cuoi++;
  var A = a.slice(dau, a.length - cuoi), B = b.slice(dau, b.length - cuoi);
  var giua = myers(A, B);
  if (!giua) return null;
  var out = [];
  a.slice(0, dau).forEach(function (s) { out.push(["=", s]); });
  out = out.concat(giua);
  a.slice(a.length - cuoi).forEach(function (s) { out.push(["=", s]); });
  return out;
}
function myers(a, b) {
  var n = a.length, m = b.length, max = n + m;
  if (!max) return [];
  if (max > 20000) return null;
  var off = max + 1, v = new Int32Array(2 * max + 3), trace = [];
  for (var d = 0; d <= max; d++) {
    if (d > 2500) return null;
    trace.push(v.slice());
    for (var k = -d; k <= d; k += 2) {
      var x = (k === -d || (k !== d && v[off + k - 1] < v[off + k + 1])) ? v[off + k + 1] : v[off + k - 1] + 1;
      var y = x - k;
      while (x < n && y < m && a[x] === b[y]) { x++; y++; }
      v[off + k] = x;
      if (x >= n && y >= m) return lui(trace, a, b, d, off);
    }
  }
  return null;
}
function lui(trace, a, b, dMax, off) {
  var x = a.length, y = b.length, out = [];
  for (var d = dMax; d > 0; d--) {
    var v = trace[d], k = x - y;
    var kTruoc = (k === -d || (k !== d && v[off + k - 1] < v[off + k + 1])) ? k + 1 : k - 1;
    var xTruoc = v[off + kTruoc], yTruoc = xTruoc - kTruoc;
    while (x > xTruoc && y > yTruoc) { out.push(["=", a[x - 1]]); x--; y--; }
    if (x === xTruoc) out.push(["+", b[y - 1]]); else out.push(["-", a[x - 1]]);
    x = xTruoc; y = yTruoc;
  }
  while (x > 0 && y > 0) { out.push(["=", a[x - 1]]); x--; y--; }
  return out.reverse();
}
/* a = "trước"/server, b = "sau"/của tôi: "-" chỉ có ở a, "+" chỉ có ở b. */
function htmlKhac(a, b) {
  if (a === b) return '<p class="muted">Hai bản giống hệt nhau.</p>';
  var ops = diffDong(String(a).split("\n"), String(b).split("\n"));
  if (!ops) return '<p class="muted">Hai bản khác nhau quá nhiều để so từng dòng.</p>';
  var them = 0, xoa = 0, html = [], giu = [];
  function xaGiu() {
    if (giu.length > 6) {
      giu.slice(0, 3).forEach(function (s) { html.push('<div class="d-giu">' + esc(s) + "</div>"); });
      html.push('<div class="d-an">… ' + (giu.length - 6) + " dòng giống nhau …</div>");
      giu.slice(-3).forEach(function (s) { html.push('<div class="d-giu">' + esc(s) + "</div>"); });
    } else giu.forEach(function (s) { html.push('<div class="d-giu">' + esc(s) + "</div>"); });
    giu = [];
  }
  ops.forEach(function (o) {
    if (o[0] === "=") { giu.push(o[1]); return; }
    xaGiu();
    if (o[0] === "+") them++; else xoa++;
    html.push('<div class="' + (o[0] === "+" ? "d-them" : "d-xoa") + '">' + esc(o[1] || " ") + "</div>");
  });
  xaGiu();
  return '<p class="small"><b class="d-them-m">+' + them + "</b> dòng · <b class=\"d-xoa-m\">−" + xoa + '</b> dòng</p><div class="khac">' + html.join("") + "</div>";
}
QL.htmlKhac = htmlKhac;

QL.soan = { moBai: moBai, ve: ve, luu: luu, vePrev: vePrev };
})();
