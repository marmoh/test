# Port iOS de la version 0.2 (héros à mécanique propre, équipement, nouveaux ennemis, quêtes)

La version 0.2 a été écrite et équilibrée dans la simulation TypeScript et le prototype web (DECISIONS #73 à #78).
Le port Swift n'est pas fait : aucun compilateur Swift n'était disponible pour la vérifier. Ce document liste exactement
ce qu'il faut reporter dans `ios/`, dans l'ordre, pour retrouver la parité au bit près.

## 1. Cœur (`ios/Core`, parité au bit près)

Référence TypeScript → fichier Swift :

| TypeScript | À reporter | Swift |
|---|---|---|
| `sim/src/content.ts` | 5 ennemis (`lantern`, `weaver`, `beetle`, `puppeteer`, `specter`) + `shade` ; `UNLOCK_ORDER` (15 types) ; `SPAWN_WEIGHT` ; 12 pouvoirs (familles `wind`, `ember`) **ajoutés à la fin de `POWERS`** ; `SIGNATURE_FAMILIES` ; `HeroDef.kind`, `family`, `mechanic`, `pitch` ; plus de `startPower` pour le Moine et le Sorcier | `Content.swift` |
| `sim/src/constants.ts` | `GUST`, `EMBER`, `WEB_SLOW`, `SIGNATURE_NEEDLE_MULT` | `Constants.swift` |
| `sim/src/gear.ts` | tout le fichier (catalogue, `mainValue`, `gearStats`, `levelLoot`, `lootRarity`, `hash32` local, coûts, `expectedGear`) | nouveau `Gear.swift` |
| `sim/src/hero.ts` | `computeStats(talents, powers, gear = NO_GEAR)` : le facteur d'équipement multiplie **en dernier** (`× (1 + gear.x)`) ; nouveaux champs de `HeroStats` (vent, braise) | `Hero.swift` |
| `sim/src/world.ts` | `HeroState` : `kind`, `gear`, `stopped`, `momentum`, `gustCd`, `gustT`, `gusts`, `embers`, `dmgBy.sig` ; `Enemy.emberT/emberDps` ; `Hazard.slow` ; `World.whirls` ; `step` (mise à jour selon `kind`, tourbillons) ; ralentissement des toiles dans `updateHero` ; `stopped` ; aiguilles × `SIGNATURE_NEEDLE_MULT` hors Éclaireuse ; `updateGust`, `gust`, `updateWhirls`, `updateEmbers` ; braises des projectiles du sorcier dans `heroHitInner` ; bouclier du scarabée (`shielded`) ; `updateLantern`, `updateCaster`, `updateBeetle`, `updateSpecter` ; `reap` (lampion désamorcé, Combustion) ; `updateStatus` (brûlure des braises) ; évènements `gust`, `block`, `blink`, `boom` | `World.swift` |
| `sim/src/level.ts` | `offerPowers(rng, owned, count, signature)` (filtre `own`) ; `runLevel` : `kind`, `gear`, famille du héros ; `gearForLevel` | `Level.swift` |
| `sim/src/bot.ts` | `RANGED`, `CHASERS`, `LOOP_TYPE_R`, `DAMAGE_FIRST`, `VALUE` ; boucles seulement pour `thread` ; arrêt du moine à portée de bourrasque ; attraction moine/sorcier dans `placeCost` ; préférence du sorcier pour le mouvement | `Bot.swift` |

Ordre des calculs : recopier les expressions telles quelles (même ordre des multiplications, mêmes `Math.min/max`,
mêmes tirages `rng`), comme pour le reste du port (DECISIONS #50).

Vérification :
1. `pnpm traces` (déjà régénéré dans le dépôt pour la version 0.2) puis `ParityTests` : les traces de l'Éclaireuse sur les
   niveaux 1 à 200 n'ont pas changé ; changent les niveaux régénérés (budgets recalibrés avec l'équipement), les traces
   `run_l047_ember` / `run_l085_monk` (nouvelles mécaniques) et les niveaux des chapitres 11 à 15 (nouveaux ennemis).
2. `testAllLevelsLoadAndAreConsistent` : `content/levels/index.json` régénéré.

## 2. Rendu (`ios/Game`)

- Atlas : `pnpm art:atlas` après avoir ajouté `lantern`, `weaver`, `beetle`, `puppeteer`, `shade`, `specter` à la liste des
  monstres exportés (`tools/art-atlas.mjs`) ; dessins dans `art/src/monsters2.ts`.
- Bourrasque (anneau d'élan aux pieds du moine, spirales), traînée de braises (flammes découpées), tourbillon, toile,
  marque du spectre, explosion du lampion, étincelles du bouclier : reprendre `web/src/combat.ts` (`drawMomentum`,
  `drawGusts`, `drawWhirl`, `drawEmbers`, `drawWeb`, branche `specter` de `drawHazard`, évènements dans `react`).
- Le bouclier du scarabée suit `enemy.aim` (pas la direction de l'héroïne).

## 3. Interface (`ios/UI`) et sauvegarde — fait (sans compilateur iOS : à vérifier dans Xcode)

- [x] **Règles** (`ios/Services/MetaRules.swift`, pur, testé sous Linux dans `EconomyTests`) : port de `web/src/meta.ts` —
  inventaire (un emplacement vide porte l'objet aussitôt), équiper / retirer, « meilleur que l'objet porté », amélioration,
  recyclage, butin de victoire, étal du colporteur (DECISIONS #79), quêtes du jour (mêmes tirages que le web, vérifiés),
  bilan d'un combat, bestiaire (21 créatures), `HeroUnlocks` (Moine au niveau 40, Sorcier au niveau 100, essai).
- [x] **Service** `Meta` (`ios/Services/Meta.swift`) : sections `gear`, `quests`, `bestiary` de `save.json` (même forme que
  le web, décodage tolérant : une ancienne sauvegarde s'ouvre sans perte) ; or et gemmes réglés par le `Wallet`.
  Fusion iCloud : quêtes du même jour réunies, bestiaire au plus grand compte, équipement au plus récent.
- [x] **Déroulé** (`AppModel`) : équipement porté en combat (`cfg.gear`, `.none` en tournoi, `tutorialHints = false` en
  tournoi) ; victoire → butin, éclats, quêtes, bestiaire, héros débloqués puis écran « Nouveau héros ! » ; défaite → quêtes et
  bestiaire (`scene.killsByType`) ; essai d'un héros verrouillé (`cfg.trial`) sans vie ni récompense.
- [x] Héros : onglets Héros / Équipement / Talents ; mécanique, accroche, trois pouvoirs signature, Choisir / Essayer.
- [x] Équipement : poupée, résumé des bonus, inventaire, fiche (Équiper / Retirer, Améliorer, Recycler en deux touchers)
  — `ios/UI/GearView.swift`.
- [x] Butin : losange de rareté sur les nœuds (légendaire qui se balance), médaillon du héros aux nœuds 40 et 100 ;
  pré-niveau (nouvel ennemi de la salle tutoriel, héros qui change d'un toucher, « Butin de la première victoire ») ;
  victoire (carte qui se retourne, bouton Équiper).
- [x] Quêtes du jour et bestiaire (`ios/UI/JournalView.swift`), étiquettes Quêtes / Bestiaire sur la carte.
- [x] Boutique : étal du colporteur (trois objets du jour, prix en gemmes, acheté) et sac de 40 éclats.
- [x] Sons `gust`, `block`, `blink`, `boom`, `loot` (`AudioService`).
- [x] Chaînes : nouveaux textes au catalogue `Localizable.xcstrings` (fr, en, es), y compris les pouvoirs, ennemis,
  objets, quêtes, fiches du bestiaire et les aides de combat du Moine et du Sorcier.
- Note : `HeroUnlock` (`ios/Core/Economy.swift`) garde l'ancien seuil de 120 ; l'app ne l'utilise plus (remplacé par
  `HeroUnlocks`, niveaux 40 et 100).
