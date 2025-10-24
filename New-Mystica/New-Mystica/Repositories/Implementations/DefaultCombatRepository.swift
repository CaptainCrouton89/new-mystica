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

        // Direct response mapping - no conversion needed
        let response: CombatSession = try await apiClient.post(
            endpoint: "/combat/start",
            body: request
        )

        return response
    }

    func performAttack(sessionId: String, tapPositionDegrees: Float) async throws -> CombatAction {
        struct AttackRequest: Encodable {
            let sessionId: String
            let tapPositionDegrees: Float

            enum CodingKeys: String, CodingKey {
                case sessionId = "session_id"
                case tapPositionDegrees = "tap_position_degrees"
            }
        }

        let request = AttackRequest(
            sessionId: sessionId,
            tapPositionDegrees: tapPositionDegrees
        )

        let response: AttackResult = try await apiClient.post(
            endpoint: "/combat/attack",
            body: request
        )

        return CombatAction(
            type: .attack,
            performerId: "player",
            damageDealt: response.damageDealt,
            result: response.combatStatus,
            hitZone: response.hitZone,
            damageBlocked: nil
        )
    }

    func performDefense(sessionId: String, tapPositionDegrees: Float) async throws -> CombatAction {
        struct DefenseRequest: Encodable {
            let sessionId: String
            let tapPositionDegrees: Float

            enum CodingKeys: String, CodingKey {
                case sessionId = "session_id"
                case tapPositionDegrees = "tap_position_degrees"
            }
        }

        let request = DefenseRequest(
            sessionId: sessionId,
            tapPositionDegrees: tapPositionDegrees
        )

        let response: DefenseResult = try await apiClient.post(
            endpoint: "/combat/defend",
            body: request
        )

        return CombatAction(
            type: .defend,
            performerId: "player",
            damageDealt: response.damageTaken,
            result: response.combatStatus,
            hitZone: nil, // Defense doesn't have hit zones like attack
            damageBlocked: response.damageBlocked
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

        let request = CompleteCombatRequest(
            sessionId: sessionId,
            result: won ? "victory" : "defeat"
        )

        // Direct response mapping - CombatRewards now matches backend response
        let response: CombatRewards = try await apiClient.post(
            endpoint: "/combat/complete",
            body: request
        )

        return response
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

    func getUserActiveSession() async throws -> CombatSession? {
        struct ActiveSessionResponse: Decodable {
            let session: CombatSession?
        }

        let response: ActiveSessionResponse = try await apiClient.get(
            endpoint: "/combat/active-session"
        )

        return response.session
    }

    func abandonCombat(sessionId: String) async throws {
        struct AbandonRequest: Encodable {
            let sessionId: String

            enum CodingKeys: String, CodingKey {
                case sessionId = "session_id"
            }
        }

        struct AbandonResponse: Decodable {
            let message: String
        }

        let request = AbandonRequest(sessionId: sessionId)

        let _: AbandonResponse = try await apiClient.post(
            endpoint: "/combat/abandon",
            body: request
        )
    }
}