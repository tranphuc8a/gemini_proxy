import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AiError, __testing } from '../lib/ai'
import {
  CURRENT_MAX,
  QUESTION_MAX,
  applyTarget,
  askMongo,
  confirmationText,
  currentQuery,
  findTexts,
  needsConfirmation,
  normaliseAnswer,
  pipelineText,
  previewText,
  serverJavaScript,
  toPipeline,
  writeStages,
  type MongoAnswer,
} from '../lib/aiMongo'

function answer(overrides: Partial<MongoAnswer> = {}): MongoAnswer {
  return {
    mode: 'find',
    filter: {},
    projection: null,
    sort: null,
    limit: 50,
    pipeline: [],
    explanation: '',
    writes: false,
    risky: [],
    fields: 12,
    sampled: 30,
    cached: false,
    ...overrides,
  }
}

const PAID = { status: 'paid', paidAt: { $gte: { $date: '2026-10-01T00:00:00Z' } } }

const TEXTS = { filterText: '{}', projectionText: '', sortText: '', pipelineText: '[]' }

describe('askMongo', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    window.localStorage.clear()
    __testing.resetStatus()
    fetchMock = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify(answer({ filter: PAID })), { status: 200 })),
    )
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function sent() {
    const [url, init] = fetchMock.mock.calls.at(-1) as unknown as [string, RequestInit]
    return { url, headers: init.headers as Record<string, string>, body: JSON.parse(init.body as string) }
  }

  it('posts the question with the Mongo session token', async () => {
    const result = await askMongo(
      { database: 'shop', collection: 'orders', question: '  đơn đã thanh toán  ' },
      { token: 'mongo-tok' },
    )
    const { url, headers, body } = sent()
    expect(url).toBe('/ai/mongo')
    expect(headers['X-Session-Token']).toBe('mongo-tok')
    expect(headers['Content-Type']).toBe('application/json')
    expect(body).toEqual({ database: 'shop', collection: 'orders', question: 'đơn đã thanh toán' })
    expect(result.filter).toEqual(PAID)
  })

  it('sends the current query only when there is one, within the server’s limits', async () => {
    await askMongo(
      { database: 'shop', collection: 'orders', question: 'x'.repeat(QUESTION_MAX + 50), current: 'y'.repeat(CURRENT_MAX + 50) },
      { token: 'mongo-tok' },
    )
    expect(sent().body.question).toHaveLength(QUESTION_MAX)
    expect(sent().body.current).toHaveLength(CURRENT_MAX)

    await askMongo({ database: 'shop', collection: 'orders', question: 'q', current: '   ' }, { token: 'mongo-tok' })
    expect(sent().body).not.toHaveProperty('current')
  })

  it('omits the session header when there is no token', async () => {
    await askMongo({ database: 'shop', collection: 'orders', question: 'q' }, { token: null })
    expect(sent().headers).not.toHaveProperty('X-Session-Token')
  })

  it('passes an expired Mongo session through as a 401', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ status_code: 401, message: 'Session expired', data: null }), { status: 401 }),
      ),
    )
    await expect(
      askMongo({ database: 'shop', collection: 'orders', question: 'q' }, { token: 'old' }),
    ).rejects.toMatchObject({ status: 401, message: 'Session expired' })
  })
})

describe('normaliseAnswer', () => {
  it('fills in what the answer leaves out', () => {
    expect(normaliseAnswer({ mode: 'aggregate', pipeline: [{ $count: 'n' }] })).toEqual({
      mode: 'aggregate',
      filter: {},
      projection: null,
      sort: null,
      limit: 50,
      pipeline: [{ $count: 'n' }],
      explanation: '',
      writes: false,
      risky: [],
      fields: 0,
      sampled: 0,
      cached: false,
    })
  })

  it('treats an empty projection or sort as none, and keeps the limit in range', () => {
    const result = normaliseAnswer({ mode: 'find', projection: {}, sort: {}, limit: 5000 })
    expect(result.projection).toBeNull()
    expect(result.sort).toBeNull()
    expect(result.limit).toBe(1000)
    expect(normaliseAnswer({ mode: 'find', limit: 0 }).limit).toBe(50)
  })

  it('drops what has the wrong type', () => {
    const result = normaliseAnswer({ mode: 'aggregate', pipeline: [{ $match: {} }, 'nope', null], risky: ['$where', 3] })
    expect(result.pipeline).toEqual([{ $match: {} }])
    expect(result.risky).toEqual(['$where'])
  })

  it('refuses something that is not an answer', () => {
    expect(() => normaliseAnswer({ explanation: 'hi' })).toThrow(AiError)
    expect(() => normaliseAnswer(null)).toThrow(/sai định dạng/)
  })
})

