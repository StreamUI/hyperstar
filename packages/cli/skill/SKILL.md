---
name: hyperstar
description: Build real-time web apps with Hyperstar framework. Use when creating new hyperstar apps, adding features, writing actions, views, or working with signals and state management. Optimized for LLM code generation.
---

# Hyperstar Framework

> [!TIP]
> **Built for Vibe Coding** - Optimized for LLM code generation with powerful server-driven capabilities and end-to-end type safety.

Hyperstar is a minimal framework for real-time web apps with server-side state. Think "Redux on the server" - one store, one view function, all clients stay in sync automatically.

**Real-time = all clients see the same store.** When User A makes a change, User B sees it instantly via SSE.

## Core Pattern

```ts
import { createHyperstar, UI, on, $ } from "hyperstar"

interface Store {
  count: number
}

interface Signals {
  showHelp: boolean
}

// Create typed factory
const hs = createHyperstar<Store, {}, Signals>()
const { showHelp } = hs.signals

// Actions = state changes (broadcast to all)
const inc = hs.action("inc", (ctx) => {
  ctx.update((s) => ({ ...s, count: s.count + 1 }))
})

// App with signals
hs.app({
  store: { count: 0 },
  signals: { showHelp: false },

  view: (ctx) =>
    UI.div(
      { attrs: { id: "app" } },
      UI.span({}, String(ctx.store.count)),
      UI.button({ events: { click: on.action(inc) } }, "+1 (server)"),
      UI.button(
        { events: { click: on.signal("showHelp", $.bool(!showHelp)) } },
        "Toggle Help"
      ),
      UI.div({ attrs: { "hs-show": showHelp.toString() } }, "Help content here")
    ),
}).serve({ port: 3000 })
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
│ userStore (Server State - Per-Session)                      │
│ • Private to each session (browser tab)                     │
│ • Stored on server, persists across page reloads            │
│ • Perfect for: username, user preferences, voting state     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ signals (Client State)                                      │
│ • Private to each browser tab                               │
│ • Never broadcast to other users                            │
│ • Perfect for UI state: tabs, modals, form inputs           │
└─────────────────────────────────────────────────────────────┘
```

## Signal Types

Signals are defined as a type parameter and values provided in `app()`:

```ts
interface Signals {
  // Simple types
  isAdding: boolean
  text: string
  localCounter: number

  // Union types for enums
  filter: "all" | "active" | "done"

  // Nullable types
  editingId: string | null
}

const hs = createHyperstar<Store, {}, Signals>()

// Get typed signal handles
const { isAdding, text, filter, editingId } = hs.signals

// Provide default values in app()
hs.app({
  store: { ... },
  signals: {
    isAdding: false,
    text: "",
    localCounter: 0,
    filter: "all",
    editingId: null,
  },
  view: ...
})
```

## Signal Handle Methods

Signal handles produce client-side JavaScript expressions:

```ts
// Boolean signal
isAdding.toggle()         // "$isAdding.value = !$isAdding.value"
isAdding.setTrue()        // "$isAdding.value = true"
isAdding.setFalse()       // "$isAdding.value = false"
isAdding.not()            // "!$isAdding.value"

// String/enum signal
filter.is("active")       // "$filter.value === 'active'"
filter.isNot("done")      // "$filter.value !== 'done'"
text.isEmpty()            // "$text.value === ''"
text.isNotEmpty()         // "$text.value !== ''"

// Number signal
count.gt(5)               // "$count.value > 5"
count.gte(5)              // "$count.value >= 5"
count.lt(10)              // "$count.value < 10"
count.eq(0)               // "$count.value === 0"

// Nullable signal
editingId.is("abc")       // "$editingId.value === 'abc'"
editingId.isNot("x")      // "$editingId.value !== 'x'"
editingId.isNull()        // "$editingId.value === null"
editingId.isNotNull()     // "$editingId.value !== null"
```

## Expression Composition

Expressions compose with `.and()`, `.or()`, `.not()`:

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
// → "($filter.value === 'active') && false"  // todo.done embedded at render time
```

## Actions

Actions modify store and can be sync or async. Changes broadcast to all clients:

```ts
import { createHyperstar, Schema } from "hyperstar"

const hs = createHyperstar<Store, {}, Signals>()

// Simple action (no args)
const reset = hs.action("reset", (ctx) => {
  ctx.update((s) => ({ ...s, count: 0 }))
})

// Action with validated args (Effect Schema)
const addTodo = hs.action("addTodo", { text: Schema.String }, (ctx, { text }) => {
  ctx.update((s) => ({
    ...s,
    todos: [...s.todos, { id: crypto.randomUUID(), text, done: false }],
  }))

  // Clear input for THIS USER ONLY (not broadcast)
  ctx.patchSignals({ text: "" })
})

