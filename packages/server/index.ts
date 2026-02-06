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

// Log SDK config for debugging
console.log(`SDK baseURL: ${(sprites as any).baseURL || (sprites as any).baseUrl || "unknown"}`)
console.log(`Token prefix: ${SPRITE_TOKEN.substring(0, 15)}...`)

/**
 * Execute a command via HTTP POST (more reliable than WebSocket for cold sprites)
 * Uses the non-TTY HTTP exec endpoint which handles sprite wake-up better
 * Includes retry logic for cold sprites that need time to wake up
 */
async function httpExec(
  spriteName: string,
  cmd: string[],
  options?: { cwd?: string; stdin?: string; retries?: number }
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const maxRetries = options?.retries ?? 3
  const params = new URLSearchParams()
  for (const c of cmd) {
    params.append("cmd", c)
  }
  if (options?.cwd) {
    params.append("dir", options.cwd)
  }
  if (options?.stdin) {
    params.append("stdin", "true")
  }

  const baseURL = "https://api.sprites.dev"
  const url = `${baseURL}/v1/sprites/${spriteName}/exec?${params.toString()}`

  let lastError: Error | null = null
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SPRITE_TOKEN}`,
          "Content-Type": "application/octet-stream",
        },
        body: options?.stdin || undefined,
      })

      if (!response.ok) {
        const text = await response.text()
        // Log token prefix for debugging (don't log full token)
        const tokenPrefix = SPRITE_TOKEN?.substring(0, 10) || "undefined"
        console.log(`Auth debug: token starts with "${tokenPrefix}...", URL: ${url}`)
        throw new Error(`Exec failed (${response.status}): ${text}`)
      }

      const text = await response.text()
      return { stdout: text, stderr: "", exitCode: 0 }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (attempt < maxRetries - 1) {
        // Wait before retrying (exponential backoff: 1s, 2s, 4s)
        const delay = Math.pow(2, attempt) * 1000
        console.log(`Exec attempt ${attempt + 1} failed, retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError || new Error("Exec failed after retries")
}

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
    // Stop existing processes
    console.log("Stopping existing processes...")
    try {
      await httpExec(name, ["sh", "-c", "pkill -f bun || true"])
    } catch {
      // Ignore - no processes running or sprite waking up
    }

    // Create /app directory
    await httpExec(name, ["mkdir", "-p", "/app"])

    // Upload files using base64 encoding through shell
    console.log(`Uploading ${files.length} files...`)
    for (const file of files) {
      const base64 = file.content.toString("base64")
      const dir = file.path.includes("/") ? file.path.substring(0, file.path.lastIndexOf("/")) : ""

      if (dir) {
        await httpExec(name, ["mkdir", "-p", `/app/${dir}`])
      }

      // Write file using base64 decode via shell - use stdin to avoid URL length limits
      await httpExec(name, ["sh", "-c", `base64 -d > /app/${file.path}`], { stdin: base64 })
    }

    // Install dependencies
    console.log("Installing dependencies...")
    await httpExec(name, ["bun", "install"], { cwd: "/app" })

    // Start the app in background using nohup
    console.log("Starting app on port 8080...")
    await httpExec(name, [
      "sh",
      "-c",
      `cd /app && PORT=8080 nohup bun run ${entrypoint} > /app/app.log 2>&1 &`,
    ])

    // Wait for app to start
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Verify it started by checking if the process is running
    const psResult = await httpExec(name, ["sh", "-c", "pgrep -f bun || echo 'no process'"])
    console.log(`Process check: ${psResult.stdout.trim()}`)

    // Create checkpoint for fast restarts
    console.log("Creating checkpoint...")
    const apiBase = "https://api.sprites.dev"
    try {
      await fetch(`${apiBase}/v1/sprites/${name}/checkpoints`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SPRITE_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ description: "Deployed via hyperstar server" }),
      })
    } catch (checkpointError) {
      console.log("Checkpoint creation skipped:", checkpointError)
    }

    // Make URL public via API
    console.log("Making URL public...")
    await fetch(`${apiBase}/v1/sprites/${name}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${SPRITE_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url_settings: { auth: "public" } }),
    })

    // Get sprite info for the URL via API (SDK types don't include url)
    const infoRes = await fetch(`${apiBase}/v1/sprites/${name}`, {
      headers: { Authorization: `Bearer ${SPRITE_TOKEN}` },
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
