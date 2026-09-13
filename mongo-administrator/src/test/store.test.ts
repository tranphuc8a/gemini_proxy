import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError, api } from '../lib/api'
import { storage } from '../lib/storage'
import { DEFAULT_LIMIT, useStore } from '../store'
import type { DocumentPage, SessionInfo } from '../types'

const SESSION: SessionInfo = {
  token: 'tok-123',
  host: 'db.local',
  port: 27017,
  username: 'root',
  database: null,
  auth_source: 'admin',
  tls: false,
  srv: false,
  label: 'root@db.local:27017',
  server_version: '8.0.4',
  server_flavor: 'MongoDB',
  topology: 'standalone',
  connected_at: '2026-09-13T00:00:00+00:00',
  last_used_at: '2026-09-13T00:00:00+00:00',
}

function page(overrides: Partial<DocumentPage> = {}): DocumentPage {
  return {
    database: 'shop',
    collection: 'orders',
    documents: [{ _id: { $oid: 'a' }, n: 1 }],
    fields: ['_id', 'n'],
    total: 1,
    skip: 0,
    limit: DEFAULT_LIMIT,
    duration_ms: 1,
    truncated: false,
    ...overrides,
  }
}

function mutation(overrides: Record<string, unknown> = {}) {
  return {
    acknowledged: true,
    matched: 0,
    modified: 0,
    inserted: 0,
    deleted: 0,
    upserted_id: null,
    inserted_ids: [],
    duration_ms: 1,
    detail: null,
    ...overrides,
  } as never
}

/** Reset the singleton store between tests. */
const PRISTINE = useStore.getState()

