/**
 * Hyperstar v3 - Head Demo Example (JSX Version)
 *
 * Demonstrates updating the document <head> from action handlers:
 * - ctx.head.setTitle() - Update the page title
 * - ctx.head.setFavicon() - Update the favicon
 *
 * Features:
 * - Dynamic page title based on state
 * - Favicon changes based on status
 * - Title notifications (like unread count)
 */
import { createHyperstar, hs, Schema } from "hyperstar"

// ============================================================================
// Store Type
// ============================================================================

interface Store {
  count: number
  status: "idle" | "active" | "complete"
  notifications: number
}

interface Signals {
  title: string
}

// ============================================================================
// Create Factory
// ============================================================================

const app = createHyperstar<Store, {}, Signals>()

// ============================================================================
// Signals - Client-side form state
// ============================================================================

const { title } = app.signals

// ============================================================================
// Actions
// ============================================================================

const increment = app.action("increment", (ctx) => {
  ctx.update((s) => ({ ...s, count: s.count + 1 }))
  const count = ctx.getStore().count
  ctx.head.setTitle(`Count: ${count} | Head Demo`)
})

const decrement = app.action("decrement", (ctx) => {
  ctx.update((s) => ({ ...s, count: Math.max(0, s.count - 1) }))
  const count = ctx.getStore().count
  ctx.head.setTitle(`Count: ${count} | Head Demo`)
})

const setStatus = app.action(
  "setStatus",
  { status: Schema.Union(Schema.Literal("idle"), Schema.Literal("active"), Schema.Literal("complete")) },
  (ctx, { status }) => {
    ctx.update((s) => ({ ...s, status }))

    // Update favicon based on status
    const faviconMap = {
      idle: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⏸️</text></svg>",
      active: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>▶️</text></svg>",
      complete: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>✅</text></svg>",
    }

    ctx.head.setFavicon(faviconMap[status], "image/svg+xml")
  },
)

const addNotification = app.action("addNotification", (ctx) => {
  ctx.update((s) => ({ ...s, notifications: s.notifications + 1 }))
  const { notifications, count } = ctx.getStore()
  if (notifications > 0) {
    ctx.head.setTitle(`(${notifications}) Count: ${count} | Head Demo`)
  }
})

const clearNotifications = app.action("clearNotifications", (ctx) => {
  ctx.update((s) => ({ ...s, notifications: 0 }))
  const count = ctx.getStore().count
  ctx.head.setTitle(`Count: ${count} | Head Demo`)
})

const setCustomTitle = app.action("setCustomTitle", { title: Schema.String }, (ctx, { title: newTitle }) => {
  if (newTitle.trim()) {
    ctx.head.setTitle(newTitle.trim())
    ctx.patchSignals({ title: "" })
  }
})

// ============================================================================
// Status Button Component
// ============================================================================

function StatusButton({ status, currentStatus }: { status: "idle" | "active" | "complete"; currentStatus: string }) {
  const labels = { idle: "⏸️ Idle", active: "▶️ Active", complete: "✅ Complete" }
  const isActive = status === currentStatus

  return (
    <button
      $={hs.action(setStatus, { status })}
      class={`px-4 py-2 rounded-lg font-medium transition-all ${
        isActive
          ? "bg-blue-600 text-white ring-2 ring-blue-400"
          : "bg-gray-100 hover:bg-gray-200 text-gray-700"
      }`}
    >
      {labels[status]}
    </button>
  )
}

// ============================================================================
// App Config
// ============================================================================

