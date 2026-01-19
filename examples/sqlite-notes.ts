/**
 * Hyperstar v3 - SQLite Notes Example
 *
 * Demonstrates using SQLite for persistent storage with Bun's built-in SQLite.
 * Notes are stored in a local database file.
 *
 * Features:
 * - SQLite database for persistence
 * - CRUD operations (Create, Read, Update, Delete)
 * - Signals for form state
 * - Real-time sync across tabs
 */
import { Database } from "bun:sqlite"
import { createHyperstar, UI, on, $, Schema } from "hyperstar"

// ============================================================================
// Database Setup
// ============================================================================

const db = new Database("./examples/data/notes.db")

// Create table if not exists
db.run(`
  CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  )
`)

// ============================================================================
// Database Functions
// ============================================================================

interface Note {
  id: string
  title: string
  content: string
  created_at: string
}

const getAllNotes = (): Note[] => {
  return db.query("SELECT * FROM notes ORDER BY created_at DESC").all() as Note[]
}

const insertNote = (title: string, content: string): Note => {
  const id = crypto.randomUUID()
  db.run("INSERT INTO notes (id, title, content) VALUES (?, ?, ?)", [id, title, content])
  return db.query("SELECT * FROM notes WHERE id = ?").get(id) as Note
}

const updateNote = (id: string, title: string, content: string): void => {
  db.run("UPDATE notes SET title = ?, content = ? WHERE id = ?", [title, content, id])
}

const deleteNote = (id: string): void => {
  db.run("DELETE FROM notes WHERE id = ?", [id])
}

// ============================================================================
// Store Type (just a refresh counter to trigger re-renders)
// ============================================================================

interface Store {
  refreshCounter: number
}

interface Signals {
  newTitle: string
  newContent: string
  editingId: string | null
  editTitle: string
  editContent: string
}

// ============================================================================
// Create Factory
// ============================================================================

const hs = createHyperstar<Store, {}, Signals>()

// ============================================================================
// Signals - Client-side form state
// ============================================================================

const { newTitle, newContent, editingId, editTitle, editContent } = hs.signals

// ============================================================================
// Actions
// ============================================================================

const addNote = hs.action(
  "addNote",
  { title: Schema.String, content: Schema.String },
  (ctx, { title: t, content: c }) => {
    if (!t.trim()) return
    insertNote(t.trim(), c.trim())
    // Trigger re-render by updating refresh counter
    ctx.update((s) => ({ ...s, refreshCounter: s.refreshCounter + 1 }))
    ctx.patchSignals({ newTitle: "", newContent: "" }) // Clear form after adding
  },
)

const removeNote = hs.action("removeNote", { id: Schema.String }, (ctx, { id }) => {
  deleteNote(id)
  ctx.update((s) => ({ ...s, refreshCounter: s.refreshCounter + 1 }))
})

const saveNote = hs.action(
  "saveNote",
  { id: Schema.String, title: Schema.String, content: Schema.String },
  (ctx, { id, title: t, content: c }) => {
    updateNote(id, t.trim(), c.trim())
    ctx.update((s) => ({ ...s, refreshCounter: s.refreshCounter + 1 }))
    ctx.patchSignals({ editingId: null }) // Clear edit mode after save
  },
)

// ============================================================================
// View Components
// ============================================================================

const AddNoteForm = () =>
  UI.form(
    {
      attrs: { class: "bg-emerald-50 border border-emerald-200 p-4 rounded-lg mb-6" },
      events: {
        submit: on.seq(
          on.script("event.preventDefault()"),
          on.action(addNote, {
            title: $.signal("newTitle"),
            content: $.signal("newContent"),
          }),
        ),
      },
    },
    UI.h3({ attrs: { class: "font-semibold text-emerald-800 mb-3" } }, "New Note"),
    UI.input({
      attrs: {
        type: "text",
        placeholder: "Title",
        class:
          "w-full px-3 py-2 mb-2 border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500",
        "hs-bind": "newTitle",
      },
    }),
    UI.textarea({
      attrs: {
        placeholder: "Content (optional)",
        rows: "2",
        class:
          "w-full px-3 py-2 mb-2 border border-emerald-300 rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-emerald-500",
        "hs-bind": "newContent",
      },
    }),
    UI.button(
      {
        attrs: {
          type: "submit",
          class:
            "px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors",
        },
      },
      "Add Note",
    ),
  )

