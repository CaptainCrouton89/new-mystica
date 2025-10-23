//
//  StatValueView.swift
//  New-Mystica
//
//  Stat value display component
//  Extracted from InventoryView.swift for better maintainability
//

import SwiftUI

struct StatValueView: View {
    let label: String
    let value: String
    let color: Color

    var body: some View {
        HStack(spacing: 4) {
            SmallText(label)
                .foregroundColor(Color.textSecondary)

            SmallText(value)
                .foregroundColor(color)
                .bold()
        }
    }
}

#Preview {
    VStack(spacing: 12) {
        HStack(spacing: 16) {
            StatValueView(label: "ATK", value: "25", color: Color.accent)
            StatValueView(label: "DEF", value: "18", color: Color.accentSecondary)
            StatValueView(label: "ACC", value: "92%", color: Color.textPrimary)
        }

        HStack(spacing: 16) {
            StatValueView(label: "HP", value: "150", color: Color.green)
            StatValueView(label: "MP", value: "75", color: Color.blue)
            StatValueView(label: "SPD", value: "12", color: Color.orange)
        }
    }
    .padding()
    .background(Color.backgroundCard)
    .cornerRadius(12)
}