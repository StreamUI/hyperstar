/**
 * Hyperstar v3 - LLM Streaming Example (JSX Version)
 *
 * Demonstrates streaming LLM responses using the store pattern.
 * Key insight: store.update() automatically triggers SSE broadcasts,
 * so no special streaming infrastructure is needed!
 *
 * This example simulates an LLM response - replace with real API calls.
 */
import { createHyperstar, hs, Schema } from "hyperstar"

// ============================================================================
// Types
// ============================================================================

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  isStreaming?: boolean
}

interface Store {
  messages: Message[]
  isGenerating: boolean
}

interface Signals {
  userInput: string
}

// ============================================================================
// Simulated LLM streaming response
// ============================================================================

async function* simulateLLMStream(prompt: string): AsyncGenerator<string> {
  const responses: Record<string, string> = {
    default:
      "I'm a simulated AI assistant. In a real implementation, this would connect to Claude, GPT, or another LLM API. The key insight is that Hyperstar's store updates automatically broadcast to all connected clients via SSE, so streaming just works naturally!",
    hello:
      "Hello! I'm happy to help you today. Hyperstar makes it easy to build real-time AI chat applications. Each token I generate updates the store, which triggers a re-render and SSE broadcast to all clients.",
    code: `Here's how streaming works in Hyperstar:

\`\`\`typescript
// Add empty assistant message
ctx.update(s => ({
  ...s,
  messages: [...s.messages, { role: 'assistant', content: '' }]
}))

// Stream tokens - each update triggers SSE!
for await (const chunk of llmStream) {
  ctx.update(s => ({
    ...s,
    messages: s.messages.map((m, i) =>
      i === s.messages.length - 1
        ? { ...m, content: m.content + chunk }
        : m
    )
  }))
}
\`\`\`

No special streaming infrastructure needed!`,
  }

  const text = prompt.toLowerCase().includes("hello")
    ? responses.hello
    : prompt.toLowerCase().includes("code")
      ? responses.code
      : responses.default

  // Simulate token-by-token streaming
  const words = text.split(" ")
  for (const word of words) {
    yield word + " "
    await new Promise((r) => setTimeout(r, 30 + Math.random() * 50))
  }
}

// ============================================================================
// Create Factory
// ============================================================================

const app = createHyperstar<Store, {}, Signals>()

// ============================================================================
// Signals - Client-side form state
// ============================================================================

const { userInput } = app.signals

// ============================================================================
// Actions
// ============================================================================

const sendMessage = app.action("sendMessage", { userInput: Schema.String }, async (ctx, { userInput }) => {
  if (!userInput?.trim()) return

  const userMessageId = `user-${Date.now()}`
  const assistantMessageId = `assistant-${Date.now()}`

  // Clear input immediately
  ctx.patchSignals({ userInput: "" })

  // Add user message and empty assistant message
  ctx.update((s) => ({
    ...s,
    isGenerating: true,
    messages: [
      ...s.messages,
      { id: userMessageId, role: "user" as const, content: userInput.trim() },
      { id: assistantMessageId, role: "assistant" as const, content: "", isStreaming: true },
    ],
  }))

  // Stream the response - each update triggers SSE broadcast!
  for await (const chunk of simulateLLMStream(userInput)) {
    ctx.update((s) => ({
      ...s,
      messages: s.messages.map((m) =>
        m.id === assistantMessageId ? { ...m, content: m.content + chunk } : m,
      ),
    }))
  }

  // Mark streaming as complete
  ctx.update((s) => ({
    ...s,
    isGenerating: false,
    messages: s.messages.map((m) =>
      m.id === assistantMessageId ? { ...m, isStreaming: false } : m,
    ),
  }))
})

const clearChat = app.action("clearChat", (ctx) => {
  ctx.update((s) => ({
    ...s,
    messages: [],
    isGenerating: false,
  }))
})

// ============================================================================
// Components
// ============================================================================

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user"

  return (
    <div id={`message-${message.id}`} class={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        class={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser ? "bg-blue-500 text-white" : "bg-white border shadow-sm"
        }`}
      >
        <div class={message.role === "assistant" ? "prose prose-sm" : ""} style="white-space: pre-wrap">
          {message.content || (message.isStreaming ? "..." : "")}
          {message.isStreaming && message.content && (
            <span class="inline-block w-2 h-4 bg-gray-400 ml-1 animate-pulse" />
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// App Config
// ============================================================================

const server = app.app({
  store: {
    messages: [],
    isGenerating: false,
  } as Store,
  signals: { userInput: "" },

  title: ({ store }) => `Hyperstar Chat (${store.messages.filter((m) => m.role === "user").length} messages)`,

  view: (ctx) => (
    <div id="app" class="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header class="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 class="text-xl font-semibold text-gray-900">Hyperstar Chat</h1>
          <p class="text-sm text-gray-500">LLM streaming via store updates</p>
        </div>
        <button $={hs.action(clearChat)} class="text-sm text-gray-500 hover:text-gray-700">
          Clear Chat
        </button>
      </header>

      {/* Messages */}
      <main class="flex-1 overflow-y-auto p-6">
        <div class="max-w-3xl mx-auto space-y-4">
          {ctx.store.messages.length === 0 ? (
            <div class="text-center py-12">
              <p class="text-gray-500 mb-2">No messages yet</p>
              <p class="text-sm text-gray-400">Try asking about 'code' to see a code example!</p>
            </div>
          ) : (
            ctx.store.messages.map((message) => <MessageBubble message={message} />)
          )}
        </div>
      </main>

      {/* Input */}
      <footer class="bg-white border-t p-4">
        <form $={hs.form(sendMessage)} class="max-w-3xl mx-auto flex gap-3">
          <input
            type="text"
            placeholder={ctx.store.isGenerating ? "Generating..." : "Type a message..."}
            disabled={ctx.store.isGenerating}
            $={hs.bind(userInput)}
            class="flex-1 px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100"
          />
          <button
            type="submit"
            disabled={ctx.store.isGenerating}
            class="px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-medium rounded-xl transition-colors"
          >
            {ctx.store.isGenerating ? "..." : "Send"}
          </button>
        </form>
      </footer>
    </div>
  ),
}).serve({ port: 3002 })

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                  LLM Streaming Demo (JSX)                     ║
╠═══════════════════════════════════════════════════════════════╣
║  http://localhost:${server.port}                                    ║
║                                                               ║
║  Key insight: Store updates automatically trigger SSE!        ║
║  • No special streaming infrastructure needed                 ║
║  • Each token update broadcasts to all clients                ║
║  • Try asking about "code" for a code example                 ║
╚═══════════════════════════════════════════════════════════════╝
`)

process.on("SIGINT", async () => {
  console.log("\nShutting down...")
  await server.stop()
  process.exit(0)
})
