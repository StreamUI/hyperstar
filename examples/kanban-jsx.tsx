/**
 * Hyperstar v3 - Kanban Board Example (JSX Version)
 *
 * A task management board with multiple columns.
 * Click cards to move them between columns, add new tasks, and manage workflow.
 *
 * Features demonstrated:
 * - Complex nested state (columns with cards)
 * - Click-to-move UX pattern
 * - Signals for selected card state
 * - Dynamic filtering
 * - Real-time sync across tabs
 */
import { createHyperstar, hs, Schema } from "hyperstar"

// ============================================================================
// Types
// ============================================================================

interface Card {
  id: string
  title: string
  description: string
  priority: "low" | "medium" | "high"
  assignee: string | null
  createdAt: string
}

interface Column {
  id: string
  title: string
  color: string
  cards: Card[]
}

interface Store {
  columns: Column[]
  labels: string[]
}

interface Signals {
  selectedCardId: string | null
  newTaskTitle: string
  newTaskDescription: string
  newTaskPriority: "low" | "medium" | "high"
  filterPriority: "all" | "low" | "medium" | "high"
}

// ============================================================================
// Constants
// ============================================================================

const PRIORITY_COLORS = {
  low: { bg: "bg-green-100", text: "text-green-700", dot: "bg-green-500" },
  medium: { bg: "bg-yellow-100", text: "text-yellow-700", dot: "bg-yellow-500" },
  high: { bg: "bg-red-100", text: "text-red-700", dot: "bg-red-500" },
}

const INITIAL_COLUMNS: Column[] = [
  {
    id: "todo",
    title: "To Do",
    color: "#6b7280",
    cards: [
      { id: "1", title: "Research competitors", description: "Analyze top 5 competitors", priority: "high", assignee: "Alice", createdAt: new Date().toISOString() },
      { id: "2", title: "Write documentation", description: "Update README and API docs", priority: "medium", assignee: "Bob", createdAt: new Date().toISOString() },
    ],
  },
  {
    id: "in-progress",
    title: "In Progress",
    color: "#3b82f6",
    cards: [
      { id: "3", title: "Implement auth", description: "Add JWT authentication", priority: "high", assignee: "Alice", createdAt: new Date().toISOString() },
    ],
  },
  {
    id: "review",
    title: "Review",
    color: "#f59e0b",
    cards: [
      { id: "4", title: "Fix navbar bug", description: "Mobile menu not closing", priority: "low", assignee: "Charlie", createdAt: new Date().toISOString() },
    ],
  },
  {
    id: "done",
    title: "Done",
    color: "#10b981",
    cards: [
      { id: "5", title: "Setup project", description: "Initialize repo and deps", priority: "medium", assignee: "Bob", createdAt: new Date().toISOString() },
    ],
  },
]

// ============================================================================
// Create Factory
// ============================================================================

const app = createHyperstar<Store, {}, Signals>()

// ============================================================================
// Signals
// ============================================================================

const { selectedCardId, newTaskTitle, newTaskDescription, newTaskPriority, filterPriority } = app.signals

// ============================================================================
// Actions
// ============================================================================

const selectCard = app.action("selectCard", { cardId: Schema.String }, (ctx, { cardId }) => {
  // Toggle selection
  ctx.patchSignals({ selectedCardId: cardId })
})

const deselectCard = app.action("deselectCard", (ctx) => {
  ctx.patchSignals({ selectedCardId: null })
})

const moveCard = app.action(
  "moveCard",
  { cardId: Schema.String, targetColumnId: Schema.String },
  (ctx, { cardId, targetColumnId }) => {
    ctx.update((s) => {
      // Find the card and its current column
      let card: Card | null = null
      let sourceColumnId: string | null = null

      for (const col of s.columns) {
        const found = col.cards.find((c) => c.id === cardId)
        if (found) {
          card = found
          sourceColumnId = col.id
          break
        }
      }

      if (!card || !sourceColumnId || sourceColumnId === targetColumnId) return s

      // Move the card
      return {
        ...s,
        columns: s.columns.map((col) => {
          if (col.id === sourceColumnId) {
            return { ...col, cards: col.cards.filter((c) => c.id !== cardId) }
          }
          if (col.id === targetColumnId) {
            return { ...col, cards: [...col.cards, card!] }
          }
          return col
        }),
      }
    })
    ctx.patchSignals({ selectedCardId: null })
  },
)