// Async action (for API calls, streaming, etc.)
const fetchData = hs.action("fetchData", async (ctx) => {
  ctx.update((s) => ({ ...s, loading: true }))
  const data = await fetch("/api/data").then((r) => r.json())
  ctx.update((s) => ({ ...s, data, loading: false }))
})
```

### Action Context

Actions receive a context object with these methods:

```ts
const myAction = hs.action("myAction", (ctx) => {
  // Store operations
  ctx.update((s) => ({ ...s, ... }))  // Update shared store
  ctx.getStore()                       // Get current store

  // User-scoped operations
  ctx.patchSignals({ text: "" })       // Update signals for triggering user only
  ctx.sessionId                        // Current session ID

  // Head manipulation
  ctx.head.setTitle("New Title")       // Update page title
  ctx.head.setFavicon("url", "type")   // Update favicon
})
```

## UI Builders

Build HTML with `UI.*` functions:

```ts
// Basic elements
UI.div({ attrs: { id: "app", class: "container" } }, ...children)
UI.span({}, "text content")
UI.button({ events: { click: handler } }, "Click me")
UI.input({ attrs: { type: "text", "hs-bind": "signalName" } })
UI.form({ events: { submit: handler } }, ...children)

// Special attributes for client-side behavior
UI.div({
  attrs: {
    "hs-show": expression.toString(),      // Conditional visibility
    "hs-class": "`${expr} ? 'a' : 'b'`",   // Dynamic classes
    "hs-bind": "signalName",                // Two-way binding
  }
})

// Conditional rendering (server-side)
condition ? UI.div({}, "shown") : UI.empty()

// Conditional helper
UI.show(condition, UI.div({}, "Shown when true"))

// Lists with keyed rendering
UI.each(
  items,
  (item) => `item-${item.id}`,  // Key function
  (item, index) => UI.div({ attrs: { id: `item-${item.id}` } }, item.text)
)

// Manual list mapping
...items.map(item => UI.li({ attrs: { id: item.id } }, item.text))

// Generic element (for any HTML tag)
UI.el("details", { attrs: { class: "..." } },
  UI.el("summary", {}, "Click to expand"),
  UI.div({}, "Hidden content")
)

// Fragments
UI.fragment(UI.h1({}, "Title"), UI.p({}, "Content"))
```

## Event Handlers (`on.*`)

### Server Actions

```ts
// Dispatch action (no arguments)
UI.button(
  { events: { click: on.action(resetCount) } },
  "Reset"
)

// With static arguments
UI.button(
  { events: { click: on.action(deleteTodo, { id: "123" }) } },
  "Delete"
)

// With signal value (reads from client-side signal)
UI.button(
  { events: { click: on.action(addTodo, { text: $.signal("input") }) } },
  "Add"
)

// With trimmed signal value
UI.button(
  { events: { click: on.action(sendMessage, { text: $.trim($.signal("text")) }) } },
  "Send"
)
```

### Client-Side Signal Updates

```ts
// Set string value
UI.button(
  { events: { click: on.signal("tab", $.str("home")) } },
  "Go Home"
)

// Set number value
UI.button(
  { events: { click: on.signal("count", $.num(0)) } },
  "Reset Count"
)

// Set boolean value
UI.button(
  { events: { click: on.signal("isOpen", $.bool(true)) } },
  "Open Modal"
)

// Set null value
UI.button(
  { events: { click: on.signal("editingId", $.null()) } },
  "Cancel Edit"
)
```

### Combining Handlers

```ts
// Sequence of operations
UI.form(
  {
    events: {
      submit: on.seq(
        on.script("event.preventDefault()"),
        on.action(submitForm, { text: $.signal("input") })
      ),
    },
  },
  UI.input({ attrs: { "hs-bind": "input" } }),
  UI.button({ attrs: { type: "submit" } }, "Submit")
)

// Multiple signal updates
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

```ts
// Prevent default wrapper (useful for checkboxes, links)
UI.input({
  attrs: { type: "checkbox", checked: todo.done ? "checked" : undefined },
  events: { click: on.prevent(on.action(toggleTodo, { id: todo.id })) },
})

// Form submit with prevent
UI.form(
  {
    events: {
      submit: on.prevent(on.action(submitForm, { text: $.signal("input") })),
    },
  },
  ...
)
```

## Timers

Timers run at fixed intervals, useful for game loops and animations:

