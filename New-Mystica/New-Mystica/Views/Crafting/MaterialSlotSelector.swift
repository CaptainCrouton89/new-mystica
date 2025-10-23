//
//  MaterialSlotSelector.swift
//  New-Mystica
//
//  Material slot selector component for crafting screen
//  Displays either empty state with "+ Select Material" or selected material with image, name, and quantity
//

import SwiftUI

// MARK: - Material Slot Selector Component
struct MaterialSlotSelector: View {
    let selectedMaterial: MaterialInventoryStack?
    let onTap: () -> Void

    var body: some View {
        SelectionSlotButton(isFilled: selectedMaterial != nil, onTap: onTap) {
            if let material = selectedMaterial {
                filledStateContent(material: material)
            } else {
                emptyStateContent
            }
        }
    }

    // MARK: - Empty State View

    private var emptyStateContent: some View {
        VStack(spacing: 12) {
            // Plus icon
            Image(systemName: "plus")
                .font(.system(size: 32, weight: .medium))
                .foregroundColor(Color.textSecondary)

            // "+ Select Material" text
            NormalText("+ Select Material")
                .multilineTextAlignment(.center)
                .foregroundColor(Color.textSecondary)
        }
    }

    // MARK: - Filled State View

    private func filledStateContent(material: MaterialInventoryStack) -> some View {
        VStack(spacing: 12) {
            // Material Image with Quantity Badge
            ZStack(alignment: .topTrailing) {
                // Material Image
                materialImageView(material: material)
                    .frame(width: 80, height: 80)
                    .clipShape(RoundedRectangle(cornerRadius: 12))

                // Quantity Badge
                if material.quantity > 1 {
                    quantityBadge(quantity: material.quantity)
                }
            }

            // Material Name
            SmallText(material.name.capitalized)
                .foregroundColor(Color.textPrimary)
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .frame(minHeight: 32) // Consistent height for alignment
        }
    }

    // MARK: - Material Image View

    private func materialImageView(material: MaterialInventoryStack) -> some View {
        ZStack {
            // Background
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.backgroundSecondary)

            // Material Image from R2
            if let imageUrl = material.imageUrl, let url = URL(string: imageUrl) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .empty:
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: styleBorderColor(material.styleId)))
                    case .success(let image):
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fit)
                            .frame(width: 64, height: 64)
                    case .failure:
                        // Fallback to SF Symbol icon on image load failure
                        Image(systemName: getMaterialIcon(material: material))
                            .font(.system(size: 32, weight: .medium))
                            .foregroundColor(styleBorderColor(material.styleId))
                    @unknown default:
                        EmptyView()
                    }
                }
            } else {
                // Fallback to SF Symbol icon if no URL
                Image(systemName: getMaterialIcon(material: material))
                    .font(.system(size: 32, weight: .medium))
                    .foregroundColor(styleBorderColor(material.styleId))
            }
        }
    }

    // MARK: - Quantity Badge

    private func quantityBadge(quantity: Int) -> some View {
        ZStack {
            Circle()
                .fill(Color.accent)
                .frame(width: 24, height: 24)

            Text("×\(quantity)")
                .font(FontManager.system(size: 10, weight: .bold))
                .foregroundColor(Color.textPrimary)
        }
        .offset(x: 8, y: -8)
    }

    // MARK: - Helper Methods

    private func getMaterialIcon(material: MaterialInventoryStack) -> String {
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

    private func styleBorderColor(_ styleId: String) -> Color {
        let styleId = styleId.lowercased()

        // Style border colors matching design system from agent_292442:30-39
        switch styleId {
        case "normal":
            return Color.borderSubtle // #B0B0B0 - grey
        case let id where id.contains("pixel"):
            return Color(hex: "FF69B4") // Pink for pixel art style
        case let id where id.contains("watercolor"):
            return Color.accentSecondary // #00BFFF - blue
        case "neon":
            return Color.accent // #FF1493 - neon pink
        case let id where id.contains("holographic"):
            return Color.accent // Rainbow effect placeholder - using accent for now
        default:
            return Color.borderSubtle // Default to grey for unknown styles
        }
    }
}

