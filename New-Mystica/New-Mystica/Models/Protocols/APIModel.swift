//
//  APIModel.swift
//  New-Mystica
//
//  Protocol for data models that interface with the API
//

import Foundation

/// Protocol for all data models that are sent to/received from the API
/// Ensures consistent Codable implementation with snake_case mapping
protocol APIModel: Codable {
    /// CodingKeys enum for mapping Swift property names to API snake_case field names
    associatedtype CodingKeys: CodingKey
}

// MARK: - Usage Documentation

/*
 Example conformance:

 struct Equipment: APIModel {
     let id: Int
     let itemType: String
     let rarity: String
     let createdAt: Date

     enum CodingKeys: String, CodingKey {
         case id
         case itemType = "item_type"
         case rarity
         case createdAt = "created_at"
     }
 }

 This ensures:
 1. All API models are Codable for JSON serialization
 2. Consistent snake_case <-> camelCase mapping via CodingKeys

 The APIClient will automatically use the correct encoding/decoding strategy
 when working with types that conform to APIModel.
 */