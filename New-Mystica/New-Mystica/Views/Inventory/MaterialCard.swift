//
//  MaterialCard.swift
//  New-Mystica
//
//  Material card component for inventory display with quantity badges and style borders
//  Used in inventory grid layout for materials section
//

import SwiftUI

// MARK: - Material Card Component
struct MaterialCard: View {
    let material: MaterialInventoryStack

    var body: some View {
        VStack(spacing: 8) {
            // Material Image with Quantity Badge
            ZStack(alignment: .topTrailing) {
                // Material Icon/Image
                materialImageView
                    .frame(width: 60, height: 60)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(getStyleBorderColor(), lineWidth: 2)
                    )

                // Quantity Badge
                if material.quantity > 1 {
                    quantityBadge
                }
            }

            // Material Name
            SmallText(material.name.capitalized)
                .foregroundColor(Color.textPrimary)
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .frame(minHeight: 32) // Consistent height for grid alignment
        }
        .frame(width: 80) // Fixed width for grid layout
        .padding(8)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.backgroundCard)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color.borderSubtle, lineWidth: 1)
                )
        )
        .contentShape(Rectangle()) // Ensure entire card is tappable
    }

    // MARK: - Material Image View

    private var materialImageView: some View {
        ZStack {
            // Material Image from R2
            if let imageUrl = material.imageUrl, let url = URL(string: imageUrl) {
                CachedAsyncImage(
                    url: url,
                    content: { image in
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                            .frame(width: 60, height: 60)
                            .clipped()
                    },
                    placeholder: {
                        ProgressView()
                            .frame(width: 60, height: 60)
                            .progressViewStyle(CircularProgressViewStyle(tint: getStyleBorderColor()))
                    }
                )
            } else {
                // Fallback to SF Symbol icon if no URL
                ZStack {
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color.backgroundSecondary)
                    Image(systemName: getMaterialIcon())
                        .font(.system(size: 28, weight: .medium))
                        .foregroundColor(getStyleBorderColor())
                }
                .frame(width: 60, height: 60)
            }
        }
    }

    // MARK: - Quantity Badge

    private var quantityBadge: some View {
        ZStack {
            Circle()
                .fill(Color.accent)
                .frame(width: 20, height: 20)

            SmallText("\(material.quantity)")
                .foregroundColor(Color.textPrimary)
                .font(FontManager.system(size: 10, weight: .bold))
        }
        .offset(x: 4, y: -4)
    }

    // MARK: - Helper Methods

    private func getMaterialIcon() -> String {
        let theme = material.theme.lowercased()
        let name = material.name.lowercased()

        // Icon based on material theme and name
        if theme.contains("nature") || name.contains("wood") || name.contains("leaf") {
            return "leaf.fill"
        } else if theme.contains("mystical") || name.contains("crystal") || name.contains("gem") {
            return "diamond.fill"
        } else if theme.contains("metal") || name.contains("iron") || name.contains("steel") {
            return "wrench.fill"
        } else if theme.contains("magical") || name.contains("mana") || name.contains("essence") {
            return "sparkles"
        } else if theme.contains("elemental") || name.contains("fire") || name.contains("ice") {
            return "flame.fill"
        } else if name.contains("stone") || name.contains("rock") {
            return "mountain.fill"
        } else if name.contains("fabric") || name.contains("cloth") {
            return "scissors"
        } else {
            // Default material icon
            return "cube.fill"
        }
    }

    private func getStyleBorderColor() -> Color {
        let styleId = material.styleId.lowercased()

        // Style-based border colors as mentioned in plan
        switch styleId {
        case let id where id.contains("pixel"):
            return Color(hex: "FF69B4") // Pink for pixel art style
        case let id where id.contains("holographic"):
            return Color.accent // Rainbow-like (using accent as placeholder)
        case let id where id.contains("ethereal") || id.contains("magical"):
            return Color.accentSecondary // Blue for magical styles
        case let id where id.contains("rustic") || id.contains("natural"):
            return Color(hex: "8B4513") // Brown for natural styles
        default:
            return Color.borderSubtle // White/gray for normal style
        }
    }
}

