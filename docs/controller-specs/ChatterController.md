# ChatterController Technical Specification

## Controller Overview

The **ChatterController** handles AI-powered dialogue generation endpoints for the Pet Personality System (F-11) and Enemy Trash Talk System (F-12). It orchestrates AI-driven contextual chatter during combat events, manages pet personality assignment, and provides personality type information.

**Responsibilities:**
- Generate AI-powered pet dialogue based on personality traits and combat context
- Generate contextual enemy trash-talk using player history and performance
- Manage pet personality assignment with custom naming
- Provide available personality types and enemy types for client selection

**Feature References:**
- **F-11**: Pet Personality System - AI-powered dynamic pet personalities
- **F-12**: Enemy AI Personality System - Contextual enemy trash-talk

**Service Dependencies:**
- `ChatterService` - Primary business logic service (lines 1-505 in ChatterService.ts)
- `CombatRepository` - Combat session and player history data
- `PetRepository` - Pet ownership and personality data
- `EnemyRepository` - Enemy type and personality traits
- `AnalyticsRepository` - Chatter event logging for quality monitoring

**File Location:** `/mystica-express/src/controllers/ChatterController.ts`

---

## Endpoint Specifications

### 1. GET /api/v1/pets/personalities
**Get Available Pet Personality Types (F-11)**

#### Route Definition
- **Method:** GET
- **Path:** `/api/v1/pets/personalities`
- **Handler:** `ChatterController.getPetPersonalities` (lines 77-87)
- **Middleware:** None (public endpoint)

#### Input Schema
```typescript
// No input parameters required
```

#### Output Schema
```typescript
{
  personalities: PetPersonality[]
}

interface PetPersonality {
  personality_type: 'sassy' | 'encouraging' | 'analytical' | 'chaotic' | 'stoic' | 'trash_talker';
  display_name: string;
  description: string;
  traits: string[];
  example_phrases: string[];
  verbosity: 'terse' | 'moderate' | 'verbose';
}
```

#### Example Response
```json
{
  "personalities": [
    {
      "personality_type": "sassy",
      "display_name": "Sassy",
      "description": "Witty and sarcastic, loves to mock enemies and crack jokes",
      "traits": ["witty", "sarcastic", "confident"],
      "example_phrases": [
        "Is that the best you got? My grandma hits harder!",
        "Ooh, scary! ...said no one ever.",
        "Wake me up when this gets interesting."
      ],
      "verbosity": "moderate"
    }
  ]
}
```

#### Error Responses

**500 Internal Server Error:**
```typescript
{
  error: {
    code: "INTERNAL_SERVER_ERROR",
    message: "Failed to retrieve personality types"
  }
}
```

#### Service Method Calls
1. `chatterService.getPetPersonalities()` (line 79)
   - Retrieves all available personality types from `PetPersonalities` table
   - Maps database records to API response format (ChatterService.ts:257-268)

#### Business Logic Flow
1. Service fetches all personality records from database
2. Maps raw database fields to typed PetPersonality objects
3. Ensures traits and example_phrases are properly formatted arrays
4. Returns structured personality data for client selection UI

#### Related Documentation
- Feature Spec: `/docs/feature-specs/F-11-pet-personality-system.yaml` (lines 79-152)
- API Contract: `/docs/api-contracts.yaml` (lines 1762-1778)
- Database Schema: `/docs/data-plan.yaml` (lines 612-620)

---

### 2. PUT /api/v1/pets/:pet_id/personality
**Assign Personality to Player's Pet (F-11)**

#### Route Definition
- **Method:** PUT
- **Path:** `/api/v1/pets/:pet_id/personality`
- **Handler:** `ChatterController.assignPetPersonality` (lines 93-108)
- **Middleware:**
  - Authentication required (`BearerAuth`)
  - Request validation (`AssignPersonalitySchema`)

#### Input Schema

**Path Parameters:**
```typescript
{
  pet_id: string; // UUID format (validated by route parameter schema)
}
```

