/**
 * "Hỏi AI" for one collection: the call, and every decision about its answer.
 *
 * POST /ai/mongo turns a question into a find or an aggregation pipeline. The
 * server samples documents through this app's Mongo session (hence
 * X-Session-Token) to learn the collection's field paths, and flags what
 * deserves a second look: `$out` / `$merge` write, while `$where`,
 * `$function` and `$accumulator` run JavaScript on the server.
 *
 * What an answer then does — which editor it lands in, what pipeline a find
 * becomes, whether running it needs a confirmation — is decided here in pure
 * functions, so the panel only wires them up and the rules are unit tested.
 */

import { AiError, aiPost } from './ai'

/** What the server accepts (AiQueryUseCase): longer is refused with a 422. */
export const QUESTION_MAX = 1000
export const CURRENT_MAX = 8000

/** The server's limit when the question names none. */
const DEFAULT_LIMIT = 50
const SERVER_JS = ['$where', '$function', '$accumulator']

/** Where the panel was opened. */
export type AiView = 'documents' | 'aggregate'

type Doc = Record<string, unknown>

export interface MongoAnswer {
  mode: 'find' | 'aggregate'
  /** Extended JSON; {} when the question needs no filter. */
  filter: Doc
  projection: Doc | null
  sort: Doc | null
  limit: number
  /** The aggregation; [] for a find. */
  pipeline: Doc[]
  /** In Vietnamese, for the person asking. */
  explanation: string
  /** The pipeline has `$out` / `$merge`. */
  writes: boolean
  /** Operators that run JavaScript on the server, e.g. ["$where"]. */
  risky: string[]
  /** Field paths the AI was shown, and how many documents they came from. */
  fields: number
  sampled: number
  cached: boolean
}

export interface MongoQuestion {
  database: string
  collection: string
  question: string
  /** The query being revised: sent only when the person asks to start from it. */
  current?: string
}

export interface FindTexts {
  filterText: string
  projectionText: string
  sortText: string
  limit: number
}

/** The editors' contents, as the store holds them. */
export interface QueryTexts {
  filterText: string
  projectionText: string
  sortText: string
  pipelineText: string
}

export interface WriteStage {
  stage: '$out' | '$merge'
  /** The namespace written into, e.g. "shop.daily_totals". */
  target: string
}

/** Structurally a ConfirmRequest, for useConfirm. */
export interface ConfirmText {
  title: string
  body: string
  confirmLabel: string
  danger: boolean
}

const isDoc = (value: unknown): value is Doc =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const pretty = (value: unknown) => JSON.stringify(value, null, 2)

export async function askMongo(
  ask: MongoQuestion,
  options: { token: string | null; signal?: AbortSignal },
): Promise<MongoAnswer> {
  const body: Record<string, string> = {
    database: ask.database,
    collection: ask.collection,
    question: ask.question.trim().slice(0, QUESTION_MAX),
  }
  const current = ask.current?.trim()
  if (current) body.current = current.slice(0, CURRENT_MAX)
  const raw = await aiPost<unknown>('mongo', body, {
    headers: options.token ? { 'X-Session-Token': options.token } : {},
    signal: options.signal,
  })
  return normaliseAnswer(raw)
}

/** The answer with every field present and of the right type; no mode means it is not an answer. */
export function normaliseAnswer(raw: unknown): MongoAnswer {
  const data = isDoc(raw) ? raw : {}
  if (data.mode !== 'find' && data.mode !== 'aggregate') {
    throw new AiError('AI trả lời sai định dạng — thử lại', 'bad_answer', 200)
  }
  const nonEmpty = (value: unknown) => (isDoc(value) && Object.keys(value).length > 0 ? value : null)
  const limit = Number(data.limit)
  return {
    mode: data.mode,
    filter: isDoc(data.filter) ? data.filter : {},
    projection: nonEmpty(data.projection),
    sort: nonEmpty(data.sort),
    limit: Number.isInteger(limit) && limit > 0 ? Math.min(limit, 1000) : DEFAULT_LIMIT,
    pipeline: Array.isArray(data.pipeline) ? data.pipeline.filter(isDoc) : [],
    explanation: typeof data.explanation === 'string' ? data.explanation.trim() : '',
    writes: data.writes === true,
    risky: Array.isArray(data.risky) ? data.risky.filter((item): item is string => typeof item === 'string') : [],
    fields: Number(data.fields) || 0,
    sampled: Number(data.sampled) || 0,
    cached: data.cached === true,
  }
}

/**
 * Which editor an answer lands in. A find stays a find in the document
 * browser; an aggregate answer anywhere, or any answer in the console,
 * becomes a pipeline in the console.
 */
export function applyTarget(answer: MongoAnswer, view: AiView): 'find' | 'aggregate' {
  return answer.mode === 'find' && view === 'documents' ? 'find' : 'aggregate'
}

