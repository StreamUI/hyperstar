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

## Recommended Workflows

Choose the workflow that fits your development style:

### Option A: Feature Branches (Recommended for Teams)

**Use for:** New features, breaking changes, anything that needs review

```bash
# 1. Create feature branch
git checkout -b feat/new-feature

# 2. Make your changes
# ... edit code ...

# 3. Add changeset
bun changeset
# Select packages, bump type, write summary

# 4. Commit changes + changeset together
git add .
git commit -m "feat: add new feature"
git push origin feat/new-feature

# 5. Open PR, review, and merge to master
# (The changeset file goes with your code into master)

# 6. When ready to release (on master, could be days/weeks later):
git checkout master
git pull
bun run version
git add .
git commit -m "chore: release v0.2.0"
git push

# 7. Publish
bun run release
```

### Option B: Direct to Master (Fast, Solo Dev)

**Use for:** Quick fixes, docs, minor tweaks when you're the only maintainer

```bash
# 1. Make changes directly on master
# ... edit code ...

# 2. Add changeset
bun changeset

# 3. Commit both together
git add .
git commit -m "fix: bug fix"
git push origin master

# 4. When ready to release (could be multiple changesets accumulated):
bun run version
git add .
git commit -m "chore: release v0.2.0"
git push

# 5. Publish
bun run release
```

### Key Points

✅ **Always commit the changeset file WITH your code changes**
✅ **Changesets accumulate** - merge multiple PRs before releasing
✅ **You control when to publish** - version can happen days/weeks later
✅ **One changeset per logical change** - but multiple changesets per PR is fine

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

**Real Example from Terminal:**
```bash
$ bun run release
🦋  info npm info hyperstar-cli
🦋  info npm info hyperstar
🦋  warn hyperstar-cli is not being published because version 0.1.0 is already published on npm
🦋  info hyperstar is being published because our local version (0.2.0) has not been published on npm
🦋  info Publishing "hyperstar" at "0.2.0"
🦋  success packages published successfully:
🦋  hyperstar@0.2.0
```

**Note:** With a granular access token configured with "Bypass 2FA", you won't be prompted for any OTP/2FA codes.

---

## Prerequisites

### npm Authentication Setup

**IMPORTANT:** As of September 2025, npm removed support for TOTP authenticator apps (Google Authenticator, etc.). You can only use Security Keys (YubiKey, Touch ID, Face ID).

**For CLI publishing, use a Granular Access Token instead:**

1. **Create a token on npmjs.com:**
   - Go to https://www.npmjs.com/settings/YOUR_USERNAME/tokens
   - Click "Generate New Token" → "Granular Access Token"
   - Configure:
     - **Token Type:** Publish
     - **Packages:** Select `hyperstar` and `hyperstar-cli`
     - **Permissions:** Read and Write
     - ✅ **CHECK "Bypass 2FA"** (critical!)
   - Copy the token (starts with `npm_...`)

2. **Configure npm to use the token:**
   ```bash
   # Log out of npm CLI
   npm logout

   # Set the token directly (replace with your actual token)
   npm config set //registry.npmjs.org/:_authToken=npm_YOUR_TOKEN_HERE

   # Verify it worked
   npm whoami
   ```

3. **Authenticate with GitHub (for tags):**
   ```bash
   gh auth login
   ```

Now you can publish without OTP prompts!

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

### "Enter one-time password" prompt appears

**This means you don't have a granular access token configured with "Bypass 2FA" enabled.**

npm removed TOTP authenticator app support in September 2025. You can't use Google Authenticator, etc. anymore.

**Solution:** Set up a granular access token (see Prerequisites section above).

### "No changesets present"

You need to add a changeset first:
```bash
bun changeset
```

### npm publish fails with 401/403

Your token might be expired or not configured:
```bash
# Check if you're authenticated
npm whoami

# If not, set up your token again (see Prerequisites)
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
