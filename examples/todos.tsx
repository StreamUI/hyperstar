/**
 * Hyperstar v3 - Todos Example (JSX Version)
 *
 * A simple todo app demonstrating:
 * - CRUD operations with actions
 * - Signals for form state
 * - Client-side filtering
 * - Inline editing
 */
import { createHyperstar, hs, Schema } from "hyperstar"

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
  text: string
  editingId: string | null
  editText: string
  filter: "all" | "active" | "completed"
}

// ============================================================================
// Create Factory
// ============================================================================

const app = createHyperstar<Store, {}, Signals>()

// ============================================================================
// Signals - Client-side form state
// ============================================================================

const { text, editingId, editText, filter } = app.signals

// ============================================================================
// Actions
// ============================================================================

const addTodo = app.action("addTodo", { text: Schema.String }, (ctx, { text }) => {
  const trimmed = text.trim()
  if (!trimmed) return

  const todo: Todo = {
    id: crypto.randomUUID(),
    text: trimmed,
    completed: false,
  }

  ctx.update((s) => ({ ...s, todos: [todo, ...s.todos] }))
  ctx.patchSignals({ text: "" })
})

const toggleTodo = app.action("toggleTodo", { id: Schema.String }, (ctx, { id }) => {
  ctx.update((s) => ({
    ...s,
    todos: s.todos.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)),
  }))
})

const deleteTodo = app.action("deleteTodo", { id: Schema.String }, (ctx, { id }) => {
  ctx.update((s) => ({
    ...s,
    todos: s.todos.filter((t) => t.id !== id),
  }))
})

const updateTodo = app.action(
  "updateTodo",
  { id: Schema.String, editText: Schema.String },
  (ctx, { id, editText }) => {
    const trimmed = editText.trim()
    if (!trimmed) return

    ctx.update((s) => ({
      ...s,
      todos: s.todos.map((t) => (t.id === id ? { ...t, text: trimmed } : t)),
    }))
    ctx.patchSignals({ editingId: null, editText: "" })
  },
)

const clearCompleted = app.action("clearCompleted", (ctx) => {
  ctx.update((s) => ({
    ...s,
    todos: s.todos.filter((t) => !t.completed),
  }))
})

