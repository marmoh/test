import SpriteKit
import UIKit

/// Marionnettes et objets du combat (port de `drawHero`, `drawEnemy`, `drawHazard`, `drawProjectile`,
/// `drawHeroBar` de `web/src/combat.ts`), à partir des atlas de personnages et de `VFX.atlas`.

@inline(__always) func scenePoint(_ x: Double, _ y: Double) -> CGPoint { CGPoint(x: x, y: K.arenaH - y) }

func easeOutBack(_ x: Double) -> Double {
    let c1 = 1.70158, c3 = c1 + 1
    return 1 + c3 * pow(x - 1, 3) + c1 * pow(x - 1, 2)
}

func easeOutCubic(_ x: Double) -> Double { 1 - pow(1 - x, 3) }

/// Images d'animation d'un personnage, avec l'origine 4 pt sous le centre.
@MainActor
struct PuppetFrames {
    let idle: [SKTexture], move: [SKTexture], windup: [SKTexture], charge: [SKTexture], death: [SKTexture]
    let breath: [SKTexture], aim: [SKTexture], cut: [SKTexture]
    let anchor: CGPoint

    init(_ name: String) {
        let b = TextureBank.shared
        idle = b.character(name, "idle")
        move = b.character(name, "move")
        windup = b.character(name, "windup")
        charge = b.character(name, "charge")
        death = b.character(name, "death")
        breath = b.character(name, "breath")
        aim = b.character(name, "aim")
        cut = b.character(name, "cut")
        let size = idle.first?.size().height ?? 76
        anchor = CGPoint(x: 0.5, y: 0.5 - 4 / max(1, size))
    }

    static func loop(_ f: [SKTexture], _ t: Double, _ period: Double) -> SKTexture? {
        guard !f.isEmpty else { return nil }
        let u = (t / period).truncatingRemainder(dividingBy: 1)
        return f[min(f.count - 1, Int((u < 0 ? u + 1 : u) * Double(f.count)))]
    }

    static func progress(_ f: [SKTexture], _ k: Double) -> SKTexture? {
        guard !f.isEmpty else { return nil }
        return f[min(f.count - 1, max(0, Int((k * Double(f.count - 1)).rounded())))]
    }
}

// MARK: - héroïne

@MainActor
final class HeroNode: SKNode {
    private let frames: PuppetFrames
    let sprite = SKSpriteNode()
    private let halo = SKShapeNode(ellipseOf: CGSize(width: 44, height: 18))
    private let orb = SKShapeNode(circleOfRadius: 7)
    private let shield = SKSpriteNode()
    private var shieldFrames: [SKTexture] = []
    private let flashDisc = SKShapeNode(circleOfRadius: 24)
    private let crown = SKSpriteNode()
    private let barBg = SKSpriteNode(color: Ink.ink, size: CGSize(width: 44, height: 8))
    private let barFill = SKSpriteNode(color: Ink.jade, size: CGSize(width: 40, height: 4))
    private let barTicks = SKNode()
    private let barLabel = SKLabelNode()
    private var tickMax = -1.0
    private var lastHpText = ""

