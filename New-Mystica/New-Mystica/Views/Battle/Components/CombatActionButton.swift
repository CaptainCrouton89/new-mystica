//
//  CombatActionButton.swift
//  New-Mystica
//
//  Simple combat action button for MVP0 battle interface
//  Basic button component with no timing mechanics - honest UI representation
//

import SwiftUI

struct CombatActionButton: View {
    let title: String
    let icon: String
    let color: Color
    let isDisabled: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.system(size: 24, weight: .medium))
                    .foregroundColor(isDisabled ? Color.textSecondary : color)

                NormalText(title, size: 14)
                    .foregroundColor(isDisabled ? Color.textSecondary : Color.textPrimary)
            }
            .frame(width: 80, height: 80)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(isDisabled ? Color.backgroundSecondary : Color.backgroundCard)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(isDisabled ? Color.borderSubtle : color, lineWidth: 2)
                    )
            )
        }
        .buttonStyle(PlainButtonStyle())
        .disabled(isDisabled)
        .scaleEffect(isDisabled ? 0.9 : 1.0)
    }
}

#Preview {
    HStack(spacing: 20) {
        CombatActionButton(
            title: "Attack",
            icon: "hammer.fill",
            color: Color.accent,
            isDisabled: false,
            action: {}
        )

        CombatActionButton(
            title: "Defend",
            icon: "shield.fill",
            color: Color.accentSecondary,
            isDisabled: false,
            action: {}
        )

        CombatActionButton(
            title: "Disabled",
            icon: "pause.fill",
            color: Color.accent,
            isDisabled: true,
            action: {}
        )
    }
    .padding()
    .background(Color.backgroundPrimary)
}