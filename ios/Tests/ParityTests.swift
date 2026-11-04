import Foundation
import XCTest
@testable import Ombrelune

/// Parité TS ↔ Swift (TASKS M7) : rejoue les traces enregistrées par `pnpm traces`
/// (`tools/src/replay-traces.ts` → `content/traces/*.json`) dans le port Swift et exige des états identiques
/// au bit près (empreinte `StateHash` tous les 15 pas, résultat final).
final class ParityTests: XCTestCase {
    // MARK: mathématiques

    func testMathMatchesV8() throws {
        let data = try TestContent.trace("math.json")
        let m = try JSONDecoder().decode(MathTrace.self, from: data)
        var bad = 0
        for row in m.rows {
            let v = row.map(TestContent.double(hex:))
            let checks: [(String, Double, Double)] = [
                ("sin", DMath.sin(v[0]), v[1]), ("cos", DMath.cos(v[0]), v[2]),
                ("atan2", DMath.atan2(v[3], v[4]), v[5]), ("hypot", DMath.hypot(v[3], v[4]), v[6]),
                ("pow", DMath.pow(v[7], v[8]), v[9]),
            ]
            for (name, got, want) in checks where got.bitPattern != want.bitPattern {
                bad += 1
                if bad < 10 { XCTFail("\(name) : \(got) ≠ \(want) (V8)") }
            }
        }
        XCTAssertEqual(bad, 0)
        XCTAssertGreaterThan(m.rows.count, 1000)
    }

    // MARK: génération

    func testLevelGenerationMatchesTypeScript() throws {
        let store = try TestContent.store()
        let t = try JSONDecoder().decode(LevelsTrace.self, from: TestContent.trace("levels.json"))
        XCTAssertGreaterThan(t.levels.count, 20)
        for e in t.levels {
            let got: LevelDef = e.source == "tournament"
                ? LevelGen.tournament(seed: e.seed, templates: store.rooms)
                : LevelGen.generate(e.n, seed: e.seed, templates: store.rooms, budgetScale: e.budgetScale)
            XCTAssertTrue(got.sameContent(as: e.def), "niveau \(e.n) (\(e.source), graine \(e.seed)) différent du TypeScript")
        }
    }

    // MARK: niveaux joués

    func testRunTracesReplayIdentically() throws {
        let store = try TestContent.store()
        let files = try TestContent.traceFiles(prefix: "run_")
        XCTAssertGreaterThanOrEqual(files.count, 5, "traces de niveaux manquantes : lancer `pnpm traces`")
        for f in files {
            let trace = try JSONDecoder().decode(RunTrace.self, from: Data(contentsOf: f))
            try replay(trace, store: store)
        }
    }

    private func replay(_ trace: RunTrace, store: ContentStore) throws {
        let level = trace.level.source == "tournament"
            ? LevelGen.tournament(seed: trace.level.seed, templates: store.rooms)
            : LevelGen.generate(trace.level.n, seed: trace.level.seed, templates: store.rooms, budgetScale: trace.level.budgetScale)
        let ctl = ReplayController(inputs: trace.inputs, choices: trace.choices)
        var snaps = trace.snapshots[...]
        var tick = 0
        var failure: String?
        var opt = RunOptions()
        opt.talents = trace.options.talents
        opt.heroId = HeroID(rawValue: trace.options.heroId) ?? .scout
        opt.attemptSeed = trace.options.attemptSeed
        opt.potion = trace.options.potion
        opt.aegis = trace.options.aegis
        opt.scroll = trace.options.scroll.flatMap(PowerID.init(rawValue:))
        opt.autoFire = trace.options.autoFire
        opt.timeLimit = trace.options.timeLimit
        opt.onStep = { w in
            tick += 1
            guard failure == nil, tick % 15 == 0 || w.dead || w.cleared || w.exited else { return }
            guard let s = snaps.first else { return }
            snaps = snaps.dropFirst()
            failure = Self.compare(s, w, tick: tick)
        }
        let r = LevelRunner.run(level, templates: store.templates, controller: ctl, options: opt)
        if let failure { return XCTFail("\(trace.name) : \(failure)") }
        XCTAssertTrue(snaps.isEmpty, "\(trace.name) : \(snaps.count) empreintes non atteintes (partie plus courte)")
        XCTAssertEqual(tick, trace.ticks, "\(trace.name) : nombre de pas")
        XCTAssertFalse(ctl.overrun, "\(trace.name) : plus de pas que d'entrées enregistrées")
        let e = trace.result
        XCTAssertEqual(r.won, e.won, trace.name)
        XCTAssertEqual(r.stars, e.stars, trace.name)
        XCTAssertEqual(r.kills, e.kills, trace.name)
        XCTAssertEqual(r.roomsCleared, e.roomsCleared, trace.name)
        XCTAssertEqual(r.powers.map(\.rawValue), e.powers, trace.name)
        XCTAssertEqual(r.hitsTaken, e.hitsTaken, trace.name)
        XCTAssertEqual(r.timeout, e.timeout, trace.name)
        XCTAssertEqual(r.cuts, e.cuts, trace.name)
        XCTAssertEqual(r.hpLeft.bitPattern, TestContent.double(hex: e.hpLeft).bitPattern, "\(trace.name) : PV restants")
        XCTAssertEqual(r.seconds.bitPattern, TestContent.double(hex: e.seconds).bitPattern, "\(trace.name) : durée")
        XCTAssertEqual(r.dmgBy.cut.bitPattern, TestContent.double(hex: e.dmgBy.cut).bitPattern, "\(trace.name) : dégâts des découpes")
        XCTAssertEqual(r.dmgBy.shot.bitPattern, TestContent.double(hex: e.dmgBy.shot).bitPattern, "\(trace.name) : dégâts des aiguilles")
        XCTAssertEqual(r.dmgBy.other.bitPattern, TestContent.double(hex: e.dmgBy.other).bitPattern, "\(trace.name) : autres dégâts")
    }

