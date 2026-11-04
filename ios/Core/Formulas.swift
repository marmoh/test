import Foundation

/// Vecteur 2D (pt). Type valeur : les copies `{ ...p }` du TypeScript sont implicites.
public struct Vec: Equatable, Hashable, Codable, Sendable {
    public var x: Double
    public var y: Double
    public init(_ x: Double, _ y: Double) { self.x = x; self.y = y }
    public init(x: Double, y: Double) { self.x = x; self.y = y }
    public static let zero = Vec(0, 0)
}

/// `clamp` de `arena.ts`.
@inline(__always)
public func clampJS(_ v: Double, _ a: Double, _ b: Double) -> Double { v < a ? a : v > b ? b : v }

/// `norm` de `arena.ts` : vecteur unitaire (ou nul).
@inline(__always)
public func normJS(_ x: Double, _ y: Double) -> Vec {
    let d = DMath.hypot(x, y)
    return d < 1e-9 ? Vec(0, 0) : Vec(x / d, y / d)
}

// MARK: - §7, §8, §10 formules (port de `sim/src/formulas.ts`)

public enum LevelKind: String, Codable, Sendable, CaseIterable {
    case tutorial, breather, normal, hard, boss
}

public struct LevelInfo: Equatable, Sendable {
    public var n: Int
    public var chapter: Int
    public var position: Int
    public var kingdom: Int
    public var D: Double
    public var mult: Double
    public var kind: LevelKind
    public var rooms: Int
}

public enum Formulas {
    public static func chapterOf(_ n: Int) -> Int { (n + K.levelsPerChapter - 1) / K.levelsPerChapter }
    public static func positionOf(_ n: Int) -> Int { n - K.levelsPerChapter * (chapterOf(n) - 1) }
    public static func kingdomOf(_ n: Int) -> Int { (chapterOf(n) + K.chaptersPerKingdom - 1) / K.chaptersPerKingdom }

    /// D(n) = 1 + 0,055 × (n − 1)^0,93
    public static func baseDifficulty(_ n: Int) -> Double { 1 + 0.055 * DMath.pow(Double(n - 1), 0.93) }

    /// Dents de scie.
    public static func sawMult(_ p: Int) -> Double {
        if p >= 1 && p <= 3 { return 0.85 }
        if p == 7 || p == 14 { return 1.35 }
        if p == 20 { return 1.55 }
        return 1.0
    }

    public static func roomCount(_ n: Int) -> Int { n <= 20 ? 2 : n <= 120 ? 3 : 4 }

    public static func levelKind(_ n: Int) -> LevelKind {
        let p = positionOf(n)
        if p == 20 { return .boss }
        if p == 7 || p == 14 { return .hard }
        if p == 1 { return .tutorial }
        if p <= 3 { return .breather }
        return .normal
    }

    public static func levelInfo(_ n: Int) -> LevelInfo {
        let p = positionOf(n)
        return LevelInfo(n: n, chapter: chapterOf(n), position: p, kingdom: kingdomOf(n), D: baseDifficulty(n),
                         mult: sawMult(p), kind: levelKind(n), rooms: roomCount(n))
    }

    /// P(D) : progression attendue du joueur.
    public static func expectedPower(_ D: Double) -> Double { 1 + BudgetK.powerPerD * (D - 1) }

    public static func roomBudget(_ D: Double, _ mult: Double, _ roomIndex1: Int, _ budgetScale: Double = 1, _ rooms: Int = 3) -> Int {
        let k = BudgetK.byRooms(rooms) ?? BudgetK.byRooms(3)!
        let inner = k * (BudgetK.base + BudgetK.perD * D * mult * (0.8 + 0.2 * Double(roomIndex1)))
        return Int(DMath.round((inner / expectedPower(D)) * budgetScale))
    }

    public static func waveCap(_ D: Double, _ mult: Double = 1) -> Double {
        (BudgetK.waveCap + BudgetK.waveCapPerD * (D - 1)) * mult.squareRoot()
    }

    public static func stars(won: Bool, hpFrac: Double) -> Int {
        if !won { return 0 }
        if hpFrac >= StarK.three { return 3 }
        if hpFrac >= StarK.two { return 2 }
        return 1
    }

    /// Or : 20 + 2n ; ×1,5 la première fois à 3 étoiles ; bonus Fortune / abonnement.
    public static func goldReward(_ n: Int, firstThreeStars: Bool, goldBonus: Double = 0) -> Int {
        var g = Double(20 + 2 * n)
        if firstThreeStars { g *= 1.5 }
        return Int(DMath.round(g * (1 + goldBonus)))
    }

    /// Coffres d'étoiles : un tous les 20 ★.
    public static func starChestsEarned(_ totalStars: Int) -> Int { totalStars / 20 }

    /// §10 Score de tournoi.
    public static func tournamentScore(kills: Int, hpLeft: Double, seconds: Double) -> Int {
        kills * 100 + Int(DMath.round(hpLeft)) * 5 + Int(DMath.max(0, (240 - seconds).rounded(.down))) * 40
    }

    /// Semaine ISO (année, semaine) d'une date UTC — graine du tournoi.
    public static func isoWeek(_ date: Date) -> (year: Int, week: Int) {
        var cal = Calendar(identifier: .iso8601)
        cal.timeZone = TimeZone(identifier: "UTC")!
        let c = cal.dateComponents([.yearForWeekOfYear, .weekOfYear], from: date)
        return (c.yearForWeekOfYear ?? 1970, c.weekOfYear ?? 1)
    }

    public static func tournamentSeed(_ date: Date) -> Int {
        let w = isoWeek(date)
        return w.year * 100 + w.week
    }

    /// Clé de semaine « 2026-W45 » (même format que `weekKey` du web).
    public static func weekKey(_ date: Date) -> String {
        let w = isoWeek(date)
        return String(format: "%04d-W%02d", w.year, w.week)
    }

    /// Coût en or du rang suivant d'un talent (`talentCost` du web).
    public static func talentCost(_ rank: Int) -> Int { 25 * (rank + 1) * (rank + 2) }

    /// `Math.round(x * 1000) / 1000`
    public static func round3(_ x: Double) -> Double { DMath.round(x * 1000) / 1000 }
}
