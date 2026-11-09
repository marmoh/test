import SpriteKit
import UIKit

/// Mécaniques signature de la version 0.2 (DECISIONS #74) — port de `drawMomentum`, `drawGusts`, `drawWhirl`,
/// `drawEmbers` et `hint` de `web/src/combat.ts` :
/// - Moine du vent : arc d'encre de l'élan sous ses pieds (jade quand il est plein), spirales de la bourrasque,
///   tourbillons ;
/// - Sorcier de braise : lit de cendre et flammes découpées de la traînée, points d'or à la feuille ;
/// - aides écrites tant que la mécanique n'a pas servi (désactivées en tournoi).
///
/// Les tracés sont faits dans la convention du canevas web (y vers le bas) : chaque conteneur est retourné
/// (`yScale` négatif) et placé avec `scenePoint`.
@MainActor
final class SignatureNode: SKNode {
    // élan du moine
    private let momentum = SKNode()
    private let momentumBase = SKShapeNode()
    private let momentumArc = SKShapeNode()
    private let momentumSpin = SKShapeNode()
    // bourrasques (effets de 0,45 s)
    private final class GustFx {
        let t0: Double
        let r: Double
        let m: Double
        let node = SKNode()
        let arcs: [SKShapeNode]
        let ring = SKShapeNode()
        init(t0: Double, r: Double, m: Double) {
            self.t0 = t0; self.r = r; self.m = m
            arcs = (0..<7).map { _ in SKShapeNode() }
        }
    }
    private var gusts: [GustFx] = []
    // tourbillons
    private var whirlNodes: [SKShapeNode] = []
    // braises du sorcier
    private let ashBed = SKShapeNode()
    private var flames: [SKSpriteNode] = []
    private var golds: [SKSpriteNode] = []
    // aide écrite
    private let hint = SKLabelNode()
    private var hintText = ""
    private let light: UIColor

    init(light: UIColor) {
        self.light = light
        super.init()
        momentum.yScale = -0.42
        momentum.zPosition = -1
        for n in [momentumBase, momentumArc, momentumSpin] {
            n.lineCap = .round
            n.fillColor = .clear
            momentum.addChild(n)
        }
        momentumBase.path = CGPath(ellipseIn: CGRect(x: -26, y: -26, width: 52, height: 52), transform: nil)
        momentumBase.strokeColor = Ink.ink.withAlphaComponent(0.18)
        momentumBase.lineWidth = 4
        momentumSpin.strokeColor = Ink.cut
        momentumSpin.lineWidth = 2
        momentum.isHidden = true
        addChild(momentum)
        ashBed.strokeColor = Ink.ink.withAlphaComponent(0.13)
        ashBed.lineCap = .round
        ashBed.lineJoin = .round
        ashBed.fillColor = .clear
        ashBed.zPosition = -2
        addChild(ashBed)
        hint.horizontalAlignmentMode = .center
        hint.verticalAlignmentMode = .center
        hint.zPosition = 200
        hint.isHidden = true
        addChild(hint)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) indisponible") }

    /// Nouvelle bourrasque (évènement `gust` de la simulation).
    func addGust(x: Double, y: Double, r: Double, m: Double, t: Double) {
        let g = GustFx(t0: t, r: r, m: m)
        g.node.position = scenePoint(x, y)
        g.node.yScale = -1
        for a in g.arcs {
            a.lineCap = .round
            a.fillColor = .clear
            g.node.addChild(a)
        }
        g.ring.fillColor = .clear
        g.ring.strokeColor = Ink.cut.withAlphaComponent(0.9)
        g.node.addChild(g.ring)
        addChild(g.node)
        gusts.append(g)
    }

    func clear() {
        for g in gusts { g.node.removeFromParent() }
        gusts.removeAll()
        for w in whirlNodes { w.removeFromParent() }
        whirlNodes.removeAll()
        ashBed.path = nil
        for f in flames { f.isHidden = true }
        for d in golds { d.isHidden = true }
        hint.isHidden = true
        momentum.isHidden = true
    }