const addTask = app.action(
  "addTask",
  { title: Schema.String, description: Schema.String, priority: Schema.String },
  (ctx, { title, description, priority }) => {
    if (!title.trim()) return

    const newCard: Card = {
      id: crypto.randomUUID().slice(0, 8),
      title: title.trim(),
      description: description.trim(),
      priority: (priority as Card["priority"]) || "medium",
      assignee: null,
      createdAt: new Date().toISOString(),
    }

    ctx.update((s) => ({
      ...s,
      columns: s.columns.map((col) =>
        col.id === "todo" ? { ...col, cards: [newCard, ...col.cards] } : col,
      ),
    }))
    ctx.patchSignals({ newTaskTitle: "", newTaskDescription: "", newTaskPriority: "medium" })
  },
)

const deleteCard = app.action("deleteCard", { cardId: Schema.String }, (ctx, { cardId }) => {
  ctx.update((s) => ({
    ...s,
    columns: s.columns.map((col) => ({
      ...col,
      cards: col.cards.filter((c) => c.id !== cardId),
    })),
  }))
  ctx.patchSignals({ selectedCardId: null })
})

// ============================================================================
// Components
// ============================================================================

function PriorityBadge({ priority }: { priority: Card["priority"] }) {
  const colors = PRIORITY_COLORS[priority]
  return (
    <span class={`px-2 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text}`}>
      {priority}
    </span>
  )
}

