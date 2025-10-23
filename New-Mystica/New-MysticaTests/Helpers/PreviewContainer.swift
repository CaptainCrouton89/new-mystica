//
//  PreviewContainer.swift
//  New-MysticaTests
//
//  Helper utilities for SwiftUI previews with test dependencies
//

import Foundation
import SwiftUI
import SwiftData
@testable import New_Mystica

// MARK: - Preview Container Manager

class PreviewContainer {

    // MARK: - Model Container

    static var modelContainer: ModelContainer = {
        do {
            let schema = Schema([Item.self]) // Add other SwiftData models here as needed
            let configuration = ModelConfiguration(schema: schema, isStoredInMemoryOnly: true)
            return try ModelContainer(for: schema, configurations: [configuration])
        } catch {
            fatalError("Failed to create preview model container: \(error)")
        }
    }()

    // MARK: - Mock Repositories

    static let mockAuthRepository = MockAuthRepository()
    static let mockEquipmentRepository = MockEquipmentRepository()
    static let mockInventoryRepository = MockInventoryRepository()
    static let mockCombatRepository = MockCombatRepository()
    static let mockLocationRepository = MockLocationRepository()
    static let mockProfileRepository = MockProfileRepository()
    static let mockMaterialsRepository = MockMaterialsRepository()

    // MARK: - Navigation Manager

    static let navigationManager = NavigationManager()

    // MARK: - Preview ViewModels

    static func createAuthViewModel() -> AuthViewModel {
        return AuthViewModel(repository: mockAuthRepository)
    }

    static func createEquipmentViewModel() -> EquipmentViewModel {
        return EquipmentViewModel(repository: mockEquipmentRepository)
    }

    static func createInventoryViewModel() -> InventoryViewModel {
        return InventoryViewModel(repository: mockInventoryRepository)
    }

    static func createProfileViewModel() -> ProfileViewModel {
        return ProfileViewModel(repository: mockProfileRepository)
    }

    // MARK: - Preview Scenarios

    static func setupSuccessScenario() {
        // Reset all mocks to success state
        mockAuthRepository.reset()
        mockEquipmentRepository.reset()
        mockInventoryRepository.reset()
        mockCombatRepository.reset()
        mockLocationRepository.reset()
        mockProfileRepository.reset()
        mockMaterialsRepository.reset()

        // Setup positive test data
        mockProfileRepository.mockProfile = UserProfileBuilder.experiencedPlayer().build()
        mockInventoryRepository.mockInventory = [
            EnhancedPlayerItem.testData(baseType: "sword", level: 8),
            EnhancedPlayerItem.testData(baseType: "armor", level: 6),
            EnhancedPlayerItem.testData(baseType: "accessory", level: 4)
        ]
        mockEquipmentRepository.mockEquipment = [Equipment.testData()]
        mockLocationRepository.mockNearbyLocations = LocationBuilder.collection()
    }

    static func setupLoadingScenario() {
        // Reset mocks and add delays
        mockAuthRepository.reset()
        mockEquipmentRepository.reset()
        mockInventoryRepository.reset()
        mockCombatRepository.reset()
        mockLocationRepository.reset()
        mockProfileRepository.reset()
        mockMaterialsRepository.reset()

        // Add delays to simulate loading
        mockProfileRepository.fetchProfileDelayMs = 2000
        mockInventoryRepository.fetchInventoryDelayMs = 1500
        mockEquipmentRepository.fetchDelayMs = 1000
        mockLocationRepository.fetchNearbyDelayMs = 2500
    }

    static func setupErrorScenario() {
        // Reset mocks and setup failures
        mockAuthRepository.reset()
        mockEquipmentRepository.reset()
        mockInventoryRepository.reset()
        mockCombatRepository.reset()
        mockLocationRepository.reset()
        mockProfileRepository.reset()
        mockMaterialsRepository.reset()

        // Setup failure states
        mockProfileRepository.shouldFailFetchProfile = true
        mockInventoryRepository.shouldFailFetchInventory = true
        mockEquipmentRepository.shouldFailFetch = true
        mockLocationRepository.shouldFailFetchNearby = true
    }

    static func setupEmptyDataScenario() {
        // Reset mocks with empty data
        mockAuthRepository.reset()
        mockEquipmentRepository.reset()
        mockInventoryRepository.reset()
        mockCombatRepository.reset()
        mockLocationRepository.reset()
        mockProfileRepository.reset()
        mockMaterialsRepository.reset()

        // Setup empty data
        mockInventoryRepository.mockInventory = []
        mockEquipmentRepository.mockEquipment = []
        mockLocationRepository.mockNearbyLocations = []
        mockMaterialsRepository.mockAllMaterials = []
        mockMaterialsRepository.mockMaterialInventory = []

        // Setup new player profile
        mockProfileRepository.mockProfile = UserProfileBuilder.newPlayer().build()
    }

