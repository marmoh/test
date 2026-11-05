import StoreKit
import SwiftUI

/// Pass de saison (§11, §12.6, DECISIONS #62 ; `passSheet` du web) : saisons de 6 semaines, 30 paliers,
/// piste gratuite et piste premium (non-consommable `ombrelune.pass.season<N>`, 4,99 €). On avance en gagnant :
/// +10 lunes par victoire, +10 par étoile nouvelle. Récompenses fixes, affichées d'avance ; rien ne compte en tournoi.
@MainActor
struct SeasonPassView: View {
    @Environment(AppModel.self) private var app
    @State private var buying = false

    var body: some View {
        let pass = app.progress.pass()
        let season = app.currentSeason
        let daysLeft = max(0, Int(((season.end - Date().timeIntervalSince1970) / 86_400).rounded(.up)))
        let ready = pass.claimableCount
        VStack(spacing: 0) {
            SheetHeader(title: "Pass de saison")
            VStack(alignment: .leading, spacing: 6) {
                // cartouche d'encre de la saison et case du palier (`passSheet` du web)
                HStack(spacing: 8) {
                    VStack(alignment: .leading, spacing: 1) {
                        Text("Saison \(season.number) · \(daysLeft) jours restants").font(Theme.note(11.5)).foregroundStyle(Theme.paper3)
                        Text(SeasonPass.name).font(Theme.display(21)).foregroundStyle(Theme.paper)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 12).padding(.vertical, 8)
                    .background(Theme.ink)
                    .background(Theme.ink.offset(x: 3, y: 3))
                    VStack(spacing: 0) {
                        Text("PALIER").font(Theme.text(10, weight: .heavy)).tracking(1)
                        Text(verbatim: "\(pass.tier)/\(SeasonPass.tiers)").font(Theme.display(24))
                    }
                    .frame(width: 76)
                    .padding(.vertical, 6)
                    .paperCard(shadow: 3)
                }
                GeometryReader { g in
                    ZStack(alignment: .leading) {
                        Rectangle().fill(Theme.paper3)
                        Rectangle().fill(Theme.goldLeaf).frame(width: g.size.width * CGFloat(SeasonPass.progress(pass.points)))
                        Text(pass.tier >= SeasonPass.tiers ? "Pass terminé" : "\(pass.points % SeasonPass.pointsPerTier)/\(SeasonPass.pointsPerTier) lunes vers le palier \(pass.tier + 1)")
                            .font(Theme.text(11, weight: .bold))
                            .frame(maxWidth: .infinity)
                    }
                }
                .frame(height: 16)
                .overlay(Rectangle().strokeBorder(Theme.ink, lineWidth: 1.5))
                .accessibilityElement(children: .combine)
                Text("Lunes : +\(SeasonPass.pointsPerWin) par victoire, +\(SeasonPass.pointsPerNewStar) par étoile nouvelle.")
                    .font(Theme.note(12)).foregroundStyle(Theme.ink2)
                premiumBox(pass)
                if ready > 0 {
                    Button("Tout réclamer (\(ready))") { app.claimAllPass() }
                        .buttonStyle(InkButtonStyle(kind: .jade))
                }
            }
            .foregroundStyle(Theme.ink)
            .padding(.horizontal, 20)
            .padding(.bottom, 8)
            HStack {
                Text("Gratuit").frame(maxWidth: .infinity)
                Text("").frame(width: 46)
                Text("Premium").frame(maxWidth: .infinity)
            }
            .font(Theme.text(12, weight: .heavy))
            .foregroundStyle(Theme.ink2)
            .padding(.horizontal, 20)
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 6) {
                        ForEach(1...SeasonPass.tiers, id: \.self) { t in
                            row(t, pass: pass).id(t)
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 30)
                }
                .onAppear { proxy.scrollTo(min(SeasonPass.tiers, max(1, pass.tier + 1)), anchor: .center) }
            }
            Text("Paiement par l’App Store (non consommable, une fois par saison). Aucune récompense aléatoire ; rien du pass ne compte en tournoi.")
                .font(Theme.note(11)).foregroundStyle(Theme.ink2).multilineTextAlignment(.center)
                .padding(.horizontal, 20).padding(.top, 8).padding(.bottom, 4)
                .frame(maxWidth: .infinity)
                .overlay(alignment: .top) { Rectangle().fill(Theme.ink).frame(height: 1.5).padding(.horizontal, 20) }
        }
        .background(PaperBackground())
        .toast(Binding(get: { app.toast }, set: { app.toast = $0 }))
        .onAppear { app.syncPassPremium() }
    }

    @ViewBuilder
    private func premiumBox(_ pass: SeasonPassState) -> some View {
        HStack(spacing: 10) {
            Group {
                if let img = AtlasImages.paperIcon("ui_crown") { Image(uiImage: img).resizable().scaledToFit() }
                else { Image(systemName: "crown.fill").resizable().scaledToFit().foregroundStyle(Theme.paper) }
            }
            .frame(width: 34, height: 34)
            VStack(alignment: .leading, spacing: 2) {
                if pass.premium {
                    Text("Piste premium débloquée").font(Theme.display(18)).foregroundStyle(Theme.paper)
                    Text("Merci ! Toutes les récompenses premium atteintes sont à toi.").font(Theme.text(12)).foregroundStyle(Theme.paper3)
                } else {
                    Text("Piste premium").font(Theme.display(18)).foregroundStyle(Theme.paper)
                    Text("3 apparences, \(premiumGems) gemmes, or et bonus · récompenses déjà atteintes comprises").font(Theme.text(12)).foregroundStyle(Theme.paper3)
                }
            }
            Spacer(minLength: 0)
            if !pass.premium {
                Button(buying ? "Confirmation…" : priceText) {
                    guard !buying else { return }
                    buying = true
                    Task {
                        await app.buyPassPremium()
                        buying = false
                    }
                }
                .buttonStyle(InkButtonStyle(kind: .primary, compact: true))
                .fixedSize()
                .disabled(buying || app.passProduct == nil)
            }
        }
        .padding(12)
        .paperCard(fill: Theme.ink, border: pass.premium ? Theme.goldLeaf : Theme.ink, shadow: 3)
    }

    private var priceText: String {
        if let id = app.passProduct, let p = app.store.product(id) { return p.displayPrice }
        return app.passProduct == nil ? "Bientôt" : "4,99 €"
    }

    private var premiumGems: Int {
        SeasonPass.premiumTrack.reduce(0) { if case .gems(let n) = $1 { return $0 + n } else { return $0 } }
    }

    private func row(_ t: Int, pass: SeasonPassState) -> some View {
        let reached = t <= pass.tier
        return HStack(spacing: 6) {
            cell(t, premium: false, pass: pass, reached: reached)
            Text("\(t)")
                .font(Theme.display(17))
                .frame(width: 40, height: 40)
                .background(Circle().fill(reached ? Theme.goldLeaf : Theme.paper3))
                .overlay(Circle().strokeBorder(Theme.ink, lineWidth: 2))
            cell(t, premium: true, pass: pass, reached: reached)
        }
        .foregroundStyle(Theme.ink)
    }

    private func cell(_ t: Int, premium: Bool, pass: SeasonPassState, reached: Bool) -> some View {
        let reward = SeasonPass.reward(premium: premium, tier: t)
        let claimed = pass.isClaimed(premium: premium, tier: t)
        let can = pass.canClaim(premium: premium, tier: t)
        let locked = premium && !pass.premium
        return Button {
            app.claimPass(tier: t, premium: premium)
        } label: {
            HStack(spacing: 6) {
                InkIcon(name: reward.iconName, size: 24)
                Text(reward.label).font(Theme.text(12.5, weight: .bold)).lineLimit(2).minimumScaleFactor(0.8)
                Spacer(minLength: 0)
                if claimed {
                    Image(systemName: "checkmark").font(.system(size: 13, weight: .heavy)).foregroundStyle(Theme.jade)
                } else if locked {
                    InkIcon(name: "ui_lock", size: 16, fallback: "lock.fill")
                }
            }
            .padding(.horizontal, 8)
            .frame(maxWidth: .infinity, minHeight: 46)
            .background(can ? Theme.cut : premium ? Theme.goldLeaf.opacity(0.12) : Theme.paper2)
            .overlay(Rectangle().strokeBorder(can ? Theme.vermilion : premium ? Theme.goldLeaf : Theme.ink3, lineWidth: can ? 2.5 : 1.5))
            .opacity(reached || claimed ? 1 : 0.55)
        }
        .buttonStyle(.plain)
        .disabled(!can)
        .accessibilityLabel("Palier \(t), \(premium ? "premium" : "gratuit") : \(reward.label)\(claimed ? ", reçu" : can ? ", à réclamer" : "")")
    }
}
