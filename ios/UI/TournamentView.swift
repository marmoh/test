import SwiftUI

/// Tournoi hebdomadaire (§10, `tournamentSheet` du web) : règles, essais restants, meilleur score,
/// classement Game Center récurrent hebdomadaire, distinctions cosmétiques.
@MainActor
struct TournamentView: View {
    @Environment(AppModel.self) private var app
    @State private var showBoard = false

    var body: some View {
        let wk = Formulas.isoWeek(Date())
        let t = app.progress.tournament(week: app.weekKey)
        let example = Formulas.tournamentScore(kills: 42, hpLeft: 380, seconds: 150)
        VStack(spacing: 0) {
            SheetHeader(title: "Tournoi · semaine \(wk.week)")
            ScrollView {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 12) {
                        InkIcon(name: "ui_trophy", size: 48, fallback: "trophy.fill")
                        VStack(alignment: .leading, spacing: 2) {
                            Text("4 salles · difficulté niveau 120").font(Theme.text(16, weight: .bold))
                            Text("Même niveau, mêmes pouvoirs proposés et même héroïne pour tout le monde.").font(Theme.note(13)).foregroundStyle(Theme.ink2)
                        }
                    }
                    HStack(spacing: 10) {
                        statBox("Essais restants", "\(t.attempts)/\(TournamentState.attemptsPerWeek)")
                        statBox("Ton meilleur score", t.best > 0 ? Fmt.int(t.best) : "—")
                    }
                    SectionTitle(text: "Règles")
                    rule("Talents, bonus et « continuer » désactivés.")
                    rule("\(TournamentState.attemptsPerWeek) essais par semaine pour tout le monde, non achetables.")
                    rule("Score = ennemis × 100 + PV restants × 5 + (240 − secondes) × 40. Exemple : 42 ennemis, 380 PV, 150 s → \(Fmt.int(example)).")
                    rule("Ton meilleur essai compte. Récompenses cosmétiques : top 1 %, 10 %, 50 % et participation.")

                    SectionTitle(text: "Classement de la semaine")
                    leaderboard
                    if !app.progress.data.honors.isEmpty {
                        SectionTitle(text: "Tes distinctions")
                        ForEach(app.progress.data.honors, id: \.self) { h in
                            HStack(spacing: 6) {
                                InkIcon(name: "ui_trophy", size: 18, fallback: "rosette")
                                Text(HonorText.display(h)).font(Theme.text(14, weight: .bold))
                            }
                        }
                    }
                    Button("Jouer (\(t.attempts) essais)") {
                        app.audio.play(.tap)
                        app.playTournament()
                    }
                    .buttonStyle(InkButtonStyle(kind: .primary))
                    .disabled(t.attempts <= 0 || app.content == nil)
                    .opacity(t.attempts <= 0 ? 0.5 : 1)
                    .padding(.top, 10)
                }
                .foregroundStyle(Theme.ink)
                .padding(.horizontal, 20)
                .padding(.bottom, 30)
            }
        }
        .background(PaperBackground())
        .toast(Binding(get: { app.toast }, set: { app.toast = $0 }))
        .task { @MainActor in
            app.submitBestScore()
            await app.gameCenter.loadTop()
            await app.checkTournamentHonors()
        }
        .sheet(isPresented: $showBoard) { GameCenterLeaderboardView().ignoresSafeArea() }
    }

    @ViewBuilder private var leaderboard: some View {
        let gc = app.gameCenter
        if !gc.isAuthenticated {
            Text("Connecte-toi à Game Center (Réglages iOS › Game Center) pour voir le classement. Tes scores sont gardés et envoyés dès la connexion.")
                .font(Theme.note(13)).foregroundStyle(Theme.ink2)
        } else if gc.isLoading && gc.entries.isEmpty {
            ProgressView().tint(Theme.ink)
        } else if gc.entries.isEmpty {
            Text("Personne n’a encore joué cette semaine. Sois la première ombre au tableau !").font(Theme.note(13)).foregroundStyle(Theme.ink2)
        } else {
            VStack(spacing: 0) {
                ForEach(gc.entries) { e in entryRow(e) }
                if let me = gc.localEntry, !gc.entries.contains(where: { $0.isLocal }) {
                    Text(verbatim: "…").font(Theme.text(14))
                    entryRow(me)
                }
            }
            Text("\(gc.totalPlayers) participants").font(Theme.note(12)).foregroundStyle(Theme.ink2)
        }
        if gc.isAuthenticated {
            Button("Ouvrir le classement Game Center") { showBoard = true }
                .font(Theme.text(14, weight: .bold))
                .underline()
                .foregroundStyle(Theme.ink)
        }
    }

    private func entryRow(_ e: GameCenterService.Entry) -> some View {
        HStack {
            Text(verbatim: "\(e.rank)").font(Theme.display(16)).frame(width: 36, alignment: .leading)
            Text(e.name).font(Theme.text(15, weight: e.isLocal ? .heavy : .regular)).lineLimit(1)
            Spacer()
            Text(Fmt.int(e.score)).font(Theme.text(15, weight: .bold)).monospacedDigit()
        }
        .padding(.vertical, 6)
        .padding(.horizontal, 6)
        .background(e.isLocal ? Theme.goldLeaf.opacity(0.2) : Color.clear)
        .overlay(alignment: .bottom) { DashedRule() }
    }

    private func statBox(_ label: LocalizedStringKey, _ value: String) -> some View {
        VStack(spacing: 2) {
            Text(label).font(Theme.note(12)).foregroundStyle(Theme.ink2)
            Text(value).font(Theme.display(24))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .paperCard(shadow: 3)
    }

    private func rule(_ s: LocalizedStringKey) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text(verbatim: "•").font(Theme.text(15, weight: .heavy)).foregroundStyle(Theme.vermilion)
            Text(s).font(Theme.text(14)).fixedSize(horizontal: false, vertical: true)
        }
    }
}
