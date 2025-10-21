# Auth Service Specification

## Feature References
- Feature: F-07 Authentication
- Related User Stories: US-601 (User Registration), US-602 (User Login)
- API Endpoints: /auth/* endpoints (POST /auth/register-device, POST /auth/register, POST /auth/login, POST /auth/logout, POST /auth/refresh, POST /auth/reset-password, POST /auth/resend-verification, GET /auth/me)

## Repository Dependencies
- ProfileRepository (user CRUD, device tokens, currency initialization)

## AuthController Methods

### 1. registerDevice()
- **Route**: POST /auth/register-device
- **Description**: Auto-register iOS device UUID for anonymous authentication with 30-day JWT tokens
- **Input Schema** (Zod):
  ```typescript
  RegisterDeviceBodySchema = z.object({
    device_id: z.string().uuid('Device ID must be a valid UUID')
  })
  ```
- **Output Schema**:
  ```typescript
  {
    user: { id, device_id, account_type: 'anonymous', created_at, last_login, vanity_level, avg_item_level },
    session: { access_token, refresh_token: null, expires_in: 2592000, expires_at, token_type: 'bearer' },
    message: 'Device registered successfully' | 'Device login successful'
  }
  ```
- **Service Method Called**: Direct repository operations (no separate AuthService)
- **HTTP Status**: 201 (new user), 200 (existing user), 409 (handled as re-login)

### 2. register()
- **Route**: POST /auth/register
- **Description**: Register new user with email/password via Supabase Auth (post-MVP0)
- **Input Schema** (Zod):
  ```typescript
  RegisterEmailSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8)
  })
  ```
- **Output Schema**:
  ```typescript
  {
    user: SupabaseUser,
    session: { access_token, refresh_token, expires_in },
    message: 'Registration successful. Please check your email for verification link.'
  }
  ```
- **Service Method Called**: Direct Supabase Auth operations
- **HTTP Status**: 201 (success), 400 (validation), 422 (email exists/weak password)

### 3. login()
- **Route**: POST /auth/login
- **Description**: Login with email/password via Supabase Auth (post-MVP0)
- **Input Schema** (Zod):
  ```typescript
  LoginSchema = z.object({
    email: z.string().email(),
    password: z.string()
  })
  ```
- **Output Schema**:
  ```typescript
  {
    user: SupabaseUser,
    session: { access_token, refresh_token, expires_in }
  }
  ```
- **Service Method Called**: Direct Supabase Auth operations
- **HTTP Status**: 200 (success), 401 (invalid credentials)

### 4. logout()
- **Route**: POST /auth/logout
- **Description**: Revoke session and logout
- **Input Schema**: Authorization header with Bearer token
- **Output Schema**:
  ```typescript
  {
    message: 'Logout successful'
  }
  ```
- **Service Method Called**: Direct Supabase Auth operations
- **HTTP Status**: 200 (success), 401 (missing/invalid token)

### 5. refresh()
- **Route**: POST /auth/refresh
- **Description**: Refresh access token using refresh token (email accounts only)
- **Input Schema** (Zod):
  ```typescript
  RefreshTokenSchema = z.object({
    refresh_token: z.string()
  })
  ```
- **Output Schema**:
  ```typescript
  {
    session: { access_token, refresh_token, expires_in }
  }
  ```
- **Service Method Called**: Direct Supabase Auth operations
- **HTTP Status**: 200 (success), 401 (invalid refresh token)

### 6. resetPassword()
- **Route**: POST /auth/reset-password
- **Description**: Request password reset email (email accounts only)
- **Input Schema** (Zod):
  ```typescript
  ResetPasswordSchema = z.object({
    email: z.string().email()
  })
  ```
- **Output Schema**:
  ```typescript
  {
    message: 'If an account with that email exists, a password reset link has been sent.'
  }
  ```
- **Service Method Called**: Direct Supabase Auth operations
- **HTTP Status**: 200 (always, security via email enumeration prevention)

### 7. resendVerification()
- **Route**: POST /auth/resend-verification
- **Description**: Resend email verification link (email accounts only)
- **Input Schema** (Zod):
  ```typescript
  ResendVerificationSchema = z.object({
    email: z.string().email()
  })
  ```
- **Output Schema**:
  ```typescript
  {
    message: 'If an account with that email exists, a verification link has been sent.'
  }
  ```
- **Service Method Called**: Direct Supabase Auth operations
- **HTTP Status**: 200 (always, security via email enumeration prevention)

### 8. getCurrentUser()
- **Route**: GET /auth/me
- **Description**: Get current user profile (requires authentication)
- **Input Schema**: Authorization header with Bearer token
- **Output Schema**:
  ```typescript
  {
    user: { id, email, device_id, account_type, created_at, last_login, vanity_level, avg_item_level }
  }
  ```
- **Service Method Called**: ProfileRepository.findUserById()
- **HTTP Status**: 200 (success), 401 (unauthorized), 404 (profile not found)

## AuthService Methods

**NOTE**: No separate AuthService class exists. AuthController directly integrates:
- Supabase Auth operations (email authentication)
- ProfileRepository operations (user profile management)
- Custom JWT generation (device authentication)

### Business Logic Flow for Device Registration

**registerDevice() Implementation Details**:
- **Repository Methods Used**:
  - Direct database query to lookup existing device user
  - Direct database insert for new anonymous user
  - Direct UserCurrencyBalances initialization (500 GOLD)
  - ProfileRepository.updateLastLogin() for existing users
- **Business Logic**:
  - Validate device_id UUID format (via Zod middleware)
  - Check if device already registered (user_id + device_id lookup)
  - If existing: Update last_login, generate new 30-day JWT
  - If new: Create Users row with account_type='anonymous', initialize UserCurrencyBalances(500 GOLD)
  - Handle race conditions with UNIQUE constraint violations
  - Generate custom JWT tokens (30-day TTL) using generateAnonymousToken()
- **Input**: deviceId: string (UUID)
- **Output**: { user: User, session: { access_token, expires_in, expires_at } }
- **Error Cases**:
  - Invalid UUID format → 400 ValidationError (handled by middleware)
  - Database constraint violations → 500 with race condition handling
  - User creation failure → 500 DatabaseError

### Business Logic Flow for Email Authentication

**register() Implementation Details**:
- **Supabase Operations**:
  - supabaseAuth.auth.signUp({ email, password })
  - Create custom Users profile row (id from Supabase Auth UUID)
  - Initialize UserCurrencyBalances (500 GOLD)
- **Error Handling**:
  - Password < 8 chars → 422 ValidationError
  - Email already exists → 422 with specific error code
  - Profile creation failure → Log error, continue (non-critical)

**login() Implementation Details**:
- **Supabase Operations**:
  - supabaseAuth.auth.signInWithPassword({ email, password })
  - Update Users.last_login timestamp
- **Error Handling**:
  - All auth failures → 401 'Invalid email or password' (security)

## Required Zod Schemas (already exist in schemas.ts)

```typescript
export const RegisterDeviceBodySchema = z.object({
  device_id: z.string().uuid('Device ID must be a valid UUID')
});

// Email auth schemas (post-MVP0):
export const RegisterEmailSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

export const RefreshTokenSchema = z.object({
  refresh_token: z.string()
});

export const ResetPasswordSchema = z.object({
  email: z.string().email()
});

export const ResendVerificationSchema = z.object({
  email: z.string().email()
});

// Type exports for auth
export type RegisterDeviceRequest = z.infer<typeof RegisterDeviceBodySchema>;
export type RegisterEmailRequest = z.infer<typeof RegisterEmailSchema>;
export type LoginRequest = z.infer<typeof LoginSchema>;
export type RefreshTokenRequest = z.infer<typeof RefreshTokenSchema>;
export type ResetPasswordRequest = z.infer<typeof ResetPasswordSchema>;
export type ResendVerificationRequest = z.infer<typeof ResendVerificationSchema>;
```

## Implementation Status

**✅ COMPLETE**:
- AuthController with all 8 methods implemented
- Device registration with 30-day JWT tokens
- Email registration/login via Supabase Auth
- Password reset and email verification flows
- Currency initialization (500 GOLD for new users)
- Race condition handling for concurrent device registration
- Error handling with proper HTTP status codes
- Security measures (email enumeration prevention)

**✅ AVAILABLE**:
- ProfileRepository with user operations
- RegisterDeviceBodySchema in schemas.ts
- JWT middleware for token validation
- Custom JWT generation for anonymous users

**📋 TODO** (Post-MVP0):
- Add remaining email auth Zod schemas to schemas.ts
- Email linking for converting anonymous → email accounts
- Multi-device support for email accounts
- Account recovery flows

## Notes
- **MVP0 Priority**: Device auth only, email auth deferred to post-MVP0
- **JWT Token Strategy**: 30-day single tokens for device auth (no refresh), standard Supabase tokens for email auth
- **Database**: Users table supports both account types with device_id field for anonymous users
- **Security**: Device loss = account loss (acceptable MVP0 limitation)
- **Currency**: All new users start with 500 GOLD balance
- **Error Philosophy**: Log detailed errors server-side, return user-friendly messages client-side
- **Race Conditions**: Handled via UNIQUE constraints with graceful fallback logic
- **Email Enumeration**: Prevented by always returning success for reset/verification requests