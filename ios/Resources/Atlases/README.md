# Atlas SpriteKit — Ombrelune

Généré par `pnpm art:atlas` (`tools/art-atlas.mjs`, page `?atlas` du prototype web) à partir des mêmes dessins
vectoriels que le web (`art/src/*`). **Ne pas modifier à la main** : relancer la commande (serveur de dev lancé).
Aperçu visuel : `http://localhost:5173/?atlas=preview&k=0` (k = 0…4, royaume).

- Chaque image existe en `@2x` et `@3x` ; les tailles ci-dessous sont en **points** (1 pt = 1 unité de la simulation,
  case d'arène = 44 pt). Chargement : `SKTextureAtlas(named: "Decor_Forest")`, texture `textureNamed("rock_00")`.
- Nom d'image : `<pièce>_<NN>` (NN = numéro d'image ou de variante sur 2 chiffres) ; sans suffixe = image unique.
- Personnages : origine du dessin au centre de l'image, **décalée de 4 pt vers le bas** (le pied est sous le centre) :
  `anchorPoint = (0.5, 0.5 − 4 / taille)` (repère SpriteKit, y vers le haut).
- Décor : coordonnées « (x, y) pt » comptées depuis le coin haut-gauche de l'image ; rochers, haies et cases liquides
  sont centrés sur leur case (`anchorPoint = (0.5, 0.5)`).
- VFX : effet centré sur l'image (`anchorPoint = (0.5, 0.5)`, sauf la porte) ; images régulièrement espacées sur la durée indiquée.
- Total : **21.49 Mo** pour 11 atlas (2246 fichiers PNG).

## Atlas
| Atlas | Images (par échelle) | Poids |
|---|---|---|
| `Bosses.atlas` | 188 | 8.61 Mo |
| `Decor_Ash.atlas` | 68 | 0.62 Mo |
| `Decor_Desert.atlas` | 68 | 0.60 Mo |
| `Decor_Forest.atlas` | 68 | 0.58 Mo |
| `Decor_Frost.atlas` | 68 | 0.59 Mo |
| `Decor_Swamp.atlas` | 68 | 0.64 Mo |
| `Enemies.atlas` | 308 | 5.25 Mo |
| `Hero.atlas` | 78 | 1.65 Mo |
| `Icons.atlas` | 44 | 0.50 Mo |
| `Stage.atlas` | 13 | 0.17 Mo |
| `VFX.atlas` | 152 | 2.30 Mo |

