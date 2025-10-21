# ProfileController Specification

## Overview

The **ProfileController** handles user profile initialization and retrieval operations for the New Mystica game backend. It serves as the primary interface for managing player profile data, including initialization of new accounts with starter resources and retrieving complete profile information with computed statistics.

### Purpose and Responsibility

- Initialize new player profiles with starting inventory and currency balances
- Retrieve complete player profile data including stats, progression, and account metadata
- Serve as the primary profile management endpoint for the frontend application

### Feature References

- **F-07 Authentication**: Integrates with device-based anonymous authentication system
- **F-08 XP Progression System**: Returns player level and XP data from PlayerProgression table

### Service Dependencies

- **ProfileService**: Core business logic for profile operations, currency management, and progression tracking
- **StatsService**: Calculation of total combat stats from equipped items (future implementation)

## API Endpoints

### GET /profile

Retrieves the complete player profile with computed stats and current progression.

#### Route Configuration
- **Path**: `/api/v1/profile`
- **Method**: `GET`
- **Handler**: `ProfileController.getProfile`

#### Middleware Chain
1. `authenticate` - JWT token validation, populates `req.user`
2. Route handler execution

#### Input Schema

**Headers:**
```typescript
{
  Authorization: "Bearer <jwt_token>" // Required JWT token
}
```

**Parameters:** None
**Query Parameters:** None
**Request Body:** None

#### Output Schema

**Success Response (200):**
```json
{
  "profile": {
    "id": "string (UUID)",
    "email": "string | null",
    "device_id": "string | null",
    "account_type": "anonymous | email",
    "username": "string | null",
    "vanity_level": "number",
    "gold": "number",
    "gems": "number",
    "total_stats": {
      "atkPower": "number",
      "atkAccuracy": "number",
      "defPower": "number",
      "defAccuracy": "number"
    },
    "level": "number",
    "xp": "number",
    "created_at": "string (ISO 8601)",
    "last_login": "string (ISO 8601)"
  }
}
```

#### Error Responses

**401 Unauthorized:**
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired token"
  }
}
```

**404 Not Found:**
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "User not found"
  }
}
```

**500 Internal Server Error:**
```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "Database connection error"
  }
}
```

#### Service Method Calls

1. `profileService.getProfile(userId: string)` - Main profile retrieval
   - Internally calls:
     - `profileRepository.findUserById(userId)`
     - `profileRepository.getAllCurrencyBalances(userId)`
     - `getProgression(userId)`
     - `calculateTotalStats(userId)` (returns default stats currently)

#### Business Logic Flow

1. Extract `userId` from authenticated request (`req.user.id`)
2. Call `ProfileService.getProfile()` with user ID
3. Service aggregates data from multiple sources:
   - Base user data from Users table
   - Currency balances from UserCurrencyBalances
   - Progression data from PlayerProgression table
   - Total stats calculation (placeholder implementation)
4. Return aggregated profile object

#### Related Documentation
- **API Contract**: `/Users/silasrhyneer/Code/new-mystica/docs/api-contracts.yaml:1690-1701`
- **Implementation**: `/Users/silasrhyneer/Code/new-mystica/mystica-express/src/controllers/ProfileController.ts:28-44`

---

### POST /profile/init

Initializes a new player profile with starting resources after successful authentication.

#### Route Configuration
- **Path**: `/api/v1/profile/init`
- **Method**: `POST`
- **Handler**: `ProfileController.initProfile`

#### Middleware Chain
1. `authenticate` - JWT token validation, populates `req.user`
2. Route handler execution

#### Input Schema

**Headers:**
```typescript
{
  Authorization: "Bearer <jwt_token>" // Required JWT token
}
```

**Parameters:** None
**Query Parameters:** None
**Request Body:** None (user ID extracted from JWT token)

#### Output Schema

**Success Response (201):**
```json
{
  "success": true,
  "profile": {
    "id": "string (UUID)",
    "email": "string | null",
    "device_id": "string | null",
    "account_type": "anonymous | email",
    "username": "string | null",
    "vanity_level": "number",
    "gold": 0,
    "gems": 0,
    "total_stats": {
      "atkPower": "number",
      "atkAccuracy": "number",
      "defPower": "number",
      "defAccuracy": "number"
    },
    "level": 1,
    "xp": 0,
    "created_at": "string (ISO 8601)",
    "last_login": "string (ISO 8601)"
  }
}
```

#### Error Responses

**400 Bad Request:**
```json
{
  "error": {
    "code": "BUSINESS_LOGIC_ERROR",
    "message": "Profile already initialized"
  }
}
```

**401 Unauthorized:**
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired token"
  }
}
```

**404 Not Found:**
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "No common item types available for profile initialization"
  }
}
```

**500 Internal Server Error:**
```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "Database transaction failed"
  }
}
```

#### Service Method Calls

1. `profileService.initializeProfile(userId: string)` - Main initialization logic
   - Internally calls:
     - `itemRepository.findByUser(userId)` - Check existing items
     - `profileRepository.addCurrency(userId, 'GOLD', 0, 'profile_init')`
     - `profileRepository.addCurrency(userId, 'GEMS', 0, 'profile_init')`
     - `getItemTypesByRarity('common')` - Get available common items
     - `itemRepository.create()` - Create random starter item
     - `profileRepository.updateProgression()` - Initialize level 1 progression
     - `analyticsService.trackEvent()` - Log profile initialization
     - `getProfile(userId)` - Return complete profile

