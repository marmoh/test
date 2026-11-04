import SwiftUI

/// Direction artistique « théâtre d'ombres » (`docs/ART.md`) : mêmes jetons que `art/src/palette.ts`
/// et `web/src/style.css`. Papier, encre, vermillon pour l'action, jade, or à la feuille.
/// Ombres portées franches (décalage sans flou), pas de halos ni de dégradés lumineux.
enum Theme {
    static let ink = Color(hex: 0x1B1418)
    static let ink2 = Color(hex: 0x40333A)
    static let ink3 = Color(hex: 0x6B5A5E)
    static let paper = Color(hex: 0xEFE3C6)
    static let paper2 = Color(hex: 0xE2D2AC)
    static let paper3 = Color(hex: 0xCBB68A)
    static let cut = Color(hex: 0xFFF4D6)
    static let vermilion = Color(hex: 0xD8431F)
    static let jade = Color(hex: 0x2B8A74)
    static let goldLeaf = Color(hex: 0xC9A13B)
    static let curtain = Color(hex: 0x2B1317)
    static let curtain2 = Color(hex: 0x4D2229)

    /// Titres : IM Fell English SC (Igino Marini, OFL). Fichier `IMFellEnglishSC-Regular.ttf`
    /// dans `Resources/Fonts`, déclaré dans `UIAppFonts` (phase Mac).
    static func display(_ size: CGFloat, relativeTo style: Font.TextStyle = .title2) -> Font {
        .custom("IMFellEnglishSC-Regular", size: size, relativeTo: style)
    }

    /// Texte : Alegreya Sans (Juan Pablo del Peral, OFL). `AlegreyaSans-Regular/Medium/Bold/ExtraBold/MediumItalic.ttf`.
    static func text(_ size: CGFloat, weight: Font.Weight = .regular, relativeTo style: Font.TextStyle = .body) -> Font {
        .custom("AlegreyaSans-Regular", size: size, relativeTo: style).weight(weight)
    }

    static func note(_ size: CGFloat = 13) -> Font {
        .custom("AlegreyaSans-MediumItalic", size: size, relativeTo: .footnote)
    }
}

extension Color {
    init(hex: UInt32) {
        self.init(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }
}

/// Carte de papier cernée d'encre avec ombre portée franche.
struct PaperCard: ViewModifier {
    var fill: Color = Theme.cut
    var border: Color = Theme.ink
    var shadow: CGFloat = 4

    func body(content: Content) -> some View {
        content
            .background(fill)
            .overlay(Rectangle().strokeBorder(border, lineWidth: 2.5))
            .background(Theme.ink.offset(x: shadow, y: shadow))
    }
}

extension View {
    func paperCard(fill: Color = Theme.cut, border: Color = Theme.ink, shadow: CGFloat = 4) -> some View {
        modifier(PaperCard(fill: fill, border: border, shadow: shadow))
    }
}

/// Bouton principal (vermillon), secondaire (papier) ou gemmes (jade).
struct InkButtonStyle: ButtonStyle {
    enum Kind { case primary, ghost, jade, danger }
    var kind: Kind = .primary

    func makeBody(configuration: Configuration) -> some View {
        let pressed = configuration.isPressed
        configuration.label
            .font(Theme.display(19, relativeTo: .headline))
            .foregroundStyle(kind == .ghost ? Theme.ink : Theme.cut)
            .padding(.vertical, 11)
            .padding(.horizontal, 18)
            .frame(maxWidth: .infinity)
            .background(background)
            .overlay(Rectangle().strokeBorder(Theme.ink, lineWidth: 2.5))
            .background(Theme.ink.offset(x: pressed ? 1 : 4, y: pressed ? 1 : 4))
            .offset(x: pressed ? 3 : 0, y: pressed ? 3 : 0)
    }

    private var background: Color {
        switch kind {
        case .primary, .danger: Theme.vermilion
        case .ghost: Theme.paper
        case .jade: Theme.jade
        }
    }
}

/// Interrupteur carré encre / jade, comme le prototype web.
struct InkToggleStyle: ToggleStyle {
    func makeBody(configuration: Configuration) -> some View {
        Button {
            configuration.isOn.toggle()
        } label: {
            HStack(alignment: .center, spacing: 12) {
                configuration.label
                    .frame(maxWidth: .infinity, alignment: .leading)
                ZStack(alignment: configuration.isOn ? .trailing : .leading) {
                    Rectangle().fill(configuration.isOn ? Theme.jade : Theme.paper3)
                    Rectangle()
                        .fill(configuration.isOn ? Theme.cut : Theme.ink)
                        .frame(width: 18, height: 18)
                        .padding(2)
                }
                .frame(width: 48, height: 26)
                .overlay(Rectangle().strokeBorder(Theme.ink, lineWidth: 2))
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(.isToggle)
        .accessibilityValue(configuration.isOn ? "activé" : "désactivé")
    }
}

/// Titre de section : petites capitales d'encre soulignées d'un filet.
struct SectionTitle: View {
    let text: String
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(text).font(Theme.display(19)).foregroundStyle(Theme.ink)
            Rectangle().fill(Theme.ink).frame(height: 1.5)
        }
        .padding(.top, 18)
        .padding(.bottom, 4)
        .accessibilityAddTraits(.isHeader)
    }
}

/// Fond papier des écrans de menu.
struct PaperBackground: View {
    var body: some View { Theme.paper.ignoresSafeArea() }
}
