//
//  AuthRepository.swift
//  New-Mystica
//
//  Protocol for authentication-related API calls
//  Implementations are stateless and return Loadable results
//

import Foundation

protocol AuthRepository {
    func registerDevice(deviceId: String) async throws -> (user: User, token: String)
    func logout() async throws
}

final class AuthRepositoryImpl: AuthRepository {
    private let baseURL = "http://localhost:3000/api/v1"

    func registerDevice(deviceId: String) async throws -> (user: User, token: String) {
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

        let request = try buildRequest(
            method: "POST",
            path: "/auth/register-device",
            body: DeviceRegistrationRequest(device_id: deviceId)
        )

        let response: DeviceRegistrationResponse = try await executeRequest(request)
        return (user: response.user, token: response.session.access_token)
    }

    func logout() async throws {
        struct LogoutResponse: Decodable {
            let success: Bool
        }

        let request = try buildRequest(
            method: "POST",
            path: "/auth/logout",
            requiresAuth: true
        )

        let _: LogoutResponse = try await executeRequest(request)
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

        if requiresAuth, let token = KeychainService.get(key: "mystica_access_token") {
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
    }
}
