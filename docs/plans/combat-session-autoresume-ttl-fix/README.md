# Combat Session Auto-Resume TTL Fix

## Problem

User reported that when relaunching the app, even though they have an active combat session, the app doesn't auto-resume combat. Instead:
- Splash screen shows: `✅ [SPLASH] No active combat, transitioning to main menu`
- Clicking "Start Combat" throws: `❌ 409 - User already has an active combat session`

## Root Cause

The combat session TTL was set to **15 minutes**, which is too short for typical app usage patterns:

1. User starts combat → Session created with `outcome = null`
2. User backgrounds the app or closes it
3. After ~17 minutes, user relaunches the app
4. Backend query filters sessions older than 15 minutes:
   ```typescript
   .gte('created_at', new Date(Date.now() - 900 * 1000).toISOString())
   ```
5. Session is considered "expired" and not returned → App shows "No active combat"

The session wasn't actually completed (outcome still `null`), just considered expired by the TTL filter.

## Investigation Results

### Database Evidence
```
Most recent session: acb9b9ff-c304-4923-8d5d-975054fad2fa
Created: 2025-10-23T23:14:20.108Z (UTC)
Age: ~17.3 minutes
Outcome: null (incomplete)
```

With 15-minute TTL:
- ❌ Session filtered out (age > TTL)
- `/api/v1/combat/active-session` returns `{"session": null}`
- App correctly transitions to main menu (no auto-resume)

### Code Locations

**TTL Constant:**
`mystica-express/src/repositories/CombatRepository.ts:107`
```typescript
export const COMBAT_SESSION_TTL = 900; // 15 minutes
```

**Query with TTL Filter:**
`mystica-express/src/repositories/CombatRepository.ts:228-236`
```typescript
async getUserActiveSession(userId: string): Promise<CombatSessionData | null> {
  const { data, error } = await this.client
    .from('combatsessions')
    .select('*')
    .eq('user_id', userId)
    .is('outcome', null)
    .gte('created_at', new Date(Date.now() - COMBAT_SESSION_TTL * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
```

**Consumers:**
- `CombatService.startCombat()` - Conflict detection (line 183)
- `CombatService.getUserActiveSession()` - Auto-resume check (line 509)
- `CombatController.getActiveSession()` - HTTP endpoint (line 96)
- `CombatRepository.createSession()` - Double-check before insert (line 139)

## Solution

Increased `COMBAT_SESSION_TTL` from **15 minutes → 60 minutes**

### Rationale
- Users may background the app during combat for phone calls, messages, etc.
- Debugging/testing requires longer sessions to stay active
- 60 minutes aligns with typical mobile game session expectations
- Still expires abandoned sessions within a reasonable timeframe

### Changes Made

**File:** `mystica-express/src/repositories/CombatRepository.ts:103-108`

```diff
 /**
- * Combat session TTL in seconds (15 minutes)
+ * Combat session TTL in seconds (60 minutes)
  * Used for session expiry logic based on created_at timestamp
+ * Increased from 15min to 60min to support app backgrounding and debugging
  */
-export const COMBAT_SESSION_TTL = 900; // 15 minutes
+export const COMBAT_SESSION_TTL = 3600; // 60 minutes
```

## Verification

### Before Fix (15min TTL)
```bash
$ node check-session.js
Session age: 19.7 minutes
Within 15min TTL? false
Active session found? ❌ No
```

### After Fix (60min TTL)
```bash
$ node check-session.js
Session age: 19.7 minutes
Within 60min TTL? true
Active session found? ✅ Yes
Session ID: acb9b9ff-c304-4923-8d5d-975054fad2fa
```

## Testing Instructions

1. **Start backend:**
   ```bash
   cd mystica-express && pnpm dev
   ```

2. **Launch app with user's device ID:**
   - Device ID: `6a7a9353-e4d9-4ae0-b3a8-0736b77a8a99`
   - User ID: `6a7a9353-e4d9-4ae0-b3a8-0736b77a8a99` (same in test data)

3. **Expected behavior:**
   - Splash screen should detect active combat session
   - Log: `⚔️ [SPLASH] Active combat session found, navigating to battle...`
   - App navigates to BattleView with existing session

4. **Test endpoint manually:**
   ```bash
   # Register device and get token
   curl -X POST http://localhost:3000/api/v1/auth/register-device \
     -H "Content-Type: application/json" \
     -d '{"device_id":"6a7a9353-e4d9-4ae0-b3a8-0736b77a8a99"}'

   # Check active session (should return session, not null)
   curl http://localhost:3000/api/v1/combat/active-session \
     -H "Authorization: Bearer <TOKEN>"
   ```

## Impact

- ✅ Users can background app during combat without losing session
- ✅ Debugging sessions remain active longer
- ✅ Auto-resume flow works as intended
- ⚠️ Abandoned sessions take longer to expire (60min vs 15min)
  - Acceptable tradeoff - user can still explicitly abandon via UI

## Related Files

- `mystica-express/src/repositories/CombatRepository.ts` - TTL constant and query
- `New-Mystica/New-Mystica/SplashScreenView.swift` - Auto-resume logic (lines 94-107)
- `New-Mystica/New-Mystica/State/AppState.swift` - Session state management (lines 161-183)

## Status

✅ **Fixed** - TTL increased to 60 minutes
🧪 **Testing** - Ready for app relaunch test
