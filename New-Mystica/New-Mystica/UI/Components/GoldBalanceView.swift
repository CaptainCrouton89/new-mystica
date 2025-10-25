import SwiftUI

/// Gold balance display component
/// Shows coin icon and blocky number for current gold amount
struct GoldBalanceView: View {
    let amount: Int

    var body: some View {
        HStack(spacing: 6) {
            // Gold coin icon from R2
            CachedAsyncImage(
                url: URL(string: UIAssetURL.coinIcon),
                content: { image in
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(width: 28, height: 28)
                },
                placeholder: {
                    ProgressView()
                        .frame(width: 28, height: 28)
                }
            )

            // Gold amount with blocky font
            Text(formattedAmount)
                .font(FontManager.body)
                .foregroundColor(Color.textPrimary)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(
            RoundedRectangle(cornerRadius: .cornerRadiusMedium)
                .fill(Color.backgroundCard)
                .overlay(
                    RoundedRectangle(cornerRadius: .cornerRadiusMedium)
                        .stroke(Color.accentSecondary.opacity(0.3), lineWidth: 1.5)
                )
        )
        .shadow(color: .black.opacity(0.2), radius: 3, x: 0, y: 1.5)
    }

    private var formattedAmount: String {
        // Format with comma separators (e.g., 1,234)
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.groupingSeparator = ","
        return formatter.string(from: NSNumber(value: amount)) ?? "\(amount)"
    }
}

#Preview("Small Amount") {
    GoldBalanceView(amount: 123)
        .padding()
        .background(Color.backgroundPrimary)
}

#Preview("Large Amount") {
    GoldBalanceView(amount: 12345)
        .padding()
        .background(Color.backgroundPrimary)
}

#Preview("Zero") {
    GoldBalanceView(amount: 0)
        .padding()
        .background(Color.backgroundPrimary)
}
