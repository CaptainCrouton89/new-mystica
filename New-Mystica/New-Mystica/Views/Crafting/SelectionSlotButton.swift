//
//  SelectionSlotButton.swift
//  New-Mystica
//
//  Unified button component for item and material selection slots
//  Provides consistent UI for both add item and add material buttons
//

import SwiftUI

struct SelectionSlotButton<Content: View>: View {
    let content: Content
    let onTap: () -> Void
    let isFilled: Bool

    init(isFilled: Bool, onTap: @escaping () -> Void, @ViewBuilder content: () -> Content) {
        self.isFilled = isFilled
        self.onTap = onTap
        self.content = content()
    }

    var body: some View {
        Button(action: onTap) {
            content
                .frame(width: 120, height: 160)
                .background(
                    RoundedRectangle(cornerRadius: .cornerRadiusExtraLarge)
                        .fill(isFilled ? Color.backgroundCard : Color.backgroundSecondary)
                        .overlay(
                            RoundedRectangle(cornerRadius: .cornerRadiusExtraLarge)
                                .stroke(isFilled ? Color.borderSubtle : Color.borderSubtle, lineWidth: 2)
                        )
                )
        }
        .buttonStyle(PlainButtonStyle())
    }
}

// MARK: - Preview

#Preview {
    VStack(spacing: 24) {
        // Empty state
        SelectionSlotButton(isFilled: false, onTap: {}) {
            VStack(spacing: 12) {
                Image(systemName: "plus")
                    .font(.system(size: 32, weight: .medium))
                    .foregroundColor(Color.textSecondary)

                NormalText("+ Select Item")
                    .foregroundColor(Color.textSecondary)
                    .font(FontManager.body)

                SmallText("Tap to choose")
                    .foregroundColor(Color.textSecondary.opacity(0.7))
            }
        }

        // Filled state
        SelectionSlotButton(isFilled: true, onTap: {}) {
            VStack(spacing: 8) {
                ZStack {
                    RoundedRectangle(cornerRadius: .cornerRadiusLarge)
                        .fill(Color.backgroundSecondary)
                        .frame(width: 80, height: 80)

                    Image(systemName: "cube.fill")
                        .font(.system(size: 32, weight: .medium))
                        .foregroundColor(Color.textSecondary)
                }
                .clipShape(RoundedRectangle(cornerRadius: .cornerRadiusLarge))
                .overlay(
                    RoundedRectangle(cornerRadius: .cornerRadiusLarge)
                        .stroke(Color.accent, lineWidth: 3)
                )

                VStack(spacing: 2) {
                    NormalText("Iron Sword")
                        .font(FontManager.body)
                        .foregroundColor(Color.textPrimary)
                        .lineLimit(2)
                        .multilineTextAlignment(.center)
                        .minimumScaleFactor(0.8)

                    SmallText("Lv. 5")
                        .font(FontManager.caption)
                        .foregroundColor(Color.textSecondary)
                }
            }
        }
    }
    .padding()
    .background(Color.backgroundPrimary)
}
