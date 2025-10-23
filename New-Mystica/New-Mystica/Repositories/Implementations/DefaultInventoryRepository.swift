//
//  DefaultInventoryRepository.swift
//  New-Mystica
//
//

import Foundation

/// HTTP-based InventoryRepository implementation using APIClient.
final class DefaultInventoryRepository: InventoryRepository {
    private let apiClient: APIClient

    init(apiClient: APIClient = APIClient.shared) {
        self.apiClient = apiClient
    }


    func fetchInventory(page: Int, filter: InventoryFilter?, sortOption: InventorySortOption?) async throws -> InventoryResponse {
        var queryParams = ["page=\(page)", "limit=50"]

        if let filter = filter {
            if filter.isSlotFilter {
                queryParams.append("slot_type=\(filter.rawValue)")
            } else if filter == .styled {
                queryParams.append("styled=true")
            } else if filter == .unstyled {
                queryParams.append("styled=false")
            }
        }

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
            let item: EnhancedPlayerItem

            enum CodingKeys: String, CodingKey {
                case item
            }

            init(from decoder: Decoder) throws {
                let container = try decoder.container(keyedBy: CodingKeys.self)
                self.item = try container.decode(EnhancedPlayerItem.self, forKey: .item)
            }
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
            let item: EnhancedPlayerItem
        }

        let request = ReplaceMaterialRequest(
            slotIndex: slotIndex,
            newMaterialId: newMaterialId,
            newStyleId: "normal",
            goldCost: 100
        )

        let response: ReplaceMaterialResponse = try await apiClient.post(
            endpoint: "/items/\(itemId)/materials/replace",
            body: request
        )

        return response.item
    }

    func sellItem(itemId: String) async throws -> SellItemResponse {
        let response: SellItemResponse = try await apiClient.delete(
            endpoint: "/items/\(itemId)"
        )
        return response
    }

    func fetchUpgradeCost(itemId: String) async throws -> UpgradeCostInfo {
        let response: UpgradeCostInfo = try await apiClient.get(
            endpoint: "/items/\(itemId)/upgrade-cost"
        )
        return response
    }

    func upgradeItem(itemId: String) async throws -> UpgradeResult {
        let response: UpgradeResult = try await apiClient.post(
            endpoint: "/items/\(itemId)/upgrade",
            body: EmptyBody()
        )
        return response
    }
}

private struct EmptyBody: Encodable {}

struct SellItemResponse: Decodable {
    let success: Bool
    let goldEarned: Int
    let newGoldBalance: Int
    let itemName: String

    enum CodingKeys: String, CodingKey {
        case success
        case goldEarned = "gold_earned"
        case newGoldBalance = "new_gold_balance"
        case itemName = "item_name"
    }
}