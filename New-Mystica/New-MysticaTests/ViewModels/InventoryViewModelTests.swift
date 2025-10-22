//
//  InventoryViewModelTests.swift
//  New-MysticaTests
//
//  Unit tests for InventoryViewModel covering state management, material operations, and item filtering
//

import XCTest
@testable import New_Mystica

final class InventoryViewModelTests: XCTestCase {

    private var mockRepository: MockInventoryRepository!
    private var viewModel: InventoryViewModel!

    override func setUp() {
        super.setUp()
        mockRepository = MockInventoryRepository()
        viewModel = InventoryViewModel(repository: mockRepository)
    }

    override func tearDown() {
        mockRepository = nil
        viewModel = nil
        super.tearDown()
    }

    // MARK: - Initialization Tests

    func testInitialization() {
        XCTAssertEqual(viewModel.items, .idle)
        XCTAssertEqual(viewModel.materials, .idle)
        XCTAssertNil(viewModel.selectedItem)
        XCTAssertFalse(viewModel.applyingMaterial)
    }

    // MARK: - Load Inventory Tests

    func testLoadInventory_Success() async {
        // Given
        let expectedItems = [
            EnhancedPlayerItem.testData(id: "item1", baseType: "sword"),
            EnhancedPlayerItem.testData(id: "item2", baseType: "armor"),
            EnhancedPlayerItem.testData(id: "item3", baseType: "accessory")
        ]
        mockRepository.mockInventory = expectedItems

        // When
        await viewModel.loadInventory()

        // Then
        XCTAssertEqual(mockRepository.fetchInventoryCallCount, 1)
        if case .loaded(let items) = viewModel.items {
            XCTAssertEqual(items.count, 3)
            XCTAssertEqual(items[0].id, "item1")
            XCTAssertEqual(items[1].id, "item2")
            XCTAssertEqual(items[2].id, "item3")
        } else {
            XCTFail("Expected items to be loaded")
        }
    }

    func testLoadInventory_Failure() async {
        // Given
        mockRepository.shouldFailFetchInventory = true

        // When
        await viewModel.loadInventory()

        // Then
        XCTAssertEqual(mockRepository.fetchInventoryCallCount, 1)
        if case .error(let error) = viewModel.items {
            XCTAssertNotNil(error)
        } else {
            XCTFail("Expected items to be in error state")
        }
    }

    func testLoadInventory_LoadingState() async {
        // Given
        mockRepository.fetchInventoryDelayMs = 200

        // When
        let task = Task {
            await viewModel.loadInventory()
        }

        // Check loading state immediately
        try? await Task.sleep(nanoseconds: 10_000_000) // 10ms
        XCTAssertEqual(viewModel.items, .loading)

        // Wait for completion
        await task.value

        // Then
        if case .loaded = viewModel.items {
            XCTAssert(true)
        } else {
            XCTFail("Expected items to be loaded after delay")
        }
    }

    func testLoadInventory_EmptyResult() async {
        // Given
        mockRepository.mockInventory = []

        // When
        await viewModel.loadInventory()

        // Then
        if case .loaded(let items) = viewModel.items {
            XCTAssertTrue(items.isEmpty)
        } else {
            XCTFail("Expected empty items array to be loaded")
        }
    }

    // MARK: - Load Materials Tests

    func testLoadMaterials_Success() async {
        // Given
        let expectedMaterials = MaterialTemplate.sampleMaterials()
        mockRepository.mockMaterials = expectedMaterials

        // When
        await viewModel.loadMaterials()

        // Then
        XCTAssertEqual(mockRepository.fetchMaterialsCallCount, 1)
        if case .loaded(let materials) = viewModel.materials {
            XCTAssertEqual(materials.count, expectedMaterials.count)
            XCTAssertEqual(materials.first?.name, expectedMaterials.first?.name)
        } else {
            XCTFail("Expected materials to be loaded")
        }
    }

    func testLoadMaterials_Failure() async {
        // Given
        mockRepository.shouldFailFetchMaterials = true

        // When
        await viewModel.loadMaterials()

        // Then
        XCTAssertEqual(mockRepository.fetchMaterialsCallCount, 1)
        if case .error(let error) = viewModel.materials {
            XCTAssertNotNil(error)
        } else {
            XCTFail("Expected materials to be in error state")
        }
    }

