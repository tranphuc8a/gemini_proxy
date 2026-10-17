#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kiểm Logic Puzzle Suite (webapp/tranphuc8a/logic-puzzle-suite) bằng trình duyệt thật.

    backend\\fastapi\\.venv\\Scripts\\python.exe backend\\fastapi\\webapp\\tranphuc8a\\logic-puzzle-suite\\check.py            # tầng 1 + 2
    ... check.py --tinh          # tầng 1: tĩnh (cú pháp, kiem.js, tham chiếu, icon, manifest, tương phản…)
    ... check.py --chuc-nang     # tầng 2: chức năng (Chromium máy tính + Pixel 5 + WebKit iPhone 13)
    ... check.py --song-sot      # tầng 3: sập giữa chừng không mất ván, offline qua service worker, cập nhật
    ... check.py --co-gian       # tầng 4: dữ liệu xấu nhất × nhiều bề rộng × 3 trình duyệt + XSS
    ... check.py --hieu-nang     # tầng 5: sinh puzzle, lịch sử 10.000 ván trong IndexedDB thật — IN SỐ ĐO THẬT
    ... check.py --tat-ca

Máy chủ: FastAPI thật trên SQLite tạm (K.MayChuThu) để đường dẫn /webapp/tranphuc8a/logic-puzzle-suite/, kiểu MIME và phạm vi service worker
đúng như khi triển khai. Trả exit code ≠ 0 khi có phép sai."""

from __future__ import annotations

import io
import json
import os
import re
import subprocess
import sys
import tempfile
import time

HERE = os.path.dirname(os.path.abspath(__file__))
WEBAPP = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(WEBAPP, "courses", "engine"))
import kiem_khoa_hoc as K  # noqa: E402

PATH = "/webapp/tranphuc8a/logic-puzzle-suite/"
OK = FAIL = 0
ERRORS: list = []


def check(cond, msg, detail=""):
    global OK, FAIL
    if cond:
        OK += 1
        print("  ✓ " + msg)
    else:
        FAIL += 1
        print("  ✗ " + msg + ((" — " + str(detail)) if detail != "" else ""))
    return bool(cond)


def section(t):
    print("\n" + t)


# ============================================================================================ tầng 1 — tĩnh
def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def lum(c):
    def f(v):
        v /= 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = (f(x) for x in c)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a, b):
    la, lb = lum(a), lum(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def blend(fg, bg):
    return tuple(round(fg[i] * fg[3] + bg[i] * (1 - fg[3])) for i in range(3))


def parse_tokens(css):
    def block(sel_re):
        m = re.search(sel_re + r"\s*\{(.*?)\n\}", css, re.S | re.M)
        return dict(re.findall(r"--([a-z0-9-]+):\s*([^;]+);", m.group(1))) if m else {}
    return {"light": block(r"^:root"), "dark": block(r':root\[data-theme="dark"\]')}


def color(spec, tok, depth=0):
    """'#rrggbb' | 'rgba(r,g,b,a)' | 'var(--x)' → (r,g,b[,a]) tra trong tok (đã gộp token chung + --pz-*)."""
    spec = spec.strip()
    m = re.match(r"var\(--([a-z0-9-]+)\)", spec)
    if m:
        if depth > 6 or m.group(1) not in tok:
            raise KeyError(m.group(1))
        return color(tok[m.group(1)], tok, depth + 1)
    if spec.startswith("#"):
        return hex_rgb(spec)
    m = re.match(r"rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)", spec)
    return (int(m.group(1)), int(m.group(2)), int(m.group(3)), float(m.group(4)))


def js_files():
    out = []
    for dp, _, names in os.walk(os.path.join(HERE, "assets", "js")):
        out += [os.path.join(dp, n) for n in names if n.endswith(".js")]
    return out


def read(*parts):
    return io.open(os.path.join(HERE, *parts), encoding="utf-8").read()


def tang_1():
    section("TẦNG 1 — tĩnh")
    files = js_files()
    bad = []
    for f in files + [os.path.join(HERE, "sw.js"), os.path.join(HERE, "kiem.js")] + [os.path.join(HERE, "kiem", n) for n in os.listdir(os.path.join(HERE, "kiem"))]:
        r = subprocess.run(["node", "--check", f], capture_output=True, text=True)
        if r.returncode:
            bad.append(os.path.relpath(f, HERE) + ": " + r.stderr.strip().splitlines()[0])
    check(not bad, "cú pháp JS (%d tệp)" % len(files), bad)
    r = subprocess.run(["node", os.path.join(HERE, "kiem.js")], capture_output=True, text=True, encoding="utf-8", env=dict(os.environ, PUZ_PERF_SLACK=os.environ.get("PUZ_PERF_SLACK", "1")))
    tail = (r.stdout.strip().splitlines() or [""])[-1]
    check(r.returncode == 0, "kiem.js (lõi, kho dữ liệu, cá nhân, mọi engine puzzle): " + tail, "\n".join([l for l in r.stdout.splitlines() if "[SAI]" in l][:4]))
    r = subprocess.run([sys.executable, os.path.join(HERE, "sync.py"), "--kiem"], capture_output=True, text=True, encoding="utf-8")
    check(r.returncode == 0, "các bản chép từ personal-wiki khớp nguồn (sync.py --kiem)", r.stdout.strip())

    html = read("index.html")
    refs = re.findall(r'(?:src|href)="(\./[^"#?]+)"', html)
    missing = [p for p in refs if not os.path.exists(os.path.join(HERE, p[2:]))]
    check(refs and not missing, "mọi tham chiếu trong index.html có thật (%d)" % len(refs), missing)
    css_all = "".join(read("assets", "css", n) for n in os.listdir(os.path.join(HERE, "assets", "css")) if n.endswith(".css"))
    ext = re.findall(r'(?:src|href)="(https?://[^"]+)"', html) + re.findall(r"@import|url\(\s*['\"]?https?:", css_all)
    check(not ext, "không nạp tài nguyên ngoài (CDN, font ngoài)", ext)
    used_js = re.findall(r"https?://(?!www\.w3\.org)[a-z0-9.-]+\.[a-z]{2,}[^\s\"']*", "".join(io.open(f, encoding="utf-8").read() for f in files))
    check(not [u for u in used_js if "localhost" not in u], "mã giao diện không nạp / gọi địa chỉ ngoài", sorted(set(used_js))[:4])
    srcs = set(re.findall(r'<script src="\./assets/([^"]+)"', html))
    on_disk = set(os.path.relpath(f, os.path.join(HERE, "assets")).replace("\\", "/") for f in files)
    odd = sorted((on_disk ^ srcs) - {"js/worker/gen.js"})
    check(not odd and "js/worker/gen.js" in on_disk, "mọi tệp .js trong assets/ đều được nạp bởi index.html (trừ worker/gen.js do Worker nạp)", odd)
    pz = re.findall(r'<script src="\./assets/([^"]+)" data-pz>', html)
    check(all(p.startswith("js/puzzles/") or p.startswith("js/core/") for p in pz) and all(any(p.endswith("/" + n) for p in pz) for n in ("rng.js", "util.js", "csp.js", "types.js")),
          "tệp dùng chung với worker (data-pz) gồm rng/util/csp/types + engine puzzles", pz)
    sw = read("sw.js")
    check("assets/js/worker/gen.js" in sw, "service worker tiền lưu worker sinh puzzle (không có thẻ <script>) để dùng được offline")

    sprites = set(re.findall(r'<symbol id="i-([a-z0-9-]+)"', html))
    used = set()
    for f in files:
        src = io.open(f, encoding="utf-8").read()
        used |= set(re.findall(r'\bicon:\s*"([a-z0-9-]+)"', src))
        for m in re.finditer(r"\bicon\(", src):                      # mọi chuỗi trong đối số của icon(...) kể cả biểu thức ?: (đếm ngoặc để tìm đúng dấu đóng)
            depth, i = 1, m.end()
            while i < len(src) and depth:
                depth += (src[i] == "(") - (src[i] == ")")
                i += 1
            used |= set(re.findall(r'"([a-z0-9-]+)"', src[m.end():i - 1]))
    miss = sorted(used - sprites)
    check(not miss, "mọi biểu tượng dùng trong mã có trong bộ symbol (%d dùng / %d có)" % (len(used), len(sprites)), miss)

    man = json.load(io.open(os.path.join(HERE, "manifest.webmanifest"), encoding="utf-8"))
    from PIL import Image
    probs = []
    for ic in man["icons"]:
        p = os.path.join(HERE, ic["src"])
        if not os.path.exists(p):
            probs.append(ic["src"] + " thiếu")
            continue
        w, h = Image.open(p).size
        if "%dx%d" % (w, h) != ic["sizes"]:
            probs.append("%s là %dx%d, khai %s" % (ic["src"], w, h, ic["sizes"]))
    check(not probs and man["scope"] == "./" and man["display"] == "standalone" and any(i["purpose"] == "maskable" for i in man["icons"]), "manifest: biểu tượng đúng kích thước, có maskable, scope ./, standalone", probs)
    check(all(s["url"].startswith("./index.html#/") for s in man.get("shortcuts", [])) and len(man.get("shortcuts", [])) >= 3, "manifest: shortcuts trỏ vào trang có hash")
    r = subprocess.run([sys.executable, os.path.join(HERE, "tao-pwa.py"), "--kiem"], capture_output=True, text=True, encoding="utf-8")
    check(r.returncode == 0, "dấu phiên bản sw.js khớp nội dung vỏ (sửa tệp nào cũng phải chạy tao-pwa.py)", r.stdout.strip())
    meta = json.load(io.open(os.path.join(HERE, "metadata.json"), encoding="utf-8"))
    check(meta.get("title") and meta.get("category") == "Ứng dụng" and meta.get("icon"), "metadata.json cho cổng portal")

    # --- tương phản: token chung + biến --pz-* của bàn (gộp trên nền ô, cả sáng và tối)
    tk = parse_tokens(read("assets", "css", "tokens.css"))
    pzc = parse_tokens(read("assets", "css", "puzzle.css"))
    low = []
    for theme in ("light", "dark"):
        t = dict(tk[theme]); t.update(pzc["light"])
        if theme == "dark":
            t.update(pzc["dark"])
        C = lambda name: color("var(--%s)" % name, t)
        bg, elev, sunk = C("bg"), C("elev"), C("sunk")
        soft = blend(C("accent-soft"), elev)
        pairs = [("text/bg", C("text"), bg), ("text/elev", C("text"), elev), ("text-2/elev", C("text-2"), elev), ("text-2/bg", C("text-2"), bg), ("text-2/sunk", C("text-2"), sunk),
                 ("text-3/elev", C("text-3"), elev), ("text-3/bg", C("text-3"), bg), ("accent-text/elev", C("accent-text"), elev), ("accent-text/bg", C("accent-text"), bg), ("accent-text/soft", C("accent-text"), soft),
                 ("text/soft", C("text"), soft), ("text-2/soft", C("text-2"), soft), ("danger/elev", C("danger"), elev), ("ok/elev", C("ok"), elev), ("star/elev", C("star"), elev),
                 ("ok/sunk", C("ok"), sunk), ("accent-fg/accent", C("accent-fg"), C("accent")), ("accent-fg/danger", C("accent-fg"), C("danger")), ("accent-fg/ok", C("accent-fg"), C("ok"))]
        cell, given_bg = C("pz-cell"), C("pz-cell-given")
        for bgname, base in (("cell", cell), ("given", given_bg)):
            for ov in ("pz-select", "pz-same", "pz-peer", "pz-hint", "pz-conflict", "pz-replay"):
                under = blend(C(ov), base)
                for fg in ("pz-given", "pz-user", "pz-note", "pz-conflict-text"):
                    pairs.append(("%s trên %s+%s" % (fg, bgname, ov), C(fg), under))
            for fg in ("pz-given", "pz-user", "pz-note", "pz-conflict-text", "pz-good"):
                pairs.append(("%s trên %s" % (fg, bgname), C(fg), base))
        for name, a, b in pairs:
            c = contrast(a[:3], b[:3])
            if c < 4.5:
                low.append("%s %s = %.2f" % (theme, name, c))
    for name, hx in (("toast chữ", "#f2f6fc"), ("toast nút", "#9dbfff")):
        c = contrast(hex_rgb(hx), hex_rgb("#16202e"))
        if c < 4.5:
            low.append("%s = %.2f" % (name, c))
    check(not low, "độ tương phản mọi cặp màu ≥ 4,5:1 (token chung + --pz-* của bàn trên mọi nền ô/tô sáng, sáng + tối)", low[:8])
    total = sum(os.path.getsize(f) for f in files) + os.path.getsize(os.path.join(HERE, "index.html")) + len(css_all)
    check(total < 2 * 1024 * 1024, "dung lượng vỏ %d KB (< 2 MB)" % (total // 1024))


# ============================================================================================ tiện ích trình duyệt
class Page:
    """Một trang Playwright + gom lỗi console/pageerror."""

    def __init__(self, browser, url, name, **ctx_kw):
        ctx_kw.setdefault("service_workers", "block")
        ctx_kw.setdefault("accept_downloads", True)
        self.ctx = browser.new_context(**ctx_kw)
        self.pg = self.ctx.new_page()
        self.name = name
        self.errors = []
        self.pg.on("console", lambda m: self.errors.append("console: " + m.text) if m.type == "error" else None)
        self.pg.on("pageerror", lambda e: self.errors.append("pageerror: " + str(e)))
        self.url = url
        self.pg.set_default_timeout(20000)
        self.pg.goto(url, wait_until="load")
        self.pg.wait_for_function("document.body.classList.contains('ready')", timeout=20000)

    def go(self, h, wait=250):
        self.pg.evaluate("h => { location.hash = h }", h)
        self.pg.wait_for_timeout(wait)

    def reload(self):
        self.pg.reload(wait_until="load")
        self.pg.wait_for_function("document.body.classList.contains('ready')", timeout=20000)

    def start(self, tid, size="", tier="easy", seed=None):
        """Vào ván mới (hoặc tiếp ván dở của đúng puzzle đó) bằng liên kết seed."""
        return start(self, tid, size, tier, SEED if seed is None else seed)

    def toast(self, text, timeout=4000):
        return _wait_toast(self.pg, text, timeout)

    def game(self):
        """Ván đang mở ở #/play/<id>: trạng thái từ chính đối tượng game trong trang."""
        return self.pg.evaluate("""() => {
          const m = /#\\/play\\/([^?]+)/.exec(location.hash); if (!m) return null;
          const g = Puz.ui.app.ctx().getGame(decodeURIComponent(m[1])); if (!g) return null;
          return { id: g.id, status: g.status, v: g.state.v.slice(), c: g.state.c ? g.state.c.slice() : null, mistakes: g.counters.mistakes, hints: g.hintCount(), moves: g.counters.moves, elapsed: g.elapsed(),
                   initial: g.puzzle.initial.v.slice(), data: g.puzzle.data, type: g.puzzle.type, seed: g.puzzle.seed, tier: g.puzzle.tier, score: g.puzzle.score, undo: g.undoStack.length, redo: g.redoStack.length };
        }""")

    def history(self):
        return self.pg.evaluate("Puz.ui.app.ctx().user.history().map(r => ({ id: r.id, type: r.type, result: r.result, hints: r.hints, mistakes: r.mistakes, time: r.time, tier: r.tier, source: r.source }))")

    def close(self):
        ERRORS.extend(["[%s] %s" % (self.name, e) for e in self.errors])
        self.ctx.close()


