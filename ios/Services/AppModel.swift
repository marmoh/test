import Foundation
import Observation
import SwiftUI

/// Racine de l'app : services, navigation et règles de déroulé (port de `web/src/main.ts` et `state.ts`).
///
/// - Lancer un niveau : sans vie, 1re fois l'offre de l'Ordre du Dragon puis la feuille des vies (§11) ;
///   ensuite pré-niveau (bonus), JOUER (une vie n'est retirée qu'en cas de défaite).
/// - Victoire : étoiles, or (`goldReward` + Fortune + Ordre du Dragon), XP du pass, niveau suivant.
/// - Défaite : continuer (60 puis 120 gemmes, 2 fois au plus), réessayer, carte.
/// - Tournoi : 5 essais par semaine ISO, héros standard, ni talents ni bonus ni « continuer », score §10, Game Center.
/// - Version 0.2 (`Meta`) : équipement porté en combat (pas en tournoi), butin et éclats à la victoire, quêtes du jour
///   et bestiaire (victoires et défaites), héros débloqués aux niveaux 40 et 100 (« Nouveau héros ! » après la
///   victoire), essai d'un héros verrouillé (ni vie retirée ni récompense).
@MainActor
@Observable
final class AppModel {
    enum Sheet: Identifiable, Equatable {
        case preLevel(Int)
        /// Héros (onglet Héros) ; `gear` ouvre la même feuille sur l'onglet Équipement.
        case heroes, gear, shop, pass, tournament, settings, lives, leaderboard
        case quests, bestiary
        case dragon(DragonView.Context)
        /// « Nouveau héros ! » après la victoire qui le débloque.
        case heroUnlocked(HeroID)

        var id: String {
            switch self {
            case .preLevel(let n): "pre\(n)"
            case .heroes: "heroes"
            case .gear: "gear"
            case .quests: "quests"
            case .bestiary: "bestiary"
            case .heroUnlocked(let h): "unlock\(h.rawValue)"
            case .shop: "shop"
            case .pass: "pass"
            case .tournament: "tournament"
            case .settings: "settings"
            case .lives: "lives"
            case .leaderboard: "leaderboard"
            case .dragon(let c): "dragon\(c)"
            }
        }
    }

    let content: ContentStore?
    let loadError: String?
    let saveStore: SaveStore
    let progress: Progress
    let wallet: Wallet
    /// Équipement, quêtes du jour, bestiaire (version 0.2).
    let meta: Meta
    let lives: LivesCenter
    let store: Store
    let settings: GameSettings
    let ads: MockAdService
    let gameCenter: GameCenterService
    let audio: AudioService
    let haptics: HapticsService

    var sheet: Sheet? {
        didSet { if let sheet { shownSheet = sheet } }
    }
    var combat: CombatSession?
    var toast: String?
    var showTitle = true
    /// Butin de la dernière victoire (carte de l'écran de victoire).
    var lastLoot: Loot?
    /// Héros débloqués par la dernière victoire, présentés un à un après l'écran de victoire.
    @ObservationIgnored private var pendingHeroes: [HeroID] = []
    /// Niveau suivant à ouvrir une fois les héros présentés (« Niveau suivant »).
    @ObservationIgnored private var levelAfterHeroes: Int?
    @ObservationIgnored private var shownSheet: Sheet?
    @ObservationIgnored private var pendingLevel: Int?
    @ObservationIgnored private var observers: [NSObjectProtocol] = []

    init() {
        do {
            content = try ContentStore.bundled()
            loadError = nil
        } catch {
            content = nil
            loadError = "\(error)"
        }
        let save = SaveStore()
        saveStore = save
        let progress = Progress(store: save)
        self.progress = progress
        let wallet = Wallet(store: save)
        self.wallet = wallet
        meta = Meta(store: save, progress: progress, wallet: wallet)
        lives = LivesCenter(store: save)
        store = Store(sink: wallet)
        let settings = GameSettings()
        self.settings = settings
        ads = MockAdService()
        gameCenter = GameCenterService()
        audio = AudioService(settings: settings)
        haptics = HapticsService(settings: settings)
        // fusion iCloud venue d'un autre appareil : on relit chaque section
        observers.append(NotificationCenter.default.addObserver(forName: SaveStore.didMergeRemote, object: nil, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated {
                self?.wallet.reload()
                self?.lives.reload()
                self?.progress.reload()
                self?.meta.reload()
            }
        })
    }

