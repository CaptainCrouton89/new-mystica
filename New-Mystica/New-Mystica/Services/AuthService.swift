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

    private let baseURL = APIConfig.baseURL

    @Published var isAuthenticated: Bool = false
    @Published var currentUser: User? = nil

    private init() {}

    /// Register device with backend and establish session
    func registerDevice() async throws {
        print("🔐 [AUTH] Registering device...")
        guard let deviceId = UIDevice.current.identifierForVendor?.uuidString else {
            print("❌ [AUTH] Could not get device ID")
            throw AuthError.noDeviceId
        }

        print("📱 [AUTH] Device ID:", deviceId)

        struct DeviceRegistrationRequest: Encodable {
            let device_id: String
        }

        struct DeviceRegistrationResponse: Decodable {
            let user: User
            let session: Session
            let message: String

            enum CodingKeys: String, CodingKey {
                case user
                case session
                case message
            }
        }

        struct Session: Decodable {
            let access_token: String
            let expires_in: Int

            enum CodingKeys: String, CodingKey {
                case access_token
                case expires_in
            }
        }

        let requestBody = DeviceRegistrationRequest(device_id: deviceId)
        print("📡 [AUTH] Sending device registration request...")
        let response: DeviceRegistrationResponse = try await makeRequest(
            method: "POST",
            path: "/auth/register-device",
            body: requestBody
        )

        print("✅ [AUTH] Device registered successfully")
        print("🔑 [AUTH] Received token (first 30 chars):", String(response.session.access_token.prefix(30))+"...")

        // Store tokens in keychain
        print("💾 [AUTH] Attempting to save token to keychain...")
        do {
            try KeychainService.save(key: "mystica_access_token", value: response.session.access_token)
            print("✅ [AUTH] Token saved successfully")
        } catch {
            print("❌ [AUTH] Failed to save token:", error.localizedDescription)
            throw error
        }

        do {
            try KeychainService.save(key: "mystica_device_id", value: deviceId)
            print("✅ [AUTH] Device ID saved successfully")
        } catch {
            print("❌ [AUTH] Failed to save device ID:", error.localizedDescription)
            throw error
        }

        print("💾 [AUTH] All credentials saved to keychain")

        self.currentUser = response.user
        self.isAuthenticated = true
    }

    /// Check keychain for existing session and restore authentication state
    func bootstrapSession() async throws {
        print("🔄 [AUTH] Bootstrapping session from keychain...")
        guard let token = KeychainService.get(key: "mystica_access_token") else {
            print("❌ [AUTH] No token found in keychain")
            throw AuthError.noDeviceId  // Reuse error enum, or create new one
        }

        print("✅ [AUTH] Found existing token in keychain (first 30 chars):", String(token.prefix(30))+"...")

        // For MVP0: Trust token existence = authenticated (no validation call)
        self.isAuthenticated = true
        print("✅ [AUTH] Session bootstrapped successfully")
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

        print("📡 [AUTH-HTTP] Request:", method, url.absoluteString)

        if requiresAuth, let token = KeychainService.get(key: "mystica_access_token") {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            print("🔑 [AUTH-HTTP] Added Bearer token")
        }

        if let body = body {
            let encoder = JSONEncoder()
            encoder.keyEncodingStrategy = .convertToSnakeCase
            request.httpBody = try encoder.encode(body)
            if let bodyString = String(data: request.httpBody!, encoding: .utf8) {
                print("📤 [AUTH-HTTP] Request body:", bodyString)
            }
        }

        do {
            print("⏳ [AUTH-HTTP] Sending request...")
            let (data, response) = try await URLSession.shared.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse else {
                print("❌ [AUTH-HTTP] Invalid response type")
                throw AuthError.invalidResponse
            }

            print("📥 [AUTH-HTTP] Response status:", httpResponse.statusCode)

            if let responseString = String(data: data, encoding: .utf8) {
                print("📥 [AUTH-HTTP] Response body:", responseString)
            }

            guard (200...299).contains(httpResponse.statusCode) else {
                print("❌ [AUTH-HTTP] Server error:", httpResponse.statusCode)
                throw AuthError.serverError(httpResponse.statusCode)
            }

            let decoder = JSONDecoder()
            // Don't use automatic snake_case conversion - our models handle it manually
            // decoder.keyDecodingStrategy = .convertFromSnakeCase
            decoder.dateDecodingStrategy = .iso8601

            print("🔍 [AUTH-HTTP] Attempting to decode response as", String(describing: T.self))
            do {
                let decoded = try decoder.decode(T.self, from: data)
                print("✅ [AUTH-HTTP] Response decoded successfully")
                return decoded
            } catch {
                print("❌ [AUTH-HTTP] Decoding error:", error)
                print("❌ [AUTH-HTTP] Decoding error details:", error.localizedDescription)
                if let decodingError = error as? DecodingError {
                    switch decodingError {
                    case .keyNotFound(let key, let context):
                        print("❌ [AUTH-HTTP] Missing key:", key.stringValue, "in context:", context.debugDescription)
                    case .typeMismatch(let type, let context):
                        print("❌ [AUTH-HTTP] Type mismatch for type:", type, "in context:", context.debugDescription)
                    case .valueNotFound(let type, let context):
                        print("❌ [AUTH-HTTP] Value not found for type:", type, "in context:", context.debugDescription)
                    case .dataCorrupted(let context):
                        print("❌ [AUTH-HTTP] Data corrupted:", context.debugDescription)
                    @unknown default:
                        print("❌ [AUTH-HTTP] Unknown decoding error")
                    }
                }
                throw error
            }
        } catch let error as AuthError {
            print("❌ [AUTH-HTTP] AuthError:", error.localizedDescription)
            throw error
        } catch {
            print("❌ [AUTH-HTTP] Network/Other error:", error.localizedDescription)
            throw AuthError.networkError(error)
        }
    }
}