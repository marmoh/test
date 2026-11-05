import SpriteKit
import UIKit

/// Écran de combat (§12.3) : la simulation Swift (`Core/`) à pas fixe de 1/30 s, rendue à 60 i/s avec
/// interpolation — port de la classe `Combat` de `web/src/combat.ts`.
/// Contrôles à un doigt (§2, ancre flottante invisible, halo sous l'héroïne), tir automatique par défaut,
/// fil de découpe et aperçu de la boucle, télégraphes, effets d'impact et de mort, secousses et arrêts sur image
/// (coupés par « Réduire les animations »), retours haptiques, barre de vie au-dessus de l'héroïne.
@MainActor
final class GameScene: SKScene {
    struct Config {
        var level: LevelDef
        var templates: [String: RoomTemplate]
        var mode: CombatMode
        var heroId: HeroID
        var talents: Talents
        var potion = false
        var aegis = false
        var scroll: PowerID?
        /// Parchemin équipé : le pouvoir est choisi juste avant d'entrer (`CombatSession.start`).
        var scrollPending = false
        var autoFire = true
        var reduceMotion = false
        var haptics = true
        var dragonSkin = false
        /// Apparence du pass de saison portée (cosmétique).
        var skin: SkinID?
        /// Graine de la tentative (aléas de combat), comme `Date.now() & 0xffff` du web.
        var attemptSalt = Int.random(in: 0...0xffff)
    }

    static let hudTop: CGFloat = 54

    let config: Config
    weak var hooks: CombatHooks?
    private weak var audio: AudioService?
    private weak var haptics: HapticsService?

    let hero: HeroState
    private(set) var world: World
    private var roomIdx = 0
    private var powerRng: Rng
    private var anchor = FloatingAnchor()
    private var touchIDs: [ObjectIdentifier: Int] = [:]
    private var nextTouchID = 1
    private let theme: KingdomTheme

    // nœuds
    private let backdrop = SKEffectNode()
    private let stage = SKNode()
    private var arenaNode: ArenaNode
    private let groundLayer = SKNode()
    private let entities = SKNode()
    private let threadNode = ThreadNode()
    private let heroNode: HeroNode
    private var enemyNodes: [Int: EnemyNode] = [:]
    private var hazardNodes: [ObjectIdentifier: HazardNode] = [:]
    private var corpses: [CorpseNode] = []
    private let projectileLayer: ProjectileLayer
    private var orbNodes: [SKSpriteNode] = []
    private let orbFrames: [SKTexture]
    private let fx = FX()
    private let overlay = SKNode()
    private let vignette = SKSpriteNode()
    private let deadVeil = SKSpriteNode(color: UIColor(hex: 0x1B1418, alpha: 0.5), size: .zero)
    private let iris = SKShapeNode()
    private let banner = BannerNode()
    private let bossBar = BossBarNode()

    // temps et état
    private var prev: [ObjectIdentifier: Vec] = [:]
    private var acc = 0.0
    private var last: TimeInterval = 0
    private var time = 0.0
    private var seconds = 0.0
    private var kills = 0
    private var continues = 0
    private var busy = false
    private var destroyed = false
    private var portalOpen = 0.0
    private var transition = 0.0
    private var dotAcc: [Int: Double] = [:]
    private var lastSnipText = -9.0
    private var scale: CGFloat = 1
    private var observers: [NSObjectProtocol] = []

    init(config: Config, audio: AudioService?, haptics: HapticsService?) {
        self.config = config
        self.audio = audio
        self.haptics = haptics
        theme = KingdomTheme.of(kingdom: config.level.kingdom)
        hero = LevelRunner.makeHero(talents: config.talents, heroId: config.heroId, autoFire: config.autoFire,
                                    potion: config.potion, aegis: config.aegis, scroll: config.scroll)
        powerRng = Rng(seed: config.level.powerSeed)
        let room = config.level.rooms[0]
        let tpl = config.templates[room.template] ?? config.templates.values.first!
        world = World(RoomSetup(arena: Arena(tpl), D: config.level.D, waves: room.waves, boss: room.boss,
                                seed: seedOf(room.seed, config.attemptSalt)), hero: hero)
        arenaNode = ArenaNode(template: tpl, kingdom: config.level.kingdom)
        heroNode = HeroNode(heroId: config.heroId, dragonSkin: config.dragonSkin, skin: config.skin)
        projectileLayer = ProjectileLayer(heroId: config.heroId)
        orbFrames = TextureBank.shared.frames(TextureBank.shared.vfx, "heal_orb")
        super.init(size: CGSize(width: 390, height: 844))
        scaleMode = .resizeFill
        anchorPoint = .zero
        backgroundColor = Ink.curtain
        fx.reduceMotion = config.reduceMotion || UIAccessibility.isReduceMotionEnabled
        fx.toScene = { scenePoint($0, $1) }
        build()
        startRoom(0)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) indisponible") }

