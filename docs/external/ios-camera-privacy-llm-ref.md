# iOS Camera Privacy LLM Reference

## Critical Signatures

### AVCaptureDevice Authorization
```swift
// Check current authorization status
AVCaptureDevice.authorizationStatus(for: AVMediaType.video) -> AVAuthorizationStatus

// Request camera access (completion handler runs on background queue)
AVCaptureDevice.requestAccess(for: AVMediaType.video,
                             completionHandler: @escaping (Bool) -> Void)
```

### AVAuthorizationStatus Cases
```swift
enum AVAuthorizationStatus: Int {
    case notDetermined = 0    // Never asked user
    case restricted = 1       // Device policy prevents access
    case denied = 2          // User explicitly denied
    case authorized = 3      // User granted access
}
```

### Modern Async Pattern (iOS 15+)
```swift
// Async version available in iOS 15+
await AVCaptureDevice.requestAccess(for: .video) -> Bool
```

## Configuration Shapes

### Required Info.plist Keys
```xml
<!-- REQUIRED or app crashes on first camera access attempt -->
<key>NSCameraUsageDescription</key>
<string>Specific reason for camera access</string>

<!-- Optional but recommended for photo capture -->
<key>NSPhotoLibraryUsageDescription</key>
<string>Specific reason for photo library access</string>

<!-- Required if saving to photo library -->
<key>NSPhotoLibraryAddUsageDescription</key>
<string>Specific reason for saving photos</string>
```

### Photo Library Authorization (iOS 14+)
```swift
import Photos

PHPhotoLibrary.authorizationStatus(for: .readWrite) -> PHAuthorizationStatus
PHPhotoLibrary.requestAuthorization(for: .readWrite) { status in }

// Access levels: .addOnly, .readWrite
enum PHAccessLevel {
    case addOnly     // Can only add photos, not read existing
    case readWrite   // Full access to photo library
}
```

## Non-Obvious Behaviors

### Critical Permission Flow Issues

1. **requestAccess() completion handler runs on background queue**
   - MUST dispatch UI updates to main queue
   - Common source of crashes and UI freezing

2. **App crashes immediately if NSCameraUsageDescription missing**
   - No graceful fallback, instant termination
   - Happens on first AVCaptureDevice access attempt, not when requesting permission

3. **requestAccess() does nothing if status is .denied or .restricted**
   - Will not show system dialog again
   - Must direct users to Settings app manually

4. **Permission status can change while app is running**
   - User can revoke permissions in Settings
   - No automatic notification when this happens
   - Must check status before each camera operation

### iOS 17+ Photo Library Changes

5. **Limited photo access requires PHPickerViewController**
   - Direct PHPhotoLibrary access may return empty results
   - Users can select specific photos via system picker
   - Apps must handle "Add Photos Only" permission level

6. **Periodic permission reminders in iOS 17+**
   - System automatically prompts users to review full photo access
   - Can downgrade from .authorized to .limited without app notification

### TCC Database Reset Behavior

7. **Simulator permission reset**
   - `xcrun simctl privacy <device> reset all <bundle-id>`
   - Resets to .notDetermined state for testing

8. **Device settings navigation**
   - Direct deep link: `UIApplication.shared.open(URL(string: UIApplication.openSettingsURLString)!)`
   - Cannot deep link to specific permission (camera/photos)

### Modern Privacy Manifest Requirements (iOS 17+)

9. **Privacy manifest required for tracking APIs**
   - Must declare reason for accessing camera/photos in PrivacyInfo.xcprivacy
   - Required for App Store submission starting Spring 2024

10. **Background camera access restrictions**
    - Camera access automatically revoked when app enters background
    - Must re-check authorization when returning to foreground

### Photo Library Edge Cases

11. **"Add Photos Only" vs "Limited Photos" distinction**
    - .addOnly: Can save new photos but cannot read existing ones
    - .limited: Can read user-selected photos only
    - Different authorization flows and capabilities

12. **Photo library authorization levels are cumulative**
    - Must request highest required level upfront
    - Cannot upgrade from .addOnly to .readWrite without new user consent

## Version: iOS 17.0+ / Swift 5.9+

### Framework Requirements
```swift
import AVFoundation  // For camera permissions
import Photos        // For photo library permissions
import UIKit         // For Settings navigation
```

### Minimum Deployment Targets
- Camera access: iOS 4.0+
- Photo library authorization levels: iOS 14.0+
- Async requestAccess: iOS 15.0+
- Privacy manifests: iOS 17.0+