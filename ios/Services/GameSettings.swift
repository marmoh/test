import Foundation
import Observation

/// Réglages (§12.6) : mêmes clés que le prototype web (`web/src/state.ts`, `Settings`).
@MainActor
@Observable
final class GameSettings {
    /// Effets sonores.
    var sound: Bool { didSet { store(sound, "sound") } }
    var music: Bool { didSet { store(music, "music") } }
    var haptics: Bool { didSet { store(haptics, "haptics") } }
    /// Tir automatique : activé par défaut (DECISIONS #10, #17), forcé en tournoi.
    var autoFire: Bool { didSet { store(autoFire, "autoFire") } }
    /// Coupe secousses, arrêts sur image et animations décoratives ; s'ajoute au réglage système.
    var reduceMotion: Bool { didSet { store(reduceMotion, "reduceMotion") } }
    /// Consentement aux publicités personnalisées (désactivé par défaut ; pilote la demande ATT).
    var personalizedAds: Bool { didSet { store(personalizedAds, "personalizedAds") } }

    @ObservationIgnored private let defaults: UserDefaults
    private static let prefix = "ombrelune.settings."

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        func read(_ k: String, _ d: Bool) -> Bool {
            defaults.object(forKey: Self.prefix + k) as? Bool ?? d
        }
        sound = read("sound", true)
        music = read("music", true)
        haptics = read("haptics", true)
        autoFire = read("autoFire", true)
        reduceMotion = read("reduceMotion", false)
        personalizedAds = read("personalizedAds", false)
    }

    private func store(_ v: Bool, _ k: String) {
        defaults.set(v, forKey: Self.prefix + k)
    }
}