    init(heroId: HeroID, dragonSkin: Bool) {
        frames = PuppetFrames(heroId.rawValue)
        super.init()
        halo.strokeColor = Ink.jade.withAlphaComponent(0.5)
        halo.lineWidth = 2
        halo.position = CGPoint(x: 0, y: -12)
        halo.isHidden = true
        addChild(halo)
        flashDisc.fillColor = Ink.cut.withAlphaComponent(0.6)
        flashDisc.strokeColor = .clear
        flashDisc.isHidden = true
        addChild(flashDisc)
        sprite.anchorPoint = frames.anchor
        sprite.texture = frames.idle.first
        if let t = frames.idle.first { sprite.size = t.size() } else {
            sprite.texture = TextureBank.shared.dot
            sprite.color = Ink.jade
            sprite.colorBlendFactor = 1
            sprite.size = CGSize(width: 28, height: 28)
        }
        addChild(sprite)
        shieldFrames = TextureBank.shared.frames(TextureBank.shared.vfx, "shield_ring")
        if let f = shieldFrames.first { shield.texture = f; shield.size = f.size() }
        shield.position = CGPoint(x: 0, y: 2)
        shield.isHidden = true
        addChild(shield)
        orb.fillColor = Ink.jade
        orb.strokeColor = Ink.ink
        orb.lineWidth = 2
        orb.isHidden = true
        addChild(orb)
        // Parure du Dragon (abonnés) : couronne d'or au-dessus de la capuche
        if dragonSkin, let t = TextureBank.shared.icon("ui_crown") {
            crown.texture = t
            crown.size = CGSize(width: 18, height: 18)
            crown.color = Ink.gold
            crown.colorBlendFactor = 0.6
            crown.position = CGPoint(x: 0, y: 26)
            addChild(crown)
        }
        // barre de vie au-dessus de la tête (§12)
        barBg.anchorPoint = CGPoint(x: 0, y: 0.5)
        barBg.position = CGPoint(x: -22, y: 38)
        barFill.anchorPoint = CGPoint(x: 0, y: 0.5)
        barFill.position = CGPoint(x: -20, y: 38)
        barTicks.position = CGPoint(x: -20, y: 38)
        barLabel.fontName = "AlegreyaSans-Bold"
        barLabel.fontSize = 10
        barLabel.fontColor = Ink.ink
        barLabel.position = CGPoint(x: 0, y: 44)
        for n in [barBg, barFill, barTicks, barLabel] as [SKNode] {
            n.zPosition = 50
            addChild(n)
        }
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) indisponible") }

    func update(_ h: HeroState, hasTarget: Bool, touching: Bool, t: Double, hurt: Double) {
        let tex: SKTexture?
        if h.cutT > 0, !frames.cut.isEmpty {
            tex = PuppetFrames.progress(frames.cut, 1 - h.cutT)
        } else if h.moving {
            tex = PuppetFrames.loop(frames.move, t, 0.42)
        } else if hasTarget, !frames.aim.isEmpty {
            tex = PuppetFrames.loop(frames.aim, t, 0.2)
        } else {
            tex = PuppetFrames.loop(frames.idle, t, 2.6)
        }
        if let tex { sprite.texture = tex }
        sprite.xScale = cos(h.facing) < 0 ? -1 : 1
        // clignote pendant l'invulnérabilité
        sprite.alpha = h.invuln > 0 && Int(t * 12) % 2 == 0 ? 0.35 : 1
        sprite.color = Ink.ink
        sprite.colorBlendFactor = CGFloat(min(0.45, hurt * 0.45))
        halo.isHidden = !touching
        flashDisc.isHidden = h.flashT <= 0
        if h.stats.orb {
            orb.isHidden = false
            orb.position = CGPoint(x: cos(h.orbAngle) * 56, y: -sin(h.orbAngle) * 56)
        } else {
            orb.isHidden = true
        }
        shield.isHidden = !h.shieldReady || shieldFrames.isEmpty
        if !shield.isHidden { shield.texture = PuppetFrames.loop(shieldFrames, t, 1.57) }
        // barre de vie avec graduations tous les 100 PV
        let k = max(0, h.hp / h.stats.maxHp)
        barFill.size = CGSize(width: max(2, 40 * k), height: 4)
        barFill.color = k > 0.3 ? Ink.jade : Ink.danger
        if tickMax != h.stats.maxHp {
            tickMax = h.stats.maxHp
            barTicks.removeAllChildren()
            var v = 100.0
            while v < h.stats.maxHp && v / 100 < 60 {
                let tick = SKSpriteNode(color: Ink.ink, size: CGSize(width: 1, height: 4))
                tick.position = CGPoint(x: 40 * v / h.stats.maxHp, y: 0)
                barTicks.addChild(tick)
                v += 100
            }
        }
        let txt = "\(Int(max(0, h.hp).rounded(.up)))"
        if txt != lastHpText {
            lastHpText = txt
            barLabel.text = txt
        }
    }
}

