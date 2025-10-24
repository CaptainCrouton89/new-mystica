//
//  VanityLevelCalculator.swift
//  New-Mystica
//
//  Created by Claude Code
//

import Foundation

/// Utility for calculating recommended combat level based on equipped items
struct VanityLevelCalculator {

    /// Calculates recommended combat level from equipped items
    /// - Parameter equippedItems: Array of equipped PlayerItems (up to 8 slots)
    /// - Returns: Recommended level (1-10 range, clamped)
    ///
    /// Logic:
    /// - Sum all equipped item levels
    /// - Divide by 8 (total equipment slots)
    /// - Round to nearest integer
    /// - Clamp to 1-10 range
    /// - Fallback to level 1 if no equipped items
    static func calculateRecommendedLevel(equippedItems: [PlayerItem]) -> Int {
        // Handle empty equipped items - fallback to level 1
        guard !equippedItems.isEmpty else {
            return 1
        }

        // Sum all equipped item levels
        let totalLevels = equippedItems.reduce(0) { $0 + $1.level }

        // Calculate average level (divide by 8 equipment slots)
        let averageLevel = Double(totalLevels) / 8.0

        // Round to nearest integer
        let rounded = Int(round(averageLevel))

        // Clamp to 1-10 range
        return max(1, min(10, rounded))
    }
}