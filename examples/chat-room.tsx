/**
 * Hyperstar v3 - Chat Room Example (JSX Version)
 *
 * Demonstrates the factory pattern with real-time multi-user chat:
 * - Define actions first, then reference them in view
 * - Global state (shared messages)
 * - Signal binding for input
 */
import { createHyperstar, hs, Schema } from "hyperstar"

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

interface Signals {
  username: string
  text: string
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

// ============================================================================
// Create Factory
// ============================================================================

const app = createHyperstar<Store, {}, Signals>()

// ============================================================================
// Signals - Client-side form state
// ============================================================================

const { username, text } = app.signals

// ============================================================================
// Actions - Define FIRST
// ============================================================================

const sendMessage = app.action(
  "sendMessage",
  {
    username: Schema.String.pipe(Schema.minLength(1)),
    text: Schema.String.pipe(Schema.minLength(1)),
  },
  (ctx, { username: user, text: msg }) => {
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
  },
)

const clearMessages = app.action("clearMessages", (ctx) => {
  ctx.update((s) => ({ ...s, messages: [] }))
})

// ============================================================================
// View Components
// ============================================================================

function MessageItem({ msg }: { msg: Message }) {
  return (
    <div id={`msg-${msg.id}`} class="flex gap-3 items-start">
      <div
        class="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
        style={`background: ${msg.color};`}
      >
        {msg.username.charAt(0).toUpperCase()}
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-baseline gap-2">
          <span class="font-semibold" style={`color: ${msg.color};`}>
            {msg.username}
          </span>
          <span class="text-xs text-gray-400">
            {new Date(msg.timestamp).toLocaleTimeString()}
          </span>
        </div>
        <p class="mt-1 break-words text-gray-700">{msg.text}</p>
      </div>
    </div>
  )
}

// ============================================================================
// App Config
// ============================================================================

const server = app.app({
  store: { messages: [] },
  signals: { username: "", text: "" },
  title: ({ store }) => `Chat Room (${store.messages.length} messages)`,

  view: (ctx) => (
    <div id="app" class="max-w-xl mx-auto h-screen flex flex-col bg-white">
      {/* Header */}
      <header class="p-4 border-b border-gray-200 bg-gray-50">
        <div class="flex justify-between items-center">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">Chat Room</h1>
            <p class="mt-1 text-sm text-gray-500">
              Open in multiple tabs to chat with yourself!
            </p>
          </div>
          {ctx.store.messages.length > 0 && (
            <button
              $={hs.action(clearMessages)}
              class="text-sm text-gray-500 hover:text-red-500"
            >
              Clear All
            </button>
          )}
        </div>
      </header>

      {/* Messages area */}
      <div
        id="messages"
        class="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-white"
      >
        {ctx.store.messages.length === 0 ? (
          <p class="text-center text-gray-400 mt-8">
            No messages yet. Be the first to say hello!
          </p>
        ) : (
          ctx.store.messages.map((msg) => <MessageItem msg={msg} />)
        )}
      </div>

      {/* Input form */}
      <form $={hs.form(sendMessage)} class="p-4 border-t border-gray-200 bg-gray-50">
        <div class="flex gap-2">
          <input
            type="text"
            name="username"
            placeholder="Your name..."
            $={hs.bind(username)}
            class="w-28 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <input
            type="text"
            name="text"
            placeholder="Type a message..."
            $={hs.bind(text)}
            class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            hs-show={username.isNotEmpty().and(text.isNotEmpty())}
            class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
          >
            Send
          </button>
        </div>
      </form>

      {/* Footer */}
      <footer class="px-4 py-2 text-center text-xs text-gray-400 border-t border-gray-100">
        Messages sync in real-time across all connected clients
      </footer>
    </div>
  ),
}).serve({ port: 3004 })

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║               Chat Room Example (JSX Version)                 ║
╠═══════════════════════════════════════════════════════════════╣
║  http://localhost:${server.port}                                    ║
║                                                               ║
║  Open in multiple tabs to chat!                               ║
║  • hs.action(sendMessage) - action variable!                  ║
║  • hs.form(sendMessage) - form submission                     ║
╚═══════════════════════════════════════════════════════════════╝
`)

process.on("SIGINT", async () => {
  console.log("\nShutting down...")
  await server.stop()
  process.exit(0)
})