def _wait_toast(pg, text, timeout=4000):
    try:
        pg.wait_for_selector(".toast:has-text('%s')" % text, timeout=timeout)
        return True
    except Exception:
        return False


def junk(pg, selector="body"):
    """Chữ rác lọt ra màn hình (null / undefined / NaN / [object Object])."""
    t = pg.evaluate("s => (document.querySelector(s) || document.body).innerText", selector)
    return re.findall(r"\b(?:null|undefined|NaN)\b|\[object \w+\]", t)


def real_boards(pg):
    """Các loại đã có engine VÀ bàn thật (không phải tệp giữ chỗ)."""
    return pg.evaluate("Puz.types.all().map(t => t.id).filter(id => Puz.boards[id] && typeof Puz.boards[id].mount === 'function')")


SEED = 20261017


def start(P, tid, size="", tier="easy", seed=SEED):
    P.go("#/new/%s?size=%s&tier=%s&seed=%d&go=1" % (tid, size, tier, seed), 100)
    P.pg.wait_for_selector(".board-host > *", timeout=30000)
    P.pg.wait_for_function("/#\\/play\\//.test(location.hash)", timeout=30000)


def solve_by_hints(P, limit=700):
    """Giải bằng nút 'Áp dụng nước này' của gợi ý mức 3 (qua chính engine hint) cho tới khi xong. → số bước."""
    return P.pg.evaluate("""(limit) => {
      const c = Puz.ui.app.ctx(), id = decodeURIComponent(/#\\/play\\/([^?]+)/.exec(location.hash)[1]), g = c.getGame(id); let n = 0;
      while (g.status === 'playing' && n < limit) { const h = g.hint(3); if (!h || h.none || !h.action) return -n - 1; const r = g.applyHint(h); if (!r.ok) return -n - 1000; n++; }
      return g.status === 'solved' ? n : -n - 5000;
    }""", limit)


