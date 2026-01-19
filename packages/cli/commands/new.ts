/**
 * `hyperstar new <project-name>` command
 *
 * Scaffolds a new Hyperstar project with the selected template.
 */
import { Args, Command, Options, Prompt } from "@effect/cli"
import { Console, Effect } from "effect"
import { scaffoldProject, type TemplateType } from "../lib/scaffold"

const projectNameArg = Args.text({ name: "project-name" }).pipe(
  Args.withDescription("Name of the project to create")
)

const templateOption = Options.choice("template", ["minimal", "with-persistence", "with-database"]).pipe(
  Options.withAlias("t"),
  Options.withDescription("Project template to use"),
  Options.optional
)

const templatePrompt = Prompt.select<TemplateType>({
  message: "Select a template:",
  choices: [
    { title: "minimal", value: "minimal", description: "Simple counter app" },
    { title: "with-persistence", value: "with-persistence", description: "JSON file persistence" },
    { title: "with-database", value: "with-database", description: "SQLite database" },
  ],
})

export const newCommand = Command.make(
  "new",
  { projectName: projectNameArg, template: templateOption },
  ({ projectName, template }) =>
    Effect.gen(function* () {
      // Prompt for template if not provided
      const selectedTemplate: TemplateType = template._tag === "Some"
        ? template.value as TemplateType
        : yield* Prompt.run(templatePrompt)

      yield* Console.log("")
      yield* Console.log(`Creating ${projectName} with template: ${selectedTemplate}`)
      yield* Console.log("")

      yield* scaffoldProject(projectName, selectedTemplate)

      yield* Console.log("")
      yield* Console.log("✓ Project created successfully!")
      yield* Console.log("")
      yield* Console.log("Next steps:")
      yield* Console.log(`  cd ${projectName}`)
      yield* Console.log("  bun run dev")
      yield* Console.log("")
    })
).pipe(Command.withDescription("Create a new Hyperstar project"))
