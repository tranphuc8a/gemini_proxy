# -*- coding: utf-8 -*-
"""Tài liệu markdown dài sinh TẤT ĐỊNH cho các phép đo/kiểm Markdown Editor Pro.

Bản Python của `tasks/2610/261023/cai-tien-webapp/nhap/perf-md/mkdoc.mjs` (pha thiết kế perf-md), ra **từng byte giống**
bản JS — cùng hạt giống LCG, cùng thứ tự rút số ngẫu nhiên — nên số đo ở thiết kế (§2.1 perf-md.md) và số đo của
`kiem-hieu-nang.py` dùng đúng một tài liệu. `MAU_SHA256` ghim mã băm; `tu_kiem()` khẳng định lại mỗi lần chạy.

Nội dung: heading, đoạn văn Việt/Anh có đậm/nghiêng/code/link, danh sách/việc cần làm, bảng 3–5 cột, khối code 8 ngôn
ngữ, toán inline `$…$` + khối `$$…$$`, trích dẫn, ảnh https (`img.example.test`, phép đo trả PNG giả) + 1 ảnh data URL,
mermaid thưa.

    python _tai_lieu_thu.py <thư-mục>      # ghi doc-2k.md, doc-10k.md, doc-30k.md, wiki-12k.md
"""
from __future__ import annotations

import hashlib
import os
import re
import sys

WORDS_VI = 'thuật toán dữ liệu cấu trúc đồ thị đường đi ngắn nhất độ phức tạp bộ nhớ đệm hàng đợi ưu tiên cây nhị phân tìm kiếm cân bằng quy hoạch động tham lam chia để trị kiểm thử hiệu năng máy chủ trình duyệt giao diện người dùng đồng bộ ghi chú tài liệu phiên bản'.split(' ')
WORDS_EN = 'the quick brown fox jumps over lazy dog latency throughput cache invalidation render pipeline virtual scroll worker thread incremental parse block hash memo frame budget'.split(' ')


def _ts(r):
    return [f'export function solve{int(r() * 999)}(input: number[]): number {{', '  let best = -Infinity', '  for (const value of input) {',
            '    // keep the running maximum', '    best = Math.max(best, value * 2 - 1)', '  }', '  return best === -Infinity ? 0 : best', '}', '',
            'const cache = new Map<string, number>()', 'console.log(solve([1, 2, 3]), cache.size, `done ${Date.now()}`)']


def _python(r):
    return [f'def dijkstra_{int(r() * 999)}(graph, src):', '    import heapq', '    dist = {src: 0}', '    pq = [(0, src)]', '    while pq:',
            '        d, u = heapq.heappop(pq)', '        if d > dist.get(u, float("inf")):', '            continue', '        for v, w in graph[u]:',
            '            nd = d + w', '            if nd < dist.get(v, float("inf")):', '                dist[v] = nd', '                heapq.heappush(pq, (nd, v))',
            '    return dist  # O((V + E) log V)']


def _cpp(r):
    return ['#include <bits/stdc++.h>', 'using namespace std;', f'int main{int(r() * 9)}() {{', '    ios::sync_with_stdio(false);', '    int n; cin >> n;',
            '    vector<long long> a(n);', '    for (auto &x : a) cin >> x;', '    sort(a.begin(), a.end());', '    long long ans = 0;',
            '    for (int i = 0; i < n; ++i) ans += a[i] * (i + 1);', '    cout << ans << "\\n";', '    return 0;', '}']


def _bash(r):
    return ['#!/usr/bin/env bash', 'set -euo pipefail', 'for f in *.md; do', '  wc -l "$f"', 'done | sort -n | tail -5', 'echo "total: $(cat *.md | wc -c)"']


def _json(r):
    return ['{', f'  "id": {int(r() * 99999)},', '  "name": "benchmark",', '  "tags": ["perf", "markdown", "editor"],',
            '  "nested": { "ok": true, "ratio": 0.75, "list": [1, 2, 3] }', '}']


def _sql(r):
    return ['SELECT u.id, u.name, COUNT(o.id) AS orders', 'FROM users u', 'LEFT JOIN orders o ON o.user_id = u.id', "WHERE u.created_at >= '2026-01-01'",
            'GROUP BY u.id, u.name', 'HAVING COUNT(o.id) > 3', 'ORDER BY orders DESC', 'LIMIT 20;']


def _go(r):
    return ['package main', '', 'import "fmt"', '', 'func main() {', '\tch := make(chan int, 4)',
            '\tgo func() { for i := 0; i < 4; i++ { ch <- i * i }; close(ch) }()', '\tfor v := range ch {', '\t\tfmt.Println(v)', '\t}', '}']


