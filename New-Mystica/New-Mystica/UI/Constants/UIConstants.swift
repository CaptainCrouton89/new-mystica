import SwiftUI

// MARK: - Corner Radius Constants
extension CGFloat {
    /// Extra small corner radius for tiny elements (4pt)
    static let cornerRadiusXSmall: CGFloat = 4

    /// Small corner radius for small cards and badges (8pt)
    static let cornerRadiusSmall: CGFloat = 8

    /// Medium corner radius for standard cards and containers (10pt) - specialty components
    static let cornerRadiusMedium: CGFloat = 10

    /// Large corner radius for standard cards and secondary containers (12pt)
    static let cornerRadiusLarge: CGFloat = 12

    /// Extra large corner radius for hero containers and main modals (16pt)
    static let cornerRadiusExtraLarge: CGFloat = 16

    /// XXL corner radius for large popup modals (20pt)
    static let cornerRadiusXXL: CGFloat = 20

    // Convenience alias for default/most common size
    static let cornerRadiusStandard: CGFloat = 16
}