    private var reduceMotion: Bool { fx.reduceMotion }

    // MARK: construction

    private func build() {
        backdrop.shouldRasterize = true
        backdrop.zPosition = -100
        addChild(backdrop)
        addChild(stage)
        stage.addChild(arenaNode)
        groundLayer.zPosition = 10
        stage.addChild(groundLayer)
        threadNode.zPosition = 20
        stage.addChild(threadNode)
        entities.zPosition = 100
        stage.addChild(entities)
        entities.addChild(heroNode)
        stage.addChild(projectileLayer)
        stage.addChild(fx.layer)
        overlay.zPosition = 1000
        addChild(overlay)
        vignette.texture = Self.vignetteTexture()
        vignette.alpha = 0
        overlay.addChild(vignette)
        deadVeil.isHidden = true
        overlay.addChild(deadVeil)
        overlay.addChild(bossBar)
        overlay.addChild(banner)
        iris.fillColor = Ink.ink
        iris.strokeColor = .clear
        iris.zPosition = 10
        overlay.addChild(iris)
    }

    override func didMove(to view: SKView) {
        view.isMultipleTouchEnabled = true
        layout()
        let nc = NotificationCenter.default
        observers.append(nc.addObserver(forName: UIApplication.willResignActiveNotification, object: nil, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.openPause() }
        })
    }

    override func willMove(from view: SKView) {
        for o in observers { NotificationCenter.default.removeObserver(o) }
        observers.removeAll()
    }

    override func didChangeSize(_ oldSize: CGSize) {
        super.didChangeSize(oldSize)
        layout()
    }

    private var insets: UIEdgeInsets { view?.safeAreaInsets ?? .zero }

    private func layout() {
        guard size.width > 0, size.height > 0 else { return }
        let w = size.width, h = size.height
        let top = insets.top + Self.hudTop
        let bottom = insets.bottom + 12
        let fullW = CGFloat(K.arenaW) + ArenaNode.wall * 2
        let fullH = CGFloat(K.arenaH) + ArenaNode.wall * 2
        scale = min(w / fullW, (h - top - bottom) / fullH)
        stage.setScale(scale)
        let ox = (w - CGFloat(K.arenaW) * scale) / 2
        let oy = bottom + ((h - top - bottom) - CGFloat(K.arenaH) * scale) / 2
        stage.position = CGPoint(x: ox, y: oy)
        stagePosition = stage.position
        vignette.size = size
        vignette.position = CGPoint(x: w / 2, y: h / 2)
        deadVeil.size = size
        deadVeil.position = vignette.position
        bossBar.position = CGPoint(x: w / 2, y: h - top + 6)
        bossBar.layoutWidth = min(320, w - 120)
        buildBackdrop()
    }

    private var stagePosition: CGPoint = .zero

    /// Rideaux du théâtre autour de l'écran (tuiles de `Stage.atlas`).
    private func buildBackdrop() {
        backdrop.removeAllChildren()
        let bank = TextureBank.shared
        if let c = bank.texture(bank.stage, "curtain_tile") {
            var y: CGFloat = 0
            while y < size.height {
                var x: CGFloat = 0
                while x < size.width {
                    let s = SKSpriteNode(texture: c)
                    s.anchorPoint = .zero
                    s.position = CGPoint(x: x, y: y)
                    backdrop.addChild(s)
                    x += c.size().width
                }
                y += c.size().height
            }
        }
        if let v = bank.texture(bank.stage, "valance_tile") {
            var x: CGFloat = 0
            while x < size.width {
                let s = SKSpriteNode(texture: v)
                s.anchorPoint = CGPoint(x: 0, y: 1)
                s.position = CGPoint(x: x, y: size.height)
                backdrop.addChild(s)
                x += v.size().width
            }
        }
        if let f = bank.texture(bank.stage, "footlights_tile") {
            var x: CGFloat = 0
            while x < size.width {
                let s = SKSpriteNode(texture: f)
                s.anchorPoint = .zero
                s.position = CGPoint(x: x, y: 0)
                backdrop.addChild(s)
                x += f.size().width
            }
        }
    }

    private static func vignetteTexture() -> SKTexture {
        let size = CGSize(width: 256, height: 256)
        let img = UIGraphicsImageRenderer(size: size).image { ctx in
            let colors = [UIColor(hex: 0x1B1418, alpha: 0).cgColor, UIColor(hex: 0x1B1418, alpha: 1).cgColor] as CFArray
            let g = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: [0, 1])!
            let c = CGPoint(x: 128, y: 128)
            ctx.cgContext.drawRadialGradient(g, startCenter: c, startRadius: 60, endCenter: c, endRadius: 182, options: [.drawsAfterEndLocation])
        }
        return SKTexture(image: img)
    }

    // MARK: salles

    private func startRoom(_ i: Int) {
        roomIdx = i
        let room = config.level.rooms[i]
        let tpl = config.templates[room.template] ?? config.templates.values.first!
        if i > 0 {
            world = World(RoomSetup(arena: Arena(tpl), D: config.level.D, waves: room.waves, boss: room.boss,
                                    seed: seedOf(room.seed, config.attemptSalt)), hero: hero)
            arenaNode.removeFromParent()
            arenaNode = ArenaNode(template: tpl, kingdom: config.level.kingdom)
            stage.insertChild(arenaNode, at: 0)
        }
        arenaNode.reduceMotion = reduceMotion
        for (_, n) in enemyNodes { n.removeFromParent() }
        enemyNodes.removeAll()
        for (_, n) in hazardNodes { n.removeFromParent() }
        hazardNodes.removeAll()
        for c in corpses { c.removeFromParent() }
        corpses.removeAll()
        projectileLayer.clear()
        threadNode.clearAll()
        prev.removeAll()
        dotAcc.removeAll()
        portalOpen = 0
        let isBoss = room.boss != nil
        banner.show(isBoss ? "Boss" : "Salle \(i + 1)", sub: isBoss ? Bosses.def(room.boss!.archetype).name : theme.name)
        transition = -1
        if isBoss { audio?.play(.boss) }
        hooks?.roomChanged(i)
    }

    private func nextRoom() async {
        busy = true
        let i = roomIdx + 1
        let offer = LevelGen.offerPowers(&powerRng, owned: hero.powers)
        let pick = await hooks?.choosePower(offer, hero: hero, room: i) ?? offer[0]
        if destroyed { return }
        hero.grant(pick)
        let heal = hero.stats.maxHp * K.healBetweenRooms
        hero.hp = min(hero.stats.maxHp, hero.hp + heal)
        startRoom(i)
        fx.text(hero.pos.x, hero.pos.y - 40, "+\(Int(heal.rounded()))", color: Ink.jade, size: 16)
        fx.vfx("heal_burst", hero.pos.x, hero.pos.y, duration: 0.8)
        busy = false
        last = 0
    }

    private func finishWin() {
        busy = true
        let hpFrac = max(0, hero.hp) / hero.stats.maxHp
        fx.slowmo = 1.2
        audio?.play(.win)
        let r = CombatResult(won: true, stars: Formulas.stars(won: true, hpFrac: hpFrac), hpFrac: hpFrac, hpLeft: max(0, hero.hp),
                             seconds: seconds, kills: kills + world.kills, continues: continues, maxHp: hero.stats.maxHp)
        Task { @MainActor [weak self] in
            try? await Task.sleep(for: .seconds(1.3))
            guard let self, !self.destroyed else { return }
            if self.config.mode.isTournament { self.hooks?.tournamentOver(r) } else { self.hooks?.finish(r) }
        }
    }

    private func onDeath() async {
        busy = true
        audio?.play(.lose)
        try? await Task.sleep(for: .seconds(0.9))
        if destroyed { return }
        if config.mode.isTournament {
            // tournoi : pas de « continuer », l'essai s'arrête
            hooks?.tournamentOver(CombatResult(won: false, stars: 0, hpFrac: 0, hpLeft: 0, seconds: seconds,
                                               kills: kills + world.kills, continues: continues, maxHp: hero.stats.maxHp))
            return
        }
        let choice = await hooks?.defeat(continuesUsed: continues) ?? .map
        if destroyed { return }
        switch choice {
        case .revive:
            continues += 1
            world.revive()
            fx.ring(hero.pos.x, hero.pos.y, color: Ink.jade, size: 140, life: 0.6)
            fx.scraps(hero.pos.x, hero.pos.y, 14)
            busy = false
            last = 0
        case .retry:
            hooks?.retry()
        case .map:
            hooks?.quit()
        }
    }

    func openPause() {
        guard !busy, !destroyed else { return }
        busy = true
        anchor.reset()
        Task { @MainActor [weak self] in
            guard let self else { return }
            let r = await self.hooks?.pause() ?? .resume
            if self.destroyed { return }
            if r == .quit { self.hooks?.quit(); return }
            self.busy = false
            self.last = 0
        }
    }

    func destroy() {
        destroyed = true
        isPaused = true
        removeAllActions()
        removeAllChildren()
    }

    /// Chiffres de la tentative en cours (score de tournoi).
    var liveStats: (kills: Int, seconds: Double, maxHp: Double) { (kills + world.kills, seconds, hero.stats.maxHp) }

    // MARK: entrée (§2)

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        for t in touches {
            let id = nextTouchID
            nextTouchID += 1
            touchIDs[ObjectIdentifier(t)] = id
            let p = t.location(in: view)
            anchor.down(id, Vec(p.x, p.y))
        }
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        for t in touches {
            guard let id = touchIDs[ObjectIdentifier(t)] else { continue }
            let p = t.location(in: view)
            anchor.move(id, Vec(p.x, p.y))
        }
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        for t in touches {
            if let id = touchIDs.removeValue(forKey: ObjectIdentifier(t)) { anchor.up(id) }
        }
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
        touchesEnded(touches, with: event)
    }

    private func input() -> HeroInput {
        // la vue est mise à l'échelle : le vecteur est en points écran, comme la SPEC (pt)
        let v = anchor.intent()
        return HeroInput(mx: v.x, my: v.y, touching: anchor.touching)
    }

    // MARK: boucle

    override func update(_ currentTime: TimeInterval) {
        if destroyed { return }
        var dt = last == 0 ? 1.0 / 60.0 : min(0.1, currentTime - last)
        last = currentTime
        time += dt
        if fx.slowmo > 0 { dt *= 0.35 }
        fx.update(dt)
        banner.advance(dt)
        if transition != 0 { transition = min(0, transition + dt * 2.2) }

        if !busy {
            if fx.freeze > 0 {
                fx.freeze -= dt
            } else {
                acc += dt
                var steps = 0
                while acc >= K.simDT && steps < 4 {
                    stepSim()
                    acc -= K.simDT
                    steps += 1
                    if busy { break }
                }
                if steps == 4 { acc = min(acc, K.simDT) }
            }
        }
        render(alpha: min(1, acc / K.simDT), dt: dt)
    }

    private func stepSim() {
        let w = world
        prev[ObjectIdentifier(w.hero)] = w.hero.pos
        for e in w.enemies { prev[ObjectIdentifier(e)] = e.pos }
        for p in w.projectiles { prev[ObjectIdentifier(p)] = p.pos }
        let beforeProj = w.projectiles
        var hpBefore: [Int: Double] = [:]
        for e in w.enemies { hpBefore[e.id] = e.hp }
        let before = w.enemies
        w.step(input())
        // les marionnettes vaincues restent ~0,5 s pour se démonter à l'écran
        let alive = Set(w.enemies.map { ObjectIdentifier($0) })
        for e in before where !alive.contains(ObjectIdentifier(e)) {
            let flip = cos(atan2(w.hero.pos.y - e.pos.y, w.hero.pos.x - e.pos.x)) < 0
            let c = CorpseNode(e, t0: time, flip: flip)
            c.position = scenePoint(e.pos.x, e.pos.y)
            c.zPosition = CGFloat(e.pos.y / 1000)
            entities.addChild(c)
            corpses.append(c)
            enemyNodes.removeValue(forKey: e.id)?.removeFromParent()
            prev[ObjectIdentifier(e)] = nil
        }
        seconds += K.simDT
        react(beforeProj, hpBefore)
        if w.dead {
            fx.hitStop(0.25)
            fx.shake(1)
            fx.scraps(w.hero.pos.x, w.hero.pos.y, 24, power: 1.3)
            haptics?.heavy()
            Task { @MainActor [weak self] in await self?.onDeath() }
            return
        }
        let lastRoom = roomIdx == config.level.rooms.count - 1
        if w.cleared && lastRoom { return finishWin() }
        if w.exited {
            kills += w.kills
            Task { @MainActor [weak self] in await self?.nextRoom() }
        }
    }

    /// Traduit les évènements de la simulation en effets visuels, sonores et haptiques.
    private func react(_ beforeProj: [Projectile], _ hpBefore: [Int: Double]) {
        let w = world
        var hits: [(x: Double, y: Double, crit: Bool)] = []
        for ev in w.events {
            switch ev {
            case let .hit(x, y, crit):
                hits.append((x, y, crit))
            case .shoot:
                audio?.play(.shoot)
            case let .kill(x, y, type):
                let big = type == "boss"
                fx.scraps(x, y, big ? 34 : 10, power: big ? 1.6 : 1)
                fx.ring(x, y, color: Ink.ink, size: big ? 140 : 30, life: big ? 0.7 : 0.3)
                fx.shake(big ? 0.9 : 0.12)
                if big {
                    fx.hitStop(0.35)
                    fx.slowmo = 1.5
                    haptics?.heavy()
                }
                audio?.play(big ? .bossDown : .kill)
            case let .heroHit(dmg, _):
                fx.heroFlash = 1
                fx.shake(0.45)
                fx.hitStop(0.05)
                fx.text(w.hero.pos.x, w.hero.pos.y - 30, "-\(Int(dmg.rounded()))", color: Ink.danger, size: 17)
                fx.burst(w.hero.pos.x, w.hero.pos.y, color: Ink.danger, 10, speed: 160, kind: .spark, size: 2.5, life: 0.35)
                if config.haptics { haptics?.hurt() }
                audio?.play(.hurt)
            case .dodge:
                fx.text(w.hero.pos.x, w.hero.pos.y - 30, "Esquive", color: Ink.ink, size: 14)
            case .shield:
                fx.ring(w.hero.pos.x, w.hero.pos.y, color: Ink.jade, size: 40, life: 0.4)
                fx.text(w.hero.pos.x, w.hero.pos.y - 30, "Bloqué", color: Ink.jade, size: 14)
            case let .wave(index):
                if index > 0 { banner.show("Vague \(index + 1)", sub: "", startAt: 0.25) }
            case let .cut(poly, n, echo):
                threadNode.addCut(poly: poly, echo: echo, t: time, paper: theme.paper)
                var cx = 0.0, cy = 0.0
                for v in poly { cx += v.x; cy += v.y }
                cx /= Double(max(1, poly.count))
                cy /= Double(max(1, poly.count))
                if n > 0 {
                    fx.text(cx, cy - 8, echo ? "Écho" : n > 1 ? "Découpe ×\(n)" : "Découpe", color: n > 1 ? Ink.danger : Ink.ink, size: n > 1 ? 22 : 18)
                    fx.shake(min(0.6, 0.15 + 0.12 * Double(n)))
                    fx.hitStop(min(0.12, 0.03 * Double(n)))
                }
                fx.scraps(cx, cy, 6 + n * 4)
                if hero.stats.confetti && n > 0 { fx.vfx("confetti", cx, cy, duration: 0.7) }
                if config.haptics { haptics?.cut(multi: n > 1) }
                audio?.play(echo ? .snip : .cut)
            case let .snip(x, y, by):
                fx.vfx("snip_spark", x, y, duration: 0.3)
                fx.burst(x, y, color: Ink.ink, 5, speed: 90, kind: .spark, size: 1.8, life: 0.3)
                if time - lastSnipText > 1.2 {
                    fx.text(x, y - 12, by == "moth" ? "Fil grignoté" : "Fil coupé", color: Ink.ink2, size: 12)
                    lastSnipText = time
                }
                audio?.play(.snip)
            case .cleared:
                fx.text(K.arenaW / 2, K.arenaH * 0.42, "Salle nettoyée", color: Ink.ink, size: 22)
                fx.scraps(K.arenaW / 2, 14, 14)
                audio?.play(.clear)
            }
        }
        // nombres de dégâts et flash d'impact
        for e in w.enemies {
            guard let before = hpBefore[e.id] else { continue }
            let d = before - e.hp
            if d <= 0 { continue }
            if let hit = hits.first(where: { Swift.abs($0.x - e.pos.x) < 1 && Swift.abs($0.y - e.pos.y) < 1 }) {
                enemyNodes[e.id]?.flash = 1
                fx.text(e.pos.x + (fx.rand() - 0.5) * 12, e.pos.y - e.radius - 8, "\(Int(d.rounded()))", color: hit.crit ? Ink.danger : Ink.ink, size: hit.crit ? 20 : 14)
                fx.vfx(hit.crit ? "impact_crit" : "impact", e.pos.x, e.pos.y, duration: hit.crit ? 0.24 : 0.18)
                if hit.crit { fx.shake(0.12) }
                audio?.play(.hit)
            } else {
                let a = (dotAcc[e.id] ?? 0) + d
                if a > 25 {
                    fx.text(e.pos.x, e.pos.y - e.radius - 4, "\(Int(a.rounded()))", color: Ink.ink2, size: 11)
                    dotAcc[e.id] = 0
                } else {
                    dotAcc[e.id] = a
                }
            }
        }
        // aiguilles qui heurtent un mur : petite poussière
        let alive = Set(w.projectiles.map { ObjectIdentifier($0) })
        for p in beforeProj where p.fromHero && !alive.contains(ObjectIdentifier(p)) {
            if !w.enemies.contains(where: { DMath.hypot($0.pos.x - p.pos.x, $0.pos.y - p.pos.y) < $0.radius + 14 }) {
                fx.burst(p.pos.x, p.pos.y, color: Ink.ink2, 3, speed: 80, size: 1.6, life: 0.25)
            }
            prev[ObjectIdentifier(p)] = nil
        }
    }

    // MARK: rendu

    private func lerp(_ key: AnyObject, _ pos: Vec, _ a: Double) -> Vec {
        guard let p = prev[ObjectIdentifier(key)] else { return pos }
        return Vec(p.x + (pos.x - p.x) * a, p.y + (pos.y - p.y) * a)
    }

    private func render(alpha a: Double, dt: Double) {
        let w = world
        let t = time
        let shake = fx.shakeOffset(t)
        stage.position = CGPoint(x: stagePosition.x + shake.x, y: stagePosition.y - shake.y)

        if w.cleared { portalOpen = min(1, portalOpen + dt * 2) }
        arenaNode.update(t: t, open: easeOutBack(portalOpen), guideOn: w.cleared && !w.exited)

        // zones et télégraphes
        var seenZ = Set<ObjectIdentifier>()
        for z in w.hazards {
            let id = ObjectIdentifier(z)
            seenZ.insert(id)
            let node: HazardNode
            if let n = hazardNodes[id] { node = n } else {
                node = HazardNode()
                groundLayer.addChild(node)
                hazardNodes[id] = node
            }
            if node.update(z, now: w.t, t: t) {
                fx.ring(z.pos.x, z.pos.y, color: Ink.ink, size: z.radius * 1.1, life: 0.4)
                fx.scraps(z.pos.x, z.pos.y, 8, power: 0.8)
                fx.shake(z.radius > 90 ? 0.4 : 0.15)
            }
        }
        for (id, n) in hazardNodes where !seenZ.contains(id) {
            n.removeFromParent()
            hazardNodes[id] = nil
        }

        // orbes de soin
        while orbNodes.count < w.orbs.count {
            let n = SKSpriteNode(texture: orbFrames.first ?? TextureBank.shared.heart)
            groundLayer.addChild(n)
            orbNodes.append(n)
        }
        for (i, n) in orbNodes.enumerated() {
            if i < w.orbs.count {
                let o = w.orbs[i]
                n.isHidden = false
                n.position = scenePoint(o.pos.x, o.pos.y + sin(t * 4 + o.pos.x) * 3)
                if let f = PuppetFrames.loop(orbFrames, t, 1.57) { n.texture = f }
            } else {
                n.isHidden = true
            }
        }

        // fil, découpes, aide au premier niveau
        let hp = lerp(w.hero, w.hero.pos, a)
        threadNode.updateCuts(t: t)
        threadNode.update(world: w, hp: hp, t: t,
                          showHint: config.level.n <= 3 && !config.mode.isTournament && w.hero.cuts == 0 && !w.cleared && !w.enemies.isEmpty)

        // héroïne
        heroNode.position = scenePoint(hp.x, hp.y)
        heroNode.zPosition = CGFloat(hp.y / 1000)
        heroNode.update(w.hero, hasTarget: w.target != nil, touching: anchor.touching, t: t, hurt: fx.heroFlash)

        // ennemis
        for e in w.enemies {
            let node: EnemyNode
            if let n = enemyNodes[e.id] { node = n } else {
                node = EnemyNode(e)
                entities.addChild(node)
                enemyNodes[e.id] = node
            }
            let q = lerp(e, e.pos, a)
            node.position = scenePoint(q.x, q.y)
            node.zPosition = CGFloat(q.y / 1000)
            node.update(e, hero: w.hero.pos, t: t, dt: dt, time: time)
        }
        corpses.removeAll { c in
            if c.update(time: time) { return false }
            c.removeFromParent()
            return true
        }

        projectileLayer.update(w.projectiles) { p in self.lerp(p, p.pos, a) }

        // barre du boss, voile de coup reçu, défaite, bannière, iris d'ouverture
        if let boss = w.enemies.first(where: { $0.boss != nil }) {
            bossBar.isHidden = false
            bossBar.update(frac: boss.hp / boss.maxHp)
        } else {
            bossBar.isHidden = true
            bossBar.reset()
        }
        vignette.alpha = CGFloat(0.6 * fx.heroFlash)
        deadVeil.isHidden = !w.dead
        banner.layout(in: size, topInset: insets.top)
        if transition < 0 {
            iris.isHidden = false
            let k = 1 + transition
            let r = max(1, hypot(size.width, size.height) * CGFloat(easeOutCubic(k)))
            let center = CGPoint(x: stage.position.x + CGFloat(hp.x) * scale, y: stage.position.y + CGFloat(K.arenaH - hp.y) * scale)
            let path = CGMutablePath()
            path.move(to: .zero)
            path.addLine(to: CGPoint(x: 0, y: size.height))
            path.addLine(to: CGPoint(x: size.width, y: size.height))
            path.addLine(to: CGPoint(x: size.width, y: 0))
            path.closeSubpath()
            path.addArc(center: center, radius: r, startAngle: 0, endAngle: .pi * 2, clockwise: false)
            iris.path = path
        } else {
            iris.isHidden = true
        }
    }
}

