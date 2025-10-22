//
//  ViewModelHelpers.swift
//  New-Mystica
//
//  Helper utilities to reduce ViewModel boilerplate for Loadable<T> operations
//

import Foundation
import Observation

/// Helper function to reduce Loadable<T> boilerplate
///
/// Usage:
/// ```swift
/// func loadMaterials() async {
///     do {
///         let result = try await repository.fetchAllMaterials()
///         allMaterials = .loaded(result)
///     } catch let error as AppError {
///         allMaterials = .error(error)
///     } catch {
///         allMaterials = .error(.unknown(error))
///     }
/// }
/// ```
func handleLoadableResult<T>(
    _ result: Result<T, Error>
) -> Loadable<T> {
    switch result {
    case .success(let value):
        return .loaded(value)
    case .failure(let error):
        if let appError = error as? AppError {
            return .error(appError)
        } else {
            return .error(.unknown(error))
        }
    }
}