/**
 * Bundle library for packaging Hyperstar projects for deployment
 *
 * Collects project files and creates a tar.gz bundle for upload.
 */
import { createGzip } from "node:zlib"
import { readdirSync, statSync, readFileSync, existsSync } from "node:fs"
import { join, relative, resolve } from "node:path"
import { pack } from "tar-stream"

interface BundleOptions {
  cwd?: string
  entrypoint?: string
}

interface HyperstarConfig {
  name?: string
  entrypoint?: string
  port?: number
  public?: boolean
}

// Directories to exclude
const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  ".cache",
  ".bun",
])

// Files to exclude
const IGNORE_FILES = new Set([
  ".DS_Store",
  ".env",
  ".env.local",
  ".env.production",
  ".env.development",
  "bun.lockb",
])

// Extensions to exclude
const IGNORE_EXTENSIONS = new Set([
  ".db-shm",
  ".db-wal",
])

/**
 * Load hyperstar.json config if it exists
 */
export function loadConfig(cwd: string = process.cwd()): HyperstarConfig {
  const configPath = resolve(cwd, "hyperstar.json")
  if (existsSync(configPath)) {
    try {
      return JSON.parse(readFileSync(configPath, "utf-8"))
    } catch {
      return {}
    }
  }
  return {}
}

/**
 * Detect the entrypoint file
 */
export function detectEntrypoint(cwd: string = process.cwd()): string {
  const config = loadConfig(cwd)
  if (config.entrypoint) {
    return config.entrypoint
  }

  // Try common entrypoints (prefer .ts over .tsx)
  const candidates = ["app.ts", "app.tsx", "index.ts", "index.tsx"]
  for (const candidate of candidates) {
    if (existsSync(resolve(cwd, candidate))) {
      return candidate
    }
  }

  return "app.ts" // default
}

/**
 * Collect all project files, excluding ignored directories and files
 */
export function collectFiles(cwd: string = process.cwd()): string[] {
  const files: string[] = []

  function walk(dir: string) {
    const entries = readdirSync(dir)
    for (const entry of entries) {
      // Skip ignored directories
      if (IGNORE_DIRS.has(entry)) continue
      // Skip ignored files
      if (IGNORE_FILES.has(entry)) continue

      const fullPath = join(dir, entry)
      const relativePath = relative(cwd, fullPath)

      // Skip hidden files (except .gitignore, etc.)
      if (entry.startsWith(".") && entry !== ".gitignore") continue

      const stat = statSync(fullPath)

      if (stat.isDirectory()) {
        walk(fullPath)
      } else {
        // Check extension
        const hasIgnoredExt = Array.from(IGNORE_EXTENSIONS).some(ext =>
          entry.endsWith(ext)
        )
        if (!hasIgnoredExt) {
          files.push(relativePath)
        }
      }
    }
  }

  walk(cwd)
  return files
}

/**
 * Create a tar.gz bundle of the project
 */
export async function bundleProject(options: BundleOptions = {}): Promise<Buffer> {
  const cwd = options.cwd || process.cwd()
  const files = collectFiles(cwd)

  return new Promise((resolve, reject) => {
    const tarPack = pack()
    const chunks: Buffer[] = []

    const gzip = createGzip()

    tarPack.pipe(gzip)

    gzip.on("data", (chunk: Buffer) => chunks.push(chunk))
    gzip.on("end", () => resolve(Buffer.concat(chunks)))
    gzip.on("error", reject)

    // Add each file to the tarball
    for (const file of files) {
      const fullPath = join(cwd, file)
      const content = readFileSync(fullPath)
      const stat = statSync(fullPath)

      tarPack.entry(
        {
          name: file,
          size: content.length,
          mode: stat.mode,
          mtime: stat.mtime,
        },
        content
      )
    }

    tarPack.finalize()
  })
}

/**
 * Get project name from config or directory name
 */
export function getProjectName(cwd: string = process.cwd()): string {
  const config = loadConfig(cwd)
  if (config.name) {
    return config.name
  }
  return cwd.split("/").pop() || "hyperstar-app"
}
