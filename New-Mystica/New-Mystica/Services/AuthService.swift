//
//  AuthService.swift
//  New-Mystica
//
//  Device-based anonymous authentication service
//  Handles device registration, session management, and logout
//

import Foundation
import SwiftUI
import Combine

enum AuthError: LocalizedError {
    case invalidResponse
    case serverError(Int)
    case networkError(Error)
    case noDeviceId

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "Invalid server response"
        case .serverError(let code):
            return "Server error: \(code)"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .noDeviceId:
            return "Could not get device ID"
        }
    }
}

@MainActor
class AuthService: ObservableObject {
    static let shared = AuthService()

    private let baseURL = "http://localhost:3000/api/v1"

    @Published var isAuthenticated: Bool = false
    @Published var currentUser: User? = nil

    private init() {}

    /// Register device with backend and establish session
    func registerDevice() async throws {
        guard let deviceId = UIDevice.current.identifierForVendor?.uuidString else {
            throw AuthError.noDeviceId
        }

        struct DeviceRegistrationRequest: Encodable {
            let device_id: String
        }

        struct DeviceRegistrationResponse: Decodable {
            let user: User
            let session: Session
            let message: String
        }

        struct Session: Decodable {
            let access_token: String
            let expires_in: Int
        }

        let requestBody = DeviceRegistrationRequest(device_id: deviceId)
        let response: DeviceRegistrationResponse = try await makeRequest(
            method: "POST",
            path: "/auth/register-device",
            body: requestBody
        )

        // Store tokens in keychain
        try KeychainService.save(key: "mystica_access_token", value: response.session.access_token)
        try KeychainService.save(key: "mystica_device_id", value: deviceId)

        self.currentUser = response.user
        self.isAuthenticated = true
    }

    /// Check keychain for existing session and restore authentication state
    func bootstrapSession() async -> Bool {
        guard KeychainService.get(key: "mystica_access_token") != nil else {
            return false
        }

        // For MVP0: Trust token existence = authenticated (no validation call)
        self.isAuthenticated = true
        return true
    }

    /// Logout user and clear all stored authentication data
    func logout() async throws {
        // Best effort logout call to backend
        struct LogoutResponse: Decodable {
            let success: Bool
        }

        do {
            let _: LogoutResponse = try await makeRequest(
                method: "POST",
                path: "/auth/logout",
                requiresAuth: true
            )
        } catch {
            // Ignore logout errors - clear local state anyway
        }

        KeychainService.clearAll()
        self.isAuthenticated = false
        self.currentUser = nil
    }

    // MARK: - Private Methods

    /// Generic HTTP request method with JSON encoding/decoding
    private func makeRequest<T: Decodable>(
        method: String,
        path: String,
        body: Encodable? = nil,
        requiresAuth: Bool = false
    ) async throws -> T {
        let url = URL(string: "\(baseURL)\(path)")!
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if requiresAuth, let token = KeychainService.get(key: "mystica_access_token") {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body = body {
            let encoder = JSONEncoder()
            encoder.keyEncodingStrategy = .convertToSnakeCase
            request.httpBody = try encoder.encode(body)
        }

        do {
            let (data, response) = try await URLSession.shared.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse else {
                throw AuthError.invalidResponse
            }

            guard (200...299).contains(httpResponse.statusCode) else {
                throw AuthError.serverError(httpResponse.statusCode)
            }

            let decoder = JSONDecoder()
            decoder.keyDecodingStrategy = .convertFromSnakeCase
            decoder.dateDecodingStrategy = .iso8601
            return try decoder.decode(T.self, from: data)
        } catch let error as AuthError {
            throw error
        } catch {
            throw AuthError.networkError(error)
        }
    }
}