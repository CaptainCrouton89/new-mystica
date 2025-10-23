//
//  CraftingSheet.swift
//  New-Mystica
//
//  Material application interface with 20s blocking progress and image generation
//  Integrates with CraftingViewModel for state management
//

import SwiftUI

// MARK: - Main Crafting Sheet
struct CraftingSheet: View {
    @State var viewModel: CraftingViewModel
    let item: EnhancedPlayerItem
    let onDismiss: () -> Void

    @Environment(\.navigationManager) private var navigationManager
    @Environment(\.audioManager) private var audioManager
    @State private var showMaterialSelection = false
    @State private var showSuccessResult = false

    init(item: EnhancedPlayerItem, onDismiss: @escaping () -> Void) {
        self.item = item
        self.onDismiss = onDismiss
        self._viewModel = State(initialValue: CraftingViewModel())
    }

    var body: some View {
        ZStack {
            // Background overlay
            Color.black.opacity(0.6)
                .edgesIgnoringSafeArea(.all)
                .onTapGesture {
                    if !viewModel.isProcessing {
                        audioManager.playMenuButtonClick()
                        onDismiss()
                    }
                }

            // Main content
            VStack(spacing: 0) {
                if viewModel.isProcessing {
                    // Progress view during material application
                    CraftingProgressView(
                        progress: viewModel.craftingProgress,
                        progressPercentage: viewModel.progressPercentage
                    )
                } else {
                    craftingContentView
                }
            }
            .padding(.horizontal, 20)
        }
        .task {
            // Initialize with selected item
            viewModel.selectItem(item)

            // Load available materials (mock data for now)
            // Note: This should use viewModel.loadMaterials() but using mock for build
            // viewModel.availableMaterials = .loaded(mockMaterialInventory)
        }
    }

    // MARK: - Crafting Content View

    private var craftingContentView: some View {
        VStack(spacing: 24) {
            // Header
            craftingHeaderView

            // Item display
            itemDisplayView

            // Action buttons
            actionButtonsView
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
        .shadow(color: Color.black.opacity(0.3), radius: 20, x: 0, y: 10)
    }

    private var craftingHeaderView: some View {
        HStack {
            TitleText("Craft Item", size: 24)
                .foregroundColor(Color.textPrimary)

            Spacer()

            IconButton(icon: "xmark", isDisabled: viewModel.isProcessing) {
                onDismiss()
            }
        }
    }

    private var itemDisplayView: some View {
        VStack(spacing: 12) {
            // Item image
            Group {
                if let imageUrl = viewModel.selectedItem?.generatedImageUrl, !imageUrl.isEmpty {
                    CachedAsyncImage(
                        url: URL(string: imageUrl),
                        content: { image in
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fit)
                                .frame(width: 100, height: 100)
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                        },
                        placeholder: {
                            ProgressView()
                                .frame(width: 100, height: 100)
                        }
                    )
                } else {
                    ZStack {
                        RoundedRectangle(cornerRadius: 12)
                            .fill(Color.backgroundSecondary)
                            .frame(width: 100, height: 100)

                        Image(systemName: "cube.fill")
                            .font(.system(size: 40))
                            .foregroundColor(Color.textSecondary)
                    }
                }
            }

            // Item info
            VStack(spacing: 4) {
                NormalText(viewModel.selectedItem?.baseType.capitalized ?? "Unknown Item")
                    .foregroundColor(Color.textPrimary)
                    .bold()

                SmallText("Level \(viewModel.selectedItem?.level ?? 0)")
                    .foregroundColor(Color.textSecondary)
            }
        }
    }