**Request Body (Zod Schema: AssignPersonalitySchema, lines 116-119):**
```typescript
{
  personality_type: 'sassy' | 'encouraging' | 'analytical' | 'chaotic' | 'stoic' | 'trash_talker';
  custom_name?: string; // Optional, max 50 characters
}
```

#### Output Schema
```typescript
{
  success: boolean;
  pet_id: string;
  personality_type: string;
  custom_name?: string;
}
```

#### Example Request
```json
PUT /api/v1/pets/12345678-1234-5678-9abc-123456789abc/personality
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "personality_type": "trash_talker",
  "custom_name": "Lil Buddy"
}
```

#### Example Response
```json
{
  "success": true,
  "pet_id": "12345678-1234-5678-9abc-123456789abc",
  "personality_type": "trash_talker",
  "custom_name": "Lil Buddy"
}
```

#### Error Responses

**400 Bad Request:**
```typescript
{
  error: {
    code: "VALIDATION_ERROR",
    message: "Invalid personality type provided"
  }
}
```

**404 Not Found:**
```typescript
{
  error: {
    code: "PET_NOT_FOUND",
    message: "Pet 12345678-1234-5678-9abc-123456789abc not found"
  }
}
```

**400 Bad Request:**
```typescript
{
  error: {
    code: "INVALID_PERSONALITY",
    message: "Personality type trash_talker not found"
  }
}
```

#### Service Method Calls
1. `chatterService.assignPetPersonality(petId, personalityType, customName)` (lines 98-102)
   - Validates pet ownership through `PetRepository.findPetByItemId()`
   - Validates personality type exists through `PetRepository.findPersonalityByType()`
   - Updates pet record with new personality and optional custom name
   - Returns assignment confirmation (ChatterService.ts:280-305)

#### Business Logic Flow
1. Extract `pet_id` from route parameters and validate UUID format
2. Extract `personality_type` and optional `custom_name` from request body
3. Validate request body against `AssignPersonalitySchema` (Zod validation)
4. Service validates pet exists and is owned by authenticated user
5. Service validates personality type exists in `PetPersonalities` table
6. Service updates pet record with new personality assignment
7. Service updates optional custom name if provided
8. Return success confirmation with assigned values

#### Related Documentation
- Feature Spec: `/docs/feature-specs/F-11-pet-personality-system.yaml` (lines 155-172)
- API Contract: `/docs/api-contracts.yaml` (lines 1779-1824)
- Database Schema: `/docs/data-plan.yaml` (lines 576-584, 612-620)

---

## Additional Endpoints (Not in Target Scope)

The ChatterController also implements combat chatter generation endpoints that are outside the scope of this specification:

### POST /api/v1/combat/pet-chatter
**Generate AI-Powered Pet Dialogue (F-11)**
- Handler: `generatePetChatter` (lines 23-44)
- Generates personality-appropriate dialogue during combat events
- Requires active combat session and equipped pet

### POST /api/v1/combat/enemy-chatter
**Generate AI-Powered Enemy Trash-Talk (F-12)**
- Handler: `generateEnemyChatter` (lines 50-71)
- Generates contextual enemy taunts based on player history
- Uses player combat performance for personalized trash-talk

### GET /api/v1/enemies/types
**Get Available Enemy Types (F-12)**
- Handler: `getEnemyTypes` (lines 114-124)
- Returns enemy types with personality traits and example taunts

---

## Middleware Chain

### Authentication Middleware
- **Applied to:** `PUT /pets/:pet_id/personality`
- **Implementation:** JWT token validation via Supabase auth
- **Location:** `/src/middleware/auth.ts`
- **Behavior:** Validates Bearer token, populates `req.user` with authenticated user data

### Validation Middleware
- **Applied to:** `PUT /pets/:pet_id/personality`
- **Schema:** `AssignPersonalitySchema` (schemas.ts:116-119)
- **Location:** `/src/middleware/validate.ts`
- **Behavior:** Validates request body against Zod schema, populates `req.validated`

