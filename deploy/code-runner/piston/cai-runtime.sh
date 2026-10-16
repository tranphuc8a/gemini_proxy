#!/bin/sh
# Cài runtime cho Piston qua HTTP API của chính nó. Chạy lại bao nhiêu lần cũng được (gói nào có rồi thì bỏ qua).
#
#   ./cai-runtime.sh                                  # gcc python node java  vào http://127.0.0.1:2000/api/v2
#   ./cai-runtime.sh gcc python go rust               # chọn gói
#   PISTON_URL=http://may-khac:2000/api/v2 ./cai-runtime.sh
#
# Tên GÓI của Piston khác tên ngôn ngữ: gcc = C + C++, node = JavaScript, mono = C#, ... (xem GET $PISTON_URL/packages).
# Các gói tải từ GitHub Releases của dự án Piston nên máy Piston cần ra Internet lúc cài (không cần khi chạy mã).
set -eu

URL="${PISTON_URL:-http://127.0.0.1:2000/api/v2}"
PKGS="${*:-gcc python node java}"
WAIT_S="${WAIT_S:-90}"

command -v curl >/dev/null 2>&1 || { echo "Cần curl." >&2; exit 2; }

echo "Piston: $URL"
i=0
until curl -fsS "$URL/runtimes" >/dev/null 2>&1; do
  i=$((i + 2))
  if [ "$i" -gt "$WAIT_S" ]; then echo "Piston không trả lời sau ${WAIT_S}s — container đã chạy chưa? (docker logs cs-piston)" >&2; exit 1; fi
  sleep 2
done

# GET /packages → mảng {"language":"gcc","language_version":"10.2.0","installed":true}; mỗi phần tử tách ra một dòng để grep.
PACKAGES="$(curl -fsS "$URL/packages" | tr '{' '\n')"
fail=0
for p in $PKGS; do
  if echo "$PACKAGES" | grep -F "\"language\":\"$p\"" | grep -q '"installed":true'; then
    echo "  [có sẵn] $p"
    continue
  fi
  if ! echo "$PACKAGES" | grep -qF "\"language\":\"$p\""; then
    echo "  [không có gói] $p — xem danh sách: curl $URL/packages" >&2
    fail=1
    continue
  fi
  printf '  [đang cài] %s … ' "$p"
  # Bản mới nhất ("*"). Gói lớn tải lâu: gcc ≈ 750 MB, đo thực tế ~7 phút trên đường truyền thường; java/python/node vài chục giây.
  if out="$(curl -fsS --max-time 1800 -X POST "$URL/packages" -H 'Content-Type: application/json' -d "{\"language\":\"$p\",\"version\":\"*\"}" 2>&1)"; then
    echo "xong ($(echo "$out" | tr -d '\n' | cut -c1-80))"
  else
    echo "LỖI: $out" >&2
    fail=1
  fi
done

echo "Runtime đang có:"
curl -fsS "$URL/runtimes" | tr '{' '\n' | sed -n 's/.*"language":"\([^"]*\)","version":"\([^"]*\)".*/  \1 \2/p' | sort -u
exit "$fail"
