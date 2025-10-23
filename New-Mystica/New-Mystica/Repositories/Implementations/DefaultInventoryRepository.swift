//
//  DefaultInventoryRepository.swift
//  New-Mystica
//
//  Implementation of InventoryRepository using unified APIClient
//  Handles player inventory, material application/removal, and material library
//

import Foundation

final class DefaultInventoryRepository: InventoryRepository {
    private let apiClient: APIClient

    init(apiClient: APIClient = APIClient.shared) {
        self.apiClient = apiClient
    }

    // MARK: - InventoryRepository Protocol

    func fetchInventory(page: Int = 1, filter: InventoryFilter? = nil, sortOption: InventorySortOption? = nil) async throws -> InventoryResponse {
        var queryParams = ["page=\(page)", "limit=50"]

        // Add filter parameter
        if let filter = filter {
            if filter.isSlotFilter {
                queryParams.append("slot_type=\(filter.rawValue)")
            } else if filter == .styled {
                queryParams.append("styled=true")
            } else if filter == .unstyled {
                queryParams.append("styled=false")
            }
            // .all filter doesn't add any parameters
        }

        // Add sort parameter
        if let sortOption = sortOption {
            queryParams.append("sort=\(sortOption.rawValue)")
        }

        let endpoint = "/inventory?" + queryParams.joined(separator: "&")
        let response: InventoryResponse = try await apiClient.get(endpoint: endpoint)
        return response
    }

    func fetchMaterials() async throws -> [MaterialTemplate] {
        struct MaterialsResponse: Decodable {
            let materials: [MaterialTemplate]
        }

        let response: MaterialsResponse = try await apiClient.get(endpoint: "/materials")
        return response.materials
    }

    func applyMaterial(itemId: String, materialId: String, styleId: String, slotIndex: Int) async throws -> EnhancedPlayerItem {
        struct ApplyMaterialRequest: Encodable {
            let materialId: String
            let styleId: String
            let slotIndex: Int

            enum CodingKeys: String, CodingKey {
                case materialId = "material_id"
                case styleId = "style_id"
                case slotIndex = "slot_index"
            }
        }

        struct ApplyMaterialResponse: Decodable {
            let success: Bool
            let item: EnhancedPlayerItem
        }

        let request = ApplyMaterialRequest(
            materialId: materialId,
            styleId: styleId,
            slotIndex: slotIndex
        )

        let response: ApplyMaterialResponse = try await apiClient.post(
            endpoint: "/items/\(itemId)/materials/apply",
            body: request
        )

        return response.item
    }

    func removeMaterial(itemId: String, slotIndex: Int) async throws -> EnhancedPlayerItem {
        struct RemoveMaterialResponse: Decodable {
            let success: Bool
            let item: EnhancedPlayerItem
        }

        let response: RemoveMaterialResponse = try await apiClient.delete(
            endpoint: "/items/\(itemId)/materials/\(slotIndex)"
        )

        return response.item
    }

    func replaceMaterial(itemId: String, slotIndex: Int, newMaterialId: String) async throws -> EnhancedPlayerItem {
        struct ReplaceMaterialRequest: Encodable {
            let slotIndex: Int
            let newMaterialId: String
            let newStyleId: String
            let goldCost: Int

            enum CodingKeys: String, CodingKey {
                case slotIndex = "slot_index"
                case newMaterialId = "new_material_id"
                case newStyleId = "new_style_id"
                case goldCost = "gold_cost"
            }
        }

        struct ReplaceMaterialResponse: Decodable {
            let success: Bool
            let item: EnhancedPlayerItem
        }

        // Note: For simplicity, using "normal" style and calculating base cost
        // In a real implementation, these might be parameters or calculated separately
        let request = ReplaceMaterialRequest(
            slotIndex: slotIndex,
            newMaterialId: newMaterialId,
            newStyleId: "normal",
            goldCost: 100 // Base replacement cost - would be calculated based on item level
        )

        let response: ReplaceMaterialResponse = try await apiClient.post(
            endpoint: "/items/\(itemId)/materials/replace",
            body: request
        )

        return response.item
    }
}