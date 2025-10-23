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
        let randomURLString = backgroundImages.randomElement() ?? backgroundImages[0]
        guard let url = URL(string: randomURLString) else {
            self.currentBackgroundURL = URL(string: backgroundImages[0]) ?? URL(string: "https://via.placeholder.com/800x600")!
            return
        }
        self.currentBackgroundURL = url

        Task { @MainActor in
            await self.loadImage()
        }
    }

    func loadImage() async {
        isLoading = true

        do {
            let (data, _) = try await URLSession.shared.data(from: currentBackgroundURL)

            if let image = UIImage(data: data) {
                loadedImage = image
                isLoading = false
            } else {
                isLoading = false
                print("⚠️ [BackgroundImageManager] Image data corruption for URL: \(currentBackgroundURL)")
                print("⚠️ [BackgroundImageManager] Failed to create UIImage from data for \(currentBackgroundURL)")
            }
        } catch {
            isLoading = false
            print("❌ [BackgroundImageManager] Loading error: \(error.localizedDescription)")
            print("⚠️ [BackgroundImageManager] Failed to load background image from \(currentBackgroundURL): \(error.localizedDescription)")
        }
    }

    func randomizeBackground() {
        let randomURLString = backgroundImages.randomElement() ?? backgroundImages[0]
        guard let url = URL(string: randomURLString) else {
            self.currentBackgroundURL = URL(string: backgroundImages[0]) ?? URL(string: "https://via.placeholder.com/800x600")!
            return
        }
        self.currentBackgroundURL = url

        Task {
            await loadImage()
        }
    }
}