// MARK: - Tappable Material Card Wrapper
/// Wrapper that adds tap gesture with action menu integration
struct TappableMaterialCard: View {
    let material: MaterialInventoryStack
    let onCraft: () -> Void

    @State private var showingActionMenu = false

    var body: some View {
        MaterialCard(material: material)
            .onTapGesture {
                showingActionMenu = true
            }
            .sheet(isPresented: $showingActionMenu) {
                MaterialActionSheet(
                    material: material,
                    isPresented: $showingActionMenu,
                    onCraft: onCraft
                )
                .presentationDetents([.height(300)])
                .presentationDragIndicator(.visible)
            }
    }
}

// MARK: - Preview
#Preview {
    // Mock materials with imageUrl from R2
    let mockMaterialDetail1 = MaterialInventoryStack.MaterialDetail(
        id: "wood_001",
        name: "Enchanted Wood",
        statModifiers: StatModifier(atkPower: 1.1, atkAccuracy: 1.0, defPower: 1.05, defAccuracy: 1.0),
        description: "Magical wood from enchanted forests",
        baseDropWeight: 100,
        imageUrl: "https://pub-34824eb66e5f4c31b6b58f4188ae2391.r2.dev/materials/enchanted_wood.png"
    )

    let mockMaterialDetail2 = MaterialInventoryStack.MaterialDetail(
        id: "crystal_002",
        name: "Mystical Crystal",
        statModifiers: StatModifier(atkPower: 1.2, atkAccuracy: 1.1, defPower: 1.0, defAccuracy: 1.05),
        description: "Shimmering crystal of pure magic",
        baseDropWeight: 50,
        imageUrl: "https://pub-34824eb66e5f4c31b6b58f4188ae2391.r2.dev/materials/mystical_crystal.png"
    )

    let mockMaterialDetail3 = MaterialInventoryStack.MaterialDetail(
        id: "fabric_003",
        name: "Pixel Cloth",
        statModifiers: StatModifier(atkPower: 1.0, atkAccuracy: 1.15, defPower: 1.1, defAccuracy: 1.1),
        description: "Digital fabric from pixelated realms",
        baseDropWeight: 75,
        imageUrl: "https://pub-34824eb66e5f4c31b6b58f4188ae2391.r2.dev/materials/pixel_cloth.png"
    )

    // Create mock materials array
    let mockMaterials = [
        MaterialInventoryStack(
            materialId: "wood_001",
            name: "Enchanted Wood",
            styleId: "rustic_style",
            quantity: 15,
            theme: "nature",
            statModifiers: StatModifier(atkPower: 1.1, atkAccuracy: 1.0, defPower: 1.05, defAccuracy: 1.0),
            imageUrl: mockMaterialDetail1.imageUrl,
            material: mockMaterialDetail1
        ),
        MaterialInventoryStack(
            materialId: "crystal_002",
            name: "Mystical Crystal",
            styleId: "holographic_style",
            quantity: 3,
            theme: "mystical",
            statModifiers: StatModifier(atkPower: 1.2, atkAccuracy: 1.1, defPower: 1.0, defAccuracy: 1.05),
            imageUrl: mockMaterialDetail2.imageUrl,
            material: mockMaterialDetail2
        ),
        MaterialInventoryStack(
            materialId: "fabric_003",
            name: "Pixel Cloth",
            styleId: "pixel_art_style",
            quantity: 7,
            theme: "digital",
            statModifiers: StatModifier(atkPower: 1.0, atkAccuracy: 1.15, defPower: 1.1, defAccuracy: 1.1),
            imageUrl: mockMaterialDetail3.imageUrl,
            material: mockMaterialDetail3
        )
    ]

    return VStack(spacing: 20) {
        TitleText("Material Cards Preview", size: 24)

        // Grid layout example
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: 3), spacing: 12) {
            ForEach(mockMaterials, id: \.materialId) { material in
                TappableMaterialCard(material: material) {
                    print("Craft action for material: \(material.name)")
                }
            }
        }
        .padding()

        Spacer()
    }
    .background(Color.backgroundPrimary)
    .environmentObject(NavigationManager())
}