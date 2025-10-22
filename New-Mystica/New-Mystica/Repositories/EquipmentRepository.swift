//
//  EquipmentRepository.swift
//  New-Mystica
//
//  Protocol for equipment-related API calls
//

import Foundation

protocol EquipmentRepository {
    func fetchEquipment() async throws -> [Equipment]
    func equipItem(slotName: String, itemId: String) async throws
    func unequipItem(slotName: String) async throws
}

final class EquipmentRepositoryImpl: EquipmentRepository {
    private let baseURL = "http://localhost:3000/api/v1"

    func fetchEquipment() async throws -> [Equipment] {
        let request = try buildRequest(
            method: "GET",
            path: "/player/equipment",
            requiresAuth: true
        )

        return try await executeRequest(request)
    }

    func equipItem(slotName: String, itemId: String) async throws {
        struct EquipRequest: Encodable {
            let item_id: String
        }

        let request = try buildRequest(
            method: "POST",
            path: "/player/equipment/\(slotName)",
            body: EquipRequest(item_id: itemId),
            requiresAuth: true
        )

        let _: Equipment = try await executeRequest(request)
    }

    func unequipItem(slotName: String) async throws {
        let request = try buildRequest(
            method: "DELETE",
            path: "/player/equipment/\(slotName)",
            requiresAuth: true
        )

        let _: Equipment = try await executeRequest(request)
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
