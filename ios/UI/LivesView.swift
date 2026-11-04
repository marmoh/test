import SwiftUI

/// Feuille « Vies » / « Plus de vies » : ouverte depuis le compteur de vies de la carte, ou quand on veut
/// jouer sans vie. Propose la publicité récompensée (+1 vie, à la demande) et la recharge en gemmes.
/// Jamais présentée en combat ni en tournoi. Même contenu que `livesSheet` (web).
struct LivesView: View {
    let lives: LivesCenter
    let wallet: Wallet
    let store: Store
    let ads: any AdService
    @Bindable var settings: GameSettings

    @Environment(\.dismiss) private var dismiss
    @State private var busy = false
    @State private var toast: String?

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { _ in
            content
        }
        .padding(.horizontal, 20)
        .padding(.top, 22)
        .padding(.bottom, 20)
        .frame(maxWidth: .infinity)
        .background(PaperBackground())
        .presentationDetents([.medium])
        .overlay(alignment: .bottom) {
            if let toast {
                Text(toast).font(Theme.text(15, weight: .bold)).foregroundStyle(Theme.paper)
                    .padding(.vertical, 8).padding(.horizontal, 16).background(Theme.ink)
                    .padding(.bottom, 30)
                    .task { try? await Task.sleep(for: .seconds(2)); self.toast = nil }
            }
        }
    }

    @ViewBuilder private var content: some View {
        let dragon = store.isDragon
        let state = lives.state
        let ad = lives.adStatus(subscribed: dragon)
        VStack(spacing: 12) {
            Text(dragon ? "Vies illimitées" : state.lives == 0 ? "Plus de vies" : "Vies")
                .font(Theme.display(34))
                .foregroundStyle(Theme.ink)
            HStack(spacing: 6) {
                ForEach(0..<LivesState.max, id: \.self) { i in
                    Image(systemName: "heart.fill")
                        .font(.system(size: 34))
                        .foregroundStyle(dragon || i < state.lives ? Theme.vermilion : Theme.ink3.opacity(0.3))
                }
                if dragon { Text("∞").font(Theme.display(40)).foregroundStyle(Theme.ink) }
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(dragon ? "Vies illimitées" : "\(state.lives) vies sur \(LivesState.max)")

            if dragon {
                Text("L’Ordre du Dragon t’offre des vies illimitées. Aucune publicité.")
                    .font(Theme.text(16)).foregroundStyle(Theme.ink2).multilineTextAlignment(.center)
            } else {
                Text(nextLifeText)
                    .font(Theme.text(16)).foregroundStyle(Theme.ink2).monospacedDigit()

                Button {
                    Task { await watchAd() }
                } label: {
                    VStack(alignment: .leading, spacing: 2) {
                        HStack {
                            Text("Regarder une courte pub")
                            Spacer()
                            Text("+1 ♥").font(Theme.text(17, weight: .heavy))
                                .foregroundStyle(Theme.ink)
                                .padding(.horizontal, 10)
                                .background(Theme.cut)
                                .overlay(Rectangle().strokeBorder(Theme.ink, lineWidth: 2))
                        }
                        Text(adLabel(ad)).font(Theme.note(13))
                    }
                }
                .buttonStyle(InkButtonStyle(kind: .jade))
                .disabled(!ad.ok || busy || !ads.isReady)
                .opacity(ad.ok ? 1 : 0.55)

                Button {
                    toast = lives.refill(using: wallet) ? "Vies remplies" : "Pas assez de gemmes"
                } label: {
                    HStack {
                        Text("Remplir les 5 vies")
                        Spacer()
                        Label("90", systemImage: "diamond.fill")
                            .font(Theme.text(17, weight: .heavy))
                            .padding(.horizontal, 10)
                            .background(Theme.cut)
                            .overlay(Rectangle().strokeBorder(Theme.ink, lineWidth: 2))
                    }
                }
                .buttonStyle(InkButtonStyle(kind: .ghost))
                .disabled(state.lives >= LivesState.max)

                Text("Publicités uniquement si tu le demandes, jamais pendant un niveau ni en tournoi. \(RewardedAdPolicy.perDay) par jour au plus\(settings.personalizedAds ? "" : ", non personnalisées").")
                    .font(Theme.note(13)).foregroundStyle(Theme.ink2).multilineTextAlignment(.center)
            }
        }
    }

    private var nextLifeText: String {
        guard let s = lives.secondsToNextLife else { return "Vies au maximum." }
        return "Prochaine vie dans \(Self.clock(s))"
    }

    private func adLabel(_ ad: RewardedAdPolicy.Status) -> String {
        if ad.ok { return "\(ad.left) restante\(ad.left > 1 ? "s" : "") aujourd’hui" }
        switch ad.reason {
        case .cooldown: return "Prochaine dans \(Self.clock(ad.wait))"
        case .daily: return "Tu as vu les \(RewardedAdPolicy.perDay) publicités du jour. Reviens demain."
        case .full: return "Tes vies sont au maximum."
        case .subscriber, .none: return ""
        }
    }

    private func watchAd() async {
        guard !busy, lives.adStatus(subscribed: store.isDragon).ok else { return }
        busy = true
        defer { busy = false }
        if await ads.presentRewarded() == .rewarded, lives.rewardAd(subscribed: store.isDragon) {
            toast = "+1 vie"
        }
    }

    static func clock(_ seconds: TimeInterval) -> String {
        let s = max(0, Int(seconds.rounded(.up)))
        let h = s / 3600, m = (s % 3600) / 60, r = s % 60
        return h > 0 ? String(format: "%d h %02d", h, m) : String(format: "%d:%02d", m, r)
    }
}

