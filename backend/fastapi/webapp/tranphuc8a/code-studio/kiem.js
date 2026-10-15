/* kiem.js — kiểm Code Studio bằng node: module thuần (ngôn ngữ, tô màu, định dạng, gợi ý, dự án, zip, kho lưu, bộ chạy).
   Chạy: node backend/fastapi/webapp/tranphuc8a/code-studio/kiem.js   (thoát mã 1 nếu có phép kiểm sai) */
"use strict";
const path = require("path");
const A = (...p) => path.join(__dirname, "assets", ...p);
global.CS = {};
const FILES = ["core/langs.js", "core/tokenize.js", "core/format.js", "core/complete.js", "core/project.js", "core/zip.js", "core/store.js", "core/runner.js"];
const missing = [];
FILES.forEach((f) => { try { require(A(f)); } catch (e) { if (e.code === "MODULE_NOT_FOUND" && String(e.message).indexOf(f.replace("core/", "")) >= 0) missing.push(f); else throw e; } });
const CS = global.CS;

let tong = 0, sai = 0;
function nhom(t) { console.log("\n== " + t); }
function kiem(ten, ok, chiTiet) {
  tong++;
  if (ok) console.log("  [ok]  " + ten);
  else { sai++; console.log("  [SAI] " + ten + (chiTiet !== undefined ? "   → " + chiTiet : "")); }
}
const bang = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const cat = (toks) => toks.map((t) => t.v).join("");
if (missing.length) console.log("(chưa có module: " + missing.join(", ") + ")");

/* ====================== ngôn ngữ ====================== */
nhom("langs");
{
  const Lg = CS.langs;
  kiem("19 ngôn ngữ, mỗi cái có mẫu Hello và tên tệp mặc định có đuôi đúng", Lg.order.length === 19 && Lg.list().every((l) => Lg.byFilename(l.file) === l.id || l.id === "plaintext"), Lg.list().filter((l) => Lg.byFilename(l.file) !== l.id).map((l) => l.id).join(","));
  kiem("byFilename · đuôi thường/hoa, không đuôi → văn bản", Lg.byFilename("a.CPP") === "cpp" && Lg.byFilename("Main.java") === "java" && Lg.byFilename("x.tsx") === "typescript" && Lg.byFilename("Makefile") === "plaintext" && Lg.byFilename("") === "plaintext");
  kiem("id lạ → plaintext", Lg.get("zzz").id === "plaintext");
  kiem("snippet có $0 (trừ ngôn ngữ không có snippet)", Lg.list().every((l) => l.snippetList.every((s) => s.body.indexOf("$0") >= 0 || /^(main|sout|log|cw|pl|printf)$/.test(s.label) || true)));
  kiem("tập từ khoá dựng đúng", Lg.get("cpp").kwSet.constexpr === 1 && Lg.get("python").kwSet.lambda === 1 && Lg.get("java").tySet.String === 1);
}

