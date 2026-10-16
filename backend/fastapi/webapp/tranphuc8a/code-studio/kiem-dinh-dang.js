/* Kiểm trình định dạng "Tự viết": ví dụ cụ thể, lũy đẳng, bất biến từ tố, mã thật của dự án. Được kiem.js nạp. */
"use strict";
const fs = require("fs");
const path = require("path");

module.exports = function ({ nhom, kiem, bang, CS }) {
  nhom("format · tự viết");
  if (!CS.format) { kiem("có module format", false); return; }
  const F = CS.format, T = CS.tokenize;
  const fmt = (code, lang, o) => F.builtin(code, lang, o);
  const sigTokens = (s, lang) => T.run(s, lang).filter((t) => t.k !== "ws" && t.k !== "nl").map((t) => (t.k === "cm" || t.k === "pp" ? t.v.replace(/\s+/g, " ").trim() : t.v));
  const eq = (name, code, lang, want, o) => { const got = fmt(code, lang, o); kiem(name, got === want, "\n--- got ---\n" + got + "--- want ---\n" + want); };

  /* ---------------- C++ ---------------- */
  eq("C++ · mã viết dính một dòng được tách thành khối, thụt lề, khoảng trắng đúng", '#include <iostream>\nusing namespace std;int main(){int n;cin>>n;for(int i=0;i<n;i++){if(i%2==0){cout<<i<<endl;}else cout<<"odd";}return 0;}', "cpp",
    '#include <iostream>\nusing namespace std;\nint main() {\n    int n;\n    cin >> n;\n    for (int i = 0; i < n; i++) {\n        if (i % 2 == 0) {\n            cout << i << endl;\n        } else\n            cout << "odd";\n    }\n    return 0;\n}\n');
  eq("C++ · template: vector<vector<int>> không bị tách >>, vector<int> v; sau > có một dấu cách", "vector<vector<int>> v;map<string,int>m;vector<int>a(5);", "cpp", "vector<vector<int>> v;\nmap<string, int> m;\nvector<int> a(5);\n");
  eq("C++ · so sánh a<b không bị nhầm là template", "if(a<b&&c>d){x=a<b;}", "cpp", "if (a < b && c > d) {\n    x = a < b;\n}\n");
  eq("C++ · con trỏ/tham chiếu kiểu phải (int *p), phép nhân/địa chỉ/giải tham chiếu", "int *p=&x;int**pp=&p;Node *head=nullptr;int y=*p**p;int z=a*b;", "cpp",
    "int *p = &x;\nint **pp = &p;\nNode *head = nullptr;\nint y = *p * *p;\nint z = a * b;\n");
  eq("C++ · con trỏ kiểu trái (int* p)", "int *p=&x;const Foo& f=g;", "cpp", "int* p = &x;\nconst Foo& f = g;\n", { pointer: "left" });
  eq("C++ · switch/case/default thụt đúng, nhãn tách dòng", "switch(x){case 1:foo();break;case 2:{bar();break;}default:baz();}", "cpp",
    "switch (x) {\n    case 1:\n        foo();\n        break;\n    case 2: {\n        bar();\n        break;\n    }\n    default:\n        baz();\n}\n");
  eq("C++ · lớp: access specifier thụt ra, danh sách khởi tạo constructor", "class A:public B{public:A():x(1),y(2){}int get()const{return x;}private:int x,y;};", "cpp",
    "class A : public B {\npublic:\n    A() : x(1), y(2) {}\n    int get() const {\n        return x;\n    }\nprivate:\n    int x, y;\n};\n");
  eq("C++ · typedef struct {...} Name; giữ tên sau }", "typedef struct{int a;int b;}Point;", "c", "typedef struct {\n    int a;\n    int b;\n} Point;\n");
  eq("C++ · lambda làm đối số gọn một dòng", "sort(a.begin(),a.end(),[](int x,int y){return x<y;});", "cpp", "sort(a.begin(), a.end(), [](int x, int y) { return x < y; });\n");
  eq("C++ · lambda nhiều câu lệnh được tách dòng, đóng })", "for_each(v.begin(),v.end(),[&](int x){int y=x*2;cout<<y;});", "cpp",
    "for_each(v.begin(), v.end(), [&](int x) {\n    int y = x * 2;\n    cout << y;\n});\n");
  eq("C++ · if/else if/else không ngoặc: thân thụt thêm một mức", "if(a)x=1;else if(b)x=2;else x=3;", "cpp", "if (a)\n    x = 1;\nelse if (b)\n    x = 2;\nelse\n    x = 3;\n");
  eq("C++ · } else { cuddle (K&R), Allman đưa { xuống dòng", "if(a){x();}else{y();}", "cpp", "if (a) {\n    x();\n} else {\n    y();\n}\n");
  eq("C++ · kiểu Allman", "int main(){if(a){x();}else{y();}}", "cpp", "int main()\n{\n    if (a)\n    {\n        x();\n    }\n    else\n    {\n        y();\n    }\n}\n", { braces: "allman" });
  eq("C++ · do { } while (x);", "do{x();}while(a);", "cpp", "do {\n    x();\n} while (a);\n");
  eq("C++ · for(;;), toán tử ba ngôi, ép kiểu giữ nguyên", "for(;;){}int a=b?1:2;double d=(double)x/y;", "cpp", "for (;;) {}\nint a = b ? 1 : 2;\ndouble d = (double)x / y;\n");
  eq("C++ · cout << a << endl và cin >> n >> m", "cout<<a<<\" \"<<b<<endl;cin>>n>>m;", "cpp", 'cout << a << " " << b << endl;\ncin >> n >> m;\n');
  eq("C++ · ++/--/! một ngôi và hai ngôi", "i++;--j;x=!y;z=-a+b;w=a- -b;", "cpp", "i++;\n--j;\nx = !y;\nz = -a + b;\nw = a - -b;\n");
  eq("C++ · tiền xử lý về cột 0, #define giữ nguyên", "int main(){\n#ifdef X\nfoo();\n#endif\n}\n#define MAX(a,b) ((a)>(b)?(a):(b))\n", "cpp", "int main() {\n#ifdef X\n    foo();\n#endif\n}\n#define MAX(a,b) ((a)>(b)?(a):(b))\n");
  eq("C++ · chú thích cuối dòng cách 2 dấu cách, khối chú thích thụt lại theo mã", "int x=1;// một\nvoid f(){\n/* a\n   b */\nint y;}\n", "cpp", "int x = 1;  // một\nvoid f() {\n    /* a\n       b */\n    int y;\n}\n");
  eq("C++ · dòng trống: giữ tối đa 2, bỏ ngay sau { và trước }", "int a;\n\n\n\n\nint b;\nvoid f(){\n\n\nint x;\n\n}\n", "cpp", "int a;\n\n\nint b;\nvoid f() {\n    int x;\n}\n");
  eq("C++ · enum một dòng giữ nguyên, nhiều dòng giữ cấu trúc", "enum Color{RED,GREEN,BLUE};\nenum class E{\nA,\nB\n};\n", "cpp", "enum Color { RED, GREEN, BLUE };\nenum class E {\n    A,\n    B\n};\n");
  eq("C++ · khởi tạo mảng/danh sách {1,2,3} không bị tách", "int a[]={1,2,3};vector<int>v{4,5};", "cpp", "int a[] = {1, 2, 3};\nvector<int> v{4, 5};\n");
  eq("C++ · hàm nhiều dòng tham số: dòng tiếp thụt 1 mức, { về đầu câu", "int f(int a,\nint b){\nreturn a+b;}", "cpp", "int f(int a,\n    int b) {\n    return a + b;\n}\n");
  eq("C++ · namespace và template hàm", "namespace a{template<typename T>T mx(T a,T b){return a>b?a:b;}}", "cpp", "namespace a {\ntemplate <typename T>\nT mx(T a, T b) {\n    return a > b ? a : b;\n}\n}\n".replace("template <typename T>\nT mx", "template <typename T> T mx").replace("template <typename T> T mx", "template <typename T>\nT mx"));
  eq("C++ · không gian trắng thừa dòng trống đầu/cuối và tab → thụt 4 dấu cách", "\n\nint main(){\n\treturn 0;   \n}\n\n\n", "cpp", "int main() {\n    return 0;\n}\n");
  eq("C++ · thụt bằng tab", "int main(){if(a){b();}}", "cpp", "int main() {\n\tif (a) {\n\t\tb();\n\t}\n}\n", { indent: "tab" });
  eq("C++ · thụt 2 dấu cách", "int main(){if(a){b();}}", "cpp", "int main() {\n  if (a) {\n    b();\n  }\n}\n", { indent: 2 });

  /* ---------------- tôn trọng mã đã gọn ---------------- */
  const tidyCode = 'int d(int a, int b) { return a + b; }\nint main() {\n    for (int i = 0; i < n; i++) scanf("%d", &a[i]);\n    if (x) continue;\n    for (int i = 0; i < n; i++) if (x[i]) { fx += p[i]; wx += w[i]; }\n    vector<int> v;                 // canh cột\n    long long tong = 0;            // canh cột\n    return 0;\n}\n';
  eq("giữ nguyên dòng gọn một dòng người viết cố ý + cột chú thích đã canh thẳng", tidyCode, "cpp", tidyCode);
  eq("keepOneLiners=false: tách hết", "int d(int a, int b) { return a + b; }\nfor (int i = 0; i < n; i++) f(i);\n", "cpp", "int d(int a, int b) {\n    return a + b;\n}\nfor (int i = 0; i < n; i++)\n    f(i);\n", { keepOneLiners: false });
  eq("dòng một-khối nhưng viết dính (if(a){b=1;}) vẫn được tách", "if(a){b=1;}\n", "cpp", "if (a) {\n    b = 1;\n}\n");
  eq("for lồng for có khối: câu sau thụt đúng mức", "void g() {\n    for (int i = 0; i < n; i++)\n        for (int j = 0; j < n; j++) {\n            a();\n        }\n    b();\n}\n", "cpp", "void g() {\n    for (int i = 0; i < n; i++)\n        for (int j = 0; j < n; j++) {\n            a();\n        }\n    b();\n}\n");
  eq("if một dòng {…} rồi else {…} ở dòng dưới: giữ hai dòng", "if (a) { x = 1; y = 2; }\nelse { x = 3; }\n", "cpp", "if (a) { x = 1; y = 2; }\nelse { x = 3; }\n");
  eq("kiểu con trỏ tự suy từ tệp (đa số T& x)", "void f(const vector<int>& a, int* p, string &s);\n", "cpp", "void f(const vector<int>& a, int* p, string& s);\n");
  eq("JS · khối trần { } đầu câu; spread ...x không cách", "const p = [0];\n{\nconst d = 1;\nprint([...a, ...b]);\n}\n", "javascript", "const p = [0];\n{\n  const d = 1;\n  print([...a, ...b]);\n}\n");
  eq("JS · callback một dòng gọn được giữ", "  sinhRa((r) => { const k = r.join(\",\"); if (k !== goc) S.add(k); });\n", "javascript", "sinhRa((r) => { const k = r.join(\",\"); if (k !== goc) S.add(k); });\n");

  /* ---------------- Java / JS / TS / Go / Rust / C# ---------------- */
  eq("Java · lớp + main + generics + chú thích", 'import java.util.*;public class Main{@Override public String toString(){return "x";}public static void main(String[] args){List<Map<String,Integer>> m=new ArrayList<>();for(String s:args){System.out.println(s);}}}', "java",
    'import java.util.*;\npublic class Main {\n    @Override public String toString() {\n        return "x";\n    }\n    public static void main(String[] args) {\n        List<Map<String, Integer>> m = new ArrayList<>();\n        for (String s : args) {\n            System.out.println(s);\n        }\n    }\n}\n');
  eq("Java · lambda ->, ternary", "list.forEach(x->System.out.println(x));int a=b>0?1:2;", "java", "list.forEach(x -> System.out.println(x));\nint a = b > 0 ? 1 : 2;\n");
  eq("JS · arrow, object, mảng, else", "const f=(a,b)=>{return a+b};let o={a:1,b:[1,2]};if(x){y()}else{z()}", "javascript",
    "const f = (a, b) => {\n  return a + b\n};\nlet o = { a: 1, b: [1, 2] };\nif (x) {\n  y()\n} else {\n  z()\n}\n");
  eq("JS · chuỗi/regex/template không bị đụng, === và ?? có dấu cách", "const r=/a\\/b/g.test(s)?`a ${b}`:\"c\";if(a===b||c??d){}", "javascript", "const r = /a\\/b/g.test(s) ? `a ${b}` : \"c\";\nif (a === b || c ?? d) {}\n");
  eq("JS · gọi hàm callback .then(function(){...})", "p.then(function(r){return r.json()}).catch(function(e){log(e)});", "javascript",
    "p.then(function (r) {\n  return r.json()\n}).catch(function (e) {\n  log(e)\n});\n");
  eq("TS · interface, kiểu tuỳ chọn x?: number, generics", "interface A{x?:number;y:string[];}function f<T>(a:T):T{return a;}", "typescript", "interface A {\n  x?: number;\n  y: string[];\n}\nfunction f<T>(a: T): T {\n  return a;\n}\n");
  eq("Go · gofmt kiểu: tab, :=, for range, if err != nil", "func main(){x:=1\nfor _,v:=range xs{fmt.Println(v)}\nif err!=nil{return}}", "go", "func main() {\n\tx := 1\n\tfor _, v := range xs {\n\t\tfmt.Println(v)\n\t}\n\tif err != nil {\n\t\treturn\n\t}\n}\n");
  eq("Rust · fn, let mut, ->, match", "fn f(a:i32)->i32{let mut x=a;match x{1=>2,_=>3}}", "rust", "fn f(a: i32) -> i32 {\n    let mut x = a;\n    match x {\n        1 => 2,\n        _ => 3\n    }\n}\n".replace("1 => 2,\n        _ => 3\n", "1 => 2,\n        _ => 3\n"));
  eq("C# · lớp + Console", 'using System;class P{static void Main(){Console.WriteLine("hi");int? n=null;}}', "csharp", 'using System;\nclass P {\n    static void Main() {\n        Console.WriteLine("hi");\n        int? n = null;\n    }\n}\n');

  /* ---------------- Python / JSON / CSS / SQL / HTML ---------------- */
  eq("Python · thụt tab/lộn xộn → 4 dấu cách, toán tử, kwargs không dấu cách", "def f(a,b = 2):\n\tif a>b :\n\t    return a\n\treturn b\nx=1+2*3\nprint (f(1,b = 3))\n", "python", "def f(a, b=2):\n    if a > b:\n        return a\n    return b\nx = 1 + 2 * 3\nprint (f(1, b=3))\n".replace("print (f", "print(f"));
  eq("Python · chuỗi nhiều dòng giữ nguyên, nối dòng trong ngoặc thụt 1 mức, comment riêng dòng", 'def f():\n  s = """a\n   b"""\n  x = foo(1,\n        2)\n  # note\n  return s\n', "python", 'def f():\n    s = """a\n   b"""\n    x = foo(1,\n        2)\n    # note\n    return s\n'.replace("foo(1,\n        2)", "foo(1,\n        2)"));
  eq("Python · chú thích sau mã cách 2 dấu cách; lambda/slice/dict", "a=[1,2,3][1:2]  # c\nd={'k':1}\nf=lambda x:x+1\n", "python", "a = [1, 2, 3][1:2]  # c\nd = {'k': 1}\nf = lambda x: x + 1\n");
  eq("JSON · làm đẹp; lỗi → ném (format() sẽ bắt)", '{"a":1,"b":[1,2],"c":{"d":null}}', "json", '{\n  "a": 1,\n  "b": [\n    1,\n    2\n  ],\n  "c": {\n    "d": null\n  }\n}\n');
  eq("CSS · tách khối, thuộc tính, bộ chọn nhiều cái, :hover", "a,b{color:red;margin:0 auto}a:hover{x:y}", "css", "a,\nb {\n  color: red;\n  margin: 0 auto\n}\na:hover {\n  x: y\n}\n");
  eq("SQL · viết hoa từ khoá, xuống dòng theo mệnh đề", "select a,b from t where x=1 and y=2 order by a;", "sql", "SELECT a, b\nFROM t\nWHERE x = 1 AND y = 2\nORDER BY a;\n");
  eq("HTML · thụt lại theo cấu trúc thẻ", "<html>\n<body>\n<div>\n<p>x</p>\n<br>\n</div>\n</body>\n</html>\n", "html", "<html>\n  <body>\n    <div>\n      <p>x</p>\n      <br>\n    </div>\n  </body>\n</html>\n");

  /* ---------------- run(): nhà cung cấp, lỗi, rơi về builtin ---------------- */
  return Promise.resolve().then(async () => {
    const r1 = await F.run("int main(){return 0;}", "cpp", {});
    kiem("run · mặc định dùng builtin", r1.ok && r1.provider === "builtin" && r1.text === "int main() {\n    return 0;\n}\n");
    const r2 = await F.run('{"a":', "json", {});
    kiem("run · JSON hỏng → ok=false, text giữ nguyên, có thông báo", !r2.ok && r2.text === '{"a":' && /định dạng/i.test(r2.error || ""));
    const r3 = await F.run("int main(){}", "cpp", { provider: "khong-co" });
    kiem("run · nhà cung cấp không tồn tại → rơi về builtin và báo", r3.ok && r3.provider === "builtin" && /không có nhà cung cấp/i.test(r3.error || ""));
    F.register({ id: "hong", label: "Hỏng", kind: "wasm", langs: ["cpp"], format: () => Promise.reject(new Error("mất mạng")) });
    const r4 = await F.run("int a;", "cpp", { provider: "hong" });
    kiem("run · nhà cung cấp ném lỗi → rơi về builtin, vẫn ok, nêu lý do", r4.ok && r4.provider === "builtin" && /mất mạng/.test(r4.error));
    const r5 = await F.run("int a;", "python", { provider: "hong" });
    kiem("run · nhà cung cấp không hỗ trợ ngôn ngữ → rơi về builtin", r5.ok && /không hỗ trợ/.test(r5.error || ""));
    kiem("listFor · cpp có builtin; json cũng có", F.listFor("cpp").some((p) => p.id === "builtin") && F.listFor("json").some((p) => p.id === "builtin"));

    /* ---------------- tính chất: lũy đẳng + bất biến từ tố trên mã thật ---------------- */
    nhom("format · tính chất trên mã thật của dự án");
    const root = path.join(__dirname, "..", "..", "courses", "heuristic-practice-2");
    const samples = [];
    /* mẫu thật: khung/lời giải C++ (có #include) và JavaScript (có readInput) trong các bài thực hành heuristic */
    const grab = (file) => {
      if (!fs.existsSync(file)) return;
      const src = fs.readFileSync(file, "utf8"), re = /String\.raw`((?:[^`\\]|\\.)*)`/g;
      let m;
      while ((m = re.exec(src))) {
        const code = m[1].replace(/\r\n?/g, "\n");
        if (/#include/.test(code)) samples.push({ lang: "cpp", code, from: path.basename(file) });
        else if (/readInput\(|function\s+\w+\(/.test(code)) samples.push({ lang: "javascript", code, from: path.basename(file) });
      }
    };
    grab(path.join(root, "assets", "ui", "ide.js"));
    const dataDir = path.join(root, "data");
    if (fs.existsSync(dataDir)) fs.readdirSync(dataDir).filter((f) => /^bai-.*\.js$/.test(f)).forEach((f) => grab(path.join(dataDir, f)));
    // + mẫu tự dựng nhiều kiểu "xấu"
    const ugly = ['#include<bits/stdc++.h>\nusing namespace std;\nint n,a[100005];long long dp[1005][1005];\nbool cmp(pair<int,int>a,pair<int,int>b){return a.first<b.first||(a.first==b.first&&a.second>b.second);}\nint main(){ios::sync_with_stdio(0);cin.tie(0);cin>>n;for(int i=1;i<=n;++i)cin>>a[i];sort(a+1,a+n+1);priority_queue<pair<int,int>,vector<pair<int,int>>,greater<pair<int,int>>>pq;while(!pq.empty()){auto [d,u]=pq.top();pq.pop();if(d>dist[u])continue;for(auto&e:g[u])if(dist[e.v]>d+e.w){dist[e.v]=d+e.w;pq.push({dist[e.v],e.v});}}printf("%d\\n",a[n]);return 0;}',
      'int f(int x){\nreturn x>0?\nx:\n-x;\n}\nstruct A{int a;A(int a):a(a){}bool operator<(const A&o)const{return a<o.a;}};\nvoid g(){int *p=new int[5];delete[] p;auto h=[&](int i)->int{return i*2;};}'];
    ugly.forEach((c) => samples.push({ lang: "cpp", code: c, from: "tự dựng" }));
    const nCpp = samples.filter((s) => s.lang === "cpp").length, nJs = samples.filter((s) => s.lang === "javascript").length;
    kiem("có mẫu thật để thử: ≥ 60 C++ và ≥ 60 JavaScript", nCpp >= 60 && nJs >= 60, nCpp + " C++, " + nJs + " JS");
    let badInv = "", badIdem = "", changed = 0, errs = "";
    samples.forEach((s, ix) => {
      let out1, out2;
      try { out1 = fmt(s.code, s.lang); out2 = fmt(out1, s.lang); } catch (e) { errs += s.from + "#" + ix + ": " + e.message + "\n"; return; }
      if (!bang(sigTokens(out1, s.lang), sigTokens(s.code, s.lang)) && !badInv) badInv = s.from + "#" + ix;
      if (out1 !== out2 && !badIdem) badIdem = s.from + "#" + ix + "\n--- 1 ---\n" + out1 + "\n--- 2 ---\n" + out2;
      if (out1 !== (s.code.endsWith("\n") ? s.code : s.code + "\n")) changed++;
    });
    kiem("không ném lỗi trên mã thật", !errs, errs);
    kiem("bất biến từ tố: định dạng không thêm/bớt/đổi một từ tố nào", !badInv, badInv);
    kiem("lũy đẳng: định dạng lần 2 không đổi gì", !badIdem, badIdem);
    console.log("    (" + (samples.length - changed) + "/" + samples.length + " mẫu vốn đã đúng chuẩn → giữ nguyên)");

    // các ngôn ngữ khác: bất biến + lũy đẳng với mẫu Hello và mẫu bẩn
    let bad2 = "";
    CS.langs.order.forEach((id) => {
      [CS.langs.get(id).hello, CS.langs.get(id).hello.replace(/\n/g, "\n\n\n\n").replace(/  +/g, "   "), CS.langs.get(id).hello.replace(/\n\s*/g, " ")].forEach((c, k) => {
        if (!c.trim()) return;
        let o1, o2;
        try { o1 = fmt(c, id); o2 = fmt(o1, id); } catch (e) { if (id === "json") return; bad2 = id + "#" + k + " ném " + e.message; return; }
        if (o1 !== o2 && !bad2) bad2 = id + "#" + k + " không lũy đẳng:\n" + o1 + "\n≠\n" + o2;
        if (id !== "sql" && id !== "json" && id !== "markdown" && id !== "html" && !bang(sigTokens(o1, id), sigTokens(c, id)) && !bad2) bad2 = id + "#" + k + " đổi từ tố:\n" + o1;
      });
    });
    kiem("19 ngôn ngữ × 3 biến thể mẫu Hello: không lỗi, lũy đẳng, giữ từ tố", !bad2, bad2);

    // ngẫu nhiên: ghép các mảnh C++ hợp lệ, nối kiểu dính → vẫn bất biến + lũy đẳng
    const pieces = ["int a=1;", "if(x){y();}", "for(int i=0;i<n;i++){s+=i;}", "while(a<b)a++;", "vector<int> v;", "x=a*b+c;", "p=&q;", "foo(1,2);", "return 0;", "switch(k){case 1:break;default:;}", "do{a--;}while(a>0);", "auto f=[&](int t){return t;};", "// c\n", "/* b */", "struct S{int a;};", "else{}", "bool b=a<c&&d>e;"];
    let rnd = 99; const nxt = () => (rnd = (rnd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    let badR = "";
    for (let r = 0; r < 300 && !badR; r++) {
      let code = "int main(){"; const k = 1 + Math.floor(nxt() * 8);
      for (let q = 0; q < k; q++) code += pieces[Math.floor(nxt() * pieces.length)] + (nxt() < 0.3 ? "\n" : "");
      code += "}";
      let o1, o2;
      try { o1 = fmt(code, "cpp"); o2 = fmt(o1, "cpp"); } catch (e) { badR = "ném: " + e.message + "\n" + code; break; }
      if (!bang(sigTokens(o1, "cpp"), sigTokens(code, "cpp"))) badR = "đổi từ tố:\n" + code + "\n→\n" + o1;
      else if (o1 !== o2) badR = "không lũy đẳng:\n" + code + "\n→\n" + o1 + "\n→\n" + o2;
    }
    kiem("ngẫu nhiên · 300 chương trình C++ ghép từ mảnh: giữ từ tố + lũy đẳng", !badR, badR);
    const big = fs.existsSync(path.join(root, "data", "bai-05-greedy.js")) ? fs.readFileSync(path.join(root, "data", "bai-05-greedy.js"), "utf8") : "int a;\n".repeat(3000);
    const t0 = Date.now(); fmt(big.repeat(3), "javascript");
    kiem("hiệu năng · định dạng ~" + Math.round(big.length * 3 / 1024) + " KB JS dưới 1,5 giây", Date.now() - t0 < 1500 * global.PERF_SLACK, String(Date.now() - t0));
  });
};
