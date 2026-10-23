#!/usr/bin/env node
/**
 * Chép các mô-đun toán THUẦN của Markdown Editor Pro sang gemini-chat (ke-hoach §1.5, đợt M2b).
 *
 * Nguồn thật là `markdown-editor/src/lib/`. Bản trong `frontend/src/lib/` là bản sao có dòng đầu "FILE SINH RA" —
 * sửa ở đó sẽ mất khi chạy lại lệnh này. Bộ vectơ test (`__tests__/mathVectors.ts`) cũng được chép, để hai app chạy
 * cùng một bộ vectơ trên cùng một mã.
 *
 *   node scripts/sync-math.mjs          # chép (chỉ ghi tệp nào lệch)
 *   node scripts/sync-math.mjs --thu    # chỉ báo sẽ đổi gì, không ghi
 *   node scripts/sync-math.mjs --kiem   # kiểm bản sao có lệch nguồn không — exit 1 nếu lệch (dùng cho CI / lệnh kiểm)
 *
 * "Thuần" nghĩa là: tệp nguồn chỉ được import tệp khác trong cùng bộ chép (đường dẫn `./…`), và tệp test được import
 * thêm `vitest`. Nguồn mà import gì khác thì script dừng với exit 2, vì bản sao sẽ không chạy được ở app kia.
 * So sánh bỏ qua khác biệt CRLF/LF (Git trên Windows có thể đổi kiểu xuống dòng khi checkout).
 *
 * Không phụ thuộc thư viện ngoài.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** [nguồn, đích], tương đối gốc repo. */
export const FILES = [
  ['markdown-editor/src/lib/mathDelimiters.ts', 'frontend/src/lib/mathDelimiters.ts'],
  ['markdown-editor/src/lib/remarkMathPromote.ts', 'frontend/src/lib/remarkMathPromote.ts'],
  ['markdown-editor/src/lib/katexOptions.ts', 'frontend/src/lib/katexOptions.ts'],
  ['markdown-editor/src/lib/__tests__/mathVectors.ts', 'frontend/src/lib/__tests__/mathVectors.ts'],
]

export const banner = (source) =>
  `// FILE SINH RA — ĐỪNG SỬA Ở ĐÂY. Nguồn thật: ${source}\n` +
  '// Sửa ở nguồn rồi chạy: node scripts/sync-math.mjs   (kiểm lệch: node scripts/sync-math.mjs --kiem)\n'

const lf = (text) => text.replace(/\r\n/g, '\n')

/** Specifiers of every import / re-export in a TypeScript module. */
function importsOf(text) {
  const found = []
  const pattern = /^\s*(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/gm
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) found.push(match[1])
  return found
}

/** Why `source` cannot be copied on its own, or '' when it can. */
export function impurity(source, text) {
  const dir = dirname(source)
  const siblings = new Set(FILES.map(([from]) => from).filter((from) => dirname(from) === dir).map((from) => basename(from, '.ts')))
  const parentSiblings = new Set(FILES.map(([from]) => from).filter((from) => dirname(from) === dirname(dir)).map((from) => basename(from, '.ts')))
  const isTest = dir.endsWith('__tests__')
  for (const spec of importsOf(text)) {
    if (isTest && spec === 'vitest') continue
    const local = /^\.\/([\w.-]+?)(?:\.ts)?$/.exec(spec)
    if (local && siblings.has(local[1])) continue
    const parent = /^\.\.\/([\w.-]+?)(?:\.ts)?$/.exec(spec)
    if (isTest && parent && parentSiblings.has(parent[1])) continue
    return `import '${spec}' không nằm trong bộ chép`
  }
  return ''
}

function main(argv) {
  const check = argv.includes('--kiem')
  const dry = argv.includes('--thu')
  const unknown = argv.filter((arg) => !['--kiem', '--thu'].includes(arg))
  if (unknown.length) {
    console.error(`Tham số lạ: ${unknown.join(' ')}. Dùng: node scripts/sync-math.mjs [--thu | --kiem]`)
    return 2
  }

  let drift = 0
  let written = 0
  for (const [source, target] of FILES) {
    const sourcePath = join(ROOT, source)
    const targetPath = join(ROOT, target)
    if (!existsSync(sourcePath)) {
      console.error(`THIẾU NGUỒN  ${source}`)
      return 2
    }
    const text = readFileSync(sourcePath, 'utf8')
    const why = impurity(source, text)
    if (why) {
      console.error(`KHÔNG THUẦN  ${source}: ${why}`)
      return 2
    }
    const wanted = banner(source) + lf(text)
    const current = existsSync(targetPath) ? lf(readFileSync(targetPath, 'utf8')) : null
    if (current === wanted) {
      console.log(`khớp        ${target}`)
      continue
    }
    drift++
    const state = current === null ? 'CHƯA CÓ' : 'LỆCH'
    if (check || dry) {
      console.log(`${state.padEnd(11)} ${target}  (nguồn: ${source})`)
      continue
    }
    mkdirSync(dirname(targetPath), { recursive: true })
    writeFileSync(targetPath, wanted, 'utf8')
    written++
    console.log(`đã chép     ${target}  (${state.toLowerCase()})`)
  }

  if (check) {
    if (drift) {
      console.error(`\n${drift} bản sao lệch nguồn. Chạy: node scripts/sync-math.mjs`)
      return 1
    }
    console.log(`\nĐạt: ${FILES.length} bản sao khớp nguồn.`)
    return 0
  }
  if (dry) console.log(`\n${drift} tệp sẽ được chép.`)
  else console.log(`\nĐã chép ${written} tệp; ${FILES.length - written} tệp đã khớp.`)
  return 0
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2))
}