describe('applyTarget', () => {
  it('keeps a find in the document browser', () => {
    expect(applyTarget(answer(), 'documents')).toBe('find')
  })

  it('sends a pipeline, or anything asked in the console, to the console', () => {
    expect(applyTarget(answer({ mode: 'aggregate' }), 'documents')).toBe('aggregate')
    expect(applyTarget(answer({ mode: 'aggregate' }), 'aggregate')).toBe('aggregate')
    expect(applyTarget(answer(), 'aggregate')).toBe('aggregate')
  })
})

describe('toPipeline', () => {
  it('turns a find into $match, $sort, $project, $limit — in that order', () => {
    const find = answer({ filter: PAID, sort: { paidAt: -1 }, projection: { total: 1 }, limit: 20 })
    expect(toPipeline(find)).toEqual([
      { $match: PAID },
      { $sort: { paidAt: -1 } },
      { $project: { total: 1 } },
      { $limit: 20 },
    ])
  })

  it('leaves out the stages a find does not use, but always matches', () => {
    expect(toPipeline(answer())).toEqual([{ $match: {} }, { $limit: 50 }])
  })

  it('returns an aggregate answer’s pipeline unchanged', () => {
    const pipeline = [{ $group: { _id: '$status', n: { $sum: 1 } } }]
    expect(toPipeline(answer({ mode: 'aggregate', pipeline }))).toEqual(pipeline)
  })

  it('is what pipelineText prints, as pretty JSON', () => {
    const find = answer({ filter: PAID })
    expect(pipelineText(find)).toBe(JSON.stringify(toPipeline(find), null, 2))
    expect(JSON.parse(pipelineText(find))).toEqual(toPipeline(find))
  })
})

describe('findTexts', () => {
  it('fills the browser editors with pretty JSON, and empties what the answer leaves unset', () => {
    expect(findTexts(answer({ filter: PAID, limit: 10 }))).toEqual({
      filterText: JSON.stringify(PAID, null, 2),
      projectionText: '',
      sortText: '',
      limit: 10,
    })
  })

  it('includes sort and projection when given', () => {
    const texts = findTexts(answer({ sort: { paidAt: -1 }, projection: { total: 1 } }))
    expect(texts.filterText).toBe('{}')
    expect(texts.sortText).toBe(JSON.stringify({ paidAt: -1 }, null, 2))
    expect(texts.projectionText).toBe(JSON.stringify({ total: 1 }, null, 2))
  })
})

describe('previewText', () => {
  it('shows a find as its parts in the browser', () => {
    expect(JSON.parse(previewText(answer({ filter: PAID, sort: { paidAt: -1 } }), 'documents'))).toEqual({
      filter: PAID,
      sort: { paidAt: -1 },
      limit: 50,
    })
  })

  it('shows the pipeline it becomes in the console', () => {
    const find = answer({ filter: PAID })
    expect(previewText(find, 'aggregate')).toBe(pipelineText(find))
  })
})

describe('serverJavaScript', () => {
  it('reports what the server flagged', () => {
    expect(serverJavaScript(answer({ risky: ['$where'] }))).toEqual(['$where'])
  })

  it('finds JavaScript operators the server did not flag, however deep', () => {
    const find = answer({ filter: { $and: [{ $where: 'this.a > 1' }] } })
    const aggregate = answer({
      mode: 'aggregate',
      pipeline: [{ $addFields: { x: { $function: { body: 'return 1', args: [], lang: 'js' } } } }],
      risky: ['$where'],
    })
    expect(serverJavaScript(find)).toEqual(['$where'])
    expect(serverJavaScript(aggregate)).toEqual(['$function', '$where'])
  })

  it('is empty for an ordinary query', () => {
    expect(serverJavaScript(answer({ filter: PAID }))).toEqual([])
  })
})

