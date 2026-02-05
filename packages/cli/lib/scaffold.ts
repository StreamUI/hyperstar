/**
 * Scaffold library for creating new Hyperstar projects
 */
import { Console, Effect } from "effect"
import { existsSync, mkdirSync, readdirSync, statSync, copyFileSync, writeFileSync, readFileSync } from "node:fs"
import { resolve, join, dirname, relative } from "node:path"
import { execSync } from "node:child_process"
import { fileURLToPath } from "node:url"

export type TemplateType = "minimal" | "with-persistence" | "with-database"

// Check if a package is published to npm
function isPackagePublished(packageName: string): boolean {
  try {
    execSync(`npm view ${packageName} version`, { stdio: "pipe" })
    return true
  } catch {
    return false
  }
}

// Get the latest version of a package from npm
function getLatestVersion(packageName: string): string | null {
  try {
    const version = execSync(`npm view ${packageName} version`, { stdio: "pipe" }).toString().trim()
    return version
  } catch {
    return null
  }
}

// Get the directory where this file is located
const __dirname = dirname(fileURLToPath(import.meta.url))
// CLI package root (go up from lib/)
const cliRoot = resolve(__dirname, "..")
// Monorepo root (for local dev)
const monorepoRoot = resolve(__dirname, "../../..")
// Hyperstar package for local dev linking
const hyperstarPackage = resolve(monorepoRoot, "packages/hyperstar")

export function scaffoldProject(projectName: string, template: TemplateType) {
  return Effect.gen(function* () {
    const targetDir = resolve(process.cwd(), projectName)

    // Check if directory already exists
    if (existsSync(targetDir)) {
      yield* Console.error(`Error: Directory '${projectName}' already exists.`)
      return yield* Effect.fail(new Error("Directory already exists"))
    }

    // Create project directory
    yield* Console.log(`Creating directory: ${projectName}`)
    mkdirSync(targetDir, { recursive: true })

    // Copy template files (check CLI package first, then monorepo root for local dev)
    let templateDir = resolve(cliRoot, "templates", template)
    if (!existsSync(templateDir)) {
      templateDir = resolve(monorepoRoot, "templates", template)
    }
    if (!existsSync(templateDir)) {
      yield* Console.error(`Error: Template '${template}' not found.`)
      return yield* Effect.fail(new Error("Template not found"))
    }

    yield* Console.log(`Copying template: ${template}`)
    copyDirectory(templateDir, targetDir)

    // Update package.json with project name and local hyperstar link
    const packageJsonPath = join(targetDir, "package.json")
    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"))
      packageJson.name = projectName

      // Check if running from local dev (unpublished) vs npm
      // If hyperstar isn't on npm, use file: reference to local package
      const isLocalDev = !isPackagePublished("hyperstar")
      if (isLocalDev && packageJson.dependencies?.hyperstar) {
        // Use absolute path to package root
        packageJson.dependencies.hyperstar = `file:${hyperstarPackage}`
        yield* Console.log(`Using local hyperstar: file:${hyperstarPackage}`)
      } else if (packageJson.dependencies?.hyperstar) {
        // Use the latest published version
        const latestVersion = getLatestVersion("hyperstar")
        if (latestVersion) {
          packageJson.dependencies.hyperstar = `^${latestVersion}`
          yield* Console.log(`Using hyperstar@^${latestVersion}`)
        }
      }

      writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2))
    }

    // Update hyperstar.json with project name
    const hyperstarJsonPath = join(targetDir, "hyperstar.json")
    if (existsSync(hyperstarJsonPath)) {
      const hyperstarJson = JSON.parse(readFileSync(hyperstarJsonPath, "utf-8"))
      hyperstarJson.name = projectName
      writeFileSync(hyperstarJsonPath, JSON.stringify(hyperstarJson, null, 2))
    }

    // Copy SKILL.md to .claude/skills/hyperstar/SKILL.md
    yield* Console.log("Adding Claude Code skill...")
    let skillSource = resolve(cliRoot, "skill/SKILL.md")
    if (!existsSync(skillSource)) {
      skillSource = resolve(monorepoRoot, ".claude/skills/hyperstar/SKILL.md")
    }
    const skillTarget = join(targetDir, ".claude/skills/hyperstar/SKILL.md")

    if (existsSync(skillSource)) {
      mkdirSync(dirname(skillTarget), { recursive: true })
      copyFileSync(skillSource, skillTarget)
    } else {
      yield* Console.log("(SKILL.md not found, skipping)")
    }

    // Initialize git repository
    yield* Console.log("Initializing git repository...")
    try {
      execSync("git init", { cwd: targetDir, stdio: "pipe" })
      execSync("git add .", { cwd: targetDir, stdio: "pipe" })
      execSync('git commit -m "Initial commit from hyperstar new"', { cwd: targetDir, stdio: "pipe" })
    } catch {
      yield* Console.log("(git init skipped)")
    }

    // Run bun install
    yield* Console.log("Installing dependencies...")
    try {
      execSync("bun install", { cwd: targetDir, stdio: "inherit" })
    } catch {
      yield* Console.error("Warning: bun install failed. Run it manually.")
    }
  })
}

function copyDirectory(src: string, dest: string) {
  mkdirSync(dest, { recursive: true })

  const entries = readdirSync(src)
  for (const entry of entries) {
    const srcPath = join(src, entry)
    const destPath = join(dest, entry)

    const stat = statSync(srcPath)
    if (stat.isDirectory()) {
      copyDirectory(srcPath, destPath)
    } else {
      copyFileSync(srcPath, destPath)
    }
  }
}