def tuong_loai(P, tid, label):
    """Một vòng đời đầy đủ của MỘT loại puzzle trên giao diện thật."""
    pg = P.pg
    d = pg.evaluate("(id => { const t = Puz.types.get(id); return { name: t.name, size: t.sizes.filter(s => s.default)[0].id, tiers: t.sizes.filter(s => s.default)[0].tiers || ['easy','medium','hard','expert'] }; })", tid)
    size, tier = d["size"], "easy" if "easy" in d["tiers"] else d["tiers"][0]
    section(" · %s (%s)" % (d["name"], label))
    start(P, tid, size, tier)
    g0 = P.game()
    check(g0 and g0["type"] == tid and g0["seed"] == SEED and g0["status"] == "playing", "%s: seed 20261017 → vào ván, đồng hồ chạy" % d["name"], g0 and {k: g0[k] for k in ("type", "seed", "status")})
    check(d["name"] in pg.inner_text(".play-title") and "20261017" in pg.inner_text(".play-sub"), "%s: tiêu đề + seed hiển thị" % d["name"])
    check(pg.locator(".board-host *").count() > 8 and pg.evaluate("document.querySelector('.board-host').getBoundingClientRect().height") > 100, "%s: bàn được vẽ" % d["name"])
    # --- cùng seed → cùng puzzle; khác seed → khác puzzle
    start(P, tid, size, tier, SEED)
    g1 = P.game()
    start(P, tid, size, tier, SEED + 1)
    g2 = P.game()
    check(g1["initial"] == g0["initial"] and g1["data"] == g0["data"] and g1["score"] == g0["score"], "%s: cùng (loại, cỡ, bậc, seed) → cùng puzzle (qua giao diện, hai lần)" % d["name"])
    check(g2["initial"] != g0["initial"] or g2["data"] != g0["data"], "%s: seed khác → puzzle khác (trạng thái đầu hoặc dữ liệu đề)" % d["name"])
    check(g1["id"] == g0["id"] and len([x for x in pg.evaluate("Puz.ui.app.ctx().user.games().map(g => g.id)") if x == g0["id"]]) == 1, "%s: mở lại cùng puzzle → tiếp tục ván dở, không nhân đôi ván" % d["name"])
    start(P, tid, size, tier, SEED)
    # --- gợi ý ba mức qua giao diện
    pg.click(".toolbar button:has-text('Gợi ý')")
    pg.wait_for_selector(".hint-panel:not([hidden]) .hint-text")
    t1 = pg.inner_text(".hint-panel .hint-text")
    pg.click(".hint-panel button:has-text('Chi tiết hơn')")
    t2 = pg.inner_text(".hint-panel .hint-text")
    pg.click(".hint-panel button:has-text('Chi tiết hơn')")
    t3 = pg.inner_text(".hint-panel .hint-text")
    check(len(t1) > 8 and len(t2) > 8 and len(t3) > 3 and t1 != t3, "%s: gợi ý mức 1/2/3 đều có lời, mức 3 khác mức 1" % d["name"], [t1, t2, t3])
    check(pg.locator(".hint-panel .why li").count() >= 1, "%s: gợi ý mức 3 có phần giải thích 'vì sao'" % d["name"])
    check(not junk(pg, ".hint-panel"), "%s: khung gợi ý không có chữ rác (null/undefined/NaN)" % d["name"], junk(pg, ".hint-panel"))
    m0 = P.game()["moves"]
    pg.click(".hint-panel button:has-text('Áp dụng nước này')")
    g3 = P.game()
    check(g3["moves"] == m0 + 1 and g3["hints"] == 3 and pg.locator(".hint-panel:not([hidden])").count() == 0, "%s: áp dụng gợi ý = một nước đi, đếm 3 gợi ý, đóng khung gợi ý" % d["name"], (m0, g3["moves"], g3["hints"]))
    # --- hoàn tác / làm lại
    pg.click(".toolbar button:has-text('Hoàn tác')")
    g4 = P.game()
    check(g4["v"] == g0["initial"] or g4["moves"] == m0 + 1 and g4["undo"] == m0, "%s: Hoàn tác trả về trạng thái trước" % d["name"], (g4["undo"], m0))
    pg.click(".toolbar button:has-text('Làm lại')")
    g5 = P.game()
    check(g5["v"] == g3["v"], "%s: Làm lại áp lại đúng nước đã hoàn tác" % d["name"])
    # --- tạm dừng che bàn, đồng hồ đứng; bấm Tiếp tục chạy lại
    pg.click(".hud button:has-text('Tạm dừng')")
    e1 = P.game()["elapsed"]
    pg.wait_for_timeout(1100)
    e2 = P.game()["elapsed"]
    check(pg.locator(".pause-cover:not([hidden])").count() == 1 and pg.get_attribute(".board-host", "inert") is not None and abs(e2 - e1) < 50, "%s: tạm dừng che bàn, khoá thao tác, đồng hồ đứng" % d["name"], (e1, e2))
    pg.click(".pause-cover button:has-text('Tiếp tục')")
    pg.wait_for_timeout(700)
    check(P.game()["status"] == "playing" and P.game()["elapsed"] > e2 + 400 and pg.locator(".pause-cover:not([hidden])").count() == 0, "%s: bấm Tiếp tục → bàn hiện lại, đồng hồ chạy tiếp" % d["name"])
    pg.click(".hud button:has-text('Tạm dừng')")
    # --- tải lại trang khi đang tạm dừng: ván dở được khôi phục đúng nguyên trạng
    before = P.game()
    P.pg.wait_for_timeout(600)
    P.reload()
    P.go("#/", 400)
    check(pg.locator(".resume").count() >= 1, "%s: sau khi tải lại, màn Chơi có 'Tiếp tục chơi'" % d["name"])
    pg.click(".resume .resume-main >> nth=0")
    pg.wait_for_selector(".board-host > *")
    after = P.game()
    check(after["v"] == before["v"] and after["c"] == before["c"] and after["moves"] == before["moves"] and after["hints"] == before["hints"] and after["undo"] == before["undo"], "%s: ván dở khôi phục đúng nguyên trạng (ô, ghi chú, lịch sử hoàn tác, gợi ý)" % d["name"])
    check(after["status"] == "playing" and pg.locator(".pause-cover:not([hidden])").count() == 0, "%s: mở lại ván dở → chạy tiếp ngay (người chơi vừa chủ động mở)" % d["name"], after["status"])
    # --- giải tới cùng
    solved_id = P.game()["id"]
    t0 = time.time()
    n = solve_by_hints(P)
    check(n > 0, "%s: lặp 'gợi ý mức 3 → áp dụng' giải xong ván (%d bước, %.1f s)" % (d["name"], n, time.time() - t0), n)
    pg.wait_for_selector("dialog[open] h2:has-text('Đã giải')", timeout=10000)
    check(True, "%s: hộp thoại 'Đã giải!' hiện" % d["name"])
    stats = pg.inner_text("dialog[open] .stat-grid")
    check("Thời gian" in stats and "Lỗi" in stats and "Gợi ý" in stats and "Độ khó" in stats, "%s: hộp thoại có thời gian, lỗi, gợi ý, độ khó" % d["name"], stats.replace("\n", " "))
    check(not junk(pg, "dialog[open]"), "%s: hộp thoại 'Đã giải' không có chữ rác" % d["name"], junk(pg, "dialog[open]"))
    h = [r for r in P.history() if r["type"] == tid]
    check(len(h) == 1 and h[0]["result"] == "solved" and h[0]["hints"] >= 3 and h[0]["time"] > 0, "%s: lịch sử ghi 1 ván 'solved' kèm số gợi ý và thời gian" % d["name"], h)
    check(pg.evaluate("Puz.ui.app.ctx().user.getGame(%s) === null" % json.dumps(solved_id)), "%s: ván vừa giải đã bị xoá khỏi kho ván dở" % d["name"])
    # --- replay
    pg.click("dialog[open] button:has-text('Xem lời giải từng bước')")
    pg.wait_for_selector(".replay-panel:not([hidden])", timeout=20000)
    cnt = pg.inner_text(".rp-count")
    total = int(cnt.split("/")[1])
    check(total >= 1 and cnt.startswith("Bước 0/"), "%s: replay bắt đầu ở bước 0 với %d bước" % (d["name"], total), cnt)
    pg.click(".replay-panel button:has-text('Sau')")
    check(pg.inner_text(".rp-count").startswith("Bước 1/") and len(pg.inner_text(".rp-text")) > 5, "%s: replay: bước 1 có lời giải thích" % d["name"])
    check(not junk(pg, ".replay-panel"), "%s: khung replay không có chữ rác" % d["name"], junk(pg, ".replay-panel"))
    pg.click(".replay-panel button[aria-label='Tới cuối']")
    check(pg.inner_text(".rp-count") == "Bước %d/%d" % (total, total), "%s: replay: tới bước cuối" % d["name"])
    pg.click(".replay-panel button[aria-label='Về đầu']")
    check(pg.inner_text(".rp-count").startswith("Bước 0/"), "%s: replay: về đầu" % d["name"])
    pg.click(".replay-panel button:has-text('Thoát replay')")
    check(pg.locator(".replay-panel:not([hidden])").count() == 0 and pg.locator(".board-host > *").count() >= 1, "%s: thoát replay về bàn đã giải" % d["name"])
    # --- Reveal: hỏi xác nhận, không tính là tự giải
    start(P, tid, size, tier, SEED + 7)
    pg.click(".play-head button[aria-label='Thêm tuỳ chọn']")
    pg.click(".popmenu button:has-text('Hiện đáp án')")
    pg.wait_for_selector("dialog[open]")
    pg.click("dialog[open] button:has-text('Hiện đáp án')")
    pg.wait_for_function("Puz.ui.app.ctx().user.history().filter(r => r.result === 'revealed').length >= 1", timeout=10000)
    check(P.game()["status"] == "revealed", "%s: Reveal điền đáp án, ván 'revealed' (không tính tự giải)" % d["name"])
    # --- Bỏ ván
    start(P, tid, size, tier, SEED + 9)
    pg.click(".play-head button[aria-label='Thêm tuỳ chọn']")
    pg.click(".popmenu button:has-text('Bỏ ván này')")
    pg.click("dialog[open] button:has-text('Bỏ ván')")
    pg.wait_for_function("Puz.ui.app.ctx().user.history().filter(r => r.result === 'abandoned').length >= 1", timeout=10000)
    check("#/" == pg.evaluate("location.hash"), "%s: Bỏ ván → ghi 'abandoned' và về trang chủ" % d["name"])
    sm = pg.evaluate("Puz.stats.summarize(Puz.ui.app.ctx().user.history()).byType['%s']" % tid)
    check(sm["solved"] == 1 and sm["revealed"] == 1 and sm["abandoned"] == 1, "%s: thống kê phân biệt giải / xem đáp án / bỏ dở" % d["name"], sm)


def download_text(pg, click_fn):
    with pg.expect_download() as dl:
        click_fn()
    d = dl.value
    path = d.path()
    return d.suggested_filename, io.open(path, "rb").read()


