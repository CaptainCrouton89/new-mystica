//
//  AnimationStateManager.swift
//  New-Mystica
//
//  Created by AI Assistant on 1/25/25.
//

import Foundation
import SpriteKit
import Combine

/**
 * AnimationStateManager - Manages pause/resume functionality for side-by-side animations
 * Handles idle animation pausing during attack animations
 */
class AnimationStateManager: ObservableObject {
    
    // MARK: - Published Properties
    
    @Published var isIdlePaused: Bool = false
    @Published var isAttackPlaying: Bool = false
    
    // MARK: - Private Properties
    
    private var idleSpriteNode: SKSpriteNode?
    private var attackSpriteNode: SKSpriteNode?
    
    // MARK: - Initialization
    
    init() {}
    
    // MARK: - Public Methods
    
    /**
     * Set the idle sprite node to manage
     * 
     * - Parameter spriteNode: The SKSpriteNode for idle animation
     */
    func setIdleSpriteNode(_ spriteNode: SKSpriteNode) {
        self.idleSpriteNode = spriteNode
    }
    
    /**
     * Set the attack sprite node to manage
     * 
     * - Parameter spriteNode: The SKSpriteNode for attack animation
     */
    func setAttackSpriteNode(_ spriteNode: SKSpriteNode) {
        self.attackSpriteNode = spriteNode
    }
    
    /**
     * Trigger an attack animation
     * This will pause the idle animation and play the attack animation
     */
    func triggerAttack() {
        guard !isAttackPlaying else {
            return
        }
        
        
        // Pause idle animation
        isIdlePaused = true
        
        // Start attack animation
        isAttackPlaying = true
        
        // Notify UI of changes
        DispatchQueue.main.async {
            self.objectWillChange.send()
        }
    }
    
    /**
     * Called when attack animation completes
     * This will resume the idle animation
     */
    func onAttackCompleted() {
        
        // Stop attack animation
        isAttackPlaying = false
        
        // Resume idle animation
        isIdlePaused = false
        
        // Notify UI of changes
        DispatchQueue.main.async {
            self.objectWillChange.send()
        }
    }
    
}

// MARK: - Sprite Animation Configuration (Legacy - kept for compatibility)

struct SpriteAnimationConfig {
    let type: String
    let frameRate: Double
    let priority: Int // Higher priority can interrupt lower priority
    let shouldLoop: Bool // Whether this animation should loop continuously
}

