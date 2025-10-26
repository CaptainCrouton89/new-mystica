import SwiftUI
import AVFoundation

struct AddItemCameraView: View {
    @EnvironmentObject private var navigationManager: NavigationManager
    @State private var showingImagePicker = false
    @State private var showingPermissionAlert = false

    var body: some View {
        MysticaBackground(.floatingOrbs) {
            VStack {
                Spacer()

                // Loading indicator while checking permissions
                if !showingImagePicker && !showingPermissionAlert {
                    ProgressView()
                        .scaleEffect(1.5)
                        .tint(.white)
                }

                Spacer()
            }
        }
        .navigationBarBackButtonHidden(false)
        .sheet(isPresented: $showingImagePicker) {
            ImagePicker { image in
                navigationManager.navigateTo(.addItemPreview(image: image))
            }
        }
        .alert("Camera Permission Required", isPresented: $showingPermissionAlert) {
            Button("Open Settings") {
                if let settingsURL = URL(string: UIApplication.openSettingsURLString) {
                    UIApplication.shared.open(settingsURL)
                }
            }
            Button("Cancel", role: .cancel) {
                navigationManager.navigateBack()
            }
        } message: {
            Text("Please enable camera access in Settings to take photos.")
        }
        .onAppear {
            checkCameraPermission()
        }
    }

    private func checkCameraPermission() {
        let status = AVCaptureDevice.authorizationStatus(for: .video)

        switch status {
        case .authorized:
            showingImagePicker = true
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { granted in
                DispatchQueue.main.async {
                    if granted {
                        showingImagePicker = true
                    } else {
                        showingPermissionAlert = true
                    }
                }
            }
        case .denied, .restricted:
            showingPermissionAlert = true
        @unknown default:
            showingPermissionAlert = true
        }
    }
}

struct ImagePicker: UIViewControllerRepresentable {
    let onImageSelected: (UIImage) -> Void
    @Environment(\.presentationMode) var presentationMode

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.delegate = context.coordinator
        picker.allowsEditing = false
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: ImagePicker

        init(_ parent: ImagePicker) {
            self.parent = parent
        }

        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey : Any]) {
            if let image = info[.originalImage] as? UIImage {
                parent.onImageSelected(image)
            }
            parent.presentationMode.wrappedValue.dismiss()
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.presentationMode.wrappedValue.dismiss()
        }
    }
}

#Preview {
    AddItemCameraView()
        .environmentObject(NavigationManager())
}
