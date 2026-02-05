/**
 * Hyperstar v3 - DSL Showcase
 *
 * Demonstrates:
 * - hs.actionOn + modifiers
 * - hs.seq for multi-step expressions
 * - hs.html for innerHTML
 * - hs.style for inline styles
 * - hs.init and hs.ref
 */
import { createHyperstar, hs, Schema } from "hyperstar"

// ============================================================================
// Types
// ============================================================================

interface Store {
  clicks: number
  lastInput: string
}

interface Signals {
  text: string
  color: string
  html: string
}

// ============================================================================
// Create Factory
// ============================================================================

const app = createHyperstar<Store, {}, Signals>()

// ============================================================================
// Signals
// ============================================================================

const { text, color, html } = app.signals

// ============================================================================
// Actions
// ============================================================================

const increment = app.action("increment", (ctx) => {
  ctx.update((s) => ({ ...s, clicks: s.clicks + 1 }))
})

const saveInput = app.action("saveInput", { value: Schema.String }, (ctx, { value }) => {
  ctx.update((s) => ({ ...s, lastInput: value }))
})

// ============================================================================
// App Config
// ============================================================================

const server = app.app({
  store: { clicks: 0, lastInput: "" },
  signals: { text: "", color: "#22c55e", html: "<strong>Hello</strong>" },
  title: "DSL Showcase",

  view: (ctx) => (
    <div
      id="app"
      $={hs.init("console.log('[hyperstar] DSL showcase ready')")}
      class="min-h-screen bg-gray-50 text-gray-900"
    >
      <div class="max-w-3xl mx-auto p-6 space-y-6">
        <header>
          <h1 class="text-3xl font-bold">DSL Showcase</h1>
          <p class="text-gray-600">
            Demonstrates the new hs.* helpers in a single page.
          </p>
        </header>

        {/* actionOn + ref + seq */}
        <section class="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <h2 class="text-lg font-semibold">actionOn + ref + seq</h2>
          <input
            type="text"
            placeholder="Type to sync to the server..."
            $={hs
              .bind(text)
              .ref("mainInput")
              .actionOn("input", saveInput, { value: text }, { debounce: 300 })}
            class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <p class="text-sm text-gray-500">
            Server value:{" "}
            <span class="font-mono">
              {ctx.store.lastInput || "(empty)"}
            </span>
          </p>
          <div class="flex gap-2">
            <button
              $={hs.on("click", "$refs.mainInput.focus()")}
              class="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
            >
              Focus Input
            </button>
            <button
              $={hs.on(
                "click",
                hs.seq(
                  text.set(""),
                  html.set("<em>Cleared</em>"),
                  hs.expr("$refs.mainInput.focus()"),
                ),
              )}
              class="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
            >
              Clear + Focus
            </button>
          </div>
        </section>

        {/* html + style */}
        <section class="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <h2 class="text-lg font-semibold">html + style</h2>
          <div class="flex items-center gap-3">
            <input
              type="color"
              $={hs.bind(color)}
              class="w-12 h-12 rounded cursor-pointer border-0"
            />
            <div
              $={hs.style("background-color", color.expr)}
              class="w-20 h-10 rounded border border-gray-200"
              title="Dynamic background"
            />
            <span class="font-mono text-sm" hs-text="$color.value" />
          </div>
          <div
            $={hs.html(html.expr)}
            class="px-3 py-2 bg-gray-100 rounded text-sm"
          />
          <div class="flex gap-2">
            <button
              $={hs.on("click", html.set("<strong>Bold</strong>"))}
              class="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
            >
              Bold
            </button>
            <button
              $={hs.on("click", html.set("<em>Italic</em>"))}
              class="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
            >
              Italic
            </button>
          </div>
        </section>

        {/* action */}
        <section class="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <h2 class="text-lg font-semibold">action</h2>
          <div class="flex items-center gap-3">
            <button
              $={hs.action(increment)}
              class="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded"
            >
              Increment (server)
            </button>
            <span class="text-sm">
              Clicks: <span class="font-mono">{ctx.store.clicks}</span>
            </span>
          </div>
        </section>
      </div>
    </div>
  ),
}).serve({ port: 3021 })

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                       DSL Showcase                            ║
╠═══════════════════════════════════════════════════════════════╣
║  http://localhost:${server.port}                                    ║
║                                                               ║
║  Features demonstrated:                                       ║
║  • hs.actionOn with debounce                                  ║
║  • hs.seq for multi-step expressions                          ║
║  • hs.html and hs.style                                       ║
║  • hs.init and hs.ref                                         ║
╚═══════════════════════════════════════════════════════════════╝
`)

process.on("SIGINT", async () => {
  console.log("\nShutting down...")
  await server.stop()
  process.exit(0)
})
