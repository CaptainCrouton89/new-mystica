# Supabase Express Authentication Guide (2025)

LLM-optimized reference for implementing Supabase authentication in Express.js/Node.js TypeScript backends.

**Last Updated:** 2025-10-21
**Supabase Auth Version:** Latest (asymmetric JWT support, getClaims() method)
**Target Framework:** Express.js + TypeScript

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Client Configuration](#client-configuration)
3. [JWT Validation Strategies](#jwt-validation-strategies)
4. [Middleware Patterns](#middleware-patterns)
5. [Session Management](#session-management)
6. [RLS Integration](#rls-integration)
7. [Error Handling](#error-handling)
8. [Security Best Practices](#security-best-practices)
9. [TypeScript Types](#typescript-types)

---

## Quick Start

### Environment Variables

```bash
# Required
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...          # Public anon key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...  # NEVER expose to client
SUPABASE_JWT_SECRET=your-secret       # For HS256 (legacy)
```

### Basic Server Setup

```typescript
import { createClient } from '@supabase/supabase-js'
import express from 'express'

const app = express()

// Client for user requests (with JWT)
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  }
)

// Admin client (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  }
)
```

**Critical:** Always disable `autoRefreshToken`, `persistSession`, and `detectSessionInUrl` on server-side clients.

---

## Client Configuration

### Server-Side Client Options

```typescript
interface SupabaseAuthOptions {
  auth: {
    autoRefreshToken: boolean    // FALSE on server (no auto-refresh)
    persistSession: boolean       // FALSE on server (no localStorage)
    detectSessionInUrl: boolean   // FALSE on server (no URL detection)
    flowType?: 'pkce' | 'implicit' // Use 'pkce' for SSR/server flows
  }
}
```

### Two-Client Pattern (Recommended)

```typescript
// 1. User-scoped client (respects RLS)
export function createUserClient(accessToken: string) {
  const client = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    }
  )
  return client
}

// 2. Admin client (bypasses RLS)
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
  }
)
```

**When to use each:**
- **User client:** User-facing endpoints where RLS policies should apply
- **Admin client:** System operations, webhooks, admin endpoints (NEVER expose service key)

---

## JWT Validation Strategies

### Strategy Comparison (2025)

| Method | Network Call | Performance | Security | Recommended |
|--------|--------------|-------------|----------|-------------|
| `getUser()` | ✅ Always | Slow (~100-500ms) | Highest | Legacy/high-security |
| `getClaims()` (Asymmetric) | ❌ JWKS cached | Fast (~5-10ms) | High | **✅ BEST for 2025** |
| `getClaims()` (Symmetric) | ✅ Fallback to getUser() | Medium | High | Transitional |
| Manual `jose` verify | ❌ Local only | Fastest (~1-2ms) | High (if correct) | Advanced use cases |

### 1. getUser() - Traditional Approach (Slow)

```typescript
import { SupabaseClient } from '@supabase/supabase-js'

async function validateWithGetUser(token: string): Promise<User | null> {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  )

  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    return null
  }

  return user
}
```

**Issues:**
- Makes HTTP request to Supabase Auth server on **every request**
- Adds 100-500ms latency (network-dependent)
- Can cause "noticeable lag, especially on slow networks" (GitHub #20905)
- Rate limit concerns at scale

**When to use:**
- High-security operations requiring real-time revocation checks
- Legacy codebases not yet migrated to asymmetric keys

### 2. getClaims() - Modern Approach (RECOMMENDED 2025)

```typescript
async function validateWithGetClaims(token: string) {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  )

  const { data, error } = await supabase.auth.getClaims(token)

  if (error || !data) {
    throw new Error('Invalid token')
  }

  return data // Contains all JWT claims
}
```

**Behavior:**
- **Asymmetric keys (RS256/ECC):** Verifies JWT locally using cached JWKS endpoint (fast)
- **Symmetric keys (HS256):** Falls back to `getUser()` (slow)
- Supabase projects created after Q4 2024 use asymmetric keys by default

**Advantages:**
- 10-100x faster than `getUser()` with asymmetric keys
- No network call for JWT verification (JWKS cached)
- Maintains security through signature validation

### 3. Manual Verification with `jose` Library

```typescript
import { jwtVerify, createRemoteJWKSet } from 'jose'

// Initialize once (cache JWKS)
const PROJECT_JWKS = createRemoteJWKSet(
  new URL(`${process.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`)
)

async function verifyProjectJWT(token: string) {
  try {
    const { payload } = await jwtVerify(token, PROJECT_JWKS, {
      issuer: `${process.env.SUPABASE_URL}/auth/v1`,
      audience: 'authenticated'
    })

    return payload
  } catch (err) {
    throw new Error('JWT verification failed')
  }
}
```

**Use cases:**
- Maximum performance requirements
- Custom JWT validation logic
- Projects with asymmetric keys

**Legacy HS256 (symmetric) approach:**

```typescript
import * as jose from 'jose'

async function verifyHS256JWT(token: string) {
  const secret = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET!)

  const { payload } = await jose.jwtVerify(token, secret, {
    issuer: `${process.env.SUPABASE_URL}/auth/v1`,
    audience: 'authenticated',
    algorithms: ['HS256']
  })

  return payload
}
```

**Warning:** HS256 requires exposing JWT secret to all services. Use asymmetric keys for multi-service architectures.

---

## Middleware Patterns

### Production-Ready Auth Middleware

```typescript
import { Request, Response, NextFunction } from 'express'
import { createClient } from '@supabase/supabase-js'

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string
        email?: string
        role: string
        aud: string
        session_id: string
      }
    }
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' })
    }

    const token = authHeader.substring(7) // Remove "Bearer "

    // Validate token using getClaims (fast with asymmetric keys)
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      {
        auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
      }
    )

    const { data, error } = await supabase.auth.getClaims(token)

    if (error || !data) {
      return res.status(401).json({ error: 'Invalid or expired token' })
    }

    // Attach user info to request
    req.user = {
      id: data.sub,
      email: data.email,
      role: data.role,
      aud: data.aud,
      session_id: data.session_id
    }

    next()
  } catch (err) {
    console.error('Auth middleware error:', err)
    return res.status(500).json({ error: 'Authentication failed' })
  }
}
```

### Optional Auth Middleware

```typescript
export async function optionalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No token provided - continue without user
    return next()
  }

  try {
    const token = authHeader.substring(7)
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } }
    )

    const { data } = await supabase.auth.getClaims(token)

    if (data) {
      req.user = {
        id: data.sub,
        email: data.email,
        role: data.role,
        aud: data.aud,
        session_id: data.session_id
      }
    }
  } catch (err) {
    // Silently fail for optional auth
    console.warn('Optional auth failed:', err)
  }

  next()
}
```

### Role-Based Authorization Middleware

```typescript
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' })
    }

    next()
  }
}

// Usage
app.get('/admin/users', authMiddleware, requireRole('service_role'), async (req, res) => {
  // Admin-only endpoint
})
```

### High-Performance Middleware with jose

```typescript
import { jwtVerify, createRemoteJWKSet } from 'jose'

const PROJECT_JWKS = createRemoteJWKSet(
  new URL(`${process.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`)
)

export async function fastAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization header' })
    }

    const token = authHeader.substring(7)

    const { payload } = await jwtVerify(token, PROJECT_JWKS, {
      issuer: `${process.env.SUPABASE_URL}/auth/v1`,
      audience: 'authenticated'
    })

    req.user = {
      id: payload.sub!,
      email: payload.email as string,
      role: payload.role as string,
      aud: payload.aud as string,
      session_id: payload.session_id as string
    }

    next()
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' })
  }
}
```

---

## Session Management

### Session Lifecycle

1. **Creation:** User signs in → Supabase issues access token (JWT) + refresh token
2. **Access Token:** Short-lived (default 1 hour), contains user claims
3. **Refresh Token:** Long-lived (can be infinite), single-use with 10s reuse window
4. **Expiration:** Access token expires → Client must refresh using refresh token
5. **Termination:** User signs out, changes password, or session reaches max lifetime

### Token Structure

```typescript
interface SupabaseSession {
  access_token: string    // JWT (1 hour default)
  refresh_token: string   // Single-use, long-lived
  expires_in: number      // Seconds until access_token expires
  expires_at?: number     // Unix timestamp of expiration
  token_type: 'bearer'
  user: User
}
```

### Client-Side Token Refresh Flow

**Important:** Supabase client libraries handle automatic refresh. For Express backends, token refresh is **client-side responsibility**.

```typescript
// Client sends request with expired token
// → Server returns 401
// → Client refreshes token
// → Client retries request with new token

// Example client-side refresh (NOT server-side)
const { data, error } = await supabase.auth.refreshSession()
if (data.session) {
  // Use new access_token
}
```

### Server-Side: Never Trust getSession()

```typescript
// ❌ DANGEROUS: getSession() doesn't revalidate
const { data: { session } } = await supabase.auth.getSession()
// Session may be expired or revoked!

// ✅ SAFE: getUser() or getClaims() validates token
const { data: { user } } = await supabase.auth.getUser(token)
// Token verified against Auth server

// ✅ BEST (2025): getClaims() with asymmetric keys
const { data } = await supabase.auth.getClaims(token)
// Fast local verification with JWKS
```

**Rule:** On server, **always validate tokens** - never trust client-provided session state.

### Session Configuration (Pro Plan)

```typescript
// Advanced session controls (requires Pro plan)
const { data, error } = await supabase.auth.updateUser({
  data: {
    session_timeout: 3600,           // 1 hour inactivity timeout
    session_max_lifetime: 86400,     // 24 hour max session
    single_session_per_user: true    // Limit to one active session
  }
})
```

---

## RLS Integration

### How RLS Works with JWT

1. Client sends request with JWT in `Authorization: Bearer <token>` header
2. Supabase automatically extracts JWT and makes claims available in Postgres
3. RLS policies access JWT claims via `auth.uid()` and `auth.jwt()` functions
4. Database enforces row-level access based on policy evaluation

### Accessing JWT Claims in RLS Policies

```sql
-- Get current user ID
auth.uid() -- Returns UUID from JWT 'sub' claim

-- Get full JWT payload
auth.jwt() -- Returns JSONB with all claims

-- Example: User can only see their own records
CREATE POLICY "Users can view own records"
ON public.users
FOR SELECT
USING (auth.uid() = id);

-- Example: Check user role
CREATE POLICY "Admins can view all"
ON public.users
FOR SELECT
USING (
  auth.jwt() ->> 'role' = 'service_role'
  OR auth.uid() = id
);

-- Example: Check custom claim
CREATE POLICY "Premium users only"
ON public.premium_content
FOR SELECT
USING (
  auth.jwt() -> 'app_metadata' ->> 'is_premium' = 'true'
);
```

### Available JWT Functions in Postgres

```sql
-- User ID (most common)
auth.uid() -> UUID

-- Full JWT payload
auth.jwt() -> JSONB

-- Role
auth.jwt() ->> 'role' -> TEXT ('authenticated', 'anon', 'service_role')

-- Email
auth.jwt() ->> 'email' -> TEXT

-- Session ID
auth.jwt() ->> 'session_id' -> TEXT

-- App metadata (safe for authorization)
auth.jwt() -> 'app_metadata' -> JSONB

-- User metadata (NOT recommended for authorization)
auth.jwt() -> 'user_metadata' -> JSONB
```

### Service Role Bypass Pattern

```typescript
// Scenario: Webhook from Stripe (no user JWT)
app.post('/webhooks/stripe', async (req, res) => {
  // Verify Stripe signature first
  const event = verifyStripeWebhook(req.body, req.headers['stripe-signature'])

  // Use admin client to bypass RLS
  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .update({ status: event.data.status })
    .eq('stripe_customer_id', event.data.customer)

  if (error) throw error

  res.json({ received: true })
})
```

**Security:** Service role key **completely bypasses RLS**. Only use for:
- Webhooks (no user context)
- Admin operations
- System tasks
- Background jobs

**Never:**
- Expose service key to clients
- Use service key for user-facing endpoints
- Pass service key in client-side code

### RLS Best Practices

1. **Enable RLS on all public tables:**
```sql
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
```

2. **Explicit auth checks (prevent null injection):**
```sql
-- ❌ Vulnerable to auth.uid() = NULL
USING (auth.uid() = user_id)

-- ✅ Safe
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id)
```

3. **Use app_metadata for authorization:**
```typescript
// Update user's app_metadata (admin only)
await supabaseAdmin.auth.admin.updateUserById(userId, {
  app_metadata: { role: 'admin', tier: 'premium' }
})

// Policy checks app_metadata
CREATE POLICY "Admins only"
USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');
```

4. **Index columns used in policies:**
```sql
CREATE INDEX idx_users_user_id ON public.items(user_id);
```

5. **Minimize joins in policies:**
```sql
-- ❌ Slow: joins in policy
USING (
  auth.uid() IN (
    SELECT user_id FROM team_members WHERE team_id = teams.id
  )
)

-- ✅ Fast: denormalized column
USING (auth.uid() = ANY(team_member_ids))
```

---

## Error Handling

### Error Classes

```typescript
import { AuthError, isAuthApiError } from '@supabase/supabase-js'

try {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'user@example.com',
    password: 'wrong-password'
  })

  if (error) throw error

} catch (error) {
  if (error instanceof AuthError) {
    // Supabase auth error
    console.log('Error code:', error.code)
    console.log('Error name:', error.name)
    console.log('Error message:', error.message)
    console.log('HTTP status:', error.status)
  }

  if (isAuthApiError(error)) {
    // Error from Supabase Auth API
    switch (error.code) {
      case 'invalid_credentials':
        return res.status(401).json({ error: 'Invalid email or password' })
      case 'email_not_confirmed':
        return res.status(403).json({ error: 'Please confirm your email' })
      case 'over_request_rate_limit':
        return res.status(429).json({ error: 'Too many requests' })
      default:
        return res.status(error.status || 500).json({ error: error.message })
    }
  }
}
```

### Common Error Codes

| Code | HTTP | Meaning | Handling |
|------|------|---------|----------|
| `invalid_credentials` | 401 | Wrong email/password | Ask user to retry |
| `email_not_confirmed` | 403 | Email not verified | Send confirmation email |
| `user_not_found` | 404 | User doesn't exist | Treat as invalid credentials |
| `email_exists` | 422 | Email already registered | Suggest password reset |
| `weak_password` | 422 | Password too weak | Show requirements |
| `over_request_rate_limit` | 429 | Rate limit exceeded | Add exponential backoff |
| `bad_oauth_callback` | 400 | OAuth flow error | Restart OAuth flow |
| `anonymous_provider_disabled` | 403 | Anonymous auth disabled | Show sign-up form |

### HTTP Status Codes

- **401 Unauthorized:** Invalid or expired token
- **403 Forbidden:** Valid token but insufficient permissions (e.g., feature disabled)
- **422 Unprocessable Entity:** Request validation failed
- **429 Too Many Requests:** Rate limits exceeded
- **500 Internal Server Error:** Supabase service issue
- **501 Not Implemented:** Feature not enabled in project settings

### Express Error Handler

```typescript
import { AuthError } from '@supabase/supabase-js'

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof AuthError) {
    return res.status(err.status || 500).json({
      error: {
        code: err.code,
        message: err.message,
        name: err.name
      }
    })
  }

  // Generic error
  res.status(500).json({ error: 'Internal server error' })
})
```

### Middleware Error Patterns

```typescript
export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const token = extractToken(req)

    if (!token) {
      return res.status(401).json({
        error: { code: 'missing_token', message: 'Authorization header required' }
      })
    }

    const { data, error } = await supabase.auth.getClaims(token)

    if (error) {
      // Token validation failed
      return res.status(401).json({
        error: { code: 'invalid_token', message: 'Token validation failed' }
      })
    }

    if (!data) {
      return res.status(401).json({
        error: { code: 'no_user', message: 'User not found' }
      })
    }

    // Check token expiration
    if (data.exp && data.exp < Date.now() / 1000) {
      return res.status(401).json({
        error: { code: 'token_expired', message: 'Token has expired' }
      })
    }

    req.user = {
      id: data.sub,
      email: data.email,
      role: data.role,
      aud: data.aud,
      session_id: data.session_id
    }

    next()
  } catch (err) {
    console.error('Auth middleware error:', err)
    return res.status(500).json({
      error: { code: 'auth_error', message: 'Authentication failed' }
    })
  }
}
```

---

## Security Best Practices

### 1. Environment Variables

```bash
# ✅ Required server-side only
SUPABASE_SERVICE_ROLE_KEY=...  # NEVER expose to client
SUPABASE_JWT_SECRET=...        # For HS256 verification (legacy)

# ✅ Safe to expose (but use server-side)
SUPABASE_URL=...
SUPABASE_ANON_KEY=...          # Public, limited by RLS
```

**Never:**
- Commit `.env` files to git
- Use `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` or similar
- Log service role keys
- Pass service keys in URLs or query params

### 2. Token Validation

```typescript
// ❌ NEVER trust client-provided session
const session = req.body.session
const userId = session.user.id  // Can be forged!

// ✅ ALWAYS validate token server-side
const token = req.headers.authorization?.substring(7)
const { data } = await supabase.auth.getClaims(token!)
const userId = data.sub  // Verified by signature
```

### 3. HTTPS Only

```typescript
// Enforce HTTPS in production
if (process.env.NODE_ENV === 'production' && req.protocol !== 'https') {
  return res.redirect(301, `https://${req.hostname}${req.url}`)
}
```

### 4. CORS Configuration

```typescript
import cors from 'cors'

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))
```

### 5. Rate Limiting

```typescript
import rateLimit from 'express-rate-limit'

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: { error: 'Too many authentication attempts' },
  standardHeaders: true,
  legacyHeaders: false
})

app.post('/auth/login', authLimiter, loginHandler)
```

### 6. Token Rotation

```typescript
// Supabase handles token rotation automatically
// Refresh tokens are single-use with 10s reuse window
// No manual rotation needed on server side
```

### 7. Logging & Monitoring

```typescript
// Log auth events (NOT tokens!)
console.log('User authenticated:', {
  userId: user.id,
  email: user.email,
  timestamp: new Date().toISOString(),
  ip: req.ip,
  userAgent: req.headers['user-agent']
})

// ❌ NEVER log tokens
console.log('Token:', token)  // DANGEROUS!
```

### 8. Security Headers

```typescript
import helmet from 'helmet'

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", process.env.SUPABASE_URL!]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}))
```

---

## TypeScript Types

### JWT Claims Interface

```typescript
interface SupabaseJWTClaims {
  // Required claims
  iss: string              // Issuer: "https://xxx.supabase.co/auth/v1"
  sub: string              // Subject: User UUID
  aud: string              // Audience: "authenticated" | "anon"
  exp: number              // Expiration: Unix timestamp
  iat: number              // Issued at: Unix timestamp
  role: string             // Role: "authenticated" | "anon" | "service_role"

  // Session claims
  session_id: string       // Unique session identifier
  aal: 'aal1' | 'aal2'     // Authenticator Assurance Level

  // User claims
  email?: string           // User email
  phone?: string           // User phone
  is_anonymous?: boolean   // Anonymous user flag

  // Metadata
  app_metadata?: {         // Server-controlled metadata (safe for auth)
    provider?: string
    [key: string]: any
  }
  user_metadata?: {        // User-controlled metadata (UNSAFE for auth)
    [key: string]: any
  }

  // Authentication methods
  amr?: Array<{            // Authentication Method Reference
    method: string
    timestamp: number
  }>

  // Optional claims
  jti?: string             // JWT ID
  nbf?: number             // Not before
  ref?: string             // Project reference (anon/service_role only)
}
```

### Express Request Extensions

```typescript
import { User } from '@supabase/supabase-js'

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string
        email?: string
        role: string
        aud: string
        session_id: string
      }
    }
  }
}
```

### Auth Response Types

```typescript
import { User, Session, AuthError } from '@supabase/supabase-js'

interface AuthResponse {
  data: {
    user: User | null
    session: Session | null
  }
  error: AuthError | null
}

interface UserResponse {
  data: {
    user: User | null
  }
  error: AuthError | null
}

interface ClaimsResponse {
  data: SupabaseJWTClaims | null
  error: AuthError | null
}
```

### Service Definitions

```typescript
import { SupabaseClient } from '@supabase/supabase-js'

export class AuthService {
  constructor(
    private supabase: SupabaseClient,
    private supabaseAdmin: SupabaseClient
  ) {}

  async validateToken(token: string): Promise<SupabaseJWTClaims> {
    const { data, error } = await this.supabase.auth.getClaims(token)

    if (error || !data) {
      throw new Error('Invalid token')
    }

    return data
  }

  async getUserById(userId: string): Promise<User> {
    const { data, error } = await this.supabaseAdmin.auth.admin.getUserById(userId)

    if (error || !data.user) {
      throw new Error('User not found')
    }

    return data.user
  }

  async updateUserMetadata(userId: string, metadata: Record<string, any>): Promise<void> {
    const { error } = await this.supabaseAdmin.auth.admin.updateUserById(userId, {
      app_metadata: metadata
    })

    if (error) throw error
  }
}
```

---

## Common Gotchas & Constraints

### 1. getUser() vs getClaims() Performance

**Problem:** Using `getUser()` in middleware causes 100-500ms latency per request.

**Solution:** Use `getClaims()` with asymmetric keys (RS256) for ~10ms validation.

```typescript
// ❌ Slow (makes HTTP request)
const { data: { user } } = await supabase.auth.getUser(token)

// ✅ Fast (JWKS cached locally)
const { data } = await supabase.auth.getClaims(token)
```

### 2. Service Role RLS Bypass

**Problem:** Using service role key client for user queries exposes all data.

**Solution:** Use two-client pattern - user client for RLS-protected queries, admin client only when necessary.

```typescript
// ❌ Exposes all users (bypasses RLS)
const { data } = await supabaseAdmin.from('users').select()

// ✅ Respects RLS policies
const userClient = createUserClient(token)
const { data } = await userClient.from('users').select()
```

### 3. Token Expiration Handling

**Problem:** Access tokens expire after 1 hour, causing 401 errors.

**Solution:** Let client handle refresh, server just returns 401. Client refreshes and retries.

```typescript
// Server: Just return 401
if (data.exp < Date.now() / 1000) {
  return res.status(401).json({ error: 'token_expired' })
}

// Client handles refresh (not server's job)
```

### 4. Null auth.uid() in Policies

**Problem:** Unauthenticated requests have `auth.uid() = NULL`, which can match NULL columns.

**Solution:** Always check `IS NOT NULL` first.

```sql
-- ❌ Vulnerable
USING (auth.uid() = user_id)

-- ✅ Safe
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id)
```

### 5. User Metadata in Authorization

**Problem:** `user_metadata` is user-controlled and can be modified by clients.

**Solution:** Use `app_metadata` for authorization decisions (server-controlled).

```sql
-- ❌ Unsafe (user can modify)
USING (auth.jwt() -> 'user_metadata' ->> 'is_admin' = 'true')

-- ✅ Safe (only server can modify)
USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
```

### 6. Session Persistence on Server

**Problem:** Trying to use `persistSession: true` on server causes errors (no localStorage).

**Solution:** Always set `persistSession: false` for server-side clients.

```typescript
// ✅ Correct server config
const supabase = createClient(url, key, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
})
```

### 7. Asymmetric vs Symmetric Keys

**Problem:** Legacy projects use HS256 (symmetric), requiring JWT secret exposure.

**Solution:** Migrate to RS256 (asymmetric) for better security and performance.

```typescript
// Check your project's signing algorithm
// Dashboard → Settings → API → JWT Settings → "Signing algorithm"