## Personnages (`Hero.atlas`, `Enemies.atlas`, `Bosses.atlas`)
Animations : `idle`, `move`, `aim` (héros), `cut` (héros, coup de ciseaux), `windup` (anticipation 0→1),
`charge`, `death` (les épingles sautent), `breath` (boss essoufflé = ouverture).
| Images | Nombre | Taille (pt) | Durée |
|---|---|---|---|
| **Hero** | | | |
| `scout_idle_00…07` | 8 | 76 × 76 | 2.6 s |
| `scout_move_00…07` | 8 | 76 × 76 | 0.42 s |
| `scout_aim_00…03` | 4 | 76 × 76 | 0.2 s |
| `scout_cut_00…05` | 6 | 76 × 76 | 0.5 s |
| `windMonk_idle_00…07` | 8 | 76 × 76 | 2.6 s |
| `windMonk_move_00…07` | 8 | 76 × 76 | 0.42 s |
| `windMonk_aim_00…03` | 4 | 76 × 76 | 0.2 s |
| `windMonk_cut_00…05` | 6 | 76 × 76 | 0.5 s |
| `emberSorcerer_idle_00…07` | 8 | 76 × 76 | 2.6 s |
| `emberSorcerer_move_00…07` | 8 | 76 × 76 | 0.42 s |
| `emberSorcerer_aim_00…03` | 4 | 76 × 76 | 0.2 s |
| `emberSorcerer_cut_00…05` | 6 | 76 × 76 | 0.5 s |
| **Enemies** | | | |
| `goblin_idle_00…07` | 8 | 76 × 76 | 2.6 s |
| `goblin_move_00…07` | 8 | 76 × 76 | 0.42 s |
| `goblin_windup_00…05` | 6 | 76 × 76 | 0.5 s |
| `goblin_death_00…05` | 6 | 76 × 76 | 0.5 s |
| `jelly_idle_00…07` | 8 | 76 × 76 | 2.6 s |
| `jelly_move_00…07` | 8 | 76 × 76 | 0.42 s |
| `jelly_death_00…05` | 6 | 76 × 76 | 0.5 s |
| `jellySmall_idle_00…07` | 8 | 76 × 76 | 2.6 s |
| `jellySmall_move_00…07` | 8 | 76 × 76 | 0.42 s |
| `jellySmall_death_00…05` | 6 | 76 × 76 | 0.5 s |
| `bat_idle_00…07` | 8 | 76 × 76 | 2.6 s |
| `bat_move_00…07` | 8 | 76 × 76 | 0.42 s |
| `bat_windup_00…05` | 6 | 76 × 76 | 0.5 s |
| `bat_charge_00…03` | 4 | 76 × 76 | 0.25 s |
| `bat_death_00…05` | 6 | 76 × 76 | 0.5 s |
| `mushroom_idle_00…07` | 8 | 76 × 76 | 2.6 s |
| `mushroom_move_00…07` | 8 | 76 × 76 | 0.42 s |
| `mushroom_windup_00…05` | 6 | 76 × 76 | 0.5 s |
| `mushroom_death_00…05` | 6 | 76 × 76 | 0.5 s |
| `wolf_idle_00…07` | 8 | 76 × 76 | 2.6 s |
| `wolf_move_00…07` | 8 | 76 × 76 | 0.42 s |
| `wolf_windup_00…05` | 6 | 76 × 76 | 0.5 s |
| `wolf_charge_00…03` | 4 | 76 × 76 | 0.25 s |
| `wolf_death_00…05` | 6 | 76 × 76 | 0.5 s |
| `skeleton_idle_00…07` | 8 | 76 × 76 | 2.6 s |
| `skeleton_move_00…07` | 8 | 76 × 76 | 0.42 s |
| `skeleton_windup_00…05` | 6 | 76 × 76 | 0.5 s |
| `skeleton_death_00…05` | 6 | 76 × 76 | 0.5 s |
| `totem_idle_00…07` | 8 | 76 × 76 | 2.6 s |
| `totem_move_00…07` | 8 | 76 × 76 | 0.42 s |
| `totem_windup_00…05` | 6 | 76 × 76 | 0.5 s |
| `totem_death_00…05` | 6 | 76 × 76 | 0.5 s |
| `mage_idle_00…07` | 8 | 76 × 76 | 2.6 s |
| `mage_move_00…07` | 8 | 76 × 76 | 0.42 s |
| `mage_windup_00…05` | 6 | 76 × 76 | 0.5 s |
| `mage_death_00…05` | 6 | 76 × 76 | 0.5 s |
| `moth_idle_00…07` | 8 | 76 × 76 | 2.6 s |
| `moth_move_00…07` | 8 | 76 × 76 | 0.42 s |
| `moth_windup_00…05` | 6 | 76 × 76 | 0.5 s |
| `moth_death_00…05` | 6 | 76 × 76 | 0.5 s |
| `snipper_idle_00…07` | 8 | 76 × 76 | 2.6 s |
| `snipper_move_00…07` | 8 | 76 × 76 | 0.42 s |
| `snipper_windup_00…05` | 6 | 76 × 76 | 0.5 s |
| `snipper_charge_00…03` | 4 | 76 × 76 | 0.25 s |
| `snipper_death_00…05` | 6 | 76 × 76 | 0.5 s |
| **Bosses** | | | |
| `treant_idle_00…07` | 8 | 128 × 128 | 2.6 s |
| `treant_move_00…07` | 8 | 128 × 128 | 0.42 s |
| `treant_windup_00…05` | 6 | 128 × 128 | 0.5 s |
| `treant_death_00…05` | 6 | 128 × 128 | 0.5 s |
| `treant_breath_00…07` | 8 | 128 × 128 | 1.6 s |
| `queen_idle_00…07` | 8 | 128 × 128 | 2.6 s |
| `queen_move_00…07` | 8 | 128 × 128 | 0.42 s |
| `queen_windup_00…05` | 6 | 128 × 128 | 0.5 s |
| `queen_death_00…05` | 6 | 128 × 128 | 0.5 s |
| `queen_breath_00…07` | 8 | 128 × 128 | 1.6 s |
| `scorpion_idle_00…07` | 8 | 128 × 128 | 2.6 s |
| `scorpion_move_00…07` | 8 | 128 × 128 | 0.42 s |
| `scorpion_windup_00…05` | 6 | 128 × 128 | 0.5 s |
| `scorpion_charge_00…03` | 4 | 128 × 128 | 0.25 s |
| `scorpion_death_00…05` | 6 | 128 × 128 | 0.5 s |
| `scorpion_breath_00…07` | 8 | 128 × 128 | 1.6 s |
| `wyvern_idle_00…07` | 8 | 128 × 128 | 2.6 s |
| `wyvern_move_00…07` | 8 | 128 × 128 | 0.42 s |
| `wyvern_windup_00…05` | 6 | 128 × 128 | 0.5 s |
| `wyvern_charge_00…03` | 4 | 128 × 128 | 0.25 s |
| `wyvern_death_00…05` | 6 | 128 × 128 | 0.5 s |
| `wyvern_breath_00…07` | 8 | 128 × 128 | 1.6 s |
| `ashlord_idle_00…07` | 8 | 128 × 128 | 2.6 s |
| `ashlord_move_00…07` | 8 | 128 × 128 | 0.42 s |
| `ashlord_windup_00…05` | 6 | 128 × 128 | 0.5 s |
| `ashlord_death_00…05` | 6 | 128 × 128 | 0.5 s |
| `ashlord_breath_00…07` | 8 | 128 × 128 | 1.6 s |

