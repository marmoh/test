import StoreKit
import SwiftUI

/// §11 Ordre du Dragon : offre (`SubscriptionStoreView`) pour les non-membres, gestion pour les membres.
/// Présenté seulement depuis : la première panne de vies, le bouton secondaire de l'écran de défaite,
/// la boutique — et « Gérer l'abonnement » dans les Réglages. Jamais en combat.
struct DragonView: View {
    enum Context { case lives, defeat, shop, settings }

    let context: Context
    let store: Store
    let wallet: Wallet

    @Environment(\.dismiss) private var dismiss
    @State private var showManage = false
    @State private var toast: String?

    var body: some View {
        Group {
            if store.isDragon { member } else { offer }
        }
        .subscriptionStatusTask(for: ProductID.dragonGroupID) { _ in
            await store.subscriptionStatusChanged()
        }
    }

    // MARK: offre

    private var offer: some View {
        SubscriptionStoreView(groupID: ProductID.dragonGroupID) {
            DragonMarketing(kicker: kicker)
        }
        .subscriptionStoreControlStyle(.prominentPicker)
        .subscriptionStoreButtonLabel(.multiline)
        .storeButton(.visible, for: .restorePurchases)
        .storeButton(.visible, for: .policies)
        .storeButton(.visible, for: .cancellation)
        .subscriptionStorePolicyDestination(url: AppLinks.terms, for: .termsOfService)
        .subscriptionStorePolicyDestination(url: AppLinks.privacy, for: .privacyPolicy)
        .tint(Theme.vermilion)
        .containerBackground(Theme.paper, for: .subscriptionStoreFullHeight)
        .onInAppPurchaseCompletion { _, result in
            if case .success(let purchase) = result {
                _ = await store.handlePurchaseResult(purchase)
            }
        }
    }

    private var kicker: String? {
        switch context {
        case .lives: String(localized: "Plus de vies ? Les membres de l’Ordre n’en manquent jamais.")
        case .defeat: String(localized: "Réessaie autant que tu veux, sans perdre de vie.")
        case .shop, .settings: nil
        }
    }

    // MARK: membre

    private var member: some View {
        let d = store.entitlements.dragon
        return ScrollView {
            VStack(spacing: 0) {
                ZStack(alignment: .bottomTrailing) {
                    DragonEmblem().frame(width: 116, height: 116)
                    Text("Membre")
                        .font(Theme.display(20))
                        .foregroundStyle(Theme.goldLeaf)
                        .padding(.horizontal, 12).padding(.vertical, 2)
                        .background(Theme.ink)
                        .overlay(Rectangle().strokeBorder(Theme.goldLeaf, lineWidth: 2.5))
                        .rotationEffect(.degrees(-9))
                        .offset(x: 40, y: 4)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Theme.ink)
                .overlay(alignment: .top) { Theme.goldLeaf.frame(height: 3) }
                .overlay(alignment: .bottom) { Theme.goldLeaf.frame(height: 3) }

                Text(statusLine(d))
                    .font(Theme.text(14))
                    .foregroundStyle(Theme.ink2)
                    .multilineTextAlignment(.center)
                    .padding(.top, 12)

                VStack(spacing: 0) {
                    PerkRow(symbol: "heart.fill", title: "Vies illimitées", detail: "Les défaites ne coûtent plus de vie.") { ActiveBadge() }
                    PerkRow(symbol: "diamond.fill", title: "\(DragonPerks.weeklyGems) gemmes cette semaine",
                            detail: wallet.weeklyGemsClaimable() ? "Ton tribut t’attend." : "Déjà réclamées · les suivantes lundi.") {
                        if wallet.weeklyGemsClaimable() {
                            Button("Réclamer") {
                                let g = wallet.claimWeeklyGems()
                                if g > 0 { toast = String(localized: "+\(g) gemmes", comment: "Gemmes reçues (toujours plusieurs)") }
                            }
                            .buttonStyle(InkButtonStyle(kind: .jade))
                            .fixedSize()
                        } else {
                            ActiveBadge(text: "reçues")
                        }
                    }
                    PerkRow(symbol: "crown.fill", title: "Parure du Dragon", detail: "Cornes et col d’or sur ton héros.") {
                        Toggle("Parure du Dragon", isOn: Binding(get: { wallet.snapshot.dragonSkin }, set: { wallet.setDragonSkin($0) }))
                            .toggleStyle(InkToggleStyle())
                            .labelsHidden()
                            .fixedSize()
                    }
                    PerkRow(symbol: "circle.circle.fill", title: "+25 % d’or", detail: "Sur chaque victoire.") { ActiveBadge() }
                }
                .padding(.top, 8)

                Button("Gérer l’abonnement") { showManage = true }
                    .buttonStyle(InkButtonStyle(kind: .ghost))
                    .padding(.top, 18)
                Text("Changer de formule ou résilier se fait dans l’App Store ; les avantages restent jusqu’à la fin de la période payée.")
                    .font(Theme.note(12))
                    .foregroundStyle(Theme.ink2)
                    .multilineTextAlignment(.center)
                    .padding(.top, 8)
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 24)
        }
        .background(PaperBackground())
        .manageSubscriptionsSheet(isPresented: $showManage)
        .overlay(alignment: .topTrailing) {
            Button { dismiss() } label: {
                Text(verbatim: "×").font(Theme.text(24)).frame(width: 34, height: 34)
                    .background(Theme.paper)
                    .overlay(Rectangle().strokeBorder(Theme.ink, lineWidth: 2))
            }
            .buttonStyle(.plain)
            .foregroundStyle(Theme.ink)
            .padding(12)
            .accessibilityLabel("Fermer")
        }
        .overlay(alignment: .bottom) {
            if let toast {
                Text(toast).font(Theme.text(15, weight: .bold)).foregroundStyle(Theme.paper)
                    .padding(.vertical, 8).padding(.horizontal, 16).background(Theme.ink)
                    .padding(.bottom, 40)
                    .task { try? await Task.sleep(for: .seconds(2)); self.toast = nil }
            }
        }
    }

