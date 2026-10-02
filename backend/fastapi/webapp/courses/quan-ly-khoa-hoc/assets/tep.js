/* ==========================================================================
   QUẢN LÝ KHOÁ HỌC — tab "Tệp" (ảnh, PDF… tải lên khoá) và "Kiểm tra liên kết".

   Tệp nằm trong database cùng khoá (đi theo khi xuất / nhân bản / vào thùng
   rác). Trong bài viết `![](assets/ten.png)` — trang đọc và bản xem trước tự đổi
   thành địa chỉ thật. Tệp của khoá đang là nháp chỉ quản trị viên xem được.
   ========================================================================== */
(function () {
"use strict";
var QL = window.QL, S = QL.S, $ = QL.$, $$ = QL.$$, esc = QL.esc;

function urlTep(ten) { return S.api + QL.duongKhoa("/assets/" + encodeURIComponent(ten)); }
function tenSach(raw) {
  var i = raw.lastIndexOf("."), goc = i > 0 ? raw.slice(0, i) : raw, duoi = i > 0 ? raw.slice(i + 1) : "";
  return (QL.slugHoa(goc) || "tep") + (duoi ? "." + duoi.toLowerCase().replace(/[^a-z0-9]/g, "") : "");
}

/* Tải lên nhiều tệp (nút, kéo-thả, dán ảnh vào bài). → Promise<[asset]> các tệp đã lên. */
function taiLen(files) {
  var ds = Array.prototype.slice.call(files || []);
  if (!ds.length) return Promise.resolve([]);
  var xong = [], loi = [];
  QL.toast("Đang tải lên " + ds.length + " tệp…");
  return ds.reduce(function (p, f) {
    return p.then(function () {
      var ten = f.name && f.name !== "image.png" ? tenSach(f.name) :
        "anh-" + new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14) + "." + ((f.type.split("/")[1] || "png").replace("jpeg", "jpg"));
      return QL.api("PUT", QL.duongKhoa("/assets/" + encodeURIComponent(ten)), f).then(function (a) {
        QL.quenAnh && QL.quenAnh(a.name);
        xong.push(a);
      }, function (e) { loi.push(ten + ": " + e.message); });
    });
  }, Promise.resolve()).then(function () {
    if (loi.length) QL.baoLoi(loi.join(" · "));
    else if (xong.length) QL.toast("Đã tải lên " + xong.length + " tệp");
    return xong;
  });
}

/* ---------- tab Tệp --------------------------------------------------- */
function veTep(host) {
  host.innerHTML = '<div class="stack rong">' +
    '<div class="tha-vung" id="thaTep" tabindex="0" role="button" aria-label="Chọn hoặc kéo tệp vào để tải lên">' +
    "<b>Kéo tệp vào đây</b> hoặc <u>bấm để chọn</u> — ảnh (png, jpg, gif, webp, svg, avif), pdf, txt, csv, json, zip, mp3, mp4, py, ipynb; " +
    'tối đa 3 MB một tệp. Trong bài, dán ảnh thẳng vào ô soạn cũng được.<input type="file" id="chonTep" multiple hidden></div>' +
    '<div id="dsTep"><div class="boot">Đang tải danh sách tệp…</div></div></div>';
  var vung = $("#thaTep"), chon = $("#chonTep");
  vung.addEventListener("click", function () { chon.click(); });
  vung.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); chon.click(); } });
  vung.addEventListener("dragover", function (e) { e.preventDefault(); vung.classList.add("on"); });
  vung.addEventListener("dragleave", function () { vung.classList.remove("on"); });
  vung.addEventListener("drop", function (e) {
    e.preventDefault(); vung.classList.remove("on");
    taiLen(e.dataTransfer.files).then(function () { taiDs(); });
  });
  chon.addEventListener("change", function () { taiLen(chon.files).then(function () { chon.value = ""; taiDs(); }); });
  taiDs();
}
function taiDs() {
  return QL.api("GET", QL.duongKhoa("/assets")).then(function (r) {
    var ds = r.assets || [], box = $("#dsTep");
    if (!box) return;
    if (!ds.length) { box.innerHTML = '<p class="muted">Khoá chưa có tệp nào.</p>'; return; }
    box.innerHTML = '<ul class="tep-ds">' + ds.map(function (a) {
      var dung = a.usedBy.length ? "dùng trong " + a.usedBy.length + " bài" : "chưa bài nào dùng";
      return '<li data-ten="' + esc(a.name) + '"><span class="tep-xem">' + (a.image ? '<img alt="" data-anh="' + esc(a.name) + '">' : "📄") + "</span>" +
        '<span class="ci-t"><b>' + esc(a.name) + '</b><span class="ci-m">' + QL.kichThuoc(a.size) + " · " + esc(QL.luc(a.createdAt)) + " · " +
        '<span title="' + esc(a.usedBy.map(function (id) { return (S.manifest.docs[id] || {}).title || id; }).join("\n")) + '">' + dung + "</span></span>" +
        '<code class="tep-md">' + esc(a.markdown) + "</code></span>" +
        '<span class="ctl-tep"><button type="button" class="btn sm" data-chep="' + esc(a.markdown) + '">Chép markdown</button>' +
        '<a class="btn sm" href="' + esc(urlTep(a.name)) + '" target="_blank" rel="noopener">Mở ↗</a>' +
        '<button type="button" class="btn sm ba" data-xoa="' + esc(a.name) + '" data-dung="' + a.usedBy.length + '">Xoá</button></span></li>';
    }).join("") + "</ul>";
    /* ảnh của khoá nháp cần token: tải bằng fetch rồi gắn blob */
    $$("img[data-anh]", box).forEach(function (img) {
      var u = urlTep(img.dataset.anh);
      if (S.course.published) { img.src = u; return; }
      fetch(u, { headers: { "X-Admin-Session": S.token } }).then(function (x) { return x.ok ? x.blob() : null; })
        .then(function (b) { if (b) img.src = URL.createObjectURL(b); });
    });
    box.onclick = function (e) {
      var b = e.target.closest("button"); if (!b) return;
      if (b.dataset.chep) {
        (navigator.clipboard ? navigator.clipboard.writeText(b.dataset.chep) : Promise.reject()).then(
          function () { QL.toast("Đã chép: " + b.dataset.chep); }, function () { QL.toast(b.dataset.chep); });
      } else if (b.dataset.xoa) {
        var ten = b.dataset.xoa, n = +b.dataset.dung;
        QL.xacNhan("Xoá tệp “" + ten + "”?", n ? '<p class="err">' + n + " bài đang dùng tệp này — ảnh / link trong các bài đó sẽ hỏng.</p>" :
                   "<p>Không bài nào dùng tệp này.</p>", { nut: "Xoá tệp", nguyHiem: true }).then(function (ok) {
          if (!ok) return;
          QL.api("DELETE", QL.duongKhoa("/assets/" + encodeURIComponent(ten))).then(function () {
            QL.quenAnh && QL.quenAnh(ten); QL.toast("Đã xoá " + ten); taiDs();
          }, QL.baoLoi);
        });
      }
    };
  }, QL.baoLoi);
}