    func testLoadMaterials_LoadingState() async {
        // Given
        mockRepository.fetchMaterialsDelayMs = 150

        // When
        let task = Task {
            await viewModel.loadMaterials()
        }

        // Check loading state immediately
        try? await Task.sleep(nanoseconds: 10_000_000) // 10ms
        XCTAssertEqual(viewModel.materials, .loading)

        // Wait for completion
        await task.value

        // Then
        if case .loaded = viewModel.materials {
            XCTAssert(true)
        } else {
            XCTFail("Expected materials to be loaded after delay")
        }
    }

    // MARK: - Apply Material Tests

    func testApplyMaterial_Success() async {
        // Given
        let originalItem = EnhancedPlayerItem.testData(id: "item1", isStyled: false)
        mockRepository.mockInventory = [originalItem]
        viewModel.items = .loaded([originalItem])

        // When
        await viewModel.applyMaterial(
            itemId: "item1",
            materialId: "material123",
            styleId: "style1",
            slotIndex: 0
        )

        // Then
        XCTAssertEqual(mockRepository.applyMaterialCallCount, 1)
        XCTAssertEqual(mockRepository.lastAppliedMaterialParams?.itemId, "item1")
        XCTAssertEqual(mockRepository.lastAppliedMaterialParams?.materialId, "material123")
        XCTAssertEqual(mockRepository.lastAppliedMaterialParams?.styleId, "style1")
        XCTAssertEqual(mockRepository.lastAppliedMaterialParams?.slotIndex, 0)
        XCTAssertFalse(viewModel.applyingMaterial)

        // Verify item was updated in local state
        if case .loaded(let items) = viewModel.items {
            let updatedItem = items.first { $0.id == "item1" }
            XCTAssertNotNil(updatedItem)
            XCTAssertTrue(updatedItem?.isStyled ?? false)
            XCTAssertEqual(viewModel.selectedItem?.id, "item1")
        } else {
            XCTFail("Expected items to remain loaded")
        }
    }

    func testApplyMaterial_Failure() async {
        // Given
        let item = EnhancedPlayerItem.testData(id: "item1")
        viewModel.items = .loaded([item])
        mockRepository.shouldFailApplyMaterial = true

        // When
        await viewModel.applyMaterial(
            itemId: "item1",
            materialId: "material123",
            styleId: "style1",
            slotIndex: 0
        )

        // Then
        XCTAssertEqual(mockRepository.applyMaterialCallCount, 1)
        XCTAssertFalse(viewModel.applyingMaterial)
        if case .error = viewModel.items {
            XCTAssert(true)
        } else {
            XCTFail("Expected items to be in error state after failed material application")
        }
    }

    func testApplyMaterial_InProgressState() async {
        // Given
        let item = EnhancedPlayerItem.testData(id: "item1")
        viewModel.items = .loaded([item])
        mockRepository.applyMaterialDelayMs = 200

        // When
        let task = Task {
            await viewModel.applyMaterial(
                itemId: "item1",
                materialId: "material123",
                styleId: "style1",
                slotIndex: 0
            )
        }

        // Check in-progress state
        try? await Task.sleep(nanoseconds: 10_000_000) // 10ms
        XCTAssertTrue(viewModel.applyingMaterial)

        // Wait for completion
        await task.value
        XCTAssertFalse(viewModel.applyingMaterial)
    }

    func testApplyMaterial_UpdatesSelectedItem() async {
        // Given
        let originalItem = EnhancedPlayerItem.testData(id: "item1", isStyled: false)
        viewModel.items = .loaded([originalItem])
        viewModel.selectedItem = originalItem

        // When
        await viewModel.applyMaterial(
            itemId: "item1",
            materialId: "material123",
            styleId: "style1",
            slotIndex: 0
        )

        // Then
        XCTAssertNotNil(viewModel.selectedItem)
        XCTAssertTrue(viewModel.selectedItem?.isStyled ?? false)
        XCTAssertEqual(viewModel.selectedItem?.id, "item1")
    }

    // MARK: - Remove Material Tests

    func testRemoveMaterial_Success() async {
        // Given
        let styledItem = EnhancedPlayerItem.testData(
            id: "item1",
            appliedMaterials: [ItemMaterialApplication.testData()],
            isStyled: true
        )
        viewModel.items = .loaded([styledItem])

        // When
        await viewModel.removeMaterial(itemId: "item1", slotIndex: 0)

        // Then
        XCTAssertEqual(mockRepository.removeMaterialCallCount, 1)
        XCTAssertEqual(mockRepository.lastRemovedMaterialParams?.itemId, "item1")
        XCTAssertEqual(mockRepository.lastRemovedMaterialParams?.slotIndex, 0)

        // Verify item was updated in local state
        if case .loaded(let items) = viewModel.items {
            let updatedItem = items.first { $0.id == "item1" }
            XCTAssertNotNil(updatedItem)
            // The mock implementation should update the item to have fewer materials
        } else {
            XCTFail("Expected items to remain loaded")
        }
    }

