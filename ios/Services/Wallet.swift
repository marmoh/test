import Foundation
import Observation

/// Registre des transactions déjà créditées : le crédit des consommables est **idempotent** (§11).
/// Une transaction redélivrée (`Transaction.updates`, `Transaction.unfinished`, relance de l'app
/// avant `finish()`) n'est jamais créditée deux fois.
struct CreditLedger: Codable, Equatable, Sendable {
    private(set) var credited: Set<UInt64> = []

    /// Vrai si la transaction n'avait jamais été créditée (et la marque comme créditée).
    mutating func claim(_ transactionID: UInt64) -> Bool {
        credited.insert(transactionID).inserted
    }

    func contains(_ transactionID: UInt64) -> Bool { credited.contains(transactionID) }
}

/// Ce que le `Store` sait faire au jeu : créditer et refléter les droits. La persistance définitive
/// (sauvegarde JSON + iCloud KV, §13) implémentera ce protocole ; `Wallet` le fait en attendant.
@MainActor
protocol PurchaseSink: AnyObject {
    /// Crédite un achat **dans la même écriture** que l'identifiant de transaction.
    /// Renvoie `false` si la transaction était déjà créditée.
    @discardableResult
    func credit(_ product: ProductID, transactionID: UInt64) -> Bool
    /// Droits courants (non consommables possédés, état de l'abonnement), recalculés par le `Store`.
    func apply(_ entitlements: Entitlements)
}

/// État de l'Ordre du Dragon tel que l'App Store le rapporte.
struct DragonStatus: Codable, Equatable, Sendable {
    var isActive = false
    var productID: ProductID?
    var expiresAt: Date?
    var inTrial = false
    var willRenew = false
    /// Formule choisie pour le prochain renouvellement (changement de formule).
    var nextProductID: ProductID?

    static let none = DragonStatus()
}

struct Entitlements: Codable, Equatable, Sendable {
    var nonConsumables: Set<ProductID> = []
    var dragon: DragonStatus = .none
}

/// Portefeuille local (gemmes, bonus, héros, droits) — une seule écriture atomique par opération.
@MainActor
@Observable
final class Wallet: PurchaseSink {
    struct Snapshot: Codable, Equatable {
        var gems = 120
        var gold = 300
        var heroes: Set<String> = ["scout"]
        var bonuses = Bonuses()
        var ledger = CreditLedger()
        var entitlements = Entitlements()
        var dragonGemsWeek: String?
        var dragonSkin = true
    }

    struct Bonuses: Codable, Equatable {
        var potion = 1, scroll = 1, aegis = 1
    }

    private(set) var snapshot: Snapshot
    private let defaults: UserDefaults
    private let key = "ombrelune.wallet.v1"

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        if let data = defaults.data(forKey: key), let s = try? JSONDecoder().decode(Snapshot.self, from: data) {
            snapshot = s
        } else {
            snapshot = Snapshot()
        }
    }

    var gems: Int { snapshot.gems }
    var isDragon: Bool { snapshot.entitlements.dragon.isActive }
    var dragon: DragonStatus { snapshot.entitlements.dragon }

    // MARK: PurchaseSink

    @discardableResult
    func credit(_ product: ProductID, transactionID: UInt64) -> Bool {
        var s = snapshot
        guard s.ledger.claim(transactionID) else { return false }
        switch product.kind {
        case .gems(let n):
            s.gems += n
        case .starterPack:
            s.gems += StarterPack.gems
            s.heroes.insert(StarterPack.heroID)
            s.bonuses.potion += StarterPack.bonuses.potion
            s.bonuses.scroll += StarterPack.bonuses.scroll
            s.bonuses.aegis += StarterPack.bonuses.aegis
        case .seasonPass, .dragon:
            break // droits seulement (voir `apply`)
        }
        commit(s)
        return true
    }

    func apply(_ entitlements: Entitlements) {
        var s = snapshot
        s.entitlements = entitlements
        // une restauration rend le héros de l'offre de départ (les gemmes déjà consommées ne reviennent pas)
        if entitlements.nonConsumables.contains(.starterPack) { s.heroes.insert(StarterPack.heroID) }
        commit(s)
    }

    // MARK: Ordre du Dragon

    func weeklyGemsClaimable(now: Date = .now) -> Bool {
        DragonPerks.weeklyGemsClaimable(subscribed: isDragon, claimedWeek: snapshot.dragonGemsWeek, now: now)
    }

    @discardableResult
    func claimWeeklyGems(now: Date = .now) -> Int {
        guard weeklyGemsClaimable(now: now) else { return 0 }
        var s = snapshot
        s.gems += DragonPerks.weeklyGems
        s.dragonGemsWeek = DragonPerks.weekKey(now)
        commit(s)
        return DragonPerks.weeklyGems
    }

    func setDragonSkin(_ on: Bool) {
        var s = snapshot
        s.dragonSkin = on
        commit(s)
    }

    // MARK: dépenses

    @discardableResult
    func spendGems(_ n: Int) -> Bool {
        guard snapshot.gems >= n else { return false }
        var s = snapshot
        s.gems -= n
        commit(s)
        return true
    }

    /// « Effacer la progression » : tout sauf les achats (registre et droits restent, comme côté App Store).
    func eraseProgress() {
        var s = Snapshot()
        s.ledger = snapshot.ledger
        s.entitlements = snapshot.entitlements
        commit(s)
    }

    private func commit(_ s: Snapshot) {
        snapshot = s
        if let data = try? JSONEncoder().encode(s) { defaults.set(data, forKey: key) }
    }
}