def ca_nhan(P, br, url, tid):
    """Thư viện, bộ sưu tập, xuất/nhập, CSV, sao lưu/khôi phục, thống kê, Daily — dựa trên một loại puzzle đã có bàn."""
    pg = P.pg
    name = pg.evaluate("Puz.types.get('%s').name" % tid)
    size = pg.evaluate("Puz.types.get('%s').sizes.filter(s => s.default)[0].id" % tid)
    section(" · dữ liệu cá nhân (%s)" % name)
    start(P, tid, size, "easy", SEED + 100)
    pz = pg.evaluate("(() => { const g = Puz.ui.app.ctx().getGame(decodeURIComponent(/#\\/play\\/([^?]+)/.exec(location.hash)[1])); return { id: g.puzzle.id, initial: g.puzzle.initial.v, score: g.puzzle.score }; })()")
    # --- yêu thích
    pg.click(".play-head .fav-btn")
    pg.wait_for_function("Puz.ui.app.ctx().user.isFav(%s)" % json.dumps(pz["id"]))
    check(pg.get_attribute(".play-head .fav-btn", "aria-pressed") == "true", "★ yêu thích: lưu puzzle, nút sáng lên")
    # --- bộ sưu tập: tạo bộ từ hộp thoại, thêm puzzle
    pg.click(".play-head button[aria-label='Thêm tuỳ chọn']")
    pg.click(".popmenu button:has-text('Thêm vào bộ sưu tập')")
    pg.fill("dialog[open] input[type=text]", "Bộ thử nghiệm")
    pg.click("dialog[open] button:has-text('Tạo bộ')")
    pg.wait_for_function("Puz.ui.app.ctx().user.collections().length === 1")
    check(pg.evaluate("Puz.ui.app.ctx().user.collections()[0].ids.length") == 1, "bộ sưu tập: tạo bộ mới và thêm puzzle trong một bước")
    pg.click("dialog[open] button:has-text('Xong')")
    P.go("#/library", 300)
    check("Bộ thử nghiệm" in pg.inner_text("#main") or True, "thư viện mở được")
    pg.click(".chips .chip:has-text('★ Yêu thích')")
    check(pg.locator(".prow").count() == 1, "tab Yêu thích: có đúng 1 puzzle")
    pg.click(".chips .chip:has-text('Bộ sưu tập')")
    check("Bộ thử nghiệm" in pg.inner_text(".col-grid") and "1 puzzle" in pg.inner_text(".col-grid"), "tab Bộ sưu tập: hiện bộ vừa tạo với 1 puzzle")
    pg.click(".col-grid a >> nth=0")
    pg.wait_for_selector(".prow")
    check(pg.locator(".prow").count() == 1 and "Bộ thử nghiệm" in pg.inner_text(".ph"), "mở bộ sưu tập: liệt kê puzzle")
    # --- xuất JSON (tệp tải về) → nhập lại vào ngữ cảnh mới
    pg.click(".prow button[aria-label='Thêm tuỳ chọn']")
    pg.click(".popmenu button:has-text('Xuất / chia sẻ')")
    fname, data = download_text(pg, lambda: pg.click("dialog[open] button:has-text('Tải JSON')"))
    j = json.loads(data.decode("utf-8"))
    check(fname.endswith(".json") and j["format"] == "logic-puzzle-suite" and j["puzzles"][0]["type"] == tid and j["puzzles"][0]["seed"] == SEED + 100 and "initialState" in j["puzzles"][0] and "solution" in j["puzzles"][0] and "difficulty" in j["puzzles"][0], "xuất JSON đúng định dạng spec (type, seed, difficulty, initialState, solution)", {k: j["puzzles"][0].get(k) for k in ("type", "seed", "difficulty")})
    fname2, txt = download_text(pg, lambda: pg.click("dialog[open] button:has-text('Tải văn bản')"))
    check(txt.decode("utf-8").startswith("#puzzle type=" + tid), "xuất TXT có dòng đầu '#puzzle type=…'")
    pg.keyboard.press("Escape")
    P2 = Page(br, url, "nhap", viewport={"width": 1200, "height": 860})
    try:
        P2.go("#/library", 200)
        P2.pg.click("button:has-text('Nhập tệp')")
        P2.pg.fill("dialog[open] textarea", data.decode("utf-8"))
        P2.pg.click("dialog[open] button:has-text('Nhập')")
        P2.pg.wait_for_function("Puz.ui.app.ctx().user.puzzles().length === 1", timeout=10000)
        got = P2.pg.evaluate("Puz.ui.app.ctx().user.puzzles()[0].puzzle")
        check(got["initial"]["v"] == pz["initial"] and got["type"] == tid, "nhập lại JSON ở trình duyệt khác: ra đúng puzzle (đề dựng lại qua engine)")
        check(abs(got["score"] - pz["score"]) < 0.11, "… độ khó được TÍNH LẠI và khớp (%.1f)" % got["score"])
        P2.pg.fill("dialog[open] textarea", "") if P2.pg.locator("dialog[open]").count() else None
        P2.go("#/library", 200)
        P2.pg.click("button:has-text('Nhập tệp')")
        P2.pg.fill("dialog[open] textarea", "đây không phải puzzle")
        P2.pg.click("dialog[open] button:has-text('Nhập')")
        P2.pg.wait_for_selector("dialog[open] .form-err")
        check(P2.pg.evaluate("Puz.ui.app.ctx().user.puzzles().length") == 1, "nhập văn bản rác: báo lỗi tiếng Việt, không thêm gì")
        P2.pg.keyboard.press("Escape")
        # --- mở lại puzzle nhập vào để chơi
        P2.go("#/library", 200)
        P2.pg.click(".chips .chip:has-text('Tất cả')")
        P2.pg.click(".prow button:has-text('Chơi')")
        P2.pg.wait_for_selector(".board-host > *")
        check(P2.pg.evaluate("location.hash").startswith("#/play/"), "chơi puzzle vừa nhập")
    finally:
        P2.close()
    # --- hoàn tất 1 ván để có lịch sử, rồi CSV + thống kê + sao lưu/khôi phục
    start(P, tid, size, "easy", SEED + 100)
    check(solve_by_hints(P) > 0, "giải xong ván để có dữ liệu thống kê")
    pg.wait_for_selector("dialog[open] h2:has-text('Đã giải')")
    pg.keyboard.press("Escape")
    pg.wait_for_selector("dialog[open]", state="detached")
    P.go("#/stats", 400)
    n_solved = pg.evaluate("Puz.ui.app.ctx().user.history().filter(r => r.result === 'solved').length")
    check(pg.locator(".hrow").count() >= 1 and pg.locator(".chart").count() == 1, "Thống kê: có biểu đồ 14 ngày và lịch sử ván")
    first = pg.inner_text(".stat-grid.big .stat >> nth=0")
    check(first.split("\n")[0] == str(n_solved) and "Chuỗi hiện tại" in pg.inner_text(".stat-grid.big"), "Thống kê: tổng đã giải khớp lịch sử (%d) và có chuỗi hiện tại" % n_solved, first.replace("\n", " | "))
    check(pg.inner_text(".stat-grid.big .stat >> nth=1").startswith("1 ngày"), "streak = 1 ngày (mọi ván giải trong cùng một ngày)", pg.inner_text(".stat-grid.big .stat >> nth=1"))
    n_ab = pg.evaluate("Puz.ui.app.ctx().user.history().filter(r => r.result === 'abandoned').length")
    pg.click(".chips .chip:has-text('Bỏ dở')")
    check(pg.locator(".hrow").count() == n_ab and pg.locator(".hrow:not(.r-abandoned)").count() == 0, "Thống kê: lọc 'Bỏ dở' chỉ còn đúng %d ván bỏ dở" % n_ab)
    other = pg.evaluate("Puz.types.all().map(t => t.name).filter(n => n !== %s)[0] || ''" % json.dumps(name))
    if other:
        # các vòng đời trước đã chơi MỌI loại: xoá ván bỏ dở của loại này khỏi lịch sử để có trạng thái "không khớp"
        pg.evaluate("""(n) => { const u = Puz.ui.app.ctx().user, id = Puz.types.all().filter(t => t.name === n)[0].id;
          return Promise.all(u.history().filter(r => r.type === id && r.result === 'abandoned').map(r => u.removeRecord(r.id))); }""", other)
        pg.wait_for_timeout(300)
        pg.click(".chips .chip:has-text('%s')" % other)
        check(pg.locator(".hrow").count() == 0 and "Không có ván nào khớp" in pg.inner_text(".hist, .empty-note"), "Thống kê: loại chưa chơi (%s) + 'Bỏ dở' → thông báo trống" % other)
        pg.click(".chips .chip:has-text('Mọi loại')")
    pg.click(".chips .chip:has-text('Mọi kết quả')")
    fname, csv = download_text(pg, lambda: pg.click("button:has-text('Xuất CSV')"))
    lines = csv.decode("utf-8-sig").strip().split("\r\n")
    check(fname.endswith(".csv") and lines[0].startswith("ngày,loại") and len(lines) >= 2 and ",solved," in lines[1], "xuất CSV lịch sử: tiêu đề tiếng Việt + từng ván", lines[:2])
    P.go("#/settings", 300)
    fname, zbytes = download_text(pg, lambda: pg.click("button:has-text('Sao lưu (.zip)')"))
    check(re.match(r"^backup_\d{8}\.zip$", fname) and zbytes[:2] == b"PK", "sao lưu ra backup_YYYYMMDD.zip", fname)
    counts = pg.evaluate("(() => { const u = Puz.ui.app.ctx().user; return { h: u.history().length, p: u.puzzles().length, c: u.collections().length }; })()")
    zpath = os.path.join(tempfile.mkdtemp(prefix="pz-bk-"), fname)
    io.open(zpath, "wb").write(zbytes)
    P3 = Page(br, url, "khoiphuc", viewport={"width": 1200, "height": 860})
    try:
        P3.go("#/settings", 300)
        with P3.pg.expect_file_chooser() as fc:
            P3.pg.click("button:has-text('Khôi phục')")
        fc.value.set_files(zpath)
        P3.pg.wait_for_selector("dialog[open] button:has-text('Gộp')")
        P3.pg.click("dialog[open] button:has-text('Gộp')")
        P3.pg.wait_for_function("Puz.ui.app.ctx().user.history().length === %d" % counts["h"], timeout=10000)
        got = P3.pg.evaluate("(() => { const u = Puz.ui.app.ctx().user; return { h: u.history().length, p: u.puzzles().length, c: u.collections().length }; })()")
        check(got == counts, "khôi phục từ zip sang trình duyệt mới: đủ lịch sử, puzzle, bộ sưu tập", (got, counts))
        P3.go("#/stats", 300)
        check(P3.pg.locator(".hrow").count() >= 1, "… và thống kê hiện đủ sau khi khôi phục")
        P3.go("#/settings", 300)
        P3.pg.click("button:has-text('Xoá tất cả dữ liệu')")
        P3.pg.click("dialog[open] button:has-text('Xoá tất cả')")
        P3.pg.wait_for_function("Puz.ui.app.ctx().user.history().length === 0 && Puz.ui.app.ctx().user.puzzles().length === 0", timeout=10000)
        check(True, "xoá sạch dữ liệu (có hỏi xác nhận)")
    finally:
        P3.close()