// MARK: - bannière et barre du boss

/// Étiquette de papier qui descend au bout de deux fils, puis remonte (« Salle 2 », « Boss », « Vague 2 »).
@MainActor
final class BannerNode: SKNode {
    private let threads = SKShapeNode()
    private let shadow = SKSpriteNode(color: Ink.ink, size: .zero)
    private let paper = SKSpriteNode(color: Ink.paper, size: .zero)
    private let border = SKShapeNode()
    private let title = SKLabelNode()
    private let sub = SKLabelNode()
    private var t = 0.0
    private var active = false
    private var hasSub = false
    private static let duration = 1.8

    override init() {
        super.init()
        isHidden = true
        threads.strokeColor = Ink.ink
        threads.lineWidth = 1.5
        border.strokeColor = Ink.ink
        border.lineWidth = 2
        border.fillColor = .clear
        title.fontName = "IMFellEnglishSC-Regular"
        title.fontSize = 30
        title.fontColor = Ink.ink
        title.verticalAlignmentMode = .baseline
        sub.fontName = "AlegreyaSans-MediumItalic"
        sub.fontSize = 14
        sub.fontColor = Ink.ink2
        for n in [threads, shadow, paper, border, title, sub] as [SKNode] { addChild(n) }
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) indisponible") }

    func show(_ text: String, sub s: String, startAt: Double = 0) {
        title.text = text
        sub.text = s
        hasSub = !s.isEmpty
        sub.isHidden = !hasSub
        t = startAt
        active = true
        isHidden = false
    }

