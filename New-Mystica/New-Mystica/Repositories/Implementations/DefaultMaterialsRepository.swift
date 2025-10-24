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

        let response: MaterialsData = try await apiClient.get(endpoint: "/materials")
        return response.materials
    }

    func fetchMaterialInventory() async throws -> [MaterialInventoryStack] {
        struct MaterialInventoryData: Codable {
            let materials: [MaterialInventoryStack]
        }

        let response: MaterialInventoryData = try await apiClient.get(endpoint: "/materials/inventory")
        return response.materials
    }

    func getMaterialDetails(materialId: String) async throws -> MaterialTemplate {
        let material: MaterialTemplate = try await apiClient.get(endpoint: "/materials/\(materialId)")
        return material
    }

    func fetchMaterialsByRarity(rarity: String) async throws -> [MaterialTemplate] {
        struct MaterialsData: Codable {
            let materials: [MaterialTemplate]
        }

        let endpoint = "/materials?rarity=\(rarity)"
        let response: MaterialsData = try await apiClient.get(endpoint: endpoint)
        return response.materials
    }

    func fetchMaterialsByStyle(styleId: String) async throws -> [MaterialTemplate] {
        struct MaterialsData: Codable {
            let materials: [MaterialTemplate]
        }

        let endpoint = "/materials?style_id=\(styleId)"
        let response: MaterialsData = try await apiClient.get(endpoint: endpoint)
        return response.materials
    }
}