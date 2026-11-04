import Foundation
import XCTest
@testable import Ombrelune

/// Simulation Swift : bornes §13, formules §7/§8/§10, contrôles §2, contenus (mêmes vérifications que `sim/test`).
final class CoreTests: XCTestCase {
    // MARK: §13 bornes (port de `sim/test/bounds.test.ts`)

    func testBoundsUnderLoad() throws {
        let store = try TestContent.store()
        let room = store.rooms[0]
        let kinds: [MinionType] = [.totem, .mushroom, .skeleton, .jelly]
        var wave: [SpawnSpec] = []
        for i in 0..<60 {
            wave.append(SpawnSpec(type: kinds[i % 4], c: i % 9, r: (i / 9) % 9, elite: i % 5 == 0 ? true : nil))
        }
        let hero = HeroState(talents: .none, powers: [.multishot: 2, .diagonals: 1, .sideShots: 1, .rearShot: 1, .attackSpeed: 3], autoFire: true)
        hero.stats.maxHp = 1e9
        hero.hp = 1e9
        let w = World(RoomSetup(arena: Arena(room), D: 12, waves: [wave, wave], boss: nil, seed: 1), hero: hero)
        var maxE = 0
        var maxP = 0
        for i in 0..<(30 * 40) {
            w.step(HeroInput(mx: Foundation.sin(Double(i) / 20), my: Foundation.cos(Double(i) / 31), touching: i % 90 < 60))
            maxE = max(maxE, w.enemies.count)
            maxP = max(maxP, w.projectiles.count)
            XCTAssertLessThanOrEqual(w.enemies.count, K.maxEnemies)
            XCTAssertLessThanOrEqual(w.projectiles.count, K.maxProjectiles)
        }
        XCTAssertEqual(maxE, K.maxEnemies, "30 ennemis simultanés atteints")
        XCTAssertGreaterThan(Double(maxP), Double(K.maxProjectiles) * 0.6, "salle réellement saturée")
    }

    /// Budget de temps : une salle saturée (30 ennemis, 150 projectiles) doit tenir dans une image à 60 i/s.
    func testSaturatedStepCost() throws {
        let store = try TestContent.store()
        var wave: [SpawnSpec] = []
        for i in 0..<40 { wave.append(SpawnSpec(type: [.skeleton, .totem, .jelly, .moth][i % 4], c: i % 9, r: (i / 9) % 9)) }
        let hero = HeroState(talents: .none, powers: [.multishot: 2, .diagonals: 1, .attackSpeed: 3, .chain: 1, .orb: 1], autoFire: true)
        hero.stats.maxHp = 1e9
        hero.hp = 1e9
        let w = World(RoomSetup(arena: Arena(store.rooms[4]), D: 10, waves: [wave], boss: nil, seed: 9), hero: hero)
        for i in 0..<120 { w.step(HeroInput(mx: Foundation.cos(Double(i) * 0.12), my: Foundation.sin(Double(i) * 0.12), touching: true)) }
        let start = Date()
        let steps = 300
        for i in 0..<steps { w.step(HeroInput(mx: Foundation.cos(Double(i) * 0.12), my: Foundation.sin(Double(i) * 0.12), touching: true)) }
        let perStep = Date().timeIntervalSince(start) / Double(steps)
        // 2 pas de simulation par image au pire (30 Hz sous 60 i/s), dans 4 ms en débogage sur le simulateur
        XCTAssertLessThan(perStep, 0.004, "pas de simulation trop lent : \(perStep * 1000) ms")
    }

    // MARK: déterminisme

    func testRngMatchesMulberry32() {
        var a = Rng(42)
        var b = Rng(42)
        for _ in 0..<100 { XCTAssertEqual(a.nextU32(), b.nextU32()) }
        var c = Rng(1)
        var d = Rng(2)
        XCTAssertNotEqual(c.nextU32(), d.nextU32())
        // valeurs de référence calculées par `sim/src/rng.ts`
        var r = Rng(1)
        XCTAssertEqual([r.nextU32(), r.nextU32(), r.nextU32()], [2_693_262_067, 11_749_833, 2_265_367_787])
        var base = Rng(99)
        var f = base.fork(5)
        XCTAssertEqual(f.nextU32(), 1_549_403_805)
    }

    func testSeedOfAndHash() {
        XCTAssertEqual(seedOf(1, 2), 2_917_171_162)
        XCTAssertEqual(seedOf(3, 0x1e7e1), 585_743_002)
        XCTAssertEqual(hash32(12345), 2_435_775_735)
        XCTAssertEqual(hash32(0), 0)
        XCTAssertNotEqual(seedOf(1, 2), seedOf(2, 1))
        XCTAssertEqual(seedOf(-1), seedOf(Int(UInt32.max)))
    }

    // MARK: formules