    /// Démarrage : sons, StoreKit, Game Center.
    func launch() async {
        audio.start()
        // anciennes sauvegardes : héros déjà mérités (niveaux 40 et 100 terminés) inscrits sans cérémonie
        meta.syncHeroUnlocks()
        gameCenter.authenticate()
        await store.load()
        syncPassPremium()
        await ads.load()
        #if DEBUG
        openDebugScreen()
        #endif
    }

    #if DEBUG
    /// Recette et captures (Debug seulement, comme `?screen=` du web) : `xcrun simctl launch <sim> com.marmoh.ombrelune
    /// -screen shop` ouvre directement un écran : map, heroes, gear, shop, pass, tournament, settings, lives, dragon,
    /// quests, bestiary, prelevel, combat (`-level N`, niveau 1 par défaut).
    private func openDebugScreen() {
        let d = UserDefaults.standard
        guard let screen = d.string(forKey: "screen") else { return }
        showTitle = false
        let n = max(1, d.integer(forKey: "level"))
        switch screen {
        case "heroes": sheet = .heroes
        case "gear": sheet = .gear
        case "quests": sheet = .quests
        case "bestiary": sheet = .bestiary
        case "shop": sheet = .shop
        case "pass": sheet = .pass
        case "tournament": sheet = .tournament
        case "settings": sheet = .settings
        case "lives": sheet = .lives
        case "dragon": sheet = .dragon(.shop)
        case "prelevel": sheet = .preLevel(n)
        case "combat": if let content { startSaga(content.level(n), bonuses: [], hero: currentHero) }
        default: break
        }
    }
    #endif

    // MARK: état dérivé

    /// Ordre du Dragon actif (droits StoreKit, mémorisés pour jouer hors ligne).
    var subscribed: Bool { store.isDragon || wallet.isDragon }

    func canPlay() -> Bool { lives.canPlay(subscribed: subscribed) }

    var currentHero: HeroID { meta.heroUnlocked(progress.heroId) ? progress.heroId : .scout }

    /// Héros débloqués, dans l'ordre du catalogue.
    var unlockedHeroes: [HeroID] { HeroID.allCases.filter { meta.heroUnlocked($0) } }

    /// Pré-niveau : un toucher passe au héros débloqué suivant.
    func cycleHero() {
        let ids = unlockedHeroes
        guard ids.count > 1 else {
            return show(String(localized: "Débloque d’autres héros en avançant sur la carte"))
        }
        audio.play(.tap)
        let i = ids.firstIndex(of: currentHero) ?? 0
        progress.select(ids[(i + 1) % ids.count])
    }

    func selectHero(_ id: HeroID) {
        guard meta.heroUnlocked(id) else { return }
        progress.select(id)
    }

    var weekKey: String { Formulas.weekKey(Date()) }

    /// Message bref (déjà traduit : `String(localized:)`).
    func show(_ message: String) { toast = message }

    // MARK: niveaux

    /// Toucher un nœud de la carte.
    func openLevel(_ n: Int) {
        audio.play(.tap)
        guard n <= progress.unlocked else { return }
        if !canPlay() {
            // §11 : 1re panne de vies → offre de l'Ordre, puis feuille des vies (publicité, gemmes)
            pendingLevel = n
            sheet = lives.consumeFirstPaywall(subscribed: subscribed) ? .dragon(.lives) : .lives
            return
        }
        sheet = .preLevel(n)
    }

    /// Appelé à la fermeture d'une feuille : enchaîne la suite du parcours « plus de vies ».
    func sheetDismissed() {
        let closed = shownSheet
        shownSheet = nil
        if case .heroUnlocked(_)? = closed, sheet == nil {
            if !pendingHeroes.isEmpty {
                afterCover { $0.showNextHeroUnlock() }
            } else if let n = levelAfterHeroes {
                levelAfterHeroes = nil
                afterCover { $0.openLevel(n) }
            }
            return
        }
        guard sheet == nil, let n = pendingLevel else { return }
        switch closed {
        case .dragon(.lives)?:
            if subscribed { pendingLevel = nil; sheet = .preLevel(n) } else { sheet = .lives }
        case .lives?:
            pendingLevel = nil
            if canPlay() { sheet = .preLevel(n) }
        default:
            pendingLevel = nil
        }
    }

