import SwiftUI

/// Pré-niveau (§12.2, `preLevel` du web) : objectif, étoiles obtenues, ennemis rencontrés, bonus à équiper
/// (Potion, Parchemin, Égide), JOUER. Une vie n'est retirée qu'en cas de défaite.
struct PreLevelView: View {
    let n: Int
    @Environment(AppModel.self) private var app
    @State private var chosen: Set<BonusKind> = []

    var body: some View {
        let level = app.content?.level(n)
        let info = Formulas.levelInfo(n)
        let boss = level?.bossRoom?.boss
        VStack(spacing: 0) {
            SheetHeader(title: "Niveau \(n)", badge: info.kind == .boss ? "Boss" : info.kind == .hard ? "Difficile" : nil)
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
                                        .accessibilityLabel(Bosses.def(boss.archetype).name)
                                }
                                ForEach(level.enemyTypes, id: \.self) { t in
                                    Puppet(name: t.rawValue, size: 56)
                                        .background(Circle().fill(Theme.cut))
                                        .overlay(Circle().strokeBorder(Theme.ink, lineWidth: 2))
                                        .accessibilityLabel(Bestiary.def(t).name)
                                }
                            }
                            .padding(.horizontal, 20)
                            .padding(.vertical, 4)
                        }
                    }
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
    }

    private func objective(_ level: LevelDef, boss: BossSpec?) -> String {
        var s = "Traverse \(level.rooms.count) salles"
        if let boss { s += " et terrasse \(Bosses.def(boss.archetype).name)" }
        return s + "."
    }

    private func bonusButton(_ b: BonusKind) -> some View {
        let count = app.wallet.bonusCount(b)
        let on = chosen.contains(b)
        return Button {
            app.audio.play(.tap)
            if on { chosen.remove(b) } else if count > 0 { chosen.insert(b) }
        } label: {
            VStack(spacing: 2) {
                InkIcon(name: b.iconName, size: 34)
                Text(b.name).font(Theme.text(14, weight: .bold))
                Text(b.blurb).font(Theme.note(11))
            }
            .foregroundStyle(Theme.ink)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .background(on ? Theme.jade.opacity(0.25) : Theme.cut)
            .overlay(Rectangle().strokeBorder(on ? Theme.jade : Theme.ink, lineWidth: on ? 3 : 2))
            .overlay(alignment: .topTrailing) {
                Text("\(count)").font(Theme.text(12, weight: .heavy)).foregroundStyle(Theme.cut)
                    .frame(minWidth: 20, minHeight: 20).background(Circle().fill(Theme.ink)).offset(x: 6, y: -6)
            }
            .opacity(count > 0 || on ? 1 : 0.45)
        }
        .buttonStyle(.plain)
        .disabled(count == 0 && !on)
        .accessibilityLabel("\(b.name), \(b.blurb), \(count) en stock")
        .accessibilityAddTraits(on ? .isSelected : [])
    }
}
