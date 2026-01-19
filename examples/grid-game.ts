/**
 * Hyperstar v3 - Grid Game Example (BitSplat-inspired)
 *
 * A multiplayer territory control game where teams compete to own grid cells.
 * Click cells to claim them for your team. Watch territory change in real-time!
 *
 * Features demonstrated:
 * - hs.action() with Schema validation
 * - Signal protocol for client-side team selection
 * - hs.timer() for round countdown
 * - UI.each for rendering the grid
 * - on.action() with dynamic args
 */
import { createHyperstar, UI, on, $, Schema } from "hyperstar"

// ============================================================================
// Types & Constants
// ============================================================================

const GRID_WIDTH = 16
const GRID_HEIGHT = 12
const ROUND_DURATION = 60

const TEAMS = {
  red: { id: "red", name: "Red Team", color: "#ef4444" },
  blue: { id: "blue", name: "Blue Team", color: "#3b82f6" },
} as const

type TeamId = keyof typeof TEAMS

interface Cell {
  ownerId: TeamId | null
  x: number
  y: number
}

interface TeamStats {
  score: number
  percentage: number
}

interface Store {
  grid: Cell[]
  teamStats: Record<TeamId, TeamStats>
  roundTimeRemaining: number
  roundState: "playing" | "finished"
  winner: TeamId | null
}

// ============================================================================
// Helpers
// ============================================================================

function createEmptyGrid(): Cell[] {
  const cells: Cell[] = []
  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      cells.push({ ownerId: null, x, y })
    }
  }
  return cells
}

function calculateTeamStats(grid: Cell[]): Record<TeamId, TeamStats> {
  const totalCells = GRID_WIDTH * GRID_HEIGHT
  const stats: Record<TeamId, TeamStats> = {
    red: { score: 0, percentage: 0 },
    blue: { score: 0, percentage: 0 },
  }

  for (const cell of grid) {
    if (cell.ownerId) {
      stats[cell.ownerId].score++
    }
  }

  for (const teamId of Object.keys(stats) as TeamId[]) {
    stats[teamId].percentage = Math.round((stats[teamId].score / totalCells) * 100)
  }

  return stats
}

function determineWinner(stats: Record<TeamId, TeamStats>): TeamId | null {
  if (stats.red.score > stats.blue.score) return "red"
  if (stats.blue.score > stats.red.score) return "blue"
  return null
}

