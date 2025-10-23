//
//  TimingDialView.swift
//  New-Mystica
//
//  Timing dial component for battle interface
//  Extracted from BattleView.swift for better maintainability
//

import SwiftUI

struct TimingDialView: View {
    @Binding var dialRotation: Double
    @Binding var isDialSpinning: Bool
    let onTap: () -> Void

    var body: some View {
        VStack(spacing: 8) {
            SmallText("Click for timing bonus!", size: 12)
                .foregroundColor(Color.textSecondary)

            ZStack {
                // Dial background circle
                Circle()
                    .fill(Color.backgroundCard)
                    .frame(width: 60, height: 60)
                    .overlay(
                        Circle()
                            .stroke(Color.accentSecondary, lineWidth: 2)
                    )
                    .shadow(color: .black.opacity(0.3), radius: 4, x: 0, y: 2)

                // Dial pointer
                Rectangle()
                    .fill(Color.accentSecondary)
                    .frame(width: 2, height: 20)
                    .offset(y: -10)
                    .rotationEffect(.degrees(dialRotation))

                // Center dot
                Circle()
                    .fill(Color.accentSecondary)
                    .frame(width: 6, height: 6)
            }
            .onTapGesture {
                onTap()
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