def _rust(r):
    return ['fn main() {', '    let v: Vec<u64> = (1..=10).map(|x| x * x).collect();', '    let s: u64 = v.iter().sum();', '    println!("{:?} {}", v, s);', '}']


# Thứ tự khoá phải giống `Object.keys(LANGS)` của bản JS (pick theo chỉ số).
LANGS = {'ts': _ts, 'python': _python, 'cpp': _cpp, 'bash': _bash, 'json': _json, 'sql': _sql, 'go': _go, 'rust': _rust}
LANG_NAMES = list(LANGS)
MERMAID = [
    ['flowchart LR', '  A[Gõ phím] --> B{Debounce?}', '  B -->|có| C[Parse khối đổi]', '  B -->|không| D[Chờ]', '  C --> E[Vá DOM]', '  E --> F[Khung hình kế]'],
    ['sequenceDiagram', '  participant U as Người dùng', '  participant E as Editor', '  participant W as Worker', '  U->>E: input', '  E->>W: blocks changed',
     '  W-->>E: html', '  E-->>U: paint'],
    ['graph TD', '  root --> a', '  root --> b', '  a --> c', '  a --> d', '  b --> e', '  e --> f'],
]
PNG_DATA = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAJElEQVR42mNkYPj/n4GBgYGJAQoYGRn+MzAwMDCgCzCiCzAwAABL4wQGR4l3lQAAAABJRU5ErkJggg=='
_BO_DAU = re.compile(r'[.*`$\[\]()]')

# (tên, số dòng, hạt giống, mermaid mỗi bao nhiêu dòng, cắt còn bao nhiêu ký tự)
TAI_LIEU = {
    'doc-2k': (2000, 7, 1000, None),
    'doc-10k': (10000, 11, 2000, None),
    'doc-30k': (30000, 13, 3000, None),
    'wiki-12k': (9000, 17, 99999, 480000),
}

# SHA-256 của bản UTF-8 do `mkdoc.mjs` gốc sinh ra (node 24, 23/10/2026). Đổi bộ sinh ⇒ số đo không còn so được với mốc.
MAU_SHA256 = {
    'doc-2k': '845f02c039df61331dbe61fd49b65ea6c6f61d4b2d0237247d8542ca3836d040',
    'doc-10k': 'f93b4de0bb5826af86d2f85667ee73c67cb40cc3cc8a71948447b8639e6ce818',
    'doc-30k': '8021052f75ac2a2c3e4e39634d76770bc38048b8337dd5360f9f3b8af7040d25',
    'wiki-12k': '9dd8ada68f3ae95c913d14171810f2b9e74ed0a503960e6795c2c63d37c33e4b',
}


def _rng(seed: int):
    s = seed & 0xFFFFFFFF

    def r() -> float:
        nonlocal s
        s = (s * 1664525 + 1013904223) & 0xFFFFFFFF
        return s / 4294967296

    return r


