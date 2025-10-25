# Railway Builder Configuration LLM Reference

## Builder Selection Precedence (Critical)

Railway chooses builders in this exact order:
1. **Dockerfile present** → Always uses Dockerfile (highest priority)
2. **railway.json/railway.toml `builder` field** → Overrides default
3. **Service dashboard settings** → UI configuration
4. **Railway default** → Railpack (for new services), Nixpacks (legacy services)

## Configuration File Syntax

### railway.json Format
```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "custom/Dockerfile"
  }
}
```

### railway.toml Format
```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "custom/Dockerfile"
```

## Builder Options

- `"DOCKERFILE"` - Forces Dockerfile builder (even if auto-detected)
- `"RAILPACK"` - New default builder (2024+)
- `"NIXPACKS"` - Legacy builder (deprecated)

## Critical Behaviors

**Dockerfile Auto-Detection**:
- Railway scans for `Dockerfile` in root directory
- Logs: "Using detected Dockerfile!" when found
- **No configuration needed** - automatic precedence

**Custom Dockerfile Path**:
- Service variable: `RAILWAY_DOCKERFILE_PATH=path/to/Dockerfile`
- Config file: `"dockerfilePath": "path/to/Dockerfile"`

**Config Precedence Rule**:
- **Config files ALWAYS override dashboard settings**
- Dashboard settings are NOT updated when config files are present
- Environment-specific config > Base config > Dashboard

## Force Dockerfile (Non-Obvious)

Even with Dockerfile present, you can force it explicitly:
```json
{
  "build": {
    "builder": "DOCKERFILE"
  }
}
```

Required when:
- Multiple builders could apply
- Overriding service-level settings
- Ensuring consistent behavior across deployments

## Gotchas

1. **Schema Required**: Always include `$schema` for validation/autocomplete
2. **File Location**: Must be in repository root unless custom path specified
3. **No Fallback**: Invalid builder values cause deployment failure
4. **Legacy Migration**: Existing Nixpacks services stay on Nixpacks unless explicitly changed

## Version: Railway Platform 2024