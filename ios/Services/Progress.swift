import Foundation
import Observation

/// Talents permanents (§4), achetés avec de l'or.
enum TalentKind: String, CaseIterable, Identifiable {
    case vigor, strength, agility, fortune
    var id: String { rawValue }

    var name: String {
        switch self {
        case .vigor: "Vigueur"
        case .strength: "Force"
        case .agility: "Agilité"
        case .fortune: "Fortune"
        }
    }

    var perRank: String {
        switch self {
        case .vigor: "+2 % PV"
        case .strength: "+2 % dégâts"
        case .agility: "+1,5 % cadence"
        case .fortune: "+5 % or"
        }
    }

    var icon: String {
        switch self {
        case .vigor: "ui_heart"
        case .strength: "ui_star"
        case .agility: "ui_coin"
        case .fortune: "ui_chest"
        }
    }

    var keyPath: WritableKeyPath<Talents, Int> {
        switch self {
        case .vigor: \.vigor
        case .strength: \.strength
        case .agility: \.agility
        case .fortune: \.fortune
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

    /// Enregistre l'issue d'une tentative (étoiles, déblocage, XP du pass, héros débloqué).
    @discardableResult
    func record(level n: Int, won: Bool, stars: Int, wallet: Wallet) -> (firstThree: Bool, firstClear: Bool) {
        var r = (firstThree: false, firstClear: false)
        mutate { d in
            r = d.record(level: n, won: won, stars: stars)
            d.seasonPass.xp += SeasonPass.xp(won: won, stars: stars, firstClear: r.firstClear)
        }
        if won && n >= HeroUnlock.emberUnlockLevel { wallet.unlockHero(.emberSorcerer) }
        return r
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

    // MARK: coffres d'étoiles

    var chestsAvailable: Int { data.chestsAvailable }

    /// Ouvre le prochain coffre d'étoiles disponible.
    func openChest(wallet: Wallet) -> [Reward]? {
        guard data.chestsAvailable > 0 else { return nil }
        let k = data.chestsOpened + 1
        let rewards = StarChest.rewards(k)
        wallet.grant(rewards)
        mutate { $0.chestsOpened = k }
        return rewards
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
                d.seasonPass.xp += SeasonPass.tournamentXP
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

    // MARK: pass de saison

    var pass: SeasonPassState { data.seasonPass }

    func claimPass(tier t: Int, premium: Bool, wallet: Wallet) -> Reward? {
        guard data.seasonPass.canClaim(t, premium: premium, owned: wallet.ownsSeasonPass) else { return nil }
        let r = premium ? SeasonPass.premiumReward(t) : SeasonPass.freeReward(t)
        if case .threadSkin = r {} else { wallet.grant([r]) }
        mutate { d in
            if premium { d.seasonPass.claimedPremium.insert(t) } else { d.seasonPass.claimedFree.insert(t) }
            if case .threadSkin(let s) = r {
                d.ownedThreadSkins.insert(s)
                d.threadSkin = s
            }
        }
        return r
    }

    var threadSkin: ThreadSkin { data.threadSkin }
    func wear(_ s: ThreadSkin) {
        guard data.ownedThreadSkins.contains(s) else { return }
        mutate { $0.threadSkin = s }
    }

    // MARK: divers

    var seenTitle: Bool { data.seenTitle }
    func markTitleSeen() { if !data.seenTitle { mutate { $0.seenTitle = true } } }

    /// « Effacer la progression » (Réglages) : tout sauf les achats.
    func reset() { mutate { $0 = ProgressData() } }
}