### Error Handling
- **Global Handler:** `/src/middleware/errorHandler.ts`
- **Custom Errors:** Defined in `/src/utils/errors.ts`
  - `PetNotFoundError` - Pet doesn't exist or not owned by user
  - `InvalidPersonalityError` - Personality type not found in database
  - `ValidationError` - Request body validation failures

---

## Data Flow Architecture

### Pet Personality Assignment Flow
```
Client Request → Auth Middleware → Validation Middleware → ChatterController.assignPetPersonality()
    ↓
ChatterService.assignPetPersonality() → PetRepository.findPetByItemId() (ownership validation)
    ↓                                     ↓
PetRepository.findPersonalityByType() ← PetRepository.updatePetPersonality()
    ↓
Database Updates: Pets.personality_id, Pets.custom_name → Success Response
```

### Pet Personalities Retrieval Flow
```
Client Request → ChatterController.getPetPersonalities()
    ↓
ChatterService.getPetPersonalities() → PetRepository.getAllPersonalities()
    ↓
Database Query: PetPersonalities table → Mapped Response Objects → JSON Response
```

---

## Database Dependencies

### Primary Tables
- **PetPersonalities** (seed data, lines 612-620 in data-plan.yaml)
  - Stores available personality types with traits and example phrases
  - Referenced by `personality_type` enum in validation schemas

- **Pets** (lines 576-584 in data-plan.yaml)
  - Links player items to personality assignments
  - Stores optional custom pet names
  - Foreign key relationship to PetPersonalities table

### Repository Dependencies
- **PetRepository** - Pet ownership validation and personality management
- **CombatRepository** - Combat session validation (for chatter endpoints)
- **EnemyRepository** - Enemy type data (for enemy chatter endpoints)
- **AnalyticsRepository** - Event logging for chatter generation analytics

---

## Error Handling Strategy

### Service-Level Errors
- **PetNotFoundError**: Thrown when pet doesn't exist or user doesn't own it
- **InvalidPersonalityError**: Thrown when personality type doesn't exist
- **ValidationError**: Thrown for request schema validation failures

### Fallback Behaviors
- **No AI Generation Fallback**: Not applicable to personality management endpoints
- **Database Transaction Safety**: Personality assignment uses atomic database updates
- **Graceful Degradation**: Invalid requests return structured error responses

### Logging and Analytics
- Error events logged through standard Express error handler
- Successful personality assignments tracked for user engagement analytics
- No PII logged in chatter event analytics (ChatterService.ts:466-498)

---

## Cross-References

### Dependencies
**Controllers this controller depends on:**
- **AuthController** (requires authenticated users via auth middleware)

**Services used:**
- ChatterService (pet personality dialogue generation for F-11)
- PetRepository (pet ownership validation and personality management)
- CombatRepository (combat session validation for chatter endpoints)
- AnalyticsRepository (event logging for chatter generation analytics)

### Dependents
**Controllers that use this controller:**
- **CombatController** (uses ChatterService for pet dialogue during combat events)

### Related Features
- **F-11 Pet Personality System** - Primary feature spec for AI-generated pet dialogue
- **F-02 Combat System** - Pet chatter during combat events
- **F-03 Base Items & Equipment System** - Pet items and personality assignment

### Data Models
- PetPersonalities table (docs/data-plan.yaml:612-620) - Seed data with personality types and traits
- Pets table (docs/data-plan.yaml:576-584) - Links player items to personality assignments
- PlayerItems table (pet items that can have personalities assigned)

### Integration Notes
- **Combat Integration**: ChatterService used by CombatController for pet dialogue during combat
- **Personality Management**: Handles assignment of AI personalities to pet items
- **Analytics Integration**: Tracks personality assignments for user engagement metrics
- **AI Fallback**: Service provides fallback behaviors when AI generation fails