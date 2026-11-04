import SpriteKit
import UIKit

/// Décor d'une salle : écran de papier rétroéclairé, cadre de scène, obstacles du gabarit, porte.
/// Composition des atlas `Decor_<Royaume>` et `Stage` (ordre du README des atlas) ; repli dessiné si un atlas manque.
/// Repère : le nœud est en coordonnées de la simulation retournées (x → x, y → hauteur − y).
@MainActor
final class ArenaNode: SKNode {
    static let wall: CGFloat = 26
    private let theme: KingdomTheme
    private let grid: [[Character]]
    private let kingdom: Int
    private let bank = TextureBank.shared
    private let staticLayer = SKEffectNode()
    private var waves: [(node: SKSpriteNode, frames: [SKTexture], loop: Double)] = []
    private var tufts: [(node: SKSpriteNode, frames: [SKTexture], phase: Double)] = []
    private var hangs: [(node: SKSpriteNode, frames: [SKTexture], phase: Double)] = []
    private var drifts: [(node: SKSpriteNode, i: Int)] = []
    private var flames: [(node: SKSpriteNode, phase: Double)] = []
    private var flameFrames: [SKTexture] = []
    private let portal = SKSpriteNode()
    private var portalOpen: [SKTexture] = []
    private var portalLoop: [SKTexture] = []
    private let portalFallback = SKShapeNode(circleOfRadius: 18)
    private var guide: [SKShapeNode] = []
    var reduceMotion = false

    static let lampY: [Double] = [K.arenaH * 0.2, K.arenaH * 0.5, K.arenaH * 0.8]

    init(template: RoomTemplate, kingdom: Int) {
        theme = KingdomTheme.of(kingdom: kingdom)
        grid = template.grid.map { Array($0) }
        self.kingdom = kingdom
        super.init()
        staticLayer.shouldRasterize = true
        addChild(staticLayer)
        buildStatic()
        buildAnimated()
        buildPortal()
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) indisponible") }

    private func p(_ x: Double, _ y: Double) -> CGPoint { CGPoint(x: x, y: K.arenaH - y) }

    private func ch(_ c: Int, _ r: Int) -> Character? {
        guard r >= 0, r < grid.count, c >= 0, c < grid[r].count else { return nil }
        return grid[r][c]
    }

    private func isFree(_ ch: Character?) -> Bool { ch != nil && ch != "#" && ch != "~" && ch != "%" }

    // MARK: couches fixes (tramées une fois)

