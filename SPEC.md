# SPEC — « Ombrelune » (nom de travail)

> Un héros, un doigt, trois cents niveaux. Bouge pour esquiver, arrête-toi pour frapper.

Nom final non validé : constante `APP_NAME` partout. Tous les chiffres ci-dessous sont des **valeurs de départ** :
les bots (§9) font foi et l'agent les ajuste en notant chaque changement dans `docs/DECISIONS.md`.

---

## 1. Concept
- **Combat façon Archero** : vue de dessus, arène fermée. Le héros tire **automatiquement** dès qu'il est immobile.
  Toute la tension : bouger pour esquiver, s'arrêter pour tirer.
- **Progression façon Candy Crush** : une carte saga de **300 niveaux** au lancement, en **15 chapitres de 20 niveaux**,
  répartis dans **5 royaumes** (3 chapitres chacun). Étoiles, niveaux difficiles, boss, vies.
- **Mini-run dans chaque niveau** : 2 à 4 salles ; entre deux salles, choisir **1 pouvoir parmi 3**.
  Les pouvoirs sont remis à zéro à chaque niveau → chaque niveau est une petite partie complète de 60 à 150 s.
- **Tournoi hebdomadaire** : un niveau spécial, mêmes conditions pour tous, classement Game Center.

## 2. Contrôles (un doigt, sans joystick visible)
- **Ancre flottante** : au toucher, l'ancre = position du doigt (invisible ; un léger halo au sol sous le héros seulement).
- Vecteur `v = doigt − ancre`. Zone morte **8 pt**. Vitesse = `vitesseHéros × min(1, (|v| − 8) / 40)` dans la direction de `v`.
- Si `|v| > 70 pt`, l'ancre glisse vers le doigt pour rester à 70 pt (pas besoin de revenir en arrière).
- **Tir automatique** quand le doigt est levé, **ou** quand la vitesse du héros < 12 pt/s depuis ≥ 0,10 s.
- Cible : l'ennemi vivant le plus proche **en ligne de vue** ; à défaut, le plus proche. Le héros se tourne vers la cible en 0,08 s.
- Toucher à deux doigts : ignoré (pas de geste caché). Pause : bouton en haut à droite.
- Accessibilité : option « gaucher » sans effet (contrôle relatif partout), option « tir auto permanent » (mode facile, désactivé en tournoi).

## 3. Arène
- Grille logique **9 × 15 cases de 44 pt** (portrait, 396 × 660 pt), murs autour. Caméra fixe, cadrée sur l'arène.
- Obstacles : **rocher** (bloque tout), **eau/lave** (bloque le déplacement, pas les projectiles), **haies** (bloquent les
  projectiles, pas la vue des ennemis volants). 0 à 14 obstacles par salle selon le gabarit.
- Une salle se termine quand tous les ennemis sont morts : un **portail** s'ouvre en haut ; le héros y marche → salle suivante.
- 24 **gabarits de salle** faits à la main en JSON (`content/rooms/*.json`), symétriques ou non, validés par un test
  d'accessibilité (toutes les cases libres reliées, portail atteignable).

## 4. Héros
| Stat | Valeur de départ |
|---|---|
| PV | 600 |
| Dégâts par flèche | 100 |
| Cadence | 1,6 tir/s |
| Vitesse | 220 pt/s |
| Projectile | 900 pt/s, rayon 6 pt |
| Hitbox | cercle 14 pt |
| Invulnérabilité après un coup | 0,5 s (clignote) |

- **Talents permanents** (or) : Vigueur (+2 % PV / rang), Force (+2 % dégâts), Agilité (+1,5 % cadence), Fortune (+5 % or).
  10 rangs chacun → **plafond +20 % / +20 % / +15 %**. Les bots modélisent la progression attendue des talents au niveau `n`
  (`rang ≈ min(10, n / 25)`). Talents **désactivés en tournoi**.
