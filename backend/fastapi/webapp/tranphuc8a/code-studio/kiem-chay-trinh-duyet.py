#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kiểm BỘ CHẠY MÃ của Code Studio bằng trình duyệt thật (Edge qua Playwright) — KHÔNG nằm trong kiem.js.

    backend/fastapi/.venv/Scripts/python.exe backend/fastapi/webapp/tranphuc8a/code-studio/kiem-chay-trinh-duyet.py [tuỳ chọn]

    --bo-py / --bo-cpp / --bo-may-chu   bỏ tầng tương ứng (Python và C++ CẦN MẠNG tới cdn.jsdelivr.net: tải Pyodide ≈ 14 MB, Clang ≈ 25 MB)
    --bo-file                           bỏ phần Python chạy từ trang mở bằng file://
    --file-cpp                          thêm: C++ chạy từ trang mở bằng file:// (không có Cache Storage; tải lại 25 MB)

Tầng 1 JavaScript (tức thì) · 2 Python/Pyodide · 3 C/C++ nhiều tệp/Clang-WASM · 4 `server:local` với backend THẬT tự khởi động
(uvicorn + SQLite tạm + RUN_LOCAL_ENABLED + khoá quản trị thử; g++/javac/python/node của máy) cùng một Piston GIẢ cục bộ để kiểm `server:piston`
(429, 502, 504, 503) và `piston-custom` (CORS thật của trình duyệt). KHÔNG gọi Piston/Judge0/Wandbox công cộng, không gửi mã ra ngoài.
Thoát 1 nếu có mục SAI. Đặt PYTHONUTF8=1 khi chạy trên Windows để in tiếng Việt."""
import functools
import http.server
import json
import os
import secrets
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
BE = os.path.abspath(os.path.join(HERE, "..", "..", ".."))                    # backend/fastapi
PY = sys.executable
os.environ.setdefault("PYTHONUTF8", "1")
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

dat, hong, bo = [], [], []


def ok(m):
    dat.append(m); print("  [ok]  " + m)


def sai(m):
    hong.append(m); print("  [SAI] " + m)


def bo_qua(m):
    bo.append(m); print("  [--]  " + m)


def kiem(ten, dk, chi_tiet=""):
    (ok if dk else sai)(ten if dk or not chi_tiet else ten + "  →  " + str(chi_tiet)[:400])


def tang(t):
    print("\n" + t)


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


# ----------------------------------------------------------------------------- máy chủ phụ
class Tinh:
    """Máy chủ tĩnh cho thư mục code-studio (dự phòng khi backend không lên) — mỗi tệp có CORS đủ dùng."""

    def __init__(self):
        class Q(http.server.SimpleHTTPRequestHandler):
            def log_message(self, *a):
                pass

        class Srv(http.server.ThreadingHTTPServer):
            request_queue_size = 128
            daemon_threads = True
        self.srv = Srv(("127.0.0.1", 0), functools.partial(Q, directory=HERE))
        self.port = self.srv.server_address[1]
        self.base = "http://127.0.0.1:%d" % self.port
        self.url = self.base + "/test-runner.html"
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()

    def dong(self):
        self.srv.shutdown()


class PistonGia:
    """Piston GIẢ tại 127.0.0.1: để kiểm đường `server:piston` (backend thật → Piston) và `piston-custom` (trình duyệt → Piston) mà không ra mạng.
    cors=False: không gửi tiêu đề CORS → trình duyệt phải chặn."""

    def __init__(self, cors=True):
        self.nhan = []
        outer = self

        class Q(http.server.BaseHTTPRequestHandler):
            def log_message(self, *a):
                pass

            def _cors(self):
                if cors:
                    self.send_header("Access-Control-Allow-Origin", "*")
                    self.send_header("Access-Control-Allow-Headers", "content-type, authorization")
                    self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")

            def do_OPTIONS(self):
                self.send_response(204); self._cors(); self.end_headers()

            def do_POST(self):
                n = int(self.headers.get("Content-Length") or 0)
                d = json.loads(self.rfile.read(n) or b"{}")
                outer.nhan.append(d)
                noi_dung = "\n".join(f.get("content", "") for f in d.get("files", []))
                if "HTTP500" in noi_dung:
                    self.send_response(500); self._cors(); self.end_headers(); self.wfile.write(b"boom"); return
                if "NGU7GIAY" in noi_dung:
                    time.sleep(7)
                if "KHONGCODEBIEN" in noi_dung:
                    r = {"language": d["language"], "version": "10.2.0", "compile": {"stdout": "", "stderr": "main.cpp:3:5: error: gia lap loi bien dich\n", "code": 1, "signal": None, "output": ""},
                         "run": {"stdout": "", "stderr": "", "code": None, "signal": None, "output": ""}}
                else:
                    ra = "piston-gia:" + d.get("stdin", "")
                    r = {"language": d["language"], "version": "10.2.0", "run": {"stdout": ra, "stderr": "", "code": 0, "signal": None, "output": ra}}
                    if d["language"] in ("c++", "c", "java"):
                        r["compile"] = {"stdout": "", "stderr": "", "code": 0, "signal": None, "output": ""}
                b = json.dumps(r).encode()
                self.send_response(200); self._cors(); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(b))); self.end_headers()
                self.wfile.write(b)

        class Srv(http.server.ThreadingHTTPServer):
            daemon_threads = True

            def handle_error(self, request, client_address):      # backend ngắt kết nối khi chờ quá lâu (phép kiểm 504): không in ngăn xếp
                pass
        self.srv = Srv(("127.0.0.1", 0), Q)
        self.port = self.srv.server_address[1]
        self.url = "http://127.0.0.1:%d/api/v2" % self.port
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()

    def dong(self):
        self.srv.shutdown()


class May:
    """Backend THẬT: uvicorn + SQLite tạm; RUN_LOCAL_ENABLED=true; khoá quản trị thử ngẫu nhiên. Ghi đè .env để không chạm DB thật."""

    def __init__(self, piston_url):
        self.tmp = tempfile.mkdtemp(prefix="cs-chay-")
        self.port = free_port()
        self.base = "http://127.0.0.1:%d" % self.port
        self.khoa = "khoa-thu-" + secrets.token_urlsafe(12)
        self.piston_url = piston_url
        self.proc = None
        self.url = self.base + "/webapp/tranphuc8a/code-studio/test-runner.html"

    def __enter__(self):
        env = dict(os.environ)
        env.update({
            "DB_URL": "sqlite+aiosqlite:///" + os.path.join(self.tmp, "dev.sqlite3").replace("\\", "/"),
            "DATA_DIR": self.tmp, "MONGO_URI": "", "API_PREFIX": "/api/v1", "PYTHONUTF8": "1", "PYTHONPATH": BE, "AI_ENABLED": "false",
            "RUN_ENABLED": "true", "RUN_LOCAL_ENABLED": "true", "COURSE_ADMIN_KEY": self.khoa, "RUN_PISTON_URL": self.piston_url, "RUN_PISTON_KEY": "",
            "RUN_RATE_PER_MIN": "30", "RUN_DEFAULT_PROVIDER": "local", "RUN_JUDGE0_URL": "",
            "DB_HOST": "127.0.0.1", "DB_PORT": "9", "DB_USERNAME": "selftest", "DB_PASSWORD": "selftest", "DB_DATABASE": "selftest",   # dây an toàn thứ hai
        })
        self.log = open(os.path.join(self.tmp, "server.log"), "w", encoding="utf-8")
        self.proc = subprocess.Popen([PY, "-m", "uvicorn", "src.main:app", "--host", "127.0.0.1", "--port", str(self.port), "--log-level", "warning"],
                                     cwd=BE, env=env, stdout=self.log, stderr=subprocess.STDOUT)
        for _ in range(120):
            try:
                urllib.request.urlopen(self.base + "/api/v1/run/providers", timeout=1).read()
                return self
            except Exception:
                if self.proc.poll() is not None:
                    break
                time.sleep(0.5)
        log = open(os.path.join(self.tmp, "server.log"), encoding="utf-8", errors="replace").read()[-1500:]
        self.__exit__(None, None, None)
        raise RuntimeError("Backend không khởi động được:\n" + log)

    def __exit__(self, *a):
        if self.proc and self.proc.poll() is None:
            self.proc.terminate()
            try:
                self.proc.wait(timeout=8)
            except Exception:
                self.proc.kill()
        try:
            self.log.close()
        except Exception:
            pass
        shutil.rmtree(self.tmp, ignore_errors=True)


# ----------------------------------------------------------------------------- trợ giúp trình duyệt
def mo_trinh_duyet(pw):
    for kenh in ("msedge", "chrome", None):
        try:
            return pw.chromium.launch(channel=kenh, headless=True) if kenh else pw.chromium.launch(headless=True)
        except Exception:
            continue
    return None


def F(name, content):
    return {"name": name, "content": content}


def req(language, files, **kw):
    d = {"target": "browser", "language": language, "files": files, "mainFile": files[0]["name"], "stdin": "", "args": []}
    if language in ("c", "cpp"):
        d.update({"std": "c11" if language == "c" else "c++17", "opt": "O2"})
    d.update(kw)
    return d


class Trang:
    """Một trang test-runner.html; go() chạy một yêu cầu qua CS.runner.run và trả {ok, result|error, events, asked, ms}."""

    def __init__(self, ctx, url, api_base=""):
        self.pg = ctx.new_page()
        self.pg.set_default_timeout(290000)
        self.api_base = api_base
        self.loi = []
        self.pg.on("console", lambda m: self.loi.append(m.text[:240]) if m.type == "error" and "favicon" not in m.text else None)
        self.pg.on("pageerror", lambda e: self.loi.append("pageerror " + str(e)[:240]))
        self.pg.route("**/favicon.ico", lambda r: r.fulfill(status=204, body=""))
        self.pg.goto(url)
        self.pg.wait_for_function("() => typeof window.csRun === 'function'")

    def go(self, r, opts=None, cancel=None):
        o = {"apiBase": self.api_base}
        o.update(opts or {})
        return self.pg.evaluate("([r, o, c]) => csRun(r, o, c)", [r, o, cancel])

    def loi_console(self):
        # "Failed to load resource" là dòng console của trình duyệt cho mọi phản hồi HTTP lỗi/chặn CORS — các phép kiểm ở đây CỐ Ý gây ra chúng
        return [e for e in self.loi if "Failed to load resource" not in e and "net::ERR_" not in e and "CORS" not in e and "Access-Control" not in e]


def run_of(o):
    return o["result"]["run"] if o["ok"] else {}


def out_of(o):
    return run_of(o).get("stdout", "")


# ----------------------------------------------------------------------------- tầng 1: JavaScript
def tang_js(ctx, url, api_base):
    tang("TẦNG 1 — JavaScript trong trình duyệt (Web Worker, tức thì)")
    t = Trang(ctx, url, api_base)
    o = t.go(req("javascript", [F("main.js", 'console.log("xin chào", 1 + 2, [1, 2, 3], {a: 1, b: "x"}); console.error("loi"); print("p");')]))
    kiem("hello: console.log in đối tượng kiểu Node, console.error → stderr, print()", o["ok"] and out_of(o) == "xin chào 3 [ 1, 2, 3 ] { a: 1, b: 'x' }\np\n" and run_of(o)["stderr"] == "loi\n", json.dumps(o)[:300])
    kiem("kết quả chuẩn: ok, provider browser, target browser, compile null, diagnostics rỗng", o["ok"] and o["result"]["ok"] and o["result"]["provider"] == "browser" and o["result"]["target"] == "browser" and o["result"]["compile"] is None and o["result"]["diagnostics"] == [])
    kiem("tức thì: dưới 1,5 giây kể cả dựng worker (không tải gì)", o["ms"] < 1500 and not o["asked"], "%d ms, asked=%s" % (o["ms"], o["asked"]))
    ev = [e["type"] for e in o["events"]]
    kiem("onProgress nhận sự kiện run, stdout, stderr (truyền dần)", "run" in ev and "stdout" in ev and "stderr" in ev, ev)

    o = t.go(req("javascript", [F("main.js", 'const s = readInput(); console.log(s.split("\\n").filter(Boolean).map(Number).reduce((a, b) => a + b, 0)); console.log(process.argv.slice(2).join("+"));')], stdin="1\n2\n3\n", args=["x", "y"]))
    kiem("stdin: readInput() đọc toàn bộ, process.argv có tham số", out_of(o) == "6\nx+y\n", json.dumps(o)[:300])
    o = t.go(req("javascript", [F("main.js", 'const rl = require("readline").createInterface({input: process.stdin}); const L = []; rl.on("line", l => L.push(l)); rl.on("close", () => console.log(L.length + ":" + L.join("|")));')], stdin="a\nb\nc\n"))
    kiem("stdin: readline.on('line') + 'close'", out_of(o) == "3:a|b|c\n", json.dumps(o)[:300])

    t0 = time.time()
    o = t.go(req("javascript", [F("main.js", 'console.log("truoc"); console.log("hai"); while (true) {}')], runTimeoutMs=1500))
    kiem("vòng lặp vô hạn bị giết sau 1,5 giây: run.timedOut, error run_timeout, dòng đã in vẫn còn", o["ok"] and o["result"]["run"]["timedOut"] and o["result"]["error"]["code"] == "run_timeout" and out_of(o) == "truoc\nhai\n" and time.time() - t0 < 4.5, json.dumps(o)[:300])
    o = t.go(req("javascript", [F("main.js", "console.log('sau khi giết vẫn chạy được')")]))
    kiem("sau khi giết, lần chạy kế tiếp bình thường", out_of(o) == "sau khi giết vẫn chạy được\n")

    multi = [F("main.js", 'const u = require("./lib/util");\nconst data = require("./data.json");\nconsole.log("go", data.x, require.main === module);\nu.fail(2);\n'), F("lib/util.js", 'exports.fail = function (n) {\n  return nope(n);\n};\n'), F("data.json", '{"x": 42}')]
    o = t.go(req("javascript", multi))
    d = o["result"]["diagnostics"] if o["ok"] else []
    kiem("nhiều tệp: require('./lib/util') (không .js), require('./data.json'), require.main", o["ok"] and out_of(o).startswith("go 42 true\n"), json.dumps(o)[:300])
    kiem("lỗi chạy nhiều tệp → diagnostics: lib/util.js:2 (lỗi) rồi main.js:4 (lời gọi), stderr có ngăn xếp theo tên tệp dự án",
         len(d) == 2 and d[0]["file"] == "lib/util.js" and d[0]["line"] == 2 and d[0]["severity"] == "error" and "ReferenceError" in d[0]["message"] and d[1]["file"] == "main.js" and d[1]["line"] == 4 and "lib/util.js:2" in run_of(o)["stderr"], json.dumps(d))
    o = t.go(req("javascript", [F("main.js", 'const a = 1;\nlet x = ;\nconsole.log(a);\n')]))
    d = o["result"]["diagnostics"] if o["ok"] else []
    kiem("lỗi cú pháp: trình duyệt báo đúng main.js dòng 2 cột 9 (ErrorEvent của worker)", len(d) == 1 and d[0]["file"] == "main.js" and d[0]["line"] == 2 and d[0]["col"] == 9 and "SyntaxError" in d[0]["message"] and o["result"]["error"]["code"] == "runtime_error", json.dumps(d))
    o = t.go(req("javascript", [F("main.js", 'require("./lib/u.js");\n'), F("lib/u.js", 'exports.f = function () {\n  return (1 + ;\n};\n')]))
    d = o["result"]["diagnostics"] if o["ok"] else []
    kiem("lỗi cú pháp ở tệp phụ: lib/u.js dòng 2 (không bị đổ sang main.js)", len(d) == 1 and d[0]["file"] == "lib/u.js" and d[0]["line"] == 2, json.dumps(d))
    o = t.go(req("javascript", [F("main.js", 'fetch("https://example.com").catch(e => console.log("chan:", e.message.slice(0, 8))); try { new XMLHttpRequest(); } catch (e) { console.log("xhr chan"); }')]))
    kiem("chặn mạng: fetch/XMLHttpRequest ném lỗi; warnings ghi rõ", out_of(o) == "xhr chan\nchan: Mạng bị \n" and any("fetch" in w and "XMLHttpRequest" in w for w in o["result"]["warnings"]) and not any(w.startswith("http") for w in o["result"]["warnings"]), json.dumps(o)[:300])
    o = t.go(req("javascript", [F("main.js", 'setTimeout(() => console.log("sau 50ms"), 50); Promise.resolve().then(() => console.log("micro")); (async () => { await new Promise(r => setTimeout(r, 20)); console.log("async xong"); })(); console.log("đầu");')]))
    kiem("hẹn giờ + promise: đợi hết rồi mới kết thúc, đúng thứ tự", out_of(o) == "đầu\nmicro\nasync xong\nsau 50ms\n", out_of(o))
    o = t.go(req("javascript", [F("main.js", 'Promise.reject(new Error("rej"));')]))
    kiem("promise bị từ chối không ai bắt → lỗi, mã thoát 1, diagnostics", o["ok"] and not o["result"]["ok"] and run_of(o)["code"] == 1 and o["result"]["diagnostics"][0]["message"] == "Error: rej", json.dumps(o)[:300])
    o = t.go(req("javascript", [F("main.js", 'console.log("a"); process.exit(3); console.log("b")')]))
    kiem("process.exit(3) → mã thoát 3, không in tiếp, runtime_error", out_of(o) == "a\n" and run_of(o)["code"] == 3 and o["result"]["error"]["code"] == "runtime_error")
    o = t.go(req("javascript", [F("main.js", 'for (let i = 0; i < 50000; i++) console.log("dong " + i);')]))
    kiem("in 50 000 dòng: không treo, đủ cả dòng đầu lẫn dòng cuối (đầu ra được gom lô)", o["ok"] and o["result"]["ok"] and out_of(o).startswith("dong 0\ndong 1\n") and out_of(o).endswith("dong 49999\n") and o["ms"] < 15000, "%d ms" % o["ms"])
    big = t.go(req("javascript", [F("main.js", 'const s = "x".repeat(1000); for (let i = 0; i < 3000; i++) console.log(s);')]))
    kiem("đầu ra > 1 MB bị cắt ở 1 MiB và đặt truncated", big["ok"] and big["result"]["run"]["truncated"] and len(out_of(big).encode("utf-8")) <= 1048576 + 8, "%d ký tự" % len(out_of(big)))
    h = t.go(req("javascript", [F("main.js", "while (true) {}")], runTimeoutMs=30000), None, 300)
    kiem("huỷ giữa chừng → reject Error code cancelled, thông báo tiếng Việt", (not h["ok"]) and h["error"]["code"] == "cancelled" and "dừng" in h["error"]["message"] and h["ms"] < 3000, json.dumps(h)[:300])
    o = t.go(req("javascript", [F("main.js", 'console.log("ok sau huỷ")')]))
    kiem("sau khi huỷ, chạy lại bình thường", out_of(o) == "ok sau huỷ\n")
    o = t.go(req("javascript", [F("notes.txt", "hello")], mainFile="notes.txt"))
    kiem("tệp chính không phải JavaScript → lỗi bad_request rõ ràng", (not o["ok"]) and o["error"]["code"] == "bad_request" and "không phải JavaScript" in o["error"]["message"], json.dumps(o)[:300])
    o = t.go(req("javascript", [F("main.js", 'console.log(require("fs").readFileSync("input.txt", "utf8").trim()); require("fs").writeFileSync("out.txt", "z"); console.log(require("fs").existsSync("out.txt"));'), F("input.txt", "doc tu tep du an\n")]))
    kiem("fs.readFileSync đọc được tệp dự án; ghi vào bộ nhớ ảo", out_of(o) == "doc tu tep du an\ntrue\n", json.dumps(o)[:300])
    kiem("không có lỗi console/pageerror ở trang", not t.loi_console(), t.loi_console())
    t.pg.close()


def tang_file_js(br, ):
    tang("TẦNG 1b — mở bằng file:// (không máy chủ)")
    ctx = br.new_context()
    try:
        t = Trang(ctx, "file:///" + os.path.join(HERE, "test-runner.html").replace("\\", "/"), "")
        o = t.go(req("javascript", [F("main.js", 'const u = require("./u"); console.log(u.dbl(21));'), F("u.js", "exports.dbl = x => x * 2;")]))
        kiem("file://: JavaScript nhiều tệp chạy được (worker dựng từ Blob)", out_of(o) == "42\n", json.dumps(o)[:300])
    except Exception as e:
        sai("file://: " + str(e)[:200])
    ctx.close()


# ----------------------------------------------------------------------------- tầng 2: Python
def tang_py(br, url, api_base, co_file):
    tang("TẦNG 2 — Python trong trình duyệt (Pyodide; lần đầu tải ≈ 14 MB từ cdn.jsdelivr.net)")
    ctx = br.new_context()
    t = Trang(ctx, url, api_base)
    o = t.go(req("python", [F("main.py", "print(1)")]), {"decline": True})
    kiem("từ chối hộp 'Tải?' → reject code download_declined, đã hỏi đúng thông tin, KHÔNG tải gì", (not o["ok"]) and o["error"]["code"] == "download_declined" and len(o["asked"]) == 1 and "Pyodide" in o["asked"][0]["what"] and o["asked"][0]["size"] == "≈ 10 MB" and not [e for e in o["events"] if e["type"] == "download"], json.dumps(o)[:400])
    t0 = time.time()
    o = t.go(req("python", [F("main.py", 'import sys\nprint("xin chào", 1 + 2)\nprint("loi", file=sys.stderr)\nname = input("Tên? ")\nprint("hi", name)\nprint(sum(int(x) for x in sys.stdin.read().split()), sys.argv[1:])\n')], stdin="An\n1 2 3\n", args=["a b", "c"]))
    kiem("lần đầu: hỏi → tải → khởi động → chạy; stdout/stderr tách riêng, input() + sys.stdin + sys.argv", o["ok"] and out_of(o) == "xin chào 3\nTên? hi An\n6 ['a b', 'c']\n" and run_of(o)["stderr"] == "loi\n", json.dumps(o)[:400])
    dl = [e for e in o["events"] if e["type"] == "download"]
    kiem("báo tiến độ tải: nhiều sự kiện download, phần trăm không giảm, kết thúc 100", len(dl) >= 3 and all(a["pct"] <= b["pct"] for a, b in zip(dl, dl[1:])) and dl[-1]["pct"] == 100 and dl[0]["total"] > 10_000_000, [(e["pct"]) for e in dl][:8])
    kiem("version ghi Python + Pyodide; ok", o["ok"] and "Pyodide 0.26.4" in o["result"]["version"], o["result"]["version"] if o["ok"] else "")
    ok("lần đầu (gồm tải + khởi động Python) mất %.1f giây" % (time.time() - t0))
    o = t.go(req("python", [F("main.py", 'import utils\nprint("start")\nutils.boom(3)\n'), F("utils.py", 'def boom(n):\n    return helper(n)\n\ndef helper(n):\n    return 10 / (n - 3)\n')]))
    d = o["result"]["diagnostics"] if o["ok"] else []
    kiem("import mô-đun trong dự án + traceback → diagnostics: lỗi utils.py:5 cột 12, lời gọi utils.py:2 và main.py:3",
         o["ok"] and not o["result"]["ok"] and "ZeroDivisionError" in run_of(o)["stderr"] and 'File "main.py", line 3' in run_of(o)["stderr"] and len(d) == 3 and d[0]["file"] == "utils.py" and d[0]["line"] == 5 and d[0]["col"] == 12 and d[0]["severity"] == "error" and d[2]["file"] == "main.py" and d[2]["line"] == 3, json.dumps(d))
    o = t.go(req("python", [F("main.py", 'x = (1 +\nprint("hi")\n')]))
    d = o["result"]["diagnostics"] if o["ok"] else []
    kiem("SyntaxError → diagnostics main.py:1:5", len(d) == 1 and d[0]["file"] == "main.py" and d[0]["line"] == 1 and d[0]["col"] == 5 and "was never closed" in d[0]["message"], json.dumps(d))
    o = t.go(req("python", [F("main.py", 'from geometry.shapes import area\nprint(area(3))\n'), F("geometry/__init__.py", ""), F("geometry/shapes.py", "def area(r):\n    return 3 * r * r\n")]))
    kiem("gói nhiều thư mục (geometry/__init__.py) import được", out_of(o) == "27\n", json.dumps(o)[:300])
    o = t.go(req("python", [F("main.py", 'print(open("data.txt").read().strip())\nopen("out.txt", "w").write("z")\nimport os\nprint(os.path.exists("out.txt"), os.getcwd())\n'), F("data.txt", "du lieu\n")]))
    kiem("đọc được tệp dữ liệu của dự án, ghi tệp vào hệ tệp ảo, cwd = /work", out_of(o) == "du lieu\nTrue /work\n", json.dumps(o)[:300])
    o = t.go(req("python", [F("main.py", 'try:\n    print(zzz)\nexcept NameError:\n    print("sạch")\nimport utils\nprint(utils.v)\n'), F("utils.py", "v = 7\n")]))
    kiem("mỗi lần chạy sạch trạng thái (biến/mô-đun của lần trước không rò sang)", out_of(o) == "sạch\n7\n", out_of(o))
    o = t.go(req("python", [F("main.py", 'import sys\nprint("a")\nsys.exit(4)\n')]))
    kiem("sys.exit(4) → mã thoát 4, runtime_error", out_of(o) == "a\n" and run_of(o)["code"] == 4 and o["result"]["error"]["code"] == "runtime_error")
    o = t.go(req("python", [F("main.py", 'import js\njs.fetch("https://example.com")\nprint("không ra mạng")\n')]))
    kiem("chặn mạng sau khi Pyodide nạp: js.fetch bị chặn, warnings ghi rõ", out_of(o) == "không ra mạng\n" and any("fetch" in w for w in o["result"]["warnings"]), json.dumps(o)[:300])
    o = t.go(req("python", [F("main.py", 'print("truoc", flush=True)\nwhile True:\n    pass\n')], runTimeoutMs=1500))
    kiem("vòng lặp vô hạn bị giết: timedOut, run_timeout, dòng đã in còn, cảnh báo sẽ khởi động lại", o["ok"] and o["result"]["run"]["timedOut"] and o["result"]["error"]["code"] == "run_timeout" and out_of(o) == "truoc\n" and any("khởi động lại" in w for w in o["result"]["warnings"]), json.dumps(o)[:300])
    t0 = time.time()
    o = t.go(req("python", [F("main.py", 'print("lại chạy", 6 * 7)\n')]))
    kiem("sau khi giết: nạp lại Pyodide từ bộ nhớ đệm và chạy được", out_of(o) == "lại chạy 42\n" and not o["asked"], "%.1f s" % (time.time() - t0))
    ok("khởi động lại Pyodide sau khi bị giết mất %.1f giây" % (time.time() - t0))
    h = t.go(req("python", [F("main.py", "while True:\n    pass\n")], runTimeoutMs=30000), None, 700)
    kiem("huỷ giữa chừng → cancelled", (not h["ok"]) and h["error"]["code"] == "cancelled", json.dumps(h)[:200])
    o = t.go(req("python", [F("main.py", 'print("ok sau huỷ")\n')]))
    kiem("sau huỷ chạy lại được", out_of(o) == "ok sau huỷ\n")
    keys = t.pg.evaluate("async () => (await caches.keys()).filter(k => k.startsWith('cs-pyodide-'))")
    kiem("tệp Pyodide đã vào Cache Storage `cs-pyodide-<phiên bản>` (dùng lại offline)", keys == ["cs-pyodide-0.26.4"], keys)
    t.pg.close()
    t2 = Trang(ctx, url, api_base)
    t0 = time.time()
    o = t2.go(req("python", [F("main.py", 'print("trang mới")')]))
    kiem("trang mới, cùng trình duyệt: KHÔNG hỏi lại (đã có trong Cache Storage), chạy được", out_of(o) == "trang mới\n" and not o["asked"] and not [e for e in o["events"] if e["type"] == "download"], json.dumps(o["asked"]))
    ok("trang mới → Python chạy sau %.1f giây (từ bộ nhớ đệm)" % (time.time() - t0))
    kiem("không có lỗi console/pageerror", not t2.loi_console() and not t.loi_console(), t.loi_console() + t2.loi_console())
    t2.pg.close(); ctx.close()
    if co_file:
        ctx = br.new_context()
        try:
            tf = Trang(ctx, "file:///" + os.path.join(HERE, "test-runner.html").replace("\\", "/"), "")
            o = tf.go(req("python", [F("main.py", 'print("từ file://", 6 * 7)')]))
            kiem("file:// (không Cache Storage): Python vẫn chạy được — tải thẳng từ CDN", out_of(o) == "từ file:// 42\n", json.dumps(o)[:300])
        except Exception as e:
            sai("Python từ file://: " + str(e)[:200])
        ctx.close()


# ----------------------------------------------------------------------------- tầng 3: C/C++
MAIN_CPP = '#include <iostream>\n#include "util.h"\n#include "geo/shape.h"\nint main(int argc, char** argv) {\n    int a, b; std::cin >> a >> b;\n    std::cout << add(a, b) << " " << area(3) << " argc=" << argc << (argc > 1 ? argv[1] : "") << std::endl;\n    std::cerr << "dbg" << std::endl;\n    return 0;\n}\n'
MULTI_CPP = [F("main.cpp", MAIN_CPP), F("src/util.cpp", '#include "util.h"\nint add(int a, int b) { return a + b; }\n'), F("include/util.h", "#pragma once\nint add(int a, int b);\n"),
             F("geo/shape.cpp", '#include "shape.h"\nint area(int r) { return 3 * r * r; }\n'), F("geo/shape.h", "#pragma once\nint area(int r);\n")]


def tang_cpp(br, url, api_base, co_file):
    tang("TẦNG 3 — C/C++ nhiều tệp trong trình duyệt (Clang → WebAssembly; lần đầu tải ≈ 25 MB từ cdn.jsdelivr.net)")
    ctx = br.new_context()
    t = Trang(ctx, url, api_base)
    o = t.go(req("cpp", MULTI_CPP), {"decline": True})
    kiem("từ chối hộp 'Tải?' → reject download_declined; hỏi đúng {what, size:'≈ 25 MB', note}; KHÔNG tải", (not o["ok"]) and o["error"]["code"] == "download_declined" and len(o["asked"]) == 1 and o["asked"][0]["size"] == "≈ 25 MB" and "Clang" in o["asked"][0]["what"] and o["asked"][0]["note"] and not [e for e in o["events"] if e["type"] == "download"], json.dumps(o)[:400])
    t0 = time.time()
    o = t.go(req("cpp", MULTI_CPP, stdin="40 2", args=["X"]))
    kiem("lần đầu: 3 tệp nguồn (main.cpp, src/util.cpp, geo/shape.cpp) + 2 tiêu đề ở 2 thư mục (include/, geo/) biên dịch + liên kết + chạy: stdin, argv", o["ok"] and o["result"]["ok"] and out_of(o) == "42 27 argc=2X\n" and run_of(o)["stderr"] == "dbg\n", json.dumps(o)[:500])
    dl = [e for e in o["events"] if e["type"] == "download"]
    kiem("báo tiến độ tải Clang: nhiều sự kiện, đến 100, rồi sự kiện 'compile' sau cùng", len(dl) >= 3 and dl[-1]["pct"] == 100 and o["events"][-1]["type"] in ("compile", "run", "stdout", "stderr") and any(e["type"] == "compile" and "biên dịch 3 tệp" in e.get("message", "") for e in o["events"]), [(e["type"], e.get("pct")) for e in o["events"]][:6])
    ok("lần đầu (gồm tải Clang ≈ 25 MB + biên dịch 3 tệp) mất %.1f giây; biên dịch %d ms" % (time.time() - t0, o["result"]["compile"]["ms"] if o["ok"] else -1))
    kiem("version ghi Clang…WebAssembly; compile.ok, run.code 0", o["ok"] and "Clang" in o["result"]["version"] and o["result"]["compile"]["ok"] and run_of(o)["code"] == 0)
    t0 = time.time()
    o = t.go(req("cpp", MULTI_CPP, stdin="1 2"))
    kiem("chạy lại cùng mã với stdin khác: dùng bộ nhớ đệm biên dịch → tức thì", out_of(o) == "3 27 argc=1\n" and o["ms"] < 1500, "%d ms" % o["ms"])
    o = t.go(req("cpp", [F("main.cpp", '#include <iostream>\nint main() {\n    int x = "abc";\n    undefined_fn(3);\n    std::cout << 1\n}\n')]))
    d = o["result"]["diagnostics"] if o["ok"] else []
    kiem("lỗi biên dịch: ok:false, compile_error, run chưa chạy, 3 chẩn đoán đúng dòng/cột", o["ok"] and not o["result"]["ok"] and o["result"]["error"]["code"] == "compile_error" and o["result"]["run"]["ran"] is False and [(x["line"], x["col"]) for x in d if x["severity"] == "error"] == [(3, 9), (4, 5), (5, 19)], json.dumps(d))
    err_files = [F("main.cpp", '#include "util.h"\nint main() { return add(1, 2); }\n'), F("src/util.cpp", '#include "util.h"\nint add(int a, int b) {\n    return a + b\n}\n'), F("include/util.h", "int add(int a, int b);\n")]
    o = t.go(req("cpp", err_files))
    d = o["result"]["diagnostics"] if o["ok"] else []
    kiem("lỗi ở tệp phụ: chẩn đoán trỏ src/util.cpp:3 (không phải main.cpp)", len(d) >= 1 and d[0]["file"] == "src/util.cpp" and d[0]["line"] == 3 and d[0]["severity"] == "error", json.dumps(d))
    o = t.go(req("cpp", [F("main.cpp", '#include <cstdio>\nint f(int y) { int unused; if (y = 3) return 1; }\nint main() { printf("%d\\n", f(0)); }\n')], compileArgs=["-Wall", "-Wextra"]))
    d = o["result"]["diagnostics"] if o["ok"] else []
    kiem("cảnh báo (-Wall -Wextra) khi biên dịch thành công: ok vẫn true, diagnostics có warning kèm cột", o["ok"] and o["result"]["ok"] and any(x["severity"] == "warning" and x["line"] == 2 for x in d) and "warning" in o["result"]["compile"]["stderr"], json.dumps(d)[:300])
    o = t.go(req("cpp", [F("main.cpp", '#include <cstdio>\nint main() { printf("truoc\\n"); fflush(stdout); for(;;){} }\n')], runTimeoutMs=1500))
    kiem("vòng lặp vô hạn: giết sau 1,5 giây, run_timeout, dòng đã in còn", o["ok"] and o["result"]["run"]["timedOut"] and o["result"]["error"]["code"] == "run_timeout" and out_of(o) == "truoc\n", json.dumps(o)[:300])
    o = t.go(req("cpp", [F("main.cpp", '#include <cstdio>\nstatic long long f(long long n){ return n ? 1 + f(n - 1) : 0; }\nint main() { printf("%lld\\n", f(150000)); }\n')]))
    kiem("đệ quy 150 000 tầng (stack 8 MB) chạy được", out_of(o) == "150000\n")
    o = t.go(req("cpp", [F("main.cpp", '#include <cassert>\n#include <cstdio>\nint main() { printf("a\\n"); assert(1 == 2); }\n')]))
    kiem("assert thất bại → tín hiệu SIGABRT, stderr có thông điệp, runtime_error", o["ok"] and run_of(o)["signal"] == "SIGABRT" and "Assertion failed" in run_of(o)["stderr"] and o["result"]["error"]["code"] == "runtime_error", json.dumps(o)[:300])
    o = t.go(req("cpp", [F("main.cpp", '#include <cstdio>\nint main() { int *p = (int*)0xFFFFFFF0; printf("x\\n"); fflush(stdout); return *p; }\n')]))
    kiem("truy cập ngoài vùng nhớ → SIGSEGV + giải thích tiếng Việt", o["ok"] and run_of(o)["signal"] == "SIGSEGV" and "ngoài vùng" in run_of(o)["stderr"], json.dumps(o)[:300])
    o = t.go(req("cpp", [F("main.cpp", "int main() { return 5; }\n")]))
    kiem("thoát mã 5 → code 5, runtime_error", run_of(o)["code"] == 5 and o["result"]["error"]["code"] == "runtime_error")
    o = t.go(req("cpp", [F("main.cpp", "#include <stdexcept>\nint main() { try { throw 1; } catch (int) {} }\n")]))
    kiem("try/throw: lỗi biên dịch rõ ('exceptions disabled') + warnings giải thích giới hạn", o["ok"] and o["result"]["error"]["code"] == "compile_error" and any("ngoại lệ" in w for w in o["result"]["warnings"]), json.dumps(o)[:300])
    o = t.go(req("cpp", [F("main.cpp", '#include <bits/stdc++.h>\nusing namespace std;\nint main(){ vector<int> v{3,1,2}; sort(v.begin(), v.end()); for (int x : v) cout << x; cout << "\\n"; clock_t c = clock(); printf("%d\\n", (int)(c >= 0)); }\n')]))
    kiem("bits/stdc++.h (bản giả) + clock() dùng được", out_of(o) == "123\n1\n", json.dumps(o)[:300])
    o = t.go(req("cpp", [F("main.cpp", '#include <unistd.h>\n#include <cstdio>\n#include <chrono>\nint main() { auto t = std::chrono::steady_clock::now(); usleep(150000); auto d = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - t).count(); printf("%d\\n", d >= 140); }\n')]))
    kiem("usleep(150 ms) ngủ thật (poll_oneoff)", out_of(o) == "1\n", json.dumps(o)[:300])
    o = t.go(req("cpp", [F("main.cpp", '#include <iostream>\n#include <vector>\n#include <tuple>\nint main() { std::vector<int> v{1,2,3}; auto [a, b, c] = std::tuple(v[0], v[1], v[2]); std::cout << (a + b + c) << "\\n"; }\n')], std="c++20", compileArgs=["-Wall"]))
    kiem("chuẩn C++20 (req.std) + cờ -Wall từ compileArgs", out_of(o) == "6\n", json.dumps(o)[:300])
    o = t.go(req("c", [F("main.c", '#include <stdio.h>\n#include <math.h>\n#include "inc/h.h"\nint main(void) { int n; scanf("%d", &n); printf("%d %.2f %d\\n", n * 2, sqrt((double)n), H); return 0; }\n'), F("inc/h.h", "#define H 7\n")], stdin="9", compileArgs=["-lm"]))
    kiem("C thuần (clang, không ++) + -lm + tiêu đề trong thư mục con", out_of(o) == "18 3.00 7\n", json.dumps(o)[:300])
    o = t.go(req("cpp", [F("main.cpp", "int missing(int);\nint main() { return missing(3); }\n")]))
    d = o["result"]["diagnostics"] if o["ok"] else []
    kiem("lỗi liên kết: compile_error, chẩn đoán '(liên kết) undefined symbol', không lộ đường dẫn tệp tạm", o["ok"] and o["result"]["error"]["code"] == "compile_error" and len(d) == 1 and d[0]["message"] == "(liên kết) undefined symbol: missing(int)", json.dumps(d))
    o = t.go(req("cpp", [F("main.cpp", '#include <cstdio>\nint main(int, char**) { printf("c\\n"); }\n')], compileArgs=["-fplugin=evil", "-Wall"]))
    kiem("cờ ngoài danh sách cho phép bị loại + cảnh báo rõ (kể cả khi chạy trong trình duyệt)", out_of(o) == "c\n" and any("-fplugin=evil" in w for w in o["result"]["warnings"]), json.dumps(o)[:300])
    h = t.go(req("cpp", [F("main.cpp", "#include <bits/stdc++.h>\nint main(){}\n"), F("x.cpp", "int x;\n")]), None, 120)
    kiem("huỷ giữa lúc biên dịch → cancelled, worker biên dịch bị giết", (not h["ok"]) and h["error"]["code"] == "cancelled", json.dumps(h)[:200])
    t0 = time.time()
    o = t.go(req("cpp", [F("main.cpp", '#include <cstdio>\nint main() { puts("sau huỷ"); }\n')]))
    kiem("sau huỷ: nạp lại từ bộ nhớ đệm và chạy được", out_of(o) == "sau huỷ\n" and not o["asked"], json.dumps(o)[:200])
    ok("sau huỷ giữa biên dịch, chạy lại sau %.1f giây" % (time.time() - t0))
    h = t.go(req("cpp", [F("main.cpp", '#include <cstdio>\nint main() { for(;;){} }\n')], runTimeoutMs=30000), None, 800)
    kiem("huỷ lúc đang chạy .wasm → cancelled", (not h["ok"]) and h["error"]["code"] == "cancelled", json.dumps(h)[:200])
    keys = t.pg.evaluate("async () => (await caches.keys()).filter(k => k.startsWith('cs-clang-'))")
    kiem("Clang đã vào Cache Storage `cs-clang-<phiên bản>`", keys == ["cs-clang-22.0.0-git20542-10"], keys)
    kiem("không có lỗi console/pageerror ở trang", not t.loi_console(), t.loi_console())
    t.pg.close()
    t2 = Trang(ctx, url, api_base)
    t0 = time.time()
    o = t2.go(req("cpp", [F("main.cpp", '#include <cstdio>\nint main() { puts("trang mới"); }\n')]))
    kiem("trang mới, cùng trình duyệt: KHÔNG hỏi lại, KHÔNG tải lại (dùng Cache Storage)", out_of(o) == "trang mới\n" and not o["asked"] and not [e for e in o["events"] if e["type"] == "download"] and any(e["type"] == "cache" for e in o["events"]), json.dumps(o["asked"]))
    ok("trang mới → C++ biên dịch + chạy sau %.1f giây (Clang từ bộ nhớ đệm)" % (time.time() - t0))
    t2.pg.close(); ctx.close()
    if co_file:
        ctx = br.new_context()
        try:
            tf = Trang(ctx, "file:///" + os.path.join(HERE, "test-runner.html").replace("\\", "/"), "")
            o = tf.go(req("cpp", [F("main.cpp", '#include <cstdio>\nint main() { puts("tu file"); }\n')]))
            kiem("file:// (không Cache Storage): C++ vẫn biên dịch+chạy được — tải thẳng từ CDN", out_of(o) == "tu file\n", json.dumps(o)[:300])
        except Exception as e:
            sai("C++ từ file://: " + str(e)[:200])
        ctx.close()


# ----------------------------------------------------------------------------- tầng 4: backend thật
def chay_ket_qua(t, r, **opts):
    o = t.go(r, opts)
    return o


def tang_may_chu(br, may, piston_co, piston_khong_cors):
    tang("TẦNG 4 — backend THẬT (uvicorn + SQLite tạm, RUN_LOCAL_ENABLED) + Piston giả cục bộ")
    ctx = br.new_context()
    t = Trang(ctx, may.url, "/api/v1")
    API = "/api/v1"
    kq = t.pg.evaluate("""async (b) => { const l = await CS.runner.loadServerProviders(b, {fetch: window.fetch.bind(window)});
        return {ids: l.map(p => p.id), def: l.defaultId, local: l.find(p => p.id === 'local'), judge0: l.find(p => p.id === 'judge0'),
                targets: CS.runner.targets({language: 'java', server: l, pistonUrl: ''}).map(x => [x.id, x.available, x.reason])} }""", API)
    kiem("loadServerProviders(/api/v1) → piston, judge0, wandbox, local; default theo máy chủ", set(kq["ids"]) >= {"piston", "judge0", "wandbox", "local"} and kq["def"] == "local", json.dumps(kq)[:300])
    local = kq["local"] or {}
    kiem("provider local: available (đã bật + tìm thấy trình biên dịch), needsSession, java/cpp/python/javascript", local.get("available") is True and local.get("needsSession") is True and {"cpp", "java", "python", "javascript"} <= set(local.get("languages", [])), json.dumps(local)[:300])
    kiem("targets(java): server:local dùng được; server:judge0 không (có lý do)", ["server:local", True] in [x[:2] for x in kq["targets"]] and any(x[0] == "server:judge0" and not x[1] and x[2] for x in kq["targets"]), json.dumps(kq["targets"]))
    kq2 = t.pg.evaluate("async (b) => { const l = await CS.runner.loadServerProviders('http://127.0.0.1:9' + b, {fetch: window.fetch.bind(window)}); return l.length }", API)
    kiem("loadServerProviders tới máy chủ không tồn tại → mảng rỗng, không ném (trong trình duyệt thật)", kq2 == 0)

    # ---- quyền quản trị
    r = req("cpp", [F("main.cpp", '#include <iostream>\nint main() { std::cout << "hi\\n"; }\n')], target="server:local")
    o = t.go(r)
    kiem("server:local KHÔNG có khoá quản trị → reject admin_required, thông báo 'Cần khoá quản trị…'", (not o["ok"]) and o["error"]["code"] == "admin_required" and "Cần khoá quản trị để dùng máy chủ cục bộ" in o["error"]["message"], json.dumps(o)[:300])
    o = t.go(r, {"adminKey": "sai-khoa"})
    kiem("khoá sai → cũng admin_required", (not o["ok"]) and o["error"]["code"] == "admin_required", json.dumps(o)[:300])
    o = t.go(r, {"adminKey": may.khoa})
    kiem("khoá đúng (X-Admin-Key) → chạy được, kết quả chuẩn có provider local + version g++", o["ok"] and o["result"]["ok"] and out_of(o) == "hi\n" and o["result"]["provider"] == "local" and o["result"]["target"] == "server:local" and o["result"]["version"], json.dumps(o)[:400])

    # ---- C++ nhiều tệp
    A = {"adminKey": may.khoa}
    o = t.go(req("cpp", MULTI_CPP, target="server:local", stdin="40 2", args=["X"], compileArgs=["-Iinclude", "-Wall"], std="c++17", opt="O2"), A)
    kiem("g++ thật, 3 tệp nguồn + tiêu đề ở include/ và geo/ (cờ -Iinclude qua compileArgs), stdin, argv", o["ok"] and o["result"]["ok"] and out_of(o) == "42 27 argc=2X\n" and run_of(o)["stderr"].strip() == "dbg" and o["result"]["compile"]["ok"], json.dumps(o)[:500])
    o = t.go(req("cpp", err_cpp(), target="server:local", compileArgs=["-Iinclude", "-Wall", "-Wextra"]), A)
    d = o["result"]["diagnostics"] if o["ok"] else []
    kiem("g++ thật: lỗi biên dịch ở src/util.cpp → diagnostics file src/util.cpp, dòng 3, có cột, compile_error", o["ok"] and o["result"]["error"]["code"] == "compile_error" and d and d[0]["file"] == "src/util.cpp" and d[0]["line"] == 3 and d[0]["col"] > 0 and d[0]["severity"] == "error", json.dumps(d))
    o = t.go(req("cpp", [F("main.cpp", '#include <cstdio>\nint f(int y) { int unused; if (y = 3) return 1; }\nint main() { printf("%d\\n", f(0)); }\n')], target="server:local", compileArgs=["-Wall", "-Wextra"]), A)
    d = o["result"]["diagnostics"] if o["ok"] else []
    kiem("g++ thật: ok:true kèm cảnh báo → diagnostics có warning dòng 2 (cảnh báo không làm ok:false)", o["ok"] and o["result"]["ok"] and any(x["severity"] == "warning" and x["line"] == 2 for x in d), json.dumps(d)[:400])
    t0 = time.time()
    o = t.go(req("cpp", [F("main.cpp", "int main() { for(;;){} }\n")], target="server:local", runTimeoutMs=1500), A)
    kiem("vòng lặp vô hạn: máy chủ giết sau ~1,5 s → run_timeout", o["ok"] and o["result"]["run"]["timedOut"] and o["result"]["error"]["code"] == "run_timeout" and time.time() - t0 < 10, json.dumps(o)[:300])

    # ---- Java có package
    JAVA = [F("src/app/Main.java", 'package app;\n\nimport app.util.Calc;\nimport java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        System.out.println(Calc.twice(n) + " " + args.length);\n    }\n}\n'),
            F("src/app/util/Calc.java", "package app.util;\n\npublic class Calc {\n    public static int twice(int a) { return a * 2; }\n}\n")]
    o = t.go(req("java", JAVA, target="server:local", mainFile="src/app/Main.java", stdin="21", args=["x"]), A)
    kiem("javac+java thật: package app + app.util trong src/…, lớp chạy app.Main suy từ package, stdin/argv", o["ok"] and o["result"]["ok"] and out_of(o).strip() == "42 1" and o["result"]["compile"]["ok"], json.dumps(o)[:500])
    bad = [JAVA[0], F("src/app/util/Calc.java", 'package app.util;\n\npublic class Calc {\n    public static int twice(int a) { return a * "2"; }\n}\n')]
    o = t.go(req("java", bad, target="server:local", mainFile="src/app/Main.java", stdin="21"), A)
    d = o["result"]["diagnostics"] if o["ok"] else []
    kiem("javac thật: lỗi kiểu ở src/app/util/Calc.java:4 (đường dẫn \\ của Windows quy về /) có cột", o["ok"] and o["result"]["error"]["code"] == "compile_error" and d and d[0]["file"] == "src/app/util/Calc.java" and d[0]["line"] == 4 and d[0]["col"] > 0, json.dumps(d))
    thr = [F("src/app/Main.java", 'package app;\n\nimport app.util.Calc;\n\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println(Calc.get(new int[2], 5));\n    }\n}\n'),
           F("src/app/util/Calc.java", "package app.util;\n\npublic class Calc {\n    public static int get(int[] a, int i) {\n        return a[i];\n    }\n}\n")]
    o = t.go(req("java", thr, target="server:local", mainFile="src/app/Main.java"), A)
    d = o["result"]["diagnostics"] if o["ok"] else []
    kiem("Java ném ngoại lệ lúc chạy: lỗi ở Calc.java:5 (frame trong cùng), ghi chú Main.java:7; mã thoát 1", o["ok"] and not o["result"]["ok"] and run_of(o)["code"] == 1 and len(d) >= 2 and d[0]["file"] == "src/app/util/Calc.java" and d[0]["line"] == 5 and d[0]["severity"] == "error" and any(x["file"] == "src/app/Main.java" and x["line"] == 7 and x["severity"] == "note" for x in d), json.dumps(d))

    # ---- Python, JavaScript
    o = t.go(req("python", [F("main.py", 'import utils\nprint(utils.twice(int(input())))\nutils.boom(3)\n'), F("utils.py", "def twice(n):\n    return n * 2\n\ndef boom(n):\n    return 10 / (n - 3)\n")], target="server:local", stdin="21"), A)
    d = o["result"]["diagnostics"] if o["ok"] else []
    kiem("python thật nhiều tệp: in 42 rồi traceback → diagnostics utils.py:5 (lỗi), main.py:3 (ghi chú); stdout không còn \\r", o["ok"] and out_of(o) == "42\n" and d and d[0]["file"] == "utils.py" and d[0]["line"] == 5 and any(x["file"] == "main.py" and x["line"] == 3 for x in d), json.dumps(d))
    o = t.go(req("javascript", [F("main.js", 'const u = require("./lib/util.js");\nconsole.log(u.f(21));\nu.fail(2);\n'), F("lib/util.js", "exports.f = (n) => n * 2;\nexports.fail = function (n) {\n  return nope(n);\n};\n")], target="server:local"), A)
    d = o["result"]["diagnostics"] if o["ok"] else []
    kiem("node thật nhiều tệp: in 42 rồi ReferenceError → diagnostics lib/util.js:3:3 và main.js:3:3", o["ok"] and out_of(o) == "42\n" and len(d) >= 2 and d[0]["file"] == "lib/util.js" and d[0]["line"] == 3 and d[0]["col"] == 3 and d[1]["file"] == "main.js" and d[1]["line"] == 3, json.dumps(d))

    # ---- lỗi do backend thật trả về, qua friendlyError
    o = t.go(req("cpp", [F("../evil.cpp", "int main(){}")], target="server:local", mainFile="../evil.cpp"), A)
    kiem("tên tệp '../evil.cpp' → backend 400 run_bad_file; thông báo tiếng Việt của backend được giữ", (not o["ok"]) and o["error"]["code"] == "run_bad_file" and "evil.cpp" in o["error"]["message"], json.dumps(o)[:300])
    o = t.go(req("cpp", [F("main.cpp", "int main(){}")], target="server:local", stdin="x" * 70000), A)
    kiem("stdin 70 000 ký tự → backend 422 → 'Dữ liệu gửi đi không hợp lệ'", (not o["ok"]) and "không hợp lệ" in o["error"]["message"] and o["error"]["code"] == "http_422", json.dumps(o)[:300])
    o = t.go(req("cpp", [F("main.cpp", "int main(){}")], target="server:judge0"), A)
    kiem("server:judge0 (chưa cấu hình) → 503 run_provider_disabled, lý do của backend", (not o["ok"]) and o["error"]["code"] == "run_provider_disabled" and "Judge0" in o["error"]["message"], json.dumps(o)[:300])
    o = t.go(req("cpp", [F("main.cpp", "int main(){}")], target="server:khong-co"), A)
    kiem("provider không tồn tại → 400 run_unknown_provider, 'không tồn tại'", (not o["ok"]) and o["error"]["code"] == "run_unknown_provider" and "không tồn tại" in o["error"]["message"], json.dumps(o)[:300])
    rj = t.pg.evaluate("""async () => { const r = await fetch('/api/v1/run', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({provider:'local', language:'cpp', files:[{name:'main.cpp', content:'int main(){}'}], compileArgs:['-fplugin=evil.so']})}); const j = await r.json(); const e = CS.runner.friendlyError(r.status, j); return {status: r.status, code: e.code, msg: e.message} }""")
    kiem("friendlyError với phong bì lỗi THẬT: cờ -fplugin bị từ chối (400 hoặc 403 vì thiếu quyền) → mã + thông báo tiếng Việt", rj["status"] in (400, 403) and rj["code"] in ("run_bad_flag", "admin_required") and rj["msg"], json.dumps(rj, ensure_ascii=False))

    # ---- server:piston (backend thật → Piston giả) và giới hạn tốc độ
    o = t.go(req("cpp", [F("main.cpp", "int main(){}")], target="server:piston", stdin="7"))
    kiem("server:piston: backend thật chuyển tới Piston giả; kết quả chuẩn, provider piston", o["ok"] and o["result"]["ok"] and out_of(o) == "piston-gia:7" and o["result"]["provider"] == "piston" and o["result"]["target"] == "server:piston", json.dumps(o)[:400])
    gui = piston_co.nhan[-1] if piston_co.nhan else {}
    kiem("backend gửi Piston: language c++, version *, tệp chính ĐỨNG ĐẦU", gui.get("language") == "c++" and gui.get("version") == "*" and gui.get("files", [{}])[0].get("name") == "main.cpp", json.dumps(gui)[:200])
    o = t.go(req("cpp", [F("main.cpp", "// KHONGCODEBIEN\nint main(){}")], target="server:piston"))
    d = o["result"]["diagnostics"] if o["ok"] else []
    kiem("server:piston: Piston báo lỗi biên dịch → compile_error + chẩn đoán main.cpp:3:5", o["ok"] and o["result"]["error"]["code"] == "compile_error" and d and d[0]["line"] == 3 and d[0]["col"] == 5, json.dumps(o)[:300])
    o = t.go(req("cpp", [F("main.cpp", "// HTTP500\nint main(){}")], target="server:piston"))
    kiem("Piston trả 500 → backend 502 run_provider_unavailable → 'đang không phản hồi … nơi chạy khác'", (not o["ok"]) and o["error"]["code"] == "run_provider_unavailable" and "nơi chạy khác" in o["error"]["message"], json.dumps(o)[:300])

    # ---- huỷ khi đang chờ máy chủ (chương trình dài vài giây)
    t0 = time.time()
    h = t.go(req("cpp", [F("main.cpp", '#include <chrono>\nint main() { auto t = std::chrono::steady_clock::now(); while (std::chrono::steady_clock::now() - t < std::chrono::milliseconds(2500)) {} }\n')], target="server:local", runTimeoutMs=5000), A, 300)
    kiem("huỷ lúc chờ backend → cancelled ngay (< 2 s), fetch bị abort", (not h["ok"]) and h["error"]["code"] == "cancelled" and time.time() - t0 < 12, "%.1f s %s" % (time.time() - t0, json.dumps(h)[:200]))
    time.sleep(3.5)                                       # đợi tiến trình mồ côi trên máy chủ chạy xong (slot run_busy)

    # ---- piston-custom: trình duyệt gọi thẳng, CORS thật
    PU = piston_co.url
    o = t.go(req("cpp", [F("util.cpp", "u"), F("main.cpp", "m")], target="piston-custom", mainFile="main.cpp", stdin="9", compileArgs=["-O2"]), {"pistonUrl": PU})
    kiem("piston-custom: trình duyệt gọi thẳng Piston (preflight CORS OK), kết quả chuẩn, tệp chính đứng đầu, cảnh báo cờ bị bỏ qua",
         o["ok"] and o["result"]["ok"] and out_of(o) == "piston-gia:9" and o["result"]["target"] == "piston-custom" and piston_co.nhan[-1]["files"][0]["name"] == "main.cpp" and any("Piston không nhận cờ biên dịch" in w for w in o["result"]["warnings"]), json.dumps(o)[:400])
    o = t.go(req("cpp", [F("main.cpp", "// KHONGCODEBIEN\nint main(){}")], target="piston-custom"), {"pistonUrl": PU})
    d = o["result"]["diagnostics"] if o["ok"] else []
    kiem("piston-custom: lỗi biên dịch → compile_error + chẩn đoán 3:5", o["ok"] and o["result"]["error"]["code"] == "compile_error" and d and d[0]["line"] == 3 and d[0]["col"] == 5, json.dumps(o)[:300])
    o = t.go(req("cpp", [F("main.cpp", "int main(){}")], target="piston-custom"), {"pistonUrl": piston_khong_cors.url})
    kiem("Piston KHÔNG có CORS → trình duyệt chặn → Error code network, thông báo nhắc CORS", (not o["ok"]) and o["error"]["code"] == "network" and "CORS" in o["error"]["message"] and "Piston" in o["error"]["message"], json.dumps(o)[:300])
    o = t.go(req("cpp", [F("main.cpp", "int main(){}")], target="piston-custom"), {"pistonUrl": "http://127.0.0.1:9/api/v2"})
    kiem("Piston không lắng nghe (cổng đóng) → code network", (not o["ok"]) and o["error"]["code"] == "network", json.dumps(o)[:300])
    o = t.go(req("cpp", [F("main.cpp", "int main(){}")], target="piston-custom"))
    kiem("chưa đặt URL → no_piston_url", (not o["ok"]) and o["error"]["code"] == "no_piston_url")

    # ---- 504: Piston giả trả lời quá chậm (≥ trần http của backend, tối thiểu 5 s)
    t0 = time.time()
    o = t.go(req("cpp", [F("main.cpp", "// NGU7GIAY\nint main(){}")], target="server:piston", runTimeoutMs=100, compileTimeoutMs=100))
    ok("(504) Piston giả ngủ 7 s với trần chờ ≈ 5 s: %s sau %.1f s" % ("code=" + (o["error"]["code"] if not o["ok"] else "ok"), time.time() - t0))
    kiem("Piston trả lời quá chậm → 504 run_provider_timeout 'trả lời quá chậm'", (not o["ok"]) and o["error"]["code"] == "run_provider_timeout" and "quá chậm" in o["error"]["message"], json.dumps(o)[:300])

    # ---- 429: vượt giới hạn tốc độ của người KHÔNG quản trị (đặt cuối: mọi yêu cầu không quản trị đều được tính, kể cả lỗi)
    lim = []
    for _ in range(80):
        o = t.go(req("cpp", [F("main.cpp", "int main(){}")], target="server:khong-co"))
        if not o["ok"] and o["error"]["code"] == "run_rate_limited":
            lim.append(o["error"]); break
    kiem("vượt RUN_RATE_PER_MIN=30: backend 429 → code run_rate_limited, .retryAfter số giây, thông báo 'Chạy quá nhanh, thử lại sau N giây'",
         len(lim) >= 1 and isinstance(lim[0]["retryAfter"], int) and lim[0]["retryAfter"] > 0 and ("thử lại sau %d giây" % lim[0]["retryAfter"]) in lim[0]["message"] and "Chạy quá nhanh" in lim[0]["message"], json.dumps(lim[:1], ensure_ascii=False))
    o = t.go(req("cpp", [F("main.cpp", "int main(){}")], target="server:local"), A)
    kiem("phiên quản trị được miễn giới hạn tốc độ (server:local vẫn chạy ngay sau khi người không quản trị bị 429)", o["ok"] and o["result"]["ok"], json.dumps(o)[:200])
    kiem("không có lỗi console/pageerror bất ngờ ở trang", not t.loi_console(), t.loi_console())
    t.pg.close(); ctx.close()


def err_cpp():
    return [F("main.cpp", '#include "util.h"\nint main() { return add(1, 2); }\n'), F("src/util.cpp", '#include "util.h"\nint add(int a, int b) {\n    return a + b\n}\n'), F("include/util.h", "int add(int a, int b);\n")]


# ----------------------------------------------------------------------------- main
def main():
    from playwright.sync_api import sync_playwright
    a = set(sys.argv[1:])
    t0 = time.time()
    print("Kiểm bộ chạy mã — Edge thật (Playwright). Python/C++ tải thư viện từ cdn.jsdelivr.net (cần mạng).")
    piston_co, piston_khong_cors = PistonGia(True), PistonGia(False)
    may, tinh = None, None
    if "--bo-may-chu" not in a:
        try:
            may = May(piston_co.url).__enter__()
            ok("backend thật đã lên tại %s (SQLite tạm, RUN_LOCAL_ENABLED=true, khoá quản trị thử ngẫu nhiên)" % may.base)
        except Exception as e:
            sai("không khởi động được backend: " + str(e)[:300])
    if may is None:
        tinh = Tinh()
    url = may.url if may else tinh.url
    api_base = "/api/v1" if may else ""
    try:
        with sync_playwright() as pw:
            br = mo_trinh_duyet(pw)
            if br is None:
                sai("không mở được trình duyệt (cần Edge/Chrome/Chromium cho Playwright)")
                return
            for ten, fn in (("tầng 1", lambda: tang_js(br.new_context(), url, api_base)), ("tầng 1b", lambda: tang_file_js(br)),
                            ("tầng 2", None if "--bo-py" in a else lambda: tang_py(br, url, api_base, "--bo-file" not in a)),
                            ("tầng 3", None if "--bo-cpp" in a else lambda: tang_cpp(br, url, api_base, "--file-cpp" in a)),
                            ("tầng 4", None if (may is None or "--bo-may-chu" in a) else lambda: tang_may_chu(br, may, piston_co, piston_khong_cors))):
                if fn is None:
                    bo_qua(ten + " — bỏ qua theo tuỳ chọn" + ("" if ten != "tầng 4" or may else " (backend không lên)"))
                    continue
                try:
                    fn()
                except Exception as e:
                    import traceback
                    sai(ten + " ném lỗi: " + str(e)[:300])
                    traceback.print_exc()
            br.close()
    finally:
        piston_co.dong(); piston_khong_cors.dong()
        if may:
            may.__exit__(None, None, None)
        if tinh:
            tinh.dong()
    print("\n" + "=" * 60)
    print("Đạt %d · SAI %d · bỏ qua %d · %.0f giây" % (len(dat), len(hong), len(bo), time.time() - t0))
    for h in hong:
        print("  SAI: " + h[:300])
    sys.exit(1 if hong else 0)


if __name__ == "__main__":
    main()
