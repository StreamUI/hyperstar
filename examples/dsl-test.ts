/**
 * Hyperstar v3 - DSL Test Example
 *
 * Demonstrates the factory pattern:
 * 1. Create factory with createHyperstar<Store, UserStore>()
 * 2. Define actions, timers, intervals, crons, triggers
 * 3. Call .app({ store, view }) - view can reference action variables!
 * 4. Call .serve()
 */
import { createHyperstar, UI, on, Schema } from "hyperstar"

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
}

interface UserStore {
  nickname: string
  myCount: number
  lastSeen: number
}

// ============================================================================
// Create Factory
// ============================================================================

const hs = createHyperstar<Store, UserStore>()

// ============================================================================
// Actions - Define FIRST so view can reference them
// ============================================================================

const increment = hs.action("increment", (ctx) => {
  const store = ctx.getStore()
  console.log(`🔵 [increment] ${store.count} → ${store.count + 1}`)
  ctx.update((s) => ({ ...s, count: s.count + 1 }))
})

const addAmount = hs.action("addAmount", { amount: Schema.Number }, (ctx, { amount }) => {
  const store = ctx.getStore()
  console.log(`🟣 [addAmount] Adding ${amount} to ${store.count}`)
  ctx.update((s) => ({ ...s, count: s.count + amount }))
})

const incrementMine = hs.action("incrementMine", (ctx) => {
  const userStore = ctx.getUserStore()
  console.log(`🟢 [incrementMine] ${userStore.myCount} → ${userStore.myCount + 1}`)
  ctx.updateUserStore((u) => ({ ...u, myCount: u.myCount + 1 }))
})

const setNickname = hs.action("setNickname", { nickname: Schema.String }, (ctx, { nickname }) => {
  console.log(`🟡 [setNickname] → "${nickname}"`)
  ctx.updateUserStore((u) => ({ ...u, nickname }))
})

const toggleRunning = hs.action("toggleRunning", (ctx) => {
  const store = ctx.getStore()
  console.log(`🟠 [toggleRunning] ${store.running} → ${!store.running}`)
  ctx.update((s) => ({ ...s, running: !s.running }))
})

const addUser = hs.action("addUser", (ctx) => {
  const userId = `user-${Date.now()}`
  console.log(`🔴 [addUser] Adding ${userId}`)
  ctx.update((s) => ({ ...s, users: [...s.users, userId] }))
})

// Suppress unused warning
void setNickname

// ============================================================================
// Timer - Game Loop Style
// ============================================================================

hs.timer("game-ticker", {
  interval: 1000,
  when: (s) => s.running,
  trackFps: true,
  handler: (ctx) => {
    console.log(`⏱️ [Timer] Tick - FPS: ${ctx.fps.toFixed(1)}`)
    ctx.update((s) => ({ ...s, frame: s.frame + 1, fps: ctx.fps }))
  },
})

// ============================================================================
// Interval - Simple Repeating
// ============================================================================

hs.interval("heartbeat", {
  every: "5 seconds",
  handler: (ctx) => {
    const now = Date.now()
    console.log(`💓 [Interval] Heartbeat`)
    ctx.update((s) => ({ ...s, lastHeartbeat: now }))
  },
})

// ============================================================================
// Cron - Scheduled Jobs
// ============================================================================

hs.cron("cleanup", {
  schedule: "1 minute",
  handler: (ctx) => {
    const store = ctx.getStore()
    console.log(`🧹 [Cron] Cleanup - ${store.users.length} users, count=${store.count}`)
  },
})

hs.cron("user-sync", {
  schedule: "30 seconds",
  forEachUser: (ctx) => {
    const now = Date.now()
    console.log(`👥 [Cron] User sync - session ${ctx.sessionId.slice(0, 8)}...`)
    ctx.updateUser((u) => ({ ...u, lastSeen: now }))
  },
})

// ============================================================================
// Triggers - React to Store Changes
// ============================================================================

