/* charts.js — biểu đồ SVG tự vẽ, trả về CHUỖI (không đụng DOM nên kiểm được bằng node).

   Không dựa vào màu đơn thuần: mỗi cột/lát có <title> (tooltip + trình đọc màn hình),
   và nơi dùng biểu đồ luôn đặt kèm bảng số liệu. Màu cột lấy từ biến CSS (.b-a, .b-b)
   nên đổi sáng/tối không phải vẽ lại. */
(function (root) {
  "use strict";
  var QL = root.QL || (root.QL = {});

  function esc(s) { return QL.text.esc(s); }
  function num(v) { return typeof v === "number" && isFinite(v) ? v : 0; }
  function r1(v) { return Math.round(v * 10) / 10; }

  /** Cận trên của trục = 4 bước "đẹp" (1, 2, 2.5, 5, 10 × 10^k), nên 4 vạch lưới đều rơi vào số tròn. */
  function niceMax(v) {
    if (v <= 0) return 1;
    var q = v / 4, p = Math.pow(10, Math.floor(Math.log10(q))), f = q / p;
    var n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
    return n * p * 4;
  }

  function svgOpen(w, h, label) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + " " + h + '" role="img" aria-label="' + esc(label) + '" preserveAspectRatio="xMidYMid meet">';
  }

  /**
   * Cột theo nhóm. items: [{label, values:[a,b,…], tip?}]; series: [{cls}] cùng độ dài values.
   * Một chuỗi → cột đơn (biểu đồ chi theo ngày); hai chuỗi → thu/chi cạnh nhau (xu hướng tháng).
   */
  function bars(items, opt) {
    opt = opt || {};
    var W = opt.width || 640, H = opt.height || 200, L = 44, B = 24, T = 10, R = 6;
    var label = opt.label || "Biểu đồ cột";
    var fmt = opt.format || String;
    if (!items.length) return svgOpen(W, H, label) + '<text x="' + W / 2 + '" y="' + H / 2 + '" text-anchor="middle" class="c-empty">Chưa có dữ liệu</text></svg>';

    var k = (opt.series || [{ cls: "b-a" }]).length;
    var max = 0;
    items.forEach(function (it) { it.values.forEach(function (v) { max = Math.max(max, num(v)); }); });
    var top = niceMax(max), plotW = W - L - R, plotH = H - T - B;
    var slot = plotW / items.length, gap = Math.min(6, slot * 0.25), bw = Math.max(1, (slot - gap) / k);
    var out = [svgOpen(W, H, label)];

    for (var g = 0; g <= 4; g++) {        // lưới ngang + nhãn trục
      var gy = T + plotH - (plotH * g) / 4;
      out.push('<line class="c-grid" x1="' + L + '" y1="' + r1(gy) + '" x2="' + (W - R) + '" y2="' + r1(gy) + '"/>');
      out.push('<text class="c-axis" x="' + (L - 6) + '" y="' + r1(gy + 3) + '" text-anchor="end">' + esc(fmt((top * g) / 4)) + "</text>");
    }
    var every = Math.max(1, Math.ceil(items.length / (opt.maxLabels || 12)));
    items.forEach(function (it, i) {
      var x0 = L + slot * i + gap / 2;
      it.values.forEach(function (v, j) {
        var h = top ? (plotH * num(v)) / top : 0;
        var cls = (opt.series && opt.series[j] && opt.series[j].cls) || "b-a";
        out.push('<rect class="' + cls + '" x="' + r1(x0 + bw * j) + '" y="' + r1(T + plotH - h) + '" width="' + r1(Math.max(1, bw - 1)) +
          '" height="' + r1(h) + '" rx="2"><title>' + esc(it.tip || (it.label + ": " + fmt(num(v)))) + "</title></rect>");
      });
      if (i % every === 0) out.push('<text class="c-axis" x="' + r1(L + slot * i + slot / 2) + '" y="' + (H - 7) + '" text-anchor="middle">' + esc(it.label) + "</text>");
    });
    out.push("</svg>");
    return out.join("");
  }

  /**
   * Bánh vòng. slices: [{label, value, color}]. Vẽ bằng các vòng tròn có stroke-dasharray nên
   * một lát 100 % hay không có lát nào đều đúng, không phải xử lý riêng.
   */
  function donut(slices, opt) {
    opt = opt || {};
    var S = opt.size || 180, r = 60, C = 2 * Math.PI * r;
    var total = slices.reduce(function (a, s) { return a + Math.max(0, num(s.value)); }, 0);
    var out = [svgOpen(S, S, opt.label || "Biểu đồ vòng")];
    out.push('<g transform="translate(' + S / 2 + " " + S / 2 + ') rotate(-90)">');
    out.push('<circle class="c-ring" r="' + r + '" fill="none" stroke-width="26"/>');
    var acc = 0;
    if (total > 0) {
      slices.forEach(function (s) {
        var v = Math.max(0, num(s.value));
        if (!v) return;
        var len = (v / total) * C;
        out.push('<circle r="' + r + '" fill="none" stroke="' + esc(s.color || "#98a2ad") + '" stroke-width="26" stroke-dasharray="' + r1(len) + " " + r1(C - len) +
          '" stroke-dashoffset="' + r1(-acc) + '"><title>' + esc(s.label + ": " + (opt.format ? opt.format(v) : v) + " (" + r1((v * 100) / total) + "%)") + "</title></circle>");
        acc += len;
      });
    }
    out.push("</g>");
    if (opt.center) out.push('<text class="c-center" x="' + S / 2 + '" y="' + (S / 2 + 5) + '" text-anchor="middle">' + esc(opt.center) + "</text>");
    out.push("</svg>");
    return out.join("");
  }

  QL.charts = { bars: bars, donut: donut, niceMax: niceMax };
  if (typeof module !== "undefined" && module.exports) module.exports = QL.charts;
})(typeof globalThis !== "undefined" ? globalThis : this);
