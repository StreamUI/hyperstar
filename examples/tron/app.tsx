/**
 * Hyperstar - MMO Tron
 * Open a tab → you're in the game. Die → auto respawn.
 */
import { createHyperstar, hs, Schema } from "hyperstar"

const WIDTH = 60
const HEIGHT = 40
const CELL = 12
const TICK_MS = 100

type Dir = "up" | "down" | "left" | "right"

interface Player {
  id: string
  x: number
  y: number
  dir: Dir
  nextDir: Dir
  color: string
  trail: number[]
  alive: boolean
}

interface Store {
  grid: string[]
  players: Record<string, Player>
}

const OPP: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" }
const COLORS = ["#0ff", "#0f0", "#f0f", "#ff0", "#f80", "#08f", "#f44", "#4f4", "#84f", "#fa0"]
let ci = 0

function spawn(grid: string[]): [number, number] {
  for (let i = 0; i < 50; i++) {
    const x = Math.floor(Math.random() * (WIDTH - 10)) + 5
    const y = Math.floor(Math.random() * (HEIGHT - 10)) + 5
    if (!grid[y * WIDTH + x]) return [x, y]
  }
  return [Math.floor(WIDTH / 2), Math.floor(HEIGHT / 2)]
}

function move(x: number, y: number, d: Dir): [number, number] {
  if (d === "up") return [x, y - 1]
  if (d === "down") return [x, y + 1]
  if (d === "left") return [x - 1, y]
  return [x + 1, y]
}

function makePlayer(id: string, grid: string[]): Player {
  const [x, y] = spawn(grid)
  return { id, x, y, dir: "right", nextDir: "right", color: COLORS[ci++ % COLORS.length], trail: [y * WIDTH + x], alive: true }
}

// --- App ---
const app = createHyperstar<Store>()

const turn = app.action("turn", { direction: Schema.String }, (ctx, { direction }) => {
  const d = direction as Dir
  if (!["up", "down", "left", "right"].includes(d)) return
  const p = ctx.getStore().players[ctx.sessionId]
  if (!p?.alive || OPP[d] === p.dir) return
  ctx.update(s => ({ ...s, players: { ...s.players, [ctx.sessionId]: { ...p, nextDir: d } } }))
})

app.repeat("tick", {
  every: TICK_MS,
  when: s => Object.values(s.players).some(p => p.alive),
  handler: (ctx) => {
    ctx.update(s => {
      const players: Record<string, Player> = {}
      for (const [id, p] of Object.entries(s.players)) players[id] = { ...p, trail: [...p.trail] }
      const grid = [...s.grid]
      const dead: string[] = []

      for (const p of Object.values(players)) {
        if (!p.alive) continue
        if (OPP[p.nextDir] !== p.dir) p.dir = p.nextDir
        const [nx, ny] = move(p.x, p.y, p.dir)
        if (nx < 0 || nx >= WIDTH || ny < 0 || ny >= HEIGHT || grid[ny * WIDTH + nx]) { dead.push(p.id); continue }
        p.x = nx; p.y = ny; p.trail.push(ny * WIDTH + nx); grid[ny * WIDTH + nx] = p.id
      }

      for (const id of dead) {
        players[id].alive = false
        for (const idx of players[id].trail) { if (grid[idx] === id) grid[idx] = "" }
        players[id].trail = []
      }

      // Auto-respawn dead players
      for (const p of Object.values(players)) {
        if (!p.alive) {
          const fresh = makePlayer(p.id, grid)
          fresh.color = p.color
          grid[fresh.y * WIDTH + fresh.x] = p.id
          players[p.id] = fresh
        }
      }

      return { ...s, players, grid }
    })
  }
})

app.app({
  store: { grid: new Array(WIDTH * HEIGHT).fill(""), players: {} },

  onConnect: (ctx) => {
    ctx.update(s => {
      const p = makePlayer(ctx.sessionId, s.grid)
      const grid = [...s.grid]
      grid[p.y * WIDTH + p.x] = p.id
      return { ...s, players: { ...s.players, [p.id]: p }, grid }
    })
  },

  onDisconnect: (ctx) => {
    ctx.update(s => {
      const p = s.players[ctx.sessionId]
      if (!p) return s
      const grid = [...s.grid]
      p.trail.forEach(idx => { if (grid[idx] === ctx.sessionId) grid[idx] = "" })
      const players = { ...s.players }
      delete players[ctx.sessionId]
      return { ...s, grid, players }
    })
  },

  view: (ctx) => {
    const alive = Object.values(ctx.store.players).filter(p => p.alive).length
    const cells: { x: number; y: number; color: string; head: boolean }[] = []
    for (const p of Object.values(ctx.store.players)) {
      for (const idx of p.trail) {
        cells.push({ x: idx % WIDTH, y: Math.floor(idx / WIDTH), color: p.color, head: idx === p.trail[p.trail.length - 1] })
      }
    }

    return (
      <div
        id="app"
        style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:#050510;color:#fff;font-family:monospace;"
        hs-on:keydown__window={`
          const m={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',s:'down',a:'left',d:'right'};
          if(m[$evt.key]){$evt.preventDefault();Hyperstar.dispatch('turn',{direction:m[$evt.key]})}
        `}
      >
        <h1 id="title" style="margin:0 0 10px;font-size:1.8rem;color:#0ff;text-shadow:0 0 10px #0ff;">NEON TRON</h1>
        <div id="info" style="margin-bottom:15px;color:#889;">{alive} player{alive !== 1 ? "s" : ""} alive</div>
        <div id="board" style={`position:relative;width:${WIDTH * CELL}px;height:${HEIGHT * CELL}px;border:2px solid #334;background:#000;`}>
          {cells.map(c => (
            <div
              id={`c${c.x}_${c.y}`}
              style={`position:absolute;left:${c.x * CELL}px;top:${c.y * CELL}px;width:${CELL}px;height:${CELL}px;background:${c.color};${c.head ? `box-shadow:0 0 8px ${c.color};z-index:1;` : "opacity:0.7;"}`}
            />
          ))}
        </div>
        <div id="controls" style="margin-top:15px;color:#556;font-size:0.85rem;">Arrow Keys / WASD</div>
      </div>
    )
  }
}).serve({ port: 8085 })
