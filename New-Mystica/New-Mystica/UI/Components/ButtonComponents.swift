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
        Button {
            if !isDisabled {
                action()
            }
        } label: {
            Image(systemName: icon)
                .font(.system(size: 20, weight: .medium))
                .foregroundColor(isDisabled ? Color.mysticaLightBrown : Color.mysticaSoftBrown)
                .frame(width: size, height: size)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(isDisabled ? Color.mysticaCharcoal : (isPressed ? Color.mysticaDarkGray : Color.mysticaDarkBrown))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(isDisabled ? Color.mysticaDarkGray : (isPressed ? Color.mysticaWarmBrown : Color.mysticaLightBrown), lineWidth: 1)
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
        Button {
            if !isDisabled {
                action()
            }
        } label: {
            Text(title)
                .font(.custom("Impact", size: 17))
                .foregroundColor(isDisabled ? Color.mysticaLightBrown : Color.mysticaLightGray)
                .frame(maxWidth: .infinity)
                .frame(height: height)
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(isDisabled ? Color.mysticaCharcoal : (isPressed ? Color.mysticaWarmBrown : Color.mysticaLightBrown))
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
        Button {
            if !isDisabled {
                action()
            }
        } label: {
            Image(systemName: "chevron.left")
                .font(.system(size: 16, weight: .medium))
                .foregroundColor(isDisabled ? Color.mysticaLightBrown : Color.mysticaSoftBrown)
                .frame(width: size, height: size)
                .background(
                    Circle()
                        .fill(isPressed ? Color.mysticaDarkBrown : Color.clear)
                )
                .overlay(
                    Circle()
                        .stroke(isDisabled ? Color.mysticaDarkGray : (isPressed ? Color.mysticaWarmBrown : Color.mysticaLightBrown), lineWidth: 1)
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