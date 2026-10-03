/* ==========================================================================
   MÔ-ĐUN BẢN ĐỒ KIẾN THỨC — các bài và liên kết giữa chúng, tô theo tiến độ.

   ★ NGUỒN THẬT: courses/engine/mo-ban-do.js (engine/sync.py chép).

   Trang #/~ban-do. Nút = bài (màu theo chương, ĐẶC là đã học, rỗng là chưa);
   đường liền = bài này dẫn link sang bài kia (GET /courses/<khoá>/graph — máy
   chủ đọc markdown của mọi bài, giữ theo phiên bản khoá); đường đứt = bài kế
   tiếp trong cùng một phần. Bố cục là mô phỏng lực (lò xo giữa bài có liên kết,
   đẩy nhau giữa mọi bài, kéo nhẹ về cụm của phần) — tất định, cùng khoá thì cùng
   hình. Di chuột soi láng giềng; bấm để xem chi tiết; chọn "Từ" và "Đến" để
   tìm ĐƯỜNG NGẮN NHẤT (BFS) — học theo thứ tự nào để đi từ bài này tới bài kia.
   Kéo để dời, lăn chuột để phóng to.
   ========================================================================== */
(function () {
  "use strict";
  var K = window.KhoaHoc;
  if (!K || K.nguon().kieu !== "api") return;

  var NS = "http://www.w3.org/2000/svg";
  var W = 1000, H = 680;
  var MAU = ["#0e7490", "#b45309", "#7c3aed", "#15803d", "#be123c", "#1d4ed8"];   /* theo chương, đúng thứ tự */

  K.themBieuTuong("ban-do", '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="8" r="2.5"/><circle cx="9" cy="18" r="2.5"/>' +
    '<path d="M8.4 6.4 15.5 7.6M6.8 8.4l1.5 7.2M16.6 10l-5.8 6.3"/>');
  K.themNut({ ma: "btnBanDo", icon: "ban-do", title: "Bản đồ kiến thức", khi: function () { location.hash = "#/~ban-do"; } });
  K.themLoiTat({ ten: "Bản đồ kiến thức", icon: "ban-do", href: "#/~ban-do" });

  var doThi = null;               /* {ids, nut: {id: {x,y,...}}, canh: [[a,b,loai]]} — dựng một lần mỗi lần mở trang */

  function taiCanh() {
    var ng = K.nguon();
    return fetch(ng.moTa + "/graph", { credentials: "same-origin", headers: ng.dauRequest || {} })
      .then(function (r) { return r.ok ? r.json() : { edges: [] }; }, function () { return { edges: [] }; });
  }

  function dung(canhLienKet) {
    var ids = K.thuTu().slice(), docs = K.docs(), co = {}, nut = {}, canh = [], chuong = [], nhom = [];
    ids.forEach(function (id) { co[id] = 1; });
    ((K.manifest() || {}).nav || []).forEach(function (s, si) {
      chuong.push({ ten: s.title, mau: si < MAU.length ? MAU[si] : "#64748b" });
      (s.groups || []).forEach(function (g) {
        var it = (g.items || []).filter(function (id) { return co[id]; });
        if (!it.length) return;
        var gi = nhom.length;
        nhom.push({ ten: g.title, chuong: si, ids: it });
        it.forEach(function (id, k) {
          nut[id] = nut[id] || { id: id, nhom: gi, chuong: si, bac: 0 };
          if (k) canh.push([it[k - 1], id, "tiep"]);
        });
      });
    });
    ids.forEach(function (id) { if (!nut[id]) nut[id] = { id: id, nhom: -1, chuong: -1, bac: 0 }; });
    var daCo = {};
    canh.forEach(function (c) { daCo[c[0] + "\u0001" + c[1]] = 1; });
    (canhLienKet || []).forEach(function (e) {
      if (!nut[e[0]] || !nut[e[1]] || e[0] === e[1]) return;
      canh.push([e[0], e[1], "lien-ket"]);
    });
    canh.forEach(function (c) { nut[c[0]].bac++; nut[c[1]].bac++; });

    /* --- bố cục: phần xếp trên một vòng, bài quanh tâm phần, rồi mô phỏng lực --- */
    var G = nhom.length || 1, R = Math.min(W, H) * 0.36, tam = [];
    nhom.forEach(function (g, i) {
      var a = -Math.PI / 2 + i * 2 * Math.PI / G;
      tam.push([W / 2 + R * Math.cos(a), H / 2 + R * Math.sin(a)]);
      g.ids.forEach(function (id, k) {
        var b = k * 2.399963;                          /* góc vàng: rải đều không trùng */
        var r = 10 + 7 * Math.sqrt(k);
        nut[id].x = tam[i][0] + r * Math.cos(b);
        nut[id].y = tam[i][1] + r * Math.sin(b);
      });
    });
    var ds = ids.map(function (id) { return nut[id]; }), n = ds.length;
    ds.forEach(function (p, i) {
      if (p.x === undefined) { p.x = W / 2 + 40 * Math.cos(i); p.y = H / 2 + 40 * Math.sin(i); }
    });
    var kc = Math.sqrt(W * H / Math.max(1, n)) * 0.85, nhiet = W / 10;
    for (var buoc = 0; buoc < 240; buoc++) {
      var dx = new Float64Array(n), dy = new Float64Array(n), i, j;
      for (i = 0; i < n; i++) {
        for (j = i + 1; j < n; j++) {
          var ex = ds[i].x - ds[j].x, ey = ds[i].y - ds[j].y, d2 = ex * ex + ey * ey + 0.01, d = Math.sqrt(d2);
          var f = kc * kc / d;                              /* đẩy nhau */
          dx[i] += ex / d * f; dy[i] += ey / d * f; dx[j] -= ex / d * f; dy[j] -= ey / d * f;
        }
      }
      var chiSo = {};
      ds.forEach(function (p, k) { chiSo[p.id] = k; });
      canh.forEach(function (c) {
        var a = chiSo[c[0]], b = chiSo[c[1]];
        var ex = ds[a].x - ds[b].x, ey = ds[a].y - ds[b].y, d = Math.sqrt(ex * ex + ey * ey) + 0.01;
        var f = d * d / kc * (c[2] === "tiep" ? 0.5 : 0.12);   /* lò xo — liên kết chéo nhẹ, kẻo khoá dày liên kết co cục */
        dx[a] -= ex / d * f; dy[a] -= ey / d * f; dx[b] += ex / d * f; dy[b] += ey / d * f;
      });
      for (i = 0; i < n; i++) {
        var p = ds[i];
        if (p.nhom >= 0) { dx[i] += (tam[p.nhom][0] - p.x) * 0.18; dy[i] += (tam[p.nhom][1] - p.y) * 0.18; }   /* về cụm */
        var dd = Math.sqrt(dx[i] * dx[i] + dy[i] * dy[i]) || 1, buocDi = Math.min(dd, nhiet);
        p.x += dx[i] / dd * buocDi;       /* không kẹp vào khung: kẹp thì nút dồn thành hàng dọc mép; */
        p.y += dy[i] / dd * buocDi;       /* bước co giãn cuối đưa mọi nút vào khung */
      }
      nhiet *= 0.975;
    }
    /* co giãn cho vừa khung — mô phỏng không biết khung rộng bao nhiêu */
    var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    ds.forEach(function (p) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); });
    var tl = Math.min((W - 80) / Math.max(1, x1 - x0), (H - 80) / Math.max(1, y1 - y0));
    ds.forEach(function (p) {
      p.x = W / 2 + (p.x - (x0 + x1) / 2) * tl;
      p.y = H / 2 + (p.y - (y0 + y1) / 2) * tl;
    });
    return { ids: ids, nut: nut, canh: canh, chuong: chuong, nhom: nhom, docs: docs };
  }

  /* Đường ngắn nhất (theo số bước) giữa hai bài, đi theo cả liên kết lẫn "bài kế". */
  function duongNganNhat(dt, tu, den) {
    var ke = {};
    dt.canh.forEach(function (c) {
      (ke[c[0]] = ke[c[0]] || []).push(c[1]);
      (ke[c[1]] = ke[c[1]] || []).push(c[0]);
    });
    var truoc = {}, hang = [tu];
    truoc[tu] = null;
    while (hang.length) {
      var x = hang.shift();
      if (x === den) break;
      (ke[x] || []).forEach(function (y) { if (!(y in truoc)) { truoc[y] = x; hang.push(y); } });
    }
    if (!(den in truoc)) return null;
    var d = [];
    for (var v = den; v !== null; v = truoc[v]) d.unshift(v);
    return d;
  }

  function el(ten, thuocTinh) {
    var e = document.createElementNS(NS, ten);
    Object.keys(thuocTinh || {}).forEach(function (k) { e.setAttribute(k, thuocTinh[k]); });
    return e;
  }

  function veTrang(main) {
    document.title = "Bản đồ kiến thức — " + (((K.manifest() || {}).course || {}).title || "");
    main.innerHTML = '<div class="page"><article class="doc bd-trang">' +
      '<div class="crumb"><a href="#/">Trang chủ</a>' + K.icon("chev") + "<span>Bản đồ kiến thức</span></div>" +
      '<div class="prose prose-head"><h1>Bản đồ kiến thức</h1></div>' +
      '<div class="bd-cong-cu"><label>Từ <select id="bdTu"></select></label><label>Đến <select id="bdDen"></select></label>' +
        '<button type="button" class="btn btn-s" id="bdTim">Tìm đường ngắn nhất</button>' +
        '<label class="bd-chk"><input type="checkbox" id="bdTiep" checked> Hiện "bài kế tiếp"</label>' +
        '<span class="bd-zoom"><button type="button" class="ic-btn" data-z="1.25" aria-label="Phóng to">+</button>' +
        '<button type="button" class="ic-btn" data-z="0.8" aria-label="Thu nhỏ">−</button>' +
        '<button type="button" class="ic-btn" data-z="0" aria-label="Về toàn cảnh">⟲</button></span></div>' +
      '<div class="bd-khung"><div class="bd-ve" id="bdVe"><p class="ot-trong">Đang dựng bản đồ…</p></div>' +
        '<aside class="bd-ben" id="bdBen"></aside></div>' +
      '<div class="bd-chu" id="bdChu"></div></article></div>';
    window.scrollTo(0, 0);
    taiCanh().then(function (g) {
      if (!document.getElementById("bdVe")) return;          /* đã rời trang */
      doThi = dung(g.edges);
      veBanDo(doThi, g.edges && g.edges.length);
    });
  }

  function veBanDo(dt, coLienKet) {
    var hop = document.getElementById("bdVe"), ben = document.getElementById("bdBen");
    var last = (K.LS.get("last", null) || {}).id;
    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, class: "bd-svg", role: "img", "aria-label": "Bản đồ các bài và liên kết" });
    var nen = el("rect", { x: 0, y: 0, width: W, height: H, class: "bd-nen" });
    var the = el("g", {}), gCanh = el("g", {}), gNut = el("g", {});
    svg.appendChild(nen); svg.appendChild(the); the.appendChild(gCanh); the.appendChild(gNut);
    var duongCanh = [];
    dt.canh.forEach(function (c) {
      var a = dt.nut[c[0]], b = dt.nut[c[1]];
      var l = el("line", { x1: a.x.toFixed(1), y1: a.y.toFixed(1), x2: b.x.toFixed(1), y2: b.y.toFixed(1),
                           class: c[2] === "tiep" ? "bd-tiep" : "bd-lk" });
      l._c = c;
      gCanh.appendChild(l);
      duongCanh.push(l);
    });
    var nutEl = {};
    /* nhãn cho 12 bài nhiều liên kết nhất — ghi hết thì chữ đè chữ; bài khác: rê chuột */
    var coNhan = {};
    dt.ids.slice().sort(function (a, b) { return dt.nut[b].bac - dt.nut[a].bac; }).slice(0, 12)
      .forEach(function (id) { coNhan[id] = 1; });
    dt.ids.forEach(function (id) {
      var p = dt.nut[id], d = dt.docs[id] || {}, mau = p.chuong >= 0 ? dt.chuong[p.chuong].mau : "#64748b";
      var a = el("a", { href: "#/" + (d.slug || ""), class: "bd-nut" + (K.daXong(id) ? " xong" : "") + (id === last ? " dang" : "") });
      a.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", "#/" + (d.slug || ""));
      var r = Math.min(13, 5 + Math.sqrt(p.bac) * 1.6);
      a.appendChild(el("circle", { cx: p.x.toFixed(1), cy: p.y.toFixed(1), r: r.toFixed(1), style: "--m:" + mau }));
      var t = el("title", {});
      t.textContent = d.title || id;
      a.appendChild(t);
      if (coNhan[id]) {
        var nhan = el("text", { x: p.x.toFixed(1), y: (p.y + r + 11).toFixed(1), class: "bd-nhan" });
        nhan.textContent = String(d.title || id).replace(/^Bài\s*\d+\s*[★*]*\s*[—–-]\s*/i, "").slice(0, 26);
        a.appendChild(nhan);
      }
      a._id = id;
      gNut.appendChild(a);
      nutEl[id] = a;
    });
    hop.innerHTML = "";
    hop.appendChild(svg);

    /* chọn điểm đầu / cuối */
    var opt = dt.ids.map(function (id) {
      return '<option value="' + K.esc(id) + '">' + K.esc((dt.docs[id] || {}).title || id) + "</option>";
    }).join("");
    var selTu = document.getElementById("bdTu"), selDen = document.getElementById("bdDen");
    selTu.innerHTML = opt; selDen.innerHTML = opt;
    selTu.value = last && dt.nut[last] ? last : dt.ids[0];
    selDen.value = dt.ids[dt.ids.length - 1];

    /* chú thích */
    var xong = dt.ids.filter(function (id) { return K.daXong(id); }).length;
    document.getElementById("bdChu").innerHTML = dt.chuong.map(function (c) {
      return '<span><i style="background:' + c.mau + '"></i>' + K.esc(c.ten) + "</span>";
    }).join("") + "<span>● đặc = đã học (" + xong + "/" + dt.ids.length + ") · ○ rỗng = chưa</span>" +
      "<span>— liền = liên kết trong bài · ┄ đứt = bài kế tiếp</span>" +
      (coLienKet ? "" : "<span>Khoá này chưa có liên kết chéo giữa các bài — bản đồ chỉ theo thứ tự.</span>");

    /* soi láng giềng khi di chuột */
    var ke = {};
    dt.canh.forEach(function (c) { (ke[c[0]] = ke[c[0]] || {})[c[1]] = 1; (ke[c[1]] = ke[c[1]] || {})[c[0]] = 1; });
    gNut.addEventListener("mouseover", function (e) {
      var a = e.target.closest(".bd-nut");
      if (!a) return;
      svg.classList.add("soi");
      Object.keys(nutEl).forEach(function (id) { nutEl[id].classList.toggle("gan", id === a._id || !!(ke[a._id] || {})[id]); });
      duongCanh.forEach(function (l) { l.classList.toggle("gan", l._c[0] === a._id || l._c[1] === a._id); });
    });
    gNut.addEventListener("mouseout", function () { svg.classList.remove("soi"); });

    /* bấm một bài: thông tin bên cạnh (không mở ngay — bấm "Mở bài" hoặc bấm đúp) */
    function veBen(id) {
      var d = dt.docs[id] || {}, p = dt.nut[id], vao = [], ra = [];
      dt.canh.forEach(function (c) {
        if (c[2] !== "lien-ket") return;
        if (c[1] === id) vao.push(c[0]);
        if (c[0] === id) ra.push(c[1]);
      });
      function ds(x) {
        return x.length ? "<ul>" + x.map(function (k) {
          return '<li><a href="#/' + K.esc((dt.docs[k] || {}).slug || "") + '">' + K.esc((dt.docs[k] || {}).title || k) + "</a></li>";
        }).join("") + "</ul>" : '<p class="ot-trong">—</p>';
      }
      ben.innerHTML = "<b>" + K.esc(d.title || id) + "</b>" +
        '<p class="ot-trong">' + (p.nhom >= 0 ? K.esc(dt.nhom[p.nhom].ten) + " · " : "") + (K.daXong(id) ? "✓ đã học" : "chưa học") + "</p>" +
        '<div class="bd-ben-nut"><a class="btn btn-p" href="#/' + K.esc(d.slug || "") + '">Mở bài</a>' +
        '<button type="button" class="btn btn-s" data-dat="tu">Làm điểm đầu</button>' +
        '<button type="button" class="btn btn-s" data-dat="den">Làm điểm cuối</button></div>' +
        "<h3>Dẫn tới bài này</h3>" + ds(vao) + "<h3>Bài này dẫn tới</h3>" + ds(ra);
      ben.onclick = function (e) {
        var b = e.target.closest("[data-dat]");
        if (!b) return;
        (b.getAttribute("data-dat") === "tu" ? selTu : selDen).value = id;
      };
    }
    gNut.addEventListener("click", function (e) {
      var a = e.target.closest(".bd-nut");
      if (!a || e.detail > 1) return;              /* bấm đúp: để trình duyệt mở link */
      e.preventDefault();
      Object.keys(nutEl).forEach(function (id) { nutEl[id].classList.toggle("chon", id === a._id); });
      veBen(a._id);
    });
    gNut.addEventListener("dblclick", function (e) {
      var a = e.target.closest(".bd-nut");
      if (a) location.hash = "#/" + ((dt.docs[a._id] || {}).slug || "");
    });
    ben.innerHTML = '<p class="ot-trong">Bấm một bài để xem nó nối với bài nào; bấm đúp để mở. Chọn <b>Từ</b> và <b>Đến</b> ' +
      "ở trên rồi tìm đường ngắn nhất.</p>";

    /* đường ngắn nhất */
    document.getElementById("bdTim").onclick = function () {
      var d = duongNganNhat(dt, selTu.value, selDen.value);
      Object.keys(nutEl).forEach(function (id) { nutEl[id].classList.remove("duong"); });
      duongCanh.forEach(function (l) { l.classList.remove("duong"); });
      if (!d) { ben.innerHTML = '<p class="ot-trong">Không có đường nối hai bài này.</p>'; return; }
      var tren = {};
      for (var i = 1; i < d.length; i++) tren[d[i - 1] + "\u0001" + d[i]] = tren[d[i] + "\u0001" + d[i - 1]] = 1;
      d.forEach(function (id) { nutEl[id].classList.add("duong"); });
      duongCanh.forEach(function (l) { if (tren[l._c[0] + "\u0001" + l._c[1]]) l.classList.add("duong"); });
      ben.innerHTML = "<b>Đường ngắn nhất: " + (d.length - 1) + " bước</b><ol>" + d.map(function (id) {
        var x = dt.docs[id] || {};
        return '<li class="' + (K.daXong(id) ? "xong" : "") + '"><a href="#/' + K.esc(x.slug || "") + '">' + K.esc(x.title || id) +
          "</a>" + (K.daXong(id) ? " ✓" : "") + "</li>";
      }).join("") + "</ol>";
    };
    document.getElementById("bdTiep").onchange = function (e) { svg.classList.toggle("an-tiep", !e.target.checked); };

    /* dời + phóng to */
    var tl = 1, tx = 0, ty = 0;
    function ap() { the.setAttribute("transform", "translate(" + tx.toFixed(1) + " " + ty.toFixed(1) + ") scale(" + tl.toFixed(3) + ")"); }
    function phong(k, cx, cy) {
      var moi = Math.max(0.5, Math.min(5, tl * k));
      tx = cx - (cx - tx) * moi / tl; ty = cy - (cy - ty) * moi / tl; tl = moi;
      ap();
    }
    function toaDo(e) {
      var r = svg.getBoundingClientRect();
      return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height];
    }
    svg.addEventListener("wheel", function (e) {
      e.preventDefault();
      var p = toaDo(e);
      phong(e.deltaY < 0 ? 1.15 : 1 / 1.15, p[0], p[1]);
    }, { passive: false });
    var keo = null;
    svg.addEventListener("pointerdown", function (e) {
      if (e.target.closest(".bd-nut")) return;
      keo = { p: toaDo(e), tx: tx, ty: ty };
      svg.setPointerCapture(e.pointerId);
    });
    svg.addEventListener("pointermove", function (e) {
      if (!keo) return;
      var p = toaDo(e);
      tx = keo.tx + p[0] - keo.p[0]; ty = keo.ty + p[1] - keo.p[1];
      ap();
    });
    svg.addEventListener("pointerup", function () { keo = null; });
    document.querySelector(".bd-zoom").onclick = function (e) {
      var b = e.target.closest("[data-z]");
      if (!b) return;
      var z = +b.getAttribute("data-z");
      if (!z) { tl = 1; tx = 0; ty = 0; ap(); } else phong(z, W / 2, H / 2);
    };
  }

  K.dangKyTrang("ban-do", veTrang);
})();
