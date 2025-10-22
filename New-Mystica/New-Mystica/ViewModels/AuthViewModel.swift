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

    init(appState: AppState, repository: AuthRepository = AuthRepositoryImpl()) {
        self.appState = appState
        self.repository = repository
    }

    func registerDevice() async {
        appState.isAuthenticating = true
        appState.authError = nil

        guard let deviceId = UIDevice.current.identifierForVendor?.uuidString else {
            appState.setAuthError(.noDeviceId)
            return
        }

        do {
            let (user, token) = try await repository.registerDevice(deviceId: deviceId)

            // Save to keychain
            try KeychainService.save(key: "mystica_access_token", value: token)
            try KeychainService.save(key: "mystica_device_id", value: deviceId)

            // Update AppState
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

        // For MVP0: Trust token existence = authenticated
        appState.accessToken = token
        appState.isAuthenticated = true
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
}
