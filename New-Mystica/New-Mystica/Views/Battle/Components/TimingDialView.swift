//
//  TimingDialView.swift
//  New-Mystica
//
//  5-zone timing dial with 60fps rotation animation for combat system
//  Uses Timer.publish() for smooth constant rotation at specified speed
//

import SwiftUI
import Combine

struct TimingDialView: View {
    @Binding var dialRotation: Double
    @Binding var isDialSpinning: Bool
    let adjustedBands: AdjustedBands
    let spinSpeed: Double
    let onTap: ((Double) -> Void)?

    // Animation state
    @State private var currentRotation: Double = 0
    @State private var zoneFlashOpacity: Double = 0

    // Timer for 60fps animation (16.67ms ≈ 1/60 second)
    private let animationTimer = Timer.publish(every: 0.016667, on: .main, in: .common).autoconnect()

    var body: some View {
        VStack(spacing: 8) {
            SmallText("Combat Dial", size: 12)
                .foregroundColor(Color.textPrimary)

            ZStack {
                // 5-zone dial shape
                FiveZoneDialShape(adjustedBands: adjustedBands)
                    .frame(width: 200, height: 200)

                // Rotating needle/pointer
                Rectangle()
                    .fill(Color.white)
                    .frame(width: 3, height: 90)
                    .offset(y: -45)
                    .rotationEffect(.degrees(currentRotation))
                    .shadow(color: .black.opacity(0.5), radius: 2, x: 1, y: 1)

                // Center dot
                Circle()
                    .fill(Color.white)
                    .frame(width: 12, height: 12)
                    .shadow(color: .black.opacity(0.3), radius: 1)
            }
            .frame(width: 200, height: 200)
            .onTapGesture { location in
                if let onTap = onTap {
                    let center = CGPoint(x: 100, y: 100) // Half of frame size (200x200)
                    let degrees = tapToAngle(location: location, center: center)
                    onTap(degrees)
                }
            }
            .onReceive(animationTimer) { _ in
                updateRotation()
            }
        }
    }

    // MARK: - Tap-to-Angle Calculation

    /// Converts tap coordinates to degrees (0-360)
    /// - Parameters:
    ///   - location: Tap location in view coordinates
    ///   - center: Center point of the dial
    /// - Returns: Angle in degrees (0-360), where 0° is pointing up (12 o'clock)
    private func tapToAngle(location: CGPoint, center: CGPoint) -> Double {
        let dx = location.x - center.x
        let dy = location.y - center.y

        // atan2 gives us angle from positive x-axis, but we want from positive y-axis (12 o'clock)
        // Also need to flip y because SwiftUI has origin at top-left
        let radians = atan2(dx, -dy)
        let degrees = radians * 180 / .pi

        // Normalize to 0-360 range
        return degrees < 0 ? degrees + 360 : degrees
    }

    // MARK: - Animation Control Methods

    private func updateRotation() {
        guard isDialSpinning else { return }

        // Calculate rotation increment for 60fps (16.67ms intervals)
        let frameTime = 0.016667 // 1/60 second
        let rotationIncrement = spinSpeed * frameTime

        // Update rotation with wrapping at 360°
        currentRotation += rotationIncrement
        if currentRotation >= 360 {
            currentRotation -= 360
        }

        // Sync with parent binding
        dialRotation = currentRotation
    }
}

