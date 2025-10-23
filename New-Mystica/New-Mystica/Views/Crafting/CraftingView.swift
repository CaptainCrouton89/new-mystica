//
//  CraftingView.swift
//  New-Mystica
//
//  Temporary placeholder CraftingView for navigation compliance
//  TODO: Implement full T12 CraftingView according to plan
//

import SwiftUI

struct CraftingView: View {
    @EnvironmentObject private var navigationManager: NavigationManager

    var body: some View {
        VStack(spacing: 20) {
            Text("Crafting System")
                .font(.largeTitle)
                .fontWeight(.bold)
                .foregroundColor(Color.textPrimary)

            Text("Coming Soon")
                .font(.title2)
                .foregroundColor(Color.textSecondary)

            Text("The crafting interface is currently being built.\nThis placeholder ensures the app builds successfully.")
                .font(.body)
                .foregroundColor(Color.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)

            Button("Back to Main Menu") {
                navigationManager.navigateBack()
            }
            .buttonStyle(.borderedProminent)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.backgroundPrimary)
        .navigationTitle("Crafting")
        .navigationBarBackButtonHidden(false)
    }
}

#Preview {
    CraftingView()
        .environmentObject(NavigationManager())
}