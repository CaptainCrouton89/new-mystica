//
//  DefaultAuthRepository.swift
//  New-Mystica
//
//  Implementation of AuthRepository using unified APIClient
//  Handles device registration, authentication, and logout with token management
//

import Foundation

final class DefaultAuthRepository: AuthRepository {
    private let apiClient: APIClient

    init(apiClient: APIClient = APIClient.shared) {
        self.apiClient = apiClient
    }

    // MARK: - AuthRepository Protocol

    func registerDevice(deviceId: String) async throws -> (user: User, token: String) {
        struct DeviceRegistrationRequest: Encodable {
            let deviceId: String

            enum CodingKeys: String, CodingKey {
                case deviceId = "device_id"
            }
        }

        struct DeviceRegistrationResponse: Decodable {
            let user: User
            let session: Session
            let message: String?

            enum CodingKeys: String, CodingKey {
                case user
                case session
                case message
            }
        }

        struct Session: Decodable {
            let accessToken: String
            let expiresIn: Int

            enum CodingKeys: String, CodingKey {
                case accessToken = "access_token"
                case expiresIn = "expires_in"
            }
        }

        let request = DeviceRegistrationRequest(deviceId: deviceId)

        let response: DeviceRegistrationResponse = try await apiClient.postPublic(
            endpoint: "/auth/register-device",
            body: request
        )

        // Store the token in the APIClient
        apiClient.setAuthToken(token: response.session.accessToken)

        return (user: response.user, token: response.session.accessToken)
    }

    func getCurrentUser(token: String) async throws -> User {
        // Set token temporarily for this request
        apiClient.setAuthToken(token: token)

        // The /auth/me endpoint returns:
        // { success: true, data: { user: User }, timestamp: "..." }
        // APIClient unwraps to: { user: User }
        struct AuthMeData: Decodable {
            let user: User
        }

        let data: AuthMeData = try await apiClient.get(endpoint: "/auth/me")
        return data.user
    }

    func logout() async throws {
        struct LogoutResponse: Decodable {
            let message: String
        }

        let _: LogoutResponse = try await apiClient.post(endpoint: "/auth/logout")

        // Clear the token from APIClient and keychain
        apiClient.setAuthToken(token: nil)
    }
}