/**
 * Hyperstar v3 - Grid Game Example (JSX Version)
 *
 * A multiplayer territory control game where teams compete to own grid cells.
 * Click cells to claim them for your team. Watch territory change in real-time!
 *
 * Features demonstrated:
 * - hs.action() with Schema validation
 * - Signals for client-side team selection
 * - hs.timer() for round countdown
 * - Dynamic grid rendering
 * - Real-time multiplayer sync
 */
import { createHyperstar, hs, Schema } from "hyperstar"

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

interface Signals {
  team: "red" | "blue"
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

// ============================================================================
// Create Factory
// ============================================================================

const app = createHyperstar<Store, {}, Signals>()

// ============================================================================
// Signals - Client-side state
// ============================================================================

const { team } = app.signals

// ============================================================================
// Actions
// ============================================================================

const claimCell = app.action(
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

app.timer("roundTimer", {
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
// Components
// ============================================================================

function GameCell({ cell, isPlaying }: { cell: Cell; isPlaying: boolean }) {
  const cellTeam = cell.ownerId ? TEAMS[cell.ownerId] : null
  const bgColor = cellTeam ? cellTeam.color : "#334155"
  const cursorClass = isPlaying ? "cursor-pointer hover:opacity-80" : "cursor-default"

  return (
    <div
      id={`cell-${cell.x}-${cell.y}`}
      $={hs.action(claimCell, { team, x: cell.x, y: cell.y })}
      class={`w-8 h-8 rounded-sm transition-colors duration-150 ${cursorClass}`}
      style={`background: ${bgColor};`}
    />
  )
}

function TeamSelector() {
  return (
    <div class="bg-slate-800 p-4 rounded-lg">
      <h3 class="text-base font-semibold mb-4">Select Your Team</h3>
      <div class="flex gap-2">
        <button
          hs-on:click="$team.value = 'red'"
          hs-class:ring-2={team.is("red")}
          hs-class:ring-white={team.is("red")}
          class="flex-1 py-3 text-white font-bold rounded cursor-pointer"
          style={`background: ${TEAMS.red.color};`}
        >
          Red
        </button>
        <button
          hs-on:click="$team.value = 'blue'"
          hs-class:ring-2={team.is("blue")}
          hs-class:ring-white={team.is("blue")}
          class="flex-1 py-3 text-white font-bold rounded cursor-pointer"
          style={`background: ${TEAMS.blue.color};`}
        >
          Blue
        </button>
      </div>
      <p class="mt-3 text-xs text-center opacity-60">Click cells to claim territory!</p>
    </div>
  )
}

function Leaderboard({ store }: { store: Store }) {
  const sortedTeams = (Object.keys(TEAMS) as TeamId[]).sort(
    (a, b) => store.teamStats[b].score - store.teamStats[a].score,
  )

  return (
    <div class="bg-slate-800 p-4 rounded-lg flex-1">
      <h3 class="text-base font-semibold mb-4">Leaderboard</h3>
      {sortedTeams.map((teamId, i) => {
        const teamInfo = TEAMS[teamId]
        const stats = store.teamStats[teamId]
        return (
          <div id={`team-${teamId}`} class="mb-4">
            <div class="flex items-center gap-2 mb-2">
              <span class="w-5 font-bold opacity-60">#{i + 1}</span>
              <div class="w-3 h-3 rounded-full" style={`background: ${teamInfo.color};`} />
              <span class="flex-1">{teamInfo.name}</span>
              <span class="font-bold" style={`color: ${teamInfo.color};`}>
                {stats.percentage}%
              </span>
            </div>
            <div class="h-2 bg-slate-700 rounded overflow-hidden">
              <div
                class="h-full transition-all duration-300"
                style={`width: ${stats.percentage}%; background: ${teamInfo.color};`}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Instructions() {
  return (
    <div class="bg-slate-800 p-4 rounded-lg text-sm opacity-80">
      <p class="mb-2 font-medium">How to play:</p>
      <ol class="pl-5 list-decimal space-y-1">
        <li>Select a team above</li>
        <li>Click cells to claim them</li>
        <li>Most territory wins!</li>
      </ol>
    </div>
  )
}

// ============================================================================
// App Config
// ============================================================================

const initialGrid = createEmptyGrid()

const server = app.app({
  store: {
    grid: initialGrid,
    teamStats: calculateTeamStats(initialGrid),
    roundTimeRemaining: ROUND_DURATION,
    roundState: "playing",
    winner: null,
  } as Store,
  signals: { team: "red" },

  title: ({ store }) =>
    `Grid Game - ${store.roundState === "playing" ? formatTime(store.roundTimeRemaining) : "Round Over"}`,

  view: (ctx) => (
    <div id="app" class="flex flex-col h-screen bg-slate-900 text-white">
      {/* Header */}
      <header class="p-4 flex justify-between items-center bg-slate-800">
        <h1 class="text-xl font-bold">Grid Game v3</h1>
        <div class="flex gap-4 items-center">
          {ctx.store.roundState === "playing" ? (
            <span class="text-2xl font-bold tabular-nums">{formatTime(ctx.store.roundTimeRemaining)}</span>
          ) : (
            <span class="text-base">
              {ctx.store.winner ? `${TEAMS[ctx.store.winner].name} Wins! ` : "It's a Draw! "}
              New round in {Math.abs(ctx.store.roundTimeRemaining)}s
            </span>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div class="flex-1 flex gap-4 p-4 overflow-hidden">
        {/* Game Grid */}
        <div class="flex-1 flex items-center justify-center">
          <div
            id="game-grid"
            class="bg-slate-950 p-1 rounded-lg"
            style={`display: grid; grid-template-columns: repeat(${GRID_WIDTH}, 32px); grid-template-rows: repeat(${GRID_HEIGHT}, 32px); gap: 2px;`}
          >
            {ctx.store.grid.map((cell) => (
              <GameCell cell={cell} isPlaying={ctx.store.roundState === "playing"} />
            ))}
          </div>
        </div>

        {/* Side Panel */}
        <div class="w-56 flex flex-col gap-4">
          <TeamSelector />
          <Leaderboard store={ctx.store} />
          <Instructions />
        </div>
      </div>

      {/* Footer */}
      <footer class="py-2 text-center text-xs opacity-50">
        Open in multiple tabs - territory changes sync in real-time!
      </footer>
    </div>
  ),
}).serve({ port: 3006 })

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                    Grid Game v3 (JSX)                         ║
╠═══════════════════════════════════════════════════════════════╣
║  http://localhost:${server.port}                                    ║
║                                                               ║
║  Using hs.timer() for round countdown:                        ║
║  • interval: 1000 (1 second)                                  ║
║  • Handles round transitions automatically                    ║
║                                                               ║
║  Signals for team selection:                                  ║
║  • hs-on:click="$team.value = 'red'"                          ║
║  • hs-class:ring-2={team.is("red")} for active indicator      ║
╚═══════════════════════════════════════════════════════════════╝
`)

process.on("SIGINT", async () => {
  console.log("\nShutting down...")
  await server.stop()
  process.exit(0)
})