const toggleAll = app.action("toggleAll", (ctx) => {
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

function FilterButton({
  value,
  label,
}: {
  value: "all" | "active" | "completed"
  label: string
}) {
  return (
    <button
      hs-on:click={filter.set(value)}
      hs-class:bg-blue-500={filter.is(value)}
      hs-class:text-white={filter.is(value)}
      hs-class:bg-gray-100={filter.isNot(value)}
      class="px-3 py-1 rounded text-gray-700 transition-colors hover:bg-gray-200"
    >
      {label}
    </button>
  )
}

function TodoItem({ todo }: { todo: Todo }) {
  // Client-side filter visibility - use oneOf for cleaner multi-value checks
  const showExpr = filter
    .is("all")
    .or(filter.is("active").and(!todo.completed))
    .or(filter.is("completed").and(todo.completed))

  return (
    <li
      id={`todo-${todo.id}`}
      hs-show={showExpr}
      class={`flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg ${
        todo.completed ? "opacity-60" : ""
      }`}
    >
      {/* View mode */}
      <div
        hs-show={editingId.isNot(todo.id)}
        class="flex items-center gap-3 flex-1"
      >
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={todo.completed}
          $={hs.action(toggleTodo, { id: todo.id })}
          class="w-5 h-5 rounded border-gray-300 text-blue-500 cursor-pointer"
        />

        {/* Text */}
        <span
          class={`flex-1 ${todo.completed ? "line-through text-gray-400" : "text-gray-800"}`}
        >
          {todo.text}
        </span>

        {/* Edit button - sets editingId and editText signals */}
        <button
          $={hs.on("click", hs.seq(editingId.set(todo.id), editText.set(todo.text)))}
          class="px-2 py-1 text-sm text-blue-500 hover:text-blue-700"
        >
          Edit
        </button>

        {/* Delete button */}
        <button
          $={hs.action(deleteTodo, { id: todo.id })}
          class="px-2 py-1 text-sm text-red-500 hover:text-red-700"
        >
          Delete
        </button>
      </div>

      {/* Edit mode */}
      <form
        hs-show={editingId.is(todo.id)}
        $={hs.form(updateTodo, { id: todo.id, editText })}
        class="flex items-center gap-2 flex-1"
      >
        <input
          type="text"
          name="editText"
          $={hs.bind(editText)}
          class="flex-1 px-3 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          class="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
        >
          Save
        </button>
        <button
          type="button"
          $={hs.on("click", editingId.clear())}
          class="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Cancel
        </button>
      </form>
    </li>
  )
}

// ============================================================================
// App Config
// ============================================================================

const server = app.app({
  store: { todos: [] },
  signals: { text: "", editingId: null, editText: "", filter: "all" },

  title: ({ store }) => `Todos (${store.todos.filter((t) => !t.completed).length} active)`,

  view: (ctx) => {
    const activeCount = ctx.store.todos.filter((t) => !t.completed).length
    const completedCount = ctx.store.todos.filter((t) => t.completed).length
    const allCompleted = ctx.store.todos.length > 0 && ctx.store.todos.every((t) => t.completed)

    return (
      <div id="app" class="max-w-lg mx-auto p-8">
        {/* Header */}
        <h1 class="text-3xl font-bold text-gray-900 mb-6 text-center">Todos</h1>

        {/* Add Todo Form */}
        <form $={hs.form(addTodo)} class="flex gap-2 mb-6">
          <input
            type="text"
            name="text"
            placeholder="What needs to be done?"
            $={hs.bind(text)}
            class="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
          />
          <button
            type="submit"
            class="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
          >
            Add
          </button>
        </form>

        {/* Controls */}
        {ctx.store.todos.length > 0 && (
          <div class="flex items-center justify-between mb-4">
            {/* Toggle all */}
            <button
              $={hs.action(toggleAll)}
              class="text-sm text-gray-500 hover:text-gray-700"
            >
              {allCompleted ? "Uncheck all" : "Check all"}
            </button>

            {/* Filter buttons */}
            <div class="flex gap-2">
              <FilterButton value="all" label="All" />
              <FilterButton value="active" label="Active" />
              <FilterButton value="completed" label="Completed" />
            </div>

            {/* Clear completed */}
            {completedCount > 0 ? (
              <button
                $={hs.action(clearCompleted)}
                class="text-sm text-red-500 hover:text-red-700"
              >
                Clear completed ({completedCount})
              </button>
            ) : (
              <span class="text-sm text-transparent">placeholder</span>
            )}
          </div>
        )}

        {/* Todo List */}
        {ctx.store.todos.length > 0 ? (
          <ul class="flex flex-col gap-2">
            {ctx.store.todos.map((todo) => (
              <TodoItem todo={todo} />
            ))}
          </ul>
        ) : (
          <p class="text-center text-gray-400 py-8">No todos yet. Add one above!</p>
        )}

        {/* Footer stats */}
        {ctx.store.todos.length > 0 && (
          <footer class="mt-6 pt-4 border-t border-gray-200 text-center text-gray-500 text-sm">
            {activeCount} item{activeCount !== 1 ? "s" : ""} left
          </footer>
        )}
      </div>
    )
  },
}).serve({ port: 3018 })

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                   Todos (JSX Version)                         ║
╠═══════════════════════════════════════════════════════════════╣
║  http://localhost:${server.port}                                    ║
║                                                               ║
║  Features:                                                    ║
║  • Add, edit, delete todos                                    ║
║  • Toggle completion                                          ║
║  • Client-side filtering (signals)                            ║
║  • Clear completed                                            ║
╚═══════════════════════════════════════════════════════════════╝
`)

process.on("SIGINT", async () => {
  console.log("\nShutting down...")
  await server.stop()
  process.exit(0)
})
