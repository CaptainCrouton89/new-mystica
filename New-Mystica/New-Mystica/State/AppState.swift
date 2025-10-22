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

    // MARK: - Auth Session State
    var authSession: Loadable<(user: User, token: String)> = .idle

    // MARK: - Profile State (loaded separately from auth)
    var userProfile: Loadable<EnhancedUserProfile> = .idle

    // MARK: - Currency Balances
    var currencies: Loadable<[CurrencyBalance]> = .idle

    init() {}

    // MARK: - Computed Properties

    var isAuthenticated: Bool {
        if case .loaded = authSession {
            return true
        }
        return false
    }

    var currentUser: User? {
        if case .loaded(let session) = authSession {
            return session.user
        }
        return nil
    }

    var accessToken: String? {
        if case .loaded(let session) = authSession {
            return session.token
        }
        return nil
    }

    // MARK: - Auth Methods

    func setAuthenticated(_ user: User, token: String) {
        self.authSession = .loaded((user: user, token: token))
    }

    func setAuthError(_ error: AppError) {
        self.authSession = .error(error)
    }

    func setAuthenticating() {
        self.authSession = .loading
    }

    func logout() {
        self.authSession = .idle
        self.userProfile = .idle
        self.currencies = .idle
    }

    // MARK: - Profile Methods

    func setProfile(_ profile: EnhancedUserProfile) {
        self.userProfile = .loaded(profile)
    }

    func setProfileError(_ error: AppError) {
        self.userProfile = .error(error)
    }

    func setProfileLoading() {
        self.userProfile = .loading
    }

    // MARK: - Currency Methods

    func setCurrencies(_ balances: [CurrencyBalance]) {
        self.currencies = .loaded(balances)
    }

    func setCurrencyError(_ error: AppError) {
        self.currencies = .error(error)
    }

    func setCurrencyLoading() {
        self.currencies = .loading
    }

    // Convenience method for getting specific currency balance
    func getCurrencyBalance(for code: CurrencyCode) -> Int {
        if case .loaded(let balances) = currencies {
            return balances.first { $0.currencyCode == code }?.balance ?? 0
        }
        return 0
    }

    // MARK: - Session Restoration

    /// Restore authentication session from stored token on app launch
    func restoreAuthSession() async {
        guard let token = KeychainService.getAccessToken() else {
            self.authSession = .idle
            return
        }

        self.authSession = .loading

        // For MVP0: Trust token existence = authenticated
        // Create a stub user since we only have token in keychain
        // Note: In production, we'd validate the token with the server
        let stubData = """
        {
            "id": "00000000-0000-0000-0000-000000000000",
            "account_type": "anonymous",
            "created_at": "\(ISO8601DateFormatter().string(from: Date()))"
        }
        """.data(using: .utf8)!

        do {
            let stubUser = try JSONDecoder().decode(User.self, from: stubData)
            self.authSession = .loaded((user: stubUser, token: token))
        } catch {
            // If decoding fails, clear the stored token and start fresh
            try? KeychainService.deleteAccessToken()
            self.authSession = .idle
        }
    }
}
