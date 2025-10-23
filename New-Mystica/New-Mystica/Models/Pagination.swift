//
//  Pagination.swift
//  New-Mystica
//
//  Pagination models for API responses
//

import Foundation

/// Pagination information for paginated API responses
struct PaginationInfo: Codable {
    let currentPage: Int
    let totalPages: Int
    let totalItems: Int
    let itemsPerPage: Int

    enum CodingKeys: String, CodingKey {
        case currentPage = "current_page"
        case totalPages = "total_pages"
        case totalItems = "total_items"
        case itemsPerPage = "items_per_page"
    }
}