    // MARK: salles scriptées

    func testRoomTracesReplayIdentically() throws {
        let store = try TestContent.store()
        let files = try TestContent.traceFiles(prefix: "room_")
        XCTAssertGreaterThanOrEqual(files.count, 5, "traces de salles manquantes : lancer `pnpm traces`")
        for f in files {
            let tr = try JSONDecoder().decode(RoomTrace.self, from: Data(contentsOf: f))
            guard let tpl = store.templates[tr.room.template] else { return XCTFail("gabarit \(tr.room.template)") }
            var powers: [PowerID: Int] = [:]
            for (k, v) in tr.hero.powers { if let id = PowerID(rawValue: k) { powers[id] = v } }
            let hero = HeroState(talents: tr.hero.talents, powers: powers, autoFire: true)
            if let hp = tr.hero.hp {
                hero.stats.maxHp = hp
                hero.hp = hp
            }
            let w = World(RoomSetup(arena: Arena(tpl), D: tr.room.D, waves: tr.room.waves, boss: tr.room.boss, seed: UInt32(tr.room.seed)), hero: hero)
            let inputs = ReplayController.expand(tr.inputs)
            var snaps = tr.snapshots[...]
            var tick = 0
            var failure: String?
            while tick < tr.ticks && !w.dead && !w.exited {
                w.step(inputs[tick])
                tick += 1
                if tick % 15 == 0 || w.dead, let s = snaps.first {
                    snaps = snaps.dropFirst()
                    if let f = Self.compare(s, w, tick: tick) { failure = f; break }
                }
            }
            if let failure { XCTFail("\(tr.name) : \(failure)"); continue }
            XCTAssertEqual(tick, tr.ticks, tr.name)
            XCTAssertEqual(w.kills, tr.final.kills, tr.name)
            XCTAssertEqual(w.cleared, tr.final.cleared, tr.name)
            XCTAssertEqual(w.dead, tr.final.dead, tr.name)
            XCTAssertEqual(w.hero.cuts, tr.final.cuts, tr.name)
            XCTAssertEqual(StateHash.of(w), tr.final.hash, tr.name)
        }
    }

    /// Compare une empreinte ; renvoie un diagnostic lisible au premier écart.
    static func compare(_ s: Snap, _ w: World, tick: Int) -> String? {
        let h = StateHash.of(w)
        if s.tick == tick && h == s.hash { return nil }
        return String(format: "écart au pas %d (attendu pas %d) — empreinte %08x ≠ %08x ; t %.4f/%.4f héroïne (%.3f, %.3f)/(%.3f, %.3f) PV %.2f/%.2f ennemis %d/%d projectiles %d/%d morts %d/%d fil %d/%d",
                      tick, s.tick, h, s.hash, w.t, s.t, w.hero.pos.x, w.hero.pos.y, s.x, s.y, w.hero.hp, s.hp,
                      w.enemies.count, s.enemies, w.projectiles.count, s.projectiles, w.kills, s.kills, w.hero.thread.count, s.thread)
    }
}

// MARK: - rejeu

final class ReplayController: Controller {
    let inputs: [HeroInput]
    var choices: ArraySlice<Choice>
    var i = 0
    var overrun = false

    init(inputs: [InputRun], choices: [Choice]) {
        self.inputs = Self.expand(inputs)
        self.choices = choices[...]
    }

    static func expand(_ runs: [InputRun]) -> [HeroInput] {
        var out: [HeroInput] = []
        for r in runs {
            let inp = HeroInput(mx: TestContent.double(hex: r.mx), my: TestContent.double(hex: r.my), touching: r.touching)
            out.append(contentsOf: repeatElement(inp, count: r.count))
        }
        return out
    }

    func input(_ world: World) -> HeroInput {
        guard i < inputs.count else { overrun = true; return .idle }
        defer { i += 1 }
        return inputs[i]
    }