```ts
hs.timer("gameLoop", {
  interval: 16,                    // ms between ticks (~60fps)
  when: (s) => s.isPlaying,        // Optional: only run when condition is true
  trackFps: true,                  // Optional: track actual FPS
  handler: (ctx) => {
    ctx.update((s) => ({
      ...s,
      frame: s.frame + 1,
      fps: ctx.fps,                // Available when trackFps: true
    }))
  },
})

// Round countdown timer
hs.timer("roundTimer", {
  interval: 1000,
  handler: (ctx) => {
    ctx.update((s) => ({
      ...s,
      timeRemaining: s.timeRemaining - 1,
    }))
  },
})
```

## Intervals

Intervals use human-readable durations:

```ts
hs.interval("heartbeat", {
  every: "5 seconds",              // or: "1 minute", "30 seconds", 5000 (ms)
  handler: (ctx) => {
    ctx.update((s) => ({ ...s, lastPing: Date.now() }))
  },
})
```

## Crons

Crons run on schedules (cron expressions or duration strings):

```ts
// Run every hour
hs.cron("cleanup", {
  schedule: "0 * * * *",           // Cron expression
  handler: (ctx) => {
    ctx.update((s) => ({ ...s, messages: s.messages.slice(-100) }))
  },
})

// Run for each connected user
hs.cron("userReminder", {
  schedule: "5 minutes",           // Every 5 minutes
  forEachUser: (ctx) => {
    ctx.updateUser((u) => ({ ...u, reminderShown: true }))
  },
})
```

## Triggers

Triggers watch store values and fire when they change:

```ts
// Watch specific value
hs.trigger("countChanged", {
  watch: (store) => store.count,
  handler: (ctx, { oldValue, newValue }) => {
    console.log(`Count changed from ${oldValue} to ${newValue}`)
    if (newValue >= 100) {
      ctx.update((s) => ({ ...s, milestone: true }))
    }
  },
})

// Watch user store values
hs.userTrigger("usernameChanged", {
  watch: (userStore) => userStore.username,
  handler: (ctx, { oldValue, newValue, sessionId }) => {
    console.log(`User ${sessionId} changed name to ${newValue}`)
  },
})
```

## Sessions

Each connected client has a unique session:

```ts
// Access session in actions
const vote = hs.action("vote", { optionId: Schema.String }, (ctx, { optionId }) => {
  const store = ctx.getStore()

  // Check if this session already voted
  if (ctx.sessionId in store.voters) {
    return // Already voted!
  }

  ctx.update((s) => ({
    ...s,
    options: s.options.map((o) =>
      o.id === optionId ? { ...o, votes: o.votes + 1 } : o
    ),
    voters: { ...s.voters, [ctx.sessionId]: true },
  }))
})

// Access session in view
view: (ctx) => {
  const hasVoted = ctx.session.id in ctx.store.voters
  return UI.div(
    { attrs: { id: "app" } },
    hasVoted
      ? UI.p({}, "Thanks for voting!")
      : UI.button({ events: { click: on.action(vote, { optionId: "a" }) } }, "Vote")
  )
}
```

## Streaming (LLM Chat)

Actions handle streaming responses naturally with multiple `ctx.update()` calls:

```ts
const sendMessage = hs.action("sendMessage", { input: Schema.String }, async (ctx, { input }) => {
  // Add user message
  ctx.update((s) => ({
    ...s,
    messages: [...s.messages, { role: "user", content: input }],
    isGenerating: true,
    streamingContent: "",
  }))
  ctx.patchSignals({ input: "" })

  // Stream response character by character
  const response = await getAIResponse(input)
  for (const char of response) {
    ctx.update((s) => ({
      ...s,
      streamingContent: s.streamingContent + char,
    }))
    await Bun.sleep(15) // Natural typing feel
  }

  // Finalize
  ctx.update((s) => ({
    ...s,
    messages: [
      ...s.messages,
      { role: "assistant", content: s.streamingContent },
    ],
    streamingContent: "",
    isGenerating: false,
  }))
})
```

## Persistence

Store can be automatically persisted to JSON:

```ts
hs.app({
  store: { todos: [] },
  persist: "./data/todos.json",  // Auto-save on changes
  view: ...
})
```

## Dynamic Title & Favicon

### Option 1: Reactive Functions (auto-update on store changes)

```ts
hs.app({
  store: { unreadCount: 0 },

  title: ({ store }) =>
    store.unreadCount > 0
      ? `(${store.unreadCount}) My App`
      : "My App",

  favicon: ({ store }) =>
    store.hasAlert
      ? "data:image/svg+xml,<svg>...</svg>"
      : "data:image/svg+xml,<svg>...</svg>",

  view: ...
})
```

### Option 2: Direct Control in Actions

