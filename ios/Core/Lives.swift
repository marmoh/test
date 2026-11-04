import Foundation

/// §8 Vies : port de `sim/src/formulas.ts` (`livesAt`, `secondsToNextLife`, `afterAttempt`)
/// et de `addLife` (`web/src/economy.ts`). Pur et testable ; temps en secondes.
struct LivesState: Codable, Equatable, Sendable {
    var lives: Int
    /// Instant à partir duquel court la prochaine recharge ; ignoré si plein.
    var refillFrom: TimeInterval

    static let max = 5
    static let regenSeconds: TimeInterval = 30 * 60

    static func full(now: TimeInterval) -> LivesState { LivesState(lives: max, refillFrom: now) }

    func at(_ now: TimeInterval) -> LivesState {
        if lives >= Self.max { return LivesState(lives: lives, refillFrom: now) }
        let gained = Int(((now - refillFrom) / Self.regenSeconds).rounded(.down))
        if gained <= 0 { return self }
        let l = min(Self.max, lives + gained)
        if l >= Self.max { return LivesState(lives: l, refillFrom: now) }
        return LivesState(lives: l, refillFrom: refillFrom + Double(gained) * Self.regenSeconds)
    }

    func secondsToNextLife(_ now: TimeInterval) -> TimeInterval? {
        let s = at(now)
        if s.lives >= Self.max { return nil }
        return Self.regenSeconds - (now - s.refillFrom)
    }

    /// Une défaite coûte une vie ; une victoire ne coûte rien. Abonnés : vies illimitées.
    func afterAttempt(now: TimeInterval, won: Bool, unlimited: Bool) -> LivesState {
        let s = at(now)
        if won || unlimited { return s }
        let wasFull = s.lives >= Self.max
        return LivesState(lives: Swift.max(0, s.lives - 1), refillFrom: wasFull ? now : s.refillFrom)
    }

    /// +1 vie (publicité récompensée), plafonnée à 5 ; le compte à rebours n'est pas relancé.
    func addingLife(now: TimeInterval) -> LivesState {
        let s = at(now)
        if s.lives >= Self.max { return s }
        let l = s.lives + 1
        return l >= Self.max ? LivesState(lives: l, refillFrom: now) : LivesState(lives: l, refillFrom: s.refillFrom)
    }
}
