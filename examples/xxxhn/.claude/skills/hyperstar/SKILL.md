---
name: hyperstar
description: Build real-time web apps with Hyperstar framework. Use when creating new hyperstar apps, adding features, writing actions, views, or working with signals and state management. Uses JSX syntax with the $ prop for reactive attributes.
---

# Hyperstar Framework

> **Very Beta** - API changes frequently. Great for prototypes and fun real-time multiplayer apps.

Hyperstar is a server-driven UI framework for Bun. Server owns state, clients sync automatically via SSE.

**Real-time = all clients see the same store.** User A makes a change, User B sees it instantly.

## Core Pattern

```tsx
import { createHyperstar, hs, Schema } from "hyperstar"

interface Store {
  count: number
}

interface Signals {
  text: string
}

// Create typed factory
const app = createHyperstar<Store, {}, Signals>()
const { text } = app.signals

// Actions = state changes (broadcast to all)
const increment = app.action("increment", (ctx) => {
  ctx.update((s) => ({ ...s, count: s.count + 1 }))
})

// App config
app.app({
  store: { count: 0 },
  signals: { text: "" },

  view: (ctx) => (
    <div id="app">
      <span>{ctx.store.count}</span>
      <button $={hs.action(increment)}>+1</button>
    </div>
  ),
}).serve({ port: 8080 })
```

## Store vs Signals vs UserStore

```
┌─────────────────────────────────────────────────────────────┐
│ ctx.store (Server State - Shared)                           │
│ • Shared across ALL connected clients                       │
│ • Changes broadcast via SSE to everyone                     │
│ • User A adds item → User B sees it instantly               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ ctx.userStore (Server State - Per-Session)                  │
│ • Private to each session (browser tab)                     │
│ • Stored on server, persists across page reloads            │
│ • Perfect for: theme, user preferences, voting state        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ signals (Client State)                                      │
│ • Private to each browser tab                               │
│ • Never broadcast to other users                            │
│ • Perfect for UI state: tabs, modals, form inputs           │
└─────────────────────────────────────────────────────────────┘
```

## Actions

Actions modify store. Changes broadcast to all clients.

```tsx
// Simple action (no args)
const reset = app.action("reset", (ctx) => {
  ctx.update((s) => ({ ...s, count: 0 }))
})

// Action with validated args (Effect Schema)
const addTodo = app.action("addTodo", { text: Schema.String }, (ctx, { text }) => {
  ctx.update((s) => ({
    ...s,
    todos: [...s.todos, { id: crypto.randomUUID(), text, done: false }],
  }))
  ctx.patchSignals({ text: "" }) // Clear input for THIS USER ONLY
})

// Async action
const fetchData = app.action("fetchData", async (ctx) => {
  ctx.update((s) => ({ ...s, loading: true }))
  const data = await fetch("/api/data").then((r) => r.json())
  ctx.update((s) => ({ ...s, data, loading: false }))
})
```

### Action Context

```tsx
const myAction = app.action("myAction", (ctx) => {
  ctx.update((s) => ({ ...s, ... }))     // Update shared store
  ctx.getStore()                          // Get current store
  ctx.updateUserStore((u) => ({ ... }))   // Update per-session state
  ctx.getUserStore()                      // Get per-session state
  ctx.patchSignals({ text: "" })          // Update client signals for this user
  ctx.sessionId                           // Current session ID
  ctx.head.setTitle("New Title")          // Update page title
})
```

## JSX with the `$` Prop

The `$` prop takes an `hs.*` helper for reactive attributes:

```tsx
// Trigger action on click
<button $={hs.action(increment)}>+1</button>

// Action with arguments
<button $={hs.action(deleteTodo, { id: todo.id })}>Delete</button>

// Form submission
<form $={hs.form(addTodo)}>
  <input name="text" $={hs.bind(text)} />
  <button type="submit">Add</button>
</form>

// Conditional visibility
<div $={hs.show(isVisible)}>Shown when visible</div>

// Dynamic classes
<div $={hs.class("active", isActive)}>...</div>

// Chaining
<div $={hs.show(isVisible).class("active", isActive)}>...</div>
```

## hs Namespace

```tsx
hs.action(action, args?)      // Trigger action on click
hs.form(action, args?)        // Submit form to action
hs.bind(signal)               // Two-way bind signal to input
hs.show(condition)            // Show/hide element
hs.class(className, condition) // Toggle CSS class
hs.disabled(condition)        // Disable element
hs.on(event, handler, mods?)  // Bind event to expression
hs.expr(code)                 // Create client-side expression
```

## Signals

Signals are client-side state with typed methods:

