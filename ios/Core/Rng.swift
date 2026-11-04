import Foundation

/// Générateur pseudo-aléatoire déterministe (mulberry32) — identique à `sim/src/rng.ts`.
/// Toute la simulation n'utilise QUE ce générateur : même graine ⇒ même partie.
public struct Rng: Sendable {
    public private(set) var state: UInt32

    public init(_ seed: UInt32) { state = seed }
    /// Graine donnée comme un nombre JS (accepte les valeurs négatives : `seed >>> 0`).
    public init(seed: Int) { state = UInt32(truncatingIfNeeded: seed) }

    /// Entier non signé 32 bits.
    public mutating func nextU32() -> UInt32 {
        state = state &+ 0x6d2b_79f5
        var t = state
        t = (t ^ (t >> 15)) &* (t | 1)
        t ^= t &+ ((t ^ (t >> 7)) &* (t | 61))
        return t ^ (t >> 14)
    }

    /// Flottant dans [0, 1).
    public mutating func next() -> Double { Double(nextU32()) / 4_294_967_296 }

    public mutating func range(_ min: Double, _ max: Double) -> Double { min + (max - min) * next() }

    public mutating func int(_ maxExclusive: Int) -> Int { Int((next() * Double(maxExclusive)).rounded(.down)) }

    public mutating func chance(_ p: Double) -> Bool { next() < p }

    public mutating func pick<T>(_ arr: [T]) -> T { arr[int(arr.count)] }

    /// Tirage pondéré : renvoie l'index.
    public mutating func weighted(_ weights: [Double]) -> Int {
        var total = 0.0
        for w in weights { total += w }
        var r = next() * total
        for i in 0..<weights.count {
            r -= weights[i]
            if r < 0 { return i }
        }
        return weights.count - 1
    }

    @discardableResult
    public mutating func shuffle<T>(_ arr: inout [T]) -> [T] {
        var i = arr.count - 1
        while i > 0 {
            let j = int(i + 1)
            arr.swapAt(i, j)
            i -= 1
        }
        return arr
    }

    /// Dérive une sous-graine indépendante.
    public mutating func fork(_ salt: Int) -> Rng {
        Rng(hash32(nextU32() ^ (UInt32(truncatingIfNeeded: salt) &* 0x9e37_79b1)))
    }
}

public func hash32(_ v: UInt32) -> UInt32 {
    var x = v
    x = (x ^ (x >> 16)) &* 0x7feb_352d
    x = (x ^ (x >> 15)) &* 0x846c_a68b
    return x ^ (x >> 16)
}

/// Combine plusieurs entiers en une graine (`seedOf` de `rng.ts`).
public func seedOf(_ parts: Int...) -> UInt32 { seedOf(parts) }

public func seedOf(_ parts: [Int]) -> UInt32 {
    var h: UInt32 = 0x811c_9dc5
    for p in parts { h = hash32(h ^ hash32(UInt32(truncatingIfNeeded: p))) }
    return h
}
