//
//  VictoryView.swift
//  New-Mystica
//
//  Combat victory screen with comprehensive rewards display and celebration animations
//

import SwiftUI
import SwiftData

struct VictoryView: View {
    @EnvironmentObject private var navigationManager: NavigationManager
    @Environment(AppState.self) private var appState

    // State for controlling animations
    @State private var showRewards = false
    @State private var showCelebration = false

    var body: some View {
        ZStack {
            // Background
            Color.backgroundPrimary
                .ignoresSafeArea()

            // Main content
            ScrollView {
                VStack(spacing: 32) {
                    Spacer()
                        .frame(height: 60)

                    // Header Section
                    VStack(spacing: 16) {
                        // Crown Icon with celebration effect
                        ZStack {
                            // Crown icon
                            Image(systemName: "crown.fill")
                                .font(.system(size: 64, weight: .bold))
                                .foregroundColor(.success)
                                .popup(delay: 0.2)

                            // Sparkle celebration effect
                            if showCelebration {
                                ForEach(0..<8, id: \.self) { index in
                                    sparkleView(for: index)
                                }
                            }
                        }

                        // Victory Title
                        TitleText("Victory!")
                            .foregroundColor(.success)
                            .slideInFromBottom(delay: 0.4)
                    }

                    // Rewards Section
                    if let rewards = getCombatRewards() {
                        VStack(spacing: 24) {
                            // Currencies Section
                            if rewards.currencies.gold > 0 {
                                CurrencySection(gold: rewards.currencies.gold)
                                    .slideInFromBottom(delay: 0.6)
                            }

                            // Items Section
                            if !rewards.items.isEmpty {
                                ItemsSection(items: rewards.items)
                                    .slideInFromBottom(delay: 0.8)
                            }

                            // Materials Section
                            if !rewards.materials.isEmpty {
                                MaterialsSection(materials: rewards.materials)
                                    .slideInFromBottom(delay: 1.0)
                            }
                        }
                        .opacity(showRewards ? 1 : 0)
                        .animation(.easeOut(duration: 0.6).delay(0.5), value: showRewards)
                    }

                    Spacer()
                        .frame(height: 40)

                    // Action Buttons
                    VStack(spacing: 16) {
                        // Continue Button (Primary)
                        TextButton("Continue") {
                            navigationManager.resetToMap()
                        }
                        .slideInFromBottom(delay: 1.2)

                        // Home Button (Secondary)
                        TextButton("Home") {
                            navigationManager.resetToMainMenu()
                        }
                        .slideInFromBottom(delay: 1.4)
                    }
                    .padding(.horizontal, 24)

                    Spacer()
                        .frame(height: 60)
                }
            }
        }
        .navigationBarHidden(true)
        .navigationBarBackButtonHidden(true)
        .onAppear {
            // DEBUG: Log reward data for diagnosis
            print("🎉 VictoryView appeared")
            if let rewards = appState.combatRewards {
                print("✅ Rewards received:")
                print("  - Gold: \(rewards.currencies.gold)")
                print("  - Items count: \(rewards.items.count)")
                print("  - Materials count: \(rewards.materials.count)")
                print("  - Experience: \(rewards.experience)")
                if !rewards.items.isEmpty {
                    print("  - Items: \(rewards.items.map { $0.name }.joined(separator: ", "))")
                }
                if !rewards.materials.isEmpty {
                    print("  - Materials: \(rewards.materials.map { $0.name }.joined(separator: ", "))")
                }
            } else {
                print("❌ No rewards in appState.combatRewards!")
            }

            // Trigger celebrations and reward display
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
                showCelebration = true
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                showRewards = true
            }
        }
    }

    // MARK: - Helper Views

    private func sparkleView(for index: Int) -> some View {
        let angle = Double(index) * .pi / 4
        let xOffset = cos(angle) * 60
        let yOffset = sin(angle) * 60

        return Circle()
            .fill(Color.success.opacity(0.6))
            .frame(width: 6, height: 6)
            .offset(x: xOffset, y: yOffset)
            .scaleEffect(showCelebration ? 1.0 : 0.1)
            .opacity(showCelebration ? 0.8 : 0.0)
            .animation(
                .easeOut(duration: 0.8)
                .delay(0.4 + Double(index) * 0.1),
                value: showCelebration
            )
    }

    // MARK: - Helper Methods

    private func getCombatRewards() -> CombatRewards? {
        return appState.combatRewards
    }
}

// MARK: - Currency Section

private struct CurrencySection: View {
    let gold: Int

    var body: some View {
        VStack(spacing: 12) {
            // Gold Card
            HStack(spacing: 16) {
                // Coin Icon
                Image(systemName: "dollarsign.circle.fill")
                    .font(.system(size: 32, weight: .medium))
                    .foregroundColor(.warning)

                // Gold Amount
                VStack(alignment: .leading, spacing: 4) {
                    SmallText("Gold")
                        .foregroundColor(.textSecondary)

                    Text(formatNumber(gold))
                        .font(FontManager.title)
                        .foregroundColor(.textPrimary)
                        .kerning(0.5)
                }

                Spacer()
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 16)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.backgroundCard)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color.warning.opacity(0.3), lineWidth: 1)
                    )
            )
            .padding(.horizontal, 24)
        }
    }

    private func formatNumber(_ number: Int) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        return formatter.string(from: NSNumber(value: number)) ?? "\(number)"
    }
}

