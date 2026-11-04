import Foundation

/// Économie hors combat (pure, testable) : progression, coffres d'étoiles, pass de saison, tournoi,
/// fusion iCloud. Règles du prototype web (`web/src/state.ts`, `menus.ts`) + DECISIONS #50 à #53.

// MARK: - bonus avant niveau (§11)

public enum BonusKind: String, Codable, CaseIterable, Sendable {
    case potion, scroll, aegis

    public var name: String {
        switch self {
        case .potion: "Potion"
        case .scroll: "Parchemin"
        case .aegis: "Égide"
        }
    }

    public var blurb: String {
        switch self {
        case .potion: "+25 % PV"
        case .scroll: "1 pouvoir"
        case .aegis: "1 bouclier"
        }
    }
}

/// Prix de la boutique en jeu (identiques au web, `shopSheet`).
public enum ShopPrices {
    /// Recharge de 5 vies (§11).
    public static let livesRefillGems = 90
    public static let potionGold = 150
    public static let aegisGold = 200
    /// « Continuer » à la défaite (§11) : 60 gemmes la 1re fois, 120 la 2e, 2 au plus par tentative.
    public static func continueCost(_ used: Int) -> Int? { used == 0 ? 60 : used == 1 ? 120 : nil }
}

// MARK: - récompenses

public enum Reward: Codable, Equatable, Sendable {
    case gold(Int)
    case gems(Int)
    case bonus(BonusKind, Int)
    /// Apparence du fil (cosmétique, sans effet en combat).
    case threadSkin(ThreadSkin)

    public var label: String {
        switch self {
        case .gold(let n): "\(n) or"
        case .gems(let n): "\(n) gemmes"
        case .bonus(let k, let n): n > 1 ? "\(k.name) ×\(n)" : k.name
        case .threadSkin(let s): s.name
        }
    }
}

/// Apparences du fil de découpe (pass de saison).
public enum ThreadSkin: String, Codable, CaseIterable, Sendable {
    case ink, jade, gold, moon

    public var name: String {
        switch self {
        case .ink: "Fil d’encre"
        case .jade: "Fil de jade"
        case .gold: "Fil d’or"
        case .moon: "Fil de lune"
        }
    }

    /// Couleur RVB (0xRRGGBB) du trait ; jamais vermillon (réservé au danger).
    public var rgb: UInt32 {
        switch self {
        case .ink: 0x1B1418
        case .jade: 0x2B8A74
        case .gold: 0xC9A13B
        case .moon: 0x6F9FC4
        }
    }
}

// MARK: - coffres d'étoiles (§8)

public enum StarChest {
    /// Contenu du k-ième coffre (k ≥ 1) : or + gemmes + 1 bonus, en alternance (DECISIONS #51).
    public static func rewards(_ k: Int) -> [Reward] {
        let bonus = BonusKind.allCases[(k - 1) % BonusKind.allCases.count]
        return [.gold(150 + 10 * k), .gems(20), .bonus(bonus, 1)]
    }
}

// MARK: - pass de saison (§11, DECISIONS #50)

public enum SeasonPass {
    public static let season = 1
    public static let tiers = 30
    public static let xpPerTier = 100

    /// XP d'une partie (victoire : 40 + 10 par étoile, +20 la première fois ; défaite : 15 ; essai de tournoi : 50).
    public static func xp(won: Bool, stars: Int, firstClear: Bool) -> Int {
        won ? 40 + 10 * stars + (firstClear ? 20 : 0) : 15
    }
    public static let tournamentXP = 50

    /// Palier atteint (0 à 30) pour une XP donnée.
    public static func tier(forXP xp: Int) -> Int { min(tiers, max(0, xp) / xpPerTier) }

    public static func freeReward(_ t: Int) -> Reward {
        if t % 5 == 0 { return .gems(15) }
        if t % 4 == 0 { return .bonus(t % 8 == 0 ? .aegis : .potion, 1) }
        return .gold(50 + 5 * t)
    }

    public static func premiumReward(_ t: Int) -> Reward {
        switch t {
        case 10: return .threadSkin(.jade)
        case 20: return .threadSkin(.gold)
        case 30: return .threadSkin(.moon)
        default: break
        }
        if t % 5 == 0 { return .gems(50) }
        if t % 3 == 0 { return .bonus(.scroll, 1) }
        if t % 7 == 0 { return .bonus(.aegis, 1) }
        return .gold(100 + 10 * t)
    }
}

public struct SeasonPassState: Codable, Equatable, Sendable {
    public var season = SeasonPass.season
    public var xp = 0
    public var claimedFree: Set<Int> = []
    public var claimedPremium: Set<Int> = []
    public init() {}

    public var tier: Int { SeasonPass.tier(forXP: xp) }

    public func canClaim(_ t: Int, premium: Bool, owned: Bool) -> Bool {
        guard t >= 1, t <= tier else { return false }
        return premium ? owned && !claimedPremium.contains(t) : !claimedFree.contains(t)
    }

