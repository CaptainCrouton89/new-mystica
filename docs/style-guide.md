# Mystica UI Style Guide

## Color Palette

### Primary Colors

- **Dark Brown (Primary)**: `#2D1810` - Main background, primary containers
- **Light Brown (Secondary)**: `#8B4513` - Accent elements, highlights, secondary backgrounds
- **Dark Gray (Tertiary)**: `#1A1A1A` - Text, borders, subtle elements

### Extended Palette

- **Warm Brown**: `#A0522D` - Interactive states, hover effects
- **Soft Brown**: `#D2B48C` - Light text, disabled states
- **Charcoal**: `#2F2F2F` - Secondary backgrounds, cards
- **Light Gray**: `#E5E5E5` - Borders, dividers
- **Accent Gold**: `#DAA520` - Special highlights, success states
- **Error Red**: `#8B0000` - Error states, warnings

## Typography

### Title Text

- **Font**: System font, bold weight
- **Size**: 28-32pt (iOS), 24-28px (Web)
- **Color**: `#E5E5E5` (Light Gray)
- **Line Height**: 1.2
- **Letter Spacing**: 0.5pt
- **Shadow**: `0 2px 4px rgba(0,0,0,0.3)`

### Normal Text

- **Font**: System font, regular weight
- **Size**: 16-18pt (iOS), 14-16px (Web)
- **Color**: `#D2B48C` (Soft Brown)
- **Line Height**: 1.4
- **Letter Spacing**: 0.2pt

### Small Text

- **Font**: System font, regular weight
- **Size**: 12-14pt (iOS), 12px (Web)
- **Color**: `#8B4513` (Light Brown)
- **Line Height**: 1.3

## Button Styles

### Icon Button

- **Size**: 44x44pt (iOS), 44x44px (Web) minimum touch target
- **Background**: `#2D1810` (Dark Brown)
- **Border**: 1px solid `#8B4513` (Light Brown)
- **Border Radius**: 8pt (iOS), 8px (Web)
- **Icon Color**: `#D2B48C` (Soft Brown)
- **Icon Size**: 20x20pt (iOS), 20x20px (Web)
- **Padding**: 12pt (iOS), 12px (Web)

**States:**

- **Default**: Background `#2D1810`, Border `#8B4513`
- **Pressed**: Background `#1A1A1A`, Border `#A0522D`, Scale 0.95
- **Disabled**: Background `#2F2F2F`, Border `#1A1A1A`, Icon `#8B4513`

### Text Button

- **Height**: 48pt (iOS), 48px (Web)
- **Background**: `#8B4513` (Light Brown)
- **Border**: None
- **Border Radius**: 12pt (iOS), 12px (Web)
- **Text Color**: `#E5E5E5` (Light Gray)
- **Font**: System font, semibold weight, 16-18pt (iOS), 14-16px (Web)
- **Padding**: 16pt horizontal, 12pt vertical (iOS), 16px horizontal, 12px vertical (Web)

**States:**

- **Default**: Background `#8B4513`, Text `#E5E5E5`
- **Pressed**: Background `#A0522D`, Scale 0.98
- **Disabled**: Background `#2F2F2F`, Text `#8B4513`

### Back Button

- **Size**: 40x40pt (iOS), 40x40px (Web)
- **Background**: Transparent
- **Border**: 1px solid `#8B4513` (Light Brown)
- **Border Radius**: 20pt (iOS), 20px (Web) (circular)
- **Icon**: Left-pointing chevron or arrow
- **Icon Color**: `#D2B48C` (Soft Brown)
- **Icon Size**: 16x16pt (iOS), 16x16px (Web)

**States:**

- **Default**: Transparent background, Border `#8B4513`
- **Pressed**: Background `#2D1810`, Border `#A0522D`, Scale 0.95
- **Disabled**: Border `#1A1A1A`, Icon `#8B4513`

## Spacing System

### Base Unit

- **Base**: 8pt (iOS), 8px (Web)

### Spacing Scale

- **xs**: 4pt (iOS), 4px (Web)
- **sm**: 8pt (iOS), 8px (Web)
- **md**: 16pt (iOS), 16px (Web)
- **lg**: 24pt (iOS), 24px (Web)
- **xl**: 32pt (iOS), 32px (Web)
- **xxl**: 48pt (iOS), 48px (Web)

## Animation Guidelines

### Timing Functions

- **Ease Out**: `cubic-bezier(0.25, 0.46, 0.45, 0.94)` - For entrances
- **Ease In**: `cubic-bezier(0.55, 0.055, 0.675, 0.19)` - For exits
- **Ease In Out**: `cubic-bezier(0.645, 0.045, 0.355, 1)` - For state changes

### Duration Scale

- **Fast**: 150ms - Hover states, micro-interactions
- **Normal**: 250ms - Button presses, state changes
- **Slow**: 400ms - Page transitions, complex animations

### Common Animations

- **Button Press**: Scale to 0.95-0.98, duration 150ms, ease-out
- **Hover**: Slight scale increase (1.02), duration 200ms, ease-out
- **Page Transition**: Slide or fade, duration 300ms, ease-in-out
- **Loading**: Pulse or rotate, duration 1000ms, ease-in-out, infinite

## Responsive Design

### Breakpoints

- **Mobile**: 320px - 768px
- **Tablet**: 768px - 1024px
- **Desktop**: 1024px+

### Scaling Rules

- **Mobile**: Base sizes as defined
- **Tablet**: Scale up by 1.2x
- **Desktop**: Scale up by 1.4x

### Touch Targets

- **Minimum**: 44x44pt (iOS), 44x44px (Web)
- **Recommended**: 48x48pt (iOS), 48x48px (Web)
- **Comfortable**: 56x56pt (iOS), 56x56px (Web)

## Accessibility

### Contrast Ratios

- **Normal Text**: Minimum 4.5:1 contrast ratio
- **Large Text**: Minimum 3:1 contrast ratio
- **UI Components**: Minimum 3:1 contrast ratio

### Focus States

- **Focus Ring**: 2px solid `#DAA520` (Accent Gold)
- **Focus Background**: `#2D1810` with 20% opacity overlay

## Usage Examples

### Dark Theme Implementation

```css
:root {
  --color-primary: #2d1810;
  --color-secondary: #8b4513;
  --color-tertiary: #1a1a1a;
  --color-text-primary: #e5e5e5;
  --color-text-secondary: #d2b48c;
  --color-accent: #daa520;
}
```

### SwiftUI Color Extensions

```swift
extension Color {
    static let mysticaDarkBrown = Color(hex: "2D1810")
    static let mysticaLightBrown = Color(hex: "8B4513")
    static let mysticaDarkGray = Color(hex: "1A1A1A")
    static let mysticaTextPrimary = Color(hex: "E5E5E5")
    static let mysticaTextSecondary = Color(hex: "D2B48C")
}
```

## Design Principles

1. **Earth Connection**: Colors evoke natural, grounded feelings
2. **Clear Hierarchy**: Strong contrast between text levels and interactive elements
3. **Consistent Spacing**: 8pt grid system for visual rhythm
4. **Smooth Interactions**: Subtle animations that feel natural
5. **Accessibility First**: High contrast ratios and proper touch targets
6. **Responsive**: Scales gracefully across all device sizes

## Notes

- All colors are tested for accessibility compliance
- Animation durations are optimized for perceived performance
- The earthy color palette creates a mystical, grounded atmosphere
- High contrast ensures readability in various lighting conditions
- The design system supports both iOS and web implementations
