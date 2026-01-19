/**
 * Hyperstar v3 - Nested Components Example
 *
 * Demonstrates reusable, composable components using the UI ADT.
 * Components are just functions that return UINode - no JSX needed!
 *
 * Features:
 * - Reusable component functions (Card, Button, Avatar, etc.)
 * - Passing action variables to child components
 * - Composing complex UIs from simple building blocks
 */
import { createHyperstar, UI, on, Schema, type UINode, type ActionDescriptor } from "hyperstar"

// ============================================================================
// Store Type
// ============================================================================

interface User {
  id: string
  name: string
  role: "admin" | "user"
}

interface Store {
  users: User[]
}

// ============================================================================
// Create Factory
// ============================================================================

const hs = createHyperstar<Store>()

// ============================================================================
// Actions
// ============================================================================

const addUser = hs.action("addUser", (ctx) => {
  const names = ["Alice Smith", "Bob Johnson", "Carol White", "Dan Brown", "Eve Davis"]
  const roles: ("admin" | "user")[] = ["admin", "user", "user", "user"]

  ctx.update((s) => ({
    ...s,
    users: [
      ...s.users,
      {
        id: crypto.randomUUID(),
        name: names[Math.floor(Math.random() * names.length)]!,
        role: roles[Math.floor(Math.random() * roles.length)]!,
      },
    ],
  }))
})

const removeUser = hs.action("removeUser", { id: Schema.String }, (ctx, { id }) => {
  ctx.update((s) => ({
    ...s,
    users: s.users.filter((u) => u.id !== id),
  }))
})

// ============================================================================
// Reusable Components
// ============================================================================

/**
 * Card component with optional title
 */
function Card(props: { title?: string; children: UINode | UINode[] }): UINode {
  const { title, children } = props
  return UI.div(
    { attrs: { class: "bg-white rounded-xl shadow-lg p-6 mb-4" } },
    title && UI.h3({ attrs: { class: "text-lg font-semibold mb-3 text-gray-800" } }, title),
    children,
  )
}

/**
 * Button component with variants
 */
function Button(props: {
  variant?: "primary" | "secondary" | "danger"
  action?: ActionDescriptor<any, any, any, any>
  args?: Record<string, unknown>
  children: string
}): UINode {
  const { variant = "primary", action, args, children } = props

  const colors = {
    primary: "bg-blue-500 hover:bg-blue-600 text-white",
    secondary: "bg-gray-200 hover:bg-gray-300 text-gray-800",
    danger: "bg-red-500 hover:bg-red-600 text-white",
  }

  return UI.button(
    {
      attrs: {
        class: `px-4 py-2 rounded-lg font-medium transition-colors ${colors[variant]}`,
      },
      events: action ? { click: on.action(action, args) } : undefined,
    },
    children,
  )
}

/**
 * Badge component
 */
function Badge(props: { color?: string; children: string }): UINode {
  const { color = "blue", children } = props
  return UI.span(
    {
      attrs: {
        class: `px-2 py-1 text-xs font-medium rounded-full bg-${color}-100 text-${color}-700`,
      },
    },
    children,
  )
}

/**
 * Avatar component - shows initials
 */
function Avatar(props: { name: string; size?: "sm" | "md" | "lg" }): UINode {
  const { name, size = "md" } = props
  const sizes = {
    sm: "w-8 h-8 text-sm",
    md: "w-10 h-10 text-base",
    lg: "w-14 h-14 text-xl",
  }
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()

  return UI.div(
    {
      attrs: {
        class: `${sizes[size]} rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold`,
      },
    },
    initials,
  )
}

/**
 * UserRow - composes Avatar, Badge, and Button
 */
