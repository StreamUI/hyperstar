/**
 * Hyperstar v3 - Counter Example (JSX Version)
 *
 * This example uses Kita JSX with the $ prop for reactive attributes.
 * Much cleaner than the DSL version!
 *
 * Features:
 * - JSX syntax with Kita HTML
 * - $ prop for reactive attributes (hs.action, hs.show, etc.)
 * - Signal handles for client-side form state
 * - Dynamic title based on store state
 */
import { createHyperstar, hs, Schema } from "hyperstar"

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

const app = createHyperstar<Store, {}, Signals>()

// ============================================================================
// Signals - Client-side form state
// ============================================================================

const { amount } = app.signals

// ============================================================================
// Actions - Define FIRST so view can reference them
// ============================================================================

const increment = app.action("increment", (ctx) => {
  ctx.update((s) => ({ ...s, count: s.count + 1 }))
})

const decrement = app.action("decrement", (ctx) => {
  ctx.update((s) => ({ ...s, count: s.count - 1 }))
})

const reset = app.action("reset", (ctx) => {
  ctx.update((s) => ({ ...s, count: 0 }))
})

// Schema that accepts string or number and converts to number
const NumberFromString = Schema.transform(
  Schema.Union(Schema.String, Schema.Number),
  Schema.Number,
  {
    decode: (v) => typeof v === "string" ? parseInt(v, 10) || 0 : v,
    encode: (v) => v,
  }
)

const add = app.action("add", { amount: NumberFromString }, (ctx, { amount }) => {
  ctx.update((s) => ({ ...s, count: s.count + amount }))
  ctx.patchSignals({ amount: "" }) // Clear the input after adding
})

// ============================================================================
// App Config with JSX View
// ============================================================================

const server = app.app({
  store: { count: 0 },
  signals: { amount: "" },

  title: ({ store }) => `Counter: ${store.count}`,

  view: (ctx) => (
    <div
      id="app"
      class="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center"
    >
      <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        {/* Title */}
        <h1 class="text-3xl font-bold text-center text-gray-800 mb-8">
          Hyperstar v3 Counter (JSX)
        </h1>

        {/* Count display */}
        <div class="text-7xl font-bold text-center text-indigo-600 mb-8 tabular-nums">
          {ctx.store.count}
        </div>

        {/* Increment/Decrement buttons */}
        <div class="flex gap-4 mb-6">
          <button
            $={hs.action(decrement)}
            class="flex-1 py-4 px-6 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold text-xl transition-colors"
          >
            - 1
          </button>
          <button
            $={hs.action(increment)}
            class="flex-1 py-4 px-6 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold text-xl transition-colors"
          >
            + 1
          </button>
        </div>

        {/* Custom amount input - uses form/bind pattern */}
        <form $={hs.form(add)} class="flex gap-2 mb-6">
          <input
            type="number"
            name="amount"
            placeholder="Amount"
            $={hs.bind(amount)}
            class="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none text-lg"
          />
          <button
            type="submit"
            hs-show={amount.isNotEmpty()}
            class="px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-semibold transition-colors"
          >
            Add
          </button>
        </form>

        {/* Reset button (shown only when count != 0) */}
        {ctx.store.count !== 0 && (
          <button
            $={hs.action(reset)}
            class="w-full py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-semibold transition-colors"
          >
            Reset
          </button>
        )}

        {/* Info */}
        <p class="text-center text-gray-500 text-sm mt-6">
          Hyperstar v3 - JSX with Kita HTML
        </p>
      </div>
    </div>
  ),
}).serve({ port: 3011 })

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                Counter Example (JSX Version)                   ║
╠═══════════════════════════════════════════════════════════════╣
║  http://localhost:${server.port}                                    ║
║                                                               ║
║  JSX syntax with $ prop:                                      ║
║  • <button $={hs.action(increment)}>+1</button>               ║
║  • hs-show={amount.isNotEmpty()} (no .toString()!) ║
║  • hs-bind="amount" for two-way binding                       ║
╚═══════════════════════════════════════════════════════════════╝
`)

process.on("SIGINT", async () => {
  console.log("\nShutting down...")
  await server.stop()
  process.exit(0)
})
