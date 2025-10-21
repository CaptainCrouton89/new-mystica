# Fonts Folder

This folder contains font management for the Mystica iOS app.

## 🎯 Global Font Control

**YES! You can change ALL fonts in the app from ONE location!**

Simply change this line in `FontManager.swift`:

```swift
static let primaryFontName = "Metamorphous"  // ← Change this to change ALL fonts
```

**Examples:**

- Change to `"Arial"` → All text becomes Arial
- Change to `"Times New Roman"` → All text becomes Times New Roman
- Change to `"Courier"` → All text becomes Courier
- Change to `"Georgia"` → All text becomes Georgia

## Current Fonts

- **Primary**: Metamorphous (used for all text)
- **System**: iOS system fonts (fallback)

## Font Usage

Use the simplified `FontManager` for consistent font styling:

### Method 1: Direct FontManager access (recommended)

```swift
// Using FontManager directly (all use primary font)
.font(FontManager.title)           // 30pt primary font
.font(FontManager.subtitle)       // 22pt primary font
.font(FontManager.body)           // 17pt primary font
.font(FontManager.caption)        // 13pt primary font
.font(FontManager.small)         // 11pt primary font

// Custom sizes
.font(FontManager.primary(size: 24))    // 24pt primary font
.font(FontManager.system(size: 16, weight: .bold))  // System font
```

### Method 2: Legacy compatibility

```swift
// Legacy compatibility (still works - uses Metamorphous)
.font(FontManager.impact(size: 24))
.font(.custom("Metamorphous", size: FontManager.titleSize))
```

## Standard Font Sizes

- `titleSize`: 30pt
- `subtitleSize`: 22pt
- `bodySize`: 17pt
- `captionSize`: 13pt
- `smallSize`: 11pt

## Adding Custom Fonts

To add custom fonts to the app:

1. **Add font files** to this folder:

   - Supported formats: `.ttf`, `.otf`, `.woff`, `.woff2`
   - Place the font files directly in this `Fonts/` directory

2. **Add fonts to Xcode project**:

   - In Xcode, right-click on the `Fonts` folder
   - Select "Add Files to 'New-Mystica'"
   - Choose your font files
   - Make sure "Add to target" is checked for your app target

3. **Update FontManager.swift**:
   - Change `primaryFontName` to your font name
   - Example: `static let primaryFontName = "YourFont"`

## Benefits

- **Consistent**: All fonts go through the same system
- **Maintainable**: Change fonts in one place
- **Flexible**: Support for custom sizes and weights
- **Simple**: Easy to use with multiple syntax options
- **Safe**: No infinite recursion or compilation errors
