import SpriteKit
import UIKit

/// Motion design du combat (port de `web/src/fx.ts`) : particules, chutes de papier, anneaux, textes flottants,
/// secousses (« trauma ») et arrêts sur image. « Réduire les animations » coupe secousses et arrêts sur image.
@MainActor
final class FX {
    enum Kind { case dot, spark, ring, scrap, sprite }

    private struct Particle {
        var node: SKSpriteNode
        var kind: Kind
        var x: Double, y: Double, vx: Double, vy: Double
        var life: Double, max: Double
        var size: Double
        var grav: Double, drag: Double, rot: Double
        var frames: [SKTexture] = []
        var duration: Double = 0
    }

    private struct FloatText {
        var node: SKLabelNode
        var x: Double, y: Double, vx: Double
        var life: Double, max: Double
        var size: CGFloat
    }

    let layer = SKNode()
    var trauma = 0.0
    var freeze = 0.0
    var heroFlash = 0.0
    var slowmo = 0.0
    var reduceMotion = false
    private var seed: UInt32 = 1
    private var parts: [Particle] = []
    private var texts: [FloatText] = []
    private var spritePool: [SKSpriteNode] = []
    private var labelPool: [SKLabelNode] = []
    private let bank = TextureBank.shared
    /// Conversion simulation (y vers le bas) → scène (y vers le haut), fournie par la scène.
    var toScene: (Double, Double) -> CGPoint = { CGPoint(x: $0, y: $1) }

    init() {
        layer.zPosition = 500
    }

    func rand() -> Double {
        seed = UInt32((UInt64(seed) * 16807) % 2_147_483_647)
        return Double(seed) / 2_147_483_647
    }

    func shake(_ amount: Double) {
        if reduceMotion { return }
        trauma = min(1, trauma + amount)
    }

    func hitStop(_ s: Double) {
        if reduceMotion { return }
        freeze = max(freeze, s)
    }

    private func sprite() -> SKSpriteNode {
        if let n = spritePool.popLast() {
            n.isHidden = false
            n.alpha = 1
            n.zRotation = 0
            n.setScale(1)
            return n
        }
        let n = SKSpriteNode()
        layer.addChild(n)
        return n
    }

    private func spawn(_ p: Particle) {
        parts.append(p)
        if parts.count > 600 {
            let old = parts.removeFirst()
            recycle(old.node)
        }
    }

    private func recycle(_ n: SKSpriteNode) {
        n.isHidden = true
        spritePool.append(n)
    }

    /// Éclats ou points qui partent dans toutes les directions.
    func burst(_ x: Double, _ y: Double, color: UIColor, _ n: Int, speed: Double = 160, kind: Kind = .dot, size: Double = 3, life: Double = 0.5, grav: Double = 0) {
        for _ in 0..<n {
            let a = rand() * .pi * 2
            let s = speed * (0.35 + rand() * 0.65)
            let node = sprite()
            node.texture = kind == .spark ? bank.spark : bank.dot
            node.color = color
            node.colorBlendFactor = 1
            let sz = size * (0.6 + rand() * 0.6)
            node.size = kind == .spark ? CGSize(width: sz * 3, height: sz) : CGSize(width: sz * 2, height: sz * 2)
            spawn(Particle(node: node, kind: kind, x: x, y: y, vx: cos(a) * s, vy: sin(a) * s, life: life * (0.6 + rand() * 0.4), max: life, size: sz, grav: grav, drag: 3, rot: a))
        }
    }

    /// Onde d'encre (mort, impact de zone).
    func ring(_ x: Double, _ y: Double, color: UIColor, size: Double, life: Double = 0.35) {
        let node = sprite()
        let frames = bank.frames(bank.vfx, "ring")
        node.texture = frames.first ?? bank.ring
        node.color = color
        node.colorBlendFactor = frames.isEmpty ? 1 : (color == Ink.ink ? 0 : 1)
        node.size = CGSize(width: 2 * size, height: 2 * size)
        spawn(Particle(node: node, kind: frames.isEmpty ? .ring : .sprite, x: x, y: y, vx: 0, vy: 0, life: life, max: life, size: size, grav: 0, drag: 0, rot: 0, frames: frames, duration: life))
    }

    /// Effet VFX image par image (impact, étincelle de fil coupé, soin, confettis…), centré.
    func vfx(_ name: String, _ x: Double, _ y: Double, scale: Double = 1, duration: Double, rotation: Double = 0) {
        let frames = bank.frames(bank.vfx, name)
        guard let first = frames.first else { return }
        let node = sprite()
        node.texture = first
        node.colorBlendFactor = 0
        node.size = CGSize(width: first.size().width * scale, height: first.size().height * scale)
        spawn(Particle(node: node, kind: .sprite, x: x, y: y, vx: 0, vy: 0, life: duration, max: duration, size: scale, grav: 0, drag: 0, rot: rotation, frames: frames, duration: duration))
    }

