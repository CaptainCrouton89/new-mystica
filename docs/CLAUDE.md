# Project Documentation Guide

YAML-based specs system with investigation and planning artifacts.

## Directory Structure

```
docs/
├── product-requirements.yaml         # Root PRD
├── feature-specs/                    # Feature breakdown (F-01, F-02, ...)
├── user-stories/                     # User stories (US-101, US-102, ...)
├── user-flows/                       # User journey flows
├── system-design.yaml, api-contracts.yaml, data-plan.yaml
├── ai-docs/                          # Backend/frontend/AI pipeline guides
├── code-quality/                     # Code patterns & standards
├── investigations/, plans/           # Research & implementation plans
├── TESTING_ENDPOINTS.md              # Dev auth & endpoint testing
└── external/                         # External library documentation
```

## Scripts

```bash
./docs/check-project.sh -v           # Validate YAML + traceability
./docs/feature-specs/list-features.sh    # Feature stats
./docs/user-stories/list-stories.sh      # User story queries
./docs/list-apis.sh --format curl        # API overview
```

## ID Conventions & YAML Requirements

- **Features**: `F-01`, `F-02` (zero-padded)
- **Stories**: `US-101` (three digits)
- **Files**: kebab-case
- **Status**: `incomplete | in-progress | complete`
- **YAML**: 2-space indentation, no blank fields
- **Required fields**: User Stories need `story_id` + `feature_id`; Feature Specs need `feature_id` + story IDs

## Common Pitfalls

1. Orphaned F-## IDs (every PRD feature needs a spec)
2. Blank YAML fields (investigate and fill)
3. Feature ID mismatches across files
4. Vague acceptance criteria (use Given/When/Then)
5. API endpoint paths don't match implementations

Run `./docs/check-project.sh` before proceeding.
