import SpriteKit
import UIKit

/// Textures du combat : atlas de `Resources/Atlases` (générés par `pnpm art:atlas`, voir leur README) et
/// quelques textures dessinées à la volée (aiguilles, projectiles ennemis, points, étincelles).
/// Les personnages sont dessinés tournés vers la droite (`facing = 0`), origine 4 pt sous le centre de l'image.
@MainActor
final class TextureBank {
    static let shared = TextureBank()

    let hero = SKTextureAtlas(named: "Hero")
    let enemies = SKTextureAtlas(named: "Enemies")
    let bosses = SKTextureAtlas(named: "Bosses")
    let icons = SKTextureAtlas(named: "Icons")
    let vfx = SKTextureAtlas(named: "VFX")
    let stage = SKTextureAtlas(named: "Stage")
    private var decorAtlases: [Int: SKTextureAtlas] = [:]
    private var names: [ObjectIdentifier: Set<String>] = [:]
    private var frameCache: [String: [SKTexture]] = [:]
    private var single: [String: SKTexture] = [:]

    private init() {}

    func decor(_ kingdom: Int) -> SKTextureAtlas {
        if let a = decorAtlases[kingdom] { return a }
        let a = SKTextureAtlas(named: KingdomTheme.of(kingdom: kingdom).atlas)
        decorAtlases[kingdom] = a
        return a
    }

    /// Précharge les atlas d'un combat (évite les saccades à la première apparition).
    func preload(kingdom: Int, completion: @escaping @MainActor () -> Void) {
        SKTextureAtlas.preloadTextureAtlases([hero, enemies, bosses, vfx, stage, decor(kingdom)]) {
            Task { @MainActor in completion() }
        }
    }

    /// Noms disponibles d'un atlas (sans extension ni suffixe @2x/@3x).
    private func available(_ atlas: SKTextureAtlas) -> Set<String> {
        let key = ObjectIdentifier(atlas)
        if let s = names[key] { return s }
        var s = Set<String>()
        for n in atlas.textureNames {
            var base = (n as NSString).deletingPathExtension
            if let at = base.range(of: "@") { base = String(base[..<at.lowerBound]) }
            s.insert(base)
        }
        names[key] = s
        return s
    }

    func has(_ atlas: SKTextureAtlas, _ name: String) -> Bool { available(atlas).contains(name) }

    func texture(_ atlas: SKTextureAtlas, _ name: String) -> SKTexture? {
        has(atlas, name) ? atlas.textureNamed(name) : nil
    }

    /// Images `prefix_00`, `prefix_01`… d'un atlas.
    func frames(_ atlas: SKTextureAtlas, _ prefix: String) -> [SKTexture] {
        let key = "\(ObjectIdentifier(atlas).hashValue)/\(prefix)"
        if let f = frameCache[key] { return f }
        var out: [SKTexture] = []
        let set = available(atlas)
        var i = 0
        while set.contains(String(format: "%@_%02d", prefix, i)) {
            out.append(atlas.textureNamed(String(format: "%@_%02d", prefix, i)))
            i += 1
        }
        frameCache[key] = out
        return out
    }

    /// Animation d'un personnage (`scout`, `goblin`, `treant`…) : idle, move, aim, cut, windup, charge, death, breath.
    func character(_ name: String, _ tag: String) -> [SKTexture] {
        let atlas: SKTextureAtlas
        if HeroID(rawValue: name) != nil { atlas = hero }
        else if BossArchetype(rawValue: name) != nil { atlas = bosses }
        else { atlas = enemies }
        return frames(atlas, "\(name)_\(tag)")
    }

    func icon(_ name: String) -> SKTexture? { texture(icons, name) }

    // MARK: textures dessinées

    func drawn(_ key: String, size: CGSize, _ draw: (CGContext) -> Void) -> SKTexture {
        if let t = single[key] { return t }
        let fmt = UIGraphicsImageRendererFormat.preferred()
        let img = UIGraphicsImageRenderer(size: size, format: fmt).image { ctx in draw(ctx.cgContext) }
        let t = SKTexture(image: img)
        single[key] = t
        return t
    }

    /// Disque blanc (teinté par `color`).
    var dot: SKTexture {
        drawn("dot", size: CGSize(width: 16, height: 16)) { c in
            c.setFillColor(UIColor.white.cgColor)
            c.fillEllipse(in: CGRect(x: 0, y: 0, width: 16, height: 16))
        }
    }

