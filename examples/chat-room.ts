/**
 * Hyperstar v3 - Chat Room Example
 *
 * Demonstrates the factory pattern with real-time multi-user chat:
 * - Define actions first, then reference them in view
 * - Global state (shared messages)
 * - Signal binding for input
 */
import { Schema } from "effect"
import { createHyperstar, UI, on, $ } from "hyperstar"

// ============================================================================
// Types
// ============================================================================

interface Message {
  id: string
  username: string
  text: string
  timestamp: string
  color: string
}

interface Store {
  messages: Message[]
}

// ============================================================================
// Helpers
// ============================================================================

const COLORS = [
  "#e74c3c",
  "#3498db",
  "#2ecc71",
  "#9b59b6",
  "#f39c12",
  "#1abc9c",
  "#e91e63",
  "#00bcd4",
]

const userColors = new Map<string, string>()

function getUserColor(username: string): string {
  if (!userColors.has(username)) {
    userColors.set(username, COLORS[Math.floor(Math.random() * COLORS.length)]!)
  }
  return userColors.get(username)!
}

interface Signals {
  username: string
  text: string
}

// ============================================================================
// Create Factory
// ============================================================================

const hs = createHyperstar<Store, {}, Signals>()

// ============================================================================
// Signals - Client-side form state
// ============================================================================

const { username, text } = hs.signals

// ============================================================================
// Actions - Define FIRST
// ============================================================================

const sendMessage = hs.action("sendMessage", {
  username: Schema.String.pipe(Schema.minLength(1)),
  text: Schema.String.pipe(Schema.minLength(1)),
}, (ctx, { username: user, text: msg }) => {
  const newMessage: Message = {
    id: crypto.randomUUID(),
    username: user,
    text: msg,
    timestamp: new Date().toISOString(),
    color: getUserColor(user),
  }

  ctx.update((s) => ({
    ...s,
    messages: [...s.messages, newMessage].slice(-100),
  }))
  ctx.patchSignals({ text: "" }) // Clear the text input after sending
})

const clearMessages = hs.action("clearMessages", (ctx) => {
  ctx.update((s) => ({ ...s, messages: [] }))
})

// ============================================================================
// View Components
// ============================================================================

const MessageItem = (msg: Message) =>
  UI.div(
    {
      attrs: {
        id: `msg-${msg.id}`,
        class: "flex gap-3 items-start",
      },
    },
    UI.div(
      {
        attrs: {
          class:
            "w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0",
          style: `background: ${msg.color};`,
        },
      },
      msg.username.charAt(0).toUpperCase(),
    ),
    UI.div(
      { attrs: { class: "flex-1 min-w-0" } },
      UI.div(
        { attrs: { class: "flex items-baseline gap-2" } },
        UI.span(
          { attrs: { class: "font-semibold", style: `color: ${msg.color};` } },
          msg.username,
        ),
        UI.span(
          { attrs: { class: "text-xs text-gray-400" } },
          new Date(msg.timestamp).toLocaleTimeString(),
        ),
      ),
      UI.p({ attrs: { class: "mt-1 break-words text-gray-700" } }, msg.text),
    ),
  )

// ============================================================================
// App Config
// ============================================================================

const server = hs.app({
  store: { messages: [] },
  signals: { username: "", text: "" },
  title: ({ store }) => `Chat Room (${store.messages.length} messages)`,

  view: (ctx) =>
    UI.div(
      {
        attrs: {
          id: "app",
          class: "max-w-xl mx-auto h-screen flex flex-col bg-white",
        },
      },

      // Header
      UI.header(
        { attrs: { class: "p-4 border-b border-gray-200 bg-gray-50" } },
        UI.div(
          { attrs: { class: "flex justify-between items-center" } },
          UI.div({},
            UI.h1(
              { attrs: { class: "text-2xl font-bold text-gray-900" } },
              "Chat Room",
            ),
            UI.p(
              { attrs: { class: "mt-1 text-sm text-gray-500" } },
              "Open in multiple tabs to chat with yourself!",
            ),
          ),
          ctx.store.messages.length > 0
            ? UI.button(
                {
                  attrs: { class: "text-sm text-gray-500 hover:text-red-500" },
                  events: { click: on.action(clearMessages) },
                },
                "Clear All",
              )
            : UI.empty(),
        ),
      ),

      // Messages area
      UI.div(
        {
          attrs: {
            id: "messages",
            class: "flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-white",
          },
        },
        ctx.store.messages.length === 0
          ? UI.p(
              { attrs: { class: "text-center text-gray-400 mt-8" } },
              "No messages yet. Be the first to say hello!",
            )
          : UI.fragment(...ctx.store.messages.map(MessageItem)),
      ),

      // Input form
      UI.form(
        {
          attrs: { class: "p-4 border-t border-gray-200 bg-gray-50" },
          events: {
            submit: on.prevent(
              on.action(sendMessage, {
                username: $.trim($.signal("username")),
                text: $.trim($.signal("text")),
              }),
            ),
          },
        },
        UI.div(
          { attrs: { class: "flex gap-2" } },
          UI.input({
            attrs: {
              placeholder: "Your name...",
              class:
                "w-28 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
              "hs-bind": "username",
            },
          }),
          UI.input({
            attrs: {
              placeholder: "Type a message...",
              class:
                "flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
              "hs-bind": "text",
            },
          }),
          UI.button(
            {
              attrs: {
                type: "submit",
                class:
                  "px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors",
                "hs-show": username.isNotEmpty().and(text.isNotEmpty()).toString(),
              },
            },
            "Send",
          ),
        ),
      ),

      // Footer
      UI.footer(
        {
          attrs: {
            class:
              "px-4 py-2 text-center text-xs text-gray-400 border-t border-gray-100",
          },
        },
        "Messages sync in real-time across all connected clients",
      ),
    ),
}).serve({ port: 3004 })

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                    Chat Room Example                          ║
╠═══════════════════════════════════════════════════════════════╣
║  http://localhost:${server.port}                                    ║
║                                                               ║
║  Open in multiple tabs to chat!                               ║
║  • on.action(sendMessage, { ... }) - action variable!         ║
║  • on.action(clearMessages) - no string IDs!                  ║
╚═══════════════════════════════════════════════════════════════╝
`)

process.on("SIGINT", async () => {
  console.log("\nShutting down...")
  await server.stop()
  process.exit(0)
})
