/**
 * Hyperstar v3 - Head Demo Example
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
import { createHyperstar, UI, on, $, Schema } from "hyperstar"

// ============================================================================
// Store Type
// ============================================================================

interface Store {
  count: number
  status: "idle" | "active" | "complete"
  notifications: number
}

interface Signals {
  customTitle: string
}

// ============================================================================
// Create Factory
// ============================================================================

const hs = createHyperstar<Store, {}, Signals>()

// ============================================================================
// Signals - Client-side form state
// ============================================================================

const { customTitle } = hs.signals

// ============================================================================
// Actions
// ============================================================================

const increment = hs.action("increment", (ctx) => {
  ctx.update((s) => ({ ...s, count: s.count + 1 }))
  const count = ctx.getStore().count
  ctx.head.setTitle(`Count: ${count} | Head Demo`)
})

const decrement = hs.action("decrement", (ctx) => {
  ctx.update((s) => ({ ...s, count: Math.max(0, s.count - 1) }))
  const count = ctx.getStore().count
  ctx.head.setTitle(`Count: ${count} | Head Demo`)
})

const setStatus = hs.action(
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

const addNotification = hs.action("addNotification", (ctx) => {
  ctx.update((s) => ({ ...s, notifications: s.notifications + 1 }))
  const { notifications, count } = ctx.getStore()
  if (notifications > 0) {
    ctx.head.setTitle(`(${notifications}) Count: ${count} | Head Demo`)
  }
})

const clearNotifications = hs.action("clearNotifications", (ctx) => {
  ctx.update((s) => ({ ...s, notifications: 0 }))
  const count = ctx.getStore().count
  ctx.head.setTitle(`Count: ${count} | Head Demo`)
})

const setCustomTitle = hs.action("setCustomTitle", { title: Schema.String }, (ctx, { title }) => {
  if (title.trim()) {
    ctx.head.setTitle(title.trim())
    ctx.patchSignals({ customTitle: "" }) // Clear input after setting
  }
})

// ============================================================================
// View Components
// ============================================================================

const StatusButton = (status: "idle" | "active" | "complete", currentStatus: string) => {
  const labels = { idle: "⏸️ Idle", active: "▶️ Active", complete: "✅ Complete" }
  const isActive = status === currentStatus

  return UI.button(
    {
      attrs: {
        class: `px-4 py-2 rounded-lg font-medium transition-all ${
          isActive
            ? "bg-blue-600 text-white ring-2 ring-blue-400"
            : "bg-gray-100 hover:bg-gray-200 text-gray-700"
        }`,
      },
      events: { click: on.action(setStatus, { status }) },
    },
    labels[status],
  )
}

// ============================================================================
// App Config
// ============================================================================

const server = hs.app({
  store: { count: 0, status: "idle" as const, notifications: 0 },
  signals: { customTitle: "" },

  view: (ctx) =>
    UI.div(
      { attrs: { id: "app", class: "max-w-xl mx-auto p-8" } },

      // Header
      UI.h1({ attrs: { class: "text-3xl font-bold text-gray-900 mb-2" } }, "Head Demo"),
      UI.p(
        { attrs: { class: "text-gray-500 mb-6" } },
        "Demonstrates ctx.head.setTitle() and ctx.head.setFavicon()",
      ),

      // Counter Section
      UI.section(
        { attrs: { class: "bg-white border border-gray-200 rounded-lg p-6 mb-6" } },
        UI.h2({ attrs: { class: "font-semibold text-gray-800 mb-4" } }, "Dynamic Title"),
        UI.p({ attrs: { class: "text-gray-600 mb-4" } }, "Counter changes update the page title:"),
        UI.div(
          { attrs: { class: "flex items-center gap-4" } },
          UI.button(
            {
              attrs: {
                class:
                  "w-12 h-12 bg-red-500 hover:bg-red-600 text-white text-2xl font-bold rounded-lg transition-colors",
              },
              events: { click: on.action(decrement) },
            },
            "-",
          ),
          UI.span(
            { attrs: { class: "text-4xl font-bold text-gray-900 w-20 text-center" } },
            String(ctx.store.count),
          ),
          UI.button(
            {
              attrs: {
                class:
                  "w-12 h-12 bg-green-500 hover:bg-green-600 text-white text-2xl font-bold rounded-lg transition-colors",
              },
              events: { click: on.action(increment) },
            },
            "+",
          ),
        ),
      ),

      // Status Section (Favicon)
      UI.section(
        { attrs: { class: "bg-white border border-gray-200 rounded-lg p-6 mb-6" } },
        UI.h2({ attrs: { class: "font-semibold text-gray-800 mb-4" } }, "Dynamic Favicon"),
        UI.p({ attrs: { class: "text-gray-600 mb-4" } }, "Status changes update the favicon:"),
        UI.div(
          { attrs: { class: "flex gap-3" } },
          StatusButton("idle", ctx.store.status),
          StatusButton("active", ctx.store.status),
          StatusButton("complete", ctx.store.status),
        ),
        UI.p(
          { attrs: { class: "text-sm text-gray-500 mt-3" } },
          `Current status: ${ctx.store.status}`,
        ),
      ),

      // Notifications Section
      UI.section(
        { attrs: { class: "bg-white border border-gray-200 rounded-lg p-6 mb-6" } },
        UI.h2({ attrs: { class: "font-semibold text-gray-800 mb-4" } }, "Title Notifications"),
        UI.p(
          { attrs: { class: "text-gray-600 mb-4" } },
          "Notification count shown in title (like unread messages):",
        ),
        UI.div(
          { attrs: { class: "flex items-center gap-4" } },
          UI.button(
            {
              attrs: {
                class:
                  "px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white font-medium rounded-lg transition-colors",
              },
              events: { click: on.action(addNotification) },
            },
            "Add Notification",
          ),
          ctx.store.notifications > 0
            ? UI.button(
                {
                  attrs: {
                    class:
                      "px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors",
                  },
                  events: { click: on.action(clearNotifications) },
                },
                `Clear (${ctx.store.notifications})`,
              )
            : UI.empty(),
        ),
      ),

      // Custom Title Section
      UI.section(
        { attrs: { class: "bg-white border border-gray-200 rounded-lg p-6 mb-6" } },
        UI.h2({ attrs: { class: "font-semibold text-gray-800 mb-4" } }, "Custom Title"),
        UI.p({ attrs: { class: "text-gray-600 mb-4" } }, "Set any title you want:"),
        UI.form(
          {
            attrs: { class: "flex gap-2" },
            events: {
              submit: on.seq(
                on.script("event.preventDefault()"),
                on.action(setCustomTitle, { title: $.signal("customTitle") }),
              ),
            },
          },
          UI.input({
            attrs: {
              type: "text",
              placeholder: "Enter custom title...",
              class:
                "flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500",
              "hs-bind": "customTitle",
            },
          }),
          UI.button(
            {
              attrs: {
                type: "submit",
                class:
                  "px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors",
              },
            },
            "Set Title",
          ),
        ),
      ),

      // Code Examples
      UI.section(
        { attrs: { class: "bg-gray-50 border border-gray-200 rounded-lg p-6" } },
        UI.h2({ attrs: { class: "font-semibold text-gray-800 mb-4" } }, "How It Works"),
        UI.pre(
          { attrs: { class: "bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto" } },
          UI.code(
            {},
            `// In action handlers:
const increment = hs.action("increment", (ctx) => {
  ctx.update(s => ({ ...s, count: s.count + 1 }))

  // Update page title
  ctx.head.setTitle(\`Count: \${ctx.getStore().count}\`)
})

const setStatus = hs.action("setStatus", { status: Schema.String }, (ctx, { status }) => {
  ctx.update(s => ({ ...s, status }))

  // Update favicon (supports data URIs and paths)
  ctx.head.setFavicon(
    "data:image/svg+xml,...",
    "image/svg+xml"
  )
})`,
          ),
        ),
      ),

      // Footer
      UI.footer(
        { attrs: { class: "mt-8 pt-4 border-t border-gray-200 text-gray-500 text-sm" } },
        UI.p({}, "Watch the browser tab as you interact!"),
      ),
    ),
}).serve({ port: 3016 })

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                       Head Demo                               ║
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
