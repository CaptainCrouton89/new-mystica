//
//  MaterialCard.swift
//  New-Mystica
//
//

import SwiftUI

struct MaterialCard: View {
    let material: MaterialInventoryStack

    var body: some View {
        VStack(spacing: 8) {
            ZStack(alignment: .topTrailing) {
                materialImageView
                    .frame(width: 80, height: 80)
                    .clipShape(Circle())
                    .overlay(
                        Circle()
                            .stroke(getStyleBorderColor(), lineWidth: 2)
                    )

                if material.quantity > 1 {
                    quantityBadge
                }
            }

            SmallText(material.name.capitalized)
                .foregroundColor(Color.textPrimary)
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .frame(height: 40)
        }
        .contentShape(Rectangle())
    }


    private var materialImageView: some View {
        ZStack {
            if let imageUrl = material.imageUrl, let url = URL(string: imageUrl) {
                CachedAsyncImage(
                    url: url,
                    content: { image in
                        image
                            .resizable()
                            .scaledToFill()
                    },
                    placeholder: {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: getStyleBorderColor()))
                    }
                )
            } else {
                ZStack {
                    Circle()
                        .fill(Color.backgroundSecondary)
                    Image(systemName: getMaterialIcon())
                        .font(.system(size: 32, weight: .medium))
                        .foregroundColor(getStyleBorderColor())
                }
            }
        }
    }


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


    private func getMaterialIcon() -> String {
        let theme = material.theme.lowercased()
        let name = material.name.lowercased()

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
            return "cube.fill"
        }
    }

    private func getStyleBorderColor() -> Color {
        let styleId = material.styleId.lowercased()

        switch styleId {
        case let id where id.contains("pixel"):
            return Color(hex: "FF69B4")
        case let id where id.contains("holographic"):
            return Color.accent
        case let id where id.contains("ethereal") || id.contains("magical"):
            return Color.accentSecondary
        case let id where id.contains("rustic") || id.contains("natural"):
            return Color(hex: "8B4513")
        default:
            return Color.borderSubtle
        }
    }
}

struct TappableMaterialCard: View {
    let material: MaterialInventoryStack
    let onCraft: () -> Void

    @State private var showingDetailModal = false

    var body: some View {
        MaterialCard(material: material)
            .onTapGesture {
                showingDetailModal = true
            }
            .sheet(isPresented: $showingDetailModal) {
                MaterialDetailModal(
                    material: material,
                    onCraft: onCraft
                )
            }
    }
}

#Preview {
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

    let mockMaterials = [
        MaterialInventoryStack(
            materialId: "wood_001",
            name: "Enchanted Wood",
            styleId: "rustic_style",
            quantity: 15,
            theme: "nature",
            statModifiers: StatModifier(atkPower: 1.1, atkAccuracy: 1.0, defPower: 1.05, defAccuracy: 1.0),
            imageUrl: mockMaterialDetail1.imageUrl,
            material: mockMaterialDetail1,
            styleName: "Rustic"
        ),
        MaterialInventoryStack(
            materialId: "crystal_002",
            name: "Mystical Crystal",
            styleId: "holographic_style",
            quantity: 3,
            theme: "mystical",
            statModifiers: StatModifier(atkPower: 1.2, atkAccuracy: 1.1, defPower: 1.0, defAccuracy: 1.05),
            imageUrl: mockMaterialDetail2.imageUrl,
            material: mockMaterialDetail2,
            styleName: "Holographic"
        ),
        MaterialInventoryStack(
            materialId: "fabric_003",
            name: "Pixel Cloth",
            styleId: "pixel_art_style",
            quantity: 7,
            theme: "digital",
            statModifiers: StatModifier(atkPower: 1.0, atkAccuracy: 1.15, defPower: 1.1, defAccuracy: 1.1),
            imageUrl: mockMaterialDetail3.imageUrl,
            material: mockMaterialDetail3,
            styleName: "Pixel Art"
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