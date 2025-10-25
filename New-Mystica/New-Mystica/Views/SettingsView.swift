import SwiftUI
import SwiftData

struct SettingsView: View {
    @Environment(AppState.self) private var appState
    @State private var authViewModel = AuthViewModel(appState: AppState.shared)
    @Environment(\.navigationManager) private var navigationManager
    @ObservedObject private var audioManager = AudioManager.shared

    @State private var showingLogoutAlert = false
    @State private var showingDeleteAccountAlert = false

    var body: some View {
        SimpleNavigableView(title: "Settings") {
            ScrollView {
                VStack(spacing: 20) {
                    Spacer().frame(height: 40)

                    // Audio Settings
                    VStack(spacing: 16) {
                        // Music Toggle
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                NormalText("Music")
                                    .font(.system(size: 14, weight: .semibold))
                            }
                            Spacer()
                            Toggle("", isOn: Binding(
                                get: { appState.isMusicEnabled },
                                set: { newValue in
                                    appState.isMusicEnabled = newValue
                                    audioManager.isEnabled = newValue
                                    if newValue {
                                        audioManager.playBackgroundMusic()
                                    } else {
                                        audioManager.stopBackgroundMusic()
                                    }
                                }
                            ))
                                .tint(Color.success)
                        }
                        .padding(.horizontal, 20)
                        .padding(.vertical, 12)
                    }
                    .background(Color.backgroundCard.opacity(0.5))
                    .cornerRadius(8)
                    .padding(.horizontal, 16)

                    Spacer()

                    // Logout and Delete Account section at bottom
                    VStack(spacing: 16) {
                        Divider()
                            .background(Color.borderSubtle)
                            .padding(.horizontal, 32)

                        TextButton("Logout") {
                            showingLogoutAlert = true
                        }
                        .padding(.horizontal, 32)

                        TextButton("Delete Account", isDestructive: true) {
                            showingDeleteAccountAlert = true
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
        .alert("Delete Account", isPresented: $showingDeleteAccountAlert) {
            Button("Cancel", role: .cancel) {
                // Alert dismisses automatically
            }
            Button("Delete", role: .destructive) {
                Task {
                    await authViewModel.deleteAccount()
                    navigationManager.navigateTo(.map)
                }
            }
        } message: {
            Text("This will permanently delete your account and all associated data. This action cannot be undone.")
        }
    }
}

#Preview {
    SettingsView()
        .modelContainer(for: Item.self, inMemory: true)
        .environmentObject(AuthService.shared)
        .environmentObject(NavigationManager())
}