    static func setupCombatScenario() {
        setupSuccessScenario()

        // Setup active combat session
        mockCombatRepository.mockCombatSession = CombatSessionBuilder
            .balanced()
            .asOngoingCombat()
            .build()
    }

    static func setupRichPlayerScenario() {
        setupSuccessScenario()

        // Setup wealthy player with lots of items
        mockProfileRepository.mockProfile = UserProfileBuilder.veteranPlayer().asRichPlayer().build()
        mockInventoryRepository.mockInventory = [
            EnhancedPlayerItem.testData(baseType: "legendary_sword", level: 20),
            EnhancedPlayerItem.testData(baseType: "dragon_armor", level: 18),
            EnhancedPlayerItem.testData(baseType: "magic_ring", level: 15),
            EnhancedPlayerItem.testData(baseType: "epic_boots", level: 12)
        ]
    }
}

// MARK: - SwiftUI Preview Extensions

extension View {

    /// Configures a view for SwiftUI previews with test dependencies
    func previewEnvironment(scenario: PreviewScenario = .success) -> some View {
        self
            .modelContainer(PreviewContainer.modelContainer)
            .environmentObject(PreviewContainer.navigationManager)
            .onAppear {
                switch scenario {
                case .success:
                    PreviewContainer.setupSuccessScenario()
                case .loading:
                    PreviewContainer.setupLoadingScenario()
                case .error:
                    PreviewContainer.setupErrorScenario()
                case .empty:
                    PreviewContainer.setupEmptyDataScenario()
                case .combat:
                    PreviewContainer.setupCombatScenario()
                case .richPlayer:
                    PreviewContainer.setupRichPlayerScenario()
                }
            }
    }

    /// Configures a view for previews with a specific ViewModel
    func previewWith<T: ObservableObject>(_ viewModel: T) -> some View {
        self
            .modelContainer(PreviewContainer.modelContainer)
            .environmentObject(PreviewContainer.navigationManager)
            .environmentObject(viewModel)
    }
}

// MARK: - Preview Scenarios

enum PreviewScenario {
    case success
    case loading
    case error
    case empty
    case combat
    case richPlayer
}

// MARK: - Preview ViewModels with Mock Data

extension PreviewContainer {

    static func profileViewModelWithData() -> ProfileViewModel {
        let viewModel = createProfileViewModel()
        mockProfileRepository.mockProfile = UserProfileBuilder.experiencedPlayer().build()
        return viewModel
    }

    static func inventoryViewModelWithItems() -> InventoryViewModel {
        let viewModel = createInventoryViewModel()
        mockInventoryRepository.mockInventory = [
            PlayerItemBuilder.weapon().withLevel(10).build().toEnhanced(),
            PlayerItemBuilder.armor().withLevel(8).build().toEnhanced(),
            PlayerItemBuilder.accessory().withLevel(5).build().toEnhanced()
        ]
        return viewModel
    }

    static func inventoryViewModelEmpty() -> InventoryViewModel {
        let viewModel = createInventoryViewModel()
        mockInventoryRepository.mockInventory = []
        return viewModel
    }

    static func authViewModelLoading() -> AuthViewModel {
        let viewModel = createAuthViewModel()
        mockAuthRepository.registrationDelayMs = 3000
        return viewModel
    }

    static func equipmentViewModelWithGear() -> EquipmentViewModel {
        let viewModel = createEquipmentViewModel()
        mockEquipmentRepository.mockEquipment = [
            Equipment.testData(
                slots: EquipmentSlots.testData(
                    weapon: PlayerItemBuilder.powerfulWeapon().build(),
                    armor: PlayerItemBuilder.armor().withPowerfulStats().build(),
                    accessory1: PlayerItemBuilder.accessory().build()
                )
            )
        ]
        return viewModel
    }
}

// MARK: - Helper Extensions

extension PlayerItem {
    func toEnhanced() -> EnhancedPlayerItem {
        return EnhancedPlayerItem(
            id: self.id,
            baseType: self.itemType.category.lowercased(),
            level: self.level,
            appliedMaterials: [],
            computedStats: self.computedStats,
            materialComboHash: nil,
            generatedImageUrl: self.generatedImageUrl,
            imageGenerationStatus: .complete,
            craftCount: 0,
            isStyled: self.isStyled
        )
    }
}

// MARK: - Preview Documentation

/*
 Usage Examples:

 struct ContentView_Previews: PreviewProvider {
     static var previews: some View {
         Group {
             // Basic success scenario
             ContentView()
                 .previewEnvironment(scenario: .success)
                 .previewDisplayName("Success State")

             // Loading scenario
             ContentView()
                 .previewEnvironment(scenario: .loading)
                 .previewDisplayName("Loading State")

             // Error scenario
             ContentView()
                 .previewEnvironment(scenario: .error)
                 .previewDisplayName("Error State")

             // Custom ViewModel
             ProfileView()
                 .previewWith(PreviewContainer.profileViewModelWithData())
                 .previewDisplayName("Profile with Data")
         }
     }
 }
 */