function TaskCard({ card, columnId }: { card: Card; columnId: string }) {
  const colors = PRIORITY_COLORS[card.priority]

  return (
    <div
      id={`card-${card.id}`}
      $={hs.drag("cardId", card.id)}
      hs-show={filterPriority.oneOf(["all", card.priority])}
      hs-class:border-blue-500={selectedCardId.is(card.id)}
      hs-class:ring-2={selectedCardId.is(card.id)}
      hs-class:ring-blue-200={selectedCardId.is(card.id)}
      hs-class:border-transparent={selectedCardId.isNot(card.id)}
      class="bg-white rounded-lg shadow-sm border-2 transition-all cursor-grab hover:border-gray-200 active:cursor-grabbing"
    >
      {/* Card Header - Click to select */}
      <div
        $={hs.action(selectCard, { cardId: card.id })}
        class="p-3"
      >
        <div class="flex items-start gap-2 mb-2">
          <div class={`w-2 h-2 rounded-full mt-1.5 ${colors.dot}`} />
          <h4 class="font-medium text-gray-900 flex-1">{card.title}</h4>
        </div>
        {card.description && (
          <p class="text-sm text-gray-500 mb-2 line-clamp-2">{card.description}</p>
        )}
        <div class="flex items-center justify-between">
          <PriorityBadge priority={card.priority} />
          {card.assignee && (
            <span class="text-xs text-gray-400">{card.assignee}</span>
          )}
        </div>
      </div>

      {/* Move Actions - Show when selected */}
      <div
        hs-show={selectedCardId.is(card.id)}
        class="border-t bg-gray-50 p-2 rounded-b-lg"
      >
        <p class="text-xs text-gray-500 mb-2">Move to:</p>
        <div class="flex flex-wrap gap-1">
          {INITIAL_COLUMNS.filter((col) => col.id !== columnId).map((col) => (
            <button
              $={hs.action(moveCard, { cardId: card.id, targetColumnId: col.id })}
              class="px-2 py-1 text-xs rounded bg-white border hover:bg-gray-100 transition-colors"
            >
              {col.title}
            </button>
          ))}
          <button
            $={hs.action(deleteCard, { cardId: card.id })}
            class="px-2 py-1 text-xs rounded bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

function KanbanColumn({ column }: { column: Column }) {
  return (
    <div
      $={hs.drop(moveCard, "cardId", "cardId", { targetColumnId: column.id })}
      class="flex-1 min-w-64 max-w-80 flex flex-col bg-gray-100 rounded-xl transition-colors"
    >
      {/* Column Header */}
      <div class="p-3 flex items-center gap-2">
        <div class="w-3 h-3 rounded-full" style={`background: ${column.color};`} />
        <h3 class="font-semibold text-gray-700">{column.title}</h3>
        <span class="ml-auto text-sm text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">
          {column.cards.length}
        </span>
      </div>

      {/* Cards */}
      <div class="flex-1 overflow-y-auto p-2 space-y-2">
        {column.cards.map((card) => (
          <TaskCard card={card} columnId={column.id} />
        ))}
        {column.cards.length === 0 && (
          <p class="text-center text-gray-400 text-sm py-4">No tasks</p>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// App Config
// ============================================================================

const server = app.app({
  store: {
    columns: INITIAL_COLUMNS,
    labels: ["bug", "feature", "docs"],
  },
  signals: {
    selectedCardId: null,
    newTaskTitle: "",
    newTaskDescription: "",
    newTaskPriority: "medium",
    filterPriority: "all",
  },

  title: ({ store }) => {
    const totalTasks = store.columns.reduce((sum, col) => sum + col.cards.length, 0)
    return `Kanban Board (${totalTasks} tasks)`
  },

  view: (ctx) => {
    const totalTasks = ctx.store.columns.reduce((sum, col) => sum + col.cards.length, 0)

    return (
      <div id="app" class="h-screen flex flex-col bg-gray-50">
        {/* Header */}
        <header class="bg-white border-b px-6 py-4">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h1 class="text-2xl font-bold text-gray-900">Kanban Board</h1>
              <p class="text-sm text-gray-500">{totalTasks} tasks across {ctx.store.columns.length} columns</p>
            </div>
            <button
              $={hs.action(deselectCard)}
              hs-show={selectedCardId.isNotNull()}
              class="text-sm text-gray-500 hover:text-gray-700"
            >
              Clear Selection
            </button>
          </div>

          {/* Add Task Form - signal handles auto-convert to $signal.value */}
          <form
            $={hs.form(addTask, {
              title: newTaskTitle,
              description: newTaskDescription,
              priority: newTaskPriority,
            })}
            class="flex gap-3 items-end"
          >
            <div class="flex-1">
              <input
                type="text"
                placeholder="New task title..."
                $={hs.bind(newTaskTitle)}
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div class="w-48">
              <input
                type="text"
                placeholder="Description (optional)"
                $={hs.bind(newTaskDescription)}
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              $={hs.bind(newTaskPriority)}
              class="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <button
              type="submit"
              hs-show={newTaskTitle.isNotEmpty()}
              class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
            >
              Add Task
            </button>
          </form>

          {/* Filter - no more .toString() needed */}
          <div class="mt-4 flex items-center gap-2">
            <span class="text-sm text-gray-500">Filter:</span>
            {(["all", "high", "medium", "low"] as const).map((priority) => (
              <button
                hs-on:click={filterPriority.set(priority)}
                hs-class:bg-blue-500={filterPriority.is(priority)}
                hs-class:text-white={filterPriority.is(priority)}
                hs-class:bg-gray-200={filterPriority.isNot(priority)}
                class="px-3 py-1 rounded-full text-sm font-medium transition-colors"
              >
                {priority === "all" ? "All" : priority.charAt(0).toUpperCase() + priority.slice(1)}
              </button>
            ))}
          </div>
        </header>

        {/* Board */}
        <main class="flex-1 overflow-x-auto p-6">
          <div class="flex gap-4 h-full">
            {ctx.store.columns.map((column) => (
              <KanbanColumn column={column} />
            ))}
          </div>
        </main>

        {/* Footer */}
        <footer class="bg-white border-t px-6 py-3 text-center text-sm text-gray-400">
          Drag cards between columns or click to select. Changes sync in real-time!
        </footer>
      </div>
    )
  },
}).serve({ port: 3020 })

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                    Kanban Board (JSX)                         ║
╠═══════════════════════════════════════════════════════════════╣
║  http://localhost:${server.port}                                    ║
║                                                               ║
║  Features:                                                    ║
║  • Drag and drop cards between columns                        ║
║  • Click cards to select, then move between columns           ║
║  • Add new tasks with priority                                ║
║  • Filter by priority level                                   ║
║  • Real-time sync across tabs                                 ║
╚═══════════════════════════════════════════════════════════════╝
`)

process.on("SIGINT", async () => {
  console.log("\nShutting down...")
  await server.stop()
  process.exit(0)
})
