//
//  LootBoxView.swift
//  New-Mystica
//
//  Alternate victory screen featuring loot box opening animation
//

import SwiftUI
import SwiftData

struct LootBoxView: View {
    @EnvironmentObject private var navigationManager: NavigationManager
    @Environment(AppState.self) private var appState
    
    // Animation states
    @State private var showBox = false
    @State private var boxOpened = false
    @State private var showLootBeam = false
    @State private var showLootItems = false
    @State private var boxScale: CGFloat = 0.5
    @State private var boxRotation: Double = 0
    @State private var lootBurst = false
    
    var body: some View {
        ZStack {
            // Background with particle effects
            Color.backgroundPrimary
                .ignoresSafeArea()
            
            // Animated gradient background
            RadialGradient(
                gradient: Gradient(colors: [
                    Color.accent.opacity(0.15),
                    Color.backgroundPrimary
                ]),
                center: .center,
                startRadius: 50,
                endRadius: 400
            )
            .ignoresSafeArea()
            .scaleEffect(showLootBeam ? 1.2 : 1.0)
            .opacity(showLootBeam ? 1 : 0)
            .animation(.easeInOut(duration: 0.8), value: showLootBeam)
            
            VStack(spacing: 0) {
                Spacer()
                
                // Loot Box Container
                ZStack {
                    // Light beam effect when opening
                    if showLootBeam {
                        LootBeamEffect()
                    }
                    
                    // Loot Box
                    LootBoxIcon(isOpened: boxOpened)
                        .scaleEffect(boxScale)
                        .rotation3DEffect(
                            .degrees(boxRotation),
                            axis: (x: 0, y: 1, z: 0)
                        )
                        .opacity(showBox ? 1 : 0)
                    
                    // Loot items bursting out
                    if showLootItems, let rewards = getCombatRewards() {
                        LootBurstView(rewards: rewards, burst: lootBurst)
                    }
                }
                .frame(height: 300)
                
                Spacer()
                
                // Rewards detail section
                if showLootItems, let rewards = getCombatRewards() {
                    ScrollView {
                        VStack(spacing: 20) {
                            // Title
                            TitleText("Loot Acquired!")
                                .foregroundColor(.success)
                                .slideInFromBottom(delay: 2.0)
                            
                            // Detailed rewards list
                            LootBoxRewardsSection(rewards: rewards)
                                .slideInFromBottom(delay: 2.2)
                        }
                        .padding(.horizontal, 24)
                    }
                    .frame(maxHeight: 300)
                }
                
                Spacer()
                    .frame(height: 20)
                
                // Action Buttons
                VStack(spacing: 12) {
                    TextButton("Collect Loot") {
                        navigationManager.resetToMap()
                    }
                    .slideInFromBottom(delay: 2.6)
                    
                    TextButton("Home") {
                        navigationManager.resetToMainMenu()
                    }
                    .slideInFromBottom(delay: 2.8)
                }
                .padding(.horizontal, 24)
                
                Spacer()
                    .frame(height: 40)
            }
        }
        .navigationBarHidden(true)
        .navigationBarBackButtonHidden(true)
        .onAppear {
            playLootBoxSequence()
        }
    }
    
    // MARK: - Animation Sequence
    
    private func playLootBoxSequence() {
        // 1. Show box (0s)
        withAnimation(.spring(response: 0.6, dampingFraction: 0.6)) {
            showBox = true
            boxScale = 1.0
        }
        
        // 2. Box shake/rotation (1s)
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            withAnimation(.easeInOut(duration: 0.3).repeatCount(3, autoreverses: true)) {
                boxRotation = 15
            }
        }
        
        // 3. Box opens (2s)
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            withAnimation(.spring(response: 0.5, dampingFraction: 0.7)) {
                boxOpened = true
                showLootBeam = true
            }
        }
        
        // 4. Loot bursts out (2.3s)
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.3) {
            withAnimation(.spring(response: 0.6, dampingFraction: 0.6)) {
                showLootItems = true
                lootBurst = true
            }
        }
        
        // 5. Reset rotation (2.5s)
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) {
            withAnimation(.easeOut(duration: 0.5)) {
                boxRotation = 0
            }
        }
    }
    
    // MARK: - Helper Methods
    
    private func getCombatRewards() -> CombatRewards? {
        return appState.combatRewards
    }
}

