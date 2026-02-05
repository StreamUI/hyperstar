/**
 * Hyperstar v3 - FPS Stress Test (JSX Version)
 *
 * Demonstrates high-frequency state updates using the factory pattern:
 * - hs.repeat() for game-loop style updates
 * - trackFps: true for automatic FPS tracking
 * - when: (s) => s.running for conditional execution
 *
 * Open multiple browser tabs to see them all update in sync!
 */
import { createHyperstar, hs } from "hyperstar"

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

const app = createHyperstar<Store>()

// ============================================================================
// Actions
// ============================================================================

const start = app.action("start", (ctx) => {
  ctx.update((s) => ({ ...s, running: true }))
})

const stop = app.action("stop", (ctx) => {
  ctx.update((s) => ({ ...s, running: false }))
})

const reset = app.action("reset", (ctx) => {
  ctx.update((s) => ({ ...s, frame: 0, fps: 0, maxFps: 0 }))
})

// ============================================================================
// Repeat - Game Loop Style
// ============================================================================

app.repeat("ticker", {
  every: 1, // Max speed - let's see how fast we can go!
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
// Helper for FPS color
// ============================================================================

function getFpsColor(fps: number): string {
  if (fps >= 50) return "#22c55e" // green
  if (fps >= 30) return "#eab308" // yellow
  return "#ef4444" // red
}

// ============================================================================
// App Config
// ============================================================================

const server = app.app({
  store: {
    frame: 0,
    running: false,
    fps: 0,
    clients: 0,
    maxFps: 0,
  },

  title: ({ store }) => `FPS: ${store.fps} | Frames: ${store.frame}`,

  onConnect: (ctx) => ctx.update((s) => ({ ...s, clients: s.clients + 1 })),
  onDisconnect: (ctx) => ctx.update((s) => ({ ...s, clients: s.clients - 1 })),

  view: (ctx) => (
    <div id="app" class="min-h-screen bg-gray-900 text-white p-8">
      <div class="max-w-2xl mx-auto">
        {/* Header */}
        <h1 class="text-4xl font-bold mb-2">Hyperstar v3 FPS Test</h1>
        <p class="text-gray-400 mb-8">
          High-frequency server state streaming via SSE
        </p>

        {/* Controls */}
        <div class="flex items-center gap-4 mb-8">
          {!ctx.store.running ? (
            <button
              $={hs.action(start)}
              class="px-8 py-4 bg-green-500 hover:bg-green-600 text-white font-bold text-xl rounded-xl transition-all transform hover:scale-105"
            >
              START
            </button>
          ) : (
            <button
              $={hs.action(stop)}
              class="px-8 py-4 bg-red-500 hover:bg-red-600 text-white font-bold text-xl rounded-xl transition-all transform hover:scale-105"
            >
              STOP
            </button>
          )}
          <button
            $={hs.action(reset)}
            class="px-6 py-4 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-xl transition-colors"
          >
            Reset
          </button>
        </div>

        {/* Stats grid */}
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {/* Frames */}
          <div class="bg-gray-800 p-6 rounded-xl">
            <div class="text-5xl font-bold text-blue-400 tabular-nums">
              {ctx.store.frame.toLocaleString()}
            </div>
            <div class="text-gray-500 text-sm mt-1">Frames</div>
          </div>

          {/* FPS */}
          <div class="bg-gray-800 p-6 rounded-xl">
            <div
              class="text-5xl font-bold tabular-nums"
              style={`color: ${getFpsColor(ctx.store.fps)}`}
            >
              {ctx.store.fps}
            </div>
            <div class="text-gray-500 text-sm mt-1">FPS</div>
          </div>

          {/* Max FPS */}
          <div class="bg-gray-800 p-6 rounded-xl">
            <div class="text-5xl font-bold text-purple-400 tabular-nums">
              {ctx.store.maxFps}
            </div>
            <div class="text-gray-500 text-sm mt-1">Max FPS</div>
          </div>

          {/* Clients */}
          <div class="bg-gray-800 p-6 rounded-xl">
            <div class="text-5xl font-bold text-cyan-400 tabular-nums">
              {ctx.store.clients}
            </div>
            <div class="text-gray-500 text-sm mt-1">Clients</div>
          </div>
        </div>

        {/* Visual indicator */}
        <div class="mb-8">
          <div
            class={`h-2 rounded-full transition-all duration-100 ${ctx.store.running ? "bg-green-500" : "bg-gray-700"}`}
            style={ctx.store.running ? `width: ${Math.min(100, (ctx.store.fps / 60) * 100)}%` : "width: 0%"}
          />
        </div>

        {/* Info */}
        <div class="bg-gray-800/50 p-6 rounded-xl">
          <h3 class="text-lg font-semibold text-gray-300 mb-3">How it works</h3>
          <ul class="space-y-2 text-gray-400 text-sm">
            <li>Each frame triggers a server-side store update</li>
            <li>Store changes are rendered to HTML on the server</li>
            <li>HTML diffs are streamed via SSE to all connected clients</li>
            <li>Idiomorph morphs the DOM without full page reloads</li>
            <li>Open multiple tabs to see synchronized state!</li>
          </ul>
        </div>

        {/* Status */}
        <div class="mt-8 text-center text-gray-500 text-sm">
          <span
            class={`inline-block w-2 h-2 rounded-full mr-2 ${ctx.store.running ? "bg-green-500 animate-pulse" : "bg-gray-600"}`}
          />
          {ctx.store.running ? "Running" : "Stopped"}
        </div>
      </div>
    </div>
  ),
}).serve({ port: 3003 })

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                FPS Stress Test (JSX Version)                  ║
╠═══════════════════════════════════════════════════════════════╣
║  http://localhost:${server.port}                                    ║
║                                                               ║
║  Using app.repeat() for game-loop style updates:              ║
║  • every: 1 (max speed)                                       ║
║  • when: (s) => s.running (conditional)                       ║
║  • trackFps: true (automatic FPS tracking)                    ║
╚═══════════════════════════════════════════════════════════════╝
`)

process.on("SIGINT", async () => {
  console.log("\nShutting down...")
  await server.stop()
  process.exit(0)
})