    func choosePower(_ offer: [PowerID], _ ctx: ChoiceContext) -> PowerID {
        guard let c = choices.popFirst() else { return offer[0] }
        XCTAssertEqual(offer.map(\.rawValue), c.offer, "offre de pouvoirs différente")
        return PowerID(rawValue: c.pick) ?? offer[0]
    }
}

// MARK: - formats des traces

struct MathTrace: Decodable { var rows: [[String]] }

struct LevelsTrace: Decodable {
    struct Entry: Decodable {
        var source: String
        var n: Int
        var seed: Int
        var budgetScale: Double
        var def: LevelDef
    }
    var levels: [Entry]
}

struct InputRun: Decodable {
    var count: Int
    var mx: String
    var my: String
    var touching: Bool
    init(from decoder: Decoder) throws {
        var c = try decoder.unkeyedContainer()
        count = try c.decode(Int.self)
        mx = try c.decode(String.self)
        my = try c.decode(String.self)
        touching = try c.decode(Int.self) != 0
    }
}

struct Choice: Decodable {
    var offer: [String]
    var pick: String
}

struct Snap: Decodable {
    var tick: Int
    var hash: UInt32
    var t: Double
    var x: Double
    var y: Double
    var hp: Double
    var enemies: Int
    var projectiles: Int
    var kills: Int
    var thread: Int
}

struct RunTrace: Decodable {
    struct LevelRef: Decodable {
        var source: String
        var n: Int
        var seed: Int
        var budgetScale: Double
    }
    struct Options: Decodable {
        var talents: Talents
        var heroId: String
        var attemptSeed: Int
        var potion: Bool
        var aegis: Bool
        var scroll: String?
        var autoFire: Bool
        var timeLimit: Double
    }
    struct Result: Decodable {
        struct Dmg: Decodable { var cut: String; var shot: String; var other: String }
        var won: Bool
        var stars: Int
        var kills: Int
        var roomsCleared: Int
        var powers: [String]
        var hitsTaken: Int
        var timeout: Bool
        var cuts: Int
        var hpLeft: String
        var hpFrac: String
        var seconds: String
        var dmgBy: Dmg
    }
    var name: String
    var level: LevelRef
    var options: Options
    var ticks: Int
    var inputs: [InputRun]
    var choices: [Choice]
    var snapshots: [Snap]
    var result: Result
}

struct RoomTrace: Decodable {
    struct Room: Decodable {
        var template: String
        var D: Double
        var waves: [[SpawnSpec]]
        var boss: BossSpec?
        var seed: Int
    }
    struct Hero: Decodable {
        var talents: Talents
        var powers: [String: Int]
        var hp: Double?
    }
    struct Final: Decodable {
        var kills: Int
        var cleared: Bool
        var dead: Bool
        var cuts: Int
        var hash: UInt32
    }
    var name: String
    var room: Room
    var hero: Hero
    var ticks: Int
    var inputs: [InputRun]
    var snapshots: [Snap]
    var final: Final
}

// MARK: - accès aux contenus

enum TestContent {
    private final class Token {}

    /// Racine du dépôt : variable `OMBRELUNE_REPO`, sinon déduite de l'emplacement de ce fichier (`ios/Tests/`).
    static var repoRoot: URL {
        if let env = ProcessInfo.processInfo.environment["OMBRELUNE_REPO"] { return URL(fileURLWithPath: env) }
        return URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
    }

    /// Dossier des traces : ressource du paquet de tests (`traces/`), sinon `content/traces` du dépôt.
    static func tracesDir() -> URL {
        if let env = ProcessInfo.processInfo.environment["OMBRELUNE_TRACES"] { return URL(fileURLWithPath: env) }
        if let u = Bundle(for: Token.self).url(forResource: "traces", withExtension: nil) { return u }
        return repoRoot.appendingPathComponent("content/traces")
    }

    static func trace(_ name: String) throws -> Data {
        try Data(contentsOf: tracesDir().appendingPathComponent(name))
    }

    static func traceFiles(prefix: String) throws -> [URL] {
        try FileManager.default.contentsOfDirectory(at: tracesDir(), includingPropertiesForKeys: nil)
            .filter { $0.lastPathComponent.hasPrefix(prefix) && $0.pathExtension == "json" }
            .sorted { $0.lastPathComponent < $1.lastPathComponent }
    }

    /// Contenus du jeu : ceux de l'app hôte (`rooms/`, `levels/`), sinon `content/` du dépôt.
    static func store() throws -> ContentStore {
        if let s = try? ContentStore.bundled(.main) { return s }
        if let s = try? ContentStore.bundled(Bundle(for: Token.self)) { return s }
        let root = repoRoot.appendingPathComponent("content")
        return try ContentStore(roomsDir: root.appendingPathComponent("rooms"), levelsDir: root.appendingPathComponent("levels"))
    }

    static func double(hex: String) -> Double { Double(bitPattern: UInt64(hex, radix: 16) ?? 0) }
}
