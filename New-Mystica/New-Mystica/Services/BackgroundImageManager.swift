//
//  BackgroundImageManager.swift
//  New-Mystica
//
//  Created by Claude Code on 10/21/25.
//

import SwiftUI
import Combine

@MainActor
class BackgroundImageManager: ObservableObject {
    @Published private(set) var currentBackgroundURL: URL
    @Published var loadedImage: UIImage?
    @Published var isLoading: Bool = false

    private let backgroundImages: [String] = [
        "https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/backgrounds/desert-temple.png",
        "https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/backgrounds/post-apocalyptic-ruins.png",
        "https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/backgrounds/enchanted-forest.png",
        "https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/backgrounds/alien-planet.png",
        "https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/backgrounds/tokyo-night.png",
        "https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/backgrounds/haunted-mansion.png",
        "https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/backgrounds/steampunk-factory.png",
        "https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/backgrounds/cyberpunk-city.png",
        "https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/backgrounds/floating-islands.png",
        "https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/backgrounds/underwater-city.png"
    ]

    init() {
        // Select a random background image on initialization
        let randomURLString = backgroundImages.randomElement() ?? backgroundImages[0]
        self.currentBackgroundURL = URL(string: randomURLString)!
        print("🖼️ BackgroundImageManager: Selected background URL: \(randomURLString)")

        // Start loading the image asynchronously
        Task { @MainActor in
            await self.loadImage()
        }
    }

    /// Load the current background image
    func loadImage() async {
        isLoading = true
        print("🖼️ BackgroundImageManager: Starting image load from \(currentBackgroundURL)")

        do {
            let (data, response) = try await URLSession.shared.data(from: currentBackgroundURL)

            if let httpResponse = response as? HTTPURLResponse {
                print("🖼️ BackgroundImageManager: HTTP response status: \(httpResponse.statusCode)")
            }

            if let image = UIImage(data: data) {
                loadedImage = image
                isLoading = false
                print("✅ BackgroundImageManager: Image loaded successfully - size: \(image.size)")
            } else {
                isLoading = false
                print("❌ BackgroundImageManager: Failed to create UIImage from data")
            }
        } catch {
            isLoading = false
            print("❌ BackgroundImageManager: Failed to load image - \(error.localizedDescription)")
        }
    }

    /// Manually refresh the background with a new random selection
    func randomizeBackground() {
        let randomURLString = backgroundImages.randomElement() ?? backgroundImages[0]
        self.currentBackgroundURL = URL(string: randomURLString)!

        Task {
            await loadImage()
        }
    }
}
