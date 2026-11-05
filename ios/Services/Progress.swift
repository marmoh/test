import Foundation
import Observation

/// Talents permanents (§4), achetés avec de l'or.
enum TalentKind: String, CaseIterable, Identifiable {
    case vigor, strength, agility, fortune, ink
    var id: String { rawValue }

    var name: String {
        switch self {
        case .vigor: String(localized: "Vigueur", comment: "Talent permanent (PV)")
        case .strength: String(localized: "Force", comment: "Talent permanent (dégâts)")
        case .agility: String(localized: "Agilité", comment: "Talent permanent (cadence)")
        case .fortune: String(localized: "Fortune", comment: "Talent permanent (or)")
        case .ink: String(localized: "Encre lente", comment: "Talent permanent (durée du fil)")
        }
    }

    var perRank: String {
        switch self {
        case .vigor: String(localized: "+2 % PV", comment: "Talent Vigueur, par rang")
        case .strength: String(localized: "+2 % dégâts", comment: "Talent Force, par rang")
        case .agility: String(localized: "+1,5 % cadence", comment: "Talent Agilité, par rang")
        case .fortune: String(localized: "+5 % or", comment: "Talent Fortune, par rang")
        case .ink: String(localized: "+6 % durée du fil", comment: "Talent Encre lente, par rang")
        }
    }

    var icon: String {
        switch self {
        case .vigor: "ui_heart"
        case .strength: "ui_star"
        case .agility: "ui_coin"
        case .fortune: "ui_chest"
        case .ink: "power_longThread"
        }
    }

    var keyPath: WritableKeyPath<Talents, Int> {
        switch self {
        case .vigor: \.vigor
        case .strength: \.strength
        case .agility: \.agility
        case .fortune: \.fortune
        case .ink: \.ink
        }
    }
}

/// Progression du joueur (section `progress` de la sauvegarde) : étoiles, niveaux débloqués, héros choisi,
/// talents, tournoi de la semaine, pass de saison, coffres d'étoiles, apparences du fil.
@MainActor
@Observable
final class Progress {
    static let key = "progress"

    private(set) var data: ProgressData
    @ObservationIgnored private let store: any BlobStore

    init(store: any BlobStore) {
        self.store = store
        data = Self.read(store) ?? ProgressData()
    }

    private static func read(_ store: any BlobStore) -> ProgressData? {
        guard let d = store.blob(key) else { return nil }
        return try? JSONDecoder().decode(ProgressData.self, from: d)
    }

    func reload() {
        if let d = Self.read(store) { data = d }
    }

    private func mutate(_ f: (inout ProgressData) -> Void) {
        var d = data
        f(&d)
        data = d
        if let enc = try? JSONEncoder().encode(d) { store.setBlob(enc, forKey: Self.key) }
    }

    // MARK: niveaux

    var unlocked: Int { min(K.levelCount, data.unlocked) }
    func stars(_ n: Int) -> Int { data.stars(n) }
    var totalStars: Int { data.totalStars }

    /// Issue d'une tentative (port de `recordAttempt` du web, sans les vies gérées par `LivesCenter`).
    struct AttemptOutcome {
        var firstThree = false
        var firstClear = false
        /// Lunes du pass gagnées, palier avant et après.
        var passPoints = 0
        var tierBefore = 0
        var tierAfter = 0
        /// Coffres d'étoiles ouverts par cette victoire (déjà crédités).
        var chests: [(index: Int, rewards: [Reward])] = []
    }

    /// Enregistre une tentative : étoiles, déblocage, lunes du pass, coffres d'étoiles (crédités), héros débloqué.
    @discardableResult
    func record(level n: Int, won: Bool, stars: Int, wallet: Wallet, now: Date = Date()) -> AttemptOutcome {
        var out = AttemptOutcome()
        let season = SeasonPass.season(at: now.timeIntervalSince1970).number
        mutate { d in
            d.seasonPass = d.seasonPass.current(season: season)
            out.tierBefore = d.seasonPass.tier
            let prev = d.stars(n)
            let r = d.record(level: n, won: won, stars: stars)
            out.firstThree = r.firstThree
            out.firstClear = r.firstClear
            if won {
                out.passPoints = SeasonPass.pointsForWin(prevStars: prev, stars: stars)
                d.seasonPass.points += out.passPoints
                for index in StarChest.pending(opened: d.chestsOpened, stars: d.totalStars) {
                    out.chests.append((index, StarChest.rewards(index)))
                    d.chestsOpened = index
                }
            }
            out.tierAfter = d.seasonPass.tier
        }
        for c in out.chests { wallet.grant(c.rewards) }
        if won && n >= HeroUnlock.emberUnlockLevel { wallet.unlockHero(.emberSorcerer) }
        return out
    }

