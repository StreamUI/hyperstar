# Hyperstar

> [!TIP]
> **Built for Vibe Coding** - Optimized for LLM code generation with powerful server-driven capabilities and end-to-end type safety.

A minimal framework for building real-time web applications with server-side state. Think "Redux on the server" with automatic UI sync across all connected clients.

## Core Concept

```
Store (server state, shared)  →  view(ctx) → HTML
         ↓                              ↓
   Broadcast to ALL clients      Signals (client state, private)
         ↓                              ↓
   Action → Update store         Instant UI updates (no roundtrip)
```

**One store. One view function. All clients stay in sync automatically.**

## Architecture

- **Server-side rendering**: UI builders (UI.div, UI.button, etc.) → HTML
- **Real-time sync**: SSE streaming and DOM morphing
- **State management**: Immutable updates via `ctx.update()`
- **Validation**: Effect Schema for typed action args
- **Runtime**: Built for Bun

## Project Structure

```
packages/hyperstar/src/
├── index.ts          # Main entry, exports createHyperstar, UI, on, $, Schema
├── server.ts         # Bun server, SSE handling, action dispatch, signal handles
├── action/
│   ├── index.ts      # Action creation and execution
│   └── schema.ts     # Effect Schema integration
├── core/
│   └── lifecycle.ts  # Lifecycle hooks (onStart, onConnect, etc.)
├── schedule/
│   └── index.ts      # Scheduled tasks
└── triggers/
    └── index.ts      # Trigger system

examples/
├── counter.ts            # Basic counter
├── todos.ts              # Full todo app with filters
├── signal-test.ts        # Type-safe signals demo
├── chat-room.ts          # Real-time multi-user chat
├── llm-streaming.ts      # Streaming LLM responses
├── poll.ts               # Voting with sessions
├── grid-game.ts          # Multiplayer game
├── persistent-notes.ts   # JSON file persistence
├── sqlite-notes.ts       # SQLite persistence
└── async-actions.ts      # Async action patterns
```

## API Reference

### Creating an App

```ts
import { createHyperstar, UI, on, $, Schema } from "hyperstar"

interface Todo {
  id: string
  text: string
  done: boolean
}

interface Store {
  todos: Todo[]
}

interface Signals {
  filter: "all" | "active" | "done"
  text: string
  editingId: string | null
}

// Create typed factory with Store, UserStore, and Signals type parameters
const hs = createHyperstar<Store, {}, Signals>()

// Get typed signal handles
const { filter, text, editingId } = hs.signals

// Actions (server-side state changes)
const addTodo = hs.action("addTodo", { text: Schema.String }, (ctx, { text: t }) => {
  ctx.update((s) => ({
    ...s,
    todos: [...s.todos, { id: crypto.randomUUID(), text: t, done: false }],
  }))
  ctx.patchSignals({ text: "" }) // Clear input for triggering user only
})

const toggleTodo = hs.action("toggleTodo", { id: Schema.String }, (ctx, { id }) => {
  ctx.update((s) => ({
    ...s,
    todos: s.todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
  }))
})

// App config
hs.app({
  store: { todos: [] },
  signals: { filter: "all", text: "", editingId: null },

  view: (ctx) => {
    const activeCount = ctx.store.todos.filter((t) => !t.done).length

    return UI.div(
      { attrs: { id: "app" } },

      // Filter tabs - instant, no server roundtrip
      UI.button(
        {
          attrs: { "hs-class": `${filter.is("all")} ? 'bg-blue-500' : ''` },
          events: { click: on.signal("filter", $.str("all")) },
        },
        `All (${ctx.store.todos.length})`
      ),

      // Add form
      UI.form(
        {
          events: {
            submit: on.seq(
              on.script("event.preventDefault()"),
              on.action(addTodo, { text: $.signal("text") })
            ),
          },
        },
        UI.input({ attrs: { "hs-bind": "text" } }),
        UI.button({ attrs: { type: "submit" } }, "Add")
      ),

      // Todo list with hybrid filtering
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
    )
  },
}).serve({ port: 3000 })
```

### Signal Types

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

// Provide default values
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

### Signal Handle Methods

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

### Expression Composition

Expressions compose with `.and()`, `.or()`, `.not()`:

