import SwiftUI

/// A dialogue bubble component for displaying enemy dialogue during combat
struct EnemyDialogueBubble: View {
    let dialogue: DialogueData
    @Binding var isVisible: Bool

    // Compute tone color, defaulting to white if tone doesn't match
    private func toneColor() -> Color {
        switch dialogue.tone.lowercased() {
        case "confident": return .blue.opacity(0.8)
        case "angry": return .red.opacity(0.8)
        case "mocking": return .yellow.opacity(0.8)
        case "desperate": return .orange.opacity(0.8)
        case "victorious": return .green.opacity(0.8)
        default: return .white.opacity(0.8)
        }
    }

    var body: some View {
        Group {
            if isVisible {
                VStack(alignment: .center, spacing: 4) {
                    Text(dialogue.text)
                        .font(.system(size: 16))
                        .foregroundColor(.white)
                        .lineLimit(3)
                        .multilineTextAlignment(.center)
                }
                .padding(12)
                .background(
                    GeometryReader { geometry in
                        ZStack {
                            // Rounded rectangle background
                            RoundedRectangle(cornerRadius: 12)
                                .fill(toneColor())

                            // Triangle tail
                            Triangle()
                                .fill(toneColor())
                                .frame(width: 20, height: 10)
                                .offset(y: geometry.size.height)
                        }
                    }
                )
                .transition(.asymmetric(
                    insertion: .scale(scale: 0.8).combined(with: .opacity).animation(.easeIn(duration: 0.3)),
                    removal: .scale(scale: 0.95).combined(with: .opacity).animation(.easeOut(duration: 0.5))
                ))
            }
        }
    }

    /// Custom triangle shape for bubble tail
    private struct Triangle: Shape {
        func path(in rect: CGRect) -> Path {
            var path = Path()
            path.move(to: CGPoint(x: rect.midX, y: 0))
            path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
            path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
            path.closeSubpath()
            return path
        }
    }
}

/// Preview of the dialogue bubble
#Preview("Confident Tone") {
    StatefulPreviewWrapper(true) { binding in
        EnemyDialogueBubble(
            dialogue: DialogueData(text: "Your efforts are futile!", tone: "confident"),
            isVisible: binding
        )
    }
}

/// Preview of the dialogue bubble
#Preview("Angry Tone") {
    StatefulPreviewWrapper(true) { binding in
        EnemyDialogueBubble(
            dialogue: DialogueData(text: "I will crush you!", tone: "angry"),
            isVisible: binding
        )
    }
}

/// Helper struct to manage state in SwiftUI previews
private struct StatefulPreviewWrapper<Value, Content: View>: View {
    @State private var value: Value
    private let content: (Binding<Value>) -> Content

    init(_ wrappedValue: Value, @ViewBuilder content: @escaping (Binding<Value>) -> Content) {
        self._value = State(initialValue: wrappedValue)
        self.content = content
    }

    var body: some View {
        content($value)
    }
}