    private func statusLine(_ d: DragonStatus) -> String {
        let date = d.expiresAt.map(Fmt.dayMonth) ?? "—"
        var parts = [d.productID == .dragonYearly ? String(localized: "Formule annuelle", comment: "Abonnement à l’année")
                                                  : String(localized: "Formule mensuelle", comment: "Abonnement au mois")]
        if d.inTrial {
            parts.append(d.willRenew ? String(localized: "essai gratuit jusqu’au \(date)", comment: "Date au format jour + mois")
                                     : String(localized: "essai gratuit jusqu’au \(date), sans renouvellement", comment: "Date au format jour + mois"))
        } else if d.willRenew {
            parts.append(String(localized: "renouvellement le \(date)", comment: "Date au format jour + mois"))
        } else {
            parts.append(String(localized: "résilié · avantages jusqu’au \(date)", comment: "Date au format jour + mois"))
        }
        if let next = d.nextProductID, d.willRenew {
            parts.append(next == .dragonYearly ? String(localized: "formule annuelle à cette date", comment: "Changement de formule prévu à la date de renouvellement")
                                               : String(localized: "formule mensuelle à cette date", comment: "Changement de formule prévu à la date de renouvellement"))
        }
        return parts.joined(separator: " · ")
    }
}

// MARK: - contenu de l'offre

/// En-tête de `SubscriptionStoreView` : emblème sur scène de théâtre, avantages.
struct DragonMarketing: View {
    var kicker: String?

    var body: some View {
        VStack(spacing: 10) {
            Text("Ordre du Dragon")
                .font(Theme.display(34))
                .foregroundStyle(Theme.ink)
            DragonEmblem()
                .frame(width: 132, height: 132)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(Theme.ink)
                .overlay(alignment: .top) { Theme.goldLeaf.frame(height: 3) }
                .overlay(alignment: .bottom) { Theme.goldLeaf.frame(height: 3) }
            if let kicker {
                Text(verbatim: kicker).font(Theme.note(16)).foregroundStyle(Theme.ink2).multilineTextAlignment(.center)
            }
            VStack(spacing: 0) {
                PerkRow(symbol: "heart.fill", title: "Vies illimitées", detail: "Une défaite ne coûte plus de vie.") { EmptyView() }
                PerkRow(symbol: "diamond.fill", title: "\(DragonPerks.weeklyGems) gemmes chaque semaine", detail: "À réclamer sur la carte, chaque lundi.") { EmptyView() }
                PerkRow(symbol: "crown.fill", title: "Parure du Dragon", detail: "Cornes et col d’or, réservés à l’Ordre.") { EmptyView() }
                PerkRow(symbol: "circle.circle.fill", title: "+25 % d’or", detail: "Sur chaque victoire.") { EmptyView() }
            }
            Text("Essai gratuit de \(DragonPerks.trialDays) jours la première fois. Sans engagement : résiliable à tout moment, au plus tard 24 h avant la fin de la période.")
                .font(Theme.note(12))
                .foregroundStyle(Theme.ink2)
                .multilineTextAlignment(.center)
        }
        .padding(.horizontal, 20)
        .padding(.top, 16)
    }
}

