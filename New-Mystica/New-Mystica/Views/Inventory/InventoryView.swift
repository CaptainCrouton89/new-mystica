//
//  InventoryView.swift
//  New-Mystica
//
//  Displays player inventory using InventoryViewModel with LoadableView pattern
//  Replaces the dummy CollectionView with real inventory functionality
//

import SwiftUI

// MARK: - Item Row Component
struct ItemRow: View {
    let item: EnhancedPlayerItem

    var body: some View {
        HStack(spacing: 12) {
            // Item Image
            AsyncImage(url: URL(string: item.generatedImageUrl ?? "")) { phase in
                switch phase {
                case .empty:
                    ProgressView()
                        .frame(width: 50, height: 50)
                case .success(let image):
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(width: 50, height: 50)
                case .failure:
                    ZStack {
                        RoundedRectangle(cornerRadius: 8)
                            .fill(Color.backgroundSecondary)
                            .frame(width: 50, height: 50)

                        Image(systemName: getItemIcon())
                            .font(.system(size: 24, weight: .medium))
                            .foregroundColor(Color.textSecondary)
                    }
                @unknown default:
                    EmptyView()
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(getRarityColor(), lineWidth: 2)
            )

            // Item Details
            VStack(alignment: .leading, spacing: 4) {
                // Item Name and Level
                HStack {
                    NormalText(item.baseType.capitalized, size: 16)
                        .foregroundColor(Color.textPrimary)
                        .bold()

                    Spacer()

                    NormalText("Lv. \(item.level)")
                        .foregroundColor(Color.textSecondary)
                }

                // Stats Preview
                HStack(spacing: 16) {
                    StatValueView(
                        label: "ATK",
                        value: String(format: "%.0f", item.computedStats.atkPower),
                        color: Color.accent
                    )

                    StatValueView(
                        label: "DEF",
                        value: String(format: "%.0f", item.computedStats.defPower),
                        color: Color.accentSecondary
                    )

                    Spacer()
                }

                // Styling Status
                HStack {
                    if item.isStyled {
                        SmallText("Styled (\(item.appliedMaterials.count)/3)")
                            .foregroundColor(Color.accent)
                    } else {
                        SmallText("Unstyled")
                            .foregroundColor(Color.textSecondary)
                    }

                    if item.craftCount > 0 {
                        SmallText("• Crafted \(item.craftCount)x")
                            .foregroundColor(Color.textSecondary)
                    }

                    Spacer()
                }
            }

            // Chevron Indicator
            Image(systemName: "chevron.right")
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(Color.borderSubtle)
        }
        .padding(.vertical, 8)
        .padding(.horizontal, 16)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.backgroundCard)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color.borderSubtle, lineWidth: 1)
                )
        )
    }

    // MARK: - Helper Methods

    private func getItemIcon() -> String {
        let lowercased = item.baseType.lowercased()
        if lowercased.contains("sword") || lowercased.contains("weapon") {
            return "sword.fill"
        } else if lowercased.contains("shield") {
            return "shield.fill"
        } else if lowercased.contains("armor") || lowercased.contains("chest") {
            return "tshirt.fill"
        } else if lowercased.contains("head") || lowercased.contains("helmet") {
            return "crown.fill"
        } else if lowercased.contains("feet") || lowercased.contains("boot") {
            return "shoe.2.fill"
        } else if lowercased.contains("ring") || lowercased.contains("accessory") {
            return "ring.circle.fill"
        } else if lowercased.contains("pet") {
            return "pawprint.fill"
        } else {
            return "cube.fill"
        }
    }

    private func getRarityColor() -> Color {
        // Base color on styling status and level
        if item.isStyled {
            return Color.accent
        } else if item.level >= 5 {
            return Color.accentSecondary
        } else {
            return Color.borderSubtle
        }
    }
}

// MARK: - Stat Value Component
struct StatValueView: View {
    let label: String
    let value: String
    let color: Color

    var body: some View {
        HStack(spacing: 4) {
            SmallText(label)
                .foregroundColor(Color.textSecondary)

            SmallText(value)
                .foregroundColor(color)
                .bold()
        }
    }
}

// MARK: - Main Inventory View
struct InventoryView: View {
    @Environment(\.navigationManager) private var navigationManager
    @Environment(\.audioManager) private var audioManager
    @Environment(AppState.self) private var appState
    @State private var viewModel = InventoryViewModel()
    @State private var selectedSegment = 0 // 0 = All, 1 = Styled, 2 = Unstyled

    var body: some View {
        BaseView(title: "Inventory") {
            VStack(spacing: 0) {
                // Gold Balance Header
                HStack {
                    Spacer()
                    GoldBalanceView(amount: appState.getCurrencyBalance(for: .gold))
                        .padding(.trailing, 16)
                        .padding(.top, 8)
                }
                .padding(.bottom, 8)

                // Filter Segments
                filterSegmentView
                    .padding(.horizontal, 16)
                    .padding(.bottom, 12)

                // Main Content
                LoadableView(viewModel.items) { items in
                    inventoryContentView(items: filteredItems(from: items))
                } retry: {
                    Task { await viewModel.loadInventory() }
                }
            }
        }
        .refreshable {
            await viewModel.refreshInventory()
        }
        .task {
            await viewModel.loadInventory()
        }
    }

