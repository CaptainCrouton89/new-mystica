//
//  AppError.swift
//  New-Mystica
//
//  Typed error enum for all app-level failures
//

import Foundation

enum AppError: LocalizedError {
    case networkError(Error)
    case serverError(Int, String?)
    case invalidResponse
    case decodingError(String)
    case noDeviceId
    case noAuthToken
    case unauthorized
    case notFound
    case unknown(Error)

    var errorDescription: String? {
        switch self {
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .serverError(let code, let message):
            if let message = message {
                return "Server error (\(code)): \(message)"
            }
            return "Server error: \(code)"
        case .invalidResponse:
            return "Invalid server response"
        case .decodingError(let message):
            return "Failed to decode response: \(message)"
        case .noDeviceId:
            return "Could not get device ID"
        case .noAuthToken:
            return "No authentication token found"
        case .unauthorized:
            return "Unauthorized access"
        case .notFound:
            return "Resource not found"
        case .unknown(let error):
            return "Unknown error: \(error.localizedDescription)"
        }
    }

    var recoverySuggestion: String? {
        switch self {
        case .networkError:
            return "Check your internet connection and try again"
        case .serverError(let code, _) where code >= 500:
            return "The server is experiencing issues. Please try again later"
        case .unauthorized:
            return "Please log in again"
        case .notFound:
            return "The requested resource could not be found"
        default:
            return nil
        }
    }
}
