/**
 * Hyperstar v3 - LLM Streaming Example
 *
 * Demonstrates streaming LLM responses using the store pattern.
 * Key insight: store.update() automatically triggers SSE broadcasts,
 * so no special streaming infrastructure is needed!
 *
 * This example simulates an LLM response - replace with real API calls.
 */
import { createHyperstar, UI, on, $, Schema } from "hyperstar"

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

interface Signals {
  userInput: string
}

// ============================================================================
// Create Factory
// ============================================================================

const hs = createHyperstar<Store, {}, Signals>()

// ============================================================================
// Signals - Client-side form state
// ============================================================================

const { userInput } = hs.signals

// ============================================================================
// Actions
// ============================================================================

const sendMessage = hs.action("sendMessage", { input: Schema.String }, async (ctx, { input }) => {
  if (!input?.trim()) return

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
      { id: userMessageId, role: "user" as const, content: input.trim() },
      { id: assistantMessageId, role: "assistant" as const, content: "", isStreaming: true },
    ],
  }))

  // Stream the response - each update triggers SSE broadcast!
  for await (const chunk of simulateLLMStream(input)) {
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

const clearChat = hs.action("clearChat", (ctx) => {
  ctx.update((s) => ({
    ...s,
    messages: [],
    isGenerating: false,
  }))
})

// ============================================================================
// App Config
// ============================================================================

const server = hs.app({
  store: {
    messages: [],
    isGenerating: false,
  } as Store,
  signals: { userInput: "" },

  title: ({ store }) => `Hyperstar Chat (${store.messages.filter(m => m.role === "user").length} messages)`,

  view: (ctx) =>
    UI.div(
      { attrs: { id: "app", class: "h-screen flex flex-col bg-gray-50" } },

      // Header
      UI.header(
        { attrs: { class: "bg-white border-b px-6 py-4 flex items-center justify-between" } },
        UI.div(
          {},
          UI.h1({ attrs: { class: "text-xl font-semibold text-gray-900" } }, "Hyperstar Chat"),
          UI.p({ attrs: { class: "text-sm text-gray-500" } }, "LLM streaming via store updates"),
        ),
        UI.button(
          {
            attrs: { class: "text-sm text-gray-500 hover:text-gray-700" },
            events: { click: on.action(clearChat) },
          },
          "Clear Chat",
        ),
      ),

      // Messages
      UI.main(
        { attrs: { class: "flex-1 overflow-y-auto p-6" } },
        UI.div(
          { attrs: { class: "max-w-3xl mx-auto space-y-4" } },
          ctx.store.messages.length === 0
            ? UI.div(
                { attrs: { class: "text-center py-12" } },
                UI.p({ attrs: { class: "text-gray-500 mb-2" } }, "No messages yet"),
                UI.p(
                  { attrs: { class: "text-sm text-gray-400" } },
                  "Try asking about 'code' to see a code example!",
                ),
              )
            : UI.fragment(
                ...ctx.store.messages.map((message) =>
                  UI.div(
                    {
                      attrs: {
                        id: `message-${message.id}`,
                        class: `flex ${message.role === "user" ? "justify-end" : "justify-start"}`,
                      },
                    },
                    UI.div(
                      {
                        attrs: {
                          class: `max-w-[80%] rounded-2xl px-4 py-3 ${
                            message.role === "user"
                              ? "bg-blue-500 text-white"
                              : "bg-white border shadow-sm"
                          }`,
                        },
                      },
                      // Message content with streaming indicator
                      UI.div(
                        {
                          attrs: {
                            class: message.role === "assistant" ? "prose prose-sm" : "",
                            style: "white-space: pre-wrap",
                          },
                        },
                        message.content || (message.isStreaming ? "..." : ""),
                        message.isStreaming && message.content
                          ? UI.span({
                              attrs: {
                                class: "inline-block w-2 h-4 bg-gray-400 ml-1 animate-pulse",
                              },
                            })
                          : UI.empty(),
                      ),
                    ),
                  ),
                ),
              ),
        ),
      ),

      // Input
      UI.footer(
        { attrs: { class: "bg-white border-t p-4" } },
        UI.form(
          {
            attrs: { class: "max-w-3xl mx-auto flex gap-3" },
            events: {
              submit: on.seq(
                on.script("event.preventDefault()"),
                on.action(sendMessage, { input: $.signal("userInput") }),
              ),
            },
          },
          UI.input({
            attrs: {
              type: "text",
              placeholder: ctx.store.isGenerating ? "Generating..." : "Type a message...",
              disabled: ctx.store.isGenerating,
              class:
                "flex-1 px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100",
              "hs-bind": "userInput",
            },
          }),
          UI.button(
            {
              attrs: {
                type: "submit",
                disabled: ctx.store.isGenerating,
                class:
                  "px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-medium rounded-xl transition-colors",
              },
            },
            ctx.store.isGenerating ? "..." : "Send",
          ),
        ),
      ),
    ),
}).serve({ port: 3002 })

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                  LLM Streaming Demo                           ║
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
