//
//  AppState.swift
//  New-Mystica
//
//  Single source of truth for app-level state
//  Manages session, user profile, currency, and other global state
//

import Foundation
import Observation

// MARK: - Combat Metadata for Defeat Screen
/// Stores combat session data needed after session is deleted
struct CombatMetadata {
    let totalDamageDealt: Double
    let turnsSurvived: Int
    let highestMultiplier: Double
    let combatHistory: CombatHistory
    let enemy: CombatEnemy
}

@Observable
final class AppState {
    static let shared = AppState()

    // MARK: - Auth Session State
    var authSession: Loadable<(user: User, token: String)> = .idle

    // MARK: - Profile State (loaded separately from auth)
    var userProfile: Loadable<EnhancedUserProfile> = .idle

    // MARK: - Currency Balances
    var currencies: Loadable<[CurrencyBalance]> = .idle

    // MARK: - Combat Session State
    var activeCombatSession: Loadable<CombatSession?> = .idle

    // MARK: - Combat Rewards State
    var combatRewards: CombatRewards? = nil

    // MARK: - Combat Metadata (for defeat screen)
    var lastCombatMetadata: CombatMetadata? = nil

    // MARK: - User Preferences
    var isMusicEnabled: Bool {
        get {
            UserDefaults.standard.object(forKey: "isMusicEnabled") as? Bool ?? true
        }
        set {
            UserDefaults.standard.set(newValue, forKey: "isMusicEnabled")
        }
    }

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
        self.activeCombatSession = .idle
        self.combatRewards = nil
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
    // Returns nil if currencies not loaded or currency not found
    // Views should handle the nil case explicitly to avoid silent failures
    func getCurrencyBalance(for code: CurrencyCode) -> Int? {
        guard case .loaded(let balances) = currencies else {
            return nil
        }

        return balances.first(where: { $0.currencyCode == code })?.balance
    }

    // MARK: - Combat Session Methods

    func setCombatSession(_ session: CombatSession?) {
        self.activeCombatSession = .loaded(session)
    }

    func setCombatSessionError(_ error: AppError) {
        self.activeCombatSession = .error(error)
    }

    func setCombatSessionLoading() {
        self.activeCombatSession = .loading
    }

    func clearCombatSession() {
        self.activeCombatSession = .idle
    }

    // MARK: - Combat Rewards Methods

    func setCombatRewards(_ rewards: CombatRewards?) {
        self.combatRewards = rewards
    }

    func clearCombatRewards() {
        self.combatRewards = nil
    }

    // MARK: - Combat Metadata Methods

    func setLastCombatMetadata(_ metadata: CombatMetadata?) {
        self.lastCombatMetadata = metadata
    }

    func clearLastCombatMetadata() {
        self.lastCombatMetadata = nil
    }

    // MARK: - Session Restoration

    /// Restore authentication session from stored token on app launch
    func restoreAuthSession() async {
        guard let token = KeychainService.getAccessToken() else {
            self.authSession = .idle
            return
        }

        self.authSession = .loading

        do {
            // Decode JWT to extract user ID and device_id
            // JWT format: header.payload.signature
            // Payload is base64-encoded JSON with: {sub: user_id, device_id: device_id, ...}
            let parts = token.split(separator: ".")
            guard parts.count == 3 else {
                throw AppError.invalidData("Invalid JWT format: expected 3 parts, got \(parts.count)")
            }

            let payloadBase64 = String(parts[1])
            // Add padding if needed for base64 decoding
            let paddedPayload = payloadBase64.padding(toLength: ((payloadBase64.count + 3) / 4) * 4, withPad: "=", startingAt: 0)

            guard let payloadData = Data(base64Encoded: paddedPayload) else {
                throw AppError.invalidData("Failed to decode JWT payload from base64")
            }

            guard let payloadJSON = try JSONSerialization.jsonObject(with: payloadData) as? [String: Any] else {
                throw AppError.invalidData("JWT payload is not valid JSON")
            }

            guard let userId = payloadJSON["sub"] as? String else {
                throw AppError.invalidData("Missing 'sub' (user ID) claim in JWT")
            }

            guard UUID(uuidString: userId) != nil else {
                throw AppError.invalidData("Invalid user ID format in JWT: '\(userId)' is not a valid UUID")
            }

            // Extract optional fields from JWT
            let deviceId = payloadJSON["device_id"] as? String
            guard let accountType = payloadJSON["account_type"] as? String else {
                throw AppError.invalidData("Missing account_type in JWT payload: \(payloadJSON)")
            }

            // Create user from JWT claims
            let deviceIdString = deviceId.map { "\"\($0)\"" } ?? "null"

            let stubDataString = """
            {
                "id": "\(userId)",
                "device_id": \(deviceIdString),
                "account_type": "\(accountType)",
                "created_at": "\(ISO8601DateFormatter().string(from: Date()))"
            }
            """

            guard let stubData = stubDataString.data(using: .utf8) else {
                throw AppError.invalidData("Failed to encode user stub data as UTF-8")
            }

            let user = try JSONDecoder().decode(User.self, from: stubData)
            self.authSession = .loaded((user: user, token: token))
        } catch {
            print("❌ [AppState] Session restoration failed: \(error)")
            print("❌ [AppState] Clearing invalid token and requiring re-authentication")

            // Clear invalid token
            try? KeychainService.deleteAccessToken()

            // Set error state so UI can show what went wrong
            let appError: AppError
if let typedError = error as? AppError {
                appError = typedError
            } else {
                appError = AppError.invalidData("Session restoration failed: \(error.localizedDescription)")
            }
            self.authSession = .error(appError)
        }
    }

    /// Check for active combat session and restore state
    func checkActiveCombatSession(repository: CombatRepository) async {
        self.activeCombatSession = .loading

        do {
            let session = try await repository.getUserActiveSession()
            self.activeCombatSession = .loaded(session)
        } catch {
            let appError = AppError.fromError(error)

            // Handle session not found or expired as normal case (nil session)
            // Only propagate actual errors (network issues, server errors, etc.)
            if case .notFound = appError {
                // No active session is a normal state - just mark as loaded with nil
                self.activeCombatSession = .loaded(nil)
            } else if case .serverError(404, _) = appError {
                // 404 from server also means no active session
                self.activeCombatSession = .loaded(nil)
            } else {
                // Real errors (network, server 500, etc.) should be propagated
                self.activeCombatSession = .error(appError)
            }
        }
    }
}
