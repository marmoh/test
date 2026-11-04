import Foundation

/// §11 Catalogue des produits. Mêmes identifiants que `ios/Ombrelune.storekit` et le prototype web
/// (`web/src/menus.ts`, `web/src/economy.ts`).
enum ProductID: String, CaseIterable, Codable, Sendable {
    case gemsHandful = "ombrelune.gems.handful"
    case gemsPouch = "ombrelune.gems.pouch"
    case gemsChest = "ombrelune.gems.chest"
    case starterPack = "ombrelune.starter"
    case seasonPass1 = "ombrelune.pass.season1"
    case dragonMonthly = "ombrelune.dragon.monthly"
    case dragonYearly = "ombrelune.dragon.yearly"

    /// Groupe d'abonnement « Ordre du Dragon » (identifiant du groupe dans le fichier `.storekit`
    /// et dans App Store Connect : à reporter ici après la création du groupe).
    static let dragonGroupID = "21566001"

    enum Kind: Equatable, Sendable {
        /// Consommable : gemmes créditées une seule fois par transaction (crédit idempotent).
        case gems(Int)
        /// Non consommable : 300 gemmes + Moine du vent + 5 bonus (une seule fois).
        case starterPack
        /// Non consommable par saison.
        case seasonPass(season: Int)
        /// Abonnement auto-renouvelable.
        case dragon
    }

    var kind: Kind {
        switch self {
        case .gemsHandful: .gems(100)
        case .gemsPouch: .gems(550)
        case .gemsChest: .gems(1_200)
        case .starterPack: .starterPack
        case .seasonPass1: .seasonPass(season: 1)
        case .dragonMonthly, .dragonYearly: .dragon
        }
    }

    static let gemPacks: [ProductID] = [.gemsHandful, .gemsPouch, .gemsChest]
    static let dragonPlans: [ProductID] = [.dragonYearly, .dragonMonthly]
}

/// Contenu de l'offre de départ (§11).
enum StarterPack {
    static let gems = 300
    static let heroID = "windMonk"
    static let bonuses = (potion: 2, scroll: 2, aegis: 1)
}

/// Avantages de l'Ordre du Dragon (§11), identiques au web (`DRAGON` dans `web/src/economy.ts`).
enum DragonPerks {
    static let trialDays = 3
    static let weeklyGems = 60
    static let goldBonus = 0.25

    /// Bonus d'or : Fortune (+5 % par rang) et abonnement (+25 %), additionnés (`goldReward`).
    static func goldBonus(fortuneRank: Int, subscribed: Bool) -> Double {
        Double(fortuneRank) * 0.05 + (subscribed ? goldBonus : 0)
    }

    /// Clé de semaine ISO (« 2026-W45 ») : les 60 gemmes se réclament une fois par semaine.
    static func weekKey(_ date: Date) -> String {
        var cal = Calendar(identifier: .iso8601)
        cal.timeZone = TimeZone(identifier: "UTC")!
        let c = cal.dateComponents([.yearForWeekOfYear, .weekOfYear], from: date)
        return String(format: "%04d-W%02d", c.yearForWeekOfYear ?? 0, c.weekOfYear ?? 0)
    }

    static func weeklyGemsClaimable(subscribed: Bool, claimedWeek: String?, now: Date) -> Bool {
        subscribed && claimedWeek != weekKey(now)
    }
}
