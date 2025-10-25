import SwiftUI

// MARK: - Standardized Animated Popup

struct AnimatedPopup<Content: View>: View {
    let isPresented: Binding<Bool>
    let content: () -> Content
    
    @State private var isAnimating = false
    @Environment(\.audioManager) private var audioManager
    
    init(isPresented: Binding<Bool>, @ViewBuilder content: @escaping () -> Content) {
        self.isPresented = isPresented
        self.content = content
    }
    
    var body: some View {
        ZStack {
            // Background overlay
            Color.black.opacity(0.6)
                .ignoresSafeArea()
                .onTapGesture {
                    dismissPopup()
                }
            
            // Popup content
            content()
                .scaleEffect(isAnimating ? 1.0 : 0.8)
                .opacity(isAnimating ? 1.0 : 0.0)
        }
        .onAppear {
            withAnimation(.spring(response: 0.7, dampingFraction: 0.8)) {
                isAnimating = true
            }
        }
    }
    
    private func dismissPopup() {
        withAnimation(.easeOut(duration: 0.5)) {
            isAnimating = false
        }
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            isPresented.wrappedValue = false
        }
    }
}

// MARK: - Standardized Popup Content Components

struct PopupHeader: View {
    let onClose: () -> Void
    
    var body: some View {
        HStack {
            Spacer()
            
            Button {
                onClose()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 18, weight: .medium))
                    .foregroundColor(Color.textSecondary)
                    .frame(width: 32, height: 32)
                    .background(
                        Circle()
                            .fill(Color.backgroundPrimary)
                            .overlay(
                                Circle()
                                    .stroke(Color.accent, lineWidth: 1)
                            )
                    )
            }
            .buttonStyle(PlainButtonStyle())
        }
        .padding(.horizontal, 20)
        .padding(.top, 16)
    }
}

struct PopupImage: View {
    let imageName: String
    let backgroundColor: Color
    let height: CGFloat
    
    init(imageName: String, backgroundColor: Color = Color.backgroundCard, height: CGFloat = 200) {
        self.imageName = imageName
        self.backgroundColor = backgroundColor
        self.height = height
    }
    
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: .cornerRadiusExtraLarge)
                .fill(backgroundColor)
                .frame(height: height)
                .shadow(color: .black.opacity(0.3), radius: 8, x: 0, y: 4)
            
            Image(systemName: imageName)
                .font(.system(size: 64, weight: .medium))
                .foregroundColor(Color.textPrimary)
        }
        .padding(.horizontal, 20)
        .padding(.top, 16)
    }
}

struct PopupContent: View {
    let title: String
    let description: String
    let badges: [String]
    
    init(title: String, description: String, badges: [String] = []) {
        self.title = title
        self.description = description
        self.badges = badges
    }
    
    var body: some View {
        VStack(spacing: 12) {
            // Title
            TitleText(title, size: 24)
                .multilineTextAlignment(.center)
            
            // Badges
            if !badges.isEmpty {
                HStack(spacing: 8) {
                    ForEach(badges, id: \.self) { badge in
                        Text(badge)
                            .font(FontManager.caption)
                            .foregroundColor(Color.accentSecondary)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(
                                RoundedRectangle(cornerRadius: .cornerRadiusLarge)
                                    .fill(Color.backgroundCard)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: .cornerRadiusLarge)
                                            .stroke(Color.accentSecondary, lineWidth: 2)
                                    )
                            )
                    }
                }
            }
            
            // Description
            NormalText(description, size: 16)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 8)
        }
        .padding(.horizontal, 20)
        .padding(.top, 20)
        .padding(.bottom, 24)
    }
}

struct PopupActionButton: View {
    let text: String
    let action: () -> Void
    
    var body: some View {
        Button {
            action()
        } label: {
            Text(text)
                .font(FontManager.body)
                .foregroundColor(Color.textPrimary)
                .frame(maxWidth: .infinity)
                .frame(height: 50)
                .background(
                    RoundedRectangle(cornerRadius: .cornerRadiusLarge)
                        .fill(Color.accentSecondary)
                        .overlay(
                            RoundedRectangle(cornerRadius: .cornerRadiusLarge)
                                .stroke(Color.textSecondary, lineWidth: 2)
                        )
                )
        }
        .buttonStyle(PlainButtonStyle())
        .padding(.horizontal, 20)
        .padding(.top, 20)
        .padding(.bottom, 24)
    }
}

// MARK: - Convenience Popup Builders

extension View {
    /// Show a standardized popup with custom content
    func showAnimatedPopup<Content: View>(
        isPresented: Binding<Bool>,
        @ViewBuilder content: @escaping () -> Content
    ) -> some View {
        self.overlay(
            Group {
                if isPresented.wrappedValue {
                    AnimatedPopup(isPresented: isPresented) {
                        content()
                    }
                }
            }
        )
    }
    
    /// Show a simple info popup
    func showInfoPopup(
        isPresented: Binding<Bool>,
        title: String,
        description: String,
        imageName: String = "info.circle.fill"
    ) -> some View {
        self.showAnimatedPopup(isPresented: isPresented) {
            VStack(spacing: 0) {
                PopupHeader {
                    isPresented.wrappedValue = false
                }
                
                PopupImage(imageName: imageName)
                
                PopupContent(title: title, description: description)
            }
            .background(
                RoundedRectangle(cornerRadius: .cornerRadiusXXL)
                    .fill(Color.backgroundPrimary)
                    .overlay(
                        RoundedRectangle(cornerRadius: .cornerRadiusXXL)
                            .stroke(Color.accent, lineWidth: 2)
                    )
            )
            .padding(.horizontal, 32)
        }
    }
    
    /// Show an action popup with a button
    func showActionPopup(
        isPresented: Binding<Bool>,
        title: String,
        description: String,
        buttonText: String,
        imageName: String = "exclamationmark.triangle.fill",
        onAction: @escaping () -> Void
    ) -> some View {
        self.showAnimatedPopup(isPresented: isPresented) {
            VStack(spacing: 0) {
                PopupHeader {
                    isPresented.wrappedValue = false
                }
                
                PopupImage(imageName: imageName)
                
                PopupContent(title: title, description: description)
                
                PopupActionButton(text: buttonText) {
                    onAction()
                    isPresented.wrappedValue = false
                }
            }
            .background(
                RoundedRectangle(cornerRadius: .cornerRadiusXXL)
                    .fill(Color.backgroundPrimary)
                    .overlay(
                        RoundedRectangle(cornerRadius: .cornerRadiusXXL)
                            .stroke(Color.accent, lineWidth: 2)
                    )
            )
            .padding(.horizontal, 32)
        }
    }
}
