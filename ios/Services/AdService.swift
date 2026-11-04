import Foundation
import Observation
#if canImport(AppTrackingTransparency)
import AppTrackingTransparency
#endif

/*
 Publicité récompensée « +1 vie » (DECISIONS #37).

 Règles (identiques au prototype web, `web/src/economy.ts`) :
 - uniquement à la demande du joueur (« Regarder une courte pub → +1 vie »), proposée sur l'écran
   « Plus de vies » et depuis le compteur de vies de la carte ;
 - jamais imposée, jamais en combat, jamais en tournoi, jamais pour les membres de l'Ordre du Dragon ;
 - 3 par jour (jour local), 15 min entre deux, et seulement si les vies ne sont pas pleines.

 ─── Brancher un vrai réseau plus tard (AdMob ou AppLovin MAX) ───
 1. Ajouter le SDK par Swift Package Manager dans `project.yml` (GoogleMobileAds ou AppLovinSDK) et les
    `SKAdNetworkItems` fournis par le réseau dans l'Info.plist.
 2. Écrire `AdMobRewardedAdService: AdService` (ou `AppLovinRewardedAdService`) :
    `load()` → `RewardedAd.load(with:request:)` / `MARewardedAd.shared(withAdUnitIdentifier:)` ;
    `presentRewarded()` → présenter depuis le `rootViewController` et résoudre `.rewarded` **uniquement**
    dans le rappel de récompense du SDK (`userDidEarnReward` / `didRewardUser`), `.dismissed` sinon.
    Utiliser la vérification côté serveur (SSV) si un serveur existe un jour.
 3. Consentement : avant le premier chargement, afficher le formulaire de consentement RGPD du réseau
    (Google UMP / AppLovin CMP, obligatoire dans l'UE). Le réglage « Publicités personnalisées »
    (désactivé par défaut) pilote la demande ATT ci-dessous ; sans accord ATT ni consentement,
    demander des publicités **non personnalisées** (`npa=1` pour AdMob).
 4. ATT : ajouter `NSUserTrackingUsageDescription` à l'Info.plist, par exemple
    « Permet d’afficher des publicités adaptées quand tu choisis d’en regarder une pour gagner une vie. »
    Ne demander l'autorisation qu'au moment où le joueur active « Publicités personnalisées ».
 5. Confidentialité : mettre à jour le « Privacy Nutrition Label » d'App Store Connect (identifiants
    publicitaires, données d'usage collectées par le réseau) et le `PrivacyInfo.xcprivacy` du SDK.
 6. Remplacer `MockAdService` par le vrai service à l'injection (une ligne dans l'app), sans toucher aux vues :
    elles ne connaissent que `AdService` et `RewardedAdPolicy`.
 */

enum AdResult: Equatable, Sendable {
    /// Vue jusqu'au bout : créditer la vie.
    case rewarded
    /// Fermée avant la fin : rien.
    case dismissed
    /// Pas de publicité disponible (réseau, absence de remplissage).
    case unavailable
}

@MainActor
protocol AdService: AnyObject {
    var isReady: Bool { get }
    func load() async
    /// Présente une publicité récompensée. Ne jamais appeler en combat ni en tournoi.
    func presentRewarded() async -> AdResult
}

/// Compteur des publicités vues (persisté avec les vies).
struct AdLedger: Codable, Equatable, Sendable {
    /// Jour local « AAAA-MM-JJ ».
    var day = ""
    var count = 0
    var lastAt: TimeInterval = 0
}

/// Limites de la publicité récompensée : pures et testées (`MonetizationTests`).
enum RewardedAdPolicy {
    static let perDay = 3
    static let cooldown: TimeInterval = 15 * 60

    enum Block: Equatable, Sendable { case subscriber, full, daily, cooldown }

    struct Status: Equatable, Sendable {
        var ok: Bool
        var reason: Block?
        /// Publicités encore possibles aujourd'hui.
        var left: Int
        /// Secondes avant la prochaine (délai).
        var wait: TimeInterval
    }

    static func dayKey(_ date: Date, calendar: Calendar = .current) -> String {
        let c = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    static func status(_ ledger: AdLedger, now: TimeInterval, day: String, subscribed: Bool, lives: Int) -> Status {
        let count = ledger.day == day ? ledger.count : 0
        let left = max(0, perDay - count)
        let wait = ledger.lastAt > 0 ? max(0, (ledger.lastAt + cooldown - now).rounded(.up)) : 0
        if subscribed { return Status(ok: false, reason: .subscriber, left: left, wait: 0) }
        if lives >= LivesState.max { return Status(ok: false, reason: .full, left: left, wait: 0) }
        if left <= 0 { return Status(ok: false, reason: .daily, left: 0, wait: 0) }
        if wait > 0 { return Status(ok: false, reason: .cooldown, left: left, wait: wait) }
        return Status(ok: true, reason: nil, left: left, wait: 0)
    }

    static func record(_ ledger: AdLedger, now: TimeInterval, day: String) -> AdLedger {
        AdLedger(day: day, count: (ledger.day == day ? ledger.count : 0) + 1, lastAt: now)
    }
}

/// Publicité factice (simulateur, tests, tant qu'aucun réseau n'est branché) : 5 s, marquée
/// « Publicité simulée », présentée par `MockAdOverlay` (voir `LivesView.swift`).
@MainActor
@Observable
final class MockAdService: AdService {
    static let duration: TimeInterval = 5

    private(set) var isPresenting = false
    @ObservationIgnored private var continuation: CheckedContinuation<AdResult, Never>?

    var isReady: Bool { true }

    func load() async {}

    func presentRewarded() async -> AdResult {
        guard !isPresenting else { return .unavailable }
        return await withCheckedContinuation { c in
            continuation = c
            isPresenting = true
        }
    }

    /// Appelé par l'overlay : `.rewarded` si le compte à rebours est allé au bout.
    func finish(_ result: AdResult) {
        isPresenting = false
        continuation?.resume(returning: result)
        continuation = nil
    }
}

/// Consentement publicitaire : réglage « Publicités personnalisées » + App Tracking Transparency.
enum AdPrivacy {
    /// Demande ATT au moment où le joueur active les publicités personnalisées. Renvoie l'accord effectif.
    @MainActor
    static func requestPersonalizedAds() async -> Bool {
        #if canImport(AppTrackingTransparency)
        switch ATTrackingManager.trackingAuthorizationStatus {
        case .authorized: return true
        case .notDetermined:
            return await ATTrackingManager.requestTrackingAuthorization() == .authorized
        default: return false
        }
        #else
        return false
        #endif
    }
}
