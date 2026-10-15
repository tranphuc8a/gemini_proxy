"""Kiểm các mô-đun lưu trữ + zip của Code Studio trong TRÌNH DUYỆT THẬT (Edge qua Playwright) — phần node không có:
IndexedDB (CS.store.kv.idb / auto), localStorage thật, DecompressionStream('deflate-raw') đọc zip do Python tạo, Blob/ArrayBuffer.

Chạy:  backend/fastapi/.venv/Scripts/python.exe backend/fastapi/webapp/tranphuc8a/code-studio/kiem-trinh-duyet.py [--hien]
Tự dựng máy chủ tĩnh tạm (thư mục code-studio) trên cổng trống; không gọi mạng ngoài, không đụng backend. Thoát mã 1 nếu có phép kiểm sai.
"""
from __future__ import annotations

import base64
import http.server
import io
import json
import sys
import threading
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
CORE = ["langs.js", "tokenize.js", "format.js", "complete.js", "project.js", "zip.js", "store.js"]
PAGE = "<!doctype html><meta charset=utf-8><title>kiem</title>" + "".join(f'<script src="/assets/core/{f}"></script>' for f in CORE)

passed = failed = 0


def check(name: str, ok: bool, detail: object = "") -> None:
    global passed, failed
    if ok:
        passed += 1
        print(f"  [ok]  {name}")
    else:
        failed += 1
        print(f"  [SAI] {name}   → {detail}")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(HERE), **k)

    def do_GET(self):
        if self.path.split("?")[0] == "/__kiem.html":
            data = PAGE.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        if self.path == "/favicon.ico":
            self.send_response(204)
            self.end_headers()
            return
        super().do_GET()

    def log_message(self, *a):  # im lặng
        pass


def make_zip() -> str:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("bai-tap/main.cpp", '#include <iostream>\nint main() { std::cout << "Xin chào"; }\n')
        z.writestr("bai-tap/src/xin chào.cpp", "dòng lặp để nén tốt\n" * 4000)
        z.writestr("bai-tap/rong.txt", "")
        z.writestr("bai-tap/trong/", "")
        z.writestr("bai-tap/anh.bin", bytes(range(256)) * 8)
        z.writestr("__MACOSX/bai-tap/._main.cpp", b"\x00\x05junk")
        z.writestr("bai-tap/.DS_Store", b"\x00junk")
    return base64.b64encode(buf.getvalue()).decode("ascii")


JS = r"""
async (zipB64) => {
  const out = {};
  const CS = window.CS, S = CS.store, Z = CS.zip, P = CS.project;
  const name = "cs-test-" + Math.random().toString(36).slice(2);
  const rej = (p) => p.then(() => null, (e) => e);

  // ---------- IndexedDB
  const kv = S.kv.idb(name);
  out.idbReady = (await kv.ready) === kv;
  out.idbKind = [kv.kind, kv.persistent];
  await kv.set("a", { n: 1, s: "Xin chào 🙂", arr: [1, 2, { b: null }] });
  await kv.set("item:b", "x"); await kv.set("item:a", "y"); await kv.set("item:c￿", "z"); await kv.set("zzz", 5);
  out.idbGet = await kv.get("a");
  out.idbMissing = (await kv.get("khong-co")) === undefined;
  out.idbKeys = await kv.keys("item:");
  out.idbAllKeys = await kv.keys();
  await kv.del("item:a");
  out.idbDel = (await kv.get("item:a")) === undefined;
  await kv.set("a", undefined);
  out.idbSetUndef = (await kv.get("a")) === undefined;
  out.idbCyc = await (async () => { const c = {}; c.s = c; const e = await rej(kv.set("c", c)); return !!e; })();
  const kv2 = S.kv.idb(name);                                    // mở lại cùng tên: dữ liệu còn
  out.idbReopen = [await kv2.get("zzz"), (await kv2.keys("item:")).length];

  // ---------- library trên IndexedDB
  const lib = S.library({ kv: kv });
  const ps = [];
  for (let i = 0; i < 40; i++) ps.push(lib.put(P.createSnippet({ id: "i" + i, name: "Mục " + i, language: "cpp", content: "int x" + i + ";" })));
  await Promise.all(ps);
  await lib.put(P.createProject({ id: "pj", name: "Dự án", template: "cpp-multi" }));
  await lib.remove("i3");
  const lib2 = S.library({ kv: S.kv.idb(name) });
  await lib2.ready;
  out.libReload = [(await lib2.list()).length, (await lib2.get("i3")).deleted, (await lib2.get("pj")).files.length, lib2.dirty().length, (await lib2.get("i39")).files[0].content];
  const json = lib2.exportJson();
  const lib3 = S.library({ kv: S.kv.idb(name + "-b") });
  out.libImport = await lib3.importJson(json);
  out.libImportList = (await lib3.list()).length;

  // ---------- auto: IndexedDB trước
  const au = await S.kv.auto({ idb: name + "-auto", local: "cs:auto:" });
  out.auto = [au.kind, au.persistent];
  await au.set("k", [1]);
  out.autoGet = await au.get("k");

  // ---------- localStorage thật
  const lk = S.kv.local("cs:test:" + name + ":");
  await lk.set("a", { x: 1 }); await lk.set("item:1", 2);
  out.local = [lk.persistent, await lk.get("a"), await lk.keys("item:"), window.localStorage.getItem("cs:test:" + name + ":a")];
  await lk.del("a"); await lk.del("item:1");

  // ---------- zip thật (DecompressionStream mặc định)
  const bin = Uint8Array.from(atob(zipB64), (c) => c.charCodeAt(0));
  out.hasDS = typeof DecompressionStream === "function";
  const entries = await Z.read(bin);
  out.zipRead = [entries.length, entries.skipped.length, entries.map((e) => e.path)];
  const item = Z.zipToProject(entries, { name: "bai-tap.zip" });
  out.zipItem = [item.kind, item.language, item.files.map((f) => f.path).sort(), item.meta.folders, item.meta.skipped.length, item.meta.skipped.map((s) => s.path), item.meta.mainFile, item.files.filter((f) => f.path === "src/xin chào.cpp")[0].content.length];
  const rt = Z.zipToProject(await Z.read(Z.projectToZip(P.createProject({ id: "x", template: "java-package" }))), {});
  out.roundTrip = [rt.files.length, rt.language, rt.meta.mainFile];
  const blob = new Blob([Z.projectToZip(item)], { type: "application/zip" });
  const back = new Uint8Array(await blob.arrayBuffer());
  out.blob = [blob.size === back.length, (await Z.read(back)).length];
  out.crc = Z.crc32(new TextEncoder().encode("123456789"));

  // dọn
  for (const n of [name, name + "-b", name + "-auto"]) await new Promise((r) => { const q = indexedDB.deleteDatabase(n); q.onsuccess = q.onerror = q.onblocked = () => r(); });
  return out;
}
"""