    private func buildStatic() {
        let decor = bank.decor(kingdom)
        let W = CGFloat(K.arenaW), H = CGFloat(K.arenaH)
        // lumière de l'écran, étirée
        if let light = bank.texture(decor, "floor_light") {
            let s = SKSpriteNode(texture: light, size: CGSize(width: W, height: H))
            s.position = CGPoint(x: W / 2, y: H / 2)
            staticLayer.addChild(s)
        } else {
            let s = SKSpriteNode(color: theme.light, size: CGSize(width: W, height: H))
            s.position = CGPoint(x: W / 2, y: H / 2)
            staticLayer.addChild(s)
        }
        // fibres du papier en mosaïque
        if let fib = bank.texture(bank.stage, "floor_fibres") {
            var y: CGFloat = 0
            while y < H {
                var x: CGFloat = 0
                while x < W {
                    let s = SKSpriteNode(texture: fib)
                    s.anchorPoint = CGPoint(x: 0, y: 1)
                    s.position = CGPoint(x: x, y: H - y)
                    staticLayer.addChild(s)
                    x += 132
                }
                y += 132
            }
        }
        if let hz = bank.texture(decor, "horizon") {
            let s = SKSpriteNode(texture: hz)
            s.anchorPoint = CGPoint(x: 0, y: 1)
            s.position = CGPoint(x: 0, y: H)
            staticLayer.addChild(s)
        }
        // découpes lointaines semées (règle `farSpot`)
        let far = bank.frames(decor, "far")
        for r in 0..<K.rows {
            for c in 0..<K.cols {
                let g = ch(c, r)
                guard isFree(g), g != "P", hashCell(c, r) >= 0.55, !far.isEmpty else { continue }
                let x = Double(c) * K.cell + 8 + hashCell(c, r, 1) * (K.cell - 16)
                let y = Double(r) * K.cell + 10 + hashCell(c, r, 2) * (K.cell - 16)
                let s = SKSpriteNode(texture: far[Int(hashCell(c, r, 3) * 4) % far.count])
                s.position = p(x, y - 2)
                if hashCell(c, r, 4) > 0.5 { s.xScale = -1 }
                staticLayer.addChild(s)
            }
        }
        // liquides (autotile N1 E2 S4 O8), puis haies et rochers
        let liquid = theme.liquidIsLava ? "lava" : "water"
        for r in 0..<K.rows {
            for c in 0..<K.cols where ch(c, r) == "~" {
                var mask = 0
                if ch(c, r - 1) == "~" { mask |= 1 }
                if ch(c + 1, r) == "~" { mask |= 2 }
                if ch(c, r + 1) == "~" { mask |= 4 }
                if ch(c - 1, r) == "~" { mask |= 8 }
                let center = cellCenter(c, r)
                if let t = bank.texture(decor, String(format: "%@_%02d", liquid, mask)) {
                    let s = SKSpriteNode(texture: t)
                    s.position = p(center.x, center.y)
                    staticLayer.addChild(s)
                } else {
                    let s = SKSpriteNode(color: theme.gel, size: CGSize(width: K.cell, height: K.cell))
                    s.position = p(center.x, center.y)
                    staticLayer.addChild(s)
                }
            }
        }
        let rocks = bank.frames(decor, "rock")
        let hedges = bank.frames(decor, "hedge")
        for r in 0..<K.rows {
            for c in 0..<K.cols {
                let g = ch(c, r)
                guard g == "#" || g == "%" else { continue }
                let center = cellCenter(c, r)
                let set = g == "#" ? rocks : hedges
                let v = Int(hashCell(c, r, 7) * 4)
                if !set.isEmpty {
                    let s = SKSpriteNode(texture: set[v % set.count])
                    s.position = p(center.x, center.y)
                    staticLayer.addChild(s)
                } else {
                    let s = SKShapeNode(rectOf: CGSize(width: K.cell - 4, height: K.cell - 4), cornerRadius: g == "#" ? 10 : 6)
                    s.fillColor = g == "#" ? Ink.ink : Ink.ink2
                    s.strokeColor = Ink.ink
                    s.position = p(center.x, center.y)
                    staticLayer.addChild(s)
                }
            }
        }
        // cadre de scène (centre transparent = écran)
        if let frame = bank.texture(bank.stage, "stage_frame") {
            let s = SKSpriteNode(texture: frame)
            s.position = CGPoint(x: W / 2, y: H / 2)
            staticLayer.addChild(s)
        } else {
            let wall = Self.wall
            let path = CGMutablePath()
            path.addRect(CGRect(x: -wall, y: -wall, width: W + 2 * wall, height: H + 2 * wall))
            path.addRect(CGRect(x: 0, y: 0, width: W, height: H))
            let s = SKShapeNode(path: path)
            s.fillColor = Ink.ink
            s.strokeColor = Ink.ink2
            staticLayer.addChild(s)
        }
    }

    // MARK: couches animées

