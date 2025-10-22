//
//  LoadableTests.swift
//  New-MysticaTests
//
//  Tests for Loadable<T> state machine and computed properties
//

import XCTest
@testable import New_Mystica

final class LoadableTests: XCTestCase {

    // MARK: - Idle State Tests

    func testIdleStateProperties() {
        let loadable: Loadable<String> = .idle

        XCTAssertFalse(loadable.isLoading)
        XCTAssertNil(loadable.value)
        XCTAssertNil(loadable.error)
    }

    // MARK: - Loading State Tests

    func testLoadingStateProperties() {
        let loadable: Loadable<String> = .loading

        XCTAssertTrue(loadable.isLoading)
        XCTAssertNil(loadable.value)
        XCTAssertNil(loadable.error)
    }

    // MARK: - Loaded State Tests

    func testLoadedStateProperties() {
        let value = "test data"
        let loadable: Loadable<String> = .loaded(value)

        XCTAssertFalse(loadable.isLoading)
        XCTAssertEqual(loadable.value, value)
        XCTAssertNil(loadable.error)
    }

    // MARK: - Error State Tests

    func testErrorStateProperties() {
        let error = AppError.networkError(URLError(.timedOut))
        let loadable: Loadable<String> = .error(error)

        XCTAssertFalse(loadable.isLoading)
        XCTAssertNil(loadable.value)
        XCTAssertNotNil(loadable.error)
    }

    // MARK: - State Transitions

    func testIdleToLoadingTransition() {
        var loadable: Loadable<String> = .idle
        loadable = .loading

        XCTAssertTrue(loadable.isLoading)
    }

    func testLoadingToLoadedTransition() {
        var loadable: Loadable<String> = .loading
        loadable = .loaded("success")

        XCTAssertFalse(loadable.isLoading)
        XCTAssertEqual(loadable.value, "success")
    }

    func testLoadingToErrorTransition() {
        var loadable: Loadable<String> = .loading
        let error = AppError.unknown(NSError(domain: "test", code: -1))
        loadable = .error(error)

        XCTAssertFalse(loadable.isLoading)
        XCTAssertNotNil(loadable.error)
    }

    func testErrorToIdleTransition() {
        let error = AppError.invalidResponse
        var loadable: Loadable<String> = .error(error)
        loadable = .idle

        XCTAssertNil(loadable.error)
    }

    func testLoadedToLoadingTransition() {
        var loadable: Loadable<String> = .loaded("data")
        loadable = .loading

        XCTAssertTrue(loadable.isLoading)
        XCTAssertNil(loadable.value)
    }

    // MARK: - Equatable Conformance

    func testEquatableIdleEquality() {
        let lhs: Loadable<String> = .idle
        let rhs: Loadable<String> = .idle

        XCTAssertEqual(lhs, rhs)
    }

    func testEquatableLoadingEquality() {
        let lhs: Loadable<String> = .loading
        let rhs: Loadable<String> = .loading

        XCTAssertEqual(lhs, rhs)
    }

    func testEquatableLoadedEquality() {
        let lhs: Loadable<String> = .loaded("test")
        let rhs: Loadable<String> = .loaded("test")

        XCTAssertEqual(lhs, rhs)
    }

    func testEquatableLoadedInequality() {
        let lhs: Loadable<String> = .loaded("test1")
        let rhs: Loadable<String> = .loaded("test2")

        XCTAssertNotEqual(lhs, rhs)
    }

    func testEquatableErrorEquality() {
        let error = AppError.invalidResponse
        let lhs: Loadable<String> = .error(error)
        let rhs: Loadable<String> = .error(error)

        XCTAssertEqual(lhs, rhs)
    }

    func testEquatableDifferentStatesInequality() {
        let idle: Loadable<String> = .idle
        let loading: Loadable<String> = .loading
        let loaded: Loadable<String> = .loaded("data")
        let error: Loadable<String> = .error(.invalidResponse)

        XCTAssertNotEqual(idle, loading)
        XCTAssertNotEqual(idle, loaded)
        XCTAssertNotEqual(idle, error)
        XCTAssertNotEqual(loading, loaded)
        XCTAssertNotEqual(loading, error)
        XCTAssertNotEqual(loaded, error)
    }

    // MARK: - Integer Type Tests

    func testLoadableIntegerType() {
        let loadable: Loadable<Int> = .loaded(42)
        XCTAssertEqual(loadable.value, 42)
    }

    // MARK: - Array Type Tests

    func testLoadableArrayType() {
        let data = [1, 2, 3]
        let loadable: Loadable<[Int]> = .loaded(data)
        XCTAssertEqual(loadable.value, data)
    }

    // MARK: - Complex Type Tests

    func testLoadableComplexType() {
        let stats = ItemStats(atkPower: 10, atkAccuracy: 0.8, defPower: 5, defAccuracy: 0.7)
        let loadable: Loadable<ItemStats> = .loaded(stats)
        XCTAssertEqual(loadable.value?.atkPower, 10)
    }
}
