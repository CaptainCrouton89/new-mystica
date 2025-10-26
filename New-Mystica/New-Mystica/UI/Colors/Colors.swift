import SwiftUI

// MARK: - Color Extensions
extension Color {
    // Primary Colors - Dark Gray Theme
    static let primary = Color(hex: "1A1A1A")              // Primary background
    static let secondary = Color(hex: "2F2F2F")            // Secondary backgrounds
    static let tertiary = Color(hex: "E5E5E5")             // Primary text
    
    // Accent Colors - Teal & Faded Yellow Theme
    static let accent = Color(hex: "00CED1")               // Primary accent (Teal)
    static let accentSecondary = Color(hex: "C9A961")       // Secondary accent (Faded Yellow)
    static let accentInteractive = Color(hex: "00E5E6")    // Interactive states (Bright Teal)
    static let accentSecondaryInteractive = Color(hex: "D4AF6A") // Secondary interactive states (Brighter Yellow)
    
    // Text Colors
    static let textPrimary = Color(hex: "FFFFFF")          // Primary text (White)
    static let textSecondary = Color(hex: "B0B0B0")        // Secondary text (Light Gray)
    
    // Semantic Colors
    static let alert = Color(hex: "00CED1")                // Alert/Error states (Teal)
    static let success = Color(hex: "C9A961")               // Success states (Faded Yellow)
    static let warning = Color(hex: "00E5E6")              // Warning states (Bright Teal)
    static let info = Color(hex: "D4AF6A")                 // Info states (Brighter Yellow)
    
    // Background Colors
    static let backgroundPrimary = Color(hex: "1A1A1A")     // Primary background
    static let backgroundSecondary = Color(hex: "2F2F2F")   // Secondary background
    static let backgroundCard = Color(hex: "2F2F2F")        // Card backgrounds
    
    // Border Colors
    static let borderPrimary = Color(hex: "00CED1")        // Primary borders (Teal)
    static let borderSecondary = Color(hex: "C9A961")      // Secondary borders (Faded Yellow)
    static let borderSubtle = Color(hex: "B0B0B0")         // Subtle borders

    // Rarity Background Colors (pre-calculated for 0.05 opacity on #2F2F2F dark gray)
    static let rarityCommon = Color(hex: "333333")         // Gray at 0.05 opacity on #2F2F2F
    static let rarityUncommon = Color(hex: "2D322D")       // Green at 0.05 opacity on #2F2F2F
    static let rarityRare = Color(hex: "2D2D39")           // Blue at 0.05 opacity on #2F2F2F
    static let rarityEpic = Color(hex: "332D33")           // Purple at 0.05 opacity on #2F2F2F
    static let rarityLegendary = Color(hex: "39352D")      // Orange at 0.05 opacity on #2F2F2F

    // Rarity Border/Stroke Colors
    static let rarityCommonBorder = Color(hex: "808080")   // Gray for common rarity borders
    static let rarityUncommonBorder = Color(hex: "00AA00") // Green for uncommon rarity borders
    static let rarityRareBorder = Color(hex: "0055FF")     // Blue for rare rarity borders
    static let rarityEpicBorder = Color(hex: "AA00AA")     // Purple for epic rarity borders
    static let rarityLegendaryBorder = Color(hex: "FF8800") // Orange for legendary rarity borders

    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (1, 1, 1, 0)
        }

        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue:  Double(b) / 255,
            opacity: Double(a) / 255
        )
    }

    /// Get rarity border color based on rarity string value
    static func rarityBorderColor(for rarity: String) -> Color {
        switch rarity.lowercased() {
        case "common":
            return .rarityCommonBorder
        case "uncommon":
            return .rarityUncommonBorder
        case "rare":
            return .rarityRareBorder
        case "epic":
            return .rarityEpicBorder
        case "legendary":
            return .rarityLegendaryBorder
        default:
            return .rarityCommonBorder
        }
    }

    /// Get rarity background color based on rarity string value
    static func rarityBackgroundColor(for rarity: String) -> Color {
        switch rarity.lowercased() {
        case "common":
            return .rarityCommon
        case "uncommon":
            return .rarityUncommon
        case "rare":
            return .rarityRare
        case "epic":
            return .rarityEpic
        case "legendary":
            return .rarityLegendary
        default:
            return .rarityCommon
        }
    }
}