    /// JOUER depuis le pré-niveau : les bonus équipés sont décomptés maintenant.
    func play(level n: Int, bonuses: Set<BonusKind>) {
        guard let content else { return }
        var used = Set<BonusKind>()
        for b in bonuses where wallet.consumeBonus(b) { used.insert(b) }
        sheet = nil
        startSaga(content.level(n), bonuses: used, hero: currentHero)
    }

    /// Essai d'un héros verrouillé (DECISIONS #77) : un niveau déjà connu, sans vie ni récompense.
    func startTrial(_ id: HeroID) {
        guard let content else { return }
        audio.play(.tap)
        sheet = nil
        startSaga(content.level(HeroUnlocks.trialLevel(id, unlocked: progress.unlocked)), bonuses: [], hero: id, trial: true)
    }

    private func startSaga(_ level: LevelDef, bonuses: Set<BonusKind>, hero: HeroID, trial: Bool = false) {
        guard let content else { return }
        var cfg = GameScene.Config(
            level: level, templates: content.templates, mode: .saga, heroId: hero, talents: progress.talents,
            potion: bonuses.contains(.potion), aegis: bonuses.contains(.aegis), scroll: nil, scrollPending: bonuses.contains(.scroll),
            autoFire: settings.autoFire, reduceMotion: settings.reduceMotion, haptics: settings.haptics,
            dragonSkin: subscribed && wallet.snapshot.dragonSkin, skin: progress.skin)
        // équipement porté (aussi pendant un essai, comme le web)
        cfg.gear = meta.gearStats
        cfg.trial = trial
        launch(CombatSession(level: level, mode: .saga, config: cfg, app: self))
    }

    private func launch(_ s: CombatSession) {
        combat?.tearDown()
        combat = s
        Task { await s.start() }
    }

    func closeCombat() {
        combat?.tearDown()
        combat = nil
    }

    // MARK: issue d'une tentative

    func recordVictory(_ s: CombatSession, _ r: CombatResult) -> VictoryInfo {
        let n = s.level.n
        if s.config.trial {
            // essai : rien n'est gagné ni perdu (écran « Essai terminé »)
            lastLoot = nil
            return VictoryInfo(level: n, stars: r.stars, gold: 0, kills: r.kills, seconds: r.seconds, dragonBonus: false,
                               passPoints: 0, newTier: nil, chests: [], isLast: true)
        }
        let firstWin = progress.stars(n) == 0
        lives.recordAttempt(won: true, subscribed: subscribed)
        let rec = progress.record(level: n, won: true, stars: r.stars, wallet: wallet)
        pendingHeroes = meta.syncHeroUnlocks()
        lastLoot = meta.grantLoot(level: n, firstWin: firstWin, threeStars: r.stars == 3)
        meta.recordFight(FightReport(won: true, level: n, hero: s.config.heroId, killsByType: r.killsByType,
                                     signatureHits: r.signatureHits, stars: r.stars, hpFrac: r.hpFrac, replay: !firstWin,
                                     boss: Formulas.levelKind(n) == .boss))
        let bonus = DragonPerks.goldBonus(fortuneRank: progress.talents.fortune, subscribed: subscribed)
        let gold = Formulas.goldReward(n, firstThreeStars: rec.firstThree, goldBonus: bonus)
        wallet.addGold(gold)
        let chests = rec.chests.map {
            String(localized: "Coffre d’étoiles (\($0.index * StarChest.every) ★) : \(Reward.summaryText($0.rewards))",
                   comment: "Victoire : coffre ouvert (étoiles totales) et son contenu")
        }
        return VictoryInfo(level: n, stars: r.stars, gold: gold, kills: r.kills, seconds: r.seconds, dragonBonus: subscribed,
                           passPoints: rec.passPoints, newTier: rec.tierAfter > rec.tierBefore ? rec.tierAfter : nil,
                           chests: chests, isLast: n >= K.levelCount)
    }

