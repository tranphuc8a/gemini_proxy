# 🎯 NEXT STEPS - Start Using Your Markdown Editor

## ✅ Project Successfully Created!

Your markdown editor is complete and ready to use. Follow these steps to get started:

---

## Step 1: Open Terminal

Navigate to the markdown-editor directory:
```bash
cd markdown-editor
```

---

## Step 2: Install Dependencies (One-Time Setup)

Install all required packages:
```bash
npm install
```

This will download ~500MB to `node_modules/` folder. Takes 2-5 minutes depending on internet speed.

---

## Step 3: Start Development Server

Launch the development server:
```bash
npm run dev
```

You should see:
```
  VITE v5.0.8  ready in 123 ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

Your browser should automatically open at `http://localhost:5173/`

---

## Step 4: Login as Admin

1. Click the 🔐 button in the **bottom-right corner**
2. A login modal will appear
3. Enter the admin key: **`markdown-editor-admin-2024`**
4. Click "Login"
5. You should now see "👤 Admin" in the top-right

---

## Step 5: Create Your First Document

1. Click the ➕ button in the sidebar (next to "📁 Files")
2. Type a filename like `welcome.md`
3. Make sure "File" is selected (not "Folder")
4. Click "Create"
5. Start typing markdown in the editor!

---

## Step 6: See Your First Preview

As you type markdown in the left panel:
- **Bold**: `**text**` → Bold appears in preview
- **Headers**: `# Title` → Large title appears
- **Lists**: `- item` → Bullet list appears
- **Links**: `[text](url)` → Clickable link appears
- **Code**: Use triple backticks for code blocks

---

## 🎨 Explore Features

### Toolbar Buttons
- **↶ Undo** - Goes back to previous edits
- **↷ Redo** - Goes forward in history
- **🔗 Sync On/Off** - Auto-scroll between editor and preview
- **🌙** - Toggle dark mode
- **👤 Admin** - Shows you're logged in
- **Logout** - Exit admin mode

### Sidebar Actions
- **➕** - Create new file or folder
- **✏️** - Rename files (appears on hover)
- **🗑️** - Delete files (appears on hover)
- **Click file** - Opens that file to edit
- **▶ / ▼** - Expand/collapse folders

---

## 📝 Try These Examples

### Example 1: Simple Document
```markdown
# My First Document

This is **bold** text.
This is *italic* text.

## Section 1
Some content here.

## Section 2
More content here.
```

### Example 2: With Table
```markdown
# Product Comparison

| Feature | Product A | Product B |
|---------|-----------|-----------|
| Price   | $100      | $150      |
| Speed   | Fast      | Very Fast |
| Quality | Good      | Excellent |
```

### Example 3: With Code
```markdown
# Programming Tips

Here's a JavaScript example:

\`\`\`javascript
function greet(name) {
  console.log(`Hello, ${name}!`);
}
\`\`\`
```

