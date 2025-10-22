//
//  ProfileController.swift
//  New-Mystica
//
//  Centralized loader/orchestrator for profile and currency state
//  Routes all profile/currency loads through single service that updates AppState
//

import Foundation
import Observation

@Observable
final class ProfileController {
    private let repository: ProfileRepository
    private let appState: AppState

    init(
        repository: ProfileRepository = DefaultProfileRepository(),
        appState: AppState = AppState.shared
    ) {
        self.repository = repository
        self.appState = appState
    }

    // MARK: - Main Loading Methods

    /// Load profile and currencies together
    /// Primary method for loading all profile-related state
    func loadProfileAndCurrencies() async {
        appState.setProfileLoading()
        appState.setCurrencyLoading()

        do {
            // Load profile first
            let profile = try await repository.fetchProfile()
            appState.setProfile(profile)

            // Then load currencies
            do {
                let currencies = try await repository.fetchCurrencyBalance()
                appState.setCurrencies(currencies)
            } catch let currencyError {
                // Profile loaded successfully, but currencies failed
                // Set currency error without affecting profile state
                let appError = AppError.from(currencyError)
                appState.setCurrencyError(appError)
                print("⚠️ [PROFILE-CONTROLLER] Currency load failed but profile succeeded: \(appError.localizedDescription)")
            }

        } catch let profileError {
            // Profile loading failed - set error for profile
            let appError = AppError.from(profileError)
            appState.setProfileError(appError)

            // Also try to load currencies independently if profile fails
            do {
                let currencies = try await repository.fetchCurrencyBalance()
                appState.setCurrencies(currencies)
            } catch {
                // Both failed - currency error already logged above or will be handled separately
                let currencyAppError = AppError.from(error)
                appState.setCurrencyError(currencyAppError)
                print("⚠️ [PROFILE-CONTROLLER] Both profile and currency load failed")
            }
        }
    }

    /// Load only profile data
    /// Use when you only need profile without currency refresh
    func loadProfile() async {
        appState.setProfileLoading()

        do {
            let profile = try await repository.fetchProfile()
            appState.setProfile(profile)
        } catch let error {
            let appError = AppError.from(error)
            appState.setProfileError(appError)
        }
    }

    /// Load only currency data
    /// Use when you only need currency refresh without profile
    func loadCurrencies() async {
        appState.setCurrencyLoading()

        do {
            let currencies = try await repository.fetchCurrencyBalance()
            appState.setCurrencies(currencies)
        } catch let error {
            let appError = AppError.from(error)
            appState.setCurrencyError(appError)
        }
    }

    // MARK: - Convenience Methods

    /// Refresh both profile and currencies
    /// Alias for loadProfileAndCurrencies() for better semantic clarity
    func refresh() async {
        await loadProfileAndCurrencies()
    }

    /// Update profile username and refresh profile data
    /// - Parameter username: New username to set
    func updateProfile(username: String) async throws {
        appState.setProfileLoading()

        do {
            let updatedProfile = try await repository.updateProfile(username: username)
            appState.setProfile(updatedProfile)
        } catch let error {
            let appError = AppError.from(error)
            appState.setProfileError(appError)
            throw error
        }
    }

    /// Initialize new player profile after registration
    /// Used during onboarding flow
    func initializeProfile() async throws {
        appState.setProfileLoading()

        do {
            let profile = try await repository.initializeProfile()
            appState.setProfile(profile)
        } catch let error {
            let appError = AppError.from(error)
            appState.setProfileError(appError)
            throw error
        }
    }

    // MARK: - State Access

    /// Quick access to current profile state from AppState
    var profileState: Loadable<EnhancedUserProfile> {
        appState.userProfile
    }

    /// Quick access to current currency state from AppState
    var currencyState: Loadable<[CurrencyBalance]> {
        appState.currencies
    }

    /// Check if profile data is currently loading
    var isLoading: Bool {
        if case .loading = appState.userProfile {
            return true
        }
        if case .loading = appState.currencies {
            return true
        }
        return false
    }

    /// Check if any profile/currency operations have errors
    var hasError: Bool {
        if case .error = appState.userProfile {
            return true
        }
        if case .error = appState.currencies {
            return true
        }
        return false
    }
}