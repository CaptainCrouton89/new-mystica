# AuthController Specification

## Controller Overview

**Purpose**: The AuthController handles all authentication operations for the Mystica game, managing both anonymous device-based authentication (MVP0 priority) and email/password authentication (post-MVP0).

**Feature Reference**: [F-07 Authentication](../feature-specs/F-07-authentication.yaml)

**Service Dependencies**:
- `AuthService` - Core authentication business logic and Supabase integration
- `ProfileRepository` - User profile management and currency balances
- `EquipmentService` (indirect) - For total stats calculation

**Middleware Chain**:
- CORS middleware (global)
- Body parsing middleware (global)
- Auth middleware (endpoint-specific)
- Validation middleware (endpoint-specific)

## Route Definitions

All auth routes are mounted at `/api/v1/auth` prefix as defined in `src/app.ts:58`.

## Endpoint Specifications

### 1. POST /auth/register-device

**Purpose**: Anonymous device registration for zero-friction onboarding (MVP0 primary auth method)

**Route Handler**: `AuthController.registerDevice`
**File Location**: `src/controllers/AuthController.ts:291-337`

#### Input Schema
- **Headers**: None required
- **Params**: None
- **Query**: None
- **Body**: `RegisterDeviceBodySchema` (schemas.ts:198-200)
```typescript
{
  device_id: string (UUID format) // iOS identifierForVendor UUID
}
```

#### Output Schema
**Success (201/200)**:
```typescript
{
  user: {
    id: string (UUID),
    email: null,
    device_id: string,
    account_type: "anonymous",
    username: null,
    vanity_level: number (0),
    gold: number (500 for new users),
    gems: number (0),
    total_stats: {
      atkPower: number (0),
      atkAccuracy: number (0),
      defPower: number (0),
      defAccuracy: number (0)
    },
    level: number (1),
    xp: number (0),
    created_at: string (ISO),
    last_login: string (ISO)
  },
  session: {
    access_token: string (JWT, 30-day expiry),
    refresh_token: null, // Anonymous users don't get refresh tokens
    expires_in: number (2592000 = 30 days),
    expires_at: number (Unix timestamp),
    token_type: "bearer"
  },
  message: string // "Device registered successfully" | "Device login successful"
}
```

#### Error Responses

**400 Bad Request:**
```typescript
{
  error: {
    code: 'MISSING_DEVICE_ID',
    message: 'Device ID missing or invalid format'
  }
}
```

**500 Internal Server Error:**
```typescript
{
  error: {
    code: 'RACE_CONDITION_FAILED',
    message: 'Concurrent registration race condition'
  }
}
```

**500 Internal Server Error:**
```typescript
{
  error: {
    code: 'USER_CREATION_FAILED',
    message: 'User creation failed'
  }
}
```

**500 Internal Server Error:**
```typescript
{
  error: {
    code: 'INTERNAL_ERROR',
    message: 'General server error'
  }
}
```

#### Service Method Calls
1. `authService.registerDevice({ device_id })`
   - Validates UUID format
   - Checks existing device via Supabase admin client
   - Creates new user or updates last_login
   - Handles race conditions with UNIQUE constraint violations
   - Initializes currency balance (500 GOLD)
   - Generates 30-day JWT tokens

#### Business Logic Flow
1. Validate device_id UUID format
2. Check if device already exists in users table
3. **If existing**: Update last_login, return existing user with new tokens
4. **If new**: Create user record, initialize 500 GOLD balance, return new user
5. **Race condition handling**: UNIQUE constraint violations trigger retry lookup
6. Generate custom JWT tokens (no Supabase session for anonymous users)
7. Return user profile with session data

---

### 2. POST /auth/register

**Purpose**: Email/password registration (post-MVP0 feature)

**Route Handler**: `AuthController.register`
**File Location**: `src/controllers/AuthController.ts:34-79`

#### Input Schema
- **Headers**: None required
- **Params**: None
- **Query**: None
- **Body**: Email/password object (no explicit Zod schema defined yet)
```typescript
{
  email: string (email format),
  password: string (min 8 characters)
}
```

#### Output Schema
**Success (201)**:
```typescript
{
  user: SupabaseUser, // Supabase auth.users format
  session: SupabaseSession, // Supabase session with refresh tokens
  message?: "Registration successful. Please check your email for verification link."
}
```

