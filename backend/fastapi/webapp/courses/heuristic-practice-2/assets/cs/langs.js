/* ==========================================================================
   FILE SINH RA - DUNG SUA O DAY.
   Nguon that: tranphuc8a/code-studio/assets/core/langs.js
   Sua o do roi chay: python tranphuc8a/code-studio/sync.py
   ========================================================================== */
/* langs.js — bảng ngôn ngữ của Code Studio: tên, đuôi tệp, cú pháp để tô màu/định dạng, từ khoá/ký hiệu có sẵn để gợi ý,
   mẫu đoạn mã (snippet) và mẫu "Hello". Thuần dữ liệu + vài hàm tra cứu — không DOM, kiểm bằng node (kiem.js).
   Mẫu snippet: `$0` là chỗ đặt con trỏ sau khi chèn. */
(function (root) {
  "use strict";
  var CS = root.CS || (root.CS = {});

  function set(s) { var o = Object.create(null); String(s || "").split(/\s+/).forEach(function (w) { if (w) o[w] = 1; }); return o; }

  var C_KW = "auto break case const continue default do else enum extern for goto if inline register restrict return sizeof static struct switch typedef union volatile while _Bool _Complex";
  var C_TY = "void char short int long float double signed unsigned size_t ssize_t ptrdiff_t int8_t int16_t int32_t int64_t uint8_t uint16_t uint32_t uint64_t bool FILE";
  var CPP_KW = C_KW + " alignas alignof and and_eq asm bitand bitor catch class compl concept consteval constexpr constinit const_cast co_await co_return co_yield decltype delete dynamic_cast explicit export false friend mutable namespace new noexcept not not_eq nullptr operator or or_eq override final private protected public reinterpret_cast requires static_assert static_cast template this thread_local throw true try typeid typename using virtual xor xor_eq";
  var CPP_TY = C_TY + " wchar_t char8_t char16_t char32_t string string_view vector map set unordered_map unordered_set list deque stack queue priority_queue pair tuple array bitset optional variant function shared_ptr unique_ptr weak_ptr mt19937 mt19937_64 istream ostream stringstream ifstream ofstream iterator long";
  var JAVA_KW = "abstract assert break case catch class const continue default do else enum extends final finally for goto if implements import instanceof interface native new package private protected public return static strictfp super switch synchronized this throw throws transient try volatile while var record sealed permits yield true false null";
  var JAVA_TY = "void boolean byte char short int long float double String Object Integer Long Double Float Boolean Character Byte Short List ArrayList LinkedList Map HashMap TreeMap LinkedHashMap Set HashSet TreeSet Queue Deque ArrayDeque PriorityQueue Stack Vector Optional Scanner BufferedReader InputStreamReader PrintWriter StringBuilder Math Arrays Collections System Random Iterator Comparable Comparator Runnable Thread Exception RuntimeException IOException";
  var JS_KW = "async await break case catch class const continue debugger default delete do else export extends finally for function if import in instanceof let new of return static super switch this throw try typeof var void while with yield true false null undefined NaN Infinity get set from as";
  var TS_KW = JS_KW + " abstract declare enum implements interface keyof namespace private protected public readonly type unknown never infer is satisfies override";
  var TS_TY = "string number boolean any object symbol bigint void never unknown Array Map Set Promise Record Partial Required Readonly Pick Omit Date RegExp Error";
  var PY_KW = "False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case";
  var PY_TY = "int float str bool list dict set tuple bytes bytearray complex frozenset object type range";
  var CS_KW = "abstract as base break case catch checked class const continue default delegate do else enum event explicit extern false finally fixed for foreach goto if implicit in interface internal is lock namespace new null operator out override params private protected public readonly ref return sealed sizeof stackalloc static struct switch this throw true try typeof unchecked unsafe using virtual volatile while var async await record init required";
  var CS_TY = "void bool byte sbyte char decimal double float int uint long ulong short ushort object string dynamic List Dictionary HashSet Queue Stack Console Math String StringBuilder Array";
  var GO_KW = "break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var true false nil iota";
  var GO_TY = "bool byte complex64 complex128 error float32 float64 int int8 int16 int32 int64 rune string uint uint8 uint16 uint32 uint64 uintptr any";
  var RS_KW = "as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while";
  var RS_TY = "i8 i16 i32 i64 i128 isize u8 u16 u32 u64 u128 usize f32 f64 bool char str String Vec Option Result Box Rc Arc HashMap HashSet BTreeMap BTreeSet VecDeque";
  var KT_KW = "abstract annotation as break by catch class companion const constructor continue crossinline data do dynamic else enum external false final finally for fun get if import in infix init inline inner interface internal is lateinit noinline null object open operator out override package private protected public reified return sealed set super suspend tailrec this throw true try typealias typeof val var vararg when where while";
  var KT_TY = "Int Long Short Byte Float Double Boolean Char String Unit Any Nothing Array List MutableList Map MutableMap Set MutableSet Pair";
  var PHP_KW = "abstract and array as break callable case catch class clone const continue declare default do echo else elseif empty enddeclare endfor endforeach endif endswitch endwhile extends final finally fn for foreach function global goto if implements include include_once instanceof insteadof interface isset list match namespace new or print private protected public readonly require require_once return static switch throw trait try unset use var while xor yield true false null";
  var RB_KW = "BEGIN END alias and begin break case class def defined? do else elsif end ensure false for if in module next nil not or redo rescue retry return self super then true undef unless until when while yield puts require require_relative attr_accessor attr_reader attr_writer";
  var SH_KW = "if then else elif fi for while until do done case esac in function select time return exit break continue local export readonly declare unset shift echo printf read cd test";
  var SQL_KW = "select from where group by order having limit offset insert into values update set delete create table alter drop index view join inner left right full outer cross on as and or not null is in between like exists union all distinct case when then else end primary key foreign references default unique check constraint asc desc count sum avg min max";

  var HELLO_C = '#include <stdio.h>\n\nint main(void) {\n    printf("Hello, World!\\n");\n    return 0;\n}\n';

  var L = {
    c: { id: "c", name: "C", exts: ["c", "h"], family: "c", kw: C_KW, ty: C_TY, pp: true, file: "main.c", tab: 4,
      hello: HELLO_C,
      builtins: "printf scanf puts putchar getchar gets fgets fputs fopen fclose fread fwrite fprintf fscanf sprintf snprintf sscanf malloc calloc realloc free memcpy memmove memset memcmp strlen strcpy strncpy strcat strncat strcmp strncmp strchr strrchr strstr strtok atoi atol atof strtol strtod abs labs fabs sqrt pow exp log log10 sin cos tan floor ceil round rand srand time clock exit abort qsort bsearch isalpha isdigit isspace isupper islower toupper tolower EOF NULL INT_MAX INT_MIN LONG_MAX LLONG_MAX RAND_MAX stdin stdout stderr",
      includes: "stdio.h stdlib.h string.h math.h ctype.h time.h limits.h stdint.h stdbool.h assert.h errno.h float.h locale.h signal.h stdarg.h stddef.h",
      snippets: [
        ["main", "int main(void) {\n    $0\n    return 0;\n}"], ["for", "for (int i = 0; i < n; i++) {\n    $0\n}"], ["while", "while ($0) {\n    \n}"],
        ["if", "if ($0) {\n    \n}"], ["ifelse", "if ($0) {\n    \n} else {\n    \n}"], ["switch", "switch ($0) {\n    case 0:\n        break;\n    default:\n        break;\n}"],
        ["struct", "typedef struct {\n    $0\n} Name;"], ["printf", "printf(\"$0\\n\");"], ["scanf", "scanf(\"%d\", &$0);"], ["inc", "#include <$0>"]] },
    cpp: { id: "cpp", name: "C++", exts: ["cpp", "cc", "cxx", "hpp", "hh", "hxx", "h++", "cu"], family: "c", kw: CPP_KW, ty: CPP_TY, pp: true, file: "main.cpp", tab: 4, raw: true,
      hello: '#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}\n',
      builtins: "cout cin cerr clog endl getline swap min max abs sort stable_sort reverse unique lower_bound upper_bound binary_search find find_if count count_if accumulate iota fill copy transform for_each next_permutation prev_permutation max_element min_element nth_element partial_sum make_pair make_tuple make_shared make_unique move forward to_string stoi stol stoll stod sqrt pow floor ceil fabs hypot atan2 sin cos exp log printf scanf puts putchar memset memcpy rand srand chrono steady_clock high_resolution_clock duration_cast milliseconds microseconds nullptr npos INT_MAX INT_MIN LLONG_MAX ios_base sync_with_stdio tie setprecision fixed setw",
      includes: "iostream vector string map set unordered_map unordered_set list deque stack queue algorithm numeric cmath cstdio cstdlib cstring climits cstdint cctype ctime chrono random functional iterator memory utility tuple array bitset sstream fstream iomanip limits cassert optional variant bits/stdc++.h",
      members: {
        vector: "push_back pop_back size empty clear resize reserve begin end rbegin rend front back at insert erase assign emplace_back capacity shrink_to_fit data swap",
        string: "size length empty clear substr find rfind find_first_of find_last_of replace erase insert append push_back pop_back c_str begin end front back at compare resize reserve data swap",
        map: "size empty clear find count insert erase begin end rbegin rend lower_bound upper_bound emplace at operator[] contains swap",
        set: "size empty clear find count insert erase begin end rbegin rend lower_bound upper_bound emplace contains swap",
        stack: "push pop top size empty emplace", queue: "push pop front back size empty emplace", priority_queue: "push pop top size empty emplace",
        deque: "push_back push_front pop_back pop_front size empty clear front back begin end at insert erase emplace_back emplace_front",
        pair: "first second", cout: "flush put write", cin: "get getline ignore peek read clear eof fail good",
        array: "size empty fill begin end front back at data swap", bitset: "set reset flip test count size any none all to_string to_ulong"
      },
      snippets: [
        ["main", "int main() {\n    $0\n    return 0;\n}"], ["for", "for (int i = 0; i < n; i++) {\n    $0\n}"], ["forr", "for (auto& x : $0) {\n    \n}"], ["fori", "for (int i = 0; i < n; i++) {\n    $0\n}"],
        ["while", "while ($0) {\n    \n}"], ["if", "if ($0) {\n    \n}"], ["ifelse", "if ($0) {\n    \n} else {\n    \n}"], ["switch", "switch ($0) {\n    case 0:\n        break;\n    default:\n        break;\n}"],
        ["class", "class Name {\npublic:\n    Name() {}\n    $0\nprivate:\n};"], ["struct", "struct Name {\n    $0\n};"], ["cout", "cout << $0 << endl;"], ["cin", "cin >> $0;"],
        ["fast", "ios_base::sync_with_stdio(false);\ncin.tie(nullptr);"], ["inc", "#include <$0>"], ["bits", "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    $0\n    return 0;\n}"],
        ["lambda", "[&]($0) {\n    \n}"], ["template", "template <typename T>\n$0"], ["sort", "sort($0.begin(), $0.end());"], ["vec", "vector<int> $0;"]] },
    java: { id: "java", name: "Java", exts: ["java"], family: "c", kw: JAVA_KW, ty: JAVA_TY, anno: true, file: "Main.java", tab: 4,
      hello: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}\n',
      builtins: "System out in err println print printf format length size get set add remove contains isEmpty equals hashCode toString compareTo valueOf parseInt parseDouble parseLong max min abs sqrt pow floor ceil round random sort asList stream forEach map filter collect reduce nextInt nextLine next hasNext readLine split trim substring charAt indexOf replace toCharArray append insert reverse",
      imports: "java.util.* java.util.Scanner java.util.List java.util.ArrayList java.util.Map java.util.HashMap java.io.* java.io.BufferedReader java.io.InputStreamReader java.util.stream.* java.util.function.* java.math.BigInteger java.math.BigDecimal",
      members: {
        System: "out in err currentTimeMillis nanoTime exit arraycopy lineSeparator", "System.out": "println print printf format flush",
        String: "length charAt substring indexOf lastIndexOf equals equalsIgnoreCase compareTo contains startsWith endsWith isEmpty trim split replace toUpperCase toLowerCase toCharArray format valueOf join strip repeat",
        List: "add get set remove size isEmpty contains indexOf clear sort forEach stream addAll subList", ArrayList: "add get set remove size isEmpty contains indexOf clear sort forEach stream addAll subList",
        Map: "put get containsKey containsValue remove size isEmpty keySet values entrySet getOrDefault putIfAbsent merge computeIfAbsent forEach", HashMap: "put get containsKey containsValue remove size isEmpty keySet values entrySet getOrDefault putIfAbsent merge computeIfAbsent forEach",
        Math: "abs max min pow sqrt cbrt floor ceil round random sin cos tan atan2 log log10 exp hypot signum floorMod PI E",
        StringBuilder: "append insert reverse toString length charAt deleteCharAt setCharAt delete replace indexOf setLength",
        Arrays: "sort fill asList toString deepToString copyOf copyOfRange equals stream binarySearch", Collections: "sort reverse shuffle max min unmodifiableList emptyList swap",
        Scanner: "nextInt nextLong nextDouble next nextLine hasNext hasNextInt hasNextLine close"
      },
      snippets: [
        ["main", "public static void main(String[] args) {\n    $0\n}"], ["psvm", "public static void main(String[] args) {\n    $0\n}"], ["sout", "System.out.println($0);"], ["for", "for (int i = 0; i < n; i++) {\n    $0\n}"],
        ["foreach", "for (var x : $0) {\n    \n}"], ["while", "while ($0) {\n    \n}"], ["if", "if ($0) {\n    \n}"], ["ifelse", "if ($0) {\n    \n} else {\n    \n}"], ["class", "public class Name {\n    $0\n}"],
        ["try", "try {\n    $0\n} catch (Exception e) {\n    e.printStackTrace();\n}"], ["scanner", "Scanner sc = new Scanner(System.in);"], ["switch", "switch ($0) {\n    case 1:\n        break;\n    default:\n        break;\n}"]] },
    javascript: { id: "javascript", name: "JavaScript", exts: ["js", "mjs", "cjs", "jsx"], family: "c", kw: JS_KW, ty: "Array Object String Number Boolean Map Set Promise Date RegExp Error Symbol BigInt JSON Math", tpl: true, regex: true, file: "main.js", tab: 2,
      hello: 'console.log("Hello, World!");\n',
      builtins: "console log error warn info table dir map filter reduce forEach find findIndex some every includes indexOf slice splice concat join push pop shift unshift sort reverse keys values entries assign freeze parse stringify toString parseInt parseFloat isNaN Math floor ceil round max min abs sqrt pow random setTimeout setInterval clearTimeout Promise resolve reject all then catch finally fetch require module exports readInput print",
      members: { console: "log error warn info table dir time timeEnd assert", Math: "abs max min pow sqrt cbrt floor ceil round random sin cos tan atan2 log log2 log10 exp hypot sign trunc PI E", JSON: "parse stringify", Object: "keys values entries assign freeze fromEntries create defineProperty getPrototypeOf",
        Array: "isArray from of", Number: "isInteger isFinite parseFloat parseInt MAX_SAFE_INTEGER EPSILON", Promise: "all race resolve reject allSettled any" },
      snippets: [["log", "console.log($0);"], ["for", "for (let i = 0; i < n; i++) {\n  $0\n}"], ["forof", "for (const x of $0) {\n  \n}"], ["fn", "function name($0) {\n  \n}"], ["arrow", "const name = ($0) => {\n  \n};"],
        ["if", "if ($0) {\n  \n}"], ["ifelse", "if ($0) {\n  \n} else {\n  \n}"], ["try", "try {\n  $0\n} catch (e) {\n  console.error(e);\n}"], ["class", "class Name {\n  constructor($0) {\n    \n  }\n}"], ["async", "async function name($0) {\n  \n}"]] },
    typescript: { id: "typescript", name: "TypeScript", exts: ["ts", "tsx", "mts", "cts"], family: "c", kw: TS_KW, ty: TS_TY, tpl: true, regex: true, anno: true, file: "main.ts", tab: 2,
      hello: 'const msg: string = "Hello, World!";\nconsole.log(msg);\n',
      builtins: "console log error warn map filter reduce forEach find includes push pop slice splice join keys values entries parse stringify parseInt parseFloat Math setTimeout Promise",
      members: { console: "log error warn info table", Math: "abs max min pow sqrt floor ceil round random PI E", JSON: "parse stringify", Object: "keys values entries assign freeze" },
      snippets: [["log", "console.log($0);"], ["for", "for (let i = 0; i < n; i++) {\n  $0\n}"], ["fn", "function name($0): void {\n  \n}"], ["interface", "interface Name {\n  $0\n}"], ["type", "type Name = $0;"], ["class", "class Name {\n  constructor($0) {\n    \n  }\n}"]] },
    python: { id: "python", name: "Python", exts: ["py", "pyw"], family: "py", kw: PY_KW, ty: PY_TY, hash: true, tri: true, file: "main.py", tab: 4,
      hello: 'print("Hello, World!")\n',
      builtins: "print input len range enumerate zip map filter sorted reversed sum min max abs round pow divmod int float str bool list dict set tuple open isinstance issubclass type id hash iter next any all chr ord bin hex oct format repr eval exec getattr setattr hasattr callable super property staticmethod classmethod append extend insert remove pop clear index count sort reverse copy keys values items get update add discard join split strip lstrip rstrip replace find startswith endswith upper lower title format sys math random itertools collections heapq bisect functools",
      members: { str: "join split strip lstrip rstrip replace find rfind index startswith endswith upper lower title capitalize isdigit isalpha isalnum isspace format zfill center ljust rjust count encode splitlines", list: "append extend insert remove pop clear index count sort reverse copy", dict: "keys values items get update pop setdefault clear copy", set: "add discard remove pop clear union intersection difference update", math: "sqrt pow floor ceil log log2 log10 sin cos tan atan2 pi e inf gcd factorial hypot", random: "random randint choice shuffle seed sample uniform randrange", sys: "stdin stdout stderr argv exit setrecursionlimit", heapq: "heappush heappop heapify nlargest nsmallest" },
      snippets: [["main", 'def main():\n    $0\n\n\nif __name__ == "__main__":\n    main()'], ["def", "def name($0):\n    pass"], ["class", "class Name:\n    def __init__(self$0):\n        pass"], ["for", "for i in range($0):\n    pass"], ["while", "while $0:\n    pass"],
        ["if", "if $0:\n    pass"], ["ifelse", "if $0:\n    pass\nelse:\n    pass"], ["try", "try:\n    $0\nexcept Exception as e:\n    print(e)"], ["with", "with open($0) as f:\n    pass"], ["input", "n = int(input())"], ["lc", "[x for x in $0]"]] },
    csharp: { id: "csharp", name: "C#", exts: ["cs"], family: "c", kw: CS_KW, ty: CS_TY, pp: true, anno: false, file: "Program.cs", tab: 4,
      hello: 'using System;\n\nclass Program {\n    static void Main() {\n        Console.WriteLine("Hello, World!");\n    }\n}\n',
      builtins: "Console WriteLine Write ReadLine ReadKey Parse TryParse ToString Length Count Add Remove Contains Sort Reverse Math Abs Max Min Pow Sqrt Floor Ceiling Round",
      members: { Console: "WriteLine Write ReadLine ReadKey Clear", Math: "Abs Max Min Pow Sqrt Floor Ceiling Round PI E", string: "Length Substring IndexOf Split Trim Replace Contains StartsWith EndsWith ToUpper ToLower Join Format" },
      snippets: [["main", "static void Main(string[] args) {\n    $0\n}"], ["cw", "Console.WriteLine($0);"], ["for", "for (int i = 0; i < n; i++) {\n    $0\n}"], ["foreach", "foreach (var x in $0) {\n    \n}"], ["class", "class Name {\n    $0\n}"]] },
    go: { id: "go", name: "Go", exts: ["go"], family: "c", kw: GO_KW, ty: GO_TY, tpl: true, file: "main.go", tab: 4, tabs: true,
      hello: 'package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("Hello, World!")\n}\n',
      builtins: "fmt Println Printf Sprintf Print Scan Scanf Scanln Errorf len cap make new append copy delete panic recover close strings Split Join Contains Replace TrimSpace ToUpper ToLower strconv Atoi Itoa ParseInt ParseFloat sort Ints Strings Slice math Sqrt Pow Abs Max Min Floor Ceil os Args Exit bufio NewReader NewScanner",
      members: { fmt: "Println Printf Sprintf Print Sprint Scan Scanf Scanln Errorf Fprintf", strings: "Split Join Contains Replace TrimSpace ToUpper ToLower HasPrefix HasSuffix Index Fields Repeat Builder", strconv: "Atoi Itoa ParseInt ParseFloat FormatInt Quote", sort: "Ints Strings Float64s Slice SliceStable Search", math: "Sqrt Pow Abs Max Min Floor Ceil Log Sin Cos Pi MaxInt64 Inf" },
      snippets: [["main", "func main() {\n\t$0\n}"], ["for", "for i := 0; i < n; i++ {\n\t$0\n}"], ["forr", "for _, v := range $0 {\n\t\n}"], ["if", "if $0 {\n\t\n}"], ["iferr", "if err != nil {\n\t$0\n}"], ["func", "func name($0) {\n\t\n}"], ["struct", "type Name struct {\n\t$0\n}"], ["pl", "fmt.Println($0)"]] },
    rust: { id: "rust", name: "Rust", exts: ["rs"], family: "c", kw: RS_KW, ty: RS_TY, file: "main.rs", tab: 4,
      hello: 'fn main() {\n    println!("Hello, World!");\n}\n',
      builtins: "println print eprintln format vec panic assert assert_eq unwrap expect Some None Ok Err iter map filter collect len push pop insert remove contains get clone to_string parse unwrap_or min max abs sqrt pow",
      snippets: [["main", "fn main() {\n    $0\n}"], ["fn", "fn name($0) {\n    \n}"], ["for", "for i in 0..n {\n    $0\n}"], ["if", "if $0 {\n    \n}"], ["match", "match $0 {\n    _ => {}\n}"], ["struct", "struct Name {\n    $0\n}"], ["pl", "println!(\"{}\", $0);"]] },
    kotlin: { id: "kotlin", name: "Kotlin", exts: ["kt", "kts"], family: "c", kw: KT_KW, ty: KT_TY, tpl: false, anno: true, file: "Main.kt", tab: 4,
      hello: 'fun main() {\n    println("Hello, World!")\n}\n', builtins: "println print readLine listOf mutableListOf mapOf mutableMapOf setOf arrayOf map filter forEach toInt toString size isEmpty",
      snippets: [["main", "fun main() {\n    $0\n}"], ["fun", "fun name($0) {\n    \n}"], ["for", "for (i in 0 until n) {\n    $0\n}"], ["if", "if ($0) {\n    \n}"], ["class", "class Name($0)"]] },
    php: { id: "php", name: "PHP", exts: ["php"], family: "c", kw: PHP_KW, ty: "int float string bool array object mixed void null", hash: true, file: "main.php", tab: 4,
      hello: '<?php\necho "Hello, World!\\n";\n', builtins: "echo print count strlen str_replace explode implode array_map array_filter array_push array_pop in_array sort usort var_dump print_r isset empty intval floatval trim substr strpos date time json_encode json_decode",
      snippets: [["for", "for ($i = 0; $i < $n; $i++) {\n    $0\n}"], ["foreach", "foreach ($0 as $x) {\n    \n}"], ["fn", "function name($0) {\n    \n}"], ["if", "if ($0) {\n    \n}"]] },
    ruby: { id: "ruby", name: "Ruby", exts: ["rb"], family: "py", kw: RB_KW, ty: "", hash: true, endblock: true, file: "main.rb", tab: 2,
      hello: 'puts "Hello, World!"\n', builtins: "puts print gets p each map select reject reduce inject times upto downto length size push pop shift unshift first last sort sort_by join split strip upcase downcase to_s to_i to_f nil? empty? include?",
      snippets: [["def", "def name($0)\nend"], ["each", "$0.each do |x|\n  \nend"], ["if", "if $0\n  \nend"], ["class", "class Name\n  $0\nend"]] },
    bash: { id: "bash", name: "Bash", exts: ["sh", "bash"], family: "sh", kw: SH_KW, ty: "", hash: true, file: "main.sh", tab: 2,
      hello: '#!/bin/bash\necho "Hello, World!"\n', builtins: "echo printf read cd ls cat grep sed awk sort uniq wc head tail cut tr find xargs mkdir rm cp mv chmod test",
      snippets: [["for", "for i in $0; do\n  \ndone"], ["if", "if [ $0 ]; then\n  \nfi"], ["while", "while [ $0 ]; do\n  \ndone"], ["fn", "name() {\n  $0\n}"]] },
    sql: { id: "sql", name: "SQL", exts: ["sql"], family: "sql", kw: SQL_KW, ty: "int integer bigint smallint varchar char text date datetime timestamp boolean decimal numeric float double", dash: true, ci: true, file: "query.sql", tab: 2,
      hello: "SELECT 'Hello, World!' AS greeting;\n", builtins: "count sum avg min max coalesce ifnull nullif cast concat length lower upper substr trim now date round abs",
      snippets: [["sel", "SELECT $0\nFROM table\nWHERE 1 = 1;"], ["ins", "INSERT INTO table ($0)\nVALUES ();"], ["upd", "UPDATE table\nSET $0\nWHERE ;"], ["crt", "CREATE TABLE name (\n  id INTEGER PRIMARY KEY,\n  $0\n);"]] },
    html: { id: "html", name: "HTML", exts: ["html", "htm"], family: "html", kw: "", ty: "", file: "index.html", tab: 2,
      hello: '<!DOCTYPE html>\n<html lang="vi">\n<head>\n  <meta charset="utf-8">\n  <title>Xin chào</title>\n</head>\n<body>\n  <h1>Hello, World!</h1>\n</body>\n</html>\n',
      builtins: "div span p a img ul ol li table tr td th h1 h2 h3 h4 h5 h6 form input button label select option textarea header footer nav main section article aside script style link meta title head body html br hr", snippets: [["html", "<!DOCTYPE html>\n<html lang=\"vi\">\n<head>\n  <meta charset=\"utf-8\">\n  <title>$0</title>\n</head>\n<body>\n  \n</body>\n</html>"], ["div", "<div>$0</div>"], ["script", "<script>\n  $0\n</script>"]] },
    css: { id: "css", name: "CSS", exts: ["css"], family: "css", kw: "", ty: "", file: "style.css", tab: 2, hello: "body {\n  font-family: sans-serif;\n}\n",
      builtins: "display position flex grid margin padding border background color font-size font-family width height max-width min-width overflow text-align align-items justify-content gap transition transform opacity z-index cursor box-shadow border-radius", snippets: [["flex", "display: flex;\nalign-items: center;\njustify-content: center;"]] },
    json: { id: "json", name: "JSON", exts: ["json", "jsonc"], family: "json", kw: "true false null", ty: "", file: "data.json", tab: 2, hello: '{\n  "message": "Hello, World!"\n}\n', builtins: "", snippets: [] },
    markdown: { id: "markdown", name: "Markdown", exts: ["md", "markdown"], family: "md", kw: "", ty: "", file: "README.md", tab: 2, hello: "# Xin chào\n\nĐây là **Markdown**.\n", builtins: "", snippets: [] },
    plaintext: { id: "plaintext", name: "Văn bản", exts: ["txt", "text", "log", "in", "out"], family: "plain", kw: "", ty: "", file: "notes.txt", tab: 4, hello: "", builtins: "", snippets: [] }
  };

  var ORDER = ["cpp", "c", "java", "python", "javascript", "typescript", "csharp", "go", "rust", "kotlin", "php", "ruby", "bash", "sql", "html", "css", "json", "markdown", "plaintext"];
  var BYEXT = Object.create(null);

  ORDER.forEach(function (id) {
    var l = L[id];
    l.kwSet = set(l.kw); l.tySet = set(l.ty); l.biSet = set(l.builtins);
    l.memberMap = Object.create(null);
    Object.keys(l.members || {}).forEach(function (k) { l.memberMap[k] = String(l.members[k]).split(/\s+/).filter(Boolean); });
    l.snippetList = (l.snippets || []).map(function (s) { return { label: s[0], body: s[1] }; });
    l.exts.forEach(function (e) { BYEXT[e] = id; });
  });

  /** Đuôi tệp → id ngôn ngữ ("main.cpp" → "cpp"); không rõ → "plaintext". */
  function byFilename(name) {
    var m = /\.([A-Za-z0-9+_-]+)$/.exec(String(name || ""));
    return (m && BYEXT[m[1].toLowerCase()]) || "plaintext";
  }
  function get(id) { return L[id] || L.plaintext; }
  function list() { return ORDER.map(function (id) { return L[id]; }); }

  /** Tên tệp mặc định cho ngôn ngữ ("cpp" → "main.cpp"). */
  function defaultFile(id) { return get(id).file; }

  CS.langs = { get: get, list: list, order: ORDER, byFilename: byFilename, defaultFile: defaultFile, set: set };
  if (typeof module !== "undefined" && module.exports) module.exports = CS.langs;
})(typeof globalThis !== "undefined" ? globalThis : this);
