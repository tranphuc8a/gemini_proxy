Ứng dụng 16: Dev Toolbox

Đây là ứng dụng cuối cùng trong danh sách 9 app. Mục tiêu của app là biến điện thoại thành một bộ công cụ kỹ thuật dành cho developer, đặc biệt hữu ích khi không có laptop hoặc không có Internet.


---

1. Bài toán

Khi làm backend/devops, tôi thường xuyên cần những công cụ nhỏ như:

- Decode JWT.
- Encode/decode Base64.
- URL encode/decode.
- Hash.
- UUID generator.
- JSON formatter.
- JSON Schema validator.
- Regex tester.
- Cron expression parser.
- Timestamp converter.
- Unix permission calculator.
- IP/subnet calculator.
- Source code formatter.
- YAML ↔ JSON.
- URL parser.
- HTTP request builder.
- Diff text.
- Random data generator.
- Request an api.
- Compile, build and run a small source code.

Mỗi công cụ rất nhỏ nhưng thường phải:

- mở Google;
- tìm một website;
- copy dữ liệu;
- dán vào;
- hoặc cài một CLI/tool riêng.

Tôi muốn tất cả nằm trong một webapp.


---

2. Mục tiêu sản phẩm

Ứng dụng phải giống một:

> Swiss Army Knife cho developer.



Từ một màn hình chính:

Offline Dev Toolbox
│
├── Encoding
├── JSON / YAML
├── JWT
├── Hash
├── Regex
├── Date / Time
├── Network
├── Crypto utilities
├── SQL
├── Text / Diff
├── Generators
├── ...
└── HTTP


---

3. Dashboard

Trang chủ hiển thị:

┌──────────────────────────────┐
│ 🔍 Search tools...           │
├──────────────────────────────┤
│ ⭐ Favorites                 │
│                              │
│ JSON Formatter               │
│ JWT Decoder                  │
│ Timestamp Converter          │
├──────────────────────────────┤
│ Encoding                     │
│ JSON                         │
│ Network                      │
│ Security                     │
│ Text                         │
│ Generators                   │
└──────────────────────────────┘

Người dùng có thể pin những tool sử dụng thường xuyên.


---

4. Tool Search

Tìm:

jwt

kết quả:

JWT Decoder
JWT Generator
JWT Inspector

Hoặc:

timestamp

→ Timestamp Converter.


---

5. Encoding Tools

5.1 Base64

Hỗ trợ:

Text → Base64
Base64 → Text

Ví dụ:

hello
 ↓
aGVsbG8=

Có tùy chọn:

- UTF-8.
- URL-safe Base64.
- Base64 file.


---

5.2 URL Encode

hello world
     ↓
hello%20world

Hỗ trợ:

- Encode.
- Decode.


---

5.3 HTML Entity

<hello>
    ↓
&lt;hello&gt;


---

6. JSON Toolkit

Đây là một trong những nhóm quan trọng nhất.

JSON Formatter

Input:

{"name":"Phuc","age":30}

Output:

{
  "name": "Phuc",
  "age": 30
}


---

JSON Validator

Nếu JSON lỗi:

{
  "name": "Phuc"
  "age": 30
}

Hiển thị:

Invalid JSON

Expected ',' at line 3


---

JSON Minifier

Pretty JSON
   ↓
Minified JSON


---

JSON Tree Viewer

Hiển thị:

root
├── user
│   ├── name
│   ├── age
│   └── roles[]
│       ├── admin
│       └── developer

Có thể collapse/expand.


---

7. JSONPath Tester

Input JSON:

{
  "users": [
    {
      "name": "Alice",
      "age": 20
    },
    {
      "name": "Bob",
      "age": 30
    }
  ]
}

Query:

$.users[*].name

Output:

Alice
Bob


---

8. JSON ↔ YAML

Hai chiều:

JSON → YAML
YAML → JSON

Có validation trước khi convert.


---

9. JSON Schema Validator

Đây đặc biệt hữu ích với công việc backend/CDA.

Input:

{
  "name": "Phuc",
  "age": 30
}

Schema:

{
  "type": "object",
  "required": ["name"],
  "properties": {
    "name": {
      "type": "string"
    },
    "age": {
      "type": "integer"
    }
  }
}

Kết quả:

✓ Valid

Nếu lỗi:

✗ Invalid

$.age
Expected integer
Received string


---

10. JWT Toolkit

Một tool rất quan trọng với backend developer.

Input:

eyJhbGciOi...

Ứng dụng parse:

Header
Payload
Signature

Ví dụ:

{
  "alg": "HS256",
  "typ": "JWT"
}

và:

{
  "sub": "123",
  "role": "ADMIN",
  "exp": 1790000000
}


---

JWT Inspector

Tự động hiển thị:

Algorithm: HS256
Issued At: ...
Expires At: ...
Expired: NO

Không gửi JWT lên Internet.


---

11. UUID Generator

Cho phép:

UUID v4
UUID v7

Generate:

550e8400-e29b-41d4-a716-446655440000

Có:

Generate 1
Generate 10
Generate 100

và Copy All.


---

12. Hash Tool

Input:

hello

Output:

MD5
5d41402abc4b2a76b9719d911017c592

SHA-1
...

SHA-256
...

SHA-512
...

Có thể hash:

- Text.
- File.


---

13. HMAC

Cho phép:

Algorithm:
HMAC-SHA256

Message:
hello

Secret:
my-secret

Output:

...


---

14. Password Generator

Sinh password:

Length: 24
Uppercase: ✓
Lowercase: ✓
Numbers: ✓
Symbols: ✓

Ví dụ:

xA7!kP9...

Có strength indicator.


---

15. Regex Tester

Input:

^[a-zA-Z0-9._%+-]+@...

Text:

phuc@example.com
hello
test@gmail.com

Ứng dụng highlight match.

Hiển thị:

Matches: 2


---

Regex Explanation

Nếu có thể:

^
Start of string

[a-zA-Z0-9]
Character class

+
One or more

Đây là tính năng nâng cao.


---

16. Diff Tool

So sánh hai text:

Original
Modified

Ví dụ:

- "port": 8080
+ "port": 8081

Có các chế độ:

Character diff
Word diff
Line diff


---

17. Text Utilities

Một nhóm utility nhỏ:

- Uppercase.
- Lowercase.
- Capitalize.
- Trim.
- Remove duplicate lines.
- Sort lines.
- Reverse lines.
- Count characters.
- Count words.
- Count lines.
- Escape/unescape.
- Convert tabs/spaces.

Ví dụ:

foo
bar
foo

→ Remove duplicates:

foo
bar


---

18. Timestamp Converter

Hỗ trợ:

Unix seconds
Unix milliseconds
ISO-8601
Local DateTime
UTC

Ví dụ:

1791234567
       ↓
2026-10-05 12:...

Có thể convert hai chiều.


---

19. Date Calculator

Các thao tác:

Date + N days
Date - N days
Date difference

Ví dụ:

2026-10-01
+
30 days
=
2026-10-31


---

20. Cron Expression

Input:

0 0 * * *

Output:

Every day at 00:00

Có thể hiển thị:

Next 5 executions

Ví dụ:

2026-10-07 00:00
2026-10-08 00:00
...


---

21. Unix Permission Calculator

Input:

755

Output:

Owner:
rwx

Group:
r-x

Others:
r-x

Ngược lại:

rwxr-xr-x
     ↓
755

Có checkbox UI:

Owner
☑ Read
☑ Write
☑ Execute


---

22. IP Calculator

Input:

192.168.1.0/24

Output:

Network:
192.168.1.0

Broadcast:
192.168.1.255

First Host:
192.168.1.1

Last Host:
192.168.1.254

Hosts:
254


---

23. Subnet Calculator

Cho phép:

Network
CIDR
Subnet count

Tính:

- Network address.
- Broadcast.
- Prefix.
- Host range.
- Number of hosts.
- Subnet mask.

Có thể hỗ trợ IPv4 trước, IPv6 V2.