    private func recordDefeat(_ s: CombatSession) {
        guard s.mode == .saga, !s.config.trial else { return }
        let n = s.level.n
        // les quêtes et le bestiaire comptent aussi les ennemis vaincus pendant une défaite
        meta.recordFight(FightReport(won: false, level: n, hero: s.config.heroId, killsByType: s.scene?.killsByType ?? [:],
                                     signatureHits: s.scene?.signatureHits ?? 0, stars: 0, hpFrac: 0,
                                     replay: progress.stars(n) > 0, boss: Formulas.levelKind(n) == .boss))
        lives.recordAttempt(won: false, subscribed: subscribed)
        progress.record(level: n, won: false, stars: 0, wallet: wallet)
    }

    /// Continuer (§11) : 60 gemmes la 1re fois, 120 la 2e.
    func buyContinue(_ s: CombatSession, used: Int) {
        guard let cost = ShopPrices.continueCost(used) else { return }
        if wallet.spendGems(cost) {
            audio.play(.star)
            s.resolveDefeat(.revive)
        } else {
            show(String(localized: "Pas assez de gemmes"))
        }
    }

    func retry(_ s: CombatSession) {
        let level = s.level
        if s.config.trial {
            closeCombat()
            startSaga(level, bonuses: [], hero: s.config.heroId, trial: true)
            return
        }
        recordDefeat(s)
        closeCombat()
        if canPlay() {
            startSaga(level, bonuses: [], hero: currentHero)
        } else {
            // dernière vie perdue : retour à la carte, où l'on propose des vies (jamais en combat)
            afterCover { $0.openLevel(level.n) }
        }
    }

    func quit(_ s: CombatSession) {
        recordDefeat(s)
        closeCombat()
    }

    /// Après la victoire : carte ou niveau suivant, après avoir présenté les héros débloqués.
    func afterVictory(next: Bool) {
        let n = combat?.level.n ?? 0
        let trial = combat?.config.trial ?? false
        closeCombat()
        lastLoot = nil
        if trial { return }
        let following = next && n < K.levelCount ? n + 1 : nil
        if !pendingHeroes.isEmpty {
            levelAfterHeroes = following
            afterCover { $0.showNextHeroUnlock() }
        } else if let following {
            afterCover { $0.openLevel(following) }
        }
    }

    private func showNextHeroUnlock() {
        guard !pendingHeroes.isEmpty else { return }
        audio.play(.loot)
        sheet = .heroUnlocked(pendingHeroes.removeFirst())
    }

    /// « Le choisir » sur l'écran « Nouveau héros ! ».
    func pickUnlockedHero(_ id: HeroID) {
        selectHero(id)
        audio.play(.star)
        sheet = nil
    }

    /// Équipe l'objet gagné depuis l'écran de victoire.
    func equipLoot(_ uid: Int) {
        meta.equip(uid)
        audio.play(.star)
    }

    /// Laisse le plein écran du combat se refermer avant de présenter une feuille.
    private func afterCover(_ f: @escaping @MainActor (AppModel) -> Void) {
        Task { @MainActor [weak self] in
            try? await Task.sleep(for: .milliseconds(450))
            if let self { f(self) }
        }
    }

    // MARK: tournoi (§10)

    func playTournament() {
        guard let content else { return }
        let week = weekKey
        guard progress.startTournamentAttempt(week: week) else {
            show(String(localized: "Plus d’essai cette semaine"))
            return
        }
        sheet = nil
        let level = content.tournament(seed: Formulas.tournamentSeed(Date()))
        // mêmes conditions pour tous : héroïne standard, sans talents, sans bonus, tir auto
        var cfg = GameScene.Config(level: level, templates: content.templates, mode: .tournament(week: week), heroId: .scout,
                                   talents: .none, autoFire: true, reduceMotion: settings.reduceMotion, haptics: settings.haptics,
                                   dragonSkin: subscribed && wallet.snapshot.dragonSkin, skin: progress.skin)
        // ni équipement ni aides écrites en tournoi
        cfg.gear = .none
        cfg.tutorialHints = false
        launch(CombatSession(level: level, mode: .tournament(week: week), config: cfg, app: self))
    }

