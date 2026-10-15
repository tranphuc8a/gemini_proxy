/* ==========================================================================
   FILE SINH RA - DUNG SUA O DAY.
   Nguon that: tranphuc8a/code-studio/assets/core/format.js
   Sua o do roi chay: python tranphuc8a/code-studio/sync.py
   ========================================================================== */
/* format.js — định dạng mã nguồn cho Code Studio.
   Có sẵn "Tự viết" (builtin) chạy tức thì, không cần mạng; ngoài ra có thể đăng ký nhà cung cấp khác (clang-format WASM, Prettier, Ruff… xem format-ext.js)
   và người dùng chọn cái nào. Mọi nhà cung cấp cùng giao diện: provider.format(text, langId, opts) → Promise<string>.

   Bộ "Tự viết" làm việc trên TỪ TỐ (tokenize.js) nên giữ NGUYÊN dãy từ tố — chỉ đổi khoảng trắng và chỗ ngắt dòng (kiểm trong kiem-dinh-dang.js):
     • họ C (C, C++, Java, C#, JS, TS, Go, Rust, Kotlin, PHP): thụt dòng theo ngoặc, tách câu lệnh/khối thành từng dòng, kiểu ngoặc nhọn K&R/Allman,
       khoảng trắng quanh toán tử/dấu phẩy/từ khoá, nhận ra <template>, con trỏ `int *p`, case/nhãn, thân if/for không ngoặc, lambda gọn một dòng.
     • Python / Ruby: thụt dòng lại theo cấu trúc, gọn khoảng trắng; JSON: JSON.stringify; CSS: tách khối; SQL: viết hoa từ khoá + xuống dòng theo mệnh đề;
       HTML/Bash/Markdown/văn bản: gọn khoảng trắng + thụt lại (HTML).
   Không bao giờ ném lỗi ra ngoài: format() luôn trả {ok, text, provider, error?}. */
