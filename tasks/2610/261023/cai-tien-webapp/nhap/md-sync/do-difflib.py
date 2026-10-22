"""Tốc độ difflib.SequenceMatcher (stdlib) để tạo delta dòng cho lịch sử phiên bản, tài liệu ~1 MB."""
import difflib
import hashlib
import json
import random
import time
import zlib

random.seed(1)
WORDS = ("Hệ thống đồng bộ tài liệu phiên bản xung đột máy chủ trình duyệt ghi chú thuật toán cấu trúc dữ liệu "
         "the quick brown fox jumps over lazy dog markdown editor revision cursor tombstone").split()


def line():
    return " ".join(random.choice(WORDS) for _ in range(random.randint(4, 17)))


lines = []
size = 0
while size < 1_000_000:
    s = line()
    lines.append(s)
    size += len(s.encode()) + 1
text = "\n".join(lines)


def hunks(a, b):
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    return [[i1, i2 - i1, b[j1:j2]] for tag, i1, i2, j1, j2 in sm.get_opcodes() if tag != "equal"]


def apply(a, hs):
    out = list(a)
    for o, d, ins in reversed(hs):
        out[o:o + d] = ins
    return out


def bench(label, new_lines):
    t = time.perf_counter()
    hs = hunks(lines, new_lines)
    ms = (time.perf_counter() - t) * 1000
    ok = apply(lines, hs) == new_lines
    body = json.dumps(hs, ensure_ascii=False)
    print(f"{label}: {len(hs)} hunk, delta {len(body.encode())} B, zlib {len(zlib.compress(body.encode()))} B, {ms:.0f} ms, đúng={ok}")


one = list(lines)
one[len(one) // 3] += " (sửa)"
bench("sửa 1 dòng", one)
ten = list(lines)
for i in random.sample(range(len(ten)), 10):
    ten[i] = line()
bench("sửa 10 dòng rải rác", ten)
heavy = [line() if random.random() < 0.3 else l for l in lines]
bench("thay 30% dòng", heavy)
t = time.perf_counter()
h = hashlib.sha256(text.encode()).hexdigest()
print(f"sha256 1 MB (hashlib): {(time.perf_counter() - t) * 1000:.1f} ms; zlib cả văn bản: {len(zlib.compress(text.encode()))} B / {len(text.encode())} B")