const NoteCard = (note: Note) =>
  UI.div(
    {
      attrs: {
        id: `note-${note.id}`,
        class: "bg-white p-4 rounded-lg border border-gray-200 shadow-sm",
      },
    },

    // View mode
    UI.div(
      {
        attrs: {
          "hs-show": editingId.isNot(note.id).toString(),
        },
      },
      UI.div(
        { attrs: { class: "flex justify-between items-start mb-2" } },
        UI.h3({ attrs: { class: "font-semibold text-gray-800" } }, note.title),
        UI.div(
          { attrs: { class: "flex gap-2" } },
          UI.button(
            {
              attrs: {
                class:
                  "px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded transition-colors",
              },
              events: {
                click: on.seq(
                  on.signal("editingId", $.str(note.id)),
                  on.signal("editTitle", $.str(note.title)),
                  on.signal("editContent", $.str(note.content)),
                ),
              },
            },
            "Edit",
          ),
          UI.button(
            {
              attrs: {
                class:
                  "px-2 py-1 bg-red-500 hover:bg-red-600 text-white text-sm rounded transition-colors",
              },
              events: { click: on.action(removeNote, { id: note.id }) },
            },
            "Delete",
          ),
        ),
      ),
      note.content
        ? UI.p({ attrs: { class: "text-gray-600 whitespace-pre-wrap mb-2" } }, note.content)
        : UI.empty(),
      UI.small({ attrs: { class: "text-gray-400" } }, `Created: ${note.created_at}`),
    ),

    // Edit mode
    UI.form(
      {
        attrs: {
          class: "bg-amber-50 -m-4 p-4 rounded-lg",
          "hs-show": editingId.is(note.id).toString(),
        },
        events: {
          submit: on.seq(
            on.script("event.preventDefault()"),
            on.action(saveNote, {
              id: note.id,
              title: $.signal("editTitle"),
              content: $.signal("editContent"),
            }),
          ),
        },
      },
      UI.input({
        attrs: {
          type: "text",
          class:
            "w-full px-3 py-2 mb-2 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500",
          "hs-bind": "editTitle",
        },
      }),
      UI.textarea({
        attrs: {
          rows: "2",
          class:
            "w-full px-3 py-2 mb-2 border border-amber-300 rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-amber-500",
          "hs-bind": "editContent",
        },
      }),
      UI.div(
        { attrs: { class: "flex gap-2" } },
        UI.button(
          {
            attrs: {
              type: "submit",
              class:
                "px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors",
            },
          },
          "Save",
        ),
        UI.button(
          {
            attrs: {
              type: "button",
              class:
                "px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors",
            },
            events: { click: on.signal("editingId", $.null()) },
          },
          "Cancel",
        ),
      ),
    ),
  )

// ============================================================================
// App Config
// ============================================================================

const server = hs.app({
  store: { refreshCounter: 0 },
  signals: { newTitle: "", newContent: "", editingId: null, editTitle: "", editContent: "" },

  view: (ctx) => {
    // Load notes from database on each render
    const notes = getAllNotes()

    return UI.div(
      { attrs: { id: "app", class: "max-w-xl mx-auto p-8" } },

      // Header
      UI.h1({ attrs: { class: "text-3xl font-bold text-gray-900 mb-2" } }, "SQLite Notes"),
      UI.p(
        { attrs: { class: "text-gray-500 mb-6" } },
        `${notes.length} note${notes.length !== 1 ? "s" : ""} stored in SQLite`,
      ),

      // Add Note Form
      AddNoteForm(),

      // Notes List
      notes.length === 0
        ? UI.p(
            { attrs: { class: "text-center text-gray-400 py-8" } },
            "No notes yet. Add one above!",
          )
        : UI.div(
            { attrs: { class: "flex flex-col gap-4" } },
            ...notes.map((note) => NoteCard(note)),
          ),

      // Footer
      UI.footer(
        { attrs: { class: "mt-8 pt-4 border-t border-gray-200 text-gray-500 text-sm" } },
        UI.p(
          {},
          "Using Bun's built-in ",
          UI.code({ attrs: { class: "bg-gray-100 px-1 rounded" } }, "bun:sqlite"),
          " for persistence",
        ),
        UI.p({}, "Database file: ./examples/data/notes.db"),
      ),
    )
  },
}).serve({ port: 3015 })

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                    SQLite Notes                               ║
╠═══════════════════════════════════════════════════════════════╣
║  http://localhost:${server.port}                                    ║
║                                                               ║
║  Using Bun's built-in SQLite:                                 ║
║  • import { Database } from "bun:sqlite"                      ║
║  • Data persists in ./examples/data/notes.db                  ║
╚═══════════════════════════════════════════════════════════════╝
`)

process.on("SIGINT", async () => {
  console.log("\nShutting down...")
  db.close()
  await server.stop()
  process.exit(0)
})