// MARK: - Loot Box Icon

private struct LootBoxIcon: View {
    let isOpened: Bool
    
    var body: some View {
        ZStack {
            // Closed box
            if !isOpened {
                VStack(spacing: 0) {
                    // Lid
                    RoundedRectangle(cornerRadius: 12)
                        .fill(
                            LinearGradient(
                                colors: [Color.accentSecondary, Color.accentSecondary.opacity(0.7)],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )
                        .frame(width: 140, height: 40)
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Color.success.opacity(0.6), lineWidth: 3)
                        )
                    
                    // Body
                    RoundedRectangle(cornerRadius: 12)
                        .fill(
                            LinearGradient(
                                colors: [Color.accent.opacity(0.8), Color.accent],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )
                        .frame(width: 120, height: 100)
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Color.accentInteractive, lineWidth: 3)
                        )
                    
                    // Lock icon
                    Image(systemName: "lock.fill")
                        .font(.system(size: 28, weight: .bold))
                        .foregroundColor(.textPrimary)
                        .offset(y: -70)
                }
            } else {
                // Opened box
                VStack(spacing: 0) {
                    // Lid (opened/tilted)
                    RoundedRectangle(cornerRadius: 12)
                        .fill(
                            LinearGradient(
                                colors: [Color.accentSecondary, Color.accentSecondary.opacity(0.7)],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )
                        .frame(width: 140, height: 40)
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Color.success.opacity(0.6), lineWidth: 3)
                        )
                        .rotationEffect(.degrees(-30))
                        .offset(x: -20, y: -15)
                    
                    // Body (empty)
                    RoundedRectangle(cornerRadius: 12)
                        .fill(
                            LinearGradient(
                                colors: [Color.accent.opacity(0.6), Color.accent.opacity(0.8)],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )
                        .frame(width: 120, height: 100)
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Color.accentInteractive, lineWidth: 3)
                        )
                        .offset(y: -5)
                    
                    // Unlocked icon
                    Image(systemName: "lock.open.fill")
                        .font(.system(size: 28, weight: .bold))
                        .foregroundColor(.success)
                        .offset(y: -80)
                }
            }
        }
    }
}

// MARK: - Loot Beam Effect

private struct LootBeamEffect: View {
    @State private var beamOpacity: Double = 0
    @State private var beamHeight: CGFloat = 0
    