```ts
const { filter, count, isOpen } = hs.signals

// Logical AND
filter.is("active").and(count.gt(0))
// → "($filter.value === 'active') && ($count.value > 0)"

// Logical OR
isOpen.or(filter.is("all"))
// → "($isOpen.value) || ($filter.value === 'all')"

// Negation
isOpen.not()
// → "!($isOpen.value)"

// Hybrid (server value embedded at render time)
filter.is("active").and(!todo.done)
// → "($filter.value === 'active') && false"
```

### UI Builders

Build HTML with `UI.*` functions:

```ts
// Basic elements
UI.div({ attrs: { id: "app", class: "container" } }, ...children)
UI.span({}, "text content")
UI.button({ events: { click: handler } }, "Click me")
UI.input({ attrs: { type: "text", "hs-bind": "signalName" } })
UI.form({ events: { submit: handler } }, ...children)

// Special attributes
UI.div({
  attrs: {
    "hs-show": expression.toString(),      // Conditional visibility
    "hs-class": "`${expr} ? 'a' : 'b'`",   // Dynamic classes
    "hs-bind": "signalName",                // Two-way binding
  }
})

// Conditional rendering (server-side)
condition ? UI.div({}, "shown") : UI.empty()

// Lists
...items.map(item => UI.li({ attrs: { id: item.id } }, item.text))

// Fragments
UI.fragment(UI.h1({}, "Title"), UI.p({}, "Content"))
```

### Event Handlers (`on.*`)

```ts
// Server actions
on.action(myAction)                              // Dispatch action
on.action(myAction, { id: "123" })               // With static args
on.action(myAction, { text: $.signal("input") }) // With signal value

// Client-side signal updates
on.signal("tab", $.str("home"))        // Set string
on.signal("count", $.num(0))           // Set number
on.signal("isOpen", $.bool(true))      // Set boolean
on.signal("editingId", $.null())       // Set null

// Sequences
on.seq(
  on.script("event.preventDefault()"),
  on.action(submitForm, { text: $.signal("input") })
)

// Prevent default
on.prevent(on.action(toggle, { id }))
```

### Lifecycle Hooks

```ts
hs.app({
  store: { ... },

  onStart({ spawn, update }) {
    spawn(async (ctx) => {
      while (!ctx.signal.aborted) {
        await Bun.sleep(1000)
        ctx.update((s) => ({ ...s, timer: s.timer + 1 }))
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

### Persistence

```ts
hs.app({
  store: { todos: [] },
  persist: "./data/todos.json",  // Auto-save on changes
  view: (ctx) => { ... },
})
```

### Dynamic Title & Favicon

```ts
hs.app({
  store: { unreadCount: 0 },

  title: ({ store }) =>
    store.unreadCount > 0
      ? `(${store.unreadCount}) My App`
      : "My App",

  view: ...
})
```

### User-Scoped Signal Patching

Actions can patch signals for the triggering user only:

```ts
const addTodo = hs.action("addTodo", { text: Schema.String }, (ctx, { text }) => {
  ctx.update((s) => ({
    ...s,
    todos: [...s.todos, { id: crypto.randomUUID(), text, done: false }],
  }))

  // This ONLY clears the input for the user who submitted
  // Other users' inputs are unaffected
  ctx.patchSignals({ text: "" })
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

// Objects
{ text: Schema.String, count: Schema.Number }

// Arrays
Schema.Array(Schema.String)
```

## How Store vs Signals Work

```
┌─────────────────────────────────────────────────────────────┐
│ ctx.store (Server State)                                    │
│ • Shared across ALL connected clients                       │
│ • Changes broadcast via SSE to everyone                     │
│ • Persisted (optionally)                                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ signals (Client State)                                      │
│ • Private to each browser tab                               │
│ • Never broadcast to other users                            │
│ • ctx.patchSignals() only affects triggering user           │
└─────────────────────────────────────────────────────────────┘
```

## Development

```bash
# Run an example
bun run examples/counter.ts
bun run examples/todos.ts

# Type check
bun run check
```

## Key Files for Understanding

1. `packages/hyperstar/src/index.ts` - Factory pattern, exports
2. `packages/hyperstar/src/server.ts` - HTTP server, SSE streaming, signal handles
3. `packages/hyperstar/src/action/index.ts` - Action creation and execution
4. `examples/counter.ts` - Simple counter example
5. `examples/todos.ts` - Complete todo app with all patterns
