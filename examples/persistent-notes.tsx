/**
 * Hyperstar v3 - Persistent Notes Example (JSX Version)
 *
 * Demonstrates the built-in persist option for automatic JSON file persistence.
 * Notes survive server restarts with zero extra code!
 *
 * Features demonstrated:
 * - persist option for automatic store persistence
 * - Signals for client-side form state
 * - hs.action() with Schema validation
 * - hs-show for conditional rendering (view/edit modes)
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

const { title, content, editingId, editTitle, editContent } = app.signals

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

    ctx.update((s) => ({
      ...s,
      notes: [newNote, ...s.notes],
    }))
    ctx.patchSignals({ title: "", content: "" })
  },
)

const deleteNote = app.action("deleteNote", { id: Schema.String }, (ctx, { id }) => {
  ctx.update((s) => ({
    ...s,
    notes: s.notes.filter((n) => n.id !== id),
  }))
})

const saveEdit = app.action(
  "saveEdit",
  { editingId: Schema.String, editTitle: Schema.String, editContent: Schema.String },
  (ctx, { editingId: id, editTitle: t, editContent: c }) => {
    ctx.update((s) => ({
      ...s,
      notes: s.notes.map((n) => (n.id === id ? { ...n, title: t.trim(), content: c.trim() } : n)),
    }))
    ctx.patchSignals({ editingId: null })
  },
)

// ============================================================================
// Components
// ============================================================================

function NoteCard({ note }: { note: Note }) {
  return (
    <div id={`note-${note.id}`} class="relative">
      {/* View Mode */}
      <div
        hs-show={editingId.isNot(note.id)}
        class="bg-white p-4 rounded-lg border border-gray-200 shadow-sm"
      >
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
              $={hs.action(deleteNote, { id: note.id })}
              class="px-2 py-1 bg-red-500 hover:bg-red-600 text-white text-sm rounded transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
        {note.content && <p class="my-2 text-gray-600 whitespace-pre-wrap">{note.content}</p>}
        <small class="text-gray-400">Created: {new Date(note.createdAt).toLocaleString()}</small>
      </div>

      {/* Edit Mode */}
      <form
        hs-show={editingId.is(note.id)}
        $={hs.form(saveEdit, {
          editingId: note.id,
          editTitle,
          editContent,
        })}
        class="bg-amber-50 p-4 rounded-lg border-2 border-amber-400"
      >
        <input
          type="text"
          placeholder="Title..."
          $={hs.bind(editTitle)}
          class="w-full px-3 py-2 mb-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
        />
        <textarea
          placeholder="Content..."
          rows="3"
          $={hs.bind(editContent)}
          class="w-full px-3 py-2 mb-2 border border-gray-300 rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
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
  store: { notes: [] } as Store,
  signals: { title: "", content: "", editingId: null, editTitle: "", editContent: "" },

  // Persist to JSON file - notes survive server restarts!
  persist: "./examples/data/notes.json",

  title: ({ store }) => `Persistent Notes (${store.notes.length})`,

  view: (ctx) => (
    <div id="app" class="max-w-xl mx-auto p-8">
      {/* Header */}
      <h1 class="text-3xl font-bold text-gray-900 mb-2">Persistent Notes</h1>
      <p class="text-gray-500 mb-6">
        Notes are saved automatically and persist across server restarts.
      </p>

      {/* Add Note Form */}
      <form
        $={hs.form(addNote, { title, content })}
        class="bg-gray-100 p-4 rounded-lg mb-6"
      >
        <input
          type="text"
          placeholder="Note title..."
          $={hs.bind(title)}
          class="w-full px-3 py-2 mb-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
        <textarea
          placeholder="Note content (optional)..."
          rows="3"
          $={hs.bind(content)}
          class="w-full px-3 py-2 mb-2 border border-gray-300 rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
        <button
          type="submit"
          class="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors"
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
            <NoteCard note={note} />
          ))}
        </div>
      )}

      {/* Footer */}
      <footer class="mt-8 pt-4 border-t border-gray-200 text-gray-500 text-sm">
        <p>
          Using <code class="bg-gray-100 px-1 py-0.5 rounded text-gray-700">persist: "./examples/data/notes.json"</code>
        </p>
        <p>Restart the server and your notes will still be here!</p>
      </footer>
    </div>
  ),
}).serve({ port: 3005 })

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                  Persistent Notes (JSX)                       ║
╠═══════════════════════════════════════════════════════════════╣
║  http://localhost:${server.port}                                    ║
║                                                               ║
║  Using persist option:                                        ║
║  • persist: "./examples/data/notes.json"                      ║
║  • Notes survive server restarts automatically!               ║
╚═══════════════════════════════════════════════════════════════╝
`)

process.on("SIGINT", async () => {
  console.log("\nShutting down...")
  await server.stop()
  process.exit(0)
})
