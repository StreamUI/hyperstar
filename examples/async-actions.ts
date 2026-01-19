/**
 * Hyperstar v3 - Async Actions Example
 *
 * Demonstrates async action handlers using the factory pattern.
 * The framework automatically detects async functions and handles them!
 *
 * Features:
 * - Async action handlers (just use `async`!)
 * - Loading states during async operations
 * - Error handling
 * - Search with validated arguments
 */
import { createHyperstar, UI, on, $, Schema } from "hyperstar"

// ============================================================================
// Types
// ============================================================================

interface Quote {
  text: string
  author: string
}

interface Store {
  quote: Quote | null
  loading: boolean
  history: Quote[]
  error: string | null
}

// ============================================================================
// Fake API - simulates network delay
// ============================================================================

const FAKE_QUOTES: Quote[] = [
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "Innovation distinguishes between a leader and a follower.", author: "Steve Jobs" },
  { text: "Stay hungry, stay foolish.", author: "Steve Jobs" },
  { text: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" },
  { text: "The best way to predict the future is to invent it.", author: "Alan Kay" },
  { text: "Talk is cheap. Show me the code.", author: "Linus Torvalds" },
  { text: "First, solve the problem. Then, write the code.", author: "John Johnson" },
  { text: "Code is like humor. When you have to explain it, it's bad.", author: "Cory House" },
]

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchRandomQuote(): Promise<Quote> {
  await sleep(500 + Math.random() * 1000)
  return FAKE_QUOTES[Math.floor(Math.random() * FAKE_QUOTES.length)]!
}

async function searchQuotes(keyword: string): Promise<Quote | null> {
  await sleep(800)
  const lower = keyword.toLowerCase()
  return (
    FAKE_QUOTES.find(
      (q) => q.text.toLowerCase().includes(lower) || q.author.toLowerCase().includes(lower),
    ) || null
  )
}

interface Signals {
  searchText: string
}

// ============================================================================
// Create Factory
// ============================================================================

const hs = createHyperstar<Store, {}, Signals>()

// ============================================================================
// Signals - Client-side form state
// ============================================================================

const { searchText } = hs.signals

// ============================================================================
// Actions - Async handlers are automatically detected!
// ============================================================================

// Async action - no args (just use `async`!)
const getQuote = hs.action("getQuote", async (ctx) => {
  ctx.update((s) => ({ ...s, loading: true, error: null }))

  try {
    const quote = await fetchRandomQuote()
    ctx.update((s) => ({
      ...s,
      quote,
      loading: false,
      history: [quote, ...s.history].slice(0, 5),
    }))
  } catch (err) {
    ctx.update((s) => ({
      ...s,
      loading: false,
      error: "Failed to fetch quote",
    }))
  }
})

// Async action with validated args
const search = hs.action("search", { keyword: Schema.String }, async (ctx, { keyword }) => {
  if (!keyword.trim()) return

  ctx.update((s) => ({ ...s, loading: true, error: null }))

  try {
    const quote = await searchQuotes(keyword)
    if (quote) {
      ctx.update((s) => ({
        ...s,
        quote,
        loading: false,
        history: [quote, ...s.history].slice(0, 5),
      }))
    } else {
      const randomQuote = await fetchRandomQuote()
      ctx.update((s) => ({
        ...s,
        quote: randomQuote,
        loading: false,
        error: `No match for "${keyword}", showing random quote`,
        history: [randomQuote, ...s.history].slice(0, 5),
      }))
    }
  } catch (err) {
    ctx.update((s) => ({ ...s, loading: false, error: "Search failed" }))
  }
})

// Sync actions
const clearHistory = hs.action("clearHistory", (ctx) => {
  ctx.update((s) => ({ ...s, history: [], error: null }))
})

const dismissError = hs.action("dismissError", (ctx) => {
  ctx.update((s) => ({ ...s, error: null }))
})

// ============================================================================
// App Config
// ============================================================================