---

24. URL Parser

Input:

https://example.com/api/users?id=123#profile

Tách thành:

Protocol: https
Host: example.com
Path: /api/users
Query:
  id = 123
Fragment:
  profile


---

25. HTTP Request Builder

Một mini REST client.

Input:

Method:
POST

URL:
http://localhost:8080/users

Headers:

Content-Type: application/json
Authorization: Bearer ...

Body:

{
  "name": "Phuc"
}

Bấm:

Send


---

Quan trọng

Tool này có thể hoạt động offline nhưng request chỉ thành công với endpoint mà thiết bị có thể truy cập, ví dụ:

localhost
LAN
local server

Không nên giả định rằng "offline" đồng nghĩa với "không được phép sử dụng network".


---

26. HTTP Response Viewer

Hiển thị:

Status:
200 OK

Time:
42 ms

Headers:
Content-Type: application/json

Body:
{
  ...
}

Có:

- Pretty JSON.
- Raw response.
- Headers.
- Copy.


---

27. Curl Generator

Từ HTTP Request Builder:

POST
https://example.com/api/users

app sinh:

curl -X POST \
  'https://example.com/api/users' \
  -H 'Content-Type: application/json' \
  -d '{"name":"Phuc"}'

Ngược lại, có thể:

curl command
     ↓
Parse
     ↓
HTTP Request


---

28. SQL Formatter

Input:

select u.id,u.name from users u where u.age>18 order by u.name;

Output:

SELECT
    u.id,
    u.name
FROM users u
WHERE u.age > 18
ORDER BY u.name;


---

29. SQL Utilities

Có thể thêm:

- SQL formatter.
- SQL minifier.
- SQL keyword uppercase/lowercase.
- Explain SQL syntax.
- SQL dialect selector.

Dialect:

MySQL
PostgreSQL
SQLite
SQL Server
Oracle


---

30. Random Data Generator

Generate:

UUID
Name
Email
Phone
Date
Integer
Boolean
IP
URL

Ví dụ:

[
  {
    "id": "...",
    "name": "Alice",
    "email": "alice@example.com"
  }
]

Có thể chọn số lượng:

10
100
1000


---

31. Mock JSON Generator

Người dùng định nghĩa:

{
  "id": uuid,
  "name": name,
  "age": integer(18,60),
  "email": email
}

App generate:

{
  "id": "...",
  "name": "John",
  "age": 31,
  "email": "john@example.com"
}

Tính năng này đặc biệt hữu ích cho backend development.


---

32. Scratchpad

Đây là một tính năng rất quan trọng.

Mỗi tool có thể có:

Input
Output

nhưng người dùng cũng cần một vùng ghi tạm:

┌─────────────────────────┐
│ Scratchpad              │
│                         │
│ curl ...                │
│ TODO ...                │
│ test payload ...        │
└─────────────────────────┘

Scratchpad được lưu local.


---

33. History

Mỗi tool có lịch sử thao tác.

Ví dụ JSON Formatter:

Today 14:20
Today 13:15
Yesterday 18:30

Có thể:

Restore
Delete
Favorite


---

34. Favorites

Người dùng pin:

⭐ JSON Formatter
⭐ JWT Decoder
⭐ Regex Tester
⭐ Timestamp
⭐ Base64

Dashboard ưu tiên những tool này.


---

35. Recent Tools

Hiển thị:

Recently Used

JWT Decoder
JSON Schema
Curl Generator
Unix Permission


---

36. Share / Copy

Mọi tool phải có:

Copy
Clear
Swap

và nếu phù hợp:

Download
Share

Share ở đây là chia sẻ dữ liệu/file qua OS, không phải upload cloud.


---

37. Security Requirement

Đây là một yêu cầu rất quan trọng.

Ứng dụng xử lý những dữ liệu nhạy cảm như:

- JWT.
- Token.
- API key.
- Password.
- Private key.
- Cookie.
- Request body.

Vì vậy:

> Không được gửi dữ liệu tool lên server bên ngoài.



