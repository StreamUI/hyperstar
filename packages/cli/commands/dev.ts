/**
 * `hyperstar dev` command
 *
 * Runs the dev server with hot reload using bun --hot.
 */
import { Command, Options } from "@effect/cli"
import { Console, Effect } from "effect"
import { existsSync } from "node:fs"
import { spawn } from "node:child_process"
import { resolve } from "node:path"

const portOption = Options.integer("port").pipe(
  Options.withAlias("p"),
  Options.withDescription("Port to run the server on"),
  Options.withDefault(3000)
)

const entryOption = Options.text("entry").pipe(
  Options.withAlias("e"),
  Options.withDescription("Entry file to run"),
  Options.withDefault("app.ts")
)

export const devCommand = Command.make(
  "dev",
  { port: portOption, entry: entryOption },
  ({ port, entry }) =>
    Effect.gen(function* () {
      const cwd = process.cwd()
      let entryFile = entry

      // Check if entry file exists
      if (!existsSync(resolve(cwd, entryFile))) {
        // Try common alternatives
        const alternatives = ["app.ts", "app.tsx", "src/app.ts", "index.ts", "src/index.ts"]
        const found = alternatives.find((alt) => existsSync(resolve(cwd, alt)))

        if (found) {
          yield* Console.log(`Entry file '${entry}' not found, using '${found}'`)
          entryFile = found
        } else {
          yield* Console.error(`Error: Entry file '${entry}' not found.`)
          yield* Console.error("Make sure you're in a Hyperstar project directory.")
          return yield* Effect.fail(new Error("Entry file not found"))
        }
      }

      yield* Console.log(`Starting dev server on port ${port}...`)
      yield* Console.log(`Entry: ${entryFile}`)
      yield* Console.log("")

      yield* Effect.async<void, Error>((resume) => {
        const child = spawn("bun", ["--hot", "run", entryFile], {
          stdio: "inherit",
          cwd: process.cwd(),
          env: { ...process.env, PORT: String(port) },
        })

        child.on("error", (err) => {
          resume(Effect.fail(err))
        })

        child.on("exit", (code) => {
          if (code === 0) {
            resume(Effect.void)
          } else {
            resume(Effect.fail(new Error(`Process exited with code ${code}`)))
          }
        })

        // Handle SIGINT to properly close child process
        process.on("SIGINT", () => {
          child.kill("SIGINT")
          process.exit(0)
        })
      })
    })
).pipe(Command.withDescription("Run dev server with hot reload"))
