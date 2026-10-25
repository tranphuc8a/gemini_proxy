/** Hard cases for render-by-block: [name, markdown]. Shared by blocks.test.tsx. */
export const CASES: Array<[string, string]> = [
  ['paragraphs', 'one\n\ntwo\n\nthree'],
  ['loose list', '- a\n\n- b\n\n- c\n\nafter'],
  ['numbered list with blank lines', '1. a\n\n2. b\n\n3. c'],
  ['list item with a second paragraph', '- a\n\n  more of a\n\n- b'],
  ['nested list', '- a\n  - b\n\n  - c\n\n- d'],
  ['fence with blank lines', 'before\n\n```js\nlet a = 1\n\nlet b = 2\n```\n\nafter'],
  ['tilde fence holding backticks', '~~~\n```\n\n```\n~~~\n\nafter'],
  ['four-backtick fence holding three', '````md\n```\n\n```\n````\n\nafter'],
  ['fence inside a list item', '- item\n\n  ```\n  a\n\n  b\n  ```\n\n- next'],
  ['$$ with a blank line', '$$\na = b\n\nc = d\n$$\n\nafter'],
  ['$$ opening with text', '$$ a = b\n\n+ c $$\n\nafter'],
  ['details with markdown inside', '<details>\n<summary>More</summary>\n\nHidden **bold**\n\n- x\n\n</details>\n\nafter'],
  ['nested divs', '<div>\n\n<div>\n\ninner\n\n</div>\n\n</div>\n\nafter'],
  ['html comment with a blank line', 'a\n\n<!--\nnote\n\nmore\n-->\n\nb'],
  ['script block', '<script>\nvar a\n\nvar b\n</script>\n\nafter'],
  ['indented code block', 'text\n\n    code one\n\n    code two\n\nafter'],
  ['setext heading', 'Title\n=====\n\ntext\n\nSub\n---\n\nmore'],
  ['table', '| a | b |\n|---|---|\n| 1 | 2 |\n\nafter\n\n| c |\n|---|\n| 3 |'],
  ['blockquotes', '> a\n\n> b\n\n> c\n> d'],
  ['duplicate headings', '# Same\n\ntext\n\n# Same\n\ntext\n\n## Same'],
  ['rules', 'a\n\n---\n\nb\n\n***\n\nc'],
  ['task list', '- [ ] a\n\n- [x] b\n\nafter'],
  ['reference links', 'See [the docs][d] and [other][o].\n\n[d]: https://example.com/d "Docs"\n\n[o]: https://example.com/o\n\nAnother [d] here.'],
  ['reference link defined last', 'Use [x] here.\n\ntext\n\n[x]: https://example.com'],
  ['prices', 'It costs $5 and $10.\n\nThen $20 and $30 more.'],
  ['lone bracket math', '\\[\na^2\n\nb^2\n\\]\n\nafter'],
  ['environment with a blank line', '\\begin{align}\na &= b \\\\\n\nc &= d\n\\end{align}\n\nafter'],
  ['plantuml with a blank line', '@startuml\nA -> B\n\nB -> C\n@enduml\n\nafter'],
  ['mermaid with a blank line', '```mermaid\ngraph TD\n  A --> B\n\n  B --> C\n```\n\nafter'],
  ['front matter with a blank line', '---\ntitle: x\n\ntags: y\n---\n\n# Hello\n\ntext'],
  ['html block then markdown', '<p>raw</p>\n\n**bold**\n\n<p>raw2</p>'],
  ['crlf line endings', 'a\r\n\r\n```js\r\nx\r\n\r\ny\r\n```\r\n\r\nb'],
  ['leading and trailing blank lines', '\n\nfirst\n\nsecond\n\n']
]

/**
 * Cases of the LLM formats (md-render 4–8, batch M6). Kept apart from CASES so the seeded random assemblies of CASES keep
 * the sequence they always had; blocks.test.tsx runs these alone and assembled among themselves.
 */
export const LLM_CASES: Array<[string, string]> = [
  ['alert with a blank line after it', '> [!NOTE]\n> a\n\n> [!tip]- folded\n> b\n\nafter'],
  ['alert with markdown and a list', '> [!WARNING] Mind the **gap**\n> - one\n> - two\n>\n> text\n\nafter'],
  ['citations around code', 'claim [cite: 1, 2] and 【4:0†source】\n\n`[cite: 3]` and ⟦7⟧\n\n```\n[cite: 9]\n```'],
  ['highlights', 'a ==hi== b\n\n==two\nlines== and `==x==`\n\n$a==b$'],
  ['front matter then a fence with a title', '---\ntitle: x\ntags: [a]\n---\n\n```python title="main.py"\nprint(1)\n\nprint(2)\n```\n\nafter'],
  ['a later block that looks like front matter', 'first\n\n---\ntitle: x\n---\n\nlast'],
  ['mmd fence with a blank line', '```mmd\ngraph TD\n  A --> B\n\n  B --> C\n```\n\nafter'],
  ['svg fence', 'before\n\n```svg\n<svg viewBox="0 0 4 4"><circle r="1"/></svg>\n```\n\nafter'],
  ['raw svg with a blank line inside', 'before\n\n<svg viewBox="0 0 4 4">\n  <circle r="1"/>\n\n  <rect width="2" height="2"/>\n</svg>\n\nafter']
]
