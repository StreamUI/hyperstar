/**
 * Hyperstar v3 - Live Polling Example
 *
 * A real-time poll where users can vote and see results update live.
 * Uses session IDs to prevent double voting.
 *
 * Demonstrates:
 * - hs.action() with Schema validation
 * - Signal bindings for forms
 * - Session-based voting (one vote per session)
 * - Real-time sync across tabs
 */
import { createHyperstar, UI, on, $, Schema } from "hyperstar"

// ============================================================================
// Types
// ============================================================================

interface PollOption {
  id: string
  text: string
  votes: number
  color: string
}

interface Store {
  question: string
  options: PollOption[]
  totalVotes: number
  voters: Record<string, true> // JSON-serializable (Set doesn't serialize)
}

// ============================================================================
// Constants
// ============================================================================

const COLORS = ["#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6", "#1abc9c"]

interface Signals {
  newQuestion: string
  newOption: string
}

// ============================================================================
// Create Factory
// ============================================================================

const hs = createHyperstar<Store, {}, Signals>()

// ============================================================================
// Signals - Client-side form state
// ============================================================================

const { newQuestion, newOption } = hs.signals

// ============================================================================
// Actions
// ============================================================================

// Vote action - checks if user already voted using session ID
const vote = hs.action("vote", { optionId: Schema.String }, (ctx, { optionId }) => {
  const store = ctx.getStore()
  if (ctx.sessionId in store.voters) {
    return // Already voted!
  }

  ctx.update((s) => ({
    ...s,
    options: s.options.map((o) => (o.id === optionId ? { ...o, votes: o.votes + 1 } : o)),
    totalVotes: s.totalVotes + 1,
    voters: { ...s.voters, [ctx.sessionId]: true as const },
  }))
})

// Reset all votes
const resetPoll = hs.action("resetPoll", (ctx) => {
  ctx.update((s) => ({
    ...s,
    options: s.options.map((o) => ({ ...o, votes: 0 })),
    totalVotes: 0,
    voters: {},
  }))
})

// Set new question
const setQuestion = hs.action("setQuestion", { question: Schema.String }, (ctx, { question }) => {
  ctx.update((s) => ({
    ...s,
    question,
    options: s.options.map((o) => ({ ...o, votes: 0 })),
    totalVotes: 0,
    voters: {},
  }))
  ctx.patchSignals({ newQuestion: "" }) // Clear input after update
})

// Add new option
const addOption = hs.action("addOption", { text: Schema.String }, (ctx, { text }) => {
  const store = ctx.getStore()
  if (store.options.length >= 6) return

  ctx.update((s) => ({
    ...s,
    options: [
      ...s.options,
      {
        id: crypto.randomUUID().slice(0, 8),
        text,
        votes: 0,
        color: COLORS[s.options.length % COLORS.length]!,
      },
    ],
  }))
  ctx.patchSignals({ newOption: "" }) // Clear input after adding
})

// Remove option
const removeOption = hs.action("removeOption", { optionId: Schema.String }, (ctx, { optionId }) => {
  const store = ctx.getStore()
  if (store.options.length <= 2) return

  const option = store.options.find((o) => o.id === optionId)
  if (option) {
    ctx.update((s) => ({
      ...s,
      options: s.options.filter((o) => o.id !== optionId),
      totalVotes: s.totalVotes - option.votes,
    }))
  }
})

// ============================================================================
// Reusable Components
// ============================================================================

function PollOptionRow(props: {
  option: PollOption
  percentage: number
  hasVoted: boolean
}) {
  const { option, percentage, hasVoted } = props

  return UI.div(
    {
      attrs: {
        id: `option-${option.id}`,
        class: "relative overflow-hidden rounded-lg border-2 border-gray-200",
      },
    },
    // Progress bar background
    UI.div({
      attrs: {
        class: "absolute top-0 left-0 h-full transition-all duration-300",
        style: `width: ${percentage}%; background: ${option.color}20;`,
      },
    }),
    // Content
    UI.div(
      { attrs: { class: "relative flex items-center p-4 gap-4" } },
      hasVoted
        ? UI.div({
            attrs: {
              class: "w-6 h-6 rounded-full bg-transparent shrink-0 opacity-50 cursor-not-allowed",
              style: `border: 2px solid ${option.color};`,
            },
          })
        : UI.button({
            attrs: {
              class: "w-6 h-6 rounded-full bg-transparent shrink-0 cursor-pointer hover:opacity-70",
              style: `border: 2px solid ${option.color};`,
            },
            events: { click: on.action(vote, { optionId: option.id }) },
          }),
      UI.span({ attrs: { class: "flex-1 font-medium text-gray-800" } }, option.text),
      UI.div(
        { attrs: { class: "text-right min-w-16" } },
        UI.div({ attrs: { class: "font-bold", style: `color: ${option.color};` } }, `${percentage}%`),
        UI.div(
          { attrs: { class: "text-xs text-gray-400" } },
          `${option.votes} vote${option.votes !== 1 ? "s" : ""}`,
        ),
      ),
    ),
  )
}