const server = hs.app({
  store: {
    quote: null,
    loading: false,
    history: [],
    error: null,
  } as Store,
  signals: { searchText: "" },

  view: (ctx) => {
    return UI.div(
      { attrs: { id: "app", class: "max-w-xl mx-auto p-8" } },

      // Header
      UI.h1(
        { attrs: { class: "text-3xl font-bold text-gray-900 mb-2" } },
        "Async Actions Demo",
      ),
      UI.p(
        { attrs: { class: "text-gray-500 mb-8" } },
        "Async handlers are automatically detected - just use ",
        UI.code({ attrs: { class: "bg-gray-100 px-1 rounded" } }, "async"),
        "!",
      ),

      // Error message
      ctx.store.error
        ? UI.div(
            {
              attrs: {
                class:
                  "bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg mb-6 flex justify-between items-center",
              },
            },
            UI.span({}, ctx.store.error),
            UI.button(
              {
                attrs: { class: "text-yellow-600 hover:text-yellow-800 font-bold" },
                events: { click: on.action(dismissError) },
              },
              "x",
            ),
          )
        : UI.empty(),

      // Quote Display
      UI.div(
        {
          attrs: {
            class:
              "bg-gradient-to-br from-indigo-500 to-purple-600 text-white p-6 rounded-xl mb-6 min-h-[140px] flex items-center justify-center",
          },
        },
        ctx.store.loading
          ? UI.div(
              { attrs: { class: "flex items-center gap-3" } },
              UI.div({
                attrs: {
                  class:
                    "w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin",
                },
              }),
              UI.span({ attrs: { class: "text-lg" } }, "Fetching quote..."),
            )
          : ctx.store.quote
            ? UI.div(
                { attrs: { class: "text-center" } },
                UI.p(
                  { attrs: { class: "text-xl italic mb-3" } },
                  `"${ctx.store.quote.text}"`,
                ),
                UI.p(
                  { attrs: { class: "text-indigo-200" } },
                  `- ${ctx.store.quote.author}`,
                ),
              )
            : UI.p(
                { attrs: { class: "text-indigo-200" } },
                "Click a button below to fetch a quote",
              ),
      ),

      // Action Buttons
      UI.div(
        { attrs: { class: "flex flex-col gap-4 mb-8" } },

        // Simple async action
        UI.button(
          {
            attrs: {
              disabled: ctx.store.loading,
              class: `w-full py-3 px-4 font-semibold rounded-lg transition-colors ${
                ctx.store.loading
                  ? "bg-indigo-300 text-white cursor-not-allowed"
                  : "bg-indigo-500 hover:bg-indigo-600 text-white"
              }`,
            },
            events: { click: on.action(getQuote) },
          },
          ctx.store.loading ? "Loading..." : "Get Random Quote",
        ),

        // Search form with args
        UI.div(
          { attrs: { class: "flex gap-2" } },
          UI.input({
            attrs: {
              type: "text",
              placeholder: "Search by keyword or author...",
              disabled: ctx.store.loading,
              class: `flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg ${
                ctx.store.loading
                  ? "bg-gray-100"
                  : "focus:border-indigo-500 focus:outline-none"
              }`,
              "hs-bind": "searchText",
            },
          }),
          UI.button(
            {
              attrs: {
                disabled: ctx.store.loading,
                class: `px-6 py-3 font-semibold rounded-lg transition-colors ${
                  ctx.store.loading
                    ? "bg-purple-300 text-white cursor-not-allowed"
                    : "bg-purple-500 hover:bg-purple-600 text-white"
                }`,
                "hs-show": searchText.isNotEmpty().toString(),
              },
              events: { click: on.action(search, { keyword: $.signal("searchText") }) },
            },
            "Search",
          ),
        ),
      ),

      // Quote History
      ctx.store.history.length > 0
        ? UI.div(
            { attrs: { class: "bg-gray-50 p-4 rounded-lg" } },
            UI.div(
              { attrs: { class: "flex justify-between items-center mb-3" } },
              UI.h2({ attrs: { class: "font-semibold text-gray-700" } }, "Recent Quotes"),
              UI.button(
                {
                  attrs: { class: "text-sm text-red-500 hover:text-red-600" },
                  events: { click: on.action(clearHistory) },
                },
                "Clear",
              ),
            ),
            UI.ul(
              { attrs: { class: "space-y-2" } },
              ...ctx.store.history.map((quote, i) =>
                UI.li(
                  {
                    attrs: {
                      id: `history-${i}`,
                      class: "text-sm text-gray-600 border-l-2 border-indigo-200 pl-3",
                    },
                  },
                  `"${quote.text.slice(0, 50)}..." - ${quote.author}`,
                ),
              ),
            ),
          )
        : UI.empty(),

      // Footer
      UI.footer(
        { attrs: { class: "mt-8 text-center text-gray-400 text-sm" } },
        UI.p(
          {},
          "Actions use ",
          UI.code({ attrs: { class: "bg-gray-100 px-1 rounded text-gray-600" } }, "ctx.update()"),
          " to modify state during async operations.",
        ),
      ),
    )
  },
}).serve({ port: 3014 })

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                  Async Actions Demo                           ║
╠═══════════════════════════════════════════════════════════════╣
║  http://localhost:${server.port}                                    ║
║                                                               ║
║  Async handlers are automatically detected:                   ║
║  • hs.action("id", async (ctx) => { ... })                    ║
║  • hs.action("id", { args }, async (ctx, args) => { ... })    ║
╚═══════════════════════════════════════════════════════════════╝
`)

process.on("SIGINT", async () => {
  console.log("\nShutting down...")
  await server.stop()
  process.exit(0)
})
