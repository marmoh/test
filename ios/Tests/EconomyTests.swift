import Foundation
import XCTest
@testable import Ombrelune

/// Économie hors combat : progression, coffres d'étoiles, pass de saison, tournoi, sauvegarde JSON et fusion iCloud.
final class EconomyTests: XCTestCase {
    func testRecordAttemptStarsAndUnlock() {
        var p = ProgressData()
        var r = p.record(level: 1, won: true, stars: 2)
        XCTAssertTrue(r.firstClear)
        XCTAssertFalse(r.firstThree)
        XCTAssertEqual(p.unlocked, 2)
        r = p.record(level: 1, won: true, stars: 3)
        XCTAssertTrue(r.firstThree)
        XCTAssertFalse(r.firstClear)
        r = p.record(level: 1, won: true, stars: 1)
        XCTAssertEqual(p.stars(1), 3, "on garde la meilleure note")
        r = p.record(level: 2, won: false, stars: 0)
        XCTAssertEqual(p.unlocked, 2)
        XCTAssertEqual(p.totalStars, 3)
    }

    func testStarChestsEveryTwentyStars() {
        var p = ProgressData()
        for n in 1...7 { _ = p.record(level: n, won: true, stars: 3) }
        XCTAssertEqual(p.totalStars, 21)
        XCTAssertEqual(p.chestsAvailable, 1)
        p.chestsOpened = 1
        XCTAssertEqual(p.chestsAvailable, 0)
        XCTAssertEqual(StarChest.rewards(1).count, 3)
    }

    func testSeasonPassTiersAndClaims() {
        var s = SeasonPassState()
        XCTAssertEqual(s.tier, 0)
        s.xp = 250
        XCTAssertEqual(s.tier, 2)
        XCTAssertTrue(s.canClaim(2, premium: false, owned: false))
        XCTAssertFalse(s.canClaim(3, premium: false, owned: false))
        XCTAssertFalse(s.canClaim(1, premium: true, owned: false), "piste premium réservée au pass")
        XCTAssertTrue(s.canClaim(1, premium: true, owned: true))
        s.claimedFree.insert(2)
        XCTAssertFalse(s.canClaim(2, premium: false, owned: false))
        s.xp = 99_999
        XCTAssertEqual(s.tier, SeasonPass.tiers)
        XCTAssertEqual(SeasonPass.premiumReward(30), .threadSkin(.moon))
        XCTAssertEqual(SeasonPass.xp(won: true, stars: 3, firstClear: true), 90)
        for t in 1...SeasonPass.tiers {
            if case .threadSkin = SeasonPass.freeReward(t) { XCTFail("apparences seulement sur la piste premium") }
        }
    }

    func testTournamentWeeklyReset() {
        var t = TournamentState().current(week: "2026-W45")
        t.attempts = 2
        t.best = 9000
        XCTAssertEqual(t.current(week: "2026-W45").attempts, 2)
        let next = t.current(week: "2026-W46")
        XCTAssertEqual(next.attempts, TournamentState.attemptsPerWeek)
        XCTAssertEqual(next.best, 0)
    }

    func testProgressMergeNeverLoses() {
        var a = ProgressData()
        _ = a.record(level: 1, won: true, stars: 3)
        a.talents.vigor = 4
        var b = ProgressData()
        _ = b.record(level: 1, won: true, stars: 1)
        _ = b.record(level: 2, won: true, stars: 2)
        b.talents.strength = 2
        b.seasonPass.claimedFree = [1]
        let m = a.merged(with: b)
        XCTAssertEqual(m.stars(1), 3)
        XCTAssertEqual(m.stars(2), 2)
        XCTAssertEqual(m.unlocked, 3)
        XCTAssertEqual(m.talents.vigor, 4)
        XCTAssertEqual(m.talents.strength, 2)
        XCTAssertEqual(m.seasonPass.claimedFree, [1])
    }

    @MainActor
    func testSaveStoreWritesOneReadableJSONFile() async throws {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("ombrelune-tests-\(UUID().uuidString)")
        let save = SaveStore(directory: dir, iCloud: false)
        let wallet = Wallet(store: save)
        let progress = Progress(store: save)
        let lives = LivesCenter(store: save)
        wallet.addGold(77)
        XCTAssertTrue(wallet.credit(.gemsHandful, transactionID: 99))
        progress.record(level: 1, won: true, stars: 3, wallet: wallet)
        lives.recordAttempt(won: false, subscribed: false)
        // relu depuis le disque
        let again = SaveStore(directory: dir, iCloud: false)
        XCTAssertEqual(Wallet(store: again).gold, wallet.gold)
        XCTAssertFalse(Wallet(store: again).credit(.gemsHandful, transactionID: 99), "registre des transactions persisté avec les gemmes")
        XCTAssertEqual(Progress(store: again).stars(1), 3)
        XCTAssertEqual(LivesCenter(store: again).lives, LivesState.max - 1)
        let text = try String(contentsOf: dir.appendingPathComponent("save.json"), encoding: .utf8)
        XCTAssertTrue(text.contains("\"progress\""))
        XCTAssertTrue(text.contains("\"wallet\""))
        XCTAssertTrue(text.contains("\"lives\""))
    }

    @MainActor
    func testCloudMergeKeepsLedgerUnion() async throws {
        let dirA = FileManager.default.temporaryDirectory.appendingPathComponent("ombrelune-a-\(UUID().uuidString)")
        let dirB = FileManager.default.temporaryDirectory.appendingPathComponent("ombrelune-b-\(UUID().uuidString)")
        var clock = Date(timeIntervalSince1970: 1_000)
        let a = SaveStore(directory: dirA, iCloud: false, clock: { clock })
        let b = SaveStore(directory: dirB, iCloud: false, clock: { clock })
        let wa = Wallet(store: a), wb = Wallet(store: b)
        let pa = Progress(store: a), pb = Progress(store: b)
        XCTAssertTrue(wa.credit(.gemsPouch, transactionID: 1))
        pa.record(level: 1, won: true, stars: 3, wallet: wa)
        clock = Date(timeIntervalSince1970: 2_000)
        XCTAssertTrue(wb.credit(.gemsHandful, transactionID: 2))
        pb.record(level: 1, won: true, stars: 1, wallet: wb)
        pb.record(level: 2, won: true, stars: 2, wallet: wb)
        // l'appareil A reçoit le document de B
        a.mergeRemote(try XCTUnwrap(b.document))
        wa.reload()
        pa.reload()
        XCTAssertEqual(pa.stars(1), 3)
        XCTAssertEqual(pa.stars(2), 2)
        XCTAssertFalse(wa.credit(.gemsPouch, transactionID: 1))
        XCTAssertFalse(wa.credit(.gemsHandful, transactionID: 2), "achat crédité sur l'autre appareil")
    }
}
