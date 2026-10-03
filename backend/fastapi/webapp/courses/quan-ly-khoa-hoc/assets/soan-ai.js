/* ==========================================================================
   QUẢN LÝ KHOÁ HỌC — "✨ Soạn bằng AI": từ chủ đề / tài liệu tới một khoá NHÁP.

   1. Nguồn: chủ đề, và tuỳ chọn văn bản dán vào, URL trang web (hoặc PDF) công
      khai, tệp PDF ≤ 3 MB → POST /ai/draft/outline → dàn ý.
   2. Dàn ý sửa được: tên khoá, slug, mô tả; đổi tên phần / bài, bỏ chọn bài.
   3. Soạn từng bài (POST /ai/draft/lesson, hai bài một lúc; bài lỗi bấm soạn lại)
      → ghép thành bundle → POST /courses/import?slug=… với published: false.
      Khoá mở ra để đọc lại, sửa, rồi mới xuất bản.
   Dàn ý và các bài đã soạn được cất trên máy này: tải lại trang không mất những
   gì đã tốn lượt AI. Tệp PDF không được cất (lớn) — chọn lại nếu cần lập lại dàn ý.
   ========================================================================== */
(function () {
"use strict";
var QL = window.QL, S = QL.S, $ = QL.$, $$ = QL.$$, esc = QL.esc;
var PDF_MAX = 3 * 1024 * 1024;           /* thân request của Vercel tối đa 4,5 MB (base64 nở thêm 1/3) */
var CUNG_LUC = 2;
var TU_RIENG = ["admin", "import", "export", "search", "trash"];
var TRINH_DO = [["co-ban", "Cơ bản — người mới bắt đầu"], ["trung-cap", "Trung cấp — đã có nền tảng"],
                ["nang-cao", "Nâng cao — muốn đi sâu"]];

function moi() {
  return { buoc: "nguon", vao: { topic: "", text: "", url: "", level: "co-ban", lessons: 8, notes: "" },
           danY: null, nguon: null, khoa: null, bai: {} };
}
var D = QL.LS.get("soan-ai", null) || moi();
var pdf = null;                           /* {ten, b64} */
var dangSoan = false, dungSoan = false;
function cat() { QL.LS.set("soan-ai", D); }
function khoaBai(i, j) { return i + "." + j; }

QL.moSoanAI = function () {
  return QL.boQua().then(function (ok) {
    if (!ok) return;
    S.view = "soan-ai"; S.slug = null; S.course = null; S.doc = null; S.dirty = S.docDirty = S.infoDirty = false;
    QL.veDanhSach();
    document.body.classList.remove("ds-mo");
    $("#main").onclick = null;
    QL.datURL();
    ve();
  });
};
function ve() {
  if (S.view !== "soan-ai") return;
  if (D.buoc === "dan-y" && D.danY) veDanY(); else veNguon();
}

/* ---------------- 1. nguồn ---------------- */
function veNguon() {
  var v = D.vao;
  $("#main").innerHTML = '<div class="stack"><h1 style="margin:0">✨ Soạn khoá học bằng AI</h1>' +
    '<p class="muted small" style="margin:0">AI lập dàn ý từ chủ đề và tài liệu của bạn, rồi soạn từng bài. Khoá tạo ra là ' +
    "<b>bản nháp</b>: đọc lại, sửa, rồi mới xuất bản. Dàn ý tốn một lượt AI, mỗi bài một lượt (xem 🤖 AI).</p>" +
    '<form class="card stack sa-form" id="saNguon">' +
      '<label class="f">Chủ đề / mục tiêu khoá học<textarea name="topic" rows="3" maxlength="500" ' +
        'placeholder="VD: Docker cho lập trình viên backend — từ container đầu tiên tới compose và CI">' + esc(v.topic) + "</textarea></label>" +
      '<div class="grid2"><label class="f">Trình độ người học<select name="level">' + TRINH_DO.map(function (t) {
        return '<option value="' + t[0] + '"' + (t[0] === v.level ? " selected" : "") + ">" + esc(t[1]) + "</option>";
      }).join("") + "</select></label>" +
      '<label class="f">Số bài (2–24)<input type="number" name="lessons" min="2" max="24" value="' + (+v.lessons || 8) + '"></label></div>' +
      "<details" + (v.text || v.url || pdf ? " open" : "") + "><summary>Tài liệu nguồn (tuỳ chọn) — khoá học sẽ bám nội dung tài liệu</summary>" +
        '<div class="stack" style="margin-top:10px">' +
        '<label class="f">Dán văn bản<textarea name="text" rows="6" maxlength="200000">' + esc(v.text) + "</textarea>" +
          '<span class="goi-y">AI đọc tối đa ~60 000 ký tự đầu.</span></label>' +
        '<label class="f">URL trang web hoặc tệp PDF công khai<input type="text" name="url" maxlength="2000" placeholder="https://…" value="' +
          esc(v.url) + '"><span class="goi-y">Chỉ trang công khai trên Internet (máy chủ chặn địa chỉ nội bộ).</span></label>' +
        '<label class="f">Tệp PDF (≤ 3 MB)<input type="file" name="pdf" accept="application/pdf,.pdf">' +
          '<span class="goi-y" id="saPdf">' + (pdf ? "Đã chọn: " + esc(pdf.ten) : "PDF lớn hơn: đưa lên mạng rồi dán URL ở trên.") + "</span></label>" +
      "</div></details>" +
      '<label class="f">Yêu cầu thêm (tuỳ chọn)<textarea name="notes" rows="2" maxlength="2000" ' +
        'placeholder="VD: nhiều ví dụ Python; mỗi bài có một bài tập nhỏ">' + esc(v.notes) + "</textarea></label>" +
      '<div class="row"><button class="btn pri" type="submit" id="saLap">Lập dàn ý</button>' +
        (D.danY ? '<button class="btn" type="button" id="saMoDanY">Mở lại dàn ý đã có</button>' : "") +
        '<span class="loi-f" id="saLoi" role="alert"></span></div>' +
    "</form></div>";
  var f = $("#saNguon");
  f.pdf.addEventListener("change", function () {
    var tep = f.pdf.files && f.pdf.files[0];
    pdf = null;
    $("#saPdf").textContent = "Đang đọc tệp…";
    if (!tep) { $("#saPdf").textContent = ""; return; }
    if (tep.size > PDF_MAX) {
      f.pdf.value = "";
      $("#saPdf").textContent = "Tệp " + QL.kichThuoc(tep.size) + " — quá 3 MB. Đưa lên mạng rồi dán URL.";
      return;
    }
    var r = new FileReader();
    r.onload = function () {
      pdf = { ten: tep.name, b64: String(r.result).replace(/^data:[^,]*,/, "") };
      $("#saPdf").textContent = "Đã chọn: " + tep.name + " (" + QL.kichThuoc(tep.size) + ")";
    };
    r.onerror = function () { $("#saPdf").textContent = "Không đọc được tệp"; };
    r.readAsDataURL(tep);
  });
  if ($("#saMoDanY")) $("#saMoDanY").addEventListener("click", function () { D.buoc = "dan-y"; cat(); ve(); });
  f.addEventListener("submit", function (e) {
    e.preventDefault();
    D.vao = {
      topic: f.topic.value.trim(), text: f.text.value.trim(), url: f.url.value.trim(), level: f.level.value,
      lessons: Math.max(2, Math.min(24, parseInt(f.lessons.value, 10) || 8)), notes: f.notes.value.trim()
    };
    cat();
    var v = D.vao;
    if (!v.topic && !v.text && !v.url && !pdf) { $("#saLoi").textContent = "Cho biết chủ đề, hoặc đưa tài liệu nguồn."; return; }
    var nut = $("#saLap");
    nut.disabled = true;
    nut.textContent = "AI đang lập dàn ý…";
    $("#saLoi").textContent = "";
    QL.api("POST", "/ai/draft/outline", Object.assign({}, v, { pdf: pdf ? pdf.b64 : "" })).then(function (r) {
      var o = r.outline;
      o.parts.forEach(function (p) { p.lessons.forEach(function (l) { l.chon = true; }); });
      D.danY = o; D.nguon = r.source; D.buoc = "dan-y"; D.bai = {};
      D.khoa = { title: o.title, subtitle: o.subtitle, description: o.description, icon: o.icon, slug: QL.slugHoa(o.title) };
      cat();
      ve();
    }, function (err) {
      $("#saLoi").textContent = err.message;
      nut.disabled = false;
      nut.textContent = "Lập dàn ý";
    });
  });
}

/* ---------------- 2. dàn ý ---------------- */
function chonDs() {
  var ds = [];
  D.danY.parts.forEach(function (p, i) {
    p.lessons.forEach(function (l, j) { if (l.chon) ds.push({ i: i, j: j, p: p, l: l, k: khoaBai(i, j) }); });
  });
  return ds;
}
function kiemSlug(s) {
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(s || "")) return "Slug gồm 1–63 chữ thường không dấu, số hoặc '-'.";
  if (TU_RIENG.indexOf(s) >= 0) return "Slug này là từ dành riêng.";
  if (S.courses.some(function (c) { return c.slug === s; })) return "Đã có khoá dùng slug này — nhập vào sẽ THAY khoá đó. Đổi slug.";
  return "";
}
function trangThai(k) {
  var b = D.bai[k];
  if (!b) return '<span class="sa-tt"></span>';
  if (b.dang) return '<span class="sa-tt">⏳ đang soạn…</span>';
  if (b.md) return '<span class="sa-tt xong">✓ đã soạn · <button type="button" class="btn xs" data-xem="' + k + '">Xem</button></span>';
  return '<span class="sa-tt loi">✗ ' + esc(b.loi || "lỗi") + "</span>";
}
function nhanNut() {
  var ds = chonDs(), con = ds.filter(function (v) { return !(D.bai[v.k] && D.bai[v.k].md); }).length;
  return !ds.length ? "Chưa chọn bài nào" : con === 0 ? "Tạo khoá nháp (" + ds.length + " bài)" :
    con === ds.length ? "Soạn " + ds.length + " bài & tạo khoá nháp" : "Soạn nốt " + con + " bài & tạo khoá nháp";
}

function veDanY() {
  var k = D.khoa, ng = D.nguon || {};
  var nguon = [];
  if (ng.url) nguon.push("trang " + esc(ng.title || ng.url));
  if (ng.pdf) nguon.push("tệp PDF");
  if (ng.chars) nguon.push(Number(ng.chars).toLocaleString("vi-VN") + " ký tự văn bản" + (ng.cut ? " (đã cắt bớt)" : ""));
  $("#main").innerHTML = '<div class="stack rong"><h1 style="margin:0">✨ Dàn ý khoá học</h1>' +
    (nguon.length ? '<p class="banner" style="margin:0">Dựa trên: ' + nguon.join(", ") + "</p>" : "") +
    '<div class="card stack rong"><div class="grid2">' +
      '<label class="f">Tên khoá<input type="text" data-k="title" maxlength="120" value="' + esc(k.title) + '"></label>' +
      '<label class="f">Slug (địa chỉ của khoá)<input type="text" class="mono" data-k="slug" maxlength="63" value="' + esc(k.slug) + '">' +
        '<span class="loi-f" id="saSlugLoi">' + esc(kiemSlug(k.slug)) + "</span></label>" +
      '<label class="f">Phụ đề<input type="text" data-k="subtitle" maxlength="160" value="' + esc(k.subtitle) + '"></label>' +
      '<label class="f">Biểu tượng (emoji)<input type="text" data-k="icon" maxlength="8" value="' + esc(k.icon) + '"></label></div>' +
      '<label class="f">Mô tả<textarea data-k="description" rows="2" maxlength="600">' + esc(k.description) + "</textarea></label></div>" +
    D.danY.parts.map(function (p, i) {
      return '<div class="card sa-phan"><label class="f">Phần ' + (i + 1) + '<input type="text" data-p="' + i + '" maxlength="120" value="' +
        esc(p.title) + '"></label><ol class="sa-ds">' + p.lessons.map(function (l, j) {
          var key = khoaBai(i, j);
          return '<li class="sa-bai" data-bai="' + key + '"><input type="checkbox" data-c="' + key + '" aria-label="Soạn bài này"' +
            (l.chon ? " checked" : "") + '><div class="sa-bai-t"><input type="text" data-l="' + key + '" maxlength="160" value="' +
            esc(l.title) + '" aria-label="Tên bài"><span class="goi-y">' + esc(l.summary) +
            (l.points && l.points.length ? " — " + esc(l.points.join(" · ")) : "") + "</span>" +
            '<div class="sa-xem prose" hidden></div></div>' + trangThai(key) + "</li>";
        }).join("") + "</ol></div>";
    }).join("") +
    '<div class="bar"><button class="btn pri" type="button" id="saSoan">' + esc(nhanNut()) + "</button>" +
      '<button class="btn" type="button" id="saLai">Sửa nguồn / lập lại dàn ý</button>' +
      '<button class="btn" type="button" id="saBo">Bỏ bản nháp</button>' +
      '<span class="muted small" id="saTien" role="status"></span></div></div>';

  var m = $("#main");
  m.oninput = function (e) {
    var t = e.target;
    if (t.dataset.k) {
      D.khoa[t.dataset.k] = t.value;
      if (t.dataset.k === "title" && !D.khoa.slugTay) {
        D.khoa.slug = QL.slugHoa(t.value);
        $('[data-k="slug"]').value = D.khoa.slug;
      }
      if (t.dataset.k === "slug") D.khoa.slugTay = true;
      $("#saSlugLoi").textContent = kiemSlug(D.khoa.slug);
    } else if (t.dataset.p) {
      D.danY.parts[+t.dataset.p].title = t.value;
    } else if (t.dataset.l) {
      var ij = t.dataset.l.split(".");
      D.danY.parts[+ij[0]].lessons[+ij[1]].title = t.value;
    }
    cat();
  };
  m.onchange = function (e) {
    var c = e.target.dataset.c;
    if (!c) return;
    var ij = c.split(".");
    D.danY.parts[+ij[0]].lessons[+ij[1]].chon = e.target.checked;
    cat();
    $("#saSoan").textContent = nhanNut();
  };
  m.onclick = function (e) {
    var xem = e.target.closest("[data-xem]");
    if (!xem) return;
    var hop = $('[data-bai="' + xem.dataset.xem + '"] .sa-xem');
    if (!hop.hidden) { hop.hidden = true; return; }
    hop.innerHTML = "";
    hop.appendChild(window.HienThi ? HienThi.render(D.bai[xem.dataset.xem].md, {}) : document.createTextNode(D.bai[xem.dataset.xem].md));
    hop.hidden = false;
  };
  $("#saSoan").addEventListener("click", soan);
  $("#saLai").addEventListener("click", function () { D.buoc = "nguon"; cat(); ve(); });
  $("#saBo").addEventListener("click", function () {
    QL.xacNhan("Bỏ bản nháp này?", "Dàn ý và các bài AI đã soạn sẽ mất (không ảnh hưởng khoá nào đã tạo).", { nut: "Bỏ", nguyHiem: true })
      .then(function (ok) { if (!ok) return; D = moi(); pdf = null; QL.LS.del("soan-ai"); ve(); });
  });
}

/* ---------------- 3. soạn từng bài, rồi tạo khoá ---------------- */
function veTrangThai(k) {
  var li = $('[data-bai="' + k + '"]');
  if (!li) return;
  var cu = li.querySelector(".sa-tt"), tam = document.createElement("span");
  tam.innerHTML = trangThai(k);
  li.replaceChild(tam.firstChild, cu);
}

function soan() {
  if (dangSoan) return;
  var k = D.khoa;
  var loiSlug = kiemSlug(k.slug);
  if (loiSlug) { $("#saSlugLoi").textContent = loiSlug; $('[data-k="slug"]').focus(); return; }
  if (!String(k.title || "").trim()) { QL.toast("Khoá cần có tên", true); return; }
  var ds = chonDs();
  if (!ds.length) { QL.toast("Chưa chọn bài nào", true); return; }
  var danY = ds.map(function (v) { return v.l.title; });
  var con = ds.filter(function (v) { return !(D.bai[v.k] && D.bai[v.k].md); });
  var nut = $("#saSoan"), tien = $("#saTien");
  dangSoan = true; dungSoan = false;
  nut.disabled = true;
  var i = 0, dangChay = 0, xong = ds.length - con.length;
  function baoTien() { tien.textContent = "Đã soạn " + xong + "/" + ds.length + " bài"; }
  baoTien();
  new Promise(function (het) {
    function tiep() {
      if ((i >= con.length || dungSoan) && !dangChay) { het(); return; }
      while (dangChay < CUNG_LUC && i < con.length && !dungSoan) {
        (function (v) {
          dangChay++;
          D.bai[v.k] = { dang: true };
          veTrangThai(v.k);
          QL.api("POST", "/ai/draft/lesson", {
            course: { title: k.title.trim(), description: k.description || "" }, outline: danY, part: v.p.title,
            lesson: { title: v.l.title, summary: v.l.summary || "", points: v.l.points || [], notes: v.l.notes || "" },
            level: D.vao.level, notes: D.vao.notes || ""
          }).then(function (r) {
            D.bai[v.k] = { md: r.md };
            xong++;
          }, function (e) {
            D.bai[v.k] = { loi: e.message };
            if (e.status === 429 || e.status === 403 || e.status === 503) dungSoan = true;   /* hết lượt / tắt: dừng hẳn */
          }).then(function () {
            cat();
            dangChay--;
            veTrangThai(v.k);
            baoTien();
            tiep();
          });
        })(con[i++]);
      }
    }
    tiep();
  }).then(function () {
    dangSoan = false;
    nut.disabled = false;
    nut.textContent = nhanNut();
    var thieu = ds.filter(function (v) { return !(D.bai[v.k] && D.bai[v.k].md); });
    if (thieu.length) {
      tien.textContent = thieu.length + " bài chưa soạn được — bấm “" + nhanNut() + "” để thử lại, hoặc bỏ chọn các bài đó.";
      return;
    }
    return taoKhoa(ds);
  });
}

function taoKhoa(ds) {
  var k = D.khoa, tong = ds.length, docs = {}, groups = [], n = 0;
  D.danY.parts.forEach(function (p, i) {
    var items = [];
    p.lessons.forEach(function (l, j) {
      if (!l.chon) return;
      n++;
      var so = (n < 10 ? "0" : "") + n;
      var id = "p" + (i + 1) + "/bai-" + so + ".md";
      docs[id] = { id: id, slug: "bai/" + so + "-" + (QL.slugHoa(l.title).slice(0, 50).replace(/-+$/, "") || "bai"),
                   title: l.title, kind: "lesson", meta: { no: n, of: tong }, md: D.bai[khoaBai(i, j)].md };
      items.push(id);
    });
    if (items.length) groups.push({ title: p.title || "Phần " + (i + 1), short: "P" + (groups.length + 1), items: items });
  });
  var bundle = {
    course: { slug: k.slug, title: k.title.trim(), subtitle: k.subtitle || "", description: k.description || "",
              icon: k.icon || "📘", published: false },
    nav: [{ id: "bai-hoc", title: "Bài học", sub: tong + " bài · soạn bằng AI", icon: "book", groups: groups }],
    slugs: {}, order: [], docs: docs, stats: { lessons: tong }
  };
  $("#saTien").textContent = "Đang tạo khoá nháp…";
  return QL.api("POST", "/courses/import?slug=" + encodeURIComponent(k.slug), bundle).then(function (c) {
    D = moi(); pdf = null;
    QL.LS.del("soan-ai");
    QL.toast("Đã tạo khoá nháp “" + c.title + "” (" + tong + " bài) — đọc lại rồi xuất bản");
    return QL.taiDanhSach(c.slug);
  }, function (e) {
    $("#saTien").textContent = "";
    QL.baoLoi(e);
  });
}

$("#btnSoanAI").addEventListener("click", QL.moSoanAI);
})();
