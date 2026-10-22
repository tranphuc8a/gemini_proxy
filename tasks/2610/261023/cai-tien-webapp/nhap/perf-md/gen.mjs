// Transpile real sources (read-only) from the repo into ./gen so node can import them.
import ts from 'typescript'
import fs from 'node:fs'
import path from 'node:path'

const SRC = 'C:/Users/tranphuc8a/Desktop/gemini_proxy/markdown-editor/src/lib'
const OUT = path.resolve('gen')
fs.mkdirSync(OUT, { recursive: true })
for (const name of ['rehypeEnhance', 'markdown', 'tree', 'paneSync', 'id']) {
  const code = fs.readFileSync(`${SRC}/${name}.ts`, 'utf8')
  let js = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  js = js.replace(/from '\.\/(markdown|tree|paneSync|id)'/g, "from './$1.mjs'")
  fs.writeFileSync(`${OUT}/${name}.mjs`, js)
}
console.log('ok')
