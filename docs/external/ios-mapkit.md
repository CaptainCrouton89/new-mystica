# iOS MapKit LLM Reference

## Critical Signatures

### Map View Initializers (iOS 17+)
```swift
// Primary initializer with MapContentBuilder
Map(position: Binding<MapCameraPosition>) { /* MapContentBuilder */ }

// Full signature with all parameters
Map(
    position: Binding<MapCameraPosition>,
    bounds: MapCameraBounds? = nil,
    interactionModes: MapInteractionModes = .all,
    scope: Namespace.ID? = nil,
    @MapContentBuilder content: () -> MapContent
)

// With selection binding (two-way)
Map(
    position: Binding<MapCameraPosition>,
    selection: Binding<MKMapItem?>,
    @MapContentBuilder content: () -> MapContent
)
```

### MapCameraPosition Cases
```swift
.userLocation(followsHeading: Bool = false, fallback: MapCameraPosition = .automatic)
.region(MKCoordinateRegion)
.camera(MapCamera)  // MapCamera(centerCoordinate:, distance:, heading:, pitch:)
.rect(MKMapRect)
.item(MKMapItem)
.automatic  // Fits all map content
```

### UserAnnotation vs showsUserLocation
```swift
// iOS 17+ (NEW)
Map(position: $position) {
    UserAnnotation()  // Replaces showsUserLocation: true
}

// iOS 16 (DEPRECATED)
Map(coordinateRegion: $region, showsUserLocation: true)
```

## Location Tracking Setup

### Required Info.plist Keys
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>This app needs location access to show your position on the map.</string>

<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>This app needs location access to show your position on the map.</string>
```

### CLLocationManager Integration
```swift
@StateObject private var locationManager = CLLocationManager()
@State private var position: MapCameraPosition = .automatic

// Request permission before using location
locationManager.requestWhenInUseAuthorization()

// Track user location
Map(position: $position) {
    UserAnnotation()
}
.onAppear {
    position = .userLocation(fallback: .automatic)
}
```

## Camera Control & Updates

### Camera Change Tracking
```swift
Map(position: $position)
    .onMapCameraChange(frequency: .continuous) { context in
        // context.camera: MapCamera
        // context.region: MKCoordinateRegion
    }
    .onMapCameraChange(frequency: .onEnd) { context in
        // Fires only when user stops interaction
    }
```

### MapCameraUpdateFrequency
- `.continuous` - Fires during every camera change (high frequency)
- `.onEnd` - Fires only when interaction ends (recommended for performance)

## Annotations & Markers (iOS 17+)

### New Annotation Syntax
```swift
// Simple marker
Marker("Title", coordinate: CLLocationCoordinate2D)

// Custom marker with system image
Marker(coordinate: coordinate) {
    Label("Location", systemImage: "mappin.circle.fill")
}

// Custom annotation with SwiftUI view
Annotation("Custom", coordinate: coordinate) {
    CustomAnnotationView()
        .frame(width: 44, height: 44)
}
```

### Deprecated (iOS 16)
```swift
// DO NOT USE - Deprecated in iOS 17
MapAnnotation(coordinate: coordinate) { /* content */ }
MapMarker(coordinate: coordinate, tint: .red)
MapPin(coordinate: coordinate, tint: .blue)
```

## Interaction Modes

```swift
Map(position: $position, interactionModes: [.pan, .zoom]) { }

// Available modes:
.all        // Default - all interactions enabled
.pan        // Dragging to move map
.zoom       // Pinch to zoom
.rotate     // Two-finger rotation
.pitch      // Two-finger vertical drag for 3D tilt
[]          // No interactions (static map)
```

## Performance Constraints

### Memory Usage
- **MapKit intentionally caches map tiles off-screen** - high memory usage is expected and beneficial for battery life
- **Annotation reloading**: Avoid frequent annotation updates - all annotations reload when selection changes
- **Memory leaks**: Watch for strong reference cycles with delegates and CLLocationManager

### Battery Optimization
- Use `.onEnd` frequency for camera change tracking instead of `.continuous`
- Limit annotation count for smooth performance (30-100 annotations can cause frame drops)
- MapKit's tile caching reduces cellular data usage and radio activation

### Threading Requirements
- **CLLocationManager must be created on main thread**
- Location permission requests must happen on main thread
- Map updates are automatically dispatched to main queue

## Non-Obvious Behaviors

### iOS 16 → 17 Migration Breaking Changes
```swift
// BREAKS in iOS 17
Map(coordinateRegion: $region, showsUserLocation: true)

// REQUIRED for iOS 17
@State private var position = MapCameraPosition.region(region)
Map(position: $position) { UserAnnotation() }
```

### Permission Gotchas
- **Silent failure**: If Info.plist keys missing, authorization requests fail with NO error message
- **All keys required**: Must include both `NSLocationWhenInUseUsageDescription` AND `NSLocationAlwaysAndWhenInUseUsageDescription`
- **Authorization state**: Check `CLLocationManager.authorizationStatus` before assuming location access

### MapCameraPosition State Management
- **Binding updates are two-way**: Map changes update your `@State` variable automatically
- **Position changes are animated by default**: No additional animation code needed
- **Fallback behavior**: `.userLocation(fallback: .automatic)` prevents crashes when location unavailable

### Map Content Builder Constraints
- Only types conforming to `MapContent` protocol allowed in closure
- `UserAnnotation()` doesn't take parameters (uses system location indicator)
- Multiple `UserAnnotation()` instances in same map cause undefined behavior

## Swift 6 Compatibility

### Sendable Conformance
```swift
// MapCameraPosition is Sendable
@MainActor
@State private var position: MapCameraPosition = .automatic

// CLLocationManager requires @MainActor in Swift 6
@MainActor
class LocationManager: NSObject, ObservableObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()
}
```

### Async/Await Location Updates
```swift
// Swift 6 async location updates
@MainActor
func getCurrentLocation() async throws -> CLLocation {
    let manager = CLLocationManager()
    return try await withCheckedThrowingContinuation { continuation in
        // Implementation with proper error handling
    }
}
```

## Version: iOS 17.0+
**Deployment Target**: iOS 17.0+ required for new Map APIs
**Xcode**: 15.0+ required for MapKit SwiftUI compilation
**Swift**: 5.9+ recommended for full feature support