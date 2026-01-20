/**
 * Hyperstar v3 - Simple Counter (JSX Version)
 *
 * The simplest possible Hyperstar app - just a counter!
 */
import { createHyperstar, hs } from "hyperstar"

interface Store {
  count: number
}

const app = createHyperstar<Store>()

const increment = app.action("increment", (ctx) => {
  ctx.update((s) => ({ ...s, count: s.count + 1 }))
})

const decrement = app.action("decrement", (ctx) => {
  ctx.update((s) => ({ ...s, count: s.count - 1 }))
})

app.app({
  store: { count: 0 },

  view: (ctx) => (
    <div id="app" class="min-h-screen flex items-center justify-center bg-gray-100">
      <div class="text-center">
        <h1 class="text-6xl font-bold text-gray-900 mb-8 tabular-nums">
          {ctx.store.count}
        </h1>
        <div class="flex gap-4">
          <button
            $={hs.action(decrement)}
            class="w-16 h-16 text-3xl font-bold bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors"
          >
            -
          </button>
          <button
            $={hs.action(increment)}
            class="w-16 h-16 text-3xl font-bold bg-green-500 hover:bg-green-600 text-white rounded-full transition-colors"
          >
            +
          </button>
        </div>
      </div>
    </div>
  ),
}).serve({ port: 3000 })

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║              Simple Counter (JSX Version)                     ║
╠═══════════════════════════════════════════════════════════════╣
║  http://localhost:3000                                        ║
╚═══════════════════════════════════════════════════════════════╝
`)
