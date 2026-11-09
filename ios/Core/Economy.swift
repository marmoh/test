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

/// Prix de la boutique en jeu et des bonus (DECISIONS #65) : identiques au web (`BONUS_PRICE`, `shopSheet`).
public enum ShopPrices {
    /// Recharge de 5 vies (§11).
    public static let livesRefillGems = 90
    public enum Currency: Sendable { case gold, gems }
    /// Potion de vie 150 or, Parchemin 25 gemmes, Égide 200 or.
    public static func bonus(_ k: BonusKind) -> (currency: Currency, amount: Int) {
        switch k {
        case .potion: (.gold, 150)
        case .scroll: (.gems, 25)
        case .aegis: (.gold, 200)
        }
    }
    /// « Continuer » à la défaite (§11) : 60 gemmes la 1re fois, 120 la 2e, 2 au plus par tentative.
    public static func continueCost(_ used: Int) -> Int? { used == 0 ? 60 : used == 1 ? 120 : nil }
}

// MARK: - apparences (pass de saison, cosmétiques)

/// Apparences de l'héroïne gagnées dans le pass (`SKINS` de `web/src/season.ts`).
public enum SkinID: String, Codable, CaseIterable, Sendable {
    case foxEars, paperWings, moonCrown

    public var name: String {
        switch self {
        case .foxEars: "Oreilles de renard"
        case .paperWings: "Ailes de papier"
        case .moonCrown: "Couronne de lune"
        }
    }

    public var desc: String {
        switch self {
        case .foxEars: "Oreilles et queue de renard découpées dans l’encre."
        case .paperWings: "Deux ailes de papier ajourées qui battent doucement."
        case .moonCrown: "Un croissant d’or à la feuille au-dessus de la capuche."
        }
    }
}

// MARK: - récompenses

/// Récompense fixe (aucun hasard, §11) : port de `Reward` de `web/src/season.ts`.
public enum Reward: Codable, Equatable, Sendable {
    case gold(Int)
    case gems(Int)
    case bonus(BonusKind, Int)
    /// 5 vies (recharge complète).
    case lives
    case skin(SkinID)

    public var label: String {
        switch self {
        case .gold(let n): "\(n) or"
        case .gems(let n): "\(n) gemmes"
        case .bonus(.potion, let n): n > 1 ? "\(n) potions" : "Potion de vie"
        case .bonus(.scroll, let n): n > 1 ? "\(n) parchemins" : "Parchemin"
        case .bonus(.aegis, let n): n > 1 ? "\(n) égides" : "Égide"
        case .lives: "5 vies"
        case .skin(let s): s.name
        }
    }

    /// Résumé « +300 or · +40 gemmes · Ailes de papier » (`rewardsSummary`).
    public static func summary(_ rs: [Reward]) -> String {
        var gold = 0, gems = 0, lives = 0
        var bonus: [BonusKind: Int] = [:]
        var skins: [String] = []
        for r in rs {
            switch r {
            case .gold(let n): gold += n
            case .gems(let n): gems += n
            case .bonus(let k, let n): bonus[k, default: 0] += n
            case .lives: lives += 1
            case .skin(let s): skins.append(s.name)
            }
        }
        var parts: [String] = []
        if gold > 0 { parts.append("+\(gold) or") }
        if gems > 0 { parts.append("+\(gems) gemmes") }
        for k in BonusKind.allCases { if let n = bonus[k] { parts.append("+" + Reward.bonus(k, n).label) } }
        if lives > 0 { parts.append("+5 vies") }
        return (parts + skins).joined(separator: " · ")
    }
}

// MARK: - coffres d'étoiles (§8, DECISIONS #64)

public enum StarChest {
    public static let every = 20
    public static let gold = 200
    public static let gems = 20

    /// Contenu du coffre n° `index` (1, 2, 3…) : or + gemmes + 1 bonus, sans hasard (le bonus tourne).
    public static func rewards(_ index: Int) -> [Reward] {
        let bonus = BonusKind.allCases[(index - 1) % 3]
        return [.gold(gold), .gems(gems), .bonus(bonus, 1)]
    }

    /// Numéros des coffres à ouvrir (`pendingChests`).
    public static func pending(opened: Int, stars: Int) -> [Int] {
        let earned = stars / every
        return earned > opened ? Array((opened + 1)...earned) : []
    }
}

// MARK: - pass de saison (§11, §12.6, DECISIONS #62) — port de `web/src/season.ts`

public enum SeasonPass {
    public static let tiers = 30
    public static let pointsPerTier = 40
    public static let pointsPerWin = 10
    public static let pointsPerNewStar = 10
    public static let seasonDays = 42
    /// Lundi 2 novembre 2026, 00:00 UTC : début de la saison 1.
    public static let epoch: TimeInterval = 1_793_577_600
    public static let name = "La Lune de papier"
    public static let productPrefix = "ombrelune.pass.season"

    public struct Season: Equatable, Sendable {
        public var number: Int
        public var start: TimeInterval
        public var end: TimeInterval
    }

    /// Saison en cours (avant l'époque : saison 1).
    public static func season(at now: TimeInterval) -> Season {
        let len = TimeInterval(seasonDays * 86_400)
        let i = max(0, Int(((now - epoch) / len).rounded(.down)))
        let start = epoch + Double(i) * len
        return Season(number: i + 1, start: start, end: start + len)
    }

    public static func productID(season: Int) -> String { "\(productPrefix)\(season)" }

    /// Lunes gagnées par une victoire : `prevStars` = meilleur score avant, `stars` = résultat.
    public static func pointsForWin(prevStars: Int, stars: Int) -> Int {
        pointsPerWin + pointsPerNewStar * max(0, stars - prevStars)
    }

