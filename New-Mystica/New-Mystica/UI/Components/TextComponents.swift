import SwiftUI

// MARK: - Title Text Component
struct TitleText: View {
    let text: String
    let size: CGFloat
    
    init(_ text: String, size: CGFloat = 30) {
        self.text = text
        self.size = size
    }
    
    var body: some View {
        Text(text)
            .font(FontManager.title)
            .foregroundColor(Color.textPrimary)
            .kerning(0.5)
            .shadow(color: .black.opacity(0.3), radius: 2, x: 0, y: 2)
            .lineLimit(nil)
    }
}

// MARK: - Normal Text Component
struct NormalText: View {
    let text: String
    let size: CGFloat
    
    init(_ text: String, size: CGFloat = 17) {
        self.text = text
        self.size = size
    }
    
    var body: some View {
        Text(text)
            .font(FontManager.body)
            .foregroundColor(Color.textSecondary)
            .kerning(0.2)
            .lineSpacing(2)
            .lineLimit(nil)
    }
}

// MARK: - Small Text Component
struct SmallText: View {
    let text: String
    let size: CGFloat
    let color: Color?

    init(_ text: String, size: CGFloat = 13, color: Color? = nil) {
        self.text = text
        self.size = size
        self.color = color
    }

    var body: some View {
        Text(text)
            .font(FontManager.primary(size: size))
            .foregroundColor(color ?? Color.textSecondary)
            .kerning(0.2)
            .lineSpacing(1)
            .lineLimit(nil)
    }
}
