import CoreHaptics
import UIKit

/// Retours haptiques (Core Haptics) : coup reçu, découpe (double impulsion pour un combo), mort, boss vaincu.
/// Repli sur `UIImpactFeedbackGenerator` sans moteur haptique. Suit le réglage « Vibrations ».
@MainActor
final class HapticsService {
    private let settings: GameSettings
    private var engine: CHHapticEngine?
    private let fallback = UIImpactFeedbackGenerator(style: .medium)
    private let heavyFallback = UIImpactFeedbackGenerator(style: .heavy)

    init(settings: GameSettings) {
        self.settings = settings
        guard CHHapticEngine.capabilitiesForHardware().supportsHaptics, let e = try? CHHapticEngine() else { return }
        e.isAutoShutdownEnabled = true
        e.playsHapticsOnly = true
        e.resetHandler = { [weak e] in try? e?.start() }
        try? e.start()
        engine = e
    }

    private func play(_ events: [(time: Double, intensity: Float, sharpness: Float)], fallbackHeavy: Bool = false) {
        guard settings.haptics else { return }
        guard let engine else {
            (fallbackHeavy ? heavyFallback : fallback).impactOccurred()
            return
        }
        let evs = events.map {
            CHHapticEvent(eventType: .hapticTransient, parameters: [
                CHHapticEventParameter(parameterID: .hapticIntensity, value: $0.intensity),
                CHHapticEventParameter(parameterID: .hapticSharpness, value: $0.sharpness),
            ], relativeTime: $0.time)
        }
        do {
            let pattern = try CHHapticPattern(events: evs, parameters: [])
            try engine.start()
            try engine.makePlayer(with: pattern).start(atTime: CHHapticTimeImmediate)
        } catch {
            fallback.impactOccurred()
        }
    }

    /// Coup reçu (`navigator.vibrate(28)` du web).
    func hurt() { play([(0, 0.85, 0.35)]) }

    /// Découpe : une impulsion sèche, deux pour une découpe multiple (`[12, 30, 18]`).
    func cut(multi: Bool) {
        play(multi ? [(0, 0.7, 0.9), (0.042, 0.9, 0.8)] : [(0, 0.6, 0.9)])
    }

    /// Mort de l'héroïne, boss vaincu.
    func heavy() { play([(0, 1, 0.2), (0.08, 0.6, 0.1)], fallbackHeavy: true) }

    func tap() { play([(0, 0.4, 0.6)]) }
}