## Icônes (`Icons.atlas`)
`power_<id>` (24 pouvoirs) et `ui_<id>` (interface), 64 × 64 pt, encre sur transparent.

## Décors des 5 royaumes (`Decor_<Royaume>.atlas`)
`Decor_Forest` = Forêt d’Ombrelune · `Decor_Swamp` = Marais des Lucioles · `Decor_Desert` = Désert d’Ambre · `Decor_Frost` = Pics de Givre · `Decor_Ash` = Terres de Cendres.
Les cinq atlas ont les mêmes noms d'images (la lave remplace l'eau dans `Decor_Ash`).
Composition d'une salle (dans l'ordre) : `floor_light` étirée → `floor_fibres` (Stage) en mosaïque → `horizon` →
`far_NN` semées → cases `water_MM` / `lava_MM` → `hedge_NN` / `rock_NN` (variante = case, au choix du jeu) →
chaque image : `*_waves`, `tuft_*`, `hang`, `drift` → `stage_frame` et flammes `lamp_flame` (Stage) → porte (`portal_*`, VFX).
| Images | Nombre | Taille (pt) | Usage |
|---|---|---|---|
| `floor_light` | 1 | 99 × 165 | lumière de l’écran (dégradé), à étirer × 4 sur 396 × 660 |
| `horizon` | 1 | 396 × 60 | frise lointaine, posée en haut de l’écran (y = 0) |
| `far_00…03` | 4 | 32 × 32 | découpes semées sur le sol (règle `farSpot` de arena-art.ts), miroir si `flip` |
| `rock_00…03` | 4 | 56 × 56 | rocher `#` ; la case (44 pt) est centrée, marge 6 pt pour l’ombre portée |
| `hedge_00…03` | 4 | 56 × 56 | haie `%` ; même cadrage que les rochers |
| `water_00…15` | 16 | 48 × 48 | eau `~` en autotile : suffixe = masque des voisins liquides N 1 · E 2 · S 4 · O 8 ; marge 2 pt |
| `water_waves_00…09` | 10 | 44 × 44 | crêtes de vagues (calque) sur chaque case d’eau, boucle 5 s (0,5 s / image) |
| `tuft_a_00…07` | 8 | 28 × 28 | touffe qui ondule au pied des obstacles, boucle 4,8 s ; pied à (14, 22) pt, anchorPoint (0.5, 0.21) |
| `tuft_b_00…07` | 8 | 28 × 28 | seconde touffe (fougère en Forêt), même boucle |
| `hang_00…07` | 8 | 32 × 56 | découpe suspendue à son fil, balancement 5,7 s ; pivot à (16, 2) pt, anchorPoint (0.5, 0.96) |
| `drift_00…03` | 4 | 20 × 20 | grandes découpes qui dérivent (le jeu les déplace et les fait tourner) |
| `lava_00…15` | 16 | 48 × 48 | lave `~` (Cendres) en autotile, même masque que l’eau |
| `lava_waves_00…09` | 10 | 44 × 44 | crêtes et bulles (calque) sur chaque case de lave, boucle 10 s (1 s / image) |

## Scène (`Stage.atlas`, commune aux royaumes)
| Images | Nombre | Taille (pt) | Usage |
|---|---|---|---|
| `stage_frame` | 1 | 448 × 712 | cadre de scène (montants, clous, appliques) ; centre transparent = écran 396 × 660 à (26, 26) |
| `floor_fibres` | 1 | 132 × 132 | fibres et plis du papier, tuile transparente raccordable (3 × 3 cases), sur `floor_light` |
| `curtain_tile` | 1 | 88 × 176 | rideau (plis), tuile horizontale et verticale |
| `valance_tile` | 1 | 120 × 64 | lambrequin festonné avec glands dorés, tuile horizontale (haut de l’écran) |
| `footlights_tile` | 1 | 120 × 60 | rampe de scène (planches et lampes), tuile horizontale (bas de l’écran) |
| `lamp_flame_00…07` | 8 | 12 × 16 | flamme des appliques du cadre, boucle 0,45 s ; mèche à (6, 11) pt, anchorPoint (0.5, 0.31) |

