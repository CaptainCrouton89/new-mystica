//
//  AuthRepository.swift
//  New-Mystica
//
//  Protocol for authentication-related API calls
//  Implementations handle device registration, session management, and logout
//

import Foundation

protocol AuthRepository {
    func registerDevice(deviceId: String) async throws -> (user: User, token: String)
    func getCurrentUser(token: String) async throws -> User
    func logout() async throws
    func deleteAccount() async throws
}
