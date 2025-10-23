//
//  AppError.swift
//  New-Mystica
//
//

import Foundation

/// App-level error enum with user-friendly descriptions and recovery suggestions.
enum AppError: LocalizedError, Equatable, Sendable {
    case networkError(Error)
    case serverError(Int, String?)
    case invalidResponse
    case decodingError(String)
    case invalidURL(String)
    case noDeviceId
    case noAuthToken
    case unauthorized
    case notFound
    case invalidData(String)
    case invalidInput(String)
    case businessLogic(String)

    case keychainError(String)
    case persistenceError(String)
    case fileSystemError(String)

    case imageLoadingError(String)
    case assetNotFound(String)

    case validationFailed(String)
    case constraintViolation(String)

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
        case .invalidURL(let url):
            return "Invalid URL: \(url)"
        case .noDeviceId:
            return "Could not get device ID"
        case .noAuthToken:
            return "No authentication token found"
        case .unauthorized:
            return "Unauthorized access"
        case .notFound:
            return "Resource not found"
        case .invalidData(let message):
            return "Invalid data: \(message)"
        case .invalidInput(let message):
            return "Invalid input: \(message)"
        case .businessLogic(let message):
            return message
        case .keychainError(let message):
            return "Keychain error: \(message)"
        case .persistenceError(let message):
            return "Data persistence error: \(message)"
        case .fileSystemError(let message):
            return "File system error: \(message)"
        case .imageLoadingError(let message):
            return "Image loading error: \(message)"
        case .assetNotFound(let message):
            return "Asset not found: \(message)"
        case .validationFailed(let message):
            return "Validation failed: \(message)"
        case .constraintViolation(let message):
            return "Constraint violation: \(message)"
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
        case .keychainError:
            return "Check app permissions and try again"
        case .persistenceError:
            return "Try restarting the app or free up device storage"
        case .fileSystemError:
            return "Check available storage space and permissions"
        case .imageLoadingError:
            return "Check your internet connection and try again"
        case .assetNotFound:
            return "Try reinstalling the app if the problem persists"
        case .validationFailed:
            return "Please check your input and try again"
        case .constraintViolation:
            return "Please review the requirements and adjust your input"
        default:
            return nil
        }
    }

    static func from(_ error: Error) -> AppError {
        if let urlError = error as? URLError {
            return .networkError(urlError)
        }

        if error is DecodingError {
            return .decodingError(error.localizedDescription)
        }

        return .unknown(error)
    }
}

extension AppError {
    static func == (lhs: AppError, rhs: AppError) -> Bool {
        switch (lhs, rhs) {
        case (.networkError(let lhsError), .networkError(let rhsError)):
            return lhsError.localizedDescription == rhsError.localizedDescription
        case (.serverError(let lhsCode, let lhsMessage), .serverError(let rhsCode, let rhsMessage)):
            return lhsCode == rhsCode && lhsMessage == rhsMessage
        case (.invalidResponse, .invalidResponse):
            return true
        case (.decodingError(let lhsMessage), .decodingError(let rhsMessage)):
            return lhsMessage == rhsMessage
        case (.invalidURL(let lhsURL), .invalidURL(let rhsURL)):
            return lhsURL == rhsURL
        case (.noDeviceId, .noDeviceId):
            return true
        case (.noAuthToken, .noAuthToken):
            return true
        case (.unauthorized, .unauthorized):
            return true
        case (.notFound, .notFound):
            return true
        case (.invalidData(let lhsMessage), .invalidData(let rhsMessage)):
            return lhsMessage == rhsMessage
        case (.invalidInput(let lhsMessage), .invalidInput(let rhsMessage)):
            return lhsMessage == rhsMessage
        case (.businessLogic(let lhsMessage), .businessLogic(let rhsMessage)):
            return lhsMessage == rhsMessage
        case (.keychainError(let lhsMessage), .keychainError(let rhsMessage)):
            return lhsMessage == rhsMessage
        case (.persistenceError(let lhsMessage), .persistenceError(let rhsMessage)):
            return lhsMessage == rhsMessage
        case (.fileSystemError(let lhsMessage), .fileSystemError(let rhsMessage)):
            return lhsMessage == rhsMessage
        case (.imageLoadingError(let lhsMessage), .imageLoadingError(let rhsMessage)):
            return lhsMessage == rhsMessage
        case (.assetNotFound(let lhsMessage), .assetNotFound(let rhsMessage)):
            return lhsMessage == rhsMessage
        case (.validationFailed(let lhsMessage), .validationFailed(let rhsMessage)):
            return lhsMessage == rhsMessage
        case (.constraintViolation(let lhsMessage), .constraintViolation(let rhsMessage)):
            return lhsMessage == rhsMessage
        case (.unknown(let lhsError), .unknown(let rhsError)):
            return lhsError.localizedDescription == rhsError.localizedDescription
        default:
            return false
        }
    }
}
