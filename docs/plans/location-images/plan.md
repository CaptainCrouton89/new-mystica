# Implementation Plan – Location Images

# Overview
overview:
  related_items:
    feature_specs: ["F-01"]
    user_stories: []
    user_flows: []
  related_docs: |
    - "docs/api-contracts.yaml"
    - "docs/data-plan.yaml"
    - "docs/system-design.yaml"
    - "agent-responses/agent_781746.md" (Image handling investigation)
    - "agent-responses/agent_125766.md" (Location data flow investigation)
    - "agent-responses/agent_733453.md" (Migration patterns investigation)

# Problem
problem: |
  Currently, locations on the map use generic SF Symbol icons and colored circles to represent different location types (forest, urban, desert, etc.). This provides minimal visual variety and doesn't leverage the game's AI-generated art capabilities.

  The map experience would be significantly enhanced by displaying unique, AI-generated images for each location, similar to how items and materials have custom images stored in R2.

# Solution
solution: |
  Add an `image_url` column to the Locations table that stores R2 URLs pointing to location-specific images. These images will be generated offline/manually and uploaded to the R2 bucket following the same pattern as ItemTypes base images. The frontend MapView will be updated to display these images as location markers instead of the current SF Symbol icons. The API will include image URLs in location responses, and the Swift Location model will be extended to support the new field.

# Current System
current_system:
  description: |
    **Database Layer:**
    - Locations table has: id, name, lat, lng, location_type, state_code, country_code (data-plan.yaml:657-668)
    - No image_url column currently exists
    - PostGIS spatial index for geospatial queries

    **Backend API:**
    - LocationService.ts: Handles nearby location queries
    - LocationRepository.ts: Uses RPC `get_nearby_locations` for PostGIS queries
    - GET /locations/nearby returns locations with metadata (api-contracts.yaml:1033-1066)
    - Location schema in API response does NOT include image_url (api-contracts.yaml:66-102)

    **Frontend:**
    - Location.swift model (New-Mystica/New-Mystica/Models/Location.swift:11-35)
    - MapView.swift displays locations with LocationMarkerView (MapView.swift:101-112)
    - LocationMarkerView uses SF Symbol icons based on location_type (MapView.swift:330-351)
    - No AsyncImage or URL-based image loading for locations currently

    **Image Patterns:**
    - ItemTypes have base_image_url stored in database (agent_781746.md)
    - Images uploaded to R2 bucket: `item-images/base/{item-type-id}.png`
    - ImageGenerationService handles R2 uploads (mystica-express/src/services/ImageGenerationService.ts)
    - R2 URLs constructed via `image-url.ts` utility

# Changes Required
changes_required:
  - path: "mystica-express/supabase/migrations/YYYYMMDDHHMMSS_add_location_image_url.sql"
    changes: |
      - CREATE migration file following naming convention: YYYYMMDDHHMMSS_add_location_image_url.sql
      - Add ALTER TABLE locations ADD COLUMN image_url TEXT NULL
      - Set default NULL for existing rows (images will be populated later)
      - Add COMMENT on column describing R2 URL storage pattern

  - path: "mystica-express/src/types/database.types.ts"
    changes: |
      - Regenerate via `pnpm supabase:types` after migration
      - Will automatically add image_url: string | null to Locations table type

  - path: "mystica-express/src/types/api.types.ts"
    changes: |
      - Add image_url?: string to Location interface (currently lines ~66-90)
      - Follows existing pattern from ItemType interface which has base_image_url

  - path: "docs/api-contracts.yaml"
    changes: |
      - Update Location schema (lines 66-102) to include:
        ```yaml
        image_url:
          type: string
          nullable: true
          description: R2 URL to location-specific image (replaces SF Symbol icons on map)
        ```

  - path: "mystica-express/src/repositories/LocationRepository.ts"
    changes: |
      - Update SELECT queries to include image_url column
      - In findNearby() method, ensure image_url is selected from locations table
      - In findById() method, ensure image_url is returned

  - path: "mystica-express/src/services/LocationService.ts"
    changes: |
      - No changes needed - service passes through repository data
      - Verify image_url is included in response objects

  - path: "New-Mystica/New-Mystica/Models/Location.swift"
    changes: |
      - Add imageUrl: String? property to Location struct (after line 21)
      - Add imageUrl = "image_url" to CodingKeys enum (after line 33)
      - Property is optional to handle locations without images gracefully

  - path: "New-Mystica/New-Mystica/MapView.swift"
    changes: |
      - Update LocationMarkerView to accept image_url parameter
      - Replace SF Symbol icon rendering with AsyncImage when image_url is present
      - Add fallback to current SF Symbol icon if image_url is nil
      - Add circular clipping and styling to match current marker design
      - Consider adding loading/error states for AsyncImage

  - path: "scripts/populate-location-images.ts"
    changes: |
      - CREATE NEW SCRIPT following pattern from scripts/populate-item-images.ts
      - Script should:
        1. Read location types from seed data or database
        2. For each location type (forest, urban, desert, coastal, mountain, plains, swamp, arctic)
        3. Generate/fetch location-appropriate image (manual or AI-generated)
        4. Upload to R2 bucket at `location-images/{location-type}.png`
        5. Update database: UPDATE locations SET image_url = '{r2-url}' WHERE location_type = '{type}'
      - Use existing ImageGenerationService.uploadToR2() for uploads
      - Use Supabase client to update location records

