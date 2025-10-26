//
//  DisplayBorders.swift
//  New-Mystica
//
//  Border definitions for rarity and style-based visual distinction
//

import SwiftUI

// MARK: - Rarity Border Types
/// Border styles for item rarity levels
enum RarityBorder: String, CaseIterable {
    case common = "common"
    case rare = "rare"
    case epic = "epic"
    case legendary = "legendary"

    /// Color mapping for rarity borders using mystica color palette
    var borderColor: Color {
        switch self {
        case .common:
            return .textSecondary        // Light Gray (B0B0B0)
        case .rare:
            return .accentSecondary      // Faded Yellow (C9A961)
        case .epic:
            return .accent               // Teal (00CED1)
        case .legendary:
            return Color(hex: "FF8C00")  // Dark Orange for legendary items
        }
    }

    /// Border width for each rarity level
    var borderWidth: CGFloat {
        switch self {
        case .common:
            return 1.0
        case .rare:
            return 2.0
        case .epic:
            return 2.5
        case .legendary:
            return 3.0
        }
    }
}

// MARK: - Style Border Types
/// Border styles for material style types
enum StyleBorder: String, CaseIterable {
    case normal = "normal"
    case pixelArt = "pixel_art"
    case holographic = "holographic"

    /// Color mapping for style borders
    var borderColor: Color {
        switch self {
        case .normal:
            return .textPrimary          // White (FFFFFF)
        case .pixelArt:
            return Color(hex: "FF69B4")  // Bright Pink for pixel art
        case .holographic:
            return .accentSecondary      // Base color for holographic (animated)
        }
    }

    /// Border width for each style
    var borderWidth: CGFloat {
        switch self {
        case .normal:
            return 1.0
        case .pixelArt:
            return 2.0
        case .holographic:
            return 2.5
        }
    }

    /// Whether this style should use animated/gradient effects
    var isAnimated: Bool {
        return self == .holographic
    }
}

// MARK: - Border Type Union
/// Union type for different border categories
enum BorderType {
    case rarity(RarityBorder)
    case style(StyleBorder)

    var borderColor: Color {
        switch self {
        case .rarity(let rarity):
            return rarity.borderColor
        case .style(let style):
            return style.borderColor
        }
    }

    var borderWidth: CGFloat {
        switch self {
        case .rarity(let rarity):
            return rarity.borderWidth
        case .style(let style):
            return style.borderWidth
        }
    }

    var isAnimated: Bool {
        switch self {
        case .rarity:
            return false
        case .style(let style):
            return style.isAnimated
        }
    }
}

// MARK: - Helper Extensions
extension RarityBorder {
    /// Initialize from item level (temporary mapping until rarity system is implemented)
    static func fromLevel(_ level: Int) -> RarityBorder {
        switch level {
        case 1...10:
            return .common
        case 11...25:
            return .rare
        case 26...40:
            return .epic
        default:
            return .legendary
        }
    }
}

extension StyleBorder {
    /// Initialize from style ID string
    static func fromStyleId(_ styleId: String) -> StyleBorder {
        switch styleId.lowercased() {
        case "pixel_art", "pixelart":
            return .pixelArt
        case "holographic", "holo":
            return .holographic
        default:
            return .normal
        }
    }
}