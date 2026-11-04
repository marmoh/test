import StoreKit
import SwiftUI

/// Pass de saison (§11, DECISIONS #50) : 30 paliers, piste gratuite et piste premium (non-consommable
/// `ombrelune.pass.season1`). L'XP vient des parties (victoire, étoiles, premier succès, tournoi).
struct SeasonPassView: View {
    @Environment(AppModel.self) private var app
    @State private var buying = false

    var body: some View {
        let pass = app.progress.pass
        let owned = app.wallet.ownsSeasonPass
        VStack(spacing: 0) {
            SheetHeader(title: "Pass de saison \(SeasonPass.season)")
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text("Palier \(pass.tier)/\(SeasonPass.tiers)").font(Theme.display(20))
                    Spacer()
                    Text("\(pass.xp % SeasonPass.xpPerTier)/\(SeasonPass.xpPerTier) XP").font(Theme.text(13, weight: .bold)).monospacedDigit()
                }
                GeometryReader { g in
                    ZStack(alignment: .leading) {
                        Rectangle().fill(Theme.paper3)
                        Rectangle().fill(Theme.goldLeaf)
                            .frame(width: pass.tier >= SeasonPass.tiers ? g.size.width : g.size.width * CGFloat(pass.xp % SeasonPass.xpPerTier) / CGFloat(SeasonPass.xpPerTier))
                    }
                }
                .frame(height: 10)
                .overlay(Rectangle().strokeBorder(Theme.ink, lineWidth: 1.5))
                Text("Victoire : 40 XP + 10 par étoile (+20 la première fois) · défaite : 15 · essai de tournoi : 50.")
                    .font(Theme.note(12)).foregroundStyle(Theme.ink2)
                if !owned {
                    Button {
                        guard !buying else { return }
                        buying = true
                        Task {
                            let r = await app.store.purchase(.seasonPass1)
                            buying = false
                            if r == .purchased { app.audio.play(.win); app.show("Piste premium débloquée ✓") }
                            else if case .failed(let m) = r { app.show(m) }
                        }
                    } label: {
                        HStack {
                            InkIcon(name: "ui_crown", size: 20, fallback: "crown.fill")
                            Text("Débloquer la piste premium")
                            Spacer()
                            Text(app.store.product(.seasonPass1)?.displayPrice ?? "4,99 €").font(Theme.text(16, weight: .heavy))
                        }
                    }
                    .buttonStyle(InkButtonStyle(kind: .primary))
                    .disabled(buying)
                }
            }
            .foregroundStyle(Theme.ink)
            .padding(.horizontal, 20)
            .padding(.bottom, 8)
            HStack {
                Text("Palier").frame(width: 46)
                Text("Gratuit").frame(maxWidth: .infinity)
                Text("Premium").frame(maxWidth: .infinity)
            }
            .font(Theme.text(12, weight: .heavy))
            .foregroundStyle(Theme.ink2)
            .padding(.horizontal, 20)
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 6) {
                        ForEach(1...SeasonPass.tiers, id: \.self) { t in
                            row(t, pass: pass, owned: owned).id(t)
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 30)
                }
                .onAppear { proxy.scrollTo(max(1, pass.tier), anchor: .center) }
            }
        }
        .background(PaperBackground())
        .toast(Binding(get: { app.toast }, set: { app.toast = $0 }))
    }

    private func row(_ t: Int, pass: SeasonPassState, owned: Bool) -> some View {
        let reached = t <= pass.tier
        return HStack(spacing: 8) {
            Text("\(t)")
                .font(Theme.display(18))
                .frame(width: 46, height: 46)
                .background(Circle().fill(reached ? Theme.goldLeaf : Theme.paper3))
                .overlay(Circle().strokeBorder(Theme.ink, lineWidth: 2))
            cell(t, reward: SeasonPass.freeReward(t), premium: false, reached: reached,
                 claimed: pass.claimedFree.contains(t), can: pass.canClaim(t, premium: false, owned: owned), locked: false)
            cell(t, reward: SeasonPass.premiumReward(t), premium: true, reached: reached,
                 claimed: pass.claimedPremium.contains(t), can: pass.canClaim(t, premium: true, owned: owned), locked: !owned)
        }
        .foregroundStyle(Theme.ink)
    }

    private func cell(_ t: Int, reward: Reward, premium: Bool, reached: Bool, claimed: Bool, can: Bool, locked: Bool) -> some View {
        Button {
            if let r = app.progress.claimPass(tier: t, premium: premium, wallet: app.wallet) {
                app.audio.play(.star)
                app.show("Reçu : \(r.label)")
            }
        } label: {
            HStack(spacing: 6) {
                InkIcon(name: reward.iconName, size: 24)
                Text(reward.label).font(Theme.text(13, weight: .bold)).lineLimit(2).minimumScaleFactor(0.8)
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
