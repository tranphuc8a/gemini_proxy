// Đo kích thước payload đồng bộ Markdown Editor Pro: hiện trạng (PUT cả cây) vs thiết kế mới (delta theo tài liệu + patch dòng).
// Chạy: node do-payload.mjs   (không đụng repo, không mạng)
import { gzipSync } from 'node:zlib'
import { webcrypto } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import { diffLines, makePatch, applyPatch, merge3 } from './proto-diff.mjs'

// ---------------------------------------------------------------- sinh workspace giả, tất định
let seed = 42
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
const WORDS = ('Hệ thống đồng bộ tài liệu phiên bản xung đột máy chủ trình duyệt ghi chú thuật toán cấu trúc dữ liệu ' +
  'the quick brown fox jumps over lazy dog markdown editor revision cursor tombstone history merge patch line ' +
  'được không những mà còn với cho của một hai ba bốn năm sáu bảy tám chín mười').split(' ')
function line() {
  const n = 4 + Math.floor(rnd() * 14)
  const w = []
  for (let i = 0; i < n; i++) w.push(WORDS[Math.floor(rnd() * WORDS.length)])
  const r = rnd()
  if (r < 0.08) return '## ' + w.join(' ')
  if (r < 0.25) return '- ' + w.join(' ')
  if (r < 0.3) return ''
  return w.join(' ') + '.'
}
function doc(targetBytes) {
  const out = []
  let size = 0
  while (size < targetBytes) {
    const l = line()
    out.push(l)
    size += Buffer.byteLength(l, 'utf8') + 1
  }
  return out.join('\n')
}
const sizes = []
for (let i = 0; i < 150; i++) sizes.push(2000 + Math.floor(rnd() * 8000))       // 150 ghi chú 2–10 KB
for (let i = 0; i < 40; i++) sizes.push(20000 + Math.floor(rnd() * 40000))      // 40 bài 20–60 KB
for (let i = 0; i < 6; i++) sizes.push(200000)                                  // 6 tài liệu 200 KB
for (let i = 0; i < 4; i++) sizes.push(1000000)                                 // 4 tài liệu 1 MB
const t0 = performance.now()
const docs = sizes.map((s, i) => ({ id: `file-${i.toString(36)}-abc12`, name: `note-${i}.md`, type: 'file', content: doc(s) }))
const genMs = performance.now() - t0
// 10 thư mục, chia đều
const folders = Array.from({ length: 10 }, (_, f) => ({ id: `folder-${f}`, name: `Folder ${f}`, type: 'folder', parentId: 'root', children: [] }))
docs.forEach((d, i) => { const f = folders[i % 10]; d.parentId = f.id; f.children.push(d) })
const tree = [{ id: 'root', name: 'My Documents', type: 'folder', children: folders }]

const utf8 = (s) => Buffer.byteLength(s, 'utf8')
const KB = (b) => (b / 1024).toFixed(1) + ' KB'
const MB = (b) => (b / 1024 / 1024).toFixed(2) + ' MB'

// ---------------------------------------------------------------- hiện trạng
const putBody = JSON.stringify({ files: tree })
const putBytes = utf8(putBody)
// Phản hồi: pydantic MarkdownDocument trả lại y nguyên + các trường null (children/content/parentId)
const respLike = JSON.stringify({ files: tree }, (k, v) => v).length
const lsPayload = JSON.stringify({ version: 2, files: tree, currentFileId: docs[0].id, expandedFolders: ['root'] })
let tStr = performance.now()
for (let i = 0; i < 5; i++) JSON.stringify({ version: 2, files: tree })
const stringifyMs = (performance.now() - tStr) / 5
const gz = gzipSync(Buffer.from(putBody)).length

console.log('=== Workspace giả lập ===')
console.log(`tài liệu: ${docs.length}, thư mục: ${folders.length + 1}, sinh trong ${genMs.toFixed(0)} ms`)
console.log(`tổng nội dung UTF-8: ${MB(docs.reduce((a, d) => a + utf8(d.content), 0))}`)
console.log('=== Hiện trạng: PUT /markdown/files ===')
console.log(`thân PUT (UTF-8): ${MB(putBytes)}  | gzip: ${MB(gz)}`)
console.log(`phản hồi PUT ≈ thân PUT (response_model trả lại cả cây): ~${MB(putBytes)}`)
console.log(`localStorage 'markdown-editor:files': ${(lsPayload.length / 1e6).toFixed(2)} triệu ký tự UTF-16`)
console.log(`JSON.stringify cả cây (mỗi lần flushPersist, 800 ms sau mỗi phím): ${stringifyMs.toFixed(1)} ms`)
console.log(`vượt trần thân yêu cầu Vercel 4,5 MB? ${putBytes > 4.5 * 1024 * 1024 ? 'CÓ' : 'không'}`)

// ---------------------------------------------------------------- thiết kế mới
const small = docs[3], big = docs[docs.length - 1]
async function sha256(text) {
  const buf = await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Buffer.from(buf).toString('hex')
}
function editOneLine(text, at) {
  const lines = text.split('\n')
  const i = Math.floor(lines.length * at)
  lines[i] = lines[i] + ' (đã sửa một chút)'
  return lines.join('\n')
}
const meta = { id: small.id, parentId: small.parentId, name: small.name, kind: 'file', baseRev: 7, order: 3 }
const smallEdited = editOneLine(small.content, 0.5)
const bigEdited = editOneLine(big.content, 0.37)

