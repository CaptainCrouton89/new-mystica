import SwiftUI

// MARK: - Item Detail Popup Component
struct ItemDetailPopup: View {
    let item: CollectionItem
    let isPresented: Binding<Bool>
    
    @State private var isAnimating = false
    
    var body: some View {
        ZStack {
            // Background overlay
            Color.black.opacity(0.6)
                .ignoresSafeArea()
                .onTapGesture {
                    dismissPopup()
                }
            
            // Popup content
            VStack(spacing: 0) {
                // Header with close button
                HStack {
                    Spacer()
                    
                    Button {
                        dismissPopup()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 18, weight: .medium))
                            .foregroundColor(Color.mysticaSoftBrown)
                            .frame(width: 32, height: 32)
                            .background(
                                Circle()
                                    .fill(Color.mysticaDarkBrown)
                                    .overlay(
                                        Circle()
                                            .stroke(Color.mysticaLightBrown, lineWidth: 1)
                                    )
                            )
                    }
                    .buttonStyle(PlainButtonStyle())
                }
                .padding(.horizontal, 20)
                .padding(.top, 16)
                
                // Item image
                ZStack {
                    RoundedRectangle(cornerRadius: 16)
                        .fill(getRarityColor())
                        .frame(height: 200)
                        .shadow(color: .black.opacity(0.3), radius: 8, x: 0, y: 4)
                    
                    Image(systemName: item.imageName)
                        .font(.system(size: 64, weight: .medium))
                        .foregroundColor(.white)
                }
                .padding(.horizontal, 20)
                .padding(.top, 16)
                
                // Item details
                VStack(spacing: 12) {
                    // Item name
                    TitleText(item.name, size: 24)
                        .multilineTextAlignment(.center)
                    
                    // Rarity badge
                    Text(item.rarity)
                        .font(.custom("Impact", size: 14))
                        .foregroundColor(Color.mysticaAccentGold)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(
                            RoundedRectangle(cornerRadius: 12)
                                .fill(Color.mysticaCharcoal)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 12)
                                        .stroke(getRarityColor(), lineWidth: 2)
                                )
                        )
                    
                    // Description
                    NormalText(item.description, size: 16)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 8)
                }
                .padding(.horizontal, 20)
                .padding(.top, 20)
                .padding(.bottom, 24)
            }
            .background(
                RoundedRectangle(cornerRadius: 20)
                    .fill(Color.mysticaDarkBrown)
                    .overlay(
                        RoundedRectangle(cornerRadius: 20)
                            .stroke(Color.mysticaLightBrown, lineWidth: 2)
                    )
            )
            .padding(.horizontal, 32)
            .scaleEffect(isAnimating ? 1.0 : 0.8)
            .opacity(isAnimating ? 1.0 : 0.0)
        }
        .onAppear {
            withAnimation(.spring(response: 0.5, dampingFraction: 0.8)) {
                isAnimating = true
            }
        }
    }
    
    private func dismissPopup() {
        withAnimation(.easeOut(duration: 0.3)) {
            isAnimating = false
        }
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            isPresented.wrappedValue = false
        }
    }
    
    private func getRarityColor() -> Color {
        switch item.rarity {
        case "Common":
            return Color.mysticaDarkGray
        case "Rare":
            return Color.blue
        case "Epic":
            return Color.purple
        case "Legendary":
            return Color.mysticaAccentGold
        default:
            return Color.mysticaDarkGray
        }
    }
}

// MARK: - Generic Popup Component
struct GenericPopup: View {
    let title: String
    let imageName: String
    let description: String
    let isPresented: Binding<Bool>
    
    @State private var isAnimating = false
    
    var body: some View {
        ZStack {
            // Background overlay
            Color.black.opacity(0.6)
                .ignoresSafeArea()
                .onTapGesture {
                    dismissPopup()
                }
            
            // Popup content
            VStack(spacing: 0) {
                // Header with close button
                HStack {
                    Spacer()
                    
                    Button {
                        dismissPopup()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 18, weight: .medium))
                            .foregroundColor(Color.mysticaSoftBrown)
                            .frame(width: 32, height: 32)
                            .background(
                                Circle()
                                    .fill(Color.mysticaDarkBrown)
                                    .overlay(
                                        Circle()
                                            .stroke(Color.mysticaLightBrown, lineWidth: 1)
                                    )
                            )
                    }
                    .buttonStyle(PlainButtonStyle())
                }
                .padding(.horizontal, 20)
                .padding(.top, 16)
                
                // Image
                ZStack {
                    RoundedRectangle(cornerRadius: 16)
                        .fill(Color.mysticaCharcoal)
                        .frame(height: 200)
                        .shadow(color: .black.opacity(0.3), radius: 8, x: 0, y: 4)
                    
                    Image(systemName: imageName)
                        .font(.system(size: 64, weight: .medium))
                        .foregroundColor(Color.mysticaSoftBrown)
                }
                .padding(.horizontal, 20)
                .padding(.top, 16)
                
                // Content
                VStack(spacing: 12) {
                    // Title
                    TitleText(title, size: 24)
                        .multilineTextAlignment(.center)
                    
                    // Description
                    NormalText(description, size: 16)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 8)
                }
                .padding(.horizontal, 20)
                .padding(.top, 20)
                .padding(.bottom, 24)
            }
            .background(
                RoundedRectangle(cornerRadius: 20)
                    .fill(Color.mysticaDarkBrown)
                    .overlay(
                        RoundedRectangle(cornerRadius: 20)
                            .stroke(Color.mysticaLightBrown, lineWidth: 2)
                    )
            )
            .padding(.horizontal, 32)
            .scaleEffect(isAnimating ? 1.0 : 0.8)
            .opacity(isAnimating ? 1.0 : 0.0)
        }
        .onAppear {
            withAnimation(.spring(response: 0.5, dampingFraction: 0.8)) {
                isAnimating = true
            }
        }
    }
    
    private func dismissPopup() {
        withAnimation(.easeOut(duration: 0.3)) {
            isAnimating = false
        }
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            isPresented.wrappedValue = false
        }
    }
}