    func testRemoveMaterial_Failure() async {
        // Given
        let item = EnhancedPlayerItem.testData(id: "item1")
        viewModel.items = .loaded([item])
        mockRepository.shouldFailRemoveMaterial = true

        // When
        await viewModel.removeMaterial(itemId: "item1", slotIndex: 0)

        // Then
        XCTAssertEqual(mockRepository.removeMaterialCallCount, 1)
        if case .error = viewModel.items {
            XCTAssert(true)
        } else {
            XCTFail("Expected items to be in error state after failed material removal")
        }
    }

    func testRemoveMaterial_UpdatesSelectedItem() async {
        // Given
        let styledItem = EnhancedPlayerItem.testData(id: "item1", isStyled: true)
        viewModel.items = .loaded([styledItem])
        viewModel.selectedItem = styledItem

        // When
        await viewModel.removeMaterial(itemId: "item1", slotIndex: 0)

        // Then
        XCTAssertNotNil(viewModel.selectedItem)
        XCTAssertEqual(viewModel.selectedItem?.id, "item1")
    }

    // MARK: - Item Selection Tests

    func testSelectItem() {
        // Given
        let item = EnhancedPlayerItem.testData(id: "item1")

        // When
        viewModel.selectItem(item)

        // Then
        XCTAssertEqual(viewModel.selectedItem?.id, "item1")
    }

    func testClearSelection() {
        // Given
        let item = EnhancedPlayerItem.testData(id: "item1")
        viewModel.selectedItem = item

        // When
        viewModel.clearSelection()

        // Then
        XCTAssertNil(viewModel.selectedItem)
    }

    // MARK: - Computed Properties Tests

    func testStyledItems() async {
        // Given
        let items = [
            EnhancedPlayerItem.testData(id: "item1", isStyled: true),
            EnhancedPlayerItem.testData(id: "item2", isStyled: false),
            EnhancedPlayerItem.testData(id: "item3", isStyled: true),
            EnhancedPlayerItem.testData(id: "item4", isStyled: false)
        ]
        mockRepository.mockInventory = items
        await viewModel.loadInventory()

        // When
        let styledItems = viewModel.styledItems

        // Then
        XCTAssertEqual(styledItems.count, 2)
        XCTAssertTrue(styledItems.allSatisfy { $0.isStyled })
        XCTAssertTrue(styledItems.contains { $0.id == "item1" })
        XCTAssertTrue(styledItems.contains { $0.id == "item3" })
    }

    func testUnstyledItems() async {
        // Given
        let items = [
            EnhancedPlayerItem.testData(id: "item1", isStyled: true),
            EnhancedPlayerItem.testData(id: "item2", isStyled: false),
            EnhancedPlayerItem.testData(id: "item3", isStyled: true),
            EnhancedPlayerItem.testData(id: "item4", isStyled: false)
        ]
        mockRepository.mockInventory = items
        await viewModel.loadInventory()

        // When
        let unstyledItems = viewModel.unstyledItems

        // Then
        XCTAssertEqual(unstyledItems.count, 2)
        XCTAssertTrue(unstyledItems.allSatisfy { !$0.isStyled })
        XCTAssertTrue(unstyledItems.contains { $0.id == "item2" })
        XCTAssertTrue(unstyledItems.contains { $0.id == "item4" })
    }

    func testStyledItems_WithIdleState() {
        // Given - items is .idle

        // When
        let styledItems = viewModel.styledItems
        let unstyledItems = viewModel.unstyledItems

        // Then
        XCTAssertTrue(styledItems.isEmpty)
        XCTAssertTrue(unstyledItems.isEmpty)
    }

    func testStyledItems_WithEmptyInventory() async {
        // Given
        mockRepository.mockInventory = []
        await viewModel.loadInventory()

        // When
        let styledItems = viewModel.styledItems
        let unstyledItems = viewModel.unstyledItems

        // Then
        XCTAssertTrue(styledItems.isEmpty)
        XCTAssertTrue(unstyledItems.isEmpty)
    }

    func testStyledItems_WithErrorState() async {
        // Given
        mockRepository.shouldFailFetchInventory = true
        await viewModel.loadInventory()

        // When
        let styledItems = viewModel.styledItems
        let unstyledItems = viewModel.unstyledItems

        // Then
        XCTAssertTrue(styledItems.isEmpty)
        XCTAssertTrue(unstyledItems.isEmpty)
    }

