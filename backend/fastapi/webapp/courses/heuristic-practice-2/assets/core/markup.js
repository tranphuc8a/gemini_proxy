/* Mini-markdown cho nội dung bài thực hành → HTML an toàn.
   Mọi văn bản đều bị thoát HTML trước; chỉ những thẻ do chính bộ dựng này tạo ra mới xuất hiện.
   Hỗ trợ: đoạn, ## tiêu đề, danh sách (lồng được), bảng, > trích dẫn, ```mã```, `mã`, **đậm**, *nghiêng*, [chữ](liên kết).
   Công thức viết thẳng bằng Unicode (Σ ≤ ≥ √ ² x₁ …), không dùng TeX. */
(function (root) {
  "use strict";
  var TH = root.TH || (root.TH = {});
  var esc = (TH.tienIch || (typeof require !== "undefined" ? require("./tien-ich.js") : null)).esc;

  function lienKetHopLe(u) { return /^(https?:\/\/|#|\.{1,2}\/|\/|[\w.-]+\/|[\w.-]+\.html)/i.test(u) && !/^\s*javascript:/i.test(u); }

  function inline(s) {
    var ma = [];
    s = String(s).replace(/`([^`]+)`/g, function (m, c) { ma.push(c); return "\u0001" + (ma.length - 1) + "\u0001"; });
    s = esc(s);
    s = s.replace(/\*\*(\S(?:[^*]*?\S)?)\*\*/g, "<b>$1</b>");
    s = s.replace(/(^|[\s(])\*(\S(?:[^*]*?\S)?)\*(?=$|[\s).,;:!?])/g, "$1<i>$2</i>");
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, t, u) {
      u = u.replace(/&amp;/g, "&");
      if (!lienKetHopLe(u)) return t;
      var ngoai = /^https?:/i.test(u);
      return '<a href="' + esc(u) + '"' + (ngoai ? ' target="_blank" rel="noopener noreferrer"' : "") + ">" + t + "</a>";
    });
    s = s.replace(/\u0001(\d+)\u0001/g, function (m, i) { return "<code>" + esc(ma[+i]) + "</code>"; });
    return s;
  }

  var RE_LIST = /^(\s*)([-*]|\d+[.)])\s+(.*)$/;
  var RE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

  function tachO(dong) {
    dong = dong.trim().replace(/^\|/, "").replace(/\|$/, "");
    var o = [], cur = "";
    for (var i = 0; i < dong.length; i++) {
      if (dong[i] === "\\" && dong[i + 1] === "|") { cur += "|"; i++; }
      else if (dong[i] === "|") { o.push(cur.trim()); cur = ""; }
      else cur += dong[i];
    }
    o.push(cur.trim());
    return o;
  }

  function lopTrichDan(txt) {
    var t = txt.replace(/^\s+/, "");
    if (/^(⚠️|⚠)/.test(t)) return " cal-warn";
    if (/^(📌|⭐|💡|★)/.test(t)) return " cal-key";
    if (/^(✅|✔)/.test(t)) return " cal-ok";
    if (/^(❌|🚫)/.test(t)) return " cal-bad";
    if (/^(📖|🔗)/.test(t)) return " cal-ref";
    return "";
  }

  function khoi(dong, tomau) {
    var out = [], i = 0;
    function trong(k) { return !dong[k] || /^\s*$/.test(dong[k]); }
    while (i < dong.length) {
      var d = dong[i], m;
      if (trong(i)) { i++; continue; }

      if ((m = /^```\s*([\w+#-]*)\s*$/.exec(d))) {                       /* khối mã */
        var buf = []; i++;
        while (i < dong.length && !/^```\s*$/.test(dong[i])) buf.push(dong[i++]);
        i++;
        var code = buf.join("\n"), lang = m[1] || "";
        var html = tomau && lang ? tomau(code, lang) : esc(code);
        out.push('<pre class="ma"' + (lang ? ' data-ngon="' + esc(lang) + '"' : "") + "><code>" + html + "</code></pre>");
        continue;
      }
      if ((m = /^(#{1,4})\s+(.*)$/.exec(d))) {                           /* tiêu đề: # → h3 */
        var c = Math.min(m[1].length + 2, 6);
        out.push("<h" + c + ">" + inline(m[2]) + "</h" + c + ">"); i++; continue;
      }
      if (/^\s*-{3,}\s*$/.test(d)) { out.push("<hr>"); i++; continue; }
      if (/^\s*>/.test(d)) {                                             /* trích dẫn */
        var q = [];
        while (i < dong.length && /^\s*>/.test(dong[i])) q.push(dong[i++].replace(/^\s*> ?/, ""));
        out.push('<blockquote class="cal' + lopTrichDan(q.join(" ")) + '">' + khoi(q, tomau) + "</blockquote>");
        continue;
      }
      if (d.indexOf("|") >= 0 && i + 1 < dong.length && RE_SEP.test(dong[i + 1]) && dong[i + 1].indexOf("-") >= 0) {   /* bảng */
        var dau = tachO(d), can = tachO(dong[i + 1]).map(function (c2) {
          return /^:-+:$/.test(c2) ? "c" : /-+:$/.test(c2) ? "r" : "l";
        });
        i += 2;
        var hang = [];
        while (i < dong.length && !trong(i) && dong[i].indexOf("|") >= 0) hang.push(tachO(dong[i++]));
        var h = "<div class=\"tw\"><table><thead><tr>" + dau.map(function (x, k) {
          return '<th class="a-' + (can[k] || "l") + '">' + inline(x) + "</th>";
        }).join("") + "</tr></thead><tbody>" + hang.map(function (r) {
          return "<tr>" + dau.map(function (x, k) {
            return '<td class="a-' + (can[k] || "l") + '">' + inline(r[k] == null ? "" : r[k]) + "</td>";
          }).join("") + "</tr>";
        }).join("") + "</tbody></table></div>";
        out.push(h);
        continue;
      }
      if ((m = RE_LIST.exec(d))) {                                       /* danh sách */
        var thuTu = /\d/.test(m[2]), goc = m[1].length, muc = [];
        while (i < dong.length && !trong(i)) {
          var mm = RE_LIST.exec(dong[i]);
          if (mm && mm[1].length === goc && (/\d/.test(mm[2]) === thuTu)) { muc.push([mm[3]]); i++; }
          else if (mm && mm[1].length > goc && muc.length) { muc[muc.length - 1].push(dong[i].slice(goc)); i++; }
          else if (!mm && /^\s+\S/.test(dong[i]) && muc.length) { muc[muc.length - 1].push(dong[i].trim()); i++; }
          else break;
        }
        out.push((thuTu ? "<ol>" : "<ul>") + muc.map(function (ls) {
          var dau2 = ls[0], con = ls.slice(1), noiTiep = [], tuDo = [];
          con.forEach(function (x) { (RE_LIST.test(x) ? noiTiep : tuDo).push(x); });
          return "<li>" + inline([dau2].concat(tuDo).join(" ")) + (noiTiep.length ? khoi(noiTiep, tomau) : "") + "</li>";
        }).join("") + (thuTu ? "</ol>" : "</ul>"));
        continue;
      }
      var p = [];                                                        /* đoạn văn */
      while (i < dong.length && !trong(i) && !/^```/.test(dong[i]) && !/^(#{1,4})\s/.test(dong[i]) &&
             !/^\s*>/.test(dong[i]) && !RE_LIST.test(dong[i]) && !(dong[i].indexOf("|") >= 0 && i + 1 < dong.length && RE_SEP.test(dong[i + 1]) && p.length)) {
        p.push(dong[i++]);
      }
      if (!p.length) { p.push(dong[i++]); }
      out.push("<p>" + p.map(function (x, k) {
        var br = /( {2}|\\)$/.test(x) && k < p.length - 1;
        return inline(x.replace(/( {2}|\\)$/, "")) + (br ? "<br>" : (k < p.length - 1 ? " " : ""));
      }).join("") + "</p>");
    }
    return out.join("\n");
  }

  /* html(nguon, {tomau: fn(code, ngon) → html đã thoát}) */
  function html(nguon, tuyChon) {
    var tomau = tuyChon && tuyChon.tomau ? tuyChon.tomau : (TH.tomau ? TH.tomau.html : null);
    return khoi(String(nguon == null ? "" : nguon).replace(/\r\n?/g, "\n").split("\n"), tomau);
  }
  function dong(nguon) { return inline(nguon); }

  TH.markup = { html: html, dong: dong };
  if (typeof module !== "undefined" && module.exports) module.exports = TH.markup;
})(typeof globalThis !== "undefined" ? globalThis : this);
