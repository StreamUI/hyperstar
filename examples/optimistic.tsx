/**
 * Hyperstar v3 - Optimistic Updates Example (JSX Version)
 *
 * Demonstrates the optimistic update pattern where UI updates immediately
 * before server confirmation, with automatic rollback on error.
 *
 * Features demonstrated:
 * - Optimistic updates with immediate UI feedback
 * - Automatic rollback on simulated failures
 * - Loading states during server "processing"
 * - Like/bookmark actions that feel instant
 * - Error recovery patterns
 */
import { createHyperstar, hs, Schema } from "hyperstar"

// ============================================================================
// Types
// ============================================================================

interface Post {
  id: string
  author: string
  content: string
  likes: number
  likedByMe: boolean
  bookmarked: boolean
  timestamp: string
}

interface Store {
  posts: Post[]
  pendingActions: Record<string, "like" | "bookmark"> // Track in-flight actions
  errors: { id: string; message: string; timestamp: string }[]
}

interface Signals {
  showErrors: boolean
}

// ============================================================================
// Helpers
// ============================================================================

// Simulate network latency
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Simulate random failures (20% chance)
const maybeFailWithMessage = (action: string): string | null => {
  if (Math.random() < 0.2) {
    const errors = [
      "Network error: Connection timed out",
      "Server error: Please try again",
      "Rate limited: Too many requests",
    ]
    return errors[Math.floor(Math.random() * errors.length)]!
  }
  return null
}

function timeAgo(timestamp: string): string {
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  return `${Math.floor(seconds / 3600)}h ago`
}

// ============================================================================
// Create Factory
// ============================================================================

const app = createHyperstar<Store, {}, Signals>()

// ============================================================================
// Signals
// ============================================================================

const { showErrors } = app.signals

// ============================================================================
// Actions with Optimistic Updates
// ============================================================================

const toggleLike = app.action("toggleLike", { postId: Schema.String }, async (ctx, { postId }) => {
  const store = ctx.getStore()
  const post = store.posts.find((p) => p.id === postId)
  if (!post) return

  // Check if action already pending
  if (store.pendingActions[postId]) return

  const wasLiked = post.likedByMe
  const optimisticLikes = wasLiked ? post.likes - 1 : post.likes + 1

  // 1. OPTIMISTIC UPDATE - Update UI immediately
  ctx.update((s) => ({
    ...s,
    posts: s.posts.map((p) =>
      p.id === postId ? { ...p, likedByMe: !wasLiked, likes: optimisticLikes } : p,
    ),
    pendingActions: { ...s.pendingActions, [postId]: "like" },
  }))

  // 2. SIMULATE SERVER REQUEST
  await delay(800 + Math.random() * 400) // 800-1200ms latency

  // 3. CHECK FOR ERROR
  const error = maybeFailWithMessage("like")

  if (error) {
    // ROLLBACK - Revert to original state
    ctx.update((s) => ({
      ...s,
      posts: s.posts.map((p) =>
        p.id === postId ? { ...p, likedByMe: wasLiked, likes: post.likes } : p,
      ),
      pendingActions: Object.fromEntries(
        Object.entries(s.pendingActions).filter(([k]) => k !== postId),
      ),
      errors: [
        { id: crypto.randomUUID().slice(0, 8), message: `Like failed: ${error}`, timestamp: new Date().toISOString() },
        ...s.errors,
      ].slice(0, 5),
    }))
  } else {
    // SUCCESS - Just clear pending state
    ctx.update((s) => ({
      ...s,
      pendingActions: Object.fromEntries(
        Object.entries(s.pendingActions).filter(([k]) => k !== postId),
      ),
    }))
  }
})

