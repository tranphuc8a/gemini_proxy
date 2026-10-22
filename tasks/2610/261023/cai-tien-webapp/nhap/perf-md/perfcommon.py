# -*- coding: utf-8 -*-
"""Phần dùng chung cho các phép đo trình duyệt (Edge thật qua Playwright)."""
import json
import os
import socket
import struct
import subprocess
import sys
import time
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = r"C:\Users\tranphuc8a\Desktop\gemini_proxy"


def png(w, h, rgb=(91, 91, 214)):
    raw = b"".join(b"\x00" + bytes(rgb) * w for _ in range(h))
    def chunk(t, d):
        c = struct.pack(">I", len(d)) + t + d
        return c + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")


IMG = png(400, 200)


def free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


def serve(directory):
    port = free_port()
    proc = subprocess.Popen([sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1", "--directory", directory],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(50):
        try:
            socket.create_connection(("127.0.0.1", port), timeout=0.2).close()
            break
        except OSError:
            time.sleep(0.1)
    return proc, port


# Bộ quan sát cài trước khi trang chạy: long task, event timing (độ trễ input→khung hình kế), đếm khung hình.
OBSERVERS = r"""
(() => {
  window.__lt = []; window.__ev = [];
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt.push({s: e.startTime, d: e.duration}); }).observe({type: 'longtask', buffered: true}); } catch (e) {}
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__ev.push({n: e.name, s: e.startTime, d: e.duration, id: e.interactionId || 0, ps: e.processingStart, pe: e.processingEnd}); }).observe({type: 'event', durationThreshold: 16, buffered: true}); } catch (e) {}
  window.__frames = null;
  window.__startFrames = () => { window.__frames = []; let last = performance.now(); const loop = (t) => { if (!window.__frames) return; window.__frames.push(t - last); last = t; requestAnimationFrame(loop); }; requestAnimationFrame(loop); };
  window.__stopFrames = () => { const f = window.__frames || []; window.__frames = null; return f; };
})();
"""


def pct(values, p):
    if not values:
        return 0
    v = sorted(values)
    k = min(len(v) - 1, max(0, int(round(p / 100 * (len(v) - 1)))))
    return v[k]


def summarize_frames(frames):
    frames = frames[1:] if len(frames) > 1 else frames
    return {"frames": len(frames), "p50": round(pct(frames, 50), 1), "p95": round(pct(frames, 95), 1), "max": round(max(frames) if frames else 0, 1),
            "janky_gt50": sum(1 for f in frames if f > 50), "dropped_gt33": sum(1 for f in frames if f > 33)}


def summarize_lt(lts, t0, t1):
    xs = [x for x in lts if x["s"] >= t0 and x["s"] <= t1]
    return {"count": len(xs), "total_ms": round(sum(x["d"] for x in xs)), "max_ms": round(max([x["d"] for x in xs] or [0]))}


def key_latency(evs, t0, t1):
    """Độ trễ mỗi lượt gõ = max duration của các event cùng interactionId (keydown/keypress/input/keyup) — giống INP."""
    by = {}
    for e in evs:
        if e["s"] < t0 or e["s"] > t1:
            continue
        if e["n"] not in ("keydown", "keypress", "keyup", "input", "beforeinput"):
            continue
        k = e["id"] or (e["n"], round(e["s"]))
        by[k] = max(by.get(k, 0), e["d"])
    vals = list(by.values())
    return vals


def heap(cdp):
    try:
        cdp.send("HeapProfiler.collectGarbage")
    except Exception:
        pass
    m = {x["name"]: x["value"] for x in cdp.send("Performance.getMetrics")["metrics"]}
    return {"heapMB": round(m.get("JSHeapUsedSize", 0) / 1048576, 1), "nodes": int(m.get("Nodes", 0)), "layoutCount": int(m.get("LayoutCount", 0)),
            "layoutMs": round(m.get("LayoutDuration", 0) * 1000), "styleMs": round(m.get("RecalcStyleDuration", 0) * 1000), "scriptMs": round(m.get("ScriptDuration", 0) * 1000), "taskMs": round(m.get("TaskDuration", 0) * 1000)}


def dump(name, data):
    os.makedirs(os.path.join(HERE, "out"), exist_ok=True)
    with open(os.path.join(HERE, "out", name), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
