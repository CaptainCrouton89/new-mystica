//
//  CraftingSheet.swift
//  New-Mystica
//
//  Material application interface with 20s blocking progress and image generation
//  Integrates with CraftingViewModel for state management
//

import SwiftUI

// MARK: - Material Slot Component
struct MaterialSlotView: View {
    let slotIndex: Int
    let appliedMaterial: ItemMaterialApplication?
    let isSelected: Bool
    let onTap: () -> Void
    let onRemove: (() -> Void)?

    var body: some View {
        Button(action: onTap) {
            ZStack {
                // Slot background
                RoundedRectangle(cornerRadius: 12)
                    .fill(appliedMaterial != nil ? Color.backgroundCard : Color.backgroundSecondary)
                    .frame(width: 80, height: 80)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(isSelected ? Color.accent : (appliedMaterial != nil ? Color.accentSecondary : Color.borderSubtle), lineWidth: 2)
                    )

                if let material = appliedMaterial {
                    // Applied material
                    VStack(spacing: 4) {
                        Image(systemName: "cube.fill")
                            .font(.system(size: 24, weight: .medium))
                            .foregroundColor(Color.accent)

                        SmallText("Slot \(slotIndex + 1)")
                            .foregroundColor(Color.textSecondary)
                    }

                    // Remove button overlay
                    if let onRemove = onRemove {
                        VStack {
                            HStack {
                                Spacer()
                                Button(action: onRemove) {
                                    Image(systemName: "xmark.circle.fill")
                                        .font(.system(size: 16))
                                        .foregroundColor(Color.backgroundPrimary)
                                        .background(
                                            Circle()
                                                .fill(Color.accent)
                                                .frame(width: 20, height: 20)
                                        )
                                }
                                .buttonStyle(PlainButtonStyle())
                            }
                            Spacer()
                        }
                        .padding(4)
                    }
                } else {
                    // Empty slot placeholder
                    VStack(spacing: 4) {
                        Image(systemName: "plus.circle")
                            .font(.system(size: 24, weight: .medium))
                            .foregroundColor(Color.borderSubtle)

                        SmallText("Slot \(slotIndex + 1)")
                            .foregroundColor(Color.borderSubtle)
                    }
                }
            }
        }
        .buttonStyle(PlainButtonStyle())
    }
}

// MARK: - Progress Bar Component
struct CraftingProgressView: View {
    let progress: Double
    let progressPercentage: Int

    var body: some View {
        VStack(spacing: 12) {
            TitleText("Applying Material...", size: 20)
                .foregroundColor(Color.textPrimary)

            VStack(spacing: 8) {
                // Progress bar
                ProgressView(value: progress, total: 1.0)
                    .progressViewStyle(LinearProgressViewStyle(tint: Color.accent))
                    .scaleEffect(x: 1, y: 2, anchor: .center)
                    .animation(.easeInOut(duration: 0.5), value: progress)

                // Percentage text
                NormalText("\(progressPercentage)%")
                    .foregroundColor(Color.accent)
                    .bold()
            }

            NormalText("Generating custom image...")
                .foregroundColor(Color.textSecondary)
                .multilineTextAlignment(.center)
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
    }
}

// MARK: - Material Selection Modal
struct MaterialSelectionModal: View {
    let availableMaterials: [MaterialTemplate]
    let onSelect: (MaterialTemplate) -> Void
    let onDismiss: () -> Void

    @Environment(\.audioManager) private var audioManager