    private func buildAnimated() {
        let decor = bank.decor(kingdom)
        let liquid = theme.liquidIsLava ? "lava" : "water"
        let waveFrames = bank.frames(decor, "\(liquid)_waves")
        if !waveFrames.isEmpty {
            for r in 0..<K.rows {
                for c in 0..<K.cols where ch(c, r) == "~" {
                    let center = cellCenter(c, r)
                    let s = SKSpriteNode(texture: waveFrames[0])
                    s.position = p(center.x, center.y)
                    s.zPosition = 1
                    addChild(s)
                    waves.append((s, waveFrames, theme.liquidIsLava ? 10 : 5))
                }
            }
        }
        // touffes au pied des obstacles (règle `spotsFor`)
        let ta = bank.frames(decor, "tuft_a"), tb = bank.frames(decor, "tuft_b")
        var count = 0
        outer: for r in 1..<K.rows {
            for c in 0..<K.cols {
                let g = ch(c, r)
                guard isFree(g), g != "P", g != "S" else { continue }
                let near = !isFree(ch(c, r - 1)) || !isFree(ch(c - 1, r)) || !isFree(ch(c + 1, r))
                guard near ? hashCell(c, r, 91) < 0.55 : hashCell(c, r, 91) < 0.06 else { continue }
                if count >= 14 { break outer }
                count += 1
                let frames = hashCell(c, r, 96) < 0.5 ? ta : tb
                guard !frames.isEmpty else { continue }
                let x = Double(c) * K.cell + 8 + hashCell(c, r, 92) * (K.cell - 16)
                let y = Double(r) * K.cell + (near ? 9 : 22) + hashCell(c, r, 93) * 8
                let s = SKSpriteNode(texture: frames[0])
                s.anchorPoint = CGPoint(x: 0.5, y: 6.0 / 28.0)
                s.position = p(x, y)
                s.setScale(CGFloat(0.8 + hashCell(c, r, 95) * 0.4) / 1.1)
                s.zPosition = 2
                addChild(s)
                tufts.append((s, frames, hashCell(c, r, 94) * .pi * 2))
            }
        }
        // découpes suspendues aux coins hauts
        let hf = bank.frames(decor, "hang")
        if !hf.isEmpty {
            let spots: [(Double, Double)] = [(16, 0.3), (40, 2.1), (K.arenaW - 18, 1.2), (K.arenaW - 44, 4)]
            for (x, ph) in spots {
                let s = SKSpriteNode(texture: hf[0])
                s.anchorPoint = CGPoint(x: 0.5, y: 54.0 / 56.0)
                s.position = p(x, 0)
                s.zPosition = 3
                addChild(s)
                hangs.append((s, hf, ph))
            }
        }
        let df = bank.frames(decor, "drift")
        if !df.isEmpty {
            for i in 0..<4 {
                let s = SKSpriteNode(texture: df[i % df.count])
                s.zPosition = 3
                addChild(s)
                drifts.append((s, i))
            }
        }
        // flammes des appliques du cadre
        flameFrames = bank.frames(bank.stage, "lamp_flame")
        if !flameFrames.isEmpty {
            for (j, y) in Self.lampY.enumerated() {
                for side in 0..<2 {
                    let x = side == 1 ? K.arenaW + Double(Self.wall) / 2 : -Double(Self.wall) / 2
                    let s = SKSpriteNode(texture: flameFrames[0])
                    s.anchorPoint = CGPoint(x: 0.5, y: 5.0 / 16.0)
                    s.position = p(x, y)
                    s.zPosition = 4
                    addChild(s)
                    flames.append((s, Double(j * 2 + side) * 0.17))
                }
            }
        }
    }

    private func buildPortal() {
        portalOpen = bank.frames(bank.vfx, "portal_open")
        portalLoop = bank.frames(bank.vfx, "portal_loop")
        let doorBottomY = 44.0
        let centerY = doorBottomY - 80.0 * 2.0 / 3.0 + 40
        if let f = portalOpen.first {
            portal.texture = f
            portal.size = f.size()
            portal.position = p(K.arenaW / 2, centerY)
            portal.zPosition = 5
            addChild(portal)
        } else {
            portalFallback.fillColor = Ink.ink
            portalFallback.strokeColor = Ink.ink
            portalFallback.position = p(K.arenaW / 2, 22)
            portalFallback.zPosition = 5
            addChild(portalFallback)
        }
        for _ in 0..<4 {
            let chevron = CGMutablePath()
            chevron.move(to: CGPoint(x: -9, y: -6))
            chevron.addLine(to: CGPoint(x: 0, y: 3))
            chevron.addLine(to: CGPoint(x: 9, y: -6))
            chevron.addLine(to: CGPoint(x: 0, y: -1))
            chevron.closeSubpath()
            let s = SKShapeNode(path: chevron)
            s.fillColor = Ink.ink
            s.strokeColor = .clear
            s.zPosition = 6
            s.isHidden = true
            addChild(s)
            guide.append(s)
        }
    }

