// Transpile the real pipeline sources from the repo (read-only) into ./gen
import ts from 'typescript'
import fs from 'node:fs'
import path from 'node:path'

const SRC = 'C:/Users/tranphuc8a/Desktop/gemini_proxy/markdown-editor/src/lib'
const OUT = path.resolve('gen')
fs.mkdirSync(OUT, { recursive: true })
for (const name of ['rehypeEnhance', 'markdown']) {
  const code = fs.readFileSync(`${SRC}/${name}.ts`, 'utf8')
  let js = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  js = js.replace(/from '\.\/markdown'/g, "from './markdown.mjs'")
  fs.writeFileSync(`${OUT}/${name}.mjs`, js)
}
console.log('ok')
