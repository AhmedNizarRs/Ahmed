import AVFoundation
import UIKit

/// Plays Vigil's sound effects and the gothic voice.
@MainActor
final class SoundBoard: NSObject, ObservableObject {
    static let shared = SoundBoard()

    enum Effect: String {
        case toll, ring, drone, complete, tap, extinguish, hangup, answer
    }

    var enabled = true
    var voiceEnabled = true
    @Published private(set) var spokenLine: Int?
    @Published private(set) var isSpeaking = false

    private var players: [Effect: AVAudioPlayer] = [:]
    private let synthesizer = AVSpeechSynthesizer()
    private var lineForUtterance: [ObjectIdentifier: Int] = [:]
    private var onFinished: (() -> Void)?

    override init() {
        super.init()
        synthesizer.delegate = self
        configureSession(forCall: false)
    }

    /// Calls play even with the Silent switch on; UI sounds mix with other audio.
    func configureSession(forCall: Bool) {
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, mode: forCall ? .spokenAudio : .default, options: forCall ? [.duckOthers] : [.mixWithOthers])
        try? session.setActive(true)
    }

    func play(_ effect: Effect, loop: Bool = false, volume: Float = 1) {
        guard enabled || effect == .ring || effect == .drone else { return }
        guard let player = player(for: effect) else { return }
        player.numberOfLoops = loop ? -1 : 0
        player.volume = volume
        player.currentTime = 0
        player.play()
    }

    func stop(_ effect: Effect, fade: TimeInterval = 0.4) {
        guard let player = players[effect], player.isPlaying else { return }
        player.setVolume(0, fadeDuration: fade)
        DispatchQueue.main.asyncAfter(deadline: .now() + fade) { player.stop() }
    }

    private func player(for effect: Effect) -> AVAudioPlayer? {
        if let existing = players[effect] { return existing }
        guard let url = Bundle.main.url(forResource: effect.rawValue, withExtension: "wav"),
              let player = try? AVAudioPlayer(contentsOf: url) else { return nil }
        player.prepareToPlay()
        players[effect] = player
        return player
    }

    // MARK: Voice

    /// Reads the lines in a slow, low voice. `spokenLine` follows along.
    func speak(_ lines: [String], completion: @escaping () -> Void) {
        stopSpeaking()
        guard voiceEnabled, !lines.isEmpty else {
            completion()
            return
        }
        onFinished = completion
        isSpeaking = true
        let voice = Self.gothicVoice()
        for (index, line) in lines.enumerated() {
            let utterance = AVSpeechUtterance(string: line)
            utterance.voice = voice
            utterance.pitchMultiplier = 0.62
            utterance.rate = 0.42
            utterance.preUtteranceDelay = index == 0 ? 0.6 : 0.35
            utterance.volume = 1
            lineForUtterance[ObjectIdentifier(utterance)] = index
            synthesizer.speak(utterance)
        }
    }

    func stopSpeaking() {
        synthesizer.stopSpeaking(at: .immediate)
        lineForUtterance.removeAll()
        spokenLine = nil
        isSpeaking = false
        onFinished = nil
    }

    /// The deepest, best-quality British (else any English) male voice installed.
    private static func gothicVoice() -> AVSpeechSynthesisVoice? {
        let voices = AVSpeechSynthesisVoice.speechVoices()
        func rank(_ v: AVSpeechSynthesisVoice) -> Int {
            var score = 0
            if v.language == "en-GB" { score += 40 } else if v.language.hasPrefix("en") { score += 20 } else { return -1 }
            if v.gender == .male { score += 30 }
            switch v.quality {
            case .premium: score += 20
            case .enhanced: score += 10
            default: break
            }
            if v.name.contains("Daniel") || v.name.contains("Arthur") { score += 5 }
            return score
        }
        return voices.filter { rank($0) >= 0 }.max { rank($0) < rank($1) } ?? AVSpeechSynthesisVoice(language: "en-GB")
    }

    func haptic(_ style: UIImpactFeedbackGenerator.FeedbackStyle = .light) {
        UIImpactFeedbackGenerator(style: style).impactOccurred()
    }
}

extension SoundBoard: AVSpeechSynthesizerDelegate {
    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didStart utterance: AVSpeechUtterance) {
        let id = ObjectIdentifier(utterance)
        Task { @MainActor in self.spokenLine = self.lineForUtterance[id] }
    }

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        let id = ObjectIdentifier(utterance)
        Task { @MainActor in
            self.lineForUtterance[id] = nil
            if self.lineForUtterance.isEmpty, self.isSpeaking {
                self.isSpeaking = false
                self.spokenLine = nil
                let finished = self.onFinished
                self.onFinished = nil
                finished?()
            }
        }
    }
}
