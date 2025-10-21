import SwiftUI

// MARK: - Animation Configuration

struct AnimationConfig {
    let duration: Double
    let delay: Double
    let curve: Animation
    
    static let fast = AnimationConfig(duration: 0.4, delay: 0.0, curve: .easeOut)
    static let normal = AnimationConfig(duration: 0.6, delay: 0.0, curve: .easeOut)
    static let slow = AnimationConfig(duration: 0.8, delay: 0.0, curve: .spring(response: 0.8, dampingFraction: 0.8))
    static let popup = AnimationConfig(duration: 0.7, delay: 0.0, curve: .spring(response: 0.7, dampingFraction: 0.8))
    
    // Performance-optimized configurations
    static let performanceFast = AnimationConfig(duration: 0.35, delay: 0.0, curve: .easeOut(duration: 0.35))
    static let performanceNormal = AnimationConfig(duration: 0.5, delay: 0.0, curve: .easeOut(duration: 0.5))
    static let performanceStagger = AnimationConfig(duration: 0.4, delay: 0.0, curve: .easeOut(duration: 0.4))
    
    func withDelay(_ delay: Double) -> AnimationConfig {
        AnimationConfig(duration: duration, delay: delay, curve: curve)
    }
}

// MARK: - Standardized Animation Modifiers

/// Universal slide-in animation modifier
struct SlideInModifier: ViewModifier {
    let config: AnimationConfig
    let offsetY: CGFloat
    let offsetX: CGFloat
    
    @State private var isVisible = false
    
    init(config: AnimationConfig = .normal, offsetY: CGFloat = 50, offsetX: CGFloat = 0) {
        self.config = config
        self.offsetY = offsetY
        self.offsetX = offsetX
    }
    
    func body(content: Content) -> some View {
        content
            .offset(x: isVisible ? 0 : offsetX, y: isVisible ? 0 : offsetY)
            .opacity(isVisible ? 1 : 0)
            .onAppear {
                // Reset animation state
                isVisible = false
                
                // Trigger animation
                withAnimation(config.curve.delay(config.delay)) {
                    isVisible = true
                }
            }
    }
}

/// Universal popup animation modifier
struct PopupAnimationModifier: ViewModifier {
    let config: AnimationConfig
    let scaleFrom: CGFloat
    let scaleTo: CGFloat
    
    @State private var isVisible = false
    
    init(config: AnimationConfig = .popup, scaleFrom: CGFloat = 0.8, scaleTo: CGFloat = 1.0) {
        self.config = config
        self.scaleFrom = scaleFrom
        self.scaleTo = scaleTo
    }
    
    func body(content: Content) -> some View {
        content
            .scaleEffect(isVisible ? scaleTo : scaleFrom)
            .opacity(isVisible ? 1 : 0)
            .onAppear {
                // Reset animation state
                isVisible = false
                
                // Trigger animation
                withAnimation(config.curve.delay(config.delay)) {
                    isVisible = true
                }
            }
    }
}

/// Performance-optimized staggered animation modifier for lists/grids
struct StaggeredAnimationModifier: ViewModifier {
    let index: Int
    let staggerDelay: Double
    let config: AnimationConfig
    let offsetY: CGFloat
    
    @State private var isVisible = false
    
    init(index: Int, staggerDelay: Double = 0.08, config: AnimationConfig = .performanceStagger, offsetY: CGFloat = 15) {
        self.index = index
        self.staggerDelay = staggerDelay
        self.config = config
        self.offsetY = offsetY
    }
    
    func body(content: Content) -> some View {
        content
            .offset(y: isVisible ? 0 : offsetY)
            .opacity(isVisible ? 1 : 0)
            // Removed scaleEffect for better performance - only use opacity and offset
            .onAppear {
                // Use DispatchQueue for better performance with many items
                DispatchQueue.main.asyncAfter(deadline: .now() + Double(index) * staggerDelay) {
                    withAnimation(config.curve) {
                        isVisible = true
                    }
                }
            }
    }
}

/// Batch animation modifier for better performance with many items
struct BatchAnimationModifier: ViewModifier {
    let batchIndex: Int
    let batchSize: Int
    let config: AnimationConfig
    let offsetY: CGFloat
    
    @State private var isVisible = false
    
    init(batchIndex: Int, batchSize: Int = 6, config: AnimationConfig = .performanceStagger, offsetY: CGFloat = 15) {
        self.batchIndex = batchIndex
        self.batchSize = batchSize
        self.config = config
        self.offsetY = offsetY
    }
    
    func body(content: Content) -> some View {
        content
            .offset(y: isVisible ? 0 : offsetY)
            .opacity(isVisible ? 1 : 0)
            .onAppear {
                // Animate items in batches to reduce simultaneous animations
                let delay = Double(batchIndex) * 0.15
                DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
                    withAnimation(config.curve) {
                        isVisible = true
                    }
                }
            }
    }
}

// MARK: - View Extensions for Easy Usage

