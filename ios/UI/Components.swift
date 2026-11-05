import SpriteKit
import SwiftUI

/// Image tirée des atlas SpriteKit (icônes, portraits) pour les écrans SwiftUI.
@MainActor
enum AtlasImages {
    private static var cache: [String: UIImage] = [:]

    static func image(_ atlas: SKTextureAtlas, _ name: String) -> UIImage? {
        let key = "\(ObjectIdentifier(atlas).hashValue)/\(name)"
        if let i = cache[key] { return i }
        guard let tex = TextureBank.shared.texture(atlas, name) else { return nil }
        let cg = tex.cgImage()
        let pts = tex.size()
        let img = UIImage(cgImage: cg, scale: pts.width > 0 ? CGFloat(cg.width) / pts.width : 2, orientation: .up)
        cache[key] = img
        return img
    }

    static func icon(_ name: String) -> UIImage? { image(TextureBank.shared.icons, name) }

    /// Variante claire d'une icône pour les fonds d'encre (`PAPER_UI` du web, barre de navigation) :
    /// l'encre devient papier, le papier et les teintes d'accent deviennent encre.
    static func paperIcon(_ name: String) -> UIImage? {
        let key = "paper/\(name)"
        if let i = cache[key] { return i }
        guard let src = icon(name), let cg = src.cgImage else { return nil }
        let w = cg.width, h = cg.height
        var px = [UInt8](repeating: 0, count: w * h * 4)
        let space = CGColorSpaceCreateDeviceRGB()
        let info = CGImageAlphaInfo.premultipliedLast.rawValue
        let out: CGImage? = px.withUnsafeMutableBytes { buf -> CGImage? in
            guard let ctx = CGContext(data: buf.baseAddress, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
                                      space: space, bitmapInfo: info) else { return nil }
            ctx.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
            let p = buf.bindMemory(to: UInt8.self)
            // papier #efe3c6, encre #1b1418 (prémultipliés par l'alpha du pixel)
            for i in stride(from: 0, to: w * h * 4, by: 4) {
                let a = Int(p[i + 3])
                guard a > 0 else { continue }
                // luminance (×1000, prémultipliée) < 0,3 → pixel d'encre
                let dark = 299 * Int(p[i]) + 587 * Int(p[i + 1]) + 114 * Int(p[i + 2]) < 300 * a
                let (r, g, b) = dark ? (0xEF, 0xE3, 0xC6) : (0x1B, 0x14, 0x18)
                p[i] = UInt8(r * a / 255); p[i + 1] = UInt8(g * a / 255); p[i + 2] = UInt8(b * a / 255)
            }
            return ctx.makeImage()
        }
        guard let out else { return nil }
        let img = UIImage(cgImage: out, scale: src.scale, orientation: .up)
        cache[key] = img
        return img
    }

    /// Portrait d'un personnage (première image de repos).
    static func portrait(_ name: String) -> UIImage? {
        let b = TextureBank.shared
        let atlas = HeroID(rawValue: name) != nil ? b.hero : BossArchetype(rawValue: name) != nil ? b.bosses : b.enemies
        return image(atlas, "\(name)_idle_00")
    }
}

/// Icône d'encre de `Icons.atlas` (`ui_star`, `power_flame`…), avec repli sur un symbole système.
@MainActor
struct InkIcon: View {
    let name: String
    var size: CGFloat = 22
    var fallback: String = "circle.fill"

    var body: some View {
        if let img = AtlasImages.icon(name) {
            Image(uiImage: img).resizable().interpolation(.high).scaledToFit().frame(width: size, height: size)
        } else {
            Image(systemName: fallback).resizable().scaledToFit().frame(width: size * 0.8, height: size * 0.8).foregroundStyle(Theme.ink)
        }
    }
}

/// Portrait de marionnette (atlas des personnages).
@MainActor
struct Puppet: View {
    let name: String
    var size: CGFloat = 64
    var flip = false

    var body: some View {
        Group {
            if let img = AtlasImages.portrait(name) {
                Image(uiImage: img).resizable().interpolation(.high).scaledToFit()
            } else {
                Circle().fill(Theme.ink)
            }
        }
        .frame(width: size, height: size)
        .scaleEffect(x: flip ? -1 : 1, y: 1)
        .accessibilityHidden(true)
    }
}

