/* BẢN CHÉP từ personal-wiki bằng sync.py — đừng sửa ở đây. */
/* highlight.js — tô màu code trong khối ``` : một bộ tách từ chung + bảng từ khoá theo ngôn ngữ. Không thư viện, đủ cho ghi chú (không phải IDE).
   highlight(code, lang) → HTML đã thoát với <span class="tk-…"> (c = chú thích, s = chuỗi, n = số, k = từ khoá, t = kiểu/Tên viết hoa, f = tên hàm); null nếu không biết ngôn ngữ hoặc quá dài. */
(function (root) {
  "use strict";
  var W = root.Algo || (root.Algo = {});
  if (!W.text && typeof require === "function") require("./text.js");
  var esc = W.text.esc, MAX = 200000;

  var CBASE = "auto break case char const continue default do double else enum extern float for goto if inline int long register return short signed sizeof static struct switch typedef union unsigned void volatile while bool true false NULL nullptr";
  var KW = {
    c: CBASE,
    cpp: CBASE + " class namespace template typename public private protected virtual override final new delete using this try catch throw operator constexpr explicit friend mutable noexcept static_cast dynamic_cast reinterpret_cast const_cast decltype include define pragma ifdef ifndef endif std string vector map set unordered_map pair size_t int64_t uint64_t",
    java: "abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while true false null var record sealed permits",
    js: "async await break case catch class const continue debugger default delete do else export extends finally for from function if import in instanceof let new of return static super switch this throw try typeof var void while with yield null undefined true false get set",
    ts: "async await break case catch class const continue default delete do else enum export extends finally for from function if implements import in instanceof interface let new of private protected public readonly return static super switch this throw try type typeof var void while yield null undefined true false as any boolean number string never unknown abstract declare namespace keyof",
    py: "False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield self print range len",
    go: "break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var true false nil iota string int int64 float64 bool byte rune error make new len cap append",
    rust: "as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while Vec String Option Some None Result Ok Err Box",
    sql: "select from where group by order having insert into values update set delete create table index alter drop join left right inner outer full on as and or not null is in like between limit offset distinct union all case when then else end primary key foreign references default unique count sum avg min max asc desc with exists",
    sh: "if then else elif fi for while do done case esac function in return exit echo cd ls cat grep sed awk export local readonly set unset source alias sudo apt git docker kubectl npm pip",
    json: "true false null", yaml: "true false null yes no on off", css: "important"
  };
  var ALIAS = { "c++": "cpp", cc: "cpp", cxx: "cpp", hpp: "cpp", h: "c", javascript: "js", mjs: "js", jsx: "js", typescript: "ts", tsx: "ts", python: "py", python3: "py", golang: "go", rs: "rust", bash: "sh", shell: "sh", zsh: "sh", mysql: "sql", postgres: "sql", postgresql: "sql", sqlite: "sql", yml: "yaml", kt: "java", kotlin: "java", cs: "java", csharp: "java", scala: "java", php: "js", rb: "py", ruby: "py" };
  var HASH = { py: 1, sh: 1, yaml: 1 }, DASH = { sql: 1 }, SLASH = { c: 1, cpp: 1, java: 1, js: 1, ts: 1, go: 1, rust: 1, css: 1 };
  var sets = {};
  function kwSet(lang) { return sets[lang] || (sets[lang] = new Set(KW[lang].toLowerCase().split(" "))); }

  var RE = {};
  function reFor(lang) {
    if (RE[lang]) return RE[lang];
    var cm = [];
    if (SLASH[lang]) cm.push("\\/\\*[\\s\\S]*?(?:\\*\\/|$)", "\\/\\/[^\\n]*");
    if (HASH[lang]) cm.push("#[^\\n]*");
    if (DASH[lang]) cm.push("--[^\\n]*");
    var src = (cm.length ? "(" + cm.join("|") + ")" : "(?!)()") + "|(\"(?:\\\\.|[^\"\\\\\\n])*\"|'(?:\\\\.|[^'\\\\\\n])*'|`(?:\\\\.|[^`\\\\])*`)|(\\b\\d[\\w.]*)|([A-Za-z_][A-Za-z0-9_]*)|([\\s\\S])";
    return (RE[lang] = new RegExp(src, "g"));
  }

  function highlight(code, lang) {
    lang = String(lang || "").toLowerCase();
    lang = ALIAS[lang] || lang;
    if (!KW[lang] || code.length > MAX) return null;
    var kws = kwSet(lang), re = reFor(lang), out = "", m, last = 0;
    re.lastIndex = 0;
    var ci = lang === "sql";
    while ((m = re.exec(code))) {
      var cls = m[1] != null && m[1] !== "" ? "c" : m[2] ? "s" : m[3] ? "n" : null, text = m[0];
      if (!cls && m[4]) {
        var word = m[4], next = code.charAt(re.lastIndex);
        cls = kws.has(ci ? word.toLowerCase() : word) || (!ci && kws.has(word.toLowerCase()) && lang === "sql") ? "k" : next === "(" ? "f" : /^[A-Z][A-Za-z0-9_]*$/.test(word) && word.length > 1 ? "t" : null;
      }
      out += cls ? '<span class="tk-' + cls + '">' + esc(text) + "</span>" : esc(text);
      last = re.lastIndex;
    }
    return out + esc(code.slice(last));
  }

  W.highlight = highlight;
  if (typeof module !== "undefined" && module.exports) module.exports = highlight;
})(typeof globalThis !== "undefined" ? globalThis : this);
