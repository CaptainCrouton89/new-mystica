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
        // Create a stub user since we only have token in keychain
        // Note: In production, we'd fetch the user profile with the token
        let stubData = """
        {
            "id": "00000000-0000-0000-0000-000000000000",
            "account_type": "anonymous",
            "created_at": "\(ISO8601DateFormatter().string(from: Date()))"
        }
        """.data(using: .utf8)!

        let stubUser = try! JSONDecoder().decode(User.self, from: stubData)
        appState.setAuthenticated(stubUser, token: token)
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
