# Monétisation, réglages et publicité — état et branchements

Référence : SPEC §8 (vies), §11 (monétisation), §12.6 (Réglages) ; DECISIONS #37 (publicité récompensée) et #38.

## Règles communes (web et iOS)
| Sujet | Règle | Code |
|---|---|---|
| Ordre du Dragon | 4,99 €/mois ou 39,99 €/an, essai gratuit de 3 jours (une fois) | `web/src/economy.ts` (`DRAGON`), `ios/Services/ProductCatalog.swift` |
| Avantages | vies illimitées (`afterAttempt(…, unlimited)`), 60 gemmes par semaine ISO à réclamer, Parure du Dragon, +25 % d'or | idem + `web/src/skins.ts` |
| Paywall | 1re panne de vies, bouton secondaire de la défaite, boutique (+ « Gérer l'abonnement » dans les Réglages). Jamais en combat. | `web/src/dragon.ts` (`openDragon`, `outOfLives`), `ios/UI/DragonView.swift` |
| Pub récompensée | à la demande, +1 vie, 3/jour, 15 min entre deux ; pas pour les abonnés, pas avec 5 vies, jamais en combat ni en tournoi | `REWARDED_AD` / `RewardedAdPolicy` |
| Consentement | « Publicités personnalisées » désactivé par défaut ; iOS : demande ATT à l'activation | `web/src/state.ts`, `ios/Services/AdService.swift` (`AdPrivacy`) |
| Effacer la progression | tout sauf les achats (restaurables) | `eraseProgress()` / `Wallet.eraseProgress()` |

## Prototype web
- Abonnement simulé dans la sauvegarde (`Save.subscription` : formule, date de fin, essai, renouvellement, semaine des gemmes, parure).
  Un « compte App Store » simulé (`ombrelune.store.v1`) survit à l'effacement et sert à « Restaurer les achats ».
- Publicité simulée : fenêtre « Entracte » de 5 s marquée « Publicité simulée », fermable sans récompense.

## iOS — à faire pendant la phase Mac (M8)
1. **StoreKit local** : schéma › Run › Options › *StoreKit Configuration* = `Ombrelune.storekit`. Recréer les produits
   dans App Store Connect avec les mêmes identifiants ; reporter l'identifiant du groupe dans `ProductID.dragonGroupID`.
2. **Injection** (racine de l'app) : `let wallet = Wallet()`, `let store = Store(sink: wallet)`, `.task { await store.load() }`,
   `let ads = MockAdService()` et `.mockAds(ads)` à la racine ; passer `GameSettings`, `LivesCenter`, `Store`, `Wallet`
   aux vues `SettingsView`, `DragonView`, `LivesView`. Quand la persistance JSON + iCloud KV sera portée, elle implémentera
   `PurchaseSink` (le registre `CreditLedger` doit être écrit dans la **même** écriture que les gemmes).
3. **Polices** : ajouter `IMFellEnglishSC-Regular.ttf` et les graisses d'Alegreya Sans (OFL) dans `Resources/Fonts`,
   les déclarer dans `UIAppFonts`, et joindre le texte de la licence OFL.
4. **Vrai réseau publicitaire** (AdMob ou AppLovin MAX) : suivre la note en tête de `ios/Services/AdService.swift`
   (SDK, `SKAdNetworkItems`, formulaire de consentement UMP/CMP, `NSUserTrackingUsageDescription`, étiquette de
   confidentialité App Store Connect, `PrivacyInfo.xcprivacy`), puis remplacer `MockAdService` à l'injection.
5. **Textes légaux** : conditions et politique de confidentialité définitives (`PolicyText` dans `DragonView.swift`
   n'est qu'un brouillon), liens obligatoires sous l'offre d'abonnement.
