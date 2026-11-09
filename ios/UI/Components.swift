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

/// Portrait de marionnette (atlas des personnages). `silhouette` : ombre unie (bestiaire, héros verrouillé).
@MainActor
struct Puppet: View {
    let name: String
    var size: CGFloat = 64
    var flip = false
    var silhouette: Color?

    var body: some View {
        Group {
            if let img = AtlasImages.portrait(name) {
                if let silhouette {
                    Image(uiImage: img).renderingMode(.template).resizable().interpolation(.high).scaledToFit()
                        .foregroundStyle(silhouette)
                } else {
                    Image(uiImage: img).resizable().interpolation(.high).scaledToFit()
                }
            } else {
                Circle().fill(silhouette ?? Theme.ink)
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
    /// Texte déjà traduit (`String(localized:)`).
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
    let title: LocalizedStringKey
    var badge: LocalizedStringKey?
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
                Text(verbatim: "×").font(Theme.text(24)).frame(width: 34, height: 34)
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
        .accessibilityLabel("\(count) étoiles sur 3")
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
        case .common: String(localized: "Commun", comment: "Rareté d’un pouvoir")
        case .rare: String(localized: "Rare", comment: "Rareté d’un pouvoir")
        case .epic: String(localized: "Épique", comment: "Rareté d’un pouvoir")
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

extension GearRarity {
    /// Couleur du cadre (`--rc` du web) : encre pâle, jade, or à la feuille.
    var color: Color {
        switch self {
        case .common: Theme.ink3
        case .rare: Theme.jade
        case .epic, .legendary: Theme.goldLeaf
        }
    }

    /// Fond des objets épiques et légendaires (papier doré).
    var fill: Color {
        switch self {
        case .common, .rare: Theme.cut
        case .epic, .legendary: Color(hex: 0xF6E7BD)
        }
    }

    /// Bandeau de rareté : encre claire pour les communs.
    var tagColor: Color { self == .common ? Theme.ink2 : color }
}

/// Icône d'un objet d'équipement (`gear_<id>` de `Icons.atlas`) ; `shard` pour les éclats.
@MainActor
struct GearIcon: View {
    let id: String
    var size: CGFloat = 40

    var body: some View {
        InkIcon(name: "gear_\(id)", size: size, fallback: id == "shard" ? "sparkle" : "shield.fill")
    }
}

/// Éclats d'amélioration : icône et nombre.
@MainActor
struct ShardCount: View {
    let n: Int
    var size: CGFloat = 16
    var plus = false

    var body: some View {
        HStack(spacing: 3) {
            GearIcon(id: "shard", size: size)
            Text(verbatim: (plus ? "+" : "") + Fmt.int(n)).font(Theme.text(size * 0.9, weight: .heavy))
        }
        .foregroundStyle(Theme.ink)
    }
}

/// Vignette d'objet (cadre selon la rareté, niveau, porté, meilleur que l'objet porté) : `itemTile` du web.
@MainActor
struct ItemTile: View {
    let item: GearItem
    var worn = false
    var better = false
    var size: CGFloat = 58

    var body: some View {
        let def = Gear.byID[item.id]
        let rarity = def?.rarity ?? .common
        ZStack {
            Rectangle().fill(rarity.fill)
            GearIcon(id: item.id, size: size * 0.76)
        }
        .frame(width: size, height: size)
        .overlay(Rectangle().strokeBorder(rarity.color, lineWidth: 2.5))
        .overlay {
            if rarity == .legendary { Rectangle().strokeBorder(Theme.goldLeaf, lineWidth: 2).padding(-4) }
        }
        .background(Theme.ink.offset(x: 3, y: 3))
        .overlay(alignment: .topLeading) {
            if worn {
                Rectangle().fill(Theme.vermilion).frame(width: 9, height: 9)
                    .overlay(Rectangle().strokeBorder(Theme.ink, lineWidth: 1.5)).offset(x: 4, y: 4)
            } else if better {
                Text(verbatim: "▲").font(Theme.text(11, weight: .heavy)).foregroundStyle(Theme.cut)
                    .padding(.horizontal, 3).background(Theme.jade)
                    .overlay(Rectangle().strokeBorder(Theme.ink, lineWidth: 1.5)).offset(x: -6, y: -7)
            }
        }
        .overlay(alignment: .bottomTrailing) {
            Text(verbatim: "\(item.level)").font(Theme.text(12, weight: .heavy)).foregroundStyle(Theme.paper)
                .frame(minWidth: 20).padding(.horizontal, 3)
                .background(Theme.ink)
                .overlay(Rectangle().strokeBorder(rarity.color, lineWidth: 1.5))
                .offset(x: 6, y: 6)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(ItemTile.label(item, worn: worn, better: better))
    }

    /// « Épingle de corbeau, Rare, niveau 3, porté » (VoiceOver).
    static func label(_ item: GearItem, worn: Bool = false, better: Bool = false) -> String {
        guard let def = Gear.byID[item.id] else { return item.id }
        var parts = [def.title, def.rarity.title, String(localized: "niveau \(item.level)", comment: "VoiceOver : niveau d’un objet")]
        if worn { parts.append(String(localized: "porté", comment: "VoiceOver : objet équipé")) }
        if better { parts.append(String(localized: "meilleur que l’objet porté", comment: "VoiceOver : objet plus fort que celui équipé")) }
        return parts.joined(separator: ", ")
    }
}

/// Fiche d'un objet de catalogue (butin annoncé, étal, carte de victoire) : `itemCard` du web.
@MainActor
struct ItemCard: View {
    let def: GearDef
    let level: Int
    var compact = false

    var body: some View {
        VStack(spacing: compact ? 3 : 6) {
            Text(verbatim: "\(def.rarity.title) · \(def.slot.title)".uppercased())
                .font(Theme.text(compact ? 9.5 : 12, weight: .heavy))
                .foregroundStyle(Theme.cut)
                .lineLimit(2).multilineTextAlignment(.center).minimumScaleFactor(0.8)
                .padding(.horizontal, compact ? 5 : 10).padding(.vertical, 1)
                .background(def.rarity.tagColor)
            GearIcon(id: def.id, size: compact ? 48 : 64)
            Text(def.title).font(Theme.display(compact ? 15 : 19)).multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
            VStack(spacing: 1) {
                Text(Gear.slotMain(def.slot).line(Gear.mainValue(def, level)))
                if let sub = def.sub { Text(sub.stat.line(sub.value)) }
            }
            .font(Theme.text(compact ? 11.5 : 13.5, weight: .bold))
            if !compact {
                Text(def.loreText).font(Theme.note(12)).foregroundStyle(Theme.ink2).multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .foregroundStyle(Theme.ink)
        .padding(compact ? 8 : 14)
        .frame(maxWidth: .infinity)
        .background(def.rarity == .legendary ? def.rarity.fill : Theme.paper)
        .overlay(Rectangle().strokeBorder(def.rarity.color, lineWidth: def.rarity == .legendary ? 4 : 2).padding(5))
        .overlay(Rectangle().strokeBorder(Theme.ink, lineWidth: 3))
        .background(Theme.ink.opacity(0.5).offset(x: 5, y: 5))
        .accessibilityElement(children: .combine)
    }
}

/// Onglets de papier (Héros / Équipement / Talents) : `.tabs` du web.
@MainActor
struct PaperTabs<Tab: Hashable>: View {
    let tabs: [(Tab, LocalizedStringKey)]
    @Binding var selection: Tab

    var body: some View {
        HStack(spacing: 0) {
            ForEach(Array(tabs.enumerated()), id: \.offset) { i, t in
                let on = t.0 == selection
                Button {
                    selection = t.0
                } label: {
                    Text(t.1).font(Theme.display(17)).lineLimit(1).minimumScaleFactor(0.7)
                        .foregroundStyle(on ? Theme.paper : Theme.ink2)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                        .background(on ? Theme.ink : Theme.paper2)
                }
                .buttonStyle(.plain)
                .overlay(alignment: .leading) {
                    if i > 0 { Rectangle().fill(Theme.ink).frame(width: 2) }
                }
                .accessibilityAddTraits(on ? [.isSelected, .isButton] : .isButton)
            }
        }
        .overlay(Rectangle().strokeBorder(Theme.ink, lineWidth: 2.5))
        .background(Theme.ink.offset(x: 3, y: 3))
    }
}
