import SwiftUI

/// A dialogue bubble component for displaying enemy dialogue during combat
struct EnemyDialogueBubble: View {
    let dialogue: DialogueData
    @Binding var isVisible: Bool

    var body: some View {
        Group {
            if isVisible {
                VStack(alignment: .center, spacing: 4) {
                    Text(dialogue.text)
                        .font(FontManager.body)
                        .foregroundColor(.primary)
                        .lineLimit(3)
                        .multilineTextAlignment(.center)
                }
                .padding(12)
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color.tertiary)
                )
                .transition(.asymmetric(
                    insertion: .scale(scale: 0.8).combined(with: .opacity).animation(.easeIn(duration: 0.3)),
                    removal: .scale(scale: 0.95).combined(with: .opacity).animation(.easeOut(duration: 0.5))
                ))
            }
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