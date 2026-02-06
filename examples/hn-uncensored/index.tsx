/**
 * Hyperstar v3 - HN XXX Uncensored Monitor
 *
 * Tracks HN ranks over time and flags abrupt drops using z-score anomaly detection.
 */
import { createHyperstar, hs, Schema } from "hyperstar"
import { mean, standardDeviation } from "simple-statistics"

// ============================================================================
// Types
// ============================================================================

interface HNPost {
  id: number
  title: string
  points: number | null
  user: string | null
  time: number
  time_ago: string
  comments_count: number
  type: string
  url: string
  domain?: string
}

interface Snapshot {
  timestamp: number
  rank: number
  points: number
  comments: number
}

interface Alert {
  id: number
  title: string
  url: string
  hnUrl: string
  severity: number
  drop: number
  fromRank: number
  toRank: number
  scoreRising: boolean
  score: number
  detectedAt: number
  zScore: number // How many std devs from normal this drop was
}

// Per-story anomaly detector state for z-score algorithm
interface DetectorState {
  filteredDeltas: number[] // Rolling window of (possibly filtered) rank deltas
  avgFilter: number // Rolling mean
  stdFilter: number // Rolling standard deviation
}

interface Store {
  items: Record<string, HNPost>
  history: Record<string, Snapshot[]>
  alerts: Alert[]
  topIds: number[]
  frontPageIds: number[]
  lastPollAt: number | null
  lastPollDurationMs: number | null
  pollIntervalMinutes: number
  pollCount: number
  status: "idle" | "polling" | "error"
  errorMessage: string | null
  // Per-story anomaly detector state
  detectors: Record<string, DetectorState>
}

interface UserStore {
  tab: "alerts" | "front" | "detail"
  selectedId: number | null
}

// ============================================================================
// Config
// ============================================================================

const HN_PAGE_URL = (page: number) => `https://api.hnpwa.com/v0/news/${page}.json`
const DEFAULT_POLL_MINUTES = 5
const FRONT_PAGE_SIZE = 30
const TOP_STORIES_FETCH = 90
const OFF_LIST_RANK = TOP_STORIES_FETCH + 10
const MAX_HISTORY = 120
const ALERT_DEDUPE_MS = 5 * 60 * 1000
const LOG_PREFIX = "[HN-UNCENSORED]"

// Z-Score Anomaly Detection Config
// Based on smoothed z-score algorithm for real-time anomaly detection
const ANOMALY_CONFIG = {
  lag: 24, // Rolling window size (2 hours of history at 5-min polls)
  threshold: 3.0, // Z-score threshold - 3 std devs = statistically significant
  influence: 0.2, // How much anomalies affect future baseline (0-1)
  minDataPoints: 6, // Need 30 min of data before detecting (prevents false positives on new stories)
  minDrop: 5, // Minimum rank drop to even consider (filters noise)
}

// Data Retention Config
// Prune stories that haven't been seen recently AND have no alerts
const RETENTION_CONFIG = {
  storyMaxAge: 24 * 60 * 60 * 1000, // Prune stories not seen in 24 hours
  cleanupInterval: 288, // Run cleanup every N polls (every 24h at 5 min intervals)
}

// ============================================================================
// Helpers
// ============================================================================

function getStoryUrl(post: HNPost): string {
  if (!post.url) return `https://news.ycombinator.com/item?id=${post.id}`
  if (post.url.startsWith("item?")) {
    return `https://news.ycombinator.com/${post.url}`
  }
  return post.url
}

function getDomain(post: HNPost): string | null {
  if (post.domain) return post.domain
  try {
    const url = new URL(getStoryUrl(post))
    return url.hostname.replace(/^www\./, "")
  } catch {
    return null
  }
}

function formatClock(ts: number | null): string {
  if (!ts) return "never"
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

function formatAge(now: number, ts: number): string {
  const diffMs = Math.max(0, now - ts)
  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function severityColor(severity: number): string {
  if (severity >= 40) return "#dc2626"
  if (severity >= 25) return "#f97316"
  if (severity >= 15) return "#f59e0b"
  return "#6b7280"
}

function severityLabel(severity: number): string {
  if (severity >= 40) return "Likely Flagged"
  if (severity >= 25) return "Suspicious Drop"
  if (severity >= 15) return "Sharp Decline"
  return "Monitoring"
}

function sparklineHeights(history: Snapshot[]): number[] {
  const sample = history.slice(-24)
  const minHeight = 4
  const maxHeight = 18
  return sample.map((snap) => {
    const normalized = 1 - Math.min(snap.rank, OFF_LIST_RANK) / OFF_LIST_RANK
    return Math.round(minHeight + normalized * (maxHeight - minHeight))
  })
}

function buildPolyline(
  values: number[],
  width: number,
  height: number,
  min: number,
  max: number,
  invert: boolean,
): string {
  if (values.length === 0) return ""
  const span = Math.max(1, max - min)
  return values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * (width - 2) + 1
      const normalized = (value - min) / span
      const y = invert ? 1 - normalized : normalized
      const yPos = 1 + y * (height - 2)
      return `${x.toFixed(1)},${yPos.toFixed(1)}`
    })
    .join(" ")
}