extension View {
    /// Apply slide-in animation with customizable parameters
    func slideIn(config: AnimationConfig = .normal, offsetY: CGFloat = 50, offsetX: CGFloat = 0) -> some View {
        self.modifier(SlideInModifier(config: config, offsetY: offsetY, offsetX: offsetX))
    }
    
    /// Apply popup animation with scale and fade
    func popupAnimation(config: AnimationConfig = .popup, scaleFrom: CGFloat = 0.8, scaleTo: CGFloat = 1.0) -> some View {
        self.modifier(PopupAnimationModifier(config: config, scaleFrom: scaleFrom, scaleTo: scaleTo))
    }
    
    /// Apply staggered animation for lists/grids (performance optimized)
    func staggeredAnimation(index: Int, staggerDelay: Double = 0.08, config: AnimationConfig = .performanceStagger, offsetY: CGFloat = 15) -> some View {
        self.modifier(StaggeredAnimationModifier(index: index, staggerDelay: staggerDelay, config: config, offsetY: offsetY))
    }
    
    /// Apply batch animation for better performance with many items
    func batchAnimation(batchIndex: Int, batchSize: Int = 6, config: AnimationConfig = .performanceStagger, offsetY: CGFloat = 15) -> some View {
        self.modifier(BatchAnimationModifier(batchIndex: batchIndex, batchSize: batchSize, config: config, offsetY: offsetY))
    }
    
    // MARK: - Convenience Methods
    
    /// Quick slide-in from bottom
    func slideInFromBottom(delay: Double = 0.0) -> some View {
        self.slideIn(config: .normal.withDelay(delay), offsetY: 50)
    }
    
    /// Quick slide-in from top
    func slideInFromTop(delay: Double = 0.0) -> some View {
        self.slideIn(config: .normal.withDelay(delay), offsetY: -50)
    }
    
    /// Quick slide-in from left
    func slideInFromLeft(delay: Double = 0.0) -> some View {
        self.slideIn(config: .normal.withDelay(delay), offsetX: -50)
    }
    
    /// Quick slide-in from right
    func slideInFromRight(delay: Double = 0.0) -> some View {
        self.slideIn(config: .normal.withDelay(delay), offsetX: 50)
    }
    
    /// Quick popup animation
    func popup(delay: Double = 0.0) -> some View {
        self.popupAnimation(config: .popup.withDelay(delay))
    }
    
    /// Quick staggered animation for grid items (performance optimized)
    func staggerIn(index: Int, staggerDelay: Double = 0.08) -> some View {
        self.staggeredAnimation(index: index, staggerDelay: staggerDelay)
    }
    
    /// Quick batch animation for grid items (best performance for large grids)
    func batchIn(batchIndex: Int, batchSize: Int = 6) -> some View {
        self.batchAnimation(batchIndex: batchIndex, batchSize: batchSize)
    }
}

// MARK: - Animation Utilities

struct AnimationUtils {
    /// Calculate delay for staggered animations
    static func calculateDelay(for index: Int, baseDelay: Double = 0.0, staggerDelay: Double = 0.1) -> Double {
        return baseDelay + (Double(index) * staggerDelay)
    }
    
    /// Create a spring animation with consistent parameters
    static func spring(duration: Double = 0.5, damping: Double = 0.8) -> Animation {
        .spring(response: duration, dampingFraction: damping)
    }
    
    /// Create an ease-out animation with consistent parameters
    static func easeOut(duration: Double = 0.3) -> Animation {
        .easeOut(duration: duration)
    }
}

// MARK: - Animation Timing Constants

struct AnimationTiming {
    static let fast = 0.4
    static let normal = 0.6
    static let slow = 0.8
    static let verySlow = 1.0
    
    static let staggerFast = 0.08
    static let staggerNormal = 0.12
    static let staggerSlow = 0.15
    
    // Performance-optimized timing
    static let performanceFast = 0.35
    static let performanceNormal = 0.5
    static let performanceStagger = 0.08
}

// MARK: - Preview Helper

struct AnimationPreviewHelper: View {
    @State private var showContent = false
    
    var body: some View {
        VStack(spacing: 20) {
            Button("Toggle Animations") {
                showContent.toggle()
            }
            
            if showContent {
                VStack(spacing: 16) {
                    // Button group example
                    VStack(spacing: 12) {
                        Text("Button Group Animation")
                            .font(.headline)
                        
                        VStack(spacing: 8) {
                            ForEach(0..<3, id: \.self) { index in
                                Button("Button \(index + 1)") { }
                                    .slideInFromBottom(delay: Double(index) * 0.1)
                            }
                        }
                    }
                    
                    // Grid example
                    VStack(spacing: 12) {
                        Text("Grid Animation")
                            .font(.headline)
                        
                        LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 3), spacing: 16) {
                            ForEach(0..<9, id: \.self) { index in
                                RoundedRectangle(cornerRadius: 8)
                                    .fill(Color.accent)
                                    .frame(height: 60)
                                    .staggerIn(index: index)
                            }
                        }
                    }
                }
            }
        }
        .padding()
    }
}

#Preview {
    AnimationPreviewHelper()
}