    // MARK: héros et talents

    var heroId: HeroID { data.heroId }
    var talents: Talents { data.talents }

    func select(_ hero: HeroID) { mutate { $0.heroId = hero } }

    func rank(_ k: TalentKind) -> Int { data.talents[keyPath: k.keyPath] }

    @discardableResult
    func buyTalent(_ k: TalentKind, wallet: Wallet) -> Bool {
        let r = rank(k)
        guard r < TalentK.maxRank, wallet.spendGold(Formulas.talentCost(r)) else { return false }
        mutate { $0.talents[keyPath: k.keyPath] = r + 1 }
        return true
    }

    // MARK: tournoi

    func tournament(week: String) -> TournamentState { data.tournament.current(week: week) }

    /// Consomme un essai (5 par semaine, non achetables). Renvoie faux s'il n'en reste plus.
    func startTournamentAttempt(week: String) -> Bool {
        var ok = false
        mutate { d in
            var t = d.tournament.current(week: week)
            if t.attempts > 0 {
                t.attempts -= 1
                ok = true
            }
            d.tournament = t
        }
        return ok
    }

    /// Enregistre un score ; renvoie vrai si c'est le meilleur de la semaine.
    @discardableResult
    func recordTournament(score: Int, week: String) -> Bool {
        var best = false
        mutate { d in
            var t = d.tournament.current(week: week)
            if score > t.best {
                t.best = score
                best = true
            }
            d.tournament = t
        }
        return best
    }

    func markSubmitted(_ score: Int, week: String) {
        mutate { d in
            var t = d.tournament.current(week: week)
            t.submitted = max(t.submitted, score)
            d.tournament = t
        }
    }

    func addHonor(_ h: String) {
        guard !data.honors.contains(h) else { return }
        mutate { $0.honors.append(h) }
    }

    // MARK: pass de saison (rien ne s'applique en tournoi)

    /// Pass de la saison en cours (une nouvelle saison le remet à zéro).
    func pass(now: Date = Date()) -> SeasonPassState {
        data.seasonPass.current(season: SeasonPass.season(at: now.timeIntervalSince1970).number)
    }

    /// Piste premium achetée (StoreKit) ou restaurée pour la saison en cours.
    func unlockPremium(now: Date = Date()) {
        let season = SeasonPass.season(at: now.timeIntervalSince1970).number
        guard !pass(now: now).premium else { return }
        mutate { d in
            d.seasonPass = d.seasonPass.current(season: season)
            d.seasonPass.premium = true
        }
    }

    /// Réclame un palier ; l'or, les gemmes et les bonus vont au portefeuille, les vies à `LivesCenter`.
    func claimPass(tier t: Int, premium: Bool, wallet: Wallet, lives: LivesCenter, now: Date = Date()) -> Reward? {
        var reward: Reward?
        let season = SeasonPass.season(at: now.timeIntervalSince1970).number
        mutate { d in
            d.seasonPass = d.seasonPass.current(season: season)
            reward = d.seasonPass.claim(premium: premium, tier: t)
        }
        if let reward { grant([reward], wallet: wallet, lives: lives) }
        return reward
    }

    /// « Tout réclamer » : piste gratuite puis premium, paliers croissants.
    func claimAllPass(wallet: Wallet, lives: LivesCenter, now: Date = Date()) -> [Reward] {
        var rewards: [Reward] = []
        let season = SeasonPass.season(at: now.timeIntervalSince1970).number
        mutate { d in
            d.seasonPass = d.seasonPass.current(season: season)
            rewards = d.seasonPass.claimAll()
        }
        grant(rewards, wallet: wallet, lives: lives)
        return rewards
    }

    private func grant(_ rewards: [Reward], wallet: Wallet, lives: LivesCenter) {
        wallet.grant(rewards)
        for r in rewards {
            switch r {
            case .lives: lives.refillFree()
            case .skin(let s):
                mutate { d in
                    if !d.skins.contains(s) { d.skins.append(s) }
                    if d.skin == nil { d.skin = s }
                }
            default: break
            }
        }
    }

    // MARK: apparences

    var skins: [SkinID] { data.skins }
    var skin: SkinID? { data.skin }
    func wear(_ s: SkinID?) {
        guard s == nil || data.skins.contains(s!) else { return }
        mutate { $0.skin = s }
    }

    // MARK: divers

    var seenTitle: Bool { data.seenTitle }
    func markTitleSeen() { if !data.seenTitle { mutate { $0.seenTitle = true } } }

    /// « Effacer la progression » (Réglages) : tout sauf les achats.
    func reset() { mutate { $0 = ProgressData() } }
}
