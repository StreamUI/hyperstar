/**
 * Hyperstar v3 - Async Actions Example (JSX Version)
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
import { createHyperstar, hs, Schema } from "hyperstar"

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

interface Signals {
  keyword: string
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

// ============================================================================
// Create Factory
// ============================================================================

const app = createHyperstar<Store, {}, Signals>()

// ============================================================================
// Signals - Client-side form state
// ============================================================================

const { keyword } = app.signals

// ============================================================================
// Actions - Async handlers are automatically detected!
// ============================================================================

// Async action - no args (just use `async`!)
const getQuote = app.action("getQuote", async (ctx) => {
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
const search = app.action("search", { keyword: Schema.String }, async (ctx, { keyword }) => {
  if (!keyword.trim()) return

  ctx.update((s) => ({ ...s, loading: true, error: null }))
  ctx.patchSignals({ keyword: "" })

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
const clearHistory = app.action("clearHistory", (ctx) => {
  ctx.update((s) => ({ ...s, history: [], error: null }))
})

const dismissError = app.action("dismissError", (ctx) => {
  ctx.update((s) => ({ ...s, error: null }))
})

// ============================================================================
// App Config
// ============================================================================

const server = app.app({
  store: {
    quote: null,
    loading: false,
    history: [],
    error: null,
  } as Store,
  signals: { keyword: "" },

  view: (ctx) => (
    <div id="app" class="max-w-xl mx-auto p-8">
      {/* Header */}
      <h1 class="text-3xl font-bold text-gray-900 mb-2">Async Actions Demo</h1>
      <p class="text-gray-500 mb-8">
        Async handlers are automatically detected - just use{" "}
        <code class="bg-gray-100 px-1 rounded">async</code>!
      </p>

      {/* Error message */}
      {ctx.store.error && (
        <div class="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg mb-6 flex justify-between items-center">
          <span>{ctx.store.error}</span>
          <button
            $={hs.action(dismissError)}
            class="text-yellow-600 hover:text-yellow-800 font-bold"
          >
            x
          </button>
        </div>
      )}

      {/* Quote Display */}
      <div class="bg-gradient-to-br from-indigo-500 to-purple-600 text-white p-6 rounded-xl mb-6 min-h-[140px] flex items-center justify-center">
        {ctx.store.loading ? (
          <div class="flex items-center gap-3">
            <div class="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span class="text-lg">Fetching quote...</span>
          </div>
        ) : ctx.store.quote ? (
          <div class="text-center">
            <p class="text-xl italic mb-3">"{ctx.store.quote.text}"</p>
            <p class="text-indigo-200">- {ctx.store.quote.author}</p>
          </div>
        ) : (
          <p class="text-indigo-200">Click a button below to fetch a quote</p>
        )}
      </div>

      {/* Action Buttons */}
      <div class="flex flex-col gap-4 mb-8">
        {/* Simple async action */}
        <button
          $={hs.action(getQuote)}
          disabled={ctx.store.loading}
          class={`w-full py-3 px-4 font-semibold rounded-lg transition-colors ${
            ctx.store.loading
              ? "bg-indigo-300 text-white cursor-not-allowed"
              : "bg-indigo-500 hover:bg-indigo-600 text-white"
          }`}
        >
          {ctx.store.loading ? "Loading..." : "Get Random Quote"}
        </button>

        {/* Search form with args */}
        <form $={hs.form(search)} class="flex gap-2">
          <input
            type="text"
            name="keyword"
            placeholder="Search by keyword or author..."
            disabled={ctx.store.loading}
            $={hs.bind(keyword)}
            class={`flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg ${
              ctx.store.loading
                ? "bg-gray-100"
                : "focus:border-indigo-500 focus:outline-none"
            }`}
          />
          <button
            type="submit"
            disabled={ctx.store.loading}
            hs-show={keyword.isNotEmpty()}
            class={`px-6 py-3 font-semibold rounded-lg transition-colors ${
              ctx.store.loading
                ? "bg-purple-300 text-white cursor-not-allowed"
                : "bg-purple-500 hover:bg-purple-600 text-white"
            }`}
          >
            Search
          </button>
        </form>
      </div>

      {/* Quote History */}
      {ctx.store.history.length > 0 && (
        <div class="bg-gray-50 p-4 rounded-lg">
          <div class="flex justify-between items-center mb-3">
            <h2 class="font-semibold text-gray-700">Recent Quotes</h2>
            <button
              $={hs.action(clearHistory)}
              class="text-sm text-red-500 hover:text-red-600"
            >
              Clear
            </button>
          </div>
          <ul class="space-y-2">
            {ctx.store.history.map((quote, i) => (
              <li
                id={`history-${i}`}
                class="text-sm text-gray-600 border-l-2 border-indigo-200 pl-3"
              >
                "{quote.text.slice(0, 50)}..." - {quote.author}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer */}
      <footer class="mt-8 text-center text-gray-400 text-sm">
        <p>
          Actions use{" "}
          <code class="bg-gray-100 px-1 rounded text-gray-600">ctx.update()</code>{" "}
          to modify state during async operations.
        </p>
      </footer>
    </div>
  ),
}).serve({ port: 3014 })

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║             Async Actions Demo (JSX Version)                  ║
╠═══════════════════════════════════════════════════════════════╣
║  http://localhost:${server.port}                                    ║
║                                                               ║
║  Async handlers are automatically detected:                   ║
║  • app.action("id", async (ctx) => { ... })                   ║
║  • app.action("id", { args }, async (ctx, args) => { ... })   ║
╚═══════════════════════════════════════════════════════════════╝
`)

process.on("SIGINT", async () => {
  console.log("\nShutting down...")
  await server.stop()
  process.exit(0)
})