# Task Breakdown
task_breakdown:
  - id: "T1"
    description: "Create database migration to add image_url column to Locations table. Migration adds nullable TEXT column following project conventions from agent_733453.md. Regenerate TypeScript types after applying migration."
    agent: "junior-engineer"
    depends_on: []
    files:
      - "mystica-express/supabase/migrations/YYYYMMDDHHMMSS_add_location_image_url.sql"
    exit_criteria: |
      - Migration file created with correct ALTER TABLE syntax
      - Migration applied to remote Supabase database successfully
      - pnpm supabase:types executed, database.types.ts updated with image_url field
      - Locations table in database has image_url column (verify with SELECT query)

  - id: "T2"
    description: "Update backend TypeScript types and API contracts to include image_url field. Add image_url to Location interface in api.types.ts and update OpenAPI schema in api-contracts.yaml. Follows patterns from agent_781746.md investigation."
    agent: "junior-engineer"
    depends_on: ["T1"]
    files:
      - "mystica-express/src/types/api.types.ts"
      - "docs/api-contracts.yaml"
    exit_criteria: |
      - api.types.ts Location interface includes image_url?: string
      - api-contracts.yaml Location schema includes image_url property with correct type and description
      - TypeScript compiler validates successfully (pnpm build)

  - id: "T3"
    description: "Update LocationRepository to select image_url in queries. Modify findNearby() and findById() methods to include image_url in SELECT statements. Ensure RPC function get_nearby_locations returns image_url field."
    agent: "junior-engineer"
    depends_on: ["T1", "T2"]
    files:
      - "mystica-express/src/repositories/LocationRepository.ts"
    exit_criteria: |
      - findNearby() query includes image_url in SELECT
      - findById() query includes image_url in SELECT
      - TypeScript types validate correctly
      - Manual API test: GET /locations/nearby returns locations with image_url field (can be null)

  - id: "T4"
    description: "Update Swift Location model to include imageUrl property. Add optional String property and update CodingKeys enum. Follows Swift API model patterns from agent_125766.md investigation."
    agent: "junior-engineer"
    depends_on: ["T2"]
    files:
      - "New-Mystica/New-Mystica/Models/Location.swift"
    exit_criteria: |
      - Location struct has imageUrl: String? property
      - CodingKeys enum includes imageUrl = "image_url"
      - Swift builds successfully (./build.sh)
      - Existing location API responses deserialize correctly with new optional field

  - id: "T5"
    description: "Update MapView LocationMarkerView to display images from URLs. Replace SF Symbol icon with AsyncImage when image_url is present. Maintain fallback to current icon system. Add loading/error states and circular clipping to match existing marker design from MapView.swift:270-352."
    agent: "programmer"
    depends_on: ["T4"]
    files:
      - "New-Mystica/New-Mystica/MapView.swift"
    exit_criteria: |
      - LocationMarkerView displays AsyncImage when location.imageUrl is not nil
      - Fallback to SF Symbol icon when imageUrl is nil
      - Circular frame with proper sizing (44x44 main circle)
      - Loading state shows placeholder
      - Error state shows fallback icon
      - Maintains existing shadow, glow, and label styling
      - Manual test: Map displays mixed locations (some with images, some with fallback icons)

  - id: "T6"
    description: "Create script to populate location images in R2 and update database. Follow pattern from scripts/populate-item-images.ts. Generate or source images for 8 location types (forest, urban, desert, coastal, mountain, plains, swamp, arctic), upload to R2 at location-images/{type}.png, update database records. Uses ImageGenerationService and Supabase client."
    agent: "programmer"
    depends_on: ["T1", "T3"]
    files:
      - "scripts/populate-location-images.ts"
    exit_criteria: |
      - Script creates/uploads 8 location type images to R2
      - Database updated: UPDATE locations SET image_url = ... WHERE location_type = ...
      - All location types have valid R2 URLs in database
      - URLs accessible and return valid images
      - Script handles errors gracefully (missing images, upload failures)
      - Can be re-run safely (idempotent)

  - id: "T7"
    description: "Integration testing and validation. Test complete flow: Database → API → Frontend. Verify map displays location images correctly, fallback works, API responses include URLs, performance is acceptable with AsyncImage loading."
    agent: "junior-engineer"
    depends_on: ["T5", "T6"]
    files:
      - "New-Mystica/New-Mystica/MapView.swift"
      - "mystica-express/tests/integration/locations.test.ts"
    exit_criteria: |
      - Manual test: Open app, navigate to map, verify locations display images
      - Verify mixed scenarios: some locations with images, some without
      - Verify fallback icons work when image_url is null
      - Verify AsyncImage loading states (loading → success → display)
      - API test: GET /locations/nearby includes image_url in responses
      - Performance test: Map with 30+ locations loads smoothly
      - No console errors or warnings related to image loading

