import SwiftUI

// MARK: - Simple Font Manager
/// Centralized font management for the Mystica app
struct FontManager {
    
    // MARK: - Font Configuration (Change fonts here!)
    static let primaryFontName = "Bungee-Regular"      // Main font for all text
    
    // TEMPORARY TEST: Try using a system font to test FontManager
    static let testWithSystemFont = false  // Set to true to test with system font
    
    // Available fonts in your project:
    // - Bungee-Regular
    // - CinzelDecorative-Regular, CinzelDecorative-Bold, CinzelDecorative-Black  
    // - IMFellFrenchCanon-Regular, IMFellFrenchCanon-Italic
    // - Metamorphous-Regular
    
    // MARK: - Standard Font Sizes
    static let titleSize: CGFloat = 30
    static let subtitleSize: CGFloat = 22
    static let bodySize: CGFloat = 17
    static let captionSize: CGFloat = 13
    static let smallSize: CGFloat = 11
    
    // MARK: - Font Methods
    /// Get primary font with specified size
    static func primary(size: CGFloat) -> Font {
        // Test with system font first to verify FontManager is working
        if testWithSystemFont {
            print("🧪 TEST MODE: Using system font")
            return SwiftUI.Font.system(size: size, weight: .bold)
        }
        
        // Try different font name variations for Bungee
        let fontNames = [
            "Bungee-Regular",
            "Bungee", 
            "Bungee Regular",
            "BungeeRegular"
        ]
        
        for fontName in fontNames {
            let font = Font.custom(fontName, size: size)
            print("🔍 Trying font name: '\(fontName)'")
            
            // Try to create a UIFont to test if it exists
            if let uiFont = UIFont(name: fontName, size: size) {
                print("✅ Successfully loaded font: \(fontName)")
                return font
            }
        }
        
        print("❌ Failed to load Bungee font, falling back to system font")
        return SwiftUI.Font.system(size: size, weight: .regular)
    }
    
    /// Get system font with specified size and weight
    static func system(size: CGFloat, weight: Font.Weight = .regular) -> Font {
        return SwiftUI.Font.system(size: size, weight: weight)
    }
    
    // MARK: - Convenience Methods (All use primary font)
    static var title: Font { primary(size: titleSize) }
    static var subtitle: Font { primary(size: subtitleSize) }
    static var body: Font { primary(size: bodySize) }
    static var caption: Font { primary(size: captionSize) }
    static var small: Font { primary(size: smallSize) }
    
    // MARK: - Legacy Methods (for backward compatibility)
    static func impact(size: CGFloat) -> Font {
        return primary(size: size)
    }
    
    // MARK: - Debug Method
    static func debugAvailableFonts() {
        print("🔍 Available font families:")
        for family in UIFont.familyNames.sorted() {
            print("  - \(family)")
            for font in UIFont.fontNames(forFamilyName: family) {
                print("    - \(font)")
            }
        }
    }
}
