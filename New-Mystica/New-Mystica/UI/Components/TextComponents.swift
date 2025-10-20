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
            .font(.custom("Impact", size: size))
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
            .font(.custom("Impact", size: size))
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
    
    init(_ text: String, size: CGFloat = 13) {
        self.text = text
        self.size = size
    }
    
    var body: some View {
        Text(text)
            .font(.custom("Impact", size: size))
            .foregroundColor(Color.textSecondary)
            .kerning(0.2)
            .lineSpacing(1)
            .lineLimit(nil)
    }
}
