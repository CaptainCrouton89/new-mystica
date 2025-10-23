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
        guard let url = URL(string: randomURLString) else {
            // Fallback to first background image if random selection fails
            self.currentBackgroundURL = URL(string: backgroundImages[0]) ?? URL(string: "https://via.placeholder.com/800x600")!
            return
        }
        self.currentBackgroundURL = url

        // Start loading the image asynchronously
        Task { @MainActor in
            await self.loadImage()
        }
    }

    /// Load the current background image
    func loadImage() async {
        isLoading = true

        do {
            let (data, _) = try await URLSession.shared.data(from: currentBackgroundURL)

            if let image = UIImage(data: data) {
                loadedImage = image
                isLoading = false
            } else {
                isLoading = false
            }
        } catch {
            isLoading = false
        }
    }

    /// Manually refresh the background with a new random selection
    func randomizeBackground() {
        let randomURLString = backgroundImages.randomElement() ?? backgroundImages[0]
        guard let url = URL(string: randomURLString) else {
            // Fallback to first background image if random selection fails
            self.currentBackgroundURL = URL(string: backgroundImages[0]) ?? URL(string: "https://via.placeholder.com/800x600")!
            return
        }
        self.currentBackgroundURL = url

        Task {
            await loadImage()
        }
    }
}
