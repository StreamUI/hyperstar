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
  // Store operations
  ctx.update((s) => ({ ...s, ... }))      // Update shared store
  ctx.getStore()                           // Get current store
  ctx.updateUserStore((u) => ({ ... }))    // Update per-session state
  ctx.getUserStore()                       // Get per-session state

  // Client state
  ctx.patchSignals({ text: "" })           // Update signals for this user

  // Session info
  ctx.sessionId                            // Current session ID (shorthand)
  ctx.session.id                           // Full session object
  ctx.session.connectedAt                  // Connection timestamp

  // Head management
  ctx.head.setTitle("New Title")           // Update page title
  ctx.head.setFavicon("/icon.ico", "image/x-icon")  // Update favicon

  // Broadcasting
  ctx.broadcast({ type: "custom", data })  // Send SSE event to all clients
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
// Actions & Forms
hs.action(action, args?)           // Trigger action on click
hs.actionOn(event, action, args?, mods?)  // Action on specific event
hs.form(action, args?)             // Submit form to action

// Two-way binding
hs.bind(signal)                    // Bind signal to input/textarea/select

// Visibility & Styling
hs.show(condition)                 // Show/hide element
hs.class(className, condition)     // Toggle CSS class
hs.attr(name, condition)           // Conditional attribute
hs.style(property, value)          // Dynamic inline style
hs.disabled(condition)             // Disable element
hs.text(signal)                    // Set text content from signal

// Events & Expressions
hs.on(event, handler, mods?)       // Bind event to expression
hs.expr(code)                      // Create client-side expression
hs.seq(...exprs)                   // Sequence multiple expressions

// Element References & Init
hs.ref(name)                       // Create element reference ($refs.name)
hs.init(code)                      // Run code when element created

// Dynamic Content
hs.html(content)                   // Set innerHTML (use carefully)

// Drag and Drop
hs.drag(dataKey, dataValue)        // Make element draggable
hs.drop(action, keyFrom, keyTo, extraArgs?)  // Make drop target
```

### Event Modifiers

```tsx
// hs.on and hs.actionOn support modifiers
$={hs.on("input", signal.set("value"), { debounce: 300 })}
$={hs.actionOn("change", saveAction, { id }, { throttle: 500 })}

// Available modifiers:
// debounce: ms    - Debounce the handler
// throttle: ms    - Throttle the handler
// once: true      - Only fire once
// prevent: true   - preventDefault()
// stop: true      - stopPropagation()
// outside: true   - Only fire for clicks outside element
// capture: true   - Use capture phase
// passive: true   - Passive event listener
// self: true      - Only fire if target is the element itself
```

### Builder Utilities

```tsx
// Start a builder chain for complex compositions
hs.builder().action(save).class("active", isActive).show(isVisible)

// Toggle between two class sets
hs.toggle(isDark, "bg-gray-900 text-white", "bg-white text-gray-900")

// Compose multiple builders
hs.compose(
  hs.action(save),
  hs.class("active", isActive),
  hs.show(isVisible)
)
```

## Signals

Signals are client-side state with typed methods:

```tsx
interface Signals {
  filter: "all" | "active" | "done"
  text: string
  count: number
  isOpen: boolean
  editingId: string | null
}

const app = createHyperstar<Store, {}, Signals>()
const { filter, text, count, isOpen, editingId } = app.signals

// Common for all signals
signal.expr                 // Raw expression: "$signal.value"
signal.set(value)           // Set signal: "$signal.value = 'x'"
signal.patch(value)         // Create patch object: { signal: value }

// String/enum signal
filter.is("active")         // "$filter.value === 'active'"
filter.isNot("done")        // "$filter.value !== 'done'"
filter.oneOf(["a", "b"])    // Check against multiple values
filter.noneOf(["x", "y"])   // Not one of values
text.isEmpty()              // "$text.value === ''"
text.isNotEmpty()           // "$text.value !== ''"

// Number signal
count.eq(0)                 // "$count.value === 0"
count.gt(5)                 // "$count.value > 5"
count.gte(5)                // "$count.value >= 5"
count.lt(10)                // "$count.value < 10"
count.lte(10)               // "$count.value <= 10"
count.oneOf([1, 2, 3])      // Multiple value check
count.noneOf([0])           // Not one of values

// Boolean signal
isOpen.is(true)             // "$isOpen.value === true"
isOpen.toggle()             // "$isOpen.value = !$isOpen.value"
isOpen.setTrue()            // "$isOpen.value = true"
isOpen.setFalse()           // "$isOpen.value = false"

// Nullable signal
editingId.isNull()          // "$editingId.value === null"
editingId.isNotNull()       // "$editingId.value !== null"
editingId.is("abc")         // "$editingId.value === 'abc'"
editingId.clear()           // "$editingId.value = null"
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

