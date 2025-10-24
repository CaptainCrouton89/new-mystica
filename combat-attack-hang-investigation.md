# Combat Attack Hang Investigation Report

## Problem Summary
iOS app attack spinner hangs indefinitely when attacking in combat. Backend running, frontend rebuilt, but no response from attack requests.

## Complete Data Flow Analysis

### Frontend Request Chain
```
UI Tap → CombatViewModel.attack() → DefaultCombatRepository.performAttack() → APIClient.post("/combat/attack")
```

**File: `CombatViewModel.swift:83-118`**
- Sets `combatState = .loading` before API call
- Calls `repository.performAttack(sessionId, tapPositionDegrees)`
- Waits for response to update UI state

**File: `DefaultCombatRepository.swift:45-79`**
- Creates `AttackRequest` with session_id and tap_position_degrees
- Calls `apiClient.post(endpoint: "/combat/attack", body: request)`
- Maps response to `CombatAction`

**File: `APIClient.swift:49-52, 96-224`**
- Creates URLRequest with no timeout configured
- Uses `URLSession.shared.data(for: request)`
- **CRITICAL**: Uses default URLSession timeout (potentially infinite)

### Backend Processing Chain
```
POST /combat/attack → CombatController.attack() → CombatService.executeAttack() → Database Operations
```

**File: `combat.ts:39-45`**
- Route: `POST /combat/attack` with auth + validation middleware
- Calls `combatController.attack`

**File: `CombatController.ts:42-53`**
- Extracts `session_id` and `tap_position_degrees`
- Calls `combatService.executeAttack(session_id, tap_position_degrees)`
- Returns JSON response

**File: `CombatService.ts:350-427`**
- Validates session exists via `combatRepository.getActiveSession(sessionId)`
- Calculates damage and updates session state
- **CRITICAL**: Calls `applyRewardsTransaction()` for terminal combat states
- This triggers multiple database operations

### Database Operations (Potential Hang Points)

**File: `CombatService.ts:405-413`**
```typescript
// Auto-complete session if combat ended
if (combatStatus === 'victory' || combatStatus === 'defeat') {
  await this.combatRepository.completeSession(sessionId, combatStatus);
  // Generate rewards for this combat outcome
  rewards = await this.completeCombat(sessionId, combatStatus);
  // Apply rewards and delete session atomically
  await this.applyRewardsTransaction(session.userId, sessionId, rewards);
}
```

**File: `CombatService.ts` (applyRewardsTransaction method)**
- Calls `profileRepository.addCurrency()` for gold rewards
- Calls multiple database operations for materials, items, XP

**File: `ProfileRepository.ts` (addCurrency method)**
- Calls `this.rpc<CurrencyRpcResponse>('add_currency_with_logging', params)`
- **CRITICAL**: This is a Supabase RPC call to database stored procedure

**File: `BaseRepository.ts` (rpc method)**
- Calls `await this.client.rpc(functionName, params)`
- **CRITICAL**: Direct Supabase database RPC call - no timeout configured

## Potential Blocking Points

### 1. Frontend Network Timeout Issue
**Location**: `APIClient.swift:76-94`
**Problem**: URLRequest created without timeout configuration
```swift
var request = URLRequest(url: url)
// Missing: request.timeoutInterval = APIConfig.requestTimeout
```
**Impact**: Uses system default timeout (potentially infinite)

### 2. Database RPC Hanging
**Location**: `BaseRepository.ts` → Supabase RPC calls
**Problem**: Database stored procedure `add_currency_with_logging` may hang
**Potential Causes**:
- Database deadlock during reward application
- Long-running transaction locks
- Database connection pool exhaustion
- Stored procedure infinite loop or blocking operation

### 3. Combat Session State Race Condition
**Location**: `CombatService.ts:386-393`
**Problem**: Multiple database updates in sequence without proper transaction isolation
```typescript
await this.combatRepository.updateSession(sessionId, { combatLog: [...currentLog, newLogEntry] });
// Then later...
await this.combatRepository.completeSession(sessionId, combatStatus);
await this.applyRewardsTransaction(session.userId, sessionId, rewards);
```

### 4. Reward Application Transaction Blocking
**Location**: `CombatService.ts` applyRewardsTransaction method
**Problem**: Multiple sequential database operations for rewards
- Currency updates
- Material stack upserts
- Item creation
- XP addition
- Economy transaction logging

## Recommended Fixes (Priority Order)

### 1. IMMEDIATE: Fix Frontend Timeout
**File**: `APIClient.swift:76-94`
**Fix**: Apply configured timeout to URLRequest
```swift
var request = URLRequest(url: url)
request.timeoutInterval = APIConfig.requestTimeout // Add this line
```

### 2. URGENT: Add Backend Operation Timeouts
**File**: `BaseRepository.ts` rpc method
**Fix**: Add timeout to Supabase RPC calls
```typescript
const { data, error } = await Promise.race([
  this.client.rpc(functionName, params),
  new Promise((_, reject) => setTimeout(() => reject(new Error('RPC timeout')), 30000))
]);
```

### 3. HIGH: Database Transaction Optimization
**File**: `CombatService.ts` applyRewardsTransaction
**Fix**: Wrap all reward operations in single database transaction
- Use Supabase transaction boundaries
- Implement proper rollback on failure
- Add transaction timeout

### 4. MEDIUM: Add Request Cancellation
**File**: `APIClient.swift`
**Fix**: Implement request cancellation for loading state management

### 5. LOW: Add Circuit Breaker Pattern
**File**: Backend services
**Fix**: Implement circuit breaker for database operations to prevent cascading failures

## Immediate Test Steps

1. **Add frontend timeout** - Apply fix #1 and test attack
2. **Check backend logs** - Look for hanging RPC calls during attack
3. **Database monitoring** - Check for long-running transactions or deadlocks
4. **Network monitoring** - Verify request actually reaches backend

## Root Cause Hypothesis
Primary suspect is **frontend URLRequest timeout not configured**, causing infinite wait on network operations. Secondary suspect is **database RPC hanging** during reward application for terminal combat states.