function UserRow(props: { user: User; onRemove: ActionDescriptor<any, any, any, any> }): UINode {
  const { user, onRemove } = props

  return UI.div(
    {
      attrs: {
        id: `user-${user.id}`,
        class: "flex items-center gap-4 p-3 hover:bg-gray-50 rounded-lg",
      },
    },
    Avatar({ name: user.name }),
    UI.div(
      { attrs: { class: "flex-1" } },
      UI.p({ attrs: { class: "font-medium text-gray-900" } }, user.name),
      Badge({
        color: user.role === "admin" ? "purple" : "gray",
        children: user.role,
      }),
    ),
    Button({
      variant: "danger",
      action: onRemove,
      args: { id: user.id },
      children: "Remove",
    }),
  )
}

/**
 * StatsCard - shows a stat with icon
 */
function StatsCard(props: { label: string; value: number; icon: string }): UINode {
  const { label, value, icon } = props

  return Card({
    children: UI.div(
      { attrs: { class: "flex items-center gap-3" } },
      UI.span({ attrs: { class: "text-2xl" } }, icon),
      UI.div(
        {},
        UI.p({ attrs: { class: "text-2xl font-bold text-gray-900" } }, String(value)),
        UI.p({ attrs: { class: "text-sm text-gray-500" } }, label),
      ),
    ),
  })
}

/**
 * Layout - wraps the entire page
 */
function Layout(props: { title: string; children: UINode | UINode[] }): UINode {
  const { title, children } = props

  return UI.div(
    {
      attrs: {
        id: "app",
        class: "min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 p-8",
      },
    },
    UI.div(
      { attrs: { class: "max-w-2xl mx-auto" } },
      UI.h1({ attrs: { class: "text-3xl font-bold text-gray-800 mb-6" } }, title),
      children,
    ),
  )
}

// ============================================================================
// App Config
// ============================================================================

const server = hs.app({
  store: {
    users: [
      { id: "1", name: "Jordan Howlett", role: "admin" },
      { id: "2", name: "Jane Doe", role: "user" },
    ],
  } as Store,

  view: (ctx) => {
    const admins = ctx.store.users.filter((u) => u.role === "admin").length
    const users = ctx.store.users.filter((u) => u.role === "user").length

    return Layout({
      title: "Nested Components Demo",
      children: [
        // Stats row
        UI.div(
          { attrs: { class: "grid grid-cols-3 gap-4 mb-6" } },
          StatsCard({ icon: "👥", label: "Total Users", value: ctx.store.users.length }),
          StatsCard({ icon: "👑", label: "Admins", value: admins }),
          StatsCard({ icon: "👤", label: "Users", value: users }),
        ),

        // User list card
        Card({
          title: "Team Members",
          children: [
            UI.div(
              { attrs: { class: "space-y-2 mb-4" } },
              ...ctx.store.users.map((user) => UserRow({ user, onRemove: removeUser })),
              ctx.store.users.length === 0
                ? UI.p(
                    { attrs: { class: "text-gray-500 text-center py-4" } },
                    "No users yet",
                  )
                : UI.empty(),
            ),
            Button({
              variant: "primary",
              action: addUser,
              children: "+ Add Random User",
            }),
          ],
        }),

        // Info card
        Card({
          title: "About This Example",
          children: UI.p(
            { attrs: { class: "text-gray-600 text-sm" } },
            "Components like ",
            UI.code({ attrs: { class: "bg-gray-100 px-1 rounded" } }, "Card"),
            ", ",
            UI.code({ attrs: { class: "bg-gray-100 px-1 rounded" } }, "Button"),
            ", and ",
            UI.code({ attrs: { class: "bg-gray-100 px-1 rounded" } }, "UserRow"),
            " are just functions that return UINode - compose them to build complex UIs!",
          ),
        }),
      ],
    })
  },
}).serve({ port: 3009 })

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║              Nested Components Example                        ║
╠═══════════════════════════════════════════════════════════════╣
║  http://localhost:${server.port}                                    ║
║                                                               ║
║  Components are just functions that return UINode:            ║
║  • Card({ title, children })                                  ║
║  • Button({ action, children })                               ║
║  • UserRow({ user, onRemove: actionDescriptor })              ║
╚═══════════════════════════════════════════════════════════════╝
`)

process.on("SIGINT", async () => {
  console.log("\nShutting down...")
  await server.stop()
  process.exit(0)
})
