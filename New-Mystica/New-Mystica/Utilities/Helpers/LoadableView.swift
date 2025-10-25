//
//  LoadableView.swift
//  New-Mystica
//
//  Generic SwiftUI component for rendering Loadable<T> states consistently
//

import SwiftUI

/// A reusable view component that handles all four Loadable<T> states with consistent styling
struct LoadableView<T, Content: View>: View {
    let loadable: Loadable<T>
    @ViewBuilder let content: (T) -> Content
    let retry: (() -> Void)?

    init(
        _ loadable: Loadable<T>,
        @ViewBuilder content: @escaping (T) -> Content,
        retry: (() -> Void)? = nil
    ) {
        self.loadable = loadable
        self.content = content
        self.retry = retry
    }

    var body: some View {
        switch loadable {
        case .idle:
            EmptyView()
                .onAppear {
                    print("🗺️ LoadableView: Showing idle state (EmptyView)")
                }

        case .loading:
            VStack(spacing: 16) {
                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle(tint: Color.accent))
                    .scaleEffect(1.2)

                NormalText("Loading...")
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color.backgroundPrimary)
            .onAppear {
                print("🗺️ LoadableView: Showing loading state")
            }

        case .loaded(let data):
            content(data)
                .onAppear {
                    print("🗺️ LoadableView: Showing loaded state with data")
                }

        case .error(let error):
            ErrorView(error: error, retry: retry)
                .onAppear {
                    print("🗺️ LoadableView: Showing error state: \(error)")
                }
        }
    }
}

/// Error view component that displays error information with optional retry button
private struct ErrorView: View {
    let error: AppError
    let retry: (() -> Void)?

    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 48, weight: .medium))
                .foregroundColor(Color.accent)

            VStack(spacing: 8) {
                TitleText("Something went wrong", size: 24)

                NormalText(error.localizedDescription)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 16)

                if let suggestion = error.recoverySuggestion {
                    SmallText(suggestion)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 16)
                }
            }

            if let retryAction = retry {
                TextButton("Try Again", height: 44) {
                    retryAction()
                }
                .frame(maxWidth: 200)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.backgroundPrimary)
        .padding(.horizontal, 32)
    }
}

// MARK: - Preview
#Preview {
    VStack(spacing: 40) {
        // Idle state
        LoadableView(Loadable<String>.idle) { value in
            NormalText("Content: \(value)")
        }
        .frame(height: 100)

        // Loading state
        LoadableView(Loadable<String>.loading) { value in
            NormalText("Content: \(value)")
        }
        .frame(height: 100)

        // Loaded state
        LoadableView(Loadable<String>.loaded("Test Data")) { value in
            NormalText("Content: \(value)")
        }
        .frame(height: 100)

        // Error state
        LoadableView(Loadable<String>.error(.networkError(URLError(.notConnectedToInternet)))) { value in
            NormalText("Content: \(value)")
        } retry: {
            print("Retry tapped")
        }
        .frame(height: 200)
    }
    .padding()
    .background(Color.backgroundPrimary)
}