describe('writeStages', () => {
  it('names the collection each $out / $merge writes into', () => {
    expect(
      writeStages(
        [
          { $out: 'daily' },
          { $out: { db: 'reports', coll: 'daily' } },
          { $merge: 'totals' },
          { $merge: { into: 'totals', whenMatched: 'replace' } },
          { $merge: { into: { db: 'reports', coll: 'totals' } } },
        ],
        'shop',
      ),
    ).toEqual([
      { stage: '$out', target: 'shop.daily' },
      { stage: '$out', target: 'reports.daily' },
      { stage: '$merge', target: 'shop.totals' },
      { stage: '$merge', target: 'shop.totals' },
      { stage: '$merge', target: 'reports.totals' },
    ])
  })

  it('is empty for a pipeline that only reads', () => {
    expect(writeStages([{ $match: {} }, { $group: { _id: null } }], 'shop')).toEqual([])
  })
})

describe('needsConfirmation', () => {
  it('lets a plain find or pipeline run straight away', () => {
    expect(needsConfirmation(answer({ filter: PAID }))).toBe(false)
    expect(needsConfirmation(answer({ mode: 'aggregate', pipeline: [{ $match: PAID }] }))).toBe(false)
  })

  it('stops a pipeline that writes', () => {
    expect(needsConfirmation(answer({ mode: 'aggregate', pipeline: [{ $out: 'x' }], writes: true }))).toBe(true)
  })

  it('stops a $out / $merge even when the server did not flag it', () => {
    expect(needsConfirmation(answer({ mode: 'aggregate', pipeline: [{ $merge: { into: 'x' } }] }))).toBe(true)
  })

  it('stops JavaScript on the server, in a find too', () => {
    expect(needsConfirmation(answer({ risky: ['$where'] }))).toBe(true)
    expect(needsConfirmation(answer({ filter: { $where: 'true' } }))).toBe(true)
  })
})

describe('confirmationText', () => {
  it('says which collection a $out replaces, as a danger', () => {
    const text = confirmationText(answer({ mode: 'aggregate', pipeline: [{ $out: 'daily' }], writes: true }), 'shop')
    expect(text.danger).toBe(true)
    expect(text.title).toMatch(/ghi dữ liệu/)
    expect(text.body).toContain('$out')
    expect(text.body).toContain('shop.daily')
  })

  it('says where a $merge writes', () => {
    const text = confirmationText(
      answer({ mode: 'aggregate', pipeline: [{ $merge: { into: { db: 'reports', coll: 'totals' } } }], writes: true }),
      'shop',
    )
    expect(text.body).toContain('$merge')
    expect(text.body).toContain('reports.totals')
  })

  it('names the JavaScript operators, without the danger styling', () => {
    const text = confirmationText(answer({ risky: ['$where'] }), 'shop')
    expect(text.danger).toBe(false)
    expect(text.title).toMatch(/JavaScript/)
    expect(text.body).toContain('$where')
    expect(text.confirmLabel).toBe('Vẫn chạy')
  })

  it('mentions both when a pipeline writes and runs JavaScript', () => {
    const text = confirmationText(
      answer({ mode: 'aggregate', pipeline: [{ $match: { $where: 'true' } }, { $out: 'x' }], writes: true, risky: ['$where'] }),
      'shop',
    )
    expect(text.body).toContain('shop.x')
    expect(text.body).toContain('JavaScript')
  })
})

describe('currentQuery', () => {
  it('is the pipeline in the console', () => {
    expect(currentQuery('aggregate', { ...TEXTS, pipelineText: '  [{ $match: {} }]\n' })).toBe('[{ $match: {} }]')
  })

  it('is the filter text, as typed, in the browser', () => {
    expect(currentQuery('documents', { ...TEXTS, filterText: ' { status: "paid" } ' })).toBe('{ status: "paid" }')
  })

  it('labels the filter, sort and projection when there is more than a filter', () => {
    expect(
      currentQuery('documents', { ...TEXTS, filterText: '', sortText: '{ paidAt: -1 }', projectionText: '{ total: 1 }' }),
    ).toBe('filter: {}\nsort: { paidAt: -1 }\nprojection: { total: 1 }')
  })

  it('stays within what the server accepts', () => {
    expect(currentQuery('aggregate', { ...TEXTS, pipelineText: 'x'.repeat(CURRENT_MAX * 2) })).toHaveLength(CURRENT_MAX)
  })
})
