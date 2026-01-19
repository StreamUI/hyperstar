/**
 * Hyperstar Deploy Server
 *
 * Minimal Hono server for managed deployments.
 * No auth, no database - just bundles to sprites.
 */
import { Hono } from "hono"
import { cors } from "hono/cors"
import { SpritesClient } from "@fly/sprites"
import { extractTarGz } from "./lib/sprites"

// Validate environment
const SPRITE_TOKEN = process.env.SPRITE_TOKEN
if (!SPRITE_TOKEN) {
  console.error("SPRITE_TOKEN environment variable is required")
  process.exit(1)
}

const sprites = new SpritesClient(SPRITE_TOKEN)

const app = new Hono()

// Enable CORS for CLI uploads
app.use("*", cors())

/**
 * Root - server info
 */
app.get("/", (c) => {
  return c.json({
    name: "Hyperstar Deploy Server",
    version: "0.1.0",
    endpoints: {
      "POST /deploy": "Deploy a project bundle",
      "GET /health": "Health check",
    },
  })
})

/**
 * Health check endpoint
 */
app.get("/health", (c) => {
  return c.json({ ok: true, timestamp: new Date().toISOString() })
})

interface HyperstarConfig {
  name: string
  entrypoint?: string
}

/**
 * Deploy endpoint
 *
 * Accepts a tar.gz bundle and deploys to a Sprite.
 * Reads hyperstar.json from the bundle for config.
 */
app.post("/deploy", async (c) => {
  try {
    const form = await c.req.formData()
    const bundle = form.get("bundle") as File | null

    if (!bundle) {
      return c.json({ error: "Missing bundle file" }, 400)
    }

    console.log(`Bundle size: ${(bundle.size / 1024).toFixed(1)} KB`)

    // Extract files from bundle
    console.log("Extracting bundle...")
    const files = await extractTarGz(await bundle.arrayBuffer())
    console.log(`Extracted ${files.length} files`)

    // Find and parse hyperstar.json
    const configFile = files.find(f => f.path === "hyperstar.json")
    if (!configFile) {
      return c.json({ error: "Missing hyperstar.json in bundle" }, 400)
    }

    let config: HyperstarConfig
    try {
      config = JSON.parse(configFile.content.toString("utf-8"))
    } catch {
      return c.json({ error: "Invalid hyperstar.json - not valid JSON" }, 400)
    }

    if (!config.name) {
      return c.json({ error: "hyperstar.json missing required 'name' field" }, 400)
    }

    const name = config.name
    const entrypoint = config.entrypoint || "app.ts"

    console.log(`Deploying: ${name}`)
    console.log(`Entrypoint: ${entrypoint}`)

    // Create or get sprite
    try {
      await sprites.createSprite(name)
      console.log(`Created new sprite: ${name}`)
    } catch {
      console.log(`Sprite exists: ${name}`)
    }
    // Cast to any - SDK types are incomplete
    const sprite = sprites.sprite(name)

    // Stop existing processes
    console.log("Stopping existing processes...")
    try {
      await sprite.execFile("sh", ["-c", "pkill -f bun || true"])
    } catch {
      // Ignore - no processes running
    }

    // Create /app directory
    await sprite.execFile("mkdir", ["-p", "/app"])

    // Upload files using base64 encoding through shell
    console.log(`Uploading ${files.length} files...`)
    for (const file of files) {
      const base64 = file.content.toString("base64")
      const dir = file.path.includes("/") ? file.path.substring(0, file.path.lastIndexOf("/")) : ""

      if (dir) {
        await sprite.execFile("mkdir", ["-p", `/app/${dir}`])
      }

      // Write file using base64 decode via shell
      await sprite.execFile("sh", ["-c", `echo '${base64}' | base64 -d > /app/${file.path}`])
    }

    // Install dependencies
    console.log("Installing dependencies...")
    await sprite.execFile("bun", ["install"], { cwd: "/app" })

    // Start the app in a detached session (port 8080 is common for sprites)
    console.log("Starting app on port 8080...")
    const session = sprite.createSession("bun", ["run", entrypoint], {
      cwd: "/app",
      env: { PORT: "8080" },
    })

    // Wait a bit for the app to start
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Check if there are active sessions
    const sessions = await sprite.listSessions()
    console.log(`Active sessions: ${sessions.length}`)
    for (const s of sessions) {
      console.log(`  - ${s.id}: ${s.command} (active: ${s.isActive})`)
    }

    // Create checkpoint for fast restarts
    console.log("Creating checkpoint...")
    await sprite.createCheckpoint("Deployed via hyperstar server")

    // Make URL public via API
    console.log("Making URL public...")
    await fetch(`${sprites.baseURL}/v1/sprites/${name}`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${sprites.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url_settings: { auth: "public" } }),
    })

    // Get sprite info for the URL via API (SDK types don't include url)
    const infoRes = await fetch(`${sprites.baseURL}/v1/sprites/${name}`, {
      headers: { "Authorization": `Bearer ${sprites.token}` },
    })
    const info = await infoRes.json() as { url: string }
    const url = info.url

    console.log(`Deployed: ${url}`)

    return c.json({ url, name })
  } catch (error) {
    console.error("Deploy error:", error)
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500
    )
  }
})

/**
 * List all sprites (for debugging)
 */
app.get("/sprites", async (c) => {
  try {
    const list = await sprites.listSprites()
    return c.json({ sprites: list })
  } catch (error) {
    console.error("List sprites error:", error)
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500
    )
  }
})

const port = parseInt(process.env.PORT || "3000")
console.log(`Deploy server starting on port ${port}`)

export default {
  port,
  fetch: app.fetch,
}
