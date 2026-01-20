/**
 * Hyperstar v3 - State Types Example (JSX Version)
 *
 * Demonstrates the three types of state in Hyperstar:
 *
 * 1. GLOBAL STORE (Server-side, shared across all users)
 *    - Persisted on server
 *    - Changes broadcast to ALL connected clients
 *    - Use for: shared data, global counters, public lists
 *
 * 2. USER STORE (Server-side, per-session)
 *    - Persisted on server per session
 *    - Changes only affect that user's view
 *    - Use for: user preferences, theme, session-specific state
 *
 * 3. SIGNALS (Client-side, ephemeral)
 *    - Lives in browser memory
 *    - Not persisted, not shared
 *    - Use for: form inputs, UI toggles, temporary state
 */
import { createHyperstar, hs, Schema } from "hyperstar"

// ============================================================================
// Store Types
// ============================================================================

/**
 * Global Store - shared by ALL users
 * Changes here broadcast to everyone!
 */
interface Store {
  globalCounter: number
  messages: string[]
  onlineUsers: number
}

/**
 * User Store - per-session, isolated
 * Each browser tab has its own copy
 */
interface UserStore {
  theme: "light" | "dark"
  privateCounter: number
  nickname: string
}

interface Signals {
  text: string
  nickname: string
  showDetails: boolean
}

// ============================================================================
// Create Factory
// ============================================================================

const app = createHyperstar<Store, UserStore, Signals>()

// ============================================================================
// Signals - Client-side ephemeral state
// ============================================================================

const { text, nickname, showDetails } = app.signals

// ============================================================================
// Actions - Show how each type of state is updated
// ============================================================================

// Global store actions (affects everyone)
const incrementGlobal = app.action("incrementGlobal", (ctx) => {
  ctx.update((s) => ({ ...s, globalCounter: s.globalCounter + 1 }))
})

const addMessage = app.action("addMessage", { text: Schema.String }, (ctx, { text }) => {
  if (!text.trim()) return
  const nickname = ctx.getUserStore().nickname || "Anonymous"
  ctx.update((s) => ({
    ...s,
    messages: [...s.messages.slice(-9), `${nickname}: ${text}`],
  }))
  ctx.patchSignals({ text: "" })
})

const clearMessages = app.action("clearMessages", (ctx) => {
  ctx.update((s) => ({ ...s, messages: [] }))
})

// User store actions (affects only this session)
const toggleTheme = app.action("toggleTheme", (ctx) => {
  ctx.updateUserStore((u) => ({
    ...u,
    theme: u.theme === "light" ? "dark" : "light",
  }))
})

const incrementPrivate = app.action("incrementPrivate", (ctx) => {
  ctx.updateUserStore((u) => ({
    ...u,
    privateCounter: u.privateCounter + 1,
  }))
})

const setNickname = app.action("setNickname", { nickname: Schema.String }, (ctx, { nickname }) => {
  ctx.updateUserStore((u) => ({ ...u, nickname }))
})

// ============================================================================
// App Config
// ============================================================================

