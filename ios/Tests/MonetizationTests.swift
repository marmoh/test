import XCTest
@testable import Ombrelune

/// Parité avec `web/test/economy.test.ts` : crédit idempotent, publicité récompensée, vies, Ordre du Dragon.
final class MonetizationTests: XCTestCase {
    private let t0: TimeInterval = 1_793_793_600 // 4 novembre 2026, 12 h UTC
    private let day = "2026-11-04"

    func testConsumableCreditIsIdempotent() {
        var ledger = CreditLedger()
        XCTAssertTrue(ledger.claim(42))
        XCTAssertFalse(ledger.claim(42), "une transaction redélivrée ne doit pas être recréditée")
        XCTAssertTrue(ledger.claim(43))
    }

    @MainActor
    func testWalletCreditsGemsOncePerTransaction() {
        let defaults = UserDefaults(suiteName: "tests.\(UUID())")!
        let w = Wallet(defaults: defaults)
        let before = w.gems
        XCTAssertTrue(w.credit(.gemsPouch, transactionID: 7))
        XCTAssertFalse(w.credit(.gemsPouch, transactionID: 7))
        XCTAssertEqual(w.gems, before + 550)
        // relu depuis le disque : le registre est persisté avec les gemmes
        XCTAssertFalse(Wallet(defaults: defaults).credit(.gemsPouch, transactionID: 7))
    }

    func testRewardedAdLimits() {
        var ads = AdLedger()
        var t = t0
        for i in 0..<RewardedAdPolicy.perDay {
            let s = RewardedAdPolicy.status(ads, now: t, day: day, subscribed: false, lives: 0)
            XCTAssertTrue(s.ok)
            XCTAssertEqual(s.left, RewardedAdPolicy.perDay - i)
            ads = RewardedAdPolicy.record(ads, now: t, day: day)
            if i < RewardedAdPolicy.perDay - 1 {
                XCTAssertEqual(RewardedAdPolicy.status(ads, now: t + 1, day: day, subscribed: false, lives: 0).reason, .cooldown)
            }
            t += RewardedAdPolicy.cooldown
        }
        XCTAssertEqual(RewardedAdPolicy.status(ads, now: t, day: day, subscribed: false, lives: 0).reason, .daily)
        XCTAssertTrue(RewardedAdPolicy.status(ads, now: t + 86_400, day: "2026-11-05", subscribed: false, lives: 0).ok)
    }

    func testNoAdForSubscribersOrFullLives() {
        XCTAssertEqual(RewardedAdPolicy.status(AdLedger(), now: t0, day: day, subscribed: true, lives: 0).reason, .subscriber)
        XCTAssertEqual(RewardedAdPolicy.status(AdLedger(), now: t0, day: day, subscribed: false, lives: 5).reason, .full)
    }

    func testAddLifeAndUnlimitedLives() {
        XCTAssertEqual(LivesState(lives: 0, refillFrom: t0).addingLife(now: t0 + 60), LivesState(lives: 1, refillFrom: t0))
        XCTAssertEqual(LivesState(lives: 4, refillFrom: t0).addingLife(now: t0 + 60), LivesState(lives: 5, refillFrom: t0 + 60))
        XCTAssertEqual(LivesState(lives: 1, refillFrom: t0).afterAttempt(now: t0, won: false, unlimited: true).lives, 1)
        XCTAssertEqual(LivesState(lives: 1, refillFrom: t0).afterAttempt(now: t0, won: false, unlimited: false).lives, 0)
    }

    func testDragonPerks() {
        XCTAssertEqual(DragonPerks.goldBonus(fortuneRank: 4, subscribed: true), 0.45, accuracy: 1e-9)
        let now = Date(timeIntervalSince1970: t0)
        XCTAssertEqual(DragonPerks.weekKey(now), "2026-W45")
        XCTAssertTrue(DragonPerks.weeklyGemsClaimable(subscribed: true, claimedWeek: "2026-W44", now: now))
        XCTAssertFalse(DragonPerks.weeklyGemsClaimable(subscribed: true, claimedWeek: "2026-W45", now: now))
        XCTAssertFalse(DragonPerks.weeklyGemsClaimable(subscribed: false, claimedWeek: nil, now: now))
    }
}