#### Error Responses

**400 Bad Request:**
```typescript
{
  error: {
    code: 'MISSING_CREDENTIALS',
    message: 'Email or password missing'
  }
}
```

**422 Unprocessable Entity:**
```typescript
{
  error: {
    code: 'WEAK_PASSWORD',
    message: 'Password less than 8 characters'
  }
}
```

**422 Unprocessable Entity:**
```typescript
{
  error: {
    code: 'EMAIL_EXISTS',
    message: 'Email already registered'
  }
}
```

**500 Internal Server Error:**
```typescript
{
  error: {
    code: 'INTERNAL_ERROR',
    message: 'Server error during registration'
  }
}
```

#### Service Method Calls
1. `authService.register({ email, password })`
   - Validates email/password format and length
   - Creates Supabase auth user
   - Creates custom users table profile
   - Initializes currency balance

#### Middleware Chain
- Body parsing
- No validation middleware (manual validation in controller)
- No auth middleware (public endpoint)

---

### 3. POST /auth/login

**Purpose**: Email/password login (post-MVP0 feature)

**Route Handler**: `AuthController.login`
**File Location**: `src/controllers/AuthController.ts:89-124`

#### Input Schema
- **Headers**: None required
- **Params**: None
- **Query**: None
- **Body**: Email/password object
```typescript
{
  email: string (email format),
  password: string
}
```

#### Output Schema
**Success (200)**:
```typescript
{
  user: SupabaseUser, // Supabase auth.users format
  session: SupabaseSession // Supabase session with access/refresh tokens
}
```

#### Error Responses

**400 Bad Request:**
```typescript
{
  error: {
    code: 'MISSING_CREDENTIALS',
    message: 'Email or password missing'
  }
}
```

**401 Unauthorized:**
```typescript
{
  error: {
    code: 'INVALID_CREDENTIALS',
    message: 'Invalid email or password'
  }
}
```

**500 Internal Server Error:**
```typescript
{
  error: {
    code: 'INTERNAL_ERROR',
    message: 'Server error during login'
  }
}
```

#### Service Method Calls
1. `authService.login({ email, password })`
   - Validates credentials via Supabase auth
   - Updates last_login timestamp
   - Returns Supabase user and session

---

### 4. POST /auth/logout

**Purpose**: Revoke user session and cleanup tokens

**Route Handler**: `AuthController.logout`
**File Location**: `src/controllers/AuthController.ts:134-164`

#### Input Schema
- **Headers**: `Authorization: Bearer <access_token>` (required)
- **Params**: None
- **Query**: None
- **Body**: None

#### Output Schema
**Success (200)**:
```typescript
{
  message: "Logout successful"
}
```

#### Error Responses

**401 Unauthorized:**
```typescript
{
  error: {
    code: 'MISSING_TOKEN',
    message: 'Authorization header missing or malformed'
  }
}
```

**500 Internal Server Error:**
```typescript
{
  error: {
    code: 'INTERNAL_ERROR',
    message: 'Server error (non-critical, logout still succeeds)'
  }
}
```

#### Service Method Calls
1. `authService.logout(token)`
   - Revokes session via Supabase admin
   - Errors are non-critical (token may already be invalid)

#### Middleware Chain
- No auth middleware (manual token extraction)
- Manual Authorization header validation

---

### 5. POST /auth/refresh

**Purpose**: Refresh access token using refresh token

**Route Handler**: `AuthController.refresh`
**File Location**: `src/controllers/AuthController.ts:174-209`

#### Input Schema
- **Headers**: None required
- **Params**: None
- **Query**: None
- **Body**: Refresh token object
```typescript
{
  refresh_token: string
}
```

#### Output Schema
**Success (200)**:
```typescript
{
  session: SupabaseSession // New access/refresh tokens
}
```

#### Error Responses

**400 Bad Request:**
```typescript
{
  error: {
    code: 'MISSING_REFRESH_TOKEN',
    message: 'Refresh token missing'
  }
}
```

**401 Unauthorized:**
```typescript
{
  error: {
    code: 'INVALID_REFRESH_TOKEN',
    message: 'Refresh token invalid or expired'
  }
}
```

**500 Internal Server Error:**
```typescript
{
  error: {
    code: 'INTERNAL_ERROR',
    message: 'Server error during refresh'
  }
}
```

