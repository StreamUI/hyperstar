/**
 * Hyperstar v3 - FPS Stress Test
 *
 * Demonstrates high-frequency state updates using the factory pattern:
 * - hs.timer() for game-loop style updates
 * - trackFps: true for automatic FPS tracking
 * - when: (s) => s.running for conditional execution
 *
 * Open multiple browser tabs to see them all update in sync!
 */
import { createHyperstar, UI, on } from "hyperstar"

// ============================================================================
// Store Type
// ============================================================================

interface Store {
  frame: number
  running: boolean
  fps: number
  clients: number
  maxFps: number
}

// ============================================================================
// Create Factory
// ============================================================================

const hs = createHyperstar<Store>()

// ============================================================================
// Actions
// ============================================================================

const start = hs.action("start", (ctx) => {
  ctx.update((s) => ({ ...s, running: true }))
})

const stop = hs.action("stop", (ctx) => {
  ctx.update((s) => ({ ...s, running: false }))
})

const reset = hs.action("reset", (ctx) => {
  ctx.update((s) => ({ ...s, frame: 0, fps: 0, maxFps: 0 }))
})

// ============================================================================
// Timer - Game Loop Style
// ============================================================================

hs.timer("ticker", {
  interval: 1, // Max speed - let's see how fast we can go!
  when: (s) => s.running, // Only tick when running
  trackFps: true, // Enable FPS tracking
  handler: (ctx) => {
    ctx.update((s) => ({
      ...s,
      frame: s.frame + 1,
      fps: ctx.fps,
      maxFps: Math.max(s.maxFps, ctx.fps),
    }))
  },
})

// ============================================================================
// App Config
// ============================================================================

const server = hs.app({
  store: {
    frame: 0,
    running: false,
    fps: 0,
    clients: 0,
    maxFps: 0,
  },

  onConnect: (ctx) => ctx.update((s) => ({ ...s, clients: s.clients + 1 })),
  onDisconnect: (ctx) => ctx.update((s) => ({ ...s, clients: s.clients - 1 })),

  view: (ctx) =>
    UI.div(
      { attrs: { id: "app", class: "min-h-screen bg-gray-900 text-white p-8" } },
      UI.div(
        { attrs: { class: "max-w-2xl mx-auto" } },

        // Header
        UI.h1({ attrs: { class: "text-4xl font-bold mb-2" } }, "Hyperstar v3 FPS Test"),
        UI.p(
          { attrs: { class: "text-gray-400 mb-8" } },
          "High-frequency server state streaming via SSE",
        ),

        // Controls
        UI.div(
          { attrs: { class: "flex items-center gap-4 mb-8" } },
          !ctx.store.running
            ? UI.button(
                {
                  attrs: {
                    class:
                      "px-8 py-4 bg-green-500 hover:bg-green-600 text-white font-bold text-xl rounded-xl transition-all transform hover:scale-105",
                  },
                  events: { click: on.action(start) },
                },
                "START",
              )
            : UI.button(
                {
                  attrs: {
                    class:
                      "px-8 py-4 bg-red-500 hover:bg-red-600 text-white font-bold text-xl rounded-xl transition-all transform hover:scale-105",
                  },
                  events: { click: on.action(stop) },
                },
                "STOP",
              ),
          UI.button(
            {
              attrs: {
                class:
                  "px-6 py-4 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-xl transition-colors",
              },
              events: { click: on.action(reset) },
            },
            "Reset",
          ),
        ),

        // Stats grid
        UI.div(
          { attrs: { class: "grid grid-cols-2 md:grid-cols-4 gap-4 mb-8" } },

          // Frames
          UI.div(
            { attrs: { class: "bg-gray-800 p-6 rounded-xl" } },
            UI.div(
              { attrs: { class: "text-5xl font-bold text-blue-400 tabular-nums" } },
              ctx.store.frame.toLocaleString(),
            ),
            UI.div({ attrs: { class: "text-gray-500 text-sm mt-1" } }, "Frames"),
          ),

          // FPS
          UI.div(
            { attrs: { class: "bg-gray-800 p-6 rounded-xl" } },
            UI.div(
              {
                attrs: {
                  class: "text-5xl font-bold tabular-nums",
                  style: `color: ${
                    ctx.store.fps >= 50
                      ? "#22c55e"
                      : ctx.store.fps >= 30
                        ? "#eab308"
                        : "#ef4444"
                  }`,
                },
              },
              String(ctx.store.fps),
            ),
            UI.div({ attrs: { class: "text-gray-500 text-sm mt-1" } }, "FPS"),
          ),

          // Max FPS
          UI.div(
            { attrs: { class: "bg-gray-800 p-6 rounded-xl" } },
            UI.div(
              { attrs: { class: "text-5xl font-bold text-purple-400 tabular-nums" } },
              String(ctx.store.maxFps),
            ),
            UI.div({ attrs: { class: "text-gray-500 text-sm mt-1" } }, "Max FPS"),
          ),

          // Clients
          UI.div(
            { attrs: { class: "bg-gray-800 p-6 rounded-xl" } },
            UI.div(
              { attrs: { class: "text-5xl font-bold text-cyan-400 tabular-nums" } },
              String(ctx.store.clients),
            ),
            UI.div({ attrs: { class: "text-gray-500 text-sm mt-1" } }, "Clients"),
          ),
        ),

        // Visual indicator
        UI.div(
          { attrs: { class: "mb-8" } },
          UI.div({
            attrs: {
              class: `h-2 rounded-full transition-all duration-100 ${ctx.store.running ? "bg-green-500" : "bg-gray-700"}`,
              style: ctx.store.running
                ? `width: ${Math.min(100, (ctx.store.fps / 60) * 100)}%`
                : "width: 0%",
            },
          }),
        ),

        // Info
        UI.div(
          { attrs: { class: "bg-gray-800/50 p-6 rounded-xl" } },
          UI.h3(
            { attrs: { class: "text-lg font-semibold text-gray-300 mb-3" } },
            "How it works",
          ),
          UI.ul(
            { attrs: { class: "space-y-2 text-gray-400 text-sm" } },
            UI.li({}, "Each frame triggers a server-side store update"),
            UI.li({}, "Store changes are rendered to HTML on the server"),
            UI.li({}, "HTML diffs are streamed via SSE to all connected clients"),
            UI.li({}, "Idiomorph morphs the DOM without full page reloads"),
            UI.li({}, "Open multiple tabs to see synchronized state!"),
          ),
        ),

        // Status
        UI.div(
          { attrs: { class: "mt-8 text-center text-gray-500 text-sm" } },
          UI.span({
            attrs: {
              class: `inline-block w-2 h-2 rounded-full mr-2 ${ctx.store.running ? "bg-green-500 animate-pulse" : "bg-gray-600"}`,
            },
          }),
          ctx.store.running ? "Running" : "Stopped",
        ),
      ),
    ),
}).serve({ port: 3003 })

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                    FPS Stress Test                            ║
╠═══════════════════════════════════════════════════════════════╣
║  http://localhost:${server.port}                                    ║
║                                                               ║
║  Using hs.timer() for game-loop style updates:                ║
║  • interval: 1 (max speed)                                    ║
║  • when: (s) => s.running (conditional)                       ║
║  • trackFps: true (automatic FPS tracking)                    ║
╚═══════════════════════════════════════════════════════════════╝
`)

process.on("SIGINT", async () => {
  console.log("\nShutting down...")
  await server.stop()
  process.exit(0)
})
