# light-grid-shared

Engine dùng chung cho ba ứng dụng `light-grid-v1` (Playground), `light-grid-v2`
(Lab) và `light-grid-v3` (Research).

Thư mục này **không có `index.html`**, nên `webapp_controller._scan_apps_recursive`
không coi nó là một app và portal không liệt kê nó. Nhưng nó vẫn được serve như
tài nguyên tĩnh bình thường, nên ba app nạp bằng đường dẫn tương đối:

```html
<script src="../light-grid-shared/geometry.js"></script>
```

Nếu sau này copy một app đi nơi khác thì phải copy cả thư mục này theo.

## Các module

Tất cả đều là script cổ điển gắn vào `window` — ba app là trang tĩnh, không có
bước build nào để phân giải `import`.

| File | Xuất ra | Trách nhiệm |
|---|---|---|
| `geometry.js` | `LightGridGeometry` | Hình dạng bàn: ô nào tồn tại, ô nào kề ô nào. 9 hình: chữ nhật, xuyến, vành khuyên, kim cương, tam giác, lục giác, vòng lục giác, chữ thập, hình tròn. |
| `rules.js` | `LightGridRules` | Bấm một ô thì lật những ô nào. 13 luật. Đồng thời dựng **ma trận nước đi** `A`. |
| `gf2.js` | `LightGridGF2` | Đại số tuyến tính trên GF(2): khử Gauss (có ghi lại từng bước), hạng, hạt nhân, hạt nhân trái, giải `A·x = b`, tìm lời giải ít nước nhất. |
| `board.js` | `LightGridBoard` | Trạng thái bàn, lịch sử hoàn tác/làm lại, xáo bàn, JSON và mã hoá URL. |
| `render.js` | `LightGridRender` | Vẽ SVG (vuông + hex), 6 bảng màu, 5 hình quân cờ, xuất SVG/PNG. |
| `theme.css` | — | Token thiết kế và style của bàn cờ, dùng chung cho cả ba app. |

## Kiểm chứng

Engine được đối chiếu với các kết quả đã biết của Lights Out cổ điển
(luật Cross, bàn chữ nhật):

| Bàn | Hạng | Số chiều nhân | Ghi chú |
|---|---|---|---|
| 3×3 | 9 | 0 | Mọi bàn giải được, lời giải duy nhất |
| 4×4 | 12 | 4 | Chỉ 1/16 số bàn giải được |
| 5×5 | 23 | 2 | Trò Tiger Electronics gốc — đúng 4 lời giải |
| 6×6 | 36 | 0 | |
| 9×9 | 73 | 8 | |

Bàn 5×5 sáng hết đèn có lời giải ngắn nhất **đúng 15 nước**, khớp với kết quả
kinh điển.

Chạy lại kiểm chứng bằng Node:

```bash
node - <<'EOF'
import fs from 'node:fs'
const w = {}; globalThis.window = w
for (const f of ['geometry.js','rules.js','gf2.js','board.js'])
  new Function('window', fs.readFileSync(f,'utf8'))(w)
const A = w.LightGridRules.moveMatrix('cross', w.LightGridGeometry.build('rectangle',5,5), {})
console.log(w.LightGridGF2.analyse(A))   // { rank: 23, nullity: 2, ... }
EOF
```

## Thêm một hình dạng hoặc một luật

- **Hình dạng**: thêm một mục vào `SHAPES` trong `geometry.js`. Chỉ cần một hàm
  `member(row, col)` trả lời "ô này có thuộc hình không"; phần còn lại do
  `fromMask` lo.
- **Luật**: thêm một mục vào `RULES` trong `rules.js` với `apply(topology, cell, options)`
  trả về mảng ô bị ảnh hưởng. Ma trận nước đi, bộ giải và cả ba app tự động dùng
  được ngay — không phải sửa chỗ nào khác.

Tham khảo: Anderson & Feil, *Turning Lights Out with Linear Algebra*,
Mathematics Magazine 71 (1998).
