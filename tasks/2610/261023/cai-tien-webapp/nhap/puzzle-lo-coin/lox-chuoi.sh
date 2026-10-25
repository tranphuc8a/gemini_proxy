#!/bin/bash
# chuỗi lệnh kiểm cuối đợt P7 (chạy từ gốc repo); kết quả ghi /tmp/p7-*.txt
cd /c/Users/tranphuc8a/Desktop/gemini_proxy
LPS=backend/fastapi/webapp/tranphuc8a/logic-puzzle-suite
PY=backend/fastapi/.venv/Scripts/python.exe
export MONGO_URI="" PYTHONUTF8=1
$PY $LPS/tao-pwa.py > /tmp/p7-pwa1.txt 2>&1; echo "pwa1 $?" >> /tmp/p7-status.txt
node $LPS/kiem.js lightsoutx > /tmp/p7-kx.txt 2>&1; echo "kiem-lightsoutx $?" >> /tmp/p7-status.txt
node $LPS/kiem.js > /tmp/p7-kall.txt 2>&1; echo "kiem-all $?" >> /tmp/p7-status.txt
$PY $LPS/check.py --tinh > /tmp/p7-tinh.txt 2>&1; echo "check-tinh $?" >> /tmp/p7-status.txt
LOX_FULL=1 node $LPS/kiem.js lightsoutx > /tmp/p7-kfull.txt 2>&1; echo "kiem-lightsoutx-FULL $?" >> /tmp/p7-status.txt
$PY $LPS/check.py --chuc-nang --co-gian > /tmp/p7-chucnang.txt 2>&1; echo "check-chucnang-cogian $?" >> /tmp/p7-status.txt
$PY $LPS/tao-pwa.py > /tmp/p7-pwa2.txt 2>&1; echo "pwa2 $?" >> /tmp/p7-status.txt
$PY $LPS/tao-pwa.py --kiem >> /tmp/p7-pwa2.txt 2>&1; echo "pwa-kiem $?" >> /tmp/p7-status.txt
echo ALLDONE >> /tmp/p7-status.txt
