import Foundation

/// §7 Génération d'un niveau à partir d'une graine, et déroulé complet d'un niveau — port de `sim/src/level.ts`.

public struct LevelRoom: Codable, Equatable, Sendable {
    public var template: String
    public var waves: [[SpawnSpec]]
    public var boss: BossSpec?
    public var seed: Int
    public var budget: Int
}

public struct LevelStars: Codable, Equatable, Sendable {
    public var two: Double
    public var three: Double
}

public struct LevelValidation: Codable, Equatable, Sendable {
    public var games: Int?
    public var novice: Double?
    public var moyen: Double?
    public var expert: Double?
    public var band: String?
    public var ok: Bool?
    public var avgSeconds: Double?
}

public struct LevelDef: Codable, Equatable, Sendable {
    public var n: Int
    public var chapter: Int
    public var position: Int
    public var kingdom: Int
    public var kind: LevelKind
    public var D: Double
    public var mult: Double
    public var budgetScale: Double
    public var seed: Int
    public var powerSeed: Int
    public var rooms: [LevelRoom]
    public var stars: LevelStars
    public var validation: LevelValidation?

    /// Égalité du contenu jouable (sans les statistiques de validation).
    public func sameContent(as o: LevelDef) -> Bool {
        var a = self, b = o
        a.validation = nil
        b.validation = nil
        return a == b
    }

    public var bossRoom: LevelRoom? { rooms.first { $0.boss != nil } }

    /// Types d'ennemis rencontrés (écran pré-niveau).
    public var enemyTypes: [MinionType] {
        var seen: [MinionType] = []
        for r in rooms { for w in r.waves { for s in w where !seen.contains(s.type) { seen.append(s.type) } } }
        return seen
    }
}

public struct GenOptions: Sendable {
    public var D: Double?
    public var mult: Double?
    public var kind: LevelKind?
    public var roomCount: Int?
    public var noElites = false
    public init(D: Double? = nil, mult: Double? = nil, kind: LevelKind? = nil, roomCount: Int? = nil, noElites: Bool = false) {
        self.D = D; self.mult = mult; self.kind = kind; self.roomCount = roomCount; self.noElites = noElites
    }
}

public enum LevelGen {
    /// Gabarits adaptés à un combat de boss (peu d'obstacles).
    static func bossFriendly(_ t: RoomTemplate) -> Bool {
        var n = 0
        for row in t.grid { for ch in row where "#~%".contains(ch) { n += 1 } }
        return n <= 9
    }

