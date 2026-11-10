import StoreKit
import SwiftUI

/// Boutique (§11, `shopSheet` du web) : offre de départ (une seule fois), Ordre du Dragon, gemmes (StoreKit 2),
/// dépenses en gemmes et en or (vies, Potion, Égide). Aucun objet aléatoire ; aucune publicité ici.
@MainActor
struct ShopView: View {
    @Environment(AppModel.self) private var app
    @State private var busy: ProductID?
    @State private var showDragon = false

    var body: some View {
        VStack(spacing: 0) {
            SheetHeader(title: "Boutique")
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    starter
                    dragon
                    passOffer
                    SectionTitle(text: "Gemmes")
                    HStack(spacing: 8) {
                        ForEach(Array(ProductID.gemPacks.enumerated()), id: \.offset) { i, id in gemPack(id, rank: i + 1) }
                    }
                    SectionTitle(text: "Avec tes gemmes et ton or")
                    spendRow(icon: "ui_heart", title: Text("5 vies", comment: "Boutique : recharge des 5 vies"), priceIcon: "ui_gem", price: ShopPrices.livesRefillGems) {
                        if app.lives.lives >= LivesState.max { return app.show(String(localized: "Tes vies sont au maximum.")) }
                        app.show(app.lives.refill(using: app.wallet) ? String(localized: "Vies remplies ✓") : String(localized: "Pas assez de gemmes"))
                    }
                    ForEach(BonusKind.allCases, id: \.self) { k in
                        let price = ShopPrices.bonus(k)
                        spendRow(icon: k.iconName, title: Text(verbatim: "\(k.title) (\(app.wallet.bonusCount(k)))"), priceIcon: price.currency == .gold ? "ui_coin" : "ui_gem", price: price.amount) {
                            if app.buyBonus(k) { app.show(String(localized: "C’est fait ✓")) }
                        }
                    }
                    Text(AdConfig.enabled ? "Paiements sécurisés par l’App Store. Aucun objet aléatoire. Publicité seulement si tu la demandes, contre une vie." as LocalizedStringKey
                                          : "Paiements sécurisés par l’App Store. Aucun objet aléatoire. Aucune publicité.")
                        .font(Theme.note(12)).foregroundStyle(Theme.ink2).padding(.top, 8)
                    Button("Restaurer les achats") {
                        Task {
                            let ok = await app.store.restore()
                            app.show(ok ? String(localized: "Achats restaurés") : (app.store.lastError ?? String(localized: "Restauration impossible")))
                        }
                    }
                    .font(Theme.text(14, weight: .bold))
                    .foregroundStyle(Theme.ink)
                    .underline()
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 30)
            }
        }
        .background(PaperBackground())
        .toast(Binding(get: { app.toast }, set: { app.toast = $0 }))
        .sheet(isPresented: $showDragon) {
            DragonView(context: .shop, store: app.store, wallet: app.wallet)
        }
    }

    /// Prix de l'App Store, ou prix de repli en euros tant que les produits ne sont pas chargés.
    private func price(_ id: ProductID, fallback: Decimal) -> String {
        app.store.product(id)?.displayPrice ?? Fmt.euros(fallback)
    }

    private func buy(_ id: ProductID) {
        guard busy == nil else { return }
        busy = id
        Task {
            let r = await app.store.purchase(id)
            busy = nil
            switch r {
            case .purchased:
                app.audio.play(.star)
                app.show(String(localized: "Merci ! Achat crédité ✓"))
            case .pending: app.show(String(localized: "Achat en attente de validation"))
            case .cancelled: break
            case .failed(let m): app.show(m)
            }
        }
    }

    private var starter: some View {
        let owned = app.wallet.ownsStarterPack
        return HStack(spacing: 10) {
            Puppet(name: "windMonk", size: 64)
            VStack(alignment: .leading, spacing: 2) {
                Text("Offre de départ").font(Theme.display(18))
                Text("\(StarterPack.gems) gemmes · \(HeroID.windMonk.title) · 5 bonus", comment: "Contenu de l’offre de départ : gemmes, héros, bonus").font(Theme.text(12.5)).foregroundStyle(Theme.ink2)
            }
            .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 4)
            Button(owned ? String(localized: "Acquise", comment: "Offre de départ déjà achetée") : price(.starterPack, fallback: 2.99)) { buy(.starterPack) }
                .buttonStyle(InkButtonStyle(kind: .primary, compact: true))
                .fixedSize()
                .disabled(owned || busy != nil)
                .opacity(owned ? 0.5 : 1)
                .padding(.top, 34)  // sous le ruban du coin
        }
        .foregroundStyle(Theme.ink)
        .padding(12)
        .background(Theme.cut)
        // ruban « Une seule fois » en travers du coin (`.offer.starter .ribbon` du web)
        .overlay(alignment: .topTrailing) {
            Text("Une seule fois")
                .font(Theme.text(10.5, weight: .heavy))
                .foregroundStyle(Theme.cut)
                .padding(.vertical, 2)
                .frame(width: 150)
                .background(Theme.vermilion)
                .rotationEffect(.degrees(35))
                .offset(x: 35, y: 18)
        }
        .clipped()
        .overlay(Rectangle().strokeBorder(Theme.ink, lineWidth: 2.5))
        .background(Theme.ink.offset(x: 4, y: 4))
        .padding(.top, 6)
    }

    /// Ordre du Dragon : carte d'encre, texte papier, essai en or (`.offer.dragon` du web).
    private var dragon: some View {
        HStack(spacing: 10) {
            Group {
                if let img = AtlasImages.paperIcon("ui_crown") {
                    Image(uiImage: img).resizable().scaledToFit()
                } else {
                    Image(systemName: "crown.fill").resizable().scaledToFit().foregroundStyle(Theme.paper)
                }
            }
            .frame(width: 42, height: 42)
            VStack(alignment: .leading, spacing: 2) {
                Text("Ordre du Dragon").font(Theme.display(18)).foregroundStyle(Theme.paper)
                Text("Vies illimitées · \(DragonPerks.weeklyGems) gemmes/semaine · +25 % or · apparence exclusive", comment: "Avantages de l’Ordre du Dragon (carte de la boutique)")
                    .font(Theme.text(12.5)).foregroundStyle(Theme.paper3)
                Text(dragonPriceLine)
                    .font(Theme.note(12.5)).foregroundStyle(Theme.goldLeaf)
                    .padding(.top, 3)
            }
            // textes sur plusieurs lignes (l'anglais et l'espagnol sont plus longs) : sans ça, SwiftUI les tronque
            .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 4)
            Button(app.subscribed ? String(localized: "Gérer", comment: "Bouton : gérer l’abonnement") : String(localized: "Découvrir", comment: "Bouton : voir l’offre de l’Ordre du Dragon")) { showDragon = true }
                .buttonStyle(InkButtonStyle(kind: .primary, compact: true))
                .fixedSize()
        }
        .padding(12)
        .paperCard(fill: Theme.ink)
    }

    /// « Essai gratuit de 3 jours, puis 4,99 €/mois ou 39,99 €/an » (prix de l'App Store dès qu'ils sont chargés).
    private var dragonPriceLine: String {
        if app.subscribed { return String(localized: "Tu es membre de l’Ordre.") }
        // les deux prix de l'App Store, ou les deux prix de repli : jamais deux monnaies sur la même ligne
        let both = app.store.product(.dragonMonthly) != nil && app.store.product(.dragonYearly) != nil
        let month = both ? price(.dragonMonthly, fallback: 4.99) : Fmt.euros(4.99)
        let year = both ? price(.dragonYearly, fallback: 39.99) : Fmt.euros(39.99)
        if app.store.trialEligible {
            return String(localized: "Essai gratuit de \(DragonPerks.trialDays) jours, puis \(month)/mois ou \(year)/an",
                          comment: "Ordre du Dragon : durée de l’essai, prix mensuel, prix annuel")
        }
        return String(localized: "\(month)/mois ou \(year)/an", comment: "Ordre du Dragon : prix mensuel, prix annuel")
    }

    /// Pass de la saison en cours (`.offer.pass-offer` du web) : ouvre l'écran du pass.
    private var passOffer: some View {
        let premium = app.progress.pass().premium
        return HStack(spacing: 10) {
            InkIcon(name: "ui_chest", size: 42, fallback: "gift.fill")
            VStack(alignment: .leading, spacing: 2) {
                Text("Pass de saison \(app.currentSeason.number)").font(Theme.display(18))
                Text(premium ? String(localized: "Piste premium débloquée · réclame tes récompenses")
                             : String(localized: "\(SeasonPass.tiers) paliers · 3 apparences · piste premium \(app.passProduct.flatMap { app.store.product($0)?.displayPrice } ?? Fmt.euros(4.99))",
                                      comment: "Carte du pass dans la boutique : paliers, prix de la piste premium"))
                    .font(Theme.text(12.5)).foregroundStyle(Theme.ink2)
            }
            Spacer(minLength: 4)
            Button(premium ? String(localized: "Ouvrir", comment: "Bouton : ouvrir le pass") : String(localized: "Voir", comment: "Bouton : voir le pass")) {
                app.audio.play(.tap)
                app.sheet = .pass
            }
            .buttonStyle(InkButtonStyle(kind: .primary, compact: true))
            .fixedSize()
        }
        .foregroundStyle(Theme.ink)
        .padding(12)
        .paperCard(fill: Theme.cut)
    }

    private func gemPack(_ id: ProductID, rank: Int) -> some View {
        let gems: Int = { if case .gems(let n) = id.kind { return n } else { return 0 } }()
        return Button { buy(id) } label: {
            VStack(spacing: 6) {
                HStack(spacing: -8) {
                    ForEach(0..<rank, id: \.self) { _ in InkIcon(name: "ui_gem", size: 28, fallback: "diamond.fill") }
                }
                .frame(height: 30)
                Text(Reward.gems(gems).text).font(Theme.text(14, weight: .heavy))
                Text(price(id, fallback: [0.99, 4.99, 9.99][rank - 1]))
                    .font(Theme.text(13, weight: .bold))
                    .foregroundStyle(Theme.cut)
                    .padding(.horizontal, 8).padding(.vertical, 2)
                    .background(Theme.jade)
            }
            .foregroundStyle(Theme.ink)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(Theme.cut)
            .overlay(Rectangle().strokeBorder(Theme.ink, lineWidth: 2))
            .opacity(busy == id ? 0.5 : 1)
        }
        .buttonStyle(.plain)
        .disabled(busy != nil)
    }

    private func spendRow(icon: String, title: Text, priceIcon: String, price: Int, action: @escaping () -> Void) -> some View {
        Button {
            app.audio.play(.tap)
            action()
        } label: {
            HStack {
                InkIcon(name: icon, size: 26)
                title
                Spacer()
                HStack(spacing: 3) {
                    InkIcon(name: priceIcon, size: 18)
                    Text(Fmt.int(price)).font(Theme.text(17, weight: .heavy))
                }
                .padding(.horizontal, 8)
                .background(Theme.cut)
                .overlay(Rectangle().strokeBorder(Theme.ink, lineWidth: 1.5))
            }
        }
        .buttonStyle(InkButtonStyle(kind: .ghost))
    }
}
