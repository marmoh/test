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
- [ ] Atlas des décors des 5 royaumes et des VFX

## M5 — Prototype web (`web/`)
- [x] Combat jouable au doigt et au clavier, interpolation, télégraphes, particules, secousses, arrêt sur image
- [x] Carte saga 300 niveaux, pré-niveau (bonus), choix du pouvoir, victoire, défaite (continuer), pause
- [x] Sons synthétisés WebAudio, vibrations
- [x] Build mono-fichier publiable (`pnpm web:artifact`)
- [x] Niveaux validés chargés par le prototype (`content/levels/index.json`)
- [x] Écrans Héros et talents, Boutique (achats simulés), Tournoi jouable, Réglages
- [ ] Pass de saison
- [ ] Captures de chaque écran (`pnpm web:shots`)

## M6 — iOS (`ios/`)
- [ ] `project.yml` XcodeGen (iOS 17+), cibles app + tests
- [ ] `Core/` : port Swift de la simulation (même RNG, mêmes formules), lecture des JSON
- [ ] `Game/` : SpriteKit (atlas, rendu, VFX), contrôles, Core Haptics
- [ ] `UI/` : SwiftUI (carte, pré-niveau, pouvoirs, résultats, héros, boutique, pass, tournoi, réglages)
- [ ] `Services/` : StoreKit 2 (`Store`, crédit idempotent, `SubscriptionStoreView`), GameKit (classement hebdo récurrent), persistance JSON + iCloud KV, AVAudioEngine
- [ ] `Ombrelune.storekit` avec tous les produits §11

## M7 — Parité et qualité
- [ ] Traces de rejeu TS (entrée → état) et tests XCTest de parité
- [ ] Tests de bornes de performance (150 projectiles, 30 ennemis)
- [~] Tournoi hebdomadaire : jouable dans le prototype web (graine ISO, 5 essais, score) ; Game Center à faire

## M8 — Phase Mac
- [ ] `docs/MAC_PHASE.md` : génération XcodeGen, signature, StoreKit local, Game Center sandbox, profilage iPhone 11, TestFlight
