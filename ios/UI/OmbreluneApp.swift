import SwiftUI

/// Point d'entrée de l'app iOS (« Ombrelune », `APP_NAME`).
@main
@MainActor
struct OmbreluneApp: App {
    @State private var app = AppModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(app)
                .task { @MainActor in await app.launch() }
                .preferredColorScheme(.light)
                .statusBarHidden(app.combat != nil)
        }
    }
}

/// Navigation : écran titre → carte saga (barre du haut, bandeaux, navigation basse) ; feuilles pour les écrans
/// secondaires ; le combat en plein écran.
@MainActor
struct RootView: View {
    @Environment(AppModel.self) private var app

    var body: some View {
        @Bindable var app = app
        ZStack {
            if let error = app.loadError {
                ContentErrorView(message: error)
            } else if app.showTitle {
                TitleView { withAnimation(.easeInOut(duration: 0.6)) { app.showTitle = false } }
                    .transition(.opacity)
            } else {
                MapScreen()
                    .transition(.opacity)
            }
        }
        .sheet(item: $app.sheet, onDismiss: { app.sheetDismissed() }) { sheet in
            sheetView(sheet)
        }
        .fullScreenCover(item: $app.combat) { session in
            CombatScreen(session: session)
                .environment(app)
        }
        .toast($app.toast)
    }

    @ViewBuilder
    private func sheetView(_ sheet: AppModel.Sheet) -> some View {
        switch sheet {
        case .preLevel(let n):
            PreLevelView(n: n)
        case .heroes:
            HeroesView()
        case .gear:
            HeroesView(tab: .gear)
        case .quests:
            QuestsView()
        case .bestiary:
            BestiaryView()
        case .heroUnlocked(let id):
            HeroUnlockedView(hero: id)
        case .shop:
            ShopView()
        case .pass:
            SeasonPassView()
        case .tournament:
            TournamentView()
        case .settings:
            SettingsView(settings: app.settings, store: app.store, wallet: app.wallet, lives: app.lives) {
                app.eraseProgress()
            }
        case .lives:
            // la publicité (factice) se présente depuis la feuille des vies, seul endroit où elle est proposée
            LivesView(lives: app.lives, wallet: app.wallet, store: app.store, ads: app.ads, settings: app.settings)
                .mockAds(app.ads)
        case .leaderboard:
            GameCenterLeaderboardView().ignoresSafeArea()
        case .dragon(let context):
            DragonView(context: context, store: app.store, wallet: app.wallet)
        }
    }
}

/// Contenus manquants (paquet incomplet) : message clair au lieu d'un écran vide.
@MainActor
struct ContentErrorView: View {
    let message: String
    var body: some View {
        VStack(spacing: 12) {
            Text("Contenu introuvable").font(Theme.display(28))
            Text("Les niveaux et les salles (`levels/`, `rooms/`) ne sont pas dans le paquet de l’app. Relancer `xcodegen generate` depuis `ios/`.")
                .font(Theme.text(15)).multilineTextAlignment(.center)
            Text(message).font(Theme.note(12)).foregroundStyle(Theme.ink2)
        }
        .foregroundStyle(Theme.ink)
        .padding(30)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(PaperBackground())
    }
}