### Example 4: With Link
```markdown
# My Favorite Websites

Check out these awesome resources:

- [GitHub](https://github.com)
- [Markdown Guide](https://www.markdownguide.org/)
- [Google](https://google.com)
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | What It Does |
|----------|-------------|
| `Ctrl+Z` | Undo last change |
| `Ctrl+Y` | Redo last change |
| `Tab` | Add indent (2 spaces) |
| `Enter` | Confirm in forms/modals |

---

## 💾 Important: Auto-Save

✅ **Your documents auto-save every 5 seconds**

The data is stored in your browser's localStorage:
- Survives page refresh
- Works offline
- Per-browser (not synced across devices)
- Limited to ~5-10MB per domain

---

## 🌓 Try Dark Mode

1. Click the 🌙 button in the top-right
2. The entire app switches to dark theme
3. Perfect for night-time editing
4. Setting is automatically saved

---

## 📚 Documentation

When you need help:

| Document | Use For |
|----------|---------|
| `README.md` | Full feature list, troubleshooting, deployment |
| `GETTING_STARTED.md` | Step-by-step examples and tips |
| `QUICK_REFERENCE.md` | Markdown cheat sheet and shortcuts |
| `PROJECT_STRUCTURE.md` | Understanding how it's built |

---

## 🔄 File Management Tips

### Creating Folders
1. Click ➕
2. Type folder name
3. Click "Folder ✓" to toggle to folder mode
4. Click "Create"

### Organizing Files
1. Create a folder for each project/category
2. Create files inside folders
3. Use clear naming like `project-name.md`
4. Click a file to switch between them

### Renaming Files
1. Hover over a file
2. Click ✏️ icon
3. Type new name
4. Press Enter

### Deleting Files
1. Hover over a file
2. Click 🗑️ icon
3. Confirm deletion
4. File is gone forever (use carefully!)

---

## ⚙️ Customization

### Change Admin Key (IMPORTANT for Production)

⚠️ Before sharing or deploying, change the admin key!

1. Open file: `src/store.ts`
2. Find this line (around line 9):
   ```typescript
   const ADMIN_KEY = 'markdown-editor-admin-2024'
   ```
3. Change to your secret:
   ```typescript
   const ADMIN_KEY = 'your-new-secret-key'
   ```
4. Run `npm run build` to create production build

### Change Theme Colors

Edit `src/components/Preview.css` to customize colors for:
- Links (currently blue `#0969da`)
- Code blocks (currently `#f6f8fa`)
- Borders (currently `#d0d7de`)
- And more!

---

## 🚀 When You're Ready for Production

### Build for Deployment
```bash
npm run build
```

This creates a `dist/` folder with everything needed.

### Test Production Build
```bash
npm run preview
```

Tests the production version locally.

### Deploy to Web

**Option 1: Vercel (Easiest)**
```bash
npm install -g vercel
vercel
```

**Option 2: Netlify**
```bash
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

**Option 3: GitHub Pages**
- Push `dist/` contents to gh-pages branch

---

## 🎓 Learning Resources

Helpful links for markdown and this project:

- [Markdown Guide](https://www.markdownguide.org/) - Learn markdown syntax
- [GitHub Markdown](https://github.github.com/gfm/) - GitHub's flavor
- [KaTeX](https://katex.org/) - Math formula syntax
- [Mermaid](https://mermaid.js.org/) - Diagram syntax
- [React Docs](https://react.dev/) - If you want to modify code

---

## ❓ Common Questions

**Q: How do I logout?**
A: Click "Logout" button in the top-right header.

**Q: Can I export my documents?**
A: Select all text (Ctrl+A), copy (Ctrl+C), paste in a `.md` file.

**Q: Is my data secure?**
A: Data is stored locally in your browser only. Not sent anywhere.

**Q: Can I use this offline?**
A: Yes! Works completely offline once loaded.

**Q: What if I close the browser?**
A: Everything is saved. Reload the page and your documents are there.

**Q: Can I sync across devices?**
A: Currently no. Data is per-browser. Could add backend later.

---

## 🆘 Something Not Working?

Try these troubleshooting steps:

1. **Hard refresh**: Press `Ctrl+F5` or `Cmd+Shift+R`
2. **Clear cache**: Open DevTools (F12) → Application → Clear storage
3. **Restart server**: Stop (Ctrl+C) and run `npm run dev` again
4. **Check console**: Press F12, look at Console tab for errors
5. **Try different browser**: Firefox, Chrome, Safari, Edge

For more help, check `README.md` troubleshooting section.

---

## ✨ You're All Set!

Everything is ready to use. Your next steps:

1. ✅ Run `npm install` (if not already done)
2. ✅ Run `npm run dev`
3. ✅ Click 🔐 and login
4. ✅ Create first document
5. ✅ Start writing amazing markdown!

---

## 🎉 Enjoy!

You now have a powerful, professional markdown editor running locally on your computer. 

**Have fun editing!** 📝✨

---

**Questions?** Check the documentation files included in the project.  
**Need to customize?** Read `PROJECT_STRUCTURE.md` to understand how it works.  
**Ready to deploy?** Follow the "When You're Ready for Production" section above.