Core tools phải thực thi local.

Ngoài ra:

- Không analytics nội dung input.
- Không log input.
- Không lưu sensitive input vào history nếu người dùng tắt history.
- Có nút Clear All.


---

38. Offline Requirement

App cho phép hoạt động khi:

Wi-Fi: OFF
Mobile Data: OFF

với toàn bộ tool local:

Encoding
JSON
JWT parsing
Hash
Regex
Timestamp
CIDR
UUID
Diff
SQL formatting
Generators



---

39. Architecture theo nghiệp vụ

Không nên xây app như một collection các màn hình độc lập.

Nên có một abstraction:

Tool
├── id
├── name
├── category
├── description
├── input_schema
├── output_schema
├── execute()
└── options

Ví dụ:

Tool
│
├── JSON Formatter
├── JWT Decoder
├── Base64
├── Regex
├── Hash
├── Timestamp
└── CIDR Calculator

Điều này giúp sau này thêm tool rất nhanh.


---

40. MVP V1

Tớ sẽ không cố nhét tất cả tool vào phiên bản đầu tiên.

Encoding

- Base64.
- URL Encode/Decode.
- HTML Escape.

Data

- JSON Formatter.
- JSON Validator.
- JSON Minifier.
- JSON Tree.
- JSON ↔ YAML.

Security

- JWT Decoder.
- Hash.
- UUID Generator.
- Password Generator.

Text

- Regex Tester.
- Diff.
- Text utilities.

Date

- Timestamp Converter.
- Date Calculator.
- Cron Parser.

Network

- URL Parser.
- IPv4/CIDR Calculator.
- Unix Permission.

Developer

- SQL Formatter.
- Curl Generator.
- Random Data Generator.

Productivity

- Favorites.
- Recent.
- History.
- Scratchpad.
- Copy/share.
- Local backup.


---

41. V2

Sau MVP có thể thêm:

- JSONPath.
- JSON Schema.
- HTTP Client.
- Curl parser.
- Mock JSON generator.
- GraphQL formatter.
- XML formatter.
- JWT generator/signing.
- HMAC.
- IPv6.
- SQL formatter nâng cao.
- Regex explanation.
- Certificate parser.
- PEM/DER utilities.
- SSH utilities.
- Docker utilities.
- Kubernetes YAML helpers.
- Git utilities.
- Bổ sung những tool hữu ích khác cho developer.


---

42. Ví dụ một phiên sử dụng thực tế

Tôi đang debug API.

Server trả về:

eyJhbGciOiJIUzI1NiJ9....

Tôi mở:

JWT Decoder

→ xem payload.

Thấy:

{
  "sub": "123",
  "exp": 1791234567
}

Copy exp sang:

Timestamp Converter

→ phát hiện token đã hết hạn.

Sau đó tôi copy JSON response sang:

JSON Formatter

→ format.

Sau đó lấy một field:

user@example.com

sang:

URL Encoder

→ lấy encoded value.

Cuối cùng dùng:

Diff

để so sánh response trước và sau khi sửa backend.

Toàn bộ quá trình:

JWT
 ↓
Timestamp
 ↓
JSON
 ↓
URL
 ↓
Diff

không cần rời khỏi một ứng dụng.


---

43. Phạm vi cuối cùng của cả 9 ứng dụng

Vậy là danh sách ban đầu đã hoàn thành 9/9:

#	Ứng dụng	Mục đích chính

1	Personal Wiki	Quản lý ghi chú/tri thức
6	Algorithm Notebook	Học và tra cứu thuật toán
8	Expense Tracker	Quản lý tài chính cá nhân
9	Personal Knowledge Graph	Biểu diễn tri thức dạng graph
10	Reading Journal	Theo dõi việc đọc
11	Heuristic Playground	Thí nghiệm heuristic/metaheuristic
12	Brainstorm & Mindmap	Brainstorm và tổ chức ý tưởng
13	Logic Puzzle Suite	Luyện logic + thuật toán
16	Dev Toolbox	Bộ công cụ developer

