/**
 * My Hyperstar App
 *
 * A simple real-time counter app. Open in multiple tabs to see state sync!
 */
import { createHyperstar, UI, on } from "hyperstar"

// ============================================================================
// Types
// ============================================================================

interface Store {
  count: number
}

// ============================================================================
// Create App Factory
// ============================================================================

const hs = createHyperstar<Store>()

// ============================================================================
// Actions
// ============================================================================

const inc = hs.action("inc", (ctx) => {
  ctx.update((s) => ({ ...s, count: s.count + 1 }))
})

const dec = hs.action("dec", (ctx) => {
  ctx.update((s) => ({ ...s, count: s.count - 1 }))
})

const reset = hs.action("reset", (ctx) => {
  ctx.update((s) => ({ ...s, count: 0 }))
})

// ============================================================================
// App
// ============================================================================

const server = hs.app({
  store: { count: 0 },

  view: (ctx) =>
    UI.div(
      { attrs: { id: "app", class: "min-h-screen bg-gray-100 flex items-center justify-center p-8" } },
      UI.div(
        { attrs: { class: "bg-white rounded-xl shadow-lg p-8 max-w-md w-full" } },

        UI.h1(
          { attrs: { class: "text-3xl font-bold text-gray-900 mb-8 text-center" } },
          "My Hyperstar App"
        ),

        UI.div(
          { attrs: { class: "flex items-center justify-center gap-6 mb-8" } },
          UI.button(
            {
              attrs: { class: "w-14 h-14 bg-gray-200 hover:bg-gray-300 rounded-full text-2xl font-bold transition-colors" },
              events: { click: on.action(dec) },
            },
            "-"
          ),
          UI.span(
            { attrs: { class: "text-6xl font-bold min-w-24 text-center tabular-nums" } },
            String(ctx.store.count)
          ),
          UI.button(
            {
              attrs: { class: "w-14 h-14 bg-gray-200 hover:bg-gray-300 rounded-full text-2xl font-bold transition-colors" },
              events: { click: on.action(inc) },
            },
            "+"
          )
        ),

        UI.div(
          { attrs: { class: "flex justify-center" } },
          UI.button(
            {
              attrs: { class: "px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors" },
              events: { click: on.action(reset) },
            },
            "Reset"
          )
        ),

        UI.p(
          { attrs: { class: "mt-8 text-center text-gray-500 text-sm" } },
          "Open in multiple tabs - state syncs in real-time!"
        )
      )
    ),
}).serve({ port: Number(process.env.PORT) || 3000 })

console.log(`
🌟 Hyperstar running at http://localhost:${server.port}

Open in multiple tabs to see real-time sync!
`)
