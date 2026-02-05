/**
 * Hyperstar v3 - DSL Test Example (JSX Version)
 *
 * Demonstrates the full factory pattern with all async capabilities:
 * 1. Create factory with createHyperstar<Store, UserStore, Signals>()
 * 2. Define actions, repeats, crons, triggers
 * 3. Call .app({ store, view }) - view can reference action variables!
 * 4. Call .serve()
 *
 * Features showcased:
 * - Repeat with conditional execution & FPS tracking
 * - Repeat for heartbeats
 * - Cron jobs (global and per-user)
 * - Triggers that react to store changes
 * - User triggers for per-session state changes
 * - Signals for client-side interactivity
 */
import { createHyperstar, hs, Schema } from "hyperstar"

// ============================================================================
// Store Types
// ============================================================================

interface Store {
  count: number
  frame: number
  fps: number
  users: string[]
  lastHeartbeat: number
  running: boolean
  logs: { time: string; emoji: string; source: string; message: string }[]
}

interface UserStore {
  nickname: string
  myCount: number
  lastSeen: number
}

interface Signals {
  nickname: string
  amount: number
  showLogs: boolean
}

// ============================================================================
// Create Factory
// ============================================================================

const app = createHyperstar<Store, UserStore, Signals>()

// ============================================================================
// Signals
// ============================================================================

const { nickname, amount, showLogs } = app.signals

// ============================================================================
// Helper: Add log entry
// ============================================================================

function addLog(
  ctx: { update: (fn: (s: Store) => Store) => void },
  emoji: string,
  source: string,
  message: string,
) {
  const time = new Date().toLocaleTimeString()
  ctx.update((s) => ({
    ...s,
    logs: [{ time, emoji, source, message }, ...s.logs].slice(0, 20),
  }))
}

// ============================================================================
// Actions - Define FIRST so view can reference them
// ============================================================================

const increment = app.action("increment", (ctx) => {
  const store = ctx.getStore()
  console.log(`🔵 [increment] ${store.count} → ${store.count + 1}`)
  addLog(ctx, "🔵", "Action", `increment: ${store.count} → ${store.count + 1}`)
  ctx.update((s) => ({ ...s, count: s.count + 1 }))
})

const addAmount = app.action("addAmount", { amount: Schema.Number }, (ctx, { amount }) => {
  const store = ctx.getStore()
  console.log(`🟣 [addAmount] Adding ${amount} to ${store.count}`)
  addLog(ctx, "🟣", "Action", `addAmount: +${amount} (${store.count} → ${store.count + amount})`)
  ctx.update((s) => ({ ...s, count: s.count + amount }))
})

const incrementMine = app.action("incrementMine", (ctx) => {
  const userStore = ctx.getUserStore()
  console.log(`🟢 [incrementMine] ${userStore.myCount} → ${userStore.myCount + 1}`)
  addLog(ctx, "🟢", "Action", `incrementMine: ${userStore.myCount} → ${userStore.myCount + 1}`)
  ctx.updateUserStore((u) => ({ ...u, myCount: u.myCount + 1 }))
})

const setNickname = app.action("setNickname", { nickname: Schema.String }, (ctx, { nickname }) => {
  console.log(`🟡 [setNickname] → "${nickname}"`)
  addLog(ctx, "🟡", "Action", `setNickname: "${nickname}"`)
  ctx.updateUserStore((u) => ({ ...u, nickname }))
  ctx.patchSignals({ nickname: "" })
})

const toggleRunning = app.action("toggleRunning", (ctx) => {
  const store = ctx.getStore()
  console.log(`🟠 [toggleRunning] ${store.running} → ${!store.running}`)
  addLog(ctx, "🟠", "Action", `toggleRunning: ${store.running ? "STOP" : "START"}`)
  ctx.update((s) => ({ ...s, running: !s.running }))
})

const reset = app.action("reset", (ctx) => {
  console.log(`🔴 [reset] Resetting all state`)
  addLog(ctx, "🔴", "Action", "reset: Clearing all state")
  ctx.update((s) => ({
    ...s,
    count: 0,
    frame: 0,
    fps: 0,
    users: [],
    running: false,
  }))
})

