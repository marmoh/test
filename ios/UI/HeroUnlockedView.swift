import SwiftUI

/// « Nouveau héros ! » (DECISIONS #77) : présenté après la victoire qui débloque un héros, avec sa mécanique ;
/// « Le choisir » le sélectionne aussitôt.
@MainActor
struct HeroUnlockedView: View {
    let hero: HeroID
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 12) {
            Text("Nouveau héros !").font(Theme.note(17)).foregroundStyle(Theme.ink2)
                .padding(.top, 28)
            Text(hero.title).font(Theme.display(36)).foregroundStyle(Theme.ink).multilineTextAlignment(.center)
            Puppet(name: hero.rawValue, size: 150)
                .background(Circle().fill(Theme.cut).frame(width: 150, height: 150))
                .overlay(Circle().strokeBorder(Theme.goldLeaf, lineWidth: 3).frame(width: 150, height: 150))
            Text(hero.mechanicText).font(Theme.text(15, weight: .heavy)).foregroundStyle(Theme.cut)
                .padding(.horizontal, 12).padding(.vertical, 1)
                .background(Theme.jade).rotationEffect(.degrees(-1.5))
            Text(hero.pitchText).font(Theme.text(16)).foregroundStyle(Theme.ink)
                .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
                .padding(.horizontal, 24)
            HStack(spacing: 6) {
                ForEach(HeroUnlocks.signaturePowers(hero), id: \.self) { p in
                    InkIcon(name: "power_\(p.rawValue)", size: 28, fallback: "sparkles")
                        .padding(3)
                        .background(Theme.paper)
                        .overlay(Rectangle().strokeBorder(Theme.ink, lineWidth: 1.5))
                        .accessibilityLabel(p.title)
                }
            }
            Spacer(minLength: 8)
            HStack(spacing: 10) {
                Button("Plus tard") { dismiss() }
                    .buttonStyle(InkButtonStyle(kind: .ghost))
                Button("Le choisir") { app.pickUnlockedHero(hero) }
                    .buttonStyle(InkButtonStyle(kind: .primary))
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 24)
        }
        .frame(maxWidth: .infinity)
        .background(PaperBackground())
        .presentationDetents([.large])
    }
}
