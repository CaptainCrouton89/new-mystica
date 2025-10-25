# Simple Animation System

A streamlined animation system that focuses on the core functionality:

## ESSENTIAL FUNCTIONALITY

### 1. Generate Sprite Sheets (`simple-sprite-sheet.ts`)

- Download individual frame images from R2 storage
- Combine frames into horizontal sprite sheet using ImageMagick
- Generate metadata JSON with frame dimensions and timing
- Upload sprite sheet and metadata to R2 storage

### 2. Load Sprite Sheets (`SimpleSpriteLoader.swift`)

- Load sprite sheet metadata from R2 storage
- Download sprite sheet images from R2 storage
- Extract individual frames from sprite sheet
- Create SKAction animations from frame textures
- Return animated SKSpriteNode for display

### 3. Display Animated Sprites (`SimpleAnimatedSpriteView.swift`)

- Display loading state while sprite loads
- Show error state if sprite fails to load
- Present animated sprite using SpriteKit
- Handle sprite positioning and sizing

### 4. Test Animations (`SimpleAnimationTestView.swift`)

- Display multiple animated sprites side-by-side
- Test different monster types and animation types
- Demonstrate loading states and error handling
- Provide navigation back to main app

## Files

### Scripts

- `scripts/simple-sprite-sheet.ts` - Converts individual frame images into sprite sheets

### SwiftUI Components

- `SimpleSpriteLoader.swift` - Loads sprite sheets and creates animations
- `SimpleAnimatedSpriteView.swift` - SwiftUI view for displaying animated sprites
- `SimpleAnimationTestView.swift` - Test view demonstrating the system

## Usage

### 1. Generate Sprite Sheet

```bash
cd scripts
tsx simple-sprite-sheet.ts --monster doctor --animation idle --frames 10
```

### 2. Use in SwiftUI

```swift
SimpleAnimatedSpriteView(
    monsterName: "doctor",
    animationType: "idle",
    frameRate: 12.0,
    size: CGSize(width: 150, height: 150)
)
```

## What Was Removed

The following bloated files were removed:

- `SpriteSheetAnimationGenerator.swift` (324 lines → 0)
- `R2AnimationLoader.swift` (324 lines → 0)
- `SpriteAnimationGenerator.swift` (319 lines → 0)
- `TestAnimationsView.swift` (334 lines → 0)
- `AnimatedSpriteView.swift` (110 lines → 0)
- `AnimationStateManager.swift` (103 lines → 0)
- `scripts/sprite-sheet.ts` (550 lines → 0)
- `scripts/SPRITE_SHEET_README.md` (241 lines → 0)

**Total reduction: ~2,305 lines of code removed**

## What Remains

- `SimpleSpriteLoader.swift` (~150 lines) - Core loading functionality
- `SimpleAnimatedSpriteView.swift` (~80 lines) - Core UI component
- `SimpleAnimationTestView.swift` (~100 lines) - Test/demo view
- `scripts/simple-sprite-sheet.ts` (~200 lines) - Core generation script

**Total: ~530 lines of focused, essential code**

## Core Workflow

1. **Generate**: `tsx simple-sprite-sheet.ts --monster doctor --animation idle`
2. **Load**: `SimpleSpriteLoader.shared.loadAnimatedSprite(monsterName: "doctor", animationType: "idle")`
3. **Display**: `SimpleAnimatedSpriteView(monsterName: "doctor", animationType: "idle")`

That's it. No bloat, no complexity, just the essentials.
