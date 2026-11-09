import SwiftUI

/// Pré-niveau (§12.2, `preLevel` du web) : objectif, étoiles obtenues, ennemis rencontrés (le nouvel ennemi de la
/// salle tutoriel est présenté), héros (un toucher passe au suivant), butin de la première victoire, bonus à équiper
/// (Potion, Parchemin, Égide), JOUER. Une vie n'est retirée qu'en cas de défaite.
@MainActor
struct PreLevelView: View {
    let n: Int
    @Environment(AppModel.self) private var app
    @State private var chosen: Set<BonusKind> = []

    var body: some View {
        let level = app.content?.level(n)
        let info = Formulas.levelInfo(n)
        let boss = level?.bossRoom?.boss
        // ennemi présenté par ce niveau (salle tutoriel du début de chapitre)
        let fresh = info.position == 1 ? Bestiary.newEnemy(at: info.chapter) : nil
        VStack(spacing: 0) {
            SheetHeader(title: "Niveau \(n)", badge: badge(info.kind))
            ScrollView {
                VStack(spacing: 14) {
                    StarsRow(count: app.progress.stars(n), size: 34)
                    if let level {
                        Text(objective(level, boss: boss))
                            .font(Theme.text(16))
                            .foregroundStyle(Theme.ink)
                            .multilineTextAlignment(.center)
                        // ennemis rencontrés
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                if let boss {
                                    Puppet(name: boss.archetype.rawValue, size: 84)
                                        .background(Circle().fill(KingdomTheme.of(kingdom: info.kingdom).lightColor))
                                        .overlay(Circle().strokeBorder(Theme.vermilion, lineWidth: 3))
                                        .accessibilityLabel(boss.archetype.title)
                                }
                                ForEach(level.enemyTypes, id: \.self) { t in
                                    Puppet(name: t.rawValue, size: 56)
                                        .background(Circle().fill(Theme.cut))
                                        .overlay(Circle().strokeBorder(t == fresh ? Theme.vermilion : Theme.ink, lineWidth: t == fresh ? 3 : 2))
                                        .accessibilityLabel(t.title)
                                }
                            }
                            .padding(.horizontal, 20)
                            .padding(.vertical, 4)
                        }
                    }
                    if let fresh { newFoe(fresh).padding(.horizontal, 20) }
                    HStack(alignment: .top, spacing: 8) {
                        heroChip
                        LootPreview(n: n)
                    }
                    .padding(.horizontal, 20)
                    HStack(spacing: 10) {
                        ForEach(BonusKind.allCases, id: \.self) { b in bonusButton(b) }
                    }
                    .padding(.horizontal, 20)
                    Button("Jouer") {
                        app.audio.play(.tap)
                        app.play(level: n, bonuses: chosen)
                    }
                    .buttonStyle(InkButtonStyle(kind: .primary))
                    .padding(.horizontal, 20)
                    .disabled(level == nil)
                    Text("Une vie n’est retirée qu’en cas de défaite.")
                        .font(Theme.note(13))
                        .foregroundStyle(Theme.ink2)
                }
                .padding(.bottom, 24)
            }
        }
        .background(PaperBackground())
        .presentationDetents([.medium, .large])
        .toast(Binding(get: { app.toast }, set: { app.toast = $0 }))
    }

    private func badge(_ kind: LevelKind) -> LocalizedStringKey? {
        switch kind {
        case .boss: "Boss"
        case .hard: "Difficile"
        default: nil
        }
    }

    private func objective(_ level: LevelDef, boss: BossSpec?) -> String {
        if let boss {
            return String(localized: "Traverse \(level.rooms.count) salles et terrasse \(boss.archetype.title).",
                          comment: "Objectif d’un niveau de boss : nombre de salles, nom du boss")
        }
        return String(localized: "Traverse \(level.rooms.count) salles.", comment: "Objectif d’un niveau : nombre de salles")
    }

    /// Nouvel ennemi : nom, comportement et astuce (`LORE` du web).
    private func newFoe(_ t: MinionType) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(t.title).font(Theme.display(17)).foregroundStyle(Theme.paper)
            Text(verbatim: "\(t.loreWhat) \(t.loreTip)").font(Theme.note(13)).foregroundStyle(Theme.paper3)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 8).padding(.leading, 12).padding(.trailing, 10)
        .background(Theme.ink)
        .overlay(alignment: .leading) { Rectangle().fill(Theme.vermilion).frame(width: 6) }
        .overlay(alignment: .topTrailing) {
            Text("Nouveau", comment: "Pré-niveau : ennemi présenté pour la première fois").font(Theme.text(11, weight: .heavy)).foregroundStyle(Theme.cut)
                .padding(.horizontal, 8)
                .background(Theme.vermilion)
                .rotationEffect(.degrees(3))
                .offset(x: -10, y: -9)
        }
        .accessibilityElement(children: .combine)
    }

    /// Héros joué : un toucher passe au héros débloqué suivant.
    private var heroChip: some View {
        let h = app.currentHero
        return Button {
            app.cycleHero()
        } label: {
            HStack(spacing: 6) {
                Puppet(name: h.rawValue, size: 42)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Héros").font(Theme.text(10.5, weight: .heavy)).foregroundStyle(Theme.ink2).textCase(.uppercase)
                    Text(h.title).font(Theme.text(14, weight: .bold)).lineLimit(1).minimumScaleFactor(0.75)
                    Text(h.mechanicText).font(Theme.text(11.5, weight: .heavy)).foregroundStyle(Theme.jade).lineLimit(1).minimumScaleFactor(0.75)
                }
                Spacer(minLength: 0)
                Text(verbatim: "⇄").font(Theme.text(18, weight: .bold)).foregroundStyle(Theme.vermilion)
            }
            .foregroundStyle(Theme.ink)
            .padding(.horizontal, 8).padding(.vertical, 6)
            .frame(maxWidth: .infinity, minHeight: 58, alignment: .leading)
            .background(Theme.cut)
            .overlay(Rectangle().strokeBorder(Theme.ink, lineWidth: 2))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(String(localized: "Héros : \(h.title), \(h.mechanicText)", comment: "VoiceOver : héros joué au pré-niveau"))
        .accessibilityHint(Text("Changer de héros", comment: "VoiceOver : un toucher passe au héros suivant"))
    }

    private func bonusButton(_ b: BonusKind) -> some View {
        let count = app.wallet.bonusCount(b)
        let on = chosen.contains(b)
        let price = ShopPrices.bonus(b)
        return Button {
            app.audio.play(.tap)
            if on { chosen.remove(b) } else if count > 0 { chosen.insert(b) } else if app.buyBonus(b) { chosen.insert(b) }
        } label: {
            VStack(spacing: 2) {
                InkIcon(name: b.iconName, size: 34)
                Text(b.title).font(Theme.text(14, weight: .bold))
                Text(b.blurbText).font(Theme.note(11))
            }
            .foregroundStyle(Theme.ink)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .background(on ? Theme.jade.opacity(0.25) : Theme.cut)
            .overlay(Rectangle().strokeBorder(on ? Theme.jade : Theme.ink, lineWidth: on ? 3 : 2))
            .overlay(alignment: .topTrailing) {
                if count > 0 || on {
                    Text(verbatim: "\(count)").font(Theme.text(12, weight: .heavy)).foregroundStyle(Theme.cut)
                        .frame(minWidth: 20, minHeight: 20).background(Circle().fill(Theme.ink)).offset(x: 6, y: -6)
                } else {
                    HStack(spacing: 2) {
                        InkIcon(name: price.currency == .gold ? "ui_coin" : "ui_gem", size: 13)
                        Text(Fmt.int(price.amount)).font(Theme.text(12, weight: .heavy))
                    }
                    .foregroundStyle(Theme.ink)
                    .padding(.horizontal, 5).padding(.vertical, 1)
                    .background(Theme.paper)
                    .overlay(Rectangle().strokeBorder(Theme.ink, lineWidth: 1.5))
                    .offset(x: 6, y: -8)
                }
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(b.title), \(b.blurbText), " + (count > 0 ? String(localized: "\(count) en stock", comment: "VoiceOver : bonus possédés")
                                                                  : price.currency == .gold ? String(localized: "à acheter : \(price.amount) or", comment: "VoiceOver : prix d’un bonus en or")
                                                                  : String(localized: "à acheter : \(price.amount) gemmes", comment: "VoiceOver : prix d’un bonus en gemmes")))
        .accessibilityAddTraits(on ? .isSelected : [])
    }
}