## Effets (`VFX.atlas`)
Le vermillon n'y sert qu'au danger (télégraphes, zones) et au critique.
| Images | Nombre | Taille (pt) | Durée | Effet |
|---|---|---|---|---|
| `impact_00…05` | 6 | 48 × 48 | 0.18 s | Flash d’impact d’une aiguille : losange de lumière qui se referme, éclats d’encre. |
| `impact_crit_00…05` | 6 | 64 × 64 | 0.24 s | Impact critique : étoile de lumière cernée de vermillon (seul vermillon côté héros : chiffres critiques). |
| `ring_00…05` | 6 | 96 × 96 | 0.35 s | Onde d’encre (mort d’une marionnette, impact de zone) : anneau qui s’élargit et s’amincit. |
| `scrap_ink_00…07` | 8 | 16 × 16 | 0.5 s, boucle | Chute de papier d’encre qui tournoie (rotation + retournement), à lancer en particules. |
| `scrap_ink2_00…07` | 8 | 16 × 16 | 0.5 s, boucle | Chute de papier (encre claire). |
| `scrap_light_00…07` | 8 | 16 × 16 | 0.5 s, boucle | Chute de papier clair (lumière), cernée d’un trait d’encre. |
| `scraps_burst_00…07` | 8 | 96 × 96 | 0.9 s | Gerbe de chutes de papier (mort d’un ennemi) déjà composée, pour les appareils lents. |
| `cut_flash_00…05` | 6 | 128 × 112 | 0.12 s | Éclair de la découpe : la boucle se remplit de lumière, contour d’encre (à étirer à la taille de la boucle). |
| `cut_hole_00…05` | 6 | 128 × 112 | 0.9 s | Trou dans l’écran après la découpe (on voit les coulisses), qui se referme. |
| `cut_piece_00…07` | 8 | 128 × 112 | 0.95 s | Morceau de papier découpé qui tombe en tournoyant (teinter avec le papier du royaume). |
| `telegraph_circle_00…07` | 8 | 96 × 96 | 0.8 s | Télégraphe de zone : disque hachuré vermillon dont le plein se referme vers le centre jusqu’à l’impact (k = 1). Rayon 44 pt, à mettre à l’échelle. |
| `telegraph_line_00…07` | 8 | 176 × 36 | 0.6 s | Télégraphe de charge : bande hachurée de 160 × 28 pt qui se remplit de gauche à droite, flèches découpées qui avancent. Étirer en longueur (9-slice horizontal). |
| `hazard_fire_00…07` | 8 | 96 × 96 | 0.6 s, boucle | Zone persistante (flaque du mage, souffle des boss) : fond vermillon hachuré, flammes d’encre qui dansent. |
| `heal_orb_00…07` | 8 | 32 × 32 | 1.57 s, boucle | Orbe de soin : cœur jade qui flotte (boucle). |
| `heal_burst_00…05` | 6 | 64 × 64 | 0.8 s | Soin reçu (entre deux salles, orbe ramassé) : points jade qui montent et s’éteignent. |
| `shield_ring_00…07` | 8 | 56 × 56 | 1.57 s, boucle | Bouclier prêt (Égide, pouvoir Bouclier) : cercle jade en pointillés qui respire. |
| `portal_open_00…07` | 8 | 96 × 80 | 0.5 s | Porte de scène qui s’ouvre (k = 0 fermée → 1 ouverte). Seuil de la porte à 66 pt du haut : anchorPoint (0.5, 0.18), posé à y = 8 pt sous le bord haut de l’écran (centre en x). |
| `portal_loop_00…07` | 8 | 96 × 80 | 0.98 s, boucle | Porte ouverte : rayons de lumière qui tournent (boucle, 1/8 de tour) ; même cadrage que portal_open. |
| `confetti_00…07` | 8 | 128 × 128 | 0.7 s | Confettis (pouvoir) : le découpé éclate en confettis de papier sur ses voisins (rayon 72 pt). |
| `snip_spark_00…05` | 6 | 40 × 40 | 0.3 s | Fil coupé ou grignoté : petit « clic » de ciseaux (croix découpée) et éclats d’encre. |
| `thread_knot_00…05` | 6 | 24 × 24 | 0.6 s, boucle | Point de fermeture de la boucle (nœud jade qui palpite quand la boucle est presque fermée). |
