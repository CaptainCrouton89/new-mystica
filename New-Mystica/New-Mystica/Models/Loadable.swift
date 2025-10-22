//
//  Loadable.swift
//  New-Mystica
//
//  Generic result type for async operations with loading states
//

import Foundation

enum Loadable<T>: Sendable where T: Sendable {
    case idle
    case loading
    case loaded(T)
    case error(AppError)

    var isLoading: Bool {
        if case .loading = self {
            return true
        }
        return false
    }

    var value: T? {
        if case .loaded(let value) = self {
            return value
        }
        return nil
    }

    var error: AppError? {
        if case .error(let error) = self {
            return error
        }
        return nil
    }
}

// MARK: - Equatable Conformance
extension Loadable: Equatable where T: Equatable {
    static func == (lhs: Loadable<T>, rhs: Loadable<T>) -> Bool {
        switch (lhs, rhs) {
        case (.idle, .idle):
            return true
        case (.loading, .loading):
            return true
        case (.loaded(let lhsValue), .loaded(let rhsValue)):
            return lhsValue == rhsValue
        case (.error(let lhsError), .error(let rhsError)):
            return lhsError == rhsError
        default:
            return false
        }
    }
}
