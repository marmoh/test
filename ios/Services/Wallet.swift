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

    /// Fusion iCloud : une transaction créditée sur un appareil l'est pour tous.
    func union(_ other: CreditLedger) -> CreditLedger {
        var m = self
        m.credited.formUnion(other.credited)
        return m
    }
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

/// Portefeuille local (gemmes, or, bonus, héros, droits) — une seule écriture atomique par opération,
/// dans la section `wallet` de la sauvegarde (`SaveStore` : fichier JSON + iCloud).
@MainActor
@Observable
final class Wallet: PurchaseSink {
    static let key = "wallet"

    struct Snapshot: Codable, Equatable {
        var gems = 120
        var gold = 300
        var heroes: Set<String> = ["scout"]
        var bonuses = Bonuses()
        var ledger = CreditLedger()
        var entitlements = Entitlements()
        var dragonGemsWeek: String?
        var dragonSkin = true
        /// L'offre de départ a été créditée (achat réel ou restauré).
        var starterCredited = false

        init() {}

        // décodage tolérant : une sauvegarde plus ancienne reçoit les nouveaux champs par défaut
        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            let d = Snapshot()
            gems = try c.decodeIfPresent(Int.self, forKey: .gems) ?? d.gems
            gold = try c.decodeIfPresent(Int.self, forKey: .gold) ?? d.gold
            heroes = try c.decodeIfPresent(Set<String>.self, forKey: .heroes) ?? d.heroes
            bonuses = try c.decodeIfPresent(Bonuses.self, forKey: .bonuses) ?? d.bonuses
            ledger = try c.decodeIfPresent(CreditLedger.self, forKey: .ledger) ?? d.ledger
            entitlements = try c.decodeIfPresent(Entitlements.self, forKey: .entitlements) ?? d.entitlements
            dragonGemsWeek = try c.decodeIfPresent(String.self, forKey: .dragonGemsWeek)
            dragonSkin = try c.decodeIfPresent(Bool.self, forKey: .dragonSkin) ?? d.dragonSkin
            starterCredited = try c.decodeIfPresent(Bool.self, forKey: .starterCredited) ?? false
        }
    }

    struct Bonuses: Codable, Equatable {
        var potion = 1, scroll = 1, aegis = 1

        subscript(_ k: BonusKind) -> Int {
            get {
                switch k { case .potion: potion; case .scroll: scroll; case .aegis: aegis }
            }
            set {
                switch k { case .potion: potion = newValue; case .scroll: scroll = newValue; case .aegis: aegis = newValue }
            }
        }
    }

    private(set) var snapshot: Snapshot
    @ObservationIgnored private let store: any BlobStore
    @ObservationIgnored private let key: String

    init(store: any BlobStore, key: String = Wallet.key) {
        self.store = store
        self.key = key
        snapshot = Self.read(store, key) ?? Snapshot()
    }

    /// Tests et anciennes installations : stockage dans `UserDefaults`.
    convenience init(defaults: UserDefaults = .standard) {
        self.init(store: defaults, key: "ombrelune.wallet.v1")
    }

    private static func read(_ store: any BlobStore, _ key: String) -> Snapshot? {
        guard let data = store.blob(key) else { return nil }
        return try? JSONDecoder().decode(Snapshot.self, from: data)
    }

    /// Relit la sauvegarde (après une fusion iCloud).
    func reload() {
        if let s = Self.read(store, key) { snapshot = s }
    }

    var gems: Int { snapshot.gems }
    var gold: Int { snapshot.gold }
    var heroes: Set<String> { snapshot.heroes }
    func owns(_ hero: HeroID) -> Bool { snapshot.heroes.contains(hero.rawValue) }
    var ownsSeasonPass: Bool { snapshot.entitlements.nonConsumables.contains(.seasonPass1) }
    var ownsStarterPack: Bool { snapshot.entitlements.nonConsumables.contains(.starterPack) || snapshot.starterCredited }
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
            s.starterCredited = true
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

    // MARK: dépenses et gains

    @discardableResult
    func spendGems(_ n: Int) -> Bool {
        guard snapshot.gems >= n else { return false }
        var s = snapshot
        s.gems -= n
        commit(s)
        return true
    }

    @discardableResult
    func spendGold(_ n: Int) -> Bool {
        guard snapshot.gold >= n else { return false }
        var s = snapshot
        s.gold -= n
        commit(s)
        return true
    }

    func addGold(_ n: Int) {
        var s = snapshot
        s.gold += n
        commit(s)
    }

    func bonusCount(_ k: BonusKind) -> Int { snapshot.bonuses[k] }

    /// Équipe un bonus avant niveau (le décompte se fait au moment de JOUER).
    @discardableResult
    func consumeBonus(_ k: BonusKind) -> Bool {
        guard snapshot.bonuses[k] > 0 else { return false }
        var s = snapshot
        s.bonuses[k] -= 1
        commit(s)
        return true
    }

    /// Achète un bonus avec de l'or (Potion 150, Égide 200 : boutique du web).
    @discardableResult
    func buyBonus(_ k: BonusKind, gold cost: Int) -> Bool {
        guard snapshot.gold >= cost else { return false }
        var s = snapshot
        s.gold -= cost
        s.bonuses[k] += 1
        commit(s)
        return true
    }

    func unlockHero(_ id: HeroID) {
        guard !snapshot.heroes.contains(id.rawValue) else { return }
        var s = snapshot
        s.heroes.insert(id.rawValue)
        commit(s)
    }

    /// Crédite des récompenses en une seule écriture (coffres, pass de saison). Les apparences sont gérées par `Progress`.
    func grant(_ rewards: [Reward]) {
        var s = snapshot
        for r in rewards {
            switch r {
            case .gold(let n): s.gold += n
            case .gems(let n): s.gems += n
            case .bonus(let k, let n): s.bonuses[k] += n
            case .threadSkin: break
            }
        }
        commit(s)
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
        if let data = try? JSONEncoder().encode(s) { store.setBlob(data, forKey: key) }
    }
}