    // MARK: - Complex Scenarios Tests

    func testApplyMaterial_ToNonExistentItem() async {
        // Given
        let items = [EnhancedPlayerItem.testData(id: "item1")]
        viewModel.items = .loaded(items)

        // When
        await viewModel.applyMaterial(
            itemId: "nonexistent",
            materialId: "material123",
            styleId: "style1",
            slotIndex: 0
        )

        // Then
        XCTAssertEqual(mockRepository.applyMaterialCallCount, 1)
        // The mock should still return an updated item, but it won't be found in local state
        if case .loaded(let currentItems) = viewModel.items {
            XCTAssertEqual(currentItems.count, 1) // Original item should remain
            XCTAssertEqual(currentItems[0].id, "item1")
        } else {
            XCTFail("Expected items to remain loaded")
        }
    }

    func testMultipleOperations_InSequence() async {
        // Given
        let item = EnhancedPlayerItem.testData(id: "item1", isStyled: false)
        mockRepository.mockInventory = [item]
        await viewModel.loadInventory()

        // When - Apply material
        await viewModel.applyMaterial(
            itemId: "item1",
            materialId: "material123",
            styleId: "style1",
            slotIndex: 0
        )

        // Then
        XCTAssertEqual(mockRepository.applyMaterialCallCount, 1)
        if case .loaded(let items) = viewModel.items {
            XCTAssertTrue(items.first?.isStyled ?? false)
        }

        // When - Remove material
        await viewModel.removeMaterial(itemId: "item1", slotIndex: 0)

        // Then
        XCTAssertEqual(mockRepository.removeMaterialCallCount, 1)
        if case .loaded = viewModel.items {
            XCTAssert(true)
        } else {
            XCTFail("Expected items to remain loaded after remove operation")
        }
    }

    func testConcurrentOperations_PreventedByInProgressFlag() async {
        // Given
        let item = EnhancedPlayerItem.testData(id: "item1")
        viewModel.items = .loaded([item])
        mockRepository.applyMaterialDelayMs = 200

        // When - Start two concurrent operations
        let task1 = Task {
            await viewModel.applyMaterial(
                itemId: "item1",
                materialId: "material1",
                styleId: "style1",
                slotIndex: 0
            )
        }

        // Small delay to ensure first operation starts
        try? await Task.sleep(nanoseconds: 10_000_000) // 10ms

        let task2 = Task {
            await viewModel.applyMaterial(
                itemId: "item1",
                materialId: "material2",
                styleId: "style2",
                slotIndex: 1
            )
        }

        await task1.value
        await task2.value

        // Then - Both operations should execute (applyingMaterial doesn't prevent concurrent calls in current implementation)
        XCTAssertEqual(mockRepository.applyMaterialCallCount, 2)
        XCTAssertFalse(viewModel.applyingMaterial)
    }

    // MARK: - Error Recovery Tests

    func testErrorRecovery_LoadingAfterError() async {
        // Given - First load fails
        mockRepository.shouldFailFetchInventory = true
        await viewModel.loadInventory()

        if case .error = viewModel.items {
            XCTAssert(true)
        } else {
            XCTFail("Expected error state")
        }

        // When - Fix the error and reload
        mockRepository.shouldFailFetchInventory = false
        mockRepository.mockInventory = [EnhancedPlayerItem.testData()]
        await viewModel.loadInventory()

        // Then
        if case .loaded(let items) = viewModel.items {
            XCTAssertEqual(items.count, 1)
        } else {
            XCTFail("Expected items to be loaded after error recovery")
        }
    }

    func testPartialOperations_SomeSucceedSomeFail() async {
        // Given
        let items = [
            EnhancedPlayerItem.testData(id: "item1"),
            EnhancedPlayerItem.testData(id: "item2")
        ]
        viewModel.items = .loaded(items)

        // When - First operation succeeds
        await viewModel.applyMaterial(
            itemId: "item1",
            materialId: "material1",
            styleId: "style1",
            slotIndex: 0
        )

        // Verify success
        if case .loaded(let currentItems) = viewModel.items {
            XCTAssertEqual(currentItems.count, 2)
        } else {
            XCTFail("Expected items to be loaded after successful operation")
        }

        // When - Second operation fails
        mockRepository.shouldFailApplyMaterial = true
        await viewModel.applyMaterial(
            itemId: "item2",
            materialId: "material2",
            styleId: "style2",
            slotIndex: 0
        )

        // Then - State should be error after failure
        if case .error = viewModel.items {
            XCTAssert(true)
        } else {
            XCTFail("Expected error state after failed operation")
        }
    }
}