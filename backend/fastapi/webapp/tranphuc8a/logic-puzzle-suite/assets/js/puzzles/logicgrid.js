/* puzzles/logicgrid.js — LOGIC GRID (câu đố suy luận kiểu Einstein / Zebra). Engine thuần: không DOM, chạy trong node và Web Worker.

   ── MÔ HÌNH ──────────────────────────────────────────────────────────────────────────────────────────────────────────
   K nhóm (category) × N mục (item), 2 ≤ K ≤ 6, 2 ≤ N ≤ 6. Nhóm 0 là "hàng" (ví dụ Người: An, Bình, Chi). Lời giải = K-1 hoán vị: mỗi mục của
   nhóm j ≥ 1 thuộc về đúng một mục của nhóm 0 ("cùng một nhóm người"). Bộ giải CSP: biến p(j,x) = hàng (mục nhóm 0) của mục x thuộc nhóm j,
   miền 0..N-1, ràng buộc alldiff theo từng nhóm j + mỗi manh mối một ràng buộc `test` (Puz.csp).
   Nhóm CÓ THỨ TỰ (ordered): mỗi mục có một giá trị số (cat.values; mặc định = số trong tên mục nếu toàn số, ngược lại 1..N).

   ── puzzle.data ──────────────────────────────────────────────────────────────────────────────────────────────────────
   { cats: [{ name, items:[chuỗi], ordered:bool, values:[số]|null, kind:"person"|"color"|"job"|…|"" }], clues: [clue…] }
   `kind` suy ra từ tên nhóm (bảng VOCAB) để chọn mẫu câu tiếng Việt; "" = nhóm tự đặt (mẫu chung).

   clue (JSON thuần; ref = [chỉ số nhóm, chỉ số mục]):
     { t:"eq",  a:ref, b:ref }                       a và b CÙNG MỘT NHÓM ("An mặc màu Đỏ").           DSL  An = Đỏ
     { t:"neq", a:ref, b:ref }                       a và b KHÁC nhóm ("An không mặc màu Đỏ").         DSL  An != Đỏ
     { t:"or",  a:ref, list:[ref, ref, …] }          a cùng nhóm với MỘT trong list (list cùng một nhóm, 2..N-1 mục). DSL  An = Đỏ | Xanh
     { t:"lt",     o, a:ref, b:ref }                 giá trị_o(a) < giá trị_o(b)                          DSL  An < Bình   (An left-of Bình)
     { t:"offset", o, a:ref, b:ref, k }              giá trị_o(a) = giá trị_o(b) + k  (k > 0)           DSL  An = Bình + 2
     { t:"next",   o, a:ref, b:ref }                 a, b LIỀN KỀ: hạng (thứ tự theo giá trị) của chúng lệch đúng 1   DSL  An next-to Bình
     { t:"nnext",  o, a:ref, b:ref }                 a, b không liền kề (và khác nhóm)                  DSL  An not-next-to Bình
   NGỮ NGHĨA so sánh (lt/offset/next/nnext): `o` là chỉ số một nhóm có thứ tự; giá trị_o(ref) = giá trị (cats[o].values) của MỤC CỦA NHÓM o
   CÙNG NHÓM với ref (ref thuộc nhóm o thì chính nó). Ví dụ nhóm "Vị trí" (ordered): "An ở bên trái Bình" = lt{o:Vị trí, a:An, b:Bình}: vị trí
   của An nhỏ hơn vị trí của Bình. ref có thể ở nhóm bất kỳ ("người mặc đỏ ở bên trái người nuôi mèo"). DSL không ghi nhóm thì lấy NHÓM CÓ THỨ TỰ
   ĐẦU TIÊN của đề; ghi hậu tố ` @Tên nhóm` để chọn nhóm khác (`An < Bình @Tuổi`). Trong DSL: tên mục không phân biệt hoa thường/dấu; `Nhóm:Mục`
   khi tên mục trùng giữa các nhóm; `Vị trí 2` / `Position 2` = mục "2" của nhóm vị trí; `A > B` = `B < A`; `A = B - k` = `B = A + k`; `|`, `hoặc`, `or`
   ngăn các lựa chọn. type.parseClue(text, data) → {ok, clue|error};  type.formatClue(clue, data) → chuỗi DSL (parse∘format = đồng nhất);  type.clueTextOf(clue, data) → câu tiếng Việt.

   ── state.v (lưới đánh dấu Einstein) ────────────────────────────────────────────────────────────────────────────────
   Với mỗi cặp nhóm (ci < cj) một KHỐI N×N; mục a của nhóm ci (hàng) × mục b của nhóm cj (cột): 0 = chưa biết, 1 = ✓ (cùng nhóm), 2 = ✗ (khác nhóm).
   Khối đánh số theo thứ tự (0,1),(0,2),…,(0,K-1),(1,2),(1,3),…:  blockIdx(ci,cj) = ci·(2K-ci-1)/2 + (cj-ci-1).
   CHỈ SỐ Ô:  i = blockIdx(ci,cj)·N² + a·N + b   (ci<cj; nếu gọi với ci>cj thì hoán đổi cặp (ci,a)↔(cj,b)).  Tổng số ô = K(K-1)/2 · N².
   Tiện ích xuất trên đối tượng loại: type.cellIndex(puzzle,ci,a,cj,b), type.cellInfo(puzzle,i) → {block,ci,cj,a,b,…}, type.blocks(puzzle) → [{ci,cj,base}].
   initial.v toàn 0 (không ô cho sẵn). solution.v: ✓ đúng chỗ, ✗ mọi ô còn lại (mọi khối, kể cả khối không có nhóm 0).
   action (UI → engine):  {k:"set", i, val}  val ∈ 0|1|2 ;  {k:"cycle", i}  vòng 0 → 2 (✗) → 1 (✓) → 0.
   settings.autoRemove: đặt ✓/✗ tự động bổ sung HỆ QUẢ HIỂN NHIÊN trong CÙNG diff (một lần hoàn tác): ✓ → ✗ mọi ô còn lại của hàng/cột trong khối, ✓ bắc cầu
   (A=Đỏ, Đỏ=Chó ⇒ A=Chó), ✗ lan sang mọi cặp cùng nhóm (A≠Chó ⇒ Đỏ≠Chó nếu A=Đỏ). Không ghi đè ô đã có dấu; nếu dấu mới tự mâu thuẫn thì chỉ đặt đúng ô đó.
   check.conflicts (chỉ ô vi phạm LUẬT hiện tại, giải thích được): (a) ✓ mà thành phần ✓ (liên thông qua các khối) có hai mục cùng một nhóm; (b) ✗ nằm giữa hai mục
   mà các ✓ đã nối cùng nhóm; (c) hàng/cột của một khối toàn ✗; (d) ✓ mà bỏ nó đi thì lan truyền ràng buộc (alldiff + MỌI manh mối) hết mâu thuẫn — tức ✓ đó
   (cùng các ✓ khác) vô lý với manh mối. check.solved: các ✓ nối đủ mọi mục nhóm j ≥ 1 vào đúng một mục nhóm 0, phép gán thoả MỌI manh mối, và không còn vi phạm.
   mistakes: đề duy nhất → ✓ vào ô solution là ✗ hoặc ✗ vào ô solution là ✓; đề nhiều nghiệm (meta.multiple) → ô làm cho đề hết nghiệm. Dấu phụ do autoRemove không tính thêm.

   ── GỢI Ý (hint) ───────────────────────────────────────────────────────────────────────────────────────────────────
   hint(puzzle, state, level) → { level, text, why:[…], cells:[chỉ số ô], regions?:{clues:[chỉ số manh mối 0-based], block:{ci,cj}, row}, technique, action?:{k:"set",i,val}, none? }.
   Mục tiêu luôn là MỘT ô thuộc khối nhóm 0 (hàng = mục nhóm 0) chưa đánh dấu. Nếu đang có dấu sai (khác solution; đề nhiều nghiệm: dấu làm đề hết nghiệm) thì nói trước:
   mức 1 = tô cả khối chứa ô sai, mức 2 = chỉ ô đó, mức 3 = action {set, val:0} xoá dấu + why. Ngược lại: mức 1 = "hãy đọc manh mối k…" (cells = hàng của mục nhóm 0 trong khối),
   mức 2 = chỉ ra ô (cells = [ô]) và manh mối dùng nhưng KHÔNG nói ✓/✗, mức 3 = action {set, val:1|2} + why (nhật ký suy luận, cắt lát chỉ giữ bước góp vào kết luận).
   Bậc kỹ thuật (technique): "Loại trừ trong lưới" (chỉ từ các dấu) → "Một manh mối" → "Kết hợp nhiều manh mối" (tập manh mối đã rút gọn) → "Giả định rồi bác bỏ" → "Thử-sai".
   Lan truyền = csp.propagate + "chỉ còn một chỗ" của alldiff; tìm kiếm = solveP (chỉ phân nhánh trên biến thật; csp.solve phân nhánh cả biến phụ nên dễ sa lầy).

   ── ĐỘ KHÓ (điểm 0–10) ─────────────────────────────────────────────────────────────────────────────────────────────
   Mô phỏng người giải (simulate): quét từng manh mối một cùng kiến thức đã có (alldiff, "chỉ còn một chỗ") tới khi hết tiến triển → "trực tiếp" (đếm số LƯỢT QUÉT = độ sâu);
   bế tắc thì dùng MỌI manh mối cùng lúc → "chuỗi"; bế tắc nữa thì giả định-và-bác-bỏ (mỗi lần một khả năng, ưu tiên biến ít khả năng nhất) → "phản chứng"; cuối cùng quay lui.
   score = 0.35·(K-2) + 0.45·(N-2)   (cỡ)
         + 2.4·(0.8·#hoặc + 1.0·#thứ-tự)/#manh-mối   (độ phức tạp loại manh mối)
         + 0.35·min(10, lượt quét)
         + min(3, 0.9·log2(1 + #phản-chứng + 2·#chuỗi))   + min(2, 0.3·log2(1 + #nút-quay-lui)).
   Ngân sách công việc của mô phỏng tính bằng Σ N^bậc ràng buộc (WORK_CAP) — tất định, không dùng đồng hồ; hết ngân sách thì ước lượng phần còn lại bằng một lần quay lui nhỏ.
   Sinh đề: attempt() chọn lời giải, thêm manh mối đúng (cắt nhiều nhất hoặc YẾU nhất tuỳ núm h) tới khi duy nhất rồi tỉa; generate() thử tối đa 60 lần theo lịch núm SCHED[cỡ][bậc]
   (hiệu chỉnh bằng đo thật) và nhận lần đầu tiên rơi đúng bậc; nếu hết lần thử thì trả bản gần nhất, ghi puzzle.tier = bậc thật theo điểm.
*/
(function (root) {
  "use strict";
  var Puz = root.Puz || (root.Puz = {});
  var R = Puz.rng, U = Puz.util, C = Puz.csp;

  var MAX_CATS = 6, MAX_ITEMS = 6, MAX_CLUES = 200, MAX_NODES = 40000;
  var CLUE_TYPES = ["eq", "neq", "or", "lt", "offset", "next", "nnext"];
  var BAD_CHARS = /[=<>!|@,≠]/;

  // ═══════════════════════════════════════════════════════════════════ 0. tiện ích
  function fold(s) {
    s = String(s == null ? "" : s).toLowerCase();
    try { s = s.normalize("NFD").replace(/[̀-ͯ]/g, ""); } catch (e) { /* môi trường không có normalize */ }
    return s.replace(/đ/g, "d").replace(/\s+/g, " ").trim();
  }
  function cleanName(x) { return String(x == null ? "" : x).replace(/\s+/g, " ").trim(); }
  function isInt(x) { return typeof x === "number" && isFinite(x) && Math.floor(x) === x; }
  function cap(s) { s = String(s); return s.charAt(0).toUpperCase() + s.slice(1); }
  function lc(s) { return String(s).toLowerCase(); }
  function joinOr(list) {
    if (list.length <= 1) return list.join("");
    if (list.length === 2) return list[0] + " hoặc " + list[1];
    return list.slice(0, -1).join(", ") + " hoặc " + list[list.length - 1];
  }
  function joinAnd(list) {
    if (list.length <= 1) return list.join("");
    if (list.length === 2) return list[0] + " và " + list[1];
    return list.slice(0, -1).join(", ") + " và " + list[list.length - 1];
  }
  function zeros(n) { var a = [], i; for (i = 0; i < n; i++) a.push(0); return a; }
  function range(n) { var a = [], i; for (i = 0; i < n; i++) a.push(i); return a; }
  function pcount(x) { return U.popcount(x >>> 0); }
  function numStr(x) { return String(Math.round(x * 1e6) / 1e6); }

  // ═══════════════════════════════════════════════════════════════════ 1. từ vựng (tiếng Việt)
  /* Mỗi "kind" có: tên nhóm, mẫu động từ (pos/neg, {x} là mục), và kho từ ≥ 8 mục (chọn theo seed). Nhóm có thứ tự (position, age) sinh mục theo cỡ. */
  var VOCAB = {
    person: { name: "Người", pos: "là {x}", neg: "không phải là {x}", pool: ["An", "Bình", "Chi", "Dũng", "Giang", "Hà", "Khoa", "Lan", "Minh", "Nam", "Oanh", "Phúc"] },
    color: { name: "Màu", pos: "mặc màu {x}", neg: "không mặc màu {x}", pool: ["Đỏ", "Xanh dương", "Xanh lá", "Vàng", "Tím", "Cam", "Hồng", "Trắng"] },
    job: { name: "Nghề", pos: "làm nghề {x}", neg: "không làm nghề {x}", pool: ["Bác sĩ", "Kỹ sư", "Giáo viên", "Đầu bếp", "Nhạc sĩ", "Luật sư", "Nhà báo", "Kiến trúc sư"] },
    pet: { name: "Thú cưng", pos: "nuôi {x}", neg: "không nuôi {x}", pool: ["Mèo", "Chó", "Thỏ", "Chim", "Cá", "Rùa", "Hamster", "Vẹt"] },
    drink: { name: "Đồ uống", pos: "uống {x}", neg: "không uống {x}", pool: ["Trà", "Cà phê", "Sữa", "Nước cam", "Nước dừa", "Sinh tố", "Nước chanh", "Soda"] },
    city: { name: "Thành phố", pos: "sống ở {x}", neg: "không sống ở {x}", pool: ["Hà Nội", "Huế", "Đà Nẵng", "Đà Lạt", "Hải Phòng", "Cần Thơ", "Nha Trang", "Vũng Tàu"] },
    hobby: { name: "Sở thích", pos: "thích {x}", neg: "không thích {x}", pool: ["Đọc sách", "Bơi lội", "Vẽ tranh", "Chụp ảnh", "Nấu ăn", "Chơi cờ", "Leo núi", "Làm vườn"] },
    vehicle: { name: "Phương tiện", pos: "đi {x}", neg: "không đi {x}", pool: ["Xe đạp", "Xe máy", "Ô tô", "Tàu hỏa", "Xe buýt", "Thuyền", "Máy bay", "Xe điện"] },
    position: { name: "Vị trí", pos: "ở vị trí {x}", neg: "không ở vị trí {x}", ordered: true },
    age: { name: "Tuổi", pos: "{x} tuổi", neg: "không phải {x} tuổi", ordered: true }
  };
  var PLAIN_KINDS = ["color", "job", "pet", "drink", "city", "hobby", "vehicle"];
  var KIND_BY_NAME = {};
  (function () {
    Object.keys(VOCAB).forEach(function (k) { KIND_BY_NAME[fold(VOCAB[k].name)] = k; });
    var alias = { color: "color", colour: "color", job: "job", profession: "job", pet: "pet", drink: "drink", city: "city", hobby: "hobby", position: "position", pos: "position",
      age: "age", person: "person", people: "person", name: "person", vehicle: "vehicle", "mau sac": "color", "nghe nghiep": "job", "do uong": "drink", "vi tri": "position" };
    Object.keys(alias).forEach(function (a) { KIND_BY_NAME[a] = alias[a]; });
  })();
  function kindOfName(name) { return KIND_BY_NAME[fold(name)] || ""; }

  /** Động từ của mục `ref` (mẫu theo nhóm của nó). neg = phủ định; xText thay cho tên mục (danh sách "A hoặc B"). */
  function vp(data, ref, neg, xText) {
    var cat = data.cats[ref[0]], v = VOCAB[cat.kind], x = xText != null ? xText : cat.items[ref[1]];
    var tpl = v ? (neg ? v.neg : v.pos) : (neg ? "không có " + lc(cat.name) + " là {x}" : "có " + lc(cat.name) + " là {x}");
    return tpl.replace("{x}", function () { return x; });
  }
  function noun0(data) { var c = data.cats[0]; return c.kind === "person" ? "người" : lc(c.name); }
  function refPhrase(data, ref) {
    if (ref[0] === 0) return data.cats[0].items[ref[1]];
    return noun0(data) + " " + vp(data, ref, false);
  }

  // ═══════════════════════════════════════════════════════════════════ 2. chuẩn hoá nhóm
  function defaultValues(items) {
    var nums = items.map(function (s) { return /^-?\d+(\.\d+)?$/.test(String(s).trim()) ? Number(s) : NaN; }), ok = nums.every(function (x) { return isFinite(x); });
    if (ok) { var seen = {}; nums.forEach(function (x) { seen[x] = 1; }); if (Object.keys(seen).length === nums.length) return nums; }
    return items.map(function (_, i) { return i + 1; });
  }
  function normalizeCats(raw, errors, warnings) {
    if (!Array.isArray(raw)) { errors.push("Thiếu danh sách nhóm (cats)."); return null; }
    if (raw.length < 2 || raw.length > MAX_CATS) { errors.push("Cần từ 2 đến " + MAX_CATS + " nhóm (hiện có " + raw.length + ")."); return null; }
    var cats = [], N = -1, names = {}, ok = true;
    raw.forEach(function (rc, c) {
      var tag = "Nhóm " + (c + 1) + (rc && rc.name ? " («" + cleanName(rc.name) + "»)" : "") + ": ";
      if (!rc || typeof rc !== "object") { errors.push("Nhóm " + (c + 1) + " không hợp lệ."); ok = false; return; }
      var name = cleanName(rc.name);
      if (!name) { errors.push(tag + "chưa có tên."); ok = false; }
      else if (name.length > 40) { errors.push(tag + "tên quá dài (tối đa 40 ký tự)."); ok = false; }
      else if (BAD_CHARS.test(name)) { errors.push(tag + "tên chứa ký tự không dùng được (= < > ! | @ ,)."); ok = false; }
      else if (names[fold(name)]) { errors.push(tag + "trùng tên với một nhóm khác."); ok = false; }
      names[fold(name)] = 1;
      if (!Array.isArray(rc.items)) { errors.push(tag + "thiếu danh sách mục (items)."); ok = false; return; }
      var items = [], seen = {}, bad = false;
      rc.items.forEach(function (x) {
        var s = cleanName(typeof x === "number" ? String(x) : x);
        if (typeof x !== "string" && typeof x !== "number") { errors.push(tag + "có mục không phải chữ."); bad = true; return; }
        if (!s) { errors.push(tag + "có mục trống."); bad = true; return; }
        if (s.length > 40) { errors.push(tag + "mục «" + s.slice(0, 20) + "…» quá dài (tối đa 40 ký tự)."); bad = true; return; }
        if (BAD_CHARS.test(s)) { errors.push(tag + "mục «" + s + "» chứa ký tự không dùng được (= < > ! | @ ,)."); bad = true; return; }
        if (seen[fold(s)]) { errors.push(tag + "mục «" + s + "» bị trùng trong nhóm."); bad = true; return; }
        seen[fold(s)] = 1; items.push(s);
      });
      if (bad) { ok = false; return; }
      if (items.length < 2 || items.length > MAX_ITEMS) { errors.push(tag + "cần từ 2 đến " + MAX_ITEMS + " mục (hiện có " + items.length + ")."); ok = false; return; }
      if (N < 0) N = items.length;
      else if (items.length !== N) { errors.push(tag + "có " + items.length + " mục, khác nhóm đầu (" + N + " mục): mọi nhóm phải cùng số mục."); ok = false; return; }
      var ordered = rc.ordered === true || rc.ordered === 1 || rc.ordered === "true", values = null;
      if (ordered) {
        if (rc.values != null) {
          if (!Array.isArray(rc.values) || rc.values.length !== items.length) { errors.push(tag + "values phải là mảng " + items.length + " số."); ok = false; return; }
          var vs = rc.values.map(function (x) { return typeof x === "string" && x.trim() !== "" ? Number(x) : x; });
          if (!vs.every(function (x) { return typeof x === "number" && isFinite(x); })) { errors.push(tag + "values phải toàn số."); ok = false; return; }
          var sv = {}; vs.forEach(function (x) { sv[x] = 1; });
          if (Object.keys(sv).length !== vs.length) { errors.push(tag + "values phải khác nhau từng đôi."); ok = false; return; }
          values = vs;
        } else values = defaultValues(items);
      }
      cats.push({ name: name, items: items, ordered: ordered, values: values, kind: kindOfName(name) });
    });
    if (!ok) return null;
    var dup = {};
    cats.forEach(function (cat, c) { cat.items.forEach(function (s) { var f = fold(s); (dup[f] = dup[f] || []).push(c); }); });
    Object.keys(dup).forEach(function (f) {
      if (dup[f].length > 1) {
        var nm = []; dup[f].forEach(function (c) { nm.push("«" + cats[c].name + "»"); });
        warnings.push("Tên mục «" + f + "» có ở nhiều nhóm (" + nm.join(", ") + "): trong dạng DSL hãy viết Nhóm:Mục.");
      }
    });
    return cats;
  }

  // ═══════════════════════════════════════════════════════════════════ 3. manh mối: dựng, chuẩn hoá, kiểm
  function normRef(r, data) {
    if (!Array.isArray(r) || r.length !== 2 || !isInt(r[0]) || !isInt(r[1])) return null;
    var cat = data.cats[r[0]];
    if (!cat || r[1] < 0 || r[1] >= cat.items.length) return null;
    return [r[0], r[1]];
  }
  function mkClue(t, a, b, o, k, list) {
    if (t === "or") return { t: "or", a: a, list: list };
    if (t === "eq" || t === "neq") return { t: t, a: a, b: b };
    if (t === "offset") return { t: "offset", o: o, a: a, b: b, k: k };
    return { t: t, o: o, a: a, b: b };
  }
  function normalizeClue(c, data, errs) {
    var N = data.cats[0].items.length, K = data.cats.length;
    function bad(msg) { errs.push(msg); return null; }
    if (!c || typeof c !== "object" || CLUE_TYPES.indexOf(c.t) < 0) return bad("Loại manh mối không hợp lệ.");
    var a = normRef(c.a, data), b, t = c.t;
    if (!a) return bad("Vế trái (a) không hợp lệ.");
    if (t === "or") {
      if (!Array.isArray(c.list) || c.list.length < 2 || c.list.length > N - 1) return bad("«Hoặc» cần danh sách từ 2 đến " + (N - 1) + " mục.");
      var list = [], seen = {}, i;
      for (i = 0; i < c.list.length; i++) {
        var r = normRef(c.list[i], data);
        if (!r) return bad("Danh sách «hoặc» có mục không hợp lệ.");
        if (r[0] !== (list.length ? list[0][0] : r[0])) return bad("Mọi mục trong danh sách «hoặc» phải cùng một nhóm.");
        if (seen[r[1]]) return bad("Danh sách «hoặc» có mục lặp.");
        seen[r[1]] = 1; list.push(r);
      }
      if (list[0][0] === a[0]) return bad("Hai vế cùng một nhóm nên manh mối vô nghĩa.");
      return mkClue("or", a, null, null, null, list);
    }
    b = normRef(c.b, data);
    if (!b) return bad("Vế phải (b) không hợp lệ.");
    if (t === "eq" || t === "neq") {
      if (a[0] === b[0]) return bad("Hai vế cùng một nhóm («" + data.cats[a[0]].name + "») nên manh mối vô nghĩa.");
      return mkClue(t, a, b);
    }
    var O = c.o;
    if (!isInt(O) || O < 0 || O >= K || !data.cats[O].ordered) return bad("Phép so sánh cần một nhóm có thứ tự (o).");
    if (a[0] === b[0] && a[1] === b[1]) return bad("Hai vế là cùng một mục.");
    if (t === "offset") {
      var k = Number(c.k);
      if (!isFinite(k) || k === 0) return bad("Độ lệch k phải là số khác 0.");
      if (k < 0) { var tmp = a; a = b; b = tmp; k = -k; }
      return mkClue("offset", a, b, O, k);
    }
    return mkClue(t, a, b, O);
  }
  function normalizeData(raw, errors, warnings) {
    if (!raw || typeof raw !== "object") { errors.push("Thiếu dữ liệu đề."); return null; }
    var cats = normalizeCats(raw.cats, errors, warnings);
    if (!cats) return null;
    var data = { cats: cats, clues: [] }, rc = raw.clues == null ? [] : raw.clues;
    if (!Array.isArray(rc)) { errors.push("Danh sách manh mối (clues) phải là mảng."); return null; }
    if (rc.length > MAX_CLUES) { errors.push("Tối đa " + MAX_CLUES + " manh mối."); return null; }
    var seen = {};
    rc.forEach(function (c, k) {
      var label = "Manh mối " + (k + 1) + ": ", cl = null;
      if (typeof c === "string") { var r = parseClue(c, data); if (!r.ok) { errors.push(label + r.error); return; } cl = r.clue; }
      else if (c && typeof c === "object") { var e2 = []; cl = normalizeClue(c, data, e2); if (!cl) { errors.push(label + e2[0]); return; } }
      else { errors.push(label + "không phải chuỗi hay đối tượng."); return; }
      var key = JSON.stringify(cl);
      if (seen[key] != null) warnings.push(label + "trùng với manh mối " + (seen[key] + 1) + ".");
      else seen[key] = k;
      data.clues.push(cl);
    });
    return data;
  }

  /** Lời giải dạng hàng: S.rows[c][i] = hàng của mục i nhóm c (rows[0] = đơn vị); S.inv[c][r] = mục của nhóm c ở hàng r. */
  function mkSol(K, N, rows) {
    var inv = [], c, i;
    for (c = 0; c < K; c++) { inv.push(new Array(N)); for (i = 0; i < N; i++) inv[c][rows[c][i]] = i; }
    return { rows: rows, inv: inv };
  }
  function rankIn(vals, x) { var r = 0, i; for (i = 0; i < vals.length; i++) if (vals[i] < vals[x]) r++; return r; }
  /** Nguồn chân lý của một manh mối đối với một phép gán (độc lập với bộ giải CSP). */
  function evalClue(data, S, cl) {
    var rowA = S.rows[cl.a[0]][cl.a[1]], i;
    if (cl.t === "eq") return rowA === S.rows[cl.b[0]][cl.b[1]];
    if (cl.t === "neq") return rowA !== S.rows[cl.b[0]][cl.b[1]];
    if (cl.t === "or") { for (i = 0; i < cl.list.length; i++) if (rowA === S.rows[cl.list[i][0]][cl.list[i][1]]) return true; return false; }
    var O = cl.o, vals = data.cats[O].values, ia = S.inv[O][rowA], ib = S.inv[O][S.rows[cl.b[0]][cl.b[1]]];
    if (cl.t === "lt") return vals[ia] < vals[ib];
    if (cl.t === "offset") return Math.abs(vals[ia] - vals[ib] - cl.k) < 1e-9;
    var d = Math.abs(rankIn(vals, ia) - rankIn(vals, ib));
    return cl.t === "next" ? d === 1 : d !== 1;
  }
  function evalAll(data, S) { for (var k = 0; k < data.clues.length; k++) if (!evalClue(data, S, data.clues[k])) return false; return true; }

  // ── câu tiếng Việt ─────────────────────────────────────────────────────────────────────────────────────────────────
  function eqSentence(data, a, objs, neg) {
    var cb = objs[0][0], x = joinOr(objs.map(function (r) { return data.cats[r[0]].items[r[1]]; }));
    var subj = a[0] === 0 ? data.cats[0].items[a[1]] : refPhrase(data, a);
    if (cb === 0) return subj + (neg ? " không phải là " : " là ") + x;
    return subj + " " + vp(data, objs[0], neg, x);
  }
  function cmpSentence(data, cl) {
    var cat = data.cats[cl.o], A = refPhrase(data, cl.a), B = refPhrase(data, cl.b), nm = lc(cat.name), kd = cat.kind;
    if (cl.t === "lt") return kd === "position" ? A + " ở bên trái " + B : kd === "age" ? A + " ít tuổi hơn " + B : nm + " của " + A + " nhỏ hơn " + nm + " của " + B;
    if (cl.t === "offset") {
      var k = numStr(cl.k);
      return kd === "position" ? A + " ở bên phải " + B + " đúng " + k + " vị trí" : kd === "age" ? A + " nhiều tuổi hơn " + B + " đúng " + k + " tuổi" : nm + " của " + A + " lớn hơn " + nm + " của " + B + " đúng " + k;
    }
    if (cl.t === "next") return kd === "position" ? A + " ở ngay cạnh " + B : kd === "age" ? "tuổi của " + A + " và " + B + " liền kề nhau" : nm + " của " + A + " và " + B + " liền kề nhau";
    return kd === "position" ? A + " không ở cạnh " + B : kd === "age" ? "tuổi của " + A + " và " + B + " không liền kề nhau" : nm + " của " + A + " và " + B + " không liền kề nhau";
  }
  function clueText(data, cl) {
    if (!cl) return "";
    if (cl.t === "eq") return cap(eqSentence(data, cl.a, [cl.b], false));
    if (cl.t === "neq") return cap(eqSentence(data, cl.a, [cl.b], true));
    if (cl.t === "or") return cap(eqSentence(data, cl.a, cl.list, false));
    return cap(cmpSentence(data, cl));
  }

  // ── DSL ───────────────────────────────────────────────────────────────────────────────────────────────────────────
  function findCat(data, s) { var f = fold(s), c; for (c = 0; c < data.cats.length; c++) if (fold(data.cats[c].name) === f) return c; return -1; }
  function findItem(cat, s) { var f = fold(s), i; for (i = 0; i < cat.items.length; i++) if (fold(cat.items[i]) === f) return i; return -1; }
  function defaultOrd(data) { for (var c = 0; c < data.cats.length; c++) if (data.cats[c].ordered) return c; return -1; }
  function refToken(data, ref) {
    var name = data.cats[ref[0]].items[ref[1]], f = fold(name), dup = false, c, i;
    for (c = 0; c < data.cats.length; c++) for (i = 0; i < data.cats[c].items.length; i++) if (!(c === ref[0] && i === ref[1]) && fold(data.cats[c].items[i]) === f) dup = true;
    if (dup) return data.cats[ref[0]].name + ":" + name;
    return /^-?\d+(\.\d+)?$/.test(name) ? data.cats[ref[0]].name + " " + name : name;     // mục toàn số: "Vị trí 2", "Tuổi 30" cho dễ đọc
  }
  function formatClue(data, cl) {
    if (!cl) return "";
    var A = refToken(data, cl.a), suf = cl.o != null && cl.o !== defaultOrd(data) ? " @" + data.cats[cl.o].name : "";
    if (cl.t === "eq") return A + " = " + refToken(data, cl.b);
    if (cl.t === "neq") return A + " != " + refToken(data, cl.b);
    if (cl.t === "or") return A + " = " + cl.list.map(function (r) { return refToken(data, r); }).join(" | ");
    var B = refToken(data, cl.b);
    if (cl.t === "lt") return A + " < " + B + suf;
    if (cl.t === "offset") return A + " = " + B + " + " + numStr(cl.k) + suf;
    if (cl.t === "next") return A + " next-to " + B + suf;
    return A + " not-next-to " + B + suf;
  }
  function resolveRef(data, str) {
    var s = cleanName(str), f = fold(s), cats = data.cats, c, i, hits = [];
    if (!s) return { error: "Thiếu tên mục." };
    var col = s.indexOf(":");
    if (col > 0) {
      var cn = findCat(data, s.slice(0, col));
      if (cn >= 0) {
        var it = findItem(cats[cn], s.slice(col + 1));
        return it >= 0 ? { ref: [cn, it] } : { error: "Nhóm «" + cats[cn].name + "» không có mục «" + cleanName(s.slice(col + 1)) + "»." };
      }
    }
    for (c = 0; c < cats.length; c++) for (i = 0; i < cats[c].items.length; i++) if (fold(cats[c].items[i]) === f) hits.push([c, i]);
    if (hits.length === 1) return { ref: hits[0] };
    if (hits.length > 1) return { error: "Tên «" + s + "» có ở nhiều nhóm (" + hits.map(function (h) { return "«" + cats[h[0]].name + "»"; }).join(", ") + "): viết dạng Nhóm:Mục." };
    for (c = 0; c < cats.length; c++) {
      var cf = fold(cats[c].name);
      if (f.indexOf(cf + " ") === 0) { var rest = f.slice(cf.length + 1), j = findItem(cats[c], rest); if (j >= 0) return { ref: [c, j] }; }
    }
    var al = /^(position|pos|vi tri) (.+)$/.exec(f);
    if (al) {
      var pc = -1; for (c = 0; c < cats.length; c++) if (cats[c].kind === "position") { pc = c; break; }
      if (pc < 0) pc = defaultOrd(data);
      if (pc >= 0) { var jj = findItem(cats[pc], al[2]); if (jj >= 0) return { ref: [pc, jj] }; }
    }
    var all = []; cats.forEach(function (cat) { cat.items.forEach(function (x) { all.push(x); }); });
    return { error: "Không tìm thấy mục «" + s + "». Các mục có sẵn: " + all.slice(0, 14).join(", ") + (all.length > 14 ? "…" : "") + "." };
  }
  var OP_RE = /\s*(<>|!=|≠|==|<=|>=|<|>|=)\s*|\s+(not-next-to|!next-to|next-to|left-of|right-of|before|after)\s+/i;
  function parseClue(text, data) {
    try { return parseClueInner(text, data); } catch (e) { return { ok: false, error: "Không đọc được manh mối." }; }
  }
  function parseClueInner(text, data) {
    function fail(msg) { return { ok: false, error: msg }; }
    var s = cleanName(text);
    if (!s) return fail("Manh mối trống.");
    if (!data || !Array.isArray(data.cats) || !data.cats.length) return fail("Chưa có nhóm nào để đối chiếu tên mục.");
    var oSel = -1, m = /^(.*?)\s*@\s*(.+)$/.exec(s);
    if (m) {
      s = cleanName(m[1]); oSel = findCat(data, m[2]);
      if (oSel < 0) return fail("Không có nhóm «" + cleanName(m[2]) + "» (sau dấu @).");
    } else {
      var mb = /^(.*\S)\s+(?:by|theo)\s+(.+)$/i.exec(s);
      if (mb) { var cc = findCat(data, mb[2]); if (cc >= 0) { s = cleanName(mb[1]); oSel = cc; } }
    }
    var mm = OP_RE.exec(s);
    if (!mm) return fail("Thiếu phép toán: dùng =, !=, <, >, next-to, left-of… (ví dụ: An != Đỏ).");
    var tok = (mm[1] || mm[2]).toLowerCase(), left = cleanName(s.slice(0, mm.index)), right = cleanName(s.slice(mm.index + mm[0].length));
    if (!left || !right) return fail("Thiếu vế trái hoặc vế phải quanh «" + tok + "».");
    if (tok === "<=" || tok === ">=") return fail("Chưa hỗ trợ ≤ và ≥: hãy dùng < hoặc > (so sánh chặt).");
    var ra = resolveRef(data, left);
    if (ra.error) return fail(ra.error);
    function ordCat() {
      var O = oSel >= 0 ? oSel : defaultOrd(data);
      if (O < 0) return { error: "Đề chưa có nhóm nào có thứ tự (ordered) nên không dùng được phép so sánh «" + tok + "»." };
      if (!data.cats[O].ordered) return { error: "Nhóm «" + data.cats[O].name + "» không có thứ tự nên không dùng được phép so sánh «" + tok + "»." };
      return { O: O };
    }
    var errs = [], cl;
    if (tok === "=" || tok === "==") {
      var alts = right.split(/\s*\|\s*|\s+(?:hoặc|or)\s+/i).map(cleanName).filter(function (x) { return x; });
      if (alts.length > 1) {
        var list = [], i;
        for (i = 0; i < alts.length; i++) { var rr = resolveRef(data, alts[i]); if (rr.error) return fail(rr.error); list.push(rr.ref); }
        cl = normalizeClue({ t: "or", a: ra.ref, list: list }, data, errs);
        return cl ? { ok: true, clue: cl } : fail(errs[0]);
      }
      var rb = resolveRef(data, right);
      if (!rb.error) {
        cl = normalizeClue({ t: "eq", a: ra.ref, b: rb.ref }, data, errs);
        return cl ? { ok: true, clue: cl } : fail(errs[0]);
      }
      var mo = /^(.*\S)\s*([+-])\s*(\d+(?:\.\d+)?)$/.exec(right);
      if (mo) {
        var rbase = resolveRef(data, mo[1]);
        if (rbase.error) return fail(rbase.error);
        var oc = ordCat();
        if (oc.error) return fail(oc.error);
        var k = Number(mo[3]);
        cl = mo[2] === "+" ? normalizeClue({ t: "offset", o: oc.O, a: ra.ref, b: rbase.ref, k: k }, data, errs) : normalizeClue({ t: "offset", o: oc.O, a: rbase.ref, b: ra.ref, k: k }, data, errs);
        return cl ? { ok: true, clue: cl } : fail(errs[0]);
      }
      return fail(rb.error);
    }
    if (tok === "!=" || tok === "<>" || tok === "≠") {
      if (/\s*\|\s*/.test(right)) return fail("«!=» chỉ nhận một mục bên phải; muốn loại nhiều mục hãy viết mỗi mục một dòng.");
      var rn = resolveRef(data, right);
      if (rn.error) return fail(rn.error);
      cl = normalizeClue({ t: "neq", a: ra.ref, b: rn.ref }, data, errs);
      return cl ? { ok: true, clue: cl } : fail(errs[0]);
    }
    var rc = resolveRef(data, right);
    if (rc.error) return fail(rc.error);
    var o2 = ordCat();
    if (o2.error) return fail(o2.error);
    if (tok === "<" || tok === "before" || tok === "left-of") cl = normalizeClue({ t: "lt", o: o2.O, a: ra.ref, b: rc.ref }, data, errs);
    else if (tok === ">" || tok === "after" || tok === "right-of") cl = normalizeClue({ t: "lt", o: o2.O, a: rc.ref, b: ra.ref }, data, errs);
    else if (tok === "next-to") cl = normalizeClue({ t: "next", o: o2.O, a: ra.ref, b: rc.ref }, data, errs);
    else cl = normalizeClue({ t: "nnext", o: o2.O, a: ra.ref, b: rc.ref }, data, errs);
    return cl ? { ok: true, clue: cl } : fail(errs[0]);
  }

  // ═══════════════════════════════════════════════════════════════════ 4. mô hình CSP
  function compile(srcs, fn) {
    var names = [], pos = {}, idx = [], cst = [], n = srcs.length, i;
    for (i = 0; i < n; i++) {
      var s = srcs[i];
      if (s.v != null) { if (pos[s.v] == null) { pos[s.v] = names.length; names.push(s.v); } idx.push(pos[s.v]); cst.push(0); }
      else { idx.push(-1); cst.push(s.c); }
    }
    var args = new Array(n);
    function test(vals) { for (var j = 0; j < n; j++) args[j] = idx[j] >= 0 ? vals[idx[j]] : cst[j]; return fn(args); }
    return { vars: names, test: test };
  }
  function pName(c, i) { return "p" + c + "_" + i; }
  function buildModel(data) {
    var cats = data.cats, K = cats.length, N = cats[0].items.length, pvars = [], alld = [], c, i;
    for (c = 1; c < K; c++) {
      var vs = [];
      for (i = 0; i < N; i++) { pvars.push({ name: pName(c, i), size: N, labels: cats[0].items }); vs.push(pName(c, i)); }
      alld.push({ kind: "alldiff", vars: vs, label: "mỗi mục của nhóm «" + cats[c].name + "» thuộc về một " + noun0(data) + " khác nhau", meta: { kind: "alldiff", cat: c } });
    }
    var model = { data: data, K: K, N: N, nV: (K - 1) * N, pvars: pvars, alldiff: alld, modules: [] };
    data.clues.forEach(function (cl, k) { model.modules.push(clueModule(model, cl, k)); });
    return model;
  }
  function clueModule(model, cl, k) {
    var data = model.data, N = model.N, mod = { dvars: [], cons: [], constant: null }, meta = { kind: "clue", k: k }, label = "manh mối " + (k + 1);
    function rowSrc(ref) { return ref[0] === 0 ? { c: ref[1] } : { v: pName(ref[0], ref[1]) }; }
    function itemSrc(O, ref, role) {
      if (ref[0] === O) return { c: ref[1] };
      if (O === 0) return rowSrc(ref);
      var dn = "d" + k + role;
      mod.dvars.push({ name: dn, size: N });
      for (var x = 0; x < N; x++) (function (x) {
        var cp = compile([{ v: dn }, { v: pName(O, x) }, rowSrc(ref)], function (a) { return (a[0] === x) === (a[1] === a[2]); });
        mod.cons.push({ kind: "test", vars: cp.vars, test: cp.test, label: "(liên kết phụ của manh mối " + (k + 1) + ")", meta: { kind: "aux", k: k } });
      })(x);
      return { v: dn };
    }
    function add(srcs, fn) {
      var cp = compile(srcs, fn);
      if (!cp.vars.length) { mod.constant = !!cp.test([]); return; }
      mod.cons.push({ kind: "test", vars: cp.vars, test: cp.test, label: label, meta: meta });
    }
    var vals, rank, i;
    if (cl.t === "eq") add([rowSrc(cl.a), rowSrc(cl.b)], function (a) { return a[0] === a[1]; });
    else if (cl.t === "neq") add([rowSrc(cl.a), rowSrc(cl.b)], function (a) { return a[0] !== a[1]; });
    else if (cl.t === "or") add([rowSrc(cl.a)].concat(cl.list.map(rowSrc)), function (a) { for (var j = 1; j < a.length; j++) if (a[0] === a[j]) return true; return false; });
    else {
      vals = data.cats[cl.o].values; rank = vals.map(function (_, x) { return rankIn(vals, x); });
      var sa = itemSrc(cl.o, cl.a, "a"), sb = itemSrc(cl.o, cl.b, "b");
      if (cl.t === "lt") add([sa, sb], function (a) { return vals[a[0]] < vals[a[1]]; });
      else if (cl.t === "offset") add([sa, sb], function (a) { return Math.abs(vals[a[0]] - vals[a[1]] - cl.k) < 1e-9; });
      else if (cl.t === "next") add([sa, sb], function (a) { return Math.abs(rank[a[0]] - rank[a[1]]) === 1; });
      else add([sa, sb], function (a) { return Math.abs(rank[a[0]] - rank[a[1]]) !== 1; });
    }
    return mod;
  }
  /** Spec CSP gồm alldiff + các manh mối ks (chỉ số) + dấu người chơi `marks` ({cons, domains}). contradiction = có manh mối hằng sai. */
  function specFor(model, ks, marks) {
    var vars = model.pvars.slice(), cons = model.alldiff.slice(), contradiction = false, i;
    for (i = 0; i < ks.length; i++) {
      var m = model.modules[ks[i]];
      if (m.constant === false) contradiction = true;
      m.dvars.forEach(function (v) { vars.push(v); });
      m.cons.forEach(function (c) { cons.push(c); });
    }
    var spec = { vars: vars, cons: cons };
    if (marks) { marks.cons.forEach(function (c) { cons.push(c); }); if (Object.keys(marks.domains).length) spec.domains = marks.domains; }
    return { spec: spec, contradiction: contradiction };
  }
  function allIdx(n) { return range(n); }
  function runCsp(model, ks, marks, opt) {
    var sp = specFor(model, ks, marks);
    if (sp.contradiction) return { count: 0, solutions: [], nodes: 0, truncated: false, trace: null, problem: null };
    var p = C.problem(sp.spec), r = solveP(p, model.nV, opt || {});
    r.problem = p;
    return r;
  }
  /** Quay lui CHỈ phân nhánh trên biến thật p(j,x) (các biến phụ do lan truyền tự xác định) — Puz.csp.solve phân nhánh cả biến phụ nên dễ sa lầy.
      Lan truyền = csp.propagate + "chỉ còn một chỗ". opt như csp.solve: {limit, keep, maxNodes, trace, traceMax, domains}. Trả {count, solutions, nodes, truncated, trace}. */
  function solveP(p, nV, opt) {
    opt = opt || {};
    var limit = opt.limit || 1, keep = opt.keep == null ? limit : opt.keep, maxNodes = opt.maxNodes || 2000000, tr = opt.trace ? [] : null, traceMax = opt.traceMax || 600;
    var res = { count: 0, solutions: [], nodes: 0, truncated: false, trace: tr };
    var dom0 = opt.domains ? Int32Array.from(opt.domains) : C.domains(p);
    if (!closure(p, dom0)) return res;
    function pick(dom) {
      var best = -1, bn = 99, i;
      for (i = 0; i < nV; i++) { var n = pcount(dom[i]); if (n > 1 && n < bn) { bn = n; best = i; } }
      return best;
    }
    function dfs(dom, depth, parent) {
      var v = pick(dom), i;
      if (v < 0) {
        res.count++;
        if (res.solutions.length < keep) res.solutions.push(Array.prototype.map.call(dom, function (m) { return U.lowBit(m); }));
        return true;
      }
      var any = false, m;
      for (m = dom[v]; m; m &= m - 1) {
        if (res.nodes >= maxNodes) { res.truncated = true; return any; }
        res.nodes++;
        var val = U.lowBit(m & -m), nd = Int32Array.from(dom), id = -1;
        nd[v] = 1 << val;
        if (tr && tr.length < traceMax) { tr.push({ id: tr.length, parent: parent, depth: depth + 1, v: v, val: val, status: "open", kids: 0 }); id = tr.length - 1; if (parent >= 0) tr[parent].kids++; }
        if (!closure(p, nd, null, [v])) { if (id >= 0) tr[id].status = "fail"; continue; }
        var before = res.count, found = dfs(nd, depth + 1, id);
        if (id >= 0) tr[id].status = res.count > before ? "ok" : "dead";
        if (found) any = true;
        if (res.count >= limit) return true;
      }
      return any;
    }
    dfs(dom0, 0, -1);
    if (tr) tr.forEach(function (x) { if (x.status === "ok" && !x.kids && res.count) x.status = "solution"; });
    return res;
  }
  function rowsFromArr(model, arr) {
    var K = model.K, N = model.N, rows = [range(N)], c, i;
    for (c = 1; c < K; c++) { var r = []; for (i = 0; i < N; i++) r.push(arr[(c - 1) * N + i]); rows.push(r); }
    return mkSol(K, N, rows);
  }
  var CACHE = typeof WeakMap !== "undefined" ? new WeakMap() : null;
  function modelOf(data) {
    var m = CACHE && CACHE.get(data);
    if (!m) { m = buildModel(data); if (CACHE) CACHE.set(data, m); }
    return m;
  }

  // ═══════════════════════════════════════════════════════════════════ 5. lưới đánh dấu
  var LAYOUTS = {};
  function layout(K, N) {
    var key = K + "x" + N, L = LAYOUTS[key];
    if (L) return L;
    var blocks = [], ci, cj;
    for (ci = 0; ci < K; ci++) for (cj = ci + 1; cj < K; cj++) blocks.push({ ci: ci, cj: cj, base: blocks.length * N * N });
    return (LAYOUTS[key] = { K: K, N: N, blocks: blocks, nn: N * N, total: blocks.length * N * N });
  }
  function blockIdx(K, ci, cj) { return ci * (2 * K - ci - 1) / 2 + (cj - ci - 1); }
  function cellIndex(K, N, ci, a, cj, b) {
    var t;
    if (ci > cj) { t = ci; ci = cj; cj = t; t = a; a = b; b = t; }
    return blockIdx(K, ci, cj) * N * N + a * N + b;
  }
  function cellInfo(K, N, i) {
    var L = layout(K, N), blk = Math.floor(i / L.nn), r = i % L.nn, B = L.blocks[blk];
    return { block: blk, ci: B.ci, cj: B.cj, a: Math.floor(r / N), b: r % N };
  }
  function solToState(K, N, S) {
    var L = layout(K, N), v = new Array(L.total), bi, a, b;
    for (bi = 0; bi < L.blocks.length; bi++) {
      var B = L.blocks[bi];
      for (a = 0; a < N; a++) for (b = 0; b < N; b++) v[B.base + a * N + b] = S.rows[B.ci][a] === S.rows[B.cj][b] ? 1 : 2;
    }
    return v;
  }
  /** Gộp các ✓ thành thành phần liên thông trên K·N nút (nút = nhóm·N + mục). */
  function marksUF(K, N, v) {
    var L = layout(K, N), parent = [], i, bi;
    for (i = 0; i < K * N; i++) parent.push(i);
    function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
    for (bi = 0; bi < L.blocks.length; bi++) {
      var B = L.blocks[bi];
      for (i = 0; i < L.nn; i++) if (v[B.base + i] === 1) { var x = find(B.ci * N + Math.floor(i / N)), y = find(B.cj * N + i % N); if (x !== y) parent[x] = y; }
    }
    return find;
  }
  /** Hệ quả hiển nhiên của các dấu (xem đầu tệp). Trả mảng v mới hoặc null nếu các dấu tự mâu thuẫn. */
  function autoClosure(K, N, v0) {
    var v = v0.slice(), L = layout(K, N), pass, i, u, w;
    function cellOfNodes(x, y) { return cellIndex(K, N, Math.floor(x / N), x % N, Math.floor(y / N), y % N); }
    for (pass = 0; pass < 12; pass++) {
      var find = marksUF(K, N, v), comps = {}, changed = false, n = K * N;
      for (i = 0; i < n; i++) { var r = find(i); (comps[r] = comps[r] || []).push(i); }
      var roots = Object.keys(comps);
      for (i = 0; i < roots.length; i++) {                                    // mỗi nhóm một mục
        var cnt = {}, mem = comps[roots[i]];
        for (u = 0; u < mem.length; u++) { var cc = Math.floor(mem[u] / N); if (cnt[cc]) return null; cnt[cc] = 1; }
      }
      for (var bi = 0; bi < L.blocks.length; bi++) {                           // ✗ không nằm giữa hai mục cùng thành phần
        var B = L.blocks[bi];
        for (i = 0; i < L.nn; i++) if (v[B.base + i] === 2 && find(B.ci * N + Math.floor(i / N)) === find(B.cj * N + i % N)) return null;
      }
      for (i = 0; i < roots.length; i++) {
        var members = comps[roots[i]];
        for (u = 0; u < members.length; u++) for (w = 0; w < members.length; w++) {
          var cu = Math.floor(members[u] / N), cw = Math.floor(members[w] / N);
          if (cu === cw) continue;
          var ix = cellOfNodes(members[u], members[w]);
          if (v[ix] === 0) { v[ix] = 1; changed = true; }                       // bắc cầu ✓
          for (var y = 0; y < N; y++) if (y !== members[w] % N) {                // ✗ cho mọi mục khác cùng nhóm với w
            var iy = cellOfNodes(members[u], cw * N + y);
            if (v[iy] === 0) { v[iy] = 2; changed = true; } else if (v[iy] === 1) return null;
          }
        }
      }
      for (var bj = 0; bj < L.blocks.length; bj++) {                           // ✗ lan giữa các thành phần
        var Bj = L.blocks[bj];
        for (i = 0; i < L.nn; i++) if (v[Bj.base + i] === 2) {
          var ma = comps[find(Bj.ci * N + Math.floor(i / N))], mb = comps[find(Bj.cj * N + i % N)];
          for (u = 0; u < ma.length; u++) for (w = 0; w < mb.length; w++) {
            if (Math.floor(ma[u] / N) === Math.floor(mb[w] / N)) continue;
            var iz = cellOfNodes(ma[u], mb[w]);
            if (v[iz] === 0) { v[iz] = 2; changed = true; } else if (v[iz] === 1) return null;
          }
        }
      }
      if (!changed) break;
    }
    return v;
  }
  /** Dấu người chơi → ràng buộc/miền cho CSP. which: 1 chỉ ✓, 2 chỉ ✗, 3 cả hai; skipCell: bỏ qua một ô. */
  function marksOf(model, v, which, skipCell) {
    var K = model.K, N = model.N, cons = [], domains = {}, full = (1 << N) - 1, i;
    for (i = 0; i < v.length; i++) {
      var val = v[i];
      if (!val || i === skipCell || !(val & which)) continue;
      var f = cellInfo(K, N, i);
      if (f.ci === 0) {
        var nm = pName(f.cj, f.b), bit = 1 << f.a;
        domains[nm] = (domains[nm] != null ? domains[nm] : full) & (val === 1 ? bit : ~bit);
      } else {
        (function (val, cell) {
          cons.push({ kind: "test", vars: [pName(f.ci, f.a), pName(f.cj, f.b)], test: val === 1 ? function (x) { return x[0] === x[1]; } : function (x) { return x[0] !== x[1]; },
            label: "dấu " + (val === 1 ? "✓" : "✗") + " ở ô " + cell, meta: { kind: "mark", cell: cell } });
        })(val, i);
      }
    }
    return { cons: cons, domains: domains };
  }
  function assignmentFromMarks(K, N, v) {
    var find = marksUF(K, N, v), byRoot = {}, c, i, rows = [range(N)];
    for (i = 0; i < N; i++) byRoot[find(i)] = i;
    for (c = 1; c < K; c++) {
      var r = [];
      for (i = 0; i < N; i++) { var row = byRoot[find(c * N + i)]; if (row == null) return null; r.push(row); }
      var seen = {}, ok = true; r.forEach(function (x) { if (seen[x]) ok = false; seen[x] = 1; });
      if (!ok) return null;
      rows.push(r);
    }
    return mkSol(K, N, rows);
  }
  /** Ô vi phạm luật hiện tại (xem đầu tệp). */
  function markConflicts(puzzle, v) {
    var data = puzzle.data, K = data.cats.length, N = data.cats[0].items.length, L = layout(K, N), out = {}, find = marksUF(K, N, v), bi, i, n = K * N;
    var compCats = {}, bad = {};
    for (i = 0; i < n; i++) { var r = find(i), cc = Math.floor(i / N); compCats[r] = compCats[r] || {}; compCats[r][cc] = (compCats[r][cc] || 0) + 1; if (compCats[r][cc] > 1) bad[r] = 1; }
    for (bi = 0; bi < L.blocks.length; bi++) {
      var B = L.blocks[bi], a, b, rowAll, colAll;
      for (i = 0; i < L.nn; i++) {
        var val = v[B.base + i], ra = find(B.ci * N + Math.floor(i / N)), rb = find(B.cj * N + i % N);
        if (val === 1 && bad[ra]) out[B.base + i] = 1;
        if (val === 2 && ra === rb) out[B.base + i] = 1;
      }
      for (a = 0; a < N; a++) { rowAll = true; for (b = 0; b < N; b++) if (v[B.base + a * N + b] !== 2) rowAll = false; if (rowAll) for (b = 0; b < N; b++) out[B.base + a * N + b] = 1; }
      for (b = 0; b < N; b++) { colAll = true; for (a = 0; a < N; a++) if (v[B.base + a * N + b] !== 2) colAll = false; if (colAll) for (a = 0; a < N; a++) out[B.base + a * N + b] = 1; }
    }
    // (d) ✓ vô lý với manh mối: lan truyền ràng buộc sau khi gắn mọi ✓
    var ones = [];
    for (i = 0; i < v.length; i++) if (v[i] === 1 && !out[i]) ones.push(i);
    if (ones.length && !Object.keys(bad).length) {
      var model = modelOf(data), ks = allIdx(data.clues.length);
      if (!propagateOk(model, ks, marksOf(model, v, 1, -1))) {
        var hit = 0;
        ones.forEach(function (cell) { if (propagateOk(model, ks, marksOf(model, v, 1, cell))) { out[cell] = 1; hit++; } });
        if (!hit) ones.forEach(function (cell) { out[cell] = 1; });
      }
    }
    return Object.keys(out).map(Number).sort(function (x, y) { return x - y; });
  }
  function propagateOk(model, ks, marks) {
    var sp = specFor(model, ks, marks);
    if (sp.contradiction) return false;
    var p = C.problem(sp.spec), dom = C.domains(p);
    return C.propagate(p, dom);
  }

  // ═══════════════════════════════════════════════════════════════════ 6. phân tích đề, nhập, kiểm, giải
  /** Đếm nghiệm (dừng ở limit) của data đã chuẩn hoá. */
  function analyzeData(data, opt) {
    opt = opt || {};
    var model = modelOf(data), ks = allIdx(data.clues.length), limit = opt.limit || 2, maxNodes = opt.maxNodes || MAX_NODES;
    var r = runCsp(model, ks, null, { limit: limit, keep: 1, maxNodes: maxNodes });
    var status = r.count === 0 ? (r.truncated ? "multiple" : "none") : (r.count === 1 && !r.truncated ? "unique" : "multiple");
    return { status: status, count: r.count, truncated: r.truncated, S: r.solutions.length ? rowsFromArr(model, r.solutions[0]) : null, nodes: r.nodes, model: model };
  }
  function assemble(data, o) {
    var K = data.cats.length, N = data.cats[0].items.length, L = layout(K, N);
    var p = { v: 1, type: "logicgrid", id: "", seed: o.seed == null ? null : o.seed, sizeId: o.sizeId || (K + "x" + N), size: { cats: K, items: N }, tier: o.tier || "custom", score: o.score || 0,
      data: data, initial: { v: zeros(L.total) }, solution: o.S ? { v: solToState(K, N, o.S) } : null, meta: o.meta || {} };
    p.id = U.puzzleId(p);
    return p;
  }
  function metaOf(input) {
    var m = {};
    if (input && typeof input === "object") ["name", "source", "note"].forEach(function (k) { if (typeof input[k] === "string" && input[k].trim()) m[k] = input[k].trim().slice(0, 200); });
    return m;
  }
  function fromInput(input) {
    var errors = [], warnings = [];
    try {
      var data = normalizeData(input, errors, warnings);
      if (!data || errors.length) return { ok: false, puzzle: null, errors: errors.length ? errors : ["Dữ liệu đề không hợp lệ."], warnings: warnings, status: "none", count: 0 };
      var an = analyzeData(data), meta = metaOf(input);
      data.clues.forEach(function (cl, k) {
        var m = an.model.modules[k];
        if (m && m.constant === true) warnings.push("Manh mối " + (k + 1) + " luôn đúng nên không có tác dụng.");
        if (m && m.constant === false) errors.push("Manh mối " + (k + 1) + " luôn sai nên đề vô nghiệm.");
      });
      if (an.status === "none") {
        errors.push("Các manh mối mâu thuẫn nhau: đề vô nghiệm.");
        return { ok: false, puzzle: null, errors: errors, warnings: warnings, status: "none", count: 0 };
      }
      if (an.status === "multiple") {
        meta.multiple = true;
        warnings.push(an.truncated ? "Đề có thể có nhiều hơn một lời giải (bộ giải chưa xác định hết trong giới hạn tìm kiếm)." : "Đề có nhiều hơn một lời giải; hãy thêm manh mối để lời giải duy nhất.");
      }
      var puzzle = assemble(data, { S: an.S, meta: meta });
      puzzle.score = difficulty(puzzle);
      return { ok: true, puzzle: puzzle, errors: [], warnings: warnings, status: an.status, count: an.count };
    } catch (e) {
      errors.push("Không dựng được đề: " + (e && e.message ? e.message : "lỗi không rõ") + ".");
      return { ok: false, puzzle: null, errors: errors, warnings: warnings, status: "none", count: 0 };
    }
  }
  function puzzleData(puzzle, errors) {
    if (!puzzle || typeof puzzle !== "object" || !puzzle.data) { if (errors) errors.push("Thiếu dữ liệu đề (data)."); return null; }
    var e = errors || [], d = normalizeData(puzzle.data, e, []);
    return e.length ? null : d;
  }
  function validate(puzzle) {
    var errors = [];
    try {
      if (!puzzle || puzzle.type !== "logicgrid") errors.push("Không phải đề Logic Grid.");
      var data = puzzle && puzzle.data ? puzzleData(puzzle, errors) : (errors.push("Thiếu dữ liệu đề (data)."), null);
      if (!data || errors.length) return { ok: false, errors: errors, status: "none", count: 0 };
      var an = analyzeData(data);
      if (an.status === "none") errors.push("Đề vô nghiệm.");
      return { ok: errors.length === 0, errors: errors, status: an.status, count: an.count, solution: an.S ? { v: solToState(an.model.K, an.model.N, an.S) } : undefined };
    } catch (e) {
      return { ok: false, errors: ["Không kiểm được đề: " + (e && e.message ? e.message : "lỗi") + "."], status: "none", count: 0 };
    }
  }
  function solve(puzzle, opts) {
    opts = opts || {};
    var errors = [], data = puzzleData(puzzle, errors);
    if (!data) return { status: "none", count: 0, solution: null, steps: [], techniques: {}, nodes: 0, errors: errors };
    var an = analyzeData(data, { limit: opts.limit || 2, maxNodes: opts.maxNodes });
    var out = { status: an.status, count: an.count, solution: an.S ? { v: solToState(an.model.K, an.model.N, an.S) } : null, steps: [], techniques: {}, nodes: an.nodes, truncated: an.truncated };
    if (opts.explain !== false && an.count > 0) { var sim = simulate(data, { steps: true }); out.steps = sim.steps; out.techniques = sim.techniques; }
    return out;
  }

  // ═══════════════════════════════════════════════════════════════════ 7. ván chơi: state, nước đi, kiểm
  function newState(puzzle) { return { v: puzzle.initial.v.slice(), c: null }; }
  function isGiven(puzzle, i) { return !!(puzzle && puzzle.initial && puzzle.initial.v && puzzle.initial.v[i]); }
  function dims(puzzle) { var d = puzzle.data; return { K: d.cats.length, N: d.cats[0].items.length }; }
  function moveFor(puzzle, state, action, settings) {
    try {
      if (!action || !state || !state.v) return null;
      var D = dims(puzzle), K = D.K, N = D.N, L = layout(K, N), i = action.i, v = state.v, nv;
      if (!isInt(i) || i < 0 || i >= L.total || isGiven(puzzle, i)) return null;
      if (action.k === "cycle") nv = v[i] === 0 ? 2 : v[i] === 2 ? 1 : 0;
      else if (action.k === "set") { nv = action.val; if (nv !== 0 && nv !== 1 && nv !== 2) return null; }
      else return null;
      if (nv === v[i]) return null;
      var w = v.slice(), d = [], label = nv === 1 ? "Đánh ✓" : nv === 2 ? "Đánh ✗" : "Xoá dấu";
      w[i] = nv;
      if (nv !== 0 && settings && settings.autoRemove) { var cl = autoClosure(K, N, w); if (cl) { for (var j = 0; j < w.length; j++) if (cl[j] !== w[j] && !isGiven(puzzle, j)) w[j] = cl[j]; } }
      d.push(["v", i, v[i], nv]);
      for (var z = 0; z < w.length; z++) if (z !== i && w[z] !== v[z]) d.push(["v", z, v[z], w[z]]);
      return { d: d, label: label };
    } catch (e) { return null; }
  }
  function check(puzzle, state) {
    var D = dims(puzzle), K = D.K, N = D.N, v = state.v, filled = 0, i;
    for (i = 0; i < v.length; i++) if (v[i]) filled++;
    var conflicts = markConflicts(puzzle, v), solved = false;
    if (!conflicts.length) {
      var S = assignmentFromMarks(K, N, v);
      solved = !!S && evalAll(puzzle.data, S);
    }
    return { solved: solved, conflicts: conflicts, filled: filled, total: v.length };
  }
  function feasible(puzzle, v) {
    var model = modelOf(puzzle.data), r = runCsp(model, allIdx(puzzle.data.clues.length), marksOf(model, v, 3, -1), { limit: 1, keep: 0, maxNodes: MAX_NODES });
    return r.count > 0 || r.truncated;
  }
  function mistakes(puzzle, state, diff) {
    try {
      if (!diff || !diff.d) return 0;
      var i, e, n = 0, sol = puzzle.solution && puzzle.solution.v;
      if (puzzle.meta && puzzle.meta.multiple) {
        var after = state.v.slice(), changed = false;
        for (i = 0; i < diff.d.length; i++) { e = diff.d[i]; if (e[0] === "v") { after[e[1]] = e[3]; if (e[3]) changed = true; } }
        return changed && !feasible(puzzle, after) && feasible(puzzle, state.v) ? 1 : 0;
      }
      if (!sol) return 0;
      var wrongOne = 0, wrongTwo = 0;
      for (i = 0; i < diff.d.length; i++) {
        e = diff.d[i];
        if (e[0] !== "v") continue;
        if (e[3] === 1 && sol[e[1]] === 2) wrongOne++;
        if (e[3] === 2 && sol[e[1]] === 1) wrongTwo++;
      }
      n = wrongOne || wrongTwo;
      return n;
    } catch (e2) { return 0; }
  }
  function describeCell(puzzle, state, i) {
    try {
      var D = dims(puzzle), f = cellInfo(D.K, D.N, i), cats = puzzle.data.cats, val = state && state.v ? state.v[i] : 0;
      return "Khối " + cats[f.ci].name + " × " + cats[f.cj].name + ", hàng " + cats[f.ci].items[f.a] + ", cột " + cats[f.cj].items[f.b] + ": " + (val === 1 ? "đã đánh ✓ (cùng một nhóm)" : val === 2 ? "đã loại ✗ (khác nhóm)" : "chưa đánh dấu");
    } catch (e) { return "Ô " + i; }
  }

  // ═══════════════════════════════════════════════════════════════════ 8. lan truyền mạnh hơn + mô phỏng người giải + độ khó
  /** csp.propagate + "chỉ còn một chỗ" (hidden single) của alldiff — thứ csp.js không làm. dom sửa tại chỗ; false nếu mâu thuẫn. */
  function hiddenSingles(p, dom, steps) {
    var changed = [], ci, j, r;
    for (ci = 0; ci < p.cons.length; ci++) {
      var c = p.cons[ci];
      if (c.kind !== "alldiff") continue;
      var vs = c.vars, n = vs.length, S = p.size[vs[0]];
      for (r = 0; r < S; r++) {
        var bit = 1 << r, cnt = 0, who = -1;
        for (j = 0; j < n; j++) if (dom[vs[j]] & bit) { cnt++; who = vs[j]; }
        if (cnt === 1 && dom[who] !== bit) {
          if (steps) steps.push({ con: c.id, v: who, removed: dom[who] & ~bit, why: "hidden", row: r });
          dom[who] = bit; changed.push(who);
        }
      }
    }
    return changed;
  }
  function closure(p, dom, steps, from) {
    var ok = C.propagate(p, dom, from || null, steps);
    while (ok) {
      var ch = hiddenSingles(p, dom, steps);
      if (!ch.length) break;
      ok = C.propagate(p, dom, ch, steps);
    }
    return ok;
  }
  function problemFor(model, ks, marks) {
    var sp = specFor(model, ks, marks);
    return sp.contradiction ? null : C.problem(sp.spec);
  }
  function varName(model, i) { var N = model.N, c = Math.floor(i / N) + 1, x = i % N; return model.data.cats[c].items[x] + " (" + model.data.cats[c].name + ")"; }
  function varRef(model, i) { return [Math.floor(i / model.N) + 1, i % model.N]; }
  function rowName(model, r) { return model.data.cats[0].items[r]; }
  /** Câu "An không mặc màu Đỏ" cho các hàng `mask` bị loại khỏi biến i. */
  function elimSentence(model, i, mask) {
    var rows = U.bitsOf(mask >>> 0).map(function (r) { return rowName(model, r); });
    return joinAnd(rows) + " " + vp(model.data, varRef(model, i), true);
  }
  function posSentence(model, i, row) { return rowName(model, row) + " " + vp(model.data, varRef(model, i), false); }

  var TECH = { direct: "Loại trừ từ một manh mối", chain: "Kết hợp nhiều manh mối", probe: "Giả định rồi bác bỏ", search: "Thử-sai (quay lui)" };
  function clueCounts(data) {
    var n = { eq: 0, neq: 0, or: 0, ord: 0 };
    data.clues.forEach(function (c) { if (c.t === "eq") n.eq++; else if (c.t === "neq") n.neq++; else if (c.t === "or") n.or++; else n.ord++; });
    return n;
  }
  /** Mô phỏng một người giải theo bậc kỹ thuật (xem đầu tệp). Trả {sweeps, direct, chain, probe, refuted, nodes, solvedBy, steps, techniques}. */
  function simulate(data, opt) {
    opt = opt || {};
    var model = modelOf(data), m = data.clues.length, N = model.N, nV = model.nV, i, k;
    var res = { sweeps: 0, direct: 0, chain: 0, probe: 0, refuted: 0, nodes: 0, solvedBy: "direct", steps: [], techniques: {}, contradiction: false };
    var pAll = problemFor(model, allIdx(m)), p0 = problemFor(model, []);
    if (!pAll) { res.contradiction = true; return res; }
    var pk = []; for (k = 0; k < m; k++) pk.push(null);
    function pOf(k) { return pk[k] || (pk[k] = problemFor(model, [k])); }
    var full = (1 << N) - 1, dom = new Int32Array(nV), work = 0, cap = opt.workCap || WORK_CAP, capped = false;
    for (i = 0; i < nV; i++) dom[i] = full;
    function charge(p) { work += unitOf(p, N); if (work > cap) capped = true; return !capped; }
    function load(p) { var d = C.domains(p); for (var j = 0; j < nV; j++) d[j] = dom[j]; return d; }
    function note(tech, head, before, after) {
      if (!opt.steps || res.steps.length >= 60) return;
      var parts = [], j;
      for (j = 0; j < nV && parts.length < 3; j++) if (after[j] !== before[j]) {
        if (pcount(after[j]) === 1) parts.push(posSentence(model, j, U.lowBit(after[j])));
        else parts.push(elimSentence(model, j, before[j] & ~after[j]));
      }
      res.steps.push({ technique: TECH[tech], text: head + (parts.length ? ": " + parts.join("; ") : "") });
      res.techniques[TECH[tech]] = (res.techniques[TECH[tech]] || 0) + 1;
    }
    function applyP(p, tech, head) {
      if (!charge(p)) return false;
      var d = load(p), before = Int32Array.from(dom);
      if (!closure(p, d)) { res.contradiction = true; return false; }
      var changed = false;
      for (var j = 0; j < nV; j++) if (d[j] !== dom[j]) { changed = true; dom[j] = d[j]; }
      if (changed) note(tech, head, before, dom);
      return changed;
    }
    function solvedDom() { for (var j = 0; j < nV; j++) if (dom[j] & (dom[j] - 1)) return false; return true; }
    function undetermined() { for (var j = 0; j < nV; j++) if (dom[j] === 0) return false; return true; }
    if (p0) applyP(p0, "direct", "Từ luật mỗi mục một nhóm");
    var guard = 0;
    while (guard++ < 400 && !res.contradiction && !solvedDom() && !capped) {
      var any;
      do {
        any = false;
        for (k = 0; k < m && !capped; k++) if (applyP(pOf(k), "direct", "Manh mối " + (k + 1) + " (" + clueText(data, data.clues[k]) + ")")) { any = true; res.direct++; }
        if (any) res.sweeps++;
      } while (any && !solvedDom() && !res.contradiction && !capped);
      if (solvedDom() || res.contradiction || capped) break;
      if (applyP(pAll, "chain", "Kết hợp mọi manh mối")) { res.chain++; if (res.solvedBy === "direct") res.solvedBy = "chain"; continue; }
      var ref = 0, base = Int32Array.from(dom), x, r, dFull = load(pAll), cand = [];  // giả định-và-bác-bỏ: mỗi lần MỘT khả năng bị loại, rồi quét lại
      closure(pAll, dFull);
      for (x = 0; x < nV; x++) if (base[x] & (base[x] - 1)) for (r = 0; r < N; r++) if (base[x] & (1 << r)) cand.push([pcount(base[x]), x, r]);
      cand.sort(function (u, w) { return u[0] - w[0] || u[1] - w[1] || u[2] - w[2]; });         // biến ít khả năng nhất trước: dễ bác bỏ nhất, như người giải
      for (i = 0; i < cand.length && !ref; i++) {
        if (!charge(pAll)) break;
        x = cand[i][1]; r = cand[i][2];
        var d = Int32Array.from(dFull); d[x] = 1 << r;
        if (!closure(pAll, d, null, [x])) { dom[x] &= ~(1 << r); ref++; }
      }
      if (capped) break;
      if (ref) {
        res.probe++; res.refuted += ref; res.solvedBy = "probe";
        if (opt.steps && res.steps.length < 60) { res.steps.push({ technique: TECH.probe, text: "Giả định một khả năng còn lại rồi thử suy luận: dẫn tới mâu thuẫn nên khả năng đó bị loại." }); res.techniques[TECH.probe] = (res.techniques[TECH.probe] || 0) + 1; }
        continue;
      }
      var d0 = C.domains(pAll); for (i = 0; i < nV; i++) d0[i] = dom[i];
      var sr = solveP(pAll, nV, { limit: 2, keep: 0, maxNodes: MAX_NODES, domains: d0 });
      res.nodes = sr.nodes; res.solvedBy = "search";
      if (opt.steps && res.steps.length < 60) { res.steps.push({ technique: TECH.search, text: "Cần thử-sai (quay lui): " + sr.nodes + " lần thử." }); res.techniques[TECH.search] = 1; }
      break;
    }
    if (capped && !solvedDom()) {                                         // hết ngân sách công việc: ước lượng phần còn lại bằng một lần tìm kiếm nhỏ
      var d1 = C.domains(pAll); for (i = 0; i < nV; i++) d1[i] = dom[i];
      var s1 = solveP(pAll, nV, { limit: 2, keep: 0, maxNodes: 3000, domains: d1 });
      res.nodes = s1.nodes; res.solvedBy = "search"; res.capped = true;
    }
    if (!undetermined()) res.contradiction = true;
    res.work = work;
    return res;
  }
  var WORK_CAP = 4e6;
  function unitOf(p, N) {
    if (p._u == null) { var u = 40 * p.names.length, i; for (i = 0; i < p.cons.length; i++) if (p.cons[i].kind !== "alldiff") u += Math.pow(N, p.cons[i].vars.length); p._u = u; }
    return p._u;
  }
  /** Điểm độ khó: cỡ + độ sâu suy luận + độ phức tạp loại manh mối (hệ số ở DIFF, hiệu chỉnh bằng đo thật — xem báo cáo). */
  var DIFF = { sizeK: 0.35, sizeN: 0.45, cx: 2.4, sweep: 0.35, sweepCap: 10, probe: 0.9, chainW: 2, probeCap: 3.0, search: 0.3, searchCap: 2.0 };
  function featureOf(data, sim) {
    var K = data.cats.length, N = data.cats[0].items.length, cc = clueCounts(data), m = Math.max(1, data.clues.length);
    return { K: K, N: N, m: data.clues.length, cc: cc, cxFrac: (cc.or * 0.8 + cc.ord * 1.0) / m, sweeps: sim.sweeps, direct: sim.direct, chain: sim.chain, probe: sim.probe, refuted: sim.refuted, nodes: sim.nodes };
  }
  function scoreOf(f) {
    var D = DIFF, deep = f.probe + D.chainW * f.chain;
    var s = D.sizeK * (f.K - 2) + D.sizeN * (f.N - 2) + D.cx * f.cxFrac + D.sweep * Math.min(D.sweepCap, f.sweeps) + Math.min(D.probeCap, D.probe * Math.log(1 + deep) / Math.LN2) +
      Math.min(D.searchCap, D.search * Math.log(1 + f.nodes) / Math.LN2);
    return U.clampScore(s);
  }
  function difficulty(puzzle) {
    try {
      var data = puzzle.data.cats && puzzle.data.clues ? puzzle.data : null;
      if (!data) return 0;
      return scoreOf(featureOf(data, simulate(data, {})));
    } catch (e) { return 0; }
  }

  // ═══════════════════════════════════════════════════════════════════ 9. sinh đề
  var SIZES = [
    { id: "3x3", label: "3 nhóm × 3 mục", params: { cats: 3, items: 3 }, tiers: ["easy", "medium"] },
    { id: "3x4", label: "3 nhóm × 4 mục", params: { cats: 3, items: 4 }, tiers: ["easy", "medium", "hard"] },
    { id: "4x4", label: "4 nhóm × 4 mục", params: { cats: 4, items: 4 }, default: true, tiers: ["easy", "medium", "hard", "expert"] },
    { id: "4x5", label: "4 nhóm × 5 mục", params: { cats: 4, items: 5 }, tiers: ["easy", "medium", "hard", "expert"] },
    { id: "5x5", label: "5 nhóm × 5 mục", params: { cats: 5, items: 5 }, tiers: ["easy", "medium", "hard", "expert"] }
  ];
  /* Một "núm độ cứng" h ∈ [0,1] điều khiển cách sinh: trọng số loại manh mối (eq/neq trực tiếp → hoặc/thứ tự), số ứng viên mỗi vòng (M), chọn ứng viên YẾU nhất
     (weak) thay vì mạnh nhất, xác suất chọn ngẫu nhiên (rnd), xác suất manh mối dính nhóm 0 (p0), xác suất có nhóm thứ tự (pOrd, pOrd2 = có thêm nhóm thứ hai),
     thứ tự thử gỡ khi tỉa (prune: loại nào gỡ trước). `generate` bắt đầu ở H0[bậc] rồi chỉnh h theo điểm đo được của lần thử trước (bộ điều khiển phản hồi). */
  var H0 = { easy: 0, medium: 0.45, hard: 0.72, expert: 0.95 };
  /* Lịch núm h cho từng (cỡ, bậc) được quảng cáo: các giá trị h cho tỉ lệ MỘT lần thử rơi đúng bậc cao nhất (đo bằng 30 lần thử mỗi h = 0, 0.1 … 1 ở bước hiệu chỉnh);
     lần thử thứ k dùng SCHED[k mod độ dài]. Tỉ lệ trúng đo được của MỘT lần thử (60–120 mẫu): 3×3 vừa ≈ 40 %, 3×4 khó ≈ 25 %, 4×4 chuyên gia ≈ 15 %, 5×5 khó ≈ 35 %, còn lại ≥ 40 %.
     Tổ hợp không quảng cáo dùng bộ điều khiển phản hồi từ H0 với ít lần thử hơn. */
  var SCHED = {
    "3x3": { easy: [0], medium: [1, 0.8] },
    "3x4": { easy: [0], medium: [1, 0.6, 0.8], hard: [1, 0.9] },
    "4x4": { easy: [0], medium: [0.9, 0.8], hard: [1, 0.8], expert: [0.9, 1] },
    "4x5": { easy: [0], medium: [0.5, 0.4], hard: [0.6, 0.5, 0.7], expert: [0.8, 0.9, 1] },
    "5x5": { easy: [0], medium: [0.3, 0.4], hard: [0.6, 0.5], expert: [1, 0.9] }
  };

  function clamp01(x) { return Math.max(0, Math.min(1, x)); }
  function cfgAt(h) {
    return { h: h, w: { eq: 0.5 - 0.46 * h, neq: 0.5 - 0.3 * h, or: 0.45 * h, ord: 0.55 * h }, M: h < 0.3 ? 14 : 8, weak: h >= 0.3, rnd: 0.1 + 0.2 * h, p0: 0.6 - 0.2 * h,
      pOrd: clamp01(2.2 * h - 0.4), pOrd2: clamp01(2 * h - 1), or3: h, prune: h < 0.4 ? ["or", "ord", "neq", "eq"] : ["eq", "neq", "or", "ord"] };
  }
  var MAX_TRY = 60;

  function pickKinds(rng, K, N, cfg) {
    var nOrd = 0;
    if (K >= 3 && rng.chance(cfg.pOrd)) nOrd = 1;
    if (K >= 4 && nOrd && rng.chance(cfg.pOrd2)) nOrd = 2;
    var kinds = rng.shuffle(PLAIN_KINDS.slice()).slice(0, K - 1 - nOrd), ord = [];
    if (nOrd >= 1) ord.push(rng.chance(0.5) ? "position" : "age");
    if (nOrd === 2) ord.push(ord[0] === "position" ? "age" : "position");
    return rng.shuffle(kinds.concat(ord));
  }
  function makeTheme(rng, K, N, cfg) {
    var kinds = pickKinds(rng, K, N, cfg), cats = [], used = {}, i;
    function takeItems(pool) {
      var out = [], cand = rng.shuffle(pool.slice());
      for (i = 0; i < cand.length && out.length < N; i++) if (!used[fold(cand[i])]) { out.push(cand[i]); used[fold(cand[i])] = 1; }
      return out;
    }
    cats.push({ name: VOCAB.person.name, items: takeItems(VOCAB.person.pool), ordered: false, values: null, kind: "person" });
    kinds.forEach(function (kd) {
      var v = VOCAB[kd], items, vals = null;
      if (kd === "position") { items = []; for (i = 1; i <= N; i++) items.push(String(i)); }
      else if (kd === "age") { var base = rng.pick([18, 20, 25, 30]), step = rng.pick([5, 10]); items = []; for (i = 0; i < N; i++) items.push(String(base + step * i)); }
      else items = takeItems(v.pool);
      if (v.ordered) vals = defaultValues(items);
      cats.push({ name: v.name, items: items, ordered: !!v.ordered, values: vals, kind: kd });
    });
    return cats;
  }
  function randomRows(rng, K, N) {
    var rows = [range(N)], c;
    for (c = 1; c < K; c++) rows.push(rng.shuffle(range(N)));
    return mkSol(K, N, rows);
  }
  function sampleClue(rng, data, S, cfg, ords) {
    var K = data.cats.length, N = data.cats[0].items.length, w = cfg.w, tot = w.eq + w.neq + w.or + (ords.length ? w.ord : 0), x = rng.next() * tot, type, r, r2;
    if ((x -= w.eq) < 0) type = "eq"; else if ((x -= w.neq) < 0) type = "neq"; else if ((x -= w.or) < 0) type = "or"; else type = "ord";
    function refAt(c, row) { return [c, S.inv[c][row]]; }
    function otherRow(not) { var q; do { q = rng.int(N); } while (q === not); return q; }
    var ca = rng.chance(cfg.p0) ? 0 : rng.int(K), cb;
    do { cb = rng.int(K); } while (cb === ca);
    if (rng.chance(0.5)) { var t = ca; ca = cb; cb = t; }
    if (type === "eq") { r = rng.int(N); return mkClue("eq", refAt(ca, r), refAt(cb, r)); }
    if (type === "neq") { r = rng.int(N); r2 = otherRow(r); return mkClue("neq", refAt(ca, r), refAt(cb, r2)); }
    if (type === "or") {
      r = rng.int(N);
      var L = N >= 4 && rng.chance(cfg.or3) ? 3 : 2, rows = rng.shuffle(range(N).filter(function (q) { return q !== r; })).slice(0, L - 1);
      var list = rng.shuffle([refAt(cb, r)].concat(rows.map(function (q) { return refAt(cb, q); })));
      return mkClue("or", refAt(ca, r), null, null, null, list);
    }
    var O = rng.pick(ords), vals = data.cats[O].values;
    function rcat() { var c = rng.chance(0.55) ? 0 : rng.int(K); if (c === O && rng.chance(0.7)) c = (O + 1 + rng.int(K - 1)) % K; return c; }
    var cA = rcat(), cB = rcat();
    if (cA === O && cB === O) return null;
    function val(row) { return vals[S.inv[O][row]]; }
    var rA = rng.int(N), rB = otherRow(rA), roll = rng.next(), tmp;
    if (roll < 0.42) { if (!(val(rA) < val(rB))) { tmp = rA; rA = rB; rB = tmp; } return mkClue("lt", refAt(cA, rA), refAt(cB, rB), O); }
    if (roll < 0.62) { if (!(val(rA) > val(rB))) { tmp = rA; rA = rB; rB = tmp; } return mkClue("offset", refAt(cA, rA), refAt(cB, rB), O, val(rA) - val(rB)); }
    if (roll < 0.82) {
      var rk = rankIn(vals, S.inv[O][rA]), tg = rk === 0 ? 1 : rk === N - 1 ? N - 2 : (rng.chance(0.5) ? rk - 1 : rk + 1), xi;
      for (xi = 0; xi < N; xi++) if (rankIn(vals, xi) === tg) break;
      rB = S.rows[O][xi];
      return mkClue("next", refAt(cA, rA), refAt(cB, rB), O);
    }
    var tries = 0;
    while (tries++ < 12 && Math.abs(rankIn(vals, S.inv[O][rA]) - rankIn(vals, S.inv[O][rB])) === 1) rB = otherRow(rA);
    if (Math.abs(rankIn(vals, S.inv[O][rA]) - rankIn(vals, S.inv[O][rB])) === 1) return null;
    return mkClue("nnext", refAt(cA, rA), refAt(cB, rB), O);
  }
  function typeRank(cl) { return cl.t === "eq" ? 0 : cl.t === "neq" ? 1 : cl.t === "or" ? 2 : 3; }
  function typeKey(cl) { return cl.t === "eq" ? "eq" : cl.t === "neq" ? "neq" : cl.t === "or" ? "or" : "ord"; }

  /** Một lần thử sinh đề: chọn lời giải, thêm manh mối (ưu tiên cắt nhiều nhất) tới khi duy nhất, rồi tỉa. Trả data hoặc null. */
  function attempt(rng, K, N, cfg) {
    var cats = makeTheme(rng.fork("theme"), K, N, cfg), S = randomRows(rng.fork("sol"), K, N), ords = [], c;
    for (c = 0; c < K; c++) if (cats[c].ordered) ords.push(c);
    var data0 = { cats: cats, clues: [] }, base = buildModel(data0), nV = base.nV, srng = rng.fork("clues");
    var acc = [], mods = [], seen = {}, full = (1 << N) - 1, dom = new Int32Array(nV), i, cap = 4 * nV + 8, dAcc = null, unique = false;
    for (i = 0; i < nV; i++) dom[i] = full;
    function specOf(list) {
      var vars = base.pvars.slice(), cons = base.alldiff.slice();
      list.forEach(function (md) { md.dvars.forEach(function (v) { vars.push(v); }); md.cons.forEach(function (cn) { cons.push(cn); }); });
      return { vars: vars, cons: cons };
    }
    function gain(md) {
      var p = C.problem(specOf([md])), d = C.domains(p), j, g = 0;
      for (j = 0; j < nV; j++) d[j] = dom[j];
      if (!closure(p, d)) return -1;
      for (j = 0; j < nV; j++) g += pcount(dom[j]) - pcount(d[j]);
      return g;
    }
    var rounds = 0;
    while (!unique && acc.length < cap && rounds++ < cap * 3) {
      var cands = [], tries = 0;
      while (cands.length < cfg.M && tries++ < cfg.M * 6) {
        var cl = sampleClue(srng, data0, S, cfg, ords);
        if (!cl || seen[JSON.stringify(cl)] || !evalClue(data0, S, cl)) continue;
        var md = clueModule(base, cl, acc.length);
        if (md.constant != null) continue;
        cands.push({ cl: cl, md: md, g: gain(md) });
        seen[JSON.stringify(cl)] = 1;
      }
      if (!cands.length) return null;
      var pick = cands[0], j, pos = cands.filter(function (q) { return q.g > 0; });
      if (srng.chance(cfg.rnd)) pick = srng.pick(cands);
      else if (cfg.weak && pos.length) { pick = pos[0]; for (j = 1; j < pos.length; j++) if (pos[j].g + srng.next() * 0.9 < pick.g + srng.next() * 0.9) pick = pos[j]; }
      else for (j = 1; j < cands.length; j++) if (cands[j].g + srng.next() * 0.9 > pick.g + srng.next() * 0.9) pick = cands[j];
      if (pick.g <= 0 && !srng.chance(0.25) && pos.length) pick = srng.pick(pos);
      acc.push(pick.cl); mods.push(pick.md);
      var pAcc = C.problem(specOf(mods)), d = C.domains(pAcc);
      for (j = 0; j < nV; j++) d[j] = dom[j];
      if (!closure(pAcc, d)) return null;
      for (j = 0; j < nV; j++) dom[j] = d[j];
      dAcc = d;
      var solved = true; for (j = 0; j < nV; j++) if (dom[j] & (dom[j] - 1)) solved = false;
      if (solved) unique = true;
      else if (acc.length >= nV * 0.5) { var rr = solveP(pAcc, nV, { limit: 2, keep: 0, maxNodes: 4000, domains: dAcc }); if (rr.count === 1 && !rr.truncated) unique = true; }
    }
    if (!unique) return null;
    // tỉa: bỏ từng manh mối thừa theo thứ tự ưu tiên của bậc
    var order = acc.map(function (cl, idx) { return idx; });
    srng.shuffle(order);
    order.sort(function (x, y) { return cfg.prune.indexOf(typeKey(acc[x])) - cfg.prune.indexOf(typeKey(acc[y])); });
    var keep = {}; acc.forEach(function (_, idx) { keep[idx] = true; });
    order.forEach(function (idx) {
      var rest = []; acc.forEach(function (_, q) { if (keep[q] && q !== idx) rest.push(mods[q]); });
      var rr = solveP(C.problem(specOf(rest)), nV, { limit: 2, keep: 0, maxNodes: 20000 });
      if (rr.count === 1 && !rr.truncated) keep[idx] = false;
    });
    var kept = []; acc.forEach(function (cl, idx) { if (keep[idx]) kept.push({ cl: cl, idx: idx }); });
    kept.sort(function (x, y) { return typeRank(x.cl) - typeRank(y.cl) || x.idx - y.idx; });
    return { data: { cats: cats, clues: kept.map(function (q) { return q.cl; }) }, S: S };
  }
  function sizeById(id) { for (var i = 0; i < SIZES.length; i++) if (SIZES[i].id === id) return SIZES[i]; for (i = 0; i < SIZES.length; i++) if (SIZES[i].default) return SIZES[i]; return SIZES[0]; }
  function tierDist(score, tier) {
    var t = U.tier(tier);
    return score < t.min ? t.min - score : score >= t.max ? score - t.max + 0.01 : 0;
  }
  function generate(seed, opt) {
    opt = opt || {};
    var sz = sizeById(opt.sizeId), tier = H0[opt.tier] != null ? opt.tier : "medium", K = sz.params.cats, N = sz.params.items, T = U.tier(tier);
    var adv = sz.tiers.indexOf(tier) >= 0, sched = adv && SCHED[sz.id] ? SCHED[sz.id][tier] : null, tries = adv ? MAX_TRY : 12;
    var base = R.create(seed), best = null, bestD = 1e9, k, h = H0[tier];
    for (k = 0; k < tries; k++) {
      if (sched) h = sched[k % sched.length];
      var a = attempt(base.fork("try" + k), K, N, cfgAt(h));
      if (!a) { if (!sched) h = clamp01(h + (k % 2 ? 0.1 : -0.1)); continue; }
      var an = analyzeData(a.data, { limit: 2, maxNodes: 2000000 });
      if (an.status !== "unique") continue;
      var score = scoreOf(featureOf(a.data, simulate(a.data, {})));
      var dist = tierDist(score, tier);
      if (dist < bestD) { bestD = dist; best = { a: a, score: score }; }
      if (dist === 0) break;
      if (!sched) h = clamp01(h + Math.max(-0.35, Math.min(0.35, (T.target - score) * 0.07)));
    }
    if (!best) return null;
    var real = U.tierOfScore(best.score).id;
    return assemble(best.a.data, { seed: R.seedOf(seed), sizeId: sz.id, tier: bestD === 0 ? tier : real, score: best.score, S: best.a.S, meta: {} });
  }

  // ═══════════════════════════════════════════════════════════════════ 10. gợi ý (lan truyền ràng buộc từ trạng thái người chơi)
  /* Kiến thức = alldiff + dấu người chơi (✓ ở khối nhóm 0 → miền; các dấu khác → ràng buộc =/≠) + một tập manh mối. Gợi ý tìm MỘT ô (khối nhóm 0) chưa đánh dấu mà kiến thức đó
     đã quyết định, theo bậc: (0) chỉ các dấu → (1) một manh mối + dấu → (2) mọi manh mối cùng lúc (rút gọn còn tập manh mối nhỏ nhất) → (3) giả định-bác-bỏ → (4) thử-sai (quay lui).
     Lời giải thích dựng từ nhật ký lan truyền của csp.propagate: cắt lát ngược theo bit (chỉ giữ bước thật sự góp vào kết luận). */
  function wrongCells(puzzle, state) {
    var v = state.v, sol = puzzle.solution && puzzle.solution.v, out = [], i;
    if (puzzle.meta && puzzle.meta.multiple) {
      var idxs = []; for (i = 0; i < v.length; i++) if (v[i]) idxs.push(i);
      function prefix(k) { var w = zeros(v.length); for (var j = 0; j < k; j++) w[idxs[j]] = v[idxs[j]]; return w; }
      if (!idxs.length || feasible(puzzle, v)) return [];
      var lo = 1, hi = idxs.length;
      while (lo < hi) { var mid = (lo + hi) >> 1; if (feasible(puzzle, prefix(mid))) lo = mid + 1; else hi = mid; }
      return [idxs[lo - 1]];
    }
    if (!sol) return out;
    for (i = 0; i < v.length; i++) if ((v[i] === 1 && sol[i] === 2) || (v[i] === 2 && sol[i] === 1)) out.push(i);
    return out;
  }
  function determinedCells(model, dom, v, only) {
    var K = model.K, N = model.N, out = [], i, r;
    for (i = 0; i < model.nV; i++) {
      var c = Math.floor(i / N) + 1, x = i % N, d = dom[i];
      for (r = 0; r < N; r++) {
        var cell = cellIndex(K, N, 0, r, c, x);
        if (v[cell] !== 0 || (only != null && cell !== only)) continue;
        if (d === (1 << r)) out.push({ cell: cell, val: 1, x: i, row: r });
        else if (!(d & (1 << r))) out.push({ cell: cell, val: 2, x: i, row: r });
      }
    }
    return out;
  }
  /** Cắt lát ngược nhật ký lan truyền: giữ các bước thật sự góp vào việc (x, row) bị loại (mode "elim") hoặc x chốt ở row (mode "sing"). seeds: ({biến: mask cần}) cho trường hợp mâu thuẫn. */
  function sliceOf(R, model, x, mode, row, seeds, upto0) {
    var p = R.p, log = R.log, N = model.N, full = (1 << N) - 1, need = {}, sel = [], s, j, upto = -1;
    if (seeds) { Object.keys(seeds).forEach(function (k) { need[k] = seeds[k]; }); upto = upto0; }
    else if (mode === "elim") { need[x] = 1 << row; for (s = 0; s < log.length; s++) if (log[s].v === x && ((log[s].removed >>> 0) & (1 << row))) { upto = s; break; } }
    else { need[x] = full & ~(1 << row); for (s = log.length - 1; s >= 0; s--) if (log[s].v === x) { upto = s; break; } }
    for (s = upto; s >= 0; s--) {
      var st = log[s], nm = need[st.v] || 0;
      if (!((st.removed >>> 0) & nm)) continue;
      sel.push(s);
      var vs = p.cons[st.con].vars;
      if (st.why === "single") need[st.by] = (need[st.by] || 0) | (full & ~st.removed);
      else if (st.why === "hidden") { for (j = 0; j < vs.length; j++) if (vs[j] !== st.v) need[vs[j]] = (need[vs[j]] || 0) | (1 << st.row); }
      else for (j = 0; j < vs.length; j++) if (vs[j] !== st.v) need[vs[j]] = (need[vs[j]] || 0) | full;
    }
    sel.reverse();
    var clues = {}, mk = {};
    sel.forEach(function (q) { var mt = p.cons[log[q].con].meta; if (mt && (mt.kind === "clue" || mt.kind === "aux")) clues[mt.k] = 1; else if (mt && mt.kind === "mark") mk[mt.cell] = 1; });
    return { sel: sel, clues: Object.keys(clues).map(Number).sort(function (a, b) { return a - b; }), markCells: Object.keys(mk).map(Number), need: need };
  }
  function narrate(model, R, q) {
    var st = R.log[q], p = R.p, mt = p.cons[st.con].meta, cat = model.data.cats;
    if (st.v >= model.nV) {                                                  // biến phụ d<k><a|b>: "mục của nhóm có thứ tự cùng nhóm với vế a/b"
      var dm = /^d(\d+)([ab])$/.exec(p.names[st.v]), cl = dm ? model.data.clues[+dm[1]] : null;
      if (!cl) return null;
      var O = cl.o, items = U.bitsOf(st.removed >>> 0).map(function (x) { return cat[O].items[x]; });
      return "Theo manh mối " + (+dm[1] + 1) + ": " + refPhrase(model.data, cl[dm[2]]) + " " + vp(model.data, [O, U.bitsOf(st.removed >>> 0)[0]], true, joinOr(items));
    }
    if (st.why === "single") return posSentence(model, st.by, U.lowBit(st.removed >>> 0)) + ", nên " + elimSentence(model, st.v, st.removed);
    if (st.why === "hidden") return "Trong nhóm «" + cat[Math.floor(st.v / model.N) + 1].name + "», chỉ " + varName(model, st.v) + " còn có thể ở " + rowName(model, st.row) + ", nên " + posSentence(model, st.v, st.row);
    var head = mt && mt.kind === "mark" ? "Theo dấu bạn đã đặt" : "Theo manh mối " + ((mt ? mt.k : 0) + 1);
    return head + ": " + elimSentence(model, st.v, st.removed);
  }
  function uniqTexts(list) { var seen = {}, out = []; list.forEach(function (t) { if (t && !seen[t]) { seen[t] = 1; out.push(t); } }); return out; }
  function whyLines(model, data, R, sl, concl, prefix) {
    var lines = [], steps = [];
    sl.clues.forEach(function (k) { lines.push("Manh mối " + (k + 1) + ": " + clueText(data, data.clues[k]) + "."); });
    if (prefix) prefix.forEach(function (t) { lines.push(t); });
    sl.sel.forEach(function (q) { steps.push(narrate(model, R, q)); });
    steps = uniqTexts(steps);
    if (steps.length > 8) steps = steps.slice(0, 4).concat(["…"], steps.slice(-3));
    steps.forEach(function (t) { lines.push(t.charAt(t.length - 1) === "…" ? t : t + "."); });
    lines.push("⇒ " + concl + ".");
    return lines;
  }
  function markNames(model, v, need) {
    var N = model.N, K = model.K, out = [], i;
    Object.keys(need).forEach(function (xs) {
      var x = +xs, c = Math.floor(x / N) + 1, it = x % N, r;
      if (x >= model.nV || !need[xs]) return;
      for (r = 0; r < N; r++) { var cell = cellIndex(K, N, 0, r, c, it); if (v[cell]) out.push((v[cell] === 1 ? "✓ " : "✗ ") + rowName(model, r) + "–" + model.data.cats[c].items[it]); }
    });
    return out;
  }
  function deduceNext(puzzle, v, only) {
    var data = puzzle.data, model = modelOf(data), N = model.N, nV = model.nV, m = data.clues.length, all = allIdx(m), marks = marksOf(model, v, 3, -1);
    function run(ks, assume) {
      var sp = specFor(model, ks, marks);
      if (sp.contradiction) return null;
      var p = C.problem(sp.spec), dom = C.domains(p), log = [];
      if (assume) { if (!(dom[assume.x] & (1 << assume.r))) return null; dom[assume.x] = 1 << assume.r; }
      var ok = closure(p, dom, log, assume ? [assume.x] : null);
      return { p: p, dom: dom, log: log, ok: ok };
    }
    function negText(x, row) { return elimSentence(model, x, 1 << row); }
    function build(cd, R, tech, extraPrefix, clueSet) {
      var sl = sliceOf(R, model, cd.x, cd.val === 1 ? "sing" : "elim", cd.row);
      var concl = cd.val === 1 ? posSentence(model, cd.x, cd.row) : negText(cd.x, cd.row);
      var pre = [], mk = markNames(model, v, sl.need);
      if (mk.length) pre.push("Các ô bạn đã đánh dấu liên quan: " + mk.slice(0, 5).join(", ") + (mk.length > 5 ? "…" : ""));
      return { cell: cd.cell, val: cd.val, x: cd.x, row: cd.row, tech: tech, clues: clueSet || sl.clues, why: whyLines(model, data, R, sl, concl, (extraPrefix || []).concat(pre)), hasMarks: mk.length > 0 || sl.markCells.length > 0 };
    }
    function keyOf(cd, sl, k) { return [cd.val === 1 ? 0 : 1, sl.sel.length, k == null ? 0 : k, cd.cell]; }
    function cmp(a, b) { for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; }
    var R0 = run([]), best = null, k, i;
    // bậc 0: chỉ các dấu
    if (R0 && R0.ok) {
      determinedCells(model, R0.dom, v, only).forEach(function (cd) { var sl = sliceOf(R0, model, cd.x, cd.val === 1 ? "sing" : "elim", cd.row), key = keyOf(cd, sl, 0); if (!best || cmp(key, best.key) < 0) best = { cd: cd, key: key, R: R0 }; });
      if (best) return build(best.cd, best.R, "marks");
    }
    // bậc 1: một manh mối
    for (k = 0; k < m; k++) {
      var Rk = run([k]);
      if (!Rk || !Rk.ok) continue;
      determinedCells(model, Rk.dom, v, only).forEach(function (cd) { var sl = sliceOf(Rk, model, cd.x, cd.val === 1 ? "sing" : "elim", cd.row), key = keyOf(cd, sl, k); if (!best || cmp(key, best.key) < 0) best = { cd: cd, key: key, R: Rk }; });
    }
    if (best) return build(best.cd, best.R, "single");
    // bậc 2: mọi manh mối cùng lúc, rồi rút gọn tập manh mối
    var RA = run(all);
    if (RA && RA.ok) {
      determinedCells(model, RA.dom, v, only).forEach(function (cd) {
        var sl = sliceOf(RA, model, cd.x, cd.val === 1 ? "sing" : "elim", cd.row), key = [sl.clues.length, cd.val === 1 ? 0 : 1, sl.sel.length, cd.cell];
        if (!best || cmp(key, best.key) < 0) best = { cd: cd, key: key, R: RA, sl: sl };
      });
      if (best) {
        var set = best.sl.clues.slice(), cd2 = best.cd;
        for (i = set.length - 1; i >= 0; i--) {
          var trial = set.filter(function (q) { return q !== set[i]; }), Rt = run(trial);
          if (Rt && Rt.ok && determinedCells(model, Rt.dom, v, cd2.cell).some(function (q) { return q.val === cd2.val; })) set = trial;
        }
        var Rm = run(set);
        return build(cd2, Rm, set.length > 1 ? "chain" : "single", null, set);
      }
      // bậc 3: giả định rồi bác bỏ (chỉ ô thuộc khối nhóm 0)
      var found = [], x, r, cands = [], ci;
      for (x = 0; x < nV; x++) if (RA.dom[x] & (RA.dom[x] - 1)) for (r = 0; r < N; r++) if (RA.dom[x] & (1 << r)) cands.push([pcount(RA.dom[x]), x, r]);
      cands.sort(function (u, w) { return u[0] - w[0] || u[1] - w[1] || u[2] - w[2]; });
      for (ci = 0; ci < cands.length && found.length < 6; ci++) {
        x = cands[ci][1]; r = cands[ci][2];
        var cell = cellIndex(model.K, N, 0, r, Math.floor(x / N) + 1, x % N);
        if (only != null && cell !== only) continue;
        var d2 = Int32Array.from(RA.dom), log2 = []; d2[x] = 1 << r;
        if (!closure(RA.p, d2, log2, [x])) found.push({ x: x, r: r, log: log2, cell: cell, wipe: log2.length > 0 && d2[log2[log2.length - 1].v] === 0 });
      }
      if (found.length) {
        var bf = null, bl = null;
        found.forEach(function (f) {
          var lastS = f.log.length - 1, seeds = {}, sl;
          if (lastS >= 0 && f.wipe) { seeds[f.log[lastS].v] = (1 << N) - 1; sl = sliceOf({ p: RA.p, log: f.log }, model, 0, "elim", 0, seeds, lastS); }
          else { sl = { sel: f.log.map(function (_, q) { return q; }), clues: allIdx(m), markCells: [], need: {} }; }
          if (!bf || sl.sel.length < bl.sel.length) { bf = f; bl = sl; }
        });
        var R2 = { p: RA.p, log: bf.log };
        var lines = ["Giả sử " + posSentence(model, bf.x, bf.r) + "."], steps = uniqTexts(bl.sel.map(function (q) { return narrate(model, R2, q); }));
        if (steps.length > 8) steps = steps.slice(0, 4).concat(["…"], steps.slice(-3));
        bl.clues.slice(0, 6).forEach(function (kk) { lines.unshift("Manh mối " + (kk + 1) + ": " + clueText(data, data.clues[kk]) + "."); });
        steps.forEach(function (t) { lines.push(t.charAt(t.length - 1) === "…" ? t : t + "."); });
        lines.push("Hai điều trên mâu thuẫn nhau, nên giả sử đó sai.", "⇒ " + negText(bf.x, bf.r) + ".");
        return { cell: bf.cell, val: 2, x: bf.x, row: bf.r, tech: "probe", clues: bl.clues, why: lines, assume: { x: bf.x, r: bf.r } };
      }
      // bậc 4: thử-sai
      for (x = 0; x < nV; x++) {
        if (!(RA.dom[x] & (RA.dom[x] - 1))) continue;
        for (r = 0; r < N; r++) {
          if (!(RA.dom[x] & (1 << r))) continue;
          var cell2 = cellIndex(model.K, N, 0, r, Math.floor(x / N) + 1, x % N);
          if (only != null && cell2 !== only) continue;
          var d3 = Int32Array.from(RA.dom); d3[x] = 1 << r;
          var sr = solveP(RA.p, nV, { limit: 1, keep: 0, maxNodes: MAX_NODES, domains: d3 });
          if (sr.count === 0 && !sr.truncated) {
            return { cell: cell2, val: 2, x: x, row: r, tech: "search", clues: allIdx(m), assume: { x: x, r: r },
              why: ["Không có bước suy luận ngắn hơn: cần thử-sai nhiều tầng.", "Giả sử " + posSentence(model, x, r) + ", rồi thử mọi khả năng còn lại của các mục khác: tất cả đều dẫn tới mâu thuẫn với các manh mối.", "⇒ " + negText(x, r) + "."] };
          }
        }
      }
      // bậc 5: đề nhiều nghiệm — chọn theo một lời giải hợp lệ
      var d5 = Int32Array.from(RA.dom), s5 = solveP(RA.p, nV, { limit: 1, keep: 1, maxNodes: MAX_NODES, domains: d5 });
      if (s5.count > 0) {
        for (x = 0; x < nV; x++) if (RA.dom[x] & (RA.dom[x] - 1)) {
          var rr = s5.solutions[0][x], cell3 = cellIndex(model.K, N, 0, rr, Math.floor(x / N) + 1, x % N);
          if (v[cell3] === 0 && (only == null || cell3 === only))
            return { cell: cell3, val: 1, x: x, row: rr, tech: "choice", clues: [], why: ["Đề có nhiều hơn một lời giải; ô này nhất quán với một lời giải hợp lệ.", "⇒ " + posSentence(model, x, rr) + "."] };
        }
      }
    }
    return null;
  }
  var HINT_CACHE = { key: "", val: null };
  function baseHint(puzzle, state) {
    var key = puzzle.id + "|" + state.v.join("");
    if (HINT_CACHE.key === key) return HINT_CACHE.val;
    var val = baseHintRaw(puzzle, state);
    HINT_CACHE = { key: key, val: val };
    return val;
  }
  function baseHintRaw(puzzle, state) {
    var data = puzzle.data, model = modelOf(data), v = state.v, K = model.K, N = model.N;
    if (check(puzzle, state).solved) return { kind: "done" };
    var wrong = wrongCells(puzzle, state), i;
    if (wrong.length) {
      var cell = wrong[0];
      for (i = 0; i < wrong.length; i++) if (v[wrong[i]] === 1) { cell = wrong[i]; break; }
      var clean = v.slice(); wrong.forEach(function (w) { clean[w] = 0; });
      var f = cellInfo(K, N, cell), truth = puzzle.solution ? puzzle.solution.v[cell] : 0, why = null;
      if (f.ci === 0) { var d = deduceNext(puzzle, clean, cell); if (d && d.val === truth) why = d.why; }
      var A = data.cats[f.ci].items[f.a], B = data.cats[f.cj].items[f.b];
      if (!why) why = ["«" + A + "» và «" + B + "» " + (truth === 1 ? "thuộc cùng một nhóm" : "không thuộc cùng một nhóm") + " trong lời giải đúng, nên dấu hiện tại sai."];
      return { kind: "wrong", cell: cell, was: v[cell], truth: truth, why: why };
    }
    var dd = deduceNext(puzzle, v, null);
    if (!dd) return { kind: "none" };
    dd.kind = "deduce";
    return dd;
  }
  function rowCells(K, N, ci, a, cj) { var out = [], b; for (b = 0; b < N; b++) out.push(cellIndex(K, N, ci, a, cj, b)); return out; }
  function blockCells(K, N, ci, cj) { var L = layout(K, N), B = L.blocks[blockIdx(K, ci, cj)], out = [], i; for (i = 0; i < L.nn; i++) out.push(B.base + i); return out; }
  function hint(puzzle, state, level) {
    level = Math.max(1, Math.min(3, level | 0 || 1));
    try {
      var h = baseHint(puzzle, state), data = puzzle.data, K = data.cats.length, N = data.cats[0].items.length, cats = data.cats;
      if (h.kind === "done") return { level: level, text: "Đề đã giải xong — không còn gợi ý.", why: [], cells: [], none: true };
      if (h.kind === "none") return { level: level, text: "Không tìm thấy bước suy luận tiếp theo từ trạng thái hiện tại.", why: [], cells: [], none: true };
      var f = cellInfo(K, N, h.cell), A = cats[f.ci].items[f.a], B = cats[f.cj].items[f.b], blk = "«" + cats[f.ci].name + " × " + cats[f.cj].name + "»";
      if (h.kind === "wrong") {
        if (level === 1) return { level: 1, text: "Có ô đang đánh dấu sai. Hãy kiểm tra lại khối " + blk + ".", why: [], cells: blockCells(K, N, f.ci, f.cj), regions: { block: { ci: f.ci, cj: f.cj } }, technique: "Sửa lỗi" };
        if (level === 2) return { level: 2, text: "Ô giao giữa «" + A + "» (" + cats[f.ci].name + ") và «" + B + "» (" + cats[f.cj].name + ") đang đánh dấu sai — hãy xem lại dấu ở ô này.", why: [], cells: [h.cell], technique: "Sửa lỗi" };
        return { level: 3, text: "Có ô đang đánh dấu sai: «" + A + "» – «" + B + "» (đang " + (h.was === 1 ? "✓" : "✗") + "). Xoá dấu này.", why: h.why.slice(), cells: [h.cell], technique: "Sửa lỗi", action: { k: "set", i: h.cell, val: 0 } };
      }
      var nums = h.clues.map(function (k) { return k + 1; }), numTxt = nums.length ? (nums.length === 1 ? "manh mối " + nums[0] : "các manh mối " + nums.slice(0, 5).join(", ") + (nums.length > 5 ? "…" : "")) : "";
      var techName = h.tech === "marks" ? "Loại trừ trong lưới" : h.tech === "single" ? "Một manh mối" : h.tech === "chain" ? "Kết hợp nhiều manh mối" : h.tech === "probe" ? "Giả định rồi bác bỏ" : h.tech === "search" ? "Thử-sai" : "Chọn theo một lời giải hợp lệ";
      var rowName0 = cats[0].items[f.a];
      if (level === 1) {
        var t1 = h.tech === "marks" ? "Hãy nhìn lại các dấu bạn đã đặt: hàng của «" + rowName0 + "» (hoặc cột của một mục) trong khối " + blk + " đã bị thu hẹp đáng kể."
          : h.tech === "probe" || h.tech === "search" ? "Không còn bước trực tiếp: hãy thử giả định một khả năng cho «" + rowName0 + "» rồi suy ra hệ quả — tìm chỗ mâu thuẫn."
          : h.tech === "choice" ? "Đề có nhiều lời giải: hãy tập trung vào hàng của «" + rowName0 + "»."
          : "Hãy đọc kỹ " + numTxt + (h.hasMarks ? " cùng các ô bạn đã đánh dấu" : "") + ": chúng đủ để chắc chắn thêm một ô quanh «" + rowName0 + "».";
        return { level: 1, text: t1, why: [], cells: rowCells(K, N, 0, f.a, f.cj), regions: { clues: h.clues.slice(), block: { ci: f.ci, cj: f.cj }, row: f.a }, technique: techName };
      }
      if (level === 2) {
        var t2 = (numTxt ? "Từ " + numTxt + (h.hasMarks ? " và các ô đã đánh dấu" : "") + ", " : "Từ các dấu đã đặt, ") + "ô giao giữa «" + A + "» (" + cats[0].name + ") và «" + B + "» (" + cats[f.cj].name + ") đã xác định được — hãy suy luận xem nên đánh dấu gì.";
        return { level: 2, text: t2, why: [], cells: [h.cell], regions: { clues: h.clues.slice(), block: { ci: f.ci, cj: f.cj } }, technique: techName };
      }
      var concl = h.val === 1 ? "Đánh ✓: " + posSentence(modelOf(data), h.x, h.row) + "." : "Đánh ✗: " + elimSentence(modelOf(data), h.x, 1 << h.row) + ".";
      return { level: 3, text: concl, why: h.why.slice(), cells: [h.cell], regions: { clues: h.clues.slice(), block: { ci: f.ci, cj: f.cj } }, technique: techName, action: { k: "set", i: h.cell, val: h.val } };
    } catch (e) {
      return { level: level, text: "Không tạo được gợi ý lúc này.", why: [], cells: [], none: true };
    }
  }
  function replay(puzzle) {
    var out = [], st = newState(puzzle), total = st.v.length, guard = 0;
    try {
      while (guard++ < total * 3) {
        if (check(puzzle, st).solved) break;
        var h = hint(puzzle, st, 3);
        if (!h || h.none || !h.action) break;
        var diff = moveFor(puzzle, st, h.action, { autoRemove: true });
        if (!diff) break;
        var cells = diff.d.map(function (e) { return e[1]; });
        out.push({ text: h.text, why: h.why.slice(), diff: { d: diff.d, label: diff.label }, cells: cells, technique: h.technique });
        diff.d.forEach(function (e) { st.v[e[1]] = e[3]; });
      }
      if (!check(puzzle, st).solved && puzzle.solution) {
        var d = [], z;
        for (z = 0; z < st.v.length; z++) if (st.v[z] !== puzzle.solution.v[z]) d.push(["v", z, st.v[z], puzzle.solution.v[z]]);
        if (d.length) out.push({ text: "Điền nốt các ô còn lại theo lời giải.", why: ["Không còn bước suy luận ngắn hơn từ trạng thái này."], diff: { d: d, label: "Hiện lời giải" }, cells: d.map(function (e) { return e[1]; }), technique: "Hiện lời giải" });
      }
    } catch (e) { /* trả những gì đã có */ }
    return out;
  }

  // ═══════════════════════════════════════════════════════════════════ 11. màn Constraint View, trace, nhập/xuất tệp và văn bản
  function constraintView(puzzle) {
    var errors = [], data = puzzleData(puzzle, errors);
    if (!data) return { summary: "Đề không hợp lệ.", variables: [], constraints: [], counts: { variables: 0, constraints: 0 } };
    var model = modelOf(data), K = model.K, N = model.N, m = data.clues.length, cats = data.cats, dom = cats[0].items, c, x, variables = [], constraints = [];
    var domStr = "{" + dom.join(", ") + "}";
    if (model.nV >= 40) { for (c = 1; c < K; c++) variables.push({ name: "Mỗi mục của «" + cats[c].name + "»", domain: domStr, domainItems: dom.slice(), count: N }); }
    else for (c = 1; c < K; c++) for (x = 0; x < N; x++) variables.push({ name: cats[c].items[x] + " (" + cats[c].name + ")", domain: domStr, domainItems: dom.slice() });
    for (c = 1; c < K; c++) constraints.push("alldiff — mỗi mục của nhóm «" + cats[c].name + "» thuộc về một " + noun0(data) + " khác nhau");
    data.clues.forEach(function (cl, k) { constraints.push("Manh mối " + (k + 1) + ": " + formatClue(data, cl) + "   (" + clueText(data, cl) + ")"); });
    var sm = "Logic Grid " + K + " nhóm × " + N + " mục: " + model.nV + " biến (mỗi mục ngoài nhóm «" + cats[0].name + "» nhận một " + noun0(data) + "), miền " + N + " giá trị; " + (K - 1) + " ràng buộc alldiff và " + m + " manh mối.";
    return { summary: sm, variables: variables, constraints: constraints, counts: { variables: model.nV, constraints: K - 1 + m, clues: m, alldiff: K - 1, categories: K, items: N, domainSize: N } };
  }
  function trace(puzzle, opts) {
    opts = opts || {};
    var errors = [], data = puzzleData(puzzle, errors);
    if (!data) return { kind: "tree", nodes: [], truncated: false, note: "Đề không hợp lệ." };
    var model = modelOf(data), N = model.N, cats = data.cats, max = Math.max(2, Math.min(600, opts.maxNodes || 600));
    var r = runCsp(model, allIdx(data.clues.length), null, { limit: 2, keep: 0, trace: true, traceMax: max - 1, maxNodes: MAX_NODES });
    var tr = r.trace || [], nodes = [{ id: 0, parent: -1, label: "Lan truyền ràng buộc (gốc)", status: r.count > 0 ? (tr.length ? "ok" : "solution") : "dead" }];
    tr.forEach(function (t) {
      var label;
      if (t.v < model.nV) label = rowName(model, t.val) + ": " + lc(cats[Math.floor(t.v / N) + 1].name) + " = " + cats[Math.floor(t.v / N) + 1].items[t.v % N];
      else { var mm = /^d(\d+)/.exec(r.problem.names[t.v]) || [0, "0"], kk = +mm[1], O = data.clues[kk] ? data.clues[kk].o : 0; label = "Manh mối " + (kk + 1) + ": " + lc(cats[O].name) + " = " + cats[O].items[t.val]; }
      nodes.push({ id: t.id + 1, parent: t.parent + 1, label: label, status: t.status === "open" ? "ok" : t.status });
    });
    var truncated = !!r.truncated || tr.length >= max - 1;
    var note = !tr.length ? "Lan truyền ràng buộc (alldiff + các manh mối) đã giải xong đề, không cần quay lui." :
      "Quay lui sau lan truyền: chọn biến còn ít giá trị nhất, thử từng giá trị rồi lan truyền; nhãn «An: màu = Đỏ» nghĩa là gán mục «Đỏ» cho hàng «An». " + (r.count > 1 ? "Đề có nhiều nghiệm — cây dừng khi tìm được hai nghiệm." : "Nhánh hết nghiệm bị cắt (dead/fail).") + (truncated ? " Cây quá lớn nên chỉ hiển thị " + nodes.length + " nút đầu." : "");
    return { kind: "tree", nodes: nodes, truncated: truncated, note: note };
  }
  function catsForFile(data) {
    return data.cats.map(function (cat) {
      var o = { name: cat.name, items: cat.items.slice() };
      if (cat.ordered) { o.ordered = true; if (!U.eqArr(cat.values, defaultValues(cat.items))) o.values = cat.values.slice(); }
      return o;
    });
  }
  function describeSolution(puzzle) {
    var data = puzzle.data, K = data.cats.length, N = data.cats[0].items.length, v = puzzle.solution && puzzle.solution.v;
    if (!v) return "";
    var parts = [], r, c, b;
    for (r = 0; r < N; r++) {
      var items = [];
      for (c = 1; c < K; c++) for (b = 0; b < N; b++) if (v[cellIndex(K, N, 0, r, c, b)] === 1) items.push(data.cats[c].items[b]);
      parts.push(data.cats[0].items[r] + ": " + items.join(", "));
    }
    return parts.join("; ");
  }
  function toFile(puzzle) {
    var data = puzzle.data, meta = {};
    Object.keys(puzzle.meta || {}).forEach(function (k) { if (typeof puzzle.meta[k] === "string") meta[k] = puzzle.meta[k]; });
    meta.tier = puzzle.tier; meta.sizeId = puzzle.sizeId;
    return { type: "logicgrid", seed: puzzle.seed, difficulty: puzzle.score, size: puzzle.size,
      initialState: JSON.stringify({ cats: catsForFile(data), clues: data.clues.map(function (cl) { return formatClue(data, cl); }) }), solution: describeSolution(puzzle), metadata: meta };
  }
  function fromFile(obj) {
    try {
      if (!obj || typeof obj !== "object") return { ok: false, puzzle: null, errors: ["Tệp không phải một đối tượng JSON."], warnings: [] };
      if (obj.type !== "logicgrid") return { ok: false, puzzle: null, errors: ["Tệp không phải đề Logic Grid (type = «" + String(obj.type).slice(0, 30) + "»)."], warnings: [] };
      var st = obj.initialState;
      if (typeof st === "string") { try { st = JSON.parse(st); } catch (e) { return { ok: false, puzzle: null, errors: ["initialState không phải JSON hợp lệ."], warnings: [] }; } }
      if (!st || typeof st !== "object" || Array.isArray(st)) return { ok: false, puzzle: null, errors: ["Thiếu initialState (cần {cats, clues})."], warnings: [] };
      var input = { cats: st.cats, clues: st.clues };
      if (obj.metadata && typeof obj.metadata === "object") ["name", "source", "note"].forEach(function (k) { input[k] = obj.metadata[k]; });
      var r = fromInput(input);
      return { ok: r.ok, puzzle: r.puzzle, errors: r.errors, warnings: r.warnings };
    } catch (e) { return { ok: false, puzzle: null, errors: ["Không đọc được tệp."], warnings: [] }; }
  }
  function toText(puzzle) {
    var data = puzzle.data, lines = ["Logic Grid " + data.cats.length + " nhóm × " + data.cats[0].items.length + " mục"];
    data.cats.forEach(function (cat) {
      var flag = "";
      if (cat.ordered) flag = " (có thứ tự" + (U.eqArr(cat.values, defaultValues(cat.items)) ? "" : "; giá trị " + cat.values.join(", ")) + ")";
      lines.push(cat.name + flag + ": " + cat.items.join(", "));
    });
    lines.push("---");
    data.clues.forEach(function (cl) { lines.push(formatClue(data, cl)); });
    return lines.join("\n");
  }
  function fromText(text) {
    try {
      if (typeof text !== "string" || !text.trim()) return { ok: false, puzzle: null, errors: ["Văn bản trống."], warnings: [] };
      if (text.length > 40000) return { ok: false, puzzle: null, errors: ["Văn bản quá dài."], warnings: [] };
      var raw = text.split(/\r?\n/).map(function (l) { return l.replace(/^\s+|\s+$/g, ""); }).filter(function (l) { return l && !/^(#|\/\/)/.test(l) && !/^logic grid/i.test(fold(l)); });
      var sep = -1, i;
      for (i = 0; i < raw.length; i++) if (/^-{3,}$/.test(raw[i]) || /^(manh moi|clues?)\s*:?$/.test(fold(raw[i]))) { sep = i; break; }
      var catLines = [], clueLines = [];
      function looksCat(l) { return /^[^=<>!|@:]+(\([^)]*\))?\s*:\s*[^=<>!|@]+$/.test(l) && l.indexOf(",") >= 0; }
      if (sep >= 0) { catLines = raw.slice(0, sep); clueLines = raw.slice(sep + 1); }
      else raw.forEach(function (l) { if (looksCat(l) && !clueLines.length) catLines.push(l); else clueLines.push(l); });
      var cats = [], errors = [];
      catLines.forEach(function (l) {
        var m = /^(.+?)\s*:\s*(.+)$/.exec(l);
        if (!m) { errors.push("Dòng nhóm không hiểu được: «" + l.slice(0, 40) + "»."); return; }
        var left = m[1], name = left, ordered = false, values = null, mf = /^(.*?)\s*\((.*)\)\s*$/.exec(left);
        if (mf) {
          name = mf[1];
          var fl = fold(mf[2]);
          if (/thu tu|ordered|order/.test(fl)) ordered = true;
          var mv = /(?:gia tri|values?)\s*[: ]\s*(.+)$/.exec(fl);
          if (mv) { var nums = mv[1].match(/-?\d+(?:\.\d+)?/g); if (nums) values = nums.map(Number); }
        }
        var cat = { name: name, items: m[2].split(",").map(cleanName).filter(function (x) { return x; }) };
        if (ordered) { cat.ordered = true; if (values) cat.values = values; }
        cats.push(cat);
      });
      if (errors.length) return { ok: false, puzzle: null, errors: errors, warnings: [] };
      if (!cats.length) return { ok: false, puzzle: null, errors: ["Không thấy dòng nhóm nào (dạng «Tên nhóm: mục 1, mục 2, …»)."], warnings: [] };
      var clues = clueLines.map(function (l) { return l.replace(/^\d+\s*[.)]\s*/, ""); });
      var r = fromInput({ cats: cats, clues: clues });
      return { ok: r.ok, puzzle: r.puzzle, errors: r.errors, warnings: r.warnings };
    } catch (e) { return { ok: false, puzzle: null, errors: ["Không đọc được văn bản."], warnings: [] }; }
  }

  // ═══════════════════════════════════════════════════════════════════ 12. đăng ký
  function blocks(puzzle) { var d = dims(puzzle); return layout(d.K, d.N).blocks.map(function (b) { return { ci: b.ci, cj: b.cj, base: b.base }; }); }
  var def = {
    id: "logicgrid", name: "Logic Grid", family: "Deduction Puzzle", category: "Suy diễn", icon: "🧩",
    blurb: "Mỗi người có đúng một màu, một nghề…: dùng các manh mối để suy ra ai ứng với cái gì, đánh ✓ / ✗ trên lưới kiểu Einstein.",
    rules: [
      "Có vài nhóm mục (ví dụ Người, Màu, Nghề). Mỗi mục của nhóm này ứng với đúng một mục của nhóm kia, và không có hai mục nào của cùng một nhóm trùng người.",
      "Dùng các manh mối để suy luận: đánh ✓ khi chắc chắn hai mục thuộc cùng một nhóm (cùng một người), đánh ✗ khi chắc chắn không.",
      "Mỗi ✓ loại mọi lựa chọn còn lại trong hàng và cột của nó, và bắc cầu giữa các khối (An mặc Đỏ, Đỏ nuôi Mèo ⇒ An nuôi Mèo).",
      "Nhóm có thứ tự (Vị trí, Tuổi) cho thêm manh mối so sánh: đứng trước, liền kề, hơn đúng k.",
      "Giải xong khi mọi mục đã nối đúng một người bằng ✓ và thoả mọi manh mối."
    ],
    sizes: SIZES,
    algorithm: {
      title: "Logic Grid như bài toán thoả mãn ràng buộc (CSP)",
      steps: [
        { title: "Mô hình hoá", text: "Mỗi mục ngoài nhóm đầu là một biến; miền là các mục của nhóm đầu (hàng nó thuộc về). Luật «mỗi nhóm một hoán vị» là ràng buộc alldiff; mỗi manh mối là một ràng buộc nhỏ trên 1–4 biến." },
        { title: "Lan truyền ràng buộc", text: "Với mỗi ràng buộc, loại những giá trị của một biến không còn được hỗ trợ bởi giá trị nào của các biến còn lại (nhất quán cung). alldiff gạt giá trị đã chốt khỏi biến khác và tìm «chỉ còn một chỗ»." },
        { title: "Lặp tới điểm cố định", text: "Mỗi lần thu hẹp miền một biến có thể đánh thức các ràng buộc khác; lặp tới khi không còn gì đổi. Đây chính là cách người giải đọc lại từng manh mối sau mỗi dấu ✓/✗ mới." },
        { title: "Quay lui khi bế tắc", text: "Nếu lan truyền không chốt hết: chọn biến còn ít giá trị nhất (MRV), thử từng giá trị rồi lan truyền; mâu thuẫn thì quay lại. Gợi ý «giả định rồi bác bỏ» chính là một nhánh quay lui ngắn." },
        { title: "Sinh đề", text: "Chọn một lời giải ngẫu nhiên, thêm dần các manh mối đúng (ưu tiên loại cắt nhiều nghiệm hoặc ít, tuỳ độ khó) tới khi nghiệm duy nhất, rồi tỉa từng manh mối thừa." }
      ],
      links: [{ id: "backtracking", label: "Quay lui (Backtracking)" }, { id: "dfs", label: "Tìm kiếm theo chiều sâu (DFS)" }]
    },
    difficultyNote: "Điểm 0–10 = cỡ (số nhóm × số mục) + độ phức tạp loại manh mối («hoặc», thứ tự) + độ sâu suy luận của một người giải mô phỏng: số lượt quét manh mối, bước kết hợp nhiều manh mối, bước giả định-rồi-bác-bỏ và số lần quay lui.",
    generate: generate, fromInput: fromInput, validate: validate, solve: solve, difficulty: difficulty, newState: newState, isGiven: isGiven, moveFor: moveFor, check: check, mistakes: mistakes,
    hint: hint, replay: replay, constraintView: constraintView, trace: trace, describeCell: describeCell, toFile: toFile, fromFile: fromFile, toText: toText, fromText: fromText,
    // ── tiện ích cho giao diện / trình soạn
    blocks: blocks,
    cellIndex: function (puzzle, ci, a, cj, b) { var d = dims(puzzle); return cellIndex(d.K, d.N, ci, a, cj, b); },
    cellInfo: function (puzzle, i) {
      var d = dims(puzzle), f = cellInfo(d.K, d.N, i), cats = puzzle.data.cats;
      f.ciName = cats[f.ci].name; f.cjName = cats[f.cj].name; f.aName = cats[f.ci].items[f.a]; f.bName = cats[f.cj].items[f.b];
      return f;
    },
    clueText: function (puzzle, k) { var d = puzzle.data; return clueText(d, typeof k === "number" ? d.clues[k] : k); },
    clueDSL: function (puzzle, k) { var d = puzzle.data; return formatClue(d, typeof k === "number" ? d.clues[k] : k); },
    parseClue: parseClue,
    /** formatClue(clue, data) → chuỗi DSL; clueTextOf(clue, data) → câu tiếng Việt (thứ tự đối số: manh mối trước, dữ liệu sau). */
    formatClue: function (clue, data) { return formatClue(data, clue); }, clueTextOf: function (clue, data) { return clueText(data, clue); },
    /** Dữ liệu mẫu cho Builder: ví dụ 3×3 của đặc tả. */
    exampleInput: function () {
      return { cats: [{ name: "Người", items: ["Alice", "Bob", "Carol"] }, { name: "Màu", items: ["Đỏ", "Xanh", "Lục"] }, { name: "Nghề", items: ["Bác sĩ", "Kỹ sư", "Giáo viên"] }],
        clues: ["Alice != Đỏ", "Xanh = Bob", "Carol != Bác sĩ", "Alice = Giáo viên"] };
    },
    /** Kho từ vựng cho Builder: [{kind, name, ordered, pool}]. */
    vocabulary: function () {
      return Object.keys(VOCAB).map(function (k) { var v = VOCAB[k]; return { kind: k, name: v.name, ordered: !!v.ordered, pool: v.pool ? v.pool.slice() : null }; });
    },
    limits: { maxCats: MAX_CATS, maxItems: MAX_ITEMS, maxClues: MAX_CLUES },
    internals: { simulate: simulate, featureOf: featureOf, scoreOf: scoreOf, DIFF: DIFF, H0: H0, cfgAt: cfgAt, attempt: attempt, MAX_TRY: MAX_TRY, analyzeData: analyzeData, markConflicts: markConflicts, closure: closure, solveP: solveP, problemFor: problemFor, buildModel: buildModel }
  };
  Puz.types.register(def);
})(typeof globalThis !== "undefined" ? globalThis : this);
