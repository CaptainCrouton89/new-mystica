//
//  CraftingView.swift
//  New-Mystica
//
//  Full crafting interface implementation using existing components
//  Implements item + material selection, stat preview, and material application
//

import SwiftUI
import SwiftData

struct CraftingView: View {
    @EnvironmentObject private var navigationManager: NavigationManager
    @Environment(\.audioManager) private var audioManager

    @State private var viewModel = CraftingViewModel()
    @State private var showItemSelection = false
    @State private var showMaterialSelection = false
    @State private var showCraftingProgress = false
    @State private var showSuccessResult = false
    @State private var showErrorAlert = false
    @State private var errorMessage = ""

    // Navigation parameters (if navigated from inventory with preselection)
    var preselectedItem: EnhancedPlayerItem?
    var preselectedMaterial: MaterialInventoryStack?

    var body: some View {
        ZStack {
            // Background
            Color.backgroundPrimary
                .ignoresSafeArea()

            // Main content
            ScrollView {
                VStack(spacing: 24) {
                    // Header
                    headerView

                    // Selection area
                    selectionArea

                    // Stats preview (only show when both selected)
                    if let baseStats = viewModel.baseStats,
                       let previewStats = viewModel.previewStats {
                        StatPreview(
                            baseStats: baseStats,
                            previewStats: previewStats,
                            showComparison: true
                        )
                        .padding(.horizontal, 20)
                    }

                    // Craft button
                    if viewModel.selectedItem != nil && viewModel.selectedMaterial != nil {
                        CraftButton(
                            isEnabled: viewModel.canApplyMaterial,
                            isProcessing: viewModel.isProcessing,
                            onCraft: {
                                Task {
                                    await craftItem()
                                }
                            }
                        )
                        .padding(.horizontal, 20)
                    }

                    Spacer(minLength: 40)
                }
                .padding(.top, 20)
            }

            // Overlays
            if showCraftingProgress {
                craftingProgressOverlay
            }

            if showSuccessResult, let craftedItem = viewModel.craftedItem {
                successResultOverlay(item: craftedItem)
            }
        }
        .navigationTitle("Crafting")
        .navigationBarBackButtonHidden(false)
        .task {
            // Load initial data
            await loadData()

            // Pre-select if navigated from inventory
            if let item = preselectedItem {
                viewModel.selectItem(item)
            }
            if let material = preselectedMaterial {
                viewModel.selectMaterial(material)
            }
        }
        .alert("Crafting Error", isPresented: $showErrorAlert) {
            Button("OK") {
                showErrorAlert = false
            }
        } message: {
            Text(errorMessage)
        }
        .bottomDrawer(
            title: "Select Item",
            isPresented: $showItemSelection
        ) {
            itemSelectionDrawerContent
        }
        .bottomDrawer(
            title: "Select Material",
            isPresented: $showMaterialSelection
        ) {
            materialSelectionDrawerContent
        }
    }

    // MARK: - Header View

    private var headerView: some View {
        VStack(spacing: 8) {
            TitleText("Craft Your Items", size: 28)
                .foregroundColor(Color.textPrimary)

            NormalText("Select an item and material to enhance its stats")
                .foregroundColor(Color.textSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(.horizontal, 20)
    }

    // MARK: - Selection Area

    private var selectionArea: some View {
        HStack(spacing: 16) {
            // Item slot
            ItemSlotSelector(
                selectedItem: viewModel.selectedItem,
                onTap: {
                    audioManager.playMenuButtonClick()
                    showItemSelection = true
                }
            )

            // Plus icon
            Image(systemName: "plus.circle.fill")
                .font(.system(size: 32, weight: .medium))
                .foregroundColor(Color.accent)

            // Material slot
            MaterialSlotSelector(
                selectedMaterial: viewModel.selectedMaterial,
                onTap: {
                    audioManager.playMenuButtonClick()
                    showMaterialSelection = true
                }
            )
        }
        .padding(.horizontal, 20)
    }

    // MARK: - Item Selection Drawer Content

    private var itemSelectionDrawerContent: some View {
        Group {
            switch viewModel.availableItems {
            case .idle, .loading:
                VStack {
                    Spacer()
                    ProgressView("Loading items...")
                    Spacer()
                }

            case .loaded(let items):
                if items.isEmpty {
                    emptyItemsView
                } else {
                    itemsGridView(items: items)
                }

            case .error(let error):
                errorView(message: error.localizedDescription)
            }
        }
    }

    private var emptyItemsView: some View {
        VStack(spacing: 16) {
            Spacer()

            Image(systemName: "tray")
                .font(.system(size: 48, weight: .light))
                .foregroundColor(Color.textSecondary)

            NormalText("No items available for crafting")
                .multilineTextAlignment(.center)
                .foregroundColor(Color.textSecondary)

            Spacer()
        }
    }

    private func itemsGridView(items: [EnhancedPlayerItem]) -> some View {
        ScrollView {
            LazyVGrid(
                columns: [
                    GridItem(.adaptive(minimum: 140), spacing: 12)
                ],
                spacing: 12
            ) {
                ForEach(items, id: \.id) { item in
                    ItemSlotSelector(
                        selectedItem: item,
                        onTap: {
                            audioManager.playMenuButtonClick()
                            viewModel.selectItem(item)
                            showItemSelection = false
                        }
                    )
                }
            }
            .padding(.horizontal, 20)
        }
    }

    // MARK: - Material Selection Drawer Content

    private var materialSelectionDrawerContent: some View {
        Group {
            switch viewModel.availableMaterials {
            case .idle, .loading:
                VStack {
                    Spacer()
                    ProgressView("Loading materials...")
                    Spacer()
                }

            case .loaded(let materials):
                if materials.isEmpty {
                    emptyMaterialsView
                } else {
                    materialsGridView(materials: materials)
                }

            case .error(let error):
                errorView(message: error.localizedDescription)
            }
        }
    }

    private var emptyMaterialsView: some View {
        VStack(spacing: 16) {
            Spacer()

            Image(systemName: "cube")
                .font(.system(size: 48, weight: .light))
                .foregroundColor(Color.textSecondary)

            NormalText("No materials available")
                .multilineTextAlignment(.center)
                .foregroundColor(Color.textSecondary)

            Spacer()
        }
    }

    private func materialsGridView(materials: [MaterialInventoryStack]) -> some View {
        ScrollView {
            LazyVGrid(
                columns: [
                    GridItem(.adaptive(minimum: 140), spacing: 12)
                ],
                spacing: 12
            ) {
                ForEach(materials, id: \.materialId) { material in
                    MaterialSlotSelector(
                        selectedMaterial: material,
                        onTap: {
                            audioManager.playMenuButtonClick()
                            viewModel.selectMaterial(material)
                            showMaterialSelection = false
                        }
                    )
                }
            }
            .padding(.horizontal, 20)
        }
    }

    private func errorView(message: String) -> some View {
        VStack(spacing: 16) {
            Spacer()

            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 48, weight: .light))
                .foregroundColor(Color.red)

            NormalText(message)
                .multilineTextAlignment(.center)
                .foregroundColor(Color.textSecondary)

            Spacer()
        }
    }

