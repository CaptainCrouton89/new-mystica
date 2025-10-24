//
//  TimingDialView.swift
//  New-Mystica
//
//  Placeholder component indicating timing feature not yet implemented
//  Prevents misleading users with non-functional UI elements
//

import SwiftUI

struct TimingDialView: View {
    // Note: Parameters kept for compatibility but not used
    @Binding var dialRotation: Double
    @Binding var isDialSpinning: Bool
    let onTap: () -> Void

    var body: some View {
        VStack(spacing: 8) {
            SmallText("Timing system coming soon", size: 12)
                .foregroundColor(Color.textSecondary)

            ZStack {
                // Grayed-out dial background - clearly disabled
                Circle()
                    .fill(Color.backgroundSecondary.opacity(0.3))
                    .frame(width: 60, height: 60)
                    .overlay(
                        Circle()
                            .stroke(Color.textSecondary.opacity(0.3), lineWidth: 2)
                    )

                // Static pointer - no rotation, clearly non-functional
                Rectangle()
                    .fill(Color.textSecondary.opacity(0.3))
                    .frame(width: 2, height: 20)
                    .offset(y: -10)

                // Grayed center dot
                Circle()
                    .fill(Color.textSecondary.opacity(0.3))
                    .frame(width: 6, height: 6)

                // "Coming Soon" overlay
                Image(systemName: "clock.badge.questionmark")
                    .foregroundColor(Color.textSecondary.opacity(0.6))
                    .font(.system(size: 16))
            }
        }
    }
}

#Preview {
    VStack(spacing: 20) {
        TimingDialView(
            dialRotation: .constant(0),
            isDialSpinning: .constant(false),
            onTap: {}
        )

        TimingDialView(
            dialRotation: .constant(90),
            isDialSpinning: .constant(true),
            onTap: {}
        )

        TimingDialView(
            dialRotation: .constant(180),
            isDialSpinning: .constant(false),
            onTap: {}
        )
    }
    .padding()
    .background(Color.backgroundPrimary)
}