// RS256 (asymmetric) - recommended
// - Use getClaims() or jose with JWKS endpoint
// - No secret exposure needed

// HS256 (symmetric) - legacy
// - Requires SUPABASE_JWT_SECRET
// - Must share secret across services
```

### 8. JWKS Caching

**Problem:** `jose` library caches JWKS, can cause issues with key rotation.

**Solution:** JWKS cache automatically refreshes on key rotation. No manual cache management needed.

```typescript
// jose handles cache automatically
const JWKS = createRemoteJWKSet(new URL('.../.well-known/jwks.json'))
// Cache refreshes when keys rotate
```

---

## Migration Path: Legacy to Modern (2025)

### Step 1: Identify Current Setup

```bash
# Check project signing algorithm
# Dashboard → Settings → API → JWT Settings
# - HS256 (symmetric) = legacy
# - RS256 (asymmetric) = modern
```

### Step 2: Update to getClaims()

```typescript
// Before (slow)
const { data: { user } } = await supabase.auth.getUser(token)

// After (fast)
const { data } = await supabase.auth.getClaims(token)
const user = {
  id: data.sub,
  email: data.email,
  // ... other fields from claims
}
```

### Step 3: Enable Asymmetric Keys (if needed)

```bash
# Dashboard → Settings → API → JWT Settings
# → Change "Signing algorithm" to RS256
# → Save and regenerate keys
```

### Step 4: Update Middleware

```typescript
// Replace getUser() calls with getClaims()
// Update type definitions to use JWT claims
// Test thoroughly in staging
```

### Step 5: Monitor Performance

```typescript
// Add timing logs
const start = Date.now()
const { data } = await supabase.auth.getClaims(token)
console.log(`Token validation: ${Date.now() - start}ms`)
// Should see ~5-15ms with asymmetric keys
```

---

## Complete Example: Production Express App

```typescript
import express from 'express'
import { createClient } from '@supabase/supabase-js'
import { jwtVerify, createRemoteJWKSet } from 'jose'
import helmet from 'helmet'
import cors from 'cors'

