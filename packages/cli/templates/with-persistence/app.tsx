/**
 * Notes App with JSON Persistence
 *
 * Data is automatically saved to ./data/notes.json and survives server restarts.
 */
import { createHyperstar, hs, Schema } from "hyperstar"

// ============================================================================
// Types
// ============================================================================

interface Note {
  id: string
  title: string
  content: string
  createdAt: string
}

interface Store {
  notes: Note[]
}

interface Signals {
  title: string
  content: string
}

// ============================================================================
// Create App Factory
// ============================================================================

const app = createHyperstar<Store, {}, Signals>()
const { title, content } = app.signals

// ============================================================================
// Actions
// ============================================================================

const addNote = app.action(
  "addNote",
  { title: Schema.String, content: Schema.String },
  (ctx, { title: t, content: c }) => {
    if (!t.trim()) return

    const newNote: Note = {
      id: crypto.randomUUID(),
      title: t.trim(),
      content: c.trim(),
      createdAt: new Date().toISOString(),
    }

    ctx.update((s) => ({ ...s, notes: [newNote, ...s.notes] }))
    ctx.patchSignals({ title: "", content: "" })
  }
)

const deleteNote = app.action("deleteNote", { id: Schema.String }, (ctx, { id }) => {
  ctx.update((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== id) }))
})

// ============================================================================
// App
// ============================================================================

const server = app.app({
  store: { notes: [] },
  signals: { title: "", content: "" },

  // Automatic JSON file persistence!
  persist: "./data/notes.json",

  view: (ctx) => (
    <div id="app" class="max-w-xl mx-auto p-8">
      <h1 class="text-3xl font-bold text-gray-900 mb-2">Notes</h1>
      <p class="text-gray-500 mb-6">
        Notes are saved automatically and persist across server restarts.
      </p>

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
          class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
        >
          Add Note
        </button>
      </form>

      {/* Notes List */}
      {ctx.store.notes.length === 0 ? (
        <p class="text-center text-gray-400 py-8">No notes yet. Add one above!</p>
      ) : (
        <div class="flex flex-col gap-4">
          {ctx.store.notes.map((note) => (
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
              <small class="text-gray-400">{new Date(note.createdAt).toLocaleString()}</small>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <footer class="mt-8 pt-4 border-t border-gray-200 text-gray-500 text-sm">
        <p>
          Using <code class="bg-gray-100 px-1 py-0.5 rounded text-gray-700">persist: "./data/notes.json"</code>
        </p>
        <p class="mt-1">Restart the server and your notes will still be here!</p>
      </footer>
    </div>
  ),
}).serve({ port: Number(process.env.PORT) || 8080 })

console.log(`
Hyperstar running at http://localhost:${server.port}

Notes persist to ./data/notes.json
Restart the server and your data will still be there!
`)