    func recordTournament(_ s: CombatSession, _ r: CombatResult) -> TournamentInfo {
        guard case .tournament(let week) = s.mode else {
            return TournamentInfo(won: false, score: 0, best: 0, newBest: false, kills: 0, hpLeft: 0, seconds: 0, attemptsLeft: 0, submitted: false)
        }
        let hpLeft = r.won ? r.hpFrac * r.maxHp : 0
        let score = Formulas.tournamentScore(kills: r.kills, hpLeft: hpLeft, seconds: r.seconds)
        let newBest = progress.recordTournament(score: score, week: week)
        let t = progress.tournament(week: week)
        submitBestScore(week: week)
        return TournamentInfo(won: r.won, score: score, best: t.best, newBest: newBest, kills: r.kills, hpLeft: hpLeft,
                              seconds: r.seconds, attemptsLeft: t.attempts, submitted: false)
    }

    /// Envoie (ou renvoie) le meilleur score de la semaine à Game Center.
    func submitBestScore(week: String? = nil) {
        let w = week ?? weekKey
        let t = progress.tournament(week: w)
        guard t.best > t.submitted else { return }
        Task {
            if await gameCenter.submit(score: t.best) {
                progress.markSubmitted(t.best, week: w)
                await gameCenter.loadTop()
            }
        }
    }

    /// Récompense cosmétique de la semaine passée (top 1 %, 10 %, 50 %, participation).
    func checkTournamentHonors() async {
        guard let standing = await gameCenter.previousWeekStanding() else { return }
        let prev = Formulas.isoWeek(Date().addingTimeInterval(-7 * 86_400))
        // « Semaine 45 · top 10 % » : enregistré en français (format de la sauvegarde), traduit à l'affichage (`HonorText`)
        progress.addHonor("Semaine \(prev.week) · \(GameCenterService.honorTier(rank: standing.rank, total: standing.total))")
    }

    // MARK: récompenses

    func claimTribute() {
        let g = wallet.claimWeeklyGems()
        if g > 0 {
            audio.play(.star)
            show(String(localized: "+\(g) gemmes · tribut de l’Ordre"))
        }
    }

    // MARK: pass de saison

    var currentSeason: SeasonPass.Season { SeasonPass.season(at: Date().timeIntervalSince1970) }

    /// Produit StoreKit de la piste premium de la saison en cours (un non-consommable par saison).
    var passProduct: ProductID? { ProductID(rawValue: SeasonPass.productID(season: currentSeason.number)) }

    /// Reporte le droit StoreKit de la saison en cours (achat, restauration, autre appareil) sur le pass.
    func syncPassPremium() {
        if wallet.ownsSeasonPass(season: currentSeason.number) { progress.unlockPremium() }
    }

    func buyPassPremium() async {
        guard let id = passProduct else { return show(String(localized: "Piste premium bientôt disponible")) }
        switch await store.purchase(id) {
        case .purchased:
            progress.unlockPremium()
            audio.play(.win)
            show(String(localized: "Piste premium débloquée ✓"))
        case .pending: show(String(localized: "Achat en attente de validation"))
        case .cancelled: break
        case .failed(let m): show(m)
        }
    }

    func claimPass(tier t: Int, premium: Bool) {
        if let r = progress.claimPass(tier: t, premium: premium, wallet: wallet, lives: lives) {
            audio.play(.star)
            show(String(localized: "Reçu : \(r.text)", comment: "Récompense du pass reçue"))
        }
    }

    func claimAllPass() {
        let rs = progress.claimAllPass(wallet: wallet, lives: lives)
        guard !rs.isEmpty else { return }
        audio.play(.star)
        show(Reward.summaryText(rs))
    }

    /// Achète un bonus d'avant niveau (Potion, Parchemin, Égide).
    @discardableResult
    func buyBonus(_ k: BonusKind) -> Bool {
        if wallet.buyBonus(k) {
            audio.play(.tap)
            return true
        }
        show(ShopPrices.bonus(k).currency == .gold ? String(localized: "Pas assez d’or") : String(localized: "Pas assez de gemmes"))
        return false
    }

    /// « Effacer la progression » : tout sauf les achats.
    func eraseProgress() {
        progress.reset()
        meta.reset()
        showTitle = true
    }
}
