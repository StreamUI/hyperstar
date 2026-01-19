#!/usr/bin/env bun
/**
 * Hyperstar CLI
 *
 * Usage:
 *   bunx hyperstar create my-app              # Create new project (interactive)
 *   bunx hyperstar create my-app -t minimal   # With specific template
 *   bunx hyperstar deploy                     # Deploy with SPRITE_TOKEN
 *   bunx hyperstar deploy --managed           # Deploy to managed hosting
 */
import { Args, Command, Options, Prompt } from "@effect/cli"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Console, Effect } from "effect"
import { scaffoldProject, type TemplateType } from "./lib/scaffold"
import { deployCommand } from "./commands/deploy"

// ============================================================================
// Create Command
// ============================================================================

const projectNameArg = Args.text({ name: "project-name" }).pipe(
  Args.withDescription("Name of the project to create"),
  Args.optional
)

const templateOption = Options.choice("template", ["minimal", "with-persistence", "with-database"]).pipe(
  Options.withAlias("t"),
  Options.withDescription("Project template to use"),
  Options.optional
)

const templatePrompt = Prompt.select<TemplateType>({
  message: "Select a template:",
  choices: [
    { title: "minimal", value: "minimal", description: "Simple counter app - great starting point" },
    { title: "with-persistence", value: "with-persistence", description: "JSON file persistence for data" },
    { title: "with-database", value: "with-database", description: "SQLite database with search" },
  ],
})

const projectNamePrompt = Prompt.text({
  message: "Project name:",
  validate: (value) => value.length > 0 ? Effect.succeed(value) : Effect.fail("Project name is required"),
})

const createCommand = Command.make(
  "create",
  { projectName: projectNameArg, template: templateOption },
  ({ projectName, template }) =>
    Effect.gen(function* () {
      // Prompt for project name if not provided
      const name = projectName._tag === "Some"
        ? projectName.value
        : yield* Prompt.run(projectNamePrompt)

      yield* Console.log("")
      yield* Console.log("🌟 Create Hyperstar App")
      yield* Console.log("")

      // Prompt for template if not provided
      const selectedTemplate: TemplateType = template._tag === "Some"
        ? template.value as TemplateType
        : yield* Prompt.run(templatePrompt)

      yield* Console.log("")
      yield* Console.log(`Creating ${name} with template: ${selectedTemplate}`)
      yield* Console.log("")

      yield* scaffoldProject(name, selectedTemplate)

      yield* Console.log("")
      yield* Console.log("✓ Project created successfully!")
      yield* Console.log("")
      yield* Console.log("Next steps:")
      yield* Console.log(`  cd ${name}`)
      yield* Console.log("  bun install")
      yield* Console.log("  bun run dev")
      yield* Console.log("")
    })
).pipe(Command.withDescription("Create a new Hyperstar project"))

// ============================================================================
// Root Command
// ============================================================================

const rootCommand = Command.make("hyperstar").pipe(
  Command.withDescription("Hyperstar CLI - server-driven UI for real-time web apps"),
  Command.withSubcommands([createCommand, deployCommand])
)

// ============================================================================
// Run CLI
// ============================================================================

const cli = Command.run(rootCommand, {
  name: "hyperstar",
  version: "v0.1.0",
})

cli(process.argv).pipe(
  Effect.provide(BunContext.layer),
  BunRuntime.runMain
)
