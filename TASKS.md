# TASKS — feuille de route vers la « première version prête à compiler » (SPEC §14)

Légende : [x] fait · [~] en cours · [ ] à faire

## M0 — Fondations
- [x] Dépôt pnpm + TypeScript strict + vitest, `pnpm verify`
- [x] `SPEC.md`, `TASKS.md`, `docs/DECISIONS.md`
- [x] Constante `APP_NAME` unique (sim, web ; Swift à venir)

## M1 — Simulation déterministe (`sim/`)
- [x] RNG à graine (mulberry32), pas fixe 1/30 s
- [x] Contrôles à ancre flottante (zone morte 8, rampe 40, ancre glissante à 70)
- [x] Arène 9×15, collisions, ligne de vue, champ BFS, validation des gabarits
- [x] Héros, tir automatique, ciblage en ligne de vue, invulnérabilité
- [x] 8 ennemis télégraphiés (≥ 0,5 s), élites, 5 boss × 3 variantes × 3 phases avec souffle
- [x] 24 pouvoirs, offres à graine, soins entre salles, orbes de soin
- [x] Formules §7/§8/§10 (difficulté, budget, étoiles, or, vies, score de tournoi, semaine ISO)
- [x] Tests vitest (déterminisme, formules, contrôles, bornes 150 projectiles / 30 ennemis)

## M2 — Contenu
- [x] 24 gabarits de salle (`content/rooms/`) validés par `pnpm rooms:check`
- [x] Générateur `pnpm levels:gen` (recherche de graine + budget ±10 %, `--revalidate`)
- [x] 300 niveaux `content/levels/level_0001.json` … `level_0300.json` + `index.json`

