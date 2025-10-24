//
//  MockAuthRepository.swift
//  New-MysticaTests
//
//  Mock implementation of AuthRepository for testing
//

import Foundation
@testable import New_Mystica

class MockAuthRepository: AuthRepository {

    // MARK: - Configuration Properties
    var shouldFailRegistration = false
    var shouldFailGetCurrentUser = false
    var shouldFailLogout = false
    var registrationDelayMs: Int = 0
    var getCurrentUserDelayMs: Int = 0
    var logoutDelayMs: Int = 0

    // MARK: - Mock Data
    var mockUser: User = User.testData()
    var mockToken: String = "mock_auth_token_12345"

    // MARK: - Call Tracking
    var registerDeviceCallCount = 0
    var getCurrentUserCallCount = 0
    var logoutCallCount = 0
    var lastRegisteredDeviceId: String?
    var lastTokenUsed: String?

    // MARK: - AuthRepository Implementation

    func registerDevice(deviceId: String) async throws -> (user: User, token: String) {
        registerDeviceCallCount += 1
        lastRegisteredDeviceId = deviceId

        if registrationDelayMs > 0 {
            try await Task.sleep(nanoseconds: UInt64(registrationDelayMs * 1_000_000))
        }

        if shouldFailRegistration {
            throw AppError.serverError(400, "Device registration failed")
        }

        return (user: mockUser, token: mockToken)
    }

    func getCurrentUser(token: String) async throws -> User {
        getCurrentUserCallCount += 1
        lastTokenUsed = token

        if getCurrentUserDelayMs > 0 {
            try await Task.sleep(nanoseconds: UInt64(getCurrentUserDelayMs * 1_000_000))
        }

        if shouldFailGetCurrentUser {
            throw AppError.serverError(404, "User not found")
        }

        return mockUser
    }

    func logout() async throws {
        logoutCallCount += 1

        if logoutDelayMs > 0 {
            try await Task.sleep(nanoseconds: UInt64(logoutDelayMs * 1_000_000))
        }

        if shouldFailLogout {
            throw AppError.serverError(500, "Logout failed")
        }
    }

    // MARK: - Test Helpers

    func reset() {
        shouldFailRegistration = false
        shouldFailGetCurrentUser = false
        shouldFailLogout = false
        registrationDelayMs = 0
        getCurrentUserDelayMs = 0
        logoutDelayMs = 0
        registerDeviceCallCount = 0
        getCurrentUserCallCount = 0
        logoutCallCount = 0
        lastRegisteredDeviceId = nil
        lastTokenUsed = nil
        mockUser = User.testData()
        mockToken = "mock_auth_token_12345"
    }
}

// MARK: - Test Data Extensions

extension User {
    static func testData(
        id: UUID = UUID(),
        deviceId: String? = "test_device_123",
        accountType: String = "anonymous",
        email: String? = nil,
        username: String? = nil,
        vanityLevel: Int? = 1,
        avgItemLevel: Float? = 10.5,
        gold: Int? = 500,
        gems: Int? = 0,
        level: Int? = 1,
        xp: Int? = 0,
        createdAt: Date = Date(),
        lastLogin: Date? = Date()
    ) -> User {
        // Create a mock User using the init method
        // Since User has custom decoding, we'll create a test JSON and decode it
        let userDict: [String: Any] = [
            "id": id.uuidString,
            "device_id": deviceId as Any,
            "account_type": accountType,
            "email": email as Any,
            "username": username as Any,
            "vanity_level": vanityLevel as Any,
            "avg_item_level": avgItemLevel as Any,
            "gold": gold as Any,
            "gems": gems as Any,
            "total_stats": [
                "atkPower": 0,
                "atkAccuracy": 0,
                "defPower": 0,
                "defAccuracy": 0
            ],
            "level": level as Any,
            "xp": xp as Any,
            "created_at": ISO8601DateFormatter().string(from: createdAt),
            "last_login": lastLogin.map { ISO8601DateFormatter().string(from: $0) } as Any
        ]

        let jsonData = try! JSONSerialization.data(withJSONObject: userDict)
        return try! JSONDecoder().decode(User.self, from: jsonData)
    }
}