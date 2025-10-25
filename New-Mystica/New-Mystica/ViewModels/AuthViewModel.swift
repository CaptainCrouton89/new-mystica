//
//  AuthViewModel.swift
//  New-Mystica
//
//  Orchestrates authentication flow between UI, AppState, and AuthRepository
//

import Foundation
import Observation
import UIKit

@Observable
final class AuthViewModel {
    let appState: AppState
    let repository: AuthRepository

    init(appState: AppState, repository: AuthRepository = DefaultAuthRepository()) {
        self.appState = appState
        self.repository = repository
    }

    func registerDevice() async {
        appState.setAuthenticating()

        // Use persistent device ID instead of identifierForVendor
        let deviceId = DeviceIdentifier.getDeviceId()

        do {
            let (user, token) = try await repository.registerDevice(deviceId: deviceId)

            // Save to keychain
            try KeychainService.save(key: "mystica_access_token", value: token)
            try KeychainService.save(key: "mystica_device_id", value: deviceId)

            appState.setAuthenticated(user, token: token)
        } catch let error as AppError {
            appState.setAuthError(error)
        } catch {
            appState.setAuthError(.unknown(error))
        }
    }

    func bootstrapSession() async {
        guard let token = KeychainService.get(key: "mystica_access_token") else {
            appState.setAuthError(.noAuthToken)
            return
        }

        appState.setAuthenticating()

        do {
            // Fetch the real user profile from /auth/me endpoint
            let user = try await repository.getCurrentUser(token: token)
            appState.setAuthenticated(user, token: token)
        } catch let error as AppError {
            // Token is invalid or expired - clear it and force re-registration
            print("❌ [AUTH] Bootstrap failed, clearing invalid token:", error.localizedDescription)
            KeychainService.clearAll()
            appState.setAuthError(error)
        } catch {
            print("❌ [AUTH] Bootstrap failed:", error.localizedDescription)
            KeychainService.clearAll()
            appState.setAuthError(.unknown(error))
        }
    }

    func logout() async {
        do {
            try await repository.logout()
        } catch {
            // Best-effort logout - clear state anyway
        }

        KeychainService.clearAll()
        appState.logout()
    }

    func deleteAccount() async {
        do {
            try await repository.deleteAccount()
        } catch {
            // Best-effort delete - clear state anyway
        }

        KeychainService.clearAll()
        appState.logout()
    }
}
