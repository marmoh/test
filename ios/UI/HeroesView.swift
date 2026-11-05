import SwiftUI

/// Héros et talents (§12.6, `heroesSheet` du web) : trois héros (débloqués ou non), Parure du Dragon pour les
/// membres de l'Ordre, talents permanents achetés avec l'or (désactivés en tournoi), apparence du fil.
@MainActor
struct HeroesView: View {
    @Environment(AppModel.self) private var app

    var body: some View {
        VStack(spacing: 0) {
            SheetHeader(title: "Héros")
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    HStack(spacing: 8) {
                        ForEach(HeroID.allCases, id: \.self) { heroCard($0) }
                    }
                    if app.subscribed {
                        Toggle(isOn: Binding(get: { app.wallet.snapshot.dragonSkin }, set: { app.wallet.setDragonSkin($0) })) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Parure du Dragon").font(Theme.text(16, weight: .bold))
                                Text("Apparence exclusive de l’Ordre du Dragon").font(Theme.note(12)).foregroundStyle(Theme.ink2)
                            }
                            .foregroundStyle(Theme.ink)
                        }
                        .toggleStyle(InkToggleStyle())
                        .padding(.vertical, 12)
                    } else {
                        HStack(spacing: 6) {
                            InkIcon(name: "ui_crown", size: 18, fallback: "crown.fill")
                            Text("Parure du Dragon : apparence réservée aux membres de l’Ordre du Dragon.")
                                .font(Theme.note(12)).foregroundStyle(Theme.ink2)
                        }
                        .padding(.vertical, 10)
                    }

                    SectionTitle(text: "Talents permanents")
                    Text("Désactivés en tournoi.").font(Theme.note(12)).foregroundStyle(Theme.ink2)
                    ForEach(TalentKind.allCases) { talentRow($0) }
                    HStack(spacing: 4) {
                        Text("Or disponible :").font(Theme.note(14))
                        Text(verbatim: "\(app.wallet.gold)").font(Theme.text(16, weight: .heavy))
                        InkIcon(name: "ui_coin", size: 18, fallback: "circle.fill")
                    }
                    .foregroundStyle(Theme.ink)
                    .padding(.top, 10)

                    SectionTitle(text: "Apparences")
                    HStack(spacing: 8) {
                        skinChip(nil)
                        ForEach(SkinID.allCases, id: \.self) { skinChip($0) }
                    }
                    Text("Les apparences se gagnent sur la piste premium du pass de saison. Purement cosmétiques.")
                        .font(Theme.note(12)).foregroundStyle(Theme.ink2).padding(.top, 6)
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 30)
            }
        }
        .background(PaperBackground())
        .toast(Binding(get: { app.toast }, set: { app.toast = $0 }))
    }

    private func heroCard(_ id: HeroID) -> some View {
        let owned = app.wallet.owns(id)
        let selected = app.currentHero == id
        return Button {
            app.audio.play(.tap)
            if owned { app.progress.select(id) } else { app.show(HeroUnlock.label(id)) }
        } label: {
            VStack(spacing: 4) {
                Puppet(name: id.rawValue, size: 84)
                    .opacity(owned ? 1 : 0.35)
                    .overlay(alignment: .bottomTrailing) {
                        if !owned { InkIcon(name: "ui_lock", size: 22, fallback: "lock.fill") }
                    }
                Text(Heroes.def(id).name).font(Theme.display(14)).multilineTextAlignment(.center)
                Text(owned ? HeroUnlock.blurb(id) : HeroUnlock.label(id))
                    .font(Theme.note(10.5)).foregroundStyle(Theme.ink2).multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .foregroundStyle(Theme.ink)
            .padding(6)
            .frame(maxWidth: .infinity, minHeight: 190, alignment: .top)
            .background(selected ? Theme.jade.opacity(0.18) : Theme.cut)
            .overlay(Rectangle().strokeBorder(selected ? Theme.jade : Theme.ink, lineWidth: selected ? 3 : 2))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(Heroes.def(id).name)\(owned ? "" : ", verrouillé")\(selected ? ", choisi" : "")")
    }

    private func talentRow(_ k: TalentKind) -> some View {
        let r = app.progress.rank(k)
        let maxed = r >= TalentK.maxRank
        let cost = Formulas.talentCost(r)
        return HStack(spacing: 10) {
            InkIcon(name: k.icon, size: 30)
            VStack(alignment: .leading, spacing: 3) {
                HStack {
                    Text(k.name).font(Theme.text(16, weight: .bold))
                    Text("\(k.perRank) par rang").font(Theme.note(12)).foregroundStyle(Theme.ink2)
                }
                HStack(spacing: 3) {
                    ForEach(0..<TalentK.maxRank, id: \.self) { i in
                        Rectangle().fill(i < r ? Theme.goldLeaf : Theme.paper3).frame(width: 14, height: 8)
                            .overlay(Rectangle().strokeBorder(Theme.ink, lineWidth: 1))
                    }
                }
            }
            Spacer()
            Button {
                if app.progress.buyTalent(k, wallet: app.wallet) { app.audio.play(.star) }
            } label: {
                if maxed { Text("Max") } else {
                    HStack(spacing: 3) {
                        InkIcon(name: "ui_coin", size: 16, fallback: "circle.fill")
                        Text("\(cost)")
                    }
                }
            }
            .buttonStyle(InkButtonStyle(kind: .ghost))
            .fixedSize()
            .disabled(maxed || app.wallet.gold < cost)
            .opacity(maxed || app.wallet.gold < cost ? 0.5 : 1)
        }
        .foregroundStyle(Theme.ink)
        .padding(.vertical, 8)
        .overlay(alignment: .bottom) { DashedRule() }
        .accessibilityElement(children: .combine)
    }

    private func skinChip(_ s: SkinID?) -> some View {
        let owned = s == nil || app.progress.skins.contains(s!)
        let on = app.progress.skin == s
        return Button {
            app.audio.play(.tap)
            app.progress.wear(s)
        } label: {
            VStack(spacing: 4) {
                InkIcon(name: s == nil ? "ui_starEmpty" : "ui_crown", size: 26, fallback: "sparkles")
                Text(s?.name ?? "Aucune").font(Theme.text(11, weight: .bold)).lineLimit(2).multilineTextAlignment(.center).minimumScaleFactor(0.7)
            }
            .foregroundStyle(Theme.ink)
            .padding(6)
            .frame(maxWidth: .infinity, minHeight: 70)
            .background(on ? Theme.jade.opacity(0.18) : Theme.cut)
            .overlay(Rectangle().strokeBorder(on ? Theme.jade : Theme.ink, lineWidth: on ? 2.5 : 1.5))
            .opacity(owned ? 1 : 0.35)
        }
        .buttonStyle(.plain)
        .disabled(!owned)
        .accessibilityLabel((s?.name ?? "Aucune apparence") + (owned ? "" : ", à gagner dans le pass"))
    }
}
