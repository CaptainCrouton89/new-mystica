//
//  DefaultMaterialsRepository.swift
//  New-Mystica
//
//  Implementation of MaterialsRepository using unified APIClient
//  Handles material templates, player material inventory, and filtering
//

import Foundation

final class DefaultMaterialsRepository: MaterialsRepository {
    private let apiClient: APIClient

    init(apiClient: APIClient = APIClient.shared) {
        self.apiClient = apiClient
    }

    // MARK: - MaterialsRepository Protocol

    func fetchAllMaterials() async throws -> [MaterialTemplate] {
        struct MaterialsData: Codable {
            let materials: [MaterialTemplate]
        }

        let response: ApiResponse<MaterialsData> = try await apiClient.get(endpoint: "/materials")
        guard let data = response.data else {
            throw AppError.invalidData("No materials data in response")
        }
        return data.materials
    }

    func fetchMaterialInventory() async throws -> [MaterialInventoryStack] {
        struct MaterialInventoryData: Codable {
            let materials: [MaterialInventoryStack]
        }

        let response: ApiResponse<MaterialInventoryData> = try await apiClient.get(endpoint: "/materials/inventory")
        guard let data = response.data else {
            throw AppError.invalidData("No material inventory data in response")
        }
        return data.materials
    }

    func getMaterialDetails(materialId: String) async throws -> MaterialTemplate {
        let response: ApiResponse<MaterialTemplate> = try await apiClient.get(endpoint: "/materials/\(materialId)")
        guard let material = response.data else {
            throw AppError.invalidData("No material data in response")
        }
        return material
    }

    func fetchMaterialsByRarity(rarity: String) async throws -> [MaterialTemplate] {
        struct MaterialsData: Codable {
            let materials: [MaterialTemplate]
        }

        let endpoint = "/materials?rarity=\(rarity)"
        let response: ApiResponse<MaterialsData> = try await apiClient.get(endpoint: endpoint)
        guard let data = response.data else {
            throw AppError.invalidData("No materials data in response")
        }
        return data.materials
    }

    func fetchMaterialsByStyle(styleId: String) async throws -> [MaterialTemplate] {
        struct MaterialsData: Codable {
            let materials: [MaterialTemplate]
        }

        let endpoint = "/materials?style_id=\(styleId)"
        let response: ApiResponse<MaterialsData> = try await apiClient.get(endpoint: endpoint)
        guard let data = response.data else {
            throw AppError.invalidData("No materials data in response")
        }
        return data.materials
    }
}