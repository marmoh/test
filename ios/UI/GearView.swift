import SwiftUI

/// Équipement (DECISIONS #75, port de `web/src/gearui.ts`) : poupée à quatre emplacements, résumé des bonus,
/// inventaire, fiche d'objet (Équiper / Retirer, Améliorer, Recycler avec confirmation), carte de butin de la
/// victoire et ligne de butin du pré-niveau.

// MARK: - panneau de l'onglet Équipement

@MainActor
struct GearPanel: View {
    /// Ouvre la fiche d'un objet (uid), affichée au-dessus de toute la feuille.
    let onOpen: (Int) -> Void
    @Environment(AppModel.self) private var app

    var body: some View {
        let meta = app.meta
        let items = meta.gear.sortedItems
        VStack(alignment: .leading, spacing: 0) {
            doll
            summary(meta.gearStats)
                .frame(maxWidth: .infinity)
                .padding(.top, 10)
            HStack(alignment: .firstTextBaseline) {
                Text("Inventaire").font(Theme.display(19))
                Text(items.count > 1 ? String(localized: "\(items.count) objets", comment: "Inventaire : nombre d’objets (plusieurs)")
                                     : String(localized: "\(items.count) objet", comment: "Inventaire : nombre d’objets (0 ou 1)"))
                    .font(Theme.note(12)).foregroundStyle(Theme.ink2)
                Spacer()
                HStack(spacing: 3) {
                    ShardCount(n: meta.shards, size: 18)
                    Text("éclats", comment: "Éclats d’amélioration (après le nombre)").font(Theme.text(13))
                }
            }
            .foregroundStyle(Theme.ink)
            .padding(.top, 18)
            Rectangle().fill(Theme.ink).frame(height: 1.5).padding(.bottom, 10)
            if items.isEmpty {
                Text("Gagne des niveaux marqués d’un objet sur la carte pour remplir ton inventaire. Le premier arrive au niveau 3.")
                    .font(Theme.note(13)).foregroundStyle(Theme.ink2)
            } else {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 58, maximum: 64), spacing: 14)], alignment: .leading, spacing: 16) {
                    ForEach(items, id: \.uid) { it in
                        Button { app.audio.play(.tap); onOpen(it.uid) } label: {
                            ItemTile(item: it, worn: meta.isEquipped(it.uid), better: !meta.isEquipped(it.uid) && meta.isUpgradeOver(it))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.leading, 6)
            }
            Text("Les objets se trouvent à la première victoire de certains niveaux (annoncés d’avance) ; chaque victoire rapporte des éclats pour les améliorer.")
                .font(Theme.note(12)).foregroundStyle(Theme.ink2)
                .padding(.top, 14)
        }
    }

    /// Poupée : deux emplacements de chaque côté du héros choisi.
    private var doll: some View {
        HStack(spacing: 4) {
            VStack(spacing: 10) { slot(.needle); slot(.mask) }.frame(maxWidth: .infinity)
            Puppet(name: app.currentHero.rawValue, size: 96)
                .frame(width: 108, height: 108)
                .background(Circle().fill(Theme.paper))
                .overlay(Circle().strokeBorder(Theme.goldLeaf, lineWidth: 3))
                .clipShape(Circle())
            VStack(spacing: 10) { slot(.cloak); slot(.charm) }.frame(maxWidth: .infinity)
        }
        .padding(.vertical, 12).padding(.horizontal, 6)
        .background(Theme.ink)
        .overlay(Rectangle().strokeBorder(Theme.goldLeaf, lineWidth: 1.5).padding(5))
        .background(Theme.ink.opacity(0.4).offset(x: 4, y: 4))
    }

    private func slot(_ s: GearSlot) -> some View {
        VStack(spacing: 5) {
            if let it = app.meta.wornItem(in: s) {
                Button { app.audio.play(.tap); onOpen(it.uid) } label: { ItemTile(item: it, worn: false) }
                    .buttonStyle(.plain)
            } else {
                Group {
                    if let img = AtlasImages.paperIcon("gear_slot\(s.rawValue.prefix(1).uppercased())\(s.rawValue.dropFirst())") {
                        Image(uiImage: img).resizable().scaledToFit().opacity(0.5)
                    } else {
                        Image(systemName: "square.dashed").resizable().scaledToFit().foregroundStyle(Theme.paper3)
                    }
                }
                .frame(width: 40, height: 40)
                .frame(width: 58, height: 58)
                .overlay(Rectangle().strokeBorder(Theme.paper3, style: StrokeStyle(lineWidth: 2, dash: [5, 4])))
                .accessibilityLabel(String(localized: "\(s.title) : emplacement vide", comment: "VoiceOver : emplacement d’équipement sans objet"))
            }
            Text(s.title.uppercased()).font(Theme.text(11, weight: .heavy)).foregroundStyle(Theme.paper3)
        }
    }

    /// « +4,8 % dégâts · +2,5 % pv… » (`statsSummary`).
    private func summary(_ g: GearStats) -> some View {
        let keys: [GearStat] = [.dmg, .hp, .rate, .sig, .crit, .speed, .dodge]
        let parts = keys.filter { g[$0] > 0.0001 }
        return Group {
            if parts.isEmpty {
                Text("Aucun objet porté").font(Theme.note(13)).foregroundStyle(Theme.ink2)
            } else {
                Text(parts.map { "\(Fmt.pct(g[$0])) \($0.title.localizedLowercase)" }.joined(separator: "   "))
                    .font(Theme.text(13, weight: .bold)).foregroundStyle(Theme.ink)
                    .multilineTextAlignment(.center)
            }
        }
    }
}

