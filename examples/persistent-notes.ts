/**
 * Hyperstar v3 - Persistent Notes Example
 *
 * Demonstrates the built-in persist option for automatic JSON file persistence.
 * Notes survive server restarts with zero extra code!
 *
 * Features demonstrated:
 * - persist option for automatic store persistence
 * - Signal protocol for client-side form state
 * - hs.action() with Schema validation
 * - UI.show() for conditional rendering (view/edit modes)
 * - UI.each() for rendering lists
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

const { title, content, editingId, editTitle, editContent } = hs.signals

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

    ctx.update((s) => ({
      ...s,
      notes: [newNote, ...s.notes],
    }))
    ctx.patchSignals({ title: "", content: "" }) // Clear form after adding
  },
)

const deleteNote = hs.action("deleteNote", { id: Schema.String }, (ctx, { id }) => {
  ctx.update((s) => ({
    ...s,
    notes: s.notes.filter((n) => n.id !== id),
  }))
})

const saveEdit = hs.action(
  "saveEdit",
  { id: Schema.String, title: Schema.String, content: Schema.String },
  (ctx, { id, title: t, content: c }) => {
    ctx.update((s) => ({
      ...s,
      notes: s.notes.map((n) =>
        n.id === id ? { ...n, title: t.trim(), content: c.trim() } : n,
      ),
    }))
    ctx.patchSignals({ editingId: null }) // Clear edit mode after save
  },
)

// ============================================================================
// View Components
// ============================================================================

const AddNoteForm = () =>
  UI.form(
    {
      attrs: { class: "bg-gray-100 p-4 rounded-lg mb-6" },
      events: {
        submit: on.seq(
          on.script("event.preventDefault()"),
          on.action(addNote, {
            title: $.signal("title"),
            content: $.signal("content"),
          }),
        ),
      },
    },
    UI.input({
      attrs: {
        type: "text",
        placeholder: "Note title...",
        class:
          "w-full px-3 py-2 mb-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent",
        "hs-bind": "title",
      },
    }),
    UI.textarea({
      attrs: {
        placeholder: "Note content (optional)...",
        rows: "3",
        class:
          "w-full px-3 py-2 mb-2 border border-gray-300 rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent",
        "hs-bind": "content",
      },
    }),
    UI.button(
      {
        attrs: {
          type: "submit",
          class:
            "px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors",
        },
      },
      "Add Note",
    ),
  )

const NoteView = (note: Note) =>
  UI.div(
    {
      attrs: {
        id: `note-${note.id}`,
        class: "bg-white p-4 rounded-lg border border-gray-200 shadow-sm",
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
            events: { click: on.action(deleteNote, { id: note.id }) },
          },
          "Delete",
        ),
      ),
    ),
    UI.show(
      note.content.length > 0,
      UI.p({ attrs: { class: "my-2 text-gray-600 whitespace-pre-wrap" } }, note.content),
    ),
    UI.small(
      { attrs: { class: "text-gray-400" } },
      `Created: ${new Date(note.createdAt).toLocaleString()}`,
    ),
  )

const NoteEditForm = (note: Note) =>
  UI.form(
    {
      attrs: {
        id: `note-edit-${note.id}`,
        class: "bg-amber-50 p-4 rounded-lg border-2 border-amber-400",
        "hs-show": editingId.is(note.id).toString(),
      },
      events: {
        submit: on.seq(
          on.script("event.preventDefault()"),
          on.action(saveEdit, {
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
        placeholder: "Title...",
        class:
          "w-full px-3 py-2 mb-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent",
        "hs-bind": "editTitle",
      },
    }),
    UI.textarea({
      attrs: {
        placeholder: "Content...",
        rows: "3",
        class:
          "w-full px-3 py-2 mb-2 border border-gray-300 rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent",
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
  )

// ============================================================================
// App Config
// ============================================================================

const server = hs.app({
  store: { notes: [] } as Store,
  signals: { title: "", content: "", editingId: null, editTitle: "", editContent: "" },

  // Persist to JSON file - notes survive server restarts!
  persist: "./examples/data/notes.json",

  title: ({ store }) => `Persistent Notes (${store.notes.length})`,

  view: (ctx) =>
    UI.div(
      { attrs: { id: "app", class: "max-w-xl mx-auto p-8" } },

      // Header
      UI.h1({ attrs: { class: "text-3xl font-bold text-gray-900 mb-2" } }, "Persistent Notes"),
      UI.p(
        { attrs: { class: "text-gray-500 mb-6" } },
        "Notes are saved automatically and persist across server restarts.",
      ),

      // Add Note Form
      AddNoteForm(),

      // Notes List
      UI.show(
        ctx.store.notes.length === 0,
        UI.p({ attrs: { class: "text-center text-gray-400 py-8" } }, "No notes yet. Add one above!"),
      ),
      UI.show(
        ctx.store.notes.length > 0,
        UI.div(
          { attrs: { class: "flex flex-col gap-4" } },
          UI.each(
            ctx.store.notes,
            (note) => note.id,
            (note) => UI.fragment(NoteView(note), NoteEditForm(note)),
          ),
        ),
      ),

      // Footer
      UI.footer(
        { attrs: { class: "mt-8 pt-4 border-t border-gray-200 text-gray-500 text-sm" } },
        UI.p(
          {},
          "Using ",
          UI.code(
            { attrs: { class: "bg-gray-100 px-1 py-0.5 rounded text-gray-700" } },
            'persist: "./examples/data/notes.json"',
          ),
        ),
        UI.p({}, "Restart the server and your notes will still be here!"),
      ),
    ),
}).serve({ port: 3005 })

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                  Persistent Notes                             ║
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
