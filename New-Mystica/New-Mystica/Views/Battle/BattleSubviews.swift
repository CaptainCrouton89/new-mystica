import SwiftUI

// MARK: - Battle View Components

extension BattleView {

    // MARK: - Combat Content View
    func combatContentView(session: CombatSession) -> some View {
        VStack(spacing: 0) {
            // Enemy Section
            enemySection(enemy: convertCombatEnemyToEnemy(session.enemy), hp: Double(viewModel.enemyHP), maxHP: Int(session.enemy.hp))
                .frame(maxHeight: .infinity)

            Spacer(minLength: 20)

            // Player Section
            playerSection(session: session)
                .frame(maxHeight: .infinity)

            Spacer(minLength: 20)

            // Combat Controls
            combatControlsSection(session: session)
                .frame(height: 160)
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 20)
        .onAppear {
            startIdleAnimations()
        }
    }

    // MARK: - Rewards Overlay
    func rewardsOverlay(rewards: Loadable<CombatRewards>) -> some View {
        ZStack {
            Color.black.opacity(0.8)
                .edgesIgnoringSafeArea(.all)

            LoadableView(rewards) { rewardData in
                VStack(spacing: 20) {
                    TitleText(viewModel.playerWon ? "Victory!" : "Defeat", size: 28)
                        .foregroundColor(viewModel.playerWon ? Color.accent : Color.red)
                        .onAppear {
                            // Trigger victory/defeat audio when rewards overlay appears
                            triggerCombatEndAudio(won: viewModel.playerWon, audioManager: audioManager)
                        }

                    if viewModel.playerWon {
                        victoryRewardsView(rewardData)
                    } else {
                        defeatMessageView()
                    }

                    TextButton("Continue") {
                        Task {
                            // Play reward claim audio if victory
                            if viewModel.playerWon {
                                audioManager.playReward()
                            }
                            await viewModel.claimRewards()
                            // Clear the active session from AppState
                            appState.activeCombatSession = .loaded(nil)
                            navigationManager.resetToMap()
                        }
                    }
                    .frame(maxWidth: 200)
                }
                .padding(32)
                .background(
                    RoundedRectangle(cornerRadius: 16)
                        .fill(Color.backgroundCard)
                        .overlay(
                            RoundedRectangle(cornerRadius: 16)
                                .stroke(Color.borderSubtle, lineWidth: 1)
                        )
                )
                .shadow(color: Color.black.opacity(0.3), radius: 20, x: 0, y: 10)
            } retry: {
                // Rewards should not need retry, but provide for consistency
            }
        }
    }

    func victoryRewardsView(_ rewards: CombatRewards) -> some View {
        VStack(spacing: 16) {
            NormalText("Rewards Earned:", size: 18)
                .foregroundColor(Color.textPrimary)

            VStack(spacing: 8) {
                HStack {
                    Image(systemName: "dollarsign.circle.fill")
                        .foregroundColor(Color.accent)
                    NormalText("Gold: \(rewards.currencies.gold)")
                        .foregroundColor(Color.textSecondary)
                    Spacer()
                }

                if let experience = rewards.experience {
                    HStack {
                        Image(systemName: "star.fill")
                            .foregroundColor(Color.accentSecondary)
                        NormalText("Experience: \(experience)")
                            .foregroundColor(Color.textSecondary)
                        Spacer()
                    }
                }

                if let items = rewards.items, !items.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Image(systemName: "gift.fill")
                                .foregroundColor(Color.accent)
                            NormalText("Items:")
                                .foregroundColor(Color.textSecondary)
                            Spacer()
                        }

                        ForEach(Array(items.enumerated()), id: \.element.id) { _, item in
                            HStack {
                                SmallText("• \(item.name)")
                                    .foregroundColor(Color.textSecondary)
                                Spacer()
                            }
                            .padding(.leading, 24)
                        }
                    }
                }

