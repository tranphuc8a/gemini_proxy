/* Kiểm mô hình đoạn mã/dự án (project.js) và đọc/ghi .zip (zip.js). Được kiem.js nạp.
   Nhóm zip có đối chiếu với Python `zipfile` thật (nếu máy có python/py), zlib của node, DecompressionStream, zip độc hại (zip-slip, zip bomb). */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path"), zlib = require("zlib"), crypto = require("crypto");
const { execFileSync } = require("child_process");

module.exports = async function ({ nhom, kiem, bang, CS, A }) {
  if (!CS.project) { nhom("project"); kiem("có module project", false); return; }
  const P = CS.project, L = CS.langs;
  const throws = (fn) => { try { fn(); return null; } catch (e) { return e; } };
  const viet = (e) => !!e && /[À-ỹ]/.test(e.message);                     // thông báo có chữ tiếng Việt
  const paths = (p) => p.files.map((f) => f.path);
  const multi = () => P.createProject({ template: "cpp-multi", id: "t1", now: 100 });
  const javaPkg = () => P.createProject({ template: "java-package", id: "j1" });
  const frozen = (p) => JSON.stringify(p);

  /* ================================================================ project */
  nhom("project · đường dẫn (normPath, findConflict)");
  {
    const ok = (s, o) => { try { return P.normPath(s, o); } catch (e) { return "LỖI:" + e.message; } };
    kiem("chuẩn hoá: '\\' → '/', bỏ './' và '//'", ok("src\\x\\y.cpp") === "src/x/y.cpp" && ok("./a//b.cpp") === "a/b.cpp" && ok("a/./b.c") === "a/b.c");
    const bad = ["", "   ", "/abs.cpp", "C:\\x.cpp", "c:x.cpp", "a/../b", "..", "a/..", "dir/", "a\u0000b", "a\tb", "a\u202eb.cpp", "x\u0085y", ". ", ".", "a/ b", "a /b", "a/b.", "a/.b./c"];
    kiem("luật kho: từ chối rỗng/tuyệt đối/ổ đĩa/'..'/kết thúc '/'/điều khiển/đảo chiều chữ/thành phần có khoảng trắng hoặc '.' ở rìa", bad.every((s) => { const r = ok(s, { store: true }); return typeof r === "string" && r.indexOf("LỖI:") === 0; }), bad.filter((s) => ok(s, { store: true }).indexOf("LỖI:") !== 0).join("|"));
    kiem("luật kho cho phép Unicode, dấu cách, '@', '(' …", ok("Bài tập 1/xin chào (2).cpp", { store: true }) === "Bài tập 1/xin chào (2).cpp" && ok("a@b#c.cpp", { store: true }) === "a@b#c.cpp");
    kiem("luật chạy (mặc định) chặt hơn: chỉ [A-Za-z0-9_.-]", ["a b.cpp", "é.cpp", "a@b.cpp", "x(1).cpp", "tệp.cpp"].every((s) => ok(s).indexOf("LỖI:") === 0) && ok("A-b_c.d.cpp") === "A-b_c.d.cpp");
    kiem("luật chạy: không bắt đầu bằng '-', cấm tên thiết bị Windows (con, NUL.txt, com1, LPT9.c)", ["-x.cpp", "a/-b.cpp", "con", "NUL.txt", "com1", "LPT9.c", "src/Aux.cpp", "prn.h"].every((s) => ok(s).indexOf("LỖI:") === 0) && ok("com10.cpp") === "com10.cpp" && ok("console.cpp") === "console.cpp");
    kiem("độ sâu: kho ≤ 16 cấp, chạy ≤ 8 cấp", ok(Array(16).fill("d").join("/") + "/f", { store: true }).indexOf("LỖI:") === 0 && ok(Array(15).fill("d").join("/") + "/f", { store: true }).indexOf("LỖI:") !== 0 && ok(Array(8).fill("d").join("/") + "/f").indexOf("LỖI:") === 0 && ok(Array(7).fill("d").join("/") + "/f") !== undefined && ok(Array(7).fill("d").join("/") + "/f").indexOf("LỖI:") !== 0);
    kiem("độ dài: kho ≤ 512 ký tự, thành phần ≤ 255; chạy ≤ 200, thành phần ≤ 100", ok("a".repeat(256), { store: true }).indexOf("LỖI:") === 0 && ok("a".repeat(255), { store: true }).indexOf("LỖI:") !== 0 && ok(("a".repeat(100) + "/").repeat(6) + "f", { store: true }).indexOf("LỖI:") === 0 && ok("a".repeat(101)).indexOf("LỖI:") === 0 && ok("a".repeat(100)).indexOf("LỖI:") !== 0 && ok(("a".repeat(60) + "/").repeat(4) + "f").indexOf("LỖI:") === 0 && ok(("a".repeat(60) + "/").repeat(3) + "f").indexOf("LỖI:") !== 0);
    const e = throws(() => P.normPath("a/../b"));
    kiem("lỗi là Error tiếng Việt có code bad_path", e && e.code === "bad_path" && viet(e));
    kiem("findConflict: trùng tên không phân biệt hoa/thường", /Trùng tên/.test(P.findConflict(["a.cpp", "A.CPP"])) && P.findConflict(["a.cpp", "b.cpp"]) === null);
    kiem("findConflict: tệp trùng tên thư mục", /vừa là tệp vừa là thư mục/.test(P.findConflict(["src", "src/a.cpp"])) && /vừa là tệp vừa là thư mục/.test(P.findConflict(["a/b/c", "A/B"])));
    kiem("findConflict: thư mục khác hoa/thường không phải xung đột", P.findConflict(["Src/a.cpp", "src/b.cpp"]) === null);
  }

  nhom("project · id, tạo mới, mẫu");
  {
    const ids = new Set(Array.from({ length: 300 }, () => P.newId()));
    kiem("newId: 20 ký tự [0-9a-z], không trùng trong 300 lần", ids.size === 300 && Array.from(ids).every((x) => /^[0-9a-z]{20}$/.test(x)));
    const s = P.createSnippet({ name: "  Sắp xếp  ", language: "python", id: "abc", now: 1234.9 });
    kiem("createSnippet: kind snippet, tên cắt khoảng trắng, tệp mặc định main.py + mẫu Hello, mainFile/openTabs/activeFile", s.kind === "snippet" && s.name === "Sắp xếp" && s.id === "abc" && s.updatedAt === 1234 && s.language === "python" && bang(paths(s), ["main.py"]) && s.files[0].content === L.get("python").hello && s.meta.mainFile === "main.py" && bang(s.meta.openTabs, ["main.py"]) && s.meta.activeFile === "main.py" && s.deleted === false);
    const d = P.createSnippet({});
    kiem("createSnippet() trống: C++, tên 'Đoạn mã mới', id mới, std c++17, opt O2", d.language === "cpp" && d.name === "Đoạn mã mới" && /^[0-9a-z]{20}$/.test(d.id) && d.meta.std === "c++17" && d.meta.opt === "O2" && d.updatedAt === 0);
    const c = P.createSnippet({ language: "c", content: "int main(){}", path: "src/app.c" });
    kiem("createSnippet: path + content tuỳ ý; std mặc định theo ngôn ngữ (C → c11)", c.files[0].path === "src/app.c" && c.files[0].content === "int main(){}" && c.meta.std === "c11" && c.meta.mainFile === "src/app.c");
    kiem("createSnippet: path xấu → ném Error; ngôn ngữ sai định dạng → rơi về cpp; content '' giữ rỗng", viet(throws(() => P.createSnippet({ path: "../x.cpp" }))) && P.createSnippet({ language: "c++/x y" }).language === "cpp" && P.createSnippet({ content: "" }).files[0].content === "");
    kiem("createSnippet: tên điều khiển/quá dài được làm sạch", P.createSnippet({ name: "a\u0000b\nc" }).name === "a b c" && P.createSnippet({ name: "x".repeat(300) }).name.length === 200);
    const bad = L.list().filter((l) => { const sn = P.createSnippet({ language: l.id, id: "z" }); return P.validate(sn).length || sn.files[0].path !== l.file || sn.files[0].content !== l.hello; }).map((l) => l.id);
    kiem("createSnippet cho cả 19 ngôn ngữ: hợp lệ với kho, tên tệp + Hello đúng", bad.length === 0, bad.join());

    kiem("7 mẫu dự án", P.templates.length === 7 && bang(P.templates.map((t) => t.id), ["cpp-single", "cpp-multi", "c-multi", "java-single", "java-package", "python-multi", "js-multi"]));
    const mainOf = { "cpp-single": "main.cpp", "cpp-multi": "main.cpp", "c-multi": "main.c", "java-single": "Main.java", "java-package": "src/app/Main.java", "python-multi": "main.py", "js-multi": "main.js" };
    P.templates.forEach((t) => {
      const p = P.createProject({ template: t.id, id: "t" });
      const v = P.validate(p), main = P.detectMain(p);
      let rq = null, rqErr = "";
      try { rq = P.toRunRequest(p); } catch (e) { rqErr = e.message; }
      const flagsOk = rq && rq.compileArgs.every((f) => P.isAllowedFlag(f));
      kiem("mẫu " + t.id + ": validate sạch, detectMain = " + mainOf[t.id] + ", toRunRequest hợp lệ", v.length === 0 && main === mainOf[t.id] && p.meta.mainFile === main && !!rq && rq.mainFile === main && rq.language === t.language && rq.files.length === t.files.length && flagsOk && rq.files.every((f) => P.normPath(f.name) === f.name), JSON.stringify([v, main, rqErr]));
    });
    kiem("mẫu: kind project (kể cả cpp-single), tên mặc định = tên mẫu, mẫu không bị sửa (đóng băng)", P.templates.every((t) => P.createProject({ template: t.id }).kind === "project" && P.createProject({ template: t.id }).name === t.name) && Object.isFrozen(P.templates[0]) && Object.isFrozen(P.templates[0].files[0]));
    const t1 = P.createProject({ template: "cpp-multi", id: "t1" }), t2 = P.createProject({ template: "cpp-multi", id: "t2" });
    t1.files[0].content = "ĐÃ SỬA";
    kiem("hai dự án từ cùng mẫu độc lập nhau", t2.files[0].content !== "ĐÃ SỬA" && P.templates[1].files[0].content !== "ĐÃ SỬA");
    kiem("createProject: template là đối tượng; mẫu lạ → Error; không mẫu → 1 tệp Hello", P.createProject({ template: { id: "x", name: "Tự đặt", language: "python", files: [{ path: "a.py", content: "print(1)" }], meta: { mainFile: "a.py" } } }).name === "Tự đặt" && viet(throws(() => P.createProject({ template: "khong-co" }))) && bang(paths(P.createProject({ language: "java" })), ["Main.java"]) && P.createProject({ language: "java" }).meta.mainFile === "Main.java");
    kiem("createProject: tên tuỳ ý thắng tên mẫu", P.createProject({ template: "c-multi", name: "Bài C" }).name === "Bài C");
    kiem("createProject: mẫu có tệp xung đột bị từ chối", viet(throws(() => P.createProject({ template: { files: [{ path: "a.c", content: "" }, { path: "A.C", content: "" }], language: "c" } }))));
  }

  nhom("project · normalize");
  {
    const raw = { id: "n1", kind: "xyz", name: "  Tên\u0001  ", language: "C++ !", files: [{ path: "main.cpp", content: 5 }, { path: 7 }, null, { path: "b.cpp" }], meta: { std: "-std=c++20", opt: "-O3", pinned: "có", tags: [" a ", "a", "", 3], mainFile: "khong-co.cpp", zzz: 1 }, updatedAt: "123.7" };
    const q = P.normalize(raw);
    kiem("kind lạ → project; tên làm sạch; language sai → plaintext; updatedAt ép thành số nguyên", q.kind === "project" && q.name === "Tên" && q.language === "plaintext" && q.updatedAt === 123 && q.deleted === false);
    kiem("tệp: bỏ mục không có path chuỗi; content ép thành chuỗi ('' nếu thiếu)", bang(q.files, [{ path: "main.cpp", content: "5" }, { path: "b.cpp", content: "" }]));
    kiem("meta: std bỏ '-std=', opt bỏ '-', pinned chỉ true mới là true, tags gọn, mainFile hỏng → dò lại, trường lạ giữ", q.meta.std === "c++20" && q.meta.opt === "O3" && q.meta.pinned === false && bang(q.meta.tags, ["a"]) && q.meta.zzz === 1 && q.meta.mainFile === "main.cpp");
    kiem("normalize LŨY ĐẲNG (mọi mẫu + ví dụ hỏng)", [q].concat(P.templates.map((t) => P.createProject({ template: t.id, id: "i" }))).every((x) => frozen(P.normalize(x)) === frozen(P.normalize(P.normalize(x)))));
    kiem("normalize không sửa đầu vào", (() => { const a = P.createProject({ template: "cpp-multi", id: "k" }), b = frozen(a); P.normalize(a); return frozen(a) === b; })());
    const tomb = P.normalize({ id: "t", kind: "project", name: "x", language: "cpp", files: [{ path: "a.cpp", content: "x" }], meta: { pinned: true }, updatedAt: 5, deleted: true });
    kiem("bia mộ: files [] và meta {}", tomb.deleted === true && bang(tomb.files, []) && bang(tomb.meta, {}));
    kiem("normalize(null/số/chuỗi) → Error tiếng Việt", [null, 5, "x", undefined].every((v) => viet(throws(() => P.normalize(v)))));
    kiem("thiếu id → cấp id; id lạ nhưng không rỗng được giữ nguyên (validate mới từ chối)", /^[0-9a-z]{20}$/.test(P.normalize({ files: [] }).id) && P.normalize({ id: "a b" }).id === "a b" && P.validate(P.normalize({ id: "a b", kind: "snippet", files: [{ path: "a.cpp", content: "" }], language: "cpp" })).some((m) => /id/.test(m)));
    kiem("std/opt hỏng → mặc định; opt rỗng giữ rỗng", P.normalize({ id: "a", language: "cpp", files: [{ path: "a.cpp", content: "" }], meta: { std: "c++ 17 !", opt: "O9" } }).meta.std === "c++17" && P.normalize({ id: "a", language: "cpp", files: [{ path: "a.cpp", content: "" }], meta: { opt: "" } }).meta.opt === "");
    const m2 = P.normalize({ id: "a", language: "cpp", files: [{ path: "a.cpp", content: "" }], meta: { openTabs: ["a.cpp", "x.cpp", "a.cpp"], activeFile: "x.cpp", folders: ["a.cpp", "d/", "D", "d/e", "../x", "lib"] } });
    kiem("meta: openTabs bỏ tệp không có/trùng; activeFile hỏng → tab đầu; folders bỏ tên trùng tệp/thư mục lồng/không hợp lệ, chỉ giữ lá", bang(m2.meta.openTabs, ["a.cpp"]) && m2.meta.activeFile === "a.cpp" && bang(m2.meta.folders, ["d/e", "lib"]), JSON.stringify(m2.meta.folders));
  }

  nhom("project · meta ≤ 8 KB");
  {
    const s = multi();
    const m = P.setMeta(s, { openTabs: paths(s), junk: "x".repeat(20000), stdin: "y".repeat(20000), tags: ["a".repeat(3000), "b".repeat(3000)] });
    kiem("meta quá lớn bị cắt về ≤ 8 KB (đo như máy chủ)", P.pyJsonBytes(m.meta) <= 8192, String(P.pyJsonBytes(m.meta)));
    kiem("cắt theo thứ tự: trường lạ bỏ trước; stdin cắt kèm cờ stdinTruncated; mainFile/std/opt còn", m.meta.junk === undefined && m.meta.stdinTruncated === true && m.meta.stdin.length > 100 && m.meta.mainFile === "main.cpp" && m.meta.std === "c++17");
    const m2 = P.setMeta(s, { openTabs: paths(s).concat(Array.from({ length: 800 }, (_, i) => "src/f" + i + ".cpp")) });
    kiem("openTabs trỏ tới tệp không có bị bỏ (không phình)", P.pyJsonBytes(m2.meta) <= 8192 && m2.meta.openTabs.length === 5);
    const big = P.setMeta(s, { stdin: "é".repeat(20000) });
    kiem("stdin Unicode bị cắt vẫn là chuỗi hợp lệ (không cắt giữa cặp thay thế)", !/[\ud800-\udbff]$/.test(big.meta.stdin) && P.pyJsonBytes(big.meta) <= 8192);
    const emoji = P.setMeta(s, { stdin: "🙂".repeat(9000) });
    kiem("stdin emoji bị cắt: không để lại nửa cặp thay thế", !/[\ud800-\udbff]$/.test(emoji.meta.stdin) && P.pyJsonBytes(emoji.meta) <= 8192);
    kiem("validate báo meta > 8 KB khi chưa chuẩn hoá", P.validate(Object.assign(multi(), { meta: { x: "z".repeat(9000) } })).some((e) => /meta quá lớn/.test(e)));
  }

  nhom("project · addFile / addFolder");
  {
    const p = multi(), before = frozen(p);
    const a = P.addFile(p, "src/util/math.cpp", "// m");
    kiem("addFile: thêm tệp ở thư mục mới; đầu vào không đổi; trả bản sao", paths(a).indexOf("src/util/math.cpp") === 5 && frozen(p) === before && a !== p && a.files[5].content === "// m");
    kiem("addFile: content bỏ trống → ''; số → chuỗi", P.addFile(p, "e.cpp").files[5].content === "" && P.addFile(p, "n.txt", 42).files[5].content === "42");
    kiem("addFile: trùng tên không phân biệt hoa/thường → Error tiếng Việt", viet(throws(() => P.addFile(p, "MAIN.CPP"))) && /Đã có tệp 'main.cpp'/.test(throws(() => P.addFile(p, "Main.cpp")).message));
    kiem("addFile: tên trùng một thư mục / nằm trong một tệp → lỗi", /thư mục/.test(throws(() => P.addFile(p, "src")).message) && /là một tệp/.test(throws(() => P.addFile(p, "main.cpp/x.cpp")).message));
    kiem("addFile: dùng lại cách viết hoa của thư mục đã có (SRC/x.cpp → src/x.cpp, Include/…)", P.addFile(p, "SRC/x.cpp").files[5].path === "src/x.cpp" && P.addFile(p, "Include/Sub/a.h").files[5].path === "include/Sub/a.h");
    kiem("addFile: tên không chạy được (dấu cách, Unicode, '..', tuyệt đối, tên thiết bị) → lỗi", ["a b.cpp", "é.cpp", "../x.cpp", "/x.cpp", "con.cpp", "-x.cpp"].every((s) => viet(throws(() => P.addFile(p, s)))));
    kiem("addFile: quá 200 tệp → lỗi", viet(throws(() => { let q = P.createProject({ template: "cpp-single", id: "q" }); for (let i = 0; i < 205; i++) q = P.addFile(q, "f" + i + ".txt"); })));
    kiem("addFile vào đoạn mã → lỗi gợi ý chuyển thành dự án", /chuyển thành dự án/.test(throws(() => P.addFile(P.createSnippet({ id: "s" }), "b.cpp")).message));
    kiem("addFile vào thư mục rỗng đã tạo: thư mục thôi nằm trong meta.folders", (() => { let q = P.addFolder(p, "docs"); const had = q.meta.folders.indexOf("docs") >= 0; q = P.addFile(q, "docs/a.md", "x"); return had && q.meta.folders.indexOf("docs") < 0; })());

    const f = P.addFolder(p, "tools/scripts");
    kiem("addFolder: thư mục rỗng nằm trong meta.folders, hiện ở tree, đầu vào không đổi", bang(f.meta.folders, ["tools/scripts"]) && frozen(p) === before && P.tree(f).some((n) => n.type === "dir" && n.name === "tools" && n.children[0].name === "scripts"));
    kiem("addFolder: trùng thư mục có sẵn (cả khác hoa/thường) / trùng tên tệp / nằm trong tệp → lỗi", /đã có/.test(throws(() => P.addFolder(p, "SRC")).message) && /đã có/.test(throws(() => P.addFolder(f, "tools/scripts")).message) && /trùng tên một tệp/.test(throws(() => P.addFolder(p, "main.cpp")).message) && /là một tệp/.test(throws(() => P.addFolder(p, "main.cpp/sub")).message));
    kiem("addFolder: dấu '/' cuối được bỏ; tên xấu → lỗi", P.addFolder(p, "x/y/").meta.folders[0] === "x/y" && viet(throws(() => P.addFolder(p, "../x"))) && viet(throws(() => P.addFolder(p, "")))) ;
    kiem("addFolder: viết hoa theo thư mục cha đã có (SRC/new → src/new)", P.addFolder(p, "SRC/new").meta.folders.indexOf("src/new") >= 0);
    kiem("addFolder vào đoạn mã → lỗi", viet(throws(() => P.addFolder(P.createSnippet({ id: "s" }), "d"))));
  }

  nhom("project · rename (tệp và thư mục)");
  {
    const p0 = multi();
    let p = Object.assign({}, p0, { meta: Object.assign({}, p0.meta, { openTabs: ["main.cpp", "src/shapes.cpp"], activeFile: "src/shapes.cpp" }) });
    p = P.normalize(p);
    const r1 = P.rename(p, "src/shapes.cpp", "src/forms.cpp");
    kiem("đổi tên tệp: openTabs/activeFile đi theo", r1.files.some((f) => f.path === "src/forms.cpp") && !r1.files.some((f) => f.path === "src/shapes.cpp") && bang(r1.meta.openTabs, ["main.cpp", "src/forms.cpp"]) && r1.meta.activeFile === "src/forms.cpp");
    const r2 = P.rename(p, "main.cpp", "app.cpp");
    kiem("đổi tên tệp chính: meta.mainFile đi theo", r2.meta.mainFile === "app.cpp" && r2.meta.openTabs[0] === "app.cpp");
    kiem("đổi tên tệp: chuyển sang thư mục khác (và thư mục mới tự có); đổi chỉ hoa/thường được", P.rename(p, "main.cpp", "newdir/main.cpp").files[0].path === "newdir/main.cpp" && P.rename(p, "main.cpp", "MAIN.cpp").files[0].path === "MAIN.cpp");
    kiem("đổi tên tệp: trùng tên tệp khác/đích là thư mục/đích nằm trong tệp/tên xấu/nguồn không có → lỗi", viet(throws(() => P.rename(p, "main.cpp", "src/shapes.cpp"))) && viet(throws(() => P.rename(p, "main.cpp", "SRC/SHAPES.CPP"))) && /thư mục/.test(throws(() => P.rename(p, "main.cpp", "src")).message) && /là một tệp/.test(throws(() => P.rename(p, "src/shapes.cpp", "main.cpp/x.cpp")).message) && viet(throws(() => P.rename(p, "main.cpp", "a b.cpp"))) && /Không có tệp hay thư mục/.test(throws(() => P.rename(p, "khong-co.cpp", "x.cpp")).message));
    kiem("đổi tên về chính nó: không đổi gì", frozen(P.rename(p, "main.cpp", "main.cpp")) === frozen(p) && frozen(P.rename(p, "src", "src")) === frozen(p));
    kiem("đổi tên tệp duy nhất trong thư mục: thư mục cũ vẫn còn (rỗng)", (() => { const q = P.addFile(P.createProject({ template: "cpp-single", id: "q" }), "d/only.txt", "x"); const r = P.rename(q, "d/only.txt", "only.txt"); return bang(r.meta.folders, ["d"]) && P.tree(r).some((n) => n.type === "dir" && n.name === "d"); })());

    const d1 = P.rename(p, "src", "lib/impl");
    kiem("đổi tên THƯ MỤC: mọi tệp con đổi đường dẫn; thư mục cha mới tự có", bang(paths(d1), ["main.cpp", "include/shapes.h", "include/stats.h", "lib/impl/shapes.cpp", "lib/impl/stats.cpp"]) && d1.meta.openTabs.indexOf("lib/impl/shapes.cpp") >= 0 && d1.meta.activeFile === "lib/impl/shapes.cpp");
    kiem("đổi tên thư mục: nội dung giữ nguyên, tệp ngoài thư mục không đổi", d1.files[3].content === p.files[3].content && d1.files[0].content === p.files[0].content);
    const withMainInDir = P.normalize(Object.assign({}, p, { meta: Object.assign({}, p.meta, { mainFile: "src/stats.cpp" }) }));
    kiem("đổi tên thư mục chứa tệp chính: meta.mainFile đi theo", P.rename(withMainInDir, "src", "code").meta.mainFile === "code/stats.cpp");
    kiem("đổi tên thư mục: chỉ đổi hoa/thường được; sang tên thư mục có sẵn/tên tệp → lỗi; vào chính nó → lỗi", P.rename(p, "src", "SRC").files.some((f) => f.path === "SRC/shapes.cpp") && /đã có/.test(throws(() => P.rename(p, "src", "include")).message) && /trùng tên một tệp/.test(throws(() => P.rename(p, "src", "main.cpp")).message) && /vào chính nó/.test(throws(() => P.rename(p, "src", "src/inner")).message));
    kiem("đổi tên thư mục: bao 'src' vào 'Src2' thì không nhầm tiền tố (src vs srcx/)", (() => { let q = P.addFile(p, "srcx/a.txt", "x"); q = P.rename(q, "src", "S"); return q.files.some((f) => f.path === "srcx/a.txt") && q.files.some((f) => f.path === "S/shapes.cpp"); })());
    const emptyF = P.addFolder(p, "rong/sub");
    const e1 = P.rename(emptyF, "rong", "trong");
    kiem("đổi tên thư mục rỗng (kể cả thư mục lồng): meta.folders đi theo", bang(e1.meta.folders, ["trong/sub"]));
    kiem("đổi tên thư mục: đường dẫn mới quá sâu cho /run vẫn lỗi tiếng Việt", (() => { const q = P.addFile(P.createProject({ template: "cpp-single", id: "q" }), "a/b/c/d/e/f/g.txt", "x"); return viet(throws(() => P.rename(q, "a", "x/y/z"))); })());
  }

  nhom("project · remove / setContent / setName / setMeta");
  {
    const p = multi();
    const r1 = P.remove(p, "src/stats.cpp");
    kiem("remove tệp", paths(r1).indexOf("src/stats.cpp") < 0 && r1.files.length === 4 && paths(p).length === 5);
    const r2 = P.remove(p, "src");
    kiem("remove THƯ MỤC: xoá mọi tệp bên trong; thư mục khác nguyên vẹn", bang(paths(r2), ["main.cpp", "include/shapes.h", "include/stats.h"]));
    const withFolder = P.addFolder(p, "src/rong");
    kiem("remove thư mục cũng xoá thư mục rỗng lồng bên trong", !P.remove(withFolder, "src").meta.folders.length);
    kiem("remove tệp chính: mainFile dò lại (tệp .cpp khác)", (() => { const q = P.remove(p, "main.cpp"); return q.meta.mainFile !== "main.cpp" && paths(q).indexOf(q.meta.mainFile) >= 0; })());
    kiem("remove tab đang mở: bỏ khỏi openTabs, activeFile sang tab khác", (() => { const q = P.normalize(Object.assign({}, p, { meta: Object.assign({}, p.meta, { openTabs: ["main.cpp", "include/stats.h"], activeFile: "include/stats.h" }) })); const r = P.remove(q, "include/stats.h"); return bang(r.meta.openTabs, ["main.cpp"]) && r.meta.activeFile === "main.cpp"; })());
    kiem("remove tệp cuối cùng / thư mục chứa mọi tệp → lỗi; nguồn không có → lỗi", viet(throws(() => P.remove(P.createSnippet({ id: "s" }), "main.cpp"))) && /ít nhất một tệp/.test(throws(() => P.remove(P.createProject({ template: "cpp-single" }), "main.cpp")).message) && viet(throws(() => P.remove(P.createProject({ template: "java-package", id: "j" }), "src"))) && /Không có tệp hay thư mục/.test(throws(() => P.remove(p, "zzz")).message));
    kiem("remove tệp duy nhất trong thư mục: thư mục cha vẫn còn (rỗng)", (() => { const q = P.addFile(p, "solo/one.txt", "x"); const r = P.remove(q, "solo/one.txt"); return bang(r.meta.folders, ["solo"]); })());

    const sc = P.setContent(p, "main.cpp", "int main() {}");
    kiem("setContent: thay nội dung, đầu vào không đổi; null → ''; tệp không có → lỗi", sc.files[0].content === "int main() {}" && p.files[0].content !== "int main() {}" && P.setContent(p, "main.cpp", null).files[0].content === "" && viet(throws(() => P.setContent(p, "zzz.cpp", "x"))));
    kiem("setName: cắt khoảng trắng, làm sạch, ≤ 200 ký tự", P.setName(p, "  Tên mới  ").name === "Tên mới" && P.setName(p, "a\u0007b").name === "a b" && P.setName(p, "é".repeat(500)).name.length === 200 && P.setName(p, "").name === "");
    const sm = P.setMeta(p, { std: "c++20", opt: "O3", stdin: "5\n", args: ["a", "b"], compileArgs: ["-Wall"], pinned: true, tags: ["x"], mainFile: "include/stats.h", activeFile: "khong-co", openTabs: ["main.cpp", "khong-co"] });
    kiem("setMeta: gộp trường, tham chiếu sai bị bỏ/chuẩn hoá", sm.meta.std === "c++20" && sm.meta.opt === "O3" && sm.meta.stdin === "5\n" && bang(sm.meta.args, ["a", "b"]) && sm.meta.pinned === true && sm.meta.mainFile === "include/stats.h" && sm.meta.activeFile === "main.cpp" && bang(sm.meta.openTabs, ["main.cpp"]));
    kiem("setMeta: không sửa đầu vào; patch không phải đối tượng bị bỏ qua; mainFile không tồn tại → dò lại", frozen(p) === frozen(multi()) && frozen(P.setMeta(p, null)) === frozen(p) && P.setMeta(p, { mainFile: "khong-co.cpp" }).meta.mainFile === "main.cpp");
    kiem("setMeta: patch được sao chép sâu (sửa sau không ảnh hưởng)", (() => { const patch = { args: ["a"] }; const q = P.setMeta(p, patch); patch.args.push("b"); return bang(q.meta.args, ["a"]); })());
  }

  nhom("project · setLanguage / asProject / asSnippet / duplicate");
  {
    const s = P.createSnippet({ id: "s", language: "cpp" });
    const py = P.setLanguage(s, "python");
    kiem("setLanguage đoạn mã dùng tên mặc định: main.cpp → main.py, mainFile/openTabs theo, std mặc định bỏ", py.language === "python" && bang(paths(py), ["main.py"]) && py.meta.mainFile === "main.py" && bang(py.meta.openTabs, ["main.py"]) && py.meta.std === "");
    kiem("… quay lại C++: std về c++17", P.setLanguage(py, "cpp").meta.std === "c++17" && P.setLanguage(py, "cpp").files[0].path === "main.cpp");
    const custom = P.createSnippet({ id: "c", language: "cpp", path: "bubble.cpp" });
    kiem("tên tệp tự đặt thì KHÔNG đổi theo ngôn ngữ; mainFile không khớp đuôi mới bị dò lại", (() => { const q = P.setLanguage(custom, "python"); return q.files[0].path === "bubble.cpp" && q.language === "python"; })());
    kiem("std do người dùng đặt (c++20) được giữ khi đổi ngôn ngữ", P.setLanguage(P.setMeta(s, { std: "c++20" }), "c").meta.std === "c++20");
    kiem("ngôn ngữ sai định dạng → giữ ngôn ngữ cũ", P.setLanguage(s, "x y!").language === "cpp");
    const pr = P.createProject({ template: "cpp-multi", id: "p" });
    kiem("setLanguage dự án: không đổi tên tệp nào", bang(paths(P.setLanguage(pr, "c")), paths(pr)));

    const pj = P.asProject(s);
    kiem("asProject: kind project, giữ nguyên tệp", pj.kind === "project" && bang(paths(pj), paths(s)) && P.addFile(pj, "b.cpp", "x").files.length === 2);
    kiem("asSnippet: dự án 1 tệp → đoạn mã (xoá meta.folders); nhiều tệp → lỗi", (() => { const one = P.addFolder(P.asProject(s), "rong"); const sn = P.asSnippet(one); return sn.kind === "snippet" && !sn.meta.folders.length; })() && viet(throws(() => P.asSnippet(pr))));
    const dup = P.duplicate(P.setMeta(pr, { pinned: true }), { id: "p2", now: 999 });
    kiem("duplicate: id mới, tên '(bản sao)', bỏ ghim, updatedAt = now, không bia mộ, tệp giữ nguyên", dup.id === "p2" && dup.name === pr.name + " (bản sao)" && dup.meta.pinned === false && dup.updatedAt === 999 && !dup.deleted && bang(paths(dup), paths(pr)));
    kiem("duplicate: không id → id mới; tên tuỳ chọn; từ bia mộ vẫn ra bản sống", /^[0-9a-z]{20}$/.test(P.duplicate(pr).id) && P.duplicate(pr, { name: "Khác" }).name === "Khác" && P.duplicate(Object.assign({}, pr, { deleted: true })).deleted === false);
  }

  nhom("project · tree (thứ tự)");
  {
    const p = P.normalize({ id: "t", kind: "project", language: "cpp", name: "T", files: [
      { path: "z.cpp", content: "" }, { path: "file10.cpp", content: "" }, { path: "file2.cpp", content: "" }, { path: "File1.cpp", content: "" },
      { path: "b/x.h", content: "" }, { path: "A/y.h", content: "" }, { path: "a2/k.h", content: "" }, { path: "a10/k.h", content: "" }, { path: "src/deep/er/f.cpp", content: "" }, { path: "README.md", content: "" }
    ], meta: { folders: ["empty", "b/inner"] } });
    const t = P.tree(p), top = t.map((n) => n.type[0] + ":" + n.name);
    kiem("tree: thư mục trước tệp; mỗi nhóm theo tên không phân biệt hoa/thường và số tự nhiên (a2 < a10, file2 < file10)", bang(top, ["d:A", "d:a2", "d:a10", "d:b", "d:empty", "d:src", "f:File1.cpp", "f:file2.cpp", "f:file10.cpp", "f:README.md", "f:z.cpp"]), top.join());
    const b = t.filter((n) => n.name === "b")[0];
    kiem("tree: thư mục rỗng trong meta.folders hiện ra, kể cả lồng; con của thư mục cũng sắp xếp", b.children.map((n) => n.name).join() === "inner,x.h" && t.filter((n) => n.name === "empty")[0].children.length === 0);
    kiem("tree: nút tệp có path đầy đủ và language theo đuôi; nút thư mục có path", t.filter((n) => n.name === "src")[0].children[0].children[0].children[0].path === "src/deep/er/f.cpp" && t.filter((n) => n.name === "README.md")[0].language === "markdown" && t.filter((n) => n.name === "z.cpp")[0].language === "cpp" && t.filter((n) => n.name === "src")[0].path === "src");
    kiem("tree: không có tệp/null → mảng rỗng", bang(P.tree({ files: [] }), []) && bang(P.tree(null), []) && bang(P.tree({}), []));
    kiem("tree: nút thư mục không lộ trường nội bộ (dirs)", JSON.stringify(t).indexOf('"dirs"') < 0);
  }

  nhom("project · detectMain / javaMainClass");
  {
    const mk = (language, files) => ({ language, files: files.map(([p, c]) => ({ path: p, content: c || "" })) });
    kiem("C++: tệp có hàm main thắng tên main.cpp rỗng", P.detectMain(mk("cpp", [["main.cpp", "// trống"], ["app.cpp", "int main() { return 0; }"]])) === "app.cpp");
    kiem("C++: main trong chú thích không tính (// và /* */)", P.detectMain(mk("cpp", [["a.cpp", "// int main() {}\n/* int main() { } */"], ["b.cpp", "int main(){}"]])) === "b.cpp");
    kiem("C++: không đâu có main → ưu tiên tên main.cpp, rồi tệp cùng đuôi, nông hơn thắng", P.detectMain(mk("cpp", [["z/a.cpp", ""], ["main.cpp", ""]])) === "main.cpp" && P.detectMain(mk("cpp", [["z/y/a.cpp", ""], ["b.cpp", ""]])) === "b.cpp" && P.detectMain(mk("cpp", [["readme.md", ""], ["x.cpp", ""]])) === "x.cpp");
    kiem("C: main(void) và 'int main(' đều nhận", P.detectMain(mk("c", [["a.c", "void helper(){}"], ["b.c", "int main(void){return 0;}"]])) === "b.c");
    kiem("Java: public static void main; tệp Main.java không có main thua tệp có main", P.detectMain(mk("java", [["Main.java", "class Main {}"], ["App.java", "public class App { public static void main(String[] a){} }"]])) === "App.java");
    kiem("Python: tên main.py thắng khối __main__ ở tệp khác; không có main.py thì tệp có `if __name__ == \"__main__\"` thắng", P.detectMain(mk("python", [["main.py", "x=1"], ["run.py", "if __name__ == \"__main__\":\n    pass"]])) === "main.py" && P.detectMain(mk("python", [["a.py", "x=1"], ["run.py", "if __name__ == \"__main__\":\n    pass"]])) === "run.py");
    kiem("Python: không có khối main → main.py", P.detectMain(mk("python", [["zz.py", ""], ["main.py", ""]])) === "main.py");
    kiem("JS: index.js / main.js theo tên; Go: func main()", P.detectMain(mk("javascript", [["util.js", ""], ["index.js", ""]])) === "index.js" && P.detectMain(mk("go", [["util.go", "package x"], ["cmd.go", "package main\nfunc main() {\n}"]])) === "cmd.go");
    kiem("Rust/Kotlin/C#: có main thắng", P.detectMain(mk("rust", [["lib.rs", ""], ["app.rs", "fn main() {}"]])) === "app.rs" && P.detectMain(mk("kotlin", [["A.kt", ""], ["B.kt", "fun main() {}"]])) === "B.kt" && P.detectMain(mk("csharp", [["A.cs", ""], ["Program.cs", "static void Main(string[] a) {}"]])) === "Program.cs");
    kiem("không tệp → null; ngôn ngữ không chạy được (html) → tệp đầu có đuôi đúng hoặc tệp đầu", P.detectMain({ language: "cpp", files: [] }) === null && P.detectMain(null) === null && P.detectMain(mk("html", [["a.txt", ""], ["index.html", ""]])) === "index.html");

    const jp = javaPkg();
    kiem("javaMainClass: package app → 'app.Main'", P.javaMainClass(jp) === "app.Main");
    const nested = { language: "java", meta: { mainFile: "A.java" }, files: [{ path: "A.java", content: "package x.y;\nclass Helper {}\npublic class Outer {\n  static class In { public static void main(String[] a) {} }\n  void f() { String s = \"public static void main(String[] a)\"; }\n}\n" }] };
    kiem("javaMainClass: lớp cấp ngoài cùng chứa main (main trong lớp lồng → lớp ngoài); chuỗi/chú thích không đánh lừa", P.javaMainClass(nested) === "x.y.Outer");
    const second = { language: "java", meta: {}, files: [{ path: "A.java", content: "class First {}\nclass Second { public static void main(String[] a) {} }" }] };
    kiem("javaMainClass: nhiều lớp trong một tệp → lớp có main", P.javaMainClass(second) === "Second");
    kiem("javaMainClass: tệp chính không phải .java → ''; không tệp chính → ''", P.javaMainClass({ language: "cpp", meta: {}, files: [{ path: "main.cpp", content: "int main(){}" }] }) === "" && P.javaMainClass({ language: "java", meta: {}, files: [] }) === "");
    const viaJavaMain = { language: "java", meta: { javaMain: "pkg.B" }, files: [{ path: "A.java", content: "package pkg;\npublic class A { public static void main(String[] a) {} }" }, { path: "B.java", content: "package pkg;\npublic class B { public static void main(String[] a) {} }" }] };
    kiem("meta.javaMain chọn lớp có main khi chưa đặt mainFile", P.mainFileOf(viaJavaMain) === "B.java" && P.javaMainClass(viaJavaMain) === "pkg.B");
    kiem("mainFileOf: meta.mainFile còn tồn tại thắng; hỏng thì dò lại", P.mainFileOf({ language: "cpp", meta: { mainFile: "b.cpp" }, files: [{ path: "a.cpp", content: "int main(){}" }, { path: "b.cpp", content: "" }] }) === "b.cpp" && P.mainFileOf({ language: "cpp", meta: { mainFile: "zzz.cpp" }, files: [{ path: "a.cpp", content: "int main(){}" }] }) === "a.cpp");
  }

  nhom("project · cờ biên dịch (compileFlags / isAllowedFlag)");
  {
    const cf = (meta, o, lang) => P.compileFlags({ language: lang || "cpp", meta: meta || {} }, o);
    kiem("mặc định C++: -std=c++17 -O2; C: -std=c11 -O2", bang(cf().flags, ["-std=c++17", "-O2"]) && bang(cf({}, {}, "c").flags, ["-std=c11", "-O2"]));
    kiem("theo meta.std/opt (chấp nhận cả '-std=…' và '-O3')", bang(cf({ std: "c++20", opt: "O3" }).flags, ["-std=c++20", "-O3"]) && bang(cf({ std: "-std=gnu++17", opt: "-O1" }).flags, ["-std=gnu++17", "-O1"]) && bang(cf({ opt: "" }).flags, ["-std=c++17"]));
    const ok = ["-O0", "-O3", "-Wall", "-Wextra", "-Wpedantic", "-pedantic", "-Werror", "-g", "-pthread", "-lm", "-std=c++2b", "-std=gnu99", "-DN", "-DN=100", "-D_X1=a.b-c+1", "-Iinclude", "-Isrc/inc", "-I./x"];
    kiem("cờ cho phép: -O* -W* -g -pthread -lm -std= -D -I (tương đối)", ok.every((f) => P.isAllowedFlag(f)), ok.filter((f) => !P.isAllowedFlag(f)).join());
    const no = ["-include", "-o", "-Wl,-rpath", "-fplugin=x.so", "-x", "-L/lib", "-I/abs", "-I../up", "-Isrc/../x", "-I", "-D", "-D1X", "-DX=a b", "-DX=\"q\"", "-DX=$(id)", "-std=", "-std=c++17;x", "-Ofast", "-O", "-w", "-Wno-all", "-lfoo", "-l", "--help", "-pipe", "-fsanitize=address", "-march=native", "-isystem", "x", "", "-I" + "a".repeat(101), 5, null, undefined];
    kiem("cờ bị từ chối: -include -o -Wl -fplugin -x -L -I tuyệt đối/'..' -D hỏng -Ofast -fsanitize … (và không phải chuỗi)", no.every((f) => !P.isAllowedFlag(f)), no.filter((f) => P.isAllowedFlag(f)).join());
    const r = cf({ compileArgs: ["-Wall", "-include", "x.h", "-o", "out", "-Iinc", "-I/etc", "-DX=1"] });
    kiem("compileFlags: giữ cờ hợp lệ, cờ lạ vào rejected kèm lý do tiếng Việt; thứ tự std, opt rồi cờ thêm", bang(r.flags, ["-std=c++17", "-O2", "-Wall", "-Iinc", "-DX=1"]) && r.rejected.map((x) => x.flag).join() === "-include,x.h,-o,out,-I/etc" && r.rejected.every((x) => viet({ message: x.reason })));
    kiem("cờ trong compileArgs ghi đè mặc định: -std=… và -O* của người dùng thay vì thêm", bang(cf({ compileArgs: ["-std=c++20", "-O3"] }).flags, ["-std=c++20", "-O3"]) && bang(cf({}, { compileArgs: ["-O0"] }).flags, ["-std=c++17", "-O0"]));
    kiem("trùng cờ chỉ giữ một; chuỗi 'a b c' được tách; o.extraFlags cũng nhận", bang(cf({ compileArgs: ["-Wall", "-Wall"] }, { extraFlags: "-Wall -g" }).flags, ["-std=c++17", "-O2", "-Wall", "-g"]));
    const many = cf({ compileArgs: Array.from({ length: 20 }, (_, i) => "-DV" + i) });
    kiem("tối đa 16 cờ: phần dư vào rejected", many.flags.length === 16 && many.rejected.length === 6 && many.rejected.every((x) => /Quá 16 cờ/.test(x.reason)));
    const py = cf({ compileArgs: ["-Wall"] }, null, "python");
    kiem("ngôn ngữ không phải C/C++: không cờ nào, mọi cờ thêm bị từ chối vì chỉ áp dụng cho C/C++", py.flags.length === 0 && py.rejected.length === 1 && /C\/C\+\+/.test(py.rejected[0].reason) && cf({}, null, "java").flags.length === 0);
    kiem("toRunRequest chỉ mang cờ đã lọc", bang(P.toRunRequest({ language: "cpp", files: [{ path: "main.cpp", content: "" }], meta: { compileArgs: ["-O3", "-include", "x.h"] } }).compileArgs, ["-std=c++17", "-O3"]));
  }

  nhom("project · toRunRequest");
  {
    const p = P.setMeta(multi(), { stdin: "5\n", args: ["a", "b c"], std: "c++20" });
    const rq = P.toRunRequest(p, { provider: "Piston", runTimeoutMs: 3000 });
    kiem("toRunRequest: language, files [{name, content}], mainFile, stdin, args, compileArgs, provider, runTimeoutMs", rq.language === "cpp" && rq.files.length === 5 && rq.files[0].name === "main.cpp" && typeof rq.files[0].content === "string" && rq.mainFile === "main.cpp" && rq.stdin === "5\n" && bang(rq.args, ["a", "b c"]) && bang(rq.compileArgs, ["-std=c++20", "-O2"]) && rq.provider === "Piston" && rq.runTimeoutMs === 3000 && rq.compileTimeoutMs === undefined);
    kiem("toRunRequest: tham số o ghi đè stdin/args/mainFile/compileTimeoutMs; args ép thành chuỗi", (() => { const r = P.toRunRequest(p, { stdin: "x", args: [1, 2], mainFile: "src/stats.cpp", compileTimeoutMs: 9000 }); return r.stdin === "x" && bang(r.args, ["1", "2"]) && r.mainFile === "src/stats.cpp" && r.compileTimeoutMs === 9000; })());
    kiem("toRunRequest: không provider → không có trường provider; stdin rỗng cho phép", (() => { const r = P.toRunRequest(multi()); return !("provider" in r) && r.stdin === "" && bang(r.args, []); })());
    const e = throws(() => P.toRunRequest(P.createSnippet({ language: "html", id: "h" })));
    kiem("ngôn ngữ không chạy được trên máy chủ (html/sql/json…) → Error tiếng Việt, code run_language", e && e.code === "run_language" && viet(e) && ["html", "sql", "css", "json", "markdown", "plaintext"].every((l) => viet(throws(() => P.toRunRequest({ language: l, files: [] })))));
    kiem("13 ngôn ngữ chạy được đều tạo được yêu cầu", P.runLanguages.length === 13 && P.runLanguages.every((l) => { const s = P.createSnippet({ language: l, id: "r" }); const r = P.toRunRequest(s); return r.language === l && r.files.length === 1 && r.mainFile === s.files[0].path; }));
    kiem("toRunRequest không sửa đầu vào", frozen(p) === frozen(P.setMeta(multi(), { stdin: "5\n", args: ["a", "b c"], std: "c++20" })));
  }

  nhom("project · validate (giới hạn của backend)");
  {
    const good = P.createProject({ template: "cpp-multi", id: "g", now: 1700000000000 });
    const one = (mut, o) => { const q = P.clone(good); mut(q); return P.validate(q, o); };
    const has = (errs, re) => errs.some((e) => re.test(e));
    kiem("hợp lệ: không lỗi (cả hai đích, đích store, đích run)", P.validate(good).length === 0 && P.validate(good, { target: "store" }).length === 0 && P.validate(good, { target: "run" }).length === 0);
    kiem("không phải đối tượng → 'Bản ghi không hợp lệ'", bang(P.validate(null), ["Bản ghi không hợp lệ"]) && bang(P.validate("x"), ["Bản ghi không hợp lệ"]));
    kiem("id sai (rỗng, 81 ký tự, '/', dấu cách, không chuỗi)", ["", "a".repeat(81), "a/b", "a b", 5, null].every((v) => has(one((q) => { q.id = v; }), /Mã bản ghi \(id\)/)) && !has(one((q) => { q.id = "a".repeat(80); }), /\bid\b/) && !has(one((q) => { q.id = "A_b.c:d-9"; }), /\(id\)/));
    kiem("kind phải snippet/project", has(one((q) => { q.kind = "x"; }), /Loại bản ghi/));
    kiem("language: ≤ 32 ký tự [A-Za-z0-9_+#.-]", has(one((q) => { q.language = "c++ x"; }), /ngôn ngữ/) && has(one((q) => { q.language = "a".repeat(33); }), /ngôn ngữ/) && !has(one((q) => { q.language = "c++"; }, { target: "store" }), /ngôn ngữ/));
    kiem("tên: ≤ 200 ký tự (đếm điểm mã), không ký tự điều khiển", has(one((q) => { q.name = "x".repeat(201); }), /Tên quá dài/) && !has(one((q) => { q.name = "🙂".repeat(200); }), /Tên quá dài/) && has(one((q) => { q.name = "a\u0001b"; }), /điều khiển/) && !has(one((q) => { q.name = "  rìa  "; }), /Tên/));
    kiem("updatedAt: số nguyên ≥ 0 và ≤ năm 2100 (âm, số thực, NaN, chuỗi, quá lớn đều sai)", [-1, 1.5, NaN, Infinity, "5", null, 4102444800001].every((v) => has(one((q) => { q.updatedAt = v; }), /updatedAt/)) && !has(one((q) => { q.updatedAt = 0; }), /updatedAt/) && !has(one((q) => { q.updatedAt = 4102444800000; }), /updatedAt/));
    kiem("cần ít nhất một tệp; snippet đúng một tệp; ≤ 200 tệp", has(one((q) => { q.files = []; }), /ít nhất một tệp/) && has(one((q) => { q.kind = "snippet"; }), /đúng một tệp/) && has(one((q) => { q.files = Array.from({ length: 201 }, (_, i) => ({ path: "f" + i + ".txt", content: "" })); }), /tối đa 200/) && !has(one((q) => { q.files = Array.from({ length: 200 }, (_, i) => ({ path: "f" + i + ".txt", content: "" })); }, { target: "store" }), /tối đa 200/));
    kiem("đường dẫn xấu (kho): '..', tuyệt đối, ổ đĩa, kết thúc '/'", ["../x.cpp", "/x.cpp", "C:\\x.cpp", "d/", "a\u0000b"].every((s) => has(one((q) => { q.files[0].path = s; }, { target: "store" }), /Tệp '/)));
    kiem("Unicode trong tên tệp hợp lệ với KHO nhưng không với RUN", (() => { const mut = (q) => { q.files[0].path = "bài.cpp"; q.meta.mainFile = "bài.cpp"; }; return one(mut, { target: "store" }).length === 0 && has(one(mut, { target: "run" }), /không chạy được/); })());
    kiem("trùng tên (không phân biệt hoa/thường) và tệp-trùng-thư-mục", has(one((q) => { q.files[1].path = "MAIN.CPP"; }), /Trùng tên/) && has(one((q) => { q.files.push({ path: "include", content: "" }); }), /vừa là tệp vừa là thư mục/));
    kiem("danh sách tệp sai kiểu (content không phải chuỗi) → một lỗi gọn", bang(one((q) => { q.files[0].content = 5; }), ["Danh sách tệp không hợp lệ (mỗi tệp cần path và content là chuỗi)"]));
    kiem("meta phải là đối tượng; > 8 KB bị báo", has(one((q) => { q.meta = []; }), /meta phải là một đối tượng/) && has(one((q) => { q.meta = { a: "x".repeat(9000) }; }), /meta quá lớn/));
    kiem("bản ghi > 512 KB bị báo (đếm byte UTF-8, đo như máy chủ)", has(one((q) => { q.files[0].content = "x".repeat(520 * 1024); }), /quá lớn để đồng bộ/) && has(one((q) => { q.files[0].content = "é".repeat(270 * 1024); }), /quá lớn để đồng bộ/) && !has(one((q) => { q.files[0].content = "x".repeat(500 * 1024); }, { target: "store" }), /quá lớn/));
    kiem("bia mộ chỉ cần id/kind/language/name/updatedAt hợp lệ (không xét tệp, kích thước)", P.validate({ id: "d", kind: "project", name: "", language: "cpp", files: [], meta: {}, updatedAt: 5, deleted: true }).length === 0 && P.validate({ id: "d", kind: "project", language: "cpp", files: [], updatedAt: 5, deleted: true }).length === 0 && P.validate({ id: "", kind: "project", language: "cpp", files: [], updatedAt: 5, deleted: true }).length === 1);
    // RUN
    const run = (mut) => one(mut, { target: "run" });
    kiem("RUN: > 64 tệp", has(run((q) => { q.files = Array.from({ length: 65 }, (_, i) => ({ path: "f" + i + ".cpp", content: "" })); }), /tối đa 64/));
    kiem("RUN: tệp > 128 KB, tổng > 256 KB (đếm byte)", has(run((q) => { q.files[0].content = "x".repeat(129 * 1024); }), /quá lớn để chạy/) && has(run((q) => { q.files.forEach((f) => { f.content = "x".repeat(60 * 1024); }); }), /Tổng dung lượng/) && !has(run((q) => { q.files[0].content = "x".repeat(128 * 1024); }), /quá lớn để chạy/) && has(run((q) => { q.files[0].content = "é".repeat(70 * 1024); }), /quá lớn để chạy/));
    kiem("RUN: C/C++ cần ít nhất một tệp mã nguồn", has(run((q) => { q.files = [{ path: "readme.md", content: "" }]; }), /mã nguồn \.cpp/) && !has(P.validate(Object.assign(P.createSnippet({ language: "python", id: "p" }), {}), { target: "run" }), /mã nguồn/));
    kiem("RUN: stdin ≤ 64 KB (byte); args ≤ 16, mỗi cái ≤ 200 ký tự, không NUL", has(run((q) => { q.meta.stdin = "x".repeat(64 * 1024 + 1); }), /stdin/) && !has(run((q) => { q.meta.stdin = "x".repeat(64 * 1024); }), /stdin/) && has(run((q) => { q.meta.args = Array(17).fill("a"); }), /Quá nhiều tham số/) && has(run((q) => { q.meta.args = ["a".repeat(201)]; }), /dài quá 200/) && has(run((q) => { q.meta.args = ["a\u0000b"]; }), /NUL/));
    kiem("RUN: cờ biên dịch lạ báo 'bị bỏ' (chỉ C/C++)", has(run((q) => { q.meta.compileArgs = ["-include", "x.h"]; }), /Cờ biên dịch '-include' bị bỏ/) && !has(run((q) => { q.language = "python"; q.files = [{ path: "main.py", content: "" }]; q.meta = { compileArgs: ["-include"] }; }), /Cờ biên dịch/));
    kiem("RUN: Java — thiếu main, hoặc lớp chứa main khác tên tệp, đều báo bằng tiếng Việt", P.validate(P.createProject({ template: "java-single", id: "j", now: 5 }), { target: "run" }).length === 0 && has(P.validate(Object.assign(P.createProject({ template: "java-single", id: "j" }), { files: [{ path: "Main.java", content: "class Main {}" }] }), { target: "run" }), /không có hàm public static void main/) && has(P.validate(Object.assign(P.createProject({ template: "java-single", id: "j" }), { files: [{ path: "Main.java", content: "public class Other { public static void main(String[] a) {} }" }] }), { target: "run" }), /Lớp chứa main là 'Other'/));
    kiem("RUN: ngôn ngữ không chạy được báo khi target='run', im lặng khi target bỏ trống", has(P.validate(P.createSnippet({ language: "html", id: "h" }), { target: "run" }), /không chạy được trên máy chủ/) && P.validate(P.createSnippet({ language: "html", id: "h" })).length === 0);
    kiem("RUN: tên tệp xấu cho /run báo 'không chạy được' nhưng KHO vẫn hợp lệ", (() => { const mut = (q) => { q.files[1].path = "include/a b.h"; }; return one(mut, { target: "store" }).length === 0 && has(run(mut), /không chạy được/); })());
    kiem("RUN: tên thiết bị Windows bị chặn", has(run((q) => { q.files[1].path = "include/nul.h"; }), /thiết bị/));
    kiem("validate không sửa đầu vào và trả lỗi không trùng lặp", (() => { const q = P.clone(good); q.files.forEach((f) => { f.path = "../x" + f.path.replace(/\//g, "_"); }); const e = P.validate(q), b = frozen(q); return new Set(e).size === e.length && frozen(q) === b; })());
    kiem("itemBytes: bằng đúng số byte JSON của Python json.dumps(ensure_ascii=False) (đo như máy chủ)", P.itemBytes({ id: "a", kind: "snippet", name: "é", language: "cpp", files: [{ path: "a", content: "x" }], meta: {}, updatedAt: 1, deleted: false }) === 185 && P.utf8Bytes("é🙂a") === 7 && P.utf8Bytes("\ud800") === 3);
  }

  /* ================================================================ zip */
  nhom("zip · CRC-32, UTF-8");
  if (!CS.zip) { kiem("có module zip", false); return; }
  const Z = CS.zip;
  const bytes = (s) => new Uint8Array(Buffer.from(s, "utf8"));
  const eq = (a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0;
  const sha = (b) => crypto.createHash("sha256").update(Buffer.from(b)).digest("hex");
  const rej = (p) => p.then(() => null, (e) => e);
  const inflateNode = (d, limit) => Promise.resolve(zlib.inflateRawSync(d, { maxOutputLength: Math.max(1, limit || 0) || undefined }));
  const inflateNaive = (d) => Promise.resolve(zlib.inflateRawSync(d));          // bỏ qua limit: zip.js vẫn phải chặn sau khi giải nén
  let inflateCalls = 0;
  const inflateCounting = (d, l) => { inflateCalls++; return inflateNode(d, l); };
  {
    kiem("crc32: vector chuẩn ('123456789' = CBF43926, '' = 0, 'a' = E8B7BE43)", Z.crc32(bytes("123456789")) === 0xcbf43926 && Z.crc32(new Uint8Array(0)) === 0 && Z.crc32(bytes("a")) === 0xe8b7be43 && Z.crc32("123456789") === 0xcbf43926);
    const big = crypto.randomBytes(100000);
    kiem("crc32 khớp zlib.crc32 / tính nối tiếp bằng tham số prev", (zlib.crc32 ? Z.crc32(big) === zlib.crc32(big) : true) && Z.crc32(big.subarray(50000), Z.crc32(big.subarray(0, 50000))) === Z.crc32(big));
    const samples = ["", "abc", "Xin chào Việt Nam — Đặng Ơ ư ă", "日本語 🙂 𝄞 \u0000 end", "\u00ff\u07ff\u0800\uffff"];
    kiem("utf8Encode/utf8Decode vòng tròn (Việt, CJK, emoji, NUL, ranh giới 1/2/3/4 byte)", samples.every((s) => Z.utf8Decode(Z.utf8Encode(s)) === s && eq(Z.utf8Encode(s), Buffer.from(s, "utf8"))));
    kiem("utf8Decode giữ BOM; utf8DecodeStrict hợp lệ → chuỗi", Z.utf8Decode(new Uint8Array([0xef, 0xbb, 0xbf, 0x41])) === "\ufeffA" && Z.utf8DecodeStrict(Z.utf8Encode("é🙂")) === "é🙂");
    const invalid = [[0xff], [0xc0, 0x80], [0xe0, 0x80, 0x80], [0xed, 0xa0, 0x80], [0xf4, 0x90, 0x80, 0x80], [0xf5, 0x80, 0x80, 0x80], [0xc3], [0xe2, 0x82], [0x80], [0x41, 0xc3, 0x28]];
    kiem("utf8DecodeStrict: byte sai (lẻ, quá dài, nửa cặp thay thế, > U+10FFFF, cụt) → null; utf8Decode thay U+FFFD", invalid.every((b) => Z.utf8DecodeStrict(new Uint8Array(b)) === null && Z.utf8Decode(new Uint8Array(b)).indexOf("\ufffd") >= 0));

    // bộ giải mã dự phòng (không có TextEncoder/TextDecoder)
    const zipPath = A("core/zip.js"), keepZ = CS.zip, keepTE = globalThis.TextEncoder, keepTD = globalThis.TextDecoder, cached = require.cache[zipPath];
    let fb = null;
    try { globalThis.TextEncoder = undefined; globalThis.TextDecoder = undefined; delete require.cache[zipPath]; require(zipPath); fb = CS.zip; }
    finally { globalThis.TextEncoder = keepTE; globalThis.TextDecoder = keepTD; CS.zip = keepZ; if (cached) require.cache[zipPath] = cached; }
    kiem("bộ mã hoá/giải mã DỰ PHÒNG (không TextEncoder/TextDecoder) cho kết quả y hệt", !!fb && fb !== keepZ && samples.every((s) => eq(fb.utf8Encode(s), Buffer.from(s, "utf8")) && fb.utf8Decode(Buffer.from(s, "utf8")) === s && fb.utf8DecodeStrict(Buffer.from(s, "utf8")) === s));
    kiem("… và từ chối đúng các chuỗi byte sai (strict → null, lỏng → U+FFFD); chuỗi dài > 100 KB không tràn ngăn xếp", !!fb && invalid.every((b) => fb.utf8DecodeStrict(new Uint8Array(b)) === null && fb.utf8Decode(new Uint8Array(b)).indexOf("\ufffd") >= 0) && fb.utf8Decode(Buffer.from("é".repeat(100000))).length === 100000 && eq(fb.utf8Encode("\ud800"), [0xef, 0xbf, 0xbd]));
  }

  nhom("zip · create → read (vòng tròn, cấu trúc tệp)");
  {
    const all = new Uint8Array(256); for (let i = 0; i < 256; i++) all[i] = i;
    const ents = [{ path: "a.txt", content: "Xin chào" }, { path: "bin/all.bin", content: all }, { path: "rong.txt", content: "" }, { path: "trống/", content: undefined }, { path: "tiếng Việt/bài 1/xin chào 🙂.py", content: "print('é')\n" }, { path: "big.txt", content: "x".repeat(1000000) }];
    const z = Z.create(ents, { date: new Date(2026, 9, 15, 13, 45, 30) });
    kiem("create trả Uint8Array; kết thúc bằng EOCD (PK 05 06) với số mục đúng và không comment", z instanceof Uint8Array && z[z.length - 22] === 0x50 && z[z.length - 21] === 0x4b && z[z.length - 20] === 5 && z[z.length - 19] === 6 && Buffer.from(z).readUInt16LE(z.length - 12) === 6 && Buffer.from(z).readUInt16LE(z.length - 2) === 0);
    const dv = Buffer.from(z);
    kiem("local header: chữ ký PK 03 04, STORE (0), cờ bit 11 (tên UTF-8) bật, CRC và kích thước đúng", dv.readUInt32LE(0) === 0x04034b50 && dv.readUInt16LE(6) === 0x0800 && dv.readUInt16LE(8) === 0 && dv.readUInt32LE(14) === Z.crc32(bytes("Xin chào")) && dv.readUInt32LE(18) === 9 && dv.readUInt32LE(22) === 9);
    kiem("ngày giờ DOS đúng (2026-10-15 13:45:30, giây làm tròn xuống chẵn)", dv.readUInt16LE(12) === (((2026 - 1980) << 9) | (10 << 5) | 15) && dv.readUInt16LE(10) === ((13 << 11) | (45 << 5) | 15));
    const back = await Z.read(z);
    kiem("read(create(x)) trả đủ mục theo đúng thứ tự, đúng kiểu mảng, có .skipped rỗng", Array.isArray(back) && back.length === 6 && bang(back.map((e) => e.path), ["a.txt", "bin/all.bin", "rong.txt", "trống", "tiếng Việt/bài 1/xin chào 🙂.py", "big.txt"]) && Array.isArray(back.skipped) && back.skipped.length === 0);
    kiem("nội dung nguyên vẹn: chữ, 256 byte, rỗng, 1 MB; thư mục có dir:true và data rỗng", back[0].data instanceof Uint8Array && Z.utf8Decode(back[0].data) === "Xin chào" && eq(back[1].data, all) && back[2].data.length === 0 && back[3].dir === true && back[3].data.length === 0 && back[5].data.length === 1000000 && back.filter((e) => !e.dir).every((e) => e.dir === false));
    kiem("mục có path kết thúc '/' là thư mục: tên trong zip có '/' cuối; không có dữ liệu", (() => { const x = Z.create([{ path: "d/", content: "BỎ QUA" }]); return Buffer.from(x).readUInt32LE(18) === 0 && x.length === 30 + 2 + 46 + 2 + 22; })());
    kiem("create: đường dẫn '\\' được chuẩn hoá; './' và '//' bỏ", bang((await Z.read(Z.create([{ path: ".\\a\\\\b.txt", content: "x" }]))).map((e) => e.path), ["a/b.txt"]));
    kiem("create: từ chối '..', tuyệt đối, ổ đĩa, rỗng, trùng, không phải mảng/không có path/nội dung sai kiểu (Error tiếng Việt)", ["../x", "/x", "C:\\x", "", "a/../b"].every((p) => viet(throws(() => Z.create([{ path: p, content: "" }])))) && viet(throws(() => Z.create([{ path: "a", content: "" }, { path: "a", content: "" }]))) && viet(throws(() => Z.create("x"))) && viet(throws(() => Z.create([{ content: "" }]))) && viet(throws(() => Z.create([{ path: "a", content: 5 }]))));
    kiem("create: nhận ArrayBuffer/Buffer/Uint8Array con; zip rỗng vẫn đọc được", eq((await Z.read(Z.create([{ path: "a", content: new Uint8Array([1, 2, 3]).buffer }])))[0].data, [1, 2, 3]) && eq((await Z.read(Z.create([{ path: "a", content: Buffer.from("xyz") }])))[0].data, [120, 121, 122]) && (await Z.read(Z.create([]))).length === 0 && Z.create([]).length === 22);
    kiem("read nhận ArrayBuffer và Buffer; read không sửa đầu vào", (await Z.read(z.buffer.slice(z.byteOffset, z.byteOffset + z.byteLength))).length === 6 && (await Z.read(Buffer.from(z))).length === 6);
    kiem("read: dữ liệu trả về là bản sao độc lập (sửa không ảnh hưởng zip gốc)", await (async () => { const c = Z.create([{ path: "a", content: "abc" }]), r1 = await Z.read(c); r1[0].data[0] = 0; return (await Z.read(c))[0].data[0] === 97; })());
    const t0 = Date.now(), many = Z.create(Array.from({ length: 1500 }, (_, i) => ({ path: "d" + (i % 30) + "/f" + i + ".txt", content: "n" + i })));
    const manyBack = await Z.read(many);
    kiem("hiệu năng: 1.500 tệp tạo + đọc dưới 1,5 giây", manyBack.length === 1500 && Date.now() - t0 < 1500, String(Date.now() - t0));
  }

  // ---- bộ dựng zip tay (zlib) cho các tình huống mà create() không tạo ra: DEFLATE, comment, mô tả dữ liệu, zip độc hại
  const U16 = (n) => { const b = Buffer.alloc(2); b.writeUInt16LE(n & 0xffff); return b; };
  const U32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b; };
  function buildZip(entries, o) {
    o = o || {};
    const locals = [], cds = [];
    let off = 0;
    entries.forEach((e) => {
      const nameBytes = e.nameBytes || Buffer.from(e.name, "utf8"), raw = Buffer.from(e.data === undefined ? "" : e.data), method = e.method === undefined ? 8 : e.method;
      const comp = e.comp || (method === 8 ? zlib.deflateRawSync(raw) : raw), crc = e.crc !== undefined ? e.crc : Z.crc32(raw);
      const usize = e.usize !== undefined ? e.usize : raw.length, csize = e.csize !== undefined ? e.csize : comp.length;
      const flags = e.flags !== undefined ? e.flags : 0x0800, extra = e.extra || Buffer.alloc(0), dd = !!e.dd;
      const lf = flags | (dd ? 8 : 0);
      const local = Buffer.concat([U32(0x04034b50), U16(20), U16(lf), U16(method), U16(0), U16(0x21), U32(dd ? 0 : crc), U32(dd ? 0 : csize), U32(dd ? 0 : usize), U16(nameBytes.length), U16(extra.length), nameBytes, extra, comp,
        dd ? Buffer.concat([U32(0x08074b50), U32(crc), U32(csize), U32(usize)]) : Buffer.alloc(0)]);
      cds.push(Buffer.concat([U32(0x02014b50), U16(0x031e), U16(20), U16(lf), U16(method), U16(0), U16(0x21), U32(crc), U32(csize), U32(usize), U16(nameBytes.length), U16(extra.length), U16(0), U16(0), U16(0), U32(e.attr || 0), U32(off), nameBytes, extra]));
      locals.push(local); off += local.length;
    });
    const cd = Buffer.concat(cds), comment = Buffer.from(o.comment || "");
    return new Uint8Array(Buffer.concat([Buffer.concat(locals), cd, o.zip64 ? Buffer.concat([U32(0x07064b50), U32(0), Buffer.alloc(8), U32(1)]) : Buffer.alloc(0),
      U32(0x06054b50), U16(o.disk || 0), U16(o.cdDisk || 0), U16(entries.length), U16(o.total !== undefined ? o.total : entries.length), U32(cd.length), U32(o.cdOffset !== undefined ? o.cdOffset : off), U16(comment.length), comment]));
  }
  const text = (e) => Z.utf8Decode(e.data);

  nhom("zip · đọc zip DEFLATE (zlib), comment, mô tả dữ liệu, tên không cờ UTF-8");
  {
    const content = "dòng lặp lại để nén tốt\n".repeat(5000);
    const z = buildZip([{ name: "nen.txt", data: content }, { name: "luu.txt", data: "không nén", method: 0 }, { name: "rong.txt", data: "" }, { name: "dd.txt", data: "có mô tả dữ liệu ".repeat(100), dd: true }, { name: "d/", data: "", method: 0 }]);
    const r = await Z.read(z, { inflateRaw: inflateNode });
    kiem("DEFLATE + STORE + rỗng + mô tả dữ liệu (cờ bit 3) cùng một zip", r.length === 5 && text(r[0]) === content && text(r[1]) === "không nén" && r[2].data.length === 0 && text(r[3]) === "có mô tả dữ liệu ".repeat(100) && r[4].dir === true && r.skipped.length === 0, JSON.stringify(r.skipped));
    kiem("DEFLATE nén thật (zip nhỏ hơn dữ liệu nhiều lần)", z.length < content.length / 20);
    if (typeof DecompressionStream === "function") {
      const r2 = await Z.read(z);
      kiem("mặc định (không truyền inflateRaw) dùng DecompressionStream('deflate-raw') — cho cùng kết quả", r2.length === 5 && text(r2[0]) === content && text(r2[3]) === text(r[3]));
      const hong = buildZip([{ name: "x.txt", data: "abc", comp: Buffer.from([0xff, 0xff, 0xff, 0xff]), usize: 3, crc: Z.crc32(bytes("abc")) }, { name: "ok.txt", data: "tốt" }]);
      const r3 = await Z.read(hong);
      kiem("mặc định: luồng deflate hỏng → bỏ mục đó ('dữ liệu nén hỏng'), mục khác vẫn đọc", r3.length === 1 && text(r3[0]) === "tốt" && /nén hỏng/.test(r3.skipped[0].reason) && r3.skipped[0].path === "x.txt");
    } else kiem("(bỏ qua) môi trường này không có DecompressionStream", true);
    const ghost = buildZip([{ name: "a.txt", data: "xin chào" }], { comment: "ghi chú của zip — có cả PK\u0005\u0006 giả" });
    const gr = await Z.read(ghost, { inflateRaw: inflateNode });
    kiem("zip có COMMENT (kể cả comment chứa chữ ký EOCD giả): vẫn tìm đúng EOCD thật", gr.length === 1 && text(gr[0]) === "xin chào");
    const longComment = buildZip([{ name: "a.txt", data: "x" }], { comment: "c".repeat(60000) });
    kiem("comment dài 60.000 byte vẫn tìm được EOCD", (await Z.read(longComment, { inflateRaw: inflateNode })).length === 1);
    // tên không đặt cờ UTF-8
    const cp = buildZip([{ nameBytes: Buffer.from([0x62, 0xe0, 0x69, 0x2e, 0x74, 0x78, 0x74].map((x) => x)), flags: 0, data: "a", method: 0 }]);
    kiem("tên không cờ UTF-8, byte không phải UTF-8 hợp lệ → giải theo CP437 (0xE0 = α)", (await Z.read(cp))[0].path === "bαi.txt");
    const cpUtf = buildZip([{ nameBytes: Buffer.from("bài.txt", "utf8"), flags: 0, data: "a", method: 0 }]);
    kiem("tên không cờ nhưng là UTF-8 hợp lệ (macOS/Linux hay làm vậy) → nhận như UTF-8", (await Z.read(cpUtf))[0].path === "bài.txt");
    const upath = Buffer.concat([U16(0x7075), U16(1 + 4 + Buffer.byteLength("tệp-đúng.txt")), Buffer.from([1]), U32(Z.crc32(Buffer.from([0x74, 0x65, 0x70]))), Buffer.from("tệp-đúng.txt", "utf8")]);
    const uz = buildZip([{ nameBytes: Buffer.from("tep"), flags: 0, data: "a", method: 0, extra: upath }]);
    kiem("trường Info-ZIP Unicode Path (0x7075) có CRC khớp tên gốc → dùng tên Unicode", (await Z.read(uz))[0].path === "tệp-đúng.txt");
    const upathBad = Buffer.concat([U16(0x7075), U16(1 + 4 + 3), Buffer.from([1]), U32(12345), Buffer.from("zzz")]);
    kiem("… CRC không khớp → bỏ qua trường đó", (await Z.read(buildZip([{ nameBytes: Buffer.from("tep"), flags: 0, data: "a", method: 0, extra: upathBad }])))[0].path === "tep");
    kiem("dấu '\\' trong tên (zip tạo bằng công cụ Windows cũ) → '/'", (await Z.read(buildZip([{ name: "src\\main.cpp", data: "x", method: 0 }])))[0].path === "src/main.cpp");
    kiem("tên './a.txt', 'a//b.txt' được làm sạch", bang((await Z.read(buildZip([{ name: "./a.txt", data: "x", method: 0 }, { name: "d//b.txt", data: "y", method: 0 }]))).map((e) => e.path), ["a.txt", "d/b.txt"]));
    const crcBad = await Z.read(buildZip([{ name: "x.txt", data: "abc", method: 0, crc: 1234 }, { name: "y.txt", data: "ok", method: 0 }]));
    kiem("sai CRC → bỏ mục đó + ghi skipped, mục khác nguyên vẹn", crcBad.length === 1 && crcBad[0].path === "y.txt" && /CRC/.test(crcBad.skipped[0].reason));
    const m14 = await Z.read(buildZip([{ name: "lzma.bin", data: "x", method: 14, comp: Buffer.from([1, 2, 3]) }, { name: "ok.txt", data: "ok", method: 0 }]));
    kiem("phương thức nén lạ (14 = LZMA) → bỏ mục + ghi skipped có số phương thức, không làm hỏng cả zip", m14.length === 1 && /phương thức nén 14/.test(m14.skipped[0].reason));
    const cut = buildZip([{ name: "x.txt", data: "abcdef", method: 0, csize: 6 }]);
    const trunc = cut.slice(0, 20);                                              // cắt cụt hẳn → mất EOCD
    kiem("zip cắt cụt (mất phần cuối) → Error tiếng Việt, không treo", viet(await rej(Z.read(trunc))));
    const lyingOff = buildZip([{ name: "x.txt", data: "abc", method: 0 }], { cdOffset: 5 });
    kiem("danh mục tệp trỏ sai chỗ → Error 'bị hỏng'", /hỏng/.test((await rej(Z.read(lyingOff))).message));
    const badLocal = buildZip([{ name: "x.txt", data: "abc", method: 0 }, { name: "y.txt", data: "yy", method: 0 }]);
    const bl = new Uint8Array(badLocal); bl[0] = 0;                              // phá chữ ký local header của mục đầu
    const blr = await Z.read(bl);
    kiem("local header mục đầu hỏng → bỏ mục đó ('tiêu đề cục bộ hỏng'), mục sau vẫn đọc", blr.length === 1 && blr[0].path === "y.txt" && /tiêu đề cục bộ/.test(blr.skipped[0].reason));
  }

  nhom("zip · từ chối: không phải zip, mã hoá, ZIP64, nhiều phần, quá nhiều mục");
  {
    const errOf = async (b, o) => { const e = await rej(Z.read(b, Object.assign({ inflateRaw: inflateNode }, o))); return e; };
    kiem("rỗng / quá ngắn / byte ngẫu nhiên / văn bản → Error tiếng Việt code not_zip (không phải 'TypeError' trần)", (await Promise.all([new Uint8Array(0), new Uint8Array(10), new Uint8Array(crypto.randomBytes(5000)), bytes("đây là tệp văn bản, không phải zip".repeat(20))].map((b) => errOf(b)))).every((e) => e && e.code === "not_zip" && viet(e)));
    kiem("đầu vào không phải byte (chuỗi, null, số) → Error tiếng Việt", (await Promise.all(["abc", null, 5, {}].map((v) => rej(Z.read(v))))).every((e) => e && viet(e)));
    const enc = await errOf(buildZip([{ name: "bi-mat.txt", data: "x", flags: 0x0801 }]));
    kiem("zip có mã hoá bằng mật khẩu (cờ bit 0) → từ chối cả zip, nói rõ 'mã hoá'", enc && enc.code === "encrypted" && /mã hoá/.test(enc.message));
    kiem("mã hoá mạnh (cờ bit 6) cũng từ chối", (await errOf(buildZip([{ name: "a", data: "x", flags: 0x0840 }]))).code === "encrypted");
    const z64 = await errOf(buildZip([{ name: "a.txt", data: "x", method: 0 }], { zip64: true }));
    kiem("ZIP64 (có bộ định vị ZIP64) → Error 'ZIP64'", z64 && z64.code === "zip64" && /ZIP64/.test(z64.message));
    kiem("ZIP64 theo trường 0xFFFFFFFF (kích thước/offset) → Error 'ZIP64'", (await errOf(buildZip([{ name: "a.txt", data: "x", method: 0, csize: 0xffffffff, usize: 0xffffffff }]))).code === "zip64" && (await errOf(buildZip([{ name: "a.txt", data: "x", method: 0 }], { cdOffset: 0xffffffff }))).code === "zip64");
    const md = await errOf(buildZip([{ name: "a.txt", data: "x", method: 0 }], { disk: 1 }));
    kiem("zip nhiều phần (số đĩa ≠ 0) → Error", md && md.code === "multi_disk" && viet(md));
    const entries2001 = buildZip(Array.from({ length: 2001 }, (_, i) => ({ name: "f" + i, data: "", method: 0 })));
    const tm = await errOf(entries2001);
    kiem("2.001 mục (> maxEntries 2000 mặc định) → từ chối cả zip, nói số mục", tm && tm.code === "too_many" && /2001/.test(tm.message));
    kiem("đúng 2.000 mục thì được; maxEntries tuỳ chỉnh", (await Z.read(buildZip(Array.from({ length: 2000 }, (_, i) => ({ name: "f" + i, data: "", method: 0 }))), { inflateRaw: inflateNode })).length === 2000 && (await errOf(buildZip(Array.from({ length: 6 }, (_, i) => ({ name: "f" + i, data: "", method: 0 }))), { maxEntries: 5 })).code === "too_many");
    kiem("mục đếm trong EOCD nhiều hơn danh mục thật → Error 'bị hỏng' (không đọc tràn)", /hỏng/.test((await errOf(buildZip([{ name: "a", data: "x", method: 0 }], { total: 3 }))).message));
  }

  nhom("zip · zip-slip");
  {
    const evil = ["../evil.txt", "a/../../evil.txt", "a/b/../../../evil.txt", "/etc/passwd", "//server/share/x", "C:\\Windows\\evil.txt", "c:/x.txt", "C:evil.txt", "..\\evil.txt", "a\\..\\..\\evil.txt", "dir/..", "..", "nul\u0000.txt"];
    const z = buildZip(evil.map((n) => ({ name: n, data: "x", method: 0 })).concat([{ name: "ok/an-toan.txt", data: "tốt", method: 0 }]));
    const r = await Z.read(z);
    kiem("mọi tên có '..', tuyệt đối, ổ đĩa, '\\' kiểu ổ đĩa, NUL → bỏ qua + ghi skipped; tên an toàn còn", r.length === 1 && r[0].path === "ok/an-toan.txt" && r.skipped.length === evil.length, r.map((e) => e.path).join() + " / " + r.skipped.length);
    kiem("skipped ghi đúng path gốc và lý do tiếng Việt", r.skipped.every((s) => typeof s.path === "string" && viet({ message: s.reason }) || /NUL|zip-slip|rỗng/.test(s.reason)) && r.skipped[0].path === "../evil.txt" && /zip-slip/.test(r.skipped[0].reason));
    const dirs = await Z.read(buildZip([{ name: "../d/", data: "", method: 0 }, { name: "/abs/", data: "", method: 0 }, { name: "good/", data: "", method: 0 }]));
    kiem("mục thư mục độc hại cũng bị bỏ", dirs.length === 1 && dirs[0].path === "good" && dirs.skipped.length === 2);
    const noSlipInProject = (() => { const rr = Z.zipToProject(Object.assign([{ path: "../x.cpp", data: bytes("evil"), dir: false }, { path: "a.cpp", data: bytes("int a;"), dir: false }], {})); return paths(rr).join() === "a.cpp" && rr.meta.skipped.some((s) => s.path === "../x.cpp"); })();
    kiem("zipToProject cũng tự kiểm đường dẫn (phòng entries đến từ nguồn khác)", noSlipInProject);
  }

  nhom("zip · zip bomb và trần dung lượng");
  {
    const zeros = (mbs) => Buffer.alloc(mbs * 1024 * 1024);
    // khai báo nhỏ, thực tế lớn
    const liar = buildZip([{ name: "bom.txt", data: zeros(30), usize: 100 }]);
    kiem("zip nén cực mạnh (30 MB số 0 → vài chục KB): kích thước thực của zip nhỏ", liar.length < 100000, String(liar.length));
    let e = await rej(Z.read(liar, { inflateRaw: inflateNode }));
    kiem("khai báo 100 byte nhưng giải ra 30 MB (inflate biết giới hạn) → từ chối cả zip, code zip_bomb", e && e.code === "zip_bomb" && /zip bomb/.test(e.message) && viet(e));
    e = await rej(Z.read(liar, { inflateRaw: inflateNaive }));
    kiem("… inflate KHÔNG tôn trọng giới hạn (giải hết 30 MB) → vẫn bị chặn ngay sau đó nhờ so kích thước thực", e && e.code === "zip_bomb");
    if (typeof DecompressionStream === "function") {
      const t0 = Date.now();
      e = await rej(Z.read(liar));
      kiem("mặc định (DecompressionStream): dừng giải nén ngay khi vượt giới hạn, không phình bộ nhớ", e && e.code === "zip_bomb" && Date.now() - t0 < 3000, String(Date.now() - t0));
      const huge = buildZip([{ name: "to.txt", data: zeros(80), usize: 80 * 1024 * 1024 }]);
      e = await rej(Z.read(huge));
      kiem("khai báo 80 MB trung thực (> 50 MB) → từ chối từ khai báo, không giải nén", e && e.code === "too_big");
    }
    inflateCalls = 0;
    e = await rej(Z.read(buildZip([{ name: "a.txt", data: "x".repeat(5000) }]), { inflateRaw: inflateCounting, maxTotal: 1000 }));
    kiem("khai báo vượt maxTotal → từ chối TRƯỚC khi giải nén (inflate không bị gọi)", e && e.code === "too_big" && inflateCalls === 0 && /MB|vượt/.test(e.message));
    e = await rej(Z.read(buildZip([1, 2, 3].map((i) => ({ name: "f" + i, data: "y".repeat(400), method: 0 }))), { maxTotal: 1000 }));
    kiem("tổng khai báo của nhiều tệp (3 × 400 > 1000) vượt maxTotal → từ chối", e && e.code === "too_big");
    const ok = await Z.read(buildZip([1, 2].map((i) => ({ name: "f" + i, data: "y".repeat(400), method: 0 }))), { maxTotal: 1000 });
    kiem("tổng đúng bằng/nhỏ hơn maxTotal thì đọc được", ok.length === 2);
    const real = await Z.read(buildZip([{ name: "lon.bin", data: zeros(20) }]), { inflateRaw: inflateNode });
    kiem("tệp 20 MB nén tốt, khai báo trung thực (< 50 MB) vẫn đọc được", real.length === 1 && real[0].data.length === 20 * 1024 * 1024);
    e = await rej(Z.read(buildZip([{ name: "a.bin", data: zeros(3) }, { name: "b.bin", data: zeros(3) }]), { inflateRaw: inflateNode, maxTotal: 5 * 1024 * 1024 }));
    kiem("hai tệp trung thực 3 MB + 3 MB vượt maxTotal 5 MB → từ chối (tính từ khai báo)", e && e.code === "too_big");
    // khai báo lệch: nhiều mục khai báo nhỏ nhưng tổng thực lớn
    const sneaky = buildZip([{ name: "a.bin", data: zeros(3), usize: 3 * 1024 * 1024 - 1 }, { name: "b.bin", data: zeros(3) }]);
    e = await rej(Z.read(sneaky, { inflateRaw: inflateNode, maxTotal: 10 * 1024 * 1024 }));
    kiem("khai báo lệch 1 byte so với thực tế → bị bắt (zip_bomb), không nhận dữ liệu thừa", e && e.code === "zip_bomb");
    const short = await Z.read(buildZip([{ name: "a.bin", data: "abc", usize: 10 }, { name: "ok.txt", data: "ok" }]), { inflateRaw: inflateNode });
    kiem("khai báo LỚN hơn thực tế (hỏng) → bỏ mục đó, không từ chối cả zip", short.length === 1 && /kích thước/.test(short.skipped[0].reason));
    kiem("STORE với csize ≠ usize → bỏ mục đó", (await Z.read(buildZip([{ name: "a", data: "abc", method: 0, usize: 5 }]))).skipped.length === 1);
    e = await rej(Z.read(buildZip([{ name: "a", data: "x", method: 0 }]), { inflateRaw: () => Promise.reject(Object.assign(new RangeError("x"), { code: "ERR_BUFFER_TOO_LARGE" })), maxTotal: 100 }));
    kiem("(không gọi inflate cho STORE) vẫn đọc bình thường khi inflate luôn lỗi", e === null);
  }

  nhom("zip · tương thích với Python zipfile (nếu máy có python)");
  {
    const pyCmd = ["python", "py", "python3"].find((c) => { try { execFileSync(c, ["--version"], { stdio: "ignore", timeout: 15000 }); return true; } catch (e) { return false; } });
    if (!pyCmd) kiem("(bỏ qua) không có python/py trong PATH", true);
    else {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cs-zip-"));
      try {
        const PYGEN = String.raw`
import zipfile, sys, os
d = sys.argv[1]
def put(z, name, data, ctype=None):
    z.writestr(name, data, compress_type=ctype if ctype is not None else z.compression)
text = "dòng lặp để nén tốt\n" * 4000
for kind, comp in (("stored", zipfile.ZIP_STORED), ("deflated", zipfile.ZIP_DEFLATED)):
    with zipfile.ZipFile(os.path.join(d, kind + ".zip"), "w", comp) as z:
        put(z, "bai-tap/main.cpp", '#include <iostream>\nint main() { std::cout << "Xin chào"; }\n')
        put(z, "bai-tap/src/xin chào.cpp", text)
        put(z, "bai-tap/emoji-🙂.txt", "mặt cười")
        put(z, "bai-tap/rong.txt", "")
        put(z, "bai-tap/thu-muc-rong/", "")
        put(z, "bai-tap/nhi-phan.bin", bytes(range(256)) * 4)
        put(z, "bai-tap/latin1.txt", "caf\xe9".encode("latin-1"))
        z.comment = "chú thích zip: PK\x05\x06 giả".encode("utf-8")
with zipfile.ZipFile(os.path.join(d, "mac.zip"), "w", zipfile.ZIP_DEFLATED) as z:
    put(z, "proj/main.py", "print('hi')\n")
    put(z, "proj/.DS_Store", b"\x00\x00\x00junk")
    put(z, "proj/Thumbs.db", b"junk")
    put(z, "__MACOSX/proj/._main.py", b"\x00\x05\x16\x07")
    put(z, "__MACOSX/", "")
    put(z, "proj/lib/util.py", "def f(): return 1\n")
`;
        fs.writeFileSync(path.join(dir, "gen.py"), PYGEN, "utf8");
        execFileSync(pyCmd, [path.join(dir, "gen.py"), dir], { timeout: 60000, env: Object.assign({}, process.env, { PYTHONUTF8: "1" }) });
        const content = "dòng lặp để nén tốt\n".repeat(4000);
        for (const kind of ["stored", "deflated"]) {
          const buf = fs.readFileSync(path.join(dir, kind + ".zip"));
          const r = await Z.read(new Uint8Array(buf), { inflateRaw: inflateNode });
          const byPath = Object.fromEntries(r.map((e) => [e.path, e]));
          kiem("zip do Python tạo (" + kind + ", có comment, tên Unicode/emoji): đọc đủ mục", r.length === 7 && !!byPath["bai-tap/src/xin chào.cpp"] && !!byPath["bai-tap/emoji-🙂.txt"] && byPath["bai-tap/thu-muc-rong"] && byPath["bai-tap/thu-muc-rong"].dir === true && r.skipped.length === 0, r.map((e) => e.path).join("|"));
          kiem("… nội dung đúng (chữ Việt, rỗng, 1 KB nhị phân)", text(byPath["bai-tap/src/xin chào.cpp"]) === content && byPath["bai-tap/rong.txt"].data.length === 0 && byPath["bai-tap/nhi-phan.bin"].data.length === 1024 && byPath["bai-tap/nhi-phan.bin"].data[255] === 255);
          const proj = Z.zipToProject(r, { name: "bai-tap-" + kind });
          kiem("… zipToProject: bỏ thư mục gốc 'bai-tap/', bỏ tệp nhị phân + latin1, giữ thư mục rỗng, C++, ghi skipped", bang(paths(proj).sort(), ["emoji-🙂.txt", "main.cpp", "rong.txt", "src/xin chào.cpp"]) && proj.language === "cpp" && proj.kind === "project" && bang(proj.meta.folders, ["thu-muc-rong"]) && proj.meta.skipped.length === 2 && proj.meta.skippedTotal === 2 && proj.meta.mainFile === "main.cpp", JSON.stringify(proj.meta.skipped));
        }
        const mac = await Z.read(new Uint8Array(fs.readFileSync(path.join(dir, "mac.zip"))), { inflateRaw: inflateNode });
        kiem("zip kiểu macOS: bỏ im lặng __MACOSX/, .DS_Store, Thumbs.db (không vào skipped)", bang(mac.map((e) => e.path).sort(), ["proj/lib/util.py", "proj/main.py"]) && mac.skipped.length === 0);
        const mp = Z.zipToProject(mac, { name: "mac" });
        kiem("… thành dự án Python 2 tệp, không còn mục rác, thư mục gốc 'proj' bỏ", bang(paths(mp).sort(), ["lib/util.py", "main.py"]) && mp.language === "python" && !mp.meta.skipped);

        // chiều ngược lại: zip của ta, Python đọc
        const ours = Z.create([{ path: "Xin chào/bài 1.cpp", content: "int main(){}\n" }, { path: "bin/all.bin", content: new Uint8Array(Array.from({ length: 256 }, (_, i) => i)) }, { path: "rong.txt", content: "" }, { path: "thu-muc-rong/" }, { path: "emoji🙂.txt", content: "😀" }, { path: "lon.txt", content: "z".repeat(300000) }], { date: new Date(2026, 5, 1, 8, 30, 0) });
        fs.writeFileSync(path.join(dir, "ours.zip"), Buffer.from(ours));
        const PYCHK = String.raw`
import zipfile, sys, json, hashlib
z = zipfile.ZipFile(sys.argv[1])
out = {"test": z.testzip(), "names": z.namelist(), "info": {}}
for i in z.infolist():
    out["info"][i.filename] = {"size": i.file_size, "sha": hashlib.sha256(z.read(i.filename)).hexdigest(), "dir": i.is_dir(), "flag": i.flag_bits, "method": i.compress_type, "date": list(i.date_time)}
print(json.dumps(out, ensure_ascii=True))
`;
        fs.writeFileSync(path.join(dir, "chk.py"), PYCHK, "utf8");
        const out = JSON.parse(execFileSync(pyCmd, [path.join(dir, "chk.py"), path.join(dir, "ours.zip")], { timeout: 60000, env: Object.assign({}, process.env, { PYTHONUTF8: "1" }) }).toString("utf8"));
        kiem("Python zipfile mở được zip do CS.zip.create tạo, testzip() = None (CRC đúng toàn bộ)", out.test === null && out.names.length === 6, JSON.stringify(out.test));
        kiem("… tên Unicode/emoji, thư mục, thứ tự đúng; cờ UTF-8 bật; STORE", bang(out.names, ["Xin chào/bài 1.cpp", "bin/all.bin", "rong.txt", "thu-muc-rong/", "emoji🙂.txt", "lon.txt"]) && out.info["thu-muc-rong/"].dir === true && Object.values(out.info).every((x) => (x.flag & 0x800) === 0x800 && x.method === 0));
        kiem("… nội dung khớp từng byte (SHA-256), ngày giờ đúng", out.info["bin/all.bin"].sha === sha(Array.from({ length: 256 }, (_, i) => i)) && out.info["lon.txt"].sha === sha(Buffer.from("z".repeat(300000))) && out.info["Xin chào/bài 1.cpp"].size === 13 && bang(out.info["rong.txt"].date, [2026, 6, 1, 8, 30, 0]));
        const p = Z.zipToProject(await Z.read(ours), { name: "ours" });
        kiem("đọc lại zip của chính ta: bỏ tệp nhị phân, giữ thư mục rỗng và tệp rỗng", paths(p).indexOf("bin/all.bin") < 0 && paths(p).indexOf("rong.txt") >= 0 && p.meta.folders.indexOf("thu-muc-rong") >= 0);
      } finally { fs.rmSync(dir, { recursive: true, force: true }); }
    }
  }

  nhom("zip · zipToProject");
  {
    const ent = (p, data, dir) => ({ path: p, data: typeof data === "string" ? bytes(data) : data || new Uint8Array(0), dir: !!dir });
    const arr = (list, skipped) => Object.assign(list, { skipped: skipped || [] });
    // thư mục gốc chung
    let it = Z.zipToProject(arr([ent("proj/", "", true), ent("proj/main.cpp", "int main(){}"), ent("proj/src/a.cpp", "int a;")]), { name: "x" });
    kiem("mọi tệp trong MỘT thư mục → bỏ thư mục gốc đó; tên mặc định lấy từ opts.name", bang(paths(it), ["main.cpp", "src/a.cpp"]) && it.name === "x" && it.kind === "project");
    it = Z.zipToProject(arr([ent("proj/main.cpp", "int main(){}"), ent("main.h", "")]), { name: "x" });
    kiem("có tệp ở gốc → KHÔNG bỏ thư mục", bang(paths(it).sort(), ["main.h", "proj/main.cpp"]));
    it = Z.zipToProject(arr([ent("a/x.cpp", "1"), ent("b/y.cpp", "2")]), { name: "x" });
    kiem("hai thư mục gốc → giữ nguyên", bang(paths(it), ["a/x.cpp", "b/y.cpp"]));
    it = Z.zipToProject(arr([ent("proj/lib/a.cpp", "1"), ent("proj/lib/b.cpp", "2")]), {});
    kiem("chỉ bỏ MỘT cấp gốc (proj), giữ lib/; không có opts.name → tên theo thư mục gốc", bang(paths(it), ["lib/a.cpp", "lib/b.cpp"]) && it.name === "proj");
    it = Z.zipToProject(arr([ent("only/main.py", "print(1)")]), { name: "n" });
    kiem("một tệp trong một thư mục gốc → đoạn mã (snippet) với đường dẫn không còn thư mục", it.kind === "snippet" && bang(paths(it), ["main.py"]) && it.language === "python");
    it = Z.zipToProject(arr([ent("main.cpp", "1")]), { name: "n" });
    kiem("đúng một tệp → kind snippet; nhiều tệp → project", it.kind === "snippet" && Z.zipToProject(arr([ent("a.cpp", ""), ent("b.cpp", "")]), {}).kind === "project");
    it = Z.zipToProject(arr([ent("a.cpp", "x"), ent("sub/", "", true)]), {});
    kiem("một tệp + thư mục rỗng vẫn là snippet (đếm theo tệp); đoạn mã không giữ meta.folders", it.kind === "snippet" && bang(it.meta.folders, []));
    // nhị phân, UTF-8, kích thước
    it = Z.zipToProject(arr([ent("a.cpp", "ok"), ent("img.png", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])), ent("nul.txt", new Uint8Array([0x61, 0, 0x62])), ent("latin1.txt", new Uint8Array([0x63, 0x61, 0x66, 0xe9])), ent("trong.txt", "")]), {});
    kiem("bỏ tệp nhị phân: có byte NUL; UTF-8 không hợp lệ (latin1); giữ tệp rỗng", bang(paths(it).sort(), ["a.cpp", "trong.txt"]) && it.meta.skipped.length === 3 && it.meta.skipped.some((s) => s.path === "img.png" && /nhị phân/.test(s.reason)) && it.meta.skipped.some((s) => s.path === "latin1.txt" && /UTF-8/.test(s.reason)));
    it = Z.zipToProject(arr([ent("ok.txt", "x".repeat(512 * 1024)), ent("lon.txt", "x".repeat(512 * 1024 + 1))]), {});
    kiem("tệp > 512 KB bị bỏ, đúng 512 KB thì giữ", bang(paths(it), ["ok.txt"]) && /512 KB/.test(it.meta.skipped[0].reason) && it.meta.skipped[0].path === "lon.txt");
    it = Z.zipToProject(arr([ent("\ufeffbom.txt", "a"), ent("b.txt", "\ufeffnội dung có BOM")]), {});
    kiem("giữ nguyên BOM đầu tệp (không xén lặng lẽ)", it.files.some((f) => f.content === "\ufeffnội dung có BOM"));
    // tên tệp
    it = Z.zipToProject(arr([ent("ok.cpp", "1"), ent("con/ok.cpp", "2"), ent("a\u0001b.cpp", "3"), ent("x /y.cpp", "4"), ent("z./a.cpp", "5"), ent(("d/").repeat(17) + "f.cpp", "6"), ent("tiếng việt/bài 1 (copy).cpp", "7")]), {});
    kiem("tên không hợp lệ theo luật KHO bị bỏ + ghi skipped; Unicode và dấu cách thì giữ", bang(paths(it).sort(), ["con/ok.cpp", "ok.cpp", "tiếng việt/bài 1 (copy).cpp"]) && it.meta.skipped.length === 4 && it.meta.skipped.every((s) => /tên không hợp lệ/.test(s.reason)), JSON.stringify(it.meta.skipped));
    it = Z.zipToProject(arr([ent("a.cpp", "1"), ent("A.CPP", "2"), ent("b/c.cpp", "3"), ent("B", "4"), ent("a.cpp/x", "5")]), {});
    kiem("trùng tên không phân biệt hoa/thường, tệp-trùng-thư-mục (cả hai chiều) → bỏ tệp đến sau", bang(paths(it), ["a.cpp", "b/c.cpp"]) && it.meta.skipped.length === 3 && it.meta.skipped.some((s) => /trùng/.test(s.reason)) && it.meta.skipped.some((s) => /trùng tên một thư mục/.test(s.reason)) && it.meta.skipped.some((s) => /nằm trong một tệp/.test(s.reason)), JSON.stringify(it.meta.skipped));
    it = Z.zipToProject(arr([ent("a//b.cpp", "1"), ent("./c.cpp", "2"), ent("d\\e.cpp", "3")]), {});
    kiem("đường dẫn 'a//b', './c', 'd\\e' được làm sạch (không coi là lỗi)", bang(paths(it).sort(), ["a/b.cpp", "c.cpp", "d/e.cpp"]) && !it.meta.skipped);
    // 200 tệp
    const many = Array.from({ length: 230 }, (_, i) => ent("f" + String(i).padStart(3, "0") + ".txt", "n" + i));
    it = Z.zipToProject(arr(many), {});
    kiem("tối đa 200 tệp: giữ 200 tệp đầu, bỏ phần dư ghi skipped (cắt ≤ 20 mục) kèm skippedTotal = 30", it.files.length === 200 && it.files[0].path === "f000.txt" && it.meta.skipped.length === 20 && it.meta.skippedTotal === 30 && /200 tệp/.test(it.meta.skipped[0].reason));
    // meta ≤ 8 KB
    const junk = Array.from({ length: 400 }, (_, i) => ent("x".repeat(250) + i + ".bin", new Uint8Array([0, 1])));
    it = Z.zipToProject(arr([ent("ok.cpp", "int main(){}")].concat(junk)), {});
    kiem("skipped dài: ≤ 20 mục, mỗi path/reason bị cắt, meta ≤ 8 KB, skippedTotal đúng", it.meta.skipped.length <= 20 && it.meta.skippedTotal === 400 && P.pyJsonBytes(it.meta) <= 8192 && it.meta.skipped.every((s) => s.path.length <= 120 && s.reason.length <= 100), String(P.pyJsonBytes(it.meta)));
    it = Z.zipToProject(arr([ent("ok.cpp", "1")], [{ path: "../x", reason: "chặn zip-slip" }, { path: "y", reason: "phương thức nén 14" }]), {});
    kiem("gộp cả skipped do read() ghi lại", it.meta.skipped.length === 2 && it.meta.skippedTotal === 2);
    kiem("không bỏ gì → không có meta.skipped", !Z.zipToProject(arr([ent("a.cpp", "1")]), {}).meta.skipped);
    // không dùng được
    const none = [arr([]), arr([ent("d/", "", true)]), arr([ent("a.png", new Uint8Array([0, 1, 2]))]), arr([ent("../x.cpp", "1")]), arr([ent("__MACOSX/a.cpp", "1"), ent(".DS_Store", "x")])];
    kiem("không có tệp nào dùng được → Error tiếng Việt (zip rỗng, chỉ thư mục, chỉ nhị phân, chỉ tên nguy hiểm, chỉ mục rác)", none.every((l) => { const e = throws(() => Z.zipToProject(l, {})); return e && e.code === "no_files" && viet(e); }));
    kiem("… thông báo nêu số mục bị bỏ qua", /1 mục bị bỏ qua/.test(throws(() => Z.zipToProject(arr([ent("a.png", new Uint8Array([0]))]), {})).message));
    kiem("entries sai kiểu → Error; chấp nhận cả đối tượng {entries}", viet(throws(() => Z.zipToProject("x", {}))) && Z.zipToProject({ entries: [ent("a.cpp", "1")] }, {}).files.length === 1);
    // ngôn ngữ
    const lang = (names) => Z.zipToProject(arr(names.map((n) => ent(n, "x"))), {}).language;
    kiem("ngôn ngữ chính: nhiều tệp nhất theo đuôi", lang(["a.py", "b.py", "c.js"]) === "python" && lang(["a.js", "b.js", "c.py"]) === "javascript" && lang(["A.java", "B.java", "C.java"]) === "java");
    kiem("bỏ markdown/json/văn bản khi còn ngôn ngữ khác (README, package.json, notes.txt không lấn át)", lang(["a.py", "README.md", "d.md", "e.md", "c.json", "n.txt"]) === "python" && lang(["README.md", "a.md"]) === "markdown" && lang(["a.txt", "b.txt"]) === "plaintext" && lang(["a.json", "b.json", "c.txt"]) === "json");
    kiem("tiêu đề .h tính theo C++ khi có nguồn C++, theo C khi có nguồn C, và C khi chỉ có .h", lang(["a.cpp", "x.h", "y.h", "z.h"]) === "cpp" && lang(["a.c", "x.h", "y.h"]) === "c" && lang(["x.h", "y.h"]) === "c" && lang(["a.c", "b.cpp", "x.h"]) === "cpp");
    kiem("hoà số tệp: theo thứ tự ngôn ngữ của Code Studio (C++ trước Python)", lang(["a.py", "b.cpp"]) === "cpp");
    kiem("không đuôi nào nhận ra → plaintext", lang(["Makefile", "LICENSE"]) === "plaintext");
    // cấu hình
    const cfg = { app: "code-studio", version: 1, name: "Tên từ cấu hình", language: "c", mainFile: "util.c", std: "c99", opt: "O1", stdin: "1 2\n", args: ["-v"], compileArgs: ["-Wall"], javaMain: "x.Y" };
    it = Z.zipToProject(arr([ent("main.c", "int main(){}"), ent("util.c", "int u;"), ent(".code-studio.json", JSON.stringify(cfg))]), { name: "tên tệp zip" });
    kiem(".code-studio.json: đọc tên, ngôn ngữ, mainFile, std, opt, stdin, args, compileArgs, javaMain; không lọt vào danh sách tệp", it.name === "Tên từ cấu hình" && it.language === "c" && it.meta.mainFile === "util.c" && it.meta.std === "c99" && it.meta.opt === "O1" && it.meta.stdin === "1 2\n" && bang(it.meta.args, ["-v"]) && bang(it.meta.compileArgs, ["-Wall"]) && it.meta.javaMain === "x.Y" && bang(paths(it), ["main.c", "util.c"]));
    it = Z.zipToProject(arr([ent("proj/a.cpp", "1"), ent("proj/b.cpp", "2"), ent("proj/.code-studio.json", JSON.stringify({ app: "code-studio", mainFile: "b.cpp" }))]), {});
    kiem(".code-studio.json nằm trong thư mục gốc chung vẫn được đọc", it.meta.mainFile === "b.cpp" && !paths(it).some((p) => /code-studio/.test(p)));
    it = Z.zipToProject(arr([ent("a.cpp", "1"), ent("b.cpp", "2"), ent(".code-studio.json", JSON.stringify({ mainFile: "không-có.cpp", language: "python!", std: 5, args: "x", name: "   " }))]), { name: "tên zip" });
    kiem("cấu hình thiếu dấu 'app' không phải của Code Studio → coi là tệp thường (json) và không áp dụng", paths(it).indexOf(".code-studio.json") >= 0 && it.name === "tên zip");
    it = Z.zipToProject(arr([ent("a.cpp", "1"), ent("b.cpp", "2"), ent(".code-studio.json", JSON.stringify({ app: "code-studio", mainFile: "không-có.cpp", language: "python!", std: 5, args: "x", name: "   " }))]), { name: "tên zip" });
    kiem("cấu hình có app nhưng giá trị sai kiểu/không tồn tại: bỏ qua từng trường, tên rơi về opts.name, ngôn ngữ dò từ đuôi, mainFile dò lại", it.name === "tên zip" && it.language === "cpp" && it.meta.mainFile === "a.cpp" && bang(it.meta.args, []) && it.meta.std === "c++17");
    kiem("cấu hình hỏng (JSON sai / không UTF-8 / mảng) → coi là tệp thường", (() => { const a = Z.zipToProject(arr([ent("a.cpp", "1"), ent(".code-studio.json", "{hỏng")]), {}); const b = Z.zipToProject(arr([ent("a.cpp", "1"), ent(".code-studio.json", "[1]")]), {}); return a.files.length === 2 && b.files.length === 2; })());
    it = Z.zipToProject(arr([ent("a.cpp", "1")]), { name: "n", id: "myid", now: 4242 });
    kiem("opts.id và opts.now được dùng; mặc định id mới, updatedAt 0", it.id === "myid" && it.updatedAt === 4242 && /^[0-9a-z]{20}$/.test(Z.zipToProject(arr([ent("a.cpp", "1")]), {}).id) && Z.zipToProject(arr([ent("a.cpp", "1")]), {}).updatedAt === 0);
    it = Z.zipToProject(arr([ent("src/a.cpp", "int main(){}"), ent("src/b.cpp", "1"), ent("README.md", "# x")]), {});
    kiem("kết quả là item chuẩn: qua normalize không đổi, validate kho sạch, openTabs/activeFile có tệp chính", frozen(P.normalize(it)) === frozen(it) && P.validate(it, { target: "store" }).length === 0 && it.meta.mainFile === "src/a.cpp" && bang(it.meta.openTabs, ["src/a.cpp"]) && it.meta.activeFile === "src/a.cpp");
    it = Z.zipToProject(arr([ent("x", "1"), ent("y.cpp", "2")]), {});
    kiem("tên tệp không đuôi vẫn nhận (kho cho phép)", paths(it).indexOf("x") >= 0);
  }

  nhom("zip · projectToZip ↔ zipToProject (vòng tròn)");
  {
    // mọi mẫu: tệp, cấu hình, thư mục rỗng đều trở lại nguyên vẹn
    for (const t of P.templates) {
      let p = P.createProject({ template: t.id, id: "r-" + t.id, now: 1790000000000 });
      p = P.setMeta(P.addFolder(p, "tai-lieu/rong"), { stdin: "3\n4 5\n", args: ["--x", "a b"], compileArgs: t.language === "cpp" || t.language === "c" ? ["-Wall", "-DN=2"] : [], opt: "O1", std: t.language === "cpp" ? "c++20" : t.language === "c" ? "c99" : "", pinned: true });
      p = P.setName(p, "Dự án «" + t.name + "» 🙂");
      const zipBytes = Z.projectToZip(p);
      const back = Z.zipToProject(await Z.read(zipBytes, { inflateRaw: inflateNode }), { name: "tên tệp zip" });
      const same = bang(back.files.slice().sort((a, b) => (a.path < b.path ? -1 : 1)), p.files.slice().sort((a, b) => (a.path < b.path ? -1 : 1)));
      const one = p.files.length === 1;                                       // đúng 1 tệp → nhập lại thành đoạn mã (không có thư mục)
      kiem("vòng tròn mẫu " + t.id + ": đủ tệp + nội dung, tên/ngôn ngữ/tệp chính/std/opt/stdin/args/compileArgs" + (one ? " (1 tệp → snippet, bỏ thư mục rỗng)" : " và thư mục rỗng") + " được giữ", same && back.name === p.name && back.language === p.language && back.meta.mainFile === p.meta.mainFile && back.meta.std === p.meta.std && back.meta.opt === p.meta.opt && back.meta.stdin === p.meta.stdin && bang(back.meta.args, p.meta.args) && bang(back.meta.compileArgs, p.meta.compileArgs) && bang(back.meta.folders, one ? [] : p.meta.folders) && back.kind === (one ? "snippet" : "project") && !back.meta.skipped, JSON.stringify([same, back.name === p.name, back.meta.mainFile, back.meta.folders, back.meta.skipped]));
    }
    const p = P.createProject({ template: "cpp-multi", id: "z1", now: 1790000000000 });
    const names = (await Z.read(Z.projectToZip(p))).map((e) => e.path);
    kiem("zip xuất ra: đủ tệp + '.code-studio.json' ở gốc; không có thư mục gốc bọc ngoài", names.length === 6 && names.indexOf(".code-studio.json") === 5 && names[0] === "main.cpp");
    const cfg = JSON.parse(Z.utf8Decode((await Z.read(Z.projectToZip(p))).filter((e) => e.path === ".code-studio.json")[0].data));
    kiem(".code-studio.json: app/version, name, language, mainFile, std, opt, stdin, args (+ compileArgs)", cfg.app === "code-studio" && cfg.version === 1 && cfg.name === p.name && cfg.language === "cpp" && cfg.mainFile === "main.cpp" && cfg.std === "c++17" && cfg.opt === "O2" && cfg.stdin === "" && bang(cfg.args, []) && bang(cfg.compileArgs, []));
    kiem("thư mục rỗng xuất thành mục 'x/' (kể cả lồng)", (await Z.read(Z.projectToZip(P.addFolder(P.addFolder(p, "a/b"), "c")))).filter((e) => e.dir).map((e) => e.path).sort().join() === "a/b,c");
    const snip = P.createSnippet({ id: "s1", name: "Đoạn", language: "python", content: "print('é')\n" });
    const sb = Z.zipToProject(await Z.read(Z.projectToZip(snip)), { name: "z" });
    kiem("đoạn mã → zip → nhập lại thành đoạn mã đúng nội dung", sb.kind === "snippet" && sb.files[0].content === "print('é')\n" && sb.language === "python" && sb.name === "Đoạn" && sb.files[0].path === "main.py");
    const clash = P.addFile(p, ".code-studio.json", "{\"của\": \"người dùng\"}");
    const cz = await Z.read(Z.projectToZip(clash));
    kiem("dự án có sẵn tệp tên '.code-studio.json': không ghi đè bằng cấu hình (tệp người dùng được giữ), nhập lại vẫn là tệp thường", cz.filter((e) => e.path === ".code-studio.json").length === 1 && Z.utf8Decode(cz.filter((e) => e.path === ".code-studio.json")[0].data).indexOf("người dùng") > 0 && Z.zipToProject(cz, {}).files.some((f) => f.path === ".code-studio.json"));
    const uni = P.normalize(Object.assign(P.clone(p), { files: p.files.concat([{ path: "Tài liệu/ghi chú 🙂.md", content: "# Chào" }]) }));
    kiem("tên tệp Unicode/dấu cách/emoji qua zip và quay lại", bang(Z.zipToProject(await Z.read(Z.projectToZip(uni)), {}).files.map((f) => f.path).sort(), uni.files.map((f) => f.path).sort()));
    kiem("projectToZip không sửa item; thời điểm ghi theo item.updatedAt (cùng item → cùng zip)", (() => { const b = frozen(p); const a = Z.projectToZip(p), c = Z.projectToZip(p); return frozen(p) === b && eq(a, c); })());
    const bomZ = Z.projectToZip(P.setContent(p, "main.cpp", "\ufeffint main(){}"));
    kiem("BOM và CRLF trong nội dung đi qua zip không đổi", Z.zipToProject(await Z.read(bomZ), {}).files[0].content === "\ufeffint main(){}" && Z.zipToProject(await Z.read(Z.projectToZip(P.setContent(p, "main.cpp", "a\r\nb\r\n"))), {}).files[0].content === "a\r\nb\r\n");
    const big = P.createProject({ template: "cpp-multi", id: "big" });
    const bigZ = Z.projectToZip(P.setContent(big, "main.cpp", "// " + "x".repeat(400 * 1024)));
    kiem("tệp lớn ~400 KB đi qua zip nguyên vẹn", Z.zipToProject(await Z.read(bigZ), {}).files[0].content.length === 400 * 1024 + 3);
    kiem("projectToZip(item hỏng: đường dẫn '..') → Error tiếng Việt thay vì zip nguy hiểm", viet(throws(() => Z.projectToZip({ name: "x", files: [{ path: "../evil.txt", content: "x" }], meta: {} }))));
  }
};