```tsx
interface Signals {
  filter: "all" | "active" | "done"
  text: string
  count: number
  editingId: string | null
}

const app = createHyperstar<Store, {}, Signals>()
const { filter, text, count, editingId } = app.signals

// String/enum signal
filter.is("active")        // "$filter.value === 'active'"
filter.isNot("done")       // "$filter.value !== 'done'"
text.isEmpty()             // "$text.value === ''"
text.isNotEmpty()          // "$text.value !== ''"

// Number signal
count.gt(5)                // "$count.value > 5"
count.lt(10)               // "$count.value < 10"
count.eq(0)                // "$count.value === 0"

// Nullable signal
editingId.isNull()         // "$editingId.value === null"
editingId.isNotNull()      // "$editingId.value !== null"
editingId.is("abc")        // "$editingId.value === 'abc'"
```

### Expression Composition

```tsx
// AND
filter.is("active").and(count.gt(0))

// OR
filter.is("all").or(filter.is("active"))

// NOT
isOpen.not()

// Hybrid (server value + client expression)
filter.is("active").and(!todo.done)
```

## Direct Attributes

You can also use `hs-*` attributes directly:

```tsx
// Direct signal update
<button hs-on:click="$tab.value = 'home'">Home</button>

// Show/hide
<div hs-show={tab.is("home")}>Home content</div>

// Dynamic class
<button hs-class:bg-blue-500={filter.is("all")}>All</button>
```

## Background Jobs: Repeat vs Cron

| Type | Best For | Key Feature |
|------|----------|-------------|
| **Repeat** | Games, animations, heartbeats, polling | `when` condition + `trackFps` |
| **Cron** | Scheduled jobs | Cron syntax + `forEachUser` |

**Repeat** - Time-based repeating tasks (replaces timer + interval):

```tsx
// Game loop with FPS tracking
app.repeat("gameLoop", {
  every: 16,                      // ms (~60fps) or duration string
  when: (s) => s.running,         // Only run when true
  trackFps: true,                 // Enables ctx.fps
  handler: (ctx) => {
    ctx.update((s) => ({ ...s, frame: s.frame + 1, fps: ctx.fps }))
  },
})

// Simple heartbeat
app.repeat("heartbeat", {
  every: "5 seconds",             // Duration string or ms
  handler: (ctx) => {
    ctx.update((s) => ({ ...s, lastPing: Date.now() }))
  },
})
```

**Cron** - Scheduled jobs:

```tsx
app.cron("cleanup", {
  every: "0 * * * *",             // Cron expression or "1 hour"
  handler: (ctx) => {
    ctx.update((s) => ({ ...s, messages: s.messages.slice(-100) }))
  },
})

// Per-user cron (session cleanup, etc):
app.cron("sessionSync", {
  every: "30 seconds",
  forEachUser: (ctx) => {
    ctx.updateUser((u) => ({ ...u, lastSeen: Date.now() }))
  },
})
```

## Lifecycle Hooks

```tsx
app.app({
  store: { online: 0 },

  onStart: (ctx) => {
    console.log("Server started")
  },

  onConnect: (ctx) => {
    ctx.update((s) => ({ ...s, online: s.online + 1 }))
  },

  onDisconnect: (ctx) => {
    ctx.update((s) => ({ ...s, online: s.online - 1 }))
  },

  view: (ctx) => ...
})
```

## Persistence

```tsx
app.app({
  store: { todos: [] },
  persist: "./data/todos.json",  // Auto-save on changes
  view: (ctx) => ...
})
```

## Dynamic Title and Favicon

```tsx
app.app({
  store: { unreadCount: 0, status: "idle" },

  // Dynamic title
  title: ({ store }) =>
    store.unreadCount > 0 ? `(${store.unreadCount}) My App` : "My App",

  // Dynamic favicon
  favicon: ({ store }) =>
    store.status === "active"
      ? "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🟢</text></svg>"
      : "/favicon.ico",

  view: ...
})

// Or update in actions:
const notify = app.action("notify", (ctx) => {
  ctx.head.setTitle("New message!")
  ctx.head.setFavicon("/alert.ico")
})
```

## SQLite (Direct Disk Access)

Since Hyperstar runs on a single server, use `bun:sqlite` directly:

```tsx
import { Database } from "bun:sqlite"
import { createHyperstar, Schema } from "hyperstar"

const db = new Database("./data/app.db")
db.run(`CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, name TEXT)`)

interface Store { refresh: number }
const app = createHyperstar<Store>()

const addItem = app.action("addItem", { name: Schema.String }, (ctx, { name }) => {
  db.run("INSERT INTO items (id, name) VALUES (?, ?)", [crypto.randomUUID(), name])
  ctx.update((s) => ({ ...s, refresh: s.refresh + 1 }))
})

app.app({
  store: { refresh: 0 },
  view: (ctx) => {
    const items = db.query("SELECT * FROM items").all()
    return <div id="app">{items.map((i: any) => <div id={i.id}>{i.name}</div>)}</div>
  },
})
```

