//
//  ProfileView.swift
//  New-Mystica
//
//  Profile and progression display with ProfileViewModel integration
//

import SwiftUI
import SwiftData

// MARK: - Currency Balance Component
struct CurrencyBalanceView: View {
    let balances: [CurrencyBalance]

    var body: some View {
        VStack(spacing: 12) {
            TitleText("Currency", size: 20)

            HStack(spacing: 20) {
                ForEach(balances, id: \.currencyCode) { balance in
                    VStack(spacing: 4) {
                        Image(systemName: currencyIcon(for: balance.currencyCode))
                            .font(.system(size: 24, weight: .medium))
                            .foregroundColor(currencyColor(for: balance.currencyCode))

                        NormalText("\(balance.balance)")
                            .foregroundColor(Color.textPrimary)
                            .bold()

                        SmallText(balance.currencyCode.rawValue.capitalized)
                            .foregroundColor(Color.textSecondary)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.backgroundCard)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color.borderSubtle, lineWidth: 1)
                )
        )
    }

    private func currencyIcon(for currency: CurrencyCode) -> String {
        switch currency {
        case .gold:
            return "dollarsign.circle.fill"
        case .gems:
            return "gem.fill"
        }
    }

    private func currencyColor(for currency: CurrencyCode) -> Color {
        switch currency {
        case .gold:
            return Color.yellow
        case .gems:
            return Color.accent
        }
    }
}

// MARK: - Profile Stats Component
struct ProfileStatsView: View {
    let profile: EnhancedUserProfile
    let progression: PlayerProgression?

    var body: some View {
        VStack(spacing: 12) {
            TitleText("Player Stats", size: 20)

            VStack(spacing: 8) {
                // Level and Experience
                VStack(spacing: 4) {
                    HStack {
                        NormalText("Level:")
                            .foregroundColor(Color.textSecondary)
                        Spacer()
                        NormalText("\(progression?.level ?? 1)")
                            .foregroundColor(Color.accent)
                            .bold()
                    }

                    if let prog = progression {
                        HStack {
                            NormalText("Experience:")
                                .foregroundColor(Color.textSecondary)
                            Spacer()
                            VStack(alignment: .trailing, spacing: 2) {
                                NormalText("\(prog.experience) / \(prog.experience + prog.xpToNextLevel)")
                                    .foregroundColor(Color.accentSecondary)
                                    .bold()

                                // Experience progress bar
                                ProgressView(value: Double(prog.experience), total: Double(prog.experience + prog.xpToNextLevel))
                                    .progressViewStyle(LinearProgressViewStyle(tint: Color.accentSecondary))
                                    .frame(width: 80)
                            }
                        }

                        HStack {
                            NormalText("Prestige Points:")
                                .foregroundColor(Color.textSecondary)
                            Spacer()
                            NormalText("\(prog.prestigePoints)")
                                .foregroundColor(Color.accent)
                                .bold()
                        }
                    }
                }

                Divider()
                    .background(Color.borderSubtle)

                // Equipment Stats
                VStack(spacing: 4) {
                    TitleText("Equipment Stats", size: 16)
                        .foregroundColor(Color.textPrimary)

                    HStack {
                        NormalText("ATK Power:")
                            .foregroundColor(Color.textSecondary)
                        Spacer()
                        NormalText(String(format: "%.0f", profile.totalStats.atkPower))
                            .foregroundColor(Color.accent)
                            .bold()
                    }

                    HStack {
                        NormalText("ATK Accuracy:")
                            .foregroundColor(Color.textSecondary)
                        Spacer()
                        NormalText(String(format: "%.1f", profile.totalStats.atkAccuracy))
                            .foregroundColor(Color.accent)
                            .bold()
                    }

                    HStack {
                        NormalText("DEF Power:")
                            .foregroundColor(Color.textSecondary)
                        Spacer()
                        NormalText(String(format: "%.0f", profile.totalStats.defPower))
                            .foregroundColor(Color.accentSecondary)
                            .bold()
                    }

                    HStack {
                        NormalText("DEF Accuracy:")
                            .foregroundColor(Color.textSecondary)
                        Spacer()
                        NormalText(String(format: "%.1f", profile.totalStats.defAccuracy))
                            .foregroundColor(Color.accentSecondary)
                            .bold()
                    }
                }
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.backgroundCard)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color.borderSubtle, lineWidth: 1)
                )
        )
    }
}

// MARK: - Progression Rewards Component
struct ProgressionRewardsView: View {
    let rewards: [LevelReward]
    let isClaimInProgress: Bool
    let onClaimReward: (LevelReward) -> Void

