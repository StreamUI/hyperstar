# Publishing Hyperstar

Powered by [Changesets](https://github.com/changesets/changesets) 🦋

## Packages

| Package | npm name | Description |
|---------|----------|-------------|
| `packages/hyperstar` | `hyperstar` | Main framework |
| `packages/cli` | `hyperstar-cli` | CLI tools |

---

## Quick Start

### 1. Add a changeset as you work

Every time you make a change you want to release, add a changeset:

```bash
bun changeset
```

This will prompt you to:
1. Select which packages changed (hyperstar, hyperstar-cli, or both)
2. Choose bump type (patch, minor, or major) for each package
3. Write a summary of the change (goes in CHANGELOG.md)

**Example:**
```bash
$ bun changeset
🦋  Which packages would you like to include?
  ◉ hyperstar
  ◯ hyperstar-cli

🦋  What kind of change is this for hyperstar?
  ◯ patch (0.1.0 → 0.1.1)
  ◉ minor (0.1.0 → 0.2.0)
  ◯ major (0.1.0 → 1.0.0)

🦋  Please enter a summary for this change:
  Add new signal methods for nullable values
```

The changeset is saved as a markdown file in `.changeset/` - commit it with your changes!

### 2. Version packages when ready to release

When you're ready to release, run:

```bash
bun run version
```

This will:
- ✅ Consume all changesets in `.changeset/`
- ✅ Bump package versions appropriately
- ✅ Update CHANGELOG.md files
- ✅ Delete consumed changeset files

Review the version changes and changelogs, then commit them:

```bash
git add .
git commit -m "chore: release v0.2.0"
git push
```

### 3. Publish to npm

```bash
bun run release
```

This will:
- ✅ Run type checks
- ✅ Publish all changed packages to npm
- ✅ Create git tags for the new versions

**Note:** Make sure you're logged into npm first (`npm login`)

---

## Complete Workflow Example

```bash
# 1. Make your changes
# ... edit code ...

# 2. Add a changeset
bun changeset
# Select packages, bump type, write summary
# Commit the changeset file

git add .
git commit -m "feat: add new API methods"
git push

# 3. When ready to release (could be multiple changesets accumulated)
bun run version
# Review the version bumps and changelogs

git add .
git commit -m "chore: release v0.2.0"
git push

# 4. Publish
bun run release
# Packages are published to npm!
```

---

## Prerequisites

```bash
# Login to npm (one-time)
npm login

# Verify you're logged in
npm whoami

# Authenticate with GitHub (for tags)
gh auth login
```

---

## Advanced Usage

### Multiple changesets

You can add multiple changesets before releasing:

```bash
bun changeset  # Add changeset for feature A
bun changeset  # Add changeset for feature B
bun changeset  # Add changeset for bug fix

# Later, when ready
bun run version  # Consumes all changesets at once
bun run release  # Publishes everything
```

### Skip packages

When adding a changeset, just don't select packages you don't want to bump.

### Manual version control

Edit the changeset markdown files in `.changeset/` to:
- Change bump types in the YAML frontmatter
- Improve changelog summaries in the markdown body
- Delete changesets you don't want to include

### Pre-releases

Create pre-release versions:

```bash
# Enter pre-release mode
bun changeset pre enter beta

# Add changesets as normal
bun changeset

# Version (creates 0.2.0-beta.0)
bun run version

# Publish
bun run release

# Exit pre-release mode
bun changeset pre exit
```

---

## CI/CD with GitHub Actions

You can automate releases with GitHub Actions. Create `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    branches:
      - master

permissions:
  contents: write
  pull-requests: write
  id-token: write

jobs:
  release:
    name: Release
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install

      - name: Create Release Pull Request or Publish
        uses: changesets/action@v1
        with:
          version: bun run version
          publish: bun run release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

This will:
- Create a PR with version bumps when changesets are merged
- Publish packages when the version PR is merged

---

## Troubleshooting

### "No changesets present"

You need to add a changeset first:
```bash
bun changeset
```

### npm publish fails

Check you're logged in:
```bash
npm whoami
npm login
```

### Version didn't bump

Make sure you committed the changeset files in `.changeset/`:
```bash
git status
git add .changeset
git commit -m "chore: add changeset"
```

### Wrong version bumped

Edit the changeset file in `.changeset/` before running `bun run version`. The YAML frontmatter controls the bump:

```yaml
---
"hyperstar": minor
"hyperstar-cli": patch
---
```

### Need to undo a release

You can't unpublish npm packages after 72 hours. Your options:
1. Publish a new patch version fixing the issue
2. Deprecate the version: `npm deprecate hyperstar@0.2.0 "Use 0.2.1 instead"`

---

## Learn More

- [Changesets documentation](https://github.com/changesets/changesets)
- [Adding a changeset](https://github.com/changesets/changesets/blob/main/docs/adding-a-changeset.md)
- [Changesets with pnpm](https://pnpm.io/using-changesets)
