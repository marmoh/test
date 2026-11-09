import Foundation
import Observation
import SpriteKit

enum CombatMode: Equatable {
    case saga
    /// Tournoi hebdomadaire (§10) : semaine ISO « 2026-W45 ».
    case tournament(week: String)

    var isTournament: Bool { if case .tournament = self { true } else { false } }
}

/// Résultat d'une tentative (port de `CombatResult`, `web/src/combat.ts`).
struct CombatResult: Equatable {
    var won: Bool
    var stars: Int
    var hpFrac: Double
    var hpLeft: Double
    var seconds: Double
    var kills: Int
    var continues: Int
    var maxHp: Double
    /// Ennemis vaincus par type (`Enemy.typeName`, « boss:<archétype> » pour un boss) : quêtes et bestiaire (DECISIONS #76).
    var killsByType: [String: Int] = [:]
    /// Découpes, ennemis touchés par une bourrasque, ennemis mis à brûler (quête « mécanique signature »).
    var signatureHits = 0
}

enum DefeatChoice { case revive, retry, map }
enum PauseChoice { case resume, quit }

/// Ce que la scène demande au reste de l'app (les « hooks » du prototype web).
@MainActor
protocol CombatHooks: AnyObject {
    func choosePower(_ offer: [PowerID], hero: HeroState, room: Int) async -> PowerID
    func defeat(continuesUsed: Int) async -> DefeatChoice
    func pause() async -> PauseChoice
    func finish(_ r: CombatResult)
    func tournamentOver(_ r: CombatResult)
    func retry()
    func quit()
    func roomChanged(_ index: Int)
}

/// Résumé affiché à la victoire.
struct VictoryInfo: Equatable {
    var level: Int
    var stars: Int
    var gold: Int
    var kills: Int
    var seconds: Double
    var dragonBonus: Bool
    /// Lunes du pass gagnées ; palier atteint s'il a changé.
    var passPoints: Int
    var newTier: Int?
    /// Coffres d'étoiles ouverts par cette victoire (déjà crédités) : « Coffre d'étoiles (40 ★) : +200 or · … ».
    var chests: [String]
    var isLast: Bool
}

/// Résumé affiché à la fin d'un essai de tournoi.
struct TournamentInfo: Equatable {
    var won: Bool
    var score: Int
    var best: Int
    var newBest: Bool
    var kills: Int
    var hpLeft: Double
    var seconds: Double
    var attemptsLeft: Int
    var submitted: Bool
}

/// Une tentative en cours : relie la scène SpriteKit (`GameScene`) aux écrans SwiftUI superposés
/// (choix du pouvoir, pause, défaite, victoire) et à l'app (`AppModel`) pour la persistance.
@MainActor
@Observable
final class CombatSession: Identifiable {
    enum Overlay: Equatable {
        case powers(offer: [PowerID], owned: [PowerID: Int], title: String)
        case pause
        case defeat(continuesUsed: Int)
        case victory(VictoryInfo)
        case tournament(TournamentInfo)
    }

    let id = UUID()
    let level: LevelDef
    let mode: CombatMode
    let config: GameScene.Config
    private(set) var scene: GameScene?
    var overlay: Overlay?
    private(set) var roomIndex = 0
    var roomCount: Int { level.rooms.count }

    @ObservationIgnored private var powerC: CheckedContinuation<PowerID, Never>?
    @ObservationIgnored private var defeatC: CheckedContinuation<DefeatChoice, Never>?
    @ObservationIgnored private var pauseC: CheckedContinuation<PauseChoice, Never>?
    @ObservationIgnored weak var app: AppModel?

    init(level: LevelDef, mode: CombatMode, config: GameScene.Config, app: AppModel?) {
        self.level = level
        self.mode = mode
        self.config = config
        self.app = app
    }

    /// Prépare la scène. Parchemin : choisir d'abord un pouvoir de départ parmi trois.
    func start() async {
        guard scene == nil else { return }
        var cfg = config
        if cfg.scrollPending {
            let offer = LevelGen.scrollOffer(level, signature: Heroes.def(cfg.heroId).family)
            cfg.scroll = await ask(offer, owned: [:], title: String(localized: "Parchemin : pouvoir de départ"))
            cfg.scrollPending = false
        }
        let s = GameScene(config: cfg, audio: app?.audio, haptics: app?.haptics)
        s.hooks = self
        scene = s
    }

    private func ask(_ offer: [PowerID], owned: [PowerID: Int], title: String) async -> PowerID {
        await withCheckedContinuation { c in
            powerC = c
            overlay = .powers(offer: offer, owned: owned, title: title)
        }
    }

    // MARK: réponses des écrans

    func pick(_ id: PowerID) {
        overlay = nil
        powerC?.resume(returning: id)
        powerC = nil
    }

    func resolveDefeat(_ c: DefeatChoice) {
        overlay = nil
        defeatC?.resume(returning: c)
        defeatC = nil
    }

    func resolvePause(_ c: PauseChoice) {
        overlay = nil
        pauseC?.resume(returning: c)
        pauseC = nil
    }

    func requestPause() { scene?.openPause() }

    /// Libère la scène (fin de la tentative) ; débloque une éventuelle attente.
    func tearDown() {
        powerC?.resume(returning: .damage)
        powerC = nil
        defeatC?.resume(returning: .map)
        defeatC = nil
        pauseC?.resume(returning: .quit)
        pauseC = nil
        scene?.destroy()
        scene = nil
    }
}

extension CombatSession: CombatHooks {
    func choosePower(_ offer: [PowerID], hero: HeroState, room: Int) async -> PowerID {
        await ask(offer, owned: hero.powers, title: String(localized: "Choisis un pouvoir"))
    }

    func defeat(continuesUsed: Int) async -> DefeatChoice {
        await withCheckedContinuation { c in
            defeatC = c
            overlay = .defeat(continuesUsed: continuesUsed)
        }
    }

    func pause() async -> PauseChoice {
        await withCheckedContinuation { c in
            pauseC = c
            overlay = .pause
        }
    }

    func finish(_ r: CombatResult) {
        guard let info = app?.recordVictory(self, r) else { return }
        overlay = .victory(info)
    }

    func tournamentOver(_ r: CombatResult) {
        guard let info = app?.recordTournament(self, r) else { return }
        overlay = .tournament(info)
    }

    func retry() { app?.retry(self) }
    func quit() { app?.quit(self) }
    func roomChanged(_ index: Int) { roomIndex = index }
}