const app = express()

// Security middleware
app.use(helmet())
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(','),
  credentials: true
}))
app.use(express.json())

// Supabase clients
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  }
)

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  }
)

// JWKS for fast JWT verification
const PROJECT_JWKS = createRemoteJWKSet(
  new URL(`${process.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`)
)

// Auth middleware using getClaims (recommended)
async function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization header' })
    }

    const token = authHeader.substring(7)

    const { data, error } = await supabase.auth.getClaims(token)

    if (error || !data) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    req.user = {
      id: data.sub,
      email: data.email,
      role: data.role,
      aud: data.aud,
      session_id: data.session_id
    }

    next()
  } catch (err) {
    console.error('Auth error:', err)
    return res.status(500).json({ error: 'Authentication failed' })
  }
}

// Fast auth middleware using jose (maximum performance)
async function fastAuthMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization header' })
    }

    const token = authHeader.substring(7)

    const { payload } = await jwtVerify(token, PROJECT_JWKS, {
      issuer: `${process.env.SUPABASE_URL}/auth/v1`,
      audience: 'authenticated'
    })

    req.user = {
      id: payload.sub!,
      email: payload.email as string,
      role: payload.role as string,
      aud: payload.aud as string,
      session_id: payload.session_id as string
    }

    next()
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

