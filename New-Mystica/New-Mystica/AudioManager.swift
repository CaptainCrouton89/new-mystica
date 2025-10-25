import AVFoundation
import SwiftUI
import Combine

// MARK: - Audio Manager
@MainActor
class AudioManager: ObservableObject {
    static let shared = AudioManager()

    @Published var isEnabled: Bool = true
    private var audioPlayers: [String: AVAudioPlayer] = [:]
    private var backgroundMusicPlayer: AVAudioPlayer?
    private var battleMusicPlayer: AVAudioPlayer?
    private let audioSession = AVAudioSession.sharedInstance()

    private init() {
        setupAudioSession()
        preloadAudioFiles()
        loadBackgroundMusic()
        loadBattleMusic()
    }
    
    // MARK: - Audio Session Setup
    
    private func setupAudioSession() {
        do {
            try audioSession.setCategory(.playback, mode: .default, options: [.mixWithOthers])
            try audioSession.setActive(true)
        } catch {
            print("❌ [AUDIO] Failed to setup audio session: \(error)")
        }
    }
    
    // MARK: - Audio File Loading
    
    private func preloadAudioFiles() {
        let audioFiles = [
            "standard_button_click": "standard button click",
            "back_button_click": "back button click", 
            "cancel": "cancel",
            "map_icon_click": "map icon click",
            "to_battle": "to battle",
            "victory": "victory",
            "defeat": "defeat",
            "deal_damage": "deal damage",
            "take_damage": "take damage",
            "reward": "reward"
        ]
        
        for (key, fileName) in audioFiles {
            loadAudioFile(key: key, fileName: fileName)
        }
    }
    
    private func loadAudioFile(key: String, fileName: String) {
        // Try different possible locations for the audio files
        let possiblePaths = [
            "Audio/\(fileName)", // In Audio subfolder (preferred)
            fileName, // Direct file name
            "Assets.xcassets/Audio/\(fileName)" // In Assets.xcassets/Audio
        ]

        var audioURL: URL?
        for path in possiblePaths {
            if let url = Bundle.main.url(forResource: path, withExtension: "mp3") {
                audioURL = url
                break
            }
        }

        guard let url = audioURL else {
            print("❌ [AUDIO] Could not find audio file: \(fileName).mp3")
            return
        }

        do {
            let player = try AVAudioPlayer(contentsOf: url)
            player.prepareToPlay()
            player.volume = 0.8
            audioPlayers[key] = player
        } catch {
            print("❌ [AUDIO] Failed to load audio file \(fileName): \(error)")
        }
    }
    
    // MARK: - Audio Playback Methods
    
    /// Play audio for menu button clicks
    func playMenuButtonClick() {
        playAudio(key: "standard_button_click")
    }
    
    /// Play audio for back button clicks
    func playBackButtonClick() {
        playAudio(key: "back_button_click")
    }
    
    /// Play audio for close/cancel button clicks
    func playCancelClick() {
        playAudio(key: "cancel")
    }
    
    /// Play audio for map icon clicks
    func playMapIconClick() {
        playAudio(key: "map_icon_click")
    }
    
    /// Play audio for battle button clicks
    func playBattleClick() {
        playAudio(key: "to_battle")
    }
    
    /// Play audio for victory
    func playVictory() {
        playAudio(key: "victory")
    }
    
    /// Play audio for defeat
    func playDefeat() {
        playAudio(key: "defeat")
    }
    
    /// Play audio for dealing damage
    func playDealDamage() {
        playAudio(key: "deal_damage")
    }
    
    /// Play audio for taking damage
    func playTakeDamage() {
        playAudio(key: "take_damage")
    }
    
    /// Play audio for claiming rewards
    func playReward() {
        playAudio(key: "reward")
    }
    
    // MARK: - Generic Audio Playback
    
    private func playAudio(key: String) {
        guard isEnabled else { return }

        guard let player = audioPlayers[key] else {
            print("⚠️ [AUDIO] No audio player found for key: \(key)")
            return
        }

        // Stop any current playback and reset to beginning
        player.stop()
        player.currentTime = 0
        player.play()
    }
    
    // MARK: - Audio Control
    
    func toggleAudio() {
        isEnabled.toggle()
    }
    
    func enableAudio() {
        isEnabled = true
    }
    
    func disableAudio() {
        isEnabled = false
    }
    
    // MARK: - Volume Control
    
    func setVolume(_ volume: Float, for key: String? = nil) {
        let clampedVolume = max(0.0, min(1.0, volume))
        
        if let key = key {
            // Set volume for specific audio
            audioPlayers[key]?.volume = clampedVolume
        } else {
            // Set volume for all audio
            for player in audioPlayers.values {
                player.volume = clampedVolume
            }
        }
    }
    
    // MARK: - Audio State Management

    func stopAllAudio() {
        for player in audioPlayers.values {
            player.stop()
            player.currentTime = 0
        }
    }

    func pauseAllAudio() {
        for player in audioPlayers.values {
            player.pause()
        }
    }

    func resumeAllAudio() {
        for player in audioPlayers.values {
            player.play()
        }
    }

    // MARK: - Background Music

