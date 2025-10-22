# OpenAI Integration Patterns Investigation

**Date:** 2025-10-21
**Investigator:** Claude Code Agent
**Focus:** Understanding existing OpenAI integration for combat dialogue generation implementation

## Executive Summary

The codebase has a well-established OpenAI integration pattern using the Vercel AI SDK (`@ai-sdk/openai` v2.0.53) with structured response generation via Zod schemas. The integration is primarily located in the scripts/ directory for AI image generation, with backend services designed but not yet implemented. The patterns are consistent, error-handled, and ready for extension to combat dialogue generation.

## Current OpenAI Integration Architecture

### 1. Technology Stack

**Core Dependencies:**
- `@ai-sdk/openai`: v2.0.53 (Vercel AI SDK OpenAI provider)
- `ai`: v5.0.76 (Vercel AI SDK core)
- `zod`: v4.1.12 (Schema validation and structured generation)

**Models Used:**
- **Primary:** `gpt-4.1-mini` - Used for text generation (descriptions, dialogue)
- **Cost:** ~$0.0001-0.0005 per generation (very cost-effective)

### 2. Integration Patterns

#### A. Structured Generation Pattern (Primary)

**Location:** `scripts/generate-item-description.ts` (lines 45-65)

```typescript
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

const schema = z.object({
  name: z.string().describe('Creative name'),
  description: z.string().describe('Two-sentence description')
});

const { object } = await generateObject({
  model: openai('gpt-4.1-mini'),
  schema: schema,
  system: SYSTEM_PROMPT,
  prompt: userPrompt,
});
```

**Key Characteristics:**
- Uses `generateObject()` for structured, validated responses
- Zod schemas enforce response format and provide type safety
- System prompts define behavior and constraints
- Error handling with try/catch blocks

#### B. System Prompt Engineering Pattern

**Location:** `scripts/generate-item-description.ts` (lines 15-38)

```typescript
const SYSTEM_PROMPT = `You are an assistant for a crafting game...
Your task is two-fold: (1) write a description, (2) invent a name.

Your description should:
- Focus entirely on what the item looks like
- Avoid describing artistic style, lighting, or mood
- Use clear and minimal language
- **Deeply integrate the materials into the item's form**

Your name should:
- Be concise, evocative, and fitting
- Clearly relate to both the item type and materials
- Avoid generic or purely literal names`;
```

**Pattern Elements:**
- Clear role definition
- Detailed behavioral guidelines
- Output format specifications
- Constraint definitions
- Examples when helpful

### 3. Environment Configuration

**Location:** `mystica-express/src/config/env.ts` (lines 24-27)

```typescript
const EnvSchema = z.object({
  // AI Services Configuration
  REPLICATE_API_TOKEN: z.string().min(1, 'REPLICATE_API_TOKEN is required'),
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),

  // Optional AI Services
  ELEVENLABS_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),
});
```

**Configuration Features:**
- Zod validation on startup with detailed error messages
- Required vs optional API keys clearly defined
- Environment files: `.env.local` (primary) then `.env` (fallback)
- Validation failure throws detailed error with field-specific messages

### 4. Error Handling Patterns

**Location:** `mystica-express/src/utils/errors.ts` (lines 142-153)

```typescript
export class ExternalAPIError extends AppError {
  readonly statusCode = 502;
  readonly code = 'EXTERNAL_API_ERROR';

  constructor(service: string, message: string, details?: Record<string, any>) {
    super(`${service} API error: ${message}`, details);
  }
}
```

**Error Handling Strategy:**
- Custom `ExternalAPIError` class for AI service failures
- Structured error responses with status codes
- Detailed error context preservation
- Consistent error mapping for different failure types

### 5. Backend Service Architecture (Designed but Not Implemented)

**Location:** `mystica-express/src/services/ImageGenerationService.ts`

```typescript
export class ImageGenerationService {
  async generateImage(itemTypeId: string, materials: MaterialReference[]): Promise<string> {
    // TODO: Implement image generation workflow
    // 1. Fetch ItemType data for base prompt
    // 2. Fetch Material data for each material reference
    // 3. Build AI prompt: "{item_type} made from {material1}, {material2}"
    // 4. Call Replicate API with prompt and references
    // 10. Handle API errors and retries
    throw new NotImplementedError('ImageGenerationService.generateImage not implemented');
  }
}
```

**Service Layer Patterns:**
- Class-based services with dependency injection ready
- Clear interface definitions with TypeScript
- Comprehensive TODO comments with implementation steps
- Consistent error throwing with `NotImplementedError`