# Data/Schema Changes
data_schema_changes:
  migrations:
    - file: "mystica-express/supabase/migrations/YYYYMMDDHHMMSS_add_location_image_url.sql"
      summary: "Add nullable image_url TEXT column to locations table for storing R2 URLs"

  api_changes:
    - endpoint: "GET /locations/nearby"
      changes: "Add image_url field to Location response schema (nullable string)"

    - endpoint: "GET /locations/{location_id}"
      changes: "Add image_url field to Location response schema (nullable string)"

# Expected Result
expected_result:
  outcome: |
    Locations on the map will display unique, visually distinctive images instead of generic SF Symbol icons. The system will gracefully handle locations with or without images, providing fallback to the existing icon system. The implementation will follow established patterns from ItemTypes base images, using R2 for storage and optional fields for backward compatibility.

  example: |
    **Before:**
    - Map marker shows blue circle with tree.fill SF Symbol for forest locations
    - All forest locations look identical

    **After:**
    - Map marker shows actual forest image from R2 (lush trees, mystical atmosphere)
    - Each location type has distinct visual appearance
    - Fallback to SF Symbol if image not yet uploaded
    - Database query: SELECT id, name, lat, lng, location_type, image_url FROM locations
    - API response: { "id": "...", "name": "Golden Gate Park", "lat": 37.7694, "lng": -122.4862, "location_type": "forest", "image_url": "https://r2.mystica.app/location-images/forest.png" }
    - Swift model: Location(id: "...", name: "Golden Gate Park", imageUrl: "https://r2.mystica.app/location-images/forest.png")
    - MapView renders: AsyncImage(url: URL(string: location.imageUrl ?? "")) with circular clip and shadow

# Notes
notes:
  - "Image generation can be done manually or via AI - not blocking for MVP0"
  - "Consider using Midjourney/DALL-E for high-quality location type images"
  - "R2 bucket path: location-images/{location-type}.png (8 total images needed)"
  - "Script can be run offline before deployment to populate images"
  - "Future enhancement: Per-location unique images instead of per-type"
  - "AsyncImage handles caching automatically on iOS"
  - "Consider adding placeholder/loading image for better UX"
  - "Migration is backward-compatible - existing code continues to work"

# Next
next: "/manage-project/implement/execute location-images"
