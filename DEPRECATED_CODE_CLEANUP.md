# Deprecated Code Cleanup Plan

## Summary

The iOS app has **duplicate repository implementations** - old code that should be removed:

1. **Old pattern** (DEPRECATED - TO BE REMOVED):
   - `AuthRepository.swift` contains `AuthRepositoryImpl` class
   - `EquipmentRepository.swift` contains `EquipmentRepositoryImpl` class
   - Both have hardcoded URLs and duplicate HTTP request logic
   - Already updated to use APIConfig, but still should be removed

2. **New pattern** (ACTIVE - KEEP):
   - `Repositories/Protocols/XxxRepository.swift` - Protocol interfaces only
   - `Repositories/Implementations/DefaultXxxRepository.swift` - Clean implementations using unified APIClient
   - Single source of truth for HTTP requests
   - Consistent error handling and logging

## Why They Exist

These old implementations were created during the initial development before the unified APIClient pattern was established. They contain:
- Duplicate HTTP request building logic
- Duplicate error handling
- Duplicate CodingKey mappings
- Hardcoded URLs (now pointing to APIConfig, but still redundant)

**Example comparison:**

### Old Pattern (AuthRepositoryImpl - 117 lines)
```swift
class AuthRepositoryImpl: AuthRepository {
    private let baseURL = APIConfig.baseURL

    func registerDevice(...) {
        let request = try buildRequest(...)  // Duplicate code
        let response: DeviceRegistrationResponse = try await executeRequest(request)
        return (user: response.user, token: response.session.access_token)
    }

    private func buildRequest(...) { ... }     // Duplicated in every Impl
    private func executeRequest<T>(...) { ... } // Duplicated in every Impl
}
```

### New Pattern (DefaultAuthRepository - 74 lines)
```swift
class DefaultAuthRepository: AuthRepository {
    private let apiClient: APIClient  // Reuse existing HTTP logic

    func registerDevice(...) {
        let response: DeviceRegistrationResponse = try await apiClient.postPublic(
            endpoint: "/auth/register-device",
            body: request
        )
        apiClient.setAuthToken(token: response.session.accessToken)
        return (user: response.user, token: response.session.accessToken)
    }
}
```

**Benefits of new pattern:**
- ✅ DRY (Don't Repeat Yourself)
- ✅ Single logging/error handling location (APIClient)
- ✅ Easier to add features (network logging, timeouts, retries)
- ✅ Consistent across all API calls

## Files to Remove

### Priority 1 (HIGH) - Remove Immediately
These are causing the routing bugs:

1. **`Repositories/AuthRepository.swift`** (entire file)
   - Contains protocol definition and deprecated `AuthRepositoryImpl`
   - Protocol should move to `Repositories/Protocols/AuthRepository.swift`
   - `AuthRepositoryImpl` should be deleted entirely

2. **`Repositories/EquipmentRepository.swift`** (entire file)
   - Contains protocol definition and deprecated `EquipmentRepositoryImpl`
   - Protocol should move to `Repositories/Protocols/EquipmentRepository.swift`
   - `EquipmentRepositoryImpl` should be deleted entirely

### Priority 2 (LOW) - Consider for Future Cleanup
These still work but are older:

1. **`Services/AuthService.swift`**
   - Legacy service with hardcoded URLs (now using APIConfig)
   - Overlaps with DefaultAuthRepository functionality
   - Could be removed if all code uses repository pattern

2. **`Services/EquipmentService.swift`**
   - Legacy service with hardcoded URLs (now using APIConfig)
   - Overlaps with DefaultEquipmentRepository functionality
   - Could be removed if all code uses repository pattern

## Current Usage Map

```
ViewModels/AuthViewModel.swift
  → Uses: DefaultAuthRepository ✅ (CORRECT)

ViewModels/EquipmentViewModel.swift
  → Uses: DefaultEquipmentRepository ✅ (CORRECT - just fixed)

ViewModels/ProfileViewModel.swift
  → Need to check which repository it uses

Views/EquipmentView.swift
  → Uses: EquipmentViewModel (which now uses correct repo) ✅
```

## Recommended Cleanup Steps

### Step 1: Create Proper Protocol Files
Move protocol definitions to dedicated files:

```bash
# AuthRepository protocol
Repositories/Protocols/AuthRepository.swift

# EquipmentRepository protocol
Repositories/Protocols/EquipmentRepository.swift
```

### Step 2: Delete Old Implementation Files
Remove the old combined files:

```bash
rm Repositories/AuthRepository.swift
rm Repositories/EquipmentRepository.swift
```

### Step 3: Verify No Remaining References
Check for any remaining imports of old files:

```bash
grep -r "AuthRepositoryImpl\|EquipmentRepositoryImpl" New-Mystica --include="*.swift"
# Should return: NO RESULTS
```

### Step 4: Update Any Direct Service Usage
If any code imports `AuthService` or `EquipmentService` directly, migrate to repository pattern:

```swift
// OLD (deprecated)
let service = AuthService.shared
try await service.registerDevice()

// NEW (correct)
let repository = DefaultAuthRepository()
try await repository.registerDevice(deviceId: ...)
```

## Why This Matters

1. **Bug Prevention**: Duplicate code = duplicate bugs. Having two implementations of the same thing caused the `/player/equipment` vs `/equipment` routing issue.

2. **Maintenance**: Every bug fix needs to be applied in multiple places. This cleanup ensures single source of truth.

3. **Team Clarity**: New team members won't be confused about which pattern to use.

4. **Performance**: Reduced app size, fewer files to compile.

## Code Quality Impact

- **Before cleanup**: ⚠️ Two HTTP implementations with duplicate logic
- **After cleanup**: ✅ Single, consistent HTTP layer managed by APIClient

## Timeline

- ✅ **Completed**: APIClient unification
- ✅ **Completed**: APIConfig centralization
- ✅ **Completed**: ViewModels updated to use DefaultXxx repositories
- ⏳ **Next**: Remove duplicate protocol/implementation files
- ⏳ **Future**: Remove Service layer if not needed

## Verification Checklist

After cleanup:
- [ ] No references to `AuthRepositoryImpl` remain
- [ ] No references to `EquipmentRepositoryImpl` remain
- [ ] All ViewModels use `Default*Repository` classes
- [ ] All tests pass
- [ ] App builds without errors
- [ ] Equipment endpoint works correctly
- [ ] Authentication flow works correctly
