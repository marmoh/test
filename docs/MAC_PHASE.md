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

## État au 5 novembre 2026 (Mac, Xcode 26.6, iPhone 17 / iOS 26 en simulateur)

| Étape | État |
|---|---|
| Outils | Node 22.23.4 (Homebrew `node@22`, `.nvmrc`), pnpm 10.28.0 (corepack), XcodeGen 2.46.0, Xcode 26.6 |
| `pnpm install` + `pnpm verify` | ✅ 78 tests vitest, 24 gabarits, 300 niveaux dans leurs bandes |
| Signature | ✅ équipe **P42VAGHFV3** (Mh MIZOURI), identifiant **`com.marmoh.ombrelune`** ; l'App ID a été créé par Xcode avec Game Center et iCloud (clé-valeur) |
| Compilation simulateur | ✅ sans erreur ni avertissement (seule reste la note d'Xcode « Metadata extraction skipped. No AppIntents.framework dependency found », émise pour toute app sans AppIntents) |
| XCTest | ✅ 30/30 : `ParityTests` 4 (traces rejouées au bit près), `CoreTests` 11, `EconomyTests` 9, `MonetizationTests` 6 |
| Recette visuelle | ✅ titre, carte, boutique, pass, tournoi, réglages, combat avec boucle fermée et découpe — captures dans `docs/screens/ios/` |
| Polices, icône | ✅ `Resources/Fonts` (OFL) et `AppIcon-1024.png` |
| Archive Release | ✅ `xcodebuild archive` signé, puis export App Store **local** (`.ipa`, non envoyé) : certificat *Apple Distribution*, profil *iOS Team Store Provisioning Profile: com.marmoh.ombrelune* (valides jusqu'au 7 février 2027) |
| App Store Connect | ✅ par l'API (fastlane, §15) : fiche Ombrelune (id 6831128456), 6 achats intégrés, Ordre du Dragon (groupe 22548846, 2 abonnements, 175 pays, essai 3 jours), classement du tournoi, build TestFlight |
| Langues | ✅ français, anglais, espagnol (`Localizable.xcstrings`, DECISIONS #70) |
| Reste chez Apple | ⏳ accord Applications payantes, captures pour la vérification des produits, fiche App Store, réseau publicitaire : §14 |

Corrections faites pendant cette phase : atlas SpriteKit en pages de 4096 px (`TEXTURE_ATLAS_MAXIMUM_SIZE`, DECISIONS #69),
deux avertissements de concurrence, nom PostScript d'IM Fell (`IM_FELL_English_SC`), écrans recalés sur le prototype web
(titre, carte, boutique, pass, réglages), barre d'état masquée en combat, aide « Encercle-le » gardée dans l'arène.

**Captures et recette rapide** (Debug seulement) : `xcrun simctl launch booted com.marmoh.ombrelune -screen <écran>`
ouvre directement `map`, `heroes`, `shop`, `pass`, `tournament`, `settings`, `lives`, `dragon`, `prelevel` ou
`combat` (`-level N`).

**Traces de parité** : ne pas lancer `pnpm traces` sur ce Mac. Node 22 de Homebrew sur Apple Silicon calcule `sin`,
`cos` et `pow` à 1 ulp près autrement que la machine qui a produit `content/traces/` (13 valeurs sur 13 620) ; l'outil
le détecte et refuse d'écrire (DECISIONS #68). Les traces du dépôt, elles, passent sur le simulateur.

---

## 1. Préparer le Mac

1. macOS 14 ou plus récent, **Xcode 16** (SDK iOS 17 minimum ; la cible de déploiement est iOS 17.0).
   Ouvrir Xcode une fois pour installer les composants, puis `xcode-select -p` doit pointer vers Xcode.
2. Homebrew puis XcodeGen : `brew install xcodegen` (version 2.42 ou plus récente : la clé
   `storeKitConfiguration` du schéma en dépend).
3. Pour régénérer contenus et traces : Node 22 et pnpm (`corepack enable`), puis `pnpm install` à la racine.
   **Garder Node 22** tant que les traces n'ont pas été vérifiées avec une version plus récente (DECISIONS #50).
   Sur ce Mac : `brew install node@22` (version à part, sans toucher au Node de nvm), puis dans chaque terminal du projet
   `export PATH="/opt/homebrew/opt/node@22/bin:$PATH"` ; `corepack enable --install-directory /opt/homebrew/opt/node@22/bin`
   fournit `pnpm`. Voir l'encadré « Traces de parité » plus haut avant `pnpm traces`.

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

1. ✅ Fait : `com.marmoh.ombrelune` (tests : `com.marmoh.ombrelune.tests`) et `DEVELOPMENT_TEAM: P42VAGHFV3` dans
   `ios/project.yml` (ne pas les régler dans Xcode : la valeur serait perdue à la prochaine génération).
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
   2 novembre 2026). Saisons 1 et 2 déclarées dans l'app (`ProductID.seasonPass1/2`, `Ombrelune.storekit`) ; la
   saison 2 (14 décembre 2026 – 25 janvier 2027) doit encore être créée dans App Store Connect (§14.4), sinon
   l'écran du pass affiche « Bientôt ». Pour la saison 3 (dès le 25 janvier 2027) : même ajout, `seasonPass3`.
4. Les descriptions du `.storekit` respectent les limites d'App Store Connect (nom ≤ 30 caractères,
   description ≤ 55) : ce sont exactement les textes à saisir en §14.

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

## 10. Polices, icône (✅ fait)

1. Polices OFL dans `ios/Resources/Fonts/` (dépôt `google/fonts`) : `IMFellEnglishSC-Regular.ttf` (nom PostScript
   **`IM_FELL_English_SC`**, utilisé par `Theme.display` et la scène) et Alegreya Sans Regular, Medium, Bold,
   ExtraBold, MediumItalic, avec `OFL-IMFellEnglishSC.txt` et `OFL-AlegreyaSans.txt` ; déclarées dans `UIAppFonts`.
2. Icône : `Resources/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png` (1024 × 1024, opaque). Elle est
   composée par `window.atlasAppIcon` (`web/src/atlas.ts`, mêmes marionnettes vectorielles que les atlas) ; pour la
   régénérer : `pnpm web:dev` puis `swift tools/app-icon.swift`.

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

- Tout ce qui se fait sur le site d'Apple : §14.
- Profilage sur un vrai iPhone 11 (§11) et premier envoi TestFlight (§12) : à faire quand vous le décidez.
- Images d'atlas des apparences (pass de saison, Parure du Dragon) : esquisses SpriteKit en attendant (DECISIONS #56).
- Particules d'ambiance par royaume (lucioles, spores, sable, neige, braises) du web : non portées.
- Musique : boîte à musique synthétisée, comme le web ; sons et musique suivent les Réglages.
- Saison 3 et suivantes du pass : produit à ajouter avant chaque saison (§6.3).
- Textes légaux définitifs (TASKS M8) : `PolicyText` de `UI/DragonView.swift` est un brouillon.

## 14. À faire sur le site d'Apple (valeurs exactes)

**Fait le 5 novembre 2026 par l'API** (§15) : la fiche de l'app (créée sur le site), §14.3, §14.4, §14.5 (groupe
**22548846**, reporté dans `ProductID.dragonGroupID` et le `.storekit`) et §14.6. Les produits sont en état
« Métadonnées manquantes » tant qu'il leur manque la **capture pour la vérification** ; les localisations anglaise
et espagnole des produits (présentes dans le `.storekit`) ne sont pas encore envoyées. Reste aussi §14.1 et §14.7.
L'App ID `com.marmoh.ombrelune` a été créé par Xcode (équipe P42VAGHFV3) avec Game Center et iCloud.

### 14.1 Préalables (une fois)
1. **Accords, taxes et banque** : signer l'accord **Paid Applications** (« Applications payantes »), renseigner compte
   bancaire et formulaires fiscaux. Sans lui, aucun achat intégré ni abonnement ne fonctionne, même en TestFlight.
2. **Utilisateurs et accès › Sandbox › Testeurs** : créer au moins un compte testeur (adresse jamais utilisée comme
   identifiant Apple), territoire France ; il sert aux achats et à Game Center en sandbox.
3. **Une URL de politique de confidentialité** publique (obligatoire pour une app avec abonnement) et, au choix, le
   CLUF standard d'Apple ou vos conditions : leurs liens doivent figurer dans la description de l'app et sous l'offre
   d'abonnement (à reporter aussi dans `PolicyText`).

### 14.2 Fiche de l'app (Apps › « + » › Nouvelle app)
| Champ | Valeur |
|---|---|
| Plateforme | iOS |
| Nom | Ombrelune (si le nom est pris : « Ombrelune — théâtre d'ombres ») |
| Langue principale | Français (France) |
| Identifiant de paquet | `com.marmoh.ombrelune` |
| SKU | `ombrelune-ios` |
| Accès | Accès complet |
| Catégorie | Jeux ; sous-catégories Action et Aventure |
| Chiffrement | déjà déclaré : `ITSAppUsesNonExemptEncryption = false` |
| Confidentialité (sans réseau publicitaire) | « Aucune donnée collectée » ; à revoir en §14.6 |

### 14.3 Achats intégrés (Monétisation › Achats intégrés)
Pour chacun : nom de référence, identifiant, prix (pays de référence **France**), localisation **Français (France)**
avec le nom affiché et la description ci-dessous, disponibilité dans tous les pays, et une **capture pour la
vérification** (une capture de la boutique convient : `docs/screens/ios/03-shop.png`).

| Type | Nom de référence | Identifiant du produit | Prix | Nom affiché | Description |
|---|---|---|---|---|---|
| Consommable | Poignée de gemmes | `ombrelune.gems.handful` | 0,99 € | Poignée de gemmes | 100 gemmes. |
| Consommable | Bourse de gemmes | `ombrelune.gems.pouch` | 4,99 € | Bourse de gemmes | 550 gemmes. |
| Consommable | Coffre de gemmes | `ombrelune.gems.chest` | 9,99 € | Coffre de gemmes | 1 200 gemmes. |
| Non consommable | Offre de départ | `ombrelune.starter` | 2,99 € | Offre de départ | 300 gemmes, le Moine du vent et 5 bonus. Une fois. |
| Non consommable | Pass de saison 1 | `ombrelune.pass.season1` | 4,99 € | Pass de saison 1 | 30 paliers premium : or, gemmes, bonus, apparences. |

Partage familial : désactivé pour tous. Les premiers achats intégrés partent en vérification **avec** une version de
l'app (cocher les produits sur la page de la version avant de la soumettre).

### 14.4 Pass de saison 2 (avant le lundi 14 décembre 2026)
| Champ | Valeur |
|---|---|
| Type | Non consommable |
| Nom de référence | Pass de saison 2 |
| Identifiant du produit | `ombrelune.pass.season2` |
| Prix | 4,99 € (France) |
| Nom affiché (fr) | Pass de saison 2 |
| Description (fr) | 30 paliers premium : or, gemmes, bonus, apparences. |
| Partage familial | non |

Le code de l'app le connaît déjà (`ProductID.seasonPass2`) : il suffit qu'il soit approuvé avant le 14 décembre
(le soumettre avec une version, ou seul si une version est déjà publiée).

### 14.5 Abonnement « Ordre du Dragon » (Monétisation › Abonnements)
1. **Groupe d'abonnements** : nom de référence `Ordre du Dragon` ; localisation Français : nom affiché
   `Ordre du Dragon`. Après création, **me donner l'identifiant numérique du groupe** (affiché sur sa page) : il
   remplacera `21566001` (identifiant du `.storekit`) dans `ProductID.dragonGroupID`, sinon l'écran d'abonnement
   (`SubscriptionStoreView`) restera vide en production.
2. Deux abonnements dans ce groupe, **au même niveau** (comme dans le `.storekit`) :

| Champ | Annuel | Mensuel |
|---|---|---|
| Nom de référence | Ordre du Dragon annuel | Ordre du Dragon mensuel |
| Identifiant du produit | `ombrelune.dragon.yearly` | `ombrelune.dragon.monthly` |
| Durée | 1 an | 1 mois |
| Prix (France) | 39,99 € | 4,99 € |
| Nom affiché (fr) | Ordre du Dragon (annuel) | Ordre du Dragon (mensuel) |
| Description (fr) | Vies illimitées, 60 gemmes/semaine, +25 % d’or, parure | idem |
| Offre de lancement | Essai gratuit, 3 jours, nouveaux abonnés, tous les pays | idem |
| Partage familial | non | non |

3. Capture pour la vérification : l'écran de l'Ordre (`-screen dragon`) ; notes de vérification : « Avantages :
   vies illimitées, 60 gemmes par semaine à réclamer sur la carte, apparence Parure du Dragon, +25 % d'or. »

### 14.6 Game Center (Fonctionnalités › Game Center)
1. Activer Game Center pour l'app, puis sur la page de la version cocher **Game Center** et y ajouter le classement.
2. **Classement récurrent** :

| Champ | Valeur |
|---|---|
| Type | Classement récurrent (*Recurring*) |
| Nom de référence | Tournoi de la semaine |
| ID du classement | `ombrelune.tournament.weekly` |
| Format du score | Entier |
| Type de soumission | Meilleur score |
| Ordre de tri | Décroissant (le plus haut gagne) |
| Début | lundi 9 novembre 2026, 00:00 UTC (toujours un lundi à 00:00 UTC) |
| Durée | 1 semaine |
| Redémarrer tous les | 1 semaine |
| Plage de scores | 0 à 100 000 (facultatif) |
| Localisation Français | nom `Tournoi de la semaine` ; suffixe du score : ` points` (singulier ` point`) |

3. Test : sur l'iPhone, *Réglages › Game Center* › section *Développeur* › compte sandbox de §14.1.

### 14.7 Réseau publicitaire (publicité récompensée « +1 vie »)
Ce qui se passe sur le site d'Apple n'arrive qu'une fois le SDK choisi et branché (§9) ; le reste se fait chez le réseau.
1. Chez le réseau (AdMob recommandé) : créer l'app iOS liée à `com.marmoh.ombrelune`, un bloc **Récompensé**
   (récompense : 1 vie), activer le message de consentement UMP (RGPD) et le message IDFA ; me donner
   l'**identifiant d'app** (`ca-app-pub-…~…`) et l'**identifiant du bloc** (`ca-app-pub-…/…`).
2. Publier un fichier `app-ads.txt` à la racine du site web indiqué dans la fiche App Store (URL marketing).
3. App Store Connect › **Confidentialité de l'app** : remplacer « Aucune donnée collectée » par les données déclarées
   par le SDK (pour AdMob : *Identifiants › Identifiant de l'appareil*, *Données d'utilisation › Interaction avec le
   produit* et *Données publicitaires*, *Diagnostics › Plantages et Performances* ; finalité **Publicité tierce** ;
   « Utilisé pour le suivi » = **oui** si les publicités personnalisées sont proposées).
4. Questionnaire d'âge : cocher la présence de publicités ; notes de vérification : « Publicité uniquement à la
   demande du joueur (feuille des vies), jamais en combat ni pour les membres de l'Ordre. »

## 15. fastlane (API App Store Connect)

Clé d'API d'équipe : `fastlane/.env` (`ASC_KEY_ID`, `ASC_ISSUER_ID`, ignoré par git) et
`~/.appstoreconnect/private_keys/AuthKey_<ID>.p8` (jamais copié). Lancer depuis la racine :

```sh
LC_ALL=en_US.UTF-8 LANG=en_US.UTF-8 fastlane status        # lecture seule
LC_ALL=en_US.UTF-8 LANG=en_US.UTF-8 fastlane products      # achats intégrés du .storekit
LC_ALL=en_US.UTF-8 LANG=en_US.UTF-8 fastlane dragon        # groupe, abonnements, prix des 175 pays, essai (≈ 15 min)
LC_ALL=en_US.UTF-8 LANG=en_US.UTF-8 fastlane leaderboard   # Game Center et classement du tournoi
LC_ALL=en_US.UTF-8 LANG=en_US.UTF-8 fastlane beta          # archive, export, envoi TestFlight (sans soumission)
```

- Les lanes de création sont idempotentes (un identifiant existant est laissé tel quel) ; produits, prix et textes
  viennent de `ios/Ombrelune.storekit`.
- Avant chaque `beta` : incrémenter `CURRENT_PROJECT_VERSION` dans `ios/project.yml` (Apple refuse deux builds
  de même numéro), puis `xcodegen generate`.
- Classement récurrent : l'API attend une durée `PT168H` et une règle `FREQ=DAILY;INTERVAL=7` (pas `P7D` ni `WEEKLY`).
- La fiche App Store (textes fr-FR, en-US, es-ES) est prête dans `fastlane/metadata/`, pas encore envoyée.

