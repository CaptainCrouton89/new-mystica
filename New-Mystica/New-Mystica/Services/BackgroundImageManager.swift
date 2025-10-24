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

    private let backgroundImages: [String] = Config.backgroundImageURLs

    init() {
        guard let randomURLString = backgroundImages.randomElement(),
              let url = URL(string: randomURLString) else {
            fatalError("BackgroundImageManager: Invalid background image URLs in Config. All URLs must be valid.")
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
        guard let randomURLString = backgroundImages.randomElement(),
              let url = URL(string: randomURLString) else {
            fatalError("BackgroundImageManager: Invalid background image URLs in Config. All URLs must be valid.")
        }
        self.currentBackgroundURL = url

        Task {
            await loadImage()
        }
    }
}
