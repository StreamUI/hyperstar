/**
 * Hyperstar v3 - Live Dashboard Example (JSX Version)
 *
 * A real-time dashboard with live updating metrics, activity feed,
 * and status indicators. Perfect for SaaS admin panels.
 *
 * Features demonstrated:
 * - hs.interval() for live data updates
 * - Multiple stat cards with trend indicators
 * - Activity feed with timestamps
 * - Status badges
 * - Real-time sync
 */
import { createHyperstar, hs, Schema } from "hyperstar"

// ============================================================================
// Types
// ============================================================================

interface Metric {
  id: string
  label: string
  value: number
  previousValue: number
  format: "number" | "currency" | "percent"
  icon: string
}

interface Activity {
  id: string
  type: "user_signup" | "purchase" | "error" | "deployment"
  message: string
  timestamp: string
}

interface SystemStatus {
  name: string
  status: "operational" | "degraded" | "down"
  latency: number
}

interface Store {
  metrics: Metric[]
  activities: Activity[]
  systems: SystemStatus[]
  lastUpdated: string
}

interface Signals {
  refreshing: boolean
}

// ============================================================================
// Helpers
// ============================================================================

function formatValue(value: number, format: Metric["format"]): string {
  switch (format) {
    case "currency":
      return `$${value.toLocaleString()}`
    case "percent":
      return `${value.toFixed(1)}%`
    default:
      return value.toLocaleString()
  }
}

function getTrendClass(current: number, previous: number): { class: string; arrow: string } {
  if (current > previous) return { class: "text-green-500", arrow: "↑" }
  if (current < previous) return { class: "text-red-500", arrow: "↓" }
  return { class: "text-gray-400", arrow: "→" }
}

function getStatusColor(status: SystemStatus["status"]): string {
  switch (status) {
    case "operational":
      return "bg-green-500"
    case "degraded":
      return "bg-yellow-500"
    case "down":
      return "bg-red-500"
  }
}

