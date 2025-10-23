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

    // Use configurable base URL (supports environment variable override)
    private let baseURL = APIConfig.baseURL
    private var authToken: String?

    private init() {
        // Load auth token from keychain on initialization
        self.authToken = KeychainService.get(key: "mystica_access_token")

        print("🌐 APIClient DEBUG: baseURL = '\(baseURL)'")
        print("🌐 APIClient DEBUG: baseURL isEmpty = \(baseURL.isEmpty)")
        print("🌐 APIClient DEBUG: baseURL count = \(baseURL.count)")
        if APIConfig.enableNetworkLogging {
            print("🌐 APIClient initialized with baseURL: \(baseURL)")
        }
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
            if APIConfig.enableNetworkLogging {
                print("📤 [\(request.httpMethod ?? "GET")] \(request.url?.absoluteString ?? "unknown")")
            }

            let (data, response) = try await URLSession.shared.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse else {
                throw AppError.invalidResponse
            }

            if APIConfig.enableNetworkLogging {
                print("📥 Response: \(httpResponse.statusCode)")
            }

            guard (200...299).contains(httpResponse.statusCode) else {
                let message = String(data: data, encoding: .utf8)
                if APIConfig.enableNetworkLogging {
                    print("❌ Server error: \(httpResponse.statusCode) - \(message ?? "no message")")
                }
                throw AppError.serverError(httpResponse.statusCode, message)
            }

            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601

            do {
                // First, try to decode as wrapped response
                if let wrappedResponse = try? decoder.decode(ApiResponseWrapper<T>.self, from: data) {
                    if wrappedResponse.success, let responseData = wrappedResponse.data {
                        return responseData
                    } else if let error = wrappedResponse.error {
                        throw AppError.serverError(httpResponse.statusCode, error.message)
                    }
                }

                // Fallback: decode as direct type (for backward compatibility during migration)
                return try decoder.decode(T.self, from: data)
            } catch {
                if APIConfig.enableNetworkLogging {
                    let responseString = String(data: data, encoding: .utf8) ?? "unable to decode response as string"
                    print("❌ Decoding error: \(error.localizedDescription)")
                    print("📥 Response payload: \(responseString)")
                }
                throw AppError.decodingError(error.localizedDescription)
            }
        } catch {
            if APIConfig.enableNetworkLogging && !isAppError(error) {
                print("❌ Request error: \(error.localizedDescription)")
            }
            throw AppError.from(error)
        }
    }

    private func isAppError(_ error: Error) -> Bool {
        return error is AppError
    }
}

// MARK: - Response Wrapper Types

private struct ApiResponseWrapper<T: Decodable>: Decodable {
    let success: Bool
    let data: T?
    let error: ErrorDetails?
    let timestamp: String
}

private struct ErrorDetails: Decodable {
    let code: String
    let message: String
    let details: String?
}