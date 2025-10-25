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
    let iconUrl: String?
    let fallbackIcon: String

    init(label: String, value: String, color: Color, iconUrl: String? = nil, fallbackIcon: String = "questionmark.circle") {
        self.label = label
        self.value = value
        self.color = color
        self.iconUrl = iconUrl
        self.fallbackIcon = fallbackIcon
    }

    var body: some View {
        HStack(spacing: 4) {
            // Stat Icon from R2 with SF Symbol fallback
            CachedAsyncImage(
                url: iconUrl.flatMap { URL(string: $0) },
                content: { image in
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(width: 16, height: 16)
                },
                placeholder: {
                    Image(systemName: fallbackIcon)
                        .font(.system(size: 12, weight: .semibold))
                }
            )
            .foregroundColor(color)
            .frame(width: 16, height: 16)

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