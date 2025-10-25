import SwiftUI

// MARK: - Icon Button Component
struct IconButton: View {
    let icon: String
    let action: () -> Void
    let size: CGFloat
    let isDisabled: Bool
    
    @State private var isPressed = false
    @Environment(\.audioManager) private var audioManager
    
    init(icon: String, size: CGFloat = 44, isDisabled: Bool = false, action: @escaping () -> Void) {
        self.icon = icon
        self.size = size
        self.isDisabled = isDisabled
        self.action = action
    }
    
    var body: some View {
        Button {
            if !isDisabled {
                audioManager.playMenuButtonClick()
                action()
            }
        } label: {
            Image(systemName: icon)
                .font(.system(size: 20, weight: .medium))
                .foregroundColor(isDisabled ? Color.textSecondary : Color.textSecondary)
                .frame(width: size, height: size)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(isDisabled ? Color.backgroundSecondary : (isPressed ? Color.borderSubtle : Color.backgroundPrimary))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(isDisabled ? Color.borderSubtle : (isPressed ? Color.accentInteractive : Color.accent), lineWidth: 1)
                )
        }
        .buttonStyle(PlainButtonStyle())
        .scaleEffect(isPressed ? 0.95 : 1.0)
        .disabled(isDisabled)
        .onLongPressGesture(minimumDuration: 0, maximumDistance: .infinity, pressing: { pressing in
            withAnimation(.easeOut(duration: 0.15)) {
                isPressed = pressing
            }
        }, perform: {})
    }
}

// MARK: - Text Button Component
struct TextButton: View {
    let title: String
    let action: () -> Void
    let height: CGFloat
    let isDisabled: Bool
    let isDestructive: Bool

    @State private var isPressed = false
    @Environment(\.audioManager) private var audioManager

    init(_ title: String, height: CGFloat = 48, isDisabled: Bool = false, isDestructive: Bool = false, action: @escaping () -> Void) {
        self.title = title
        self.height = height
        self.isDisabled = isDisabled
        self.isDestructive = isDestructive
        self.action = action
    }

    var body: some View {
        Button {
            if !isDisabled {
                audioManager.playMenuButtonClick()
                action()
            }
        } label: {
            Text(title)
                .font(FontManager.body)
                .foregroundColor(isDisabled ? Color.textSecondary : Color.textPrimary)
                .frame(maxWidth: .infinity)
                .frame(height: height)
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(backgroundColor)
                )
        }
        .buttonStyle(PlainButtonStyle())
        .scaleEffect(isPressed ? 0.98 : 1.0)
        .disabled(isDisabled)
        .onLongPressGesture(minimumDuration: 0, maximumDistance: .infinity, pressing: { pressing in
            withAnimation(.easeOut(duration: 0.15)) {
                isPressed = pressing
            }
        }, perform: {})
    }

    private var backgroundColor: Color {
        if isDisabled {
            return Color.backgroundSecondary
        } else if isDestructive {
            return isPressed ? Color(red: 0.8, green: 0.1, blue: 0.1) : Color(red: 0.9, green: 0.2, blue: 0.2)
        } else {
            return isPressed ? Color.accentInteractive : Color.accent
        }
    }
}

// MARK: - Back Button Component
struct BackButton: View {
    let action: () -> Void
    let size: CGFloat
    let isDisabled: Bool
    
    @State private var isPressed = false
    @Environment(\.audioManager) private var audioManager
    
    init(size: CGFloat = 40, isDisabled: Bool = false, action: @escaping () -> Void) {
        self.size = size
        self.isDisabled = isDisabled
        self.action = action
    }
    
    var body: some View {
        Button {
            if !isDisabled {
                audioManager.playBackButtonClick()
                action()
            }
        } label: {
            Image(systemName: "chevron.left")
                .font(.system(size: 16, weight: .medium))
                .foregroundColor(isDisabled ? Color.textSecondary : Color.textSecondary)
                .frame(width: size, height: size)
                .background(
                    Circle()
                        .fill(isPressed ? Color.backgroundPrimary : Color.clear)
                )
                .overlay(
                    Circle()
                        .stroke(isDisabled ? Color.borderSubtle : (isPressed ? Color.accentInteractive : Color.accent), lineWidth: 1)
                )
        }
        .buttonStyle(PlainButtonStyle())
        .scaleEffect(isPressed ? 0.95 : 1.0)
        .disabled(isDisabled)
        .onLongPressGesture(minimumDuration: 0, maximumDistance: .infinity, pressing: { pressing in
            withAnimation(.easeOut(duration: 0.15)) {
                isPressed = pressing
            }
        }, perform: {})
    }
}