    var body: some View {
        ZStack {
            // Main beam
            Rectangle()
                .fill(
                    LinearGradient(
                        colors: [
                            Color.success.opacity(0.8),
                            Color.success.opacity(0.4),
                            Color.clear
                        ],
                        startPoint: .bottom,
                        endPoint: .top
                    )
                )
                .frame(width: 80, height: beamHeight)
                .blur(radius: 20)
                .offset(y: -beamHeight / 2)
            
            // Side beams
            ForEach(0..<6, id: \.self) { index in
                sparkleBeam(for: index)
            }
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.6)) {
                beamOpacity = 1
                beamHeight = 400
            }
        }
    }
    
    private func sparkleBeam(for index: Int) -> some View {
        let angle = Double(index) * 60.0
        let length: CGFloat = 100
        
        return Rectangle()
            .fill(
                LinearGradient(
                    colors: [
                        Color.accentSecondary.opacity(0.6),
                        Color.clear
                    ],
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
            .frame(width: length, height: 3)
            .blur(radius: 2)
            .rotationEffect(.degrees(angle))
            .opacity(beamOpacity)
            .animation(
                .easeInOut(duration: 0.8)
                .repeatForever(autoreverses: true)
                .delay(Double(index) * 0.1),
                value: beamOpacity
            )
    }
}

// MARK: - Loot Burst View

private struct LootBurstView: View {
    let rewards: CombatRewards
    let burst: Bool
    
    @State private var itemsFloating = false
    
    var body: some View {
        ZStack {
            // Gold coins bursting
            if rewards.currencies.gold > 0 {
                ForEach(0..<5, id: \.self) { index in
                    goldCoinBurst(index: index)
                }
            }
            
            // Item icons bursting
            if let items = rewards.items, !items.isEmpty {
                ForEach(Array(items.prefix(3).enumerated()), id: \.offset) { index, item in
                    itemBurst(item: item, index: index + 5)
                }
            }
            
            // Material icons bursting
            if let materials = rewards.materials, !materials.isEmpty {
                ForEach(Array(materials.prefix(3).enumerated()), id: \.offset) { index, material in
                    materialBurst(material: material, index: index + 8)
                }
            }
        }
    }
    
    private func goldCoinBurst(index: Int) -> some View {
        let angle = Double(index) * 72.0 - 90
        let distance: CGFloat = burst ? 120 : 0
        let xOffset = cos(angle * .pi / 180) * distance
        let yOffset = sin(angle * .pi / 180) * distance
        
        return Image(systemName: "dollarsign.circle.fill")
            .font(.system(size: 32, weight: .bold))
            .foregroundColor(.warning)
            .offset(x: xOffset, y: yOffset)
            .opacity(burst ? 0.8 : 0)
            .scaleEffect(burst ? 1.0 : 0.3)
            .animation(
                .spring(response: 0.6, dampingFraction: 0.5)
                .delay(Double(index) * 0.05),
                value: burst
            )
    }
    
    private func itemBurst(item: ItemDrop, index: Int) -> some View {
        let angle = Double(index) * 40.0 - 90
        let distance: CGFloat = burst ? 140 : 0
        let xOffset = cos(angle * .pi / 180) * distance
        let yOffset = sin(angle * .pi / 180) * distance
        
        return ZStack {
            Circle()
                .fill(Color.rarityBorderColor(for: item.rarity).opacity(0.3))
                .frame(width: 40, height: 40)
            
            Image(systemName: getItemIcon(item))
                .font(.system(size: 20, weight: .bold))
                .foregroundColor(Color.rarityBorderColor(for: item.rarity))
        }
        .offset(x: xOffset, y: yOffset)
        .opacity(burst ? 1.0 : 0)
        .scaleEffect(burst ? 1.0 : 0.3)
        .animation(
            .spring(response: 0.6, dampingFraction: 0.5)
            .delay(Double(index) * 0.05),
            value: burst
        )
    }
    
    private func materialBurst(material: MaterialDrop, index: Int) -> some View {
        let angle = Double(index) * 40.0 - 90
        let distance: CGFloat = burst ? 140 : 0
        let xOffset = cos(angle * .pi / 180) * distance
        let yOffset = sin(angle * .pi / 180) * distance
        
        return ZStack {
            Circle()
                .fill(Color.accentSecondary.opacity(0.3))
                .frame(width: 40, height: 40)
            
            Image(systemName: "cube.fill")
                .font(.system(size: 20, weight: .bold))
                .foregroundColor(.accentSecondary)
        }
        .offset(x: xOffset, y: yOffset)
        .opacity(burst ? 1.0 : 0)
        .scaleEffect(burst ? 1.0 : 0.3)
        .animation(
            .spring(response: 0.6, dampingFraction: 0.5)
            .delay(Double(index) * 0.05),
            value: burst
        )
    }
    
    private func getItemIcon(_ item: ItemDrop) -> String {
        // Return appropriate SF Symbol based on item category
        switch item.category.lowercased() {
        case "armor", "body":
            return "figure.walk"
        case "gloves", "hands":
            return "hand.raised.fill"
        case "weapon", "weapons":
            return "sword.fill"
        case "boots", "feet":
            return "shoeprints.fill"
        case "helmet", "head":
            return "crown.fill"
        default:
            return "cube.fill"
        }
    }
}

// MARK: - Loot Box Rewards Section

private struct LootBoxRewardsSection: View {
    let rewards: CombatRewards
    
    var body: some View {
        VStack(spacing: 16) {
            // Gold
            if rewards.currencies.gold > 0 {
                LootBoxRewardRow(
                    icon: "dollarsign.circle.fill",
                    iconColor: .warning,
                    title: "Gold",
                    value: "\(rewards.currencies.gold)"
                )
            }
            
            // Items
            if let items = rewards.items, !items.isEmpty {
                ForEach(Array(items.enumerated()), id: \.offset) { index, item in
                    LootBoxItemRow(item: item)
                }
            }
            
            // Materials
            if let materials = rewards.materials, !materials.isEmpty {
                ForEach(Array(materials.enumerated()), id: \.offset) { index, material in
                    LootBoxMaterialRow(material: material)
                }
            }
        }
    }
}

private struct LootBoxRewardRow: View {
    let icon: String
    let iconColor: Color
    let title: String
    let value: String
    
    var body: some View {
        HStack(spacing: 16) {
            // Icon
            Image(systemName: icon)
                .font(.system(size: 28, weight: .bold))
                .foregroundColor(iconColor)
                .frame(width: 44, height: 44)
                .background(
                    Circle()
                        .fill(iconColor.opacity(0.2))
                )
            
            // Title
            NormalText(title)
                .foregroundColor(.textSecondary)
            
            Spacer()
            
            // Value
            TitleText(value, size: 24)
                .foregroundColor(.textPrimary)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.backgroundCard)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(iconColor.opacity(0.3), lineWidth: 1)
                )
        )
    }
}

