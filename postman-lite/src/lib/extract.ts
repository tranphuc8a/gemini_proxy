/**
 * Pull values out of a response and into environment variables.
 *
 * This is what turns a pile of unrelated requests into a flow: log in once, and
 * every request after it gets the token without anybody copying and pasting.
 */

import type { ExtractRule, ResponseData } from '../types'
import { decodeBytes } from './util'

/**
 * Read a dotted path out of a parsed body.
 *
 * Supports `data.token`, `items.0.id` and `items[0].id`. Deliberately not a
 * full JSONPath: the small syntax covers what API responses actually need and
 * has no expression evaluation to get wrong.
 */
export function readPath(value: unknown, path: string): unknown {
  if (!path) return value
  const segments = path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean)

  let cursor: any = value
  for (const segment of segments) {
    if (cursor == null) return undefined
    cursor = cursor[segment]
  }
  return cursor
}

export interface ExtractOutcome {
  target: string
  value: string | null
  error?: string
}

export function runExtracts(rules: ExtractRule[] | undefined, response: ResponseData): ExtractOutcome[] {
  const active = (rules ?? []).filter((rule) => rule.enabled && rule.target.trim())
  if (!active.length) return []

  let parsedBody: unknown
  let bodyParsed = false

  const outcomes: ExtractOutcome[] = []
  for (const rule of active) {
    const target = rule.target.trim()

    if (rule.source === 'status') {
      outcomes.push({ target, value: String(response.status) })
      continue
    }

    if (rule.source === 'header') {
      const wanted = rule.path.trim().toLowerCase()
      const found = response.headers.find(([name]) => name.toLowerCase() === wanted)
      outcomes.push(
        found
          ? { target, value: found[1] }
          : { target, value: null, error: `Response không có header "${rule.path}"` },
      )
      continue
    }

    if (!bodyParsed) {
      bodyParsed = true
      try {
        parsedBody = JSON.parse(decodeBytes(response.bytes, response.contentType))
      } catch {
        parsedBody = undefined
      }
    }

    if (parsedBody === undefined) {
      outcomes.push({ target, value: null, error: 'Body không phải JSON hợp lệ' })
      continue
    }

    const value = readPath(parsedBody, rule.path)
    if (value === undefined) {
      outcomes.push({ target, value: null, error: `Không tìm thấy đường dẫn "${rule.path}"` })
    } else {
      outcomes.push({ target, value: typeof value === 'string' ? value : JSON.stringify(value) })
    }
  }

  return outcomes
}
