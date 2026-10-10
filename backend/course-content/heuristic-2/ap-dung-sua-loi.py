#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Áp các bản vá sửa lỗi nội dung (sai số, mâu thuẫn, tham chiếu chéo…) vào bundle khoá `heuristic-2`.

Thư mục markdown nguồn không có trong repo, nên các bản vá này là DẤU VẾT DUY NHẤT của những chỗ đã sửa:
mỗi bản vá ghi `old` → `new` kèm lý do. Chạy lại an toàn (idempotent): chỗ đã sửa thì bỏ qua.

    python ap-dung-sua-loi.py --thu  vá/*.json      # chỉ kiểm: mỗi `old` phải xuất hiện ĐÚNG MỘT LẦN trong bài
    python ap-dung-sua-loi.py        vá/*.json      # ghi vào ../heuristic-2.json

Định dạng một tệp vá: danh sách đối tượng
    { "bai": "khoa-hoc/bai-05-greedy",     # slug bài (hoặc id)
      "old": "đoạn văn bản gốc, nguyên văn, xuất hiện đúng một lần",
      "new": "đoạn thay thế",
      "ly_do": "vì sao (kèm cách kiểm chứng: số tính lại, dòng mâu thuẫn…)" }

Thứ tự: các tệp áp theo `sort -V` (g1 … g15, g16-x1 … g16-x6); bản vá sau có thể sửa đè chữ do bản vá trước chèn vào. Vì vậy:
  • chạy MỘT lần, theo đúng thứ tự, trên bản gốc;
  • trên bundle đã vá xong, `--thu` cho toàn bộ tệp sẽ báo lỗi ở những bản vá đã bị sửa đè (không phải lỗi thật);
  • muốn tái tạo/kiểm: `git show <commit gốc>:backend/course-content/heuristic-2.json` → bundle tạm → áp lại toàn bộ (đã thử: 656 bản vá, 0 lỗi, kết quả giống hệt bundle hiện tại).

Sau khi ghi: nạp lại vào database (`python backend/fastapi/tools/manage_courses.py import backend/course-content/heuristic-2.json`).
"""
import io
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
BUNDLE = os.path.join(os.path.dirname(HERE), "heuristic-2.json")


def doc_bundle():
    with io.open(BUNDLE, encoding="utf-8", newline="") as f:  # newline="" → giữ nguyên CRLF/LF khi đọc
        raw = f.read()
    return json.loads(raw), ("\r\n" if "\r\n" in raw else "\n")


def tim_bai(d, ten):
    for did, doc in d["docs"].items():
        if ten in (did, doc.get("slug")):
            return did
    return None


def main(argv):
    thu = "--thu" in argv
    tep = [a for a in argv if not a.startswith("--")]
    if not tep:
        print(__doc__)
        return 2
    d, eol = doc_bundle()
    ap, da, loi = 0, 0, []
    for t in tep:
        with io.open(t, encoding="utf-8") as f:
            ds = json.load(f)
        for i, v in enumerate(ds):
            ten = "%s[%d] %s" % (os.path.basename(t), i, v.get("bai"))
            for k in ("bai", "old", "new", "ly_do"):
                if not isinstance(v.get(k), str) or (k != "new" and not v[k].strip()):
                    loi.append("%s: thiếu/sai khoá `%s`" % (ten, k))
                    break
            else:
                did = tim_bai(d, v["bai"])
                if not did:
                    loi.append("%s: không có bài này trong bundle" % ten)
                    continue
                md = d["docs"][did]["md"]
                n = md.count(v["old"])
                if v["new"] and v["old"] in v["new"] and v["new"] in md:
                    da += 1  # `new` chứa nguyên `old` (chỉ thêm chữ): `old` vẫn còn sau khi áp, nên phải xét `new` trước
                elif n == 1:
                    d["docs"][did]["md"] = md.replace(v["old"], v["new"], 1)
                    ap += 1
                elif n == 0 and v["new"] and v["new"] in md:
                    da += 1
                elif n == 0:
                    loi.append("%s: `old` không có trong bài (%s…)" % (ten, v["old"][:60].replace("\n", "⏎")))
                else:
                    loi.append("%s: `old` xuất hiện %d lần — phải đúng một lần (%s…)" % (ten, n, v["old"][:60].replace("\n", "⏎")))
    print("áp được %d · đã áp từ trước %d · lỗi %d" % (ap, da, len(loi)))
    for m in loi[:60]:
        print("  LỖI " + m)
    if loi:
        return 1
    if not thu and ap:
        # newline="" để Python không đổi lại "\n" → "\r\n" lần nữa (sẽ thành \r\r\n)
        with io.open(BUNDLE, "w", encoding="utf-8", newline="") as f:
            f.write(json.dumps(d, ensure_ascii=False, indent=1).replace("\n", eol) + eol)
        print("đã ghi " + BUNDLE)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
