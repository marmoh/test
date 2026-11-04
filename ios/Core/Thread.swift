import Foundation

/// Ciseaux de lune — fil de découpe, boucles et coupures (port de la partie « fil » de `sim/src/world.ts`).
///
/// **Règle de coupure (DECISIONS #39)** — regroupée ici pour être facile à faire évoluer :
/// seuls deux ennemis menacent le fil, et c'est leur rôle : la Mite de papier le grignote et le
/// Crabe-ciseaux le tranche **pendant sa charge**. Projectiles et autres ennemis le traversent sans dommage.
/// Fil d'acier : ni mite ni crabe ne le coupent. Fil barbelé : tout ennemi qui touche le fil se blesse.
public enum ThreadRules {
    /// Les projectiles ennemis qui traversent le fil le coupent-ils ? (oui avant DECISIONS #39)
    public static let enemyProjectilesCut = false

    /// La mite file vers le fil pour le grignoter (sinon elle s'en prend à l'héroïne).
    public static func mothEatsThread(_ s: HeroStats, threadCount: Int) -> Bool {
        threadCount >= 4 && !s.steelThread
    }

    /// Le crabe-ciseaux vise le milieu du fil s'il est assez long.
    public static func snipperAimsAtThread(_ s: HeroStats, threadCount: Int) -> Bool {
        threadCount >= 10 && !s.steelThread
    }

    /// Cet ennemi tranche-t-il le fil qu'il touche ?
    public static func cutsOnContact(_ e: Enemy, _ s: HeroStats) -> Bool {
        e.boss == nil && e.type == .snipper && e.state == .charge && !s.steelThread
    }
}

extension World {
    /// Déroule le fil derrière l'héroïne, fait sécher les vieux points et détecte les boucles fermées.
    func updateThread() {
        let h = hero
        h.cutT = DMath.max(0, h.cutT - K.simDT * 2.5)
        let life = ThreadTuning.life * h.stats.threadLife
        var drop = 0
        while drop < h.thread.count && t - h.thread[drop].t > life { drop += 1 }
        if drop > 0 { h.thread.removeFirst(drop) }
        if cleared {
            h.thread.removeAll()
            return
        }
        let p = h.pos
        let last = h.thread.last
        if let last, DMath.hypot(p.x - last.x, p.y - last.y) < ThreadTuning.spacing { return }
        if !h.moving { return }
        if let last, h.thread.count >= 4 {
            // le nouveau segment (dernier point → héroïne) recoupe-t-il un segment plus ancien ?
            let th = h.thread
            var i = th.count - 3
            while i >= 0 {
                if let x = segX(th[i].v, th[i + 1].v, last.v, p) {
                    var poly: [Vec] = [x]
                    for k in (i + 1)..<th.count { poly.append(Vec(th[k].x, th[k].y)) }
                    poly.append(Vec(p.x, p.y))
                    if Swift.abs(polyArea(poly)) >= ThreadTuning.minArea {
                        performCut(poly, mult: 1, echo: false)
                        h.thread.removeAll()
                        h.thread.append(ThreadPoint(x: p.x, y: p.y, t: t))
                        return
                    }
                    break
                }
                i -= 1
            }
        }
        h.thread.append(ThreadPoint(x: p.x, y: p.y, t: t))
        if h.thread.count > ThreadTuning.maxPoints { h.thread.removeFirst(h.thread.count - ThreadTuning.maxPoints) }
    }

    /// Découpe tout ce que la boucle entoure : ennemis (dégâts), projectiles ennemis (effacés).
    public func performCut(_ poly: [Vec], mult: Double, echo: Bool) {
        dmgSrc = .cut
        performCutInner(poly, mult, echo)
        dmgSrc = .other
    }

    private func performCutInner(_ poly: [Vec], _ mult: Double, _ echo: Bool) {
        let h = hero
        let s = h.stats
        let inside = enemies.filter { $0.hp > 0 && $0.state != .spawn && pointInPoly($0.pos, poly) }
        let base = ThreadTuning.cutBase * (s.damage / HeroK.damage) * s.cutMult * mult
            * (1 + ThreadTuning.comboPerExtra * Double(max(0, inside.count - 1)))
        for e in inside {
            let crit = s.critChance > 0 && rng.chance(s.critChance)
            var dmg = base * (crit ? 2 : 1)
            if e.elite || e.boss != nil { dmg *= s.eliteMult }
            damageEnemy(e, dmg, onHit: true, crit: crit)
        }
        if s.confetti {
            for e in inside where e.hp <= 0 {
                for o in enemies where o.hp > 0 && o !== e && DMath.hypot(o.pos.x - e.pos.x, o.pos.y - e.pos.y) < ThreadTuning.confettiRadius + o.radius {
                    damageEnemy(o, base * ThreadTuning.confettiFrac, onHit: false, crit: false)
                }
            }
        }
        for p in projectiles where !p.fromHero && pointInPoly(p.pos, poly) { p.dead = true }
        projectiles = projectiles.filter { !$0.dead }
        if !echo {
            h.cutT = 1
            h.cuts += 1
            if s.echoCut { pendingCuts.append(PendingCut(poly: poly, at: t + ThreadTuning.echoDelay, mult: ThreadTuning.echoMult)) }
        }
        events.append(.cut(poly: poly, hits: inside.count, echo: echo))
    }

    func updatePendingCuts() {
        if pendingCuts.isEmpty { return }
        let now = t
        let due = pendingCuts.filter { $0.at <= now }
        pendingCuts = pendingCuts.filter { $0.at > now }
        for c in due { performCut(c.poly, mult: c.mult, echo: true) }
    }

