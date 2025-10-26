//
//  HealthBarView.swift
//  New-Mystica
//
//  Health bar component for battle interface
//  Extracted from BattleView.swift for better maintainability
//

import SwiftUI

struct HealthBarView: View {
    let currentHealth: Double
    let maxHealth: Double
    let label: String
    let isPlayer: Bool

    var body: some View {
        VStack(spacing: 4) {
            // Health Label
            NormalText(label, size: 12)
                .foregroundColor(Color.textPrimary)

            // Health Bar Container
            ZStack(alignment: .leading) {
                // Background
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color.backgroundCard)
                    .frame(height: 8)
                    .overlay(
                        RoundedRectangle(cornerRadius: 4)
                            .stroke(Color.borderSubtle, lineWidth: 0.5)
                    )

                // Health Fill
                RoundedRectangle(cornerRadius: 4)
                    .fill(healthBarColor)
                    .frame(width: max(0, healthBarWidth), height: 8)
                    .animation(.easeInOut(duration: 0.3), value: currentHealth)
            }
            .frame(width: 150)
        }
    }

    // MARK: - Computed Properties

    private var healthBarColor: Color {
        let healthPercentage = currentHealth / maxHealth

        if healthPercentage > 0.6 {
            return Color.green
        } else if healthPercentage > 0.3 {
            return Color.orange
        } else {
            return Color.red
        }
    }

    private var healthBarWidth: CGFloat {
        let healthPercentage = max(0, min(1, currentHealth / maxHealth))
        return 150 * healthPercentage
    }
}

#Preview {
    VStack(spacing: 20) {
        HealthBarView(
            currentHealth: 85,
            maxHealth: 100,
            label: "Player",
            isPlayer: true
        )

        HealthBarView(
            currentHealth: 45,
            maxHealth: 100,
            label: "Enemy",
            isPlayer: false
        )

        HealthBarView(
            currentHealth: 15,
            maxHealth: 100,
            label: "Critical",
            isPlayer: true
        )
    }
    .padding()
    .background(Color.backgroundPrimary)
}