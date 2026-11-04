import Foundation

/// Empreinte de l'état complet d'une salle : **même définition** que `stateHash` de
/// `tools/src/replay-traces.ts` (mêmes champs, même ordre). Sert aux tests de parité TS ↔ Swift.
public struct StateHasher {
    public private(set) var h: UInt32 = 0x811c_9dc5

    public init() {}

    @inline(__always) public mutating func u32(_ v: UInt32) { h = hash32(h ^ v) }
    @inline(__always) public mutating func num(_ x: Double) {
        let b = x.bitPattern
        u32(UInt32(truncatingIfNeeded: b))
        u32(UInt32(truncatingIfNeeded: b >> 32))
    }
    @inline(__always) public mutating func int(_ i: Int) { u32(UInt32(truncatingIfNeeded: i)) }
    @inline(__always) public mutating func bool(_ b: Bool) { u32(b ? 1 : 0) }
    public mutating func str(_ s: String) {
        let units = Array(s.utf16)
        u32(UInt32(units.count))
        for c in units { u32(UInt32(c)) }
    }
}

public enum StateHash {
    /// Ordre canonique des pouvoirs (clés triées).
    static let powerOrder: [PowerID] = [
        .attackSpeed, .barbedThread, .blast, .chain, .confetti, .crit, .damage, .diagonals, .dodge, .echoCut,
        .eliteSlayer, .flame, .flashStep, .frost, .lifesteal, .longThread, .magnet, .maxHp, .multishot, .orb,
        .pierce, .poison, .rearShot, .ricochet, .sharpScissors, .shield, .sideShots, .speed, .steelThread, .wallBounce,
    ]

    public static func of(_ w: World) -> UInt32 {
        var H = StateHasher()
        H.num(w.t)
        H.int(w.waveIndex)
        H.int(w.kills)
        H.bool(w.cleared)
        H.bool(w.exited)
        H.bool(w.dead)
        H.u32(w.rng.state)
        H.int(w.target?.id ?? 0)
        let h = w.hero
        for v in [h.pos.x, h.pos.y, h.vel.x, h.vel.y, h.hp, h.invuln, h.stillTime, h.fireCd, h.aimTime, h.facing] { H.num(v) }
        H.bool(h.shieldReady)
        for v in [h.shieldCd, h.orbAngle, h.flashT] { H.num(v) }
        H.bool(h.moving)
        H.bool(h.autoFire)
        H.num(h.damageTaken)
        H.int(h.hitsTaken)
        H.num(h.cutT)
        H.int(h.cuts)
        for v in [h.dmgBy.cut, h.dmgBy.shot, h.dmgBy.other, h.stats.maxHp, h.stats.damage, h.stats.fireRate, h.stats.speed] { H.num(v) }
        for id in powerOrder { H.int(h.powers[id] ?? 0) }
        H.int(h.thread.count)
        for p in h.thread {
            H.num(p.x)
            H.num(p.y)
            H.num(p.t)
        }
        H.int(w.enemies.count)
        for e in w.enemies {
            H.int(e.id)
            H.str(e.typeName)
            for v in [e.pos.x, e.pos.y, e.radius, e.hp, e.maxHp, e.contact, e.shotDmg, e.speed] { H.num(v) }
            H.bool(e.flying)
            H.bool(e.elite)
            H.str(e.state.rawValue)
            for v in [e.t, e.cd, e.eliteCd, e.eliteWind, e.aim.x, e.aim.y, e.chargeLeft, e.slowT, e.burnT, e.burnDps] { H.num(v) }
            H.int(e.poisonStacks)
            for v in [e.poisonT, e.poisonDps, e.orbHitCd, e.strafe] { H.num(v) }
            H.int(e.volley)
            if let b = e.boss {
                H.int(1 + b.phase)
                H.int(b.patternIdx)
                H.str(b.pattern?.kind.rawValue ?? "")
                H.int(b.repeatsLeft)
                H.num(b.breath)
                H.num(b.spin)
            } else {
                H.int(0)
            }
        }
        H.int(w.projectiles.count)
        for p in w.projectiles {
            for v in [p.pos.x, p.pos.y, p.vel.x, p.vel.y, p.radius, p.dmg] { H.num(v) }
            H.bool(p.fromHero)
            H.num(p.born)
            H.bool(p.pierce)
            H.int(p.wallBounce)
            H.int(p.ricochet)
            H.int(p.lastHit)
            H.bool(p.dead)
            H.str(p.src ?? "")
            H.int(p.ownerId ?? 0)
        }
        H.int(w.hazards.count)
        for z in w.hazards {
            H.str(z.kind.rawValue)
            H.num(z.pos.x)
            H.num(z.pos.y)
            if let to = z.to {
                H.int(1)
                H.num(to.x)
                H.num(to.y)
            } else {
                H.int(0)
            }
            for v in [z.radius, z.born, z.activeAt, z.endAt, z.dmg, z.tick, z.nextTick] { H.num(v) }
            H.int(z.ownerId)
            H.str(z.src ?? "")
        }
        H.int(w.orbs.count)
        for o in w.orbs {
            H.num(o.pos.x)
            H.num(o.pos.y)
            H.num(o.heal)
        }
        H.int(w.events.count)
        for ev in w.events { hashEvent(&H, ev) }
        H.int(w.pendingCuts.count)
        return H.h
    }

    static func hashEvent(_ H: inout StateHasher, _ ev: WorldEvent) {
        switch ev {
        case let .shoot(x, y):
            H.str("shoot"); H.num(x); H.num(y)
        case let .hit(x, y, crit):
            H.str("hit"); H.num(x); H.num(y); H.bool(crit)
        case let .kill(x, y, type):
            H.str("kill"); H.num(x); H.num(y); H.str(type)
        case let .heroHit(dmg, src):
            H.str("heroHit"); H.num(dmg); H.str(src)
        case .dodge:
            H.str("dodge")
        case .shield:
            H.str("shield")
        case let .wave(index):
            H.str("wave"); H.int(index)
        case .cleared:
            H.str("cleared")
        case let .cut(poly, hits, echo):
            H.str("cut"); H.int(poly.count)
            for p in poly { H.num(p.x); H.num(p.y) }
            H.int(hits); H.bool(echo)
        case let .snip(x, y, by):
            H.str("snip"); H.num(x); H.num(y); H.str(by)
        }
    }
}
