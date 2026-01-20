/**
 * Hyperstar v3 - SQLite Notes Example (JSX Version)
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
import { createHyperstar, hs, Schema } from "hyperstar"

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

const deleteNoteFromDb = (id: string): void => {
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

const app = createHyperstar<Store, {}, Signals>()

// ============================================================================
// Signals - Client-side form state
// ============================================================================

const { newTitle, newContent, editingId, editTitle, editContent } = app.signals

// ============================================================================
// Actions
// ============================================================================

const addNote = app.action(
  "addNote",
  { newTitle: Schema.String, newContent: Schema.String },
  (ctx, { newTitle: t, newContent: c }) => {
    if (!t.trim()) return
    insertNote(t.trim(), c.trim())
    ctx.update((s) => ({ ...s, refreshCounter: s.refreshCounter + 1 }))
    ctx.patchSignals({ newTitle: "", newContent: "" })
  },
)

const removeNote = app.action("removeNote", { id: Schema.String }, (ctx, { id }) => {
  deleteNoteFromDb(id)
  ctx.update((s) => ({ ...s, refreshCounter: s.refreshCounter + 1 }))
})

const saveNote = app.action(
  "saveNote",
  { editingId: Schema.String, editTitle: Schema.String, editContent: Schema.String },
  (ctx, { editingId: id, editTitle: t, editContent: c }) => {
    updateNote(id, t.trim(), c.trim())
    ctx.update((s) => ({ ...s, refreshCounter: s.refreshCounter + 1 }))
    ctx.patchSignals({ editingId: null })
  },
)

// ============================================================================
// Components
// ============================================================================

function NoteCard({ note }: { note: Note }) {
  return (
    <div id={`note-${note.id}`} class="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
      {/* View Mode */}
      <div hs-show={editingId.isNot(note.id)}>
        <div class="flex justify-between items-start mb-2">
          <h3 class="font-semibold text-gray-800">{note.title}</h3>
          <div class="flex gap-2">
            <button
              hs-on:click={`$editingId.value = '${note.id}'; $editTitle.value = '${note.title.replace(/'/g, "\\'")}'; $editContent.value = '${note.content.replace(/'/g, "\\'").replace(/\n/g, "\\n")}'`}
              class="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded transition-colors"
            >
              Edit
            </button>
            <button
              $={hs.action(removeNote, { id: note.id })}
              class="px-2 py-1 bg-red-500 hover:bg-red-600 text-white text-sm rounded transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
        {note.content && <p class="text-gray-600 whitespace-pre-wrap mb-2">{note.content}</p>}
        <small class="text-gray-400">Created: {note.created_at}</small>
      </div>

      {/* Edit Mode */}
      <form
        hs-show={editingId.is(note.id)}
        $={hs.form(saveNote, {
          editingId: note.id,
          editTitle,
          editContent,
        })}
        class="bg-amber-50 -m-4 p-4 rounded-lg"
      >
        <input
          type="text"
          $={hs.bind(editTitle)}
          class="w-full px-3 py-2 mb-2 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
        <textarea
          rows="2"
          $={hs.bind(editContent)}
          class="w-full px-3 py-2 mb-2 border border-amber-300 rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
        <div class="flex gap-2">
          <button
            type="submit"
            class="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors"
          >
            Save
          </button>
          <button
            type="button"
            hs-on:click="$editingId.value = null"
            class="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

// ============================================================================
// App Config
// ============================================================================

const server = app.app({
  store: { refreshCounter: 0 },
  signals: { newTitle: "", newContent: "", editingId: null, editTitle: "", editContent: "" },

  view: (ctx) => {
    // Load notes from database on each render
    const notes = getAllNotes()

    return (
      <div id="app" class="max-w-xl mx-auto p-8">
        {/* Header */}
        <h1 class="text-3xl font-bold text-gray-900 mb-2">SQLite Notes</h1>
        <p class="text-gray-500 mb-6">
          {notes.length} note{notes.length !== 1 ? "s" : ""} stored in SQLite
        </p>

        {/* Add Note Form */}
        <form
          $={hs.form(addNote, { newTitle, newContent })}
          class="bg-emerald-50 border border-emerald-200 p-4 rounded-lg mb-6"
        >
          <h3 class="font-semibold text-emerald-800 mb-3">New Note</h3>
          <input
            type="text"
            placeholder="Title"
            $={hs.bind(newTitle)}
            class="w-full px-3 py-2 mb-2 border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <textarea
            placeholder="Content (optional)"
            rows="2"
            $={hs.bind(newContent)}
            class="w-full px-3 py-2 mb-2 border border-emerald-300 rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            type="submit"
            class="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors"
          >
            Add Note
          </button>
        </form>

        {/* Notes List */}
        {notes.length === 0 ? (
          <p class="text-center text-gray-400 py-8">No notes yet. Add one above!</p>
        ) : (
          <div class="flex flex-col gap-4">
            {notes.map((note) => (
              <NoteCard note={note} />
            ))}
          </div>
        )}

        {/* Footer */}
        <footer class="mt-8 pt-4 border-t border-gray-200 text-gray-500 text-sm">
          <p>
            Using Bun's built-in <code class="bg-gray-100 px-1 rounded">bun:sqlite</code> for persistence
          </p>
          <p>Database file: ./examples/data/notes.db</p>
        </footer>
      </div>
    )
  },
}).serve({ port: 3015 })

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                    SQLite Notes (JSX)                         ║
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
