# Hyperstar

> **Very Beta** - API changes frequently. Great for prototypes and fun real-time multiplayer apps.

A server-driven UI framework for Bun. Server owns state, clients sync automatically via SSE.

**Real-time = all clients see the same store.** User A makes a change, User B sees it instantly.

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

- **JSX rendering**: Uses @kitajs/html with custom `$` prop for reactive attributes
- **Real-time sync**: SSE streaming and Idiomorph DOM morphing
- **State management**: Immutable updates via `ctx.update()`
- **Validation**: Effect Schema for typed action args
- **Runtime**: Built for Bun

## Project Structure

```
packages/hyperstar/src/
├── index.ts          # Main entry, exports createHyperstar, hs, Schema
├── server.ts         # Bun server, SSE handling, action dispatch, signal handles
├── hs.ts             # HSBuilder and hs namespace for reactive attributes
├── jsx-runtime.ts    # Custom JSX runtime for $ prop
├── jsx.d.ts          # JSX type extensions
├── action/
│   ├── index.ts      # Action creation and execution
│   └── schema.ts     # Effect Schema integration
├── core/
│   └── lifecycle.ts  # Lifecycle hooks (onStart, onConnect, etc.)
├── schedule/
│   └── index.ts      # Scheduling helpers (repeat, cron)
└── triggers/
    └── index.ts      # Store change watchers

packages/hyperstar-client/src/
├── index.ts          # Main entry, Hyperstar global
├── actions.ts        # dispatch() - send actions to server
├── signals.ts        # Preact Signals for client state
├── sse.ts            # SSE connection, auto-reconnect
├── morph.ts          # Idiomorph for DOM diffing
├── process.ts        # Process hs-* attributes
└── expression.ts     # Evaluate expressions with signal context

examples/
├── simple-counter.tsx    # Minimal counter
├── counter.tsx           # Counter with form input
├── todos.tsx             # Full todo app with filters
├── chat-room.tsx         # Real-time multi-user chat
├── fps-jsx.tsx           # Timer/FPS stress test
├── state-types.tsx       # Three-tier state demo
├── persistent-notes.tsx  # JSON file persistence
└── sqlite-notes.tsx      # SQLite persistence
```

## API Reference

### Creating an App

```tsx
import { createHyperstar, hs, Schema } from "hyperstar"

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
const app = createHyperstar<Store, {}, Signals>()

// Get typed signal handles
const { filter, text, editingId } = app.signals

// Actions (server-side state changes)
const addTodo = app.action("addTodo", { text: Schema.String }, (ctx, { text: t }) => {
  ctx.update((s) => ({
    ...s,
    todos: [...s.todos, { id: crypto.randomUUID(), text: t, done: false }],
  }))
  ctx.patchSignals({ text: "" }) // Clear input for triggering user only
})

const toggleTodo = app.action("toggleTodo", { id: Schema.String }, (ctx, { id }) => {
  ctx.update((s) => ({
    ...s,
    todos: s.todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
  }))
})

// App config
app.app({
  store: { todos: [] },
  signals: { filter: "all", text: "", editingId: null },

  view: (ctx) => (
    <div id="app">
      {/* Form with signal binding */}
      <form $={hs.form(addTodo)}>
        <input name="text" $={hs.bind(text)} />
        <button type="submit">Add</button>
      </form>

      {/* Hybrid filtering (server data + client filter) */}
      {ctx.store.todos.map((todo) => (
        <div
          id={`todo-${todo.id}`}
          hs-show={filter.is("all")
            .or(filter.is("active").and(!todo.done))
            .or(filter.is("done").and(todo.done))}
        >
          <input
            type="checkbox"
            checked={todo.done}
            $={hs.action(toggleTodo, { id: todo.id })}
          />
          {todo.text}
        </div>
      ))}
    </div>
  ),
}).serve({ port: 3000 })
```

### Signal Types

Signals are defined as a type parameter and values provided in `app()`:

```tsx
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

const app = createHyperstar<Store, {}, Signals>()

// Get typed signal handles
const { isAdding, text, filter, editingId } = app.signals

// Provide default values
app.app({
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

```tsx
// String/enum signal
filter.is("active")        // "$filter.value === 'active'"
filter.isNot("done")       // "$filter.value !== 'done'"
text.isEmpty()             // "$text.value === ''"
text.isNotEmpty()          // "$text.value !== ''"

// Number signal
count.gt(5)                // "$count.value > 5"
count.gte(5)               // "$count.value >= 5"
count.lt(10)               // "$count.value < 10"
count.eq(0)                // "$count.value === 0"

// Nullable signal
editingId.is("abc")        // "$editingId.value === 'abc'"
editingId.isNot("x")       // "$editingId.value !== 'x'"
editingId.isNull()         // "$editingId.value === null"
editingId.isNotNull()      // "$editingId.value !== null"
```

### Expression Composition

Expressions compose with `.and()`, `.or()`, `.not()`:

```tsx
// AND
filter.is("active").and(count.gt(0))
// → "($filter.value === 'active') && ($count.value > 0)"