const toggleBookmark = app.action("toggleBookmark", { postId: Schema.String }, async (ctx, { postId }) => {
  const store = ctx.getStore()
  const post = store.posts.find((p) => p.id === postId)
  if (!post) return

  if (store.pendingActions[postId]) return

  const wasBookmarked = post.bookmarked

  // 1. OPTIMISTIC UPDATE
  ctx.update((s) => ({
    ...s,
    posts: s.posts.map((p) =>
      p.id === postId ? { ...p, bookmarked: !wasBookmarked } : p,
    ),
    pendingActions: { ...s.pendingActions, [postId]: "bookmark" },
  }))

  // 2. SIMULATE SERVER REQUEST
  await delay(600 + Math.random() * 400)

  // 3. CHECK FOR ERROR
  const error = maybeFailWithMessage("bookmark")

  if (error) {
    // ROLLBACK
    ctx.update((s) => ({
      ...s,
      posts: s.posts.map((p) =>
        p.id === postId ? { ...p, bookmarked: wasBookmarked } : p,
      ),
      pendingActions: Object.fromEntries(
        Object.entries(s.pendingActions).filter(([k]) => k !== postId),
      ),
      errors: [
        { id: crypto.randomUUID().slice(0, 8), message: `Bookmark failed: ${error}`, timestamp: new Date().toISOString() },
        ...s.errors,
      ].slice(0, 5),
    }))
  } else {
    // SUCCESS
    ctx.update((s) => ({
      ...s,
      pendingActions: Object.fromEntries(
        Object.entries(s.pendingActions).filter(([k]) => k !== postId),
      ),
    }))
  }
})

const clearErrors = app.action("clearErrors", (ctx) => {
  ctx.update((s) => ({ ...s, errors: [] }))
})

const dismissError = app.action("dismissError", { errorId: Schema.String }, (ctx, { errorId }) => {
  ctx.update((s) => ({
    ...s,
    errors: s.errors.filter((e) => e.id !== errorId),
  }))
})

// ============================================================================
// Components
// ============================================================================

function PostCard({
  post,
  isPending,
  pendingAction,
}: {
  post: Post
  isPending: boolean
  pendingAction?: "like" | "bookmark"
}) {
  return (
    <div id={`post-${post.id}`} class="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      {/* Author */}
      <div class="flex items-center gap-3 mb-3">
        <div class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold">
          {post.author[0]}
        </div>
        <div>
          <div class="font-medium text-gray-900">{post.author}</div>
          <div class="text-xs text-gray-400">{timeAgo(post.timestamp)}</div>
        </div>
      </div>

      {/* Content */}
      <p class="text-gray-700 mb-4">{post.content}</p>

      {/* Actions */}
      <div class="flex items-center gap-4 pt-3 border-t border-gray-100">
        {/* Like Button */}
        <button
          $={hs.action(toggleLike, { postId: post.id })}
          class={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
            post.likedByMe
              ? "bg-red-50 text-red-500"
              : "hover:bg-gray-100 text-gray-500"
          } ${isPending && pendingAction === "like" ? "opacity-50" : ""}`}
        >
          <span class={isPending && pendingAction === "like" ? "animate-pulse" : ""}>
            {post.likedByMe ? "❤️" : "🤍"}
          </span>
          <span class="text-sm font-medium">{post.likes}</span>
          {isPending && pendingAction === "like" && (
            <span class="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
          )}
        </button>

        {/* Bookmark Button */}
        <button
          $={hs.action(toggleBookmark, { postId: post.id })}
          class={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
            post.bookmarked
              ? "bg-yellow-50 text-yellow-600"
              : "hover:bg-gray-100 text-gray-500"
          } ${isPending && pendingAction === "bookmark" ? "opacity-50" : ""}`}
        >
          <span class={isPending && pendingAction === "bookmark" ? "animate-pulse" : ""}>
            {post.bookmarked ? "🔖" : "📑"}
          </span>
          <span class="text-sm">{post.bookmarked ? "Saved" : "Save"}</span>
          {isPending && pendingAction === "bookmark" && (
            <span class="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
          )}
        </button>

        {/* Comment (placeholder) */}
        <button class="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
          <span>💬</span>
          <span class="text-sm">Comment</span>
        </button>
      </div>
    </div>
  )
}

function ErrorToast({ error }: { error: Store["errors"][0] }) {
  return (
    <div class="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg shadow-lg">
      <span>⚠️</span>
      <span class="flex-1 text-sm">{error.message}</span>
      <button
        $={hs.action(dismissError, { errorId: error.id })}
        class="text-red-400 hover:text-red-600"
      >
        ✕
      </button>
    </div>
  )
}

// ============================================================================
// Sample Data
// ============================================================================

