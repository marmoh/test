import Foundation
import Observation
import StoreKit

/// §11 StoreKit 2 : chargement des produits, achat, restauration, écoute de `Transaction.updates`,
/// crédit idempotent des consommables (via `PurchaseSink.credit`, qui mémorise l'identifiant de transaction),
/// état de l'Ordre du Dragon. Tester dans le simulateur avec `ios/Ombrelune.storekit`
/// (schéma Xcode › Run › Options › StoreKit Configuration).
@MainActor
@Observable
final class Store {
    enum PurchaseOutcome: Equatable {
        case purchased, pending, cancelled, failed(String)
    }

    private(set) var products: [ProductID: Product] = [:]
    private(set) var isLoading = false
    private(set) var entitlements = Entitlements()
    /// L'essai gratuit de 3 jours est-il encore proposable à ce compte ?
    private(set) var trialEligible = true
    var lastError: String?

    private let sink: PurchaseSink
    @ObservationIgnored private var updatesTask: Task<Void, Never>?

    init(sink: PurchaseSink) {
        self.sink = sink
        updatesTask = listenForTransactions()
    }

    var isDragon: Bool { entitlements.dragon.isActive }

    func product(_ id: ProductID) -> Product? { products[id] }

    // MARK: chargement

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let list = try await Product.products(for: ProductID.allCases.map(\.rawValue))
            var map: [ProductID: Product] = [:]
            for p in list { if let id = ProductID(rawValue: p.id) { map[id] = p } }
            products = map
            lastError = nil
        } catch {
            lastError = String(localized: "Boutique indisponible. Réessaie plus tard.")
        }
        await processUnfinished()
        await refreshEntitlements()
    }

    // MARK: achat

    func purchase(_ id: ProductID) async -> PurchaseOutcome {
        guard let product = products[id] else { return .failed(String(localized: "Produit introuvable")) }
        do {
            let result = try await product.purchase()
            return await handlePurchaseResult(result)
        } catch {
            lastError = error.localizedDescription
            return .failed(error.localizedDescription)
        }
    }

    /// Aussi appelé par `SubscriptionStoreView` (`.onInAppPurchaseCompletion`).
    func handlePurchaseResult(_ result: Product.PurchaseResult) async -> PurchaseOutcome {
        switch result {
        case .success(let verification):
            guard case .verified(let transaction) = verification else {
                return .failed(String(localized: "Achat non vérifié"))
            }
            await handle(transaction)
            return .purchased
        case .pending:
            return .pending // contrôle parental, SCA… : arrivera par `Transaction.updates`
        case .userCancelled:
            return .cancelled
        @unknown default:
            return .failed(String(localized: "Résultat inconnu", comment: "Achat : réponse inattendue de l’App Store"))
        }
    }

    // MARK: restauration

    /// « Restaurer les achats » : resynchronise le compte App Store puis relit les droits.
    func restore() async -> Bool {
        do {
            try await AppStore.sync()
            await refreshEntitlements()
            return true
        } catch {
            lastError = String(localized: "Restauration impossible pour le moment.")
            return false
        }
    }

    // MARK: transactions

    private func listenForTransactions() -> Task<Void, Never> {
        Task { [weak self] in
            for await update in Transaction.updates {
                guard let self else { return }
                if case .verified(let transaction) = update {
                    await self.handle(transaction)
                }
            }
        }
    }

    /// Transactions livrées pendant que l'app était fermée (ou jamais terminées après un crash).
    private func processUnfinished() async {
        for await result in Transaction.unfinished {
            if case .verified(let transaction) = result { await handle(transaction) }
        }
    }

    private func handle(_ transaction: Transaction) async {
        if let id = ProductID(rawValue: transaction.productID), transaction.revocationDate == nil {
            switch id.kind {
            case .gems, .starterPack:
                // idempotent : le registre est écrit avec les gemmes, avant `finish()` ;
                // une transaction redélivrée (crash avant `finish()`) n'est pas recréditée
                sink.credit(id, transactionID: transaction.id)
            case .seasonPass, .dragon:
                break // droits seulement
            }
        }
        await refreshEntitlements()
        await transaction.finish()
    }

    /// Recalcule les droits : non consommables possédés et état de l'abonnement.
    func refreshEntitlements() async {
        var e = Entitlements()
        for await result in Transaction.currentEntitlements {
            guard case .verified(let t) = result, t.revocationDate == nil, let id = ProductID(rawValue: t.productID) else { continue }
            switch id.kind {
            case .starterPack, .seasonPass: e.nonConsumables.insert(id)
            case .dragon, .gems: break
            }
        }
        e.dragon = await dragonStatus()
        entitlements = e
        sink.apply(e)
    }

    private func dragonStatus() async -> DragonStatus {
        guard let info = (products[.dragonMonthly] ?? products[.dragonYearly])?.subscription else { return .none }
        trialEligible = await info.isEligibleForIntroOffer
        guard let statuses = try? await info.status else { return .none }
        var best = DragonStatus.none
        for status in statuses {
            guard case .verified(let renewal) = status.renewalInfo,
                  case .verified(let transaction) = status.transaction else { continue }
            let active = status.state == .subscribed || status.state == .inGracePeriod
            guard active || !best.isActive else { continue }
            best = DragonStatus(
                isActive: active,
                productID: ProductID(rawValue: transaction.productID),
                expiresAt: transaction.expirationDate,
                inTrial: transaction.offerType == .introductory,
                willRenew: renewal.willAutoRenew,
                nextProductID: renewal.autoRenewPreference.flatMap(ProductID.init(rawValue:)).flatMap { $0.rawValue == transaction.productID ? nil : $0 }
            )
        }
        return best
    }

    /// Mis à jour par `.subscriptionStatusTask(for:)` dans les vues.
    func subscriptionStatusChanged() async {
        await refreshEntitlements()
    }
}
