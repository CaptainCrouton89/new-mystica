//
//  SettingsView.swift
//  New-Mystica
//
//  Settings page with logout functionality
//  Uses SimpleNavigableView pattern with confirmation alert
//

import SwiftUI
import SwiftData

struct SettingsView: View {
    @EnvironmentObject var authService: AuthService
    @EnvironmentObject var navigationManager: NavigationManager

    @State private var showingLogoutAlert = false

    var body: some View {
        SimpleNavigableView(title: "Settings") {
            ScrollView {
                VStack(spacing: 20) {
                    Spacer().frame(height: 40)

                    // Placeholder sections for future settings
                    VStack(spacing: 16) {
                        TitleText("Coming Soon", size: 24)

                        NormalText("Additional settings and preferences will be available in future updates.")
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 32)
                    }

                    Spacer()

                    // Logout section at bottom
                    VStack(spacing: 16) {
                        Divider()
                            .background(Color.borderSubtle)
                            .padding(.horizontal, 32)

                        TextButton("Logout") {
                            showingLogoutAlert = true
                        }
                        .padding(.horizontal, 32)
                    }
                    .padding(.bottom, 32)
                }
                .frame(maxWidth: .infinity)
                .padding(.horizontal, 16)
            }
        }
        .alert("Logout", isPresented: $showingLogoutAlert) {
            Button("Cancel", role: .cancel) {
                // Alert dismisses automatically
            }
            Button("Logout", role: .destructive) {
                Task {
                    do {
                        try await authService.logout()
                        navigationManager.navigateTo(.map)
                    } catch {
                        // Handle errors silently for MVP0
                        // Still navigate to map even if logout fails
                        navigationManager.navigateTo(.map)
                    }
                }
            }
        } message: {
            Text("Logging out will delete your account. Are you sure?")
        }
    }
}

#Preview {
    SettingsView()
        .modelContainer(for: Item.self, inMemory: true)
        .environmentObject(AuthService.shared)
        .environmentObject(NavigationManager())
}