const server = app.app({
  store: { count: 0, status: "idle" as const, notifications: 0 },
  signals: { title: "" },

  view: (ctx) => (
    <div id="app" class="max-w-xl mx-auto p-8">
      {/* Header */}
      <h1 class="text-3xl font-bold text-gray-900 mb-2">Head Demo</h1>
      <p class="text-gray-500 mb-6">
        Demonstrates ctx.head.setTitle() and ctx.head.setFavicon()
      </p>

      {/* Counter Section */}
      <section class="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h2 class="font-semibold text-gray-800 mb-4">Dynamic Title</h2>
        <p class="text-gray-600 mb-4">Counter changes update the page title:</p>
        <div class="flex items-center gap-4">
          <button
            $={hs.action(decrement)}
            class="w-12 h-12 bg-red-500 hover:bg-red-600 text-white text-2xl font-bold rounded-lg transition-colors"
          >
            -
          </button>
          <span class="text-4xl font-bold text-gray-900 w-20 text-center">
            {ctx.store.count}
          </span>
          <button
            $={hs.action(increment)}
            class="w-12 h-12 bg-green-500 hover:bg-green-600 text-white text-2xl font-bold rounded-lg transition-colors"
          >
            +
          </button>
        </div>
      </section>

      {/* Status Section (Favicon) */}
      <section class="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h2 class="font-semibold text-gray-800 mb-4">Dynamic Favicon</h2>
        <p class="text-gray-600 mb-4">Status changes update the favicon:</p>
        <div class="flex gap-3">
          {StatusButton({ status: "idle", currentStatus: ctx.store.status })}
          {StatusButton({ status: "active", currentStatus: ctx.store.status })}
          {StatusButton({ status: "complete", currentStatus: ctx.store.status })}
        </div>
        <p class="text-sm text-gray-500 mt-3">
          Current status: {ctx.store.status}
        </p>
      </section>

      {/* Notifications Section */}
      <section class="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h2 class="font-semibold text-gray-800 mb-4">Title Notifications</h2>
        <p class="text-gray-600 mb-4">
          Notification count shown in title (like unread messages):
        </p>
        <div class="flex items-center gap-4">
          <button
            $={hs.action(addNotification)}
            class="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white font-medium rounded-lg transition-colors"
          >
            Add Notification
          </button>
          {ctx.store.notifications > 0 && (
            <button
              $={hs.action(clearNotifications)}
              class="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
            >
              Clear ({ctx.store.notifications})
            </button>
          )}
        </div>
      </section>

      {/* Custom Title Section */}
      <section class="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h2 class="font-semibold text-gray-800 mb-4">Custom Title</h2>
        <p class="text-gray-600 mb-4">Set any title you want:</p>
        <form $={hs.form(setCustomTitle)} class="flex gap-2">
          <input
            type="text"
            name="title"
            placeholder="Enter custom title..."
            $={hs.bind(title)}
            class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
          >
            Set Title
          </button>
        </form>
      </section>

      {/* Code Examples */}
      <section class="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h2 class="font-semibold text-gray-800 mb-4">How It Works</h2>
        <pre class="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
          <code>{`// In action handlers:
const increment = app.action("increment", (ctx) => {
  ctx.update(s => ({ ...s, count: s.count + 1 }))

  // Update page title
  ctx.head.setTitle(\`Count: \${ctx.getStore().count}\`)
})

const setStatus = app.action("setStatus", { status }, (ctx, { status }) => {
  ctx.update(s => ({ ...s, status }))

  // Update favicon (supports data URIs and paths)
  ctx.head.setFavicon(
    "data:image/svg+xml,...",
    "image/svg+xml"
  )
})`}</code>
        </pre>
      </section>

      {/* Footer */}
      <footer class="mt-8 pt-4 border-t border-gray-200 text-gray-500 text-sm">
        <p>Watch the browser tab as you interact!</p>
      </footer>
    </div>
  ),
}).serve({ port: 3016 })

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                   Head Demo (JSX Version)                     ║
╠═══════════════════════════════════════════════════════════════╣
║  http://localhost:${server.port}                                    ║
║                                                               ║
║  Features:                                                    ║
║  • ctx.head.setTitle() - Dynamic page titles                  ║
║  • ctx.head.setFavicon() - Dynamic favicon                    ║
║  • Notification badges in title                               ║
╚═══════════════════════════════════════════════════════════════╝
`)

process.on("SIGINT", async () => {
  console.log("\nShutting down...")
  await server.stop()
  process.exit(0)
})
