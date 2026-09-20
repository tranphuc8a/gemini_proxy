#!/usr/bin/env node
/**
 * Estimate what a Vercel Python function bundle will weigh, before deploying.
 *
 * Vercel bundles *every file in the project* into the function - its Python docs
 * say plainly that there is no automatic tree-shaking for Python - and rejects
 * the deployment past a size limit. The failure arrives minutes into a build
 * with nothing but a number, so this works the same sum out locally.
 *
 * THE PROJECT ROOT IS NOT THE REPO ROOT. Vercel resolves a FastAPI entrypoint
 * from `main.py` or `src/main.py` *relative to the project root*, and the only
 * such file in this repo is `backend/fastapi/src/main.py`. So the Vercel
 * project's Root Directory is `backend/fastapi`: that is where vercel.json has
 * to live, what its globs are relative to, and the only directory that reaches
 * the bundle at all.
 *
 * Getting that wrong is what let an earlier version of this script report a
 * comfortable "OK" while the deployment kept failing at exactly the same size.
 *
 * MEASURED, NOT ASSUMED: `excludeFiles` does nothing for the Python framework
 * preset. Two deployments with different vercel.json files - one at the repo
 * root, one at the project root with the correct entrypoint key - produced the
 * identical 234.03 MB. Source is 179.1 MB, so dependencies are 54.9 MB and
 * every excluded file was shipped anyway. This script therefore reports the
 * bundle WITHOUT the exclusions, and shows separately what they would save if
 * Vercel ever honoured them.
 *
 * Usage:
 *   node scripts/check-vercel-bundle.mjs
 *   node scripts/check-vercel-bundle.mjs --root backend/fastapi
 *   node scripts/check-vercel-bundle.mjs --limit 225   # test the standard ceiling
 *   node scripts/check-vercel-bundle.mjs --deps 55     # MB, installed packages
 *   node scripts/check-vercel-bundle.mjs --top 20
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const args = process.argv.slice(2)
const option = (name, fallback) => {
  const at = args.indexOf(name)
  return at === -1 ? fallback : args[at + 1]
}
const numberOption = (name, fallback) => Number(option(name, fallback))

/** The Vercel project's Root Directory, relative to the repo. */
const PROJECT_ROOT = option('--root', 'backend/fastapi')
/**
 * Size a bundle must stay under to deploy without the Large Functions beta.
 *
 * Vercel's docs say 500 MB for Python, but the build that failed here reported
 * 225 MB. Trust the log.
 */
const STANDARD_LIMIT_MB = 225
/**
 * Ceiling once Large Functions is on, which this project enables through the
 * VERCEL_SUPPORT_LARGE_FUNCTIONS environment variable. A build log confirms it:
 * `Function "src/main.py" exceeds the standard size limit; enabling large
 * functions (beta).`
 */
const LARGE_LIMIT_MB = 5000
const LIMIT_MB = numberOption('--limit', LARGE_LIMIT_MB)
/**
 * What the installed packages weigh after Vercel optimises them.
 *
 * Derived, not guessed: a build reported 234.03 MB total against 179.1 MB of
 * source. Re-derive it the same way if requirements.txt changes materially.
 */
const DEPS_MB = numberOption('--deps', 54.9)
const TOP = numberOption('--top', 12)
/** Vercel's schema caps the excludeFiles string at this length. */
const EXCLUDE_MAX_CHARS = 256
/** Warn once the estimate passes this fraction of the limit. */
const WARN_AT = 0.85

const MB = 1048576
const mb = (bytes) => bytes / MB

const projectDir = join(REPO, PROJECT_ROOT)
if (!existsSync(projectDir)) {
  console.error(`Project root not found: ${PROJECT_ROOT}`)
  process.exit(1)
}

// minimatch is what node-glob matches with, and so what Vercel's globs resolve
// through. Borrowed from a workspace that already depends on it, so this script
// needs no install of its own.
const require = createRequire(import.meta.url)
let minimatch
for (const owner of ['frontend', 'markdown-editor', 'sql-administrator', 'postman-lite']) {
  const candidate = join(REPO, owner, 'node_modules', 'minimatch')
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

// --- the config Vercel will actually read -----------------------------------

const configPath = join(projectDir, 'vercel.json')
if (!existsSync(configPath)) {
  console.error(`No vercel.json in ${PROJECT_ROOT}.`)
  console.error('A vercel.json outside the Root Directory is never read.')
  process.exit(1)
}

const config = JSON.parse(readFileSync(configPath, 'utf8'))
const entry = Object.keys(config.functions ?? {})[0]
if (!entry) {
  console.error(`${PROJECT_ROOT}/vercel.json has no functions entry`)
  process.exit(1)
}

// The key has to name the entrypoint Vercel resolved. A key that matches nothing
// is ignored in silence - which is how a wrong one went unnoticed once already.
if (!existsSync(join(projectDir, entry))) {
  console.error(`functions key "${entry}" does not exist under ${PROJECT_ROOT}/.`)
  console.error('Vercel keys this by the resolved entrypoint; a key matching nothing is ignored.')
  process.exit(1)
}

const excludeGlob = config.functions[entry].excludeFiles ?? ''
if (excludeGlob.length > EXCLUDE_MAX_CHARS) {
  console.error(`excludeFiles is ${excludeGlob.length} characters; Vercel allows ${EXCLUDE_MAX_CHARS}.`)
  console.error('Drop patterns that match little, or collapse folders into one brace group.')
  process.exit(1)
}

// Commas separate patterns, except inside a {a,b} brace group.
const patterns = excludeGlob.split(/,(?![^{]*})/).filter(Boolean)
const excluded = (path) => patterns.some((p) => minimatch(path, p, { dot: true }))

// --- the files that would be shipped ----------------------------------------

// Tracked files plus anything new that is not gitignored: together these are
// what reaches GitHub on the next commit, and so what Vercel would clone.
const listed = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
  cwd: projectDir,
  maxBuffer: 256 * MB,
})
  .toString('utf8')
  .split('\n')
  .filter(Boolean)

