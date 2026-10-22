import { render } from './render.mjs'

const strip = (h) =>
  h
    .replace(/<span class="katex-display">[\s\S]*?<annotation encoding="application\/x-tex">([\s\S]*?)<\/annotation>[\s\S]*?<\/span><\/span><\/span>(<\/span>)*/g, '[KD:$1]')
    .replace(/<span class="katex">[\s\S]*?<annotation encoding="application\/x-tex">([\s\S]*?)<\/annotation>[\s\S]*?<\/span><\/span>(<\/span>)*/g, '[K:$1]')
    .replace(/\n+/g, ' ')

const cases = {
  'github alert NOTE': '> [!NOTE]\n> Useful information.',
  'github alert WARNING': '> [!WARNING]\n> Careful.',
  'footnote': 'Text[^1].\n\n[^1]: The note.',
  'task list': '- [x] done\n- [ ] todo',
  'table align': '| L | C | R |\n|:--|:-:|--:|\n| a | b | c |',
  'details/summary': '<details>\n<summary>More</summary>\n\nHidden **text**\n\n</details>',
  'definition list': 'Term\n: Definition',
  'highlight ==': 'This is ==important== text',
  'sub ~ sup ^': 'H~2~O and x^2^',
  'single tilde approx': 'Takes ~5 to ~10 minutes',
  'emoji shortcode': 'Great :smile: :rocket:',
  'emoji unicode': 'Great 😄 🚀',
  'code with filename meta': '```python title="main.py"\nprint(1)\n```',
  'code lang:file': '```js:app.js\nlet a = 1\n```',
  'diff': '```diff\n- old\n+ new\n```',
  'mermaid': '```mermaid\ngraph TD; A-->B\n```',
  'mmd alias': '```mmd\ngraph TD; A-->B\n```',
  'plantuml fence': '```plantuml\n@startuml\nA -> B: hi\n@enduml\n```',
  'puml fence': '```puml\nA -> B\n```',
  'bare @startuml': '@startuml\nAlice -> Bob: Hello\n@enduml',
  'graphviz dot': '```dot\ndigraph { a -> b }\n```',
  'vega-lite': '```vega-lite\n{"mark":"bar"}\n```',
  'abc': '```abc\nX:1\nK:C\nCDEF|\n```',
  'wavedrom': '```wavedrom\n{ signal: [] }\n```',
  'svg raw inline': '<svg width="10" height="10"><circle cx="5" cy="5" r="4" fill="red"/></svg>',
  'svg fence': '```svg\n<svg xmlns="http://www.w3.org/2000/svg"><circle r="4"/></svg>\n```',
  'geojson': '```geojson\n{"type":"Point","coordinates":[1,2]}\n```',
  'citation [1]': 'Fact [1] and [2].\n\n[1]: https://a.example',
  'chatgpt cite artifact': 'Fact 【4†source】 and :contentReference[oaicite:0]{index=0}',
  'gemini cite': '[cite_start]Fact here.[cite: 1, 2]',
  'sup/sub html': 'x<sup>2</sup> H<sub>2</sub>O',
  'kbd': 'Press <kbd>Ctrl</kbd>+<kbd>C</kbd>',
  'p align center': '<p align="center">Centered</p>',
  'div align center': '<div align="center">Centered</div>',
  'front matter': '---\ntitle: Hello\ntags: [a]\n---\n\n# Doc',
  'admonition :::': ':::note\nHello\n:::',
  'mkdocs !!!': '!!! note\n    Hello',
  'xss script': '<script>alert(1)</script><img src=x onerror=alert(1)>',
  'xss javascript link': '[x](javascript:alert(1))',
  'style url': '<span style="background:url(https://evil.example/t.png)">x</span>',
  'iframe': '<iframe src="https://example.com"></iframe>',
  'mermaid in details': '<details><summary>D</summary>\n\n```mermaid\ngraph TD; A-->B\n```\n\n</details>',
  'toc marker': '[TOC]\n\n# A',
  'html comment': 'a <!-- hidden --> b',
  'hard break two spaces': 'line1  \nline2',
  'br in table': '| a |\n|---|\n| x<br>y |',
  'autolink literal': 'Visit https://example.com now',
  'image data url': '![x](data:image/png;base64,iVBORw0KGgo=)',
  'heading with emoji': '## 🚀 Launch',
  'nested blockquote alert-like': '> **Note**\n> This is a note',
}

for (const [name, src] of Object.entries(cases)) {
  let out
  try {
    out = strip(render(src)).slice(0, 360)
  } catch (e) {
    out = 'CRASH ' + e
  }
  console.log(`### ${name}\n${out}\n`)
}
