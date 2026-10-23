#!/bin/bash
# Kiem dot bien: sua MOT cho trong BAN SAO json-editor (scratchpad) roi chay node kiem.js; phai DO.
SRC="/c/Users/tranphuc8a/Desktop/gemini_proxy/backend/fastapi/webapp/tranphuc8a/json-editor"
SP="/c/Users/tranphuc8a/AppData/Local/Temp/claude/c--Users-tranphuc8a-Desktop-gemini-proxy/2fd2853d-4c94-4034-a078-2b6358d957ee/scratchpad"
DST="$SP/je-mut-$$"
mkdir -p "$DST"
cp -r "$SRC/assets" "$SRC/kiem" "$SRC/kiem.js" "$SRC/index.html" "$DST/"
cd "$DST" || exit 1

mut() {
  ten="$1"; tep="$2"; expr="$3"
  cp "$tep" "$tep.bak"
  sed -i "$expr" "$tep"
  if cmp -s "$tep" "$tep.bak"; then echo "[KHONG-DOI] $ten (sed khong khop)"; mv "$tep.bak" "$tep"; return; fi
  node kiem.js schema-1 schema-2 schema-format vi-tri chay-nen > out.txt 2>&1
  code=$?
  n=$(grep -c "^  \[SAI\]" out.txt)
  if [ $code -ne 0 ]; then echo "[BAT-DUOC] $ten ($n phep sai)"; else echo "[SOT!!!] $ten - test van xanh"; fi
  mv "$tep.bak" "$tep"
}

mut "uniqueItems khong phat hien" assets/schema-kiem.js 's/if (thay.has(k)) {/if (false) {/'
mut "khong chong vong ref" assets/schema-kiem.js 's/if (cu === sau) {/if (false) {/'
mut "minLength dung length thay vi code point" assets/schema-kiem.js 's/if (v.length >= 2 \* mn || soKyTu(v) >= mn) return true;/if (v.length >= mn) return true;/'
mut "required khong kiem" assets/schema-kiem.js 's/if (!coRieng(v, bat\[i\])) {/if (false) {/'
mut "anyOf chon nhanh dau thay vi gan dung nhat" assets/schema-kiem.js 's/var tot = nhanhGanDung(kq);/var tot = 0;/'
mut "giay nhuan luon hop le" assets/schema-format.js 's/return utc === 23 \* 60 + 59;/return true;/'
mut "khoa trung lay cai DAU" assets/vi-tri.js 's/if (khop) tim = { khoaBd: kb, khoaKt: ke, bd: i, kt: kv };/if (khop \&\& !tim) tim = { khoaBd: kb, khoaKt: ke, bd: i, kt: kv };/'
mut "Worker khong terminate" assets/chay-nen.js 's/try { tt.worker.terminate(); } catch (e) { \/\* da dong \*\/ }/\/\* khong terminate \*\//'
mut "enum dung === thay vi so sanh sau" assets/schema-kiem.js 's/if (bangNhauSau(v, ds\[i\])) return true;/if (v === ds[i]) return true;/'
mut "mat co catBot khi qua toiDa" assets/schema-kiem.js 's/if (!canh \&\& ++ng.dem >= ng.toiDa) ng.cat = true;/if (!canh) ng.dem++;/'
mut "additionalProperties false khong bat" assets/schema-kiem.js 's/if (addNut.kieu === 2) {/if (false) {/'
mut "oneOf nhan 2 nhanh khop la dung" assets/schema-kiem.js 's/if (khop.length === 1) { gopCanhBao/if (khop.length >= 1) { gopCanhBao/'
mut "format canh bao thanh loi" assets/schema-kiem.js 's/if (ng.fmt === "bo-qua" || F.kiem(ten, v)) return true;/if (ng.fmt === "bo-qua" || F.kiem(ten, v)) return true; ng.fmt = "loi";/'
mut "duongTaiViTri khong tru khoang trang" assets/vi-tri.js 's/if (j >= kt || j > i) break;/if (j >= kt) break;/'
echo "xong, thu muc tam: $DST"