    private func loadBackgroundMusic() {
        // Load MainMenu audio from Assets.xcassets dataset
        guard let asset = NSDataAsset(name: "MainMenu") else {
            print("❌ [AUDIO] Could not find MainMenu dataset in Assets.xcassets")
            return
        }

        do {
            let player = try AVAudioPlayer(data: asset.data)
            player.numberOfLoops = -1 // Loop infinitely
            player.volume = 0.5
            player.prepareToPlay()
            backgroundMusicPlayer = player
            print("✅ [AUDIO] Successfully loaded MainMenu background music")
        } catch {
            print("❌ [AUDIO] Failed to load background music: \(error)")
        }
    }

    func playBackgroundMusic() {
        guard isEnabled else {
            print("⚠️ [AUDIO] Background music playback skipped - audio disabled")
            return
        }

        if backgroundMusicPlayer == nil {
            print("❌ [AUDIO] Background music player not initialized")
            return
        }

        backgroundMusicPlayer?.play()
        print("🎵 [AUDIO] Playing background music")
    }

    func pauseBackgroundMusic() {
        backgroundMusicPlayer?.pause()
    }

    func stopBackgroundMusic() {
        backgroundMusicPlayer?.stop()
        backgroundMusicPlayer?.currentTime = 0
    }

    func setBackgroundMusicVolume(_ volume: Float) {
        let clampedVolume = max(0.0, min(1.0, volume))
        backgroundMusicPlayer?.volume = clampedVolume
    }

    // MARK: - Battle Music

    private func loadBattleMusic() {
        // Load Battle audio from Assets.xcassets dataset
        guard let asset = NSDataAsset(name: "Battle") else {
            print("❌ [AUDIO] Could not find Battle dataset in Assets.xcassets")
            return
        }

        do {
            let player = try AVAudioPlayer(data: asset.data)
            player.numberOfLoops = -1 // Loop infinitely
            player.volume = 0.5
            player.prepareToPlay()
            battleMusicPlayer = player
            print("✅ [AUDIO] Successfully loaded Battle background music")
        } catch {
            print("❌ [AUDIO] Failed to load battle music: \(error)")
        }
    }

    func playBattleMusic() {
        guard isEnabled else {
            print("⚠️ [AUDIO] Battle music playback skipped - audio disabled")
            return
        }

        if battleMusicPlayer == nil {
            print("❌ [AUDIO] Battle music player not initialized")
            return
        }

        battleMusicPlayer?.play()
        print("🎵 [AUDIO] Playing battle music")
    }

    func pauseBattleMusic() {
        battleMusicPlayer?.pause()
    }

    func stopBattleMusic() {
        battleMusicPlayer?.stop()
        battleMusicPlayer?.currentTime = 0
    }

    func setBattleMusicVolume(_ volume: Float) {
        let clampedVolume = max(0.0, min(1.0, volume))
        battleMusicPlayer?.volume = clampedVolume
    }

    // MARK: - Crossfade

    /// Crossfade from background music to battle music
    func crossfadeToBattleMusic(duration: TimeInterval = 2.0) {
        guard isEnabled else {
            print("⚠️ [AUDIO] Crossfade skipped - audio disabled")
            return
        }

        guard let battlePlayer = battleMusicPlayer else {
            print("❌ [AUDIO] Battle music player not initialized")
            return
        }

        // Start battle music at 0 volume
        battlePlayer.volume = 0.0
        battlePlayer.play()

        // Perform crossfade
        let steps = 60
        let stepDuration = duration / Double(steps)
        let volumeIncrement = 0.5 / Float(steps) // Target volume: 0.5

        Task {
            for step in 0..<steps {
                try? await Task.sleep(nanoseconds: UInt64(stepDuration * 1_000_000_000))
                await MainActor.run {
                    // Fade out background music
                    if let bgPlayer = backgroundMusicPlayer {
                        bgPlayer.volume = max(0.0, 0.5 - (Float(step + 1) * volumeIncrement))
                    }
                    // Fade in battle music
                    battlePlayer.volume = Float(step + 1) * volumeIncrement
                }
            }

            await MainActor.run {
                backgroundMusicPlayer?.pause()
                backgroundMusicPlayer?.volume = 0.5 // Reset for next time
                print("✅ [AUDIO] Crossfade to battle music complete")
            }
        }
    }

    /// Crossfade from battle music to background music
    func crossfadeToBackgroundMusic(duration: TimeInterval = 2.0) {
        guard isEnabled else {
            print("⚠️ [AUDIO] Crossfade skipped - audio disabled")
            return
        }

        guard let bgPlayer = backgroundMusicPlayer else {
            print("❌ [AUDIO] Background music player not initialized")
            return
        }

        // Start background music at 0 volume
        bgPlayer.volume = 0.0
        bgPlayer.play()

        // Perform crossfade
        let steps = 60
        let stepDuration = duration / Double(steps)
        let volumeIncrement = 0.5 / Float(steps) // Target volume: 0.5

        Task {
            for step in 0..<steps {
                try? await Task.sleep(nanoseconds: UInt64(stepDuration * 1_000_000_000))
                await MainActor.run {
                    // Fade out battle music
                    if let battlePlayer = battleMusicPlayer {
                        battlePlayer.volume = max(0.0, 0.5 - (Float(step + 1) * volumeIncrement))
                    }
                    // Fade in background music
                    bgPlayer.volume = Float(step + 1) * volumeIncrement
                }
            }

            await MainActor.run {
                battleMusicPlayer?.stop()
                battleMusicPlayer?.currentTime = 0
                battleMusicPlayer?.volume = 0.5 // Reset for next time
                print("✅ [AUDIO] Crossfade to background music complete")
            }
        }
    }
}

