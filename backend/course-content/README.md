# Nội dung khoá học — bundle nguồn

Thư mục này là **bản sao lưu dạng tệp** của nội dung khoá học. Nội dung mà trang web
đọc nằm trong **database** (bảng `courses`, `course_sections`, `course_groups`,
`course_docs`), qua API `/courses/*` của FastAPI.

> Thư mục nằm **ngoài** `backend/fastapi` — tức ngoài Root Directory của project
> Vercel — nên không bị đóng gói vào function. Đó là cả lý do nó ở đây: trước đợt
> chuyển, cùng nội dung này nằm trong `webapp/courses/*/assets/content.js` +
> `content.json` (23,6 MB) và đi theo mỗi lần deploy.

## Có gì

| Tệp | Khoá | Bài | Ghi chú |
|---|---|---|---|
| `ai-everything.json` | Đại khoá học Trí tuệ nhân tạo | 292 | `webapp/courses/ai-everything-course` |
| `heuristic.json` | Học Heuristic | 52 | `webapp/courses/heuristic-course` |
| `heuristic-2.json` | Học Heuristic (bản 2) | 61 | `webapp/courses/heuristic-course-2` |
| `system-design.json` | Học System Design | 80 | `webapp/courses/system-design-course` |
| `opic.json` | Khoá luyện thi OPIc | 195 | sinh từ `opic/` — xem bên dưới |
| `<slug>/build.py` | | | sinh lại bundle từ thư mục markdown nguồn |
| `_ghi_bundle.py` | | | ghi bundle, giữ khối `course` đã có |

Thư mục markdown nguồn của bốn khoá đầu **không có trong repo**: các bundle ở đây là
bản đầy đủ duy nhất ngoài database. `<slug>/build.py <thu-muc-nguon>` sinh lại bundle
khi có thư mục đó.

## Định dạng bundle

Định dạng `content.json` cũ, cộng khối `course`:

```jsonc
{
  "course": { "slug": "system-design", "title": "…", "subtitle": "…", "description": "…",
              "icon": "🏗️", "config": { "webapp": "courses/system-design-course" }, "published": true },
  "nav":   [ { "id": "khoa-hoc", "title": "…", "sub": "…", "icon": "compass",
               "groups": [ { "title": "Giai đoạn 0 — …", "short": "GĐ 0", "meta": {}, "items": ["<doc id>", …] } ] } ],
  "slugs": { "<slug trên trang>": "<doc id>" },          // dẫn xuất — import bỏ qua
  "order": [ "<doc id>", … ],                             // dẫn xuất — thứ tự điều hướng
  "docs":  { "<doc id>": { "id", "slug", "title", "kind", "tag", "meta", "md", … } },
  "stats": { "lessonsPlanned": 218, … }                   // khoá biên tập được giữ; files/words/minutes/lessons tính lại
}
```

`outline`, `words`, `codeLines`, `minutes` của từng bài được database **tính lại** từ `md`
khi nạp; có trong tệp hay không đều được.

## Lệnh

```bash
cd backend/fastapi
python tools/manage_courses.py info                                   # đích là DB nào, có bảng chưa
python tools/manage_courses.py import-all                             # nạp mọi bundle ở đây (--yes với MySQL thật)
python tools/manage_courses.py import ../course-content/opic.json
python tools/manage_courses.py export system-design -o ../course-content/system-design.json
python tools/manage_courses.py export system-design --js -o …/content.js   # bản offline cho trang
```

Đích: `DB_URL` (vd. `sqlite+aiosqlite:///data/dev.sqlite3`) nếu có, không thì các trường
`DB_*` trong `.env`. Lệnh ghi vào database không phải SQLite đều đòi `--yes`.

> Nạp **thay toàn bộ** khoá cùng slug. Sửa trong database (trang Quản lý khoá học,
> sqladmin, API) mà muốn giữ lại ở đây thì `export` về tệp này rồi commit.

## OPIc

`opic/` là nơi soạn khoá OPIc: `content/scripts/*.md` (17 chủ đề, 185 câu hỏi),
`content/huong-dan/*.md` (10 bài), `build.py` kiểm lỗi rồi sinh `../opic.json` theo
đúng định dạng chung — mỗi câu hỏi là một bài `kind=script`, mỗi chủ đề là một nhóm
trong section `chu-de`. Xem `webapp/courses/opic-course/README.md`.
