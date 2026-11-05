import SpriteKit
import UIKit

/// Ciseaux de lune — rendu du fil (port de `drawThread` / `drawCuts` de `web/src/combat.ts`) :
/// une entaille lumineuse doublée de pointillés d'encre qui pâlit en séchant ; boucle presque fermée : la zone
/// s'éclaire et un nœud jade palpite au point de fermeture ; découpe : éclair de lumière, trou sombre
/// (on voit les coulisses), puis le morceau de papier tombe en tournoyant.
@MainActor
final class ThreadNode: SKNode {
    private static let buckets = 6
    private var light: [SKShapeNode] = []
    private var ink: [SKShapeNode] = []
    private let preview = SKShapeNode()
    private let knot = SKSpriteNode()
    private let knotFallback = SKShapeNode(circleOfRadius: 5)
    private var knotFrames: [SKTexture] = []
    private let hint = SKShapeNode(circleOfRadius: 56)
    private let hintArrow = SKShapeNode()
    private let hintLabel = SKLabelNode()
    private var cuts: [Cut] = []
    /// Couleur de l'encre du fil (apparence du pass de saison).
    var inkColor = Ink.ink

    @MainActor
    private final class Cut {
        let t0: Double
        let echo: Bool
        let hole = SKShapeNode()
        let flash = SKShapeNode()
        let piece = SKShapeNode()
        let center: CGPoint
        let side: CGFloat
        init(t0: Double, echo: Bool, center: CGPoint, side: CGFloat) {
            self.t0 = t0; self.echo = echo; self.center = center; self.side = side
        }
    }

    override init() {
        super.init()
        for i in 0..<Self.buckets {
            let l = SKShapeNode()
            l.lineCap = .round
            l.lineWidth = 5
            l.zPosition = CGFloat(i) * 0.01
            addChild(l)
            light.append(l)
        }
        for i in 0..<Self.buckets {
            let n = SKShapeNode()
            n.lineCap = .round
            n.zPosition = 1 + CGFloat(i) * 0.01
            addChild(n)
            ink.append(n)
        }
        preview.strokeColor = .clear
        preview.zPosition = -1
        addChild(preview)
        knotFrames = TextureBank.shared.frames(TextureBank.shared.vfx, "thread_knot")
        knot.zPosition = 2
        knot.isHidden = true
        if let f = knotFrames.first { knot.texture = f; knot.size = f.size() }
        addChild(knot)
        knotFallback.fillColor = Ink.jade
        knotFallback.strokeColor = Ink.ink
        knotFallback.lineWidth = 1.5
        knotFallback.isHidden = true
        knotFallback.zPosition = 2
        addChild(knotFallback)
        // aide au départ (niveaux 1 à 3) : « Encercle-le pour le découper »
        hint.strokeColor = Ink.jade.withAlphaComponent(0.8)
        hint.lineWidth = 2
        hint.fillColor = .clear
        hint.path = UIBezierPath(arcCenter: .zero, radius: 56, startAngle: 0, endAngle: .pi * 2, clockwise: true).cgPath
            .copy(dashingWithPhase: 0, lengths: [6, 8])
        let arrow = CGMutablePath()
        arrow.move(to: CGPoint(x: 56, y: 7))
        arrow.addLine(to: CGPoint(x: 63, y: -3))
        arrow.addLine(to: CGPoint(x: 49, y: -3))
        arrow.closeSubpath()
        hintArrow.path = arrow
        hintArrow.fillColor = Ink.jade
        hintArrow.strokeColor = .clear
        hint.addChild(hintArrow)
        hint.isHidden = true
        hint.zPosition = 3
        addChild(hint)
        hintLabel.attributedText = FX.inked("Encercle-le pour le découper", color: Ink.ink, size: 13)
        hintLabel.isHidden = true
        hintLabel.zPosition = 3
        addChild(hintLabel)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) indisponible") }

    private func p(_ x: Double, _ y: Double) -> CGPoint { CGPoint(x: x, y: K.arenaH - y) }