    // MARK: - Crafting Progress Overlay

    private var craftingProgressOverlay: some View {
        ZStack {
            Color.black.opacity(0.8)
                .ignoresSafeArea()

            VStack(spacing: 20) {
                TitleText("Crafting...", size: 24)
                    .foregroundColor(Color.textPrimary)

                ProgressView(value: viewModel.craftingProgress, total: 1.0)
                    .progressViewStyle(LinearProgressViewStyle(tint: Color.accent))
                    .scaleEffect(x: 1, y: 2, anchor: .center)
                    .frame(width: 200)

                NormalText("\(viewModel.progressPercentage)%")
                    .foregroundColor(Color.accent)
                    .bold()

                if !viewModel.progressMessage.isEmpty {
                    SmallText(viewModel.progressMessage)
                        .foregroundColor(Color.textSecondary)
                }
            }
            .padding(32)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color.backgroundCard)
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(Color.borderSubtle, lineWidth: 1)
                    )
            )
            .padding(.horizontal, 40)
        }
    }

    // MARK: - Success Result Overlay

    private func successResultOverlay(item: EnhancedPlayerItem) -> some View {
        ZStack {
            Color.black.opacity(0.8)
                .ignoresSafeArea()

            VStack(spacing: 24) {
                // Success icon
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 64, weight: .medium))
                    .foregroundColor(Color.accent)

                TitleText("Material Applied!", size: 26)
                    .foregroundColor(Color.textPrimary)

                // Item preview
                VStack(spacing: 12) {
                    if let imageUrl = item.generatedImageUrl, let url = URL(string: imageUrl) {
                        CachedAsyncImage(
                            url: url,
                            content: { image in
                                image
                                    .resizable()
                                    .aspectRatio(contentMode: .fit)
                                    .frame(width: 120, height: 120)
                                    .clipShape(RoundedRectangle(cornerRadius: 12))
                            },
                            placeholder: {
                                ProgressView()
                                    .frame(width: 120, height: 120)
                            }
                        )
                    } else {
                        placeholderImage
                    }

                    NormalText(item.baseType.capitalized)
                        .foregroundColor(Color.textPrimary)
                        .bold()

                    SmallText("Level \(item.level) • \(item.appliedMaterials.count)/3 Materials")
                        .foregroundColor(Color.textSecondary)
                }

                // Craft count notification
                if viewModel.craftCount > 1 {
                    HStack(spacing: 8) {
                        Image(systemName: "person.2.fill")
                            .font(.system(size: 14))
                            .foregroundColor(Color.accent)

                        SmallText("\(viewModel.craftCount) players have crafted this combo")
                            .foregroundColor(Color.textSecondary)
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(
                        RoundedRectangle(cornerRadius: 8)
                            .fill(Color.backgroundSecondary)
                    )
                }

                // Action buttons
                VStack(spacing: 12) {
                    TextButton("Return to Crafting") {
                        audioManager.playMenuButtonClick()
                        resetForNewCraft()
                    }

                    TextButton("Back to Menu") {
                        audioManager.playMenuButtonClick()
                        navigationManager.navigateBack()
                    }
                }
            }
            .padding(32)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color.backgroundCard)
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(Color.borderSubtle, lineWidth: 1)
                    )
            )
            .padding(.horizontal, 40)
        }
    }

    private var placeholderImage: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.backgroundSecondary)
                .frame(width: 120, height: 120)

            Image(systemName: "cube.fill")
                .font(.system(size: 48))
                .foregroundColor(Color.textSecondary)
        }
    }

    // MARK: - Helper Methods

    private func loadData() async {
        await viewModel.loadItems()
        await viewModel.loadMaterials()
    }

    private func craftItem() async {
        showCraftingProgress = true
        await viewModel.applyMaterial()
        showCraftingProgress = false

        // Handle result
        switch viewModel.craftingState {
        case .results:
            showSuccessResult = true
        case .error(let error):
            errorMessage = error.localizedDescription
            showErrorAlert = true
        default:
            break
        }
    }

    private func resetForNewCraft() {
        showSuccessResult = false
        viewModel.reset()

        // Reload data
        Task {
            await loadData()
        }
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        CraftingView()
            .environmentObject(NavigationManager())
            .environmentObject(AudioManager.shared)
    }
    .modelContainer(for: Item.self, inMemory: true)
}
