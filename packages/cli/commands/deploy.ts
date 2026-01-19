/**
 * `hyperstar deploy` command
 *
 * Two deployment paths:
 * 1. Self-deploy: Uses user's SPRITE_TOKEN to deploy directly
 * 2. Managed deploy: Uploads bundle to longtailLABS server (no auth required)
 */
import { Command, Options } from "@effect/cli"
import { Console, Effect } from "effect"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  bundleProject,
  collectFiles,
  loadConfig,
  detectEntrypoint,
  getProjectName,
} from "../lib/bundle"

const nameOption = Options.text("name").pipe(
  Options.withAlias("n"),
  Options.withDescription("Sprite name (defaults to directory name)"),
  Options.optional
)

const publicOption = Options.boolean("public").pipe(
  Options.withDescription("Make the deployed app publicly accessible"),
  Options.withDefault(true)
)

const managedOption = Options.boolean("managed").pipe(
  Options.withAlias("m"),
  Options.withDescription("Deploy via longtailLABS managed hosting (no auth required)"),
  Options.withDefault(false)
)

// Managed deploy server URL
const DEPLOY_URL = process.env.HYPERSTAR_DEPLOY_URL || "https://hyperstar-deploy.fly.dev"

export const deployCommand = Command.make(
  "deploy",
  { name: nameOption, isPublic: publicOption, managed: managedOption },
  ({ name, isPublic, managed }) =>
    Effect.gen(function* () {
      const cwd = process.cwd()
      const config = loadConfig(cwd)
      const entrypoint = detectEntrypoint(cwd)

      // Check hyperstar.json exists
      if (!existsSync(resolve(cwd, "hyperstar.json"))) {
        yield* Console.error("Error: hyperstar.json not found.")
        yield* Console.error("")
        yield* Console.error("Create one with:")
        yield* Console.error('  { "name": "my-app", "entrypoint": "app.ts" }')
        return yield* Effect.fail(new Error("Missing hyperstar.json"))
      }

      // Validate config has required fields
      if (!config.name) {
        yield* Console.error("Error: hyperstar.json missing 'name' field.")
        return yield* Effect.fail(new Error("Missing name in config"))
      }

      // Check entry file exists
      if (!existsSync(resolve(cwd, entrypoint))) {
        yield* Console.error(`Error: Entry file '${entrypoint}' not found.`)
        return yield* Effect.fail(new Error("Entry file not found"))
      }

      // CLI --name flag overrides config
      const spriteName = name._tag === "Some" ? name.value : config.name
      const makePublic = isPublic || config.public || true

      if (managed) {
        // Managed deploy path - server reads config from bundle
        yield* deployManaged(spriteName)
      } else {
        // Self-deploy path
        yield* deploySelf(spriteName, entrypoint, makePublic)
      }
    })
).pipe(Command.withDescription("Deploy to Fly.io Sprites"))

/**
 * Self-deploy using user's SPRITE_TOKEN
 */
function deploySelf(spriteName: string, entrypoint: string, makePublic: boolean) {
  return Effect.gen(function* () {
    const token = process.env.SPRITE_TOKEN
    if (!token) {
      yield* Console.error("Error: SPRITE_TOKEN environment variable is required.")
      yield* Console.error("")
      yield* Console.error("Get your token from: https://fly.io/sprites")
      yield* Console.error("Then run: export SPRITE_TOKEN=your_token")
      yield* Console.error("")
      yield* Console.error("Or use --managed for no-auth deployment:")
      yield* Console.error("  hyperstar deploy --managed")
      return yield* Effect.fail(new Error("Missing SPRITE_TOKEN"))
    }

    yield* Console.log(`Deploying to Sprites: ${spriteName}`)
    yield* Console.log(`Entry: ${entrypoint}`)
    yield* Console.log(`Public: ${makePublic}`)
    yield* Console.log("")

    // Collect files
    const files = collectFiles()
    yield* Console.log(`Found ${files.length} files to deploy`)

    // Deploy using Sprites API
    const url = yield* Effect.tryPromise({
      try: () => deployToSprites(token, spriteName, entrypoint, files, makePublic),
      catch: (error) => new Error(`Deploy failed: ${(error as Error).message}`),
    })

    yield* Console.log("")
    yield* Console.log("Deployed successfully!")
    yield* Console.log("")
    yield* Console.log(`URL: ${url}`)
    yield* Console.log("")
    yield* Console.log("Note: First request after hibernation may take 1-2 seconds to wake.")
  })
}

