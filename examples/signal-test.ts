/**
 * Hyperstar v3 - Signal Test Example
 *
 * A minimal example to test the signal API:
 * - Signal types declared on createHyperstar<Store, UserStore, Signals>()
 * - hs.signals for typed signal handles (available immediately)
 * - Default values provided in hs.app({ signals: {...} })
 * - ctx.patchSignals() is fully typed from Signals interface
 * - hs-bind for client-side two-way binding
 * - hs-show for conditional rendering
 * - hs-text for dynamic text content
 */
import { createHyperstar, UI, on, $, Schema } from "hyperstar"

// ============================================================================
// Store
// ============================================================================

interface Store {
  submissions: string[]
}

// ============================================================================
// Create Factory with Signal Types
// ============================================================================

// Define signals type for type-safe patchSignals
interface Signals {
  text: string
  showSecret: boolean
  count: number
  editingIndex: number | null
}

// Types declared here - values provided in app()
const hs = createHyperstar<Store, {}, Signals>()

// ============================================================================
// Signals - Destructure from hs.signals (fully typed!)
// ============================================================================

const { text, showSecret, count, editingIndex } = hs.signals

// ============================================================================
// Actions
// ============================================================================

// Submit the form - clears text signal from server
const submit = hs.action("submit", { text: Schema.String }, (ctx, { text: t }) => {
  if (!t.trim()) return

  ctx.update((s) => ({
    ...s,
    submissions: [...s.submissions, t.trim()],
  }))

  // Server-side signal patch - clears the input for all clients
  ctx.patchSignals({ text: "" })
})

// Clear all submissions
const clear = hs.action("clear", (ctx) => {
  ctx.update((s) => ({ ...s, submissions: [] }))
})

// Increment from server (patches count signal)
const serverIncrement = hs.action("serverIncrement", (ctx) => {
  // Note: We'd need to track count server-side too, or read from client
  // For this demo, we just patch the signal with a new value
  ctx.patchSignals({ count: Date.now() % 100 }) // Random-ish number for demo
})

// ============================================================================
// App
// ============================================================================