/** The answer as a pipeline: a find becomes $match → $sort → $project → $limit. */
export function toPipeline(answer: MongoAnswer): Doc[] {
  if (answer.mode === 'aggregate') return answer.pipeline
  const stages: Doc[] = [{ $match: answer.filter }]
  if (answer.sort) stages.push({ $sort: answer.sort })
  if (answer.projection) stages.push({ $project: answer.projection })
  if (answer.limit > 0) stages.push({ $limit: answer.limit })
  return stages
}

export function pipelineText(answer: MongoAnswer): string {
  return pretty(toPipeline(answer))
}

/** A find answer as the browser's editors hold it: pretty JSON, '' for what it leaves unset. */
export function findTexts(answer: MongoAnswer): FindTexts {
  return {
    filterText: pretty(answer.filter),
    projectionText: answer.projection ? pretty(answer.projection) : '',
    sortText: answer.sort ? pretty(answer.sort) : '',
    limit: answer.limit,
  }
}

/** What the panel shows: exactly what "Áp dụng" puts in the editor. */
export function previewText(answer: MongoAnswer, view: AiView): string {
  if (applyTarget(answer, view) === 'aggregate') return pipelineText(answer)
  const { filter, projection, sort, limit } = answer
  return pretty({ filter, ...(projection ? { projection } : {}), ...(sort ? { sort } : {}), limit })
}

function scanJavaScript(value: unknown, found: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) scanJavaScript(item, found)
  } else if (isDoc(value)) {
    for (const [key, item] of Object.entries(value)) {
      if (SERVER_JS.includes(key)) found.add(key)
      scanJavaScript(item, found)
    }
  }
}

/** Operators that run JavaScript on the server: the server's list, re-checked here. */
export function serverJavaScript(answer: MongoAnswer): string[] {
  const found = new Set(answer.risky)
  scanJavaScript(answer.filter, found)
  scanJavaScript(answer.projection, found)
  scanJavaScript(answer.pipeline, found)
  return [...found].sort()
}

/** "coll", {coll} or {db, coll} as a namespace. */
function namespaceOf(spec: unknown, database: string): string {
  if (typeof spec === 'string' && spec) return `${database}.${spec}`
  if (isDoc(spec) && typeof spec.coll === 'string') {
    return `${typeof spec.db === 'string' && spec.db ? spec.db : database}.${spec.coll}`
  }
  return `${database}.?`
}

/** The `$out` / `$merge` stages of a pipeline, with the namespace each writes into. */
export function writeStages(pipeline: Doc[], database: string): WriteStage[] {
  const stages: WriteStage[] = []
  for (const stage of pipeline) {
    if ('$out' in stage) stages.push({ stage: '$out', target: namespaceOf(stage.$out, database) })
    if ('$merge' in stage) {
      const spec = stage.$merge
      stages.push({ stage: '$merge', target: namespaceOf(isDoc(spec) ? spec.into : spec, database) })
    }
  }
  return stages
}

/** Running it deserves a second look: it writes data, or runs JavaScript on the server. */
export function needsConfirmation(answer: MongoAnswer): boolean {
  return answer.writes || writeStages(answer.pipeline, '').length > 0 || serverJavaScript(answer).length > 0
}

/** The confirmation for an answer that needsConfirmation: what running it would do, in plain words. */
export function confirmationText(answer: MongoAnswer, database: string): ConfirmText {
  const writes = writeStages(answer.pipeline, database)
  const javascript = serverJavaScript(answer)
  const writing = answer.writes || writes.length > 0
  const lines = writes.map(({ stage, target }) =>
    stage === '$out'
      ? `$out thay toàn bộ collection ${target} bằng kết quả của pipeline — dữ liệu đang có ở đó sẽ mất.`
      : `$merge ghi kết quả vào collection ${target}: chèn tài liệu mới và cập nhật tài liệu trùng khoá.`,
  )
  if (writing && writes.length === 0) lines.push('Pipeline ghi kết quả ra một collection ($out/$merge).')
  if (javascript.length) {
    lines.push(
      `${javascript.join(', ')} chạy JavaScript trên server MongoDB — chậm, tốn tài nguyên và có thể bị máy chủ chặn.`,
    )
  }
  return {
    title: writing ? 'Pipeline này ghi dữ liệu — vẫn chạy?' : 'Truy vấn này chạy JavaScript trên server — vẫn chạy?',
    body: lines.join(' '),
    confirmLabel: 'Vẫn chạy',
    danger: writing,
  }
}

/**
 * The query on screen, for "Sửa từ truy vấn đang có": the pipeline in the
 * console; in the browser the filter — with its sort and projection, labelled,
 * when there are any, so revising keeps them.
 */
export function currentQuery(view: AiView, texts: QueryTexts): string {
  if (view === 'aggregate') return texts.pipelineText.trim().slice(0, CURRENT_MAX)
  const filter = texts.filterText.trim() || '{}'
  const sort = texts.sortText.trim()
  const projection = texts.projectionText.trim()
  if (!sort && !projection) return filter.slice(0, CURRENT_MAX)
  const lines = [`filter: ${filter}`]
  if (sort) lines.push(`sort: ${sort}`)
  if (projection) lines.push(`projection: ${projection}`)
  return lines.join('\n').slice(0, CURRENT_MAX)
}
