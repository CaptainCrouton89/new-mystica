---
description: Update user story and validate impact on feature specifications
---

# Update User Story

Modify existing user story: status, criteria, feature link.

@~/.claude/file-templates/init-project/CLAUDE.md

## Process

## ⚡ Delegation

**Default approach:** Delegate story updates to `@agent-documentor` so you can maintain orchestration flow. Provide:
- Target story file path and template expectations for metadata
- Requested edits (status, AC changes, links) plus any checks that must stay aligned (feature IDs, priority, etc.)

Continue coordinating follow-up work or gathering additional info while they update the doc. Monitor via hook updates and only `await` when their change blocks the next step.

**Inline exception:** Manual edits should be limited to explicit single-field fixes requested by the user. Otherwise stick with asynchronous delegation.

### 1. Show All Stories
```bash
./list-stories.sh
```

### 2. Select Story
Enter story ID (e.g., US-113).

### 3. Show Current State
Display story content.

### 4. Ask What to Update
- Status (incomplete/in-progress/complete)
- Acceptance criteria (add/modify/mark complete)
- User story text
- Feature link
- Priority/estimation

### 5. Validate Changes
Check feature exists if changing link.

### 6. Present Changes & Confirm
Show proposed updates.

### 7. Apply Updates
Update `user-stories/US-###-*.yaml` with `last_updated` timestamp.

### 8. Validation
```bash
./check-project.sh --no-links
```

### 9. Next Steps

Present options to user:

```markdown
✓ Story US-### updated
✓ Changes validated

**Next Steps:**

**Option 1: Update More Stories**
- Update another story: `/manage-project/update/update-story`
- Check progress: `./list-stories.sh -s in-progress`

**Option 2: Re-implement Based on Changes**
- If acceptance criteria changed significantly: `/manage-project/implement/00-orchestrate US-###`
  - Will update implementation to match new criteria
  - Investigation phase identifies what needs to change
  - Only affected code is updated

Which path would you like to take?
```

## Edge Cases

### Story not found
Available stories: US-101 through US-115.

### Invalid feature ID
Verify exists with `./list-features.sh | grep "F-06"`.

### Marking complete with incomplete criteria
Warn and get confirmation.

### Changing feature mid-implementation
Warn about potential confusion.

## Output
Updated story file with new status/criteria/feature link.
