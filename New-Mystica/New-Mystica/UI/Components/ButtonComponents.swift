import SwiftUI

// MARK: - Icon Button Component
struct IconButton: View {
    let icon: String
    let action: () -> Void
    let size: CGFloat
    let isDisabled: Bool
    
    @State private var isPressed = false
    
    init(icon: String, size: CGFloat = 44, isDisabled: Bool = false, action: @escaping () -> Void) {
        self.icon = icon
        self.size = size
        self.isDisabled = isDisabled
        self.action = action
    }
    
    var body: some View {
        Button(action: {
            if !isDisabled {
                action()
            }
        }) {
            Image(systemName: icon)
                .font(.system(size: 20, weight: .medium))
                .foregroundColor(isDisabled ? .mysticaLightBrown : .mysticaSoftBrown)
                .frame(width: size, height: size)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(isDisabled ? .mysticaCharcoal : (isPressed ? .mysticaDarkGray : .mysticaDarkBrown))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(isDisabled ? .mysticaDarkGray : (isPressed ? .mysticaWarmBrown : .mysticaLightBrown), lineWidth: 1)
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
    
    @State private var isPressed = false
    
    init(_ title: String, height: CGFloat = 48, isDisabled: Bool = false, action: @escaping () -> Void) {
        self.title = title
        self.height = height
        self.isDisabled = isDisabled
        self.action = action
    }
    
    var body: some View {
        Button(action: {
            if !isDisabled {
                action()
            }
        }) {
            Text(title)
                .font(.system(size: 17, weight: .semibold))
                .foregroundColor(isDisabled ? .mysticaLightBrown : .mysticaLightGray)
                .frame(maxWidth: .infinity)
                .frame(height: height)
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(isDisabled ? .mysticaCharcoal : (isPressed ? .mysticaWarmBrown : .mysticaLightBrown))
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
}

// MARK: - Back Button Component
struct BackButton: View {
    let action: () -> Void
    let size: CGFloat
    let isDisabled: Bool
    
    @State private var isPressed = false
    
    init(size: CGFloat = 40, isDisabled: Bool = false, action: @escaping () -> Void) {
        self.size = size
        self.isDisabled = isDisabled
        self.action = action
    }
    
    var body: some View {
        Button(action: {
            if !isDisabled {
                action()
            }
        }) {
            Image(systemName: "chevron.left")
                .font(.system(size: 16, weight: .medium))
                .foregroundColor(isDisabled ? .mysticaLightBrown : .mysticaSoftBrown)
                .frame(width: size, height: size)
                .background(
                    Circle()
                        .fill(isPressed ? .mysticaDarkBrown : .clear)
                )
                .overlay(
                    Circle()
                        .stroke(isDisabled ? .mysticaDarkGray : (isPressed ? .mysticaWarmBrown : .mysticaLightBrown), lineWidth: 1)
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