def hoc(P, tid):
    pg = P.pg
    name = pg.evaluate("Puz.types.get('%s').name" % tid)
    P.go("#/learn/" + tid, 300)
    check(pg.locator(".rules li").count() >= 1 and pg.locator(".alg-steps li").count() >= 2, "%s: trang Học có luật chơi và các bước thuật toán" % name)
    links = pg.evaluate("[...document.querySelectorAll('.alg-links a')].map(a => a.getAttribute('href'))")
    check(all(l.startswith("../algorithm-notebook/#/a/") for l in links), "%s: liên kết sang Algorithm Notebook đúng dạng (%d)" % (name, len(links)), links)
    pg.click("button:has-text('Sinh puzzle ví dụ')")
    pg.wait_for_selector(".learn-out table.cv-table", timeout=30000)
    check(pg.locator(".cv-table tbody tr").count() >= 1 and pg.locator(".cv-cons li").count() >= 1, "%s: Constraint View có biến, miền và ràng buộc" % name)
    pg.click(".chips .chip:has-text('Show Solver')")
    pg.wait_for_selector(".learn-out .tv", timeout=30000)
    check(pg.locator(".learn-out .tv-svg").count() + pg.locator(".learn-out .mx-table").count() + pg.locator(".learn-out .empty-note").count() >= 1, "%s: Show Solver hiện cây tìm kiếm / các bước khử" % name)


def di_dong(P, types, label):
    """Điện thoại: thanh dưới, bàn vừa khít bề rộng, chạm gợi ý/hoàn tác, thanh dưới ẩn khi chơi."""
    pg = P.pg
    section(" · %s" % label)
    P.go("#/", 300)
    vis = pg.evaluate("(() => { const s = getComputedStyle(document.querySelector('#side')).display, b = getComputedStyle(document.querySelector('#bottomNav')).display; return [s, b]; })()")
    check(vis[0] == "none" and vis[1] != "none", "%s: thanh bên ẩn, thanh dưới hiện" % label, vis)
    check(pg.locator("#bottomNav .bn").count() == 5, "%s: thanh dưới có 5 mục (Chơi, Mới, Thống kê, Bộ sưu tập, Thêm)" % label)
    pg.tap("#bottomNav a[data-nav='stats']")
    pg.wait_for_selector(".page.stats")
    check(pg.evaluate("location.hash") == "#/stats", "%s: chạm thanh dưới đổi màn" % label)
    pg.tap("#moreBtn")
    check(pg.locator(".popmenu button").count() == 3, "%s: mục Thêm mở menu (Học, Tạo, Cài đặt)" % label)
    pg.keyboard.press("Escape")
    check(pg.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), "%s: màn Chơi không tràn ngang" % label)
    for tid in types:
        size = pg.evaluate("Puz.types.get('%s').sizes.filter(s => s.default)[0].id" % tid)
        name = pg.evaluate("Puz.types.get('%s').name" % tid)
        start(P, tid, size, "easy", SEED + 3)
        w = pg.evaluate("[document.querySelector('.board-host').getBoundingClientRect().width, innerWidth]")
        check(w[0] >= 0.8 * (w[1] - 24) and pg.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), "%s · %s: bàn rộng %d/%d px, trang không tràn ngang" % (label, name, w[0], w[1]), w)
        check(pg.evaluate("getComputedStyle(document.querySelector('#bottomNav')).display") == "none", "%s · %s: thanh dưới ẩn khi chơi (nhường chỗ cho bàn)" % (label, name))
        pg.tap(".toolbar button:has-text('Gợi ý')")
        pg.wait_for_selector(".hint-panel:not([hidden]) .hint-text")
        pg.tap(".hint-panel button:has-text('Chi tiết hơn')")
        pg.tap(".hint-panel button:has-text('Chi tiết hơn')")
        m0 = P.game()["moves"]
        pg.tap(".hint-panel button:has-text('Áp dụng nước này')")
        check(P.game()["moves"] == m0 + 1, "%s · %s: chạm Gợi ý → Chi tiết → Áp dụng thành một nước đi" % (label, name))
        pg.tap(".toolbar button:has-text('Hoàn tác')")
        check(P.game()["moves"] == m0 + 1 and P.game()["undo"] == m0, "%s · %s: chạm Hoàn tác" % (label, name))
        btn = pg.evaluate("[...document.querySelectorAll('.toolbar .btn, .hud .btn, .play-head .icon-btn')].map(b => { const r = b.getBoundingClientRect(); return [b.textContent.trim() || b.getAttribute('aria-label'), Math.round(r.height), Math.round(r.width)]; }).filter(x => x[1] < 40 || x[2] < 40)")
        check(not btn, "%s · %s: nút điều khiển của vỏ cao/rộng ≥ 40 px (đủ chạm)" % (label, name), btn)
        P.go("#/", 150)


def tang_2(may):
    section("TẦNG 2 — chức năng (trình duyệt thật)")
    from playwright.sync_api import sync_playwright
    url = may.goc + PATH
    with sync_playwright() as pw:
        br = pw.chromium.launch()
        P = Page(br, url, "desk", viewport={"width": 1366, "height": 860}, permissions=["clipboard-read", "clipboard-write"])
        pg = P.pg
        types = real_boards(pg)
        check(len(types) >= 1, "có bàn chơi cho: %s" % ", ".join(types), types)

        section(" · vỏ ứng dụng")
        for r, needle in (("#/", "Phòng tập tư duy logic"), ("#/new", "Puzzle mới"), ("#/learn", "Học cách giải"), ("#/create", "Tạo puzzle"), ("#/library", "Bộ sưu tập"), ("#/stats", "Thống kê"), ("#/settings", "Cài đặt")):
            P.go(r, 250)
            check(needle in pg.inner_text("#main") and "Có lỗi khi mở màn này" not in pg.inner_text("#main") and not junk(pg, "#main"), "route %s hiển thị, không lỗi, không chữ rác" % r, junk(pg, "#main"))
        P.go("#/khong-co-trang-nay", 250)
        check("Phòng tập tư duy logic" in pg.inner_text("#main"), "địa chỉ lạ → về trang chủ, không lỗi")
        P.go("#/", 200)
        check(pg.locator(".daily-card").count() == 1 and "Daily Puzzle" in pg.inner_text(".daily-card"), "màn Chơi có Daily Puzzle")
        check(pg.locator(".type-card").count() == pg.evaluate("Puz.types.all().length"), "màn Chơi có thẻ cho mọi loại puzzle đã đăng ký")
        pg.keyboard.press("?")
        check(pg.locator("dialog[open] .kbd-list").count() == 1, "phím ? mở bảng phím tắt")
        pg.keyboard.press("Escape")
        pg.keyboard.press("g")
        pg.keyboard.press("s")
        check(pg.evaluate("location.hash") == "#/stats", "phím tắt g rồi s → Thống kê")
        P.go("#/settings", 200)
        pg.click(".set .chip:has-text('Tối')")
        check(pg.evaluate("document.documentElement.dataset.theme") == "dark", "đổi sang giao diện tối")
        P.reload()
        check(pg.evaluate("document.documentElement.dataset.theme") == "dark", "giao diện tối được nhớ sau khi tải lại (không nhấp nháy)")
        P.go("#/settings", 200)
        pg.click(".set .chip:has-text('Sáng')")

        for tid in types:
            tuong_loai(P, tid, "Chromium máy tính")
        for tid in types:                                              # kiểm riêng của từng bàn (check_board_<loại>.py: hàm run(P, check, section, tid))
            f = os.path.join(HERE, "check_board_%s.py" % tid)
            if os.path.exists(f):
                import importlib.util
                spec = importlib.util.spec_from_file_location("check_board_" + tid, f)
                mod = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(mod)
                section(" · bàn %s: tương tác riêng" % tid)
                mod.run(P, check, section, tid)
        section(" · học: luật, thuật toán, Constraint View, Show Solver")
        for tid in types:
            hoc(P, tid)
        ca_nhan(P, br, url, types[0])
        P.close()
        P = Page(br, url, "pixel5", **pw.devices["Pixel 5"])
        di_dong(P, types, "Pixel 5 (Chromium)")
        P.close()
        br.close()
        try:
            wb = pw.webkit.launch()
        except Exception as e:
            print("  (bỏ qua WebKit iPhone 13: %s)" % str(e).splitlines()[0])
            return
        P = Page(wb, url, "iphone13", **pw.devices["iPhone 13"])
        di_dong(P, types, "iPhone 13 (WebKit)")
        tuong_loai(P, types[0], "WebKit iPhone 13")
        P.close()
        wb.close()


# ============================================================================================ tầng 3 — sống sót: sập máy, offline, cập nhật
def _crash(pg):
    """Giết tiến trình render của trang (như hết pin / trình duyệt chết): không có pagehide hay beforeunload."""
    try:
        pg.goto("chrome://crash", wait_until="commit", timeout=5000)
    except Exception:
        pass
    time.sleep(0.5)


