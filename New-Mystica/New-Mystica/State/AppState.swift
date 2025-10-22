//
//  AppState.swift
//  New-Mystica
//
//  Single source of truth for app-level state
//  Manages session, user profile, currency, and other global state
//

import Foundation
import Observation

@Observable
final class AppState {
    static let shared = AppState()

    // MARK: - Session State
    var isAuthenticated: Bool = false
    var currentUser: User? = nil
    var accessToken: String? = nil

    // MARK: - Profile State
    var profile: UserProfile? = nil

    // MARK: - Currency State
    var currencyBalance: Int = 0

    // MARK: - Loading States
    var isAuthenticating: Bool = false
    var authError: AppError? = nil

    private init() {}

    // MARK: - Public Methods

    func setAuthenticated(_ user: User, token: String) {
        self.currentUser = user
        self.accessToken = token
        self.isAuthenticated = true
        self.authError = nil
    }

    func logout() {
        self.currentUser = nil
        self.accessToken = nil
        self.isAuthenticated = false
        self.profile = nil
    }

    func setAuthError(_ error: AppError) {
        self.authError = error
        self.isAuthenticating = false
    }

    func setProfile(_ profile: UserProfile) {
        self.profile = profile
        self.currencyBalance = profile.currencyBalance
    }

    func updateCurrency(_ amount: Int) {
        self.currencyBalance = amount
    }
}
