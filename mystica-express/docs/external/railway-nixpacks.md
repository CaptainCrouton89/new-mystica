# Railway Nixpacks Override LLM Reference

## Critical Auto-Detection & Override

**Dockerfile Precedence**: Railway automatically detects and uses Dockerfile at service root. Logs: "Using detected Dockerfile!"

**Override Methods**:
- Place `Dockerfile` (capital D) at service root → Automatic override
- Set `RAILWAY_DOCKERFILE_PATH` env var for custom Dockerfile location
- Use `railway.json` with `"builder": "RAILPACK"` to force newer builder

## Nixpacks Status & Migration

**CRITICAL**: Nixpacks is deprecated (maintenance mode only). New services use Railpack automatically.

**Migration Path**: Update service settings or add to `railway.json`:
```json
{
  "builder": "RAILPACK"
}
```

## Node.js Version Constraints in Nixpacks

**Available Versions**: 16, 18 (default), 20, 22, 23

**Version Override Priority** (highest to lowest):
1. `NIXPACKS_NODE_VERSION` environment variable
2. `engines.node` in `package.json`
3. `.nvmrc` file with version/alias

**Critical Constraint**: Only major versions allowed (e.g., "18", "20", NOT "18.15.0")

**Examples**:
```bash
# Environment variable
NIXPACKS_NODE_VERSION=20

# package.json
"engines": { "node": "20" }

# .nvmrc
20
lts/*
```

## Configuration File Interaction

**Precedence**: `railway.json` > `nixpacks.toml` > auto-detection

**nixpacks.toml vs railway.json**:
- `nixpacks.toml`: Nixpacks-specific config (deprecated builder)
- `railway.json`: Railway platform config (works with all builders)

**Best Practice**: Use `railway.json` for forward compatibility with Railpack.

## Forcing Dockerfile Over Auto-Detection

**Method 1 - File Placement**:
```bash
# Place at service root
./Dockerfile  # ✅ Auto-detected
./docker/Dockerfile  # ❌ Requires RAILWAY_DOCKERFILE_PATH
```

**Method 2 - Environment Variable**:
```bash
RAILWAY_DOCKERFILE_PATH=docker/Dockerfile
RAILWAY_DOCKERFILE_PATH=backend.dockerfile
```

**Method 3 - railway.json Override**:
```json
{
  "build": {
    "builder": "DOCKERFILE"
  }
}
```

## Nixpkgs Package Constraints

**Package Search**: search.nixos.org for available packages/versions

**Nixpkgs Archive Override**:
- Default: Railway-managed nixpkgs version
- Override: Specify `nixpkgsArchive` in nixpacks.toml for older/newer packages

**Node.js 24 Availability**: Check search.nixos.org - may require newer nixpkgs archive

## Version: Railway 2025-01-19