// MARK: - fiche d'un objet

@MainActor
struct ItemDetailView: View {
    let uid: Int
    let onClose: () -> Void
    @Environment(AppModel.self) private var app
    /// Premier toucher sur « Recycler » : on demande confirmation.
    @State private var salvageArmed = false

    var body: some View {
        ZStack {
            Theme.ink.opacity(0.55).ignoresSafeArea()
                .onTapGesture { onClose() }
            if let it = app.meta.item(uid), let def = Gear.byID[it.id] {
                card(it, def)
                    .padding(.horizontal, 24)
            }
        }
        .onChange(of: app.meta.item(uid) == nil) { _, gone in if gone { onClose() } }
    }

    private func card(_ it: GearItem, _ def: GearDef) -> some View {
        let meta = app.meta
        let worn = meta.isEquipped(uid)
        let cur = meta.wornItem(in: def.slot)
        let curVal = cur.flatMap { c in Gear.byID[c.id].map { Gear.mainValue($0, c.level) } } ?? 0
        let val = Gear.mainValue(def, it.level)
        let cost = Gear.upgradeCost(def, it.level)
        let next: Double? = it.level < Gear.maxLevel(def.rarity) ? Gear.mainValue(def, it.level + 1) : nil
        let main = Gear.slotMain(def.slot)
        return VStack(spacing: 7) {
            HStack {
                Spacer()
                Button(action: onClose) {
                    Text(verbatim: "×").font(Theme.text(22)).frame(width: 32, height: 32)
                        .background(Theme.paper).overlay(Rectangle().strokeBorder(Theme.ink, lineWidth: 2))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Fermer")
            }
            .overlay {
                Text(verbatim: "\(def.rarity.title) · \(def.slot.title)".uppercased())
                    .font(Theme.text(12, weight: .heavy)).foregroundStyle(Theme.cut)
                    .padding(.horizontal, 10).padding(.vertical, 1)
                    .background(def.rarity.tagColor)
            }
            GearIcon(id: def.id, size: 84)
            Text(def.title).font(Theme.display(22)).multilineTextAlignment(.center)
            Text("Niveau \(it.level) / \(Gear.maxLevel(def.rarity))", comment: "Fiche d’objet : niveau actuel et niveau maximal")
                .font(Theme.text(13)).foregroundStyle(Theme.ink2)
            VStack(spacing: 2) {
                HStack(spacing: 4) {
                    Text(main.line(val))
                    if let next { Text(verbatim: "→ \(Fmt.pct(next))").foregroundStyle(Theme.jade) }
                }
                if let sub = def.sub { Text(sub.stat.line(sub.value)) }
            }
            .font(Theme.text(14.5, weight: .bold))
            if !worn, cur != nil {
                let up = val >= curVal
                let delta = Swift.abs(val - curVal) * 100
                let amount = (up ? "+" : "−") + delta.formatted(.number.precision(.fractionLength(1)))
                Text(verbatim: (up ? "▲ " : "▼ ") + String(localized: "\(main.title) \(amount) pts par rapport à l’objet porté",
                                                           comment: "Fiche d’objet : écart de statistique principale avec l’objet porté (statistique, écart signé)"))
                    .font(Theme.text(13, weight: .bold))
                    .foregroundStyle(up ? Theme.jade : Theme.vermilion)
                    .multilineTextAlignment(.center)
            }
            Text(def.loreText).font(Theme.note(12.5)).foregroundStyle(Theme.ink2).multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
            HStack(spacing: 10) {
                if worn {
                    Button("Retirer") {
                        app.audio.play(.tap)
                        meta.unequip(def.slot)
                        onClose()
                    }
                    .buttonStyle(InkButtonStyle(kind: .ghost, compact: true))
                    .fixedSize()
                } else {
                    Button("Équiper") {
                        app.audio.play(.star)
                        meta.equip(uid)
                        onClose()
                    }
                    .buttonStyle(InkButtonStyle(kind: .primary, compact: true))
                    .fixedSize()
                }
                if let cost {
                    let affordable = app.wallet.gold >= cost.gold && meta.shards >= cost.shards
                    Button {
                        upgrade(def)
                    } label: {
                        HStack(spacing: 6) {
                            Text("Améliorer")
                            HStack(spacing: 3) {
                                InkIcon(name: "ui_coin", size: 15, fallback: "circle.fill")
                                Text(Fmt.int(cost.gold))
                                GearIcon(id: "shard", size: 15)
                                Text(Fmt.int(cost.shards))
                            }
                            .font(Theme.text(13, weight: .heavy))
                            .foregroundStyle(Theme.ink)
                            .padding(.horizontal, 5).padding(.vertical, 1)
                            .background(Theme.cut)
                        }
                    }
                    .buttonStyle(InkButtonStyle(kind: .jade, compact: true))
                    .opacity(affordable ? 1 : 0.55)
                    .accessibilityLabel(String(localized: "Améliorer : \(cost.gold) or et \(cost.shards) éclats", comment: "VoiceOver : coût d’amélioration d’un objet"))
                } else {
                    Text("Niveau maximal").font(Theme.text(13, weight: .heavy)).foregroundStyle(Theme.goldLeaf)
                }
            }
            .padding(.top, 4)
            Button {
                salvage(def)
            } label: {
                Text(salvageArmed ? String(localized: "Toucher encore pour recycler \(def.title)", comment: "Confirmation du recyclage d’un objet")
                                  : String(localized: "Recycler (+\(Gear.salvageValue(def, it.level)) éclats)", comment: "Recycler un objet : éclats rendus"))
                    .font(Theme.text(13, weight: .bold)).underline()
                    .foregroundStyle(salvageArmed ? Theme.vermilion : Theme.ink)
            }
            .buttonStyle(.plain)
            .padding(.top, 2)
        }
        .foregroundStyle(Theme.ink)
        .padding(16)
        .frame(maxWidth: 340)
        .background(def.rarity == .legendary ? def.rarity.fill : Theme.paper)
        .overlay(Rectangle().strokeBorder(def.rarity.color, lineWidth: def.rarity == .legendary ? 4 : 2).padding(6))
        .overlay(Rectangle().strokeBorder(Theme.ink, lineWidth: 3))
        .background(Theme.ink.opacity(0.5).offset(x: 6, y: 6))
    }

    private func upgrade(_ def: GearDef) {
        switch app.meta.upgrade(uid) {
        case .ok:
            app.audio.play(.loot)
            app.show(String(localized: "\(def.title) : niveau \(app.meta.item(uid)?.level ?? 0)", comment: "Objet amélioré : nom, nouveau niveau"))
        case .gold: app.show(String(localized: "Pas assez d’or"))
        case .shards: app.show(String(localized: "Pas assez d’éclats"))
        case .max: app.show(String(localized: "Niveau maximal"))
        }
    }

    private func salvage(_ def: GearDef) {
        guard salvageArmed else {
            app.audio.play(.tap)
            salvageArmed = true
            return
        }
        let v = app.meta.salvage(uid)
        app.audio.play(.tap)
        app.show(String(localized: "+\(v) éclats", comment: "Éclats reçus"))
        onClose()
    }
}

// MARK: - butin de la victoire

/// Objet obtenu (carte qui se retourne) et éclats, ou éclats seuls d'un niveau rejoué (`lootBlock`).
@MainActor
struct LootBlock: View {
    let loot: Loot
    @Environment(AppModel.self) private var app
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @State private var flipped = false

