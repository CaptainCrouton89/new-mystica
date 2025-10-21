import SwiftUI

/// Gold balance display component
/// Shows coin icon and blocky number for current gold amount
struct GoldBalanceView: View {
    let amount: Int

    var body: some View {
        HStack(spacing: 8) {
            // Gold coin icon from R2
            AsyncImage(url: URL(string: "https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/assets/ui/coins.png")) { phase in
                switch phase {
                case .empty:
                    ProgressView()
                        .frame(width: 48, height: 48)
                case .success(let image):
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(width: 48, height: 48)
                case .failure:
                    EmptyView()
                        .frame(width: 48, height: 48)
                @unknown default:
                    EmptyView()
                }
            }

            // Gold amount with blocky font
            Text(formattedAmount)
                .font(FontManager.title)
                .foregroundColor(Color.textPrimary)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.backgroundCard)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color.accentSecondary.opacity(0.3), lineWidth: 2)
                )
        )
        .shadow(color: .black.opacity(0.2), radius: 4, x: 0, y: 2)
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