    func advance(_ dt: Double) {
        guard active else { return }
        t += dt
        if t > Self.duration {
            active = false
            isHidden = true
        }
    }

    func layout(in size: CGSize, topInset: CGFloat) {
        guard active else { return }
        let inK = min(1, t / 0.4)
        let outK = max(0, (t - (Self.duration - 0.35)) / 0.35)
        let drop = easeOutBack(inK) * (1 - easeOutCubic(outK))
        let wv = min(size.width - 60, 280)
        let hv: CGFloat = hasSub ? 74 : 54
        // y mesuré depuis le haut, comme le web
        let yTop = -60 + CGFloat(drop) * (size.height * 0.34 + 60)
        position = CGPoint(x: size.width / 2, y: size.height - yTop)
        zRotation = CGFloat(-sin(t * 5) * 0.02 * (1 - inK * 0.5))
        let path = CGMutablePath()
        path.move(to: CGPoint(x: -wv / 2 + 20, y: size.height))
        path.addLine(to: CGPoint(x: -wv / 2 + 20, y: 0))
        path.move(to: CGPoint(x: wv / 2 - 20, y: size.height))
        path.addLine(to: CGPoint(x: wv / 2 - 20, y: 0))
        threads.path = path
        shadow.size = CGSize(width: wv, height: hv)
        shadow.anchorPoint = CGPoint(x: 0.5, y: 1)
        shadow.position = CGPoint(x: 4, y: -4)
        paper.size = CGSize(width: wv, height: hv)
        paper.anchorPoint = CGPoint(x: 0.5, y: 1)
        paper.position = .zero
        border.path = CGPath(rect: CGRect(x: -wv / 2 + 5, y: -hv + 5, width: wv - 10, height: hv - 10), transform: nil)
        title.position = CGPoint(x: 0, y: -37)
        sub.position = CGPoint(x: 0, y: -60)
    }
}