    /// `templates` doit être trié par identifiant (comme `loadRooms`).
    public static func generate(_ n: Int, seed: Int, templates: [RoomTemplate], budgetScale: Double = 1, opts: GenOptions = GenOptions()) -> LevelDef {
        let info = Formulas.levelInfo(n)
        let D = opts.D ?? info.D
        let mult = opts.mult ?? info.mult
        let kind = opts.kind ?? info.kind
        let roomCount = opts.roomCount ?? info.rooms
        var rng = Rng(seedOf(n, seed, 0x1e7e1))
        let unlocked = Bestiary.unlocked(chapter: info.chapter)
        let tutorialType = info.position == 1 ? Bestiary.newEnemy(at: info.chapter) : nil
        let elitesAllowed = !opts.noElites && info.chapter >= EliteK.fromChapter
        let maxElites = kind == .hard || kind == .boss ? EliteK.maxPerRoomHard : EliteK.maxPerRoom

        var used = Set<String>()
        var rooms: [LevelRoom] = []
        for i in 1...max(1, roomCount) {
            let isBossRoom = kind == .boss && i == roomCount
            let pool = templates.filter { !used.contains($0.id) && (!isBossRoom || bossFriendly($0)) }
            let tpl = rng.pick(pool.isEmpty ? templates : pool)
            used.insert(tpl.id)
            let arena = Arena(tpl)
            let budget = isBossRoom ? 0 : Formulas.roomBudget(D, mult, i, budgetScale * (kind == .boss ? K.bossLevelPreRooms : 1), roomCount)
            let types: [MinionType] = (tutorialType != nil && i == 1) ? [tutorialType!] : unlocked

            // remplissage pondéré du budget
            var picks: [(type: MinionType, elite: Bool)] = []
            var left = budget
            let minCost = types.map { Bestiary.def($0).cost }.min() ?? Int.max
            while left >= minCost {
                let afford = types.filter { Bestiary.def($0).cost <= left }
                let t = afford[rng.weighted(afford.map { Bestiary.spawnWeight($0) })]
                picks.append((t, false))
                left -= Bestiary.def(t).cost
            }
            // élites : coûtent 1,2 × leur coût en plus (pris sur les derniers ennemis tirés)
            if elitesAllowed && !(tutorialType != nil && i == 1) {
                for _ in 0..<maxElites {
                    if !rng.chance(kind == .hard ? 0.7 : 0.4) || picks.count < 3 { continue }
                    let idx = rng.int(picks.count)
                    if picks[idx].elite { continue }
                    picks[idx].elite = true
                    var extra = Int(DMath.round(Double(Bestiary.def(picks[idx].type).cost) * 1.2))
                    var j = picks.count - 1
                    while j >= 0 && extra > 0 {
                        if !picks[j].elite {
                            extra -= Bestiary.def(picks[j].type).cost
                            picks.remove(at: j)
                        }
                        j -= 1
                    }
                }
            }
            rng.shuffle(&picks)

            // vagues : ≤ waveCap(D) points de budget simultanés
            let waveCount = max(1, Int((Double(budget) / Formulas.waveCap(D, mult)).rounded(.up)))
            var waves: [[SpawnSpec]] = Array(repeating: [], count: waveCount)
            for (k, p) in picks.enumerated() {
                waves[k % waveCount].append(SpawnSpec(type: p.type, c: 0, r: 0, elite: p.elite ? true : nil))
            }

            // positions : cases libres des lignes 0–9, à ≥ 5 cases du départ
            let free = arena.freeCells().filter { c in
                c.r <= 9 && DMath.hypot(Double(c.c - 4), Double(c.r - (K.rows - 1))) >= 5 && !(c.r == 0 && c.c == 4)
            }
            for w in 0..<waves.count {
                var cells = free
                rng.shuffle(&cells)
                for s in 0..<waves[w].count {
                    let type = waves[w][s].type
                    let stationary = type == .mushroom || type == .totem
                    // fixes : loin des murs et des obstacles, pour qu'on puisse en faire le tour (DECISIONS #42)
                    var idx = cells.firstIndex { !stationary || ($0.r >= 2 && $0.r <= 7 && clearCells(arena, $0.c, $0.r) >= 2) } ?? -1
                    if idx < 0 { idx = cells.firstIndex { !stationary || ($0.r >= 2 && $0.r <= 7 && clearCells(arena, $0.c, $0.r) >= 1) } ?? -1 }
                    if idx < 0 { idx = cells.firstIndex { !stationary || ($0.r >= 1 && $0.r <= 7) } ?? -1 }
                    if idx < 0 { idx = 0 }
                    let cell: (c: Int, r: Int)
                    if idx < cells.count {
                        cell = cells.remove(at: idx)
                    } else {
                        cell = (rng.int(K.cols), 2)
                    }
                    waves[w][s].c = cell.c
                    waves[w][s].r = cell.r
                }
            }

            rooms.append(LevelRoom(
                template: tpl.id,
                waves: waves.filter { !$0.isEmpty },
                boss: isBossRoom ? BossSpec(archetype: Bosses.byKingdom[(info.kingdom - 1) % 5], variant: (info.chapter - 1) % 3, hpMult: Formulas.round3(budgetScale)) : nil,
                seed: Int(rng.nextU32()),
                budget: budget))
        }
        return LevelDef(n: n, chapter: info.chapter, position: info.position, kingdom: info.kingdom, kind: kind,
                        D: Formulas.round3(D), mult: mult, budgetScale: Formulas.round3(budgetScale), seed: seed,
                        powerSeed: Int(rng.nextU32()), rooms: rooms, stars: LevelStars(two: 0.5, three: 0.8), validation: nil)
    }

    /// Nombre de cases libres autour de (c, r) dans toutes les directions (anneaux de Tchebychev), murs compris.
    static func clearCells(_ arena: Arena, _ c: Int, _ r: Int) -> Int {
        for k in 1...3 {
            for dr in -k...k {
                for dc in -k...k {
                    if max(abs(dc), abs(dr)) != k { continue }
                    let cc = c + dc
                    let rr = r + dr
                    if cc < 0 || rr < 0 || cc >= K.cols || rr >= K.rows || arena.blocksWalk(cc, rr) { return k - 1 }
                }
            }
        }
        return 3
    }

    /// Niveau du tournoi hebdomadaire (§10) : 4 salles, difficulté du niveau 120 (difficile), graine = semaine ISO.
    /// Identique à `playTournament` du prototype web.
    public static func tournament(seed: Int, templates: [RoomTemplate]) -> LevelDef {
        generate(120, seed: seed, templates: templates, budgetScale: 1, opts: GenOptions(mult: 1.35, kind: .hard, roomCount: 4))
    }

    /// Offre de 3 pouvoirs distincts (tirage à graine), sans pouvoir déjà au maximum.
    public static func offerPowers(_ rng: inout Rng, owned: [PowerID: Int], count: Int = 3) -> [PowerID] {
        var offer: [PowerID] = []
        func eligible(_ id: PowerID) -> Bool { !offer.contains(id) && (owned[id] ?? 0) < Powers.def(id).maxStacks }
        let rarities: [Rarity] = [.common, .rare, .epic]
        for _ in 0..<count {
            let r = rng.weighted([RarityWeights.common, RarityWeights.rare, RarityWeights.epic])
            let rarity = rarities[r]
            var pool = Powers.all.filter { $0.rarity == rarity && eligible($0.id) }
            if pool.isEmpty { pool = Powers.all.filter { eligible($0.id) } }
            if pool.isEmpty { break }
            offer.append(rng.pick(pool).id)
        }
        return offer
    }

