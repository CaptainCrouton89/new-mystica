//
//  SettingsView.swift
//  New-Mystica
//
//  Settings page with logout functionality
//  Uses SimpleNavigableView pattern with confirmation alert
//
//  DESIGN DECISION: No ViewModel Pattern
//  Rationale:
//  - Simple UI with only logout functionality and minimal state
//  - No complex business logic or data transformation required
//  - Direct service injection is appropriate for this straightforward use case
//  - MVVM pattern would add unnecessary complexity without benefits
//

import SwiftUI
import SwiftData

struct SettingsView: View {
    @Environment(AppState.self) private var appState
    @State private var authViewModel = AuthViewModel(appState: AppState.shared)
    @Environment(\.navigationManager) private var navigationManager

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
                    await authViewModel.logout()
                    navigationManager.navigateTo(.map)
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