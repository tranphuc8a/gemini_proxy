import { useMemo, useState } from 'react'

import { useStore } from '../store'
import { formatNumber } from '../lib/format'
import {
  IconChevron,
  IconCollection,
  IconDatabase,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconTrash,
  IconView,
} from './Icons'
import { useConfirm } from './useConfirm'

export function Sidebar() {
  const databases = useStore((state) => state.databases)
  const collections = useStore((state) => state.collections)
  const expanded = useStore((state) => state.expanded)
  const activeDb = useStore((state) => state.activeDb)
  const activeCollection = useStore((state) => state.activeCollection)
  const toggleDatabase = useStore((state) => state.toggleDatabase)
  const selectCollection = useStore((state) => state.selectCollection)
  const loadDatabases = useStore((state) => state.loadDatabases)
  const loadCollections = useStore((state) => state.loadCollections)
  const createDatabase = useStore((state) => state.createDatabase)
  const dropDatabase = useStore((state) => state.dropDatabase)
  const createCollection = useStore((state) => state.createCollection)
  const dropCollection = useStore((state) => state.dropCollection)

  const { confirm, dialog } = useConfirm()
  const [search, setSearch] = useState('')
  const [newDatabase, setNewDatabase] = useState('')
  const [newCollectionFor, setNewCollectionFor] = useState<string | null>(null)
  const [newCollection, setNewCollection] = useState('')

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return databases
    return databases.filter(
      (database) =>
        database.name.toLowerCase().includes(needle) ||
        (collections[database.name] ?? []).some((item) => item.name.toLowerCase().includes(needle)),
    )
  }, [databases, collections, search])

  function visibleCollections(database: string) {
    const needle = search.trim().toLowerCase()
    const list = collections[database] ?? []
    if (!needle || database.toLowerCase().includes(needle)) return list
    return list.filter((item) => item.name.toLowerCase().includes(needle))
  }

  async function onDropDatabase(name: string) {
    const ok = await confirm({
      title: `Drop database "${name}"?`,
      body: 'Every collection, document and index in it is removed. This cannot be undone.',
      confirmWord: name,
      confirmLabel: 'Drop database',
    })
    if (ok) await dropDatabase(name)
  }

  async function onDropCollection(database: string, collection: string) {
    const ok = await confirm({
      title: `Drop collection "${collection}"?`,
      body: `All documents and indexes in ${database}.${collection} are removed. This cannot be undone.`,
      confirmWord: collection,
      confirmLabel: 'Drop collection',
    })
    if (ok) await dropCollection(database, collection)
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-search">
        <IconSearch />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Filter databases and collections"
          aria-label="Filter databases and collections"
        />
      </div>

      <div className="sidebar-heading">
        <span>Databases</span>
        <div className="sidebar-heading-actions">
          <button type="button" className="icon-btn" onClick={() => loadDatabases()} title="Refresh">
            <IconRefresh />
          </button>
        </div>
      </div>

      <form
        className="inline-form"
        onSubmit={async (event) => {
          event.preventDefault()
          const name = newDatabase.trim()
          if (!name) return
          if (await createDatabase(name, 'documents')) setNewDatabase('')
        }}
      >
        <input
          value={newDatabase}
          onChange={(event) => setNewDatabase(event.target.value)}
          placeholder="New database…"
          aria-label="New database name"
        />
        <button type="submit" className="icon-btn" disabled={!newDatabase.trim()} title="Create database">
          <IconPlus />
        </button>
      </form>

      <nav className="tree">
        {filtered.length === 0 ? <p className="sidebar-empty">No databases match.</p> : null}

        {filtered.map((database) => {
          const isOpen = expanded.includes(database.name)
          const items = visibleCollections(database.name)
          return (
            <div key={database.name} className="tree-group">
              <div className={`tree-db${activeDb === database.name ? ' is-active' : ''}`}>
                <button type="button" className="tree-db-main" onClick={() => toggleDatabase(database.name)}>
                  <span className={`tree-caret${isOpen ? ' is-open' : ''}`}>
                    <IconChevron size={12} />
                  </span>
                  <IconDatabase size={13} />
                  <span className="tree-name">{database.name}</span>
                </button>
                <div className="tree-actions">
                  <button
                    type="button"
                    className="icon-btn"
                    title="New collection"
                    onClick={() => {
                      setNewCollectionFor(newCollectionFor === database.name ? null : database.name)
                      setNewCollection('')
                    }}
                  >
                    <IconPlus size={12} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn icon-btn-danger"
                    title="Drop database"
                    onClick={() => onDropDatabase(database.name)}
                  >
                    <IconTrash size={12} />
                  </button>
                </div>
              </div>

              {newCollectionFor === database.name ? (
                <form
                  className="inline-form inline-form-nested"
                  onSubmit={async (event) => {
                    event.preventDefault()
                    const name = newCollection.trim()
                    if (!name) return
                    if (await createCollection(database.name, name)) {
                      setNewCollection('')
                      setNewCollectionFor(null)
                    }
                  }}
                >
                  <input
                    autoFocus
                    value={newCollection}
                    onChange={(event) => setNewCollection(event.target.value)}
                    placeholder="New collection…"
                    aria-label="New collection name"
                  />
                  <button type="submit" className="icon-btn" disabled={!newCollection.trim()}>
                    <IconPlus size={12} />
                  </button>
                </form>
              ) : null}

              {isOpen ? (
                <div className="tree-children">
                  {items.length === 0 ? (
                    <p className="tree-empty">
                      {collections[database.name] ? 'No collections.' : 'Loading…'}
                      {collections[database.name] ? (
                        <button
                          type="button"
                          className="link-btn"
                          onClick={() => loadCollections(database.name, true)}
                        >
                          refresh
                        </button>
                      ) : null}
                    </p>
                  ) : null}
                  {items.map((collection) => {
                    const isActive = activeDb === database.name && activeCollection === collection.name
                    return (
                      <div key={collection.name} className={`tree-item${isActive ? ' is-active' : ''}`}>
                        <button
                          type="button"
                          className="tree-item-main"
                          onClick={() => selectCollection(database.name, collection.name)}
                        >
                          {collection.type === 'view' ? <IconView size={12} /> : <IconCollection size={12} />}
                          <span className="tree-name">{collection.name}</span>
                          {collection.count !== null ? (
                            <span className="tree-count">{formatNumber(collection.count)}</span>
                          ) : null}
                        </button>
                        <div className="tree-actions">
                          <button
                            type="button"
                            className="icon-btn icon-btn-danger"
                            title="Drop collection"
                            onClick={() => onDropCollection(database.name, collection.name)}
                          >
                            <IconTrash size={12} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                  {items.length > 0 ? (
                    <button
                      type="button"
                      className="link-btn tree-stats-link"
                      onClick={() => loadCollections(database.name, true)}
                    >
                      Load document counts
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          )
        })}
      </nav>
      {dialog}
    </aside>
  )
}