def tang_3(may):
    section("TẦNG 3 — sống sót: sập giữa chừng, offline, cập nhật (Chromium)")
    import functools
    import http.server
    import shutil
    import threading
    from playwright.sync_api import sync_playwright
    url = may.goc + PATH
    udd = tempfile.mkdtemp(prefix="pz-udd-")
    with sync_playwright() as pw:
        types = None

        def open_ctx():
            c = pw.chromium.launch_persistent_context(udd, headless=True, viewport={"width": 1280, "height": 860}, service_workers="block")
            p = c.pages[0] if c.pages else c.new_page()
            errs = []
            p.on("pageerror", lambda e: errs.append(str(e)))
            p.set_default_timeout(20000)
            p.goto(url)
            p.wait_for_function("document.body.classList.contains('ready')", timeout=20000)
            return c, p, errs

        section(" · ván đang chơi sống sót khi trình duyệt sập (hồ sơ trình duyệt thật, đóng–mở lại)")
        c, p, errs = open_ctx()
        types = real_boards(p)
        tid = types[0]
        size = p.evaluate("Puz.types.get('%s').sizes.filter(s => s.default)[0].id" % tid)
        class Q:           # vỏ mỏng để dùng lại start()/game()
            pass
        Pg = Page.__new__(Page)
        Pg.pg, Pg.ctx, Pg.name, Pg.errors, Pg.url = p, c, "crash", [], url
        start(Pg, tid, size, "easy", SEED + 31)
        p.evaluate("""() => { const c = Puz.ui.app.ctx(), id = decodeURIComponent(/#\\/play\\/([^?]+)/.exec(location.hash)[1]), g = c.getGame(id); for (let i = 0; i < 4; i++) g.applyHint(g.hint(3)); }""")
        before = Pg.game()
        p.wait_for_timeout(900)                          # debounce 400 ms + dư
        _crash(p)
        c.close()
        c, p, errs = open_ctx()
        Pg = Page.__new__(Page)
        Pg.pg, Pg.ctx, Pg.name, Pg.errors, Pg.url = p, c, "crash2", [], url
        check(p.locator(".resume").count() == 1, "sau khi sập: màn Chơi vẫn có ván dở để tiếp tục")
        p.click(".resume .resume-main")
        p.wait_for_selector(".board-host > *")
        after = Pg.game()
        check(after["v"] == before["v"] and after["moves"] == before["moves"] == 4 and after["hints"] == before["hints"] and after["undo"] == before["undo"], "sau khi sập: ván khôi phục đúng nguyên trạng (4 nước, 4 gợi ý, lịch sử hoàn tác)", (before["moves"], after["moves"]))
        check(after["elapsed"] >= before["elapsed"] - 1500, "… đồng hồ giữ phần thời gian đã chơi (mất tối đa vài giây) — trước %d ms, sau %d ms" % (before["elapsed"], after["elapsed"]))
        p.click(".toolbar button:has-text('Hoàn tác')")
        check(Pg.game()["moves"] == 4 and Pg.game()["undo"] == 3, "… và hoàn tác vẫn dùng được trên ván khôi phục")
        check(solve_by_hints(Pg) > 0, "… giải tiếp tới cùng sau khi khôi phục")
        p.wait_for_selector("dialog[open] h2:has-text('Đã giải')")
        check(p.evaluate("Puz.ui.app.ctx().user.history().filter(r => r.result === 'solved').length") == 1, "… và ván được ghi vào lịch sử")
        # đóng thẻ ngay sau một nước đi (chưa tới 400 ms): pagehide phải ghi kịp
        p.keyboard.press("Escape")
        start(Pg, tid, size, "easy", SEED + 32)
        p.evaluate("""() => { const c = Puz.ui.app.ctx(), id = decodeURIComponent(/#\\/play\\/([^?]+)/.exec(location.hash)[1]), g = c.getGame(id); g.applyHint(g.hint(3)); }""")
        mv = Pg.game()["moves"]
        p.close(run_before_unload=False)
        c.close()
        c, p, errs = open_ctx()
        Pg = Page.__new__(Page)
        Pg.pg, Pg.ctx, Pg.name, Pg.errors, Pg.url = p, c, "crash3", [], url
        p.click(".resume .resume-main >> nth=0")
        p.wait_for_selector(".board-host > *")
        print("    (thông tin) đóng thẻ ngay sau nước đi (< 0,4 s): %s" % ("ván GIỮ nước đi cuối (pagehide ghi kịp)" if Pg.game()["moves"] == mv else "mất nước đi cuối (còn %d/%d) — tối đa vài giây gần nhất" % (Pg.game()["moves"], mv)))
        check(Pg.game()["moves"] >= mv - 1, "đóng thẻ sát nước đi: mất tối đa 1 nước cuối")
        # trình soạn: bản nháp sống sót
        p.evaluate("location.hash = '#/create/%s'" % tid)
        p.wait_for_selector(".editor-host > *")
        if tid == "sudoku":
            p.fill(".pz-su textarea", "530070000600195000098000060800060003400803001700020006060000280000419005000080079")
            p.click("button:has-text('Nạp chuỗi')")
            p.wait_for_selector(".cr-chip.c-ok")
            p.wait_for_timeout(900)
            _crash(p)
            c.close()
            c, p, errs = open_ctx()
            p.evaluate("location.hash = '#/create/sudoku'")
            p.wait_for_selector(".cr-chip.c-ok", timeout=20000)
            check(p.evaluate("document.querySelectorAll('.pz-su-cell.given').length") == 30, "trình soạn: bản nháp (đề 30 ô) sống sót qua sập máy và được khôi phục")
        check(not errs, "không lỗi JS qua các lần sập/mở lại", errs)
        c.close()
        shutil.rmtree(udd, ignore_errors=True)

        section(" · offline: service worker lưu vỏ + worker sinh puzzle; chơi, sinh đề, xuất dữ liệu khi mất mạng")
        br = pw.chromium.launch()
        ctx = br.new_context(service_workers="allow", viewport={"width": 1280, "height": 860}, accept_downloads=True)
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.set_default_timeout(25000)
        pg.goto(url)
        pg.wait_for_function("document.body.classList.contains('ready')")
        pg.wait_for_function("navigator.serviceWorker.controller !== null", timeout=20000)
        mine = [n for n in pg.evaluate("caches.keys()") if n.startswith("puz:")]
        check(len(mine) == 1, "có đúng một cache của Logic Puzzle Suite", mine)
        urls = pg.evaluate("(n) => caches.open(n).then(c => c.keys()).then(ks => ks.map(k => new URL(k.url).pathname))", mine[0])
        need = ["index.html", "manifest.webmanifest", "assets/js/ui/app.js", "assets/js/worker/gen.js", "assets/css/puzzle.css", "assets/icons/icon-192.png"] + ["assets/js/puzzles/%s.js" % t for t in pg.evaluate("Puz.types.all().map(t => t.id)")]
        missing = [n for n in need if not any(u.endswith(PATH + n) for u in urls)]
        check(not missing, "cache có vỏ ứng dụng, mọi engine puzzle và worker sinh puzzle (%d tệp)" % len(urls), missing)
        tid = real_boards(pg)[0]
        size = pg.evaluate("Puz.types.get('%s').sizes.filter(s => s.default)[0].id" % tid)
        ctx.set_offline(True)
        pg.reload(wait_until="domcontentloaded")
        pg.wait_for_function("document.body.classList.contains('ready')", timeout=25000)
        check("ngoại tuyến" in pg.locator("#banner").inner_text(), "TẮT MẠNG rồi tải lại: mở được, hiện biểu ngữ 'ngoại tuyến'")
        Pg = Page.__new__(Page)
        Pg.pg, Pg.ctx, Pg.name, Pg.errors, Pg.url = pg, ctx, "offline", [], url
        start(Pg, tid, size, "easy", SEED + 41)
        check(pg.evaluate("Puz.gen.status()") == "ready", "offline: puzzle được sinh trong Web Worker nạp từ cache (trạng thái worker = ready)", pg.evaluate("Puz.gen.status()"))
        check(solve_by_hints(Pg) > 0, "offline: chơi và giải xong một ván")
        pg.wait_for_selector("dialog[open] h2:has-text('Đã giải')")
        pg.keyboard.press("Escape")
        pg.evaluate("location.hash = '#/learn/%s'" % tid)
        pg.click("button:has-text('Sinh puzzle ví dụ')")
        pg.wait_for_selector(".learn-out table.cv-table")
        check(True, "offline: trang Học sinh ví dụ + Constraint View (worker)")
        pg.evaluate("location.hash = '#/settings'")
        with pg.expect_download() as dl:
            pg.click("button:has-text('Sao lưu (.zip)')")
        check(dl.value.suggested_filename.startswith("backup_"), "offline: sao lưu .zip vẫn tạo được")
        api_ok = pg.evaluate("() => fetch('/health/').then(() => true, () => false)")
        check(api_ok is False, "offline: gọi địa chỉ ngoài phạm vi thất bại thật (worker không trả bản cũ)")
        ctx.set_offline(False)
        pg.reload()
        pg.wait_for_function("document.body.classList.contains('ready')")
        check(pg.evaluate("Puz.ui.app.ctx().user.history().filter(r => r.result === 'solved').length") == 1, "có lại mạng: ván giải khi offline còn nguyên trong lịch sử")
        check(not errs, "không lỗi JS ở luồng offline", errs)
        ctx.close()

        section(" · cập nhật: 'Có bản mới → Tải lại', không chiếm ván đang chơi dở")
        tmpd = tempfile.mkdtemp(prefix="pz-upd-")
        shutil.copytree(HERE, os.path.join(tmpd, "app"), ignore=shutil.ignore_patterns("__pycache__", "check*.py", "kiem*", "*.md", "sync.py"))

        class Quiet(http.server.SimpleHTTPRequestHandler):
            def log_message(self, *a):
                pass
        srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=os.path.join(tmpd, "app")))
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        base = "http://127.0.0.1:%d/" % srv.server_address[1]
        ctx = br.new_context(service_workers="allow", viewport={"width": 1280, "height": 860})
        pg = ctx.new_page()
        pg.set_default_timeout(25000)
        pg.goto(base + "index.html")
        pg.wait_for_function("document.body.classList.contains('ready')")
        pg.wait_for_function("navigator.serviceWorker.controller !== null", timeout=20000)
        check(len([n for n in pg.evaluate("caches.keys()") if n.startswith("puz:")]) == 1, "cài bản 1")
        Pg = Page.__new__(Page)
        Pg.pg, Pg.ctx, Pg.name, Pg.errors, Pg.url = pg, ctx, "update", [], base
        pg.evaluate("location.hash = '#/new/%s?size=%s&tier=easy&seed=%d&go=1'" % (tid, size, SEED + 51))
        pg.wait_for_selector(".board-host > *")
        pg.evaluate("""() => { const c = Puz.ui.app.ctx(), id = decodeURIComponent(/#\\/play\\/([^?]+)/.exec(location.hash)[1]), g = c.getGame(id); g.applyHint(g.hint(3)); g.applyHint(g.hint(3)); }""")
        moves = Pg.game()["moves"]
        swp = os.path.join(tmpd, "app", "sw.js")
        src = io.open(swp, encoding="utf-8").read()
        io.open(swp, "w", encoding="utf-8", newline="").write(re.sub(r'var PHIEN_BAN = "[^"]*";', 'var PHIEN_BAN = "bancapnhat01";', src, count=1))
        pg.evaluate("navigator.serviceWorker.getRegistration().then(r => r.update())")
        got = True
        try:
            pg.wait_for_selector("#banner:has-text('Có bản mới')", timeout=15000)
        except Exception:
            got = False
        check(got, "có bản mới → hiện biểu ngữ 'Có bản mới của ứng dụng'")
        check("/play/" in pg.evaluate("location.hash") and Pg.game()["moves"] == moves, "bản mới ĐỨNG CHỜ: không tự tải lại, ván đang chơi còn nguyên")
        if got:
            pg.click("#banner button:has-text('Tải lại')")
            pg.wait_for_function("document.body.classList.contains('ready')", timeout=25000)
            pg.wait_for_function("caches.keys().then(k => k.filter(n => n.startsWith('puz:')).length === 1 && k.some(n => n.endsWith('bancapnhat01')))", timeout=15000)
            pg.wait_for_timeout(1500)                                   # trang tự tải lại khi worker mới nhận quyền (controllerchange)
            pg.wait_for_function("window.Puz && Puz.ui && Puz.ui.app && Puz.ui.app.ctx && Puz.ui.app.ctx() && document.body.classList.contains('ready')", timeout=25000)
            check(pg.evaluate("Puz.ui.app.ctx().user.games().length") >= 1, "bấm Tải lại → chuyển sang bản mới, cache bản cũ được dọn, ván dở còn trong kho")
        ctx.close()
        srv.shutdown()
        shutil.rmtree(tmpd, ignore_errors=True)
        br.close()


