import Foundation

/// Simulation déterministe d'une salle (pas fixe `K.simDT`) — port exact de `sim/src/world.ts`.
/// Aucune dépendance au rendu : SpriteKit (`Game/`) et les tests consomment le même état.
///
/// Règles de portage (parité au bit près avec la simulation TypeScript, vérifiée par `ParityTests`) :
/// - mêmes opérations flottantes dans le même ordre (pas de factorisation « équivalente ») ;
/// - `DMath` pour sin, cos, atan2, hypot, pow, round, min, max (sémantique V8) ;
/// - mêmes ordres d'itération et mêmes tirages du générateur.

public struct HeroInput: Equatable, Sendable {
    /// Vitesse désirée normalisée (|m| ≤ 1).
    public var mx: Double
    public var my: Double
    public var touching: Bool
    public init(mx: Double, my: Double, touching: Bool) { self.mx = mx; self.my = my; self.touching = touching }
    public static let idle = HeroInput(mx: 0, my: 0, touching: false)
}

public struct ThreadPoint: Equatable, Sendable {
    public var x: Double
    public var y: Double
    public var t: Double
    public var v: Vec { Vec(x, y) }
}

public enum DamageSource: Sendable { case cut, shot, other, sig }

public struct DamageBySource: Equatable, Sendable {
    public var cut = 0.0
    public var shot = 0.0
    public var other = 0.0
    /// mécanique signature du Moine et du Sorcier (bourrasque, tourbillon, braises, combustion)
    public var sig = 0.0
    subscript(_ s: DamageSource) -> Double {
        get { switch s { case .cut: cut; case .shot: shot; case .other: other; case .sig: sig } }
        set { switch s { case .cut: cut = newValue; case .shot: shot = newValue; case .other: other = newValue; case .sig: sig = newValue } }
    }
}

public final class HeroState {
    public var pos = Vec(0, 0)
    public var vel = Vec(0, 0)
    public var hp: Double
    public var talents: Talents
    public var powers: [PowerID: Int]
    public var stats: HeroStats
    public var invuln = 0.0
    public var stillTime = 1.0
    public var fireCd = 0.0
    public var aimTime = 0.0
    public var facing = -DMath.pi / 2
    public var shieldReady: Bool
    public var shieldCd = 0.0
    public var orbAngle = 0.0
    public var flashT = 0.0
    public var moving = false
    /// Tir automatique permanent.
    public var autoFire: Bool
    public var damageTaken = 0.0
    public var hitsTaken = 0
    /// Ciseaux de lune : fil de découpe (du plus ancien au plus récent point).
    public var thread: [ThreadPoint] = []
    /// 1 → 0 juste après une découpe (animation).
    public var cutT = 0.0
    public var cuts = 0
    public var dmgBy = DamageBySource()
    /// Mécanique signature (DECISIONS #74) et équipement porté (#75).
    public let kind: HeroKind
    public let gear: GearStats
    /// vient de s'arrêter à ce pas (moving → immobile)
    public var stopped = false
    /// Moine du vent : élan 0 → 1, délai, animation (1 → 0), nombre de bourrasques
    public var momentum = 0.0
    public var gustCd = 0.0
    public var gustT = 0.0
    public var gusts = 0
    /// Sorcier de braise : traînée (du plus ancien au plus récent point)
    public var embers: [ThreadPoint] = []

    public init(talents: Talents, powers: [PowerID: Int] = [:], autoFire: Bool = K.autoFireDefault, kind: HeroKind = .thread, gear: GearStats = .none) {
        let stats = computeStats(talents, powers, gear: gear)
        self.kind = kind
        self.gear = gear
        self.talents = talents
        self.powers = powers
        self.stats = stats
        self.hp = stats.maxHp
        self.shieldReady = stats.shield
        self.autoFire = autoFire
    }

    /// Ajoute un pouvoir ; « PV max +20 % » soigne d'autant.
    public func grant(_ id: PowerID) {
        let before = stats.maxHp
        powers[id] = (powers[id] ?? 0) + 1
        stats = computeStats(talents, powers, gear: gear)
        if id == .maxHp { hp += stats.maxHp - before }
        if id == .shield { shieldReady = true }
        hp = DMath.min(hp, stats.maxHp)
    }
}

public enum EnemyState: String, Sendable { case spawn, move, windup, charge, recover }

public final class BossRuntime {
    public let archetype: BossArchetype
    public let variant: Int
    public var phase = 0
    public var patternIdx = 0
    public var pattern: Pattern?
    public var repeatsLeft = 0
    /// Souffle (ouverture claire) restant.
    public var breath: Double
    public var spin = 0.0
    init(archetype: BossArchetype, variant: Int, breath: Double) {
        self.archetype = archetype; self.variant = variant; self.breath = breath
    }
}

public final class Enemy {
    public let id: Int
    public var type: MinionType
    public var pos: Vec
    public var radius: Double
    public var hp: Double
    public var maxHp: Double
    public var contact: Double
    public var shotDmg: Double
    public var speed: Double
    public var flying: Bool
    public let elite: Bool
    public var state: EnemyState = .spawn
    public var t: Double
    public var cd: Double
    public var eliteCd: Double
    public var eliteWind = 0.0
    public var aim = Vec(0, 1)
    public var chargeLeft = 0.0
    public var slowT = 0.0
    public var burnT = 0.0
    public var burnDps = 0.0
    public var poisonStacks = 0
    public var poisonT = 0.0
    public var poisonDps = 0.0
    /// braises du sorcier : brûlure entretenue (DECISIONS #74)
    public var emberT = 0.0
    public var emberDps = 0.0
    public var orbHitCd = 0.0
    public var strafe: Double
    public var volley = 0
    public var boss: BossRuntime?

    /// Type tel que l'écrit la simulation TS (« boss » pour un boss).
    public var typeName: String { boss != nil ? "boss" : type.rawValue }

    init(id: Int, type: MinionType, pos: Vec, radius: Double, hp: Double, contact: Double, shotDmg: Double, speed: Double,
         flying: Bool, elite: Bool, t: Double, cd: Double, eliteCd: Double, strafe: Double) {
        self.id = id; self.type = type; self.pos = pos; self.radius = radius; self.hp = hp; self.maxHp = hp
        self.contact = contact; self.shotDmg = shotDmg; self.speed = speed; self.flying = flying; self.elite = elite
        self.t = t; self.cd = cd; self.eliteCd = eliteCd; self.strafe = strafe
    }
}

public final class Projectile {
    public var pos: Vec
    public var vel: Vec
    public let radius: Double
    public var dmg: Double
    public var fromHero: Bool
    public var born: Double
    public let pierce: Bool
    public var wallBounce: Int
    public var ricochet: Int
    public var lastHit = -1
    public var dead = false
    /// Origine (type d'ennemi, « elite », « boss ») — diagnostic et rendu.
    public var src: String?
    public var ownerId: Int?

    init(pos: Vec, vel: Vec, radius: Double, dmg: Double, fromHero: Bool, born: Double, pierce: Bool, wallBounce: Int, ricochet: Int, src: String? = nil, ownerId: Int? = nil) {
        self.pos = pos; self.vel = vel; self.radius = radius; self.dmg = dmg; self.fromHero = fromHero; self.born = born
        self.pierce = pierce; self.wallBounce = wallBounce; self.ricochet = ricochet; self.src = src; self.ownerId = ownerId
    }
}

public enum HazardKind: String, Sendable { case circle, line }

public final class Hazard {
    public let kind: HazardKind
    public let pos: Vec
    /// Fin de ligne (charge).
    public let to: Vec?
    public let radius: Double
    public let born: Double
    /// Instant d'activation (≥ born + 0,5 s).
    public let activeAt: Double
    public let endAt: Double
    public let dmg: Double
    public let tick: Double
    public var nextTick: Double
    public let ownerId: Int
    public let src: String?
    /// Toile : ralentit l'héroïne de cette fraction tant qu'elle est dedans (DECISIONS #73).
    public let slow: Double?

    init(kind: HazardKind, pos: Vec, to: Vec? = nil, radius: Double, born: Double, activeAt: Double, endAt: Double, dmg: Double, tick: Double, nextTick: Double, ownerId: Int, src: String?, slow: Double? = nil) {
        self.kind = kind; self.pos = pos; self.to = to; self.radius = radius; self.born = born; self.activeAt = activeAt
        self.endAt = endAt; self.dmg = dmg; self.tick = tick; self.nextTick = nextTick; self.ownerId = ownerId; self.src = src
        self.slow = slow
    }
}