private struct LootBoxItemRow: View {
    let item: ItemDrop
    
    var body: some View {
        HStack(spacing: 16) {
            // Item image or icon
            if let imageUrlString = item.generatedImageUrl, let url = URL(string: imageUrlString) {
                CachedAsyncImage(
                    url: url,
                    content: { image in
                        image
                            .resizable()
                            .scaledToFill()
                            .frame(width: 44, height: 44)
                            .clipShape(Circle())
                    },
                    placeholder: {
                        ProgressView()
                            .frame(width: 44, height: 44)
                    }
                )
            } else {
                Image(systemName: "questionmark.circle.fill")
                    .font(.system(size: 28, weight: .bold))
                    .foregroundColor(Color.rarityBorderColor(for: item.rarity))
                    .frame(width: 44, height: 44)
            }
            
            // Item details
            VStack(alignment: .leading, spacing: 4) {
                Text(item.name)
                    .font(FontManager.body)
                    .foregroundColor(.textPrimary)
                
                Text(item.rarity.capitalized)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(Color.rarityBorderColor(for: item.rarity))
            }
            
            Spacer()
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.backgroundCard)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color.rarityBorderColor(for: item.rarity), lineWidth: 2)
                )
        )
    }
}

private struct LootBoxMaterialRow: View {
    let material: MaterialDrop
    
    var body: some View {
        HStack(spacing: 16) {
            // Material image or icon
            if let imageUrl = material.imageUrl, let url = URL(string: imageUrl) {
                CachedAsyncImage(
                    url: url,
                    content: { image in
                        image
                            .resizable()
                            .scaledToFill()
                            .frame(width: 44, height: 44)
                            .clipShape(Circle())
                    },
                    placeholder: {
                        ProgressView()
                            .frame(width: 44, height: 44)
                    }
                )
            } else {
                Image(systemName: "cube.fill")
                    .font(.system(size: 28, weight: .bold))
                    .foregroundColor(.accentSecondary)
                    .frame(width: 44, height: 44)
                    .background(
                        Circle()
                            .fill(Color.accentSecondary.opacity(0.2))
                    )
            }
            
            // Material details
            VStack(alignment: .leading, spacing: 4) {
                Text(material.name)
                    .font(FontManager.body)
                    .foregroundColor(.textPrimary)
                
                Text(material.displayName)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(.accentSecondary)
            }
            
            Spacer()
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.backgroundCard)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color.accentSecondary.opacity(0.3), lineWidth: 1)
                )
        )
    }
}

// MARK: - Preview

#Preview {
    LootBoxView()
        .modelContainer(for: Item.self, inMemory: true)
        .environmentObject(NavigationManager())
        .environment(AppState.shared)
}