const SAMPLE_POSTS: Post[] = [
  {
    id: "1",
    author: "Sarah Chen",
    content: "Just shipped a new feature using Hyperstar! The optimistic updates make the UI feel so snappy. Love how easy it is to implement rollback on errors. 🚀",
    likes: 42,
    likedByMe: false,
    bookmarked: false,
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
  {
    id: "2",
    author: "Alex Rivera",
    content: "Pro tip: Always show a loading spinner NEXT to the optimistic UI, not instead of it. Users should see their action took effect immediately, with subtle feedback that it's being confirmed.",
    likes: 128,
    likedByMe: true,
    bookmarked: true,
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: "3",
    author: "Jordan Park",
    content: "The key to great optimistic updates:\n\n1. Update UI immediately\n2. Track pending state\n3. Handle errors gracefully\n4. Rollback if needed\n\nHyperstar makes all of this straightforward! 💪",
    likes: 89,
    likedByMe: false,
    bookmarked: false,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: "4",
    author: "Morgan Lee",
    content: "Testing the 20% failure rate in this demo. Click like/bookmark a few times and watch the rollback in action when errors occur! The UX stays smooth even with failures.",
    likes: 56,
    likedByMe: false,
    bookmarked: true,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  },
]

// ============================================================================
// App Config
// ============================================================================

const server = app.app({
  store: {
    posts: SAMPLE_POSTS,
    pendingActions: {},
    errors: [],
  },
  signals: { showErrors: true },

  title: () => "Optimistic Updates Demo",

  view: (ctx) => (
    <div id="app" class="min-h-screen bg-gray-100">
      {/* Error Toasts */}
      {ctx.store.errors.length > 0 && (
        <div class="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
          {ctx.store.errors.map((error) => (
            <ErrorToast error={error} />
          ))}
        </div>
      )}

      {/* Header */}
      <header class="bg-white border-b sticky top-0 z-40">
        <div class="max-w-2xl mx-auto px-4 py-4">
          <h1 class="text-xl font-bold text-gray-900">Optimistic Updates</h1>
          <p class="text-sm text-gray-500">
            Click like/bookmark - UI updates instantly, rolls back on error (20% failure rate)
          </p>
        </div>
      </header>

      {/* Info Banner */}
      <div class="max-w-2xl mx-auto px-4 mt-4">
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
          <p class="font-medium mb-1">How it works:</p>
          <ol class="list-decimal list-inside space-y-1">
            <li><strong>Click</strong> - UI updates immediately (optimistic)</li>
            <li><strong>Spinner</strong> - Shows while "server" processes (800-1200ms)</li>
            <li><strong>Success</strong> - Spinner disappears, state confirmed</li>
            <li><strong>Error</strong> - State rolls back, toast appears</li>
          </ol>
        </div>
      </div>

      {/* Posts Feed */}
      <main class="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {ctx.store.posts.map((post) => (
          <PostCard
            post={post}
            isPending={post.id in ctx.store.pendingActions}
            pendingAction={ctx.store.pendingActions[post.id]}
          />
        ))}
      </main>

      {/* Stats Footer */}
      <footer class="max-w-2xl mx-auto px-4 py-4 text-center text-sm text-gray-400">
        <p>
          {Object.keys(ctx.store.pendingActions).length} pending •{" "}
          {ctx.store.errors.length} errors •{" "}
          {ctx.store.posts.filter((p) => p.likedByMe).length} liked •{" "}
          {ctx.store.posts.filter((p) => p.bookmarked).length} bookmarked
        </p>
        {ctx.store.errors.length > 0 && (
          <button
            $={hs.action(clearErrors)}
            class="mt-2 text-blue-500 hover:text-blue-700"
          >
            Clear all errors
          </button>
        )}
      </footer>
    </div>
  ),
}).serve({ port: 3022 })

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║              Optimistic Updates Demo (JSX)                    ║
╠═══════════════════════════════════════════════════════════════╣
║  http://localhost:${server.port}                                    ║
║                                                               ║
║  Features:                                                    ║
║  • Click like/bookmark - UI updates INSTANTLY                 ║
║  • 20% simulated failure rate with automatic rollback         ║
║  • Spinner shows during "server" processing                   ║
║  • Error toasts for failed actions                            ║
║  • Pending state tracking prevents double-clicks              ║
╚═══════════════════════════════════════════════════════════════╝
`)

process.on("SIGINT", async () => {
  console.log("\nShutting down...")
  await server.stop()
  process.exit(0)
})