// MARK: - publicité factice

/// Présente la publicité de `MockAdService` en plein écran (à poser une fois à la racine de l'app).
struct MockAdPresenter: ViewModifier {
    let service: MockAdService

    func body(content: Content) -> some View {
        content.fullScreenCover(isPresented: Binding(
            get: { service.isPresenting },
            set: { if !$0, service.isPresenting { service.finish(.dismissed) } }
        )) {
            MockAdView(service: service)
        }
    }
}

extension View {
    func mockAds(_ service: MockAdService) -> some View { modifier(MockAdPresenter(service: service)) }
}

/// « Entracte » : 5 s de compte à rebours, marqué « Publicité simulée ». Fermer avant la fin = pas de vie.
struct MockAdView: View {
    let service: MockAdService
    @State private var start = Date.now

    var body: some View {
        TimelineView(.animation) { timeline in
            let elapsed = min(MockAdService.duration, timeline.date.timeIntervalSince(start))
            let done = elapsed >= MockAdService.duration
            VStack(spacing: 0) {
                ZStack(alignment: .topLeading) {
                    Theme.curtain
                    VStack(spacing: 4) {
                        Text("Entracte").font(Theme.display(28))
                        Text("Ici passera une courte vidéo d’un annonceur.").font(Theme.text(14))
                        Text("Publicité factice : rien n’est diffusé ni collecté.").font(Theme.note(11.5)).foregroundStyle(Theme.ink2)
                    }
                    .multilineTextAlignment(.center)
                    .foregroundStyle(Theme.ink)
                    .padding(14)
                    .frame(maxWidth: 240)
                    .paperCard()
                    .rotationEffect(.degrees(-1.5))
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    Text("PUBLICITÉ SIMULÉE")
                        .font(Theme.text(12, weight: .heavy))
                        .foregroundStyle(Theme.cut)
                        .padding(.horizontal, 10).padding(.vertical, 2)
                        .background(Theme.ink)
                        .overlay(Rectangle().strokeBorder(Theme.paper3, lineWidth: 2))
                        .padding(12)
                }
                .frame(height: 260)
                HStack(spacing: 12) {
                    ZStack {
                        Circle().stroke(Theme.ink.opacity(0.2), lineWidth: 5)
                        Circle().trim(from: elapsed / MockAdService.duration, to: 1)
                            .stroke(Theme.ink, style: StrokeStyle(lineWidth: 5))
                            .rotationEffect(.degrees(-90))
                        Text(done ? "✓" : "\(Int((MockAdService.duration - elapsed).rounded(.up)))")
                            .font(Theme.display(22))
                    }
                    .frame(width: 56, height: 56)
                    VStack(alignment: .leading, spacing: 6) {
                        Text(done ? "Merci d’avoir regardé." : "Ta vie arrive dans \(Int((MockAdService.duration - elapsed).rounded(.up))) s")
                            .font(Theme.text(15, weight: .bold))
                        if done {
                            Button("Récupérer ma vie") { service.finish(.rewarded) }
                                .buttonStyle(InkButtonStyle(kind: .primary)).fixedSize()
                        } else {
                            Button("Fermer sans récompense") { service.finish(.dismissed) }
                                .buttonStyle(InkButtonStyle(kind: .ghost)).fixedSize()
                        }
                    }
                    Spacer(minLength: 0)
                }
                .foregroundStyle(Theme.ink)
                .padding(14)
                .background(Theme.paper)
            }
            .overlay(Rectangle().strokeBorder(Theme.ink, lineWidth: 3))
            .padding(14)
            .frame(maxHeight: .infinity)
            .background(Theme.ink.opacity(0.92).ignoresSafeArea())
        }
        .presentationBackground(.clear)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Publicité simulée")
    }
}
