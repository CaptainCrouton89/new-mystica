//
//  PlayerAvatarView.swift
//  New-Mystica
//
//  Player avatar component for battle interface
//  Extracted from BattleView.swift for better maintainability
//

import SwiftUI

struct PlayerAvatarView: View {
    let scale: CGFloat

    var body: some View {
        ZStack {
            // Avatar Background
            Circle()
                .fill(Color.backgroundCard)
                .frame(width: 120, height: 120)
                .overlay(
                    Circle()
                        .stroke(Color.accentSecondary, lineWidth: 3)
                )
                .shadow(color: .black.opacity(0.3), radius: 8, x: 0, y: 4)

            // Player Icon
            Image(systemName: "person.fill")
                .font(.system(size: 48, weight: .medium))
                .foregroundColor(Color.accentSecondary)
        }
        .scaleEffect(scale)
    }
}

#Preview {
    VStack(spacing: 20) {
        PlayerAvatarView(scale: 1.0)
        PlayerAvatarView(scale: 1.1)
        PlayerAvatarView(scale: 0.9)
    }
    .padding()
    .background(Color.backgroundPrimary)
}