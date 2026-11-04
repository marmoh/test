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

## Marionnettes (`art/src/characters.ts`)
Les couleurs de dessin sont projetées sur deux encres (`puppet()`), les yeux sont des trous de lumière avec une pupille.
Poses : `idle`, `move`, `windup` (anneau vermillon qui se resserre), `charge`, `recover`, `spawn`, `breath`
(boss essoufflé : étoiles découpées qui tournent = ouverture). Élites : couronne et pointillés d'or à la feuille.
Les mêmes dessins produisent les atlas iOS (`pnpm art:atlas`).

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
