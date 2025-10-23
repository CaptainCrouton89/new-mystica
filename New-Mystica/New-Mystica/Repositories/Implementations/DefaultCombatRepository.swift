//
//  DefaultCombatRepository.swift
//  New-Mystica
//
//  Implementation of CombatRepository using unified APIClient
//  Handles combat sessions, actions, and rewards with timing-based mechanics
//

import Foundation

final class DefaultCombatRepository: CombatRepository {
    private let apiClient: APIClient

    init(apiClient: APIClient = APIClient.shared) {
        self.apiClient = apiClient
    }

    // MARK: - CombatRepository Protocol

    func initiateCombat(locationId: String, selectedLevel: Int) async throws -> CombatSession {
        struct InitiateCombatRequest: Encodable {
            let locationId: String
            let selectedLevel: Int

            enum CodingKeys: String, CodingKey {
                case locationId = "location_id"
                case selectedLevel = "selected_level"
            }
        }

        let request = InitiateCombatRequest(
            locationId: locationId,
            selectedLevel: selectedLevel
        )

        let response: CombatStartResponse = try await apiClient.post(
            endpoint: "/combat/start",
            body: request
        )

        // Convert CombatStartResponse to CombatSession
        // For now, create a basic session with the data we have
        // TODO: Update CombatSession model or protocol to better match API responses
        return CombatSession(
            sessionId: response.sessionId,
            playerId: "", // Not provided in start response
            enemyId: response.enemy.id,
            turnNumber: 0,
            currentTurnOwner: "player",
            status: .active,
            enemy: Enemy(
                id: response.enemy.id,
                name: response.enemy.name,
                level: response.enemy.level,
                stats: ItemStats(
                    atkPower: Double(response.enemy.atk),
                    atkAccuracy: 0, // Not provided in combat enemy
                    defPower: Double(response.enemy.def),
                    defAccuracy: 0 // Not provided in combat enemy
                ),
                specialAbilities: [],
                goldMin: 0,
                goldMax: 0,
                materialDropPool: []
            ),
            playerStats: ItemStats(
                atkPower: response.playerStats.atkPower,
                atkAccuracy: response.playerStats.atkAccuracy,
                defPower: response.playerStats.defPower,
                defAccuracy: response.playerStats.defAccuracy
            ),
            playerHp: response.playerStats.hp,
            enemyHp: Double(response.enemy.hp),
            expiresAt: nil
        )
    }

    func performAttack(sessionId: String, timingScore: Double) async throws -> CombatAction {
        struct AttackRequest: Encodable {
            let sessionId: String
            let attackAccuracy: Double

            enum CodingKeys: String, CodingKey {
                case sessionId = "session_id"
                case attackAccuracy = "attack_accuracy"
            }
        }

        struct AttackResponse: Decodable {
            let damageDealt: Double
            let playerHpRemaining: Double
            let enemyHpRemaining: Double
            let combatStatus: String

            enum CodingKeys: String, CodingKey {
                case damageDealt = "damage_dealt"
                case playerHpRemaining = "player_hp_remaining"
                case enemyHpRemaining = "enemy_hp_remaining"
                case combatStatus = "combat_status"
            }
        }

        let request = AttackRequest(
            sessionId: sessionId,
            attackAccuracy: timingScore
        )

        let response: AttackResult = try await apiClient.post(
            endpoint: "/combat/attack",
            body: request
        )

        return CombatAction(
            type: .attack,
            performerId: "player",
            damageDealt: response.damageDealt,
            result: response.combatStatus.rawValue
        )
    }

    func performDefense(sessionId: String, timingScore: Double) async throws -> CombatAction {
        struct DefenseRequest: Encodable {
            let sessionId: String
            let defenseAccuracy: Double

            enum CodingKeys: String, CodingKey {
                case sessionId = "session_id"
                case defenseAccuracy = "defense_accuracy"
            }
        }

        struct DefenseResponse: Decodable {
            let damageBlocked: Double
            let damageTaken: Double
            let playerHpRemaining: Double
            let combatStatus: String

            enum CodingKeys: String, CodingKey {
                case damageBlocked = "damage_blocked"
                case damageTaken = "damage_taken"
                case playerHpRemaining = "player_hp_remaining"
                case combatStatus = "combat_status"
            }
        }

        let request = DefenseRequest(
            sessionId: sessionId,
            defenseAccuracy: timingScore
        )

        let response: DefenseResult = try await apiClient.post(
            endpoint: "/combat/defend",
            body: request
        )

        return CombatAction(
            type: .defend,
            performerId: "player",
            damageDealt: response.damageTaken,
            result: response.combatStatus.rawValue
        )
    }

    func completeCombat(sessionId: String, won: Bool) async throws -> CombatRewards {
        struct CompleteCombatRequest: Encodable {
            let sessionId: String
            let result: String

            enum CodingKeys: String, CodingKey {
                case sessionId = "session_id"
                case result
            }
        }

        struct CompleteCombatResponse: Decodable {
            let result: String
            let rewards: CombatRewards
            let updatedBalance: UpdatedBalance

            enum CodingKeys: String, CodingKey {
                case result
                case rewards
                case updatedBalance = "updated_balance"
            }
        }

        struct UpdatedBalance: Decodable {
            let gold: Int
            let materials: [MaterialInventoryStack]
        }

        let request = CompleteCombatRequest(
            sessionId: sessionId,
            result: won ? "victory" : "defeat"
        )

        let response: CompleteCombatResponse = try await apiClient.post(
            endpoint: "/combat/complete",
            body: request
        )

        return response.rewards
    }

    func fetchCombatSession(sessionId: String) async throws -> CombatSession {
        let session: CombatSession = try await apiClient.get(
            endpoint: "/combat/session/\(sessionId)"
        )

        return session
    }

    func retreatCombat(sessionId: String) async throws -> (rewards: CombatRewards?, message: String) {
        struct RetreatRequest: Encodable {
            let sessionId: String
            let result: String

            enum CodingKeys: String, CodingKey {
                case sessionId = "session_id"
                case result
            }
        }

        struct RetreatResponse: Decodable {
            let result: String
            let rewards: CombatRewards?
            let message: String
        }

        let request = RetreatRequest(
            sessionId: sessionId,
            result: "retreat"
        )

        let response: RetreatResponse = try await apiClient.post(
            endpoint: "/combat/complete",
            body: request
        )

        return (rewards: response.rewards, message: response.message)
    }
}