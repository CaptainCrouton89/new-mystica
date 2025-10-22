//
//  LocationBuilder.swift
//  New-MysticaTests
//
//  Builder pattern for creating Location test data with fluent interface
//

import Foundation
@testable import New_Mystica

class LocationBuilder {
    private var id = "location_123"
    private var name = "Test Location"
    private var lat = 40.7829
    private var lng = -73.9654
    private var locationType = "park"
    private var stateCode = "NY"
    private var countryCode = "US"
    private var enemyLevel = 5
    private var materialDropPool = ["wood", "stone"]
    private var distanceMeters = 1000

    init() {}

    // MARK: - Builder Methods

    func withId(_ id: String) -> LocationBuilder {
        self.id = id
        return self
    }

    func withName(_ name: String) -> LocationBuilder {
        self.name = name
        return self
    }

    func withCoordinates(lat: Double, lng: Double) -> LocationBuilder {
        self.lat = lat
        self.lng = lng
        return self
    }

    func withLocationType(_ type: String) -> LocationBuilder {
        self.locationType = type
        return self
    }

    func withLocation(state: String, country: String) -> LocationBuilder {
        self.stateCode = state
        self.countryCode = country
        return self
    }

    func withEnemyLevel(_ level: Int) -> LocationBuilder {
        self.enemyLevel = level
        return self
    }

    func withMaterialDropPool(_ materials: [String]) -> LocationBuilder {
        self.materialDropPool = materials
        return self
    }

    func withDistance(_ distanceMeters: Int) -> LocationBuilder {
        self.distanceMeters = distanceMeters
        return self
    }

    // MARK: - Convenience Methods

    func asForest() -> LocationBuilder {
        return self
            .withLocationType("forest")
            .withMaterialDropPool(["wood", "leaf", "bark", "mushroom"])
            .withName("Enchanted Forest")
    }

    func asDesert() -> LocationBuilder {
        return self
            .withLocationType("desert")
            .withMaterialDropPool(["sand", "cactus", "crystal"])
            .withName("Burning Sands")
    }

    func asMountain() -> LocationBuilder {
        return self
            .withLocationType("mountain")
            .withMaterialDropPool(["stone", "iron", "coal", "gem"])
            .withName("Rocky Peaks")
    }

    func asOcean() -> LocationBuilder {
        return self
            .withLocationType("ocean")
            .withMaterialDropPool(["shell", "coral", "pearl", "seaweed"])
            .withName("Deep Blue Sea")
    }

    func asUrban() -> LocationBuilder {
        return self
            .withLocationType("urban")
            .withMaterialDropPool(["metal", "glass", "wire", "plastic"])
            .withName("City Center")
    }

    func asLowLevel() -> LocationBuilder {
        return self
            .withEnemyLevel(Int.random(in: 1...3))
    }

    func asMidLevel() -> LocationBuilder {
        return self
            .withEnemyLevel(Int.random(in: 4...8))
    }

    func asHighLevel() -> LocationBuilder {
        return self
            .withEnemyLevel(Int.random(in: 9...15))
    }

    func asNearby() -> LocationBuilder {
        return self
            .withDistance(Int.random(in: 100...500))
    }

    func asFar() -> LocationBuilder {
        return self
            .withDistance(Int.random(in: 5000...15000))
    }

    func inUSA() -> LocationBuilder {
        return self
            .withLocation(state: "CA", country: "US")
    }

    func inCanada() -> LocationBuilder {
        return self
            .withLocation(state: "ON", country: "CA")
    }

    func inNewYork() -> LocationBuilder {
        return self
            .withCoordinates(lat: 40.7829, lng: -73.9654)
            .withLocation(state: "NY", country: "US")
    }

    func inLosAngeles() -> LocationBuilder {
        return self
            .withCoordinates(lat: 34.0522, lng: -118.2437)
            .withLocation(state: "CA", country: "US")
    }

    // MARK: - Build Method

    func build() -> Location {
        return Location(
            id: id,
            name: name,
            lat: lat,
            lng: lng,
            locationType: locationType,
            stateCode: stateCode,
            countryCode: countryCode,
            enemyLevel: enemyLevel,
            materialDropPool: materialDropPool,
            distanceMeters: distanceMeters
        )
    }

    // MARK: - Factory Methods

    static func centralPark() -> LocationBuilder {
        return LocationBuilder()
            .withId("central_park")
            .withName("Central Park")
            .withCoordinates(lat: 40.7829, lng: -73.9654)
            .withLocationType("park")
            .withLocation(state: "NY", country: "US")
            .withMaterialDropPool(["wood", "leaf", "flower"])
            .withEnemyLevel(3)
            .asNearby()
    }

    static func randomForest() -> LocationBuilder {
        return LocationBuilder()
            .asForest()
            .asMidLevel()
            .asNearby()
    }

