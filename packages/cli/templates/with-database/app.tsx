/**
 * Notes App with SQLite Database
 *
 * Data is stored in SQLite with search support.
 */
import { createHyperstar, hs, Schema } from "hyperstar"
import { Database } from "bun:sqlite"
import { join } from "node:path"
import { mkdirSync } from "node:fs"

// ============================================================================
// Database Setup
// ============================================================================

const DB_PATH = join(import.meta.dir, "data", "notes.db")

// Ensure data directory exists
try {
  mkdirSync(join(import.meta.dir, "data"), { recursive: true })
} catch {}

const db = new Database(DB_PATH)
db.exec("PRAGMA journal_mode = WAL")
db.exec(`
  CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`)

// ============================================================================
// Types
// ============================================================================

interface Note {
  id: string
  title: string
  content: string
  createdAt: string
  updatedAt: string
}

interface Store {
  notes: Note[]
  searchQuery: string
}

interface Signals {
  searchInput: string
  title: string
  content: string
}

// ============================================================================
// Database Helpers
// ============================================================================

function getAllNotes(): Note[] {
  const rows = db
    .query("SELECT id, title, content, created_at, updated_at FROM notes ORDER BY updated_at DESC")
    .all() as { id: string; title: string; content: string; created_at: string; updated_at: string }[]

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

function searchNotes(query: string): Note[] {
  const rows = db
    .query(
      `SELECT id, title, content, created_at, updated_at FROM notes
       WHERE title LIKE ? OR content LIKE ?
       ORDER BY updated_at DESC`
    )
    .all(`%${query}%`, `%${query}%`) as {
    id: string
    title: string
    content: string
    created_at: string
    updated_at: string
  }[]

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

// ============================================================================
// Create App Factory
// ============================================================================

const app = createHyperstar<Store, {}, Signals>()
const { searchInput, title, content } = app.signals

// ============================================================================
// Actions
// ============================================================================

const addNote = app.action(
  "addNote",
  { title: Schema.String, content: Schema.String },
  (ctx, { title: t, content: c }) => {
    if (!t.trim()) return

    const now = new Date().toISOString()
    const id = crypto.randomUUID()

    db.run(
      "INSERT INTO notes (id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      [id, t.trim(), c.trim(), now, now]
    )

    const newNote: Note = { id, title: t.trim(), content: c.trim(), createdAt: now, updatedAt: now }
    ctx.update((s) => ({ ...s, notes: [newNote, ...s.notes] }))
    ctx.patchSignals({ title: "", content: "" })
  }
)

const deleteNote = app.action("deleteNote", { id: Schema.String }, (ctx, { id }) => {
  db.run("DELETE FROM notes WHERE id = ?", [id])
  ctx.update((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== id) }))
})

const setSearch = app.action("setSearch", { query: Schema.String }, (ctx, { query }) => {
  ctx.update((s) => ({ ...s, searchQuery: query }))
})

const clearSearch = app.action("clearSearch", (ctx) => {
  ctx.update((s) => ({ ...s, searchQuery: "" }))
  ctx.patchSignals({ searchInput: "" })
})

// ============================================================================
// App
// ============================================================================

const server = app.app({
  store: {
    notes: getAllNotes(),
    searchQuery: "",
  },
  signals: { searchInput: "", title: "", content: "" },

  view: (ctx) => {
    const notes = ctx.store.searchQuery.trim()
      ? searchNotes(ctx.store.searchQuery)
      : ctx.store.notes

    return (
      <div id="app" class="max-w-xl mx-auto p-8">
        <h1 class="text-3xl font-bold text-gray-900 mb-2">SQLite Notes</h1>
        <p class="text-gray-500 mb-6">Notes stored in SQLite with search support.</p>

        {/* Search */}
        <form $={hs.form(setSearch, { query: searchInput })} class="mb-4 flex gap-2">
          <input
            type="text"
            placeholder="Search notes..."
            $={hs.bind(searchInput)}
            class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
          >
            Search
          </button>
          {ctx.store.searchQuery && (
            <button
              type="button"
              $={hs.action(clearSearch)}
              class="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 font-medium rounded-lg transition-colors"
            >
              Clear
            </button>
          )}
        </form>

        {/* Add Note Form */}
        <form $={hs.form(addNote, { title, content })} class="bg-gray-100 p-4 rounded-lg mb-6">
          <input
            type="text"
            placeholder="Note title..."
            $={hs.bind(title)}
            class="w-full px-3 py-2 mb-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <textarea
            placeholder="Note content (optional)..."
            rows={3}
            $={hs.bind(content)}
            class="w-full px-3 py-2 mb-2 border border-gray-300 rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            hs-show={title.isNotEmpty()}
            class="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors"
          >
            Add Note
          </button>
        </form>

        {/* Notes List */}
        {notes.length === 0 ? (
          <p class="text-center text-gray-400 py-8">
            {ctx.store.searchQuery ? "No matching notes found." : "No notes yet. Add one above!"}
          </p>
        ) : (
          <div class="flex flex-col gap-4">
            {notes.map((note) => (
              <div
                id={`note-${note.id}`}
                class="bg-white p-4 rounded-lg border border-gray-200 shadow-sm"
              >
                <div class="flex justify-between items-start mb-2">
                  <h3 class="font-semibold text-gray-800">{note.title}</h3>
                  <button
                    $={hs.action(deleteNote, { id: note.id })}
                    class="px-2 py-1 bg-red-500 hover:bg-red-600 text-white text-sm rounded transition-colors"
                  >
                    Delete
                  </button>
                </div>
                {note.content && <p class="my-2 text-gray-600 whitespace-pre-wrap">{note.content}</p>}
                <small class="text-gray-400">Updated: {new Date(note.updatedAt).toLocaleString()}</small>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <footer class="mt-8 pt-4 border-t border-gray-200 text-gray-500 text-sm">
          <p>
            Database: <code class="bg-gray-100 px-1 py-0.5 rounded text-gray-700">data/notes.db</code>
          </p>
          <p class="mt-1">Total notes: {ctx.store.notes.length}</p>
        </footer>
      </div>
    )
  },
}).serve({ port: Number(process.env.PORT) || 8080 })

console.log(`
Hyperstar running at http://localhost:${server.port}

SQLite database at ./data/notes.db
`)
