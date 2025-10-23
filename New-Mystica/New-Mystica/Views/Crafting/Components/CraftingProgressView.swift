//
//  CraftingProgressView.swift
//  New-Mystica
//
//  Progress bar component for material application process
//  Extracted from CraftingSheet.swift for better maintainability
//

import SwiftUI

struct CraftingProgressView: View {
    let progress: Double
    let progressPercentage: Int

    var body: some View {
        VStack(spacing: 12) {
            TitleText("Applying Material...", size: 20)
                .foregroundColor(Color.textPrimary)

            VStack(spacing: 8) {
                // Progress bar
                ProgressView(value: progress, total: 1.0)
                    .progressViewStyle(LinearProgressViewStyle(tint: Color.accent))
                    .scaleEffect(x: 1, y: 2, anchor: .center)
                    .animation(.easeInOut(duration: 0.5), value: progress)

                // Percentage text
                NormalText("\(progressPercentage)%")
                    .foregroundColor(Color.accent)
                    .bold()
            }

            NormalText("Generating custom image...")
                .foregroundColor(Color.textSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(24)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.backgroundCard)
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(Color.borderSubtle, lineWidth: 1)
                )
        )
    }
}

#Preview {
    VStack(spacing: 20) {
        CraftingProgressView(progress: 0.3, progressPercentage: 30)
        CraftingProgressView(progress: 0.7, progressPercentage: 70)
        CraftingProgressView(progress: 1.0, progressPercentage: 100)
    }
    .padding()
    .background(Color.backgroundPrimary)
}