// MARK: - ennemis

@MainActor
final class EnemyNode: SKNode {
    let id: Int
    private let frames: PuppetFrames
    let sprite = SKSpriteNode()
    private let outline = SKSpriteNode()
    private let spawnRing = SKShapeNode()
    private let frost = SKShapeNode()
    private let barBg = SKSpriteNode(color: Ink.ink, size: CGSize(width: 10, height: 5))
    private let barFill = SKSpriteNode(color: Ink.cut, size: CGSize(width: 10, height: 3))
    private var burns: [SKSpriteNode] = []
    private var poisons: [SKShapeNode] = []
    private var windupMax: Double?
    private var releaseAt: Double?
    var flash = 0.0
    private let phase: Double
    private let isBoss: Bool
    private let radius: Double

    init(_ e: Enemy) {
        id = e.id
        isBoss = e.boss != nil
        radius = e.radius
        frames = PuppetFrames(e.boss?.archetype.rawValue ?? e.type.rawValue)
        phase = Double(e.id) * 0.37
        super.init()
        let size = frames.idle.first?.size() ?? CGSize(width: e.radius * 2, height: e.radius * 2)
        sprite.anchorPoint = frames.anchor
        sprite.size = size
        if let t = frames.idle.first { sprite.texture = t } else {
            sprite.texture = TextureBank.shared.dot
            sprite.color = Ink.ink
            sprite.colorBlendFactor = 1
        }
        // élites : contour doré (copie dorée légèrement plus grande, derrière)
        if e.elite {
            outline.anchorPoint = frames.anchor
            outline.size = CGSize(width: size.width * 1.12, height: size.height * 1.12)
            outline.color = Ink.gold
            outline.colorBlendFactor = 1
            outline.zPosition = -0.1
            addChild(outline)
        }
        if e.type == .jellySmall { sprite.setScale(1) }
        addChild(sprite)
        spawnRing.path = UIBezierPath(arcCenter: .zero, radius: e.radius * 1.4, startAngle: 0, endAngle: .pi * 2, clockwise: true).cgPath
            .copy(dashingWithPhase: 0, lengths: [6, 5])
        spawnRing.strokeColor = Ink.ink.withAlphaComponent(0.8)
        spawnRing.lineWidth = 2
        spawnRing.position = CGPoint(x: 0, y: -4)
        addChild(spawnRing)
        frost.path = CGPath(ellipseIn: CGRect(x: -e.radius * 1.3, y: -e.radius * 1.3, width: e.radius * 2.6, height: e.radius * 2.6), transform: nil)
        frost.strokeColor = Ink.frost.withAlphaComponent(0.9)
        frost.lineWidth = 2
        frost.isHidden = true
        addChild(frost)
        let w = e.radius * 1.8
        barBg.size = CGSize(width: w + 2, height: 5)
        barBg.anchorPoint = CGPoint(x: 0, y: 0.5)
        barBg.position = CGPoint(x: -w / 2 - 1, y: e.radius + 10)
        barFill.anchorPoint = CGPoint(x: 0, y: 0.5)
        barFill.position = CGPoint(x: -w / 2, y: e.radius + 10)
        barFill.color = e.elite ? Ink.gold : Ink.cut
        barBg.zPosition = 40
        barFill.zPosition = 41
        barBg.isHidden = true
        barFill.isHidden = true
        addChild(barBg)
        addChild(barFill)
        for i in 0..<3 {
            let f = SKSpriteNode(texture: TextureBank.shared.flame)
            f.position = CGPoint(x: -8 + Double(i) * 8, y: e.radius + 2)
            f.isHidden = true
            addChild(f)
            burns.append(f)
        }
        for i in 0..<5 {
            let d = SKShapeNode(circleOfRadius: 2)
            d.fillColor = Ink.poison
            d.strokeColor = Ink.ink
            d.lineWidth = 1
            d.position = CGPoint(x: -8 + Double(i) * 4, y: e.radius + 6)
            d.isHidden = true
            addChild(d)
            poisons.append(d)
        }
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) indisponible") }

