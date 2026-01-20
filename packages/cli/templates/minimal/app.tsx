/**
 * My Hyperstar App
 *
 * A simple real-time counter app. Open in multiple tabs to see state sync!
 */
import { createHyperstar, hs } from "hyperstar"

// ============================================================================
// Types
// ============================================================================

interface Store {
  count: number
}

// ============================================================================
// Create App Factory
// ============================================================================

const app = createHyperstar<Store>()

// ============================================================================
// Actions
// ============================================================================

const inc = app.action("inc", (ctx) => {
  ctx.update((s) => ({ ...s, count: s.count + 1 }))
})

const dec = app.action("dec", (ctx) => {
  ctx.update((s) => ({ ...s, count: s.count - 1 }))
})

const reset = app.action("reset", (ctx) => {
  ctx.update((s) => ({ ...s, count: 0 }))
})

// ============================================================================
// App
// ============================================================================

const server = app.app({
  store: { count: 0 },

  view: (ctx) => (
    <div id="app" class="min-h-screen bg-gray-100 flex items-center justify-center p-8">
      <div class="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
        <h1 class="text-3xl font-bold text-gray-900 mb-8 text-center">My Hyperstar App</h1>

        <div class="flex items-center justify-center gap-6 mb-8">
          <button
            $={hs.action(dec)}
            class="w-14 h-14 bg-gray-200 hover:bg-gray-300 rounded-full text-2xl font-bold transition-colors"
          >
            -
          </button>
          <span class="text-6xl font-bold min-w-24 text-center tabular-nums">{ctx.store.count}</span>
          <button
            $={hs.action(inc)}
            class="w-14 h-14 bg-gray-200 hover:bg-gray-300 rounded-full text-2xl font-bold transition-colors"
          >
            +
          </button>
        </div>

        <div class="flex justify-center">
          <button
            $={hs.action(reset)}
            class="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
          >
            Reset
          </button>
        </div>

        <p class="mt-8 text-center text-gray-500 text-sm">
          Open in multiple tabs - state syncs in real-time!
        </p>
      </div>
    </div>
  ),
}).serve({ port: Number(process.env.PORT) || 3000 })

console.log(`
Hyperstar running at http://localhost:${server.port}

Open in multiple tabs to see real-time sync!
`)
