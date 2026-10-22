"""Tái hiện hành vi hiện tại của PUT /markdown/files (kho json, tệp tạm) — không đụng DB thật.

Chạy từ backend/fastapi:  DB_URL=sqlite+aiosqlite:///<scratch>/x.db PYTHONUTF8=1 .venv/Scripts/python.exe <scratch>/thu-ghi-de.py
"""
import json
import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, os.getcwd())
tmp = Path(tempfile.mkdtemp(prefix="md-sync-"))
os.environ["MARKDOWN_ADMIN_KEY"] = "k"
os.environ["MARKDOWN_JSON_FILE"] = str(tmp / "markdown-files.json")

from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from src.adapter.input.controllers import markdown_storage_controller as c  # noqa: E402

app = FastAPI()
app.include_router(c.router)
cl = TestClient(app)
H = {"X-Admin-Key": "k"}


def tree(*docs):
    return {"files": [{"id": "root", "name": "My Documents", "type": "folder",
                       "children": [{"id": i, "name": f"{i}.md", "type": "file", "content": t} for i, t in docs]}]}


# Máy A và máy B cùng tải về bản đầu
cl.put("/markdown/files", json=tree(("a", "A0"), ("b", "B0")), headers=H)
base = cl.get("/markdown/files").json()
print("1) GET không cần khoá quản trị:", cl.get("/markdown/files").status_code)
# A sửa a, thêm c rồi lưu
cl.put("/markdown/files", json=tree(("a", "A1 (máy A)"), ("b", "B0"), ("c", "C mới (máy A)")), headers=H)
# B (vẫn giữ bản đầu) sửa b rồi lưu: không có kiểm phiên bản nào
r = cl.put("/markdown/files", json=tree(("a", "A0"), ("b", "B1 (máy B)")), headers=H)
after = cl.get("/markdown/files").json()
ids = {n["id"]: n["content"] for n in after["files"][0]["children"]}
print("2) PUT của B trả", r.status_code, "→ kho còn:", ids)
print("   sửa của A ở 'a' mất:", ids.get("a") == "A0", "| tài liệu 'c' của A mất:", "c" not in ids)
print("3) Phản hồi PUT dài", len(r.content), "byte = trả lại cả cây; khoá trong phản hồi:", sorted(r.json()["files"][0]["children"][0].keys()))
stored = json.loads((tmp / "markdown-files.json").read_text(encoding="utf-8"))
print("4) Tệp kho json: một blob cả cây, có thụt lề:", list(stored.keys()), (tmp / "markdown-files.json").stat().st_size, "byte")