function formatTime(seconds: number): string {
  const mins = Math.floor(Math.abs(seconds) / 60)
  const secs = Math.abs(seconds) % 60
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

interface Signals {
  team: "red" | "blue"
}

// ============================================================================
// Create Factory
// ============================================================================

const hs = createHyperstar<Store, {}, Signals>()

// ============================================================================
// Signals - Client-side state
// ============================================================================

const { team } = hs.signals

// ============================================================================
// Actions
// ============================================================================

const claimCell = hs.action(
  "claimCell",
  { team: Schema.String, x: Schema.Number, y: Schema.Number },
  (ctx, { team, x, y }) => {
    const store = ctx.getStore()
    if (store.roundState !== "playing") return
    if (team !== "red" && team !== "blue") return
    if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return

    ctx.update((s) => {
      const newGrid = s.grid.map((cell) =>
        cell.x === x && cell.y === y ? { ...cell, ownerId: team as TeamId } : cell,
      )
      return {
        ...s,
        grid: newGrid,
        teamStats: calculateTeamStats(newGrid),
      }
    })
  },
)

// ============================================================================
// Timer - Round countdown
// ============================================================================

hs.timer("roundTimer", {
  interval: 1000,
  handler: (ctx) => {
    ctx.update((s) => {
      if (s.roundState === "playing") {
        const newTime = s.roundTimeRemaining - 1
        if (newTime <= 0) {
          return {
            ...s,
            roundTimeRemaining: newTime,
            roundState: "finished" as const,
            winner: determineWinner(s.teamStats),
          }
        }
        return { ...s, roundTimeRemaining: newTime }
      } else if (s.roundState === "finished") {
        const newTime = s.roundTimeRemaining - 1
        if (newTime <= -5) {
          // Start new round
          const newGrid = createEmptyGrid()
          return {
            ...s,
            grid: newGrid,
            roundTimeRemaining: ROUND_DURATION,
            roundState: "playing" as const,
            winner: null,
            teamStats: calculateTeamStats(newGrid),
          }
        }
        return { ...s, roundTimeRemaining: newTime }
      }
      return s
    })
  },
})

// ============================================================================
// View Components
// ============================================================================

const Header = (store: Store) =>
  UI.header(
    { attrs: { class: "p-4 flex justify-between items-center bg-slate-800" } },
    UI.h1({ attrs: { class: "text-xl font-bold" } }, "Grid Game v3"),
    UI.div(
      { attrs: { class: "flex gap-4 items-center" } },
      UI.show(
        store.roundState === "playing",
        UI.span(
          { attrs: { class: "text-2xl font-bold tabular-nums" } },
          formatTime(store.roundTimeRemaining),
        ),
      ),
      UI.show(
        store.roundState === "finished",
        UI.span(
          { attrs: { class: "text-base" } },
          store.winner ? `${TEAMS[store.winner].name} Wins! ` : "It's a Draw! ",
          `New round in ${Math.abs(store.roundTimeRemaining)}s`,
        ),
      ),
    ),
  )

const GameGrid = (store: Store) =>
  UI.div(
    { attrs: { class: "flex-1 flex items-center justify-center" } },
    UI.div(
      {
        attrs: {
          id: "game-grid",
          class: "bg-slate-950 p-1 rounded-lg",
          style: `display: grid; grid-template-columns: repeat(${GRID_WIDTH}, 32px); grid-template-rows: repeat(${GRID_HEIGHT}, 32px); gap: 2px;`,
        },
      },
      UI.each(
        store.grid,
        (cell) => `cell-${cell.x}-${cell.y}`,
        (cell) => {
          const cellTeam = cell.ownerId ? TEAMS[cell.ownerId] : null
          const bgColor = cellTeam ? cellTeam.color : "#334155"
          const cursorClass =
            store.roundState === "playing" ? "cursor-pointer hover:opacity-80" : "cursor-default"

          return UI.div({
            attrs: {
              id: `cell-${cell.x}-${cell.y}`,
              class: `w-8 h-8 rounded-sm transition-colors duration-150 ${cursorClass}`,
              style: `background: ${bgColor};`,
            },
            events: {
              click: on.action(claimCell, {
                team: $.signal("team"),
                x: cell.x,
                y: cell.y,
              }),
            },
          })
        },
      ),
    ),
  )

const TeamSelector = () =>
  UI.div(
    { attrs: { class: "bg-slate-800 p-4 rounded-lg" } },
    UI.h3({ attrs: { class: "text-base font-semibold mb-4" } }, "Select Your Team"),
    UI.div(
      { attrs: { class: "flex gap-2" } },
      UI.button(
        {
          attrs: {
            class: "flex-1 py-3 text-white font-bold rounded cursor-pointer",
            style: `background: ${TEAMS.red.color};`,
          },
          events: { click: on.signal("team", $.str("red")) },
        },
        "Red",
      ),
      UI.button(
        {
          attrs: {
            class: "flex-1 py-3 text-white font-bold rounded cursor-pointer",
            style: `background: ${TEAMS.blue.color};`,
          },
          events: { click: on.signal("team", $.str("blue")) },
        },
        "Blue",
      ),
    ),
    UI.p({ attrs: { class: "mt-3 text-xs text-center opacity-60" } }, "Click cells to claim territory!"),
  )

const Leaderboard = (store: Store) => {
  const sortedTeams = (Object.keys(TEAMS) as TeamId[]).sort(
    (a, b) => store.teamStats[b].score - store.teamStats[a].score,
  )

  return UI.div(
    { attrs: { class: "bg-slate-800 p-4 rounded-lg flex-1" } },
    UI.h3({ attrs: { class: "text-base font-semibold mb-4" } }, "Leaderboard"),
    UI.each(
      sortedTeams,
      (teamId) => `leaderboard-${teamId}`,
      (teamId, i) => {
        const team = TEAMS[teamId]
        const stats = store.teamStats[teamId]
        return UI.div(
          { attrs: { id: `team-${teamId}`, class: "mb-4" } },
          UI.div(
            { attrs: { class: "flex items-center gap-2 mb-2" } },
            UI.span({ attrs: { class: "w-5 font-bold opacity-60" } }, `#${i + 1}`),
            UI.div({
              attrs: {
                class: "w-3 h-3 rounded-full",
                style: `background: ${team.color};`,
              },
            }),
            UI.span({ attrs: { class: "flex-1" } }, team.name),
            UI.span(
              { attrs: { class: "font-bold", style: `color: ${team.color};` } },
              `${stats.percentage}%`,
            ),
          ),
          UI.div(
            { attrs: { class: "h-2 bg-slate-700 rounded overflow-hidden" } },
            UI.div({
              attrs: {
                class: "h-full transition-all duration-300",
                style: `width: ${stats.percentage}%; background: ${team.color};`,
              },
            }),
          ),
        )
      },
    ),
  )
}

const Instructions = () =>
  UI.div(
    { attrs: { class: "bg-slate-800 p-4 rounded-lg text-sm opacity-80" } },
    UI.p({ attrs: { class: "mb-2 font-medium" } }, "How to play:"),
    UI.ol(
      { attrs: { class: "pl-5 list-decimal space-y-1" } },
      UI.li({}, "Select a team above"),
      UI.li({}, "Click cells to claim them"),
      UI.li({}, "Most territory wins!"),
    ),
  )

// ============================================================================
// App Config
// ============================================================================

const initialGrid = createEmptyGrid()

const server = hs.app({
  store: {
    grid: initialGrid,
    teamStats: calculateTeamStats(initialGrid),
    roundTimeRemaining: ROUND_DURATION,
    roundState: "playing",
    winner: null,
  } as Store,
  signals: { team: "red" },

  title: ({ store }) => `Grid Game - ${store.roundState === "playing" ? formatTime(store.roundTimeRemaining) : "Round Over"}`,

  view: (ctx) =>
    UI.div(
      { attrs: { id: "app", class: "flex flex-col h-screen bg-slate-900 text-white" } },

      // Header
      Header(ctx.store),

      // Main Content
      UI.div(
        { attrs: { class: "flex-1 flex gap-4 p-4 overflow-hidden" } },

        // Game Grid
        GameGrid(ctx.store),

        // Side Panel
        UI.div(
          { attrs: { class: "w-56 flex flex-col gap-4" } },
          TeamSelector(),
          Leaderboard(ctx.store),
          Instructions(),
        ),
      ),

      // Footer
      UI.footer(
        { attrs: { class: "py-2 text-center text-xs opacity-50" } },
        "Open in multiple tabs - territory changes sync in real-time!",
      ),
    ),
}).serve({ port: 3006 })

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                    Grid Game v3                               ║
╠═══════════════════════════════════════════════════════════════╣
║  http://localhost:${server.port}                                    ║
║                                                               ║
║  Using hs.timer() for round countdown:                        ║
║  • interval: 1000 (1 second)                                  ║
║  • Handles round transitions automatically                    ║
╚═══════════════════════════════════════════════════════════════╝
`)

process.on("SIGINT", async () => {
  console.log("\nShutting down...")
  await server.stop()
  process.exit(0)
})