    /// Chutes de papier découpé (mort d'une marionnette, impact).
    func scraps(_ x: Double, _ y: Double, _ n: Int, power: Double = 1) {
        let ink = bank.frames(bank.vfx, "scrap_ink")
        let ink2 = bank.frames(bank.vfx, "scrap_ink2")
        let light = bank.frames(bank.vfx, "scrap_light")
        for _ in 0..<n {
            let a = rand() * .pi * 2
            let sp = (60 + rand() * 160) * power
            let r = rand()
            let frames = r < 0.6 ? ink : r < 0.85 ? ink2 : light
            let node = sprite()
            let size = 2.5 + rand() * 3.5 * power
            if let f = frames.first {
                node.texture = f
                node.colorBlendFactor = 0
                node.size = CGSize(width: size * 2.6, height: size * 2.6)
            } else {
                node.texture = bank.dot
                node.color = r < 0.6 ? Ink.ink : r < 0.85 ? Ink.ink2 : Ink.cut
                node.colorBlendFactor = 1
                node.size = CGSize(width: size * 2, height: size * 1.4)
            }
            spawn(Particle(node: node, kind: .scrap, x: x, y: y, vx: cos(a) * sp, vy: sin(a) * sp - 60 * power, life: 0.9 + rand() * 0.4, max: 1.3, size: size, grav: 260, drag: 2.2, rot: rand() * 6, frames: frames, duration: 0.5))
        }
    }

    /// Texte flottant (chiffres d'encre, « Découpe », « Esquive »…).
    func text(_ x: Double, _ y: Double, _ s: String, color: UIColor, size: CGFloat = 14) {
        let label: SKLabelNode
        if let l = labelPool.popLast() {
            label = l
            label.isHidden = false
        } else {
            label = SKLabelNode()
            label.horizontalAlignmentMode = .center
            label.verticalAlignmentMode = .baseline
            label.zPosition = 10
            layer.addChild(label)
        }
        label.attributedText = Self.inked(s, color: color, size: size)
        texts.append(FloatText(node: label, x: x, y: y, vx: (rand() - 0.5) * 30, life: 0.8, max: 0.8, size: size))
        if texts.count > 40 {
            let t = texts.removeFirst()
            t.node.isHidden = true
            labelPool.append(t.node)
        }
    }

    static func inked(_ s: String, color: UIColor, size: CGFloat) -> NSAttributedString {
        let font = UIFont(name: "AlegreyaSans-ExtraBold", size: size) ?? .systemFont(ofSize: size, weight: .heavy)
        return NSAttributedString(string: s, attributes: [
            .font: font,
            .foregroundColor: color,
            .strokeColor: UIColor(hex: 0xF4E8C8, alpha: 0.95),
            .strokeWidth: -4.0,
        ])
    }

    func update(_ dt: Double) {
        trauma = max(0, trauma - dt * 1.8)
        heroFlash = max(0, heroFlash - dt * 2.5)
        slowmo = max(0, slowmo - dt)
        var keep: [Particle] = []
        keep.reserveCapacity(parts.count)
        for var p in parts {
            p.life -= dt
            if p.life <= 0 {
                recycle(p.node)
                continue
            }
            p.vx *= exp(-p.drag * dt)
            p.vy *= exp(-p.drag * dt)
            p.vy += p.grav * dt
            p.x += p.vx * dt
            p.y += p.vy * dt
            p.rot += dt * 6
            draw(p)
            keep.append(p)
        }
        parts = keep
        var keepT: [FloatText] = []
        for var t in texts {
            t.life -= dt
            if t.life <= 0 {
                t.node.isHidden = true
                labelPool.append(t.node)
                continue
            }
            t.y -= 38 * dt
            t.x += t.vx * dt
            let k = t.life / t.max
            let pop = k > 0.8 ? 1 + (k - 0.8) * 3 : 1
            t.node.position = toScene(t.x, t.y)
            t.node.setScale(CGFloat(pop))
            t.node.alpha = CGFloat(min(1, k * 2))
            keepT.append(t)
        }
        texts = keepT
    }

    private func draw(_ p: Particle) {
        let k = p.life / p.max
        let n = p.node
        n.position = toScene(p.x, p.y)
        n.alpha = CGFloat(min(1, k * 1.6))
        switch p.kind {
        case .dot:
            n.setScale(CGFloat(0.4 + k * 0.6))
        case .spark:
            n.zRotation = CGFloat(-atan2(p.vy, p.vx))
            n.xScale = CGFloat(max(0.2, k))
        case .ring:
            n.alpha = CGFloat(k)
            n.setScale(CGFloat(1.15 - k * 0.85))
        case .scrap:
            n.zRotation = CGFloat(p.rot)
            n.yScale = CGFloat(cos(p.rot * 1.7))
            if !p.frames.isEmpty {
                let i = Int((p.max - p.life) / p.duration * Double(p.frames.count)) % p.frames.count
                n.texture = p.frames[i]
            }
        case .sprite:
            n.alpha = 1
            n.zRotation = CGFloat(p.rot)
            if !p.frames.isEmpty {
                let i = min(p.frames.count - 1, Int((1 - k) * Double(p.frames.count)))
                n.texture = p.frames[i]
            }
        }
    }

    /// Décalage de secousse (pt).
    func shakeOffset(_ t: Double) -> CGPoint {
        let k = trauma * trauma * 7
        return CGPoint(x: sin(t * 91.7) * k, y: cos(t * 73.3) * k)
    }

    func clear() {
        for p in parts { recycle(p.node) }
        parts.removeAll()
        for t in texts {
            t.node.isHidden = true
            labelPool.append(t.node)
        }
        texts.removeAll()
    }
}
