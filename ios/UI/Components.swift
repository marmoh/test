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

    /// Portrait d'un personnage (première image de repos).
    static func portrait(_ name: String) -> UIImage? {
        let b = TextureBank.shared
        let atlas = HeroID(rawValue: name) != nil ? b.hero : BossArchetype(rawValue: name) != nil ? b.bosses : b.enemies
        return image(atlas, "\(name)_idle_00")
    }
}

/// Icône d'encre de `Icons.atlas` (`ui_star`, `power_flame`…), avec repli sur un symbole système.
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
                    .task(id: text) {
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
        case .bonus(let k, _): k == .potion ? "ui_potion" : k == .scroll ? "ui_scroll" : "ui_aegis"
        case .threadSkin: "power_longThread"
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