/* ---------- tab Kiểm tra liên kết ---------------------------------------- */
function veLienKet(host) {
  host.innerHTML = '<div class="stack rong"><div class="row"><button type="button" class="btn pri" id="bKiemLk">Kiểm tra lại</button>' +
    '<span class="muted small">Link giữa các bài (đường dẫn .md, <code>#/slug</code>) và tệp <code>assets/…</code>. ' +
    "Link ra ngoài (http…) và tệp mã nguồn không được tính.</span></div><div id=\"kqLk\"></div></div>";
  $("#bKiemLk").addEventListener("click", kiem);
  kiem();
}
function kiem() {
  var box = $("#kqLk");
  box.innerHTML = '<div class="boot">Đang đọc mọi bài…</div>';
  QL.api("GET", QL.duongKhoa("/links")).then(function (r) {
    var hong = r.broken || [];
    var theoBai = {};
    hong.forEach(function (h) { (theoBai[h.from] = theoBai[h.from] || []).push(h); });
    box.innerHTML = '<p class="' + (hong.length ? "err" : "ok-tx") + '"><b>' + (hong.length ? hong.length + " liên kết hỏng" : "Không có liên kết hỏng") +
      "</b> — đã xét " + r.checked + " liên kết trong " + r.docCount + " bài.</p>" +
      (hong.length ? '<ul class="lk-ds">' + Object.keys(theoBai).map(function (id) {
        return '<li><button type="button" class="hit" data-id="' + esc(id) + '"><b>' + esc(theoBai[id][0].fromTitle) + '</b><span class="ci-m">' + esc(id) +
          "</span>" + theoBai[id].map(function (h) {
            return '<span class="lk-h">dòng ' + h.line + ": <code>" + esc(h.href) + "</code> — " + esc(h.reason) + "</span>";
          }).join("") + "</button></li>";
      }).join("") + "</ul>" : "");
    box.onclick = function (e) {
      var b = e.target.closest(".hit[data-id]"); if (!b) return;
      var dong = (theoBai[b.dataset.id] || [{}])[0].line;
      QL.doiTab("tree");
      QL.soan.moBai(b.dataset.id, { cuonToi: true }).then(function () { denDong(dong); });
    };
  }, function (e) { box.innerHTML = ""; QL.baoLoi(e); });
}
/* Đặt con trỏ ô soạn ở dòng có link hỏng. */
function denDong(n) {
  var ta = $("#eMd"); if (!ta || !n) return;
  var vt = 0, dong = ta.value.split("\n");
  for (var i = 0; i < n - 1 && i < dong.length; i++) vt += dong[i].length + 1;
  ta.focus();
  ta.setSelectionRange(vt, vt + (dong[n - 1] || "").length);
  ta.scrollTop = Math.max(0, (n - 5) * 20);
}

QL.tep = { veTep: veTep, veLienKet: veLienKet, taiLen: taiLen };
})();