    public static func tier(forPoints p: Int) -> Int { min(tiers, max(0, p) / pointsPerTier) }

    /// Avancement dans le palier en cours (0…1), 1 si tout est atteint.
    public static func progress(_ p: Int) -> Double {
        tier(forPoints: p) >= tiers ? 1 : Double(p % pointsPerTier) / Double(pointsPerTier)
    }

    public static let freeTrack: [Reward] = [
        .gold(100), .bonus(.potion, 1), .gold(150), .gems(10), .bonus(.scroll, 1),
        .gold(200), .bonus(.aegis, 1), .gems(15), .gold(250), .gems(20),
        .bonus(.potion, 1), .gold(300), .bonus(.scroll, 1), .gems(15), .gold(350),
        .bonus(.aegis, 1), .gold(400), .gems(20), .bonus(.potion, 1), .gems(25),
        .gold(450), .bonus(.scroll, 1), .gold(500), .gems(20), .bonus(.aegis, 1),
        .gold(550), .bonus(.potion, 1), .gems(25), .gold(600), .gems(50),
    ]

    public static let premiumTrack: [Reward] = [
        .gems(30), .gold(300), .bonus(.potion, 2), .gems(30), .bonus(.scroll, 2),
        .gold(400), .bonus(.aegis, 2), .gems(40), .gold(500), .skin(.foxEars),
        .gems(40), .bonus(.potion, 2), .gold(600), .bonus(.scroll, 2), .lives,
        .gems(50), .bonus(.aegis, 2), .gold(700), .gems(50), .skin(.paperWings),
        .bonus(.potion, 3), .gold(800), .gems(60), .bonus(.scroll, 3), .lives,
        .bonus(.aegis, 3), .gems(60), .gold(1000), .gems(80), .skin(.moonCrown),
    ]

    public static func reward(premium: Bool, tier t: Int) -> Reward { (premium ? premiumTrack : freeTrack)[t - 1] }
}

/// État du pass de la saison en cours (`PassState`).
public struct SeasonPassState: Codable, Equatable, Sendable {
    public var season: Int
    public var points = 0
    /// Piste premium achetée pour cette saison.
    public var premium = false
    public var claimedFree: Set<Int> = []
    public var claimedPremium: Set<Int> = []

    public init(season: Int = 1) { self.season = season }

    /// Une autre saison repart à zéro (le premium ne passe pas d'une saison à l'autre).
    public func current(season s: Int) -> SeasonPassState { season == s ? self : SeasonPassState(season: s) }

    public var tier: Int { SeasonPass.tier(forPoints: points) }

    public func isClaimed(premium p: Bool, tier t: Int) -> Bool { (p ? claimedPremium : claimedFree).contains(t) }

    public func canClaim(premium p: Bool, tier t: Int) -> Bool {
        guard t >= 1, t <= SeasonPass.tiers, t <= tier else { return false }
        if p && !premium { return false }
        return !isClaimed(premium: p, tier: t)
    }

    public mutating func claim(premium p: Bool, tier t: Int) -> Reward? {
        guard canClaim(premium: p, tier: t) else { return nil }
        if p { claimedPremium.insert(t) } else { claimedFree.insert(t) }
        return SeasonPass.reward(premium: p, tier: t)
    }

    /// Tout ce qui peut être réclamé (piste gratuite puis premium, paliers croissants).
    public mutating func claimAll() -> [Reward] {
        var out: [Reward] = []
        for p in [false, true] { for t in 1...SeasonPass.tiers { if let r = claim(premium: p, tier: t) { out.append(r) } } }
        return out
    }

    public var claimableCount: Int {
        var n = 0
        for p in [false, true] { for t in 1...SeasonPass.tiers where canClaim(premium: p, tier: t) { n += 1 } }
        return n
    }

    public func merged(with o: SeasonPassState) -> SeasonPassState {
        guard o.season == season else { return o.season > season ? o : self }
        var m = self
        m.points = max(points, o.points)
        m.premium = premium || o.premium
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
    /// Coffres d'étoiles déjà ouverts (un tous les 20 ★, crédités à la victoire qui les mérite).
    public var chestsOpened = 0
    /// Apparences possédées (pass de saison) et apparence portée (cosmétique).
    public var skins: [SkinID] = []
    public var skin: SkinID?
    /// Distinctions cosmétiques du tournoi (« Semaine 45 · top 10 % »).
    public var honors: [String] = []
    /// L'écran titre a été passé une fois.
    public var seenTitle = false
    public init() {}

    public func stars(_ n: Int) -> Int { stars[String(n)] ?? 0 }
    public var totalStars: Int { stars.values.reduce(0, +) }
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
                            agility: max(talents.agility, o.talents.agility), fortune: max(talents.fortune, o.talents.fortune),
                            ink: max(talents.ink, o.talents.ink))
        m.tournament = tournament.merged(with: o.tournament)
        m.seasonPass = seasonPass.merged(with: o.seasonPass)
        m.chestsOpened = max(chestsOpened, o.chestsOpened)
        for k in o.skins where !m.skins.contains(k) { m.skins.append(k) }
        for h in o.honors where !m.honors.contains(h) { m.honors.append(h) }
        m.seenTitle = seenTitle || o.seenTitle
        return m
    }
}

/// Héros : conditions de déblocage (DECISIONS #77, web `HERO_UNLOCK_LEVEL`) ; textes affichés : `ios/Services/MetaRules.swift`.
public enum HeroUnlock {
    /// Le Moine du vent se débloque en terminant le niveau 40 (ou avec l'offre de départ).
    public static let monkUnlockLevel = 40
    /// Le Sorcier de braise se débloque en terminant le niveau 100.
    public static let emberUnlockLevel = 100
}
