#!/usr/bin/env node
/**
 * Give every app in the collection a `metadata.json`.
 *
 * The portal reads title, description, icon and tags from that file. Only 22 of
 * 240-odd apps had one, so the rest showed up as a bare folder name with no
 * icon, nothing to search by and nothing to filter on — which is most of why
 * the portal was hard to use.
 *
 * Writing 220 files by hand is not the answer; the names already carry the
 * information. `03-Speed-Typing-Game` is a typing game, `movie-app` is about
 * film, `theme-clock` is a clock. So the icon and tags are *derived* from the
 * folder name, and the result is written once and then owned by the repo —
 * committed files a person can correct, not a guess repeated at runtime.
 *
 * Two rules keep that honest:
 *
 *   - An existing `metadata.json` is never touched. Hand-written beats derived,
 *     always, and this script must be safe to re-run.
 *   - A generated file is marked `"generated": true`, so it is obvious which
 *     ones nobody has reviewed.
 *
 * Usage:
 *   node scripts/generate-app-metadata.mjs            # report, change nothing
 *   node scripts/generate-app-metadata.mjs --write    # create the missing ones
 *   node scripts/generate-app-metadata.mjs --write --force   # also redo generated ones
 */

import fs from 'node:fs'
import path from 'node:path'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const COLLECTION = join(ROOT, 'backend', 'fastapi', 'webapp')

const args = process.argv.slice(2)
const write = args.includes('--write')
const force = args.includes('--force')

/**
 * Keyword → icon and tags.
 *
 * Ordered most specific first: "typing game" should be a keyboard, not the
 * generic controller, so `typing` has to be tested before `game`.
 */