    /// Trait arrondi blanc (étincelle, étiré selon la vitesse).
    var spark: SKTexture {
        drawn("spark", size: CGSize(width: 16, height: 4)) { c in
            c.setFillColor(UIColor.white.cgColor)
            c.addPath(UIBezierPath(roundedRect: CGRect(x: 0, y: 0, width: 16, height: 4), cornerRadius: 2).cgPath)
            c.fillPath()
        }
    }

    /// Anneau blanc (onde).
    var ring: SKTexture {
        drawn("ring", size: CGSize(width: 64, height: 64)) { c in
            c.setStrokeColor(UIColor.white.cgColor)
            c.setLineWidth(4)
            c.strokeEllipse(in: CGRect(x: 2, y: 2, width: 60, height: 60))
        }
    }

    /// Aiguille d'argent de l'Éclaireuse (pointe vers la droite) : fine, avec son chas et un reflet.
    var needle: SKTexture {
        drawn("needle", size: CGSize(width: 36, height: 8)) { c in
            c.translateBy(x: 26, y: 4)
            c.setStrokeColor(Ink.ink.withAlphaComponent(0.3).cgColor)
            c.setLineWidth(1.5)
            c.move(to: CGPoint(x: -24, y: 0)); c.addLine(to: CGPoint(x: -9, y: 0)); c.strokePath()
            c.setFillColor(Ink.ink.cgColor)
            c.move(to: CGPoint(x: 10, y: 0)); c.addLine(to: CGPoint(x: -9, y: -2.2)); c.addLine(to: CGPoint(x: -11, y: 0)); c.addLine(to: CGPoint(x: -9, y: 2.2))
            c.closePath(); c.fillPath()
            c.setFillColor(Ink.cut.cgColor)
            c.fillEllipse(in: CGRect(x: -8.3, y: -0.8, width: 3.6, height: 1.6))
        }
    }

    /// Rafale du Moine du vent.
    var gust: SKTexture {
        drawn("gust", size: CGSize(width: 30, height: 20)) { c in
            c.translateBy(x: 20, y: 10)
            c.setStrokeColor(Ink.cut.cgColor)
            c.setLineWidth(3)
            c.setLineCap(.round)
            for i in 0..<2 {
                c.addArc(center: CGPoint(x: CGFloat(-i * 9), y: 0), radius: CGFloat(7 - i * 2), startAngle: -1.1, endAngle: 1.1, clockwise: false)
                c.strokePath()
            }
        }
    }

    /// Braise du Sorcier.
    var ember: SKTexture {
        drawn("ember", size: CGSize(width: 30, height: 14)) { c in
            c.translateBy(x: 22, y: 7)
            c.setFillColor(Ink.ink.withAlphaComponent(0.5).cgColor)
            c.fill(CGRect(x: -16, y: -1, width: 10, height: 2))
            c.setFillColor(Ink.ink.cgColor)
            c.fillEllipse(in: CGRect(x: -6, y: -6, width: 12, height: 12))
            c.setFillColor(Ink.cut.cgColor)
            c.fillEllipse(in: CGRect(x: -4, y: -4, width: 8, height: 8))
        }
    }

    enum OrbMark: String { case plain, spore, rune, elite }

    /// Projectile ennemi : toujours vermillon cerné d'encre, forme découpée au centre selon la source.
    func enemyOrb(radius r: CGFloat, mark: OrbMark) -> SKTexture {
        let s = ceil(r * 2 + 4 + r * 2.4)
        return drawn("orb\(r)\(mark.rawValue)", size: CGSize(width: s * 2, height: s)) { c in
            c.translateBy(x: s, y: s / 2)
            c.setFillColor(Ink.danger.withAlphaComponent(0.3).cgColor)
            c.fillEllipse(in: CGRect(x: -r * 1.3 - r * 1.8, y: -r * 0.7, width: r * 3.6, height: r * 1.4))
            c.setFillColor(Ink.ink.cgColor)
            c.fillEllipse(in: CGRect(x: -(r + 1.5), y: -(r + 1.5), width: (r + 1.5) * 2, height: (r + 1.5) * 2))
            c.setFillColor(Ink.danger.cgColor)
            c.fillEllipse(in: CGRect(x: -(r - 0.5), y: -(r - 0.5), width: (r - 0.5) * 2, height: (r - 0.5) * 2))
            switch mark {
            case .spore:
                c.setFillColor(Ink.cut.cgColor)
                c.fillEllipse(in: CGRect(x: -r * 0.35, y: -r * 0.35, width: r * 0.7, height: r * 0.7))
            case .rune:
                c.setFillColor(Ink.cut.cgColor)
                c.fill(CGRect(x: -1.2, y: -r * 0.5, width: 2.4, height: r))
            case .elite:
                c.setFillColor(Ink.gold.cgColor)
                c.fillEllipse(in: CGRect(x: -r * 0.45, y: -r * 0.45, width: r * 0.9, height: r * 0.9))
            case .plain:
                c.setFillColor(Ink.cut.cgColor)
                c.fillEllipse(in: CGRect(x: -r * 0.25 - r * 0.3, y: -r * 0.25 - r * 0.3, width: r * 0.6, height: r * 0.6))
            }
        }
    }

