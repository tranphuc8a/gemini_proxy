#!/usr/bin/env node
/**
 * Turn pwa/sw.js (a template) into dist/sw.js. Runs after `vite build`.
 *
 * Two things only a finished build can supply:
 *   __PRECACHE__  every file the worker must save so the app opens with no network -
 *                 including the lazy chunks (Mermaid, PDF export, one Prism grammar per
 *                 language) that index.html never mentions.
 *   __BUILD__     a hash of those files' contents. Without it sw.js would be byte-identical
 *                 after a deploy, the browser would never notice a new worker, and installed
 *                 copies would keep serving the old build.
 *
 * Usage:  node scripts/make-sw.mjs        (npm run build calls it)
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Every file under `dir`, as '/'-separated paths relative to it. */
function walk(dir, base = dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    return statSync(full).isDirectory() ? walk(full, base) : [relative(base, full).split('\\').join('/')]
  })
}

/**
 * Which emitted files the worker saves.
 *
 * KaTeX ships each font as woff2, woff and ttf. Its CSS lists woff2 first, and every browser that
 * can run a service worker reads woff2, so the other two would only add weight.
 */
export function precacheList(files) {
  return files
    .filter((f) => f !== 'index.html' && f !== 'sw.js')            // the page is fetched by the worker itself
    .filter((f) => /^assets\/.+\.(js|css|woff2)$/.test(f) || f === 'manifest.webmanifest' || /^icons\/.+\.png$/.test(f))
    .sort()
}

export function buildId(list, read) {
  const hash = createHash('sha256')
  for (const f of list) hash.update(`${f}:${createHash('sha1').update(read(f)).digest('hex')}\n`)
  return hash.digest('hex').slice(0, 12)
}

/** The two lines of pwa/sw.js that carry a placeholder. Matching the whole line is what keeps a mention in a comment from being "the" placeholder. */
const BUILD_LINE = 'var BUILD = "__BUILD__";'
const PRECACHE_LINE = 'var PRECACHE = __PRECACHE__;'

export function renderServiceWorker(template, list, build) {
  for (const line of [BUILD_LINE, PRECACHE_LINE]) {
    if (template.split(line).length !== 2) throw new Error(`pwa/sw.js must contain exactly one line: ${line}`)
  }
  const out = template
    .replace(BUILD_LINE, () => `var BUILD = ${JSON.stringify(build)};`)
    .replace(PRECACHE_LINE, () => `var PRECACHE = ${JSON.stringify(list)};`)
  // Whatever is left of a placeholder would ship a worker that caches nothing and never updates.
  if (/__BUILD__|__PRECACHE__/.test(out)) throw new Error('a placeholder survived in the generated sw.js')
  return out
}

function main() {
  const dist = join(ROOT, 'dist')
  if (!existsSync(join(dist, 'index.html'))) {
    console.error('make-sw: dist/index.html is missing - run `vite build` first')
    process.exit(1)
  }
  const list = precacheList(walk(dist))
  if (!list.some((f) => /^assets\/index-.+\.js$/.test(f))) {
    console.error('make-sw: no entry bundle among the emitted files - refusing to write a worker that caches nothing useful')
    process.exit(1)
  }
  const build = buildId(list, (f) => readFileSync(join(dist, f)))
  const out = renderServiceWorker(readFileSync(join(ROOT, 'pwa', 'sw.js'), 'utf8'), list, build)
  writeFileSync(join(dist, 'sw.js'), out)
  const bytes = list.reduce((sum, f) => sum + statSync(join(dist, f)).size, 0)
  console.log(`make-sw: build ${build} - ${list.length} files, ${(bytes / 1048576).toFixed(1)} MB to save for offline use`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
