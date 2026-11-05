# Phase Mac — de `ios/` à TestFlight

Ce document liste, dans l'ordre, tout ce qu'il reste à faire sur un Mac pour compiler, tester et distribuer
l'app iOS d'Ombrelune (SPEC §13–§14, TASKS M8). Le code Swift est complet ; le projet Xcode se **génère** avec
XcodeGen à partir de `ios/project.yml` (ne jamais éditer `Ombrelune.xcodeproj` à la main).

Contenu de `ios/` :

| Dossier | Rôle |
|---|---|
| `Core/` | Simulation déterministe (port Swift exact de `sim/src`), contenus JSON, économie pure. Foundation seul. |
| `Game/` | Combat SpriteKit : scène, rendu interpolé 60 i/s, fil et découpes, effets, entrée à un doigt. |
| `UI/` | Écrans SwiftUI (§12) et point d'entrée `OmbreluneApp.swift`. |
| `Services/` | Sauvegarde JSON + iCloud KV, StoreKit 2, Game Center, sons synthétisés, haptique, vies, publicité. |
| `Resources/` | `Assets.xcassets` (icône, couleurs) et atlas SpriteKit (`pnpm art:atlas`). |
| `Tests/` | XCTest : parité TS ↔ Swift (traces), bornes, formules, économie, monétisation. |

Le projet copie dans l'app les mêmes JSON que le web : `content/levels/` et `content/rooms/` (dossiers
`levels/` et `rooms/` du paquet), et dans le paquet de tests `content/traces/`.

---

## 1. Préparer le Mac

1. macOS 14 ou plus récent, **Xcode 16** (SDK iOS 17 minimum ; la cible de déploiement est iOS 17.0).
   Ouvrir Xcode une fois pour installer les composants, puis `xcode-select -p` doit pointer vers Xcode.
2. Homebrew puis XcodeGen : `brew install xcodegen` (version 2.42 ou plus récente : la clé
   `storeKitConfiguration` du schéma en dépend).
3. Pour régénérer contenus et traces : Node 22 et pnpm (`corepack enable`), puis `pnpm install` à la racine.
   **Garder Node 22** tant que les traces n'ont pas été vérifiées avec une version plus récente (DECISIONS #50).

## 2. Générer et ouvrir le projet

```sh
cd ios
xcodegen generate          # crée Ombrelune.xcodeproj, Generated/Info.plist, Ombrelune.entitlements
open Ombrelune.xcodeproj
```

- À refaire après chaque changement de `project.yml` ou ajout/suppression de fichiers Swift.
- Un nouvel atlas dans `Resources/Atlases/` doit être ajouté à la liste `sources` de `project.yml`
  (une ligne `{ path: Resources/Atlases/<Nom>.atlas, type: file, buildPhase: resources }`).

## 3. Signature et capacités

1. Dans `ios/project.yml`, remplacer l'identifiant provisoire `com.example.ombrelune` (et `…tests`) par le
   vrai identifiant, renseigner `DEVELOPMENT_TEAM`, puis `xcodegen generate`.
   (Ou : cible *Ombrelune* › *Signing & Capabilities* › *Team* ; mais la valeur sera perdue à la prochaine génération.)
2. Portail développeur (ou laisser Xcode le faire en signature automatique) — l'App ID doit avoir :
   - **In-App Purchase** ;
   - **Game Center** (entitlement `com.apple.developer.game-center`, déjà dans `project.yml`) ;
   - **iCloud › Key-value storage** (entitlement `com.apple.developer.ubiquity-kvstore-identifier`,
     déjà dans `project.yml`, valeur `$(TeamIdentifierPrefix)$(CFBundleIdentifier)`).
3. Vérifier dans *Signing & Capabilities* que les trois capacités apparaissent sans erreur.

## 4. Premier lancement (simulateur)

