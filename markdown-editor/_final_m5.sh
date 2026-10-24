#!/bin/bash
# Chạy tuần tự các lệnh kiểm cuối đợt M5 (tạm; xoá sau khi dùng). Kết quả ở $OUT/<tên>.txt, mã thoát ở $OUT/ket-qua.txt
cd /c/Users/tranphuc8a/Desktop/gemini_proxy || exit 1
OUT=/c/Users/TRANPH~1/AppData/Local/Temp/m5-final
mkdir -p "$OUT"
: > "$OUT/ket-qua.txt"
export PYTHONUTF8=1
PY=backend/fastapi/.venv/Scripts/python.exe

run() {
  local name="$1"; shift
  echo "== $name: $*" >> "$OUT/ket-qua.txt"
  "$@" > "$OUT/$name.txt" 2>&1
  echo "$name exit $?" >> "$OUT/ket-qua.txt"
}

run khoi "$PY" markdown-editor/scripts/kiem-khoi.py --anh "$OUT/anh"
run audit node scripts/audit-webapps.mjs
run xuatban node scripts/build-webapps.mjs --only markdown-editor
run kiemxuatban node scripts/build-webapps.mjs --check
run chiase "$PY" markdown-editor/scripts/kiem-chia-se.py
run pwa "$PY" markdown-editor/scripts/kiem-pwa.py
run hieunang "$PY" markdown-editor/scripts/kiem-hieu-nang.py --nguong --chi doc-2k,doc-10k --khong-build --json "$OUT/hieu-nang.json"
(cd markdown-editor && run test npm test)
(cd markdown-editor && run typecheck npm run type-check)
(cd markdown-editor && run lint npm run lint)
echo "XONG" >> "$OUT/ket-qua.txt"