    func update(_ e: Enemy, hero: Vec, t: Double, dt: Double, time: Double) {
        var tex: SKTexture?
        var scale = 1.0
        var alpha = 1.0
        spawnRing.isHidden = e.state != .spawn
        if e.state == .spawn {
            // cercle d'invocation puis apparition élastique
            let k = 1 - max(0, e.t) / (isBoss ? 1.2 : 0.8)
            spawnRing.zRotation = CGFloat(-t * 2)
            spawnRing.alpha = CGFloat(1 - k * 0.5)
            scale = max(0.01, easeOutBack(min(1, k * 1.25)))
            alpha = min(1, k * 2)
            tex = PuppetFrames.loop(frames.idle, t + phase, 2.6)
        } else if e.state == .windup || (e.elite && e.eliteWind > 0) {
            let left = e.state == .windup ? e.t : e.eliteWind
            if windupMax == nil { windupMax = max(0.3, left + K.simDT) }
            let k = 1 - left / (windupMax ?? 1)
            tex = PuppetFrames.progress(frames.windup, k) ?? PuppetFrames.loop(frames.idle, t + phase, 2.6)
        } else {
            if windupMax != nil {
                windupMax = nil
                releaseAt = time
            }
            if let b = e.boss, b.breath > 0, !frames.breath.isEmpty {
                tex = PuppetFrames.loop(frames.breath, t + phase, 1.6)
            } else if e.state == .charge {
                tex = PuppetFrames.loop(frames.charge.isEmpty ? frames.move : frames.charge, t, 0.25)
            } else if e.state == .move && e.speed > 0 {
                tex = PuppetFrames.loop(frames.move, t + phase, 0.42)
            } else {
                tex = PuppetFrames.loop(frames.idle, t + phase, 2.6)
            }
        }
        if let tex {
            sprite.texture = tex
            if !outline.isHidden, outline.parent != nil { outline.texture = tex }
        }
        let facing = e.state == .charge ? atan2(e.aim.y, e.aim.x) : atan2(hero.y - e.pos.y, hero.x - e.pos.x)
        let flip: CGFloat = cos(facing) < 0 ? -1 : 1
        // recul au coup porté (fin d'anticipation)
        var kick = 0.0
        if let r = releaseAt {
            kick = max(0, 1 - (time - r) / 0.25)
            if kick == 0 { releaseAt = nil }
        }
        sprite.xScale = flip * CGFloat(scale * (1 + 0.08 * kick))
        sprite.yScale = CGFloat(scale * (1 - 0.05 * kick))
        outline.xScale = sprite.xScale * 1.12
        outline.yScale = sprite.yScale * 1.12
        sprite.alpha = CGFloat(alpha)
        outline.alpha = CGFloat(alpha)
        // la marionnette s'éclaire au coup reçu
        if flash > 0 { flash = max(0, flash - dt * 6) }
        sprite.color = Ink.cut
        sprite.colorBlendFactor = CGFloat(flash * 0.85)
        frost.isHidden = e.slowT <= 0
        for (i, f) in burns.enumerated() {
            f.isHidden = e.burnT <= 0
            if !f.isHidden { f.yScale = CGFloat(0.8 + 0.25 * sin(t * 14 + Double(i) * 2)) }
        }
        for (i, d) in poisons.enumerated() {
            d.isHidden = i >= e.poisonStacks
            if !d.isHidden { d.position.y = CGFloat(radius + 6 + sin(t * 5 + Double(i)) * 2) }
        }
        // mini-barre de vie des ennemis blessés
        let hurt = !isBoss && e.hp < e.maxHp && e.state != .spawn
        barBg.isHidden = !hurt
        barFill.isHidden = !hurt
        if hurt { barFill.size = CGSize(width: radius * 1.8 * max(0, e.hp / e.maxHp), height: 3) }
    }
}

/// Marionnette vaincue qui se démonte (images `death`, 0,5 s).
@MainActor
final class CorpseNode: SKSpriteNode {
    let t0: Double
    private let deathFrames: [SKTexture]

