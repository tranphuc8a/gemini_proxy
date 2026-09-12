/**
 * {{VARIABLE}} substitution.
 *
 * Substitution happens on the way out, at send time, never in the editor: the
 * form keeps its template forever so switching environments actually switches
 * what gets sent.
 */

import type { AuthConfig, Environment, KeyValue, RequestSpec } from '../types'
import { kvToObject } from './util'

const VAR_PATTERN = /\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g

export type VarTable = Record<string, string>

export function envTable(environment: Environment | undefined | null): VarTable {
  return environment ? kvToObject(environment.vars) : {}
}

/** Unknown names are left as-is, so the user sees what is missing. */
export function resolve(text: string | undefined, vars: VarTable): string {
  if (!text) return text ?? ''
  return text.replace(VAR_PATTERN, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : match,
  )
}

export function resolveRows(rows: KeyValue[] | undefined, vars: VarTable): KeyValue[] {
  return (rows ?? []).map((row) => ({ ...row, key: resolve(row.key, vars), value: resolve(row.value, vars) }))
}

export function resolveAuth(auth: AuthConfig | undefined, vars: VarTable): AuthConfig {
  const source = auth ?? { type: 'none' as const }
  const out: AuthConfig = { type: source.type, location: source.location }
  for (const field of ['username', 'password', 'token', 'keyName', 'keyValue'] as const) {
    if (source[field] !== undefined) out[field] = resolve(source[field], vars)
  }
  return out
}

export function resolveSpec(spec: RequestSpec, vars: VarTable): RequestSpec {
  return {
    ...spec,
    url: resolve(spec.url, vars),
    params: resolveRows(spec.params, vars),
    headers: resolveRows(spec.headers, vars),
    cookies: resolveRows(spec.cookies, vars),
    formFields: resolveRows(spec.formFields, vars),
    body: resolve(spec.body, vars),
    auth: resolveAuth(spec.auth, vars),
  }
}

export function findUnresolved(text: string | undefined, vars: VarTable): string[] {
  if (!text) return []
  const missing: string[] = []
  for (const match of text.matchAll(VAR_PATTERN)) {
    const name = match[1]
    if (!Object.prototype.hasOwnProperty.call(vars, name) && !missing.includes(name)) missing.push(name)
  }
  return missing
}

/** Every variable the request needs that the active environment cannot supply. */
export function findUnresolvedInSpec(spec: RequestSpec, vars: VarTable): string[] {
  const missing = new Set<string>()
  const scan = (text: string | undefined) => findUnresolved(text, vars).forEach((name) => missing.add(name))

  scan(spec.url)
  scan(spec.body)
  for (const rows of [spec.params, spec.headers, spec.cookies, spec.formFields]) {
    for (const row of rows ?? []) {
      if (!row.enabled) continue
      scan(row.key)
      scan(row.value)
    }
  }
  for (const value of Object.values(spec.auth ?? {})) {
    if (typeof value === 'string') scan(value)
  }
  return [...missing]
}
