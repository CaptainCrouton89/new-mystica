//
//  BattleView.swift
//  New-Mystica
//
//  Created by AI Assistant on 10/19/25.
//

import SwiftUI

struct BattleView: View, NavigableView {
    @EnvironmentObject private var navigationManager: NavigationManager
    @EnvironmentObject private var audioManager: AudioManager
    @State private var playerHealth: Double = 25.0
    @State private var enemyHealth: Double = 25.0
    @State private var playerMaxHealth: Double = 25.0
    @State private var enemyMaxHealth: Double = 25.0
    @State private var enemyName: String = "Shadow Wolf"
    @State private var enemyIcon: String = "pawprint.fill"
    
    // Animation states
    @State private var playerScale: CGFloat = 1.0
    @State private var enemyScale: CGFloat = 1.0
    
    // Combat state
    @State private var isPlayerTurn: Bool = true
    @State private var isDialSpinning: Bool = true
    @State private var dialRotation: Double = 0.0
    @State private var currentMultiplier: Double = 1.0
    @State private var combatMessage: String = ""
    @State private var showCombatMessage: Bool = false
    @State private var animationTimer: Timer?
    
    // Victory/Defeat popup states
    @State private var showVictoryPopup: Bool = false
    @State private var showDefeatPopup: Bool = false
    
    var navigationTitle: String { "Battle" }
    
    var body: some View {
        BaseView(title: navigationTitle) {
            ZStack {
                // Background
                Color.backgroundPrimary
                    .ignoresSafeArea()
                
                VStack(spacing: 0) {
                    // Top section - Enemy
                    enemySection
                        .frame(maxHeight: .infinity)
                    
                    Spacer(minLength: 20)
                    
                    // VS Indicator
                    vsIndicator
                    
                    Spacer(minLength: 20)
                    
                    // Bottom section - Player
                    playerSection
                        .frame(maxHeight: .infinity)
                    
                    Spacer(minLength: 20)
                    
                    // Combat Dial
                    combatDialSection
                        .frame(height: 120)
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 20)
                
                // Combat Message Overlay
                if showCombatMessage {
                    combatMessageOverlay
                }
                
                // Victory Popup
                if showVictoryPopup {
                    victoryPopup
                }
                
                // Defeat Popup
                if showDefeatPopup {
                    defeatPopup
                }
            }
        }
        .onAppear {
            configureWithEnemy(navigationManager.currentBattleEnemy)
            startIdleAnimations()
            startDialSpinning()
        }
        .onDisappear {
            // Clean up timer when view disappears
            animationTimer?.invalidate()
            animationTimer = nil
        }
    }
    
    // MARK: - Configuration Methods
    
    func configureWithEnemy(_ enemyType: String) {
        switch enemyType.lowercased() {
        case let type where type.contains("wolf"):
            enemyName = "Shadow Wolf"
            enemyIcon = "pawprint.fill"
            enemyMaxHealth = 25.0
            enemyHealth = 25.0
        case let type where type.contains("golem"):
            enemyName = "Ice Golem"
            enemyIcon = "cube.fill"
            enemyMaxHealth = 25.0
            enemyHealth = 25.0
        case let type where type.contains("dragon"):
            enemyName = "Fire Dragon"
            enemyIcon = "flame.fill"
            enemyMaxHealth = 25.0
            enemyHealth = 25.0
        case let type where type.contains("warrior"):
            enemyName = "Undead Warrior"
            enemyIcon = "figure.warfare"
            enemyMaxHealth = 25.0
            enemyHealth = 25.0
        case let type where type.contains("spirit"):
            enemyName = "Forest Spirit"
            enemyIcon = "leaf.fill"
            enemyMaxHealth = 25.0
            enemyHealth = 25.0
        default:
            enemyName = enemyType
            enemyIcon = "exclamationmark.triangle.fill"
            enemyMaxHealth = 25.0
            enemyHealth = 25.0
        }
    }
    
    // MARK: - Enemy Section
    @ViewBuilder
    private var enemySection: some View {
        VStack(spacing: 16) {
            // Enemy Health Bar
            healthBarView(
                currentHealth: enemyHealth,
                maxHealth: enemyMaxHealth,
                label: enemyName,
                isPlayer: false
            )
            
            // Enemy Avatar
            avatarView(
                iconName: enemyIcon,
                scale: enemyScale,
                isPlayer: false
            )
        }
    }
    
    // MARK: - VS Indicator
    @ViewBuilder
    private var vsIndicator: some View {
        ZStack {
            Circle()
                .fill(Color.backgroundCard)
                .frame(width: 60, height: 60)
                .overlay(
                    Circle()
                        .stroke(Color.accentSecondary, lineWidth: 2)
                )
                .shadow(color: .black.opacity(0.3), radius: 4, x: 0, y: 2)
            
            TitleText("VS", size: 18)
                .foregroundColor(Color.accentSecondary)
        }
    }
    
    // MARK: - Player Section
    @ViewBuilder
    private var playerSection: some View {
        VStack(spacing: 16) {
            // Player Avatar
            avatarView(
                iconName: "person.fill",
                scale: playerScale,
                isPlayer: true
            )
            
            // Player Health Bar
            healthBarView(
                currentHealth: playerHealth,
                maxHealth: playerMaxHealth,
                label: "You",
                isPlayer: true
            )
        }
    }
    
