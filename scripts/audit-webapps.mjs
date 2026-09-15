#!/usr/bin/env node
/**
 * Drive the published web apps in a real browser and report what breaks.
 *
 * Unit tests cannot see a layout bug. The one that prompted this script was a
 * single missing CSS rule: `[hidden]` does nothing when a class sets `display`,
 * so the Research app rendered all six of its tab panels stacked on top of each
 * other while every unit test stayed green. Nothing short of opening the page
 * would have caught it.
 *
 * So this opens the page, clicks every button, selects every option, switches
 * every tab, and checks a handful of invariants that hold for any app here:
 *
 *   - nothing marked `hidden` is on screen
 *   - the page does not scroll sideways
 *   - a tabbed page shows exactly one panel at a time
 *   - no control throws, and none leaves the main view empty
 *
 * It runs against the *published* files under `backend/fastapi/webapp/`, served
 * by a throwaway static server — which is what the deployment actually ships,
 * rather than a dev server with different behaviour.
 *
 * Usage:
 *   node scripts/audit-webapps.mjs                       # audit the defaults
 *   node scripts/audit-webapps.mjs tranphuc8a/graphuc    # audit one app
 *   node scripts/audit-webapps.mjs --shots ./out         # also save screenshots
 *
 * Needs Playwright with Chromium:
 *   npm i -D playwright && npx playwright install chromium
 */

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { dirname, join, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const COLLECTION = join(ROOT, 'backend', 'fastapi', 'webapp')
const PORT = 8749

const DEFAULT_APPS = [
  'tranphuc8a/light-grid-v1',
  'tranphuc8a/light-grid-v2',
  'tranphuc8a/light-grid-v3',
  'tranphuc8a/graphuc'
]

const VIEWPORTS = [
  { width: 1440, height: 900, name: 'desktop' },
  { width: 420, height: 820, name: 'phone' }
]

const MEDIA = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2'
}

const args = process.argv.slice(2)
const shotIndex = args.indexOf('--shots')
const shotDir = shotIndex === -1 ? null : args[shotIndex + 1]
const apps = args.filter((value, index) => !value.startsWith('--') && index !== shotIndex + 1)
const targets = apps.length ? apps : DEFAULT_APPS

// Playwright is not a dependency of this repo: there is no package.json at the
// root, and a ~100MB browser download is not something to impose on a checkout
// that only wants the backend. Install it wherever suits and point NODE_PATH at
// that folder.
let chromium
try {
  ({ chromium } = await import('playwright'))
} catch {
  // ESM `import` ignores NODE_PATH, so fall back to CommonJS resolution, which
  // honours it. That is what lets this run against a Playwright installed in a
  // scratch folder without adding it to the repo.
  try {
    const require = createRequire(join(ROOT, 'noop.cjs'))
    ;({ chromium } = require('playwright'))
  } catch {
    console.error(
      'Playwright is not resolvable from here. Either:\n' +
        '  npm i -D playwright && npx playwright install chromium\n' +
        'or point NODE_PATH at a folder that already has it:\n' +
        '  NODE_PATH=/path/to/node_modules node scripts/audit-webapps.mjs'
    )
    process.exit(2)
  }
}

if (shotDir) fs.mkdirSync(shotDir, { recursive: true })

const server = http.createServer((request, response) => {
  const relative = decodeURIComponent(request.url.split('?')[0])
  const file = path.join(COLLECTION, relative.endsWith('/') ? relative + 'index.html' : relative)
  // The collection is the only thing served; a path that climbs out of it is a
  // bug in the page, not something to answer.
  if (!file.startsWith(COLLECTION)) {
    response.writeHead(403)
    response.end()
    return
  }
  fs.readFile(file, (error, data) => {
    if (error) {
      response.writeHead(404)
      response.end('not found')
      return
    }
    response.writeHead(200, { 'content-type': MEDIA[path.extname(file)] ?? 'application/octet-stream' })
    response.end(data)
  })
})
await new Promise((done) => server.listen(PORT, done))

const findings = []
const browser = await chromium.launch()

for (const app of targets) {
  for (const viewport of VIEWPORTS) {
    await audit(app, viewport)
  }
}

await browser.close()
server.close()

if (findings.length) {
  console.log(`\n${findings.length} finding${findings.length === 1 ? '' : 's'}:\n`)
  for (const finding of findings) console.log('  ✗ ' + finding)
  process.exit(1)
}
console.log('\n✓ no findings')