// MARK: - Items Section

private struct ItemsSection: View {
    let items: [ItemDrop]

    var body: some View {
        VStack(spacing: 16) {
            TitleText("Items", size: 22)
                .foregroundColor(.textPrimary)

            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: 12) {
                ForEach(Array(items.enumerated()), id: \.offset) { index, item in
                    ItemCard(item: item)
                        .staggerIn(index: index, staggerDelay: 0.08)
                }
            }
            .padding(.horizontal, 24)
        }
    }
}

private struct ItemCard: View {
    let item: ItemDrop

    var body: some View {
        VStack(spacing: 8) {
            // Item Image
            if let imageUrlString = item.generatedImageUrl, let url = URL(string: imageUrlString) {
                CachedAsyncImage(
                    url: url,
                    content: { image in
                        image
                            .resizable()
                            .scaledToFill()
                            .frame(width: 40, height: 40)
                            .clipShape(Circle())
                    },
                    placeholder: {
                        ProgressView()
                            .frame(width: 40, height: 40)
                    }
                )
            } else {
                // No image - show placeholder
                Color.clear
                    .frame(width: 40, height: 40)
            }

            // Item Name
            Text(item.name)
                .font(FontManager.caption)
                .foregroundColor(.textPrimary)
                .lineLimit(2)
                .multilineTextAlignment(.center)
                .minimumScaleFactor(0.8)

            // Style Badge
            Text(item.styleName)
                .font(.system(size: 10, weight: .medium))
                .foregroundColor(.textPrimary)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(
                    Capsule()
                        .fill(Color.accentSecondary.opacity(0.3))
                )
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.backgroundCard)
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(colorForRarity(item.rarity), lineWidth: 2)
                )
        )
    }

    private func iconForCategory(_ category: String) -> String {
        switch category.lowercased() {
        case "weapon":
            return "sword.fill"
        case "offhand":
            return "shield.fill"
        case "head":
            return "crown.fill"
        case "armor":
            return "figure.dress.fill"
        case "feet":
            return "shoeprints.fill"
        case "accessory", "accessory_1", "accessory_2":
            return "diamond.fill"
        case "pet":
            return "pawprint.fill"
        default:
            return "questionmark.circle.fill"
        }
    }

    private func colorForRarity(_ rarity: String) -> Color {
        switch rarity.lowercased() {
        case "common":
            return .gray
        case "uncommon":
            return .green
        case "rare":
            return .blue
        case "epic":
            return .purple
        case "legendary":
            return .orange
        default:
            return .gray
        }
    }
}

// MARK: - Materials Section

private struct MaterialsSection: View {
    let materials: [MaterialDrop]

    var body: some View {
        VStack(spacing: 16) {
            TitleText("Materials", size: 22)
                .foregroundColor(.textPrimary)

            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: 12) {
                ForEach(Array(materials.enumerated()), id: \.offset) { index, material in
                    VictoryMaterialCard(material: material)
                        .staggerIn(index: index, staggerDelay: 0.08)
                }
            }
            .padding(.horizontal, 24)
        }
    }
}

private struct VictoryMaterialCard: View {
    let material: MaterialDrop

    var body: some View {
        VStack(spacing: 8) {
            // Material Image or Icon
            ZStack {
                if let imageUrl = material.imageUrl, let url = URL(string: imageUrl) {
                    CachedAsyncImage(
                        url: url,
                        content: { image in
                            image
                                .resizable()
                                .scaledToFill()
                                .frame(width: 40, height: 40)
                                .clipShape(Circle())
                        },
                        placeholder: {
                            ProgressView()
                                .frame(width: 40, height: 40)
                                .progressViewStyle(CircularProgressViewStyle(tint: .accentSecondary))
                        }
                    )
                } else {
                    Image(systemName: "cube.fill")
                        .font(.system(size: 24, weight: .medium))
                        .foregroundColor(.textPrimary)
                        .frame(width: 40, height: 40)
                        .background(
                            Circle()
                                .fill(Color.accentSecondary.opacity(0.2))
                        )
                }
            }
            .frame(width: 40, height: 40)

            // Material Name
            Text(material.name)
                .font(FontManager.caption)
                .foregroundColor(.textPrimary)
                .lineLimit(2)
                .multilineTextAlignment(.center)
                .minimumScaleFactor(0.8)

            // Style Badge
            Text(material.styleName)
                .font(.system(size: 10, weight: .medium))
                .foregroundColor(.textPrimary)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(
                    Capsule()
                        .fill(Color.accentSecondary.opacity(0.3))
                )
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.backgroundCard)
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color.accentSecondary.opacity(0.5), lineWidth: 1)
                )
        )
    }
}

// MARK: - Preview

#Preview {
    VictoryView()
        .modelContainer(for: Item.self, inMemory: true)
        .environmentObject(NavigationManager())
        .environment(AppState.shared)
}