import SwiftUI

/// Quêtes du jour (DECISIONS #76) et bestiaire : port de `web/src/journal.ts`.

// MARK: - quêtes du jour

@MainActor
struct QuestsView: View {
    @Environment(AppModel.self) private var app

    var body: some View {
        let meta = app.meta
        let qs = meta.quests
        VStack(spacing: 0) {
            SheetHeader(title: "Quêtes du jour")
            ScrollView {
                VStack(spacing: 12) {
                    TimelineView(.periodic(from: .now, by: 30)) { ctx in
                        Text("Nouvelles quêtes dans \(Fmt.clock(MetaDay.secondsToMidnight(ctx.date)))", comment: "Quêtes : temps avant minuit")
                            .font(Theme.note(13)).foregroundStyle(Theme.ink2)
                    }
                    ForEach(qs) { q in questRow(q) }
                    bonusRow(allDone: meta.allQuestsClaimed, claimed: meta.questBonusClaimed)
                    Text("Les quêtes changent chaque jour à minuit. Elles comptent tes combats, gagnés ou non.")
                        .font(Theme.note(12)).foregroundStyle(Theme.ink2)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 30)
            }
        }
        .background(PaperBackground())
        .presentationDetents([.medium, .large])
        .toast(Binding(get: { app.toast }, set: { app.toast = $0 }))
    }

    private func questRow(_ q: QuestDef) -> some View {
        let p = app.meta.questProgress(q)
        let done = p >= q.goal
        let claimed = app.meta.questClaimed(q.id)
        return HStack(alignment: .center, spacing: 10) {
            VStack(alignment: .leading, spacing: 4) {
                Text(q.text).font(Theme.text(14.5, weight: .bold)).fixedSize(horizontal: false, vertical: true)
                GeometryReader { g in
                    ZStack(alignment: .leading) {
                        Rectangle().fill(Theme.paper2)
                        Rectangle().fill(Theme.jade).frame(width: g.size.width * CGFloat(p) / CGFloat(max(1, q.goal)))
                    }
                }
                .frame(height: 8)
                .overlay(Rectangle().strokeBorder(Theme.ink, lineWidth: 1.5))
                Text(verbatim: "\(Fmt.int(p)) / \(Fmt.int(q.goal))").font(Theme.text(12)).foregroundStyle(Theme.ink2)
            }
            VStack(alignment: .trailing, spacing: 6) {
                RewardLine(reward: q.reward)
                if claimed {
                    Text("Reçu", comment: "Quête : récompense déjà réclamée").font(Theme.display(14)).foregroundStyle(Theme.jade)
                        .padding(.horizontal, 6)
                        .overlay(Rectangle().strokeBorder(Theme.jade, lineWidth: 2))
                        .rotationEffect(.degrees(-5))
                } else {
                    Button("Réclamer") {
                        if app.meta.claimQuest(q.id) != nil {
                            app.audio.play(.loot)
                            app.show(String(localized: "Récompense reçue ✓"))
                        }
                    }
                    .buttonStyle(InkButtonStyle(kind: done ? .primary : .ghost, compact: true))
                    .fixedSize()
                    .disabled(!done)
                    .opacity(done ? 1 : 0.5)
                }
            }
        }
        .foregroundStyle(Theme.ink)
        .padding(10)
        .background(Theme.cut)
        .overlay(Rectangle().strokeBorder(done ? Theme.jade : Theme.ink, lineWidth: 2))
        .background(Theme.ink.offset(x: claimed ? 0 : 3, y: claimed ? 0 : 3))
        .opacity(claimed ? 0.6 : 1)
        .accessibilityElement(children: .contain)
    }

    private func bonusRow(allDone: Bool, claimed: Bool) -> some View {
        HStack(spacing: 10) {
            Group {
                if let img = AtlasImages.paperIcon("ui_chest") {
                    Image(uiImage: img).resizable().scaledToFit()
                } else {
                    Image(systemName: "shippingbox.fill").resizable().scaledToFit().foregroundStyle(Theme.paper)
                }
            }
            .frame(width: 36, height: 36)
            VStack(alignment: .leading, spacing: 2) {
                Text("Les trois quêtes du jour").font(Theme.display(17)).foregroundStyle(Theme.paper)
                HStack(spacing: 4) {
                    Text("Bonus :", comment: "Quêtes : récompense des trois quêtes (suivie des montants)").font(Theme.text(12))
                    RewardLine(reward: Quests.bonus, light: true)
                }
                .foregroundStyle(Theme.paper3)
            }
            Spacer(minLength: 4)
            if claimed {
                Text("Reçu", comment: "Quête : récompense déjà réclamée").font(Theme.display(14)).foregroundStyle(Theme.jade)
            } else {
                Button("Ouvrir") {
                    if app.meta.claimQuestBonus() {
                        app.audio.play(.loot)
                        app.show(String(localized: "+\(Quests.bonus.gems) gemmes · +\(Quests.bonus.shards) éclats", comment: "Bonus des trois quêtes reçu"))
                    }
                }
                .buttonStyle(InkButtonStyle(kind: .primary, compact: true))
                .fixedSize()
                .disabled(!allDone)
                .opacity(allDone ? 1 : 0.45)
            }
        }
        .padding(12)
        .background(Theme.ink)
        .overlay(Rectangle().strokeBorder(allDone && !claimed ? Theme.goldLeaf : Theme.ink, lineWidth: 2))
    }
}

