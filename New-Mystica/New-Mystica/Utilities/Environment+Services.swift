//
//  Environment+Services.swift
//  New-Mystica
//
//  Environment key definitions for service dependency injection
//

import SwiftUI

// MARK: - Navigation Manager Key
private struct NavigationManagerKey: EnvironmentKey {
    static let defaultValue: NavigationManager = NavigationManager()
}

// MARK: - Audio Manager Key
private struct AudioManagerKey: EnvironmentKey {
    static let defaultValue: AudioManager = AudioManager.shared
}

// MARK: - Background Image Manager Key
private struct BackgroundImageManagerKey: EnvironmentKey {
    static let defaultValue: BackgroundImageManager = BackgroundImageManager()
}

// MARK: - Profile Controller Key
private struct ProfileControllerKey: EnvironmentKey {
    static let defaultValue: ProfileController = ProfileController()
}

// MARK: - EnvironmentValues Extension
extension EnvironmentValues {
    var navigationManager: NavigationManager {
        get { self[NavigationManagerKey.self] }
        set { self[NavigationManagerKey.self] = newValue }
    }

    var audioManager: AudioManager {
        get { self[AudioManagerKey.self] }
        set { self[AudioManagerKey.self] = newValue }
    }

    var backgroundImageManager: BackgroundImageManager {
        get { self[BackgroundImageManagerKey.self] }
        set { self[BackgroundImageManagerKey.self] = newValue }
    }

    var profileController: ProfileController {
        get { self[ProfileControllerKey.self] }
        set { self[ProfileControllerKey.self] = newValue }
    }
}