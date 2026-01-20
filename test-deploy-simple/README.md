# Simple Service Test

This is a minimal test to verify the Services API deployment works correctly.

**No dependencies required** - just plain Bun HTTP server.

## Deploy

```bash
./deploy.sh
```

Or with custom deployment server:

```bash
./deploy.sh http://localhost:3000
```

## What This Tests

1. ✅ Service definition creation
2. ✅ Service starts with correct port (8080)
3. ✅ HTTP server responds
4. ✅ Working directory is correct (`/app`)
5. ✅ Environment variables work (`PORT=8080`)

## Expected Result

After deployment, opening the URL should show a green success page saying "Service is Running!"

If you see this, the Services API deployment is working correctly.

## Debugging

If you get "Bad Gateway":

```bash
sprite console simple-test
tail -f /.sprite/logs/services/hyperstar-app.log
```

Look for startup errors or port binding issues.

## Manual Test

```bash
sprite console simple-test
cd /app
PORT=8080 bun run app.ts
```

Should show:
```
🚀 Starting simple HTTP server on port 8080
✅ Server running at http://localhost:8080
```