// OR
isOpen.or(filter.is("all"))
// → "($isOpen.value) || ($filter.value === 'all')"

// NOT
isOpen.not()
// → "!($isOpen.value)"

// Hybrid (server value embedded at render time)
filter.is("active").and(!todo.done)
// → "($filter.value === 'active') && false"
```

### JSX with the `$` Prop

The `$` prop takes an `hs.*` helper that adds reactive attributes:

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

### hs Namespace

```tsx
hs.action(action, args?)       // Trigger action on click
hs.actionOn(event, action, args?, mods?) // Trigger action on a specific event
hs.form(action, args?)         // Submit form to action
hs.bind(signal)                // Two-way bind signal to input
hs.show(condition)             // Show/hide element
hs.class(className, condition) // Toggle CSS class
hs.attr(attrName, condition)   // Set attribute based on condition
hs.html(expr)                  // Set innerHTML
hs.style(prop, expr)           // Set inline style
hs.init(expr)                  // Run init expression once
hs.ref(name)                   // Register element ref
hs.disabled(condition)         // Disable element
hs.on(event, handler, mods?)   // Bind event to expression
hs.expr(code)                  // Create client-side expression
hs.seq(...exprs)               // Compose expressions into a single statement
hs.compose(...builders)        // Compose multiple builders
```

### Direct Attributes

You can also use `hs-*` attributes directly:

```tsx
// Direct signal update
<button hs-on:click="$tab.value = 'home'">Home</button>

// Show/hide
<div hs-show={tab.is("home")}>Home content</div>

// Dynamic class
<button hs-class:bg-blue-500={filter.is("all")}>All</button>
```

### Event Handlers

```tsx
// Server actions
<button $={hs.action(myAction)}>Click</button>
<button $={hs.action(myAction, { id: "123" })}>With static args</button>
<button $={hs.action(myAction, { amount: hs.expr("parseInt($amount.value)") })}>With expr</button>
<input $={hs.actionOn("input", myAction, { q: query }, { debounce: 200 })} />

// Form submission
<form $={hs.form(submitForm)}>...</form>

// Direct event binding
<button hs-on:click="$tab.value = 'home'">Home</button>
<button hs-on:click__debounce_300ms="...">Debounced</button>
```

### Lifecycle Hooks

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

### Repeat

Time-based repeating tasks (replaces timer + interval):

```tsx
app.repeat("gameLoop", {
  every: 16,                      // ms (~60fps)
  when: (s) => s.running,         // Only run when condition is true
  trackFps: true,                 // Enable FPS tracking
  handler: (ctx) => {
    ctx.update((s) => ({
      ...s,
      frame: s.frame + 1,
      fps: ctx.fps,
    }))
  },
})
```

### Cron

```tsx
app.cron("cleanup", {
  every: "0 * * * *",             // Cron expression or "1 hour"
  handler: (ctx) => {
    ctx.update((s) => ({ ...s, messages: s.messages.slice(-100) }))
  },
})
```

### Persistence

```tsx
app.app({
  store: { todos: [] },
  persist: "./data/todos.json",  // Auto-save on changes
  view: (ctx) => ...
})
```

### Dynamic Title

```tsx
app.app({
  store: { unreadCount: 0 },
  title: ({ store }) =>
    store.unreadCount > 0 ? `(${store.unreadCount}) My App` : "My App",
  view: ...
})
```

### User-Scoped Signal Patching

Actions can patch signals for the triggering user only:

```tsx
const addTodo = app.action("addTodo", { text: Schema.String }, (ctx, { text }) => {
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

```tsx
import { Schema } from "hyperstar"

// Primitives
Schema.String
Schema.Number
Schema.Boolean

// Objects
{ text: Schema.String, count: Schema.Number }

// Arrays
Schema.Array(Schema.String)

// With constraints
Schema.String.pipe(Schema.minLength(1))
```

## How Store vs Signals Work

```
┌─────────────────────────────────────────────────────────────┐
│ ctx.store (Server State - Shared)                           │
│ • Shared across ALL connected clients                       │
│ • Changes broadcast via SSE to everyone                     │
│ • Persisted (optionally)                                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ ctx.userStore (Server State - Per-Session)                  │
│ • Private to each session                                   │
│ • Stored on server, survives page reload                    │
│ • Perfect for: theme, settings, voting state                │
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
bun --hot examples/simple-counter.tsx
bun --hot examples/todos.tsx

# Type check
bun run check
```

## Key Files for Understanding

1. `packages/hyperstar/src/index.ts` - Factory pattern, exports
2. `packages/hyperstar/src/server.ts` - HTTP server, SSE streaming, signal handles
3. `packages/hyperstar/src/hs.ts` - HSBuilder and hs namespace
4. `packages/hyperstar/src/action/index.ts` - Action creation and execution
5. `examples/simple-counter.tsx` - Minimal example
6. `examples/todos.tsx` - Complete todo app with all patterns
