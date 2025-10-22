//
//  CollectionView.swift
//  New-Mystica
//
//  Created by Silas Rhyneer on 10/19/25.
//

import SwiftUI

struct CollectionView: View, NavigableView {
    @EnvironmentObject private var navigationManager: NavigationManager
    @EnvironmentObject private var audioManager: AudioManager
    @State private var selectedItem: CollectionItem? = nil
    @State private var showItemPopup = false
    
    var navigationTitle: String { "Collection" }
    
    // Dummy data for the collection
    private let dummyItems = Array(1...20).map { index in
        CollectionItem(
            id: index,
            name: "Item \(index)",
            imageName: "photo.fill",
            rarity: ["Common", "Rare", "Epic", "Legendary"].randomElement() ?? "Common",
            description: "This is a detailed description of Item \(index). It has been carefully crafted and holds special properties that make it valuable to collectors and adventurers alike."
        )
    }
    
    let columns = [
        GridItem(.flexible()),
        GridItem(.flexible()),
        GridItem(.flexible())
    ]
    
    var body: some View {
        BaseView(title: navigationTitle) {
            // Collection Grid
            ScrollView {
                LazyVGrid(columns: columns, spacing: 16) {
                        ForEach(Array(dummyItems.enumerated()), id: \.element.id) { index, item in
                            CollectionItemView(item: item)
                                .onTapGesture {
                                    audioManager.playMenuButtonClick()
                                    selectedItem = item
                                    showItemPopup = true
                                }
                                .modifier(
                                    index < 9 ? 
                                    AnyViewModifier(BatchAnimationModifier(batchIndex: index / 3)) :
                                    AnyViewModifier(InstantBatchAnimationModifier())
                                )
                        }
                }
                .padding(.horizontal, 16)
                .padding(.top, 24)
            }
        }
        .overlay(
            // Item Detail Popup
            Group {
                if showItemPopup, let item = selectedItem {
                    ItemDetailPopup(
                        item: item,
                        isPresented: $showItemPopup
                    )
                }
            }
        )
    }
}

struct CollectionItem: Identifiable {
    let id: Int
    let name: String
    let imageName: String
    let rarity: String
    let description: String
}

struct CollectionItemView: View {
    let item: CollectionItem
    
    var body: some View {
        VStack(spacing: 8) {
            // Item Image
            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .fill(getRarityColor())
                    .frame(height: 100)
                
                Image(systemName: item.imageName)
                    .font(.system(size: 32, weight: .medium))
                    .foregroundColor(.white)
            }
            
            // Item Name
            Text(item.name)
                .font(FontManager.caption)
                .foregroundColor(Color.textPrimary)
                .lineLimit(1)
            
            // Rarity Badge
            Text(item.rarity)
                .font(FontManager.small)
                .foregroundColor(Color.textSecondary)
                .padding(.horizontal, 8)
                .padding(.vertical, 2)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color.backgroundCard)
                )
        }
    }
    
    private func getRarityColor() -> Color {
        switch item.rarity {
        case "Common":
            return Color.borderSubtle
        case "Rare":
            return Color.accentSecondary
        case "Epic":
            return Color.accent
        case "Legendary":
            return Color.accentSecondary
        default:
            return Color.borderSubtle
        }
    }
}

#Preview {
    CollectionView()
        .environmentObject(NavigationManager())
}