const server = app.app({
  // Initial global state (shared)
  store: {
    globalCounter: 0,
    messages: [],
    onlineUsers: 0,
  },

  // Initial user state (per-session)
  userStore: {
    theme: "light" as const,
    privateCounter: 0,
    nickname: "",
  },

  // Client-side signals
  signals: { text: "", nickname: "", showDetails: false },

  title: ({ store }) => `State Types Demo (${store.onlineUsers} online)`,

  // Track online users
  onConnect: (ctx) => ctx.update((s) => ({ ...s, onlineUsers: s.onlineUsers + 1 })),
  onDisconnect: (ctx) => ctx.update((s) => ({ ...s, onlineUsers: s.onlineUsers - 1 })),

  view: (ctx) => {
    const { theme } = ctx.userStore
    const isDark = theme === "dark"

    return (
      <div
        id="app"
        class={`min-h-screen transition-colors ${isDark ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-900"}`}
      >
        <div class="max-w-4xl mx-auto p-8">
          {/* Header */}
          <div class="flex justify-between items-center mb-8">
            <div>
              <h1 class="text-3xl font-bold">State Types Demo</h1>
              <p class={isDark ? "text-gray-400" : "text-gray-600"}>
                Understanding Global, User, and Signal state
              </p>
            </div>
            <div class="flex items-center gap-4">
              <span class="text-sm">{ctx.store.onlineUsers} online</span>
              <button
                $={hs.action(toggleTheme)}
                class={`px-4 py-2 rounded-lg font-medium ${isDark ? "bg-yellow-500 text-black" : "bg-gray-800 text-white"}`}
              >
                {isDark ? "Light Mode" : "Dark Mode"}
              </button>
            </div>
          </div>

          {/* Session info */}
          <p class={`text-sm mb-6 ${isDark ? "text-gray-500" : "text-gray-500"}`}>
            Session: {ctx.session.id.slice(0, 8)}...
          </p>

          {/* Three columns */}
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Column 1: GLOBAL STORE */}
            <div class={`p-6 rounded-xl ${isDark ? "bg-blue-900/30 border border-blue-700" : "bg-blue-50 border border-blue-200"}`}>
              <div class="flex items-center gap-2 mb-4">
                <span class="text-2xl">🌍</span>
                <h2 class="text-xl font-bold text-blue-500">Global Store</h2>
              </div>
              <p class={`text-sm mb-4 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                Server-side, shared by ALL users. Changes broadcast everywhere.
              </p>

              {/* Global counter */}
              <div class="mb-4">
                <p class="text-sm font-medium mb-1">Global Counter</p>
                <div class="flex items-center gap-3">
                  <span class="text-4xl font-bold text-blue-500 tabular-nums">
                    {ctx.store.globalCounter}
                  </span>
                  <button
                    $={hs.action(incrementGlobal)}
                    class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium"
                  >
                    +1 (Everyone sees this!)
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div>
                <p class="text-sm font-medium mb-2">Global Messages</p>
                <div class={`h-32 overflow-y-auto rounded-lg p-2 mb-2 ${isDark ? "bg-gray-800" : "bg-white border"}`}>
                  {ctx.store.messages.length === 0 ? (
                    <p class="text-gray-400 text-sm">No messages yet</p>
                  ) : (
                    ctx.store.messages.map((msg, i) => (
                      <p id={`msg-${i}`} class="text-sm">{msg}</p>
                    ))
                  )}
                </div>
                <form $={hs.form(addMessage)} class="flex gap-2">
                  <input
                    type="text"
                    name="text"
                    placeholder="Type a message..."
                    $={hs.bind(text)}
                    class={`flex-1 px-3 py-2 rounded-lg border ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-300"}`}
                  />
                  <button
                    type="submit"
                    hs-show={text.isNotEmpty()}
                    class="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
                  >
                    Send
                  </button>
                </form>
              </div>
            </div>

            {/* Column 2: USER STORE */}
            <div class={`p-6 rounded-xl ${isDark ? "bg-green-900/30 border border-green-700" : "bg-green-50 border border-green-200"}`}>
              <div class="flex items-center gap-2 mb-4">
                <span class="text-2xl">👤</span>
                <h2 class="text-xl font-bold text-green-500">User Store</h2>
              </div>
              <p class={`text-sm mb-4 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                Server-side, per-session. Only YOU see these changes.
              </p>

              {/* Theme (from user store) */}
              <div class="mb-4">
                <p class="text-sm font-medium mb-1">Theme Preference</p>
                <p class="text-green-500 font-bold">{ctx.userStore.theme.toUpperCase()}</p>
              </div>

              {/* Private counter */}
              <div class="mb-4">
                <p class="text-sm font-medium mb-1">Private Counter</p>
                <div class="flex items-center gap-3">
                  <span class="text-4xl font-bold text-green-500 tabular-nums">
                    {ctx.userStore.privateCounter}
                  </span>
                  <button
                    $={hs.action(incrementPrivate)}
                    class="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium"
                  >
                    +1 (Only you!)
                  </button>
                </div>
              </div>

              {/* Nickname */}
              <div>
                <p class="text-sm font-medium mb-1">Your Nickname</p>
                <form $={hs.form(setNickname)} class="flex gap-2">
                  <input
                    type="text"
                    name="nickname"
                    placeholder="Enter nickname..."
                    $={hs.bind(nickname)}
                    class={`flex-1 px-3 py-2 rounded-lg border ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-300"}`}
                  />
                  <button
                    type="submit"
                    class="px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg"
                  >
                    Set
                  </button>
                </form>
                {ctx.userStore.nickname && (
                  <p class="text-sm text-green-500 mt-2">Current: {ctx.userStore.nickname}</p>
                )}
              </div>
            </div>

            {/* Column 3: SIGNALS (Client-side) */}
            <div class={`p-6 rounded-xl ${isDark ? "bg-purple-900/30 border border-purple-700" : "bg-purple-50 border border-purple-200"}`}>
              <div class="flex items-center gap-2 mb-4">
                <span class="text-2xl">⚡</span>
                <h2 class="text-xl font-bold text-purple-500">Signals</h2>
              </div>
              <p class={`text-sm mb-4 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                Client-side only. Fast, ephemeral, no server roundtrip.
              </p>

              {/* Show details toggle */}
              <div class="mb-4">
                <p class="text-sm font-medium mb-2">UI Toggle (Signal)</p>
                <button
                  hs-on:click={showDetails.toggle()}
                  class="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium"
                >
                  Toggle Details
                </button>
                <div
                  hs-show={showDetails.expr}
                  class={`mt-3 p-3 rounded-lg ${isDark ? "bg-gray-800" : "bg-white border"}`}
                >
                  <p class="text-sm">This content is controlled by a signal.</p>
                  <p class="text-sm text-purple-500">No server roundtrip needed!</p>
                </div>
              </div>

              {/* Input preview */}
              <div>
                <p class="text-sm font-medium mb-2">Live Input Preview</p>
                <input
                  type="text"
                  placeholder="Type something..."
                  $={hs.bind(nickname)}
                  class={`w-full px-3 py-2 rounded-lg border mb-2 ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-300"}`}
                />
                <p class="text-sm">
                  You typed:{" "}
                  <span hs-text={nickname.expr} class="text-purple-500 font-mono" />
                </p>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div class={`mt-8 p-4 rounded-xl ${isDark ? "bg-gray-800" : "bg-white border"}`}>
            <h3 class="font-bold mb-3">When to use each type:</h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p class="font-bold text-blue-500">Global Store</p>
                <ul class={isDark ? "text-gray-400" : "text-gray-600"}>
                  <li>• Shared counters</li>
                  <li>• Chat messages</li>
                  <li>• Collaborative data</li>
                </ul>
              </div>
              <div>
                <p class="font-bold text-green-500">User Store</p>
                <ul class={isDark ? "text-gray-400" : "text-gray-600"}>
                  <li>• Theme preference</li>
                  <li>• User settings</li>
                  <li>• Session state</li>
                </ul>
              </div>
              <div>
                <p class="font-bold text-purple-500">Signals</p>
                <ul class={isDark ? "text-gray-400" : "text-gray-600"}>
                  <li>• Form inputs</li>
                  <li>• UI toggles</li>
                  <li>• Instant feedback</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  },
}).serve({ port: 3017 })

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║               State Types Demo (JSX Version)                  ║
╠═══════════════════════════════════════════════════════════════╣
║  http://localhost:${server.port}                                    ║
║                                                               ║
║  Three types of state:                                        ║
║  • Global Store - Server-side, shared by all                  ║
║  • User Store - Server-side, per-session                      ║
║  • Signals - Client-side, ephemeral                           ║
║                                                               ║
║  Open in multiple tabs to see the difference!                 ║
╚═══════════════════════════════════════════════════════════════╝
`)

process.on("SIGINT", async () => {
  console.log("\nShutting down...")
  await server.stop()
  process.exit(0)
})