/// Tourbillon laissé par une bourrasque (pouvoir du Moine du vent).
public struct Whirl: Sendable {
    public var pos: Vec
    public var endAt: Double
    public var r: Double
}

public struct HealOrb: Sendable {
    public var pos: Vec
    public var heal: Double
}

public enum WorldEvent: Sendable {
    case shoot(x: Double, y: Double)
    case hit(x: Double, y: Double, crit: Bool)
    case kill(x: Double, y: Double, type: String)
    case heroHit(dmg: Double, src: String)
    case dodge
    case shield
    case wave(index: Int)
    case cleared
    case cut(poly: [Vec], hits: Int, echo: Bool)
    case snip(x: Double, y: Double, by: String)
    // version 0.2 (DECISIONS #73, #74)
    case gust(x: Double, y: Double, r: Double, m: Double, hits: Int)
    case block(x: Double, y: Double)
    case blink(x: Double, y: Double, fromX: Double, fromY: Double)
    case boom(x: Double, y: Double, r: Double, by: String)
}

public struct SpawnSpec: Codable, Equatable, Sendable {
    public var type: MinionType
    public var c: Int
    public var r: Int
    public var elite: Bool?
    public init(type: MinionType, c: Int, r: Int, elite: Bool? = nil) { self.type = type; self.c = c; self.r = r; self.elite = elite }
}

public struct BossSpec: Codable, Equatable, Sendable {
    public var archetype: BossArchetype
    public var variant: Int
    public var hpMult: Double?
}

public struct RoomSetup {
    public var arena: Arena
    public var D: Double
    public var waves: [[SpawnSpec]]
    public var boss: BossSpec?
    public var seed: UInt32
    public init(arena: Arena, D: Double, waves: [[SpawnSpec]], boss: BossSpec?, seed: UInt32) {
        self.arena = arena; self.D = D; self.waves = waves; self.boss = boss; self.seed = seed
    }
}

struct PendingCut {
    var poly: [Vec]
    var at: Double
    var mult: Double
}

public final class World {
    public let arena: Arena
    public let D: Double
    public let hpScale: Double
    public let dmgScale: Double
    public var rng: Rng
    public let hero: HeroState
    public var enemies: [Enemy] = []
    public var projectiles: [Projectile] = []
    public var hazards: [Hazard] = []
    public var orbs: [HealOrb] = []
    public var whirls: [Whirl] = []
    public var events: [WorldEvent] = []
    public var t = 0.0
    public var kills = 0
    public var waveIndex = 0
    public var cleared = false
    public var exited = false
    public var dead = false
    var nextId = 1
    let waves: [[SpawnSpec]]
    let bossSpec: BossSpec?
    /// Cible courante (rendu).
    public var target: Enemy?
    /// Type de l'ennemi en cours de mise à jour (origine des tirs).
    var shooter = ""
    var shooterId = 0
    var dmgSrc: DamageSource = .other
    var pendingCuts: [PendingCut] = []

    public var waveCount: Int { waves.count }

    public init(_ setup: RoomSetup, hero: HeroState) {
        arena = setup.arena
        D = setup.D
        hpScale = 1 + ScaleK.hpPerD * setup.D
        dmgScale = 1 + ScaleK.dmgPerD * setup.D
        rng = Rng(setup.seed)
        self.hero = hero
        hero.pos = arena.spawn
        hero.thread = []
        hero.embers = []
        hero.momentum = 0
        hero.gustT = 0
        hero.cutT = 0
        hero.vel = Vec(0, 0)
        hero.invuln = 0
        hero.stillTime = 1
        hero.fireCd = 0.3
        hero.aimTime = 0
        waves = setup.waves
        bossSpec = setup.boss
        spawnWave()
    }

    // MARK: apparition

    private func spawnWave() {
        if waveIndex < waves.count {
            for s in waves[waveIndex] {
                spawnEnemy(s.type, Vec(Double(s.c) * 44 + 22, Double(s.r) * 44 + 22), elite: s.elite ?? false, spawnTime: 0.8)
            }
            events.append(.wave(index: waveIndex))
        }
        // le boss arrive avec la dernière vague (ou seul)
        if let b = bossSpec, waveIndex == max(0, waves.count - 1) {
            spawnBoss(b.archetype, b.variant, b.hpMult ?? 1)
        }
        waveIndex += 1
    }

    @discardableResult
    public func spawnEnemy(_ type: MinionType, _ pos: Vec, elite: Bool, spawnTime: Double) -> Enemy? {
        if enemies.count >= K.maxEnemies { return nil }
        let d = Bestiary.def(type)
        let hp = d.hp * hpScale * (elite ? EliteK.hpMult : 1)
        let cd = d.period > 0 ? rng.range(0.6, d.period + 0.4) : 0
        let eliteCd = rng.range(2, 4)
        let strafe: Double = rng.chance(0.5) ? 1 : -1
        let e = Enemy(id: nextId, type: type, pos: pos, radius: d.radius * (elite ? 1.15 : 1), hp: hp,
                      contact: d.contact * dmgScale, shotDmg: d.shotDmg * dmgScale, speed: d.speed, flying: d.flying,
                      elite: elite, t: spawnTime, cd: cd, eliteCd: eliteCd, strafe: strafe)
        nextId += 1
        enemies.append(e)
        return e
    }

    private func spawnBoss(_ archetype: BossArchetype, _ variant: Int, _ hpMult: Double) {
        let def = Bosses.def(archetype)
        let hp = K.bossBaseHP * hpScale * hpMult
        guard let e = spawnEnemy(.goblin, Vec(K.arenaW / 2, 44 * 3.5), elite: false, spawnTime: 1.2) else { return }
        e.radius = def.radius
        e.hp = hp
        e.maxHp = hp
        e.contact = def.contact * dmgScale
        e.shotDmg = def.shotDmg * dmgScale
        e.speed = def.speed
        e.flying = def.flying
        e.cd = 0
        e.boss = BossRuntime(archetype: archetype, variant: variant, breath: K.bossBreath)
    }

    // MARK: boucle

    public func step(_ input: HeroInput) {
        let dt = K.simDT
        events.removeAll(keepingCapacity: true)
        t += dt
        updateHero(input, dt)
        switch hero.kind {
        case .thread: updateThread()
        case .gust: updateGust(dt)
        case .ember: updateEmbers(dt)
        }
        var i = 0
        while i < enemies.count {
            updateEnemy(enemies[i], dt)
            i += 1
        }
        separateEnemies()
        threadContacts(dt)
        updateProjectiles(dt)
        if ThreadRules.enemyProjectilesCut { projectileSnips(dt) }
        updatePendingCuts()
        updateHazards()
        updateOrbs(dt)
        if !whirls.isEmpty { updateWhirls(dt) }
        contactDamage()
        updateStatus(dt)
        reap()

        if !cleared {
            let alive = enemies.count
            if waveIndex < waves.count {
                if alive <= K.waveNextAlive { spawnWave() }
            } else if alive == 0 {
                cleared = true
                events.append(.cleared)
                // projectiles ennemis effacés, orbes de soin ramassés à la fin de la salle
                projectiles = projectiles.filter { $0.fromHero }
                hazards.removeAll()
                for o in orbs { healHero(o.heal) }
                orbs.removeAll()
            }
        } else {
            let h = hero.pos
            if DMath.hypot(h.x - arena.portal.x, h.y - arena.portal.y) < 26 { exited = true }
        }
        if hero.hp <= 0 { dead = true }
    }

    // MARK: héros