## Prompt Engineering Patterns

### 1. System Prompt Structure

**Observed Pattern:**
```
Role Definition + Task Description + Detailed Guidelines + Output Format + Constraints + Examples
```

**Example from `generate-raw-image.ts` (lines 79-100):**
```typescript
const RAW_DESCRIPTION_SYSTEM_PROMPT = `You are generating concise visual descriptions...

Your task: Given a name and type, write ONE sentence describing what it looks like.

Guidelines:
- Focus purely on visual/physical details
- Keep it short and simple - aim for 8-15 words
- Avoid artistic style, mood, or storytelling
- Be specific but minimal

Examples:
- "Sword" → "a silver broadsword with a gem-studded crescent hilt"
- "Coffee" → "a pile of dark roasted coffee beans"

Output only the description.`;
```

### 2. Schema Design Patterns

**Simple Response Schema:**
```typescript
const itemDescriptionSchema = z.object({
  name: z.string().describe('A creative, fitting name'),
  description: z.string().describe('Exactly two sentences describing physical appearance')
});
```

**Single Field Schema:**
```typescript
const rawDescriptionSchema = z.object({
  description: z.string().describe('A concise one-sentence physical description')
});
```

## AI Service Integration Points

### 1. Current Usage Areas

**Active Implementations:**
- **Item Description Generation:** Names and descriptions for crafted items
- **Material Description Generation:** Visual descriptions for materials
- **Monster Description Generation:** Descriptions for creature generation

**Integration Workflow:**
1. Load environment variables with validation
2. Build context-specific system prompt
3. Construct user prompt from game data
4. Call `generateObject()` with schema validation
5. Handle errors and return structured response

### 2. API Types and Interfaces

**Location:** `mystica-express/src/types/api.types.ts` (lines 344-363)

```typescript
export interface ImageGenerationRequest {
  item_type_id: string;
  materials: Array<{ material_id: string; style_id: string; }>;
  style_references?: string[];
}

export interface ImageGenerationResult {
  success: boolean;
  image_url: string;
  generation_time_ms: number;
  cache_hit: boolean;
  provider: 'replicate' | 'openai';
  prompt_used?: string;
}
```

## Performance and Cost Considerations

### 1. Model Selection Strategy

**Current Approach:**
- `gpt-4.1-mini` for text generation (cost-effective, fast)
- Replicate API for image generation (higher cost, longer duration)

**Cost Analysis:**
- OpenAI text generation: ~$0.0001-0.0005 per request
- Batch generation: ~$0.01-0.05 for 101 descriptions
- Very manageable costs for dialogue generation

### 2. Caching and Optimization

**Current Patterns:**
- No explicit caching for OpenAI requests (stateless generation)
- Image generation has cache system via `ItemImageCache` table
- Environment validation occurs once on startup

## Recommendations for Combat Dialogue Generation

### 1. Follow Established Patterns

**Service Architecture:**
```typescript
export class CombatDialogueService {
  async generateDialogue(context: CombatContext): Promise<DialogueResponse> {
    // Follow ImageGenerationService pattern
    // Use structured generation with Zod schemas
    // Implement proper error handling
  }
}
```

**Schema Design:**
```typescript
const dialogueSchema = z.object({
  playerLines: z.array(z.string()).describe('Player dialogue options'),
  enemyResponse: z.string().describe('Enemy response text'),
  mood: z.enum(['aggressive', 'defensive', 'taunting']).describe('Dialogue tone')
});
```

### 2. Leverage Existing Infrastructure

**Environment Configuration:** Already supports `OPENAI_API_KEY`
**Error Handling:** Use `ExternalAPIError` for AI service failures
**Type Safety:** Follow API types pattern for request/response interfaces
**System Prompts:** Use established prompt engineering patterns

### 3. Integration Points

**Controller Layer:** Create new combat dialogue endpoints
**Service Layer:** Implement `CombatDialogueService` following existing patterns
**Type Definitions:** Add dialogue types to `api.types.ts`
**Validation:** Use Zod schemas for request validation

## Conclusion

The codebase has a mature, well-structured OpenAI integration that is ready for extension to combat dialogue generation. The patterns are consistent, error-handled, and cost-effective. The main development work will be implementing the business logic and dialogue generation prompts while following the established architectural patterns.

**Key Strengths:**
- Structured generation with type safety
- Comprehensive error handling
- Cost-effective model selection
- Consistent environment configuration
- Clear separation of concerns

**Ready for Implementation:** Combat dialogue generation can be implemented immediately using existing patterns and infrastructure.