    /// Offre du Parchemin (bonus avant niveau) : comme le web, graine `powerSeed ^ 0x5c`.
    public static func scrollOffer(_ level: LevelDef) -> [PowerID] {
        var rng = Rng(UInt32(truncatingIfNeeded: level.powerSeed) ^ 0x5c)
        return offerPowers(&rng, owned: [:])
    }
}

// MARK: - déroulé (bots, tests, rejeu des traces)

public struct ChoiceContext {
    public let level: LevelDef
    /// Index (0-based) de la salle qui suit le choix.
    public let nextRoom: Int
    public let hero: HeroState
}

public protocol Controller: AnyObject {
    func beginRoom(_ world: World)
    func input(_ world: World) -> HeroInput
    func choosePower(_ offer: [PowerID], _ ctx: ChoiceContext) -> PowerID
}

public extension Controller {
    func beginRoom(_ world: World) {}
}

public struct RunOptions {
    public var talents: Talents = .none
    public var heroId: HeroID = .scout
    public var attemptSeed = 0
    public var potion = false
    public var aegis = false
    public var scroll: PowerID?
    public var timeLimit: Double = 300
    public var autoFire = K.autoFireDefault
    public var onStep: ((World) -> Void)?
    public init() {}
}

public struct RunResult: Equatable {
    public var won: Bool
    public var hpFrac: Double
    public var hpLeft: Double
    public var seconds: Double
    public var kills: Int
    public var stars: Int
    public var roomsCleared: Int
    public var powers: [PowerID]
    public var hitsTaken: Int
    public var timeout: Bool
    public var cuts: Int
    public var dmgBy: DamageBySource
}

public enum LevelRunner {
    /// Prépare l'héroïne d'une tentative : héros, parchemin, potion, égide (identique à `runLevel` et au web).
    public static func makeHero(talents: Talents, heroId: HeroID, autoFire: Bool, potion: Bool, aegis: Bool, scroll: PowerID?) -> HeroState {
        let hero = HeroState(talents: talents, powers: [:], autoFire: autoFire)
        if let sp = Heroes.def(heroId).startPower { hero.grant(sp) }
        if let scroll { hero.grant(scroll) }
        if potion {
            hero.stats.maxHp = DMath.round(hero.stats.maxHp * 1.25)
            hero.hp = hero.stats.maxHp
        }
        if aegis { hero.shieldReady = true }
        return hero
    }

    public static func run(_ level: LevelDef, templates: [String: RoomTemplate], controller: Controller, options opt: RunOptions = RunOptions()) -> RunResult {
        let hero = makeHero(talents: opt.talents, heroId: opt.heroId, autoFire: opt.autoFire, potion: opt.potion, aegis: opt.aegis, scroll: opt.scroll)
        var powerRng = Rng(seed: level.powerSeed)
        var t = 0.0
        var kills = 0
        var taken: [PowerID] = []
        for i in 0..<level.rooms.count {
            let room = level.rooms[i]
            if i > 0 {
                hero.hp = DMath.min(hero.stats.maxHp, hero.hp + hero.stats.maxHp * K.healBetweenRooms)
                let offer = LevelGen.offerPowers(&powerRng, owned: hero.powers)
                var pick = controller.choosePower(offer, ChoiceContext(level: level, nextRoom: i, hero: hero))
                if !offer.contains(pick), let first = offer.first { pick = first }
                hero.grant(pick)
                taken.append(pick)
            }
            guard let tpl = templates[room.template] else { fatalError("gabarit inconnu : \(room.template)") }
            let world = World(RoomSetup(arena: Arena(tpl), D: level.D, waves: room.waves, boss: room.boss,
                                        seed: seedOf(room.seed, opt.attemptSeed)), hero: hero)
            controller.beginRoom(world)
            let isLast = i == level.rooms.count - 1
            while !world.dead && !(isLast ? world.cleared : world.exited) {
                world.step(controller.input(world))
                opt.onStep?(world)
                t += K.simDT
                if t > opt.timeLimit {
                    return result(false, hero, t, kills + world.kills, i, taken, true)
                }
            }
            kills += world.kills
            if world.dead { return result(false, hero, t, kills, i, taken, false) }
        }
        return result(true, hero, t, kills, level.rooms.count, taken, false)
    }

    static func result(_ won: Bool, _ hero: HeroState, _ seconds: Double, _ kills: Int, _ rooms: Int, _ powers: [PowerID], _ timeout: Bool) -> RunResult {
        let hpLeft = DMath.max(0, hero.hp)
        let hpFrac = hpLeft / hero.stats.maxHp
        return RunResult(won: won, hpFrac: hpFrac, hpLeft: hpLeft, seconds: seconds, kills: kills, stars: Formulas.stars(won: won, hpFrac: hpFrac),
                         roomsCleared: rooms, powers: powers, hitsTaken: hero.hitsTaken, timeout: timeout, cuts: hero.cuts, dmgBy: hero.dmgBy)
    }
}