    private func updateHero(_ input: HeroInput, _ dt: Double) {
        let h = hero
        let s = h.stats
        var mx = input.mx
        var my = input.my
        let m = DMath.hypot(mx, my)
        if m > 1 {
            mx /= m
            my /= m
        }
        if !input.touching {
            mx = 0
            my = 0
        }
        var sp = s.speed
        // toile de l'araignée tisseuse (DECISIONS #73) : aucune toile ⇒ calcul inchangé
        for z in hazards {
            if let slow = z.slow, slow != 0, t >= z.activeAt, t <= z.endAt, DMath.hypot(h.pos.x - z.pos.x, h.pos.y - z.pos.y) < z.radius {
                sp *= 1 - slow
                break
            }
        }
        let vx = mx * sp
        let vy = my * sp
        let bx = h.pos.x
        let by = h.pos.y
        arena.moveCircle(&h.pos, vx * dt, vy * dt, HeroK.radius)
        h.vel.x = (h.pos.x - bx) / dt
        h.vel.y = (h.pos.y - by) / dt
        let speed = DMath.hypot(h.vel.x, h.vel.y)
        let wasMoving = h.moving
        h.moving = speed >= Control.stillSpeed
        h.stopped = wasMoving && !h.moving
        if h.moving {
            h.stillTime = 0
            if !h.autoFire {
                h.aimTime = 0
                h.facing = DMath.atan2(h.vel.y, h.vel.x)
            }
        } else {
            h.stillTime += dt
            if wasMoving && s.flashStep { h.flashT = 0.3 }
        }
        h.invuln = DMath.max(0, h.invuln - dt)
        h.flashT = DMath.max(0, h.flashT - dt)
        h.fireCd = DMath.max(0, h.fireCd - dt)
        if s.shield && !h.shieldReady {
            h.shieldCd -= dt
            if h.shieldCd <= 0 { h.shieldReady = true }
        }

        // orbe gardien
        if s.orb {
            h.orbAngle += 3.2 * dt
            let ox = h.pos.x + DMath.cos(h.orbAngle) * 56
            let oy = h.pos.y + DMath.sin(h.orbAngle) * 56
            for e in enemies {
                if e.state == .spawn || e.orbHitCd > 0 { continue }
                if DMath.hypot(e.pos.x - ox, e.pos.y - oy) < e.radius + 10 {
                    damageEnemy(e, PowerTuning.orbDamage * (s.damage / HeroK.damage), onHit: false, crit: false)
                    e.orbHitCd = 0.5
                }
            }
        }

        // tir automatique
        let canFire = h.autoFire || !input.touching || h.stillTime >= Control.stillTime
        let prevTarget = target
        target = pickTarget()
        guard let tgt = target, canFire else {
            h.aimTime = 0
            return
        }
        if tgt !== prevTarget { h.aimTime = 0 }
        let ang = DMath.atan2(tgt.pos.y - h.pos.y, tgt.pos.x - h.pos.x)
        h.facing = ang
        h.aimTime += dt
        if h.aimTime < Control.turnTime || h.fireCd > 0 { return }
        h.fireCd = 1 / s.fireRate
        fireVolley(ang)
    }

    /// Le plus proche en ligne de tir, à défaut le plus proche.
    public func pickTarget() -> Enemy? {
        let h = hero.pos
        var idx: [Int] = []
        var dist: [Double] = []
        idx.reserveCapacity(enemies.count)
        dist.reserveCapacity(enemies.count)
        for i in 0..<enemies.count {
            let e = enemies[i]
            if e.state == .spawn || e.hp <= 0 { continue }
            let dx = e.pos.x - h.x
            let dy = e.pos.y - h.y
            let d = dx * dx + dy * dy
            idx.append(i)
            dist.append(d)
            var j = dist.count - 1
            while j > 0 && dist[j - 1] > d {
                dist[j] = dist[j - 1]
                idx[j] = idx[j - 1]
                j -= 1
            }
            dist[j] = d
            idx[j] = i
        }
        if idx.isEmpty { return nil }
        for k in 0..<idx.count {
            let e = enemies[idx[k]]
            if arena.lineOfSight(h, e.pos) { return e }
        }
        return enemies[idx[0]]
    }

    private func fireVolley(_ ang: Double) {
        let h = hero
        let s = h.stats
        var dirs: [Double] = [ang]
        if s.rearShot { dirs.append(ang + DMath.pi) }
        if s.diagonals { dirs.append(ang + DMath.pi / 4); dirs.append(ang - DMath.pi / 4) }
        if s.sideShots { dirs.append(ang + DMath.pi / 2); dirs.append(ang - DMath.pi / 2) }
        let n = 1 + s.multishot
        for a in dirs {
            let cx = DMath.cos(a)
            let cy = DMath.sin(a)
            for i in 0..<n {
                let off = (Double(i) - Double(n - 1) / 2) * 10
                addProjectile(Projectile(
                    pos: Vec(h.pos.x - cy * off + cx * 10, h.pos.y + cx * off + cy * 10),
                    vel: Vec(cx * HeroK.projectileSpeed, cy * HeroK.projectileSpeed),
                    radius: HeroK.projectileRadius,
                    dmg: s.damage * K.shotDmgMult * s.needleMult * (s.pierce ? PowerTuning.pierceDmg : 1) * (h.kind == .thread ? 1 : K.signatureNeedleMult),
                    fromHero: true, born: t, pierce: s.pierce, wallBounce: s.wallBounce, ricochet: s.ricochet))
            }
        }
        events.append(.shoot(x: h.pos.x, y: h.pos.y))
    }

    private func addProjectile(_ p: Projectile) {
        if projectiles.count >= K.maxProjectiles {
            // borne §13 : on recycle le plus ancien projectile du héros, sinon on ignore
            guard let i = projectiles.firstIndex(where: { $0.fromHero }), p.fromHero else { return }
            projectiles.remove(at: i)
        }
        projectiles.append(p)
    }

    public func enemyShot(_ from: Vec, _ ang: Double, _ speed: Double, _ dmg: Double, _ radius: Double = 8) {
        addProjectile(Projectile(pos: from, vel: Vec(DMath.cos(ang) * speed, DMath.sin(ang) * speed), radius: radius, dmg: dmg,
                                 fromHero: false, born: t, pierce: false, wallBounce: 0, ricochet: 0, src: shooter, ownerId: shooterId))
    }

    public func damageHero(_ dmg: Double, src: String) {
        let h = hero
        if h.invuln > 0 || h.flashT > 0 || cleared || h.hp <= 0 { return }
        if h.stats.dodge > 0 && rng.chance(h.stats.dodge) {
            h.invuln = 0.2
            events.append(.dodge)
            return
        }
        if h.shieldReady {
            h.shieldReady = false
            h.shieldCd = PowerTuning.shieldCooldown
            h.invuln = HeroK.invulnAfterHit
            events.append(.shield)
            return
        }
        h.hp -= dmg
        h.damageTaken += dmg
        h.hitsTaken += 1
        h.invuln = HeroK.invulnAfterHit
        events.append(.heroHit(dmg: dmg, src: src))
    }

    public func healHero(_ v: Double) {
        hero.hp = DMath.min(hero.stats.maxHp, hero.hp + v)
    }

    // MARK: ennemis

