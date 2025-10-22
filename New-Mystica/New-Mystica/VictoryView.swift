//
//  VictoryView.swift
//  New-Mystica
//
//  Created by AI Assistant on 10/19/25.
//

import SwiftUI

struct VictoryView: View, NavigableView {
    @Environment(\.navigationManager) private var navigationManager
    @Environment(\.audioManager) private var audioManager
    @State private var selectedReward: BattleReward? = nil
    @State private var showRewardPopup = false
    
    var navigationTitle: String { "Victory!" }
    var showBackButton: Bool { false } // Cannot go back to battle
    
    // Dummy battle rewards data
    private let battleRewards = [
        BattleReward(
            id: 1,
            name: "Shadow Wolf Fang",
            imageName: "pawprint.fill",
            rarity: "Rare",
            description: "A sharp fang from the defeated Shadow Wolf. Contains traces of dark magic.",
            type: "Material"
        ),
        BattleReward(
            id: 2,
            name: "Gold Coins",
            imageName: "dollarsign.circle.fill",
            rarity: "Common",
            description: "A pouch of gold coins found on the defeated enemy.",
            type: "Currency"
        ),
        BattleReward(
            id: 3,
            name: "Health Potion",
            imageName: "drop.fill",
            rarity: "Common",
            description: "A magical potion that restores health when consumed.",
            type: "Consumable"
        ),
        BattleReward(
            id: 4,
            name: "Shadow Cloak",
            imageName: "tshirt.fill",
            rarity: "Epic",
            description: "A mysterious cloak that grants stealth abilities.",
            type: "Equipment"
        ),
        BattleReward(
            id: 5,
            name: "Experience Crystal",
            imageName: "diamond.fill",
            rarity: "Rare",
            description: "A crystal that contains valuable combat experience.",
            type: "Experience"
        ),
        BattleReward(
            id: 6,
            name: "Wolf Pelt",
            imageName: "leaf.fill",
            rarity: "Common",
            description: "A thick pelt from the Shadow Wolf, useful for crafting.",
            type: "Material"
        )
    ]
    
    let columns = [
        GridItem(.flexible()),
        GridItem(.flexible()),
        GridItem(.flexible())
    ]
    
    var body: some View {
        BaseView(title: navigationTitle, showBackButton: showBackButton) {
            VStack(spacing: 0) {
                // Victory Header
                victoryHeader
                
                // Rewards Grid
                ScrollView {
                    LazyVGrid(columns: columns, spacing: 16) {
                        ForEach(Array(battleRewards.enumerated()), id: \.element.id) { index, reward in
                            RewardItemView(reward: reward)
                                .onTapGesture {
                                    audioManager.playMenuButtonClick()
                                    selectedReward = reward
                                    showRewardPopup = true
                                }
                                .staggerIn(index: index)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 24)
                }
                
                // Home Button Footer
                homeButtonFooter
            }
        }
        .overlay(
            // Reward Detail Popup
            Group {
                if showRewardPopup, let reward = selectedReward {
                    RewardDetailPopup(
                        reward: reward,
                        isPresented: $showRewardPopup
                    )
                }
            }
        )
        .onAppear {
            audioManager.playVictory()
        }
    }
    
    // MARK: - Victory Header
    @ViewBuilder
    private var victoryHeader: some View {
        VStack(spacing: 16) {
            // Victory Icon
            ZStack {
                Circle()
                    .fill(Color.accentSecondary)
                    .frame(width: 80, height: 80)
                    .overlay(
                        Circle()
                            .stroke(Color.accent, lineWidth: 3)
                    )
                    .shadow(color: .black.opacity(0.3), radius: 8, x: 0, y: 4)
                
                Image(systemName: "crown.fill")
                    .font(.system(size: 32, weight: .medium))
                    .foregroundColor(Color.textPrimary)
            }
            .popup(delay: 0.0)
            
            // Victory Text
            VStack(spacing: 8) {
                TitleText("Victory!", size: 28)
                    .foregroundColor(Color.accentSecondary)
                    .slideInFromBottom(delay: 0.1)
                
                NormalText("You have defeated the enemy!", size: 16)
                    .foregroundColor(Color.textPrimary)
                    .multilineTextAlignment(.center)
                    .slideInFromBottom(delay: 0.2)
                
                NormalText("Claim your rewards below:", size: 14)
                    .foregroundColor(Color.textSecondary)
                    .multilineTextAlignment(.center)
                    .slideInFromBottom(delay: 0.3)
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 20)
        .padding(.bottom, 16)
    }
    
    // MARK: - Home Button Footer
    @ViewBuilder
    private var homeButtonFooter: some View {
        VStack(spacing: 0) {
            Divider()
                .background(Color.borderSubtle)
            
            TextButton("Home", height: 56) {
                audioManager.playMenuButtonClick()
                navigationManager.resetToMainMenu()
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 16)
            .slideInFromBottom(delay: 0.3)
        }
        .background(Color.backgroundPrimary)
    }
}

// MARK: - Battle Reward Model
struct BattleReward: Identifiable {
    let id: Int
    let name: String
    let imageName: String
    let rarity: String
    let description: String
    let type: String
}

// MARK: - Reward Item View
struct RewardItemView: View {
    let reward: BattleReward
    
    var body: some View {
        VStack(spacing: 8) {
            // Reward Image
            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .fill(getRarityColor())
                    .frame(height: 100)
                
                Image(systemName: reward.imageName)
                    .font(.system(size: 32, weight: .medium))
                    .foregroundColor(.white)
            }
            
            // Reward Name
            Text(reward.name)
                .font(FontManager.caption)
                .foregroundColor(Color.textPrimary)
                .lineLimit(2)
                .multilineTextAlignment(.center)
                .frame(height: 32) // Fixed height to accommodate 2 lines
            
            // Rarity Badge
            Text(reward.rarity)
                .font(FontManager.small)
                .foregroundColor(Color.textSecondary)
                .padding(.horizontal, 8)
                .padding(.vertical, 2)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color.backgroundCard)
                )
            
            // Type Badge
            Text(reward.type)
                .font(FontManager.small)
                .foregroundColor(Color.accentSecondary)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(
                    RoundedRectangle(cornerRadius: 6)
                        .fill(Color.accentSecondary.opacity(0.2))
                )
        }
    }
    
    private func getRarityColor() -> Color {
        switch reward.rarity {
        case "Common":
            return Color.borderSubtle
        case "Rare":
            return Color.accentSecondary
        case "Epic":
            return Color.accent
        case "Legendary":
            return Color.accentSecondary
        default:
            return Color.borderSubtle
        }
    }
}

