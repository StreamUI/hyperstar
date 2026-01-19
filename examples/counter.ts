/**
 * Hyperstar v3 - Counter Example
 *
 * Demonstrates the factory pattern:
 * 1. Create factory with createHyperstar<Store>()
 * 2. Define signals and actions first
 * 3. Call .app({ store, view }) - view can reference action variables!
 * 4. Call .serve()
 *
 * Features:
 * - Actions with and without arguments
 * - hs.signal() for client-side form state
 * - ctx.patchSignals() to clear form after submit
 * - Dynamic title based on store state
 */
import { createHyperstar, UI, on, $, Schema } from "hyperstar"

// ============================================================================
// Store Type
// ============================================================================

interface Store {
  count: number
}

interface Signals {
  amount: string
}

// ============================================================================
// Create Factory
// ============================================================================

const hs = createHyperstar<Store, {}, Signals>()

// ============================================================================
// Signals - Client-side form state
// ============================================================================

const { amount } = hs.signals

// ============================================================================
// Actions - Define FIRST so view can reference them
// ============================================================================

const increment = hs.action("increment", (ctx) => {
  ctx.update((s) => ({ ...s, count: s.count + 1 }))
})

const decrement = hs.action("decrement", (ctx) => {
  ctx.update((s) => ({ ...s, count: s.count - 1 }))
})

const reset = hs.action("reset", (ctx) => {
  ctx.update((s) => ({ ...s, count: 0 }))
})

const add = hs.action("add", { amount: Schema.Number }, (ctx, { amount }) => {
  ctx.update((s) => ({ ...s, count: s.count + amount }))
  ctx.patchSignals({ amount: "" }) // Clear the input after adding
})

// ============================================================================
// App Config
// ============================================================================

const server = hs.app({
  store: { count: 0 },
  signals: { amount: "" },

  title: ({ store }) => `Counter: ${store.count}`,

  view: (ctx) =>
    UI.div(
      {
        attrs: {
          id: "app",
          class:
            "min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center",
        },
      },
      UI.div(
        {
          attrs: {
            class: "bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full",
          },
        },

        // Title
        UI.h1(
          {
            attrs: {
              class: "text-3xl font-bold text-center text-gray-800 mb-8",
            },
          },
          "Hyperstar v3 Counter",
        ),

        // Count display
        UI.div(
          {
            attrs: {
              class:
                "text-7xl font-bold text-center text-indigo-600 mb-8 tabular-nums",
            },
          },
          String(ctx.store.count),
        ),

        // Increment/Decrement buttons
        UI.div(
          { attrs: { class: "flex gap-4 mb-6" } },
          UI.button(
            {
              attrs: {
                class:
                  "flex-1 py-4 px-6 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold text-xl transition-colors",
              },
              events: { click: on.action(decrement) },
            },
            "- 1",
          ),
          UI.button(
            {
              attrs: {
                class:
                  "flex-1 py-4 px-6 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold text-xl transition-colors",
              },
              events: { click: on.action(increment) },
            },
            "+ 1",
          ),
        ),

        // Custom amount input
        UI.div(
          { attrs: { class: "flex gap-2 mb-6" } },
          UI.input({
            attrs: {
              type: "number",
              placeholder: "Amount",
              class:
                "flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none text-lg",
              "hs-bind": "amount",
            },
          }),
          UI.button(
            {
              attrs: {
                class:
                  "px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-semibold transition-colors",
                "hs-show": amount.isNotEmpty().toString(),
              },
              events: {
                click: on.action(add, {
                  amount: $.parseInt($.signal("amount"), $.num(0)),
                }),
              },
            },
            "Add",
          ),
        ),

        // Reset button (shown only when count != 0)
        ctx.store.count !== 0
          ? UI.button(
              {
                attrs: {
                  class:
                    "w-full py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-semibold transition-colors",
                },
                events: { click: on.action(reset) },
              },
              "Reset",
            )
          : UI.empty(),

        // Info
        UI.p(
          { attrs: { class: "text-center text-gray-500 text-sm mt-6" } },
          "Hyperstar v3 - Factory Pattern API",
        ),
      ),
    ),
}).serve({ port: 3010 })

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                    Counter Example                            ║
╠═══════════════════════════════════════════════════════════════╣
║  http://localhost:${server.port}                                    ║
║                                                               ║
║  New signal API:                                              ║
║  • hs.signal("amount", "") - define signal                    ║
║  • amount.isNotEmpty() - expression for hs-show               ║
║  • ctx.patchSignals({ amount: "" }) - clear from server       ║
╚═══════════════════════════════════════════════════════════════╝
`)

process.on("SIGINT", async () => {
  console.log("\nShutting down...")
  await server.stop()
  process.exit(0)
})
