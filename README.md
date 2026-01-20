<img src="assets/hyperstar.jpg" alt="Hyperstar" width="250" />

# Hyperstar

> [!CAUTION]
> **Very Beta** - This is experimental software. The API changes frequently and will break your code. Don't use this for anything production-critical. Great for prototypes, internal tools, and fun real-time multiplayer apps.

**Server-driven UI for real-time web apps. No client code. No state sync. Just TypeScript + JSX.**

Inspired by [Phoenix LiveView](https://hexdocs.pm/phoenix_live_view/) | [Datastar](https://data-star.dev/) | [HTMX](https://htmx.org/)

> [!TIP]
> **Built for Vibe Coding** - JSX that feels like React, but there's no client bundle, no hydration, no state sync bugs. The server owns everything. Let Claude write your UI.

## Quick Start

```bash
bunx hyperstar-cli create my-app
cd my-app
bun install
bun run dev
```

Open http://localhost:3000 - you have a working app. Edit `app.tsx` and save - the browser updates instantly.

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

### The Old Way (Pain)

```
React + Next.js + TanStack Query + WebSockets + Redis + ...

1. Write React components
2. Set up API routes
3. Add TanStack Query for data fetching
4. Add WebSocket server for real-time
5. Sync client state with server state
6. Handle loading states everywhere
7. Deal with cache invalidation
8. Cry yourself to sleep
```

### The Hyperstar Way (Joy)

```
Hyperstar

1. Write a view function and actions to update state
2. Done. It's real-time. It syncs. It works.
```

---

## Installation

```bash
bun add hyperstar
```

---

## How It Works

1. Server renders HTML from your `view` function
2. Clients connect via SSE (Server-Sent Events)
3. When state changes, server re-renders and streams HTML diffs
4. Clients morph the DOM - no full page reload

**Real-time means all clients see the same state.** User A clicks a button, User B sees it instantly.

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

bun --hot examples/simple-counter.tsx    # Basic counter
bun --hot examples/todos.tsx             # Full todo app
bun --hot examples/chat-room.tsx         # Multi-user chat
bun --hot examples/fps-jsx.tsx           # FPS stress test
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

### Timers (Game Loops)

High-frequency state updates for games and animations:

```tsx
app.timer("gameLoop", {
  interval: 16,                    // ~60fps
  when: (s) => s.running,          // Only run when condition is true
  trackFps: true,                  // Track actual FPS
  handler: (ctx) => {
    ctx.update((s) => ({ ...s, frame: s.frame + 1, fps: ctx.fps }))
  },
})
```

### Intervals

Simple repeating tasks:

```tsx
app.interval("heartbeat", {
  every: "5 seconds",
  handler: (ctx) => {
    ctx.update((s) => ({ ...s, lastPing: Date.now() }))
  },
})
```

### Cron Jobs

Scheduled tasks:

```tsx
app.cron("cleanup", {
  schedule: "0 * * * *",  // Every hour
  handler: (ctx) => {
    ctx.update((s) => ({ ...s, messages: s.messages.slice(-100) }))
  },
})
```

### Lifecycle Hooks

```tsx
app.app({
  store: { online: 0 },

  onConnect: (ctx) => {
    ctx.update((s) => ({ ...s, online: s.online + 1 }))
  },

  onDisconnect: (ctx) => {
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

### Dynamic Title

```tsx
app.app({
  store: { unreadCount: 0 },
  title: ({ store }) =>
    store.unreadCount > 0 ? `(${store.unreadCount}) My App` : "My App",
  view: (ctx) => ...
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

## Philosophy

Hyperstar is for building **simple, real-time apps fast**. It's not trying to replace Next.js or Rails.

**Great for:** Internal tools, prototypes, multiplayer games, live dashboards, chat apps.

**Not built for:** Multi-page SEO sites, offline-first apps, complex client-side interactions.

---

## License

MIT