    // MARK: - Health Bar Component
    @ViewBuilder
    private func healthBarView(
        currentHealth: Double,
        maxHealth: Double,
        label: String,
        isPlayer: Bool
    ) -> some View {
        VStack(spacing: 8) {
            // Health Label
            NormalText(label, size: 16)
                .foregroundColor(Color.textPrimary)
            
            // Health Bar Container
            ZStack(alignment: .leading) {
                // Background
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color.backgroundCard)
                    .frame(height: 20)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color.borderSubtle, lineWidth: 1)
                    )
                
                // Health Fill
                RoundedRectangle(cornerRadius: 8)
                    .fill(healthBarColor(for: currentHealth, maxHealth: maxHealth))
                    .frame(width: max(0, healthBarWidth(for: currentHealth, maxHealth: maxHealth)), height: 20)
                    .animation(.easeInOut(duration: 0.3), value: currentHealth)
                
                // Health Text
                HStack {
                    Spacer()
                    NormalText("\(Int(currentHealth))/\(Int(maxHealth))", size: 12)
                        .foregroundColor(Color.textPrimary)
                    Spacer()
                }
            }
            .frame(width: 200)
        }
    }
    
    // MARK: - Avatar Component
    @ViewBuilder
    private func avatarView(
        iconName: String,
        scale: CGFloat,
        isPlayer: Bool
    ) -> some View {
        ZStack {
            // Avatar Background
            Circle()
                .fill(Color.backgroundCard)
                .frame(width: 120, height: 120)
                .overlay(
                    Circle()
                        .stroke(isPlayer ? Color.accentSecondary : Color.accent, lineWidth: 3)
                )
                .shadow(color: .black.opacity(0.3), radius: 8, x: 0, y: 4)
            
            // Avatar Icon
            Image(systemName: iconName)
                .font(.system(size: 48, weight: .medium))
                .foregroundColor(isPlayer ? Color.accentSecondary : Color.accent)
        }
        .scaleEffect(scale)
    }
    
    // MARK: - Combat Dial Section
    @ViewBuilder
    private var combatDialSection: some View {
        VStack(spacing: 12) {
            // Turn indicator
            NormalText(isPlayerTurn ? "Your Turn - Click to Attack!" : "Enemy Turn - Click to Defend!", size: 14)
                .foregroundColor(Color.accentSecondary)
                .multilineTextAlignment(.center)
            
            // Dial
            ZStack {
                // Dial background circle
                Circle()
                    .fill(Color.backgroundCard)
                    .frame(width: 80, height: 80)
                    .overlay(
                        Circle()
                            .stroke(Color.accentSecondary, lineWidth: 3)
                    )
                    .shadow(color: .black.opacity(0.3), radius: 4, x: 0, y: 2)
                
                // Dial pointer
                Rectangle()
                    .fill(Color.accentSecondary)
                    .frame(width: 3, height: 30)
                    .offset(y: -15)
                    .rotationEffect(.degrees(dialRotation))
                
                // Center dot
                Circle()
                    .fill(Color.accentSecondary)
                    .frame(width: 8, height: 8)
            }
            .onTapGesture {
                stopDialAndExecuteAction()
            }
            
            // Multiplier display
            if !isDialSpinning {
                NormalText("Multiplier: \(String(format: "%.1f", currentMultiplier))x", size: 12)
                    .foregroundColor(Color.textPrimary)
            }
        }
    }
    
    // MARK: - Combat Message Overlay
    @ViewBuilder
    private var combatMessageOverlay: some View {
        VStack {
            Spacer()
            
            VStack(spacing: 8) {
                NormalText(combatMessage, size: 16)
                    .foregroundColor(Color.accentSecondary)
                    .multilineTextAlignment(.center)
                    .padding()
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(Color.backgroundCard)
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(Color.accentSecondary, lineWidth: 2)
                            )
                    )
            }
            .padding(.horizontal, 40)
            .padding(.bottom, 200)
            
            Spacer()
        }
        .background(Color.black.opacity(0.3))
        .onTapGesture {
            hideCombatMessage()
        }
    }
    
    // MARK: - Victory Popup
    @ViewBuilder
    private var victoryPopup: some View {
        ActionPopup(
            title: "Victory!",
            imageName: "crown.fill",
            description: "You have defeated the \(enemyName)!",
            buttonText: "Claim Rewards",
            isPresented: $showVictoryPopup,
            onAction: {
                claimVictoryRewards()
            }
        )
    }
    
    // MARK: - Defeat Popup
    @ViewBuilder
    private var defeatPopup: some View {
        ActionPopup(
            title: "Defeat",
            imageName: "exclamationmark.triangle.fill",
            description: "You have been defeated by the \(enemyName).",
            buttonText: "Return to Map",
            isPresented: $showDefeatPopup,
            onAction: {
                returnToMap()
            }
        )
    }
    
    // MARK: - Helper Functions
    
    private func healthBarColor(for currentHealth: Double, maxHealth: Double) -> Color {
        let healthPercentage = currentHealth / maxHealth
        
        if healthPercentage > 0.6 {
            return Color.green
        } else if healthPercentage > 0.3 {
            return Color.orange
        } else {
            return Color.red
        }
    }
    
    private func healthBarWidth(for currentHealth: Double, maxHealth: Double) -> CGFloat {
        let healthPercentage = max(0, min(1, currentHealth / maxHealth))
        return 200 * healthPercentage
    }
    
    private func startIdleAnimations() {
        // Player idle animation
        withAnimation(
            .easeInOut(duration: 2.0)
            .repeatForever(autoreverses: true)
        ) {
            playerScale = 1.05
        }
        
        // Enemy idle animation (offset by 1 second)
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            withAnimation(
                .easeInOut(duration: 2.0)
                .repeatForever(autoreverses: true)
            ) {
                enemyScale = 1.05
            }
        }
    }
    
    // MARK: - Combat Logic
    
    private func startDialSpinning() {
        // Stop any existing timer
        animationTimer?.invalidate()
        animationTimer = nil
        
        isDialSpinning = true
        
        // Start timer-based animation for smooth continuous rotation
        animationTimer = Timer.scheduledTimer(withTimeInterval: 0.016, repeats: true) { _ in
            if self.isDialSpinning {
                withAnimation(.linear(duration: 0.016)) {
                    self.dialRotation += 5.76 // 360 degrees per second (360/60fps)
                }
            }
        }
    }
    
    private func stopDialAndExecuteAction() {
        guard isDialSpinning else { return }
        
        // Stop the dial animation immediately
        isDialSpinning = false
        
        // Stop the timer
        animationTimer?.invalidate()
        animationTimer = nil
        
        // Calculate multiplier based on current dial position
        let normalizedRotation = dialRotation.truncatingRemainder(dividingBy: 360)
        let adjustedRotation = normalizedRotation < 0 ? normalizedRotation + 360 : normalizedRotation
        currentMultiplier = calculateMultiplier(from: adjustedRotation)
        
        // Execute action based on turn
        if isPlayerTurn {
            executePlayerAttack()
        } else {
            executeEnemyAttack()
        }
    }
    
    private func calculateMultiplier(from rotation: Double) -> Double {
        // Map rotation to multiplier (0.5x to 2.0x)
        // Top of circle (0 degrees) = 2.0x multiplier
        // Bottom of circle (180 degrees) = 0.5x multiplier
        let normalizedAngle = rotation / 360.0
        let multiplier = 2.0 - (normalizedAngle * 1.5) // Range: 2.0 to 0.5
        return max(0.5, min(2.0, multiplier))
    }
    
    private func executePlayerAttack() {
        let baseDamage = Double.random(in: 1...10)
        let totalDamage = baseDamage * currentMultiplier
        
        enemyHealth = max(0, enemyHealth - totalDamage)
        
        // Check if enemy is defeated
        if enemyHealth <= 0 {
            audioManager.playVictory()
            showVictoryPopup = true
            return
        }
        
        // Play damage dealing audio
        audioManager.playDealDamage()
        
        // Show damage dealt message for non-fatal attacks
        combatMessage = "You dealt \(String(format: "%.1f", totalDamage)) damage!"
        showCombatMessage = true
        
        // Switch to enemy turn after 2.4 second delay
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.4) {
            switchToEnemyTurn()
        }
    }
    
    private func executeEnemyAttack() {
        let baseDamage = Double.random(in: 1...10)
        let defendedDamage = (baseDamage * currentMultiplier) / 2.0 // Defense reduces damage
        
        playerHealth = max(0, playerHealth - defendedDamage)
        
        // Check if player is defeated
        if playerHealth <= 0 {
            audioManager.playDefeat()
            showDefeatPopup = true
            return
        }
        
        // Play damage receiving audio
        audioManager.playTakeDamage()
        
        // Show damage dealt message for non-fatal attacks
        combatMessage = "Enemy dealt \(String(format: "%.1f", defendedDamage)) damage! (Defended: \(String(format: "%.1f", currentMultiplier))x)"
        showCombatMessage = true
        
        // Switch to player turn after 2.4 second delay
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.4) {
            switchToPlayerTurn()
        }
    }
    
    private func switchToEnemyTurn() {
        hideCombatMessage()
        isPlayerTurn = false
        startDialSpinning()
    }
    
    private func switchToPlayerTurn() {
        hideCombatMessage()
        isPlayerTurn = true
        startDialSpinning()
    }
    
    private func hideCombatMessage() {
        showCombatMessage = false
    }
    
    private func claimVictoryRewards() {
        // Play reward claiming audio
        audioManager.playReward()
        
        // TODO: Implement reward claiming logic
        // For now, just return to map
        navigationManager.navigateTo(.map)
    }
    
    private func returnToMap() {
        navigationManager.navigateTo(.map)
    }
}

// MARK: - Battle Location Data Extension
extension BattleLocation {
    func toBattleView() -> BattleView {
        return BattleView()
    }
}

#Preview {
    BattleView()
        .environmentObject(NavigationManager())
}
