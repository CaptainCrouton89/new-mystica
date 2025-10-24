# Code Smells Master Document

**Generated:** 2025-10-23
**Project:** New Mystica
**Scope:** Backend (mystica-express/), Frontend (New-Mystica/), AI Pipeline (scripts/)

---

## Executive Summary

**Critical Issues:** 8
**High Priority:** 10
**Medium Priority:** 15
**Low Priority:** 10+

**Key Findings:**
- 69 `any` type violations in backend
- 8 force unwrapping instances (3 critical crash risks) in frontend
- 147 generic throw statements, 733 console.log calls
- 6 massive files requiring refactoring (500-1,182 lines)
- Error infrastructure exists but is underutilized

---

## Critical Issues (Immediate Action Required)

### 1. Type Safety Violations - Backend
**Severity:** Critical
**Impact:** Runtime errors, debugging difficulties, defeats TypeScript benefits
**Scope:** 69 instances across 8 files

**Details:**
- `ItemService.ts` (27 instances), `InventoryService.ts` (9), `CombatService.ts` (6), `EnemyChatterService.ts` (8)
- 15 critical violations in database response handling
- 32 high-severity violations in type assertion workarounds
- Root cause: Repository response types not properly defined

**Examples:**
```typescript
// ItemService.ts:40
event_data: any;

// ItemService.ts:139
equipment_slot: itemWithDetails.item_type.category as any,
```

**Investigation:** [Backend Type Safety Investigation](../investigations/backend-type-safety.md)
**Effort:** 1-10 hours per fix depending on complexity

---

### 2. Force Unwrapping - Frontend
**Severity:** Critical
**Impact:** App crashes at runtime during startup/session restoration
**Scope:** 8 instances, 3 critical crash risks

**Critical Locations (High Risk):**
- `ImageCacheManager.swift:15` - `URLSession!` accessed before initialization complete
- `State/AppState.swift:176` - `deviceId!` after nil check (redundant)
- `State/AppState.swift:180` - `.data(using: .utf8)!` can fail

**Medium Risk:**
- `BackgroundImageManager.swift:33,67` - Placeholder URL force unwraps

**Investigation:** [Frontend Force Unwrapping Investigation](../investigations/frontend-force-unwrapping-investigation.md)
**Effort:** 2-3 hours total

---

### 3. Unsafe Non-Null Assertions - Backend
**Severity:** Critical
**Impact:** Runtime crashes if auth middleware or Supabase fail
**Scope:** 45+ instances

**Patterns:**
- Controllers: `req.user!.id` (22 instances) - assumes auth middleware succeeded
- Repositories: `response.data!.new_balance` (4 instances) - assumes Supabase response exists

**Investigation:** Needs investigation
**Effort:** TBD

---

### 4. Massive Files - Backend & Frontend
**Severity:** High
**Impact:** Unmaintainable code, difficult testing, complex debugging
**Scope:** 6 files (500-1,182 lines each)

**Backend:**
- `services/CombatService.ts` - 1,182 lines (needs 3-way split)
- `services/ItemService.ts` - 1,172 lines (needs 5-way split)
- `repositories/CombatRepository.ts` - 877 lines (needs 3-way split)

**Frontend:**
- `BattleView.swift` - 743 lines (needs component extraction)
- `InventoryViewModel.swift` - 683 lines (needs responsibility split)
- `EquipmentView.swift` - 534 lines (needs view composition)

**Investigation:** [Large Files Refactoring Investigation](../investigations/large-files-refactoring.md)
**Effort:** 30-40 hours total

---

### 5. Insufficient Error Handling - AI Pipeline & Backend
**Severity:** Critical
**Impact:** Silent failures, poor debuggability, production monitoring impossible

**AI Pipeline Issues:**
- 3 critical silent failures with `.catch(console.error)`
- Missing try-catch around AWS/R2 operations
- No retry logic for external API calls (Replicate, OpenAI, R2)
- `populateItemImages().catch(console.error)` - script continues despite failure

**Backend Issues:**
- 147 generic `throw new Error()` instead of 23+ available custom error classes
- 733+ console.log/console.error statements (should use winston)
- Missing error context in catch blocks

