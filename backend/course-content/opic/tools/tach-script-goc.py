# -*- coding: utf-8 -*-
"""BUOC 1 — tach hai tep script goc (script.md, script-2.md) thanh parsed.json.

    python tools/tach-script-goc.py [thu-muc-chua-script.md]   # mac dinh C:/Users/tranphuc8a/Desktop/opic

Cong cu MOT LAN: da dung de dung content/scripts/. Tu do content/ la nguon su that;
chay lai se GHI DE moi chinh sua tay trong content/scripts/ (buoc 2). Chi dung khi
muon tach lai tu dau tu mot ban script.md moi.
"""
import re, json, os, sys
SRC = sys.argv[1] if len(sys.argv) > 1 else r"C:/Users/tranphuc8a/Desktop/opic"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "parsed.json")

ABBR = ("Dr", "Mr", "Mrs", "Ms", "St", "vs", "e.g", "i.e")
def split_sentences(text):
    text = re.sub(r"\s+", " ", text).strip()
    # protect abbreviations
    for a in ABBR:
        text = text.replace(a + ". ", a + ".\u0001")
    parts = re.split(r"(?<=[^.][.!?])\s+(?=[A-Z\"“‘'(])", text)
    parts = [p.replace("\u0001", " ").strip() for p in parts if p.strip()]
    return parts

def norm(s):
    return (s.replace("\u2019", "'").replace("\u2018", "'")
             .replace("\u201c", '"').replace("\u201d", '"').replace("\u00a0", " "))

# ---------------------------------------------------------------- set A
def parse_a():
    lines = open(os.path.join(SRC, "script.md"), encoding="utf-8").read().split("\n")
    out, topic, cur, para, paras = [], None, None, [], []
    def flush_para():
        nonlocal para
        if para:
            paras.append(" ".join(para)); para = []
    def flush_q():
        nonlocal cur, paras
        flush_para()
        if cur:
            sents = []
            for p in paras:
                p = p.strip()
                if re.match(r"^\(.*\)$", p):
                    sents.append(p)          # chi dan san khau
                else:
                    sents.extend(split_sentences(p))
            cur["cau"] = sents
            out.append(cur)
        cur, paras = None, []
    for raw in lines:
        line = norm(raw.rstrip())
        if line.startswith("<!--"): continue
        m = re.match(r"^(?:##\s+)?CHỦ ĐỀ\s+(\d+):\s*(.+)$", line)
        if m:
            flush_q(); topic = (int(m.group(1)), m.group(2).strip()); continue
        m = re.match(r"^#{2,3}\s+❓\s*(R?)(\d+)\.\s*(.+)$", line)
        if m:
            flush_q()
            cur = {"bo": "A", "rp": bool(m.group(1)), "so": int(m.group(2)),
                   "vi": m.group(3).strip(), "topic_src": topic}
            continue
        if line.startswith("## ") or line.startswith("💡"):
            flush_q(); continue
        if cur is None: continue
        if not line.strip():
            flush_para()
        else:
            para.append(line.strip())
    flush_q()
    return out

# ---------------------------------------------------------------- set B
HEADERS_B = {"Domestic Trips","Overseas trip","Vacation at home","Work","Family/Friend","Housing",
  "Internet","Phones","Text message","Weather","Shopping","Fashion","Funiture","Recycling","Food",
  "Health","Restaurant","Gatherings","Transportation","Banks","Free time","Holidays","Household Chores",
  "Jogging","Travel","ID card","Police","Education."}
def parse_b():
    lines = open(os.path.join(SRC, "script-2.md"), encoding="utf-8").read().split("\n")
    out, topic, cur = [], "Music", None
    last_no, in_question = 0, False
    blocks, block = [], []   # paragraphs of the current answer
    def flush_block():
        nonlocal block
        if block: blocks.append(block); block = []
    def flush_q():
        nonlocal cur, blocks
        flush_block()
        if cur is None: blocks = []; return
        variants, acc, prev_closed = [], [], False
        for b in blocks:
            starts_quote = b[0].startswith('"')
            if acc and prev_closed and (starts_quote or len(b) >= 3):
                variants.append(acc); acc = []
            acc.extend(b)
            prev_closed = b[-1].rstrip().rstrip(".").endswith('"')
        if acc: variants.append(acc)
        for i, v in enumerate(variants):
            sents = []
            for l in v:
                l = l.strip().strip('"').strip()
                l = re.sub(r'^"+|"+$', "", l).strip()
                if not l or re.fullmatch(r"[.\"”]+", l): continue
                sents.extend(split_sentences(l))
            q = dict(cur); q["cau"] = sents
            if i: q["bien_the"] = i
            out.append(q)
        cur, blocks = None, []
    for raw in lines:
        line = norm(raw.rstrip())
        s = line.strip()
        if s in HEADERS_B:
            flush_q(); topic = s.rstrip("."); continue
        m = re.match(r'^(\d+)\s*\.?\s*"?\s*([A-Za-z].*)$', s)
        if m and int(m.group(1)) != last_no and int(m.group(1)) <= 120 and (("?" in s) or s.endswith('"') or s.endswith('".') or len(m.group(2).split()) <= 4 or len(s) > 40):
            flush_q(); last_no = int(m.group(1)); in_question = True
            en = m.group(2).strip().strip('"').strip()
            en = re.sub(r'"\.?\s*$', "", en).strip()
            cur = {"bo": "B", "so": int(m.group(1)), "en": en, "topic_src": topic}
            continue
        # cau hoi khong danh so: dong ket thuc bang ? nam ngoai khoi tra loi
        if cur is not None and s.endswith("?") and not s.startswith('"') and not block and blocks:
            flush_q()
            cur = {"bo": "B", "so": None, "en": s, "topic_src": topic}
            in_question = False
            continue
        if cur is None: continue
        if not s:
            in_question = False
            flush_block()
        elif in_question:
            extra = s.strip().strip('"').strip()
            extra = re.sub(r'"\.?\s*$', "", extra).strip()
            cur["en"] = (cur["en"] + " " + extra).strip()
        else:
            block.append(s)
    flush_q()
    # danh so cho cau khong so: so cua cau truoc + "b"
    last = 0
    for q in out:
        if q["so"] is None:
            q["so"] = last; q["bien_the"] = q.get("bien_the", 0) + 1
        else:
            last = q["so"]
    return out

A = parse_a(); B = parse_b()
json.dump({"A": A, "B": B}, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("A:", len(A), "B:", len(B))
for q in A:
    print("A%s%02d" % ("R" if q["rp"] else "", q["so"]), len(q["cau"]), sum(len(c.split()) for c in q["cau"]), "|", q["topic_src"][0] if q["topic_src"] else "-", "|", q["vi"][:70])
for q in B:
    print("B%03d%s" % (q["so"], "b" if q.get("bien_the") else ""), len(q["cau"]), sum(len(c.split()) for c in q["cau"]), "|", q["topic_src"], "|", q["en"][:70])
