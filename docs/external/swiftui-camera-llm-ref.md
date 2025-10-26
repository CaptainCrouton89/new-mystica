# SwiftUI Camera Integration LLM Reference

## Critical Signatures & Configurations

### PHPickerViewController Integration

```swift
struct ImagePicker: UIViewControllerRepresentable {
    @Binding var selectedImage: UIImage?
    let configuration: PHPickerConfiguration

    func makeUIViewController(context: Context) -> PHPickerViewController {
        let picker = PHPickerViewController(configuration: configuration)
        picker.delegate = context.coordinator  // REQUIRED: Will crash without delegate
        return picker
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }
}

// Configuration constraints
var config = PHPickerConfiguration(photoLibrary: .shared())
config.selectionLimit = 1 // Default: 1, Max: 20, 0 = unlimited
config.filter = .images // Options: .images, .videos, .livePhotos, .any(of: [])
config.preferredAssetRepresentationMode = .current // vs .compatible
config.preselectedAssetIdentifiers = [] // Array of String identifiers
```

**Critical Gotchas:**
- No Info.plist permissions required (privacy advantage over UIImagePickerController)
- Results array is empty when user cancels (not nil)
- `itemProvider.loadObject()` executes on background thread - requires `DispatchQueue.main.async`
- Cannot detect selection limit reached programmatically in iOS 17+

### UIImagePickerController (Legacy Pattern)

```swift
// Required Info.plist keys - app WILL crash without these
NSCameraUsageDescription = "Descriptive reason for camera access"
NSPhotoLibraryUsageDescription = "Descriptive reason for photo library access"

// Source type constraints
sourceType: UIImagePickerController.SourceType
// .camera - requires physical device (simulator crashes)
// .photoLibrary - accesses all photos
// .savedPhotosAlbum - accesses only saved photos

// Media type constraints
mediaTypes = [UTType.image.identifier] // UTType.movie.identifier for video
allowsEditing = false // true enables square crop only
```

**Permission Pattern:**
```swift
import AVFoundation

func requestCameraPermission() {
    AVCaptureDevice.requestAccess(for: .video) { granted in
        DispatchQueue.main.async {
            // UI updates here
        }
    }
}
```

### AVFoundation Custom Camera Setup

```swift
// Critical session configuration pattern
session.beginConfiguration() // REQUIRED: Prevents intermediate invalid states
defer { session.commitConfiguration() } // ALWAYS pair with defer

// Input device constraints
let videoDevice = AVCaptureDevice.default(.builtInWideAngleCamera,
                                         for: .video,
                                         position: .back)
// .front, .back, .unspecified for position
// Device types: .builtInWideAngleCamera, .builtInUltraWideCamera, .builtInTelephotoCamera

// Session preset constraints
sessionPreset: AVCaptureSession.Preset
// .photo - optimized for photo capture
// .high - highest quality, device-dependent resolution
// .medium, .low - specific quality levels
// .hd1280x720, .hd1920x1080, .hd4K3840x2160 - explicit resolutions
```

**Preview Layer Configuration:**
```swift
class PreviewView: UIView {
    override class var layerClass: AnyClass {
        return AVCaptureVideoPreviewLayer.self // REQUIRED override
    }

    var videoPreviewLayer: AVCaptureVideoPreviewLayer {
        return layer as! AVCaptureVideoPreviewLayer
    }
}

// Video gravity constraints
videoGravity: AVLayerVideoGravity
// .resizeAspectFill - maintains aspect, may crop
// .resizeAspect - maintains aspect, may letterbox
// .resize - stretches to fill, distorts aspect
```

## iOS 18 Specific Features

### Zero Shutter Lag (iOS 17+)
```swift
// Automatically enabled for apps linking iOS 17+
// Opt out only if needed:
photoOutput.isZeroShutterLagEnabled = false

// Incompatible capture types (no ZSL):
// - Flash captures
// - Manual exposure captures
// - Bracketed captures
// - Constituent photo delivery
```

### Spatial Video Capture (iOS 18+)
```swift
// Check device support first
guard captureDevice.activeFormat.spatialVideoCaptureSupported else {
    return
}

movieFileOutput.spatialVideoCaptureEnabled = true
```

### Camera Control (iPhone 16+)
```swift
import AVFoundation

// Physical button integration
// AVCaptureControl - abstract base class for hardware controls
// Map volume buttons to camera actions programmatically
```

## Non-Obvious Behaviors

### PHPickerViewController
- Selection limit enforcement is client-side only - server validation required
- Multiple selection results arrive in user selection order (not chronological)
- `didFinishPicking` called even on cancellation (empty results array)
- Image loading failures are silent - check for nil in completion handler

### AVFoundation Session Management
- Session must be started on background queue to avoid blocking UI
- `beginConfiguration()/commitConfiguration()` calls can be nested
- Session automatically stops when app backgrounds unless background modes enabled
- Device rotation doesn't automatically update preview layer orientation

### Camera Permissions
- Permission state persists across app launches until user changes in Settings
- `AVCaptureDevice.authorizationStatus(for: .video)` returns immediately (no callback)
- Permission denied state requires manual Settings navigation
- iOS shows permission dialog only once per app lifetime

### Memory Management
- AVCaptureSession holds strong references to inputs/outputs until explicitly removed
- Preview layer must be removed from superview before session deallocation
- Image picker coordinator creates retain cycle if not properly structured
- Large image loading can trigger memory warnings in low-memory scenarios

## Version-Specific Constraints

**iOS 17+:**
- Zero Shutter Lag enabled by default
- PHPicker selection limit feedback removed
- Enhanced privacy controls for photo selection

**iOS 18+:**
- Spatial video capture APIs
- Camera Control hardware integration
- Deferred photo processing
- Video effects and reactions API

**Device Constraints:**
- Camera hardware varies by device model
- Spatial video requires specific camera configurations
- Zero Shutter Lag performance varies by device generation
- iPhone 16+ required for Camera Control features

## Version: iOS 18.0+ / SwiftUI 5.9+