def main() -> int:
    from playwright.sync_api import sync_playwright

    show = "--hien" in sys.argv
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    port = httpd.server_address[1]
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    errors: list[str] = []
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(channel="msedge", headless=not show)
            page = browser.new_page()
            page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
            page.on("console", lambda m: errors.append("console." + m.type + ": " + m.text) if m.type == "error" else None)
            page.goto(f"http://127.0.0.1:{port}/__kiem.html")
            print("\n== IndexedDB / localStorage / zip trong Edge thật")
            try:
                out = page.evaluate(JS, make_zip())
            except Exception:
                print("Lỗi trong trình duyệt; console/pageerror:", errors)
                raise
            finally:
                browser.close()
    finally:
        httpd.shutdown()

    check("IndexedDB: mở được, kind idb, persistent true", out["idbReady"] is True and out["idbKind"] == ["idb", True], out["idbKind"])
    check("IndexedDB: set/get giữ nguyên JSON (Unicode, mảng, null)", out["idbGet"] == {"n": 1, "s": "Xin chào 🙂", "arr": [1, 2, {"b": None}]}, out["idbGet"])
    check("IndexedDB: khoá chưa có → undefined; del; set(undefined) = xoá; giá trị vòng → từ chối", out["idbMissing"] and out["idbDel"] and out["idbSetUndef"] and out["idbCyc"])
    check("IndexedDB: keys(prefix) lọc đúng theo dải và sắp xếp (kể cả khoá có ký tự U+FFFF)", out["idbKeys"] == ["item:a", "item:b", "item:c￿"], out["idbKeys"])
    check("IndexedDB: keys() không đối số trả mọi khoá", sorted(out["idbAllKeys"]) == sorted(["a", "item:a", "item:b", "item:c￿", "zzz"]), out["idbAllKeys"])
    check("IndexedDB: mở lại cùng tên vẫn còn dữ liệu", out["idbReopen"] == [5, 2], out["idbReopen"])
    check("library trên IndexedDB: 40 put đồng thời + dự án + xoá; nạp lại từ kv mới đủ cả (41 sống, bia mộ i3, 5 tệp, 42 dirty)", out["libReload"] == [40, True, 5, 41, "int x39;"], out["libReload"])
    check("library: exportJson → importJson vào IndexedDB khác", out["libImport"]["imported"] == 40 and out["libImportList"] == 40, out["libImport"])
    check("kv.auto({idb}) chọn IndexedDB khi dùng được", out["auto"] == ["idb", True] and out["autoGet"] == [1], out["auto"])
    check("localStorage thật: persistent true, khoá = tiền tố + khoá, keys đúng", out["local"][0] is True and out["local"][1] == {"x": 1} and out["local"][2] == ["item:1"] and out["local"][3] == '{"x":1}', out["local"])
    check("trình duyệt có DecompressionStream", out["hasDS"] is True)
    check("zip do Python tạo (DEFLATE) đọc bằng DecompressionStream mặc định: 5 mục (bỏ __MACOSX, .DS_Store)", out["zipRead"][0] == 5 and out["zipRead"][1] == 0, out["zipRead"])
    item = out["zipItem"]
    check("zipToProject trong trình duyệt: project C++, bỏ thư mục gốc, bỏ tệp nhị phân (ghi skipped), giữ thư mục rỗng, tệp chính", item[0] == "project" and item[1] == "cpp" and item[2] == ["main.cpp", "rong.txt", "src/xin chào.cpp"] and item[3] == ["trong"] and item[4] == 1 and item[5] == ["anh.bin"] and item[6] == "main.cpp" and item[7] == 80000, item)
    check("projectToZip → read → zipToProject (mẫu Java có package)", out["roundTrip"] == [3, "java", "src/app/Main.java"], out["roundTrip"])
    check("zip qua Blob/ArrayBuffer nguyên vẹn; crc32 chuẩn", out["blob"] == [True, 5], out["blob"])
    check("crc32('123456789') = 0xCBF43926", out["crc"] == 0xCBF43926, out["crc"])
    check("không lỗi console/pageerror trong lúc chạy", not errors, errors)

    print("\n" + "=" * 58)
    if failed:
        print(f"SAI {failed}/{passed + failed} phép kiểm.")
        return 1
    print(f"Đạt — {passed} phép kiểm (trình duyệt thật).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