1. Schéma **Ombrelune**, destination *iPhone 15* (ou 16), ⌘R.
2. Le schéma utilise déjà la configuration StoreKit locale `Ombrelune.storekit`
   (*Product › Scheme › Edit Scheme › Run › Options › StoreKit Configuration*) : les achats fonctionnent sans
   App Store Connect.
3. Parcours de recette (tout doit marcher) :
   - écran titre « Lever le rideau » → carte saga (300 nœuds, royaumes, étoiles, crânes, boss, avatar) ;
   - barre du haut : vies (minuteur), étoiles, or, gemmes (+ → boutique) ; bandeaux tournoi et pass ;
     navigation basse : Héros, Boutique, Carte, Pass, Tournoi, Réglages ;
   - niveau 1 : pré-niveau (bonus, achat d'un bonus épuisé), combat au doigt (ancre flottante, halo jade sous
     l'héroïne), tir automatique, fil et boucles (aide « Encercle-le pour le découper » aux niveaux 1–3),
     découpe (éclair, trou, morceau qui tombe), barre de vie au-dessus de la tête, « Salle 1/2 », pause ;
   - choix du pouvoir entre deux salles (3 cartes qui se retournent) ; victoire (étoiles une à une, or,
     lunes du pass, coffre d'étoiles tous les 20 ★) ; défaite (continuer 60 puis 120 gemmes, réessayer, carte,
     lien Ordre du Dragon) ;
   - perdre 5 fois : 1re panne → offre de l'Ordre du Dragon, puis feuille des vies (publicité factice 5 s,
     recharge 90 gemmes) ;
   - Héros et talents, Boutique (gemmes, offre de départ, Ordre du Dragon), Pass de saison (réclamer,
     « Tout réclamer », piste premium), Tournoi (règles, essais, score, classement), Réglages (son, musique,
     vibrations, tir auto, réduire les animations, gérer l'abonnement, restaurer, confidentialité/ATT, crédits,
     effacer la progression).
