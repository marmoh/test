import SwiftUI

/// Héros, équipement et talents (§12.6, `heroesSheet` du web) : trois onglets.
/// - Héros : mécanique, phrase d'accroche, pouvoirs signature, Choisir ou Essayer (héros verrouillé, DECISIONS #77),
///   Parure du Dragon pour les membres de l'Ordre, apparences du pass.
/// - Équipement : poupée, inventaire, fiche d'objet (`GearView.swift`, DECISIONS #75).
/// - Talents : talents permanents achetés avec l'or (désactivés en tournoi).
@MainActor
struct HeroesView: View {
    enum Tab: Hashable { case heroes, gear, talents }

    @Environment(AppModel.self) private var app
    @State private var tab: Tab
    /// Fiche d'objet ouverte (uid).
    @State private var openItem: Int?

    init(tab: Tab = .heroes) {
        _tab = State(initialValue: tab)
    }

    var body: some View {
        VStack(spacing: 0) {
            SheetHeader(title: "Héros")
            PaperTabs<Tab>(tabs: [(.heroes, "Héros"), (.gear, "Équipement"), (.talents, "Talents")], selection: $tab)
                .padding(.horizontal, 20)
                .padding(.bottom, 12)
                .onChange(of: tab) { _, _ in app.audio.play(.tap) }
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    switch tab {
                    case .heroes: heroesPanel
                    case .gear: GearPanel { openItem = $0 }
                    case .talents: talentsPanel
                    }
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 30)
            }
            .id(tab)
        }
        .background(PaperBackground())
        .overlay {
            if let uid = openItem {
                ItemDetailView(uid: uid) { withAnimation(.easeOut(duration: 0.15)) { openItem = nil } }
                    .transition(.opacity)
            }
        }
        .animation(.easeOut(duration: 0.15), value: openItem)
        .toast(Binding(get: { app.toast }, set: { app.toast = $0 }))
    }

    // MARK: héros

    private var heroesPanel: some View {
        VStack(alignment: .leading, spacing: 12) {
            ForEach(HeroID.allCases, id: \.self) { heroRow($0) }
            if app.subscribed {
                Toggle(isOn: Binding(get: { app.wallet.snapshot.dragonSkin }, set: { app.wallet.setDragonSkin($0) })) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Parure du Dragon").font(Theme.text(16, weight: .bold))
                        Text("Apparence exclusive de l’Ordre du Dragon").font(Theme.note(12)).foregroundStyle(Theme.ink2)
                    }
                    .foregroundStyle(Theme.ink)
                }
                .toggleStyle(InkToggleStyle())
                .padding(.vertical, 6)
            } else {
                HStack(spacing: 6) {
                    InkIcon(name: "ui_crown", size: 18, fallback: "crown.fill")
                    Text("Parure du Dragon : apparence réservée aux membres de l’Ordre du Dragon.")
                        .font(Theme.note(12)).foregroundStyle(Theme.ink2)
                }
                .padding(.vertical, 4)
            }
            SectionTitle(text: "Apparences")
            HStack(spacing: 8) {
                skinChip(nil)
                ForEach(SkinID.allCases, id: \.self) { skinChip($0) }
            }
            Text("Les apparences se gagnent sur la piste premium du pass de saison. Purement cosmétiques.")
                .font(Theme.note(12)).foregroundStyle(Theme.ink2)
        }
        .padding(.top, 2)
    }

    private func heroRow(_ id: HeroID) -> some View {
        let owned = app.meta.heroUnlocked(id)
        let selected = app.currentHero == id
        return HStack(alignment: .center, spacing: 8) {
            Puppet(name: id.rawValue, size: 84, silhouette: owned ? nil : Theme.ink.opacity(0.8))
            VStack(alignment: .leading, spacing: 3) {
                Text(id.title).font(Theme.display(19))
                Text(id.mechanicText).font(Theme.text(12, weight: .heavy)).foregroundStyle(Theme.cut)
                    .padding(.horizontal, 7).background(Theme.jade).rotationEffect(.degrees(-1.5))
                Text(id.pitchText).font(Theme.note(13)).foregroundStyle(Theme.ink2)
                    .fixedSize(horizontal: false, vertical: true)
                HStack(spacing: 4) {
                    ForEach(HeroUnlocks.signaturePowers(id), id: \.self) { p in
                        InkIcon(name: "power_\(p.rawValue)", size: 20, fallback: "sparkles")
                            .padding(2)
                            .background(Theme.paper)
                            .overlay(Rectangle().strokeBorder(Theme.ink, lineWidth: 1.5))
                            .accessibilityLabel(p.title)
                    }
                }
                .padding(.top, 2)
                if !owned {
                    Text(id.unlockText).font(Theme.text(12, weight: .heavy)).foregroundStyle(Theme.vermilion)
                }
            }
            Spacer(minLength: 0)
            Group {
                if owned && selected {
                    Text("Choisi", comment: "Héros sélectionné").font(Theme.display(15)).foregroundStyle(Theme.vermilion)
                        .padding(.horizontal, 8).padding(.vertical, 1)
                        .overlay(Rectangle().strokeBorder(Theme.vermilion, lineWidth: 2))
                        .rotationEffect(.degrees(-6))
                } else if owned {
                    Button("Choisir") {
                        app.audio.play(.star)
                        app.selectHero(id)
                    }
                    .buttonStyle(InkButtonStyle(kind: .primary, compact: true))
                } else {
                    Button("Essayer") { app.startTrial(id) }
                        .buttonStyle(InkButtonStyle(kind: .ghost, compact: true))
                        .accessibilityHint(Text("Un niveau déjà connu, sans vie ni récompense", comment: "VoiceOver : ce que fait l’essai d’un héros"))
                }
            }
            .fixedSize()
        }
        .foregroundStyle(Theme.ink)
        .padding(.vertical, 6).padding(.leading, 4).padding(.trailing, 10)
        .background(Theme.cut)
        .overlay(alignment: .leading) {
            if selected { Rectangle().fill(Theme.vermilion).frame(width: 6) }
        }
        .overlay(Rectangle().strokeBorder(selected ? Theme.vermilion : Theme.ink, lineWidth: 2.5))
        .background(Theme.ink.offset(x: 4, y: 4))
        .rotationEffect(.degrees(selected ? -0.6 : 0))
        .accessibilityElement(children: .contain)
        .accessibilityLabel([id.title, id.mechanicText,
                             owned ? nil : String(localized: "verrouillé", comment: "VoiceOver : héros pas encore débloqué"),
                             selected ? String(localized: "choisi", comment: "VoiceOver : héros sélectionné") : nil]
            .compactMap { $0 }.joined(separator: ", "))
    }

    // MARK: talents

    private var talentsPanel: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Les talents valent pour tous les héros et toute la partie. Désactivés en tournoi.")
                .font(Theme.note(12)).foregroundStyle(Theme.ink2)
            ForEach(TalentKind.allCases) { talentRow($0) }
            HStack(spacing: 4) {
                Text("Or disponible :").font(Theme.note(14))
                Text(Fmt.int(app.wallet.gold)).font(Theme.text(16, weight: .heavy))
                InkIcon(name: "ui_coin", size: 18, fallback: "circle.fill")
            }
            .foregroundStyle(Theme.ink)
            .padding(.top, 10)
        }
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
                    Text("\(k.perRank) par rang", comment: "Talent : gain par rang").font(Theme.note(12)).foregroundStyle(Theme.ink2)
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
                        Text(Fmt.int(cost))
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
                Text(s?.title ?? String(localized: "Aucune", comment: "Pas d’apparence (féminin : une apparence)")).font(Theme.text(11, weight: .bold)).lineLimit(2).multilineTextAlignment(.center).minimumScaleFactor(0.7)
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
        .accessibilityLabel((s?.title ?? String(localized: "Aucune apparence"))
                            + (owned ? "" : ", " + String(localized: "à gagner dans le pass", comment: "VoiceOver : apparence pas encore gagnée")))
    }
}