    var body: some View {
        if let item = loot.item, let def = Gear.byID[item.id] {
            HStack(spacing: 12) {
                ZStack {
                    // dos de la carte : lune découpée
                    Rectangle().fill(Theme.ink)
                        .overlay(Circle().fill(Theme.cut).frame(width: 40).overlay(Circle().fill(Theme.ink).frame(width: 34).offset(x: 9, y: -6)))
                        .opacity(flipped ? 0 : 1)
                    ItemCard(def: def, level: item.level, compact: true)
                        .opacity(flipped ? 1 : 0)
                }
                .frame(width: 132, height: 172)
                .rotation3DEffect(.degrees(flipped ? 0 : 180), axis: (x: 0, y: 1, z: 0), perspective: 0.6)
                VStack(alignment: .leading, spacing: 8) {
                    Text("Nouvel objet !").font(Theme.display(19))
                    ShardCount(n: loot.shards, size: 16, plus: true)
                        .accessibilityLabel(String(localized: "+\(loot.shards) éclats", comment: "Éclats reçus"))
                    if app.meta.isEquipped(item.uid) {
                        Text("Équipé").font(Theme.note(13)).foregroundStyle(Theme.jade)
                    } else if app.meta.isUpgradeOver(item) {
                        Button("Équiper") { app.equipLoot(item.uid) }
                            .buttonStyle(InkButtonStyle(kind: .primary, compact: true))
                            .fixedSize()
                    }
                }
                .foregroundStyle(Theme.ink)
                Spacer(minLength: 0)
            }
            .task { @MainActor in
                let reduce = systemReduceMotion || app.settings.reduceMotion
                try? await Task.sleep(for: .milliseconds(reduce ? 100 : 1200))
                withAnimation(reduce ? .easeOut(duration: 0.1) : .spring(response: 0.6, dampingFraction: 0.7)) { flipped = true }
                app.audio.play(.loot)
            }
        } else {
            HStack(spacing: 10) {
                ShardCount(n: loot.shards, size: 18, plus: true)
                    .accessibilityLabel(String(localized: "+\(loot.shards) éclats", comment: "Éclats reçus"))
                if !loot.first { Text("Niveau rejoué").font(Theme.note(12)).foregroundStyle(Theme.ink2) }
            }
        }
    }
}

// MARK: - butin annoncé au pré-niveau

/// « Butin de la première victoire », ou les éclats d'une victoire (`lootPreview`).
@MainActor
struct LootPreview: View {
    let n: Int
    @Environment(AppModel.self) private var app