const server = hs.app({
  store: { submissions: [] },
  signals: { text: "", showSecret: false, count: 0, editingIndex: null },

  title: ({ store }) => `Signal Test (${store.submissions.length} items)`,

  view: (ctx) =>
    UI.div(
      { attrs: { id: "app", class: "max-w-xl mx-auto p-8" } },

      // Header
      UI.h1({ attrs: { class: "text-3xl font-bold text-gray-900 mb-2" } }, "Signal Test"),
      UI.p(
        { attrs: { class: "text-gray-500 mb-8" } },
        "Testing hs.signal() factory and ctx.patchSignals()",
      ),

      // =========================================
      // Test 1: String signal with hs-bind
      // =========================================
      UI.section(
        { attrs: { class: "bg-white border border-gray-200 rounded-lg p-6 mb-6" } },
        UI.h2({ attrs: { class: "font-semibold text-gray-800 mb-4" } }, "1. String Signal (hs-bind)"),

        UI.div(
          { attrs: { class: "flex gap-2 mb-4" } },
          UI.input({
            attrs: {
              type: "text",
              placeholder: "Type something...",
              class:
                "flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500",
              "hs-bind": "text", // Two-way binding to text signal
            },
          }),
          UI.button(
            {
              attrs: {
                class:
                  "px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors",
                // Use signal handle's expression builder
                "hs-show": text.isNotEmpty().toString(),
              },
              events: {
                click: on.action(submit, { text: $.signal("text") }),
              },
            },
            "Submit",
          ),
        ),

        // Show current value using hs-text
        UI.p(
          { attrs: { class: "text-sm text-gray-500" } },
          "Current value: ",
          UI.span(
            { attrs: { class: "font-mono bg-gray-100 px-1 rounded", "hs-text": "$text.value" } },
            "",
          ),
        ),
      ),

      // =========================================
      // Test 2: Boolean signal toggle
      // =========================================
      UI.section(
        { attrs: { class: "bg-white border border-gray-200 rounded-lg p-6 mb-6" } },
        UI.h2({ attrs: { class: "font-semibold text-gray-800 mb-4" } }, "2. Boolean Signal (toggle)"),

        UI.button(
          {
            attrs: {
              class: "px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg mb-4",
            },
            events: {
              // Client-side toggle using on.script
              click: on.script("$showSecret.value = !$showSecret.value"),
            },
          },
          "Toggle Secret",
        ),

        UI.div(
          {
            attrs: {
              class: "p-4 bg-purple-100 rounded-lg",
              "hs-show": showSecret.expr.toString(), // Show when true
            },
          },
          UI.p({ attrs: { class: "text-purple-800" } }, "The secret message is revealed!"),
        ),
      ),

      // =========================================
      // Test 3: Number signal with client increment
      // =========================================
      UI.section(
        { attrs: { class: "bg-white border border-gray-200 rounded-lg p-6 mb-6" } },
        UI.h2({ attrs: { class: "font-semibold text-gray-800 mb-4" } }, "3. Number Signal (client + server)"),

        UI.div(
          { attrs: { class: "flex items-center gap-4 mb-4" } },
          UI.button(
            {
              attrs: {
                class: "px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg",
              },
              events: {
                // Client-side increment
                click: on.script("$count.value++"),
              },
            },
            "+1 (Client)",
          ),
          UI.span(
            {
              attrs: {
                class: "text-4xl font-bold text-green-600 tabular-nums",
                "hs-text": "$count.value",
              },
            },
            "0",
          ),
          UI.button(
            {
              attrs: {
                class: "px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg",
              },
              events: {
                // Server-side patch (random value)
                click: on.action(serverIncrement),
              },
            },
            "Random (Server)",
          ),
        ),

        UI.p(
          { attrs: { class: "text-sm text-gray-500" } },
          "Client increment is instant. Server patch broadcasts to all clients.",
        ),
      ),

      // =========================================
      // Test 4: Nullable signal for edit mode
      // =========================================
      UI.section(
        { attrs: { class: "bg-white border border-gray-200 rounded-lg p-6 mb-6" } },
        UI.h2({ attrs: { class: "font-semibold text-gray-800 mb-4" } }, "4. Nullable Signal (edit mode)"),

        UI.div(
          { attrs: { class: "flex gap-2 mb-4" } },
          UI.button(
            {
              attrs: {
                class: "px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded",
              },
              events: { click: on.script("$editingIndex.value = 0") },
            },
            "Edit #0",
          ),
          UI.button(
            {
              attrs: {
                class: "px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded",
              },
              events: { click: on.script("$editingIndex.value = 1") },
            },
            "Edit #1",
          ),
          UI.button(
            {
              attrs: {
                class: "px-3 py-1 bg-red-200 hover:bg-red-300 rounded",
                "hs-show": editingIndex.isNotNull().toString(),
              },
              events: { click: on.signal("editingIndex", $.null()) },
            },
            "Cancel",
          ),
        ),

        UI.p(
          { attrs: { class: "text-sm" } },
          "Editing index: ",
          UI.span(
            { attrs: { class: "font-mono bg-gray-100 px-1 rounded", "hs-text": "String($editingIndex.value)" } },
            "",
          ),
        ),

        // Show different content based on editingIndex
        UI.div(
          {
            attrs: {
              class: "mt-4 p-4 bg-amber-100 rounded-lg",
              "hs-show": editingIndex.is(0).toString(),
            },
          },
          UI.p({}, "Editing item #0"),
        ),
        UI.div(
          {
            attrs: {
              class: "mt-4 p-4 bg-cyan-100 rounded-lg",
              "hs-show": editingIndex.is(1).toString(),
            },
          },
          UI.p({}, "Editing item #1"),
        ),
      ),

      // =========================================
      // Submissions list (from server store)
      // =========================================
      UI.section(
        { attrs: { class: "bg-gray-50 border border-gray-200 rounded-lg p-6" } },
        UI.div(
          { attrs: { class: "flex justify-between items-center mb-4" } },
          UI.h2(
            { attrs: { class: "font-semibold text-gray-800" } },
            `Submissions (${ctx.store.submissions.length})`,
          ),
          ctx.store.submissions.length > 0
            ? UI.button(
                {
                  attrs: {
                    class: "text-sm text-red-500 hover:text-red-700",
                  },
                  events: { click: on.action(clear) },
                },
                "Clear All",
              )
            : UI.empty(),
        ),

        ctx.store.submissions.length === 0
          ? UI.p({ attrs: { class: "text-gray-400" } }, "No submissions yet")
          : UI.ul(
              { attrs: { class: "space-y-2" } },
              ...ctx.store.submissions.map((item, i) =>
                UI.li(
                  {
                    attrs: {
                      id: `item-${i}`,
                      class: "px-3 py-2 bg-white rounded border border-gray-200",
                    },
                  },
                  item,
                ),
              ),
            ),
      ),

      // Footer
      UI.footer(
        { attrs: { class: "mt-8 pt-4 border-t border-gray-200 text-gray-500 text-sm" } },
        UI.p({}, "Open in multiple tabs to see server-side patches sync across clients."),
      ),
    ),
}).serve({ port: 3019 })

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                Signal Test                                    ║
╠═══════════════════════════════════════════════════════════════╣
║  http://localhost:${server.port}                                    ║
║                                                               ║
║  Signal API:                                                  ║
║  • createHyperstar<Store, {}, Signals>() - types only         ║
║  • hs.app({ signals: {...} }) - default values here           ║
║  • const { text } = hs.signals - destructure handles          ║
║  • ctx.patchSignals({ text: "" }) - FULLY TYPED!              ║
║  • hs-bind, hs-show, hs-text - client directives              ║
╚═══════════════════════════════════════════════════════════════╝
`)

process.on("SIGINT", async () => {
  console.log("\nShutting down...")
  await server.stop()
  process.exit(0)
})