// MARK: - Preview
#Preview {
    VStack(spacing: 24) {
        TitleText("Material Slot Selector", size: 24)

        // Empty state
        VStack(spacing: 8) {
            SmallText("Empty State")
            MaterialSlotSelector(selectedMaterial: nil, onTap: {
                print("Empty slot tapped")
            })
        }

        // Filled state with different style materials
        VStack(spacing: 16) {
            SmallText("Filled States")

            HStack(spacing: 16) {
                // Normal style material
                MaterialSlotSelector(
                    selectedMaterial: MaterialInventoryStack(
                        materialId: "iron_001",
                        name: "Iron",
                        styleId: "normal",
                        quantity: 5,
                        theme: "metal",
                        statModifiers: StatModifier(atkPower: 1.1, atkAccuracy: 1.0, defPower: 1.05, defAccuracy: 1.0),
                        imageUrl: nil,
                        material: MaterialInventoryStack.MaterialDetail(
                            id: "iron_001",
                            name: "Iron",
                            statModifiers: StatModifier(atkPower: 1.1, atkAccuracy: 1.0, defPower: 1.05, defAccuracy: 1.0),
                            description: "Strong metal material",
                            baseDropWeight: 100,
                            imageUrl: nil
                        )
                    ),
                    onTap: { print("Iron selected") }
                )

                // Pixel art style material
                MaterialSlotSelector(
                    selectedMaterial: MaterialInventoryStack(
                        materialId: "crystal_002",
                        name: "Pixel Crystal",
                        styleId: "pixel_art",
                        quantity: 12,
                        theme: "mystical",
                        statModifiers: StatModifier(atkPower: 1.2, atkAccuracy: 1.1, defPower: 1.0, defAccuracy: 1.05),
                        imageUrl: nil,
                        material: MaterialInventoryStack.MaterialDetail(
                            id: "crystal_002",
                            name: "Pixel Crystal",
                            statModifiers: StatModifier(atkPower: 1.2, atkAccuracy: 1.1, defPower: 1.0, defAccuracy: 1.05),
                            description: "Pixelated magical crystal",
                            baseDropWeight: 50,
                            imageUrl: nil
                        )
                    ),
                    onTap: { print("Pixel Crystal selected") }
                )
            }

            HStack(spacing: 16) {
                // Watercolor style material
                MaterialSlotSelector(
                    selectedMaterial: MaterialInventoryStack(
                        materialId: "wood_003",
                        name: "Watercolor Wood",
                        styleId: "watercolor",
                        quantity: 3,
                        theme: "nature",
                        statModifiers: StatModifier(atkPower: 1.0, atkAccuracy: 1.15, defPower: 1.1, defAccuracy: 1.1),
                        imageUrl: nil,
                        material: MaterialInventoryStack.MaterialDetail(
                            id: "wood_003",
                            name: "Watercolor Wood",
                            statModifiers: StatModifier(atkPower: 1.0, atkAccuracy: 1.15, defPower: 1.1, defAccuracy: 1.1),
                            description: "Artistic wooden material",
                            baseDropWeight: 75,
                            imageUrl: nil
                        )
                    ),
                    onTap: { print("Watercolor Wood selected") }
                )

                // Neon style material
                MaterialSlotSelector(
                    selectedMaterial: MaterialInventoryStack(
                        materialId: "essence_004",
                        name: "Neon Essence",
                        styleId: "neon",
                        quantity: 1,
                        theme: "magical",
                        statModifiers: StatModifier(atkPower: 1.3, atkAccuracy: 1.2, defPower: 0.9, defAccuracy: 1.0),
                        imageUrl: nil,
                        material: MaterialInventoryStack.MaterialDetail(
                            id: "essence_004",
                            name: "Neon Essence",
                            statModifiers: StatModifier(atkPower: 1.3, atkAccuracy: 1.2, defPower: 0.9, defAccuracy: 1.0),
                            description: "Glowing neon material",
                            baseDropWeight: 25,
                            imageUrl: nil
                        )
                    ),
                    onTap: { print("Neon Essence selected") }
                )
            }
        }

        Spacer()
    }
    .padding()
    .background(Color.backgroundPrimary)
    .environmentObject(NavigationManager())
}