// Everything under the project root ships. `excludeFiles` is tracked separately
// because measurement says Vercel ignores it for this preset - budgeting on the
// optimistic number is what hid the problem for two deployments.
let shippedBytes = 0
let wouldExcludeBytes = 0
const byFolder = new Map()

for (const path of listed) {
  let size
  try {
    size = statSync(join(projectDir, path)).size
  } catch {
    continue // listed but not checked out
  }
  shippedBytes += size
  if (excluded(path)) wouldExcludeBytes += size
  const folder = path.includes('/') ? path.split('/').slice(0, 2).join('/') : '(root files)'
  byFolder.set(folder, (byFolder.get(folder) ?? 0) + size)
}

const estimateMb = mb(shippedBytes) + DEPS_MB

console.log(`project root : ${PROJECT_ROOT}   (Vercel resolves ${entry} here)`)
console.log(`config       : ${PROJECT_ROOT}/vercel.json`)
console.log(`excludeFiles : ${patterns.length} pattern(s), ${excludeGlob.length}/${EXCLUDE_MAX_CHARS} chars`)
console.log()
console.log(`source       : ${mb(shippedBytes).toFixed(1)} MB   (everything under the project root)`)
console.log(`dependencies : ~${DEPS_MB} MB`)
console.log(`estimate     : ${estimateMb.toFixed(1)} MB of ${LIMIT_MB} MB`)
console.log()
console.log(
  `note         : excludeFiles would drop ${mb(wouldExcludeBytes).toFixed(1)} MB, but measured`
)
console.log(
  '               builds show Vercel ignores it for the Python framework preset,'
)
console.log(
  '               so that saving is NOT counted above. To cut the bundle for real,'
)
console.log(
  '               move files out of the project root, or raise the ceiling with'
)
console.log('               VERCEL_SUPPORT_LARGE_FUNCTIONS=1.')
console.log()

console.log(`largest folders still shipped (top ${TOP}):`)
for (const [folder, size] of [...byFolder].sort((a, b) => b[1] - a[1]).slice(0, TOP)) {
  console.log(`  ${mb(size).toFixed(1).padStart(8)} MB  ${folder}`)
}

// --- webapp folders that serve nothing --------------------------------------

const INDEX_FILE = /^(index\.html?|Index\.html|home\.html)$/

/** Split a listed path into its webapp folder name and the rest, or null. */
function underWebapp(path) {
  const parts = path.split('/')
  if (parts[0] !== 'webapp' || parts.length < 3) return null
  return { name: parts[1], rest: parts.slice(2) }
}

const withIndex = new Set()
const perFolder = new Map()

for (const path of listed) {
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
    size = statSync(join(projectDir, path)).size
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
const used = estimateMb / LIMIT_MB

if (used >= 1) {
  console.error(`OVER THE LIMIT: about ${estimateMb.toFixed(1)} MB against a ${LIMIT_MB} MB ceiling.`)
  process.exit(1)
}

if (used >= WARN_AT) {
  console.warn(`TIGHT: about ${(used * 100).toFixed(0)}% of the limit. One more app could break the deploy.`)
  process.exit(1)
}

console.log(`OK: about ${(used * 100).toFixed(0)}% of the ${LIMIT_MB} MB limit.`)

// Fitting only because of the beta is worth saying out loud: turning
// VERCEL_SUPPORT_LARGE_FUNCTIONS off, or the beta ending, breaks the deploy.
if (estimateMb > STANDARD_LIMIT_MB) {
  console.log()
  console.log(
    `Note: ${estimateMb.toFixed(1)} MB is over the ${STANDARD_LIMIT_MB} MB standard limit, so this`
  )
  console.log('deploy depends on Large Functions (VERCEL_SUPPORT_LARGE_FUNCTIONS=1, beta).')
  console.log(
    `To fit without it, move about ${(estimateMb - STANDARD_LIMIT_MB).toFixed(0)} MB out of ${PROJECT_ROOT}/.`
  )
}
