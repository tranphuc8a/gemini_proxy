/**
 * Bring collections in from the two formats people actually have: a Postman
 * v2.1 export, and an OpenAPI/Swagger document.
 *
 * Both produce the same shape - flat lists of collections and requests - so the
 * store can merge either without knowing where it came from.
 */

import type { AuthConfig, BodyMode, Collection, Environment, HttpMethod, KeyValue, RequestSpec } from '../types'
import { HTTP_METHODS } from '../types'
import { kv, objectToKv, uid } from './util'

export interface ImportResult {
  collections: Collection[]
  requests: RequestSpec[]
  environments: Environment[]
  /** Things the source described that this app has no equivalent for. */
  warnings: string[]
}

function emptySpec(overrides: Partial<RequestSpec> = {}): RequestSpec {
  return {
    id: uid('req_'),
    name: 'Untitled',
    collectionId: null,
    method: 'GET',
    url: '',
    params: [],
    headers: [],
    cookies: [],
    auth: { type: 'none' },
    bodyMode: 'none',
    body: '',
    formFields: [],
    tests: '',
    extracts: [],
    ...overrides,
  }
}

function asMethod(value: unknown): HttpMethod {
  const upper = String(value ?? 'GET').toUpperCase()
  return (HTTP_METHODS as string[]).includes(upper) ? (upper as HttpMethod) : 'GET'
}

// ---------------------------------------------------------------------------
// Postman Collection v2.1
// ---------------------------------------------------------------------------
function postmanUrl(url: any): { url: string; params: KeyValue[] } {
  if (typeof url === 'string') return { url, params: [] }
  if (!url || typeof url !== 'object') return { url: '', params: [] }

  // v2.1 stores the URL pre-split. `raw` keeps the {{variables}} intact, which
  // the reassembled form would lose, so prefer it when present.
  let raw: string = url.raw ?? ''
  if (!raw) {
    const host = Array.isArray(url.host) ? url.host.join('.') : (url.host ?? '')
    const path = Array.isArray(url.path) ? url.path.join('/') : (url.path ?? '')
    raw = `${url.protocol ? url.protocol + '://' : ''}${host}${path ? '/' + path : ''}`
  }
  const queryIndex = raw.indexOf('?')
  const base = queryIndex > -1 ? raw.slice(0, queryIndex) : raw

  const params: KeyValue[] = (url.query ?? [])
    .filter((q: any) => q && q.key)
    .map((q: any) => kv(q.key, q.value ?? '', q.disabled !== true))

  return { url: base, params }
}

function postmanAuth(auth: any, warnings: string[]): AuthConfig {
  if (!auth || !auth.type) return { type: 'none' }
  const read = (list: any[], key: string) =>
    (list ?? []).find((item: any) => item.key === key)?.value ?? ''

  switch (auth.type) {
    case 'basic':
      return { type: 'basic', username: read(auth.basic, 'username'), password: read(auth.basic, 'password') }
    case 'bearer':
      return { type: 'bearer', token: read(auth.bearer, 'token') }
    case 'apikey':
      return {
        type: 'apikey',
        keyName: read(auth.apikey, 'key'),
        keyValue: read(auth.apikey, 'value'),
        location: read(auth.apikey, 'in') === 'query' ? 'query' : 'header',
      }
    case 'noauth':
      return { type: 'none' }
    default:
      warnings.push(`Auth "${auth.type}" chưa được hỗ trợ, đã bỏ qua`)
      return { type: 'none' }
  }
}