// MARK: - Action Popup Component (Generic with bottom button)
struct ActionPopup: View {
    let title: String
    let imageName: String
    let description: String
    let buttonText: String
    let isPresented: Binding<Bool>
    let onAction: () -> Void
    
    @State private var isAnimating = false
    
    var body: some View {
        ZStack {
            // Background overlay
            Color.black.opacity(0.6)
                .ignoresSafeArea()
                .onTapGesture {
                    dismissPopup()
                }
            
            // Popup content
            VStack(spacing: 0) {
                // Header with close button
                HStack {
                    Spacer()
                    
                    Button {
                        dismissPopup()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 18, weight: .medium))
                            .foregroundColor(Color.mysticaSoftBrown)
                            .frame(width: 32, height: 32)
                            .background(
                                Circle()
                                    .fill(Color.mysticaDarkBrown)
                                    .overlay(
                                        Circle()
                                            .stroke(Color.mysticaLightBrown, lineWidth: 1)
                                    )
                            )
                    }
                    .buttonStyle(PlainButtonStyle())
                }
                .padding(.horizontal, 20)
                .padding(.top, 16)
                
                // Image
                ZStack {
                    RoundedRectangle(cornerRadius: 16)
                        .fill(Color.mysticaCharcoal)
                        .frame(height: 200)
                        .shadow(color: .black.opacity(0.3), radius: 8, x: 0, y: 4)
                    
                    Image(systemName: imageName)
                        .font(.system(size: 64, weight: .medium))
                        .foregroundColor(Color.mysticaSoftBrown)
                }
                .padding(.horizontal, 20)
                .padding(.top, 16)
                
                // Content
                VStack(spacing: 12) {
                    // Title
                    TitleText(title, size: 24)
                        .multilineTextAlignment(.center)
                    
                    // Description
                    NormalText(description, size: 16)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 8)
                }
                .padding(.horizontal, 20)
                .padding(.top, 20)
                
                // Action button
                Button {
                    onAction()
                    dismissPopup()
                } label: {
                    Text(buttonText)
                        .font(.custom("Impact", size: 18))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 50)
                        .background(
                            RoundedRectangle(cornerRadius: 12)
                                .fill(Color.mysticaAccentGold)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 12)
                                        .stroke(Color.mysticaSoftBrown, lineWidth: 2)
                                )
                        )
                }
                .buttonStyle(PlainButtonStyle())
                .padding(.horizontal, 20)
                .padding(.top, 20)
                .padding(.bottom, 24)
            }
            .background(
                RoundedRectangle(cornerRadius: 20)
                    .fill(Color.mysticaDarkBrown)
                    .overlay(
                        RoundedRectangle(cornerRadius: 20)
                            .stroke(Color.mysticaLightBrown, lineWidth: 2)
                    )
            )
            .padding(.horizontal, 32)
            .scaleEffect(isAnimating ? 1.0 : 0.8)
            .opacity(isAnimating ? 1.0 : 0.0)
        }
        .onAppear {
            withAnimation(.spring(response: 0.5, dampingFraction: 0.8)) {
                isAnimating = true
            }
        }
    }
    
    private func dismissPopup() {
        withAnimation(.easeOut(duration: 0.3)) {
            isAnimating = false
        }
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            isPresented.wrappedValue = false
        }
    }
}

// MARK: - Battle Popup Component (Convenience wrapper for battles)
struct BattlePopup: View {
    let locationName: String
    let enemyType: String
    let difficulty: String
    let rewards: String
    let isPresented: Binding<Bool>
    let onBattleAction: () -> Void
    
    var body: some View {
        ActionPopup(
            title: locationName,
            imageName: "exclamationmark.triangle.fill",
            description: "Enemy: \(enemyType)\nDifficulty: \(difficulty)\nRewards: \(rewards)",
            buttonText: "Battle",
            isPresented: isPresented,
            onAction: onBattleAction
        )
    }
}

#Preview {
    ZStack {
        Color.mysticaDarkBrown.ignoresSafeArea()
        
        VStack(spacing: 20) {
            // Generic ActionPopup example
            ActionPopup(
                title: "Treasure Chest",
                imageName: "shippingbox.fill",
                description: "A mysterious chest found in the ancient ruins. It might contain valuable treasures or dangerous traps.",
                buttonText: "Open",
                isPresented: .constant(true),
                onAction: {
                    print("Opening chest!")
                }
            )
            
            // BattlePopup example
            BattlePopup(
                locationName: "Dark Forest",
                enemyType: "Shadow Wolves",
                difficulty: "Medium",
                rewards: "Gold, XP, Rare Items",
                isPresented: .constant(true),
                onBattleAction: {
                    print("Battle started!")
                }
            )
        }
    }
}