You can use `hs-*` attributes directly instead of the `$` prop:

```tsx
// Events
<button hs-on:click="$count.value++">Increment</button>
<button hs-on:click={count.toggle()}>Toggle</button>

// Show/hide
<div hs-show={tab.is("home")}>Home content</div>
<div hs-show="$loading.value">Loading...</div>

// Dynamic classes
<button hs-class:bg-blue-500={filter.is("all")}>All</button>
<div hs-class:opacity-50="$disabled.value">Maybe dim</div>

// Conditional attributes
<button hs-attr:disabled="!$valid.value">Submit</button>
<input hs-attr:readonly={isLocked.is(true)} />

// Dynamic styles
<div hs-style:background-color="$color.value">Colored</div>
<div hs-style:width="$progress.value + '%'">Bar</div>

// Text and HTML content
<span hs-text="$name.value"></span>
<div hs-html="$htmlContent.value"></div>

// Element references
<input hs-ref="myInput" />
<!-- Access via: $refs.myInput.focus() -->

// Initialization
<div hs-init="console.log('element created')">...</div>

// Two-way binding
<input hs-bind="text" />
<input $={hs.bind(text)} />  <!-- Equivalent -->
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

## Triggers (Store Change Watchers)

React to specific store value changes:

```tsx
// Watch global store changes
app.trigger("count-watcher", {
  watch: (s) => s.count,           // Derived value to watch
  handler: (ctx, { oldValue, newValue }) => {
    console.log(`Count changed: ${oldValue} → ${newValue}`)
  },
})

// Watch per-user store changes
app.userTrigger("theme-changed", {
  watch: (u) => u.theme,
  handler: (ctx, { oldValue, newValue, sessionId }) => {
    console.log(`User ${sessionId} changed theme`)
  },
})
```

## HTTP Endpoints

Add custom HTTP routes:

```tsx
// Simple GET endpoint
app.http("/api/status", (ctx) => {
  return Response.json({ status: "ok", count: ctx.getStore().count })
})

// POST with method config
app.http("/webhook", {
  method: "POST",
  handler: async (ctx) => {
    const body = await ctx.request.json()
    ctx.update((s) => ({ ...s, lastWebhook: body }))
    return Response.json({ received: true })
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

// With options
app.app({
  store: { todos: [] },
  persist: {
    path: "./data/todos.json",
    debounceMs: 200,             // Debounce writes (default: 100)
  },
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

## App Configuration

```tsx
app.app({
  // State
  store: { count: 0 },              // Initial global state
  userStore: { theme: "light" },    // Initial per-session state
  signals: { text: "" },            // Initial signal values

  // View
  view: (ctx) => <div id="app">...</div>,

  // Dynamic head
  title: "Static" | ({ store, userStore }) => "Dynamic",
  favicon: "/icon.ico" | ({ store }) => "/dynamic.ico",

  // Persistence
  persist: "./data.json" | { path: "...", debounceMs: 100 },

  // Background task control
  autoPauseWhenIdle: true,          // Pause repeat/cron when no clients (default: true)

  // Lifecycle
  onStart: (ctx) => { },
  onConnect: (ctx) => { },
  onDisconnect: (ctx) => { },
}).serve({
  port: 8080,                       // Default: 8080
  hostname: "0.0.0.0",              // Default: 0.0.0.0
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

### Drag and drop (Kanban style)

```tsx
const moveCard = app.action("moveCard", {
  cardId: Schema.String,
  targetColumnId: Schema.String,
}, (ctx, { cardId, targetColumnId }) => {
  ctx.update((s) => ({
    ...s,
    cards: s.cards.map((c) =>
      c.id === cardId ? { ...c, columnId: targetColumnId } : c
    ),
  }))
})

// Draggable card
<div $={hs.drag("cardId", card.id)}>
  {card.title}
</div>

// Drop target column
<div $={hs.drop(moveCard, "cardId", "cardId", { targetColumnId: column.id })}>
  {column.cards.map((card) => ...)}
</div>
```

### Debounced search

```tsx
const { query } = app.signals

const search = app.action("search", { q: Schema.String }, async (ctx, { q }) => {
  ctx.update((s) => ({ ...s, loading: true }))
  const results = await fetchResults(q)
  ctx.update((s) => ({ ...s, results, loading: false }))
})

// Debounce input to avoid too many requests
<input
  $={hs.bind(query).actionOn("input", search, { q: query }, { debounce: 300 })}
  placeholder="Search..."
/>
```

### Sequencing expressions

```tsx
const { text, filter } = app.signals

// Clear multiple signals and focus input
<button
  $={hs.on("click", hs.seq(
    text.set(""),
    filter.set("all"),
    hs.expr("$refs.input.focus()")
  ))}
>
  Reset
</button>

<input $={hs.ref("input").bind(text)} />
```