**Investigation:** [Error Handling Patterns Investigation](../investigations/error-handling-patterns.md)
**Effort:** TBD

---

## High Priority Issues

### 6. Console Logging - Backend
**Severity:** High
**Impact:** Performance degradation, information leakage, no production monitoring
**Scope:** 733+ instances

**Examples:**
```typescript
// controllers/CombatController.ts:101
console.log('🎯 [getActiveSession] Returning recovery data:', JSON.stringify(recoveryData, null, 2));

// middleware/auth.ts:48
console.log('🔒 [AUTH] Authenticating request:', {...});
```

**Investigation:** [Error Handling Patterns Investigation](../investigations/error-handling-patterns.md)
**Effort:** TBD

### 7. Code Duplication - All Components
**Severity:** High
**Scope:** Multiple files

**Backend:**
- 482 instances of repeated error handling patterns
- Transform functions between repository and API formats duplicated
- User ID extraction from request objects repeated

**AI Pipeline:**
- Replicate API calling logic duplicated across 3 files
- R2 upload logic duplicated despite `r2-service.ts` existing
- File path handling and directory creation repeated

**Frontend:**
- Repeated error handling patterns across ViewModels
- Similar modal implementations (3+ modals with duplicate structure)
- Duplicated animation patterns

**Investigation:** Needs investigation
**Effort:** TBD

---

### 8. Hardcoded Configuration - Frontend & AI Pipeline
**Severity:** High
**Impact:** Difficult maintenance, environment-specific values in code

**Frontend:**
- `BackgroundImageManager.swift:18-27` - Hardcoded R2 URLs
- `ImageCacheManager.swift:24-25` - Magic numbers (128MB, 512MB)
- `AuthService.swift:194` - Hardcoded HTTP status range (200...299)

**AI Pipeline:**
- `generate-raw-image.ts:41-52` - Hardcoded reference image URLs
- `populate-item-images.ts:32` - R2_PUBLIC_URL hardcoded
- `r2-service.ts:10` - `bucket: 'mystica-assets'` hardcoded

**Investigation:** Needs investigation
**Effort:** TBD

---

### 9. Resource Management Problems - AI Pipeline
**Severity:** High
**Impact:** Memory exhaustion, disk space issues, system instability

**Issues:**
- No cleanup of temporary files after failed operations
- Large image buffers held in memory without cleanup
- No limits on concurrent operations in batch mode
- File handles not explicitly closed

**Investigation:** Needs investigation
**Effort:** TBD

---

## Medium Priority Issues

### 10. State Management Inconsistencies - Frontend
**Severity:** Medium
**Scope:** BattleView with 18 @State properties

**Issues:**
- Too many state properties in single view
- Mixed usage of @State, @StateObject, @ObservedObject without clear patterns
- State scattered across views instead of centralized management

**Investigation:** Needs investigation
**Effort:** TBD

---

### 11. Missing Weak References - Frontend
**Severity:** Medium
**Impact:** Potential retain cycles and memory leaks

**Issues:**
- Only 2 instances of `[weak self]` found in entire codebase
- Potential retain cycles in closures and Task blocks
- InventoryViewModel.swift:15 shows good pattern but not consistently applied

**Investigation:** Needs investigation
**Effort:** TBD

---

### 12. Unsafe File System Operations - AI Pipeline
**Severity:** Medium
**Impact:** Security vulnerabilities, performance issues

**Issues:**
- `fs.readFileSync(itemsPath, 'utf-8')` without validation
- Directory traversal potential in file path construction
- No validation of file extensions or content types
- Synchronous file operations blocking event loop

**Investigation:** Needs investigation
**Effort:** TBD

---

### 13. Poor Async Patterns - AI Pipeline
**Severity:** Medium
**Impact:** Poor performance, hanging operations

**Issues:**
- Sequential processing instead of controlled parallel processing
- Missing cancellation support for long-running operations
- No timeout handling for external API calls
- Inconsistent use of Promise.all vs Promise.allSettled

**Investigation:** Needs investigation
**Effort:** TBD

---

## Low Priority Issues