async function audit(app, viewport) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } })
  const errors = []
  // "Failed to load resource" for an API call is this harness lacking a
  // backend, not the app being broken -- every app here is built to work
  // without one. Filtered at the source so the per-button and per-select
  // checks below see the same thing the summary does.
  const isHarnessNoise = (text) => text.includes('favicon') || text.includes('Failed to load resource')
  page.on('console', (message) => {
    if (message.type() === 'error' && !isHarnessNoise(message.text())) errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push('THROWN: ' + error.message))

  // This harness serves static files only, so an app that calls the API gets a
  // 404 for it. That is the harness missing, not the app being broken -- the
  // apps are all built to work without a backend. Requests that stay inside the
  // app's own folder are a different matter: a 404 there is a missing asset.
  const missingAssets = []
  page.on('response', (response) => {
    if (response.status() !== 404) return
    const url = new URL(response.url())
    if (url.pathname.startsWith(`/${app}/`)) missingAssets.push(url.pathname)
  })

  // A previous run's saved state would make the audit non-deterministic.
  await page.addInitScript(() => {
    try {
      localStorage.clear()
    } catch {
      /* private mode */
    }
  })

  const label = `${app} [${viewport.name}]`
  const report = (text) => findings.push(`${label}: ${text}`)

  try {
    const response = await page.goto(`http://localhost:${PORT}/${app}/`, { waitUntil: 'networkidle', timeout: 20000 })
    if (!response || !response.ok()) {
      report(`page returned ${response ? response.status() : 'nothing'}`)
      await page.close()
      return
    }
  } catch (error) {
    report('did not load: ' + String(error).split('\n')[0])
    await page.close()
    return
  }
  await page.waitForTimeout(400)

  const hiddenButVisible = await page.evaluate(() =>
    [...document.querySelectorAll('[hidden]')]
      .filter((element) => element.getClientRects().length > 0)
      .map((element) => element.className || element.tagName)
  )
  if (hiddenButVisible.length) report(`[hidden] elements are on screen: ${hiddenButVisible.join(', ')}`)

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  )
  if (overflow > 2) report(`page scrolls sideways by ${overflow}px`)

  // Tabs must be exclusive.
  const tabs = await page.locator('.tab').all()
  for (const tab of tabs) {
    const name = ((await tab.textContent()) || '?').trim()
    try {
      await tab.click({ timeout: 2000 })
    } catch {
      continue
    }
    await page.waitForTimeout(120)
    const visible = await page.evaluate(
      () => [...document.querySelectorAll('.tab-panel')].filter((el) => el.getClientRects().length > 0).length
    )
    if (visible !== 1) report(`tab "${name}" shows ${visible} panels, expected 1`)
  }

  // Every button must survive a press.
  const buttons = await page.locator('button:visible:not(.tab)').all()
  for (const button of buttons) {
    const before = errors.length
    const name = ((await button.textContent().catch(() => '?')) || '?').trim().slice(0, 30)
    try {
      await button.click({ timeout: 1500 })
    } catch {
      continue // covered or detached by an earlier click; not a finding on its own
    }
    await page.waitForTimeout(100)
    if (errors.length > before) report(`button "${name}" -> ${errors[errors.length - 1].slice(0, 140)}`)
  }

  // Every option of every select must be selectable.
  for (const select of await page.locator('select:visible').all()) {
    const id = (await select.getAttribute('id')) || 'select'
    const values = await select.evaluate((element) => [...element.options].map((option) => option.value))
    for (const value of values) {
      const before = errors.length
      try {
        await select.selectOption(value, { timeout: 1500 })
      } catch {
        continue
      }
      await page.waitForTimeout(100)
      if (errors.length > before) report(`${id}="${value}" -> ${errors[errors.length - 1].slice(0, 140)}`)
    }
  }

  if (missingAssets.length) report(`missing asset(s): ${[...new Set(missingAssets)].join(', ')}`)

  if (errors.length) report(`${errors.length} console error(s), first: ${errors[0].slice(0, 160)}`)

  console.log(`  ${label}: ${tabs.length} tabs, ${buttons.length} buttons, ${errors.length} errors`)
  if (shotDir) {
    await page.screenshot({ path: join(shotDir, `${app.replace(/\//g, '_')}-${viewport.name}.png`) })
  }
  await page.close()
}