const clearLogs = app.action("clearLogs", (ctx) => {
  ctx.update((s) => ({ ...s, logs: [] }))
})

// ============================================================================
// Repeat - Game Loop Style (conditional execution + FPS tracking)
// ============================================================================

app.repeat("game-ticker", {
  every: 100, // 10 FPS target
  when: (s) => s.running,
  trackFps: true,
  handler: (ctx) => {
    const store = ctx.getStore()
    if (store.frame % 10 === 0) {
      // Log every 10 frames
      console.log(`🔄 [Repeat] Frame ${store.frame} - FPS: ${ctx.fps.toFixed(1)}`)
      addLog(ctx, "🔄", "Repeat", `Frame ${store.frame} - FPS: ${ctx.fps.toFixed(1)}`)
    }
    ctx.update((s) => ({ ...s, frame: s.frame + 1, fps: ctx.fps }))
  },
})

// ============================================================================
// Repeat - Simple Repeating (heartbeat)
// ============================================================================

app.repeat("heartbeat", {
  every: "5 seconds",
  handler: (ctx) => {
    const now = Date.now()
    console.log(`💓 [Repeat] Heartbeat`)
    addLog(ctx, "💓", "Repeat", "Heartbeat pulse")
    ctx.update((s) => ({ ...s, lastHeartbeat: now }))
  },
})

// ============================================================================
// Cron - Scheduled Jobs
// ============================================================================

app.cron("cleanup", {
  every: "1 minute",
  handler: (ctx) => {
    const store = ctx.getStore()
    console.log(`🧹 [Cron] Cleanup - ${store.users.length} users, count=${store.count}`)
    addLog(ctx, "🧹", "Cron", `Cleanup check: ${store.users.length} users, count=${store.count}`)
  },
})

app.cron("user-sync", {
  every: "30 seconds",
  forEachUser: (ctx) => {
    const now = Date.now()
    console.log(`👥 [Cron] User sync - session ${ctx.sessionId.slice(0, 8)}...`)
    ctx.updateUser((u) => ({ ...u, lastSeen: now }))
  },
})

// ============================================================================
// Triggers - React to Store Changes
// ============================================================================

app.trigger("count-changed", {
  watch: (s) => s.count,
  handler: (ctx, { oldValue, newValue }) => {
    const diff = newValue - oldValue
    console.log(`🎯 [Trigger] Count ${diff > 0 ? "+" : ""}${diff} (${oldValue} → ${newValue})`)
    addLog(ctx, "🎯", "Trigger", `count: ${diff > 0 ? "+" : ""}${diff} (${oldValue} → ${newValue})`)
  },
})

app.trigger("running-changed", {
  watch: (s) => s.running,
  handler: (ctx, { newValue }) => {
    console.log(`🎯 [Trigger] Running: ${newValue ? "▶️ STARTED" : "⏹️ STOPPED"}`)
    addLog(ctx, "🎯", "Trigger", `running: ${newValue ? "▶️ STARTED" : "⏹️ STOPPED"}`)
  },
})

app.userTrigger("mycount-changed", {
  watch: (u) => u.myCount,
  handler: (ctx, { oldValue, newValue, sessionId }) => {
    console.log(`🎯 [UserTrigger] myCount ${oldValue} → ${newValue} for ${sessionId.slice(0, 8)}...`)
    addLog(ctx, "👤", "UserTrigger", `myCount: ${oldValue} → ${newValue}`)
  },
})

// ============================================================================
// Components
// ============================================================================

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div class={`p-3 rounded-lg ${color}`}>
      <div class="text-xs font-medium opacity-70">{label}</div>
      <div class="text-xl font-bold">{value}</div>
    </div>
  )
}

function LogEntry({ log }: { log: Store["logs"][0] }) {
  return (
    <div class="flex gap-2 text-sm py-1 border-b border-gray-100 last:border-0">
      <span class="text-gray-400 font-mono text-xs w-20">{log.time}</span>
      <span>{log.emoji}</span>
      <span class="text-gray-500 w-24">[{log.source}]</span>
      <span class="flex-1">{log.message}</span>
    </div>
  )
}