## Important Rules

1. **Root element must have `id="app"`**
2. **Use ctx.update() for immutable store updates** - `ctx.update((s) => ({ ...s, ... }))`
3. **All clients share store** - Changes broadcast to everyone
4. **Signals are client-only** - Perfect for UI state
5. **Define actions before using in view** - Actions are variables

## Common Patterns

### Tabs (instant, no server roundtrip)

```tsx
interface Signals { tab: "home" | "settings" }
const app = createHyperstar<{}, {}, Signals>()
const { tab } = app.signals

app.app({
  store: {},
  signals: { tab: "home" },
  view: () => (
    <div id="app">
      <button hs-on:click="$tab.value = 'home'">Home</button>
      <button hs-on:click="$tab.value = 'settings'">Settings</button>
      <div hs-show={tab.is("home")}>Home content</div>
      <div hs-show={tab.is("settings")}>Settings content</div>
    </div>
  ),
})
```

### Hybrid filtering (server data + client filter)

```tsx
const { filter } = app.signals

// In view
{ctx.store.todos.map((todo) => (
  <div
    id={`todo-${todo.id}`}
    hs-show={filter.is("all")
      .or(filter.is("active").and(!todo.done))
      .or(filter.is("done").and(todo.done))
      }
  >
    {todo.text}
  </div>
))}
```

### Form with signal clearing

```tsx
const { text } = app.signals

const addItem = app.action("addItem", { text: Schema.String }, (ctx, { text: t }) => {
  ctx.update((s) => ({
    ...s,
    items: [...s.items, { id: crypto.randomUUID(), text: t }],
  }))
  ctx.patchSignals({ text: "" })  // Clear input for submitting user
})

// In view
<form $={hs.form(addItem)}>
  <input name="text" $={hs.bind(text)} />
  <button type="submit">Add</button>
</form>
```

### Edit mode with nullable signal

```tsx
interface Signals {
  editingId: string | null
  editText: string
}
const { editingId, editText } = app.signals

const saveEdit = app.action("saveEdit", { id: Schema.String, editText: Schema.String }, (ctx, { id, editText }) => {
  ctx.update((s) => ({
    ...s,
    items: s.items.map((i) => (i.id === id ? { ...i, text: editText } : i)),
  }))
  ctx.patchSignals({ editingId: null, editText: "" })
})

// View mode
<div hs-show={editingId.isNot(item.id)}>
  {item.text}
  <button hs-on:click={`$editingId.value = '${item.id}'; $editText.value = '${item.text}'`}>
    Edit
  </button>
</div>

// Edit mode
<form hs-show={editingId.is(item.id)} $={hs.form(saveEdit, { id: item.id })}>
  <input name="editText" $={hs.bind(editText)} />
  <button type="submit">Save</button>
  <button type="button" hs-on:click="$editingId.value = null">Cancel</button>
</form>
```

### Real-time chat

```tsx
interface Message { id: string; username: string; text: string }
interface Store { messages: Message[] }
interface Signals { username: string; text: string }

const app = createHyperstar<Store, {}, Signals>()
const { username, text } = app.signals

const sendMessage = app.action("sendMessage", {
  username: Schema.String.pipe(Schema.minLength(1)),
  text: Schema.String.pipe(Schema.minLength(1)),
}, (ctx, { username: user, text: msg }) => {
  ctx.update((s) => ({
    ...s,
    messages: [...s.messages, {
      id: crypto.randomUUID(),
      username: user,
      text: msg,
    }].slice(-100),
  }))
  ctx.patchSignals({ text: "" })
})

// In view
<form $={hs.form(sendMessage)}>
  <input name="username" $={hs.bind(username)} placeholder="Name" />
  <input name="text" $={hs.bind(text)} placeholder="Message" />
  <button
    type="submit"
    hs-show={username.isNotEmpty().and(text.isNotEmpty())}
  >
    Send
  </button>
</form>
```

### Session-based voting

```tsx
interface Store {
  options: { id: string; text: string; votes: number }[]
  voters: Record<string, true>
}

const vote = app.action("vote", { optionId: Schema.String }, (ctx, { optionId }) => {
  const store = ctx.getStore()
  if (ctx.sessionId in store.voters) return // Already voted

  ctx.update((s) => ({
    ...s,
    options: s.options.map((o) =>
      o.id === optionId ? { ...o, votes: o.votes + 1 } : o
    ),
    voters: { ...s.voters, [ctx.sessionId]: true },
  }))
})

// In view
const hasVoted = ctx.session.id in ctx.store.voters
{ctx.store.options.map((option) =>
  hasVoted
    ? <div>{option.text}: {option.votes} votes</div>
    : <button $={hs.action(vote, { optionId: option.id })}>{option.text}</button>
)}
```
