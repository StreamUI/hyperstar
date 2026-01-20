# Debugging Bad Gateway on Sprites

## Quick Checks

### 1. Check if service is running

```bash
sprite console my-app
```

Then inside the sprite:

```bash
# Check if service process is running
ps aux | grep bun

# Check what's listening on port 8080
netstat -tlnp | grep 8080

# Or with lsof
lsof -i :8080
```

### 2. Check service logs

```bash
# Inside sprite console
tail -100 /.sprite/logs/services/hyperstar-app.log

# Watch live
tail -f /.sprite/logs/services/hyperstar-app.log
```

### 3. Check if files were uploaded

```bash
# Inside sprite console
ls -la /app/
cat /app/package.json
cat /app/hyperstar.json
```

### 4. Try running the app manually

```bash
# Inside sprite console
cd /app
PORT=8080 bun run app.ts
```

This will show you any errors directly.

### 5. Check for dependency issues

```bash
# Inside sprite console
cd /app
bun install
```

## Common Issues

### Issue 1: Dependencies not installed

**Symptom**: Error about missing "hyperstar" module

**Fix**: The workspace dependency might not work on Sprites. Update `package.json`:

```json
{
  "dependencies": {
    "hyperstar": "latest"
  }
}
```

### Issue 2: Wrong port

**Symptom**: App starts but Bad Gateway

**Fix**: Ensure app listens on PORT from environment

### Issue 3: Service not starting

**Symptom**: No process running

**Check service with API**:
```bash
curl -H "Authorization: Bearer $SPRITE_TOKEN" \
  https://api.sprites.dev/v1/sprites/my-app/services/hyperstar-app
```

### Issue 4: Workspace dependency

The `"hyperstar": "workspace:*"` won't work on Sprites because it's not a monorepo.

**Fix in test-deploy/package.json**:
```json
{
  "dependencies": {
    "hyperstar": "^0.2.0"
  }
}
```

## Manual Testing

### Test with a simple HTTP server first

Create `test-simple.ts`:
```typescript
Bun.serve({
  port: 8080,
  fetch(req) {
    return new Response("Hello from Sprite!")
  }
})

console.log("Server running on port 8080")
```

Create `hyperstar.json`:
```json
{
  "name": "test-simple",
  "entrypoint": "test-simple.ts"
}
```

Create minimal `package.json`:
```json
{
  "name": "test-simple",
  "type": "module"
}
```

Deploy this first to verify the Services API deployment works.

## Service API Direct Test

### Create service manually

```bash
curl -X PUT \
  -H "Authorization: Bearer $SPRITE_TOKEN" \
  -H "Content-Type: application/json" \
  https://api.sprites.dev/v1/sprites/my-app/services/test-server \
  -d '{
    "cmd": "bun",
    "args": ["run", "app.ts"],
    "dir": "/app",
    "env": {"PORT": "8080"},
    "http_port": 8080
  }'
```

### Start service manually

```bash
curl -X POST \
  -H "Authorization: Bearer $SPRITE_TOKEN" \
  "https://api.sprites.dev/v1/sprites/my-app/services/test-server/start?duration=10s"
```

### Stop service manually

```bash
curl -X POST \
  -H "Authorization: Bearer $SPRITE_TOKEN" \
  "https://api.sprites.dev/v1/sprites/my-app/services/test-server/stop?timeout=5s"
```

## Getting Detailed Error Info

### Check sprite system logs

```bash
sprite ssh my-app
dmesg | tail -50
journalctl -xe
```

### Check if hyperstar package is available

```bash
# Inside sprite console
cd /app
bun add hyperstar
bun run app.ts
```

## Next Steps

1. **First**: Check service logs (step 2 above)
2. **If no logs**: Service didn't start - check service definition
3. **If errors about module**: Fix package.json to use published version
4. **If port issues**: Verify PORT env var and app.serve() config
5. **If still stuck**: Try the simple HTTP server test first