```ts
const increment = hs.action("increment", (ctx) => {
  ctx.update((s) => ({ ...s, count: s.count + 1 }))
  const count = ctx.getStore().count
  ctx.head.setTitle(`Count: ${count} | My App`)
})

const setStatus = hs.action("setStatus", { status: Schema.String }, (ctx, { status }) => {
  ctx.update((s) => ({ ...s, status }))

  const faviconMap = {
    idle: "data:image/svg+xml,<svg>⏸️</svg>",
    active: "data:image/svg+xml,<svg>▶️</svg>",
    complete: "data:image/svg+xml,<svg>✅</svg>",
  }

  ctx.head.setFavicon(faviconMap[status], "image/svg+xml")
})
```

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
    update((s) => ({ ...s, onlineCount: s.onlineCount + 1 }))
  },

  onDisconnect({ session, update }) {
    update((s) => ({ ...s, onlineCount: s.onlineCount - 1 }))
  },

  view: (ctx) => { ... },
})
```

## Schema Validation

Uses Effect Schema for type-safe validation:

```ts
import { Schema } from "hyperstar"

// Primitives
Schema.String
Schema.Number
Schema.Boolean

// With constraints
Schema.String.pipe(Schema.minLength(1))  // Non-empty string

// Union types
Schema.Union(Schema.Literal("idle"), Schema.Literal("active"), Schema.Literal("complete"))

// Objects
{ text: Schema.String, count: Schema.Number }

// Arrays
Schema.Array(Schema.String)
```

## Important Rules

1. **Root element must have `id="app"`**
2. **Use ctx.update() for immutable store updates** - `ctx.update((s) => ({ ...s, ... }))`
3. **All clients share store** - Changes broadcast to everyone
4. **Signals are client-only** - Perfect for UI state (tabs, modals, form inputs)
5. **Use on.prevent() for checkboxes** - Prevents browser from toggling before server responds

## Common Patterns

### Tabs (instant, no server roundtrip)

```ts
interface Signals { tab: "home" | "settings" }
const hs = createHyperstar<{}, {}, Signals>()
const { tab } = hs.signals

hs.app({
  store: {},
  signals: { tab: "home" },
  view: () =>
    UI.div(
      { attrs: { id: "app" } },
      UI.button(
        {
          attrs: { "hs-class": `${tab.is("home")} ? 'bg-blue-500' : ''` },
          events: { click: on.signal("tab", $.str("home")) },
        },
        "Home"
      ),
      UI.div({ attrs: { "hs-show": tab.is("home").toString() } }, "Home content"),
      UI.div({ attrs: { "hs-show": tab.is("settings").toString() } }, "Settings content")
    ),
})
```

### Hybrid filtering (server data + client filter)

```ts
interface Signals { filter: "all" | "active" | "done" }
const { filter } = hs.signals

// In view
...ctx.store.todos.map((todo) =>
  UI.div(
    {
      attrs: {
        id: `todo-${todo.id}`,
        "hs-show": filter.is("all")
          .or(filter.is("active").and(!todo.done))
          .or(filter.is("done").and(todo.done))
          .toString(),
      },
    },
    todo.text
  )
)
```

### Form with user-scoped signal patching

```ts
interface Signals { text: string }
const { text } = hs.signals

const addItem = hs.action("addItem", { text: Schema.String }, (ctx, { text: t }) => {
  ctx.update((s) => ({
    ...s,
    items: [...s.items, { id: crypto.randomUUID(), text: t }],
  }))

  // This ONLY clears the input for the user who submitted
  ctx.patchSignals({ text: "" })
})

// In view
UI.form(
  {
    events: {
      submit: on.seq(
        on.script("event.preventDefault()"),
        on.action(addItem, { text: $.signal("text") })
      ),
    },
  },
  UI.input({ attrs: { "hs-bind": "text" } }),
  UI.button({ attrs: { type: "submit" } }, "Add")
)
```

### Edit mode with nullable signal

```ts
interface Signals {
  editingId: string | null
  editText: string
}
const { editingId, editText } = hs.signals

const saveEdit = hs.action(
  "saveEdit",
  { id: Schema.String, text: Schema.String },
  (ctx, { id, text }) => {
    ctx.update((s) => ({
      ...s,
      items: s.items.map((i) => (i.id === id ? { ...i, text } : i)),
    }))
    ctx.patchSignals({ editingId: null, editText: "" })
  }
)

// View mode (shown when not editing this item)
UI.div(
  { attrs: { "hs-show": editingId.isNot(item.id).toString() } },
  item.text,
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
)

