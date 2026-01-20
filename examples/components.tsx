/**
 * Hyperstar v3 - Nested Components Example (JSX Version)
 *
 * Demonstrates reusable, composable components using JSX.
 * Components are just functions that return JSX!
 *
 * Features:
 * - Reusable component functions (Card, Button, Avatar, etc.)
 * - Passing action variables to child components
 * - Composing complex UIs from simple building blocks
 */
import { createHyperstar, hs, Schema, type Action } from "hyperstar"

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

const app = createHyperstar<Store>()

// ============================================================================
// Actions
// ============================================================================

const addUser = app.action("addUser", (ctx) => {
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

const removeUser = app.action("removeUser", { id: Schema.String }, (ctx, { id }) => {
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
function Card({ title, children }: { title?: string; children: any }) {
  return (
    <div class="bg-white rounded-xl shadow-lg p-6 mb-4">
      {title && <h3 class="text-lg font-semibold mb-3 text-gray-800">{title}</h3>}
      {children}
    </div>
  )
}

/**
 * Button component with variants
 */
function Button({
  variant = "primary",
  action,
  args,
  children,
}: {
  variant?: "primary" | "secondary" | "danger"
  action?: Action
  args?: Record<string, unknown>
  children: string
}) {
  const colors = {
    primary: "bg-blue-500 hover:bg-blue-600 text-white",
    secondary: "bg-gray-200 hover:bg-gray-300 text-gray-800",
    danger: "bg-red-500 hover:bg-red-600 text-white",
  }

  return (
    <button
      $={action ? hs.action(action, args) : undefined}
      class={`px-4 py-2 rounded-lg font-medium transition-colors ${colors[variant]}`}
    >
      {children}
    </button>
  )
}

/**
 * Badge component
 */
function Badge({ color = "blue", children }: { color?: string; children: string }) {
  return (
    <span class={`px-2 py-1 text-xs font-medium rounded-full bg-${color}-100 text-${color}-700`}>
      {children}
    </span>
  )
}

/**
 * Avatar component - shows initials
 */
function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
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

  return (
    <div
      class={`${sizes[size]} rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold`}
    >
      {initials}
    </div>
  )
}

/**
 * UserRow - composes Avatar, Badge, and Button
 */
function UserRow({ user, onRemove }: { user: User; onRemove: Action }) {
  return (
    <div id={`user-${user.id}`} class="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-lg">
      {Avatar({ name: user.name })}
      <div class="flex-1">
        <p class="font-medium text-gray-900">{user.name}</p>
        {Badge({
          color: user.role === "admin" ? "purple" : "gray",
          children: user.role,
        })}
      </div>
      {Button({
        variant: "danger",
        action: onRemove,
        args: { id: user.id },
        children: "Remove",
      })}
    </div>
  )
}

/**
 * StatsCard - shows a stat with icon
 */
function StatsCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return Card({
    children: (
      <div class="flex items-center gap-3">
        <span class="text-2xl">{icon}</span>
        <div>
          <p class="text-2xl font-bold text-gray-900">{value}</p>
          <p class="text-sm text-gray-500">{label}</p>
        </div>
      </div>
    ),
  })
}

/**
 * Layout - wraps the entire page
 */
function Layout({ title, children }: { title: string; children: any }) {
  return (
    <div id="app" class="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 p-8">
      <div class="max-w-2xl mx-auto">
        <h1 class="text-3xl font-bold text-gray-800 mb-6">{title}</h1>
        {children}
      </div>
    </div>
  )
}

// ============================================================================
// App Config
// ============================================================================

const server = app.app({
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
      children: (
        <>
          {/* Stats row */}
          <div class="grid grid-cols-3 gap-4 mb-6">
            {StatsCard({ icon: "👥", label: "Total Users", value: ctx.store.users.length })}
            {StatsCard({ icon: "👑", label: "Admins", value: admins })}
            {StatsCard({ icon: "👤", label: "Users", value: users })}
          </div>

          {/* User list card */}
          {Card({
            title: "Team Members",
            children: (
              <>
                <div class="space-y-2 mb-4">
                  {ctx.store.users.map((user) => UserRow({ user, onRemove: removeUser }))}
                  {ctx.store.users.length === 0 && (
                    <p class="text-gray-500 text-center py-4">No users yet</p>
                  )}
                </div>
                {Button({
                  variant: "primary",
                  action: addUser,
                  children: "+ Add Random User",
                })}
              </>
            ),
          })}

          {/* Info card */}
          {Card({
            title: "About This Example",
            children: (
              <p class="text-gray-600 text-sm">
                Components like <code class="bg-gray-100 px-1 rounded">Card</code>,{" "}
                <code class="bg-gray-100 px-1 rounded">Button</code>, and{" "}
                <code class="bg-gray-100 px-1 rounded">UserRow</code> are just functions that return
                JSX - compose them to build complex UIs!
              </p>
            ),
          })}
        </>
      ),
    })
  },
}).serve({ port: 3009 })

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║           Nested Components Example (JSX Version)             ║
╠═══════════════════════════════════════════════════════════════╣
║  http://localhost:${server.port}                                    ║
║                                                               ║
║  Components are just functions that return JSX:               ║
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
