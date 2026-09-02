# 📝 Markdown Editor - Quick Reference Guide

## 🚀 Start Here

```bash
npm install          # Install dependencies (1 time only)
npm run dev          # Start development server
npm run build        # Create production build
npm run preview      # Test production build
npm run lint         # Check code quality
npm run type-check   # Verify TypeScript types
```

---

## 🔐 Admin Login

**Button**: 🔐 (bottom-right corner)  
**Key**: `markdown-editor-admin-2024`

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Z` / `Cmd+Z` | Undo |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo |
| `Tab` | Indent (2 spaces) |
| `Enter` | Confirm in modals |

---

## ✨ Markdown Syntax Cheat Sheet

### Headers
```markdown
# H1
## H2
### H3
```

### Text
```markdown
**bold**
*italic*
***bold italic***
~~strikethrough~~
```

### Lists
```markdown
- Bullet point
  - Nested item
1. Numbered item
```

### Code
```markdown
`inline code`

\`\`\`language
code block
\`\`\`
```

### Links & Images
```markdown
[Link](url)
![Alt](image-url)
```

### Tables
```markdown
| Col 1 | Col 2 |
|-------|-------|
| Data  | Data  |
```

### Math
```markdown
$E = mc^2$

$$\frac{a}{b}$$
```

### Diagrams (Mermaid)
````markdown
\`\`\`mermaid
graph TD
    A --> B
\`\`\`
````

---

## 🎨 Features

- ✅ Live markdown preview
- ✅ File management with folders
- ✅ Undo/redo history
- ✅ Scroll synchronization
- ✅ Dark mode
- ✅ GitHub markdown theme
- ✅ Math formulas (LaTeX)
- ✅ Mermaid diagrams
- ✅ Admin authentication
- ✅ Auto-save to browser storage

---

## 📁 File Operations

| Action | Button | Admin Only |
|--------|--------|-----------|
| Create | ➕ | Yes |
| Rename | ✏️ | Yes |
| Delete | 🗑️ | Yes |
| Select | Click | No |

---

## 🔧 Toolbar Icons

| Icon | Action |
|------|--------|
| ↶ | Undo |
| ↷ | Redo |
| 🔗 | Toggle scroll sync |
| 🌙 | Toggle dark mode |
| 👤 | User status (admin/view) |
| Logout | Exit admin mode |
| 🔐 | Admin login (bottom-right) |

---

## 🎯 Admin Features

Only for logged-in admins:
- Create files and folders
- Edit file content
- Rename files
- Delete files
- See "Admin" status in header

---

## 📍 File Location Structure

```
Left Panel (Sidebar)
  └─ 📁 My Documents
     ├─ 📄 file1.md (click to edit)
     ├─ 📁 Folder
     │  └─ 📄 nested-file.md
     └─ 📄 file2.md

Middle Panel (Editor)
  └─ Write markdown here

Right Panel (Preview)
  └─ Live preview renders here
```

---

## 💾 Saving

- **Automatic**: Every 5 seconds
- **Storage**: Browser localStorage (5-10MB limit)
- **Persistence**: Survives page refresh
- **Scope**: Per browser/device

---

## 🌓 Dark Mode

- Click 🌙 in top-right
- Applies GitHub dark theme
- Automatically saved

---

## 🔗 Scroll Sync

- Click 🔗 to enable/disable
- Syncs editor and preview scrolling
- Helps track content position

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| Can't login | Check key is exactly: `markdown-editor-admin-2024` |
| Files not saving | Clear browser cache and try again |
| Markdown not rendering | Check syntax, verify code block markers |
| Scroll sync not working | Toggle off/on, refresh page |
| Dark mode looks odd | Clear cache, F5 refresh |

---

## 📚 Resources

- **Guide**: [GETTING_STARTED.md](GETTING_STARTED.md)
- **Full Docs**: [README.md](README.md)
- **Architecture**: [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)
- **Markdown Help**: https://www.markdownguide.org/
- **GitHub Markdown**: https://github.github.com/gfm/

---

## 🎓 Admin Key Change

**Before production:**
1. Open `src/store.ts`
2. Find line: `const ADMIN_KEY = 'markdown-editor-admin-2024'`
3. Change to your secret: `const ADMIN_KEY = 'your-secret-key'`
4. Run `npm run build`

---

## 🌐 Deploy to Web

```bash
npm run build              # Creates dist/ folder
# Upload contents of dist/ to web server
```

Deployment options:
- **Vercel**: `vercel`
- **Netlify**: `netlify deploy --prod --dir=dist`
- **GitHub Pages**: Push dist/ to gh-pages branch
- **Traditional Server**: FTP/SSH upload dist/

---

## ☝️ Quick Tips

1. **Use keyboard shortcuts** - Faster than mouse
2. **Create folder structure** - Keep files organized
3. **Enable scroll sync** - Easier to follow documents
4. **Use dark mode** - Better for night coding
5. **Copy markdown** - Ctrl+A, Ctrl+C to export

---

## 📞 Getting Help

1. Check **Troubleshooting** in README.md
2. Review **GETTING_STARTED.md** examples
3. Verify markdown syntax at markdownguide.org
4. Check browser console for errors (F12)

---

## 🎉 You're Ready!

Start creating amazing markdown documents now!

```
npm run dev → Click 🔐 → Enter key → Start writing! 📝
```

---

**Last Updated**: 2024  
**Version**: 1.0  
**Status**: Production Ready ✅