    private func updateEnemy(_ e: Enemy, _ dt: Double) {
        if e.orbHitCd > 0 { e.orbHitCd -= dt }
        if e.state == .spawn {
            e.t -= dt
            if e.t <= 0 { e.state = .move }
            return
        }
        shooter = e.typeName
        shooterId = e.id
        if e.boss != nil { return updateBoss(e, dt) }
        let slow = e.slowT > 0 ? 1 - PowerTuning.frostSlow : 1
        let h = hero.pos
        let dx = h.x - e.pos.x
        let dy = h.y - e.pos.y
        let dist = DMath.hypot(dx, dy)

        // attaque bonus des élites : anneau lent télégraphié
        if e.elite {
            if e.eliteWind > 0 {
                e.eliteWind -= dt
                if e.eliteWind <= 0 {
                    let off = rng.next() * DMath.pi
                    shooter = "elite"
                    for i in 0..<8 {
                        enemyShot(e.pos, off + (Double(i) * DMath.pi) / 4, 140, e.shotDmg > 0 ? e.shotDmg : e.contact * 0.7, 8)
                    }
                    shooter = e.typeName
                    e.eliteCd = 4.5
                }
            } else {
                e.eliteCd -= dt
                if e.eliteCd <= 0 { e.eliteWind = 0.6 }
            }
        }

        switch e.type {
        case .goblin, .skeleton, .mage:
            let range = Bestiary.def(e.type).range ?? (150, 250)
            if e.state == .move {
                keepRange(e, range.near, range.far, dist, e.speed * slow, dt)
                e.cd -= dt
                if e.cd <= 0 {
                    e.state = .windup
                    e.t = e.type == .mage ? 0.3 : 0.5
                    if e.type == .mage {
                        // flaque télégraphiée 0,8 s à la position actuelle du héros
                        hazards.append(Hazard(kind: .circle, pos: h, radius: 50, born: t, activeAt: t + 0.8, endAt: t + 0.8 + 3,
                                              dmg: e.shotDmg, tick: 0.5, nextTick: t + 0.8, ownerId: e.id, src: shooter))
                    }
                }
            } else if e.state == .windup {
                e.t -= dt
                if e.t <= 0 {
                    let a = DMath.atan2(h.y - e.pos.y, h.x - e.pos.x)
                    if e.type == .goblin {
                        enemyShot(e.pos, a, 300, e.shotDmg, 7)
                    } else if e.type == .skeleton {
                        for k in [-1, 0, 1] { enemyShot(e.pos, a + (Double(k) * 15 * DMath.pi) / 180, 340, e.shotDmg, 6) }
                    }
                    e.state = .move
                    e.cd = Bestiary.def(e.type).period
                }
            }
        case .mushroom, .totem:
            if e.state == .move {
                e.cd -= dt
                if e.cd <= 0 {
                    e.state = .windup
                    e.t = 0.5
                }
            } else if e.state == .windup {
                e.t -= dt
                if e.t <= 0 {
                    if e.type == .mushroom {
                        let off = rng.next() * DMath.pi
                        for i in 0..<8 { enemyShot(e.pos, off + (Double(i) * DMath.pi) / 4, 150, e.shotDmg, 8) }
                    } else {
                        e.volley += 1
                        let off = (Double(e.volley) * 20 * DMath.pi) / 180
                        for i in 0..<6 { enemyShot(e.pos, off + (Double(i) * DMath.pi) / 3, 170, e.shotDmg, 8) }
                    }
                    e.state = .move
                    e.cd = Bestiary.def(e.type).period - 0.5
                }
            }
        case .wolf, .snipper:
            // le crabe-ciseaux vise le milieu du fil s'il est assez long (ThreadRules), sinon l'héroïne
            let th = hero.thread
            let aimAt: Vec = e.type == .snipper && ThreadRules.snipperAimsAtThread(hero.stats, threadCount: th.count) ? th[th.count >> 1].v : h
            let adx = aimAt.x - e.pos.x
            let ady = aimAt.y - e.pos.y
            let chargeSpeed: Double = e.type == .snipper ? 360 : 420
            if e.state == .move {
                chase(e, e.speed * slow, dt)
                e.cd -= dt
                if e.cd <= 0 && DMath.hypot(adx, ady) < 320 && arena.lineOfWalk(e.pos, aimAt) {
                    e.state = .windup
                    e.t = 0.6
                    let dir = normJS(adx, ady)
                    e.aim = dir
                    let len = rayLength(e.pos, dir, 340, e.radius)
                    e.chargeLeft = len
                    hazards.append(Hazard(kind: .line, pos: e.pos, to: Vec(e.pos.x + dir.x * len, e.pos.y + dir.y * len), radius: e.radius,
                                          born: t, activeAt: t + 0.6, endAt: t + 0.6 + len / chargeSpeed, dmg: 0, tick: 0,
                                          nextTick: .infinity, ownerId: e.id, src: shooter))
                }
            } else if e.state == .windup {
                e.t -= dt
                if e.t <= 0 { e.state = .charge }
            } else if e.state == .charge {
                let step = DMath.min(e.chargeLeft, chargeSpeed * dt)
                arena.moveCircle(&e.pos, e.aim.x * step, e.aim.y * step, e.radius)
                e.chargeLeft -= step
                if e.chargeLeft <= 0 {
                    e.state = .recover
                    e.t = 0.6
                }
            } else if e.state == .recover {
                e.t -= dt
                if e.t <= 0 {
                    e.state = .move
                    e.cd = Bestiary.def(e.type).period
                }
            }
        case .jelly, .jellySmall:
            chase(e, e.speed * slow, dt)
        case .moth:
            updateMoth(e, slow: slow, dist: dist, dt)
        case .bat:
            if e.state == .move {
                // vol en zigzag vers le héros
                let dir = normJS(dx, dy)
                let w = DMath.sin(t * 4 + Double(e.id)) * 0.8 * e.strafe
                let vx = dir.x - dir.y * w
                let vy = dir.y + dir.x * w
                let n2 = normJS(vx, vy)
                let sp = dist > 90 ? e.speed : e.speed * 0.4
                arena.moveCircle(&e.pos, n2.x * sp * slow * dt, n2.y * sp * slow * dt, e.radius, flying: true)
                e.cd -= dt
                if e.cd <= 0 && dist < 260 {
                    e.state = .windup
                    e.t = 0.5
                    e.aim = normJS(dx, dy)
                    let len = DMath.min(dist + 60, 0.45 * 380)
                    hazards.append(Hazard(kind: .line, pos: e.pos, to: Vec(e.pos.x + e.aim.x * len, e.pos.y + e.aim.y * len), radius: e.radius,
                                          born: t, activeAt: t + 0.5, endAt: t + 0.5 + len / 380, dmg: 0, tick: 0,
                                          nextTick: .infinity, ownerId: e.id, src: shooter))
                    e.chargeLeft = len
                }
            } else if e.state == .windup {
                e.t -= dt
                if e.t <= 0 { e.state = .charge }
            } else if e.state == .charge {
                let step = DMath.min(e.chargeLeft, 380 * dt)
                arena.moveCircle(&e.pos, e.aim.x * step, e.aim.y * step, e.radius, flying: true)
                e.chargeLeft -= step
                if e.chargeLeft <= 0 {
                    e.state = .recover
                    e.t = 0.4
                }
            } else if e.state == .recover {
                e.t -= dt
                if e.t <= 0 {
                    e.state = .move
                    e.cd = Bestiary.def(.bat).period
                }
            }
        // ───── chapitres 11 à 15 (DECISIONS #73) ─────
        case .lantern:
            updateLantern(e, dist, slow, dt)
        case .weaver, .puppeteer:
            updateCaster(e, dist, slow, dt)
        case .beetle:
            updateBeetle(e, dx, dy, slow, dt)
        case .shade:
            chase(e, e.speed * slow, dt)
        case .specter:
            updateSpecter(e, slow, dt)
        }
    }

    /// Lampion : fonce sur l'héroïne, s'arrête à portée et explose après 0,8 s (le tuer avant désamorce).
    private func updateLantern(_ e: Enemy, _ dist: Double, _ slow: Double, _ dt: Double) {
        if e.state == .move {
            chase(e, e.speed * slow, dt)
            if dist < 58 + e.radius {
                e.state = .windup
                e.t = 0.8
                hazards.append(Hazard(kind: .circle, pos: e.pos, radius: 66, born: t, activeAt: t + 0.8, endAt: t + 0.8 + 0.12,
                                      dmg: e.shotDmg, tick: 1, nextTick: t + 0.8, ownerId: e.id, src: "lantern"))
            }
        } else if e.state == .windup {
            e.t -= dt
            if e.t <= 0 {
                e.volley = 1 // a explosé : la zone reste active même s'il meurt
                events.append(.boom(x: e.pos.x, y: e.pos.y, r: 66, by: "lantern"))
                e.hp = 0
            }
        }
    }

    /// Araignée tisseuse (toile qui ralentit) et montreur d'ombres (invoque deux ombres) : tireurs à distance.
    private func updateCaster(_ e: Enemy, _ dist: Double, _ slow: Double, _ dt: Double) {
        let def = Bestiary.def(e.type)
        let range = def.range ?? (150, 280)
        let h = hero.pos
        if e.state == .move {
            keepRange(e, range.near, range.far, dist, e.speed * slow, dt)
            e.cd -= dt
            if e.cd <= 0 && arena.lineOfSight(e.pos, h) {
                e.state = .windup
                e.t = e.type == .weaver ? 0.6 : 1.0
                e.aim = Vec(h.x, h.y)
                if e.type == .weaver {
                    // la toile tombe là où était l'héroïne au début du geste (télégraphe : cercle visible 0,6 s)
                    hazards.append(Hazard(kind: .circle, pos: Vec(h.x, h.y), radius: 50, born: t, activeAt: t + 0.6, endAt: t + 0.6 + 4.5,
                                          dmg: 0, tick: 0, nextTick: .infinity, ownerId: e.id, src: "weaver", slow: K.webSlow))
                }
            }
        } else if e.state == .windup {
            e.t -= dt
            if e.t <= 0 {
                if e.type == .puppeteer {
                    var shades = 0
                    for o in enemies where o.type == .shade && o.boss == nil { shades += 1 }
                    var k = 0
                    while k < 2 && shades < 6 {
                        let ang = rng.next() * DMath.pi * 2
                        let pos = Vec(clampJS(e.pos.x + DMath.cos(ang) * 34, 30, K.arenaW - 30), clampJS(e.pos.y + DMath.sin(ang) * 34, 30, K.arenaH - 30))
                        if arena.isWalkableAt(pos.x, pos.y) && spawnEnemy(.shade, pos, elite: false, spawnTime: 0.4) != nil { shades += 1 }
                        k += 1
                    }
                }
                e.state = .move
                e.cd = def.period
            }
        }
    }

