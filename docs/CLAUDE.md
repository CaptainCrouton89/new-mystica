# Project Documentation Guide

YAML-based specs system with investigation and planning artifacts.

## Directory Structure

```
docs/
├── product-requirements.yaml      # PRD (root requirements)
├── system-design.yaml             # Architecture
├── api-contracts.yaml             # API specifications
├── design-spec.yaml               # UI/UX specs
├── data-plan.yaml                 # Data model
├── feature-specs/*.yaml           # Feature breakdown (F-01, F-02, ...)
├── user-stories/*.yaml            # User stories (US-101, US-102, ...)
├── user-flows/*.yaml              # User journey flows
├── investigations/                # Investigation documents from exploration phases
├── plans/                         # Implementation plans (feature-specific)
├── ai-docs/                       # Technology guides (backend.md, frontend.md, etc.)
├── code-quality/                  # Code patterns & standards
├── image-refs/                    # Image reference files
├── external/                      # External library documentation
├── check-project.sh               # Validate YAML + traceability
├── list-apis.sh                   # Query API contracts
├── generate-docs.sh               # Export to markdown
└── */list-*.sh                    # Subdirectory list scripts
```

## Core Workflow

**Documentation Generation**: PRD → User Flows → User Stories → Feature Specs → System Design → API Contracts → Data Plan → Design Spec → Traceability Pass

**Investigation**: When exploring patterns or unknowns, use context-engineer agents to produce investigation documents in `investigations/`.

**Planning**: After investigation, use planner agents to create implementation plans in `plans/feature-name/plan.md`.

**Implementation**: Reference plans and investigations when implementing features.

## Management Scripts

```bash
./docs/check-project.sh -v                    # Validate all YAML + cross-file traceability
./docs/feature-specs/list-features.sh         # Feature stats & tree view
./docs/user-stories/list-stories.sh --feature F-04  # Filter by feature/status
./docs/user-flows/list-flows.sh               # Filter by persona
./docs/list-apis.sh --format curl             # Generate curl/postman
./docs/generate-docs.sh                       # Export YAML to markdown
```

All scripts support `--help`, multiple output formats, and filtering options.

## ID Conventions

- **Features**: `F-01`, `F-02` (zero-padded)
- **Stories**: `US-101`, `US-102` (three digits)
- **Files**: kebab-case (e.g., `user-authentication.yaml`)
- **Status values**: `incomplete` | `in-progress` | `complete`

## YAML Requirements

- Top-level fields: `title`, `template` path, `status`
- User Stories: `story_id`, `feature_id`, required
- Feature Specs: `feature_id`, story IDs, required
- 2-space indentation, quote special chars, no blank fields (use `""`)

## Traceability Rules

- User Flows → PRD features
- User Stories → set `feature_id` matching PRD, link to flows
- Feature Specs → reference story IDs, link to PRD
- API Contracts → note feature IDs in descriptions
- Data Plan → track PRD metrics

Run `./docs/check-project.sh` regularly. Fix validation errors before proceeding.

## Common Pitfalls

1. Orphaned F-## IDs (every PRD feature needs a spec file)
2. Blank fields (investigate and fill, don't skip)
3. Feature ID mismatches across files
4. Missing metric tracking or event definitions
5. Vague acceptance criteria (use Given/When/Then)
6. API endpoint paths don't match implementations

## Technology Guides

See `ai-docs/` for specialized documentation:
- **backend.md** - TypeScript/Express patterns
- **frontend.md** - SwiftUI/navigation patterns
- **ai-pipeline.md** - Image generation workflow
- **database.md** - Supabase schema & queries

---

*All templates in `/file-templates/init-project/`. Run scripts with `--help` for full options.*
