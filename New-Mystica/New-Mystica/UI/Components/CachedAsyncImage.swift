//
//  CachedAsyncImage.swift
//  New-Mystica
//
//  Drop-in replacement for AsyncImage with aggressive caching
//  Uses ImageCacheManager's URLSession for cache-first loading
//

import SwiftUI

/// Cached version of AsyncImage that uses ImageCacheManager for aggressive caching
struct CachedAsyncImage<Content, Placeholder>: View where Content: View, Placeholder: View {
    let url: URL?
    let content: (Image) -> Content
    let placeholder: () -> Placeholder

    @State private var phase: AsyncImagePhase = .empty

    var body: some View {
        Group {
            switch phase {
            case .empty:
                placeholder()
                    .onAppear {
                        loadImage()
                    }
            case .success(let image):
                content(image)
            case .failure:
                placeholder()
            @unknown default:
                placeholder()
            }
        }
    }

    private func loadImage() {
        guard let url = url else {
            phase = .failure(URLError(.badURL))
            return
        }

        Task {
            do {
                let (data, _) = try await ImageCacheManager.shared.urlSession.data(from: url)

                #if os(macOS)
                guard let nsImage = NSImage(data: data) else {
                    throw URLError(.cannotDecodeContentData)
                }
                let image = Image(nsImage: nsImage)
                #else
                guard let uiImage = UIImage(data: data) else {
                    throw URLError(.cannotDecodeContentData)
                }
                let image = Image(uiImage: uiImage)
                #endif

                await MainActor.run {
                    phase = .success(image)
                }
            } catch {
                await MainActor.run {
                    phase = .failure(error)
                }
            }
        }
    }
}

// MARK: - Convenience Initializers

extension CachedAsyncImage where Content == Image, Placeholder == ProgressView<EmptyView, EmptyView> {
    /// Creates a cached async image with a default progress view placeholder
    init(url: URL?) {
        self.url = url
        self.content = { $0 }
        self.placeholder = { ProgressView() }
    }
}

extension CachedAsyncImage where Placeholder == EmptyView {
    /// Creates a cached async image with custom content and no placeholder
    init(url: URL?, @ViewBuilder content: @escaping (Image) -> Content) {
        self.url = url
        self.content = content
        self.placeholder = { EmptyView() }
    }
}

extension CachedAsyncImage {
    /// Creates a cached async image with custom content and placeholder using phase
    init(url: URL?, @ViewBuilder content: @escaping (AsyncImagePhase) -> Content) where Placeholder == Never {
        fatalError("Use the standard initializer with separate content and placeholder closures")
    }
}

// MARK: - AsyncImagePhase enum (mirrors SwiftUI's version)

enum AsyncImagePhase {
    case empty
    case success(Image)
    case failure(Error)
}
