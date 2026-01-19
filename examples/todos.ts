/**
 * Hyperstar v3 - Todos Example
 *
 * A simple todo app demonstrating:
 * - CRUD operations with actions
 * - Signals for form state
 * - Conditional rendering
 * - List mapping
 */
import { createHyperstar, UI, on, $, Schema } from "hyperstar"

// ============================================================================
// Types
// ============================================================================

interface Todo {
  id: string
  text: string
  completed: boolean
}

interface Store {
  todos: Todo[]
}

interface Signals {
  newTodo: string
  editingId: string | null
  editText: string
  filter: "all" | "active" | "completed"  // Client-side filter (per-user)
}

// ============================================================================
// Create Factory
// ============================================================================

const hs = createHyperstar<Store, {}, Signals>()

// ============================================================================
// Signals - Client-side form state
// ============================================================================

const { newTodo, editingId, editText, filter } = hs.signals

// ============================================================================
// Actions
// ============================================================================

const addTodo = hs.action("addTodo", { text: Schema.String }, (ctx, { text }) => {
  const trimmed = text.trim()
  if (!trimmed) return

  const todo: Todo = {
    id: crypto.randomUUID(),
    text: trimmed,
    completed: false,
  }

  ctx.update((s) => ({ ...s, todos: [todo, ...s.todos] }))
  ctx.patchSignals({ newTodo: "" }) // Clear the input after adding
})

const toggleTodo = hs.action("toggleTodo", { id: Schema.String }, (ctx, { id }) => {
  ctx.update((s) => ({
    ...s,
    todos: s.todos.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)),
  }))
})

const deleteTodo = hs.action("deleteTodo", { id: Schema.String }, (ctx, { id }) => {
  ctx.update((s) => ({
    ...s,
    todos: s.todos.filter((t) => t.id !== id),
  }))
})

const updateTodo = hs.action(
  "updateTodo",
  { id: Schema.String, text: Schema.String },
  (ctx, { id, text }) => {
    const trimmed = text.trim()
    if (!trimmed) return

    ctx.update((s) => ({
      ...s,
      todos: s.todos.map((t) => (t.id === id ? { ...t, text: trimmed } : t)),
    }))
    ctx.patchSignals({ editingId: null }) // Clear edit mode after update
  },
)

const clearCompleted = hs.action("clearCompleted", (ctx) => {
  ctx.update((s) => ({
    ...s,
    todos: s.todos.filter((t) => !t.completed),
  }))
})

const toggleAll = hs.action("toggleAll", (ctx) => {
  const { todos } = ctx.getStore()
  const allCompleted = todos.length > 0 && todos.every((t) => t.completed)

  ctx.update((s) => ({
    ...s,
    todos: s.todos.map((t) => ({ ...t, completed: !allCompleted })),
  }))
})

// ============================================================================
// View Components
// ============================================================================

const FilterButton = (f: "all" | "active" | "completed") => {
  const labels = { all: "All", active: "Active", completed: "Completed" }

  return UI.button(
    {
      attrs: {
        class: "px-3 py-1 rounded bg-gray-100 text-gray-700",
        // Active state styling via hs-class (client-side)
        "hs-class": `${filter.is(f).toString()} ? 'bg-blue-500 text-white' : 'hover:bg-gray-200'`,
      },
      events: { click: on.signal("filter", $.str(f)) },
    },
    labels[f],
  )
}