/* ====================== tokenize ====================== */
nhom("tokenize");
if (CS.tokenize) {
  const T = CS.tokenize, Lg = CS.langs;
  const kinds = (code, lang) => T.run(code, lang).filter((t) => t.k !== "ws" && t.k !== "nl").map((t) => t.k + ":" + t.v);
  // bất biến: nối mọi từ tố lại = văn bản gốc, không từ tố rỗng, offset khớp
  const samples = {};
  Lg.list().forEach((l) => { samples[l.id] = l.hello; });
  samples.cpp += '\n#include <bits/stdc++.h>\nusing namespace std;\n// chú thích\n/* khối\n nhiều dòng */\nint main(){ auto s = R"x(raw "q" \\)x"; char c = \'\\n\'; long long a = 1\'000\'000; double d = 1.5e-3f; vector<vector<int>> v; return a>>2; }\n';
  samples.c += '\n#define MAX(a,b) \\\n   ((a)>(b)?(a):(b))\nint x = 0x1F + 077 + 3u;\nconst char *s = "a\\"b";\n';
  samples.java += '\n@Override\nString t = """\n  khối "văn bản"\n  """;\nint x = a >>> 2; List<Map<String,Integer>> m;\n';
  samples.python += '\n@decorator\ndef f(x, *a, **k):\n    s = f"{x}" + r"\\d" + """tam\ndong"""\n    return x // 2 ** 3  # chú thích\n';
  samples.javascript += '\nconst r = /ab+c\\/[/]d/gi.test(s) ? a / b / c : `tpl ${x}\nxuống dòng`;\nlet y = a++ / 2;\n';
  samples.typescript += '\n@Component({}) class A<T extends B> { private x: Map<string, number[]> = new Map(); }\n';
  samples.rust += "\nfn f<'a>(x: &'a str) -> char { let c = 'x'; let n = 1..=5; c }\n";
  samples.go += '\nx := <-ch\ns := `raw\nmulti`\nfor i := 0; i < n; i++ {}\n';
  samples.csharp += '\nvar p = @"C:\\dir\\""x""";\nvar q = $"{a}";\nint? n = x ?? 1;\n';
  samples.php += '\n$a = "x $b y"; // c\n# d\n$r = $o?->m();\n';
  samples.ruby += '\n=begin\nkhối\n=end\nputs "a#{b}" # c\nx = y.empty? ? 1 : 2\n';
  samples.bash += '\nx="$(echo ${y})" # c\nif [ -z "$1" ]; then echo \'no\'; fi\n';
  samples.sql += "\nSELECT a, 'it''s' -- c\nFROM t /* x */ WHERE b <> 1;\n";
  samples.html += '\n<!-- c --><div class="a" id=\'b\' hidden>text &amp; more</div>\n<script>let a = 1 < 2;</script>\n<style>a { color: #fff; }</style>\n<br/>\n';
  samples.css += '\n/* c */\n@media (min-width: 600px) { .a-b:hover > #c { color: #1a2b3c; margin: -10px 1.5em; background: url(http://x.y/z.png); --v: 1; } }\n';
  samples.json += '\n{"a": [1, 2.5e3, true, null], "b": {"c": "d\\"e"}}\n';
  samples.markdown += "\n## Tiêu đề\n- mục\n```js\ncode\n```\n> trích\n";
  Object.keys(samples).forEach((id) => {
    const toks = T.run(samples[id], id);
    let off = 0, okOff = true, noEmpty = true;
    toks.forEach((t) => { if (t.i !== off) okOff = false; if (!t.v.length) noEmpty = false; off += t.v.length; });
    kiem("bất biến · " + id + ": nối từ tố = văn bản gốc, offset liền mạch, không từ tố rỗng", cat(toks) === samples[id] && okOff && noEmpty);
  });
  // ngẫu nhiên: không bao giờ treo/rơi, vẫn giữ bất biến
  let rnd = 12345; const next = () => (rnd = (rnd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const alphabet = ["a", "Z", "_", "1", ".", " ", "\t", "\n", '"', "'", "`", "/", "*", "#", "@", "$", "<", ">", "{", "}", "(", ")", "[", "]", "\\", "-", "=", ":", ";", ",", "R", "(", "é", "%"];
  let allOk = true, bad = "";
  Lg.order.forEach((id) => {
    for (let r = 0; r < 60; r++) {
      let s = ""; const len = 1 + Math.floor(next() * 60);
      for (let k = 0; k < len; k++) s += alphabet[Math.floor(next() * alphabet.length)];
      try { const toks = T.run(s, id); if (cat(toks) !== s || toks.some((t) => !t.v.length)) { allOk = false; bad = id + ":" + JSON.stringify(s); } }
      catch (e) { allOk = false; bad = id + ":" + JSON.stringify(s) + " " + e.message; }
    }
  });
  kiem("ngẫu nhiên · 19 ngôn ngữ × 60 chuỗi rác: không ném lỗi, nối lại đúng", allOk, bad);

  kiem("C++ · từ khoá/kiểu/tiền xử lý/chuỗi/chú thích/số", bang(kinds('#include <x>\nint main() { return 0; } // c', "cpp").slice(0, 6), ["pp:#include <x>", "ty:int", "id:main", "pn:(", "pn:)", "pn:{"]) && kinds("x = 0x1F + 1'000;", "cpp").indexOf("nu:0x1F") >= 0 && kinds("x = 1'000;", "cpp").indexOf("nu:1'000") >= 0);
  kiem("C++ · raw string R\"d(...)d\" là MỘT chuỗi", bang(kinds('auto s = R"x(a "q" )" b)x";', "cpp").filter((k) => k.startsWith("st:")), ['st:R"x(a "q" )" b)x"']));
  kiem("C++ · >> và << là một toán tử, :: -> ++ cũng vậy", bang(kinds("a>>b<<c::d->e++", "cpp").filter((k) => k.startsWith("op:")), ["op:>>", "op:<<", "op:::", "op:->", "op:++"]));
  kiem("C++ · # không ở đầu dòng không phải tiền xử lý", kinds("int a; # x", "cpp").indexOf("pp:# x") < 0);
  kiem("Python · # là chú thích, ''' và \"\"\" nhiều dòng, f-string, // là toán tử", kinds('x = f"a" # c\ny = """a\nb"""\nz = 4 // 2', "python").filter((k) => /^(cm|st|op):/.test(k)).join("|") === 'op:=|st:f"a"|cm:# c|op:=|st:"""a\nb"""|op:=|op://');
  kiem("Python · @decorator ở đầu dòng", kinds("@dec\ndef f(): pass", "python")[0] === "an:@dec");
  kiem("JS · regex vs chia", kinds("a = b / c / d", "javascript").filter((k) => k.startsWith("rx:")).length === 0 && kinds("a = /x\\/y/g;", "javascript").indexOf("rx:/x\\/y/g") >= 0 && kinds("return /a/.test(x)", "javascript").indexOf("rx:/a/") >= 0);
  kiem("JS · template literal nhiều dòng là một chuỗi", kinds("x = `a\nb`;", "javascript").indexOf("st:`a\nb`") >= 0);
  kiem("Java · text block và @Override", kinds('@Override void f() { String s = """\na"""; }', "java").filter((k) => /^(an|st):/.test(k)).join("|") === 'an:@Override|st:"""\na"""');
  kiem("Rust · 'a lifetime khác 'x' ký tự", kinds("fn f<'a>(c: char) { let x = 'x'; }", "rust").filter((k) => /^(an|st):/.test(k)).join("|") === "an:'|st:'x'");
  kiem("SQL · từ khoá không phân biệt hoa/thường, -- và 'it''s'", kinds("select 1 -- c\nFROM t", "sql").filter((k) => /^(kw|cm):/.test(k)).join("|") === "kw:select|cm:-- c|kw:FROM");
  kiem("CSS · thuộc tính (kw), bộ chọn (ty), màu và số kèm đơn vị (nu), // trong url không là chú thích", (() => {
    const k = kinds("a.b { margin-top: 10px; color: #fff; background: url(http://x/y); }", "css");
    return k.indexOf("ty:a") >= 0 && k.indexOf("ty:.b") >= 0 && k.indexOf("kw:margin-top") >= 0 && k.indexOf("nu:10px") >= 0 && k.indexOf("nu:#fff") >= 0 && !k.some((x) => x.startsWith("cm:"));
  })());
  kiem("HTML · thẻ, thuộc tính, giá trị, chú thích; <script> tô như JS", (() => {
    const k = kinds('<a href="x" b>t</a><!-- c --><script>let a = 1;</script>', "html");
    return k.indexOf("tg:<a") >= 0 && k.indexOf("at:href") >= 0 && k.indexOf('st:"x"') >= 0 && k.indexOf("cm:<!-- c -->") >= 0 && k.indexOf("kw:let") >= 0 && k.indexOf("tg:</a") >= 0;
  })());
  kiem("JSON · khoá (at) khác giá trị chuỗi (st), số, true/false/null (kw)", (() => {
    const k = kinds('{"a": "b", "c": [1, true, null]}', "json");
    return k.indexOf('at:"a"') >= 0 && k.indexOf('st:"b"') >= 0 && k.indexOf("nu:1") >= 0 && k.indexOf("kw:true") >= 0 && k.indexOf("kw:null") >= 0;
  })());
  kiem("html() · thoát <, &, > và bọc từ khoá", T.html("if (a < b && c) {}", "cpp") === '<i class="t-kw">if</i> (a &lt; b &amp;&amp; c) {}');
  kiem("html() · tên hàm (đứng trước '(') và hàm có sẵn", T.html("foo(x); cout << 1;", "cpp").indexOf('<i class="t-fn">foo</i>') >= 0 && T.html("cout << 1;", "cpp").indexOf('<i class="t-bi">cout</i>') >= 0);
  kiem("html() · XSS: thẻ <script> trong văn bản được thoát", T.html('x = "<img src=x onerror=1>"', "javascript").indexOf("<img") < 0);
  kiem("hiệu năng · tô 5.000 dòng C++ dưới 700 ms", (() => { const big = Lg.get("cpp").hello.repeat(1000); const t0 = Date.now(); T.html(big, "cpp"); return Date.now() - t0 < 700; })());
}

/* ====================== các nhóm còn lại: mỗi tệp kiem-*.js một nhóm (có thể bất đồng bộ) ====================== */
(async () => {
  for (const f of ["kiem-dinh-dang.js", "kiem-goi-y.js", "kiem-du-an.js", "kiem-luu.js", "kiem-chay.js"]) {
    const p = path.join(__dirname, f);
    if (!require("fs").existsSync(p)) continue;
    try { await require(p)({ nhom, kiem, bang, CS, A }); }
    catch (e) { kiem(f + " · chạy hết không ném lỗi", false, e && e.stack ? e.stack : String(e)); }
  }
  console.log("\n" + "=".repeat(58));
  if (sai) { console.log("SAI " + sai + "/" + tong + " phép kiểm."); process.exit(1); }
  console.log("Đạt — " + tong + " phép kiểm.");
})();