beforeEach(() => {
  window.localStorage.clear()
  useStore.setState({
    ...PRISTINE,
    status: 'idle',
    session: null,
    connectError: null,
    databases: [],
    collections: {},
    expanded: [],
    activeDb: null,
    activeCollection: null,
    tab: 'documents',
    filterText: '{}',
    projectionText: '',
    sortText: '',
    skip: 0,
    limit: DEFAULT_LIMIT,
    page: null,
    queryError: null,
    selected: [],
    indexes: [],
    stats: null,
    aggregateResult: null,
    aggregateError: null,
    history: [],
    toasts: [],
    busy: false,
  })
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function connected() {
  useStore.setState({ status: 'connected', session: SESSION, activeDb: 'shop', activeCollection: 'orders' })
}

describe('connect', () => {
  it('stores the token and loads databases', async () => {
    vi.spyOn(api, 'connect').mockResolvedValue(SESSION)
    vi.spyOn(api, 'listDatabases').mockResolvedValue([
      { name: 'shop', size_on_disk: 1, empty: false, collections: null },
    ])

    const ok = await useStore.getState().connect({ host: 'db.local' }, {
      mode: 'fields', host: 'db.local', port: 27017, username: 'root',
      database: '', authSource: '', tls: false, srv: false, uri: '',
    })

    expect(ok).toBe(true)
    expect(storage.getToken()).toBe('tok-123')
    expect(useStore.getState().status).toBe('connected')
    expect(useStore.getState().databases).toHaveLength(1)
  })

  it('surfaces the failure on the login screen rather than as a toast', async () => {
    vi.spyOn(api, 'connect').mockRejectedValue(new ApiError('Authentication failed', 401))

    const ok = await useStore.getState().connect({ host: 'db.local' }, {
      mode: 'fields', host: 'db.local', port: 27017, username: 'root',
      database: '', authSource: '', tls: false, srv: false, uri: '',
    })

    expect(ok).toBe(false)
    expect(useStore.getState().status).toBe('idle')
    expect(useStore.getState().connectError).toBe('Authentication failed')
    expect(useStore.getState().toasts).toHaveLength(0)
    expect(storage.getToken()).toBeNull()
  })
})

describe('bootstrap', () => {
  it('does nothing without a stored token', async () => {
    const current = vi.spyOn(api, 'currentSession')
    await useStore.getState().bootstrap()
    expect(current).not.toHaveBeenCalled()
    expect(useStore.getState().status).toBe('idle')
  })

  it('restores a stored session', async () => {
    storage.setToken('tok-123')
    vi.spyOn(api, 'currentSession').mockResolvedValue(SESSION)
    vi.spyOn(api, 'listDatabases').mockResolvedValue([])

    await useStore.getState().bootstrap()
    expect(useStore.getState().status).toBe('connected')
    expect(useStore.getState().session?.token).toBe('tok-123')
  })

  it('drops a token the server no longer recognises, quietly', async () => {
    storage.setToken('stale')
    vi.spyOn(api, 'currentSession').mockRejectedValue(new ApiError('Session expired', 401))

    await useStore.getState().bootstrap()
    expect(useStore.getState().status).toBe('idle')
    expect(storage.getToken()).toBeNull()
    expect(useStore.getState().toasts).toHaveLength(0)
  })
})

describe('disconnect', () => {
  it('clears everything, even if the server call fails', async () => {
    connected()
    storage.setToken('tok-123')
    useStore.setState({ page: page(), databases: [{ name: 'shop', size_on_disk: 1, empty: false, collections: null }] })
    vi.spyOn(api, 'disconnect').mockRejectedValue(new ApiError('gone', 500))

    await useStore.getState().disconnect()

    expect(storage.getToken()).toBeNull()
    expect(useStore.getState().status).toBe('idle')
    expect(useStore.getState().databases).toEqual([])
    expect(useStore.getState().page).toBeNull()
  })
})

describe('guard', () => {
  it('reports an unexpected failure as a toast', async () => {
    connected()
    vi.spyOn(api, 'listDatabases').mockRejectedValue(new ApiError('server exploded', 500))

    await useStore.getState().loadDatabases()

    expect(useStore.getState().toasts).toHaveLength(1)
    expect(useStore.getState().toasts[0].message).toBe('server exploded')
    expect(useStore.getState().busy).toBe(false)
  })

  it('a 401 mid-session sends the user back to the login screen', async () => {
    connected()
    storage.setToken('tok-123')
    vi.spyOn(api, 'listDatabases').mockRejectedValue(new ApiError('Session expired', 401))

    await useStore.getState().loadDatabases()

    expect(useStore.getState().status).toBe('idle')
    expect(useStore.getState().session).toBeNull()
    expect(storage.getToken()).toBeNull()
  })

  it('clears busy after a success', async () => {
    connected()
    vi.spyOn(api, 'listDatabases').mockResolvedValue([])
    await useStore.getState().loadDatabases()
    expect(useStore.getState().busy).toBe(false)
  })
})

describe('navigation', () => {
  it('expanding a database loads its collections once', async () => {
    connected()
    const list = vi.spyOn(api, 'listCollections').mockResolvedValue([])

    await useStore.getState().toggleDatabase('shop')
    expect(useStore.getState().expanded).toContain('shop')
    expect(list).toHaveBeenCalledOnce()

    await useStore.getState().toggleDatabase('shop') // collapse
    await useStore.getState().toggleDatabase('shop') // expand again
    expect(list).toHaveBeenCalledOnce() // cached
  })

  it('selecting a collection resets the page state', async () => {
    connected()
    useStore.setState({ skip: 50, selected: ['a'], page: page(), indexes: [{ name: '_id_' } as never] })
    vi.spyOn(api, 'findDocuments').mockResolvedValue(page())

    await useStore.getState().selectCollection('shop', 'users')

    expect(useStore.getState().activeCollection).toBe('users')
    expect(useStore.getState().skip).toBe(0)
    expect(useStore.getState().selected).toEqual([])
    expect(useStore.getState().indexes).toEqual([])
  })

  it('each tab loads what it shows', async () => {
    connected()
    const find = vi.spyOn(api, 'findDocuments').mockResolvedValue(page())
    const indexes = vi.spyOn(api, 'listIndexes').mockResolvedValue([])
    const stats = vi.spyOn(api, 'collectionStats').mockResolvedValue({ database: 'shop', collection: 'orders', stats: {} })

    await useStore.getState().setTab('documents')
    await useStore.getState().setTab('indexes')
    await useStore.getState().setTab('stats')

    expect(find).toHaveBeenCalledOnce()
    expect(indexes).toHaveBeenCalledOnce()
    expect(stats).toHaveBeenCalledOnce()
  })
})

describe('runFind', () => {
  it('parses relaxed filters before sending them', async () => {
    connected()
    const find = vi.spyOn(api, 'findDocuments').mockResolvedValue(page())
    useStore.setState({ filterText: '{_id: ObjectId("507f1f77bcf86cd799439011")}' })

    await useStore.getState().runFind()

    expect(find).toHaveBeenCalledWith('shop', 'orders', {
      filter: { _id: { $oid: '507f1f77bcf86cd799439011' } },
      projection: undefined,
      sort: undefined,
      skip: 0,
      limit: DEFAULT_LIMIT,
    })
  })

  it('sends sort and projection only when they are filled in', async () => {
    connected()
    const find = vi.spyOn(api, 'findDocuments').mockResolvedValue(page())
    useStore.setState({ sortText: '{n: -1}', projectionText: '{n: 1}' })

    await useStore.getState().runFind()

    expect(find.mock.calls[0][2]).toMatchObject({ sort: { n: -1 }, projection: { n: 1 } })
  })

  it('reports a bad filter in the query bar and never calls the API', async () => {
    connected()
    const find = vi.spyOn(api, 'findDocuments')
    useStore.setState({ filterText: '{a: }' })

    await useStore.getState().runFind()

    expect(find).not.toHaveBeenCalled()
    expect(useStore.getState().queryError).toBeTruthy()
    expect(useStore.getState().toasts).toHaveLength(0)
  })

  it('clears a previous error once the filter parses', async () => {
    connected()
    vi.spyOn(api, 'findDocuments').mockResolvedValue(page())
    useStore.setState({ queryError: 'old problem' })

    await useStore.getState().runFind()
    expect(useStore.getState().queryError).toBeNull()
  })

  it('records the filter in history, but not an empty one', async () => {
    connected()
    vi.spyOn(api, 'findDocuments').mockResolvedValue(page())

    await useStore.getState().runFind()
    expect(useStore.getState().history).toHaveLength(0)

    useStore.setState({ filterText: '{n: 1}' })
    await useStore.getState().runFind()
    expect(useStore.getState().history).toHaveLength(1)
    expect(useStore.getState().history[0].namespace).toBe('shop.orders')
  })

  it('paging moves the offset', async () => {
    connected()
    const find = vi.spyOn(api, 'findDocuments').mockResolvedValue(page())

    await useStore.getState().goToPage(50)
    expect(useStore.getState().skip).toBe(50)
    expect(find.mock.calls[0][2]).toMatchObject({ skip: 50 })

    await useStore.getState().goToPage(-10) // clamped
    expect(useStore.getState().skip).toBe(0)
  })

  it('does nothing without a collection', async () => {
    useStore.setState({ status: 'connected', session: SESSION })
    const find = vi.spyOn(api, 'findDocuments')
    await useStore.getState().runFind()
    expect(find).not.toHaveBeenCalled()
  })
})

describe('document writes', () => {
  it('insert parses shell syntax and refreshes', async () => {
    connected()
    const insert = vi.spyOn(api, 'insertDocuments').mockResolvedValue(mutation({ inserted: 1 }))
    vi.spyOn(api, 'findDocuments').mockResolvedValue(page())

    expect(await useStore.getState().insertDocument('{name: "ann"}')).toBe(true)
    expect(insert).toHaveBeenCalledWith('shop', 'orders', { name: 'ann' })
  })

  it('insert reports a parse failure without calling the API', async () => {
    connected()
    const insert = vi.spyOn(api, 'insertDocuments')
    expect(await useStore.getState().insertDocument('{oops')).toBe(false)
    expect(insert).not.toHaveBeenCalled()
    expect(useStore.getState().toasts[0].kind).toBe('error')
  })

  it('replace targets the document by _id and strips _id from the body', async () => {
    connected()
    const update = vi.spyOn(api, 'updateDocuments').mockResolvedValue(mutation({ matched: 1, modified: 1 }))
    vi.spyOn(api, 'findDocuments').mockResolvedValue(page())

    await useStore.getState().replaceDocument(
      { _id: { $oid: 'a' }, n: 1 },
      '{_id: ObjectId("a"), n: 2}',
    )

    expect(update).toHaveBeenCalledWith('shop', 'orders', {
      filter: { _id: { $oid: 'a' } },
      update: { n: 2 },
    })
  })

  it('refuses to edit a document with no _id', async () => {
    connected()
    const update = vi.spyOn(api, 'updateDocuments')
    expect(await useStore.getState().replaceDocument({ n: 1 }, '{n: 2}')).toBe(false)
    expect(update).not.toHaveBeenCalled()
  })

  it('delete targets the document by _id', async () => {
    connected()
    const remove = vi.spyOn(api, 'deleteDocuments').mockResolvedValue(mutation({ deleted: 1 }))
    vi.spyOn(api, 'findDocuments').mockResolvedValue(page())

    await useStore.getState().deleteDocument({ _id: { $oid: 'a' }, n: 1 })
    expect(remove).toHaveBeenCalledWith('shop', 'orders', { _id: { $oid: 'a' } })
  })

  it('refuses to delete a document with no _id', async () => {
    connected()
    const remove = vi.spyOn(api, 'deleteDocuments')
    expect(await useStore.getState().deleteDocument({ n: 1 })).toBe(false)
    expect(remove).not.toHaveBeenCalled()
  })

  it('bulk delete uses an $in over the selected ids', async () => {
    connected()
    const documents = [
      { _id: { $oid: 'a' }, n: 1 },
      { _id: { $oid: 'b' }, n: 2 },
      { _id: { $oid: 'c' }, n: 3 },
    ]
    useStore.setState({ page: page({ documents }), selected: ['a', 'c'] })
    const remove = vi.spyOn(api, 'deleteDocuments').mockResolvedValue(mutation({ deleted: 2 }))
    vi.spyOn(api, 'findDocuments').mockResolvedValue(page())

    await useStore.getState().deleteSelected()

    expect(remove).toHaveBeenCalledWith(
      'shop',
      'orders',
      { _id: { $in: [{ $oid: 'a' }, { $oid: 'c' }] } },
      true,
    )
  })

  it('bulk delete does nothing with an empty selection', async () => {
    connected()
    useStore.setState({ page: page(), selected: [] })
    const remove = vi.spyOn(api, 'deleteDocuments')
    expect(await useStore.getState().deleteSelected()).toBe(false)
    expect(remove).not.toHaveBeenCalled()
  })

  it('selection toggles on and off', () => {
    useStore.getState().toggleSelected('a')
    useStore.getState().toggleSelected('b')
    expect(useStore.getState().selected).toEqual(['a', 'b'])
    useStore.getState().toggleSelected('a')
    expect(useStore.getState().selected).toEqual(['b'])
    useStore.getState().clearSelection()
    expect(useStore.getState().selected).toEqual([])
  })
})

describe('collections', () => {
  it('dropping the active collection clears the view', async () => {
    connected()
    vi.spyOn(api, 'dropCollection').mockResolvedValue(mutation({ detail: 'Dropped' }))
    vi.spyOn(api, 'listCollections').mockResolvedValue([])
    useStore.setState({ page: page() })

    await useStore.getState().dropCollection('shop', 'orders')

    expect(useStore.getState().activeCollection).toBeNull()
    expect(useStore.getState().page).toBeNull()
  })

  it('dropping a database collapses and forgets it', async () => {
    connected()
    useStore.setState({ expanded: ['shop'], collections: { shop: [] } })
    vi.spyOn(api, 'dropDatabase').mockResolvedValue(mutation({ detail: 'Dropped' }))
    vi.spyOn(api, 'listDatabases').mockResolvedValue([])

    await useStore.getState().dropDatabase('shop')

    expect(useStore.getState().expanded).toEqual([])
    expect(useStore.getState().collections.shop).toBeUndefined()
    expect(useStore.getState().activeDb).toBeNull()
  })

  it('renaming follows the collection to its new name', async () => {
    connected()
    vi.spyOn(api, 'renameCollection').mockResolvedValue(mutation({ detail: 'Renamed' }))
    vi.spyOn(api, 'listCollections').mockResolvedValue([])
    vi.spyOn(api, 'findDocuments').mockResolvedValue(page())

    await useStore.getState().renameCollection('shop', 'orders', 'orders_v2')
    expect(useStore.getState().activeCollection).toBe('orders_v2')
  })
})

describe('indexes', () => {
  it('create parses the keys and forwards the options', async () => {
    connected()
    const create = vi.spyOn(api, 'createIndex').mockResolvedValue(mutation({ detail: 'Created index' }))
    vi.spyOn(api, 'listIndexes').mockResolvedValue([])

    await useStore.getState().createIndex({
      keysText: '{email: 1}', name: 'email_unique', unique: true, sparse: false, ttl: '3600',
    })

    expect(create).toHaveBeenCalledWith('shop', 'orders', {
      keys: { email: 1 },
      name: 'email_unique',
      unique: true,
      sparse: false,
      ttl_seconds: 3600,
    })
  })

  it('an empty name and ttl become null', async () => {
    connected()
    const create = vi.spyOn(api, 'createIndex').mockResolvedValue(mutation())
    vi.spyOn(api, 'listIndexes').mockResolvedValue([])

    await useStore.getState().createIndex({ keysText: '{a: 1}', name: '  ', unique: false, sparse: false, ttl: '' })
    expect(create.mock.calls[0][2]).toMatchObject({ name: null, ttl_seconds: null })
  })

  it('bad keys never reach the API', async () => {
    connected()
    const create = vi.spyOn(api, 'createIndex')
    expect(
      await useStore.getState().createIndex({ keysText: '[1]', name: '', unique: false, sparse: false, ttl: '' }),
    ).toBe(false)
    expect(create).not.toHaveBeenCalled()
  })
})

describe('aggregate', () => {
  it('parses and runs the pipeline', async () => {
    connected()
    const aggregate = vi.spyOn(api, 'aggregate').mockResolvedValue({
      kind: 'aggregate', database: 'shop', result: null, documents: [{ n: 1 }], row_count: 1,
      duration_ms: 1, truncated: false,
    })
    useStore.setState({ pipelineText: '[{$match: {a: 1}}]' })

    await useStore.getState().runAggregate()

    expect(aggregate).toHaveBeenCalledWith('shop', 'orders', [{ $match: { a: 1 } }])
    expect(useStore.getState().aggregateResult?.row_count).toBe(1)
    expect(useStore.getState().history[0].kind).toBe('aggregate')
  })

  it('a malformed pipeline is reported inline', async () => {
    connected()
    const aggregate = vi.spyOn(api, 'aggregate')
    useStore.setState({ pipelineText: '{$match: {}}' })

    await useStore.getState().runAggregate()

    expect(aggregate).not.toHaveBeenCalled()
    expect(useStore.getState().aggregateError).toMatch(/must be an array/)
  })
})

describe('history and chrome', () => {
  it('applying a find entry fills the filter and switches tab', () => {
    useStore.getState().applyHistory({
      id: '1', text: '{a: 1}', kind: 'find', namespace: 'shop.orders', at: '2026-09-13T00:00:00Z',
    })
    expect(useStore.getState().filterText).toBe('{a: 1}')
    expect(useStore.getState().tab).toBe('documents')
  })

  it('applying an aggregate entry fills the pipeline', () => {
    useStore.getState().applyHistory({
      id: '1', text: '[{$match: {}}]', kind: 'aggregate', namespace: 'shop.orders', at: '2026-09-13T00:00:00Z',
    })
    expect(useStore.getState().pipelineText).toBe('[{$match: {}}]')
    expect(useStore.getState().tab).toBe('aggregate')
  })

  it('the theme is persisted and applied to the document', () => {
    useStore.getState().setTheme('light')
    expect(storage.getTheme()).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('toasts expire on their own', () => {
    useStore.getState().toast('success', 'saved')
    expect(useStore.getState().toasts).toHaveLength(1)
    vi.advanceTimersByTime(4000)
    expect(useStore.getState().toasts).toHaveLength(0)
  })

  it('an error toast lingers longer than a success one', () => {
    useStore.getState().toast('error', 'boom')
    vi.advanceTimersByTime(4000)
    expect(useStore.getState().toasts).toHaveLength(1)
    vi.advanceTimersByTime(4000)
    expect(useStore.getState().toasts).toHaveLength(0)
  })

  it('a toast can be dismissed by hand', () => {
    useStore.getState().toast('info', 'hello')
    const id = useStore.getState().toasts[0].id
    useStore.getState().dismissToast(id)
    expect(useStore.getState().toasts).toHaveLength(0)
  })
})