hs.trigger("count-changed", {
  watch: (s) => s.count,
  handler: (_ctx, { oldValue, newValue }) => {
    const diff = newValue - oldValue
    console.log(`🎯 [Trigger] Count ${diff > 0 ? "+" : ""}${diff} (${oldValue} → ${newValue})`)
  },
})

hs.trigger("running-changed", {
  watch: (s) => s.running,
  handler: (_ctx, { newValue }) => {
    console.log(`🎯 [Trigger] Running: ${newValue ? "▶️ STARTED" : "⏹️ STOPPED"}`)
  },
})

hs.userTrigger("mycount-changed", {
  watch: (u) => u.myCount,
  handler: (_ctx, { oldValue, newValue, sessionId }) => {
    console.log(`🎯 [UserTrigger] myCount ${oldValue} → ${newValue} for ${sessionId.slice(0, 8)}...`)
  },
})

// ============================================================================
// App Config - View can reference action variables!
// ============================================================================

const server = hs.app({
  store: {
    count: 0,
    frame: 0,
    fps: 0,
    users: [],
    lastHeartbeat: Date.now(),
    running: false,
  },
  userStore: {
    nickname: "Anonymous",
    myCount: 0,
    lastSeen: Date.now(),
  },

  view: (ctx) =>
    UI.div({ attrs: { id: "app", class: "p-4" } },
      UI.h1({ attrs: { class: "text-2xl font-bold mb-4" } }, "DSL Test - Factory Pattern"),

      // Global store display
      UI.div({ attrs: { class: "mb-4 p-4 bg-gray-100 rounded" } },
        UI.h2({ attrs: { class: "font-bold" } }, "Global Store"),
        UI.p({}, `Count: ${ctx.store.count}`),
        UI.p({}, `Frame: ${ctx.store.frame}`),
        UI.p({}, `FPS: ${ctx.store.fps.toFixed(1)}`),
        UI.p({}, `Users: ${ctx.store.users.length}`),
        UI.p({}, `Running: ${ctx.store.running}`),
      ),

      // User store display
      UI.div({ attrs: { class: "mb-4 p-4 bg-blue-100 rounded" } },
        UI.h2({ attrs: { class: "font-bold" } }, "Your Session"),
        UI.p({}, `Session ID: ${ctx.session.id.slice(0, 8)}...`),
        UI.p({}, `Nickname: ${ctx.userStore.nickname}`),
        UI.p({}, `Your Count: ${ctx.userStore.myCount}`),
      ),

      // Action buttons - reference action variables directly!
      UI.div({ attrs: { class: "flex gap-2 mb-4" } },
        UI.button(
          { attrs: { class: "px-4 py-2 bg-blue-500 text-white rounded" }, events: { click: on.action(increment) } },
          "+1 Global",
        ),
        UI.button(
          { attrs: { class: "px-4 py-2 bg-green-500 text-white rounded" }, events: { click: on.action(incrementMine) } },
          "+1 Mine",
        ),
        UI.button(
          { attrs: { class: "px-4 py-2 bg-purple-500 text-white rounded" }, events: { click: on.action(addAmount, { amount: 5 }) } },
          "+5 Global",
        ),
        UI.button(
          { attrs: { class: "px-4 py-2 bg-yellow-500 text-white rounded" }, events: { click: on.action(toggleRunning) } },
          ctx.store.running ? "Stop Timer" : "Start Timer",
        ),
        UI.button(
          { attrs: { class: "px-4 py-2 bg-red-500 text-white rounded" }, events: { click: on.action(addUser) } },
          "Add User",
        ),
      ),
    ),
}).serve({ port: 3001 })

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║              DSL Test - Factory Pattern                       ║
╠═══════════════════════════════════════════════════════════════╣
║  http://localhost:${server.port}                                    ║
║                                                               ║
║  Actions are defined FIRST, then referenced in view:          ║
║  • on.action(increment) - no string IDs!                      ║
║  • on.action(addAmount, { amount: 5 }) - with args            ║
╚═══════════════════════════════════════════════════════════════╝
`)