const TodoItem = (todo: Todo) =>
  UI.li(
    {
      attrs: {
        id: `todo-${todo.id}`,
        class: `flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg ${
          todo.completed ? "opacity-60" : ""
        }`,
        // Client-side filtering: show based on filter signal
        "hs-show": filter
          .is("all")
          .or(filter.is("active").and(!todo.completed))
          .or(filter.is("completed").and(todo.completed))
          .toString(),
      },
    },

    // View mode
    UI.div(
      {
        attrs: {
          class: "flex items-center gap-3 flex-1",
          "hs-show": editingId.isNot(todo.id).toString(),
        },
      },

      // Checkbox - prevent default to let server state control it
      UI.input({
        attrs: {
          type: "checkbox",
          class: "w-5 h-5 rounded border-gray-300 text-blue-500 cursor-pointer",
          ...(todo.completed ? { checked: "checked" } : {}),
        },
        events: { click: on.prevent(on.action(toggleTodo, { id: todo.id })) },
      }),

      // Text
      UI.span(
        {
          attrs: {
            class: `flex-1 ${todo.completed ? "line-through text-gray-400" : "text-gray-800"}`,
          },
        },
        todo.text,
      ),

      // Edit button
      UI.button(
        {
          attrs: {
            class: "px-2 py-1 text-sm text-blue-500 hover:text-blue-700",
          },
          events: {
            click: on.seq(
              on.signal("editingId", $.str(todo.id)),
              on.signal("editText", $.str(todo.text)),
            ),
          },
        },
        "Edit",
      ),

      // Delete button
      UI.button(
        {
          attrs: {
            class: "px-2 py-1 text-sm text-red-500 hover:text-red-700",
          },
          events: { click: on.action(deleteTodo, { id: todo.id }) },
        },
        "Delete",
      ),
    ),

    // Edit mode
    UI.form(
      {
        attrs: {
          class: "flex items-center gap-2 flex-1",
          "hs-show": editingId.is(todo.id).toString(),
        },
        events: {
          submit: on.seq(
            on.script("event.preventDefault()"),
            on.action(updateTodo, { id: todo.id, text: $.signal("editText") }),
          ),
        },
      },
      UI.input({
        attrs: {
          type: "text",
          class:
            "flex-1 px-3 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500",
          "hs-bind": "editText",
        },
      }),
      UI.button(
        {
          attrs: {
            type: "submit",
            class: "px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600",
          },
        },
        "Save",
      ),
      UI.button(
        {
          attrs: {
            type: "button",
            class: "px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600",
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
  store: { todos: [] },
  signals: { newTodo: "", editingId: null, editText: "", filter: "all" },

  title: ({ store }) => `Todos (${store.todos.filter(t => !t.completed).length} active)`,

  view: (ctx) => {
    const activeCount = ctx.store.todos.filter((t) => !t.completed).length
    const completedCount = ctx.store.todos.filter((t) => t.completed).length

    return UI.div(
      { attrs: { id: "app", class: "max-w-lg mx-auto p-8" } },

      // Header
      UI.h1({ attrs: { class: "text-3xl font-bold text-gray-900 mb-6 text-center" } }, "Todos"),

      // Add Todo Form
      UI.form(
        {
          attrs: { class: "flex gap-2 mb-6" },
          events: {
            submit: on.seq(
              on.script("event.preventDefault()"),
              on.action(addTodo, { text: $.signal("newTodo") }),
            ),
          },
        },
        UI.input({
          attrs: {
            type: "text",
            placeholder: "What needs to be done?",
            class:
              "flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg",
            "hs-bind": "newTodo",
          },
        }),
        UI.button(
          {
            attrs: {
              type: "submit",
              class:
                "px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors",
            },
          },
          "Add",
        ),
      ),

      // Controls (show only if there are todos)
      ctx.store.todos.length > 0
        ? UI.div(
            { attrs: { class: "flex items-center justify-between mb-4" } },

            // Toggle all
            UI.button(
              {
                attrs: {
                  class: "text-sm text-gray-500 hover:text-gray-700",
                },
                events: { click: on.action(toggleAll) },
              },
              ctx.store.todos.every((t) => t.completed) ? "Uncheck all" : "Check all",
            ),

            // Filter buttons (client-side, per-user)
            UI.div(
              { attrs: { class: "flex gap-2" } },
              FilterButton("all"),
              FilterButton("active"),
              FilterButton("completed"),
            ),

            // Clear completed
            completedCount > 0
              ? UI.button(
                  {
                    attrs: {
                      class: "text-sm text-red-500 hover:text-red-700",
                    },
                    events: { click: on.action(clearCompleted) },
                  },
                  `Clear completed (${completedCount})`,
                )
              : UI.span({ attrs: { class: "text-sm text-transparent" } }, "placeholder"),
          )
        : UI.empty(),

      // Todo List - render all, filter client-side via hs-show on each item
      ctx.store.todos.length > 0
        ? UI.ul(
            { attrs: { class: "flex flex-col gap-2" } },
            ...ctx.store.todos.map((todo) => TodoItem(todo)),
          )
        : UI.p(
            { attrs: { class: "text-center text-gray-400 py-8" } },
            "No todos yet. Add one above!",
          ),

      // Footer stats
      ctx.store.todos.length > 0
        ? UI.footer(
            { attrs: { class: "mt-6 pt-4 border-t border-gray-200 text-center text-gray-500 text-sm" } },
            `${activeCount} item${activeCount !== 1 ? "s" : ""} left`,
          )
        : UI.empty(),
    )
  },
}).serve({ port: 3017 })

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                         Todos                                 ║
╠═══════════════════════════════════════════════════════════════╣
║  http://localhost:${server.port}                                    ║
║                                                               ║
║  Features:                                                    ║
║  • Add, edit, delete todos                                    ║
║  • Toggle completion                                          ║
║  • Filter by status                                           ║
║  • Clear completed                                            ║
╚═══════════════════════════════════════════════════════════════╝
`)

process.on("SIGINT", async () => {
  console.log("\nShutting down...")
  await server.stop()
  process.exit(0)
})