    /// Scarabée-bouclier : se tourne lentement vers l'héroïne (bouclier devant), avance, coup de bouclier au sol.
    private func updateBeetle(_ e: Enemy, _ dx: Double, _ dy: Double, _ slow: Double, _ dt: Double) {
        if e.state != .charge {
            // rotation bornée du bouclier (1,6 rad/s) : on le contourne en courant
            let want = DMath.atan2(dy, dx)
            let cur = DMath.atan2(e.aim.y, e.aim.x)
            var d = want - cur
            while d > DMath.pi { d -= 2 * DMath.pi }
            while d < -DMath.pi { d += 2 * DMath.pi }
            let a = cur + DMath.max(-1.6 * dt, DMath.min(1.6 * dt, d))
            e.aim = Vec(DMath.cos(a), DMath.sin(a))
        }
        if e.state == .move {
            chase(e, e.speed * slow, dt)
            e.cd -= dt
            // coup de bouclier au sol : onde courte télégraphiée 0,7 s autour de lui
            if e.cd <= 0 && DMath.hypot(dx, dy) < 96 {
                e.state = .windup
                e.t = 0.7
                hazards.append(Hazard(kind: .circle, pos: e.pos, radius: 64, born: t, activeAt: t + 0.7, endAt: t + 0.7 + 0.12,
                                      dmg: e.contact, tick: 1, nextTick: t + 0.7, ownerId: e.id, src: "beetle"))
            }
        } else if e.state == .windup {
            e.t -= dt
            if e.t <= 0 {
                e.state = .recover
                e.t = 0.6
            }
        } else if e.state == .recover {
            e.t -= dt
            if e.t <= 0 {
                e.state = .move
                e.cd = Bestiary.def(.beetle).period
            }
        }
    }

    /// Les aiguilles qui arrivent de face sur le bouclier du scarabée rebondissent (±70°).
    func shielded(_ e: Enemy, _ p: Projectile) -> Bool {
        if e.boss != nil || e.type != .beetle { return false }
        let v0 = DMath.hypot(p.vel.x, p.vel.y)
        let v = (v0 == 0 || v0.isNaN) ? 1 : v0
        return (e.aim.x * p.vel.x + e.aim.y * p.vel.y) / v < -0.34
    }

    /// Spectre : dérive, puis se téléporte près de l'héroïne (marque 0,7 s) et lâche un anneau 0,35 s après.
    private func updateSpecter(_ e: Enemy, _ slow: Double, _ dt: Double) {
        let h = hero.pos
        if e.state == .move {
            chase(e, e.speed * slow, dt)
            e.cd -= dt
            if e.cd <= 0 {
                let ang = rng.next() * DMath.pi * 2
                let to = Vec(clampJS(h.x + DMath.cos(ang) * 120, 36, K.arenaW - 36), clampJS(h.y + DMath.sin(ang) * 120, 36, K.arenaH - 36))
                e.aim = to
                e.state = .windup
                e.t = 0.7
                hazards.append(Hazard(kind: .circle, pos: to, radius: 26, born: t, activeAt: t + 0.7, endAt: t + 0.7,
                                      dmg: 0, tick: 0, nextTick: .infinity, ownerId: e.id, src: "specter"))
            }
        } else if e.state == .windup {
            e.t -= dt
            if e.t <= 0 {
                events.append(.blink(x: e.aim.x, y: e.aim.y, fromX: e.pos.x, fromY: e.pos.y))
                e.pos = Vec(e.aim.x, e.aim.y)
                e.state = .recover
                e.t = 0.35
            }
        } else if e.state == .recover {
            e.t -= dt
            if e.t <= 0 {
                let off = rng.next() * DMath.pi
                for i in 0..<6 { enemyShot(e.pos, off + (Double(i) * DMath.pi) / 3, 150, e.shotDmg, 8) }
                e.state = .move
                e.cd = Bestiary.def(.specter).period
            }
        }
    }

    /// Longueur libre d'un rayon de charge (s'arrête devant un obstacle de marche).
    func rayLength(_ from: Vec, _ dir: Vec, _ max: Double, _ rad: Double) -> Double {
        var d = 10.0
        while d <= max {
            let x = from.x + dir.x * d
            let y = from.y + dir.y * d
            if !arena.isWalkableAt(x + dir.x * rad, y + dir.y * rad) { return DMath.max(0, d - 10) }
            d += 10
        }
        return max
    }

    func chase(_ e: Enemy, _ speed: Double, _ dt: Double) {
        let dir = e.flying ? normJS(hero.pos.x - e.pos.x, hero.pos.y - e.pos.y) : arena.steer(e.pos, hero.pos)
        arena.moveCircle(&e.pos, dir.x * speed * dt, dir.y * speed * dt, e.radius, flying: e.flying)
    }

    private func keepRange(_ e: Enemy, _ near: Double, _ far: Double, _ dist: Double, _ speed: Double, _ dt: Double) {
        let h = hero.pos
        if dist > far || !arena.lineOfSight(e.pos, h) {
            chase(e, speed, dt)
        } else if dist < near {
            // recul, mais pas jusqu'au mur : près d'un bord on glisse vers l'intérieur (DECISIONS #42)
            var ax = e.pos.x - h.x
            var ay = e.pos.y - h.y
            var n0 = DMath.hypot(ax, ay)
            if n0 == 0 || n0.isNaN { n0 = 1 }
            ax /= n0
            ay /= n0
            let W = K.wallShy
            if e.pos.x < W { ax += (W - e.pos.x) / W } else if e.pos.x > K.arenaW - W { ax -= (e.pos.x - (K.arenaW - W)) / W }
            if e.pos.y < W { ay += (W - e.pos.y) / W } else if e.pos.y > K.arenaH - W { ay -= (e.pos.y - (K.arenaH - W)) / W }
            let away = normJS(ax, ay)
            arena.moveCircle(&e.pos, away.x * speed * dt, away.y * speed * dt, e.radius)
        } else {
            // déplacement latéral léger
            let side = normJS(-(h.y - e.pos.y) * e.strafe, (h.x - e.pos.x) * e.strafe)
            let before = e.pos
            arena.moveCircle(&e.pos, side.x * speed * 0.5 * dt, side.y * speed * 0.5 * dt, e.radius)
            if DMath.hypot(e.pos.x - before.x, e.pos.y - before.y) < speed * 0.1 * dt { e.strafe = -e.strafe }
        }
    }

    // MARK: boss

