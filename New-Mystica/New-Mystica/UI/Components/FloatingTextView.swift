//
//  FloatingTextView.swift
//  New-Mystica
//
//  Created by AI Assistant on 10/19/25.
//

import SwiftUI
import Combine

struct FloatingText: Identifiable {
    let id = UUID()
    let text: String
    let color: Color
    let fontSize: CGFloat
    let fontWeight: Font.Weight
    let duration: Double
    let distance: CGFloat
    let startOffset: CGFloat
    let position: CGPoint
    var currentOffset: CGFloat = 0
    var currentOpacity: Double = 1.0
    var currentScale: CGFloat = 1.0
    
    init(
        text: String,
        color: Color = .primary,
        fontSize: CGFloat = 20,
        fontWeight: Font.Weight = .bold,
        duration: Double = 2.0,
        distance: CGFloat = -100,
        startOffset: CGFloat = 0,
        position: CGPoint = CGPoint(x: 0, y: 0)
    ) {
        self.text = text
        self.color = color
        self.fontSize = fontSize
        self.fontWeight = fontWeight
        self.duration = duration
        self.distance = distance
        self.startOffset = startOffset
        self.position = position
        self.currentOffset = startOffset
    }
}


struct FloatingTextModifier: ViewModifier {
    @StateObject private var floatingTextView = FloatingTextView()
    
    func body(content: Content) -> some View {
        ZStack {
            content
            
            FloatingTextOverlay(floatingTexts: $floatingTextView.floatingTexts)
                .allowsHitTesting(false)
        }
        .environmentObject(floatingTextView)
        .onAppear {
        }
    }
}

struct FloatingTextOverlay: View {
    @Binding var floatingTexts: [FloatingText]
    
    var body: some View {
        ZStack {
            ForEach(floatingTexts) { floatingText in
                Text(floatingText.text)
                    .font(FontManager.primary(size: floatingText.fontSize))
                    .foregroundColor(floatingText.color)
                    .offset(x: floatingText.position.x, y: floatingText.position.y + floatingText.currentOffset)
                    .opacity(floatingText.currentOpacity)
                    .scaleEffect(floatingText.currentScale)
            }
        }
    }
}

extension View {
    func floatingText() -> some View {
        modifier(FloatingTextModifier())
    }
}

@MainActor
class FloatingTextView: ObservableObject {
    @Published var floatingTexts: [FloatingText] = []
    
    
    func showText(_ text: String, color: Color = Color.primary) {
        let floatingText = FloatingText(text: text, color: color)
        showFloatingText(floatingText)
    }
    
    func showText(
        _ text: String,
        color: Color = Color.primary,
        fontSize: CGFloat = 20,
        fontWeight: Font.Weight = .bold,
        duration: Double = 2.0,
        distance: CGFloat = -100,
        offsetY: CGFloat = 0
    ) {
        let floatingText = FloatingText(
            text: text,
            color: color,
            fontSize: fontSize,
            fontWeight: fontWeight,
            duration: duration,
            distance: distance,
            startOffset: offsetY,
            position: .zero
        )
        showFloatingText(floatingText)
    }
    
    func showDamage(_ damage: Double, isCritical: Bool = false) {
        let damageText = String(format: "%.0f", damage)
        let color = isCritical ? Color.red : Color.orange
        let fontSize: CGFloat = isCritical ? 24 : 20
        let fontWeight: Font.Weight = isCritical ? .black : .bold
        let duration = isCritical ? 2.5 : 2.0
        let distance: CGFloat = isCritical ? -120 : -100
        
        let floatingText = FloatingText(
            text: damageText,
            color: color,
            fontSize: fontSize,
            fontWeight: fontWeight,
            duration: duration,
            distance: distance
        )
        showFloatingText(floatingText)
    }
    
    /// Shows a damage number with special styling at a specific position
    func showDamage(_ damage: Double, isCritical: Bool = false, at position: CGPoint) {
        let damageText = String(format: "%.0f", damage)
        let color = isCritical ? Color.red : Color.orange
        let fontSize: CGFloat = isCritical ? 24 : 20
        let fontWeight: Font.Weight = isCritical ? .black : .bold
        let duration = isCritical ? 2.5 : 2.0
        let distance: CGFloat = isCritical ? -120 : -100
        
        let floatingText = FloatingText(
            text: damageText,
            color: color,
            fontSize: fontSize,
            fontWeight: fontWeight,
            duration: duration,
            distance: distance,
            startOffset: 0,
            position: position
        )
        showFloatingText(floatingText)
    }
    
    func showMultiplier(_ multiplier: Double) {
        let multiplierText = String(format: "%.1fx", multiplier)
        let color = multiplier > 1.5 ? Color.green : multiplier > 1.0 ? Color.yellow : Color.red
        let fontSize: CGFloat = multiplier > 1.5 ? 24 : 20
        
        let floatingText = FloatingText(
            text: multiplierText,
            color: color,
            fontSize: fontSize,
            fontWeight: .bold,
            duration: 2.0,
            distance: -100
        )
        showFloatingText(floatingText)
    }
    
    /// Shows a multiplier with color coding at a specific position
    func showMultiplier(_ multiplier: Double, at position: CGPoint) {
        let multiplierText = String(format: "%.1fx", multiplier)
        let color = multiplier > 1.5 ? Color.green : multiplier > 1.0 ? Color.yellow : Color.red
        let fontSize: CGFloat = multiplier > 1.5 ? 24 : 20
        
        let floatingText = FloatingText(
            text: multiplierText,
            color: color,
            fontSize: fontSize,
            fontWeight: .bold,
            duration: 2.0,
            distance: -100,
            startOffset: 0,
            position: position
        )
        showFloatingText(floatingText)
    }
    
    func showHealing(_ healing: Double) {
        let healingText = "+" + String(format: "%.0f", healing)
        let floatingText = FloatingText(
            text: healingText,
            color: Color.green,
            fontSize: 20,
            fontWeight: .bold,
            duration: 2.0,
            distance: -100
        )
        showFloatingText(floatingText)
    }
    
    func showStatusEffect(_ effect: String, color: Color = Color.purple) {
        let floatingText = FloatingText(
            text: effect,
            color: color,
            fontSize: 16,
            fontWeight: .medium,
            duration: 3.0,
            distance: -80
        )
        showFloatingText(floatingText)
    }
    
    func clearAll() {
        floatingTexts.removeAll()
    }
    
    
    private func showFloatingText(_ floatingText: FloatingText) {
        floatingTexts.append(floatingText)
        
        withAnimation(.easeOut(duration: floatingText.duration)) {
            if let index = floatingTexts.firstIndex(where: { $0.id == floatingText.id }) {
                floatingTexts[index].currentOffset = floatingText.distance
                floatingTexts[index].currentOpacity = 0.0
                floatingTexts[index].currentScale = 0.8
            }
        }
        
        Task { @MainActor in
            try await Task.sleep(for: .seconds(floatingText.duration))
            self.floatingTexts.removeAll { $0.id == floatingText.id }
        }
    }
}

#Preview {
    VStack {
        Text("Tap to show floating text")
            .padding()
        
        Button("Show Multiplier") {
        }
        .padding()
    }
    .floatingText()
}