function postmanBody(body: any, warnings: string[]): Pick<RequestSpec, 'bodyMode' | 'body' | 'formFields'> {
  if (!body || !body.mode) return { bodyMode: 'none', body: '', formFields: [] }

  switch (body.mode) {
    case 'raw': {
      const language = body.options?.raw?.language ?? ''
      const mode: BodyMode = language === 'json' ? 'json' : language === 'xml' ? 'xml' : 'text'
      const raw = body.raw ?? ''
      // Postman often omits the language even for obvious JSON.
      const guessed = mode === 'text' && /^\s*[[{]/.test(raw) ? 'json' : mode
      return { bodyMode: guessed, body: raw, formFields: [] }
    }
    case 'urlencoded':
      return {
        bodyMode: 'form',
        body: '',
        formFields: (body.urlencoded ?? []).map((f: any) => kv(f.key ?? '', f.value ?? '', f.disabled !== true)),
      }
    case 'formdata':
      if ((body.formdata ?? []).some((f: any) => f.type === 'file')) {
        warnings.push('Có field dạng file trong form-data — trình duyệt không đọc được đường dẫn, hãy chọn lại file')
      }
      return {
        bodyMode: 'multipart',
        body: '',
        formFields: (body.formdata ?? [])
          .filter((f: any) => f.type !== 'file')
          .map((f: any) => kv(f.key ?? '', f.value ?? '', f.disabled !== true)),
      }
    default:
      warnings.push(`Body mode "${body.mode}" chưa được hỗ trợ`)
      return { bodyMode: 'none', body: '', formFields: [] }
  }
}

export function importPostmanCollection(doc: any): ImportResult {
  const warnings: string[] = []
  const collections: Collection[] = []
  const requests: RequestSpec[] = []

  if (!doc?.info || !Array.isArray(doc.item)) {
    throw new Error('Không phải Postman Collection v2.x (thiếu "info" hoặc "item")')
  }

  const root: Collection = {
    id: uid('col_'),
    name: doc.info.name ?? 'Imported collection',
    description: typeof doc.info.description === 'string' ? doc.info.description : undefined,
    parentId: null,
  }
  collections.push(root)

  const walk = (items: any[], parentId: string) => {
    for (const item of items ?? []) {
      if (Array.isArray(item.item)) {
        const folder: Collection = {
          id: uid('col_'),
          name: item.name ?? 'Folder',
          description: typeof item.description === 'string' ? item.description : undefined,
          parentId,
        }
        collections.push(folder)
        walk(item.item, folder.id)
        continue
      }

      const req = item.request
      if (!req) continue

      const { url, params } = postmanUrl(req.url)
      const headerRows: KeyValue[] = (req.header ?? [])
        .filter((h: any) => h && h.key)
        .map((h: any) => kv(h.key, h.value ?? '', h.disabled !== true))

      // Postman keeps cookies in a Cookie header, same as we send them.
      const cookies: KeyValue[] = []
      for (let i = headerRows.length - 1; i >= 0; i--) {
        if (headerRows[i].key.toLowerCase() !== 'cookie') continue
        for (const part of headerRows[i].value.split(';')) {
          const idx = part.indexOf('=')
          if (idx > -1) cookies.push(kv(part.slice(0, idx).trim(), part.slice(idx + 1).trim()))
        }
        headerRows.splice(i, 1)
      }

      const testScript = (item.event ?? [])
        .filter((e: any) => e.listen === 'test')
        .flatMap((e: any) => e.script?.exec ?? [])
        .join('\n')

      requests.push(
        emptySpec({
          name: item.name ?? 'Untitled',
          collectionId: parentId,
          method: asMethod(req.method),
          url,
          params,
          headers: headerRows,
          cookies,
          auth: postmanAuth(req.auth ?? doc.auth, warnings),
          tests: testScript,
          ...postmanBody(req.body, warnings),
        }),
      )
    }
  }

  walk(doc.item, root.id)

  const environments: Environment[] = []
  if (Array.isArray(doc.variable) && doc.variable.length) {
    environments.push({
      id: uid('env_'),
      name: `${root.name} variables`,
      vars: doc.variable
        .filter((v: any) => v?.key)
        .map((v: any) => kv(v.key, String(v.value ?? ''), v.disabled !== true)),
    })
  }

  return { collections, requests, environments, warnings }
}

/** A Postman v2.1 export of the whole workspace, for round-tripping out. */
export function exportPostmanCollection(
  collections: Collection[],
  requests: RequestSpec[],
  name = 'Postman Lite Pro',
): unknown {
  const childrenOf = (parentId: string | null): any[] => [
    ...collections
      .filter((c) => c.parentId === parentId)
      .map((c) => ({ name: c.name, description: c.description, item: childrenOf(c.id) })),
    ...requests
      .filter((r) => r.collectionId === parentId)
      .map((r) => ({
        name: r.name,
        request: {
          method: r.method,
          header: r.headers
            .filter((h) => h.key)
            .map((h) => ({ key: h.key, value: h.value, disabled: !h.enabled })),
          url: { raw: r.url },
          body:
            r.bodyMode === 'none'
              ? undefined
              : r.bodyMode === 'form'
                ? { mode: 'urlencoded', urlencoded: r.formFields.map((f) => ({ key: f.key, value: f.value, disabled: !f.enabled })) }
                : r.bodyMode === 'multipart'
                  ? { mode: 'formdata', formdata: r.formFields.map((f) => ({ key: f.key, value: f.value, type: 'text', disabled: !f.enabled })) }
                  : { mode: 'raw', raw: r.body, options: { raw: { language: r.bodyMode === 'json' ? 'json' : r.bodyMode === 'xml' ? 'xml' : 'text' } } },
        },
        event: r.tests ? [{ listen: 'test', script: { type: 'text/javascript', exec: r.tests.split('\n') } }] : undefined,
      })),
  ]

  return {
    info: {
      name,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      _postman_id: uid(''),
    },
    item: childrenOf(null),
  }
}

// ---------------------------------------------------------------------------
// OpenAPI 3 / Swagger 2
// ---------------------------------------------------------------------------
function sampleFromSchema(schema: any, depth = 0): unknown {
  if (!schema || typeof schema !== 'object' || depth > 6) return null
  if (schema.example !== undefined) return schema.example
  if (schema.default !== undefined) return schema.default
  if (Array.isArray(schema.enum) && schema.enum.length) return schema.enum[0]

  switch (schema.type) {
    case 'object':
    case undefined: {
      if (!schema.properties) return schema.type === 'object' ? {} : null
      const out: Record<string, unknown> = {}
      for (const [key, value] of Object.entries<any>(schema.properties)) {
        out[key] = sampleFromSchema(value, depth + 1)
      }
      return out
    }
    case 'array':
      return [sampleFromSchema(schema.items, depth + 1)].filter((v) => v !== null)
    case 'integer':
    case 'number':
      return 0
    case 'boolean':
      return false
    default:
      return schema.format === 'date-time' ? new Date().toISOString() : 'string'
  }
}

function resolveRef(doc: any, node: any, seen = new Set<string>()): any {
  if (!node || typeof node !== 'object' || typeof node.$ref !== 'string') return node
  // A $ref cycle would otherwise recurse until the stack gives out.
  if (seen.has(node.$ref)) return {}
  seen.add(node.$ref)

  const path = node.$ref.replace(/^#\//, '').split('/')
  let cursor: any = doc
  for (const segment of path) {
    cursor = cursor?.[segment.replace(/~1/g, '/').replace(/~0/g, '~')]
    if (cursor === undefined) return {}
  }
  return resolveRef(doc, cursor, seen)
}

export function importOpenApi(doc: any): ImportResult {
  const warnings: string[] = []
  const isV3 = typeof doc?.openapi === 'string'
  const isV2 = doc?.swagger === '2.0'
  if (!isV3 && !isV2) throw new Error('Không phải tài liệu OpenAPI 3 hoặc Swagger 2')
  if (!doc.paths || typeof doc.paths !== 'object') throw new Error('Tài liệu không có "paths"')

  const title = doc.info?.title ?? 'OpenAPI'
  const root: Collection = { id: uid('col_'), name: title, description: doc.info?.description, parentId: null }
  const collections: Collection[] = [root]
  const requests: RequestSpec[] = []

  // One sub-collection per tag keeps a 200-endpoint spec navigable.
  const tagCollections = new Map<string, string>()
  const collectionForTag = (tag: string): string => {
    let id = tagCollections.get(tag)
    if (!id) {
      id = uid('col_')
      collections.push({ id, name: tag, parentId: root.id })
      tagCollections.set(tag, id)
    }
    return id
  }

  let serverUrl = ''
  if (isV3) {
    serverUrl = doc.servers?.[0]?.url ?? ''
  } else {
    const scheme = doc.schemes?.[0] ?? 'https'
    serverUrl = doc.host ? `${scheme}://${doc.host}${doc.basePath ?? ''}` : (doc.basePath ?? '')
  }
  // A templated server URL becomes an environment variable the user can fill.
  const baseVar = '{{BASE_URL}}'

  for (const [path, pathItem] of Object.entries<any>(doc.paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue

    for (const method of HTTP_METHODS) {
      const operation = pathItem[method.toLowerCase()]
      if (!operation) continue

      const allParams = [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])]
        .map((p: any) => resolveRef(doc, p))

      const query: KeyValue[] = []
      const headers: KeyValue[] = []
      let urlPath = path

      for (const param of allParams) {
        if (!param?.name) continue
        const sample = param.example ?? sampleFromSchema(resolveRef(doc, param.schema) ?? param, 0) ?? ''
        if (param.in === 'query') query.push(kv(param.name, String(sample ?? ''), param.required !== false))
        else if (param.in === 'header') headers.push(kv(param.name, String(sample ?? '')))
        else if (param.in === 'path') {
          // Path placeholders become environment variables so they can be filled
          // once and reused across every endpoint that needs them.
          urlPath = urlPath.replace(`{${param.name}}`, `{{${param.name}}}`)
        }
      }

      let bodyMode: BodyMode = 'none'
      let body = ''
      let formFields: KeyValue[] = []

      if (isV3 && operation.requestBody) {
        const requestBody = resolveRef(doc, operation.requestBody)
        const content = requestBody?.content ?? {}
        const jsonType = Object.keys(content).find((type) => type.includes('json'))
        const formType = Object.keys(content).find((type) => type.includes('x-www-form-urlencoded'))
        const multipartType = Object.keys(content).find((type) => type.includes('multipart/form-data'))

        if (jsonType) {
          bodyMode = 'json'
          body = JSON.stringify(sampleFromSchema(resolveRef(doc, content[jsonType].schema)), null, 2)
        } else if (formType || multipartType) {
          bodyMode = formType ? 'form' : 'multipart'
          const schema = resolveRef(doc, content[(formType ?? multipartType)!].schema)
          formFields = objectToKv((sampleFromSchema(schema) as Record<string, unknown>) ?? {})
        } else if (Object.keys(content).length) {
          warnings.push(`${method} ${path}: body kiểu ${Object.keys(content)[0]} chưa được hỗ trợ`)
        }
      } else if (isV2) {
        const bodyParam = allParams.find((p: any) => p?.in === 'body')
        if (bodyParam) {
          bodyMode = 'json'
          body = JSON.stringify(sampleFromSchema(resolveRef(doc, bodyParam.schema)), null, 2)
        }
        const formParams = allParams.filter((p: any) => p?.in === 'formData')
        if (formParams.length) {
          bodyMode = 'form'
          formFields = formParams.map((p: any) => kv(p.name, ''))
        }
      }

      const tag = operation.tags?.[0]
      requests.push(
        emptySpec({
          name: operation.summary || operation.operationId || `${method} ${path}`,
          collectionId: tag ? collectionForTag(tag) : root.id,
          method,
          url: baseVar + urlPath,
          params: query,
          headers,
          bodyMode,
          body,
          formFields,
        }),
      )
    }
  }

  if (!requests.length) warnings.push('Không tìm thấy endpoint nào trong tài liệu')

  const environments: Environment[] = [
    { id: uid('env_'), name: `${title} env`, vars: [kv('BASE_URL', serverUrl)] },
  ]

  return { collections, requests, environments, warnings }
}

/** Sniff the format so the user only has to paste a file, not classify it. */
export function importAny(text: string): ImportResult {
  let doc: any
  try {
    doc = JSON.parse(text)
  } catch (err) {
    throw new Error(`JSON không hợp lệ: ${(err as Error).message}`)
  }

  if (doc?.openapi || doc?.swagger) return importOpenApi(doc)
  if (doc?.info && Array.isArray(doc?.item)) return importPostmanCollection(doc)
  throw new Error('Không nhận diện được định dạng. Hỗ trợ: Postman Collection v2.x, OpenAPI 3, Swagger 2.')
}
