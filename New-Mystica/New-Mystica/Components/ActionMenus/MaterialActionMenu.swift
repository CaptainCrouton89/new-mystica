//
//  MaterialActionMenu.swift
//  New-Mystica
//
//  Material action menu component with single craft action
//  Used for material tap gestures in inventory grid
//

import SwiftUI

// MARK: - Material Action Menu Component
struct MaterialActionMenu: View {
    let material: MaterialInventoryStack
    let onCraft: () -> Void
    let onDismiss: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            // Header with material info
            materialHeaderView
                .padding(.bottom, 16)

            // Action Button
            craftActionButton
        }
        .padding(20)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.backgroundCard)
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(Color.borderSubtle, lineWidth: 1)
                )
        )
        .shadow(color: Color.black.opacity(0.1), radius: 8, x: 0, y: 4)
    }

    // MARK: - Material Header View

    private var materialHeaderView: some View {
        VStack(spacing: 8) {
            // Material Icon
            Image(systemName: getMaterialIcon())
                .font(.system(size: 32, weight: .medium))
                .foregroundColor(getStyleBorderColor())
                .frame(width: 60, height: 60)
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color.backgroundSecondary)
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(getStyleBorderColor(), lineWidth: 2)
                        )
                )

            // Material Name
            TitleText(material.name.capitalized, size: 18)
                .foregroundColor(Color.textPrimary)
                .multilineTextAlignment(.center)

            // Quantity Info
            HStack(spacing: 4) {
                Image(systemName: "cube.fill")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(Color.textSecondary)

                SmallText("\(material.quantity) available")
                    .foregroundColor(Color.textSecondary)
            }
        }
    }

    // MARK: - Craft Action Button

    private var craftActionButton: some View {
        Button(action: onCraft) {
            HStack(spacing: 12) {
                Image(systemName: "hammer.fill")
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(Color.textPrimary)

                NormalText("Craft with Material", size: 16)
                    .foregroundColor(Color.textPrimary)
                    .bold()

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(Color.textSecondary)
            }
            .padding(.vertical, 16)
            .padding(.horizontal, 20)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.accent)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color.accent.opacity(0.3), lineWidth: 1)
                    )
            )
        }
        .buttonStyle(PlainButtonStyle())
    }

    // MARK: - Helper Methods

    private func getMaterialIcon() -> String {
        let theme = material.theme.lowercased()
        let name = material.name.lowercased()

        // Icon based on material theme and name (matching MaterialCard logic)
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

        // Style-based border colors (matching MaterialCard logic)
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

// MARK: - Material Action Sheet Wrapper
/// Wrapper that presents the action menu as a sheet
struct MaterialActionSheet: View {
    let material: MaterialInventoryStack
    let isPresented: Binding<Bool>
    let onCraft: () -> Void

    var body: some View {
        VStack(spacing: 20) {
            // Sheet Handle
            RoundedRectangle(cornerRadius: 3)
                .fill(Color.borderSubtle)
                .frame(width: 40, height: 6)
                .padding(.top, 8)

            // Action Menu Content
            MaterialActionMenu(
                material: material,
                onCraft: {
                    isPresented.wrappedValue = false
                    onCraft()
                },
                onDismiss: {
                    isPresented.wrappedValue = false
                }
            )

            Spacer()
        }
        .background(Color.backgroundPrimary)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }
}

// MARK: - Preview
#Preview {
    let mockMaterialDetail = MaterialInventoryStack.MaterialDetail(
        id: "crystal_002",
        name: "Mystical Crystal",
        statModifiers: StatModifier(atkPower: 1.2, atkAccuracy: 1.1, defPower: 1.0, defAccuracy: 1.05),
        description: "Shimmering crystal of pure magic",
        baseDropWeight: 50,
        imageUrl: "https://pub-34824eb66e5f4c31b6b58f4188ae2391.r2.dev/materials/mystical_crystal.png"
    )

    let mockMaterial = MaterialInventoryStack(
        materialId: "crystal_002",
        name: "Mystical Crystal",
        styleId: "holographic_style",
        quantity: 5,
        theme: "mystical",
        statModifiers: StatModifier(atkPower: 1.2, atkAccuracy: 1.1, defPower: 1.0, defAccuracy: 1.05),
        imageUrl: mockMaterialDetail.imageUrl,
        material: mockMaterialDetail
    )

    VStack(spacing: 30) {
        TitleText("Material Action Menu Preview", size: 24)

        MaterialActionMenu(
            material: mockMaterial,
            onCraft: {
                print("Craft action for material: \(mockMaterial.name)")
            },
            onDismiss: {
                print("Dismissed action menu")
            }
        )
        .frame(maxWidth: 300)

        Spacer()
    }
    .padding()
    .background(Color.backgroundPrimary)
    .environmentObject(NavigationManager())
}