// Edit mode (shown when editing this item)
UI.form(
  {
    attrs: { "hs-show": editingId.is(item.id).toString() },
    events: {
      submit: on.seq(
        on.script("event.preventDefault()"),
        on.action(saveEdit, { id: item.id, text: $.signal("editText") })
      ),
    },
  },
  UI.input({ attrs: { "hs-bind": "editText" } }),
  UI.button({ attrs: { type: "submit" } }, "Save"),
  UI.button(
    { attrs: { type: "button" }, events: { click: on.signal("editingId", $.null()) } },
    "Cancel"
  )
)
```

### Game loop with FPS tracking

```ts
interface Store {
  frame: number
  running: boolean
  fps: number
}

const hs = createHyperstar<Store>()

const start = hs.action("start", (ctx) => {
  ctx.update((s) => ({ ...s, running: true }))
})

const stop = hs.action("stop", (ctx) => {
  ctx.update((s) => ({ ...s, running: false }))
})

hs.timer("gameLoop", {
  interval: 1,                     // Max speed
  when: (s) => s.running,          // Only tick when running
  trackFps: true,                  // Enable FPS tracking
  handler: (ctx) => {
    ctx.update((s) => ({
      ...s,
      frame: s.frame + 1,
      fps: ctx.fps,
    }))
  },
})

hs.app({
  store: { frame: 0, running: false, fps: 0 },
  view: (ctx) =>
    UI.div(
      { attrs: { id: "app" } },
      UI.div({}, `Frame: ${ctx.store.frame}`),
      UI.div({}, `FPS: ${ctx.store.fps}`),
      !ctx.store.running
        ? UI.button({ events: { click: on.action(start) } }, "Start")
        : UI.button({ events: { click: on.action(stop) } }, "Stop")
    ),
})
```

### Session-based voting

```ts
interface Store {
  options: { id: string; text: string; votes: number }[]
  voters: Record<string, true>  // sessionId -> true
}

const vote = hs.action("vote", { optionId: Schema.String }, (ctx, { optionId }) => {
  const store = ctx.getStore()

  // Check if this session already voted
  if (ctx.sessionId in store.voters) {
    return // Already voted!
  }

  ctx.update((s) => ({
    ...s,
    options: s.options.map((o) =>
      o.id === optionId ? { ...o, votes: o.votes + 1 } : o
    ),
    voters: { ...s.voters, [ctx.sessionId]: true },
  }))
})

// In view
view: (ctx) => {
  const hasVoted = ctx.session.id in ctx.store.voters

  return UI.div(
    { attrs: { id: "app" } },
    ...ctx.store.options.map((option) =>
      hasVoted
        ? UI.div({}, `${option.text}: ${option.votes} votes`)
        : UI.button(
            { events: { click: on.action(vote, { optionId: option.id }) } },
            option.text
          )
    )
  )
}
```

### Real-time chat

```ts
interface Message {
  id: string
  username: string
  text: string
  timestamp: string
}

interface Store {
  messages: Message[]
}

interface Signals {
  username: string
  text: string
}

const hs = createHyperstar<Store, {}, Signals>()
const { username, text } = hs.signals

const sendMessage = hs.action("sendMessage", {
  username: Schema.String.pipe(Schema.minLength(1)),
  text: Schema.String.pipe(Schema.minLength(1)),
}, (ctx, { username: user, text: msg }) => {
  ctx.update((s) => ({
    ...s,
    messages: [...s.messages, {
      id: crypto.randomUUID(),
      username: user,
      text: msg,
      timestamp: new Date().toISOString(),
    }].slice(-100),  // Keep last 100 messages
  }))
  ctx.patchSignals({ text: "" })  // Clear text input
})

hs.app({
  store: { messages: [] },
  signals: { username: "", text: "" },

  view: (ctx) =>
    UI.div(
      { attrs: { id: "app" } },

      // Messages
      ...ctx.store.messages.map((msg) =>
        UI.div(
          { attrs: { id: `msg-${msg.id}` } },
          UI.strong({}, msg.username),
          UI.span({}, msg.text)
        )
      ),

      // Input form
      UI.form(
        {
          events: {
            submit: on.prevent(
              on.action(sendMessage, {
                username: $.trim($.signal("username")),
                text: $.trim($.signal("text")),
              })
            ),
          },
        },
        UI.input({ attrs: { placeholder: "Name", "hs-bind": "username" } }),
        UI.input({ attrs: { placeholder: "Message", "hs-bind": "text" } }),
        UI.button(
          {
            attrs: {
              type: "submit",
              "hs-show": username.isNotEmpty().and(text.isNotEmpty()).toString(),
            },
          },
          "Send"
        )
      )
    ),
})
```
