import SwiftUI

// MARK: - Color Extensions
extension Color {
    // Primary Colors - Dark Gray Theme
    static let primary = Color(hex: "1A1A1A")              // Primary background
    static let secondary = Color(hex: "2F2F2F")            // Secondary backgrounds
    static let tertiary = Color(hex: "E5E5E5")             // Primary text
    
    // Accent Colors - Neon Theme
    static let accent = Color(hex: "FF1493")               // Primary accent (Neon Pink)
    static let accentSecondary = Color(hex: "00BFFF")       // Secondary accent (Neon Blue)
    static let accentInteractive = Color(hex: "FF69B4")    // Interactive states (Bright Pink)
    static let accentSecondaryInteractive = Color(hex: "1E90FF") // Secondary interactive states (Bright Blue)
    
    // Text Colors
    static let textPrimary = Color(hex: "FFFFFF")          // Primary text (White)
    static let textSecondary = Color(hex: "B0B0B0")        // Secondary text (Light Gray)
    
    // Semantic Colors
    static let alert = Color(hex: "FF1493")                // Alert/Error states (Neon Pink)
    static let success = Color(hex: "00BFFF")               // Success states (Neon Blue)
    static let warning = Color(hex: "FF69B4")              // Warning states (Bright Pink)
    static let info = Color(hex: "1E90FF")                 // Info states (Bright Blue)
    
    // Background Colors
    static let backgroundPrimary = Color(hex: "1A1A1A")     // Primary background
    static let backgroundSecondary = Color(hex: "2F2F2F")   // Secondary background
    static let backgroundCard = Color(hex: "2F2F2F")        // Card backgrounds
    
    // Border Colors
    static let borderPrimary = Color(hex: "FF1493")        // Primary borders (Neon Pink)
    static let borderSecondary = Color(hex: "00BFFF")      // Secondary borders (Neon Blue)
    static let borderSubtle = Color(hex: "B0B0B0")         // Subtle borders
    
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
}
