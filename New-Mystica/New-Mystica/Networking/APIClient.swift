//
//  APIClient.swift
//  New-Mystica
//
//

import Foundation

/// Unified HTTP client with authentication and error handling.
@MainActor
class APIClient {
    static let shared = APIClient()

    private let baseURL = APIConfig.baseURL
    private var authToken: String?
    private let urlSession: URLSession

    private init() {
        // Configure URLSession with proper timeouts
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 30    // 30s request timeout
        configuration.timeoutIntervalForResource = 60   // 60s total timeout
        self.urlSession = URLSession(configuration: configuration)

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
            print("❌ [APIClient] Keychain error: \(error.localizedDescription)")
            print("❌ [APIClient] Failed to update keychain: \(error.localizedDescription)")
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

    func postPublic<T: Decodable>(endpoint: String, body: Encodable? = nil) async throws -> T {
        let request = try buildRequest(method: "POST", path: endpoint, body: body, requiresAuth: false)
        return try await executeRequest(request)
    }


    private func buildRequest(
        method: String,
        path: String,
        body: Encodable? = nil,
        requiresAuth: Bool = false
    ) throws -> URLRequest {
        guard let url = URL(string: "\(baseURL)\(path)") else {
            throw AppError.invalidURL("\(baseURL)\(path)")
        }
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

            let (data, response) = try await urlSession.data(for: request)

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
            // Use custom date decoding to handle timestamps with/without Z and fractional seconds
            decoder.dateDecodingStrategy = .custom { decoder in
                let container = try decoder.singleValueContainer()
                let dateString = try container.decode(String.self)

                let formatter = ISO8601DateFormatter()

                // Try with fractional seconds
                formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                if let date = formatter.date(from: dateString) {
                    return date
                }

                // Try without Z but with fractional seconds (backend format)
                if let date = formatter.date(from: dateString + "Z") {
                    return date
                }

                // Try without fractional seconds
                formatter.formatOptions = [.withInternetDateTime]
                if let date = formatter.date(from: dateString) {
                    return date
                }

                // Try without Z and without fractional seconds
                if let date = formatter.date(from: dateString + "Z") {
                    return date
                }

                throw DecodingError.dataCorruptedError(in: container, debugDescription: "Invalid date format: \(dateString)")
            }

            do {
                do {
                    let wrappedResponse = try decoder.decode(ApiResponseWrapper<T>.self, from: data)
                    if APIConfig.enableNetworkLogging {
                        print("🔍 Wrapped response decoded successfully. Success: \(wrappedResponse.success), Has data: \(wrappedResponse.data != nil)")
                    }
                    if wrappedResponse.success, let responseData = wrappedResponse.data {
                        return responseData
                    } else if let error = wrappedResponse.error {
                        throw AppError.serverError(httpResponse.statusCode, error.message)
                    } else {
                        if APIConfig.enableNetworkLogging {
                            print("❌ Wrapped response has no data and no error")
                        }
                        throw AppError.decodingError("Response data is missing")
                    }
                } catch {
                    if APIConfig.enableNetworkLogging {
                        print("❌ Failed to decode ApiResponseWrapper: \(error.localizedDescription)")
                        if let decodingError = error as? DecodingError {
                            print("Decoding error details: \(decodingError)")
                        }
                    }
                    throw error
                }

                if APIConfig.enableNetworkLogging {
                    print("⚠️ Could not decode as ApiResponseWrapper, trying direct decode")
                }
                return try decoder.decode(T.self, from: data)
            } catch let DecodingError.dataCorrupted(context) {
                print("❌ DECODING ERROR - Data Corrupted")
                print("Path:", context.codingPath.map { $0.stringValue }.joined(separator: " -> "))
                print("Description:", context.debugDescription)
                printDecodingDetails(data: data, expectedType: T.self)
                throw AppError.decodingError("Data corrupted: \(context.debugDescription)")
            } catch let DecodingError.keyNotFound(key, context) {
                print("❌ DECODING ERROR - Key Not Found: '\(key.stringValue)'")
                print("Path:", context.codingPath.map { $0.stringValue }.joined(separator: " -> "))
                print("Description:", context.debugDescription)
                printDecodingDetails(data: data, expectedType: T.self)
                throw AppError.decodingError("Key '\(key.stringValue)' not found")
            } catch let DecodingError.typeMismatch(type, context) {
                print("❌ DECODING ERROR - Type Mismatch")
                print("Expected type:", type)
                print("Path:", context.codingPath.map { $0.stringValue }.joined(separator: " -> "))
                print("Description:", context.debugDescription)
                printDecodingDetails(data: data, expectedType: T.self)
                throw AppError.decodingError("Type mismatch at \(context.codingPath.map { $0.stringValue }.joined(separator: " -> "))")
            } catch let DecodingError.valueNotFound(type, context) {
                print("❌ DECODING ERROR - Value Not Found")
                print("Expected type:", type)
                print("Path:", context.codingPath.map { $0.stringValue }.joined(separator: " -> "))
                print("Description:", context.debugDescription)
                printDecodingDetails(data: data, expectedType: T.self)
                throw AppError.decodingError("Value not found at \(context.codingPath.map { $0.stringValue }.joined(separator: " -> "))")
            } catch {
                if APIConfig.enableNetworkLogging {
                    let responseString = String(data: data, encoding: .utf8) ?? "unable to decode response as string"
                    print("❌ Decoding error: \(error.localizedDescription)")
                    print("📥 Response payload: \(responseString)")
                }
                printDecodingDetails(data: data, expectedType: T.self)
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

    private func printDecodingDetails<T: Decodable>(data: Data, expectedType: T.Type) {
        print("\n--- RECEIVED JSON ---")
        if let jsonString = String(data: data, encoding: .utf8) {
            print(jsonString)
        } else {
            print("(Unable to convert data to string)")
        }

        print("\n--- EXPECTED STRUCTURE ---")
        print("Type:", String(describing: expectedType))

        // Pretty-print the received JSON
        if let jsonObject = try? JSONSerialization.jsonObject(with: data),
           let prettyData = try? JSONSerialization.data(withJSONObject: jsonObject, options: .prettyPrinted),
           let prettyString = String(data: prettyData, encoding: .utf8) {
            print("\n--- FORMATTED RECEIVED JSON ---")
            print(prettyString)
        }
        print("--- END DECODING DETAILS ---\n")
    }
}


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