    /// Redessine le fil. `hp` : position interpolée de l'héroïne (simulation), `t` : temps de rendu.
    func update(world w: World, hp: Vec, t: Double, showHint: Bool) {
        let th = w.hero.thread
        let life = ThreadTuning.life * w.hero.stats.threadLife
        // aide : cercle autour de l'ennemi le plus proche tant qu'aucune découpe n'a été faite
        if showHint, let e = w.enemies.min(by: { DMath.hypot($0.pos.x - hp.x, $0.pos.y - hp.y) < DMath.hypot($1.pos.x - hp.x, $1.pos.y - hp.y) }) {
            hint.isHidden = false
            hint.position = p(e.pos.x, e.pos.y)
            hint.zRotation = CGFloat(-t * 0.8)
            hintLabel.isHidden = false
            hintLabel.position = p(e.pos.x, e.pos.y + 76)
        } else {
            hint.isHidden = true
            hintLabel.isHidden = true
        }

        let lightPaths = (0..<Self.buckets).map { _ in CGMutablePath() }
        var used = [Bool](repeating: false, count: Self.buckets)
        if !th.isEmpty {
            var pts: [(x: Double, y: Double, a: Double)] = th.map { ($0.x, $0.y, max(0, 1 - (w.t - $0.t) / life)) }
            pts.append((hp.x, hp.y, 1))
            for i in 1..<pts.count {
                let k = (pts[i - 1].a + pts[i].a) / 2
                let b = min(Self.buckets - 1, Int(k * Double(Self.buckets)))
                lightPaths[b].move(to: p(pts[i - 1].x, pts[i - 1].y))
                lightPaths[b].addLine(to: p(pts[i].x, pts[i].y))
                used[b] = true
            }
        }
        for b in 0..<Self.buckets {
            let k = (Double(b) + 0.5) / Double(Self.buckets)
            if used[b] {
                light[b].path = lightPaths[b]
                light[b].strokeColor = Ink.cut.withAlphaComponent(CGFloat(0.75 * k))
                ink[b].path = lightPaths[b].copy(dashingWithPhase: CGFloat(t * 30), lengths: [6, 4])
                ink[b].strokeColor = inkColor.withAlphaComponent(CGFloat(0.25 + 0.75 * k))
                ink[b].lineWidth = CGFloat(1.8 + 1.2 * k)
                light[b].isHidden = false
                ink[b].isHidden = false
            } else {
                light[b].isHidden = true
                ink[b].isHidden = true
            }
        }

        // boucle presque fermée : on éclaire la zone qui va être découpée
        preview.isHidden = true
        knot.isHidden = true
        knotFallback.isHidden = true
        if th.count > 8 {
            for i in 0..<(th.count - 6) {
                if DMath.hypot(th[i].x - hp.x, th[i].y - hp.y) > 26 { continue }
                var poly = th[i...].map { Vec($0.x, $0.y) }
                poly.append(hp)
                if Swift.abs(polyArea(poly)) < ThreadTuning.minArea { break }
                let path = CGMutablePath()
                path.addLines(between: poly.map { p($0.x, $0.y) })
                path.closeSubpath()
                preview.path = path
                preview.fillColor = Ink.cut.withAlphaComponent(CGFloat(0.35 + 0.15 * sin(t * 20)))
                preview.isHidden = false
                if !knotFrames.isEmpty {
                    knot.isHidden = false
                    knot.position = p(th[i].x, th[i].y)
                    knot.texture = knotFrames[Int((t.truncatingRemainder(dividingBy: 0.6)) / 0.6 * Double(knotFrames.count)) % knotFrames.count]
                } else {
                    knotFallback.isHidden = false
                    knotFallback.position = p(th[i].x, th[i].y)
                }
                break
            }
        }
    }

    /// Nouvelle découpe (évènement `cut` de la simulation).
    func addCut(poly: [Vec], echo: Bool, t: Double, paper: UIColor) {
        guard poly.count >= 3 else { return }
        var cx = 0.0, cy = 0.0
        for v in poly { cx += v.x; cy += v.y }
        cx /= Double(poly.count)
        cy /= Double(poly.count)
        let center = p(cx, cy)
        let local = CGMutablePath()
        local.addLines(between: poly.map { CGPoint(x: $0.x - cx, y: -($0.y - cy)) })
        local.closeSubpath()
        let c = Cut(t0: t, echo: echo, center: center, side: cx > K.arenaW / 2 ? 1 : -1)
        for n in [c.hole, c.flash, c.piece] {
            n.path = local
            n.position = center
            addChild(n)
        }
        c.hole.fillColor = Ink.ink.withAlphaComponent(0.55)
        c.hole.strokeColor = .clear
        c.hole.zPosition = -2
        c.hole.isHidden = echo
        c.flash.fillColor = Ink.cut.withAlphaComponent(0.9)
        c.flash.strokeColor = Ink.ink
        c.flash.lineWidth = 2.5
        c.flash.zPosition = 4
        c.piece.fillColor = paper
        c.piece.strokeColor = .clear
        c.piece.zPosition = 4
        let dashed = SKShapeNode(path: local.copy(dashingWithPhase: 0, lengths: [5, 3]))
        dashed.strokeColor = Ink.ink
        dashed.lineWidth = 2
        c.piece.addChild(dashed)
        c.piece.isHidden = true
        cuts.append(c)
    }

    /// Anime les découpes en cours.
    func updateCuts(t: Double) {
        cuts.removeAll { c in
            let k = t - c.t0
            if k >= 1.1 {
                c.hole.removeFromParent()
                c.flash.removeFromParent()
                c.piece.removeFromParent()
                return true
            }
            let hole = max(0, 1 - k / 0.9)
            c.hole.alpha = CGFloat(hole)
            if k < 0.12 {
                c.flash.isHidden = false
                c.flash.alpha = CGFloat(1 - k / 0.12)
                c.piece.isHidden = true
            } else {
                c.flash.isHidden = true
                if !c.echo {
                    let f = k - 0.12
                    c.piece.isHidden = false
                    c.piece.alpha = CGFloat(max(0, 1 - f / 0.95))
                    c.piece.position = CGPoint(x: c.center.x + CGFloat(f * 30), y: c.center.y - CGFloat(260 * f * f + 20 * f))
                    c.piece.zRotation = -CGFloat(f * 1.6) * c.side
                    c.piece.setScale(CGFloat(1 - f * 0.35))
                }
            }
            return false
        }
    }

    func clearAll() {
        for c in cuts {
            c.hole.removeFromParent()
            c.flash.removeFromParent()
            c.piece.removeFromParent()
        }
        cuts.removeAll()
    }
}