    init(_ e: Enemy, t0: Double, flip: Bool) {
        self.t0 = t0
        let f = PuppetFrames(e.boss?.archetype.rawValue ?? e.type.rawValue)
        deathFrames = f.death
        let tex = f.death.first ?? f.idle.first
        super.init(texture: tex, color: .clear, size: tex?.size() ?? .zero)
        anchorPoint = f.anchor
        xScale = flip ? -1 : 1
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) indisponible") }

    /// Faux quand l'animation est terminée.
    func update(time: Double) -> Bool {
        let k = (time - t0) / 0.5
        if let tex = PuppetFrames.progress(deathFrames, min(1, k)) { texture = tex } else { alpha = CGFloat(max(0, 1 - k)) }
        return time - t0 < 0.55
    }
}

// MARK: - télégraphes et zones

@MainActor
final class HazardNode: SKNode {
    private let sprite = SKSpriteNode()
    private let fallback = SKShapeNode()
    private let circleFrames: [SKTexture]
    private let lineFrames: [SKTexture]
    private let fireFrames: [SKTexture]
    var impacted = false

    override init() {
        let b = TextureBank.shared
        circleFrames = b.frames(b.vfx, "telegraph_circle")
        lineFrames = b.frames(b.vfx, "telegraph_line")
        fireFrames = b.frames(b.vfx, "hazard_fire")
        super.init()
        addChild(sprite)
        fallback.isHidden = true
        addChild(fallback)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) indisponible") }

    /// Renvoie vrai à l'instant de l'impact d'une zone brève (onde de choc, pluie) — la scène joue l'effet.
    func update(_ z: Hazard, now: Double, t: Double) -> Bool {
        position = scenePoint(z.pos.x, z.pos.y)
        if let to = z.to {
            // charge télégraphiée : bande hachurée qui se remplit, flèches découpées qui avancent
            if now > z.activeAt {
                isHidden = true
                return false
            }
            isHidden = false
            let k = min(1, (now - z.born) / max(0.01, z.activeAt - z.born))
            let dx = to.x - z.pos.x, dy = to.y - z.pos.y
            let len = max(1, DMath.hypot(dx, dy))
            zRotation = CGFloat(-atan2(dy, dx))
            if let tex = PuppetFrames.progress(lineFrames, k) {
                sprite.texture = tex
                sprite.size = CGSize(width: 176, height: 36)
                sprite.anchorPoint = CGPoint(x: 8.0 / 176.0, y: 0.5)
                sprite.centerRect = CGRect(x: 0.15, y: 0, width: 0.7, height: 1)
                sprite.xScale = CGFloat(len / 160)
                sprite.yScale = CGFloat(z.radius * 2 / 28)
                fallback.isHidden = true
            } else {
                sprite.isHidden = true
                fallback.isHidden = false
                fallback.path = CGPath(roundedRect: CGRect(x: 0, y: -z.radius, width: len, height: z.radius * 2), cornerWidth: z.radius, cornerHeight: z.radius, transform: nil)
                fallback.strokeColor = Ink.danger
                fallback.fillColor = Ink.danger.withAlphaComponent(CGFloat(0.25 + 0.6 * k))
            }
            return false
        }
        isHidden = false
        zRotation = 0
        let scale = CGFloat(z.radius / 44)
        if now < z.activeAt {
            // le disque plein se referme vers le centre jusqu'à l'impact
            let k = min(1, (now - z.born) / max(0.01, z.activeAt - z.born))
            if let tex = PuppetFrames.progress(circleFrames, k) {
                sprite.texture = tex
                sprite.size = tex.size()
                sprite.anchorPoint = CGPoint(x: 0.5, y: 0.5)
                sprite.setScale(scale)
                sprite.alpha = 1
            } else {
                showFallbackCircle(z.radius, fill: Ink.danger.withAlphaComponent(CGFloat(0.2 + 0.6 * k)))
            }
            return false
        }
        let lasting = z.endAt - z.activeAt > 0.5
        if !lasting {
            sprite.isHidden = true
            fallback.isHidden = true
            let k = (now - z.activeAt) / max(0.01, z.endAt - z.activeAt)
            if k < 0.2 && !impacted {
                impacted = true
                return true
            }
            return false
        }
        // zone persistante : fond vermillon hachuré, flammes d'encre qui dansent
        let fade = CGFloat(min(1, (z.endAt - now) * 2))
        if let tex = PuppetFrames.loop(fireFrames, t, 0.6) {
            sprite.isHidden = false
            sprite.texture = tex
            sprite.size = tex.size()
            sprite.anchorPoint = CGPoint(x: 0.5, y: 0.5)
            sprite.setScale(scale)
            sprite.alpha = fade
        } else {
            showFallbackCircle(z.radius, fill: Ink.danger.withAlphaComponent(0.35 * fade))
        }
        return false
    }

