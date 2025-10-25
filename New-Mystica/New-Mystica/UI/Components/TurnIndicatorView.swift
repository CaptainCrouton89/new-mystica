import SwiftUI

/// Turn indicator display component for combat
/// Shows turn number with a badge-style display similar to GoldBalanceView
struct TurnIndicatorView: View {
    let turnNumber: Int

    var body: some View {
        HStack(spacing: 6) {
            // Sword icon for combat
            Image(systemName: "figure.combative")
                .font(.system(size: 16, weight: .semibold))
                .foregroundColor(Color.accent)

            // Turn number with label
            HStack(spacing: 2) {
                Text("Turn")
                    .font(FontManager.caption)
                    .foregroundColor(Color.textSecondary)

                Text("\(turnNumber)")
                    .font(FontManager.body)
                    .fontWeight(.semibold)
                    .foregroundColor(Color.textPrimary)
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(
            RoundedRectangle(cornerRadius: .cornerRadiusMedium)
                .fill(Color.backgroundCard)
                .overlay(
                    RoundedRectangle(cornerRadius: .cornerRadiusMedium)
                        .stroke(Color.accent.opacity(0.3), lineWidth: 1.5)
                )
        )
        .shadow(color: .black.opacity(0.2), radius: 3, x: 0, y: 1.5)
    }
}

#Preview("Turn 1") {
    TurnIndicatorView(turnNumber: 1)
        .padding()
        .background(Color.backgroundPrimary)
}

#Preview("Turn 5") {
    TurnIndicatorView(turnNumber: 5)
        .padding()
        .background(Color.backgroundPrimary)
}

#Preview("Turn 15") {
    TurnIndicatorView(turnNumber: 15)
        .padding()
        .background(Color.backgroundPrimary)
}
