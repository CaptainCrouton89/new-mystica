//
//  InventoryEmptyState.swift
//  New-Mystica
//
//  Empty state component for inventory sections
//  Extracted from InventoryView.swift for better maintainability
//

import SwiftUI

struct InventoryEmptyState: View {
    let type: EmptyStateType
    let onRefresh: () -> Void

    enum EmptyStateType {
        case items
        case materials

        var icon: String {
            switch self {
            case .items:
                return "cube.transparent"
            case .materials:
                return "cube.transparent"
            }
        }

        var title: String {
            switch self {
            case .items:
                return "No Items Found"
            case .materials:
                return "No Materials"
            }
        }

        var description: String {
            switch self {
            case .items:
                return "Your inventory is empty in this category"
            case .materials:
                return "Collect materials to craft styled items"
            }
        }
    }

    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: type.icon)
                .font(.system(size: 48, weight: .medium))
                .foregroundColor(Color.borderSubtle)

            VStack(spacing: 8) {
                TitleText(type.title, size: 24)

                NormalText(type.description)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
            }

            TextButton("Refresh") {
                onRefresh()
            }
            .frame(maxWidth: 200)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.backgroundPrimary)
    }
}

#Preview {
    VStack(spacing: 40) {
        InventoryEmptyState(type: .items, onRefresh: {})
        InventoryEmptyState(type: .materials, onRefresh: {})
    }
    .padding()
}