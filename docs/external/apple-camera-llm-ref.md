# Apple Camera APIs LLM Reference

## Critical Signatures

### UIImagePickerController

```swift
// GOTCHA: Live Photo capture silently removed after iOS 10, no deprecation notice
var allowsEditing: Bool // Default: false
var cameraDevice: UIImagePickerController.CameraDevice // .rear, .front
var showsCameraControls: Bool // Default: true - set false for custom overlay
var cameraOverlayView: UIView? // Custom UI over camera
var cameraViewTransform: CGAffineTransform // Transform camera preview

// Delegate method signatures - MUST implement both protocols
func imagePickerController(_ picker: UIImagePickerController,
                          didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey : Any])
func imagePickerControllerDidCancel(_ picker: UIImagePickerController)

// InfoKey dictionary keys
UIImagePickerController.InfoKey.originalImage // UIImage - unedited
UIImagePickerController.InfoKey.editedImage   // UIImage - if allowsEditing = true
UIImagePickerController.InfoKey.mediaMetadata // [String: Any] - EXIF data
UIImagePickerController.InfoKey.imageURL      // URL - file location if saved
```

### PHPickerViewController (iOS 14+)

```swift
import PhotosUI

// Configuration MUST be set before initialization
var configuration = PHPickerConfiguration()
configuration.selectionLimit = 0 // 0 = unlimited, default = 1
configuration.filter = PHPickerFilter.images // .videos, .livePhotos, .any(of: [])

// CRITICAL: No camera access - photo library only
// CRITICAL: No privacy permissions required - runs in separate process
let picker = PHPickerViewController(configuration: configuration)
picker.delegate = self // Must implement PHPickerViewControllerDelegate

// Single delegate method for all results
func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
    // results.count respects selectionLimit
    // Use NSItemProvider to load actual data
    result.itemProvider.loadObject(ofClass: UIImage.self) { (object, error) in
        // Always dispatch UI updates to main queue
    }
}
```

### AVFoundation Camera Capture

```swift
import AVFoundation

// Permission check - REQUIRED before camera access
AVCaptureDevice.authorizationStatus(for: .video) // .authorized, .denied, .notDetermined, .restricted
AVCaptureDevice.requestAccess(for: .video) { granted in
    // Completion on background queue - dispatch to main for UI
}

// Session configuration - MUST be on background queue
let captureSession = AVCaptureSession()
captureSession.sessionPreset = AVCaptureSession.Preset.photo // .high, .medium, .low

// Device configuration
guard let device = AVCaptureDevice.default(.builtInWideAngleCamera,
                                           for: .video,
                                           position: .back) else { return }
let input = try AVCaptureDeviceInput(device: device)
captureSession.addInput(input)

// Photo output configuration
let photoOutput = AVCapturePhotoOutput()
photoOutput.isHighResolutionCaptureEnabled = true // Default: false
photoOutput.isLivePhotoCaptureEnabled = photoOutput.isLivePhotoCaptureSupported
captureSession.addOutput(photoOutput)

// Capture photo - settings required
let settings = AVCapturePhotoSettings()
settings.isHighResolutionPhotoEnabled = true
settings.flashMode = .auto // .on, .off, .auto
photoOutput.capturePhoto(with: settings, delegate: self)

// Delegate method - delivers on arbitrary queue
func photoOutput(_ output: AVCapturePhotoOutput,
                didFinishProcessingPhoto photo: AVCapturePhoto,
                error: Error?) {
    guard let imageData = photo.fileDataRepresentation() else { return }
    let image = UIImage(data: imageData)
}
```

## Configuration Shapes

### Info.plist Privacy Keys (REQUIRED)

```xml
<!-- Camera access - MANDATORY for UIImagePickerController.sourceType = .camera -->
<key>NSCameraUsageDescription</key>
<string>Specific reason why camera is needed</string>

<!-- Microphone - REQUIRED for video recording with audio -->
<key>NSMicrophoneUsageDescription</key>
<string>Specific reason why microphone is needed</string>

<!-- Photo Library - REQUIRED for UIImagePickerController.sourceType = .photoLibrary -->
<key>NSPhotoLibraryUsageDescription</key>
<string>Specific reason why photo library access is needed</string>

<!-- NOT required for PHPickerViewController -->
```

### SwiftUI Integration Pattern

```swift
struct ImagePicker: UIViewControllerRepresentable {
    @Environment(\.presentationMode) var presentationMode
    @Binding var image: UIImage?
    var sourceType: UIImagePickerController.SourceType

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    // CRITICAL: Coordinator must inherit NSObject and implement both delegates
    class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: ImagePicker

        init(_ parent: ImagePicker) {
            self.parent = parent
        }

        func imagePickerController(_ picker: UIImagePickerController,
                                  didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey : Any]) {
            // Handle image selection
            parent.presentationMode.wrappedValue.dismiss()
        }
    }
}
```

## Non-Obvious Behaviors

### UIImagePickerController Limitations
- **Live Photo support**: Silently removed after iOS 10, no deprecation warning
- **Camera vs Library**: Different Info.plist keys required for each source type
- **Memory management**: Large images not automatically compressed - app responsibility
- **Thread safety**: Delegate methods called on main queue
- **Presentation**: Must be presented modally, not in navigation stack

### PHPickerViewController Advantages
- **No permissions**: Runs in separate process, no NSPhotoLibraryUsageDescription needed
- **Multi-selection**: Maintains order through PHPickerResult array
- **Privacy**: Only selected items accessible to app
- **Limitation**: Photo library only - no camera capture capability
- **iOS version**: Requires iOS 14+, fallback to UIImagePickerController needed

### AVFoundation Critical Details
- **Session lifecycle**: Start/stop on background queue to avoid UI blocking
- **Authorization timing**: Check before session configuration, not just before capture
- **Photo output**: Delivers data on arbitrary queue - always dispatch UI updates
- **Device locking**: Must handle device unavailable during active session
- **Interruption handling**: Audio session interruptions affect video recording
- **Memory pressure**: Large captures can cause memory warnings - implement cleanup

### Camera Permission Edge Cases
- **First launch**: Permission dialog only shows once - subsequent denials require Settings app
- **Simulator limitation**: Camera not available - test on device only
- **Background capture**: Not allowed - app must be foreground
- **Multiple apps**: Camera hardware exclusive - handle unavailable device gracefully

## Version: iOS 17+ (2024)

### Deprecated Patterns
- `UIImagePickerController` for photo library access (use `PHPickerViewController`)
- Manual camera overlay management (use Camera Control API on supported devices)

### Modern Alternatives
- Camera Control API for iPhone 16+ devices
- PhotosPicker SwiftUI view (iOS 16+) instead of UIViewControllerRepresentable wrapper