// Protected route
app.get('/api/profile', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.user!.id)
      .single()

    if (error) throw error

    res.json(data)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' })
  }
})

// Admin-only route
app.get('/api/admin/users', authMiddleware, async (req, res) => {
  if (req.user!.role !== 'service_role') {
    return res.status(403).json({ error: 'Admin access required' })
  }

  try {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers()

    if (error) throw error

    res.json(data.users)
  } catch (err) {
    res.status(500).json({ error: 'Failed to list users' })
  }
})

// Webhook (bypasses RLS)
app.post('/webhooks/stripe', async (req, res) => {
  // Verify Stripe signature first
  // ...

  try {
    const { error } = await supabaseAdmin
      .from('subscriptions')
      .update({ status: 'active' })
      .eq('stripe_customer_id', req.body.customer)

    if (error) throw error

    res.json({ received: true })
  } catch (err) {
    res.status(500).json({ error: 'Webhook processing failed' })
  }
})

app.listen(3000, () => {
  console.log('Server running on port 3000')
})
```

---

## Quick Reference

### Decision Tree: Which Validation Method?

```
Need authentication validation?
├─ Maximum performance required? → jose library with JWKS
├─ Standard performance OK? → getClaims()
├─ Need real-time revocation? → getUser()
└─ Legacy HS256 project? → jose with JWT_SECRET or getClaims()
```

### Decision Tree: Which Client?

```
Making a database query?
├─ User-facing data? → User client (respects RLS)
├─ Admin operation? → Admin client (bypasses RLS)
├─ Webhook (no user)? → Admin client
└─ System task? → Admin client
```

### Checklist: Production Readiness

- [ ] Service role key secured (not in client code)
- [ ] RLS enabled on all public tables
- [ ] HTTPS enforced in production
- [ ] CORS configured correctly
- [ ] Rate limiting on auth endpoints
- [ ] Error handling with proper status codes
- [ ] Logging (without token exposure)
- [ ] Token validation in middleware
- [ ] Two-client pattern implemented
- [ ] Environment variables validated on startup
- [ ] Security headers (helmet) configured
- [ ] Session persistence disabled on server

---

## Additional Resources

- **Official Docs:** https://supabase.com/docs/guides/auth
- **JWT Reference:** https://supabase.com/docs/guides/auth/jwts
- **RLS Guide:** https://supabase.com/docs/guides/database/postgres/row-level-security
- **Error Codes:** https://supabase.com/docs/guides/auth/debugging/error-codes
- **GitHub Discussions:** https://github.com/orgs/supabase/discussions
- **jose Library:** https://www.npmjs.com/package/jose

---

**End of Documentation**