    /// Coupe le fil au segment i : la partie la plus ancienne est perdue.
    public func snipThread(_ i: Int, by: String) {
        let th = hero.thread
        if i < 0 || i >= th.count { return }
        events.append(.snip(x: th[i].x, y: th[i].y, by: by))
        hero.thread.removeFirst(i + 1)
    }

    /// La mite file vers le fil et le grignote ; sans fil (ou fil d'acier), elle volette autour de l'héroïne.
    func updateMoth(_ e: Enemy, slow: Double, dist: Double, _ dt: Double) {
        if e.state == .windup {
            e.t -= dt
            if e.t <= 0 { e.state = .move }
            return
        }
        let h = hero.pos
        let th = hero.thread
        var tx = h.x
        var ty = h.y
        var ti = -1
        if ThreadRules.mothEatsThread(hero.stats, threadCount: th.count) {
            var bd = Double.infinity
            for i in 0..<th.count {
                let ddx = th[i].x - e.pos.x
                let ddy = th[i].y - e.pos.y
                let d = ddx * ddx + ddy * ddy
                if d < bd {
                    bd = d
                    ti = i
                }
            }
            tx = th[ti].x
            ty = th[ti].y
        }
        let dir = normJS(tx - e.pos.x, ty - e.pos.y)
        let w = DMath.sin(t * 6 + Double(e.id)) * 0.7
        let n2 = normJS(dir.x - dir.y * w, dir.y + dir.x * w)
        let sp = e.speed * slow * (ti < 0 && dist < 80 ? 0.5 : 1)
        arena.moveCircle(&e.pos, n2.x * sp * dt, n2.y * sp * dt, e.radius, flying: true)
        if ti >= 0 && DMath.hypot(tx - e.pos.x, ty - e.pos.y) < e.radius + 4 {
            snipThread(ti, by: "moth")
            e.state = .windup
            e.t = 0.6
        }
    }

    /// Contacts ennemis ↔ fil : le crabe-ciseaux en charge le tranche ; le fil barbelé blesse.
    func threadContacts(_ dt: Double) {
        if hero.thread.count < 2 { return }
        let s = hero.stats
        for e in enemies {
            if e.state == .spawn || e.hp <= 0 { continue }
            let cutter = ThreadRules.cutsOnContact(e, s)
            if !cutter && !s.barbedThread { continue }
            // on ignore les tout derniers segments, collés à l'héroïne
            var i = hero.thread.count - 4
            while i >= 0 {
                let th = hero.thread
                if segDist2(e.pos, th[i].v, th[i + 1].v) > e.radius * e.radius {
                    i -= 1
                    continue
                }
                if s.barbedThread { damageEnemy(e, ThreadTuning.barbedDps * (s.damage / HeroK.damage) * dt, onHit: false, crit: false) }
                if cutter { snipThread(i, by: e.typeName) }
                break
            }
        }
    }

    /// Ancienne règle (avant DECISIONS #39) : les projectiles ennemis qui traversent le fil le coupent.
    /// Désactivée par `ThreadRules.enemyProjectilesCut`.
    func projectileSnips(_ dt: Double) {
        if hero.thread.count < 2 || hero.stats.steelThread { return }
        for p in projectiles {
            if p.fromHero { continue }
            let a = Vec(p.pos.x - p.vel.x * dt, p.pos.y - p.vel.y * dt)
            var i = hero.thread.count - 3
            while i >= 0 {
                let th = hero.thread
                if segX(th[i].v, th[i + 1].v, a, p.pos) != nil {
                    snipThread(i, by: "shot")
                    break
                }
                i -= 1
            }
            if hero.thread.count < 2 { return }
        }
    }
}

// MARK: - géométrie du fil

/// Point d'intersection des segments [a,b] et [c,d], ou nil.
public func segX(_ a: Vec, _ b: Vec, _ c: Vec, _ d: Vec) -> Vec? {
    let r1x = b.x - a.x
    let r1y = b.y - a.y
    let r2x = d.x - c.x
    let r2y = d.y - c.y
    let den = r1x * r2y - r1y * r2x
    if Swift.abs(den) < 1e-9 { return nil }
    let t = ((c.x - a.x) * r2y - (c.y - a.y) * r2x) / den
    let u = ((c.x - a.x) * r1y - (c.y - a.y) * r1x) / den
    if t < 0 || t > 1 || u < 0 || u > 1 { return nil }
    return Vec(a.x + r1x * t, a.y + r1y * t)
}

public func polyArea(_ poly: [Vec]) -> Double {
    var s = 0.0
    var j = poly.count - 1
    for i in 0..<poly.count {
        s += (poly[j].x - poly[i].x) * (poly[j].y + poly[i].y)
        j = i
    }
    return s / 2
}

public func pointInPoly(_ p: Vec, _ poly: [Vec]) -> Bool {
    var inside = false
    var j = poly.count - 1
    for i in 0..<poly.count {
        let a = poly[i]
        let b = poly[j]
        if (a.y > p.y) != (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x { inside.toggle() }
        j = i
    }
    return inside
}

func segDist2(_ p: Vec, _ a: Vec, _ b: Vec) -> Double {
    let vx = b.x - a.x
    let vy = b.y - a.y
    let l2 = vx * vx + vy * vy
    var t = l2 > 0 ? ((p.x - a.x) * vx + (p.y - a.y) * vy) / l2 : 0
    t = t < 0 ? 0 : t > 1 ? 1 : t
    let dx = a.x + vx * t - p.x
    let dy = a.y + vy * t - p.y
    return dx * dx + dy * dy
}