    private func updateBoss(_ e: Enemy, _ dt: Double) {
        guard let b = e.boss else { return }
        let def = Bosses.def(b.archetype)
        let h = hero.pos
        let frac = e.hp / e.maxHp
        let phase = frac > 2.0 / 3.0 ? 0 : frac > 1.0 / 3.0 ? 1 : 2
        if phase != b.phase {
            b.phase = phase
            b.patternIdx = 0
        }
        let slow = e.slowT > 0 ? 1 - PowerTuning.frostSlow : 1
        let v = b.variant
        if b.breath > 0 {
            // ouverture : le boss reprend son souffle et se replace lentement
            b.breath -= dt
            let dist = DMath.hypot(h.x - e.pos.x, h.y - e.pos.y)
            if dist > 200 { chase(e, e.speed * slow, dt) }
            if b.breath <= 0 {
                let list = def.phases[b.phase]
                let p = list[b.patternIdx % list.count]
                b.pattern = p
                b.patternIdx += 1
                b.repeatsLeft = p.repeats ?? 1
                e.state = .windup
                e.t = p.kind == .charge ? 0.7 : 0.6
                if p.kind == .charge { bossChargeTelegraph(e, p) }
                if p.kind == .slam { bossSlamTelegraph(e, p) }
                if p.kind == .puddles || p.kind == .rain { bossZones(e, p, v) }
            }
            return
        }
        guard let p = b.pattern else { return }
        if e.state == .windup {
            e.t -= dt
            if e.t > 0 { return }
            if p.kind == .charge {
                e.state = .charge
                return
            }
            e.state = .move
            e.t = 0
        }
        if e.state == .charge {
            let sp = (p.speed ?? 450) * (1 + 0.06 * Double(v))
            let step = DMath.min(e.chargeLeft, sp * dt)
            arena.moveCircle(&e.pos, e.aim.x * step, e.aim.y * step, e.radius, flying: e.flying)
            e.chargeLeft -= step
            if e.chargeLeft > 0 { return }
            e.state = .move
            endPattern(e)
            return
        }
        // exécution du motif
        e.t -= dt
        if e.t > 0 { return }
        let sp = (p.speed ?? 200) * (1 + 0.06 * Double(v))
        let a = DMath.atan2(h.y - e.pos.y, h.x - e.pos.x)
        let cnt = p.count + v
        switch p.kind {
        case .aimed:
            let spread = ((p.spread ?? 30) * DMath.pi) / 180
            for i in 0..<cnt {
                enemyShot(e.pos, a + (cnt == 1 ? 0 : -spread / 2 + (spread * Double(i)) / Double(cnt - 1)), sp, e.shotDmg, 8)
            }
        case .ring:
            let off = rng.next() * DMath.pi * 2
            let n = p.count + 2 * v
            for i in 0..<n { enemyShot(e.pos, off + (Double(i) * 2 * DMath.pi) / Double(n), sp, e.shotDmg, 9) }
        case .spiral:
            b.spin += 0.35
            for i in 0..<cnt { enemyShot(e.pos, b.spin + (Double(i) * 2 * DMath.pi) / Double(cnt), sp, e.shotDmg, 8) }
        case .summon:
            let mt = p.minion ?? .goblin
            for _ in 0..<p.count {
                let ang = rng.next() * DMath.pi * 2
                let pos = Vec(clampJS(e.pos.x + DMath.cos(ang) * 60, 30, K.arenaW - 30), clampJS(e.pos.y + DMath.sin(ang) * 60, 30, K.arenaH - 30))
                if arena.isWalkableAt(pos.x, pos.y) { spawnEnemy(mt, pos, elite: false, spawnTime: 0.6) }
            }
        case .slam, .puddles, .rain, .charge:
            break
        }
        b.repeatsLeft -= 1
        if b.repeatsLeft > 0 {
            e.t = p.interval ?? 0.5
            return
        }
        endPattern(e)
    }

    private func endPattern(_ e: Enemy) {
        guard let b = e.boss, let p = b.pattern else { return }
        if p.kind == .charge && p.count > 1 && e.volley < p.count - 1 {
            e.volley += 1
            e.state = .windup
            e.t = 0.7
            bossChargeTelegraph(e, p)
            return
        }
        e.volley = 0
        b.pattern = nil
        b.breath = K.bossBreath
        e.state = .move
    }

    private func bossChargeTelegraph(_ e: Enemy, _ p: Pattern) {
        let h = hero.pos
        let dir = normJS(h.x - e.pos.x, h.y - e.pos.y)
        let len = e.flying ? DMath.min(420, DMath.hypot(h.x - e.pos.x, h.y - e.pos.y) + 80) : rayLength(e.pos, dir, 420, e.radius)
        e.aim = dir
        e.chargeLeft = len
        let sp = (p.speed ?? 450) * (1 + 0.06 * Double(e.boss?.variant ?? 0))
        hazards.append(Hazard(kind: .line, pos: e.pos, to: Vec(e.pos.x + dir.x * len, e.pos.y + dir.y * len), radius: e.radius,
                              born: t, activeAt: t + 0.7, endAt: t + 0.7 + len / sp, dmg: 0, tick: 0, nextTick: .infinity,
                              ownerId: e.id, src: shooter))
        e.state = .windup
        e.t = 0.7
    }

    private func bossSlamTelegraph(_ e: Enemy, _ p: Pattern) {
        let r = (p.radius ?? 120) * (1 + 0.05 * Double(e.boss?.variant ?? 0))
        // télégraphe assez long pour sortir de la zone depuis le centre à vitesse de base (+ marge de réaction)
        let warn = DMath.max(0.8, (r + HeroK.radius * 0.5) / HeroK.speed + K.bossSlamMargin)
        hazards.append(Hazard(kind: .circle, pos: e.pos, radius: r, born: t, activeAt: t + warn, endAt: t + warn + 0.15,
                              dmg: e.shotDmg * 1.5, tick: 1, nextTick: t + warn, ownerId: e.id, src: shooter))
        e.t = warn + 0.15
    }

    private func bossZones(_ e: Enemy, _ p: Pattern, _ v: Int) {
        let h = hero.pos
        let n = p.count + v
        let lasting = p.kind == .puddles
        for i in 0..<n {
            var pos: Vec
            if i == 0 {
                pos = h
            } else {
                let x = clampJS(h.x + rng.range(-170, 170), 30, K.arenaW - 30)
                let y = clampJS(h.y + rng.range(-200, 200), 30, K.arenaH - 30)
                pos = Vec(x, y)
            }
            let warn = lasting ? 0.8 : 0.9 + 0.12 * Double(i)
            hazards.append(Hazard(kind: .circle, pos: pos, radius: p.radius ?? 50, born: t, activeAt: t + warn,
                                  endAt: t + warn + (lasting ? 3 : 0.15), dmg: lasting ? e.shotDmg * 0.6 : e.shotDmg,
                                  tick: lasting ? 0.5 : 1, nextTick: t + warn, ownerId: e.id, src: shooter))
        }
        e.t = lasting ? 0.8 : 1.1
    }

    // MARK: projectiles

    private func updateProjectiles(_ dt: Double) {
        let h = hero
        for p in projectiles {
            if p.dead { continue }
            // sous-pas pour éviter de traverser une case (900 pt/s)
            let sub = p.fromHero ? 3 : 1
            var k = 0
            while k < sub && !p.dead {
                defer { k += 1 }
                let nx = p.pos.x + (p.vel.x * dt) / Double(sub)
                let ny = p.pos.y + (p.vel.y * dt) / Double(sub)
                if arena.isShotBlockedAt(nx, ny) {
                    if p.fromHero && p.wallBounce > 0 {
                        p.wallBounce -= 1
                        let bx = arena.isShotBlockedAt(nx, p.pos.y)
                        let by = arena.isShotBlockedAt(p.pos.x, ny)
                        if bx || !by { p.vel.x = -p.vel.x }
                        if by || !bx { p.vel.y = -p.vel.y }
                        continue
                    }
                    p.dead = true
                    break
                }
                p.pos.x = nx
                p.pos.y = ny
                if p.fromHero {
                    for e in enemies {
                        if e.hp <= 0 || e.state == .spawn || e.id == p.lastHit { continue }
                        let rr = e.radius + p.radius
                        let ddx = e.pos.x - p.pos.x
                        let ddy = e.pos.y - p.pos.y
                        if ddx * ddx + ddy * ddy > rr * rr { continue }
                        heroHit(p, e)
                        break
                    }
                } else {
                    let rr = HeroK.radius + p.radius
                    let ex = h.pos.x - p.pos.x
                    let ey = h.pos.y - p.pos.y
                    if ex * ex + ey * ey <= rr * rr && !cleared {
                        damageHero(p.dmg, src: "proj:" + (p.src ?? "?"))
                        p.dead = true
                    }
                }
            }
        }
        projectiles.removeAll { $0.dead }
    }

    private func heroHit(_ p: Projectile, _ e: Enemy) {
        dmgSrc = .shot
        heroHitInner(p, e)
        dmgSrc = .other
    }