/// Pastille de la barre du haut (vies, étoiles, or, gemmes).
@MainActor
struct Chip<Content: View>: View {
    var action: (() -> Void)?
    @ViewBuilder var content: () -> Content

    var body: some View {
        let label = HStack(spacing: 4) { content() }
            .font(Theme.text(15, weight: .heavy))
            .foregroundStyle(Theme.ink)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(Theme.cut)
            .overlay(Rectangle().strokeBorder(Theme.ink, lineWidth: 2))
            .background(Theme.ink.offset(x: 2, y: 2))
        if let action {
            Button(action: action) { label }.buttonStyle(.plain)
        } else {
            label
        }
    }
}

/// Message bref en bas de l'écran.
@MainActor
struct ToastModifier: ViewModifier {
    @Binding var text: String?

    func body(content: Content) -> some View {
        content.overlay(alignment: .bottom) {
            if let text {
                Text(text)
                    .font(Theme.text(15, weight: .bold))
                    .foregroundStyle(Theme.paper)
                    .multilineTextAlignment(.center)
                    .padding(.vertical, 8).padding(.horizontal, 16)
                    .background(Theme.ink)
                    .rotationEffect(.degrees(-1))
                    .padding(.bottom, 96)
                    .padding(.horizontal, 24)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .task(id: text) { @MainActor in
                        try? await Task.sleep(for: .seconds(2.4))
                        withAnimation { self.text = nil }
                    }
                    .allowsHitTesting(false)
            }
        }
        .animation(.easeOut(duration: 0.2), value: text)
    }
}

extension View {
    func toast(_ text: Binding<String?>) -> some View { modifier(ToastModifier(text: text)) }
}

/// En-tête de feuille : titre en petites capitales et bouton de fermeture.
@MainActor
struct SheetHeader: View {
    let title: String
    var badge: String?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title).font(Theme.display(30)).foregroundStyle(Theme.ink)
            if let badge {
                Text(badge)
                    .font(Theme.text(13, weight: .heavy))
                    .foregroundStyle(Theme.cut)
                    .padding(.horizontal, 8).padding(.vertical, 2)
                    .background(Theme.vermilion)
                    .rotationEffect(.degrees(-4))
            }
            Spacer()
            Button { dismiss() } label: {
                Text("×").font(Theme.text(24)).frame(width: 34, height: 34)
                    .background(Theme.paper)
                    .overlay(Rectangle().strokeBorder(Theme.ink, lineWidth: 2))
            }
            .buttonStyle(.plain)
            .foregroundStyle(Theme.ink)
            .accessibilityLabel("Fermer")
        }
        .padding(.horizontal, 20)
        .padding(.top, 18)
        .padding(.bottom, 6)
    }
}

/// Étoiles d'un niveau (pleines / vides).
@MainActor
struct StarsRow: View {
    let count: Int
    var size: CGFloat = 26

    var body: some View {
        HStack(spacing: 4) {
            ForEach(0..<3, id: \.self) { i in
                InkIcon(name: i < count ? "ui_star" : "ui_starEmpty", size: size, fallback: i < count ? "star.fill" : "star")
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(count) étoile\(count > 1 ? "s" : "") sur 3")
    }
}

extension Reward {
    var iconName: String {
        switch self {
        case .gold: "ui_coin"
        case .gems: "ui_gem"
        case .bonus(let k, _): k.iconName
        case .lives: "ui_heart"
        case .skin: "ui_crown"
        }
    }
}

extension BonusKind {
    var iconName: String {
        switch self {
        case .potion: "ui_potion"
        case .scroll: "ui_scroll"
        case .aegis: "ui_aegis"
        }
    }
}

extension Rarity {
    var label: String {
        switch self {
        case .common: "Commun"
        case .rare: "Rare"
        case .epic: "Épique"
        }
    }

    var color: Color {
        switch self {
        case .common: Color(hex: 0x7D6F5F)
        case .rare: Theme.jade
        case .epic: Theme.goldLeaf
        }
    }
}