### 14. Inconsistent Naming and Patterns - Backend
**Severity:** Low
**Issues:**
- Mixed naming conventions (camelCase vs snake_case)
- Inconsistent import styles (with/without .js extensions)
- Inconsistent error message formats

### 15. Missing Abstractions - Backend
**Severity:** Low
**Issues:**
- Repeated transformation logic between database and API types
- No shared error handling utilities
- No standardized pagination patterns

### 16. Logging and Debugging - AI Pipeline
**Severity:** Low
**Issues:**
- Inconsistent logging levels (console.log, console.error, console.warn)
- No structured logging for easier parsing
- Limited error context in error messages
- No request tracing for debugging complex flows

### 17. Missing Validation - AI Pipeline
**Severity:** Low
**Issues:**
- No input sanitization for user-provided names and descriptions
- Missing file size limits for generated images
- No validation of external URLs in reference images
- Weak parameter validation in CLI argument parsing

---

## Recommended Action Plan

### Phase 1: Critical (Week 1)
1. Remove 69 `any` types from backend
2. Fix 3 critical force unwrapping crash risks in frontend
3. Replace 147 generic errors with custom error classes
4. Replace 733 console.log statements with winston logging
5. Add retry logic to AI pipeline external API calls

### Phase 2: High Priority (Weeks 2-3)
6. Refactor 6 massive files (500-1,182 lines each)
7. Extract duplicated error handling and transform logic
8. Move hardcoded config to environment variables
9. Add resource cleanup to AI pipeline

### Phase 3: Medium Priority (Weeks 4-5)
10. Centralize frontend state management
11. Add weak references to prevent retain cycles
12. Implement async patterns with timeouts
13. Switch to async file operations with validation

### Phase 4: Low Priority (Week 6+)
14. Standardize naming conventions
15. Create shared abstractions for transforms
16. Add request tracing to AI pipeline
17. Implement input validation

---

## Investigation Status

| Issue | Priority | Status | Investigation Link |
|-------|----------|--------|-------------------|
| Type Safety Violations | Critical | ✅ Complete | [backend-type-safety.md](../investigations/backend-type-safety.md) |
| Force Unwrapping | Critical | ✅ Complete | [frontend-force-unwrapping-investigation.md](../investigations/frontend-force-unwrapping-investigation.md) |
| Unsafe Non-Null Assertions | Critical | 🔄 Needs Investigation | TBD |
| Massive Files | High | ✅ Complete | [large-files-refactoring.md](../investigations/large-files-refactoring.md) |
| Error Handling (All) | Critical/High | ✅ Complete | [error-handling-patterns.md](../investigations/error-handling-patterns.md) |
| Console Logging | High | ✅ Complete | [error-handling-patterns.md](../investigations/error-handling-patterns.md) |
| Code Duplication | High | 🔄 Needs Investigation | TBD |
| Hardcoded Configuration | High | 🔄 Needs Investigation | TBD |
| Resource Management | High | 🔄 Needs Investigation | TBD |
| State Management | Medium | 🔄 Needs Investigation | TBD |
| Weak References | Medium | 🔄 Needs Investigation | TBD |
| Unsafe File Operations | Medium | 🔄 Needs Investigation | TBD |
| Poor Async Patterns | Medium | 🔄 Needs Investigation | TBD |

---

## References

### Initial Reports (High-Level)
- Backend Initial Report: [`agent-responses/agent_253504.md`](../../agent-responses/agent_253504.md)
- Frontend Initial Report: [`agent-responses/agent_584556.md`](../../agent-responses/agent_584556.md)
- AI Pipeline Initial Report: [`agent-responses/agent_570350.md`](../../agent-responses/agent_570350.md)

### Detailed Investigations
- [Backend Type Safety](../investigations/backend-type-safety.md)
- [Frontend Force Unwrapping](../investigations/frontend-force-unwrapping-investigation.md)
- [Large Files Refactoring](../investigations/large-files-refactoring.md)
- [Error Handling Patterns](../investigations/error-handling-patterns.md)

---

**Last Updated:** 2025-10-23
**Next Review:** After Phase 1 completion
