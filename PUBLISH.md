# Publishing Hyperstar

## Packages

| Package | npm name | Description |
|---------|----------|-------------|
| `packages/hyperstar` | `hyperstar` | Main framework |
| `packages/cli` | `create-hyperstar` | Project scaffolding CLI |

---

## Prerequisites

```bash
# Login to npm (one-time)
npm login

# Verify you're logged in
npm whoami
```

---

## Publishing Steps

### 1. Pre-publish Checks

```bash
# Type check all packages
bun run prepublish:check

# Verify package contents (dry run)
cd packages/hyperstar && npm pack --dry-run
cd packages/cli && npm pack --dry-run
```

### 2. Version Bump (if needed)

```bash
# Patch: 0.1.0 → 0.1.1 (bug fixes)
bun run version:patch

# Minor: 0.1.0 → 0.2.0 (new features)
bun run version:minor

# Major: 0.1.0 → 1.0.0 (breaking changes)
bun run version:major
```

### 3. Publish

```bash
# Publish both packages (hyperstar first, then CLI)
bun run publish:all

# Or individually:
bun run publish:hyperstar
bun run publish:cli
```

---

## After Publishing

### Users can create new projects:

```bash
# Using bunx (recommended)
bunx create-hyperstar my-app

# Using npx
npx create-hyperstar my-app

# Then
cd my-app
bun run dev
```

### Users can install framework directly:

```bash
bun add hyperstar
```

---

## Available Scripts

| Script | Description |
|--------|-------------|
| `bun run publish:hyperstar` | Publish hyperstar package |
| `bun run publish:cli` | Publish create-hyperstar CLI |
| `bun run publish:all` | Publish both packages |
| `bun run version:patch` | Bump patch version (x.x.X) |
| `bun run version:minor` | Bump minor version (x.X.0) |
| `bun run version:major` | Bump major version (X.0.0) |
| `bun run prepublish:check` | Run type checks before publish |

---

## Troubleshooting

### Package name already taken
Check npm for availability:
```bash
npm view hyperstar
npm view create-hyperstar
```

### Permission denied
Make sure you're logged in and have publish rights:
```bash
npm whoami
npm access ls-packages
```

### Forgot to bump version
```bash
# Unpublish within 72 hours (use carefully!)
npm unpublish hyperstar@0.1.0

# Or just bump and republish
bun run version:patch
bun run publish:all
```