    private func showFallbackCircle(_ r: Double, fill: UIColor) {
        sprite.isHidden = true
        fallback.isHidden = false
        fallback.path = CGPath(ellipseIn: CGRect(x: -r, y: -r, width: 2 * r, height: 2 * r), transform: nil)
        fallback.fillColor = fill
        fallback.strokeColor = Ink.danger
        fallback.lineWidth = 2.5
    }
}

// MARK: - projectiles

@MainActor
final class ProjectileLayer: SKNode {
    private var live: [ObjectIdentifier: SKSpriteNode] = [:]
    private var pool: [SKSpriteNode] = []
    private let heroTexture: SKTexture
    private let bank = TextureBank.shared

    init(heroId: HeroID) {
        switch heroId {
        case .scout: heroTexture = TextureBank.shared.needle
        case .windMonk: heroTexture = TextureBank.shared.gust
        case .emberSorcerer: heroTexture = TextureBank.shared.ember
        }
        super.init()
        zPosition = 300
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) indisponible") }

    func update(_ projectiles: [Projectile], position: (Projectile) -> Vec) {
        var seen = Set<ObjectIdentifier>()
        for p in projectiles {
            let id = ObjectIdentifier(p)
            seen.insert(id)
            let node: SKSpriteNode
            if let n = live[id] {
                node = n
            } else {
                node = pool.popLast() ?? SKSpriteNode()
                if node.parent == nil { addChild(node) }
                node.isHidden = false
                configure(node, p)
                live[id] = node
            }
            let q = position(p)
            node.position = scenePoint(q.x, q.y)
            node.zRotation = CGFloat(-atan2(p.vel.y, p.vel.x))
        }
        for (id, n) in live where !seen.contains(id) {
            n.isHidden = true
            pool.append(n)
            live[id] = nil
        }
    }

    private func configure(_ n: SKSpriteNode, _ p: Projectile) {
        let tex: SKTexture
        var anchor = CGPoint(x: 0.5, y: 0.5)
        if p.fromHero {
            tex = heroTexture
            anchor = CGPoint(x: heroTexture.size().width > 32 ? 26.0 / 36.0 : 0.66, y: 0.5)
        } else {
            let sp = DMath.hypot(p.vel.x, p.vel.y)
            if Swift.abs(sp - 340) < 2 {
                tex = bank.arrow
                anchor = CGPoint(x: 16.0 / 26.0, y: 0.5)
            } else {
                let mark: TextureBank.OrbMark = Swift.abs(sp - 150) < 2 ? .spore : Swift.abs(sp - 170) < 2 ? .rune : Swift.abs(sp - 140) < 2 ? .elite : .plain
                tex = bank.enemyOrb(radius: CGFloat(p.radius), mark: mark)
                anchor = CGPoint(x: 0.5, y: 0.5)
            }
        }
        n.texture = tex
        n.size = tex.size()
        n.anchorPoint = anchor
        n.colorBlendFactor = 0
        n.alpha = 1
    }

    func clear() {
        for (_, n) in live {
            n.isHidden = true
            pool.append(n)
        }
        live.removeAll()
    }
}