    private func statsPreviewView(stats: ItemStats) -> some View {
        VStack(spacing: 12) {
            TitleText("Current Stats", size: 18)
                .foregroundColor(Color.textPrimary)

            HStack(spacing: 16) {
                VStack(spacing: 4) {
                    SmallText("ATK Power")
                        .foregroundColor(Color.textSecondary)
                    NormalText(String(format: "%.0f", stats.atkPower))
                        .foregroundColor(Color.accent)
                        .bold()
                }

                VStack(spacing: 4) {
                    SmallText("DEF Power")
                        .foregroundColor(Color.textSecondary)
                    NormalText(String(format: "%.0f", stats.defPower))
                        .foregroundColor(Color.accentSecondary)
                        .bold()
                }

                VStack(spacing: 4) {
                    SmallText("ATK Acc")
                        .foregroundColor(Color.textSecondary)
                    NormalText(String(format: "%.1f", stats.atkAccuracy))
                        .foregroundColor(Color.accent)
                        .bold()
                }

                VStack(spacing: 4) {
                    SmallText("DEF Acc")
                        .foregroundColor(Color.textSecondary)
                    NormalText(String(format: "%.1f", stats.defAccuracy))
                        .foregroundColor(Color.accentSecondary)
                        .bold()
                }
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.backgroundSecondary)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color.borderSubtle, lineWidth: 1)
                )
        )
    }

    private var actionButtonsView: some View {
        HStack(spacing: 12) {
            TextButton("Cancel", height: 44, isDisabled: viewModel.isProcessing) {
                onDismiss()
            }
            .frame(maxWidth: .infinity)

            TextButton("Add Material", height: 44, isDisabled: !viewModel.canApplyMaterial) {
                showMaterialSelection = true
            }
            .frame(maxWidth: .infinity)
        }
    }

    // MARK: - Error View

    private func craftingErrorView(error: AppError) -> some View {
        ZStack {
            // Background overlay
            Color.black.opacity(0.8)
                .edgesIgnoringSafeArea(.all)

            // Error content
            VStack(spacing: 20) {
                // Error icon
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 48, weight: .medium))
                    .foregroundColor(Color.accent)

                // Error message
                VStack(spacing: 8) {
                    TitleText("Crafting Failed", size: 24)
                        .foregroundColor(Color.textPrimary)

                    NormalText(error.localizedDescription)
                        .foregroundColor(Color.textSecondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 16)
                }

                // Action buttons
                HStack(spacing: 12) {
                    TextButton("Cancel", height: 44) {
                        audioManager.playMenuButtonClick()
                        viewModel.reset()
                        onDismiss()
                    }
                    .frame(maxWidth: .infinity)

                    TextButton("Retry", height: 44) {
                        audioManager.playMenuButtonClick()
                        viewModel.craftingProgress = 0.0
                        showMaterialSelection = true
                    }
                    .frame(maxWidth: .infinity)
                }
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
            .shadow(color: Color.black.opacity(0.3), radius: 20, x: 0, y: 10)
            .padding(.horizontal, 40)
        }
    }
}

// MARK: - Mock Data
private let mockMaterials: [MaterialTemplate] = [
    MaterialTemplate(
        id: "wood",
        name: "Wood",
        description: "Natural wooden material",
        statModifiers: StatModifier(atkPower: 5, atkAccuracy: 2, defPower: 3, defAccuracy: 1),
        baseDropWeight: 100,
        createdAt: "2025-01-01T00:00:00.000000"
    ),
    MaterialTemplate(
        id: "crystal",
        name: "Crystal",
        description: "Magical crystal material",
        statModifiers: StatModifier(atkPower: 8, atkAccuracy: 5, defPower: 2, defAccuracy: 4),
        baseDropWeight: 50,
        createdAt: "2025-01-01T00:00:00.000000"
    ),
    MaterialTemplate(
        id: "metal",
        name: "Metal",
        description: "Strong metallic material",
        statModifiers: StatModifier(atkPower: 3, atkAccuracy: 1, defPower: 8, defAccuracy: 2),
        baseDropWeight: 80,
        createdAt: "2025-01-01T00:00:00.000000"
    )
]

// MARK: - Preview
#Preview {
    CraftingSheet(
        item: mockEnhancedPlayerItem,
        onDismiss: {}
    )
    .environmentObject(NavigationManager())
    .environmentObject(AudioManager.shared)
}

// MARK: - Mock Data for Preview
private let mockEnhancedPlayerItem = EnhancedPlayerItem(
    id: "mock-item-1",
    baseType: "iron_sword",
    itemTypeId: "type-1",
    category: "weapon",
    level: 5,
    rarity: "rare",
    appliedMaterials: [],
    materials: [],
    computedStats: ItemStats(atkPower: 25, atkAccuracy: 15, defPower: 5, defAccuracy: 8),
    materialComboHash: nil,
    generatedImageUrl: nil,
    imageGenerationStatus: nil,
    craftCount: 0,
    isStyled: false,
    isEquipped: false,
    equippedSlot: nil
)