# Feature Specs Directory

YAML specifications for game features, organized by feature ID (F-01 through F-12).

## Structure

Each feature has a corresponding YAML file:
- **Naming**: `F-##-feature-name.yaml` (zero-padded ID, kebab-case slug)
- **Template**: Located at `/file-templates/feature-doc.template.md`
- **Validation**: Run `../check-project.sh -v` to verify traceability

## Key Fields

- `feature_id`: Unique identifier (F-01, F-02, etc.)
- `title`: Human-readable feature name
- `status`: `incomplete` | `in-progress` | `complete`
- `user_stories`: Array of story IDs (US-101, US-102, etc.)
- `acceptance_criteria`: Given/When/Then format
- `technical_requirements`: Implementation notes
- `api_endpoints`: Associated endpoints (reference data-plan.yaml)
- `updated_at`: ISO 8601 timestamp

## Current Features

| ID | Feature | Status |
|----|---------|--------|
| F-01 | Geolocation Map | |
| F-02 | Combat System | |
| F-03 | Base Items & Equipment | |
| F-04 | Materials System | |
| F-05 | Material Drop System | |
| F-06 | Item Upgrade System | |
| F-07 | Authentication | |
| F-08 | XP Progression System | |
| F-09 | Inventory Management | |
| F-10 | Premium Items | |
| F-11 | Pet Personality System | |
| F-12 | Enemy AI Personality System | |

## Conventions

- **IDs are sequential** — gaps require investigation (orphaned features)
- **Status must be tracked** — use traceability script to find stale specs
- **User stories are required** — each feature links to US-### stories
- **All specs reference PRD features** — check `../product-requirements.yaml`

## Management

```bash
./list-features.sh              # List all features + status
./list-features.sh --status in-progress  # Filter by status
../check-project.sh -v          # Validate YAML structure & traceability
```

See `../CLAUDE.md` for system-wide documentation conventions.