    /// `hp` : position interpolée du héros (simulation) ; `t` : temps d'affichage.
    func update(world w: World, hp: Vec, t: Double, hints: Bool, level: Int) {
        let h = w.hero
        updateGusts(t)
        updateWhirls(w, t)
        var text = ""
        switch h.kind {
        case .thread:
            momentum.isHidden = true
        case .gust:
            updateMomentum(h, hp: hp, t: t)
            if hints && h.gusts < 3 && !w.cleared && !w.enemies.isEmpty {
                text = h.momentum < 0.6
                    ? String(localized: "Cours pour prendre de l’élan…", comment: "Combat, aide du Moine du vent")
                    : String(localized: "…puis arrête-toi près d’eux !", comment: "Combat, aide du Moine du vent")
            }
        case .ember:
            momentum.isHidden = true
            if hints && level <= 125 && h.dmgBy.sig < 300 && !w.cleared && !w.enemies.isEmpty {
                text = String(localized: "Fais-les marcher dans tes braises", comment: "Combat, aide du Sorcier de braise")
            }
        }
        updateEmbers(w, t)
        if text.isEmpty {
            hint.isHidden = true
        } else {
            if text != hintText {
                hintText = text
                let font = UIFont(name: "AlegreyaSans-BoldItalic", size: 14) ?? .italicSystemFont(ofSize: 14)
                hint.attributedText = NSAttributedString(string: text, attributes: [
                    .font: font, .foregroundColor: Ink.ink, .strokeColor: light, .strokeWidth: -5.0,
                ])
            }
            hint.isHidden = false
            hint.position = scenePoint(max(90, min(K.arenaW - 90, hp.x)), hp.y + 52)
        }
    }

    // MARK: moine

    private func updateMomentum(_ h: HeroState, hp: Vec, t: Double) {
        momentum.isHidden = false
        momentum.position = scenePoint(hp.x, hp.y + 10)
        let m = h.momentum
        let ready = m >= GustK.minMomentum && h.gustCd <= 0
        let full = m >= 0.999
        if m > 0.01 {
            let p = CGMutablePath()
            p.addArc(center: .zero, radius: 26, startAngle: -.pi / 2, endAngle: -.pi / 2 + .pi * 2 * CGFloat(m), clockwise: false)
            momentumArc.path = p
            momentumArc.strokeColor = full ? Ink.jade : ready ? Ink.jade.withAlphaComponent(0.85) : Ink.ink2
            momentumArc.lineWidth = full ? 6 : 4.5
            momentumArc.isHidden = false
        } else {
            momentumArc.isHidden = true
        }
        if full {
            // plein élan : petites rafales découpées qui tournent
            let p = CGMutablePath()
            for i in 0..<3 {
                let a = CGFloat(t * 7) + CGFloat(i) * .pi * 2 / 3
                p.move(to: CGPoint(x: cos(a) * 32, y: sin(a) * 32))
                p.addArc(center: .zero, radius: 32, startAngle: a, endAngle: a + 0.7, clockwise: false)
            }
            momentumSpin.path = p
            momentumSpin.isHidden = false
        } else {
            momentumSpin.isHidden = true
        }
    }

    /// Bourrasque : spirales de vent d'encre qui s'ouvrent depuis le moine.
    private func updateGusts(_ t: Double) {
        gusts.removeAll { g in
            if t - g.t0 < 0.45 { return false }
            g.node.removeFromParent()
            return true
        }
        for g in gusts {
            let k = (t - g.t0) / 0.45
            let r = g.r * easeOutCubic(min(1, k * 1.3))
            g.node.alpha = CGFloat(1 - k)
            for (i, a) in g.arcs.enumerated() {
                let a0 = CGFloat(Double(i) * .pi * 2 / 7 + k * 1.4)
                let rr = CGFloat(r * (0.75 + 0.25 * Double((i * 3) % 4) / 3))
                let p = CGMutablePath()
                p.move(to: CGPoint(x: cos(a0) * rr, y: sin(a0) * rr))
                p.addArc(center: .zero, radius: rr, startAngle: a0, endAngle: a0 + CGFloat(0.6 + 0.4 * g.m), clockwise: false)
                a.path = p
                a.strokeColor = i % 2 == 1 ? Ink.ink : Ink.ink.withAlphaComponent(0.6)
                a.lineWidth = CGFloat(3 - k * 2)
            }
            g.ring.path = CGPath(ellipseIn: CGRect(x: -r, y: -r, width: 2 * r, height: 2 * r), transform: nil)
            g.ring.lineWidth = CGFloat(6 * (1 - k))
        }
    }

