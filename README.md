<img src="assets/hyperstar.jpg" alt="Hyperstar" width="250" />

# Hyperstar

[![Discord](https://img.shields.io/badge/Discord-Join%20Us-5865F2?logo=discord&logoColor=white)](https://discord.gg/QsKYQhdqNu)

> [!CAUTION]
> **Very Beta** - This is experimental software. The API changes frequently and will break your code. Don't use this for anything production-critical. Great for prototypes, internal tools, and fun real-time multiplayer apps.

**Server-driven UI for real-time web apps. No client code. No state sync. Just TypeScript + JSX.**

Inspired by [Phoenix LiveView](https://hexdocs.pm/phoenix_live_view/) | [Datastar](https://data-star.dev/) | [HTMX](https://htmx.org/)

> [!TIP]
> **Built for Vibe Coding** - JSX that feels like React, but there's no client bundle, no hydration, no state sync bugs. The server owns everything. Live, realtime UI, directly from the server. When you use `bunx hyperstar-cli create`, your project includes a Claude Code skill that teaches Claude how to build Hyperstar apps. If you're not using the CLI, you can copy the skill from [`packages/cli/skill/SKILL.md`](https://github.com/longtailLABS/hyperstar/blob/master/packages/cli/skill/SKILL.md) into your project's `.claude/skills/` directory.

## Quick Start

```bash
bunx hyperstar-cli create my-app
cd my-app
bun install
bun run dev
```

Open http://localhost:3000 - you have a working app.

Now edit `app.tsx`:

```tsx
import { createHyperstar, hs } from "hyperstar"

interface Store {
  count: number
}

const app = createHyperstar<Store>()

const increment = app.action("increment", (ctx) => {
  ctx.update((s) => ({ ...s, count: s.count + 1 }))
})

app.app({
  store: { count: 0 },
  view: (ctx) => (
    <div id="app">
      <h1>{ctx.store.count}</h1>
      <button $={hs.action(increment)}>+1</button>
    </div>
  ),
}).serve({ port: 3000 })
```

Open multiple tabs - they all sync in real-time.

Ready to ship? Deploy to [Fly.io Sprites](https://sprites.dev/):

```bash
bunx hyperstar-cli deploy --managed
```

Your app is live. No Docker, no config, no CI/CD setup.

---

## Why Hyperstar?

**Zero client code.** Your entire app lives on the server. No React components, no client-side state management, no API routes to wire up. Just TypeScript functions that update state and JSX that renders it.

**Real-time by default.** Every state change automatically syncs to all connected clients. User A clicks a button, User B sees it instantly. No WebSocket setup, no pub/sub configuration, no cache invalidation.

**One mental model.** Server state is the source of truth. No wondering if the client is out of sync, no optimistic updates gone wrong, no race conditions between tabs.

**Ship faster.** Internal tools, prototypes, multiplayer games, live dashboards - build them in seconds instead of hours. When the server owns everything, there's just less to think about.

---

## Installation

```bash
bun add hyperstar
```

---

## How It Works

1. Server renders HTML from your `view` function
2. Clients connect via SSE (Server-Sent Events)
3. When state changes, server re-renders and streams HTML
4. Clients morph the DOM - no full page reload

**Real-time means all clients see the same state.** User A clicks a button, User B sees it instantly.

---

## Understanding State

Hyperstar has three types of state, each serving a different purpose:

```
┌─────────────────────────────────────────────────────────────────┐
│  STORE (Global Server State)                                    │
│  • Shared across ALL connected clients                          │
│  • User A adds item → User B sees it instantly                  │
│  • Use for: shared data, chat messages, game state              │
├─────────────────────────────────────────────────────────────────┤
│  USERSTORE (Per-Session Server State)                           │
│  • Private to each browser session                              │
│  • Persists on server across page reloads                       │
│  • Use for: user preferences, theme, auth state                 │
├─────────────────────────────────────────────────────────────────┤
│  SIGNALS (Client State)                                         │
│  • Lives in browser memory only                                 │
│  • Instant updates, no server roundtrip                         │
│  • Server can update via ctx.patchSignals()                     │
│  • Use for: form inputs, UI tabs, modals, hover state           │
└─────────────────────────────────────────────────────────────────┘
```

```tsx
// All three in action
const app = createHyperstar<Store, UserStore, Signals>()

// Global: everyone sees this
const addMessage = app.action("addMessage", { text: Schema.String }, (ctx, { text }) => {
  ctx.update((s) => ({ ...s, messages: [...s.messages, text] }))
})

// Per-user: only this session sees this
const setTheme = app.action("setTheme", { theme: Schema.String }, (ctx, { theme }) => {
  ctx.updateUserStore((u) => ({ ...u, theme }))
})

// Client-side: instant UI state (server can also update via ctx.patchSignals)
const { tab } = app.signals
<button hs-on:click="$tab.value = 'settings'">Settings</button>
```

---

## Core API

### Actions

Actions modify state. Changes broadcast to all clients.

```tsx
// Simple action
const reset = app.action("reset", (ctx) => {
  ctx.update((s) => ({ ...s, count: 0 }))
})

// Action with validated arguments
const add = app.action("add", { amount: Schema.Number }, (ctx, { amount }) => {
  ctx.update((s) => ({ ...s, count: s.count + amount }))
})
```

### The `hs` Namespace

Use `hs.*` helpers with the `$` prop for reactive behavior:

```tsx
// Trigger action on click
<button $={hs.action(increment)}>+1</button>

// Trigger action on a specific event (with modifiers)
<input $={hs.actionOn("input", search, { q: query }, { debounce: 200 })} />

// Form submission
<form $={hs.form(addTodo)}>
  <input name="text" $={hs.bind(text)} />
  <button type="submit">Add</button>
</form>

// Conditional visibility
<div $={hs.show(isVisible)}>Only shown when visible</div>

// Dynamic classes
<div $={hs.class("active", isActive)}>...</div>
```

### Signals (Client State)

Signals are client-side state - private to each browser tab, instant updates, no server roundtrip.

```tsx
interface Signals {
  tab: "home" | "settings"
  text: string
}

const app = createHyperstar<Store, {}, Signals>()
const { tab, text } = app.signals

app.app({
  store: { ... },
  signals: { tab: "home", text: "" },
  view: (ctx) => (
    <div id="app">
      {/* Instant tab switching - no server call */}
      <button hs-on:click="$tab.value = 'home'">Home</button>
      <button hs-on:click="$tab.value = 'settings'">Settings</button>

      {/* Show/hide based on signal */}
      <div hs-show={tab.is("home")}>Home content</div>
      <div hs-show={tab.is("settings")}>Settings content</div>
    </div>
  ),
})
```

## Examples

```bash
git clone https://github.com/longtailLABS/hyperstar
cd hyperstar && bun install

bun --hot examples/counter.tsx           # Basic counter
bun --hot examples/todos.tsx             # Full todo app
bun --hot examples/chat-room.tsx         # Multi-user chat
bun --hot examples/dsl-showcase.tsx      # DSL helpers showcase
bun --hot examples/dashboard.tsx         # Live metrics dashboard
bun --hot examples/sqlite-notes.tsx      # SQLite persistence
bun --hot examples/state-types.tsx       # Store vs UserStore vs Signals
bun --hot examples/fps.tsx               # 60fps game loop
```

---

## Deployment

Hyperstar apps are just Bun servers - deploy anywhere you can run `bun run app.tsx`. The CLI has built-in support for [Fly.io Sprites](https://sprites.dev/), lightweight VMs that hibernate when idle.

Create a `hyperstar.json` in your project root:

```json
{
  "name": "my-app",
  "entrypoint": "app.tsx"
}
```

### Managed Hosting (Quick Start)

> [!WARNING]
> **Managed hosting is for quick testing only.** It may be taken down at any time without notice. Do not deploy anything critical. Use your own Sprites token for persistent deployments.

```bash
bunx hyperstar-cli deploy --managed
```

No account needed. Deploy instantly via longtailLABS.

### Self-Deploy (Recommended)

For full control, use your own [Fly.io Sprites](https://sprites.dev/) token:

```bash
export SPRITE_TOKEN=your_token
bunx hyperstar-cli deploy
```

> [!NOTE]
> **Sprites and Background Tasks** - Sprites hibernate when idle to save costs. When a sprite sleeps, `app.repeat()` and `app.cron()` timers pause. They resume when a user reconnects. For apps that need always-on timers (like polling external APIs), deploy to a traditional always-on server instead.

### Other Platforms

Since Hyperstar apps are standard Bun servers, deploy anywhere:

```bash
# Any VM/VPS
bun install && bun run app.tsx

# Docker
FROM oven/bun
COPY . .
RUN bun install
CMD ["bun", "run", "app.tsx"]
```

---

## Advanced Features

### Async Actions

Actions can be async for API calls, streaming, etc:

```tsx
const fetchData = app.action("fetchData", async (ctx) => {
  ctx.update((s) => ({ ...s, loading: true }))
  const data = await fetch("/api/data").then((r) => r.json())
  ctx.update((s) => ({ ...s, data, loading: false }))
})
```

### Background Jobs: Repeat vs Cron

Hyperstar has two ways to run background tasks. Choose based on your use case:

| Type | Best For | Key Feature |
|------|----------|-------------|
| **Repeat** | Games, animations, heartbeats, polling | Conditional execution + FPS tracking |
| **Cron** | Scheduled jobs | Cron expressions + per-user handlers |

**Repeat** - Time-based repeating tasks (replaces timer + interval):

```tsx
// Game loop with FPS tracking
app.repeat("gameLoop", {
  every: 16,                  // ~60fps in milliseconds
  when: (s) => s.running,     // Only run when true (pause/resume)
  trackFps: true,             // Enables ctx.fps
  handler: (ctx) => {
    ctx.update((s) => ({ ...s, frame: s.frame + 1, fps: ctx.fps }))
  },
})

// Simple heartbeat
app.repeat("heartbeat", {
  every: "5 seconds",         // Duration string
  handler: (ctx) => {
    ctx.update((s) => ({ ...s, lastPing: Date.now() }))
  },
})

// Duration formats:
app.repeat("fast", { every: 100, ... })           // 100ms (number)
app.repeat("poll", { every: "500 millis", ... })  // 500ms
app.repeat("sync", { every: "30 seconds", ... })  // 30s
app.repeat("refresh", { every: "5 minutes", ... }) // 5m
app.repeat("report", { every: "1 hour", ... })    // 1h
```

**Cron** - Scheduled jobs with calendar-based timing:

```tsx
app.cron("cleanup", {
  every: "0 * * * *",         // Every hour (cron syntax)
  handler: (ctx) => {
    ctx.update((s) => ({ ...s, messages: s.messages.slice(-100) }))
  },
})

// Or run per-user (great for session cleanup):
app.cron("sessionSync", {
  every: "30 seconds",        // Also accepts duration strings
  forEachUser: (ctx) => {
    ctx.updateUser((u) => ({ ...u, lastSeen: Date.now() }))
  },
})
```

### Lifecycle Hooks

```tsx
app.app({
  store: { online: 0 },

  onStart: (ctx) => {
    // Called once when server starts
    console.log("Server started")
  },

  onConnect: (ctx) => {
    // Called when a client connects
    ctx.update((s) => ({ ...s, online: s.online + 1 }))
  },

  onDisconnect: (ctx) => {
    // Called when a client disconnects
    ctx.update((s) => ({ ...s, online: s.online - 1 }))
  },

  view: (ctx) => ...
})
```

### Persistence

Auto-save store to JSON:

```tsx
app.app({
  store: { todos: [] },
  persist: "./data/todos.json",
  view: (ctx) => ...
})
```

### SQLite (Direct Disk Access)

Since Hyperstar runs on a single server (perfect for lightweight VMs like Sprites), you can read/write directly to disk. No external database needed:

```tsx
import { Database } from "bun:sqlite"
import { createHyperstar, hs, Schema } from "hyperstar"

const db = new Database("./data/notes.db")
db.run(`CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
)`)

interface Store { refresh: number }
const app = createHyperstar<Store>()

const addNote = app.action("addNote", { title: Schema.String }, (ctx, { title }) => {
  db.run("INSERT INTO notes (id, title) VALUES (?, ?)", [crypto.randomUUID(), title])
  ctx.update((s) => ({ ...s, refresh: s.refresh + 1 })) // Trigger re-render
})

app.app({
  store: { refresh: 0 },
  view: (ctx) => {
    const notes = db.query("SELECT * FROM notes ORDER BY created_at DESC").all()
    return (
      <div id="app">
        <ul>{notes.map((n: any) => <li id={n.id}>{n.title}</li>)}</ul>
      </div>
    )
  },
}).serve({ port: 3000 })
```

No ORM, no connection pooling, no Redis - just `bun:sqlite`. This works because:
- Hyperstar apps run on a single server instance
- Bun's SQLite is synchronous and fast

### Dynamic Title and Favicon

```tsx
app.app({
  store: { unreadCount: 0, status: "idle" },

  // Dynamic title with notification badge
  title: ({ store }) =>
    store.unreadCount > 0 ? `(${store.unreadCount}) My App` : "My App",

  // Dynamic favicon based on status
  favicon: ({ store }) =>
    store.status === "active"
      ? "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🟢</text></svg>"
      : "/favicon.ico",

  view: (ctx) => ...
})

// Or update programmatically in actions:
const notify = app.action("notify", (ctx) => {
  ctx.head.setTitle("New message!")
  ctx.head.setFavicon("/alert.ico")
})
```

### Signal Expression Composition

Signals have typed methods that compose:

```tsx
const { filter, count, isOpen } = app.signals

// Methods based on type
filter.is("active")          // "$filter.value === 'active'"
count.gt(5)                  // "$count.value > 5"
isOpen.toggle()              // "$isOpen.value = !$isOpen.value"

// Composition
filter.is("active").and(count.gt(0))
filter.is("all").or(isOpen)
isOpen.not()
```

### UserStore (Per-Session Server State)

State that's private to each session but persists on the server:

```tsx
interface UserStore {
  theme: "light" | "dark"
}

const app = createHyperstar<Store, UserStore, Signals>()

const setTheme = app.action("setTheme", { theme: Schema.String }, (ctx, { theme }) => {
  ctx.updateUserStore((u) => ({ ...u, theme }))
})

app.app({
  store: { ... },
  userStore: { theme: "light" },
  view: (ctx) => (
    <div class={ctx.userStore.theme === "dark" ? "dark" : ""}>...</div>
  ),
})
```

---

## Patterns

### Countdown Timer

A timer that counts down and stops at zero:

```tsx
import { createHyperstar, hs } from "hyperstar"

interface Store {
  timeLeft: number
  running: boolean
}

const app = createHyperstar<Store>()

const start = app.action("start", (ctx) => {
  ctx.update((s) => ({ ...s, running: true, timeLeft: 60 }))
})

const stop = app.action("stop", (ctx) => {
  ctx.update((s) => ({ ...s, running: false }))
})

app.repeat("countdown", {
  every: "1 second",
  when: (s) => s.running && s.timeLeft > 0,
  handler: (ctx) => {
    ctx.update((s) => {
      const newTime = s.timeLeft - 1
      return { ...s, timeLeft: newTime, running: newTime > 0 }
    })
  },
})

app.app({
  store: { timeLeft: 60, running: false },
  view: (ctx) => (
    <div id="app" class="p-8 text-center">
      <div class="text-6xl font-mono mb-4">{ctx.store.timeLeft}s</div>
      {!ctx.store.running ? (
        <button $={hs.action(start)} class="px-4 py-2 bg-green-500 text-white rounded">
          Start
        </button>
      ) : (
        <button $={hs.action(stop)} class="px-4 py-2 bg-red-500 text-white rounded">
          Stop
        </button>
      )}
    </div>
  ),
}).serve({ port: 3000 })
```

### Live API Polling

Fetch data from an external API on an interval:

```tsx
import { createHyperstar } from "hyperstar"

interface Store {
  price: number | null
  lastUpdated: string | null
  error: string | null
}

const app = createHyperstar<Store>()

app.repeat("fetchPrice", {
  every: "10 seconds",
  handler: async (ctx) => {
    try {
      const res = await fetch("https://api.example.com/price")
      const { price } = await res.json()
      ctx.update((s) => ({
        ...s,
        price,
        lastUpdated: new Date().toISOString(),
        error: null,
      }))
    } catch (e) {
      ctx.update((s) => ({ ...s, error: "Failed to fetch price" }))
    }
  },
})

app.app({
  store: { price: null, lastUpdated: null, error: null },
  view: (ctx) => (
    <div id="app" class="p-8">
      {ctx.store.error ? (
        <div class="text-red-500">{ctx.store.error}</div>
      ) : (
        <>
          <div class="text-4xl">${ctx.store.price ?? "..."}</div>
          <div class="text-gray-500 text-sm">
            Updated: {ctx.store.lastUpdated ?? "never"}
          </div>
        </>
      )}
    </div>
  ),
}).serve({ port: 3000 })
```

### Typing Indicator

Show who's typing with auto-expiry:

```tsx
import { createHyperstar, hs, Schema } from "hyperstar"

interface TypingUser {
  name: string
  timestamp: number
}

interface Store {
  messages: { id: string; name: string; text: string }[]
  typing: TypingUser[]
}

interface Signals {
  name: string
  text: string
}

const app = createHyperstar<Store, {}, Signals>()
const { name, text } = app.signals

const sendMessage = app.action("send", { name: Schema.String, text: Schema.String }, (ctx, args) => {
  ctx.update((s) => ({
    ...s,
    messages: [...s.messages, { id: crypto.randomUUID(), ...args }],
    typing: s.typing.filter((t) => t.name !== args.name),
  }))
  ctx.patchSignals({ text: "" })
})

const setTyping = app.action("typing", { name: Schema.String }, (ctx, { name }) => {
  ctx.update((s) => ({
    ...s,
    typing: [
      ...s.typing.filter((t) => t.name !== name),
      { name, timestamp: Date.now() },
    ],
  }))
})

// Auto-clear stale typing indicators
app.repeat("clearTyping", {
  every: "1 second",
  handler: (ctx) => {
    const now = Date.now()
    ctx.update((s) => ({
      ...s,
      typing: s.typing.filter((t) => now - t.timestamp < 3000),
    }))
  },
})

app.app({
  store: { messages: [], typing: [] },
  signals: { name: "", text: "" },
  view: (ctx) => (
    <div id="app" class="p-4 max-w-md mx-auto">
      <div class="space-y-2 mb-4">
        {ctx.store.messages.map((m) => (
          <div id={m.id}><b>{m.name}:</b> {m.text}</div>
        ))}
      </div>

      {ctx.store.typing.length > 0 && (
        <div class="text-gray-500 text-sm italic mb-2">
          {ctx.store.typing.map((t) => t.name).join(", ")} typing...
        </div>
      )}

      <form $={hs.form(sendMessage)} class="flex gap-2">
        <input name="name" $={hs.bind(name)} placeholder="Name" class="border p-2 w-24" />
        <input
          name="text"
          $={hs.bind(text)}
          placeholder="Message"
          class="border p-2 flex-1"
          hs-on:input={`Hyperstar.dispatch('typing', { name: $name.value })`}
        />
        <button type="submit" class="bg-blue-500 text-white px-4">Send</button>
      </form>
    </div>
  ),
}).serve({ port: 3000 })
```

### Smooth Animation

Animate values smoothly with easing:

```tsx
import { createHyperstar, hs, Schema } from "hyperstar"

interface Store {
  current: number
  target: number
}

const app = createHyperstar<Store>()

const setTarget = app.action("setTarget", { value: Schema.Number }, (ctx, { value }) => {
  ctx.update((s) => ({ ...s, target: value }))
})

app.repeat("animate", {
  every: 16, // ~60fps
  when: (s) => Math.abs(s.current - s.target) > 0.5,
  handler: (ctx) => {
    ctx.update((s) => ({
      ...s,
      current: s.current + (s.target - s.current) * 0.1, // Easing
    }))
  },
})

app.app({
  store: { current: 0, target: 0 },
  view: (ctx) => (
    <div id="app" class="p-8">
      <div
        class="w-16 h-16 bg-blue-500 rounded-lg transition-none"
        style={`transform: translateX(${ctx.store.current}px)`}
      />
      <div class="mt-8 space-x-2">
        <button $={hs.action(setTarget, { value: 0 })} class="px-4 py-2 bg-gray-200 rounded">
          Left
        </button>
        <button $={hs.action(setTarget, { value: 200 })} class="px-4 py-2 bg-gray-200 rounded">
          Right
        </button>
      </div>
      <div class="mt-4 text-gray-500">
        Position: {Math.round(ctx.store.current)}px
      </div>
    </div>
  ),
}).serve({ port: 3000 })
```

### Session Cleanup with Cron

Clean up inactive sessions periodically:

```tsx
import { createHyperstar } from "hyperstar"

interface Store {
  activeSessions: number
}

interface UserStore {
  lastActivity: number
}

const app = createHyperstar<Store, UserStore>()

// Update activity timestamp on any action
const ping = app.action("ping", (ctx) => {
  ctx.updateUserStore((u) => ({ ...u, lastActivity: Date.now() }))
})

// Clean up inactive sessions every minute
app.cron("sessionCleanup", {
  every: "1 minute",
  forEachUser: (ctx) => {
    const inactiveFor = Date.now() - ctx.getUserStore().lastActivity
    if (inactiveFor > 5 * 60 * 1000) {
      // 5 minutes inactive
      console.log(`Session ${ctx.sessionId} inactive, cleaning up...`)
      // Perform cleanup logic here
    }
  },
})

app.app({
  store: { activeSessions: 0 },
  userStore: { lastActivity: Date.now() },
  onConnect: (ctx) => ctx.update((s) => ({ ...s, activeSessions: s.activeSessions + 1 })),
  onDisconnect: (ctx) => ctx.update((s) => ({ ...s, activeSessions: s.activeSessions - 1 })),
  view: (ctx) => (
    <div id="app" class="p-8">
      <div>Active sessions: {ctx.store.activeSessions}</div>
    </div>
  ),
}).serve({ port: 3000 })
```

---

## Philosophy

Hyperstar is for building **simple, real-time apps fast**. It's not trying to replace Next.js or Rails.

**Great for:** Internal tools, prototypes, multiplayer games, live dashboards, chat apps.

**Not built for:** Multi-page SEO sites, offline-first apps, complex client-side interactions.

---

## License

MIT
