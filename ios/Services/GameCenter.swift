import GameKit
import SwiftUI
import Observation
import UIKit

/// Game Center (§10) : authentification et classement **récurrent hebdomadaire** du tournoi.
/// Le classement se crée dans App Store Connect (Game Center › Classements › « Récurrent »,
/// début lundi 00:00 UTC, durée 1 semaine) avec l'identifiant `GameCenterService.weeklyLeaderboardID`
/// (voir `docs/MAC_PHASE.md`). Sans Game Center, le tournoi reste jouable ; le score est gardé localement
/// et renvoyé plus tard.
@MainActor
@Observable
final class GameCenterService {
    static let weeklyLeaderboardID = "ombrelune.tournament.weekly"

    struct Entry: Identifiable, Equatable {
        var id: String { "\(rank)-\(name)" }
        var rank: Int
        var name: String
        var score: Int
        var isLocal: Bool
    }

    private(set) var isAuthenticated = false
    private(set) var playerName: String?
    private(set) var entries: [Entry] = []
    private(set) var localEntry: Entry?
    private(set) var totalPlayers = 0
    private(set) var isLoading = false
    private(set) var lastError: String?

    /// Lance l'authentification (fenêtre Game Center présentée si nécessaire).
    func authenticate() {
        GKLocalPlayer.local.authenticateHandler = { [weak self] vc, error in
            Task { @MainActor in
                guard let self else { return }
                if let vc { Self.present(vc) }
                self.isAuthenticated = GKLocalPlayer.local.isAuthenticated
                self.playerName = GKLocalPlayer.local.isAuthenticated ? GKLocalPlayer.local.displayName : nil
                if let error { self.lastError = error.localizedDescription }
            }
        }
    }

    private static func present(_ vc: UIViewController) {
        let root = UIApplication.shared.connectedScenes
            .compactMap { ($0 as? UIWindowScene)?.keyWindow }
            .first?.rootViewController
        var top = root
        while let p = top?.presentedViewController { top = p }
        top?.present(vc, animated: true)
    }

    /// Envoie un score au classement de la semaine en cours. Renvoie vrai si Game Center l'a accepté.
    func submit(score: Int) async -> Bool {
        guard GKLocalPlayer.local.isAuthenticated else { return false }
        do {
            try await GKLeaderboard.submitScore(score, context: 0, player: GKLocalPlayer.local, leaderboardIDs: [Self.weeklyLeaderboardID])
            return true
        } catch {
            lastError = error.localizedDescription
            return false
        }
    }

    /// Charge le haut du classement de la semaine et la place du joueur.
    func loadTop(count: Int = 10) async {
        guard GKLocalPlayer.local.isAuthenticated else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            guard let board = try await GKLeaderboard.loadLeaderboards(IDs: [Self.weeklyLeaderboardID]).first else { return }
            let (local, list, total) = try await board.loadEntries(for: .global, timeScope: .allTime, range: NSRange(location: 1, length: count))
            let me = GKLocalPlayer.local.gamePlayerID
            entries = list.map { Entry(rank: $0.rank, name: $0.player.displayName, score: $0.score, isLocal: $0.player.gamePlayerID == me) }
            localEntry = local.map { Entry(rank: $0.rank, name: $0.player.displayName, score: $0.score, isLocal: true) }
            totalPlayers = total
            lastError = nil
        } catch {
            lastError = error.localizedDescription
        }
    }

    /// Rang du joueur la semaine précédente (récompenses cosmétiques : top 1 %, 10 %, 50 %, participation).
    func previousWeekStanding() async -> (rank: Int, total: Int)? {
        guard GKLocalPlayer.local.isAuthenticated else { return nil }
        do {
            guard let board = try await GKLeaderboard.loadLeaderboards(IDs: [Self.weeklyLeaderboardID]).first else { return nil }
            // selon le SDK, la valeur est importée optionnelle ou non : on la normalise
            let previous: GKLeaderboard? = try await board.loadPreviousOccurrence()
            guard let prev = previous else { return nil }
            let (local, _, total) = try await prev.loadEntries(for: .global, timeScope: .allTime, range: NSRange(location: 1, length: 1))
            guard let local, total > 0 else { return nil }
            return (local.rank, total)
        } catch {
            return nil
        }
    }

    /// Palier de récompense cosmétique d'un classement.
    static func honorTier(rank: Int, total: Int) -> String {
        let pct = Double(rank) / Double(max(1, total))
        if pct <= 0.01 { return "top 1 %" }
        if pct <= 0.10 { return "top 10 %" }
        if pct <= 0.50 { return "top 50 %" }
        return "participation"
    }
}

/// Classement Game Center natif (feuille).
@MainActor
struct GameCenterLeaderboardView: UIViewControllerRepresentable {
    @Environment(\.dismiss) private var dismiss

    func makeCoordinator() -> Coordinator { Coordinator(dismiss: { dismiss() }) }

    func makeUIViewController(context: Context) -> GKGameCenterViewController {
        let vc = GKGameCenterViewController(leaderboardID: GameCenterService.weeklyLeaderboardID, playerScope: .global, timeScope: .allTime)
        vc.gameCenterDelegate = context.coordinator
        return vc
    }

    func updateUIViewController(_ vc: GKGameCenterViewController, context: Context) {}

    final class Coordinator: NSObject, GKGameCenterControllerDelegate {
        let dismiss: () -> Void
        init(dismiss: @escaping () -> Void) { self.dismiss = dismiss }
        func gameCenterViewControllerDidFinish(_ gameCenterViewController: GKGameCenterViewController) {
            // GameKit appelle ce délégué sur le fil principal.
            MainActor.assumeIsolated {
                gameCenterViewController.dismiss(animated: true)
                dismiss()
            }
        }
    }
}