- Héros jouables : 1 au lancement (l'Éclaireuse), 2 de plus à débloquer en jouant (Moine du vent : niveau 40 ou offre de
  départ ; Sorcier de braise : niveau 100), essayables avant (salle d'essai sans récompense). **Mêmes statistiques, mécanique
  signature différente** (DECISIONS #74), chacun avec sa famille de 6 pouvoirs (la première carte de chaque tirage) :
  - **Éclaireuse — Ciseaux de lune** : refermer une boucle de fil découpe ce qu'elle entoure.
  - **Moine du vent — Élan et bourrasque** : courir charge l'élan ; s'arrêter le libère en bourrasque (dégâts selon l'élan,
    recul, tireurs interrompus, projectiles ennemis dissipés).
  - **Sorcier de braise — Traînée de braises** : ses pas laissent des braises qui brûlent les ennemis au sol ; ses projectiles
    font couver leur cible.
- **Équipement** (DECISIONS #75) : 4 emplacements (aiguille : dégâts, cape : PV, masque : cadence, talisman : puissance de la
  mécanique signature), 24 objets, 4 raretés (commun, rare, épique, légendaire), une statistique secondaire fixe par objet.
  Butin **sans hasard** : la première victoire des niveaux p ∈ {3, 7, 10, 14, 17, 20} de chaque chapitre donne un objet
  annoncé d'avance (carte, pré-niveau) ; boss : épique, boss de fin de royaume : légendaire. Chaque victoire donne des
  **éclats** (amélioration avec l'or ; le recyclage en rend). Les bots modélisent l'équipement attendu comme les talents.
  Désactivé en tournoi.

## 5. Ennemis (15 types + boss)
Chaque attaque est **télégraphiée** (zone au sol ou lueur) au moins **0,5 s** avant : lisibilité avant tout.

| Ennemi | PV | Contact | Vitesse | Attaque | Coût budget |
|---|---|---|---|---|---|
| Gobelin frondeur | 220 | 60 | 70 | 1 pierre visée / 1,8 s (300 pt/s) | 2 |
| Champignon-spore | 300 | 50 | 0 | anneau de 8 spores / 3 s | 3 |
| Loup d'ombre | 260 | 120 | 90 → charge 420 | ligne télégraphiée 0,6 s puis charge | 3 |
| Archer squelette | 200 | 40 | 60 | 3 flèches en éventail / 2,4 s | 3 |
| Gelée | 380 | 70 | 55 | se divise en 2 petites (120 PV) à la mort | 3 |
| Totem runique | 500 | 0 | 0 | 6 projectiles en étoile tournante / 2 s | 4 |
| Chauve-souris | 120 | 70 | 140 (vol, ignore obstacles) | piqué vers le héros / 2 s | 2 |
| Mage de braise | 340 | 50 | 50 | flaque de feu télégraphiée 0,8 s (60 dégâts/0,5 s, dure 3 s) | 5 |

- Chapitres 11 à 15 (DECISIONS #73) : **Lampion** (fonce, s'arrête et explose après 0,8 s ; l'abattre avant le désamorce),
  **Araignée tisseuse** (toile qui ralentit l'héroïne de 45 %), **Scarabée-bouclier** (bouclier frontal qui arrête les
  aiguilles, coup au sol télégraphié), **Montreur d'ombres** (invoque des ombres), **Spectre de papier** (marque
  d'arrivée, téléportation, anneau). Les mécaniques signature passent le bouclier.
- Mise à l'échelle avec la difficulté `D` : `PV × (1 + 0,09 D)`, `dégâts × (1 + 0,06 D)` (cadences inchangées).
- **Élites** (dès le chapitre 3) : contour doré, `PV × 2,2`, une attaque bonus. Max 1 par salle, 2 dans les niveaux difficiles.
- **Boss** (niveau 20 de chaque chapitre) : 5 archétypes × 3 variantes (une par chapitre du royaume), chacun **3 phases**
  (à 100 %, 66 %, 33 % de PV) avec un motif d'attaque nouveau par phase et une ouverture claire (le boss reprend son souffle 1,2 s).
  PV de base 6 000, multipliés par `(1 + 0,09 D)`. Archétypes : Treant colossal, Reine des marais, Scorpion d'ambre,
  Wyverne de givre, Seigneur des cendres.

## 6. Pouvoirs (choix 1 parmi 3 entre les salles)
24 pouvoirs, trois raretés (commun 60 %, rare 30 %, épique 10 %), tirage à graine, pas de doublon dans une même offre.

| Famille | Pouvoirs |
|---|---|
| Tir | Multitir (+1 flèche, −10 % dégâts), Tir arrière, Diagonales, Ricochet (rebond sur 2 ennemis), Perforation, Rebond mural |
| Puissance | Cadence +25 %, Dégâts +20 %, Critique (15 %, ×2), Tueur d'élites (+50 % contre élites/boss) |
| Éléments | Flamme (brûlure 20 %/s 2 s), Givre (ralentit 30 % 1,5 s), Foudre en chaîne (3 cibles, 40 %), Poison (cumul) |
| Défense | Orbe gardien (tourne, 80 dégâts), Bouclier (absorbe 1 coup / 8 s), Vol de vie (2 % des dégâts), PV max +20 % (soigne d'autant) |
| Mobilité | Vitesse +15 %, Esquive (10 %), Pas éclair (invulnérable 0,3 s après un arrêt), Aimant à soins (orbes de soin attirés) |

- Entre les salles : soin de **15 % des PV max**.
- Les bots jouent avec une politique de choix réaliste (§9) ; aucun pouvoir ne doit dépasser **+12 points** de taux de
  réussite moyen par rapport à la médiane des pouvoirs (test d'équilibrage automatique).

## 7. Niveaux et génération
- Niveau `n` (1 à 300), chapitre `c = ceil(n / 20)`, position `p = n − 20 (c − 1)`, royaume `k = ceil(c / 3)`.
- Difficulté de base : `D(n) = 1 + 0,055 × (n − 1)^0,93`.
- **Dents de scie** dans un chapitre : `mult(p) = 0,85` pour p = 1 à 3 (respiration), `1,0` en général,
  `1,35` pour p ∈ {7, 14} (**difficiles**, marqués d'un crâne), `1,55` pour p = 20 (**boss**).
- Nombre de salles : 2 (n ≤ 20), 3 (n ≤ 120), 4 ensuite ; le boss occupe la dernière salle.
- Budget d'ennemis d'une salle : `B = round(6 + 3,2 × D × mult × (0,8 + 0,2 × indexSalle))`, rempli par tirage pondéré
  parmi les ennemis débloqués (1 nouveau type tous les 2 chapitres, introduit seul dans une salle « tutoriel » au p = 1).
- Le générateur (`pnpm levels:gen`) cherche, pour chaque niveau, une graine dont les bots atteignent la **bande cible** (§9) ;
  jusqu'à 200 graines testées ; échec → ajuster le budget de ±10 % et recommencer ; échec persistant → la tâche échoue (rouge).
- Sortie : `content/levels/level_0001.json` … `level_0300.json` (gabarits, vagues, positions, graines des pouvoirs, étoiles).

## 8. Étoiles, vies, récompenses
- ⭐ victoire · ⭐⭐ victoire avec ≥ 50 % des PV · ⭐⭐⭐ victoire avec ≥ 80 % des PV.
- **Vies** : 5 maximum, +1 toutes les **30 min**. Une défaite coûte 1 vie (une victoire n'en coûte pas).
- Or : `20 + 2 n` par victoire, ×1,5 pour 3 étoiles la première fois. Coffres d'étoiles tous les 20 ★ (or + gemmes + 1 bonus).
- **Quêtes du jour** (DECISIONS #76) : 3 quêtes par jour tirées de la date (or, gemmes, éclats), bonus pour les trois.
  **Bestiaire** : chaque créature rencontrée, son comportement et une astuce.

## 9. Validation par bots (cœur de la qualité)
Trois bots joués dans la simulation TS, avec un temps de réaction et une précision d'esquive :
| Bot | Réaction | Esquive des télégraphes | Choix des pouvoirs |
|---|---|---|---|
| Novice | 320 ms | 55 % | au hasard |
| Moyen | 220 ms | 75 % | heuristique simple (dégâts d'abord) |
| Expert | 120 ms | 95 % | meilleur choix estimé |

**Bandes cibles** (taux de réussite au 1er essai, sur 200 parties par niveau, talents attendus au niveau `n`) :
| Type de niveau | Bot moyen | Bot expert |
|---|---|---|
| Chapitres 1–2 (hors boss) | 85–97 % | ≥ 98 % |
| Normal (ensuite) | 55–80 % | ≥ 92 % |
| Difficile (crâne) | 30–45 % | ≥ 80 % |
| Boss | 25–40 % | ≥ 75 % |
| Plancher absolu | ≥ 15 % partout | ≥ 70 % partout |

- Le bot expert garantit qu'aucun niveau n'est injuste. Le bot moyen fixe la courbe ressentie.
- Rapport `content/reports/difficulty.html` (courbe des 300 niveaux, dents de scie visibles) régénéré à chaque `levels:validate`.

## 10. Tournoi hebdomadaire
- Chaque lundi 00:00 UTC : un **niveau spécial** de 4 salles (graine = semaine ISO), difficulté ≈ niveau 120 (difficile).
- **Mêmes conditions pour tous** : héros standard, talents désactivés, aucun bonus, aucun « continuer », offres de pouvoirs
  identiques (graine fixe), **5 essais par semaine pour tout le monde**, non achetables.
- Score : `kills × 100 + PV restants × 5 + max(0, 240 − secondes) × 40` (plus élevé = mieux) ; meilleur essai retenu.
- Classement **Game Center récurrent hebdomadaire**. Récompenses cosmétiques par palier (top 1 %, 10 %, 50 %, participation).

## 11. Monétisation (jamais d'avantage acheté en tournoi)
| Produit | Type | Prix | Contenu |
|---|---|---|---|
| Poignée de gemmes | consommable | 0,99 € | 100 gemmes |
| Bourse de gemmes | consommable | 4,99 € | 550 gemmes |
| Coffre de gemmes | consommable | 9,99 € | 1 200 gemmes |
| Offre de départ | non-consommable | 2,99 € | 300 gemmes + héros Moine du vent + 5 bonus (1 seule fois) |
| Pass de saison | non-consommable (par saison) | 4,99 € | piste premium 30 paliers (or, gemmes, bonus, apparences) |
| Ordre du Dragon | abonnement | 4,99 €/mois, 39,99 €/an (essai 3 jours) | vies illimitées, 60 gemmes/semaine, apparence exclusive, +25 % or |

- **Continuer** à la défaite : 60 gemmes (1re fois), 120 (2e) ; max 2 par tentative. Rend 50 % des PV, efface les projectiles.
- **Bonus avant niveau** (or ou gemmes) : Potion de vie (+25 % PV max), Parchemin (commence avec 1 pouvoir au choix), Égide (1 bouclier).
- **Recharge de vies** : 5 vies pour 90 gemmes.
- **Interdits** : loot box, monnaie à probabilités, compte à rebours mensonger, publicités intrusives (pas de pub en V1).
- Paywall : à la 1re fois sans vie, sur l'écran de défaite (bouton secondaire), dans la boutique. Jamais en combat.
- StoreKit 2 complet : `Store` (chargement, achat, restauration, `Transaction.updates`), crédit des consommables
  **idempotent** (identifiants de transaction déjà crédités mémorisés), `SubscriptionStoreView` pour l'abonnement,
  fichier `ios/Ombrelune.storekit` reprenant tous les produits ci-dessus pour tester dans le simulateur.

## 12. Écrans
1. **Carte saga** : chemin sinueux à défilement vertical à travers les 5 royaumes, nœuds de niveau (étoiles, crâne, boss),
   avatar du héros sur le niveau courant, vies et gemmes en haut, bandeau du tournoi.
2. **Pré-niveau** : objectif, étoiles obtenues, bonus à équiper, bouton JOUER (coûte une vie seulement en cas de défaite).
3. **Combat** : PV du héros (barre au-dessus de la tête), salle 2/4, pause. Rien d'autre à l'écran.
4. **Choix du pouvoir** : 3 cartes illustrées qui se retournent, description en une ligne, rareté par couleur de cadre.
5. **Victoire** : étoiles qui tombent une à une, or, coffre d'étoiles, NIVEAU SUIVANT. **Défaite** : continuer (gemmes), réessayer, carte.
6. **Héros** (onglets Héros, Équipement, Talents), **Quêtes du jour**, **Bestiaire**, **Boutique**, **Pass de saison**, **Tournoi** (règles, essais restants, classement),
   **Réglages** (son, musique, vibrations, tir auto permanent, réduire les animations, restaurer, confidentialité, crédits des polices).

## 13. Technique
- `sim/` TypeScript (vitest), `tools/` (génération, bots, traces, pipeline d'art), `content/` (JSON), `art/` (SVG + rigs),
  `web/` (prototype canvas qui lit les mêmes JSON et atlas), `ios/` (XcodeGen : `project.yml`, `Core/`, `Game/`, `UI/`,
  `Services/`, `Resources/`, `Tests/`).
- iOS 17+, SpriteKit (rendu, atlas `SKTextureAtlas`), SwiftUI (menus), StoreKit 2, GameKit (classement hebdo récurrent),
  Core Haptics (impacts), AVAudioEngine (sons synthétisés simples ; pas de fichiers audio sous licence).
- Persistance locale JSON (progression, étoiles, vies avec horodatage, talents, gemmes) + iCloud Key-Value pour la synchro.
- Performance : 60 i/s sur iPhone 11 ; au plus 150 projectiles et 30 ennemis simultanés (bornes testées).

## 14. Définition de « première version prête à compiler »
- [ ] Toutes les tâches M0 à M7 cochées, `pnpm verify` vert.
- [ ] 300 niveaux générés et validés dans leurs bandes, rapport de difficulté propre.
- [ ] Prototype web jouable du niveau 1 au 40 avec les vrais assets ; captures de chaque écran.
- [ ] Atlas @2x/@3x de tous les personnages, ennemis, boss, décors des 5 royaumes, VFX et icônes.
- [ ] Code Swift complet, `project.yml`, `.storekit`, traces de rejeu et tests XCTest prêts.
- [ ] `docs/MAC_PHASE.md` : étapes exactes pour la phase Mac (voir TASKS M8).