    /// Anime le décor ; `open` : ouverture de la porte (0…1), `guideOn` : flèches vers la porte.
    func update(t: Double, open: Double, guideOn: Bool) {
        if !reduceMotion {
            for w in waves {
                let i = Int((t.truncatingRemainder(dividingBy: w.loop)) / w.loop * Double(w.frames.count)) % w.frames.count
                w.node.texture = w.frames[i]
            }
            let tuftLoop = 2 * Double.pi / 1.3
            for tf in tufts {
                let u = (t + tf.phase / 1.3).truncatingRemainder(dividingBy: tuftLoop) / tuftLoop
                tf.node.texture = tf.frames[Int(u * Double(tf.frames.count)) % tf.frames.count]
            }
            let hangLoop = 2 * Double.pi / 1.1
            for h in hangs {
                let u = (t + h.phase / 1.1).truncatingRemainder(dividingBy: hangLoop) / hangLoop
                h.node.texture = h.frames[Int(u * Double(h.frames.count)) % h.frames.count]
            }
            let drift: Double = theme.mote == .snow || theme.mote == .firefly ? 1 : theme.mote == .sand ? 2 : -1
            for d in drifts {
                let sx = hashCell(d.i, 3, 41), sy = hashCell(d.i, 4, 42)
                let speed = 7 + sx * 6
                var x: Double, y: Double
                if drift == 2 {
                    x = (sx * K.arenaW + t * speed * 2.2).truncatingRemainder(dividingBy: K.arenaW + 40) - 20
                    y = sy * K.arenaH + sin(t * 0.8 + Double(d.i)) * 12
                } else {
                    let span = K.arenaH + 40
                    y = ((sy * K.arenaH + drift * t * speed).truncatingRemainder(dividingBy: span) + span).truncatingRemainder(dividingBy: span) - 20
                    x = sx * K.arenaW + sin(t * 0.6 + Double(d.i) * 2) * 18
                }
                d.node.position = p(x, y)
                d.node.zRotation = CGFloat(-(t * (0.6 + sx) + Double(d.i)))
            }
            if !flameFrames.isEmpty {
                for f in flames {
                    let u = ((t + f.phase).truncatingRemainder(dividingBy: 0.45)) / 0.45
                    f.node.texture = flameFrames[Int(u * Double(flameFrames.count)) % flameFrames.count]
                }
            }
        }
        // porte : s'ouvre (k 0 → 1) puis rayons en boucle
        if !portalOpen.isEmpty {
            if open < 1 {
                portal.texture = portalOpen[min(portalOpen.count - 1, Int(open * Double(portalOpen.count)))]
            } else if !portalLoop.isEmpty {
                portal.texture = portalLoop[Int((t.truncatingRemainder(dividingBy: 0.98)) / 0.98 * Double(portalLoop.count)) % portalLoop.count]
            }
        } else {
            portalFallback.fillColor = open > 0 ? Ink.cut : Ink.ink
            portalFallback.setScale(CGFloat(0.6 + 0.4 * open))
        }
        // traînée de flèches qui invite à monter vers la porte
        for (i, g) in guide.enumerated() {
            g.isHidden = !guideOn
            guard guideOn else { continue }
            let k = (t * 0.8 + Double(i) / 4).truncatingRemainder(dividingBy: 1)
            g.position = p(K.arenaW / 2, 120 - k * 100)
            g.alpha = CGFloat(sin(k * .pi) * 0.8)
        }
    }
}