/// Récompense d'une quête : or, gemmes, éclats avec leurs icônes.
@MainActor
struct RewardLine: View {
    let reward: QuestReward
    /// Sur fond d'encre : icônes et texte clairs.
    var light = false

    var body: some View {
        HStack(spacing: 4) {
            if reward.gold > 0 { part("ui_coin", reward.gold) }
            if reward.gems > 0 { part("ui_gem", reward.gems) }
            if reward.shards > 0 { part("gear_shard", reward.shards) }
        }
        .font(Theme.text(13, weight: .heavy))
        .foregroundStyle(light ? Theme.paper : Theme.ink)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
    }

    private func part(_ icon: String, _ n: Int) -> some View {
        HStack(spacing: 2) {
            InkIcon(name: icon, size: 16, fallback: "circle.fill")
            Text(Fmt.int(n))
        }
    }

    private var label: String {
        var parts: [String] = []
        if reward.gold > 0 { parts.append(Reward.gold(reward.gold).text) }
        if reward.gems > 0 { parts.append(Reward.gems(reward.gems).text) }
        if reward.shards > 0 { parts.append(String(localized: "\(reward.shards) éclats", comment: "Récompense : quantité d’éclats d’amélioration")) }
        return parts.joined(separator: ", ")
    }
}

// MARK: - bestiaire

@MainActor
struct BestiaryView: View {
    @Environment(AppModel.self) private var app

    var body: some View {
        let book = app.meta.bestiary
        VStack(spacing: 0) {
            SheetHeader(title: "Bestiaire")
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 10) {
                    Text("\(BestiaryBook.met(book)) / \(BestiaryBook.total) créatures rencontrées", comment: "Bestiaire : créatures vaincues sur le total")
                        .font(Theme.note(13)).foregroundStyle(Theme.ink2)
                        .frame(maxWidth: .infinity)
                    SectionTitle(text: "Ennemis")
                    ForEach(BestiaryBook.enemies, id: \.self) { t in
                        beast(key: t.rawValue, name: t.title, what: t.loreWhat, tip: t.loreTip,
                              hint: String(localized: "Chapitre \(BestiaryBook.chapter(of: t))"), count: book[t.rawValue] ?? 0, boss: false)
                    }
                    SectionTitle(text: "Boss")
                    ForEach(Array(BestiaryBook.bosses.enumerated()), id: \.offset) { i, b in
                        beast(key: b.rawValue, name: b.title, what: b.loreWhat, tip: b.loreTip,
                              hint: String(localized: "Fin du royaume \(KingdomTheme.all[i].name)", comment: "Bestiaire : boss pas encore vaincu (nom du royaume)"),
                              count: book[b.rawValue] ?? 0, boss: true)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 30)
            }
        }
        .background(PaperBackground())
    }

    private func beast(key: String, name: String, what: String, tip: String, hint: String, count: Int, boss: Bool) -> some View {
        let known = count > 0
        return HStack(spacing: 10) {
            Puppet(name: key, size: boss ? 70 : 64, silhouette: known ? nil : Theme.ink.opacity(0.55))
                .frame(width: 70, height: 64)
                .clipped()
            VStack(alignment: .leading, spacing: 2) {
                Text(known ? name : "???").font(Theme.display(17))
                Text(known ? what : hint).font(Theme.text(12.5)).foregroundStyle(Theme.ink2)
                    .fixedSize(horizontal: false, vertical: true)
                if known {
                    Text(tip).font(Theme.note(12)).foregroundStyle(Theme.jade)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            Spacer(minLength: 4)
            if known { Text(verbatim: "×\(Fmt.int(count))").font(Theme.text(13, weight: .heavy)) }
        }
        .foregroundStyle(Theme.ink)
        .padding(8)
        .background(known ? Theme.cut : Theme.paper2)
        .overlay(Rectangle().strokeBorder(Theme.ink, lineWidth: 2))
        .accessibilityElement(children: .combine)
        .accessibilityLabel(known ? "\(name). \(what) \(tip) ×\(count)"
                                  : String(localized: "Créature inconnue, \(hint)", comment: "VoiceOver : créature pas encore vaincue"))
    }
}