    var body: some View {
        VStack(spacing: 12) {
            HStack {
                TitleText("Unclaimed Rewards", size: 20)
                Spacer()
                if !rewards.isEmpty {
                    Text("\(rewards.count)")
                        .font(.caption)
                        .foregroundColor(.white)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.accent)
                        .clipShape(Capsule())
                }
            }

            if rewards.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 32))
                        .foregroundColor(Color.accentSecondary)

                    NormalText("All rewards claimed!")
                        .foregroundColor(Color.textSecondary)
                }
                .frame(minHeight: 80)
            } else {
                LazyVStack(spacing: 8) {
                    ForEach(rewards, id: \.level) { reward in
                        rewardRowView(reward: reward)
                    }
                }
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.backgroundCard)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color.borderSubtle, lineWidth: 1)
                )
        )
    }

    private func rewardRowView(reward: LevelReward) -> some View {
        HStack(spacing: 12) {
            // Reward icon
            Image(systemName: "gift.fill")
                .font(.system(size: 20))
                .foregroundColor(Color.accent)
                .frame(width: 32, height: 32)
                .background(Color.accent.opacity(0.2))
                .clipShape(Circle())

            // Reward info
            VStack(alignment: .leading, spacing: 2) {
                NormalText("Level \(reward.level) Reward")
                    .foregroundColor(Color.textPrimary)
                    .bold()

                HStack(spacing: 4) {
                    Image(systemName: "dollarsign.circle.fill")
                        .font(.system(size: 14))
                        .foregroundColor(Color.yellow)

                    SmallText("\(reward.rewardGold) Gold")
                        .foregroundColor(Color.textSecondary)
                }
            }

            Spacer()

            // Claim button
            TextButton("Claim", height: 32) {
                onClaimReward(reward)
            }
            .frame(width: 80)
            .disabled(isClaimInProgress)
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.backgroundSecondary)
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color.borderSubtle, lineWidth: 1)
                )
        )
    }
}

// MARK: - Player Info Header Component
struct PlayerInfoHeaderView: View {
    let profile: EnhancedUserProfile

    var body: some View {
        VStack(spacing: 12) {
            // Avatar placeholder
            ZStack {
                Circle()
                    .fill(Color.backgroundSecondary)
                    .frame(width: 80, height: 80)
                    .overlay(
                        Circle()
                            .stroke(Color.borderSubtle, lineWidth: 2)
                    )

                Image(systemName: "person.fill")
                    .font(.system(size: 40, weight: .light))
                    .foregroundColor(Color.textSecondary)
            }

            // Player name and info
            VStack(spacing: 4) {
                if let username = profile.username {
                    TitleText(username, size: 24)
                        .foregroundColor(Color.textPrimary)
                } else {
                    TitleText("Anonymous Player", size: 24)
                        .foregroundColor(Color.textSecondary)
                }

                HStack(spacing: 8) {
                    SmallText("Vanity Level \(profile.vanityLevel)")
                        .foregroundColor(Color.accentSecondary)

                    Text("•")
                        .foregroundColor(Color.textSecondary)

                    SmallText(profile.accountType.rawValue.capitalized)
                        .foregroundColor(Color.textSecondary)
                }
            }
        }
        .padding(20)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.backgroundCard)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color.borderSubtle, lineWidth: 1)
                )
        )
    }
}

// MARK: - Main Profile View
struct ProfileView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.audioManager) private var audioManager
    @State private var viewModel: ProfileViewModel

    init() {
        // Initialize ViewModel with AppState dependency
        self.viewModel = ProfileViewModel(appState: AppState.shared)
    }

    var body: some View {
        BaseView(title: "Profile") {
            LoadableView(appState.userProfile) { profile in
                ScrollView {
                    LazyVStack(spacing: 20) {
                        profileContent
                    }
                    .padding(.horizontal, 20)
                    .padding(.vertical, 16)
                }
                .refreshable {
                    await viewModel.refreshProfile()
                }
            } retry: {
                Task {
                    await viewModel.refreshProfile()
                }
            }
        }
        .task {
            // Load profile data when view appears
            await viewModel.loadAll()
        }
    }

    // MARK: - Profile Content
    @ViewBuilder
    private var profileContent: some View {
        // Player Info Header
        LoadableView(appState.userProfile) { profile in
            PlayerInfoHeaderView(profile: profile)
        }

        // Currency Balances (from AppState)
        LoadableView(appState.currencies) { balances in
            CurrencyBalanceView(balances: balances)
        }

        // Profile Stats
        LoadableView(appState.userProfile) { profile in
            ProfileStatsView(
                profile: profile,
                progression: viewModel.progression.value
            )
        }

        // Progression Rewards
        LoadableView(viewModel.progression) { progression in
            ProgressionRewardsView(
                rewards: progression.unclaimedRewards,
                isClaimInProgress: viewModel.rewardClaimInProgress
            ) { reward in
                audioManager.playMenuButtonClick()
                Task {
                    await viewModel.claimLevelReward(level: reward.level)
                }
            }
        }
    }
}

// MARK: - Preview
#Preview {
    ProfileView()
        .modelContainer(for: Item.self, inMemory: true)
        .environmentObject(AudioManager.shared)
        .environment(AppState.shared)
}