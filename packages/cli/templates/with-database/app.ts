/**
 * Notes App with SQLite Database
 *
 * Data is stored in SQLite with search support.
 */
import { createHyperstar, UI, on, $, Schema } from "hyperstar"
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

const hs = createHyperstar<Store, {}, Signals>()
const { searchInput, title, content } = hs.signals

// ============================================================================
// Actions
// ============================================================================

const addNote = hs.action(
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

const deleteNote = hs.action("deleteNote", { id: Schema.String }, (ctx, { id }) => {
  db.run("DELETE FROM notes WHERE id = ?", [id])
  ctx.update((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== id) }))
})

const setSearch = hs.action("setSearch", { query: Schema.String }, (ctx, { query }) => {
  ctx.update((s) => ({ ...s, searchQuery: query }))
})

const clearSearch = hs.action("clearSearch", (ctx) => {
  ctx.update((s) => ({ ...s, searchQuery: "" }))
  ctx.patchSignals({ searchInput: "" })
})

// ============================================================================
// App
// ============================================================================

const server = hs.app({
  store: {
    notes: getAllNotes(),
    searchQuery: "",
  },
  signals: { searchInput: "", title: "", content: "" },

  view: (ctx) => {
    const notes = ctx.store.searchQuery.trim()
      ? searchNotes(ctx.store.searchQuery)
      : ctx.store.notes

    return UI.div(
      { attrs: { id: "app", class: "max-w-xl mx-auto p-8" } },

      UI.h1({ attrs: { class: "text-3xl font-bold text-gray-900 mb-2" } }, "SQLite Notes"),
      UI.p({ attrs: { class: "text-gray-500 mb-6" } }, "Notes stored in SQLite with search support."),

      // Search
      UI.form(
        {
          attrs: { class: "mb-4 flex gap-2" },
          events: {
            submit: on.seq(
              on.script("event.preventDefault()"),
              on.action(setSearch, { query: $.signal("searchInput") })
            ),
          },
        },
        UI.input({
          attrs: {
            placeholder: "Search notes...",
            class: "flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
            "hs-bind": "searchInput",
          },
        }),
        UI.button(
          {
            attrs: { type: "submit", class: "px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors" },
          },
          "Search"
        ),
        ctx.store.searchQuery
          ? UI.button(
              {
                attrs: { type: "button", class: "px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 font-medium rounded-lg transition-colors" },
                events: { click: on.action(clearSearch) },
              },
              "Clear"
            )
          : UI.empty()
      ),

      // Add Note Form
      UI.form(
        {
          attrs: { class: "bg-gray-100 p-4 rounded-lg mb-6" },
          events: {
            submit: on.seq(
              on.script("event.preventDefault()"),
              on.action(addNote, { title: $.signal("title"), content: $.signal("content") })
            ),
          },
        },
        UI.input({
          attrs: {
            placeholder: "Note title...",
            class: "w-full px-3 py-2 mb-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
            "hs-bind": "title",
          },
        }),
        UI.el("textarea", {
          attrs: {
            placeholder: "Note content (optional)...",
            rows: "3",
            class: "w-full px-3 py-2 mb-2 border border-gray-300 rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
            "hs-bind": "content",
          },
        }),
        UI.button(
          {
            attrs: {
              type: "submit",
              class: "px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors",
              "hs-show": title.isNotEmpty().toString(),
            },
          },
          "Add Note"
        )
      ),

      // Notes List
      notes.length === 0
        ? UI.p(
            { attrs: { class: "text-center text-gray-400 py-8" } },
            ctx.store.searchQuery ? "No matching notes found." : "No notes yet. Add one above!"
          )
        : UI.div(
            { attrs: { class: "flex flex-col gap-4" } },
            ...notes.map((note) =>
              UI.div(
                {
                  attrs: {
                    id: `note-${note.id}`,
                    class: "bg-white p-4 rounded-lg border border-gray-200 shadow-sm",
                  },
                },
                UI.div(
                  { attrs: { class: "flex justify-between items-start mb-2" } },
                  UI.h3({ attrs: { class: "font-semibold text-gray-800" } }, note.title),
                  UI.button(
                    {
                      attrs: { class: "px-2 py-1 bg-red-500 hover:bg-red-600 text-white text-sm rounded transition-colors" },
                      events: { click: on.action(deleteNote, { id: note.id }) },
                    },
                    "Delete"
                  )
                ),
                note.content
                  ? UI.p({ attrs: { class: "my-2 text-gray-600 whitespace-pre-wrap" } }, note.content)
                  : UI.empty(),
                UI.el("small", { attrs: { class: "text-gray-400" } }, `Updated: ${new Date(note.updatedAt).toLocaleString()}`)
              )
            )
          ),

      // Footer
      UI.footer(
        { attrs: { class: "mt-8 pt-4 border-t border-gray-200 text-gray-500 text-sm" } },
        UI.p(
          {},
          "Database: ",
          UI.code({ attrs: { class: "bg-gray-100 px-1 py-0.5 rounded text-gray-700" } }, "data/notes.db")
        ),
        UI.p({ attrs: { class: "mt-1" } }, `Total notes: ${ctx.store.notes.length}`)
      )
    )
  },
}).serve({ port: Number(process.env.PORT) || 3000 })

console.log(`
🌟 Hyperstar running at http://localhost:${server.port}

SQLite database at ./data/notes.db
`)