    public func merged(with o: SeasonPassState) -> SeasonPassState {
        guard o.season == season else { return o.season > season ? o : self }
        var m = self
        m.xp = max(xp, o.xp)
        m.claimedFree.formUnion(o.claimedFree)
        m.claimedPremium.formUnion(o.claimedPremium)
        return m
    }
}

// MARK: - tournoi (§10)

public struct TournamentState: Codable, Equatable, Sendable {
    public static let attemptsPerWeek = 5
    /// Semaine ISO « 2026-W45 ».
    public var week = ""
    public var attempts = TournamentState.attemptsPerWeek
    public var best = 0
    /// Meilleur score déjà envoyé à Game Center (renvoyé s'il manque, par ex. hors ligne).
    public var submitted = 0
    public init() {}

    /// État de la semaine `week` (remis à zéro chaque lundi 00:00 UTC).
    public func current(week w: String) -> TournamentState {
        if week == w { return self }
        var s = TournamentState()
        s.week = w
        return s
    }

    public func merged(with o: TournamentState) -> TournamentState {
        if week != o.week { return week > o.week ? self : o }
        var m = self
        m.attempts = min(attempts, o.attempts)
        m.best = max(best, o.best)
        m.submitted = max(submitted, o.submitted)
        return m
    }
}

// MARK: - progression

/// Progression sauvegardée (hors porte-monnaie et vies, gérés par `Wallet` et `LivesCenter`).
public struct ProgressData: Codable, Equatable, Sendable {
    /// Étoiles par niveau (clé = numéro du niveau en texte, lisible dans le JSON).
    public var stars: [String: Int] = [:]
    /// Plus haut niveau débloqué.
    public var unlocked = 1
    public var heroId: HeroID = .scout
    public var talents = Talents.none
    public var tournament = TournamentState()
    public var seasonPass = SeasonPassState()
    /// Coffres d'étoiles déjà ouverts (un tous les 20 ★).
    public var chestsOpened = 0
    public var threadSkin: ThreadSkin = .ink
    public var ownedThreadSkins: Set<ThreadSkin> = [.ink]
    /// Distinctions cosmétiques du tournoi (« Semaine 45 · top 10 % »).
    public var honors: [String] = []
    /// L'écran titre a été passé une fois.
    public var seenTitle = false
    public init() {}

    public func stars(_ n: Int) -> Int { stars[String(n)] ?? 0 }
    public var totalStars: Int { stars.values.reduce(0, +) }
    public var chestsAvailable: Int { max(0, Formulas.starChestsEarned(totalStars) - chestsOpened) }

    /// Enregistre une tentative (étoiles, déblocage). Renvoie « première fois à 3 étoiles » et « premier succès ».
    public mutating func record(level n: Int, won: Bool, stars s: Int) -> (firstThree: Bool, firstClear: Bool) {
        let prev = stars(n)
        let firstThree = won && s == 3 && prev < 3
        let firstClear = won && prev == 0
        if won {
            stars[String(n)] = max(prev, s)
            unlocked = max(unlocked, n + 1)
        }
        return (firstThree, firstClear)
    }

    /// Fusion iCloud : on ne perd jamais une étoile, un niveau, un rang de talent ni une récompense réclamée.
    public func merged(with o: ProgressData) -> ProgressData {
        var m = self
        for (k, v) in o.stars { m.stars[k] = max(m.stars[k] ?? 0, v) }
        m.unlocked = max(unlocked, o.unlocked)
        m.talents = Talents(vigor: max(talents.vigor, o.talents.vigor), strength: max(talents.strength, o.talents.strength),
                            agility: max(talents.agility, o.talents.agility), fortune: max(talents.fortune, o.talents.fortune))
        m.tournament = tournament.merged(with: o.tournament)
        m.seasonPass = seasonPass.merged(with: o.seasonPass)
        m.chestsOpened = max(chestsOpened, o.chestsOpened)
        m.ownedThreadSkins.formUnion(o.ownedThreadSkins)
        for h in o.honors where !m.honors.contains(h) { m.honors.append(h) }
        m.seenTitle = seenTitle || o.seenTitle
        return m
    }
}

/// Héros : conditions de déblocage (web `HERO_UNLOCK`).
public enum HeroUnlock {
    public static func label(_ id: HeroID) -> String {
        switch id {
        case .scout: "Disponible"
        case .windMonk: "Offre de départ"
        case .emberSorcerer: "Terminer le Marais (niv. 120)"
        }
    }

    public static func blurb(_ id: HeroID) -> String {
        switch id {
        case .scout: "Aiguilles de lune. Aucune faiblesse, aucune fioriture."
        case .windMonk: "Rafales d’air. Commence avec Vitesse +20 %."
        case .emberSorcerer: "Braises. Commence avec Flamme."
        }
    }

    /// Le Sorcier de braise se débloque en terminant le niveau 120 (fin du Marais).
    public static let emberUnlockLevel = 120
}