    private func heroHitInner(_ p: Projectile, _ e: Enemy) {
        let s = hero.stats
        if e.boss == nil && e.type == .beetle && shielded(e, p) {
            p.dead = true
            events.append(.block(x: p.pos.x, y: p.pos.y))
            return
        }
        let crit = s.critChance > 0 && rng.chance(s.critChance)
        var dmg = p.dmg * (crit ? 2 : 1)
        if e.elite || e.boss != nil { dmg *= s.eliteMult }
        // les aiguilles épinglent les mites de papier (DECISIONS #41)
        if e.boss == nil && e.type == .moth { dmg *= K.needleMothMult }
        damageEnemy(e, dmg, onHit: true, crit: crit)
        p.lastHit = e.id
        // Sorcier de braise : ses projectiles sont des braises, la cible touchée couve
        if hero.kind == .ember {
            e.emberT = DMath.max(e.emberT, EmberK.needleLinger)
            e.emberDps = DMath.max(e.emberDps, EmberK.dps * EmberK.needleFrac * (s.damage / HeroK.damage) * s.emberDmgMult)
        }
        if s.chain {
            var n = 0
            var sorted = enemies.filter { o in
                o !== e && o.hp > 0 && o.state != .spawn && DMath.hypot(o.pos.x - e.pos.x, o.pos.y - e.pos.y) < 160
            }
            stableSort(&sorted) { a, b in
                DMath.hypot(a.pos.x - e.pos.x, a.pos.y - e.pos.y) - DMath.hypot(b.pos.x - e.pos.x, b.pos.y - e.pos.y)
            }
            for o in sorted {
                if n >= PowerTuning.chainTargets { break }
                n += 1
                damageEnemy(o, dmg * PowerTuning.chainFrac, onHit: false, crit: false)
            }
        }
        if p.ricochet > 0 {
            var best: Enemy?
            var bd = 260.0
            for o in enemies {
                if o === e || o.hp <= 0 || o.state == .spawn { continue }
                let d = DMath.hypot(o.pos.x - p.pos.x, o.pos.y - p.pos.y)
                if d < bd {
                    bd = d
                    best = o
                }
            }
            if let best {
                p.ricochet -= 1
                p.dmg *= PowerTuning.ricochetDmg
                let dir = normJS(best.pos.x - p.pos.x, best.pos.y - p.pos.y)
                p.vel.x = dir.x * HeroK.projectileSpeed
                p.vel.y = dir.y * HeroK.projectileSpeed
                return
            }
        }
        if !p.pierce { p.dead = true }
    }

    public func damageEnemy(_ e: Enemy, _ dmg: Double, onHit: Bool, crit: Bool) {
        if e.hp <= 0 { return }
        let s = hero.stats
        hero.dmgBy[dmgSrc] += DMath.min(dmg, e.hp)
        e.hp -= dmg
        if s.lifesteal > 0 { healHero(dmg * s.lifesteal) }
        events.append(.hit(x: e.pos.x, y: e.pos.y, crit: crit))
        if !onHit { return }
        if s.flame {
            e.burnT = 2
            e.burnDps = DMath.max(e.burnDps, dmg * 0.2)
        }
        if s.frost { e.slowT = PowerTuning.frostDuration }
        if s.poison {
            e.poisonStacks = min(5, e.poisonStacks + 1)
            e.poisonT = 4
            e.poisonDps = s.damage * PowerTuning.poisonPerStack * Double(e.poisonStacks)
        }
    }

    private func updateStatus(_ dt: Double) {
        for e in enemies {
            if e.slowT > 0 { e.slowT -= dt }
            if e.burnT > 0 {
                e.burnT -= dt
                if e.hp > 0 { hero.dmgBy.other += DMath.min(e.hp, e.burnDps * dt) }
                e.hp -= e.burnDps * dt
                if e.burnT <= 0 { e.burnDps = 0 }
            }
            if e.emberT > 0 {
                e.emberT -= dt
                if e.hp > 0 { hero.dmgBy.sig += DMath.min(e.hp, e.emberDps * dt) }
                e.hp -= e.emberDps * dt
                if e.emberT <= 0 { e.emberDps = 0 }
            }
            if e.poisonT > 0 {
                e.poisonT -= dt
                if e.hp > 0 { hero.dmgBy.other += DMath.min(e.hp, e.poisonDps * dt) }
                e.hp -= e.poisonDps * dt
                if e.poisonT <= 0 {
                    e.poisonStacks = 0
                    e.poisonDps = 0
                }
            }
        }
    }

    private func reap() {
        let s = hero.stats
        let deadOnes = enemies.filter { $0.hp <= 0 }
        if deadOnes.isEmpty { return }
        enemies = enemies.filter { $0.hp > 0 }
        for e in deadOnes {
            kills += 1
            events.append(.kill(x: e.pos.x, y: e.pos.y, type: e.typeName))
            let defused = e.boss == nil && e.type == .lantern && e.volley == 0
            hazards = hazards.filter { !($0.ownerId == e.id && ($0.dmg == 0 || defused)) }
            if s.combustion && e.emberT > 0 {
                let boom = DMath.min(e.maxHp * EmberK.combustFrac, EmberK.combustCap * (s.damage / HeroK.damage))
                events.append(.boom(x: e.pos.x, y: e.pos.y, r: EmberK.combustRadius, by: "combustion"))
                dmgSrc = .sig
                for o in enemies where o.hp > 0 && DMath.hypot(o.pos.x - e.pos.x, o.pos.y - e.pos.y) < EmberK.combustRadius + o.radius {
                    damageEnemy(o, boom, onHit: false, crit: false)
                }
                dmgSrc = .other
            }
            if e.boss == nil && e.type == .jelly {
                for k in [-1.0, 1.0] {
                    var pos = Vec(e.pos.x + k * 14, e.pos.y)
                    if !arena.isWalkableAt(pos.x, pos.y) { pos.x = e.pos.x }
                    spawnEnemy(.jellySmall, pos, elite: false, spawnTime: 0.25)
                }
            }
            if s.blast {
                for o in enemies where o.hp > 0 && DMath.hypot(o.pos.x - e.pos.x, o.pos.y - e.pos.y) < 64 + o.radius {
                    damageEnemy(o, s.damage * 0.5, onHit: false, crit: false)
                }
            }
            if e.boss == nil && rng.chance(HealOrbK.dropChance) {
                orbs.append(HealOrb(pos: e.pos, heal: hero.stats.maxHp * HealOrbK.healFrac))
            }
        }
        // une explosion peut tuer en chaîne
        if enemies.contains(where: { $0.hp <= 0 }) { reap() }
    }

    private func updateHazards() {
        let h = hero.pos
        for z in hazards {
            if z.dmg <= 0 || t < z.activeAt || t > z.endAt { continue }
            if t + 1e-9 < z.nextTick { continue }
            z.nextTick += z.tick
            if DMath.hypot(h.x - z.pos.x, h.y - z.pos.y) < z.radius + HeroK.radius * 0.5 {
                damageHero(z.dmg, src: "zone:" + (z.src ?? "?"))
            }
        }
        let now = t
        hazards.removeAll { !(now <= $0.endAt) }
    }

    private func updateOrbs(_ dt: Double) {
        let h = hero
        let magnet = h.stats.magnet
        var kept: [HealOrb] = []
        kept.reserveCapacity(orbs.count)
        for var o in orbs {
            let d = DMath.hypot(h.pos.x - o.pos.x, h.pos.y - o.pos.y)
            if magnet && d < HealOrbK.magnetRange {
                let dir = normJS(h.pos.x - o.pos.x, h.pos.y - o.pos.y)
                o.pos.x += dir.x * 320 * dt
                o.pos.y += dir.y * 320 * dt
            }
            if d < HealOrbK.pickupRadius {
                healHero(o.heal * (magnet ? HealOrbK.magnetHealMult : 1))
                continue
            }
            kept.append(o)
        }
        orbs = kept
    }

    private func contactDamage() {
        let h = hero.pos
        for e in enemies {
            if e.state == .spawn || e.contact <= 0 { continue }
            let rr = e.radius + HeroK.radius - 2
            let dx = e.pos.x - h.x
            let dy = e.pos.y - h.y
            if dx * dx + dy * dy < rr * rr {
                damageHero(e.contact, src: "contact:" + e.typeName + (e.state == .charge ? "-charge" : ""))
            }
        }
    }

    private func separateEnemies() {
        let es = enemies
        for i in 0..<es.count {
            let a = es[i]
            if a.boss != nil || a.state == .charge { continue }
            var j = i + 1
            while j < es.count {
                defer { j += 1 }
                let b = es[j]
                if b.boss != nil || b.state == .charge || a.flying != b.flying { continue }
                let dx = b.pos.x - a.pos.x
                let dy = b.pos.y - a.pos.y
                let rr = a.radius + b.radius
                let d2 = dx * dx + dy * dy
                if d2 >= rr * rr || d2 < 1e-6 { continue }
                let d = d2.squareRoot()
                let push = (rr - d) / 2
                let ux = dx / d
                let uy = dy / d
                if a.speed > 0 { arena.moveCircle(&a.pos, -ux * push, -uy * push, a.radius, flying: a.flying) }
                if b.speed > 0 { arena.moveCircle(&b.pos, ux * push, uy * push, b.radius, flying: b.flying) }
            }
        }
    }

