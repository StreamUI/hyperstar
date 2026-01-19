/**
 * Hyperstar v3 - State Types Example
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
import { createHyperstar, UI, on, $, Schema } from "hyperstar"

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
  messageInput: string
  nicknameInput: string
  showDetails: boolean
}

// ============================================================================
// Create Factory
// ============================================================================

const hs = createHyperstar<Store, UserStore, Signals>()

// ============================================================================
// Signals - Client-side ephemeral state
// ============================================================================

const { messageInput, nicknameInput, showDetails } = hs.signals

// ============================================================================
// Actions - Show how each type of state is updated
// ============================================================================

// Global store actions (affects everyone)
const incrementGlobal = hs.action("incrementGlobal", (ctx) => {
  ctx.update((s) => ({ ...s, globalCounter: s.globalCounter + 1 }))
})

const addMessage = hs.action("addMessage", { text: Schema.String }, (ctx, { text }) => {
  if (!text.trim()) return
  const nickname = ctx.getUserStore().nickname || "Anonymous"
  ctx.update((s) => ({
    ...s,
    messages: [...s.messages.slice(-9), `${nickname}: ${text}`],
  }))
  ctx.patchSignals({ messageInput: "" }) // Clear input after sending
})

const clearMessages = hs.action("clearMessages", (ctx) => {
  ctx.update((s) => ({ ...s, messages: [] }))
})

// User store actions (affects only this session)
const toggleTheme = hs.action("toggleTheme", (ctx) => {
  ctx.updateUserStore((u) => ({
    ...u,
    theme: u.theme === "light" ? "dark" : "light",
  }))
})

const incrementPrivate = hs.action("incrementPrivate", (ctx) => {
  ctx.updateUserStore((u) => ({
    ...u,
    privateCounter: u.privateCounter + 1,
  }))
})

const setNickname = hs.action("setNickname", { nickname: Schema.String }, (ctx, { nickname }) => {
  ctx.updateUserStore((u) => ({ ...u, nickname }))
})

// ============================================================================
// App Config
// ============================================================================

const server = hs.app({
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
  signals: { messageInput: "", nicknameInput: "", showDetails: false },

  title: ({ store }) => `State Types Demo (${store.onlineUsers} online)`,

  // Track online users
  onConnect: (ctx) => ctx.update((s) => ({ ...s, onlineUsers: s.onlineUsers + 1 })),
  onDisconnect: (ctx) => ctx.update((s) => ({ ...s, onlineUsers: s.onlineUsers - 1 })),

  view: (ctx) => {
    const { theme } = ctx.userStore
    const isDark = theme === "dark"

    return UI.div(
      {
        attrs: {
          id: "app",
          class: `min-h-screen transition-colors ${
            isDark ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-900"
          }`,
        },
      },
      UI.div(
        { attrs: { class: "max-w-4xl mx-auto p-8" } },

        // Header
        UI.div(
          { attrs: { class: "flex justify-between items-center mb-8" } },
          UI.div(
            {},
            UI.h1({ attrs: { class: "text-3xl font-bold" } }, "State Types Demo"),
            UI.p(
              { attrs: { class: isDark ? "text-gray-400" : "text-gray-600" } },
              "Understanding Global, User, and Signal state",
            ),
          ),
          UI.div(
            { attrs: { class: "flex items-center gap-4" } },
            UI.span(
              { attrs: { class: "text-sm" } },
              `${ctx.store.onlineUsers} online`,
            ),
            UI.button(
              {
                attrs: {
                  class: `px-4 py-2 rounded-lg font-medium ${
                    isDark
                      ? "bg-yellow-500 text-black"
                      : "bg-gray-800 text-white"
                  }`,
                },
                events: { click: on.action(toggleTheme) },
              },
              isDark ? "Light Mode" : "Dark Mode",
            ),
          ),
        ),

        // Session info
        UI.p(
          { attrs: { class: `text-sm mb-6 ${isDark ? "text-gray-500" : "text-gray-500"}` } },
          `Session: ${ctx.session.id.slice(0, 8)}...`,
        ),

        // Three columns
        UI.div(
          { attrs: { class: "grid grid-cols-1 md:grid-cols-3 gap-6" } },

          // ═══════════════════════════════════════════════════════════════════
          // Column 1: GLOBAL STORE
          // ═══════════════════════════════════════════════════════════════════
          UI.div(
            {
              attrs: {
                class: `p-6 rounded-xl ${isDark ? "bg-blue-900/30 border border-blue-700" : "bg-blue-50 border border-blue-200"}`,
              },
            },
            UI.div(
              { attrs: { class: "flex items-center gap-2 mb-4" } },
              UI.span({ attrs: { class: "text-2xl" } }, "🌍"),
              UI.h2({ attrs: { class: "text-xl font-bold text-blue-500" } }, "Global Store"),
            ),
            UI.p(
              { attrs: { class: `text-sm mb-4 ${isDark ? "text-gray-400" : "text-gray-600"}` } },
              "Server-side, shared by ALL users. Changes broadcast everywhere.",
            ),

            // Global counter
            UI.div(
              { attrs: { class: "mb-4" } },
              UI.p({ attrs: { class: "text-sm font-medium mb-1" } }, "Global Counter"),
              UI.div(
                { attrs: { class: "flex items-center gap-3" } },
                UI.span(
                  { attrs: { class: "text-4xl font-bold text-blue-500 tabular-nums" } },
                  String(ctx.store.globalCounter),
                ),
                UI.button(
                  {
                    attrs: {
                      class:
                        "px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium",
                    },
                    events: { click: on.action(incrementGlobal) },
                  },
                  "+1 (Everyone sees this!)",
                ),
              ),
            ),

            // Messages
            UI.div(
              {},
              UI.p({ attrs: { class: "text-sm font-medium mb-2" } }, "Global Messages"),
              UI.div(
                {
                  attrs: {
                    class: `h-32 overflow-y-auto rounded-lg p-2 mb-2 ${isDark ? "bg-gray-800" : "bg-white border"}`,
                  },
                },
                ctx.store.messages.length === 0
                  ? UI.p(
                      { attrs: { class: "text-gray-400 text-sm" } },
                      "No messages yet",
                    )
                  : UI.fragment(
                      ...ctx.store.messages.map((msg, i) =>
                        UI.p(
                          { attrs: { id: `msg-${i}`, class: "text-sm" } },
                          msg,
                        ),
                      ),
                    ),
              ),
              UI.div(
                { attrs: { class: "flex gap-2" } },
                UI.input({
                  attrs: {
                    type: "text",
                    placeholder: "Type a message...",
                    class: `flex-1 px-3 py-2 rounded-lg border ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-300"}`,
                    "hs-bind": "messageInput",
                  },
                }),
                UI.button(
                  {
                    attrs: {
                      class:
                        "px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg",
                      "hs-show": messageInput.isNotEmpty().toString(),
                    },
                    events: {
                      click: on.action(addMessage, { text: $.signal("messageInput") }),
                    },
                  },
                  "Send",
                ),
              ),
            ),
          ),

          // ═══════════════════════════════════════════════════════════════════
          // Column 2: USER STORE
          // ═══════════════════════════════════════════════════════════════════
          UI.div(
            {
              attrs: {
                class: `p-6 rounded-xl ${isDark ? "bg-green-900/30 border border-green-700" : "bg-green-50 border border-green-200"}`,
              },
            },
            UI.div(
              { attrs: { class: "flex items-center gap-2 mb-4" } },
              UI.span({ attrs: { class: "text-2xl" } }, "👤"),
              UI.h2({ attrs: { class: "text-xl font-bold text-green-500" } }, "User Store"),
            ),
            UI.p(
              { attrs: { class: `text-sm mb-4 ${isDark ? "text-gray-400" : "text-gray-600"}` } },
              "Server-side, per-session. Only YOU see these changes.",
            ),

            // Theme (from user store)
            UI.div(
              { attrs: { class: "mb-4" } },
              UI.p({ attrs: { class: "text-sm font-medium mb-1" } }, "Theme Preference"),
              UI.p(
                { attrs: { class: "text-green-500 font-bold" } },
                ctx.userStore.theme.toUpperCase(),
              ),
            ),

            // Private counter
            UI.div(
              { attrs: { class: "mb-4" } },
              UI.p({ attrs: { class: "text-sm font-medium mb-1" } }, "Private Counter"),
              UI.div(
                { attrs: { class: "flex items-center gap-3" } },
                UI.span(
                  { attrs: { class: "text-4xl font-bold text-green-500 tabular-nums" } },
                  String(ctx.userStore.privateCounter),
                ),
                UI.button(
                  {
                    attrs: {
                      class:
                        "px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium",
                    },
                    events: { click: on.action(incrementPrivate) },
                  },
                  "+1 (Only you!)",
                ),
              ),
            ),

            // Nickname
            UI.div(
              {},
              UI.p({ attrs: { class: "text-sm font-medium mb-1" } }, "Your Nickname"),
              UI.div(
                { attrs: { class: "flex gap-2" } },
                UI.input({
                  attrs: {
                    type: "text",
                    placeholder: "Enter nickname...",
                    class: `flex-1 px-3 py-2 rounded-lg border ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-300"}`,
                    "hs-bind": "nicknameInput",
                  },
                }),
                UI.button(
                  {
                    attrs: {
                      class:
                        "px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg",
                    },
                    events: {
                      click: on.action(setNickname, { nickname: $.signal("nicknameInput") }),
                    },
                  },
                  "Set",
                ),
              ),
              ctx.userStore.nickname
                ? UI.p(
                    { attrs: { class: "text-sm text-green-500 mt-2" } },
                    `Current: ${ctx.userStore.nickname}`,
                  )
                : UI.empty(),
            ),
          ),

          // ═══════════════════════════════════════════════════════════════════
          // Column 3: SIGNALS (Client-side)
          // ═══════════════════════════════════════════════════════════════════
          UI.div(
            {
              attrs: {
                class: `p-6 rounded-xl ${isDark ? "bg-purple-900/30 border border-purple-700" : "bg-purple-50 border border-purple-200"}`,
              },
            },
            UI.div(
              { attrs: { class: "flex items-center gap-2 mb-4" } },
              UI.span({ attrs: { class: "text-2xl" } }, "⚡"),
              UI.h2({ attrs: { class: "text-xl font-bold text-purple-500" } }, "Signals"),
            ),
            UI.p(
              { attrs: { class: `text-sm mb-4 ${isDark ? "text-gray-400" : "text-gray-600"}` } },
              "Client-side only. Fast, ephemeral, no server roundtrip.",
            ),

            // Show details toggle
            UI.div(
              { attrs: { class: "mb-4" } },
              UI.p({ attrs: { class: "text-sm font-medium mb-2" } }, "UI Toggle (Signal)"),
              UI.button(
                {
                  attrs: {
                    class:
                      "px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium",
                  },
                  events: {
                    click: on.script("$showDetails.value = !$showDetails.value"),
                  },
                },
                "Toggle Details",
              ),
              UI.div(
                {
                  attrs: {
                    class: `mt-3 p-3 rounded-lg ${isDark ? "bg-gray-800" : "bg-white border"}`,
                    "hs-show": "$showDetails.value",
                  },
                },
                UI.p({ attrs: { class: "text-sm" } }, "This content is controlled by a signal."),
                UI.p({ attrs: { class: "text-sm text-purple-500" } }, "No server roundtrip needed!"),
              ),
            ),

            // Input preview
            UI.div(
              {},
              UI.p({ attrs: { class: "text-sm font-medium mb-2" } }, "Live Input Preview"),
              UI.input({
                attrs: {
                  type: "text",
                  placeholder: "Type something...",
                  class: `w-full px-3 py-2 rounded-lg border mb-2 ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-300"}`,
                  "hs-bind": "nicknameInput",
                },
              }),
              UI.p(
                { attrs: { class: "text-sm" } },
                "You typed: ",
                UI.span(
                  { attrs: { class: "text-purple-500 font-mono", "hs-text": "$nicknameInput.value" } },
                  "",
                ),
              ),
            ),
          ),
        ),

        // Legend
        UI.div(
          { attrs: { class: `mt-8 p-4 rounded-xl ${isDark ? "bg-gray-800" : "bg-white border"}` } },
          UI.h3({ attrs: { class: "font-bold mb-3" } }, "When to use each type:"),
          UI.div(
            { attrs: { class: "grid grid-cols-1 md:grid-cols-3 gap-4 text-sm" } },
            UI.div(
              {},
              UI.p({ attrs: { class: "font-bold text-blue-500" } }, "Global Store"),
              UI.ul(
                { attrs: { class: isDark ? "text-gray-400" : "text-gray-600" } },
                UI.li({}, "• Shared counters"),
                UI.li({}, "• Chat messages"),
                UI.li({}, "• Collaborative data"),
              ),
            ),
            UI.div(
              {},
              UI.p({ attrs: { class: "font-bold text-green-500" } }, "User Store"),
              UI.ul(
                { attrs: { class: isDark ? "text-gray-400" : "text-gray-600" } },
                UI.li({}, "• Theme preference"),
                UI.li({}, "• User settings"),
                UI.li({}, "• Session state"),
              ),
            ),
            UI.div(
              {},
              UI.p({ attrs: { class: "font-bold text-purple-500" } }, "Signals"),
              UI.ul(
                { attrs: { class: isDark ? "text-gray-400" : "text-gray-600" } },
                UI.li({}, "• Form inputs"),
                UI.li({}, "• UI toggles"),
                UI.li({}, "• Instant feedback"),
              ),
            ),
          ),
        ),
      ),
    )
  },
}).serve({ port: 3016 })

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                   State Types Demo                            ║
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
