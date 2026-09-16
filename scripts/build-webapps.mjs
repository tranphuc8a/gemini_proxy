#!/usr/bin/env node
/**
 * Build the standalone web apps and publish them into the FastAPI collection.
 *
 * Each app lives in its own project with its own package.json; deployment only
 * ships the FastAPI backend, which serves whatever sits under
 * `backend/fastapi/webapp/`. This script is the step in between.
 *
 * It also guards the bug that motivated it: a Vite build freezes
 * `import.meta.env.VITE_*` into the bundle, so an app built with a .env pointing
 * at localhost keeps calling localhost wherever it is later deployed. The apps
 * now read their API base from the config the server injects at serve time, and
 * the audit at the end of this script fails the build if a hard-coded origin
 * creeps back in.
 *
 * Usage:
 *   node scripts/build-webapps.mjs                 # build and publish everything
 *   node scripts/build-webapps.mjs --only sql-administrator
 *   node scripts/build-webapps.mjs --skip-build    # publish the existing dist/
 *   node scripts/build-webapps.mjs --list          # show the mapping and exit
 *   node scripts/build-webapps.mjs --check         # audit what is published, change nothing
 */

import { spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const COLLECTION = join(ROOT, 'backend', 'fastapi', 'webapp')

/**
 * Where each project is published.
 *
 * `dest` is relative to the collection root. A path with a slash puts the app in
 * a collection folder, which the portal groups under that name.
 */
const APPS = [
  { name: 'frontend', dest: 'tranphuc8a/gemini-chat' },
  { name: 'markdown-editor', dest: 'tranphuc8a/markdown-editor-pro' },
  { name: 'sql-administrator', dest: 'tranphuc8a/sql-administrator' },
  { name: 'postman-lite', dest: 'tranphuc8a/postman-lite-pro' },
  { name: 'mongo-administrator', dest: 'tranphuc8a/mongo-administrator' },
  { name: 'graphuc', dest: 'tranphuc8a/graphuc' },
  { name: 'casio-fx580vnx', dest: 'tranphuc8a/casio-fx580vnx' },
]

/**
 * Files in the destination that belong to the collection, not to the build.
 *
 * They survive publishing even when the build produces a file of the same name:
 * metadata.json in the collection is the one the portal reads and the one people
 * hand-edit, so a copy shipped in a project's public/ folder must not clobber it.
 */
const KEEP = new Set(['metadata.json'])

/**
 * A dev backend address baked into a bundle is the bug this script guards.
 *
 * The port is required on purpose. `http://localhost` with no port is a common
 * placeholder inside libraries -- mermaid's graph layout, for instance, falls
 * back to it when there is no `window.location` -- whereas a loopback host *with*
 * a port is what a developer's API base looks like, and is never right in a
 * deployed bundle.
 */
const BAKED_ORIGIN = /https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0):\d+/g

const args = process.argv.slice(2)
const flag = (name) => args.includes(name)
const option = (name) => {
  const at = args.indexOf(name)
  return at === -1 ? null : args[at + 1]
}

const only = option('--only')
const skipBuild = flag('--skip-build')
const checkOnly = flag('--check')

const selected = only ? APPS.filter((a) => a.name === only || a.dest.endsWith(only)) : APPS
if (only && selected.length === 0) {
  console.error(`Unknown app: ${only}`)
  console.error(`Known: ${APPS.map((a) => a.name).join(', ')}`)
  process.exit(1)
}

if (flag('--list')) {
  console.log('project'.padEnd(24) + 'published at')
  for (const app of APPS) console.log(app.name.padEnd(24) + `webapp/${app.dest}`)
  process.exit(0)
}

/** Every file under `dir`, as paths relative to it. */
function walk(dir, base = dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    return statSync(full).isDirectory() ? walk(full, base) : [relative(base, full)]
  })
}

function build(app) {
  const cwd = join(ROOT, app.name)
  console.log(`  building...`)
  const result = spawnSync('npm', ['run', 'build'], {
    cwd,
    stdio: 'inherit',
    shell: true, // npm is a shell script on Windows
  })
  if (result.status !== 0) throw new Error(`${app.name}: build failed`)
}

function publish(app) {
  const dist = join(ROOT, app.name, 'dist')
  if (!existsSync(dist) || walk(dist).length === 0) {
    throw new Error(`${app.name}: dist/ is empty - build it first (drop --skip-build)`)
  }

  const dest = join(COLLECTION, ...app.dest.split('/'))
  mkdirSync(dest, { recursive: true })

  // Hold on to the collection's own files before anything is removed or copied.
  const preserved = new Map()
  for (const entry of KEEP) {
    const path = join(dest, entry)
    if (existsSync(path)) preserved.set(entry, readFileSync(path))
  }

  // Clear the previous build so renamed/hashed assets do not pile up.
  for (const entry of readdirSync(dest)) {
    rmSync(join(dest, entry), { recursive: true, force: true })
  }

  cpSync(dist, dest, { recursive: true })

  // Put them back, overwriting anything the build shipped under the same name.
  for (const [entry, content] of preserved) {
    writeFileSync(join(dest, entry), content)
  }

  return { dest, files: walk(dest).length, preserved: [...preserved.keys()] }
}

/**
 * Report any absolute dev origin surviving in a published app.
 *
 * Returns null when nothing is published there yet - an empty folder is not the
 * same as a clean one, and saying so would hide a missing app.
 */
function audit(app) {
  const dest = join(COLLECTION, ...app.dest.split('/'))
  const published = walk(dest).filter((rel) => !KEEP.has(rel))
  if (published.length === 0) return null

  const findings = []

  for (const rel of published) {
    if (!/\.(js|mjs|css|html|json|map)$/i.test(rel)) continue
    const text = readFileSync(join(dest, rel), 'utf8')
    const hits = [...new Set(text.match(BAKED_ORIGIN) ?? [])]
    if (hits.length) findings.push({ file: rel, hits })
  }
  return findings
}

let failed = false
const audited = []

for (const app of selected) {
  console.log(`\n=== ${app.name} -> webapp/${app.dest} ===`)

  if (!checkOnly) {
    if (!skipBuild) build(app)
    const { files, preserved } = publish(app)
    console.log(`  published ${files} files`)
    if (preserved.length) console.log(`  kept the collection's ${preserved.join(', ')}`)
  }

  const findings = audit(app)
  audited.push({ app, findings })

  if (findings === null) {
    console.log('  not published yet - nothing to audit')
  } else if (findings.length) {
    failed = true
    console.log(`  BAKED-IN ORIGIN in ${findings.length} file(s):`)
    for (const { file, hits } of findings.slice(0, 5)) {
      console.log(`    ${file}: ${hits.join(', ')}`)
    }
  } else {
    console.log('  audit clean - no hard-coded origin')
  }
}

console.log('\n' + '-'.repeat(60))
for (const { app, findings } of audited) {
  const label = findings === null ? 'none' : findings.length ? 'FAIL' : 'ok  '
  console.log(`${label}  ${app.dest}`)
}

if (failed) {
  console.error(
    '\nA published bundle still contains a localhost URL.\n' +
      'That address comes from the build machine and will be wrong once deployed.\n' +
      'Read the API base through resolveApiBase() instead, and leave VITE_API_BASE\n' +
      'empty so the value injected by the FastAPI webapp controller wins.'
  )
  process.exit(1)
}

console.log('\nAll published apps read their API base at runtime.')