#### Service Method Calls
1. `authService.refresh({ refresh_token })`
   - Validates and refreshes session via Supabase
   - Returns new session with updated tokens

---

### 6. POST /auth/reset-password

**Purpose**: Request password reset email

**Route Handler**: `AuthController.resetPassword`
**File Location**: `src/controllers/AuthController.ts:219-245`

#### Input Schema
- **Headers**: None required
- **Params**: None
- **Query**: None
- **Body**: Email object
```typescript
{
  email: string (email format)
}
```

#### Output Schema
**Success (200)**:
```typescript
{
  message: "If an account with that email exists, a password reset link has been sent."
}
```

#### Error Responses

**400 Bad Request:**
```typescript
{
  error: {
    code: 'MISSING_EMAIL',
    message: 'Email missing'
  }
}
```

**500 Internal Server Error:**
```typescript
{
  error: {
    code: 'INTERNAL_ERROR',
    message: 'Server error (returns success message for security)'
  }
}
```

#### Service Method Calls
1. `authService.resetPassword({ email })`
   - Sends reset email via Supabase
   - Always returns success to prevent email enumeration

#### Security Features
- **Email enumeration protection**: Always returns success message regardless of email existence
- **Error suppression**: Real errors logged but not exposed to client

---

### 7. POST /auth/resend-verification

**Purpose**: Resend email verification link

**Route Handler**: `AuthController.resendVerification`
**File Location**: `src/controllers/AuthController.ts:255-281`

#### Input Schema
- **Headers**: None required
- **Params**: None
- **Query**: None
- **Body**: Email object
```typescript
{
  email: string (email format)
}
```

#### Output Schema
**Success (200)**:
```typescript
{
  message: "If an account with that email exists, a verification link has been sent."
}
```

#### Error Responses

**400 Bad Request:**
```typescript
{
  error: {
    code: 'MISSING_EMAIL',
    message: 'Email missing'
  }
}
```

**500 Internal Server Error:**
```typescript
{
  error: {
    code: 'INTERNAL_ERROR',
    message: 'Server error (returns success message for security)'
  }
}
```

#### Service Method Calls
1. `authService.resendVerification({ email })`
   - Resends verification via Supabase
   - Always returns success to prevent email enumeration

#### Security Features
- **Email enumeration protection**: Always returns success message regardless of email existence
- **Error suppression**: Real errors logged but not exposed to client

---

### 8. GET /auth/me

**Purpose**: Get current authenticated user profile

**Route Handler**: `AuthController.getCurrentUser`
**File Location**: `src/controllers/AuthController.ts:347-393`

#### Input Schema
- **Headers**: `Authorization: Bearer <access_token>` (required)
- **Params**: None
- **Query**: None
- **Body**: None

#### Output Schema
**Success (200)**:
```typescript
{
  user: {
    id: string (UUID),
    email: string | null,
    device_id: string | null,
    account_type: "anonymous" | "email",
    username: null, // Users table doesn't have username field
    vanity_level: number,
    gold: number,
    gems: number,
    total_stats: {
      atkPower: number (0), // TODO: Calculate from equipped items
      atkAccuracy: number (0),
      defPower: number (0),
      defAccuracy: number (0)
    },
    level: number (1), // TODO: Calculate from XP
    xp: number (0), // TODO: Get from user profile
    created_at: string (ISO),
    last_login: string (ISO)
  }
}
```

#### Error Responses

**401 Unauthorized:**
```typescript
{
  error: {
    code: 'UNAUTHORIZED',
    message: 'Missing or invalid token, user not found in req.user'
  }
}
```

**404 Not Found:**
```typescript
{
  error: {
    code: 'PROFILE_NOT_FOUND',
    message: 'User ID not found in database'
  }
}
```

**500 Internal Server Error:**
```typescript
{
  error: {
    code: 'INTERNAL_ERROR',
    message: 'Server error retrieving profile'
  }
}
```

#### Service Method Calls
1. `authService.getCurrentUser(user.id)`
   - Gets user profile from ProfileRepository
   - Fetches currency balances
   - Constructs UserProfile response

#### Middleware Chain
- **Auth middleware**: Validates JWT token and populates `req.user`
- Requires user to be authenticated before reaching controller

