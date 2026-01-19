/**
 * Notes App with JSON Persistence
 *
 * Data is automatically saved to ./data/notes.json and survives server restarts.
 */
import { createHyperstar, UI, on, $, Schema } from "hyperstar"

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

const hs = createHyperstar<Store, {}, Signals>()
const { title, content } = hs.signals

// ============================================================================
// Actions
// ============================================================================

const addNote = hs.action(
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

const deleteNote = hs.action("deleteNote", { id: Schema.String }, (ctx, { id }) => {
  ctx.update((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== id) }))
})

// ============================================================================
// App
// ============================================================================

const server = hs.app({
  store: { notes: [] },
  signals: { title: "", content: "" },

  // Automatic JSON file persistence!
  persist: "./data/notes.json",

  view: (ctx) =>
    UI.div(
      { attrs: { id: "app", class: "max-w-xl mx-auto p-8" } },

      UI.h1({ attrs: { class: "text-3xl font-bold text-gray-900 mb-2" } }, "Notes"),
      UI.p(
        { attrs: { class: "text-gray-500 mb-6" } },
        "Notes are saved automatically and persist across server restarts."
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
              class: "px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors",
              "hs-show": title.isNotEmpty().toString(),
            },
          },
          "Add Note"
        )
      ),

      // Notes List
      ctx.store.notes.length === 0
        ? UI.p({ attrs: { class: "text-center text-gray-400 py-8" } }, "No notes yet. Add one above!")
        : UI.div(
            { attrs: { class: "flex flex-col gap-4" } },
            ...ctx.store.notes.map((note) =>
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
                UI.el("small", { attrs: { class: "text-gray-400" } }, new Date(note.createdAt).toLocaleString())
              )
            )
          ),

      // Footer
      UI.footer(
        { attrs: { class: "mt-8 pt-4 border-t border-gray-200 text-gray-500 text-sm" } },
        UI.p(
          {},
          "Using ",
          UI.code({ attrs: { class: "bg-gray-100 px-1 py-0.5 rounded text-gray-700" } }, 'persist: "./data/notes.json"')
        ),
        UI.p({ attrs: { class: "mt-1" } }, "Restart the server and your notes will still be here!")
      )
    ),
}).serve({ port: Number(process.env.PORT) || 3000 })

console.log(`
🌟 Hyperstar running at http://localhost:${server.port}

Notes persist to ./data/notes.json
Restart the server and your data will still be there!
`)