// MARK: - Reward Detail Popup
struct RewardDetailPopup: View {
    let reward: BattleReward
    let isPresented: Binding<Bool>
    
    @State private var isAnimating = false
    @Environment(\.audioManager) private var audioManager
    
    var body: some View {
        ZStack {
            // Background overlay
            Color.black.opacity(0.6)
                .ignoresSafeArea()
                .onTapGesture {
                    dismissPopup()
                }
            
            // Popup content
            VStack(spacing: 0) {
                // Header with close button
                HStack {
                    Spacer()
                    
                    Button {
                        audioManager.playCancelClick()
                        dismissPopup()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 18, weight: .medium))
                            .foregroundColor(Color.textSecondary)
                            .frame(width: 32, height: 32)
                            .background(
                                Circle()
                                    .fill(Color.backgroundPrimary)
                                    .overlay(
                                        Circle()
                                            .stroke(Color.accent, lineWidth: 1)
                                    )
                            )
                    }
                    .buttonStyle(PlainButtonStyle())
                }
                .padding(.horizontal, 20)
                .padding(.top, 16)
                
                // Reward image
                ZStack {
                    RoundedRectangle(cornerRadius: 16)
                        .fill(getRarityColor())
                        .frame(height: 200)
                        .shadow(color: .black.opacity(0.3), radius: 8, x: 0, y: 4)
                    
                    Image(systemName: reward.imageName)
                        .font(.system(size: 64, weight: .medium))
                        .foregroundColor(Color.textPrimary)
                }
                .padding(.horizontal, 20)
                .padding(.top, 16)
                
                // Reward details
                VStack(spacing: 12) {
                    // Reward name
                    TitleText(reward.name, size: 24)
                        .multilineTextAlignment(.center)
                    
                    // Rarity and Type badges
                    HStack(spacing: 8) {
                        Text(reward.rarity)
                            .font(FontManager.caption)
                            .foregroundColor(Color.accentSecondary)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(
                                RoundedRectangle(cornerRadius: 12)
                                    .fill(Color.backgroundCard)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 12)
                                            .stroke(getRarityColor(), lineWidth: 2)
                                    )
                            )
                        
                        Text(reward.type)
                            .font(FontManager.caption)
                            .foregroundColor(Color.textPrimary)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(
                                RoundedRectangle(cornerRadius: 12)
                                    .fill(Color.accentSecondary.opacity(0.2))
                            )
                    }
                    
                    // Description
                    NormalText(reward.description, size: 16)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 8)
                }
                .padding(.horizontal, 20)
                .padding(.top, 20)
                .padding(.bottom, 24)
            }
            .background(
                RoundedRectangle(cornerRadius: 20)
                    .fill(Color.backgroundPrimary)
                    .overlay(
                        RoundedRectangle(cornerRadius: 20)
                            .stroke(Color.accent, lineWidth: 2)
                    )
            )
            .padding(.horizontal, 32)
            .scaleEffect(isAnimating ? 1.0 : 0.8)
            .opacity(isAnimating ? 1.0 : 0.0)
        }
        .onAppear {
            withAnimation(.spring(response: 0.5, dampingFraction: 0.8)) {
                isAnimating = true
            }
        }
    }
    
    private func dismissPopup() {
        withAnimation(.easeOut(duration: 0.3)) {
            isAnimating = false
        }
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            isPresented.wrappedValue = false
        }
    }
    
    private func getRarityColor() -> Color {
        switch reward.rarity {
        case "Common":
            return Color.borderSubtle
        case "Rare":
            return Color.accentSecondary
        case "Epic":
            return Color.accent
        case "Legendary":
            return Color.accentSecondary
        default:
            return Color.borderSubtle
        }
    }
}

#Preview {
    VictoryView()
        .environmentObject(NavigationManager())
        .environmentObject(AudioManager.shared)
}