#### Implementation Notes
- User already validated by auth middleware (`req.user` populated)
- Falls back to error if auth middleware somehow didn't populate user
- Total stats hardcoded to 0 (TODO: calculate from equipped items)
- Level/XP hardcoded to 1/0 (TODO: implement leveling system)

## Common Error Patterns

### Error Mapping
All controllers use standardized error handling:
- `ValidationError` → 400/422 with specific error codes
- `ConflictError` → 422 with conflict-specific codes
- `NotFoundError` → 404 with not found codes
- `BusinessLogicError` → 500 with business logic codes
- Unknown errors → 500 with generic internal_error

### Error Response Format
```typescript
{
  error: {
    code: string, // Standardized error code
    message: string // User-friendly error message
  }
}
```

### Security Considerations
- **Email enumeration protection**: Reset password and resend verification always return success
- **Credential exposure**: All login errors treated as "invalid credentials"
- **Token validation**: Logout continues even if token revocation fails
- **Race condition handling**: Device registration uses database constraints for consistency

## Service Layer Integration

### AuthService Methods Used
1. `registerDevice(request)` - Anonymous device registration
2. `register(request)` - Email registration
3. `login(request)` - Email login
4. `logout(token)` - Session revocation
5. `refresh(request)` - Token refresh
6. `resetPassword(request)` - Password reset email
7. `resendVerification(request)` - Verification email
8. `getCurrentUser(userId)` - User profile retrieval

### ProfileRepository Integration
- Currency balance retrieval via `getAllCurrencyBalances(userId)`
- Last login timestamp updates via `updateLastLogin(userId)`
- User profile lookup via `findUserById(userId)`

## API Contract References

- [API Contracts](../api-contracts.yaml:531-877) - Complete OpenAPI specification
- [F-07 Authentication Feature Spec](../feature-specs/F-07-authentication.yaml) - Feature requirements
- [User Stories US-601, US-602](../user-stories/) - Related user requirements

## Implementation Status

**Complete**: All 8 authentication endpoints implemented with full error handling
**Testing Status**: Unit tests required for each endpoint
**MVP0 Priority**: Device registration (POST /auth/register-device) and profile retrieval (GET /auth/me)
**Post-MVP0**: Email authentication endpoints implemented but not used until multi-device support needed

## Future Enhancements

1. **Total Stats Calculation**: Integrate with EquipmentService to calculate real stats from equipped items
2. **Leveling System**: Implement XP tracking and level calculation
3. **Username Support**: Add username field to users table when profile customization is implemented
4. **Email Linking**: Convert anonymous accounts to email accounts for multi-device support
5. **OAuth Providers**: Add Google/Apple Sign-In for streamlined registration
6. **Account Recovery**: Device-based account recovery mechanisms

## Cross-References

### Dependencies
**Controllers this controller depends on:**
- None (foundation controller - provides authentication for all other controllers)

**Services used:**
- AuthService (core authentication business logic and Supabase integration)
- ProfileRepository (user profile management and currency balances)
- EquipmentService (indirect - for total stats calculation)

### Dependents
**Controllers that use this controller:**
- **ProfileController** (relies on authenticated user sessions from AuthController)
- **CombatController** (requires authenticated users via auth middleware)
- **InventoryController** (requires authenticated users via auth middleware)
- **ItemController** (requires authenticated users via auth middleware)
- **MaterialController** (requires authenticated users via auth middleware)
- **EquipmentController** (requires authenticated users via auth middleware)
- **LoadoutController** (requires authenticated users via auth middleware)
- **EconomyController** (requires authenticated users via auth middleware)
- **ProgressionController** (requires authenticated users via auth middleware)
- **ChatterController** (requires authenticated users via auth middleware)
- **All user-scoped controllers** (depend on JWT authentication provided by AuthController)

### Related Features
- **F-07 Authentication** - Primary feature spec
- **F-09 Inventory Management** - User scoping for all inventory operations
- **System Design** - Authentication architecture section

### Data Models
- Users table (docs/data-plan.yaml:89-109)
- UserCurrencyBalances table (docs/data-plan.yaml:127-139)
- PlayerProgression table (docs/data-plan.yaml:605-626)

### Integration Notes
- **Foundation Role**: AuthController provides the JWT authentication infrastructure that all other user-scoped controllers depend on via auth middleware
- **Profile Initialization**: Device registration triggers ProfileController initialization via service layer
- **Session Management**: Provides session tokens consumed by all authenticated endpoints