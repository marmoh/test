import Foundation
import XCTest
@testable import Ombrelune

/// Économie hors combat : progression, coffres d'étoiles et pass de saison (parité avec `web/src/season.ts`),
/// tournoi, sauvegarde JSON et fusion iCloud.
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
        _ = p.record(level: 1, won: true, stars: 1)
        XCTAssertEqual(p.stars(1), 3, "on garde la meilleure note")
        _ = p.record(level: 2, won: false, stars: 0)
        XCTAssertEqual(p.unlocked, 2)
        XCTAssertEqual(p.totalStars, 3)
    }

    func testStarChestsEveryTwentyStars() {
        // web `pendingChests` / `starChest` : 200 or + 20 gemmes + 1 bonus qui tourne
        XCTAssertEqual(StarChest.pending(opened: 0, stars: 19), [])
        XCTAssertEqual(StarChest.pending(opened: 0, stars: 41), [1, 2])
        XCTAssertEqual(StarChest.pending(opened: 2, stars: 41), [])
        XCTAssertEqual(StarChest.rewards(1), [.gold(200), .gems(20), .bonus(.potion, 1)])
        XCTAssertEqual(StarChest.rewards(2).last, .bonus(.scroll, 1))
        XCTAssertEqual(StarChest.rewards(3).last, .bonus(.aegis, 1))
    }

    func testSeasonPassMatchesWeb() {
        // saison 1 = lundi 2 novembre 2026 00:00 UTC, 42 jours
        XCTAssertEqual(SeasonPass.season(at: SeasonPass.epoch).number, 1)
        XCTAssertEqual(SeasonPass.season(at: SeasonPass.epoch - 86_400).number, 1)
        XCTAssertEqual(SeasonPass.season(at: SeasonPass.epoch + 42 * 86_400).number, 2)
        XCTAssertEqual(SeasonPass.productID(season: 1), ProductID.seasonPass1.rawValue)
        XCTAssertEqual(SeasonPass.productID(season: 2), ProductID.seasonPass2.rawValue)
        XCTAssertEqual(SeasonPass.season(at: 1_797_206_400).number, 2) // 14 décembre 2026, 00:00 UTC
        XCTAssertEqual(SeasonPass.pointsForWin(prevStars: 0, stars: 3), 40)
        XCTAssertEqual(SeasonPass.pointsForWin(prevStars: 3, stars: 2), 10)
        XCTAssertEqual(SeasonPass.freeTrack.count, 30)
        XCTAssertEqual(SeasonPass.premiumTrack.count, 30)
        XCTAssertEqual(SeasonPass.premiumTrack[29], .skin(.moonCrown))
        // totaux annoncés (DECISIONS #62) : gratuit 3 850 or, 200 gemmes ; premium 4 300 or, 440 gemmes
        func total(_ t: [Reward], gold: Bool) -> Int {
            t.reduce(0) { acc, r in
                switch r {
                case .gold(let n) where gold: return acc + n
                case .gems(let n) where !gold: return acc + n
                default: return acc
                }
            }
        }
        XCTAssertEqual(total(SeasonPass.freeTrack, gold: true), 3850)
        XCTAssertEqual(total(SeasonPass.freeTrack, gold: false), 200)
        XCTAssertEqual(total(SeasonPass.premiumTrack, gold: true), 4300)
        XCTAssertEqual(total(SeasonPass.premiumTrack, gold: false), 440)
        var s = SeasonPassState(season: 1)
        s.points = 85
        XCTAssertEqual(s.tier, 2)
        XCTAssertTrue(s.canClaim(premium: false, tier: 2))
        XCTAssertFalse(s.canClaim(premium: false, tier: 3))
        XCTAssertFalse(s.canClaim(premium: true, tier: 1), "piste premium réservée au pass")
        s.premium = true
        XCTAssertEqual(s.claimableCount, 4)
        XCTAssertEqual(s.claimAll(), [.gold(100), .bonus(.potion, 1), .gems(30), .gold(300)])
        XCTAssertEqual(s.claimableCount, 0)
        XCTAssertEqual(s.current(season: 2), SeasonPassState(season: 2), "une nouvelle saison repart à zéro")
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
        b.seasonPass.points = 120
        b.skins = [.foxEars]
        let m = a.merged(with: b)
        XCTAssertEqual(m.stars(1), 3)
        XCTAssertEqual(m.stars(2), 2)
        XCTAssertEqual(m.unlocked, 3)
        XCTAssertEqual(m.talents.vigor, 4)
        XCTAssertEqual(m.talents.strength, 2)
        XCTAssertEqual(m.seasonPass.claimedFree, [1])
        XCTAssertEqual(m.seasonPass.points, 120)
        XCTAssertEqual(m.skins, [.foxEars])
    }

    @MainActor
    func testVictoryCreditsStarChestsAndPassRewards() async {
        let defaults = UserDefaults(suiteName: "tests.\(UUID())")!
        let wallet = Wallet(defaults: defaults)
        let lives = LivesCenter(defaults: defaults)
        let progress = Progress(store: defaults)
        let now = Date(timeIntervalSince1970: SeasonPass.epoch + 3_600)
        let gold0 = wallet.gold, gems0 = wallet.gems
        var chests = 0
        for n in 1...7 { chests += progress.record(level: n, won: true, stars: 3, wallet: wallet, now: now).chests.count }
        XCTAssertEqual(chests, 1, "21 étoiles : un coffre, crédité à la victoire")
        XCTAssertEqual(wallet.gold, gold0 + 200)
        XCTAssertEqual(wallet.gems, gems0 + 20)
        // 7 victoires à 3 étoiles nouvelles = 280 lunes = 7 paliers
        XCTAssertEqual(progress.pass(now: now).tier, 7)
        XCTAssertEqual(progress.claimPass(tier: 1, premium: false, wallet: wallet, lives: lives, now: now), .gold(100))
        XCTAssertNil(progress.claimPass(tier: 1, premium: false, wallet: wallet, lives: lives, now: now))
        progress.unlockPremium(now: now)
        XCTAssertEqual(progress.claimAllPass(wallet: wallet, lives: lives, now: now).count, 6 + 7)
        XCTAssertTrue(progress.skins.isEmpty)
        // palier 10 premium : Oreilles de renard ; palier 15 : 5 vies
        for _ in 1...32 { progress.record(level: 100, won: true, stars: 0, wallet: wallet, now: now) } // 280 + 320 = 600 lunes = palier 15
        lives.recordAttempt(won: false, subscribed: false)
        XCTAssertEqual(lives.lives, LivesState.max - 1)
        _ = progress.claimAllPass(wallet: wallet, lives: lives, now: now)
        XCTAssertEqual(progress.skins, [.foxEars])
        XCTAssertEqual(progress.skin, .foxEars)
        XCTAssertEqual(lives.lives, LivesState.max)
    }

    @MainActor
    func testBonusPricesMatchWeb() async {
        let wallet = Wallet(defaults: UserDefaults(suiteName: "tests.\(UUID())")!)
        let gold = wallet.gold, gems = wallet.gems
        XCTAssertTrue(wallet.buyBonus(.potion))
        XCTAssertTrue(wallet.buyBonus(.scroll))
        XCTAssertEqual(wallet.gold, gold - 150)
        XCTAssertEqual(wallet.gems, gems - 25)
        XCTAssertEqual(wallet.bonusCount(.scroll), 2)
    }

    @MainActor
    func testSaveStoreWritesOneReadableJSONFile() async throws {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("ombrelune-tests-\(UUID().uuidString)")
        let now = Date(timeIntervalSince1970: SeasonPass.epoch + 3_600)
        let save = SaveStore(directory: dir, iCloud: false)
        let wallet = Wallet(store: save)
        let progress = Progress(store: save)
        let lives = LivesCenter(store: save)
        wallet.addGold(77)
        XCTAssertTrue(wallet.credit(.gemsHandful, transactionID: 99))
        let out = progress.record(level: 1, won: true, stars: 3, wallet: wallet, now: now)
        XCTAssertEqual(out.passPoints, 40)
        XCTAssertEqual(out.tierAfter, 1)
        lives.recordAttempt(won: false, subscribed: false)
        // relu depuis le disque
        let again = SaveStore(directory: dir, iCloud: false)
        XCTAssertEqual(Wallet(store: again).gold, wallet.gold)
        XCTAssertFalse(Wallet(store: again).credit(.gemsHandful, transactionID: 99), "registre des transactions persisté avec les gemmes")
        XCTAssertEqual(Progress(store: again).stars(1), 3)
        XCTAssertEqual(Progress(store: again).pass(now: now).points, 40)
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