const RULES = [
  // --- games -------------------------------------------------------------
  [/\b(tetris|tower[- ]?blocks|blocks)\b/, '🧱', ['game', 'puzzle']],
  [/\b(snake)\b/, '🐍', ['game', 'arcade']],
  [/\b(chess|xiangqi|chinese[- ]?chess)\b/, '♟️', ['game', 'board-game', 'strategy']],
  [/\b(caro|tic[- ]?tac[- ]?toe|connect[- ]?four)\b/, '⭕', ['game', 'board-game']],
  [/\b(minesweeper)\b/, '💣', ['game', 'puzzle']],
  [/\b(2048)\b/, '🔢', ['game', 'puzzle']],
  [/\b(memory[- ]?card|memory[- ]?cards)\b/, '🃏', ['game', 'memory']],
  [/\b(hangman)\b/, '🪢', ['game', 'word-game']],
  [/\b(flappy|crossy|breakout|ping[- ]?pong|archery|whack|mole|slicer|catcher|catch)\b/, '🎯', ['game', 'arcade']],
  [/\b(candy|fruit|emoji)\b/, '🍬', ['game', 'arcade']],
  [/\b(dice|roll)\b/, '🎲', ['game', 'random']],
  [/\b(maze|tilting)\b/, '🌀', ['game', 'puzzle']],
  [/\b(quiz)\b/, '❓', ['quiz', 'learning']],
  [/\b(simon|says)\b/, '🎵', ['game', 'memory']],
  [/\b(rock[- ]?paper|scissors)\b/, '✂️', ['game']],
  [/\b(guessing|guess)\b/, '🤔', ['game', 'logic']],
  [/\b(radar|undead|zombie)\b/, '🧟', ['game']],
  [/\b(game)\b/, '🎮', ['game']],

  // --- calculators and converters ---------------------------------------
  [/\b(bmi)\b/, '⚖️', ['calculator', 'health']],
  [/\b(age)\b/, '🎂', ['calculator', 'date']],
  [/\b(loan|tip|exchange[- ]?rate|expense)\b/, '💰', ['calculator', 'finance']],
  [/\b(temperature)\b/, '🌡️', ['converter']],
  [/\b(weight)\b/, '⚖️', ['converter']],
  [/\b(binary|decimal|hex)\b/, '🔟', ['converter', 'number-base']],
  [/\b(scientific|casio|fx[- ]?\d+)\b/, '🧮', ['calculator', 'scientific', 'math']],
  [/\b(calculator|calc)\b/, '🔢', ['calculator', 'math']],
  [/\b(converter|convert)\b/, '🔄', ['converter']],

  // --- text, media, tools ------------------------------------------------
  [/\b(typing|type)\b/, '⌨️', ['typing', 'practice']],
  [/\b(music|lyrics|sound[- ]?board|streaming|headphones)\b/, '🎵', ['music', 'audio']],
  [/\b(speech|speak|reader)\b/, '🗣️', ['speech', 'accessibility']],
  [/\b(video|player)\b/, '🎬', ['video', 'media']],
  // Before the image rule: a range slider is a control, not a picture.
  [/\b(range[- ]?slider|custom[- ]?range)\b/, '🎚️', ['ui', 'form']],
  [/\b(image|photo|carousel|lightbox|slider|gallery)\b/, '🖼️', ['image', 'ui']],
  [/\b(drawing|draw|paint)\b/, '🎨', ['drawing', 'canvas']],
  [/\b(translator|language)\b/, '🌐', ['translation', 'tool']],
  [/\b(password)\b/, '🔐', ['security', 'tool']],
  [/\b(random|picker|generator)\b/, '🎲', ['random', 'tool']],
  [/\b(notes?|todo|task)\b/, '📝', ['productivity', 'notes']],
  [/\b(timer|countdown|clock|stopwatch)\b/, '⏱️', ['time', 'tool']],
  [/\b(weather)\b/, '⛅', ['weather']],
  [/\b(movie|film|netflix|hulu)\b/, '🎬', ['movie', 'media']],
  [/\b(meal|food|drink|water)\b/, '🍽️', ['food', 'health']],
  [/\b(pokedex|pokemon)\b/, '🐾', ['api', 'reference']],
  [/\b(github|profiles?)\b/, '🐙', ['api', 'developer']],
  [/\b(chat|message)\b/, '💬', ['chat', 'ui']],
  [/\b(dashboard|health|analytics)\b/, '📊', ['dashboard', 'data']],
  [/\b(shop|sneaker|product|booking|seat|promo)\b/, '🛒', ['e-commerce', 'ui']],
  [/\b(portfolio|agency|landing|website|webpage|magazine|coming[- ]?soon)\b/, '🌐', ['landing-page', 'ui']],
  [/\b(form|signin|signup|validator|feedback|verify|account)\b/, '📋', ['form', 'ui']],
  [/\b(nav|navigation|menu|tab|sidebar)\b/, '🧭', ['navigation', 'ui']],
  [/\b(loader|loading|placeholder|skeleton|progress|steps)\b/, '⏳', ['loading', 'ui']],
  [/\b(toast|notification|tooltip|modal)\b/, '🔔', ['feedback', 'ui']],
  [/\b(parallax|animation|animated|kinetic|3d|hoverboard|ripple)\b/, '✨', ['animation', 'ui']],
  [/\b(scroll|infinite)\b/, '📜', ['scroll', 'ui']],
  [/\b(drag|drop|sortable)\b/, '🖐️', ['interaction', 'ui']],
  [/\b(search|filter|live[- ]?user)\b/, '🔍', ['search', 'ui']],
  [/\b(theme|dark|light|glass|color|colour)\b/, '🎨', ['theming', 'ui']],
  [/\b(keycodes?|event)\b/, '⌨️', ['developer', 'reference']],
  [/\b(terminal|cli)\b/, '💻', ['developer']],
  [/\b(cascade|layers|container[- ]?queries|boilerplate)\b/, '📐', ['css', 'reference']],
  [/\b(relaxer|breathe)\b/, '🧘', ['wellbeing']],
  [/\b(card|box|switcher|testimonial|expanding)\b/, '🗂️', ['ui', 'layout']],
  [/\b(counter|increment)\b/, '🔢', ['ui']],
  [/\b(heart|double[- ]?click)\b/, '❤️', ['interaction', 'ui']],
  [/\b(new[- ]?year|holiday)\b/, '🎉', ['seasonal']],
  [/\b(dad[- ]?jokes?|joke)\b/, '😄', ['fun', 'api']],
  [/\b(faq|collapse|accordion)\b/, '📖', ['ui', 'content']],
]