    /// Continuer (§11) : rend 50 % des PV et efface les projectiles.
    // MARK: Moine du vent — élan et bourrasque (DECISIONS #74)

    /// Courir charge l'élan ; s'arrêter le libère en bourrasque.
    private func updateGust(_ dt: Double) {
        let h = hero
        let s = h.stats
        h.gustCd = DMath.max(0, h.gustCd - dt)
        h.gustT = DMath.max(0, h.gustT - dt * 2.2)
        if cleared {
            h.momentum = 0
            return
        }
        if h.moving {
            h.momentum = DMath.min(1, h.momentum + (dt * s.momentumRate) / GustK.chargeTime)
        } else if h.stopped && h.momentum >= GustK.minMomentum && h.gustCd <= 0 {
            gust(h.momentum)
        } else {
            h.momentum = DMath.max(0, h.momentum - GustK.decay * dt)
        }
    }

    private func gust(_ m: Double) {
        let h = hero
        let s = h.stats
        let r = (GustK.radius + GustK.radiusPerMomentum * m) * s.gustRadiusMult
        let base = GustK.damage * m * (s.damage / HeroK.damage) * s.gustDmgMult
        var hits = 0
        dmgSrc = .sig
        for e in enemies {
            if e.hp <= 0 || e.state == .spawn { continue }
            let dx = e.pos.x - h.pos.x
            let dy = e.pos.y - h.pos.y
            let d = DMath.hypot(dx, dy)
            if d > r + e.radius { continue }
            hits += 1
            let crit = s.critChance > 0 && rng.chance(s.critChance)
            var dmg = base * (crit ? 2 : 1)
            if e.elite || e.boss != nil { dmg *= s.eliteMult }
            damageEnemy(e, dmg, onHit: true, crit: crit)
            if e.boss != nil { continue }
            // recul, et un tireur en plein geste est interrompu
            let push = GustK.knockback * m * (1 - (0.5 * d) / (r + e.radius))
            let dir = d > 1e-6 ? Vec(dx / d, dy / d) : Vec(0, -1)
            if e.state != .charge { arena.moveCircle(&e.pos, dir.x * push, dir.y * push, e.radius, flying: e.flying) }
            if e.state == .windup && [.goblin, .skeleton, .weaver, .puppeteer, .specter].contains(e.type) {
                e.state = .move
                e.cd = DMath.max(e.cd, 0.8)
                let now = t
                hazards = hazards.filter { !($0.ownerId == e.id && $0.dmg == 0 && now < $0.activeAt) }
            }
        }
        dmgSrc = .other
        // projectiles ennemis pris dans la bourrasque : dissipés (Œil du cyclone : renvoyés)
        for p in projectiles {
            if p.fromHero || p.dead { continue }
            let dx = p.pos.x - h.pos.x
            let dy = p.pos.y - h.pos.y
            let d = DMath.hypot(dx, dy)
            if d > r + p.radius { continue }
            if s.eyeOfStorm {
                let dir = d > 1e-6 ? Vec(dx / d, dy / d) : Vec(0, -1)
                p.fromHero = true
                p.vel = Vec(dir.x * 520, dir.y * 520)
                p.dmg = s.damage * 0.6
                p.born = t
                p.src = "gust"
                p.lastHit = -1
            } else {
                p.dead = true
            }
        }
        projectiles.removeAll { $0.dead }
        if s.whirlwind { whirls.append(Whirl(pos: h.pos, endAt: t + GustK.whirlLife, r: GustK.whirlRadius)) }
        if s.featherStep { h.invuln = DMath.max(h.invuln, GustK.featherInvuln) }
        events.append(.gust(x: h.pos.x, y: h.pos.y, r: r, m: m, hits: hits))
        h.momentum = 0
        h.gustCd = GustK.cooldown
        h.gustT = 1
        h.gusts += 1
    }

    /// Tourbillons : aspirent les ennemis vers leur centre et les blessent.
    private func updateWhirls(_ dt: Double) {
        let s = hero.stats
        let dps = GustK.whirlDps * (s.damage / HeroK.damage) * s.gustDmgMult
        dmgSrc = .sig
        for w in whirls {
            for e in enemies {
                if e.hp <= 0 || e.state == .spawn || e.boss != nil { continue }
                let dx = w.pos.x - e.pos.x
                let dy = w.pos.y - e.pos.y
                let d = DMath.hypot(dx, dy)
                if d > w.r + e.radius { continue }
                damageEnemy(e, dps * dt, onHit: false, crit: false)
                if d > 8 && e.state != .charge {
                    arena.moveCircle(&e.pos, (dx / d) * GustK.whirlPull * dt, (dy / d) * GustK.whirlPull * dt, e.radius, flying: e.flying)
                }
            }
        }
        dmgSrc = .other
        let now = t
        whirls.removeAll { !($0.endAt > now) }
    }

    // MARK: Sorcier de braise — traînée de braises (DECISIONS #74)

    /// Sème des braises en marchant ; les ennemis au sol qui les touchent brûlent.
    private func updateEmbers(_ dt: Double) {
        let h = hero
        let s = h.stats
        let life = EmberK.life * s.emberLife
        var drop = 0
        while drop < h.embers.count && t - h.embers[drop].t > life { drop += 1 }
        if drop > 0 { h.embers.removeFirst(drop) }
        if cleared {
            h.embers.removeAll()
            return
        }
        if h.moving {
            if let last = h.embers.last {
                if DMath.hypot(h.pos.x - last.x, h.pos.y - last.y) >= EmberK.spacing { h.embers.append(ThreadPoint(x: h.pos.x, y: h.pos.y, t: t)) }
            } else {
                h.embers.append(ThreadPoint(x: h.pos.x, y: h.pos.y, t: t))
            }
            if h.embers.count > EmberK.maxPoints { h.embers.removeFirst(h.embers.count - EmberK.maxPoints) }
        }
        let em = h.embers
        if em.isEmpty { return }
        let rad = EmberK.radius * s.emberWidth
        let dps = EmberK.dps * (s.damage / HeroK.damage) * s.emberDmgMult
        for e in enemies {
            if e.hp <= 0 || e.state == .spawn || e.flying { continue }
            let rs = rad + e.radius
            let rr = rs * rs
            // le point le plus récent est sous les pieds du sorcier : il ne brûle qu'une fois posé (0,15 s)
            var i = em.count - 1
            while i >= 0 {
                let p = em[i]
                i -= 1
                if t - p.t < 0.15 { continue }
                let ex = p.x - e.pos.x
                let ey = p.y - e.pos.y
                if ex * ex + ey * ey > rr { continue }
                e.emberT = EmberK.linger
                e.emberDps = DMath.max(e.emberDps, dps * (e.elite || e.boss != nil ? s.eliteMult : 1))
                if s.furnace { e.slowT = DMath.max(e.slowT, 0.3) }
                break
            }
        }
        if s.ashWard {
            for p in projectiles {
                if p.fromHero || p.dead { continue }
                var i = em.count - 1
                while i >= 0 {
                    let q = em[i]
                    i -= 1
                    let qx = q.x - p.pos.x
                    let qy = q.y - p.pos.y
                    let rp = rad + p.radius
                    if qx * qx + qy * qy < rp * rp {
                        p.dead = true
                        break
                    }
                }
            }
            projectiles.removeAll { $0.dead }
        }
    }

    public func revive() {
        hero.hp = DMath.round(hero.stats.maxHp * 0.5)
        hero.invuln = 2
        dead = false
        projectiles = projectiles.filter { $0.fromHero }
        hazards.removeAll()
    }
}

/// Tri stable (comme `Array.prototype.sort` de V8) avec un comparateur « différence ».
func stableSort<T>(_ a: inout [T], _ cmp: (T, T) -> Double) {
    if a.count < 2 { return }
    for i in 1..<a.count {
        let x = a[i]
        var j = i - 1
        while j >= 0 && cmp(a[j], x) > 0 {
            a[j + 1] = a[j]
            j -= 1
        }
        a[j + 1] = x
    }
}
