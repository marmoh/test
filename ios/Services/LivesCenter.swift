import Foundation
import Observation

/// Vies (§8) et publicités récompensées vues, persistées ensemble.
/// À fusionner dans la sauvegarde JSON + iCloud KV lors du port de la persistance (§13).
@MainActor
@Observable
final class LivesCenter {
    static let key = "lives"

    struct Snapshot: Codable {
        var lives: LivesState
        var ads = AdLedger()
        /// L'offre de l'Ordre a déjà été montrée à la première panne de vies (§11).
        var paywallSeen = false
    }

    private var snapshot: Snapshot
    @ObservationIgnored private let store: any BlobStore
    @ObservationIgnored private let key: String
    @ObservationIgnored private let clock: () -> Date

    init(store: any BlobStore, key: String = "lives", clock: @escaping () -> Date = Date.init) {
        self.store = store
        self.key = key
        self.clock = clock
        if let data = store.blob(key), let s = try? JSONDecoder().decode(Snapshot.self, from: data) {
            snapshot = s
        } else {
            snapshot = Snapshot(lives: .full(now: clock().timeIntervalSince1970))
        }
    }

    /// Tests et anciennes installations : stockage dans `UserDefaults`.
    convenience init(defaults: UserDefaults = .standard, clock: @escaping () -> Date = Date.init) {
        self.init(store: defaults, key: "ombrelune.lives.v1", clock: clock)
    }

    /// Relit la sauvegarde (après une fusion iCloud).
    func reload() {
        if let data = store.blob(key), let s = try? JSONDecoder().decode(Snapshot.self, from: data) { snapshot = s }
    }

    /// Horloge partagée (tests).
    var nowDate: Date { clock() }

    private var now: TimeInterval { clock().timeIntervalSince1970 }

    var state: LivesState { snapshot.lives.at(now) }
    var lives: Int { state.lives }
    var secondsToNextLife: TimeInterval? { snapshot.lives.secondsToNextLife(now) }

    func canPlay(subscribed: Bool) -> Bool { subscribed || lives > 0 }

    func recordAttempt(won: Bool, subscribed: Bool) {
        snapshot.lives = snapshot.lives.afterAttempt(now: now, won: won, unlimited: subscribed)
        save()
    }

    /// Première panne de vies : faut-il montrer l'offre de l'Ordre (une seule fois) ?
    func consumeFirstPaywall(subscribed: Bool) -> Bool {
        guard !subscribed, !snapshot.paywallSeen else { return false }
        snapshot.paywallSeen = true
        save()
        return true
    }

    // MARK: publicité récompensée

    func adStatus(subscribed: Bool) -> RewardedAdPolicy.Status {
        RewardedAdPolicy.status(snapshot.ads, now: now, day: RewardedAdPolicy.dayKey(clock()), subscribed: subscribed, lives: lives)
    }

    /// Crédite la vie d'une publicité vue jusqu'au bout (re-vérifie les limites).
    @discardableResult
    func rewardAd(subscribed: Bool) -> Bool {
        guard adStatus(subscribed: subscribed).ok else { return false }
        snapshot.ads = RewardedAdPolicy.record(snapshot.ads, now: now, day: RewardedAdPolicy.dayKey(clock()))
        snapshot.lives = snapshot.lives.addingLife(now: now)
        save()
        return true
    }

    /// Recharge de 5 vies pour 90 gemmes (§11).
    func refill(using wallet: Wallet) -> Bool {
        guard lives < LivesState.max, wallet.spendGems(90) else { return false }
        snapshot.lives = .full(now: now)
        save()
        return true
    }

    /// 5 vies offertes (récompense du pass de saison) : recharge complète.
    func refillFree() {
        snapshot.lives = .full(now: now)
        save()
    }

    func reset() {
        snapshot = Snapshot(lives: .full(now: now))
        save()
    }

    private func save() {
        if let data = try? JSONEncoder().encode(snapshot) { store.setBlob(data, forKey: key) }
    }
}