def _make(target_lines: int, seed: int, mermaid_every: int) -> str:
    r = _rng(seed)

    def pick(a):
        return a[int(r() * len(a))]

    def sentence(n: int) -> str:
        out = [pick(WORDS_VI) if r() < 0.7 else pick(WORDS_EN) for _ in range(n)]
        s = ' '.join(out)
        s = s[0].upper() + s[1:]
        if r() < 0.35:
            s += f' **{pick(WORDS_VI)} {pick(WORDS_VI)}**'
        if r() < 0.25:
            s += f' *{pick(WORDS_EN)}*'
        if r() < 0.3:
            s += f' `{pick(WORDS_EN)}()`'
        if r() < 0.2:
            s += f' [liên kết](https://example.com/{pick(WORDS_EN)})'
        if r() < 0.15:
            s += ' công thức $O(n \\log n)$ và $a_i^2 + b_i^2 = c_i^2$'
        return s + '.'

    lines: list[str] = []
    sec = 0
    next_mermaid = mermaid_every // 2
    data_img = False
    while len(lines) < target_lines:
        sec += 1
        lines += [f'## {sec}. ' + _BO_DAU.sub('', sentence(4))[:60], '']
        blocks = 6 + int(r() * 6)
        b = 0
        while b < blocks and len(lines) < target_lines:
            k = r()
            if len(lines) >= next_mermaid:
                lines += ['```mermaid', *pick(MERMAID), '```', '']
                next_mermaid += mermaid_every
            elif k < 0.32:
                n = 2 + int(r() * 4)
                for _ in range(n):
                    lines.append(sentence(10 + int(r() * 14)))
                lines.append('')
            elif k < 0.45:
                n = 3 + int(r() * 6)
                task = r() < 0.3
                ordered = (not task) and r() < 0.3
                for i in range(n):
                    if task:
                        mark = f"- [{'x' if r() < 0.5 else ' '}] "
                    elif ordered:
                        mark = f'{i + 1}. '
                    else:
                        mark = '- '
                    lines.append(mark + sentence(6 + int(r() * 8)))
                    if r() < 0.2:
                        lines.append('  - ' + sentence(5))
                lines.append('')
            elif k < 0.55:
                cols = 3 + int(r() * 3)
                rows = 4 + int(r() * 6)
                lines.append('| ' + ' | '.join(f'Cột {i + 1}' for i in range(cols)) + ' |')
                lines.append('|' + '|'.join(':---' if i == 0 else '---:' if i == cols - 1 else ':---:' for i in range(cols)) + '|')
                for _ in range(rows):
                    cells = []
                    for _c in range(cols):
                        cells.append(str(int(r() * 10000)) if r() < 0.3 else f'{pick(WORDS_VI)} {pick(WORDS_EN)}')
                    lines.append('| ' + ' | '.join(cells) + ' |')
                lines.append('')
            elif k < 0.72:
                lang = pick(LANG_NAMES)
                lines += ['```' + lang, *LANGS[lang](r), '```', '']
            elif k < 0.78:
                lines += ['$$', f'\\sum_{{i=1}}^{{{int(r() * 100)}}} \\frac{{x_i^2}}{{\\sqrt{{1 + y_i}}}} = \\int_0^1 f(t)\\,dt', '$$', '']
            elif k < 0.84:
                a = '> ' + sentence(12)
                lines += [a, '> ' + sentence(9), '']
            elif k < 0.88:
                if not data_img:
                    lines += [f'![ảnh nhúng]({PNG_DATA})', '']
                    data_img = True
                else:
                    lines += [f'![hình {sec}-{b}](https://img.example.test/{sec}-{b}.png)', '']
            elif k < 0.92:
                lines += [f'### {sec}.{b} ' + _BO_DAU.sub('', sentence(3))[:50], '']
            else:
                lines += ['---', '']
            b += 1
    return '\n'.join(lines[:target_lines]) + '\n'


_cache: dict[str, str] = {}


def sinh(ten: str) -> str:
    """Nội dung tài liệu `ten` (doc-2k, doc-10k, doc-30k, wiki-12k) — luôn giống nhau từng byte."""
    if ten not in _cache:
        n, seed, every, cat = TAI_LIEU[ten]
        md = _make(n, seed, every)
        _cache[ten] = md[:cat] if cat else md
    return _cache[ten]


def sha256(md: str) -> str:
    return hashlib.sha256(md.encode('utf-8')).hexdigest()


def thong_ke(md: str) -> dict:
    return {
        'dong': md.count('\n'), 'kb': round(len(md.encode('utf-8')) / 1024), 'ky_tu': len(md),
        'khoi_code': len(re.findall(r'^```', md, re.M)) // 2, 'mermaid': len(re.findall(r'^```mermaid', md, re.M)),
        'toan_khoi': len(re.findall(r'^\$\$$', md, re.M)) // 2, 'bang': len(re.findall(r'^\|(:---|---)', md, re.M)),
        'tieu_de': len(re.findall(r'^#{2,3} ', md, re.M)), 'anh': md.count('!['),
    }


def tu_kiem(ten_list=None) -> list[str]:
    """Trả danh sách lỗi (rỗng = đạt): mã băm khớp bản JS gốc, sinh hai lần ra cùng kết quả."""
    loi = []
    for ten in ten_list or ('doc-2k', 'doc-10k'):
        md = sinh(ten)
        h = sha256(md)
        if h != MAU_SHA256[ten]:
            loi.append(f'{ten}: sha256 {h[:12]}… ≠ mẫu {MAU_SHA256[ten][:12]}… (bộ sinh đã lệch khỏi mkdoc.mjs)')
        _cache.pop(ten, None)
        if sinh(ten) != md:
            loi.append(f'{ten}: sinh lần hai ra kết quả khác')
    return loi


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else '.'
    os.makedirs(out, exist_ok=True)
    for ten in TAI_LIEU:
        md = sinh(ten)
        with open(os.path.join(out, ten + '.md'), 'w', encoding='utf-8', newline='\n') as f:
            f.write(md)
        print(ten, sha256(md) == MAU_SHA256[ten], thong_ke(md))
