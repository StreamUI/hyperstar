import { createHyperstar, UI, on } from "hyperstar"

interface Store { count: number }

const hs = createHyperstar<Store>()

const inc = hs.action("inc", (ctx) => {
  ctx.update((s) => ({ ...s, count: s.count + 1 }))
})

hs.app({
  store: { count: 0 },
  view: (ctx) =>
    UI.div(
      { attrs: { id: "app" } },
      UI.h1({}, `!!!Count: ${ctx.store.count}`),
      UI.button(
        { events: { click: on.action(inc) } },
        "+1"
      )
    ),
}).serve({ port: 3000 })