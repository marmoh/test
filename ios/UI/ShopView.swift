import StoreKit
import SwiftUI

/// Boutique (§11, `shopSheet` du web) : offre de départ (une seule fois), Ordre du Dragon, gemmes (StoreKit 2),
/// dépenses en gemmes et en or (vies, Potion, Égide). Aucun objet aléatoire ; aucune publicité ici.
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
                    SectionTitle(text: "Gemmes")
                    HStack(spacing: 8) {
                        ForEach(Array(ProductID.gemPacks.enumerated()), id: \.offset) { i, id in gemPack(id, rank: i + 1) }
                    }
                    SectionTitle(text: "Avec tes gemmes et ton or")
                    spendRow(icon: "ui_heart", title: "5 vies", priceIcon: "ui_gem", price: ShopPrices.livesRefillGems) {
                        if app.lives.lives >= LivesState.max { return app.show("Tes vies sont au maximum") }
                        app.show(app.lives.refill(using: app.wallet) ? "Vies remplies ✓" : "Pas assez de gemmes")
                    }
                    spendRow(icon: "ui_potion", title: "Potion", priceIcon: "ui_coin", price: ShopPrices.potionGold) {
                        app.show(app.wallet.buyBonus(.potion, gold: ShopPrices.potionGold) ? "C’est fait ✓" : "Pas assez d’or")
                    }
                    spendRow(icon: "ui_aegis", title: "Égide", priceIcon: "ui_coin", price: ShopPrices.aegisGold) {
                        app.show(app.wallet.buyBonus(.aegis, gold: ShopPrices.aegisGold) ? "C’est fait ✓" : "Pas assez d’or")
                    }
                    Text("Paiements sécurisés par l’App Store. Aucun objet aléatoire. Publicité seulement si tu la demandes, contre une vie.")
                        .font(Theme.note(12)).foregroundStyle(Theme.ink2).padding(.top, 8)
                    Button("Restaurer les achats") {
                        Task {
                            let ok = await app.store.restore()
                            app.show(ok ? "Achats restaurés" : (app.store.lastError ?? "Restauration impossible"))
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

    private func price(_ id: ProductID, fallback: String) -> String {
        app.store.product(id)?.displayPrice ?? fallback
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
                app.show("Merci ! Achat crédité ✓")
            case .pending: app.show("Achat en attente de validation")
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
                Text("\(StarterPack.gems) gemmes · Moine du vent · 5 bonus").font(Theme.note(12)).foregroundStyle(Theme.ink2)
                Text("Une seule fois").font(Theme.text(11, weight: .heavy)).foregroundStyle(Theme.vermilion)
            }
            Spacer()
            Button(owned ? "Acquise" : price(.starterPack, fallback: "2,99 €")) { buy(.starterPack) }
                .buttonStyle(InkButtonStyle(kind: .primary))
                .fixedSize()
                .disabled(owned || busy != nil)
                .opacity(owned ? 0.5 : 1)
        }
        .foregroundStyle(Theme.ink)
        .padding(10)
        .paperCard()
        .padding(.top, 6)
    }

    private var dragon: some View {
        HStack(spacing: 10) {
            InkIcon(name: "ui_crown", size: 44, fallback: "crown.fill")
            VStack(alignment: .leading, spacing: 2) {
                Text("Ordre du Dragon").font(Theme.display(18))
                Text("Vies illimitées · \(DragonPerks.weeklyGems) gemmes/semaine · +25 % or · apparence exclusive").font(Theme.note(12)).foregroundStyle(Theme.ink2)
                Text(app.subscribed ? "Tu es membre de l’Ordre." : app.store.trialEligible ? "Essai gratuit de 3 jours, puis 4,99 €/mois ou 39,99 €/an" : "4,99 €/mois ou 39,99 €/an")
                    .font(Theme.text(11, weight: .bold))
            }
            Spacer()
            Button(app.subscribed ? "Gérer" : "Découvrir") { showDragon = true }
                .buttonStyle(InkButtonStyle(kind: .primary))
                .fixedSize()
        }
        .foregroundStyle(Theme.ink)
        .padding(10)
        .paperCard(border: Theme.goldLeaf)
    }

    private func gemPack(_ id: ProductID, rank: Int) -> some View {
        let gems: Int = { if case .gems(let n) = id.kind { return n } else { return 0 } }()
        return Button { buy(id) } label: {
            VStack(spacing: 6) {
                HStack(spacing: -8) {
                    ForEach(0..<rank, id: \.self) { _ in InkIcon(name: "ui_gem", size: 28, fallback: "diamond.fill") }
                }
                .frame(height: 30)
                Text("\(gems) gemmes").font(Theme.text(14, weight: .heavy))
                Text(price(id, fallback: ["0,99 €", "4,99 €", "9,99 €"][rank - 1]))
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

    private func spendRow(icon: String, title: String, priceIcon: String, price: Int, action: @escaping () -> Void) -> some View {
        Button {
            app.audio.play(.tap)
            action()
        } label: {
            HStack {
                InkIcon(name: icon, size: 26)
                Text(title)
                Spacer()
                HStack(spacing: 3) {
                    InkIcon(name: priceIcon, size: 18)
                    Text("\(price)").font(Theme.text(17, weight: .heavy))
                }
                .padding(.horizontal, 8)
                .background(Theme.cut)
                .overlay(Rectangle().strokeBorder(Theme.ink, lineWidth: 1.5))
            }
        }
        .buttonStyle(InkButtonStyle(kind: .ghost))
    }
}
