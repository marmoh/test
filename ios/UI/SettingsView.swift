import StoreKit
import SwiftUI

/// §12.6 Réglages : son, musique, vibrations, tir automatique, réduire les animations, gérer l'abonnement,
/// restaurer les achats, confidentialité (consentement publicitaire), crédits des polices (OFL),
/// effacer la progression avec confirmation intégrée. Même contenu que `settingsSheet` (web).
struct SettingsView: View {
    @Bindable var settings: GameSettings
    let store: Store
    let wallet: Wallet
    let lives: LivesCenter
    /// Efface la progression de la sauvegarde (étoiles, niveaux, talents…) ; les achats restent.
    var onEraseProgress: () -> Void = {}

    @State private var showDragon = false
    @State private var confirmErase = false
    @State private var restoring = false
    @State private var message: String?
    @State private var attNote: String?

    var body: some View {
        VStack(spacing: 0) {
            SheetHeader(title: "Réglages")
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    SectionTitle(text: "Son")
                    row("Effets sonores", isOn: $settings.sound)
                    row("Musique", hint: "Boîte à musique synthétisée en direct", isOn: $settings.music)
                    row("Vibrations", isOn: $settings.haptics)

                    SectionTitle(text: "Jeu")
                    row("Tir automatique", hint: "Ta héroïne tire aussi en se déplaçant (toujours actif en tournoi)", isOn: $settings.autoFire)
                    row("Réduire les animations", hint: "Coupe secousses, arrêts sur image et animations décoratives", isOn: $settings.reduceMotion)

                    SectionTitle(text: "Achats")
                    linkRow("Gérer l’abonnement", hint: String(localized: "Ordre du Dragon · \(dragonSummary)", comment: "Réglages : état de l’abonnement")) { showDragon = true }
                    linkRow("Restaurer les achats", hint: restoring ? String(localized: "Restauration…")
                                                                    : String(localized: "Offre de départ, pass de saison et Ordre du Dragon")) {
                        Task { await restore() }
                    }

                    SectionTitle(text: "Confidentialité")
                    if AdConfig.enabled {
                        row("Publicités personnalisées", hint: "Désactivé par défaut. L’activer ouvre la demande de suivi d’Apple.", isOn: $settings.personalizedAds)
                        if let attNote {
                            Text(attNote).font(Theme.note()).foregroundStyle(Theme.vermilion).padding(.top, 6)
                        }
                    }
                    Text(AdConfig.enabled
                         ? String(localized: "Ta progression reste sur ton appareil et dans ton iCloud. Aucun compte, aucun traçage. La seule publicité est celle que tu choisis de regarder pour gagner une vie : \(RewardedAdPolicy.perDay) par jour au plus, jamais pendant un niveau ni en tournoi, jamais pour les membres de l’Ordre. Sans ton accord, elle n’est pas personnalisée.")
                         : String(localized: "Ta progression reste sur ton appareil et dans ton iCloud. Aucun compte, aucune publicité, aucun traçage."))
                        .font(Theme.note())
                        .foregroundStyle(Theme.ink2)
                        .padding(.top, 10)
                    Link(destination: AppLinks.privacy) {
                        Text("Politique de confidentialité").underline()
                    }
                    .font(Theme.note()).foregroundStyle(Theme.ink).padding(.top, 6)
                    Link(destination: AppLinks.support) {
                        Text("Assistance").underline()
                    }
                    .font(Theme.note()).foregroundStyle(Theme.ink).padding(.top, 4)

                    SectionTitle(text: "Crédits")
                    credits

                    SectionTitle(text: "Progression")
                    erase

                    Text("\(AppInfo.name) · version \(AppInfo.version)", comment: "Réglages : nom de l’app et numéro de version")
                        .font(Theme.note())
                        .foregroundStyle(Theme.ink2)
                        .frame(maxWidth: .infinity)
                        .padding(.top, 20)
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 30)
            }
        }
        .background(PaperBackground())
        .sheet(isPresented: $showDragon) {
            DragonView(context: .settings, store: store, wallet: wallet)
        }
        .onChange(of: settings.personalizedAds) { _, on in
            guard on else { attNote = nil; return }
            Task {
                let granted = await AdPrivacy.requestPersonalizedAds()
                if !granted {
                    settings.personalizedAds = false
                    attNote = String(localized: "Suivi refusé dans iOS : les publicités resteront non personnalisées (Réglages › Confidentialité › Suivi).",
                                     comment: "Chemin des réglages iOS : utiliser les libellés exacts d’iOS dans chaque langue")
                }
            }
        }
        .overlay(alignment: .bottom) {
            if let message {
                Text(message)
                    .font(Theme.text(15, weight: .bold))
                    .foregroundStyle(Theme.paper)
                    .padding(.vertical, 8).padding(.horizontal, 16)
                    .background(Theme.ink)
                    .rotationEffect(.degrees(-1))
                    .padding(.bottom, 40)
                    .task {
                        try? await Task.sleep(for: .seconds(2.4))
                        self.message = nil
                    }
            }
        }
    }

    // MARK: lignes

    private func row(_ title: LocalizedStringKey, hint: LocalizedStringKey? = nil, isOn: Binding<Bool>) -> some View {
        Toggle(isOn: isOn) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(Theme.text(16, weight: .bold)).foregroundStyle(Theme.ink)
                if let hint { Text(hint).font(Theme.note(12)).foregroundStyle(Theme.ink2) }
            }
        }
        .toggleStyle(InkToggleStyle())
        .padding(.vertical, 12)
        .overlay(alignment: .bottom) { DashedRule() }
    }

    private func linkRow(_ title: LocalizedStringKey, hint: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(Theme.text(16, weight: .bold)).foregroundStyle(Theme.ink)
                    Text(hint).font(Theme.note(12)).foregroundStyle(Theme.ink2)
                }
                Spacer()
                Text(verbatim: "›").font(Theme.display(26)).foregroundStyle(Theme.vermilion)
            }
            .padding(.vertical, 12)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .overlay(alignment: .bottom) { DashedRule() }
    }

    private var dragonSummary: String {
        let d = store.entitlements.dragon
        guard d.isActive else { return String(localized: "Non membre", comment: "Réglages : pas d’abonnement à l’Ordre du Dragon") }
        let date = d.expiresAt.map(Fmt.dayMonth) ?? "—"
        if d.inTrial { return String(localized: "Essai gratuit jusqu’au \(date)", comment: "Date au format jour + mois") }
        return d.willRenew ? String(localized: "Renouvellement le \(date)", comment: "Date au format jour + mois")
                           : String(localized: "Résilié · actif jusqu’au \(date)", comment: "Date au format jour + mois")
    }

    private var credits: some View {
        VStack(alignment: .leading, spacing: 8) {
            (Text(verbatim: "IM Fell English SC").font(Theme.display(17)) + Text(verbatim: " — Igino Marini. Copyright © 2010, Igino Marini.").font(Theme.text(14)))
            (Text(verbatim: "Alegreya Sans").font(Theme.text(14, weight: .bold)) + Text(verbatim: " — Juan Pablo del Peral (Huerta Tipográfica). Copyright © 2013, The Alegreya Sans Project Authors.").font(Theme.text(14)))
            Text("Polices distribuées sous licence SIL Open Font License 1.1 (openfontlicense.org). Sons et musique synthétisés en direct, sans fichier sous licence.")
                .font(Theme.note())
                .foregroundStyle(Theme.ink2)
        }
        .foregroundStyle(Theme.ink)
    }

    @ViewBuilder private var erase: some View {
        if confirmErase {
            VStack(alignment: .leading, spacing: 10) {
                (Text("Tout effacer ? ").bold() + Text("Étoiles, niveaux, or, gemmes, talents et bonus seront perdus. Tes achats (offre de départ, pass, Ordre du Dragon) restent récupérables avec « Restaurer les achats »."))
                    .font(Theme.text(14))
                    .foregroundStyle(Theme.ink2)
                HStack(spacing: 10) {
                    Button("Annuler") { withAnimation { confirmErase = false } }
                        .buttonStyle(InkButtonStyle(kind: .ghost))
                    Button("Effacer") {
                        wallet.eraseProgress()
                        lives.reset()
                        onEraseProgress()
                        confirmErase = false
                        message = String(localized: "Progression effacée")
                    }
                    .buttonStyle(InkButtonStyle(kind: .danger))
                }
            }
            .padding(12)
            .paperCard(fill: Theme.cut, border: Theme.vermilion)
            .padding(.top, 10)
            .transition(.opacity)
        } else {
            Button("Effacer la progression") { withAnimation { confirmErase = true } }
                .buttonStyle(InkButtonStyle(kind: .ghost))
                .padding(.top, 10)
        }
    }

    private func restore() async {
        restoring = true
        let ok = await store.restore()
        restoring = false
        message = ok ? String(localized: "Achats restaurés") : (store.lastError ?? String(localized: "Restauration impossible"))
    }
}

/// Filet pointillé entre deux lignes de réglage.
struct DashedRule: View {
    var body: some View {
        Line()
            .stroke(Theme.ink3, style: StrokeStyle(lineWidth: 1.5, dash: [4, 3]))
            .frame(height: 1.5)
    }

    private struct Line: Shape {
        func path(in rect: CGRect) -> Path {
            var p = Path()
            p.move(to: CGPoint(x: rect.minX, y: rect.midY))
            p.addLine(to: CGPoint(x: rect.maxX, y: rect.midY))
            return p
        }
    }
}

/// Nom et version de l'app (`APP_NAME` partout, §0).
enum AppInfo {
    static let name = "Ombrelune"
    static var version: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0.1"
    }
}
