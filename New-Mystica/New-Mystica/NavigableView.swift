//
//  NavigableView.swift
//  New-Mystica
//
//  Created by AI Assistant on 10/19/25.
//

import SwiftUI

// MARK: - NavigableView Protocol
protocol NavigableView: View {
    var navigationTitle: String { get }
    var showBackButton: Bool { get }
    var customBackAction: (() -> Void)? { get }
}

// MARK: - Default Implementation
extension NavigableView {
    var showBackButton: Bool { true }
    var customBackAction: (() -> Void)? { nil }
}

// MARK: - BaseView Wrapper
struct BaseView<Content: View>: View {
    @EnvironmentObject private var navigationManager: NavigationManager
    let content: Content
    let navigationTitle: String
    let showBackButton: Bool
    let customBackAction: (() -> Void)?
    
    init(
        title: String,
        showBackButton: Bool = true,
        customBackAction: (() -> Void)? = nil,
        @ViewBuilder content: () -> Content
    ) {
        self.content = content()
        self.navigationTitle = title
        self.showBackButton = showBackButton
        self.customBackAction = customBackAction
    }
    
    var body: some View {
        ZStack {
            // Background
            Color.mysticaDarkBrown
                .ignoresSafeArea()
            
            VStack(spacing: 0) {
                // Header with Back Button (if needed)
                if showBackButton {
                    headerView
                }
                
                // Content
                content
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .navigationBarHidden(true)
    }
    
    @ViewBuilder
    private var headerView: some View {
        HStack {
            BackButton {
                if let customAction = customBackAction {
                    customAction()
                } else {
                    navigationManager.navigateBack()
                }
            }
            .padding(.top, 16)
            .padding(.leading, 16)
            
            Spacer()
            
            TitleText(navigationTitle, size: 24)
                .padding(.top, 16)
                .padding(.trailing, 60) // Offset for back button
            
            Spacer()
        }
    }
}

// MARK: - Simple Navigable View
struct SimpleNavigableView<Content: View>: View, NavigableView {
    @EnvironmentObject private var navigationManager: NavigationManager
    
    let navigationTitle: String
    let showBackButton: Bool
    let customBackAction: (() -> Void)?
    let content: () -> Content
    
    init(
        title: String,
        showBackButton: Bool = true,
        customBackAction: (() -> Void)? = nil,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.navigationTitle = title
        self.showBackButton = showBackButton
        self.customBackAction = customBackAction
        self.content = content
    }
    
    var body: some View {
        BaseView(title: navigationTitle, showBackButton: showBackButton, customBackAction: customBackAction) {
            content()
        }
    }
}

// MARK: - Navigation Helper Extensions
extension View {
    /// Wrap any view with automatic navigation support
    func withNavigation(
        title: String,
        showBackButton: Bool = true,
        customBackAction: (() -> Void)? = nil
    ) -> some View {
        SimpleNavigableView(
            title: title,
            showBackButton: showBackButton,
            customBackAction: customBackAction
        ) {
            self
        }
    }
    
    /// Add a back button to any view
    func withBackButton(customAction: (() -> Void)? = nil) -> some View {
        self.modifier(BackButtonModifier(customAction: customAction))
    }
}

// MARK: - Back Button Modifier
struct BackButtonModifier: ViewModifier {
    @EnvironmentObject private var navigationManager: NavigationManager
    let customAction: (() -> Void)?
    
    func body(content: Content) -> some View {
        ZStack {
            content
            
            VStack {
                HStack {
                    BackButton {
                        if let customAction = customAction {
                            customAction()
                        } else {
                            navigationManager.navigateBack()
                        }
                    }
                    .padding(.top, 16)
                    .padding(.leading, 16)
                    
                    Spacer()
                }
                Spacer()
            }
        }
    }
}

// MARK: - Navigation Utilities
extension NavigationManager {
    /// Navigate to a view with automatic back button support
    func navigateToView<Content: View>(
        _ destination: NavigationDestination,
        title: String,
        @ViewBuilder content: @escaping () -> Content
    ) {
        navigateTo(destination)
    }
    
    /// Create a navigable view for any content
    func createNavigableView<Content: View>(
        title: String,
        showBackButton: Bool = true,
        @ViewBuilder content: @escaping () -> Content
    ) -> some View {
        SimpleNavigableView(
            title: title,
            showBackButton: showBackButton
        ) {
            content()
        }
    }
}