// ============================================================================
// App Config
// ============================================================================

const server = app.app({
  store: {
    count: 0,
    frame: 0,
    fps: 0,
    users: [],
    lastHeartbeat: Date.now(),
    running: false,
    logs: [],
  },
  userStore: {
    nickname: "Anonymous",
    myCount: 0,
    lastSeen: Date.now(),
  },
  signals: {
    nickname: "",
    amount: 5,
    showLogs: true,
  },

  title: ({ store }) => `DSL Test - Count: ${store.count} | Frame: ${store.frame}`,

  view: (ctx) => {
    const timeSinceHeartbeat = Math.floor((Date.now() - ctx.store.lastHeartbeat) / 1000)

    return (
      <div id="app" class="min-h-screen bg-gray-50 p-6">
        <div class="max-w-4xl mx-auto">
          {/* Header */}
          <div class="mb-6">
            <h1 class="text-3xl font-bold text-gray-900">Hyperstar DSL Test</h1>
            <p class="text-gray-500">Factory pattern with timers, intervals, crons, and triggers</p>
          </div>

          {/* Stats Grid */}
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard label="Global Count" value={ctx.store.count} color="bg-blue-100 text-blue-800" />
            <StatCard label="Frame" value={ctx.store.frame} color="bg-purple-100 text-purple-800" />
            <StatCard
              label="FPS"
              value={ctx.store.running ? ctx.store.fps.toFixed(1) : "—"}
              color="bg-green-100 text-green-800"
            />
            <StatCard
              label="Heartbeat"
              value={`${timeSinceHeartbeat}s ago`}
              color="bg-red-100 text-red-800"
            />
          </div>

          {/* Main Panels */}
          <div class="grid md:grid-cols-2 gap-6 mb-6">
            {/* Global Actions */}
            <div class="bg-white rounded-xl shadow-sm p-6">
              <h2 class="font-bold text-lg mb-4 flex items-center gap-2">
                <span class="w-3 h-3 rounded-full bg-blue-500" />
                Global Store
              </h2>

              <div class="space-y-3">
                {/* Increment buttons */}
                <div class="flex gap-2">
                  <button
                    $={hs.action(increment)}
                    class="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                  >
                    +1
                  </button>
                  <button
                    $={hs.action(addAmount, { amount })}
                    class="flex-1 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors"
                  >
                    +<span hs-text="$amount.value" />
                  </button>
                </div>

                {/* Amount slider */}
                <div>
                  <label class="text-sm text-gray-500 mb-1 block">
                    Amount: <span hs-text="$amount.value" class="font-mono" />
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    $={hs.bind(amount)}
                    class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                {/* Timer toggle */}
                <button
                  $={hs.action(toggleRunning)}
                  class={`w-full px-4 py-3 rounded-lg font-medium transition-colors ${
                    ctx.store.running
                      ? "bg-yellow-500 hover:bg-yellow-600 text-white"
                      : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                  }`}
                >
                  {ctx.store.running ? "⏹️ Stop Timer" : "▶️ Start Timer"}
                </button>

                {/* Reset */}
                <button
                  $={hs.action(reset)}
                  class="w-full px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
                >
                  Reset All
                </button>
              </div>
            </div>

            {/* User Session */}
            <div class="bg-white rounded-xl shadow-sm p-6">
              <h2 class="font-bold text-lg mb-4 flex items-center gap-2">
                <span class="w-3 h-3 rounded-full bg-green-500" />
                Your Session
              </h2>

              <div class="space-y-3">
                {/* Session info */}
                <div class="text-sm text-gray-500">
                  <p>
                    Session: <code class="bg-gray-100 px-1 rounded">{ctx.session.id.slice(0, 8)}...</code>
                  </p>
                  <p>
                    Nickname: <span class="font-medium text-gray-900">{ctx.userStore.nickname}</span>
                  </p>
                </div>

                {/* Your count */}
                <div class="p-4 bg-green-50 rounded-lg text-center">
                  <div class="text-3xl font-bold text-green-600">{ctx.userStore.myCount}</div>
                  <div class="text-sm text-green-600">Your Personal Count</div>
                </div>

                <button
                  $={hs.action(incrementMine)}
                  class="w-full px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                >
                  +1 Mine
                </button>

                {/* Nickname input */}
                <div class="flex gap-2">
                  <input
                    type="text"
                    placeholder="New nickname..."
                    $={hs.bind(nickname)}
                    class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <button
                    $={hs.action(setNickname, { nickname })}
                    hs-show={nickname.isNotEmpty()}
                    class="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                  >
                    Set
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Scheduled Tasks Info */}
          <div class="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h2 class="font-bold text-lg mb-4">Background Tasks</h2>
            <div class="grid md:grid-cols-3 gap-4 text-sm">
              <div class="p-3 bg-gray-50 rounded-lg">
                <div class="font-medium">🔄 Repeat (game-ticker)</div>
                <div class="text-gray-500">every: 100ms, {ctx.store.running ? "RUNNING" : "PAUSED"}</div>
                <div class="text-gray-400">Tracks FPS, increments frame</div>
              </div>
              <div class="p-3 bg-gray-50 rounded-lg">
                <div class="font-medium">💓 Repeat (heartbeat)</div>
                <div class="text-gray-500">every: 5 seconds</div>
                <div class="text-gray-400">Updates lastHeartbeat timestamp</div>
              </div>
              <div class="p-3 bg-gray-50 rounded-lg">
                <div class="font-medium">🧹 Cron (cleanup)</div>
                <div class="text-gray-500">every: 1 minute</div>
                <div class="text-gray-400">Logs current state summary</div>
              </div>
            </div>
          </div>

          {/* Activity Log */}
          <div class="bg-white rounded-xl shadow-sm p-6">
            <div class="flex justify-between items-center mb-4">
              <h2 class="font-bold text-lg">Activity Log</h2>
              <div class="flex gap-2">
                <button
                  hs-on:click={showLogs.toggle()}
                  class="text-sm text-gray-500 hover:text-gray-700"
                >
                  <span hs-show={showLogs.expr}>Hide</span>
                  <span hs-show={`!${showLogs.expr}`}>Show</span>
                </button>
                <button
                  $={hs.action(clearLogs)}
                  class="text-sm text-red-500 hover:text-red-700"
                >
                  Clear
                </button>
              </div>
            </div>

            <div hs-show={showLogs.expr} class="max-h-64 overflow-y-auto">
              {ctx.store.logs.length === 0 ? (
                <p class="text-gray-400 text-center py-4">No activity yet. Click some buttons!</p>
              ) : (
                ctx.store.logs.map((log) => <LogEntry log={log} />)
              )}
            </div>
          </div>

          {/* Footer */}
          <footer class="mt-6 text-center text-gray-400 text-sm">
            <p>Repeats, crons, and triggers all running in the background</p>
            <p>Open in multiple tabs to see real-time sync!</p>
          </footer>
        </div>
      </div>
    )
  },
}).serve({ port: 3001 })

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║              DSL Test - Factory Pattern (JSX)                 ║
╠═══════════════════════════════════════════════════════════════╣
║  http://localhost:${server.port}                                    ║
║                                                               ║
║  Background Tasks:                                            ║
║  • Repeat: 100ms game loop with FPS tracking                  ║
║  • Repeat: 5s heartbeat                                       ║
║  • Cron: 1m cleanup, 30s user sync                            ║
║  • Triggers: count, running, myCount changes                  ║
║                                                               ║
║  Actions are defined FIRST, then referenced in view:          ║
║  • hs.action(increment) - no string IDs!                      ║
║  • hs.action(addAmount, { amount }) (signal handle!)          ║
╚═══════════════════════════════════════════════════════════════╝
`)

process.on("SIGINT", async () => {
  console.log("\nShutting down...")
  await server.stop()
  process.exit(0)
})
