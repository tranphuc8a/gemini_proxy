# Hướng dẫn sử dụng OpenCode CLI

## Mục lục

1. [Giới thiệu](#giới-thiệu)
2. [Cài đặt](#cài-đặt)
3. [Cấu hình cơ bản](#cấu-hình-cơ-bản)
4. [Các lệnh chính](#các-lệnh-chính)
5. [Cấu hình nâng cao](#cấu-hình-nâng-cao)
6. [Usecase thực tế](#usecase-thực-tế)
7. [Ví dụ cụ thể](#ví-dụ-cụ-thể)
8. [Khắc phục sự cố](#khắc-phục-sự-cố)

---

## Giới thiệu

OpenCode CLI là công cụ dòng lệnh AI mạnh mẽ, hỗ trợ:
- Tự động hóa phát triển phần mềm
- Viết code, debug, refactor
- Tạo test, documentation
- Quản lý project với nhiều agent tùy chỉnh

---

## Cài đặt

### Yêu cầu hệ thống
- Node.js >= 18
- npm hoặc yarn

### Cài đặt toàn cục
```bash
npm install -g @opencode-ai/cli
```

### Kiểm tra phiên bản
```bash
opencode --version
```

### Khởi tạo project mới
```bash
mkdir my-project
cd my-project
opencode init
```

---

## Cấu hình cơ bản

### Vị trí file cấu hình

| Phạm vi | Đường dẫn |
|---------|-----------|
| Project | `./opencode.json`, `./opencode.jsonc`, `.opencode/opencode.json` |
| Global | `~/.config/opencode/opencode.json` |

### Cấu hình tối thiểu

```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "anthropic/claude-sonnet-4-6",
  "small_model": "anthropic/claude-sonnet-4-6",
  "default_agent": "build"
}
```

### Các trường quan trọng

| Trường | Mô tả | Ví dụ |
|--------|-------|-------|
| `model` | Model AI chính | `"anthropic/claude-sonnet-4-6"` |
| `small_model` | Model cho tác vụ nhỏ | `"anthropic/claude-sonnet-4-6"` |
| `default_agent` | Agent mặc định | `"build"`, `"plan"`, `"general"` |
| `shell` | Shell mặc định | `"/bin/zsh"`, `"cmd.exe"` |
| `logLevel` | Mức log | `"DEBUG"`, `"INFO"`, `"WARN"`, `"ERROR"` |
| `share` | Chia sẻ session | `"manual"`, `"auto"`, `"disabled"` |
| `autoupdate` | Tự động cập nhật | `true`, `false`, `"notify"` |

---

## Các lệnh chính

### Lệnh cơ bản

```bash
# Khởi chạy opencode
opencode

# Khởi tạo cấu hình mới
opencode init

# Cập nhật phiên bản
opencode update

# Xem thông tin
opencode --help
opencode --version
```

### Lệnh quản lý cấu hình

```bash
# Kiểm tra cấu hình hợp lệ
opencode config validate

# Xem cấu hình hiện tại
opencode config show

# Đặt lại cấu hình
opencode config reset
```

### Lệnh quản lý plugin

```bash
# Cài đặt plugin
opencode plugin install <plugin-name>

# Gỡ plugin
opencode plugin remove <plugin-name>

# Danh sách plugin đã cài
opencode plugin list
```

---

## Cấu hình nâng cao

### 1. Agents (Đại lý)

Agents là các trợ lý AI chuyên biệt cho từng tác vụ.

#### Tạo agent mới

Tạo file `.opencode/agent/my-agent.md`:

```markdown
---
description: Agent chuyên review code
mode: subagent
model: anthropic/claude-sonnet-4-6
permission:
  edit: deny
  bash: ask
---

Bạn là chuyên gia review code. Tập trung vào:
- Code quality
- Security vulnerabilities
- Performance issues
- Best practices
```

#### Cấu hình trong opencode.json

```json
{
  "agent": {
    "code-reviewer": {
      "description": "Review code for quality",
      "mode": "subagent",
      "model": "anthropic/claude-sonnet-4-6",
      "permission": {
        "edit": "deny",
        "bash": "ask"
      },
      "prompt": "You are a code reviewer..."
    }
  }
}
```

#### Các agent có sẵn

| Agent | Chức năng |
|-------|-----------|
| `build` | Viết code, debug |
| `plan` | Lập kế hoạch |
| `general` | general tasks |
| `explore` | Khám phá codebase |

### 2. Commands (Lệnh tùy chỉnh)

#### Tạo command mới

Tạo file `.opencode/command/deploy.md`:

```markdown
---
description: Deploy application to production
agent: build
model: anthropic/claude-sonnet-4-6
---

Triển khai ứng dụng lên production:
1. Chạy tests
2. Build production
3. Deploy lên server
4. Kiểm tra health check

Arguments: $ARGUMENTS
```

#### Sử dụng command

```bash
opencode /deploy
opencode /deploy --env production
```

### 3. Skills (Kỹ năng)

Skills là các hướng dẫn chuyên biệt cho domain cụ thể.

#### Cấu trúc thư mục

```
.opencode/skills/
└── my-skill/
    └── SKILL.md
```

#### File SKILL.md

```markdown
---
name: my-skill
description: Hướng dẫn phát triển React best practices
---

# React Best Practices

## Component Structure
- Sử dụng functional components
- Hook cho state management
- Props drilling nên tránh

## Examples
```jsx
function Button({ onClick, children }) {
  return (
    <button onClick={onClick}>
      {children}
    </button>
  );
}
```
```

### 4. Plugins

#### Cài đặt plugin từ npm

```json
{
  "plugin": [
    "opencode-gemini-auth",
    "opencode-foo@1.2.3",
    "./local-plugin.ts",
    ["opencode-bar", { "option": "value" }]
  ]
}
```

#### Tạo plugin locally

Tạo file `.opencode/plugin/my-plugin.ts`:

```typescript
import type { Plugin } from "@opencode-ai/plugin"

export default (async ({ client, project, directory, $ }) => {
  return {
    config: (cfg) => {
      // Modify config
    },
    "tool.execute.before": async (input, output) => {
      // Modify tool args before execution
    },
  }
}) satisfies Plugin
```

### 5. MCP Servers (Model Context Protocol)

```json
{
  "mcp": {
    "playwright": {
      "type": "local",
      "command": ["npx", "-y", "@playwright/mcp"],
      "enabled": true,
      "environment": {
        "BROWSER": "chromium"
      }
    },
    "github": {
      "type": "remote",
      "url": "https://...",
      "enabled": true,
      "headers": {
        "Authorization": "Bearer {env:GITHUB_TOKEN}"
      }
    }
  }
}
```

### 6. Quyền hạn (Permissions)

```json
{
  "permission": {
    "edit": "deny",
    "bash": {
      "git *": "allow",
      "rm *": "deny",
      "*": "ask"
    },
    "external_directory": {
      "~/secrets/**": "deny",
      "*": "allow"
    }
  }
}
```

#### Các hành động

| Hành động | Mô tả |
|-----------|-------|
| `allow` | Cho phép thực thi |
| `ask` | Hỏi người dùng |
| `deny` | Từ chối |

#### Thứ tự đánh giá

- Insertion order matters
- Quy tắc cuối cùng được ưu tiên
- Đặt quy tắc rộng trước, hẹp sau

---

## Usecase thực tế

### 1. Phát triển Web Application

```json
{
  "model": "anthropic/claude-sonnet-4-6",
  "agent": {
    "frontend": {
      "description": "React developer",
      "mode": "subagent",
      "prompt": "Bạn là chuyên gia React/TypeScript..."
    },
    "backend": {
      "description": "Node.js developer",
      "mode": "subagent",
      "prompt": "Bạn là chuyên gia Node.js/Express..."
    }
  }
}
```

**Sử dụng:**
```bash
opencode /frontend "Tạo component Login"
opencode /backend "Tạo API authentication"
```

### 2. Code Review & Quality

```json
{
  "agent": {
    "reviewer": {
      "description": "Code review",
      "mode": "subagent",
      "permission": { "edit": "deny" },
      "prompt": "Review code cho security, performance, best practices"
    }
  }
}
```

**Sử dụng:**
```bash
opencode /reviewer "Review file src/auth.ts"
```

### 3. DevOps & Deployment

```json
{
  "command": {
    "deploy": {
      "description": "Deploy to production",
      "template": "Deploy application với các bước:\n1. Test\n2. Build\n3. Deploy\n4. Health check"
    },
    "rollback": {
      "description": "Rollback version",
      "template": "Rollback về version trước: $ARGUMENTS"
    }
  }
}
```

### 4. Documentation

```json
{
  "skills": {
    "paths": [".opencode/skills"]
  }
}
```

Tạo skill `.opencode/skills/docs/SKILL.md`:

```markdown
---
name: docs
description: Tạo documentation cho project
---

# Documentation Guidelines
- Sử dụng Markdown
- Code examples đầy đủ
- API reference chi tiết
```

### 5. Testing

```json
{
  "agent": {
    "tester": {
      "description": "Tạo và chạy tests",
      "mode": "subagent",
      "prompt": "Tạo unit test, integration test cho code"
    }
  }
}
```

---

## Ví dụ cụ thể

### Ví dụ 1: Tạo project mới

```bash
# Khởi tạo
mkdir my-app && cd my-app
opencode init

# Cấu hình model
cat > opencode.json << EOF
{
  "\$schema": "https://opencode.ai/config.json",
  "model": "anthropic/claude-sonnet-4-6",
  "default_agent": "build"
}
EOF

# Bắt đầu code
opencode
```

### Ví dụ 2: Tạo React Component

```bash
opencode "Tạo React component Button với props:
- onClick: function
- children: ReactNode
- variant: 'primary' | 'secondary'
- size: 'sm' | 'md' | 'lg'
Sử dụng TypeScript và TailwindCSS"
```

### Ví dụ 3: Debug lỗi

```bash
opencode "Debug lỗi TypeError: Cannot read property 'map' của undefined
trong file src/components/List.tsx"
```

### Ví dụ 4: Refactor code

```bash
opencode "Refactor function calculateTotal trong src/utils/calc.ts
thành pure function với proper error handling"
```

### Ví dụ 5: Tạo API

```bash
opencode "Tạo REST API với Express:
- GET /users
- GET /users/:id
- POST /users
- PUT /users/:id
- DELETE /users/:id
Sử dụng TypeScript, validation, error handling"
```

### Ví dụ 6: Tạo test

```bash
opencode "Tạo unit test cho function validateEmail
trong src/utils/validator.ts với Jest"
```

### Ví dụ 7: Viết documentation

```bash
opencode "Viết README.md cho project bao gồm:
- Overview
- Installation
- Usage
- API Reference
- Contributing"
```

### Ví dụ 8: Setup CI/CD

```bash
opencode "Tạo GitHub Actions workflow cho:
- Lint code
- Run tests
- Build
- Deploy lên Vercel"
```

---

## Khắc phục sự cố

### Lỗi cấu hình

**Triệu chứng:** opencode không khởi động được

**Giải pháp:**
```bash
# Sử dụng env var để bypass config lỗi
OPENCODE_DISABLE_PROJECT_CONFIG=1 opencode

# Hoặc chỉ định config file khác
OPENCODE_CONFIG=/path/to/valid/config.json opencode

# Hoặc inject inline config
OPENCODE_CONFIG_CONTENT='{"$schema":"https://opencode.ai/config.json"}' opencode
```

### Lỗi plugin

**Triệu chứng:** Plugin không hoạt động

**Giải pháp:**
```bash
# Vô hiệu hóa default plugins
OPENCODE_DISABLE_DEFAULT_PLUGINS=1 opencode

# Hoặc skip external plugins
OPENCODE_PURE=1 opencode
```

### Lỗi skill

**Triệu chứng:** Skill không load

**Giải pháp:**
```bash
# Vô hiệu hóa external skills
OPENCODE_DISABLE_EXTERNAL_SKILLS=1 opencode

# Hoặc skip Claude Code skills
OPENCODE_DISABLE_CLAUDE_CODE_SKILLS=1 opencode
```

### Lỗi model

**Triệu chứng:** Model không hoạt động

**Giải pháp:**
- Kiểm tra API key trong provider config
- Đảm bảo model name đúng format: `provider/model-id`
- Kiểm tra quota/credit

### Cache issues

```bash
# Xóa cache
rm -rf ~/.config/opencode/cache

# Hoặc reset toàn bộ
opencode config reset
```

---

## Mẹo nâng cao

### 1. Sử dụng References

```json
{
  "references": {
    "docs": {
      "path": "../docs",
      "description": "Product documentation"
    },
    "sdk": {
      "repository": "owner/sdk",
      "branch": "main",
      "description": "SDK reference"
    }
  }
}
```

Sử dụng trong chat: `@docs`, `@sdk`

### 2. Compaction (Nén context)

```json
{
  "compaction": {
    "auto": true,
    "tail_turns": 15
  }
}
```

### 3. Tool Output Limits

```json
{
  "tool_output": {
    "max_lines": 200,
    "max_bytes": 8192
  }
}
```

### 4. Experimental Features

```json
{
  "experimental": {
    "primary_tools": ["edit"],
    "mcp_timeout": 30000
  }
}
```

### 5. Formatter & LSP

```json
{
  "formatter": false,
  "lsp": false
}
```

---

## Tóm tắt

OpenCode CLI là công cụ mạnh mẽ với khả năng tùy chỉnh cao:

- ✅ Nhiều model AI hỗ trợ
- ✅ Hệ thống agent linh hoạt
- ✅ Plugin ecosystem phong phú
- ✅ Quyền hạn chi tiết
- ✅ MCP server integration
- ✅ Cross-platform (Windows, macOS, Linux)

### Tài nguyên tham khảo

- Documentation: https://opencode.ai
- Config Schema: https://opencode.ai/config.json
- GitHub: https://github.com/opencode-ai

---

*Cập nhật lần cuối: Tháng 9, 2026*