    var body: some View {
        ZStack {
            // Background overlay
            Color.black.opacity(0.6)
                .edgesIgnoringSafeArea(.all)
                .onTapGesture {
                    audioManager.playMenuButtonClick()
                    onDismiss()
                }

            // Modal content
            VStack(spacing: 20) {
                // Header
                HStack {
                    TitleText("Select Material", size: 22)
                        .foregroundColor(Color.textPrimary)

                    Spacer()

                    IconButton(icon: "xmark") {
                        onDismiss()
                    }
                }

                // Materials list
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(availableMaterials, id: \.id) { material in
                            materialRowView(material: material)
                        }
                    }
                    .padding(.horizontal, 16)
                }
                .frame(maxHeight: 400)
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

    private func materialRowView(material: MaterialTemplate) -> some View {
        Button(action: {
            audioManager.playMenuButtonClick()
            onSelect(material)
        }) {
            HStack(spacing: 12) {
                // Material icon
                ZStack {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color.backgroundSecondary)
                        .frame(width: 40, height: 40)

                    Image(systemName: "cube.fill")
                        .font(.system(size: 20, weight: .medium))
                        .foregroundColor(Color.accent)
                }

                // Material details
                VStack(alignment: .leading, spacing: 4) {
                    NormalText(material.name)
                        .foregroundColor(Color.textPrimary)
                        .bold()

                    if let description = material.description {
                        SmallText(description)
                            .foregroundColor(Color.textSecondary)
                            .lineLimit(2)
                    }

                    SmallText("Weight: \(material.baseDropWeight)")
                        .foregroundColor(Color.textSecondary)
                }

                Spacer()

                // Stats preview
                VStack(alignment: .trailing, spacing: 2) {
                    if material.statModifiers.atkPower != 0 {
                        SmallText("ATK: \(material.statModifiers.atkPower > 0 ? "+" : "")\(String(format: "%.0f", material.statModifiers.atkPower))")
                            .foregroundColor(material.statModifiers.atkPower > 0 ? Color.accent : Color.accentSecondary)
                    }
                    if material.statModifiers.defPower != 0 {
                        SmallText("DEF: \(material.statModifiers.defPower > 0 ? "+" : "")\(String(format: "%.0f", material.statModifiers.defPower))")
                            .foregroundColor(material.statModifiers.defPower > 0 ? Color.accent : Color.accentSecondary)
                    }
                }
            }
            .padding(.vertical, 8)
            .padding(.horizontal, 12)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.backgroundSecondary)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color.borderSubtle, lineWidth: 1)
                    )
            )
        }
        .buttonStyle(PlainButtonStyle())
    }
}

// MARK: - Success Result View
struct CraftingSuccessView: View {
    let item: EnhancedPlayerItem
    let onDismiss: () -> Void

    @Environment(\.audioManager) private var audioManager

    var body: some View {
        VStack(spacing: 20) {
            // Success header
            VStack(spacing: 8) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 48, weight: .medium))
                    .foregroundColor(Color.accent)

