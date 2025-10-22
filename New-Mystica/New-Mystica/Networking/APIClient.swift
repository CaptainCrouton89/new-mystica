//
//  APIClient.swift
//  New-Mystica
//
//  Unified HTTP client to consolidate network request logic
//

import Foundation

@MainActor
class APIClient {
    static let shared = APIClient()

    private let baseURL = "https://api.mystica.world"
    private var authToken: String?

    private init() {
        // Load auth token from keychain on initialization
        self.authToken = KeychainService.get(key: "mystica_access_token")
    }

    // MARK: - Public Interface

    func setAuthToken(token: String?) {
        self.authToken = token
        do {
            if let token = token {
                try KeychainService.save(key: "mystica_access_token", value: token)
            } else {
                try KeychainService.delete(key: "mystica_access_token")
            }
        } catch {
            // Log error but don't throw - auth token setting should be best-effort
            print("Failed to update keychain: \(error)")
        }
    }

    func get<T: Decodable>(endpoint: String) async throws -> T {
        let request = try buildRequest(method: "GET", path: endpoint, requiresAuth: true)
        return try await executeRequest(request)
    }

    func post<T: Decodable>(endpoint: String, body: Encodable? = nil) async throws -> T {
        let request = try buildRequest(method: "POST", path: endpoint, body: body, requiresAuth: true)
        return try await executeRequest(request)
    }

    func put<T: Decodable>(endpoint: String, body: Encodable? = nil) async throws -> T {
        let request = try buildRequest(method: "PUT", path: endpoint, body: body, requiresAuth: true)
        return try await executeRequest(request)
    }

    func delete<T: Decodable>(endpoint: String) async throws -> T {
        let request = try buildRequest(method: "DELETE", path: endpoint, requiresAuth: true)
        return try await executeRequest(request)
    }

    // For endpoints that don't require auth (like login)
    func postPublic<T: Decodable>(endpoint: String, body: Encodable? = nil) async throws -> T {
        let request = try buildRequest(method: "POST", path: endpoint, body: body, requiresAuth: false)
        return try await executeRequest(request)
    }

    // MARK: - Private Helpers

    private func buildRequest(
        method: String,
        path: String,
        body: Encodable? = nil,
        requiresAuth: Bool = false
    ) throws -> URLRequest {
        let url = URL(string: "\(baseURL)\(path)")!
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if requiresAuth, let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body = body {
            let encoder = JSONEncoder()
            encoder.keyEncodingStrategy = .convertToSnakeCase
            request.httpBody = try encoder.encode(body)
        }

        return request
    }

    private func executeRequest<T: Decodable>(_ request: URLRequest) async throws -> T {
        do {
            let (data, response) = try await URLSession.shared.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse else {
                throw AppError.invalidResponse
            }

            guard (200...299).contains(httpResponse.statusCode) else {
                let message = String(data: data, encoding: .utf8)
                throw AppError.serverError(httpResponse.statusCode, message)
            }

            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601

            do {
                return try decoder.decode(T.self, from: data)
            } catch {
                throw AppError.decodingError(error.localizedDescription)
            }
        } catch {
            throw AppError.from(error)
        }
    }
}