    // MARK: - Filter Segment View

    private var filterSegmentView: some View {
        HStack(spacing: 0) {
            ForEach(0..<3) { index in
                Button(action: {
                    audioManager.playMenuButtonClick()
                    selectedSegment = index
                }) {
                    Text(segmentTitle(for: index))
                        .font(FontManager.body)
                        .foregroundColor(selectedSegment == index ? Color.textPrimary : Color.textSecondary)
                        .frame(maxWidth: .infinity)
                        .frame(height: 40)
                        .background(
                            RoundedRectangle(cornerRadius: 8)
                                .fill(selectedSegment == index ? Color.accent : Color.clear)
                        )
                }
                .buttonStyle(PlainButtonStyle())
            }
        }
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.backgroundSecondary)
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color.borderSubtle, lineWidth: 1)
                )
        )
    }

    private func segmentTitle(for index: Int) -> String {
        switch index {
        case 0: return "All"
        case 1: return "Styled"
        case 2: return "Unstyled"
        default: return ""
        }
    }

    // MARK: - Inventory Content View

    private func inventoryContentView(items: [EnhancedPlayerItem]) -> some View {
        Group {
            if items.isEmpty {
                emptyStateView
            } else {
                itemListView(items: items)
            }
        }
    }

    private var emptyStateView: some View {
        VStack(spacing: 20) {
            Image(systemName: "cube.transparent")
                .font(.system(size: 48, weight: .medium))
                .foregroundColor(Color.borderSubtle)

            VStack(spacing: 8) {
                TitleText("No Items Found", size: 24)

                NormalText("Your inventory is empty in this category")
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
            }

            TextButton("Refresh") {
                Task { await viewModel.loadInventory() }
            }
            .frame(maxWidth: 200)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.backgroundPrimary)
    }

    private func itemListView(items: [EnhancedPlayerItem]) -> some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                ForEach(items, id: \.id) { item in
                    ItemRow(item: item)
                        .onTapGesture {
                            audioManager.playMenuButtonClick()
                            viewModel.selectItem(item)
                            // Navigate to item detail or crafting view
                            // TODO: Implement navigation to item detail/crafting
                        }
                }

                // Load More button
                if viewModel.canLoadMore {
                    HStack {
                        Spacer()
                        if viewModel.isLoading {
                            ProgressView()
                                .scaleEffect(0.8)
                                .padding()
                        } else {
                            TextButton("Load More") {
                                audioManager.playMenuButtonClick()
                                Task {
                                    await viewModel.loadMoreItems()
                                }
                            }
                            .frame(maxWidth: 200)
                        }
                        Spacer()
                    }
                    .padding(.top, 16)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
        }
    }

    // MARK: - Helper Methods

    private func filteredItems(from items: [EnhancedPlayerItem]) -> [EnhancedPlayerItem] {
        switch selectedSegment {
        case 1: // Styled only
            return items.filter { $0.isStyled }
        case 2: // Unstyled only
            return items.filter { !$0.isStyled }
        default: // All items
            return items
        }
    }
}


// MARK: - Preview
#Preview {
    let appState = AppState.shared
    appState.setCurrencies([CurrencyBalance(currencyCode: .gold, balance: 1234, updatedAt: "")])

    return InventoryView()
        .environmentObject(NavigationManager())
        .environmentObject(AudioManager.shared)
        .environment(appState)
}

// MARK: - Mock Data for Preview
#if DEBUG
extension InventoryView {
    static var mockItems: [EnhancedPlayerItem] {
        [
            EnhancedPlayerItem(
                id: "1",
                baseType: "iron_sword",
                level: 3,
                appliedMaterials: [],
                computedStats: ItemStats(atkPower: 25, atkAccuracy: 15, defPower: 5, defAccuracy: 8),
                materialComboHash: nil,
                generatedImageUrl: nil,
                imageGenerationStatus: nil,
                craftCount: 0,
                isStyled: false
            ),
            EnhancedPlayerItem(
                id: "2",
                baseType: "steel_armor",
                level: 5,
                appliedMaterials: [
                    ItemMaterialApplication(materialId: "wood", styleId: "rustic", slotIndex: 0),
                    ItemMaterialApplication(materialId: "crystal", styleId: "ethereal", slotIndex: 1)
                ],
                computedStats: ItemStats(atkPower: 10, atkAccuracy: 20, defPower: 45, defAccuracy: 25),
                materialComboHash: "abc123",
                generatedImageUrl: "https://example.com/styled_armor.png",
                imageGenerationStatus: .complete,
                craftCount: 2,
                isStyled: true
            )
        ]
    }
}
#endif