    static func dangerousDesert() -> LocationBuilder {
        return LocationBuilder()
            .asDesert()
            .asHighLevel()
            .asFar()
    }

    static func beginnerArea() -> LocationBuilder {
        return LocationBuilder()
            .withName("Training Grounds")
            .withLocationType("field")
            .asLowLevel()
            .asNearby()
            .withMaterialDropPool(["wood", "cloth", "rope"])
    }

    static func richMountain() -> LocationBuilder {
        return LocationBuilder()
            .asMountain()
            .asMidLevel()
            .withMaterialDropPool(["iron", "gold", "silver", "gems", "crystal"])
    }

    static func collection() -> [Location] {
        return [
            centralPark().build(),
            randomForest().build(),
            dangerousDesert().build(),
            beginnerArea().build(),
            richMountain().build(),
            LocationBuilder().asOcean().asMidLevel().build(),
            LocationBuilder().asUrban().asLowLevel().build()
        ]
    }
}

// MARK: - ZoneBuilder

class ZoneBuilder {
    private var id = "zone_123"
    private var name = "Test Zone"
    private var biomeType = BiomeType.forest
    private var locations: [Location] = []
    private var materialDropPool = ["wood", "stone"]

    init() {}

    // MARK: - Builder Methods

    func withId(_ id: String) -> ZoneBuilder {
        self.id = id
        return self
    }

    func withName(_ name: String) -> ZoneBuilder {
        self.name = name
        return self
    }

    func withBiomeType(_ biome: BiomeType) -> ZoneBuilder {
        self.biomeType = biome
        return self
    }

    func withLocations(_ locations: [Location]) -> ZoneBuilder {
        self.locations = locations
        return self
    }

    func addLocation(_ location: Location) -> ZoneBuilder {
        self.locations.append(location)
        return self
    }

    func withMaterialDropPool(_ materials: [String]) -> ZoneBuilder {
        self.materialDropPool = materials
        return self
    }

    // MARK: - Convenience Methods

    func asForestZone() -> ZoneBuilder {
        return self
            .withBiomeType(.forest)
            .withName("Forest Zone")
            .withMaterialDropPool(["wood", "leaf", "bark", "mushroom", "vine"])
    }

    func asDesertZone() -> ZoneBuilder {
        return self
            .withBiomeType(.desert)
            .withName("Desert Zone")
            .withMaterialDropPool(["sand", "cactus", "crystal", "bone"])
    }

    func asMountainZone() -> ZoneBuilder {
        return self
            .withBiomeType(.mountain)
            .withName("Mountain Zone")
            .withMaterialDropPool(["stone", "iron", "coal", "gem", "crystal"])
    }

    func asCoastalZone() -> ZoneBuilder {
        return self
            .withBiomeType(.coastal)
            .withName("Coastal Zone")
            .withMaterialDropPool(["shell", "coral", "pearl", "seaweed", "driftwood"])
    }

    func asUrbanZone() -> ZoneBuilder {
        return self
            .withBiomeType(.urban)
            .withName("Urban Zone")
            .withMaterialDropPool(["metal", "glass", "wire", "plastic", "concrete"])
    }

    func withMultipleLocations() -> ZoneBuilder {
        let zoneLocations = [
            LocationBuilder().withId("\(id)_loc_1").build(),
            LocationBuilder().withId("\(id)_loc_2").build(),
            LocationBuilder().withId("\(id)_loc_3").build()
        ]
        return self.withLocations(zoneLocations)
    }

    // MARK: - Build Method

    func build() -> Zone {
        let finalLocations = locations.isEmpty ? [LocationBuilder().build()] : locations
        return Zone(
            id: id,
            name: name,
            biomeType: biomeType,
            locations: finalLocations,
            materialDropPool: materialDropPool
        )
    }

    // MARK: - Factory Methods

    static func enchantedForest() -> ZoneBuilder {
        return ZoneBuilder()
            .withId("enchanted_forest")
            .asForestZone()
            .withMultipleLocations()
    }

    static func burningDesert() -> ZoneBuilder {
        return ZoneBuilder()
            .withId("burning_desert")
            .asDesertZone()
            .withMultipleLocations()
    }

    static func crystalMountains() -> ZoneBuilder {
        return ZoneBuilder()
            .withId("crystal_mountains")
            .asMountainZone()
            .withMaterialDropPool(["crystal", "gem", "mithril", "adamantite"])
            .withMultipleLocations()
    }

    static func collection() -> [Zone] {
        return [
            enchantedForest().build(),
            burningDesert().build(),
            crystalMountains().build(),
            ZoneBuilder().asCoastalZone().withMultipleLocations().build(),
            ZoneBuilder().asUrbanZone().withMultipleLocations().build()
        ]
    }
}