/** When nothing matches, the collection it lives in is the next best guess. */
const COLLECTION_FALLBACK = {
  games: ['🎮', ['game']],
  calculators: ['🔢', ['calculator']],
  tools: ['🛠️', ['tool']],
  tranphuc8a: ['⭐', ['tranphuc8a']],
  '50projects50days-master': ['✨', ['demo', 'html', 'css', 'javascript']],
  'html-css-javascript-games-main': ['🎮', ['game', 'html', 'css', 'javascript']],
  'html-css-javascript-projects-main': ['✨', ['demo', 'html', 'css', 'javascript']],
  'html-css-javascript-calculator-main': ['🔢', ['calculator', 'html', 'css', 'javascript']],
}

/** `03-Speed-Typing-Game` → `Speed Typing Game`. */
function titleFrom(slug) {
  const words = slug
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    // Leading serial numbers are filing, not part of the name.
    .replace(/^\s*\d{1,3}\s+/, '')
    // Repository suffixes that say nothing about the app.
    .replace(/\b(master|main)\b\s*$/i, '')
    .trim()
  if (!words) return slug
  return words
    .split(' ')
    .map((word) => (word.length > 2 && word === word.toLowerCase() ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ')
}

function classify(slug, collection) {
  const haystack = slug.replace(/[-_]+/g, ' ').toLowerCase()
  const tags = new Set()
  let icon = null

  for (const [pattern, emoji, keywords] of RULES) {
    if (!pattern.test(haystack)) continue
    if (!icon) icon = emoji
    for (const keyword of keywords) tags.add(keyword)
    // Keep collecting tags from later rules; only the first icon wins.
  }

  const fallback = COLLECTION_FALLBACK[collection]
  if (!icon && fallback) icon = fallback[0]
  if (fallback) for (const keyword of fallback[1]) tags.add(keyword)
  if (collection) tags.add(collection.replace(/-(master|main)$/, ''))

  return { icon: icon ?? '📦', tags: [...tags].slice(0, 10) }
}

function listApps() {
  const apps = []
  const walk = (dir, collection, depth) => {
    if (depth > 1) return
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('_') || entry.name.startsWith('.')) continue
      const full = join(dir, entry.name)
      const hasIndex = ['index.html', 'index.htm', 'Index.html', 'home.html'].some((name) =>
        fs.existsSync(join(full, name)),
      )
      if (hasIndex) {
        apps.push({ dir: full, slug: entry.name, collection })
      } else if (depth === 0) {
        walk(full, entry.name, depth + 1)
      }
    }
  }
  walk(COLLECTION, null, 0)
  return apps
}

let created = 0
let kept = 0
const samples = []

for (const app of listApps()) {
  const target = join(app.dir, 'metadata.json')
  if (fs.existsSync(target)) {
    if (!force) {
      kept++
      continue
    }
    try {
      // --force still refuses to clobber a file a person wrote.
      if (!JSON.parse(fs.readFileSync(target, 'utf8')).generated) {
        kept++
        continue
      }
    } catch {
      kept++
      continue
    }
  }

  const title = titleFrom(app.slug)
  const { icon, tags } = classify(app.slug, app.collection)
  const metadata = {
    title,
    description: app.collection
      ? `${title} — ứng dụng trong bộ sưu tập ${app.collection}.`
      : `${title}.`,
    tags,
    icon,
    // Says plainly that nobody has reviewed this text, so a reader knows to
    // trust a hand-written description over it.
    generated: true,
  }

  if (write) fs.writeFileSync(target, JSON.stringify(metadata, null, 2) + '\n', 'utf8')
  created++
  if (samples.length < 12) samples.push(`${icon}  ${title.padEnd(34)} ${tags.slice(0, 4).join(', ')}`)
}

console.log(`${kept} apps already had metadata (left alone)`)
console.log(`${created} ${write ? 'written' : 'would be written'}`)
if (samples.length) {
  console.log('\nsample:')
  for (const line of samples) console.log('  ' + line)
}
if (!write && created) console.log('\nRe-run with --write to create them.')
