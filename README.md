<img src="assets/hyperstar.jpg" alt="Hyperstar" width="250" />

# Hyperstar

> [!TIP]
> **Built for Vibe Coding** - While the UI builder syntax isn't as pretty as JSX, Hyperstar is optimized for LLM code generation with powerful server-driven capabilities and end-to-end type safety. Let Claude write your UI.

**Server-driven UI for real-time web apps. No client code. No state sync. Just TypeScript.**

A hypermedia-inspired framework for Bun where the server owns the state and the UI updates automatically across all connected clients. Inspired by [Phoenix LiveView](https://hexdocs.pm/phoenix_live_view/), [Datastar](https://data-star.dev/), and [HTMX](https://htmx.org/).

## Get Started

```bash
# Create a new project
bunx hyperstar-cli create my-app
cd my-app
bun install

# Start dev server (with hot reload)
bun run dev
```

Open http://localhost:3000 - you have a working app. Edit `app.ts` and save - the browser updates instantly.

Now edit `app.ts`:

```ts
import { createHyperstar, UI, on } from "hyperstar"

interface Store { count: number }

const hs = createHyperstar<Store>()

const inc = hs.action("inc", (ctx) => {
  ctx.update((s) => ({ ...s, count: s.count + 1 }))
})

hs.app({
  store: { count: 0 },
  view: (ctx) =>
    UI.div(
      { attrs: { id: "app" } },
      UI.h1({}, `Count: ${ctx.store.count}`),
      UI.button(
        { events: { click: on.action(inc) } },
        "+1"
      )
    ),
}).serve({ port: 3000 })
```

Save and the browser hot-reloads. Open multiple tabs - they all sync in real-time.

Ready to ship? Deploy to [Fly.io Sprites](https://fly.io/sprites):

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

## Say Goodbye To

- **TanStack Query** - Server state IS the state. No fetching, no caching, no invalidation.
- **WebSocket boilerplate** - SSE streaming built-in. All clients sync automatically.
- **Client-side state management** - Redux? Zustand? Gone. State lives on the server.
- **Loading spinners everywhere** - Actions are instant. UI updates automatically.
- **"Why isn't this syncing?"** - One source of truth. Always consistent.

## Say Hello To

- **Server-driven UI** - Your backend controls the frontend. HTML over the wire.
- **Real-time by default** - All clients see the same state. SSE streaming keeps everyone in sync.
- **Type-safe signals** - Client-side state with full TypeScript inference. No `any` types.
- **Zero client JS to write** - You write server code. The framework handles the rest.
- **Single-file apps** - State, actions, view - all in one place. No build step required.
- **Multiplayer for free** - Every app is collaborative out of the box.

---

## Features

- **Server-Rendered, Server-Driven** - The server owns state and renders HTML. No virtual DOM.
- **Real-Time Sync via SSE** - Changes stream to all clients instantly. No WebSocket setup.
- **Type-Safe Signals** - Client state with full TypeScript inference and composable expressions.
- **Hypermedia Approach** - HTML attributes drive behavior. No client-side routing or bundling.
- **Immutable Updates** - Use `setStore()` for clean state management.
- **Zero Config Persistence** - Add `persist: true` and your store survives restarts.
- **~1000 Lines Total** - Small enough to understand. No magic.

---

## Installation

```bash
bun add hyperstar
```

Or just copy the `packages/hyperstar/src/` folder.

---

## Quick Examples

### Counter (Server State)

```ts
import { createHyperstar, UI, on } from "hyperstar"

interface Store { count: number }

const hs = createHyperstar<Store>()

const inc = hs.action("inc", (ctx) => {
  ctx.update((s) => ({ ...s, count: s.count + 1 }))
})

const dec = hs.action("dec", (ctx) => {
  ctx.update((s) => ({ ...s, count: s.count - 1 }))
})

hs.app({
  store: { count: 0 },
  view: (ctx) =>
    UI.div(
      { attrs: { id: "app", class: "p-8 text-center" } },
      UI.h1({ attrs: { class: "text-4xl font-bold" } }, String(ctx.store.count)),
      UI.button(
        { attrs: { class: "px-4 py-2 bg-red-500 text-white rounded" }, events: { click: on.action(dec) } },
        "-"
      ),
      UI.button(
        { attrs: { class: "px-4 py-2 bg-green-500 text-white rounded" }, events: { click: on.action(inc) } },
        "+"
      )
    ),
}).serve({ port: 3000 })
```

### Tabs (Client Signals - No Server Roundtrip)

```ts
import { createHyperstar, UI, on, $ } from "hyperstar"

interface Signals {
  tab: "home" | "about" | "contact"
}

const hs = createHyperstar<{}, {}, Signals>()
const { tab } = hs.signals

hs.app({
  store: {},
  signals: { tab: "home" },
  view: () =>
    UI.div(
      { attrs: { id: "app" } },
      UI.nav(
        { attrs: { class: "flex gap-2" } },
        UI.button(
          {
            attrs: { class: "px-3 py-1", "hs-class": `${tab.is("home")} ? 'bg-blue-500' : ''` },
            events: { click: on.signal("tab", $.str("home")) },
          },
          "Home"
        ),
        UI.button(
          {
            attrs: { class: "px-3 py-1", "hs-class": `${tab.is("about")} ? 'bg-blue-500' : ''` },
            events: { click: on.signal("tab", $.str("about")) },
          },
          "About"
        )
      ),
      UI.div({ attrs: { "hs-show": tab.is("home").toString() } }, "Welcome home!"),
      UI.div({ attrs: { "hs-show": tab.is("about").toString() } }, "About us...")
    ),
}).serve({ port: 3000 })
```

### Todo List (Hybrid)

```ts
import { createHyperstar, UI, on, $, Schema } from "hyperstar"

interface Todo { id: string; text: string; done: boolean }
interface Store { todos: Todo[] }
interface Signals { filter: "all" | "active" | "done"; text: string }

const hs = createHyperstar<Store, {}, Signals>()
const { filter, text } = hs.signals

const addTodo = hs.action("addTodo", { text: Schema.String }, (ctx, { text: t }) => {
  ctx.update((s) => ({
    ...s,
    todos: [...s.todos, { id: crypto.randomUUID(), text: t, done: false }],
  }))
  ctx.patchSignals({ text: "" }) // Clear input for THIS user only
})

const toggleTodo = hs.action("toggleTodo", { id: Schema.String }, (ctx, { id }) => {
  ctx.update((s) => ({
    ...s,
    todos: s.todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
  }))
})

hs.app({
  store: { todos: [] },
  signals: { filter: "all", text: "" },

  view: (ctx) => {
    const activeCount = ctx.store.todos.filter((t) => !t.done).length

    return UI.div(
      { attrs: { id: "app", class: "max-w-md mx-auto p-8" } },

      UI.h1({}, `Todos (${ctx.store.todos.length})`),

      // Filter tabs - instant, no server roundtrip
      UI.div(
        { attrs: { class: "flex gap-2 mb-4" } },
        UI.button(
          {
            attrs: { "hs-class": `${filter.is("all")} ? 'bg-blue-500 text-white' : ''` },
            events: { click: on.signal("filter", $.str("all")) },
          },
          "All"
        ),
        UI.button(
          {
            attrs: { "hs-class": `${filter.is("active")} ? 'bg-blue-500 text-white' : ''` },
            events: { click: on.signal("filter", $.str("active")) },
          },
          `Active (${activeCount})`
        )
      ),

      // Add form - server action
      UI.form(
        {
          attrs: { class: "flex gap-2 mb-4" },
          events: {
            submit: on.seq(
              on.script("event.preventDefault()"),
              on.action(addTodo, { text: $.signal("text") })
            ),
          },
        },
        UI.input({
          attrs: { placeholder: "What needs to be done?", class: "flex-1 p-2 border", "hs-bind": "text" },
        }),
        UI.button({ attrs: { type: "submit" } }, "Add")
      ),

      // Todo list - hybrid filtering (server data + client filter)
      ...ctx.store.todos.map((todo) =>
        UI.div(
          {
            attrs: {
              id: `todo-${todo.id}`,
              class: "flex items-center gap-2 p-2",
              "hs-show": filter.is("all")
                .or(filter.is("active").and(!todo.done))
                .or(filter.is("done").and(todo.done))
                .toString(),
            },
          },
          UI.input({
            attrs: { type: "checkbox", ...(todo.done ? { checked: "checked" } : {}) },
            events: { click: on.prevent(on.action(toggleTodo, { id: todo.id })) },
          }),
          UI.span({ attrs: { class: todo.done ? "line-through" : "" } }, todo.text)
        )
      )
    )
  },
}).serve({ port: 3000 })
```

---

## Core Concepts

### 1. Store (Server State)

Shared across ALL connected clients. Changes broadcast to everyone.

```ts
hs.app({
  store: { count: 0, users: [] },
  // ...
})
```

### 2. Signals (Client State)

Private to each browser tab. Never broadcast. Perfect for UI state.

```ts
// Define signal types as a type parameter
interface Signals {
  isOpen: boolean
  tab: "a" | "b"
  count: number
  editingId: string | null
}

const hs = createHyperstar<Store, {}, Signals>()

// Get typed signal handles
const { isOpen, tab, count, editingId } = hs.signals

// Provide default values in app()
hs.app({
  store: { ... },
  signals: { isOpen: false, tab: "a", count: 0, editingId: null },
  view: (ctx) => {
    // Signal handles produce client-side expressions
    isOpen.toggle()         // "$isOpen.value = !$isOpen.value"
    tab.is("a")             // "$tab.value === 'a'"
    count.gt(5)             // "$count.value > 5"
    editingId.isNull()      // "$editingId.value === null"

    // Use with on.signal() to update
    on.signal("tab", $.str("b"))  // Sets $tab.value = "b"
  },
})
```

### 3. Actions (Modify Store)

State changes that broadcast to all clients. Can be sync or async.

```ts
const addItem = hs.action("addItem", { text: Schema.String }, (ctx, { text }) => {
  ctx.update((s) => ({
    ...s,
    items: [...s.items, { id: crypto.randomUUID(), text }],
  }))
  ctx.patchSignals({ text: "" }) // Clear input for triggering user only
})

// Async actions work too
const fetchData = hs.action("fetchData", async (ctx) => {
  ctx.update((s) => ({ ...s, loading: true }))
  const data = await fetch("/api/data").then((r) => r.json())
  ctx.update((s) => ({ ...s, data, loading: false }))
})
```

### 4. Derived State

Computed values from store. Just use regular functions during render.

```ts
view: (ctx) => {
  const activeCount = ctx.store.todos.filter((t) => !t.done).length

  return UI.span({}, `Active: ${activeCount}`)
}
```

---

## UI Builders

Build HTML with `UI.*` functions. Each takes an options object and children.

```ts
// Basic structure
UI.div(
  { attrs: { id: "app", class: "container" } },
  UI.h1({}, "Title"),
  UI.p({}, "Content")
)

// Events
UI.button(
  { events: { click: on.action(myAction) } },
  "Click me"
)

// Special attributes for client-side behavior
UI.div({
  attrs: {
    "hs-show": filter.is("active").toString(),     // Conditional visibility
    "hs-class": `${isOpen} ? 'bg-blue' : ''`,      // Dynamic classes
    "hs-bind": "inputText",                         // Two-way binding
  }
})
```

---

## Event Handlers (`on.*`)

The `on` namespace provides event handler builders. Use them in the `events` property of UI elements.

### Server Actions

Dispatch actions to modify server state (broadcasts to all clients):

```ts
// Simple button click
UI.button(
  { events: { click: on.action(increment) } },
  "+1"
)

// With static arguments
UI.button(
  { events: { click: on.action(deleteTodo, { id: "123" }) } },
  "Delete"
)

// With dynamic signal values (reads current input value)
UI.button(
  { events: { click: on.action(addTodo, { text: $.signal("newTodo") }) } },
  "Add"
)
```

### Client-Side Signal Updates

Update signals instantly without server roundtrip (private to user):

```ts
// Tab switching - instant, no server
UI.button(
  { events: { click: on.signal("tab", $.str("settings")) } },
  "Settings"
)

// Toggle boolean
UI.button(
  { events: { click: on.signal("isOpen", $.bool(true)) } },
  "Open Modal"
)

// Clear nullable (set to null)
UI.button(
  { events: { click: on.signal("editingId", $.null()) } },
  "Cancel Edit"
)

// Set number
UI.button(
  { events: { click: on.signal("page", $.num(1)) } },
  "First Page"
)
```

### Combining Handlers

Use `on.seq()` to run multiple handlers in sequence:

```ts
// Form submission: prevent default + dispatch action
UI.form(
  {
    events: {
      submit: on.seq(
        on.script("event.preventDefault()"),
        on.action(addTodo, { text: $.signal("newTodo") })
      ),
    },
  },
  UI.input({ attrs: { "hs-bind": "newTodo" } }),
  UI.button({ attrs: { type: "submit" } }, "Add")
)

// Edit button: set multiple signals at once
UI.button(
  {
    events: {
      click: on.seq(
        on.signal("editingId", $.str(item.id)),
        on.signal("editText", $.str(item.text))
      ),
    },
  },
  "Edit"
)
```

### Prevent Default

Use `on.prevent()` for checkboxes and links where you want server to control state:

```ts
// Checkbox: prevent browser toggle, let server update state
UI.input({
  attrs: { type: "checkbox", ...(todo.done ? { checked: "checked" } : {}) },
  events: { click: on.prevent(on.action(toggleTodo, { id: todo.id })) },
})

// Link that triggers action instead of navigation
UI.a(
  {
    attrs: { href: "#" },
    events: { click: on.prevent(on.action(loadMore)) },
  },
  "Load More"
)
```

---

## Expression Composition

Signal handles produce expressions that compose with `.and()`, `.or()`, `.not()`:

```ts
const { filter, count, isOpen } = hs.signals

// AND
filter.is("active").and(count.gt(0))
// → "($filter.value === 'active') && ($count.value > 0)"

// OR
isOpen.or(filter.is("all"))
// → "($isOpen.value) || ($filter.value === 'all')"

// NOT
isOpen.not()
// → "!($isOpen.value)"

// Hybrid: server value + client expression
filter.is("active").and(!todo.done)
// → "($filter.value === 'active') && false"  // todo.done embedded at render
```

---

## Persistence

Store can be automatically persisted to JSON file and restored on server restart:

```ts
// Custom path
hs.app({
  store: { todos: [] },
  persist: "./data/todos.json",
  view: (ctx) => { ... },
})
```

- Store is loaded from file on server start (falls back to config.store if file doesn't exist)
- Store is saved after every action (debounced to avoid excessive writes)
- Directory is created automatically if it doesn't exist

---

## Dynamic Title & Favicon

### Option 1: Reactive Functions

Title and favicon can be reactive functions that automatically update when store changes:

```ts
hs.app({
  store: { unreadCount: 0, status: "idle" },

  title: ({ store }) =>
    store.unreadCount > 0
      ? `(${store.unreadCount}) My App`
      : "My App",

  favicon: ({ store }) =>
    store.status === "active"
      ? "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔴</text></svg>"
      : "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⭐</text></svg>",

  view: ...
})
```

### Option 2: Direct Control in Actions

For more control, use `ctx.head.setTitle()` and `ctx.head.setFavicon()` directly in actions:

```ts
const increment = hs.action("increment", (ctx) => {
  ctx.update((s) => ({ ...s, count: s.count + 1 }))

  // Directly set the page title
  const count = ctx.getStore().count
  ctx.head.setTitle(`Count: ${count} | My App`)
})

const setStatus = hs.action(
  "setStatus",
  { status: Schema.String },
  (ctx, { status }) => {
    ctx.update((s) => ({ ...s, status }))

    // Directly set the favicon based on status
    const favicons = {
      idle: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⏸️</text></svg>",
      active: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>▶️</text></svg>",
      complete: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>✅</text></svg>",
    }
    ctx.head.setFavicon(favicons[status], "image/svg+xml")
  }
)

const addNotification = hs.action("addNotification", (ctx) => {
  ctx.update((s) => ({ ...s, notifications: s.notifications + 1 }))

  // Show notification count in title (like unread messages)
  const { notifications, count } = ctx.getStore()
  ctx.head.setTitle(`(${notifications}) Count: ${count} | My App`)
})
```

---

## Lifecycle Hooks

```ts
hs.app({
  store: { ... },

  onStart({ spawn, update }) {
    // Server started - spawn background tasks
    spawn(async (ctx) => {
      while (!ctx.signal.aborted) {
        await Bun.sleep(1000)
        ctx.update((s) => ({ ...s, tick: s.tick + 1 }))
      }
    })
  },

  onConnect({ session, update }) {
    // Client connected via SSE
    update((s) => ({ ...s, online: s.online + 1 }))
  },

  onDisconnect({ session, update }) {
    // Client disconnected
    update((s) => ({ ...s, online: s.online - 1 }))
  },

  view: (ctx) => { ... },
})
```

---

## How It Works

**Real-time means: all clients see the same store state.** When User A clicks a button that triggers an action, User B's browser instantly updates via SSE. The server is the single source of truth.

1. **Initial load**: Server renders full HTML page
2. **SSE connection**: Client opens persistent connection to `/sse`
3. **Store change**: Server re-renders view, streams HTML patch to ALL clients via SSE
4. **DOM morph**: Client patches the DOM efficiently (no full reload)
5. **Signal change**: Client-side only, instant, private to that browser tab
6. **Action**: Client POSTs to server → store updates → all clients get the patch

```
┌─────────────────────────────────────────────────────────────┐
│ Store (Server)                                              │
│ • Single source of truth                                    │
│ • Shared across ALL connected clients                       │
│ • Changes broadcast via SSE to everyone                     │
│ • User A adds a todo → User B sees it instantly             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Client Signals (Browser)                                    │
│ • Private to each browser tab                               │
│ • Never broadcast to other users                            │
│ • Perfect for UI state (tabs, modals, form inputs)          │
│ • ctx.patchSignals() sends to triggering user only          │
└─────────────────────────────────────────────────────────────┘
```

---

## Inspired By

Hyperstar stands on the shoulders of giants:

- [Phoenix LiveView](https://hexdocs.pm/phoenix_live_view/) - The OG server-rendered real-time UI
- [Datastar](https://data-star.dev/) - Reactive frontends with data-* attributes
- [HTMX](https://htmx.org/) - HTML-first interactivity, hypermedia as the engine
- [Convex](https://convex.dev/) - Reactive backend with queries/mutations pattern
- [Hypermedia Systems](https://hypermedia.systems/) - The philosophy behind it all

---

## Running Examples

```bash
# Clone the repo
git clone https://github.com/longtailLABS/hyperstar

# Install deps
bun install

# Run any example (with hot reload!)
bun --hot examples/counter.ts           # Basic counter
bun --hot examples/todos.ts             # Full todo app
bun --hot examples/chat-room.ts         # Multi-user chat
bun --hot examples/poll.ts              # Voting app
bun --hot examples/grid-game.ts         # Multiplayer game
bun --hot examples/llm-streaming.ts     # Streaming LLM chat
bun --hot examples/fps.ts               # FPS stress test
bun --hot examples/persistent-notes.ts  # JSON persistence
bun --hot examples/sqlite-notes.ts      # SQLite database

# Or use npm scripts
bun run example:counter
bun run example:todos
bun run example:chat

# Open the URL shown in console
# Open in multiple tabs to see real-time sync!
# Edit the file and save - browser hot-reloads!
```

---

## Deployment

Hyperstar apps are just Bun servers - deploy them anywhere you can run `bun run app.tsx`. The CLI provides built-in support for [Fly.io Sprites](https://fly.io/sprites), lightweight VMs that hibernate when idle and wake on request.

### Quick Start

First, create a `hyperstar.json` in your project root:

```json
{
  "name": "my-app",
  "entrypoint": "app.ts"
}
```

Then deploy:

```bash
# Managed hosting (no auth required)
hyperstar deploy --managed
```

That's it. Your app is live with a public URL.

### Deployment Options

#### 1. Managed Hosting (Recommended for getting started)

No account needed. Deploy instantly via longtailLABS:

```bash
hyperstar deploy --managed
```

- No authentication required
- Automatic bundling and upload
- Public URL provided

#### 2. Self-Deploy (Bring your own Sprites account)

For full control, use your own [Fly.io Sprites](https://fly.io/sprites) token:

```bash
# Get your token from https://fly.io/sprites
export SPRITE_TOKEN=your_token

# Deploy
hyperstar deploy
```

Options:
- `--name, -n` - Override app name from hyperstar.json
- `--public` - Make app publicly accessible (default: true)

### How It Works

1. **Bundle** - CLI bundles your project (TypeScript, dependencies, assets)
2. **Upload** - Bundle is uploaded to Sprites
3. **Install** - Dependencies installed via `bun install`
4. **Start** - App starts with `bun run <entrypoint>`
5. **Checkpoint** - VM state saved for fast wake-up

### Hibernation

Sprites hibernate after ~5 minutes of inactivity. First request after hibernation takes 1-2 seconds to wake. Subsequent requests are instant.

### Other Platforms

Since Hyperstar apps are standard Bun servers, you can deploy anywhere:

```bash
# Any VM/VPS (DigitalOcean, Linode, EC2, etc.)
bun install && bun run app.ts

# Docker
FROM oven/bun
COPY . .
RUN bun install
CMD ["bun", "run", "app.ts"]

# Fly.io (non-Sprites)
fly launch --from-image oven/bun
```

Sprites are recommended for their hibernate-on-idle model - perfect for low-traffic apps where you don't want to pay for idle compute.

---

## Philosophy

Hyperstar is for building **simple, real-time apps fast**. It's not trying to be Next.js or Rails.

### Great For

- **Internal tools** - Admin dashboards, CRMs, data entry
- **Prototypes** - Get something working in an hour
- **Multiplayer experiences** - Games, collaborative editors
- **Live dashboards** - Real-time metrics, monitoring
- **Chat/messaging** - Instant message sync
- **Single-page apps** - Where real-time matters more than SEO

### Not Built For (Yet)

- **Multi-page websites** - No routing, no page navigation (single-page only)
- **Authentication** - No built-in auth, sessions, or user management
- **SEO-heavy sites** - Server renders HTML, but no meta tags, sitemap, etc.
- **Offline-first apps** - Requires constant server connection
- **Complex client interactions** - Heavy drag-and-drop, canvas, 3D

### The Trade-off

Hyperstar trades flexibility for simplicity. You get real-time sync and zero client-side state management headaches, but you're working with server-rendered HTML and simple client expressions. If you need React's component model or complex client-side routing, this isn't the right tool.

---

## License

MIT
