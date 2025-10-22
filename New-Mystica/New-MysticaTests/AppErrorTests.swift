//
//  AppErrorTests.swift
//  New-MysticaTests
//
//  Tests for AppError enum mapping, descriptions, and recovery suggestions
//

import XCTest
@testable import New_Mystica

final class AppErrorTests: XCTestCase {

    // MARK: - Network Error Tests

    func testNetworkErrorDescription() {
        let error = AppError.networkError(URLError(.timedOut))
        let description = error.errorDescription

        XCTAssertNotNil(description)
        XCTAssertTrue(description?.contains("Network error") ?? false)
    }

    func testNetworkErrorRecoverySuggestion() {
        let error = AppError.networkError(URLError(.notConnectedToInternet))
        let suggestion = error.recoverySuggestion

        XCTAssertNotNil(suggestion)
        XCTAssertTrue(suggestion?.contains("internet connection") ?? false)
    }

    // MARK: - Server Error Tests

    func testServerErrorWithMessage() {
        let error = AppError.serverError(500, "Internal Server Error")
        let description = error.errorDescription

        XCTAssertNotNil(description)
        XCTAssertTrue(description?.contains("500") ?? false)
        XCTAssertTrue(description?.contains("Internal Server Error") ?? false)
    }

    func testServerErrorWithoutMessage() {
        let error = AppError.serverError(404, nil)
        let description = error.errorDescription

        XCTAssertNotNil(description)
        XCTAssertTrue(description?.contains("404") ?? false)
    }

    func testServerErrorRecoverySuggestion() {
        let error = AppError.serverError(503, "Service Unavailable")
        let suggestion = error.recoverySuggestion

        XCTAssertNotNil(suggestion)
        XCTAssertTrue(suggestion?.contains("server") ?? false)
    }

    // MARK: - Invalid Response Tests

    func testInvalidResponseDescription() {
        let error = AppError.invalidResponse
        let description = error.errorDescription

        XCTAssertEqual(description, "Invalid server response")
    }

    // MARK: - Decoding Error Tests

    func testDecodingErrorDescription() {
        let error = AppError.decodingError("Expected 'name' field")
        let description = error.errorDescription

        XCTAssertNotNil(description)
        XCTAssertTrue(description?.contains("decode") ?? false)
        XCTAssertTrue(description?.contains("name") ?? false)
    }

    // MARK: - No Device ID Tests

    func testNoDeviceIdDescription() {
        let error = AppError.noDeviceId
        let description = error.errorDescription

        XCTAssertEqual(description, "Could not get device ID")
    }

    // MARK: - No Auth Token Tests

    func testNoAuthTokenDescription() {
        let error = AppError.noAuthToken
        let description = error.errorDescription

        XCTAssertEqual(description, "No authentication token found")
    }

    func testNoAuthTokenRecoverySuggestion() {
        let error = AppError.noAuthToken
        let suggestion = error.recoverySuggestion

        XCTAssertNil(suggestion)
    }

    // MARK: - Unauthorized Tests

    func testUnauthorizedDescription() {
        let error = AppError.unauthorized
        let description = error.errorDescription

        XCTAssertEqual(description, "Unauthorized access")
    }

    func testUnauthorizedRecoverySuggestion() {
        let error = AppError.unauthorized
        let suggestion = error.recoverySuggestion

        XCTAssertEqual(suggestion, "Please log in again")
    }

    // MARK: - Not Found Tests

    func testNotFoundDescription() {
        let error = AppError.notFound
        let description = error.errorDescription

        XCTAssertEqual(description, "Resource not found")
    }

    func testNotFoundRecoverySuggestion() {
        let error = AppError.notFound
        let suggestion = error.recoverySuggestion

        XCTAssertEqual(suggestion, "The requested resource could not be found")
    }

    // MARK: - Invalid Data Tests

    func testInvalidDataDescription() {
        let error = AppError.invalidData("User ID is missing")
        let description = error.errorDescription

        XCTAssertNotNil(description)
        XCTAssertTrue(description?.contains("User ID is missing") ?? false)
    }

    // MARK: - Unknown Error Tests

    func testUnknownErrorDescription() {
        let nsError = NSError(domain: "TestDomain", code: -999, userInfo: [NSLocalizedDescriptionKey: "Test error"])
        let error = AppError.unknown(nsError)
        let description = error.errorDescription

        XCTAssertNotNil(description)
        XCTAssertTrue(description?.contains("Unknown error") ?? false)
    }

    // MARK: - Error Mapping Tests

    func testURLErrorMapping() {
        let urlError = URLError(.timedOut)
        let appError = AppError.from(urlError)

        if case .networkError = appError {
            XCTAssert(true)
        } else {
            XCTFail("URLError should map to networkError")
        }
    }

    func testDecodingErrorMapping() {
        let jsonData = "{invalid json}".data(using: .utf8)!
        let decoder = JSONDecoder()

        do {
            _ = try decoder.decode(String.self, from: jsonData)
            XCTFail("Should have thrown DecodingError")
        } catch let decodingError as DecodingError {
            let appError = AppError.from(decodingError)

            if case .decodingError = appError {
                XCTAssert(true)
            } else {
                XCTFail("DecodingError should map to decodingError")
            }
        } catch {
            XCTFail("Unexpected error type")
        }
    }

    func testGenericErrorMapping() {
        let nsError = NSError(domain: "TestDomain", code: -1)
        let appError = AppError.from(nsError)

        if case .unknown = appError {
            XCTAssert(true)
        } else {
            XCTFail("NSError should map to unknown")
        }
    }

    // MARK: - Equatable Tests

    func testNetworkErrorEquality() {
        let error1 = AppError.networkError(URLError(.timedOut))
        let error2 = AppError.networkError(URLError(.timedOut))

        XCTAssertEqual(error1, error2)
    }

    func testServerErrorEquality() {
        let error1 = AppError.serverError(500, "Error")
        let error2 = AppError.serverError(500, "Error")

        XCTAssertEqual(error1, error2)
    }

    func testDecodingErrorEquality() {
        let error1 = AppError.decodingError("Test")
        let error2 = AppError.decodingError("Test")

        XCTAssertEqual(error1, error2)
    }

    func testErrorInequality() {
        let error1: AppError = .invalidResponse
        let error2: AppError = .noDeviceId

        XCTAssertNotEqual(error1, error2)
    }
}