    /// Flèche du squelette : trait d'encre doublé de vermillon.
    var arrow: SKTexture {
        drawn("arrow", size: CGSize(width: 26, height: 8)) { c in
            c.translateBy(x: 16, y: 4)
            c.setLineCap(.round)
            c.setStrokeColor(Ink.ink.cgColor)
            c.setLineWidth(5)
            c.move(to: CGPoint(x: -12, y: 0)); c.addLine(to: CGPoint(x: 6, y: 0)); c.strokePath()
            c.setStrokeColor(Ink.danger.cgColor)
            c.setLineWidth(2.5)
            c.move(to: CGPoint(x: -12, y: 0)); c.addLine(to: CGPoint(x: 6, y: 0)); c.strokePath()
        }
    }

    /// Hachures diagonales vermillon (repli si l'atlas VFX manque).
    var hatch: SKTexture {
        drawn("hatch", size: CGSize(width: 32, height: 32)) { c in
            c.setStrokeColor(Ink.danger.withAlphaComponent(0.55).cgColor)
            c.setLineWidth(2)
            var k: CGFloat = -32
            while k < 64 {
                c.move(to: CGPoint(x: k, y: 0)); c.addLine(to: CGPoint(x: k - 32, y: 32))
                k += 8
            }
            c.strokePath()
        }
    }

    /// Cœur de soin (repli si l'atlas VFX manque).
    var heart: SKTexture {
        drawn("heart", size: CGSize(width: 18, height: 18)) { c in
            let s: CGFloat = 7, x: CGFloat = 9, y: CGFloat = 9
            let p = UIBezierPath()
            p.move(to: CGPoint(x: x, y: y + s * 0.9))
            p.addCurve(to: CGPoint(x: x, y: y - s * 0.4), controlPoint1: CGPoint(x: x - s * 1.6, y: y - s * 0.1), controlPoint2: CGPoint(x: x - s * 0.8, y: y - s * 1.3))
            p.addCurve(to: CGPoint(x: x, y: y + s * 0.9), controlPoint1: CGPoint(x: x + s * 0.8, y: y - s * 1.3), controlPoint2: CGPoint(x: x + s * 1.6, y: y - s * 0.1))
            c.setFillColor(Ink.jade.cgColor)
            c.addPath(p.cgPath); c.fillPath()
            c.setStrokeColor(Ink.ink.cgColor); c.setLineWidth(1.5)
            c.addPath(p.cgPath); c.strokePath()
        }
    }

    /// Petite flamme découpée (brûlure).
    var flame: SKTexture {
        drawn("flame", size: CGSize(width: 10, height: 12)) { c in
            let h: CGFloat = 5, x: CGFloat = 5, y: CGFloat = 11
            c.setFillColor(Ink.ink.cgColor)
            c.move(to: CGPoint(x: x - h * 0.6, y: y))
            c.addQuadCurve(to: CGPoint(x: x, y: y - h * 2), control: CGPoint(x: x - h * 0.4, y: y - h * 1.2))
            c.addQuadCurve(to: CGPoint(x: x + h * 0.6, y: y), control: CGPoint(x: x + h * 0.4, y: y - h * 1.2))
            c.closePath(); c.fillPath()
            c.setFillColor(Ink.cut.cgColor)
            c.fillEllipse(in: CGRect(x: x - h * 0.2, y: y - h * 0.5 - h * 0.45, width: h * 0.4, height: h * 0.9))
        }
    }
}