struct PerkRow<Trailing: View>: View {
    let symbol: String
    let title: LocalizedStringKey
    let detail: LocalizedStringKey
    @ViewBuilder var trailing: () -> Trailing

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: symbol)
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(symbol == "heart.fill" ? Theme.vermilion : symbol == "diamond.fill" ? Theme.jade : Theme.goldLeaf)
                .frame(width: 32)
            VStack(alignment: .leading, spacing: 1) {
                Text(title).font(Theme.text(16, weight: .bold)).foregroundStyle(Theme.ink)
                Text(detail).font(Theme.note(12.5)).foregroundStyle(Theme.ink2)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            trailing()
        }
        .padding(.vertical, 8)
        .overlay(alignment: .bottom) { DashedRule() }
        .accessibilityElement(children: .combine)
    }
}

struct ActiveBadge: View {
    var text: LocalizedStringKey = "actif"
    var body: some View {
        Text(text)
            .font(Theme.text(12, weight: .heavy))
            .foregroundStyle(Theme.jade)
            .padding(.horizontal, 6)
            .overlay(Rectangle().strokeBorder(Theme.jade, lineWidth: 1.5))
            .rotationEffect(.degrees(-3))
    }
}

// MARK: - emblème

/// Dragon serpentin découpé dans l'encre devant une lune de papier, cerclé d'or à la feuille.
/// Même construction que `dragonEmblem()` du prototype web (`web/src/dragon.ts`).
struct DragonEmblem: View {
    var body: some View {
        Canvas { ctx, size in
            let k = min(size.width, size.height) / 132
            ctx.translateBy(x: size.width / 2, y: size.height / 2)
            ctx.scaleBy(x: k, y: k)
            let circle = { (r: CGFloat, x: CGFloat, y: CGFloat) in Path(ellipseIn: CGRect(x: x - r, y: y - r, width: 2 * r, height: 2 * r)) }
            ctx.fill(circle(62, 0, 0), with: .color(Theme.ink))
            ctx.stroke(circle(57, 0, 0), with: .color(Theme.goldLeaf), lineWidth: 3)
            ctx.fill(circle(51, 0, 0), with: .color(Theme.cut))
            ctx.fill(circle(40, 20, -14), with: .color(Theme.ink.opacity(0.12)))
            ctx.translateBy(x: 3, y: 6)
            let (body, horn, eye) = Self.dragonPaths()
            ctx.fill(body, with: .color(Theme.ink))
            ctx.stroke(body, with: .color(Theme.ink), style: StrokeStyle(lineWidth: 1.5, lineJoin: .round))
            ctx.fill(horn, with: .color(Theme.ink))
            ctx.stroke(horn, with: .color(Theme.goldLeaf), lineWidth: 1.2)
            ctx.fill(circle(1.6, eye.x, eye.y), with: .color(Theme.cut))
        }
        .accessibilityHidden(true)
    }

    static func dragonPaths() -> (Path, Path, CGPoint) {
        let n = 28
        func c(_ t: Double) -> CGPoint {
            CGPoint(x: -50 + 92 * t, y: 13 * sin(t * .pi * 2.1 + 0.5) + 6 - 8 * t)
        }
        var top: [CGPoint] = []
        var bottom: [CGPoint] = []
        var end = c(1)
        var dir = CGPoint(x: 1, y: 0)
        for i in 0...n {
            let t = Double(i) / Double(n)
            let p = c(t), q = c(min(1, t + 0.01)), r = c(max(0, t - 0.01))
            let dx = q.x - r.x, dy = q.y - r.y
            let len = max(0.0001, hypot(dx, dy))
            let nx = dy / len, ny = -dx / len
            let w = 1.2 + 6.2 * pow(sin(.pi * min(1, t * 1.15)), 0.7) + (t > 0.9 ? 2.5 : 0)
            top.append(CGPoint(x: p.x + nx * w, y: p.y + ny * w))
            if i % 2 == 1, t > 0.08, t < 0.88 {
                top.append(CGPoint(x: p.x + nx * (w + 5.5) + dx / len * 1.5, y: p.y + ny * (w + 5.5) + dy / len * 1.5))
            }
            bottom.insert(CGPoint(x: p.x - nx * w, y: p.y - ny * w), at: 0)
            if i == n { end = p; dir = CGPoint(x: dx / len, y: dy / len) }
        }
        let nrm = CGPoint(x: dir.y, y: -dir.x)
        func P(_ a: Double, _ b: Double) -> CGPoint {
            CGPoint(x: end.x + dir.x * a + nrm.x * b, y: end.y + dir.y * a + nrm.y * b)
        }
        let head = [P(0, 9), P(5, 8), P(13, 4), P(17, 1.5), P(9, 0), P(16, -3.5), P(12, -5), P(3, -8), P(-2, -9)]
        var body = Path()
        body.addLines(top + head + bottom)
        body.closeSubpath()
        var horn = Path()
        horn.move(to: P(-1, 8.5))
        horn.addQuadCurve(to: P(-15, 15), control: P(-8, 16))
        horn.addQuadCurve(to: P(4, 7.5), control: P(-7, 12))
        horn.closeSubpath()
        return (body, horn, P(7, 3.2))
    }
}