#Preview {
    @State var rotation1: Double = 0
    @State var rotation2: Double = 0
    @State var isSpinning1: Bool = false
    @State var isSpinning2: Bool = true

    VStack(spacing: 20) {
        Text("Combat Dial Animation Test")
            .font(.title2)
            .foregroundColor(.white)

        HStack(spacing: 40) {
            VStack {
                Text("Stopped")
                    .font(.caption)
                    .foregroundColor(.secondary)
                TimingDialView(
                    dialRotation: $rotation1,
                    isDialSpinning: $isSpinning1,
                    adjustedBands: AdjustedBands(
                        degInjure: 45,
                        degMiss: 75,
                        degGraze: 90,
                        degNormal: 105,
                        degCrit: 45
                    ),
                    spinSpeed: 0,
                    onTap: { degrees in
                        print("Tap at angle: \(degrees)°")
                        isSpinning1.toggle()
                    }
                )
                .onTapGesture {
                    isSpinning1.toggle()
                }
            }

            VStack {
                Text("Spinning (180°/s)")
                    .font(.caption)
                    .foregroundColor(.secondary)
                TimingDialView(
                    dialRotation: $rotation2,
                    isDialSpinning: $isSpinning2,
                    adjustedBands: AdjustedBands(
                        degInjure: 45,
                        degMiss: 75,
                        degGraze: 90,
                        degNormal: 105,
                        degCrit: 45
                    ),
                    spinSpeed: 180,
                    onTap: { degrees in
                        print("Tap at angle: \(degrees)°")
                        isSpinning2.toggle()
                    }
                )
            }
        }

        Text("Tap dials to start/stop rotation")
            .font(.caption)
            .foregroundColor(.secondary)
    }
    .padding()
    .background(Color.black)
}

// MARK: - 5-Zone Dial Shape
struct FiveZoneDialShape: View {
    let adjustedBands: AdjustedBands

    // Zone colors from requirements (outer to inner)
    private let zoneColors: [Color] = [
        Color(red: 1.0, green: 0.27, blue: 0.27), // Red (injure) - #FF4444
        Color.orange,                              // Orange (miss)
        Color(red: 1.0, green: 0.67, blue: 0.27), // Yellow (graze) - #FFAA44
        Color(red: 0.27, green: 1.0, blue: 0.27), // Bright green (normal) - #44FF44
        Color(red: 0.2, green: 0.8, blue: 0.3)    // Dark green (crit)
    ]

    var body: some View {
        ZStack {
            // Render each zone as an individual arc
            ForEach(0..<5, id: \.self) { zoneIndex in
                ZoneArcShape(
                    adjustedBands: adjustedBands,
                    zoneIndex: zoneIndex
                )
                .fill(zoneColors[zoneIndex])
            }
        }
    }
}

// MARK: - Individual Zone Arc Shape
struct ZoneArcShape: Shape {
    let adjustedBands: AdjustedBands
    let zoneIndex: Int

    private var zoneDegrees: [Double] {
        [
            adjustedBands.degInjure,  // 0: Red (outer)
            adjustedBands.degMiss,    // 1: Orange
            adjustedBands.degGraze,   // 2: Yellow
            adjustedBands.degNormal,  // 3: Bright green
            adjustedBands.degCrit     // 4: Dark green (inner)
        ]
    }

    private var startAngle: Double {
        // Calculate cumulative start angle for this zone
        let previousZonesDegrees = zoneDegrees.prefix(zoneIndex).reduce(0, +)
        return previousZonesDegrees
    }

    private var endAngle: Double {
        return startAngle + zoneDegrees[zoneIndex]
    }

    func path(in rect: CGRect) -> Path {
        let center = CGPoint(x: rect.midX, y: rect.midY)
        let radius = min(rect.width, rect.height) / 2

        // All zones at same radius - angular segments only
        let outerRadius = radius
        let innerRadius = radius * 0.4 // Inner circle for all zones

        return Path { path in
            // Convert degrees to radians and adjust for SwiftUI coordinate system
            // SwiftUI uses 0° = east, clockwise positive
            // Our system uses 0° = north, so subtract 90°
            let startRadians = (startAngle - 90) * .pi / 180
            let endRadians = (endAngle - 90) * .pi / 180

            // Create the arc path for this zone
            path.addArc(
                center: center,
                radius: outerRadius,
                startAngle: Angle(radians: startRadians),
                endAngle: Angle(radians: endRadians),
                clockwise: false
            )

            // Line to inner arc
            let innerEndPoint = CGPoint(
                x: center.x + innerRadius * cos(endRadians),
                y: center.y + innerRadius * sin(endRadians)
            )
            path.addLine(to: innerEndPoint)

            // Inner arc (reverse direction)
            path.addArc(
                center: center,
                radius: innerRadius,
                startAngle: Angle(radians: endRadians),
                endAngle: Angle(radians: startRadians),
                clockwise: true
            )

            // Close the path
            path.closeSubpath()
        }
    }
}