function getActivityIcon(type: Activity["type"]): string {
  switch (type) {
    case "user_signup":
      return "👤"
    case "purchase":
      return "💰"
    case "error":
      return "⚠️"
    case "deployment":
      return "🚀"
  }
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// ============================================================================
// Create Factory
// ============================================================================

const app = createHyperstar<Store, {}, Signals>()

// ============================================================================
// Signals
// ============================================================================

const { refreshing } = app.signals

// ============================================================================
// Actions
// ============================================================================

const manualRefresh = app.action("manualRefresh", (ctx) => {
  ctx.patchSignals({ refreshing: true })

  // Simulate refresh
  ctx.update((s) => updateMetrics(s))

  // Reset refreshing state after animation
  setTimeout(() => ctx.patchSignals({ refreshing: false }), 500)
})

const clearActivities = app.action("clearActivities", (ctx) => {
  ctx.update((s) => ({ ...s, activities: [] }))
})

// ============================================================================
// Data Update Logic
// ============================================================================

function updateMetrics(s: Store): Store {
  const activityTypes: Activity["type"][] = ["user_signup", "purchase", "error", "deployment"]
  const messages: Record<Activity["type"], string[]> = {
    user_signup: ["New user registered", "User completed onboarding", "Team member invited"],
    purchase: ["New subscription: Pro Plan", "Upgrade to Enterprise", "Annual plan renewed"],
    error: ["API rate limit exceeded", "Database connection timeout", "Payment processing failed"],
    deployment: ["v2.1.0 deployed to production", "Hotfix applied", "Rollback completed"],
  }

  // Randomly add activity
  const newActivities = [...s.activities]
  if (Math.random() > 0.5) {
    const type = activityTypes[Math.floor(Math.random() * activityTypes.length)]!
    const typeMessages = messages[type]
    newActivities.unshift({
      id: crypto.randomUUID().slice(0, 8),
      type,
      message: typeMessages[Math.floor(Math.random() * typeMessages.length)]!,
      timestamp: new Date().toISOString(),
    })
    // Keep only last 10
    if (newActivities.length > 10) newActivities.pop()
  }

  return {
    ...s,
    metrics: s.metrics.map((m) => {
      const change = (Math.random() - 0.4) * (m.value * 0.05) // Slight bias toward growth
      const newValue = Math.max(0, m.value + change)
      return {
        ...m,
        previousValue: m.value,
        value: m.format === "percent" ? Math.min(100, newValue) : Math.round(newValue),
      }
    }),
    systems: s.systems.map((sys) => ({
      ...sys,
      latency: randomBetween(10, sys.status === "operational" ? 100 : 500),
      status: Math.random() > 0.95 ? "degraded" : Math.random() > 0.99 ? "down" : "operational",
    })),
    activities: newActivities,
    lastUpdated: new Date().toISOString(),
  }
}

// ============================================================================
// Interval - Live Updates
// ============================================================================

app.interval("metrics-update", {
  every: "3 seconds",
  handler: (ctx) => {
    ctx.update(updateMetrics)
  },
})

// ============================================================================
// Components
// ============================================================================

function MetricCard({ metric }: { metric: Metric }) {
  const trend = getTrendClass(metric.value, metric.previousValue)
  const percentChange = metric.previousValue
    ? (((metric.value - metric.previousValue) / metric.previousValue) * 100).toFixed(1)
    : "0"

  return (
    <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <div class="flex items-center justify-between mb-2">
        <span class="text-2xl">{metric.icon}</span>
        <span class={`text-sm font-medium ${trend.class}`}>
          {trend.arrow} {Math.abs(Number(percentChange))}%
        </span>
      </div>
      <div class="text-3xl font-bold text-gray-900 mb-1">
        {formatValue(metric.value, metric.format)}
      </div>
      <div class="text-sm text-gray-500">{metric.label}</div>
    </div>
  )
}

function ActivityItem({ activity }: { activity: Activity }) {
  const timeAgo = Math.floor((Date.now() - new Date(activity.timestamp).getTime()) / 1000)
  const timeStr = timeAgo < 60 ? `${timeAgo}s ago` : `${Math.floor(timeAgo / 60)}m ago`

  return (
    <div class="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
      <span class="text-lg">{getActivityIcon(activity.type)}</span>
      <div class="flex-1 min-w-0">
        <p class="text-sm text-gray-900">{activity.message}</p>
        <p class="text-xs text-gray-400">{timeStr}</p>
      </div>
    </div>
  )
}

function SystemStatusRow({ system }: { system: SystemStatus }) {
  return (
    <div class="flex items-center justify-between py-2">
      <div class="flex items-center gap-2">
        <div class={`w-2 h-2 rounded-full ${getStatusColor(system.status)}`} />
        <span class="text-sm text-gray-700">{system.name}</span>
      </div>
      <span class="text-xs text-gray-400">{system.latency}ms</span>
    </div>
  )
}

// ============================================================================
// App Config
// ============================================================================

const server = app.app({
  store: {
    metrics: [
      { id: "users", label: "Active Users", value: 12847, previousValue: 12500, format: "number", icon: "👥" },
      { id: "revenue", label: "Monthly Revenue", value: 48520, previousValue: 45000, format: "currency", icon: "💵" },
      { id: "conversion", label: "Conversion Rate", value: 3.2, previousValue: 3.0, format: "percent", icon: "📈" },
      { id: "requests", label: "API Requests", value: 1283947, previousValue: 1200000, format: "number", icon: "⚡" },
    ],
    activities: [
      { id: "1", type: "user_signup", message: "New user registered", timestamp: new Date().toISOString() },
      { id: "2", type: "purchase", message: "New subscription: Pro Plan", timestamp: new Date(Date.now() - 60000).toISOString() },
      { id: "3", type: "deployment", message: "v2.1.0 deployed to production", timestamp: new Date(Date.now() - 120000).toISOString() },
    ],
    systems: [
      { name: "API Gateway", status: "operational", latency: 45 },
      { name: "Database", status: "operational", latency: 12 },
      { name: "Cache", status: "operational", latency: 3 },
      { name: "CDN", status: "operational", latency: 28 },
      { name: "Search", status: "operational", latency: 67 },
    ],
    lastUpdated: new Date().toISOString(),
  },
  signals: { refreshing: false },

  title: ({ store }) => {
    const users = store.metrics.find((m) => m.id === "users")
    return `Dashboard - ${users?.value.toLocaleString()} users`
  },

  view: (ctx) => (
    <div id="app" class="min-h-screen bg-gray-50">
      {/* Header */}
      <header class="bg-white border-b px-6 py-4">
        <div class="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">Live Dashboard</h1>
            <p class="text-sm text-gray-500">
              Last updated: {new Date(ctx.store.lastUpdated).toLocaleTimeString()}
            </p>
          </div>
          <button
            $={hs.action(manualRefresh)}
            hs-class:animate-spin={refreshing.expr}
            class="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            🔄
          </button>
        </div>
      </header>

      <main class="max-w-7xl mx-auto p-6">
        {/* Metrics Grid */}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {ctx.store.metrics.map((metric) => (
            <MetricCard metric={metric} />
          ))}
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Activity Feed */}
          <div class="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100">
            <div class="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 class="font-semibold text-gray-900">Recent Activity</h2>
              <button
                $={hs.action(clearActivities)}
                class="text-sm text-gray-500 hover:text-gray-700"
              >
                Clear
              </button>
            </div>
            <div class="p-4 max-h-96 overflow-y-auto">
              {ctx.store.activities.length === 0 ? (
                <p class="text-center text-gray-400 py-8">No recent activity</p>
              ) : (
                ctx.store.activities.map((activity) => (
                  <ActivityItem activity={activity} />
                ))
              )}
            </div>
          </div>

          {/* System Status */}
          <div class="bg-white rounded-xl shadow-sm border border-gray-100">
            <div class="p-4 border-b border-gray-100">
              <h2 class="font-semibold text-gray-900">System Status</h2>
            </div>
            <div class="p-4">
              {ctx.store.systems.map((system) => (
                <SystemStatusRow system={system} />
              ))}
            </div>
            <div class="p-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">
              <div class="flex items-center gap-2 text-sm">
                <div class="w-2 h-2 rounded-full bg-green-500" />
                <span class="text-gray-600">All systems operational</span>
              </div>
            </div>
          </div>
        </div>

        {/* Chart Placeholder */}
        <div class="mt-6 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 class="font-semibold text-gray-900 mb-4">Traffic Overview</h2>
          <div class="h-48 flex items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
            <p class="text-gray-400">Chart placeholder - integrate your favorite charting library</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer class="mt-8 py-4 text-center text-sm text-gray-400">
        Metrics update every 3 seconds via hs.interval() • Open in multiple tabs to see real-time sync
      </footer>
    </div>
  ),
}).serve({ port: 3021 })

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                  Live Dashboard (JSX)                         ║
╠═══════════════════════════════════════════════════════════════╣
║  http://localhost:${server.port}                                    ║
║                                                               ║
║  Features:                                                    ║
║  • Live updating metrics every 3 seconds                      ║
║  • Activity feed with random events                           ║
║  • System status with latency indicators                      ║
║  • Trend arrows showing metric changes                        ║
║  • Real-time sync across all connected clients                ║
╚═══════════════════════════════════════════════════════════════╝
`)

process.on("SIGINT", async () => {
  console.log("\nShutting down...")
  await server.stop()
  process.exit(0)
})