    func testFormulas() {
        XCTAssertEqual(Formulas.chapterOf(1), 1)
        XCTAssertEqual(Formulas.chapterOf(20), 1)
        XCTAssertEqual(Formulas.chapterOf(21), 2)
        XCTAssertEqual(Formulas.kingdomOf(60), 1)
        XCTAssertEqual(Formulas.kingdomOf(61), 2)
        XCTAssertEqual(Formulas.levelKind(7), .hard)
        XCTAssertEqual(Formulas.levelKind(20), .boss)
        XCTAssertEqual(Formulas.levelKind(21), .tutorial)
        XCTAssertEqual(Formulas.roomCount(20), 2)
        XCTAssertEqual(Formulas.roomCount(120), 3)
        XCTAssertEqual(Formulas.roomCount(121), 4)
        XCTAssertEqual(Formulas.stars(won: true, hpFrac: 0.8), 3)
        XCTAssertEqual(Formulas.stars(won: true, hpFrac: 0.5), 2)
        XCTAssertEqual(Formulas.stars(won: true, hpFrac: 0.1), 1)
        XCTAssertEqual(Formulas.stars(won: false, hpFrac: 1), 0)
        XCTAssertEqual(Formulas.goldReward(10, firstThreeStars: false), 40)
        XCTAssertEqual(Formulas.goldReward(10, firstThreeStars: true), 60)
        XCTAssertEqual(Formulas.goldReward(10, firstThreeStars: false, goldBonus: 0.25), 50)
        XCTAssertEqual(Formulas.tournamentScore(kills: 42, hpLeft: 380, seconds: 150), 42 * 100 + 380 * 5 + 90 * 40)
        XCTAssertEqual(Formulas.tournamentScore(kills: 1, hpLeft: 0, seconds: 300), 100)
        XCTAssertEqual(Formulas.talentCost(0), 50)
        XCTAssertEqual(DMath.round(-2.5), -2)
        XCTAssertEqual(DMath.round(2.5), 3)
    }

    func testIsoWeekSeed() {
        // 4 novembre 2026 : semaine ISO 45 ; 1er janvier 2027 (vendredi) : semaine 53 de 2026
        let d1 = Date(timeIntervalSince1970: 1_793_793_600)
        XCTAssertEqual(Formulas.tournamentSeed(d1), 202_645)
        XCTAssertEqual(Formulas.weekKey(d1), "2026-W45")
        let d2 = Date(timeIntervalSince1970: 1_798_761_600) // 2027-01-01 00:00 UTC
        XCTAssertEqual(Formulas.isoWeek(d2).year, 2026)
        XCTAssertEqual(Formulas.isoWeek(d2).week, 53)
    }

    // MARK: §2 contrôles (port de `sim/test/controls.test.ts`)

    func testFloatingAnchor() {
        var a = FloatingAnchor()
        a.down(1, Vec(100, 100))
        XCTAssertEqual(a.intent(), Vec(0, 0))
        a.move(1, Vec(105, 100))
        XCTAssertEqual(a.intent(), Vec(0, 0), "zone morte de 8 pt")
        a.move(1, Vec(128, 100))
        XCTAssertEqual(a.intent().x, 0.5, accuracy: 1e-12)
        a.move(1, Vec(300, 100))
        XCTAssertEqual(a.anchor!.x, 230, accuracy: 1e-9, "l'ancre glisse pour rester à 70 pt")
        XCTAssertEqual(a.intent().x, 1, accuracy: 1e-12)
        a.down(2, Vec(0, 0))
        XCTAssertEqual(a.anchor!.x, 230, accuracy: 1e-9, "le deuxième doigt est ignoré")
        a.up(2)
        XCTAssertTrue(a.touching)
        a.up(1)
        XCTAssertFalse(a.touching)
    }

    // MARK: contenus

    func testRoomsAreValid() throws {
        let store = try TestContent.store()
        XCTAssertEqual(store.rooms.count, 24)
        for r in store.rooms { XCTAssertEqual(validateRoom(r), [], r.id) }
    }

    func testAllLevelsLoadAndAreConsistent() throws {
        let store = try TestContent.store()
        var stale: [Int] = []
        for n in 1...K.levelCount {
            let l = store.level(n)
            XCTAssertEqual(l.n, n)
            XCTAssertFalse(l.rooms.isEmpty)
            for r in l.rooms { XCTAssertNotNil(store.templates[r.template], "niveau \(n) : gabarit \(r.template)") }
            if Formulas.levelKind(n) == .boss { XCTAssertNotNil(l.bossRoom, "niveau \(n) : salle du boss") }
            if let f = store.file(n), !f.sameContent(as: l) { stale.append(n) }
        }
        // les fichiers level_NNNN.json doivent correspondre au générateur (sinon relancer `pnpm levels:gen --revalidate`)
        XCTAssertEqual(stale, [], "niveaux dont le fichier JSON ne correspond plus au générateur")
    }

    func testPowerOffersRespectStacks() {
        var rng = Rng(7)
        for _ in 0..<200 {
            let offer = LevelGen.offerPowers(&rng, owned: [.multishot: 2, .speed: 2])
            XCTAssertEqual(offer.count, 3)
            XCTAssertEqual(Set(offer).count, 3)
            XCTAssertFalse(offer.contains(.multishot))
            XCTAssertFalse(offer.contains(.speed))
        }
        XCTAssertEqual(Powers.all.count, 24)
    }

    func testReviveRestoresHalfHp() throws {
        let store = try TestContent.store()
        let hero = HeroState(talents: .none)
        let w = World(RoomSetup(arena: Arena(store.rooms[0]), D: 1, waves: [[SpawnSpec(type: .goblin, c: 4, r: 3)]], boss: nil, seed: 3), hero: hero)
        hero.hp = -5
        w.step(.idle)
        XCTAssertTrue(w.dead)
        w.revive()
        XCTAssertFalse(w.dead)
        XCTAssertEqual(hero.hp, 300)
        XCTAssertTrue(w.projectiles.allSatisfy(\.fromHero))
    }
}