## M3 — Bots et équilibrage
- [x] Bots novice / moyen / expert (réaction, précision d'esquive, politique de pouvoirs)
- [x] Réglage des courbes pour rendre les bandes §9 atteignables (journal dans DECISIONS)
- [x] Tir automatique par défaut, bots mesurés avec
- [x] `pnpm levels:validate` + `content/reports/difficulty.html`
- [x] Test d'équilibrage des pouvoirs (aucun > +12 pts vs médiane) — `pnpm bots:balance`

## M4 — Direction artistique et pipeline d'art (`art/`)
- [x] Direction « théâtre d'ombres » (`docs/ART.md`), palette des 5 royaumes, typographies IM Fell English SC + Alegreya Sans (OFL)
- [x] Héroïne, 8 ennemis, 5 boss en vectoriel animé (respiration, course, anticipation, impact)
- [x] Décors d'arène par royaume (sol, murs, rochers, eau/lave animées, haies, portail)
- [x] 24 icônes de pouvoirs + icônes d'interface (SVG)
- [x] Moine du vent, Sorcier de braise
- [x] `pnpm art:atlas` : héros, ennemis, boss, icônes en @2x/@3x (`ios/Resources/Atlases/*.atlas`)
- [x] Atlas des décors des 5 royaumes et des VFX

## M5 — Prototype web (`web/`)
- [x] Combat jouable au doigt et au clavier, interpolation, télégraphes, particules, secousses, arrêt sur image
- [x] Carte saga 300 niveaux, pré-niveau (bonus), choix du pouvoir, victoire, défaite (continuer), pause
- [x] Sons synthétisés WebAudio, vibrations
- [x] Build mono-fichier publiable (`pnpm web:artifact`)
- [x] Niveaux validés chargés par le prototype (`content/levels/index.json`)
- [x] Écrans Héros et talents, Boutique (achats simulés), Tournoi jouable
- [x] Réglages complets §12.6 : effets sonores, musique (synthétisée), vibrations, tir auto, réduire les animations, gérer l'abonnement, restaurer les achats, confidentialité (consentement publicitaire), crédits OFL, effacer la progression (confirmation intégrée)
- [x] Ordre du Dragon simulé (`web/src/dragon.ts`, `economy.ts`) : offre, essai 3 jours, renouvellement, résiliation, changement de formule ; avantages appliqués (vies illimitées, tribut de 60 gemmes/semaine, Parure du Dragon, +25 % d'or) ; paywall aux 3 endroits du §11
- [x] Feuille des vies (compteur de la carte, panne de vies) et publicité récompensée simulée « +1 vie » (5 s, 3/jour, délai 15 min) — DECISIONS #37
- [x] Tests vitest de la logique d'abonnement et de publicité (`web/test/economy.test.ts`)
- [x] Pass de saison
- [x] Captures de chaque écran (`pnpm web:shots`)

## M6 — iOS (`ios/`)
- [x] `project.yml` XcodeGen (iOS 17+), cibles app + tests
- [x] `Core/` : port Swift de la simulation (même RNG, mêmes formules), lecture des JSON
- [x] `Game/` : SpriteKit (atlas, rendu, VFX), contrôles, Core Haptics
- [x] `UI/` : SwiftUI — titre, carte, pré-niveau, pouvoirs, résultats, héros, boutique, pass, tournoi, réglages, Ordre du Dragon, vies ; recalés sur le prototype web dans le simulateur (captures `docs/screens/ios/`)
- [x] `Services/` : StoreKit 2 (`Store`, crédit idempotent via `CreditLedger`), `Wallet`, `GameSettings`, `LivesCenter`, `AdService` (protocole + `MockAdService` + ATT), Game Center, sauvegarde JSON + iCloud KV, sons
- [x] `Ombrelune.storekit` avec tous les produits §11 (gemmes, offre de départ, pass saison 1, Ordre du Dragon mensuel/annuel avec essai de 3 jours)
- [x] `Core/Lives.swift` (vies §8, +1 vie) et `Tests/MonetizationTests.swift` (parité avec `web/test/economy.test.ts`)
- [ ] Réseau publicitaire réel (AdMob ou AppLovin MAX) derrière `AdService`, consentement UMP/CMP, `NSUserTrackingUsageDescription` (voir `docs/MONETISATION.md`)
- [x] Polices OFL embarquées (`Resources/Fonts`, `UIAppFonts`) et icône d'app 1024 × 1024 (`tools/app-icon.swift`)
- [x] Pass de saison 2 déclaré dans l'app (`ProductID.seasonPass2`, `.storekit`) ; reste sa création dans App Store Connect (`docs/MAC_PHASE.md` §14.4)
- [x] App en français, anglais et espagnol : `Resources/Localizable.xcstrings` (370 chaînes, pluriels), `InfoPlist.xcstrings` (ATT), localisations `.storekit`, fiche App Store `fastlane/metadata/` (fr-FR, en-US, es-ES), captures `docs/screens/ios/en|es/` (DECISIONS #70)

## M7 — Parité et qualité
- [x] Traces de rejeu TS (entrée → état) et tests XCTest de parité
- [x] Tests de bornes de performance (150 projectiles, 30 ennemis)
- [x] Tournoi hebdomadaire : web (graine ISO, 5 essais, score) et iOS (Game Center, classement récurrent `ombrelune.tournament.weekly`) ; classement à créer dans App Store Connect (`docs/MAC_PHASE.md` §14.6)

## M8 — Phase Mac
- [x] `docs/MAC_PHASE.md` : génération XcodeGen, signature, StoreKit local, Game Center sandbox, profilage iPhone 11, TestFlight (étapes monétisation déjà listées dans `docs/MONETISATION.md`)
- [x] Mac prêt : Node 22 (Homebrew) + pnpm, XcodeGen, `pnpm verify` vert
- [x] Signature : équipe P42VAGHFV3, `com.marmoh.ombrelune` ; App ID créé avec Game Center et iCloud
- [x] Compilation simulateur sans erreur ni avertissement (atlas 4096 px, concurrence)
- [x] XCTest 30/30 (parité 4, cœur 11, économie 9, monétisation 6) ; `pnpm traces` protégé contre un Node qui calcule autrement (DECISIONS #68)
- [x] Recette dans le simulateur et captures (`docs/screens/ios/`)
- [x] Archive Release signée et export App Store local vérifié (certificat Apple Distribution, profil App Store) — rien d'envoyé
- [x] App Store Connect par l'API (fastlane) : achats intégrés, pass saison 2, Ordre du Dragon (groupe 22548846 reporté dans le code), classement du tournoi, build TestFlight — `docs/MAC_PHASE.md` §15
- [x] Fiche App Store 1.0 par l'API (`fastlane listing`) : textes fr/en/es, captures, âge, prix, pays, Game Center, contact, build 1.0 (3) — §14
- [ ] Site d'Apple : accord Applications payantes, confidentialité de l'app, produits à cocher, soumission — §14
- [ ] Réseau publicitaire réel (identifiants AdMob, `app-ads.txt`, étiquette de confidentialité) — §9 et §14.7
- [x] Fil court et progressif (retour de test) : 2,2 s au départ, Fil long +40 % × 3, talent Encre lente, une carte de fil par tirage, aiguilles à 30 % ; 300 niveaux recalés, traces régénérées sous Rosetta (DECISIONS #71, #72)
- [ ] Profilage sur iPhone 11 (§11)
- [x] Conditions d'utilisation (EULA standard d'Apple) et politique de confidentialité (`site/`), liées sous l'offre d'abonnement (DECISIONS #73)
