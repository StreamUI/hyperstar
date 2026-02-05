/**
 * Hyperstar v3 - Signals Showcase (JSX Version)
 *
 * A comprehensive demonstration of client-side signals:
 * - Instant UI updates without server roundtrips
 * - Two-way binding with various input types
 * - Computed expressions combining signals
 * - Dynamic styling and classes
 * - Tabs, toggles, and complex UI state
 */
import { createHyperstar, hs, Schema } from "hyperstar"

// ============================================================================
// Types
// ============================================================================

interface Store {
  savedColors: string[]
  notes: string[]
}

interface Signals {
  // Text inputs
  name: string
  email: string
  message: string

  // Numbers
  quantity: number
  price: number
  rating: number

  // Booleans
  darkMode: boolean
  showAdvanced: boolean
  agreeToTerms: boolean

  // Selection
  activeTab: "basic" | "numbers" | "styling" | "validation"
  selectedColor: string

  // Validation
  touched: boolean
}

// ============================================================================
// Create Factory
// ============================================================================

const app = createHyperstar<Store, {}, Signals>()

// ============================================================================
// Signals
// ============================================================================

const {
  name,
  email,
  message,
  quantity,
  price,
  rating,
  darkMode,
  showAdvanced,
  agreeToTerms,
  activeTab,
  selectedColor,
  touched,
} = app.signals

// ============================================================================
// Actions (minimal - most state is client-side!)
// ============================================================================

const saveColor = app.action("saveColor", { color: Schema.String }, (ctx, { color }) => {
  if (!color) return
  ctx.update((s) => ({
    ...s,
    savedColors: [...s.savedColors.slice(-4), color],
  }))
})

const saveNote = app.action("saveNote", { message: Schema.String }, (ctx, { message }) => {
  if (!message.trim()) return
  ctx.update((s) => ({
    ...s,
    notes: [message.trim(), ...s.notes].slice(0, 5),
  }))
  ctx.patchSignals({ message: "" })
})

const clearAll = app.action("clearAll", (ctx) => {
  ctx.update((s) => ({ ...s, savedColors: [], notes: [] }))
})

// ============================================================================
// Tab Button Component
// ============================================================================

function TabButton({
  tab,
  label,
  icon,
}: {
  tab: "basic" | "numbers" | "styling" | "validation"
  label: string
  icon: string
}) {
  return (
    <button
      hs-on:click={activeTab.set(tab)}
      hs-class:bg-blue-500={activeTab.is(tab)}
      hs-class:text-white={activeTab.is(tab)}
      hs-class:bg-gray-100={activeTab.isNot(tab)}
      hs-class:text-gray-700={activeTab.isNot(tab)}
      class="px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2"
    >
      <span>{icon}</span>
      <span class="hidden sm:inline">{label}</span>
    </button>
  )
}

// ============================================================================
// App Config
// ============================================================================

