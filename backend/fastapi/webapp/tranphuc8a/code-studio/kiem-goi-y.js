/* Kiểm bộ gợi ý khi gõ (complete.js). Được kiem.js nạp. */
"use strict";
module.exports = function ({ nhom, kiem, bang, CS }) {
  nhom("complete · gợi ý khi gõ");
  if (!CS.complete) { kiem("có module complete", false); return; }
  const C = CS.complete;
  /* `|` đánh dấu vị trí con trỏ */
  const at = (code, lang, o) => { const pos = code.indexOf("|"); return C.suggest(Object.assign({ text: code.replace("|", ""), pos, lang }, o || {})); };
  const labels = (r) => r.items.map((x) => x.label);
  const first = (r) => (r.items[0] || {}).label;

  kiem("matchScore · tiền tố > không phân biệt hoa > chữ đầu (pb→push_back) > rải > không khớp",
    C.matchScore("push_back", "push") > C.matchScore("Push_back", "push") && C.matchScore("Push_back", "push") > C.matchScore("push_back", "pb") && C.matchScore("push_back", "pb") > C.matchScore("pushback", "pbk") && C.matchScore("size", "zz") === 0);
  kiem("initials · camelCase, snake_case, PascalCase", C.initials("pushBack") === "pb" && C.initials("push_back") === "pb" && C.initials("HashMap") === "hm" && C.initials("lower_bound") === "lb");

  /* C++ */
  let r = at("vector<int> v;\nv.|", "cpp");
  kiem("C++ · v. với vector<int> v → push_back, size, begin…", r.context === "member" && ["push_back", "size", "begin", "empty"].every((x) => labels(r).includes(x)) && first(r) === "push_back", labels(r).slice(0, 6).join(","));
  r = at("vector<int> a, b;\nb.pb|", "cpp");
  kiem("C++ · khai báo nhiều biến một dòng + gõ tắt pb → push_back đứng đầu", first(r) === "push_back", labels(r).slice(0, 4).join(","));
  r = at("string s = \"x\";\ns.su|", "cpp");
  kiem("C++ · string s; s.su → substr", first(r) === "substr", labels(r).join(","));
  r = at("map<string, vector<int>> g;\ng.|", "cpp");
  kiem("C++ · map lồng template → find, count, insert", ["find", "count", "insert"].every((x) => labels(r).includes(x)));
  r = at("#include <vec|", "cpp");
  kiem("C++ · #include <vec → vector, chèn kèm dấu >", r.context === "include" && first(r) === "vector" && r.items[0].insert === "vector>");
  r = at("#inc|", "cpp");
  kiem("C++ · # đầu dòng → chỉ thị include", r.context === "pp" && first(r) === "include");
  r = at('printf("ret|', "cpp");
  kiem("trong chuỗi chưa đóng: không gợi ý", r.items.length === 0 && r.context === "none");
  r = at("// ret|", "cpp");
  kiem("trong chú thích: không gợi ý", r.items.length === 0);
  r = at("/* a\nret|", "cpp");
  kiem("trong chú thích khối chưa đóng (nhiều dòng): không gợi ý", r.items.length === 0);
  r = at('x = "a" + re|', "cpp");
  kiem("sau chuỗi đã đóng: gợi ý bình thường (return)", labels(r).includes("return"));
  r = at("int main() {\n    ret|\n}", "cpp");
  kiem("từ khoá: ret → return đầu tiên", first(r) === "return" && r.from === 17 && r.to === 20, JSON.stringify([first(r), r.from, r.to]));
  r = at("int totalSum = 0, total = 1;\nint x = tot|;", "cpp");
  kiem("tên trong tệp: tot → total, totalSum (không gợi ý chính từ đang gõ)", labels(r).includes("totalSum") && labels(r).includes("total") && !labels(r).includes("tot"));
  r = at("int main() {\n    fo|", "cpp");
  const sn = r.items.find((x) => x.label === "for" && x.snippet);
  kiem("snippet: fo → mẫu vòng for", !!sn && /for \(int i = 0;/.test(sn.insert));
  const ap = C.apply("int main() {\n    fo\n}", r, sn, "    ");
  kiem("apply(snippet): thụt theo dòng hiện tại, con trỏ ở $0", ap.text === "int main() {\n    for (int i = 0; i < n; i++) {\n        \n    }\n}" && ap.cursor === ap.text.indexOf("{\n        ") + 10, JSON.stringify(ap));
  const ap2 = C.apply("int main() {\n\tfo\n}", Object.assign({}, r, { from: 14, to: 16 }), sn, "\t");
  kiem("apply(snippet): thụt bằng tab khi tệp dùng tab", ap2.text === "int main() {\n\tfor (int i = 0; i < n; i++) {\n\t\t\n\t}\n}", JSON.stringify(ap2.text));
  const ap3 = C.apply("v.pu_x", { from: 2, to: 6 }, { insert: "push_back", snippet: false });
  kiem("apply(từ): thay cả phần còn lại của từ dưới con trỏ", ap3.text === "v.push_back" && ap3.cursor === 11);
  r = at("std::|", "cpp");
  kiem("std:: → kiểu + hàm của thư viện chuẩn", r.context === "member" && labels(r).includes("vector") && first(at("std::so|", "cpp")) === "sort" && first(at("std::vec|", "cpp")) === "vector", labels(r).slice(0, 8).join(","));
  r = at("int a[5];\nArray.|", "javascript");
  kiem("JS · Array. (tên kiểu) → thành viên tĩnh isArray/from trước", ["isArray", "from"].includes(first(at("Array.|", "javascript"))));
  r = at("Node *p = head;\nwhile (p) { cout << p->val; p = p->next; }\np->|", "cpp");
  kiem("-> với kiểu chưa rõ: dùng tên thành viên đã gặp với cùng biến", labels(r).includes("next") && labels(r).includes("val"));

  /* Java */
  r = at("Scanner sc = new Scanner(System.in);\nint n = sc.ne|", "java");
  kiem("Java · Scanner sc; sc.ne → nextInt, nextLine…", labels(r).includes("nextInt") && labels(r).includes("nextLine"), labels(r).join(","));
  r = at("System.out.pr|", "java");
  kiem("Java · System.out.pr → println", first(r) === "println", labels(r).join(","));
  r = at("List<Integer> a = new ArrayList<>();\na.|", "java");
  kiem("Java · List<Integer> a → add, get, size", ["add", "get", "size"].every((x) => labels(r).includes(x)));
  r = at("psv|", "java");
  kiem("Java · psv → snippet psvm (khớp rải)", labels(r).includes("psvm"));

  /* JS / Python */
  r = at("const a = [];\na.pu|", "javascript");
  kiem("JS · const a = [] → a.push", first(r) === "push");
  r = at("const s = 'x';\ns.toUp|", "javascript");
  kiem("JS · chuỗi → toUpperCase", first(r) === "toUpperCase");
  r = at("console.l|", "javascript");
  kiem("JS · console.l → log", first(r) === "log");
  r = at('s = input()\ns.sp|', "python");
  kiem("Python · s = input() → s.split", first(r) === "split", labels(r).join(","));
  r = at("import math\nx = math.sq|", "python");
  kiem("Python · math.sq → sqrt", first(r) === "sqrt");
  r = at("d = {}\nd.ke|", "python");
  kiem("Python · dict → keys", first(r) === "keys");
  r = at("de|", "python");
  kiem("Python · de → def (từ khoá) và snippet def", labels(r).includes("def") && r.items.some((x) => x.label === "def" && x.snippet));

  /* chung */
  r = at("int a;\n|", "cpp");
  kiem("không có tiền tố, không gọi tường minh → không bật danh sách", r.items.length === 0);
  r = at("int a;\n|", "cpp", { explicit: true });
  kiem("Ctrl+Space (explicit) không tiền tố → vẫn có danh sách", r.items.length > 0);
  r = at("x = fooB|", "cpp", { extraWords: ["fooBar", "fooBaz"] });
  kiem("extraWords: tên từ tệp khác trong dự án", labels(r).includes("fooBar") && labels(r).includes("fooBaz"));
  kiem("giới hạn số mục", at("a|", "cpp", { limit: 5 }).items.length <= 5);
  const big = ("vector<int> v" + "x;\nint f(int a) { return a + 1; }\n").repeat(1500) + "v.|";
  const t0 = Date.now(); at(big, "cpp");
  kiem("hiệu năng · gợi ý trong tệp ~3.000 dòng dưới 150 ms", Date.now() - t0 < 150 * global.PERF_SLACK, String(Date.now() - t0) + " ms");
};