#### Business Logic Flow

1. Extract `userId` from authenticated request (`req.user.id`)
2. Call `ProfileService.initializeProfile()` with user ID
3. Service performs initialization sequence:
   - **Validation**: Check if profile already exists (throws BusinessLogicError)
   - **Currency Setup**: Initialize 0 GOLD and 0 GEMS balances
   - **Starter Item**: Create 1 random common rarity item with no materials
   - **Progression**: Set level 1, XP 0, XP to next level 100
   - **Analytics**: Track profile_initialized event
   - **Response**: Return complete profile via `getProfile()`
4. Return profile data with 201 status

#### Initialization Guarantees

- **Exactly 1 starter item**: Random selection from common rarity item types
- **Currency balances**: 0 GOLD, 0 GEMS (tracked in UserCurrencyBalances)
- **Progression state**: Level 1, 0 XP, 100 XP to next level
- **Analytics tracking**: profile_initialized event with starter item details
- **Idempotency**: Subsequent calls return BusinessLogicError (400)

#### Related Documentation
- **API Contract**: `/Users/silasrhyneer/Code/new-mystica/docs/api-contracts.yaml:1703-1715`
- **Implementation**: `/Users/silasrhyneer/Code/new-mystica/mystica-express/src/controllers/ProfileController.ts:10-26`
- **Business Logic**: `/Users/silasrhyneer/Code/new-mystica/mystica-express/src/services/ProfileService.ts:28-74`

## Error Handling Patterns

### Controller Level
- All controller methods use try-catch blocks
- Errors are passed to Express error middleware via `next(error)`
- No error transformation at controller level

### Service Level
- **BusinessLogicError**: Profile already initialized (400)
- **NotFoundError**: User not found or no common items available (404)
- **ValidationError**: Invalid input parameters (400)
- **Supabase Errors**: Mapped via `mapSupabaseError()` utility (500)

### Error Propagation
1. Service throws typed errors (NotFoundError, BusinessLogicError, etc.)
2. Controller catches and passes to Express error middleware
3. Error middleware formats response and sets appropriate HTTP status codes

## Data Flow Diagram

```
Request → Auth Middleware → Controller → Service → Repository → Database
                               ↓            ↓         ↓
Response ← Error Middleware ← Controller ← Service ← Repository
```

## Schema References

### Zod Validation Schemas
- No request body validation schemas (auth-only endpoints)
- Validation handled by JWT auth middleware

### TypeScript Interfaces
- **UserProfile**: `/Users/silasrhyneer/Code/new-mystica/mystica-express/src/types/api.types.ts:15-34`
- **Stats**: `/Users/silasrhyneer/Code/new-mystica/mystica-express/src/types/api.types.ts:121-126`

### Database Schema References
- **Users table**: `/Users/silasrhyneer/Code/new-mystica/docs/data-plan.yaml:323-332`
- **PlayerProgression table**: `/Users/silasrhyneer/Code/new-mystica/docs/data-plan.yaml:351-361`
- **UserCurrencyBalances**: Referenced for GOLD/GEMS tracking
- **PlayerItems**: Referenced for starter item creation

## Implementation Notes

### Current State
- ✅ Controller methods implemented
- ✅ Service business logic implemented
- ✅ Error handling and validation
- ✅ Analytics integration
- ⚠️ Stats calculation returns placeholder values (ProfileService.ts:227-236)
- ⚠️ Common item types use mock data (ProfileService.ts:263-271)

### Dependencies
- **Required**: Authentication middleware, ProfileService, ItemRepository
- **Optional**: StatsService (for actual stats calculation), Analytics service

### Testing Considerations
- Mock ProfileService for unit tests
- Test error scenarios (already initialized, user not found)
- Verify analytics event tracking
- Test JWT token validation edge cases

## Cross-References

### Dependencies
**Controllers this controller depends on:**
- **AuthController** (depends on JWT authentication and user session management)

**Services used:**
- ProfileService (core business logic for profile operations and currency management)
- StatsService (calculation of total combat stats from equipped items)

### Dependents
**Controllers that use this controller:**
- None (leaf controller - provides profile data but doesn't delegate to other controllers)

### Related Features
- **F-07 Authentication** - User session management and device registration
- **F-08 XP Progression System** - Level and XP tracking in profile data
- **F-09 Inventory Management** - Profile initialization creates starter items

### Data Models
- Users table (docs/data-plan.yaml:89-109)
- UserCurrencyBalances table (docs/data-plan.yaml:127-139)
- PlayerProgression table (docs/data-plan.yaml:605-626)
- PlayerItems table (docs/data-plan.yaml:203-221)

### Integration Notes
- **Profile Initialization**: Called indirectly by AuthController during device registration
- **Stats Computation**: Currently returns placeholder values - future integration with EquipmentService needed
- **Analytics**: Tracks profile_initialized events for user onboarding metrics