const server = app.app({
  store: { savedColors: [], notes: [] },
  signals: {
    name: "",
    email: "",
    message: "",
    quantity: 1,
    price: 29.99,
    rating: 3,
    darkMode: false,
    showAdvanced: false,
    agreeToTerms: false,
    activeTab: "basic",
    selectedColor: "#3b82f6",
    touched: false,
  },

  title: "Signals Showcase",

  view: (ctx) => (
    <div
      id="app"
      $={hs.init("console.log('[hyperstar] Signals showcase ready')")}
      hs-class:bg-gray-900={darkMode.expr}
      hs-class:text-white={darkMode.expr}
      hs-class:bg-gray-50="!$darkMode.value"
      class="min-h-screen transition-colors duration-300"
    >
      <div class="max-w-3xl mx-auto p-6">
        {/* Header */}
        <div class="flex justify-between items-center mb-8">
          <div>
            <h1 class="text-3xl font-bold mb-1">Signals Showcase</h1>
            <p hs-class:text-gray-400={darkMode.expr} class="text-gray-500">
              Client-side reactivity without server roundtrips
            </p>
          </div>

          {/* Dark Mode Toggle */}
          <button
            hs-on:click={darkMode.toggle()}
            hs-class:bg-yellow-400={darkMode.expr}
            hs-class:bg-gray-800="!$darkMode.value"
            class="w-12 h-12 rounded-full flex items-center justify-center text-2xl transition-colors"
          >
            <span hs-show="!$darkMode.value">🌙</span>
            <span hs-show={darkMode.expr}>☀️</span>
          </button>
        </div>

        {/* Tab Navigation */}
        <div class="flex gap-2 mb-6 overflow-x-auto pb-2">
          <TabButton tab="basic" label="Basic Inputs" icon="📝" />
          <TabButton tab="numbers" label="Numbers" icon="🔢" />
          <TabButton tab="styling" label="Styling" icon="🎨" />
          <TabButton tab="validation" label="Validation" icon="✅" />
        </div>

        {/* Tab Content */}
        <div
          hs-class:bg-gray-800={darkMode.expr}
          hs-class:border-gray-700={darkMode.expr}
          class="bg-white border border-gray-200 rounded-xl p-6 mb-6"
        >
          {/* ========== BASIC INPUTS TAB ========== */}
          <div hs-show={activeTab.is("basic")}>
            <h2 class="text-xl font-semibold mb-4">Basic Input Binding</h2>

            {/* Name Input with Live Preview */}
            <div class="mb-6">
              <label class="block text-sm font-medium mb-2">Your Name</label>
              <input
                type="text"
                placeholder="Type your name..."
                $={hs.bind(name).ref("nameInput")}
                hs-class:border-gray-600={darkMode.expr}
                hs-class:bg-gray-700={darkMode.expr}
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <p class="mt-2 text-sm">
                Hello, <span hs-text={`$name.value || 'stranger'`} class="font-semibold text-blue-500" />!
              </p>
              <div
                class="mt-2 text-sm text-gray-500"
                $={hs.html("`<em>HTML preview:</em> ${$name.value || 'stranger'}`")}
              />
              <p hs-class:text-gray-400={darkMode.expr} class="text-xs text-gray-500 mt-1">
                Characters: <span hs-text="$name.value.length" class="font-mono" />
              </p>
              <div class="flex gap-2 mt-3">
                <button
                  $={hs.on("click", "$refs.nameInput.focus()")}
                  class="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
                >
                  Focus Input
                </button>
                <button
                  $={hs.on("click", hs.seq(name.set(""), message.set("")))}
                  class="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
                >
                  Clear Basics
                </button>
              </div>
            </div>

            {/* Message Textarea with Counter */}
            <div class="mb-6">
              <label class="block text-sm font-medium mb-2">Message (max 200 chars)</label>
              <textarea
                placeholder="Write something..."
                $={hs.bind(message)}
                hs-class:border-gray-600={darkMode.expr}
                hs-class:bg-gray-700={darkMode.expr}
                hs-class:border-red-500="$message.value.length > 200"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none h-24 resize-none"
              />
              <div class="flex justify-between mt-1 text-xs">
                <span
                  hs-show="$message.value.length > 200"
                  class="text-red-500"
                >
                  Too long!
                </span>
                <span hs-show="$message.value.length <= 200" />
                <span
                  hs-text="`${$message.value.length}/200`"
                  hs-class:text-red-500="$message.value.length > 200"
                  hs-class:text-gray-400={darkMode.expr}
                  class="text-gray-500"
                />
              </div>
            </div>

            {/* Save Note Button - signal handle auto-converts to $signal.value */}
            <div class="flex gap-2">
              <button
                $={hs.action(saveNote, { message })}
                hs-show="$message.value.trim().length > 0 && $message.value.length <= 200"
                class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
              >
                Save Note
              </button>
            </div>

            {/* Saved Notes */}
            {ctx.store.notes.length > 0 && (
              <div class="mt-6 pt-4 border-t border-gray-200">
                <h3 class="font-medium mb-2">Saved Notes ({ctx.store.notes.length})</h3>
                <ul class="space-y-2">
                  {ctx.store.notes.map((note, i) => (
                    <li
                      id={`note-${i}`}
                      hs-class:bg-gray-700={darkMode.expr}
                      class="px-3 py-2 bg-gray-100 rounded text-sm"
                    >
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* ========== NUMBERS TAB ========== */}
          <div hs-show={activeTab.is("numbers")}>
            <h2 class="text-xl font-semibold mb-4">Number Signals</h2>

            {/* Quantity Stepper */}
            <div class="mb-6">
              <label class="block text-sm font-medium mb-2">Quantity</label>
              <div class="flex items-center gap-3">
                <button
                  hs-on:click="$quantity.value = Math.max(1, $quantity.value - 1)"
                  class="w-10 h-10 bg-gray-200 hover:bg-gray-300 rounded-lg text-xl font-bold"
                >
                  -
                </button>
                <span
                  hs-text="$quantity.value"
                  class="text-3xl font-bold w-16 text-center tabular-nums"
                />
                <button
                  hs-on:click="$quantity.value++"
                  class="w-10 h-10 bg-gray-200 hover:bg-gray-300 rounded-lg text-xl font-bold"
                >
                  +
                </button>
              </div>
            </div>

            {/* Price Slider */}
            <div class="mb-6">
              <label class="block text-sm font-medium mb-2">
                Price: $<span hs-text="$price.value.toFixed(2)" class="font-mono" />
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="0.01"
                $={hs.bind(price)}
                class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div class="flex justify-between text-xs text-gray-500 mt-1">
                <span>$0</span>
                <span>$100</span>
              </div>
            </div>

            {/* Computed Total */}
            <div
              hs-class:bg-gray-700={darkMode.expr}
              class="p-4 bg-blue-50 rounded-lg mb-6"
            >
              <p class="text-lg">
                Total:{" "}
                <span
                  hs-text="`$${($quantity.value * $price.value).toFixed(2)}`"
                  class="text-2xl font-bold text-blue-600"
                />
              </p>
              <p hs-class:text-gray-400={darkMode.expr} class="text-sm text-gray-500">
                <span hs-text="$quantity.value" /> × $<span hs-text="$price.value.toFixed(2)" />
              </p>
            </div>

            {/* Star Rating */}
            <div class="mb-6">
              <label class="block text-sm font-medium mb-2">Rating</label>
              <div class="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    hs-on:click={`$rating.value = ${star}`}
                    class="text-3xl transition-transform hover:scale-110"
                  >
                    <span hs-show={`$rating.value >= ${star}`}>⭐</span>
                    <span hs-show={`$rating.value < ${star}`}>☆</span>
                  </button>
                ))}
              </div>
              <p class="text-sm mt-2">
                You rated: <span hs-text="$rating.value" class="font-bold" /> star
                <span hs-show="$rating.value !== 1">s</span>
              </p>
            </div>
          </div>

          {/* ========== STYLING TAB ========== */}
          <div hs-show={activeTab.is("styling")}>
            <h2 class="text-xl font-semibold mb-4">Dynamic Styling</h2>

            {/* Color Picker */}
            <div class="mb-6">
              <label class="block text-sm font-medium mb-2">Pick a Color</label>
              <div class="flex items-center gap-4">
                <input
                  type="color"
                  $={hs.bind(selectedColor).actionOn("change", saveColor, { color: selectedColor })}
                  class="w-16 h-16 rounded-lg cursor-pointer border-0"
                />
                <div>
                  <p
                    class="font-mono text-lg"
                    $={hs.text(selectedColor).style("color", selectedColor.expr)}
                  />
                  <button
                    $={hs.action(saveColor, { color: selectedColor })}
                    class="text-sm text-blue-500 hover:text-blue-600"
                  >
                    Save this color
                  </button>
                </div>
              </div>
            </div>

            {/* Dynamic Color Box */}
            <div class="mb-6">
              <label class="block text-sm font-medium mb-2">Preview Box</label>
              <div
                $={hs.style("background-color", selectedColor.expr)}
                class="w-full h-32 rounded-lg transition-colors flex items-center justify-center text-white font-bold text-xl shadow-lg"
              >
                <span hs-text="$selectedColor.value" />
              </div>
            </div>

            {/* Saved Colors */}
            {ctx.store.savedColors.length > 0 && (
              <div>
                <label class="block text-sm font-medium mb-2">Saved Colors</label>
                <div class="flex gap-2">
                  {ctx.store.savedColors.map((color, i) => (
                    <button
                      id={`color-${i}`}
                      $={hs.on("click", selectedColor.set(color))}
                      style={`background-color: ${color}`}
                      class="w-10 h-10 rounded-lg shadow hover:scale-110 transition-transform"
                      title={color}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Advanced Options Toggle */}
            <div class="mt-6 pt-4 border-t border-gray-200">
              <button
                hs-on:click={showAdvanced.toggle()}
                class="flex items-center gap-2 text-sm font-medium"
              >
                <span
                  hs-text={`$showAdvanced.value ? '▼' : '▶'`}
                  class="text-xs"
                />
                Advanced Options
              </button>
              <div
                hs-show={showAdvanced.expr}
                hs-class:bg-gray-700={darkMode.expr}
                class="mt-3 p-4 bg-gray-100 rounded-lg"
              >
                <p class="text-sm">These are the advanced options that were hidden!</p>
                <p class="text-sm mt-2">You can put any additional controls here.</p>
              </div>
            </div>
          </div>

          {/* ========== VALIDATION TAB ========== */}
          <div hs-show={activeTab.is("validation")}>
            <h2 class="text-xl font-semibold mb-4">Form Validation</h2>

            {/* Email Input with Validation */}
            <div class="mb-6">
              <label class="block text-sm font-medium mb-2">Email Address</label>
              <input
                type="email"
                placeholder="you@example.com"
                $={hs.bind(email).on("blur", touched.set(true))}
                hs-class:border-red-500="$touched.value && !$email.value.includes('@')"
                hs-class:border-green-500="$email.value.includes('@')"
                hs-class:border-gray-600={darkMode.expr}
                hs-class:bg-gray-700={darkMode.expr}
                class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none transition-colors"
              />
              <p
                hs-show="$touched.value && !$email.value.includes('@')"
                class="text-red-500 text-sm mt-1"
              >
                Please enter a valid email address
              </p>
              <p
                hs-show="$email.value.includes('@')"
                class="text-green-500 text-sm mt-1"
              >
                ✓ Looks good!
              </p>
            </div>

            {/* Terms Checkbox */}
            <div class="mb-6">
              <label class="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  hs-on:change="$agreeToTerms.value = $el.checked"
                  class="w-5 h-5 rounded border-gray-300"
                />
                <span>I agree to the terms and conditions</span>
              </label>
            </div>

            {/* Submit Button (disabled state) */}
            <button
              hs-attr:disabled="!($email.value.includes('@') && $agreeToTerms.value)"
              hs-class:opacity-50="!($email.value.includes('@') && $agreeToTerms.value)"
              hs-class:cursor-not-allowed="!($email.value.includes('@') && $agreeToTerms.value)"
              class="w-full py-3 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors"
            >
              Submit Form
            </button>
            <button
              $={hs.on("click", hs.seq(email.set(""), agreeToTerms.set(false), touched.set(false)))}
              class="mt-2 w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg"
            >
              Reset Validation
            </button>

            {/* Validation Status */}
            <div
              hs-class:bg-gray-700={darkMode.expr}
              class="mt-4 p-4 bg-gray-100 rounded-lg text-sm"
            >
              <p class="font-medium mb-2">Validation Status:</p>
              <ul class="space-y-1">
                <li class="flex items-center gap-2">
                  <span hs-show="$email.value.includes('@')">✅</span>
                  <span hs-show="!$email.value.includes('@')">❌</span>
                  Valid email
                </li>
                <li class="flex items-center gap-2">
                  <span hs-show="$agreeToTerms.value">✅</span>
                  <span hs-show="!$agreeToTerms.value">❌</span>
                  Agreed to terms
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div class="flex justify-between items-center text-sm">
          <p hs-class:text-gray-400={darkMode.expr} class="text-gray-500">
            All interactions above are instant - no server calls needed!
          </p>
          {(ctx.store.savedColors.length > 0 || ctx.store.notes.length > 0) && (
            <button
              $={hs.action(clearAll)}
              class="text-red-500 hover:text-red-600"
            >
              Clear Saved Data
            </button>
          )}
        </div>
      </div>
    </div>
  ),
}).serve({ port: 3019 })

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                  Signals Showcase (JSX)                       ║
╠═══════════════════════════════════════════════════════════════╣
║  http://localhost:${server.port}                                    ║
║                                                               ║
║  Features demonstrated:                                       ║
║  • Dark mode toggle (instant theme switch)                    ║
║  • Tab navigation (client-side routing)                       ║
║  • Live character counters                                    ║
║  • Quantity stepper & price slider                            ║
║  • Computed totals (quantity × price)                         ║
║  • Star rating picker                                         ║
║  • Color picker with dynamic preview                          ║
║  • Form validation with visual feedback                       ║
║  • Collapsible sections                                       ║
╚═══════════════════════════════════════════════════════════════╝
`)

process.on("SIGINT", async () => {
  console.log("\nShutting down...")
  await server.stop()
  process.exit(0)
})
