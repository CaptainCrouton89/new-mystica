# Project Documentation Guide

YAML-based specs system with investigation and planning artifacts.

## Directory Structure

```
docs/
├── product-requirements.yaml      # PRD (root requirements)
├── feature-specs/                 # Feature breakdown (F-01, F-02, ...)
├── user-stories/                  # User stories (US-101, US-102, ...)
├── user-flows/                    # User journey flows
├── system-design.yaml             # Architecture
├── api-contracts.yaml             # API specifications
├── data-plan.yaml                 # Data model
├── design-spec.yaml               # UI/UX specs
├── investigations/                # Investigation documents from exploration
├── plans/                         # Implementation plans (feature-specific)
├── ai-docs/                       # Technology guides
├── code-quality/                  # Code patterns & standards
└── external/                      # External library documentation
```

## Core Workflow

**Documentation Generation**: PRD → User Flows → User Stories → Feature Specs → System Design → API Contracts → Data Plan → Traceability

**Investigation**: Use context-engineer agents to explore patterns; outputs go to `investigations/`.

**Planning**: After investigation, use planner agents; plans go to `plans/feature-name/plan.md`.

## Management Scripts

```bash
./docs/check-project.sh -v                    # Validate YAML + traceability
./docs/feature-specs/list-features.sh         # Feature stats
./docs/user-stories/list-stories.sh --feature F-04
./docs/list-apis.sh --format curl
```

All scripts support `--help` for options and filtering.

## ID Conventions & YAML Requirements

- **Features**: `F-01`, `F-02` (zero-padded)
- **Stories**: `US-101` (three digits)
- **Files**: kebab-case
- **Status**: `incomplete | in-progress | complete`
- **YAML**: 2-space indentation, no blank fields, quote special chars
- **Required fields**: User Stories need `story_id` + `feature_id`; Feature Specs need `feature_id` + story IDs

## Common Pitfalls

1. Orphaned F-## IDs (every PRD feature needs a spec)
2. Blank YAML fields (investigate and fill)
3. Feature ID mismatches across files
4. Vague acceptance criteria (use Given/When/Then)
5. API endpoint paths don't match implementations

Run `./docs/check-project.sh` before proceeding.

---

See parent `CLAUDE.md` for backend/frontend/AI pipeline guides and technology stack.
