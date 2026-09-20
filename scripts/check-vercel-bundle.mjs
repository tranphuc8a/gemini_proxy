#!/usr/bin/env node
/**
 * Estimate what a Vercel Python function bundle will weigh, before deploying.
 *
 * Vercel bundles *every file in the project* into the function - there is no
 * tree-shaking for Python - and rejects the deployment past a size limit. The
 * failure arrives minutes into a build with nothing but a number, so this works
 * the same sum out locally.
 *
 * It applies the `excludeFiles` glob from vercel.json to the files git tracks,
 * using the same matcher Vercel does, and reports what survives. It also flags
 * folders under webapp/ that the app scanner finds no app in: those are pure
 * weight, and were what blew the limit the first time.
 *
 * Usage:
 *   node scripts/check-vercel-bundle.mjs
 *   node scripts/check-vercel-bundle.mjs --limit 225     # MB, defaults to 225
 *   node scripts/check-vercel-bundle.mjs --top 20        # biggest folders to list
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// minimatch is what node-glob matches with, and what Vercel's globs resolve
// through. Borrowed from a workspace that already depends on it so this script
// needs no install of its own.
const require = createRequire(import.meta.url)
let minimatch
for (const owner of ['frontend', 'markdown-editor', 'sql-administrator', 'postman-lite']) {
  const candidate = join(ROOT, owner, 'node_modules', 'minimatch')
  if (existsSync(candidate)) {
    const loaded = require(candidate)
    minimatch = loaded.minimatch ?? loaded
    break
  }
}
if (!minimatch) {
  console.error('minimatch not found in any workspace - run npm install in frontend/ first')
  process.exit(1)
}

const args = process.argv.slice(2)
const numberArg = (name, fallback) => {
  const at = args.indexOf(name)
  return at === -1 ? fallback : Number(args[at + 1])
}

/** Vercel's ceiling for a standard Python function bundle, in MB. */
const LIMIT_MB = numberArg('--limit', 225)
const TOP = numberArg('--top', 12)
/** Below this much headroom, say so before a deploy discovers it. */
const WARN_AT = 0.8

const MB = 1048576
const mb = (bytes) => bytes / MB

// --- what vercel.json excludes ---------------------------------------------

const configPath = join(ROOT, 'vercel.json')
if (!existsSync(configPath)) {
  console.error('vercel.json not found - nothing to check')
  process.exit(1)
}
const config = JSON.parse(readFileSync(configPath, 'utf8'))
const entry = Object.keys(config.functions ?? {})[0]
if (!entry) {
  console.error('vercel.json has no functions entry')
  process.exit(1)
}
const excludeGlob = config.functions[entry].excludeFiles ?? ''
// A comma-joined list of globs is one pattern to Vercel; split it so a miss in
// one pattern is visible rather than silently dropping the rest.
const patterns = excludeGlob.split(/,(?![^{]*})/).filter(Boolean)

const excluded = (path) => patterns.some((p) => minimatch(path, p, { dot: true }))

// --- the files that would be shipped ---------------------------------------

// Tracked files plus anything new that is not gitignored: together these are
// what reaches GitHub on the next commit, and so what Vercel would clone.
const tracked = execFileSync(
  'git',
  ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
  { cwd: ROOT, maxBuffer: 256 * 1024 * 1024 }
)
  .toString('utf8')
  .split('\0')
  .filter(Boolean)

let keptBytes = 0
let droppedBytes = 0
const byFolder = new Map()

for (const path of tracked) {
  let size
  try {
    size = statSync(join(ROOT, path)).size
  } catch {
    continue // tracked but not checked out
  }
  if (excluded(path)) {
    droppedBytes += size
    continue
  }
  keptBytes += size
  const folder = path.split('/').slice(0, 2).join('/')
  byFolder.set(folder, (byFolder.get(folder) ?? 0) + size)
}

console.log(`entrypoint : ${entry}`)
console.log(`excluded   : ${patterns.length} glob pattern(s)`)
console.log()
console.log(`shipped    : ${mb(keptBytes).toFixed(1)} MB`)
console.log(`excluded   : ${mb(droppedBytes).toFixed(1)} MB`)
console.log(`limit      : ${LIMIT_MB} MB  (Python dependencies land on top of this)`)
console.log()

console.log(`largest folders still shipped (top ${TOP}):`)
for (const [folder, size] of [...byFolder].sort((a, b) => b[1] - a[1]).slice(0, TOP)) {
  console.log(`  ${mb(size).toFixed(1).padStart(8)} MB  ${folder}`)
}

// --- webapp folders that serve nothing --------------------------------------

const WEBAPP_PREFIX = 'backend/fastapi/webapp'
const INDEX_FILE = /^(index\.html?|Index\.html|home\.html)$/

/** Split a tracked path into its webapp folder name and the rest, or null. */
function underWebapp(path) {
  const parts = path.split('/')
  if (parts.slice(0, 3).join('/') !== WEBAPP_PREFIX) return null
  if (parts.length < 5) return null
  return { name: parts[3], rest: parts.slice(4) }
}

const withIndex = new Set()
const perFolder = new Map()

for (const path of tracked) {
  const located = underWebapp(path)
  if (!located) continue

  // The scanner looks for an index file at the app root, or one level in for an
  // app that sits inside a collection folder.
  if (located.rest.length <= 2 && INDEX_FILE.test(located.rest.at(-1))) {
    withIndex.add(located.name)
  }

  if (excluded(path)) continue
  let size
  try {
    size = statSync(join(ROOT, path)).size
  } catch {
    continue
  }
  perFolder.set(located.name, (perFolder.get(located.name) ?? 0) + size)
}

const deadWeight = [...perFolder]
  .filter(([name]) => !withIndex.has(name) && !name.startsWith('_'))
  .sort((a, b) => b[1] - a[1])

if (deadWeight.length) {
  console.log()
  console.log('webapp folders with no index file - shipped but never served:')
  for (const [name, size] of deadWeight) {
    console.log(`  ${mb(size).toFixed(1).padStart(8)} MB  webapp/${name}`)
  }
  console.log('  (add an index.html to turn one into a real app, or exclude it)')
}

// --- verdict ----------------------------------------------------------------

console.log()
const used = mb(keptBytes) / LIMIT_MB
if (used >= 1) {
  console.error(`OVER THE LIMIT: ${mb(keptBytes).toFixed(1)} MB of source alone, before dependencies.`)
  process.exit(1)
}
if (used >= WARN_AT) {
  console.warn(
    `TIGHT: source fills ${(used * 100).toFixed(0)}% of the limit before dependencies are added.`
  )
  process.exit(1)
}
console.log(`OK: source fills ${(used * 100).toFixed(0)}% of the limit, leaving room for dependencies.`)