// ============================================================================
// App Config
// ============================================================================

const server = hs.app({
  store: {
    question: "What's your favorite programming language?",
    options: [
      { id: "ts", text: "TypeScript", votes: 0, color: COLORS[0]! },
      { id: "py", text: "Python", votes: 0, color: COLORS[1]! },
      { id: "rs", text: "Rust", votes: 0, color: COLORS[2]! },
      { id: "go", text: "Go", votes: 0, color: COLORS[3]! },
      { id: "other", text: "Other", votes: 0, color: COLORS[4]! },
    ],
    totalVotes: 0,
    voters: {},
  } as Store,
  signals: { newQuestion: "", newOption: "" },

  title: ({ store }) => `Poll: ${store.question} (${store.totalVotes} votes)`,

  view: (ctx) => {
    const hasVoted = ctx.session.id in ctx.store.voters

    return UI.div(
      { attrs: { id: "app", class: "max-w-xl mx-auto p-8" } },

      UI.h1({ attrs: { class: "text-3xl font-bold text-center text-gray-900 mb-8" } }, "Live Poll"),

      // Poll Question
      UI.div(
        { attrs: { class: "bg-gray-100 p-6 rounded-lg mb-6" } },
        UI.h2({ attrs: { class: "text-xl font-semibold text-gray-800 mb-2" } }, ctx.store.question),
        UI.p(
          { attrs: { class: "text-gray-500 text-sm" } },
          `${ctx.store.totalVotes} vote${ctx.store.totalVotes !== 1 ? "s" : ""} total`,
          hasVoted && UI.span({ attrs: { class: "ml-2 text-green-600" } }, "(You voted!)"),
        ),
      ),

      // Poll Options
      UI.div(
        { attrs: { class: "flex flex-col gap-4 mb-8" } },
        ...ctx.store.options.map((option) => {
          const percentage =
            ctx.store.totalVotes > 0
              ? Math.round((option.votes / ctx.store.totalVotes) * 100)
              : 0

          return PollOptionRow({ option, percentage, hasVoted })
        }),
      ),

      // Admin Controls
      UI.el(
        "details",
        { attrs: { class: "bg-gray-100 p-4 rounded-lg" } },
        UI.el(
          "summary",
          { attrs: { class: "cursor-pointer font-semibold text-gray-700" } },
          "Admin Controls",
        ),

        UI.div(
          { attrs: { class: "flex flex-col gap-4 mt-4" } },

          // Change Question
          UI.div(
            { attrs: { class: "flex gap-2" } },
            UI.input({
              attrs: {
                type: "text",
                placeholder: "New poll question...",
                class:
                  "flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                "hs-bind": "newQuestion",
              },
            }),
            UI.button(
              {
                attrs: {
                  class:
                    "px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors",
                  "hs-show": newQuestion.isNotEmpty().toString(),
                },
                events: {
                  click: on.action(setQuestion, { question: $.signal("newQuestion") }),
                },
              },
              "Update",
            ),
          ),

          // Add Option
          UI.div(
            { attrs: { class: "flex gap-2" } },
            UI.input({
              attrs: {
                type: "text",
                placeholder: "New option...",
                class:
                  "flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent",
                "hs-bind": "newOption",
              },
            }),
            ctx.store.options.length < 6
              ? UI.button(
                  {
                    attrs: {
                      class:
                        "px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors",
                      "hs-show": newOption.isNotEmpty().toString(),
                    },
                    events: {
                      click: on.action(addOption, { text: $.signal("newOption") }),
                    },
                  },
                  "Add",
                )
              : UI.button(
                  {
                    attrs: {
                      class:
                        "px-4 py-2 bg-green-300 text-white font-medium rounded-lg cursor-not-allowed",
                      disabled: "disabled",
                    },
                  },
                  "Add",
                ),
          ),

          // Reset
          UI.button(
            {
              attrs: {
                class:
                  "px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors",
              },
              events: { click: on.action(resetPoll) },
            },
            "Reset All Votes",
          ),
        ),
      ),

      // Footer
      UI.footer(
        { attrs: { class: "mt-8 text-center text-gray-400 text-sm" } },
        UI.p({}, "Open in multiple tabs - votes sync in real-time!"),
      ),
    )
  },
}).serve({ port: 3011 })

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                      Live Poll                                ║
╠═══════════════════════════════════════════════════════════════╣
║  http://localhost:${server.port}                                    ║
║                                                               ║
║  Session-based voting:                                        ║
║  • Each session can vote once                                 ║
║  • Votes sync across all connected tabs                       ║
╚═══════════════════════════════════════════════════════════════╝
`)

process.on("SIGINT", async () => {
  console.log("\nShutting down...")
  await server.stop()
  process.exit(0)
})