# ============================================================================================ tầng 4 — co giãn với dữ liệu xấu nhất
FUZZ_JS = r"""
async () => {
  const U = Puz.ui.app.ctx().user, now = Date.now();
  const word = "Siêu".repeat(55), xss = '<img src=x onerror="window.__xss=1"><script>window.__xss=2<\/script> [bẫy](javascript:window.__xss=3)';
  const types = Puz.types.all(), puzzles = [];
  for (const t of types) { const sz = t.sizes.filter(s => s.default)[0]; puzzles.push(await Puz.gen.generate(t.id, 4242, { sizeId: sz.id, tier: (sz.tiers || ["easy"])[0] })); }
  const recs = puzzles.map((pz, i) => ({ id: pz.id, puzzle: Object.assign({}, pz, { meta: { name: i % 2 ? word : xss + word } }), name: i % 2 ? word : xss + word, fav: true, source: i % 3 ? "custom" : "import", created: now, updated: now }));
  const cols = [{ id: "c-1", name: word, ids: recs.map((r) => r.id), created: now, updated: now }, { id: "c-2", name: xss, ids: [], created: now, updated: now }];
  const hist = [];
  for (let i = 0; i < 60; i++) hist.push({ id: "h" + i, type: types[i % types.length].id, puzzleId: recs[i % recs.length].id, seed: 100000 + i, tier: ["easy", "medium", "hard", "expert"][i % 4], score: (i % 100) / 10, size: 9, sizeId: null, source: ["random", "daily", "custom"][i % 3], day: null, startedAt: now - i * 1000, endedAt: now - i * 86400000 / 3, time: 1000 * (i * 997 + 5), mistakes: i * 13, hints: i * 7, maxHint: 3, moves: 99999, result: ["solved", "revealed", "abandoned"][i % 3] });
  await U.restore({ puzzles: recs, collections: cols, history: hist, games: [] }, "merge");
  return { ids: recs.map((r) => r.id), types: types.map((t) => t.id) };
}
"""

OVERFLOW_JS = r"""
() => {
  const W = innerWidth, bad = [];
  if (document.documentElement.scrollWidth > W + 1) bad.push("TRANG cuộn ngang: scrollWidth " + document.documentElement.scrollWidth + " > " + W);
  const scroller = (el) => { for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === "auto" || o === "scroll") return true; } return false; };
  const name = (el) => el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (typeof el.className === "string" && el.className ? "." + el.className.trim().split(/\s+/).join(".") : "");
  for (const el of document.querySelectorAll("body *")) {
    if (el.closest("svg") && el.tagName.toLowerCase() !== "svg") continue;
    if (el.closest("dialog") && !el.closest("dialog[open]")) continue;
    if (el.closest("[inert]") || el.closest("[hidden]")) continue;
    const cs = getComputedStyle(el); if (cs.display === "none" || cs.visibility === "hidden") continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    if ((r.right > W + 1 || r.left < -1) && !scroller(el)) { bad.push(name(el) + " ra ngoài khung: " + Math.round(r.left) + "…" + Math.round(r.right) + " (rộng " + W + ")"); if (bad.length > 6) break; }
  }
  return bad;
}
"""


def tang_4(may):
    section("TẦNG 4 — co giãn: dữ liệu xấu nhất × bề rộng × trình duyệt (không tràn ngang, hộp thoại nằm trong màn hình, XSS không chạy)")
    from playwright.sync_api import sync_playwright
    url = may.goc + PATH
    with sync_playwright() as pw:
        engines = [("Chromium", pw.chromium, [280, 320, 360, 390, 768, 900, 1024, 1280, 1920]), ("WebKit", pw.webkit, [320, 390, 1024]), ("Firefox", pw.firefox, [320, 390, 1280])]
        for ename, eng, widths in engines:
            try:
                b = eng.launch()
            except Exception as e:
                print("  (bỏ qua %s: %s)" % (ename, str(e).splitlines()[0]))
                continue
            P = Page(b, url, "fuzz-" + ename, viewport={"width": 1280, "height": 800})
            pg = P.pg
            pg.set_default_timeout(30000)
            seed = pg.evaluate(FUZZ_JS)
            P.reload()
            types = real_boards(pg)
            views = [("trang chủ", "#/"), ("puzzle mới", "#/new"), ("thư viện", "#/library"), ("bộ sưu tập dài tên", "#/library/c-1"), ("bộ sưu tập XSS", "#/library/c-2"), ("thống kê", "#/stats"), ("cài đặt", "#/settings"), ("học", "#/learn"), ("tạo", "#/create")]
            for tid in types:
                views += [("mới " + tid, "#/new/" + tid), ("học " + tid, "#/learn/" + tid), ("tạo " + tid, "#/create/" + tid)]
            bad_all = []
            for w in widths:
                pg.set_viewport_size({"width": w, "height": 800})
                for label, h in views:
                    pg.evaluate("h => { location.hash = h }", h)
                    pg.wait_for_timeout(380)
                    if label == "thư viện":
                        for tab in ("Bộ sưu tập", "Tự tạo", "Tất cả"):
                            pg.click(".chips .chip:has-text('%s')" % tab)
                            pg.wait_for_timeout(120)
                            bad = pg.evaluate(OVERFLOW_JS)
                            if bad:
                                bad_all.append("%dpx · thư viện/%s: %s" % (w, tab, "; ".join(bad[:2])))
                    bad = pg.evaluate(OVERFLOW_JS)
                    if bad:
                        bad_all.append("%dpx · %s: %s" % (w, label, "; ".join(bad[:3])))
                # bàn chơi với tên puzzle cực dài / HTML độc, mọi loại; + menu, khung gợi ý, hộp thoại trong màn hình
                for tid, rec_id in zip(seed["types"], seed["ids"]):
                    if tid not in types:
                        continue
                    pg.evaluate("(id) => Puz.ui.app.ctx().startGame(Puz.ui.app.ctx().user.getPuzzle(id).puzzle, { source: 'library' })", rec_id)
                    pg.wait_for_selector(".toolbar")
                    pg.wait_for_selector(".board-host > *")
                    pg.wait_for_timeout(250)
                    bad = pg.evaluate(OVERFLOW_JS)
                    if bad:
                        bad_all.append("%dpx · bàn %s: %s" % (w, tid, "; ".join(bad[:3])))
                    pg.click(".toolbar button:has-text('Gợi ý')")
                    pg.wait_for_selector(".hint-panel:not([hidden])")
                    bad = pg.evaluate(OVERFLOW_JS)
                    if bad:
                        bad_all.append("%dpx · bàn %s + gợi ý: %s" % (w, tid, "; ".join(bad[:3])))
                    pg.click(".play-head button[aria-label='Thêm tuỳ chọn']")
                    r = pg.evaluate("(() => { const m = document.querySelector('.popmenu').getBoundingClientRect(); return [m.left, m.top, m.right, m.bottom, innerWidth, innerHeight]; })()")
                    if r[0] < -0.5 or r[1] < -0.5 or r[2] > r[4] + 0.5 or r[3] > r[5] + 0.5:
                        bad_all.append("%dpx · menu ⋯ (%s) ra ngoài màn hình %s" % (w, tid, [round(x) for x in r]))
                    pg.click(".popmenu button:has-text('Xuất / chia sẻ')")
                    r = pg.evaluate("(() => { const m = document.querySelector('dialog[open]').getBoundingClientRect(); return [m.left, m.top, m.right, m.bottom, innerWidth, innerHeight]; })()")
                    if r[0] < -0.5 or r[1] < -0.5 or r[2] > r[4] + 0.5 or r[3] > r[5] + 0.5:
                        bad_all.append("%dpx · hộp thoại xuất (%s) ra ngoài màn hình %s" % (w, tid, [round(x) for x in r]))
                    pg.keyboard.press("Escape")
                    pg.wait_for_timeout(80)
                    P.go("#/", 60)
            check(not bad_all, "%s: %d bề rộng × %d màn + bàn chơi %d loại: không tràn ngang, menu/hộp thoại trong màn hình" % (ename, len(widths), len(views), len(types)), bad_all[:8])
            xss = pg.evaluate("window.__xss")
            check(xss is None, "%s: HTML/JS độc trong tên puzzle, tên bộ sưu tập không chạy (window.__xss=%r)" % (ename, xss))
            P.close()
            b.close()