(function (root) {
  "use strict";
  var CS = root.CS || (root.CS = {});
  var set = function (s) { return CS.langs.set(s); };

  var SP_PAREN = set("if for while switch catch foreach elseif return throw synchronized lock using with when await yield in typeof delete");
  var CTL = set("if for while switch catch foreach elseif with synchronized lock using fixed when");
  var SIZEOF_LIKE = set("sizeof alignof decltype typeof noexcept defined static_assert assert");
  var HEAD_BLOCK = set("class struct union enum interface namespace extern impl trait mod object record module protocol extension actor");
  var HEAD_CTRL = set("if else for while switch select match loop try catch finally foreach do unsafe lock using synchronized with when func fn function fun def checked unchecked");
  var ACCESS = set("public private protected internal signals slots");
  var BIN = set("= += -= *= /= %= &= |= ^= <<= >>= >>>= == != === !== <= >= && || ?? => <=> &&= ||= ??= := <- |> =~ !~");
  var TPL_DENY = set("if else while for return do switch case break continue goto try catch throw delete");
  var TPL_ALLOWED_OPS = set(", :: * & < > >> . ? ... = [ ] ( ) @");
  var ARITH = set("+ - * / % & | ^ << >> >>> < >");
  var UNARY_OK = set("+ - * & ! ~ ++ -- !!");
  var TYPE_LANGS = set("c cpp");
  var GENERIC_LANGS = set("cpp java csharp typescript rust kotlin c");
  var INLINE_LANGS = set("c cpp java csharp kotlin rust go");          /* lambda ngắn trong lời gọi được giữ một dòng */
  var ASI_LANGS = set("go javascript typescript kotlin");             /* hết dòng có thể là hết câu lệnh (không cần ;) */

  function indentUnit(o) { return o.indent === "tab" ? "\t" : new Array((o.indent | 0) + 1).join(" "); }
  function levelStr(o, n) { var u = indentUnit(o), s = ""; for (var i = 0; i < n; i++) s += u; return s; }

  function defaults(langId) {
    var L = CS.langs.get(langId);
    return {
      indent: L.tabs ? "tab" : (L.tab || 4), braces: "kr", maxBlank: 2, pointer: "auto", indentCase: true, indentNamespace: false, commentGap: 2, finalNewline: true,
      keepOneLiners: true, maxInline: 140,
      bracedList: /^(c|cpp|java)$/.test(L.id) ? "tight" : "spaced", sqlUpper: true, colon: /^(c|cpp|java|csharp)$/.test(L.id) ? "both" : "right"
    };
  }
  function withDefaults(langId, o) { var d = defaults(langId), k; o = o || {}; for (k in o) if (o[k] !== undefined && o[k] !== null && o[k] !== "") d[k] = o[k]; return d; }

  /* ---------------------------------------------------------------- chuẩn bị */
  /** Cột (tab = 4) sau khi viết chuỗi `s` bắt đầu ở cột `col`. */
  function adv(col, s) {
    for (var q = 0; q < s.length; q++) { var ch = s.charAt(q); if (ch === "\n") col = 0; else if (ch === "\t") col = (Math.floor(col / 4) + 1) * 4; else col++; }
    return col;
  }
  function prepare(toks) {
    var S = [], nl = 0, ws = false, col = 0, k;
    for (k = 0; k < toks.length; k++) {
      var t = toks[k];
      if (t.k === "nl") { nl++; ws = true; col = 0; continue; }
      if (t.k === "ws") { ws = true; col = adv(col, t.v); continue; }
      var tok = { k: t.k, v: t.v, nl: nl, ws: ws || nl > 0, idx: S.length, tpl: null, cast: false, col: col };
      col = adv(col, t.v);
      tok.endCol = col;
      S.push(tok);
      nl = 0; ws = false;
    }
    /* từ khoá đứng sau dấu truy cập thành viên là TÊN thuộc tính/phương thức: p.catch(...), x.default, obj.new */
    for (k = 1; k < S.length; k++) if (S[k].k === "kw" && S[k - 1].k === "op" && (S[k - 1].v === "." || S[k - 1].v === "?.")) S[k].k = "id";
    return S;
  }
  function pairBrackets(S) {
    var m = new Array(S.length), st = [], i, t;
    for (i = 0; i < S.length; i++) m[i] = -1;
    for (i = 0; i < S.length; i++) {
      t = S[i];
      if (t.k !== "pn") continue;
      if (t.v === "(" || t.v === "[" || t.v === "{") st.push(i);
      else if (t.v === ")" || t.v === "]" || t.v === "}") {
        var want = t.v === ")" ? "(" : t.v === "]" ? "[" : "{";
        for (var j = st.length - 1; j >= 0; j--) if (S[st[j]].v === want) { m[i] = st[j]; m[st[j]] = i; st.length = j; break; }
      }
    }
    return m;
  }
  /** Đánh dấu `<`…`>` của kiểu mẫu/generic (vector<int>, Map<K, V>, template <class T>). */
  function markTemplates(S, L) {
    if (!GENERIC_LANGS[L.id]) return;
    var closeCount = {}, i, j;
    for (i = 0; i < S.length; i++) {
      var t = S[i], prev = S[i - 1];
      if (t.k !== "op" || t.v !== "<" || !prev) continue;
      var after = prev.v === "template" || (!t.ws && (prev.k === "id" || prev.k === "ty" || (prev.k === "kw" && !TPL_DENY[prev.v])));
      if (!after) continue;
      var depth = 0, par = 0, ok = false;
      for (j = i; j < S.length && j - i < 160; j++) {
        var u = S[j];
        if (u.k === "pn" && (u.v === ";" || u.v === "{" || u.v === "}")) break;
        if (u.v === "(" || u.v === "[") { if (u.v === "(") par++; continue; }
        if (u.v === ")") { if (--par < 0) break; continue; }
        if (u.v === "<") depth++;
        else if (u.v === ">") depth--;
        else if (u.v === ">>") depth -= 2;
        else if (u.k === "id" || u.k === "ty" || u.k === "nu") { /* ok */ }
        else if (u.k === "kw") { if (TPL_DENY[u.v]) break; }
        else if (u.k === "op" || u.k === "pn") { if (!TPL_ALLOWED_OPS[u.v]) break; }
        else break;
        /* `>>` đóng cùng lúc hai tầng: với `<` bên trong, nó làm depth về -1 — vẫn là đóng đúng (nửa còn lại thuộc tầng ngoài) */
        if (depth <= 0) { ok = depth === 0 || (depth === -1 && u.v === ">>"); break; }
      }
      if (ok) { t.tpl = "open"; t.closeAt = j; closeCount[j] = (closeCount[j] || 0) + 1; }
    }
    Object.keys(closeCount).forEach(function (j2) {
      var u = S[+j2], c = closeCount[j2];
      if ((u.v === ">" && c === 1) || (u.v === ">>" && c === 2)) u.tpl = "close";
    });
    /* `<` mở mà dấu đóng của nó không được nhận (vd `a<b>>c` là dịch bit) → bỏ đánh dấu */
    for (i = 0; i < S.length; i++) if (S[i].tpl === "open" && S[S[i].closeAt].tpl !== "close") S[i].tpl = null;
  }
  /** `(int)`, `(unsigned long)`, `(char*)`: dấu `)` đóng một phép ép kiểu → theo sau là toán hạng, không phải phép toán hai ngôi. */
  function markCasts(S, match) {
    for (var i = 0; i < S.length; i++) {
      if (S[i].v !== ")" || match[i] < 0) continue;
      var a = match[i], ok = i - a > 1, j;
      for (j = a + 1; j < i && ok; j++) { var u = S[j]; if (!(u.k === "ty" || (u.k === "kw" && /^(const|unsigned|signed|struct|volatile)$/.test(u.v)) || (u.k === "op" && u.v === "*"))) ok = false; }
      if (ok && S[a + 1].k !== "op") S[i].cast = true;
    }
  }

  /* ------------------------------------------------------- họ C: động cơ chính */
  function formatBrace(text, L, o) {
    var S = prepare(CS.tokenize.run(text, L.id)), n = S.length;
    if (!n) return "";
    var match = pairBrackets(S);
    markTemplates(S, L);
    markCasts(S, match);
    var css = L.family === "css", cstyle = !!TYPE_LANGS[L.id], id = L.id;
    var out = [], line = "", lineLevel = 0, lineEmpty = true, stmtLevel = 0;
    var frames = [], root = { tern: 0 }, head = [], stmtOpen = false, forceBreak = false, needBody = null, pendingDo = false;
    var labelPending = false, labelDepth = 0, closedBlock = null, tplHeadClose = -1, stmtStartTok = 0, i;

    function top() { return frames[frames.length - 1] || null; }
    function ctx() { return top() || root; }
    function endLine() { if (!lineEmpty) { out.push(levelStr(o, lineLevel) + line); line = ""; lineEmpty = true; } }
    function isBlk(f) { return !!f && f.t === "{" && (f.kind === "block" || f.kind === "switch"); }
    function stmtFrame(f) { return !f || f.t === "body" || isBlk(f); }
    function peekFor(ch) { var want = ch === ")" ? "(" : ch === "]" ? "[" : "{"; for (var k = frames.length - 1; k >= 0; k--) if (frames[k].t === want) return frames[k]; return null; }
    function popFor(ch) { var want = ch === ")" ? "(" : ch === "]" ? "[" : "{"; for (var k = frames.length - 1; k >= 0; k--) if (frames[k].t === want) { var f = frames[k]; frames.length = k; return f; } return null; }
    function popBodies() { while (top() && top().t === "body") frames.pop(); }
    function isCloser(t) { return t.k === "pn" && (t.v === ")" || t.v === "]" || t.v === "}"); }
    function lineComment(t) { return t && t.k === "cm" && /^(\/\/|#|--)/.test(t.v); }
    function isLabelStart(k) {
      var t = S[k];
      if (t.k !== "kw") return false;
      if (t.v === "case") return true;
      return t.v === "default" && !!S[k + 1] && (S[k + 1].v === ":" || S[k + 1].v === "->");
    }
    function isAccessSpec(k) { return S[k].k === "kw" && ACCESS[S[k].v] && !!S[k + 1] && S[k + 1].v === ":" && S[k + 1].k === "op"; }

    function operandEnd(k) {
      var a = S[k];
      if (!a) return false;
      if (a.v === ")" && a.k === "pn") return !a.cast;
      if (a.tpl === "close") return true;
      return CS.tokenize.operandEnd(a);
    }
    function isUnary(k) {
      var t = S[k], a = S[k - 1];
      if (!a) return true;
      if (a.v === "}" && a.k === "pn" && t.nl > 0) return true;
      return !operandEnd(k - 1);
    }
    function wordLike(t) { return t.k === "id" || t.k === "kw" || t.k === "ty" || t.k === "nu" || t.k === "st" || t.k === "rx" || t.k === "an"; }
    function looksType(a) {
      if (!a) return false;
      if (a.k === "ty" || a.tpl === "close") return true;
      if (a.k === "kw" && /^(const|struct|class|enum|union|volatile|unsigned|signed|auto)$/.test(a.v)) return true;
      return a.k === "id" && /[a-z]/.test(a.v) && (/^[A-Z]/.test(a.v) || /_t$/.test(a.v));
    }
    var SIG = /^(\*|&|&&)$/;
    function isSig(t) { return !!t && t.k === "op" && SIG.test(t.v); }
    /* `*`/`&`/`&&` là dấu khai báo con trỏ/tham chiếu (int *p, Foo &x)? Chỉ xét C/C++. */
    function sigilInfo(k) {
      if (!cstyle || !isSig(S[k])) return null;
      var s = k, e = k;
      while (s > 0 && isSig(S[s - 1]) && !S[s].ws) s--;
      while (e + 1 < n && isSig(S[e + 1]) && !S[e + 1].ws) e++;
      var a = s - 1, nx = S[e + 1];
      if (a < 0 || !looksType(S[a]) || !nx) return null;
      var decl = nx.k === "id" || (nx.k === "kw" && /^(const|volatile|restrict|__restrict)$/.test(nx.v)) || nx.v === ")" || nx.v === "," || nx.v === ">" || nx.tpl === "close" || nx.v === ";" || nx.v === "[";
      return decl ? { s: s, e: e } : null;
    }

    function spaceBefore(k) {
      var a = S[k - 1], b = S[k], av = a.v, bv = b.v, pp = S[k - 2];
      if (b.k === "cm" || a.k === "cm") return true;
      if (a.k === "pn" && (av === "(" || av === "[")) return false;
      if (b.k === "pn" && (bv === ")" || bv === "]")) return false;
      if (b.k === "pn" && (bv === "," || bv === ";")) return false;
      if (a.k === "pn" && av === ",") return true;
      if (a.k === "pn" && av === ";") return !(b.k === "pn" && (bv === ";" || bv === ")"));
      if (a.k === "kw" && av === "operator") return false;
      if (pp && pp.k === "kw" && pp.v === "operator" && a.k === "op") return false;
      /* ngoặc nhọn */
      if (b.k === "pn" && bv === "{") {
        if (b.kind === "block" || b.kind === "switch" || b.kind === "inline" || b.spaced) return true;
        if (a.k === "op" && av !== "::") return true;
        return !!b.ws;
      }
      if (a.k === "pn" && av === "{") {
        if (b.k === "pn" && bv === "}") return false;
        if (a.kind === "block" || a.kind === "switch" || a.kind === "inline" || a.spaced) return true;
        return o.bracedList === "spaced";
      }
      if (b.k === "pn" && bv === "}") return b.kind === "block" || b.kind === "inline" || b.kind === "switch" || b.spaced ? true : o.bracedList === "spaced";
      if (a.k === "pn" && av === "}" && (b.k === "id" || b.k === "kw" || b.k === "ty")) return true;
      if (css) {
        if (bv === ":" && b.k === "op") return false;
        if (av === ":" && a.k === "op") return a.colon === "pseudo" ? false : true;
        if (bv === "!" ) return true;
        if (av === "!") return false;
        if (b.k === "op" || a.k === "op") return !!b.ws;
        if (bv === "(") return !(a.k === "id" || a.k === "kw" || a.k === "ty") && !!b.ws;
        return wordLike(a) && wordLike(b) ? true : !!b.ws;
      }
      /* truy cập thành viên */
      if (b.k === "op" && (bv === "." || bv === "?." || bv === "?->" || bv === "::" || bv === ".*")) return false;
      if (a.k === "op" && (av === "." || av === "?." || av === "?->" || av === "::" || av === ".*")) return false;
      if (b.k === "op" && bv === "->" && cstyle) return av === ")" ? !!b.ws : false;
      if (a.k === "op" && av === "->" && cstyle) return pp && pp.k === "pn" && pp.v === ")" ? !!b.ws : false;   /* `) -> const T&` kiểu trả về đặt sau */
      if (b.k === "op" && bv === "...") return operandEnd(k - 1) ? false : true;
      if (a.k === "op" && av === "...") return operandEnd(k - 2) && (b.k === "id" || b.k === "kw" || b.k === "ty");   /* `Args... args` có cách; `...xs` (spread) thì không */
      /* mẫu <> */
      if (b.tpl === "open") return a.k === "kw" && av === "template";
      if (a.tpl === "open") return false;
      if (b.tpl === "close") return false;
      if (a.tpl === "close") {
        if (wordLike(b)) return true;
        if (isSig(b)) return o.pointer === "left" ? false : (o.pointer === "keep" ? !!b.ws : true);
        if (b.k === "pn" && (bv === "(" || bv === "," || bv === ")" || bv === ";" || bv === "[")) return false;
        if (b.k === "op" && (bv === "::" || bv === ">" || b.tpl === "close")) return false;
        if (b.k === "op" && BIN[bv]) return true;
        return !!b.ws;
      }
      /* dấu hai chấm / hỏi */
      if (b.k === "op" && bv === ":") {
        if (b.colon === "label") return false;
        if (b.colon === "tern") return true;
        if (av === "?" && a.optional) return false;
        return o.colon === "both";
      }
      if (a.k === "op" && av === ":") return true;
      if (b.k === "op" && bv === "?") return !b.optional;
      if (a.k === "op" && av === "?") return a.optional ? bv !== ":" : true;
      /* ++ -- */
      if (b.k === "op" && (bv === "++" || bv === "--")) return isUnary(k) ? !(a.k === "op" && UNARY_OK[av] && isUnary(k - 1)) : false;
      if (a.k === "op" && (av === "++" || av === "--")) return isUnary(k - 1) ? false : (wordLike(b) || (b.k === "op" && (BIN[bv] || ARITH[bv])));
      /* phép gán/so sánh/logic: luôn có dấu cách */
      if (b.k === "op" && BIN[bv]) return true;
      if (a.k === "op" && BIN[av]) return true;
      if (b.k === "op" && bv === "->") return true;
      if (a.k === "op" && av === "->") return true;
      /* ! ~ */
      if (b.k === "op" && (bv === "!" || bv === "~")) {
        if (bv === "!" && operandEnd(k - 1) && /^(typescript|kotlin|csharp)$/.test(id)) return false;
        return !(a.k === "op" && UNARY_OK[av] && isUnary(k - 1));
      }
      if (a.k === "op" && (av === "!" || av === "~") && isUnary(k - 1)) return false;
      /* con trỏ / tham chiếu khi khai báo */
      var sb = sigilInfo(k);
      if (sb) { if (k > sb.s) return false; return o.pointer === "left" ? false : (o.pointer === "keep" ? !!b.ws : true); }
      var sa = k - 1 >= 0 ? sigilInfo(k - 1) : null;
      if (sa) { if (k - 1 < sa.e) return false; return o.pointer === "right" ? false : (o.pointer === "keep" ? !!b.ws : !(b.k === "pn" || (b.k === "op" && (bv === ">" || b.tpl === "close")))); }
      /* số học / so sánh */
      if (b.k === "op" && (ARITH[bv] || bv === "&&")) {
        if (isUnary(k)) return !(av === "(" || av === "[") && !(a.k === "op" && UNARY_OK[av] && isUnary(k - 1));
        return true;
      }
      if (a.k === "op" && (ARITH[av] || av === "&&")) return isUnary(k - 1) ? false : true;
      /* từ liền từ */
      if (wordLike(a) && wordLike(b)) return !(a.k === "nu" && b.k === "id" && !b.ws);
      /* ngoặc tròn / vuông */
      if (b.k === "pn" && bv === "(") {
        if (a.k === "kw") return SIZEOF_LIKE[av] ? false : true;
        if (a.k === "id" || a.k === "ty" || a.k === "an") return false;
        if (a.k === "pn" && (av === ")" || av === "]" || av === "}")) return false;
        if (a.k === "st") return !!b.ws;
        return a.k === "op" ? true : !!b.ws;
      }
      if (b.k === "pn" && bv === "[") {
        if (a.k === "id" || a.k === "ty" || a.k === "st" || (a.k === "pn" && (av === ")" || av === "]")) || a.tpl === "close") return false;
        if (a.k === "kw") return !(av === "this" || av === "self");
        return a.k === "op" ? true : !!b.ws;
      }
      if (a.k === "pn" && av === ")") return a.cast ? false : (b.k === "kw" ? true : !!b.ws);
      if (a.k === "pn" && av === "]" && wordLike(b)) return !!b.ws || b.k === "kw";
      return !!b.ws;
    }

    function hasBlockHead() { for (var h = 0; h < head.length; h++) if (HEAD_BLOCK[head[h]] && head[h - 1] !== ".") return true; return false; }
    function headKw() { for (var h = 0; h < head.length; h++) if (HEAD_BLOCK[head[h]]) return head[h]; return ""; }
    function enumOneLine(k) { var m = match[k]; if (m < 0) return false; for (var q = k + 1; q <= m; q++) if (S[q].nl > 0) return false; return true; }
    function classify(k) {
      var prev = S[k - 1], hasParen = head.indexOf("(") >= 0, h;
      if (css || !prev) return "block";
      if (!stmtOpen && stmtFrame(top())) return "block";                      /* `{` đứng đầu câu lệnh: khối trần */
      if (head[0] === "switch" || head[0] === "select") return "switch";
      if (prev.v === "=>" || (prev.v === "->" && /^(java|kotlin|csharp|cpp|c|rust)$/.test(id))) return "block";
      if (prev.k === "pn" && prev.v === ")") return "block";
      if (prev.k === "op" && prev.v === ":" && prev.colon === "label") return "block";
      if (prev.k === "kw" && /^(else|do|try|finally|static|unsafe|loop)$/.test(prev.v)) return "block";
      if (hasBlockHead()) return headKw() === "enum" && enumOneLine(k) ? "init" : "block";
      for (h = 0; h < head.length; h++) if (HEAD_CTRL[head[h]]) return "block";
      if (prev.k === "pn" && prev.v === "]" && match[k - 1] >= 0 && !operandEnd(match[k - 1] - 1)) return "block";
      if (prev.k === "kw" && /^(const|noexcept|override|final|volatile|mutable)$/.test(prev.v) && hasParen) return "block";
      if (head.indexOf("throws") >= 0 || (head.indexOf("->") >= 0 && hasParen)) return "block";
      if (head.indexOf("operator") >= 0 && hasParen) return "block";
      return "init";
    }
    /* khối `{ ... }` nằm gọn trên một dòng gốc, bên trong ngoặc (lambda làm đối số) → giữ gọn một dòng */
    function inlineCandidate(k) {
      var f = top(), m = match[k];
      if (!f || (f.t !== "(" && f.t !== "[") || m < 0) return false;
      var semis = 0, q;
      for (q = k + 1; q <= m; q++) {
        if (S[q].nl > 0 || (S[q].k === "cm" && S[q].v.indexOf("\n") >= 0)) return false;
        if (S[q].v === ";") semis++;
        if (S[q].v === "{" && q !== k) return false;
      }
      return semis <= 1 && m - k < 60;
    }
    /* Câu lệnh s..e nằm riêng trọn MỘT dòng gốc (đầu dòng → hết dòng, sau nó chỉ có thể là chú thích) và đủ ngắn?
       Dùng để giữ nguyên các dòng "gọn" người viết cố ý: `int d(int a) { return a; }`, `for (…) scanf(…);`. Mã xấu dính chùm thì không thoả. */
    function ownLine(s, e) {
      if (!o.keepOneLiners || s < 0 || e >= n) return false;
      if (s > 0 && S[s].nl === 0) return false;
      /* `}` (khối thường) rồi xuống dòng `else {…}`: K&R sẽ kéo else lên dòng của `}` → không còn là dòng riêng */
      if (s > 0 && S[s].k === "kw" && /^(else|catch|finally)$/.test(S[s].v) && S[s - 1].k === "pn" && S[s - 1].v === "}" && !S[s - 1].inlineClose && o.braces !== "allman") return false;
      for (var q = s + 1; q <= e; q++) if (S[q].nl > 0 || (S[q].k === "cm" && S[q].v.indexOf("\n") >= 0) || S[q].k === "pp") return false;
      var nx = S[e + 1];
      if (nx && nx.nl === 0 && nx.k !== "cm") return false;
      return S[e].endCol - S[s].col <= o.maxInline && tidy(s, e);
    }
    /* Dòng đã "gọn" (người viết đã định dạng) chưa? Mã dính chùm luôn để lộ ra: `a=b`, `f(a,b)`, `if(`, `){`, `;x`. */
    function tidy(s, e) {
      for (var q = s; q <= e; q++) {
        var u = S[q], nx = q < e ? S[q + 1] : null;
        if (u.k === "pn" && u.v === "," && nx && !nx.ws) return false;
        if (u.k === "pn" && u.v === ";" && nx && !nx.ws && !(nx.k === "pn" && (nx.v === ")" || nx.v === ";" || nx.v === "}"))) return false;
        if (u.k === "op" && BIN[u.v] && ((q > s && !u.ws) || (nx && !nx.ws))) return false;
        if (u.k === "kw" && CTL[u.v] && nx && nx.v === "(" && !nx.ws) return false;
        if (u.k === "pn" && u.v === ")" && nx && nx.k === "pn" && nx.v === "{" && !nx.ws) return false;
        if (u.k === "pn" && u.v === "{" && nx && !(nx.k === "pn" && nx.v === "}") && !nx.ws && match[q] >= 0 && S[match[q]].ws === false && S[q - 1] && S[q - 1].v === ")") return false;
      }
      return true;
    }
    /* khối `{ ... }` (thân hàm, thân vòng lặp, struct) ngắn, không lồng khối, nằm riêng một dòng gốc → giữ một dòng */
    function shortBlock(k) {
      var m = match[k], semis = 0, par = 0, q;
      if (m < 0) return false;
      if (top() && top().t === "body" && top().inline) {                     /* `for (…) if (…) { … }` đã được giữ một dòng */
        for (q = k + 1; q <= m; q++) if (S[q].nl > 0 || (S[q].k === "pn" && S[q].v === "{")) return false;
        return true;
      }
      for (q = k + 1; q < m; q++) {
        var u = S[q];
        if (u.k === "pn" && u.v === "{") return false;
        if (u.k === "pn" && (u.v === "(" || u.v === "[")) par++;
        else if (u.k === "pn" && (u.v === ")" || u.v === "]")) par--;
        else if (u.k === "pn" && u.v === ";" && par === 0) semis++;
        if (u.k === "kw" && (u.v === "case" || u.v === "default")) return false;
      }
      if (semis > 4) return false;
      /* hết câu trên cùng dòng: `}`, `});`, `})`, `};` … */
      var e = m;
      while (S[e + 1] && S[e + 1].nl === 0 && S[e + 1].k === "pn" && /^[)\];,]$/.test(S[e + 1].v)) e++;
      return ownLine(stmtOpen ? stmtStartTok : k, e);
    }
    /* thân không ngoặc `for (…) x;` / `if (…) continue;` cùng dòng với đầu câu và câu chiếm trọn một dòng → giữ một dòng */
    function shortBody(k) {
      var d = 0, q;
      for (q = k; q < n; q++) {
        var u = S[q];
        if (u.k === "pn" && (u.v === "(" || u.v === "[")) d++;
        else if (u.k === "pn" && (u.v === ")" || u.v === "]")) d--;
        else if (u.k === "pn" && u.v === "{" && d <= 0 && match[q] > q) {           /* thân là câu có khối ngắn: `for (…) if (…) { a; b; }` */
          var m2 = match[q], e2;
          for (e2 = q + 1; e2 < m2; e2++) if (S[e2].k === "pn" && S[e2].v === "{") return false;
          e2 = m2; while (S[e2 + 1] && S[e2 + 1].nl === 0 && S[e2 + 1].k === "pn" && S[e2 + 1].v === ";") e2++;
          return ownLine(stmtStartTok, e2);
        }
        else if (u.k === "pn" && (u.v === "{" || u.v === "}")) return false;
        else if (u.k === "pn" && u.v === ";" && d <= 0) return ownLine(stmtStartTok, q);
        if (u.nl > 0 && q > k) return false;
      }
      return false;
    }
    /* Chú thích khối nhiều dòng: dời cả khối theo cột mới của dấu mở (giữ thụt tương đối bên trong), kiểu " * " thì canh dấu *. */
    function reindentComment(v, origCol, prefix) {
      if (v.indexOf("\n") < 0) return v;
      var ls = v.split("\n"), allStar = true, q;
      for (q = 1; q < ls.length; q++) { var tr = ls[q].trim(); if (tr && tr.charAt(0) !== "*") allStar = false; }
      for (q = 1; q < ls.length; q++) {
        var raw = ls[q], body = raw.replace(/^\s+/, "").replace(/\s+$/, "");
        if (!body) { ls[q] = ""; continue; }
        if (allStar) { ls[q] = prefix + " " + body; continue; }
        var rel = Math.max(0, adv(0, raw.slice(0, raw.length - raw.replace(/^\s+/, "").length)) - origCol);
        ls[q] = prefix + new Array(rel + 1).join(" ") + body;
      }
      return ls.join("\n");
    }
    function isSelectorColon(k) {                       /* CSS: `a:hover {` — dấu : trước { cùng "câu" là bộ chọn */
      for (var q = k + 1; q < n && q < k + 40; q++) { if (S[q].v === ";" || S[q].v === "}") return false; if (S[q].v === "{") return true; }
      return false;
    }
    function levelFor(k, t) {
      var tp = top(), lv;
      if (t.k === "pp") return 0;
      if (isCloser(t)) { var cf = peekFor(t.v); if (cf) return cf.base; }
      if (t.k === "pn" && t.v === "{" && (t.kind === "block" || t.kind === "switch") && o.braces === "allman") return stmtLevel;
      if (!tp) return stmtOpen && !isLabelStart(k) ? 1 : 0;
      lv = tp.base + (tp.noIndent ? 0 : 1);
      if (tp.kind === "switch") {
        if (isLabelStart(k)) lv = tp.base + (o.indentCase ? 1 : 0);
        else if (tp.caseActive) lv = tp.base + (o.indentCase ? 2 : 1);
      }
      if (tp.isClass && isAccessSpec(k)) lv = tp.base;
      if (stmtOpen && (tp.t === "body" || isBlk(tp)) && !tp.list) lv += 1;
      return lv;
    }

    /* "auto": theo kiểu con trỏ/tham chiếu chiếm đa số trong chính tệp (T* p hay T *p), như DerivePointerAlignment của clang-format */
    if (o.pointer === "auto") {
      var pl = 0, pr = 0;
      for (var q0 = 0; q0 < n; q0++) {
        var si = sigilInfo(q0);
        if (si && si.s === q0) { var bws = S[si.s].ws, aws = !!(S[si.e + 1] && S[si.e + 1].ws); if (!bws && aws) pl++; else if (bws && !aws) pr++; }
      }
      o = Object.assign({}, o, { pointer: pl > pr ? "left" : "right" });
    }

    /* ----------------------------- vòng chính */
    for (i = 0; i < n; i++) {
      var t = S[i], prev = i ? S[i - 1] : null, brk = false, join = false, trailing = false;
      var closer = isCloser(t);

      /* 1. thân không ngoặc của if/for/while/else/do */
      if (needBody && t.k !== "cm" && t.k !== "pp") {
        var nb = needBody; needBody = null;
        if (t.v === "{" || t.v === ";") { /* khối / thân rỗng */ }
        else if (nb === "else" && t.k === "kw" && t.v === "if") join = true;
        else {
          var keepB = (top() && (top().kind === "inline" || top().inline)) || (t.nl === 0 && shortBody(i));
          frames.push({ t: "body", base: stmtLevel, inline: keepB }); stmtOpen = false; head = [];
          if (!keepB) brk = true;
        }
      }
      if (closer) popBodies();

      /* 2. phân loại: `{`, dấu hai chấm, dấu hỏi */
      if (t.k === "pn" && t.v === "{") {
        t.kind = classify(i);
        if (t.kind === "block" && !css) {
          if (INLINE_LANGS[id] && inlineCandidate(i)) t.kind = "inline";
          else if (shortBlock(i)) { t.kind = "inline"; t.stmtBlock = stmtFrame(top()); }    /* trong ngoặc (lambda/callback) thì câu lệnh còn tiếp sau `}` */
        }
        var hk0 = headKw();
        t.spaced = t.kind === "init" && hk0 === "enum";                                   /* enum A { X, Y }; một dòng */
        t.list = t.kind === "block" && (hk0 === "enum" || (id === "rust" && head.indexOf("match") >= 0));   /* phần tử ngăn bằng dấu phẩy */
        t.noIndent = t.kind === "block" && id === "cpp" && hk0 === "namespace" && !o.indentNamespace;
      }
      if (t.k === "pn" && t.v === "}") { var fo = peekFor("}"); if (fo) { t.kind = fo.kind; t.spaced = fo.spaced; } }

      /* 1b. ngôn ngữ không bắt buộc `;` (Go, JS, TS, Kotlin): xuống dòng ngay sau một toán hạng là hết câu lệnh */
      if (ASI_LANGS[id] && i > 0 && t.nl > 0 && stmtOpen && stmtFrame(top()) && t.k !== "cm") {
        var pj = i - 1; while (pj > 0 && S[pj].k === "cm") pj--;
        var pv = S[pj];
        var ends = operandEnd(pj) || (pv.k === "kw" && /^(break|continue|return|fallthrough|this|super|null|true|false|undefined|nil|iota)$/.test(pv.v)) || (pv.k === "op" && (pv.v === "++" || pv.v === "--"));
        var cont = t.k === "op" && !(t.v === "++" || t.v === "--" || t.v === "!" || t.v === "~" || t.v === "<-" || (id === "go" && (t.v === "*" || t.v === "&")));
        if (ends && !cont) { popBodies(); stmtOpen = false; head = []; }
      }
      if (t.k === "op" && t.v === ":") {
        var cx = ctx();
        if (labelPending && frames.length === labelDepth && cx.tern === 0) t.colon = "label";
        else if (head.length === 1 && ACCESS[head[0]] && top() && top().isClass && cx.tern === 0) t.colon = "label";
        else if (cx.tern > 0) { t.colon = "tern"; cx.tern--; }
        else if (css) t.colon = (top() && top().t === "{" && !isSelectorColon(i)) ? "right" : "pseudo";
      }
      if (t.k === "op" && t.v === "?") {
        var nx = S[i + 1];
        var opt = (/^(typescript|csharp|kotlin)$/.test(id) && nx && (nx.v === ":" || nx.v === ")" || nx.v === "," || nx.v === ";" || nx.v === "=" || nx.v === "." || nx.v === "[")) || (prev && prev.k === "ty" && /^(csharp|kotlin)$/.test(id));
        if (opt) t.optional = true; else ctx().tern++;
      }

      /* 3. ngắt dòng hay nối dòng */
      if (i > 0) {
        var prevLC = lineComment(prev), tf = top();
        brk = brk || forceBreak || t.nl > 0 || t.k === "pp" || prev.k === "pp" || prevLC;
        if (t.k === "pn" && t.v === "}" && isBlk(tf)) brk = !(prev.k === "pn" && prev.v === "{" && prev === tf.open);
        if (t.k === "cm" && t.nl === 0 && prev.k !== "pp" && !prevLC) { join = true; trailing = true; }
        if (t.k === "pn" && t.v === "{" && (t.kind === "block" || t.kind === "switch") && prev.k !== "cm" && prev.k !== "pp" && !(prev.k === "pn" && (prev.v === ";" || prev.v === "{" || prev.v === "}"))) {
          if (o.braces === "allman") brk = true; else join = true;
        }
        if (closedBlock && prev.k === "pn" && prev.v === "}") {
          if (t.k === "kw" && (t.v === "else" || t.v === "catch" || t.v === "finally" || (t.v === "while" && closedBlock.isDo))) {
            if (closedBlock.inline) { /* `if (…) { a; }` một dòng rồi `else { b; }` dòng dưới: giữ như người viết */ }
            else if (o.braces === "allman") brk = true; else join = true;
          }
          else if (t.k === "pn" && (t.v === ")" || t.v === "," || t.v === ";" || t.v === "]")) join = true;
          else if (closedBlock.declTail && (t.k === "id" || (t.k === "op" && t.v === "*"))) join = true;
        }
        if (tf && (tf.kind === "inline" || tf.inline) && !(t.k === "pn" && t.v === "}" && tf.kind !== "inline")) join = true;
        if (tf && tf.kind === "inline" && t.k === "pn" && t.v === "}") join = true;
        if (join && t.k !== "pp" && prev.k !== "pp" && !prevLC) brk = false;
      }

      /* 4. bắt đầu dòng mới */
      if (brk && i > 0) {
        endLine();
        var closingEmpty = t.k === "pn" && t.v === "}" && isBlk(top());
        if (t.nl > 1 && !(prev.k === "pn" && prev.v === "{" && prev.kind !== "init") && !closingEmpty) {
          var blank = Math.min(t.nl - 1, o.maxBlank); while (blank-- > 0) out.push("");
        }
        lineLevel = levelFor(i, t);
        if (!stmtOpen && !closer) stmtLevel = lineLevel;
        line = ""; lineEmpty = true;
      }

      /* 5. phát token */
      var text = t.v, sp = 0;
      if (!lineEmpty) {
        if (trailing && t.v.charAt(1) === "*") sp = 1;
        else if (trailing) {                                 /* giữ cột gốc của chú thích cuối dòng nếu còn chỗ (các chú thích canh thẳng hàng vẫn thẳng) */
          var used = adv(0, levelStr(o, lineLevel)) + line.length;
          sp = t.col >= used + o.commentGap && t.col - used <= 80 ? t.col - used : o.commentGap;
        }
        else sp = spaceBefore(i) ? 1 : 0;
        if (prev && prev.k === "cm" && !lineComment(prev)) sp = 1;
      }
      if (t.k === "cm") text = reindentComment(text, t.col, levelStr(o, lineLevel) + (lineEmpty ? "" : new Array(line.length + sp + 1).join(" ")));
      else if (t.k === "pp") text = text.replace(/\s+$/, "");
      line += new Array(sp + 1).join(" ") + text;
      lineEmpty = false;
      if (t.k === "pp") { endLine(); forceBreak = true; continue; }
      if (t.k === "cm") { if (lineComment(t)) forceBreak = true; continue; }
      forceBreak = false;
      closedBlock = null;
      if (!stmtOpen) stmtStartTok = i;

      /* 6. cập nhật trạng thái */
      var v = t.v;
      if (t.k === "pn") {
        if (v === "(") { frames.push({ t: "(", base: lineLevel, ctl: !!(prev && prev.k === "kw" && CTL[prev.v]), tern: 0 }); stmtOpen = true; head.push(v); }
        else if (v === "[") { frames.push({ t: "[", base: lineLevel, tern: 0 }); stmtOpen = true; head.push(v); }
        else if (v === "{") {
          var kd = t.kind, blockish = kd === "block" || kd === "switch";
          var fr = { t: "{", kind: kd, base: blockish ? stmtLevel : lineLevel, tern: 0, caseActive: false, isClass: false, isDo: pendingDo, declTail: false, open: t, spaced: t.spaced, list: t.list, noIndent: t.noIndent, stmtBlock: !!t.stmtBlock };
          if (t.stmtBlock) { var hk1 = headKw(); fr.declTail = cstyle && (head[0] === "typedef" || ((hk1 === "struct" || hk1 === "union" || hk1 === "enum") && head[0] === hk1)); }
          if (blockish) {
            var hk = headKw();
            fr.isClass = hk === "class" || hk === "struct" || hk === "union" || hk === "interface";
            fr.declTail = cstyle && (head[0] === "typedef" || ((hk === "struct" || hk === "union" || hk === "enum") && head[0] === hk));
          }
          pendingDo = false;
          frames.push(fr);
          if (blockish) { stmtOpen = false; head = []; forceBreak = !(S[i + 1] && S[i + 1].k === "pn" && S[i + 1].v === "}"); }
          else { stmtOpen = true; head.push(v); }
        } else if (v === ")" || v === "]") {
          var fc = popFor(v);
          if (fc && fc.ctl && v === ")") needBody = "ctl";
          stmtOpen = true; head.push(v);
        } else if (v === "}") {
          var fb = popFor("}");
          if (fb && (fb.kind === "block" || fb.kind === "switch")) { closedBlock = { isDo: fb.isDo, declTail: fb.declTail }; stmtLevel = fb.base; forceBreak = true; stmtOpen = false; head = []; }
          else if (fb && fb.stmtBlock) { closedBlock = { isDo: fb.isDo, declTail: fb.declTail, inline: true }; t.inlineClose = true; forceBreak = true; stmtOpen = false; head = []; }   /* khối một dòng `{ … }` vẫn kết thúc câu lệnh */
          else { stmtOpen = true; head.push(v); }
          /* `for (…)\n  for (…) { … }`: khối đóng cũng là hết thân không ngoặc của câu điều khiển bên ngoài */
          if (closedBlock && top() && top().t === "body") { var outer = top(); popBodies(); stmtLevel = outer.base; }
        } else if (v === ";") {
          if (top() && top().t === "body") popBodies();
          var tt = top();
          if (stmtFrame(tt)) { forceBreak = true; stmtOpen = false; head = []; }
          else head.push(v);
        } else if (v === ",") {
          var tl = top();
          if (css && !tl) { forceBreak = true; stmtOpen = false; }         /* CSS: mỗi bộ chọn một dòng, không thụt treo */
          else if (tl && tl.list) { stmtOpen = false; head = []; if (id === "rust") forceBreak = true; }
          else head.push(v);
        }
        continue;
      }
      if (t.k === "kw") {
        if (v === "else") needBody = "else";
        else if (v === "do") { needBody = "do"; pendingDo = true; }
        if ((v === "case" || (v === "default" && S[i + 1] && S[i + 1].v === ":")) && head.length === 0) { labelPending = true; labelDepth = frames.length; }
      }
      /* `template <...>` ở đầu khai báo: xuống dòng sau dấu > đóng, phần còn lại là khai báo mới (không thụt treo) */
      if (t.k === "kw" && v === "template" && head.length === 0 && S[i + 1] && S[i + 1].tpl === "open") tplHeadClose = S[i + 1].closeAt;
      if (i === tplHeadClose) { tplHeadClose = -1; forceBreak = true; stmtOpen = false; head = []; continue; }
      if (t.k === "op" && v === ":" && t.colon === "label") {
        forceBreak = true; stmtOpen = false; head = []; labelPending = false;
        var ts = top(); if (ts && ts.kind === "switch" && !(S[i - 1] && ACCESS[S[i - 1].v])) ts.caseActive = true;
        continue;
      }
      head.push(v);
      stmtOpen = true;
    }
    endLine();
    return finish(out, o);
  }

  function finish(lines, o, trimStartBlank) {
    var res = lines.map(function (l) { return l.replace(/[ \t]+$/, ""); });
    while (res.length && res[0] === "") res.shift();
    while (res.length && res[res.length - 1] === "") res.pop();
    var s = res.join("\n");
    return s ? s + (o.finalNewline ? "\n" : "") : "";
  }

  /* ------------------------------------------------------------- Python / Ruby */
  function formatPython(text, L, o) {
    var src = text.replace(/\r\n?/g, "\n"), lines = src.split("\n");
    var toks = CS.tokenize.run(src, L.id);
    var starts = [0], p = 0, q;
    for (q = 0; q < lines.length; q++) { p += lines[q].length + 1; starts.push(p); }
    var inStr = new Array(lines.length).fill(false), depthAt = new Array(lines.length).fill(0), contAt = new Array(lines.length).fill(false);
    var depth = 0, li = 0;
    toks.forEach(function (t) {
      if (t.k === "st" || t.k === "cm") {
        var a = lineOf(t.i), b = lineOf(t.i + t.v.length - 1);
        for (var z = a + 1; z <= b; z++) inStr[z] = true;
      }
    });
    function lineOf(pos) { var lo = 0, hi = lines.length - 1; while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (starts[mid] <= pos) lo = mid; else hi = mid - 1; } return lo; }
    var d = 0, byLine = {};
    toks.forEach(function (t) {
      if (t.k === "nl" || t.k === "ws") return;
      var ln = lineOf(t.i);
      if (!(ln in byLine)) byLine[ln] = d;
      if (t.k === "pn" || t.k === "op") { if (/^[(\[{]$/.test(t.v)) d++; else if (/^[)\]}]$/.test(t.v)) d = Math.max(0, d - 1); }
    });
    for (q = 0; q < lines.length; q++) {
      depthAt[q] = (q in byLine) ? byLine[q] : (q > 0 ? depthAt[q - 1] : 0);
      contAt[q] = q > 0 && /\\\s*$/.test(lines[q - 1]) && !inStr[q - 1];
    }
    var widths = [0], res = [], lastLevel = 0, unit = indentUnit(o);
    function widthOf(s) { var w = 0; for (var c = 0; c < s.length; c++) { var ch = s.charAt(c); if (ch === " ") w++; else if (ch === "\t") w = (Math.floor(w / 8) + 1) * 8; else break; } return w; }
    var blankRun = 0, prevCodeLevel = 0, opening = false;
    var spacedLines = rewriteSpacing(toks, lineOf, L, o, inStr, lines.length);
    for (q = 0; q < lines.length; q++) {
      var raw = lines[q];
      if (inStr[q]) { res.push(raw.replace(/\r$/, "")); blankRun = 0; continue; }
      var body = spacedLines[q] != null ? spacedLines[q] : raw.trim();
      if (!body) { blankRun++; if (blankRun <= o.maxBlank) res.push(""); continue; }
      blankRun = 0;
      var level;
      if (depthAt[q] > 0 || contAt[q]) {
        level = lastLevel + 1;
        if (/^[)\]}]/.test(body)) level = lastLevel;
      } else {
        var w = widthOf(raw);
        if (/^#/.test(body) && !/^#!/.test(body)) {                          /* chú thích riêng dòng: theo mức thụt gốc gần nhất */
          var lv = 0; for (var z = 0; z < widths.length; z++) if (widths[z] <= w) lv = z;
          level = lv;
        } else {
          if (w > widths[widths.length - 1]) widths.push(w);
          else { while (widths.length > 1 && widths[widths.length - 1] > w) widths.pop(); if (widths[widths.length - 1] !== w) widths[widths.length - 1] = w; }
          level = widths.length - 1; lastLevel = level;
        }
      }
      var s2 = ""; for (var u = 0; u < level; u++) s2 += unit;
      res.push(s2 + body);
    }
    return finish(res, o);
  }
  /* Gọn khoảng trắng trong từng dòng Python/Ruby bằng từ tố — chỉ những chỗ chắc chắn: dấu phẩy, dấu hai chấm, toán tử hai ngôi,
     `=` (trong ngoặc gọi hàm Python là đối số tên → không cách, trừ khi có chú thích kiểu `x: int = 1`). Dòng có từ tố nhiều dòng giữ nguyên. */
  function rewriteSpacing(toks, lineOf, L, o, inStr, nLines) {
    var res = new Array(nLines), py = L.id === "python", opn = /^[(\[{]$/, cls = /^[)\]}]$/;
    var PYBIN = CS.langs.set("== != <= >= < > + - * / // % ** @ & | ^ << >> -> := += -= *= /= //= %= **= &= |= ^= <<= >>= @=");
    var sig = toks.filter(function (t) { return t.k !== "ws" && t.k !== "nl"; });
    var cur = [], curLine = -1, skip = false, prev = null, prevPrev = null, br = [], annot = [], k;
    function flush() { if (curLine >= 0) res[curLine] = skip ? null : cur.join("").replace(/\s+$/, ""); cur = []; skip = false; }
    function unaryAt(p) { return !p || (p.k === "kw" && !/^(None|True|False|nil|self|true|false)$/.test(p.v)) || ((p.k === "op" || p.k === "pn") && !cls.test(p.v)); }
    function wordy(t) { return t.k === "id" || t.k === "kw" || t.k === "ty" || t.k === "nu" || t.k === "st" || t.k === "an"; }
    function track(t) {
      if (t.k !== "op" && t.k !== "pn") return;
      if (opn.test(t.v)) { br.push(t.v); annot.push(false); }
      else if (cls.test(t.v)) { br.pop(); annot.pop(); }
      else if (t.v === "," && br[br.length - 1] === "(") annot[annot.length - 1] = false;
      else if (t.v === ":" && br[br.length - 1] === "(") annot[annot.length - 1] = true;
    }
    for (k = 0; k < sig.length; k++) {
      var t = sig[k], ln = lineOf(t.i);
      if (ln !== curLine) { flush(); curLine = inStr[ln] ? -1 : ln; prev = null; prevPrev = null; }
      if (curLine < 0) { track(t); continue; }
      if (t.v.indexOf("\n") >= 0) skip = true;
      var sp = 0;
      if (prev) {
        var a = prev, b = t, av = a.v, bv = b.v, inBr = br.length ? br[br.length - 1] : "", orig = t.i > prev.i + prev.v.length ? 1 : 0;
        var aOp = a.k === "op" || a.k === "pn", bOp = b.k === "op" || b.k === "pn";
        if (b.k === "cm") sp = o.commentGap;
        else if (a.k === "cm") sp = 1;
        else if (aOp && opn.test(av)) sp = 0;
        else if (bOp && cls.test(bv)) sp = 0;
        else if (bOp && (bv === "," || bv === ";")) sp = 0;
        else if (aOp && (av === "," || av === ";")) sp = 1;
        else if (bOp && bv === ":") sp = 0;
        else if (aOp && av === ":") sp = inBr === "[" ? 0 : 1;
        else if ((bOp && bv === ".") || (aOp && av === ".")) sp = 0;
        else if (bOp && (bv === "(" || bv === "[")) sp = (a.k === "id" || a.k === "ty" || a.k === "st" || (aOp && cls.test(av))) ? 0 : 1;
        else if ((bOp && bv === "=") || (aOp && av === "=")) sp = py && inBr === "(" && !annot[annot.length - 1] ? 0 : 1;
        else if (py && bOp && PYBIN[bv]) sp = 1;
        else if (py && aOp && PYBIN[av]) sp = /^(-|\+|\*|\*\*|~)$/.test(av) && unaryAt(prevPrev) ? 0 : 1;
        else if (wordy(a) && wordy(b)) sp = 1;
        else sp = orig;
      }
      cur.push(new Array(sp + 1).join(" ") + t.v);
      track(t);
      prevPrev = prev; prev = t;
    }
    flush();
    return res;
  }


  /* ---------------------------------------------------------------------- SQL */
  function formatSql(text, L, o) {
    var toks = CS.tokenize.run(text, "sql"), out = [], cur = "", clause = ["select", "from", "where", "group", "order", "having", "limit", "offset", "union", "insert", "update", "delete", "values", "set", "join", "inner", "left", "right", "full", "cross", "on", "create", "alter", "drop"];
    var CL = {}; clause.forEach(function (c) { CL[c] = 1; });
    var prevKw = "", depth = 0, first = true;
    var unit = indentUnit(o);
    function push() { if (cur.trim()) out.push(cur.replace(/\s+$/, "")); cur = ""; }
    var sig = toks.filter(function (t) { return t.k !== "ws" && t.k !== "nl"; });
    sig.forEach(function (t, idx) {
      var low = t.v.toLowerCase(), v = t.v;
      if (t.k === "kw" && o.sqlUpper) v = v.toUpperCase();
      if (t.k === "cm") { if (cur.trim()) cur += "  "; cur += v; if (/^--/.test(v)) push(); return; }
      if (t.v === "(") depth++;
      if (t.v === ")") depth = Math.max(0, depth - 1);
      var startsClause = t.k === "kw" && CL[low] && depth === 0 && !(low === "by") && !((low === "inner" || low === "left" || low === "right" || low === "full" || low === "cross" || low === "outer") && prevKw === "join" );
      if (low === "on" && depth === 0 && prevKw !== "join") startsClause = false;
      if ((low === "set" && prevKw === "update") || false) startsClause = true;
      if (startsClause && !(prevKw === "group" || prevKw === "order") && !first) {
        if (low === "inner" || low === "left" || low === "right" || low === "full" || low === "cross" || low === "join") { if (!/^(inner|left|right|full|cross|outer)$/.test(prevKw)) { push(); } }
        else push();
      }
      var sep = "";
      if (cur && !cur.endsWith("(") && t.v !== ")" && t.v !== "," && t.v !== ";" && t.v !== "." && !cur.endsWith(".")) sep = " ";
      if (t.v === "(" && /^(count|sum|avg|min|max|coalesce|ifnull|nullif|cast|concat|length|lower|upper|substr|trim|now|date|round|abs|in|values)$/i.test(cur.split(/[\s(]+/).pop() || "") && cur && !/\s$/.test(cur) === false) sep = cur.match(/\w$/) && /^(in|values|exists|and|or|on|where)$/i.test(cur.split(/[\s(]+/).pop()) ? " " : "";
      if (t.v === "(" && cur.match(/\w$/) && !/^(in|values|exists|and|or|on|where|from|join|select|as|not|by|having|set|into|table|union|all)$/i.test(cur.split(/[\s(]+/).pop())) sep = "";
      cur += sep + v;
      if (t.k === "kw") prevKw = low;
      if (t.v === ";") { push(); out.push(""); }
      first = false;
    });
    push();
    var lines = out.map(function (l, i) { return l; });
    /* thụt các dòng không bắt đầu bằng mệnh đề chính của câu lệnh */
    var res = [], inStmt = false;
    lines.forEach(function (l) {
      if (l === "") { res.push(""); inStmt = false; return; }
      var w = l.split(/\s+/)[0].toLowerCase();
      res.push(/^(select|insert|update|delete|create|alter|drop|with)$/.test(w) || !inStmt ? l : (/^(from|where|group|order|having|limit|offset|union|values|set)$/.test(w) ? l : unit + l));
      inStmt = true;
    });
    return finish(res, o);
  }

  /* ----------------------------------------------------------------- JSON */
  function formatJson(text, L, o) {
    var obj = JSON.parse(text), ind = o.indent === "tab" ? "\t" : (o.indent | 0) || 2;
    return JSON.stringify(obj, null, ind) + (o.finalNewline ? "\n" : "");
  }

  /* ----------------------------------------------------------------- HTML (thụt lại) */
  var VOID = CS.langs.set("area base br col embed hr img input link meta param source track wbr !doctype");
  var INLINE = CS.langs.set("a abbr b bdi bdo cite code data dfn em i kbd mark q s samp small span strong sub sup time u var button label select option textarea");
  function formatHtml(text, L, o) {
    var lines = text.replace(/\r\n?/g, "\n").split("\n"), res = [], level = 0, unit = indentUnit(o), raw = null, blank = 0;
    lines.forEach(function (ln) {
      var s = ln.replace(/\s+$/, "");
      if (raw) {
        if (new RegExp("</" + raw + "\\b", "i").test(s)) { raw = null; level = Math.max(0, level - 1); res.push(levelStr(o, level) + s.trim()); } else res.push(s);
        return;
      }
      var tr = s.trim();
      if (!tr) { blank++; if (blank <= o.maxBlank) res.push(""); return; }
      blank = 0;
      var opens = 0, closes = 0, first = true, leadClose = 0, m, re = /<(\/?)([A-Za-z!][\w:-]*)([^>]*?)(\/?)>/g;
      while ((m = re.exec(tr))) {
        var name = m[2].toLowerCase();
        if (m[1] === "/") { if (first) leadClose++; else closes++; }
        else if (!VOID[name] && m[4] !== "/") { opens++; if (/^(script|style|pre|textarea)$/.test(name) && !new RegExp("</" + name, "i").test(tr.slice(m.index + m[0].length))) raw = name; }
        if (m.index > 0 && first && m[1] === "/" ) { /* đóng giữa dòng: không tính là đầu dòng */ }
        first = false;
      }
      var startsWithClose = /^<\//.test(tr);
      var lvl = Math.max(0, level - (startsWithClose ? 1 : 0));
      res.push(levelStr(o, lvl) + tr);
      level = Math.max(0, level + opens - closes - (startsWithClose ? 1 : 0) + (startsWithClose ? 0 : 0));
      if (raw) { /* thân script/style: giữ thụt gốc ở dòng sau, tăng mức để đóng cân */ level += 0; }
    });
    return finish(res, o);
  }

  /* --------------------------------------------------------- văn bản/shell/md */
  function formatPlain(text, L, o) {
    var lines = text.replace(/\r\n?/g, "\n").split("\n"), res = [], blank = 0;
    lines.forEach(function (l) { l = l.replace(/[ \t]+$/, ""); if (!l) { blank++; if (blank <= o.maxBlank) res.push(""); } else { blank = 0; res.push(l); } });
    return finish(res, o);
  }

  function builtin(text, langId, opts) {
    var L = CS.langs.get(langId), o = withDefaults(L.id, opts), src = String(text == null ? "" : text).replace(/\r\n?/g, "\n");
    switch (L.id) {
      case "python": case "ruby": return formatPython(src, L, o);
      case "json": return formatJson(src, L, o);
      case "sql": return formatSql(src, L, o);
      case "html": return formatHtml(src, L, o);
      case "css": return formatBrace(src, L, o);
      case "bash": case "markdown": case "plaintext": return formatPlain(src, L, o);
      default: return formatBrace(src, L, o);
    }
  }

  /* ------------------------------------------------------ nhà cung cấp + chạy */
  var providers = Object.create(null), order = [];
  function register(p) { if (!providers[p.id]) order.push(p.id); providers[p.id] = p; }
  register({ id: "builtin", label: "Tự viết (có sẵn, tức thì)", kind: "builtin", langs: CS.langs.order.slice(), needsDownload: "", note: "Chạy ngay trên máy bạn, không tải gì. Giữ nguyên từ tố, chỉ đổi khoảng trắng/ngắt dòng.",
    format: function (text, langId, opts) { return Promise.resolve(builtin(text, langId, opts)); } });

  function listFor(langId) { return order.map(function (id) { return providers[id]; }).filter(function (p) { return p.langs.indexOf(langId) >= 0 || p.langs.indexOf("*") >= 0; }); }

  /** Định dạng bằng nhà cung cấp `opts.provider` (mặc định "builtin"); lỗi/không hỗ trợ ngôn ngữ → rơi về builtin và báo. */
  function run(text, langId, opts) {
    opts = opts || {};
    var pid = opts.provider || "builtin", p = providers[pid], note = "";
    function fallback(err) {
      try { return { ok: true, text: builtin(text, langId, opts), provider: "builtin", error: err }; }
      catch (e) { return { ok: false, text: text, provider: "builtin", error: (err ? err + "; " : "") + "Không định dạng được: " + e.message }; }
    }
    if (!p || (p.langs.indexOf(langId) < 0 && p.langs.indexOf("*") < 0)) return Promise.resolve(fallback(p ? "“" + p.label + "” không hỗ trợ ngôn ngữ này — đã dùng bộ tự viết." : "Không có nhà cung cấp “" + pid + "” — đã dùng bộ tự viết."));
    return Promise.resolve().then(function () { return p.format(text, langId, opts); }).then(
      function (s) { return { ok: true, text: s, provider: pid }; },
      function (e) { return pid === "builtin" ? { ok: false, text: text, provider: pid, error: "Không định dạng được: " + (e && e.message ? e.message : e) } : fallback("“" + p.label + "” lỗi (" + (e && e.message ? e.message : e) + ") — đã dùng bộ tự viết."); });
  }

  CS.format = { builtin: builtin, run: run, register: register, listFor: listFor, providers: providers, defaults: defaults, withDefaults: withDefaults };
  if (typeof module !== "undefined" && module.exports) module.exports = CS.format;
})(typeof globalThis !== "undefined" ? globalThis : this);