    private func updateWhirls(_ w: World, _ t: Double) {
        while whirlNodes.count < w.whirls.count {
            let n = SKShapeNode()
            n.lineCap = .round
            n.lineWidth = 2
            n.fillColor = .clear
            n.strokeColor = Ink.ink.withAlphaComponent(0.75)
            n.yScale = -1
            addChild(n)
            whirlNodes.append(n)
        }
        while whirlNodes.count > w.whirls.count { whirlNodes.removeLast().removeFromParent() }
        for (n, wh) in zip(whirlNodes, w.whirls) {
            n.position = scenePoint(wh.pos.x, wh.pos.y)
            n.alpha = CGFloat(min(1, (wh.endAt - w.t) * 2))
            let p = CGMutablePath()
            for i in 0..<4 {
                for s in 0...24 {
                    let k = Double(s) / 24
                    let a = -t * 6 + Double(i) * (.pi / 2) + k * 4.5
                    let rr = wh.r * (1 - k) * 0.95
                    let pt = CGPoint(x: cos(a) * rr, y: sin(a) * rr * 0.8)
                    if s == 0 { p.move(to: pt) } else { p.addLine(to: pt) }
                }
            }
            n.path = p
        }
    }

    // MARK: sorcier

    /// Traînée de braises : flammes découpées, or à la feuille, qui s'éteignent en cendres d'encre.
    private func updateEmbers(_ w: World, _ t: Double) {
        let em = w.hero.embers
        let s = w.hero.stats
        let life = EmberK.life * s.emberLife
        let wid = EmberK.radius * s.emberWidth
        if em.count > 1 {
            let p = CGMutablePath()
            p.move(to: scenePoint(em[0].x, em[0].y))
            for q in em.dropFirst() { p.addLine(to: scenePoint(q.x, q.y)) }
            ashBed.path = p
            ashBed.lineWidth = CGFloat(wid * 1.6)
            ashBed.isHidden = false
        } else {
            ashBed.isHidden = true
        }
        let flameTex = TextureBank.shared.flame
        while flames.count < em.count {
            let f = SKSpriteNode(texture: flameTex)
            f.anchorPoint = CGPoint(x: 0.5, y: 1.0 / 12.0)
            addChild(f)
            flames.append(f)
            let d = SKSpriteNode(texture: TextureBank.shared.dot)
            d.color = Ink.gold
            d.colorBlendFactor = 1
            d.size = CGSize(width: 3.2, height: 3.2)
            d.zPosition = 0.5
            addChild(d)
            golds.append(d)
        }
        for i in 0..<flames.count {
            let f = flames[i], d = golds[i]
            guard i < em.count else {
                f.isHidden = true
                d.isHidden = true
                continue
            }
            let p = em[i]
            let a = max(0, 1 - (w.t - p.t) / life)
            if a <= 0 {
                f.isHidden = true
                d.isHidden = true
                continue
            }
            let hgt = (4 + 6 * a) * (0.85 + 0.15 * sin(t * 13 + Double(i) * 1.7)) * (wid / EmberK.radius)
            let ox = sin(Double(i) * 2.3) * wid * 0.35
            f.isHidden = false
            f.position = scenePoint(p.x + ox, p.y + 3)
            f.setScale(CGFloat(hgt / 5))
            f.alpha = CGFloat(min(1, a * 1.4))
            f.zPosition = CGFloat(p.y / 1000)
            d.isHidden = a <= 0.5
            d.position = scenePoint(p.x + ox, p.y + 2)
        }
    }
}