/**
 * Managed deploy via longtailLABS server
 * Server reads hyperstar.json from the bundle for name/entrypoint
 */
function deployManaged(displayName: string) {
  return Effect.gen(function* () {
    yield* Console.log(`Deploying: ${displayName}`)
    yield* Console.log("")
    yield* Console.log("Bundling project...")

    const bundle = yield* Effect.tryPromise({
      try: () => bundleProject(),
      catch: (error) => new Error(`Bundle failed: ${(error as Error).message}`),
    })

    yield* Console.log(`Bundle size: ${(bundle.length / 1024).toFixed(1)} KB`)
    yield* Console.log(`Uploading to: ${DEPLOY_URL}`)

    const result = yield* Effect.tryPromise({
      try: async () => {
        const form = new FormData()
        form.append("bundle", new Blob([new Uint8Array(bundle)]), "project.tar.gz")

        const res = await fetch(`${DEPLOY_URL}/deploy`, {
          method: "POST",
          body: form,
        })

        if (!res.ok) {
          const text = await res.text()
          throw new Error(`Server error: ${res.status} - ${text}`)
        }

        return res.json() as Promise<{ url: string; name: string }>
      },
      catch: (error) => new Error(`Upload failed: ${(error as Error).message}`),
    })

    yield* Console.log("")
    yield* Console.log("Deployed successfully!")
    yield* Console.log("")
    yield* Console.log(`URL: ${result.url}`)
    yield* Console.log("")
    yield* Console.log("Note: First request after hibernation may take 1-2 seconds to wake.")
  })
}

/**
 * Deploy to Sprites using user's token
 */
async function deployToSprites(
  token: string,
  spriteName: string,
  entrypoint: string,
  files: string[],
  _makePublic: boolean
): Promise<string> {
  const { SpritesClient } = await import("@fly/sprites")

  const client = new SpritesClient(token)

  // Check if sprite exists, create if not
  console.log(`Checking if sprite '${spriteName}' exists...`)
  let sprite
  try {
    sprite = await client.getSprite(spriteName)
    console.log("Sprite exists, updating...")
  } catch {
    console.log("Creating new sprite...")
    sprite = await client.createSprite(spriteName)
  }

  // Stop existing processes
  console.log("Stopping existing processes...")
  try {
    await sprite.execFile("sh", ["-c", "pkill -f bun || true"])
  } catch {
    // Ignore if no process running
  }

  // Create /app directory
  await sprite.execFile("mkdir", ["-p", "/app"])

  // Upload files using base64 encoding through shell
  console.log(`Uploading ${files.length} files...`)
  for (const file of files) {
    const content = readFileSync(resolve(process.cwd(), file))
    const base64 = content.toString("base64")
    const dir = file.includes("/") ? file.substring(0, file.lastIndexOf("/")) : ""

    if (dir) {
      await sprite.execFile("mkdir", ["-p", `/app/${dir}`])
    }

    // Write file using base64 decode via shell
    await sprite.execFile("sh", ["-c", `echo '${base64}' | base64 -d > /app/${file}`])
  }

  // Install dependencies
  console.log("Installing dependencies...")
  await sprite.execFile("bun", ["install"], { cwd: "/app" })

  // Start the app in a detached session
  console.log("Starting app...")
  sprite.createSession("bun", ["run", entrypoint], { cwd: "/app" })

  // Create checkpoint
  console.log("Creating checkpoint...")
  await sprite.createCheckpoint("Deployed via hyperstar CLI")

  // Make URL public via API
  console.log("Making URL public...")
  await fetch(`${client.baseURL}/v1/sprites/${spriteName}`, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${client.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url_settings: { auth: "public" } }),
  })

  // Get sprite info for the URL via API (SDK types don't include url)
  const infoRes = await fetch(`${client.baseURL}/v1/sprites/${spriteName}`, {
    headers: { "Authorization": `Bearer ${client.token}` },
  })
  const info = await infoRes.json() as { url: string }
  return info.url
}
