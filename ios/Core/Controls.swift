import Foundation

/// §2 Contrôles à ancre flottante — port exact de `sim/src/controls.ts`.
/// Un deuxième doigt est ignoré (pas de geste caché).
public struct FloatingAnchor: Sendable {
    public private(set) var anchor: Vec?
    public private(set) var finger: Vec?
    private var touchID: Int?

    public init() {}

    public var touching: Bool { touchID != nil }

    public mutating func down(_ id: Int, _ p: Vec) {
        if touchID != nil { return }
        touchID = id
        anchor = p
        finger = p
    }

    public mutating func move(_ id: Int, _ p: Vec) {
        guard id == touchID, var a = anchor else { return }
        finger = p
        let dx = p.x - a.x
        let dy = p.y - a.y
        let d = DMath.hypot(dx, dy)
        if d > Control.maxAnchorDist {
            // l'ancre glisse pour rester à 70 pt du doigt
            let k = (d - Control.maxAnchorDist) / d
            a.x += dx * k
            a.y += dy * k
            anchor = a
        }
    }

    public mutating func up(_ id: Int) {
        guard id == touchID else { return }
        touchID = nil
        anchor = nil
        finger = nil
    }

    /// Annule tout (perte de focus, pause).
    public mutating func reset() {
        touchID = nil
        anchor = nil
        finger = nil
    }

    /// Vitesse désirée normalisée : direction × facteur [0, 1].
    public func intent() -> Vec {
        guard let a = anchor, let f = finger else { return intentFromVector(nil) }
        return intentFromVector(Vec(f.x - a.x, f.y - a.y))
    }
}

public func intentFromVector(_ v: Vec?) -> Vec {
    guard let v else { return Vec(0, 0) }
    let d = DMath.hypot(v.x, v.y)
    if d <= Control.deadZone { return Vec(0, 0) }
    let f = DMath.min(1, (d - Control.deadZone) / Control.fullSpeedSpan)
    return Vec((v.x / d) * f, (v.y / d) * f)
}