const fullSmall = JSON.stringify({ ops: [{ ...meta, op: 'put', content: smallEdited, hash: await sha256(smallEdited) }] })
let td = performance.now()
const pSmall = makePatch(small.content, smallEdited)
const diffSmallMs = performance.now() - td
td = performance.now()
const pBig = makePatch(big.content, bigEdited)
const diffBigMs = performance.now() - td
const patchSmall = JSON.stringify({ ops: [{ ...meta, op: 'patch', baseHash: await sha256(small.content), patch: pSmall, hash: await sha256(smallEdited) }] })
const patchBig = JSON.stringify({ ops: [{ ...meta, id: big.id, op: 'patch', baseHash: await sha256(big.content), patch: pBig, hash: await sha256(bigEdited) }] })
const fullBig = JSON.stringify({ ops: [{ ...meta, id: big.id, op: 'put', content: bigEdited, hash: 'x'.repeat(64) }] })
const renameOnly = JSON.stringify({ ops: [{ ...meta, op: 'meta', name: 'renamed.md' }] })
td = performance.now()
const h = await sha256(big.content)
const hashBigMs = performance.now() - td
// kiểm patch áp lại đúng
const okSmall = applyPatch(small.content, pSmall) === smallEdited
const okBig = applyPatch(big.content, pBig) === bigEdited

console.log('=== Thiết kế mới: POST /markdown/sync (chỉ thay đổi) ===')
console.log(`sửa 1 dòng tài liệu ${KB(utf8(small.content))}: gửi nguyên văn ${KB(utf8(fullSmall))} | patch ${utf8(patchSmall)} B (diff ${diffSmallMs.toFixed(1)} ms, áp lại đúng: ${okSmall})`)
console.log(`sửa 1 dòng tài liệu ${MB(utf8(big.content))}: gửi nguyên văn ${MB(utf8(fullBig))} | patch ${utf8(patchBig)} B (diff ${diffBigMs.toFixed(1)} ms, áp lại đúng: ${okBig})`)
console.log(`đổi tên / chuyển thư mục (chỉ siêu dữ liệu): ${utf8(renameOnly)} B`)
console.log(`SHA-256 (WebCrypto) tài liệu 1 MB: ${hashBigMs.toFixed(1)} ms`)
console.log(`tỉ lệ giảm khi sửa 1 dòng (so với PUT cả cây): nguyên văn ×${(putBytes / utf8(fullSmall)).toFixed(0)}, patch ×${(putBytes / utf8(patchSmall)).toFixed(0)}`)

// ---------------------------------------------------------------- diff nặng nhất: viết lại 30% tài liệu 1 MB, xáo đoạn
function heavyEdit(text) {
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) if (rnd() < 0.3) lines[i] = line()
  return lines.join('\n')
}
const bigHeavy = heavyEdit(big.content)
td = performance.now()
const pHeavy = makePatch(big.content, bigHeavy)
const heavyMs = performance.now() - td
console.log(`diff xấu: thay 30% dòng tài liệu 1 MB → patch ${MB(utf8(JSON.stringify(pHeavy)))} (${pHeavy.fallback ? 'bỏ cuộc, gửi nguyên văn' : 'patch'}) trong ${heavyMs.toFixed(0)} ms, đúng: ${applyPatch(big.content, pHeavy) === bigHeavy}`)

// ---------------------------------------------------------------- merge 3 chiều
const base = small.content
const ours = editOneLine(base, 0.2)
const theirs = editOneLine(base, 0.8)
const m1 = merge3(base, ours, theirs)
const both = editOneLine(base, 0.5)
const m2 = merge3(base, both, editOneLine(editOneLine(base, 0.5), 0.5))
console.log('=== Merge 3 chiều theo dòng ===')
console.log(`hai bên sửa hai chỗ khác nhau: xung đột=${m1.conflicts}, có cả hai sửa: ${m1.text.includes('(đã sửa một chút)') && m1.text.split('(đã sửa một chút)').length === 3}`)
console.log(`hai bên sửa cùng một dòng khác nhau: xung đột=${m2.conflicts}`)
td = performance.now()
const m3 = merge3(big.content, bigEdited, editOneLine(big.content, 0.9))
console.log(`merge tài liệu 1 MB, hai sửa khác chỗ: xung đột=${m3.conflicts}, ${(performance.now() - td).toFixed(0)} ms`)

// ---------------------------------------------------------------- lịch sử phía máy chủ: 50 phiên bản của tài liệu 1 MB
let prev = big.content
let fullHist = 0, deltaHist = 0, deltaHistGz = 0
for (let v = 0; v < 50; v++) {
  const next = editOneLine(prev, rnd())
  fullHist += utf8(next)
  const p = JSON.stringify(makePatch(next, prev))         // delta ngược: từ bản mới về bản cũ
  deltaHist += utf8(p)
  deltaHistGz += gzipSync(Buffer.from(p)).length
  prev = next
}
console.log('=== Lịch sử 50 phiên bản của tài liệu 1 MB (mỗi bản sửa 1 dòng) ===')
console.log(`lưu nguyên văn mỗi bản: ${MB(fullHist)} | nguyên văn gzip: ~${MB(gzipSync(Buffer.from(big.content)).length * 50)} | delta ngược: ${KB(deltaHist)} | delta ngược gzip: ${KB(deltaHistGz)} (+ 1 bản đầy đủ mới nhất)`)