4. « Réduire les animations » (réglage du jeu ou réglage d'accessibilité iOS) coupe secousses et arrêts sur image.

## 5. Tests

- ⌘U (schéma Ombrelune) lance `OmbreluneTests` :
  - `ParityTests` : vecteurs mathématiques V8, 27 niveaux générés, 8 niveaux joués par les bots et 7 salles
    scriptées rejoués **au bit près** (`content/traces/`) ;
  - `CoreTests` : bornes 150 projectiles / 30 ennemis, coût d'un pas de simulation saturé, formules,
    contrôles, gabarits, cohérence des 300 niveaux ;
  - `EconomyTests` : progression, coffres d'étoiles, pass de saison (parité `web/src/season.ts`), sauvegarde
    JSON, fusion iCloud ;
  - `MonetizationTests` : crédit idempotent, publicité récompensée, vies, Ordre du Dragon.
- Après **toute** modification de `sim/src` : reporter la modification dans `ios/Core/` (même ordre des
  opérations), puis `pnpm traces` et relancer les tests. Un écart affiche le premier pas divergent et l'état
  (positions, PV, nombres d'ennemis et de projectiles).
- `testAllLevelsLoadAndAreConsistent` échoue si `content/levels/level_NNNN.json` ne correspond plus au
  générateur : `pnpm levels:gen --revalidate` (l'app, elle, régénère depuis `index.json` comme le web).
- Les tests du cœur tournent aussi hors Xcode (Linux ou Mac) avec un paquet SwiftPM temporaire qui
  référence `ios/Core/*.swift` et `ios/Tests/{ParityTests,CoreTests}.swift` ; variable `OMBRELUNE_REPO`
  = racine du dépôt (méthode utilisée pendant le développement).

## 6. StoreKit en local

1. *Debug › StoreKit › Manage Transactions* : voir, rembourser, supprimer les achats de test.
2. Vérifier : gemmes créditées **une seule fois** (relancer l'app avant `finish()` ne recrédite pas) ;
   offre de départ (300 gemmes, Moine du vent, 5 bonus) ; pass de saison (piste premium, paliers déjà atteints
   compris) ; Ordre du Dragon (essai de 3 jours, renouvellement accéléré via *Editor › Time Rate*, résiliation,
   changement de formule) ; *Restaurer les achats* ; *Ask to Buy* (achat en attente).
3. Le pass a un produit **par saison** (`ombrelune.pass.season<N>`, saisons de 6 semaines depuis le
   2 novembre 2026). Seule la saison 1 est déclarée (`ProductID.seasonPass1`, `.storekit`) : avant le
   14 décembre 2026, ajouter `seasonPass2 = "ombrelune.pass.season2"` dans `Services/ProductCatalog.swift`, le
   produit dans `Ombrelune.storekit` et dans App Store Connect (sinon l'écran affiche « Bientôt »).

## 7. App Store Connect

1. Créer l'app (même identifiant de paquet), langue principale **Français**, catégorie Jeux.
2. **Achats intégrés** — mêmes identifiants que `Ombrelune.storekit` :

   | Identifiant | Type | Prix |
   |---|---|---|
   | `ombrelune.gems.handful` | Consommable | 0,99 € (100 gemmes) |
   | `ombrelune.gems.pouch` | Consommable | 4,99 € (550 gemmes) |
   | `ombrelune.gems.chest` | Consommable | 9,99 € (1 200 gemmes) |
   | `ombrelune.starter` | Non consommable | 2,99 € |
   | `ombrelune.pass.season1` | Non consommable | 4,99 € |
   | `ombrelune.dragon.monthly` | Abonnement auto-renouvelable | 4,99 €/mois, essai gratuit 3 jours |
   | `ombrelune.dragon.yearly` | Abonnement auto-renouvelable | 39,99 €/an, essai gratuit 3 jours |

3. Groupe d'abonnement « Ordre du Dragon » : reporter son identifiant dans `ProductID.dragonGroupID`
   (`Services/ProductCatalog.swift`, utilisé par `SubscriptionStoreView`).
4. Textes légaux définitifs (conditions, confidentialité) : remplacer le brouillon `PolicyText`
   (`UI/DragonView.swift`) et renseigner les URL dans la fiche (obligatoires sous l'offre d'abonnement).
5. Étiquette de confidentialité (« Privacy Nutrition Label ») : aucune donnée collectée par l'app elle-même ;
   à compléter quand le réseau publicitaire sera branché (§9 ci-dessous).

## 8. Game Center (sandbox)

1. App Store Connect › *Game Center* : activer, puis créer le **classement récurrent** :
   - identifiant **`ombrelune.tournament.weekly`** (`GameCenterService.weeklyLeaderboardID`) ;
   - type *Recurring*, début **lundi 00:00 UTC**, durée **1 semaine** ;
   - format entier, tri décroissant (le plus haut gagne), soumission *meilleur score* ;
   - nom localisé « Tournoi de la semaine ».
2. Sur l'iPhone de test : *Réglages › Game Center* › section *Développeur* › se connecter avec un compte
   **sandbox**. Lancer l'app (fenêtre de connexion Game Center), jouer un essai de tournoi : le score part au
   classement ; l'écran du tournoi affiche le haut du classement et « Ouvrir le classement Game Center ».
3. Hors connexion, le meilleur score est gardé et renvoyé à l'ouverture suivante de l'écran du tournoi.
4. Les distinctions (top 1 %, 10 %, 50 %, participation) apparaissent après la première semaine révolue
   (occurrence précédente du classement).

## 9. Vrai réseau publicitaire (publicité récompensée « +1 vie »)

Le détail est en tête de `ios/Services/AdService.swift` ; résumé :

1. Ajouter le SDK (AdMob *GoogleMobileAds* ou AppLovin *AppLovinSDK*) dans `project.yml` :
   section `packages:` + `dependencies: - package: …` de la cible, puis `xcodegen generate`.
2. Ajouter les `SKAdNetworkItems` fournis par le réseau dans `info.properties` de `project.yml`
   (`NSUserTrackingUsageDescription` y est déjà).
3. Écrire `AdMobRewardedAdService: AdService` (chargement, présentation depuis le contrôleur racine, résoudre
   `.rewarded` **uniquement** dans le rappel de récompense du SDK).
4. Formulaire de consentement UMP (Google) ou CMP (AppLovin) avant le premier chargement ; sans accord ATT ni
   consentement, publicités **non personnalisées** (`npa=1`).
5. Dans `Services/AppModel.swift`, remplacer `ads = MockAdService()` par le vrai service ; retirer
   `.mockAds(app.ads)` de la feuille des vies (`UI/OmbreluneApp.swift`). Les vues ne connaissent que `AdService`.
6. Mettre à jour l'étiquette de confidentialité et joindre le `PrivacyInfo.xcprivacy` du SDK.

## 10. Polices, icône

1. Polices OFL : `IMFellEnglishSC-Regular.ttf` et Alegreya Sans (Regular, Medium, Bold, ExtraBold,
   MediumItalic) dans `ios/Resources/Fonts/`, plus le texte de la licence OFL. Dans `project.yml` :
   ajouter `- path: Resources/Fonts` aux sources de la cible et
   `UIAppFonts: [IMFellEnglishSC-Regular.ttf, AlegreyaSans-Regular.ttf, …]` aux `info.properties`.
   Sans les fichiers, l'app utilise les polices système (aucune erreur).
2. Icône : une image 1024 × 1024 PNG sans transparence dans `Resources/Assets.xcassets/AppIcon.appiconset`
   (référencée dans son `Contents.json`).

## 11. Profilage sur iPhone 11 (objectif §13 : 60 i/s)

1. Brancher un iPhone 11 (iOS 17+), schéma *Profile* (configuration Release), *Product › Profile* (⌘I).
2. Scénarios : niveau 300 (boss), tournoi de la semaine, salle saturée ; et `CoreTests.testSaturatedStepCost`.
3. Instruments :
   - **Time Profiler** : `GameScene.update` doit rester sous ~8 ms par image (dont ≤ 2 pas de simulation) ;
   - **SpriteKit / Metal System Trace** (ou `showsFPS`/`showsNodeCount` dans `GameViewHost`) : 60 i/s stables,
     nombre de nœuds et de passes de dessin ;
   - **Allocations** : pas de croissance pendant 10 minutes de jeu (réserves de nœuds réutilisées : projectiles,
     particules, textes) ; mémoire des atlas (21,5 Mo de PNG sur disque).
4. Leviers si besoin : réduire la limite de particules (600, `FX`), le nombre de tranches du fil (6,
   `ThreadNode`), désactiver la tramée du décor animé, précharger les atlas (`TextureBank.preload`).

## 12. TestFlight

1. Numéros de version : `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` dans `project.yml`
   (incrémenter le numéro de build à chaque envoi), `xcodegen generate`.
2. *Product › Archive* (configuration Release, destination *Any iOS Device*), puis *Distribute App ›
   App Store Connect › Upload*. `ITSAppUsesNonExemptEncryption` est déjà à `false`.
3. App Store Connect › TestFlight : test interne immédiat ; pour le test externe, remplir les informations
   de test, l'étiquette de confidentialité, l'âge, et soumettre à la vérification bêta.
4. Les achats en TestFlight utilisent la sandbox (pas de débit) ; l'Ordre du Dragon se renouvelle en accéléré.

## 13. Reste à faire connu

- Images d'atlas des apparences (pass de saison, Parure du Dragon) : esquisses SpriteKit en attendant (DECISIONS #56).
- Particules d'ambiance par royaume (lucioles, spores, sable, neige, braises) du web : non portées.
- Musique : boîte à musique synthétisée, comme le web ; sons et musique suivent les Réglages.
- Saisons 2 et suivantes du pass : produit StoreKit à ajouter avant chaque saison (§6.3).
- Textes légaux définitifs (TASKS M8).