                if let materials = rewards.materials, !materials.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Image(systemName: "cube.fill")
                                .foregroundColor(Color.accentSecondary)
                            NormalText("Materials:")
                                .foregroundColor(Color.textSecondary)
                            Spacer()
                        }

                        ForEach(Array(materials.enumerated()), id: \.element.materialId) { _, material in
                            HStack {
                                SmallText("• \(material.name) [\(material.styleName)]")
                                    .foregroundColor(Color.textSecondary)
                                Spacer()
                            }
                            .padding(.leading, 24)
                        }
                    }
                }
            }
        }
    }

    func defeatMessageView() -> some View {
        VStack(spacing: 12) {
            NormalText("Better luck next time!", size: 18)
                .foregroundColor(Color.textSecondary)
                .multilineTextAlignment(.center)

            SmallText("Train harder and come back stronger.")
                .foregroundColor(Color.textSecondary)
                .multilineTextAlignment(.center)
        }
    }

    // MARK: - Enemy Section
    func enemySection(enemy: Enemy, hp: Double, maxHP: Int) -> some View {
        VStack(spacing: 16) {
            // Enemy Health Bar
            HealthBarView(
                currentHealth: hp,
                maxHealth: Double(maxHP), // Max HP from backend combat session
                label: enemy.name ?? "Unknown Enemy",
                isPlayer: false
            )

            // Enemy Avatar with glow effect and shake animation
            EnemyAvatarView(
                enemy: enemy,
                scale: enemyScale
            )
            .offset(x: enemyOffset.x, y: enemyOffset.y)
            .shadow(color: enemyGlowing ? .red : .clear, radius: enemyGlowing ? 20 : 0)
            .animation(.easeInOut(duration: 0.5), value: enemyGlowing)
            .animation(.easeInOut(duration: 0.2), value: enemyOffset)
        }
    }


    // MARK: - Player Section
    func playerSection(session: CombatSession) -> some View {
        VStack(spacing: 16) {
            // Player Avatar with shield overlay
            ZStack {
                PlayerAvatarView(scale: playerScale)
                    .offset(x: playerOffset.x, y: playerOffset.y)
                    .animation(.easeInOut(duration: 0.2), value: playerOffset)

                // Shield visual during defense
                if showShield {
                    Image(systemName: "shield.fill")
                        .foregroundColor(shieldColor)
                        .font(.system(size: 40))
                        .scaleEffect(showShield ? 1.2 : 0.8)
                        .opacity(showShield ? 0.8 : 0)
                        .animation(.easeInOut(duration: 0.2), value: showShield)
                }
            }

            // Player Health Bar
            HealthBarView(
                currentHealth: Double(viewModel.currentHP),
                maxHealth: session.playerStats.hp, // Max HP from backend player stats
                label: "You",
                isPlayer: true
            )
        }
    }

    // MARK: - Combat Controls Section
    func combatControlsSection(session: CombatSession) -> some View {
        VStack(spacing: 16) {
            // Phase-specific status display
            phaseStatusView(session: session)

            if !viewModel.combatEnded {
                // Turn-based combat with timing dial
                combatPhaseView(session: session)
            } else {
                // Combat ended - show retreat option or wait for rewards
                if case .idle = viewModel.rewards {
                    TextButton("End Combat") {
                        Task {
                            await viewModel.endCombat(won: viewModel.playerWon)
                        }
                    }
                    .frame(maxWidth: 200)
                }
            }
        }
    }

    // MARK: - Phase Status View
    func phaseStatusView(session: CombatSession) -> some View {
        VStack(spacing: 8) {
            if viewModel.isLoading {
                NormalText("Processing action...", size: 14)
                    .foregroundColor(Color.textSecondary)
            } else if viewModel.combatEnded {
                NormalText(viewModel.playerWon ? "Victory!" : "Defeat!", size: 16)
                    .foregroundColor(viewModel.playerWon ? Color.accent : Color.red)
                    .bold()
            } else {
                switch currentPhase {
                case .playerAttack:
                    NormalText("Tap the dial to attack!", size: 14)
                        .foregroundColor(Color.accent)
                case .playerDefense:
                    NormalText("Tap the dial to defend!", size: 14)
                        .foregroundColor(Color.accentSecondary)
                }
            }

            // Defense prompt overlay
            if showDefensePrompt {
                TitleText("DEFEND NOW!", size: 36)
                    .foregroundColor(Color.red)
                    .bold()
                    .transition(.asymmetric(
                        insertion: .move(edge: .top).combined(with: .opacity),
                        removal: .opacity
                    ))
                    .scaleEffect(showDefensePrompt ? 1.1 : 1.0)
                    .animation(.easeInOut(duration: 0.3).repeatCount(2, autoreverses: true), value: showDefensePrompt)
            }
        }
    }

    // MARK: - Combat Phase View
    func combatPhaseView(session: CombatSession) -> some View {
        VStack(spacing: 16) {
            // Show timing dial when dialVisible is true (removed phase condition that caused disappearance)
            if dialVisible {
                // Get zone sizing based on phase
                let adjustedBands = getAdjustedBands(for: currentPhase, session: session)

                TimingDialView(
                    dialRotation: $dialRotation,
                    isDialSpinning: $isDialSpinning,
                    adjustedBands: adjustedBands,
                    spinSpeed: Double(session.weaponConfig.spinDegPerS),
                    onTap: { degrees in
                        handleDialTap(degrees: degrees)
                    }
                )
            } else {
                // Spacer to maintain layout when dial is hidden
                Rectangle()
                    .fill(Color.clear)
                    .frame(height: 200)
            }
        }
    }
}
