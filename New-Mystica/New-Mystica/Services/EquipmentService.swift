//
//  EquipmentService.swift
//  New-Mystica
//
//  Equipment data loading service for US-701 implementation
//  Handles loading player equipment from backend API
//

import Foundation
import SwiftUI
import Combine

enum EquipmentError: LocalizedError {
    case invalidResponse
    case serverError(Int)
    case networkError(Error)
    case noAuthToken

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "Invalid server response"
        case .serverError(let code):
            return "Server error: \(code)"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .noAuthToken:
            return "No authentication token found"
        }
    }
}

@MainActor
class EquipmentService: ObservableObject {
    static let shared = EquipmentService()

    private let baseURL = APIConfig.baseURL

    @Published var equipment: Equipment?
    @Published var isLoading: Bool = false
    @Published var errorMessage: String?

    private init() {}

    /// Load equipment data from backend API
    func loadEquipment() async throws {
        print("⚔️ [EQUIPMENT] Loading equipment...")
        isLoading = true
        errorMessage = nil

        do {
            // Get token from keychain
            guard let token = KeychainService.get(key: "mystica_access_token") else {
                print("❌ [EQUIPMENT] No auth token found in keychain")
                throw EquipmentError.noAuthToken
            }

            print("🔑 [EQUIPMENT] Found token in keychain (first 30 chars): \(String(token.prefix(30)))...")

            // Make API request
            print("📡 [EQUIPMENT] Making GET request to /equipment")
            let response: Equipment = try await makeRequest(
                method: "GET",
                path: "/equipment",
                requiresAuth: true
            )

            print("✅ [EQUIPMENT] Equipment loaded successfully: \(response.equipmentCount) items equipped")

            // Update state on main actor
            self.equipment = response
            self.isLoading = false
        } catch {
            print("❌ [EQUIPMENT] Failed to load equipment:", error.localizedDescription)
            if let equipError = error as? EquipmentError {
                print("   Error type:", equipError)
            }
            self.errorMessage = "Unable to load equipment data. Please check your connection."
            self.isLoading = false
            throw error
        }
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

        print("📡 [HTTP] Request:", method, url.absoluteString)

        if requiresAuth, let token = KeychainService.get(key: "mystica_access_token") {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            print("🔑 [HTTP] Added Bearer token to Authorization header")
        }

        if let body = body {
            let encoder = JSONEncoder()
            encoder.keyEncodingStrategy = .convertToSnakeCase
            request.httpBody = try encoder.encode(body)
            print("📤 [HTTP] Request body included")
        }

        do {
            print("⏳ [HTTP] Sending request...")
            let (data, response) = try await URLSession.shared.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse else {
                print("❌ [HTTP] Invalid response type")
                throw EquipmentError.invalidResponse
            }

            print("📥 [HTTP] Response status:", httpResponse.statusCode)

            if let responseString = String(data: data, encoding: .utf8) {
                print("📥 [HTTP] Response body:", responseString)
            }

            guard (200...299).contains(httpResponse.statusCode) else {
                print("❌ [HTTP] Server error:", httpResponse.statusCode)
                throw EquipmentError.serverError(httpResponse.statusCode)
            }

            let decoder = JSONDecoder()
            // Don't use automatic snake_case conversion - our models handle it manually
            // decoder.keyDecodingStrategy = .convertFromSnakeCase
            decoder.dateDecodingStrategy = .iso8601
            let decoded = try decoder.decode(T.self, from: data)
            print("✅ [HTTP] Response decoded successfully")
            return decoded
        } catch let error as EquipmentError {
            print("❌ [HTTP] EquipmentError:", error.localizedDescription)
            throw error
        } catch {
            print("❌ [HTTP] Network error:", error.localizedDescription)
            throw EquipmentError.networkError(error)
        }
    }
}