/// Barre de vie du boss, avec repères des phases (66 %, 33 %).
@MainActor
final class BossBarNode: SKNode {
    private let bg = SKSpriteNode(color: Ink.ink, size: .zero)
    private let track = SKSpriteNode(color: Ink.paperDark, size: .zero)
    private let fill = SKSpriteNode(color: Ink.danger, size: .zero)
    private let marks = [SKSpriteNode(color: Ink.ink, size: .zero), SKSpriteNode(color: Ink.ink, size: .zero)]
    private var shown = 0.0
    var layoutWidth: CGFloat = 320

    override init() {
        super.init()
        isHidden = true
        for n in [bg, track, fill] { n.anchorPoint = CGPoint(x: 0, y: 0.5); addChild(n) }
        for m in marks { addChild(m) }
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) indisponible") }

    func reset() { shown = 0 }

    func update(frac: Double) {
        shown = min(1, shown + 0.04)
        let w = layoutWidth
        let x = -w / 2
        bg.size = CGSize(width: w + 6, height: 12)
        bg.position = CGPoint(x: x - 3, y: 0)
        track.size = CGSize(width: w, height: 6)
        track.position = CGPoint(x: x, y: 0)
        fill.size = CGSize(width: w * CGFloat(max(0, frac)), height: 6)
        fill.position = CGPoint(x: x, y: 0)
        for (i, m) in marks.enumerated() {
            m.size = CGSize(width: 2, height: 10)
            m.position = CGPoint(x: x + w * CGFloat(i + 1) / 3, y: 0)
        }
        alpha = CGFloat(shown)
    }
}
