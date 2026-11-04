# Direction artistique — Ombrelune : théâtre d'ombres

**Idée** : chaque salle est un écran de papier éclairé par derrière, sur une petite scène encadrée de rideaux.
Les personnages sont des marionnettes découpées dans l'encre. Le nom du jeu (ombre + lune) donne tout : la lumière
vient de la lune derrière l'écran, le reste est silhouette.

## Palette (jetons dans `art/src/palette.ts`, mêmes noms en CSS et en Swift)
| Jeton | Couleur | Rôle |
|---|---|---|
| encre | `#1b1418` | marionnettes, obstacles, texte |
| encre claire | `#40333a` | pièces intérieures des marionnettes (seconde couche de papier) |
| découpe | `#fff4d6` | lumière qui traverse les trous (yeux, runes, entailles) |
| papier | `#efe3c6` | interface |
| **vermillon** | `#d8431f` | **danger uniquement** en combat (télégraphes, projectiles ennemis), action principale dans l'interface |
| jade | `#2b8a74` | l'héroïne (seule marionnette teintée), soins, gemmes |
| or à la feuille | `#c9a13b` | récompenses : étoiles, or, élites |
| rideau | `#2b1317` | coulisses autour de l'écran |

Chaque royaume ne change que la **lumière derrière l'écran** :
Forêt (paille), Marais (vert d'eau), Désert (safran), Givre (blanc bleuté), Cendres (rose de braise).
L'eau et la lave sont des « gels » colorés vus à travers une découpe.

## Lisibilité du combat
- Silhouette d'encre sur papier clair : contraste maximal, quel que soit le royaume.
- Le vermillon n'existe qu'en tant que danger : zones hachurées dont le plein se referme jusqu'à l'impact,
  lignes de charge avec flèches découpées qui avancent, projectiles ennemis vermillon cernés d'encre.
- L'héroïne est la seule figure teintée : on la retrouve d'un coup d'œil.
- Pas de halos ni de dégradés lumineux sur les personnages : la lumière, c'est le papier.

## Marionnettes articulées (`art/src/rig.ts`, `heroes.ts`, `monsters.ts`, `bosses.ts`)
Chaque personnage est fait de pièces d'encre épinglées (rivets de lumière aux articulations) et percées de dentelle,
comme une vraie marionnette d'ombre. Couleurs projetées sur deux encres ; yeux = trous de lumière.
Poses : `idle`, `move`, `windup` (0→1, signal propre à chaque ennemi), `charge`, `recover`, `spawn` (descend au bout d'un fil),
`breath` (boss affaissé = ouverture), et champs optionnels `release` (1→0 en 0,25 s : coup porté), `hurt` (1→0 : recul),
`dying` (0→1 en 0,5 s : les épingles sautent, les pièces tombent), `cutting` (héros, 1→0 : coup de ciseaux après une boucle).

- **L'Éclaireuse** : aiguille-arc d'argent (le fil passe par le chas), bobine dans le dos qui tourne en marchant,
  seule marionnette teintée (cape, capuche et jupe jade).
- **Mite de papier** : ailes à ocelles découpées, antennes plumeuses, mandibules vermillon quand elle grignote le fil.
- **Crabe-ciseaux** : pinces en lames de ciseaux, ouvertes et bordées de vermillon avant la charge.
Les mêmes dessins produisent les atlas iOS (`pnpm art:atlas`, y compris les poses `death` et `cut`).

## Décor
Par royaume : silhouettes lointaines (fougères, roseaux, cactus et ruines, aiguilles de glace, arbres calcinés),
rochers et haies propres à chaque royaume, eau et lave en bandes de papier ondulées, cadre de scène à appliques.
`paintDecorAnim` anime une couche légère : herbes qui ondulent, petits décors suspendus à des fils, flammes des appliques.

### Décor en pièces (atlas iOS)
`pnpm art:atlas` découpe le décor en pièces que SpriteKit recompose : `Decor_<Royaume>.atlas` (lumière de l'écran,
frise lointaine, découpes semées, rochers, haies, eau ou lave en autotile 16 cases, vagues, touffes, découpes
suspendues et dérivantes), `Stage.atlas` (cadre de scène, fibres du papier, rideau, lambrequin, rampe, flammes)
et `VFX.atlas`. Noms, tailles et ancres : `ios/Resources/Atlases/README.md` ; aperçu : `?atlas=preview&k=0…4`.

## Effets (`art/src/vfx.ts`, `VFX.atlas`)
Impact (losange de lumière, éclats d'encre ; critique : étoile cernée de vermillon), onde d'encre, chutes de papier,
éclair de découpe, trou dans l'écran et morceau qui tombe, télégraphes (disque et bande hachurés vermillon qui se
remplissent), zone de feu, orbe et gerbe de soin (jade), bouclier, porte de scène qui s'ouvre, confettis de papier
(pouvoir Confettis), « clic » de ciseaux quand le fil est coupé, nœud de fermeture de la boucle.

## Apparences (pass de saison)
Accessoires de papier épinglés sur la marionnette, sans effet en jeu (`web/src/skins.ts`) : **Oreilles de renard**
(oreilles et queue d'encre, pointes de lumière), **Ailes de papier** (ailes ajourées qui battent, broche jade),
**Couronne de lune** (croissant d'or à la feuille). Elles se portent avec ou sans la Parure du Dragon.

## Ciseaux de lune (rendu du fil)
Le fil est une entaille lumineuse doublée de pointillés d'encre, qui pâlit en séchant. Boucle presque fermée : la zone
s'éclaire. Découpe : éclair de lumière, trou sombre (on voit les coulisses) puis le morceau de papier tombe en tournoyant.

## Motion design
- Entrée de salle : ouverture en iris, puis une étiquette de papier descend au bout de deux fils.
- Impact : la marionnette s'éclaire (flash de lumière), chiffres d'encre (vermillon si critique), micro-secousse.
- Mort : la marionnette se déchire en chutes de papier qui tombent en tournoyant.
- Coup reçu : bords de l'écran qui s'assombrissent, arrêt sur image, vibration.
- Interface : cartes de pouvoir qui se retournent, étoiles tamponnées une à une, rideaux qui s'ouvrent à l'écran titre.
- Ombres portées franches (décalage sans flou), légères rotations « posées à la main ».
- « Réduire les animations » coupe secousses et arrêts sur image ; `prefers-reduced-motion` respecté.

## Typographies (licence OFL, crédits dans Réglages)
- Titres : **IM Fell English SC** (Igino Marini), un romain de livre ancien.
- Texte : **Alegreya Sans** (Juan Pablo del Peral), humaniste et lisible petit, italique pour les mentions.
