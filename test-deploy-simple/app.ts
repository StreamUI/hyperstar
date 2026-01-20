/**
 * Simple HTTP server test - no dependencies
 * This tests if Services API deployment works at all
 */

const PORT = parseInt(process.env.PORT || "8080")

console.log(`🚀 Starting simple HTTP server on port ${PORT}`)

const server = Bun.serve({
  port: PORT,
  fetch(req) {
    const url = new URL(req.url)

    if (url.pathname === "/") {
      return new Response(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Sprite Service Test</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen p-8">
          <div class="max-w-2xl mx-auto">
            <h1 class="text-4xl font-bold text-indigo-900 mb-4">
              ✅ Service is Running!
            </h1>

            <div class="bg-white rounded-lg shadow-lg p-6 mb-6">
              <h2 class="text-xl font-semibold mb-4">Server Info</h2>
              <ul class="space-y-2 text-gray-700">
                <li><strong>Port:</strong> ${PORT}</li>
                <li><strong>Process:</strong> Bun ${Bun.version}</li>
                <li><strong>Timestamp:</strong> ${new Date().toISOString()}</li>
                <li><strong>Uptime:</strong> ${process.uptime().toFixed(2)}s</li>
              </ul>
            </div>

            <div class="bg-green-50 border-2 border-green-200 rounded-lg p-6">
              <p class="text-green-800">
                <strong>✅ Success!</strong> If you can see this page, the Services API deployment is working correctly.
              </p>
              <p class="text-green-700 mt-2 text-sm">
                The Sprite is running a Bun HTTP server on port ${PORT} using the Services API.
              </p>
            </div>

            <div class="mt-6 bg-white rounded-lg shadow-lg p-6">
              <h2 class="text-xl font-semibold mb-4">Next Steps</h2>
              <ol class="space-y-2 text-gray-700 list-decimal list-inside">
                <li>Close this tab to disconnect</li>
                <li>Wait 30+ seconds for hibernation</li>
                <li>Open the URL again to test wake-up</li>
                <li>Check that it wakes in 1-2 seconds</li>
              </ol>
            </div>
          </div>
        </body>
        </html>
      `, {
        headers: { "Content-Type": "text/html" }
      })
    }

    if (url.pathname === "/health") {
      return Response.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      })
    }

    return new Response("Not Found", { status: 404 })
  }
})

console.log(`✅ Server running at http://localhost:${PORT}`)

// Keep alive
process.on("SIGTERM", () => {
  console.log("📴 SIGTERM received, shutting down...")
  server.stop()
  process.exit(0)
})

process.on("SIGINT", () => {
  console.log("📴 SIGINT received, shutting down...")
  server.stop()
  process.exit(0)
})