function formatTimeAgo(ms: number): string {
  const minutes = Math.floor(ms / 60000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}

function rankChart(history: Snapshot[]) {
  if (history.length < 2) return null

  const padding = { left: 35, right: 50, top: 15, bottom: 20 }
  const width = 520
  const height = 140
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  const points = history.map((snap) => snap.rank)
  const currentRank = points[points.length - 1]!
  const minRank = Math.min(...points)
  const maxRank = Math.max(...points, FRONT_PAGE_SIZE + 10) // At least show some range

  // Build path in chart area
  const pathPoints = points.map((rank, i) => {
    const x = padding.left + (i / (points.length - 1)) * chartWidth
    const y = padding.top + ((rank - 1) / (maxRank - 1)) * chartHeight
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(" ")

  // Y positions for labels
  const topY = padding.top
  const cutoffY = padding.top + ((FRONT_PAGE_SIZE - 1) / (maxRank - 1)) * chartHeight
  const bottomY = padding.top + chartHeight
  const currentY = padding.top + ((currentRank - 1) / (maxRank - 1)) * chartHeight

  // Time range
  const firstTime = history[0]!.timestamp
  const lastTime = history[history.length - 1]!.timestamp
  const timeSpan = lastTime - firstTime

  return (
    <svg viewBox={`0 0 ${width} ${height}`} class="chart">
      {/* Y-axis labels */}
      <text x={padding.left - 5} y={topY + 4} class="chart-label" text-anchor="end">#1</text>
      <text x={padding.left - 5} y={cutoffY + 4} class="chart-label cutoff" text-anchor="end">#{FRONT_PAGE_SIZE}</text>
      <text x={padding.left - 5} y={bottomY + 4} class="chart-label" text-anchor="end">#{maxRank}</text>

      {/* Cutoff line */}
      <line x1={padding.left} y1={cutoffY} x2={width - padding.right} y2={cutoffY} class="chart-cutoff" />

      {/* Data line */}
      <polyline points={pathPoints} class="chart-line" />

      {/* Current value marker */}
      <circle cx={width - padding.right} cy={currentY} r="4" class="chart-dot" />
      <text x={width - padding.right + 8} y={currentY + 4} class="chart-label current">#{currentRank}</text>

      {/* Time labels */}
      <text x={padding.left} y={height - 2} class="chart-label time">{formatTimeAgo(timeSpan)}</text>
      <text x={width - padding.right} y={height - 2} class="chart-label time" text-anchor="end">now</text>
    </svg>
  )
}

function scoreChart(history: Snapshot[]) {
  if (history.length < 2) return null

  const padding = { left: 45, right: 50, top: 15, bottom: 20 }
  const width = 520
  const height = 120
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  const scores = history.map((snap) => snap.points)
  const currentScore = scores[scores.length - 1]!
  const minScore = Math.min(...scores)
  const maxScore = Math.max(...scores, minScore + 10)
  const scoreRange = maxScore - minScore

  // Build path in chart area
  const pathPoints = scores.map((score, i) => {
    const x = padding.left + (i / (scores.length - 1)) * chartWidth
    const y = padding.top + (1 - (score - minScore) / scoreRange) * chartHeight
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(" ")

  // Y positions
  const topY = padding.top
  const bottomY = padding.top + chartHeight
  const currentY = padding.top + (1 - (currentScore - minScore) / scoreRange) * chartHeight

  // Time range
  const firstTime = history[0]!.timestamp
  const lastTime = history[history.length - 1]!.timestamp
  const timeSpan = lastTime - firstTime

  // Score change
  const firstScore = scores[0]!
  const scoreChange = currentScore - firstScore
  const changeLabel = scoreChange >= 0 ? `+${scoreChange}` : `${scoreChange}`

  return (
    <svg viewBox={`0 0 ${width} ${height}`} class="chart">
      {/* Y-axis labels */}
      <text x={padding.left - 5} y={topY + 4} class="chart-label" text-anchor="end">{maxScore}</text>
      <text x={padding.left - 5} y={bottomY + 4} class="chart-label" text-anchor="end">{minScore}</text>

      {/* Data line */}
      <polyline points={pathPoints} class="chart-line score" />

      {/* Current value marker */}
      <circle cx={width - padding.right} cy={currentY} r="4" class="chart-dot score" />
      <text x={width - padding.right + 8} y={currentY + 4} class="chart-label current">{currentScore} ({changeLabel})</text>

      {/* Time labels */}
      <text x={padding.left} y={height - 2} class="chart-label time">{formatTimeAgo(timeSpan)}</text>
      <text x={width - padding.right} y={height - 2} class="chart-label time" text-anchor="end">now</text>
    </svg>
  )
}

async function fetchPage(page: number): Promise<HNPost[]> {
  const response = await fetch(HN_PAGE_URL(page))
  if (!response.ok) {
    throw new Error(`HN API error: ${response.status} ${response.statusText}`)
  }
  const data = (await response.json()) as HNPost[]
  return data.filter((post) => post.type !== "job")
}

async function fetchTopStories(): Promise<HNPost[]> {
  const pages = await Promise.all([1, 2, 3].map(fetchPage))
  const merged: HNPost[] = []
  const seen = new Set<number>()

  for (const page of pages) {
    for (const post of page) {
      if (seen.has(post.id)) continue
      seen.add(post.id)
      merged.push(post)
    }
  }

  return merged.slice(0, TOP_STORIES_FETCH)
}

// Compute z-score: how many standard deviations from the mean
function computeZScore(value: number, avg: number, std: number): number {
  if (std === 0) return 0
  return (value - avg) / std
}

// Initialize or get detector state for a story
function getDetectorState(detectors: Record<string, DetectorState>, idStr: string): DetectorState {
  return detectors[idStr] ?? {
    filteredDeltas: [],
    avgFilter: 0,
    stdFilter: 1, // Start with std of 1 to avoid divide-by-zero
  }
}

function applyPoll(store: Store, posts: HNPost[], now: number, durationMs: number) {
  const positionMap = new Map<number, number>()
  const topIds: number[] = []
  const frontPageIds: number[] = []
  const items = { ...store.items }
  const history: Record<string, Snapshot[]> = { ...store.history }
  const detectors: Record<string, DetectorState> = { ...store.detectors }

  // First pass: update positions and history for current stories
  posts.forEach((post, index) => {
    const rank = index + 1
    positionMap.set(post.id, rank)
    topIds.push(post.id)
    if (rank <= FRONT_PAGE_SIZE) frontPageIds.push(post.id)

    items[String(post.id)] = post

    const existing = history[String(post.id)] ? [...history[String(post.id)]] : []
    existing.push({
      timestamp: now,
      rank,
      points: post.points ?? 0,
      comments: post.comments_count ?? 0,
    })
    if (existing.length > MAX_HISTORY) {
      existing.splice(0, existing.length - MAX_HISTORY)
    }
    history[String(post.id)] = existing
  })

  const recentAlertIds = new Set(
    store.alerts.filter((alert) => now - alert.detectedAt < ALERT_DEDUPE_MS).map((alert) => alert.id),
  )
  const newAlerts: Alert[] = []

  // Z-score anomaly detection for each tracked story
  for (const [idStr, hist] of Object.entries(store.history)) {
    // Skip if not enough data points
    if (hist.length < ANOMALY_CONFIG.minDataPoints) continue

    const last = hist[hist.length - 1]
    // Only watch stories that were on front page
    if (!last || last.rank > FRONT_PAGE_SIZE) continue

    const id = Number(idStr)
    const currentRank = positionMap.get(id) ?? OFF_LIST_RANK
    const drop = currentRank - last.rank // Positive = dropped in rank

    // Skip if already alerted recently
    if (recentAlertIds.has(id)) continue

    // Get or initialize detector state for this story
    const detector = getDetectorState(detectors, idStr)
    const { filteredDeltas } = detector
    let { avgFilter, stdFilter } = detector

    // Calculate if this is an anomaly
    let isAnomaly = false
    let zScore = 0

    if (filteredDeltas.length >= ANOMALY_CONFIG.minDataPoints) {
      // We have enough history to compute z-score
      zScore = computeZScore(drop, avgFilter, stdFilter)

      // Anomaly: significant drop AND z-score exceeds threshold
      if (drop >= ANOMALY_CONFIG.minDrop && zScore > ANOMALY_CONFIG.threshold) {
        isAnomaly = true
      }
    }

    // Update detector state using influence parameter
    // This is the key to the smoothed z-score algorithm
    const newFilteredDeltas = [...filteredDeltas]

    if (isAnomaly) {
      // Anomaly: blend with influence parameter to prevent corruption
      const prevFiltered = newFilteredDeltas.length > 0 ? newFilteredDeltas[newFilteredDeltas.length - 1]! : drop
      const influencedValue = ANOMALY_CONFIG.influence * drop + (1 - ANOMALY_CONFIG.influence) * prevFiltered
      newFilteredDeltas.push(influencedValue)
    } else {
      // Normal: use actual value
      newFilteredDeltas.push(drop)
    }

    // Keep only the most recent 'lag' values
    while (newFilteredDeltas.length > ANOMALY_CONFIG.lag) {
      newFilteredDeltas.shift()
    }

    // Recalculate rolling mean and std
    if (newFilteredDeltas.length >= 2) {
      avgFilter = mean(newFilteredDeltas)
      stdFilter = standardDeviation(newFilteredDeltas) || 1 // Avoid zero
    }

    // Save updated detector state
    detectors[idStr] = {
      filteredDeltas: newFilteredDeltas,
      avgFilter,
      stdFilter,
    }

    // Create alert if anomaly detected
    if (isAnomaly) {
      const recentScores = hist.slice(-3).map((snap) => snap.points)
      const scoreRising =
        recentScores.length >= 2 && recentScores[recentScores.length - 1]! >= recentScores[0]!

      // Z-score based severity scoring
      const severity = Math.min(
        100,
        Math.round(
          Math.abs(zScore) * 15 + // Base: how anomalous (z-score of 3 = 45 points)
            (scoreRising ? 25 : 0) + // Score rising = very suspicious
            (currentRank > TOP_STORIES_FETCH ? 20 : 0), // Fell off list entirely
        ),
      )

      const post = items[idStr] ?? store.items[idStr]
      const title = post?.title ?? `Story ${id}`
      const url = post ? getStoryUrl(post) : `https://news.ycombinator.com/item?id=${id}`
      const score = post?.points ?? last.points

      newAlerts.push({
        id,
        title,
        url,
        hnUrl: `https://news.ycombinator.com/item?id=${id}`,
        severity,
        drop,
        fromRank: last.rank,
        toRank: currentRank,
        scoreRising,
        score,
        detectedAt: now,
        zScore: Math.round(zScore * 100) / 100, // Round to 2 decimal places
      })
    }
  }

  // Track stories that fell off the list entirely
  let offListSnapshots = 0
  for (const [idStr, hist] of Object.entries(store.history)) {
    const last = hist[hist.length - 1]
    if (!last) continue
    if (last.rank > FRONT_PAGE_SIZE) continue

    const id = Number(idStr)
    if (positionMap.has(id)) continue

    const updated = history[idStr] ? [...history[idStr]] : [...hist]
    updated.push({
      timestamp: now,
      rank: OFF_LIST_RANK,
      points: last.points,
      comments: last.comments,
    })
    if (updated.length > MAX_HISTORY) {
      updated.splice(0, updated.length - MAX_HISTORY)
    }
    history[idStr] = updated
    offListSnapshots += 1

    // Detector update happens in the main loop; avoid double-counting here.
  }

  const nextStore: Store = {
    ...store,
    items,
    history,
    detectors,
    alerts: [...newAlerts, ...store.alerts],
    topIds,
    frontPageIds,
    lastPollAt: now,
    lastPollDurationMs: durationMs,
    pollCount: store.pollCount + 1,
    status: "idle",
    errorMessage: null,
  }

  return { store: nextStore, newAlerts, offListSnapshots }
}

// Cleanup old stories that have no alerts and haven't been seen recently
function cleanupStaleData(store: Store, now: number): { store: Store; prunedCount: number } {
  // Get all story IDs that have alerts (these are protected)
  const alertedStoryIds = new Set(store.alerts.map((alert) => String(alert.id)))

  // Find stories to prune
  const storiesToPrune: string[] = []

  for (const [idStr, hist] of Object.entries(store.history)) {
    // Skip if this story has alerts
    if (alertedStoryIds.has(idStr)) continue

    // Skip if currently on the tracked list
    if (store.topIds.includes(Number(idStr))) continue

    // Check last seen time
    const lastSnapshot = hist[hist.length - 1]
    if (!lastSnapshot) continue

    const age = now - lastSnapshot.timestamp
    if (age > RETENTION_CONFIG.storyMaxAge) {
      storiesToPrune.push(idStr)
    }
  }

  if (storiesToPrune.length === 0) {
    return { store, prunedCount: 0 }
  }

  // Create new objects without pruned stories
  const items = { ...store.items }
  const history = { ...store.history }
  const detectors = { ...store.detectors }

  for (const idStr of storiesToPrune) {
    delete items[idStr]
    delete history[idStr]
    delete detectors[idStr]
  }

  return {
    store: { ...store, items, history, detectors },
    prunedCount: storiesToPrune.length,
  }
}

// ============================================================================
// App
// ============================================================================

const app = createHyperstar<Store, UserStore>()

const TabSchema = Schema.Union(
  Schema.Literal("alerts"),
  Schema.Literal("front"),
  Schema.Literal("detail"),
)

const setTab = app.action("setTab", { tab: TabSchema }, (ctx, { tab }) => {
  ctx.updateUserStore((u) => ({
    ...u,
    tab,
    selectedId: tab === "detail" ? u.selectedId : null,
  }))
})

const selectStory = app.action("selectStory", { id: Schema.Number }, (ctx, { id }) => {
  ctx.updateUserStore((u) => ({
    ...u,
    tab: "detail",
    selectedId: id,
  }))
})

async function runPoll(
  ctx: { update: (fn: (s: Store) => Store) => void; getStore: () => Store },
  options?: { force?: boolean; source?: "boot" | "repeat" | "manual" },
) {
  const current = ctx.getStore()
  if (current.status === "polling") return

  const now = Date.now()
  const intervalMs = current.pollIntervalMinutes * 60 * 1000
  const elapsedMs = current.lastPollAt ? now - current.lastPollAt : null
  const source = options?.source ?? "repeat"

  if (!options?.force && current.lastPollAt && elapsedMs !== null && elapsedMs < intervalMs) {
    console.log(
      `${LOG_PREFIX} poll skipped (${source}) | elapsed=${Math.round(elapsedMs / 1000)}s < interval ${Math.round(intervalMs / 1000)}s`,
    )
    return
  }

  ctx.update((s) => ({ ...s, status: "polling", errorMessage: null }))

  const pollNumber = current.pollCount + 1
  const started = Date.now()
  console.log(`${LOG_PREFIX} poll #${pollNumber} started (${new Date(started).toISOString()})`)

  try {
    const posts = await fetchTopStories()
    const now = Date.now()
    const durationMs = now - started

    const result = applyPoll(current, posts, now, durationMs)
    ctx.update(() => result.store)

    console.log(
      `${LOG_PREFIX} fetched ${posts.length} stories | front page ${result.store.frontPageIds.length} | ` +
      `tracked ${result.store.topIds.length} | off-list snapshots ${result.offListSnapshots} | ` +
      `poll ${durationMs}ms`,
    )

    const movers = result.store.frontPageIds
      .map((id) => {
        const hist = result.store.history[String(id)]
        if (!hist || hist.length < 2) return null
        const last = hist[hist.length - 1]!
        const prev = hist[hist.length - 2]!
        return {
          id,
          title: result.store.items[String(id)]?.title ?? `Story ${id}`,
          rank: last.rank,
          delta: prev.rank - last.rank,
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 5)

    if (movers.length > 0) {
      const summary = movers
        .map((m) => `#${m.rank} (${m.delta > 0 ? "+" : ""}${m.delta}) ${m.title}`)
        .join(" | ")
      console.log(`${LOG_PREFIX} movers: ${summary}`)
    }

    if (result.newAlerts.length > 0) {
      console.log(`${LOG_PREFIX} alerts +${result.newAlerts.length} (total ${result.store.alerts.length})`)
      for (const alert of result.newAlerts) {
        const toLabel = alert.toRank > TOP_STORIES_FETCH ? "off list" : `#${alert.toRank}`
        console.log(
          `${LOG_PREFIX} ALERT #${alert.fromRank} → ${toLabel} drop ${alert.drop} | ` +
          `z-score ${alert.zScore} | score ${alert.score} | rising ${alert.scoreRising} | severity ${alert.severity} | ${alert.title}`,
        )
      }
    }

    // Periodic cleanup of stale data (every N polls)
    if (result.store.pollCount % RETENTION_CONFIG.cleanupInterval === 0) {
      const cleanup = cleanupStaleData(result.store, now)
      if (cleanup.prunedCount > 0) {
        ctx.update(() => cleanup.store)
        console.log(`${LOG_PREFIX} cleanup: pruned ${cleanup.prunedCount} stale stories`)
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.log(`${LOG_PREFIX} error: ${message}`)
    ctx.update((s) => ({
      ...s,
      status: "error",
      errorMessage: message,
    }))
  }
}

app.repeat("hnPoll", {
  every: `${DEFAULT_POLL_MINUTES} minutes`,
  handler: async (ctx) => {
    await runPoll(ctx, { source: "repeat" })
  },
})

// Cron webhook - allows external services (cron-job.org, Uptime Robot, etc.) to trigger polls
// This enables Sprites hibernation while still collecting data periodically
app.http("/cron", async (ctx) => {
  const cronSecret = process.env.CRON_SECRET
  const providedSecret = ctx.req.headers.get("x-cron-secret") ?? ctx.url.searchParams.get("secret")

  // Authenticate if CRON_SECRET is set
  if (cronSecret && providedSecret !== cronSecret) {
    console.log(`${LOG_PREFIX} ⚠️  Cron webhook rejected - invalid secret`)
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  console.log(`${LOG_PREFIX} 🔔 Cron webhook triggered`)
  await runPoll(ctx, { source: "manual" })  // Respects poll interval

  return new Response(JSON.stringify({
    ok: true,
    timestamp: new Date().toISOString(),
    message: "Poll triggered successfully"
  }), {
    headers: { "Content-Type": "application/json" },
  })
})

const server = app
  .app({
    store: {
      items: {},
      history: {},
      alerts: [] as Alert[],
      topIds: [],
      frontPageIds: [],
      lastPollAt: null,
      lastPollDurationMs: null,
      pollIntervalMinutes: DEFAULT_POLL_MINUTES,
      pollCount: 0,
      status: "idle",
      errorMessage: null,
      detectors: {},
    } as Store,

    userStore: {
      tab: "alerts",
      selectedId: null,
    },

    persist: "./data/hn-uncensored.json",
    autoPauseWhenIdle: false, // Keep polling even when no clients connected

    title: ({ store }) =>
      store.alerts.length > 0
        ? `(${store.alerts.length}) HN Uncensored`
        : "HN Uncensored",

    onStart: async (ctx) => {
      await runPoll(ctx, { source: "boot" })
    },

    view: (ctx) => {
      const now = Date.now()
      const lastPollLabel = formatClock(ctx.store.lastPollAt)
      const statusLabel =
        ctx.store.status === "polling" ? "polling" : ctx.store.status === "error" ? "error" : "live"

      const alerts = ctx.store.alerts as Alert[]
      const selectedId = ctx.userStore.selectedId
      const selectedHistory = selectedId !== null ? ctx.store.history[String(selectedId)] ?? [] : []
      const selectedDetector = selectedId !== null ? ctx.store.detectors[String(selectedId)] : null
      const selectedStory = selectedId !== null ? ctx.store.items[String(selectedId)] : undefined
      const isAlerts = ctx.userStore.tab === "alerts"
      const isFront = ctx.userStore.tab === "front"
      const isDetail = ctx.userStore.tab === "detail"

      return (
        <div id="app">
          <style>{`
            :root {
              color-scheme: dark;
            }

            body {
              margin: 0;
              background: #0a0a0a;
            }

            #app {
              min-height: 100vh;
              background: radial-gradient(circle at top, #121212, #060606 60%);
              color: #e6e6e6;
              font-family: Verdana, Geneva, sans-serif;
              font-size: 14px;
              line-height: 1.45;
              padding: 18px 12px 40px;
            }

            .hn-shell {
              max-width: 1240px;
              width: min(1240px, calc(100vw - 24px));
              margin: 0 auto;
              background: #0f0f0f;
              border: 1px solid #2a2a2a;
              box-shadow: 0 0 0 1px #000, 0 18px 40px rgba(0, 0, 0, 0.6);
            }

            .hn-topbar {
              display: flex;
              align-items: center;
              justify-content: space-between;
              background: linear-gradient(90deg, #ff6b00, #ff2b2b 60%, #8b0f0f);
              color: #130600;
              padding: 6px 8px;
              font-weight: bold;
            }

            .hn-brand {
              display: flex;
              align-items: center;
              gap: 8px;
            }

            .hn-logo {
              width: 18px;
              height: 18px;
              border: 1px solid #1b0c08;
              background: #0b0b0b;
              color: #ff6b00;
              font-size: 12px;
              font-weight: bold;
              display: flex;
              align-items: center;
              justify-content: center;
            }

            .status-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 10px 14px;
              background: #111;
              border-bottom: 1px solid #232323;
              gap: 12px;
              flex-wrap: wrap;
            }

            .status-left,
            .status-right {
              display: flex;
              align-items: center;
              gap: 10px;
              flex-wrap: wrap;
            }

            .status-pill {
              display: inline-flex;
              align-items: center;
              gap: 6px;
              padding: 2px 8px;
              border-radius: 999px;
              border: 1px solid #551010;
              background: #1a0d0d;
              text-transform: uppercase;
              font-size: 11px;
              letter-spacing: 0.08em;
              color: #ff6b6b;
            }

            .status-pill.live {
              color: #86ff86;
              border-color: #144414;
              background: #0d160d;
            }

            .status-pill.error {
              color: #ff4d4d;
              border-color: #5a1010;
              background: #1c0d0d;
            }

            .status-meta {
              color: #9a9a9a;
              font-size: 12.5px;
            }

            .about-panel {
              position: relative;
              border-left: 1px solid #2a1a1a;
              padding-left: 12px;
            }

            .about-panel summary {
              cursor: pointer;
              color: #ffb347;
              letter-spacing: 0.08em;
              text-transform: uppercase;
              font-size: 11px;
            }

            .about-panel p {
              margin: 8px 0 0;
              color: #b0b0b0;
              font-size: 12px;
              max-width: 360px;
            }

            .tab-bar {
              display: flex;
              gap: 4px;
              padding: 8px 10px;
              border-bottom: 1px solid #1f1f1f;
              background: #0c0c0c;
              flex-wrap: wrap;
            }

            .tab-button {
              border: 1px solid transparent;
              background: transparent;
              color: #8f8f8f;
              padding: 6px 12px;
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 0.12em;
              cursor: pointer;
            }

            .tab-button.active {
              color: #ffb347;
              border-color: #3a1b1b;
              background: #190d0d;
            }

            .tab-content {
              padding: 12px 16px 20px;
            }

            .alert-card {
              border: 1px solid #2b1111;
              background: #0b0707;
              padding: 10px 12px;
              display: flex;
              flex-direction: column;
              gap: 8px;
              cursor: pointer;
            }

            .alert-header {
              display: flex;
              justify-content: space-between;
              gap: 8px;
              flex-wrap: wrap;
            }

            .alert-title {
              font-weight: bold;
              color: #ffd9d9;
              display: flex;
              align-items: center;
              gap: 8px;
            }

            .hn-domain {
              color: #7f7f7f;
              font-size: 11px;
            }

            .alert-tag {
              font-size: 10px;
              text-transform: uppercase;
              border: 1px solid #ff4d4d;
              color: #ff4d4d;
              padding: 1px 4px;
              letter-spacing: 0.1em;
            }

            .alert-meta {
              color: #b9b9b9;
              font-size: 11px;
              display: flex;
              gap: 10px;
              flex-wrap: wrap;
            }

            .sparkline {
              display: flex;
              align-items: flex-end;
              gap: 2px;
              height: 18px;
            }

            .sparkline span {
              width: 6px;
              background: linear-gradient(180deg, #ff7a2f, #ff2b2b);
              opacity: 0.85;
            }

            .alert-list {
              display: flex;
              flex-direction: column;
              gap: 10px;
            }

            .front-row {
              display: grid;
              grid-template-columns: 40px 40px 1fr auto;
              gap: 10px;
              padding: 8px 6px;
              border-bottom: 1px solid #151515;
              align-items: center;
              cursor: pointer;
            }

            .front-list {
              display: flex;
              flex-direction: column;
            }

            .front-row:hover {
              background: #101010;
            }

            .front-rank {
              color: #8a8a8a;
              text-align: right;
            }

            .front-delta {
              font-size: 11px;
              text-align: center;
            }

            .front-title {
              color: #f0f0f0;
              text-decoration: none;
            }

            .front-sub {
              color: #9c9c9c;
              font-size: 12px;
              display: flex;
              gap: 8px;
              flex-wrap: wrap;
            }

            .front-meta {
              color: #6b6b6b;
              font-size: 11px;
              white-space: nowrap;
            }

            .detail-card {
              border: 1px solid #1c1c1c;
              background: #0b0b0b;
              padding: 14px;
              display: flex;
              flex-direction: column;
              gap: 12px;
            }

            .detail-title {
              font-size: 16px;
              font-weight: bold;
            }

            .detail-meta {
              font-size: 12px;
              color: #9c9c9c;
              display: flex;
              gap: 12px;
              flex-wrap: wrap;
            }

            .detail-summary {
              display: flex;
              align-items: center;
              gap: 16px;
              padding: 10px 14px;
              background: #0a0a0a;
              border: 1px solid #1a1a1a;
              border-radius: 4px;
              flex-wrap: wrap;
            }

            .status-badge {
              font-size: 11px;
              font-weight: bold;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              padding: 4px 10px;
              border-radius: 3px;
            }

            .status-badge.safe {
              background: #0d1a0d;
              color: #4ade80;
              border: 1px solid #166534;
            }

            .status-badge.warning {
              background: #1a150d;
              color: #fbbf24;
              border: 1px solid #854d0e;
            }

            .summary-stat {
              font-size: 12px;
              color: #888;
            }

            .summary-stat.highlight {
              color: #ff7a2f;
            }

            .chart-title {
              font-size: 13px;
              color: #ccc;
              margin-bottom: 6px;
            }

            .chart-hint {
              font-size: 11px;
              color: #666;
              margin-left: 8px;
            }

            .chart {
              width: 100%;
              height: 140px;
            }

            .chart-line {
              fill: none;
              stroke: #ff7a2f;
              stroke-width: 2;
            }

            .chart-line.score {
              stroke: #22c55e;
            }

            .chart-cutoff {
              stroke: #3a3a3a;
              stroke-dasharray: 4 4;
            }

            .chart-label {
              font-size: 10px;
              fill: #6b6b6b;
              font-family: inherit;
            }

            .chart-label.cutoff {
              fill: #666;
            }

            .chart-label.current {
              fill: #ff7a2f;
              font-weight: bold;
              font-size: 11px;
            }

            .chart-label.time {
              fill: #555;
            }

            .chart-dot {
              fill: #ff7a2f;
            }

            .chart-dot.score {
              fill: #22c55e;
            }

            .chart-label.current + .chart-line.score,
            .chart text.current {
              fill: #22c55e;
            }

            svg.chart text.current:last-of-type {
              fill: #22c55e;
            }

            .empty-state {
              padding: 14px 16px;
              color: #8a8a8a;
              font-size: 12px;
            }

            .footer {
              border-top: 1px solid #1f1f1f;
              padding: 10px 14px 12px;
              color: #7f7f7f;
              font-size: 12px;
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 12px;
              flex-wrap: wrap;
            }

            .footer a {
              color: #ffb347;
              text-decoration: none;
            }

            .footer a:hover {
              color: #ffd38d;
            }

            .footer-logo {
              display: inline-flex;
              align-items: center;
              gap: 8px;
            }

            .footer-logo .star {
              font-size: 14px;
              color: #ffb347;
            }

            @media (max-width: 820px) {
              #app {
                font-size: 13.5px;
                padding: 12px 8px 32px;
              }

              .hn-shell {
                width: calc(100vw - 16px);
              }

              .about-panel {
                width: 100%;
                border-left: none;
                padding-left: 0;
              }

              .front-row {
                grid-template-columns: 30px 32px 1fr;
              }

              .front-row .front-meta {
                display: none;
              }
            }
          `}</style>

          <div class="hn-shell">
            <div class="hn-topbar">
              <div class="hn-brand">
                <div class="hn-logo">Y</div>
                <div>HN XXX Uncensored</div>
              </div>
            </div>

            <div class="status-row">
              <div class="status-left">
                <span class={`status-pill ${statusLabel === "live" ? "live" : statusLabel === "error" ? "error" : ""}`}>
                  {statusLabel}
                </span>
                <span class="status-meta">last poll: {lastPollLabel}</span>
                <span class="status-meta">interval: {ctx.store.pollIntervalMinutes}m</span>
                <span class="status-meta">front page: {ctx.store.frontPageIds.length}</span>
                <span class="status-meta">tracked: {ctx.store.topIds.length}</span>
                <span class="status-meta">alerts: {alerts.length}</span>
                {ctx.store.lastPollDurationMs !== null && (
                  <span class="status-meta">poll: {ctx.store.lastPollDurationMs}ms</span>
                )}
              </div>
              <div class="status-right">
                <details class="about-panel">
                  <summary>about</summary>
                  <p>
                    HN stories sometimes vanish from the front page without warning. This site watches the
                    top {TOP_STORIES_FETCH} every {ctx.store.pollIntervalMinutes} minutes, tracks rank velocity,
                    and flags removals or unnatural drops. Severity jumps if the score
                    is still rising or the story falls completely off the top {TOP_STORIES_FETCH}, which looks
                    a lot like a quiet deflation.
                  </p>
                </details>
              </div>
            </div>

            <div class="tab-bar">
              <button class={`tab-button ${isAlerts ? "active" : ""}`} $={hs.action(setTab, { tab: "alerts" })}>
                alerts ({alerts.length})
              </button>
              <button class={`tab-button ${isFront ? "active" : ""}`} $={hs.action(setTab, { tab: "front" })}>
                front page
              </button>
              <button class={`tab-button ${isDetail && selectedId !== null ? "active" : ""}`} $={hs.action(setTab, { tab: "detail" })}>
                story detail
              </button>
            </div>

            {ctx.store.errorMessage && (
              <div class="empty-state">Error: {ctx.store.errorMessage}</div>
            )}

            {isAlerts && (
              <div class="tab-content">
                {alerts.length === 0 ? (
                  <div class="empty-state">No alerts yet. Monitoring quietly.</div>
                ) : (
                  <div class="alert-list">
                    {alerts.slice(0, 40).map((alert) => {
                      const hist = ctx.store.history[String(alert.id)] ?? []
                      const alertPost = ctx.store.items[String(alert.id)]
                      const domain = alertPost ? getDomain(alertPost) : null
                      const spark = sparklineHeights(hist)
                      const toLabel = alert.toRank > TOP_STORIES_FETCH ? "off list" : `#${alert.toRank}`
                      const label = severityLabel(alert.severity)
                      const color = severityColor(alert.severity)
                      return (
                        <div
                          class="alert-card"
                          id={`alert-${alert.id}-${alert.detectedAt}`}
                          style={`border-left: 4px solid ${color};`}
                          $={hs.action(selectStory, { id: alert.id })}
                        >
                          <div class="alert-header">
                            <div class="alert-title">
                              <span class="alert-tag">drop</span>
                              <a href={alert.url} target="_blank" rel="noreferrer">
                                {alert.title}
                              </a>
                              {domain && <span class="hn-domain">({domain})</span>}
                            </div>
                            <span class="status-meta">{formatAge(now, alert.detectedAt)}</span>
                          </div>
                          <div class="alert-meta">
                            <span>{label}</span>
                            <span>#{alert.fromRank} → {toLabel}</span>
                            <span>drop {alert.drop}</span>
                            <span>z: {alert.zScore ?? "N/A"}</span>
                            <span>score {alert.score}</span>
                            {alert.scoreRising && <span>score rising</span>}
                          </div>
                          {spark.length > 0 && (
                            <div class="sparkline" aria-hidden="true">
                              {spark.map((height, i) => (
                                <span style={`height:${height}px`} id={`spark-${alert.id}-${i}`} />
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {isFront && (
              <div class="tab-content">
                {ctx.store.frontPageIds.length === 0 ? (
                  <div class="empty-state">Waiting for first poll...</div>
                ) : (
                  <div class="front-list">
                    {ctx.store.frontPageIds.map((id) => {
                      const post = ctx.store.items[String(id)]
                      if (!post) return null
                      const hist = ctx.store.history[String(id)] ?? []
                      const last = hist[hist.length - 1]
                      const prev = hist[hist.length - 2]
                      const rank = last?.rank ?? 0
                      const delta = prev ? prev.rank - (last?.rank ?? prev.rank) : 0
                      const deltaLabel = delta === 0 ? "—" : delta > 0 ? `▲${delta}` : `▼${Math.abs(delta)}`
                      const deltaColor = delta > 0 ? "#22c55e" : delta < 0 ? "#ef4444" : "#6b7280"

                      return (
                        <div
                          class="front-row"
                          id={`front-${id}`}
                          $={hs.action(selectStory, { id })}
                        >
                          <div class="front-rank">{rank}.</div>
                          <div class="front-delta" style={`color:${deltaColor}`}>{deltaLabel}</div>
                          <div>
                            <div>
                              <a class="front-title" href={getStoryUrl(post)} target="_blank" rel="noreferrer">
                                {post.title}
                              </a>
                              {getDomain(post) && <span class="hn-domain"> ({getDomain(post)})</span>}
                            </div>
                            <div class="front-sub">
                              <span>{post.points ?? 0} points</span>
                              <span>by {post.user ?? "anonymous"}</span>
                              <span>{post.time_ago}</span>
                            </div>
                          </div>
                          <div class="front-meta">{hist.length} samples</div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {isDetail && (
              <div class="tab-content">
                {selectedId === null ? (
                  <div class="empty-state">Select a story to view details.</div>
                ) : (() => {
                  // Calculate stats for this story
                  const currentRank = selectedHistory.length > 0
                    ? selectedHistory[selectedHistory.length - 1]!.rank
                    : 0
                  const prevRank = selectedHistory.length > 1
                    ? selectedHistory[selectedHistory.length - 2]!.rank
                    : currentRank
                  const lastDelta = currentRank - prevRank
                  const avgDelta = selectedDetector?.avgFilter ?? 0
                  const stdDelta = selectedDetector?.stdFilter ?? 1
                  const samplesInWindow = selectedDetector?.filteredDeltas.length ?? 0
                  const hasEnoughData = samplesInWindow >= ANOMALY_CONFIG.minDataPoints

                  // What drop would trigger an alert?
                  const triggerThreshold = Math.round(avgDelta + (ANOMALY_CONFIG.threshold * stdDelta))

                  // Calculate min/max rank for context
                  const ranks = selectedHistory.map(s => s.rank)
                  const minRank = ranks.length > 0 ? Math.min(...ranks) : 0
                  const maxRank = ranks.length > 0 ? Math.max(...ranks) : 0

                  return (
                    <div class="detail-card">
                      <div class="detail-title">
                        {selectedStory?.title ?? `Story ${selectedId}`}
                      </div>
                      {selectedStory?.url && (
                        <a href={selectedStory.url} target="_blank" rel="noreferrer">
                          {selectedStory.url}
                        </a>
                      )}
                      <div class="detail-meta">
                        <span>score: {selectedStory?.points ?? 0}</span>
                        <span>comments: {selectedStory?.comments_count ?? 0}</span>
                        <span>samples: {selectedHistory.length}</span>
                        <a
                          href={`https://news.ycombinator.com/item?id=${selectedId}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          view on HN
                        </a>
                      </div>

                      {/* Status summary */}
                      <div class="detail-summary">
                        <span class={`status-badge ${currentRank <= FRONT_PAGE_SIZE ? "safe" : "warning"}`}>
                          {currentRank <= FRONT_PAGE_SIZE ? "On Front Page" : "Below Fold"}
                        </span>
                        <span class="summary-stat">
                          Rank range #{minRank}–#{maxRank}
                        </span>
                        <span class="summary-stat">
                          Avg move {hasEnoughData ? `±${stdDelta.toFixed(1)}` : "—"}
                        </span>
                        <span class="summary-stat highlight">
                          Alert if drops {hasEnoughData ? `>${triggerThreshold}` : "(building baseline)"}
                        </span>
                      </div>

                      {/* Rank chart */}
                      <div>
                        <div class="chart-title">Rank Over Time <span class="chart-hint">lower = better, dashed = front page cutoff</span></div>
                        {rankChart(selectedHistory) ?? (
                          <div class="empty-state">Need more data points to chart.</div>
                        )}
                      </div>

                      {/* Score chart */}
                      <div>
                        <div class="chart-title">Score Over Time <span class="chart-hint">upvotes</span></div>
                        {scoreChart(selectedHistory) ?? (
                          <div class="empty-state">Need more data points to chart.</div>
                        )}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}

            <div class="footer">
              <span class="footer-logo">
                <span class="star">⭐</span>
                created with Hyperstar
              </span>
              <a href="https://github.com/StreamUI/hyperstar" target="_blank" rel="noreferrer">
                github.com/StreamUI/hyperstar
              </a>
            </div>
          </div>
        </div>
      )
    },
  })
  .serve({ port: 3014 })

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                    HN Uncensored Monitor                      ║
╠═══════════════════════════════════════════════════════════════╣
║  http://localhost:${server.port}                                    ║
║  http://localhost:${server.port}/cron  (webhook for external cron)  ║
║                                                               ║
║  Polling: ${DEFAULT_POLL_MINUTES} minutes                     ║
║  Persist: ./data/hn-uncensored.json                           ║
║                                                               ║
║  Set CRON_SECRET env var to secure the webhook                ║
╚═══════════════════════════════════════════════════════════════╝
`)

process.on("SIGINT", async () => {
  console.log("\nShutting down...")
  await server.stop()
  process.exit(0)
})