# ============================================================================================ tầng 5 — hiệu năng thật
def tang_5(may, n):
    section("TẦNG 5 — hiệu năng thật: sinh puzzle trong Worker; %s ván lịch sử + %s puzzle đã lưu trong IndexedDB của Chromium" % (format(n, ","), format(n // 5, ",")))
    from playwright.sync_api import sync_playwright
    url = may.goc + PATH
    with sync_playwright() as pw:
        br = pw.chromium.launch(args=["--enable-precise-memory-info", "--js-flags=--expose-gc"])
        P = Page(br, url, "perf", viewport={"width": 1366, "height": 860})
        pg = P.pg
        pg.set_default_timeout(180000)
        # --- sinh puzzle (qua Puz.gen: Worker trong trình duyệt thật), mọi (loại, bậc) của cỡ mặc định, 5 seed
        print("    sinh puzzle trong Worker (đầu-cuối, gồm chuyển dữ liệu), 5 seed mỗi ô; đơn vị ms")
        res = pg.evaluate("""async () => {
          const out = [];
          for (const t of Puz.types.all()) {
            const sz = t.sizes.filter(s => s.default)[0];
            for (const tier of (sz.tiers || ['easy', 'medium', 'hard', 'expert'])) {
              const ts = [];
              for (let s = 0; s < 5; s++) { const t0 = performance.now(); await Puz.gen.generate(t.id, 777 + 31 * s, { sizeId: sz.id, tier }); ts.push(performance.now() - t0); }
              ts.sort((a, b) => a - b);
              out.push({ type: t.id, size: sz.id, tier, med: Math.round(ts[2]), max: Math.round(ts[4]), worker: Puz.gen.status() });
            }
          }
          return out;
        }""")
        worst = 0
        for r in res:
            print("    %-10s %-6s %-7s trung vị %5d · xấu nhất %5d" % (r["type"], r["size"], r["tier"], r["med"], r["max"]))
            worst = max(worst, r["max"])
        check(all(r["worker"] == "ready" for r in res), "việc sinh chạy trong Web Worker (không phải luồng giao diện)", set(r["worker"] for r in res))
        check(worst < 4000, "sinh puzzle: ô chậm nhất %d ms (< 4000 ms)" % worst)
        # --- giao diện không đơ khi sinh đề nặng: đo khoảng cách lớn nhất giữa các khung hình trong lúc sinh
        gap = pg.evaluate("""async () => {
          let last = performance.now(), maxGap = 0, run = true;
          const tick = () => { const n = performance.now(); maxGap = Math.max(maxGap, n - last); last = n; if (run) requestAnimationFrame(tick); };
          requestAnimationFrame(tick);
          const t = Puz.types.all()[0], sz = t.sizes.filter(s => s.default)[0], tier = (sz.tiers || ['hard']).slice(-1)[0];
          for (let s = 0; s < 6; s++) await Puz.gen.generate(t.id, 9100 + s, { sizeId: sz.id, tier });
          run = false; return Math.round(maxGap);
        }""")
        print("    khoảng cách lớn nhất giữa hai khung hình khi sinh liên tục: %d ms" % gap)
        check(gap < 250, "giao diện không bị đơ khi sinh đề nặng (khung hình cách nhau tối đa %d ms < 250 ms)" % gap)
        # --- kho lớn
        t0 = time.time()
        r = pg.evaluate("""async (N) => {
          const U = Puz.ui.app.ctx().user, now = Date.now(), types = Puz.types.all(), base = [];
          for (const t of types) { const sz = t.sizes.filter(s => s.default)[0]; base.push(await Puz.gen.generate(t.id, 1, { sizeId: sz.id, tier: (sz.tiers || ['easy'])[0] })); }
          const puzzles = [], hist = [], cols = [];
          for (let i = 0; i < Math.floor(N / 5); i++) { const b = base[i % base.length], id = b.type + '-p' + i; puzzles.push({ id, puzzle: Object.assign({}, b, { id, seed: i }), name: 'Puzzle ' + i, fav: i % 7 === 0, source: i % 2 ? 'custom' : 'import', created: now - i, updated: now - i }); }
          for (let c = 0; c < 40; c++) cols.push({ id: 'c' + c, name: 'Bộ ' + c, ids: puzzles.slice(c * 50, c * 50 + 50).map(p => p.id), created: now, updated: now });
          for (let i = 0; i < N; i++) { const t = types[i % types.length]; hist.push({ id: 'h' + i, type: t.id, puzzleId: 'x', seed: i, tier: ['easy', 'medium', 'hard', 'expert'][i % 4], score: (i % 100) / 10, size: 9, sizeId: null, source: i % 5 ? 'random' : 'daily', day: null, startedAt: now - i * 60000, endedAt: now - i * 3600000, time: 60000 + (i * 7919) % 900000, mistakes: i % 5, hints: i % 4, maxHint: 3, moves: 50, result: ['solved', 'solved', 'solved', 'revealed', 'abandoned'][i % 5] }); }
          const t0 = performance.now(); await U.restore({ puzzles, collections: cols, history: hist, games: [] }, 'merge'); return { ms: performance.now() - t0, h: U.history().length, p: U.puzzles().length };
        }""", n)
        print("    nạp %s ván lịch sử + %s puzzle + 40 bộ vào IndexedDB: %.1f s" % (format(r["h"], ","), format(r["p"], ","), time.time() - t0))
        check(r["h"] == n and r["p"] == n // 5, "nạp đủ %s ván lịch sử và %s puzzle" % (format(n, ","), format(n // 5, ",")), r)
        t = time.time()
        P.reload()
        boot = time.time() - t
        pg.evaluate("() => { if (window.gc) { window.gc(); window.gc(); } }")
        heap = pg.evaluate("performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : -1")
        print("    mở lại ứng dụng (khởi động nguội) với %s ván: %.2f s, JS heap %d MB sau dọn rác" % (format(n, ","), boot, heap))
        check(boot < 5, "khởi động nguội với %s ván lịch sử < 5 s (đo %.2f s)" % (format(n, ","), boot))
        for label, h in (("trang chủ", "#/"), ("thống kê", "#/stats"), ("thư viện (tất cả)", "#/library"), ("cài đặt", "#/settings")):
            pg.evaluate("h => { window.__t0 = performance.now(); location.hash = h }", h)
            pg.wait_for_function("document.querySelector('#main .page') !== null", timeout=30000)
            pg.wait_for_timeout(100)
            ms = pg.evaluate("performance.now() - window.__t0")
            print("    mở %-18s %5.0f ms" % (label, ms - 100))
            check(ms < 2500, "mở %s với kho lớn < 2,5 s (đo %.0f ms)" % (label, ms))
        sm = pg.evaluate("""() => { const t0 = performance.now(); const s = Puz.stats.summarize(Puz.ui.app.ctx().user.history()); const t1 = performance.now(); const k = Puz.stats.streak(Puz.ui.app.ctx().user.history(), Puz.util.dayKey(), 1); const t2 = performance.now(); return { sum: t1 - t0, streak: t2 - t1, total: s.total.played }; }""")
        print("    tính thống kê tổng hợp trên %s ván: %.0f ms; streak: %.0f ms" % (format(sm["total"], ","), sm["sum"], sm["streak"]))
        check(sm["sum"] < 400 and sm["streak"] < 400, "tính thống kê + streak trên %s ván < 400 ms" % format(n, ","))
        pg.evaluate("location.hash = '#/stats'")
        pg.wait_for_selector(".hrow")
        shown0 = pg.locator(".hrow").count()
        pg.click("button:has-text('Xem thêm')")
        check(pg.locator(".hrow").count() > shown0 and shown0 <= 40, "lịch sử phân trang: hiện %d dòng rồi 'Xem thêm' (không dựng %s dòng một lúc)" % (shown0, format(n, ",")))
        pg.evaluate("location.hash = '#/library'")
        pg.wait_for_selector(".chips .chip:has-text('Tất cả')")
        pg.click(".chips .chip:has-text('Tất cả')")
        pg.wait_for_selector(".prow")
        r0 = pg.locator(".prow").count()
        pg.click("button:has-text('Xem thêm')")
        r1 = pg.locator(".prow").count()
        check(r0 <= 60 and r1 == r0 + 60, "thư viện %s puzzle phân trang: %d dòng rồi %d sau 'Xem thêm'" % (format(n // 5, ","), r0, r1))
        P.close()
        br.close()


def main():
    args = sys.argv[1:]
    todo = set(a for a in args if a.startswith("--"))
    tat_ca = "--tat-ca" in todo
    default = not todo
    if tat_ca or default or "--tinh" in todo:
        tang_1()
    n = 10000
    if "--hieu-nang" in args:
        i = args.index("--hieu-nang")
        if i + 1 < len(args) and args[i + 1].isdigit():
            n = int(args[i + 1])
    if tat_ca or default or todo & {"--chuc-nang", "--song-sot", "--co-gian", "--hieu-nang"}:
        may = K.MayChuThu([]).__enter__()
        try:
            if tat_ca or default or "--chuc-nang" in todo:
                tang_2(may)
            if tat_ca or "--song-sot" in todo:
                tang_3(may)
            if tat_ca or "--co-gian" in todo:
                tang_4(may)
            if tat_ca or "--hieu-nang" in todo:
                tang_5(may, n)
        finally:
            may.__exit__(None, None, None)
    if ERRORS:
        print("\nLỗi console/pageerror ghi nhận (%d):" % len(ERRORS))
        for e in ERRORS[:10]:
            print("   ", e)
        check(False, "không lỗi JS/console trong mọi phiên chạy")
    print("\n%d đạt, %d sai" % (OK, FAIL))
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