    var body: some View {
        let won = app.progress.stars(n) > 0
        let l = Gear.levelLoot(n)
        let def = won ? nil : l.flatMap { Gear.byID[$0.id] }
        HStack(spacing: 6) {
            if let def {
                GearIcon(id: def.id, size: 38)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Butin de la première victoire").font(Theme.text(10.5, weight: .heavy)).foregroundStyle(Theme.ink2)
                        .textCase(.uppercase)
                    Text(def.title).font(Theme.text(14, weight: .bold)).lineLimit(2).minimumScaleFactor(0.8)
                    Text(def.rarity.title).font(Theme.text(11.5, weight: .heavy))
                        .foregroundStyle(def.rarity == .common ? Theme.ink2 : def.rarity == .rare ? Theme.jade : Color(hex: 0x8A6A14))
                }
            } else {
                GearIcon(id: "shard", size: 38)
                Text(won ? String(localized: "Niveau déjà gagné : rejoue-le pour des éclats")
                         : String(localized: "Première victoire : des éclats d’amélioration"))
                    .font(Theme.note(12.5)).foregroundStyle(Theme.ink2)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .foregroundStyle(Theme.ink)
        .padding(.horizontal, 8).padding(.vertical, 6)
        .frame(maxWidth: .infinity, minHeight: 58, alignment: .leading)
        .background(def.map { $0.rarity.fill } ?? Theme.cut)
        .overlay(Rectangle().strokeBorder(def.map { $0.rarity == .common ? Theme.ink : $0.rarity.color } ?? Theme.ink, lineWidth: 2))
        .accessibilityElement(children: .combine)
    }
}