                TitleText("Material Applied!", size: 24)
                    .foregroundColor(Color.textPrimary)
            }

            // Item result
            VStack(spacing: 12) {
                // Generated image
                AsyncImage(url: URL(string: item.generatedImageUrl ?? "")) { phase in
                    switch phase {
                    case .empty:
                        ProgressView()
                            .frame(width: 120, height: 120)
                    case .success(let image):
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fit)
                            .frame(width: 120, height: 120)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(Color.accent, lineWidth: 2)
                            )
                    case .failure:
                        ZStack {
                            RoundedRectangle(cornerRadius: 12)
                                .fill(Color.backgroundSecondary)
                                .frame(width: 120, height: 120)

                            Image(systemName: "photo.fill")
                                .font(.system(size: 40))
                                .foregroundColor(Color.textSecondary)
                        }
                    @unknown default:
                        EmptyView()
                    }
                }

                // Item info
                VStack(spacing: 4) {
                    NormalText(item.baseType.capitalized)
                        .foregroundColor(Color.textPrimary)
                        .bold()

                    SmallText("Level \(item.level) • \(item.appliedMaterials.count)/3 Materials")
                        .foregroundColor(Color.textSecondary)
                }
            }

            // Updated stats preview
            VStack(spacing: 8) {
                TitleText("Updated Stats", size: 18)
                    .foregroundColor(Color.textPrimary)

                HStack(spacing: 20) {
                    VStack(spacing: 4) {
                        NormalText("ATK Power")
                            .foregroundColor(Color.textSecondary)
                        NormalText(String(format: "%.0f", item.computedStats.atkPower))
                            .foregroundColor(Color.accent)
                            .bold()
                    }

                    VStack(spacing: 4) {
                        NormalText("DEF Power")
                            .foregroundColor(Color.textSecondary)
                        NormalText(String(format: "%.0f", item.computedStats.defPower))
                            .foregroundColor(Color.accentSecondary)
                            .bold()
                    }

                    VStack(spacing: 4) {
                        NormalText("ATK Acc")
                            .foregroundColor(Color.textSecondary)
                        NormalText(String(format: "%.1f", item.computedStats.atkAccuracy))
                            .foregroundColor(Color.accent)
                            .bold()
                    }

                    VStack(spacing: 4) {
                        NormalText("DEF Acc")
                            .foregroundColor(Color.textSecondary)
                        NormalText(String(format: "%.1f", item.computedStats.defAccuracy))
                            .foregroundColor(Color.accentSecondary)
                            .bold()
                    }
                }
            }

            // Continue button
            TextButton("Continue") {
                audioManager.playMenuButtonClick()
                onDismiss()
            }
            .padding(.top, 8)
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
    }
}

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

            // Material selection modal - TODO: Re-implement after T1-T6 integration
            // if showMaterialSelection {
            //     MaterialSelectionModal(
            //         availableMaterials: mockMaterials,
            //         onSelect: { material in
            //             showMaterialSelection = false
            //             Task {
            //                 await viewModel.applyMaterial()
            //             }
            //         },
            //         onDismiss: {
            //             showMaterialSelection = false
            //         }
            //     )
            // }

            // Success result overlay - TODO: Re-implement after T1-T6 integration
            // if showSuccessResult, let craftedItem = viewModel.craftedItem {
            //     CraftingSuccessView(
            //         item: craftedItem,
            //         onDismiss: {
            //             showSuccessResult = false
            //             onDismiss()
            //         }
            //     )
            // }

            // Error overlay - TODO: Re-implement after T1-T6 integration
            // if case .error(let error) = viewModel.craftingState {
            //     craftingErrorView(error: error)
            // }
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

            // Material slots - TODO: Re-implement after T1-T6 integration
            // materialSlotsView

            // Stats preview - TODO: Re-implement after T1-T6 integration
            // if let stats = viewModel.previewStats {
            //     statsPreviewView(stats: stats)
            // }

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
            AsyncImage(url: URL(string: viewModel.selectedItem?.generatedImageUrl ?? "")) { phase in
                switch phase {
                case .empty:
                    ProgressView()
                        .frame(width: 100, height: 100)
                case .success(let image):
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(width: 100, height: 100)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                case .failure:
                    ZStack {
                        RoundedRectangle(cornerRadius: 12)
                            .fill(Color.backgroundSecondary)
                            .frame(width: 100, height: 100)

                        Image(systemName: "cube.fill")
                            .font(.system(size: 40))
                            .foregroundColor(Color.textSecondary)
                    }
                @unknown default:
                    EmptyView()
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

    // TODO: Re-implement materialSlotsView after T1-T6 integration
    // private var materialSlotsView: some View {
    //     VStack(spacing: 16) {
    //         TitleText("Material Slots", size: 18)
    //             .foregroundColor(Color.textPrimary)
    //
    //         HStack(spacing: 16) {
    //             // ForEach(0..<viewModel.maxMaterialSlots, id: \.self) { slotIndex in
    //             //     MaterialSlotView(...)
    //             // }
    //             Spacer()
    //         }
    //     }
    // }

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
    level: 5,
    appliedMaterials: [],
    computedStats: ItemStats(atkPower: 25, atkAccuracy: 15, defPower: 5, defAccuracy: 8),
    materialComboHash: nil,
    generatedImageUrl: nil,
    imageGenerationStatus: nil,
    craftCount: 0,
    isStyled: false,
    isEquipped: false,
    equippedSlot: nil
)