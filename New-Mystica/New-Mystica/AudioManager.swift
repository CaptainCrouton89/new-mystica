//
//  AudioManager.swift
//  New-Mystica
//
//  Created by AI Assistant on 10/19/25.
//

import AVFoundation
import SwiftUI
import Combine

// MARK: - Audio Manager
@MainActor
class AudioManager: ObservableObject {
    static let shared = AudioManager()
    
    @Published var isEnabled: Bool = true
    private var audioPlayers: [String: AVAudioPlayer] = [:]
    private let audioSession = AVAudioSession.sharedInstance()
    
    private init() {
        setupAudioSession()
        preloadAudioFiles()
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
}

